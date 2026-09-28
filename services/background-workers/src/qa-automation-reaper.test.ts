import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVE_AUTOMATED_RUN_STATUSES, DEFAULT_STALE_AFTER_MS, reapAbandonedAutomatedRuns, reapReasonFor } from './qa-automation-reaper';
import type { ReapableRun, ReaperPrisma } from './qa-automation-reaper';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const run = (over: Partial<ReapableRun> = {}): ReapableRun => ({ id: 'r1', status: 'RECORDING', automation: { executionPhase: 'EXECUTING_FLOW' }, updatedAt: ago(10 * 60_000), timeoutAt: null, ...over });

function fakePrisma(rows: ReapableRun[], options: { racing?: boolean } = {}) {
  const writes: Array<{ id: string; data: Record<string, unknown> }> = [];
  const queries: unknown[] = [];
  const prisma: ReaperPrisma = {
    qARun: {
      async findMany(args) { queries.push(args); return rows; },
      async updateMany(args) {
        if (options.racing) return { count: 0 }; // the run heartbeated between the read and the write
        writes.push({ id: args.where.id, data: args.data as Record<string, unknown> });
        return { count: 1 };
      },
    },
  };
  return { prisma, writes, queries };
}

test('a run whose desktop has been silent too long is ended as a failure of the run, in words a person can read', async () => {
  const { prisma, writes } = fakePrisma([run()]);
  const { reaped } = await reapAbandonedAutomatedRuns(prisma, { now: NOW });
  assert.deepEqual(reaped, [{ runId: 'r1', reason: 'DESKTOP_STOPPED_REPORTING' }]);
  const data = writes[0]!.data;
  assert.equal(data.status, 'FAILED');
  assert.match(String(data.failureReasonSafe), /desktop stopped reporting/);
  assert.match(String(data.failureReasonSafe), /says nothing about your application/);
  assert.deepEqual(data.automation, {
    executionPhase: 'SHUTTING_DOWN', stopReason: 'AUTOMATION_ENGINE_ERROR', awaitingUser: null,
    reapedAt: NOW.toISOString(), reapedFor: 'DESKTOP_STOPPED_REPORTING',
  });
});

test('what was pinned when the run was created survives being reaped', async () => {
  const pinned = { targetTerminalStateKey: 'exam_created', executionProfileId: 'p', codeSnapshotId: 'h' };
  const { prisma, writes } = fakePrisma([run({ automation: pinned })]);
  await reapAbandonedAutomatedRuns(prisma, { now: NOW });
  assert.equal((writes[0]!.data.automation as Record<string, unknown>).targetTerminalStateKey, 'exam_created');
  assert.equal((writes[0]!.data.automation as Record<string, unknown>).codeSnapshotId, 'h');
});

test('a run that heartbeated recently is left alone, even if the row itself is old', () => {
  const recent = run({ updatedAt: ago(60 * 60_000), automation: { heartbeatAt: ago(30_000).toISOString() } });
  assert.equal(reapReasonFor(recent, NOW, DEFAULT_STALE_AFTER_MS), null);
});

test('a heartbeat that is itself stale does not save a run', () => {
  const stale = run({ updatedAt: ago(60 * 60_000), automation: { heartbeatAt: ago(20 * 60_000).toISOString() } });
  assert.equal(reapReasonFor(stale, NOW, DEFAULT_STALE_AFTER_MS), 'DESKTOP_STOPPED_REPORTING');
});

test('a run that is merely quiet for a normal stretch is not reaped', () => {
  assert.equal(reapReasonFor(run({ updatedAt: ago(60_000) }), NOW, DEFAULT_STALE_AFTER_MS), null);
  assert.equal(reapReasonFor(run({ updatedAt: ago(DEFAULT_STALE_AFTER_MS - 1) }), NOW, DEFAULT_STALE_AFTER_MS), null);
});

test('a run past its own time limit is ended for that, even while its desktop is still reporting', () => {
  const overdue = run({ updatedAt: ago(1_000), timeoutAt: ago(1_000), automation: { heartbeatAt: ago(1_000).toISOString() } });
  assert.equal(reapReasonFor(overdue, NOW, DEFAULT_STALE_AFTER_MS), 'TIME_LIMIT_EXCEEDED');
  assert.equal(reapReasonFor(run({ updatedAt: ago(1_000), timeoutAt: new Date(NOW.getTime() + 60_000) }), NOW, DEFAULT_STALE_AFTER_MS), null);
});

test('a run that never reported at all is measured from when it was last written', () => {
  assert.equal(reapReasonFor(run({ automation: null, updatedAt: ago(10 * 60_000) }), NOW, DEFAULT_STALE_AFTER_MS), 'DESKTOP_STOPPED_REPORTING');
  assert.equal(reapReasonFor(run({ automation: 'garbage', updatedAt: ago(1_000) }), NOW, DEFAULT_STALE_AFTER_MS), null);
});

test('a run whose desktop heartbeats between the read and the write is not ended', async () => {
  const { prisma, writes } = fakePrisma([run()], { racing: true });
  const { reaped } = await reapAbandonedAutomatedRuns(prisma, { now: NOW });
  assert.deepEqual(reaped, []);
  assert.deepEqual(writes, []);
});

test('only Automated runs that are still supposed to be going are even looked at', async () => {
  const { prisma, queries } = fakePrisma([]);
  await reapAbandonedAutomatedRuns(prisma, { now: NOW, limit: 10 });
  const query = queries[0] as { where: { mode: string; status: { in: string[] } }; take: number };
  assert.equal(query.where.mode, 'AUTOMATED');
  assert.deepEqual(query.where.status.in, [...ACTIVE_AUTOMATED_RUN_STATUSES]);
  for (const finished of ['COMPLETED', 'COMPLETED_INCOMPLETE', 'FAILED', 'CANCELLED', 'PROCESSING']) assert.ok(!(query.where.status.in as string[]).includes(finished), finished);
  assert.equal(query.take, 10);
});

test('the write is conditional on the run not having changed since it was read', async () => {
  const seen: Array<Record<string, unknown>> = [];
  const prisma: ReaperPrisma = {
    qARun: {
      async findMany() { return [run({ status: 'PAUSED' })]; },
      async updateMany(args) { seen.push(args.where); return { count: 1 }; },
    },
  };
  await reapAbandonedAutomatedRuns(prisma, { now: NOW });
  assert.deepEqual(seen[0], { id: 'r1', status: 'PAUSED', updatedAt: ago(10 * 60_000) });
});

test('several stale runs are all ended, each on its own terms', async () => {
  const { prisma, writes } = fakePrisma([run({ id: 'a' }), run({ id: 'b', timeoutAt: ago(1) }), run({ id: 'fresh', updatedAt: ago(1_000) })]);
  const { reaped } = await reapAbandonedAutomatedRuns(prisma, { now: NOW });
  assert.deepEqual(reaped.map((item) => [item.runId, item.reason]), [['a', 'DESKTOP_STOPPED_REPORTING'], ['b', 'TIME_LIMIT_EXCEEDED']]);
  assert.deepEqual(writes.map((write) => write.id), ['a', 'b']);
});
