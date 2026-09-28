import assert from "node:assert/strict";
import test from "node:test";

import { anomalyText, codeEvidenceEntries, durationText, modeLabel, MODE_MEANINGS, outcomeSummary, pinnedRows, reconciliationRows, renderTimingRows, retainedTraceRows, unreachedLabel } from "./automated-report";
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
