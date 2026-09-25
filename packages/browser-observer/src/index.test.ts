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
  liveUrl,
  sanitizeBridgeMetadata,
  classifyWebVitals,
  classifySettleOutcome,
  classifyFailedResources,
  formatVitalValue,
  scopeEvidenceForCapturePhase,
  backendRouteTemplate,
  durationPercentile,
  emptyBackendSummary,
  liveEvidenceForBackendRequest,
  classifyBackendLatency,
  liveEvidenceForBackendLatency,
  BrowserObserver,
} from './index';
import zlib from 'node:zlib';
import { INSPECT_INTERCEPTED_EVENTS, installQaRecorder } from './injected-recorder';
import { maskPng } from './silent-capture';
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

test('live urls keep the real route and values but withhold credentials', () => {
  assert.equal(
    liveUrl('https://app.test/student/6f1c2e9a-1b2c-4d3e-8f90-a1b2c3d4e5f6/results?page=2&search=ada#frag'),
    'https://app.test/student/6f1c2e9a-1b2c-4d3e-8f90-a1b2c3d4e5f6/results?page=2&search=ada',
  );
  assert.equal(liveUrl('https://user:hunter2@app.test/users/42'), 'https://app.test/users/42');
  assert.equal(liveUrl('https://app.test/reset/abc123'), 'https://app.test/reset/[redacted]');
  assert.equal(
    liveUrl('https://app.test/orders?apiKey=abc&access_token=def&page=1'),
    'https://app.test/orders?apiKey=[redacted]&access_token=[redacted]&page=1',
  );
  // Whatever the live panel shows, what is uploaded is still placeholder-only.
  assert.equal(sanitizeCapturedUrl('https://app.test/student/42/results?page=2'), 'https://app.test/student/DETAIL/DETAIL?page=');
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
  assert.equal(live.message, 'GET https://app.test/api/orders?account=123 — 200');
  assert.equal(live.resourceType, 'fetch');
  assert.ok(!live.message.includes('private'));
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


test('an ordinary request is not reported as a latency outlier', () => {
  assert.equal(classifyBackendLatency({ durationMs: 40, baseline: [] }), null);
  assert.equal(classifyBackendLatency({ durationMs: 120, baseline: [100, 110, 90, 105, 95] }), null);
});

test('a request is an outlier on its own scale, or on any scale', () => {
  // Several times the endpoint's own median, even though it is fast in absolute terms.
  const relative = classifyBackendLatency({ durationMs: 300, baseline: [20, 22, 18, 25, 21] });
  assert.equal(relative?.reason, 'BASELINE');
  assert.equal(relative?.baselineMs, 21);
  assert.equal(relative?.multiple, 14.3);

  // Slow enough to matter with no baseline to compare against.
  const absolute = classifyBackendLatency({ durationMs: 1_500, baseline: [] });
  assert.equal(absolute?.reason, 'ABSOLUTE');
  assert.equal(absolute?.baselineMs, null);

  // A baseline needs enough samples before it is worth comparing against.
  assert.equal(classifyBackendLatency({ durationMs: 300, baseline: [20, 22] }), null);
});

test('a latency row names the route, the time and what it touched', () => {
  const row = liveEvidenceForBackendLatency({
    method: 'GET', route: '/reports/:id', durationMs: 6_200, statusCode: 200,
    reason: 'BASELINE', baselineMs: 40, multiple: 155, models: ['Report', 'User'],
  });
  assert.equal(row.kind, 'PERFORMANCE');
  assert.equal(row.level, 'ERROR', 'a request this slow is an error, not a warning');
  assert.match(row.message, /155× its usual/);
  assert.deepEqual(row.details?.find((detail) => detail.label === 'Models'), {
    label: 'Models', value: 'Report, User',
  });
});

test('a backend run fills its Performance pane from slow requests', async () => {
  const observer = new BrowserObserver({});
  await observer.start({
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
    const call = async (durationMs: number, requestId: string) =>
      observer.recordBackendRequestEvent({
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        metadata: { requestId, method: 'GET', route: '/reports', statusCode: 200, durationMs },
      });

    // A fast baseline, then one request several times slower than it.
    for (let index = 0; index < 6; index += 1) await call(20, `fast-${index}`);
    assert.equal(observer.getState()?.liveCounts.PERFORMANCE, 0, 'steady traffic is not an outlier');

    await call(400, 'slow-1');
    const state = observer.getState();
    assert.equal(state?.liveCounts.PERFORMANCE, 1);
    const row = state?.evidence.find((item) => item.kind === 'PERFORMANCE');
    assert.match(row?.message ?? '', /\/reports took 400 ms/);

    // Egregiously slow is a finding as well as a row, and only once per route.
    await call(9_000, 'slow-2');
    await call(9_500, 'slow-3');
    const slowFindings = (observer.getState()?.findings ?? [])
      .filter((finding) => finding.category === 'BACKEND_SLOW_RESPONSE');
    assert.equal(slowFindings.length, 1);
    assert.match(slowFindings[0].title, /took 9\.0 s/);
  } finally {
    await observer.end();
  }
});

test('collapsed data operations are counted by what they stand for', async () => {
  const observer = new BrowserObserver({});
  await observer.start({
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
    await observer.recordBackendDataAccessEvent({
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      // One event standing for 40 selects the SDK collapsed.
      metadata: { model: 'Order', operation: 'select', mutation: false, count: 40 },
    });
    const state = observer.getState();
    assert.equal(state?.backend?.dataOperations, 40);
    assert.equal(state?.backend?.models[0].reads, 40);
    assert.match(
      state?.evidence.find((item) => item.kind === 'DATA')?.message ?? '',
      /Order\.select ×40/,
    );
  } finally {
    await observer.end();
  }
});

test('a picked element is photographed before the dialog opens, and saving never hides the dialog', () => {
  const source = installQaRecorder.toString();
  const select = source.slice(source.indexOf('const selectElement'), source.indexOf("shield.addEventListener('mousemove'"));
  assert.ok(select.indexOf('config.snapshot') > 0, 'selection must take the picture');
  assert.ok(select.indexOf('config.snapshot') < select.indexOf('panel.hidden = false'), 'the picture comes first');
  const save = source.slice(source.indexOf('saveButton.addEventListener'), source.indexOf("Object.defineProperty(globalThis, '__tellannQaSetPhase'"));
  assert.doesNotMatch(save, /__tellannQaScreenshotMode/);
});

function encodeTestPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer: Buffer) => {
    let value = 0xffffffff;
    for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    // Alternate the filter type so the decoder's Sub and Up paths are exercised.
    rows.push(y % 2 === 0 ? 1 : 2);
    for (let x = 0; x < width; x += 1) {
      if (y % 2 === 0) rows.push(...(x === 0 ? rgba : [0, 0, 0, 0]));
      else rows.push(0, 0, 0, 0);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('masking paints only the requested rectangle of a screenshot', () => {
  const masked = maskPng(encodeTestPng(4, 4, [255, 255, 255, 255]), [{ x: 1, y: 1, width: 2, height: 2 }]);
  assert.ok(masked, 'a browser-style truecolour PNG must be maskable');
  const idat = masked!.subarray(masked!.indexOf('IDAT') + 4, masked!.indexOf('IEND') - 8);
  const raw = zlib.inflateSync(idat);
  const pixel = (x: number, y: number) => [...raw.subarray(y * 17 + 1 + x * 4, y * 17 + 1 + x * 4 + 4)];
  assert.deepEqual(pixel(0, 0), [255, 255, 255, 255]);
  assert.deepEqual(pixel(3, 3), [255, 255, 255, 255]);
  assert.deepEqual(pixel(1, 1), [0x11, 0x18, 0x27, 255]);
  assert.deepEqual(pixel(2, 2), [0x11, 0x18, 0x27, 255]);
  assert.equal(maskPng(Buffer.from('not a png'), []), null);
});

// ── Frontend performance rules ──────────────────────────────────────────────

test('a page within every Core Web Vital threshold raises nothing', () => {
  assert.equal(
    classifyWebVitals({ lcp: 1_200, cls: 0.02, inpMs: 90, hiddenMs: 0, supported: true }),
    null,
  );
});

test('a vital exactly at its threshold has not breached it', () => {
  // The thresholds are the boundary of "poor", not the start of it.
  assert.equal(classifyWebVitals({ lcp: 4_000, cls: null, inpMs: null, hiddenMs: 0, supported: true }), null);
  assert.equal(classifyWebVitals({ lcp: null, cls: 0.25, inpMs: null, hiddenMs: 0, supported: true }), null);
  assert.equal(classifyWebVitals({ lcp: null, cls: null, inpMs: 500, hiddenMs: 0, supported: true }), null);
  assert.equal(classifyWebVitals({ lcp: 4_001, cls: null, inpMs: null, hiddenMs: 0, supported: true })?.metric, 'LCP');
});

test('the worst vital wins, measured by how far past its own threshold it is', () => {
  // LCP 4.4s is 1.1x poor; CLS 0.75 is 3x poor. CLS is the bigger problem even
  // though its raw number is far smaller.
  const verdict = classifyWebVitals({ lcp: 4_400, cls: 0.75, inpMs: null, hiddenMs: 0, supported: true });
  assert.equal(verdict?.metric, 'CLS');
  assert.equal(verdict?.ratio, 3);
});

test('paint timings from a backgrounded tab are not evidence of anything', () => {
  assert.equal(
    classifyWebVitals({ lcp: 40_000, cls: null, inpMs: null, hiddenMs: 30_000, supported: true }),
    null,
  );
  // Just under the tolerance still counts: the recorder reports exactly 0 for
  // a route that never went to the background.
  assert.ok(classifyWebVitals({ lcp: 40_000, cls: null, inpMs: null, hiddenMs: 200, supported: true }));
});

test('a browser that could not measure vitals reports nothing, not zero', () => {
  assert.equal(
    classifyWebVitals({ lcp: null, cls: null, inpMs: null, hiddenMs: null, supported: false }),
    null,
  );
});

test('a vital reads as a duration or a score, whichever it is', () => {
  assert.equal(formatVitalValue('LCP', 6_200), '6.2 s');
  assert.equal(formatVitalValue('INP', 780), '780 ms');
  assert.equal(formatVitalValue('CLS', 0.413), '0.41');
});

test('only a route settle can time out into a finding', () => {
  // An interaction settle timing out describes the page, not the click, and
  // firing per click on a polling page would produce one finding per click.
  assert.equal(
    classifySettleOutcome({ trigger: 'interaction', dataReadyTimedOut: true, visuallyStableTimedOut: false, dataReadyMs: null }),
    null,
  );
  assert.equal(
    classifySettleOutcome({ trigger: 'route', dataReadyTimedOut: true, visuallyStableTimedOut: false, dataReadyMs: null })?.kind,
    'DATA',
  );
  assert.equal(
    classifySettleOutcome({ trigger: null, dataReadyTimedOut: false, visuallyStableTimedOut: true, dataReadyMs: 400 })?.kind,
    'VISUAL',
  );
  assert.equal(
    classifySettleOutcome({ trigger: 'route', dataReadyTimedOut: false, visuallyStableTimedOut: false, dataReadyMs: 400 }),
    null,
  );
});

test('a settle that both timed out is reported as the data failure', () => {
  const verdict = classifySettleOutcome({
    trigger: 'route', dataReadyTimedOut: true, visuallyStableTimedOut: true, dataReadyMs: null,
  });
  assert.equal(verdict?.kind, 'DATA', 'nothing could stabilise because the data never arrived');
});

test('one dead favicon is noise; several empty resources are a finding', () => {
  assert.equal(classifyFailedResources({ failedResourceCount: 2, resourceCount: 40 }), null);
  assert.equal(classifyFailedResources({ failedResourceCount: null, resourceCount: 40 }), null);
  assert.deepEqual(classifyFailedResources({ failedResourceCount: 3, resourceCount: 40 }), { failed: 3, total: 40 });
});
