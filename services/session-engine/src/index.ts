import { initTracing } from '@tellann/telemetry';
initTracing('session-engine');

import { Kafka, EachMessagePayload } from 'kafkajs';
import { TellannEvent, Topics, ConsumerGroups, Feature, isErrorEventType, kafkaEnabled } from '@tellann/shared';
import { PrismaClient } from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { createStorageClient, buildReplayKey } from '@tellann/storage';

interface SessionRepository {
  save(sessionId: string, event: TellannEvent): Promise<void>;
  load(sessionId: string): Promise<TellannEvent[]>;
  /** Resolves true when this caller created the statistics, i.e. won the completion claim. */
  complete(sessionId: string): Promise<boolean>;
}

const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const storage = createStorageClient();

// ─── Idle-timer session completion ─────────────────────────────────────
// Instead of the crude `events.length >= 5` heuristic, we use a 30-second
// idle timer. Each incoming event resets the timer for its session. When
// 30 seconds pass with no new event, the session is considered complete.
const SESSION_IDLE_TIMEOUT_MS = 30_000;
const sessionIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Orphan recovery ───────────────────────────────────────────────────
// The idle timers above only exist in this process's memory, so a restart
// loses every one of them. These bound a query-driven sweep that finds the
// sessions those timers would have completed and completes them instead.
const ORPHAN_SWEEP_INTERVAL_MS = 60_000;
/** Time past the idle timeout before a session is presumed orphaned. */
const ORPHAN_GRACE_MS = SESSION_IDLE_TIMEOUT_MS * 2;
/** Sessions completed per sweep; a backlog drains over successive ticks. */
const ORPHAN_SWEEP_BATCH = 200;
/** How long shutdown waits for in-flight completions before giving up. */
const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

// ─── Entitlement Gate ─────────────────────────────────────────
// Checks SESSION_RECORDING entitlement for the application's org.
// Returns true (allowed) if:
//  a) the application has no organizationId (test/anon), OR
//  b) the org's plan grants SESSION_RECORDING
async function isSessionRecordingAllowed(applicationId: string): Promise<boolean> {
  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (!app?.organizationId) return true; // no org context → allow (test mode)
    return entitlementChecker.canAccess(app.organizationId, Feature.SESSION_RECORDING);
  } catch (err) {
    console.error('[SessionEngine] Entitlement check failed — defaulting to allow', err);
    return true; // fail-open: don't drop events due to entitlement DB errors
  }
}

class PostgresSessionRepository implements SessionRepository {
  async save(sessionId: string, event: TellannEvent): Promise<void> {
    await prisma.application.upsert({
      where: { id: event.applicationId },
      update: {},
      create: { id: event.applicationId, name: `App ${event.applicationId}` }
    });

    await prisma.session.upsert({
      where: { id: sessionId },
      update: {
        endTime: new Date(event.timestamp),
        environmentId: event.environmentId ?? null,
        qaRunId: event.runId ?? null,
        traceId: event.traceId ?? null,
      },
      create: {
        id: sessionId,
        applicationId: event.applicationId,
        environmentId: event.environmentId ?? null,
        tenantId: event.tenantId,
        qaRunId: event.runId ?? null,
        traceId: event.traceId ?? null,
        startTime: new Date(event.timestamp),
        endTime: new Date(event.timestamp)
      }
    });

    await prisma.sessionEvent.create({
      data: {
        id: event.eventId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        source: event.source,
        timestamp: new Date(event.timestamp),
        metadata: event.metadata as any
      }
    });

    // Check onboarding and emit activation events
    if (event.environmentId) {
      const app = await prisma.application.findUnique({
        where: { id: event.applicationId },
        select: { organizationId: true }
      });
      if (app && app.organizationId) {
        const progress = await prisma.applicationOnboardingProgress.findUnique({
          where: { applicationId: event.applicationId }
        });
        if (progress && !progress.sdkConnected) {
          await prisma.applicationOnboardingProgress.update({
            where: { applicationId: event.applicationId },
            data: { sdkConnected: true }
          });
          await prisma.activationEvent.create({
            data: {
              organizationId: app.organizationId,
              applicationId: event.applicationId,
              environmentId: event.environmentId,
              eventName: 'SDK_CONNECTED',
              metadata: { sessionId }
            }
          });
        }

        if (event.eventType === 'TELLANN_ONBOARDING_TEST') {
          if (progress && !progress.installationTestPassed) {
            await prisma.applicationOnboardingProgress.update({
              where: { applicationId: event.applicationId },
              data: { installationTestPassed: true }
            });
            await prisma.activationEvent.create({
              data: {
                organizationId: app.organizationId,
                applicationId: event.applicationId,
                environmentId: event.environmentId,
                eventName: 'INSTALL_TEST_PASSED',
                metadata: { sessionId }
              }
            });
          }
        }
      }
    }
  }

  async load(sessionId: string): Promise<TellannEvent[]> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { events: { orderBy: { timestamp: 'asc' } } }
    });
    if (!session) return [];
    
    return session.events.map(e => ({
      eventId: e.id,
      sessionId: e.sessionId,
      tenantId: session.tenantId,
      applicationId: session.applicationId,
      runId: session.qaRunId,
      traceId: session.traceId,
      eventType: e.eventType as any,
      eventVersion: e.eventVersion,
      source: e.source,
      timestamp: e.timestamp.toISOString(),
      metadata: e.metadata as Record<string, any>
    }));
  }

  /**
   * Writes the session's statistics and reports whether this process was the
   * one that created them.
   *
   * The row is `create`d rather than `upsert`ed so the unique constraint on
   * `sessionId` acts as the completion claim: exactly one caller can win, and
   * only the winner goes on to upload the replay and announce the session.
   * Without that, the idle timer and the orphan sweeper could both complete the
   * same session and emit `SESSIONS_COMPLETED` twice.
   *
   * A losing caller still refreshes the numbers — a late-arriving event is a
   * legitimate reason to re-complete a session — it just does not re-announce.
   */
  async complete(sessionId: string): Promise<boolean> {
    const events = await this.load(sessionId);
    if (events.length === 0) return false;

    // Every error-shaped event counts, not only `ERROR_EVENT`: a session full
    // of unhandled exceptions used to report zero errors here and in the
    // replay timeline.
    const errorCount = events.filter(e => isErrorEventType(e.eventType)).length;

    // Gap 5 fix: compute durationMs from first/last event timestamps
    // instead of session.startTime/endTime (which may be inaccurate for
    // sessions that were created early and updated late).
    const firstTs = new Date(events[0].timestamp).getTime();
    const lastTs  = new Date(events[events.length - 1].timestamp).getTime();
    const durationMs = lastTs - firstTs;
    const statistics = { eventCount: events.length, errorCount, durationMs };

    try {
      await prisma.sessionStatistic.create({ data: { sessionId, ...statistics } });
      return true;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      await prisma.sessionStatistic.update({ where: { sessionId }, data: statistics });
      return false;
    }
  }
}

/** A Prisma unique-constraint violation, which here means "someone else claimed it". */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002');
}


const kafka = new Kafka({
  clientId: 'tellann-session-engine',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: ConsumerGroups.SESSION_ENGINE });
const producer = kafka.producer();
const repository: SessionRepository = new PostgresSessionRepository();

async function processEvent({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const event: TellannEvent = JSON.parse(message.value.toString());
    const { sessionId } = event;

    // ── Entitlement gate: SESSION_RECORDING ──────────────────────
    const allowed = await isSessionRecordingAllowed(event.applicationId);
    if (!allowed) {
      console.log(
        `[SessionEngine] SESSION_RECORDING not entitled for app ${event.applicationId} — event dropped`,
        { sessionId, eventType: event.eventType }
      );
      return; // silently drop; the SDK should not be recording for free-tier orgs
    }

    await repository.save(sessionId, event);

    console.log(`[SessionEngine] Received event ${event.eventType} for session ${sessionId}`);

    // Gap 5: Replace `events.length >= 5` heuristic with idle-timer completion.
    // Reset the idle timer each time an event arrives for this session.
    const existingTimer = sessionIdleTimers.get(sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      sessionIdleTimers.delete(sessionId);
      try {
        await emitCompletedSession(sessionId);
      } catch (err) {
        console.error(`[SessionEngine] Idle-timer completion failed for ${sessionId}`, err);
      }
    }, SESSION_IDLE_TIMEOUT_MS);

    sessionIdleTimers.set(sessionId, timer);
  } catch (error) {
    console.error('[SessionEngine] Failed to process event', error);
  }
}

async function emitCompletedSession(sessionId: string) {
  const events = await repository.load(sessionId);
  if (events.length === 0) return;

  // Whoever creates the statistics row owns the rest of completion. A session
  // that was already completed — by the sweeper, or by this timer before a
  // late event rearmed it — has its numbers refreshed above and stops here,
  // rather than uploading a second replay and announcing itself twice.
  const claimed = await repository.complete(sessionId);
  if (!claimed) return;

  const sessionData = {
    sessionId,
    eventCount: events.length,
    startTime: events[0].timestamp,
    endTime: events[events.length - 1].timestamp,
    tenantId: events[0].tenantId,
    applicationId: events[0].applicationId,
    events,
  };

  // Gap 1 (remaining): Upload replay JSON to object storage
  try {
    const replayKey = buildReplayKey(sessionId);
    const replayBuffer = Buffer.from(JSON.stringify(sessionData), 'utf-8');
    const application = await prisma.application.findUnique({
      where: { id: sessionData.applicationId },
      select: { organizationId: true },
    });
    if (application?.organizationId) {
      const quota = await entitlementChecker.canReserveStorage(application.organizationId, BigInt(replayBuffer.byteLength));
      if (!quota.allowed) {
        console.warn(`[SessionEngine] Replay storage quota reached for organization ${application.organizationId}`);
        throw new Error('QUOTA_EXCEEDED: replay storage limit reached');
      }
    }
    await storage.uploadAndPresign(replayKey, replayBuffer, 'application/json', 86400);
    if (application?.organizationId) {
      await prisma.storageLedgerEntry.upsert({
        where: { objectKey: replayKey },
        create: { organizationId: application.organizationId, objectKey: replayKey, ownerType: 'SESSION', ownerId: sessionId, category: 'SESSION_REPLAY', bytes: BigInt(replayBuffer.byteLength) },
        update: { bytes: BigInt(replayBuffer.byteLength), reservedBytes: 0n, deletedAt: null },
      });
    }
    console.log(`[SessionEngine] Uploaded replay to storage: ${replayKey}`);
  } catch (storageErr) {
    console.warn(`[SessionEngine] Failed to upload replay for ${sessionId} to storage — non-fatal`, storageErr);
  }

  await producer.send({
    topic: Topics.SESSIONS_COMPLETED,
    messages: [
      { key: sessionId, value: JSON.stringify(sessionData) }
    ],
  });

  console.log(`[SessionEngine] Emitted completed session ${sessionId}`);
}

/**
 * Completes sessions whose idle timer never fired.
 *
 * The timers live in this process's memory, so a restart, a crash or a deploy
 * used to orphan every session that was in flight: no statistics, no replay,
 * no `SESSIONS_COMPLETED`, and nothing that would ever retry. Those sessions
 * showed "—" for duration, events and errors in the dashboard forever.
 *
 * This is query-driven rather than memory-driven, so it recovers them on the
 * next tick after any restart. A session this process still holds a timer for
 * is skipped — that timer is about to do the same work, and the completion
 * claim would make the loser's work wasted anyway.
 */
async function sweepOrphanedSessions(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS - ORPHAN_GRACE_MS);
  const orphans = await prisma.session.findMany({
    where: { statistics: { is: null }, endTime: { lt: cutoff } },
    select: { id: true },
    orderBy: { endTime: 'asc' },
    take: ORPHAN_SWEEP_BATCH,
  });

  let completed = 0;
  for (const { id } of orphans) {
    if (sessionIdleTimers.has(id)) continue;
    // One unrecoverable session must not abort the sweep for every other one.
    try {
      await emitCompletedSession(id);
      completed += 1;
    } catch (err) {
      console.error(`[SessionEngine] Orphan completion failed for ${id}`, err);
    }
  }
  if (completed) console.log(`[SessionEngine] Swept ${completed} orphaned session(s)`);
  return completed;
}

/**
 * Completes everything still armed before the process goes away, so a rolling
 * deploy does not manufacture the orphans the sweeper then has to find.
 */
async function drainPendingSessions(): Promise<void> {
  const pending = [...sessionIdleTimers.keys()];
  for (const timer of sessionIdleTimers.values()) clearTimeout(timer);
  sessionIdleTimers.clear();
  if (!pending.length) return;
  console.log(`[SessionEngine] Draining ${pending.length} pending session(s)`);
  await Promise.race([
    Promise.allSettled(pending.map((sessionId) => emitCompletedSession(sessionId))),
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DRAIN_TIMEOUT_MS)),
  ]);
}

async function start() {
  // Read through the shared helper, so this service and the collector upstream of
  // it agree about what an unset variable means. They did not: the collector
  // treated it as "write to Postgres" while this process treated it as "consume
  // Kafka", so with no broker configured `producer.connect()` exhausted its
  // retries and the catch below exited 1. It crash-looped, and because the
  // orphan sweep is armed further down this function, nothing on the Postgres
  // path was ever completed — no statistics, no replay, no graph.
  if (!kafkaEnabled()) {
    console.log(
      '[SessionEngine] Kafka disabled — nothing to consume. Session completion for the '
      + 'Postgres transport runs in background-workers.',
    );
    return;
  }

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.TELEMETRY_EVENTS, fromBeginning: true });

  console.log(`[SessionEngine] Started consuming ${Topics.TELEMETRY_EVENTS}`);

  const sweepTimer = setInterval(() => {
    void sweepOrphanedSessions().catch((err) =>
      console.error('[SessionEngine] Orphan sweep failed', err));
  }, ORPHAN_SWEEP_INTERVAL_MS);
  // Never hold the process open on the sweep alone.
  sweepTimer.unref?.();
  void sweepOrphanedSessions().catch((err) =>
    console.error('[SessionEngine] Initial orphan sweep failed', err));

  await consumer.run({
    eachMessage: processEvent,
  });

  process.on('SIGTERM', async () => {
    console.log('[SessionEngine] SIGTERM — disconnecting');
    clearInterval(sweepTimer);
    // Stop taking new work before draining, so a fresh event cannot rearm a
    // timer that is about to be abandoned.
    await consumer.disconnect();
    await drainPendingSessions().catch((err) =>
      console.error('[SessionEngine] Drain failed', err));
    await producer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error('[SessionEngine] Failed to start', error);
  process.exit(1);
});
