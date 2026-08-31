import { PrismaClient } from '@tellann/db';

/**
 * Reconciles dunning attempt records.
 *
 * This worker used to charge cards directly. It no longer does: the billing
 * cycle in billing-api owns every charge, retrying daily for the whole grace
 * period against the stored payment method. Two independent retry loops sharing
 * one card is a double-charge waiting to happen, so this one was reduced to
 * bookkeeping.
 *
 * What it still does is close out attempts that the billing cycle has already
 * settled, so the dunning history stays an accurate record of what happened
 * rather than a queue of stale work.
 */
export async function processBillingDunning(prisma: PrismaClient): Promise<number> {
  const now = new Date();

  // An attempt whose subscription is no longer in trouble has been overtaken by
  // a successful charge — close it rather than leaving it scheduled forever.
  const open = await prisma.billingDunningAttempt.findMany({
    where: { status: { in: ['SCHEDULED', 'PROCESSING'] } },
    take: 100,
  });
  if (!open.length) return 0;

  const organizationIds = [...new Set(open.map((attempt) => attempt.organizationId))];
  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { organizationId: true, status: true, graceEndsAt: true },
  });
  const byOrganization = new Map(subscriptions.map((s) => [s.organizationId, s]));

  let closed = 0;
  for (const attempt of open) {
    const subscription = byOrganization.get(attempt.organizationId);
    const recovered = !subscription || subscription.status === 'ACTIVE';
    const lapsed = subscription?.status !== 'GRACE_PERIOD'
      && subscription?.graceEndsAt != null
      && subscription.graceEndsAt <= now;

    if (recovered || lapsed) {
      await prisma.billingDunningAttempt.update({
        where: { id: attempt.id },
        data: {
          status: recovered ? 'CANCELLED' : 'FAILED',
          completedAt: now,
          processingError: recovered ? null : 'Grace period elapsed without payment',
        },
      });
      closed += 1;
    }
  }

  if (closed) console.log(`[billing-dunning] Closed ${closed} superseded dunning attempts`);
  return closed;
}
