import type { PrismaClient } from '@tellann/db';

/**
 * Builds indexes that cannot be created by `prisma migrate deploy`.
 *
 * `CREATE INDEX CONCURRENTLY` may not run inside a transaction block, and
 * `migrate deploy` executes each migration file as one implicit transaction. A
 * plain `CREATE INDEX` on a large table holds an ACCESS EXCLUSIVE lock for as
 * long as the build takes, which on `SessionEvent` means blocking every ingest
 * write for minutes. So these are built here instead, out of band.
 *
 * Why they were missing at all: the session tables predate the migration history
 * — `grep -rn "SessionEvent" packages/db/prisma/migrations` finds nothing, because
 * they were created by `prisma db push`. Prisma does not index foreign keys on
 * PostgreSQL, so `SessionEvent` had no index of any kind, and `session.events`
 * — read by every completion, every orphan sweep and every replay render — was a
 * sequential scan of the largest table in the schema.
 *
 * No marker table guards this. `pg_index` is the marker: the statement is only
 * issued when a valid index of that name is absent, so a re-run is two catalogue
 * queries and nothing else.
 */

interface BootstrapIndex {
  name: string;
  table: string;
  /** Everything after `CREATE INDEX CONCURRENTLY <name> ` — kept separate so the
   *  guard can check the name without parsing SQL. */
  definition: string;
  reason: string;
}

const BOOTSTRAP_INDEXES: BootstrapIndex[] = [
  {
    name: 'SessionEvent_sessionId_timestamp_idx',
    table: 'SessionEvent',
    definition: 'ON "SessionEvent"("sessionId", "timestamp")',
    reason: 'session.events ordered read — completion, orphan sweep, replay timeline',
  },
  {
    name: 'SessionEvent_sessionId_eventType_idx',
    table: 'SessionEvent',
    definition: 'ON "SessionEvent"("sessionId", "eventType")',
    reason: 'per-type event probes during facet computation and session search',
  },
];

export interface SchemaBootstrapResult {
  dryRun: boolean;
  checked: number;
  created: string[];
  repaired: string[];
  alreadyPresent: string[];
  failed: Array<{ name: string; error: string }>;
}

interface IndexStateRow {
  exists: boolean;
  valid: boolean;
}

async function readIndexState(prisma: PrismaClient, name: string): Promise<IndexStateRow> {
  const rows = await prisma.$queryRawUnsafe<Array<{ indisvalid: boolean }>>(
    `SELECT i.indisvalid
       FROM pg_class c
       JOIN pg_index i ON i.indexrelid = c.oid
      WHERE c.relname = $1
        AND c.relnamespace = current_schema()::regnamespace`,
    name,
  );
  if (rows.length === 0) return { exists: false, valid: false };
  return { exists: true, valid: rows[0].indisvalid === true };
}

export async function runSchemaBootstrap(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<SchemaBootstrapResult> {
  const dryRun = options.dryRun ?? false;
  const result: SchemaBootstrapResult = {
    dryRun,
    checked: 0,
    created: [],
    repaired: [],
    alreadyPresent: [],
    failed: [],
  };

  for (const index of BOOTSTRAP_INDEXES) {
    result.checked += 1;
    try {
      const state = await readIndexState(prisma, index.name);

      if (state.exists && state.valid) {
        result.alreadyPresent.push(index.name);
        continue;
      }

      // A `CREATE INDEX CONCURRENTLY` that fails part-way leaves an INVALID index
      // behind, and `IF NOT EXISTS` then matches it forever — so the index looks
      // present while the planner refuses to use it. Drop it and rebuild.
      if (state.exists && !state.valid) {
        if (dryRun) {
          result.repaired.push(index.name);
          continue;
        }
        console.warn(`[schema-bootstrap] ${index.name} exists but is INVALID — rebuilding`);
        await prisma.$executeRawUnsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`);
        result.repaired.push(index.name);
      }

      if (dryRun) {
        result.created.push(index.name);
        continue;
      }

      console.log(`[schema-bootstrap] Building ${index.name} on ${index.table} — ${index.reason}`);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ${index.definition}`,
      );
      result.created.push(index.name);
      console.log(`[schema-bootstrap] Built ${index.name}`);
    } catch (err) {
      // One index that cannot be built must not stop the others, and must not
      // fail the tick — the next one retries.
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ name: index.name, error: message });
      console.error(`[schema-bootstrap] Failed to build ${index.name}`, err);
    }
  }

  if (result.created.length || result.repaired.length || result.failed.length) {
    console.log(
      `[schema-bootstrap] checked=${result.checked} created=${result.created.length} `
      + `repaired=${result.repaired.length} present=${result.alreadyPresent.length} `
      + `failed=${result.failed.length}`,
    );
  }

  return result;
}

/** Exposed for tests and for the acceptance script's assertions. */
export const BOOTSTRAP_INDEX_NAMES = BOOTSTRAP_INDEXES.map((index) => index.name);
