import { PrismaClient } from '../packages/db/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://sots:password@127.0.0.1:5433/sots?schema=public" }
  }
});

async function main() {
  const applicationId = 'app-123';

  console.log("Cleaning database...");
  await prisma.coverageSnapshot.deleteMany();
  await prisma.missingFlow.deleteMany();
  await prisma.missingState.deleteMany();
  await prisma.candidateState.deleteMany();
  await prisma.transitionObservation.deleteMany();
  await prisma.stateObservation.deleteMany();
  await prisma.transition.deleteMany();
  await prisma.state.deleteMany();

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
    let state = await prisma.state.create({
      data: { applicationId, name: s.name, category: s.category, visitCount: 1 }
    });

    if (previousStateId) {
      const action = i === 1 ? 'ViewProducts' : i === 2 ? 'AddToCart' : 'Checkout';
      await prisma.transition.create({
        data: { applicationId, fromStateId: previousStateId, toStateId: state.id, action, frequency: 1 }
      });
    }
    previousStateId = state.id;
  }
  
  console.log("Graph Seeded!");

  console.log("Triggering Coverage Engine...");
  const response = await fetch('http://localhost:3003/coverage/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId })
  });

  const report = await response.json();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
