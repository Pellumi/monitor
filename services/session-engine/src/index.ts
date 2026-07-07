import { initTracing } from '@sots/telemetry';
initTracing('session-engine');

import { Kafka, EachMessagePayload } from 'kafkajs';
import { SotsEvent, Topics, ConsumerGroups, Feature } from '@sots/shared';
import { PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { createStorageClient, buildReplayKey } from '@sots/storage';

interface SessionRepository {
  save(sessionId: string, event: SotsEvent): Promise<void>;
  load(sessionId: string): Promise<SotsEvent[]>;
  complete(sessionId: string): Promise<void>;
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
  async save(sessionId: string, event: SotsEvent): Promise<void> {
    await prisma.application.upsert({
      where: { id: event.applicationId },
      update: {},
      create: { id: event.applicationId, name: `App ${event.applicationId}` }
    });

    await prisma.session.upsert({
      where: { id: sessionId },
      update: {
        endTime: new Date(event.timestamp),
        environmentId: event.environmentId ?? null
      },
      create: {
        id: sessionId,
        applicationId: event.applicationId,
        environmentId: event.environmentId ?? null,
        tenantId: event.tenantId,
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

        if (event.eventType === 'SOTS_ONBOARDING_TEST') {
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

  async load(sessionId: string): Promise<SotsEvent[]> {
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
      eventType: e.eventType as any,
      eventVersion: e.eventVersion,
      source: e.source,
      timestamp: e.timestamp.toISOString(),
      metadata: e.metadata as Record<string, any>
    }));
  }

  async complete(sessionId: string): Promise<void> {
    const events = await this.load(sessionId);
    if (events.length === 0) return;

    const errorCount = events.filter(e => e.eventType === 'ERROR_EVENT').length;

    // Gap 5 fix: compute durationMs from first/last event timestamps
    // instead of session.startTime/endTime (which may be inaccurate for
    // sessions that were created early and updated late).
    const firstTs = new Date(events[0].timestamp).getTime();
    const lastTs  = new Date(events[events.length - 1].timestamp).getTime();
    const durationMs = lastTs - firstTs;

    await prisma.sessionStatistic.upsert({
      where: { sessionId },
      update: { eventCount: events.length, errorCount, durationMs },
      create: { sessionId, eventCount: events.length, errorCount, durationMs }
    });
  }
}


const kafka = new Kafka({
  clientId: 'sots-session-engine',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: ConsumerGroups.SESSION_ENGINE });
const producer = kafka.producer();
const repository: SessionRepository = new PostgresSessionRepository();

async function processEvent({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const event: SotsEvent = JSON.parse(message.value.toString());
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

  await repository.complete(sessionId);

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
    await storage.uploadAndPresign(replayKey, replayBuffer, 'application/json', 86400);
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

async function start() {
  if (process.env.KAFKA_ENABLED === 'false') {
    console.log('[SessionEngine] KAFKA_ENABLED=false — Kafka consumer not started');
    return;
  }

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.TELEMETRY_EVENTS, fromBeginning: true });

  console.log(`[SessionEngine] Started consuming ${Topics.TELEMETRY_EVENTS}`);

  await consumer.run({
    eachMessage: processEvent,
  });

  process.on('SIGTERM', async () => {
    console.log('[SessionEngine] SIGTERM — disconnecting');
    await consumer.disconnect();
    await producer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

start().catch(console.error);
