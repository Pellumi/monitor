import { Kafka, EachMessagePayload } from 'kafkajs';
import { SotsEvent, Topics } from '@sots/shared';

interface SessionRepository {
  save(sessionId: string, event: SotsEvent): Promise<void>;
  load(sessionId: string): Promise<SotsEvent[]>;
  complete(sessionId: string): Promise<void>;
}

import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();

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

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const errorCount = events.filter(e => e.eventType === 'ERROR_EVENT').length;
    const durationMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();

    await prisma.sessionStatistic.upsert({
      where: { sessionId },
      update: { eventCount: events.length, errorCount, durationMs },
      create: { sessionId, eventCount: events.length, errorCount, durationMs }
    });
  }
}


const kafka = new Kafka({
  clientId: 'sots-session-engine',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'session-engine-group' });
const producer = kafka.producer();
const repository: SessionRepository = new PostgresSessionRepository();

async function processEvent({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const event: SotsEvent = JSON.parse(message.value.toString());
    const { sessionId } = event;

    await repository.save(sessionId, event);

    console.log(`[SessionEngine] Received event ${event.eventType} for session ${sessionId}`);

    const events = await repository.load(sessionId);
    if (events.length >= 5) {
      await emitCompletedSession(sessionId);
    }
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

  await producer.send({
    topic: Topics.SESSIONS_COMPLETED,
    messages: [
      { key: sessionId, value: JSON.stringify(sessionData) }
    ],
  });

  console.log(`[SessionEngine] Emitted completed session ${sessionId}`);
}

async function start() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.TELEMETRY_EVENTS, fromBeginning: true });

  console.log(`[SessionEngine] Started consuming ${Topics.TELEMETRY_EVENTS}`);

  await consumer.run({
    eachMessage: processEvent,
  });
}

start().catch(console.error);
