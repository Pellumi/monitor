const { PrismaClient } = require('@prisma/client');
require('ts-node/register');
const { seedFDRS } = require('../derivation-engine/src/seed');

const prisma = new PrismaClient();

async function main() {
  await prisma.application.upsert({
    where: { id: 'acadai-local' },
    update: {},
    create: {
      id: 'acadai-local',
      name: 'AcadAI Local'
    }
  });

  const existingProfile = await prisma.applicationProfile.findFirst({
    where: { applicationId: 'acadai-local' }
  });

  if (!existingProfile) {
    await prisma.applicationProfile.create({
      data: {
        applicationId: 'acadai-local',
        profileType: 'LMS'
      }
    });
  }

  console.log('Successfully registered AcadAI in SOTS database!');

  // Seed FDRS tables
  await seedFDRS();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
