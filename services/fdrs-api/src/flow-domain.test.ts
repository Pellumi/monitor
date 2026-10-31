import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createConnectivityRepairTransitions,
  createFlowDiagrams,
  createInitialStateRepair,
  reduceSuggestionPatchAgainstGraph,
  templateSeedStates,
  validateFlow,
  type FlowEdgeInput,
  type FlowNodeInput,
} from './flow-domain';
import { getDomainTemplate, type DomainTemplate } from '@tellann/rules';

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
  assert.deepEqual(diagrams.map((item) => item.kind), ['FLOW', 'SEQUENCE', 'USE_CASE', 'ACTIVITY', 'STATE_MACHINE']);
  for (const diagram of diagrams) {
    assert.equal(diagram.semanticNodeIds.length, authFlow.states.length);
    assert.equal(diagram.semanticEdgeIds.length, authFlow.transitions.length);
  }
  assert.match(diagrams[0].source, /Guest/);
  assert.match(diagrams[0].source, /Authenticated User/);
  const useCase = diagrams.find((diagram) => diagram.kind === 'USE_CASE');
  assert.match(useCase?.source ?? '', /Guest/);
  assert.match(useCase?.source ?? '', /Click login/);
  assert.match(useCase?.source ?? '', /subgraph application/);
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

test('keeps only the novel part of a partially stale suggestion patch', () => {
  const patch = reduceSuggestionPatchAgainstGraph(
    {
      states: [{ name: 'SUBSCRIPTION_CHECK_PAGE', category: 'BUSINESS', role: 'NORMAL' }],
      transitions: [
        { from: 'PLAN_GENERATION_LOADING_PAGE', to: 'SUBSCRIPTION_CHECK_PAGE', action: 'CHECK_SUBSCRIPTION' },
        { from: 'SUBSCRIPTION_CHECK_PAGE', to: 'FINAL_PLAN_GENERATION_PROCESSING', action: 'PROCEED_GENERATION' },
      ],
    },
    [
      { name: 'PLAN_GENERATION_LOADING_PAGE', category: 'UI' },
      { name: 'SUBSCRIPTION_CHECK_PAGE', category: 'BUSINESS' },
      { name: 'FINAL_PLAN_GENERATION_PROCESSING', category: 'SYSTEM' },
    ],
    [{ from: 'PLAN_GENERATION_LOADING_PAGE', to: 'SUBSCRIPTION_CHECK_PAGE', action: 'CHECK_SUBSCRIPTION' }],
  );

  assert.deepEqual(patch.states, []);
  assert.deepEqual(patch.transitions, [
    { from: 'SUBSCRIPTION_CHECK_PAGE', to: 'FINAL_PLAN_GENERATION_PROCESSING', action: 'PROCEED_GENERATION' },
  ]);
});

test('does not hide a genuinely missing suggestion endpoint', () => {
  const patch = reduceSuggestionPatchAgainstGraph(
    {
      states: [],
      transitions: [{ from: 'KNOWN', to: 'MISSING', action: 'CONTINUE' }],
    },
    [{ name: 'KNOWN', category: 'UI' }],
    [],
  );
  assert.deepEqual(patch.transitions, [{ from: 'KNOWN', to: 'MISSING', action: 'CONTINUE' }]);
});

test('proposes one stable initial entry state and makes a zero-initial graph repairable', () => {
  const states: FlowNodeInput[] = [
    { id: 'upload', stateName: 'UPLOAD_STUDY_MATERIALS_PAGE', role: 'NORMAL' },
    { id: 'date', stateName: 'DATE_TIME_PAGE', role: 'NORMAL' },
    { id: 'done', stateName: 'GENERATED_PLAN_VIEW', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ];
  const edges: FlowEdgeInput[] = [
    { id: 'upload-date', fromNodeId: 'upload', toNodeId: 'date', action: 'CLICK_NEXT' },
  ];
  const repair = createInitialStateRepair('First-Time Exam Prep Plan Setup', states, edges);
  assert.ok(repair);
  assert.equal(repair.state.stateName, 'FIRST_TIME_EXAM_PREP_PLAN_SETUP_START');
  assert.equal(repair.state.role, 'INITIAL');
  assert.equal(repair.state.category, 'SYSTEM');
  assert.equal(repair.transition.toNodeId, 'upload');

  const prospectiveStates = [repair.state, ...states];
  const prospectiveEdges = [repair.transition, ...edges];
  const connectivity = createConnectivityRepairTransitions(prospectiveStates, prospectiveEdges);
  const byName = new Map(prospectiveStates.map((state) => [state.stateName, state.id]));
  const completeEdges = [
    ...prospectiveEdges,
    ...connectivity.map((edge, index) => ({
      id: `connect-${index}`,
      fromNodeId: byName.get(edge.from)!,
      toNodeId: byName.get(edge.to)!,
      action: edge.action,
    })),
  ];
  assert.equal(validateFlow(prospectiveStates, completeEdges).valid, true);
  assert.equal(createInitialStateRepair('First-Time Exam Prep Plan Setup', prospectiveStates, completeEdges), null);
});

test('chooses the root that reaches the largest existing branch regardless of row order', () => {
  const states: FlowNodeInput[] = [
    { id: 'secondary', stateName: 'SECONDARY_ROOT', role: 'NORMAL' },
    { id: 'primary', stateName: 'PRIMARY_ROOT', role: 'NORMAL' },
    { id: 'middle', stateName: 'PRIMARY_MIDDLE', role: 'NORMAL' },
    { id: 'done', stateName: 'DONE', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ];
  const edges: FlowEdgeInput[] = [
    { id: 'primary-middle', fromNodeId: 'primary', toNodeId: 'middle' },
    { id: 'middle-done', fromNodeId: 'middle', toNodeId: 'done' },
  ];

  const repair = createInitialStateRepair('Ranked roots', states, edges);
  assert.ok(repair);
  assert.equal(repair.transition.toNodeId, 'primary');
});

// Mirrors what POST /v1/applications/:appId/flows writes when a starting-point
// template is chosen: seed states become nodes, template transitions become
// edges between them. If this graph does not validate, the desktop template
// opens a flow the author cannot publish.
function seedGraph(template: DomainTemplate) {
  const states = templateSeedStates(template);
  const nodes: FlowNodeInput[] = states.map((state) => ({
    id: `node-${state.name}`,
    stateName: state.name,
    behaviorKey: state.name,
    role: state.role,
    terminalKind: state.terminalKind,
  }));
  const byName = new Map(nodes.map((node) => [node.stateName, node]));
  const edges: FlowEdgeInput[] = template.transitions.flatMap((transition, index) => {
    const from = byName.get(transition.from.toUpperCase().trim());
    const to = byName.get(transition.to.toUpperCase().trim());
    if (!from || !to) return [];
    return [{ id: `edge-${index}`, fromNodeId: from.id, toNodeId: to.id, action: transition.action ?? null }];
  });
  return { nodes, edges };
}

test('the desktop starting-point templates seed a publishable graph', () => {
  for (const key of ['ECOMMERCE', 'LMS']) {
    const template = getDomainTemplate(key);
    const { nodes, edges } = seedGraph(template);

    assert.ok(nodes.length > 0, `${key} should seed states`);
    assert.equal(edges.length, template.transitions.length, `${key} should seed every transition`);

    const validation = validateFlow(nodes, edges);
    assert.equal(
      validation.valid,
      true,
      `${key} seeded graph should be publishable, got: ${validation.issues.map((issue) => issue.code).join(', ')}`,
    );
    // The diagram projections are what the editor and the PDF report render.
    const diagrams = createFlowDiagrams(nodes, edges);
    for (const diagram of diagrams) {
      assert.equal(diagram.semanticNodeIds.length, nodes.length);
      assert.equal(diagram.semanticEdgeIds.length, edges.length);
    }
  }
});

test('an unannotated template still gets an entry and an exit', () => {
  const bare: DomainTemplate = {
    id: 'BARE', name: 'Bare', description: '', workflowType: 'CUSTOM',
    states: [
      { name: 'START', category: 'NAVIGATION' },
      { name: 'MIDDLE', category: 'BUSINESS' },
      { name: 'DONE', category: 'BUSINESS' },
    ],
    transitions: [
      { from: 'START', to: 'MIDDLE', action: 'GO' },
      { from: 'MIDDLE', to: 'DONE', action: 'FINISH' },
    ],
    edgeCases: [],
  };
  const seeded = templateSeedStates(bare);
  assert.equal(seeded[0].role, 'INITIAL');
  assert.equal(seeded[2].role, 'TERMINAL');
  assert.equal(seeded[2].terminalKind, 'SUCCESS');
  assert.equal(validateFlow(seedGraph(bare).nodes, seedGraph(bare).edges).valid, true);
});
