/**
 * Dashboard types.
 *
 * The response shape now lives in `@tellann/shared` and is imported by both the
 * producer (report-engine) and this consumer. It used to be declared here only,
 * which is how fields came to be rendered that no service ever sent.
 *
 * Only genuinely client-side concepts are declared below.
 */

export type {
  AnalysisStatus,
  ApplicationContext,
  CoverageHistoryPoint,
  CoverageOpportunity,
  DashboardHealthIssue,
  DashboardLifecycle,
  DashboardMaturity,
  DashboardOverviewResponse,
  DashboardRange,
  DashboardWindow,
  DiscoveredWorkflow,
  EndpointSummary,
  FindingSeverity,
  GraphEdgeSummary,
  GraphNodeSummary,
  GraphSummary,
  IntegrationStatus,
  LiveDemonstrationStats,
  MeasuredCoverage,
  MeasuredSummary,
  MeasuredValue,
  MeasurementStatus,
  MissingFlowCategory,
  MissingFlowFinding,
  MissingStateCategory,
  MissingStateFinding,
  ObservedEndpoint,
  OnboardingMilestones,
  PlanUsage,
  PrivacyStatus,
  RecentSession,
  ReportSummary,
  TelemetryStatus,
} from '@tellann/shared/dashboard-contract';

/**
 * Which layout the overview arranges its cards into.
 *
 * A working preference, not an identity: organisation roles are
 * OWNER/ADMIN/MEMBER/VIEWER and say nothing about whether someone reads this
 * page as a developer or a product manager.
 */
export type UserRole =
  | "DEVELOPER"
  | "QA_ENGINEER"
  | "ENGINEERING_MANAGER"
  | "PRODUCT_MANAGER"
  | "ORGANIZATION_ADMIN";

/**
 * What the current plan permits, resolved from the organisation's entitlement.
 *
 * Never computed from a plan name on the client: doing that had already drifted
 * from the server's own plan definitions in three places.
 */
export interface DashboardEntitlements {
  canExportPdf: boolean;
  canExportCsv: boolean;
  canUseTeamFeatures: boolean;
  canAccessApi: boolean;
  canAccessAuditLogs: boolean;
  canUseMultipleEnvironments: boolean;
}
