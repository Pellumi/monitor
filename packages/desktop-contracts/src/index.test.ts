import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATION_STOP_REASON_KIND,
  AutomatedRunSectionSchema,
  AutomationConfigSchema,
  AutomationStopReasonSchema,
  FlowAnalysisProgressSchema,
  FlowCodeReviewReportSchema,
  FlowInitializationManifestSchema,
  FlowMappingCandidateSchema,
  FlowReviewPreviewSchema,
  FlowSuggestionsResponseSchema,
  IPC,
  QAEvidenceEventTypeSchema,
  QA_AUTOMATION_EVENT_TYPES,
  StartGuidedRunInputSchema,
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

const runBase = {
  applicationId: id('1'), environmentId: id('2'), workspaceId: null,
  environmentType: 'STAGING' as const, targetUrl: 'https://example.test',
};

test('QA run contract requires initialized Flow context only for guided mode', () => {
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, mode: 'GUIDED' }).success, false);
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, mode: 'ASSISTED' }).success, true);
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, mode: 'OBSERVATION_ONLY' }).success, true);

  // What the desktop actually sends for a run started without a Flow: the
  // absent context is explicit nulls, not missing keys.
  const flowless = StartGuidedRunInputSchema.parse({
    ...runBase, mode: 'ASSISTED' as const,
    flowId: undefined, flowBindingId: undefined, flowInitializationId: undefined,
    flowScanId: undefined, flowDriftId: null, expectedGraphVersionId: null, patchSetId: null,
  });
  assert.equal(flowless.expectedGraphVersionId, null);

  const guided = StartGuidedRunInputSchema.parse({
    ...runBase,
    flowId: id('3'), flowBindingId: id('4'), flowInitializationId: id('5'),
    flowScanId: id('6'), expectedGraphVersionId: id('7'),
  });
  assert.equal(guided.mode, 'GUIDED');
});

test('assisted QA contract accepts optional Flow candidates while observation is flowless', () => {
  const assisted = StartGuidedRunInputSchema.parse({
    ...runBase, mode: 'ASSISTED', flowId: id('3'), expectedGraphVersionId: id('7'),
  });
  assert.equal(assisted.flowId, id('3'));
  assert.equal(StartGuidedRunInputSchema.safeParse({
    ...runBase, mode: 'ASSISTED', flowInitializationId: id('5'),
  }).success, false);

  const observation = StartGuidedRunInputSchema.parse({
    ...runBase, mode: 'OBSERVATION_ONLY', flowId: id('3'), expectedGraphVersionId: id('7'),
  });
  assert.equal('flowId' in observation, false);
  assert.equal(observation.expectedGraphVersionId, null);
});

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

const automatedFlow = {
  flowId: id('3'), flowBindingId: id('4'), flowInitializationId: id('5'), flowScanId: id('6'),
  expectedGraphVersionId: id('7'),
};
const automation = { targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1' };

test('automated run requires Flow context, an automation block, and never runs against production', () => {
  const ok = StartGuidedRunInputSchema.safeParse({ ...runBase, ...automatedFlow, mode: 'AUTOMATED', automation });
  assert.equal(ok.success, true);
  if (ok.success) {
    // Limits are defaulted so a run always carries explicit budgets.
    assert.deepEqual(ok.data.automation?.limits, { maxSteps: 100, maxDurationMs: 600_000, maxReplans: 10, maxActionRetries: 2 });
  }
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, mode: 'AUTOMATED', automation }).success, false, 'flow context required');
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, ...automatedFlow, mode: 'AUTOMATED' }).success, false, 'automation block required');
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, ...automatedFlow, mode: 'AUTOMATED', automation, environmentType: 'PRODUCTION' }).success, false, 'production is blocked');
  assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, ...automatedFlow, mode: 'AUTOMATED', automation, launchCommandId: 'npm-dev' }).success, false, 'loose launch commands are not accepted');
});

test('automation block is rejected on every other mode', () => {
  for (const mode of ['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY'] as const) {
    assert.equal(StartGuidedRunInputSchema.safeParse({ ...runBase, ...automatedFlow, mode, automation }).success, false, mode);
  }
});

test('every automation stop reason is classified', () => {
  for (const reason of AutomationStopReasonSchema.options) {
    assert.ok(AUTOMATION_STOP_REASON_KIND[reason], reason);
  }
  // The application refusing to cooperate is evidence, not a Tellann failure.
  assert.equal(AUTOMATION_STOP_REASON_KIND.EXPECTED_TRANSITION_NOT_FOUND, 'APPLICATION');
  assert.equal(AUTOMATION_STOP_REASON_KIND.AUTOMATION_ENGINE_ERROR, 'INFRASTRUCTURE');
});

test('automation events are part of the QA evidence taxonomy', () => {
  for (const type of QA_AUTOMATION_EVENT_TYPES) assert.ok(QAEvidenceEventTypeSchema.options.includes(type), type);
});

const baseConfig = { targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1' };

test('render timing is opt-in, names components only, and is bounded', () => {
  assert.deepEqual(AutomationConfigSchema.parse(baseConfig).renderTimingComponents, [], 'off unless asked for');
  assert.deepEqual(AutomationConfigSchema.parse({ ...baseConfig, renderTimingComponents: ['ExamForm', '_Inner$1'] }).renderTimingComponents, ['ExamForm', '_Inner$1']);
  for (const bad of ['exam form', '1Form', 'a.b', 'a;alert(1)', '', 'x'.repeat(81)]) {
    assert.equal(AutomationConfigSchema.safeParse({ ...baseConfig, renderTimingComponents: [bad] }).success, false, JSON.stringify(bad));
  }
  const many = Array.from({ length: 17 }, (_, index) => `Comp${index}`);
  assert.equal(AutomationConfigSchema.safeParse({ ...baseConfig, renderTimingComponents: many }).success, false, 'no blanket instrumentation');
});

test('a report section written before diagnostics existed still parses, with empty diagnostics', () => {
  const legacy = {
    pinned: { flowVersionId: null, initialStateKey: null, targetTerminalStateKey: null, executionProfileId: null, testPersonaId: null, runDataSetId: null, codeSnapshotId: null, instrumentationManifestVersion: null, limits: null },
    outcome: { stopReason: null, kind: null, reachedTarget: false, detail: null, steps: null, replans: null },
    states: [], preBoundaryStateCount: 0, inFlowStateCount: 0, unreachedStates: [], blockedActions: [], reconciliation: {},
  };
  const parsed = AutomatedRunSectionSchema.parse(legacy);
  assert.deepEqual([parsed.codeEvidence, parsed.retainedTraces, parsed.renderTiming], [[], [], []]);
});

test('code evidence carries locations and a hash, and drops any source text it is handed', () => {
  const legacy = {
    pinned: { flowVersionId: null, initialStateKey: null, targetTerminalStateKey: null, executionProfileId: null, testPersonaId: null, runDataSetId: null, codeSnapshotId: null, instrumentationManifestVersion: null, limits: null },
    outcome: { stopReason: null, kind: null, reachedTarget: false, detail: null, steps: null, replans: null },
    states: [], preBoundaryStateCount: 0, inFlowStateCount: 0, unreachedStates: [], blockedActions: [], reconciliation: {},
    codeEvidence: [{
      subject: { kind: 'TRANSITION', id: 't' }, stateKey: null, derivation: 'RESOLVED',
      refs: [{ file: 'a.ts', symbol: null, startLine: 1, endLine: 2, excerptSha256: 'abc', source: 'const secret = 1' }],
      calls: [], navigatesTo: [], guards: [], expectedApi: [], summary: 's', at: '2026-01-01T00:00:00.000Z', excerpt: 'const secret = 1',
    }],
  };
  const parsed = AutomatedRunSectionSchema.parse(legacy);
  assert.ok(!JSON.stringify(parsed).includes('const secret'));
});
