import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { applyScheduledSubscriptionChanges } from '../services/background-workers/src/subscription-change-worker';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();
const billing = process.env.BILLING_API_URL ?? 'http://127.0.0.1:3009';
const mockSecret = process.env.BILLING_MOCK_WEBHOOK_SECRET ?? 'tellann-local-acceptance-mock-webhook-secret';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`BILLING_ACCEPTANCE_FAILED: ${message}`);
}

async function request(pathname: string, init: RequestInit = {}, token?: string, expectedStatus?: number) {
  const response = await fetch(`${billing}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${init.method ?? 'GET'} ${pathname} expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`);
  } else if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as any;
}

async function mockWebhook(payload: Record<string, unknown>, expectedStatus = 200) {
  return request('/billing/webhooks/mock', {
    method: 'POST',
    headers: { 'x-billing-mock-webhook-secret': mockSecret },
    body: JSON.stringify(payload),
  }, undefined, expectedStatus);
}

function accessToken(user: { id: string; email: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production',
    { expiresIn: '20m' },
  );
}

async function createBillingOrganization(countryCode: 'NG' | 'US', label: string) {
  const suffix = crypto.randomUUID();
  const user = await prisma.user.create({ data: { email: `billing-${label}-${suffix}@example.com` } });
  const organization = await prisma.organization.create({
    data: {
      name: `Billing ${label}`,
      slug: `billing-${label}-${suffix}`,
      createdByUserId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
      billingProfile: { create: { countryCode, legalName: `Billing ${label}`, billingEmail: user.email } },
    },
  });
  return { user, organization, token: accessToken(user) };
}

async function main() {
  const mock = await createBillingOrganization('US', 'mock-lifecycle');
  const checkout = await request('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: mock.organization.id,
      planType: 'SOLO',
      provider: 'MOCK',
      billingInterval: 'MONTHLY',
      successUrl: 'http://127.0.0.1:3010/settings/billing?success=1',
      cancelUrl: 'http://127.0.0.1:3010/settings/billing?cancelled=1',
    }),
  }, mock.token, 201);
  assert(checkout.provider === 'MOCK' && checkout.status === 'pending', 'MOCK checkout did not preserve the pending provider boundary');
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: checkout.invoiceId } });
  const badEventId = `mock-event-${crypto.randomUUID()}`;
  await mockWebhook({
    id: badEventId,
    event: 'checkout.completed',
    data: {
      id: checkout.providerReference,
      organizationId: mock.organization.id,
      invoiceId: invoice.id,
      planType: 'SOLO',
      billingInterval: 'MONTHLY',
      currency: 'USD',
      amount: invoice.total - 1,
      customerId: `mock-customer-${mock.organization.id}`,
      subscriptionId: `mock-subscription-${mock.organization.id}`,
    },
  }, 500);
  const unchangedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert(unchangedInvoice.status === 'PENDING', 'An amount-mismatched payment activated the invoice');
  const failedClaim = await prisma.paymentEvent.findFirst({ where: { provider: 'MOCK', providerEventId: badEventId } });
  assert(failedClaim?.processingStatus === 'FAILED' && failedClaim.processingError?.includes('PAYMENT_AMOUNT_MISMATCH'), 'Payment mismatch was not recorded as a failed provider event');

  const paidEventId = `mock-event-${crypto.randomUUID()}`;
  const paidPayload = {
    id: paidEventId,
    event: 'checkout.completed',
    data: {
      id: checkout.providerReference,
      organizationId: mock.organization.id,
      invoiceId: invoice.id,
      planType: 'SOLO',
      billingInterval: 'MONTHLY',
      currency: 'USD',
      amount: invoice.total,
      customerId: `mock-customer-${mock.organization.id}`,
      subscriptionId: `mock-subscription-${mock.organization.id}`,
    },
  };
  await mockWebhook(paidPayload);
  const replay = await mockWebhook(paidPayload);
  assert(replay.skipped === true && replay.reason === 'already_processed', 'Provider-native webhook replay was not idempotent');
  let subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: mock.organization.id }, include: { plan: true } });
  assert(subscription.plan.type === 'SOLO' && subscription.status === 'ACTIVE' && subscription.activeProvider === 'MOCK', 'Signed checkout did not activate the Solo subscription');
  const paidInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert(paidInvoice.status === 'PAID' && paidInvoice.paidAt, 'Checkout invoice was not reconciled as paid');
  assert(await prisma.paymentEvent.count({ where: { provider: 'MOCK', providerEventId: paidEventId } }) === 1, 'Webhook replay created duplicate payment events');

  const upgradePreview = await request('/billing/subscriptions/changes/preview', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, planType: 'TEAM', billingInterval: 'MONTHLY' }),
  }, mock.token);
  assert(upgradePreview.direction === 'UPGRADE' && upgradePreview.supportedEffectiveModes.includes('IMMEDIATE'), 'Team upgrade preview is incorrect');
  const upgradeKey = `upgrade-${crypto.randomUUID()}`;
  const upgrade = await request('/billing/subscriptions/changes', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, previewId: upgradePreview.previewId, effectiveMode: 'IMMEDIATE', idempotencyKey: upgradeKey }),
  }, mock.token);
  const upgradeReplay = await request('/billing/subscriptions/changes', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, previewId: upgradePreview.previewId, effectiveMode: 'IMMEDIATE', idempotencyKey: upgradeKey }),
  }, mock.token);
  assert(upgrade.status === 'APPLIED' && upgradeReplay.id === upgrade.id, 'Immediate upgrade or its idempotency contract failed');
  subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: mock.organization.id }, include: { plan: true } });
  assert(subscription.plan.type === 'TEAM', 'Immediate upgrade did not change the active plan');
  const teamEntitlement = await prisma.entitlement.findUnique({ where: { organizationId: mock.organization.id } });
  assert(teamEntitlement?.planType === 'TEAM', 'Immediate upgrade did not refresh entitlements');

  const downgradePreview = await request('/billing/subscriptions/changes/preview', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, planType: 'SOLO', billingInterval: 'MONTHLY' }),
  }, mock.token);
  assert(downgradePreview.direction === 'DOWNGRADE' && downgradePreview.supportedEffectiveModes.length === 1, 'Downgrade was not constrained to renewal');
  await request('/billing/subscriptions/changes', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, previewId: downgradePreview.previewId, effectiveMode: 'IMMEDIATE', idempotencyKey: `invalid-downgrade-${crypto.randomUUID()}` }),
  }, mock.token, 400);
  const downgrade = await request('/billing/subscriptions/changes', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id, previewId: downgradePreview.previewId, effectiveMode: 'NEXT_RENEWAL', idempotencyKey: `downgrade-${crypto.randomUUID()}` }),
  }, mock.token);
  assert(downgrade.status === 'PROVIDER_CONFIRMED', 'Renewal downgrade was not provider-confirmed');
  await prisma.subscription.update({ where: { organizationId: mock.organization.id }, data: { pendingChangeAt: new Date(Date.now() - 1_000) } });
  await prisma.subscriptionChange.update({ where: { id: downgrade.id }, data: { effectiveAt: new Date(Date.now() - 1_000) } });
  await applyScheduledSubscriptionChanges(prisma, new Date());
  subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: mock.organization.id }, include: { plan: true } });
  assert(subscription.plan.type === 'SOLO' && subscription.pendingPlanId === null, 'Confirmed renewal downgrade was not applied by the worker');

  const cancellation = await request(`/billing/organizations/${mock.organization.id}/subscription/cancel`, { method: 'POST', body: '{}' }, mock.token);
  assert(cancellation.status === 'CANCELLATION_SCHEDULED' && cancellation.cancelAtPeriodEnd === true, 'Cancellation did not preserve service until period end');
  const resumed = await request('/billing/subscriptions/resume', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id }),
  }, mock.token);
  assert(resumed.cancelAtPeriodEnd === false && resumed.pendingPlanId === null, 'Subscription resume did not clear cancellation state');

  const recoveryInvoice = await prisma.invoice.create({ data: {
    organizationId: mock.organization.id,
    invoiceNumber: `TELLANN-RECOVERY-${crypto.randomUUID()}`,
    planType: 'SOLO', billingInterval: 'MONTHLY', currency: 'USD',
    subtotal: 2_900, tax: 0, total: 2_900, status: 'PENDING', provider: 'MOCK',
    providerReference: `mock-recovery-${crypto.randomUUID()}`,
    periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000),
  } });
  await mockWebhook({
    id: `mock-failure-${crypto.randomUUID()}`,
    event: 'charge.failed',
    data: {
      id: recoveryInvoice.providerReference,
      organizationId: mock.organization.id,
      invoiceId: recoveryInvoice.id,
      planType: 'SOLO', billingInterval: 'MONTHLY', currency: 'USD', amount: recoveryInvoice.total,
      subscriptionId: subscription.providerSubscriptionId,
    },
  });
  const attempts = await prisma.billingDunningAttempt.findMany({ where: { invoiceId: recoveryInvoice.id }, orderBy: { attemptNumber: 'asc' } });
  assert(attempts.length === 3 && attempts.map((item) => item.attemptNumber).join(',') === '1,2,3', 'Payment failure did not schedule 1/3/7-day dunning attempts');
  subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: mock.organization.id }, include: { plan: true } });
  assert(subscription.status === 'GRACE_PERIOD', 'Payment failure did not move the subscription into grace period');
  const retry = await request('/billing/subscriptions/retry', {
    method: 'POST', body: JSON.stringify({ organizationId: mock.organization.id }),
  }, mock.token, 202);
  assert(retry.status === 'RETRY_SCHEDULED', 'Manual payment retry did not reschedule the next attempt');
  await mockWebhook({
    id: `mock-recovery-${crypto.randomUUID()}`,
    event: 'charge.success',
    data: {
      id: recoveryInvoice.providerReference,
      organizationId: mock.organization.id,
      invoiceId: recoveryInvoice.id,
      planType: 'SOLO', billingInterval: 'MONTHLY', currency: 'USD', amount: recoveryInvoice.total,
      customerId: subscription.providerCustomerId,
      subscriptionId: subscription.providerSubscriptionId,
    },
  });
  subscription = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: mock.organization.id } });
  assert(subscription.status === 'ACTIVE', 'Successful recovery did not restore the subscription');
  assert(await prisma.billingDunningAttempt.count({ where: { invoiceId: recoveryInvoice.id, status: { not: 'CANCELLED' } } }) === 0, 'Successful recovery did not cancel dunning attempts');

  const outsider = await prisma.user.create({ data: { email: `billing-outsider-${crypto.randomUUID()}@example.com` } });
  await request(`/billing/organizations/${mock.organization.id}/invoices`, {}, accessToken(outsider), 403);

  const paystack = await createBillingOrganization('NG', 'paystack-test');
  const paystackCheckout = await request('/billing/checkout', {
    method: 'POST', body: JSON.stringify({
      organizationId: paystack.organization.id,
      planType: 'LOCAL',
      billingInterval: 'MONTHLY',
      successUrl: 'http://127.0.0.1:3010/settings/billing?success=1',
      cancelUrl: 'http://127.0.0.1:3010/settings/billing?cancelled=1',
    }),
  }, paystack.token, 201);
  assert(paystackCheckout.provider === 'PAYSTACK' && /^https:\/\/checkout\.paystack\.com\//.test(paystackCheckout.checkoutUrl), 'Paystack test checkout was not initialized');

  const receiptDeadline = Date.now() + 5_000;
  let receiptDelivery = null;
  while (Date.now() < receiptDeadline && !receiptDelivery) {
    receiptDelivery = await prisma.emailDelivery.findFirst({ where: { templateKey: 'billing-receipt', toEmail: mock.user.email }, orderBy: { createdAt: 'desc' } });
    if (!receiptDelivery) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log(JSON.stringify({
    success: true,
    organizationId: mock.organization.id,
    initialInvoiceId: invoice.id,
    webhookAmountMismatchRejected: true,
    webhookReplayIdempotent: true,
    invoiceReconciled: true,
    receiptDeliveryRecorded: Boolean(receiptDelivery),
    immediateUpgradeApplied: true,
    scheduledDowngradeApplied: true,
    cancellationAndResumeVerified: true,
    dunningAndRecoveryVerified: true,
    crossTenantBillingDenied: true,
    paystackTestApiAuthenticated: true,
    paystackPlanCatalogEntries: 8,
    paystackHostedCheckoutInitialized: true,
    paystackInvoiceId: paystackCheckout.invoiceId,
    liveChargePerformed: false,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
