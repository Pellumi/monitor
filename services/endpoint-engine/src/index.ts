import { initTracing } from '@sots/telemetry';
initTracing('endpoint-engine');

import express, { Request, Response } from 'express';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { Kafka, EachMessagePayload } from 'kafkajs';
import { MemberRole, PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, SotsEvent, Topics, Services } from '@sots/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';

// ─────────────────────────────────────────────────────────────
// ClickHouse setup
// ─────────────────────────────────────────────────────────────

const ch: ClickHouseClient = createClient({
  host:     process.env.CLICKHOUSE_HOST     ?? 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DATABASE ?? 'sots',
  username: process.env.CLICKHOUSE_USER     ?? 'sots',
  password: process.env.CLICKHOUSE_PASSWORD ?? 'password',
});
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);

const DDL = `
CREATE TABLE IF NOT EXISTS endpoint_metrics (
  application_id   String,
  endpoint         String,
  method           LowCardinality(String),
  status_code      UInt16,
  duration_ms      UInt32,
  session_id       String,
  request_id       String,
  recorded_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (application_id, endpoint, recorded_at)
`;

async function ensureTable(): Promise<void> {
  await ch.command({ query: DDL });
  console.log('[EndpointEngine] ClickHouse table ready');
}

// ─────────────────────────────────────────────────────────────
// Kafka consumer
// ─────────────────────────────────────────────────────────────

const kafka = new Kafka({
  clientId: 'sots-endpoint-engine',
  brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'endpoint-engine-group' });

async function processEvent({ message }: EachMessagePayload): Promise<void> {
  if (!message.value) return;

  try {
    const event: SotsEvent = JSON.parse(message.value.toString());

    if (event.eventType !== 'API_REQUEST') return; // only care about API events

    const m = event.metadata as {
      endpoint?: string;
      method?: string;
      statusCode?: number;
      durationMs?: number;
      sessionId?: string;
      requestId?: string;
    };

    if (!m.endpoint || !m.method || m.statusCode == null || m.durationMs == null) return;

    await ch.insert({
      table: 'endpoint_metrics',
      values: [{
        application_id: event.applicationId,
        endpoint:       m.endpoint,
        method:         m.method.toUpperCase(),
        status_code:    m.statusCode,
        duration_ms:    m.durationMs,
        session_id:     event.sessionId ?? '',
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

interface EndpointRow {
  endpoint: string;
  method: string;
  requestCount: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  recommendation: string;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'endpoint-engine' });
});

app.get('/endpoints/:applicationId/analysis', async (req: Request, res: Response) => {
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

    const query = `
      SELECT
        endpoint,
        method,
        count()                              AS requestCount,
        round(avg(duration_ms))              AS avgMs,
        round(quantile(0.95)(duration_ms))   AS p95Ms,
        round(quantile(0.99)(duration_ms))   AS p99Ms,
        round(countIf(status_code >= 400) / count(), 4) AS errorRate
      FROM endpoint_metrics
      WHERE application_id = {applicationId: String}
      GROUP BY endpoint, method
      ORDER BY requestCount DESC
    `;

    const result = await ch.query({
      query,
      query_params: { applicationId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<{
      endpoint: string;
      method: string;
      requestCount: string;
      avgMs: string;
      p95Ms: string;
      p99Ms: string;
      errorRate: string;
    }>();

    const endpoints: EndpointRow[] = rows.map((row) => {
      const avgMs     = Number(row.avgMs);
      const p95Ms     = Number(row.p95Ms);
      const p99Ms     = Number(row.p99Ms);
      const errorRate = Number(row.errorRate);
      const count     = Number(row.requestCount);

      let recommendation = '';
      if (avgMs > 1000 && errorRate > 0.05) {
        recommendation = 'Critical — both slow and error-prone. Immediate investigation required.';
      } else if (avgMs > 1000) {
        recommendation = 'Investigate performance — average latency exceeds 1 second.';
      } else if (avgMs > 500) {
        recommendation = 'Monitor — average latency approaching threshold.';
      } else if (errorRate > 0.05) {
        recommendation = 'Error rate above 5% — review error handling and upstream dependencies.';
      } else {
        recommendation = 'Healthy.';
      }

      return {
        endpoint:     row.endpoint,
        method:       row.method,
        requestCount: count,
        avgMs,
        p95Ms,
        p99Ms,
        errorRate,
        recommendation,
      };
    });

    const slowest    = [...endpoints].sort((a, b) => b.avgMs - a.avgMs).slice(0, 10);
    const errorProne = [...endpoints]
      .filter((e) => e.requestCount >= 5) // need meaningful volume
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    if (req.query.notifyEmail === 'true' && application.organizationId && slowest[0] && slowest[0].avgMs > 1000) {
      void emailService.sendToOrganizationMembers({
        templateKey: 'endpoint-slow',
        organizationId: application.organizationId,
        applicationId,
        eventType: 'ENDPOINT_SLOW',
        severity: slowest[0].avgMs > 2000 ? 'HIGH' : 'MEDIUM',
        variables: {
          applicationName: application.name,
          endpoint: `${slowest[0].method} ${slowest[0].endpoint}`,
          avgMs: slowest[0].avgMs,
          p95Ms: slowest[0].p95Ms,
          dashboardUrl: appUrl(`/endpoints?applicationId=${applicationId}`),
        },
        idempotencyKey: buildIdempotencyKey(['endpoint-slow', applicationId, slowest[0].method, slowest[0].endpoint, new Date().toISOString().slice(0, 10)]),
        roles: [MemberRole.OWNER, MemberRole.ADMIN],
      }).catch((err) => console.error('[Email] endpoint-slow failed', err));
    }

    res.json({
      applicationId,
      generatedAt: new Date().toISOString(),
      totalEndpoints: endpoints.length,
      slowEndpoints:  endpoints.filter((e) => e.avgMs > 1000).length,
      errorEndpoints: endpoints.filter((e) => e.errorRate > 0.05).length,
      endpoints,
      slowest,
      errorProne,
    });
  } catch (err) {
    console.error('[EndpointEngine] Analysis error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));
  await ensureTable();

  // Start Kafka consumer
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.TELEMETRY_EVENTS, fromBeginning: true });
  await consumer.run({ eachMessage: processEvent });
  console.log(`[EndpointEngine] Consuming ${Topics.TELEMETRY_EVENTS}`);

  // Start HTTP server
  const PORT = Services.ENDPOINT_ENGINE;
  app.listen(PORT, () => {
    console.log(`[EndpointEngine] HTTP API on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[EndpointEngine] Fatal startup error', err);
  process.exit(1);
});
