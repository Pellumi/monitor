import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserContextViewport,
  deriveBrowserState,
  isIdentifierKeyPath,
  isObservationOnlyRequestAllowed,
  isRetryableTargetConnectionError,
  isSecretKeyPath,
  navigateToRunTarget,
  sanitizeCapturedUrl,
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
