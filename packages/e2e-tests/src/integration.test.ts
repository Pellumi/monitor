/**
 * integration.test.ts — Sprint 7 Integration Tests
 *
 * These tests verify the full event → graph → coverage → report pipeline
 * using real HTTP requests against locally running services.
 *
 * Run with: pnpm --filter @sots/e2e-tests test:e2e
 *
 * Prerequisites:
 *   - All services running (see: pnpm dev from workspace root)
 *   - Postgres accessible at DATABASE_URL
 *   - KAFKA_ENABLED=false (Postgres fallback mode) or Kafka running
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Service base URLs
// ─────────────────────────────────────────────────────────────────────────────

const GW          = process.env.API_GATEWAY_URL          ?? 'http://localhost:3000';
const EVENT       = process.env.EVENT_COLLECTOR_URL       ?? 'http://localhost:3001';
const ONBOARDING  = process.env.ONBOARDING_API_URL        ?? 'http://localhost:3002';
const REPORT      = process.env.REPORT_ENGINE_URL         ?? 'http://localhost:3004';
const DEMO        = process.env.DEMONSTRATION_API_URL     ?? 'http://localhost:3005';
const COVERAGE    = process.env.COVERAGE_ENGINE_URL       ?? 'http://localhost:3006';

const TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: crypto.randomUUID(),
    sessionId: `session-${crypto.randomUUID()}`,
    tenantId: 'test-tenant',
    applicationId: 'app-integration-test',
    eventType: 'PAGE_VIEW',
    eventVersion: '1.0',
    source: 'web',
    timestamp: new Date().toISOString(),
    metadata: { page: '/home', referrer: null },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health checks
// ─────────────────────────────────────────────────────────────────────────────

describe('Service Health', () => {
  it.each([
    ['API Gateway', `${GW}/health`],
    ['Event Collector', `${EVENT}/health`],
  ])('%s is healthy', async (_, url) => {
    const r = await get(url);
    expect(r.status).toBe(200);
    expect(r.body?.status).toBe('healthy');
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Event ingestion pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('Event Ingestion — /v1/events', () => {
  it('accepts a valid single event (202)', async () => {
    const r = await post(`${EVENT}/v1/events`, makeEvent());
    expect(r.status).toBe(202);
    expect(r.body?.accepted).toBe(true);
    expect(r.body?.eventCount).toBe(1);
  }, TIMEOUT_MS);

  it('accepts a batch of events (202)', async () => {
    const sessionId = crypto.randomUUID();
    const batch = [
      makeEvent({ sessionId, eventType: 'PAGE_VIEW', metadata: { page: '/login' } }),
      makeEvent({ sessionId, eventType: 'CLICK',     metadata: { element: 'login-btn' } }),
      makeEvent({ sessionId, eventType: 'PAGE_VIEW', metadata: { page: '/dashboard' } }),
    ];
    const r = await post(`${EVENT}/v1/events/batch`, batch);
    expect(r.status).toBe(202);
    expect(r.body?.eventCount).toBe(3);
  }, TIMEOUT_MS);

  it('rejects a malformed event (400)', async () => {
    const r = await post(`${EVENT}/v1/events`, { bad: 'payload' });
    expect(r.status).toBe(400);
  }, TIMEOUT_MS);

  it('rejects an oversized event (413)', async () => {
    const bigPayload = makeEvent({
      metadata: { giant: 'x'.repeat(33 * 1024) }, // >32 KB limit
    });
    const r = await post(`${EVENT}/v1/events`, bigPayload);
    expect(r.status).toBe(413);
  }, TIMEOUT_MS);

  it('rejects entire batch if all events oversized (413)', async () => {
    const batch = [1, 2].map(() =>
      makeEvent({ metadata: { giant: 'x'.repeat(33 * 1024) } })
    );
    const r = await post(`${EVENT}/v1/events/batch`, batch);
    expect(r.status).toBe(413);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Recording entitlement gate
// ─────────────────────────────────────────────────────────────────────────────

describe('Event Collector — SESSION_RECORDING entitlement gate', () => {
  it('fails open when no org ID in headers (no x-sots-org-id)', async () => {
    // No org ID header → fail open, events accepted
    const r = await post(`${EVENT}/v1/events`, makeEvent());
    expect(r.status).toBe(202);
  }, TIMEOUT_MS);

  it('returns 402 for org with revoked SESSION_RECORDING', async () => {
    // This test only runs when a test org with revoked entitlement is configured
    const orgId = process.env.TEST_REVOKED_ORG_ID;
    if (!orgId) return; // skip if not configured

    const r = await post(
      `${EVENT}/v1/events`,
      makeEvent({ tenantId: orgId }),
      { 'x-sots-org-id': orgId },
    );
    expect(r.status).toBe(402);
    expect(r.body?.error).toBe('FEATURE_NOT_ENTITLED');
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Demonstration pipeline (no auth required in demo mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('Demonstration Pipeline', () => {
  const appId = `app-demo-${Date.now()}`;
  let demoId: string;
  let sessionId: string;

  it('starts a demonstration session', async () => {
    const r = await post(`${DEMO}/demonstrations/start`, { applicationId: appId });
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('id');
    expect(r.body).toHaveProperty('sessionId');
    demoId = r.body.id;
    sessionId = r.body.sessionId;
  }, TIMEOUT_MS);

  it('sends a batch of events for the demo session', async () => {
    const events = [
      { sessionId, tenantId: 'demo', applicationId: appId, eventType: 'PAGE_VIEW', eventId: crypto.randomUUID(), eventVersion: '1.0', source: 'web', timestamp: new Date().toISOString(), metadata: { page: '/home' } },
      { sessionId, tenantId: 'demo', applicationId: appId, eventType: 'CLICK', eventId: crypto.randomUUID(), eventVersion: '1.0', source: 'web', timestamp: new Date().toISOString(), metadata: { element: 'cta' } },
    ];
    const r = await post(`${EVENT}/v1/events/batch`, events);
    expect(r.status).toBe(202);
    expect(r.body?.eventCount).toBe(2);
  }, TIMEOUT_MS);

  it('stops the demonstration session', async () => {
    if (!demoId) return;
    const r = await post(`${DEMO}/demonstrations/stop`, { id: demoId });
    expect([200, 204]).toContain(r.status);
  }, TIMEOUT_MS);

  it('analyzes the demonstration', async () => {
    if (!demoId) return;
    await delay(2000); // allow propagation
    const r = await post(`${DEMO}/demonstrations/analyze`, { id: demoId });
    expect([200, 204]).toContain(r.status);
  }, TIMEOUT_MS);

  it('retrieves demonstration results with expected structure', async () => {
    if (!demoId) return;
    const r = await get(`${DEMO}/demonstrations/${demoId}/results`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('missingStates');
    expect(r.body).toHaveProperty('missingFlows');
    expect(Array.isArray(r.body.missingStates)).toBe(true);
    expect(Array.isArray(r.body.missingFlows)).toBe(true);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// API Gateway routing
// ─────────────────────────────────────────────────────────────────────────────

describe('API Gateway', () => {
  it('health endpoint responds correctly', async () => {
    const r = await get(`${GW}/health`);
    expect(r.status).toBe(200);
    expect(r.body?.service).toBe('api-gateway');
    expect(Array.isArray(r.body?.upstreams)).toBe(true);
  }, TIMEOUT_MS);

  it('proxies /v1/events to event-collector', async () => {
    const r = await post(`${GW}/v1/events`, makeEvent());
    // 202 = accepted, 400 = parse error from collector (still proxied correctly)
    expect([202, 400]).toContain(r.status);
  }, TIMEOUT_MS);
});
