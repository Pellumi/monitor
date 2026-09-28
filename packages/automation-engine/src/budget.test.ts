import assert from 'node:assert/strict';
import test from 'node:test';
import { LoopDetector, RunBudget, stateFingerprint } from './budget';
import { limits } from './test-fixtures';

test('the budget stops the run on steps, then on duration, with distinct reasons', () => {
  let now = 0;
  const budget = new RunBudget(limits({ maxSteps: 2, maxDurationMs: 1_000 }), () => now);
  assert.equal(budget.exceeded(), null);
  budget.recordStep();
  budget.recordStep();
  assert.equal(budget.exceeded(), 'MAX_STEPS_EXCEEDED');
  now = 5_000;
  assert.equal(budget.exceeded(), 'MAX_DURATION_EXCEEDED', 'duration is checked first');
});

test('too many replans reads as a loop', () => {
  const budget = new RunBudget(limits({ maxReplans: 1 }), () => 0);
  budget.recordReplan();
  assert.equal(budget.exceeded(), null);
  budget.recordReplan();
  assert.equal(budget.exceeded(), 'LOOP_DETECTED');
});

test('retries are bounded, and a mutation is never retried', () => {
  const budget = new RunBudget(limits({ maxActionRetries: 2 }), () => 0);
  assert.equal(budget.canRetry('READ', 1), true);
  assert.equal(budget.canRetry('CLIENT_STATE_MUTATION', 2), true);
  assert.equal(budget.canRetry('READ', 3), false);
  assert.equal(budget.canRetry('SERVER_MUTATION', 1), false);
  assert.equal(budget.canRetry('DESTRUCTIVE', 1), false);
});

test('revisiting a state is fine while the run is getting closer to the goal', () => {
  const loop = new LoopDetector();
  // progress is closeness to the goal: a form that redisplays after a validation error, then succeeds.
  assert.equal(loop.observe('a', -3), false);
  assert.equal(loop.observe('b', -2), false);
  assert.equal(loop.observe('a', -3), false);
  assert.equal(loop.observe('b', -1), false, 'progress was made since b was first seen');
  assert.equal(loop.observe('a', -3), false);
});

test('the same state three times with no progress is a loop', () => {
  const loop = new LoopDetector();
  assert.equal(loop.observe('a', -3), false);
  assert.equal(loop.observe('b', -3), false);
  assert.equal(loop.observe('a', -3), false);
  assert.equal(loop.observe('b', -3), false);
  assert.equal(loop.observe('a', -3), true);
});

test('a fingerprint is the route and the recognised state, not the DOM', () => {
  assert.equal(stateFingerprint('/courses/7', 'course_details'), '/courses/7::course_details');
  assert.equal(stateFingerprint('/x', null), '/x::unrecognised');
});

test('going back and forth between two states is a loop even though reaching the second was progress once', () => {
  // A -> B -> A -> B ...: B is closer to the goal than A, but the run never gets past it.
  const loop = new LoopDetector();
  assert.equal(loop.observe('a', -2), false);
  assert.equal(loop.observe('b', -1), false);
  assert.equal(loop.observe('a', -2), false);
  assert.equal(loop.observe('b', -1), false);
  assert.equal(loop.observe('a', -2), false);
  assert.equal(loop.observe('b', -1), true);
});
