import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType, QARunMode } from '@tellann/db';
import { assistedFlowContextShape, firstNonEmptyValue, isSessionScopedQaRun, qaRunActiveStatus, qaRunCreationPolicy, productionRunModeAllowed, scopeQaRunCompletion } from './desktop-routes';

test('cloud policy permits only observation-only QA runs in production', () => {
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.OBSERVATION_ONLY), true);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.GUIDED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.ASSISTED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.STAGING, QARunMode.GUIDED), true);
});

test('QA run creation policy requires Flow context only for guided runs', () => {
  assert.deepEqual(qaRunCreationPolicy(QARunMode.GUIDED, false), {
    requiresFlowContext: true, usesFlowContext: true, initialStatus: 'CREATED',
  });
  assert.deepEqual(qaRunCreationPolicy(QARunMode.ASSISTED, false), {
    requiresFlowContext: false, usesFlowContext: false, initialStatus: 'RECORDING',
  });
  assert.deepEqual(qaRunCreationPolicy(QARunMode.ASSISTED, true), {
    requiresFlowContext: false, usesFlowContext: true, initialStatus: 'RECORDING',
  });
  assert.deepEqual(qaRunCreationPolicy(QARunMode.OBSERVATION_ONLY, true), {
    requiresFlowContext: false, usesFlowContext: false, initialStatus: 'RECORDING',
  });
  assert.equal(qaRunActiveStatus(QARunMode.GUIDED, false), 'WAITING_FOR_INITIAL');
  assert.equal(qaRunActiveStatus(QARunMode.GUIDED, true), 'RECORDING');
  assert.equal(qaRunActiveStatus(QARunMode.ASSISTED, false), 'RECORDING');
  assert.equal(qaRunActiveStatus(QARunMode.OBSERVATION_ONLY, false), 'RECORDING');
});

test('assisted Flow context is all-or-none across tenant-scoped lifecycle records', () => {
  assert.equal(assistedFlowContextShape({}), 'NONE');
  assert.equal(assistedFlowContextShape({ flowId: 'flow', expectedGraphVersionId: 'version' }), 'CANDIDATE');
  assert.equal(assistedFlowContextShape({ flowInitializationId: 'foreign-init' }), 'INVALID');
  assert.equal(assistedFlowContextShape({
    flowId: 'flow', expectedGraphVersionId: 'version', flowBindingId: 'binding',
    flowInitializationId: 'initialization', flowScanId: 'scan',
  }), 'INITIALIZED');
});

test('session-scoped completion keeps all evidence and completes without Flow boundaries', () => {
  assert.equal(isSessionScopedQaRun(QARunMode.GUIDED, null), true);
  assert.equal(isSessionScopedQaRun(QARunMode.ASSISTED, 'candidate-version'), true);
  assert.equal(isSessionScopedQaRun(QARunMode.GUIDED, 'expected-version'), false);
  const observations = [{ stateName: 'LOGIN' }, { stateName: 'HOME' }];
  const transitions = [{ fromState: 'LOGIN', toState: 'HOME' }];
  const manual = scopeQaRunCompletion({
    sessionScoped: true, observations, observedTransitions: transitions,
    boundaryStartMs: null, boundaryEndMs: null, terminalBoundaryConfirmed: false,
    initialAccepted: false, timedOut: false,
  });
  assert.equal(manual.observations, observations);
  assert.equal(manual.observedTransitions, transitions);
  assert.equal(manual.completionReason, 'SESSION_MANUAL_STOP');
  assert.equal(manual.completedStatus, 'COMPLETED');

  const timedOut = scopeQaRunCompletion({
    sessionScoped: true, observations, observedTransitions: transitions,
    boundaryStartMs: null, boundaryEndMs: null, terminalBoundaryConfirmed: false,
    initialAccepted: false, timedOut: true,
  });
  assert.equal(timedOut.completionReason, 'SESSION_TIMEOUT');
  assert.equal(timedOut.completedStatus, 'COMPLETED');
});

test('guided completion retains strict boundary scoping', () => {
  const result = scopeQaRunCompletion({
    sessionScoped: false,
    observations: [{ stateName: 'BEFORE', timestamp: '2026-01-01T00:00:00Z' }],
    observedTransitions: [{ fromState: 'BEFORE', toState: 'AFTER' }],
    boundaryStartMs: null, boundaryEndMs: null, terminalBoundaryConfirmed: false,
    initialAccepted: false, timedOut: false,
  });
  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.observedTransitions, []);
  assert.equal(result.completionReason, 'MANUAL_STOP_BEFORE_INITIAL');
  assert.equal(result.completedStatus, 'COMPLETED_INCOMPLETE');
});

test('boundary field resolution treats an empty string as absent', () => {
  // The desktop sends every field every time. For a marker written as
  // `{ flow, state }` it has no stateKey to send and sends `''` — which a `??`
  // chain would accept, refusing the event before the boundary saw the marker.
  const metadata: Record<string, unknown> = { flow: 'onboarding-flow', state: 'guest' };
  assert.equal(
    firstNonEmptyValue('', metadata.stateKey, undefined, metadata.toStateKey, metadata.state),
    'guest',
  );
  assert.equal(firstNonEmptyValue('   ', 'guest'), 'guest');
  assert.equal(firstNonEmptyValue('explicit', 'guest'), 'explicit');
  assert.equal(firstNonEmptyValue(null, undefined, ''), '');
});
