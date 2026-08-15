import {
  DashboardLifecycle,
  DashboardMaturity,
  DashboardHealthIssue,
  DashboardOverviewResponse,
} from "./types";

export interface EvaluatedDashboardState {
  lifecycle: DashboardLifecycle;
  maturity: DashboardMaturity;
  healthIssues: DashboardHealthIssue[];
}

export function evaluateDashboardState(
  response: Partial<DashboardOverviewResponse> | null | undefined,
  hasApplications: boolean,
  firstAnalysisAcknowledged: boolean = false,
): EvaluatedDashboardState {
  if (!hasApplications || !response?.application) {
    return {
      lifecycle: "NEW_ACCOUNT",
      maturity: "NEW",
      healthIssues: [],
    };
  }

  const healthIssues: DashboardHealthIssue[] = response.healthIssues ?? [];

  if (response.liveDemonstration != null) {
    return {
      lifecycle: "DEMONSTRATION_IN_PROGRESS",
      maturity: response.maturity ?? "NEW",
      healthIssues,
    };
  }

  if (response.analysis?.status === "PROCESSING" || response.analysis?.status === "QUEUED") {
    return {
      lifecycle: "ANALYSIS_IN_PROGRESS",
      maturity: response.maturity ?? "NEW",
      healthIssues,
    };
  }

  const { onboarding, analysis } = response;
  const analysisCount = analysis?.analysisCount ?? 0;

  if (!onboarding?.frontendConnected && !onboarding?.backendConnected) {
    return {
      lifecycle: "SDK_SETUP",
      maturity: "NEW",
      healthIssues,
    };
  }

  if (analysisCount === 0) {
    return {
      lifecycle: onboarding?.firstDemonstrationCompleted
        ? "ANALYSIS_IN_PROGRESS"
        : "READY_TO_DEMONSTRATE",
      maturity: "NEW",
      healthIssues,
    };
  }

  if (analysisCount === 1 && !firstAnalysisAcknowledged) {
    return {
      lifecycle: "FIRST_ANALYSIS_READY",
      maturity: "NEW",
      healthIssues,
    };
  }

  return {
    lifecycle: "ACTIVE",
    maturity: response.maturity ?? (analysisCount > 10 ? "ESTABLISHED" : "EARLY"),
    healthIssues,
  };
}
