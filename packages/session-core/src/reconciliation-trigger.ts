import { Services } from '@tellann/shared';

const FDRS_API_URL = (process.env.FDRS_API_URL || `http://localhost:${Services.FDRS_API}`).replace(/\/$/, '');

/**
 * Asks FDRS to re-reconcile an application after new behaviour was observed.
 *
 * Fire-and-forget, as it was in graph-engine: reconciliation is derived data, and a
 * projection that succeeded must not be rolled back because a downstream recompute
 * was briefly unavailable. Lives here so both relays trigger it identically —
 * previously only the Kafka path did, which is another way the Postgres transport
 * silently produced less.
 */
export function triggerReconciliation(applicationId: string): void {
  void globalThis
    .fetch(`${FDRS_API_URL}/applications/${applicationId}/reconciliation/run`, { method: 'POST' })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[session-core] Failed to trigger reconciliation for ${applicationId}: ${message}`);
    });
}
