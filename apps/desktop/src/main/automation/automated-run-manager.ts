import {
  assessAutomationSupport,
  checkRunDataAvailability,
  describeMissingControls,
  materializeRunData,
  normalizeStateKey,
  SdkSignalBuffer,
  unresolvedOnPath,
} from "@tellann/automation-engine";
import type { AutomationResult, CodeEvidenceSource } from "@tellann/automation-engine";
import {
  AUTOMATED_RUN_LIVE_EVENT_LIMIT,
  AUTOMATION_STOP_REASON_KIND,
  automationTargets,
  describeStopReason,
  summarizeAutomationEvent,
} from "@tellann/desktop-contracts";
import type {
  AutomatedRunLiveEvent,
  AutomatedRunOutcome,
  AutomatedRunRefusal,
  AutomatedRunStatus,
  AutomationExecutionPhase,
  AutomationPhaseUpdate,
  AutomationStopReason,
  ContractSummary,
  ExecutionProfile,
  RunDataSet,
  StartAutomatedRunResult,
  StartGuidedRunInput,
  TestPersona,
} from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import { ContractPipelineError } from "./contract-pipeline";
import type { PreparedContract } from "./contract-pipeline";
import { isProfileApproved } from "./execution-profile";
import { ProjectRunner } from "./project-runner";
import type { RunnerEvent } from "./project-runner";
import { executeAutomatedRun } from "./run-executor";
import type { ManagedBrowser, PageDriver } from "./run-executor";

/**
 * Owns one Automated Run from the moment it is accepted until nothing of it is left running.
 *
 * `executeAutomatedRun` decides what to click. Everything around it lives here: refusing to start what could only end
 * in a confusing error, starting the application from its approved profile and waiting for it to be ready, opening the
 * browser, relaying the application's own Flow markers to the engine, asking a person for the part of signing in only
 * they can do, and, however it ends, closing everything in an order that loses no evidence and leaves no process behind.
 *
 * It talks to the outside world through `AutomatedRunHost` (the cloud, the relay, the observer, the operating system's
 * notifications), so the whole sequence is exercised in tests against fakes, and `main.ts` supplies the real thing.
 */

export interface AutomatedRunRequest {
  start: StartGuidedRunInput;
  profile: ExecutionProfile;
  commands: LocalLaunchCommand[];
  workspaceRoot: string;
  /** What the workspace scan says the application is built with, for the up-front support check. */
  frameworks: string[];
  persona: TestPersona | null;
  runData: RunDataSet | null;
  /** Compiles the run's contract now. Bound by the caller to the Flow, its mapping, the local analysis and the confirmed login. */
  prepare(): Promise<PreparedContract>;
  /** The analysed code, so a step that fails can be explained from it. */
  code?: CodeEvidenceSource | null;
}

export interface OpenedRun {
  runId: string;
  sessionId: string;
  traceId: string;
  relay: { endpoint: string; relayToken: string };
  organizationId: string;
}

export interface BrowserSession {
  browser: ManagedBrowser;
  driver: PageDriver;
  /** Stops evidence being recorded while a person types (their password is theirs, and is not ours to keep). */
  setCapturePaused(paused: boolean): Promise<void>;
  bringToFront(): Promise<void>;
}

export type FinishOutcome =
  | { kind: "COMPLETE"; completionReason: "TERMINAL_STATE_REACHED" | "MANUAL_STOP_BEFORE_INITIAL" | "MANUAL_STOP_BEFORE_TERMINAL"; stopReason: AutomationStopReason }
  | { kind: "FAIL"; stopReason: AutomationStopReason; message: string };

export interface AutomatedRunHost {
  /** Creates and starts the cloud run, gets its credential and starts the relay. Cleans up after itself when it throws. */
  openRun(request: StartGuidedRunInput, contract: ContractSummary): Promise<OpenedRun>;
  openBrowser(run: OpenedRun, request: StartGuidedRunInput, hooks: { sdkStates(): string[]; beforeAction(): void }): Promise<BrowserSession>;
  /** Closes the browser and settles its evidence. Best effort: never throws, and is safe when the browser is already gone. */
  endBrowser(run: OpenedRun): Promise<void>;
  /** Stops the relay, uploads what is left and completes or fails the run. Throws only if the platform could not be told. */
  finishRun(run: OpenedRun, outcome: FinishOutcome): Promise<void>;
  reportPhase(runId: string, update: AutomationPhaseUpdate): Promise<void>;
  notify(note: { title: string; body: string }): void;
  publish(status: AutomatedRunStatus): void;
}

export interface OrphanRecorder {
  record(input: { pid: number; runId: string; name: string }): Promise<void>;
  forget(pid: number): void;
}

export interface ManagerDeps {
  createRunner?: () => Pick<ProjectRunner, "start" | "stop" | "health">;
  journal?: OrphanRecorder;
  agentVersion?: string;
  now?: () => Date;
  /** How often the platform hears that this desktop is still here. Far shorter than the reaper's patience. */
  heartbeatMs?: number;
  /** How long a person has to sign in by hand before the run gives up waiting. */
  manualWaitMs?: number;
}

interface ActiveRun {
  request: AutomatedRunRequest;
  prepared: PreparedContract;
  targetStateKey: string;
  opened: OpenedRun;
  signals: SdkSignalBuffer;
  status: AutomatedRunStatus;
  runner: Pick<ProjectRunner, "start" | "stop" | "health"> | null;
  session: BrowserSession | null;
  cancelRequested: boolean;
  browserGone: boolean;
  reachedInitial: boolean;
  wait: { resolve(outcome: "DONE" | "CANCELLED" | "TIMED_OUT"): void } | null;
  teardown: Promise<void> | null;
  done: Promise<void>;
}

const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_MANUAL_WAIT_MS = 10 * 60_000;

const refusal = (code: AutomatedRunRefusal["code"], title: string, message: string, tone: AutomatedRunRefusal["tone"] = "notice", alternatives: AutomatedRunRefusal["alternatives"] = []): StartAutomatedRunResult =>
  ({ ok: false, refusal: { code, title, message, tone, alternatives } });

export class AutomatedRunManager {
  private active: ActiveRun | null = null;
  private last: AutomatedRunStatus | null = null;

  constructor(private readonly host: AutomatedRunHost, private readonly deps: ManagerDeps = {}) {}

  /** Whether a run is in progress. A finished one is only remembered, for its outcome. */
  get busy(): boolean {
    return this.active !== null;
  }

  ownsRun(runId: string): boolean {
    return this.active?.opened.runId === runId;
  }

  status(): AutomatedRunStatus | null {
    return this.active?.status ?? this.last;
  }

  /**
   * Decline what cannot work, or start the run and return while it goes on. Every refusal happens before anything is
   * created: no run record, no process, no browser, and no run counted against the person's plan.
   */
  async start(request: AutomatedRunRequest): Promise<StartAutomatedRunResult> {
    if (this.active) throw new Error("RUN_ALREADY_ACTIVE");
    const { start } = request;
    if (start.environmentType === "PRODUCTION") throw new Error("AUTOMATED_RUN_PRODUCTION_BLOCKED");
    if (!start.automation) throw new Error("AUTOMATION_CONFIG_REQUIRED");
    if (!start.expectedGraphVersionId) throw new Error("FLOW_VERSION_REQUIRED");
    const now = this.deps.now ?? (() => new Date());

    const support = assessAutomationSupport(request.frameworks);
    if (!support.canRun) {
      return refusal("FRAMEWORK_NOT_YET_SUPPORTED", support.title, support.message, "notice", support.alternatives);
    }

    let prepared: PreparedContract;
    try {
      prepared = await request.prepare();
    } catch (error) {
      if (error instanceof ContractPipelineError) return refusal(error.code, refusalTitle(error.code), error.message, "notice");
      throw error;
    }
    const { contract } = prepared;

    const requested = automationTargets(start.automation)[0]!;
    const targetKey = contract.stateAliases?.[normalizeStateKey(requested)] ?? normalizeStateKey(requested);
    const target = contract.states.find((state) => state.key === targetKey);
    if (!target || target.role !== "TERMINAL") {
      return refusal("TARGET_NOT_IN_FLOW", "That is not a goal this Flow has", `The Flow has no ending called "${requested}". Pick one of its terminal states as the target.`, "problem");
    }

    if (!isProfileApproved(request.profile, request.commands, request.workspaceRoot)) {
      return refusal("PROFILE_NOT_APPROVED", "Approve how to start the application", "Tellann only starts your application from a profile you have approved, and this one is not approved yet, or what it runs has changed since you approved it.", "problem");
    }

    const missingControls = describeMissingControls(unresolvedOnPath(contract, targetKey, start.environmentType) ?? []);
    if (missingControls) return refusal("CONTROLS_NOT_DERIVED", "Some steps have no control to use yet", missingControls, "problem");

    const data = checkRunDataAvailability(contract, materializeRunData(request.runData, () => now().getTime()));
    if (!data.ok) return refusal("TEST_DATA_UNAVAILABLE", "This run needs test data it does not have", data.detail, "problem");

    const opened = await this.host.openRun(start, prepared.summary);
    const startedAt = now().toISOString();
    const active: ActiveRun = {
      request, prepared, targetStateKey: targetKey, opened,
      signals: new SdkSignalBuffer(contract.stateAliases ?? {}),
      status: {
        runId: opened.runId, applicationId: start.applicationId, state: "PREPARING", phase: "PREPARING_WORKSPACE", awaitingUser: null,
        targetStateKey: targetKey, currentStateKey: null, steps: 0, startedAt, finishedAt: null, events: [], outcome: null,
      },
      runner: null, session: null, cancelRequested: false, browserGone: false, reachedInitial: false, wait: null, teardown: null,
      done: Promise.resolve(),
    };
    this.active = active;
    active.done = this.drive(active).catch(() => undefined);
    return { ok: true, status: active.status };
  }

  /** The person asked to stop. Takes effect at the run's next decision, or at once if it is waiting for them. */
  cancel(): boolean {
    const active = this.active;
    if (!active) return false;
    active.cancelRequested = true;
    active.wait?.resolve("CANCELLED");
    return true;
  }

  /** The person says they have signed in by hand. */
  confirmSignedIn(): boolean {
    const wait = this.active?.wait;
    if (!wait) return false;
    wait.resolve("DONE");
    return true;
  }

  /** A Flow marker the application's own instrumentation reported, relayed here. */
  observeMarker(runId: string, metadata: Record<string, unknown>): void {
    if (this.active?.opened.runId === runId) this.active.signals.observe(metadata);
  }

  /** The managed browser went away underneath the run (closed, crashed, killed). */
  browserTerminated(runId: string): void {
    const active = this.active;
    if (!active || active.opened.runId !== runId) return;
    active.browserGone = true;
    // A person who was being waited on will not be coming back to a browser that is gone: end the wait and let the run see it.
    active.wait?.resolve("DONE");
  }

  /**
   * The desktop is closing. Stop everything now and say so, rather than leave a run open for the platform to time out.
   * Resolves once the application's processes are down; telling the platform is best effort.
   */
  async shutdown(): Promise<void> {
    const active = this.active;
    if (!active) return;
    active.cancelRequested = true;
    active.wait?.resolve("CANCELLED");
    await this.close(active, { kind: "FAIL", stopReason: "AUTOMATION_ENGINE_ERROR", message: "The desktop application was closed while the run was in progress." });
  }

  /** Resolves when the current run has fully finished. For tests, and for a caller that must not proceed until it has. */
  async idle(): Promise<void> {
    await this.active?.done;
  }

  // ---------------------------------------------------------------------------

  private async drive(active: ActiveRun): Promise<void> {
    const { request, opened } = active;
    const { start } = request;
    const automation = start.automation!;
    const heartbeat = setInterval(() => void this.report(active, {}), this.deps.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
    heartbeat.unref?.();
    let outcome: FinishOutcome;
    try {
      await this.report(active, { executionPhase: "PREPARING_WORKSPACE", contract: active.prepared.summary });
      // A shutdown can arrive at any await below, and it has already closed everything that existed at that moment:
      // whatever is started after it must be stopped again here, not left running behind it.
      if (active.teardown) return;

      this.setPhase(active, "STARTING_APPLICATION", "PREPARING");
      const runner = (this.deps.createRunner ?? (() => new ProjectRunner()))();
      active.runner = runner;
      const started = await runner.start({
        profile: request.profile, commands: request.commands, workspaceRoot: request.workspaceRoot,
        correlation: {
          endpoint: opened.relay.endpoint, relayToken: opened.relay.relayToken, runId: opened.runId, sessionId: opened.sessionId,
          traceId: opened.traceId, applicationId: start.applicationId, environmentId: start.environmentId, agentVersion: this.deps.agentVersion ?? "0.0.0",
        },
        onEvent: (event) => this.onRunnerEvent(active, event),
      });
      if (active.teardown) {
        await runner.stop().catch(() => undefined);
        return;
      }
      if (!started.ok) {
        outcome = this.failure(started.stopReason, started.detail);
      } else if (active.cancelRequested) {
        outcome = this.completion(active, "CANCELLED_BY_USER");
      } else {
        this.setPhase(active, "LAUNCHING_BROWSER", "PREPARING");
        const session = await this.host.openBrowser(opened, start, { sdkStates: () => active.signals.states(), beforeAction: () => active.signals.reset() });
        active.session = session;
        if (active.teardown) {
          await this.host.endBrowser(opened).catch(() => undefined);
          await runner.stop().catch(() => undefined);
          return;
        }
        this.setPhase(active, "SEEKING_INITIAL_STATE", "RUNNING");

        const result = await executeAutomatedRun({
          browser: this.teed(active, session.browser),
          driver: this.watched(active, session.driver),
          contract: active.prepared.contract,
          navigation: active.prepared.navigation,
          persona: request.persona,
          runData: request.runData,
          targetStateKey: active.targetStateKey,
          environment: start.environmentType,
          applicationOrigin: new URL(start.targetUrl).origin,
          limits: automation.limits,
          code: request.code ?? null,
          renderTimingComponents: automation.renderTimingComponents,
          cancelled: () => active.cancelRequested,
          onPhase: (phase, detail) => this.setPhase(active, phase, phase === "AWAITING_USER" ? "AWAITING_USER" : "RUNNING", detail ?? null),
          manualAuthentication: { wait: (challenge) => this.waitForPerson(active, challenge) },
          stepHandOver: { wait: (challenge) => this.waitForPerson(active, challenge) },
          applicationHealth: () => runner.health(),
        });
        outcome = this.outcomeOf(active, result);
      }
    } catch (error) {
      // Something in Tellann's own machinery failed: not a finding about the application, and never worded as one.
      outcome = this.failure("AUTOMATION_ENGINE_ERROR", firstLine(error));
    } finally {
      clearInterval(heartbeat);
    }
    await this.close(active, outcome).catch(() => undefined);
  }

  /** What the platform is told, and what the person is shown, for how the engine ended. */
  private outcomeOf(active: ActiveRun, result: AutomationResult): FinishOutcome {
    const kind = AUTOMATION_STOP_REASON_KIND[result.stopReason];
    if (kind === "INFRASTRUCTURE") return this.failure(result.stopReason, result.detail ?? null);
    active.status.steps = Math.max(active.status.steps, result.steps);
    return this.completion(active, result.stopReason, result.detail ?? null);
  }

  private completion(active: ActiveRun, stopReason: AutomationStopReason, detail: string | null = null): FinishOutcome {
    this.setOutcome(active, stopReason, stopReason === "TERMINAL_STATE_REACHED" ? "COMPLETED" : "COMPLETED_INCOMPLETE", detail);
    return {
      kind: "COMPLETE", stopReason,
      completionReason: stopReason === "TERMINAL_STATE_REACHED" ? "TERMINAL_STATE_REACHED" : active.reachedInitial ? "MANUAL_STOP_BEFORE_TERMINAL" : "MANUAL_STOP_BEFORE_INITIAL",
    };
  }

  private failure(stopReason: AutomationStopReason, detail: string | null): FinishOutcome {
    const active = this.active;
    if (active) this.setOutcome(active, stopReason, "FAILED", detail);
    return { kind: "FAIL", stopReason, message: describeStopReason(stopReason, detail).message.slice(0, 500) };
  }

  private setOutcome(active: ActiveRun, stopReason: AutomationStopReason, result: AutomatedRunOutcome["result"], detail: string | null): void {
    const message = describeStopReason(stopReason, detail, active.targetStateKey);
    active.status.outcome = { stopReason, result, title: message.title, message: message.message, tone: message.tone, nextStep: message.nextStep };
  }

  /**
   * Close everything, once, in an order that loses nothing: stop driving, then stop the application (so it cannot emit
   * into a relay that is closing), then settle the evidence and tell the platform. Whoever gets here first decides the
   * outcome; a second caller waits for the same teardown.
   */
  private close(active: ActiveRun, outcome: FinishOutcome): Promise<void> {
    active.teardown ??= (async () => {
      this.setPhase(active, "FLUSHING_EVIDENCE", "FINISHING");
      if (active.session) await this.host.endBrowser(active.opened).catch(() => undefined);
      this.setPhase(active, "SHUTTING_DOWN", "FINISHING");
      await active.runner?.stop((event) => this.onRunnerEvent(active, event)).catch(() => undefined);
      if (!active.status.outcome) {
        // A shutdown decided the outcome before the run did.
        this.setOutcome(active, outcome.stopReason, outcome.kind === "FAIL" ? "FAILED" : "COMPLETED_INCOMPLETE", outcome.kind === "FAIL" ? outcome.message : null);
      }
      try {
        await this.host.finishRun(active.opened, outcome);
      } catch (error) {
        this.addEvent(active, { type: "SYNC", text: "The run finished, but its evidence could not be sent yet. It will be retried.", tone: "problem" });
        void error;
      }
      active.status.state = "FINISHED";
      active.status.phase = null;
      active.status.awaitingUser = null;
      active.status.finishedAt = (this.deps.now ?? (() => new Date()))().toISOString();
      this.last = active.status;
      this.active = null;
      this.publish(active);
    })();
    return active.teardown;
  }

  // -- the pieces the executor is given ---------------------------------------

  private waitForPerson(active: ActiveRun, challenge: { kind: string; detail: string }): Promise<"DONE" | "CANCELLED" | "TIMED_OUT"> {
    // Approving a step happens here, in Tellann. Signing in, or doing a step by hand, happens in the browser the run
    // opened: that is where the person is sent, and what they type there is not recorded.
    const inBrowser = challenge.kind !== "CONFIRM_STEP";
    const title = challenge.kind === "CONFIRM_STEP" ? "Tellann needs your approval" : challenge.kind === "MANUAL_STEP" ? "Tellann needs you to do a step" : "Tellann needs you to sign in";
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish("TIMED_OUT"), this.deps.manualWaitMs ?? DEFAULT_MANUAL_WAIT_MS);
      const finish = (outcome: "DONE" | "CANCELLED" | "TIMED_OUT") => {
        if (!active.wait) return;
        clearTimeout(timer);
        active.wait = null;
        active.status.awaitingUser = null;
        // Recording resumes only once the person is done: what they typed while it was paused was never captured.
        void ((inBrowser ? active.session?.setCapturePaused(false) : undefined) ?? Promise.resolve()).catch(() => undefined).finally(() => resolve(outcome));
      };
      active.wait = { resolve: finish };
      active.status.awaitingUser = challenge;
      void (async () => {
        if (inBrowser) {
          await active.session?.setCapturePaused(true).catch(() => undefined);
          await active.session?.bringToFront().catch(() => undefined);
        }
        this.host.notify({ title, body: challenge.detail });
        await this.report(active, { executionPhase: "AWAITING_USER", awaitingUser: challenge });
      })();
      // Cancelled or gone between deciding to wait and getting here.
      if (active.cancelRequested) finish("CANCELLED");
      else if (active.browserGone) finish("DONE");
    });
  }

  /** The browser, with everything the run records also noted for the live view. */
  private teed(active: ActiveRun, browser: ManagedBrowser): ManagedBrowser {
    return {
      ...browser,
      captureAnomalyArtifacts: (...args: Parameters<ManagedBrowser["captureAnomalyArtifacts"]>) => browser.captureAnomalyArtifacts(...args),
      beginAutomationTraceChunk: (...args: Parameters<ManagedBrowser["beginAutomationTraceChunk"]>) => browser.beginAutomationTraceChunk(...args),
      endAutomationTraceChunk: (...args: Parameters<ManagedBrowser["endAutomationTraceChunk"]>) => browser.endAutomationTraceChunk(...args),
      protectAutomationValues: (values) => browser.protectAutomationValues(values),
      recordAutomationEvent: (type, metadata) => {
        this.noteEvent(active, type, metadata);
        return browser.recordAutomationEvent(type, metadata);
      },
    };
  }

  /** The driver, which learns the browser is gone from the observer as well as from its own page. */
  private watched(active: ActiveRun, driver: PageDriver): PageDriver {
    return {
      snapshot: () => driver.snapshot(),
      act: (action) => driver.act(action),
      settle: (expected) => driver.settle(expected),
      health: async () => (active.browserGone ? "BROWSER_CRASHED" : (await driver.health?.()) ?? "OK"),
    };
  }

  private onRunnerEvent(active: ActiveRun, event: RunnerEvent): void {
    const journal = this.deps.journal;
    if (!journal || event.pid === undefined) return;
    if (event.phase === "STARTED") void journal.record({ pid: event.pid, runId: active.opened.runId, name: event.process });
    else if (event.phase === "STOPPED") journal.forget(event.pid);
  }

  // -- status -----------------------------------------------------------------

  private noteEvent(active: ActiveRun, type: string, data: Record<string, unknown>): void {
    if (type === "QA_AUTOMATION_INITIAL_STATE_REACHED") active.reachedInitial = true;
    if (type === "QA_AUTOMATION_ACTION_EXECUTED") active.status.steps += 1;
    const seen = typeof data.recognizedStateKey === "string" ? data.recognizedStateKey : typeof data.observedState === "string" ? data.observedState : typeof data.stateKey === "string" ? data.stateKey : null;
    if (seen && (type === "QA_AUTOMATION_STATE_EVALUATED" || type === "QA_AUTOMATION_ACTION_VERIFIED" || type === "QA_AUTOMATION_INITIAL_STATE_REACHED")) active.status.currentStateKey = seen;
    const line = summarizeAutomationEvent(type, data);
    if (line) this.addEvent(active, { type, ...line });
    else this.publish(active);
  }

  private addEvent(active: ActiveRun, event: Omit<AutomatedRunLiveEvent, "at">): void {
    const at = (this.deps.now ?? (() => new Date()))().toISOString();
    active.status.events = [...active.status.events, { ...event, at }].slice(-AUTOMATED_RUN_LIVE_EVENT_LIMIT);
    this.publish(active);
  }

  private setPhase(active: ActiveRun, phase: AutomationExecutionPhase, state: AutomatedRunStatus["state"], detail: { kind: string; detail: string } | null = null): void {
    active.status.phase = phase;
    active.status.state = state;
    active.status.awaitingUser = phase === "AWAITING_USER" ? detail ?? active.status.awaitingUser : null;
    this.publish(active);
    void this.report(active, { executionPhase: phase, ...(phase === "AWAITING_USER" ? {} : { awaitingUser: null }) });
  }

  /** Telling the platform where the run is doubles as the heartbeat. It never fails the run. */
  private async report(active: ActiveRun, update: AutomationPhaseUpdate): Promise<void> {
    try {
      await this.host.reportPhase(active.opened.runId, update);
    } catch {
      /* the platform not hearing from us is what the reaper is for */
    }
  }

  private publish(active: ActiveRun): void {
    try {
      this.host.publish(structuredClone(active.status));
    } catch {
      /* the window is not the run */
    }
  }
}

function refusalTitle(code: ContractPipelineError["code"]): string {
  switch (code) {
    case "CODE_ANALYSIS_REQUIRED": return "Analyse your code first";
    case "FLOW_MAPPING_REQUIRED": return "This Flow is not mapped to your code yet";
    case "FLOW_INVALID": return "This Flow cannot be run";
  }
}

/** The first line of an error's message and never its stack: it is shown to a person and stored with a report. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split(/\r?\n/)[0] ?? "").slice(0, 300);
}
