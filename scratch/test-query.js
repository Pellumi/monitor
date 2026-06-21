const { PrismaClient } = require('c:/Users/pellu/dev/monitor/packages/db/dist/index.js');

const prisma = new PrismaClient();

async function test() {
  console.log('Fetching latest email deliveries...');
  try {
    const deliveries = await prisma.emailDelivery.findMany({
      orderBy: { sentAt: 'desc' },
      take: 5
    });
    console.log('Deliveries:', JSON.stringify(deliveries, null, 2));
  } catch (err) {
    console.error('Error fetching deliveries:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
