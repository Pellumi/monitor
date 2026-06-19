import { PrismaClient } from '../packages/db/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://sots:password@127.0.0.1:5433/sots?schema=public"
    }
  }
});

async function main() {
  const applicationId = 'app-123';
  await prisma.application.upsert({
    where: { id: applicationId },
    update: {},
    create: { id: applicationId, name: 'Test App' }
  });

  const states = [
    { name: 'HOME', category: 'NAVIGATION' },
    { name: 'PRODUCTS', category: 'NAVIGATION' },
    { name: 'CART', category: 'BUSINESS' },
    { name: 'CHECKOUT_SUCCESS', category: 'BUSINESS' },
  ];

  let previousStateId = null;

  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    let state = await prisma.state.findFirst({ where: { applicationId, name: s.name } });
    if (!state) {
      state = await prisma.state.create({
        data: { applicationId, name: s.name, category: s.category, visitCount: 1 }
      });
    }

    if (previousStateId) {
      const action = i === 1 ? 'ViewProducts' : i === 2 ? 'AddToCart' : 'Checkout';
      let transition = await prisma.transition.findFirst({
        where: { applicationId, fromStateId: previousStateId, toStateId: state.id, action }
      });
      if (!transition) {
        await prisma.transition.create({
          data: { applicationId, fromStateId: previousStateId, toStateId: state.id, action, frequency: 1 }
        });
      }
    }
    previousStateId = state.id;
  }
  console.log("Graph Seeded!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
