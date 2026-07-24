import { Feature, FeatureTier, type ResourceLimits, type SupportEntitlements } from './entitlements';

// ─────────────────────────────────────────────────────────────
// Plan Definitions — authoritative source for all plan details
// Sourced from: PPS, BSS, ES documents
// ─────────────────────────────────────────────────────────────

export type PlanTypeKey = 'FREE' | 'LOCAL' | 'SOLO' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE';

export interface PlanPricing {
  monthlyUsd: number | null;  // cents
  monthlyNgn: number | null;  // kobo
  annualUsd:  number | null;  // cents
  annualNgn:  number | null;  // kobo
}

export interface PlanFeatureConfig {
  feature: Feature;
  enabled: boolean;
  tier?:   string;
}

export interface PlanDefinition {
  type:          PlanTypeKey;
  name:          string;
  description:   string;
  isPublic:      boolean;
  sortOrder:     number;
  pricing:       PlanPricing;
  limits:        ResourceLimits;
  features:      PlanFeatureConfig[];
  support:       SupportEntitlements;
  hasTrial:      boolean;        // Free = no trial, paid = 14-day trial
  trialDays:     number;
  ngnOnly?:      boolean;        // Local plan is NGN-only
  rank:           number;
  audience:       string[];
  highlights:     string[];
  exportFormats:  Array<'JSON' | 'PDF' | 'CSV' | 'HTML'>;
  eligibleCountries: string[] | null;
  supportedCurrencies: Array<'USD' | 'NGN'>;
  supportedProviders: Array<'STRIPE' | 'PAYSTACK'>;
  contactSales:   boolean;
}

// ─────────────────────────────────────────────────────────────
// Feature presets (DRY helpers)
// ─────────────────────────────────────────────────────────────

/** Core features available on every plan */
const CORE_FEATURES: PlanFeatureConfig[] = [
  { feature: Feature.APPLICATION_ONBOARDING,  enabled: true },
  { feature: Feature.DEMONSTRATION_MODE,      enabled: true },
  { feature: Feature.SESSION_RECORDING,       enabled: true },
  { feature: Feature.SESSION_REPLAY,          enabled: true },
  { feature: Feature.WORKFLOW_DISCOVERY,      enabled: true },
  { feature: Feature.BEHAVIOR_GRAPH,          enabled: true },
  { feature: Feature.COVERAGE_ANALYSIS,       enabled: true },
  { feature: Feature.MISSING_FLOW_DETECTION,  enabled: true },
  { feature: Feature.MISSING_STATE_DETECTION, enabled: true },
  { feature: Feature.ENDPOINT_INTELLIGENCE,   enabled: true },
  { feature: Feature.DASHBOARD_ACCESS,        enabled: true },
];

// ─────────────────────────────────────────────────────────────
// Plan definitions
// ─────────────────────────────────────────────────────────────

export const PLAN_DEFINITIONS: Record<PlanTypeKey, PlanDefinition> = {

  // ═══════════════════════════════════════════════════════════
  // FREE
  // ═══════════════════════════════════════════════════════════
  FREE: {
    type: 'FREE',
    name: 'Free',
    description: 'Product discovery for individual developers, students, and open-source projects.',
    isPublic: true,
    sortOrder: 0,
    pricing: {
      monthlyUsd: 0,
      monthlyNgn: 0,
      annualUsd:  null,
      annualNgn:  null,
    },
    limits: {
      applications:  1,
      users:         1,
      storageGb:     1,
      retentionDays: 14,
      demoSessions:  10,  // 10/month hard limit
      maxEnvironmentsPerApp: 1,
      maxApiKeys:      1,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.BASIC },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.JSON_ONLY },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: false },
      { feature: Feature.ADVANCED_REPORTING,    enabled: false },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: false },
      { feature: Feature.TEAM_COLLABORATION,    enabled: false },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: false },
      { feature: Feature.RBAC,                  enabled: false },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: false },
      { feature: Feature.AUDIT_LOGS,            enabled: false },
      { feature: Feature.API_ACCESS,            enabled: false },
      { feature: Feature.SSO,                   enabled: false },
      { feature: Feature.OIDC,                  enabled: false },
      { feature: Feature.SAML,                  enabled: false },
      { feature: Feature.SELF_HOSTING,          enabled: false },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: false },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           false,
      priorityEmailSupport:   false,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla:          false,
    },
    hasTrial: false,
    trialDays: 0,
    rank: 0,
    audience: ['Individual developers', 'Students', 'Open-source maintainers', 'Product evaluation users'],
    highlights: ['Complete demonstration workflow', 'Session replay', 'Coverage and missing-flow analysis', 'Basic reports'],
    exportFormats: ['JSON'],
    eligibleCountries: null,
    supportedCurrencies: ['USD', 'NGN'],
    supportedProviders: [],
    contactSales: false,
  },

  // ═══════════════════════════════════════════════════════════
  // LOCAL (Nigeria Only)
  // ═══════════════════════════════════════════════════════════
  LOCAL: {
    type: 'LOCAL',
    name: 'Local',
    description: 'Affordable entry-level plan for Nigerian developers and startups.',
    isPublic: true,
    sortOrder: 1,
    ngnOnly: true,
    pricing: {
      monthlyUsd: null,                 // Not available in USD
      monthlyNgn: 2_000_000,            // ₦20,000 in kobo
      annualUsd:  null,
      annualNgn:  20_000_000,           // ₦200,000 in kobo
    },
    limits: {
      applications:  2,
      users:         2,
      storageGb:     10,
      retentionDays: 30,
      demoSessions:  null,  // unlimited
      maxEnvironmentsPerApp: 2,
      maxApiKeys:      2,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.STANDARD },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.JSON_PDF },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: true, tier: '30_DAYS' },
      { feature: Feature.ADVANCED_REPORTING,    enabled: false },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: false },
      { feature: Feature.TEAM_COLLABORATION,    enabled: false },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: false },
      { feature: Feature.RBAC,                  enabled: false },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: false },
      { feature: Feature.AUDIT_LOGS,            enabled: false },
      { feature: Feature.API_ACCESS,            enabled: false },
      { feature: Feature.SSO,                   enabled: false },
      { feature: Feature.OIDC,                  enabled: false },
      { feature: Feature.SAML,                  enabled: false },
      { feature: Feature.SELF_HOSTING,          enabled: false },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: false },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           true,
      priorityEmailSupport:   false,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla:          false,
    },
    hasTrial: true,
    trialDays: 14,
    rank: 1,
    audience: ['Nigerian developers', 'Nigerian startups', 'Small local products'],
    highlights: ['Everything in Free', 'Standard reporting', '30-day report history', 'Email support'],
    exportFormats: ['JSON', 'PDF'],
    eligibleCountries: ['NG'],
    supportedCurrencies: ['NGN'],
    supportedProviders: ['PAYSTACK'],
    contactSales: false,
  },

  // ═══════════════════════════════════════════════════════════
  // SOLO
  // ═══════════════════════════════════════════════════════════
  SOLO: {
    type: 'SOLO',
    name: 'Solo',
    description: 'For independent professionals, freelancers, and small products.',
    isPublic: true,
    sortOrder: 2,
    pricing: {
      monthlyUsd: 2_900,               // $29
      monthlyNgn: 4_200_000,            // ₦42,000
      annualUsd:  29_000,               // $290
      annualNgn:  42_000_000,           // ₦420,000
    },
    limits: {
      applications:  3,
      users:         3,
      storageGb:     25,
      retentionDays: 90,
      demoSessions:  null,  // unlimited
      maxEnvironmentsPerApp: 5,
      maxApiKeys:      5,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.ALL_FORMATS },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: true, tier: '90_DAYS' },
      { feature: Feature.ADVANCED_REPORTING,    enabled: true },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: true },
      { feature: Feature.TEAM_COLLABORATION,    enabled: false },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: false },
      { feature: Feature.RBAC,                  enabled: false },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: false },
      { feature: Feature.AUDIT_LOGS,            enabled: false },
      { feature: Feature.API_ACCESS,            enabled: false },
      { feature: Feature.SSO,                   enabled: false },
      { feature: Feature.OIDC,                  enabled: false },
      { feature: Feature.SAML,                  enabled: false },
      { feature: Feature.SELF_HOSTING,          enabled: false },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: false },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           true,
      priorityEmailSupport:   false,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla:          false,
    },
    hasTrial: true,
    trialDays: 14,
    rank: 2,
    audience: ['Freelancers', 'Indie founders', 'Small products'],
    highlights: ['Everything in Free', 'Advanced reporting', 'Historical reports', 'Multiple environments'],
    exportFormats: ['JSON', 'PDF', 'CSV', 'HTML'],
    eligibleCountries: null,
    supportedCurrencies: ['USD', 'NGN'],
    supportedProviders: ['STRIPE', 'PAYSTACK'],
    contactSales: false,
  },

  // ═══════════════════════════════════════════════════════════
  // TEAM
  // ═══════════════════════════════════════════════════════════
  TEAM: {
    type: 'TEAM',
    name: 'Team',
    description: 'For collaborative engineering teams, startups, and QA teams.',
    isPublic: true,
    sortOrder: 3,
    pricing: {
      monthlyUsd: 9_900,               // $99
      monthlyNgn: 14_700_000,           // ₦147,000
      annualUsd:  99_000,               // $990
      annualNgn:  147_000_000,          // ₦1,470,000
    },
    limits: {
      applications:  10,
      users:         10,
      storageGb:     100,
      retentionDays: 180,
      demoSessions:  null,  // unlimited
      maxEnvironmentsPerApp: 20,
      maxApiKeys:      20,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.ALL_FORMATS },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: true, tier: '180_DAYS' },
      { feature: Feature.ADVANCED_REPORTING,    enabled: true },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: true },
      { feature: Feature.TEAM_COLLABORATION,    enabled: true },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: true },
      { feature: Feature.RBAC,                  enabled: true, tier: FeatureTier.BASIC },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: true },
      { feature: Feature.AUDIT_LOGS,            enabled: false },
      { feature: Feature.API_ACCESS,            enabled: false },
      { feature: Feature.SSO,                   enabled: false },
      { feature: Feature.OIDC,                  enabled: false },
      { feature: Feature.SAML,                  enabled: false },
      { feature: Feature.SELF_HOSTING,          enabled: false },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: false },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           true,
      priorityEmailSupport:   true,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla:          false,
    },
    hasTrial: true,
    trialDays: 14,
    rank: 3,
    audience: ['Startups', 'QA teams', 'Product teams'],
    highlights: ['Everything in Solo', 'Team collaboration', 'Shared dashboards', 'Basic RBAC'],
    exportFormats: ['JSON', 'PDF', 'CSV', 'HTML'],
    eligibleCountries: null,
    supportedCurrencies: ['USD', 'NGN'],
    supportedProviders: ['STRIPE', 'PAYSTACK'],
    contactSales: false,
  },

  // ═══════════════════════════════════════════════════════════
  // BUSINESS
  // ═══════════════════════════════════════════════════════════
  BUSINESS: {
    type: 'BUSINESS',
    name: 'Business',
    description: 'For growing organizations operating multiple applications.',
    isPublic: true,
    sortOrder: 4,
    pricing: {
      monthlyUsd: 29_900,              // $299
      monthlyNgn: 44_700_000,           // ₦447,000
      annualUsd:  299_000,              // $2,990
      annualNgn:  447_000_000,          // ₦4,470,000
    },
    limits: {
      applications:  50,
      users:         50,
      storageGb:     500,
      retentionDays: 365,
      demoSessions:  null,  // unlimited
      maxEnvironmentsPerApp: 50,
      maxApiKeys:      50,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.ALL_FORMATS },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: true, tier: '365_DAYS' },
      { feature: Feature.ADVANCED_REPORTING,    enabled: true },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: true },
      { feature: Feature.TEAM_COLLABORATION,    enabled: true },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: true },
      { feature: Feature.RBAC,                  enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: true },
      { feature: Feature.AUDIT_LOGS,            enabled: true },
      { feature: Feature.API_ACCESS,            enabled: true },
      { feature: Feature.SSO,                   enabled: false },
      { feature: Feature.OIDC,                  enabled: false },
      { feature: Feature.SAML,                  enabled: false },
      { feature: Feature.SELF_HOSTING,          enabled: false },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: true },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           true,
      priorityEmailSupport:   true,
      dedicatedSuccessManager: true,
      architectureAssistance: false,
      enterpriseSla:          false,
    },
    hasTrial: true,
    trialDays: 14,
    rank: 4,
    audience: ['Scale-ups', 'Multiple product teams', 'Governed organizations'],
    highlights: ['Everything in Team', 'Programmatic API access', 'Audit logs', 'Priority processing'],
    exportFormats: ['JSON', 'PDF', 'CSV', 'HTML'],
    eligibleCountries: null,
    supportedCurrencies: ['USD', 'NGN'],
    supportedProviders: ['STRIPE', 'PAYSTACK'],
    contactSales: false,
  },

  // ═══════════════════════════════════════════════════════════
  // ENTERPRISE
  // ═══════════════════════════════════════════════════════════
  ENTERPRISE: {
    type: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For large organizations with governance, compliance, and self-hosting requirements.',
    isPublic: true,
    sortOrder: 5,
    pricing: {
      monthlyUsd: null,  // Custom pricing
      monthlyNgn: null,
      annualUsd:  null,
      annualNgn:  null,
    },
    limits: {
      applications:  9999,   // Effectively unlimited, overridden by contract
      users:         9999,
      storageGb:     9999,
      retentionDays: 9999,
      demoSessions:  null,   // unlimited
      maxEnvironmentsPerApp: 9999,
      maxApiKeys:      9999,
    },
    features: [
      ...CORE_FEATURES,
      { feature: Feature.REPORT_GENERATION,     enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.REPORT_EXPORT,         enabled: true, tier: FeatureTier.ALL_FORMATS },
      { feature: Feature.HISTORICAL_REPORTS,    enabled: true, tier: 'CUSTOM' },
      { feature: Feature.ADVANCED_REPORTING,    enabled: true },
      { feature: Feature.MULTIPLE_ENVIRONMENTS, enabled: true },
      { feature: Feature.TEAM_COLLABORATION,    enabled: true },
      { feature: Feature.SHARED_DASHBOARDS,     enabled: true },
      { feature: Feature.RBAC,                  enabled: true, tier: FeatureTier.ADVANCED },
      { feature: Feature.APPLICATION_PERMISSIONS, enabled: true },
      { feature: Feature.AUDIT_LOGS,            enabled: true },
      { feature: Feature.API_ACCESS,            enabled: true },
      { feature: Feature.SSO,                   enabled: true },
      { feature: Feature.OIDC,                  enabled: true },
      { feature: Feature.SAML,                  enabled: true },
      { feature: Feature.SELF_HOSTING,          enabled: true },
      { feature: Feature.PRIORITY_PROCESSING,   enabled: true },
    ],
    support: {
      communitySupport:       true,
      emailSupport:           true,
      priorityEmailSupport:   true,
      dedicatedSuccessManager: true,
      architectureAssistance: true,
      enterpriseSla:          true,
    },
    hasTrial: false,
    trialDays: 0,
    rank: 5,
    audience: ['Large enterprises', 'Regulated industries', 'Self-hosted deployments'],
    highlights: ['Everything in Business', 'Enterprise identity', 'Negotiated residency and retention', 'Dedicated support'],
    exportFormats: ['JSON', 'PDF', 'CSV', 'HTML'],
    eligibleCountries: null,
    supportedCurrencies: ['USD', 'NGN'],
    supportedProviders: [],
    contactSales: true,
  },
};

/**
 * Helper: Get ordered list of plans for UI display.
 */
export function getOrderedPlans(): PlanDefinition[] {
  return Object.values(PLAN_DEFINITIONS).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Helper: Get a plan definition by type key.
 */
export function getPlanByType(type: PlanTypeKey): PlanDefinition {
  const plan = PLAN_DEFINITIONS[type];
  if (!plan) throw new Error(`Unknown plan type: ${type}`);
  return plan;
}
