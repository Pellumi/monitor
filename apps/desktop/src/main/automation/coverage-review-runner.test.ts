import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutableContract, NavigationGraph, SemanticElement, SemanticSnapshot } from "@tellann/automation-engine";
import type { RunDataSet, TestPersona } from "@tellann/desktop-contracts";
import { executeCoverageReview } from "./coverage-review-runner";
import type { ManagedBrowser } from "./run-executor";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-01-01T00:00:00.000Z";
const PASSWORD = "TeacherPass1!";
const EMAIL = "teacher@lms.test";

const el = (ref: string, over: Partial<SemanticElement>): SemanticElement => ({
  ref, tag: "button", role: "button", name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null,
  fieldName: null, inputType: null, visible: true, enabled: true, ...over,
});
const field = (ref: string, name: string, label: string, over: Partial<SemanticElement> = {}) =>
  el(ref, { tag: "input", role: "textbox", name: label, label, fieldName: name, inputType: name === "password" ? "password" : "text", ...over });
const button = (ref: string, name: string, over: Partial<SemanticElement> = {}) => el(ref, { name, ...over });

const control = (labels: string[], over: Record<string, unknown> = {}) => ({ labels, testId: null, domId: null, element: "button", event: null, actionAnchor: null, href: null, ...over });
const state = (key: string, over: Record<string, unknown> = {}) => ({
  key, name: key, role: "NORMAL", terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [], sdkStateSignals: [key],
  expectedApi: [], codeRefs: [], derivation: "RESOLVED", ...over,
}) as ExecutableContract["states"][number];

/**
 * course_details (INITIAL) branches into two AUTO siblings — "Create Exam" (declares its one
 * field) and "Delete Course" (forgets the confirmation field a shared form requires) — so the
 * walk has a real declaration gap to catch at the one state it visits past the login.
 */
function contract(): ExecutableContract {
  return {
    flowVersionId: "v1", flowHash: "h", analysisIdentity: null, initialStateKey: "course_details",
    states: [
      state("course_details", { role: "INITIAL", routePatterns: ["/courses/{param}"] }),
      state("exam_created", { role: "TERMINAL", terminalKind: "SUCCESS", routePatterns: ["/courses/{param}/exams/{param}"] }),
      state("course_deleted", { role: "TERMINAL", terminalKind: "SUCCESS", routePatterns: ["/courses"] }),
    ],
    transitions: [
      {
        id: "t-create", from: "course_details", to: "exam_created", action: "Create Exam", control: control(["Create Exam"]),
        inputs: [{ name: "title", label: "Title", dataKey: "examTitle" }], actionClass: "SERVER_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED",
      },
      {
        id: "t-delete", from: "course_details", to: "course_deleted", action: "Delete Course", control: control(["Delete Course"]),
        inputs: [], actionClass: "DESTRUCTIVE", expectedApi: [], codeRefs: [], derivation: "RESOLVED",
      },
    ],
  };
}

const navigation = (): NavigationGraph => ({
  nodes: ["/login", "/courses/{param}"],
  edges: [{
    id: "nav-login", from: "/login", to: "/courses/{param}", kind: "FORM_SUBMIT", actionClass: "CLIENT_STATE_MUTATION", confidence: 1,
    control: control(["Sign in"]), guard: null, login: [{ name: "email", label: "Email", dataKey: "email" }, { name: "password", label: "Password", dataKey: "password" }],
    evidence: { file: "a", symbol: null, line: null },
  }],
});

const persona = (over: Partial<TestPersona> = {}): TestPersona => ({
  id: "p1", applicationId: APP_ID, name: "Teacher", roles: ["TEACHER"], authenticated: true, authMethod: "PASSWORD",
  credentials: [{ field: "email", value: EMAIL }, { field: "password", value: PASSWORD }],
  createdAt: NOW, updatedAt: NOW, ...over,
});

const runData = (): RunDataSet => ({
  id: "d1", applicationId: APP_ID, name: "Data", createdAt: NOW, updatedAt: NOW,
  values: [{ key: "examTitle", generator: { kind: "LITERAL", value: "Automated QA Exam" }, secret: false }],
});

function fakeBrowser(): ManagedBrowser {
  return {
    async captureAnomalyArtifacts() { return true; },
    async beginAutomationTraceChunk() { return true; },
    async endAutomationTraceChunk(o) { return o.retain; },
    recordAutomationEvent() { return "id"; },
    protectAutomationValues() {},
  };
}

type PageName = "login" | "course";

function fakeDriver(options: { acceptLogin?: boolean } = {}) {
  let page: PageName = "login";
  const typed: Record<string, string> = {};
  const clicks: string[] = [];
  const views: Record<PageName, { path: string; sdk?: string; elements: SemanticElement[] }> = {
    login: { path: "/login", elements: [field("e-email", "email", "Email"), field("e-pass", "password", "Password"), button("e-signin", "Sign in")] },
    course: {
      path: "/courses/7", sdk: "course_details",
      elements: [
        // Two separate forms on the page: creating an exam, and deleting the course.
        field("e-title", "title", "Title", { formIndex: 0 }),
        button("e-create", "Create Exam", { formIndex: 0 }),
        field("e-confirm", "confirm", "Type DELETE to confirm", { required: true, formIndex: 1 }),
        button("e-delete", "Delete Course", { formIndex: 1 }),
      ],
    },
  };
  const view = (): SemanticSnapshot => ({
    url: `http://localhost:3000${views[page].path}`, path: views[page].path, title: null, headings: [],
    elements: views[page].elements, sdkStates: views[page].sdk ? [views[page].sdk!] : [], requests: [], errorCount: 0,
  });
  return {
    clicks,
    driver: {
      snapshot: async () => view(),
      settle: async () => view(),
      health: (): "OK" | "BROWSER_CRASHED" => "OK",
      act: async (action: { kind: string; ref?: string; value?: string }) => {
        if (action.kind === "FILL") typed[action.ref!] = action.value!;
        if (action.kind === "CLICK") {
          clicks.push(action.ref!);
          if (action.ref === "e-signin") {
            if (options.acceptLogin !== false && typed["e-email"] === EMAIL && typed["e-pass"] === PASSWORD) page = "course";
          }
        }
        return { ok: true };
      },
    },
  };
}

test("reaches the Flow's initial state through the login walk, then checks every branch at it", async () => {
  const browser = fakeBrowser();
  const { driver, clicks } = fakeDriver();
  const outcome = await executeCoverageReview({
    browser, driver, contract: contract(), navigation: navigation(), persona: persona(), runData: runData(),
    environment: "STAGING", applicationOrigin: "http://localhost:3000",
    limits: { maxSteps: 50, maxDurationMs: 60_000, maxReplans: 10, maxActionRetries: 2 },
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.ok(outcome.result.visitedStateKeys.includes("course_details"));
  assert.ok(outcome.result.visitedTransitionIds.includes("t-create"));
  assert.ok(outcome.result.visitedTransitionIds.includes("t-delete"));
  const missing = outcome.result.findings.find((finding) => finding.transitionId === "t-delete");
  assert.ok(missing, "the undeclared confirmation field is reported");
  assert.equal(missing!.reason, "REQUIRED_FIELD_NOT_DECLARED");
  // "Create Exam" resolved cleanly and carried the walk on; "Delete Course" is DESTRUCTIVE and
  // was never going to be the one performed even had it resolved, consistent with the engine's
  // own policy check.
  assert.ok(clicks.includes("e-create"));
  assert.ok(!clicks.includes("e-delete"));
});

test("a login the persona's credentials cannot get past is reported as an unreachable initial state", async () => {
  const browser = fakeBrowser();
  const { driver } = fakeDriver({ acceptLogin: false });
  const outcome = await executeCoverageReview({
    browser, driver, contract: contract(), navigation: navigation(), persona: persona(), runData: runData(),
    environment: "STAGING", applicationOrigin: "http://localhost:3000",
    limits: { maxSteps: 50, maxDurationMs: 60_000, maxReplans: 10, maxActionRetries: 2 },
  });
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stopReason, "INITIAL_STATE_UNREACHABLE");
});
