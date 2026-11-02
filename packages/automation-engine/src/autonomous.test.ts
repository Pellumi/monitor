import assert from 'node:assert/strict';
import test from 'node:test';
import { runAutonomousExploration } from './autonomous';
import type { AutonomousConfig, AutonomousEvent, AutonomousModelPort, AutonomousPlan, AutonomousPorts, AutonomousQuestionAnswer, AutonomousQuestionPort } from './autonomous';
import { control, element, ORIGIN, FakeApp, lmsApp, lmsContract, state, transition } from './test-fixtures';
import type { ExecutableContract } from './types';

const scopeApproval = { approvedAt: '2026-01-01T00:00:00.000Z', approvedByUserId: 'user-1', planVersion: 1 };

const autonomousLimits = (over: Partial<{ maxActions: number; maxModelCalls: number; maxDurationMs: number }> = {}) => ({
  maxActions: 20, maxModelCalls: 10, maxDurationMs: 60_000, ...over,
});

const refusingModel: AutonomousModelPort = {
  decide: async () => { throw new Error('the model should not have been asked: every target was contract-declared'); },
  explainFailure: async () => { throw new Error('not expected'); },
};

function ports(app: FakeApp, model: AutonomousModelPort, question?: AutonomousQuestionPort): { ports: AutonomousPorts; events: AutonomousEvent[] } {
  const events: AutonomousEvent[] = [];
  return {
    events,
    ports: {
      snapshot: () => app.snapshot(),
      act: (action) => app.act(action),
      settle: () => app.settle(),
      emit: (event) => events.push(event),
      now: () => app.now(),
      cancelled: () => app.cancelled(),
      data: app.data,
      model,
      question,
    },
  };
}

const config = (overrides: Partial<AutonomousConfig> = {}): AutonomousConfig => ({
  contract: lmsContract(),
  plan: { goal: 'Create an exam', scenarios: [{ key: 's-create-exam', title: 'Create an exam', targetStateKeys: ['exam_created'], successCriteria: ['Reaches exam_created'], exploratory: false }] },
  environment: 'STAGING',
  applicationOrigin: ORIGIN,
  limits: autonomousLimits(),
  scopeApproval,
  ...overrides,
});

test('an approved scope walks declared targets via the deterministic step machinery, never asking the model', async () => {
  const app = lmsApp();
  const { ports: p } = ports(app, refusingModel);
  const result = await runAutonomousExploration(p, config({ limits: autonomousLimits() }));
  assert.equal(result.stopReason, 'COMPLETED');
  assert.equal(result.scenarios[0]!.status, 'PASS');
  assert.equal(result.steps, 2);
  assert.deepEqual(app.actions.filter((a) => a.kind === 'CLICK').map((a) => (a as { ref: string }).ref), ['e-create', 'e-save']);
});

test('without an approved scope, a state-changing action is blocked and nothing is clicked', async () => {
  const app = lmsApp();
  const { ports: p } = ports(app, refusingModel);
  const result = await runAutonomousExploration(p, config({ limits: autonomousLimits(), scopeApproval: null }));
  assert.equal(result.scenarios[0]!.status, 'BLOCKED');
  assert.match(result.scenarios[0]!.detail ?? '', /scope has not been approved/);
  assert.equal(app.actions.length, 0);
});

function destructiveSetup() {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'details',
    states: [state({ key: 'details', role: 'INITIAL' }), state({ key: 'deleted', role: 'TERMINAL', terminalKind: 'SUCCESS' })],
    transitions: [transition({
      id: 't-delete', from: 'details', to: 'deleted', action: 'Delete course',
      control: control({ labels: ['Delete course'], element: 'button' }), actionClass: 'DESTRUCTIVE',
    })],
  };
  const app = new FakeApp({
    start: 'details',
    pages: {
      details: { path: '/d', sdkState: 'details', elements: [element({ ref: 'del', name: 'Delete course', role: 'button' })] },
      deleted: { path: '/deleted', sdkState: 'deleted', elements: [] },
    },
    clicks: { del: 'deleted' },
  });
  const plan: AutonomousPlan = { goal: 'Delete the course', scenarios: [{ key: 's-delete', title: 'Delete the course', targetStateKeys: ['deleted'], successCriteria: [], exploratory: false }] };
  return { contract, app, plan };
}

test('a high-impact action pauses for approval and proceeds once it is given', async () => {
  const { contract, app, plan } = destructiveSetup();
  const question: AutonomousQuestionPort = { ask: async (): Promise<AutonomousQuestionAnswer> => ({ response: 'Approve' }) };
  const { ports: p } = ports(app, refusingModel, question);
  const result = await runAutonomousExploration(p, config({ contract, plan, scopeApproval: null, limits: autonomousLimits() }));
  assert.equal(result.scenarios[0]!.status, 'PASS');
  assert.deepEqual(app.actions, [{ kind: 'CLICK', ref: 'del' }]);
});

test('a high-impact action stays blocked when nobody can be asked, and nothing is clicked', async () => {
  const { contract, app, plan } = destructiveSetup();
  const { ports: p } = ports(app, refusingModel);
  const result = await runAutonomousExploration(p, config({ contract, plan, scopeApproval, limits: autonomousLimits() }));
  assert.equal(result.scenarios[0]!.status, 'BLOCKED');
  assert.equal(app.actions.length, 0);
});

test('a high-impact action stays blocked when the approval is declined', async () => {
  const { contract, app, plan } = destructiveSetup();
  const question: AutonomousQuestionPort = { ask: async (): Promise<AutonomousQuestionAnswer> => ({ response: 'Decline' }) };
  const { ports: p } = ports(app, refusingModel, question);
  const result = await runAutonomousExploration(p, config({ contract, plan, scopeApproval, limits: autonomousLimits() }));
  assert.equal(result.scenarios[0]!.status, 'BLOCKED');
  assert.equal(app.actions.length, 0);
});

function undeclaredScreenSetup() {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'target',
    states: [state({ key: 'target', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/target'] })],
    transitions: [],
  };
  const app = new FakeApp({
    start: 'mystery',
    pages: {
      mystery: { path: '/mystery', elements: [element({ ref: 'go', name: 'Continue', role: 'button' })] },
      target: { path: '/target', elements: [] },
    },
    clicks: { go: 'target' },
  });
  const plan: AutonomousPlan = { goal: 'Reach the target screen', scenarios: [{ key: 's-target', title: 'Reach the target', targetStateKeys: ['target'], successCriteria: [], exploratory: true }] };
  return { contract, app, plan };
}

test('a screen the Flow never declared falls back to a model proposal, verified against the live page', async () => {
  const { contract, app, plan } = undeclaredScreenSetup();
  let decideCalls = 0;
  const model: AutonomousModelPort = {
    decide: async (input) => {
      decideCalls += 1;
      assert.deepEqual(input.candidates.map((c) => c.ref), ['go']);
      return { proposal: { action: 'CLICK', targetRef: 'go', value: null, rationale: 'Continues toward the target.' } };
    },
    explainFailure: async () => { throw new Error('not expected'); },
  };
  const { ports: p } = ports(app, model);
  const result = await runAutonomousExploration(p, config({ contract, plan, limits: autonomousLimits() }));
  assert.equal(decideCalls, 1);
  assert.equal(result.scenarios[0]!.status, 'PASS');
  assert.deepEqual(app.actions, [{ kind: 'CLICK', ref: 'go' }]);
});

test('a proposal that names an element never offered on the page is rejected, not acted on', async () => {
  const { contract, app, plan } = undeclaredScreenSetup();
  const model: AutonomousModelPort = {
    decide: async () => ({ proposal: { action: 'CLICK', targetRef: 'nonexistent-ref', value: null, rationale: 'x' } }),
    explainFailure: async () => { throw new Error('not expected'); },
  };
  const { ports: p } = ports(app, model);
  const result = await runAutonomousExploration(p, config({ contract, plan, limits: autonomousLimits() }));
  assert.equal(result.scenarios[0]!.status, 'INCONCLUSIVE');
  assert.match(result.scenarios[0]!.detail ?? '', /cannot invent an element/);
  assert.equal(app.actions.length, 0);
});

test('an exhausted action budget stops the run and marks every remaining scenario NOT_RUN', async () => {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'a',
    states: [state({ key: 'a', role: 'INITIAL' }), state({ key: 'b', role: 'TERMINAL', terminalKind: 'SUCCESS' })],
    transitions: [transition({ id: 't', from: 'a', to: 'b', action: 'Go', control: control({ labels: ['Go'] }) })],
  };
  const app = new FakeApp({
    start: 'a',
    pages: { a: { path: '/a', sdkState: 'a', elements: [element({ ref: 'go', name: 'Go', role: 'button' })] }, b: { path: '/b', sdkState: 'b', elements: [] } },
    clicks: { go: 'b' },
  });
  const plan: AutonomousPlan = {
    goal: 'g',
    scenarios: [
      { key: 's1', title: 'First', targetStateKeys: ['b'], successCriteria: [], exploratory: false },
      { key: 's2', title: 'Second', targetStateKeys: ['b'], successCriteria: [], exploratory: false },
    ],
  };
  const { ports: p } = ports(app, refusingModel);
  const result = await runAutonomousExploration(p, config({ contract, plan, limits: autonomousLimits({ maxActions: 1 }) }));
  assert.equal(result.stopReason, 'BUDGET_EXCEEDED');
  assert.equal(result.scenarios[0]!.status, 'PASS');
  assert.equal(result.scenarios[1]!.status, 'NOT_RUN');
});

test('a declared effect that happened with a different status than expected fails the scenario, even though it reached its target', async () => {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'form',
    states: [state({ key: 'form', role: 'INITIAL' }), state({ key: 'done', role: 'TERMINAL', terminalKind: 'SUCCESS' })],
    transitions: [transition({
      id: 't-submit', from: 'form', to: 'done', action: 'Submit',
      control: control({ labels: ['Submit'] }), actionClass: 'SERVER_MUTATION',
      expectedApi: [{ method: 'POST', route: '/api/thing', expectStatus: 200, declared: true }],
    })],
  };
  const app = new FakeApp({
    start: 'form',
    pages: {
      form: { path: '/form', sdkState: 'form', elements: [element({ ref: 'submit', name: 'Submit', role: 'button' })] },
      done: { path: '/done', sdkState: 'done', elements: [], requests: [{ method: 'POST', route: '/api/thing', status: 500, completed: true }] },
    },
    clicks: { submit: 'done' },
  });
  const plan: AutonomousPlan = { goal: 'g', scenarios: [{ key: 's1', title: 'Submit', targetStateKeys: ['done'], successCriteria: [], exploratory: false }] };
  const { ports: p } = ports(app, refusingModel);
  const result = await runAutonomousExploration(p, config({ contract, plan, limits: autonomousLimits() }));
  assert.equal(result.scenarios[0]!.status, 'FAIL');
  assert.match(result.scenarios[0]!.detail ?? '', /different outcome than expected/);
});
