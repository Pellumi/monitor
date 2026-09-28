import assert from 'node:assert/strict';
import test from 'node:test';
import { buildObservedDestinations, classifyAutomatedStateGap, classifyAutomatedTransitionGap } from './automated-reconciliation';
import type { AutomatedRunContext } from './automated-reconciliation';

const context = (overrides: Partial<AutomatedRunContext> = {}): AutomatedRunContext => ({
  stopReason: null,
  targetTerminalStateKey: 'exam_created',
  observedDestinationsByState: new Map(),
  ...overrides,
});

test('a gap in the run\'s own target, with an application-caused stop reason, is reclassified', () => {
  assert.equal(classifyAutomatedStateGap('EXAM_CREATED', context({ stopReason: 'AUTHORIZATION_BLOCKED' })), 'AUTHORIZATION_MISMATCH');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'TEST_DATA_UNAVAILABLE' })), 'DATA_PRECONDITION_FAILURE');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'EXPECTED_TRANSITION_NOT_FOUND' })), 'IMPLEMENTATION_MISMATCH');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'TRANSITION_DID_NOT_ADVANCE' })), 'IMPLEMENTATION_MISMATCH');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'STATE_RECOGNITION_AMBIGUOUS' })), 'IMPLEMENTATION_MISMATCH');
});

test('a gap in a state the run was not even trying to reach stays a plain true gap', () => {
  assert.equal(classifyAutomatedStateGap('some_other_state', context({ stopReason: 'AUTHORIZATION_BLOCKED' })), 'TRUE_GAP');
});

test('an infrastructure or user-cancelled stop explains nothing about the application, so the gap stays a true gap', () => {
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'BROWSER_CRASHED' })), 'TRUE_GAP');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'CANCELLED_BY_USER' })), 'TRUE_GAP');
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: 'AUTOMATION_ENGINE_ERROR' })), 'TRUE_GAP');
});

test('no stop reason at all (a Guided-style run, or one that completed) never reclassifies', () => {
  assert.equal(classifyAutomatedStateGap('exam_created', context({ stopReason: null })), 'TRUE_GAP');
});

test('a transition the run saw the state leave through some other, undeclared route is a declaration mismatch', () => {
  const ctx = context({
    stopReason: 'EXPECTED_TRANSITION_NOT_FOUND',
    observedDestinationsByState: new Map([['exam_form', new Set(['exam_error'])]]),
  });
  assert.equal(classifyAutomatedTransitionGap('EXAM_FORM', 'EXAM_CREATED', ctx), 'DECLARATION_MISMATCH');
});

test('positive evidence of a different destination outranks the stop reason, even for the run\'s own target', () => {
  // The declared destination IS the run's target, but we know for a fact it went somewhere else.
  const ctx = context({
    targetTerminalStateKey: 'exam_created',
    stopReason: 'AUTHORIZATION_BLOCKED',
    observedDestinationsByState: new Map([['exam_form', new Set(['exam_error'])]]),
  });
  assert.equal(classifyAutomatedTransitionGap('exam_form', 'exam_created', ctx), 'DECLARATION_MISMATCH');
});

test('with no evidence about where the state actually went, the transition falls back to the state-level reasoning', () => {
  const ctx = context({ stopReason: 'TEST_DATA_UNAVAILABLE', observedDestinationsByState: new Map() });
  assert.equal(classifyAutomatedTransitionGap('exam_form', 'exam_created', ctx), 'DATA_PRECONDITION_FAILURE');
});

test('observing the exact declared destination (nothing to reclassify) falls through to true gap', () => {
  const ctx = context({
    stopReason: 'AUTHORIZATION_BLOCKED',
    targetTerminalStateKey: 'something_else',
    observedDestinationsByState: new Map([['exam_form', new Set(['exam_created'])]]),
  });
  // The declared destination WAS observed for this from-state, so there is no mismatch signal,
  // and it is not the run's own target either: plain true gap.
  assert.equal(classifyAutomatedTransitionGap('exam_form', 'exam_created', ctx), 'TRUE_GAP');
});

test('state keys are compared normalized, the same way the boundary evaluator compares them', () => {
  assert.equal(classifyAutomatedStateGap('Exam Created!', context({ stopReason: 'AUTHORIZATION_BLOCKED', targetTerminalStateKey: 'exam_created' })), 'AUTHORIZATION_MISMATCH');
});

test('observed destinations are grouped by from-state, normalized, and support multiple destinations', () => {
  const byState = buildObservedDestinations([
    { fromStateName: 'Exam Form', toStateName: 'Exam Created' },
    { fromStateName: 'exam_form', toStateName: 'EXAM_ERROR' },
    { fromStateName: 'course_details', toStateName: 'exam_form' },
  ]);
  assert.deepEqual([...byState.get('exam_form')!].sort(), ['exam_created', 'exam_error']);
  assert.deepEqual([...byState.get('course_details')!], ['exam_form']);
  assert.equal(byState.has('exam_created'), false);
});
