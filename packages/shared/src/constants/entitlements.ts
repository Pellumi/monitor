// ─────────────────────────────────────────────────────────────
// Feature Keys — authoritative list of all entitlement features
// Mirrors the Entitlement Specification (ES) feature matrix
// ─────────────────────────────────────────────────────────────

/**
 * Every gated capability in TELLANN.
 * Used by FeatureFlag rows in the Plan table and by EntitlementChecker at runtime.
 */
export enum Feature {
  // ── Category A: Core Features ───────────────────────────────
  APPLICATION_ONBOARDING  = 'APPLICATION_ONBOARDING',
  DEMONSTRATION_MODE      = 'DEMONSTRATION_MODE',
  SESSION_RECORDING       = 'SESSION_RECORDING',
  SESSION_REPLAY          = 'SESSION_REPLAY',
  WORKFLOW_DISCOVERY      = 'WORKFLOW_DISCOVERY',
  BEHAVIOR_GRAPH          = 'BEHAVIOR_GRAPH',
  COVERAGE_ANALYSIS       = 'COVERAGE_ANALYSIS',
  MISSING_FLOW_DETECTION  = 'MISSING_FLOW_DETECTION',
  MISSING_STATE_DETECTION = 'MISSING_STATE_DETECTION',
  ENDPOINT_INTELLIGENCE   = 'ENDPOINT_INTELLIGENCE',
  DASHBOARD_ACCESS        = 'DASHBOARD_ACCESS',

  // â”€â”€ Desktop Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DESKTOP_GUIDED_RUNS          = 'DESKTOP_GUIDED_RUNS',
  DOCUMENT_FLOW_INFERENCE      = 'DOCUMENT_FLOW_INFERENCE',
  AUTOMATED_INSTRUMENTATION    = 'AUTOMATED_INSTRUMENTATION',
  SHARED_RUN_GOVERNANCE        = 'SHARED_RUN_GOVERNANCE',
  BROWSER_TRACE_CAPTURE        = 'BROWSER_TRACE_CAPTURE',
  VISUAL_ACCESSIBILITY_ANALYSIS = 'VISUAL_ACCESSIBILITY_ANALYSIS',

  // ── Reporting ───────────────────────────────────────────────
  REPORT_GENERATION       = 'REPORT_GENERATION',
  REPORT_EXPORT           = 'REPORT_EXPORT',
  HISTORICAL_REPORTS      = 'HISTORICAL_REPORTS',
  ADVANCED_REPORTING      = 'ADVANCED_REPORTING',

  // ── Category B: Collaboration & Environments ────────────────
  MULTIPLE_ENVIRONMENTS   = 'MULTIPLE_ENVIRONMENTS',
  TEAM_COLLABORATION      = 'TEAM_COLLABORATION',
  SHARED_DASHBOARDS       = 'SHARED_DASHBOARDS',

  // ── Category C: Governance ──────────────────────────────────
  RBAC                    = 'RBAC',
  APPLICATION_PERMISSIONS = 'APPLICATION_PERMISSIONS',
  AUDIT_LOGS              = 'AUDIT_LOGS',
  API_ACCESS              = 'API_ACCESS',
  SSO                     = 'SSO',
  OIDC                    = 'OIDC',
  SAML                    = 'SAML',
  SELF_HOSTING            = 'SELF_HOSTING',

  // ── Priority ────────────────────────────────────────────────
  PRIORITY_PROCESSING     = 'PRIORITY_PROCESSING',
}

/**
 * Tiered feature values (used in the `tier` column of FeatureFlag).
 * Some features aren't just on/off — they have levels.
 */
export enum FeatureTier {
  BASIC        = 'BASIC',
  STANDARD     = 'STANDARD',
  ADVANCED     = 'ADVANCED',
  JSON_ONLY    = 'JSON_ONLY',
  JSON_PDF     = 'JSON_PDF',
  ALL_FORMATS  = 'ALL_FORMATS',
}

/**
 * Resource limit keys used in the Entitlement.limits JSON field.
 */
export interface ResourceLimits {
  applications:    number;
  users:           number;
  storageGb:       number;
  retentionDays:   number;
  demoSessions:    number | null; // null = unlimited
  maxEnvironmentsPerApp: number;
  maxApiKeys:      number;
}

/**
 * Support entitlement keys used in the Entitlement.support JSON field.
 */
export interface SupportEntitlements {
  communitySupport:       boolean;
  emailSupport:           boolean;
  priorityEmailSupport:   boolean;
  dedicatedSuccessManager: boolean;
  architectureAssistance: boolean;
  enterpriseSla:          boolean;
}

/**
 * Resolved feature map used in the Entitlement.features JSON field.
 */
export type FeatureEntitlements = Record<Feature, boolean | string>;

// ─────────────────────────────────────────────────────────────
// Report export formats — canonical REPORT_EXPORT tier mapping
// ─────────────────────────────────────────────────────────────

/**
 * The export formats the report engine can emit.
 */
export type ReportFormat = 'json' | 'pdf' | 'csv' | 'html';

/**
 * Canonical order used whenever formats are listed or a default is picked.
 * Cheapest/most universally entitled first.
 */
export const REPORT_FORMATS: readonly ReportFormat[] = ['json', 'pdf', 'csv', 'html'];

/**
 * Resolve the export formats permitted by a resolved `REPORT_EXPORT` entitlement value.
 *
 * The value comes from `Entitlement.features[Feature.REPORT_EXPORT]`, which is typed
 * `boolean | string` — a FeatureTier for tiered plans, `true` for an enabled but
 * untiered plan, and `false`/absent when the feature is not entitled at all.
 *
 * A non-entitled value yields `[]`: callers must offer no export at all rather than
 * falling back to JSON, which the report engine would reject with a 403.
 */
export function reportFormatsForTier(
  tier: boolean | string | null | undefined
): ReportFormat[] {
  if (!tier) return [];
  switch (tier) {
    case FeatureTier.ALL_FORMATS:
      return ['json', 'pdf', 'csv', 'html'];
    case FeatureTier.JSON_PDF:
      return ['json', 'pdf'];
    default:
      // FeatureTier.JSON_ONLY, or `true` for an enabled-but-untiered plan.
      return ['json'];
  }
}

/**
 * Whether a specific format (case-insensitive) is permitted by the given tier.
 */
export function isReportFormatEntitled(
  tier: boolean | string | null | undefined,
  format: string
): boolean {
  return reportFormatsForTier(tier).includes(format.toLowerCase() as ReportFormat);
}
