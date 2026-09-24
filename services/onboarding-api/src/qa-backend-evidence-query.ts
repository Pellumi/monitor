import { Prisma, PrismaClient } from '@tellann/db';

/**
 * The backend half of a run's evidence, read back the way an operator browses
 * it: what the server was asked, which answers were failures, and which data
 * operations ran.
 *
 * Reads stay in SQL because a busy run holds thousands of these rows and each
 * one carries captured payloads, so the list projects only the few scalar
 * fields a row shows. Bodies, headers and query strings stay behind the
 * per-event detail endpoint.
 */

export const BACKEND_EVIDENCE_KINDS = ['requests', 'failed', 'data'] as const;
export type BackendEvidenceKind = (typeof BACKEND_EVIDENCE_KINDS)[number];

export const BACKEND_EVIDENCE_STATUSES = ['2xx', '3xx', '4xx', '5xx', 'unhandled'] as const;
export type BackendEvidenceStatus = (typeof BACKEND_EVIDENCE_STATUSES)[number];

export const BACKEND_EVIDENCE_SORTS = ['newest', 'oldest', 'slowest'] as const;
export type BackendEvidenceSort = (typeof BACKEND_EVIDENCE_SORTS)[number];

export type BackendEvidenceFilters = {
  runId: string;
  kind: BackendEvidenceKind;
  page: number;
  pageSize: number;
  query?: string;
  method?: string;
  status?: BackendEvidenceStatus;
  access?: 'read' | 'write';
  sort?: BackendEvidenceSort;
};

export type BackendEvidenceCounts = { requests: number; failed: number; data: number };

export type BackendEvidenceItem = {
  id: string;
  kind: 'REQUEST' | 'ERROR' | 'DATA';
  occurredAt: string;
  method: string | null;
  route: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  handler: string | null;
  framework: string | null;
  requestBytes: number | null;
  responseBytes: number | null;
  models: string[];
  name: string | null;
  message: string | null;
  severity: string | null;
  model: string | null;
  operation: string | null;
  records: number | null;
  mutation: boolean | null;
  count: number | null;
};

type RawRow = {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  method: string | null;
  route: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  handler: string | null;
  framework: string | null;
  requestBytes: number | null;
  responseBytes: number | null;
  models: Prisma.JsonValue | null;
  name: string | null;
  message: string | null;
  severity: string | null;
  model: string | null;
  operation: string | null;
  records: number | null;
  mutation: string | null;
  dataCount: number | null;
};

const REQUEST = 'QA_BACKEND_REQUEST';
const ERROR = 'QA_BACKEND_ERROR';
const DATA = 'QA_BACKEND_DATA_ACCESS';

/** Non-numeric or missing values become NULL rather than failing the cast for the whole query. */
const STATUS = Prisma.sql`(CASE WHEN ev."metadata"->>'statusCode' ~ '^[0-9]{3}$' THEN (ev."metadata"->>'statusCode')::int END)`;
const DURATION = Prisma.sql`(CASE WHEN ev."metadata"->>'durationMs' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (ev."metadata"->>'durationMs')::float8 END)`;
const RECORDS = Prisma.sql`(CASE WHEN ev."metadata"->>'records' ~ '^[0-9]+$' THEN (ev."metadata"->>'records')::int END)`;
const DATA_COUNT = Prisma.sql`(CASE WHEN ev."metadata"->>'count' ~ '^[0-9]+$' THEN (ev."metadata"->>'count')::int END)`;
/** `key` is one of two literals, so it is inlined: a bound parameter makes `->>` ambiguous to the planner. */
const BYTES = (key: 'requestBytes' | 'responseBytes') =>
  Prisma.sql`(CASE WHEN ev."metadata"->>${Prisma.raw(`'${key}'`)} ~ '^[0-9]+$' THEN (ev."metadata"->>${Prisma.raw(`'${key}'`)})::float8 END)`;

const FAILED_PREDICATE = Prisma.sql`(ev."eventType" = ${ERROR} OR (ev."eventType" = ${REQUEST} AND ${STATUS} >= 400))`;

function literalContainsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

function kindPredicate(kind: BackendEvidenceKind): Prisma.Sql {
  if (kind === 'requests') return Prisma.sql`ev."eventType" = ${REQUEST}`;
  if (kind === 'data') return Prisma.sql`ev."eventType" = ${DATA}`;
  return FAILED_PREDICATE;
}

function statusPredicate(status: BackendEvidenceStatus): Prisma.Sql {
  if (status === 'unhandled') return Prisma.sql`ev."eventType" = ${ERROR}`;
  const hundred = Number(status[0]) * 100;
  return Prisma.sql`(ev."eventType" = ${REQUEST} AND ${STATUS} >= ${hundred} AND ${STATUS} < ${hundred + 100})`;
}

export async function countBackendEvidence(
  prisma: PrismaClient,
  runId: string,
): Promise<BackendEvidenceCounts> {
  const rows = await prisma.$queryRaw<Array<{ requests: bigint; failed: bigint; data: bigint }>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE ev."eventType" = ${REQUEST})::bigint AS "requests",
      COUNT(*) FILTER (WHERE ${FAILED_PREDICATE})::bigint AS "failed",
      COUNT(*) FILTER (WHERE ev."eventType" = ${DATA})::bigint AS "data"
    FROM "QARunEvidenceEvent" AS ev
    WHERE ev."runId" = ${runId}
  `);
  const row = rows[0];
  return {
    requests: Number(row?.requests ?? 0),
    failed: Number(row?.failed ?? 0),
    data: Number(row?.data ?? 0),
  };
}

function toItem(row: RawRow): BackendEvidenceItem {
  const models = Array.isArray(row.models)
    ? row.models
        .map((entry) => {
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) return String((entry as Record<string, unknown>).model ?? '');
          return typeof entry === 'string' ? entry : '';
        })
        .filter(Boolean)
    : [];
  return {
    id: row.eventId,
    kind: row.eventType === ERROR ? 'ERROR' : row.eventType === DATA ? 'DATA' : 'REQUEST',
    occurredAt: row.occurredAt.toISOString(),
    method: row.method ? row.method.toUpperCase() : null,
    route: row.route,
    path: row.path,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    handler: row.handler,
    framework: row.framework,
    requestBytes: row.requestBytes,
    responseBytes: row.responseBytes,
    models,
    name: row.name,
    message: row.message,
    severity: row.severity,
    model: row.model,
    operation: row.operation,
    records: row.records,
    mutation: row.mutation === null ? null : row.mutation === 'true',
    count: row.dataCount,
  };
}

export async function findBackendEvidence(
  prisma: PrismaClient,
  filters: BackendEvidenceFilters,
): Promise<{ items: BackendEvidenceItem[]; total: number }> {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`ev."runId" = ${filters.runId}`,
    kindPredicate(filters.kind),
  ];

  if (filters.method && filters.kind !== 'data') {
    clauses.push(Prisma.sql`UPPER(COALESCE(ev."metadata"->>'method', 'GET')) = ${filters.method.toUpperCase()}`);
  }
  if (filters.status && filters.kind !== 'data') clauses.push(statusPredicate(filters.status));
  if (filters.access && filters.kind === 'data') {
    clauses.push(filters.access === 'write'
      ? Prisma.sql`COALESCE(ev."metadata"->>'mutation', 'false') = 'true'`
      : Prisma.sql`COALESCE(ev."metadata"->>'mutation', 'false') <> 'true'`);
  }

  const query = filters.query?.trim();
  if (query) {
    const pattern = literalContainsPattern(query.slice(0, 200));
    clauses.push(Prisma.sql`CONCAT_WS(' ',
      ev."metadata"->>'method', ev."metadata"->>'route', ev."metadata"->>'path',
      ev."metadata"->>'handler', ev."metadata"->>'statusCode', ev."metadata"->>'name',
      ev."metadata"->>'message', ev."metadata"->>'model', ev."metadata"->>'operation',
      ev."metadata"->'models'
    ) ILIKE ${pattern} ESCAPE '\\'`);
  }

  const where = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
  const order = filters.sort === 'slowest' && filters.kind !== 'data'
    ? Prisma.sql`${DURATION} DESC NULLS LAST, ev."occurredAt" DESC`
    : filters.sort === 'oldest'
      ? Prisma.sql`ev."occurredAt" ASC, ev."localSequence" ASC`
      : Prisma.sql`ev."occurredAt" DESC, ev."localSequence" DESC`;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        ev."eventId",
        ev."eventType",
        ev."occurredAt",
        ev."metadata"->>'method' AS "method",
        ev."metadata"->>'route' AS "route",
        ev."metadata"->>'path' AS "path",
        ${STATUS} AS "statusCode",
        ${DURATION} AS "durationMs",
        ev."metadata"->>'handler' AS "handler",
        ev."metadata"->>'framework' AS "framework",
        ${BYTES('requestBytes')} AS "requestBytes",
        ${BYTES('responseBytes')} AS "responseBytes",
        CASE WHEN jsonb_typeof(ev."metadata"->'models') = 'array' THEN ev."metadata"->'models' END AS "models",
        ev."metadata"->>'name' AS "name",
        LEFT(ev."metadata"->>'message', 500) AS "message",
        ev."metadata"->>'severity' AS "severity",
        ev."metadata"->>'model' AS "model",
        ev."metadata"->>'operation' AS "operation",
        ${RECORDS} AS "records",
        ev."metadata"->>'mutation' AS "mutation",
        ${DATA_COUNT} AS "dataCount"
      FROM "QARunEvidenceEvent" AS ev
      ${where}
      ORDER BY ${order}
      LIMIT ${filters.pageSize}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "QARunEvidenceEvent" AS ev
      ${where}
    `),
  ]);

  return { items: rows.map(toItem), total: Number(totals[0]?.count ?? 0) };
}
