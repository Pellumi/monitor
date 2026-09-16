import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAutoLayout, evaluatePublishReadiness } from './index.js';

const states = [
  { id: 'cart', stateName: 'CART_REVIEWED', role: 'INITIAL' },
  { id: 'payment', stateName: 'PAYMENT_SUBMITTED', role: 'NORMAL' },
  { id: 'confirmed', stateName: 'ORDER_CONFIRMED', role: 'TERMINAL' },
];
const transitions = [
  { fromStateId: 'cart', toStateId: 'payment' },
  { fromStateId: 'payment', toStateId: 'confirmed' },
];

test('auto layout ranks states along the flow and tolerates retry loops', () => {
  const positions = computeAutoLayout(
    states.map((state) => ({ id: state.id, label: state.stateName, role: state.role })),
    [
      ...transitions.map((edge) => ({ source: edge.fromStateId, target: edge.toStateId })),
      { source: 'payment', target: 'cart' },
    ],
    'TB',
  );
  assert.equal(positions.size, 3);
  assert.ok(positions.get('cart')!.y < positions.get('payment')!.y);
  assert.ok(positions.get('payment')!.y < positions.get('confirmed')!.y);

  const horizontal = computeAutoLayout([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], [{ source: 'a', target: 'b' }], 'LR');
  assert.ok(horizontal.get('a')!.x < horizontal.get('b')!.x);
});

test('a connected flow with a scope is ready to publish', () => {
  const readiness = evaluatePublishReadiness({ states, transitions, scopeStatement: 'Cart through confirmation' });
  assert.equal(readiness.ready, true);
  assert.equal(readiness.passedCount, 4);
  assert.deepEqual(readiness.unreachableStateIds, []);
});

test('readiness names what is missing', () => {
  const readiness = evaluatePublishReadiness({
    states: [...states, { id: 'refund', stateName: 'REFUND_ISSUED', role: 'NORMAL' }],
    transitions: [{ fromStateId: 'cart', toStateId: 'payment' }],
    scopeStatement: '  ',
  });
  const byId = Object.fromEntries(readiness.checks.map((check) => [check.id, check]));
  assert.equal(byId.initial.passed, true);
  assert.equal(byId.terminal.passed, false);
  assert.equal(byId.reachable.passed, false);
  assert.match(byId.reachable.detail, /ORDER_CONFIRMED and REFUND_ISSUED/);
  assert.equal(byId.scope.passed, false);
  assert.equal(readiness.passedCount, 1);
  assert.deepEqual(readiness.unreachableStateIds.sort(), ['confirmed', 'refund']);

  const twoInitials = evaluatePublishReadiness({
    states: states.map((state) => ({ ...state, role: 'INITIAL' })),
    transitions,
    scopeStatement: 'x',
  });
  assert.match(twoInitials.checks[0].detail, /3 are/);
});
