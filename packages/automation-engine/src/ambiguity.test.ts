import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_AMBIGUITY_RESOLVER, askResolver, controlSituation, tiedControls, verifyControlProposal, verifyStateProposal } from './ambiguity';
import type { AmbiguityProposal, AmbiguityResolver } from './ambiguity';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import { rankControls } from './ranking';
import type { ControlCandidate, ExecutableContract, ExecutableTransition } from './types';
import { FakeApp, ORIGIN, control, element, limits, state, transition } from './test-fixtures';

const resolverReturning = (proposal: AmbiguityProposal | null): AmbiguityResolver => ({ id: 'test-resolver', local: true, resolve: async () => proposal });

// -- a step with two equally good controls ------------------------------------

const link = (ref: string, href: string, name = 'Open exam') => element({ ref, tag: 'a', role: 'link', name, href });

const openExam = (overrides: Partial<ExecutableTransition> = {}): ExecutableTransition => transition({
  id: 't-open', from: 'list', to: 'exam_page', action: 'Open exam',
  control: control({ labels: ['Open exam'], element: 'a' }),
  actionClass: 'READ',
  codeRefs: [{ file: 'src/list.tsx', symbol: 'OpenExamLink', entityId: null }],
  ...overrides,
});

const examContract = (t: ExecutableTransition = openExam()): ExecutableContract => ({
  flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'list',
  states: [
    state({ key: 'list', role: 'INITIAL', routePatterns: ['/exams'] }),
    state({ key: 'exam_page', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/exams/{param}'] }),
  ],
  transitions: [t],
});

const tiedPair = () => {
  const elements = [link('real', '/exams/42'), link('decoy', '/help')];
  const ranked = rankControls(openExam().control!, elements);
  assert.equal(ranked.ambiguous, true, 'the fixture really is a tie');
  return tiedControls(ranked.candidates);
};

const verify = (proposal: AmbiguityProposal, t = openExam(), tied: ControlCandidate[] = tiedPair(), contract = examContract(t)) =>
  verifyControlProposal({ transition: t, destination: contract.states.find((s) => s.key === t.to), candidates: tied, proposal });

// -- verification ------------------------------------------------------------

test('a suggestion that agrees on destination and code mapping is accepted', () => {
  const verdict = verify({ choice: 'real', destination: 'exam_page', rationale: 'the link to the exam' });
  assert.equal(verdict.accepted, true);
  if (verdict.accepted) {
    assert.equal(verdict.choice, 'real');
    assert.ok(verdict.agreement.includes('destination') && verdict.agreement.includes('label'));
  }
});

test('a resolver cannot introduce a control the engine did not find', () => {
  const verdict = verify({ choice: 'somewhere-else', destination: 'exam_page', rationale: '' });
  assert.deepEqual(verdict.accepted === false && verdict.reason, 'NOT_A_CANDIDATE');
});

test('the destination must be what the Flow says, and the control must actually lead there', () => {
  const wrongDestination = verify({ choice: 'real', destination: 'list', rationale: '' });
  assert.equal(wrongDestination.accepted === false && wrongDestination.reason, 'DESTINATION_DISAGREES');
  const noDestination = verify({ choice: 'real', rationale: '' });
  assert.equal(noDestination.accepted === false && noDestination.reason, 'DESTINATION_DISAGREES');
  // Says the right destination but is a link somewhere else entirely.
  const decoy = verify({ choice: 'decoy', destination: 'exam_page', rationale: '' });
  assert.equal(decoy.accepted === false && decoy.reason, 'DESTINATION_DISAGREES');
  assert.match(decoy.accepted === false ? decoy.detail : '', /\/help/);
});

test('the destination is compared on the normalised state key', () => {
  assert.equal(verify({ choice: 'real', destination: 'Exam Page', rationale: '' }).accepted, true);
});

test('the control must be the kind the code describes', () => {
  const t = openExam({ control: control({ labels: ['Open exam'], element: 'button' }) });
  const buttonWanted = tiedControls(rankControls(t.control!, [link('a', '/exams/1'), link('b', '/exams/2')]).candidates);
  // Both are links, but the handler in the code is on a button: nothing in the code describes either.
  assert.equal(buttonWanted.length, 2);
  const verdict = verify({ choice: 'a', destination: 'exam_page', rationale: '' }, t, buttonWanted);
  assert.equal(verdict.accepted === false && verdict.reason, 'CODE_MAPPING_DISAGREES');
});

test('a candidate that matches the code better is preferred over the suggestion', () => {
  const t = openExam({ control: control({ labels: ['Open exam'], element: 'a', href: '/exams/{param}' }) });
  // Same name, so the ranking ties them; only one is actually a link to an exam route.
  const withTarget = link('linked', '/exams/9');
  const withoutTarget = element({ ref: 'unlinked', tag: 'a', role: 'link', name: 'Open exam', href: null });
  const tied = tiedControls(rankControls(t.control!, [withTarget, withoutTarget]).candidates);
  assert.equal(tied.length, 2, 'the ranking really could not separate them');
  const verdict = verify({ choice: 'unlinked', destination: 'exam_page', rationale: '' }, t, tied);
  assert.equal(verdict.accepted === false && verdict.reason, 'CODE_MAPPING_DISAGREES');
  assert.match(verdict.accepted === false ? verdict.detail : '', /agrees with the code better/);
  assert.equal(verify({ choice: 'linked', destination: 'exam_page', rationale: '' }, t, tied).accepted, true);
});

test('a tie the code cannot break is left to a suggestion only for a step that cannot change server state', () => {
  const identical = () => tiedControls(rankControls(openExam().control!, [link('one', '/exams/1'), link('two', '/exams/2')]).candidates);
  assert.equal(verify({ choice: 'one', destination: 'exam_page', rationale: '' }, openExam({ actionClass: 'READ' }), identical()).accepted, true);
  assert.equal(verify({ choice: 'one', destination: 'exam_page', rationale: '' }, openExam({ actionClass: 'CLIENT_STATE_MUTATION' }), identical()).accepted, true);
  for (const actionClass of ['SERVER_MUTATION', 'EXTERNAL_SIDE_EFFECT', 'DESTRUCTIVE'] as const) {
    const verdict = verify({ choice: 'one', destination: 'exam_page', rationale: '' }, openExam({ actionClass }), identical());
    assert.equal(verdict.accepted === false && verdict.reason, 'NOT_DISCRIMINATING', actionClass);
  }
});

test('the code can break a tie in favour of the suggestion even for a mutating step', () => {
  const t = openExam({ actionClass: 'SERVER_MUTATION', control: control({ labels: ['Open exam'], element: 'a', href: '/exams/{param}' }) });
  // Equal on the ranking's terms (both named the same), but only one is a link to an exam route.
  const tied = tiedControls(rankControls(t.control!, [link('real', '/exams/42'), link('decoy', '/help')]).candidates);
  const contractWithoutRoutes = examContract(t);
  contractWithoutRoutes.states[1]!.routePatterns = [];
  const verdict = verify({ choice: 'real', destination: 'exam_page', rationale: '' }, t, tied, contractWithoutRoutes);
  assert.equal(verdict.accepted, true);
  assert.ok(verdict.accepted && verdict.agreement.includes('link target'));
});

// -- state suggestions ---------------------------------------------------------

const stateContract = (): ExecutableContract => ({
  flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'x',
  states: [
    state({ key: 'x', role: 'INITIAL', routePatterns: ['/tie'] }),
    state({ key: 'y', routePatterns: ['/tie'] }),
    state({ key: 'z', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/done'] }),
  ],
  // Only y leads anywhere.
  transitions: [transition({ id: 't-go', from: 'y', to: 'z', action: 'Go', control: control({ labels: ['Go'] }), actionClass: 'READ' })],
});

const recognition = (stateKey: string) => ({
  stateKey, score: 0.5, confidence: 'MEDIUM' as const,
  evidence: { route: 'MATCH' as const, sdk: 'ABSENT' as const, requiredPresent: 0, requiredTotal: 0, optionalPresent: 0, optionalTotal: 0, apiMatched: 0, apiTotal: 0 },
});

const stateInput = (choice: string, path = '/tie') => ({
  contract: stateContract(), targetStateKey: 'z', environment: 'STAGING' as const, path,
  tied: [recognition('x'), recognition('y')], proposal: { choice, rationale: '' },
});

test('a suggested state is accepted only if it is one of the tied ones and leads toward the target', () => {
  assert.equal(verifyStateProposal(stateInput('y')).accepted, true);
  const stuck = verifyStateProposal(stateInput('x'));
  assert.equal(stuck.accepted === false && stuck.reason, 'NO_ROUTE_TO_TARGET');
  const outsider = verifyStateProposal(stateInput('z'));
  assert.equal(outsider.accepted === false && outsider.reason, 'NOT_A_CANDIDATE');
  const unknown = verifyStateProposal(stateInput('nope'));
  assert.equal(unknown.accepted === false && unknown.reason, 'NOT_A_CANDIDATE');
});

test('a suggested state whose routes do not include the current page is refused', () => {
  const verdict = verifyStateProposal(stateInput('y', '/somewhere/else'));
  assert.equal(verdict.accepted === false && verdict.reason, 'STATE_ROUTE_DISAGREES');
});

// -- asking -------------------------------------------------------------------

const situation = controlSituation(openExam(), tiedPair());

test('the default resolver has no opinion', async () => {
  assert.equal(await askResolver(NO_AMBIGUITY_RESOLVER, situation), null);
  assert.equal(NO_AMBIGUITY_RESOLVER.local, true);
});

test('a resolver is told about page metadata only', () => {
  assert.equal(situation.kind, 'CONTROL');
  const text = JSON.stringify(situation);
  assert.ok(text.includes('/exams/42'));
  assert.ok(!/password|secret|token|source/i.test(text));
  assert.deepEqual(Object.keys((situation as { candidates: object[] }).candidates[0]!).sort(), ['href', 'label', 'name', 'ref', 'role', 'testId']);
});

test('a resolver that throws, times out or answers nonsense is the same as none', async () => {
  const throwing: AmbiguityResolver = { id: 't', local: true, resolve: async () => { throw new Error('model crashed'); } };
  assert.equal(await askResolver(throwing, situation), null);
  const slow: AmbiguityResolver = { id: 's', local: true, resolve: () => new Promise(() => undefined) };
  assert.equal(await askResolver(slow, situation, 20), null);
  for (const bad of [{ choice: 42 }, { choice: '' }, {}, 'text', []]) {
    assert.equal(await askResolver(resolverReturning(bad as never), situation), null, JSON.stringify(bad));
  }
});

test('an answer is trimmed to what will be recorded', async () => {
  const proposal = await askResolver(resolverReturning({ choice: 'real', destination: 'exam_page', rationale: 'x'.repeat(2000) }), situation);
  assert.equal(proposal!.rationale.length, 500);
  assert.deepEqual(Object.keys(proposal!).sort(), ['choice', 'destination', 'rationale']);
});

// -- in the loop ---------------------------------------------------------------

const config = (contract: ExecutableContract, target: string): AutomationConfig => ({
  contract, targetStateKey: target, environment: 'STAGING', applicationOrigin: ORIGIN, limits: limits(),
});

const listApp = (extra: Partial<ConstructorParameters<typeof FakeApp>[0]> = {}) => new FakeApp({
  start: 'list',
  pages: {
    list: { path: '/exams', sdkState: 'list', elements: [link('real', '/exams/42'), link('decoy', '/help')] },
    exam: { path: '/exams/42', sdkState: 'exam_page', elements: [] },
    help: { path: '/help', elements: [] },
  },
  clicks: { real: 'exam', decoy: 'help' },
  ...extra,
});

test('without a resolver, a tie between controls stops the run, and nothing is clicked', async () => {
  const app = listApp();
  const result = await runAutomation(app, config(examContract(), 'exam_page'));
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.deepEqual(app.actions, []);
});

test('a verified suggestion settles the tie, and the record says a resolver did it and why', async () => {
  const app = listApp();
  Object.assign(app, { resolver: resolverReturning({ choice: 'real', destination: 'exam_page', rationale: 'the exam link' }) });
  const result = await runAutomation(app, config(examContract(), 'exam_page'));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(app.actions, [{ kind: 'CLICK', ref: 'real' }]);
  const selected = app.events.find((event) => event.type === 'QA_AUTOMATION_ACTION_SELECTED')!;
  const resolvedBy = selected.data.resolvedBy as { resolver: string; rationale: string; agreement: string[] };
  assert.equal(resolvedBy.resolver, 'test-resolver');
  assert.equal(resolvedBy.rationale, 'the exam link');
  assert.ok(resolvedBy.agreement.includes('destination'));
});

test('a suggestion the contract disagrees with is discarded and the decoy is never touched', async () => {
  const app = listApp();
  Object.assign(app, { resolver: resolverReturning({ choice: 'decoy', destination: 'exam_page', rationale: 'looks right' }) });
  const result = await runAutomation(app, config(examContract(), 'exam_page'));
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND', 'stops exactly as it would with no resolver');
  assert.deepEqual(app.actions, [], 'nothing was clicked');
  const rejected = app.events.find((event) => event.data.reason === 'RESOLVER_PROPOSAL_REJECTED')!;
  assert.match(String(rejected.data.detail), /DESTINATION_DISAGREES/);
});

test('a suggestion for something that is not on the page is never acted on', async () => {
  const app = listApp();
  Object.assign(app, { resolver: resolverReturning({ choice: 'not-on-the-page', destination: 'exam_page', rationale: '' }) });
  const result = await runAutomation(app, config(examContract(), 'exam_page'));
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.deepEqual(app.actions, []);
});

test('a broken resolver does not end a run that never needed it', async () => {
  const app = new FakeApp({
    start: 'list',
    pages: { list: { path: '/exams', sdkState: 'list', elements: [link('real', '/exams/42')] }, exam: { path: '/exams/42', sdkState: 'exam_page', elements: [] } },
    clicks: { real: 'exam' },
  });
  let asked = 0;
  Object.assign(app, { resolver: { id: 'r', local: true, resolve: async () => { asked += 1; throw new Error('boom'); } } });
  const result = await runAutomation(app, config(examContract(), 'exam_page'));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.equal(asked, 0, 'a resolver is only consulted when the engine could not decide');
});

test('a tie between states is settled by a verified suggestion, and never rated above medium', async () => {
  const app = new FakeApp({
    start: 'tie',
    pages: {
      tie: { path: '/tie', elements: [element({ ref: 'go', name: 'Go', role: 'button' })] },
      done: { path: '/done', sdkState: 'z', elements: [] },
    },
    clicks: { go: 'done' },
  });
  Object.assign(app, { resolver: resolverReturning({ choice: 'y', rationale: 'the state with a way forward' }) });
  const result = await runAutomation(app, config(stateContract(), 'z'));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  const evaluated = app.events.find((event) => event.type === 'QA_AUTOMATION_STATE_EVALUATED')!;
  assert.equal(evaluated.data.recognizedStateKey, 'y');
  assert.notEqual(evaluated.data.confidence, 'HIGH');
  assert.equal((evaluated.data.resolvedBy as { resolver: string }).resolver, 'test-resolver');
});

test('a tie between states the contract cannot confirm still ends the run as ambiguous', async () => {
  const app = new FakeApp({
    start: 'tie',
    pages: { tie: { path: '/tie', elements: [element({ ref: 'go', name: 'Go', role: 'button' })] } },
    clicks: {},
  });
  let asked = 0;
  Object.assign(app, { resolver: { id: 'r', local: true, resolve: async () => { asked += 1; return { choice: 'x', rationale: 'a hunch' }; } } });
  const result = await runAutomation(app, config(stateContract(), 'z'));
  assert.equal(result.stopReason, 'STATE_RECOGNITION_AMBIGUOUS');
  assert.equal(asked, 1, 'the same ambiguity is not put to the resolver again on a retry');
  assert.deepEqual(app.actions, []);
  const rejected = app.events.filter((event) => typeof event.data.resolverRejected === 'string');
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0]!.data.resolverRejected), /NO_ROUTE_TO_TARGET/);
});
