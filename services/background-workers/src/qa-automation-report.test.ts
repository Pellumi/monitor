import assert from 'node:assert/strict';
import test from 'node:test';
import { AutomatedRunSectionSchema } from '@tellann/desktop-contracts';
import { countAutomatedClassifications, summarizeAutomationEvidence } from './qa-automation-report';
import type { AutomationEvidenceEvent } from './qa-automation-report';

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
let seq = 0;
const at = (ms: number) => new Date(T0 + ms);
const event = (eventType: string, ms: number, metadata: Record<string, unknown> = {}, scope = 'IN_FLOW'): AutomationEvidenceEvent =>
  ({ eventType, occurredAt: at(ms), localSequence: seq++, scope, normalizedRoute: null, metadata });

const evaluated = (ms: number, key: string, path: string, scope = 'IN_FLOW', confidence = 'HIGH') =>
  event('QA_AUTOMATION_STATE_EVALUATED', ms, { recognizedStateKey: key, confidence, path }, scope);
const selected = (ms: number, transitionId: string, action: string, expectedState: string, actionClass = 'CLIENT_STATE_MUTATION') =>
  event('QA_AUTOMATION_ACTION_SELECTED', ms, { transitionId, action, expectedState, actionClass, method: 'ROLE_NAME' });
const verified = (ms: number, ok: boolean, expectedState: string, observedState: string | null) =>
  event('QA_AUTOMATION_ACTION_VERIFIED', ms, { ok, expectedState, observedState });
const stopped = (ms: number, stopReason: string, extra: Record<string, unknown> = {}) =>
  event('QA_AUTOMATION_STOPPED', ms, { stopReason, steps: 2, replans: 0, ...extra });

const automation = {
  targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1', testPersonaId: 'persona-1',
  runDataSetId: 'data-1', initialStateKey: 'course_details', codeSnapshotId: 'hash-1', instrumentationManifestVersion: 'patch-1',
  flowVersionId: 'v1', limits: { maxSteps: 100, maxDurationMs: 600000, maxReplans: 10, maxActionRetries: 2 },
};
const run = { mode: 'AUTOMATED', automation, initialStateKey: 'course_details' };
const declared = ['course_details', 'exam_form', 'exam_created', 'exam_error'];

function happyPath(): AutomationEvidenceEvent[] {
  seq = 0;
  return [
    evaluated(0, 'course_details', '/courses/7', 'PRE_BOUNDARY'),
    selected(100, 't-create', 'Create Exam', 'exam_form'),
    verified(300, true, 'exam_form', 'exam_form'),
    evaluated(310, 'exam_form', '/courses/7/exams/new'),
    selected(400, 't-submit', 'Save exam', 'exam_created', 'SERVER_MUTATION'),
    verified(900, true, 'exam_created', 'exam_created'),
    evaluated(910, 'exam_created', '/courses/7/exams/42'),
    stopped(920, 'TERMINAL_STATE_REACHED'),
  ];
}

test('only an Automated run has an automated section', () => {
  for (const mode of ['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY']) {
    assert.equal(summarizeAutomationEvidence({ mode, automation: null }, happyPath(), declared), null);
  }
});

test('a successful run reads back as state-by-state records with timings and actions', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.deepEqual(section.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
  assert.equal(section.states[0]!.durationMs, 310, 'entered at 0, left when the next state was recognised');
  assert.equal(section.states[0]!.action?.label, 'Create Exam');
  assert.equal(section.states[0]!.action?.verified, true);
  assert.equal(section.states[1]!.action?.actionClass, 'SERVER_MUTATION');
  assert.equal(section.states[2]!.action, null, 'the terminal state is not left');
  assert.equal(section.states[2]!.exitedAt, at(920).toISOString());
  assert.equal(section.outcome.reachedTarget, true);
  assert.equal(section.outcome.kind, 'SUCCESS');
  assert.deepEqual(section.unreachedStates, [], 'nothing to explain when the target was reached');
});

test('setup before the boundary is kept apart from the Flow itself', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.equal(section.preBoundaryStateCount, 1);
  assert.equal(section.inFlowStateCount, 2);
  assert.equal(section.states[0]!.scope, 'PRE_BOUNDARY');
});

test('the pinned configuration is reported by identifier, never by credential', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.deepEqual(section.pinned, {
    flowVersionId: 'v1', initialStateKey: 'course_details', targetTerminalStateKey: 'exam_created',
    executionProfileId: 'profile-1', testPersonaId: 'persona-1', runDataSetId: 'data-1',
    codeSnapshotId: 'hash-1', instrumentationManifestVersion: 'patch-1', limits: automation.limits, contract: null,
  });
  const serialized = JSON.stringify(section);
  assert.ok(!/password|credential|secret/i.test(serialized));
});

test('the contract a run was compiled into is reported by hash and counts, and only when it is well formed', () => {
  const contract = { hash: 'a'.repeat(64), flowHash: 'b'.repeat(64), analysisIdentity: null, states: 3, transitions: 2, controlsDerived: 2, controlsMissing: 0, anchored: 1 };
  const withContract = summarizeAutomationEvidence({ ...run, automation: { ...automation, contract } }, happyPath(), declared)!;
  assert.deepEqual(withContract.pinned.contract, contract);
  const malformed = summarizeAutomationEvidence({ ...run, automation: { ...automation, contract: { hash: 'x' } } }, happyPath(), declared)!;
  assert.equal(malformed.pinned.contract, null, 'a stored value that is not a contract summary is not shown as one');
});

test('re-evaluating a state with nothing done in it is one visit, not several', () => {
  seq = 0;
  const events = [
    evaluated(0, 'course_details', '/courses/7'),
    evaluated(50, 'course_details', '/courses/7'),
    evaluated(90, 'course_details', '/courses/7'),
    stopped(100, 'MAX_DURATION_EXCEEDED'),
  ];
  assert.equal(summarizeAutomationEvidence(run, events, declared)!.states.length, 1);
});

test('a page the run could not recognise is not a state visit', () => {
  seq = 0;
  const events = [event('QA_AUTOMATION_STATE_EVALUATED', 0, { recognizedStateKey: null, path: '/whatever' }), stopped(10, 'INITIAL_STATE_UNREACHABLE')];
  assert.equal(summarizeAutomationEvidence(run, events, declared)!.states.length, 0);
});

test('an action that did not advance is recorded against the state it was performed in', () => {
  seq = 0;
  const events = [
    evaluated(0, 'exam_form', '/courses/7/exams/new'),
    selected(10, 't-submit', 'Save exam', 'exam_created', 'SERVER_MUTATION'),
    event('QA_AUTOMATION_ACTION_EXECUTED', 20, { ok: true }),
    verified(500, false, 'exam_created', 'exam_form'),
    stopped(510, 'TRANSITION_DID_NOT_ADVANCE', { detail: 'Save exam was performed but exam_created did not follow.' }),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.states[0]!.action?.verified, false);
  assert.equal(section.states[0]!.action?.observedState, 'exam_form');
  assert.equal(section.outcome.reachedTarget, false);
  assert.equal(section.outcome.kind, 'APPLICATION');
});

test('a state the application prevented is kept apart from one the run never reached', () => {
  seq = 0;
  const events = [
    evaluated(0, 'course_details', '/courses/7'),
    event('QA_AUTOMATION_ACTION_BLOCKED', 10, { reason: 'CONTROL_NOT_FOUND', transitionId: 't-create', expectedState: 'exam_form', detail: 'No control for Create Exam is on the page.' }),
    stopped(20, 'EXPECTED_TRANSITION_NOT_FOUND', { detail: 'No control for Create Exam is on the page.' }),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  const byKey = Object.fromEntries(section.unreachedStates.map((s) => [s.stateKey, s]));
  assert.equal(byKey.exam_form!.status, 'BLOCKED_BY_APPLICATION');
  assert.match(byKey.exam_form!.detail ?? '', /Create Exam/);
  assert.equal(byKey.exam_created!.status, 'BLOCKED_BY_APPLICATION', 'the run\'s own target, with an application-caused stop');
  assert.equal(byKey.exam_error!.status, 'NOT_ATTEMPTED', 'the run never even tried this one');
});

test('a block from the run\'s own safety policy is never attributed to the application', () => {
  seq = 0;
  const events = [
    evaluated(0, 'exam_form', '/courses/7/exams/new'),
    event('QA_AUTOMATION_ACTION_BLOCKED', 10, { reason: 'ACTION_CLASS_BLOCKED', transitionId: 't-submit', expectedState: 'exam_created', detail: 'blocked' }),
    stopped(20, 'UNSAFE_ACTION_BLOCKED'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.blockedActions.length, 1);
  assert.equal(section.unreachedStates.find((s) => s.stateKey === 'exam_created')!.status, 'NOT_ATTEMPTED');
});

test('an infrastructure failure is reported as one, and is not blamed on the application', () => {
  seq = 0;
  const events = [evaluated(0, 'course_details', '/courses/7'), stopped(10, 'APPLICATION_START_FAILED')];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.outcome.kind, 'INFRASTRUCTURE');
  assert.ok(section.unreachedStates.every((s) => s.status === 'NOT_ATTEMPTED'));
});

test('runtime errors are counted against the state the run was in', () => {
  seq = 0;
  const events = [
    evaluated(0, 'course_details', '/courses/7'),
    event('QA_RUNTIME_ERROR', 5),
    event('QA_RUNTIME_ERROR', 6),
    evaluated(10, 'exam_form', '/x'),
    stopped(20, 'MAX_STEPS_EXCEEDED'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.states[0]!.errorCount, 2);
  assert.equal(section.states[1]!.errorCount, 0);
});

test('events are read in time order regardless of how they arrive', () => {
  const shuffled = [...happyPath()].reverse();
  assert.deepEqual(summarizeAutomationEvidence(run, shuffled, declared)!.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
});

test('with no stop event the server-recorded stop reason still describes the outcome', () => {
  const section = summarizeAutomationEvidence({ ...run, automation: { ...automation, stopReason: 'AUTHORIZATION_BLOCKED' } }, [], declared)!;
  assert.equal(section.outcome.stopReason, 'AUTHORIZATION_BLOCKED');
  assert.equal(section.outcome.kind, 'APPLICATION');
});

test('an unrecognised stop reason is dropped rather than trusted', () => {
  const section = summarizeAutomationEvidence({ ...run, automation: { ...automation, stopReason: 'DROP TABLE' } }, [], declared)!;
  assert.equal(section.outcome.stopReason, null);
  assert.equal(section.outcome.kind, null);
});

test('reconciliation gaps are counted by the reason the run\'s evidence gives for them', () => {
  const counts = countAutomatedClassifications([
    { trueGaps: [{ stateName: 'a', automatedClassification: 'AUTHORIZATION_MISMATCH' }, { stateName: 'b' }], trueGapTransitionsList: [{ automatedClassification: 'DECLARATION_MISMATCH' }, { automatedClassification: 'AUTHORIZATION_MISMATCH' }] },
    { trueGaps: 'not-a-list' },
  ]);
  assert.deepEqual(counts, { AUTHORIZATION_MISMATCH: 2, DECLARATION_MISMATCH: 1 });
  const section = summarizeAutomationEvidence(run, happyPath(), declared, [{ trueGaps: [{ automatedClassification: 'DATA_PRECONDITION_FAILURE' }] }])!;
  assert.deepEqual(section.reconciliation, { DATA_PRECONDITION_FAILURE: 1 });
});

test('the section validates against its own contract', () => {
  assert.equal(AutomatedRunSectionSchema.safeParse(summarizeAutomationEvidence(run, happyPath(), declared)).success, true);
});

const codeEvidenceMeta = (overrides: Record<string, unknown> = {}) => ({
  subject: { kind: 'TRANSITION', id: 't-submit' },
  stateKey: 'exam_form',
  derivation: 'RESOLVED',
  refs: [{ file: 'src/exams/create.tsx', symbol: 'saveExam', startLine: 2, endLine: 4, excerptSha256: 'abc123' }],
  calls: ['POST /api/exams'],
  navigatesTo: [],
  guards: [{ kind: 'middleware', name: 'middleware', file: 'middleware.ts', requiresAuth: true, roles: ['TEACHER'], route: '/exams/created' }],
  expectedApi: [{ method: 'POST', route: '/api/exams' }],
  summary: 'Save exam is mapped to saveExam.',
  ...overrides,
});

test('code evidence and retained traces from a failed run reach the section', () => {
  seq = 0;
  const events = [
    evaluated(0, 'exam_form', '/courses/7/exams/new'),
    selected(100, 't-submit', 'Save exam', 'exam_created', 'SERVER_MUTATION'),
    verified(300, false, 'exam_created', null),
    event('QA_AUTOMATION_CODE_EVIDENCE', 310, codeEvidenceMeta()),
    event('QA_AUTOMATION_TRACE_RETAINED', 320, { stateKey: 'Exam Form', reasons: ['ACTION_DID_NOT_ADVANCE'] }),
    stopped(330, 'TRANSITION_DID_NOT_ADVANCE'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.codeEvidence.length, 1);
  assert.equal(section.codeEvidence[0]!.refs[0]!.file, 'src/exams/create.tsx');
  assert.equal(section.codeEvidence[0]!.at, at(310).toISOString());
  assert.deepEqual(section.retainedTraces, [{ stateKey: 'exam_form', reasons: ['ACTION_DID_NOT_ADVANCE'], at: at(320).toISOString() }]);
  assert.equal(AutomatedRunSectionSchema.safeParse(section).success, true);
});

test('a run that went to plan has no diagnostics', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.deepEqual([section.codeEvidence, section.retainedTraces], [[], []]);
});

test('a malformed code-evidence record costs one entry, not the section', () => {
  seq = 0;
  const section = summarizeAutomationEvidence(run, [
    evaluated(0, 'exam_form', '/x'),
    event('QA_AUTOMATION_CODE_EVIDENCE', 10, { subject: 'nonsense' }),
    event('QA_AUTOMATION_CODE_EVIDENCE', 20, codeEvidenceMeta()),
    stopped(30, 'TRANSITION_DID_NOT_ADVANCE'),
  ], declared)!;
  assert.equal(section.codeEvidence.length, 1);
});

test('diagnostics are bounded', () => {
  seq = 0;
  const many = Array.from({ length: 50 }, (_, index) => event('QA_AUTOMATION_TRACE_RETAINED', index, { stateKey: 'a', reasons: [] }));
  const section = summarizeAutomationEvidence(run, [evaluated(0, 'a', '/a'), ...many, stopped(99, 'TRANSITION_DID_NOT_ADVANCE')], declared)!;
  assert.equal(section.retainedTraces.length, 20);
});

test('source text is never part of what a report carries about code', () => {
  seq = 0;
  const section = summarizeAutomationEvidence(run, [
    evaluated(0, 'exam_form', '/x'),
    event('QA_AUTOMATION_CODE_EVIDENCE', 10, { ...codeEvidenceMeta(), source: 'export function saveExam() { secret() }', excerpt: 'secret()' }),
    stopped(30, 'TRANSITION_DID_NOT_ADVANCE'),
  ], declared)!;
  assert.ok(!JSON.stringify(section).includes('secret()'), 'unknown fields are stripped when the record is validated');
});

test('render timing is aggregated per component across readings, and attributed to the states it belongs to', () => {
  seq = 0;
  const section = summarizeAutomationEvidence(run, [
    evaluated(0, 'exam_form', '/x'),
    event('QA_AUTOMATION_RENDER_TIMING', 10, { stateKey: 'course_details', samples: [{ component: 'ExamForm', states: ['Exam Form'], mounts: 1, updates: 0, totalMs: 4.2, maxMs: 4.2 }] }),
    event('QA_AUTOMATION_RENDER_TIMING', 20, { stateKey: 'exam_form', samples: [
      { component: 'ExamForm', states: ['exam_form'], mounts: 0, updates: 3, totalMs: 9.1, maxMs: 5 },
      { component: 'Layout', states: ['exam_form', 'exam_created'], mounts: 1, updates: 0, totalMs: 1, maxMs: 1 },
    ] }),
    stopped(30, 'TERMINAL_STATE_REACHED'),
  ], declared)!;
  const form = section.renderTiming.find((sample) => sample.component === 'ExamForm')!;
  assert.deepEqual([form.mounts, form.updates, form.totalMs, form.maxMs], [1, 3, 13.3, 5]);
  assert.deepEqual(form.states, ['exam_form'], 'the same state named two ways is one state');
  assert.deepEqual(section.renderTiming.find((sample) => sample.component === 'Layout')!.states, ['exam_form', 'exam_created']);
  assert.equal(AutomatedRunSectionSchema.safeParse(section).success, true);
});

test('malformed render timing is ignored, not fatal', () => {
  seq = 0;
  const section = summarizeAutomationEvidence(run, [
    evaluated(0, 'exam_form', '/x'),
    event('QA_AUTOMATION_RENDER_TIMING', 10, { samples: 'nonsense' }),
    event('QA_AUTOMATION_RENDER_TIMING', 11, { samples: [{ nope: 1 }, { component: 'Ok', mounts: -5, updates: 'x', totalMs: -1, maxMs: NaN }] }),
    stopped(30, 'TERMINAL_STATE_REACHED'),
  ], declared)!;
  assert.deepEqual(section.renderTiming.map((sample) => [sample.component, sample.mounts, sample.totalMs]), [['Ok', 0, 0]]);
});

test('a run that did not opt in to render timing reports none', () => {
  assert.deepEqual(summarizeAutomationEvidence(run, happyPath(), declared)!.renderTiming, []);
});

// -- what the run measured, carried through to the report ------------------------------------------

test('what the Flow declared a step causes is read, against what the page actually did', () => {
  const events = [
    evaluated(0, 'exam_form', '/courses/7/exams/new'),
    selected(100, 't-submit', 'Save exam', 'exam_created', 'SERVER_MUTATION'),
    event('QA_AUTOMATION_ACTION_VERIFIED', 400, {
      ok: true, expectedState: 'exam_created', observedState: 'exam_created',
      effects: [
        { method: 'post', route: '/api/exams', expectedStatus: 201, outcome: 'STATUS_MISMATCH', observedStatus: 200 },
        { method: 'POST', route: '/api/audit', expectedStatus: null, outcome: 'NOT_OBSERVED', observedStatus: null },
        { method: 'GET', route: '/api/exams/{param}', expectedStatus: 200, outcome: 'MATCHED', observedStatus: 200 },
      ],
    }),
    evaluated(410, 'exam_created', '/courses/7/exams/42'),
    stopped(420, 'TERMINAL_STATE_REACHED'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  const effects = section.states.find((state) => state.stateKey === 'exam_form')!.action!.effects;

  assert.equal(effects.length, 3, 'a contract the application quietly stopped honouring used to be thrown away here');
  assert.equal(effects[0]!.method, 'POST', 'the method is normalised, so a report does not mix post and POST');
  assert.deepEqual(effects.map((effect) => effect.outcome), ['STATUS_MISMATCH', 'NOT_OBSERVED', 'MATCHED']);
  // And the one that did not happen leads the summary, because that is the application not doing what it says.
  assert.ok(section.summary!.priorities.some((line) => line.includes('/api/exams')));
  assert.equal(AutomatedRunSectionSchema.safeParse(section).success, true);
});

test('how hard each control was to find becomes a verdict a person can read', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ method: 'ROLE_NAME', candidates: 1, unusable: 0, attempt: 1 }, 'EASY'],
    [{ method: 'TEXT', candidates: 1, unusable: 0, attempt: 1 }, 'NO_STABLE_IDENTITY'],
    [{ method: 'ROLE_NAME', candidates: 4, unusable: 0, attempt: 1 }, 'AMONG_LOOKALIKES'],
    [{ method: 'ROLE_NAME', candidates: 1, unusable: 2, attempt: 1 }, 'HIDDEN_OR_DISABLED'],
    [{ method: 'ROLE_NAME', candidates: 1, unusable: 0, attempt: 2 }, 'NEEDED_RETRY'],
  ];
  for (const [meta, expected] of cases) {
    const events = [
      evaluated(0, 'exam_form', '/x'),
      event('QA_AUTOMATION_ACTION_SELECTED', 100, { transitionId: 't', action: 'Save', expectedState: 'exam_created', actionClass: 'READ', ...meta }),
      verified(200, true, 'exam_created', 'exam_created'),
      evaluated(210, 'exam_created', '/y'),
      stopped(220, 'TERMINAL_STATE_REACHED'),
    ];
    const section = summarizeAutomationEvidence(run, events, declared)!;
    assert.equal(section.states[0]!.action!.ease, expected, JSON.stringify(meta));
  }
});

test('a step that took a visible while to take effect is reported as slow', () => {
  const events = [
    evaluated(0, 'exam_form', '/x'),
    selected(100, 't', 'Save', 'exam_created'),
    event('QA_AUTOMATION_ACTION_VERIFIED', 100, { ok: true, expectedState: 'exam_created', observedState: 'exam_created', settledMs: 3_200, busyIndicator: false }),
    evaluated(110, 'exam_created', '/y'),
    stopped(120, 'TERMINAL_STATE_REACHED'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.states[0]!.action!.ease, 'SLOW_TRANSITION');
  assert.equal(section.states[0]!.action!.settledMs, 3_200);
  assert.equal(section.states[0]!.action!.busyIndicator, false);
});

test('what is wrong with the Flow as a person would meet it is carried through, worst first', () => {
  const events = [
    event('QA_AUTOMATION_UI_QUALITY', 0, {
      stateKey: null,
      findings: [{ rule: 'REDUNDANT_STEP', severity: 'LOW', stateKey: 'exam_form', breakpoint: null, detail: 'A page people click through.', recommendation: 'Remove it.' }],
    }),
    ...happyPath(),
    event('QA_AUTOMATION_UI_QUALITY', 930, {
      stateKey: 'exam_form',
      findings: [{ rule: 'TAP_TARGET_TOO_SMALL', severity: 'MEDIUM', stateKey: 'exam_form', breakpoint: 'mobile (390x844)', detail: 'Close is 18x18px, below 44x44.', recommendation: 'More padding.' }],
    }),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;

  assert.deepEqual(section.uiQuality.map((finding) => finding.rule), ['TAP_TARGET_TOO_SMALL', 'REDUNDANT_STEP'], 'worst first');
  assert.equal(section.uiQuality[0]!.breakpoint, 'mobile (390x844)');
  assert.ok(section.summary!.priorities.some((line) => line.includes('18x18px')), 'and the worst of it leads the summary');
  assert.equal(AutomatedRunSectionSchema.safeParse(section).success, true);
});

test('every size each state was checked at is recorded, whether or not anything was wrong', () => {
  const events = [
    ...happyPath(),
    event('QA_AUTOMATION_RESPONSIVE_SAMPLE', 930, {
      stateKey: 'exam_form',
      samples: [
        { name: 'mobile', width: 390, height: 844, horizontalOverflowPx: 180, smallestTextPx: 11.5, smallestTapTargetPx: 18, controlsChecked: 4 },
        { name: 'laptop', width: 1280, height: 800, horizontalOverflowPx: 0, smallestTextPx: 14, smallestTapTargetPx: 44, controlsChecked: 4 },
      ],
    }),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.equal(section.responsive.length, 1);
  assert.equal(section.responsive[0]!.stateKey, 'exam_form');
  assert.deepEqual(section.responsive[0]!.samples.map((sample) => sample.name), ['mobile', 'laptop']);
  assert.equal(section.responsive[0]!.samples[0]!.horizontalOverflowPx, 180);
  assert.equal(section.responsive[0]!.samples[1]!.smallestTapTargetPx, 44, 'all clear at this size is worth saying too');
  assert.ok(!section.limitations.some((line) => line.includes('No window sizes were checked')));
});

test('a run that measured nothing says so, rather than leaving a silent absence', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.ok(section.limitations.some((line) => line.includes('No window sizes were checked')));
  assert.ok(section.limitations.some((line) => line.includes('not measured')));
});

test('a saved sign-in that had to be thrown away is explained, because it changes how a run read', () => {
  const events = [event('QA_AUTOMATION_SESSION_DISCARDED', 0, { stopReason: 'AUTHENTICATION_FAILED', detail: 'x' }), ...happyPath()];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(section.limitations.some((line) => line.includes('saved sign-in')));
});

test('masked screen-text analysis that corroborated an uncertain screen is noted as assisted evidence, not a finding', () => {
  const events = [event('QA_AUTOMATION_OCR_ANALYSIS', 0, { reason: 'STATE_AMBIGUOUS', status: 'SUCCEEDED', outcome: 'ASSISTED' }), ...happyPath()];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(section.limitations.some((line) => line.includes('Masked screen-text analysis corroborated') && line.includes('assisted evidence')));
});

test('an unavailable masked screen-text analysis is noted without being presented as evidence', () => {
  const events = [event('QA_AUTOMATION_OCR_ANALYSIS', 0, { reason: 'CONTROL_NOT_FOUND', status: 'UNAVAILABLE' }), ...happyPath()];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(section.limitations.some((line) => line.includes('Screen-text analysis was unavailable') && line.includes('deterministic result was retained')));
});

test('a successful screen-text analysis that did not change the result adds no limitation', () => {
  const events = [event('QA_AUTOMATION_OCR_ANALYSIS', 0, { reason: 'STATE_LOW_CONFIDENCE', status: 'SUCCEEDED', outcome: 'NO_CHANGE' }), ...happyPath()];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(!section.limitations.some((line) => line.toLowerCase().includes('screen-text')));
});

// -- the lead ---------------------------------------------------------------------------------------

test('a run that got there says so, and has nothing to prioritise', () => {
  const section = summarizeAutomationEvidence(run, happyPath(), declared)!;
  assert.match(section.summary!.headline, /Reached exam_created/);
  assert.equal(section.summary!.reached, 2, 'the two in-flow states; the first was setup');
  assert.equal(section.summary!.declared, 4);
  assert.equal(section.summary!.furthestStateKey, 'exam_created');
  assert.deepEqual(section.summary!.priorities, []);
});

test('a run the application stopped leads with what stopped it, and how far it got', () => {
  const events = [
    evaluated(0, 'course_details', '/courses/7', 'PRE_BOUNDARY'),
    selected(100, 't-create', 'Create Exam', 'exam_form'),
    verified(300, true, 'exam_form', 'exam_form'),
    evaluated(310, 'exam_form', '/courses/7/exams/new'),
    selected(400, 't-submit', 'Save exam', 'exam_created', 'SERVER_MUTATION'),
    verified(900, false, 'exam_created', 'exam_form'),
    stopped(920, 'TRANSITION_DID_NOT_ADVANCE', { detail: 'Save exam was performed but exam_created did not follow.' }),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.match(section.summary!.headline, /stopped short of exam_created/);
  assert.match(section.summary!.headline, /1 of 4 declared states/);
  assert.equal(section.summary!.priorities[0], 'Save exam was performed but exam_created did not follow.');
});

test('a failure of our own machinery never leads as a finding about the application', () => {
  const events = [...happyPath().slice(0, 3), stopped(400, 'BROWSER_CRASHED', { detail: 'The managed browser closed.' })];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.match(section.summary!.headline, /own machinery failed/);
  assert.match(section.summary!.headline, /Nothing here is a finding about the application/);
  assert.deepEqual(section.summary!.priorities, []);
});

test('a run that needed something it was not given says that, not that the application is wrong', () => {
  const events = [...happyPath().slice(0, 1), stopped(100, 'SUPPLIED_SESSION_REJECTED', { detail: 'The session was not accepted.' })];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.match(section.summary!.headline, /needed something it was not given/);
  assert.match(section.summary!.headline, /Nothing here is a finding about the application/);
});

test('errors raised in the page reach the lead, with the state they started in', () => {
  const events = [
    evaluated(0, 'exam_form', '/x'),
    event('QA_RUNTIME_ERROR', 50, {}),
    event('QA_RUNTIME_ERROR', 60, {}),
    selected(100, 't', 'Save', 'exam_created'),
    verified(200, true, 'exam_created', 'exam_created'),
    evaluated(210, 'exam_created', '/y'),
    stopped(220, 'TERMINAL_STATE_REACHED'),
  ];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(section.summary!.priorities.some((line) => line.includes('raised errors in the page')));
  assert.ok(section.summary!.priorities.some((line) => line.includes('exam_form')));
});

test('the lead stays a lead, and is never the rest of the report again', () => {
  const findings = Array.from({ length: 30 }, (_, index) => ({
    rule: 'LOW_CONTRAST', severity: 'MEDIUM', stateKey: 'exam_form', breakpoint: null,
    detail: `Finding ${index}`, recommendation: null,
  }));
  const events = [...happyPath(), event('QA_AUTOMATION_UI_QUALITY', 930, { stateKey: 'exam_form', findings })];
  const section = summarizeAutomationEvidence(run, events, declared)!;
  assert.ok(section.summary!.priorities.length <= 5);
  assert.equal(section.uiQuality.length, 30, 'all of it is still in the section below');
});
