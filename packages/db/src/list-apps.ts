import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.application.findMany().then(console.log).finally(() => prisma.$disconnect());
