import { PrismaClient, PlanType, SubscriptionStatus } from '@sots/db';
import { EntitlementChecker } from './index';

const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);

export async function migrateExistingOrgs() {
  console.log('Starting migration of existing organizations to the Free plan...');

  // Find the FREE plan
  const freePlan = await prisma.plan.findUnique({
    where: { type: PlanType.FREE }
  });

  if (!freePlan) {
    throw new Error('FREE plan not found in database. Please run plan seeding first.');
  }

  // Get all organizations
  const orgs = await prisma.organization.findMany({
    include: {
      subscription: true,
    }
  });

  console.log(`Found ${orgs.length} organizations to check.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const org of orgs) {
    if (org.subscription) {
      console.log(`Organization ${org.name} (${org.id}) already has a subscription. Skipping.`);
      skippedCount++;
      continue;
    }

    console.log(`Migrating organization ${org.name} (${org.id}) to Free plan...`);

    // Create Subscription
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
      }
    });

    // Resolve Entitlement
    await entitlementChecker.resolveEntitlement(org.id);

    migratedCount++;
  }

  console.log(`Migration completed: ${migratedCount} organizations migrated, ${skippedCount} skipped.`);
}

async function main() {
  try {
    await migrateExistingOrgs();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
