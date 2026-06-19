import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runTestForFixture(fixtureName: string, events: any[]) {
  const applicationId = `app-test-${fixtureName}`;
  console.log(`\n--- Running test for ${fixtureName} ---`);

  // Start demonstration
  let res = await fetch('http://localhost:3005/demonstrations/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId })
  });
  const { id: demoId, sessionId } = await res.json();

  const formattedEvents = events.map((e, idx) => ({
    eventId: crypto.randomUUID(),
    sessionId,
    tenantId: 'tenant-test',
    applicationId,
    eventType: e.eventType,
    eventVersion: '1.0',
    source: 'web',
    timestamp: new Date(Date.now() + idx * 1000).toISOString(),
    metadata: e.metadata
  }));

  // Send telemetry
  await fetch('http://localhost:3001/v1/events/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formattedEvents)
  });

  // Wait for Kafka propagation
  await delay(6000);

  // Stop & Analyze
  await fetch('http://localhost:3005/demonstrations/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: demoId })
  });

  await fetch('http://localhost:3005/demonstrations/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: demoId })
  });

  // Fetch results
  const reportRes = await fetch(`http://localhost:3005/demonstrations/${demoId}/results`);
  const report = await reportRes.json();

  const graphRes = await fetch(`http://localhost:3004/applications/${applicationId}/graph`);
  const graph = await graphRes.json();

  // Validate Replay Data Completeness
  const savedEvents = await prisma.sessionEvent.findMany({ where: { sessionId } });
  assert.strictEqual(savedEvents.length, events.length, `Expected ${events.length} events, found ${savedEvents.length}`);
  savedEvents.forEach(e => {
    assert.ok(e.id, 'Missing eventId');
    assert.ok(e.timestamp, 'Missing timestamp');
    assert.ok(e.metadata, 'Missing metadata');
    assert.ok(e.eventType, 'Missing eventType');
  });

  console.log(`[PASS] Replay data preserved for ${fixtureName}`);
  console.log(`Report for ${fixtureName}:`);
  console.log(`- Missing States: ${report.missingStates.map((s: any) => s.stateName).join(', ')}`);
  console.log(`- Missing Flows: ${report.missingFlows.map((f:any) => f.path.join(' -> ')).join(' | ')}`);
  console.log(`- Graph Nodes: ${graph.states.map((s:any) => s.name).join(', ')}`);
}

async function main() {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const fixturePath = path.join(fixturesDir, file);
    const events = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    await runTestForFixture(file, events);
  }

  console.log('\nAll E2E Golden-Master Tests Passed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
