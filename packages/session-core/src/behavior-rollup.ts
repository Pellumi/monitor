import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@tellann/db';
import { depsLogger, type SessionCoreDeps } from './deps';

/**
 * Daily rollups over observed behaviour.
 *
 * `State.visitCount` and `Transition.frequency` are monotone lifetime totals with no time
 * dimension, so two questions the product is built to answer were unanswerable: "how is
 * this system used *now*" and "is this getting worse". A state abandoned six months ago
 * looked identical to one visited this morning, and the numbers could only ever rise.
 *
 * Everything here is computed by aggregation, keyed on (scope, day), and written with an
 * upsert. Never incremented. That is what makes a re-run a no-op, lets a corrected session
 * correct the rollup, and keeps the whole thing safe under Kafka replay.
 */

export interface RollupResult {
  days: number;
  stateRows: number;
  transitionRows: number;
  journeyRows: number;
}

/** UTC midnight for a timestamp. The grain every rollup is keyed on. */
export function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function hashPath(path: string[]): string {
  // Length-prefixed, not just NUL-joined. Joining alone makes `[]` and `['']` produce the
  // same empty string and therefore the same hash -- two different journeys sharing one
  // identity. The rollup only ever passes non-empty paths today, so it could not bite yet,
  // but a collision in an identity function is not something to leave until it can.
  const canonical = `${path.length}\u0000${path.join('\u0000')}`;
  return createHash('sha256').update(canonical).digest('hex');
}

interface StateAggregateRow {
  applicationId: string;
  environmentId: string | null;
  stateId: string;
  day: Date;
  visits: bigint;
  weightedVisits: number | null;
  uniqueEndUsers: bigint;
  uniqueSessions: bigint;
  errorCount: bigint;
  dwellP50Ms: number | null;
  dwellP95Ms: number | null;
}

/**
 * One day of state metrics.
 *
 * Joined to SessionFacet rather than to Session, because that is where the identity, the
 * sample rate and the error count already live in one row — the alternative is three joins
 * against the largest tables in the schema for numbers a facet already summarises.
 *
 * Dwell is the gap to the session's next observation, which is why it comes from a window
 * function rather than a column: nothing records how long a state was occupied, only when
 * it was entered.
 */
async function rollUpStates(prisma: PrismaClient, day: Date, nextDay: Date): Promise<number> {
  const rows = await prisma.$queryRaw<StateAggregateRow[]>(Prisma.sql`
    WITH observed AS (
      SELECT
        st."applicationId",
        f."environmentId",
        so."stateId",
        so."sessionId",
        f."endUserId",
        f."errorCount",
        COALESCE(f."sampleRate", 1) AS "sampleRate",
        -- The gap to whatever this session observed next. Null on the last observation of
        -- a session, which is correct: there is no "before moving on" to measure.
        LEAD(so."timestamp") OVER (PARTITION BY so."sessionId" ORDER BY so."timestamp")
          - so."timestamp" AS "dwell"
      FROM "StateObservation" so
      JOIN "State" st ON st."id" = so."stateId"
      JOIN "SessionFacet" f ON f."sessionId" = so."sessionId"
      WHERE so."timestamp" >= ${day} AND so."timestamp" < ${nextDay}
    )
    SELECT
      "applicationId",
      "environmentId",
      "stateId",
      ${day}::timestamp AS "day",
      COUNT(*)::bigint AS "visits",
      SUM(1.0 / GREATEST("sampleRate", 0.0001))::double precision AS "weightedVisits",
      COUNT(DISTINCT "endUserId")::bigint AS "uniqueEndUsers",
      COUNT(DISTINCT "sessionId")::bigint AS "uniqueSessions",
      -- Errors in the sessions that touched this state. Summed over distinct sessions, not
      -- over observations, or a session that visited one state twice would double-count.
      COALESCE(SUM(DISTINCT "errorCount"), 0)::bigint AS "errorCount",
      -- quantileExact semantics: the reader compares these against a specific session, so a
      -- t-digest approximation would produce a number no session actually had.
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM "dwell") * 1000))::int AS "dwellP50Ms",
      (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM "dwell") * 1000))::int AS "dwellP95Ms"
    FROM observed
    GROUP BY "applicationId", "environmentId", "stateId"
  `);

  for (const row of rows) {
    const data = {
      applicationId: row.applicationId,
      environmentId: row.environmentId,
      stateId: row.stateId,
      day,
      visits: Number(row.visits),
      weightedVisits: row.weightedVisits ?? Number(row.visits),
      uniqueEndUsers: Number(row.uniqueEndUsers),
      uniqueSessions: Number(row.uniqueSessions),
      errorCount: Number(row.errorCount),
      dwellP50Ms: row.dwellP50Ms,
      dwellP95Ms: row.dwellP95Ms,
      computedAt: new Date(),
    };
    await prisma.observedStateMetric.upsert({
      where: {
        applicationId_stateId_day: { applicationId: row.applicationId, stateId: row.stateId, day },
      },
      create: data,
      update: data,
    });
  }

  return rows.length;
}

interface TransitionAggregateRow {
  applicationId: string;
  environmentId: string | null;
  transitionId: string;
  traversals: bigint;
  weightedTraversals: number | null;
  uniqueSessions: bigint;
  errorSessions: bigint;
}

async function rollUpTransitions(prisma: PrismaClient, day: Date, nextDay: Date): Promise<number> {
  const rows = await prisma.$queryRaw<TransitionAggregateRow[]>(Prisma.sql`
    SELECT
      t."applicationId",
      f."environmentId",
      tobs."transitionId",
      COUNT(*)::bigint AS "traversals",
      SUM(1.0 / GREATEST(COALESCE(f."sampleRate", 1), 0.0001))::double precision AS "weightedTraversals",
      COUNT(DISTINCT tobs."sessionId")::bigint AS "uniqueSessions",
      -- Sessions that traversed this edge AND recorded an error somewhere. Deliberately not
      -- called "failures": co-occurrence is not causation, and naming it that would claim
      -- more than the data supports.
      COUNT(DISTINCT CASE WHEN f."errorCount" > 0 THEN tobs."sessionId" END)::bigint AS "errorSessions"
    FROM "TransitionObservation" tobs
    JOIN "Transition" t ON t."id" = tobs."transitionId"
    JOIN "SessionFacet" f ON f."sessionId" = tobs."sessionId"
    WHERE tobs."timestamp" >= ${day} AND tobs."timestamp" < ${nextDay}
    GROUP BY t."applicationId", f."environmentId", tobs."transitionId"
  `);

  for (const row of rows) {
    const data = {
      applicationId: row.applicationId,
      environmentId: row.environmentId,
      transitionId: row.transitionId,
      day,
      traversals: Number(row.traversals),
      weightedTraversals: row.weightedTraversals ?? Number(row.traversals),
      uniqueSessions: Number(row.uniqueSessions),
      errorSessions: Number(row.errorSessions),
      computedAt: new Date(),
    };
    await prisma.observedTransitionMetric.upsert({
      where: {
        applicationId_transitionId_day: {
          applicationId: row.applicationId,
          transitionId: row.transitionId,
          day,
        },
      },
      create: data,
      update: data,
    });
  }

  return rows.length;
}

interface JourneyRow {
  applicationId: string;
  environmentId: string | null;
  path: string[];
  sessionIds: string[];
  executions: bigint;
  weightedExecutions: number | null;
  uniqueEndUsers: bigint;
  completions: bigint;
  abandonments: bigint;
  errorSessions: bigint;
  medianMs: number | null;
}

/**
 * One day of journeys.
 *
 * The path comes from SessionFacet.stateNames — already computed, already per session —
 * rather than from re-walking observations, and the outcome columns come from the same row,
 * which is the point of having built the facet at all.
 */
async function rollUpJourneys(prisma: PrismaClient, day: Date, nextDay: Date): Promise<number> {
  const rows = await prisma.$queryRaw<JourneyRow[]>(Prisma.sql`
    SELECT
      f."applicationId",
      f."environmentId",
      f."stateNames" AS "path",
      ARRAY_AGG(f."sessionId" ORDER BY f."startTime" DESC) AS "sessionIds",
      COUNT(*)::bigint AS "executions",
      SUM(1.0 / GREATEST(COALESCE(f."sampleRate", 1), 0.0001))::double precision AS "weightedExecutions",
      COUNT(DISTINCT f."endUserId")::bigint AS "uniqueEndUsers",
      COUNT(*) FILTER (WHERE array_length(f."reachedTerminalFlows", 1) > 0)::bigint AS "completions",
      COUNT(*) FILTER (WHERE f."abandoned")::bigint AS "abandonments",
      COUNT(*) FILTER (WHERE f."errorCount" > 0)::bigint AS "errorSessions",
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY f."durationMs"))::int AS "medianMs"
    FROM "SessionFacet" f
    WHERE f."startTime" >= ${day} AND f."startTime" < ${nextDay}
      AND array_length(f."stateNames", 1) > 0
    GROUP BY f."applicationId", f."environmentId", f."stateNames"
  `);

  for (const row of rows) {
    const pathHash = hashPath(row.path);

    // Raw ON CONFLICT against the COALESCE expression index, because environmentId is
    // nullable: Prisma cannot express that index, and its compound-unique `where` input
    // rejects null outright. LEAST/GREATEST in the same statement is the other reason --
    // backfilling an older day must not move firstSeenAt forward, and re-running today must
    // not move lastSeenAt back.
    const [journey] = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "JourneyPath" (
        "id", "applicationId", "environmentId", "pathHash", "path", "stateCount",
        "entryState", "exitState", "firstSeenAt", "lastSeenAt"
      ) VALUES (
        gen_random_uuid()::text, ${row.applicationId}, ${row.environmentId}, ${pathHash},
        ${JSON.stringify(row.path)}::jsonb, ${row.path.length},
        ${row.path[0]}, ${row.path[row.path.length - 1]}, ${day}, ${day}
      )
      ON CONFLICT ("applicationId", COALESCE("environmentId", '-'), "pathHash") DO UPDATE SET
        "firstSeenAt" = LEAST   ("JourneyPath"."firstSeenAt", EXCLUDED."firstSeenAt"),
        "lastSeenAt"  = GREATEST("JourneyPath"."lastSeenAt",  EXCLUDED."lastSeenAt")
      RETURNING "id"
    `;

    const daily = {
      journeyPathId: journey.id,
      day,
      executions: Number(row.executions),
      weightedExecutions: row.weightedExecutions ?? Number(row.executions),
      uniqueEndUsers: Number(row.uniqueEndUsers),
      completions: Number(row.completions),
      abandonments: Number(row.abandonments),
      errorSessions: Number(row.errorSessions),
      medianMs: row.medianMs,
      computedAt: new Date(),
    };
    await prisma.journeyPathDaily.upsert({
      where: { journeyPathId_day: { journeyPathId: journey.id, day } },
      create: daily,
      update: daily,
    });
  }

  return rows.length;
}

/**
 * Rolls up one or more days.
 *
 * Runs over yesterday by default rather than today: a partial day would be rewritten on
 * every tick, and any trend drawn from it would wobble for reasons that have nothing to do
 * with the application. `days` lets a backfill walk further back, and because every write
 * is an upsert keyed on the day, walking back over already-computed days is free.
 */
export async function runBehaviorRollup(
  deps: SessionCoreDeps,
  options: { now?: Date; days?: number; includeToday?: boolean } = {},
): Promise<RollupResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const now = options.now ?? (deps.now ? deps.now() : new Date());
  const dayCount = Math.max(1, options.days ?? 1);

  const result: RollupResult = { days: 0, stateRows: 0, transitionRows: 0, journeyRows: 0 };

  for (let back = options.includeToday ? 0 : 1; back < dayCount + (options.includeToday ? 0 : 1); back += 1) {
    const day = utcDay(new Date(now.getTime() - back * 24 * 60 * 60 * 1000));
    const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);

    try {
      result.stateRows += await rollUpStates(prisma, day, nextDay);
      result.transitionRows += await rollUpTransitions(prisma, day, nextDay);
      result.journeyRows += await rollUpJourneys(prisma, day, nextDay);
      result.days += 1;
    } catch (err) {
      // One bad day must not stop the others; the next run retries it because every write
      // is an idempotent upsert.
      logger.error(`[session-core] Behaviour rollup failed for ${day.toISOString().slice(0, 10)}`, err);
    }
  }

  if (result.stateRows || result.journeyRows) {
    logger.log(
      `[session-core] Rolled up ${result.days} day(s): `
      + `${result.stateRows} state, ${result.transitionRows} transition, ${result.journeyRows} journey row(s)`,
    );
  }
  return result;
}

/** What recent traffic says about an observed state, for ranking what to declare next. */
export interface StateTrafficWeight {
  /** Sessions, corrected for sampling, over the window. */
  weightedVisits: number;
  uniqueEndUsers?: number;
  /** Fraction of the state's sessions that recorded an error. */
  errorRate: number;
  lastSeenAt?: Date | null;
}

/**
 * How strongly an undeclared state should be recommended for declaration.
 *
 * `undeclared` entries carried State.visitCount -- a monotone lifetime total -- so a path
 * used once a year ranked alongside one used hourly, and a broken path ranked alongside a
 * healthy one. Coverage told you what was missing; this says what matters.
 *
 * Volume times breakage. Logarithmic in volume, because the difference between 10 and 100
 * sessions matters far more than between 10,000 and 100,000 -- and because one enormous path
 * should not swamp everything else in the list.
 *
 * Lives here rather than in fdrs-api because it is a pure function over the rollups defined
 * above, and it is where its tests can reach it.
 */
export function declarationPriority(
  weight: StateTrafficWeight | undefined,
  lifetimeVisits: number,
): number {
  const visits = weight?.weightedVisits ?? lifetimeVisits;
  if (visits <= 0) return 0;
  const volume = Math.log10(visits + 1);
  const breakage = 1 + (weight?.errorRate ?? 0) * 4;
  return Number((volume * breakage).toFixed(4));
}
