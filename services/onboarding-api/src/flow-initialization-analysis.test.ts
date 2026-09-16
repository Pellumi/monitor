import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeFlowInitialization, applyEvidenceGroundedMappings, assertEvidenceGroundedContract, buildManualRoadmap, calculateCheckpointCoverage, evaluateCodeScanCoverage } from './flow-initialization-analysis';
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

test('evidence-grounded mappings replace fallback locations for every checkpoint', () => {
  const snapshot = {
    states: [
      { id: 'guest', stateName: 'Guest', role: 'INITIAL' },
      { id: 'login', stateName: 'Login page', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ id: 'navigate', fromStateId: 'guest', toStateId: 'login', action: 'Auto navigate to login' }],
  };
  const base = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000017', undefined, 'Authentication');
  const mappings = base.manifest.checkpoints.map((checkpoint, index) => ({
    checkpointId: checkpoint.id,
    status: 'RESOLVED' as const,
    entityId: `entity-${index}`,
    candidateId: `candidate-${index}`,
    file: index === 0 ? 'src/auth/GuestGate.tsx' : index === 1 ? 'src/auth/LoginPage.tsx' : 'src/auth/GuestGate.tsx',
    symbol: index === 0 ? 'GuestGate' : index === 1 ? 'LoginPage' : 'redirectToLogin',
    startLine: 10 + index,
    endLine: 20 + index,
    placementKind: 'FUNCTION_ENTRY',
    anchorText: index === 1 ? 'LoginPage' : 'GuestGate',
    anchorHash: `hash-${index}`,
    confidence: 0.91,
    rationale: 'Mapped from codebase graph evidence.',
    evidenceIds: [`evidence-${index}`],
    alternatives: [],
    userConfirmed: false,
    userOverridden: false,
  }));
  const enriched = applyEvidenceGroundedMappings(base, mappings, {
    engine: 'HYBRID_AI', analysisId: 'analysis-1', contentHash: 'content-1', retrievalVersion: 'flow-mapping/2',
  });

  assert.equal(enriched.report.version, '2.0');
  assert.equal(enriched.report.summary.resolvedCount, 3);
  assert.equal(enriched.report.summary.unresolvedCount, 0);
  assert.ok(enriched.manifest.checkpoints.every((checkpoint: any) => checkpoint.mapping.status === 'RESOLVED'));
  assert.equal(enriched.report.missingStates.length, 0);
  assert.equal(enriched.report.incompleteTransitions.length, 0);
  const roadmap = buildManualRoadmap(enriched.manifest as any, 2, enriched.report as any);
  assert.match(String(roadmap.steps[0].description), /src\/auth\/GuestGate\.tsx/);
  assert.equal((roadmap.steps[0] as any).startLine, 10);
});

test('boundary checkpoints are the only required ones, and markers read in plain language', () => {
  const snapshot = {
    states: [
      { id: '901c8745-8280-4a2e-b88a-cfd0d1571103', stateName: 'Cart viewed', role: 'INITIAL' },
      { id: 'b1', stateName: 'Address entered', role: 'NORMAL' },
      { id: 'c1', stateName: 'Order confirmed', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [
      { id: 't1', fromStateId: '901c8745-8280-4a2e-b88a-cfd0d1571103', toStateId: 'b1', action: 'Enter address' },
      { id: 't2', fromStateId: 'b1', toStateId: 'c1', action: 'Submit payment' },
    ],
  };
  const { manifest, report } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000014', undefined, 'Checkout');
  assert.equal(manifest.flowKey, 'checkout');
  const required = manifest.checkpoints.filter((item) => item.required).map((item) => item.id);
  assert.deepEqual(required, ['state:901c8745-8280-4a2e-b88a-cfd0d1571103', 'state:c1'], 'only the declared boundaries gate initialization');

  const roadmap = buildManualRoadmap(manifest, 1, report);
  const initialStep = roadmap.steps.find((step) => step.id === 'state:901c8745-8280-4a2e-b88a-cfd0d1571103');
  assert.equal(initialStep?.snippet, "TELLANN.trackEvent('FLOW_INITIAL_STATE', { flow: 'checkout', state: 'cart-viewed' });");
  assert.ok(!roadmap.steps.some((step) => step.snippet.includes('901c8745')), 'no snippet exposes an internal id');
  const transitionStep = roadmap.steps.find((step) => step.id === 'transition:t2');
  assert.equal(transitionStep?.snippet, "TELLANN.trackEvent('FLOW_TRANSITION', { flow: 'checkout', transition: 'submit-payment' });");
  assert.equal(transitionStep?.required, false);
  // Non-boundary checkpoints do not gate setup, but automated initialization
  // still writes every one of them — so the roadmap says when a step is needed
  // rather than calling it optional and implying it does not matter.
  assert.ok(
    String(transitionStep?.description).startsWith('Not needed to finish setup'),
    'steps that do not gate setup say so before the placement advice',
  );
  assert.ok(!String(transitionStep?.description).includes('Optional'));
});

test('states that share a name get distinct markers', () => {
  const snapshot = {
    states: [
      { id: 'a', stateName: 'Start', role: 'INITIAL' },
      { id: 'b', stateName: 'Failed', role: 'TERMINAL', terminalKind: 'FAILURE' },
      { id: 'c', stateName: 'Failed', role: 'TERMINAL', terminalKind: 'FAILURE' },
    ],
    transitions: [{ id: 't', fromStateId: 'a', toStateId: 'b', action: 'fail' }],
  };
  const { manifest } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000015', undefined, 'Payment');
  const markers = manifest.checkpoints.filter((item) => item.kind === 'STATE').map((item) => item.marker.state);
  assert.deepEqual(markers, ['start', 'failed', 'failed-2']);
});

test('a code scan initializes the flow from the start marker and one finish marker alone', () => {
  const snapshot = {
    states: [
      { id: 'a', stateName: 'Cart viewed', role: 'INITIAL' },
      { id: 'b', stateName: 'Address entered', role: 'NORMAL' },
      { id: 'c', stateName: 'Order confirmed', role: 'TERMINAL', terminalKind: 'SUCCESS' },
      { id: 'd', stateName: 'Payment declined', role: 'TERMINAL', terminalKind: 'FAILURE' },
    ],
    transitions: [{ id: 't1', fromStateId: 'a', toStateId: 'c', action: 'Pay' }],
  };
  const { manifest } = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000016', undefined, 'Checkout');

  const complete = evaluateCodeScanCoverage(manifest, [
    { file: 'src/cart.ts', line: 12, flow: 'checkout', state: 'cart-viewed' },
    { file: 'src/receipt.ts', line: 40, flow: 'checkout', state: 'order-confirmed' },
  ]);
  assert.equal(complete.status, 'COMPLETED', 'one terminal is enough — the other declared endings are not required');
  assert.equal(complete.method, 'STATIC_CODE_SCAN');
  assert.deepEqual(complete.reachedTerminalStateIds, ['c']);
  assert.deepEqual(complete.codeEvidence, [
    { checkpointId: 'state:a', file: 'src/cart.ts', line: 12 },
    { checkpointId: 'state:c', file: 'src/receipt.ts', line: 40 },
  ]);

  const startOnly = evaluateCodeScanCoverage(manifest, [{ file: 'src/cart.ts', line: 12, flow: 'checkout', state: 'cart-viewed' }]);
  assert.equal(startOnly.status, 'INCOMPLETE');
  assert.deepEqual(startOnly.missingCheckpointIds, ['state:c', 'state:d'], 'either terminal would satisfy it');

  const legacy = evaluateCodeScanCoverage(manifest, [
    { file: 'src/cart.ts', line: 12, checkpointId: 'state:a' },
    { file: 'src/receipt.ts', line: 40, checkpointId: 'state:c' },
  ]);
  assert.equal(legacy.status, 'COMPLETED', 'markers written by an older Tellann still resolve');

  const foreign = evaluateCodeScanCoverage(manifest, [
    { file: 'src/other.ts', line: 3, flow: 'refunds', state: 'cart-viewed' },
    { file: 'src/receipt.ts', line: 40, flow: 'checkout', state: 'order-confirmed' },
  ]);
  assert.deepEqual(foreign.observedCheckpointIds, ['state:c'], 'another flow’s marker never satisfies this one');
});

/** A manifest with one state and one terminal, enough to exercise scan coverage. */
function scanFixture() {
  const snapshot = {
    name: 'Checkout',
    states: [
      { id: 's1', stateName: 'Cart viewed', role: 'INITIAL' },
      { id: 's2', stateName: 'Paid', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ id: 't1', fromStateId: 's1', toStateId: 's2', action: 'Submit payment' }],
  };
  const repository = { id: '00000000-0000-4000-8000-000000000031', routeSummary: [], endpointSummary: [], frameworkSummary: [] };
  return analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000030', undefined, 'Checkout').manifest;
}

test('manual initialization is satisfied by the boundaries; automated is not', () => {
  const manifest = scanFixture();
  const boundaryMarkers = [
    { file: 'src/cart.tsx', line: 10, flow: 'checkout', state: 'cart-viewed', transition: null },
    { file: 'src/paid.tsx', line: 20, flow: 'checkout', state: 'paid', transition: null },
  ];

  const manual = evaluateCodeScanCoverage(manifest, boundaryMarkers, undefined, { mode: 'MANUAL' });
  assert.equal(manual.status, 'COMPLETED');
  assert.equal(manual.requirement, 'BOUNDARIES');

  // Automated initialization wrote a marker for the transition too, so the same
  // two markers mean the apply did not land everything it promised.
  const automated = evaluateCodeScanCoverage(manifest, boundaryMarkers, undefined, { mode: 'AUTOMATED' });
  assert.equal(automated.status, 'INCOMPLETE');
  assert.equal(automated.requirement, 'ALL_CHECKPOINTS');
  assert.deepEqual(automated.missingCheckpointIds, ['transition:t1']);

  const complete = evaluateCodeScanCoverage(manifest, [
    ...boundaryMarkers,
    { file: 'src/pay.ts', line: 5, flow: 'checkout', state: null, transition: 'submit-payment' },
  ], undefined, { mode: 'AUTOMATED' });
  assert.equal(complete.status, 'COMPLETED');
  assert.deepEqual(complete.missingCheckpointIds, []);
});

test('a duplicate or unrecognised marker fails verification with its file and line', () => {
  const manifest = scanFixture();
  const verification = evaluateCodeScanCoverage(manifest, [
    { file: 'src/cart.tsx', line: 10, flow: 'checkout', state: 'cart-viewed', transition: null },
    { file: 'src/cart-copy.tsx', line: 3, flow: 'checkout', state: 'cart-viewed', transition: null },
    { file: 'src/paid.tsx', line: 20, flow: 'checkout', state: 'paid', transition: null },
    { file: 'src/stale.tsx', line: 7, flow: 'checkout', state: 'removed-state', transition: null },
  ], undefined, { mode: 'MANUAL' });

  assert.equal(verification.status, 'INCOMPLETE', 'boundaries alone do not excuse a bad marker');
  assert.deepEqual(
    verification.markerProblems.map((item) => [item.code, item.file, item.line]),
    [['DUPLICATE_MARKER', 'src/cart-copy.tsx', 3], ['UNKNOWN_MARKER', 'src/stale.tsx', 7]],
  );

  // Another Flow's markers legitimately share a file and are not this Flow's problem.
  const neighbourly = evaluateCodeScanCoverage(manifest, [
    { file: 'src/cart.tsx', line: 10, flow: 'checkout', state: 'cart-viewed', transition: null },
    { file: 'src/paid.tsx', line: 20, flow: 'checkout', state: 'paid', transition: null },
    { file: 'src/cart.tsx', line: 11, flow: 'onboarding', state: 'welcome', transition: null },
  ], undefined, { mode: 'MANUAL' });
  assert.deepEqual(neighbourly.markerProblems, []);
  assert.equal(neighbourly.status, 'COMPLETED');
});

test('the v2 contract is enforced at the write, not discovered by the adapter later', () => {
  const snapshot = {
    name: 'Checkout',
    states: [
      { id: 's1', stateName: 'Cart viewed', role: 'INITIAL' },
      { id: 's2', stateName: 'Paid', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ id: 't1', fromStateId: 's1', toStateId: 's2', action: 'Submit payment' }],
  };
  const repository = { id: '00000000-0000-4000-8000-000000000031', routeSummary: [], endpointSummary: [], frameworkSummary: [] };
  const base = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000030', undefined, 'Checkout');
  const resolvedMapping = (checkpointId: string, symbol: string) => ({
    checkpointId, status: 'RESOLVED' as const, entityId: `entity:${symbol}`, candidateId: `candidate:${symbol}`,
    file: 'src/checkout.ts', symbol, startLine: 4, endLine: 12,
    placementKind: 'FUNCTION_ENTRY', anchorText: `function ${symbol}()`, anchorHash: 'a'.repeat(64),
    confidence: 0.9, rationale: 'Grounded.', evidenceIds: [`evidence:${symbol}`],
    alternatives: [], userConfirmed: false, userOverridden: false,
  });
  const provenance = {
    engine: 'HYBRID_AI', analysisId: 'analysis-1', snapshotId: 'snapshot-1', contentHash: 'content-1',
    retrievalVersion: 'flow-mapping/2', provider: 'gemini', model: 'gemini-test', consentMode: 'CLOUD_APPROVED',
  };

  const good = applyEvidenceGroundedMappings(
    base,
    base.manifest.checkpoints.map((checkpoint, index) => resolvedMapping(checkpoint.id, `step${index}`)),
    provenance,
  );
  assert.doesNotThrow(() => assertEvidenceGroundedContract(good));
  // Every finding can be joined back to its checkpoint without rebuilding prefixes.
  assert.ok(good.report.stateFindings.every((item: any) => typeof item.checkpointId === 'string'));

  // A checkpoint left without a mapping is the drift the adapter used to find
  // several steps later, with nothing useful to say about it.
  const partial = applyEvidenceGroundedMappings(
    base,
    base.manifest.checkpoints.slice(0, 1).map((checkpoint) => resolvedMapping(checkpoint.id, 'step0')),
    provenance,
  );
  assert.throws(() => assertEvidenceGroundedContract(partial), /INVALID_FLOW_MAPPING_MANIFEST/);

  // So is a resolved mapping that cites no evidence for its claim.
  const uncited = applyEvidenceGroundedMappings(
    base,
    base.manifest.checkpoints.map((checkpoint, index) => ({ ...resolvedMapping(checkpoint.id, `step${index}`), evidenceIds: [] })),
    provenance,
  );
  assert.throws(() => assertEvidenceGroundedContract(uncited), /INVALID_FLOW_MAPPING_(MANIFEST|REPORT)/);
});

test('the manual roadmap carries the same evidence the automated path would act on', () => {
  const snapshot = {
    name: 'Checkout',
    states: [
      { id: 's1', stateName: 'Cart viewed', role: 'INITIAL' },
      { id: 's2', stateName: 'Paid', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ id: 't1', fromStateId: 's1', toStateId: 's2', action: 'Submit payment' }],
  };
  const repository = { id: '00000000-0000-4000-8000-000000000031', routeSummary: [], endpointSummary: [], frameworkSummary: [] };
  const base = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000030', undefined, 'Checkout');
  const enriched = applyEvidenceGroundedMappings(
    base,
    base.manifest.checkpoints.map((checkpoint) => ({
      checkpointId: checkpoint.id, status: 'RESOLVED' as const, entityId: 'e1', candidateId: 'c1',
      file: 'src/checkout.ts', symbol: 'checkout', startLine: 4, endLine: 12,
      placementKind: 'FUNCTION_ENTRY', anchorText: 'function checkout()', anchorHash: 'a'.repeat(64),
      confidence: 0.88, rationale: 'The cart page renders here.', evidenceIds: ['evidence:1'],
      alternatives: [{ id: 'c2', entityId: 'e2', file: 'src/other.ts', symbol: 'other', startLine: 2, endLine: 9, placementKinds: ['FUNCTION_ENTRY'], confidence: 0.5, rationale: 'Also plausible.', evidenceIds: ['evidence:2'] }],
      userConfirmed: false, userOverridden: false,
    })),
    { engine: 'HYBRID_AI', analysisId: 'a1', snapshotId: 's1', contentHash: 'c1', retrievalVersion: 'flow-mapping/2', provider: 'gemini', model: 'g', consentMode: 'CLOUD_APPROVED' },
  );

  const roadmap = buildManualRoadmap(enriched.manifest as any, 1, enriched.report as any);
  const step = roadmap.steps.find((item: any) => item.id === `state:s1`)!;
  assert.equal(step.rationale, 'The cart page renders here.');
  assert.equal(step.anchor, 'function checkout()');
  assert.deepEqual(step.evidenceIds, ['evidence:1']);
  assert.equal((step.alternatives as any[])[0].id, 'c2');
  assert.equal(step.placementKind, 'FUNCTION_ENTRY');
});
