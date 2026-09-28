import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAutomation } from "@tellann/automation-engine";
import type { AutomationConfig, CodeGraphView, ExecutableContract } from "@tellann/automation-engine";
import { createDiagnosticsPorts, workspaceCodeEvidenceSource } from "./diagnostics-ports";
import type { DiagnosticsObserver } from "./diagnostics-ports";

/** A stand-in for the browser observer that records what it was asked to keep. */
function fakeObserver(overrides: Partial<{ keepTraces: boolean; timing: Array<{ component: string; mounts: number; updates: number; totalMs: number; maxMs: number }> }> = {}) {
  const calls: string[] = [];
  const events: Array<{ type: string; metadata: Record<string, unknown> }> = [];
  const observer: DiagnosticsObserver = {
    async captureAnomalyArtifacts() { calls.push("capture"); return true; },
    async beginAutomationTraceChunk(label) { calls.push(`begin:${label}`); return true; },
    async endAutomationTraceChunk(options) { calls.push(`end:${options.retain ? "keep" : "drop"}`); return options.retain && overrides.keepTraces !== false; },
    recordAutomationEvent(type, metadata) { events.push({ type, metadata }); return "id"; },
    ...(overrides.timing ? { async takeRenderTiming() { const out = [...overrides.timing!]; overrides.timing!.length = 0; calls.push("timing"); return out; } } : {}),
  };
  return { observer, calls, events };
}

const contract = (): ExecutableContract => ({
  flowVersionId: "v1", flowHash: "h", analysisIdentity: null, initialStateKey: "a",
  states: [
    { key: "a", name: "A", role: "INITIAL", terminalKind: null, routePatterns: ["/a"], requiredElements: [], optionalElements: [], sdkStateSignals: ["a"], expectedApi: [], codeRefs: [], derivation: "RESOLVED" },
    { key: "b", name: "B", role: "TERMINAL", terminalKind: "SUCCESS", routePatterns: ["/b"], requiredElements: [], optionalElements: [], sdkStateSignals: ["b"], expectedApi: [], codeRefs: [], derivation: "RESOLVED" },
  ],
  transitions: [{
    id: "t-go", from: "a", to: "b", action: "Go",
    control: { labels: ["Go"], testId: null, domId: null, element: "button", event: "onClick", actionAnchor: null, href: null },
    inputs: [], actionClass: "CLIENT_STATE_MUTATION", expectedApi: [],
    codeRefs: [{ file: "src/go.tsx", symbol: "go", entityId: "handler" }], derivation: "RESOLVED",
  }],
});

const graph: CodeGraphView = {
  entities: [{ id: "handler", type: "function", name: "go", path: "src/go.tsx", startLine: 1, endLine: 2, metadata: {} }],
  relationships: [],
};

/** A two-page application where the button either works or does nothing. */
function app(works: boolean) {
  let page: "a" | "b" = "a";
  const events: Array<{ type: string }> = [];
  const view = () => ({
    url: `http://localhost:3000/${page}`, path: `/${page}`, title: null, headings: [],
    elements: page === "a" ? [{ ref: "go", tag: "button", role: "button", name: "Go", label: null, testId: null, domId: null, href: null, actionAnchor: null, fieldName: null, inputType: null, visible: true, enabled: true }] : [],
    sdkStates: [page], requests: [], errorCount: 0,
  });
  let clock = 0;
  return {
    events,
    ports: {
      snapshot: async () => view(),
      act: async () => { if (works) page = "b"; return { ok: true as const }; },
      settle: async () => { clock += 10; return view(); },
      emit: (event: { type: string }) => { events.push(event); },
      now: () => clock,
    },
  };
}

const config = (c: ExecutableContract): AutomationConfig => ({
  contract: c, targetStateKey: "b", environment: "STAGING", applicationOrigin: "http://localhost:3000",
  limits: { maxSteps: 20, maxDurationMs: 60_000, maxReplans: 4, maxActionRetries: 1 },
});

test("a run that goes to plan keeps no trace, takes no screenshot and explains nothing", async () => {
  const { observer, calls, events } = fakeObserver();
  const a = app(true);
  const result = await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), code: { graph } }) }, config(contract()));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED");
  assert.ok(!calls.includes("capture"));
  assert.ok(!calls.includes("end:keep"));
  assert.ok(calls.some((call) => call === "end:drop"), "chunks were recorded and thrown away");
  assert.deepEqual(events, []);
});

test("a failed step keeps its trace, a capture, and an explanation from the code, in that state's terms", async () => {
  const { observer, calls, events } = fakeObserver();
  const a = app(false);
  const result = await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), code: { graph } }) }, config(contract()));
  assert.equal(result.stopReason, "TRANSITION_DID_NOT_ADVANCE");
  assert.ok(calls.includes("capture"));
  assert.ok(calls.includes("end:keep"));

  const evidence = events.find((event) => event.type === "QA_AUTOMATION_CODE_EVIDENCE");
  assert.ok(evidence, "the failing transition is explained");
  assert.deepEqual((evidence!.metadata.subject as { kind: string; id: string }), { kind: "TRANSITION", id: "t-go" });
  assert.equal(evidence!.metadata.stateKey, "a");
  assert.match(String(evidence!.metadata.summary), /"Go" is mapped to go \(src\/go\.tsx:1-2\)/);

  const retained = events.find((event) => event.type === "QA_AUTOMATION_TRACE_RETAINED");
  assert.ok(retained);
  assert.equal(retained!.metadata.stateKey, "a");
  assert.ok((retained!.metadata.reasons as string[]).includes("ACTION_DID_NOT_ADVANCE"));
});

test("a trace the observer did not keep is not reported as kept", async () => {
  const { observer, events } = fakeObserver({ keepTraces: false });
  const a = app(false);
  await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), code: { graph } }) }, config(contract()));
  assert.ok(!events.some((event) => event.type === "QA_AUTOMATION_TRACE_RETAINED"));
});

test("without a code source a failure is still captured, just not explained from code", async () => {
  const { observer, calls, events } = fakeObserver();
  const a = app(false);
  await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), code: null }) }, config(contract()));
  assert.ok(calls.includes("capture"));
  assert.ok(!events.some((event) => event.type === "QA_AUTOMATION_CODE_EVIDENCE"));
});

test("the source itself is never in what is recorded", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-diag-"));
  fs.mkdirSync(path.join(workspace, "src"));
  fs.writeFileSync(path.join(workspace, "src", "go.tsx"), "export function go() {\n  return apiKey('sk-live-should-not-travel');\n}\n");
  const { observer, events } = fakeObserver();
  const a = app(false);
  await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), code: workspaceCodeEvidenceSource(workspace, graph) }) }, config(contract()));
  const evidence = events.find((event) => event.type === "QA_AUTOMATION_CODE_EVIDENCE")!;
  assert.match(JSON.stringify(evidence.metadata), /excerptSha256":"[0-9a-f]{64}"/, "the range is identified by its hash");
  assert.ok(!JSON.stringify(events).includes("sk-live-should-not-travel"));
});

test("the workspace source reader stays inside the workspace and refuses oversized files", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-diag-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-outside-"));
  fs.writeFileSync(path.join(outside, "secret.txt"), "outside");
  fs.writeFileSync(path.join(workspace, "big.js"), "x".repeat(1_100_000));
  fs.writeFileSync(path.join(workspace, "ok.ts"), "fine");
  const source = workspaceCodeEvidenceSource(workspace, graph);
  assert.equal(source.readSource!("ok.ts"), "fine");
  assert.equal(source.readSource!("big.js"), null);
  assert.equal(source.readSource!(path.relative(workspace, path.join(outside, "secret.txt"))), null);
  assert.equal(source.readSource!("missing.ts"), null);
});

test("render timing is read as visits close, labelled with the states each component belongs to", async () => {
  const timing = [{ component: "ExamForm", mounts: 1, updates: 2, totalMs: 12.5, maxMs: 6 }];
  const { observer, events } = fakeObserver({ timing });
  const a = app(true);
  await runAutomation({ ...a.ports, ...createDiagnosticsPorts({ observer, contract: contract(), renderTiming: { ExamForm: ["a"] } }) }, config(contract()));
  const recorded = events.filter((event) => event.type === "QA_AUTOMATION_RENDER_TIMING");
  assert.equal(recorded.length, 1, "nothing is recorded when there is nothing to report");
  assert.deepEqual(recorded[0]!.metadata.samples, [{ component: "ExamForm", mounts: 1, updates: 2, totalMs: 12.5, maxMs: 6, states: ["a"] }]);
});

test("a run that did not opt in never reads render timing", async () => {
  const { observer, calls, events } = fakeObserver({ timing: [{ component: "X", mounts: 1, updates: 0, totalMs: 1, maxMs: 1 }] });
  await runAutomation({ ...app(true).ports, ...createDiagnosticsPorts({ observer, contract: contract() }) }, config(contract()));
  assert.ok(!calls.includes("timing"));
  assert.ok(!events.some((event) => event.type === "QA_AUTOMATION_RENDER_TIMING"));
});
