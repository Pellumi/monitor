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

const navigatorMock = {
  sendBeacon: () => true,
};
Object.defineProperty(global, 'navigator', { value: navigatorMock, configurable: true });

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
import { TELLANN } from './index.js';
import { sanitizeMetadata } from './auto-track.js';

test('TELLANN Frontend SDK Tests', async (t) => {
  await t.test('Initialization & Session Tracking', () => {
    TELLANN.initialize({
      endpoint: 'http://collector',
      tenantId: 't1',
      applicationId: 'app1',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    const config = (TELLANN as any).config;
    assert.strictEqual(config.tenantId, 't1');
    assert.strictEqual(config.applicationId, 'app1');
    assert.ok((TELLANN as any).sessionId);
  });

  await t.test('Workflow tracking and completion durations', () => {
    const wId = TELLANN.startWorkflow('order-checkout');
    assert.ok(wId);

    // Complete workflow should emit WORKFLOW_COMPLETED
    TELLANN.completeWorkflow(wId);
    
    // Check that we captured the events in the buffer
    const buffer = (TELLANN as any).eventBuffer;
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
    (TELLANN as any).eventBuffer = [];

    // Small event should pass
    TELLANN.trackEvent('PAGE_VIEW', { msg: 'short' });
    assert.strictEqual((TELLANN as any).eventBuffer.length, 1);

    // Large event should be discarded
    const hugeMetadata = { data: 'x'.repeat(40 * 1024) }; // 40KB
    TELLANN.trackEvent('PAGE_VIEW', hugeMetadata);
    assert.strictEqual((TELLANN as any).eventBuffer.length, 1); // still 1!
  });

  await t.test('Privacy sanitization of metadata', () => {
    const rawMeta = {
      password: 'my-secret-password',
      credit_card: '1234-5678-9012-3456',
      safeKey: 'perfectly-fine-value'
    };

    const sanitized = sanitizeMetadata(rawMeta);
    assert.strictEqual(sanitized.password, '[NOT CAPTURED]');
    assert.strictEqual(sanitized.credit_card, '[NOT CAPTURED]');
    assert.strictEqual(sanitized.safeKey, 'perfectly-fine-value');
  });

  await t.test('authenticated flush uses fetch with gateway headers', async () => {
    TELLANN.teardown();
    fetchCalls = [];
    navigatorMock.sendBeacon = () => {
      throw new Error('sendBeacon should not be used when gateway headers are required');
    };

    TELLANN.initialize({
      endpoint: 'http://gateway',
      tenantId: 'tenant-auth',
      applicationId: 'app-auth',
      apiKey: 'tellann_test_key',
      environmentId: 'env-auth',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    await (TELLANN as any).flush();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'http://gateway/v1/events/batch');
    assert.strictEqual(fetchCalls[0].headers.Authorization, 'Bearer tellann_test_key');
    assert.strictEqual(fetchCalls[0].headers['x-tellann-environment-id'], 'env-auth');
  });

  await t.test('verifyInstallation sends onboarding test event immediately', async () => {
    TELLANN.teardown();
    fetchCalls = [];

    TELLANN.initialize({
      endpoint: 'http://gateway',
      tenantId: 'tenant-auth',
      applicationId: 'app-auth',
      apiKey: 'tellann_test_key',
      environmentId: 'env-auth',
      autoTrackClicks: false,
      autoTrackForms: false,
      autoTrackRoutes: false,
      errorTracking: false,
    });

    fetchCalls = [];
    await TELLANN.verifyInstallation();

    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'http://gateway/v1/events/batch');
    assert.ok(Array.isArray(fetchCalls[0].body));
    assert.ok(fetchCalls[0].body.some((event: any) => event.eventType === 'TELLANN_INITIALIZED' || event.eventType === 'TELLANN_ONBOARDING_TEST'));
  });

  TELLANN.teardown();
});
