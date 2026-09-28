import { AUTOMATION_STOP_REASON_KIND } from '@tellann/desktop-contracts';
import type { AutomationStopReason } from '@tellann/desktop-contracts';
import type { Confidence } from './types';

/**
 * How much evidence to keep, decided by whether anything went wrong.
 *
 * A run that goes exactly as declared does not need a screenshot, a full DOM and a browser trace
 * for every state: that is a great deal to capture, store and upload to confirm nothing happened.
 * The always-on tier (route, semantic DOM summary, SDK signals, request metadata, console errors,
 * timings, state fingerprint) is what the hot path already gathers and is enough to reconstruct a
 * clean run. The moment something looks off the run earns forensic depth *for that moment*, when the
 * page still shows the problem, instead of a reconstruction afterwards.
 */

export type CaptureTier = 'STANDARD' | 'DEEP';

export type AnomalyReason =
  | 'LOW_CONFIDENCE'
  | 'AMBIGUOUS_STATE'
  | 'UNRECOGNISED_STATE'
  | 'ACTION_DID_NOT_ADVANCE'
  | 'UNEXPECTED_STATE'
  | 'RUNTIME_ERRORS'
  | 'ACTION_BLOCKED'
  | 'RUN_STOPPED_SHORT';

export interface CaptureInput {
  /** What was recognised; `null` means the page matched no state at all, `undefined` means recognition is not what is being judged. */
  recognition?: { confidence: Confidence; ambiguous: boolean } | null;
  /** The action just performed and what came of it, when this is a post-action check. */
  action?: { fromState: string; expectedState: string; observedState: string | null; advanced: boolean } | null;
  /** New console/runtime errors since the last snapshot. */
  errorsSince?: number;
  /** An action was refused or its control could not be found. */
  blocked?: boolean;
  /** Set when the run is ending. */
  stopReason?: AutomationStopReason | null;
}

export interface CaptureDecision {
  tier: CaptureTier;
  reasons: AnomalyReason[];
  artifacts: {
    screenshot: boolean;
    fullDom: boolean;
    trace: boolean;
    /** Expand the code evidence behind the state or transition, so a failure report can say what the code does there. */
    codeEvidence: boolean;
  };
}

const NONE: CaptureDecision['artifacts'] = { screenshot: false, fullDom: false, trace: false, codeEvidence: false };
/** Reasons where the answer to "why" plausibly lives in the code, not just on the page. */
const CODE_RELEVANT = new Set<AnomalyReason>(['ACTION_DID_NOT_ADVANCE', 'UNEXPECTED_STATE', 'ACTION_BLOCKED', 'RUN_STOPPED_SHORT']);

export function decideCapture(input: CaptureInput): CaptureDecision {
  const reasons: AnomalyReason[] = [];
  const { recognition } = input;

  if (recognition === null && !input.action) reasons.push('UNRECOGNISED_STATE');
  if (recognition?.ambiguous) reasons.push('AMBIGUOUS_STATE');
  else if (recognition && recognition.confidence === 'LOW') reasons.push('LOW_CONFIDENCE');

  if (input.action && !input.action.advanced) {
    // Landing in a *different* declared state is a different finding from going nowhere.
    const { observedState, fromState } = input.action;
    reasons.push(observedState && observedState !== fromState ? 'UNEXPECTED_STATE' : 'ACTION_DID_NOT_ADVANCE');
  }
  if ((input.errorsSince ?? 0) > 0) reasons.push('RUNTIME_ERRORS');
  if (input.blocked) reasons.push('ACTION_BLOCKED');
  // Reaching the target, or the user cancelling, is not an anomaly worth forensics.
  if (input.stopReason && !['SUCCESS', 'USER'].includes(AUTOMATION_STOP_REASON_KIND[input.stopReason])) reasons.push('RUN_STOPPED_SHORT');

  if (reasons.length === 0) return { tier: 'STANDARD', reasons, artifacts: { ...NONE } };
  return {
    tier: 'DEEP',
    reasons,
    artifacts: { screenshot: true, fullDom: true, trace: true, codeEvidence: reasons.some((reason) => CODE_RELEVANT.has(reason)) },
  };
}
