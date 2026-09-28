import assert from 'node:assert/strict';
import test from 'node:test';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import {
  FakeApp, ORIGIN, control, element, limits, lmsApp, lmsContract, snapshot, state, transition,
} from './test-fixtures';
import type { ExecutableContract } from './types';

const config = (overrides: Partial<AutomationConfig> = {}): AutomationConfig => ({
  contract: lmsContract(),
  targetStateKey: 'exam_created',
  environment: 'STAGING',
  applicationOrigin: ORIGIN,
  limits: limits(),
  ...overrides,
});

const clicks = (app: FakeApp) => app.actions.filter((a) => a.kind === 'CLICK').map((a) => (a as { ref: string }).ref);

test('the happy path performs the declared transitions and stops at the target', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config());

  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(clicks(app), ['e-create', 'e-save']);
  // The title input is filled from the run data set, before the submit is clicked.
  assert.deepEqual(app.actions.filter((a) => a.kind === 'FILL'), [{ kind: 'FILL', ref: 'e-title', value: 'Automated QA Exam', secret: false }]);
  assert.ok(app.actions.findIndex((a) => a.kind === 'FILL') < app.actions.findIndex((a) => a.kind === 'CLICK' && a.ref === 'e-save'));
  assert.equal(result.steps, 2);
  assert.deepEqual(result.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
  assert.equal(result.states[0]!.leftVia?.transitionId, 't-create');
  assert.equal(result.states[1]!.leftVia?.actionClass, 'SERVER_MUTATION');
  assert.equal(result.states[2]!.leftVia, null, 'the terminal state is not left');
});

test('the event stream tells the story of the run in order', async () => {
  const app = lmsApp();
  await runAutomation(app, config());
  const types = app.eventTypes;
  assert.equal(types[0], 'QA_AUTOMATION_PLAN_CREATED');
  assert.equal(types[types.length - 1], 'QA_AUTOMATION_STOPPED');
  assert.equal(types.filter((t) => t === 'QA_AUTOMATION_ACTION_SELECTED').length, 2);
  assert.equal(types.filter((t) => t === 'QA_AUTOMATION_ACTION_VERIFIED').length, 2);
  assert.ok(types.includes('QA_AUTOMATION_INITIAL_STATE_REACHED'));
  assert.ok(types.includes('QA_AUTOMATION_TERMINAL_STATE_REACHED'));
  // The loop reports what it recognised; it never opens or closes the Flow boundary itself.
  assert.ok(!types.some((t) => /BOUNDARY/.test(t)));
  const selected = app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_SELECTED')!;
  assert.equal(selected.data.transitionId, 't-create');
  assert.equal(selected.data.method, 'ROLE_NAME', 'each action says why the control was chosen');
  assert.equal(selected.data.expectedState, 'exam_form');
});

test('already at the target is a run with no actions', async () => {
  const app = lmsApp({ start: 'created' });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.equal(app.actions.length, 0);
});

test('a run can start part-way through the Flow', async () => {
  const app = lmsApp({ start: 'form' });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(clicks(app), ['e-save']);
});

test('a control that is not on the page stops the run without clicking anything', async () => {
  const noButton = new FakeApp({
    start: 'details',
    pages: { details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'x', name: 'Logout' })] } },
    clicks: {},
  });
  const result = await runAutomation(noButton, config());
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.equal(noButton.actions.length, 0);
  const blocked = noButton.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_BLOCKED')!;
  assert.equal(blocked.data.reason, 'CONTROL_NOT_FOUND');
});

test('a hidden matching control is reported as such', async () => {
  const hidden = new FakeApp({
    start: 'details',
    pages: { details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'x', name: 'Create Exam', visible: false })] } },
    clicks: {},
  });
  const result = await runAutomation(hidden, config());
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.match(result.detail ?? '', /hidden or disabled/);
});

test('two equally good controls stop the run instead of picking one', async () => {
  const twin = new FakeApp({
    start: 'details',
    pages: { details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'a', name: 'Create Exam' }), element({ ref: 'b', name: 'Create Exam' })] } },
    clicks: { a: 'form', b: 'form' },
  });
  const result = await runAutomation(twin, config());
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.equal(twin.actions.length, 0);
});

test('a transition the code gave no control for is never guessed', async () => {
  const contract: ExecutableContract = { ...lmsContract(), transitions: lmsContract().transitions.map((t) => (t.id === 't-create' ? { ...t, control: null, derivation: 'UNRESOLVED' as const } : t)) };
  const app = lmsApp();
  const result = await runAutomation(app, config({ contract }));
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.equal(app.actions.length, 0);
  assert.equal(app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_BLOCKED')!.data.reason, 'NO_DERIVED_CONTROL');
});

test('a server mutation that does not advance is performed exactly once', async () => {
  // Save is clicked and the app stays on the form (say the request 500ed). It may still have happened.
  const app = lmsApp({ clicks: { 'e-create': 'form' } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
  assert.equal(clicks(app).filter((ref) => ref === 'e-save').length, 1);
});

test('a client-state action that does not advance is retried up to the limit, then reported', async () => {
  const app = lmsApp({ clicks: {} });
  const result = await runAutomation(app, config({ limits: limits({ maxActionRetries: 2 }) }));
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
  assert.equal(clicks(app).filter((ref) => ref === 'e-create').length, 3, 'the first attempt plus two retries');
});

test('landing in another declared state triggers a replan, and an unreachable target is reported', async () => {
  // Save takes the app to EXAM_ERROR; nothing leads from there to EXAM_CREATED.
  const app = lmsApp({ clicks: { 'e-create': 'form', 'e-save': 'error' } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_UNREACHABLE');
  assert.equal(result.replans, 1);
  assert.ok(app.eventTypes.includes('QA_AUTOMATION_REPLAN'));
  assert.equal(result.states[result.states.length - 1]!.stateKey, 'exam_error');
});

test('replanning takes a different declared route when the first one lands somewhere else', async () => {
  // A branch: a -> b -> z (b's control lands on c instead), and c -> z exists.
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'a',
    states: [state({ key: 'a', role: 'INITIAL', routePatterns: ['/a'] }), state({ key: 'b', routePatterns: ['/b'] }), state({ key: 'c', routePatterns: ['/c'] }), state({ key: 'z', role: 'TERMINAL', routePatterns: ['/z'] })],
    transitions: [
      transition({ id: 'ab', from: 'a', to: 'b', control: control({ labels: ['Go B'] }) }),
      transition({ id: 'bz', from: 'b', to: 'z', control: control({ labels: ['Go Z'] }) }),
      transition({ id: 'ac', from: 'a', to: 'c', control: control({ labels: ['Go C'] }), actionClass: 'CLIENT_STATE_MUTATION' }),
      transition({ id: 'cz', from: 'c', to: 'z', control: control({ labels: ['Finish'] }) }),
    ],
  };
  const app = new FakeApp({
    start: 'a',
    pages: {
      a: { path: '/a', sdkState: 'a', elements: [element({ ref: 'go-b', name: 'Go B' }), element({ ref: 'go-c', name: 'Go C' })] },
      b: { path: '/b', sdkState: 'b', elements: [element({ ref: 'go-z', name: 'Go Z' })] },
      c: { path: '/c', sdkState: 'c', elements: [element({ ref: 'finish', name: 'Finish' })] },
      z: { path: '/z', sdkState: 'z', elements: [] },
    },
    // "Go B" mistakenly sends the user to C.
    clicks: { 'go-b': 'c', 'go-c': 'c', finish: 'z' },
  });
  const result = await runAutomation(app, config({ contract, targetStateKey: 'z' }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.equal(result.replans, 1);
  assert.deepEqual(result.states.map((s) => s.stateKey), ['a', 'c', 'z']);
});

test('missing run data stops the run before the action that needs it', async () => {
  const app = lmsApp({ data: {} });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TEST_DATA_UNAVAILABLE');
  assert.match(result.detail ?? '', /examTitle/);
  assert.ok(!clicks(app).includes('e-save'));
  assert.equal(app.actions.filter((a) => a.kind === 'FILL').length, 0);
});

test('secret run data is typed but flagged so it can be kept out of evidence', async () => {
  const contract: ExecutableContract = {
    ...lmsContract(),
    transitions: lmsContract().transitions.map((t) => (t.id === 't-submit' ? { ...t, inputs: [{ name: 'title', label: 'Title', dataKey: 'password' }] } : t)),
  };
  const app = lmsApp({ data: { password: { value: 'hunter2', secret: true } } });
  await runAutomation(app, config({ contract }));
  const fill = app.actions.find((a) => a.kind === 'FILL') as { secret: boolean; value: string };
  assert.equal(fill.secret, true);
  // Nothing the loop emits contains the value.
  assert.ok(!JSON.stringify(app.events).includes('hunter2'));
});

test('a field the page does not have stops the run', async () => {
  const app = lmsApp({
    pages: {
      details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'e-create', name: 'Create Exam' })] },
      form: { path: '/courses/7/exams/new', sdkState: 'exam_form', elements: [element({ ref: 'e-save', name: 'Save exam', testId: 'submit-exam' })] },
      created: { path: '/courses/7/exams/42', sdkState: 'exam_created', elements: [] },
      error: { path: '/courses/7/exams/error', sdkState: 'exam_error', elements: [] },
    },
    clicks: { 'e-create': 'form', 'e-save': 'created' },
  });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  assert.match(result.detail ?? '', /title/);
});

test('production is refused: no action is taken', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ environment: 'PRODUCTION' }));
  assert.equal(result.stopReason, 'UNSAFE_ACTION_BLOCKED');
  assert.equal(app.actions.length, 0);
});

test('an action class the environment forbids is blocked before it is performed', async () => {
  const contract: ExecutableContract = {
    ...lmsContract(),
    transitions: lmsContract().transitions.map((t) => (t.id === 't-submit' ? { ...t, actionClass: 'EXTERNAL_SIDE_EFFECT' as const } : t)),
  };
  const app = lmsApp();
  const result = await runAutomation(app, config({ contract }));
  assert.equal(result.stopReason, 'UNSAFE_ACTION_BLOCKED');
  // The route is refused up front. Performing the safe steps and then stopping would leave the application
  // half-way through a flow the run already knows it cannot finish.
  assert.equal(app.actions.length, 0, 'nothing was performed');
  const approved = lmsApp();
  const ok = await runAutomation(approved, config({ contract, policy: { approvedClasses: ['EXTERNAL_SIDE_EFFECT'] } }));
  assert.equal(ok.stopReason, 'TERMINAL_STATE_REACHED');
});

test('a click that lands off the application origin stops the run', async () => {
  const app = lmsApp({
    pages: {
      details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'e-create', name: 'Create Exam' })] },
      form: { path: '/pay', url: 'https://checkout.stripe.com/pay/cs_1', elements: [] },
    },
    clicks: { 'e-create': 'form' },
  });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'UNSAFE_ACTION_BLOCKED');
  assert.equal(app.events.find((e) => e.type === 'QA_AUTOMATION_ACTION_BLOCKED')!.data.reason, 'EXTERNAL_ORIGIN_BLOCKED');
});

test('going in circles ends the run', async () => {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'a',
    states: [state({ key: 'a', role: 'INITIAL', routePatterns: ['/a'] }), state({ key: 'b', routePatterns: ['/b'] }), state({ key: 'z', role: 'TERMINAL', routePatterns: ['/z'] })],
    transitions: [
      transition({ id: 'ab', from: 'a', to: 'b', control: control({ labels: ['Next'] }), actionClass: 'READ' }),
      transition({ id: 'bz', from: 'b', to: 'z', control: control({ labels: ['Finish'] }), actionClass: 'READ' }),
    ],
  };
  const app = new FakeApp({
    start: 'a',
    pages: {
      a: { path: '/a', sdkState: 'a', elements: [element({ ref: 'next', name: 'Next' })] },
      b: { path: '/b', sdkState: 'b', elements: [element({ ref: 'finish', name: 'Finish' })] },
      z: { path: '/z', sdkState: 'z', elements: [] },
    },
    // The bug under test: Finish sends the user back to the start.
    clicks: { next: 'b', finish: 'a' },
  });
  const result = await runAutomation(app, config({ contract, targetStateKey: 'z', limits: limits({ maxSteps: 100, maxReplans: 100 }) }));
  assert.equal(result.stopReason, 'LOOP_DETECTED');
  assert.ok(result.steps < 20, 'it stopped early rather than burning the whole budget');
});

test('the step budget ends the run', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ limits: limits({ maxSteps: 1 }) }));
  assert.equal(result.stopReason, 'MAX_STEPS_EXCEEDED');
  assert.equal(result.steps, 1);
});

test('the duration budget ends the run', async () => {
  const app = lmsApp({ clockStepMs: 60_000 });
  const result = await runAutomation(app, config({ limits: limits({ maxDurationMs: 30_000 }) }));
  assert.equal(result.stopReason, 'MAX_DURATION_EXCEEDED');
});

test('an unrecognisable page is looked at again once, then reported rather than guessed at', async () => {
  const app = new FakeApp({ start: 'x', pages: { x: { path: '/whatever', elements: [] } }, clicks: {} });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
  assert.equal(app.actions.length, 0);
});

test('an entry route can get the run to the initial state', async () => {
  let entered = false;
  const app = new FakeApp({
    start: 'login',
    pages: {
      login: { path: '/login', elements: [] },
      details: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'e-create', name: 'Create Exam' })] },
    },
    clicks: {},
    seekInitial: async () => { entered = true; return snapshot({ path: '/courses/7', sdkStates: ['course_details'], elements: [element({ ref: 'e-create', name: 'Create Exam' })] }); },
  });
  const result = await runAutomation(app, config({ targetStateKey: 'course_details' }));
  assert.equal(entered, true);
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
});

test('an entry route that fails is an unreachable initial state', async () => {
  const app = new FakeApp({ start: 'x', pages: { x: { path: '/login', elements: [] } }, clicks: {}, seekInitial: async () => null });
  assert.equal((await runAutomation(app, config())).stopReason, 'INITIAL_STATE_UNREACHABLE');
});

test('two states that fit the page equally well are reported as ambiguous', async () => {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'a',
    states: [state({ key: 'a', role: 'INITIAL', routePatterns: ['/x/{param}'], sdkStateSignals: [] }), state({ key: 'b', role: 'TERMINAL', routePatterns: ['/x/{param}'], sdkStateSignals: [] })],
    transitions: [transition({ id: 'ab', from: 'a', to: 'b', control: control({ labels: ['Go'] }) })],
  };
  const app = new FakeApp({ start: 'x', pages: { x: { path: '/x/1', elements: [] } }, clicks: {} });
  assert.equal((await runAutomation(app, config({ contract, targetStateKey: 'b' }))).stopReason, 'STATE_RECOGNITION_AMBIGUOUS');
});

test('a crashed application or browser ends the run with the right infrastructure reason', async () => {
  for (const reason of ['APPLICATION_CRASHED', 'BROWSER_CRASHED'] as const) {
    const app = lmsApp({ health: () => reason });
    const result = await runAutomation(app, config());
    assert.equal(result.stopReason, reason);
    assert.equal(app.actions.length, 0);
  }
});

test('cancelling stops the run at the next decision', async () => {
  const app = lmsApp();
  app.cancelledFlag = true;
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'CANCELLED_BY_USER');
  assert.equal(app.actions.length, 0);
});

test('a click that throws is retried for a client-state action, then reported as an engine error', async () => {
  const app = lmsApp({ failingClicks: ['e-create'] });
  const result = await runAutomation(app, config({ limits: limits({ maxActionRetries: 1 }) }));
  assert.equal(result.stopReason, 'AUTOMATION_ENGINE_ERROR');
  assert.equal(clicks(app).filter((ref) => ref === 'e-create').length, 2);
});

test('a target that is not in the pinned Flow version is refused up front', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ targetStateKey: 'no_such_state' }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_UNREACHABLE');
  assert.equal(app.actions.length, 0);
});
