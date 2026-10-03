import type { CapabilityResolution } from './resolver';
import type { CapabilityReasonCode, LimitedMode } from './types';

/**
 * What an API handler does with a capability decision. Every protected endpoint maps its
 * state through this one function, so the UI and the API cannot disagree (doc §23).
 */
export type EnforcementDecision =
  | { action: 'PROCEED'; mode?: LimitedMode }
  | { action: 'TYPED_EMPTY'; reason: CapabilityReasonCode }
  | { action: 'REJECT'; status: 402 | 403 | 404; reason: CapabilityReasonCode | undefined };

export function enforcementFor(resolution: CapabilityResolution): EnforcementDecision {
  switch (resolution.state) {
    case 'AVAILABLE':
      return { action: 'PROCEED' };
    case 'LIMITED':
      return { action: 'PROCEED', mode: resolution.mode };
    case 'NEEDS_SETUP':
    case 'WAITING_FOR_EVIDENCE':
      // Reads return a typed empty payload that explains itself. Never a zero-filled metric.
      return { action: 'TYPED_EMPTY', reason: resolution.reason! };
    case 'PLAN_LOCKED':
      return { action: 'REJECT', status: 402, reason: resolution.reason };
    case 'NOT_AUTHORIZED':
      return { action: 'REJECT', status: 403, reason: resolution.reason };
    case 'NOT_APPLICABLE':
    case 'UNAVAILABLE':
      return { action: 'REJECT', status: 404, reason: resolution.reason };
  }
}
