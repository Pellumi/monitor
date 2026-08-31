/**
 * Verifies the billing lifecycle against a running billing-api.
 *
 * Covers the six changes made on 2026-08-31: Stripe retirement, cross-currency
 * plan changes, the 7-day grace period, the 14-day trial, tax on invoices, and
 * downloadable invoice documents.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.BILLING_API_PORT ?? 3009}`;
const SECRET = process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production';

let passed = 0;
let failed = 0;
const seeded = [];

function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function call(path, { method = 'GET', body, accessToken, orgId, raw = false } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(orgId ? { 'x-tellann-org-id': orgId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (raw) {
    return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };
  }
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: response.status, body: json };
}

async function seedPayer(countryCode, label) {
  const suffix = crypto.randomUUID();
  const email = `lifecycle-${label}-${suffix}@example.com`;
  const user = await prisma.user.create({
    data: { email, billingProfile: { create: { countryCode, billingEmail: email, legalName: `Lifecycle ${label}` } } },
  });
  const organization = await prisma.organization.create({
    data: {
      name: `Lifecycle ${label}`,
      slug: `lifecycle-${label}-${suffix}`,
      createdByUserId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  const record = {
    user, organization,
    accessToken: jwt.sign({ sub: user.id, email }, SECRET, { expiresIn: '20m' }),
  };
  seeded.push(record);
  return record;
}

/** Encrypts a credential the same way billing-api does, so charges can be attempted. */
function sealCredential(value) {
  const keyMaterial = process.env.BILLING_ENCRYPTION_KEY;
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function runBillingCycle() {
  const response = await fetch(`${BASE}/billing/internal/billing-cycle`, {
    method: 'POST',
    headers: { 'x-tellann-internal-secret': process.env.BILLING_INTERNAL_SECRET ?? '' },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function main() {
  const health = await call('/health');
  if (health.status !== 200) {
    console.error(`billing-api is not reachable at ${BASE}. Start the dev stack first.`);
    process.exitCode = 1;
    return;
  }

  // ── 1. Stripe retirement ──────────────────────────────────────────────────
  console.log('\n1. Stripe is fully retired');
  const ng = await seedPayer('NG', 'ng');
  const us = await seedPayer('US', 'us');

  const usCatalog = await call(`/billing/plans?organizationId=${us.organization.id}`, { accessToken: us.accessToken });
  check('USD is quoted through Flutterwave only',
    JSON.stringify(usCatalog.body?.availableProviders) === JSON.stringify(['FLUTTERWAVE']),
    `providers=${JSON.stringify(usCatalog.body?.availableProviders)}`);

  const ngCatalog = await call(`/billing/plans?organizationId=${ng.organization.id}`, { accessToken: ng.accessToken });
  check('NGN offers both Nigerian processors, Paystack first',
    ngCatalog.body?.availableProviders?.[0] === 'PAYSTACK'
      && ngCatalog.body?.availableProviders?.includes('FLUTTERWAVE'),
    `providers=${JSON.stringify(ngCatalog.body?.availableProviders)}`);

  const stripeWebhook = await call('/billing/webhooks/stripe', { method: 'POST', body: { type: 'invoice.paid', data: {} } });
  check('the Stripe webhook route is rejected', [400, 404].includes(stripeWebhook.status), `status=${stripeWebhook.status}`);

  const stripeCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: us.accessToken, orgId: us.organization.id,
    body: { organizationId: us.organization.id, planType: 'SOLO', billingInterval: 'MONTHLY', provider: 'STRIPE' },
  });
  check('Stripe cannot be selected for checkout',
    stripeCheckout.status === 400 && stripeCheckout.body?.error === 'PROVIDER_NOT_ELIGIBLE',
    `status=${stripeCheckout.status} ${stripeCheckout.body?.error}`);

  // ── 2. Tax ────────────────────────────────────────────────────────────────
  console.log('\n2. Tax is applied before the customer is billed');
  const ngCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: ng.accessToken, orgId: ng.organization.id,
    body: { organizationId: ng.organization.id, planType: 'SOLO', billingInterval: 'MONTHLY' },
  });
  const ngInvoice = ngCheckout.body?.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: ngCheckout.body.invoiceId } })
    : null;
  check('an NG invoice itemizes 7.5% VAT',
    ngInvoice?.taxRate === 750 && ngInvoice?.taxLabel === 'VAT' && ngInvoice?.taxJurisdiction === 'NG',
    `rate=${ngInvoice?.taxRate} label=${ngInvoice?.taxLabel} jurisdiction=${ngInvoice?.taxJurisdiction}`);
  check('subtotal plus tax equals the total exactly',
    ngInvoice != null && ngInvoice.subtotal + ngInvoice.tax === ngInvoice.total,
    `${ngInvoice?.subtotal} + ${ngInvoice?.tax} = ${ngInvoice?.total}`);
  check('the published price is what is charged (tax-inclusive)',
    ngInvoice?.total === 4_200_000, `total=${ngInvoice?.total} (expected ₦42,000 = 4200000 kobo)`);

  const usCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: us.accessToken, orgId: us.organization.id,
    body: { organizationId: us.organization.id, planType: 'SOLO', billingInterval: 'MONTHLY' },
  });
  const usInvoice = usCheckout.body?.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: usCheckout.body.invoiceId } })
    : null;
  check('an unregistered jurisdiction is charged no tax',
    usInvoice?.tax === 0 && usInvoice?.taxRate === 0, `tax=${usInvoice?.tax}`);

  // ── 3. Invoice documents ──────────────────────────────────────────────────
  console.log('\n3. Invoices and receipts download');
  const pdf = await call(`/billing/invoices/${ngInvoice.id}/document`, { accessToken: ng.accessToken, raw: true });
  check('the payer downloads a PDF',
    pdf.status === 200 && pdf.buffer.subarray(0, 4).toString() === '%PDF',
    `status=${pdf.status} bytes=${pdf.buffer.length}`);
  check('the download is served as an attachment',
    String(pdf.headers.get('content-disposition') ?? '').includes('attachment'),
    pdf.headers.get('content-disposition'));

  const foreignPdf = await call(`/billing/invoices/${ngInvoice.id}/document`, { accessToken: us.accessToken, raw: true });
  check('another payer cannot download it', foreignPdf.status === 403, `status=${foreignPdf.status}`);

  const anonPdf = await call(`/billing/invoices/${ngInvoice.id}/document`, { raw: true });
  check('an anonymous request cannot download it', anonPdf.status === 401, `status=${anonPdf.status}`);

  // ── 4. Trial ──────────────────────────────────────────────────────────────
  console.log('\n4. The 14-day trial');
  const eligibility = await call(`/billing/trial/eligibility?organizationId=${ng.organization.id}`, { accessToken: ng.accessToken });
  check('an NG payer trials on Local',
    eligibility.body?.planType === 'LOCAL' && eligibility.body?.trialDays === 14,
    `plan=${eligibility.body?.planType} days=${eligibility.body?.trialDays}`);
  const usEligibility = await call(`/billing/trial/eligibility?organizationId=${us.organization.id}`, { accessToken: us.accessToken });
  check('a non-NG payer trials on Solo', usEligibility.body?.planType === 'SOLO', `plan=${usEligibility.body?.planType}`);
  check('the first charge amount is quoted up front',
    typeof eligibility.body?.firstChargeFormatted === 'string' && eligibility.body.firstChargeAmount > 0,
    eligibility.body?.firstChargeFormatted);

  const trialStart = await call('/billing/trial/start', {
    method: 'POST', accessToken: ng.accessToken, orgId: ng.organization.id,
    body: { organizationId: ng.organization.id },
  });
  check('starting a trial returns a card authorization URL',
    trialStart.status === 201 && typeof trialStart.body?.checkoutUrl === 'string',
    trialStart.status === 201 ? `${trialStart.body.provider} ${String(trialStart.body.checkoutUrl).slice(0, 40)}…` : JSON.stringify(trialStart.body));

  // Simulate the processor confirming the card, which is what actually starts
  // the trial. Done directly because a real card cannot be entered here.
  const localPlan = await prisma.plan.findUnique({ where: { type: 'LOCAL' } });
  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
  await prisma.subscription.create({
    data: {
      organizationId: ng.organization.id,
      payerUserId: ng.user.id,
      planId: localPlan.id,
      status: 'TRIAL',
      billingCurrency: 'NGN',
      billingInterval: 'MONTHLY',
      activeProvider: 'PAYSTACK',
      paymentMethodReference: sealCredential('AUTH_verify_token'),
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
      trialStartedAt: new Date(),
      trialEndsAt,
      nextBillingAt: trialEndsAt,
    },
  });
  await prisma.subscriptionTrialHistory.create({
    data: {
      organizationId: ng.organization.id, userId: ng.user.id,
      planType: 'LOCAL', startedAt: new Date(), endedAt: trialEndsAt,
    },
  });

  const secondTrial = await call('/billing/trial/start', {
    method: 'POST', accessToken: ng.accessToken, orgId: ng.organization.id,
    body: { organizationId: ng.organization.id },
  });
  check('a second trial is refused for the same payer',
    secondTrial.status === 409 && secondTrial.body?.error === 'TRIAL_ALREADY_USED',
    `status=${secondTrial.status} ${secondTrial.body?.error}`);

  const cycleIdle = await runBillingCycle();
  check('the billing cycle runs and leaves an unexpired trial alone',
    cycleIdle.status === 200 && cycleIdle.body?.trialsConverted === 0,
    JSON.stringify(cycleIdle.body));

  const stillTrial = await prisma.subscription.findUnique({ where: { organizationId: ng.organization.id } });
  check('the trial is not charged before day 14', stillTrial?.status === 'TRIAL', `status=${stillTrial?.status}`);

  // ── 5. Grace period ───────────────────────────────────────────────────────
  console.log('\n5. The 7-day grace period');
  // Bring the trial to its end date with a credential the processor will
  // decline, so the conversion charge fails the way a dead card would.
  await prisma.subscription.update({
    where: { organizationId: ng.organization.id },
    data: { trialEndsAt: new Date(Date.now() - 1000), nextBillingAt: new Date(Date.now() - 1000) },
  });
  const cycleConvert = await runBillingCycle();
  check('a failed conversion starts a grace period, it does not suspend',
    cycleConvert.status === 200 && cycleConvert.body?.gracePeriodsStarted === 1,
    JSON.stringify(cycleConvert.body));

  const graced = await prisma.subscription.findUnique({ where: { organizationId: ng.organization.id } });
  const graceDays = graced?.graceEndsAt
    ? Math.round((graced.graceEndsAt.getTime() - Date.now()) / 86_400_000)
    : null;
  check('the grace window is 7 days', graceDays === 7, `days=${graceDays}`);
  check('the payer keeps their paid plan during grace',
    graced?.status === 'GRACE_PERIOD' && graced?.planId === localPlan.id,
    `status=${graced?.status}`);

  const entitlementDuringGrace = await prisma.entitlement.findUnique({ where: { organizationId: ng.organization.id } });
  check('entitlements still reflect the paid plan during grace',
    entitlementDuringGrace?.planType === 'LOCAL', `planType=${entitlementDuringGrace?.planType}`);

  // Expire the window.
  await prisma.subscription.update({
    where: { organizationId: ng.organization.id },
    data: { graceEndsAt: new Date(Date.now() - 1000) },
  });
  const cycleLapse = await runBillingCycle();
  check('an elapsed grace period scales the payer down',
    cycleLapse.status === 200 && cycleLapse.body?.plansLapsed === 1, JSON.stringify(cycleLapse.body));

  const lapsed = await prisma.subscription.findUnique({
    where: { organizationId: ng.organization.id },
    include: { plan: true, lapsedFrom: true },
  });
  check('the organization lands on Free, not suspended',
    lapsed?.plan.type === 'FREE' && lapsed?.status === 'ACTIVE',
    `plan=${lapsed?.plan.type} status=${lapsed?.status}`);
  check('the plan they lost is recorded for resubscribing',
    lapsed?.lapsedFrom?.type === 'LOCAL', `lapsedFrom=${lapsed?.lapsedFrom?.type}`);

  const entitlementAfterLapse = await prisma.entitlement.findUnique({ where: { organizationId: ng.organization.id } });
  check('entitlements drop to Free after the lapse',
    entitlementAfterLapse?.planType === 'FREE', `planType=${entitlementAfterLapse?.planType}`);

  // ── 6. Plan changes in both currencies ────────────────────────────────────
  console.log('\n6. Upgrades and downgrades work in USD and NGN');
  const soloPlan = await prisma.plan.findUnique({ where: { type: 'SOLO' } });

  for (const [label, payer, provider, currency] of [
    ['USD via Flutterwave', us, 'FLUTTERWAVE', 'USD'],
    ['NGN via Paystack', await seedPayer('NG', 'ngchange'), 'PAYSTACK', 'NGN'],
  ]) {
    await prisma.subscription.deleteMany({ where: { organizationId: payer.organization.id } });
    await prisma.subscription.create({
      data: {
        organizationId: payer.organization.id,
        payerUserId: payer.user.id,
        planId: soloPlan.id,
        status: 'ACTIVE',
        billingCurrency: currency,
        billingInterval: 'MONTHLY',
        activeProvider: provider,
        providerCustomerId: `verify-${provider}`,
        providerSubscriptionId: `verify-sub-${provider}`,
        providerManagementToken: sealCredential('email-token'),
        paymentMethodReference: sealCredential('stored-credential'),
        currentPeriodStart: new Date(Date.now() - 5 * 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 25 * 86_400_000),
        nextBillingAt: new Date(Date.now() + 25 * 86_400_000),
      },
    });

    const upgrade = await call('/billing/subscriptions/changes/preview', {
      method: 'POST', accessToken: payer.accessToken, orgId: payer.organization.id,
      body: { organizationId: payer.organization.id, planType: 'TEAM', billingInterval: 'MONTHLY' },
    });
    check(`upgrade preview prorates: ${label}`,
      upgrade.status === 200 && upgrade.body?.direction === 'UPGRADE' && upgrade.body?.amountDue > 0,
      `amountDue=${upgrade.body?.amountDue} ${upgrade.body?.currency}`);

    const downgrade = await call('/billing/subscriptions/changes/preview', {
      method: 'POST', accessToken: payer.accessToken, orgId: payer.organization.id,
      body: { organizationId: payer.organization.id, planType: 'LOCAL', billingInterval: 'MONTHLY' },
    });
    const downgradeAllowed = currency === 'NGN';
    check(`downgrade preview is offered where the plan is eligible: ${label}`,
      downgradeAllowed
        ? downgrade.status === 200 && downgrade.body?.direction === 'DOWNGRADE'
        : downgrade.status === 400 && downgrade.body?.error === 'LOCAL_PLAN_INELIGIBLE',
      `status=${downgrade.status} ${downgrade.body?.direction ?? downgrade.body?.error}`);

    if (downgradeAllowed) {
      const applied = await call('/billing/subscriptions/changes', {
        method: 'POST', accessToken: payer.accessToken, orgId: payer.organization.id,
        body: {
          organizationId: payer.organization.id,
          previewId: downgrade.body.previewId,
          effectiveMode: 'NEXT_RENEWAL',
          idempotencyKey: `verify-${crypto.randomUUID()}`,
        },
      });
      check(`a downgrade schedules without charging: ${label}`,
        [200, 202].includes(applied.status),
        `status=${applied.status} ${JSON.stringify(applied.body?.error ?? applied.body?.status ?? '')}`);

      const scheduled = await prisma.subscription.findUnique({ where: { organizationId: payer.organization.id } });
      check(`the pending plan is recorded for renewal: ${label}`,
        scheduled?.pendingPlanId != null, `pendingPlanId=${scheduled?.pendingPlanId != null}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

async function cleanup() {
  for (const record of seeded) {
    const organizationId = record.organization.id;
    await prisma.subscriptionChange.deleteMany({ where: { organizationId } });
    await prisma.billingDunningAttempt.deleteMany({ where: { organizationId } });
    await prisma.paymentEvent.deleteMany({ where: { organizationId } });
    await prisma.invoice.deleteMany({ where: { organizationId } });
    await prisma.subscriptionTrialHistory.deleteMany({ where: { organizationId } });
    await prisma.subscription.deleteMany({ where: { organizationId } });
    await prisma.entitlement.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.organizationMembership.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { userId: record.user.id } });
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    await prisma.user.delete({ where: { id: record.user.id } }).catch(() => {});
  }
}

main()
  .catch((err) => { console.error('VERIFICATION ERROR:', err); process.exitCode = 1; })
  .finally(async () => { await cleanup().catch(() => {}); await prisma.$disconnect(); });
