import express, { Request, Response } from 'express';
import {
  BillingCurrency,
  BillingInterval,
  MemberRole,
  PaymentEvent,
  Plan,
  PlanType,
  PrismaClient,
  SubscriptionStatus,
} from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Services } from '@sots/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);

app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-sots-org-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

type Provider = 'STRIPE' | 'PAYSTACK' | 'MOCK';

function assertEnumValue<T extends Record<string, string>>(source: T, value: unknown): T[keyof T] | null {
  return typeof value === 'string' && Object.values(source).includes(value) ? value as T[keyof T] : null;
}

function periodEnd(interval: BillingInterval): Date {
  const end = new Date();
  if (interval === BillingInterval.ANNUAL) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

function priceFor(plan: Plan, interval: BillingInterval, currency: BillingCurrency): number {
  if (currency === BillingCurrency.NGN) {
    return interval === BillingInterval.ANNUAL
      ? plan.annualPriceNgn ?? plan.monthlyPriceNgn ?? 0
      : plan.monthlyPriceNgn ?? 0;
  }

  return interval === BillingInterval.ANNUAL
    ? plan.annualPriceUsd ?? plan.monthlyPriceUsd ?? 0
    : plan.monthlyPriceUsd ?? 0;
}

function invoiceNumber(): string {
  return `SOTS-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

async function recordPaymentEvent(
  organizationId: string,
  provider: Provider,
  eventType: string,
  payload: unknown
): Promise<PaymentEvent> {
  return prisma.paymentEvent.create({
    data: {
      organizationId,
      provider,
      eventType,
      payload: payload as any,
    },
  });
}

async function activateSubscription(params: {
  organizationId: string;
  plan: Plan;
  interval: BillingInterval;
  currency: BillingCurrency;
  provider: Provider;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
}) {
  const now = new Date();
  const end = periodEnd(params.interval);

  await prisma.subscription.upsert({
    where: { organizationId: params.organizationId },
    create: {
      organizationId: params.organizationId,
      planId: params.plan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: params.interval,
      billingCurrency: params.currency,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      stripeCustomerId: params.provider === 'STRIPE' ? params.providerCustomerId ?? null : null,
      stripeSubscriptionId: params.provider === 'STRIPE' ? params.providerSubscriptionId ?? null : null,
      paystackCustomerCode: params.provider === 'PAYSTACK' ? params.providerCustomerId ?? null : null,
      paystackSubscriptionCode: params.provider === 'PAYSTACK' ? params.providerSubscriptionId ?? null : null,
    },
    update: {
      planId: params.plan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: params.interval,
      billingCurrency: params.currency,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelledAt: null,
      suspendedAt: null,
      stripeCustomerId: params.provider === 'STRIPE' ? params.providerCustomerId ?? undefined : undefined,
      stripeSubscriptionId: params.provider === 'STRIPE' ? params.providerSubscriptionId ?? undefined : undefined,
      paystackCustomerCode: params.provider === 'PAYSTACK' ? params.providerCustomerId ?? undefined : undefined,
      paystackSubscriptionCode: params.provider === 'PAYSTACK' ? params.providerSubscriptionId ?? undefined : undefined,
    },
  });

  await entitlementChecker.resolveEntitlement(params.organizationId);
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'billing-api' });
});

app.get('/billing/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isPublic: true },
      include: { featureFlags: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(plans);
  } catch (err) {
    console.error('[BillingAPI] List plans failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/billing/organizations/:orgId/subscription', async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: { include: { featureFlags: true } } },
    });

    if (!subscription) {
      await entitlementChecker.resolveEntitlement(orgId);
      subscription = await prisma.subscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: { include: { featureFlags: true } } },
      });
    }

    res.json(subscription);
  } catch (err) {
    console.error('[BillingAPI] Get subscription failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/billing/organizations/:orgId/invoices', async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    console.error('[BillingAPI] List invoices failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/billing/checkout', async (req: Request, res: Response) => {
  const organizationId = req.body.organizationId || req.headers['x-sots-org-id'];
  const planType = assertEnumValue(PlanType, req.body.planType);
  const interval = assertEnumValue(BillingInterval, req.body.billingInterval) ?? BillingInterval.MONTHLY;
  const currency = assertEnumValue(BillingCurrency, req.body.currency) ?? BillingCurrency.USD;
  const provider = (req.body.provider || 'MOCK').toUpperCase() as Provider;

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'organizationId is required' });
  }
  if (!planType) {
    return res.status(400).json({ error: `planType must be one of ${Object.values(PlanType).join(', ')}` });
  }
  if (!['STRIPE', 'PAYSTACK', 'MOCK'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be STRIPE, PAYSTACK, or MOCK' });
  }

  try {
    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const total = priceFor(plan, interval, currency);
    const now = new Date();
    const end = periodEnd(interval);

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber: invoiceNumber(),
        planType,
        billingInterval: interval,
        currency,
        subtotal: total,
        tax: 0,
        total,
        status: total === 0 ? 'PAID' : 'PENDING',
        periodStart: now,
        periodEnd: end,
      },
    });

    await recordPaymentEvent(organizationId, provider, 'checkout.created', {
      ...req.body,
      invoiceId: invoice.id,
    });

    if (total === 0 || provider === 'MOCK') {
      await activateSubscription({ organizationId, plan, interval, currency, provider });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    res.status(201).json({
      checkoutId: invoice.id,
      provider,
      status: provider === 'MOCK' || total === 0 ? 'completed' : 'pending',
      checkoutUrl: provider === 'MOCK'
        ? `${req.protocol}://${req.get('host')}/billing/mock-checkout/${invoice.id}`
        : null,
      invoiceId: invoice.id,
    });
  } catch (err) {
    console.error('[BillingAPI] Create checkout failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/billing/webhooks/:provider', async (req: Request, res: Response) => {
  const provider = req.params.provider.toUpperCase() as Provider;
  const eventType = req.body.type || req.body.eventType;
  const data = req.body.data || req.body;
  const organizationId = data.organizationId || req.body.organizationId;

  if (!['STRIPE', 'PAYSTACK', 'MOCK'].includes(provider)) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId is required in webhook payload' });
  }
  if (!eventType) {
    return res.status(400).json({ error: 'event type is required' });
  }

  try {
    await recordPaymentEvent(organizationId, provider, eventType, req.body);

    if (eventType === 'checkout.completed' || eventType === 'invoice.paid' || eventType === 'subscription.active') {
      const planType = assertEnumValue(PlanType, data.planType);
      if (!planType) return res.status(400).json({ error: 'planType is required for activation events' });

      const plan = await prisma.plan.findUnique({ where: { type: planType } });
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      const interval = assertEnumValue(BillingInterval, data.billingInterval) ?? BillingInterval.MONTHLY;
      const currency = assertEnumValue(BillingCurrency, data.currency) ?? BillingCurrency.USD;

      await activateSubscription({
        organizationId,
        plan,
        interval,
        currency,
        provider,
        providerCustomerId: data.customerId || data.customer || null,
        providerSubscriptionId: data.subscriptionId || data.subscription || null,
      });

      if (data.invoiceId) {
        await prisma.invoice.update({
          where: { id: data.invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
    }

    if (eventType === 'invoice.payment_failed' || eventType === 'subscription.past_due') {
      await prisma.subscription.update({
        where: { organizationId },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      await entitlementChecker.resolveEntitlement(organizationId);
      if (data.invoiceId) {
        await prisma.invoice.update({
          where: { id: data.invoiceId },
          data: { status: 'FAILED' },
        });
      }

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (org) {
        void emailService.sendToOrganizationMembers({
          templateKey: 'billing-payment-failed',
          organizationId,
          eventType: 'BILLING_PAYMENT_FAILED',
          severity: 'HIGH',
          variables: {
            organizationName: org.name,
            provider,
            eventType,
            invoiceId: data.invoiceId || '',
            billingUrl: appUrl('/settings/profile'),
          },
          idempotencyKey: buildIdempotencyKey(['billing-payment-failed', organizationId, data.invoiceId || eventType]),
          roles: [MemberRole.OWNER, MemberRole.ADMIN],
        }).catch((err) => console.error('[Email] billing-payment-failed failed', err));
      }
    }

    if (eventType === 'customer.subscription.deleted' || eventType === 'subscription.cancelled') {
      await prisma.subscription.update({
        where: { organizationId },
        data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      });
      await entitlementChecker.resolveEntitlement(organizationId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[BillingAPI] Webhook handling failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/billing/organizations/:orgId/subscription/cancel', async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    const subscription = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });
    await recordPaymentEvent(orgId, 'MOCK', 'subscription.cancelled', { source: 'api' });
    await entitlementChecker.resolveEntitlement(orgId);
    res.json(subscription);
  } catch (err) {
    console.error('[BillingAPI] Cancel subscription failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.BILLING_API;
app.listen(PORT, () => {
  console.log(`[BillingAPI] Running on port ${PORT}`);
});
