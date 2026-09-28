/**
 * Ending Automated Runs whose desktop has gone away.
 *
 * An Automated Run is driven entirely from the developer's machine. If that machine sleeps, loses power, or the
 * desktop is killed mid-run, nothing is left to tell the platform the run is over: it would sit in `RECORDING` for
 * good, holding a slot, looking alive, and never producing a report. A person-driven run has the same problem but
 * a person notices; an unattended one does not.
 *
 * The desktop reports in while a run is going (`QARun.automation.heartbeatAt`, written each time it reports its phase,
 * which also bumps `updatedAt`). A run that has been silent for longer than any healthy pause is ended here, as a
 * failure of the run (not a finding about the application: the report says nothing about the app), with a reason a
 * person can read. A run past its own time limit is ended the same way.
 *
 * Two guards keep this from ending a run that is in fact alive. The staleness threshold is far longer than the
 * reporting interval, and the write is conditional on the row not having changed since it was read, so a heartbeat
 * that lands between the read and the write wins.
 */

/** The statuses a run has while its desktop is (supposed to be) working on it. */
export const ACTIVE_AUTOMATED_RUN_STATUSES = ['CREATED', 'ARMED', 'WAITING_FOR_INITIAL', 'RECORDING', 'RUNNING', 'PAUSED'] as const;

/** The desktop reports at least every 30 seconds. Silence for ten times that is not a slow moment. */
export const DEFAULT_STALE_AFTER_MS = 5 * 60_000;

export interface ReapableRun {
  id: string;
  status: string;
  automation: unknown;
  updatedAt: Date;
  timeoutAt: Date | null;
}

/** The slice of Prisma this needs, so it can be tested without a database. */
export interface ReaperPrisma {
  qARun: {
    findMany(args: {
      where: { mode: 'AUTOMATED'; status: { in: string[] }; OR: Array<Record<string, unknown>> };
      select: { id: true; status: true; automation: true; updatedAt: true; timeoutAt: true };
      take: number;
      orderBy: { updatedAt: 'asc' };
    }): Promise<ReapableRun[]>;
    updateMany(args: {
      where: { id: string; status: string; updatedAt: Date };
      data: { status: 'FAILED'; endedAt: Date; failureReasonSafe: string; automation: unknown };
    }): Promise<{ count: number }>;
  };
}

export type ReapReason = 'DESKTOP_STOPPED_REPORTING' | 'TIME_LIMIT_EXCEEDED';

export function reapReasonFor(run: ReapableRun, now: Date, staleAfterMs: number): ReapReason | null {
  if (run.timeoutAt && run.timeoutAt.getTime() <= now.getTime()) return 'TIME_LIMIT_EXCEEDED';
  const automation = run.automation && typeof run.automation === 'object' ? (run.automation as Record<string, unknown>) : {};
  const heartbeat = typeof automation.heartbeatAt === 'string' ? new Date(automation.heartbeatAt).getTime() : NaN;
  // A run that never reported (its desktop died before the first report) is measured from its last write.
  const lastSeen = Math.max(run.updatedAt.getTime(), Number.isFinite(heartbeat) ? heartbeat : 0);
  return now.getTime() - lastSeen > staleAfterMs ? 'DESKTOP_STOPPED_REPORTING' : null;
}

const WORDS: Record<ReapReason, string> = {
  DESKTOP_STOPPED_REPORTING: 'The desktop stopped reporting during this run (it may have gone to sleep, lost power or been closed), so the run was ended. This says nothing about your application.',
  TIME_LIMIT_EXCEEDED: 'The run went past its time limit without finishing, so it was ended. This says nothing about your application.',
};

export async function reapAbandonedAutomatedRuns(
  prisma: ReaperPrisma,
  options: { now?: Date; staleAfterMs?: number; limit?: number } = {},
): Promise<{ reaped: Array<{ runId: string; reason: ReapReason }> }> {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const candidates = await prisma.qARun.findMany({
    where: {
      mode: 'AUTOMATED',
      status: { in: [...ACTIVE_AUTOMATED_RUN_STATUSES] },
      OR: [{ updatedAt: { lt: staleBefore } }, { timeoutAt: { lte: now } }],
    },
    select: { id: true, status: true, automation: true, updatedAt: true, timeoutAt: true },
    take: options.limit ?? 50,
    orderBy: { updatedAt: 'asc' },
  });

  const reaped: Array<{ runId: string; reason: ReapReason }> = [];
  for (const run of candidates) {
    // The query is a coarse filter; the decision is made here, on the heartbeat as well as the row.
    const reason = reapReasonFor(run, now, staleAfterMs);
    if (!reason) continue;
    const automation = run.automation && typeof run.automation === 'object' ? (run.automation as Record<string, unknown>) : {};
    const written = await prisma.qARun.updateMany({
      where: { id: run.id, status: run.status, updatedAt: run.updatedAt },
      data: {
        status: 'FAILED',
        endedAt: now,
        failureReasonSafe: WORDS[reason],
        automation: { ...automation, executionPhase: 'SHUTTING_DOWN', stopReason: 'AUTOMATION_ENGINE_ERROR', awaitingUser: null, reapedAt: now.toISOString(), reapedFor: reason },
      },
    });
    if (written.count > 0) reaped.push({ runId: run.id, reason });
  }
  return { reaped };
}
