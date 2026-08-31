import { PrismaClient, SubscriptionStatus } from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';

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
        // The legacy Paystack-specific mirror must only be written for Paystack
        // changes; stamping a Flutterwave subscription id here would make later
        // Paystack reconciliation chase a code that does not exist there.
        paystackSubscriptionCode: providerChange.provider === 'PAYSTACK' ? providerChange.providerOperationId : undefined,
        providerManagementToken: providerChange.provider === 'PAYSTACK' ? providerChange.providerReference : undefined,
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
