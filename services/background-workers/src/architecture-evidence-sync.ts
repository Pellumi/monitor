import type { PrismaClient } from '@tellann/db';
import {
  CAPABILITY_REGISTRY,
  capabilityVisibleToAllMembers,
  createArchitectureStore,
  readRolloutFlags,
  RESOLVER_VERSION,
  syncEvidence,
  type AbsoluteCounts,
  type EventCounts,
  type EvidenceSource,
} from '@tellann/capabilities';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import type { Feature } from '@tellann/shared';

// ─────────────────────────────────────────────────────────────
// Evidence feeding job (plan Phase E). Reads telemetry from ClickHouse over its HTTP interface,
// so the worker needs no client library. Queries use bound parameters, never string interpolation.
// ─────────────────────────────────────────────────────────────

const CLICKHOUSE_URL = process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123';
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE ?? 'tellann';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER ?? 'tellann';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD ?? 'password';

/** Applications processed per run. Each run is incremental, so the rest are picked up on later runs. */
const BATCH_SIZE = 200;

export async function queryClickHouse<T>(sql: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(CLICKHOUSE_URL);
  url.searchParams.set('database', CLICKHOUSE_DATABASE);
  url.searchParams.set('default_format', 'JSONEachRow');
  for (const [name, value] of Object.entries(params)) url.searchParams.set(`param_${name}`, value);
  const auth = Buffer.from(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`).toString('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: sql,
  });
  if (!response.ok) throw new Error(`ClickHouse query failed: HTTP ${response.status}`);
  const text = await response.text();
  return text.split('\n').filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as T);
}

interface EventRow {
  frontend: string | number;
  backend: string | number;
  browser: string | number;
  endpoints: string | number;
  total: string | number;
  latest: string;
}

/** ClickHouse event source. Counts are per SDK `source`, read from the stored event envelope. */
export function clickHouseEvidenceSource(prisma: PrismaClient): EvidenceSource {
  return {
    async eventsSince(applicationId: string, since: Date | null): Promise<EventCounts> {
      const sinceClause = since ? 'AND ingested_at > parseDateTime64BestEffort({since:String}, 3)' : '';
      const rows = await queryClickHouse<EventRow>(
        `SELECT
            countIf(JSONExtractString(payload, 'source') = 'frontend-sdk') AS frontend,
            countIf(JSONExtractString(payload, 'source') = 'backend-sdk') AS backend,
            countIf(JSONExtractString(payload, 'source') = 'browser-observer') AS browser,
            countIf(JSONExtractString(payload, 'source') = 'backend-sdk'
                    AND JSONExtractString(payload, 'eventType') = 'API_REQUEST') AS endpoints,
            count() AS total,
            toString(max(ingested_at)) AS latest
          FROM events
          WHERE application_id = {applicationId:String} ${sinceClause}`,
        since ? { applicationId, since: since.toISOString().replace('T', ' ').replace('Z', '') } : { applicationId },
      );
      const row = rows[0];
      const total = Number(row?.total ?? 0);
      return {
        frontendEventCount: Number(row?.frontend ?? 0),
        backendEventCount: Number(row?.backend ?? 0),
        browserEventCount: Number(row?.browser ?? 0),
        endpointCount: Number(row?.endpoints ?? 0),
        latestIngestedAt: total > 0 && row?.latest ? new Date(`${row.latest.replace(' ', 'T')}Z`) : null,
      };
    },

    async absoluteCounts(applicationId: string): Promise<AbsoluteCounts> {
      const [sessionCount, runCount, observedStateCount, observedWorkflowCount, declaredFlowCount, inFlowEventCount, graph] = await Promise.all([
        prisma.session.count({ where: { applicationId } }),
        prisma.qARun.count({ where: { applicationId } }),
        prisma.state.count({ where: { applicationId } }),
        prisma.workflow.count({ where: { applicationId } }),
        // Declared flows are graphs the user authored, as opposed to ones inferred from telemetry.
        prisma.behaviorGraph.count({ where: { applicationId, sourceType: 'USER_DECLARATION' } }),
        // Accepted flow-progress events from QA runs: the same predicate the QA report uses.
        prisma.qARunProgressEvent.count({ where: { accepted: true, run: { applicationId } } }),
        prisma.behaviorGraph.findFirst({
          where: { applicationId, isActive: true },
          orderBy: { version: 'desc' },
          select: { id: true, version: true },
        }),
      ]);
      return {
        sessionCount,
        runCount,
        observedStateCount,
        observedWorkflowCount,
        declaredFlowCount,
        inFlowEventCount,
        behaviorGraphVersion: graph ? `${graph.id}:${graph.version}` : null,
      };
    },
  };
}

/** Syncs evidence for a batch of applications. A failure on one application does not stop the rest. */
export async function runArchitectureEvidenceSync(prisma: PrismaClient): Promise<{ synced: number; failed: number }> {
  const store = createArchitectureStore(prisma);
  const source = clickHouseEvidenceSource(prisma);
  const entitlements = new EntitlementChecker(prisma);
  const flags = readRolloutFlags(process.env);
  const features = [...new Set(CAPABILITY_REGISTRY.map((d) => d.entitlementKey).filter((k): k is Feature => k !== undefined))];

  const applications = await prisma.application.findMany({
    where: { organizationId: { not: null } },
    select: { id: true, organizationId: true },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
  });

  let synced = 0;
  let failed = 0;
  for (const application of applications) {
    try {
      const allowed = new Set<Feature>();
      for (const feature of features) {
        if (await entitlements.canAccess(application.organizationId!, feature)) allowed.add(feature);
      }
      await syncEvidence(store, source, {
        applicationId: application.id,
        planAllows: (feature) => allowed.has(feature),
        canView: () => capabilityVisibleToAllMembers(),
        flags,
        resolverVersion: RESOLVER_VERSION,
        now: new Date(),
      });
      synced += 1;
    } catch (error) {
      failed += 1;
      console.warn('evidence sync failed', { applicationId: application.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { synced, failed };
}
