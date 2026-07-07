import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  console.log(`Seeding system admin for email: ${email}`);

  const cleanEmail = email.toLowerCase().trim();

  let user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        displayName: 'System Admin',
      },
    });
    console.log(`Created user with ID: ${user.id}`);
  } else {
    console.log(`Found existing user with ID: ${user.id}`);
  }

  const systemAdmin = await prisma.systemAdmin.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      scope: 'FULL',
    },
    update: {
      revokedAt: null,
    },
  });

  console.log(`Successfully granted System Admin to user ${email} (SystemAdmin ID: ${systemAdmin.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[SystemAdminSeed] Failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });
