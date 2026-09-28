import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestPersona } from '@tellann/desktop-contracts';
import { compileExecutableContract } from './contract';
import type { CheckpointLike, CodeEntityLike, CodeRelationshipLike, CompileInput, FlowSnapshotLike } from './contract';
import { declaredControl, declaredEffects, declaredInputs, declaredRecognizer, declaredRequirements } from './declared';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import { checkFlowRequirements, materializeRunData, resolveRunData } from './persona';
import { recognize } from './recognizer';
import { FakeApp, ORIGIN, control, element, limits, lmsApp, lmsContract, snapshot, state, transition } from './test-fixtures';
import type { ExecutableContract } from './types';

// ── compile: what a person declared outranks what the code suggests ────────────

const entity = (id: string, type: string, name: string, path: string | null, metadata: Record<string, unknown> = {}): CodeEntityLike => ({ id, type, name, path, metadata });
const rel = (source: string, target: string, type: string): CodeRelationshipLike => ({ source, target, type, confidence: 0.9 });
const mapped = (id: string, entityId: string | null): CheckpointLike => ({ id, mapping: { status: 'RESOLVED', entityId, file: null, symbol: null } });

const entities: CodeEntityLike[] = [
  entity('route-courses', 'ui_route', '/courses', 'app/courses/page.tsx', { route: '/courses' }),
  entity('page-courses', 'function', 'Courses', 'app/courses/page.tsx'),
  entity('btn-create', 'ui_action', 'onClick', 'app/courses/page.tsx', { event: 'onClick', element: 'button', labels: ['New course'], testId: 'new-course' }),
  entity('btn-import', 'ui_action', 'onClick', 'app/courses/page.tsx', { event: 'onClick', element: 'button', labels: ['Import courses'] }),
  entity('fn-create', 'function', 'openCreate', 'app/courses/page.tsx'),
];
const relationships = [rel('btn-create', 'fn-create', 'ROUTES_TO'), rel('btn-import', 'fn-create', 'ROUTES_TO')];

const baseFlow = (transitionExtras: Record<string, unknown> = {}, stateExtras: Record<string, unknown> = {}): FlowSnapshotLike => ({
  states: [
    { id: 's-courses', stateName: 'Courses Page', behaviorKey: 'COURSES_PAGE', role: 'INITIAL', ...stateExtras },
    { id: 's-modal', stateName: 'Create Course Modal', behaviorKey: 'CREATE_COURSE_MODAL', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ],
  transitions: [{ id: 't-open', fromNodeId: 's-courses', toNodeId: 's-modal', action: 'CLICK_CREATE_COURSE', ...transitionExtras }],
});

const compile = (flow: FlowSnapshotLike, overrides: Partial<CompileInput> = {}, mappings: CheckpointLike[] = [mapped('state:s-courses', 'page-courses'), mapped('transition:t-open', 'fn-create')]) =>
  compileExecutableContract({ flowVersionId: 'v1', flow, checkpoints: mappings, code: { entities, relationships }, ...overrides });

test('a route a person declared identifies the state, whatever the code says', () => {
  const derived = compile(baseFlow()).states[0]!;
  assert.deepEqual(derived.routePatterns, ['/courses'], 'without a declaration the route comes from the code');
  const declared = compile(baseFlow({}, { recognizer: { routes: ['/Learn/Courses/:id'], headings: ['My courses'] } })).states[0]!;
  assert.deepEqual(declared.routePatterns, ['/learn/courses/{param}']);
  assert.deepEqual(declared.headings, ['My courses']);
});

test('a state with a declared route needs no code mapping to be recognisable', () => {
  const contract = compile(baseFlow({}, { recognizer: { routes: ['/courses'] } }), {}, []);
  assert.deepEqual(contract.states[0]!.routePatterns, ['/courses']);
});

test('the control a person declared is merged with the one the code found when they agree', () => {
  const found = compile(baseFlow({ control: { role: 'button', label: 'New course' } })).transitions[0]!;
  assert.equal(found.controlOrigin, 'BOTH');
  assert.deepEqual(found.control!.labels, ['New course']);
  assert.equal(found.control!.testId, 'new-course', 'the test id the code knows is kept');
  assert.equal(found.control!.event, 'onClick');
});

test('a declared control settles what the code left ambiguous', () => {
  const ambiguous = compile(baseFlow()).transitions[0]!;
  assert.equal(ambiguous.derivation, 'AMBIGUOUS', 'two buttons share a handler');
  const settled = compile(baseFlow({ control: { role: 'button', label: 'Import courses' } })).transitions[0]!;
  assert.equal(settled.derivation, 'RESOLVED');
  assert.deepEqual(settled.control!.labels, ['Import courses']);
});

test('a control is used even when the code analysis found none', () => {
  const contract = compile(baseFlow({ control: { role: 'link', label: 'Courses' } }), {}, []);
  const t = contract.transitions[0]!;
  assert.equal(t.controlOrigin, 'DECLARED');
  assert.deepEqual(t.control, { labels: ['Courses'], testId: null, domId: null, element: 'a', event: null, actionAnchor: null, href: null });
  assert.equal(compile(baseFlow(), {}, []).transitions[0]!.control, null, 'and without a declaration there is still nothing to guess');
});

test('declared inputs keep their role, and the older shapes still read', () => {
  const inputs = compile(baseFlow({ expectedInput: [{ name: 'email', dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' }, { name: 'title', role: 'GENERATED' }, 'legacy'] })).transitions[0]!.inputs;
  assert.deepEqual(inputs, [
    { name: 'email', label: null, dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' },
    { name: 'title', label: null, dataKey: 'title', role: 'GENERATED' },
    { name: 'legacy', label: null, dataKey: 'legacy' },
  ]);
});

test('declared effects are kept as declared and raise the action class', () => {
  const t = compile(baseFlow({ expectedOutput: [{ method: 'DELETE', route: '/api/courses/:id', status: 204 }] })).transitions[0]!;
  assert.deepEqual(t.expectedApi, [{ method: 'DELETE', route: '/api/courses/{param}', expectStatus: 204, declared: true }]);
  assert.equal(t.actionClass, 'DESTRUCTIVE', 'a step that deletes is classified by what a person said it does, not left as an unknown click');
});

test('mode and requirements are carried, and requirements are part of what was published', () => {
  const t = compile(baseFlow({ mode: 'manual' })).transitions[0]!;
  assert.equal(t.mode, 'MANUAL');
  assert.equal(compile(baseFlow()).transitions[0]!.mode, 'AUTO');
  const plain = compile(baseFlow());
  const required = compile(baseFlow(), { requires: { actor: 'admin', environments: ['dev', 'STAGING', 'nowhere'], data: ['ADMIN_EMAIL'] } });
  assert.deepEqual(required.requires, { actor: 'ADMIN', environments: ['STAGING'], data: ['ADMIN_EMAIL'] });
  assert.equal(plain.requires, undefined);
  assert.notEqual(plain.flowHash, required.flowHash);
});

test('the readers treat what they cannot read as not declared', () => {
  assert.deepEqual(declaredRecognizer('x'), { routes: [], headings: [], texts: [] });
  assert.deepEqual(declaredRecognizer({ routes: ['no-slash', '/ok'] }).routes, ['/ok']);
  assert.equal(declaredControl({ role: 'button' }), null);
  assert.deepEqual(declaredEffects([{ method: 'FETCH', route: '/x' }, { method: 'GET', route: 'x' }, 7]), []);
  assert.deepEqual(declaredInputs({ title: 1 }), [{ name: 'title', label: null, dataKey: 'title' }]);
  assert.equal(declaredRequirements({ environments: [] }), undefined);
});

// ── recognition: a declared heading is corroboration, not a veto ───────────────

test('a declared heading raises the score of the state it names, and its absence costs nothing', () => {
  const login = state({ key: 'login', routePatterns: ['/login'], headings: ['Sign in'] });
  const on = recognize(snapshot({ path: '/login', headings: ['Welcome — Sign in to continue'] }), login);
  const off = recognize(snapshot({ path: '/login', headings: ['Something else'] }), login);
  const none = recognize(snapshot({ path: '/login' }), state({ key: 'login', routePatterns: ['/login'] }));
  assert.equal(on.evidence.heading, 'MATCH');
  assert.equal(off.evidence.heading, 'MISMATCH');
  assert.ok(on.score > none.score, 'a heading that is there adds confidence');
  assert.equal(off.score, none.score, 'a heading that is missing is recorded but not held against the state');
  assert.notEqual(off.confidence, 'LOW', 'the route still says where the user is');
});

test('a state with only a declared heading can still be recognised', () => {
  const only = state({ key: 'welcome', sdkStateSignals: [], headings: ['Welcome back'] });
  assert.equal(recognize(snapshot({ path: '/x', headings: ['Welcome back, Sam'] }), only).evidence.heading, 'MATCH');
});

// ── executor: who performs a step ───────────────────────────────────────────

const config = (overrides: Partial<AutomationConfig> = {}): AutomationConfig => ({
  contract: lmsContract(),
  targetStateKey: 'exam_created',
  environment: 'STAGING',
  applicationOrigin: ORIGIN,
  limits: limits(),
  ...overrides,
});

const withMode = (id: string, mode: 'CONFIRM' | 'MANUAL'): ExecutableContract => {
  const contract = lmsContract();
  return { ...contract, transitions: contract.transitions.map((t) => (t.id === id ? { ...t, mode } : t)) };
};
const clicks = (app: FakeApp) => app.actions.filter((a) => a.kind === 'CLICK').map((a) => (a as { ref: string }).ref);

test('a CONFIRM step is asked about before it is done, and done once approved', async () => {
  const app = lmsApp({ handOver: () => 'DONE' });
  const result = await runAutomation(app, config({ contract: withMode('t-submit', 'CONFIRM') }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.equal(app.handOvers.length, 1);
  assert.equal(app.handOvers[0]!.kind, 'CONFIRM_STEP');
  assert.equal(app.handOvers[0]!.transitionId, 't-submit');
  assert.match(app.handOvers[0]!.detail, /server mutation/);
  assert.deepEqual(clicks(app), ['e-create', 'e-save'], 'the run does the approved step itself');
  const asked = app.actions.findIndex((a) => a.kind === 'CLICK' && a.ref === 'e-create');
  assert.ok(asked >= 0, 'the unmarked step before it needed no one');
});

test('a CONFIRM step that is not approved is not done', async () => {
  const app = lmsApp({ handOver: () => 'CANCELLED' });
  const result = await runAutomation(app, config({ contract: withMode('t-submit', 'CONFIRM') }));
  assert.equal(result.stopReason, 'CANCELLED_BY_USER');
  assert.match(result.detail ?? '', /not approved/);
  assert.deepEqual(clicks(app), ['e-create'], 'only the step before it ran');
});

test('a step that needs a person, with nobody to ask, stops before it rather than doing it', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ contract: withMode('t-submit', 'CONFIRM') }));
  assert.equal(result.stopReason, 'MANUAL_ACTION_REQUIRED');
  assert.deepEqual(clicks(app), ['e-create']);
  assert.ok(app.events.some((e) => e.type === 'QA_AUTOMATION_ACTION_BLOCKED' && e.data.reason === 'STEP_NEEDS_PERSON'));
});

test('a MANUAL step is done by the person, and the run verifies it and carries on', async () => {
  const app = lmsApp({ handOver: (request, fake) => { assert.equal(request.kind, 'MANUAL_STEP'); fake.goto('form'); return 'DONE'; } });
  // The person opens the form themselves; the run never clicks "Create Exam".
  const result = await runAutomation(app, config({ contract: withMode('t-create', 'MANUAL') }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(clicks(app), ['e-save'], 'the run did not touch the step the person did');
  assert.deepEqual(result.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
  assert.equal(result.states[0]!.leftVia?.method, 'PERSON');
  const executed = app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_EXECUTED' && e.data.transitionId === 't-create')!;
  assert.equal(executed.data.by, 'PERSON');
  const verified = app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_VERIFIED' && e.data.transitionId === 't-create')!;
  assert.equal(verified.data.ok, true, 'what the person did is checked like anything else');
});

test('a MANUAL step needs no control and asks for no data', async () => {
  const contract = withMode('t-submit', 'MANUAL');
  const noControl: ExecutableContract = { ...contract, transitions: contract.transitions.map((t) => (t.id === 't-submit' ? { ...t, control: null } : t)) };
  const app = lmsApp({ handOver: (_request, fake) => { fake.goto('created'); return 'DONE'; }, data: {} });
  const result = await runAutomation(app, config({ contract: noControl }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(clicks(app), ['e-create']);
});

test('a person who never answers ends the run honestly, not as a fault of the application', async () => {
  const app = lmsApp({ handOver: () => 'TIMED_OUT' });
  const result = await runAutomation(app, config({ contract: withMode('t-create', 'MANUAL') }));
  assert.equal(result.stopReason, 'MANUAL_ACTION_REQUIRED');
  assert.equal(clicks(app).length, 0);
});

test('a MANUAL step the person did not really do is reported, not assumed', async () => {
  const app = lmsApp({ handOver: () => 'DONE' });
  const result = await runAutomation(app, config({ contract: withMode('t-create', 'MANUAL') }));
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
});

// ── executor: declared effects are checked, never gating ───────────────────────

const effectContract = (): ExecutableContract => {
  const contract = lmsContract();
  return {
    ...contract,
    transitions: contract.transitions.map((t) => (t.id === 't-submit'
      ? { ...t, expectedApi: [{ method: 'POST', route: '/api/exams', expectStatus: 201, declared: true }, { method: 'GET', route: '/api/derived', expectStatus: null }] }
      : t)),
  };
};
const pageWithRequests = (requests: Array<{ method: string; route: string; status: number | null; completed: boolean }>) =>
  lmsApp({
    pages: {
      details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'e-create', name: 'Create Exam' })] },
      form: {
        path: '/courses/7/exams/new', sdkState: 'exam_form',
        elements: [
          element({ ref: 'e-title', tag: 'input', role: 'textbox', label: 'Title', fieldName: 'title', name: 'Title' }),
          element({ ref: 'e-save', name: 'Save exam', testId: 'submit-exam' }),
        ],
      },
      created: { path: '/courses/7/exams/42', sdkState: 'exam_created', elements: [], requests },
    },
  });

test('a declared effect that happened is confirmed, and one that was only inferred is not checked', async () => {
  const app = pageWithRequests([{ method: 'POST', route: '/api/exams', status: 201, completed: true }]);
  const result = await runAutomation(app, config({ contract: effectContract() }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(result.effects?.map((e) => [e.method, e.route, e.outcome, e.observedStatus]), [['POST', '/api/exams', 'MATCHED', 201]]);
  const verified = app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_VERIFIED' && e.data.transitionId === 't-submit')!;
  assert.equal((verified.data.effects as unknown[]).length, 1);
});

test('a declared effect with the wrong status, or none at all, is reported without stopping the run', async () => {
  const wrong = await runAutomation(pageWithRequests([{ method: 'POST', route: '/api/exams', status: 500, completed: true }]), config({ contract: effectContract() }));
  assert.equal(wrong.stopReason, 'TERMINAL_STATE_REACHED', 'the state that followed is the verdict on the step');
  assert.deepEqual(wrong.effects?.map((e) => [e.outcome, e.observedStatus]), [['STATUS_MISMATCH', 500]]);
  const missing = await runAutomation(pageWithRequests([]), config({ contract: effectContract() }));
  assert.deepEqual(missing.effects?.map((e) => [e.outcome, e.observedStatus]), [['NOT_OBSERVED', null]]);
});

// ── data and requirements ────────────────────────────────────────────────────

const persona = (roles: string[], credentials: Array<{ field: string; value: string }> = []): TestPersona => ({
  id: 'p1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'Course admin', roles, authenticated: true, authMethod: 'PASSWORD', credentials,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

const dataContract = (extra: Partial<ExecutableContract> = {}): ExecutableContract => ({
  ...lmsContract(),
  transitions: [
    transition({ id: 't-login', from: 'a', to: 'b', control: control({ labels: ['Sign in'] }), inputs: [
      { name: 'email', label: null, dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' },
      { name: 'password', label: null, dataKey: 'ADMIN_PASSWORD', role: 'PROTECTED' },
    ] }),
    transition({ id: 't-course', from: 'b', to: 'c', control: control({ labels: ['Create'] }), inputs: [
      { name: 'course title', label: null, dataKey: 'COURSE_TITLE', role: 'GENERATED' },
      { name: 'course code', label: null, dataKey: 'COURSE_CODE', role: 'GENERATED' },
      { name: 'budget', label: null, dataKey: 'BUDGET', role: 'PROVIDED' },
    ] }),
  ],
  ...extra,
});

test('generated values are made for the run, protected ones come from the persona, provided ones must be supplied', () => {
  const resolved = resolveRunData(dataContract(), new Map(), persona(['ADMIN'], [{ field: 'email', value: 'admin@school.test' }, { field: 'password', value: 'hunter2!' }]), { unique: () => 'ab12cd' });
  assert.equal(resolved.port('COURSE_TITLE')?.value, 'QA course title ab12cd');
  assert.equal(resolved.port('COURSE_CODE')?.value, 'QAAB12CD');
  assert.equal(resolved.port('ADMIN_EMAIL')?.value, 'admin@school.test');
  assert.equal(resolved.port('ADMIN_PASSWORD')?.secret, true);
  assert.deepEqual(resolved.missing, ['BUDGET'], 'only what nothing can supply is missing');
  assert.deepEqual(resolved.protectedValues.sort(), ['admin@school.test', 'hunter2!'], 'every value a protected input types is registered so it is never recorded');
});

test('a value from the run data always wins over a generated or stored one', () => {
  const data = materializeRunData({
    id: 'd1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'set', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    values: [{ key: 'COURSE_TITLE', secret: false, generator: { kind: 'LITERAL', value: 'Chosen title' } }, { key: 'ADMIN_PASSWORD', secret: true, generator: { kind: 'LITERAL', value: 'from-data' } }],
  } as any);
  const resolved = resolveRunData(dataContract(), data, persona(['ADMIN'], [{ field: 'password', value: 'from-persona' }, { field: 'email', value: 'a@b.test' }]));
  assert.equal(resolved.port('COURSE_TITLE')?.value, 'Chosen title');
  assert.equal(resolved.port('ADMIN_PASSWORD')?.value, 'from-data');
});

test('a credential nobody holds is missing, never invented', () => {
  const resolved = resolveRunData(dataContract(), new Map(), persona(['ADMIN']));
  assert.deepEqual(resolved.missing.sort(), ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'BUDGET']);
  assert.equal(resolved.port('ADMIN_PASSWORD'), undefined);
});

test('the inputs of a step a person performs ask for nothing', () => {
  const contract = dataContract();
  const manual = { ...contract, transitions: contract.transitions.map((t) => (t.id === 't-login' ? { ...t, mode: 'MANUAL' as const } : t)) };
  assert.deepEqual(resolveRunData(manual, new Map(), persona(['ADMIN'])).missing, ['BUDGET']);
});

test('requirements are checked together, before anything is touched', () => {
  const contract = dataContract({ requires: { actor: 'ADMIN', environments: ['DEVELOPMENT'], data: ['SEED_TOKEN'] } });
  const ok = checkFlowRequirements(contract, { environment: 'DEVELOPMENT', persona: persona(['admin'], [{ field: 'email', value: 'a' }, { field: 'password', value: 'b' }]), materialized: new Map([['SEED_TOKEN', { value: 'x', secret: true }]]) });
  assert.deepEqual(ok, { ok: true });

  const bad = checkFlowRequirements(contract, { environment: 'STAGING', persona: persona(['STUDENT']), materialized: new Map() });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.stopReason, 'FLOW_REQUIREMENTS_NOT_MET');
    assert.equal(bad.problems.length, 3, 'every shortfall at once, so nobody fixes them one run at a time');
    assert.match(bad.problems[0]!, /development, and this run is in staging/);
    assert.match(bad.problems[1]!, /ADMIN.*"Course admin" does not have that role/);
    assert.match(bad.problems[2]!, /SEED_TOKEN/);
  }
  const noPersona = checkFlowRequirements(contract, { environment: 'DEVELOPMENT', persona: null, materialized: new Map() });
  assert.equal(noPersona.ok, false);
});

test('a Flow that declares nothing requires nothing', () => {
  assert.deepEqual(checkFlowRequirements(lmsContract(), { environment: 'STAGING', persona: null, materialized: new Map() }), { ok: true });
});
