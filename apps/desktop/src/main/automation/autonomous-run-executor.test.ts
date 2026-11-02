import assert from "node:assert/strict";
import test from "node:test";
import type { AutonomousModelPort, AutonomousPlan, ExecutableContract, SemanticElement, SemanticSnapshot } from "@tellann/automation-engine";
import { executeAutonomousRun } from "./autonomous-run-executor";
import type { PageDriver } from "./run-executor";

const el = (ref: string, over: Partial<SemanticElement>): SemanticElement => ({
  ref, tag: "button", role: "button", name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null,
  fieldName: null, inputType: null, visible: true, enabled: true, ...over,
});

const control = (labels: string[]) => ({ labels, testId: null, domId: null, element: "button", event: null, actionAnchor: null, href: null });
const state = (key: string, over: Record<string, unknown> = {}): ExecutableContract["states"][number] => ({
  key, name: key, role: "NORMAL", terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [],
  sdkStateSignals: [key], expectedApi: [], codeRefs: [], derivation: "RESOLVED", ...over,
});

const contract: ExecutableContract = {
  flowVersionId: "v1", flowHash: "h", analysisIdentity: null, initialStateKey: "details",
  states: [state("details", { role: "INITIAL" }), state("created", { role: "TERMINAL", terminalKind: "SUCCESS" })],
  transitions: [{
    id: "t-create", from: "details", to: "created", action: "Create", control: control(["Create"]), inputs: [],
    actionClass: "CLIENT_STATE_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED",
  }],
};

const plan: AutonomousPlan = { goal: "Create a thing", scenarios: [{ key: "s1", title: "Create a thing", targetStateKeys: ["created"], successCriteria: [], exploratory: false }] };

function fakeDriver(): { driver: PageDriver; actions: unknown[] } {
  const actions: unknown[] = [];
  let page = "details";
  const views: Record<string, SemanticSnapshot> = {
    details: { url: "http://localhost/d", path: "/d", title: null, headings: [], elements: [el("create", { name: "Create" })], sdkStates: ["details"], requests: [], errorCount: 0 },
    created: { url: "http://localhost/c", path: "/c", title: null, headings: [], elements: [], sdkStates: ["created"], requests: [], errorCount: 0 },
  };
  const driver: PageDriver = {
    async snapshot() { return views[page]!; },
    async act(action) {
      actions.push(action);
      if (action.kind === "CLICK" && action.ref === "create") page = "created";
      return { ok: true };
    },
    async settle() { return views[page]!; },
  };
  return { driver, actions };
}

const refusingModel: AutonomousModelPort = {
  decide: async () => { throw new Error("should not be asked: the target is contract-declared"); },
  explainFailure: async () => { throw new Error("not expected"); },
};

test("executeAutonomousRun drives a contract-declared scenario to completion", async () => {
  const { driver, actions } = fakeDriver();
  const result = await executeAutonomousRun({
    driver, contract, plan, environment: "STAGING", applicationOrigin: "http://localhost",
    limits: { maxActions: 10, maxModelCalls: 5, maxDurationMs: 60_000 },
    scopeApproval: { approvedAt: "2026-01-01T00:00:00.000Z", approvedByUserId: "user-1", planVersion: 1 },
    model: refusingModel,
  });
  assert.equal(result.stopReason, "COMPLETED");
  assert.equal(result.scenarios[0]!.status, "PASS");
  assert.deepEqual(actions, [{ kind: "CLICK", ref: "create" }]);
});

test("without an approved scope, nothing is clicked and the scenario is blocked", async () => {
  const { driver, actions } = fakeDriver();
  const result = await executeAutonomousRun({
    driver, contract, plan, environment: "STAGING", applicationOrigin: "http://localhost",
    limits: { maxActions: 10, maxModelCalls: 5, maxDurationMs: 60_000 },
    scopeApproval: null,
    model: refusingModel,
  });
  assert.equal(result.scenarios[0]!.status, "BLOCKED");
  assert.deepEqual(actions, []);
});

test("every step is told to the caller's own emit, for the live view", async () => {
  const { driver } = fakeDriver();
  const events: string[] = [];
  await executeAutonomousRun({
    driver, contract, plan, environment: "STAGING", applicationOrigin: "http://localhost",
    limits: { maxActions: 10, maxModelCalls: 5, maxDurationMs: 60_000 },
    scopeApproval: { approvedAt: "2026-01-01T00:00:00.000Z", approvedByUserId: "user-1", planVersion: 1 },
    model: refusingModel,
    emit: (event) => { events.push(event.type); },
  });
  assert.ok(events.includes("AUTONOMOUS_SCENARIO_STARTED"));
  assert.ok(events.includes("AUTONOMOUS_SCENARIO_COMPLETED"));
});
