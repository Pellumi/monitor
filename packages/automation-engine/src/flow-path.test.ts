import assert from 'node:assert/strict';
import test from 'node:test';
import { planFlowPath, transitionCost } from './flow-path';
import { control, lmsContract, state, transition } from './test-fixtures';
import type { ExecutableContract } from './types';

test('the declared route to the target is the list of transitions to perform', () => {
  const result = planFlowPath(lmsContract(), 'course_details', 'exam_created', 'STAGING');
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.transitions.map((t) => t.id), ['t-create', 't-submit']);
});

test('already at the target needs nothing', () => {
  const result = planFlowPath(lmsContract(), 'exam_created', 'exam_created', 'STAGING');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.transitions.length, 0);
});

test('a state that is not in the Flow is unknown, not unreachable', () => {
  assert.equal((planFlowPath(lmsContract(), 'nowhere', 'exam_created', 'STAGING') as { reason: string }).reason, 'UNKNOWN_STATE');
  assert.equal((planFlowPath(lmsContract(), 'course_details', 'nowhere', 'STAGING') as { reason: string }).reason, 'UNKNOWN_STATE');
});

test('a target nothing leads to is unreachable', () => {
  assert.equal((planFlowPath(lmsContract(), 'exam_error', 'exam_created', 'STAGING') as { reason: string }).reason, 'UNREACHABLE');
});

test('derived, gentle transitions are preferred over unresolved or dangerous ones', () => {
  const contract: ExecutableContract = {
    flowVersionId: 'v', flowHash: 'h', analysisIdentity: null, initialStateKey: 'a',
    states: [state({ key: 'a', role: 'INITIAL' }), state({ key: 'b' }), state({ key: 'c' }), state({ key: 'z', role: 'TERMINAL' })],
    transitions: [
      transition({ id: 'a-z-unresolved', from: 'a', to: 'z', control: null, derivation: 'UNRESOLVED' }),
      transition({ id: 'a-b', from: 'a', to: 'b', control: control({ labels: ['x'] }), actionClass: 'READ' }),
      transition({ id: 'b-z', from: 'b', to: 'z', control: control({ labels: ['y'] }), actionClass: 'READ' }),
      transition({ id: 'a-c-danger', from: 'a', to: 'c', control: control({ labels: ['d'] }), actionClass: 'DESTRUCTIVE' }),
    ],
  };
  const result = planFlowPath(contract, 'a', 'z', 'STAGING', { approvedClasses: ['DESTRUCTIVE'] });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.transitions.map((t) => t.id), ['a-b', 'b-z']);
});

test('a route that needs a forbidden action is blocked by policy and names the transitions', () => {
  const contract = lmsContract();
  contract.transitions = contract.transitions.map((t) => (t.id === 't-submit' ? { ...t, actionClass: 'DESTRUCTIVE' as const } : t));
  const result = planFlowPath(contract, 'course_details', 'exam_created', 'STAGING');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'BLOCKED_BY_POLICY');
    assert.deepEqual(result.blockedBy.map((t) => t.id), ['t-submit']);
  }
  assert.ok(planFlowPath(contract, 'course_details', 'exam_created', 'STAGING', { approvedClasses: ['DESTRUCTIVE'] }).ok);
});

test('the cost of a transition rises with danger and with doubt about its control', () => {
  const base = transition({ id: 'x', from: 'a', to: 'b', actionClass: 'READ' });
  assert.ok(transitionCost({ ...base, actionClass: 'SERVER_MUTATION' }) > transitionCost(base));
  assert.ok(transitionCost({ ...base, derivation: 'AMBIGUOUS' }) > transitionCost(base));
  assert.ok(transitionCost({ ...base, derivation: 'UNRESOLVED' }) > transitionCost({ ...base, derivation: 'AMBIGUOUS' }));
});
