export type QARunMode = "OBSERVATION_ONLY" | "ASSISTED" | "GUIDED";

export type QARunEnvironment = {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  isDefault: boolean;
};

export function resolveQARunEnvironment(
  environments: QARunEnvironment[] | undefined,
  requestedEnvironmentId?: string | null,
): QARunEnvironment | undefined {
  if (!environments?.length) return undefined;
  return (
    environments.find((environment) => environment.id === requestedEnvironmentId) ??
    environments.find((environment) => environment.isDefault) ??
    environments[0]
  );
}

export function normalizeQARunMode(value?: string | null): QARunMode {
  const normalized = value?.toUpperCase().replaceAll("-", "_");
  if (normalized === "ASSISTED" || normalized === "GUIDED") return normalized;
  return "OBSERVATION_ONLY";
}

export function buildQARunDesktopDeepLink(input: {
  applicationId: string;
  environmentId?: string | null;
  workflowId?: string | null;
  mode: QARunMode;
  targetUrl?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("applicationId", input.applicationId);
  if (input.environmentId) params.set("environmentId", input.environmentId);
  if (input.workflowId) params.set("flowId", input.workflowId);
  params.set("mode", input.mode);
  const targetUrl = sanitizeQARunTargetUrl(input.targetUrl);
  if (targetUrl) params.set("targetUrl", targetUrl);
  return `tellann://qa-runs/new?${params.toString()}`;
}

export function sanitizeQARunTargetUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    const names = [...new Set(url.searchParams.keys())].sort();
    url.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

type FunnelEventName =
  | "qa_run_handoff_viewed"
  | "qa_run_handoff_opened"
  | "qa_run_handoff_abandoned";

type FunnelContext = {
  applicationId: string;
  environmentId?: string;
  workflowId?: string;
  mode: QARunMode;
  hasTargetUrl: boolean;
};

const PENDING_HANDOFF_KEY = "tellann_qa_run_handoff_pending";

/**
 * Provider-neutral dashboard telemetry. A host analytics integration can listen
 * for `tellann:analytics`; performance marks keep the funnel visible in browser
 * diagnostics without blocking or delaying the desktop protocol handoff.
 */
export function recordQARunFunnelEvent(
  eventName: FunnelEventName,
  context: FunnelContext,
  timing?: { elapsedMs?: number },
): void {
  if (typeof window === "undefined") return;
  const detail = { eventName, occurredAt: new Date().toISOString(), ...context, ...timing };
  window.performance?.mark?.(`tellann:${eventName}`);
  window.dispatchEvent(new CustomEvent("tellann:analytics", { detail }));
}

export function beginQARunHandoffFunnel(context: FunnelContext): void {
  if (typeof window === "undefined") return;
  try {
    const previous = window.sessionStorage.getItem(PENDING_HANDOFF_KEY);
    if (previous) {
      const parsed = JSON.parse(previous) as { context?: FunnelContext; startedAt?: number } & FunnelContext;
      const previousContext = parsed.context ?? parsed;
      recordQARunFunnelEvent("qa_run_handoff_abandoned", previousContext, {
        elapsedMs: parsed.startedAt ? Math.max(0, Date.now() - parsed.startedAt) : undefined,
      });
    }
    window.sessionStorage.setItem(PENDING_HANDOFF_KEY, JSON.stringify({ context, startedAt: Date.now() }));
  } catch {
    // Funnel diagnostics must never stop a user from reaching Desktop.
  }
  recordQARunFunnelEvent("qa_run_handoff_viewed", context);
}

export function completeQARunHandoffFunnel(context: FunnelContext): void {
  if (typeof window === "undefined") return;
  let elapsedMs: number | undefined;
  try {
    const pending = window.sessionStorage.getItem(PENDING_HANDOFF_KEY);
    if (pending) {
      const parsed = JSON.parse(pending) as { startedAt?: number };
      if (parsed.startedAt) elapsedMs = Math.max(0, Date.now() - parsed.startedAt);
    }
    window.sessionStorage.removeItem(PENDING_HANDOFF_KEY);
  } catch {
    // Funnel diagnostics must never stop a user from reaching Desktop.
  }
  recordQARunFunnelEvent("qa_run_handoff_opened", context, { elapsedMs });
}
