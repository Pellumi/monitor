import { completeSession } from './complete-session';
import {
  ORPHAN_GRACE_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SWEEP_BATCH_SIZE,
  depsLogger,
  type SessionCoreDeps,
} from './deps';

export interface SweepOptions {
  dryRun?: boolean;
  now?: Date;
  batchSize?: number;
  /**
   * Session ids the calling process holds a live in-memory timer for. A cheap
   * pre-filter only — the advisory lock inside `completeSession` is what actually
   * prevents two processes doing the same work, because this set is process-local.
   */
  skip?: ReadonlySet<string>;
}

export interface SweepResult {
  dryRun: boolean;
  candidates: number;
  completed: number;
  alreadyComplete: number;
  lockHeld: number;
  noEvents: number;
  missing: number;
  failed: number;
}

/**
 * Completes every session that has gone quiet, whatever the transport.
 *
 * This is the whole parity fix. Completion used to be driven only by in-memory
 * timers inside session-engine's Kafka consumer, which meant: a restart orphaned
 * every in-flight session, and a deployment without a broker never completed
 * anything at all — no statistics, no announcement, no observed graph, and nothing
 * that would ever retry. Those sessions showed "—" for duration, events and errors
 * in the dashboard forever.
 *
 * Being query-driven rather than memory-driven, it recovers them on the next tick
 * after any restart, and it is the *primary* completion path when Kafka is off.
 */
export async function sweepCompletableSessions(
  deps: SessionCoreDeps,
  options: SweepOptions = {},
): Promise<SweepResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? (deps.now ? deps.now() : new Date());
  const batchSize = options.batchSize ?? SWEEP_BATCH_SIZE;

  const cutoff = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS - ORPHAN_GRACE_MS);

  // `completedAt IS NULL` rather than `statistics: { is: null }`. The latter plans
  // as a LEFT JOIN anti-join across the two largest tables in the schema with
  // nothing to support it, so it got slower with every session ever completed;
  // this one rides the `Session_incomplete_idx` partial index and stays
  // proportional to the backlog.
  const candidates = await prisma.session.findMany({
    where: { completedAt: null, endTime: { lt: cutoff } },
    select: { id: true },
    orderBy: { endTime: 'asc' },
    take: batchSize,
  });

  const result: SweepResult = {
    dryRun,
    candidates: candidates.length,
    completed: 0,
    alreadyComplete: 0,
    lockHeld: 0,
    noEvents: 0,
    missing: 0,
    failed: 0,
  };

  for (const { id } of candidates) {
    if (options.skip?.has(id)) continue;
    if (dryRun) continue;

    // One unrecoverable session must not abort the sweep for every other one.
    try {
      const outcome = await completeSession(deps, id);
      switch (outcome.status) {
        case 'COMPLETED': result.completed += 1; break;
        case 'ALREADY_COMPLETE': result.alreadyComplete += 1; break;
        case 'LOCK_HELD': result.lockHeld += 1; break;
        case 'NO_EVENTS': result.noEvents += 1; break;
        case 'MISSING': result.missing += 1; break;
      }
    } catch (err) {
      result.failed += 1;
      logger.error(`[session-core] Sweep completion failed for ${id}`, err);
    }
  }

  if (result.completed || result.failed) {
    logger.log(
      `[session-core] Swept ${result.completed} session(s) `
      + `(candidates=${result.candidates} already=${result.alreadyComplete} `
      + `locked=${result.lockHeld} failed=${result.failed})`,
    );
  }

  return result;
}

/**
 * Sessions with no events and no prospect of any.
 *
 * `applyEventToSession` writes the session row before its first event, so a crash
 * between the two leaves a row that the sweep would otherwise retry every tick
 * forever. Old enough and still empty means it is never going to fill.
 */
export async function pruneEmptySessions(
  deps: SessionCoreDeps,
  options: { now?: Date; olderThanMs?: number; batchSize?: number } = {},
): Promise<number> {
  const { prisma } = deps;
  const now = options.now ?? (deps.now ? deps.now() : new Date());
  const olderThanMs = options.olderThanMs ?? 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - olderThanMs);

  const empty = await prisma.session.findMany({
    where: { completedAt: null, endTime: { lt: cutoff }, events: { none: {} } },
    select: { id: true },
    take: options.batchSize ?? SWEEP_BATCH_SIZE,
  });
  if (empty.length === 0) return 0;

  const ids = empty.map((session) => session.id);
  await prisma.session.deleteMany({ where: { id: { in: ids } } });
  depsLogger(deps).log(`[session-core] Pruned ${ids.length} empty session row(s)`);
  return ids.length;
}
