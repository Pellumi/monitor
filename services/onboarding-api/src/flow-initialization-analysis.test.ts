import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeFlowInitialization, buildManualRoadmap, calculateCheckpointCoverage } from './flow-initialization-analysis';
import { enrichFlowCodeReview } from './flow-review-enrichment';

const repository = {
  id: '00000000-0000-4000-8000-000000000010',
  routeSummary: [{ path: '/checkout', file: 'src/checkout.ts', symbol: 'startCheckout' }, { path: '/receipt', file: 'src/receipt.ts', symbol: 'showReceipt' }],
  endpointSummary: [{ path: '/payments', file: 'src/payments.ts', symbol: 'createPayment' }],
  frameworkSummary: [],
};

test('compiles branching initial-to-terminal paths and flags unreachable states', () => {
  const snapshot = {
    states: [
      { id: 'checkout', stateName: 'Checkout', role: 'INITIAL' },
      { id: 'payment', stateName: 'Payment', role: 'NORMAL' },
      { id: 'receipt', stateName: 'Receipt', role: 'TERMINAL', terminalKind: 'SUCCESS' },
      { id: 'cancelled', stateName: 'Cancelled', role: 'TERMINAL', terminalKind: 'CANCELLED' },
      { id: 'orphan', stateName: 'Orphan', role: 'NORMAL' },
    ],
    transitions: [
      { id: 'begin', fromStateId: 'checkout', toStateId: 'payment', action: 'create payment' },
      { id: 'success', fromStateId: 'payment', toStateId: 'receipt', action: 'show receipt' },
      { id: 'cancel', fromStateId: 'payment', toStateId: 'cancelled', action: 'cancel' },
    ],
  };
  const { manifest, report } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000011');
  assert.deepEqual(manifest.paths, [['checkout', 'payment', 'receipt'], ['checkout', 'payment', 'cancelled']]);
  assert.deepEqual(manifest.unreachableStateIds, ['orphan']);
  assert.ok(manifest.checkpoints.some((item) => item.id === 'state:checkout' && item.eventType === 'FLOW_INITIAL_STATE'));
  assert.ok(manifest.checkpoints.some((item) => item.id === 'state:cancelled' && item.eventType === 'FLOW_TERMINAL_STATE'));
  assert.ok(report.edgeCases.some((item) => item.code === 'UNREACHABLE_STATE'));
  const roadmap = buildManualRoadmap(manifest, 1, report);
  assert.ok(roadmap.groups.some((group) => group.id === 'terminal:receipt'));
  assert.ok(roadmap.groups.some((group) => group.title === 'Path to "Receipt"'), 'terminal groups use the declared state name');
  assert.equal(roadmap.steps.at(-1)?.id, 'verify:walkthrough');
  assert.ok(roadmap.steps.some((step) => step.title === 'Record when the flow starts at "Checkout"'), 'initial state step reads in plain language');
  assert.ok(roadmap.steps.some((step) => step.title === 'Record the "create payment" transition'), 'transition step uses the declared action name');
  assert.ok(roadmap.steps.every((step) => step.status !== 'BLOCKED'), 'no step is locked purely because Tellann could not map it');
  const startedAt = new Date().toISOString();
  const incomplete = calculateCheckpointCoverage(manifest, [
    { checkpointId: 'state:checkout', timestamp: startedAt },
    { checkpointId: 'state:receipt', timestamp: startedAt },
  ], startedAt);
  assert.equal(incomplete.status, 'RECORDING', 'endpoint-only telemetry cannot activate a Flow');
  const complete = calculateCheckpointCoverage(manifest, [
    { checkpointId: 'state:checkout', timestamp: startedAt },
    { checkpointId: 'transition:begin', timestamp: startedAt },
    { checkpointId: 'state:payment', timestamp: startedAt },
    { checkpointId: 'transition:success', timestamp: startedAt },
    { checkpointId: 'state:receipt', timestamp: startedAt },
  ], startedAt);
  assert.equal(complete.status, 'COMPLETED');
  assert.deepEqual(complete.verifiedPath, ['state:checkout', 'transition:begin', 'state:payment', 'transition:success', 'state:receipt']);
});

test('resolves transition endpoints from fromNodeId/toNodeId snapshots, not just fromStateId/toStateId', () => {
  const snapshot = {
    states: [
      { id: 'start', stateName: 'Start', role: 'INITIAL' },
      { id: 'done', stateName: 'Done', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [
      { id: 'go', fromNodeId: 'start', toNodeId: 'done', action: 'go' },
    ],
  };
  const { manifest, report } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000012');
  assert.deepEqual(manifest.paths, [['start', 'done']], 'traversal must follow the fromNodeId/toNodeId edge');
  const transitionCheckpoint = manifest.checkpoints.find((item) => item.kind === 'TRANSITION');
  assert.equal(transitionCheckpoint?.fromCheckpointId, 'state:start');
  assert.equal(transitionCheckpoint?.toCheckpointId, 'state:done');
  const [finding] = report.transitionFindings;
  assert.equal(finding.fromStateId, 'start');
  assert.equal(finding.toStateId, 'done');
});

test('transition recommendations show declared state names, not raw state ids', () => {
  const snapshot = {
    states: [
      { id: '75176a5a-485e-4e36-95cf-a5119cbb6f04', stateName: 'Idle', role: 'INITIAL' },
      { id: '88b51c05-b525-431c-9cb4-0110cdf978e5', stateName: 'Code submitted', role: 'NORMAL' },
      { id: '796f32d8-c9e6-4dbe-aff2-ed25a1830097', stateName: 'Verified', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [
      // No `action`/`event` name, and endpoints are raw ids — this is the shape that
      // previously rendered as "796f32d8-...-ed25a1830097 → 43b3487d-..." to the user.
      { id: 'step-1', fromNodeId: '75176a5a-485e-4e36-95cf-a5119cbb6f04', toNodeId: '88b51c05-b525-431c-9cb4-0110cdf978e5' },
      { id: 'step-2', fromNodeId: '88b51c05-b525-431c-9cb4-0110cdf978e5', toNodeId: '796f32d8-c9e6-4dbe-aff2-ed25a1830097', action: 'SUBMIT_INVITE_CODE' },
    ],
  };
  const { report } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000013');
  const unnamed = report.recommendations.find((item: any) => item.checkpointId === 'transition:step-1');
  assert.equal(unnamed?.label, 'Idle → Code submitted', 'falls back to state names, not raw ids, when the transition has no action');
  assert.equal(unnamed?.detail, 'The transition from "Idle" to "Code submitted" has no confident repository match.');
  const named = report.recommendations.find((item: any) => item.checkpointId === 'transition:step-2');
  assert.equal(named?.label, 'SUBMIT_INVITE_CODE', 'uses the declared action name when present');
  assert.equal(named?.detail, 'The transition from "Code submitted" to "Verified" has no confident repository match.');
});

test('rejects graphs without a valid initial and terminal boundary', () => {
  assert.throws(() => analyzeFlowInitialization({ states: [{ id: 'only', role: 'NORMAL' }], transitions: [] }, repository, '00000000-0000-4000-8000-000000000011'), /VALID_INITIAL_AND_TERMINAL_STATES_REQUIRED/);
});

test('AI enrichment preserves the deterministic report when no configured provider is available', async () => {
  const report = { engine: 'RULES_FALLBACK', summary: {}, missingStates: [], incompleteTransitions: [], edgeCases: [], uncoveredTerminalOutcomes: [], recommendations: [], evidence: [{ file: 'src/a.ts' }] };
  const result = await enrichFlowCodeReview(report);
  assert.equal(result.provenance.engine, 'RULES_FALLBACK');
  assert.ok('evidence' in result.report);
  assert.deepEqual(result.report.evidence, report.evidence);
});
