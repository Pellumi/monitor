import crypto from 'crypto';
import { PrismaClient, SubscriptionStatus } from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';

function openPaymentReference(value: string): string {
  const keyMaterial = process.env.BILLING_ENCRYPTION_KEY;
  if (!keyMaterial) throw new Error('BILLING_ENCRYPTION_KEY is required for billing retries');
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid payment authorization envelope');
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export async function processBillingDunning(prisma: PrismaClient, now = new Date()): Promise<number> {
  const due = await prisma.billingDunningAttempt.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 25,
  });
  const checker = new EntitlementChecker(prisma);
  let processed = 0;
  for (const attempt of due) {
    const claimed = await prisma.billingDunningAttempt.updateMany({
      where: { id: attempt.id, status: 'SCHEDULED' },
      data: { status: 'PROCESSING', startedAt: now },
    });
    if (!claimed.count) continue;
    try {
      const [subscription, profile] = await Promise.all([
        prisma.subscription.findUnique({ where: { organizationId: attempt.organizationId } }),
        prisma.organizationBillingProfile.findUnique({ where: { organizationId: attempt.organizationId } }),
      ]);
      if (!subscription?.paymentMethodReference || !profile?.billingEmail) {
        throw new Error('Recurring authorization or billing email is missing');
      }
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured');
      const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization_code: openPaymentReference(subscription.paymentMethodReference),
          email: profile.billingEmail,
          amount: attempt.amount,
          currency: attempt.currency,
          reference: attempt.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '-'),
          metadata: { organizationId: attempt.organizationId, dunningAttemptId: attempt.id },
        }),
      });
      const body = await response.json() as any;
      const succeeded = response.ok && body?.status && body?.data?.status === 'success';
      await prisma.billingDunningAttempt.update({
        where: { id: attempt.id },
        data: {
          status: succeeded ? 'SUCCEEDED' : 'FAILED',
          completedAt: new Date(),
          providerReference: body?.data?.reference ?? attempt.providerReference,
          processingError: succeeded ? null : String(body?.message || body?.data?.gateway_response || 'Charge failed').slice(0, 1000),
        },
      });
      if (succeeded) {
        await prisma.subscription.update({
          where: { organizationId: attempt.organizationId },
          data: { status: SubscriptionStatus.ACTIVE },
        });
        await prisma.billingDunningAttempt.updateMany({
          where: { organizationId: attempt.organizationId, status: 'SCHEDULED' },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
      } else if (attempt.attemptNumber >= 3) {
        await prisma.subscription.update({
          where: { organizationId: attempt.organizationId },
          data: { status: SubscriptionStatus.SUSPENDED },
        });
      }
      await checker.resolveEntitlement(attempt.organizationId);
      processed += 1;
    } catch (error) {
      await prisma.billingDunningAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attempt.attemptNumber >= 3 ? 'FAILED' : 'SCHEDULED',
          completedAt: new Date(),
          scheduledAt: attempt.attemptNumber >= 3 ? attempt.scheduledAt : new Date(Date.now() + 60 * 60_000),
          processingError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown retry failure',
        },
      });
      if (attempt.attemptNumber >= 3) {
        await prisma.subscription.updateMany({
          where: { organizationId: attempt.organizationId },
          data: { status: SubscriptionStatus.SUSPENDED },
        });
        await checker.resolveEntitlement(attempt.organizationId);
      }
    }
  }
  return processed;
}
