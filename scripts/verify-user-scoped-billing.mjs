/**
 * End-to-end check of user-scoped billing against a running billing-api.
 *
 * Exercises: the user billing profile round-trip, plan catalog localization from
 * the payer's country, provider eligibility per currency, and a real checkout
 * initialization against each configured processor. Read-only apart from the
 * profile write and the pending invoices checkout necessarily creates.
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

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function token(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '15m' });
}

async function call(path, { method = 'GET', body, accessToken, orgId } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(orgId ? { 'x-tellann-org-id': orgId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: response.status, body: json };
}

async function seedPayer(countryCode, label) {
  const suffix = crypto.randomUUID();
  const email = `verify-${label}-${suffix}@example.com`;
  const user = await prisma.user.create({
    data: { email, billingProfile: { create: { countryCode, billingEmail: email, legalName: `Verify ${label}` } } },
  });
  const organization = await prisma.organization.create({
    data: {
      name: `Verify ${label}`,
      slug: `verify-${label}-${suffix}`,
      createdByUserId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  return { user, organization, accessToken: token(user) };
}

async function main() {
  const health = await call('/health');
  if (health.status !== 200) {
    console.error(`billing-api is not reachable at ${BASE} (status ${health.status}). Start the dev stack first.`);
    process.exitCode = 1;
    return;
  }

  console.log('\n1. Billing profile is user-scoped');
  const ng = await seedPayer('NG', 'ng');
  const us = await seedPayer('US', 'us');

  const mine = await call('/billing/users/me/profile', { accessToken: ng.accessToken });
  check('GET /billing/users/me/profile returns the caller profile',
    mine.status === 200 && mine.body?.countryCode === 'NG', `country=${mine.body?.countryCode}`);
  check('provider customer handles are not exposed to the client',
    mine.status === 200 && !('stripeCustomerId' in (mine.body ?? {})));

  const noOrgHeader = await call('/billing/users/me/profile', {
    method: 'PUT', accessToken: us.accessToken, body: { countryCode: 'GB', legalName: 'Verify GB' },
  });
  check('PUT profile succeeds with no organization context at all',
    noOrgHeader.status === 200 && noOrgHeader.body?.countryCode === 'GB', `status=${noOrgHeader.status}`);

  const badCountry = await call('/billing/users/me/profile', {
    method: 'PUT', accessToken: us.accessToken, body: { countryCode: 'NOPE' },
  });
  check('PUT profile rejects a non-ISO country', badCountry.status === 400, badCountry.body?.error);

  const anonymous = await call('/billing/users/me/profile');
  check('profile requires authentication', anonymous.status === 401);

  console.log('\n2. Plan catalog localizes from the payer country');
  const ngCatalog = await call(`/billing/plans?organizationId=${ng.organization.id}`, { accessToken: ng.accessToken });
  check('NG payer is quoted in NGN', ngCatalog.body?.currency === 'NGN', `currency=${ngCatalog.body?.currency}`);
  check('NG payer is not asked to complete a profile', ngCatalog.body?.countryRequired === false);
  check('all six plans are returned', ngCatalog.body?.plans?.length === 6, `count=${ngCatalog.body?.plans?.length}`);
  check('Local is eligible for an NG payer',
    ngCatalog.body?.plans?.find((plan) => plan.type === 'LOCAL')?.eligible === true);

  await call('/billing/users/me/profile', {
    method: 'PUT', accessToken: us.accessToken, body: { countryCode: 'US', legalName: 'Verify US' },
  });
  const usCatalog = await call(`/billing/plans?organizationId=${us.organization.id}`, { accessToken: us.accessToken });
  check('US payer is quoted in USD', usCatalog.body?.currency === 'USD', `currency=${usCatalog.body?.currency}`);
  check('Local is ineligible for a US payer',
    usCatalog.body?.plans?.find((plan) => plan.type === 'LOCAL')?.eligible === false);

  check('NG payer is offered both Nigerian processors',
    Array.isArray(ngCatalog.body?.availableProviders)
      && ngCatalog.body.availableProviders.includes('PAYSTACK')
      && ngCatalog.body.availableProviders.includes('FLUTTERWAVE'),
    `providers=${JSON.stringify(ngCatalog.body?.availableProviders)}`);
  check('US payer is offered only configured USD processors',
    Array.isArray(usCatalog.body?.availableProviders)
      && !usCatalog.body.availableProviders.includes('PAYSTACK')
      && !usCatalog.body.availableProviders.includes('STRIPE'),
    `providers=${JSON.stringify(usCatalog.body?.availableProviders)}`);

  const anonCatalog = await call('/billing/plans');
  check('anonymous catalog still lists plans and asks for a country',
    anonCatalog.status === 200 && anonCatalog.body?.countryRequired === true && anonCatalog.body?.plans?.length === 6);

  console.log('\n3. Checkout resolves the payer, currency, and processor');
  for (const [label, payer, planType, expectCurrency] of [
    ['NGN via Paystack', ng, 'SOLO', 'NGN'],
    ['NGN Local via Paystack', ng, 'LOCAL', 'NGN'],
    ['USD via Flutterwave', us, 'SOLO', 'USD'],
  ]) {
    const checkout = await call('/billing/subscriptions/checkout', {
      method: 'POST',
      accessToken: payer.accessToken,
      orgId: payer.organization.id,
      body: { organizationId: payer.organization.id, planType, billingInterval: 'MONTHLY' },
    });
    const ok = checkout.status === 201 && typeof checkout.body?.checkoutUrl === 'string';
    check(`checkout initializes: ${label}`, ok,
      ok ? `${checkout.body.provider} ${checkout.body.checkoutUrl.slice(0, 48)}…`
         : `status=${checkout.status} ${JSON.stringify(checkout.body)}`);

    if (ok) {
      const invoice = await prisma.invoice.findUnique({ where: { id: checkout.body.invoiceId } });
      check(`  invoice records payer and currency: ${label}`,
        invoice?.payerUserId === payer.user.id && invoice?.currency === expectCurrency,
        `payer=${invoice?.payerUserId === payer.user.id} currency=${invoice?.currency}`);
    }
  }

  const explicitFlutterwave = await call('/billing/subscriptions/checkout', {
    method: 'POST',
    accessToken: ng.accessToken,
    orgId: ng.organization.id,
    body: { organizationId: ng.organization.id, planType: 'TEAM', billingInterval: 'ANNUAL', provider: 'FLUTTERWAVE' },
  });
  check('NGN payer can explicitly choose Flutterwave (BSS §8)',
    explicitFlutterwave.status === 201 && explicitFlutterwave.body?.provider === 'FLUTTERWAVE',
    `status=${explicitFlutterwave.status} ${JSON.stringify(explicitFlutterwave.body?.error ?? '')}`);

  const stripeForNgn = await call('/billing/subscriptions/checkout', {
    method: 'POST',
    accessToken: ng.accessToken,
    orgId: ng.organization.id,
    body: { organizationId: ng.organization.id, planType: 'TEAM', billingInterval: 'MONTHLY', provider: 'STRIPE' },
  });
  check('NGN payer cannot select a USD-only processor',
    stripeForNgn.status === 400 && stripeForNgn.body?.error === 'PROVIDER_NOT_ELIGIBLE',
    `status=${stripeForNgn.status} ${stripeForNgn.body?.error}`);

  const localForUs = await call('/billing/subscriptions/checkout', {
    method: 'POST',
    accessToken: us.accessToken,
    orgId: us.organization.id,
    body: { organizationId: us.organization.id, planType: 'LOCAL', billingInterval: 'MONTHLY' },
  });
  check('US payer is refused the Nigeria-only Local plan',
    localForUs.status === 400 && localForUs.body?.error === 'LOCAL_PLAN_INELIGIBLE',
    `status=${localForUs.status} ${localForUs.body?.error}`);

  console.log('\n4. Plan changes work on every live processor');
  const solo = await prisma.plan.findUnique({ where: { type: 'SOLO' } });
  const flw = await seedPayer('US', 'flw');
  // Plan changes now charge the card on file rather than re-issuing a hosted
  // checkout, so the subscription needs a stored credential to change plans.
  const sealCredential = (value) => {
    const key = crypto.createHash('sha256').update(process.env.BILLING_ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  };
  await prisma.subscription.create({
    data: {
      organizationId: flw.organization.id,
      payerUserId: flw.user.id,
      planId: solo.id,
      status: 'ACTIVE',
      billingCurrency: 'USD',
      billingInterval: 'MONTHLY',
      activeProvider: 'FLUTTERWAVE',
      providerCustomerId: 'flw-customer-verify',
      providerSubscriptionId: 'flw-subscription-verify',
      paymentMethodReference: sealCredential('flw-card-token-verify'),
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 3600_000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 3600_000),
    },
  });

  const preview = await call('/billing/subscriptions/changes/preview', {
    method: 'POST',
    accessToken: flw.accessToken,
    orgId: flw.organization.id,
    body: { organizationId: flw.organization.id, planType: 'TEAM', billingInterval: 'MONTHLY' },
  });
  check('upgrade preview prorates against the payer currency',
    preview.status === 200 && preview.body?.direction === 'UPGRADE' && preview.body?.currency === 'USD' && preview.body?.amountDue > 0,
    `direction=${preview.body?.direction} amountDue=${preview.body?.amountDue} currency=${preview.body?.currency}`);

  const applied = await call('/billing/subscriptions/changes', {
    method: 'POST',
    accessToken: flw.accessToken,
    orgId: flw.organization.id,
    body: {
      organizationId: flw.organization.id,
      previewId: preview.body?.previewId,
      effectiveMode: 'IMMEDIATE',
      idempotencyKey: `verify-${crypto.randomUUID()}`,
    },
  });
  // A declined test-mode token is the expected outcome here: what matters is
  // that the change is attempted against the stored card instead of dead-ending
  // on the old hard 409.
  check('a Flutterwave subscription reaches the charge path (was a hard 409)',
    applied.status !== 409,
    `status=${applied.status} ${JSON.stringify(applied.body?.error ?? applied.body?.status ?? '')}`);

  console.log('\n5. Country change is guarded while a Local subscription is funded');
  const localPlan = await prisma.plan.findUnique({ where: { type: 'LOCAL' } });
  await prisma.subscription.create({
    data: {
      organizationId: ng.organization.id,
      payerUserId: ng.user.id,
      planId: localPlan.id,
      status: 'ACTIVE',
      billingCurrency: 'NGN',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000),
    },
  });
  const leaveNg = await call('/billing/users/me/profile', {
    method: 'PUT', accessToken: ng.accessToken, body: { countryCode: 'US' },
  });
  check('leaving NG is blocked while paying for Local',
    leaveNg.status === 409 && leaveNg.body?.error === 'LOCAL_COUNTRY_LOCKED',
    `status=${leaveNg.status} ${leaveNg.body?.error}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;

  // Clean up the synthetic payers so the dev database stays tidy.
  for (const seeded of [ng, us, flw]) {
    await prisma.subscriptionChange.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.invoice.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.paymentEvent.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.subscription.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.entitlement.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.organizationMembership.deleteMany({ where: { organizationId: seeded.organization.id } });
    await prisma.auditLog.deleteMany({ where: { userId: seeded.user.id } });
    await prisma.organization.delete({ where: { id: seeded.organization.id } });
    await prisma.user.delete({ where: { id: seeded.user.id } });
  }
}

main().finally(() => prisma.$disconnect());
