/**
 * Historical context for the endpoints a QA run exercised.
 *
 * A run reports that `POST /checkout` took 2,400 ms at p95. On its own that is
 * a number with nothing to compare it against: the reader cannot tell whether
 * the route is always slow or whether this run made it slow. The endpoint
 * engine holds the same route's behaviour over the last weeks, so the report
 * quotes it beside the run's own figure.
 *
 * The two stay separate computations on purpose. The report is derived from
 * persisted evidence and must remain reproducible from Postgres alone, so this
 * is strictly additive: every failure degrades to "no baseline" and leaves the
 * run's own numbers exactly as measured.
 */
import { Services, canonicalRoute } from '@tellann/shared';

const ENDPOINT_ENGINE_URL = (
  process.env.ENDPOINT_ENGINE_URL || `http://localhost:${Services.ENDPOINT_ENGINE}`
).replace(/\/$/, '');

/** Routes one lookup asks about, so a wide run cannot build an unbounded URL. */
const MAX_BASELINE_ROUTES = 100;

export type EndpointBaseline = {
  route: string;
  method: string;
  requestCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  errorRate: number | null;
};

export type BaselineOutcome = {
  /**
   * `READY:<days>d`, `NOT_CONFIGURED` when there is no endpoint engine to ask,
   * or `UNAVAILABLE:<reason>`. Published so a reader can tell "this route has
   * no history" from "we could not look".
   */
  status: string;
  windowDays: number | null;
  byRoute: Map<string, EndpointBaseline>;
};

export const NO_BASELINE: BaselineOutcome = {
  status: 'NOT_CONFIGURED',
  windowDays: null,
  byRoute: new Map(),
};

function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 200);
}

/** The key both sides agree on: method plus the canonical route template. */
export function baselineKey(method: string, route: string): string {
  return `${method.toUpperCase()} ${canonicalRoute(route)}`;
}

export async function fetchEndpointBaselines(input: {
  applicationId: string;
  environmentId: string | null;
  /** Excluded from its own baseline, so a slow run cannot flatter itself. */
  runId: string;
  routes: Array<{ method: string; route: string }>;
  timeoutMs?: number;
}): Promise<BaselineOutcome> {
  if (!input.routes.length) return { ...NO_BASELINE, status: 'NO_ROUTES' };
  const secret = process.env.ENDPOINT_ENGINE_INTERNAL_SECRET?.trim();
  if (!process.env.ENDPOINT_ENGINE_URL && !secret && process.env.NODE_ENV === 'production') {
    return NO_BASELINE;
  }

  const routes = [...new Set(input.routes.map((entry) => canonicalRoute(entry.route)))]
    .slice(0, MAX_BASELINE_ROUTES);
  const params = new URLSearchParams({
    excludeRunId: input.runId,
    routes: routes.join(','),
  });
  if (input.environmentId) params.set('environmentId', input.environmentId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 5_000);
  try {
    const response = await fetch(
      `${ENDPOINT_ENGINE_URL}/endpoints/${input.applicationId}/baseline?${params.toString()}`,
      { headers: secret ? { 'x-tellann-internal-secret': secret } : {}, signal: controller.signal },
    );
    if (!response.ok) return { ...NO_BASELINE, status: `UNAVAILABLE:HTTP_${response.status}` };
    const payload = await response.json() as {
      windowDays?: number;
      routes?: Array<Record<string, unknown>>;
    };
    const byRoute = new Map<string, EndpointBaseline>();
    for (const row of payload.routes ?? []) {
      const route = String(row.route ?? '');
      const method = String(row.method ?? 'GET');
      if (!route) continue;
      byRoute.set(baselineKey(method, route), {
        route,
        method,
        requestCount: Number(row.requestCount) || 0,
        p50Ms: row.p50Ms === null || row.p50Ms === undefined ? null : Number(row.p50Ms),
        p95Ms: row.p95Ms === null || row.p95Ms === undefined ? null : Number(row.p95Ms),
        errorRate: row.errorRate === null || row.errorRate === undefined ? null : Number(row.errorRate),
      });
    }
    const windowDays = Number(payload.windowDays) || null;
    return { status: `READY:${windowDays ?? '?'}d`, windowDays, byRoute };
  } catch (error) {
    return { ...NO_BASELINE, status: `UNAVAILABLE:${safeReason(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How a run's p95 compares with the route's own recent history.
 *
 * `requestCount` travels with the verdict: "3× slower than usual" computed
 * over four prior requests is not the same claim as the same ratio over four
 * thousand, and a reader cannot tell them apart from the ratio alone.
 */
export function compareToBaseline(
  runP95: number | null,
  baseline: EndpointBaseline | undefined,
): { p95Ms: number | null; samples: number; ratio: number | null; verdict: 'SLOWER' | 'FASTER' | 'TYPICAL' } | null {
  if (!baseline || baseline.p95Ms === null || runP95 === null) return null;
  const ratio = baseline.p95Ms > 0 ? Math.round((runP95 / baseline.p95Ms) * 100) / 100 : null;
  const verdict = ratio === null || (ratio > 0.75 && ratio < 1.5)
    ? 'TYPICAL'
    : ratio >= 1.5 ? 'SLOWER' : 'FASTER';
  return { p95Ms: baseline.p95Ms, samples: baseline.requestCount, ratio, verdict };
}
