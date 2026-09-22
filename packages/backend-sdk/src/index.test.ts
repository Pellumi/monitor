import assert from 'node:assert';
import test from 'node:test';
import { TELLANN, trackApi, captureError, trackState, trackDataAccess, runInRequestContext } from './index';
import { extractSessionId } from './integrations/express';
import { TellannEventSchema } from '@tellann/shared';

// Mock fetch
let fetchCalls: { url: string; body: any }[] = [];
(global as any).fetch = async (url: string, init?: RequestInit) => {
  fetchCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
  return { ok: true } as any;
};

test('TELLANN Backend SDK Tests', async (t) => {
  await t.test('Initialization & Config Singleton', () => {
    TELLANN.initialize({
      endpoint: 'http://collector-backend',
      tenantId: 'tenant-b1',
      applicationId: 'app-b1',
    });

    assert.ok(TELLANN.isInitialized());
    assert.strictEqual(TELLANN.getConfig()?.tenantId, 'tenant-b1');
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
      assert.doesNotThrow(() => TellannEventSchema.parse(call.body));
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

    // Prefer x-tellann-session-id if present
    const headersBoth = {
      'x-tellann-session-id': '77c8e763-71bd-4217-a06b-3bc7a1a09d3b',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    };
    assert.strictEqual(extractSessionId(headersBoth), '77c8e763-71bd-4217-a06b-3bc7a1a09d3b');
  });

  await t.test('Workflow tracking on backend with memory TTL safety', async () => {
    fetchCalls = [];
    const wId = TELLANN.startWorkflow('payment-gateway', 'sess-123');
    assert.ok(wId);
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'WORKFLOW_STARTED');

    fetchCalls = [];
    await TELLANN.completeWorkflow(wId, 'sess-123');
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'WORKFLOW_COMPLETED');
    assert.ok(fetchCalls[0].body.metadata.durationMs >= 0);

    // After completion, it shouldn't exist in map anymore
    fetchCalls = [];
    await TELLANN.completeWorkflow(wId, 'sess-123');
    assert.strictEqual(fetchCalls.length, 0); // No event because workflow was already completed/cleared
  });

  await t.test('generic trackEvent sends onboarding test events', async () => {
    fetchCalls = [];
    await TELLANN.trackEvent('TELLANN_ONBOARDING_TEST');

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'TELLANN_ONBOARDING_TEST');
    assert.doesNotThrow(() => TellannEventSchema.parse(fetchCalls[0].body));
  });

  await t.test('verifyInstallation sends onboarding test events', async () => {
    fetchCalls = [];
    await TELLANN.verifyInstallation();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.eventType, 'TELLANN_INITIALIZED');
    assert.strictEqual(fetchCalls[0].body.metadata.source, 'manual_verification');
    assert.doesNotThrow(() => TellannEventSchema.parse(fetchCalls[0].body));
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

  TELLANN.teardown();
});


test('backend capture carries the payload without carrying the credentials', async (t) => {
  TELLANN.initialize({
    endpoint: 'http://collector-backend',
    tenantId: 'tenant-c1',
    applicationId: 'app-c1',
  });

  await t.test('a request carries its route, payloads, headers and sizes', async () => {
    fetchCalls = [];
    await trackApi({
      endpoint: '/api/orders/8213',
      route: '/api/orders/:id',
      method: 'post',
      statusCode: 201,
      durationMs: 91,
      handler: 'OrdersController.create',
      framework: 'express',
      query: { include: 'items', apiKey: 'live_abc123' },
      requestBody: { note: 'rush', password: 'hunter2', customer: { email: 'a@b.test' } },
      responseBody: { id: 8213, status: 'created' },
      requestHeaders: { 'content-type': 'application/json', authorization: 'Bearer abc', cookie: 'sid=1' },
      responseHeaders: { 'content-type': 'application/json', 'set-cookie': 'sid=2' },
    });

    assert.strictEqual(fetchCalls.length, 1);
    const metadata = fetchCalls[0].body.metadata;
    assert.strictEqual(metadata.route, '/api/orders/:id');
    assert.strictEqual(metadata.endpoint, '/api/orders/8213');
    assert.strictEqual(metadata.method, 'POST');
    assert.strictEqual(metadata.handler, 'OrdersController.create');
    assert.strictEqual(metadata.responseBody.status, 'created');
    assert.ok(metadata.requestBytes > 0 && metadata.responseBytes > 0);

    // Credentials never leave the process, wherever they appear.
    assert.strictEqual(metadata.requestBody.password, '[REDACTED]');
    assert.strictEqual(metadata.query.apiKey, '[REDACTED]');
    assert.strictEqual(metadata.requestBody.note, 'rush');
    assert.strictEqual(metadata.requestHeaders.authorization, undefined);
    assert.strictEqual(metadata.requestHeaders.cookie, undefined);
    assert.strictEqual(metadata.responseHeaders['set-cookie'], undefined);
    assert.strictEqual(metadata.requestHeaders['content-type'], 'application/json');
  });

  await t.test('capture can be narrowed without losing the request', async () => {
    TELLANN.initialize({
      endpoint: 'http://collector-backend',
      applicationId: 'app-c1',
      capture: { requestBody: false, responseBody: false, headers: false },
    });
    fetchCalls = [];
    await trackApi({
      endpoint: '/api/orders',
      method: 'GET',
      statusCode: 200,
      durationMs: 12,
      requestBody: { note: 'rush' },
      responseBody: [{ id: 1 }],
      requestHeaders: { 'content-type': 'application/json' },
    });
    const metadata = fetchCalls[0].body.metadata;
    assert.strictEqual(metadata.requestBody, undefined);
    assert.strictEqual(metadata.responseBody, undefined);
    assert.strictEqual(metadata.requestHeaders, undefined);
    // Sizes survive, so throughput is still reportable.
    assert.ok(metadata.requestBytes > 0);
  });

  await t.test('an oversized payload sheds the body rather than the request', async () => {
    TELLANN.initialize({
      endpoint: 'http://collector-backend',
      applicationId: 'app-c1',
      capture: { maxBodyBytes: 256 * 1024 },
    });
    fetchCalls = [];
    // Many ordinary fields rather than one huge one: each survives the
    // per-string clip, and together they push the event past the collector's
    // 32 KB ceiling.
    await trackApi({
      endpoint: '/api/import',
      method: 'POST',
      statusCode: 202,
      durationMs: 300,
      requestBody: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => [`field${index}`, 'x'.repeat(3_000)]),
      ),
    });
    assert.strictEqual(fetchCalls.length, 1);
    const metadata = fetchCalls[0].body.metadata;
    assert.strictEqual(metadata.requestBody, undefined);
    assert.strictEqual(metadata.payloadsOmitted, 'EVENT_SIZE_LIMIT');
    assert.strictEqual(metadata.endpoint, '/api/import');
  });

  await t.test('models touched while a request is in flight are attached to it', async () => {
    TELLANN.initialize({ endpoint: 'http://collector-backend', applicationId: 'app-c1' });
    fetchCalls = [];
    const context = { method: 'POST', route: '/api/orders/:id', dataAccess: [] };
    await runInRequestContext(context, async () => {
      await trackDataAccess({ model: 'Order', operation: 'update', records: 1 });
      await trackDataAccess({ model: 'Order', operation: 'update', records: 2 });
      await trackDataAccess({ model: 'Payment', operation: 'findMany', records: 3 });
      // Nothing is sent while the request is running: a handler that queries
      // in a loop would otherwise produce a request's worth of events.
      assert.strictEqual(fetchCalls.length, 0);
      await trackApi({
        endpoint: '/api/orders/8213',
        route: '/api/orders/:id',
        method: 'POST',
        statusCode: 200,
        durationMs: 40,
      });
    });

    const request = fetchCalls.find((call) => call.body.eventType === 'API_REQUEST');
    // One entry per model and operation, with the record counts summed.
    assert.deepStrictEqual(request?.body.metadata.models, [
      { model: 'Order', operation: 'update', records: 3, count: 2, mutation: true },
      { model: 'Payment', operation: 'findMany', records: 3, count: 1, mutation: false },
    ]);

    // The integration flushes once the response is done: one row per model and
    // operation, each carrying how many operations it stands for.
    await TELLANN.flushDataAccess(context);
    const dataEvents = fetchCalls.filter((call) => call.body.eventType === 'BUSINESS_EVENT');
    assert.strictEqual(dataEvents.length, 2);
    assert.strictEqual(dataEvents[0].body.metadata.businessEventType, 'QA_BACKEND_DATA_ACCESS');
    assert.strictEqual(dataEvents[0].body.metadata.model, 'Order');
    assert.strictEqual(dataEvents[0].body.metadata.count, 2);
    assert.strictEqual(dataEvents[0].body.metadata.records, 3);
    assert.strictEqual(dataEvents[0].body.metadata.mutation, true);
    assert.strictEqual(dataEvents[0].body.metadata.route, '/api/orders/:id');
    assert.strictEqual(dataEvents[1].body.metadata.mutation, false);

    // Flushing twice must not double-report.
    fetchCalls = [];
    await TELLANN.flushDataAccess(context);
    assert.strictEqual(fetchCalls.length, 0);
  });

  await t.test('data access outside a request is reported immediately, without a route', async () => {
    fetchCalls = [];
    // No request to attach to and nothing to flush it later, so it is sent now.
    await trackDataAccess({ model: 'Invoice', operation: 'delete', records: 4 });
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.metadata.route, null);
    assert.strictEqual(fetchCalls[0].body.metadata.mutation, true);
    assert.strictEqual(fetchCalls[0].body.metadata.count, 1);
  });
});
