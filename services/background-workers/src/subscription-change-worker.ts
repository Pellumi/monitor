import { PrismaClient, SubscriptionStatus } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';

export async function applyScheduledSubscriptionChanges(prisma: PrismaClient, now = new Date()): Promise<number> {
  const pending = await prisma.subscription.findMany({
    where: { pendingPlanId: { not: null }, pendingChangeAt: { lte: now } },
    select: { organizationId: true, pendingPlanId: true, pendingChangeAt: true, pendingPlan: { select: { type: true } } },
  });
  const checker = new EntitlementChecker(prisma);
  for (const subscription of pending) {
    if (!subscription.pendingPlanId) continue;
    const providerChange = await prisma.subscriptionChange.findFirst({
      where: {
        organizationId: subscription.organizationId,
        targetPlanId: subscription.pendingPlanId,
        status: 'PROVIDER_CONFIRMED',
        providerOperationId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!providerChange) {
      console.error(`[subscription-change-worker] Awaiting provider confirmation for ${subscription.organizationId}`);
      continue;
    }
    await prisma.subscription.update({
      where: { organizationId: subscription.organizationId },
      data: {
        planId: subscription.pendingPlanId,
        billingInterval: providerChange.targetInterval,
        billingCurrency: providerChange.currency,
        providerSubscriptionId: providerChange.providerOperationId,
        paystackSubscriptionCode: providerChange.providerOperationId,
        providerManagementToken: providerChange.providerReference,
        providerPeriodStart: now,
        pendingPlanId: null,
        pendingChangeAt: null,
        status: SubscriptionStatus.ACTIVE,
        nonRenewing: subscription.pendingPlan?.type === 'FREE',
      },
    });
    await prisma.subscriptionChange.update({
      where: { id: providerChange.id },
      data: { status: 'APPLIED', effectiveAt: now },
    });
    await checker.resolveEntitlement(subscription.organizationId);
  }
  if (pending.length) console.log(`[subscription-change-worker] Applied ${pending.length} scheduled plan changes`);
  return pending.length;
}
