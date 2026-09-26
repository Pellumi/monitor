import { isErrorEventType, type TellannEvent } from '@tellann/shared';
import {
  depsLogger,
  depsNow,
  type SessionAnnouncement,
  type SessionCoreDeps,
  type SessionStatistics,
} from './deps';
import { loadSessionEvents } from './load-session';
import { computeSessionFacet, type SessionRowForFacet } from './facets';
import { isUniqueViolation } from './prisma-errors';

export type CompletionOutcome =
  | { status: 'COMPLETED'; sessionId: string; statistics: SessionStatistics }
  | { status: 'ALREADY_COMPLETE'; sessionId: string; statistics: SessionStatistics }
  | { status: 'NO_EVENTS'; sessionId: string }
  | { status: 'MISSING'; sessionId: string }
  | { status: 'LOCK_HELD'; sessionId: string };

/** Statistics computed from the events themselves, never from the session window. */
export function computeStatistics(events: TellannEvent[]): SessionStatistics {
  // Every error-shaped event counts, not only `ERROR_EVENT`: a session full of
  // unhandled exceptions used to report zero errors here and in the replay.
  const errorCount = events.filter((event) => isErrorEventType(event.eventType)).length;

  // From first and last event, not Session.startTime/endTime: a session row is
  // created when its first event arrives and touched when its last one does, and
  // those are not the same thing as the span the user actually spent.
  const firstTs = new Date(events[0].timestamp).getTime();
  const lastTs = new Date(events[events.length - 1].timestamp).getTime();

  return { eventCount: events.length, errorCount, durationMs: lastTs - firstTs };
}

/**
 * Completes a session exactly once, whoever asks.
 *
 * Two processes can now reach this for the same session — an idle timer in
 * session-engine and a query-driven sweep in background-workers — so correctness
 * rests on three layers rather than one:
 *
 *  1. A transaction advisory lock, which stops the duplicated *work*. The unique
 *     constraint below already stopped duplicated *effects*, but both callers still
 *     paid to load every event first. This also replaces the old
 *     `sessionIdleTimers.has(id)` guard in the sweeper, which was process-local and
 *     therefore meaningless as soon as a second process could complete anything.
 *  2. The unique constraint on `SessionStatistic.sessionId`, which is the claim.
 *  3. One transaction covering the claim, `Session.completedAt`, and the outbox
 *     row. Previously the claim was committed and *then* Kafka was published, so a
 *     failed publish left the session claimed and never announced, with nothing to
 *     retry it — the next sweep saw statistics present and skipped it forever.
 */
export async function completeSession(
  deps: SessionCoreDeps,
  sessionId: string,
): Promise<CompletionOutcome> {
  const { prisma, sink } = deps;
  const logger = depsLogger(deps);

  const loaded = await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${sessionId}, 0)) AS "locked"
    `;
    if (!lock?.locked) return null;
    const [events, session] = await Promise.all([
      loadSessionEvents(tx, sessionId),
      tx.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true, applicationId: true, environmentId: true, tenantId: true, qaRunId: true,
          anonymousId: true, endUserId: true, deviceType: true, browserName: true,
          osName: true, releaseVersion: true, sampleRate: true,
        },
      }),
    ]);
    return { events, session };
  });

  if (loaded === null) return { status: 'LOCK_HELD', sessionId };
  const { events, session } = loaded;
  // "No events yet" and "no such session" are different: the first is a session that
  // will complete later, the second a sweep candidate deleted underneath us that must
  // not be retried.
  if (!session) return { status: 'MISSING', sessionId };
  if (events.length === 0) return { status: 'NO_EVENTS', sessionId };

  const first = events[0];
  const statistics = computeStatistics(events);
  const announcement: SessionAnnouncement = {
    sessionId,
    applicationId: first.applicationId,
    environmentId: first.environmentId ?? null,
    tenantId: first.tenantId,
    eventCount: statistics.eventCount,
    startTime: first.timestamp,
    endTime: events[events.length - 1].timestamp,
    events,
  };

  const completedAt = depsNow(deps);

  // Free: completion already loaded every event to compute the statistics above.
  const facet = computeSessionFacet({
    session: session as SessionRowForFacet,
    events,
    statistics,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sessionStatistic.create({ data: { sessionId, ...statistics } });
      await tx.session.update({
        where: { id: sessionId },
        data: { completedAt, facetVersion: facet.facetVersion },
      });
      // Upserted rather than created: a facet may already exist from a backfill that
      // ran before this session was claimed.
      await tx.sessionFacet.upsert({
        where: { sessionId },
        create: facet,
        update: facet,
      });
      await sink.enqueue(tx, announcement);
    });
    return { status: 'COMPLETED', sessionId, statistics };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Someone else claimed it — or this caller claimed it earlier and a late event
    // rearmed the timer. Either way the numbers are refreshed, because a
    // late-arriving event is a legitimate reason to re-measure a session, but the
    // announcement is not repeated. The refresh happens outside the failed
    // transaction, which has already been rolled back.
    await prisma.sessionStatistic.update({ where: { sessionId }, data: statistics });
    // A re-measure changes eventCount and errorCount, which are facet fields, so the
    // facet is rewritten here rather than left for the backfill to notice.
    await prisma.sessionFacet.upsert({ where: { sessionId }, create: facet, update: facet });
    await prisma.session.update({
      where: { id: sessionId },
      data: { facetVersion: facet.facetVersion },
    });
    logger.log(`[session-core] Session ${sessionId} was already complete — statistics refreshed`);
    return { status: 'ALREADY_COMPLETE', sessionId, statistics };
  }
}
