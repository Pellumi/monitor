/**
 * View model for the Automated Run section of a QA report.
 *
 * Kept free of React so the wording — which is the part that matters — is testable: this is where a
 * run that stopped short is described, and the difference between "the application prevented
 * this" and "the run never got there" must survive all the way to the screen (QRS-RUN-007).
 */

export type AutomatedSection = {
  pinned: {
    flowVersionId: string | null;
    initialStateKey: string | null;
    targetTerminalStateKey: string | null;
    executionProfileId: string | null;
    testPersonaId: string | null;
    runDataSetId: string | null;
    codeSnapshotId: string | null;
    instrumentationManifestVersion: string | null;
    /** Which contract the run was compiled into, by hash and counts. Absent on a run from before this was recorded. */
    contract?: { hash: string; states: number; transitions: number; controlsDerived: number; controlsMissing: number; anchored: number } | null;
  };
  outcome: {
    stopReason: string | null;
    kind: "SUCCESS" | "APPLICATION" | "INFRASTRUCTURE" | "USER" | null;
    reachedTarget: boolean;
    detail: string | null;
    steps: number | null;
    replans: number | null;
  };
  states: Array<{
    sequence: number;
    stateKey: string;
    confidence: "HIGH" | "MEDIUM" | "LOW" | null;
    scope: "PRE_BOUNDARY" | "IN_FLOW";
    route: string | null;
    durationMs: number | null;
    action: {
      label: string | null; actionClass: string | null; verified: boolean | null; error: string | null;
      /** How hard the control was to find, and how long the page took. Absent on a run from before this was kept. */
      method?: string | null;
      candidates?: number | null;
      unusable?: number | null;
      attempt?: number | null;
      settledMs?: number | null;
      ease?: "EASY" | "NO_STABLE_IDENTITY" | "AMONG_LOOKALIKES" | "HIDDEN_OR_DISABLED" | "NEEDED_RETRY" | "SLOW_TRANSITION" | null;
      /** What the Flow said the step causes, against what the page did. */
      effects?: Array<{ method: string; route: string; expectedStatus: number | null; outcome: "MATCHED" | "STATUS_MISMATCH" | "NOT_OBSERVED"; observedStatus: number | null }>;
    } | null;
    errorCount: number;
  }>;
  preBoundaryStateCount: number;
  inFlowStateCount: number;
  unreachedStates: Array<{ stateKey: string; status: "BLOCKED_BY_APPLICATION" | "NOT_ATTEMPTED"; detail: string | null }>;
  reconciliation: Record<string, number>;
  /** Absent on reports built before code evidence existed. */
  codeEvidence?: Array<{
    subject: { kind: "TRANSITION" | "STATE"; id: string };
    stateKey: string | null;
    derivation: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED";
    refs: Array<{ file: string; symbol: string | null; startLine: number | null; endLine: number | null; excerptSha256: string | null }>;
    summary: string;
    at: string;
  }>;
  retainedTraces?: Array<{ stateKey: string | null; reasons: string[]; at: string }>;
  /** Present only when the run opted in to render timing. */
  renderTiming?: Array<{ component: string; states: string[]; mounts: number; updates: number; totalMs: number; maxMs: number }>;
  /** Computed by the worker for every automated run; absent only on a report built before it was shown. */
  blockedActions?: Array<{ reason: string; transitionId: string | null; detail: string | null; at: string }>;
  /** What is wrong with the Flow as a person would meet it. A null `stateKey` is about the Flow's shape. */
  uiQuality?: Array<{
    rule: string;
    severity: "LOW" | "MEDIUM";
    stateKey: string | null;
    breakpoint: string | null;
    detail: string;
    recommendation: string | null;
  }>;
  /** How each state measured at each window size, including the sizes that were clear. */
  responsive?: Array<{
    stateKey: string;
    samples: Array<{
      name: string; width: number; height: number;
      horizontalOverflowPx: number;
      smallestTextPx: number | null;
      smallestTapTargetPx: number | null;
      controlsChecked: number;
    }>;
  }>;
  /** What the run could not measure or cover, said rather than left as a silent absence. */
  limitations?: string[];
  /** The report's own lead. Built from the numbers below it; no part of it is written by a model. */
  summary?: {
    headline: string;
    reached: number;
    declared: number;
    furthestStateKey: string | null;
    priorities: string[];
  } | null;
};

export const MODE_LABELS: Record<string, string> = {
  GUIDED: "Guided",
  ASSISTED: "Assisted",
  OBSERVATION_ONLY: "Observation only",
  AUTOMATED: "Automated",
};

/** What each mode means for an absence of evidence, per DDM-MODE-001/002. */
export const MODE_MEANINGS: Record<string, string> = {
  GUIDED: "A person walked the declared Flow; what they did not do is not evidence about the application.",
  ASSISTED: "A person explored freely; states they did not visit say nothing about whether they exist.",
  OBSERVATION_ONLY: "Nothing was driven; this shows only what happened while the application was used.",
  AUTOMATED: "Tellann performed the declared Flow itself. A state it did not reach is only a finding about the application if the run says the application prevented it.",
};

export function modeLabel(mode: string | null | undefined): string {
  return mode ? MODE_LABELS[mode] ?? mode : "Not recorded";
}

const STOP_REASON_LABELS: Record<string, string> = {
  TERMINAL_STATE_REACHED: "Reached the target state",
  INITIAL_STATE_UNREACHABLE: "Could not reach the Flow's starting state",
  TERMINAL_STATE_UNREACHABLE: "No declared route leads to the target",
  EXPECTED_TRANSITION_NOT_FOUND: "A declared control was not on the page",
  TRANSITION_DID_NOT_ADVANCE: "An action was performed but the next state did not follow",
  STATE_RECOGNITION_AMBIGUOUS: "The page could not be matched to a single state",
  AUTHENTICATION_FAILED: "The persona could not log in",
  AUTHORIZATION_BLOCKED: "The persona is not permitted on this route",
  TEST_DATA_UNAVAILABLE: "The run data set is missing a value the Flow needs",
  APPLICATION_START_FAILED: "The application would not start",
  APPLICATION_CRASHED: "The application crashed during the run",
  BROWSER_CRASHED: "The browser crashed during the run",
  NETWORK_FAILURE: "The network failed during the run",
  UNSAFE_ACTION_BLOCKED: "The run refused an action its safety policy forbids",
  MAX_STEPS_EXCEEDED: "The run reached its step limit",
  MAX_DURATION_EXCEEDED: "The run reached its time limit",
  LOOP_DETECTED: "The run was going in circles",
  CANCELLED_BY_USER: "Stopped by the user",
  AUTOMATION_ENGINE_ERROR: "Tellann's own automation failed",
  MANUAL_AUTHENTICATION_REQUIRED: "Signing in needed a person",
  FRAMEWORK_NOT_YET_SUPPORTED: "This kind of application is not supported yet",
  FLOW_REQUIREMENTS_NOT_MET: "The run did not meet what the Flow needs",
  MANUAL_ACTION_REQUIRED: "A step needed a person",
};

/** For the two stops that are neither a finding nor a fault of ours, what actually happened, in words that do not blame anyone. */
const USER_STOP_EXPLANATIONS: Record<string, string> = {
  MANUAL_AUTHENTICATION_REQUIRED: "Signing in needed a person (single sign-on, a one-time code or a CAPTCHA) and it was not completed. Nothing here says anything about the application.",
  FRAMEWORK_NOT_YET_SUPPORTED: "Automated Run does not yet read this kind of application. It is coming soon, and Guided or Assisted runs work in the meantime. Nothing here says anything about the application.",
  FLOW_REQUIREMENTS_NOT_MET: "The Flow declares an account, an environment or data that this run was not given, so nothing was done. Nothing here says anything about the application.",
  MANUAL_ACTION_REQUIRED: "The Flow marks a step as needing a person, and it was not answered. Nothing here says anything about the application.",
};

export type OutcomeTone = "success" | "application" | "infrastructure" | "neutral";

/** Who is responsible for a run that stopped short. An infrastructure failure must never read as a finding about the application. */
export function outcomeSummary(section: AutomatedSection): { headline: string; explanation: string; tone: OutcomeTone } {
  const { outcome } = section;
  const headline = (outcome.stopReason && STOP_REASON_LABELS[outcome.stopReason]) ?? "Outcome not recorded";
  if (outcome.reachedTarget) {
    return { headline, tone: "success", explanation: `Every declared step to ${section.pinned.targetTerminalStateKey ?? "the target"} was performed and the expected state followed.` };
  }
  switch (outcome.kind) {
    case "APPLICATION":
      return { headline, tone: "application", explanation: outcome.detail ?? "The application did not behave as the declared Flow describes, so the run could not continue." };
    case "INFRASTRUCTURE":
      return { headline, tone: "infrastructure", explanation: "This was a failure of the run itself, not a finding about the application. Nothing here shows the Flow is broken." };
    case "USER":
      return { headline, tone: "neutral", explanation: (outcome.stopReason && USER_STOP_EXPLANATIONS[outcome.stopReason]) ?? "The run was stopped before it finished; states it did not reach say nothing about the application." };
    default:
      return { headline, tone: "neutral", explanation: "The run did not record why it ended." };
  }
}

export function unreachedLabel(status: "BLOCKED_BY_APPLICATION" | "NOT_ATTEMPTED"): string {
  return status === "BLOCKED_BY_APPLICATION" ? "Prevented by the application" : "Not attempted";
}

export function durationText(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1_000 ? `${ms} ms` : `${(ms / 1_000).toFixed(1)} s`;
}

export function pinnedRows(section: AutomatedSection): Array<[string, string]> {
  const { pinned } = section;
  const row = (label: string, value: string | null): [string, string] => [label, value ?? "Not recorded"];
  return [
    row("Flow version", pinned.flowVersionId),
    row("Starting state", pinned.initialStateKey),
    row("Target state", pinned.targetTerminalStateKey),
    row("Execution profile", pinned.executionProfileId),
    row("Test persona", pinned.testPersonaId),
    row("Run data set", pinned.runDataSetId),
    row("Code snapshot", pinned.codeSnapshotId),
    row("Instrumentation", pinned.instrumentationManifestVersion),
    row("Executable contract", pinned.contract ? `${pinned.contract.hash.slice(0, 12)} · ${pinned.contract.controlsDerived} of ${pinned.contract.transitions} steps had a control derived from the code${pinned.contract.anchored ? `, ${pinned.contract.anchored} anchored` : ""}` : null),
  ];
}

const RECONCILIATION_LABELS: Record<string, string> = {
  AUTHORIZATION_MISMATCH: "Explained by the persona's role",
  DATA_PRECONDITION_FAILURE: "Explained by missing test data",
  IMPLEMENTATION_MISMATCH: "The code does not match the Flow",
  DECLARATION_MISMATCH: "The code does something other than declared",
};

export function reconciliationRows(section: AutomatedSection): Array<[string, number]> {
  return Object.entries(section.reconciliation)
    .filter(([, count]) => count > 0)
    .map(([key, count]): [string, number] => [RECONCILIATION_LABELS[key] ?? key, count]);
}

const ANOMALY_LABELS: Record<string, string> = {
  LOW_CONFIDENCE: "the page was only a weak match for the state",
  AMBIGUOUS_STATE: "more than one state fit the page",
  UNRECOGNISED_STATE: "the page matched no declared state",
  ACTION_DID_NOT_ADVANCE: "an action did not lead anywhere",
  UNEXPECTED_STATE: "an action led to a different state than declared",
  RUNTIME_ERRORS: "the page raised errors",
  ACTION_BLOCKED: "an action was refused or its control was missing",
  RUN_STOPPED_SHORT: "the run stopped before the target",
  RUN_ENDED: "the run ended here",
};

export function anomalyText(reason: string): string {
  return ANOMALY_LABELS[reason] ?? reason;
}

function lineRange(ref: { startLine: number | null; endLine: number | null }): string {
  if (!ref.startLine) return "";
  return ref.endLine && ref.endLine !== ref.startLine ? `:${ref.startLine}-${ref.endLine}` : `:${ref.startLine}`;
}

/**
 * What the code says about each step that failed. Locations only: the source itself stays on the
 * machine that ran the test, and the report says so rather than leaving a reader to wonder.
 */
export function codeEvidenceEntries(section: AutomatedSection): Array<{ key: string; heading: string; summary: string; locations: string[]; caveat: string | null }> {
  return (section.codeEvidence ?? []).map((entry, index) => ({
    key: `${entry.subject.kind}:${entry.subject.id}:${index}`,
    heading: entry.subject.kind === "TRANSITION" ? `Transition ${entry.subject.id}` : `State ${entry.subject.id}`,
    summary: entry.summary,
    locations: entry.refs.map((ref) => `${ref.symbol ? `${ref.symbol} — ` : ""}${ref.file}${lineRange(ref)}`),
    caveat: entry.derivation === "RESOLVED" ? null : `The mapping to code is ${entry.derivation.toLowerCase()}; treat this as a lead.`,
  }));
}

/** Where a diagnostic trace was kept, and why. A run that went to plan keeps none. */
export function retainedTraceRows(section: AutomatedSection): Array<[string, string]> {
  return (section.retainedTraces ?? []).map((trace): [string, string] => [
    trace.stateKey ?? "Before the first state",
    trace.reasons.length > 0 ? trace.reasons.map(anomalyText).join("; ") : "something went wrong here",
  ]);
}

/** Render cost of the components the run was asked to watch, worst first. Empty unless it opted in. */
export function renderTimingRows(section: AutomatedSection): Array<{ component: string; states: string; renders: string; total: string; worst: string }> {
  return [...(section.renderTiming ?? [])]
    .sort((a, b) => b.totalMs - a.totalMs)
    .map((sample) => ({
      component: sample.component,
      states: sample.states.length > 0 ? sample.states.join(", ") : "not mapped to a state",
      renders: `${sample.mounts} mount${sample.mounts === 1 ? "" : "s"}, ${sample.updates} update${sample.updates === 1 ? "" : "s"}`,
      total: `${sample.totalMs} ms`,
      worst: `${sample.maxMs} ms`,
    }));
}

/** How hard a step was to get at. `EASY` has no row: it is the ordinary case, and saying so is noise. */
const EASE_LABELS: Record<string, string> = {
  NO_STABLE_IDENTITY: "the control had nothing but its visible text to identify it",
  AMONG_LOOKALIKES: "the control was one of several that read the same",
  HIDDEN_OR_DISABLED: "a matching control was hidden or disabled",
  NEEDED_RETRY: "the control did not respond the first time",
  SLOW_TRANSITION: "the step took a visible while to take effect",
};

/** Past this, somebody waiting for a step to take effect notices the wait. Below it, saying so is noise. */
const NOTICEABLE_WAIT_MS = 1_000;

/** What to say beside a step about how hard it was to get at, or null when it was unremarkable. */
export function easeText(action: AutomatedSection["states"][number]["action"]): string | null {
  if (!action) return null;
  const parts = [
    action.ease && action.ease !== "EASY" ? EASE_LABELS[action.ease] ?? null : null,
    typeof action.settledMs === "number" && action.settledMs >= NOTICEABLE_WAIT_MS ? `waited ${durationText(action.settledMs)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Requests the Flow declares a step causes that did not happen as declared.
 *
 * Only the ones that went wrong: a request that happened exactly as declared is the Flow working, and a table of
 * those is a table nobody reads. One that never happened is the application quietly no longer doing what the
 * Flow says it does, which is among the most useful things a run can find.
 */
export function effectRows(section: AutomatedSection): Array<{ key: string; request: string; where: string; outcome: string }> {
  return section.states.flatMap((state) =>
    (state.action?.effects ?? [])
      .filter((effect) => effect.outcome !== "MATCHED")
      .map((effect, index) => ({
        key: `${state.sequence}:${effect.method}:${effect.route}:${index}`,
        request: `${effect.method} ${effect.route}`,
        where: `${state.stateKey} · ${state.action?.label ?? "step"}`,
        outcome: effect.outcome === "NOT_OBSERVED"
          ? "Declared for this step and never happened"
          : `Answered ${effect.observedStatus ?? "something else"} rather than ${effect.expectedStatus ?? "what was declared"}`,
      })));
}

const UI_QUALITY_LABELS: Record<string, string> = {
  TEXT_TOO_SMALL: "Text too small to read comfortably",
  TAP_TARGET_TOO_SMALL: "Control too small to tap",
  LOW_CONTRAST: "Text does not stand out enough from its background",
  WRONG_BUTTON_WEIGHT: "The action with consequences is the quiet one",
  NO_LOADING_AFFORDANCE: "The page said nothing while it was loading",
  REDUNDANT_STEP: "A step that asks nothing of anybody",
  DEAD_END: "A state the Flow cannot be continued from",
  HORIZONTAL_OVERFLOW: "The page does not fit its window",
  CONTROL_UNREACHABLE_AT_SIZE: "A control this step needs is unreachable at this size",
};

export function uiQualityRows(section: AutomatedSection): Array<{
  key: string; title: string; where: string; detail: string; recommendation: string | null; severity: "LOW" | "MEDIUM";
}> {
  return (section.uiQuality ?? []).map((finding, index) => ({
    key: `${finding.rule}:${finding.stateKey ?? "flow"}:${index}`,
    title: UI_QUALITY_LABELS[finding.rule] ?? finding.rule.replaceAll("_", " ").toLowerCase(),
    // A finding with no state is about what somebody declared, not about a page they visited.
    where: [finding.stateKey ?? "the Flow itself", finding.breakpoint].filter(Boolean).join(" · "),
    detail: finding.detail,
    recommendation: finding.recommendation,
    severity: finding.severity,
  }));
}

/**
 * The state-by-size grid. Every size is a column, including the ones that were clear, because "checked and
 * clear" is the half of a responsiveness claim that is usually missing.
 */
export function responsiveGrid(section: AutomatedSection): { sizes: string[]; rows: Array<{ stateKey: string; cells: string[] }> } | null {
  const responsive = section.responsive ?? [];
  if (responsive.length === 0) return null;
  const sizes = [...new Set(responsive.flatMap((entry) => entry.samples.map((sample) => sample.name)))];
  const rows = responsive.map((entry) => {
    const byName = new Map(entry.samples.map((sample) => [sample.name, sample]));
    return {
      stateKey: entry.stateKey,
      cells: sizes.map((name) => {
        const sample = byName.get(name);
        if (!sample) return "—";
        const problems = [
          sample.horizontalOverflowPx > 4 ? `${sample.horizontalOverflowPx}px too wide` : null,
          sample.smallestTextPx !== null && sample.smallestTextPx < 12 ? `${sample.smallestTextPx}px text` : null,
          sample.smallestTapTargetPx !== null && sample.smallestTapTargetPx < 44 && sample.width <= 768
            ? `${sample.smallestTapTargetPx}px control`
            : null,
        ].filter(Boolean);
        return problems.length > 0 ? problems.join("; ") : "clear";
      }),
    };
  });
  return { sizes, rows };
}

export function blockedActionRows(section: AutomatedSection): Array<{ key: string; reason: string; step: string; detail: string }> {
  return (section.blockedActions ?? []).map((blocked, index) => ({
    key: `${blocked.reason}:${index}`,
    reason: blocked.reason.replaceAll("_", " ").toLowerCase(),
    step: blocked.transitionId ?? "no step recorded",
    detail: blocked.detail ?? "No detail recorded",
  }));
}

/**
 * Where an Automated run is, in the words somebody reads.
 *
 * A copy of the desktop's own wording rather than a shared import: the dashboard does not depend on the desktop
 * contracts package, and one record of eleven short strings is a smaller thing to keep in step than a dependency
 * from the web app onto the desktop. An unknown phase falls back to something true rather than to a constant.
 */
const EXECUTION_PHASES: Record<string, string> = {
  PREPARING_WORKSPACE: "Preparing the Flow",
  STARTING_APPLICATION: "Starting the application",
  LAUNCHING_BROWSER: "Opening the browser",
  BOOTSTRAPPING: "Getting ready",
  SEEKING_INITIAL_STATE: "Getting to where the Flow starts",
  AWAITING_USER: "Waiting for somebody at the desktop",
  EXECUTING_FLOW: "Running the Flow",
  VERIFYING_TERMINAL_STATE: "Confirming the result",
  FLUSHING_EVIDENCE: "Saving evidence",
  SHUTTING_DOWN: "Shutting down",
};

export function describeExecutionPhase(phase: string): string {
  return EXECUTION_PHASES[phase] ?? "Running";
}
