/**
 * Capability read access by role. Decision: every organisation member may read every capability.
 * Membership itself is enforced on each route, so this is the only role check that remains.
 *
 * Change this one function to restrict a capability to some roles. Every resolver reads it.
 */
export function capabilityVisibleToAllMembers(): boolean {
  return true;
}
