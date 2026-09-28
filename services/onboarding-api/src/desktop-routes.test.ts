import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType, QARunMode } from '@tellann/db';
import { applyAutomationPhaseUpdate, assistedFlowContextShape, buildAutomationRunState, firstNonEmptyValue, isApplicationCausedStop, isFlowBoundedRunMode, isSessionScopedQaRun, parseAutomationStopReason, qaRunActiveStatus, qaRunCreationPolicy, productionRunModeAllowed, retryAutomationState, scopeQaRunCompletion } from './desktop-routes';

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

test('automated runs are flow-bounded like guided runs and never allowed against production', () => {
  assert.equal(isFlowBoundedRunMode(QARunMode.AUTOMATED), true);
  assert.equal(isFlowBoundedRunMode(QARunMode.ASSISTED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.AUTOMATED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.STAGING, QARunMode.AUTOMATED), true);
  assert.deepEqual(qaRunCreationPolicy(QARunMode.AUTOMATED, false), { requiresFlowContext: true, usesFlowContext: true, initialStatus: 'CREATED' });
  assert.equal(qaRunActiveStatus(QARunMode.AUTOMATED, false), 'WAITING_FOR_INITIAL');
  assert.equal(qaRunActiveStatus(QARunMode.AUTOMATED, true), 'RECORDING');
  assert.equal(isSessionScopedQaRun(QARunMode.AUTOMATED, 'expected-version'), false);
  assert.equal(isSessionScopedQaRun(QARunMode.AUTOMATED, null), true);
});

test('automation run state pins the config against the Flow version it will run', () => {
  const input = { config: { targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1' }, terminalStateKeys: ['exam_created', 'exam_failed'], initialStateKey: 'course_details', codeSnapshotId: 'hash-1', instrumentationManifestVersion: 'patch-1' };
  const built = buildAutomationRunState(input);
  assert.equal(built.ok, true);
  if (built.ok) {
    assert.equal(built.automation.targetTerminalStateKey, 'exam_created');
    assert.equal(built.automation.initialStateKey, 'course_details');
    assert.equal(built.automation.codeSnapshotId, 'hash-1');
    assert.equal(built.automation.instrumentationManifestVersion, 'patch-1');
    assert.equal(built.automation.executionPhase, 'PREPARING_WORKSPACE');
    assert.equal(built.automation.limits.maxSteps, 100);
  }
  assert.deepEqual(buildAutomationRunState({ ...input, config: { targetTerminalStateKey: 'nope', executionProfileId: 'p' } }), { ok: false, error: 'TARGET_TERMINAL_STATE_UNKNOWN' });
  assert.deepEqual(buildAutomationRunState({ ...input, config: { executionProfileId: 'p' } }), { ok: false, error: 'INVALID_AUTOMATION_CONFIG' });
});

test('an application-caused stop completes the run incomplete with that reason; reaching the terminal wins', () => {
  const base = { sessionScoped: false, observations: [], observedTransitions: [], boundaryStartMs: 1, boundaryEndMs: null, initialAccepted: true, timedOut: false };
  const stopped = scopeQaRunCompletion({ ...base, terminalBoundaryConfirmed: false, automationStopReason: 'EXPECTED_TRANSITION_NOT_FOUND' });
  assert.equal(stopped.completedStatus, 'COMPLETED_INCOMPLETE');
  assert.equal(stopped.completionReason, 'EXPECTED_TRANSITION_NOT_FOUND');
  const reached = scopeQaRunCompletion({ ...base, terminalBoundaryConfirmed: true, automationStopReason: 'LOOP_DETECTED' });
  assert.equal(reached.completedStatus, 'COMPLETED');
  assert.equal(reached.completionReason, 'TERMINAL_STATE_REACHED');
  // Guided completion is untouched when no automation reason is supplied.
  assert.equal(scopeQaRunCompletion({ ...base, terminalBoundaryConfirmed: false }).completionReason, 'MANUAL_STOP_BEFORE_TERMINAL');
});

test('stop reasons from the desktop are validated and classified, never trusted', () => {
  assert.equal(parseAutomationStopReason('LOOP_DETECTED'), 'LOOP_DETECTED');
  assert.equal(parseAutomationStopReason('DROP TABLE'), null);
  assert.equal(isApplicationCausedStop('EXPECTED_TRANSITION_NOT_FOUND'), true);
  assert.equal(isApplicationCausedStop('AUTOMATION_ENGINE_ERROR'), false);
  assert.equal(isApplicationCausedStop(null), false);
});

test('a retry keeps the pinned automation config but starts a fresh attempt', () => {
  const retried = retryAutomationState({ targetTerminalStateKey: 't', executionProfileId: 'p', executionPhase: 'SHUTTING_DOWN', stopReason: 'LOOP_DETECTED' }) as Record<string, unknown>;
  assert.equal(retried.targetTerminalStateKey, 't');
  assert.equal(retried.executionPhase, 'PREPARING_WORKSPACE');
  assert.equal('stopReason' in retried, false);
  assert.equal(retryAutomationState(null), undefined);
});

test('a run stores its target in both spellings, and the two must agree', () => {
  const input = { config: { targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1' }, terminalStateKeys: ['exam_created', 'exam_failed'], initialStateKey: 'course_details', codeSnapshotId: 'hash-1', instrumentationManifestVersion: 'patch-1' };
  const single = buildAutomationRunState(input);
  assert.equal(single.ok && JSON.stringify(single.automation.targetTerminalStateKeys), JSON.stringify(['exam_created']));
  const listed = buildAutomationRunState({ ...input, config: { ...input.config, targetTerminalStateKeys: ['exam_created'] } });
  assert.equal(listed.ok, true);
  // Disagreeing spellings, and more than one target, are refused rather than quietly run as the first.
  assert.deepEqual(buildAutomationRunState({ ...input, config: { ...input.config, targetTerminalStateKeys: ['exam_failed'] } }), { ok: false, error: 'INVALID_AUTOMATION_CONFIG' });
  assert.deepEqual(buildAutomationRunState({ ...input, config: { ...input.config, targetTerminalStateKeys: ['exam_created', 'exam_failed'] } }), { ok: false, error: 'INVALID_AUTOMATION_CONFIG' });
});

const PINNED = { targetTerminalStateKey: 'exam_created', executionProfileId: 'p', executionPhase: 'PREPARING_WORKSPACE', initialStateKey: 'course_details', codeSnapshotId: 'hash-1' };
const NOW = new Date('2026-01-01T12:00:00.000Z');

test('a phase report updates the phase, stamps a heartbeat, and leaves what was pinned alone', () => {
  const result = applyAutomationPhaseUpdate(PINNED, { executionPhase: 'EXECUTING_FLOW' }, NOW);
  assert.equal(result.ok, true);
  if (result.ok) {
    const next = result.automation as Record<string, unknown>;
    assert.equal(next.executionPhase, 'EXECUTING_FLOW');
    assert.equal(next.heartbeatAt, NOW.toISOString());
    for (const key of ['targetTerminalStateKey', 'executionProfileId', 'initialStateKey', 'codeSnapshotId']) assert.equal(next[key], (PINNED as Record<string, unknown>)[key], key);
  }
});

const SUMMARY = { hash: 'a'.repeat(64), flowHash: 'b'.repeat(64), analysisIdentity: 'c'.repeat(64), states: 3, transitions: 2, controlsDerived: 2, controlsMissing: 0, anchored: 1 };

test('which contract the run was compiled into is kept the first time it is reported and never rewritten', () => {
  const first = applyAutomationPhaseUpdate(PINNED, { executionPhase: 'PREPARING_WORKSPACE', contract: SUMMARY }, NOW);
  assert.ok(first.ok);
  const state = (first as { ok: true; automation: unknown }).automation as Record<string, unknown>;
  assert.deepEqual(state.contract, SUMMARY);
  const second = applyAutomationPhaseUpdate(state, { contract: { ...SUMMARY, hash: 'd'.repeat(64) } }, NOW);
  assert.deepEqual(second.ok && (second.automation as Record<string, unknown>).contract, SUMMARY, 'a later report cannot change what the run used');
  const heartbeat = applyAutomationPhaseUpdate(state, {}, NOW);
  assert.deepEqual(heartbeat.ok && (heartbeat.automation as Record<string, unknown>).contract, SUMMARY, 'and a heartbeat keeps it');
  assert.deepEqual(applyAutomationPhaseUpdate(PINNED, { contract: { ...SUMMARY, hash: 'short' } }, NOW), { ok: false, error: 'INVALID_AUTOMATION_PHASE' }, 'only a real hash is accepted');
});

test('a report with no phase is a bare heartbeat', () => {
  const result = applyAutomationPhaseUpdate(PINNED, {}, NOW);
  assert.equal(result.ok && (result.automation as Record<string, unknown>).executionPhase, 'PREPARING_WORKSPACE');
  assert.equal(result.ok && (result.automation as Record<string, unknown>).heartbeatAt, NOW.toISOString());
});

test('waiting for a person is recorded with a reason, and cleared when the run moves on', () => {
  const waiting = applyAutomationPhaseUpdate(PINNED, { executionPhase: 'AWAITING_USER', awaitingUser: { kind: 'SSO', detail: 'Sign in with Google' } }, NOW);
  assert.ok(waiting.ok);
  const state = (waiting as { ok: true; automation: unknown }).automation;
  assert.deepEqual((state as Record<string, unknown>).awaitingUser, { kind: 'SSO', detail: 'Sign in with Google' });
  const carried = applyAutomationPhaseUpdate(state, { executionPhase: 'SEEKING_INITIAL_STATE' }, NOW);
  assert.equal(carried.ok && (carried.automation as Record<string, unknown>).awaitingUser, null, 'no stale waiting-for-you');
  const stillWaiting = applyAutomationPhaseUpdate(state, {}, NOW);
  assert.deepEqual(stillWaiting.ok && (stillWaiting.automation as Record<string, unknown>).awaitingUser, { kind: 'SSO', detail: 'Sign in with Google' }, 'a heartbeat does not clear it');
});

test('an unknown phase or an oversized reason is refused, and a run that is not automated has nothing to update', () => {
  assert.deepEqual(applyAutomationPhaseUpdate(PINNED, { executionPhase: 'TELEPORTING' }, NOW), { ok: false, error: 'INVALID_AUTOMATION_PHASE' });
  assert.deepEqual(applyAutomationPhaseUpdate(PINNED, { awaitingUser: { kind: 'X', detail: 'x'.repeat(301) } }, NOW), { ok: false, error: 'INVALID_AUTOMATION_PHASE' });
  assert.deepEqual(applyAutomationPhaseUpdate(null, { executionPhase: 'EXECUTING_FLOW' }, NOW), { ok: false, error: 'NOT_AN_AUTOMATED_RUN' });
  assert.deepEqual(applyAutomationPhaseUpdate([], {}, NOW), { ok: false, error: 'NOT_AN_AUTOMATED_RUN' });
});

test('the new stop reasons are the neutral kind: neither the application fault nor a failure of Tellann', () => {
  for (const reason of ['MANUAL_AUTHENTICATION_REQUIRED', 'FRAMEWORK_NOT_YET_SUPPORTED']) {
    assert.equal(parseAutomationStopReason(reason), reason);
    assert.equal(isApplicationCausedStop(parseAutomationStopReason(reason)), false, reason);
  }
  const scoped = scopeQaRunCompletion({
    sessionScoped: false, observations: [], observedTransitions: [], boundaryStartMs: 1, boundaryEndMs: null,
    initialAccepted: true, timedOut: false, terminalBoundaryConfirmed: false, automationStopReason: 'MANUAL_AUTHENTICATION_REQUIRED',
  });
  assert.equal(scoped.completionReason, 'MANUAL_AUTHENTICATION_REQUIRED');
  assert.equal(scoped.completedStatus, 'COMPLETED_INCOMPLETE');
});
