import type { AutonomousRiskTier } from '@tellann/desktop-contracts';

/**
 * Authorizing an autonomous action, given its risk tier and what has been approved.
 *
 * Classifying *how dangerous* an action is lives next to the deterministic engine's own
 * evidence (`@tellann/automation-engine`'s `classifyAction`, mapped to a tier by
 * `riskTierOf`), because that needs DOM/code evidence local to that package. This is the
 * other half: given a tier, is the action allowed right now, or must a person say yes first.
 *
 *   - Production is never permitted, matching the automation engine's own absolute ban.
 *   - HIGH_IMPACT is always gated on a per-action approval: one approval covers exactly the
 *     one proposed action it names, never a standing approval for "every high-impact action
 *     from here on."
 *   - Everything else (READ_ONLY / REVERSIBLE / STATE_CHANGING) is allowed once the run's
 *     scope has been approved once, up front — no per-action approval for those.
 */

export interface AutonomousScopeApproval {
  approvedAt: string;
  approvedByUserId: string;
  planVersion: number;
}

export interface AutonomousPerActionApproval {
  /** Identifies exactly one proposed action; an approval never carries over to a different one. */
  actionFingerprint: string;
  approvedAt: string;
}

export type AutonomousAuthorizationReason = 'HIGH_IMPACT_ALWAYS_GATED' | 'NO_SCOPE_APPROVAL' | 'PRODUCTION_BLOCKED';

export type AutonomousActionAuthorization =
  | { allowed: true; requiresHumanApproval: false }
  | { allowed: false; requiresHumanApproval: boolean; reason: AutonomousAuthorizationReason };

export interface AuthorizeAutonomousActionInput {
  riskTier: AutonomousRiskTier;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  /** Null means the run's scope has not been approved by a person yet. */
  scopeApproval: AutonomousScopeApproval | null;
  /** Identifies the specific action being authorized, matched against `perActionApproval`. */
  actionFingerprint: string;
  /** An approval already given for this exact action, when one exists. */
  perActionApproval?: AutonomousPerActionApproval | null;
}

export function authorizeAutonomousAction(input: AuthorizeAutonomousActionInput): AutonomousActionAuthorization {
  if (input.environment === 'PRODUCTION') {
    return { allowed: false, requiresHumanApproval: false, reason: 'PRODUCTION_BLOCKED' };
  }
  if (input.riskTier === 'HIGH_IMPACT') {
    const approved = input.perActionApproval?.actionFingerprint === input.actionFingerprint;
    if (!approved) return { allowed: false, requiresHumanApproval: true, reason: 'HIGH_IMPACT_ALWAYS_GATED' };
    return { allowed: true, requiresHumanApproval: false };
  }
  if (!input.scopeApproval) {
    return { allowed: false, requiresHumanApproval: true, reason: 'NO_SCOPE_APPROVAL' };
  }
  return { allowed: true, requiresHumanApproval: false };
}
