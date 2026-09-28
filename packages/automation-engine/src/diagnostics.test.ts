import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { expandForFailure, expandStateEvidence, expandTransitionEvidence } from './code-evidence';
import { MAX_RENDER_TIMING_COMPONENTS, selectRenderTimingTargets, statesByComponent } from './render-timing';
import type { CodeGraphView } from './code-evidence';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import type { AnomalyReason } from './capture-policy';
import { ORIGIN, limits, lmsApp, lmsContract, state } from './test-fixtures';

const config = (overrides: Partial<AutomationConfig> = {}): AutomationConfig => ({
  contract: lmsContract(), targetStateKey: 'exam_created', environment: 'STAGING', applicationOrigin: ORIGIN, limits: limits(), ...overrides,
});

interface ChunkLog { begun: Array<{ label: string; stateKey: string | null }>; ended: Array<{ stateKey: string | null; retain: boolean; reasons: AnomalyReason[] }> }

function withChunks<T extends object>(app: T): T & { chunks: ChunkLog } {
  const chunks: ChunkLog = { begun: [], ended: [] };
  return Object.assign(app, {
    chunks,
    traceChunks: {
      begin: (label: string, stateKey: string | null) => { chunks.begun.push({ label, stateKey }); },
      end: (result: ChunkLog['ended'][number]) => { chunks.ended.push(result); },
    },
  });
}

test('a run that goes to plan records a chunk per state and keeps none of them', async () => {
  const app = withChunks(lmsApp());
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.ok(app.chunks.begun.length >= 2, 'a chunk was recorded for the states visited');
  assert.equal(app.chunks.begun.length, app.chunks.ended.length, 'every chunk that opened was closed');
  assert.ok(app.chunks.ended.every((chunk) => !chunk.retain), 'nothing went wrong, so nothing is kept');
});

test('chunks are scoped to state visits, and the first covers entry before any state is recognised', async () => {
  const app = withChunks(lmsApp());
  await runAutomation(app, config());
  assert.equal(app.chunks.begun[0]!.stateKey, null);
  assert.equal(app.chunks.begun[0]!.label, 'entry');
  const states = app.chunks.begun.slice(1).map((chunk) => chunk.stateKey);
  assert.deepEqual(states, [...new Set(states)].filter((key) => key !== null), 'each state visited once in a clean run');
  assert.ok(states.includes('exam_created'));
});

test('a state whose action did not advance keeps its chunk, with the reason', async () => {
  const app = withChunks(lmsApp({ clicks: { 'e-create': 'form' } }));
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
  const kept = app.chunks.ended.filter((chunk) => chunk.retain);
  assert.ok(kept.length >= 1, 'the failing visit is retained');
  assert.ok(kept.some((chunk) => chunk.stateKey === 'exam_form' && chunk.reasons.includes('ACTION_DID_NOT_ADVANCE')));
  assert.ok(app.chunks.ended.some((chunk) => !chunk.retain), 'the states that went fine are not');
  assert.equal(app.chunks.begun.length, app.chunks.ended.length);
});

test('a run that never reaches its start keeps the entry chunk', async () => {
  const app = withChunks(lmsApp({ start: 'blank', pages: { blank: { path: '/nothing', elements: [] } }, seekInitial: async () => null }));
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
  assert.deepEqual(app.chunks.ended.map((chunk) => chunk.stateKey), [null]);
});

test('an adapter whose tracing fails does not end the run', async () => {
  const app = lmsApp();
  Object.assign(app, { traceChunks: { begin: () => { throw new Error('no tracing'); }, end: () => { throw new Error('no tracing'); } } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
});

test('an adapter without tracing costs nothing', async () => {
  const result = await runAutomation(lmsApp(), config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
});

test('the failing transition is named to the evidence hook, so the code can be explained', async () => {
  const app = lmsApp({ clicks: { 'e-create': 'form' } });
  const seen: Array<string | null> = [];
  Object.assign(app, { captureEvidence: (_decision: unknown, _state: string | null, subject?: { transitionId: string | null }) => { seen.push(subject?.transitionId ?? null); } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
  assert.ok(seen.some((id) => id !== null), 'a transition id accompanied the failure');
});

// -- code evidence -----------------------------------------------------------

const SOURCE = ['line 1', 'export function saveExam() {', '  return post("/api/exams");', '}', 'line 5'].join('\n');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const graph = (): CodeGraphView => ({
  entities: [
    { id: 'handler', type: 'function', name: 'saveExam', path: 'src/exams/create.tsx', startLine: 2, endLine: 4, metadata: {} },
    { id: 'button', type: 'ui_action', name: 'Save', path: 'src/exams/create.tsx', startLine: 10, endLine: 10, metadata: {} },
    { id: 'endpoint', type: 'api_endpoint', name: 'POST /api/exams', path: 'src/server/exams.ts', startLine: 1, endLine: 9, metadata: {} },
    { id: 'route', type: 'ui_route', name: '/exams/created', path: 'app/exams/created/page.tsx', startLine: 1, endLine: null, metadata: { route: '/exams/created' } },
    { id: 'guard', type: 'ui_guard', name: 'middleware', path: 'middleware.ts', startLine: 1, endLine: null, metadata: { source: 'middleware', requiresAuth: true, roles: ['TEACHER'] } },
  ],
  relationships: [
    { source: 'button', target: 'handler', type: 'ROUTES_TO' },
    { source: 'handler', target: 'endpoint', type: 'CALLS' },
    { source: 'route', target: 'guard', type: 'GUARDED_BY' },
  ],
});

const contractWithCode = () => {
  const contract = lmsContract();
  contract.transitions = contract.transitions.map((t) => t.id === 't-submit'
    ? { ...t, codeRefs: [{ file: 'src/exams/create.tsx', symbol: 'saveExam', entityId: 'handler' }], expectedApi: [{ method: 'POST', route: '/api/exams', expectStatus: null }] }
    : t);
  contract.states = contract.states.map((s) => s.key === 'exam_created' ? { ...s, routePatterns: ['/exams/created'] } : s);
  return contract;
};

test('a failed transition is explained from its handler, calls and destination guards', () => {
  const contract = contractWithCode();
  const target = contract.transitions.find((t) => t.id === 't-submit');
  assert.ok(target, 'fixture has the transition');
  const evidence = expandTransitionEvidence(contract, target!, { graph: graph(), readSource: () => SOURCE });
  assert.equal(evidence.subject.kind, 'TRANSITION');
  assert.deepEqual(evidence.refs.map((ref) => [ref.symbol, ref.startLine, ref.endLine]), [['saveExam', 2, 4]]);
  assert.deepEqual(evidence.calls, ['POST /api/exams']);
  assert.equal(evidence.guards.length, 1);
  assert.deepEqual(evidence.guards[0]!.roles, ['TEACHER']);
  assert.match(evidence.summary, /saveExam \(src\/exams\/create\.tsx:2-4\)/);
  assert.match(evidence.summary, /calls POST \/api\/exams/);
  assert.match(evidence.summary, /requires roles TEACHER/);
});

test('the source itself never leaves: only a hash of the referenced range', () => {
  const contract = contractWithCode();
  const evidence = expandTransitionEvidence(contract, contract.transitions.find((t) => t.id === 't-submit')!, { graph: graph(), readSource: () => SOURCE });
  assert.equal(evidence.refs[0]!.excerptSha256, sha('export function saveExam() {\n  return post("/api/exams");\n}'));
  assert.ok(!JSON.stringify(evidence).includes('return post'), 'no source text in the record');
});

test('unreadable source degrades to no hash, not to no evidence', () => {
  const contract = contractWithCode();
  const evidence = expandTransitionEvidence(contract, contract.transitions.find((t) => t.id === 't-submit')!, { graph: graph(), readSource: () => null });
  assert.equal(evidence.refs[0]!.excerptSha256, null);
  assert.equal(evidence.refs.length, 1);
});

test('a transition with no mapped code says so plainly, and never invents any', () => {
  const contract = lmsContract();
  const evidence = expandTransitionEvidence(contract, contract.transitions[0]!, { graph: graph() });
  assert.deepEqual(evidence.refs, []);
  assert.match(evidence.summary, /No code is mapped/);
});

test('a doubtful mapping is presented as a lead, not a fact', () => {
  const contract = contractWithCode();
  contract.transitions = contract.transitions.map((t) => t.id === 't-submit' ? { ...t, derivation: 'AMBIGUOUS' as const } : t);
  const evidence = expandTransitionEvidence(contract, contract.transitions.find((t) => t.id === 't-submit')!, { graph: graph() });
  assert.match(evidence.summary, /ambiguous, so treat it as a lead/);
});

test('a state is explained by where it lives and who may reach it', () => {
  const s = { ...state({ key: 'exam_created', routePatterns: ['/exams/created'] }), codeRefs: [{ file: 'app/exams/created/page.tsx', symbol: null, entityId: 'route' }] };
  const evidence = expandStateEvidence(s, { graph: graph() });
  assert.equal(evidence.subject.kind, 'STATE');
  assert.equal(evidence.guards.length, 1);
});

test('expandForFailure prefers the failing transition, falls back to the state, and is null for neither', () => {
  const contract = contractWithCode();
  const source = { graph: graph() };
  assert.equal(expandForFailure(contract, { transitionId: 't-submit', stateKey: 'exam_form' }, source)!.subject.kind, 'TRANSITION');
  assert.equal(expandForFailure(contract, { transitionId: null, stateKey: 'exam_form' }, source)!.subject.kind, 'STATE');
  assert.equal(expandForFailure(contract, { transitionId: 'nope', stateKey: 'nope' }, source), null);
});

test('a guard elsewhere in the application is not attributed to the destination', () => {
  const contract = contractWithCode();
  contract.states = contract.states.map((s) => s.key === 'exam_created' ? { ...s, routePatterns: ['/public'] } : s);
  const evidence = expandTransitionEvidence(contract, contract.transitions.find((t) => t.id === 't-submit')!, { graph: graph() });
  assert.deepEqual(evidence.guards, []);
});

// -- render timing targets ---------------------------------------------------

const withRefs = (symbols: Record<string, string[]>) => {
  const contract = lmsContract();
  contract.states = contract.states.map((s) => ({ ...s, codeRefs: (symbols[s.key] ?? []).map((symbol) => ({ file: `src/${symbol}.tsx`, symbol, entityId: null })) }));
  return contract;
};

test('only components the Flow maps to are chosen, never helpers or handlers', () => {
  const contract = withRefs({ exam_form: ['ExamForm', 'validateExam', 'handleSubmit'], exam_created: ['ExamCreated'] });
  contract.transitions = contract.transitions.map((t) => t.id === 't-submit' ? { ...t, codeRefs: [{ file: 'src/x.tsx', symbol: 'SubmitButton', entityId: null }] } : t);
  const targets = selectRenderTimingTargets(contract);
  assert.deepEqual(targets.components, ['ExamForm', 'ExamCreated', 'SubmitButton']);
  assert.deepEqual(targets.byState, { exam_form: ['ExamForm', 'SubmitButton'], exam_created: ['ExamCreated'] }, 'a transition handler renders in the state it leaves');
});

test('a flow with no mapped components selects nothing, so nothing is installed', () => {
  const targets = selectRenderTimingTargets(lmsContract());
  assert.deepEqual(targets, { components: [], byState: {}, omitted: [] });
});

test('the selection is capped, and says what it left out', () => {
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`s${i}`, [`Comp${i}`]]));
  const contract = lmsContract();
  contract.states = Object.keys(many).map((key) => state({ key, codeRefs: [{ file: 'f', symbol: many[key]![0]!, entityId: null }] }));
  const targets = selectRenderTimingTargets(contract);
  assert.equal(targets.components.length, MAX_RENDER_TIMING_COMPONENTS);
  assert.equal(targets.omitted.length, 20 - MAX_RENDER_TIMING_COMPONENTS);
  assert.ok(Object.values(targets.byState).flat().every((name) => targets.components.includes(name)), 'no state points at a component that was not chosen');
  assert.equal(selectRenderTimingTargets(contract, 2).components.length, 2);
  assert.equal(selectRenderTimingTargets(contract, 500).components.length, MAX_RENDER_TIMING_COMPONENTS, 'the ceiling cannot be raised by asking');
});

test('a component shared by two states is attributed to both', () => {
  const targets = selectRenderTimingTargets(withRefs({ exam_form: ['Layout', 'ExamForm'], exam_created: ['Layout'] }));
  assert.deepEqual(statesByComponent(targets), { Layout: ['exam_form', 'exam_created'], ExamForm: ['exam_form'] });
});
