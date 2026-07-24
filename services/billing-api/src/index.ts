import { initTracing } from '@sots/telemetry';
initTracing('billing-api');

import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  AuditAction,
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
import { PLAN_DEFINITIONS, Services, type PlanTypeKey } from '@sots/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';
import { writeAuditLog, extractAuditContext } from '@sots/authz';
import { createCheckoutSession, verifyStripeWebhook, ensureStripeCustomer } from './providers/stripe';
import { initializeTransaction, verifyPaystackWebhook } from './providers/paystack';
import { generateReceiptPdf } from './receipt';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);
const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

// Capture raw body for webhook signature verification BEFORE json parsing
// The rawBody buffer is attached to req so the webhook handler can verify HMAC
app.use((req: any, res, next) => {
  if (req.path.startsWith('/billing/webhooks/')) {
    let data = Buffer.alloc(0);
    req.on('data', (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
    req.on('end', () => { req.rawBody = data; next(); });
  } else {
    express.json({ limit: '2mb' })(req, res, next);
  }
});

// Parse JSON for webhook routes after raw body capture
app.use((req: any, res, next) => {
  if (req.path.startsWith('/billing/webhooks/') && req.rawBody) {
    try {
      req.body = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      req.body = {};
    }
  }
  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-sots-org-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

type Provider = 'STRIPE' | 'PAYSTACK' | 'MOCK';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const parts = cookie.trim().split('=');
      return [parts[0], decodeURIComponent(parts.slice(1).join('='))];
    }),
  );
  return cookies.access_token ?? null;
}

async function verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No access token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'TOKEN_EXPIRED_OR_INVALID', message: 'Invalid or expired access token' });
  }
}

function requestOrganizationId(req: Request): string | null {
  const headerOrgId = req.headers['x-sots-org-id'];
  const orgId = req.params.orgId
    ?? req.body?.organizationId
    ?? (Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId);
  return typeof orgId === 'string' && orgId.trim() ? orgId : null;
}

function requireBillingRole(allowedRoles: MemberRole[]) {
  return async function requireBillingRoleMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const orgId = requestOrganizationId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }
    if (!req.user?.id) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
      });
      if (!membership) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of this organization' });
      }
      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: `Billing management requires one of: ${allowedRoles.join(', ')}`,
        });
      }
      next();
    } catch (err) {
      console.error('[BillingAPI] Billing authorization failed', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

const requireBillingViewer = requireBillingRole([MemberRole.OWNER, MemberRole.ADMIN]);
const requireBillingManager = requireBillingRole([MemberRole.OWNER, MemberRole.ADMIN]);

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

function envKey(...parts: string[]): string {
  return parts.map((part) => part.replace(/[^a-z0-9]/gi, '_').toUpperCase()).join('_');
}

function configuredProviderCode(provider: 'STRIPE' | 'PAYSTACK', planType: PlanType, interval: BillingInterval, currency: BillingCurrency): string | null {
  const candidates = provider === 'STRIPE'
    ? [
        envKey('STRIPE_PRICE_ID', planType, interval, currency),
        envKey('STRIPE_PRICE_ID', planType, interval),
        envKey('STRIPE_PRICE_ID', planType),
      ]
    : [
        envKey('PAYSTACK_PLAN_CODE', planType, interval, currency),
        envKey('PAYSTACK_PLAN_CODE', planType, interval),
        envKey('PAYSTACK_PLAN_CODE', planType),
      ];

  for (const key of candidates) {
    const value = process.env[key];
    if (value?.trim()) return value.trim();
  }
  return null;
}

function checkoutProviderCode(req: Request, provider: 'STRIPE' | 'PAYSTACK', planType: PlanType, interval: BillingInterval, currency: BillingCurrency): string | null {
  const bodyCode = provider === 'STRIPE' ? req.body.priceId : req.body.planCode;
  return typeof bodyCode === 'string' && bodyCode.trim()
    ? bodyCode.trim()
    : configuredProviderCode(provider, planType, interval, currency);
}
function invoiceNumber(): string {
  return `TELLANN-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

type PaymentEventProcessingStatus = 'PROCESSING' | 'PROCESSED' | 'FAILED';

interface NormalizedBillingEvent {
  provider: Provider;
  eventType: string;
  providerEventId: string;
  providerReference: string | null;
  organizationId: string;
  invoiceId: string | null;
  planType: PlanType | null;
  billingInterval: BillingInterval | null;
  currency: BillingCurrency | null;
  customerId: string | null;
  subscriptionId: string | null;
  stripeInvoiceId: string | null;
  paystackRef: string | null;
  paidAt: Date | null;
  payloadData: Record<string, any>;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function epochSecondsToDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function normalizeBillingWebhook(provider: Provider, body: any): NormalizedBillingEvent | null {
  const root = asRecord(body);
  const eventType = firstString(root.type, root.event, root.eventType);
  if (!eventType) return null;

  if (provider === 'STRIPE') {
    const stripeObject = asRecord(asRecord(root.data).object);
    const subscriptionDetails = asRecord(stripeObject.subscription_details ?? asRecord(stripeObject.parent).subscription_details);
    const metadata = {
      ...asRecord(subscriptionDetails.metadata),
      ...asRecord(stripeObject.metadata),
      ...asRecord(root.metadata),
    };
    const providerReference = firstString(stripeObject.id, root.id);
    const providerEventId = firstString(root.id) ?? `${eventType}:${providerReference ?? cryptoRandomFallback()}`;
    const subscriptionId = firstString(
      stripeObject.subscription,
      subscriptionDetails.subscription,
      typeof stripeObject.id === 'string' && stripeObject.id.startsWith('sub_') ? stripeObject.id : null,
    );
    const stripeInvoiceId = eventType.startsWith('invoice.')
      ? firstString(stripeObject.id)
      : firstString(stripeObject.invoice);

    return {
      provider,
      eventType,
      providerEventId,
      providerReference,
      organizationId: firstString(metadata.organizationId, stripeObject.organizationId, root.organizationId) ?? '',
      invoiceId: firstString(metadata.invoiceId, stripeObject.client_reference_id),
      planType: assertEnumValue(PlanType, metadata.planType ?? stripeObject.planType),
      billingInterval: assertEnumValue(BillingInterval, metadata.billingInterval ?? metadata.interval ?? stripeObject.billingInterval),
      currency: assertEnumValue(BillingCurrency, metadata.currency ?? String(stripeObject.currency ?? '').toUpperCase()),
      customerId: firstString(stripeObject.customer, metadata.customerId),
      subscriptionId,
      stripeInvoiceId,
      paystackRef: null,
      paidAt: epochSecondsToDate(asRecord(stripeObject.status_transitions).paid_at) ?? epochSecondsToDate(stripeObject.created),
      payloadData: stripeObject,
    };
  }

  if (provider === 'PAYSTACK') {
    const data = asRecord(root.data ?? root);
    const metadata = asRecord(data.metadata ?? root.metadata);
    const reference = firstString(data.reference, root.reference);
    const providerReference = reference ?? firstString(data.id);
    const providerEventId = firstString(root.id, data.event_id) ?? `${eventType}:${providerReference ?? cryptoRandomFallback()}`;
    const customer = asRecord(data.customer);
    const subscription = asRecord(data.subscription);

    return {
      provider,
      eventType,
      providerEventId,
      providerReference,
      organizationId: firstString(metadata.organizationId, data.organizationId, root.organizationId) ?? '',
      invoiceId: firstString(metadata.invoiceId, data.invoiceId),
      planType: assertEnumValue(PlanType, metadata.planType ?? data.planType),
      billingInterval: assertEnumValue(BillingInterval, metadata.billingInterval ?? metadata.interval ?? data.billingInterval),
      currency: assertEnumValue(BillingCurrency, String(data.currency ?? metadata.currency ?? '').toUpperCase()),
      customerId: firstString(customer.customer_code, data.customerId, data.customer),
      subscriptionId: firstString(subscription.subscription_code, data.subscription_code, data.subscriptionId),
      stripeInvoiceId: null,
      paystackRef: reference,
      paidAt: typeof data.paid_at === 'string' ? new Date(data.paid_at) : null,
      payloadData: data,
    };
  }

  const data = asRecord(root.data ?? root);
  const providerReference = firstString(data.id, data.reference, root.id);
  return {
    provider,
    eventType,
    providerEventId: firstString(root.id, data.id, data.reference) ?? `${eventType}:${cryptoRandomFallback()}`,
    providerReference,
    organizationId: firstString(data.organizationId, root.organizationId) ?? '',
    invoiceId: firstString(data.invoiceId),
    planType: assertEnumValue(PlanType, data.planType),
    billingInterval: assertEnumValue(BillingInterval, data.billingInterval),
    currency: assertEnumValue(BillingCurrency, data.currency),
    customerId: firstString(data.customerId, data.customer),
    subscriptionId: firstString(data.subscriptionId, data.subscription),
    stripeInvoiceId: null,
    paystackRef: firstString(data.reference),
    paidAt: null,
    payloadData: data,
  };
}

function cryptoRandomFallback(): string {
  return Math.random().toString(16).slice(2);
}

async function recordPaymentEvent(
  organizationId: string,
  provider: Provider,
  eventType: string,
  payload: unknown,
  options: {
    providerEventId?: string | null;
    providerReference?: string | null;
    invoiceId?: string | null;
    processingStatus?: PaymentEventProcessingStatus;
    processingError?: string | null;
  } = {},
): Promise<PaymentEvent> {
  const processingStatus = options.processingStatus ?? 'PROCESSED';
  return prisma.paymentEvent.create({
    data: {
      organizationId,
      provider,
      eventType,
      providerEventId: options.providerEventId ?? null,
      providerReference: options.providerReference ?? null,
      invoiceId: options.invoiceId ?? null,
      payload: payload as any,
      processingStatus,
      processingError: options.processingError ?? null,
      processedAt: processingStatus === 'PROCESSED' ? new Date() : null,
    },
  });
}

async function claimWebhookEvent(event: NormalizedBillingEvent, payload: unknown): Promise<{ paymentEvent: PaymentEvent | null; skipped: boolean; reason?: string }> {
  try {
    const paymentEvent = await recordPaymentEvent(event.organizationId, providerFromEvent(event), event.eventType, payload, {
      providerEventId: event.providerEventId,
      providerReference: event.providerReference,
      invoiceId: event.invoiceId,
      processingStatus: 'PROCESSING',
    });
    return { paymentEvent, skipped: false };
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;

    const existing = await prisma.paymentEvent.findFirst({
      where: { provider: providerFromEvent(event), providerEventId: event.providerEventId },
      orderBy: { receivedAt: 'desc' },
    });
    if (!existing) throw err;
    if (existing.processingStatus === 'PROCESSED') {
      return { paymentEvent: existing, skipped: true, reason: 'already_processed' };
    }
    if (existing.processingStatus === 'PROCESSING') {
      return { paymentEvent: existing, skipped: true, reason: 'already_processing' };
    }

    const paymentEvent = await prisma.paymentEvent.update({
      where: { id: existing.id },
      data: {
        organizationId: event.organizationId,
        eventType: event.eventType,
        providerReference: event.providerReference,
        invoiceId: event.invoiceId,
        payload: payload as any,
        processingStatus: 'PROCESSING',
        processingError: null,
        processedAt: null,
      },
    });
    return { paymentEvent, skipped: false };
  }
}

function providerFromEvent(event: NormalizedBillingEvent): Provider {
  return event.provider;
}

async function markPaymentEventProcessed(paymentEvent: PaymentEvent, invoiceId?: string | null) {
  await prisma.paymentEvent.update({
    where: { id: paymentEvent.id },
    data: {
      invoiceId: invoiceId ?? paymentEvent.invoiceId,
      processingStatus: 'PROCESSED',
      processingError: null,
      processedAt: new Date(),
    },
  });
}

async function markPaymentEventFailed(paymentEvent: PaymentEvent | null, err: unknown) {
  if (!paymentEvent) return;
  const message = err instanceof Error ? err.message : String(err);
  await prisma.paymentEvent.update({
    where: { id: paymentEvent.id },
    data: {
      processingStatus: 'FAILED',
      processingError: message.slice(0, 1000),
      processedAt: null,
    },
  }).catch((updateErr) => console.error('[BillingAPI] Failed to mark payment event failed', updateErr));
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

  // Audit: subscription activated
  await writeAuditLog(prisma, {
    action: AuditAction.SUBSCRIPTION_ACTIVATED,
    organizationId: params.organizationId,
    metadata: {
      planType: params.plan.type,
      planId: params.plan.id,
      interval: params.interval,
      currency: params.currency,
      provider: params.provider,
    },
  });
}

async function findInvoiceForEvent(event: NormalizedBillingEvent) {
  if (event.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: event.invoiceId } });
    if (invoice) return invoice;
  }

  if (event.providerReference) {
    const invoice = await prisma.invoice.findFirst({
      where: { provider: providerFromEvent(event), providerReference: event.providerReference },
    });
    if (invoice) return invoice;
  }

  if (event.stripeInvoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { stripeInvoiceId: event.stripeInvoiceId } });
    if (invoice) return invoice;
  }

  if (event.paystackRef) {
    const invoice = await prisma.invoice.findFirst({ where: { paystackRef: event.paystackRef } });
    if (invoice) return invoice;
  }

  if (event.subscriptionId) {
    return prisma.invoice.findFirst({
      where: {
        organizationId: event.organizationId,
        provider: providerFromEvent(event),
        providerSubscriptionId: event.subscriptionId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return null;
}

function invoiceProviderReference(event: NormalizedBillingEvent): string | null | undefined {
  if (!event.providerReference) return undefined;
  if (providerFromEvent(event) === 'PAYSTACK') return event.providerReference;
  if (event.eventType === 'checkout.session.completed' || event.eventType === 'checkout.completed') {
    return event.providerReference;
  }
  return undefined;
}

async function reconcileInvoiceForEvent(
  event: NormalizedBillingEvent,
  status?: 'PAID' | 'FAILED',
) {
  const invoice = await findInvoiceForEvent(event);
  if (!invoice) return null;

  const providerReference = invoice.providerReference ?? invoiceProviderReference(event) ?? null;
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      provider: providerFromEvent(event),
      providerReference,
      providerCustomerId: event.customerId ?? invoice.providerCustomerId,
      providerSubscriptionId: event.subscriptionId ?? invoice.providerSubscriptionId,
      stripeInvoiceId: event.stripeInvoiceId ?? invoice.stripeInvoiceId,
      paystackRef: event.paystackRef ?? invoice.paystackRef,
      status: status ?? invoice.status,
      paidAt: status === 'PAID' ? event.paidAt ?? new Date() : invoice.paidAt,
    },
  });
}

function isActivationEvent(event: NormalizedBillingEvent): boolean {
  return [
    'checkout.completed',
    'checkout.session.completed',
    'invoice.paid',
    'invoice.payment_succeeded',
    'subscription.active',
    'charge.success',
  ].includes(event.eventType)
    || (event.eventType === 'customer.subscription.updated' && event.payloadData.status === 'active');
}

function isPaymentFailureEvent(event: NormalizedBillingEvent): boolean {
  return [
    'invoice.payment_failed',
    'subscription.past_due',
    'charge.failed',
  ].includes(event.eventType);
}

function isCancellationEvent(event: NormalizedBillingEvent): boolean {
  return [
    'customer.subscription.deleted',
    'subscription.cancelled',
  ].includes(event.eventType);
}
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'billing-api' });
});

function publicPlan(plan: Plan & { featureFlags?: Array<{ feature: string; enabled: boolean; tier: string | null }> }, countryCode?: string) {
  const definition = PLAN_DEFINITIONS[plan.type as PlanTypeKey];
  const isCustom = plan.type === PlanType.ENTERPRISE;
  const eligible = !definition?.eligibleCountries || !!countryCode && definition.eligibleCountries.includes(countryCode.toUpperCase());
  return {
    id: plan.id,
    type: plan.type,
    name: plan.name,
    description: plan.description,
    rank: definition?.rank ?? plan.sortOrder,
    audience: definition?.audience ?? [],
    highlights: definition?.highlights ?? [],
    exportFormats: definition?.exportFormats ?? [],
    eligible,
    eligibilityReason: eligible ? null : 'This plan is available only to organizations billed in Nigeria.',
    eligibleCountries: definition?.eligibleCountries ?? null,
    supportedCurrencies: definition?.supportedCurrencies ?? [],
    supportedProviders: definition?.supportedProviders ?? [],
    contactSales: definition?.contactSales ?? false,
    hasTrial: definition?.hasTrial ?? false,
    trialDays: definition?.trialDays ?? 0,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    monthlyPriceNgn: plan.monthlyPriceNgn,
    annualPriceUsd: plan.annualPriceUsd,
    annualPriceNgn: plan.annualPriceNgn,
    maxApplications: isCustom ? null : plan.maxApplications,
    maxEnvironmentsPerApp: isCustom ? null : plan.maxEnvironmentsPerApp,
    maxApiKeys: isCustom ? null : plan.maxApiKeys,
    maxUsers: isCustom ? null : plan.maxUsers,
    maxStorageGb: isCustom ? null : plan.maxStorageGb,
    retentionDays: isCustom ? null : plan.retentionDays,
    maxDemoSessions: plan.maxDemoSessions,
    featureFlags: plan.featureFlags ?? [],
  };
}

app.get('/billing/plans', async (req: Request, res: Response) => {
  try {
    const orgId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const profile = orgId
      ? await prisma.organizationBillingProfile.findUnique({ where: { organizationId: orgId } })
      : null;
    const plans = await prisma.plan.findMany({
      where: { isPublic: true },
      include: { featureFlags: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(plans.map((plan) => publicPlan(plan, profile?.countryCode)));
  } catch (err) {
    console.error('[BillingAPI] List plans failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/billing/organizations/:orgId/profile', verifyJwt, requireBillingViewer, async (req: Request, res: Response) => {
  const profile = await prisma.organizationBillingProfile.findUnique({ where: { organizationId: req.params.orgId } });
  res.json(profile);
});

app.put('/billing/organizations/:orgId/profile', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const countryCode = String(req.body.countryCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return res.status(400).json({ error: 'INVALID_COUNTRY', message: 'countryCode must be an ISO 3166-1 alpha-2 code.' });
  }
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: req.params.orgId },
    include: { plan: true },
  });
  if (subscription?.plan.type === PlanType.LOCAL && countryCode !== 'NG') {
    return res.status(409).json({
      error: 'LOCAL_COUNTRY_LOCKED',
      message: 'Move off the Local plan before changing the billing country from Nigeria.',
    });
  }
  const data = {
    countryCode,
    legalName: req.body.legalName || null,
    billingEmail: req.body.billingEmail || null,
    addressLine1: req.body.addressLine1 || null,
    addressLine2: req.body.addressLine2 || null,
    city: req.body.city || null,
    region: req.body.region || null,
    postalCode: req.body.postalCode || null,
    taxId: req.body.taxId || null,
  };
  const profile = await prisma.organizationBillingProfile.upsert({
    where: { organizationId: req.params.orgId },
    create: { organizationId: req.params.orgId, ...data },
    update: data,
  });
  await writeAuditLog(prisma, {
    action: AuditAction.BILLING_PROFILE_UPDATED,
    userId: req.user!.id,
    organizationId: req.params.orgId,
    metadata: { countryCode },
  });
  res.json(profile);
});

app.post('/billing/organizations/:orgId/enterprise-sales-requests', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: req.params.orgId },
    include: { plan: true },
  });
  const request = await prisma.enterpriseSalesRequest.create({
    data: {
      organizationId: req.params.orgId,
      requesterUserId: req.user!.id,
      currentPlan: subscription?.plan.type ?? PlanType.FREE,
      requestedCapabilities: Array.isArray(req.body.requestedCapabilities) ? req.body.requestedCapabilities.map(String) : [],
      deploymentPreference: req.body.deploymentPreference || null,
      notes: req.body.notes || null,
    },
  });
  await writeAuditLog(prisma, {
    action: AuditAction.ENTERPRISE_SALES_REQUESTED,
    userId: req.user!.id,
    organizationId: req.params.orgId,
    metadata: { requestId: request.id },
  });
  res.status(201).json(request);
});

app.get('/billing/organizations/:orgId/subscription', verifyJwt, requireBillingViewer, async (req: Request, res: Response) => {
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

app.get('/billing/organizations/:orgId/invoices', verifyJwt, requireBillingViewer, async (req: Request, res: Response) => {
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

app.post('/billing/checkout', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = req.body.organizationId || req.headers['x-sots-org-id'];
  const planType = assertEnumValue(PlanType, req.body.planType);
  const interval = assertEnumValue(BillingInterval, req.body.billingInterval) ?? BillingInterval.MONTHLY;
  const currency = assertEnumValue(BillingCurrency, req.body.currency ?? req.body.billingCurrency) ?? BillingCurrency.USD;
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
  if (provider === 'MOCK' && process.env.NODE_ENV === 'production') {
    return res.status(400).json({ error: 'MOCK provider is disabled in production' });
  }

  try {
    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!plan.isPublic) return res.status(400).json({ error: 'PLAN_NOT_PUBLIC' });
    if (planType === PlanType.FREE) {
      return res.status(400).json({ error: 'FREE_CHECKOUT_UNSUPPORTED', message: 'The Free plan does not require checkout.' });
    }
    if (planType === PlanType.ENTERPRISE) {
      return res.status(400).json({ error: 'CONTACT_SALES_REQUIRED', message: 'Enterprise subscriptions start through the sales workflow.' });
    }
    const profile = await prisma.organizationBillingProfile.findUnique({ where: { organizationId } });
    if (!profile) {
      return res.status(400).json({ error: 'BILLING_PROFILE_REQUIRED', message: 'Add a billing country before checkout.' });
    }
    if (planType === PlanType.LOCAL) {
      if (profile.countryCode !== 'NG' || currency !== BillingCurrency.NGN || (provider !== 'PAYSTACK' && provider !== 'MOCK')) {
        return res.status(400).json({
          error: 'LOCAL_PLAN_INELIGIBLE',
          message: 'Local is available only to Nigerian organizations, billed in NGN through Paystack.',
        });
      }
    }
    if (currency === BillingCurrency.USD && provider !== 'STRIPE' && provider !== 'MOCK') {
      return res.status(400).json({ error: 'PROVIDER_CURRENCY_MISMATCH', message: 'USD checkout requires Stripe.' });
    }
    if (currency === BillingCurrency.NGN && provider !== 'PAYSTACK' && provider !== 'MOCK') {
      return res.status(400).json({ error: 'PROVIDER_CURRENCY_MISMATCH', message: 'NGN checkout requires Paystack.' });
    }
    const currentSubscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    const currentDefinition = currentSubscription ? PLAN_DEFINITIONS[currentSubscription.plan.type as PlanTypeKey] : null;
    const targetDefinition = PLAN_DEFINITIONS[planType as PlanTypeKey];
    if (currentSubscription && currentDefinition && targetDefinition.rank < currentDefinition.rank) {
      const scheduled = await prisma.subscription.update({
        where: { organizationId },
        data: { pendingPlanId: plan.id, pendingChangeAt: currentSubscription.currentPeriodEnd },
        include: { pendingPlan: true },
      });
      return res.status(202).json({
        status: 'scheduled',
        pendingPlan: scheduled.pendingPlan?.type,
        effectiveAt: scheduled.pendingChangeAt,
        message: 'Downgrade scheduled for the end of the current billing period. Existing data will not be deleted.',
      });
    }

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
        provider,
        periodStart: now,
        periodEnd: end,
      },
    });

    await recordPaymentEvent(organizationId, provider, 'checkout.created', {
      ...req.body,
      invoiceId: invoice.id,
    }, { invoiceId: invoice.id });

    // ── Free plan / MOCK: activate immediately ──────────────────────────────
    if (total === 0 || provider === 'MOCK') {
      await activateSubscription({ organizationId, plan, interval, currency, provider });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      const mockCheckoutUrl = `${req.protocol}://${req.get('host')}/billing/mock-checkout/${invoice.id}`;
      return res.status(201).json({
        checkoutId: invoice.id,
        provider,
        status: 'completed',
        checkoutUrl: mockCheckoutUrl,
        url: mockCheckoutUrl,
        invoiceId: invoice.id,
      });
    }

    // ── STRIPE: real hosted checkout ────────────────────────────────────────
    if (provider === 'STRIPE') {
      if (currency !== BillingCurrency.USD) {
        return res.status(400).json({ error: 'Stripe checkout currently supports USD plans only' });
      }
      const priceId = checkoutProviderCode(req, 'STRIPE', planType, interval, currency);
      if (!priceId) {
        return res.status(400).json({
          error: `Stripe price is not configured for ${planType}/${interval}/${currency}`,
          message: `Set ${envKey('STRIPE_PRICE_ID', planType, interval, currency)} or pass priceId for controlled test checkout.`,
        });
      }

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const customerEmail = req.body.email || (org as any)?.billingEmail || (org as any)?.email || '';
      const existing = await prisma.subscription.findUnique({
        where: { organizationId },
        select: { stripeCustomerId: true },
      });

      const { checkoutUrl, sessionId, customerId } = await createCheckoutSession({
        planStripeProductId: (plan as any).stripeProductId ?? '',
        planStripePriceId: priceId,
        interval,
        currency,
        organizationId,
        customerEmail,
        existingStripeCustomerId: existing?.stripeCustomerId,
        metadata: {
          invoiceId: invoice.id,
          planType,
          billingInterval: interval,
          currency,
        },
        successUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
        cancelUrl: typeof req.body.cancelUrl === 'string' ? req.body.cancelUrl : undefined,
      });

      // Store the Stripe session reference on the invoice for webhook matching
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          provider: 'STRIPE',
          providerReference: sessionId,
          providerCustomerId: customerId,
        },
      });

      return res.status(201).json({
        checkoutId: invoice.id,
        provider,
        status: 'pending',
        checkoutUrl,
        url: checkoutUrl,
        invoiceId: invoice.id,
      });
    }

    // ── PAYSTACK: initialize transaction ───────────────────────────────────
    if (provider === 'PAYSTACK') {
      if (currency !== BillingCurrency.NGN) {
        return res.status(400).json({ error: 'Paystack checkout currently supports NGN plans only' });
      }
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const email = req.body.email || (org as any)?.billingEmail || (org as any)?.email || '';
      // Paystack works in lowest denomination (kobo for NGN, cents for USD)
      const amountMinor = Math.round(total);
      const planCode = checkoutProviderCode(req, 'PAYSTACK', planType, interval, currency) ?? undefined;

      const { authorizationUrl, reference } = await initializeTransaction({
        email,
        amountKobo: amountMinor,
        currency: currency === BillingCurrency.NGN ? 'NGN' : 'USD',
        reference: `sots-${invoice.id}-${Date.now()}`,
        organizationId,
        planCode,
        metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency },
      });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          provider: 'PAYSTACK',
          providerReference: reference,
          paystackRef: reference,
        },
      });

      return res.status(201).json({
        checkoutId: invoice.id,
        provider,
        status: 'pending',
        checkoutUrl: authorizationUrl,
        authorizationUrl,
        invoiceId: invoice.id,
      });
    }

    // Unreachable — kept for exhaustiveness
    return res.status(400).json({ error: 'Unsupported provider' });
  } catch (err) {
    console.error('[BillingAPI] Create checkout failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/billing/mock-checkout/:invoiceId', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { invoiceId } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return res.status(404).send('Invoice not found');

    const redirectUrl = appUrl(`/settings/billing?success=1&invoiceId=${invoiceId}`);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[BillingAPI] Mock checkout redirect failed', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/billing/webhooks/:provider', async (req: any, res: Response) => {
  const provider = req.params.provider.toUpperCase() as Provider;

  if (!['STRIPE', 'PAYSTACK', 'MOCK'].includes(provider)) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  if (provider === 'MOCK' && process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (provider === 'MOCK' && process.env.BILLING_MOCK_WEBHOOK_SECRET) {
    const actual = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-billing-mock-webhook-secret'];
    if (actual !== process.env.BILLING_MOCK_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid mock webhook secret' });
    }
  }

  if (provider === 'STRIPE') {
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) {
      console.warn('[BillingAPI] Stripe webhook missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    if (!req.rawBody) {
      return res.status(400).json({ error: 'Raw body not available for signature verification' });
    }
    try {
      verifyStripeWebhook(req.rawBody, sig);
    } catch (err) {
      console.error('[BillingAPI] Stripe webhook signature verification failed', err);
      return res.status(401).json({ error: 'Invalid Stripe webhook signature' });
    }
  }

  if (provider === 'PAYSTACK') {
    const sig = req.headers['x-paystack-signature'] as string | undefined;
    if (!sig) {
      console.warn('[BillingAPI] Paystack webhook missing x-paystack-signature header');
      return res.status(400).json({ error: 'Missing x-paystack-signature header' });
    }
    if (!req.rawBody) {
      return res.status(400).json({ error: 'Raw body not available for signature verification' });
    }
    const valid = verifyPaystackWebhook(req.rawBody, sig);
    if (!valid) {
      console.error('[BillingAPI] Paystack webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid Paystack webhook signature' });
    }
  }

  const event = normalizeBillingWebhook(provider, req.body);
  if (!event) {
    return res.status(400).json({ error: 'event type is required' });
  }
  if (!event.organizationId) {
    return res.status(400).json({ error: 'organizationId is required in webhook payload' });
  }

  let paymentEvent: PaymentEvent | null = null;

  try {
    const claim = await claimWebhookEvent(event, req.body);
    paymentEvent = claim.paymentEvent;
    if (claim.skipped) {
      console.log(`[BillingAPI] Idempotent skip: ${provider}/${event.eventType}/${event.providerEventId} ${claim.reason}`);
      return res.json({ received: true, skipped: true, reason: claim.reason });
    }

    let reconciledInvoice = await reconcileInvoiceForEvent(event);
    let paidInvoice: typeof reconciledInvoice = null;

    if (isActivationEvent(event)) {
      paidInvoice = await reconcileInvoiceForEvent(event, 'PAID');
      reconciledInvoice = paidInvoice ?? reconciledInvoice;

      const planType = event.planType ?? reconciledInvoice?.planType ?? null;
      if (!planType) throw new Error('planType is required for activation events');

      const plan = await prisma.plan.findUnique({ where: { type: planType } });
      if (!plan) throw new Error(`Plan not found for webhook planType ${planType}`);

      const interval = event.billingInterval ?? reconciledInvoice?.billingInterval ?? BillingInterval.MONTHLY;
      const currency = event.currency ?? reconciledInvoice?.currency ?? BillingCurrency.USD;

      await activateSubscription({
        organizationId: event.organizationId,
        plan,
        interval,
        currency,
        provider,
        providerCustomerId: event.customerId,
        providerSubscriptionId: event.subscriptionId,
      });

      // Persist the subscription linkage even if the invoice was found before activateSubscription.
      if (reconciledInvoice && event.subscriptionId && !reconciledInvoice.providerSubscriptionId) {
        paidInvoice = await prisma.invoice.update({
          where: { id: reconciledInvoice.id },
          data: { providerSubscriptionId: event.subscriptionId },
        });
      }

      void (async () => {
        try {
          const org = await prisma.organization.findUnique({ where: { id: event.organizationId } });
          if (!org || !paidInvoice) return;

          const receiptData = {
            invoiceNumber: paidInvoice.invoiceNumber,
            invoiceDate: new Date().toISOString(),
            organizationName: org.name,
            organizationEmail: (org as any).billingEmail || (org as any).email || '',
            planName: `${plan.name} - ${interval === BillingInterval.ANNUAL ? 'Annual' : 'Monthly'}`,
            currency: paidInvoice.currency,
            amountPaid: Number(paidInvoice.total) / 100,
            billingPeriodStart: paidInvoice.periodStart?.toISOString() ?? new Date().toISOString(),
            billingPeriodEnd: paidInvoice.periodEnd?.toISOString() ?? new Date().toISOString(),
            provider,
            providerReference: event.providerReference || event.providerEventId,
          };

          const pdfBuffer = await generateReceiptPdf(receiptData);

          await emailService.sendToOrganizationMembers({
            templateKey: 'billing-receipt',
            organizationId: event.organizationId,
            eventType: 'BILLING_RECEIPT',
            severity: 'LOW',
            variables: {
              organizationName: org.name,
              planName: receiptData.planName,
              amountPaid: `${receiptData.currency} ${receiptData.amountPaid.toFixed(2)}`,
              invoiceNumber: receiptData.invoiceNumber,
              billingUrl: appUrl('/settings/billing'),
              receiptSizeKb: Math.ceil(pdfBuffer.length / 1024),
            },
            idempotencyKey: buildIdempotencyKey(['billing-receipt', event.organizationId, paidInvoice.id]),
            roles: [MemberRole.OWNER, MemberRole.ADMIN],
          }).catch((err) => console.error('[Email] billing-receipt send failed', err));
        } catch (err) {
          console.error('[BillingAPI] Receipt generation failed (non-fatal)', err);
        }
      })();
    }

    if (isPaymentFailureEvent(event)) {
      const failedInvoice = await reconcileInvoiceForEvent(event, 'FAILED');
      await prisma.subscription.updateMany({
        where: { organizationId: event.organizationId },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      await entitlementChecker.resolveEntitlement(event.organizationId);

      const org = await prisma.organization.findUnique({ where: { id: event.organizationId } });
      if (org) {
        void emailService.sendToOrganizationMembers({
          templateKey: 'billing-payment-failed',
          organizationId: event.organizationId,
          eventType: 'BILLING_PAYMENT_FAILED',
          severity: 'HIGH',
          variables: {
            organizationName: org.name,
            provider,
            eventType: event.eventType,
            invoiceId: failedInvoice?.id || event.invoiceId || '',
            billingUrl: appUrl('/settings/billing'),
          },
          idempotencyKey: buildIdempotencyKey(['billing-payment-failed', event.organizationId, failedInvoice?.id || event.providerEventId]),
          roles: [MemberRole.OWNER, MemberRole.ADMIN],
        }).catch((err) => console.error('[Email] billing-payment-failed failed', err));
      }
      reconciledInvoice = failedInvoice ?? reconciledInvoice;
    }

    if (isCancellationEvent(event)) {
      const freePlan = await prisma.plan.findUnique({ where: { type: PlanType.FREE } });
      if (!freePlan) throw new Error('Free plan not configured');
      await prisma.subscription.updateMany({
        where: { organizationId: event.organizationId },
        data: {
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          cancelledAt: new Date(),
          pendingPlanId: null,
          pendingChangeAt: null,
        },
      });
      await entitlementChecker.resolveEntitlement(event.organizationId);
    }

    if (paymentEvent) {
      await markPaymentEventProcessed(paymentEvent, paidInvoice?.id ?? reconciledInvoice?.id ?? event.invoiceId);
    }

    res.json({ received: true });
  } catch (err) {
    await markPaymentEventFailed(paymentEvent, err);
    console.error('[BillingAPI] Webhook handling failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/billing/organizations/:orgId/subscription/cancel', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    const freePlan = await prisma.plan.findUnique({ where: { type: PlanType.FREE } });
    if (!freePlan) return res.status(500).json({ error: 'FREE_PLAN_NOT_CONFIGURED' });
    const current = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!current) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    const subscription = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        cancelledAt: new Date(),
        pendingPlanId: freePlan.id,
        pendingChangeAt: current.currentPeriodEnd,
      },
      include: { plan: true, pendingPlan: true },
    });
    await recordPaymentEvent(orgId, 'MOCK', 'subscription.cancellation_scheduled', { source: 'api', effectiveAt: current.currentPeriodEnd });

    // Audit: subscription cancelled
    await writeAuditLog(prisma, {
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      organizationId: orgId,
      metadata: { source: 'api', planType: subscription.plan?.type },
    });

    res.json({ ...subscription, status: 'CANCELLATION_SCHEDULED', effectiveAt: current.currentPeriodEnd });
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
