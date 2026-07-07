import { initTracing } from '@sots/telemetry';
initTracing('clickhouse-ingester');

import { createClient, ClickHouseClient } from '@clickhouse/client';
import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { Topics, ConsumerGroups } from '@sots/shared';

// ─── Configuration ────────────────────────────────────────────────────────────
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
const CLICKHOUSE_DB = process.env.CLICKHOUSE_DATABASE || 'sots';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'sots';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || 'password';

// Batch configuration
const BATCH_SIZE = Number(process.env.INGESTER_BATCH_SIZE || '500');
const FLUSH_INTERVAL_MS = Number(process.env.INGESTER_FLUSH_INTERVAL_MS || '5000');

// ─── ClickHouse schema ────────────────────────────────────────────────────────
// Events table DDL — run once via migrations or on startup
const EVENTS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DB}.events (
  tenant_id       String,
  application_id  String,
  environment_id  Nullable(String),
  session_id      String,
  event_type      String,
  event_timestamp DateTime64(3, 'UTC'),
  payload         String,
  ingested_at     DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (tenant_id, application_id, event_timestamp)
TTL event_timestamp + INTERVAL 2 YEAR;
`;

const ENDPOINT_METRICS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DB}.endpoint_metrics (
  tenant_id        String,
  application_id   String,
  environment_id   Nullable(String),
  endpoint         String,
  method           String,
  status_code      UInt16,
  duration_ms      UInt32,
  event_timestamp  DateTime64(3, 'UTC'),
  session_id       String,
  ingested_at      DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (tenant_id, application_id, endpoint, event_timestamp);
`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventRow {
  tenant_id: string;
  application_id: string;
  environment_id: string | null;
  session_id: string;
  event_type: string;
  event_timestamp: string; // ISO8601
  payload: string;         // JSON string
}

interface EndpointMetricRow {
  tenant_id: string;
  application_id: string;
  environment_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  event_timestamp: string;
  session_id: string;
}

// ─── ClickHouse client ───────────────────────────────────────────────────────
function createClickHouseClient(): ClickHouseClient {
  return createClient({
    url: CLICKHOUSE_HOST,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: CLICKHOUSE_DB,
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 0,
    },
  });
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
async function ensureSchema(ch: ClickHouseClient): Promise<void> {
  console.log('[ClickHouseIngester] Ensuring schema...');
  await ch.exec({ query: EVENTS_TABLE_DDL });
  await ch.exec({ query: ENDPOINT_METRICS_TABLE_DDL });
  console.log('[ClickHouseIngester] Schema ready');
}

// ─── Batch flusher ────────────────────────────────────────────────────────────
class BatchFlusher {
  private eventBatch: EventRow[] = [];
  private endpointBatch: EndpointMetricRow[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly ch: ClickHouseClient) {
    this.scheduleFlush();
  }

  add(event: Record<string, unknown>): void {
    const row: EventRow = {
      tenant_id: String(event.tenantId || event.tenant_id || ''),
      application_id: String(event.applicationId || event.application_id || ''),
      environment_id: event.environmentId ? String(event.environmentId) : null,
      session_id: String(event.sessionId || event.session_id || ''),
      event_type: String(event.eventType || event.event_type || 'UNKNOWN'),
      event_timestamp: event.timestamp
        ? new Date(String(event.timestamp)).toISOString()
        : new Date().toISOString(),
      payload: JSON.stringify(event),
    };
    this.eventBatch.push(row);

    // Extract endpoint metrics if present
    const endpoint = event.endpoint || (event.payload as any)?.endpoint;
    const durationMs = event.durationMs || (event.payload as any)?.durationMs;
    if (endpoint && typeof durationMs === 'number') {
      this.endpointBatch.push({
        tenant_id: row.tenant_id,
        application_id: row.application_id,
        environment_id: row.environment_id,
        endpoint: String(endpoint),
        method: String(event.method || (event.payload as any)?.method || 'UNKNOWN'),
        status_code: Number(event.statusCode || (event.payload as any)?.statusCode || 0),
        duration_ms: durationMs,
        event_timestamp: row.event_timestamp,
        session_id: row.session_id,
      });
    }

    if (this.eventBatch.length >= BATCH_SIZE) {
      void this.flush();
    }
  }

  private scheduleFlush(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  async flush(): Promise<void> {
    const events = this.eventBatch.splice(0);
    const endpoints = this.endpointBatch.splice(0);

    if (events.length === 0 && endpoints.length === 0) return;

    try {
      if (events.length > 0) {
        await this.ch.insert({
          table: 'events',
          values: events,
          format: 'JSONEachRow',
        });
        console.log(`[ClickHouseIngester] Flushed ${events.length} events`);
      }
      if (endpoints.length > 0) {
        await this.ch.insert({
          table: 'endpoint_metrics',
          values: endpoints,
          format: 'JSONEachRow',
        });
        console.log(`[ClickHouseIngester] Flushed ${endpoints.length} endpoint metrics`);
      }
    } catch (err) {
      console.error('[ClickHouseIngester] Flush failed — events will be retried on next cycle', err);
      // Put events back for retry on next flush
      this.eventBatch.unshift(...events);
      this.endpointBatch.unshift(...endpoints);
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush(); // Final flush on shutdown
  }
}

// ─── Kafka consumer ───────────────────────────────────────────────────────────
async function createKafkaConsumer(): Promise<Consumer> {
  const kafka = new Kafka({
    clientId: 'sots-clickhouse-ingester',
    brokers: KAFKA_BROKERS,
    retry: {
      retries: 10,
      initialRetryTime: 500,
      maxRetryTime: 60_000,
    },
  });

  const consumer = kafka.consumer({
    groupId: ConsumerGroups.CLICKHOUSE_INGESTER,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
    maxBytesPerPartition: 10 * 1024 * 1024, // 10 MB
  });

  return consumer;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('[ClickHouseIngester] Starting...');
  console.log(`[ClickHouseIngester] Kafka brokers: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`[ClickHouseIngester] ClickHouse: ${CLICKHOUSE_HOST}/${CLICKHOUSE_DB}`);

  const ch = createClickHouseClient();
  await ensureSchema(ch);

  const flusher = new BatchFlusher(ch);
  const consumer = await createKafkaConsumer();

  await consumer.connect();
  console.log('[ClickHouseIngester] Connected to Kafka');

  // Subscribe to all telemetry and quality topics
  await consumer.subscribe({
    topics: [
      Topics.TELEMETRY_EVENTS,
      Topics.TELEMETRY_EVENTS_PARSED,
      Topics.QUALITY_EVENTS,
      Topics.SESSIONS_COMPLETED,
      Topics.COVERAGE_COMPUTED,
      Topics.ENDPOINT_ALERTS,
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachBatchAutoResolve: true,
    eachBatch: async ({ batch, resolveOffset, heartbeat }: EachBatchPayload) => {
      console.log(
        `[ClickHouseIngester] Batch: topic=${batch.topic} partition=${batch.partition} messages=${batch.messages.length}`,
      );

      for (const message of batch.messages) {
        if (!message.value) continue;

        try {
          const payload = JSON.parse(message.value.toString('utf8'));
          flusher.add(payload);
          resolveOffset(message.offset);
        } catch (err) {
          console.error('[ClickHouseIngester] Failed to parse message', {
            offset: message.offset,
            err,
          });
          // Skip unparseable messages — don't block the partition
          resolveOffset(message.offset);
        }

        await heartbeat();
      }
    },
  });

  console.log('[ClickHouseIngester] Consuming...');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[ClickHouseIngester] ${signal} received — shutting down`);
    await consumer.disconnect();
    await flusher.shutdown();
    await ch.close();
    console.log('[ClickHouseIngester] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[ClickHouseIngester] Fatal startup error', err);
  process.exit(1);
});
