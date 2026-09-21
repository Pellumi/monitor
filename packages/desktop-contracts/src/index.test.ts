import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FlowAnalysisProgressSchema,
  FlowCodeReviewReportSchema,
  FlowInitializationManifestSchema,
  FlowMappingCandidateSchema,
  FlowReviewPreviewSchema,
  FlowSuggestionsResponseSchema,
  IPC,
} from './index';

test('whole-flow review IPC channels are stable and distinct', () => {
  assert.equal(IPC.previewFlowReview, 'tellann:cloud:intent:review:preview');
  assert.equal(IPC.applyFlowReview, 'tellann:cloud:intent:review:apply');
  assert.equal(IPC.declineFlowReview, 'tellann:cloud:intent:review:decline');
  assert.equal(new Set([IPC.previewFlowReview, IPC.applyFlowReview, IPC.declineFlowReview]).size, 3);
});

test('whole-flow contracts accept transition-only reviews and proposed diagram ids', () => {
  const suggestionId = '11111111-1111-4111-8111-111111111111';
  const reviewId = '22222222-2222-4222-8222-222222222222';
  assert.equal(FlowSuggestionsResponseSchema.parse({
    graphVersion: 4, graphHash: 'hash', reviewId,
    suggestions: [{
      id: suggestionId, suggestedStateName: 'PAYMENT_SUBMITTED', category: 'BUSINESS', rationale: 'Connect existing states',
      source: 'AI', sourceTier: 'AI_ASSISTED', confidence: .7, severity: 'MEDIUM', status: 'PENDING', reviewId,
      suggestedStatesJson: [], suggestedTransitionsJson: [{ from: 'CART', to: 'PAYMENT_SUBMITTED', action: 'checkout' }],
    }],
  }).suggestions[0].suggestedTransitionsJson?.length, 1);
  assert.equal(FlowReviewPreviewSchema.parse({
    reviewId, graphVersion: 4, graphHash: 'hash', validation: { valid: true, issues: [] },
    proposedStates: [], proposedTransitions: [], diagrams: [{
      kind: 'FLOW', renderer: 'MERMAID', rendererVersion: '1', source: 'flowchart LR',
      semanticNodeIds: ['proposed-state'], semanticEdgeIds: ['proposed-edge'],
    }],
  }).validation.valid, true);
});

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

test('flow mapping v2 contracts describe grounded candidates and progress', () => {
  const candidate = FlowMappingCandidateSchema.parse({
    id: 'candidate:login', entityId: 'entity:login-page', evidenceIds: ['evidence:route'],
    file: 'src/pages/login.tsx', symbol: 'LoginPage', startLine: 12, endLine: 48,
    placementKind: 'COMPONENT_MOUNT', anchor: 'function LoginPage()', anchorHash: 'sha256:anchor',
    confidence: 0.91, rationale: 'The login route renders this component.',
    relationshipPaths: [['feature:auth', 'ROUTES_TO', 'entity:login-page']], featureEvidence: ['feature:auth'],
  });
  assert.equal(candidate.placementKind, 'COMPONENT_MOUNT');

  const progress = FlowAnalysisProgressSchema.parse({
    status: 'RETRIEVING', completedCheckpoints: 2, totalCheckpoints: 5,
    resolvedCount: 1, ambiguousCount: 1, unresolvedCount: 3, unsupportedCount: 0,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(progress.unresolvedCount, 3);
});

test('flow initialization manifest accepts legacy v1 and evidence-grounded v2', () => {
  const common = {
    graphVersionId: id('1'), graphHash: 'graph-hash', repositorySnapshotId: id('2'),
    initialStateId: 'guest', terminalStateIds: ['dashboard'], paths: [['guest', 'dashboard']],
    unreachableStateIds: [], generatedAt: new Date().toISOString(),
  };
  const checkpoint = {
    id: 'state:guest', kind: 'STATE' as const, stateId: 'guest', transitionId: null,
    stateRole: 'INITIAL' as const, terminalKind: null, eventType: 'FLOW_INITIAL_STATE',
    expectedState: 'guest', fromCheckpointId: null, toCheckpointId: null, required: true,
  };
  assert.equal(FlowInitializationManifestSchema.parse({
    ...common, version: '1.0', checkpoints: [{
      ...checkpoint, mapping: { file: null, symbol: null, confidence: 0, rationale: 'No match.' },
    }],
  }).version, '1.0');

  const parsed = FlowInitializationManifestSchema.parse({
    ...common, version: '2.0', codebaseAnalysisJobId: id('3'), codebaseSnapshotId: id('4'),
    retrievalVersion: 'flow-retrieval-v2', checkpoints: [{
      ...checkpoint, mapping: {
        status: 'RESOLVED', candidateId: 'candidate:guest', entityId: 'entity:guest', evidenceIds: ['evidence:route'],
        file: 'src/app.tsx', symbol: 'App', startLine: 10, endLine: 30,
        placementKind: 'COMPONENT_MOUNT', anchor: 'function App()', anchorHash: 'sha256:app',
        confidence: 0.88, rationale: 'The root app renders the guest route.', alternatives: [], manualInstruction: 'Add the marker when App mounts.',
        instrumentationIntent: { eventType: 'FLOW_INITIAL_STATE', placementDescription: 'Track at component mount.' },
        userConfirmed: false, userOverrode: false,
      },
    }],
  });
  assert.equal(parsed.version, '2.0');
});

test('flow review report preserves legacy v1 parsing while typing its arrays', () => {
  const mapping = { file: 'src/login.tsx', symbol: 'LoginPage', confidence: 0.9, rationale: 'Matched route.' };
  const state = { stateId: 'login', stateName: 'Login', role: 'INITIAL', terminalKind: null, implemented: true, mapping };
  const parsed = FlowCodeReviewReportSchema.parse({
    version: '1.0', kind: 'FLOW_CODE_REVIEW', generatedAt: new Date().toISOString(), engine: 'RULES_FALLBACK',
    summary: { mappedStates: 1, totalStates: 1, mappedTransitions: 0, totalTransitions: 0 },
    stateFindings: [state], transitionFindings: [], missingStates: [], incompleteTransitions: [],
    edgeCases: [{ code: 'UNREACHABLE_STATE', stateId: 'orphan', severity: 'BLOCKING' }],
    uncoveredTerminalOutcomes: [], evidence: [{ file: 'src/login.tsx', symbol: 'LoginPage', text: '/login LoginPage', kind: 'route' }],
    recommendations: [{ checkpointId: 'state:login', kind: 'STATE', action: 'Add state checkpoint', label: 'Login', detail: 'Add marker.', mapping }],
    limitations: [],
  });
  assert.equal(parsed.version, '1.0');
});

test('flow review v2 uses typed findings and rejects malformed findings', () => {
  const report = {
    version: '2.0', kind: 'FLOW_CODE_REVIEW', generatedAt: new Date().toISOString(), engine: 'HYBRID',
    progress: { status: 'READY', completedCheckpoints: 1, totalCheckpoints: 1, resolvedCount: 1, ambiguousCount: 0, unresolvedCount: 0, unsupportedCount: 0, updatedAt: new Date().toISOString() },
    summary: { mappedStates: 1, totalStates: 1, mappedTransitions: 0, totalTransitions: 0, resolvedCount: 1, ambiguousCount: 0, unresolvedCount: 0, unsupportedCount: 0 },
    stateFindings: [{ checkpointId: 'state:guest', stateId: 'guest', stateName: 'Guest', role: 'INITIAL', terminalKind: null, implemented: true, mapping: { status: 'RESOLVED', candidateId: 'candidate:guest', entityId: 'entity:guest', evidenceIds: ['evidence:guest'], file: 'src/app.tsx', symbol: 'App', startLine: 1, endLine: 5, placementKind: 'COMPONENT_MOUNT', anchor: 'App', anchorHash: 'hash', confidence: .9, rationale: 'Root route.', alternatives: [], manualInstruction: 'Add the marker when App mounts.', instrumentationIntent: { eventType: 'FLOW_INITIAL_STATE', placementDescription: 'Track at component mount.' }, userConfirmed: false, userOverrode: false } }],
    transitionFindings: [], missingStates: [], incompleteTransitions: [], edgeCases: [], uncoveredTerminalOutcomes: [], evidence: [], recommendations: [], limitations: [],
    analysis: { jobId: id('3'), snapshotId: id('4'), mode: 'CLOUD_APPROVED', graphVersion: 'graph-v1', contentHash: 'content', revision: 'abc', branch: 'main', dirty: false, current: true },
    ai: { attempted: true, provider: 'GEMINI', model: 'gemini', promptVersion: 'flow-mapping-v2', promptHash: 'hash', fallbackUsed: false, repaired: false, consentMode: 'CLOUD_APPROVED', resolvedAt: new Date().toISOString() },
  };
  assert.equal(FlowCodeReviewReportSchema.parse(report).version, '2.0');
  assert.equal(FlowCodeReviewReportSchema.safeParse({ ...report, stateFindings: [{ stateId: 42 }] }).success, false);
});
