/**
 * Verifies that the billing page routes a customer to the right action.
 *
 * The bug this guards against: every organization gets an auto-created Free
 * subscription, which made the catalog report UPGRADE for every paid plan. The
 * dashboard then opened the plan-change dialog, which charges a card on file —
 * and a Free customer has never given one. The result was a 409 that the dialog
 * never displayed, so the button simply appeared to do nothing.
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

function sealCredential(value) {
  const key = crypto.createHash('sha256').update(process.env.BILLING_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function seedPayer(label) {
  const suffix = crypto.randomUUID();
  const email = `routing-${label}-${suffix}@example.com`;
  const user = await prisma.user.create({
    data: { email, billingProfile: { create: { countryCode: 'NG', billingEmail: email, legalName: `Routing ${label}` } } },
  });
  const organization = await prisma.organization.create({
    data: {
      name: `Routing ${label}`,
      slug: `routing-${label}-${suffix}`,
      createdByUserId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  const record = { user, organization, accessToken: jwt.sign({ sub: user.id, email }, SECRET, { expiresIn: '20m' }) };
  seeded.push(record);
  return record;
}

function actionFor(catalog, planType) {
  return catalog.body?.plans?.find((plan) => plan.type === planType)?.action;
}

async function main() {
  const health = await call('/health');
  if (health.status !== 200) {
    console.error(`billing-api is not reachable at ${BASE}.`);
    process.exitCode = 1;
    return;
  }

  const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE' } });
  const soloPlan = await prisma.plan.findUnique({ where: { type: 'SOLO' } });

  // ── A customer on Free, exactly as a new signup is ────────────────────────
  console.log('\n1. A Free customer is sent to checkout, not the change dialog');
  const free = await seedPayer('free');
  await prisma.subscription.create({
    data: {
      organizationId: free.organization.id,
      payerUserId: free.user.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      billingCurrency: 'NGN',
      nonRenewing: true,
      currentPeriodEnd: new Date(Date.now() + 100 * 365 * 86_400_000),
    },
  });

  const freeCatalog = await call(`/billing/plans?organizationId=${free.organization.id}`, { accessToken: free.accessToken });
  check('Business shows SUBSCRIBE, not UPGRADE',
    actionFor(freeCatalog, 'BUSINESS') === 'SUBSCRIBE', `action=${actionFor(freeCatalog, 'BUSINESS')}`);
  check('the catalog reports that in-place change is unavailable',
    freeCatalog.body?.canChangeInPlace === false, `canChangeInPlace=${freeCatalog.body?.canChangeInPlace}`);
  check('Free itself is still marked CURRENT', actionFor(freeCatalog, 'FREE') === 'CURRENT');
  check('Enterprise still routes to sales', actionFor(freeCatalog, 'ENTERPRISE') === 'CONTACT_SALES');

  const freeCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: free.accessToken, orgId: free.organization.id,
    body: { organizationId: free.organization.id, planType: 'BUSINESS', billingInterval: 'MONTHLY' },
  });
  check('checkout succeeds for that customer',
    freeCheckout.status === 201 && typeof freeCheckout.body?.checkoutUrl === 'string',
    freeCheckout.status === 201 ? freeCheckout.body.provider : JSON.stringify(freeCheckout.body));

  // ── The failure path still has to explain itself ─────────────────────────
  console.log('\n2. A change attempted without a card explains why');
  const preview = await call('/billing/subscriptions/changes/preview', {
    method: 'POST', accessToken: free.accessToken, orgId: free.organization.id,
    body: { organizationId: free.organization.id, planType: 'BUSINESS', billingInterval: 'MONTHLY' },
  });
  const applied = await call('/billing/subscriptions/changes', {
    method: 'POST', accessToken: free.accessToken, orgId: free.organization.id,
    body: {
      organizationId: free.organization.id,
      previewId: preview.body?.previewId,
      effectiveMode: 'IMMEDIATE',
      idempotencyKey: `routing-${crypto.randomUUID()}`,
    },
  });
  check('the error names a missing payment method',
    applied.body?.error === 'PAYMENT_METHOD_REQUIRED', `error=${applied.body?.error}`);
  check('it tells the client how to resolve it',
    applied.body?.resolution === 'CHECKOUT', `resolution=${applied.body?.resolution}`);
  check('the message is written for a person, not a log',
    typeof applied.body?.message === 'string' && !/[A-Z_]{6,}/.test(applied.body.message),
    JSON.stringify(applied.body?.message));

  // ── A paying customer must still get the change flow ─────────────────────
  console.log('\n3. A paying customer still changes plan in place');
  const paying = await seedPayer('paying');
  await prisma.subscription.create({
    data: {
      organizationId: paying.organization.id,
      payerUserId: paying.user.id,
      planId: soloPlan.id,
      status: 'ACTIVE',
      billingCurrency: 'NGN',
      billingInterval: 'MONTHLY',
      activeProvider: 'PAYSTACK',
      paymentMethodReference: sealCredential('AUTH_routing_test'),
      paymentMethodBrand: 'visa',
      paymentMethodLast4: '4081',
      currentPeriodStart: new Date(Date.now() - 5 * 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 25 * 86_400_000),
      nextBillingAt: new Date(Date.now() + 25 * 86_400_000),
    },
  });

  const payingCatalog = await call(`/billing/plans?organizationId=${paying.organization.id}`, { accessToken: paying.accessToken });
  check('a higher plan shows UPGRADE', actionFor(payingCatalog, 'BUSINESS') === 'UPGRADE', `action=${actionFor(payingCatalog, 'BUSINESS')}`);
  check('a lower plan shows DOWNGRADE', actionFor(payingCatalog, 'LOCAL') === 'DOWNGRADE', `action=${actionFor(payingCatalog, 'LOCAL')}`);
  check('in-place change is available', payingCatalog.body?.canChangeInPlace === true);
  check('the card on file is surfaced',
    payingCatalog.body?.paymentMethod?.last4 === '4081', JSON.stringify(payingCatalog.body?.paymentMethod));

  const payingCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: paying.accessToken, orgId: paying.organization.id,
    body: { organizationId: paying.organization.id, planType: 'BUSINESS', billingInterval: 'MONTHLY' },
  });
  check('checkout still redirects them to the change flow',
    payingCheckout.status === 409 && payingCheckout.body?.error === 'SUBSCRIPTION_CHANGE_REQUIRED',
    `status=${payingCheckout.status} ${payingCheckout.body?.error}`);

  // ── A lapsed customer lost their card, so checkout is right again ─────────
  console.log('\n4. A lapsed customer can check out again');
  await prisma.subscription.update({
    where: { organizationId: paying.organization.id },
    data: { paymentMethodReference: null, paymentMethodLast4: null, paymentMethodBrand: null },
  });
  const lapsedCatalog = await call(`/billing/plans?organizationId=${paying.organization.id}`, { accessToken: paying.accessToken });
  check('losing the card switches them back to SUBSCRIBE',
    actionFor(lapsedCatalog, 'BUSINESS') === 'SUBSCRIBE', `action=${actionFor(lapsedCatalog, 'BUSINESS')}`);
  const lapsedCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: paying.accessToken, orgId: paying.organization.id,
    body: { organizationId: paying.organization.id, planType: 'BUSINESS', billingInterval: 'MONTHLY' },
  });
  check('and checkout is no longer blocked',
    lapsedCheckout.status === 201, `status=${lapsedCheckout.status} ${JSON.stringify(lapsedCheckout.body?.error ?? '')}`);

  // ── The checkout status endpoint ─────────────────────────────────────────
  console.log('\n5. Checkout status resolves without a caller-supplied org');
  const statusOrg = await seedPayer('status');
  const statusCheckout = await call('/billing/subscriptions/checkout', {
    method: 'POST', accessToken: statusOrg.accessToken, orgId: statusOrg.organization.id,
    body: { organizationId: statusOrg.organization.id, planType: 'SOLO', billingInterval: 'MONTHLY' },
  });
  const invoiceId = statusCheckout.body?.invoiceId;

  // No organizationId anywhere - no body, no header, no query. This is exactly
  // how the browser polls after a provider return, and it used to answer 400.
  const status = await call(`/billing/checkouts/${invoiceId}/status`, { accessToken: statusOrg.accessToken });
  check('status resolves with no organizationId supplied',
    status.status === 200, `status=${status.status} ${JSON.stringify(status.body)}`);
  check('an unpaid checkout reports PENDING, not an error',
    status.body?.status === 'PENDING', `reported=${status.body?.status}`);

  const outsider = await seedPayer('status-outsider');
  const foreignStatus = await call(`/billing/checkouts/${invoiceId}/status`, { accessToken: outsider.accessToken });
  check('someone else cannot read it', foreignStatus.status === 404, `status=${foreignStatus.status}`);

  const anonStatus = await call(`/billing/checkouts/${invoiceId}/status`);
  check('an anonymous request cannot read it', anonStatus.status === 401, `status=${anonStatus.status}`);

  const forged = await call(`/billing/checkouts/${invoiceId}/status?reference=not-the-real-reference`, {
    accessToken: statusOrg.accessToken,
  });
  check('a forged return reference cannot activate a plan',
    forged.body?.status === 'PENDING', `reported=${forged.body?.status}`);

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
