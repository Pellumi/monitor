import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@tellann/db';
import type { TellannEvent } from '@tellann/shared';
import { completeSession, computeStatistics } from './complete-session';
import type { CompletionSink, SessionAnnouncement, SessionCoreDeps } from './deps';

// ─────────────────────────────────────────────────────────────────────────────
// Fakes — the slice of Prisma completion touches. `$transaction` runs the callback
// directly: the point of these tests is the decision logic, while concurrency is
// the database's contract (an advisory lock and a unique index), not this
// function's. `lockAvailable` stands in for the lock's answer.
// ─────────────────────────────────────────────────────────────────────────────

interface FakeWorld {
  sessions: Map<string, any>;
  statistics: Map<string, any>;
  facets: Map<string, any>;
  lockAvailable: boolean;
  announcements: SessionAnnouncement[];
}

function fakeDeps(world: FakeWorld): SessionCoreDeps {
  const tx = {
    async $queryRaw() {
      return [{ locked: world.lockAvailable }];
    },
    session: {
      async findUnique({ where }: { where: { id: string } }) {
        return world.sessions.get(where.id) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, any> }) {
        const session = world.sessions.get(where.id);
        if (!session) throw new Error('NOT_FOUND');
        Object.assign(session, data);
        return session;
      },
    },
    sessionFacet: {
      async upsert({ where, create, update }: { where: { sessionId: string }; create: any; update: any }) {
        const existing = world.facets.get(where.sessionId);
        const row = existing ? { ...existing, ...update } : { ...create };
        world.facets.set(where.sessionId, row);
        return row;
      },
    },
    sessionStatistic: {
      async create({ data }: { data: Record<string, any> }) {
        if (world.statistics.has(data.sessionId)) {
          const error: any = new Error('UNIQUE_VIOLATION');
          error.code = 'P2002';
          throw error;
        }
        world.statistics.set(data.sessionId, { ...data });
        return world.statistics.get(data.sessionId);
      },
      async update({ where, data }: { where: { sessionId: string }; data: Record<string, any> }) {
        const existing = world.statistics.get(where.sessionId);
        Object.assign(existing, data);
        return existing;
      },
    },
  };

  const prisma = {
    async $transaction(fn: (client: any) => Promise<any>) { return fn(tx); },
    session: tx.session,
    sessionStatistic: tx.sessionStatistic,
    sessionFacet: tx.sessionFacet,
  } as unknown as PrismaClient;

  const sink: CompletionSink = {
    async enqueue(_tx, announcement) { world.announcements.push(announcement); },
  };

  return { prisma, sink, now: () => new Date('2026-09-29T12:00:00.000Z'), logger: { log() {}, warn() {}, error() {} } };
}

function event(overrides: Partial<TellannEvent> & { id: string; at: string; type?: string }): any {
  return {
    id: overrides.id,
    sessionId: 'session-1',
    eventType: overrides.type ?? 'PAGE_VIEW',
    eventVersion: '1.0',
    source: 'frontend-sdk',
    timestamp: new Date(overrides.at),
    metadata: {},
  };
}

function world(events: any[], options: { lockAvailable?: boolean; alreadyComplete?: boolean } = {}): FakeWorld {
  const sessions = new Map<string, any>([
    ['session-1', {
      id: 'session-1',
      tenantId: 'org-1',
      applicationId: 'app-1',
      environmentId: 'env-1',
      qaRunId: null,
      traceId: null,
      completedAt: null,
      facetVersion: null,
      anonymousId: 'anon-1',
      endUserId: null,
      deviceType: 'desktop',
      browserName: 'Chrome',
      osName: 'macOS',
      releaseVersion: null,
      sampleRate: null,
      events,
    }],
  ]);
  const statistics = new Map<string, any>();
  if (options.alreadyComplete) {
    statistics.set('session-1', { sessionId: 'session-1', eventCount: 1, errorCount: 0, durationMs: 0 });
    sessions.get('session-1').completedAt = new Date('2026-09-29T11:00:00.000Z');
  }
  return {
    sessions,
    statistics,
    facets: new Map<string, any>(),
    lockAvailable: options.lockAvailable ?? true,
    announcements: [],
  };
}

// ─── Statistics ──────────────────────────────────────────────────────────────

test('duration spans the first and last event, not the session row', () => {
  // A session row is created when its first event arrives and touched when its
  // last one does, which is not the span the user actually spent.
  const stats = computeStatistics([
    { timestamp: '2026-09-29T12:00:00.000Z', eventType: 'PAGE_VIEW' },
    { timestamp: '2026-09-29T12:00:09.500Z', eventType: 'BUTTON_CLICK' },
  ] as TellannEvent[]);
  assert.equal(stats.durationMs, 9_500);
  assert.equal(stats.eventCount, 2);
});

test('every error-shaped event counts, not only ERROR_EVENT', () => {
  // The bug this pins: a session full of UNHANDLED_EXCEPTIONs reported zero errors.
  const stats = computeStatistics([
    { timestamp: '2026-09-29T12:00:00.000Z', eventType: 'UNHANDLED_EXCEPTION' },
    { timestamp: '2026-09-29T12:00:01.000Z', eventType: 'SERVER_ERROR' },
    { timestamp: '2026-09-29T12:00:02.000Z', eventType: 'PAGE_VIEW' },
  ] as TellannEvent[]);
  assert.equal(stats.errorCount, 2);
});

test('a workflow that did not complete is a flow outcome, not a runtime error', () => {
  const stats = computeStatistics([
    { timestamp: '2026-09-29T12:00:00.000Z', eventType: 'WORKFLOW_FAILED' },
  ] as TellannEvent[]);
  assert.equal(stats.errorCount, 0);
});

// ─── Completion ──────────────────────────────────────────────────────────────

test('completing a session claims it, stamps completedAt, and announces once', async () => {
  const w = world([
    event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' }),
    event({ id: 'e2', at: '2026-09-29T12:00:05.000Z', type: 'SERVER_ERROR' }),
  ]);
  const outcome = await completeSession(fakeDeps(w), 'session-1');

  assert.equal(outcome.status, 'COMPLETED');
  assert.deepEqual(w.statistics.get('session-1'), {
    sessionId: 'session-1', eventCount: 2, errorCount: 1, durationMs: 5_000,
  });
  assert.equal(w.sessions.get('session-1').completedAt?.toISOString(), '2026-09-29T12:00:00.000Z');
  assert.equal(w.announcements.length, 1);
  assert.equal(w.announcements[0].eventCount, 2);
  assert.equal(w.announcements[0].applicationId, 'app-1');
});

test('completing twice announces once', async () => {
  // The claim is the unique constraint on SessionStatistic.sessionId. Before the
  // announcement moved inside the claim transaction, the idle timer and the orphan
  // sweeper could both complete one session and emit SESSIONS_COMPLETED twice.
  const events = [
    event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' }),
    event({ id: 'e2', at: '2026-09-29T12:00:05.000Z' }),
  ];
  const w = world(events);
  const deps = fakeDeps(w);

  const first = await completeSession(deps, 'session-1');
  const second = await completeSession(deps, 'session-1');

  assert.equal(first.status, 'COMPLETED');
  assert.equal(second.status, 'ALREADY_COMPLETE');
  assert.equal(w.announcements.length, 1, 'the second caller must not re-announce');
});

test('a late event refreshes the statistics without re-announcing', async () => {
  const events = [event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' })];
  const w = world(events, { alreadyComplete: true });
  const deps = fakeDeps(w);

  // A genuinely late event is a legitimate reason to re-measure a session.
  events.push(event({ id: 'e2', at: '2026-09-29T12:00:30.000Z', type: 'ERROR_OCCURRED' }));

  const outcome = await completeSession(deps, 'session-1');

  assert.equal(outcome.status, 'ALREADY_COMPLETE');
  assert.equal(w.statistics.get('session-1').eventCount, 2);
  assert.equal(w.statistics.get('session-1').errorCount, 1);
  assert.equal(w.statistics.get('session-1').durationMs, 30_000);
  assert.equal(w.announcements.length, 0);
});

test('a re-measure rewrites the facet rather than leaving it stale', async () => {
  // eventCount and errorCount are facet fields, so a refreshed statistic that left the
  // facet alone would make search disagree with the row it returns.
  const events = [event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' })];
  const w = world(events, { alreadyComplete: true });
  events.push(event({ id: 'e2', at: '2026-09-29T12:00:04.000Z', type: 'SERVER_ERROR' }));

  await completeSession(fakeDeps(w), 'session-1');

  const facet = w.facets.get('session-1');
  assert.equal(facet.eventCount, 2);
  assert.equal(facet.errorCount, 1);
  assert.equal(facet.durationMs, 4_000);
});

test('completion writes a facet carrying what the reader will filter on', async () => {
  const w = world([
    event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' }),
    event({ id: 'e2', at: '2026-09-29T12:00:03.000Z', type: 'UNHANDLED_EXCEPTION' }),
  ]);
  await completeSession(fakeDeps(w), 'session-1');

  const facet = w.facets.get('session-1');
  assert.ok(facet, 'a completed session is searchable');
  assert.equal(facet.applicationId, 'app-1');
  assert.equal(facet.environmentId, 'env-1');
  assert.equal(facet.anonymousId, 'anon-1');
  assert.equal(facet.deviceType, 'desktop');
  assert.deepEqual([...facet.eventTypes].sort(), ['PAGE_VIEW', 'UNHANDLED_EXCEPTION']);
  assert.deepEqual(facet.errorNames, ['UNHANDLED_EXCEPTION']);
  assert.equal(w.sessions.get('session-1').facetVersion, facet.facetVersion);
});

test('a session another process holds the lock on is skipped, not failed', async () => {
  // This is what replaces the sweeper's process-local `sessionIdleTimers.has(id)`
  // guard, which stopped meaning anything once a second process could complete.
  const w = world([event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' })], { lockAvailable: false });
  const outcome = await completeSession(fakeDeps(w), 'session-1');

  assert.equal(outcome.status, 'LOCK_HELD');
  assert.equal(w.statistics.size, 0);
  assert.equal(w.announcements.length, 0);
});

test('a session with no events yet is distinguished from one that is gone', async () => {
  const present = world([]);
  assert.equal((await completeSession(fakeDeps(present), 'session-1')).status, 'NO_EVENTS');

  const absent = world([]);
  absent.sessions.delete('session-1');
  // A deleted sweep candidate must report MISSING, so the sweep stops retrying it.
  assert.equal((await completeSession(fakeDeps(absent), 'session-1')).status, 'MISSING');
});

test('the announcement carries the event window, so downstream needs no second read', async () => {
  const w = world([
    event({ id: 'e1', at: '2026-09-29T12:00:00.000Z' }),
    event({ id: 'e2', at: '2026-09-29T12:00:07.000Z' }),
  ]);
  await completeSession(fakeDeps(w), 'session-1');

  const announcement = w.announcements[0];
  assert.equal(announcement.startTime, '2026-09-29T12:00:00.000Z');
  assert.equal(announcement.endTime, '2026-09-29T12:00:07.000Z');
  assert.equal(announcement.events?.length, 2);
  assert.equal(announcement.environmentId, 'env-1');
});
