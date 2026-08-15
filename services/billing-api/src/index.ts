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
import { createCheckoutSession, verifyStripeWebhook, ensureStripeCustomer, setStripeCancellation } from './providers/stripe';
import {
  chargeAuthorization,
  createSubscription as createPaystackSubscription,
  disableSubscription as disablePaystackSubscription,
  enableSubscription as enablePaystackSubscription,
  initializeTransaction,
  verifyPaystackWebhook,
} from './providers/paystack';
import { generateReceiptPdf } from './receipt';
import {
  activateFlutterwaveSubscription,
  cancelFlutterwaveSubscription,
  createFlutterwaveCheckout,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhook,
} from './providers/flutterwave';
import {
  billingPolicy,
  checkoutProviders,
  currencyForCountry,
  openPaymentReference,
  previewExpiry,
  proratedDifference,
  providerPlanCode,
  sealPaymentReference,
  validateProviderPayment,
} from './billing-policy';

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

type Provider = 'STRIPE' | 'PAYSTACK' | 'FLUTTERWAVE' | 'MOCK';

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

function invoiceNumber(): string {
  return `TELLANN-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function checkoutReturnUrl(value: unknown, invoiceId: string): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const url = new URL(value);
  url.searchParams.set('invoiceId', invoiceId);
  return url.toString();
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
  amountMinor: number | null;
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
      amountMinor: typeof stripeObject.amount_paid === 'number'
        ? stripeObject.amount_paid
        : typeof stripeObject.amount_total === 'number'
          ? stripeObject.amount_total
          : typeof stripeObject.amount_due === 'number' ? stripeObject.amount_due : null,
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
      amountMinor: typeof data.amount === 'number'
        ? data.amount
        : typeof subscription.amount === 'number' ? subscription.amount : null,
      payloadData: data,
    };
  }

  if (provider === 'FLUTTERWAVE') {
    const data = asRecord(root.data ?? root);
    const metadata = asRecord(data.meta ?? data.metadata ?? root.meta);
    const reference = firstString(data.tx_ref, data.reference);
    const customer = asRecord(data.customer);
    return {
      provider,
      eventType,
      providerEventId: firstString(root.id, data.id) ?? `${eventType}:${reference ?? cryptoRandomFallback()}`,
      providerReference: reference ?? firstString(data.id),
      organizationId: firstString(metadata.organizationId, data.organizationId) ?? '',
      invoiceId: firstString(metadata.invoiceId, data.invoiceId),
      planType: assertEnumValue(PlanType, metadata.planType ?? data.planType),
      billingInterval: assertEnumValue(BillingInterval, metadata.billingInterval ?? data.billingInterval),
      currency: assertEnumValue(BillingCurrency, String(data.currency ?? metadata.currency ?? '').toUpperCase()),
      customerId: firstString(customer.id, data.customer_id),
      subscriptionId: firstString(data.subscription_id, data.subscriptionId),
      stripeInvoiceId: null,
      paystackRef: null,
      paidAt: typeof data.created_at === 'string' ? new Date(data.created_at) : null,
      amountMinor: typeof data.amount === 'number' ? Math.round(data.amount * 100) : null,
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
    amountMinor: typeof data.amount === 'number' ? data.amount : null,
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
  providerPlanCode?: string | null;
  providerPeriodStart?: Date | null;
  providerPeriodEnd?: Date | null;
  providerNextChargeAt?: Date | null;
  paymentMethodReference?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodExpMonth?: string | null;
  paymentMethodExpYear?: string | null;
  providerManagementToken?: string | null;
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
      activeProvider: params.provider,
      providerCustomerId: params.providerCustomerId ?? null,
      providerSubscriptionId: params.providerSubscriptionId ?? null,
      providerPlanCode: params.providerPlanCode ?? null,
      providerPeriodStart: params.providerPeriodStart ?? now,
      providerPeriodEnd: params.providerPeriodEnd ?? end,
      providerNextChargeAt: params.providerNextChargeAt ?? params.providerPeriodEnd ?? end,
      paymentMethodReference: params.paymentMethodReference ?? null,
      paymentMethodBrand: params.paymentMethodBrand ?? null,
      paymentMethodLast4: params.paymentMethodLast4 ?? null,
      paymentMethodExpMonth: params.paymentMethodExpMonth ?? null,
      paymentMethodExpYear: params.paymentMethodExpYear ?? null,
      paymentMethodAuthorizedAt: params.paymentMethodReference ? now : null,
      providerManagementToken: params.providerManagementToken ?? null,
      cancelAtPeriodEnd: false,
      nonRenewing: params.plan.type === PlanType.FREE,
      migrationStatus: params.provider === 'PAYSTACK' ? 'PAYSTACK_ACTIVE' : 'STRIPE_ACTIVE',
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
      activeProvider: params.provider,
      providerCustomerId: params.providerCustomerId ?? undefined,
      providerSubscriptionId: params.providerSubscriptionId ?? undefined,
      providerPlanCode: params.providerPlanCode ?? undefined,
      providerPeriodStart: params.providerPeriodStart ?? now,
      providerPeriodEnd: params.providerPeriodEnd ?? end,
      providerNextChargeAt: params.providerNextChargeAt ?? params.providerPeriodEnd ?? end,
      paymentMethodReference: params.paymentMethodReference ?? undefined,
      paymentMethodBrand: params.paymentMethodBrand ?? undefined,
      paymentMethodLast4: params.paymentMethodLast4 ?? undefined,
      paymentMethodExpMonth: params.paymentMethodExpMonth ?? undefined,
      paymentMethodExpYear: params.paymentMethodExpYear ?? undefined,
      paymentMethodAuthorizedAt: params.paymentMethodReference ? now : undefined,
      providerManagementToken: params.providerManagementToken ?? undefined,
      cancelAtPeriodEnd: false,
      nonRenewing: params.plan.type === PlanType.FREE,
      pendingPlanId: null,
      pendingChangeAt: null,
      migrationStatus: params.provider === 'PAYSTACK' ? 'PAYSTACK_ACTIVE' : 'STRIPE_ACTIVE',
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
    'charge.completed',
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
    'subscription.disable',
  ].includes(event.eventType);
}
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'billing-api' });
});

app.get('/billing/provider-diagnostics', verifyJwt, async (_req: Request, res: Response) => {
  const present = (key: string) => Boolean(process.env[key]?.trim());
  const callback = (key: string) => {
    const value = process.env[key]?.trim();
    return value ? { configured: true, local: value.startsWith('http://localhost:') } : { configured: false, local: false };
  };
  const planCounts = await prisma.billingProviderPlan.groupBy({
    by: ['provider'], where: { environment: billingPolicy.environment, active: true }, _count: { _all: true },
  });
  res.json({
    environment: billingPolicy.environment,
    encryptionConfigured: present('BILLING_ENCRYPTION_KEY'),
    providers: {
      PAYSTACK: { configured: present('PAYSTACK_SECRET_KEY'), webhookConfigured: present('PAYSTACK_SECRET_KEY'), callback: callback('PAYSTACK_SUCCESS_URL') },
      FLUTTERWAVE: { configured: present('FLUTTERWAVE_PUBLIC_KEY') && present('FLUTTERWAVE_SECRET_KEY'), webhookConfigured: present('FLUTTERWAVE_SECRET_HASH'), callback: callback('FLUTTERWAVE_SUCCESS_URL') },
      STRIPE: { configured: present('STRIPE_SECRET_KEY'), webhookConfigured: present('STRIPE_WEBHOOK_SECRET'), callback: callback('STRIPE_SUCCESS_URL') },
    },
    providerPlanCounts: Object.fromEntries(planCounts.map((row) => [row.provider, row._count._all])),
    testOverrideEnabled: process.env.NODE_ENV !== 'production' && process.env.BILLING_ALLOW_TEST_PROVIDER_OVERRIDE === 'true',
  });
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

function validateInvoicePayment(event: NormalizedBillingEvent, invoice: Awaited<ReturnType<typeof findInvoiceForEvent>>): void {
  if (!invoice) return;
  validateProviderPayment({
    eventCurrency: event.currency,
    invoiceCurrency: invoice.currency,
    eventAmountMinor: event.amountMinor,
    invoiceTotal: invoice.total,
    eventPlanType: event.planType,
    invoicePlanType: invoice.planType,
  });
}

function firstDate(...values: unknown[]): Date | null {
  for (const value of values) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

app.get('/billing/plans', async (req: Request, res: Response) => {
  try {
    const orgId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const [profile, organization, subscription, plans] = await Promise.all([
      orgId ? prisma.organizationBillingProfile.findUnique({ where: { organizationId: orgId } }) : null,
      orgId ? prisma.organization.findUnique({ where: { id: orgId } }) : null,
      orgId ? prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } }) : null,
      prisma.plan.findMany({
        where: { isPublic: true },
        include: { featureFlags: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const countryCode = profile?.countryCode ?? (organization as any)?.countryCode ?? null;
    const currency = currencyForCountry(countryCode);
    const currentRank = subscription ? PLAN_DEFINITIONS[subscription.plan.type as PlanTypeKey]?.rank ?? 0 : 0;
    res.json({
      currency,
      countryRequired: !countryCode,
      currentPlanType: subscription?.plan.type ?? PlanType.FREE,
      plans: plans.map((plan) => {
        const item = publicPlan(plan, countryCode ?? undefined);
        const rank = PLAN_DEFINITIONS[plan.type as PlanTypeKey]?.rank ?? plan.sortOrder;
        const action = plan.type === PlanType.ENTERPRISE
          ? 'CONTACT_SALES'
          : plan.type === subscription?.plan.type
            ? 'CURRENT'
            : rank > currentRank ? (subscription ? 'UPGRADE' : 'SUBSCRIBE') : 'DOWNGRADE';
        return {
          ...item,
          resolvedCurrency: currency,
          displayPriceMonthly: currency === BillingCurrency.NGN ? plan.monthlyPriceNgn : plan.monthlyPriceUsd,
          displayPriceAnnual: currency === BillingCurrency.NGN ? plan.annualPriceNgn : plan.annualPriceUsd,
          action,
          allowedEffectiveModes: action === 'DOWNGRADE' ? ['NEXT_RENEWAL'] : ['IMMEDIATE', 'NEXT_RENEWAL'],
        };
      }),
    });
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

    res.json(subscription ? {
      ...subscription,
      renewsAt: subscription.plan.type === PlanType.FREE || subscription.nonRenewing ? null : subscription.currentPeriodEnd,
    } : null);
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

app.post(['/billing/checkout', '/billing/subscriptions/checkout'], verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = req.body.organizationId || req.headers['x-sots-org-id'];
  const planType = assertEnumValue(PlanType, req.body.planType);
  const interval = assertEnumValue(BillingInterval, req.body.billingInterval) ?? BillingInterval.MONTHLY;
  let currency: BillingCurrency = BillingCurrency.USD;
  let provider: Provider = 'PAYSTACK';

  if (!organizationId || typeof organizationId !== 'string') {
    return res.status(400).json({ error: 'organizationId is required' });
  }
  if (!planType) {
    return res.status(400).json({ error: `planType must be one of ${Object.values(PlanType).join(', ')}` });
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
    const [profile, org] = await Promise.all([
      prisma.organizationBillingProfile.findUnique({ where: { organizationId } }),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
    const countryCode = profile?.countryCode ?? (org as any)?.countryCode ?? null;
    if (!countryCode) {
      return res.status(400).json({ error: 'BILLING_COUNTRY_REQUIRED', message: 'Complete the organization billing profile before checkout.' });
    }
    currency = currencyForCountry(countryCode);
    const requestedTestProvider = String(req.body.provider ?? '').toUpperCase() as Provider;
    const allowOverride = process.env.NODE_ENV !== 'production'
      && process.env.BILLING_ALLOW_TEST_PROVIDER_OVERRIDE === 'true';
    const eligibleProviders: Provider[] = allowOverride
      ? currency === BillingCurrency.NGN ? ['PAYSTACK', 'MOCK'] : ['FLUTTERWAVE', 'STRIPE', 'MOCK']
      : [...checkoutProviders(currency)];
    if (requestedTestProvider && allowOverride) {
      if (!eligibleProviders.includes(requestedTestProvider)) {
        return res.status(400).json({ error: 'TEST_PROVIDER_NOT_ELIGIBLE', eligibleProviders });
      }
      provider = requestedTestProvider;
    } else {
      provider = checkoutProviders(currency)[0];
    }
    if (planType === PlanType.LOCAL) {
      if (countryCode !== 'NG' || currency !== BillingCurrency.NGN || (provider !== 'PAYSTACK' && provider !== 'MOCK')) {
        return res.status(400).json({
          error: 'LOCAL_PLAN_INELIGIBLE',
          message: 'Local is available only to Nigerian organizations, billed in NGN through Paystack.',
        });
      }
    }
    const currentSubscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    const currentDefinition = currentSubscription ? PLAN_DEFINITIONS[currentSubscription.plan.type as PlanTypeKey] : null;
    if (currentSubscription && (currentDefinition?.rank ?? 0) > 0 && currentSubscription.plan.type !== planType) {
      return res.status(409).json({
        error: 'SUBSCRIPTION_CHANGE_REQUIRED',
        message: 'Use the subscription change preview flow to upgrade or downgrade an active subscription.',
      });
    }

    const total = priceFor(plan, interval, currency);
    if (total <= 0) {
      return res.status(503).json({ error: 'PLAN_PRICE_NOT_CONFIGURED', message: `A positive ${currency} price is required for ${planType}/${interval}.` });
    }
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

    // Deterministic development provider. Paid plans remain pending until a
    // signed MOCK webhook is delivered, matching the real provider boundary.
    if (provider === 'MOCK') {
      const providerReference = `mock-${invoice.id}`;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { provider: 'MOCK', providerReference },
      });
      const mockCheckoutUrl = `${req.protocol}://${req.get('host')}/billing/mock-checkout/${invoice.id}`;
      return res.status(201).json({
        checkoutId: invoice.id,
        provider,
        status: 'pending',
        checkoutUrl: mockCheckoutUrl,
        url: mockCheckoutUrl,
        invoiceId: invoice.id,
        providerReference,
      });
    }

    // ── STRIPE: real hosted checkout ────────────────────────────────────────
    if (provider === 'STRIPE') {
      if (currency !== BillingCurrency.USD) {
        return res.status(400).json({ error: 'Stripe checkout currently supports USD plans only' });
      }
      const priceId = await providerPlanCode(prisma, 'STRIPE', planType, interval, currency);
      if (!priceId) {
        return res.status(400).json({
          error: `Stripe price is not configured for ${planType}/${interval}/${currency}`,
          message: `Configure an active Stripe provider-plan catalog entry for ${planType}/${interval}/${currency}.`,
        });
      }

      const customerEmail = profile?.billingEmail || '';
      if (!customerEmail) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
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
        successUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
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

    if (provider === 'FLUTTERWAVE') {
      const email = profile?.billingEmail || '';
      const planCode = await providerPlanCode(prisma, 'FLUTTERWAVE', planType, interval, currency);
      if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
      if (!planCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED', message: `Flutterwave is not configured for ${planType}/${interval}/${currency}.` });
      try {
        const reference = `tellann-${invoice.id}-${Date.now()}`;
        const checkout = await createFlutterwaveCheckout({
          txRef: reference, amount: total, currency, customerEmail: email,
          customerName: profile?.legalName, organizationId, planCode,
          redirectUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
          metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency },
        });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { provider, providerReference: reference } });
        return res.status(201).json({ checkoutId: invoice.id, invoiceId: invoice.id, provider, status: 'pending', checkoutUrl: checkout.checkoutUrl, url: checkout.checkoutUrl, providerReference: reference });
      } catch (cause) {
        await recordPaymentEvent(organizationId, provider, 'checkout.initialization_failed', { invoiceId: invoice.id, message: cause instanceof Error ? cause.message : String(cause) }, { invoiceId: invoice.id });
        if (!billingPolicy.stripeCheckoutFallbackEnabled) throw cause;
        const priceId = await providerPlanCode(prisma, 'STRIPE', planType, interval, currency);
        if (!priceId) throw cause;
        const fallback = await createCheckoutSession({ planStripeProductId: '', planStripePriceId: priceId, interval, currency, organizationId, customerEmail: email,
          metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency, fallbackFrom: 'FLUTTERWAVE' },
          successUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
          cancelUrl: typeof req.body.cancelUrl === 'string' ? req.body.cancelUrl : undefined });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { provider: 'STRIPE', providerReference: fallback.sessionId, providerCustomerId: fallback.customerId } });
        return res.status(201).json({ checkoutId: invoice.id, invoiceId: invoice.id, provider: 'STRIPE', fallbackFrom: 'FLUTTERWAVE', status: 'pending', checkoutUrl: fallback.checkoutUrl, url: fallback.checkoutUrl });
      }
    }

    // ── PAYSTACK: initialize transaction ───────────────────────────────────
    if (provider === 'PAYSTACK') {
      const email = profile?.billingEmail || '';
      if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
      // Paystack works in lowest denomination (kobo for NGN, cents for USD)
      const amountMinor = Math.round(total);
      const planCode = await providerPlanCode(prisma, 'PAYSTACK', planType, interval, currency) ?? undefined;
      if (!planCode) {
        return res.status(503).json({
          error: 'PROVIDER_PLAN_NOT_CONFIGURED',
          message: `Paystack is not configured for ${planType}/${interval}/${currency}.`,
        });
      }

      let authorizationUrl: string;
      let reference: string;
      try {
        ({ authorizationUrl, reference } = await initializeTransaction({
          email,
          amountKobo: amountMinor,
          currency,
          reference: `tellann-${invoice.id}-${Date.now()}`,
          organizationId,
          planCode,
          metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency },
          callbackUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
        }));
      } catch (paystackError) {
        await recordPaymentEvent(organizationId, 'PAYSTACK', 'checkout.initialization_failed', {
          invoiceId: invoice.id,
          message: paystackError instanceof Error ? paystackError.message : 'Paystack initialization failed',
        }, { invoiceId: invoice.id });
        if (!billingPolicy.stripeCheckoutFallbackEnabled) throw paystackError;
        const stripePriceId = await providerPlanCode(prisma, 'STRIPE', planType, interval, currency);
        if (!stripePriceId) throw paystackError;
        const existing = await prisma.subscription.findUnique({
          where: { organizationId },
          select: { stripeCustomerId: true },
        });
        const stripeCheckout = await createCheckoutSession({
          planStripeProductId: '',
          planStripePriceId: stripePriceId,
          interval,
          currency,
          organizationId,
          customerEmail: email,
          existingStripeCustomerId: existing?.stripeCustomerId,
          metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency, fallbackFrom: 'PAYSTACK' },
          successUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
          cancelUrl: typeof req.body.cancelUrl === 'string' ? req.body.cancelUrl : undefined,
        });
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            provider: 'STRIPE',
            providerReference: stripeCheckout.sessionId,
            providerCustomerId: stripeCheckout.customerId,
          },
        });
        return res.status(201).json({
          checkoutId: invoice.id,
          provider: 'STRIPE',
          fallbackFrom: 'PAYSTACK',
          status: 'pending',
          checkoutUrl: stripeCheckout.checkoutUrl,
          url: stripeCheckout.checkoutUrl,
          invoiceId: invoice.id,
        });
      }

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
    console.error('[BillingAPI] Create checkout failed', err instanceof Error ? err.message : 'Unknown checkout error');
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

  if (!['STRIPE', 'PAYSTACK', 'FLUTTERWAVE', 'MOCK'].includes(provider)) {
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

  if (provider === 'FLUTTERWAVE' && (!req.rawBody || !verifyFlutterwaveWebhook(req.rawBody, req.headers))) {
    return res.status(401).json({ error: 'Invalid Flutterwave webhook signature' });
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
    const eventData = asRecord(req.body?.data);
    const eventMetadata = asRecord(eventData.metadata);
    const paymentMethodPurpose = firstString(eventMetadata.purpose);
    const isPaymentMethodUpdate = provider === 'PAYSTACK'
      && ['PAYMENT_METHOD_UPDATE', 'STRIPE_MIGRATION'].includes(paymentMethodPurpose ?? '');

    if (provider === 'PAYSTACK' && event.eventType === 'subscription.create') {
      const subscriptionPayload = asRecord(eventData.subscription);
      const subscriptionCode = event.subscriptionId ?? firstString(eventData.subscription_code, subscriptionPayload.subscription_code);
      const emailToken = firstString(eventData.email_token, subscriptionPayload.email_token);
      const customer = asRecord(eventData.customer);
      const customerCode = event.customerId ?? firstString(customer.customer_code);
      if (!subscriptionCode || !emailToken) throw new Error('Paystack subscription.create omitted management credentials');
      await prisma.subscription.update({
        where: { organizationId: event.organizationId },
        data: {
          activeProvider: 'PAYSTACK',
          providerCustomerId: customerCode ?? undefined,
          paystackCustomerCode: customerCode ?? undefined,
          providerSubscriptionId: subscriptionCode,
          paystackSubscriptionCode: subscriptionCode,
          providerManagementToken: sealPaymentReference(emailToken),
          providerPlanCode: firstString(asRecord(eventData.plan).plan_code, eventData.plan_code) ?? undefined,
          providerNextChargeAt: firstDate(eventData.next_payment_date, subscriptionPayload.next_payment_date) ?? undefined,
        },
      });
      await prisma.subscriptionChange.updateMany({
        where: {
          organizationId: event.organizationId,
          providerOperationId: subscriptionCode,
          status: { in: ['SCHEDULED', 'PROCESSING'] },
        },
        data: { status: 'PROVIDER_CONFIRMED' },
      });
    }

    if (isPaymentMethodUpdate && event.eventType === 'charge.success') {
      const authorization = asRecord(eventData.authorization);
      const authorizationCode = firstString(authorization.authorization_code);
      if (!authorizationCode) throw new Error('Paystack payment method update did not return a reusable authorization');
      await prisma.subscription.update({
        where: { organizationId: event.organizationId },
        data: {
          paymentMethodReference: sealPaymentReference(authorizationCode),
          paymentMethodBrand: firstString(authorization.brand, authorization.card_type),
          paymentMethodLast4: firstString(authorization.last4),
          paymentMethodExpMonth: firstString(authorization.exp_month),
          paymentMethodExpYear: firstString(authorization.exp_year),
          paymentMethodAuthorizedAt: new Date(),
        },
      });
      if (paymentMethodPurpose === 'STRIPE_MIGRATION') {
        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: event.organizationId },
          include: { plan: true },
        });
        if (!subscription || subscription.activeProvider !== 'STRIPE' || !subscription.providerSubscriptionId) {
          throw new Error('Stripe migration requires an active linked Stripe subscription');
        }
        const planCode = await providerPlanCode(
          prisma,
          'PAYSTACK',
          subscription.plan.type,
          subscription.billingInterval,
          subscription.billingCurrency,
        );
        if (!planCode) throw new Error('Paystack migration plan is not configured');
        const customer = asRecord(eventData.customer);
        const customerCode = firstString(customer.customer_code, event.customerId);
        if (!customerCode) throw new Error('Paystack migration customer was not returned');
        const replacement = await createPaystackSubscription({
          customer: customerCode,
          planCode,
          authorizationCode,
          startDate: subscription.providerPeriodEnd ?? subscription.currentPeriodEnd,
        });
        await setStripeCancellation(subscription.providerSubscriptionId, true);
        await prisma.$transaction([
          prisma.subscriptionChange.create({
            data: {
              organizationId: event.organizationId,
              sourcePlanId: subscription.planId,
              targetPlanId: subscription.planId,
              sourceInterval: subscription.billingInterval,
              targetInterval: subscription.billingInterval,
              currency: subscription.billingCurrency,
              direction: 'MIGRATION',
              effectiveMode: 'NEXT_RENEWAL',
              status: 'SCHEDULED',
              previewExpiresAt: subscription.currentPeriodEnd,
              prorationAt: new Date(),
              amountDue: 0,
              creditAmount: 0,
              nextCycleAmount: priceFor(subscription.plan, subscription.billingInterval, subscription.billingCurrency),
              effectiveAt: subscription.providerPeriodEnd ?? subscription.currentPeriodEnd,
              provider: 'PAYSTACK',
              providerOperationId: replacement.subscriptionCode,
              providerReference: replacement.emailToken ? sealPaymentReference(replacement.emailToken) : null,
              idempotencyKey: `migration:${event.organizationId}:${replacement.subscriptionCode}`,
            },
          }),
          prisma.subscription.update({
            where: { organizationId: event.organizationId },
            data: {
              migrationStatus: 'PAYSTACK_AUTHORIZED',
              cancelAtPeriodEnd: true,
              pendingPlanId: subscription.planId,
              pendingChangeAt: subscription.providerPeriodEnd ?? subscription.currentPeriodEnd,
              paymentMethodReference: sealPaymentReference(authorizationCode),
              paystackCustomerCode: customerCode,
            },
          }),
        ]);
      }
    }

    if (isActivationEvent(event) && !isPaymentMethodUpdate) {
      validateInvoicePayment(event, reconciledInvoice);
      paidInvoice = await reconcileInvoiceForEvent(event, 'PAID');
      reconciledInvoice = paidInvoice ?? reconciledInvoice;

      const scheduledProviderChange = event.subscriptionId
        ? await prisma.subscriptionChange.findFirst({
            where: {
              organizationId: event.organizationId,
              providerOperationId: event.subscriptionId,
              status: { in: ['SCHEDULED', 'PROCESSING'] },
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      const scheduledTargetPlan = scheduledProviderChange
        ? await prisma.plan.findUnique({ where: { id: scheduledProviderChange.targetPlanId } })
        : null;
      const planType = event.planType ?? reconciledInvoice?.planType ?? scheduledTargetPlan?.type ?? null;
      if (!planType) throw new Error('planType is required for activation events');

      const plan = await prisma.plan.findUnique({ where: { type: planType } });
      if (!plan) throw new Error(`Plan not found for webhook planType ${planType}`);

      const interval = event.billingInterval ?? reconciledInvoice?.billingInterval ?? BillingInterval.MONTHLY;
      const currency = event.currency ?? reconciledInvoice?.currency ?? BillingCurrency.USD;
      const webhookData = asRecord(req.body?.data);
      const authorization = asRecord(webhookData.authorization);
      const webhookSubscription = asRecord(webhookData.subscription);
      const authorizationCode = firstString(authorization.authorization_code);
      const emailToken = firstString(webhookSubscription.email_token, webhookData.email_token);
      const providerPlan = asRecord(webhookSubscription.plan);
      const providerPeriodStart = firstDate(webhookData.period_start, webhookSubscription.period_start);
      const providerPeriodEnd = firstDate(webhookData.period_end, webhookSubscription.next_payment_date);

      await activateSubscription({
        organizationId: event.organizationId,
        plan,
        interval,
        currency,
        provider,
        providerCustomerId: event.customerId,
        providerSubscriptionId: event.subscriptionId,
        providerPlanCode: firstString(providerPlan.plan_code, webhookData.plan_code),
        providerPeriodStart,
        providerPeriodEnd,
        providerNextChargeAt: firstDate(webhookSubscription.next_payment_date),
        paymentMethodReference: provider === 'PAYSTACK' && authorizationCode ? sealPaymentReference(authorizationCode) : null,
        paymentMethodBrand: firstString(authorization.brand, authorization.card_type),
        paymentMethodLast4: firstString(authorization.last4),
        paymentMethodExpMonth: firstString(authorization.exp_month),
        paymentMethodExpYear: firstString(authorization.exp_year),
        providerManagementToken: provider === 'PAYSTACK' && emailToken ? sealPaymentReference(emailToken) : null,
      });
      if (scheduledProviderChange) {
        await prisma.subscriptionChange.update({
          where: { id: scheduledProviderChange.id },
          data: { status: 'APPLIED', effectiveAt: new Date() },
        });
      }
      await prisma.billingDunningAttempt.updateMany({
        where: { organizationId: event.organizationId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
        data: { status: 'CANCELLED', completedAt: new Date() },
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
        data: { status: SubscriptionStatus.GRACE_PERIOD },
      });
      const subscription = await prisma.subscription.findUnique({ where: { organizationId: event.organizationId } });
      const retryAmount = failedInvoice?.total ?? (subscription
        ? priceFor(
            await prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } }),
            subscription.billingInterval,
            subscription.billingCurrency,
          )
        : 0);
      const base = new Date();
      const retryReference = event.providerReference ?? event.providerEventId;
      for (const [index, days] of [1, 3, 7].entries()) {
        const scheduledAt = new Date(base);
        scheduledAt.setUTCDate(scheduledAt.getUTCDate() + days);
        await prisma.billingDunningAttempt.upsert({
          where: {
            organizationId_providerReference_attemptNumber: {
              organizationId: event.organizationId,
              providerReference: retryReference,
              attemptNumber: index + 1,
            },
          },
          create: {
            organizationId: event.organizationId,
            invoiceId: failedInvoice?.id,
            provider,
            providerReference: retryReference,
            attemptNumber: index + 1,
            scheduledAt,
            amount: Number(retryAmount),
            currency: subscription?.billingCurrency ?? event.currency ?? BillingCurrency.USD,
            idempotencyKey: `dunning:${event.organizationId}:${retryReference}:${index + 1}`,
          },
          update: {},
        });
      }
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
          nonRenewing: true,
          activeProvider: null,
          providerCustomerId: null,
          providerSubscriptionId: null,
          providerPlanCode: null,
          providerManagementToken: null,
          providerPeriodStart: null,
          providerPeriodEnd: null,
          providerNextChargeAt: null,
          paymentMethodReference: null,
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
app.post('/billing/subscriptions/changes/preview', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const targetPlanType = assertEnumValue(PlanType, req.body.planType);
  const targetInterval = assertEnumValue(BillingInterval, req.body.billingInterval);
  if (!organizationId || !targetPlanType || !targetInterval) {
    return res.status(400).json({ error: 'organizationId, planType, and billingInterval are required' });
  }

  try {
    const [subscription, targetPlan, profile] = await Promise.all([
      prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
      prisma.plan.findUnique({ where: { type: targetPlanType } }),
      prisma.organizationBillingProfile.findUnique({ where: { organizationId } }),
    ]);
    if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    if (!targetPlan || targetPlan.type === PlanType.FREE || targetPlan.type === PlanType.ENTERPRISE) {
      return res.status(400).json({ error: 'INVALID_TARGET_PLAN' });
    }
    if (!targetPlan.isPublic) return res.status(400).json({ error: 'PLAN_NOT_PUBLIC' });
    if (targetPlan.type === PlanType.LOCAL && profile?.countryCode?.toUpperCase() !== 'NG') {
      return res.status(400).json({
        error: 'LOCAL_PLAN_INELIGIBLE',
        message: 'Local is available only to Nigerian organizations billed in NGN.',
      });
    }
    const currency = currencyForCountry(profile?.countryCode);
    const currentRank = PLAN_DEFINITIONS[subscription.plan.type as PlanTypeKey]?.rank ?? 0;
    const targetRank = PLAN_DEFINITIONS[targetPlan.type as PlanTypeKey]?.rank ?? 0;
    const direction = targetRank > currentRank ? 'UPGRADE' : targetRank < currentRank ? 'DOWNGRADE' : 'INTERVAL_CHANGE';
    const at = new Date();
    const periodStart = subscription.providerPeriodStart ?? subscription.currentPeriodStart;
    const periodEndDate = subscription.providerPeriodEnd ?? subscription.currentPeriodEnd;
    const currentPrice = priceFor(subscription.plan, subscription.billingInterval, currency);
    const targetPrice = priceFor(targetPlan, targetInterval, currency);
    const { amountDue, creditAmount } = proratedDifference({
      currentPrice,
      targetPrice,
      periodStart,
      periodEnd: periodEndDate,
      at,
    });
    const change = await prisma.subscriptionChange.create({
      data: {
        organizationId,
        sourcePlanId: subscription.planId,
        targetPlanId: targetPlan.id,
        sourceInterval: subscription.billingInterval,
        targetInterval,
        currency,
        direction,
        effectiveMode: direction === 'DOWNGRADE' ? 'NEXT_RENEWAL' : 'UNSELECTED',
        previewExpiresAt: previewExpiry(at),
        prorationAt: at,
        amountDue,
        creditAmount,
        nextCycleAmount: targetPrice,
        effectiveAt: periodEndDate,
        provider: subscription.activeProvider,
        idempotencyKey: `preview:${organizationId}:${cryptoRandomFallback()}`,
      },
    });
    res.json({
      previewId: change.id,
      direction,
      currency,
      amountDue,
      creditAmount,
      nextCycleAmount: targetPrice,
      currentRenewalDate: periodEndDate,
      expiresAt: change.previewExpiresAt,
      supportedEffectiveModes: direction === 'DOWNGRADE'
        ? ['NEXT_RENEWAL']
        : subscription.plan.type === PlanType.FREE
          ? ['IMMEDIATE']
          : ['IMMEDIATE', 'NEXT_RENEWAL'],
    });
  } catch (err) {
    console.error('[BillingAPI] Subscription change preview failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/billing/checkouts/:invoiceId/status', verifyJwt, requireBillingViewer, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
  if (!invoice || invoice.organizationId !== organizationId) return res.status(404).json({ error: 'CHECKOUT_NOT_FOUND' });
  if (invoice.status === 'PENDING' && invoice.provider === 'FLUTTERWAVE'
      && process.env.NODE_ENV !== 'production' && typeof req.query.transaction_id === 'string') {
    try {
      const verified = await verifyFlutterwaveTransaction(req.query.transaction_id);
      if (verified.status === 'successful' && verified.reference === invoice.providerReference) {
        validateProviderPayment({
          eventCurrency: assertEnumValue(BillingCurrency, verified.currency), invoiceCurrency: invoice.currency,
          eventAmountMinor: verified.amountMinor, invoiceTotal: invoice.total,
          eventPlanType: null, invoicePlanType: invoice.planType,
        });
        const plan = await prisma.plan.findUnique({ where: { type: invoice.planType } });
        if (!plan) throw new Error('PLAN_NOT_FOUND');
        await activateSubscription({
          organizationId: invoice.organizationId, plan, interval: invoice.billingInterval,
          currency: invoice.currency, provider: 'FLUTTERWAVE', providerCustomerId: verified.customerId,
          paymentMethodBrand: verified.card?.brand, paymentMethodLast4: verified.card?.last4,
          paymentMethodExpMonth: verified.card?.expMonth, paymentMethodExpYear: verified.card?.expYear,
        });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date(), providerCustomerId: verified.customerId } });
        invoice.status = 'PAID'; invoice.paidAt = new Date();
      }
    } catch (err) {
      console.warn('[BillingAPI] Local Flutterwave return verification did not reconcile checkout', err);
    }
  }
  res.json({
    invoiceId: invoice.id,
    status: invoice.status === 'PAID' ? 'VERIFIED' : invoice.status === 'FAILED' ? 'FAILED' : 'PENDING',
    provider: invoice.provider,
    paidAt: invoice.paidAt,
    verified: invoice.status === 'PAID',
  });
});

app.post('/billing/subscriptions/changes', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const effectiveMode = String(req.body.effectiveMode ?? '');
  const idempotencyKey = String(req.body.idempotencyKey ?? '').trim();
  if (!organizationId || !req.body.previewId || !['IMMEDIATE', 'NEXT_RENEWAL'].includes(effectiveMode) || !idempotencyKey) {
    return res.status(400).json({ error: 'organizationId, previewId, effectiveMode, and idempotencyKey are required' });
  }
  try {
    const existing = await prisma.subscriptionChange.findUnique({ where: { idempotencyKey } });
    if (existing) return res.json(existing);
    const [preview, subscription, profile] = await Promise.all([
      prisma.subscriptionChange.findUnique({ where: { id: String(req.body.previewId) } }),
      prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
      prisma.organizationBillingProfile.findUnique({ where: { organizationId } }),
    ]);
    if (!preview || preview.organizationId !== organizationId || preview.status !== 'PREVIEWED') {
      return res.status(409).json({ error: 'PREVIEW_INVALID' });
    }
    if (preview.previewExpiresAt <= new Date()) return res.status(409).json({ error: 'PREVIEW_EXPIRED' });
    if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    if (preview.direction === 'DOWNGRADE' && effectiveMode !== 'NEXT_RENEWAL') {
      return res.status(400).json({ error: 'DOWNGRADE_NEXT_RENEWAL_ONLY' });
    }
    if (subscription.plan.type === PlanType.FREE && effectiveMode !== 'IMMEDIATE') {
      return res.status(400).json({ error: 'FREE_UPGRADE_IMMEDIATE_ONLY' });
    }
    if (subscription.activeProvider === 'MOCK' && process.env.NODE_ENV !== 'production') {
      const targetPlan = await prisma.plan.findUnique({ where: { id: preview.targetPlanId } });
      if (!targetPlan) return res.status(404).json({ error: 'TARGET_PLAN_NOT_FOUND' });
      const now = new Date();
      const operationId = `mock-change-${preview.id}`;
      const updated = await prisma.$transaction(async (tx) => {
        if (effectiveMode === 'IMMEDIATE') {
          await tx.subscription.update({
            where: { organizationId },
            data: {
              planId: targetPlan.id,
              billingInterval: preview.targetInterval,
              billingCurrency: preview.currency,
              providerPlanCode: `mock:${targetPlan.type}:${preview.targetInterval}:${preview.currency}`,
              pendingPlanId: null,
              pendingChangeAt: null,
            },
          });
        } else {
          await tx.subscription.update({
            where: { organizationId },
            data: { pendingPlanId: targetPlan.id, pendingChangeAt: preview.effectiveAt },
          });
        }
        return tx.subscriptionChange.update({
          where: { id: preview.id },
          data: {
            status: effectiveMode === 'IMMEDIATE' ? 'APPLIED' : 'PROVIDER_CONFIRMED',
            effectiveMode,
            idempotencyKey,
            providerOperationId: operationId,
            providerReference: operationId,
            effectiveAt: effectiveMode === 'IMMEDIATE' ? now : preview.effectiveAt,
          },
        });
      }, { maxWait: 10_000, timeout: 30_000 });
      if (effectiveMode === 'IMMEDIATE') await entitlementChecker.resolveEntitlement(organizationId);
      return res.json(updated);
    }
    if (subscription.activeProvider !== 'PAYSTACK') {
      return res.status(409).json({
        error: 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED',
        message: `Authorize the primary billing provider before changing this ${subscription.activeProvider ?? 'unlinked'} subscription.`,
      });
    }
    const targetPlan = await prisma.plan.findUnique({ where: { id: preview.targetPlanId } });
    if (!targetPlan) return res.status(404).json({ error: 'TARGET_PLAN_NOT_FOUND' });
    const planCode = await providerPlanCode(prisma, 'PAYSTACK', targetPlan.type, preview.targetInterval, preview.currency);
    if (!planCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED' });
    if (!subscription.providerCustomerId || !subscription.paymentMethodReference || !subscription.providerManagementToken) {
      return res.status(409).json({ error: 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED' });
    }
    const authorizationCode = openPaymentReference(subscription.paymentMethodReference);
    const managementToken = openPaymentReference(subscription.providerManagementToken);
    const email = profile?.billingEmail || '';
    if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
    const renewalDate = subscription.providerPeriodEnd ?? subscription.currentPeriodEnd;
    await prisma.subscriptionChange.update({
      where: { id: preview.id },
      data: { status: 'PROCESSING', effectiveMode, idempotencyKey },
    });
    if (effectiveMode === 'IMMEDIATE' && preview.amountDue > 0) {
      const charge = await chargeAuthorization({
        authorizationCode,
        email,
        amount: preview.amountDue,
        currency: preview.currency,
        reference: `change-${preview.id}`,
        metadata: { organizationId, subscriptionChangeId: preview.id },
      });
      if (charge.status !== 'success') {
        await prisma.subscriptionChange.update({
          where: { id: preview.id },
          data: { status: 'PAYMENT_ACTION_REQUIRED', providerReference: charge.reference },
        });
        return res.status(202).json({
          status: 'PAYMENT_ACTION_REQUIRED',
          checkoutUrl: charge.authorizationUrl,
          providerReference: charge.reference,
        });
      }
    }
    const replacement = await createPaystackSubscription({
      customer: subscription.providerCustomerId,
      planCode,
      authorizationCode,
      startDate: renewalDate,
    });
    if (subscription.providerSubscriptionId) {
      await disablePaystackSubscription(subscription.providerSubscriptionId, managementToken);
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      if (effectiveMode === 'IMMEDIATE') {
        await tx.subscription.update({
          where: { organizationId },
          data: {
            planId: targetPlan.id,
            billingInterval: preview.targetInterval,
            billingCurrency: preview.currency,
            providerPlanCode: planCode,
            providerSubscriptionId: replacement.subscriptionCode,
            paystackSubscriptionCode: replacement.subscriptionCode,
            providerNextChargeAt: replacement.nextPaymentDate ? new Date(replacement.nextPaymentDate) : renewalDate,
            providerManagementToken: replacement.emailToken ? sealPaymentReference(replacement.emailToken) : undefined,
            pendingPlanId: null,
            pendingChangeAt: null,
          },
        });
      } else {
        await tx.subscription.update({
          where: { organizationId },
          data: { pendingPlanId: targetPlan.id, pendingChangeAt: renewalDate },
        });
      }
      return tx.subscriptionChange.update({
        where: { id: preview.id },
        data: {
          status: effectiveMode === 'IMMEDIATE' ? 'APPLIED' : 'PROVIDER_CONFIRMED',
          providerOperationId: replacement.subscriptionCode,
          providerReference: replacement.emailToken ? sealPaymentReference(replacement.emailToken) : null,
          effectiveAt: effectiveMode === 'IMMEDIATE' ? now : renewalDate,
        },
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    if (effectiveMode === 'IMMEDIATE') await entitlementChecker.resolveEntitlement(organizationId);
    res.json(updated);
  } catch (err) {
    console.error('[BillingAPI] Subscription change failed', err);
    const previewId = typeof req.body.previewId === 'string' ? req.body.previewId : null;
    if (previewId) {
      await prisma.subscriptionChange.updateMany({
        where: { id: previewId, organizationId },
        data: { status: 'FAILED', processingError: err instanceof Error ? err.message.slice(0, 1000) : 'Unknown failure' },
      });
    }
    res.status(500).json({ error: 'SUBSCRIPTION_CHANGE_FAILED' });
  }
});

app.post(['/billing/organizations/:orgId/subscription/cancel', '/billing/subscriptions/cancel'], verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const orgId = requestOrganizationId(req);
  if (!orgId) return res.status(400).json({ error: 'organizationId is required' });

  try {
    const freePlan = await prisma.plan.findUnique({ where: { type: PlanType.FREE } });
    if (!freePlan) return res.status(500).json({ error: 'FREE_PLAN_NOT_CONFIGURED' });
    const current = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!current) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    if (current.activeProvider === 'PAYSTACK' && current.providerSubscriptionId) {
      if (!current.providerManagementToken) return res.status(409).json({ error: 'PROVIDER_MANAGEMENT_TOKEN_MISSING' });
      await disablePaystackSubscription(current.providerSubscriptionId, openPaymentReference(current.providerManagementToken));
    } else if (current.activeProvider === 'STRIPE' && current.providerSubscriptionId) {
      await setStripeCancellation(current.providerSubscriptionId, true);
    } else if (current.activeProvider === 'FLUTTERWAVE' && current.providerSubscriptionId) {
      await cancelFlutterwaveSubscription(current.providerSubscriptionId);
    } else if (current.activeProvider === 'MOCK' && process.env.NODE_ENV !== 'production') {
      // The deterministic provider has no remote subscription to disable.
    } else {
      return res.status(409).json({ error: 'PROVIDER_SUBSCRIPTION_NOT_LINKED' });
    }
    const subscription = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        cancelledAt: new Date(),
        pendingPlanId: freePlan.id,
        pendingChangeAt: current.currentPeriodEnd,
        cancelAtPeriodEnd: true,
      },
      include: { plan: true, pendingPlan: true },
    });
    await recordPaymentEvent(orgId, (current.activeProvider || 'PAYSTACK') as Provider, 'subscription.cancellation_scheduled', { source: 'api', effectiveAt: current.currentPeriodEnd });

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

app.post('/billing/subscriptions/resume', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  try {
    const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription?.cancelAtPeriodEnd) return res.status(409).json({ error: 'CANCELLATION_NOT_SCHEDULED' });
    if (subscription.activeProvider === 'PAYSTACK' && subscription.providerSubscriptionId) {
      if (!subscription.providerManagementToken) return res.status(409).json({ error: 'PROVIDER_MANAGEMENT_TOKEN_MISSING' });
      await enablePaystackSubscription(subscription.providerSubscriptionId, openPaymentReference(subscription.providerManagementToken));
    } else if (subscription.activeProvider === 'STRIPE' && subscription.providerSubscriptionId) {
      await setStripeCancellation(subscription.providerSubscriptionId, false);
    } else if (subscription.activeProvider === 'FLUTTERWAVE' && subscription.providerSubscriptionId) {
      await activateFlutterwaveSubscription(subscription.providerSubscriptionId);
    } else if (subscription.activeProvider === 'MOCK' && process.env.NODE_ENV !== 'production') {
      // The deterministic provider has no remote subscription to resume.
    } else {
      return res.status(409).json({ error: 'PROVIDER_SUBSCRIPTION_NOT_LINKED' });
    }
    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: { cancelAtPeriodEnd: false, cancelledAt: null, pendingPlanId: null, pendingChangeAt: null },
    });
    res.json(updated);
  } catch (err) {
    console.error('[BillingAPI] Resume subscription failed', err);
    res.status(500).json({ error: 'SUBSCRIPTION_RESUME_FAILED' });
  }
});

app.post(['/billing/payment-method/session', '/billing/subscriptions/migration/paystack/authorize'], verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  try {
    const [subscription, profile] = await Promise.all([
      prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
      prisma.organizationBillingProfile.findUnique({ where: { organizationId } }),
    ]);
    if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    const isMigration = req.path.includes('/migration/paystack/authorize');
    if (isMigration && subscription.activeProvider !== 'STRIPE') {
      return res.status(409).json({ error: 'STRIPE_SUBSCRIPTION_REQUIRED' });
    }
    const billingEmail = profile?.billingEmail || '';
    if (!billingEmail) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
    const reference = `payment-method-${organizationId}-${Date.now()}`;
    const result = await initializeTransaction({
      email: billingEmail,
      amountKobo: subscription.billingCurrency === BillingCurrency.NGN ? 5_000 : 200,
      currency: subscription.billingCurrency,
      reference,
      organizationId,
      metadata: { purpose: isMigration ? 'STRIPE_MIGRATION' : 'PAYMENT_METHOD_UPDATE', organizationId },
      callbackUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
    });
    res.status(201).json({ provider: 'PAYSTACK', checkoutUrl: result.authorizationUrl, reference: result.reference });
  } catch (err) {
    console.error('[BillingAPI] Payment method session failed', err);
    res.status(500).json({ error: 'PAYMENT_METHOD_SESSION_FAILED' });
  }
});

app.get('/billing/subscriptions/migration/status', verifyJwt, requireBillingViewer, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
  const migration = await prisma.subscriptionChange.findFirst({
    where: { organizationId, direction: 'MIGRATION' },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    migrationStatus: subscription.migrationStatus,
    activeProvider: subscription.activeProvider,
    effectiveAt: migration?.effectiveAt ?? null,
    status: migration?.status ?? null,
    authorizationRequired: subscription.activeProvider === 'STRIPE' && subscription.migrationStatus !== 'PAYSTACK_AUTHORIZED',
  });
});

app.post('/billing/subscriptions/retry', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  const attempt = await prisma.billingDunningAttempt.findFirst({
    where: { organizationId, status: 'SCHEDULED' },
    orderBy: { attemptNumber: 'asc' },
  });
  if (!attempt) return res.status(404).json({ error: 'NO_PAYMENT_RETRY_AVAILABLE' });
  const updated = await prisma.billingDunningAttempt.update({
    where: { id: attempt.id },
    data: { scheduledAt: new Date() },
  });
  res.status(202).json({ status: 'RETRY_SCHEDULED', attemptId: updated.id });
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.BILLING_API;
app.listen(PORT, () => {
  console.log(`[BillingAPI] Running on port ${PORT}`);
});
