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
  const roadmap = buildManualRoadmap(manifest);
  assert.ok(roadmap.groups.some((group) => group.id === 'terminal:receipt'));
  assert.equal(roadmap.steps.at(-1)?.id, 'verify:walkthrough');
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
