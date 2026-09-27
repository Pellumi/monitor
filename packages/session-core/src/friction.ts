import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@tellann/db';
import { depsLogger, type SessionCoreDeps } from './deps';
import { utcDay } from './behavior-rollup';

/**
 * Turning rollups into findings a reader can act on.
 *
 * "Which part of the client's system is prone to issues" had no structure behind it:
 * `errorCount` lived per session and was never attributed to a place. These detectors read
 * the daily rollups and name the places, with the sessions that show it attached so the
 * claim is checkable rather than asserted.
 *
 * Each detector states a threshold and a minimum volume. The volume floor matters more than
 * the threshold: a state visited three times with one error is a 33% error rate and means
 * nothing, and a product that reported it would train its readers to ignore findings.
 */

export type FrictionCategory =
  | 'FRICTION_ERROR_RATE'
  | 'FRICTION_ABANDONMENT'
  | 'FRICTION_SLOW_STATE'
  | 'FRICTION_DEAD_END';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface FrictionDetectionResult {
  windowStart: Date;
  windowEnd: Date;
  detected: number;
  refreshed: number;
  resolved: number;
}

/** Below this many sessions, a ratio is noise and is not reported at all. */
const MIN_SESSIONS = 20;
/** Error-rate thresholds, as a fraction of the sessions that touched the place. */
const ERROR_RATE_HIGH = 0.25;
const ERROR_RATE_MEDIUM = 0.1;
/** Abandonment thresholds, for paths that entered a declared flow. */
const ABANDON_RATE_HIGH = 0.6;
const ABANDON_RATE_MEDIUM = 0.35;
/** A state is "slow" when its p95 dwell exceeds this and its median is well under it. */
const SLOW_P95_MS = 20_000;

function dedupe(parts: Array<string | null | undefined>): string {
  return createHash('sha256').update(parts.map((part) => part ?? '').join('|')).digest('hex').slice(0, 32);
}

function ratioSeverity(value: number, high: number, medium: number): Severity {
  if (value >= high) return 'HIGH';
  if (value >= medium) return 'MEDIUM';
  return 'LOW';
}

interface FindingDraft {
  applicationId: string;
  environmentId: string | null;
  category: FrictionCategory;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  recommendation: string | null;
  relatedStateName: string | null;
  relatedTransitionId: string | null;
  relatedRoute: string | null;
  sampleSessionIds: string[];
  observedValue: number | null;
  baselineValue: number | null;
  affectedSessions: number;
  dedupeKey: string;
}

interface StateFrictionRow {
  applicationId: string;
  environmentId: string | null;
  stateName: string;
  visits: bigint;
  uniqueSessions: bigint;
  errorCount: bigint;
  dwellP50Ms: number | null;
  dwellP95Ms: number | null;
}

/**
 * States whose sessions go wrong disproportionately often.
 *
 * The comparison is against the application's own average rather than an absolute number:
 * an application where 8% of every session hits an error has a platform problem, not a
 * problem with one screen, and flagging every screen would say nothing.
 */
async function detectStateErrorRate(
  prisma: PrismaClient,
  windowStart: Date,
  windowEnd: Date,
): Promise<FindingDraft[]> {
  const rows = await prisma.$queryRaw<StateFrictionRow[]>(Prisma.sql`
    SELECT
      m."applicationId",
      m."environmentId",
      st."name" AS "stateName",
      SUM(m."visits")::bigint AS "visits",
      SUM(m."uniqueSessions")::bigint AS "uniqueSessions",
      SUM(m."errorCount")::bigint AS "errorCount",
      MAX(m."dwellP50Ms")::int AS "dwellP50Ms",
      MAX(m."dwellP95Ms")::int AS "dwellP95Ms"
    FROM "ObservedStateMetric" m
    JOIN "State" st ON st."id" = m."stateId"
    WHERE m."day" >= ${windowStart} AND m."day" < ${windowEnd}
    GROUP BY m."applicationId", m."environmentId", st."name"
    HAVING SUM(m."uniqueSessions") >= ${MIN_SESSIONS}
  `);

  // The application's own baseline, so a finding means "worse than usual here" rather than
  // "this application has errors".
  const baselines = new Map<string, { errors: number; sessions: number }>();
  for (const row of rows) {
    const key = `${row.applicationId}:${row.environmentId ?? '-'}`;
    const entry = baselines.get(key) ?? { errors: 0, sessions: 0 };
    entry.errors += Number(row.errorCount);
    entry.sessions += Number(row.uniqueSessions);
    baselines.set(key, entry);
  }

  const drafts: FindingDraft[] = [];
  for (const row of rows) {
    const sessions = Number(row.uniqueSessions);
    const rate = Number(row.errorCount) / sessions;
    if (rate < ERROR_RATE_MEDIUM) continue;

    const key = `${row.applicationId}:${row.environmentId ?? '-'}`;
    const baseline = baselines.get(key)!;
    const baselineRate = baseline.sessions > 0 ? baseline.errors / baseline.sessions : 0;

    // Twice the application's own rate, or there is nothing distinctive to report.
    if (baselineRate > 0 && rate < baselineRate * 2) continue;

    drafts.push({
      applicationId: row.applicationId,
      environmentId: row.environmentId,
      category: 'FRICTION_ERROR_RATE',
      severity: ratioSeverity(rate, ERROR_RATE_HIGH, ERROR_RATE_MEDIUM),
      // More sessions means more confidence in the ratio, capped so it never reads as
      // certainty.
      confidence: Math.min(0.95, 0.5 + Math.log10(sessions) / 10),
      title: `Errors concentrate at ${row.stateName}`,
      description:
        `${Math.round(rate * 100)}% of the ${sessions} sessions that reached ${row.stateName} `
        + `recorded an error, against ${Math.round(baselineRate * 100)}% across this application.`,
      recommendation:
        'Open one of the sessions below and read the events around the first error. '
        + 'If the failures share an endpoint or a status code, the problem is behind that state rather than in it.',
      relatedStateName: row.stateName,
      relatedTransitionId: null,
      relatedRoute: null,
      sampleSessionIds: [],
      observedValue: rate,
      baselineValue: baselineRate,
      affectedSessions: sessions,
      dedupeKey: dedupe(['ERROR_RATE', row.stateName]),
    });
  }
  return drafts;
}

interface AbandonRow {
  applicationId: string;
  environmentId: string | null;
  entryState: string;
  exitState: string;
  executions: bigint;
  abandonments: bigint;
  path: string[];
}

/** Journeys that start something and mostly do not finish it. */
async function detectAbandonment(
  prisma: PrismaClient,
  windowStart: Date,
  windowEnd: Date,
): Promise<FindingDraft[]> {
  const rows = await prisma.$queryRaw<AbandonRow[]>(Prisma.sql`
    SELECT
      j."applicationId",
      j."environmentId",
      j."entryState",
      j."exitState",
      j."path",
      SUM(d."executions")::bigint AS "executions",
      SUM(d."abandonments")::bigint AS "abandonments"
    FROM "JourneyPathDaily" d
    JOIN "JourneyPath" j ON j."id" = d."journeyPathId"
    WHERE d."day" >= ${windowStart} AND d."day" < ${windowEnd}
    GROUP BY j."applicationId", j."environmentId", j."entryState", j."exitState", j."path"
    HAVING SUM(d."executions") >= ${MIN_SESSIONS} AND SUM(d."abandonments") > 0
  `);

  const drafts: FindingDraft[] = [];
  for (const row of rows) {
    const executions = Number(row.executions);
    const rate = Number(row.abandonments) / executions;
    if (rate < ABANDON_RATE_MEDIUM) continue;

    drafts.push({
      applicationId: row.applicationId,
      environmentId: row.environmentId,
      category: 'FRICTION_ABANDONMENT',
      severity: ratioSeverity(rate, ABANDON_RATE_HIGH, ABANDON_RATE_MEDIUM),
      confidence: Math.min(0.95, 0.5 + Math.log10(executions) / 10),
      title: `Users stop at ${row.exitState}`,
      description:
        `${Math.round(rate * 100)}% of the ${executions} sessions that entered `
        + `${row.entryState} ended at ${row.exitState} without reaching a declared terminal state.`,
      recommendation:
        `Compare a completed session against an abandoned one from ${row.exitState}. `
        + 'A step present in one and missing in the other is where the flow loses people.',
      relatedStateName: row.exitState,
      relatedTransitionId: null,
      relatedRoute: null,
      sampleSessionIds: [],
      observedValue: rate,
      baselineValue: null,
      affectedSessions: Number(row.abandonments),
      dedupeKey: dedupe(['ABANDONMENT', row.entryState, row.exitState]),
    });
  }
  return drafts;
}

/**
 * States where a minority of sessions take far longer than the rest.
 *
 * p95 against p50 rather than a mean, because the mean of a bimodal distribution — most
 * loads fast, some hang — sits between the two and describes neither.
 */
async function detectSlowStates(
  prisma: PrismaClient,
  windowStart: Date,
  windowEnd: Date,
): Promise<FindingDraft[]> {
  const rows = await prisma.$queryRaw<StateFrictionRow[]>(Prisma.sql`
    SELECT
      m."applicationId",
      m."environmentId",
      st."name" AS "stateName",
      SUM(m."visits")::bigint AS "visits",
      SUM(m."uniqueSessions")::bigint AS "uniqueSessions",
      SUM(m."errorCount")::bigint AS "errorCount",
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m."dwellP50Ms"))::int AS "dwellP50Ms",
      MAX(m."dwellP95Ms")::int AS "dwellP95Ms"
    FROM "ObservedStateMetric" m
    JOIN "State" st ON st."id" = m."stateId"
    WHERE m."day" >= ${windowStart} AND m."day" < ${windowEnd}
      AND m."dwellP95Ms" IS NOT NULL
    GROUP BY m."applicationId", m."environmentId", st."name"
    HAVING SUM(m."uniqueSessions") >= ${MIN_SESSIONS}
  `);

  const drafts: FindingDraft[] = [];
  for (const row of rows) {
    const p95 = row.dwellP95Ms ?? 0;
    const p50 = row.dwellP50Ms ?? 0;
    if (p95 < SLOW_P95_MS) continue;
    // A long tail, specifically. A state that is uniformly slow is a design decision (a
    // form someone fills in) rather than friction.
    if (p50 > 0 && p95 < p50 * 4) continue;

    drafts.push({
      applicationId: row.applicationId,
      environmentId: row.environmentId,
      category: 'FRICTION_SLOW_STATE',
      severity: p95 > SLOW_P95_MS * 3 ? 'HIGH' : 'MEDIUM',
      confidence: 0.6,
      title: `${row.stateName} stalls for some users`,
      description:
        `Half of sessions leave ${row.stateName} within ${Math.round(p50 / 1000)}s, but the `
        + `slowest 5% take over ${Math.round(p95 / 1000)}s — a tail that wide usually means `
        + 'some requests hang rather than that the screen is slow.',
      recommendation:
        'Filter sessions to this state and sort by duration, then compare the API calls '
        + 'of a slow session against a fast one.',
      relatedStateName: row.stateName,
      relatedTransitionId: null,
      relatedRoute: null,
      sampleSessionIds: [],
      observedValue: p95,
      baselineValue: p50,
      affectedSessions: Number(row.uniqueSessions),
      dedupeKey: dedupe(['SLOW_STATE', row.stateName]),
    });
  }
  return drafts;
}

/** A handful of sessions showing a finding, so the reader can check it. */
async function attachEvidence(
  prisma: PrismaClient,
  draft: FindingDraft,
): Promise<string[]> {
  if (!draft.relatedStateName) return [];

  const sessions = await prisma.sessionFacet.findMany({
    where: {
      applicationId: draft.applicationId,
      ...(draft.environmentId ? { environmentId: draft.environmentId } : {}),
      stateNames: { has: draft.relatedStateName },
      // Prefer a session that actually exhibits the thing, so the reader's first click is
      // not a session where nothing happened.
      ...(draft.category === 'FRICTION_ERROR_RATE' ? { errorCount: { gt: 0 } } : {}),
      ...(draft.category === 'FRICTION_ABANDONMENT' ? { abandoned: true } : {}),
      ...(draft.category === 'FRICTION_SLOW_STATE' ? { durationMs: { gte: 20_000 } } : {}),
    },
    orderBy: { startTime: 'desc' },
    take: 5,
    select: { sessionId: true },
  });
  return sessions.map((session) => session.sessionId);
}

export async function detectFriction(
  deps: SessionCoreDeps,
  options: { now?: Date; windowDays?: number } = {},
): Promise<FrictionDetectionResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const now = options.now ?? (deps.now ? deps.now() : new Date());
  const windowDays = options.windowDays ?? 7;
  const windowEnd = utcDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const result: FrictionDetectionResult = {
    windowStart, windowEnd, detected: 0, refreshed: 0, resolved: 0,
  };

  const drafts = [
    ...(await detectStateErrorRate(prisma, windowStart, windowEnd)),
    ...(await detectAbandonment(prisma, windowStart, windowEnd)),
    ...(await detectSlowStates(prisma, windowStart, windowEnd)),
  ];

  const liveKeys = new Set<string>();

  for (const draft of drafts) {
    const sampleSessionIds = await attachEvidence(prisma, draft);
    liveKeys.add(`${draft.applicationId}:${draft.environmentId ?? '-'}:${draft.dedupeKey}`);

    // Raw ON CONFLICT against the COALESCE expression index: environmentId is nullable, and
    // Prisma's compound-unique `where` input rejects null.
    //
    // detectedAt is deliberately absent from the update list. "This has been true since
    // Tuesday" is the useful fact, and refreshing it would make every standing finding look
    // new every single day. `xmax = 0` reports whether this was genuinely new.
    const [upserted] = await prisma.$queryRaw<Array<{ inserted: boolean }>>`
      INSERT INTO "ObservedFrictionFinding" (
        "id", "applicationId", "environmentId", "category", "severity", "confidence",
        "title", "description", "recommendation", "relatedStateName", "relatedTransitionId",
        "relatedRoute", "sampleSessionIds", "observedValue", "baselineValue",
        "affectedSessions", "observationWindowStart", "observationWindowEnd",
        "dedupeKey", "detectedAt", "lastSeenAt"
      ) VALUES (
        gen_random_uuid()::text, ${draft.applicationId}, ${draft.environmentId},
        ${draft.category}, ${draft.severity}, ${draft.confidence},
        ${draft.title}, ${draft.description}, ${draft.recommendation},
        ${draft.relatedStateName}, ${draft.relatedTransitionId}, ${draft.relatedRoute},
        ${sampleSessionIds}::text[], ${draft.observedValue}, ${draft.baselineValue},
        ${draft.affectedSessions}, ${windowStart}, ${windowEnd},
        ${draft.dedupeKey}, ${now}, ${now}
      )
      ON CONFLICT ("applicationId", COALESCE("environmentId", '-'), "dedupeKey") DO UPDATE SET
        "severity"               = EXCLUDED."severity",
        "confidence"             = EXCLUDED."confidence",
        "title"                  = EXCLUDED."title",
        "description"            = EXCLUDED."description",
        "recommendation"         = EXCLUDED."recommendation",
        "sampleSessionIds"       = EXCLUDED."sampleSessionIds",
        "observedValue"          = EXCLUDED."observedValue",
        "baselineValue"          = EXCLUDED."baselineValue",
        "affectedSessions"       = EXCLUDED."affectedSessions",
        "observationWindowStart" = EXCLUDED."observationWindowStart",
        "observationWindowEnd"   = EXCLUDED."observationWindowEnd",
        "lastSeenAt"             = EXCLUDED."lastSeenAt",
        "resolvedAt"             = NULL
      RETURNING (xmax = 0) AS "inserted"
    `;

    if (upserted?.inserted) result.detected += 1;
    else result.refreshed += 1;
  }

  // A finding that stopped appearing is resolved, not deleted: "this used to be broken and
  // is not any more" is worth keeping, and deleting it would make the same problem look new
  // if it came back.
  const stale = await prisma.observedFrictionFinding.findMany({
    where: { resolvedAt: null, lastSeenAt: { lt: windowStart } },
    select: { id: true },
    take: 500,
  });
  if (stale.length > 0) {
    await prisma.observedFrictionFinding.updateMany({
      where: { id: { in: stale.map((finding) => finding.id) } },
      data: { resolvedAt: now },
    });
    result.resolved = stale.length;
  }

  if (result.detected || result.resolved) {
    logger.log(
      `[session-core] Friction: ${result.detected} new, ${result.refreshed} refreshed, `
      + `${result.resolved} resolved`,
    );
  }
  return result;
}
