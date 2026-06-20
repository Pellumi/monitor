import assert from 'node:assert';
import test from 'node:test';
import { SOTS, trackApi, captureError, trackState } from './index';
import { extractSessionId } from './integrations/express';
import { SotsEventSchema } from '@sots/shared';

// Mock fetch
let fetchCalls: { url: string; body: any }[] = [];
(global as any).fetch = async (url: string, init?: RequestInit) => {
  fetchCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
  return { ok: true } as any;
};

test('SOTS Backend SDK Tests', async (t) => {
  await t.test('Initialization & Config Singleton', () => {
    SOTS.initialize({
      endpoint: 'http://collector-backend',
      tenantId: 'tenant-b1',
      applicationId: 'app-b1',
    });

    assert.ok(SOTS.isInitialized());
    assert.strictEqual(SOTS.getConfig()?.tenantId, 'tenant-b1');
  });

  await t.test('trackApi & captureError promoted methods and free functions', async () => {
    fetchCalls = [];
    
    await trackApi({
      endpoint: '/api/v1/users',
      method: 'GET',
      statusCode: 200,
      durationMs: 45,
      sessionId: '77c8e763-71bd-4217-a06b-3bc7a1a09d3b',
    });

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'API_REQUEST');
    assert.strictEqual(fetchCalls[0].body.metadata.endpoint, '/api/v1/users');
    assert.strictEqual(fetchCalls[0].body.sessionId, '77c8e763-71bd-4217-a06b-3bc7a1a09d3b');

    fetchCalls = [];
    await captureError({
      error: new Error('Database connection failed'),
      sessionId: '77c8e763-71bd-4217-a06b-3bc7a1a09d3b',
    });

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'SERVER_ERROR');
    assert.strictEqual(fetchCalls[0].body.metadata.message, 'Database connection failed');
  });

  await t.test('backend helpers generate collector-compatible session ids when omitted', async () => {
    fetchCalls = [];

    await trackApi({
      endpoint: '/api/v1/health',
      method: 'GET',
      statusCode: 200,
      durationMs: 12,
    });
    await captureError({ error: new Error('Background job failed') });
    await trackState({ stateName: 'JOB_RETRYING' });

    assert.strictEqual(fetchCalls.length, 3);
    for (const call of fetchCalls) {
      assert.doesNotThrow(() => SotsEventSchema.parse(call.body));
      assert.match(call.body.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  });

  await t.test('W3C Traceparent session extraction', () => {
    // Standard W3C traceparent header: version-traceId-parentId-traceFlags
    const headers = {
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    };

    const sessionId = extractSessionId(headers);
    // traceId is 4bf92f3577b34da6a3ce929d0e0e4736
    // formatted: 4bf92f35-77b3-4da6-a3ce-929d0e0e4736
    assert.strictEqual(sessionId, '4bf92f35-77b3-4da6-a3ce-929d0e0e4736');

    // Prefer x-sots-session-id if present
    const headersBoth = {
      'x-sots-session-id': '77c8e763-71bd-4217-a06b-3bc7a1a09d3b',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    };
    assert.strictEqual(extractSessionId(headersBoth), '77c8e763-71bd-4217-a06b-3bc7a1a09d3b');
  });

  await t.test('Workflow tracking on backend with memory TTL safety', async () => {
    fetchCalls = [];
    const wId = SOTS.startWorkflow('payment-gateway', 'sess-123');
    assert.ok(wId);
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'WORKFLOW_STARTED');

    fetchCalls = [];
    await SOTS.completeWorkflow(wId, 'sess-123');
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'WORKFLOW_COMPLETED');
    assert.ok(fetchCalls[0].body.metadata.durationMs >= 0);

    // After completion, it shouldn't exist in map anymore
    fetchCalls = [];
    await SOTS.completeWorkflow(wId, 'sess-123');
    assert.strictEqual(fetchCalls.length, 0); // No event because workflow was already completed/cleared
  });

  await t.test('generic trackEvent sends onboarding test events', async () => {
    fetchCalls = [];
    await SOTS.trackEvent('SOTS_ONBOARDING_TEST');

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'SOTS_ONBOARDING_TEST');
    assert.doesNotThrow(() => SotsEventSchema.parse(fetchCalls[0].body));
  });

  await t.test('verifyInstallation sends onboarding test events', async () => {
    fetchCalls = [];
    await SOTS.verifyInstallation();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'SOTS_ONBOARDING_TEST');
    assert.strictEqual(fetchCalls[0].body.metadata.source, 'manual_verification');
    assert.doesNotThrow(() => SotsEventSchema.parse(fetchCalls[0].body));
  });

  await t.test('trackState method works', async () => {
    fetchCalls = [];
    await trackState({
      stateName: 'ORDER_PLACED',
      category: 'BUSINESS',
      sessionId: 'sess-123'
    });

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'STATE_ENTERED');
    assert.strictEqual(fetchCalls[0].body.metadata.stateName, 'ORDER_PLACED');
  });

  SOTS.teardown();
});
