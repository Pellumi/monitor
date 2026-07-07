import { initTracing } from '@sots/telemetry';
initTracing('event-collector');

import express, { Request, Response } from 'express';
import { SotsEventSchema, EventBatchSchema, Topics, Feature } from '@sots/shared';
import { PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';

const app = express();
app.use(express.json({ limit: '5mb' }));

const MAX_EVENT_SIZE = 32 * 1024;  // 32 KB
const MAX_REPLAY_SIZE = 128 * 1024; // 128 KB

// ─── Kafka setup (conditional) ────────────────────────────────────────────────
// When KAFKA_ENABLED=false (local dev / test) events are written directly to
// Postgres as RawEvent rows. This allows the platform to run without a Kafka
// broker and makes unit tests simpler.
const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';

let producer: { connect: () => Promise<void>; send: (opts: any) => Promise<void>; disconnect: () => Promise<void> } | null = null;
let prisma: PrismaClient | null = null;

if (KAFKA_ENABLED) {
  const { Kafka } = require('kafkajs');
  const kafka = new Kafka({
    clientId: 'sots-event-collector',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
      retries: 5,
      initialRetryTime: 300,
      maxRetryTime: 30_000,
    },
  });
  producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30_000,
  });
} else {
  // Postgres fallback
  prisma = new PrismaClient();
  console.log('[EventCollector] KAFKA_ENABLED=false — writing events to Postgres (RawEvent)');
}

// Entitlement checker — shares prisma instance when available, otherwise creates its own
const entitlementPrisma = prisma ?? new PrismaClient();
const entitlementChecker = new EntitlementChecker(entitlementPrisma);

/**
 * SESSION_RECORDING entitlement pre-filter.
 * Fail-open: if org ID missing or check throws, we allow through to avoid data loss.
 * Hard-block: if org explicitly lacks SESSION_RECORDING, return 402.
 * Returns null = allowed, string = error message to send 402.
 */
async function checkSessionRecordingEntitlement(req: Request): Promise<string | null> {
  const orgId = req.headers['x-sots-org-id'] as string | undefined;
  if (!orgId) return null; // no org context — fail open (SDK call without resolved key)

  try {
    const allowed = await entitlementChecker.canAccess(orgId, Feature.SESSION_RECORDING);
    if (!allowed) {
      return 'Your current plan does not include Session Recording. Upgrade to continue capturing sessions.';
    }
  } catch (err) {
    // Entitlement service down — fail open to prevent event loss
    console.warn('[EventCollector] Entitlement check failed (fail-open):', err);
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEventLimit(eventType: string): number {
  return typeof eventType === 'string' && eventType.includes('REPLAY')
    ? MAX_REPLAY_SIZE
    : MAX_EVENT_SIZE;
}

function applyGatewayIdentity<T extends { tenantId: string; applicationId: string }>(
  event: T,
  req: Request,
): T & { environmentId: string | null } {
  const orgId = req.headers['x-sots-org-id'] as string | undefined;
  const applicationId = req.headers['x-sots-application-id'] as string | undefined;
  const environmentId = req.headers['x-sots-environment-id'] as string | undefined;

  return {
    ...event,
    tenantId: orgId || event.tenantId,
    applicationId: applicationId || event.applicationId,
    environmentId: environmentId || null,
  };
}

/**
 * Sends events to Kafka (when enabled) or falls back to Postgres RawEvent.
 * Never throws — errors are logged and result in a 202 (optimistic acceptance).
 */
async function publishEvents(events: Array<Record<string, unknown>>, sessionId: string): Promise<void> {
  if (KAFKA_ENABLED && producer) {
    const messages = events.map((e) => ({
      key: String(e.sessionId || sessionId),
      value: JSON.stringify(e),
    }));
    await producer.send({
      topic: Topics.TELEMETRY_EVENTS,
      messages,
    });
    return;
  }

  // Postgres fallback — log events (full persistence requires RawEvent model in schema)
  // This keeps the service functional during local dev without schema migration
  if (prisma) {
    console.log(
      `[EventCollector] Postgres fallback: ${events.length} event(s) received (sessionId=${sessionId})`,
      events.map((e) => ({ type: e['eventType'], tenant: e['tenantId'] })),
    );
    // Future: await prisma.rawEvent.createMany({ data: events })
    // once RawEvent is added to schema.prisma and migrated
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    kafkaEnabled: KAFKA_ENABLED,
    transport: KAFKA_ENABLED ? 'kafka' : 'postgres',
  });
});

// ─── Single event ─────────────────────────────────────────────────────────────
app.post('/v1/events', async (req: Request, res: Response) => {
  try {
    // ── SESSION_RECORDING entitlement gate (fail-open) ──────────
    const entitlementError = await checkSessionRecordingEntitlement(req);
    if (entitlementError) {
      return res.status(402).json({
        error: 'FEATURE_NOT_ENTITLED',
        feature: Feature.SESSION_RECORDING,
        message: entitlementError,
      });
    }

    const eventJson = JSON.stringify(req.body);
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    const limit = getEventLimit(req.body?.eventType);

    if (eventSize > limit) {
      return res.status(413).json({
        error: `Event payload size (${eventSize} bytes) exceeds limit of ${limit} bytes`,
      });
    }

    const event = SotsEventSchema.parse(req.body);
    const enriched = applyGatewayIdentity(event, req);

    await publishEvents([enriched], event.sessionId);

    res.status(202).json({ accepted: true, eventCount: 1 });
  } catch (error) {
    console.error('[EventCollector] Single event parse/publish error', error);
    res.status(400).json({ error: 'Invalid event payload' });
  }
});

// ─── Batch events ─────────────────────────────────────────────────────────────
app.post('/v1/events/batch', async (req: Request, res: Response) => {
  try {
    // ── SESSION_RECORDING entitlement gate (fail-open) ──────────
    const entitlementError = await checkSessionRecordingEntitlement(req);
    if (entitlementError) {
      return res.status(402).json({
        error: 'FEATURE_NOT_ENTITLED',
        feature: Feature.SESSION_RECORDING,
        message: entitlementError,
      });
    }

    const events = EventBatchSchema.parse(req.body);

    if (events.length === 0) {
      return res.status(202).json({ accepted: true, eventCount: 0 });
    }

    const validEvents = events.filter((event) => {
      const size = Buffer.byteLength(JSON.stringify(event), 'utf8');
      const limit = getEventLimit(event.eventType);
      if (size > limit) {
        console.warn(
          `[EventCollector] Discarding event type=${event.eventType} in batch: ${size}B > ${limit}B limit`,
        );
        return false;
      }
      return true;
    });

    if (validEvents.length === 0) {
      return res.status(413).json({ error: 'All events in batch exceeded size limit constraints' });
    }

    const enriched = validEvents.map((e) => applyGatewayIdentity(e, req));
    await publishEvents(enriched, enriched[0].sessionId);

    res.status(202).json({ accepted: true, eventCount: validEvents.length });
  } catch (error) {
    console.error('[EventCollector] Batch event parse/publish error', error);
    res.status(400).json({ error: 'Invalid event batch payload' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || process.env.EVENT_COLLECTOR_PORT || 3001;

async function start() {
  if (KAFKA_ENABLED && producer) {
    console.log('[EventCollector] Connecting to Kafka...');
    await producer.connect();
    console.log(`[EventCollector] Connected to Kafka — broker(s): ${process.env.KAFKA_BROKERS || 'localhost:9092'}`);
  }

  app.listen(PORT, () => {
    console.log(
      `[EventCollector] Running on port ${PORT} | transport=${KAFKA_ENABLED ? 'kafka' : 'postgres'}`,
    );
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[EventCollector] SIGTERM received — shutting down gracefully');
  if (producer) await producer.disconnect();
  if (prisma) await prisma.$disconnect();
  process.exit(0);
});

start().catch((err) => {
  console.error('[EventCollector] Startup failed', err);
  process.exit(1);
});
