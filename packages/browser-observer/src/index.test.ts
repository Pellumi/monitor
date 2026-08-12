import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBrowserState, isObservationOnlyRequestAllowed } from './index';

test('derives stable browser states without leaking record identifiers', () => {
  assert.equal(deriveBrowserState('https://example.test/orders/12345', 'Order 12345').stateName, 'ORDERS_DETAIL');
  assert.equal(deriveBrowserState('https://example.test/', 'Home').stateName, 'HOME');
});

test('production observation permits only read HTTP methods', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(isObservationOnlyRequestAllowed(method), true, method);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isObservationOnlyRequestAllowed(method), false, method);
});
