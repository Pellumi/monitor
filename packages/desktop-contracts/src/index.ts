import { z } from 'zod';

export const DESKTOP_CONTRACT_VERSION = '1.0';

export const EnvironmentTypeSchema = z.enum(['DEVELOPMENT', 'STAGING', 'PRODUCTION']);
export const PermissionTypeSchema = z.enum([
  'BROWSER_ONLY',
  'READ_WORKSPACE',
  'PROPOSE_INSTRUMENTATION',
  'APPLY_TASK',
  'RUN_COMMANDS',
  'SENSITIVE_BROWSER_ACTIONS',
  'MANAGE_QA_BRANCH',
]);
export const RunStatusSchema = z.enum([
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
export const ArtifactTypeSchema = z.enum([
  'SCREENSHOT',
  'PLAYWRIGHT_TRACE',
  'ACCESSIBILITY_SNAPSHOT',
  'CONSOLE_LOG',
  'NETWORK_LOG',
  'RUN_MANIFEST',
]);
export const PrivacyClassificationSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'SENSITIVE',
  'RESTRICTED',
]);

export const DesktopDeviceSchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string().min(1).max(120),
  platform: z.string().min(1),
  appVersion: z.string().min(1),
  scopes: z.array(z.string()),
  lastSeenAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export const DesktopPermissionSchema = z.object({
  type: PermissionTypeSchema,
  workspaceId: z.string().uuid().optional(),
  fileScopes: z.array(z.string()).default([]),
  commandScopes: z.array(z.string()).default([]),
  purpose: z.string().min(1).max(500),
  expiresAt: z.string().datetime().nullable().default(null),
});

export const FrameworkEvidenceSchema = z.object({
  framework: z.string(),
  version: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export const RepositorySnapshotSummarySchema = z.object({
  workspaceId: z.string().uuid(),
  revision: z.string().nullable(),
  branch: z.string().nullable(),
  dirty: z.boolean(),
  repositoryFingerprint: z.string().min(32),
  portableManifestIdentity: z.string().min(32).nullable().optional(),
  repositoryOriginHash: z.string().min(32).nullable().optional(),
  repositoryCloneUrl: z.string().url().nullable().optional(),
  upstreamBranch: z.string().nullable().optional(),
  aheadCount: z.number().int().nonnegative().nullable().optional(),
  behindCount: z.number().int().nonnegative().nullable().optional(),
  languages: z.array(z.string()),
  packageManager: z.string().nullable(),
  launchCommands: z.array(z.object({
    id: z.string(),
    label: z.string(),
    executable: z.string(),
    args: z.array(z.string()),
    cwd: z.string(),
    scriptName: z.string(),
  })).optional(),
  suggestedApplicationUrls: z.array(z.object({
    url: z.string().url(),
    confidence: z.number().min(0).max(1),
    source: z.string(),
  })).optional(),
  frameworks: z.array(FrameworkEvidenceSchema),
  routes: z.array(z.string()),
  endpoints: z.array(z.string()),
  documentation: z.array(z.string()),
  manifestHashes: z.record(z.string()),
  scannerVersion: z.string(),
  redactionSummary: z.object({
    excludedFiles: z.number().int().nonnegative(),
    suspectedSecrets: z.number().int().nonnegative(),
  }),
});

export const CodebaseAnalysisStatusSchema = z.enum([
  'QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
  'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED',
]);

export const CodeEntityTypeSchema = z.enum([
  'repository', 'application', 'service', 'package', 'directory', 'file', 'module',
  'class', 'interface', 'function', 'method', 'test', 'ui_route', 'ui_action',
  'endpoint', 'database_model', 'database_table', 'event', 'queue', 'job',
  'external_service', 'domain', 'feature', 'workflow',
]);

export const CodeRelationshipTypeSchema = z.enum([
  'CONTAINS', 'DEFINES', 'IMPORTS', 'EXPORTS', 'CALLS', 'USES', 'IMPLEMENTS',
  'EXTENDS', 'ROUTES_TO', 'READS', 'WRITES', 'PUBLISHES', 'SUBSCRIBES_TO',
  'HANDLED_BY', 'DEPENDS_ON', 'TESTS', 'CONFIGURES', 'BELONGS_TO_DOMAIN',
  'IMPLEMENTS_FEATURE', 'CALLS_EXTERNAL',
]);

export const CodeEvidenceSchema = z.object({
  kind: z.string(),
  path: z.string(),
  startLine: z.number().int().positive().nullable().default(null),
  endLine: z.number().int().positive().nullable().default(null),
  symbol: z.string().nullable().default(null),
  excerpt: z.string().max(2_000).nullable().default(null),
  analyzer: z.string(),
  confidence: z.number().min(0).max(1),
});

export const CodeEntitySchema = z.object({
  id: z.string(),
  type: CodeEntityTypeSchema,
  name: z.string(),
  path: z.string().nullable().default(null),
  startLine: z.number().int().positive().nullable().default(null),
  endLine: z.number().int().positive().nullable().default(null),
  language: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).default({}),
  evidence: z.array(CodeEvidenceSchema).default([]),
});

export const CodeRelationshipSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: CodeRelationshipTypeSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(CodeEvidenceSchema).default([]),
});

export const SoftwareFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  domain: z.string(),
  triggers: z.array(z.string()),
  entrypoints: z.array(z.string()),
  workflow: z.array(z.object({ entityId: z.string(), label: z.string() })),
  reads: z.array(z.string()),
  writes: z.array(z.string()),
  externalServices: z.array(z.string()),
  emittedEvents: z.array(z.string()),
  downstreamEffects: z.array(z.string()),
  authorization: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(CodeEvidenceSchema),
});

export const CodebaseFindingSchema = z.object({
  id: z.string(),
  kind: z.enum(['CYCLE', 'COUPLING', 'UNRESOLVED_REFERENCE', 'STALE_DOCUMENTATION', 'DYNAMIC_CODE', 'UNSUPPORTED_LANGUAGE']),
  severity: z.enum(['INFO', 'WARNING', 'HIGH']),
  title: z.string(),
  description: z.string(),
  entityIds: z.array(z.string()),
  evidence: z.array(CodeEvidenceSchema),
});

export const CouplingRecordSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  path: z.string().nullable(),
  fanIn: z.number().int().nonnegative(),
  fanOut: z.number().int().nonnegative(),
  instability: z.number().min(0).max(1),
  centrality: z.number().min(0).max(1),
});

export const ArchitectureReportSchema = z.object({
  metrics: z.object({
    modules: z.number().int().nonnegative(),
    domains: z.number().int().nonnegative(),
    cycles: z.number().int().nonnegative(),
    stronglyConnectedComponents: z.number().int().nonnegative(),
    averageFanIn: z.number().nonnegative(),
    averageFanOut: z.number().nonnegative(),
    maxFanIn: z.number().int().nonnegative(),
    orphanModules: z.number().int().nonnegative(),
    unresolvedCallRatio: z.number().min(0).max(1),
  }),
  coupling: z.array(CouplingRecordSchema),
  hotspots: z.array(CouplingRecordSchema),
  domains: z.array(z.object({
    id: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    signals: z.array(z.string()),
  })),
});

/** How much of the repository the deep analyzers actually reached. */
export const AnalysisCoverageSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  analyzableFiles: z.number().int().nonnegative(),
  analyzedFiles: z.number().int().nonnegative(),
  unsupportedLanguageFiles: z.record(z.number().int().nonnegative()),
  excludedByReason: z.record(z.number().int().nonnegative()),
  languageBytes: z.record(z.number().int().nonnegative()),
  /** Share of call sites reaching a declaration inside this repository. */
  internalCallRatio: z.number().min(0).max(1),
  /** Share reaching a dependency. Correct resolution, not a coverage gap. */
  externalCallRatio: z.number().min(0).max(1),
  /** Share where no declaration was found at all: the graph is blind here. */
  unresolvedCallRatio: z.number().min(0).max(1),
  internalImportRatio: z.number().min(0).max(1),
  unresolvedImportRatio: z.number().min(0).max(1),
  truncated: z.boolean(),
});

export const IncrementalReportSchema = z.object({
  mode: z.enum(['full', 'incremental', 'unchanged']),
  reason: z.string(),
  reusedFiles: z.number().int().nonnegative(),
  reanalyzedFiles: z.number().int().nonnegative(),
  addedFiles: z.array(z.string()),
  modifiedFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  invalidatedDependents: z.number().int().nonnegative(),
});

/** Provenance for any text a language model produced. */
export const AiExplanationSchema = z.object({
  featureId: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  confidence: z.number().min(0).max(1),
  grounded: z.boolean(),
});

export const CodebaseAnalysisSchema = z.object({
  id: z.string(),
  workspaceId: z.string().uuid(),
  repositoryFingerprint: z.string(),
  graphVersion: z.string(),
  analyzerVersions: z.record(z.string()),
  status: CodebaseAnalysisStatusSchema,
  progress: z.number().min(0).max(100),
  stageMessage: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  /** Exact revision analysed; null for a checkout with no Git history. */
  revision: z.string().nullable().default(null),
  branch: z.string().nullable().default(null),
  dirty: z.boolean().default(false),
  /** Content hash of the analysed working tree, so dirty states stay distinct. */
  contentHash: z.string().default(''),
  entities: z.array(CodeEntitySchema),
  relationships: z.array(CodeRelationshipSchema),
  features: z.array(SoftwareFeatureSchema),
  findings: z.array(CodebaseFindingSchema),
  architecture: ArchitectureReportSchema.nullable().default(null),
  coverage: AnalysisCoverageSchema.nullable().default(null),
  incremental: IncrementalReportSchema.nullable().default(null),
  explanations: z.array(AiExplanationSchema).default([]),
  summary: z.object({
    files: z.number().int().nonnegative(),
    symbols: z.number().int().nonnegative(),
    relationships: z.number().int().nonnegative(),
    applications: z.number().int().nonnegative(),
    services: z.number().int().nonnegative(),
    domains: z.number().int().nonnegative(),
    features: z.number().int().nonnegative(),
    endpoints: z.number().int().nonnegative().default(0),
    dataModels: z.number().int().nonnegative().default(0),
    events: z.number().int().nonnegative().default(0),
    externalServices: z.number().int().nonnegative().default(0),
    tests: z.number().int().nonnegative().default(0),
    coveragePercent: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
  }),
  /** Genuine coverage gaps. A non-empty list is what makes an analysis PARTIAL. */
  warnings: z.array(z.string()),
  /** Informational: policies that applied, not gaps in the result. */
  notices: z.array(z.string()).default([]),
});

export const AnalysisChangeSchema = z.object({
  kind: z.enum(['ADDED', 'REMOVED', 'CHANGED']),
  category: z.enum(['entity', 'dependency', 'feature', 'domain', 'endpoint', 'external', 'architecture']),
  label: z.string(),
  detail: z.string(),
  entityId: z.string().nullable(),
});

export const AnalysisComparisonSchema = z.object({
  fromAnalysisId: z.string(),
  toAnalysisId: z.string(),
  fromRevision: z.string().nullable(),
  toRevision: z.string().nullable(),
  changes: z.array(AnalysisChangeSchema),
  summary: z.object({
    entitiesAdded: z.number().int().nonnegative(),
    entitiesRemoved: z.number().int().nonnegative(),
    featuresAdded: z.number().int().nonnegative(),
    featuresRemoved: z.number().int().nonnegative(),
    featuresChanged: z.number().int().nonnegative(),
    domainsAdded: z.number().int().nonnegative(),
    domainsRemoved: z.number().int().nonnegative(),
    endpointsAdded: z.number().int().nonnegative(),
    endpointsRemoved: z.number().int().nonnegative(),
    externalsAdded: z.number().int().nonnegative(),
    externalsRemoved: z.number().int().nonnegative(),
  }),
});

export const BlastRadiusSchema = z.object({
  entityId: z.string(),
  affected: z.object({
    modules: z.number().int().nonnegative(),
    functions: z.number().int().nonnegative(),
    endpoints: z.number().int().nonnegative(),
    jobs: z.number().int().nonnegative(),
    tests: z.number().int().nonnegative(),
    features: z.number().int().nonnegative(),
  }),
  entityIds: z.array(z.string()),
  truncated: z.boolean(),
});

export const GraphProjectionQuerySchema = z.object({
  view: z.enum(['hierarchy', 'dependencies', 'architecture', 'features', 'data', 'events', 'external', 'all']).default('all'),
  granularity: z.enum(['repository', 'application', 'service', 'package', 'module', 'file', 'class', 'function', 'domain', 'feature']).default('file'),
  types: z.array(CodeEntityTypeSchema).max(30).default([]),
  relationshipTypes: z.array(CodeRelationshipTypeSchema).max(30).default([]),
  rootId: z.string().nullable().default(null),
  search: z.string().max(200).default(''),
  depth: z.number().int().min(1).max(8).default(1),
  limit: z.number().int().min(1).max(2_000).default(250),
  direction: z.enum(['out', 'in', 'both']).default('both'),
});

export const GraphProjectionSchema = z.object({
  nodes: z.array(CodeEntitySchema),
  edges: z.array(CodeRelationshipSchema),
  truncated: z.boolean(),
  totalMatched: z.number().int().nonnegative().default(0),
});

export type CodebaseAnalysisStatus = z.infer<typeof CodebaseAnalysisStatusSchema>;
export type CodeEvidence = z.infer<typeof CodeEvidenceSchema>;
export type CodeEntity = z.infer<typeof CodeEntitySchema>;
export type CodeRelationship = z.infer<typeof CodeRelationshipSchema>;
export type SoftwareFeature = z.infer<typeof SoftwareFeatureSchema>;
export type CodebaseFinding = z.infer<typeof CodebaseFindingSchema>;
export type CodebaseAnalysis = z.infer<typeof CodebaseAnalysisSchema>;
export type CouplingRecord = z.infer<typeof CouplingRecordSchema>;
export type ArchitectureReport = z.infer<typeof ArchitectureReportSchema>;
export type AnalysisCoverage = z.infer<typeof AnalysisCoverageSchema>;
export type IncrementalReport = z.infer<typeof IncrementalReportSchema>;
export type AiExplanation = z.infer<typeof AiExplanationSchema>;
export type AnalysisChange = z.infer<typeof AnalysisChangeSchema>;
export type AnalysisComparison = z.infer<typeof AnalysisComparisonSchema>;
export type BlastRadiusResult = z.infer<typeof BlastRadiusSchema>;
export type GraphProjectionQuery = z.infer<typeof GraphProjectionQuerySchema>;
export type GraphProjection = z.infer<typeof GraphProjectionSchema>;

export const BranchPolicyEnforcementSchema = z.enum(['WARN', 'BLOCK']);

/** The org-owned repository binding an application's members all share. */
export const BranchPolicySchema = z.object({
  applicationId: z.string().uuid(),
  repositoryOriginHash: z.string().nullable(),
  repositoryCloneUrl: z.string().nullable(),
  qaBranchName: z.string(),
  qaBranchBase: z.string(),
  enforcement: BranchPolicyEnforcementSchema,
  allowAgentCheckout: z.boolean(),
  /** True once a repository has actually been bound to the application. */
  bound: z.boolean(),
  /**
   * Whether the member viewing this policy is an Owner or Admin of the owning
   * organisation, and may therefore toggle `allowAgentCheckout` themselves.
   * Only populated by the desktop `branch-policy` endpoint; absent elsewhere.
   */
  canManageBranchPolicy: z.boolean().optional(),
});

export const WorkspaceComplianceStatusSchema = z.enum([
  'COMPLIANT',
  'BRANCH_MISMATCH',
  'NOT_A_REPOSITORY',
  'NO_POLICY',
  'UNKNOWN',
]);

/**
 * Whether one member's checkout satisfies the shared QA branch policy. Evaluated
 * locally so it still works offline; the server re-derives it on snapshot ingest.
 */
export const WorkspaceComplianceSchema = z.object({
  status: WorkspaceComplianceStatusSchema,
  policy: BranchPolicySchema.nullable(),
  currentBranch: z.string().nullable(),
  requiredBranch: z.string().nullable(),
  dirty: z.boolean(),
  aheadCount: z.number().int().nullable(),
  behindCount: z.number().int().nullable(),
  /** BLOCK enforcement plus a mismatch is the only combination that stops a run. */
  blocksRun: z.boolean(),
  /** Whether the org allows Tellann to perform the switch on the member's behalf. */
  agentCheckoutAllowed: z.boolean(),
  /** Whether an unexpired MANAGE_QA_BRANCH grant already exists for this workspace. */
  agentCheckoutGranted: z.boolean(),
  /**
   * Whether this member is an Owner or Admin and can turn agent checkout on or
   * off for the whole application from the desktop app itself.
   */
  canManageBranchPolicy: z.boolean(),
  message: z.string(),
});

export const QaBranchSwitchResultSchema = z.object({
  switched: z.boolean(),
  branch: z.string().nullable(),
  previousBranch: z.string().nullable(),
  baseRevision: z.string().nullable(),
  /** Set when pre-existing uncommitted work was stashed to make the switch safe. */
  stashRef: z.string().nullable(),
  createdBranch: z.boolean(),
  fetched: z.boolean(),
  reason: z.string().nullable(),
});

export const RunCorrelationContextSchema = z.object({
  runId: z.string().uuid(),
  sessionId: z.string().uuid(),
  traceId: z.string().uuid(),
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  expectedGraphVersionId: z.string().uuid().nullable(),
  agentVersion: z.string(),
});

export const QARunArtifactSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  type: ArtifactTypeSchema,
  privacyClassification: PrivacyClassificationSchema,
  objectKey: z.string().nullable(),
  localPath: z.string().nullable(),
  bytes: z.number().int().nonnegative(),
  checksum: z.string(),
  capturedAt: z.string().datetime(),
});

export const BrowserFindingSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  category: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  confidence: z.number().min(0).max(1),
  title: z.string(),
  description: z.string(),
  url: z.string().url().nullable(),
  viewport: z.object({ width: z.number().int(), height: z.number().int() }).nullable(),
  evidenceArtifactIds: z.array(z.string().uuid()),
  reproductionSteps: z.array(z.string()),
  recommendation: z.string().nullable(),
});

export const QARunSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  deviceSessionId: z.string().uuid().nullable(),
  expectedGraphVersionId: z.string().uuid().nullable(),
  flowId: z.string().uuid().nullable(),
  flowBindingId: z.string().uuid().nullable(),
  flowInitializationId: z.string().uuid().nullable(),
  flowScanId: z.string().uuid().nullable(),
  flowDriftId: z.string().uuid().nullable().optional(),
  captureTracks: z.array(z.enum(['FRONTEND', 'BACKEND'])).min(1),
  initialStateKey: z.string().nullable(),
  terminalStateKeys: z.array(z.string()),
  lastObservedStateKey: z.string().nullable().optional(),
  boundaryStartedAt: z.string().datetime().nullable().optional(),
  boundaryCompletedAt: z.string().datetime().nullable().optional(),
  completionReason: z.string().nullable().optional(),
  mode: z.enum(['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY']),
  status: RunStatusSchema,
  targetUrl: z.string().url(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
});

export const QARunSummarySchema = QARunSchema.extend({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  environment: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: EnvironmentTypeSchema,
  }).optional(),
  artifactCount: z.number().int().nonnegative().default(0),
  findingCount: z.number().int().nonnegative().default(0),
  reportId: z.string().nullable().optional(),
});

export const QualityReportSchema = z.object({
  id: z.string(),
  runId: z.string().uuid(),
  status: RunStatusSchema,
  generatedAt: z.string().datetime(),
  application: z.object({ id: z.string().uuid(), name: z.string() }),
  environment: z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: EnvironmentTypeSchema,
  }),
  flow: z.object({
    id: z.string().uuid(), versionId: z.string().uuid(), version: z.number().int(), name: z.string(),
    purpose: z.string().nullable(), scopeStatement: z.string().nullable(), initialStateKey: z.string(), terminalStateKeys: z.array(z.string()),
  }).nullable(),
  boundary: z.object({
    status: RunStatusSchema, startedAt: z.string().datetime().or(z.date()).nullable(), completedAt: z.string().datetime().or(z.date()).nullable(),
    lastObservedStateKey: z.string().nullable(), completionReason: z.string().nullable(), timeoutAt: z.string().datetime().or(z.date()).nullable(),
    acceptedEvents: z.array(z.unknown()), quarantinedEvents: z.array(z.unknown()),
  }),
  captureTracks: z.array(z.enum(['FRONTEND', 'BACKEND'])),
  correlation: z.object({
    runId: z.string().uuid(),
    sessions: z.array(z.object({
      sessionId: z.string().uuid(),
      traceId: z.string().nullable(),
      startedAt: z.string().datetime(),
      endedAt: z.string().datetime().nullable(),
    })),
  }),
  repository: z.object({
    revision: z.string().nullable(),
    dirty: z.boolean(),
    scannerVersion: z.string(),
    redactionSummary: z.unknown(),
  }).nullable(),
  instrumentation: z.object({
    patchSetId: z.string().uuid(), planId: z.string().uuid(), adapterId: z.enum(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']),
    adapterVersion: z.string(), manifestVersion: z.string(), status: z.string(), risk: z.string(),
    changedFileHashes: z.unknown(), validation: z.unknown().nullable(),
    appliedAt: z.string().datetime().or(z.date()).nullable(), validatedAt: z.string().datetime().or(z.date()).nullable(),
  }).nullable().optional(),
  expectedIntent: z.object({
    graphId: z.string().uuid(), graphVersionId: z.string().uuid(), graphName: z.string(), provenance: z.string(),
    evidenceManifest: z.unknown().nullable(), expectedStateCount: z.number().int().nullable(), expectedTransitionCount: z.number().int().nullable(),
  }).nullable().optional(),
  coverage: z.object({
    expected: z.number().nullable(),
    reconciledFlows: z.number().int().nonnegative(),
  }),
  findings: z.array(z.unknown()),
  artifacts: z.array(z.unknown()),
  summary: z.object({
    sessionCount: z.number().int().nonnegative(),
    observedStateCount: z.number().int().nonnegative(),
    observedTransitionCount: z.number().int().nonnegative(),
    artifactCount: z.number().int().nonnegative(),
    findingCount: z.number().int().nonnegative(),
    criticalOrHighFindings: z.number().int().nonnegative(),
  }),
}).passthrough();

export const DeclaredFlowSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SUPERSEDED']).optional(),
  purpose: z.string().nullable().optional(),
  scopeStatement: z.string().nullable().optional(),
  exclusions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  publishedVersionId: z.string().uuid().nullable().optional(),
  version: z.number().int().optional(),
  updatedAt: z.string().datetime().optional(),
  versions: z.array(z.object({ id: z.string().uuid(), version: z.number().int(), isBaseline: z.boolean().optional() })).optional(),
}).passthrough();

export const DeclaredStateSchema = z.object({
  id: z.string().uuid(),
  stateName: z.string(),
  category: z.string(),
  provenance: z.string(),
  role: z.enum(['NORMAL', 'INITIAL', 'TERMINAL']).default('NORMAL'),
  terminalKind: z.enum(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']).nullable().optional(),
  canonicalBehavior: z.string().nullable().optional(),
}).passthrough();

export const DeclaredTransitionSchema = z.object({
  id: z.string().uuid(),
  fromStateId: z.string().uuid(),
  toStateId: z.string().uuid(),
  action: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  provenance: z.string(),
  fromState: DeclaredStateSchema.optional(),
  toState: DeclaredStateSchema.optional(),
}).passthrough();

export const DeclaredFlowDetailSchema = DeclaredFlowSummarySchema.extend({
  workflowType: z.string(),
  states: z.array(DeclaredStateSchema).default([]),
  transitions: z.array(DeclaredTransitionSchema).default([]),
});

export const DeclaredSuggestionStateSchema = z.object({
  name: z.string(), category: z.string(), role: z.enum(['INITIAL', 'NORMAL', 'TERMINAL']).optional(),
  terminalKind: z.enum(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']).nullable().optional(),
});
export const DeclaredSuggestionTransitionSchema = z.object({
  from: z.string(), to: z.string(), action: z.string().nullable().optional(),
});
export const DeclaredStateSuggestionSchema = z.object({
  id: z.string().uuid(), suggestedStateName: z.string(), category: z.string(), rationale: z.string(),
  title: z.string().nullable().optional(), description: z.string().nullable().optional(),
  source: z.enum(['RULE_ENGINE', 'AI', 'HYBRID']).default('RULE_ENGINE'), sourceTier: z.string(),
  confidence: z.number().min(0).max(1), severity: z.string(), status: z.string(),
  graphVersion: z.number().int().nullable().optional(), graphHash: z.string().nullable().optional(),
  reviewId: z.string().uuid().nullable().optional(),
  suggestedStatesJson: z.array(DeclaredSuggestionStateSchema).nullable().optional(),
  suggestedTransitionsJson: z.array(DeclaredSuggestionTransitionSchema).nullable().optional(),
}).passthrough();
export const FlowSuggestionMetaSchema = z.object({
  ruleCount: z.number().int().nonnegative().default(0), aiCount: z.number().int().nonnegative().default(0),
  aiAllowed: z.boolean().default(false), aiAttempted: z.boolean().default(false), fallbackUsed: z.boolean().default(false),
  mode: z.enum(['RULE_ONLY', 'AI_ASSISTED', 'RULE_FALLBACK']).default('RULE_ONLY'), latencyMs: z.number().nonnegative().optional(),
  stage: z.enum(['GAP_REVIEW', 'CONNECTION_REPAIR', 'ENRICHMENT']).optional(),
}).passthrough();
export const FlowSuggestionsResponseSchema = z.object({
  graphVersion: z.number().int(), graphHash: z.string(), reviewId: z.string().uuid().nullable().optional(), suggestions: z.array(DeclaredStateSuggestionSchema),
  meta: FlowSuggestionMetaSchema.optional(),
}).passthrough();
export const FlowDiagramSchema = z.object({
  kind: z.enum(['FLOW', 'SEQUENCE', 'ACTIVITY', 'STATE_MACHINE']),
  renderer: z.literal('MERMAID'), rendererVersion: z.string(), source: z.string(),
  semanticNodeIds: z.array(z.string()), semanticEdgeIds: z.array(z.string()),
});

export const FlowReviewPreviewSchema = z.object({
  reviewId: z.string().uuid().nullable().optional(), graphVersion: z.number().int(), graphHash: z.string(),
  validation: z.object({ valid: z.boolean(), issues: z.array(z.object({ code: z.string(), message: z.string() }).passthrough()) }).passthrough(),
  diagrams: z.array(FlowDiagramSchema), proposedStates: z.array(z.any()), proposedTransitions: z.array(z.any()),
}).passthrough();

export const FlowProjectBindingSchema = z.object({
  id: z.string().uuid(), flowId: z.string().uuid(), flowVersionId: z.string().uuid(), workspaceId: z.string().uuid(), environmentId: z.string().uuid(),
  status: z.enum(['PENDING_INITIALIZATION', 'INITIALIZING', 'ACTIVE', 'STALE', 'FAILED', 'REQUIRES_REBASE']),
  currentScanId: z.string().uuid().nullable(), initializedAt: z.string().datetime().or(z.date()).nullable(), lastRescannedAt: z.string().datetime().or(z.date()).nullable(),
}).passthrough();

export const FlowCheckpointSchema = z.object({
  id: z.string(), kind: z.enum(['STATE', 'TRANSITION']), stateId: z.string().nullable(), transitionId: z.string().nullable(),
  stateRole: z.enum(['INITIAL', 'NORMAL', 'TERMINAL']).nullable(), terminalKind: z.string().nullable(), eventType: z.string(),
  expectedState: z.string().nullable(), fromCheckpointId: z.string().nullable(), toCheckpointId: z.string().nullable(), required: z.boolean(),
  mapping: z.object({ file: z.string().nullable(), symbol: z.string().nullable(), confidence: z.number().min(0).max(1), rationale: z.string() }),
});
export const FlowInitializationManifestSchema = z.object({
  version: z.literal('1.0'), graphVersionId: z.string().uuid(), graphHash: z.string(), repositorySnapshotId: z.string().uuid(),
  initialStateId: z.string(), terminalStateIds: z.array(z.string()), paths: z.array(z.array(z.string())),
  unreachableStateIds: z.array(z.string()), checkpoints: z.array(FlowCheckpointSchema), generatedAt: z.string().datetime(),
});
export const FlowCodeReviewReportSchema = z.object({
  version: z.literal('1.0'), kind: z.literal('FLOW_CODE_REVIEW'), generatedAt: z.string().datetime(), engine: z.enum(['HYBRID', 'RULES_FALLBACK']),
  summary: z.object({ mappedStates: z.number().int(), totalStates: z.number().int(), mappedTransitions: z.number().int(), totalTransitions: z.number().int() }),
  stateFindings: z.array(z.any()), transitionFindings: z.array(z.any()), missingStates: z.array(z.any()), incompleteTransitions: z.array(z.any()),
  edgeCases: z.array(z.any()), uncoveredTerminalOutcomes: z.array(z.any()), evidence: z.array(z.any()), recommendations: z.array(z.any()), limitations: z.array(z.string()),
});
export const FlowReviewEnrichmentSchema = z.object({
  recommendations: z.array(z.object({ checkpointId: z.string(), explanation: z.string(), priority: z.enum(['BLOCKING', 'HIGH', 'MEDIUM', 'LOW']) })),
  edgeCaseExplanations: z.array(z.object({ code: z.string(), explanation: z.string() })),
  summary: z.string(),
});
export const ManualRoadmapStepSchema = z.object({
  id: z.string(), groupId: z.string(), kind: z.enum(['PREREQUISITE', 'STATE', 'TRANSITION', 'TERMINAL', 'VERIFY']), title: z.string(),
  description: z.string(), status: z.enum(['PENDING', 'CURRENT', 'DONE', 'VERIFIED', 'BLOCKED']), dependencies: z.array(z.string()),
  file: z.string().nullable(), symbol: z.string().nullable(), snippet: z.string(), eventType: z.string().nullable(), checkpointId: z.string().nullable(),
  userCompletedAt: z.string().datetime().nullable(), verificationEvidence: z.array(z.any()),
});
export const ManualRoadmapSchema = z.object({
  version: z.literal('1.0'), revision: z.number().int().positive(), groups: z.array(z.object({ id: z.string(), title: z.string(), terminalKind: z.string().nullable() })),
  steps: z.array(ManualRoadmapStepSchema), generatedAt: z.string().datetime(),
});
export const CheckpointCoverageSchema = z.object({
  status: z.enum(['NOT_STARTED', 'WAITING_FOR_INITIAL', 'RECORDING', 'COMPLETED', 'INCOMPLETE']), startedAt: z.string().datetime().nullable(),
  observedCheckpointIds: z.array(z.string()), missingCheckpointIds: z.array(z.string()), reachedTerminalStateIds: z.array(z.string()),
  orderingErrors: z.array(z.any()), verifiedPath: z.array(z.string()), lastEventAt: z.string().datetime().nullable(),
});

export const FlowInitializationSchema = z.object({
  id: z.string().uuid(), flowId: z.string().uuid(), flowVersionId: z.string().uuid(), bindingId: z.string().uuid(), scanId: z.string().uuid(),
  status: z.enum(['PROPOSED', 'APPROVED', 'APPLYING', 'VALIDATING', 'COMPLETED', 'FAILED', 'ROLLED_BACK']),
  mode: z.enum(['AUTOMATED', 'MANUAL']).nullable(),
  stage: z.enum(['SDK_REQUIRED', 'SCANNING', 'REVIEW_READY', 'ROADMAP_READY', 'AWAITING_APPROVAL', 'APPLYING', 'AWAITING_TELEMETRY', 'COMPLETED', 'FAILED']),
  manifestVersion: z.string(), manifest: FlowInitializationManifestSchema.nullable(), reportProvenance: z.unknown().nullable(),
  selectedTargetAdapters: z.array(z.string()), roadmapRevision: z.number().int(), manualRoadmap: ManualRoadmapSchema.nullable(), verification: CheckpointCoverageSchema.nullable(),
  instrumentationPlanId: z.string().uuid().nullable(), patchSetId: z.string().uuid().nullable(), codeReviewReport: FlowCodeReviewReportSchema.nullable(), validation: z.unknown().nullable(),
}).passthrough();

export const SourceDocumentManifestSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  kind: z.enum(['PDF', 'DOCX', 'MARKDOWN', 'TEXT', 'HTML', 'OPENAPI']),
  checksum: z.string(),
  processorVersion: z.string(),
  title: z.string(),
  summary: z.string(),
  structure: z.unknown(),
  redaction: z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    redactions: z.array(z.object({ type: z.string(), count: z.number().int() })),
    promptInjectionDetected: z.boolean(),
    excludedSegmentCount: z.number().int(),
  }),
  segments: z.array(z.object({
    id: z.string(), heading: z.string().nullable(), excerpt: z.string(), locator: z.string(), confidence: z.number(),
    excludedFromAi: z.boolean(), exclusionReason: z.string().optional(),
  })),
});

export const SourceDocumentSummarySchema = z.object({
  id: z.string().uuid(), filename: z.string(), mimeType: z.string(), checksum: z.string(), uploadMode: z.string(), status: z.string(),
  createdAt: z.string().or(z.date()).optional(), updatedAt: z.string().or(z.date()).optional(),
  versions: z.array(z.object({ id: z.string().uuid(), version: z.number().int(), extractedSummary: z.unknown(), redactionSummary: z.unknown(), structureSummary: z.unknown().nullable(), processorVersion: z.string() })).default([]),
  processingJobs: z.array(z.object({ id: z.string().uuid(), status: z.string(), resultVersionId: z.string().nullable() })).default([]),
}).passthrough();

export const DocumentAccessSchema = z.object({
  entitled: z.boolean(),
  documents: z.array(SourceDocumentSummarySchema),
  accessDenied: z.boolean().optional(),
  message: z.string().optional(),
});

export const AsyncJobStatusSchema = z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);
export const DocumentImportResultSchema = z.object({
  filename: z.string(), documentId: z.string().uuid().nullable(), jobId: z.string().uuid().nullable(),
  status: AsyncJobStatusSchema.or(z.literal('PROCESSED')), deduplicated: z.boolean().default(false),
  versionId: z.string().uuid().nullable(), errorMessageSafe: z.string().nullable().default(null),
});
export const DocumentProcessingJobSchema = z.object({
  id: z.string().uuid(), documentId: z.string().uuid(), status: AsyncJobStatusSchema,
  resultVersionId: z.string().uuid().nullable(), errorMessageSafe: z.string().nullable(),
  attempts: z.number().int(), maxAttempts: z.number().int(), scheduledAt: z.string().or(z.date()),
  startedAt: z.string().or(z.date()).nullable(), completedAt: z.string().or(z.date()).nullable(),
}).passthrough();
export const IntentDraftJobSchema = z.object({
  id: z.string().uuid(), status: AsyncJobStatusSchema, draftId: z.string().uuid().nullable(),
  errorMessageSafe: z.string().nullable(), attempts: z.number().int(), maxAttempts: z.number().int(),
  scheduledAt: z.string().or(z.date()), startedAt: z.string().or(z.date()).nullable(),
  completedAt: z.string().or(z.date()).nullable(), createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
}).passthrough();
export const IntentDraftJobCreatedSchema = z.object({ jobId: z.string().uuid(), status: AsyncJobStatusSchema });

export const IntentDraftSchema = z.object({
  id: z.string().uuid(), status: z.string(), source: z.string(), confidence: z.number(), draftJson: z.any(), sourceManifest: z.any().nullable(),
  acceptedGraphId: z.string().nullable().optional(), acceptedGraphVersionId: z.string().nullable().optional(), createdAt: z.string().or(z.date()).optional(),
  evidence: z.array(z.any()).optional(),
}).passthrough();

export const InstrumentationFrameworkIdSchema = z.enum(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']);

export const SdkTargetKindSchema = z.enum(['FRONTEND', 'BACKEND']);
export const SdkConnectionMethodSchema = z.enum(['MANUAL', 'DESKTOP']);
export const SdkTargetReadinessSchema = z.object({
  targetId: z.string(),
  kind: SdkTargetKindSchema,
  source: z.string(),
  configured: z.boolean().default(false),
  processHealthy: z.boolean(),
  sessionObserved: z.boolean(),
  eventObserved: z.boolean(),
  installationTestPassed: z.boolean(),
  verified: z.boolean(),
  lastEventAt: z.string().datetime().nullable(),
});
export const SdkReadinessSchema = z.object({
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  connected: z.boolean(),
  codeConfigured: z.boolean().default(false),
  readyForDemonstration: z.boolean(),
  sessionObserved: z.boolean(),
  eventObserved: z.boolean(),
  installationTestPassed: z.boolean(),
  targets: z.array(SdkTargetReadinessSchema),
});
export const SdkSetupTargetSchema = z.object({
  id: z.string(),
  kind: SdkTargetKindSchema,
  label: z.string(),
  packageName: z.enum(['@tellann/frontend-sdk', '@tellann/backend-sdk']),
  packageVersion: z.string(),
  installCommands: z.record(z.string()),
  environmentVariables: z.record(z.string()),
  snippet: z.string(),
});
export const SdkSetupDescriptorSchema = z.object({
  applicationId: z.string().uuid(),
  applicationName: z.string(),
  organizationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  environmentName: z.string(),
  environmentType: EnvironmentTypeSchema,
  baseUrl: z.string().url().nullable(),
  gatewayEndpoint: z.string().url(),
  gatewayEndpointCustomized: z.boolean().default(false),
  hasActiveKey: z.boolean(),
  keyPrefix: z.string().nullable(),
  targets: z.array(SdkSetupTargetSchema),
  readiness: SdkReadinessSchema,
});
export const DesktopSetupHandoffSchema = z.object({
  handoffToken: z.string().min(32),
  expiresAt: z.string().datetime(),
  deepLink: z.string(),
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
});
export const InstrumentationPlanStatusSchema = z.enum([
  'PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED',
  'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK',
]);
export const StructuredInstrumentationCommandSchema = z.object({
  id: z.string(), executable: z.string(), args: z.array(z.string()), cwd: z.string(),
  timeoutMs: z.number().int().min(1_000).max(30 * 60_000), allowedEnvironmentKeys: z.array(z.string()),
  purpose: z.string(), networkRequired: z.boolean(),
});
export const InstrumentationOperationSchema = z.object({
  id: z.string(), kind: z.enum(['CREATE_FILE', 'UPDATE_SOURCE', 'UPDATE_PACKAGE']), relativePath: z.string(),
  symbol: z.string().nullable(), transformId: z.string(), transformVersion: z.string(), expectedHash: z.string().nullable(),
  description: z.string(), eventMappings: z.array(z.object({ eventType: z.string(), expectedState: z.string().nullable(), checkpointId: z.string().optional(), stateId: z.string().nullable().optional(), transitionId: z.string().nullable().optional(), terminalKind: z.string().nullable().optional() })),
  flowInitializationId: z.string().uuid().optional(),
}).passthrough();
export const InstrumentationPlanSchema = z.object({
  contractVersion: z.string(), manifestVersion: z.string(), id: z.string().uuid(), taskKey: z.string(),
  adapterId: InstrumentationFrameworkIdSchema, adapterVersion: z.string(), frameworkVersion: z.string().nullable(),
  supportedVersionRange: z.string(), baseRevision: z.string().nullable(), repositoryFingerprint: z.string(),
  approvedFileScopes: z.array(z.string()), packageChanges: z.array(z.object({ packageName: z.string(), version: z.string(), kind: z.enum(['dependency', 'devDependency']) })),
  operations: z.array(InstrumentationOperationSchema), validationCommands: z.array(StructuredInstrumentationCommandSchema),
  networkRequirements: z.array(z.string()), risk: z.enum(['LOW', 'MEDIUM', 'HIGH']), riskReasons: z.array(z.string()),
  evidence: z.any(), createdAt: z.string().datetime(), status: InstrumentationPlanStatusSchema.optional(),
  instrumentationPurpose: z.enum(['BOOTSTRAP', 'FLOW']).default('BOOTSTRAP'),
  flowId: z.string().uuid().nullable().optional(),
  flowVersionId: z.string().uuid().nullable().optional(),
  flowInitializationId: z.string().uuid().nullable().optional(),
  flowManifest: FlowInitializationManifestSchema.nullable().optional(),
}).passthrough();
export const InstrumentationDetectionSchema = z.object({
  adapterId: InstrumentationFrameworkIdSchema, adapterVersion: z.string(), supported: z.boolean(), confidence: z.number().min(0).max(1),
  frameworkVersion: z.string().nullable(), supportedVersionRange: z.string(), evidence: z.array(z.string()), reasons: z.array(z.string()),
});
export const InstrumentationApprovalSchema = z.object({
  applicationId: z.string().uuid(), planId: z.string().uuid(), environmentId: z.string().uuid(),
  approvedFileScopes: z.array(z.string()).min(1), approvedCommandIds: z.array(z.string()),
});
export const InstrumentationApplyResultSchema = z.object({
  planId: z.string().uuid(), checkpointId: z.string().uuid(), checkpointDirectory: z.string(), baseRevision: z.string().nullable(),
  files: z.array(z.object({ relativePath: z.string(), beforeHash: z.string().nullable(), afterHash: z.string(), changed: z.boolean() })),
  changedFiles: z.array(z.string()), diff: z.string(), diffHash: z.string(), appliedAt: z.string().datetime(),
});
export const InstrumentationValidationResultSchema = z.object({
  valid: z.boolean(), checks: z.array(z.object({ name: z.string(), passed: z.boolean(), output: z.string() })),
});

export const StartGuidedRunInputSchema = z.object({
  runId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  traceId: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  flowId: z.string().uuid(),
  flowBindingId: z.string().uuid(),
  flowInitializationId: z.string().uuid(),
  flowScanId: z.string().uuid(),
  flowDriftId: z.string().uuid().nullable().optional(),
  expectedGraphVersionId: z.string().uuid(),
  captureTracks: z.array(z.enum(['FRONTEND', 'BACKEND'])).min(1).default(['FRONTEND']),
  timeoutSeconds: z.number().int().positive().max(86_400).optional(),
  patchSetId: z.string().uuid().nullable().optional(),
  environmentType: EnvironmentTypeSchema,
  mode: z.enum(['GUIDED', 'OBSERVATION_ONLY']).default('GUIDED'),
  targetUrl: z.string().url(),
  productionObservationApproved: z.boolean().optional(),
  launchCommandId: z.string().optional(),
  launchApproved: z.boolean().optional(),
  relayEndpoint: z.string().url().optional(),
  relayToken: z.string().min(32).optional(),
  agentVersion: z.string().optional(),
});

export const IPC = {
  getVersion: 'tellann:version',
  copyText: 'tellann:system:copy-text',
  getSession: 'tellann:auth:session',
  getAvatarDataUri: 'tellann:auth:avatar',
  claimSetupHandoff: 'tellann:setup:handoff:claim',
  consumeSetupHandoff: 'tellann:setup:handoff:consume',
  getSdkSetup: 'tellann:setup:sdk:get',
  issueSdkSetupKey: 'tellann:setup:sdk:key',
  signIn: 'tellann:auth:sign-in',
  reopenSignIn: 'tellann:auth:reopen-sign-in',
  cancelSignIn: 'tellann:auth:cancel-sign-in',
  signOut: 'tellann:auth:sign-out',
  getApplications: 'tellann:cloud:applications',
  getOrganizations: 'tellann:cloud:organizations',
  createApplication: 'tellann:cloud:applications:create',
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
  getCodebaseAnalysis: 'tellann:workspace:analysis:get',
  cancelCodebaseAnalysis: 'tellann:workspace:analysis:cancel',
  rescanCodebase: 'tellann:workspace:analysis:rescan',
  codebaseQuery: 'tellann:workspace:analysis:query',
  openCodebaseEvidence: 'tellann:workspace:analysis:evidence:open',
  cloneWorkspace: 'tellann:workspace:clone',
  getBranchCompliance: 'tellann:workspace:branch:compliance',
  setBranchAgentCheckout: 'tellann:workspace:branch:agent-checkout',
  grantQaBranchCheckout: 'tellann:workspace:branch:grant',
  switchToQaBranch: 'tellann:workspace:branch:switch',
  restoreWorkspaceBranch: 'tellann:workspace:branch:restore',
  /** main → renderer: ask, in-app, whether source may be uploaded for analysis. */
  uploadConsentRequested: 'tellann:workspace:upload-consent:request',
  /** renderer → main: the answer to one `uploadConsentRequested`. */
  uploadConsentResolve: 'tellann:workspace:upload-consent:resolve',
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
  // ── Notifications ─────────────────────────────────────────────────────────
  /** renderer → main: which organisation's notifications to stream. */
  notificationsSetActiveOrg: 'tellann:notifications:set-active-org',
  /** renderer → main: page the feed (payload: { cursor?, filter? }). */
  notificationsFetch: 'tellann:notifications:fetch',
  notificationMarkRead: 'tellann:notifications:mark-read',
  notificationMarkAllRead: 'tellann:notifications:mark-all-read',
  notificationDismiss: 'tellann:notifications:dismiss',
  /** renderer → main: record the click and navigate to the deep link. */
  notificationOpen: 'tellann:notifications:open',
  /** main → renderer: a notification arrived while the window was focused. */
  notificationReceived: 'tellann:notifications:received',
  /** main → renderer: unread count changed. */
  notificationUnreadCount: 'tellann:notifications:unread-count',
} as const;

export const DesktopNotificationSchema = z.object({
  id: z.string(),
  notificationId: z.string(),
  type: z.string(),
  category: z.string(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string(),
  body: z.string(),
  deepLink: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});
export type DesktopNotification = z.infer<typeof DesktopNotificationSchema>;

export const DesktopSessionSchema = z.object({
  authenticated: z.boolean(),
  deviceSessionId: z.string().uuid().nullable(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
  }).nullable(),
});

export const DesktopEntitlementsSchema = z.object({
  planType: z.enum(['FREE', 'LOCAL', 'SOLO', 'TEAM', 'BUSINESS', 'ENTERPRISE']),
  features: z.object({
    DESKTOP_GUIDED_RUNS: z.boolean(),
    DOCUMENT_FLOW_INFERENCE: z.boolean(),
    AUTOMATED_INSTRUMENTATION: z.boolean(),
    SHARED_RUN_GOVERNANCE: z.boolean(),
    BROWSER_TRACE_CAPTURE: z.boolean(),
    VISUAL_ACCESSIBILITY_ANALYSIS: z.boolean(),
  }),
});

export const DesktopApplicationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  summary: z.string().nullable().optional(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  entitlements: DesktopEntitlementsSchema.nullable(),
  environments: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: EnvironmentTypeSchema,
    baseUrl: z.string().nullable().optional(),
  })),
  projectWorkspaces: z.array(z.object({
    id: z.string().uuid(),
    opaqueLocalId: z.string(),
    repositoryFingerprint: z.string(),
    repositoryOriginHash: z.string().nullable().optional(),
    repositoryCloneUrl: z.string().url().nullable().optional(),
    packageManager: z.string().nullable().optional(),
    detectedStack: z.any().optional(),
    snapshots: z.array(z.any()).optional(),
  })).optional(),
});

/**
 * An organisation the signed-in member belongs to. Desktop needs this to create
 * an application, which is always owned by exactly one organisation.
 */
export const DesktopOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable().optional(),
});

/**
 * Creating an application from Desktop hits the same cloud endpoint the web
 * dashboard uses, so plan limits, role checks, the default Development
 * environment and the APP_CREATED broadcast all behave identically.
 */
export const CreateApplicationInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  summary: z.string().max(500).nullable().optional(),
});

/**
 * Everything the in-app upload consent modal needs to state exactly what would
 * leave the device. The numbers come from planning the archive first, so they
 * describe the real payload rather than a general promise.
 */
export const CodebaseUploadConsentRequestSchema = z.object({
  requestId: z.string(),
  applicationId: z.string(),
  workspaceName: z.string(),
  fileCount: z.number().int().nonnegative(),
  compressedBytes: z.number().int().nonnegative(),
  /** How the repository should be described: bound to the application, or just this folder. */
  repositoryLabel: z.string(),
  branch: z.string().nullable(),
  revision: z.string().nullable(),
  dirty: z.boolean(),
  languages: z.array(z.string()),
  redactions: z.number().int().nonnegative(),
  redactedFiles: z.number().int().nonnegative(),
  exclusions: z.array(z.object({ reason: z.string(), count: z.number().int() })),
  truncated: z.boolean(),
});

/** main → renderer: an application was created, renamed or deleted in the cloud. */
export const AppEventSchema = z.object({
  action: z.enum(['APP_CREATED', 'APP_UPDATED', 'APP_DELETED']),
  applicationId: z.string(),
  organizationId: z.string().nullable().optional(),
  name: z.string().optional(),
  summary: z.string().nullable().optional(),
});

export type DesktopDevice = z.infer<typeof DesktopDeviceSchema>;
export type DesktopPermission = z.infer<typeof DesktopPermissionSchema>;
export type RepositorySnapshotSummary = z.infer<typeof RepositorySnapshotSummarySchema>;
export type BranchPolicy = z.infer<typeof BranchPolicySchema>;
export type BranchPolicyEnforcement = z.infer<typeof BranchPolicyEnforcementSchema>;
export type WorkspaceCompliance = z.infer<typeof WorkspaceComplianceSchema>;
export type WorkspaceComplianceStatus = z.infer<typeof WorkspaceComplianceStatusSchema>;
export type QaBranchSwitchResult = z.infer<typeof QaBranchSwitchResultSchema>;
export type RunCorrelationContext = z.infer<typeof RunCorrelationContextSchema>;
export type QARun = z.infer<typeof QARunSchema>;
export type QARunSummary = z.infer<typeof QARunSummarySchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type DeclaredFlowSummary = z.infer<typeof DeclaredFlowSummarySchema>;
export type DeclaredState = z.infer<typeof DeclaredStateSchema>;
export type DeclaredTransition = z.infer<typeof DeclaredTransitionSchema>;
export type DeclaredFlowDetail = z.infer<typeof DeclaredFlowDetailSchema>;
export type DeclaredStateSuggestion = z.infer<typeof DeclaredStateSuggestionSchema>;
export type FlowSuggestionMeta = z.infer<typeof FlowSuggestionMetaSchema>;
export type FlowSuggestionsResponse = z.infer<typeof FlowSuggestionsResponseSchema>;
export type FlowReviewPreview = z.infer<typeof FlowReviewPreviewSchema>;
export type FlowDiagram = z.infer<typeof FlowDiagramSchema>;
export type FlowProjectBinding = z.infer<typeof FlowProjectBindingSchema>;
export type FlowInitialization = z.infer<typeof FlowInitializationSchema>;
export type FlowCheckpoint = z.infer<typeof FlowCheckpointSchema>;
export type FlowInitializationManifest = z.infer<typeof FlowInitializationManifestSchema>;
export type FlowCodeReviewReport = z.infer<typeof FlowCodeReviewReportSchema>;
export type ManualRoadmap = z.infer<typeof ManualRoadmapSchema>;
export type ManualRoadmapStep = z.infer<typeof ManualRoadmapStepSchema>;
export type CheckpointCoverage = z.infer<typeof CheckpointCoverageSchema>;
export type SourceDocumentManifest = z.infer<typeof SourceDocumentManifestSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type DocumentAccess = z.infer<typeof DocumentAccessSchema>;
export type DocumentImportResult = z.infer<typeof DocumentImportResultSchema>;
export type DocumentProcessingJob = z.infer<typeof DocumentProcessingJobSchema>;
export type IntentDraftJob = z.infer<typeof IntentDraftJobSchema>;
export type IntentDraftJobCreated = z.infer<typeof IntentDraftJobCreatedSchema>;
export type IntentDraft = z.infer<typeof IntentDraftSchema>;
export type InstrumentationDetection = z.infer<typeof InstrumentationDetectionSchema>;
export type SdkSetupDescriptor = z.infer<typeof SdkSetupDescriptorSchema>;
export type SdkReadiness = z.infer<typeof SdkReadinessSchema>;
export type SdkSetupTarget = z.infer<typeof SdkSetupTargetSchema>;
export type DesktopSetupHandoff = z.infer<typeof DesktopSetupHandoffSchema>;
export type InstrumentationPlan = z.infer<typeof InstrumentationPlanSchema>;
export type InstrumentationApplyResult = z.infer<typeof InstrumentationApplyResultSchema>;
export type InstrumentationValidationResult = z.infer<typeof InstrumentationValidationResultSchema>;
export type QARunArtifact = z.infer<typeof QARunArtifactSchema>;
export type BrowserFinding = z.infer<typeof BrowserFindingSchema>;
export type StartGuidedRunInput = z.infer<typeof StartGuidedRunInputSchema>;
export type DesktopSession = z.infer<typeof DesktopSessionSchema>;
export type DesktopEntitlements = z.infer<typeof DesktopEntitlementsSchema>;
export type DesktopApplication = z.infer<typeof DesktopApplicationSchema>;
export type DesktopOrganization = z.infer<typeof DesktopOrganizationSchema>;
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;
export type AppEvent = z.infer<typeof AppEventSchema>;
export type CodebaseUploadConsentRequest = z.infer<typeof CodebaseUploadConsentRequestSchema>;
