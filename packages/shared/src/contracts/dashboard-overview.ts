/**
 * The dashboard overview contract.
 *
 * This lives in shared rather than in the dashboard because the response used
 * to be assembled in the browser from eight unrelated endpoints, against a type
 * only the browser knew about. Nothing stopped a field from being declared,
 * rendered, and never sent — which is how the dashboard came to show a category
 * no service produced and a coverage bar no service computed. One type, imported
 * by the producer and the consumer, is what keeps that from recurring.
 *
 * @see services/report-engine/src/dashboard-overview.ts — the only producer.
 */

export type DashboardLifecycle =
  | 'NEW_ACCOUNT'
  | 'SDK_SETUP'
  | 'READY_TO_DEMONSTRATE'
  | 'DEMONSTRATION_IN_PROGRESS'
  | 'ANALYSIS_IN_PROGRESS'
  | 'FIRST_ANALYSIS_READY'
  | 'ACTIVE';

export type DashboardMaturity = 'NEW' | 'EARLY' | 'ESTABLISHED';

/**
 * Operational problems the dashboard can actually detect.
 *
 * `INGESTION_PROBLEM` and `PRIVACY_ATTENTION` were removed rather than left
 * declared-but-unemitted. Neither had a producer: ingestion rejections are only
 * ever written to stdout — no dead-letter table, no counter — and there is no
 * privacy configuration in the system that could be wrong. A variant nothing
 * can raise is an invitation to invent a signal for it later.
 *
 * Each variant carries the figures its banner states, so the copy cannot
 * hardcode a number the way the storage banner used to.
 */
export type DashboardHealthIssueKind =
  | 'NO_RECENT_DATA'
  | 'ANALYSIS_FAILED'
  | 'PLAN_LIMIT_REACHED';

export type PlanLimitMetric = 'STORAGE' | 'APPLICATIONS';

export type DashboardHealthIssue =
  | {
      kind: 'NO_RECENT_DATA';
      lastEventAt: string | null;
      hoursSinceLastEvent: number;
    }
  | {
      kind: 'ANALYSIS_FAILED';
      runId: string;
      reportId: string | null;
      failedAt: string | null;
      /** Always `failureReasonSafe` — never a raw error. */
      reason: string | null;
    }
  | {
      kind: 'PLAN_LIMIT_REACHED';
      metric: PlanLimitMetric;
      planName: string;
      /** Megabytes for STORAGE, a count for APPLICATIONS. */
      used: number;
      limit: number;
      usedPercent: number;
      /**
       * What actually stops working. Deliberately not a retention claim: the
       * retention worker deletes by age, never by storage pressure, so the
       * banner's old "older replay assets may be removed" was false.
       */
      consequence: 'NEW_UPLOADS_REJECTED' | 'NEW_APPLICATIONS_BLOCKED';
    };

/**
 * Whether a number is known, and why not when it isn't.
 *
 * The distinction is the point: a coverage of zero and a coverage nobody has
 * measured look identical as numbers and mean opposite things to the person
 * reading them. Producers must never substitute `0` for an absent measurement.
 */
export type MeasurementStatus = 'NOT_MEASURED' | 'INSUFFICIENT_EVIDENCE' | 'MEASURED';

export interface MeasuredValue<T> {
  status: MeasurementStatus;
  value: T | null;
  delta?: number;
  /**
   * What the delta is measured against. "+4.7% since your last analysis" and
   * "+4.7% versus the previous 30 days" are different claims, and a UI that
   * renders them identically is misleading in one of the two cases.
   */
  deltaBasis?: 'PREVIOUS_ANALYSIS' | 'PREVIOUS_WINDOW';
}

export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'NOT_CONFIGURED';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/** Mirrors `MissingStateCategory` in @tellann/rules, which is its only source. */
export type MissingStateCategory = 'LOADING' | 'EMPTY' | 'ERROR' | 'RECOVERY';

/** Mirrors `MissingFlowCategory` in @tellann/rules. */
export type MissingFlowCategory =
  | 'FAILURE'
  | 'ALTERNATIVE'
  | 'RECOVERY'
  | 'RARE'
  | 'EDGE_CASE';

export interface ApplicationContext {
  id: string;
  name: string;
  environment: string;
  environmentId: string | null;
  plan: string;
}

export interface OnboardingMilestones {
  applicationCreated: boolean;
  frontendConnected: boolean;
  backendConnected: boolean;
  telemetryVerified: boolean;
  firstDemonstrationCompleted: boolean;
  firstAnalysisGenerated: boolean;
  firstAnalysisReviewed: boolean;
}

export interface TelemetryStatus {
  frontendStatus: IntegrationStatus;
  backendStatus: IntegrationStatus;
  lastEventAt: string | null;
  eventCount: number;
}

export interface AnalysisStatus {
  status: 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  latestAnalysisId?: string;
  analysisCount: number;
  lastAnalysisAt?: string;
  error?: string;
}

export interface MeasuredSummary {
  workflowsDiscovered: MeasuredValue<number>;
  statesObserved: MeasuredValue<number>;
  transitionsObserved: MeasuredValue<number>;
  sessionCount: MeasuredValue<number>;
  findingsCount: MeasuredValue<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
}

export interface MeasuredCoverage {
  workflowCoverage: MeasuredValue<number>;
  stateCoverage: MeasuredValue<number>;
  transitionCoverage: MeasuredValue<number>;
  /**
   * Observed error and recovery states over those the active ruleset expects.
   * Shares its denominator with missing-state detection, so the tile and the
   * findings list cannot contradict each other.
   */
  errorCoverage: MeasuredValue<number>;
  expectedCoverage?: MeasuredValue<number>;
  /**
   * True when `transitionCoverage` came from reconciliation against a declared
   * flow rather than from observed-vs-inferred transitions. The two are
   * different measurements and the UI must say which one it is showing.
   */
  transitionCoverageFromDeclaredFlow: boolean;
}

export interface DiscoveredWorkflow {
  id: string;
  name: string;
  /**
   * Steps of this workflow re-observed inside the requested environment and
   * window, over the steps its path contains.
   *
   * Scoped deliberately. A Workflow row is built from a session that actually
   * happened, so comparing it against all-time observations returns 100% for
   * every row by construction. NOT_MEASURED when the path has no step, or when
   * the scope produced no observations at all — never 0, which previously
   * rendered as an empty red bar beside a green "Complete" badge.
   */
  coverage: MeasuredValue<number>;
  stateCount: number;
  /** The denominator, so the UI can say "3 of 5 steps" rather than only a percentage. */
  transitionCount: number;
  observedTransitionCount: number;
  /** Null when coverage is unmeasured, so "Complete" is only ever shown when known. */
  missingPathCount: number | null;
  /**
   * Times this exact path has been walked. Application-wide: Workflow has no
   * environment and graph-engine counts every session, so this is not scoped
   * the way `coverage` beside it is. Label it accordingly.
   */
  demonstrationCount: number;
  lastDemonstratedAt: string | null;
  severity: FindingSeverity;
}

export interface MissingStateFinding {
  id: string;
  stateName: string;
  workflowName: string | null;
  /** The detecting rule's classification. Null when the rule had none to give. */
  category: MissingStateCategory | null;
  severity: FindingSeverity;
  evidence: string;
  detectedAt: string;
}

export interface MissingFlowFinding {
  id: string;
  flowName: string;
  workflowName: string | null;
  path: string[];
  category: MissingFlowCategory | null;
  severity: FindingSeverity;
  evidence: string;
  detectedAt: string;
}

export interface CoverageOpportunity {
  id: string;
  workflowId: string | null;
  workflowName: string | null;
  title: string;
  description: string;
  unobservedPathsCount: number;
  suggestedSteps: string[];
}

export interface GraphNodeSummary {
  id: string;
  label: string;
  type: string;
  visitCount?: number;
}

export interface GraphEdgeSummary {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  workflowCount: number;
  entryPointCount: number;
  exitPointCount: number;
  nodes: GraphNodeSummary[];
  edges: GraphEdgeSummary[];
}

export interface RecentSession {
  id: string;
  durationSeconds: number | null;
  eventCount: number | null;
  errorCount: number | null;
  /** The QA run this session belongs to, when it came from one. */
  qaRunId: string | null;
  timestamp: string;
}

export interface ObservedEndpoint {
  id: string;
  method: string;
  path: string;
  /** p95, not the mean: an average hides a bimodal endpoint exactly where it matters. */
  p95Ms: number;
  averageLatencyMs: number;
  callCount: number;
  errorRatePercentage: number;
}

export interface EndpointSummary {
  observedCount: MeasuredValue<number>;
  averageLatencyMs: MeasuredValue<number>;
  /**
   * Share of observed endpoints that are neither slow nor error-prone.
   *
   * Deliberately not called coverage and deliberately not in `MeasuredCoverage`:
   * nothing in the system enumerates the endpoints an application *has*, so
   * there is no denominator a coverage figure could use.
   */
  healthyPercentage: MeasuredValue<number>;
  slowEndpoints: ObservedEndpoint[];
  errorProneEndpoints: ObservedEndpoint[];
}

export interface ReportSummary {
  id: string;
  title: string;
  /**
   * Always 'QA'. QAReport carries no type discriminator, so an executive /
   * technical split would be invented here.
   */
  type: string;
  generatedAt: string;
  runId: string;
}

/** Counts of what the declared flows say should exist. */
export interface ExpectedBehaviorSummary {
  declaredFlowCount: number;
  expectedStateCount: number;
  expectedTransitionCount: number;
}

export interface ReconciliationRowSummary {
  reportId: string;
  flowId: string;
  flowName: string;
  /** 0..100, scaled once from the stored 0..1 score. */
  expectedCoverage: number;
  transitionCoverage: number;
  trueGapStateCount: number;
  trueGapTransitionCount: number;
  undeclaredStateCount: number;
  undeclaredTransitionCount: number;
  generatedAt: string;
  qaRunId: string | null;
}

/**
 * Declared behaviour against observed behaviour.
 *
 * Null when nothing has been declared. An application that has not attempted
 * flow declaration has not scored zero on it, and an empty card with a 0% bar
 * would say otherwise.
 */
export interface ExpectedVsObserved {
  expected: ExpectedBehaviorSummary;
  /** Newest report per flow, most true gaps first. */
  topGaps: ReconciliationRowSummary[];
}

export interface CoverageHistoryPoint {
  /**
   * The coverage snapshot's id. Suitable as a React key and nothing else —
   * nothing routes to an analysis today.
   */
  analysisId: string;
  /** Locale-free, UTC, already disambiguated for same-day analyses. */
  label: string;
  timestamp: string;
  workflow: number;
  state: number;
  transition: number;
}

/**
 * Privacy protection, reduced to what the system can actually evidence.
 *
 * `replayMaskingEnabled` and `customRulesCount` were removed. Masking is
 * unconditional in the SDKs and the browser observer — it is not a setting and
 * cannot be false — and no user-authored privacy-rule model exists anywhere, so
 * a count of them could only ever have been a literal zero presented as a
 * configuration state.
 */
export interface PrivacyStatus {
  /** Protection is applied at capture regardless of configuration. */
  active: true;
  /**
   * Values protected across QA-run evidence in this scope. A real count of real
   * rows — but QA-run scoped, not application-wide: SDK-side redaction happens
   * in the browser and the original value never reaches the server, so it
   * cannot be counted here. The card must say which it is showing.
   */
  protectedFieldCount: MeasuredValue<{
    total: number;
    secrets: number;
    identifiers: number;
  }>;
  captureMaskingEnabled: true;
  /** What the classifier protects, read from its own vocabulary. */
  protectedCategories: string[];
}

export interface PlanUsage {
  planName: string;
  applicationsUsed: number;
  applicationsLimit: number | null;
  storageUsedMb: number;
  storageLimitMb: number | null;
  retentionDays: number | null;
}

export interface LiveDemonstrationStats {
  id: string;
  startedAt: string;
  eventCount: number;
  /**
   * Distinct declared states reached, and transitions taken.
   *
   * Null for an observational run. Flow progress is only recorded against a
   * declared flow version — without one every progress event is quarantined, so
   * these would read a structural `0` that means "no flow declared", not "no
   * progress made".
   */
  stateCount: number | null;
  transitionCount: number | null;
  apiCallCount: number;
  /**
   * Runtime, page-crash and backend errors. Console errors carry their level
   * inside the event payload rather than in the event type, so counting them
   * would mean scanning a run's whole evidence on every poll; they are excluded.
   */
  errorCount: number;
}

/** Echoes the window actually applied, which may be narrower than the one asked for. */
export interface DashboardWindow {
  range: string;
  from: string | null;
  to: string | null;
}

export interface DashboardOverviewResponse {
  lifecycle: DashboardLifecycle;
  maturity: DashboardMaturity;
  window: DashboardWindow;
  application: ApplicationContext;
  onboarding: OnboardingMilestones;
  telemetry: TelemetryStatus;
  analysis: AnalysisStatus;
  summary: MeasuredSummary;
  coverage: MeasuredCoverage;
  workflows: DiscoveredWorkflow[];
  missingStates: MissingStateFinding[];
  missingFlows: MissingFlowFinding[];
  opportunities: CoverageOpportunity[];
  graph: GraphSummary;
  sessions: RecentSession[];
  endpoints: EndpointSummary | null;
  reports: ReportSummary[];
  coverageHistory: CoverageHistoryPoint[];
  /** True when older analyses exist beyond the returned series. */
  coverageHistoryTruncated: boolean;
  expectedVsObserved: ExpectedVsObserved | null;
  privacy: PrivacyStatus | null;
  usage: PlanUsage | null;
  liveDemonstration: LiveDemonstrationStats | null;
  healthIssues: DashboardHealthIssue[];
}

/** The ranges the overview endpoint accepts. */
export const DASHBOARD_RANGES = ['latest', '7d', '30d', 'all'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export function isDashboardRange(value: unknown): value is DashboardRange {
  return typeof value === 'string' && (DASHBOARD_RANGES as readonly string[]).includes(value);
}
