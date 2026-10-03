import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Application architecture projection — what the desktop analyser may send.
//
// Projection fields only: framework ids, trait booleans, canonical route
// templates, counts and warnings. No source text, literals, env values or
// secrets. Source never leaves the workspace to classify an application.
// ─────────────────────────────────────────────────────────────

export const ApplicationTypeSchema = z.enum(['FRONTEND', 'BACKEND', 'MIXED', 'UNKNOWN']);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const ArchitectureConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ArchitectureConfidence = z.infer<typeof ArchitectureConfidenceSchema>;

/** Capability traits from the architecture spec (§3, §8, §40). Booleans only. */
export const ApplicationTraitsSchema = z.object({
  browserSurface: z.boolean(),
  frontendRuntime: z.boolean(),
  backendRuntime: z.boolean(),
  clientRouting: z.boolean(),
  uiStateSurface: z.boolean(),
  apiConsumer: z.boolean(),
  apiProvider: z.boolean(),
  serverActions: z.boolean(),
  serverRendering: z.boolean(),
  managedBrowserRunnable: z.boolean(),
});
export type ApplicationTraits = z.infer<typeof ApplicationTraitsSchema>;

export const DetectedFrameworkSchema = z.object({
  /** Framework id from the SDK registry vocabulary, e.g. `next`, `django`. */
  id: z.string().min(1).max(64),
  version: z.string().max(64).nullable(),
  /** Whether Tellann can instrument this framework today (SDK registry). */
  sdkSupport: z.enum(['SUPPORTED', 'PLANNED', 'UNKNOWN_FRAMEWORK']),
});
export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;

export const ApplicationArchitectureProjectionSchema = z.object({
  detectedType: ApplicationTypeSchema,
  confidence: ArchitectureConfidenceSchema,
  /** Normalised 0–100 heuristic score per type. Internal heuristic, not a probability. */
  scores: z.object({
    frontend: z.number().min(0).max(100),
    backend: z.number().min(0).max(100),
  }),
  traits: ApplicationTraitsSchema,
  frameworks: z.array(DetectedFrameworkSchema).max(64),
  /** Canonical route templates only (e.g. `/api/orders/:id`), never handler bodies. */
  routeTemplates: z.array(z.string().max(512)).max(2_000),
  workspaceRoot: z.string().max(1024),
  analysisSnapshotId: z.string().min(1).max(128),
  detectorVersion: z.string().min(1).max(32),
  warnings: z.array(z.string().max(300)).max(100),
  /** Package roots that could be selected as the workspace (doc §38). Empty for a single-package repository. */
  workspaceCandidates: z.array(z.string().min(1).max(1024)).max(200).optional(),
});
export type ApplicationArchitectureProjection = z.infer<typeof ApplicationArchitectureProjectionSchema>;

/** Effective state of the stored profile (doc §48 Phase D). */
export const ApplicationProfileStateSchema = z.enum([
  'DETECTED',
  'CONFIRMED',
  'DISPUTED',
  'STALE',
  'UNKNOWN_PENDING',
]);
export type ApplicationProfileState = z.infer<typeof ApplicationProfileStateSchema>;

/** Eight capability states from the spec (§5). Never a bare boolean. */
export const CapabilityStateSchema = z.enum([
  'AVAILABLE',
  'LIMITED',
  'NEEDS_SETUP',
  'WAITING_FOR_EVIDENCE',
  'PLAN_LOCKED',
  'NOT_AUTHORIZED',
  'NOT_APPLICABLE',
  'UNAVAILABLE',
]);
export type CapabilityState = z.infer<typeof CapabilityStateSchema>;

/** Deterministic reasons (§21). Every non-AVAILABLE state carries one. */
export const CapabilityReasonCodeSchema = z.enum([
  'NO_BROWSER_SURFACE',
  'NO_SERVER_RUNTIME',
  'BACKEND_SDK_NOT_CONNECTED',
  'FRONTEND_SDK_NOT_CONNECTED',
  'AWAITING_FIRST_RUN',
  'NO_IN_FLOW_EVIDENCE',
  'NO_ENDPOINT_EVIDENCE',
  'UNSUPPORTED_FRAMEWORK',
  'PLAN_ENTITLEMENT_MISSING',
  'ROLE_PERMISSION_MISSING',
  'APPLICATION_PROFILE_UNKNOWN',
  'APPLICATION_ANALYSIS_STALE',
  'CAPABILITY_NOT_SHIPPED',
  'ROLLOUT_DISABLED',
]);
export type CapabilityReasonCode = z.infer<typeof CapabilityReasonCodeSchema>;
