import type { AutomationStopReason } from '@tellann/desktop-contracts';

/**
 * Refining a reconciliation gap for an Automated run.
 *
 * `runReconciliation`'s own classification is pure set membership: a declared state is a
 * `TRUE_GAP` because its name is absent from what was observed, full stop. For a human-driven
 * run that absence really is the whole story. For an Automated run it is not: the run recorded
 * *why* it stopped short (`QARun.automation.stopReason`), and that reason is often direct evidence
 * about the gap rather than a second, unrelated fact — a role guard, a missing test-data value, a
 * button the code no longer has. Reporting "true gap" in that case buries evidence the run already
 * has in hand.
 *
 * This stays a separate, pure module rather than a change inside `runReconciliation` itself: that
 * function is a long, DB-interleaved procedure with no existing tests, and the classification rule
 * is exactly the kind of logic that should be verified without a database. `runReconciliation`
 * calls this to enrich the entries it already computed; it does not change what counts as a gap.
 */

export type AutomatedGapClassification =
  | 'AUTHORIZATION_MISMATCH'
  | 'DATA_PRECONDITION_FAILURE'
  | 'IMPLEMENTATION_MISMATCH'
  | 'DECLARATION_MISMATCH'
  | 'TRUE_GAP';

/** Reasons that describe the *application*, not Tellann's own infrastructure — see `AUTOMATION_STOP_REASON_KIND`. Only these ever refine a gap; an infrastructure or user-cancelled stop explains nothing about the application. */
const STOP_REASON_CLASSIFICATION: Partial<Record<AutomationStopReason, AutomatedGapClassification>> = {
  AUTHORIZATION_BLOCKED: 'AUTHORIZATION_MISMATCH',
  TEST_DATA_UNAVAILABLE: 'DATA_PRECONDITION_FAILURE',
  EXPECTED_TRANSITION_NOT_FOUND: 'IMPLEMENTATION_MISMATCH',
  TRANSITION_DID_NOT_ADVANCE: 'IMPLEMENTATION_MISMATCH',
  STATE_RECOGNITION_AMBIGUOUS: 'IMPLEMENTATION_MISMATCH',
};

export interface AutomatedRunContext {
  stopReason: AutomationStopReason | null;
  /** The one state this run was actually trying to reach. A gap in any other declared state is not explained by this run's own stop reason — the run never claimed to be testing it. */
  targetTerminalStateKey: string | null;
  /** Normalized state key -> the normalized keys it was actually observed transitioning to, this run. Empty/absent means nothing was observed leaving that state. */
  observedDestinationsByState: Map<string, Set<string>>;
}

/** The same normalisation `processQaFlowBoundaryEvent` applies, so a key here means what it means there. */
export const normalizeKey = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** `observedDestinationsByState` from a flat list of observed transitions, scoped to one run. */
export function buildObservedDestinations(transitions: Array<{ fromStateName: string; toStateName: string }>): Map<string, Set<string>> {
  const byState = new Map<string, Set<string>>();
  for (const transition of transitions) {
    const key = normalizeKey(transition.fromStateName);
    const destinations = byState.get(key) ?? new Set<string>();
    destinations.add(normalizeKey(transition.toStateName));
    byState.set(key, destinations);
  }
  return byState;
}

/**
 * Why a declared state that was never observed might be missing.
 *
 * Only the run's own target state is ever reclassified: the stop reason explains why *that*
 * attempt fell short, not why some unrelated, never-attempted state is absent too.
 */
export function classifyAutomatedStateGap(stateKey: string, context: AutomatedRunContext): AutomatedGapClassification {
  if (!context.stopReason || normalizeKey(stateKey) !== normalizeKey(context.targetTerminalStateKey)) return 'TRUE_GAP';
  return STOP_REASON_CLASSIFICATION[context.stopReason] ?? 'TRUE_GAP';
}

/**
 * Why a declared transition was never observed.
 *
 * A transition the run has positive evidence *against* — it left the same state through some
 * other, undeclared transition — is a `DECLARATION_MISMATCH`: the code does something specific
 * and different from what was declared, not merely something unproven. That evidence outranks the
 * stop reason, which only speaks to the run's own target and says nothing about a transition
 * elsewhere in the Flow the run happened to pass through.
 */
export function classifyAutomatedTransitionGap(
  fromStateName: string,
  toStateName: string,
  context: AutomatedRunContext,
): AutomatedGapClassification {
  const destinations = context.observedDestinationsByState.get(normalizeKey(fromStateName));
  if (destinations && destinations.size > 0 && !destinations.has(normalizeKey(toStateName))) {
    return 'DECLARATION_MISMATCH';
  }
  return classifyAutomatedStateGap(toStateName, context);
}
