import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnectivityRepairTransitions, createFlowDiagrams, validateFlow, type FlowEdgeInput, type FlowNodeInput } from './flow-domain';

const authFlow: { states: FlowNodeInput[]; transitions: FlowEdgeInput[]; [key: string]: unknown } = {
  id: 'flow-auth',
  name: 'Authentication',
  purpose: 'Authenticate a guest',
  scopeStatement: 'Login only',
  states: [
    { id: 'guest', stateName: 'Guest', behaviorKey: 'guest', role: 'INITIAL' },
    { id: 'onboard', stateName: 'Onboard', behaviorKey: 'onboard', role: 'NORMAL' },
    { id: 'authenticated', stateName: 'Authenticated User', behaviorKey: 'authenticated_user', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ],
  transitions: [
    { id: 'open-login', fromNodeId: 'guest', toNodeId: 'onboard', action: 'Click login', actor: 'Guest', system: 'Web app' },
    { id: 'submit-login', fromNodeId: 'onboard', toNodeId: 'authenticated', action: 'Submit credentials', actor: 'Guest', system: 'Auth API' },
  ],
};

test('accepts a bounded flow and emits all synchronized projections', () => {
  assert.equal(validateFlow(authFlow.states, authFlow.transitions).valid, true);
  const diagrams = createFlowDiagrams(authFlow.states, authFlow.transitions);
  assert.deepEqual(diagrams.map((item) => item.kind), ['FLOW', 'SEQUENCE', 'ACTIVITY', 'STATE_MACHINE']);
  for (const diagram of diagrams) {
    assert.equal(diagram.semanticNodeIds.length, authFlow.states.length);
    assert.equal(diagram.semanticEdgeIds.length, authFlow.transitions.length);
  }
  assert.match(diagrams[0].source, /Guest/);
  assert.match(diagrams[0].source, /Authenticated User/);
});

test('keeps user-authored punctuation from breaking state-machine transitions', () => {
  const flow = structuredClone(authFlow);
  flow.transitions[0].action = 'User enters: email; then submits credentials';
  const stateMachine = createFlowDiagrams(flow.states, flow.transitions).find(
    (diagram) => diagram.kind === 'STATE_MACHINE',
  );

  assert.ok(stateMachine);
  const transition = stateMachine.source
    .split('\n')
    .find((line) => line.includes('User enters'));
  assert.ok(transition);
  assert.equal((transition.match(/:/g) ?? []).length, 1);
  assert.doesNotMatch(transition, /;/);
  assert.match(transition, /User enters - email - then submits credentials/);
});

test('rejects ambiguous boundaries and unreachable states', () => {
  const invalid = structuredClone(authFlow);
  invalid.states.push({ id: 'second-initial', stateName: 'Visitor', behaviorKey: 'visitor', role: 'INITIAL' });
  invalid.states.push({ id: 'orphan', stateName: 'Orphan', behaviorKey: 'orphan', role: 'NORMAL' });
  const result = validateFlow(invalid.states, invalid.transitions);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((item) => item.code === 'FLOW_INITIAL_STATE_COUNT'));
  const unreachable = structuredClone(authFlow);
  unreachable.states.push({ id: 'orphan', stateName: 'Orphan', behaviorKey: 'orphan', role: 'NORMAL' });
  assert.ok(validateFlow(unreachable.states, unreachable.transitions).issues.some((item) => item.code === 'FLOW_UNREACHABLE_STATE'));
});

test('creates a transition repair that makes every existing state reachable', () => {
  const states: FlowNodeInput[] = [
    { id: 'start', stateName: 'START', role: 'INITIAL' },
    { id: 'details', stateName: 'DETAILS', role: 'NORMAL' },
    { id: 'payment', stateName: 'PAYMENT', role: 'NORMAL' },
    { id: 'done', stateName: 'DONE', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ];
  const transitions: FlowEdgeInput[] = [{ id: 'one', fromNodeId: 'start', toNodeId: 'details' }];
  const repairs = createConnectivityRepairTransitions(states, transitions);
  const repaired = [...transitions, ...repairs.map((edge, index) => ({ id: `repair-${index}`, fromNodeId: states.find((node) => node.stateName === edge.from)!.id, toNodeId: states.find((node) => node.stateName === edge.to)!.id }))];
  assert.equal(validateFlow(states, repaired).valid, true);
  assert.deepEqual(repairs.map((edge) => [edge.from, edge.to]), [['DETAILS', 'PAYMENT'], ['PAYMENT', 'DONE']]);
});
