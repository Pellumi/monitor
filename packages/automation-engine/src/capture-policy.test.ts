import assert from 'node:assert/strict';
import test from 'node:test';
import { decideCapture } from './capture-policy';
import type { CaptureDecision } from './capture-policy';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import { ORIGIN, element, limits, lmsApp, lmsContract, state } from './test-fixtures';

const confident = { confidence: 'HIGH' as const, ambiguous: false };

test('a run going exactly to plan captures nothing beyond the always-on tier', () => {
  const decision = decideCapture({ recognition: confident, action: { fromState: 'a', expectedState: 'b', observedState: 'b', advanced: true }, errorsSince: 0 });
  assert.equal(decision.tier, 'STANDARD');
  assert.deepEqual(decision.reasons, []);
  assert.deepEqual(decision.artifacts, { screenshot: false, fullDom: false, trace: false, codeEvidence: false });
});

test('each kind of anomaly earns forensic depth, and says why', () => {
  const cases: Array<[Parameters<typeof decideCapture>[0], string]> = [
    [{ recognition: { confidence: 'LOW', ambiguous: false } }, 'LOW_CONFIDENCE'],
    [{ recognition: { confidence: 'MEDIUM', ambiguous: true } }, 'AMBIGUOUS_STATE'],
    [{ recognition: null }, 'UNRECOGNISED_STATE'],
    [{ recognition: confident, action: { fromState: 'a', expectedState: 'b', observedState: 'a', advanced: false } }, 'ACTION_DID_NOT_ADVANCE'],
    [{ recognition: confident, action: { fromState: 'a', expectedState: 'b', observedState: 'c', advanced: false } }, 'UNEXPECTED_STATE'],
    [{ recognition: confident, errorsSince: 2 }, 'RUNTIME_ERRORS'],
    [{ blocked: true }, 'ACTION_BLOCKED'],
    [{ stopReason: 'EXPECTED_TRANSITION_NOT_FOUND' }, 'RUN_STOPPED_SHORT'],
  ];
  for (const [input, reason] of cases) {
    const decision = decideCapture(input);
    assert.equal(decision.tier, 'DEEP', reason);
    assert.ok(decision.reasons.includes(reason as never), reason);
    assert.deepEqual([decision.artifacts.screenshot, decision.artifacts.fullDom, decision.artifacts.trace], [true, true, true], reason);
  }
});

test('code evidence is only pulled in when the code could explain the anomaly', () => {
  assert.equal(decideCapture({ recognition: { confidence: 'LOW', ambiguous: false } }).artifacts.codeEvidence, false);
  assert.equal(decideCapture({ recognition: confident, errorsSince: 1 }).artifacts.codeEvidence, false);
  assert.equal(decideCapture({ blocked: true }).artifacts.codeEvidence, true);
  assert.equal(decideCapture({ stopReason: 'TRANSITION_DID_NOT_ADVANCE' }).artifacts.codeEvidence, true);
});

test('reaching the target, or the user stopping the run, is not an anomaly', () => {
  assert.equal(decideCapture({ stopReason: 'TERMINAL_STATE_REACHED' }).tier, 'STANDARD');
  assert.equal(decideCapture({ stopReason: 'CANCELLED_BY_USER' }).tier, 'STANDARD');
  assert.equal(decideCapture({ stopReason: 'BROWSER_CRASHED' }).tier, 'DEEP');
});

const config = (overrides: Partial<AutomationConfig> = {}): AutomationConfig => ({
  contract: lmsContract(), targetStateKey: 'exam_created', environment: 'STAGING', applicationOrigin: ORIGIN, limits: limits(), ...overrides,
});

test('a clean run never asks the adapter for forensic evidence', async () => {
  const app = lmsApp();
  const asked: CaptureDecision[] = [];
  const result = await runAutomation(Object.assign(app, { captureEvidence: (d: CaptureDecision) => { asked.push(d); } }), config());
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.equal(asked.length, 0);
});

test('a run that falls short is captured while the failing page is still up, before the run ends', async () => {
  const app = lmsApp({ clicks: { 'e-create': 'form' } }); // Save goes nowhere.
  const asked: Array<{ decision: CaptureDecision; stateKey: string | null; at: number }> = [];
  Object.assign(app, { captureEvidence: (decision: CaptureDecision, stateKey: string | null) => { asked.push({ decision, stateKey, at: app.events.length }); } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
  assert.ok(asked.some((a) => a.decision.reasons.includes('ACTION_DID_NOT_ADVANCE') && a.stateKey === 'exam_form'));
  const last = asked[asked.length - 1]!;
  assert.ok(last.decision.reasons.includes('RUN_STOPPED_SHORT'));
  // The final capture happens before the STOPPED event, so the adapter has not yet torn anything down.
  assert.ok(!app.eventTypes.slice(0, last.at).includes('QA_AUTOMATION_STOPPED'));
});

test('an adapter that fails to capture does not end the run', async () => {
  const app = lmsApp({ clicks: { 'e-create': 'form' } });
  Object.assign(app, { captureEvidence: () => { throw new Error('disk full'); } });
  const result = await runAutomation(app, config());
  assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE', 'the run still ended for its own reason');
});

void element; void state;
