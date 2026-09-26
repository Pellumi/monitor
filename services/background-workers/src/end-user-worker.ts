import type { PrismaClient } from '@tellann/db';
import {
  backlinkAnonymousSessions,
  outboxSink,
  pruneOrphanedEndUsers,
  type BacklinkResult,
  type SessionCoreDeps,
} from '@tellann/session-core';

/**
 * Attributing a browser's earlier anonymous sessions to the person it turned out to
 * belong to.
 *
 * Enqueued rather than done inline at identify() time, because a kiosk or a bot with a
 * pinned `localStorage` can have thousands of prior sessions and an unbounded write in
 * the ingest path is not acceptable. The current session is linked inline, so the UI is
 * never wrong about the session being looked at; only the history lags, by seconds.
 */

function coreDeps(prisma: PrismaClient): SessionCoreDeps {
  return { prisma, sink: outboxSink };
}

export async function runEndUserBacklink(prisma: PrismaClient): Promise<BacklinkResult> {
  return backlinkAnonymousSessions(coreDeps(prisma));
}

/**
 * Removes end users whose every session has expired.
 *
 * Retention deletes sessions but deliberately not `EndUser`, which is directory data
 * rather than behavioural data -- so without this it would accumulate rows describing
 * people the platform no longer holds anything about.
 */
export async function runEndUserPrune(prisma: PrismaClient): Promise<number> {
  return pruneOrphanedEndUsers(coreDeps(prisma));
}
