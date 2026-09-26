import { initTracing } from '@tellann/telemetry';
initTracing('endpoint-engine');

import express, { Request, Response } from 'express';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { Kafka, EachMessagePayload } from 'kafkajs';
import { MemberRole, PrismaClient } from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { Feature, TellannEvent, Topics, Services, canonicalRoute, canonicalRouteFromPath, kafkaEnabled } from '@tellann/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@tellann/email';
import { createCallerGuards, type CallerRequest } from './auth';

// ─────────────────────────────────────────────────────────────
// ClickHouse setup
// ─────────────────────────────────────────────────────────────

const ch: ClickHouseClient = createClient({
  url:      process.env.CLICKHOUSE_HOST     ?? 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DATABASE ?? 'tellann',
  username: process.env.CLICKHOUSE_USER     ?? 'tellann',
  password: process.env.CLICKHOUSE_PASSWORD ?? 'password',
});
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);
const { verifyCaller, requireApplicationAccess } = createCallerGuards(prisma, {
  serviceName: 'EndpointEngine',
  internalSecretEnv: 'ENDPOINT_ENGINE_INTERNAL_SECRET',
});

/**
 * The endpoint metrics table.
 *
 * Versioned rather than altered because the previous `endpoint_metrics` was
 * created by two services with disagreeing definitions — this one and the
 * ClickHouse ingester — and `CREATE TABLE IF NOT EXISTS` means whichever booted
 * first won while the other silently inserted against missing columns. This
 * service is now the sole owner; the ingester's copy has been removed.
 *
 * Three things the old table could not express:
 *
 * - `route` is the framework's matched template, so a thousand calls to
 *   `/orders/17` group as one endpoint rather than a thousand. The concrete
 *   `endpoint` is kept beside it for drill-down.
 * - `environment_id` and `run_id` scope a query to one environment or one QA
 *   run. `run_id` also lets a run be *excluded* from the baseline it is being
 *   compared against, so a slow run cannot pollute its own comparison.
 * - A TTL, so the table stops growing forever. It is a backstop ceiling, not
 *   the retention policy: per-tenant `retentionDays` is enforced by the
 *   retention sweeper and clamped in the query below.
 *
 * Empty string rather than Nullable for the scope columns, so they can sit in
 * ORDER BY and keep predicates simple — matching the existing `session_id`
 * convention.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS endpoint_metrics_v2 (
  application_id   String,
  environment_id   String,
  run_id           String,
  route            String,
  endpoint         String,
  method           LowCardinality(String),
  status_code      UInt16,
  duration_ms      UInt32,
  session_id       String,
  trace_id         String,
  request_id       String,
  recorded_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(recorded_at)
ORDER BY (application_id, environment_id, route, method, recorded_at)
TTL recorded_at + INTERVAL 400 DAY
`;

const METRICS_TABLE = 'endpoint_metrics_v2';

async function ensureTable(): Promise<void> {
  await ch.command({ query: DDL });
  console.log(`[EndpointEngine] ClickHouse table ${METRICS_TABLE} ready`);
}

// ─────────────────────────────────────────────────────────────
// Kafka consumer
// ─────────────────────────────────────────────────────────────

const kafka = new Kafka({
  clientId: 'tellann-endpoint-engine',
  brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'endpoint-engine-group' });

async function processEvent({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  try {
    const event: TellannEvent = JSON.parse(message.value.toString());

    if (event.eventType !== 'API_REQUEST') return; // only care about API events

    const m = event.metadata as {
      endpoint?: string;
      route?: string;
      method?: string;
      statusCode?: number;
      durationMs?: number;
      sessionId?: string;
      requestId?: string;
    };

    if (!m.endpoint || !m.method || m.statusCode == null || m.durationMs == null) return;

    // The framework's matched template when the SDK reported one; otherwise the
    // concrete path with identifier-shaped segments collapsed. Either way the
    // grouping key is reduced by the same shared function the QA report uses,
    // so the two systems can be compared against each other at all.
    const route = m.route ? canonicalRoute(m.route) : canonicalRouteFromPath(m.endpoint);

    await ch.insert({
      table: METRICS_TABLE,
      values: [{
        application_id: event.applicationId,
        environment_id: event.environmentId ?? '',
        run_id:         event.runId ?? '',
        route,
        endpoint:       m.endpoint,
        method:         m.method.toUpperCase(),
        status_code:    m.statusCode,
        duration_ms:    m.durationMs,
        session_id:     event.sessionId ?? '',
        trace_id:       event.traceId ?? '',
        request_id:     m.requestId ?? '',
      }],
      format: 'JSONEachRow',
    });
  } catch (err) {
    console.error('[EndpointEngine] Failed to process event', err);
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP API
// ─────────────────────────────────────────────────────────────

interface EndpointStats {
  /** The framework's matched template — the grouping key. */
  route: string;
  /** One concrete path that matched it, for drill-down. */
  endpoint: string;
  method: string;
  requestCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
}

interface EndpointRow extends EndpointStats {
  recommendation: string;
}

/** Default reporting window. A verdict over all history is not actionable. */
const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
/** Calls before a route is worth ranking or judging. */
const MIN_VOLUME_FOR_RANKING = 5;
/** Routes one baseline request may ask about. */
const MAX_BASELINE_ROUTES = 200;
/**
 * Thresholds, aligned with the QA report's backend rules so the two systems
 * do not disagree about what "slow" means for the same endpoint.
 *
 * The QA report judges a request on absolute duration and on a multiple of the
 * endpoint's own median (`classifyBackendLatency` in @tellann/browser-observer).
 * This mirrors both, and reads them off p95 rather than the mean: an average
 * hides a bimodal endpoint precisely where it matters most.
 */
const SLOW_REQUEST_MS = 1_000;
const WATCH_REQUEST_MS = 500;
const SLOW_BASELINE_MULTIPLE = 3;
const ERROR_RATE_THRESHOLD = 0.05;

function isSlow(stats: EndpointStats): boolean {
  if (stats.p95Ms > SLOW_REQUEST_MS) return true;
  // A route that is normally fast and occasionally is not never trips an
  // absolute floor, but it is exactly what a user notices.
  return stats.p50Ms > 0 && stats.p95Ms >= stats.p50Ms * SLOW_BASELINE_MULTIPLE;
}

function recommendationFor(stats: EndpointStats): string {
  const slow = isSlow(stats);
  const errorProne = stats.errorRate > ERROR_RATE_THRESHOLD;
  if (slow && errorProne) return 'Critical — both slow and error-prone. Immediate investigation required.';
  if (slow && stats.p95Ms > SLOW_REQUEST_MS) return 'Investigate performance — p95 latency exceeds 1 second.';
  if (slow) return `Investigate consistency — p95 is ${Math.round(stats.p95Ms / Math.max(stats.p50Ms, 1))}× the median for this route.`;
  if (errorProne) return 'Error rate above 5% — review error handling and upstream dependencies.';
  if (stats.p95Ms > WATCH_REQUEST_MS) return 'Monitor — p95 latency approaching threshold.';
  return 'Healthy.';
}

/**
 * The window a query may actually read.
 *
 * Clamped to the organization's plan retention, because endpoint metrics are
 * subject to the same retention promise as every other record — a 14-day plan
 * must not be served 90 days of history just because ClickHouse still holds it.
 */
async function resolveWindow(
  organizationId: string | null,
  requested: unknown,
): Promise<{ requestedDays: number; effectiveDays: number; clampedByRetention: boolean }> {
  const parsed = Number(requested);
  const requestedDays = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_WINDOW_DAYS, Math.floor(parsed))
    : DEFAULT_WINDOW_DAYS;
  if (!organizationId) return { requestedDays, effectiveDays: requestedDays, clampedByRetention: false };
  try {
    const entitlement = await entitlementChecker.getEntitlement(organizationId);
    const retentionDays = Number(entitlement.limits?.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return { requestedDays, effectiveDays: requestedDays, clampedByRetention: false };
    }
    const effectiveDays = Math.min(requestedDays, Math.floor(retentionDays));
    return { requestedDays, effectiveDays, clampedByRetention: effectiveDays < requestedDays };
  } catch (err) {
    console.error('[EndpointEngine] Retention lookup failed — using requested window', err);
    return { requestedDays, effectiveDays: requestedDays, clampedByRetention: false };
  }
}

type RawStatsRow = Record<string, string>;

/**
 * Per-route latency and error statistics over a window.
 *
 * `quantileExact` rather than `quantile`: the QA report computes its
 * percentiles by nearest rank, and the interpolating t-digest `quantile` uses
 * would put two differently-defined p95s side by side in the same report.
 */
async function queryEndpointStats(input: {
  applicationId: string;
  environmentId?: string;
  runId?: string;
  excludeRunId?: string;
  routes?: string[];
  windowDays: number;
}): Promise<RawStatsRow[]> {
  const filters = [
    'application_id = {applicationId: String}',
    'recorded_at >= now() - INTERVAL {windowDays: UInt32} DAY',
  ];
  const params: Record<string, unknown> = {
    applicationId: input.applicationId,
    windowDays: input.windowDays,
  };
  if (input.environmentId) {
    filters.push('environment_id = {environmentId: String}');
    params.environmentId = input.environmentId;
  }
  if (input.runId) {
    filters.push('run_id = {runId: String}');
    params.runId = input.runId;
  }
  if (input.excludeRunId) {
    filters.push('run_id != {excludeRunId: String}');
    params.excludeRunId = input.excludeRunId;
  }
  if (input.routes?.length) {
    filters.push('route IN {routes: Array(String)}');
    params.routes = input.routes;
  }

  const result = await ch.query({
    query: `
      SELECT
        route,
        any(endpoint)                              AS endpoint,
        method,
        count()                                    AS requestCount,
        round(avg(duration_ms))                    AS avgMs,
        round(quantileExact(0.50)(duration_ms))    AS p50Ms,
        round(quantileExact(0.95)(duration_ms))    AS p95Ms,
        round(quantileExact(0.99)(duration_ms))    AS p99Ms,
        round(countIf(status_code >= 400) / count(), 4) AS errorRate
      FROM ${METRICS_TABLE}
      WHERE ${filters.join(' AND ')}
      GROUP BY route, method
      ORDER BY requestCount DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  });
  return result.json<RawStatsRow>();
}

function readStats(row: RawStatsRow): EndpointStats {
  return {
    route: row.route,
    endpoint: row.endpoint,
    method: row.method,
    requestCount: Number(row.requestCount),
    avgMs: Number(row.avgMs),
    p50Ms: Number(row.p50Ms),
    p95Ms: Number(row.p95Ms),
    p99Ms: Number(row.p99Ms),
    errorRate: Number(row.errorRate),
  };
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'endpoint-engine' });
});

app.get(
  '/endpoints/:applicationId/analysis',
  verifyCaller,
  requireApplicationAccess('applicationId'),
  async (req: CallerRequest, res: Response) => {
    const { applicationId } = req.params;

    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { name: true, organizationId: true },
      });
      if (!application) return res.status(404).json({ error: 'Application not found' });
      if (application.organizationId) {
        const allowed = await entitlementChecker.canAccess(application.organizationId, Feature.ENDPOINT_INTELLIGENCE);
        if (!allowed) {
          return res.status(403).json({
            error: 'FEATURE_NOT_ENTITLED',
            feature: Feature.ENDPOINT_INTELLIGENCE,
            message: 'Your current plan does not include endpoint intelligence.',
          });
        }
      }

      const window = await resolveWindow(application.organizationId, req.query.windowDays);
      const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : '';
      const runId = typeof req.query.runId === 'string' ? req.query.runId : '';

      const rows = await queryEndpointStats({
        applicationId,
        environmentId,
        runId,
        windowDays: window.effectiveDays,
      });

      const endpoints: EndpointRow[] = rows.map((row) => {
        const stats = readStats(row);
        return { ...stats, recommendation: recommendationFor(stats) };
      });

      // Minimum volume applies to both rankings now. A route called once cannot
      // meaningfully be the slowest or the least reliable, and it used to be
      // able to top the slow list off a single unlucky request.
      const eligible = endpoints.filter((e) => e.requestCount >= MIN_VOLUME_FOR_RANKING);
      const slowest = [...eligible].sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 10);
      const errorProne = [...eligible].sort((a, b) => b.errorRate - a.errorRate).slice(0, 10);

      res.json({
        applicationId,
        generatedAt: new Date().toISOString(),
        environmentId: environmentId || null,
        runId: runId || null,
        windowDays: window.effectiveDays,
        requestedWindowDays: window.requestedDays,
        // Says why the window is narrower than asked for, so a short baseline
        // is never mistaken for a stable one.
        windowClampedByRetention: window.clampedByRetention,
        sampleCount: endpoints.reduce((sum, e) => sum + e.requestCount, 0),
        totalEndpoints: endpoints.length,
        slowEndpoints: endpoints.filter(isSlow).length,
        errorEndpoints: endpoints.filter((e) => e.errorRate > ERROR_RATE_THRESHOLD).length,
        endpoints,
        slowest,
        errorProne,
      });
    } catch (err) {
      console.error('[EndpointEngine] Analysis error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * Per-route latency and error rate over a window, for the QA report to quote as
 * a baseline beside what a single run measured.
 *
 * The run under comparison is excluded, so a slow run cannot pollute the
 * baseline it is being judged against.
 */
app.get(
  '/endpoints/:applicationId/baseline',
  verifyCaller,
  requireApplicationAccess('applicationId'),
  async (req: CallerRequest, res: Response) => {
    const { applicationId } = req.params;
    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { organizationId: true },
      });
      if (!application) return res.status(404).json({ error: 'Application not found' });
      if (application.organizationId) {
        const allowed = await entitlementChecker.canAccess(application.organizationId, Feature.ENDPOINT_INTELLIGENCE);
        if (!allowed) return res.status(403).json({ error: 'FEATURE_NOT_ENTITLED', feature: Feature.ENDPOINT_INTELLIGENCE });
      }

      const window = await resolveWindow(application.organizationId, req.query.windowDays);
      const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : '';
      const excludeRunId = typeof req.query.excludeRunId === 'string' ? req.query.excludeRunId : '';
      const routes = typeof req.query.routes === 'string'
        ? req.query.routes.split(',').map((route) => canonicalRoute(route)).filter(Boolean).slice(0, MAX_BASELINE_ROUTES)
        : [];

      const rows = await queryEndpointStats({
        applicationId,
        environmentId,
        excludeRunId,
        routes,
        windowDays: window.effectiveDays,
      });

      res.json({
        applicationId,
        windowDays: window.effectiveDays,
        requestedWindowDays: window.requestedDays,
        windowClampedByRetention: window.clampedByRetention,
        environmentId: environmentId || null,
        routes: rows.map((row) => {
          const stats = readStats(row);
          return {
            route: stats.route,
            method: stats.method,
            requestCount: stats.requestCount,
            avgMs: stats.avgMs,
            p50Ms: stats.p50Ms,
            p95Ms: stats.p95Ms,
            errorRate: stats.errorRate,
          };
        }),
      });
    } catch (err) {
      console.error('[EndpointEngine] Baseline error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * Announces a slow endpoint by email.
 *
 * This was a `?notifyEmail=true` query parameter on the analysis GET, so
 * *reading* the endpoints page could send mail to every owner and admin — a
 * link preview or a prefetch was enough to trigger it. Sending is a POST
 * because it does something outside this system.
 */
app.post(
  '/endpoints/:applicationId/alerts/notify',
  verifyCaller,
  requireApplicationAccess('applicationId'),
  async (req: CallerRequest, res: Response) => {
    const { applicationId } = req.params;
    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { name: true, organizationId: true },
      });
      if (!application?.organizationId) return res.status(404).json({ error: 'Application not found' });

      const window = await resolveWindow(application.organizationId, req.body?.windowDays);
      const rows = await queryEndpointStats({
        applicationId,
        environmentId: typeof req.body?.environmentId === 'string' ? req.body.environmentId : '',
        windowDays: window.effectiveDays,
      });
      const worst = rows
        .map(readStats)
        .filter((row) => row.requestCount >= MIN_VOLUME_FOR_RANKING)
        .sort((a, b) => b.p95Ms - a.p95Ms)[0];
      if (!worst || !isSlow(worst)) return res.status(200).json({ queued: false, reason: 'NO_SLOW_ENDPOINT' });

      await emailService.sendToOrganizationMembers({
        templateKey: 'endpoint-slow',
        organizationId: application.organizationId,
        applicationId,
        eventType: 'ENDPOINT_SLOW',
        severity: worst.p95Ms > 2 * SLOW_REQUEST_MS ? 'HIGH' : 'MEDIUM',
        deepLink: `/endpoints?applicationId=${applicationId}`,
        variables: {
          applicationName: application.name,
          endpoint: `${worst.method} ${worst.route}`,
          avgMs: worst.avgMs,
          p95Ms: worst.p95Ms,
          dashboardUrl: appUrl(`/endpoints?applicationId=${applicationId}`),
        },
        idempotencyKey: buildIdempotencyKey(['endpoint-slow', applicationId, worst.method, worst.route, new Date().toISOString().slice(0, 10)]),
        roles: [MemberRole.OWNER, MemberRole.ADMIN],
      });
      res.status(202).json({ queued: true, endpoint: `${worst.method} ${worst.route}` });
    } catch (err) {
      console.error('[EndpointEngine] Alert notification failed', err);
      res.status(500).json({ error: 'NOTIFICATION_FAILED' });
    }
  },
);

/**
 * Deletes metrics past an application's retention window.
 *
 * Called by the retention sweeper in background-workers, which already knows
 * each organization's `retentionDays` and honours legal holds. ClickHouse stays
 * owned by this service rather than handing that worker its own client.
 */
app.delete(
  '/endpoints/:applicationId/retention',
  verifyCaller,
  requireApplicationAccess('applicationId'),
  async (req: CallerRequest, res: Response) => {
    const { applicationId } = req.params;
    const retentionDays = Number(req.query.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return res.status(400).json({ error: 'RETENTION_DAYS_REQUIRED' });
    }
    try {
      // A ClickHouse mutation is asynchronous and expensive: this issues it and
      // returns rather than waiting for it to materialise.
      await ch.command({
        query: `ALTER TABLE ${METRICS_TABLE} DELETE WHERE application_id = {applicationId: String} AND recorded_at < now() - INTERVAL {days: UInt32} DAY`,
        query_params: { applicationId, days: Math.floor(retentionDays) },
      });
      res.status(202).json({ accepted: true, retentionDays: Math.floor(retentionDays) });
    } catch (err) {
      console.error('[EndpointEngine] Retention delete failed', err);
      res.status(500).json({ error: 'RETENTION_DELETE_FAILED' });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));
  await ensureTable();

  if (kafkaEnabled()) {
    await consumer.connect();
    await consumer.subscribe({ topic: Topics.TELEMETRY_EVENTS, fromBeginning: true });
    await consumer.run({ eachMessage: processEvent });
    console.log(`[EndpointEngine] Consuming ${Topics.TELEMETRY_EVENTS}`);
  } else {
    console.log('[EndpointEngine] Kafka disabled — endpoint metrics consumer not started');
  }

  // Start HTTP server
  const PORT = Number(process.env.PORT || Services.ENDPOINT_ENGINE);
  app.listen(PORT, () => {
    console.log(`[EndpointEngine] HTTP API on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[EndpointEngine] Fatal startup error', err);
  process.exit(1);
});
