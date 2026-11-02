import type { SemanticElement } from './types';

/**
 * Verifying a model's proposal for the one situation the deterministic engine has no contract
 * for: a screen the Flow never declared. Same rule as `ambiguity.ts`'s `verifyControlProposal` —
 * a proposal can only choose among elements actually found on the live page; it can never
 * invent one. There is no declared transition to check a *destination* against here, which is
 * exactly why this fallback is reserved for the narrow undeclared-screen case and gated by risk
 * tier + authorization (see `autonomous-risk.ts` / `@tellann/agent-policy`) rather than trusted
 * the way a normal contract-verified step is.
 */

export interface UndeclaredCandidate {
  ref: string;
  role: string | null;
  name: string | null;
  label: string | null;
}

export const UNDECLARED_ACTIONS = ['CLICK', 'FILL', 'SELECT', 'CHECK', 'WAIT'] as const;
export type UndeclaredAction = (typeof UNDECLARED_ACTIONS)[number];

export interface UndeclaredActionProposal {
  action: UndeclaredAction;
  /** One of the candidate refs offered. Null only for WAIT, which touches nothing. */
  targetRef: string | null;
  value: string | null;
  rationale: string;
}

export type UndeclaredRejectionReason = 'NOT_A_CANDIDATE' | 'TARGET_REQUIRED';

export type UndeclaredVerification =
  | { accepted: true }
  | { accepted: false; reason: UndeclaredRejectionReason; detail: string };

/** The candidates to offer the model: visible, enabled elements only — the same usability bar `rankControls` applies. */
export function undeclaredCandidatesFrom(elements: SemanticElement[]): UndeclaredCandidate[] {
  return elements
    .filter((element) => element.visible && element.enabled)
    .map((element) => ({ ref: element.ref, role: element.role, name: element.name, label: element.label }));
}

export function verifyUndeclaredActionProposal(
  proposal: UndeclaredActionProposal,
  candidates: UndeclaredCandidate[],
): UndeclaredVerification {
  if (proposal.action === 'WAIT') return { accepted: true };
  if (!proposal.targetRef) {
    return { accepted: false, reason: 'TARGET_REQUIRED', detail: `A ${proposal.action} proposal must name a target.` };
  }
  const chosen = candidates.find((candidate) => candidate.ref === proposal.targetRef);
  if (!chosen) {
    return {
      accepted: false,
      reason: 'NOT_A_CANDIDATE',
      detail: 'The suggestion is not one of the elements found on the page. A proposal cannot invent an element.',
    };
  }
  return { accepted: true };
}
