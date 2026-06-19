import { PrismaClient } from '../packages/db/node_modules/@prisma/client/index.js';
import crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://sots:password@127.0.0.1:5433/sots?schema=public" } }
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  const applicationId = 'app-123';

  console.log("Cleaning database...");
  await prisma.demonstration.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.coverageSnapshot.deleteMany();
  await prisma.missingFlow.deleteMany();
  await prisma.missingState.deleteMany();
  await prisma.candidateState.deleteMany();
  await prisma.transitionObservation.deleteMany();
  await prisma.stateObservation.deleteMany();
  await prisma.transition.deleteMany();
  await prisma.state.deleteMany();
  await prisma.sessionEvent.deleteMany();
  await prisma.session.deleteMany();

  console.log("Database clean.");

  console.log("1. Starting Demonstration...");
  let res = await fetch('http://localhost:3005/demonstrations/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId })
  });
  const { id: demoId, sessionId } = await res.json();
  console.log(`Demonstration started: ${demoId}, session: ${sessionId}`);

  console.log("2. Sending Telemetry Events...");
  const createEvent = (type: any, metadata: any, offset = 0) => ({
    eventId: crypto.randomUUID(),
    sessionId,
    tenantId: 'tenant-1',
    applicationId,
    eventType: type,
    eventVersion: '1.0',
    source: 'web',
    timestamp: new Date(Date.now() + offset).toISOString(),
    metadata
  });

  const events = [
    createEvent('PAGE_VIEW', { url: '/register' }, 0),
    createEvent('PAGE_VIEW', { url: '/login' }, 1000),
    createEvent('PAGE_VIEW', { url: '/products' }, 2000),
    createEvent('BUTTON_CLICK', { id: 'AddToCart' }, 3000),
    createEvent('PAGE_VIEW', { url: '/cart' }, 4000),
    createEvent('BUTTON_CLICK', { id: 'Checkout' }, 5000),
    createEvent('PAGE_VIEW', { url: '/checkout/success' }, 6000),
  ];

  const resBatch = await fetch('http://localhost:3001/v1/events/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(events)
  });
  console.log("Telemetry response:", resBatch.status, await resBatch.text());
  console.log("Telemetry sent. Waiting 8s for Kafka streaming...");
  await delay(8000);

  console.log("3. Stopping Demonstration...");
  await fetch('http://localhost:3005/demonstrations/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: demoId })
  });

  console.log("4. Analyzing Demonstration...");
  await fetch('http://localhost:3005/demonstrations/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: demoId })
  });

  console.log("5. Fetching Report...");
  res = await fetch(`http://localhost:3005/demonstrations/${demoId}/results`);
  const report = await res.json();

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
