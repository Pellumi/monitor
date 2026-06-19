import { PrismaClient, PlanType } from '@prisma/client';
import { PLAN_DEFINITIONS, type PlanTypeKey } from '@sots/shared';

const prisma = new PrismaClient();

export async function seedPlans() {
  console.log('Starting SOTS Plans and Feature Flags seeding...');

  const planKeys = Object.keys(PLAN_DEFINITIONS) as PlanTypeKey[];

  for (const key of planKeys) {
    const planDef = PLAN_DEFINITIONS[key];
    console.log(`Seeding plan: ${planDef.name} (${key})...`);

    // Upsert Plan
    const dbPlan = await prisma.plan.upsert({
      where: { type: key as PlanType },
      update: {
        name: planDef.name,
        description: planDef.description,
        monthlyPriceUsd: planDef.pricing.monthlyUsd,
        monthlyPriceNgn: planDef.pricing.monthlyNgn,
        annualPriceUsd: planDef.pricing.annualUsd,
        annualPriceNgn: planDef.pricing.annualNgn,
        isPublic: planDef.isPublic,
        sortOrder: planDef.sortOrder,
        maxApplications: planDef.limits.applications,
        maxEnvironmentsPerApp: planDef.limits.maxEnvironmentsPerApp,
        maxApiKeys: planDef.limits.maxApiKeys,
        maxUsers: planDef.limits.users,
        maxStorageGb: planDef.limits.storageGb,
        retentionDays: planDef.limits.retentionDays,
        maxDemoSessions: planDef.limits.demoSessions,
      },
      create: {
        type: key as PlanType,
        name: planDef.name,
        description: planDef.description,
        monthlyPriceUsd: planDef.pricing.monthlyUsd,
        monthlyPriceNgn: planDef.pricing.monthlyNgn,
        annualPriceUsd: planDef.pricing.annualUsd,
        annualPriceNgn: planDef.pricing.annualNgn,
        isPublic: planDef.isPublic,
        sortOrder: planDef.sortOrder,
        maxApplications: planDef.limits.applications,
        maxEnvironmentsPerApp: planDef.limits.maxEnvironmentsPerApp,
        maxApiKeys: planDef.limits.maxApiKeys,
        maxUsers: planDef.limits.users,
        maxStorageGb: planDef.limits.storageGb,
        retentionDays: planDef.limits.retentionDays,
        maxDemoSessions: planDef.limits.demoSessions,
      },
    });

    // Upsert Feature Flags
    console.log(`Seeding feature flags for ${planDef.name}...`);
    for (const ff of planDef.features) {
      await prisma.featureFlag.upsert({
        where: {
          planId_feature: {
            planId: dbPlan.id,
            feature: ff.feature,
          },
        },
        update: {
          enabled: ff.enabled,
          tier: ff.tier ?? null,
        },
        create: {
          planId: dbPlan.id,
          feature: ff.feature,
          enabled: ff.enabled,
          tier: ff.tier ?? null,
        },
      });
    }
  }

  console.log('Seeding plans and feature flags completed successfully.');
}

async function main() {
  try {
    await seedPlans();
  } catch (err) {
    console.error('Error seeding plans:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
