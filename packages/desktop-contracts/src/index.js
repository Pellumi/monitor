"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkReadinessSchema = exports.SdkTargetReadinessSchema = exports.SdkConnectionMethodSchema = exports.SdkTargetKindSchema = exports.InstrumentationFrameworkIdSchema = exports.IntentDraftSchema = exports.IntentDraftJobCreatedSchema = exports.IntentDraftJobSchema = exports.DocumentProcessingJobSchema = exports.DocumentImportResultSchema = exports.AsyncJobStatusSchema = exports.DocumentAccessSchema = exports.SourceDocumentSummarySchema = exports.SourceDocumentManifestSchema = exports.FlowInitializationSchema = exports.CheckpointCoverageSchema = exports.ManualRoadmapSchema = exports.ManualRoadmapStepSchema = exports.FlowReviewEnrichmentSchema = exports.FlowCodeReviewReportSchema = exports.FlowInitializationManifestSchema = exports.FlowCheckpointSchema = exports.FlowProjectBindingSchema = exports.FlowReviewPreviewSchema = exports.FlowDiagramSchema = exports.FlowSuggestionsResponseSchema = exports.FlowSuggestionMetaSchema = exports.DeclaredStateSuggestionSchema = exports.DeclaredSuggestionTransitionSchema = exports.DeclaredSuggestionStateSchema = exports.DeclaredFlowDetailSchema = exports.DeclaredTransitionSchema = exports.DeclaredStateSchema = exports.DeclaredFlowSummarySchema = exports.QualityReportSchema = exports.QARunSummarySchema = exports.QARunSchema = exports.BrowserFindingSchema = exports.QARunArtifactSchema = exports.RunCorrelationContextSchema = exports.RepositorySnapshotSummarySchema = exports.FrameworkEvidenceSchema = exports.DesktopPermissionSchema = exports.DesktopDeviceSchema = exports.PrivacyClassificationSchema = exports.ArtifactTypeSchema = exports.RunStatusSchema = exports.PermissionTypeSchema = exports.EnvironmentTypeSchema = exports.DESKTOP_CONTRACT_VERSION = void 0;
exports.DesktopApplicationSchema = exports.DesktopEntitlementsSchema = exports.DesktopSessionSchema = exports.IPC = exports.StartGuidedRunInputSchema = exports.InstrumentationValidationResultSchema = exports.InstrumentationApplyResultSchema = exports.InstrumentationApprovalSchema = exports.InstrumentationDetectionSchema = exports.InstrumentationPlanSchema = exports.InstrumentationOperationSchema = exports.StructuredInstrumentationCommandSchema = exports.InstrumentationPlanStatusSchema = exports.DesktopSetupHandoffSchema = exports.SdkSetupDescriptorSchema = exports.SdkSetupTargetSchema = void 0;
const zod_1 = require("zod");
exports.DESKTOP_CONTRACT_VERSION = '1.0';
exports.EnvironmentTypeSchema = zod_1.z.enum(['DEVELOPMENT', 'STAGING', 'PRODUCTION']);
exports.PermissionTypeSchema = zod_1.z.enum([
    'BROWSER_ONLY',
    'READ_WORKSPACE',
    'PROPOSE_INSTRUMENTATION',
    'APPLY_TASK',
    'RUN_COMMANDS',
    'SENSITIVE_BROWSER_ACTIONS',
]);
exports.RunStatusSchema = zod_1.z.enum([
    'CREATED',
    'DRAFT',
    'PREPARING',
    'WAITING_FOR_PERMISSION',
    'READY',
    'ARMED',
    'WAITING_FOR_INITIAL',
    'RECORDING',
    'RUNNING',
    'PAUSED',
    'ENDING',
    'UPLOADING',
    'PROCESSING',
    'RECONCILING',
    'REPORTING',
    'COMPLETED',
    'COMPLETED_INCOMPLETE',
    'FAILED',
    'CANCELLED',
    'PARTIAL',
]);
exports.ArtifactTypeSchema = zod_1.z.enum([
    'SCREENSHOT',
    'PLAYWRIGHT_TRACE',
    'ACCESSIBILITY_SNAPSHOT',
    'CONSOLE_LOG',
    'NETWORK_LOG',
    'RUN_MANIFEST',
]);
exports.PrivacyClassificationSchema = zod_1.z.enum([
    'PUBLIC',
    'INTERNAL',
    'SENSITIVE',
    'RESTRICTED',
]);
exports.DesktopDeviceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    deviceName: zod_1.z.string().min(1).max(120),
    platform: zod_1.z.string().min(1),
    appVersion: zod_1.z.string().min(1),
    scopes: zod_1.z.array(zod_1.z.string()),
    lastSeenAt: zod_1.z.string().datetime(),
    revokedAt: zod_1.z.string().datetime().nullable(),
});
exports.DesktopPermissionSchema = zod_1.z.object({
    type: exports.PermissionTypeSchema,
    workspaceId: zod_1.z.string().uuid().optional(),
    fileScopes: zod_1.z.array(zod_1.z.string()).default([]),
    commandScopes: zod_1.z.array(zod_1.z.string()).default([]),
    purpose: zod_1.z.string().min(1).max(500),
    expiresAt: zod_1.z.string().datetime().nullable().default(null),
});
exports.FrameworkEvidenceSchema = zod_1.z.object({
    framework: zod_1.z.string(),
    version: zod_1.z.string().nullable(),
    confidence: zod_1.z.number().min(0).max(1),
    evidence: zod_1.z.array(zod_1.z.string()),
});
exports.RepositorySnapshotSummarySchema = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    revision: zod_1.z.string().nullable(),
    branch: zod_1.z.string().nullable(),
    dirty: zod_1.z.boolean(),
    repositoryFingerprint: zod_1.z.string().min(32),
    repositoryOriginHash: zod_1.z.string().min(32).nullable().optional(),
    repositoryCloneUrl: zod_1.z.string().url().nullable().optional(),
    languages: zod_1.z.array(zod_1.z.string()),
    packageManager: zod_1.z.string().nullable(),
    launchCommands: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        executable: zod_1.z.string(),
        args: zod_1.z.array(zod_1.z.string()),
        cwd: zod_1.z.string(),
        scriptName: zod_1.z.string(),
    })).optional(),
    suggestedApplicationUrls: zod_1.z.array(zod_1.z.object({
        url: zod_1.z.string().url(),
        confidence: zod_1.z.number().min(0).max(1),
        source: zod_1.z.string(),
    })).optional(),
    frameworks: zod_1.z.array(exports.FrameworkEvidenceSchema),
    routes: zod_1.z.array(zod_1.z.string()),
    endpoints: zod_1.z.array(zod_1.z.string()),
    documentation: zod_1.z.array(zod_1.z.string()),
    manifestHashes: zod_1.z.record(zod_1.z.string()),
    scannerVersion: zod_1.z.string(),
    redactionSummary: zod_1.z.object({
        excludedFiles: zod_1.z.number().int().nonnegative(),
        suspectedSecrets: zod_1.z.number().int().nonnegative(),
    }),
});
exports.RunCorrelationContextSchema = zod_1.z.object({
    runId: zod_1.z.string().uuid(),
    sessionId: zod_1.z.string().uuid(),
    traceId: zod_1.z.string().uuid(),
    applicationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
    expectedGraphVersionId: zod_1.z.string().uuid().nullable(),
    agentVersion: zod_1.z.string(),
});
exports.QARunArtifactSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    runId: zod_1.z.string().uuid(),
    type: exports.ArtifactTypeSchema,
    privacyClassification: exports.PrivacyClassificationSchema,
    objectKey: zod_1.z.string().nullable(),
    localPath: zod_1.z.string().nullable(),
    bytes: zod_1.z.number().int().nonnegative(),
    checksum: zod_1.z.string(),
    capturedAt: zod_1.z.string().datetime(),
});
exports.BrowserFindingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    runId: zod_1.z.string().uuid(),
    category: zod_1.z.string(),
    severity: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
    confidence: zod_1.z.number().min(0).max(1),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    url: zod_1.z.string().url().nullable(),
    viewport: zod_1.z.object({ width: zod_1.z.number().int(), height: zod_1.z.number().int() }).nullable(),
    evidenceArtifactIds: zod_1.z.array(zod_1.z.string().uuid()),
    reproductionSteps: zod_1.z.array(zod_1.z.string()),
    recommendation: zod_1.z.string().nullable(),
});
exports.QARunSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    applicationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
    workspaceId: zod_1.z.string().uuid().nullable(),
    deviceSessionId: zod_1.z.string().uuid().nullable(),
    expectedGraphVersionId: zod_1.z.string().uuid().nullable(),
    flowId: zod_1.z.string().uuid().nullable(),
    flowBindingId: zod_1.z.string().uuid().nullable(),
    flowInitializationId: zod_1.z.string().uuid().nullable(),
    flowScanId: zod_1.z.string().uuid().nullable(),
    flowDriftId: zod_1.z.string().uuid().nullable().optional(),
    captureTracks: zod_1.z.array(zod_1.z.enum(['FRONTEND', 'BACKEND'])).min(1),
    initialStateKey: zod_1.z.string().nullable(),
    terminalStateKeys: zod_1.z.array(zod_1.z.string()),
    lastObservedStateKey: zod_1.z.string().nullable().optional(),
    boundaryStartedAt: zod_1.z.string().datetime().nullable().optional(),
    boundaryCompletedAt: zod_1.z.string().datetime().nullable().optional(),
    completionReason: zod_1.z.string().nullable().optional(),
    mode: zod_1.z.enum(['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY']),
    status: exports.RunStatusSchema,
    targetUrl: zod_1.z.string().url(),
    startedAt: zod_1.z.string().datetime().nullable(),
    endedAt: zod_1.z.string().datetime().nullable(),
    failureReason: zod_1.z.string().nullable(),
});
exports.QARunSummarySchema = exports.QARunSchema.extend({
    createdAt: zod_1.z.string().datetime().optional(),
    updatedAt: zod_1.z.string().datetime().optional(),
    environment: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        type: exports.EnvironmentTypeSchema,
    }).optional(),
    artifactCount: zod_1.z.number().int().nonnegative().default(0),
    findingCount: zod_1.z.number().int().nonnegative().default(0),
    reportId: zod_1.z.string().nullable().optional(),
});
exports.QualityReportSchema = zod_1.z.object({
    id: zod_1.z.string(),
    runId: zod_1.z.string().uuid(),
    status: exports.RunStatusSchema,
    generatedAt: zod_1.z.string().datetime(),
    application: zod_1.z.object({ id: zod_1.z.string().uuid(), name: zod_1.z.string() }),
    environment: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        type: exports.EnvironmentTypeSchema,
    }),
    flow: zod_1.z.object({
        id: zod_1.z.string().uuid(), versionId: zod_1.z.string().uuid(), version: zod_1.z.number().int(), name: zod_1.z.string(),
        purpose: zod_1.z.string().nullable(), scopeStatement: zod_1.z.string().nullable(), initialStateKey: zod_1.z.string(), terminalStateKeys: zod_1.z.array(zod_1.z.string()),
    }).nullable(),
    boundary: zod_1.z.object({
        status: exports.RunStatusSchema, startedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(), completedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(),
        lastObservedStateKey: zod_1.z.string().nullable(), completionReason: zod_1.z.string().nullable(), timeoutAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(),
        acceptedEvents: zod_1.z.array(zod_1.z.unknown()), quarantinedEvents: zod_1.z.array(zod_1.z.unknown()),
    }),
    captureTracks: zod_1.z.array(zod_1.z.enum(['FRONTEND', 'BACKEND'])),
    correlation: zod_1.z.object({
        runId: zod_1.z.string().uuid(),
        sessions: zod_1.z.array(zod_1.z.object({
            sessionId: zod_1.z.string().uuid(),
            traceId: zod_1.z.string().nullable(),
            startedAt: zod_1.z.string().datetime(),
            endedAt: zod_1.z.string().datetime().nullable(),
        })),
    }),
    repository: zod_1.z.object({
        revision: zod_1.z.string().nullable(),
        dirty: zod_1.z.boolean(),
        scannerVersion: zod_1.z.string(),
        redactionSummary: zod_1.z.unknown(),
    }).nullable(),
    instrumentation: zod_1.z.object({
        patchSetId: zod_1.z.string().uuid(), planId: zod_1.z.string().uuid(), adapterId: zod_1.z.enum(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']),
        adapterVersion: zod_1.z.string(), manifestVersion: zod_1.z.string(), status: zod_1.z.string(), risk: zod_1.z.string(),
        changedFileHashes: zod_1.z.unknown(), validation: zod_1.z.unknown().nullable(),
        appliedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(), validatedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(),
    }).nullable().optional(),
    expectedIntent: zod_1.z.object({
        graphId: zod_1.z.string().uuid(), graphVersionId: zod_1.z.string().uuid(), graphName: zod_1.z.string(), provenance: zod_1.z.string(),
        evidenceManifest: zod_1.z.unknown().nullable(), expectedStateCount: zod_1.z.number().int().nullable(), expectedTransitionCount: zod_1.z.number().int().nullable(),
    }).nullable().optional(),
    coverage: zod_1.z.object({
        expected: zod_1.z.number().nullable(),
        reconciledFlows: zod_1.z.number().int().nonnegative(),
    }),
    findings: zod_1.z.array(zod_1.z.unknown()),
    artifacts: zod_1.z.array(zod_1.z.unknown()),
    summary: zod_1.z.object({
        sessionCount: zod_1.z.number().int().nonnegative(),
        observedStateCount: zod_1.z.number().int().nonnegative(),
        observedTransitionCount: zod_1.z.number().int().nonnegative(),
        artifactCount: zod_1.z.number().int().nonnegative(),
        findingCount: zod_1.z.number().int().nonnegative(),
        criticalOrHighFindings: zod_1.z.number().int().nonnegative(),
    }),
}).passthrough();
exports.DeclaredFlowSummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    status: zod_1.z.string(),
    lifecycleStatus: zod_1.z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SUPERSEDED']).optional(),
    purpose: zod_1.z.string().nullable().optional(),
    scopeStatement: zod_1.z.string().nullable().optional(),
    exclusions: zod_1.z.array(zod_1.z.string()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    publishedVersionId: zod_1.z.string().uuid().nullable().optional(),
    version: zod_1.z.number().int().optional(),
    updatedAt: zod_1.z.string().datetime().optional(),
    versions: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string().uuid(), version: zod_1.z.number().int(), isBaseline: zod_1.z.boolean().optional() })).optional(),
}).passthrough();
exports.DeclaredStateSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    stateName: zod_1.z.string(),
    category: zod_1.z.string(),
    provenance: zod_1.z.string(),
    role: zod_1.z.enum(['NORMAL', 'INITIAL', 'TERMINAL']).default('NORMAL'),
    terminalKind: zod_1.z.enum(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']).nullable().optional(),
    canonicalBehavior: zod_1.z.string().nullable().optional(),
}).passthrough();
exports.DeclaredTransitionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    fromStateId: zod_1.z.string().uuid(),
    toStateId: zod_1.z.string().uuid(),
    action: zod_1.z.string().nullable().optional(),
    condition: zod_1.z.string().nullable().optional(),
    provenance: zod_1.z.string(),
    fromState: exports.DeclaredStateSchema.optional(),
    toState: exports.DeclaredStateSchema.optional(),
}).passthrough();
exports.DeclaredFlowDetailSchema = exports.DeclaredFlowSummarySchema.extend({
    workflowType: zod_1.z.string(),
    states: zod_1.z.array(exports.DeclaredStateSchema).default([]),
    transitions: zod_1.z.array(exports.DeclaredTransitionSchema).default([]),
});
exports.DeclaredSuggestionStateSchema = zod_1.z.object({
    name: zod_1.z.string(), category: zod_1.z.string(), role: zod_1.z.enum(['INITIAL', 'NORMAL', 'TERMINAL']).optional(),
    terminalKind: zod_1.z.enum(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']).nullable().optional(),
});
exports.DeclaredSuggestionTransitionSchema = zod_1.z.object({
    from: zod_1.z.string(), to: zod_1.z.string(), action: zod_1.z.string().nullable().optional(),
});
exports.DeclaredStateSuggestionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), suggestedStateName: zod_1.z.string(), category: zod_1.z.string(), rationale: zod_1.z.string(),
    title: zod_1.z.string().nullable().optional(), description: zod_1.z.string().nullable().optional(),
    source: zod_1.z.enum(['RULE_ENGINE', 'AI', 'HYBRID']).default('RULE_ENGINE'), sourceTier: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1), severity: zod_1.z.string(), status: zod_1.z.string(),
    graphVersion: zod_1.z.number().int().nullable().optional(), graphHash: zod_1.z.string().nullable().optional(),
    reviewId: zod_1.z.string().uuid().nullable().optional(),
    suggestedStatesJson: zod_1.z.array(exports.DeclaredSuggestionStateSchema).nullable().optional(),
    suggestedTransitionsJson: zod_1.z.array(exports.DeclaredSuggestionTransitionSchema).nullable().optional(),
}).passthrough();
exports.FlowSuggestionMetaSchema = zod_1.z.object({
    ruleCount: zod_1.z.number().int().nonnegative().default(0), aiCount: zod_1.z.number().int().nonnegative().default(0),
    aiAllowed: zod_1.z.boolean().default(false), aiAttempted: zod_1.z.boolean().default(false), fallbackUsed: zod_1.z.boolean().default(false),
    mode: zod_1.z.enum(['RULE_ONLY', 'AI_ASSISTED', 'RULE_FALLBACK']).default('RULE_ONLY'), latencyMs: zod_1.z.number().nonnegative().optional(),
    stage: zod_1.z.enum(['GAP_REVIEW', 'CONNECTION_REPAIR', 'ENRICHMENT']).optional(),
}).passthrough();
exports.FlowSuggestionsResponseSchema = zod_1.z.object({
    graphVersion: zod_1.z.number().int(), graphHash: zod_1.z.string(), reviewId: zod_1.z.string().uuid().nullable().optional(), suggestions: zod_1.z.array(exports.DeclaredStateSuggestionSchema),
    meta: exports.FlowSuggestionMetaSchema.optional(),
}).passthrough();
exports.FlowDiagramSchema = zod_1.z.object({
    kind: zod_1.z.enum(['FLOW', 'SEQUENCE', 'ACTIVITY', 'STATE_MACHINE']),
    renderer: zod_1.z.literal('MERMAID'), rendererVersion: zod_1.z.string(), source: zod_1.z.string(),
    semanticNodeIds: zod_1.z.array(zod_1.z.string()), semanticEdgeIds: zod_1.z.array(zod_1.z.string()),
});
exports.FlowReviewPreviewSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid().nullable().optional(), graphVersion: zod_1.z.number().int(), graphHash: zod_1.z.string(),
    validation: zod_1.z.object({ valid: zod_1.z.boolean(), issues: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), message: zod_1.z.string() }).passthrough()) }).passthrough(),
    diagrams: zod_1.z.array(exports.FlowDiagramSchema), proposedStates: zod_1.z.array(zod_1.z.any()), proposedTransitions: zod_1.z.array(zod_1.z.any()),
}).passthrough();
exports.FlowProjectBindingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), flowId: zod_1.z.string().uuid(), flowVersionId: zod_1.z.string().uuid(), workspaceId: zod_1.z.string().uuid(), environmentId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['PENDING_INITIALIZATION', 'INITIALIZING', 'ACTIVE', 'STALE', 'FAILED', 'REQUIRES_REBASE']),
    currentScanId: zod_1.z.string().uuid().nullable(), initializedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(), lastRescannedAt: zod_1.z.string().datetime().or(zod_1.z.date()).nullable(),
}).passthrough();
exports.FlowCheckpointSchema = zod_1.z.object({
    id: zod_1.z.string(), kind: zod_1.z.enum(['STATE', 'TRANSITION']), stateId: zod_1.z.string().nullable(), transitionId: zod_1.z.string().nullable(),
    stateRole: zod_1.z.enum(['INITIAL', 'NORMAL', 'TERMINAL']).nullable(), terminalKind: zod_1.z.string().nullable(), eventType: zod_1.z.string(),
    expectedState: zod_1.z.string().nullable(), fromCheckpointId: zod_1.z.string().nullable(), toCheckpointId: zod_1.z.string().nullable(), required: zod_1.z.boolean(),
    mapping: zod_1.z.object({ file: zod_1.z.string().nullable(), symbol: zod_1.z.string().nullable(), confidence: zod_1.z.number().min(0).max(1), rationale: zod_1.z.string() }),
});
exports.FlowInitializationManifestSchema = zod_1.z.object({
    version: zod_1.z.literal('1.0'), graphVersionId: zod_1.z.string().uuid(), graphHash: zod_1.z.string(), repositorySnapshotId: zod_1.z.string().uuid(),
    initialStateId: zod_1.z.string(), terminalStateIds: zod_1.z.array(zod_1.z.string()), paths: zod_1.z.array(zod_1.z.array(zod_1.z.string())),
    unreachableStateIds: zod_1.z.array(zod_1.z.string()), checkpoints: zod_1.z.array(exports.FlowCheckpointSchema), generatedAt: zod_1.z.string().datetime(),
});
exports.FlowCodeReviewReportSchema = zod_1.z.object({
    version: zod_1.z.literal('1.0'), kind: zod_1.z.literal('FLOW_CODE_REVIEW'), generatedAt: zod_1.z.string().datetime(), engine: zod_1.z.enum(['HYBRID', 'RULES_FALLBACK']),
    summary: zod_1.z.object({ mappedStates: zod_1.z.number().int(), totalStates: zod_1.z.number().int(), mappedTransitions: zod_1.z.number().int(), totalTransitions: zod_1.z.number().int() }),
    stateFindings: zod_1.z.array(zod_1.z.any()), transitionFindings: zod_1.z.array(zod_1.z.any()), missingStates: zod_1.z.array(zod_1.z.any()), incompleteTransitions: zod_1.z.array(zod_1.z.any()),
    edgeCases: zod_1.z.array(zod_1.z.any()), uncoveredTerminalOutcomes: zod_1.z.array(zod_1.z.any()), evidence: zod_1.z.array(zod_1.z.any()), recommendations: zod_1.z.array(zod_1.z.any()), limitations: zod_1.z.array(zod_1.z.string()),
});
exports.FlowReviewEnrichmentSchema = zod_1.z.object({
    recommendations: zod_1.z.array(zod_1.z.object({ checkpointId: zod_1.z.string(), explanation: zod_1.z.string(), priority: zod_1.z.enum(['BLOCKING', 'HIGH', 'MEDIUM', 'LOW']) })),
    edgeCaseExplanations: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), explanation: zod_1.z.string() })),
    summary: zod_1.z.string(),
});
exports.ManualRoadmapStepSchema = zod_1.z.object({
    id: zod_1.z.string(), groupId: zod_1.z.string(), kind: zod_1.z.enum(['PREREQUISITE', 'STATE', 'TRANSITION', 'TERMINAL', 'VERIFY']), title: zod_1.z.string(),
    description: zod_1.z.string(), status: zod_1.z.enum(['PENDING', 'CURRENT', 'DONE', 'VERIFIED', 'BLOCKED']), dependencies: zod_1.z.array(zod_1.z.string()),
    file: zod_1.z.string().nullable(), symbol: zod_1.z.string().nullable(), snippet: zod_1.z.string(), eventType: zod_1.z.string().nullable(), checkpointId: zod_1.z.string().nullable(),
    userCompletedAt: zod_1.z.string().datetime().nullable(), verificationEvidence: zod_1.z.array(zod_1.z.any()),
});
exports.ManualRoadmapSchema = zod_1.z.object({
    version: zod_1.z.literal('1.0'), revision: zod_1.z.number().int().positive(), groups: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), terminalKind: zod_1.z.string().nullable() })),
    steps: zod_1.z.array(exports.ManualRoadmapStepSchema), generatedAt: zod_1.z.string().datetime(),
});
exports.CheckpointCoverageSchema = zod_1.z.object({
    status: zod_1.z.enum(['NOT_STARTED', 'WAITING_FOR_INITIAL', 'RECORDING', 'COMPLETED', 'INCOMPLETE']), startedAt: zod_1.z.string().datetime().nullable(),
    observedCheckpointIds: zod_1.z.array(zod_1.z.string()), missingCheckpointIds: zod_1.z.array(zod_1.z.string()), reachedTerminalStateIds: zod_1.z.array(zod_1.z.string()),
    orderingErrors: zod_1.z.array(zod_1.z.any()), verifiedPath: zod_1.z.array(zod_1.z.string()), lastEventAt: zod_1.z.string().datetime().nullable(),
});
exports.FlowInitializationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), flowId: zod_1.z.string().uuid(), flowVersionId: zod_1.z.string().uuid(), bindingId: zod_1.z.string().uuid(), scanId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['PROPOSED', 'APPROVED', 'APPLYING', 'VALIDATING', 'COMPLETED', 'FAILED', 'ROLLED_BACK']),
    mode: zod_1.z.enum(['AUTOMATED', 'MANUAL']).nullable(),
    stage: zod_1.z.enum(['SDK_REQUIRED', 'SCANNING', 'REVIEW_READY', 'ROADMAP_READY', 'AWAITING_APPROVAL', 'APPLYING', 'AWAITING_TELEMETRY', 'COMPLETED', 'FAILED']),
    manifestVersion: zod_1.z.string(), manifest: exports.FlowInitializationManifestSchema.nullable(), reportProvenance: zod_1.z.unknown().nullable(),
    selectedTargetAdapters: zod_1.z.array(zod_1.z.string()), roadmapRevision: zod_1.z.number().int(), manualRoadmap: exports.ManualRoadmapSchema.nullable(), verification: exports.CheckpointCoverageSchema.nullable(),
    instrumentationPlanId: zod_1.z.string().uuid().nullable(), patchSetId: zod_1.z.string().uuid().nullable(), codeReviewReport: exports.FlowCodeReviewReportSchema.nullable(), validation: zod_1.z.unknown().nullable(),
}).passthrough();
exports.SourceDocumentManifestSchema = zod_1.z.object({
    filename: zod_1.z.string(),
    mimeType: zod_1.z.string(),
    kind: zod_1.z.enum(['PDF', 'DOCX', 'MARKDOWN', 'TEXT', 'HTML', 'OPENAPI']),
    checksum: zod_1.z.string(),
    processorVersion: zod_1.z.string(),
    title: zod_1.z.string(),
    summary: zod_1.z.string(),
    structure: zod_1.z.unknown(),
    redaction: zod_1.z.object({
        riskLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']),
        redactions: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), count: zod_1.z.number().int() })),
        promptInjectionDetected: zod_1.z.boolean(),
        excludedSegmentCount: zod_1.z.number().int(),
    }),
    segments: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(), heading: zod_1.z.string().nullable(), excerpt: zod_1.z.string(), locator: zod_1.z.string(), confidence: zod_1.z.number(),
        excludedFromAi: zod_1.z.boolean(), exclusionReason: zod_1.z.string().optional(),
    })),
});
exports.SourceDocumentSummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), filename: zod_1.z.string(), mimeType: zod_1.z.string(), checksum: zod_1.z.string(), uploadMode: zod_1.z.string(), status: zod_1.z.string(),
    createdAt: zod_1.z.string().or(zod_1.z.date()).optional(), updatedAt: zod_1.z.string().or(zod_1.z.date()).optional(),
    versions: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string().uuid(), version: zod_1.z.number().int(), extractedSummary: zod_1.z.unknown(), redactionSummary: zod_1.z.unknown(), structureSummary: zod_1.z.unknown().nullable(), processorVersion: zod_1.z.string() })).default([]),
    processingJobs: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string().uuid(), status: zod_1.z.string(), resultVersionId: zod_1.z.string().nullable() })).default([]),
}).passthrough();
exports.DocumentAccessSchema = zod_1.z.object({
    entitled: zod_1.z.boolean(),
    documents: zod_1.z.array(exports.SourceDocumentSummarySchema),
    accessDenied: zod_1.z.boolean().optional(),
    message: zod_1.z.string().optional(),
});
exports.AsyncJobStatusSchema = zod_1.z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);
exports.DocumentImportResultSchema = zod_1.z.object({
    filename: zod_1.z.string(), documentId: zod_1.z.string().uuid().nullable(), jobId: zod_1.z.string().uuid().nullable(),
    status: exports.AsyncJobStatusSchema.or(zod_1.z.literal('PROCESSED')), deduplicated: zod_1.z.boolean().default(false),
    versionId: zod_1.z.string().uuid().nullable(), errorMessageSafe: zod_1.z.string().nullable().default(null),
});
exports.DocumentProcessingJobSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), documentId: zod_1.z.string().uuid(), status: exports.AsyncJobStatusSchema,
    resultVersionId: zod_1.z.string().uuid().nullable(), errorMessageSafe: zod_1.z.string().nullable(),
    attempts: zod_1.z.number().int(), maxAttempts: zod_1.z.number().int(), scheduledAt: zod_1.z.string().or(zod_1.z.date()),
    startedAt: zod_1.z.string().or(zod_1.z.date()).nullable(), completedAt: zod_1.z.string().or(zod_1.z.date()).nullable(),
}).passthrough();
exports.IntentDraftJobSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), status: exports.AsyncJobStatusSchema, draftId: zod_1.z.string().uuid().nullable(),
    errorMessageSafe: zod_1.z.string().nullable(), attempts: zod_1.z.number().int(), maxAttempts: zod_1.z.number().int(),
    scheduledAt: zod_1.z.string().or(zod_1.z.date()), startedAt: zod_1.z.string().or(zod_1.z.date()).nullable(),
    completedAt: zod_1.z.string().or(zod_1.z.date()).nullable(), createdAt: zod_1.z.string().or(zod_1.z.date()).optional(),
    updatedAt: zod_1.z.string().or(zod_1.z.date()).optional(),
}).passthrough();
exports.IntentDraftJobCreatedSchema = zod_1.z.object({ jobId: zod_1.z.string().uuid(), status: exports.AsyncJobStatusSchema });
exports.IntentDraftSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), status: zod_1.z.string(), source: zod_1.z.string(), confidence: zod_1.z.number(), draftJson: zod_1.z.any(), sourceManifest: zod_1.z.any().nullable(),
    acceptedGraphId: zod_1.z.string().nullable().optional(), acceptedGraphVersionId: zod_1.z.string().nullable().optional(), createdAt: zod_1.z.string().or(zod_1.z.date()).optional(),
    evidence: zod_1.z.array(zod_1.z.any()).optional(),
}).passthrough();
exports.InstrumentationFrameworkIdSchema = zod_1.z.enum(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']);
exports.SdkTargetKindSchema = zod_1.z.enum(['FRONTEND', 'BACKEND']);
exports.SdkConnectionMethodSchema = zod_1.z.enum(['MANUAL', 'DESKTOP']);
exports.SdkTargetReadinessSchema = zod_1.z.object({
    targetId: zod_1.z.string(),
    kind: exports.SdkTargetKindSchema,
    source: zod_1.z.string(),
    configured: zod_1.z.boolean().default(false),
    processHealthy: zod_1.z.boolean(),
    sessionObserved: zod_1.z.boolean(),
    eventObserved: zod_1.z.boolean(),
    installationTestPassed: zod_1.z.boolean(),
    verified: zod_1.z.boolean(),
    lastEventAt: zod_1.z.string().datetime().nullable(),
});
exports.SdkReadinessSchema = zod_1.z.object({
    applicationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
    connected: zod_1.z.boolean(),
    codeConfigured: zod_1.z.boolean().default(false),
    readyForDemonstration: zod_1.z.boolean(),
    sessionObserved: zod_1.z.boolean(),
    eventObserved: zod_1.z.boolean(),
    installationTestPassed: zod_1.z.boolean(),
    targets: zod_1.z.array(exports.SdkTargetReadinessSchema),
});
exports.SdkSetupTargetSchema = zod_1.z.object({
    id: zod_1.z.string(),
    kind: exports.SdkTargetKindSchema,
    label: zod_1.z.string(),
    packageName: zod_1.z.enum(['@tellann/frontend-sdk', '@tellann/backend-sdk']),
    packageVersion: zod_1.z.string(),
    installCommands: zod_1.z.record(zod_1.z.string()),
    environmentVariables: zod_1.z.record(zod_1.z.string()),
    snippet: zod_1.z.string(),
});
exports.SdkSetupDescriptorSchema = zod_1.z.object({
    applicationId: zod_1.z.string().uuid(),
    applicationName: zod_1.z.string(),
    organizationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
    environmentName: zod_1.z.string(),
    environmentType: exports.EnvironmentTypeSchema,
    baseUrl: zod_1.z.string().url().nullable(),
    gatewayEndpoint: zod_1.z.string().url(),
    gatewayEndpointCustomized: zod_1.z.boolean().default(false),
    hasActiveKey: zod_1.z.boolean(),
    keyPrefix: zod_1.z.string().nullable(),
    targets: zod_1.z.array(exports.SdkSetupTargetSchema),
    readiness: exports.SdkReadinessSchema,
});
exports.DesktopSetupHandoffSchema = zod_1.z.object({
    handoffToken: zod_1.z.string().min(32),
    expiresAt: zod_1.z.string().datetime(),
    deepLink: zod_1.z.string(),
    applicationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
});
exports.InstrumentationPlanStatusSchema = zod_1.z.enum([
    'PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED',
    'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK',
]);
exports.StructuredInstrumentationCommandSchema = zod_1.z.object({
    id: zod_1.z.string(), executable: zod_1.z.string(), args: zod_1.z.array(zod_1.z.string()), cwd: zod_1.z.string(),
    timeoutMs: zod_1.z.number().int().min(1_000).max(30 * 60_000), allowedEnvironmentKeys: zod_1.z.array(zod_1.z.string()),
    purpose: zod_1.z.string(), networkRequired: zod_1.z.boolean(),
});
exports.InstrumentationOperationSchema = zod_1.z.object({
    id: zod_1.z.string(), kind: zod_1.z.enum(['CREATE_FILE', 'UPDATE_SOURCE', 'UPDATE_PACKAGE']), relativePath: zod_1.z.string(),
    symbol: zod_1.z.string().nullable(), transformId: zod_1.z.string(), transformVersion: zod_1.z.string(), expectedHash: zod_1.z.string().nullable(),
    description: zod_1.z.string(), eventMappings: zod_1.z.array(zod_1.z.object({ eventType: zod_1.z.string(), expectedState: zod_1.z.string().nullable(), checkpointId: zod_1.z.string().optional(), stateId: zod_1.z.string().nullable().optional(), transitionId: zod_1.z.string().nullable().optional(), terminalKind: zod_1.z.string().nullable().optional() })),
    flowInitializationId: zod_1.z.string().uuid().optional(),
}).passthrough();
exports.InstrumentationPlanSchema = zod_1.z.object({
    contractVersion: zod_1.z.string(), manifestVersion: zod_1.z.string(), id: zod_1.z.string().uuid(), taskKey: zod_1.z.string(),
    adapterId: exports.InstrumentationFrameworkIdSchema, adapterVersion: zod_1.z.string(), frameworkVersion: zod_1.z.string().nullable(),
    supportedVersionRange: zod_1.z.string(), baseRevision: zod_1.z.string().nullable(), repositoryFingerprint: zod_1.z.string(),
    approvedFileScopes: zod_1.z.array(zod_1.z.string()), packageChanges: zod_1.z.array(zod_1.z.object({ packageName: zod_1.z.string(), version: zod_1.z.string(), kind: zod_1.z.enum(['dependency', 'devDependency']) })),
    operations: zod_1.z.array(exports.InstrumentationOperationSchema), validationCommands: zod_1.z.array(exports.StructuredInstrumentationCommandSchema),
    networkRequirements: zod_1.z.array(zod_1.z.string()), risk: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']), riskReasons: zod_1.z.array(zod_1.z.string()),
    evidence: zod_1.z.any(), createdAt: zod_1.z.string().datetime(), status: exports.InstrumentationPlanStatusSchema.optional(),
    instrumentationPurpose: zod_1.z.enum(['BOOTSTRAP', 'FLOW']).default('BOOTSTRAP'),
    flowId: zod_1.z.string().uuid().nullable().optional(),
    flowVersionId: zod_1.z.string().uuid().nullable().optional(),
    flowInitializationId: zod_1.z.string().uuid().nullable().optional(),
    flowManifest: exports.FlowInitializationManifestSchema.nullable().optional(),
}).passthrough();
exports.InstrumentationDetectionSchema = zod_1.z.object({
    adapterId: exports.InstrumentationFrameworkIdSchema, adapterVersion: zod_1.z.string(), supported: zod_1.z.boolean(), confidence: zod_1.z.number().min(0).max(1),
    frameworkVersion: zod_1.z.string().nullable(), supportedVersionRange: zod_1.z.string(), evidence: zod_1.z.array(zod_1.z.string()), reasons: zod_1.z.array(zod_1.z.string()),
});
exports.InstrumentationApprovalSchema = zod_1.z.object({
    applicationId: zod_1.z.string().uuid(), planId: zod_1.z.string().uuid(), environmentId: zod_1.z.string().uuid(),
    approvedFileScopes: zod_1.z.array(zod_1.z.string()).min(1), approvedCommandIds: zod_1.z.array(zod_1.z.string()),
});
exports.InstrumentationApplyResultSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(), checkpointId: zod_1.z.string().uuid(), checkpointDirectory: zod_1.z.string(), baseRevision: zod_1.z.string().nullable(),
    files: zod_1.z.array(zod_1.z.object({ relativePath: zod_1.z.string(), beforeHash: zod_1.z.string().nullable(), afterHash: zod_1.z.string(), changed: zod_1.z.boolean() })),
    changedFiles: zod_1.z.array(zod_1.z.string()), diff: zod_1.z.string(), diffHash: zod_1.z.string(), appliedAt: zod_1.z.string().datetime(),
});
exports.InstrumentationValidationResultSchema = zod_1.z.object({
    valid: zod_1.z.boolean(), checks: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), passed: zod_1.z.boolean(), output: zod_1.z.string() })),
});
exports.StartGuidedRunInputSchema = zod_1.z.object({
    runId: zod_1.z.string().uuid().optional(),
    sessionId: zod_1.z.string().uuid().optional(),
    traceId: zod_1.z.string().uuid().optional(),
    applicationId: zod_1.z.string().uuid(),
    environmentId: zod_1.z.string().uuid(),
    workspaceId: zod_1.z.string().uuid().nullable(),
    flowId: zod_1.z.string().uuid(),
    flowBindingId: zod_1.z.string().uuid(),
    flowInitializationId: zod_1.z.string().uuid(),
    flowScanId: zod_1.z.string().uuid(),
    flowDriftId: zod_1.z.string().uuid().nullable().optional(),
    expectedGraphVersionId: zod_1.z.string().uuid(),
    captureTracks: zod_1.z.array(zod_1.z.enum(['FRONTEND', 'BACKEND'])).min(1).default(['FRONTEND']),
    timeoutSeconds: zod_1.z.number().int().positive().max(86_400).optional(),
    patchSetId: zod_1.z.string().uuid().nullable().optional(),
    environmentType: exports.EnvironmentTypeSchema,
    mode: zod_1.z.enum(['GUIDED', 'OBSERVATION_ONLY']).default('GUIDED'),
    targetUrl: zod_1.z.string().url(),
    productionObservationApproved: zod_1.z.boolean().optional(),
    launchCommandId: zod_1.z.string().optional(),
    launchApproved: zod_1.z.boolean().optional(),
    relayEndpoint: zod_1.z.string().url().optional(),
    relayToken: zod_1.z.string().min(32).optional(),
    agentVersion: zod_1.z.string().optional(),
});
exports.IPC = {
    getVersion: 'tellann:version',
    copyText: 'tellann:system:copy-text',
    getSession: 'tellann:auth:session',
    claimSetupHandoff: 'tellann:setup:handoff:claim',
    consumeSetupHandoff: 'tellann:setup:handoff:consume',
    getSdkSetup: 'tellann:setup:sdk:get',
    issueSdkSetupKey: 'tellann:setup:sdk:key',
    signIn: 'tellann:auth:sign-in',
    reopenSignIn: 'tellann:auth:reopen-sign-in',
    cancelSignIn: 'tellann:auth:cancel-sign-in',
    signOut: 'tellann:auth:sign-out',
    getApplications: 'tellann:cloud:applications',
    appUpdated: 'tellann:cloud:app-updated',
    listRuns: 'tellann:cloud:runs:list',
    getRun: 'tellann:cloud:runs:get',
    getRunReplay: 'tellann:cloud:runs:replay',
    getRunReport: 'tellann:cloud:runs:report',
    getDeclaredFlows: 'tellann:cloud:intent:list',
    getDeclaredFlow: 'tellann:cloud:intent:get',
    createDeclaredFlow: 'tellann:cloud:intent:create',
    addDeclaredState: 'tellann:cloud:intent:state:add',
    updateDeclaredState: 'tellann:cloud:intent:state:update',
    deleteDeclaredState: 'tellann:cloud:intent:state:delete',
    addDeclaredTransition: 'tellann:cloud:intent:transition:add',
    completeDeclaredFlow: 'tellann:cloud:intent:complete',
    reopenDeclaredFlow: 'tellann:cloud:intent:reopen',
    generateFlowSuggestions: 'tellann:cloud:intent:suggestions:generate',
    getFlowSuggestions: 'tellann:cloud:intent:suggestions:list',
    acceptFlowSuggestion: 'tellann:cloud:intent:suggestions:accept',
    rejectFlowSuggestion: 'tellann:cloud:intent:suggestions:reject',
    previewFlowReview: 'tellann:cloud:intent:review:preview',
    applyFlowReview: 'tellann:cloud:intent:review:apply',
    declineFlowReview: 'tellann:cloud:intent:review:decline',
    getFlowDiagrams: 'tellann:cloud:flow:diagrams',
    initializeFlow: 'tellann:flow:initialize',
    getFlowInitialization: 'tellann:flow:initialization:get',
    analyzeFlowInitialization: 'tellann:flow:initialization:analyze',
    setFlowInitializationMode: 'tellann:flow:initialization:mode',
    updateFlowRoadmapStep: 'tellann:flow:initialization:roadmap:step',
    startFlowVerification: 'tellann:flow:initialization:verification:start',
    getFlowVerification: 'tellann:flow:initialization:verification:get',
    rescanFlow: 'tellann:flow:rescan',
    approveFlowInitialization: 'tellann:flow:initialization:approve',
    applyFlowInitialization: 'tellann:flow:initialization:apply',
    validateFlowInitialization: 'tellann:flow:initialization:validate',
    importDocuments: 'tellann:documents:import',
    listDocuments: 'tellann:documents:list',
    getDocumentJob: 'tellann:documents:job:get',
    createIntentDraft: 'tellann:intent:draft:create',
    listIntentDraftJobs: 'tellann:intent:draft:jobs:list',
    getIntentDraftJob: 'tellann:intent:draft:job:get',
    cancelIntentDraftJob: 'tellann:intent:draft:job:cancel',
    listIntentDrafts: 'tellann:intent:draft:list',
    getIntentDraft: 'tellann:intent:draft:get',
    reviewIntentDraft: 'tellann:intent:draft:review',
    deleteIntentDraft: 'tellann:intent:draft:delete',
    correctIntentDraft: 'tellann:intent:draft:correct',
    openExternal: 'tellann:system:open-external',
    openPath: 'tellann:system:open-path',
    openProfile: 'tellann:system:open-profile',
    chooseWorkspace: 'tellann:workspace:choose',
    getLocalWorkspace: 'tellann:workspace:local-state',
    scanWorkspace: 'tellann:workspace:scan',
    cloneWorkspace: 'tellann:workspace:clone',
    startGuidedRun: 'tellann:run:start',
    pauseGuidedRun: 'tellann:run:pause',
    endGuidedRun: 'tellann:run:end',
    getRunState: 'tellann:run:state',
    detectInstrumentation: 'tellann:instrumentation:detect',
    proposeInstrumentation: 'tellann:instrumentation:propose',
    listInstrumentationPlans: 'tellann:instrumentation:plans:list',
    getInstrumentationPlan: 'tellann:instrumentation:plans:get',
    approveInstrumentation: 'tellann:instrumentation:approve',
    rejectInstrumentation: 'tellann:instrumentation:reject',
    applyInstrumentation: 'tellann:instrumentation:apply',
    validateInstrumentation: 'tellann:instrumentation:validate',
    rollbackInstrumentation: 'tellann:instrumentation:rollback',
    getLocalInstrumentationResult: 'tellann:instrumentation:local-result',
    generateInstrumentationReport: 'tellann:instrumentation:report:generate',
};
exports.DesktopSessionSchema = zod_1.z.object({
    authenticated: zod_1.z.boolean(),
    deviceSessionId: zod_1.z.string().uuid().nullable(),
    user: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        email: zod_1.z.string().email(),
        displayName: zod_1.z.string().nullable(),
    }).nullable(),
});
exports.DesktopEntitlementsSchema = zod_1.z.object({
    planType: zod_1.z.enum(['FREE', 'LOCAL', 'SOLO', 'TEAM', 'BUSINESS', 'ENTERPRISE']),
    features: zod_1.z.object({
        DESKTOP_GUIDED_RUNS: zod_1.z.boolean(),
        DOCUMENT_FLOW_INFERENCE: zod_1.z.boolean(),
        AUTOMATED_INSTRUMENTATION: zod_1.z.boolean(),
        SHARED_RUN_GOVERNANCE: zod_1.z.boolean(),
        BROWSER_TRACE_CAPTURE: zod_1.z.boolean(),
        VISUAL_ACCESSIBILITY_ANALYSIS: zod_1.z.boolean(),
    }),
});
exports.DesktopApplicationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    summary: zod_1.z.string().nullable().optional(),
    organizationId: zod_1.z.string().uuid(),
    organizationName: zod_1.z.string(),
    entitlements: exports.DesktopEntitlementsSchema.nullable(),
    environments: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        type: exports.EnvironmentTypeSchema,
        baseUrl: zod_1.z.string().nullable().optional(),
    })),
    projectWorkspaces: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        opaqueLocalId: zod_1.z.string(),
        repositoryFingerprint: zod_1.z.string(),
        repositoryOriginHash: zod_1.z.string().nullable().optional(),
        repositoryCloneUrl: zod_1.z.string().url().nullable().optional(),
        packageManager: zod_1.z.string().nullable().optional(),
        detectedStack: zod_1.z.any().optional(),
        snapshots: zod_1.z.array(zod_1.z.any()).optional(),
    })).optional(),
});
