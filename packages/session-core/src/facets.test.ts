import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFlowFacets } from './facets';

test('a session that reached a declared terminal state is not abandoned', () => {
  const facets = computeFlowFacets({
    stateNames: ['CART', 'CHECKOUT', 'ORDER_CONFIRMED'],
    workflowNames: ['ORDER_CONFIRMED Workflow'],
    terminalStateNames: ['ORDER_CONFIRMED'],
  });
  assert.equal(facets.abandoned, false);
  assert.deepEqual(facets.reachedTerminalFlows, ['ORDER_CONFIRMED Workflow']);
});

test('a session that entered a flow and stopped short is abandoned', () => {
  // The question the product promises to answer, with a column behind it for the first
  // time: 500 users entered Create Exam, how many never finished.
  const facets = computeFlowFacets({
    stateNames: ['CART', 'CHECKOUT'],
    workflowNames: ['CHECKOUT Workflow'],
    terminalStateNames: ['ORDER_CONFIRMED'],
  });
  assert.equal(facets.abandoned, true);
  assert.deepEqual(facets.reachedTerminalFlows, []);
});

test('with no declared terminal states, nothing is called abandoned', () => {
  // The bug this pins, which was in the first version of this function: a bare
  // `reachedTerminalFlows.length === 0` marked every session of every application
  // without a declared flow as a failure. Abandonment is only meaningful against a
  // declaration of what finishing means.
  const facets = computeFlowFacets({
    stateNames: ['COURSE_CATALOG', 'QUIZ_STARTED'],
    workflowNames: ['QUIZ_STARTED Workflow'],
    terminalStateNames: [],
  });
  assert.equal(facets.abandoned, false);
});

test('a session that entered no flow is not abandoned either', () => {
  // It did not attempt anything, which is not the same as failing.
  const facets = computeFlowFacets({
    stateNames: ['LOGIN'],
    workflowNames: [],
    terminalStateNames: ['ORDER_CONFIRMED'],
  });
  assert.equal(facets.abandoned, false);
});

test('duplicate state names collapse', () => {
  const facets = computeFlowFacets({
    stateNames: ['CART', 'CART', 'CHECKOUT'],
    workflowNames: ['CHECKOUT Workflow', 'CHECKOUT Workflow'],
    terminalStateNames: ['DONE'],
  });
  assert.deepEqual(facets.stateNames, ['CART', 'CHECKOUT']);
  assert.deepEqual(facets.workflowNames, ['CHECKOUT Workflow']);
});
