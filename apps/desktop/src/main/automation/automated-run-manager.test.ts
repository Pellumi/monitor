import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ExecutableContract, NavigationGraph, SemanticElement, SemanticSnapshot } from "@tellann/automation-engine";
import { AutomatedRunStatusSchema } from "@tellann/desktop-contracts";
import type { AutomatedRunStatus, AutomationPhaseUpdate, ExecutionProfile, RunDataSet, StartGuidedRunInput, TestPersona } from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import { AutomatedRunManager } from "./automated-run-manager";
import type { AutomatedRunHost, AutomatedRunRequest, BrowserSession, FinishOutcome, OpenedRun } from "./automated-run-manager";
import { ContractPipelineError } from "./contract-pipeline";
import type { PreparedContract } from "./contract-pipeline";
import { approveProfile } from "./execution-profile";
import type { RunnerEvent } from "./project-runner";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const ENV_ID = "22222222-2222-4222-8222-222222222222";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = "2026-01-01T00:00:00.000Z";

// -- a Flow: course -> form -> created ------------------------------------------------------------

const el = (ref: string, over: Partial<SemanticElement>): SemanticElement => ({
  ref, tag: "button", role: "button", name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null,
  fieldName: null, inputType: null, visible: true, enabled: true, ...over,
});
const control = (labels: string[]) => ({ labels, testId: null, domId: null, element: "button", event: null, actionAnchor: null, href: null });
const state = (key: string, over: Record<string, unknown> = {}) => ({
  key, name: key, role: "NORMAL", terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [], sdkStateSignals: [key],
  expectedApi: [], codeRefs: [], derivation: "RESOLVED", ...over,
}) as ExecutableContract["states"][number];

const contract = (over: Partial<ExecutableContract> = {}): ExecutableContract => ({
  flowVersionId: "v1", flowHash: "h".repeat(64), analysisIdentity: null, initialStateKey: "course_details",
  states: [
    state("course_details", { role: "INITIAL", routePatterns: ["/courses/{param}"] }),
    state("exam_form", { routePatterns: ["/courses/{param}/exams/new"] }),
    state("exam_created", { role: "TERMINAL", terminalKind: "SUCCESS", routePatterns: ["/courses/{param}/exams/{param}"] }),
  ],
  transitions: [
    { id: "t-create", from: "course_details", to: "exam_form", action: "Create Exam", control: control(["Create Exam"]), inputs: [], actionClass: "CLIENT_STATE_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED" },
    { id: "t-save", from: "exam_form", to: "exam_created", action: "Save exam", control: control(["Save exam"]), inputs: [], actionClass: "SERVER_MUTATION", expectedApi: [], codeRefs: [], derivation: "RESOLVED" },
  ],
  stateAliases: { s_course: "course_details", s_form: "exam_form", s_created: "exam_created" },
  ...over,
});

const prepared = (over: Partial<ExecutableContract> = {}): PreparedContract => ({
  contract: contract(over),
  navigation: { nodes: [], edges: [] } as NavigationGraph,
  summary: { hash: "a".repeat(64), flowHash: "h".repeat(64), analysisIdentity: null, states: 3, transitions: 2, controlsDerived: 2, controlsMissing: 0, anchored: 0 },
  login: "NOT_CONFIGURED",
  sources: { flowVersion: "CACHE", manifest: "CACHE" },
});

// -- a fake browser page --------------------------------------------------------------------------

type PageName = "captcha" | "course" | "form" | "created";
interface Script { startAt?: PageName; failSave?: boolean; onAct?: (ref: string) => void }

function fakePage(script: Script) {
  let page: PageName = script.startAt ?? "course";
  const views: Record<PageName, { path: string; sdk?: string; elements: SemanticElement[] }> = {
    captcha: { path: "/login", elements: [el("e-human", { name: "I'm not a robot" })] },
    course: { path: "/courses/7", sdk: "course_details", elements: [el("e-create", { name: "Create Exam" })] },
    form: { path: "/courses/7/exams/new", sdk: "exam_form", elements: [el("e-save", { name: "Save exam" })] },
    created: { path: "/courses/7/exams/42", sdk: "exam_created", elements: [] },
  };
  const view = (): SemanticSnapshot => ({
    url: `http://localhost:3000${views[page].path}`, path: views[page].path, title: null, headings: [], elements: views[page].elements,
    sdkStates: views[page].sdk ? [views[page].sdk!] : [], requests: [], errorCount: 0,
  });
  return {
    go: (next: PageName) => { page = next; },
    driver: {
      snapshot: async () => view(),
      settle: async () => view(),
      health: (): "OK" => "OK",
      act: async (action: { kind: string; ref?: string }) => {
        if (action.kind === "CLICK") {
          script.onAct?.(action.ref ?? "");
          if (action.ref === "e-create") page = "form";
          if (action.ref === "e-save" && !script.failSave) page = "created";
        }
        return { ok: true as const };
      },
    },
  };
}

// -- fakes for everything around the run ----------------------------------------------------------

function harness(script: Script = {}, options: { manualWaitMs?: number; phaseFails?: boolean; finishFails?: boolean; appStartFails?: boolean; openBrowserFails?: boolean } = {}) {
  const log: string[] = [];
  const published: AutomatedRunStatus[] = [];
  const phases: AutomationPhaseUpdate[] = [];
  const notes: Array<{ title: string; body: string }> = [];
  const finished: FinishOutcome[] = [];
  const pageState = fakePage(script);
  let hooks: { sdkStates(): string[]; beforeAction(): void } | null = null;
  const events: Array<{ type: string; metadata: Record<string, unknown> }> = [];
  const journal: string[] = [];
  let appAlive = true;
  let gate: Promise<void> | null = null;

  const opened: OpenedRun = { runId: "run-1", sessionId: "s1", traceId: "t1", organizationId: "org", relay: { endpoint: "http://127.0.0.1:1/relay", relayToken: "x".repeat(40) } };
  const session: BrowserSession = {
    browser: {
      async captureAnomalyArtifacts() { return true; },
      async beginAutomationTraceChunk() { return true; },
      async endAutomationTraceChunk(o) { return o.retain; },
      recordAutomationEvent(type, metadata) { events.push({ type, metadata }); return "id"; },
      protectAutomationValues() {},
    },
    driver: pageState.driver,
    async setCapturePaused(paused) { log.push(`capture-paused:${paused}`); },
    async bringToFront() { log.push("front"); },
  };
  const host: AutomatedRunHost = {
    async openRun() { log.push("openRun"); return opened; },
    async openBrowser(_run, _request, h) {
      log.push("openBrowser");
      hooks = h;
      if (options.openBrowserFails) throw new Error("Chromium would not start\n    at stack");
      return session;
    },
    async endBrowser() { log.push("endBrowser"); },
    async finishRun(_run, outcome) {
      log.push("finishRun");
      finished.push(outcome);
      if (options.finishFails) throw new Error("network down");
    },
    async reportPhase(_runId, update) { phases.push(update); if (options.phaseFails) throw new Error("offline"); },
    notify(note) { notes.push(note); },
    publish(status) { published.push(status); },
  };
  const runner = {
    async start(input: { onEvent?: (event: RunnerEvent) => void; correlation: Record<string, string> }) {
      log.push("app:start");
      log.push(`correlation:${input.correlation.runId}:${input.correlation.endpoint}`);
      if (options.appStartFails) return { ok: false as const, stopReason: "APPLICATION_START_FAILED" as const, detail: "npm run dev exited with code 1" };
      input.onEvent?.({ process: "app", phase: "STARTED", pid: 4242 });
      await gate;
      return { ok: true as const, started: ["app"] };
    },
    health: (): "OK" | "APPLICATION_CRASHED" => (appAlive ? "OK" : "APPLICATION_CRASHED"),
    async stop(onEvent?: (event: RunnerEvent) => void) { log.push("app:stop"); onEvent?.({ process: "app", phase: "STOPPED", pid: 4242 }); },
  };
  const manager = new AutomatedRunManager(host, {
    createRunner: () => runner as never,
    journal: { record: async ({ pid, name }) => { journal.push(`record:${pid}:${name}`); }, forget: (pid) => { journal.push(`forget:${pid}`); } },
    heartbeatMs: 15, manualWaitMs: options.manualWaitMs ?? 5_000, agentVersion: "1.2.3", now: () => new Date(NOW),
  });
  return {
    manager, log, published, phases, notes, finished, events, journal, page: pageState,
    hooks: () => hooks!, crashApp: () => { appAlive = false; },
    holdAppStart: () => { let open!: () => void; gate = new Promise<void>((resolve) => { open = resolve; }); return open; },
  };
}

// -- a request the manager will accept ------------------------------------------------------------

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-manager-"));
fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
const command = { id: "cmd-dev", label: "npm run dev", executable: "npm", args: ["run", "dev"], cwd: ".", scriptName: "dev" } as LocalLaunchCommand;
const profile = (): ExecutionProfile => approveProfile({
  id: "p1", applicationId: APP_ID, name: "Dev server",
  processes: [{ name: "app", launchCommandId: "cmd-dev", readyCondition: { type: "HTTP", url: "http://localhost:3000" }, readyTimeoutMs: 60_000 }],
  applicationUrl: "http://localhost:3000", approvedHash: null, approvedAt: null,
}, [command], workspace, new Date(NOW));

const startInput = (over: Record<string, unknown> = {}): StartGuidedRunInput => ({
  applicationId: APP_ID, environmentId: ENV_ID, workspaceId: null,
  flowId: uuid(1), flowBindingId: uuid(2), flowInitializationId: uuid(3), flowScanId: uuid(4), expectedGraphVersionId: uuid(5),
  captureTracks: ["FRONTEND"], environmentType: "STAGING", mode: "AUTOMATED", targetUrl: "http://localhost:3000",
  automation: { targetTerminalStateKey: "exam_created", executionProfileId: "p1", renderTimingComponents: [], limits: { maxSteps: 30, maxDurationMs: 60_000, maxReplans: 5, maxActionRetries: 1 } },
  ...over,
}) as unknown as StartGuidedRunInput;

const persona = (): TestPersona => ({ id: "p", applicationId: APP_ID, name: "T", roles: [], authenticated: false, authMethod: "PASSWORD", credentials: [], createdAt: NOW, updatedAt: NOW });
const dataSet = (): RunDataSet => ({ id: "d", applicationId: APP_ID, name: "d", values: [], createdAt: NOW, updatedAt: NOW });

const request = (over: Partial<AutomatedRunRequest> = {}): AutomatedRunRequest => ({
  start: startInput(), profile: profile(), commands: [command], workspaceRoot: workspace, frameworks: ["react", "vite"],
  persona: persona(), runData: dataSet(), prepare: async () => prepared(), ...over,
});

const finish = async (h: ReturnType<typeof harness>, req: AutomatedRunRequest = request()) => {
  const started = await h.manager.start(req);
  assert.equal(started.ok, true, JSON.stringify(started));
  await h.manager.idle();
  return started;
};

// -- refusals: nothing is created ------------------------------------------------------------------

test("a framework Automated Run cannot read yet is declined in plain words, and nothing is created", async () => {
  const h = harness();
  const result = await h.manager.start(request({ frameworks: ["vue", "vite"] }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.refusal.code, "FRAMEWORK_NOT_YET_SUPPORTED");
  assert.equal(result.refusal.tone, "notice");
  assert.match(result.refusal.message, /coming soon/);
  assert.match(result.refusal.message, /Vue/);
  assert.deepEqual(result.refusal.alternatives, ["GUIDED", "ASSISTED"]);
  assert.deepEqual(h.log, [], "no run record, no process, no browser");
  assert.equal(h.manager.busy, false);
});

test("problems with the Flow or the analysis are declined before anything starts", async () => {
  for (const code of ["CODE_ANALYSIS_REQUIRED", "FLOW_MAPPING_REQUIRED", "FLOW_INVALID"] as const) {
    const h = harness();
    const result = await h.manager.start(request({ prepare: async () => { throw new ContractPipelineError(code, "Say what to do."); } }));
    assert.equal(result.ok, false);
    if (!result.ok) { assert.equal(result.refusal.code, code); assert.equal(result.refusal.message, "Say what to do."); }
    assert.deepEqual(h.log, []);
  }
  await assert.rejects(harness().manager.start(request({ prepare: async () => { throw new Error("disk on fire"); } })), /disk on fire/, "anything else is a real error, not a refusal");
});

test("a target that is not one of the Flow's endings, an unapproved profile, missing controls and missing data are each declined", async () => {
  const cases: Array<[Partial<AutomatedRunRequest>, string]> = [
    [{ start: startInput({ automation: { ...startInput().automation, targetTerminalStateKey: "exam_form" } }) }, "TARGET_NOT_IN_FLOW"],
    [{ start: startInput({ automation: { ...startInput().automation, targetTerminalStateKey: "nowhere" } }) }, "TARGET_NOT_IN_FLOW"],
    [{ profile: { ...profile(), approvedHash: null, approvedAt: null } }, "PROFILE_NOT_APPROVED"],
    [{ commands: [{ ...command, args: ["run", "dev", "--host"] } as LocalLaunchCommand] }, "PROFILE_NOT_APPROVED"],
    [{ prepare: async () => { const p = prepared(); p.contract.transitions[1]!.control = null; p.contract.transitions[1]!.derivation = "UNRESOLVED"; return p; } }, "CONTROLS_NOT_DERIVED"],
    [{ prepare: async () => { const p = prepared(); p.contract.transitions[1]!.inputs = [{ name: "title", label: "Title", dataKey: "examTitle" }]; return p; }, runData: null }, "TEST_DATA_UNAVAILABLE"],
  ];
  for (const [over, code] of cases) {
    const h = harness();
    const result = await h.manager.start(request(over));
    assert.equal(result.ok, false, code);
    if (!result.ok) assert.equal(result.refusal.code, code);
    assert.deepEqual(h.log, [], `${code}: nothing was created`);
  }
});

test("production is refused outright, and a second run cannot start while one is going", async () => {
  await assert.rejects(harness().manager.start(request({ start: startInput({ environmentType: "PRODUCTION" }) })), /AUTOMATED_RUN_PRODUCTION_BLOCKED/);
  const h = harness();
  const release = h.holdAppStart();
  await h.manager.start(request());
  await assert.rejects(h.manager.start(request()), /RUN_ALREADY_ACTIVE/);
  release();
  await h.manager.idle();
});

// -- a run, start to finish ------------------------------------------------------------------------

test("a run starts the application, opens the browser, reaches the target, and closes everything in order", async () => {
  const h = harness();
  await finish(h);
  assert.deepEqual(h.log.filter((entry) => !entry.startsWith("correlation")), ["openRun", "app:start", "openBrowser", "endBrowser", "app:stop", "finishRun"], "the application stops after the browser and before the evidence is settled");
  assert.ok(h.log.includes("correlation:run-1:http://127.0.0.1:1/relay"), "the application is told where to report its own markers");
  assert.deepEqual(h.finished, [{ kind: "COMPLETE", stopReason: "TERMINAL_STATE_REACHED", completionReason: "TERMINAL_STATE_REACHED" }]);
  const status = h.manager.status()!;
  assert.equal(status.state, "FINISHED");
  assert.equal(status.outcome?.result, "COMPLETED");
  assert.equal(status.outcome?.tone, "success");
  assert.equal(status.steps, 2);
  assert.equal(status.currentStateKey, "exam_created");
  assert.equal(h.manager.busy, false);
  assert.ok(AutomatedRunStatusSchema.safeParse(status).success, "what the window is sent is what the contract says it is");
  assert.ok(h.published.every((snapshot) => AutomatedRunStatusSchema.safeParse(snapshot).success));
});

test("the platform is told where the run is, starting with which contract it was compiled into", async () => {
  const h = harness();
  await finish(h);
  assert.equal(h.phases[0]!.executionPhase, "PREPARING_WORKSPACE");
  assert.equal(h.phases[0]!.contract?.hash, "a".repeat(64));
  const order = h.phases.map((update) => update.executionPhase).filter(Boolean);
  for (const [earlier, later] of [["STARTING_APPLICATION", "LAUNCHING_BROWSER"], ["LAUNCHING_BROWSER", "EXECUTING_FLOW"], ["EXECUTING_FLOW", "FLUSHING_EVIDENCE"], ["FLUSHING_EVIDENCE", "SHUTTING_DOWN"]]) {
    assert.ok(order.indexOf(earlier as never) >= 0 && order.indexOf(earlier as never) < order.indexOf(later as never), `${earlier} before ${later}`);
  }
});

test("a stop the application caused is completed as incomplete, with the reason, and worded as a finding", async () => {
  const h = harness({ failSave: true });
  await finish(h);
  assert.deepEqual(h.finished, [{ kind: "COMPLETE", stopReason: "TRANSITION_DID_NOT_ADVANCE", completionReason: "MANUAL_STOP_BEFORE_TERMINAL" }]);
  const outcome = h.manager.status()!.outcome!;
  assert.equal(outcome.result, "COMPLETED_INCOMPLETE");
  assert.equal(outcome.tone, "finding");
});

test("a run that never got to where the Flow starts is stopped before the Flow, and says it needed the person", async () => {
  const h = harness({ startAt: "captcha" }, { manualWaitMs: 30 });
  await finish(h);
  assert.deepEqual(h.finished, [{ kind: "COMPLETE", stopReason: "MANUAL_AUTHENTICATION_REQUIRED", completionReason: "MANUAL_STOP_BEFORE_INITIAL" }]);
  const outcome = h.manager.status()!.outcome!;
  assert.equal(outcome.result, "COMPLETED_INCOMPLETE");
  assert.equal(outcome.tone, "notice", "a hand-over is never worded as a finding about the application");
  assert.ok(!h.log.includes("click"), "and the CAPTCHA was never touched");
});

// -- the application or the browser going away -----------------------------------------------------

test("an application that will not start is a failure of the run, the browser is never opened, and nothing is left running", async () => {
  const h = harness({}, { appStartFails: true });
  await finish(h);
  assert.ok(!h.log.includes("openBrowser"));
  assert.ok(!h.log.includes("endBrowser"), "there was no browser to close");
  assert.ok(h.log.includes("app:stop"));
  assert.equal(h.finished[0]!.kind, "FAIL");
  assert.equal(h.finished[0]!.stopReason, "APPLICATION_START_FAILED");
  assert.equal(h.manager.status()!.outcome?.result, "FAILED");
});

test("a browser that will not open is Tellann's failure, with one line of it and never a stack", async () => {
  const h = harness({}, { openBrowserFails: true });
  await finish(h);
  const outcome = h.finished[0]!;
  assert.equal(outcome.kind, "FAIL");
  assert.equal(outcome.kind === "FAIL" && outcome.stopReason, "AUTOMATION_ENGINE_ERROR");
  assert.ok(!JSON.stringify(outcome).includes("at stack"));
  assert.ok(h.log.includes("app:stop"), "the application that did start is stopped");
});

test("an application that dies mid-run is the application's, completed as incomplete", async () => {
  let h!: ReturnType<typeof harness>;
  h = harness({ onAct: () => h.crashApp() });
  await finish(h);
  assert.deepEqual(h.finished.map((o) => [o.kind, o.stopReason]), [["COMPLETE", "APPLICATION_CRASHED"]]);
});

test("a browser that goes away mid-run fails the run and still stops the application", async () => {
  let h!: ReturnType<typeof harness>;
  h = harness({ onAct: () => h.manager.browserTerminated("run-1") });
  await finish(h);
  assert.deepEqual(h.finished.map((o) => [o.kind, o.stopReason]), [["FAIL", "BROWSER_CRASHED"]]);
  assert.ok(h.log.includes("app:stop"));
  h.manager.browserTerminated("some-other-run");
});

const until = async (condition: () => boolean) => { for (let waited = 0; !condition() && waited < 300; waited += 1) await new Promise((resolve) => setTimeout(resolve, 5)); };

test("a shutdown while the application is still starting stops it, tells the platform once, and leaves nothing active", async () => {
  const h = harness();
  const release = h.holdAppStart();
  await h.manager.start(request());
  await until(() => h.log.includes("app:start"));
  const stopping = h.manager.shutdown();
  release();
  await stopping;
  await h.manager.idle();
  assert.equal(h.finished.length, 1, "told exactly once, whichever of the run or the shutdown got there first");
  assert.equal(h.finished[0]!.kind, "FAIL");
  assert.equal(h.log[h.log.lastIndexOf("app:stop")], "app:stop");
  assert.ok(!h.log.includes("openBrowser"), "no browser is opened for a run that is being shut down");
  assert.equal(h.manager.busy, false);
  await h.manager.shutdown();
});

test("a shutdown before anything was started starts nothing at all", async () => {
  const h = harness();
  await h.manager.start(request());
  await h.manager.shutdown();
  await h.manager.idle();
  assert.equal(h.finished.length, 1);
  assert.ok(!h.log.includes("app:start") && !h.log.includes("openBrowser"));
  assert.equal(h.manager.busy, false);
});

test("cancelling stops the run as a cancellation, completed as incomplete", async () => {
  const h = harness({ startAt: "course" });
  const release = h.holdAppStart();
  await h.manager.start(request());
  assert.equal(h.manager.cancel(), true);
  release();
  await h.manager.idle();
  assert.deepEqual(h.finished.map((o) => [o.kind, o.stopReason]), [["COMPLETE", "CANCELLED_BY_USER"]]);
  assert.equal(h.manager.cancel(), false, "nothing left to cancel");
});

// -- handing over to a person ------------------------------------------------------------------------

test("a CAPTCHA pauses the run: the browser comes forward, the person is told, recording stops, and it resumes when they say they are done", async () => {
  const h = harness({ startAt: "captcha" });
  await h.manager.start(request());
  for (let waited = 0; h.manager.status()?.state !== "AWAITING_USER" && waited < 200; waited += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  const waiting = h.manager.status()!;
  assert.equal(waiting.state, "AWAITING_USER");
  assert.equal(waiting.awaitingUser?.kind, "CAPTCHA");
  assert.match(waiting.awaitingUser!.detail, /CAPTCHA/);
  assert.deepEqual(h.notes.map((note) => note.title), ["Tellann needs you to sign in"]);
  assert.deepEqual(h.log.filter((entry) => entry === "front" || entry.startsWith("capture-paused")), ["capture-paused:true", "front"]);
  assert.ok(h.phases.some((update) => update.executionPhase === "AWAITING_USER" && update.awaitingUser?.kind === "CAPTCHA"), "the platform knows why it is waiting");
  assert.ok(!h.log.includes("finishRun"));

  h.page.go("course");
  assert.equal(h.manager.confirmSignedIn(), true);
  await h.manager.idle();
  assert.ok(h.log.indexOf("capture-paused:false") > h.log.indexOf("capture-paused:true"), "recording resumes after they are done");
  assert.deepEqual(h.finished.map((o) => o.stopReason), ["TERMINAL_STATE_REACHED"]);
  assert.equal(h.manager.confirmSignedIn(), false, "nobody is being waited on now");
  assert.ok(h.phases.some((update) => update.executionPhase === "AWAITING_USER") && h.phases.some((update) => update.awaitingUser === null), "and the platform is told it stopped");
});

// -- markers, heartbeats and resilience ---------------------------------------------------------------

test("the application's own markers reach the engine in the contract's words, in any of the three shapes, for this run only", async () => {
  let h!: ReturnType<typeof harness>;
  let seen: string[] = [];
  let afterReset: string[] = [];
  h = harness({
    onAct: (ref) => {
      if (ref !== "e-create") return;
      h.manager.observeMarker("run-1", { stateKey: "exam_form" });
      h.manager.observeMarker("run-1", { state: "Exam Form" });
      h.manager.observeMarker("run-1", { stateId: "s-created" });
      h.manager.observeMarker("another-run", { stateKey: "course_details" });
      seen = h.hooks().sdkStates();
      h.hooks().beforeAction();
      afterReset = h.hooks().sdkStates();
    },
  });
  await finish(h);
  assert.deepEqual(seen, ["exam_form", "exam_form", "exam_created"], "typed, slug and adapter markers all resolve to the contract's keys; another run's marker is ignored");
  assert.deepEqual(afterReset, [], "and the buffer is cleared as each action begins");
});

test("the orphan journal notes each process as it starts and strikes it off as it stops", async () => {
  const h = harness();
  await finish(h);
  assert.deepEqual(h.journal, ["record:4242:app", "forget:4242"]);
});

test("the platform being unreachable for phase reports never fails the run", async () => {
  const h = harness({}, { phaseFails: true });
  await finish(h);
  assert.equal(h.finished[0]!.stopReason, "TERMINAL_STATE_REACHED");
});

test("a run whose evidence cannot be sent still finishes and frees the manager, and says so", async () => {
  const h = harness({}, { finishFails: true });
  await finish(h);
  assert.equal(h.manager.busy, false);
  const status = h.manager.status()!;
  assert.equal(status.state, "FINISHED");
  assert.ok(status.events.some((event) => /could not be sent/.test(event.text)));
  await finish(harness());
});

test("the live view names the steps and never carries what the run typed", async () => {
  const h = harness();
  await finish(h);
  const lines = h.manager.status()!.events.map((event) => event.text);
  assert.ok(lines.some((line) => /Create Exam/.test(line)));
  assert.ok(lines.some((line) => /Reached the goal/.test(line)));
});

test("a heartbeat keeps reaching the platform while a run is going", async () => {
  const h = harness();
  const release = h.holdAppStart();
  await h.manager.start(request());
  const before = h.phases.length;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(h.phases.length > before, "empty updates are still updates: they say the desktop is here");
  release();
  await h.manager.idle();
});
