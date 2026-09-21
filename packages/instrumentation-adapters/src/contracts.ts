import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import { FlowPlacementKindSchema, InstrumentationFrameworkIdSchema } from '@tellann/desktop-contracts';
import type { FlowInitializationManifest, RepositorySnapshotSummary } from '@tellann/desktop-contracts';

/**
 * The instrumentation contract, shared by every adapter.
 *
 * Plans, detection results, patch results and the adapter interface live here
 * rather than beside one adapter's implementation, so a second adapter family -
 * the Python one - can satisfy exactly the same contract without importing the
 * TypeScript adapter and without a second, drifting copy of the plan schema.
 * `index.ts` re-exports all of it, so the published surface is unchanged.
 */

export const INSTRUMENTATION_CONTRACT_VERSION = '1.0';
export const INSTRUMENTATION_MANIFEST_VERSION = '1.0';

// A plan resolves the newest published SDK at plan time so the approval boundary
// names the exact version it will install. When the registry cannot be reached the
// plan falls back to this dist-tag: the package manager still resolves the newest
// release, it just cannot be shown before the command runs.
export const SDK_FALLBACK_INSTALL_SPEC = 'latest';

export const RiskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const OperationKindSchema = z.enum(['CREATE_FILE', 'UPDATE_SOURCE', 'UPDATE_PACKAGE']);
/**
 * Re-exported from the contracts package rather than redeclared: an adapter
 * this package can propose for but the desktop process rejects as an unknown
 * id is a plan that dies at approval, which is exactly the drift a second copy
 * of the enum invites.
 */
export const FrameworkIdSchema = InstrumentationFrameworkIdSchema;
export const PlanStatusSchema = z.enum([
  'PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED',
  'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK',
]);

export type Risk = z.infer<typeof RiskSchema>;
export type FrameworkId = z.infer<typeof FrameworkIdSchema>;

export type StructuredCommand = {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  allowedEnvironmentKeys: string[];
  purpose: string;
  networkRequired: boolean;
  /**
   * Offered, but not selected by default.
   *
   * A full production build is the most expensive thing in the whole
   * initialization, and what it is being asked is whether a handful of inserted
   * marker calls broke the project. When the project can answer that with a type
   * check, the build stops being the default way to ask and stays available for
   * anyone who wants it.
   */
  optional?: boolean;
};

export type LocalProjectContext = {
  workspaceRoot: string;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  snapshot: RepositorySnapshotSummary;
  instrumentationPurpose?: 'BOOTSTRAP' | 'FLOW';
  flowId?: string;
  flowVersionId?: string;
  flowInitializationId?: string;
  flowManifest?: FlowInitializationManifest;
  /**
   * The checkpoints this adapter is responsible for.
   *
   * A Flow crosses packages — a login page in the web app, its handler in the
   * API — and no single framework adapter can instrument both. The caller splits
   * the manifest by which detected package holds each file and hands each
   * adapter its share; together the approved plans still cover every checkpoint.
   * Omitted means this adapter owns every checkpoint, which is the single-package
   * case and stays exactly as strict as before.
   */
  flowCheckpointIds?: string[];
};

export type DetectionResult = {
  adapterId: FrameworkId;
  adapterVersion: string;
  supported: boolean;
  confidence: number;
  frameworkVersion: string | null;
  supportedVersionRange: string;
  evidence: string[];
  reasons: string[];
};

export type AdapterEvidence = {
  entryPoints: Array<{ file: string; symbol: string | null; confidence: number }>;
  existingInstrumentation: Array<{ file: string; marker: string }>;
  semanticBoundaries: Array<{
    file: string;
    symbol: string | null;
    eventType: string;
    confidence: number;
    rationale: string;
  }>;
};

export type PatchOperation = {
  id: string;
  kind: z.infer<typeof OperationKindSchema>;
  relativePath: string;
  symbol: string | null;
  transformId: string;
  transformVersion: string;
  expectedHash: string | null;
  description: string;
  eventMappings: Array<{ eventType: string; expectedState: string | null; checkpointId?: string; stateId?: string | null; transitionId?: string | null; terminalKind?: string | null }>;
  content?: string;
  importModule?: string;
  flowInitializationId?: string;
  placementKind?: FlowPlacementKind;
  anchorText?: string;
  anchorHash?: string;
  startLine?: number;
  endLine?: number;
  branch?: 'THEN' | 'ELSE';
};

// Re-exported from the contracts package rather than redeclared: a placement the
// retrieval engine can rank and the resolver can return but this adapter cannot
// apply is a mapping that dies at proposal, which is exactly the drift a second
// copy of the enum invites.
export { FlowPlacementKindSchema };
export type FlowPlacementKind = z.infer<typeof FlowPlacementKindSchema>;

/** Placements that instrument the entry of a callable rather than a statement. */
export const CALLABLE_ENTRY_PLACEMENTS: FlowPlacementKind[] = ['FUNCTION_ENTRY', 'CALLBACK_ENTRY', 'ROUTE_HANDLER_ENTRY'];

export type InstrumentationPlan = {
  contractVersion: string;
  manifestVersion: string;
  id: string;
  taskKey: string;
  adapterId: FrameworkId;
  adapterVersion: string;
  frameworkVersion: string | null;
  supportedVersionRange: string;
  baseRevision: string | null;
  repositoryFingerprint: string;
  approvedFileScopes: string[];
  packageChanges: Array<{ packageName: string; version: string; kind: 'dependency' | 'devDependency' }>;
  operations: PatchOperation[];
  validationCommands: StructuredCommand[];
  networkRequirements: string[];
  risk: Risk;
  riskReasons: string[];
  evidence: AdapterEvidence;
  instrumentationPurpose: 'BOOTSTRAP' | 'FLOW';
  flowId: string | null;
  flowVersionId: string | null;
  flowInitializationId?: string | null;
  flowManifest?: FlowInitializationManifest | null;
  createdAt: string;
};

export type ApprovedInstrumentationTask = {
  plan: InstrumentationPlan;
  approvedFileScopes: string[];
  approvedCommandIds: string[];
  approvalHash: string;
  checkpointDirectory: string;
};

export type PatchFileResult = {
  relativePath: string;
  beforeHash: string | null;
  afterHash: string;
  changed: boolean;
};

export type PatchResult = {
  planId: string;
  checkpointId: string;
  checkpointDirectory: string;
  baseRevision: string | null;
  files: PatchFileResult[];
  changedFiles: string[];
  diff: string;
  diffHash: string;
  appliedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; output: string }>;
};

export type RollbackResult = {
  rolledBackFiles: string[];
  conflicts: Array<{ relativePath: string; reason: string }>;
  verified: boolean;
};

export interface InstrumentationAdapter {
  readonly id: FrameworkId;
  readonly version: string;
  readonly supportedVersionRange: string;
  detect(input: LocalProjectContext): DetectionResult;
  index(input: LocalProjectContext): Promise<AdapterEvidence>;
  propose(input: LocalProjectContext): Promise<InstrumentationPlan>;
  apply(input: LocalProjectContext, task: ApprovedInstrumentationTask): Promise<PatchResult>;
  validate(input: LocalProjectContext, result: PatchResult): Promise<ValidationResult>;
  rollback(input: LocalProjectContext, result: PatchResult): Promise<RollbackResult>;
}

const PLAN_SCHEMA = z.object({
  contractVersion: z.literal(INSTRUMENTATION_CONTRACT_VERSION),
  manifestVersion: z.literal(INSTRUMENTATION_MANIFEST_VERSION),
  id: z.string().uuid(),
  taskKey: z.string().min(32),
  adapterId: FrameworkIdSchema,
  adapterVersion: z.string(),
  frameworkVersion: z.string().nullable(),
  supportedVersionRange: z.string(),
  baseRevision: z.string().nullable(),
  repositoryFingerprint: z.string().min(32),
  approvedFileScopes: z.array(z.string()),
  packageChanges: z.array(z.object({ packageName: z.string(), version: z.string(), kind: z.enum(['dependency', 'devDependency']) })),
  operations: z.array(z.object({
    id: z.string(), kind: OperationKindSchema, relativePath: z.string(), symbol: z.string().nullable(), transformId: z.string(),
    transformVersion: z.string(), expectedHash: z.string().nullable(), description: z.string(),
    eventMappings: z.array(z.object({ eventType: z.string(), expectedState: z.string().nullable(), checkpointId: z.string().optional(), stateId: z.string().nullable().optional(), transitionId: z.string().nullable().optional(), terminalKind: z.string().nullable().optional() })),
    content: z.string().optional(), importModule: z.string().optional(), flowInitializationId: z.string().uuid().optional(),
    placementKind: FlowPlacementKindSchema.optional(), anchorText: z.string().optional(), anchorHash: z.string().optional(),
    startLine: z.number().int().positive().optional(), endLine: z.number().int().positive().optional(), branch: z.enum(['THEN', 'ELSE']).optional(),
  })),
  validationCommands: z.array(z.object({
    id: z.string(), executable: z.string(), args: z.array(z.string()), cwd: z.string(), timeoutMs: z.number(),
    allowedEnvironmentKeys: z.array(z.string()), purpose: z.string(), networkRequired: z.boolean(),
    optional: z.boolean().optional(),
  })),
  networkRequirements: z.array(z.string()),
  risk: RiskSchema,
  riskReasons: z.array(z.string()),
  evidence: z.any(),
  instrumentationPurpose: z.enum(['BOOTSTRAP', 'FLOW']).default('BOOTSTRAP'),
  flowId: z.string().uuid().nullable().optional(),
  flowVersionId: z.string().uuid().nullable().optional(),
  flowInitializationId: z.string().uuid().nullable().optional(),
  flowManifest: z.any().nullable().optional(),
  createdAt: z.string(),
});

export function validateInstrumentationPlan(value: unknown): InstrumentationPlan {
  return PLAN_SCHEMA.parse(value) as InstrumentationPlan;
}

export function hash(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function calculateFlowAnchorHash(file: string, symbol: string | null, placementKind: string, anchorText: string): string {
  return hash(`${file}\0${symbol ?? ''}\0${placementKind}\0${anchorText.replaceAll('\r\n', '\n')}`);
}

export function fileHash(root: string, relativePath: string): string | null {
  const target = resolveWithinWorkspace(root, relativePath);
  return fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
}

export function currentGitRevision(root: string): string | null {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 }).trim() || null;
  } catch {
    return null;
  }
}
