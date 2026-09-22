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
} from './index';
import { INSPECT_INTERCEPTED_EVENTS, installQaRecorder } from './injected-recorder';

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
