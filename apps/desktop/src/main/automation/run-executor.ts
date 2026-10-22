import {
  checkFlowRequirements,
  checkRunDataAvailability,
  materializeRunData,
  personaCredentialData,
  isEntryStep,
  resolveRunData,
  routeMatches,
  runAutomation,
  seekInitialState,
  selectRenderTimingTargets,
  statesByComponent,
} from "@tellann/automation-engine";
import type {
  AmbiguityResolver,
  AutomationConfig,
  AutomationPorts,
  AutomationResult,
  Breakpoint,
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
  /**
   * Raise what the engine found wrong with the Flow as a person would meet it. Absent on an observer that does
   * not keep findings, in which case the evidence event is the only record and the report still shows it.
   */
  raiseUiQualityFindings?(findings: Array<{
    rule: string; severity: "LOW" | "MEDIUM"; stateKey: string | null; breakpoint: string | null;
    detail: string; recommendation: string | null;
  }>): number;
}

/** What drives the page: the browser adapter's half of the engine's ports. */
export type PageDriver = Pick<AutomationPorts, "snapshot" | "act" | "settle" | "measureViewports">
  & { health?(): "OK" | "BROWSER_CRASHED" | Promise<"OK" | "BROWSER_CRASHED"> };

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

/**
 * The signed-in browser session, kept between runs so a sign-in only a person can do is only done once.
 *
 * Absent for a persona that never signs in, and for a run with no persona at all: there is then nothing to
 * keep and nothing to reuse. The store itself lives in `session-store.ts`; this is only what a run does with it.
 */
export interface BrowserSessionPort {
  /** Whether this run's browser started from a stored session rather than empty. */
  seeded: boolean;
  /** Keep what the browser is signed in as now, for the next run. Best effort: losing it only costs a sign-in. */
  keep(): Promise<void>;
  /** The stored session did not work: forget it, and clear it out of the live browser so the retry starts clean. */
  discard(): Promise<void>;
}

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
  /** The window sizes each state is re-measured at. Empty turns the sweep off. */
  responsiveBreakpoints?: Breakpoint[];
  /**
   * Breaks the two ties the engine refuses to guess at, when neither the code nor the rendered page could.
   * Absent — which is the default — means the run stops at such a tie, exactly as it always has. Whatever it
   * suggests is still verified against the contract before anything is done (`verifyControlProposal`).
   */
  resolver?: AmbiguityResolver;
  screenAnalysis?: AutomationPorts['screenAnalysis'];
  cancelled?: () => boolean;
  /** Told where the run is, for the live view and the platform. Must not throw into the run. */
  onPhase?: (phase: AutomationExecutionPhase, detail?: { kind: string; detail: string } | null) => void;
  manualAuthentication?: ManualAuthenticationPort;
  /** The signed-in session kept between runs. Absent means every run signs in from nothing. */
  session?: BrowserSessionPort;
  /** Who is asked about steps the Flow marks CONFIRM or MANUAL. Defaults to whoever is asked to sign in; absent means nobody, and such a step stops the run. */
  stepHandOver?: StepHandOverPort;
  /** The supervised application's own health, folded into the run's: an application that dies mid-run is APPLICATION_CRASHED. */
  applicationHealth?: () => "OK" | "APPLICATION_CRASHED";
  now?: () => number;
}

export type EventType = (typeof QA_AUTOMATION_EVENT_TYPES)[number];

export async function executeAutomatedRun(input: AutomatedRunInput): Promise<AutomationResult> {
  const now = input.now ?? (() => Date.now());
  const started = now();
  let stopRecorded = false;
  const record = (type: EventType, data: Record<string, unknown>) => {
    if (type === "QA_AUTOMATION_STOPPED") stopRecorded = true;
    input.browser.recordAutomationEvent(type, { ...data, at: now() });
    // A problem with the Flow as a person would meet it is a finding about the product, in the same way a
    // failing accessibility rule is — so it goes into the findings alongside them, not only into the report.
    if (type === "QA_AUTOMATION_UI_QUALITY" && Array.isArray(data.findings)) {
      try {
        input.browser.raiseUiQualityFindings?.(data.findings as Parameters<NonNullable<ManagedBrowser["raiseUiQualityFindings"]>>[0]);
      } catch {
        // The evidence event is already recorded; losing the finding row must not disturb the run.
      }
    }
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
    // A session kept from an earlier run means the browser may already be signed in, in which case the entry
    // planner must not route through the login edge. If it turns out not to be — the session expired, or the
    // application revoked it — that is found out here, and the one honest response is to throw it away and sign
    // in from nothing. Exactly once: a second failure is about the sign-in, not about the session that was kept.
    let seeded = input.session?.seeded ?? false;
    for (let attempt = 0; ; attempt += 1) {
      const walked = await walkToInitialState(input, initialRoute, record, seeded);
      if (walked.ok) {
        // Re-captured after every successful entry, not only after a sign-in: it picks up the cookies the
        // application rotated on the way in, and its age then measures when the session last actually worked.
        await input.session?.keep().catch(() => undefined);
        break;
      }
      if (seeded && attempt === 0) {
        record("QA_AUTOMATION_SESSION_DISCARDED", { stopReason: walked.stopReason, detail: walked.detail });
        await input.session?.discard().catch(() => undefined);
        seeded = false;
        phase(input, "SEEKING_INITIAL_STATE");
        continue;
      }
      return stop(walked.stopReason, await explainEntryFailure(input, initial, initialRoute, walked));
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
    ...(diagnostics.inspectPage ? { inspectPage: diagnostics.inspectPage } : {}),
    ...(input.resolver ? { resolver: input.resolver } : {}),
    ...(input.screenAnalysis ? { screenAnalysis: input.screenAnalysis } : {}),
    // Offered only when the browser can actually do it; the engine then only asks if a run named any sizes.
    ...(input.driver.measureViewports ? { measureViewports: (breakpoints) => input.driver.measureViewports!(breakpoints) } : {}),
  };
  const config: AutomationConfig = {
    contract: input.contract,
    targetStateKey: input.targetStateKey,
    environment: input.environment,
    applicationOrigin: input.applicationOrigin,
    limits: input.limits,
    policy: input.policy,
    ...(input.responsiveBreakpoints ? { responsiveBreakpoints: input.responsiveBreakpoints } : {}),
  };
  phase(input, "EXECUTING_FLOW");
  return runAutomation(ports, config);
}

export type EntryOutcome = { ok: true } | { ok: false; stopReason: AutomationResult["stopReason"]; detail: string };

/**
 * Turns the otherwise accurate but unhelpful "no route" entry-planner result into the setup problem a person
 * can actually fix. A Flow can declare a synthetic first state (for example GUEST) followed by OPEN_APP, while
 * the managed browser opens directly on the next real page (for example /login). In that case credentials were
 * never rejected: the run stopped before it reached the sign-in transition. Keep every other entry failure as-is.
 */
async function explainEntryFailure(
  input: AutomatedRunInput,
  initial: ExecutableContract["states"][number] | undefined,
  initialRoute: string,
  walked: Exclude<EntryOutcome, { ok: true }>,
): Promise<string> {
  if (walked.stopReason !== "INITIAL_STATE_UNREACHABLE" || !initial) return walked.detail;

  let path: string;
  let sdkStates: string[];
  try {
    const snapshot = await input.driver.snapshot();
    path = snapshot.path;
    sdkStates = snapshot.sdkStates;
  } catch {
    return walked.detail;
  }

  const reached = input.contract.states.filter((candidate) =>
    candidate.key !== initial.key
    && (candidate.routePatterns.some((pattern) => routeMatches(pattern, path))
      || sdkStates.includes(candidate.key)
      || candidate.sdkStateSignals.some((signal) => sdkStates.includes(signal))),
  );
  if (reached.length !== 1) return walked.detail;

  const current = reached[0]!;
  const entry = input.contract.transitions.find((transition) =>
    transition.from === initial.key
    && transition.to === current.key
    && isEntryStep(input.contract, transition),
  );
  if (!entry) return walked.detail;

  const currentName = current.name || current.key;
  const initialName = initial.name || initial.key;
  const initialLocation = initialRoute ? ` (${initialRoute})` : "";
  const entryName = entry.action ? `“${entry.action}”` : "the application-entry step";
  return `Tellann opened ${path} and recognised it as ${currentName}, but this Flow is configured to start at ${initialName}${initialLocation}. `
    + `The run stopped before ${entryName}, so it did not attempt to sign in. `
    + `Make ${currentName} the Flow's initial state, or update and initialise the Flow again so its entry path matches the page the application opens.`;
}

/**
 * The walk from wherever the browser starts to the Flow's initial state, including the sign-in and every
 * hand-over to a person it may need along the way.
 *
 * Separate from `execute` because it is attempted twice in one case: once with the session an earlier run kept,
 * and, if that session turns out to be no good, once more without it. Everything inside is therefore written to
 * be safely repeatable — it types credentials, asks a person, and plans routes, but it keeps no state of its own
 * between calls, so the second attempt is a genuinely fresh one.
 *
 * `sessionAuthenticated` says the browser is believed to be signed in already, which is what keeps the planner
 * from routing through a login form it does not need.
 */
export async function walkToInitialState(
  input: AutomatedRunInput,
  initialRoute: string,
  record: (type: EventType, data: Record<string, unknown>) => void,
  sessionAuthenticated: boolean,
): Promise<EntryOutcome> {
  phase(input, "SEEKING_INITIAL_STATE");
  const entryPorts = {
    snapshot: () => input.driver.snapshot(),
    act: (action: Parameters<PageDriver["act"]>[0]) => input.driver.act(action),
    settle: (expected: string | null) => input.driver.settle(expected),
  };
  let signedInByPerson = false;
  for (let handOvers = 0; ; handOvers += 1) {
    const entered = await seekInitialState(entryPorts, input.navigation!, initialRoute, input.environment, {
      persona: input.persona,
      policy: input.policy,
      applicationOrigin: input.applicationOrigin,
      // Already signed in — whether by a person just now, or by a session kept from an earlier run — so the
      // persona's stored credentials are not typed on top of a session that is already somebody's.
      ...(signedInByPerson || sessionAuthenticated ? { sessionAuthenticated: true, manualAuthentication: false } : {}),
    });
    if (entered.ok) return { ok: true };
    if (entered.stopReason !== "MANUAL_AUTHENTICATION_REQUIRED" || !entered.challenge) return { ok: false, stopReason: entered.stopReason, detail: entered.detail };
    if (!input.manualAuthentication) return { ok: false, stopReason: entered.stopReason, detail: entered.detail };
    if (handOvers >= MAX_MANUAL_HAND_OVERS) {
      return {
        ok: false, stopReason: "MANUAL_AUTHENTICATION_REQUIRED",
        detail: "The sign-in kept asking for more than a person's help could clear, so the run stopped rather than wait on it again.",
      };
    }

    const challenge = { kind: entered.challenge.kind, detail: entered.challenge.detail };
    record("QA_AUTOMATION_MANUAL_ACTION_REQUIRED", { kind: challenge.kind, detail: challenge.detail });
    phase(input, "AWAITING_USER", challenge);
    const outcome = await waitForPerson(input.manualAuthentication, challenge, input.cancelled);
    record("QA_AUTOMATION_MANUAL_ACTION_COMPLETED", { kind: challenge.kind, outcome });
    if (outcome === "CANCELLED") return { ok: false, stopReason: "CANCELLED_BY_USER", detail: "The run was cancelled while it waited for you to sign in." };
    if (outcome === "TIMED_OUT") return { ok: false, stopReason: "MANUAL_AUTHENTICATION_REQUIRED", detail: "Nobody finished signing in before the wait ended, so the run stopped." };
    signedInByPerson = true;
    phase(input, "SEEKING_INITIAL_STATE");
  }
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
export function personaCredentialDataValues(persona: TestPersona | null): string[] {
  if (!persona) return [];
  const lookup = personaCredentialData(persona);
  return persona.credentials.flatMap((credential) => {
    const value = lookup(credential.field)?.value;
    return value ? [value] : [];
  });
}
