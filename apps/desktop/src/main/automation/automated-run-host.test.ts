import assert from "node:assert/strict";
import test from "node:test";
import type { GuidedRunState } from "@tellann/browser-observer";
import type { StartGuidedRunInput } from "@tellann/desktop-contracts";
import { createAutomatedRunHost } from "./automated-run-host";
import type { AutomatedRunHostDeps } from "./automated-run-host";
import type { OpenedRun } from "./automated-run-manager";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const start = (): StartGuidedRunInput => ({
  applicationId: uuid(1), environmentId: uuid(2), workspaceId: null, flowId: uuid(3), flowBindingId: uuid(4), flowInitializationId: uuid(5),
  flowScanId: uuid(6), expectedGraphVersionId: uuid(7), captureTracks: ["FRONTEND"], environmentType: "STAGING", mode: "AUTOMATED", targetUrl: "http://localhost:3000",
  automation: { targetTerminalStateKey: "done", executionProfileId: "p", renderTimingComponents: [], limits: { maxSteps: 10, maxDurationMs: 1000, maxReplans: 1, maxActionRetries: 1 } },
}) as unknown as StartGuidedRunInput;

const state = (over: Partial<GuidedRunState> = {}) => ({ runId: "run-1", sessionId: "s", traceId: "t", observations: [1, 2], findings: [1], currentFlowStateKey: "done", ...over }) as unknown as GuidedRunState;

function harness(options: { relayStartFails?: boolean; noOrganization?: boolean; completeFails?: boolean; observerState?: GuidedRunState | null; noPage?: boolean } = {}) {
  const log: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: Record<string, any[][]> = {};
  const note = (name: string, ...args: unknown[]) => { log.push(name); (calls[name] ??= []).push(args); };
  let observerState: GuidedRunState | null = options.observerState === undefined ? null : options.observerState;
  const page = { on: () => undefined, isClosed: () => false };

  const deps: AutomatedRunHostDeps = {
    cloud: {
      async createRun(input) { note("createRun", input); return options.noOrganization ? { id: "run-1" } : { id: "run-1", organizationId: "org-1" }; },
      async startRun(...args) { note("startRun", ...args); return { credential: { credential: "cred" } }; },
      async completeRun(input) { note("completeRun", input); if (options.completeFails) throw new Error("network down"); return {}; },
      async completeRunWithoutEvidence(input) { note("completeRunWithoutEvidence", input); return {}; },
      async failRun(runId, reason) { note("failRun", runId, reason); return {}; },
      async reportAutomationPhase(runId, update) { note("reportPhase", runId, update); return {}; },
    },
    relay: {
      async start(input) { note("relay.start", input); if (options.relayStartFails) throw new Error("port in use"); return { endpoint: "http://127.0.0.1:9/relay", relayToken: "r".repeat(40) } as never; },
      async emit(type) { note(`relay.emit:${type}`); return undefined as never; },
      async stop() { note("relay.stop"); },
    },
    observer: {
      async start(input: unknown) { note("observer.start", input); observerState = state(); return observerState; },
      getAutomationPage: () => (options.noPage ? null : page),
      getState: () => observerState,
      async end() { note("observer.end"); const ended = observerState!; observerState = null; return ended; },
      async pause(paused: boolean) { note(`observer.pause:${paused}`); return state(); },
      async focusBrowser() { note("observer.focus"); return state(); },
    } as never,
    artifactRoot: () => "/artifacts",
    agentVersion: "9.9.9",
    collectorBaseUrl: () => "http://collector",
    captureVersion: "2.0",
    selectedWorkspace: () => ({ cloudId: "ws", snapshotId: "snap" }),
    onRelayedEvents: async () => undefined,
    readRelayQueue: () => [],
    writeRelayQueue: () => undefined,
    setActiveRelay: (connection) => note(`activeRelay:${connection ? connection.runId : "none"}`),
    evidence: {
      open: (runId) => note("evidence.open", runId),
      flush: async (runId, drain) => note("evidence.flush", runId, drain),
      persist: (runId) => note("evidence.persist", runId),
      forget: (runId) => note("evidence.forget", runId),
    },
    maintenance: { start: () => note("maintenance.start"), stop: () => note("maintenance.stop") },
    backendStream: { start: () => note("backend.start"), stop: () => note("backend.stop") },
    recovery: { write: (runId, record) => note("recovery.write", runId, record), delete: (runId) => note("recovery.delete", runId) },
    lifecycle: (_state, input) => note(`lifecycle:${input.cloudStatus ?? input.localStatus ?? input.phase}`),
    afterBrowserOpened: () => note("afterBrowserOpened"),
    notify: (n) => note("notify", n),
    publish: () => undefined,
  };
  return { ...createAutomatedRunHost(deps), log, calls };
}

const opened = (): OpenedRun => ({ runId: "run-1", sessionId: "s", traceId: "t", organizationId: "org-1", relay: { endpoint: "http://127.0.0.1:9/relay", relayToken: "r".repeat(40) } });
const contractSummary = { hash: "a".repeat(64), flowHash: "b".repeat(64), analysisIdentity: null, states: 1, transitions: 0, controlsDerived: 0, controlsMissing: 0, anchored: 0 };

test("opening a run creates it as automated with its config pinned, then starts it, its evidence and its relay, in that order", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  assert.deepEqual(h.log, ["createRun", "startRun", "evidence.open", "relay.start", "activeRelay:run-1", "relay.emit:QA_RUN_STARTED"]);
  const body = h.calls.createRun![0]![0] as Record<string, unknown>;
  assert.equal(body.mode, "AUTOMATED");
  assert.deepEqual((body.automation as { targetTerminalStateKey: string }).targetTerminalStateKey, "done");
  assert.equal(body.workspaceId, "ws");
  assert.equal(body.repositorySnapshotId, "snap");
  assert.equal(body.captureVersion, "2.0");
  const relayInput = h.calls["relay.start"]![0]![0] as { allowedOrigin: string; runCredential: string };
  assert.equal(relayInput.allowedOrigin, "http://localhost:3000");
  assert.equal(relayInput.runCredential, "cred");
  assert.deepEqual([run.runId, run.organizationId, run.relay.endpoint], ["run-1", "org-1", "http://127.0.0.1:9/relay"]);
});

test("a run that cannot get its relay is failed and everything it opened is closed, so nothing of it outlives the failure", async () => {
  const h = harness({ relayStartFails: true });
  await assert.rejects(h.host.openRun(start(), contractSummary), /port in use/);
  assert.ok(h.log.includes("relay.stop") && h.log.includes("activeRelay:none") && h.log.includes("backend.stop"));
  assert.deepEqual(h.calls.failRun![0], ["run-1", "port in use"]);
});

test("a run the platform returned without an organization is failed rather than left open", async () => {
  const h = harness({ noOrganization: true });
  await assert.rejects(h.host.openRun(start(), contractSummary), /RUN_ORGANIZATION_CONTEXT_MISSING/);
  assert.equal(h.calls.failRun!.length, 1);
  assert.ok(!h.log.includes("relay.start"));
});

test("the browser is opened for the run's identity, and pausing it only pauses the observer", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  const session = await h.host.openBrowser(run, start(), { sdkStates: () => ["x"], beforeAction: () => undefined });
  const input = h.calls["observer.start"]![0]![0] as Record<string, unknown>;
  assert.equal(input.runId, "run-1");
  assert.equal(input.relayEndpoint, "http://127.0.0.1:9/relay");
  assert.equal(input.agentVersion, "9.9.9");
  assert.ok(h.log.includes("maintenance.start") && h.log.includes("afterBrowserOpened") && h.log.includes("lifecycle:RECORDING"));
  await session.setCapturePaused(true);
  await session.bringToFront();
  assert.ok(h.log.includes("observer.pause:true") && h.log.includes("observer.focus"));
  assert.ok(!h.log.includes("relay.setPaused"), "the relay keeps forwarding the application's own markers");
});

test("a page that never opened is a failure to start, said in plain words", async () => {
  const h = harness({ noPage: true });
  const run = await h.host.openRun(start(), contractSummary);
  await assert.rejects(h.host.openBrowser(run, start(), { sdkStates: () => [], beforeAction: () => undefined }), /did not open a page/);
});

test("completing a run settles the browser, records the recovery, flushes evidence, then tells the platform why it stopped", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  await h.host.openBrowser(run, start(), { sdkStates: () => [], beforeAction: () => undefined });
  h.log.length = 0;
  await h.host.endBrowser(run);
  await h.host.finishRun(run, { kind: "COMPLETE", stopReason: "TRANSITION_DID_NOT_ADVANCE", completionReason: "MANUAL_STOP_BEFORE_TERMINAL" });
  assert.deepEqual(h.log.filter((name) => !name.startsWith("lifecycle") && name !== "notify"), [
    "observer.end", "maintenance.stop", "evidence.persist", "recovery.write", "relay.emit:QA_RUN_COMPLETED", "relay.stop", "activeRelay:none", "backend.stop",
    "evidence.flush", "completeRun", "recovery.delete", "evidence.forget",
  ]);
  const completed = h.calls.completeRun![0]![0] as Record<string, unknown>;
  assert.equal(completed.automationStopReason, "TRANSITION_DID_NOT_ADVANCE");
  assert.equal(completed.completionReason, "MANUAL_STOP_BEFORE_TERMINAL");
  assert.deepEqual(h.calls["evidence.flush"]![0], ["run-1", true], "the whole spool is drained before completing");
  assert.equal((h.calls.notify![0]![0] as { title: string }).title, "A step ran but the next state did not follow");
});

test("a run that never opened a browser is completed without evidence rather than failing on a folder that was never made", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  await h.host.finishRun(run, { kind: "COMPLETE", stopReason: "CANCELLED_BY_USER", completionReason: "MANUAL_STOP_BEFORE_INITIAL" });
  assert.ok(!h.log.includes("completeRun"));
  assert.deepEqual(h.calls.completeRunWithoutEvidence![0]![0], { runId: "run-1", sessionId: run.sessionId, traceId: run.traceId, completionReason: "MANUAL_STOP_BEFORE_INITIAL", automationStopReason: "CANCELLED_BY_USER" });
});

test("a run that Tellann could not carry out is failed with a plain message, not completed", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  await h.host.finishRun(run, { kind: "FAIL", stopReason: "APPLICATION_START_FAILED", message: "Your application did not start." });
  assert.ok(h.log.includes("relay.emit:QA_RUN_FAILED") && !h.log.includes("completeRun") && !h.log.includes("completeRunWithoutEvidence"));
  assert.deepEqual(h.calls.failRun!.at(-1), ["run-1", "Your application did not start."]);
  assert.equal((h.calls.notify![0]![0] as { body: string }).body, "Your application did not start.");
});

test("when the platform cannot be told, the recovery record stays so the next launch can finish it, and the error is not swallowed", async () => {
  const h = harness({ completeFails: true });
  const run = await h.host.openRun(start(), contractSummary);
  await h.host.openBrowser(run, start(), { sdkStates: () => [], beforeAction: () => undefined });
  await h.host.endBrowser(run);
  await assert.rejects(h.host.finishRun(run, { kind: "COMPLETE", stopReason: "TERMINAL_STATE_REACHED", completionReason: "TERMINAL_STATE_REACHED" }), /network down/);
  assert.ok(h.log.includes("recovery.write"));
  assert.ok(!h.log.includes("recovery.delete"), "kept for the next launch");
  assert.equal((h.calls["recovery.write"]![0]![1] as { automationStopReason: string }).automationStopReason, "TERMINAL_STATE_REACHED", "with the reason, so the resumed completion says why");
});

test("a browser that went away by itself has its last state used, and the observer is not asked to end again", async () => {
  const h = harness();
  const run = await h.host.openRun(start(), contractSummary);
  h.browserTerminated(state());
  await h.host.endBrowser(run);
  await h.host.finishRun(run, { kind: "COMPLETE", stopReason: "APPLICATION_CRASHED", completionReason: "MANUAL_STOP_BEFORE_TERMINAL" });
  assert.ok(!h.log.includes("observer.end"));
  assert.ok(h.log.includes("completeRun"), "completed from the state the browser left, with its evidence folder");
});

test("phase reports go to the platform as they are", async () => {
  const h = harness();
  await h.host.reportPhase("run-1", { executionPhase: "EXECUTING_FLOW" });
  assert.deepEqual(h.calls.reportPhase![0], ["run-1", { executionPhase: "EXECUTING_FLOW" }]);
});
