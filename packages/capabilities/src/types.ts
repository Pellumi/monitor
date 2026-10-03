import type {
  ApplicationTraits,
  ApplicationType,
  CapabilityReasonCode,
  CapabilityState,
} from '@tellann/desktop-contracts';
import type { Feature } from '@tellann/shared';

export type { ApplicationTraits, ApplicationType, CapabilityReasonCode, CapabilityState };

/** Effective type the resolver reasons about. UNKNOWN is handled as a separate branch. */
export type ApplicationTypeKey = Exclude<ApplicationType, 'UNKNOWN'>;

export type TraitKey = keyof ApplicationTraits;

/** Tracks Tellann can capture from. Mirrors desktop-contracts `captureTracks` plus the browser observer. */
export type InstrumentationTrack = 'FRONTEND_SDK' | 'BACKEND_SDK' | 'BROWSER_OBSERVER';

/** Evidence sources aggregated into ApplicationEvidenceSummary (doc §19). */
export type EvidenceKey =
  | 'FRONTEND_EVENTS'
  | 'BACKEND_EVENTS'
  | 'BROWSER_EVENTS'
  | 'SESSIONS'
  | 'IN_FLOW_EVENTS'
  | 'ENDPOINT_EVENTS'
  | 'BEHAVIOR_GRAPH'
  | 'DECLARED_INTENT';

/** Limited modes name the evidence scope a partial capability is honest about (doc §17). */
export type LimitedMode = 'CLIENT_API_ACTIVITY' | 'BACKEND_DETERMINISTIC_ONLY';

export type RuleScope = 'FRONTEND' | 'BACKEND' | 'CROSS_LAYER';

export type NavigationSection = 'OVERVIEW' | 'BEHAVIOR' | 'API_INTELLIGENCE' | 'QUALITY';

export interface CapabilityApplicability {
  /** Effective types this capability applies to (doc §14 matrix). */
  types: ApplicationTypeKey[];
  /**
   * When present, the application must also have at least one of these traits.
   * Lets a frontend app that consumes APIs qualify for Endpoint Intelligence (Limited)
   * without making every frontend app qualify.
   */
  traitsAnyOf?: TraitKey[];
}

export interface LimitedModeRule {
  mode: LimitedMode;
  /** Tracks that must be connected for this mode to apply. */
  whenConnected: InstrumentationTrack[];
  /** Tracks that must be absent for this mode to apply. */
  whenAbsent: InstrumentationTrack[];
}

export interface CapabilityNavigation {
  section: NavigationSection;
  /** Dashboard route, or null for capabilities surfaced only inside other pages or reports. */
  route: string | null;
}

export interface CapabilityDefinition {
  key: CapabilityKey;
  name: string;
  /** `DISABLED` and `FUTURE` resolve to UNAVAILABLE regardless of anything else. */
  productStatus: 'AVAILABLE' | 'DISABLED' | 'FUTURE';
  /** Plan entitlement this capability is gated on. Undefined = not plan-gated. */
  entitlementKey?: Feature;
  applicability: CapabilityApplicability;
  /** Reason reported when the application is outside `applicability`. */
  notApplicableReason: CapabilityReasonCode;
  /** Satisfied when at least one listed track is connected. */
  instrumentationAnyOf: InstrumentationTrack[];
  /** Partial modes used when instrumentation is incomplete. */
  limitedModes: LimitedModeRule[];
  /** Satisfied when at least one listed evidence source has been observed. */
  evidenceAnyOf: EvidenceKey[];
  ruleScope: RuleScope;
  navigation: CapabilityNavigation;
  /** Report section identifiers this capability contributes (doc §28). */
  reportSections: string[];
  /** Plan-locked capabilities are shown with an upgrade path, or hidden. */
  planLockedBehaviour: 'SHOW_LOCKED' | 'HIDE';
}

/**
 * Every capability the product can expose. The registry is the only list; pages and
 * APIs refer to these keys, never to plan feature names or application types.
 */
export const CAPABILITY_KEYS = [
  'OVERVIEW',
  'CODEBASE_INTELLIGENCE',
  'FLOW_DECLARATION',
  'BEHAVIORAL_GRAPH',
  'RECONCILIATION',
  'GRAPH_DRIFT',
  'WORKFLOW_DISCOVERY',
  'COVERAGE',
  'MISSING_STATES',
  'MISSING_FLOWS',
  'SESSION_TIMELINE',
  'BROWSER_REPLAY',
  'UI_INTERACTION_ANALYSIS',
  'VISUAL_ANALYSIS',
  'ACCESSIBILITY_ANALYSIS',
  'BROWSER_TRACE',
  'ENDPOINT_INTELLIGENCE',
  'SERVER_ERROR_ANALYSIS',
  'SERVER_LATENCY',
  'GUIDED_BROWSER_DEMONSTRATION',
  'QA_RUNS',
  'REPORTS',
  'ADVANCED_REPORTING',
  'NOTIFICATIONS',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
