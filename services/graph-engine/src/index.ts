import { initTracing } from '@tellann/telemetry';
initTracing('graph-engine');

import { Kafka, EachMessagePayload } from 'kafkajs';
import { Topics, ConsumerGroups, kafkaEnabled } from '@tellann/shared';
import { PrismaClient } from '@tellann/db';
import {
  projectSessionIntoGraph,
  triggerReconciliation,
  type SessionAnnouncement,
} from '@tellann/session-core';

/**
 * The Kafka half of graph projection.
 *
 * The projection itself -- state extraction, observed states and transitions,
 * workflow discovery -- moved to @tellann/session-core so the Postgres transport can
 * run it too. This service has no HTTP surface at all, so the alternative was
 * inventing a server, an auth convention and a second failure mode purely to reach
 * code that is nothing but Prisma and @tellann/rules.
 */

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: 'tellann-graph-engine',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: ConsumerGroups.GRAPH_ENGINE });

async function processCompletedSession({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const announcement = JSON.parse(message.value.toString()) as SessionAnnouncement;
    await projectSessionIntoGraph({ prisma, onProjected: triggerReconciliation }, announcement);
  } catch (error) {
    console.error('[GraphEngine] Failed to process session', error);
  }
}

async function start() {
  // Shared helper, so an unset variable cannot mean "consume Kafka" here while it
  // means "write to Postgres" in the collector. Without a broker this process used
  // to fail to connect and exit 1, which is why the Postgres transport produced no
  // observed graph at all. Projection for that transport runs in background-workers.
  if (!kafkaEnabled()) {
    console.log(
      '[GraphEngine] Kafka disabled -- nothing to consume. Session projection for the '
      + 'Postgres transport runs in background-workers.',
    );
    return;
  }

  await consumer.connect();
  await consumer.subscribe({ topic: Topics.SESSIONS_COMPLETED, fromBeginning: true });

  console.log(`[GraphEngine] Started consuming ${Topics.SESSIONS_COMPLETED}`);

  process.on('SIGTERM', async () => {
    console.log('[GraphEngine] SIGTERM -- disconnecting consumer');
    await consumer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });

  await consumer.run({ eachMessage: processCompletedSession });
}

start().catch((error) => {
  console.error('[GraphEngine] Failed to start', error);
  process.exit(1);
});
