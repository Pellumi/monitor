import {
  checkFlowRequirements,
  checkRunDataAvailability,
  materializeRunData,
  personaCredentialData,
  resolveRunData,
  runAutomation,
  seekInitialState,
  selectRenderTimingTargets,
  statesByComponent,
} from "@tellann/automation-engine";
import type {
  AutomationConfig,
  AutomationPorts,
  AutomationResult,
  CodeEvidenceSource,
  EnvironmentKind,
  ExecutableContract,
  NavigationGraph,
  PolicyOptions,
} from "@tellann/automation-engine";
import type { AutomationExecutionPhase, AutomationLimits, QA_AUTOMATION_EVENT_TYPES, RunDataSet, TestPersona } from "@tellann/desktop-contracts";
import { createDiagnosticsPorts } from "./diagnostics-ports";
import type { DiagnosticsObserver } from "./diagnostics-ports";

/**
 * One Automated Run, start to finish, over an already-launched managed browser.
 *
 * This is the composition and nothing more: it checks the run data, tells the observer which values
 * must never be recorded, walks to the Flow's initial state (login included), then hands the Flow
 * itself to the engine with the diagnostics wired in. Launching the application, the browser and the
 * cloud run record belong to whoever calls it (the run manager); which decisions to make belongs to the
 * engine. What is left here is the order things must happen in, and the two places a run can end that the
 * engine never sees: before it starts (missing data) and while getting to where it starts (a login that
 * fails, a route the persona is not allowed on).
 */

export interface ManagedBrowser extends DiagnosticsObserver {
  protectAutomationValues(values: string[]): void;
}

/** What drives the page: the browser adapter's half of the engine's ports. */
export type PageDriver = Pick<AutomationPorts, "snapshot" | "act" | "settle"> & { health?(): "OK" | "BROWSER_CRASHED" | Promise<"OK" | "BROWSER_CRASHED"> };

/**
 * How a person is asked to do the part of getting in that the run must not do (single sign-on, a code sent to a phone,
 * a CAPTCHA). The run pauses on `wait` and carries on only when it settles; it never types into, or tries to get past, what
 * it handed over. Absent means nobody is there to ask, and the run stops with MANUAL_AUTHENTICATION_REQUIRED instead.
 */
export interface ManualAuthenticationPort {
  wait(challenge: { kind: string; detail: string }): Promise<"DONE" | "CANCELLED" | "TIMED_OUT">;
}

/**
 * The same person, asked about a step instead of a sign-in: to approve a step the Flow marks CONFIRM, or to do one it
 * marks MANUAL. It is the one way a run pauses for a person, so it is the same port.
 */
export type StepHandOverPort = ManualAuthenticationPort;

/** A person may be asked more than once (single sign-on, then a code). Past this it is a loop, not a sign-in. */
export const MAX_MANUAL_HAND_OVERS = 3;

export interface AutomatedRunInput {
  browser: ManagedBrowser;
  driver: PageDriver;
  contract: ExecutableContract;
  /** The application's navigation graph, for getting from wherever the browser starts to the Flow's initial state. */
  navigation: NavigationGraph | null;
  persona: TestPersona | null;
  runData: RunDataSet | null;
  targetStateKey: string;
  environment: EnvironmentKind;
  applicationOrigin: string;
  limits: AutomationLimits;
  policy?: PolicyOptions;
  /** The analysed code, so a failed step can be explained from it. */
  code?: CodeEvidenceSource | null;
  /** Opt-in: components of the Flow to time. Chosen from the contract, capped, and only installed when the run asked. */
  renderTimingComponents?: string[];
  cancelled?: () => boolean;
  /** Told where the run is, for the live view and the platform. Must not throw into the run. */
  onPhase?: (phase: AutomationExecutionPhase, detail?: { kind: string; detail: string } | null) => void;
  manualAuthentication?: ManualAuthenticationPort;
  /** Who is asked about steps the Flow marks CONFIRM or MANUAL. Defaults to whoever is asked to sign in; absent means nobody, and such a step stops the run. */
  stepHandOver?: StepHandOverPort;
  /** The supervised application's own health, folded into the run's: an application that dies mid-run is APPLICATION_CRASHED. */
  applicationHealth?: () => "OK" | "APPLICATION_CRASHED";
  now?: () => number;
}

type EventType = (typeof QA_AUTOMATION_EVENT_TYPES)[number];

export async function executeAutomatedRun(input: AutomatedRunInput): Promise<AutomationResult> {
  const now = input.now ?? (() => Date.now());
  const started = now();
  let stopRecorded = false;
  const record = (type: EventType, data: Record<string, unknown>) => {
    if (type === "QA_AUTOMATION_STOPPED") stopRecorded = true;
    input.browser.recordAutomationEvent(type, { ...data, at: now() });
  };

  try {
    return await execute(input, now, started, record);
  } catch (error) {
    // The browser or the driver failed underneath the run, in the entry walk or inside the loop. That is
    // never a finding about the application: end the run as a failure of Tellann's own machinery, and
    // say which kind, rather than let an exception escape past a run that has already touched the app.
    let health: "OK" | "BROWSER_CRASHED" | undefined;
    try { health = await input.driver.health?.(); } catch { health = "BROWSER_CRASHED"; }
    const stopReason = health === "BROWSER_CRASHED" ? "BROWSER_CRASHED" : "AUTOMATION_ENGINE_ERROR";
    const detail = stopReason === "BROWSER_CRASHED"
      ? "The managed browser closed while the run was in progress."
      : `The automation failed: ${firstLine(error)}`;
    if (!stopRecorded) record("QA_AUTOMATION_STOPPED", { stopReason, detail, steps: 0, replans: 0 });
    return { stopReason, detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  }
}

async function execute(
  input: AutomatedRunInput,
  now: () => number,
  started: number,
  record: (type: EventType, data: Record<string, unknown>) => void,
): Promise<AutomationResult> {

  // A run that cannot finish for want of what the Flow says it needs should say so before it touches the application:
  // first what the Flow declared (account, environment, data), then the data its inputs will type.
  const materialized = materializeRunData(input.runData, now);
  const requirements = checkFlowRequirements(input.contract, { environment: input.environment, persona: input.persona, materialized });
  if (!requirements.ok) {
    record("QA_AUTOMATION_STOPPED", { stopReason: requirements.stopReason, detail: requirements.detail, steps: 0, replans: 0 });
    return { stopReason: requirements.stopReason, detail: requirements.detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  }
  const available = checkRunDataAvailability(input.contract, materialized, input.persona);
  if (!available.ok) {
    record("QA_AUTOMATION_STOPPED", { stopReason: available.stopReason, detail: available.detail, steps: 0, replans: 0 });
    return { stopReason: available.stopReason, detail: available.detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  }
  // One resolver says where every typed value comes from (run data, made for this run, or the persona's sign-in),
  // and so which of them must never be recorded.
  const data = resolveRunData(input.contract, materialized, input.persona);

  // Everything this run will type is registered before anything is typed, so nothing it types is recorded.
  const credentials = personaCredentialDataValues(input.persona);
  input.browser.protectAutomationValues([
    ...credentials,
    ...[...materialized.values()].filter((value) => value.secret).map((value) => value.value),
    ...data.protectedValues,
  ]);

  const stop = (stopReason: AutomationResult["stopReason"], detail: string): AutomationResult => {
    record("QA_AUTOMATION_STOPPED", { stopReason, detail, steps: 0, replans: 0 });
    return { stopReason, detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  };

  // Getting to the Flow's first state is setup, not the Flow. It ends the run in ways the engine has no word for.
  const initial = input.contract.states.find((state) => state.key === input.contract.initialStateKey);
  const initialRoute = initial?.routePatterns[0];
  if (initialRoute && input.navigation) {
    phase(input, "SEEKING_INITIAL_STATE");
    const entryPorts = { snapshot: () => input.driver.snapshot(), act: (action: Parameters<PageDriver["act"]>[0]) => input.driver.act(action), settle: (expected: string | null) => input.driver.settle(expected) };
    let signedInByPerson = false;
    for (let handOvers = 0; ; handOvers += 1) {
      const entered = await seekInitialState(entryPorts, input.navigation, initialRoute, input.environment, {
        persona: input.persona,
        policy: input.policy,
        applicationOrigin: input.applicationOrigin,
        // Once a person has signed in, the session is theirs: the persona's stored credentials are not typed on top of it.
        ...(signedInByPerson ? { sessionAuthenticated: true, manualAuthentication: false } : {}),
      });
      if (entered.ok) break;
      if (entered.stopReason !== "MANUAL_AUTHENTICATION_REQUIRED" || !entered.challenge) return stop(entered.stopReason, entered.detail);
      if (!input.manualAuthentication) return stop(entered.stopReason, entered.detail);
      if (handOvers >= MAX_MANUAL_HAND_OVERS) {
        return stop("MANUAL_AUTHENTICATION_REQUIRED", "The sign-in kept asking for more than a person's help could clear, so the run stopped rather than wait on it again.");
      }

      const challenge = { kind: entered.challenge.kind, detail: entered.challenge.detail };
      record("QA_AUTOMATION_MANUAL_ACTION_REQUIRED", { kind: challenge.kind, detail: challenge.detail });
      phase(input, "AWAITING_USER", challenge);
      const outcome = await waitForPerson(input.manualAuthentication, challenge, input.cancelled);
      record("QA_AUTOMATION_MANUAL_ACTION_COMPLETED", { kind: challenge.kind, outcome });
      if (outcome === "CANCELLED") return stop("CANCELLED_BY_USER", "The run was cancelled while it waited for you to sign in.");
      if (outcome === "TIMED_OUT") return stop("MANUAL_AUTHENTICATION_REQUIRED", "Nobody finished signing in before the wait ended, so the run stopped.");
      signedInByPerson = true;
      phase(input, "SEEKING_INITIAL_STATE");
    }
  }

  const timing = input.renderTimingComponents && input.renderTimingComponents.length > 0
    ? statesByComponent(selectRenderTimingTargets(input.contract))
    : null;
  const diagnostics = createDiagnosticsPorts({
    observer: input.browser,
    contract: input.contract,
    code: input.code ?? null,
    renderTiming: timing,
  });

  const stepHandOver = input.stepHandOver ?? input.manualAuthentication;
  const ports: AutomationPorts = {
    snapshot: () => input.driver.snapshot(),
    act: (action) => input.driver.act(action),
    settle: (expected) => input.driver.settle(expected),
    emit: (event) => { record(event.type, { ...event.data, engineAt: event.at }); },
    now,
    health: input.driver.health || input.applicationHealth
      ? async () => {
          // The application first: a dead server makes every browser error that follows a symptom, and the reason is the server.
          if (input.applicationHealth?.() === "APPLICATION_CRASHED") return "APPLICATION_CRASHED" as const;
          return (await input.driver.health?.()) ?? "OK";
        }
      : undefined,
    data: data.port,
    handOver: stepHandOver
      ? async (request) => {
          const challenge = { kind: request.kind, detail: request.detail };
          record("QA_AUTOMATION_MANUAL_ACTION_REQUIRED", { kind: challenge.kind, detail: challenge.detail, transitionId: request.transitionId });
          phase(input, "AWAITING_USER", challenge);
          const outcome = await waitForPerson(stepHandOver, challenge, input.cancelled);
          record("QA_AUTOMATION_MANUAL_ACTION_COMPLETED", { kind: challenge.kind, outcome, transitionId: request.transitionId });
          phase(input, "EXECUTING_FLOW");
          return outcome;
        }
      : undefined,
    cancelled: input.cancelled,
    captureEvidence: diagnostics.captureEvidence,
    traceChunks: diagnostics.traceChunks,
  };
  const config: AutomationConfig = {
    contract: input.contract,
    targetStateKey: input.targetStateKey,
    environment: input.environment,
    applicationOrigin: input.applicationOrigin,
    limits: input.limits,
    policy: input.policy,
  };
  phase(input, "EXECUTING_FLOW");
  return runAutomation(ports, config);
}

/** Reporting where the run is never fails the run. */
function phase(input: AutomatedRunInput, executionPhase: AutomationExecutionPhase, detail: { kind: string; detail: string } | null = null): void {
  try { input.onPhase?.(executionPhase, detail); } catch { /* the live view is not the run */ }
}

/** Waits for a person, and stops waiting the moment the run is cancelled. */
async function waitForPerson(
  port: ManualAuthenticationPort,
  challenge: { kind: string; detail: string },
  cancelled: (() => boolean) | undefined,
): Promise<"DONE" | "CANCELLED" | "TIMED_OUT"> {
  try {
    const outcome = await port.wait(challenge);
    return cancelled?.() ? "CANCELLED" : outcome;
  } catch {
    return "CANCELLED";
  }
}

/** The first line of an error's message and never its stack, bounded: it goes into a report. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split(/\r?\n/)[0] ?? "").slice(0, 300);
}

/** Every credential value the persona will type, for registration as protected. */
function personaCredentialDataValues(persona: TestPersona | null): string[] {
  if (!persona) return [];
  const lookup = personaCredentialData(persona);
  return persona.credentials.flatMap((credential) => {
    const value = lookup(credential.field)?.value;
    return value ? [value] : [];
  });
}
