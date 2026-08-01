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
]);
export const RunStatusSchema = z.enum([
  'CREATED',
  'DRAFT',
  'PREPARING',
  'WAITING_FOR_PERMISSION',
  'READY',
  'RUNNING',
  'PAUSED',
  'ENDING',
  'UPLOADING',
  'PROCESSING',
  'RECONCILING',
  'REPORTING',
  'COMPLETED',
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
  languages: z.array(z.string()),
  packageManager: z.string().nullable(),
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
});

export const DeclaredFlowSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  version: z.number().int().optional(),
  updatedAt: z.string().datetime().optional(),
  versions: z.array(z.object({ id: z.string().uuid(), version: z.number().int(), isBaseline: z.boolean().optional() })).optional(),
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

export const IntentDraftSchema = z.object({
  id: z.string().uuid(), status: z.string(), source: z.string(), confidence: z.number(), draftJson: z.any(), sourceManifest: z.any().nullable(),
  acceptedGraphId: z.string().nullable().optional(), acceptedGraphVersionId: z.string().nullable().optional(), createdAt: z.string().or(z.date()).optional(),
  evidence: z.array(z.any()).optional(),
}).passthrough();

export const StartGuidedRunInputSchema = z.object({
  runId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  traceId: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  expectedGraphVersionId: z.string().uuid().nullable(),
  environmentType: EnvironmentTypeSchema,
  targetUrl: z.string().url(),
});

export const IPC = {
  getVersion: 'tellann:version',
  getSession: 'tellann:auth:session',
  signIn: 'tellann:auth:sign-in',
  signOut: 'tellann:auth:sign-out',
  getApplications: 'tellann:cloud:applications',
  listRuns: 'tellann:cloud:runs:list',
  getRun: 'tellann:cloud:runs:get',
  getRunReport: 'tellann:cloud:runs:report',
  getDeclaredFlows: 'tellann:cloud:intent:list',
  importDocuments: 'tellann:documents:import',
  listDocuments: 'tellann:documents:list',
  createIntentDraft: 'tellann:intent:draft:create',
  listIntentDrafts: 'tellann:intent:draft:list',
  getIntentDraft: 'tellann:intent:draft:get',
  reviewIntentDraft: 'tellann:intent:draft:review',
  correctIntentDraft: 'tellann:intent:draft:correct',
  openExternal: 'tellann:system:open-external',
  openProfile: 'tellann:system:open-profile',
  chooseWorkspace: 'tellann:workspace:choose',
  getLocalWorkspace: 'tellann:workspace:local-state',
  scanWorkspace: 'tellann:workspace:scan',
  startGuidedRun: 'tellann:run:start',
  pauseGuidedRun: 'tellann:run:pause',
  endGuidedRun: 'tellann:run:end',
  getRunState: 'tellann:run:state',
} as const;

export const DesktopSessionSchema = z.object({
  authenticated: z.boolean(),
  deviceSessionId: z.string().uuid().nullable(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
  }).nullable(),
});

export const DesktopApplicationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  environments: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: EnvironmentTypeSchema,
    baseUrl: z.string().nullable().optional(),
  })),
});

export type DesktopDevice = z.infer<typeof DesktopDeviceSchema>;
export type DesktopPermission = z.infer<typeof DesktopPermissionSchema>;
export type RepositorySnapshotSummary = z.infer<typeof RepositorySnapshotSummarySchema>;
export type RunCorrelationContext = z.infer<typeof RunCorrelationContextSchema>;
export type QARun = z.infer<typeof QARunSchema>;
export type QARunSummary = z.infer<typeof QARunSummarySchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type DeclaredFlowSummary = z.infer<typeof DeclaredFlowSummarySchema>;
export type SourceDocumentManifest = z.infer<typeof SourceDocumentManifestSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type IntentDraft = z.infer<typeof IntentDraftSchema>;
export type QARunArtifact = z.infer<typeof QARunArtifactSchema>;
export type BrowserFinding = z.infer<typeof BrowserFindingSchema>;
export type StartGuidedRunInput = z.infer<typeof StartGuidedRunInputSchema>;
export type DesktopSession = z.infer<typeof DesktopSessionSchema>;
export type DesktopApplication = z.infer<typeof DesktopApplicationSchema>;
