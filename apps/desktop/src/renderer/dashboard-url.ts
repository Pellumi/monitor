const DEFAULT_DASHBOARD_URL = "http://localhost:3010";

/** The one place the renderer resolves the web dashboard's base URL. Mirrors main/dashboard-url.ts (the renderer can't import from src/main). */
export function dashboardBaseUrl(): string {
  return (import.meta.env.VITE_TELLANN_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/, "");
}

export function dashboardWebUrl(path: string): string {
  return `${dashboardBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Opens a dashboard path in the system browser, falling back to `window.open` when the Tellann bridge isn't present (e.g. the bare renderer preview). */
export function openDashboardWebUrl(path: string): void {
  const url = dashboardWebUrl(path);
  if (window.tellann?.system?.openExternal) {
    void window.tellann.system.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}
