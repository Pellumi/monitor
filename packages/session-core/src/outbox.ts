import { Prisma } from '@tellann/db';
import { depsLogger, depsNow, type SessionAnnouncement, type SessionCoreDeps } from './deps';
import { loadSessionEvents } from './load-session';

export interface DrainOptions {
  batchSize?: number;
  now?: Date;
  /** Attempts after which a row is parked as FAILED rather than retried forever. */
  maxAttempts?: number;
}

export interface DrainResult {
  claimed: number;
  delivered: number;
  failed: number;
  parked: number;
}

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 5 * 60_000;

/** Exponential backoff, capped, so a persistent failure does not spin. */
function nextAvailableAt(now: Date, attempts: number): Date {
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
  return new Date(now.getTime() + delay);
}

/**
 * Delivers completed-session announcements, once each.
 *
 * The handler is what differs between transports — `producer.send` to
 * `SESSIONS_COMPLETED` when Kafka is on, the graph projection called directly when
 * it is not — and it is the only thing that differs. Both drain the same rows
 * written by the same completion transaction.
 *
 * Delivery is at-least-once, which is why `projectSessionIntoGraph` had to be made
 * idempotent: a handler that succeeds and then fails to be marked DELIVERED (a lost
 * connection at the wrong moment) will be retried.
 */
export async function drainCompletionOutbox(
  deps: SessionCoreDeps,
  handler: (announcement: SessionAnnouncement) => Promise<void>,
  options: DrainOptions = {},
): Promise<DrainResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const now = options.now ?? depsNow(deps);
  const batchSize = options.batchSize ?? 50;
  const maxAttempts = options.maxAttempts ?? 10;

  const result: DrainResult = { claimed: 0, delivered: 0, failed: 0, parked: 0 };

  // Claim with a row-level skip-lock so two relay instances never take the same
  // row. `FOR UPDATE SKIP LOCKED` is the whole concurrency story here — without it
  // this would need a leader election.
  const claimed = await prisma.$queryRaw<Array<{ id: string; sessionId: string; payload: unknown; attempts: number }>>`
    UPDATE "SessionCompletionOutbox" o
       SET "claimedAt" = ${now}, "attempts" = o."attempts" + 1
     WHERE o."id" IN (
       SELECT c."id" FROM "SessionCompletionOutbox" c
        WHERE c."status" = 'PENDING' AND c."availableAt" <= ${now}
        ORDER BY c."createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING o."id", o."sessionId", o."payload", o."attempts"
  `;

  result.claimed = claimed.length;

  for (const row of claimed) {
    try {
      const announcement = await hydrate(deps, row.sessionId, row.payload);
      if (!announcement) {
        // The session is gone — retention, or a pruned empty row. Nothing to
        // deliver and nothing to retry.
        await prisma.sessionCompletionOutbox.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', deliveredAt: now, payload: Prisma.DbNull, lastError: 'SESSION_MISSING' },
        });
        result.delivered += 1;
        continue;
      }

      await handler(announcement);

      // Payload is nulled on delivery so this table does not become a second copy
      // of SessionEvent. A 200-event session is ~200 KB of jsonb per row.
      await prisma.sessionCompletionOutbox.update({
        where: { id: row.id },
        data: { status: 'DELIVERED', deliveredAt: now, payload: Prisma.DbNull, lastError: null },
      });
      result.delivered += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const park = row.attempts >= maxAttempts;
      await prisma.sessionCompletionOutbox.update({
        where: { id: row.id },
        data: {
          status: park ? 'FAILED' : 'PENDING',
          claimedAt: null,
          lastError: message.slice(0, 2_000),
          availableAt: nextAvailableAt(now, row.attempts),
        },
      });
      if (park) {
        result.parked += 1;
        logger.error(
          `[session-core] Outbox row for session ${row.sessionId} parked after ${row.attempts} attempts`,
          err,
        );
      } else {
        result.failed += 1;
        logger.warn(`[session-core] Outbox delivery failed for ${row.sessionId}, will retry`, message);
      }
    }
  }

  if (result.delivered || result.failed || result.parked) {
    logger.log(
      `[session-core] Outbox drained: delivered=${result.delivered} `
      + `retry=${result.failed} parked=${result.parked}`,
    );
  }

  return result;
}

/**
 * The announcement to hand the handler.
 *
 * A retried row has had its payload nulled by an earlier successful delivery that
 * failed to be recorded, so the events are re-loaded rather than treated as absent.
 */
async function hydrate(
  deps: SessionCoreDeps,
  sessionId: string,
  payload: unknown,
): Promise<SessionAnnouncement | null> {
  const stored = payload as SessionAnnouncement | null;
  if (stored && Array.isArray(stored.events) && stored.events.length > 0) return stored;

  const session = await deps.prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true, applicationId: true, environmentId: true, tenantId: true,
      startTime: true, endTime: true,
    },
  });
  if (!session) return null;

  const events = await loadSessionEvents(deps.prisma, sessionId);
  if (events.length === 0) return null;

  return {
    sessionId,
    applicationId: session.applicationId,
    environmentId: session.environmentId,
    tenantId: session.tenantId,
    eventCount: events.length,
    startTime: events[0].timestamp,
    endTime: events[events.length - 1].timestamp,
    events,
  };
}

/**
 * Re-arms rows parked as FAILED, for an operator who has fixed the cause.
 *
 * Without this a poison batch is permanently invisible: nothing lists FAILED rows
 * and nothing retries them.
 */
export async function requeueFailedAnnouncements(deps: SessionCoreDeps): Promise<number> {
  const { count } = await deps.prisma.sessionCompletionOutbox.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', attempts: 0, availableAt: depsNow(deps), claimedAt: null },
  });
  if (count) depsLogger(deps).log(`[session-core] Re-queued ${count} parked announcement(s)`);
  return count;
}
