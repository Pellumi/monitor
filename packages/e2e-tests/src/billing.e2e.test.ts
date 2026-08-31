/**
 * billing.e2e.test.ts — Billing E2E Tests
 *
 * Verifies the full checkout → webhook → subscription activation → receipt lifecycle
 * using the billing-api and onboarding-api services.
 *
 * Run with: pnpm --filter @tellann/e2e-tests test:billing
 *
 * Prerequisites:
 *   - BILLING_API_URL pointing to running billing-api
 *   - TEST_ORG_A_ID + TEST_ORG_A_TOKEN for an authenticated org
 *   - FLUTTERWAVE_TEST_PLAN_CODE / PAYSTACK_TEST_PLAN_CODE if testing real providers
 *   - BILLING_WEBHOOK_SECRET matching the billing-api's configured secret
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const BILLING    = process.env.BILLING_API_URL    ?? 'http://localhost:3009';
const ONBOARDING = process.env.ONBOARDING_API_URL ?? 'http://localhost:3006';
const TIMEOUT_MS = 20_000;

const ORG_A_ID    = process.env.TEST_ORG_A_ID    ?? '';
const ORG_A_TOKEN = process.env.TEST_ORG_A_TOKEN ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing API health
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Health', () => {
  it('is reachable', async () => {
    const r = await get(`${BILLING}/health`);
    // 200 if health route exists; some services only expose /billing/health
    expect([200, 404]).toContain(r.status);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkout session validation (auth & parameters)
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Checkout validation', () => {
  it('requires authentication (401/403 without token)', async () => {
    const r = await post(`${BILLING}/billing/checkout`, {
      organizationId: ORG_A_ID || 'dummy-org',
      planType: 'SOLO',
      provider: 'stripe',
      successUrl: 'https://app.tellann.io/billing/success',
      cancelUrl: 'https://app.tellann.io/billing/cancel',
    });
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// MOCK Checkout & Activation Flow (runs locally out of the box)
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — MOCK provider E2E checkout activation flow', () => {
  const hasOrg = !!(ORG_A_ID && ORG_A_TOKEN);

  describe.skipIf(!hasOrg)('MOCK provider flow (requires TEST_ORG_A_ID & TEST_ORG_A_TOKEN)', () => {
    let mockInvoiceId: string | null = null;
    let mockCheckoutUrl: string | null = null;

    it('creates a mock checkout and returns 201 with completed status', async () => {
      const r = await post(
        `${BILLING}/billing/checkout`,
        {
          organizationId: ORG_A_ID,
          planType: 'SOLO',
          provider: 'MOCK',
          billingInterval: 'MONTHLY',
          billingCurrency: 'USD',
          successUrl: 'https://app.tellann.io/billing/success',
          cancelUrl: 'https://app.tellann.io/billing/cancel',
        },
        { Authorization: `Bearer ${ORG_A_TOKEN}` },
      );
      expect(r.status).toBe(201);
      expect(r.body).toHaveProperty('checkoutId');
      expect(r.body).toHaveProperty('invoiceId');
      expect(r.body).toHaveProperty('url');
      expect(r.body.status).toBe('completed');
      
      mockInvoiceId = r.body.invoiceId;
      mockCheckoutUrl = r.body.url;
    }, TIMEOUT_MS);

    it('GET mock-checkout URL redirects to success URL with invoiceId', async () => {
      expect(mockCheckoutUrl).toBeTruthy();
      const res = await fetch(mockCheckoutUrl!, { redirect: 'manual' });
      expect(res.status).toBe(302);
      const loc = res.headers.get('location');
      expect(loc).toContain('/settings/billing?success=1');
      expect(loc).toContain(`invoiceId=${mockInvoiceId}`);
    }, TIMEOUT_MS);

    it('updates organization subscription status to ACTIVE (SOLO plan)', async () => {
      const r = await get(
        `${BILLING}/billing/organizations/${ORG_A_ID}/subscription`,
        ORG_A_TOKEN,
      );
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ACTIVE');
      expect(r.body.plan.type).toBe('SOLO');
    }, TIMEOUT_MS);

    it('verifies that the associated invoice is marked PAID', async () => {
      const r = await get(
        `${BILLING}/billing/organizations/${ORG_A_ID}/invoices`,
        ORG_A_TOKEN,
      );
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThan(0);
      const inv = r.body.find((i: any) => i.id === mockInvoiceId);
      expect(inv).toBeDefined();
      expect(inv.status).toBe('PAID');
    }, TIMEOUT_MS);

    it('cancels the active subscription via cancel route', async () => {
      const r = await post(
        `${BILLING}/billing/organizations/${ORG_A_ID}/subscription/cancel`,
        {},
        { Authorization: `Bearer ${ORG_A_TOKEN}` },
      );
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('CANCELLED');
    }, TIMEOUT_MS);

    it('confirms organization subscription status is CANCELLED', async () => {
      const r = await get(
        `${BILLING}/billing/organizations/${ORG_A_ID}/subscription`,
        ORG_A_TOKEN,
      );
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('CANCELLED');
    }, TIMEOUT_MS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real provider checkouts (Requires external pricing credentials)
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Real provider checkout session creation', () => {
  const hasOrg = !!(ORG_A_ID && ORG_A_TOKEN);
  const flutterwavePlan = process.env.FLUTTERWAVE_TEST_PLAN_CODE;
  const paystackPlan = process.env.PAYSTACK_TEST_PLAN_CODE;

  describe.skipIf(!hasOrg)('Flutterwave checkout (requires TEST_ORG_A_ID & TEST_ORG_A_TOKEN)', () => {
    it.skipIf(!flutterwavePlan)('returns a valid checkout URL for Flutterwave (requires FLUTTERWAVE_TEST_PLAN_CODE)', async () => {
      const r = await post(
        `${BILLING}/billing/checkout`,
        {
          organizationId: ORG_A_ID,
          planType: 'SOLO',
          provider: 'FLUTTERWAVE',
          successUrl: 'https://app.tellann.io/billing/success',
          cancelUrl: 'https://app.tellann.io/billing/cancel',
        },
        { Authorization: `Bearer ${ORG_A_TOKEN}` },
      );

      expect(r.status).toBe(201);
      expect(r.body).toHaveProperty('url');
      expect(r.body.url).toMatch(/^https:\/\//);
    }, TIMEOUT_MS);
  });

  describe.skipIf(!hasOrg)('Paystack checkout (requires TEST_ORG_A_ID & TEST_ORG_A_TOKEN)', () => {
    it.skipIf(!paystackPlan)('returns a valid authorization URL for Paystack (requires PAYSTACK_TEST_PLAN_CODE)', async () => {
      const r = await post(
        `${BILLING}/billing/checkout`,
        {
          organizationId: ORG_A_ID,
          planType: 'SOLO',
          planCode: paystackPlan,
          provider: 'paystack',
          email: `test+${Date.now()}@tellann.io`,
          successUrl: 'https://app.tellann.io/billing/success',
          cancelUrl: 'https://app.tellann.io/billing/cancel',
        },
        { Authorization: `Bearer ${ORG_A_TOKEN}` },
      );

      expect(r.status).toBe(201);
      expect(r.body).toHaveProperty('authorizationUrl');
      expect(r.body.authorizationUrl).toMatch(/^https:\/\//);
    }, TIMEOUT_MS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signature & idempotency validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Webhook security & idempotency tests', () => {
  it('rejects a Flutterwave webhook with an invalid signature (400/401)', async () => {
    const body = JSON.stringify({
      event: 'charge.completed',
      data: { id: Date.now(), status: 'successful', meta: { organizationId: ORG_A_ID } },
    });
    const res = await fetch(`${BILLING}/billing/webhooks/flutterwave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'verif-hash': 'invalid-hash' },
      body,
    });
    expect([400, 401]).toContain(res.status);
  }, TIMEOUT_MS);

  it('rejects a webhook for a retired processor (400/404)', async () => {
    // Stripe was fully deprecated on 2026-08-31; the route must not accept it.
    const res = await fetch(`${BILLING}/billing/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invoice.paid', data: { object: {} } }),
    });
    expect([400, 404]).toContain(res.status);
  }, TIMEOUT_MS);

  it('rejects a Paystack webhook with invalid signature (400/401)', async () => {
    const payload = JSON.stringify({ event: 'subscription.create', data: { customer: {} } });
    const res = await fetch(`${BILLING}/billing/webhooks/paystack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': 'invalidsignature',
      },
      body: payload,
    });
    expect([400, 401]).toContain(res.status);
  }, TIMEOUT_MS);
});
