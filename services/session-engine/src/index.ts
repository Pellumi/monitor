import { initTracing } from '@tellann/telemetry';
initTracing('session-engine');

import { Kafka, EachMessagePayload } from 'kafkajs';
import { TellannEvent, Topics, ConsumerGroups, kafkaEnabled } from '@tellann/shared';
import { PrismaClient } from '@tellann/db';
import {
  SESSION_IDLE_TIMEOUT_MS,
  applyEventToSession,
  completeSession,
  drainCompletionOutbox,
  outboxSink,
  sweepCompletableSessions,
  type SessionCoreDeps,
} from '@tellann/session-core';

/**
 * The Kafka half of session ingestion.
 *
 * Everything this service used to decide — how a session is persisted, when it is
 * finished, what its statistics are, what downstream is told — now lives in
 * @tellann/session-core, because a deployment without a broker never reached any of
 * it. What is left here is genuinely Kafka's: consume the topic, hold the idle
 * timers, relay the completion outbox to SESSIONS_COMPLETED, and drain on shutdown.
 *
 * The same completion code is driven from background-workers by a query instead of
 * a timer, so both transports produce identical rows.
 */

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: 'tellann-session-engine',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: ConsumerGroups.SESSION_ENGINE });
const producer = kafka.producer();

const deps: SessionCoreDeps = { prisma, sink: outboxSink };

// ─── Idle-timer completion ───────────────────────────────────────────────────
// Each incoming event rearms its session's timer. These live in this process's
// memory, which is exactly why the query-driven sweep exists as well: a restart
// loses every one of them.
const sessionIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** How often to sweep sessions whose timer was lost, and to relay the outbox. */
const ORPHAN_SWEEP_INTERVAL_MS = 60_000;
const OUTBOX_RELAY_INTERVAL_MS = 2_000;
/** How long shutdown waits for in-flight completions before giving up. */
const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

async function processEvent({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const event: TellannEvent = JSON.parse(message.value.toString());
    const { sessionId } = event;

    const outcome = await applyEventToSession(prisma, event);
    if (!outcome.accepted) {
      // An unknown application used to be *created* here, from the event payload,
      // which let anything reaching the collector mint a tenant-less row that then
      // owned real sessions.
      console.warn(
        `[SessionEngine] Dropped event ${event.eventId}: ${outcome.reason}`,
        { sessionId, applicationId: event.applicationId },
      );
      return;
    }

    const existingTimer = sessionIdleTimers.get(sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      sessionIdleTimers.delete(sessionId);
      void completeSession(deps, sessionId).catch((err) =>
        console.error(`[SessionEngine] Idle-timer completion failed for ${sessionId}`, err));
    }, SESSION_IDLE_TIMEOUT_MS);

    sessionIdleTimers.set(sessionId, timer);
  } catch (error) {
    console.error('[SessionEngine] Failed to process event', error);
  }
}

/**
 * Publishes completed sessions to `SESSIONS_COMPLETED`.
 *
 * The announcement is written to the outbox inside the completion transaction, so
 * unlike the previous `producer.send` this cannot lose one: a failed publish leaves
 * the row PENDING with a backoff, and the next tick retries it. Before, a throw
 * here left the session claimed and never announced, with nothing to retry it —
 * the next sweep saw statistics present and skipped it forever.
 */
async function relayOutbox(): Promise<void> {
  await drainCompletionOutbox(deps, async (announcement) => {
    await producer.send({
      topic: Topics.SESSIONS_COMPLETED,
      messages: [{ key: announcement.sessionId, value: JSON.stringify(announcement) }],
    });
  });
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
    Promise.allSettled(pending.map((sessionId) => completeSession(deps, sessionId))),
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DRAIN_TIMEOUT_MS)),
  ]);
  // Give the relay one last chance so the drained sessions are announced before the
  // producer disconnects, rather than waiting for a worker to notice them.
  await relayOutbox().catch((err) => console.error('[SessionEngine] Final outbox relay failed', err));
}

async function start() {
  // Read through the shared helper, so this service and the collector upstream of
  // it agree about what an unset variable means. They did not: the collector
  // treated it as "write to Postgres" while this process treated it as "consume
  // Kafka", so with no broker configured `producer.connect()` exhausted its
  // retries and the catch below exited 1. It crash-looped, and because completion
  // was armed inside this function, nothing on the Postgres path was ever
  // completed — no statistics, no replay, no graph.
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

  const relayTimer = setInterval(() => {
    void relayOutbox().catch((err) => console.error('[SessionEngine] Outbox relay failed', err));
  }, OUTBOX_RELAY_INTERVAL_MS);
  relayTimer.unref?.();

  const sweepTimer = setInterval(() => {
    // `skip` is a cheap pre-filter; the advisory lock inside completeSession is what
    // actually prevents two processes doing the same work.
    void sweepCompletableSessions(deps, { skip: new Set(sessionIdleTimers.keys()) })
      .catch((err) => console.error('[SessionEngine] Orphan sweep failed', err));
  }, ORPHAN_SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();

  void sweepCompletableSessions(deps).catch((err) =>
    console.error('[SessionEngine] Initial orphan sweep failed', err));

  process.on('SIGTERM', async () => {
    console.log('[SessionEngine] SIGTERM — disconnecting');
    clearInterval(sweepTimer);
    clearInterval(relayTimer);
    // Stop taking new work before draining, so a fresh event cannot rearm a timer
    // that is about to be abandoned.
    await consumer.disconnect();
    await drainPendingSessions().catch((err) =>
      console.error('[SessionEngine] Drain failed', err));
    await producer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });

  await consumer.run({ eachMessage: processEvent });
}

start().catch((error) => {
  console.error('[SessionEngine] Failed to start', error);
  process.exit(1);
});
