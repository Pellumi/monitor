import assert from "node:assert/strict";
import test from "node:test";

import { anomalyText, blockedActionRows, codeEvidenceEntries, durationText, easeText, effectRows, modeLabel, MODE_MEANINGS, outcomeSummary, pinnedRows, reconciliationRows, renderTimingRows, responsiveGrid, retainedTraceRows, uiQualityRows, unreachedLabel } from "./automated-report";
import type { AutomatedSection } from "./automated-report";

const section = (overrides: Partial<AutomatedSection["outcome"]> = {}): AutomatedSection => ({
  pinned: {
    flowVersionId: "v1", initialStateKey: "course_details", targetTerminalStateKey: "exam_created", executionProfileId: "profile-1",
    testPersonaId: null, runDataSetId: null, codeSnapshotId: "hash-1", instrumentationManifestVersion: null,
  },
  outcome: { stopReason: "TERMINAL_STATE_REACHED", kind: "SUCCESS", reachedTarget: true, detail: null, steps: 2, replans: 0, ...overrides },
  states: [], preBoundaryStateCount: 0, inFlowStateCount: 0, unreachedStates: [], reconciliation: {},
});

test("every mode is labelled and says what an absence of evidence means", () => {
  for (const mode of ["GUIDED", "ASSISTED", "OBSERVATION_ONLY", "AUTOMATED"]) {
    assert.notEqual(modeLabel(mode), mode);
    assert.ok(MODE_MEANINGS[mode]);
  }
  assert.equal(modeLabel("AUTOMATED"), "Automated");
  assert.equal(modeLabel(null), "Not recorded", "a report from before modes were recorded");
  assert.equal(modeLabel("SOMETHING_NEW"), "SOMETHING_NEW");
});

test("a successful run says every step was performed", () => {
  const summary = outcomeSummary(section());
  assert.equal(summary.tone, "success");
  assert.match(summary.explanation, /exam_created/);
});

test("an application-caused stop is presented as a finding about the application", () => {
  const summary = outcomeSummary(section({ stopReason: "EXPECTED_TRANSITION_NOT_FOUND", kind: "APPLICATION", reachedTarget: false, detail: "No control for Create Exam is on the page." }));
  assert.equal(summary.tone, "application");
  assert.equal(summary.headline, "A declared control was not on the page");
  assert.match(summary.explanation, /Create Exam/);
});

test("an infrastructure failure is explicitly not a finding about the application", () => {
  const summary = outcomeSummary(section({ stopReason: "APPLICATION_START_FAILED", kind: "INFRASTRUCTURE", reachedTarget: false }));
  assert.equal(summary.tone, "infrastructure");
  assert.match(summary.explanation, /not a finding about the application/);
});

test("a user cancellation reads as neutral, and an unrecorded outcome does not pretend to know", () => {
  assert.equal(outcomeSummary(section({ stopReason: "CANCELLED_BY_USER", kind: "USER", reachedTarget: false })).tone, "neutral");
  const unknown = outcomeSummary(section({ stopReason: null, kind: null, reachedTarget: false }));
  assert.equal(unknown.headline, "Outcome not recorded");
});

test("prevented-by-the-application and never-attempted stay distinct on screen", () => {
  assert.notEqual(unreachedLabel("BLOCKED_BY_APPLICATION"), unreachedLabel("NOT_ATTEMPTED"));
});

test("the pinned configuration lists identifiers, with a plain placeholder for what was not recorded", () => {
  const rows = Object.fromEntries(pinnedRows(section()));
  assert.equal(rows["Flow version"], "v1");
  assert.equal(rows["Test persona"], "Not recorded");
});

test("reconciliation reasons are described in words, and empty counts are left out", () => {
  const rows = reconciliationRows({ ...section(), reconciliation: { AUTHORIZATION_MISMATCH: 2, DATA_PRECONDITION_FAILURE: 0, DECLARATION_MISMATCH: 1 } });
  assert.deepEqual(rows, [["Explained by the persona's role", 2], ["The code does something other than declared", 1]]);
});

test("durations read naturally", () => {
  assert.equal(durationText(null), "—");
  assert.equal(durationText(250), "250 ms");
  assert.equal(durationText(1500), "1.5 s");
});

test("code evidence is presented as locations and a summary, with a caveat only when the mapping is doubtful", () => {
  const base = section();
  base.codeEvidence = [
    { subject: { kind: "TRANSITION", id: "t-submit" }, stateKey: "exam_form", derivation: "RESOLVED", refs: [{ file: "src/exams/create.tsx", symbol: "saveExam", startLine: 2, endLine: 4, excerptSha256: "abc" }], summary: "Save exam is mapped to saveExam.", at: "2026-01-01T00:00:00.000Z" },
    { subject: { kind: "STATE", id: "exam_form" }, stateKey: "exam_form", derivation: "AMBIGUOUS", refs: [{ file: "app/page.tsx", symbol: null, startLine: null, endLine: null, excerptSha256: null }], summary: "x", at: "2026-01-01T00:00:00.000Z" },
  ];
  const [transition, state] = codeEvidenceEntries(base);
  assert.equal(transition!.heading, "Transition t-submit");
  assert.deepEqual(transition!.locations, ["saveExam — src/exams/create.tsx:2-4"]);
  assert.equal(transition!.caveat, null);
  assert.deepEqual(state!.locations, ["app/page.tsx"]);
  assert.match(state!.caveat!, /ambiguous/);
});

test("a report from before code evidence existed still renders", () => {
  assert.deepEqual(codeEvidenceEntries(section()), []);
  assert.deepEqual(retainedTraceRows(section()), []);
});

test("a retained trace says where and why in words", () => {
  const base = section();
  base.retainedTraces = [{ stateKey: "exam_form", reasons: ["ACTION_DID_NOT_ADVANCE", "RUNTIME_ERRORS"], at: "2026-01-01T00:00:00.000Z" }, { stateKey: null, reasons: [], at: "2026-01-01T00:00:00.000Z" }];
  assert.deepEqual(retainedTraceRows(base), [
    ["exam_form", "an action did not lead anywhere; the page raised errors"],
    ["Before the first state", "something went wrong here"],
  ]);
  assert.equal(anomalyText("SOMETHING_NEW"), "SOMETHING_NEW");
});

test("render timing lists the costliest component first, and nothing when the run did not opt in", () => {
  assert.deepEqual(renderTimingRows(section()), []);
  const base = section();
  base.renderTiming = [
    { component: "Layout", states: [], mounts: 1, updates: 0, totalMs: 1, maxMs: 1 },
    { component: "ExamForm", states: ["exam_form"], mounts: 1, updates: 3, totalMs: 13.3, maxMs: 5 },
  ];
  const [first, second] = renderTimingRows(base);
  assert.equal(first!.component, "ExamForm");
  assert.equal(first!.renders, "1 mount, 3 updates");
  assert.equal(first!.total, "13.3 ms");
  assert.equal(second!.states, "not mapped to a state");
});

test("a run that needed a person to sign in is not worded as a finding, nor as a fault of Tellann", () => {
  const summary = outcomeSummary(section({ stopReason: "MANUAL_AUTHENTICATION_REQUIRED", kind: "USER", reachedTarget: false }));
  assert.equal(summary.tone, "neutral");
  assert.equal(summary.headline, "Signing in needed a person");
  assert.match(summary.explanation, /CAPTCHA/);
  assert.match(summary.explanation, /Nothing here says anything about the application/);
});

test("an application in a framework not supported yet is a notice, with the way forward", () => {
  const summary = outcomeSummary(section({ stopReason: "FRAMEWORK_NOT_YET_SUPPORTED", kind: "USER", reachedTarget: false }));
  assert.equal(summary.tone, "neutral");
  assert.match(summary.explanation, /coming soon/);
  assert.match(summary.explanation, /Guided or Assisted/);
});

test("the contract a run used is shown by hash and how much of it came from the code, and its absence is said", () => {
  const withContract = section();
  withContract.pinned.contract = { hash: "abcdef0123456789".repeat(4), states: 3, transitions: 4, controlsDerived: 3, controlsMissing: 1, anchored: 2 };
  const rows = Object.fromEntries(pinnedRows(withContract));
  assert.equal(rows["Executable contract"], "abcdef012345 · 3 of 4 steps had a control derived from the code, 2 anchored");
  assert.equal(Object.fromEntries(pinnedRows(section()))["Executable contract"], "Not recorded", "a run from before this was recorded");
});

// -- what the run measured ------------------------------------------------------------------------

const withStates = (states: AutomatedSection["states"], extra: Partial<AutomatedSection> = {}): AutomatedSection =>
  ({ ...section(), states, ...extra });

const step = (over: Partial<NonNullable<AutomatedSection["states"][number]["action"]>> = {}): AutomatedSection["states"][number] => ({
  sequence: 0, stateKey: "exam_form", confidence: "HIGH", scope: "IN_FLOW", route: "/exams/new", durationMs: 400, errorCount: 0,
  action: { label: "Save exam", actionClass: "SERVER_MUTATION", verified: true, error: null, ...over },
});

test("how hard a step was to get at is said only when it was harder than it should be", () => {
  assert.equal(easeText(step({ ease: "EASY", settledMs: 90 }).action), null, "the ordinary case says nothing");
  assert.equal(easeText(null), null);

  const awkward = easeText(step({ ease: "NO_STABLE_IDENTITY", settledMs: 2_400 }).action)!;
  assert.match(awkward, /nothing but its visible text/);
  assert.match(awkward, /waited 2\.4 s/);

  assert.match(easeText(step({ ease: "HIDDEN_OR_DISABLED" }).action)!, /hidden or disabled/);
  assert.match(easeText(step({ ease: "NEEDED_RETRY" }).action)!, /did not respond the first time/);
});

test("only the declared requests that went wrong are shown, with the step they belong to", () => {
  const rows = effectRows(withStates([step({
    effects: [
      { method: "POST", route: "/api/exams", expectedStatus: 201, outcome: "NOT_OBSERVED", observedStatus: null },
      { method: "POST", route: "/api/audit", expectedStatus: 201, outcome: "STATUS_MISMATCH", observedStatus: 500 },
      { method: "GET", route: "/api/me", expectedStatus: 200, outcome: "MATCHED", observedStatus: 200 },
    ],
  })]));

  assert.equal(rows.length, 2, "a request that happened as declared is the Flow working, not a row in a problems table");
  assert.equal(rows[0]!.request, "POST /api/exams");
  assert.match(rows[0]!.outcome, /never happened/);
  assert.match(rows[1]!.outcome, /Answered 500 rather than 201/);
  assert.match(rows[0]!.where, /exam_form · Save exam/);
});

test("a run from before any of this was kept produces no rows rather than throwing", () => {
  const old = withStates([{ sequence: 0, stateKey: "s", confidence: null, scope: "IN_FLOW", route: null, durationMs: null, action: { label: "x", actionClass: null, verified: true, error: null }, errorCount: 0 }]);
  assert.deepEqual(effectRows(old), []);
  assert.deepEqual(uiQualityRows(old), []);
  assert.deepEqual(blockedActionRows(old), []);
  assert.equal(responsiveGrid(old), null);
  assert.equal(easeText(old.states[0]!.action), null);
});

test("what is wrong with the Flow is titled in plain words, and says where it was found", () => {
  const rows = uiQualityRows(withStates([], {
    uiQuality: [
      { rule: "TAP_TARGET_TOO_SMALL", severity: "MEDIUM", stateKey: "exam_form", breakpoint: "mobile (390x844)", detail: "Close is 18x18px.", recommendation: "More padding." },
      { rule: "REDUNDANT_STEP", severity: "LOW", stateKey: null, breakpoint: null, detail: "A page people click through.", recommendation: null },
    ],
  }));

  assert.equal(rows[0]!.title, "Control too small to tap");
  assert.equal(rows[0]!.where, "exam_form · mobile (390x844)");
  assert.equal(rows[0]!.recommendation, "More padding.");
  // A finding about what somebody declared rather than about a page they visited.
  assert.equal(rows[1]!.where, "the Flow itself");
});

test("an unknown rule is still readable, rather than shown as a constant", () => {
  const rows = uiQualityRows(withStates([], {
    uiQuality: [{ rule: "SOMETHING_NEW_WE_ADDED", severity: "LOW", stateKey: null, breakpoint: null, detail: "x", recommendation: null }],
  }));
  assert.equal(rows[0]!.title, "something new we added");
});

test("the responsive grid has a column per size and names what is wrong at each", () => {
  const grid = responsiveGrid(withStates([], {
    responsive: [{
      stateKey: "exam_form",
      samples: [
        { name: "mobile", width: 390, height: 844, horizontalOverflowPx: 180, smallestTextPx: 11, smallestTapTargetPx: 18, controlsChecked: 4 },
        { name: "laptop", width: 1280, height: 800, horizontalOverflowPx: 0, smallestTextPx: 14, smallestTapTargetPx: 24, controlsChecked: 4 },
      ],
    }],
  }))!;

  assert.deepEqual(grid.sizes, ["mobile", "laptop"]);
  assert.match(grid.rows[0]!.cells[0]!, /180px too wide/);
  assert.match(grid.rows[0]!.cells[0]!, /11px text/);
  assert.match(grid.rows[0]!.cells[0]!, /18px control/);
  // A 24px control is fine with a mouse, so it is not a finding at laptop width.
  assert.equal(grid.rows[0]!.cells[1], "clear", "a size that was checked and fine says so");
});

test("a size a state was never measured at is a gap, not a pass", () => {
  const grid = responsiveGrid(withStates([], {
    responsive: [
      { stateKey: "a", samples: [{ name: "mobile", width: 390, height: 844, horizontalOverflowPx: 0, smallestTextPx: 16, smallestTapTargetPx: 48, controlsChecked: 1 }] },
      { stateKey: "b", samples: [{ name: "laptop", width: 1280, height: 800, horizontalOverflowPx: 0, smallestTextPx: 16, smallestTapTargetPx: 48, controlsChecked: 1 }] },
    ],
  }))!;
  assert.deepEqual(grid.sizes, ["mobile", "laptop"]);
  assert.equal(grid.rows[0]!.cells[1], "—");
  assert.equal(grid.rows[1]!.cells[0], "—");
});

test("actions the run could not perform are readable, having been computed and shown nowhere", () => {
  const rows = blockedActionRows(withStates([], {
    blockedActions: [{ reason: "CONTROL_NOT_FOUND", transitionId: "t-create", detail: "No control for Create Exam is on the page.", at: "2026-01-01T00:00:00.000Z" }],
  }));
  assert.equal(rows[0]!.reason, "control not found");
  assert.equal(rows[0]!.step, "t-create");
  assert.match(rows[0]!.detail, /Create Exam/);
});
