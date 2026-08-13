import { DashboardEntitlements } from "./types";

export function getDashboardEntitlements(
  plan: "free" | "solo" | "team" | "business" | "enterprise" = "free",
): DashboardEntitlements {
  switch (plan) {
    case "enterprise":
    case "business":
      return {
        canExportPdf: true,
        canExportCsv: true,
        canUseTeamFeatures: true,
        canAccessApi: true,
        canAccessAuditLogs: true,
      };
    case "team":
      return {
        canExportPdf: true,
        canExportCsv: true,
        canUseTeamFeatures: true,
        canAccessApi: true,
        canAccessAuditLogs: false,
      };
    case "solo":
      return {
        canExportPdf: true,
        canExportCsv: true,
        canUseTeamFeatures: false,
        canAccessApi: false,
        canAccessAuditLogs: false,
      };
    case "free":
    default:
      return {
        canExportPdf: false,
        canExportCsv: true,
        canUseTeamFeatures: false,
        canAccessApi: false,
        canAccessAuditLogs: false,
      };
  }
}
