import {
  BillingCurrency,
  BillingInterval,
  Plan,
  PlanType,
  PrismaClient,
  Subscription,
  SubscriptionStatus,
} from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@tellann/email';
import { MemberRole } from '@tellann/db';
import { chargeAuthorization } from './providers/paystack';
import { chargeFlutterwaveToken } from './providers/flutterwave';
import { openPaymentReference } from './billing-policy';
import { applyTax } from './tax';
import { deliverInvoiceDocument, formatMoney } from './invoicing';

/**
 * The recurring billing cycle.
 *
 * Tellann schedules its own charges against a stored payment method rather than
 * delegating the schedule to a processor-side subscription. That is what makes
 * the lifecycle identical on Paystack and Flutterwave, and it is the only way
 * to express a free trial that converts on our terms and a grace period that
 * scales a payer down instead of cutting them off.
 *
 * Three things happen on every pass:
 *   1. Trials that reached their end date are converted into paid periods.
 *   2. Active subscriptions past their billing date are renewed.
 *   3. Grace periods that elapsed without payment are scaled down to Free.
 */

export const TRIAL_DAYS = positiveInt(process.env.BILLING_TRIAL_DAYS, 14);
export const GRACE_PERIOD_DAYS = positiveInt(process.env.BILLING_GRACE_PERIOD_DAYS, 7);
/** How long before a trial converts we warn the payer. */
const TRIAL_WARNING_DAYS = positiveInt(process.env.BILLING_TRIAL_WARNING_DAYS, 3);

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function periodEndFor(interval: BillingInterval, from = new Date()): Date {
  const end = new Date(from);
  if (interval === BillingInterval.ANNUAL) end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

export function priceFor(plan: Plan, interval: BillingInterval, currency: BillingCurrency): number {
  if (currency === BillingCurrency.NGN) {
    return interval === BillingInterval.ANNUAL
      ? plan.annualPriceNgn ?? plan.monthlyPriceNgn ?? 0
      : plan.monthlyPriceNgn ?? 0;
  }
  return interval === BillingInterval.ANNUAL
    ? plan.annualPriceUsd ?? plan.monthlyPriceUsd ?? 0
    : plan.monthlyPriceUsd ?? 0;
}

export interface BillingCycleDeps {
  prisma: PrismaClient;
  emailService: NotificationEmailService;
  entitlementChecker: EntitlementChecker;
}

export interface BillingCycleResult {
  trialsConverted: number;
  renewalsCharged: number;
  chargesFailed: number;
  gracePeriodsStarted: number;
  plansLapsed: number;
  trialWarningsSent: number;
}

type SubscriptionWithPlan = Subscription & { plan: Plan; pendingPlan: Plan | null };

// ─────────────────────────────────────────────────────────────────────────────
// Charging
// ─────────────────────────────────────────────────────────────────────────────

interface ChargeOutcome {
  ok: boolean;
  reference: string | null;
  customerId: string | null;
  message: string;
}

/**
 * Charges the stored payment method. Both processors expose the same shape —
 * a sealed reusable credential plus an amount — so the caller never needs to
 * know which one holds the card.
 */
async function chargeStoredMethod(
  subscription: SubscriptionWithPlan,
  email: string,
  amountMinor: number,
  currency: BillingCurrency,
  reference: string,
  metadata: Record<string, unknown>,
): Promise<ChargeOutcome> {
  if (!subscription.paymentMethodReference) {
    return { ok: false, reference: null, customerId: null, message: 'No payment method on file' };
  }
  const credential = openPaymentReference(subscription.paymentMethodReference);

  if (subscription.activeProvider === 'FLUTTERWAVE') {
    const charge = await chargeFlutterwaveToken({
      token: credential,
      email,
      amountMinor,
      currency,
      txRef: reference,
      narration: `Tellann ${subscription.plan.type} subscription`,
      metadata,
    });
    return {
      ok: charge.status === 'success',
      reference: charge.reference,
      customerId: charge.customerId,
      message: charge.providerMessage || 'Charge declined',
    };
  }

  const charge = await chargeAuthorization({
    authorizationCode: credential,
    email,
    amount: amountMinor,
    currency,
    reference,
    metadata,
  });
  return {
    ok: charge.status === 'success',
    reference: charge.reference,
    customerId: null,
    message: charge.status === 'success' ? 'Charged' : 'Charge declined',
  };
}

/**
 * Bills one subscription for its next period and moves its lifecycle forward.
 *
 * A scheduled downgrade lands here: BSS §12 defers downgrades to renewal, so
 * the pending plan becomes the charged plan at exactly this moment rather than
 * being applied early and refunded.
 */
async function billSubscription(
  deps: BillingCycleDeps,
  subscription: SubscriptionWithPlan,
  reason: 'RENEWAL' | 'TRIAL_CONVERSION',
  result: BillingCycleResult,
): Promise<void> {
  const { prisma, emailService, entitlementChecker } = deps;
  const now = new Date();

  const scheduledChangeIsDue = subscription.pendingPlanId
    && subscription.pendingChangeAt
    && subscription.pendingChangeAt <= now;
  const planToBill = scheduledChangeIsDue && subscription.pendingPlan
    ? subscription.pendingPlan
    : subscription.plan;

  // A downgrade all the way to Free costs nothing — apply it and stop billing.
  if (planToBill.type === PlanType.FREE) {
    await prisma.subscription.update({
      where: { organizationId: subscription.organizationId },
      data: {
        planId: planToBill.id,
        status: SubscriptionStatus.ACTIVE,
        nonRenewing: true,
        pendingPlanId: null,
        pendingChangeAt: null,
        nextBillingAt: null,
        graceEndsAt: null,
        billingFailureCount: 0,
        trialEndsAt: null,
      },
    });
    await entitlementChecker.resolveEntitlement(subscription.organizationId);
    return;
  }

  const payer = subscription.payerUserId
    ? await prisma.user.findUnique({
        where: { id: subscription.payerUserId },
        select: { email: true, billingProfile: true },
      })
    : null;
  const email = payer?.billingProfile?.billingEmail?.trim() || payer?.email?.trim() || '';
  const countryCode = payer?.billingProfile?.countryCode ?? null;

  const listPrice = priceFor(planToBill, subscription.billingInterval, subscription.billingCurrency);
  if (!email || listPrice <= 0) {
    await enterGracePeriod(deps, subscription, planToBill, result,
      !email ? 'No billing email on file for the payer' : 'No configured price for this plan');
    return;
  }

  const taxed = applyTax(listPrice, countryCode);
  const periodStart = now;
  const periodEnd = periodEndFor(subscription.billingInterval, now);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: subscription.organizationId,
      payerUserId: subscription.payerUserId,
      invoiceNumber: `TELLANN-${now.getTime()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
      planType: planToBill.type,
      billingInterval: subscription.billingInterval,
      currency: subscription.billingCurrency,
      subtotal: taxed.subtotal,
      tax: taxed.tax,
      taxRate: taxed.taxRate,
      taxLabel: taxed.taxLabel,
      taxJurisdiction: taxed.taxJurisdiction,
      total: taxed.total,
      status: 'PENDING',
      provider: subscription.activeProvider ?? 'PAYSTACK',
      periodStart,
      periodEnd,
      reason,
    },
  });

  let outcome: ChargeOutcome;
  try {
    outcome = await chargeStoredMethod(
      subscription, email, invoice.total, subscription.billingCurrency,
      `${reason === 'TRIAL_CONVERSION' ? 'trial' : 'renewal'}-${invoice.id}`,
      { organizationId: subscription.organizationId, invoiceId: invoice.id, reason },
    );
  } catch (err) {
    outcome = {
      ok: false, reference: null, customerId: null,
      message: err instanceof Error ? err.message : 'Charge request failed',
    };
  }

  await prisma.subscription.update({
    where: { organizationId: subscription.organizationId },
    data: { lastBillingAttemptAt: now },
  });

  if (!outcome.ok) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'FAILED', providerReference: outcome.reference },
    });
    await enterGracePeriod(deps, subscription, planToBill, result, outcome.message);
    result.chargesFailed += 1;
    return;
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'PAID',
      paidAt: now,
      providerReference: outcome.reference,
      providerCustomerId: outcome.customerId,
    },
  });

  await prisma.subscription.update({
    where: { organizationId: subscription.organizationId },
    data: {
      planId: planToBill.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      providerPeriodStart: periodStart,
      providerPeriodEnd: periodEnd,
      providerNextChargeAt: periodEnd,
      trialEndsAt: null,
      graceEndsAt: null,
      billingFailureCount: 0,
      suspendedAt: null,
      pendingPlanId: scheduledChangeIsDue ? null : subscription.pendingPlanId,
      pendingChangeAt: scheduledChangeIsDue ? null : subscription.pendingChangeAt,
    },
  });

  await entitlementChecker.resolveEntitlement(subscription.organizationId);
  await deliverInvoiceDocument({ prisma, emailService }, invoice.id)
    .catch((err) => console.error('[Renewal] Invoice delivery failed', err));

  if (reason === 'TRIAL_CONVERSION') result.trialsConverted += 1;
  else result.renewalsCharged += 1;
}

/**
 * Starts the grace period (BSS §14). The payer keeps full plan access for the
 * whole window — cutting access at the moment a card declines punishes the
 * common case of an expired card — and is only scaled down once it elapses.
 */
async function enterGracePeriod(
  { prisma, emailService, entitlementChecker }: BillingCycleDeps,
  subscription: SubscriptionWithPlan,
  plan: Plan,
  result: BillingCycleResult,
  reason: string,
): Promise<void> {
  const now = new Date();
  const graceEndsAt = subscription.graceEndsAt ?? addDays(now, GRACE_PERIOD_DAYS);

  await prisma.subscription.update({
    where: { organizationId: subscription.organizationId },
    data: {
      status: SubscriptionStatus.GRACE_PERIOD,
      graceEndsAt,
      // Retry daily inside the window; a card is often replaced mid-grace.
      nextBillingAt: addDays(now, 1),
      billingFailureCount: { increment: 1 },
    },
  });

  // Keep the denormalized entitlement in step: access is unchanged during
  // grace, and a stale row here is what would silently cut a payer off early.
  await entitlementChecker.resolveEntitlement(subscription.organizationId);

  if (!subscription.graceEndsAt) {
    result.gracePeriodsStarted += 1;
    await emailService.sendToOrganizationMembers({
      templateKey: 'billing-grace-period',
      organizationId: subscription.organizationId,
      eventType: 'BILLING_GRACE_PERIOD',
      severity: 'HIGH',
      variables: {
        organizationName: await organizationName(prisma, subscription.organizationId),
        planName: plan.name,
        graceEndsOn: formatDay(graceEndsAt),
        graceDays: String(GRACE_PERIOD_DAYS),
        billingUrl: appUrl('/settings/billing'),
      },
      idempotencyKey: buildIdempotencyKey(['billing-grace', subscription.organizationId, graceEndsAt.toISOString()]),
      roles: [MemberRole.OWNER, MemberRole.ADMIN],
    }).catch((err) => console.error('[Renewal] Grace period email failed', err));
  }

  console.warn(`[Renewal] ${subscription.organizationId} entered grace until ${graceEndsAt.toISOString()}: ${reason}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle passes
// ─────────────────────────────────────────────────────────────────────────────

async function convertDueTrials(deps: BillingCycleDeps, result: BillingCycleResult): Promise<void> {
  const due = await deps.prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: { lte: new Date() },
      cancelAtPeriodEnd: false,
    },
    include: { plan: true, pendingPlan: true },
    take: 50,
  });
  for (const subscription of due) {
    await billSubscription(deps, subscription, 'TRIAL_CONVERSION', result)
      .catch((err) => console.error(`[Renewal] Trial conversion failed for ${subscription.organizationId}`, err));
  }
}

/** Warns a payer before their card is charged for the first time. */
async function warnEndingTrials(deps: BillingCycleDeps, result: BillingCycleResult): Promise<void> {
  const now = new Date();
  const soon = addDays(now, TRIAL_WARNING_DAYS);
  const ending = await deps.prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: { gt: now, lte: soon },
      cancelAtPeriodEnd: false,
    },
    include: { plan: true, payer: { select: { billingProfile: { select: { countryCode: true } } } } },
    take: 100,
  });

  for (const subscription of ending) {
    const listPrice = priceFor(subscription.plan, subscription.billingInterval, subscription.billingCurrency);
    const taxed = applyTax(listPrice, subscription.payer?.billingProfile?.countryCode ?? null);
    const daysRemaining = Math.max(
      1,
      Math.ceil(((subscription.trialEndsAt?.getTime() ?? now.getTime()) - now.getTime()) / 86_400_000),
    );
    await deps.emailService.sendToOrganizationMembers({
      templateKey: 'billing-trial-ending',
      organizationId: subscription.organizationId,
      eventType: 'BILLING_TRIAL_ENDING',
      severity: 'MEDIUM',
      variables: {
        organizationName: await organizationName(deps.prisma, subscription.organizationId),
        planName: subscription.plan.name,
        daysRemaining: String(daysRemaining),
        firstChargeAmount: formatMoney(taxed.total, subscription.billingCurrency),
        billingUrl: appUrl('/settings/billing'),
      },
      // One warning per trial, keyed on the end date so a rescheduled trial
      // gets a fresh notice rather than being silently suppressed.
      idempotencyKey: buildIdempotencyKey([
        'trial-ending', subscription.organizationId, subscription.trialEndsAt?.toISOString(),
      ]),
      roles: [MemberRole.OWNER, MemberRole.ADMIN],
    }).then(() => { result.trialWarningsSent += 1; })
      .catch((err) => console.error('[Renewal] Trial warning email failed', err));
  }
}

async function chargeDueRenewals(deps: BillingCycleDeps, result: BillingCycleResult): Promise<void> {
  const due = await deps.prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD] },
      nonRenewing: false,
      nextBillingAt: { lte: new Date() },
    },
    include: { plan: true, pendingPlan: true },
    take: 50,
  });

  for (const subscription of due) {
    // A cancellation scheduled for period end simply lapses to Free; never
    // charge a payer who already asked to stop.
    if (subscription.cancelAtPeriodEnd) {
      await lapseToFree(deps, subscription, result, 'Cancellation took effect at period end');
      continue;
    }
    await billSubscription(deps, subscription, 'RENEWAL', result)
      .catch((err) => console.error(`[Renewal] Renewal failed for ${subscription.organizationId}`, err));
  }
}

async function expireGracePeriods(deps: BillingCycleDeps, result: BillingCycleResult): Promise<void> {
  const lapsed = await deps.prisma.subscription.findMany({
    where: { status: SubscriptionStatus.GRACE_PERIOD, graceEndsAt: { lte: new Date() } },
    include: { plan: true, pendingPlan: true },
    take: 50,
  });
  for (const subscription of lapsed) {
    await lapseToFree(deps, subscription, result, 'Grace period elapsed without payment')
      .catch((err) => console.error(`[Renewal] Lapse failed for ${subscription.organizationId}`, err));
  }
}

/**
 * Scales a subscription down to Free.
 *
 * Deliberately a downgrade rather than a suspension: the payer keeps their
 * account, their data, and Free-tier access, and the plan they lost is recorded
 * so resubscribing can offer it back directly.
 */
async function lapseToFree(
  deps: BillingCycleDeps,
  subscription: SubscriptionWithPlan,
  result: BillingCycleResult,
  reason: string,
): Promise<void> {
  const { prisma, emailService, entitlementChecker } = deps;
  const freePlan = await prisma.plan.findUnique({ where: { type: PlanType.FREE } });
  if (!freePlan) throw new Error('FREE plan is not seeded');
  if (subscription.planId === freePlan.id) return;

  const now = new Date();
  await prisma.subscription.update({
    where: { organizationId: subscription.organizationId },
    data: {
      planId: freePlan.id,
      status: SubscriptionStatus.ACTIVE,
      nonRenewing: true,
      lapsedFromPlanId: subscription.planId,
      lapsedAt: now,
      graceEndsAt: null,
      nextBillingAt: null,
      trialEndsAt: null,
      billingFailureCount: 0,
      pendingPlanId: null,
      pendingChangeAt: null,
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      // Free is an entitlement record, not a renewable contract.
      currentPeriodEnd: new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.billingDunningAttempt.updateMany({
    where: { organizationId: subscription.organizationId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
    data: { status: 'CANCELLED', completedAt: now },
  });

  await entitlementChecker.resolveEntitlement(subscription.organizationId);
  result.plansLapsed += 1;

  await emailService.sendToOrganizationMembers({
    templateKey: 'billing-plan-lapsed',
    organizationId: subscription.organizationId,
    eventType: 'BILLING_PLAN_LAPSED',
    severity: 'HIGH',
    variables: {
      organizationName: await organizationName(prisma, subscription.organizationId),
      previousPlanName: subscription.plan.name,
      billingUrl: appUrl('/settings/billing'),
    },
    idempotencyKey: buildIdempotencyKey(['billing-lapsed', subscription.organizationId, now.toISOString().slice(0, 10)]),
    roles: [MemberRole.OWNER, MemberRole.ADMIN],
  }).catch((err) => console.error('[Renewal] Lapse email failed', err));

  console.warn(`[Renewal] ${subscription.organizationId} scaled down to Free: ${reason}`);
}

async function organizationName(prisma: PrismaClient, organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  return org?.name ?? 'your organization';
}

function formatDay(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Runs one full pass. Ordering matters: trials convert before renewals so a
 * subscription cannot be billed twice in a pass, and grace periods expire last
 * so a payment that landed earlier in the same pass rescues the subscription.
 */
export async function runBillingCycle(deps: BillingCycleDeps): Promise<BillingCycleResult> {
  const result: BillingCycleResult = {
    trialsConverted: 0,
    renewalsCharged: 0,
    chargesFailed: 0,
    gracePeriodsStarted: 0,
    plansLapsed: 0,
    trialWarningsSent: 0,
  };

  await convertDueTrials(deps, result);
  await chargeDueRenewals(deps, result);
  await expireGracePeriods(deps, result);
  await warnEndingTrials(deps, result);

  const touched = result.trialsConverted + result.renewalsCharged + result.chargesFailed
    + result.plansLapsed + result.trialWarningsSent;
  if (touched) console.log('[Renewal] Billing cycle complete', result);
  return result;
}
