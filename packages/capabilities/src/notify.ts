import type { CapabilityState } from './types';

/**
 * Whether a capability-linked notification may be sent (doc §Phase K). Alerts about health
 * need live capability; nudges to connect telemetry are allowed only while setup is needed.
 */
export type NotificationKind = 'HEALTH_ALERT' | 'SETUP_NUDGE';

export function notificationEligible(kind: NotificationKind, state: CapabilityState): boolean {
  if (kind === 'HEALTH_ALERT') return state === 'AVAILABLE' || state === 'LIMITED';
  return state === 'NEEDS_SETUP';
}

/**
 * Setup nudges fire once per transition into NEEDS_SETUP, identified by the state-change row
 * that caused it, so a repeated recompute cannot resend them.
 */
export function setupNudgeKey(applicationId: string, capabilityKey: string, stateChangeId: string): string {
  return `capability-setup:${applicationId}:${capabilityKey}:${stateChangeId}`;
}
