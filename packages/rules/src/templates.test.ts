import assert from 'node:assert/strict';
import test from 'node:test';
import { domainTemplates, inferDomainTemplate } from './templates';
import { ecommerceRules } from './ecommerce';

test('e-commerce template states align with route-derived observed states', () => {
  const routeStates = new Set(
    ecommerceRules.stateExtractors
      .filter((rule) => rule.type === 'exactRoute')
      .map((rule) => rule.state)
  );

  for (const expectedState of ['PRODUCTS', 'CART', 'CHECKOUT', 'CHECKOUT_SUCCESS', 'LOGIN', 'REGISTER']) {
    assert.equal(routeStates.has(expectedState), true, `${expectedState} should be observable from default routes`);
    assert.equal(
      domainTemplates.ECOMMERCE.states.some((state) => state.name === expectedState),
      true,
      `${expectedState} should be declared by the e-commerce template`
    );
  }
});

test('e-commerce template includes editable checkout failure suggestions', () => {
  const checkoutSuggestions = domainTemplates.ECOMMERCE.edgeCases.filter((edgeCase) => edgeCase.trigger === 'CHECKOUT');
  assert.equal(checkoutSuggestions.some((edgeCase) => edgeCase.name === 'PAYMENT_FAILURE'), true);
  assert.equal(checkoutSuggestions.some((edgeCase) => edgeCase.name === 'PAYMENT_GATEWAY_TIMEOUT'), true);
});

test('prompt inference chooses deterministic templates', () => {
  assert.equal(inferDomainTemplate('Users browse products, add to cart, checkout, and track orders.').id, 'ECOMMERCE');
  assert.equal(inferDomainTemplate('Users login, reset passwords, and manage account sessions.').id, 'AUTH');
  assert.equal(inferDomainTemplate('Admin users create, edit, delete, and list records.').id, 'GENERIC_CRUD');
});

test('authentication template covers alternate login outcomes', () => {
  const names = new Set(domainTemplates.AUTH.edgeCases.filter((edgeCase) => edgeCase.trigger === 'LOGIN').map((edgeCase) => edgeCase.name));
  for (const expected of ['LOGIN_FAILURE', 'AUTH_SERVICE_UNAVAILABLE', 'ACCOUNT_LOCKED', 'MFA_REQUIRED']) {
    assert.equal(names.has(expected), true, `${expected} should be suggested after LOGIN`);
  }
});
