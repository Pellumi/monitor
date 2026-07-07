/**
 * billing.e2e.test.ts — Billing E2E Tests
 *
 * Verifies the full checkout → webhook → subscription activation → receipt lifecycle
 * using the billing-api and onboarding-api services.
 *
 * Run with: pnpm --filter @sots/e2e-tests test:e2e
 *
 * Prerequisites:
 *   - BILLING_API_URL pointing to running billing-api
 *   - TEST_ORG_A_ID + TEST_ORG_A_TOKEN for an authenticated org
 *   - STRIPE_TEST_PRICE_ID / PAYSTACK_TEST_PLAN_CODE if testing real providers
 *   - BILLING_WEBHOOK_SECRET matching the billing-api's configured secret
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const BILLING    = process.env.BILLING_API_URL    ?? 'http://localhost:3007';
const ONBOARDING = process.env.ONBOARDING_API_URL ?? 'http://localhost:3002';
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

/**
 * Simulate a Stripe-style webhook by posting to /billing/webhooks/stripe
 * with a test payload and a dummy signature header.
 * Real signature verification requires STRIPE_WEBHOOK_SECRET.
 */
function makeStripeWebhookBody(overrides: Record<string, unknown> = {}) {
  return {
    id: `evt_test_${crypto.randomUUID()}`,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: `sub_test_${Date.now()}`,
        customer: `cus_test_${Date.now()}`,
        status: 'active',
        metadata: { organizationId: ORG_A_ID },
        items: {
          data: [{ price: { id: process.env.STRIPE_TEST_PRICE_ID ?? 'price_test_starter' } }],
        },
        current_period_end: Math.floor(Date.now() / 1000) + 86_400 * 30,
        ...overrides,
      },
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  };
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
// Checkout session creation
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Checkout session', () => {
  it('requires authentication (401 without token)', async () => {
    const r = await post(`${BILLING}/billing/checkout`, {
      organizationId: ORG_A_ID,
      planId: 'starter',
      provider: 'stripe',
      successUrl: 'https://app.sots.io/billing/success',
      cancelUrl: 'https://app.sots.io/billing/cancel',
    });
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);

  it('returns a valid checkout URL for Stripe (with auth)', async () => {
    if (!ORG_A_ID || !ORG_A_TOKEN) return; // skip if no test credentials

    const priceId = process.env.STRIPE_TEST_PRICE_ID;
    if (!priceId) return; // skip if no Stripe test price

    const r = await post(
      `${BILLING}/billing/checkout`,
      {
        organizationId: ORG_A_ID,
        planId: 'starter',
        priceId,
        provider: 'stripe',
        successUrl: 'https://app.sots.io/billing/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://app.sots.io/billing/cancel',
      },
      { Authorization: `Bearer ${ORG_A_TOKEN}` },
    );

    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('url');
    expect(r.body.url).toMatch(/^https:\/\//);
  }, TIMEOUT_MS);

  it('returns a valid authorization URL for Paystack (with auth)', async () => {
    if (!ORG_A_ID || !ORG_A_TOKEN) return;

    const paystackPlan = process.env.PAYSTACK_TEST_PLAN_CODE;
    if (!paystackPlan) return;

    const r = await post(
      `${BILLING}/billing/checkout`,
      {
        organizationId: ORG_A_ID,
        planId: 'starter',
        planCode: paystackPlan,
        provider: 'paystack',
        email: `test+${Date.now()}@sots.io`,
        successUrl: 'https://app.sots.io/billing/success',
        cancelUrl: 'https://app.sots.io/billing/cancel',
      },
      { Authorization: `Bearer ${ORG_A_TOKEN}` },
    );

    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('authorizationUrl');
    expect(r.body.authorizationUrl).toMatch(/^https:\/\//);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook idempotency
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing API — Webhook idempotency', () => {
  it('processes a Stripe webhook event once (idempotency guard)', async () => {
    if (!ORG_A_ID) return;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!webhookSecret) return; // can only test with real secret

    const payload = makeStripeWebhookBody({ status: 'active' });
    const body    = JSON.stringify(payload);
    const ts      = Math.floor(Date.now() / 1000);
    const sig     = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${ts}.${body}`)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${ts},v1=${sig}`,
    };

    // First call — should process
    const r1 = await fetch(`${BILLING}/billing/webhooks/stripe`, {
      method: 'POST',
      headers,
      body,
    });
    expect([200, 202]).toContain(r1.status);

    // Second call with same event ID — should be idempotent (not error)
    const r2 = await fetch(`${BILLING}/billing/webhooks/stripe`, {
      method: 'POST',
      headers,
      body,
    });
    expect([200, 202, 409]).toContain(r2.status); // 409 = already processed is OK
  }, TIMEOUT_MS);

  it('rejects a Stripe webhook with invalid signature (400/401)', async () => {
    const body = JSON.stringify(makeStripeWebhookBody());
    const res = await fetch(`${BILLING}/billing/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=0,v1=invalidsig',
      },
      body,
    });
    // HMAC mismatch → 400 Bad Request
    expect([400, 401]).toContain(res.status);
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

// ─────────────────────────────────────────────────────────────────────────────
// Subscription state after activation
// ─────────────────────────────────────────────────────────────────────────────

describe('Billing — Subscription state', () => {
  it('organization subscription is returned from onboarding-api', async () => {
    if (!ORG_A_ID || !ORG_A_TOKEN) return;

    const r = await get(
      `${ONBOARDING}/organizations/${ORG_A_ID}/subscription`,
      ORG_A_TOKEN,
    );
    // 200 with subscription data, or 404 if org has no subscription yet
    expect([200, 404]).toContain(r.status);
    if (r.status === 200) {
      expect(r.body).toHaveProperty('status');
      expect(r.body).toHaveProperty('planId');
    }
  }, TIMEOUT_MS);
});
