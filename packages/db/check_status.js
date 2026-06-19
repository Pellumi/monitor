const { PrismaClient } = require('c:/Users/pellu/dev/monitor/packages/db/dist/index.js');
const prisma = new PrismaClient();

async function main() {
  const appId = "aaa06a95-df13-4d67-9d4d-802476dd1bf2";
  const progress = await prisma.applicationOnboardingProgress.findUnique({
    where: { applicationId: appId }
  });

  console.log('--- Onboarding Progress Status ---');
  console.log(JSON.stringify(progress, null, 2));

  const sessions = await prisma.session.findMany({
    where: { applicationId: appId }
  });
  console.log('Sessions count:', sessions.length);
  if (sessions.length > 0) {
    console.log('Session details:', sessions.map(s => ({ id: s.id, envId: s.environmentId, startTime: s.startTime, createdAt: s.createdAt })));
  }

  const events = await prisma.sessionEvent.findMany({
    where: { session: { applicationId: appId } }
  });
  console.log('Events count:', events.length);
  if (events.length > 0) {
    console.log('Event details:', events.map(e => ({ id: e.id, type: e.eventType, timestamp: e.timestamp, createdAt: e.createdAt })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
