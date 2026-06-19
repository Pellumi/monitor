import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectPlans() {
  console.log('Fetching SOTS plans from database...\n');

  const plans = await prisma.plan.findMany({
    include: {
      _count: {
        select: { featureFlags: true }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log('| Plan       | Code       | Price (USD) | Price (NGN) | Max Apps | Max Users | Storage | Retention | Feature Flags |');
  console.log('------------------------------------------------------------------------------------------------------------------------');

  for (const plan of plans) {
    const usdPrice = plan.monthlyPriceUsd !== null ? `$${(plan.monthlyPriceUsd / 100).toFixed(2)}` : 'Custom/Sales';
    const ngnPrice = plan.monthlyPriceNgn !== null ? `₦${(plan.monthlyPriceNgn / 100).toLocaleString()}` : 'N/A';
    const maxApps = plan.maxApplications >= 9999 ? 'Unlimited' : plan.maxApplications;
    const maxUsers = plan.maxUsers >= 9999 ? 'Unlimited' : plan.maxUsers;
    const storage = plan.maxStorageGb >= 9999 ? 'Unlimited' : `${plan.maxStorageGb} GB`;
    const retention = plan.retentionDays >= 9999 ? 'Custom' : `${plan.retentionDays} days`;
    const flagsCount = plan._count.featureFlags;

    console.log(
      `| ${plan.name.padEnd(10)} | ${plan.type.padEnd(10)} | ${usdPrice.padEnd(11)} | ${ngnPrice.padEnd(11)} | ${String(maxApps).padEnd(8)} | ${String(maxUsers).padEnd(9)} | ${storage.padEnd(7)} | ${retention.padEnd(9)} | ${String(flagsCount).padEnd(13)} |`
    );
  }
  console.log('------------------------------------------------------------------------------------------------------------------------\n');
}

inspectPlans().catch(console.error).finally(() => prisma.$disconnect());
