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
// Report export formats
// ─────────────────────────────────────────────────────────────

/** Every export format the report engine can produce, in preference order. */
export const REPORT_EXPORT_FORMATS = ['JSON', 'PDF', 'CSV', 'HTML'] as const;

export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

/**
 * The export formats a REPORT_EXPORT tier entitles an organisation to.
 *
 * The report engine (when serving a download), the settings API (when
 * validating a default) and the dashboard (when rendering the choices) all
 * resolve formats through this one function, so a plan change cannot leave the
 * three disagreeing about what a customer may download.
 *
 * `tier` is the resolved `features[REPORT_EXPORT]` value, which is `false` when
 * the plan has no export entitlement at all and a `FeatureTier` string
 * otherwise. An unrecognised truthy tier degrades to JSON rather than opening
 * up every format.
 */
export function reportFormatsForTier(tier: boolean | string | undefined): ReportExportFormat[] {
  switch (tier) {
    case FeatureTier.ALL_FORMATS:
      return ['JSON', 'PDF', 'CSV', 'HTML'];
    case FeatureTier.JSON_PDF:
      return ['JSON', 'PDF'];
    default:
      return tier ? ['JSON'] : [];
  }
}

/** True when `format` (in any casing) is one the tier entitles. */
export function isReportFormatEntitled(format: string, tier: boolean | string | undefined): boolean {
  const normalized = String(format).toUpperCase();
  return reportFormatsForTier(tier).some((allowed) => allowed === normalized);
}

/**
 * The format a report should be produced in when the caller did not name one.
 *
 * Falls back to the best entitled format when the organisation's configured
 * default is no longer covered by its plan — a downgrade leaves stale values
 * behind, and a report is more useful in JSON than not produced at all.
 */
export function resolveDefaultReportFormat(
  configured: string | null | undefined,
  tier: boolean | string | undefined,
): ReportExportFormat {
  const allowed = reportFormatsForTier(tier);
  const normalized = String(configured ?? '').toUpperCase();
  const match = allowed.find((format) => format === normalized);
  return match ?? allowed[0] ?? 'JSON';
}
