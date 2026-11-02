import type { AutonomousRiskTier } from '@tellann/desktop-contracts';
import type { ActionClass } from './types';

/**
 * How dangerous an `ActionClass` is, for the purpose of autonomous-mode authorization.
 *
 * No new evidence-gathering is needed here: every action an autonomous run performs is
 * still classified by `classifyAction` (policy.ts), the same deterministic evidence-based
 * classifier the ordinary Automated Run engine uses — whether the action came from a
 * contract-declared transition or from the undeclared-control fallback. This is just the
 * one-to-one mapping from that classification to the risk tier `@tellann/agent-policy`
 * authorizes against.
 */
const RISK_TIER_BY_ACTION_CLASS: Record<ActionClass, AutonomousRiskTier> = {
  READ: 'READ_ONLY',
  CLIENT_STATE_MUTATION: 'REVERSIBLE',
  SERVER_MUTATION: 'STATE_CHANGING',
  EXTERNAL_SIDE_EFFECT: 'HIGH_IMPACT',
  DESTRUCTIVE: 'HIGH_IMPACT',
};

export function riskTierOf(actionClass: ActionClass): AutonomousRiskTier {
  return RISK_TIER_BY_ACTION_CLASS[actionClass];
}
