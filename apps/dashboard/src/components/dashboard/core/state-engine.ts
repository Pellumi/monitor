import {
  DashboardHealthIssue,
  DashboardLifecycle,
  DashboardMaturity,
  DashboardOverviewResponse,
} from "./types";

export interface EvaluatedDashboardState {
  lifecycle: DashboardLifecycle;
  maturity: DashboardMaturity;
  healthIssues: DashboardHealthIssue[];
}

/**
 * Reads the state the server decided.
 *
 * This function used to re-derive the lifecycle from a different set of inputs
 * and discard the one in the response, so the two could — and did — disagree.
 * The server is now the only place a lifecycle is computed; the single case
 * left here is the one the server cannot answer, because it is about the
 * account rather than an application.
 */
export function evaluateDashboardState(
  response: DashboardOverviewResponse | null | undefined,
  hasApplications: boolean,
): EvaluatedDashboardState {
  if (!hasApplications) {
    return { lifecycle: "NEW_ACCOUNT", maturity: "NEW", healthIssues: [] };
  }

  // Applications exist but the overview has not arrived. Reporting NEW_ACCOUNT
  // here told people with applications to go and create one; the caller shows a
  // loading or error state instead.
  if (!response) {
    return { lifecycle: "ACTIVE", maturity: "NEW", healthIssues: [] };
  }

  return {
    lifecycle: response.lifecycle,
    maturity: response.maturity,
    healthIssues: response.healthIssues ?? [],
  };
}
