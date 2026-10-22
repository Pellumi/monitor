import {
  assessAutomationSupport,
  checkRunDataAvailability,
  describeMissingControls,
  materializeRunData,
  normalizeStateKey,
  SdkSignalBuffer,
  unresolvedOnPath,
} from "@tellann/automation-engine";
import type { AutomationPorts, AutomationResult, CodeEvidenceSource } from "@tellann/automation-engine";
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
import { fetchApiSession, storageStateFromSeed, suppliedSessionValues } from "./supplied-session";
import type { AmbiguityResolver } from "@tellann/automation-engine";
import type { FetchLike } from "./supplied-session";
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
  screenAnalysis?: AutomationPorts['screenAnalysis'];
  /** Stops evidence being recorded while a person types (their password is theirs, and is not ours to keep). */
  setCapturePaused(paused: boolean): Promise<void>;
  bringToFront(): Promise<void>;
  /** What the browser is signed in as, for the next run to start from. Null when there is nothing worth keeping. */
  captureStorageState(): Promise<string | null>;
  /** Forget whatever the browser is signed in as, so a retry starts from nothing. */
  clearStorageState(): Promise<void>;
}

/** Where a signed-in browser session is kept between runs. Injected so the manager can be tested without the disk. */
export interface SessionKeeper {
  read(identity: { applicationId: string; personaId: string; origin: string }): string | null;
  write(identity: { applicationId: string; personaId: string; origin: string }, storageState: string): void;
  delete(identity: { applicationId: string; personaId: string; origin: string }): void;
}

export type FinishOutcome =
  | { kind: "COMPLETE"; completionReason: "TERMINAL_STATE_REACHED" | "MANUAL_STOP_BEFORE_INITIAL" | "MANUAL_STOP_BEFORE_TERMINAL"; stopReason: AutomationStopReason; detail?: string }
  | { kind: "FAIL"; stopReason: AutomationStopReason; message: string };

export interface AutomatedRunHost {
  /** Creates and starts the cloud run, gets its credential and starts the relay. Cleans up after itself when it throws. */
  openRun(request: StartGuidedRunInput, contract: ContractSummary): Promise<OpenedRun>;
  openBrowser(
    run: OpenedRun,
    request: StartGuidedRunInput,
    hooks: { sdkStates(): string[]; beforeAction(): void },
    /** A session an earlier run kept, so the browser starts already signed in. Absent means an empty browser. */
    options?: { storageState?: string },
  ): Promise<BrowserSession>;
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
  /** Where a signed-in session is kept between runs. Absent means every run signs in from nothing. */
  sessions?: SessionKeeper;
  /** How an `API` persona's session request is made. Injected so the manager can be tested without a server. */
  fetchSession?: FetchLike;
  /**
   * Breaks a tie neither the code nor the rendered page could, for the runs that ask for it.
   *
   * Absent by default, and absent is the whole point: with no resolver the engine stops at such a tie rather
   * than guessing, which is the behaviour every run has had until now. Supplying one relaxes that for the two
   * decisions `ambiguity.ts` governs and nothing else — its answer is still verified against the contract.
   */
  resolver?: AmbiguityResolver;
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
/** How many times the wait for a person is extended, with a reminder, before the run gives up on it. */
const MANUAL_WAIT_REMINDERS = 1;

const refusal = (code: AutomatedRunRefusal["code"], title: string, message: string, tone: AutomatedRunRefusal["tone"] = "notice", alternatives: AutomatedRunRefusal["alternatives"] = []): StartAutomatedRunResult =>
  ({ ok: false, refusal: { code, title, message, tone, alternatives } });

export class AutomatedRunManager {
  private active: ActiveRun | null = null;
  private starting = false;
  private last: AutomatedRunStatus | null = null;

  constructor(private readonly host: AutomatedRunHost, private readonly deps: ManagerDeps = {}) {}

  /** Whether a run is in progress. A finished one is only remembered, for its outcome. */
  get busy(): boolean {
    return this.starting || this.active !== null;
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
    if (this.active || this.starting) throw new Error("RUN_ALREADY_ACTIVE");
    this.starting = true;
    try {
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

    // A run whose persona has to sign in, with no sign-in to use, cannot possibly reach the Flow. Said here rather
    // than after the application has been started and a browser opened — and, above all, rather than as
    // "the Flow's first state could not be reached", which reads as a fault in the person's application.
    const signIn = this.signInShortfall(request, prepared);
    if (signIn) return refusal(signIn.code, signIn.title, signIn.message, "problem");

    const data = checkRunDataAvailability(contract, materializeRunData(request.runData, () => now().getTime()), request.persona);
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
    } finally {
      this.starting = false;
    }
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
        // A session kept from an earlier run of this application, as this persona, against this address. Only for a
        // persona that signs in at all: a guest has no session worth keeping and none worth replaying.
        const identity = this.sessionIdentity(active);
        const kept = identity ? this.deps.sessions?.read(identity) ?? null : null;
        // Failing that, a session the persona supplies outright, or one the application is asked for. Either way the
        // browser opens already signed in and no sign-in form is involved at all.
        const supplied = kept ? null : await this.suppliedSession(active);
        if (supplied && !supplied.ok) {
          // There is no browser yet, and nothing to drive without a session: say exactly what the application
          // answered and stop, rather than open a browser that would only be refused on its first page.
          outcome = this.completion(active, "SUPPLIED_SESSION_REJECTED", supplied.detail);
          await this.close(active, outcome).catch(() => undefined);
          return;
        }
        const seed = kept ?? supplied?.storageState ?? null;
        const session = await this.host.openBrowser(
          opened, start,
          { sdkStates: () => active.signals.states(), beforeAction: () => active.signals.reset() },
          seed ? { storageState: seed } : undefined,
        );
        active.session = session;
        // Every value a supplied session is made of, registered before a page is opened, so none of it can be recorded.
        const sessionValues = suppliedSessionValues(active.request.persona);
        if (sessionValues.length > 0 || supplied?.ok) {
          session.browser.protectAutomationValues([...sessionValues, ...(supplied?.ok && supplied.token ? [supplied.token] : [])]);
        }
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
          responsiveBreakpoints: automation.responsiveBreakpoints,
          ...(session.screenAnalysis ? { screenAnalysis: session.screenAnalysis } : {}),
          // Only for a run that asked for it, and only when one has been supplied at all.
          ...(automation.assistedTieBreaking && this.deps.resolver ? { resolver: this.deps.resolver } : {}),
          cancelled: () => active.cancelRequested,
          onPhase: (phase, detail) => this.setPhase(active, phase, phase === "AWAITING_USER" ? "AWAITING_USER" : "RUNNING", detail ?? null),
          manualAuthentication: { wait: (challenge) => this.waitForPerson(active, challenge) },
          stepHandOver: { wait: (challenge) => this.waitForPerson(active, challenge) },
          applicationHealth: () => runner.health(),
          ...(identity && this.deps.sessions
            ? {
              session: {
                seeded: kept !== null,
                keep: async () => {
                  const captured = await session.captureStorageState();
                  if (captured) this.deps.sessions!.write(identity, captured);
                },
                discard: async () => {
                  this.deps.sessions!.delete(identity);
                  await session.clearStorageState();
                },
              },
            }
            : {}),
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
      ...(stopReason !== "TERMINAL_STATE_REACHED" && detail ? { detail } : {}),
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

  /**
   * What stands between this persona and being signed in, before anything is started.
   *
   * Only `PASSWORD` needs a form: `MANUAL` asks a person, and `SEEDED`/`API` bring their own session. For a
   * password persona the sign-in page has to have been confirmed by somebody and a fillable form found behind
   * it, and `prepareContract` already worked out which of those is true. Null when there is nothing in the way.
   */
  private signInShortfall(
    request: AutomatedRunRequest,
    prepared: PreparedContract,
  ): { code: AutomatedRunRefusal["code"]; title: string; message: string } | null {
    const persona = request.persona;
    if (!persona?.authenticated || persona.authMethod !== "PASSWORD") return null;
    // A session kept from an earlier run gets this persona in without a form at all.
    const identity = this.sessionIdentity({ request } as ActiveRun);
    if (identity && this.deps.sessions?.read(identity)) return null;
    if (prepared.login === "NOT_CONFIGURED") {
      return {
        code: "LOGIN_NOT_CONFIGURED",
        title: "Tell Tellann where your sign-in page is",
        message: `"${persona.name}" signs in with a saved password, and nothing has said which page your sign-in form is on. Set the sign-in page under "Where is the sign-in page?", then start the run again.`,
      };
    }
    if (prepared.login === "NO_FORM_FOUND") {
      return {
        code: "LOGIN_FORM_NOT_FOUND",
        title: "No sign-in form was found on that page",
        message: `Tellann could not find a form it can fill in the code behind your sign-in page, so "${persona.name}" has no way in. Check the page address, or set this persona to sign in another way — you can sign in yourself, supply a session, or have Tellann fetch one.`,
      };
    }
    return null;
  }

  /**
   * A session that comes from somewhere other than signing in: supplied outright by the persona, or fetched from
   * the application. Null when this persona signs in the ordinary way, in which case nothing here applies.
   *
   * The fetch happens here, after the application is up and before the browser opens, because that is the only
   * moment when both are true. It is reported as a run that could not get a session — never as a finding about
   * the application, which did nothing wrong by refusing one.
   */
  private async suppliedSession(active: ActiveRun): Promise<{ ok: true; storageState: string; token?: string } | { ok: false; detail: string } | null> {
    const persona = active.request.persona;
    const targetUrl = active.request.start.targetUrl;
    if (persona?.authMethod === "SEEDED") {
      const seed = persona.sessionSeed;
      if (!seed || (seed.cookies.length === 0 && seed.storage.length === 0)) {
        return { ok: false, detail: `"${persona.name}" is set to use a session you supply, and none is saved for it.` };
      }
      return { ok: true, storageState: JSON.stringify(storageStateFromSeed(seed, targetUrl)) };
    }
    if (persona?.authMethod === "API") {
      const apiLogin = persona.apiLogin;
      if (!apiLogin) {
        return { ok: false, detail: `"${persona.name}" is set to fetch its session from your application, and no request is saved for it.` };
      }
      const fetched = await fetchApiSession(apiLogin, persona, targetUrl, this.deps.fetchSession);
      return fetched.ok
        ? { ok: true, storageState: JSON.stringify(fetched.storageState), token: fetched.token }
        : { ok: false, detail: fetched.detail };
    }
    return null;
  }

  /**
   * What a kept session belongs to: one application, one persona, one address. A persona that never signs in has
   * no session (there is nothing to sign in as), and nor does a run without one.
   */
  private sessionIdentity(active: ActiveRun): { applicationId: string; personaId: string; origin: string } | null {
    const persona = active.request.persona;
    if (!persona?.authenticated) return null;
    try {
      return {
        applicationId: active.request.start.applicationId,
        personaId: persona.id,
        origin: new URL(active.request.start.targetUrl).origin,
      };
    } catch {
      return null;
    }
  }

  // -- the pieces the executor is given ---------------------------------------

  private waitForPerson(active: ActiveRun, challenge: { kind: string; detail: string }): Promise<"DONE" | "CANCELLED" | "TIMED_OUT"> {
    // Approving a step happens here, in Tellann. Signing in, or doing a step by hand, happens in the browser the run
    // opened: that is where the person is sent, and what they type there is not recorded.
    const inBrowser = challenge.kind !== "CONFIRM_STEP";
    const title = challenge.kind === "CONFIRM_STEP" ? "Tellann needs your approval" : challenge.kind === "MANUAL_STEP" ? "Tellann needs you to do a step" : "Tellann needs you to sign in";
    const waitMs = this.deps.manualWaitMs ?? DEFAULT_MANUAL_WAIT_MS;
    return new Promise((resolve) => {
      // One reminder before giving up. Somebody who stepped away and comes back to find the run gone has lost
      // the whole thing for the sake of a minute, and a run that waits silently gives them no way to know it is
      // still there. So the deadline nudges once and waits again, and only then stops.
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      let remindersLeft = MANUAL_WAIT_REMINDERS;
      const onDeadline = () => {
        if (remindersLeft > 0 && !active.cancelRequested && !active.browserGone) {
          remindersLeft -= 1;
          this.host.notify({ title, body: `Still waiting. ${challenge.detail}` });
          this.addEvent(active, { type: "AWAITING_USER", text: `Still waiting for you: ${challenge.detail}`, tone: "notice" });
          timers.push(setTimeout(onDeadline, waitMs));
          return;
        }
        finish("TIMED_OUT");
      };
      timers.push(setTimeout(onDeadline, waitMs));
      const finish = (outcome: "DONE" | "CANCELLED" | "TIMED_OUT") => {
        if (!active.wait) return;
        for (const timer of timers) clearTimeout(timer);
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
      ...(driver.measureViewports ? { measureViewports: (breakpoints) => driver.measureViewports!(breakpoints) } : {}),
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
    case "ANALYSIS_STALE": return "Analyse your code again first";
  }
}

/** The first line of an error's message and never its stack: it is shown to a person and stored with a report. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split(/\r?\n/)[0] ?? "").slice(0, 300);
}
