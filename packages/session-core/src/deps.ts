import type { PrismaClient, Prisma } from '@tellann/db';
import type { TellannEvent } from '@tellann/shared';

/**
 * How long a session may sit silent before it is considered finished.
 *
 * Shared so the in-memory idle timer in session-engine and the query-driven sweep
 * in background-workers cannot drift apart. They used to be the same number
 * written twice, in a service that only ran when Kafka did.
 */
export const SESSION_IDLE_TIMEOUT_MS = 30_000;

/** Extra delay past the idle timeout before a sweep presumes a session orphaned. */
export const ORPHAN_GRACE_MS = SESSION_IDLE_TIMEOUT_MS * 2;

/** Sessions completed per sweep; a backlog drains over successive ticks. */
export const SWEEP_BATCH_SIZE = 200;

/**
 * The message a completed session hands downstream.
 *
 * Deliberately the same shape session-engine already published to
 * `SESSIONS_COMPLETED`, so graph-engine's consumer needed no change when the
 * projection moved out of it.
 */
export interface SessionAnnouncement {
  sessionId: string;
  applicationId: string;
  environmentId: string | null;
  tenantId: string;
  eventCount: number;
  startTime: string;
  endTime: string;
  /**
   * Absent when a retried outbox row has already had its payload nulled. Readers
   * must fall back to re-loading from `sessionId` rather than treating an empty
   * array as "this session had no events".
   */
  events?: TellannEvent[];
}

export interface SessionStatistics {
  eventCount: number;
  errorCount: number;
  durationMs: number;
}

/**
 * Where a completed session's announcement goes.
 *
 * `enqueue` is called with the *transaction* that is claiming the session, not
 * the client — that is the entire point. Completion used to write the claim and
 * then publish, so a failed publish left a session permanently claimed and never
 * announced, with nothing to retry it.
 */
export interface CompletionSink {
  enqueue(tx: Prisma.TransactionClient, announcement: SessionAnnouncement): Promise<void>;
}

export interface SessionCoreDeps {
  prisma: PrismaClient;
  sink: CompletionSink;
  /** Injectable so tests can pin time; defaults to the wall clock. */
  now?: () => Date;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export function depsNow(deps: Pick<SessionCoreDeps, 'now'>): Date {
  return deps.now ? deps.now() : new Date();
}

export function depsLogger(deps: Pick<SessionCoreDeps, 'logger'>): Pick<Console, 'log' | 'warn' | 'error'> {
  return deps.logger ?? console;
}

/**
 * The only sink used in production: a row in `SessionCompletionOutbox`.
 *
 * What varies between transports is who *drains* it — a Kafka relay in
 * session-engine, or a local projection relay in background-workers — which is
 * where the difference belongs. Tests pass an in-memory sink instead.
 */
export const outboxSink: CompletionSink = {
  async enqueue(tx, announcement) {
    await tx.sessionCompletionOutbox.create({
      data: {
        sessionId: announcement.sessionId,
        applicationId: announcement.applicationId,
        environmentId: announcement.environmentId,
        tenantId: announcement.tenantId,
        payload: announcement as unknown as Prisma.InputJsonValue,
      },
    });
  },
};
