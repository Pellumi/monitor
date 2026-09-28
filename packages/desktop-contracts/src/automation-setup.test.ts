import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTOMATION_IPC, AutomationOptionsSchema, StartGuidedRunInputSchema } from './index';
import type { AutomationOptions } from './index';
import { automatedRunBlockers, buildAutomatedStartInput, flowRequirementBlockers, terminalChoices } from './automation-setup';
import type { BlockerInput } from './automation-setup';

const options = (over: Partial<AutomationOptions> = {}): AutomationOptions => ({
  support: { level: 'SUPPORTED', canRun: true, title: 'Automated Run supports this application', message: 'ok', alternatives: ['GUIDED', 'ASSISTED'] },
  workspaceConnected: true, analysisReady: true,
  profiles: [{ id: 'p1', name: 'npm run dev', applicationUrl: 'http://localhost:5173', commands: ['npm run dev'], status: 'APPROVED', approvedAt: '2026-01-01T00:00:00.000Z' }],
  proposedProfiles: [], personas: [], dataSets: [], login: { route: null, source: null, proposals: [] },
  ...over,
});

const ready = (over: Partial<BlockerInput> = {}): BlockerInput => ({
  options: options(), selection: { targetStateKey: 'exam_created', profileId: 'p1', personaId: '', dataSetId: '' },
  environmentType: 'STAGING', flowReady: true, instrumentationChosen: true,
  terminals: [{ key: 'exam_created', name: 'Exam created', kind: 'SUCCESS' }], ...over,
});

test('the endings a Flow offers come out as declared, with a success first', () => {
  const choices = terminalChoices([
    { stateName: 'Payment failed', role: 'TERMINAL', terminalKind: 'FAILURE' },
    { stateName: 'Cart', role: 'NORMAL' },
    { stateName: 'Order placed', behaviorKey: 'order_placed', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    { stateName: 'Cancelled by user', role: 'TERMINAL', terminalKind: 'CANCELLATION' },
    { stateName: '   ', role: 'TERMINAL' },
  ]);
  assert.deepEqual(choices.map((choice) => choice.key), ['order_placed', 'Cancelled by user', 'Payment failed'], 'the key is what the platform validates against (the behaviour key when there is one)');
  assert.equal(choices[0]!.name, 'Order placed');
});

test('a run that can start has nothing standing in its way', () => {
  assert.deepEqual(automatedRunBlockers(ready()), []);
});

test('production is refused with the one thing that does work there, and nothing else is asked of the person', () => {
  const blockers = automatedRunBlockers(ready({ environmentType: 'PRODUCTION', options: null }));
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0]!.code, 'PRODUCTION');
  assert.match(blockers[0]!.message, /Observation only/);
});

test('an application in a framework not built yet is a notice with a way forward, not a list of things to fix', () => {
  const blockers = automatedRunBlockers(ready({ options: options({ support: { level: 'NOT_YET_SUPPORTED', canRun: false, title: 'Automated Run does not support Vue yet', message: 'It is coming soon. Guided and Assisted work with any application.', alternatives: ['GUIDED', 'ASSISTED'] } }) }));
  assert.equal(blockers.length, 1, 'nothing else is listed, because nothing else would help');
  assert.equal(blockers[0]!.tone, 'notice');
  assert.equal(blockers[0]!.fix, 'USE_ANOTHER_MODE');
  assert.match(blockers[0]!.message, /coming soon/);
});

test('each missing prerequisite is named, in the order a person would fix them, with what to do', () => {
  const blockers = automatedRunBlockers(ready({
    options: options({ workspaceConnected: false, profiles: [] }), flowReady: false, instrumentationChosen: false, terminals: [],
    selection: { targetStateKey: '', profileId: '', personaId: '', dataSetId: '' },
  }));
  assert.deepEqual(blockers.map((blocker) => blocker.fix), ['CONNECT_FOLDER', 'INITIALISE_FLOW', 'APPROVE_INSTRUMENTATION', 'CHOOSE_PROFILE']);
  assert.ok(blockers.every((blocker) => blocker.tone === 'todo'));
});

test('a missing analysis, an unchosen target and an unapproved profile are each their own blocker', () => {
  assert.deepEqual(automatedRunBlockers(ready({ options: options({ analysisReady: false }) })).map((b) => b.fix), ['ANALYSE_CODE']);
  assert.deepEqual(automatedRunBlockers(ready({ selection: { targetStateKey: '', profileId: 'p1', personaId: '', dataSetId: '' } })).map((b) => b.fix), ['CHOOSE_TARGET']);
  assert.deepEqual(automatedRunBlockers(ready({ selection: { targetStateKey: 'not-an-ending', profileId: 'p1', personaId: '', dataSetId: '' } })).map((b) => b.fix), ['CHOOSE_TARGET'], 'a target from another Flow does not count');
  const unapproved = options({ profiles: [{ id: 'p1', name: 'n', applicationUrl: 'http://x', commands: ['npm run dev'], status: 'NEEDS_APPROVAL', approvedAt: null }] });
  const blocked = automatedRunBlockers(ready({ options: unapproved }));
  assert.deepEqual(blocked.map((b) => b.fix), ['APPROVE_PROFILE']);
  assert.match(blocked[0]!.message, /npm run dev/, 'the person is shown exactly what they would be approving');
  const changed = options({ profiles: [{ id: 'p1', name: 'n', applicationUrl: 'http://x', commands: ['npm run dev --host'], status: 'CHANGED', approvedAt: null }] });
  assert.equal(automatedRunBlockers(ready({ options: changed }))[0]!.code, 'PROFILE_CHANGED');
});

test('while the options are still loading, Start is held without accusing the person of anything', () => {
  const blockers = automatedRunBlockers(ready({ options: null }));
  assert.deepEqual(blockers.map((b) => b.code), ['LOADING']);
});

// -- the request Start sends ---------------------------------------------------------------------------------------

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = () => ({
  applicationId: uuid(1), environmentId: uuid(2), workspaceId: uuid(3), flowId: uuid(4), flowBindingId: uuid(5), flowInitializationId: uuid(6),
  flowScanId: uuid(7), flowDriftId: null, expectedGraphVersionId: uuid(8), patchSetId: uuid(9), environmentType: 'STAGING' as const,
  targetUrl: 'http://localhost:5173', selection: { targetStateKey: 'exam_created', profileId: 'p1', personaId: '', dataSetId: '' },
});

test('what Start sends is accepted by the same contract the main process parses it with', () => {
  const parsed = StartGuidedRunInputSchema.parse(buildAutomatedStartInput(source()));
  assert.equal(parsed.mode, 'AUTOMATED');
  assert.equal(parsed.automation!.targetTerminalStateKey, 'exam_created');
  assert.equal(parsed.automation!.executionProfileId, 'p1');
  assert.equal(parsed.automation!.testPersonaId, undefined, 'no persona is not an empty persona');
  assert.equal(parsed.automation!.runDataSetId, undefined);
  assert.deepEqual(parsed.captureTracks, ['FRONTEND']);
});

test('a persona and a data set are sent when they were chosen', () => {
  const parsed = StartGuidedRunInputSchema.parse(buildAutomatedStartInput({ ...source(), selection: { targetStateKey: 'exam_created', profileId: 'p1', personaId: 'persona-1', dataSetId: 'data-1' } }));
  assert.equal(parsed.automation!.testPersonaId, 'persona-1');
  assert.equal(parsed.automation!.runDataSetId, 'data-1');
});

test('the contract refuses an automated run against production even if the form is bypassed', () => {
  assert.throws(() => StartGuidedRunInputSchema.parse({ ...buildAutomatedStartInput(source()), environmentType: 'PRODUCTION' }));
});

// -- what crosses the IPC boundary ------------------------------------------------------------------------------------

test('the channel names are unique', () => {
  const names = Object.values(AUTOMATION_IPC);
  assert.equal(new Set(names).size, names.length);
});

test('a persona is never described to the renderer with a value in it', () => {
  const parsed = AutomationOptionsSchema.parse(options({ personas: [{ id: 'p', applicationId: uuid(1), name: 'T', roles: [], authenticated: true, authMethod: 'PASSWORD', credentialFields: ['email', 'password'], updatedAt: 'x', ...({ credentials: [{ field: 'password', value: 'hunter2' }] } as object) }] }));
  assert.ok(!JSON.stringify(parsed).includes('hunter2'), 'unknown keys are stripped by the schema, so a stray value cannot ride along');
});

test('a Flow that declares nothing blocks nothing', () => {
  assert.deepEqual(flowRequirementBlockers(undefined, { environmentType: 'STAGING', persona: null, dataKeys: [] }), []);
  assert.deepEqual(flowRequirementBlockers({}, { environmentType: 'STAGING', persona: null, dataKeys: [] }), []);
});

test('every shortfall against what the Flow needs is said before Start, all at once', () => {
  const blockers = flowRequirementBlockers(
    { actor: 'admin', environments: ['DEVELOPMENT'], data: ['SEED_TOKEN', 'ADMIN_PASSWORD'] },
    { environmentType: 'STAGING', persona: { name: 'Student', roles: ['student'], credentialFields: ['email'] }, dataKeys: [] },
  );
  assert.deepEqual(blockers.map((blocker) => blocker.code), ['FLOW_ENVIRONMENT', 'FLOW_ACTOR', 'FLOW_DATA']);
  assert.match(blockers[0]!.message, /development, and this run is in staging/);
  assert.match(blockers[1]!.message, /"Student" does not have the ADMIN role/);
  assert.match(blockers[2]!.message, /SEED_TOKEN, ADMIN_PASSWORD/, 'a password the persona does not store is still needed');
});

test('the persona can stand in for the sign-in data, and a run with no persona is told to choose one', () => {
  const satisfied = flowRequirementBlockers(
    { actor: 'ADMIN', data: ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'COURSE_BUDGET'] },
    { environmentType: 'STAGING', persona: { name: 'Admin', roles: ['Admin'], credentialFields: ['email', 'password'] }, dataKeys: ['COURSE_BUDGET'] },
  );
  assert.deepEqual(satisfied, []);
  const none = flowRequirementBlockers({ actor: 'ADMIN' }, { environmentType: 'STAGING', persona: null, dataKeys: [] });
  assert.equal(none[0]!.code, 'FLOW_ACTOR');
  assert.match(none[0]!.message, /Choose a persona/);
});
