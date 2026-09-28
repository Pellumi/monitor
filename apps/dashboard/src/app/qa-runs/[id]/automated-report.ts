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
    action: { label: string | null; actionClass: string | null; verified: boolean | null; error: string | null } | null;
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
};

/** For the two stops that are neither a finding nor a fault of ours, what actually happened, in words that do not blame anyone. */
const USER_STOP_EXPLANATIONS: Record<string, string> = {
  MANUAL_AUTHENTICATION_REQUIRED: "Signing in needed a person (single sign-on, a one-time code or a CAPTCHA) and it was not completed. Nothing here says anything about the application.",
  FRAMEWORK_NOT_YET_SUPPORTED: "Automated Run does not yet read this kind of application. It is coming soon, and Guided or Assisted runs work in the meantime. Nothing here says anything about the application.",
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
