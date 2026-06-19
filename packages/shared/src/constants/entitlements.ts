// ─────────────────────────────────────────────────────────────
// Feature Keys — authoritative list of all entitlement features
// Mirrors the Entitlement Specification (ES) feature matrix
// ─────────────────────────────────────────────────────────────

/**
 * Every gated capability in SOTS.
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
