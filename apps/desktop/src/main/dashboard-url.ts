const DEFAULT_DASHBOARD_URL = "http://localhost:3010";

/** The one place the main process resolves the web dashboard's base URL. */
export function dashboardBaseUrl(): string {
  return (process.env.TELLANN_DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL).replace(/\/$/, "");
}

/** Builds an `http(s)` URL under the dashboard, throwing if the configured base isn't http(s). */
export function resolveDashboardWebUrl(path: string): URL {
  const url = new URL(path, dashboardBaseUrl());
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("DASHBOARD_URL_BLOCKED");
  return url;
}
