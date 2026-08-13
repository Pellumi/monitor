export type DashboardLifecycle =
  | "NEW_ACCOUNT"
  | "SDK_SETUP"
  | "READY_TO_DEMONSTRATE"
  | "DEMONSTRATION_IN_PROGRESS"
  | "ANALYSIS_IN_PROGRESS"
  | "FIRST_ANALYSIS_READY"
  | "ACTIVE";

export type DashboardMaturity = "NEW" | "EARLY" | "ESTABLISHED";

export type DashboardHealthIssue =
  | "INGESTION_PROBLEM"
  | "ANALYSIS_FAILED"
  | "NO_RECENT_DATA"
  | "PRIVACY_ATTENTION"
  | "PLAN_LIMIT_REACHED";

export type MeasurementStatus =
  | "NOT_MEASURED"
  | "INSUFFICIENT_EVIDENCE"
  | "MEASURED";

export interface MeasuredValue<T> {
  status: MeasurementStatus;
  value: T | null;
  delta?: number;
}

export type IntegrationStatus = "ACTIVE" | "INACTIVE" | "NOT_CONFIGURED";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type MissingStateCategory = "LOADING" | "EMPTY" | "ERROR" | "RECOVERY";

export type MissingFlowCategory =
  | "FAILURE"
  | "ALTERNATIVE"
  | "RECOVERY"
  | "RARE"
  | "EDGE_CASE";

export interface ApplicationContext {
  id: string;
  name: string;
  environment: "demo" | "development" | "staging" | "production";
  plan: "free" | "solo" | "team" | "business" | "enterprise";
}

export interface OnboardingMilestones {
  applicationCreated: boolean;
  frontendConnected: boolean;
  backendConnected: boolean;
  telemetryVerified: boolean;
  firstDemonstrationCompleted: boolean;
  firstAnalysisReviewed: boolean;
}

export interface TelemetryStatus {
  frontendStatus: IntegrationStatus;
  backendStatus: IntegrationStatus;
  lastEventAt: string | null;
  eventCount: number;
}

export interface AnalysisStatus {
  status: "NOT_STARTED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStage?: string;
  completedStages?: string[];
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
  endpointCoverage: MeasuredValue<number>;
  errorCoverage: MeasuredValue<number>;
  expectedCoverage?: MeasuredValue<number>;
}

export interface DiscoveredWorkflow {
  id: string;
  name: string;
  coverage: number;
  stateCount: number;
  missingPathCount: number;
  demonstrationCount: number;
  lastDemonstratedAt?: string;
  severity: FindingSeverity;
}

export interface MissingStateFinding {
  id: string;
  stateName: string;
  workflowName: string;
  category: MissingStateCategory;
  severity: FindingSeverity;
  evidence: string;
}

export interface MissingFlowFinding {
  id: string;
  flowName: string;
  workflowName: string;
  path: string[];
  category: MissingFlowCategory;
  severity: FindingSeverity;
  evidence: string;
}

export interface CoverageOpportunity {
  id: string;
  workflowId: string;
  workflowName: string;
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
  type: "Guided" | "Exploratory" | "Validation";
  durationSeconds: number;
  eventCount: number;
  workflowCount: number;
  findingsCount: number;
  timestamp: string;
  completenessPercentage: number;
}

export interface SlowEndpoint {
  id: string;
  method: string;
  path: string;
  averageLatencyMs: number;
  callCount: number;
}

export interface ErrorProneEndpoint {
  id: string;
  method: string;
  path: string;
  errorRatePercentage: number;
  errorCount: number;
}

export interface EndpointSummary {
  observedCount: MeasuredValue<number>;
  averageLatencyMs: MeasuredValue<number>;
  slowEndpoints: SlowEndpoint[];
  errorProneEndpoints: ErrorProneEndpoint[];
}

export interface ReportSummary {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  downloadUrl?: string;
}

export interface CoverageHistoryPoint {
  analysisId: string;
  label: string;
  timestamp: string;
  workflow: number;
  state: number;
  transition: number;
  endpoint?: number;
}

export interface PrivacyStatus {
  active: boolean;
  sensitiveFieldsBlockedCount: number;
  replayMaskingEnabled: boolean;
  customRulesCount: number;
}

export interface PlanUsage {
  planName: string;
  applicationsUsed: number;
  applicationsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  retentionDays: number;
}

export interface LiveDemonstrationStats {
  id: string;
  durationSeconds: number;
  eventCount: number;
  stateCount: number;
  transitionCount: number;
  apiCallCount: number;
  errorCount: number;
  recentEvents: Array<{
    timestamp: string;
    type: string;
    description: string;
  }>;
}

export interface DashboardOverviewResponse {
  lifecycle: DashboardLifecycle;
  maturity: DashboardMaturity;
  application: ApplicationContext;
  onboarding: OnboardingMilestones;
  telemetry: TelemetryStatus;
  analysis: AnalysisStatus;
  summary?: MeasuredSummary;
  coverage?: MeasuredCoverage;
  workflows?: DiscoveredWorkflow[];
  missingStates?: MissingStateFinding[];
  missingFlows?: MissingFlowFinding[];
  opportunities?: CoverageOpportunity[];
  graph?: GraphSummary;
  sessions?: RecentSession[];
  endpoints?: EndpointSummary;
  reports?: ReportSummary[];
  coverageHistory?: CoverageHistoryPoint[];
  privacy?: PrivacyStatus;
  usage?: PlanUsage;
  liveDemonstration?: LiveDemonstrationStats | null;
  healthIssues: DashboardHealthIssue[];
}

export type UserRole =
  | "DEVELOPER"
  | "QA_ENGINEER"
  | "ENGINEERING_MANAGER"
  | "PRODUCT_MANAGER"
  | "ORGANIZATION_ADMIN";

export interface DashboardEntitlements {
  canExportPdf: boolean;
  canExportCsv: boolean;
  canUseTeamFeatures: boolean;
  canAccessApi: boolean;
  canAccessAuditLogs: boolean;
}
