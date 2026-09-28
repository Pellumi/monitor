import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutableContract, NavigationGraph, SemanticElement, SemanticSnapshot } from "@tellann/automation-engine";
import type { RunDataSet, TestPersona } from "@tellann/desktop-contracts";
import { executeAutomatedRun } from "./run-executor";
import type { ManagedBrowser } from "./run-executor";
import type { AutomationExecutionPhase } from "@tellann/desktop-contracts";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-01-01T00:00:00.000Z";
const PASSWORD = "TeacherPass1!";
const EMAIL = "teacher@lms.test";

const el = (ref: string, over: Partial<SemanticElement>): SemanticElement => ({
  ref, tag: "button", role: "button", name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null,
  fieldName: null, inputType: null, visible: true, enabled: true, ...over,
});
const field = (ref: string, name: string, label: string) => el(ref, { tag: "input", role: "textbox", name: label, label, fieldName: name, inputType: name === "password" ? "password" : "text" });
const button = (ref: string, name: string, over: Partial<SemanticElement> = {}) => el(ref, { name, ...over });

const control = (labels: string[], over: Record<string, unknown> = {}) => ({ labels, testId: null, domId: null, element: "button", event: null, actionAnchor: null, href: null, ...over });
const state = (key: string, over: Record<string, unknown> = {}) => ({
  key, name: key, role: "NORMAL", terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [], sdkStateSignals: [key],
  expectedApi: [], codeRefs: [], derivation: "RESOLVED", ...over,
}) as ExecutableContract["states"][number];

const contract = (): ExecutableContract => ({
  flowVersionId: "v1", flowHash: "h", analysisIdentity: null, initialStateKey: "course_details",
  states: [
    state("course_details", { role: "INITIAL", routePatterns: ["/courses/{param}"] }),
    state("exam_form", { routePatterns: ["/courses/{param}/exams/new"] }),
    state("exam_created", { role: "TERMINAL", terminalKind: "SUCCESS", routePatterns: ["/courses/{param}/exams/{param}"] }),
  ],
  transitions: [
    { id: "t-create", from: "course_details", to: "exam_form", action: "Create Exam", control: control(["Create Exam"]), inputs: [], actionClass: "CLIENT_STATE_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED" },
    {
      id: "t-submit", from: "exam_form", to: "exam_created", action: "Save exam", control: control(["Save exam"], { testId: "submit-exam" }),
      inputs: [{ name: "title", label: "Title", dataKey: "examTitle" }], actionClass: "SERVER_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED",
    },
  ],
});

const navigation = (): NavigationGraph => ({
  nodes: ["/login", "/courses/{param}"],
  edges: [
    {
      id: "nav-login", from: "/login", to: "/courses/{param}", kind: "FORM_SUBMIT", actionClass: "CLIENT_STATE_MUTATION", confidence: 1,
      control: control(["Sign in"]), guard: null, login: [{ name: "email", label: "Email", dataKey: "email" }, { name: "password", label: "Password", dataKey: "password" }],
      evidence: { file: "a", symbol: null, line: null },
    },
  ],
});

const persona = (over: Partial<TestPersona> = {}): TestPersona => ({
  id: "p1", applicationId: APP_ID, name: "Teacher", roles: ["TEACHER"], authenticated: true, authMethod: "PASSWORD",
  credentials: [{ field: "email", value: EMAIL }, { field: "password", value: PASSWORD }],
  createdAt: NOW, updatedAt: NOW, ...over,
});

const runData = (over: Partial<RunDataSet> = {}): RunDataSet => ({
  id: "d1", applicationId: APP_ID, name: "Data", createdAt: NOW, updatedAt: NOW,
  values: [{ key: "examTitle", generator: { kind: "LITERAL", value: "Automated QA Exam" }, secret: false }], ...over,
});

type PageName = "login" | "dashboard" | "course" | "form" | "created" | "captcha";
interface Behaviour { acceptLogin?: boolean; failSave?: boolean; startAt?: PageName; afterLogin?: PageName }

function fakeBrowser() {
  const log: string[] = [];
  const events: Array<{ type: string; metadata: Record<string, unknown> }> = [];
  const browser: ManagedBrowser = {
    async captureAnomalyArtifacts() { log.push("capture"); return true; },
    async beginAutomationTraceChunk(label) { log.push(`begin:${label}`); return true; },
    async endAutomationTraceChunk(o) { log.push(`end:${o.retain ? "keep" : "drop"}`); return o.retain; },
    recordAutomationEvent(type, metadata) { events.push({ type, metadata }); return "id"; },
    protectAutomationValues(values) { log.push(`protect:${values.length}`); },
  };
  return { browser, log, events };
}

function fakeDriver(behaviour: Behaviour, log: string[]) {
  let page: PageName = behaviour.startAt ?? "login";
  const typed: Record<string, string> = {};
  const views: Record<PageName, { path: string; sdk?: string; elements: SemanticElement[] }> = {
    dashboard: { path: "/dashboard", elements: [el("e-nav", { tag: "a", role: "link", name: "Courses", href: "/courses/7" })] },
    login: { path: "/login", elements: [field("e-email", "email", "Email"), field("e-pass", "password", "Password"), button("e-signin", "Sign in")] },
    course: { path: "/courses/7", sdk: "course_details", elements: [button("e-create", "Create Exam")] },
    form: { path: "/courses/7/exams/new", sdk: "exam_form", elements: [field("e-title", "title", "Title"), button("e-save", "Save exam", { testId: "submit-exam" })] },
    created: { path: "/courses/7/exams/42", sdk: "exam_created", elements: [] },
    captcha: { path: "/login", elements: [button("e-human", "I'm not a robot")] },
  };
  const view = (): SemanticSnapshot => ({
    url: `http://localhost:3000${views[page]!.path}`, path: views[page]!.path, title: null, headings: [],
    elements: views[page]!.elements, sdkStates: views[page]!.sdk ? [views[page]!.sdk!] : [], requests: [], errorCount: 0,
  });
  return {
    typed,
    /** What a person does in the browser while the run waits. */
    go: (next: PageName) => { page = next; },
    driver: {
      snapshot: async () => view(),
      settle: async () => view(),
      health: (): "OK" | "BROWSER_CRASHED" => "OK",
      act: async (action: { kind: string; ref?: string; value?: string }) => {
        if (action.kind === "FILL") { typed[action.ref!] = action.value!; log.push(`fill:${action.ref}`); }
        if (action.kind === "CLICK") {
          log.push(`click:${action.ref}`);
          if (action.ref === "e-signin" && behaviour.acceptLogin !== false && typed["e-email"] === EMAIL && typed["e-pass"] === PASSWORD) page = behaviour.afterLogin ?? "course";
          if (action.ref === "e-create") page = "form";
          if (action.ref === "e-save" && !behaviour.failSave) page = "created";
        }
        return { ok: true as const };
      },
    },
  };
}

const base = (browser: ManagedBrowser, driver: ReturnType<typeof fakeDriver>["driver"], over: Record<string, unknown> = {}) => ({
  browser, driver, contract: contract(), navigation: navigation(), persona: persona(), runData: runData(),
  targetStateKey: "exam_created", environment: "STAGING" as const, applicationOrigin: "http://localhost:3000",
  limits: { maxSteps: 30, maxDurationMs: 60_000, maxReplans: 5, maxActionRetries: 1 }, ...over,
});

test("a run logs in, walks the Flow, and reaches the target", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  const result = await executeAutomatedRun(base(browser, driver));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED", result.detail ?? "");
  assert.deepEqual(result.states.map((s) => s.stateKey), ["course_details", "exam_form", "exam_created"]);
  assert.ok(events.some((event) => event.type === "QA_AUTOMATION_TERMINAL_STATE_REACHED"));
  assert.equal(events[events.length - 1]!.type, "QA_AUTOMATION_STOPPED");
  assert.ok(!log.includes("capture") && !log.includes("end:keep"), "a run that went to plan keeps nothing");
});

test("every value the run will type is registered as protected before anything is typed", async () => {
  const data = runData({ values: [
    { key: "examTitle", generator: { kind: "LITERAL", value: "Automated QA Exam" }, secret: false },
    { key: "token", generator: { kind: "LITERAL", value: "api-token-value" }, secret: true },
  ] });
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  await executeAutomatedRun(base(browser, driver, { runData: data }));
  const protectAt = log.findIndex((entry) => entry.startsWith("protect:"));
  const firstFill = log.findIndex((entry) => entry.startsWith("fill:"));
  assert.ok(protectAt >= 0 && protectAt < firstFill, "protected first");
  assert.equal(log[protectAt], "protect:3", "two credentials and the one secret run-data value, not the ordinary one");
});

test("what the run typed never appears in the evidence it recorded", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  await executeAutomatedRun(base(browser, driver));
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes(PASSWORD));
  assert.ok(!serialized.includes(EMAIL));
});

test("missing run data ends the run before it touches the application", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  const result = await executeAutomatedRun(base(browser, driver, { runData: null }));
  assert.equal(result.stopReason, "TEST_DATA_UNAVAILABLE");
  assert.match(result.detail ?? "", /examTitle/);
  assert.deepEqual(log, [], "no browser action, no protection, nothing");
  assert.deepEqual(events.map((event) => event.type), ["QA_AUTOMATION_STOPPED"]);
  assert.equal(events[0]!.metadata.stopReason, "TEST_DATA_UNAVAILABLE");
});

test("credentials the application rejects end the run as an authentication failure, before the Flow", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ acceptLogin: false }, log);
  const result = await executeAutomatedRun(base(browser, driver));
  assert.equal(result.stopReason, "AUTHENTICATION_FAILED");
  assert.ok(!events.some((event) => event.type === "QA_AUTOMATION_PLAN_CREATED"), "the engine never started");
  assert.equal(events[events.length - 1]!.metadata.stopReason, "AUTHENTICATION_FAILED");
});

test("a guest persona is never sent through a login form", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  const result = await executeAutomatedRun(base(browser, driver, { persona: persona({ authenticated: false, credentials: [] }) }));
  assert.equal(result.stopReason, "INITIAL_STATE_UNREACHABLE");
  assert.ok(!log.some((entry) => entry.startsWith("fill:")), "nothing was typed into the login form");
});

test("a route the persona's role may not use is reported as authorization, not as a broken application", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ afterLogin: "dashboard" }, log);
  const guarded: NavigationGraph = {
    nodes: ["/login", "/dashboard", "/courses/{param}"],
    edges: [
      { ...navigation().edges[0]!, to: "/dashboard" },
      {
        id: "nav-course", from: "/dashboard", to: "/courses/{param}", kind: "LINK", actionClass: "READ", confidence: 1,
        control: control(["Courses"], { element: "a", href: "/courses/7" }), guard: { requiresAuth: true, roles: ["ADMIN"], confidence: 1 },
        evidence: { file: "a", symbol: null, line: null },
      },
    ],
  };
  const result = await executeAutomatedRun(base(browser, driver, { navigation: guarded }));
  assert.equal(result.stopReason, "AUTHORIZATION_BLOCKED");
  assert.match(result.detail ?? "", /TEACHER/);
  assert.ok(!log.includes("click:e-nav"), "the run does not probe a route it was told it may not use");
  assert.equal(events[events.length - 1]!.metadata.stopReason, "AUTHORIZATION_BLOCKED");
});

test("the same route is reachable when the persona has the role the guard asks for", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ afterLogin: "dashboard" }, log);
  const guarded: NavigationGraph = {
    nodes: ["/login", "/dashboard", "/courses/{param}"],
    edges: [
      { ...navigation().edges[0]!, to: "/dashboard" },
      {
        id: "nav-course", from: "/dashboard", to: "/courses/{param}", kind: "LINK", actionClass: "READ", confidence: 1,
        control: control(["Courses"], { element: "a", href: "/courses/7" }), guard: { requiresAuth: true, roles: ["TEACHER"], confidence: 1 },
        evidence: { file: "a", symbol: null, line: null },
      },
    ],
  };
  // The fake dashboard link goes nowhere, so this only proves planning let the run try.
  const result = await executeAutomatedRun(base(browser, driver, { navigation: guarded }));
  assert.notEqual(result.stopReason, "AUTHORIZATION_BLOCKED");
  assert.ok(log.includes("click:e-nav"));
});

test("a run that starts at the initial state needs no navigation graph", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "course" }, log);
  const result = await executeAutomatedRun(base(browser, driver, { navigation: null, persona: null }));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED");
  assert.ok(!log.some((entry) => entry.startsWith("fill:e-email")));
});

test("a failed step keeps diagnostics: the capture, the trace and the explanation", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ failSave: true }, log);
  const result = await executeAutomatedRun(base(browser, driver));
  assert.equal(result.stopReason, "TRANSITION_DID_NOT_ADVANCE");
  assert.ok(log.includes("capture"));
  assert.ok(log.includes("end:keep"));
  assert.ok(events.some((event) => event.type === "QA_AUTOMATION_TRACE_RETAINED"));
  assert.equal(log.filter((entry) => entry === "click:e-save").length, 1, "a mutation that did not visibly succeed is not retried");
});

test("cancellation stops the run at the next decision", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "course" }, log);
  const result = await executeAutomatedRun(base(browser, driver, { navigation: null, persona: null, cancelled: () => true }));
  assert.equal(result.stopReason, "CANCELLED_BY_USER");
  assert.ok(!log.some((entry) => entry.startsWith("click:")));
});

test("a browser that dies during the entry walk ends the run as a crash, not as an exception", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  let closed = false;
  const dying = {
    ...driver,
    snapshot: async () => { if (closed) throw new Error("page.evaluate: Target page, context or browser has been closed"); return driver.snapshot(); },
    act: async (action: Parameters<typeof driver.act>[0]) => { const done = await driver.act(action); if (action.kind === "FILL") closed = true; return done; },
    health: () => (closed ? ("BROWSER_CRASHED" as const) : ("OK" as const)),
  };
  const result = await executeAutomatedRun(base(browser, dying));
  assert.equal(result.stopReason, "BROWSER_CRASHED");
  assert.equal(events.filter((event) => event.type === "QA_AUTOMATION_STOPPED").length, 1);
  assert.equal(events[events.length - 1]!.metadata.stopReason, "BROWSER_CRASHED");
});

test("an unexpected failure while the browser is fine is Tellann's own error, and is recorded once", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "course" }, log);
  const broken = { ...driver, act: async () => { throw new Error(["selector engine exploded", "    at stack line"].join(String.fromCharCode(10))); } };
  const result = await executeAutomatedRun(base(browser, broken, { navigation: null, persona: null }));
  assert.equal(result.stopReason, "AUTOMATION_ENGINE_ERROR");
  assert.match(result.detail ?? "", /selector engine exploded/);
  assert.ok(!(result.detail ?? "").includes("stack line"), "only the first line, never a stack");
  assert.equal(events.filter((event) => event.type === "QA_AUTOMATION_STOPPED").length, 1);
});

test("a stop the engine already recorded is not recorded twice when something throws afterwards", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "course" }, log);
  const tail = { ...driver, health: () => { throw new Error("health probe failed"); } };
  const result = await executeAutomatedRun(base(browser, tail, { navigation: null, persona: null }));
  assert.ok(["BROWSER_CRASHED", "AUTOMATION_ENGINE_ERROR"].includes(result.stopReason));
  assert.equal(events.filter((event) => event.type === "QA_AUTOMATION_STOPPED").length, 1);
});

// -- handing over to a person ---------------------------------------------------

test("a persona that signs in by hand pauses the run, tells the person, and carries on once they have", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver, go } = fakeDriver({}, log);
  const phases: string[] = [];
  const asked: Array<{ kind: string; detail: string }> = [];
  const result = await executeAutomatedRun(base(browser, driver, {
    persona: persona({ authMethod: "MANUAL", credentials: [] }),
    onPhase: (phase: AutomationExecutionPhase) => phases.push(phase),
    manualAuthentication: { wait: async (challenge: { kind: string; detail: string }) => { asked.push(challenge); go("course"); return "DONE" as const; } },
  }));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED", result.detail ?? "");
  assert.deepEqual(asked.map((item) => item.kind), ["MANUAL_BY_CHOICE"]);
  assert.deepEqual(phases, ["SEEKING_INITIAL_STATE", "AWAITING_USER", "SEEKING_INITIAL_STATE", "EXECUTING_FLOW"]);
  const types = events.map((event) => event.type);
  assert.ok(types.indexOf("QA_AUTOMATION_MANUAL_ACTION_REQUIRED") < types.indexOf("QA_AUTOMATION_MANUAL_ACTION_COMPLETED"));
  assert.ok(types.indexOf("QA_AUTOMATION_MANUAL_ACTION_COMPLETED") < types.indexOf("QA_AUTOMATION_PLAN_CREATED"));
  assert.ok(!log.some((entry) => entry.startsWith("fill:e-email") || entry.startsWith("fill:e-pass")), "nothing was typed for the person");
});

test("a CAPTCHA is handed over and never touched, and the run resumes only after the person has cleared it", async () => {
  const { browser, log } = fakeBrowser();
  const { driver, go } = fakeDriver({ startAt: "captcha" }, log);
  const result = await executeAutomatedRun(base(browser, driver, {
    manualAuthentication: { wait: async () => { go("course"); return "DONE" as const; } },
  }));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED", result.detail ?? "");
  assert.ok(!log.includes("click:e-human"), "the CAPTCHA control was never clicked");
  assert.ok(!log.includes("fill:e-email") && !log.includes("fill:e-pass"), "and no credentials were typed for it");
});

test("with nobody to ask, a CAPTCHA stops the run as a hand-over, not as a failure of the application", async () => {
  const { browser, log, events } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "captcha" }, log);
  const result = await executeAutomatedRun(base(browser, driver));
  assert.equal(result.stopReason, "MANUAL_AUTHENTICATION_REQUIRED");
  assert.match(result.detail ?? "", /CAPTCHA/);
  assert.ok(!log.includes("click:e-human"));
  assert.equal(events[events.length - 1]!.metadata.stopReason, "MANUAL_AUTHENTICATION_REQUIRED");
});

test("a person who never comes back ends the run as a hand-over that timed out", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "captcha" }, log);
  const result = await executeAutomatedRun(base(browser, driver, { manualAuthentication: { wait: async () => "TIMED_OUT" as const } }));
  assert.equal(result.stopReason, "MANUAL_AUTHENTICATION_REQUIRED");
  assert.match(result.detail ?? "", /before the wait ended/);
});

test("cancelling while the run waits for a person is a cancellation", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "captcha" }, log);
  const result = await executeAutomatedRun(base(browser, driver, { manualAuthentication: { wait: async () => "CANCELLED" as const } }));
  assert.equal(result.stopReason, "CANCELLED_BY_USER");
  const viaFlag = await executeAutomatedRun(base(browser, fakeDriver({ startAt: "captcha" }, log).driver, { manualAuthentication: { wait: async () => "DONE" as const }, cancelled: () => true }));
  assert.equal(viaFlag.stopReason, "CANCELLED_BY_USER", "a wait that ended because of a cancel is not treated as a sign-in");
});

test("a sign-in that keeps asking is stopped after a few hand-overs rather than waited on forever", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "captcha" }, log);
  let waits = 0;
  const result = await executeAutomatedRun(base(browser, driver, { manualAuthentication: { wait: async () => { waits += 1; return "DONE" as const; } } }));
  assert.equal(result.stopReason, "MANUAL_AUTHENTICATION_REQUIRED");
  assert.equal(waits, 3);
});

test("a wait that throws ends the run instead of escaping", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "captcha" }, log);
  const result = await executeAutomatedRun(base(browser, driver, { manualAuthentication: { wait: async () => { throw new Error("window closed"); } } }));
  assert.equal(result.stopReason, "CANCELLED_BY_USER");
});

// -- phases and health -----------------------------------------------------------

test("the run reports where it is, and a listener that throws does not stop it", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({}, log);
  const phases: string[] = [];
  const result = await executeAutomatedRun(base(browser, driver, { onPhase: (phase: string) => { phases.push(phase); throw new Error("renderer gone"); } }));
  assert.equal(result.stopReason, "TERMINAL_STATE_REACHED");
  assert.deepEqual(phases, ["SEEKING_INITIAL_STATE", "EXECUTING_FLOW"]);
});

test("an application that dies mid-run is reported as the application crashing, not as a browser fault", async () => {
  const { browser, log } = fakeBrowser();
  const { driver } = fakeDriver({ startAt: "course" }, log);
  let crashed = false;
  const dying = { ...driver, act: async (action: Parameters<typeof driver.act>[0]) => { const done = await driver.act(action); crashed = true; return done; } };
  const result = await executeAutomatedRun(base(browser, dying, { navigation: null, persona: null, applicationHealth: () => (crashed ? ("APPLICATION_CRASHED" as const) : ("OK" as const)) }));
  assert.equal(result.stopReason, "APPLICATION_CRASHED");
});
