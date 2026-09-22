import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserContextViewport,
  deriveBrowserState,
  isIdentifierKeyPath,
  isObservationOnlyRequestAllowed,
  initialCapturePhase,
  installReadOnlyInteractionGuard,
  installReadOnlySocketGuard,
  isRetryableTargetConnectionError,
  isSecretKeyPath,
  liveEvidenceForBridgePayload,
  liveEvidenceForNetworkRequest,
  navigateToRunTarget,
  normalizeFlowKey,
  redactAriaSnapshot,
  sanitizeCapturedUrl,
  sanitizeBridgeMetadata,
  scopeEvidenceForCapturePhase,
  backendRouteTemplate,
  durationPercentile,
  emptyBackendSummary,
  liveEvidenceForBackendRequest,
  BrowserObserver,
} from './index';
import { INSPECT_INTERCEPTED_EVENTS, installQaRecorder } from './injected-recorder';
import type { QAEvidenceEvent } from '@tellann/desktop-contracts';

test('uses the host window viewport for headed QA runs', () => {
  assert.equal(browserContextViewport(false), null);
  assert.deepEqual(browserContextViewport(true), { width: 1440, height: 900 });
});

test('derives stable browser states without leaking record identifiers', () => {
  assert.equal(deriveBrowserState('https://example.test/orders/12345', 'Order 12345').stateName, 'ORDERS_DETAIL');
  assert.equal(deriveBrowserState('https://example.test/', 'Home').stateName, 'HOME');
});

test('production observation permits only read HTTP methods', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(isObservationOnlyRequestAllowed(method), true, method);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isObservationOnlyRequestAllowed(method), false, method);
});

test('only strict guided runs wait for a declared initial boundary', () => {
  assert.equal(initialCapturePhase('GUIDED', 'version-1'), 'PRE_BOUNDARY');
  assert.equal(initialCapturePhase('ASSISTED', 'version-1'), 'IN_FLOW');
  assert.equal(initialCapturePhase('ASSISTED', null), 'IN_FLOW');
  assert.equal(initialCapturePhase('OBSERVATION_ONLY', null), 'IN_FLOW');
});

test('pre-boundary interaction evidence records intent without auth labels or values', () => {
  const protectedValues = [{ keyPath: 'field.password', kind: 'SECRET' as const, valueLength: 10 }];
  assert.deepEqual(
    scopeEvidenceForCapturePhase(
      'PRE_BOUNDARY',
      'QA_FORM_SUBMIT_INTENT',
      { action: 'https://identity.example/login?token=secret', label: 'Sign in as person@example.com' },
      protectedValues,
    ),
    { metadata: { interactionType: 'FORM_SUBMIT' }, protectedValues: [] },
  );
  assert.deepEqual(
    scopeEvidenceForCapturePhase('IN_FLOW', 'QA_FORM_SUBMIT_INTENT', { label: 'Save order' }, protectedValues),
    { metadata: { label: 'Save order' }, protectedValues },
  );
});

test('the observation-only interaction guard is self-contained and blocks mutation gestures', () => {
  const source = installReadOnlyInteractionGuard.toString();
  for (const event of ['click', 'submit', 'keydown', 'beforeinput']) assert.match(source, new RegExp(event));
  assert.match(source, /stopImmediatePropagation/);
});

test('the production socket guard replaces WebSocket send before page code runs', () => {
  const source = installReadOnlySocketGuard.toString();
  assert.match(source, /WebSocket\.prototype/);
  assert.match(source, /SecurityError/);
});

test('browser state derivation removes identifier-shaped route segments and never uses titles', () => {
  assert.equal(deriveBrowserState('https://example.test/users/person%40example.com', 'Person Name').stateName, 'USERS_DETAIL');
  assert.equal(deriveBrowserState('https://example.test/reset/reset_token-secret-value', 'Reset for Person').stateName, 'RESET_DETAIL');
});

test('retries connection refusal while a launched application becomes ready', async () => {
  let attempts = 0;
  await navigateToRunTarget({
    async goto() {
      attempts += 1;
      if (attempts < 3) throw new Error('page.goto: net::ERR_CONNECTION_REFUSED');
      return null;
    },
  }, 'http://localhost:3000', 5_000, 0);
  assert.equal(attempts, 3);
});

test('does not retry navigation errors unrelated to application startup', async () => {
  let attempts = 0;
  await assert.rejects(
    navigateToRunTarget({
      async goto() {
        attempts += 1;
        throw new Error('page.goto: net::ERR_NAME_NOT_RESOLVED');
      },
    }, 'http://missing.invalid', 5_000, 0),
    /ERR_NAME_NOT_RESOLVED/,
  );
  assert.equal(attempts, 1);
  assert.equal(isRetryableTargetConnectionError('net::ERR_CONNECTION_REFUSED'), true);
});

test('secret key paths are matched on tokens, not raw substrings', () => {
  for (const path of [
    'field.password.value', 'requestBody.accessToken', 'headers.authorization',
    'storage.sessionId.newValue', 'checkout.cardNumber', 'upload.fileContent',
  ]) {
    assert.equal(isSecretKeyPath(path), true, path);
  }
});

test('ordinary field names that merely contain a secret word are not secrets', () => {
  // `profile` contains `file`, `company` contains `pan`, `apparent` contains
  // `parent`. Substring matching silently discarded these values.
  for (const path of ['user.profile', 'order.company', 'sessionStorage.cart', 'form.pinboard'] ) {
    assert.equal(isSecretKeyPath(path), false, path);
  }
});

test('direct identifiers are matched on tokens', () => {
  assert.equal(isIdentifierKeyPath('profile.email'), true);
  assert.equal(isIdentifierKeyPath('requestBody.phoneNumber'), true);
  assert.equal(isIdentifierKeyPath('checkout.userId'), true);
  assert.equal(isIdentifierKeyPath('order.total'), false);
});

test('inspect mode swallows the whole press sequence, not just click', () => {
  // A menu or combobox that acts on pointerdown would otherwise fire while the
  // user was only selecting an element to annotate.
  for (const name of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    assert.ok(
      (INSPECT_INTERCEPTED_EVENTS as readonly string[]).includes(name),
      `${name} must be intercepted in Inspect mode`,
    );
  }
});

test('the injected recorder is self-contained enough to serialize', () => {
  // Playwright stringifies this function into the page, so it must not close
  // over anything from module scope.
  const source = installQaRecorder.toString();
  assert.ok(source.startsWith('function installQaRecorder'));
  assert.ok(!source.includes('INSPECT_INTERCEPTED_EVENTS'), 'must not reference module-scope bindings');
});

test('captured urls drop fragments and parameter values but keep parameter names', () => {
  assert.equal(
    sanitizeCapturedUrl('https://app.test/orders?token=abc&q=shoes#pii'),
    'https://app.test/orders?q=&token=',
  );
});

test('captured urls redact identifier-bearing and unrecognized nested path segments', () => {
  assert.equal(sanitizeCapturedUrl('https://example.test/reset/abc123?token=secret'), 'https://example.test/reset/DETAIL?token=');
  assert.equal(sanitizeCapturedUrl('https://example.test/users/customer-slug'), 'https://example.test/users/DETAIL');
});

test('route bridge metadata cannot retain raw paths or page titles', () => {
  assert.deepEqual(
    sanitizeBridgeMetadata('route', { url: 'https://example.test/users/customer-slug?token=secret', title: 'Customer Name' }),
    { url: 'https://example.test/users/DETAIL?token=', title: null },
  );
});

test('the injected mode and phase setters acknowledge delivery', () => {
  // setInteractionMode distinguishes "applied" from "reached a page with no
  // recorder" by the boolean these return. If they stop returning true, the
  // desktop would report every successful switch as a failure.
  const source = installQaRecorder.toString();
  for (const setter of ['__tellannQaSetMode', '__tellannQaSetPhase']) {
    const start = source.indexOf(setter);
    assert.ok(start > 0, `${setter} must be defined`);
    const body = source.slice(start, start + 700);
    assert.ok(body.includes('return true'), `${setter} must acknowledge delivery`);
  }
});

test('the inspect overlay waits for the document root before mounting', () => {
  const source = installQaRecorder.toString();
  assert.match(source, /document\.documentElement/);
  assert.match(source, /DOMContentLoaded/);
  assert.match(source, /host\.isConnected/);
});

test('a successful annotation save closes as saved instead of running the cancel path', () => {
  const source = installQaRecorder.toString();
  const saveHandler = source.slice(source.indexOf("saveButton.addEventListener"), source.indexOf("Object.defineProperty(globalThis, '__tellannQaSetPhase'"));
  assert.match(saveHandler, /await invoke\(config\.annotations, payload\)/);
  assert.match(saveHandler, /Annotation saved/);
  assert.doesNotMatch(saveHandler, /cancelInspect\(\)/);
  assert.match(saveHandler, /Annotation could not be saved\. Try again\./);
});

test('successful network requests are represented in the live panel', () => {
  const live = liveEvidenceForNetworkRequest({
    method: 'GET',
    url: 'https://app.test/api/orders?account=123#private',
    status: 200,
    failed: false,
    blockedByPolicy: false,
    durationMs: 42,
    resourceType: 'fetch',
    transferredBytes: 512,
  });
  assert.equal(live.kind, 'NETWORK');
  assert.equal(live.level, 'INFO');
  assert.match(live.message, /GET https:\/\/app\.test\/api\/orders\?account= — 200/);
  assert.ok(!live.message.includes('123'));
  assert.deepEqual(live.details, [
    { label: 'Type', value: 'fetch' },
    { label: 'Duration', value: '42 ms' },
    { label: 'Transferred', value: '512 bytes' },
  ]);
});

test('live interaction rows expose element context without copying field values', () => {
  const live = liveEvidenceForBridgePayload({
    type: 'field',
    valueKind: 'DIRECT_IDENTIFIER',
    value: 'person@example.test',
    metadata: {
      label: 'Email address',
      id: 'email',
      name: 'email',
      type: 'email',
      formId: 'signup',
      populated: true,
      valueLength: 19,
      valid: true,
    },
  });
  assert.equal(live?.kind, 'INTERACTION');
  assert.match(live?.message ?? '', /Email address/);
  assert.match(JSON.stringify(live), /Pseudonymized/);
  assert.ok(!JSON.stringify(live).includes('person@example.test'));
});

test('route, viewport, storage, and performance recorder messages have live activity rows', () => {
  const payloads: Array<Parameters<typeof liveEvidenceForBridgePayload>[0]> = [
    { type: 'route', metadata: { kind: 'pushState', url: 'https://app.test/orders/123?q=secret', title: 'Order' } },
    { type: 'viewport', metadata: { innerWidth: 1280, innerHeight: 720, outerWidth: 1296, outerHeight: 759 } },
    { type: 'storage', valueKind: 'ORDINARY', metadata: { store: 'localStorage', operation: 'setItem', key: 'cart' } },
    { type: 'performance', metadata: { route: '/orders', dataReadyMs: 320, visuallyStableMs: 580 } },
  ];
  for (const payload of payloads) {
    assert.ok(liveEvidenceForBridgePayload(payload), `${payload.type} should be visible in live activity`);
  }
});

test('flow keys normalise the same way the server boundary evaluator normalises them', () => {
  assert.equal(normalizeFlowKey('Checkout Payment'), 'checkout_payment');
  assert.equal(normalizeFlowKey('  CART-review  '), 'cart_review');
  assert.equal(normalizeFlowKey('__Sign In!__'), 'sign_in');
  assert.equal(normalizeFlowKey(null), '');
});

test('aria snapshots keep structure but never the values typed into fields', () => {
  const snapshot = [
    '- textbox "Email": someone@example.test',
    '- button "Continue"',
  ].join('\n');
  const redacted = redactAriaSnapshot(snapshot);
  assert.ok(!redacted.includes('someone@example.test'));
  assert.ok(redacted.includes('[PROTECTED]'));
  assert.ok(redacted.includes('button "Continue"'));
});

test('performance rows report the navigation breakdown and real INP, not just paint marks', () => {
  const row = liveEvidenceForBridgePayload({
    type: 'performance',
    metadata: {
      route: '/checkout',
      ttfbMs: 180,
      lcp: 1400,
      inpMs: 210,
      interactionCount: 12,
      longTasks: 3,
      longTaskMs: 240,
      longestTaskMs: 120,
      longestTaskAttribution: 'script:/assets/vendor.js',
      failedResourceCount: 2,
    },
  });
  const labels = (row?.details ?? []).map((entry) => `${entry.label}=${entry.value}`);
  assert.ok(labels.includes('TTFB=180 ms'), labels.join(' | '));
  assert.ok(labels.includes('INP=210 ms over 12 interactions'), labels.join(' | '));
  assert.ok(labels.some((entry) => entry.startsWith('Longest task=120 ms in script:')), labels.join(' | '));
  assert.ok(labels.includes('Failed resources=2'), labels.join(' | '));
});


test('backend requests group under the route template the framework matched', () => {
  assert.equal(backendRouteTemplate('/orders/:id', '/orders/8213'), '/orders/:id');
  // No template: identifier-looking segments collapse so one route does not
  // read as thousands.
  assert.equal(backendRouteTemplate(null, '/orders/8213/items'), '/orders/:id/items');
  assert.equal(backendRouteTemplate(undefined, '/health?verbose=1'), '/health');
  assert.equal(backendRouteTemplate('', ''), '/');
});

test('duration percentiles are nearest-rank over the captured window', () => {
  assert.equal(durationPercentile([], 95), null);
  assert.equal(durationPercentile([10], 95), 10);
  assert.equal(durationPercentile([10, 20, 30, 40], 50), 20);
  assert.equal(durationPercentile([10, 20, 30, 40], 100), 40);
});

test('a backend request row reads by route, status and what it touched', () => {
  const row = liveEvidenceForBackendRequest({
    method: 'POST', route: '/orders/:id', status: 500, durationMs: 412,
    handler: 'orders.update', models: ['Order', 'Payment'],
    requestBytes: 120, responseBytes: 48,
  });
  assert.equal(row.kind, 'REQUEST');
  assert.equal(row.level, 'ERROR');
  assert.equal(row.message, 'POST /orders/:id — 500');
  assert.deepEqual(row.details?.find((detail) => detail.label === 'Models'), {
    label: 'Models', value: 'Order, Payment',
  });
  assert.equal(liveEvidenceForBackendRequest({
    method: 'GET', route: '/orders', status: 404, durationMs: 4,
  }).level, 'WARN');
  assert.equal(liveEvidenceForBackendRequest({
    method: 'GET', route: '/orders', status: 200, durationMs: 4,
  }).level, 'INFO');
});

test('an empty backend summary reports nothing rather than zeroed percentiles', () => {
  const summary = emptyBackendSummary();
  assert.equal(summary.requests, 0);
  assert.equal(summary.p95Ms, null);
  assert.deepEqual(summary.endpoints, []);
});

test('a backend-only run captures without opening a browser', async () => {
  const events: QAEvidenceEvent[] = [];
  const observer = new BrowserObserver({ onEvidenceEvent: (event) => { events.push(event); } });
  const state = await observer.start({
    applicationId: '11111111-1111-4111-8111-111111111111',
    environmentId: '22222222-2222-4222-8222-222222222222',
    workspaceId: null,
    environmentType: 'DEVELOPMENT',
    mode: 'ASSISTED',
    captureTracks: ['BACKEND'],
    targetUrl: 'http://localhost:8000',
    expectedGraphVersionId: null,
  }, await mkdtemp());

  try {
    assert.deepEqual(state.captureTracks, ['BACKEND']);
    // No window was opened, so there is none to show, focus or inspect.
    assert.equal(state.browserStatus, 'NONE');
    assert.equal(state.windowResolution, null);
    await assert.rejects(() => observer.focusBrowser(), /RUN_HAS_NO_BROWSER/);
    await assert.rejects(() => observer.setInteractionMode('INSPECT'), /RUN_HAS_NO_BROWSER/);

    await observer.recordBackendRequestEvent({
      eventId: '33333333-3333-4333-8333-333333333333',
      timestamp: new Date().toISOString(),
      metadata: {
        requestId: 'request-1', method: 'post', endpoint: '/orders/8213',
        route: '/orders/:id', statusCode: 500, durationMs: 120,
        requestBody: { note: 'ship fast', password: 'hunter2' },
        models: [{ model: 'Order', operation: 'update', records: 1 }],
      },
    });

    const current = observer.getState();
    assert.equal(current?.backend?.requests, 1);
    assert.equal(current?.backend?.serverErrors, 1);
    assert.equal(current?.backend?.endpoints[0].route, '/orders/:id');
    assert.deepEqual(current?.backend?.endpoints[0].models, ['Order']);
    // A 5xx from the application's own server is a finding, the same way a
    // failed browser request is.
    assert.equal(current?.findings[0]?.category, 'BACKEND_SERVER_ERROR');
    assert.equal(current?.evidence.some((row) => row.kind === 'REQUEST'), true);

    const captured = events.find((event) => event.eventType === 'QA_BACKEND_REQUEST');
    assert.ok(captured, 'a backend request is written to the evidence spool');
    assert.equal(captured.pageUrl, null);
    assert.equal(captured.viewport, null);
    // The password never leaves as a value; the ordinary field is carried as a
    // protected value for the ingestion pipeline to encrypt.
    const body = captured.metadata.requestBody as Record<string, unknown>;
    assert.equal(body.password, '[NOT CAPTURED]');
    const secret = captured.protectedValues.find((value) => value.keyPath.endsWith('password'));
    assert.equal(secret?.kind, 'SECRET');
    assert.equal(secret?.value, undefined);

    // A replayed delivery of the same request must not double the totals.
    await observer.recordBackendRequestEvent({
      eventId: '44444444-4444-4444-8444-444444444444',
      timestamp: new Date().toISOString(),
      metadata: { requestId: 'request-1', method: 'POST', route: '/orders/:id', statusCode: 500, durationMs: 120 },
    });
    assert.equal(observer.getState()?.backend?.requests, 1);

    await observer.recordBackendDataAccessEvent({
      eventId: '55555555-5555-4555-8555-555555555555',
      timestamp: new Date().toISOString(),
      metadata: { model: 'Order', operation: 'update', records: 2, route: '/orders/:id', method: 'POST' },
    });
    const withData = observer.getState();
    assert.equal(withData?.backend?.dataOperations, 1);
    assert.equal(withData?.backend?.models[0].model, 'Order');
    assert.equal(withData?.backend?.models[0].writes, 1);
  } finally {
    await observer.end();
  }
});

async function mkdtemp() {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  return fs.mkdtemp(path.join(os.tmpdir(), 'tellann-observer-'));
}
