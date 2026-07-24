import { PrismaClient, SubscriptionStatus } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';

export async function applyScheduledSubscriptionChanges(prisma: PrismaClient, now = new Date()): Promise<number> {
  const pending = await prisma.subscription.findMany({
    where: { pendingPlanId: { not: null }, pendingChangeAt: { lte: now } },
    select: { organizationId: true, pendingPlanId: true },
  });
  const checker = new EntitlementChecker(prisma);
  for (const subscription of pending) {
    if (!subscription.pendingPlanId) continue;
    await prisma.subscription.update({
      where: { organizationId: subscription.organizationId },
      data: {
        planId: subscription.pendingPlanId,
        pendingPlanId: null,
        pendingChangeAt: null,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    await checker.resolveEntitlement(subscription.organizationId);
  }
  if (pending.length) console.log(`[subscription-change-worker] Applied ${pending.length} scheduled plan changes`);
  return pending.length;
}
