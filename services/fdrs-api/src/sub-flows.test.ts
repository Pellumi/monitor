import assert from 'node:assert/strict';
import test from 'node:test';
import { expandSubFlows, type GraphEdgeRow, type GraphNodeRow, type SubFlowSource } from './sub-flows';
import { validateFlow } from './flow-domain';

const node = (id: string, stateName: string, role: string, extra: Partial<GraphNodeRow> = {}): GraphNodeRow => ({ id, stateName, role, ...extra });
const edge = (id: string, fromNodeId: string, toNodeId: string, action: string, extra: Partial<GraphEdgeRow> = {}): GraphEdgeRow => ({ id, fromNodeId, toNodeId, action, ...extra });

/** GUEST -> LOGIN_PAGE -> DASHBOARD, with a failed sign-in. */
const signIn: SubFlowSource = {
  flowId: 'flow-signin', name: 'Sign in', versionId: 'v-signin-1', version: 1,
  states: [
    node('g', 'GUEST', 'INITIAL'),
    node('l', 'LOGIN_PAGE', 'NORMAL'),
    node('d', 'DASHBOARD', 'TERMINAL', { terminalKind: 'SUCCESS' }),
    node('x', 'LOGIN_FAILED', 'TERMINAL', { terminalKind: 'FAILURE' }),
  ],
  transitions: [
    edge('e1', 'g', 'l', 'OPEN_APP'),
    edge('e2', 'l', 'd', 'SUBMIT_CREDENTIALS', { condition: 'ON_SUCCESS' }),
    edge('e3', 'l', 'x', 'SUBMIT_CREDENTIALS', { condition: 'ON_FAILURE' }),
  ],
};
const sources = new Map([[signIn.flowId, signIn]]);

/** A flow that starts signed in, then creates a course. */
const createCourse = {
  id: 'flow-course',
  nodes: [
    node('call', 'SIGN_IN', 'INITIAL', { subFlowId: 'flow-signin' }),
    node('c', 'COURSES_PAGE', 'NORMAL'),
    node('m', 'CREATE_COURSE_MODAL', 'NORMAL'),
    node('ok', 'COURSE_CREATED', 'TERMINAL', { terminalKind: 'SUCCESS' }),
  ],
  edges: [
    edge('t1', 'call', 'c', 'CLICK_COURSES_LINK'),
    edge('t2', 'c', 'm', 'CLICK_CREATE_COURSE'),
    edge('t3', 'm', 'ok', 'SUBMIT_FORM'),
  ],
};

test('a reused flow is drawn once and expanded into the flow that uses it', () => {
  const graph = expandSubFlows(createCourse, sources);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(graph.states.map((state) => state.stateName).sort(), [
    'COURSES_PAGE', 'COURSE_CREATED', 'CREATE_COURSE_MODAL', 'SIGN_IN_DASHBOARD', 'SIGN_IN_GUEST', 'SIGN_IN_LOGIN_FAILED', 'SIGN_IN_LOGIN_PAGE',
  ]);
  assert.equal(graph.states.some((state) => state.id === 'call'), false, 'the call state is replaced, not kept beside its expansion');
  assert.deepEqual(graph.subFlows, [{ nodeId: 'call', stateName: 'SIGN_IN', flowId: 'flow-signin', name: 'Sign in', versionId: 'v-signin-1', version: 1 }]);
});

test('the expanded graph is a valid flow: one start, and the success ending leads on', () => {
  const graph = expandSubFlows(createCourse, sources);
  const byName = new Map(graph.states.map((state) => [state.stateName, state]));
  assert.equal(byName.get('SIGN_IN_GUEST')!.role, 'INITIAL', 'the start of the reused flow is the start here because the call state was');
  assert.equal(byName.get('SIGN_IN_DASHBOARD')!.role, 'NORMAL', 'a successful ending that something follows is no longer an ending');
  assert.equal(byName.get('SIGN_IN_LOGIN_FAILED')!.role, 'TERMINAL', 'a failed sign-in stays a dead end');
  assert.equal(byName.get('SIGN_IN_LOGIN_FAILED')!.terminalKind, 'FAILURE');
  const leaving = graph.transitions.find((transition) => transition.action === 'CLICK_COURSES_LINK')!;
  assert.equal(leaving.fromNodeId, 'call:d');
  const validation = validateFlow(graph.states as any, graph.transitions as any);
  assert.equal(validation.valid, true, JSON.stringify(validation.issues));
});

test('edges into the call state enter the reused flow at its start', () => {
  const graph = expandSubFlows({
    id: 'flow-checkout',
    nodes: [node('s', 'CART', 'INITIAL'), node('call', 'SIGN_IN', 'NORMAL', { subFlowId: 'flow-signin' }), node('p', 'PAYMENT', 'TERMINAL', { terminalKind: 'SUCCESS' })],
    edges: [edge('a', 's', 'call', 'CLICK_CHECKOUT'), edge('b', 'call', 'p', 'CONTINUE_TO_PAYMENT')],
  }, sources);
  assert.equal(graph.transitions.find((transition) => transition.id === 'a')!.toNodeId, 'call:g');
  const byName = new Map(graph.states.map((state) => [state.stateName, state]));
  assert.equal(byName.get('CART')!.role, 'INITIAL');
  assert.equal(byName.get('SIGN_IN_GUEST')!.role, 'NORMAL', 'a reused start in the middle of a flow is not a second start');
  assert.equal(validateFlow(graph.states as any, graph.transitions as any).valid, true);
});

test('a flow that ends in the reused flow keeps its endings', () => {
  const graph = expandSubFlows({ id: 'flow-only', nodes: [node('call', 'SIGN_IN', 'INITIAL', { subFlowId: 'flow-signin' })], edges: [] }, sources);
  const byName = new Map(graph.states.map((state) => [state.stateName, state]));
  assert.equal(byName.get('SIGN_IN_DASHBOARD')!.role, 'TERMINAL');
  assert.equal(byName.get('SIGN_IN_DASHBOARD')!.terminalKind, 'SUCCESS');
});

test('two successful endings each get the continuing edge', () => {
  const twoEnds: SubFlowSource = {
    ...signIn,
    states: [...signIn.states, node('r', 'REMEMBERED', 'TERMINAL', { terminalKind: 'SUCCESS' })],
    transitions: [...signIn.transitions, edge('e4', 'l', 'r', 'SUBMIT_CREDENTIALS')],
  };
  const graph = expandSubFlows(createCourse, new Map([[twoEnds.flowId, twoEnds]]));
  const leaving = graph.transitions.filter((transition) => transition.action === 'CLICK_COURSES_LINK');
  assert.deepEqual(leaving.map((transition) => transition.fromNodeId).sort(), ['call:d', 'call:r']);
  assert.equal(new Set(leaving.map((transition) => transition.id)).size, 2, 'each copy of the edge has its own id');
});

test('nothing is expanded, and the reason is given, when the reused flow is not usable', () => {
  const unpublished = expandSubFlows(createCourse, new Map());
  assert.deepEqual(unpublished.issues.map((issue) => issue.code), ['SUBFLOW_NOT_PUBLISHED']);
  assert.ok(unpublished.states.some((state) => state.id === 'call'), 'the call state is kept so the draft still draws');

  const self = expandSubFlows({ ...createCourse, id: 'flow-signin' }, sources);
  assert.deepEqual(self.issues.map((issue) => issue.code), ['SUBFLOW_SELF_REFERENCE']);

  const noEntry = expandSubFlows(createCourse, new Map([[signIn.flowId, { ...signIn, states: signIn.states.map((state) => (state.role === 'INITIAL' ? { ...state, role: 'NORMAL' } : state)) }]]));
  assert.deepEqual(noEntry.issues.map((issue) => issue.code), ['SUBFLOW_NO_ENTRY']);

  const noExit = expandSubFlows(createCourse, new Map([[signIn.flowId, { ...signIn, states: signIn.states.map((state) => (state.id === 'd' ? { ...state, terminalKind: 'FAILURE' } : state)) }]]));
  assert.deepEqual(noExit.issues.map((issue) => issue.code), ['SUBFLOW_NO_EXIT']);
});

test('a flow with no reused flows comes back untouched', () => {
  const plain = { id: 'p', nodes: [node('a', 'A', 'INITIAL'), node('b', 'B', 'TERMINAL', { terminalKind: 'SUCCESS' })], edges: [edge('e', 'a', 'b', 'GO')] };
  const graph = expandSubFlows(plain, sources);
  assert.equal(graph.states, plain.nodes);
  assert.equal(graph.transitions, plain.edges);
});
