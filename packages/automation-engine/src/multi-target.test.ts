import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTOMATION_MAX_TARGETS, AutomationConfigSchema, automationTargets, automationTargetsConsistent } from '@tellann/desktop-contracts';
import * as engine from './index';
import { runAutomation } from './executor';
import type { AutomationConfig } from './executor';
import { coveringPaths, declaredEndings } from './path-coverage';
import { resolveRunTargets, terminalStatesOf } from './targets';
import { ORIGIN, control, limits, lmsApp, lmsContract, state, transition } from './test-fixtures';

// -- the shape ---------------------------------------------------------------

const base = { targetTerminalStateKey: 'exam_created', executionProfileId: 'p' };

test('a config is read the same whichever spelling of the target it uses', () => {
  assert.deepEqual(automationTargets(AutomationConfigSchema.parse(base)), ['exam_created']);
  assert.deepEqual(automationTargets(AutomationConfigSchema.parse({ ...base, targetTerminalStateKeys: ['exam_created'] })), ['exam_created']);
});

test('the list is bounded by one constant, and today that constant is one', () => {
  assert.equal(AUTOMATION_MAX_TARGETS, 1);
  assert.equal(AutomationConfigSchema.safeParse({ ...base, targetTerminalStateKeys: ['exam_created', 'exam_error'] }).success, false);
  assert.equal(AutomationConfigSchema.safeParse({ ...base, targetTerminalStateKeys: [] }).success, false);
});

test('the two spellings may not disagree', () => {
  assert.equal(automationTargetsConsistent({ targetTerminalStateKey: 'a', targetTerminalStateKeys: ['a'] }), true);
  assert.equal(automationTargetsConsistent({ targetTerminalStateKey: 'a' }), true);
  assert.equal(automationTargetsConsistent({ targetTerminalStateKey: 'a', targetTerminalStateKeys: ['b'] }), false);
});

test('the engine refuses more than one target instead of quietly running the first', () => {
  assert.deepEqual(resolveRunTargets({ targetStateKey: 'a' }), { ok: true, targets: ['a'] });
  assert.deepEqual(resolveRunTargets({ targetStateKey: 'a', targetStateKeys: ['a'] }), { ok: true, targets: ['a'] });
  const many = resolveRunTargets({ targetStateKey: 'a', targetStateKeys: ['a', 'b'] });
  assert.equal(many.ok, false);
  assert.match(many.ok ? '' : many.detail, /more than 1 target/);
  assert.equal(resolveRunTargets({ targetStateKey: 'a', targetStateKeys: ['b'] }).ok, false);
  assert.equal(resolveRunTargets({ targetStateKey: 'a', targetStateKeys: ['a', 'a'] }).ok, false);
});

const config = (overrides: Partial<AutomationConfig> = {}): AutomationConfig => ({
  contract: lmsContract(), targetStateKey: 'exam_created', environment: 'STAGING', applicationOrigin: ORIGIN, limits: limits(), ...overrides,
});

test('a run given several targets stops before touching the application', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ targetStateKeys: ['exam_created', 'exam_error'] }));
  assert.equal(result.stopReason, 'AUTOMATION_ENGINE_ERROR');
  assert.match(result.detail ?? '', /not supported yet/);
  assert.deepEqual(app.actions, [], 'nothing was clicked');
});

test('a single target given as a list runs exactly as before, and the plan event records the list', async () => {
  const app = lmsApp();
  const result = await runAutomation(app, config({ targetStateKeys: ['exam_created'] }));
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  const plan = app.events.find((event) => event.type === 'QA_AUTOMATION_PLAN_CREATED')!;
  assert.deepEqual(plan.data.targetStateKeys, ['exam_created']);
});

test('the terminal states a run could be pointed at are the ones the Flow declares', () => {
  assert.deepEqual(terminalStatesOf(lmsContract()).map((s) => s.key), ['exam_created', 'exam_error']);
});

// -- the spike ---------------------------------------------------------------

test('the path-coverage spike is not part of the package surface', () => {
  assert.equal('coveringPaths' in engine, false);
});

test('a branching flow is covered by one path per way it can end', () => {
  const coverage = coveringPaths(lmsContract());
  assert.deepEqual(coverage.paths.map((p) => p.transitions), [['t-create', 't-submit'], ['t-create', 't-fail']]);
  assert.deepEqual(coverage.paths.map((p) => [p.endsAt, p.endsAs]), [['exam_created', 'SUCCESS'], ['exam_error', 'FAILURE']]);
  assert.deepEqual(coverage.paths[1]!.newlyCovered, ['t-fail'], 'a path is only credited with what it adds');
  assert.equal(coverage.coverage, 1);
  assert.deepEqual(coverage.uncovered, []);
});

test('what can never be exercised is named, with the reason', () => {
  const contract = lmsContract();
  contract.states.push(state({ key: 'island' }), state({ key: 'island_end', role: 'TERMINAL', terminalKind: 'SUCCESS' }));
  contract.transitions.push(
    transition({ id: 't-island', from: 'island', to: 'island_end', control: control({ labels: ['x'] }) }),
    transition({ id: 't-nocontrol', from: 'exam_form', to: 'exam_created', control: null }),
  );
  const coverage = coveringPaths(contract);
  assert.deepEqual(
    Object.fromEntries(coverage.uncovered.map((u) => [u.transitionId, u.reason])),
    { 't-island': 'UNREACHABLE', 't-nocontrol': 'NO_DERIVED_CONTROL' },
  );
  assert.ok(coverage.coverage < 1);
});

test('steps the environment forbids are reported as blocked, not as unreachable', () => {
  const contract = lmsContract();
  contract.transitions = contract.transitions.map((t) => t.id === 't-submit' ? { ...t, actionClass: 'DESTRUCTIVE' as const } : t);
  const coverage = coveringPaths(contract, { environment: 'PRODUCTION' });
  const blocked = coverage.uncovered.find((u) => u.transitionId === 't-submit');
  assert.equal(blocked?.reason, 'BLOCKED_BY_POLICY');
});

test('a path is bounded, and a flow with no transitions has nothing to cover', () => {
  assert.equal(coveringPaths(lmsContract(), { maxPaths: 1 }).paths.length, 1);
  const empty = lmsContract();
  empty.transitions = [];
  assert.deepEqual(coveringPaths(empty), { paths: [], uncovered: [], coverage: 0 });
});

test('the declared endings say which are ways to succeed and which to fail', () => {
  assert.deepEqual(declaredEndings(lmsContract()), [
    { stateKey: 'exam_created', endsAs: 'SUCCESS' },
    { stateKey: 'exam_error', endsAs: 'FAILURE' },
  ]);
});
