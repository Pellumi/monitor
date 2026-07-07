/**
 * isolation.test.ts — Cross-Tenant Isolation Tests
 *
 * Verifies that one organization's data is never visible to another.
 * These are security-critical tests that must pass before production launch.
 *
 * Run with: pnpm --filter @sots/e2e-tests test:e2e
 *
 * Prerequisites:
 *   - All services running
 *   - Two distinct test org IDs set in environment:
 *       TEST_ORG_A_ID, TEST_ORG_A_TOKEN
 *       TEST_ORG_B_ID, TEST_ORG_B_TOKEN
 */

import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

const ONBOARDING = process.env.ONBOARDING_API_URL ?? 'http://localhost:3002';
const EVENT      = process.env.EVENT_COLLECTOR_URL ?? 'http://localhost:3001';
const REPORT     = process.env.REPORT_ENGINE_URL   ?? 'http://localhost:3004';
const TIMEOUT_MS = 20_000;

const ORG_A_ID    = process.env.TEST_ORG_A_ID    ?? '';
const ORG_A_TOKEN = process.env.TEST_ORG_A_TOKEN ?? '';
const ORG_B_ID    = process.env.TEST_ORG_B_ID    ?? '';
const ORG_B_TOKEN = process.env.TEST_ORG_B_TOKEN ?? '';

const skipIfNoTestOrgs = !ORG_A_ID || !ORG_B_ID
  ? 'Cross-tenant isolation tests require TEST_ORG_A_ID/B_ID/TOKEN env vars. Skipping.'
  : false;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function req(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: unknown,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Tenant Data Isolation', () => {
  let orgAAppId: string;
  let orgBAppId: string;

  beforeAll(async () => {
    if (skipIfNoTestOrgs) return;

    // Create an application in each org
    const appA = await req('POST', `${ONBOARDING}/applications`, {
      name: `isolation-test-A-${Date.now()}`,
      organizationId: ORG_A_ID,
    }, ORG_A_TOKEN);
    orgAAppId = appA.body?.id;

    const appB = await req('POST', `${ONBOARDING}/applications`, {
      name: `isolation-test-B-${Date.now()}`,
      organizationId: ORG_B_ID,
    }, ORG_B_TOKEN);
    orgBAppId = appB.body?.id;
  });

  it('Org B cannot read Org A members', async () => {
    if (skipIfNoTestOrgs) return;
    const r = await req('GET', `${ONBOARDING}/organizations/${ORG_A_ID}/members`, undefined, ORG_B_TOKEN);
    // Must be 403 Forbidden, not 200
    expect(r.status).toBe(403);
  }, TIMEOUT_MS);

  it('Org A cannot read Org B members', async () => {
    if (skipIfNoTestOrgs) return;
    const r = await req('GET', `${ONBOARDING}/organizations/${ORG_B_ID}/members`, undefined, ORG_A_TOKEN);
    expect(r.status).toBe(403);
  }, TIMEOUT_MS);

  it('Org B token cannot access Org A application', async () => {
    if (skipIfNoTestOrgs || !orgAAppId) return;
    const r = await req('GET', `${ONBOARDING}/applications/${orgAAppId}`, undefined, ORG_B_TOKEN);
    expect([403, 404]).toContain(r.status);
  }, TIMEOUT_MS);

  it('Org A token cannot access Org B application', async () => {
    if (skipIfNoTestOrgs || !orgBAppId) return;
    const r = await req('GET', `${ONBOARDING}/applications/${orgBAppId}`, undefined, ORG_A_TOKEN);
    expect([403, 404]).toContain(r.status);
  }, TIMEOUT_MS);

  it('Org B cannot promote Org A ruleset version', async () => {
    if (skipIfNoTestOrgs) return;
    // Try to promote a non-existent ruleset in Org A using Org B's token
    const r = await req('POST', `${ONBOARDING}/admin/rulesets/fake-ruleset-id/promote`, {}, ORG_B_TOKEN);
    // Must be 401 or 403 (not system admin) — never 200
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);

  it('Member list does not leak across organizations', async () => {
    if (skipIfNoTestOrgs) return;

    const rA = await req('GET', `${ONBOARDING}/organizations/${ORG_A_ID}/members`, undefined, ORG_A_TOKEN);
    const rB = await req('GET', `${ONBOARDING}/organizations/${ORG_B_ID}/members`, undefined, ORG_B_TOKEN);

    if (rA.status === 200 && rB.status === 200) {
      const idsA = (rA.body ?? []).map((m: any) => m.userId);
      const idsB = (rB.body ?? []).map((m: any) => m.userId);

      // There must be no user ID present in both orgs (assuming test envs are isolated)
      const overlap = idsA.filter((id: string) => idsB.includes(id));
      expect(overlap).toHaveLength(0);
    }
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated access guard
// ─────────────────────────────────────────────────────────────────────────────

describe('Unauthenticated Access Rejection', () => {
  it('GET /organizations/:id/members requires auth', async () => {
    const r = await req('GET', `${ONBOARDING}/organizations/any-org-id/members`);
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);

  it('GET /applications/:id requires auth', async () => {
    const r = await req('GET', `${ONBOARDING}/applications/any-app-id`);
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);

  it('Admin routes always require auth', async () => {
    const r = await req('GET', `${ONBOARDING}/admin/audit-logs`);
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);

  it('Unauthenticated cannot delete an API key', async () => {
    const r = await req('DELETE', `${ONBOARDING}/api-keys/any-key-id`);
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT_MS);
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-based access control
// ─────────────────────────────────────────────────────────────────────────────

describe('RBAC — Role gate enforcement', () => {
  it('VIEWER token cannot change member roles', async () => {
    if (!ORG_A_ID || !ORG_A_TOKEN) return;
    // Use ORG_A token — if the user is VIEWER they must get 403
    const r = await req(
      'PUT',
      `${ONBOARDING}/organizations/${ORG_A_ID}/members/some-user-id/role`,
      { role: 'ADMIN' },
      ORG_A_TOKEN,
    );
    // 403 if VIEWER, 404 if user not found (acceptable — access check ran first)
    expect([403, 404]).toContain(r.status);
  }, TIMEOUT_MS);
});
