import assert from 'node:assert';
import test from 'node:test';

// Mock Browser Environment
const clickListeners: Function[] = [];
const submitListeners: Function[] = [];
const errorListeners: Function[] = [];
const rejectionListeners: Function[] = [];

(global as any).window = {
  setInterval: (cb: Function, ms: number) => {
    return 123 as any;
  },
  clearInterval: (id: any) => {},
  location: { href: 'http://localhost/test' },
  addEventListener: (event: string, cb: Function) => {
    if (event === 'error') errorListeners.push(cb);
    if (event === 'unhandledrejection') rejectionListeners.push(cb);
  },
  removeEventListener: () => {},
  dispatchEvent: () => {}
};

(global as any).document = {
  title: 'Test Page',
  referrer: '',
  addEventListener: (event: string, cb: Function) => {
    if (event === 'click') clickListeners.push(cb);
    if (event === 'submit') submitListeners.push(cb);
  },
  removeEventListener: () => {},
};

(global as any).navigator = {
  sendBeacon: () => true,
};

(global as any).history = {
  pushState: () => {},
  replaceState: () => {},
};

// Mock fetch
let fetchCalls: { url: string; body: any; headers?: any }[] = [];
(global as any).fetch = async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url,
    body: init?.body ? JSON.parse(init.body as string) : null,
    headers: init?.headers,
  });
  return { ok: true } as any;
};

// Now import SDK
import { SOTS } from './index';
import { sanitizeMetadata } from './auto-track';

test('SOTS Frontend SDK Tests', async (t) => {
  await t.test('Initialization & Session Tracking', () => {
    SOTS.initialize({
      endpoint: 'http://collector',
      tenantId: 't1',
      applicationId: 'app1',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    const config = (SOTS as any).config;
    assert.strictEqual(config.tenantId, 't1');
    assert.strictEqual(config.applicationId, 'app1');
    assert.ok((SOTS as any).sessionId);
  });

  await t.test('Workflow tracking and completion durations', () => {
    const wId = SOTS.startWorkflow('order-checkout');
    assert.ok(wId);

    // Complete workflow should emit WORKFLOW_COMPLETED
    SOTS.completeWorkflow(wId);
    
    // Check that we captured the events in the buffer
    const buffer = (SOTS as any).eventBuffer;
    const startedEvent = buffer.find((e: any) => e.eventType === 'WORKFLOW_STARTED');
    const completedEvent = buffer.find((e: any) => e.eventType === 'WORKFLOW_COMPLETED');
    
    assert.ok(startedEvent);
    assert.strictEqual(startedEvent.metadata.workflowName, 'order-checkout');
    assert.ok(completedEvent);
    assert.strictEqual(completedEvent.metadata.workflowName, 'order-checkout');
    assert.ok(typeof completedEvent.metadata.durationMs === 'number');
  });

  await t.test('Size limit enforcement drops large events (>32KB)', () => {
    // Clear buffer
    (SOTS as any).eventBuffer = [];

    // Small event should pass
    SOTS.trackEvent('PAGE_VIEW', { msg: 'short' });
    assert.strictEqual((SOTS as any).eventBuffer.length, 1);

    // Large event should be discarded
    const hugeMetadata = { data: 'x'.repeat(40 * 1024) }; // 40KB
    SOTS.trackEvent('PAGE_VIEW', hugeMetadata);
    assert.strictEqual((SOTS as any).eventBuffer.length, 1); // still 1!
  });

  await t.test('Privacy sanitization of metadata', () => {
    const rawMeta = {
      password: 'my-secret-password',
      credit_card: '1234-5678-9012-3456',
      safeKey: 'perfectly-fine-value'
    };

    const sanitized = sanitizeMetadata(rawMeta);
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.credit_card, '[REDACTED]');
    assert.strictEqual(sanitized.safeKey, 'perfectly-fine-value');
  });

  await t.test('authenticated flush uses fetch with gateway headers', async () => {
    SOTS.teardown();
    fetchCalls = [];
    (global as any).navigator.sendBeacon = () => {
      throw new Error('sendBeacon should not be used when gateway headers are required');
    };

    SOTS.initialize({
      endpoint: 'http://gateway',
      tenantId: 'tenant-auth',
      applicationId: 'app-auth',
      apiKey: 'sots_test_key',
      environmentId: 'env-auth',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    await (SOTS as any).flush();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'http://gateway/v1/events/batch');
    assert.strictEqual(fetchCalls[0].headers.Authorization, 'Bearer sots_test_key');
    assert.strictEqual(fetchCalls[0].headers['x-sots-environment-id'], 'env-auth');
  });

  await t.test('verifyInstallation sends onboarding test event immediately', async () => {
    SOTS.teardown();
    fetchCalls = [];

    SOTS.initialize({
      endpoint: 'http://gateway',
      tenantId: 'tenant-auth',
      applicationId: 'app-auth',
      apiKey: 'sots_test_key',
      environmentId: 'env-auth',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    fetchCalls = [];
    await SOTS.verifyInstallation();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'http://gateway/v1/events/batch');
    assert.ok(Array.isArray(fetchCalls[0].body));
    assert.ok(fetchCalls[0].body.some((event: any) => event.eventType === 'SOTS_ONBOARDING_TEST'));
  });

  SOTS.teardown();
});
