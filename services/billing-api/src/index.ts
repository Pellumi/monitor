import { initTracing } from '@tellann/telemetry';
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
} from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { PLAN_DEFINITIONS, Services, type PlanTypeKey } from '@tellann/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@tellann/email';
import { writeAuditLog, extractAuditContext } from '@tellann/authz';
import {
  chargeAuthorization,
  createSubscription as createPaystackSubscription,
  disableSubscription as disablePaystackSubscription,
  enableSubscription as enablePaystackSubscription,
  initializeTransaction,
  verifyPaystackWebhook,
} from './providers/paystack';
import { applyTax } from './tax';
import { buildInvoiceDocument, deliverInvoiceDocument, formatMoney } from './invoicing';
import { GRACE_PERIOD_DAYS, TRIAL_DAYS, addDays, runBillingCycle } from './renewal';
import {
  activateFlutterwaveSubscription,
  cancelFlutterwaveSubscription,
  chargeFlutterwaveToken,
  createFlutterwaveCheckout,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhook,
} from './providers/flutterwave';
import type { LiveBillingProvider } from './billing-policy';
import {
  billingPolicy,
  checkoutProviders,
  currencyForCountry,
  eligibleProviders,
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
const JWT_SECRET = process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production';

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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-tellann-org-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

type Provider = 'PAYSTACK' | 'FLUTTERWAVE' | 'MOCK';

/**
 * Processors that settle NGN (BSS §8). The Local plan is NGN-only, so it may
 * only check out through one of these — plus MOCK in non-production.
 */
const NGN_PROVIDERS: Provider[] = ['PAYSTACK', 'FLUTTERWAVE', 'MOCK'];

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
  const headerOrgId = req.headers['x-tellann-org-id'];
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

/**
 * Attaches req.user when a valid token is present but never rejects. Used by the
 * plan catalog, which is browsable anonymously yet localizes to the signed-in
 * user's billing country when one is available.
 */
function optionalJwt(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    req.user = { id: decoded.sub, email: decoded.email };
  } catch {
    // An expired token simply means "no billing identity" for catalog purposes.
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing identity (user-scoped)
//
// The payer of record is a user, not an organization. Their UserBillingProfile
// supplies the ISO billing country — which determines currency, plan
// eligibility (Local is NG-only), and provider routing — along with the contact
// details providers require and the provider customer handles we reuse across
// every organization that user pays for.
// ─────────────────────────────────────────────────────────────────────────────

type BillingIdentity = NonNullable<Awaited<ReturnType<typeof loadBillingIdentity>>>;

async function loadBillingIdentity(userId: string | null | undefined) {
  if (!userId) return null;
  return prisma.userBillingProfile.findUnique({ where: { userId } });
}

/**
 * Resolves the billing identity governing an existing subscription. The
 * subscription's recorded payer wins; the requesting user is the fallback for
 * subscriptions created before payer attribution existed, and that fallback is
 * persisted so later calls are stable.
 */
async function resolveSubscriptionPayer(
  subscription: { organizationId: string; payerUserId: string | null } | null,
  requestingUserId: string | null | undefined,
) {
  const recorded = await loadBillingIdentity(subscription?.payerUserId);
  if (recorded) return recorded;

  const fallback = await loadBillingIdentity(requestingUserId);
  if (fallback && subscription && !subscription.payerUserId) {
    await prisma.subscription.update({
      where: { organizationId: subscription.organizationId },
      data: { payerUserId: fallback.userId },
    });
  }
  return fallback;
}

/** Providers require a contactable address; fall back to the account email. */
function payerEmail(identity: BillingIdentity | null, req: AuthenticatedRequest): string {
  return identity?.billingEmail?.trim() || req.user?.email?.trim() || '';
}

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

/**
 * Raises an invoice with tax broken out per the payer's jurisdiction (BSS §17).
 *
 * `listPrice` is the catalog price in minor units. Every invoice in the system
 * goes through here so the tax treatment can never diverge between checkout,
 * a plan change, a trial conversion, and a renewal.
 */
async function createBillingInvoice(params: {
  organizationId: string;
  payerUserId: string | null;
  planType: PlanType;
  interval: BillingInterval;
  currency: BillingCurrency;
  listPrice: number;
  countryCode: string | null;
  provider: Provider;
  periodStart: Date;
  periodEnd: Date;
  reason: string;
}) {
  const taxed = applyTax(params.listPrice, params.countryCode);
  return prisma.invoice.create({
    data: {
      organizationId: params.organizationId,
      payerUserId: params.payerUserId,
      invoiceNumber: invoiceNumber(),
      planType: params.planType,
      billingInterval: params.interval,
      currency: params.currency,
      subtotal: taxed.subtotal,
      tax: taxed.tax,
      taxRate: taxed.taxRate,
      taxLabel: taxed.taxLabel,
      taxJurisdiction: taxed.taxJurisdiction,
      total: taxed.total,
      status: taxed.total === 0 ? 'PAID' : 'PENDING',
      provider: params.provider,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      reason: params.reason,
    },
  });
}

async function deliverInvoiceEmail(invoiceId: string): Promise<void> {
  return deliverInvoiceDocument({ prisma, emailService }, invoiceId);
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
  /** Payer of record. Carried from the invoice that funded this activation. */
  payerUserId?: string | null;
}) {
  const now = new Date();
  const end = periodEnd(params.interval);

  await prisma.subscription.upsert({
    where: { organizationId: params.organizationId },
    create: {
      organizationId: params.organizationId,
      payerUserId: params.payerUserId ?? null,
      planId: params.plan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: params.interval,
      billingCurrency: params.currency,
      currentPeriodStart: now,
      currentPeriodEnd: end,
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
    },
    update: {
      payerUserId: params.payerUserId ?? undefined,
      planId: params.plan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: params.interval,
      billingCurrency: params.currency,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelledAt: null,
      suspendedAt: null,
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
    },
  });

  // Provider customer handles belong to the payer, so a user who pays for more
  // than one organization reuses a single customer record at each processor.
  if (params.payerUserId && params.providerCustomerId) {
    const handle = params.provider === 'PAYSTACK'
      ? { paystackCustomerCode: params.providerCustomerId }
      : params.provider === 'FLUTTERWAVE'
        ? { flutterwaveCustomerId: params.providerCustomerId }
        : null;
    if (handle) {
      await prisma.userBillingProfile.updateMany({ where: { userId: params.payerUserId }, data: handle });
    }
  }

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

/**
 * Starts a free trial once the payer's card has been authorized.
 *
 * This runs from the webhook rather than the request handler on purpose: only
 * the processor can confirm the card is chargeable, and a trial that starts
 * without a chargeable card is a trial that silently fails to convert. The
 * trial history row is written in the same transaction as the subscription, so
 * the "one trial per payer" rule can never be lost to a partial write.
 */
async function startTrialFromAuthorization(
  event: NormalizedBillingEvent,
  metadata: Record<string, any>,
  paymentMethod: Record<string, any>,
): Promise<void> {
  const organizationId = event.organizationId;
  const payerUserId = firstString(metadata.payerUserId);
  const planType = assertEnumValue(PlanType, metadata.planType) ?? PlanType.SOLO;
  const interval = assertEnumValue(BillingInterval, metadata.billingInterval) ?? BillingInterval.MONTHLY;
  const currency = assertEnumValue(BillingCurrency, metadata.currency) ?? BillingCurrency.USD;

  const [plan, existingTrial] = await Promise.all([
    prisma.plan.findUnique({ where: { type: planType } }),
    prisma.subscriptionTrialHistory.findFirst({
      where: { OR: [{ organizationId }, ...(payerUserId ? [{ userId: payerUserId }] : [])] },
    }),
  ]);
  if (!plan) throw new Error(`Trial plan ${planType} is not configured`);
  if (existingTrial) {
    // The authorization succeeded but the trial was already consumed. Keep the
    // card on file — it is still useful — and stop short of granting a second.
    await prisma.subscription.updateMany({ where: { organizationId }, data: paymentMethod });
    console.warn(`[BillingAPI] Ignoring duplicate trial authorization for ${organizationId}`);
    return;
  }

  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        payerUserId,
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: interval,
        billingCurrency: currency,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialStartedAt: now,
        trialEndsAt,
        // The trial converts on this date; the renewal worker owns the charge.
        nextBillingAt: trialEndsAt,
        nonRenewing: false,
        cancelAtPeriodEnd: false,
        ...paymentMethod,
      },
      update: {
        payerUserId: payerUserId ?? undefined,
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        billingInterval: interval,
        billingCurrency: currency,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialStartedAt: now,
        trialEndsAt,
        nextBillingAt: trialEndsAt,
        nonRenewing: false,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        graceEndsAt: null,
        billingFailureCount: 0,
        ...paymentMethod,
      },
    });

    await tx.subscriptionTrialHistory.create({
      data: {
        organizationId,
        userId: payerUserId,
        planType: plan.type,
        startedAt: now,
        endedAt: trialEndsAt,
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  await entitlementChecker.resolveEntitlement(organizationId);

  const listPrice = priceFor(plan, interval, currency);
  const profile = payerUserId ? await loadBillingIdentity(payerUserId) : null;
  const taxed = applyTax(listPrice, profile?.countryCode ?? null);
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  await emailService.sendToOrganizationMembers({
    templateKey: 'billing-trial-started',
    organizationId,
    eventType: 'BILLING_TRIAL_STARTED',
    severity: 'LOW',
    variables: {
      organizationName: organization?.name ?? 'your organization',
      planName: plan.name,
      trialEndsOn: trialEndsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      firstChargeAmount: formatMoney(taxed.total, currency),
      billingUrl: appUrl('/settings/billing'),
    },
    idempotencyKey: buildIdempotencyKey(['trial-started', organizationId, trialEndsAt.toISOString()]),
    roles: [MemberRole.OWNER, MemberRole.ADMIN],
  }).catch((err) => console.error('[Email] billing-trial-started send failed', err));

  await writeAuditLog(prisma, {
    action: AuditAction.SUBSCRIPTION_ACTIVATED,
    organizationId,
    userId: payerUserId,
    metadata: { planType: plan.type, trial: true, trialEndsAt: trialEndsAt.toISOString() },
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

app.get('/billing/plans', optionalJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const [profile, subscription, plans] = await Promise.all([
      // Billing country comes from the signed-in user, never the organization.
      loadBillingIdentity(req.user?.id),
      orgId ? prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } }) : null,
      prisma.plan.findMany({
        where: { isPublic: true },
        include: { featureFlags: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const countryCode = profile?.countryCode ?? null;
    const currency = currencyForCountry(countryCode);
    const currentRank = subscription ? PLAN_DEFINITIONS[subscription.plan.type as PlanTypeKey]?.rank ?? 0 : 0;
    // Processors that can settle this payer's currency, in preference order.
    // NGN payers get a real choice (BSS §8), so the UI can offer one.
    const availableProviders = countryCode ? checkoutProviders(currency) : [];
    res.json({
      currency,
      countryRequired: !countryCode,
      availableProviders,
      defaultProvider: availableProviders[0] ?? null,
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

// ── Billing profile — user-scoped ───────────────────────────────────────────
// No organization role is required: a user owns their own billing identity and
// carries it into every organization they pay for.

app.get('/billing/users/me/profile', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const profile = await loadBillingIdentity(req.user!.id);
  if (!profile) return res.json(null);
  const { paystackCustomerCode, flutterwaveCustomerId, ...safe } = profile;
  res.json(safe);
});

app.put('/billing/users/me/profile', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const countryCode = String(req.body.countryCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return res.status(400).json({ error: 'INVALID_COUNTRY', message: 'countryCode must be an ISO 3166-1 alpha-2 code.' });
  }

  // Leaving NG would strand any Local subscription this user pays for, because
  // Local is NGN-only. Block the change until those move to a global plan.
  if (countryCode !== 'NG') {
    const localSubscription = await prisma.subscription.findFirst({
      where: { payerUserId: userId, plan: { type: PlanType.LOCAL } },
      include: { organization: { select: { name: true } } },
    });
    if (localSubscription) {
      return res.status(409).json({
        error: 'LOCAL_COUNTRY_LOCKED',
        message: `Move ${localSubscription.organization.name} off the Local plan before changing your billing country from Nigeria.`,
      });
    }
  }

  const data = {
    countryCode,
    legalName: req.body.legalName || null,
    billingEmail: req.body.billingEmail || req.user!.email || null,
    addressLine1: req.body.addressLine1 || null,
    addressLine2: req.body.addressLine2 || null,
    city: req.body.city || null,
    region: req.body.region || null,
    postalCode: req.body.postalCode || null,
    taxId: req.body.taxId || null,
  };
  const profile = await prisma.userBillingProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  // Audit against every organization this user pays for — billing country is an
  // organization-visible commercial fact even though it is owned by the user.
  const payingFor = await prisma.subscription.findMany({
    where: { payerUserId: userId },
    select: { organizationId: true },
  });
  const auditTargets: Array<string | null> = payingFor.length ? payingFor.map((s) => s.organizationId) : [null];
  for (const organizationId of auditTargets) {
    await writeAuditLog(prisma, {
      action: AuditAction.BILLING_PROFILE_UPDATED,
      userId,
      organizationId,
      metadata: { countryCode, scope: 'USER' },
    });
  }

  const { paystackCustomerCode, flutterwaveCustomerId, ...safe } = profile;
  res.json(safe);
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

// ── Free trial (BSS §10) ────────────────────────────────────────────────────
// A new account authorizes a card, gets the Solo plan free for 14 days — Local
// instead when they bill from Nigeria, since Local is the NGN entry plan — and
// is charged only when the trial converts. The card is verified up front so the
// conversion is unattended; nothing is charged for the plan until day 14.

/** The plan a trial grants, given where the payer bills from. */
function trialPlanTypeFor(countryCode: string): PlanType {
  return countryCode.toUpperCase() === 'NG' ? PlanType.LOCAL : PlanType.SOLO;
}

app.get('/billing/trial/eligibility', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const userId = req.user!.id;
  try {
    const profile = await loadBillingIdentity(userId);
    const [priorTrial, subscription] = await Promise.all([
      prisma.subscriptionTrialHistory.findFirst({
        where: { OR: [{ userId }, ...(organizationId ? [{ organizationId }] : [])] },
      }),
      organizationId
        ? prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } })
        : null,
    ]);

    const countryCode = profile?.countryCode ?? null;
    const planType = countryCode ? trialPlanTypeFor(countryCode) : PlanType.SOLO;
    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    const currency = currencyForCountry(countryCode);
    const listPrice = plan ? priceFor(plan, BillingInterval.MONTHLY, currency) : 0;
    const taxed = applyTax(listPrice, countryCode);

    const alreadyPaid = Boolean(subscription && subscription.plan.type !== PlanType.FREE);
    const reason = !countryCode
      ? 'BILLING_COUNTRY_REQUIRED'
      : priorTrial
        ? 'TRIAL_ALREADY_USED'
        : alreadyPaid
          ? 'ALREADY_SUBSCRIBED'
          : null;

    res.json({
      eligible: reason === null,
      reason,
      trialDays: TRIAL_DAYS,
      planType,
      planName: plan?.name ?? null,
      currency,
      firstChargeAmount: taxed.total,
      firstChargeFormatted: formatMoney(taxed.total, currency),
      firstChargeOn: addDays(new Date(), TRIAL_DAYS),
      availableProviders: countryCode ? checkoutProviders(currency) : [],
    });
  } catch (err) {
    console.error('[BillingAPI] Trial eligibility check failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Begins card authorization for a trial. The payer is sent to the processor to
 * authorize a nominal amount; the trial itself starts when that authorization
 * confirms by webhook, so a trial can never begin without a chargeable card.
 */
app.post('/billing/trial/start', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const userId = req.user!.id;
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

  try {
    const profile = await loadBillingIdentity(userId);
    if (!profile?.countryCode) {
      return res.status(400).json({
        error: 'BILLING_COUNTRY_REQUIRED',
        message: 'Add your billing details before starting a trial.',
      });
    }

    const priorTrial = await prisma.subscriptionTrialHistory.findFirst({
      where: { OR: [{ userId }, { organizationId }] },
    });
    if (priorTrial) {
      return res.status(409).json({
        error: 'TRIAL_ALREADY_USED',
        message: 'A free trial has already been used on this account.',
      });
    }

    const existing = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (existing && existing.plan.type !== PlanType.FREE) {
      return res.status(409).json({ error: 'ALREADY_SUBSCRIBED' });
    }

    const currency = currencyForCountry(profile.countryCode);
    const planType = trialPlanTypeFor(profile.countryCode);
    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) return res.status(503).json({ error: 'PLAN_NOT_CONFIGURED' });

    const candidates = checkoutProviders(currency);
    const requested = String(req.body.provider ?? '').toUpperCase() as LiveBillingProvider;
    const provider: LiveBillingProvider = requested && candidates.includes(requested)
      ? requested
      : candidates[0];
    if (!provider) return res.status(503).json({ error: 'NO_PROVIDER_FOR_CURRENCY' });

    const planCode = await providerPlanCode(prisma, provider, planType, BillingInterval.MONTHLY, currency);
    if (!planCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED' });

    const email = payerEmail(profile, req);
    if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });

    // A nominal authorization that proves the card works and yields a reusable
    // credential. It is not the subscription charge — that comes on day 14.
    const verificationAmount = currency === BillingCurrency.NGN ? 5_000 : 100;
    const reference = `trial-auth-${organizationId}-${Date.now()}`;
    const metadata = {
      purpose: 'TRIAL_AUTHORIZATION',
      organizationId,
      payerUserId: userId,
      planType,
      billingInterval: BillingInterval.MONTHLY,
      currency,
    };

    const checkoutUrl = provider === 'FLUTTERWAVE'
      ? (await createFlutterwaveCheckout({
          txRef: reference,
          amount: verificationAmount,
          currency,
          customerEmail: email,
          customerName: profile.legalName,
          organizationId,
          planCode,
          redirectUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
          metadata,
        })).checkoutUrl
      : (await initializeTransaction({
          email,
          amountKobo: verificationAmount,
          currency,
          reference,
          organizationId,
          metadata,
          callbackUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
        })).authorizationUrl;

    await recordPaymentEvent(organizationId, provider, 'trial.authorization_started', {
      planType, currency, provider, reference,
    });

    return res.status(201).json({
      status: 'AUTHORIZATION_REQUIRED',
      provider,
      checkoutUrl,
      reference,
      planType,
      planName: plan.name,
      trialDays: TRIAL_DAYS,
      trialEndsOn: addDays(new Date(), TRIAL_DAYS),
    });
  } catch (err) {
    console.error('[BillingAPI] Trial start failed', err);
    return res.status(500).json({ error: 'TRIAL_START_FAILED' });
  }
});

// ── Internal: recurring billing cycle ───────────────────────────────────────
// Driven by the background-workers scheduler so exactly one process owns the
// schedule. Charging lives here because the processor clients, tax rules, and
// invoice delivery all do.

app.post('/billing/internal/billing-cycle', async (req: Request, res: Response) => {
  const secret = process.env.BILLING_INTERNAL_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({
      error: 'BILLING_INTERNAL_SECRET_NOT_CONFIGURED',
      message: 'Set BILLING_INTERNAL_SECRET so the scheduler can drive the billing cycle.',
    });
  }
  if (req.headers['x-tellann-internal-secret'] !== secret) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  try {
    const result = await runBillingCycle({ prisma, emailService, entitlementChecker });
    return res.json(result);
  } catch (err) {
    console.error('[BillingAPI] Billing cycle failed', err);
    return res.status(500).json({ error: 'BILLING_CYCLE_FAILED' });
  }
});

// ── Invoice documents (BSS §18) ─────────────────────────────────────────────
// The same record downloads as an invoice while unpaid and a receipt once paid,
// so a payer always has a document for what they were charged.

app.get('/billing/invoices/:invoiceId/document', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
      select: { id: true, organizationId: true, payerUserId: true },
    });
    if (!invoice) return res.status(404).json({ error: 'INVOICE_NOT_FOUND' });

    // The payer always reaches their own document. Anyone else must be an
    // owner or admin of the organization the invoice was raised against.
    if (invoice.payerUserId !== req.user!.id) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: req.user!.id, organizationId: invoice.organizationId } },
      });
      const billingRoles: MemberRole[] = [MemberRole.OWNER, MemberRole.ADMIN];
      if (!membership || !billingRoles.includes(membership.role)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    const built = await buildInvoiceDocument(prisma, invoice.id);
    if (!built) return res.status(404).json({ error: 'INVOICE_NOT_FOUND' });

    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${built.filename}"`);
    res.setHeader('Content-Length', String(built.pdf.length));
    return res.send(built.pdf);
  } catch (err) {
    console.error('[BillingAPI] Invoice document generation failed', err);
    return res.status(500).json({ error: 'INVOICE_DOCUMENT_FAILED' });
  }
});

/** Re-sends the document to the organization's billing contacts on request. */
app.post('/billing/invoices/:invoiceId/send', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
  if (!invoice || invoice.organizationId !== organizationId) {
    return res.status(404).json({ error: 'INVOICE_NOT_FOUND' });
  }
  try {
    await deliverInvoiceDocument({ prisma, emailService }, invoice.id);
    return res.status(202).json({ status: 'SENT', invoiceId: invoice.id });
  } catch (err) {
    console.error('[BillingAPI] Invoice resend failed', err);
    return res.status(500).json({ error: 'INVOICE_SEND_FAILED' });
  }
});

app.post(['/billing/checkout', '/billing/subscriptions/checkout'], verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.body.organizationId || req.headers['x-tellann-org-id'];
  const payerUserId = req.user!.id;
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
    // The signed-in user is the payer of record; their billing country drives
    // currency, plan eligibility, and provider routing.
    const profile = await loadBillingIdentity(payerUserId);
    const countryCode = profile?.countryCode ?? null;
    if (!countryCode) {
      return res.status(400).json({ error: 'BILLING_COUNTRY_REQUIRED', message: 'Complete your billing profile before checkout.' });
    }
    currency = currencyForCountry(countryCode);
    const candidates = checkoutProviders(currency);
    if (!candidates.length) {
      return res.status(503).json({
        error: 'NO_PROVIDER_FOR_CURRENCY',
        message: `No payment processor is enabled for ${currency}.`,
      });
    }

    // A caller may name a processor (the billing UI offers the eligible list so
    // a payer can pick Paystack vs Flutterwave for NGN). Outside production the
    // deterministic MOCK processor is also selectable when explicitly enabled.
    const allowTestOverride = process.env.NODE_ENV !== 'production'
      && process.env.BILLING_ALLOW_TEST_PROVIDER_OVERRIDE === 'true';
    const selectable: Provider[] = [
      ...eligibleProviders(currency),
      ...(allowTestOverride ? (['MOCK'] as Provider[]) : []),
    ];
    const requestedProvider = String(req.body.provider ?? '').toUpperCase() as Provider;
    if (requestedProvider) {
      if (!selectable.includes(requestedProvider)) {
        return res.status(400).json({ error: 'PROVIDER_NOT_ELIGIBLE', eligibleProviders: selectable });
      }
      provider = requestedProvider;
    } else {
      provider = candidates[0];
    }
    if (planType === PlanType.LOCAL) {
      if (countryCode !== 'NG' || currency !== BillingCurrency.NGN || !NGN_PROVIDERS.includes(provider)) {
        return res.status(400).json({
          error: 'LOCAL_PLAN_INELIGIBLE',
          message: 'Local is available only to payers billed in Nigeria, in NGN, through a Nigerian payment processor.',
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

    const invoice = await createBillingInvoice({
      organizationId,
      payerUserId,
      planType,
      interval,
      currency,
      listPrice: total,
      countryCode,
      provider,
      periodStart: now,
      periodEnd: end,
      reason: 'SUBSCRIPTION',
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

    // ── Live processors, with failover across the eligible list ────────────
    // Both Nigerian processors settle NGN, so an outage at the primary degrades
    // to the other rather than failing the checkout. When the payer named a
    // processor explicitly we honour that choice and do not silently switch.
    const email = payerEmail(profile, req);
    if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });

    const attemptOrder: Provider[] = requestedProvider
      ? [provider]
      : [provider, ...candidates.filter((candidate) => candidate !== provider)];

    let lastError: unknown = null;
    let missingPlanCode: Provider | null = null;

    for (const candidate of attemptOrder) {
      const planCode = await providerPlanCode(prisma, candidate as LiveBillingProvider, planType, interval, currency);
      if (!planCode) {
        missingPlanCode = candidate;
        continue;
      }
      const reference = `tellann-${invoice.id}-${Date.now()}`;

      try {
        if (candidate === 'FLUTTERWAVE') {
          const checkout = await createFlutterwaveCheckout({
            txRef: reference, amount: invoice.total, currency, customerEmail: email,
            customerName: profile?.legalName, organizationId, planCode,
            redirectUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
            metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency },
          });
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { provider: candidate, providerReference: reference },
          });
          return res.status(201).json({
            checkoutId: invoice.id, invoiceId: invoice.id, provider: candidate,
            ...(candidate !== provider ? { fallbackFrom: provider } : {}),
            status: 'pending', checkoutUrl: checkout.checkoutUrl, url: checkout.checkoutUrl,
            providerReference: reference,
          });
        }

        const { authorizationUrl, reference: paystackReference } = await initializeTransaction({
          email,
          // Paystack works in the lowest denomination (kobo for NGN).
          amountKobo: Math.round(invoice.total),
          currency,
          reference,
          organizationId,
          planCode,
          metadata: { invoiceId: invoice.id, planType, billingInterval: interval, currency },
          callbackUrl: checkoutReturnUrl(req.body.successUrl, invoice.id),
        });
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { provider: 'PAYSTACK', providerReference: paystackReference, paystackRef: paystackReference },
        });
        return res.status(201).json({
          checkoutId: invoice.id, invoiceId: invoice.id, provider: 'PAYSTACK',
          ...(candidate !== provider ? { fallbackFrom: provider } : {}),
          status: 'pending', checkoutUrl: authorizationUrl, authorizationUrl,
          providerReference: paystackReference,
        });
      } catch (cause) {
        lastError = cause;
        await recordPaymentEvent(organizationId, candidate, 'checkout.initialization_failed', {
          invoiceId: invoice.id,
          message: cause instanceof Error ? cause.message : String(cause),
        }, { invoiceId: invoice.id });
      }
    }

    if (lastError) throw lastError;
    return res.status(503).json({
      error: 'PROVIDER_PLAN_NOT_CONFIGURED',
      message: `No processor has a configured plan for ${planType}/${interval}/${currency}.`,
      lastChecked: missingPlanCode,
    });

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

  if (!['PAYSTACK', 'FLUTTERWAVE', 'MOCK'].includes(provider)) {
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
    const paymentMethodPurpose = firstString(eventMetadata.purpose, asRecord(eventData.meta).purpose);
    // A card authorization is not a subscription payment. Both processors run
    // one to capture a reusable credential — for a card change, and for the
    // trial, where it is the only thing standing between "signed up" and
    // "chargeable on day 14".
    const isCardAuthorization = paymentMethodPurpose === 'PAYMENT_METHOD_UPDATE'
      || paymentMethodPurpose === 'TRIAL_AUTHORIZATION';
    const isPaymentMethodUpdate = isCardAuthorization;

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

    if (isCardAuthorization && isActivationEvent(event)) {
      // Each processor names the reusable credential differently: Paystack
      // returns an authorization code, Flutterwave a card token. Both are
      // sealed and stored in the same field, keyed by activeProvider.
      const authorization = asRecord(eventData.authorization);
      const card = asRecord(eventData.card);
      const credential = provider === 'FLUTTERWAVE'
        ? firstString(card.token, eventData.token)
        : firstString(authorization.authorization_code);
      if (!credential) {
        throw new Error(`${provider} card authorization did not return a reusable credential`);
      }

      const cardBrand = firstString(authorization.brand, authorization.card_type, card.type);
      const cardLast4 = firstString(authorization.last4, card.last_4digits);
      const expiry = String(card.expiry ?? '').split('/');
      const paymentMethod = {
        activeProvider: provider,
        providerCustomerId: event.customerId ?? undefined,
        paymentMethodReference: sealPaymentReference(credential),
        paymentMethodBrand: cardBrand,
        paymentMethodLast4: cardLast4,
        paymentMethodExpMonth: firstString(authorization.exp_month, expiry[0]),
        paymentMethodExpYear: firstString(authorization.exp_year, expiry[1]),
        paymentMethodAuthorizedAt: new Date(),
      };

      if (paymentMethodPurpose === 'TRIAL_AUTHORIZATION') {
        await startTrialFromAuthorization(event, eventMetadata, paymentMethod);
      } else {
        await prisma.subscription.update({
          where: { organizationId: event.organizationId },
          data: paymentMethod,
        });
      }
    }

    if (isActivationEvent(event) && !isPaymentMethodUpdate) {
      validateInvoicePayment(event, reconciledInvoice);
      paidInvoice = await reconcileInvoiceForEvent(event, 'PAID');
      reconciledInvoice = paidInvoice ?? reconciledInvoice;

      // A pending change is matched either by the provider subscription it
      // created (Paystack swaps in place) or by the payment reference of the
      // re-authorization checkout it issued (Flutterwave re-checkouts).
      const changeMatchers: Array<Record<string, unknown>> = [];
      if (event.subscriptionId) changeMatchers.push({ providerOperationId: event.subscriptionId });
      if (event.providerReference) changeMatchers.push({ providerReference: event.providerReference });
      const scheduledProviderChange = changeMatchers.length
        ? await prisma.subscriptionChange.findFirst({
            where: {
              organizationId: event.organizationId,
              status: { in: ['SCHEDULED', 'PROCESSING', 'PAYMENT_ACTION_REQUIRED'] },
              OR: changeMatchers,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      // Captured before activation overwrites it — a Flutterwave plan change
      // leaves the superseded subscription running until the replacement is
      // confirmed, and it must be cancelled or the payer is billed twice.
      const supersededSubscription = scheduledProviderChange
        ? await prisma.subscription.findUnique({
            where: { organizationId: event.organizationId },
            select: { activeProvider: true, providerSubscriptionId: true },
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
        // The invoice that funded this activation carries the payer of record.
        payerUserId: reconciledInvoice?.payerUserId ?? null,
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
        if (supersededSubscription?.activeProvider === 'FLUTTERWAVE'
            && supersededSubscription.providerSubscriptionId
            && supersededSubscription.providerSubscriptionId !== event.subscriptionId) {
          try {
            await cancelFlutterwaveSubscription(supersededSubscription.providerSubscriptionId);
          } catch (cause) {
            // Never fail the activation over this — the payer has already been
            // charged. Surface it for reconciliation instead.
            console.error('[BillingAPI] Failed to cancel superseded Flutterwave subscription', cause);
            await recordPaymentEvent(event.organizationId, 'FLUTTERWAVE', 'subscription.superseded_cancellation_failed', {
              supersededSubscriptionId: supersededSubscription.providerSubscriptionId,
              replacementSubscriptionId: event.subscriptionId,
              subscriptionChangeId: scheduledProviderChange.id,
            });
          }
        }
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

      // The document (invoice or receipt, per status) is emailed with the PDF
      // attached and remains downloadable from the billing page.
      if (paidInvoice) {
        void deliverInvoiceDocument({ prisma, emailService }, paidInvoice.id)
          .catch((err) => console.error('[BillingAPI] Invoice document delivery failed (non-fatal)', err));
      }
    }

    if (isPaymentFailureEvent(event)) {
      const failedInvoice = await reconcileInvoiceForEvent(event, 'FAILED');
      const subscription = await prisma.subscription.findUnique({ where: { organizationId: event.organizationId } });

      // A failed charge starts the grace period (BSS §14). The payer keeps full
      // plan access for the whole window and the billing cycle retries daily
      // against the card on file; only if the window elapses are they scaled
      // down to Free. Preserve an in-flight window rather than extending it on
      // every failed retry, otherwise grace never actually ends.
      const graceEndsAt = subscription?.graceEndsAt ?? addDays(new Date(), GRACE_PERIOD_DAYS);
      await prisma.subscription.updateMany({
        where: { organizationId: event.organizationId },
        data: {
          status: SubscriptionStatus.GRACE_PERIOD,
          graceEndsAt,
          nextBillingAt: addDays(new Date(), 1),
          billingFailureCount: { increment: 1 },
        },
      });

      // Recorded for the dunning history the billing page surfaces. The retry
      // itself belongs to the billing cycle — this is bookkeeping, not a queue.
      const retryAmount = failedInvoice?.total ?? (subscription
        ? priceFor(
            await prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } }),
            subscription.billingInterval,
            subscription.billingCurrency,
          )
        : 0);
      const retryReference = event.providerReference ?? event.providerEventId;
      const attemptNumber = (subscription?.billingFailureCount ?? 0) + 1;
      await prisma.billingDunningAttempt.upsert({
        where: {
          organizationId_providerReference_attemptNumber: {
            organizationId: event.organizationId,
            providerReference: retryReference,
            attemptNumber,
          },
        },
        create: {
          organizationId: event.organizationId,
          invoiceId: failedInvoice?.id,
          provider,
          providerReference: retryReference,
          attemptNumber,
          scheduledAt: addDays(new Date(), 1),
          amount: Number(retryAmount),
          currency: subscription?.billingCurrency ?? event.currency ?? BillingCurrency.USD,
          idempotencyKey: `dunning:${event.organizationId}:${retryReference}:${attemptNumber}`,
        },
        update: {},
      });

      await entitlementChecker.resolveEntitlement(event.organizationId);

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
app.post('/billing/subscriptions/changes/preview', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const targetPlanType = assertEnumValue(PlanType, req.body.planType);
  const targetInterval = assertEnumValue(BillingInterval, req.body.billingInterval);
  if (!organizationId || !targetPlanType || !targetInterval) {
    return res.status(400).json({ error: 'organizationId, planType, and billingInterval are required' });
  }

  try {
    const [subscription, targetPlan] = await Promise.all([
      prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
      prisma.plan.findUnique({ where: { type: targetPlanType } }),
    ]);
    if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    // Currency and eligibility follow the payer's billing country, not the org.
    const profile = await resolveSubscriptionPayer(subscription, req.user?.id);
    if (!profile) {
      return res.status(400).json({ error: 'BILLING_COUNTRY_REQUIRED', message: 'Complete your billing profile before changing plans.' });
    }
    if (!targetPlan || targetPlan.type === PlanType.FREE || targetPlan.type === PlanType.ENTERPRISE) {
      return res.status(400).json({ error: 'INVALID_TARGET_PLAN' });
    }
    if (!targetPlan.isPublic) return res.status(400).json({ error: 'PLAN_NOT_PUBLIC' });
    if (targetPlan.type === PlanType.LOCAL && profile.countryCode.toUpperCase() !== 'NG') {
      return res.status(400).json({
        error: 'LOCAL_PLAN_INELIGIBLE',
        message: 'Local is available only to payers billed in Nigeria, in NGN.',
      });
    }
    const currency = currencyForCountry(profile.countryCode);
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
          organizationId: invoice.organizationId, payerUserId: invoice.payerUserId,
          plan, interval: invoice.billingInterval,
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

app.post('/billing/subscriptions/changes', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  const effectiveMode = String(req.body.effectiveMode ?? '');
  const idempotencyKey = String(req.body.idempotencyKey ?? '').trim();
  if (!organizationId || !req.body.previewId || !['IMMEDIATE', 'NEXT_RENEWAL'].includes(effectiveMode) || !idempotencyKey) {
    return res.status(400).json({ error: 'organizationId, previewId, effectiveMode, and idempotencyKey are required' });
  }
  try {
    const existing = await prisma.subscriptionChange.findUnique({ where: { idempotencyKey } });
    if (existing) return res.json(existing);
    const [preview, subscription] = await Promise.all([
      prisma.subscriptionChange.findUnique({ where: { id: String(req.body.previewId) } }),
      prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
    ]);
    const profile = await resolveSubscriptionPayer(subscription, req.user?.id);
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
    // ── FLUTTERWAVE: charge the stored card token ──────────────────────────
    // Flutterwave exposes no plan-swap on a live subscription, so Tellann drives
    // the change itself: charge the prorated difference against the saved card
    // token, then move the plan. This is the same shape as the Paystack path
    // below, which is what lets a USD payer upgrade and downgrade exactly like
    // an NGN one instead of being sent back through a hosted checkout.
    if (subscription.activeProvider === 'FLUTTERWAVE') {
      const targetPlan = await prisma.plan.findUnique({ where: { id: preview.targetPlanId } });
      if (!targetPlan) return res.status(404).json({ error: 'TARGET_PLAN_NOT_FOUND' });
      const flutterwavePlanCode = await providerPlanCode(prisma, 'FLUTTERWAVE', targetPlan.type, preview.targetInterval, preview.currency);
      if (!flutterwavePlanCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED' });
      const email = payerEmail(profile, req);
      if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });
      if (!subscription.paymentMethodReference) {
        return res.status(409).json({
          error: 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED',
          message: 'Add a payment method before changing plans.',
        });
      }

      const renewalDate = subscription.providerPeriodEnd ?? subscription.currentPeriodEnd;
      await prisma.subscriptionChange.update({
        where: { id: preview.id },
        data: { status: 'PROCESSING', effectiveMode, idempotencyKey, provider: 'FLUTTERWAVE' },
      });

      // An immediate upgrade is charged now, prorated. A downgrade — or any
      // change deferred to renewal — costs nothing today; the new price simply
      // applies from the next cycle.
      if (effectiveMode === 'IMMEDIATE' && preview.amountDue > 0) {
        const upgradeInvoice = await createBillingInvoice({
          organizationId,
          payerUserId: profile?.userId ?? req.user!.id,
          planType: targetPlan.type,
          interval: preview.targetInterval,
          currency: preview.currency,
          listPrice: preview.amountDue,
          countryCode: profile?.countryCode ?? null,
          provider: 'FLUTTERWAVE',
          periodStart: new Date(),
          periodEnd: renewalDate,
          reason: 'UPGRADE',
        });
        const charge = await chargeFlutterwaveToken({
          token: openPaymentReference(subscription.paymentMethodReference),
          email,
          amountMinor: upgradeInvoice.total,
          currency: preview.currency,
          txRef: `change-${preview.id}`,
          narration: `Tellann ${targetPlan.type} upgrade`,
          metadata: { organizationId, subscriptionChangeId: preview.id, invoiceId: upgradeInvoice.id },
        });
        if (charge.status !== 'success') {
          await prisma.invoice.update({ where: { id: upgradeInvoice.id }, data: { status: 'FAILED', providerReference: charge.reference } });
          await prisma.subscriptionChange.update({
            where: { id: preview.id },
            data: { status: 'PAYMENT_ACTION_REQUIRED', providerReference: charge.reference, processingError: charge.providerMessage.slice(0, 1000) },
          });
          return res.status(402).json({
            error: 'UPGRADE_CHARGE_DECLINED',
            message: charge.providerMessage || 'The card on file was declined. Update your payment method and try again.',
            invoiceId: upgradeInvoice.id,
          });
        }
        await prisma.invoice.update({
          where: { id: upgradeInvoice.id },
          data: { status: 'PAID', paidAt: new Date(), providerReference: charge.reference, providerCustomerId: charge.customerId },
        });
        await deliverInvoiceEmail(upgradeInvoice.id).catch((err) =>
          console.error('[BillingAPI] Upgrade receipt delivery failed', err));
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
              providerPlanCode: flutterwavePlanCode,
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
            providerOperationId: subscription.providerSubscriptionId ?? `flw-self-managed-${organizationId}`,
            effectiveAt: effectiveMode === 'IMMEDIATE' ? now : renewalDate,
          },
        });
      }, { maxWait: 10_000, timeout: 30_000 });

      if (effectiveMode === 'IMMEDIATE') await entitlementChecker.resolveEntitlement(organizationId);
      return res.json(updated);
    }

    if (subscription.activeProvider !== 'PAYSTACK') {
      return res.status(409).json({
        error: 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED',
        message: `Add a payment method before changing this ${subscription.activeProvider ?? 'unlinked'} subscription.`,
      });
    }

    // ── PAYSTACK: charge the stored authorization ──────────────────────────
    // Symmetric with the Flutterwave path above. Tellann owns the renewal
    // schedule, so a plan change never creates a provider-side subscription —
    // doing so would put Paystack's schedule and ours on the same card.
    const targetPlan = await prisma.plan.findUnique({ where: { id: preview.targetPlanId } });
    if (!targetPlan) return res.status(404).json({ error: 'TARGET_PLAN_NOT_FOUND' });
    const planCode = await providerPlanCode(prisma, 'PAYSTACK', targetPlan.type, preview.targetInterval, preview.currency);
    if (!planCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED' });
    if (!subscription.paymentMethodReference) {
      return res.status(409).json({
        error: 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED',
        message: 'Add a payment method before changing plans.',
      });
    }
    const email = payerEmail(profile, req);
    if (!email) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });

    const renewalDate = subscription.providerPeriodEnd ?? subscription.currentPeriodEnd;
    await prisma.subscriptionChange.update({
      where: { id: preview.id },
      data: { status: 'PROCESSING', effectiveMode, idempotencyKey, provider: 'PAYSTACK' },
    });

    // Only an immediate upgrade costs anything today. A downgrade, or any
    // change deferred to renewal, simply reprices the next cycle.
    if (effectiveMode === 'IMMEDIATE' && preview.amountDue > 0) {
      const upgradeInvoice = await createBillingInvoice({
        organizationId,
        payerUserId: profile?.userId ?? req.user!.id,
        planType: targetPlan.type,
        interval: preview.targetInterval,
        currency: preview.currency,
        listPrice: preview.amountDue,
        countryCode: profile?.countryCode ?? null,
        provider: 'PAYSTACK',
        periodStart: new Date(),
        periodEnd: renewalDate,
        reason: 'UPGRADE',
      });
      const charge = await chargeAuthorization({
        authorizationCode: openPaymentReference(subscription.paymentMethodReference),
        email,
        amount: upgradeInvoice.total,
        currency: preview.currency,
        reference: `change-${preview.id}`,
        metadata: { organizationId, subscriptionChangeId: preview.id, invoiceId: upgradeInvoice.id },
      });
      if (charge.status !== 'success') {
        await prisma.invoice.update({
          where: { id: upgradeInvoice.id },
          data: { status: 'FAILED', providerReference: charge.reference },
        });
        await prisma.subscriptionChange.update({
          where: { id: preview.id },
          data: { status: 'PAYMENT_ACTION_REQUIRED', providerReference: charge.reference },
        });
        return res.status(202).json({
          status: 'PAYMENT_ACTION_REQUIRED',
          checkoutUrl: charge.authorizationUrl,
          providerReference: charge.reference,
          invoiceId: upgradeInvoice.id,
        });
      }
      await prisma.invoice.update({
        where: { id: upgradeInvoice.id },
        data: { status: 'PAID', paidAt: new Date(), providerReference: charge.reference },
      });
      await deliverInvoiceEmail(upgradeInvoice.id).catch((err) =>
        console.error('[BillingAPI] Upgrade receipt delivery failed', err));
    }

    // Retire any provider-side subscription left over from the era when
    // Paystack drove renewals, so it cannot charge alongside the billing cycle.
    if (subscription.providerSubscriptionId && subscription.providerManagementToken) {
      await disablePaystackSubscription(
        subscription.providerSubscriptionId,
        openPaymentReference(subscription.providerManagementToken),
      ).catch((err) => console.warn('[BillingAPI] Could not disable legacy Paystack subscription', err));
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
          providerOperationId: subscription.providerSubscriptionId ?? `paystack-self-managed-${organizationId}`,
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

app.post('/billing/payment-method/session', verifyJwt, requireBillingManager, async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  try {
    const subscription = await prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } });
    if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
    const profile = await resolveSubscriptionPayer(subscription, req.user?.id);
    const billingEmail = payerEmail(profile, req);
    if (!billingEmail) return res.status(400).json({ error: 'BILLING_EMAIL_REQUIRED' });

    // Re-authorization must run at whichever processor holds the subscription,
    // otherwise the new card token is stored against a processor that will
    // never charge it.
    const provider: Provider = subscription.activeProvider === 'FLUTTERWAVE'
      ? 'FLUTTERWAVE'
      : 'PAYSTACK';

    // A nominal amount that establishes a reusable authorization. Both
    // processors refund or void it; it is never recognised as revenue.
    const verificationAmount = subscription.billingCurrency === BillingCurrency.NGN ? 5_000 : 200;
    const reference = `payment-method-${organizationId}-${Date.now()}`;

    if (provider === 'FLUTTERWAVE') {
      const planCode = await providerPlanCode(
        prisma, 'FLUTTERWAVE', subscription.plan.type, subscription.billingInterval, subscription.billingCurrency,
      );
      if (!planCode) return res.status(503).json({ error: 'PROVIDER_PLAN_NOT_CONFIGURED' });
      const checkout = await createFlutterwaveCheckout({
        txRef: reference,
        amount: verificationAmount,
        currency: subscription.billingCurrency,
        customerEmail: billingEmail,
        customerName: profile?.legalName,
        organizationId,
        planCode,
        redirectUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
        metadata: { purpose: 'PAYMENT_METHOD_UPDATE', organizationId },
      });
      return res.status(201).json({ provider, checkoutUrl: checkout.checkoutUrl, reference: checkout.reference });
    }

    const result = await initializeTransaction({
      email: billingEmail,
      amountKobo: verificationAmount,
      currency: subscription.billingCurrency,
      reference,
      organizationId,
      metadata: { purpose: 'PAYMENT_METHOD_UPDATE', organizationId },
      callbackUrl: typeof req.body.successUrl === 'string' ? req.body.successUrl : undefined,
    });
    res.status(201).json({ provider, checkoutUrl: result.authorizationUrl, reference: result.reference });
  } catch (err) {
    console.error('[BillingAPI] Payment method session failed', err);
    res.status(500).json({ error: 'PAYMENT_METHOD_SESSION_FAILED' });
  }
});

/**
 * Retries a failed renewal now instead of waiting for the next daily attempt.
 * Used after the payer updates their card mid-grace.
 */
app.post('/billing/subscriptions/retry', verifyJwt, requireBillingManager, async (req: Request, res: Response) => {
  const organizationId = requestOrganizationId(req);
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!subscription) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
  if (subscription.status !== SubscriptionStatus.GRACE_PERIOD && subscription.status !== SubscriptionStatus.PAST_DUE) {
    return res.status(409).json({ error: 'NO_PAYMENT_RETRY_AVAILABLE', message: 'This subscription has no failed payment to retry.' });
  }
  // The deterministic development provider has no real card to retry against.
  const isMockSubscription = subscription.activeProvider === 'MOCK' && process.env.NODE_ENV !== 'production';
  if (!subscription.paymentMethodReference && !isMockSubscription) {
    return res.status(409).json({ error: 'PAYMENT_METHOD_REQUIRED', message: 'Add a payment method before retrying.' });
  }

  // Bring the charge forward; the billing cycle picks it up on its next pass.
  await prisma.subscription.update({
    where: { organizationId },
    data: { nextBillingAt: new Date() },
  });
  await prisma.billingDunningAttempt.updateMany({
    where: { organizationId, status: 'SCHEDULED' },
    data: { scheduledAt: new Date() },
  });
  res.status(202).json({
    status: 'RETRY_SCHEDULED',
    graceEndsAt: subscription.graceEndsAt,
  });
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.BILLING_API;
app.listen(PORT, () => {
  console.log(`[BillingAPI] Running on port ${PORT}`);
});
