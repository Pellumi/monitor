import assert from 'node:assert/strict';
import test from 'node:test';
import { observedDraftStateNames, rankObservedFlowCandidates, safeObservedStateName } from './qa-run-draft';

test('observed labels are redacted before becoming org-visible Flow metadata', () => {
  assert.equal(safeObservedStateName('Account jane@example.com 123456789'), 'Account [identifier] [identifier]');
});

test('observed journeys are ranked against existing Flow states', () => {
  const ranked = rankObservedFlowCandidates(
    [{ stateName: 'Cart' }, { stateName: 'Payment' }],
    [
      { id: 'profile', name: 'Profile', states: [{ stateName: 'Profile' }] },
      { id: 'checkout', name: 'Checkout', states: [{ stateName: 'Cart' }, { stateName: 'Payment' }, { stateName: 'Confirmation' }] },
    ],
  );
  assert.equal(ranked[0].id, 'checkout');
  assert.equal(ranked[0].score, 2 / 3);
});

test('drafts always have distinct initial and terminal states', () => {
  assert.deepEqual(observedDraftStateNames([]), ['Session started', 'Session completed']);
  assert.deepEqual(observedDraftStateNames([{ stateName: 'Checkout' }]), ['Checkout', 'Session completed']);
});
