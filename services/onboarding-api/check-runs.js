const { PrismaClient } = require('@tellann/db');
const prisma = new PrismaClient();

(async () => {
  const runIds = [process.env.RUN_A, process.env.RUN_B];
  if (runIds.some((id) => !id)) throw new Error('Set RUN_A and RUN_B');

  const runs = await prisma.qARun.findMany({
    where: { id: { in: runIds } },
    select: { id: true, status: true, startedAt: true, environmentId: true, applicationId: true },
  });
  console.log('--- run rows ---');
  console.table(runs);

  const grouped = await prisma.qARunEvidenceEvent.groupBy({
    by: ['runId', 'eventType'],
    where: { runId: { in: runIds } },
    _count: { _all: true },
  });
  console.log('--- evidence counts per run ---');
  console.table(grouped.map((g) => ({ runId: g.runId, eventType: g.eventType, count: g._count._all })));

  const sample = await prisma.qARunEvidenceEvent.findMany({
    where: { runId: { in: runIds } },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, runId: true, eventId: true, eventType: true, occurredAt: true },
    take: 20,
  });
  console.log('--- sample rows (identical eventId across two runIds = literal duplication) ---');
  console.table(sample);

  await prisma.$disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
