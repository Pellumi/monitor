import type { PrismaClient } from '@tellann/db';
import { kafkaEnabled } from '@tellann/shared';
import {
  drainCompletionOutbox,
  outboxSink,
  projectSessionIntoGraph,
  pruneEmptySessions,
  sweepCompletableSessions,
  triggerReconciliation,
  type SessionCoreDeps,
  type SweepResult,
} from '@tellann/session-core';

/**
 * Session completion and graph projection for the Postgres transport.
 *
 * This is the parity half of the change. Completion used to be driven only by
 * in-memory timers inside session-engine's Kafka consumer, so a deployment without
 * a broker never produced statistics, never announced a completed session, never
 * built an observed graph and never ran reconciliation — silently, with nothing
 * that would ever retry. Same code, same rows; a query instead of a timer.
 *
 * Both jobs are safe to run alongside the Kafka path: completion is guarded by an
 * advisory lock and a unique claim, and the outbox is drained with
 * `FOR UPDATE SKIP LOCKED`, so whichever relay gets there first wins and the other
 * finds nothing.
 */

function coreDeps(prisma: PrismaClient): SessionCoreDeps {
  return { prisma, sink: outboxSink };
}

export async function runSessionCompletionSweep(prisma: PrismaClient): Promise<SweepResult> {
  return sweepCompletableSessions(coreDeps(prisma));
}

/**
 * Drains completed-session announcements into the observed graph.
 *
 * Only when Kafka is off. With Kafka on, session-engine relays the same rows to
 * SESSIONS_COMPLETED and graph-engine consumes them; running both would be
 * harmless — delivery is idempotent — but it would double the work for no reason.
 */
export async function runSessionCompletionRelay(prisma: PrismaClient): Promise<void> {
  if (kafkaEnabled()) return;

  const deps = coreDeps(prisma);
  await drainCompletionOutbox(deps, async (announcement) => {
    await projectSessionIntoGraph({ prisma, onProjected: triggerReconciliation }, announcement);
  });
}

/**
 * Removes session rows that never received an event.
 *
 * `applyEventToSession` writes the session before its first event, so a crash
 * between the two leaves a row the sweep would otherwise reconsider every tick
 * forever.
 */
export async function runEmptySessionPrune(prisma: PrismaClient): Promise<number> {
  return pruneEmptySessions(coreDeps(prisma));
}
