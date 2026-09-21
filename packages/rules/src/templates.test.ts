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

test('every seeding template produces a publishable graph shape', () => {
  for (const [key, template] of Object.entries(domainTemplates)) {
    if (template.states.length === 0) continue;
    const names = new Set(template.states.map((state) => state.name));
    const initial = template.states.filter((state) => state.role === 'INITIAL');
    const terminal = template.states.filter((state) => state.role === 'TERMINAL');

    assert.equal(initial.length, 1, `${key} should declare exactly one initial state`);
    assert.ok(terminal.length > 0, `${key} should declare at least one terminal state`);
    for (const state of terminal) {
      assert.ok(state.terminalKind, `${key}.${state.name} must name its completion kind`);
    }
    for (const transition of template.transitions) {
      assert.ok(names.has(transition.from), `${key} transition references unknown state ${transition.from}`);
      assert.ok(names.has(transition.to), `${key} transition references unknown state ${transition.to}`);
      assert.notEqual(
        template.states.find((state) => state.name === transition.from)?.role,
        'TERMINAL',
        `${key}.${transition.from} is terminal and cannot have outgoing transitions`,
      );
    }
    const reachable = new Set([initial[0].name]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const transition of template.transitions) {
        if (reachable.has(transition.from) && !reachable.has(transition.to)) {
          reachable.add(transition.to);
          grew = true;
        }
      }
    }
    for (const state of template.states) {
      assert.ok(reachable.has(state.name), `${key}.${state.name} is unreachable from the initial state`);
    }
  }
});
