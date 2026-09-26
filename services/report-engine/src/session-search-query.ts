import { Prisma, type PrismaClient } from '@tellann/db';

/**
 * Finding a session.
 *
 * `GET /applications/:id/sessions` accepted `page`, `limit`, `from`, `to` and
 * `environmentId`, and nothing else — so the support workflow the product is sold on
 * ("a client reports a problem, go find that session") had no way to start. Every
 * predicate below reads one row per session from `SessionFacet`, so the plan is one
 * index scan plus a bitmap AND rather than a set of anti-joins against the largest
 * tables in the schema.
 */

export interface SessionSearchFilters {
  /** From the path parameter only, never from the query string. */
  applicationId: string;
  environmentId: string | null;
  from?: Date;
  to?: Date;

  /** An EndUser id, or an external id the caller pasted. */
  endUser?: string;
  anonymousId?: string;

  errorContains?: string;
  hasError?: boolean;
  eventType?: string[];
  stateName?: string[];
  workflowName?: string[];
  route?: string[];
  statusCode?: number[];
  statusClass?: '4xx' | '5xx';
  minDurationMs?: number;
  maxDurationMs?: number;
  deviceType?: string[];
  browserName?: string[];
  releaseVersion?: string[];
  abandoned?: boolean;
  /** Free text over the error messages, states, workflows, routes and context. */
  q?: string;

  cursor?: string;
  limit: number;
  /** Offset paging, honoured for one release while the dashboard migrates. */
  page?: number;
}

export interface SessionSearchRow {
  id: string;
  startTime: Date;
  endTime: Date;
  durationMs: number | null;
  eventCount: number | null;
  errorCount: number | null;
  qaRunId: string | null;
  endUserId: string | null;
  endUserLabel: string | null;
  anonymousId: string | null;
  deviceType: string | null;
  browserName: string | null;
  releaseVersion: string | null;
  abandoned: boolean;
}

export interface SessionSearchResult {
  sessions: SessionSearchRow[];
  cursor: string | null;
  total: number;
  /** False when the count hit its cap, so the UI renders "10,000+". */
  totalIsExact: boolean;
  /** Sessions still recording, which have no facet yet and so cannot be filtered. */
  excludedInFlight: number;
  page: number;
  limit: number;
}

/** The exact count cap. Beyond this the number stops being worth the scan. */
const TOTAL_CAP = 10_000;

/**
 * A cursor over `(startTime, sessionId)`.
 *
 * Offset paging is not merely slow at depth, it is *wrong*: with `ORDER BY startTime
 * DESC` a session completing between two page loads shifts every following row, so a
 * reader paging through silently skips some sessions and sees others twice. The tuple
 * is total-ordered, so neither can happen.
 */
function encodeCursor(row: { startTime: Date; id: string }): string {
  return Buffer.from(JSON.stringify([row.startTime.toISOString(), row.id]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { startTime: Date; sessionId: string } | null {
  try {
    const [startTime, sessionId] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof startTime !== 'string' || typeof sessionId !== 'string') return null;
    const parsed = new Date(startTime);
    if (Number.isNaN(parsed.getTime())) return null;
    return { startTime: parsed, sessionId };
  } catch {
    return null;
  }
}

/** Escapes a value for ILIKE so a user's `%` is a literal percent, not a wildcard. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function buildClauses(filters: SessionSearchFilters): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [Prisma.sql`f."applicationId" = ${filters.applicationId}`];

  // Environment scoping is how every sibling endpoint behaves, and skipping it
  // interleaves development and production sessions with nothing on the row to tell
  // them apart.
  if (filters.environmentId) {
    clauses.push(Prisma.sql`f."environmentId" = ${filters.environmentId}`);
  }
  if (filters.from) clauses.push(Prisma.sql`f."startTime" >= ${filters.from}`);
  if (filters.to) clauses.push(Prisma.sql`f."startTime" <= ${filters.to}`);

  if (filters.endUser) {
    // Matches the terminal identity OR anyone asserted anywhere in the session: a user
    // who signed out halfway through was still there, and excluding that session is
    // exactly the case a support engineer is looking for.
    clauses.push(Prisma.sql`(
      f."endUserId" = ${filters.endUser}
      OR f."endUserIds" @> ARRAY[${filters.endUser}]::text[]
    )`);
  }
  if (filters.anonymousId) clauses.push(Prisma.sql`f."anonymousId" = ${filters.anonymousId}`);

  if (filters.eventType?.length) {
    clauses.push(Prisma.sql`f."eventTypes" @> ${filters.eventType}::text[]`);
  }
  if (filters.stateName?.length) {
    clauses.push(Prisma.sql`f."stateNames" @> ${filters.stateName}::text[]`);
  }
  if (filters.workflowName?.length) {
    clauses.push(Prisma.sql`f."workflowNames" @> ${filters.workflowName}::text[]`);
  }
  if (filters.route?.length) {
    clauses.push(Prisma.sql`f."routes" @> ${filters.route}::text[]`);
  }
  if (filters.statusCode?.length) {
    clauses.push(Prisma.sql`f."statusCodes" @> ${filters.statusCode}::int[]`);
  }
  if (filters.statusClass === '4xx') {
    clauses.push(Prisma.sql`f."maxStatusCode" BETWEEN 400 AND 499`);
  }
  if (filters.statusClass === '5xx') {
    clauses.push(Prisma.sql`f."maxStatusCode" >= 500`);
  }

  if (filters.minDurationMs !== undefined) {
    clauses.push(Prisma.sql`f."durationMs" >= ${filters.minDurationMs}`);
  }
  if (filters.maxDurationMs !== undefined) {
    clauses.push(Prisma.sql`f."durationMs" <= ${filters.maxDurationMs}`);
  }

  if (filters.deviceType?.length) {
    clauses.push(Prisma.sql`f."deviceType" = ANY(${filters.deviceType}::text[])`);
  }
  if (filters.browserName?.length) {
    clauses.push(Prisma.sql`f."browserName" = ANY(${filters.browserName}::text[])`);
  }
  if (filters.releaseVersion?.length) {
    clauses.push(Prisma.sql`f."releaseVersion" = ANY(${filters.releaseVersion}::text[])`);
  }

  if (filters.hasError === true) clauses.push(Prisma.sql`f."errorCount" > 0`);
  if (filters.hasError === false) clauses.push(Prisma.sql`f."errorCount" = 0`);
  if (filters.abandoned === true) clauses.push(Prisma.sql`f."abandoned" = TRUE`);
  if (filters.abandoned === false) clauses.push(Prisma.sql`f."abandoned" = FALSE`);

  if (filters.errorContains) {
    clauses.push(Prisma.sql`f."errorText" ILIKE ${likePattern(filters.errorContains)} ESCAPE '\\'`);
  }
  if (filters.q) {
    // websearch_to_tsquery rather than to_tsquery: it accepts what a person types,
    // including quoted phrases and a bare minus, and never throws on malformed input --
    // which to_tsquery does, turning a typo into a 500.
    clauses.push(Prisma.sql`f."searchVector" @@ websearch_to_tsquery('simple', ${filters.q})`);
  }

  return clauses;
}

/** True when a filter can only be answered from a facet, i.e. not for a live session. */
function usesFacetOnlyFilter(filters: SessionSearchFilters): boolean {
  return Boolean(
    filters.endUser || filters.anonymousId || filters.errorContains || filters.q
    || filters.eventType?.length || filters.stateName?.length || filters.workflowName?.length
    || filters.route?.length || filters.statusCode?.length || filters.statusClass
    || filters.minDurationMs !== undefined || filters.maxDurationMs !== undefined
    || filters.deviceType?.length || filters.browserName?.length || filters.releaseVersion?.length
    || filters.abandoned !== undefined || filters.hasError !== undefined,
  );
}

export async function searchSessions(
  prisma: PrismaClient,
  filters: SessionSearchFilters,
): Promise<SessionSearchResult> {
  const limit = Math.min(100, Math.max(1, filters.limit));
  const clauses = buildClauses(filters);

  // Keyset when a cursor is supplied, offset otherwise, so the dashboard can migrate
  // without a flag day. `page` is accepted for one release and then removed.
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  const page = Math.max(1, filters.page ?? 1);
  const offset = cursor ? 0 : (page - 1) * limit;

  const keysetClause = cursor
    ? [Prisma.sql`(f."startTime", f."sessionId") < (${cursor.startTime}, ${cursor.sessionId})`]
    : [];

  const where = Prisma.join([...clauses, ...keysetClause], ' AND ');

  const rows = await prisma.$queryRaw<Array<{
    sessionId: string;
    startTime: Date;
    endTime: Date;
    durationMs: number;
    eventCount: number;
    errorCount: number;
    qaRunId: string | null;
    endUserId: string | null;
    endUserLabel: string | null;
    anonymousId: string | null;
    deviceType: string | null;
    browserName: string | null;
    releaseVersion: string | null;
    abandoned: boolean;
  }>>(Prisma.sql`
    SELECT f."sessionId", f."startTime", f."endTime", f."durationMs", f."eventCount",
           f."errorCount", f."qaRunId", f."endUserId",
           -- COALESCE, because a HASHED-mode application stores no identifier: the
           -- reader gets a short stable handle rather than a blank column.
           COALESCE(u."externalId", LEFT(u."externalIdHash", 12)) AS "endUserLabel",
           f."anonymousId", f."deviceType", f."browserName", f."releaseVersion", f."abandoned"
      FROM "SessionFacet" f
      LEFT JOIN "EndUser" u ON u."id" = f."endUserId"
     WHERE ${where}
     ORDER BY f."startTime" DESC, f."sessionId" DESC
     LIMIT ${limit} OFFSET ${offset}
  `);

  // Capped, because an exact COUNT over 400k filtered rows costs more than the answer
  // is worth. Under the cap it is exact and the UI shows a number.
  const [counted] = await prisma.$queryRaw<Array<{ count: bigint; capped: boolean }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count", (COUNT(*) > ${TOTAL_CAP}) AS "capped"
      FROM (
        SELECT 1 FROM "SessionFacet" f WHERE ${Prisma.join(clauses, ' AND ')} LIMIT ${TOTAL_CAP + 1}
      ) t
  `);

  // A facet exists only once a session is complete, so an in-flight session cannot
  // satisfy a facet filter. Reported rather than silently missing: with a 30s idle
  // timeout the window is 30-90 seconds, and a reader who just reproduced a bug is
  // exactly the person who will look for it inside that window.
  let excludedInFlight = 0;
  if (usesFacetOnlyFilter(filters)) {
    excludedInFlight = await prisma.session.count({
      where: {
        applicationId: filters.applicationId,
        ...(filters.environmentId ? { environmentId: filters.environmentId } : {}),
        completedAt: null,
      },
    });
  }

  const sessions: SessionSearchRow[] = rows.map((row) => ({
    id: row.sessionId,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMs: row.durationMs,
    eventCount: row.eventCount,
    errorCount: row.errorCount,
    qaRunId: row.qaRunId,
    endUserId: row.endUserId,
    endUserLabel: row.endUserLabel,
    anonymousId: row.anonymousId,
    deviceType: row.deviceType,
    browserName: row.browserName,
    releaseVersion: row.releaseVersion,
    abandoned: row.abandoned,
  }));

  const last = rows[rows.length - 1];
  return {
    sessions,
    cursor: rows.length === limit && last
      ? encodeCursor({ startTime: last.startTime, id: last.sessionId })
      : null,
    total: Math.min(Number(counted?.count ?? 0n), TOTAL_CAP),
    totalIsExact: !(counted?.capped ?? false),
    excludedInFlight,
    page,
    limit,
  };
}

/** Parses repeated or comma-separated query values into an array. */
export function queryList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const list = raw.map((item) => String(item).trim()).filter(Boolean);
  return list.length > 0 ? list.slice(0, 50) : undefined;
}

export function queryInts(value: unknown): number[] | undefined {
  const list = queryList(value);
  if (!list) return undefined;
  const numbers = list.map((item) => Number.parseInt(item, 10)).filter((n) => Number.isFinite(n));
  return numbers.length > 0 ? numbers : undefined;
}

export function queryBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).toLowerCase();
  if (['1', 'true', 'yes'].includes(text)) return true;
  if (['0', 'false', 'no'].includes(text)) return false;
  return undefined;
}

export function queryInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export { TOTAL_CAP, decodeCursor, encodeCursor, likePattern, buildClauses };
