import {
  checkRunDataAvailability,
  materializeRunData,
  personaCredentialData,
  runAutomation,
  runDataPort,
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
import type { AutomationLimits, QA_AUTOMATION_EVENT_TYPES, RunDataSet, TestPersona } from "@tellann/desktop-contracts";
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

  // A run that cannot finish for want of data should say so before it touches the application.
  const materialized = materializeRunData(input.runData, now);
  const available = checkRunDataAvailability(input.contract, materialized);
  if (!available.ok) {
    record("QA_AUTOMATION_STOPPED", { stopReason: available.stopReason, detail: available.detail, steps: 0, replans: 0 });
    return { stopReason: available.stopReason, detail: available.detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  }

  // Everything this run will type is registered before anything is typed, so nothing it types is recorded.
  const credentials = personaCredentialDataValues(input.persona);
  input.browser.protectAutomationValues([
    ...credentials,
    ...[...materialized.values()].filter((value) => value.secret).map((value) => value.value),
  ]);

  const stop = (stopReason: AutomationResult["stopReason"], detail: string): AutomationResult => {
    record("QA_AUTOMATION_STOPPED", { stopReason, detail, steps: 0, replans: 0 });
    return { stopReason, detail, states: [], steps: 0, replans: 0, elapsedMs: now() - started };
  };

  // Getting to the Flow's first state is setup, not the Flow. It ends the run in ways the engine has no word for.
  const initial = input.contract.states.find((state) => state.key === input.contract.initialStateKey);
  const initialRoute = initial?.routePatterns[0];
  if (initialRoute && input.navigation) {
    const entered = await seekInitialState(
      { snapshot: () => input.driver.snapshot(), act: (action) => input.driver.act(action), settle: (expected) => input.driver.settle(expected) },
      input.navigation,
      initialRoute,
      input.environment,
      { persona: input.persona, policy: input.policy },
    );
    if (!entered.ok) return stop(entered.stopReason, entered.detail);
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

  const ports: AutomationPorts = {
    snapshot: () => input.driver.snapshot(),
    act: (action) => input.driver.act(action),
    settle: (expected) => input.driver.settle(expected),
    emit: (event) => { record(event.type, { ...event.data, engineAt: event.at }); },
    now,
    health: input.driver.health ? async () => input.driver.health!() : undefined,
    data: runDataPort(materialized),
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
  return runAutomation(ports, config);
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
