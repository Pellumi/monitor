import type { Feature } from '@tellann/shared';
import { EMPTY_EVIDENCE, type EvidenceCountKey, type EvidenceCounts } from './evidence';
import type { RolloutFlags } from './flags';
import { applyEvidence, recomputeCapabilities, type ArchitectureStore, type RecomputeResult } from './service';
import type { CapabilityKey } from './types';

// ─────────────────────────────────────────────────────────────
// Evidence feeding (doc §19, §33, plan Phase E).
//
// The source reads telemetry (ClickHouse) and relational state (Postgres). Telemetry is read
// incrementally from a watermark, so a restart never counts an event twice. Relational counts are
// absolute, so they are converted to deltas against what is already stored. Both paths stay
// monotonic.
// ─────────────────────────────────────────────────────────────

export interface EventCounts {
  frontendEventCount: number;
  backendEventCount: number;
  browserEventCount: number;
  endpointCount: number;
  /** Newest ingest time among the counted events, or null when none were found. */
  latestIngestedAt: Date | null;
}

export interface AbsoluteCounts {
  sessionCount: number;
  runCount: number;
  observedStateCount: number;
  observedWorkflowCount: number;
  declaredFlowCount: number;
  /** Accepted flow-progress events. Relational, so counted absolutely like the other totals. */
  inFlowEventCount: number;
  behaviorGraphVersion: string | null;
}

export interface EvidenceSource {
  /** Events ingested after `since` (all events when null), counted by SDK source. */
  eventsSince(applicationId: string, since: Date | null): Promise<EventCounts>;
  /** Current relational totals for the application. */
  absoluteCounts(applicationId: string): Promise<AbsoluteCounts>;
}

/** Watermark storage: the newest ingest time already counted for one application. */
export interface EvidenceWatermarkStore {
  getEvidenceWatermark(applicationId: string): Promise<Date | null>;
  saveEvidenceWatermark(applicationId: string, at: Date): Promise<void>;
}

const ABSOLUTE_KEYS = [
  'sessionCount',
  'runCount',
  'observedStateCount',
  'observedWorkflowCount',
  'declaredFlowCount',
  'inFlowEventCount',
] as const satisfies readonly EvidenceCountKey[];

export interface SyncResult {
  delta: Partial<Record<EvidenceCountKey, number>>;
  transitions: string[];
  recompute: RecomputeResult | null;
}

/**
 * Brings one application's evidence summary up to date. Recomputes capabilities only when a new
 * evidence source appears (doc §33). Typical telemetry never triggers a recompute.
 */
export async function syncEvidence(
  store: ArchitectureStore & EvidenceWatermarkStore,
  source: EvidenceSource,
  input: {
    applicationId: string;
    planAllows: (feature: Feature) => boolean;
    canView: (key: CapabilityKey) => boolean;
    flags: RolloutFlags;
    resolverVersion: number;
    now: Date;
  },
): Promise<SyncResult> {
  const { applicationId } = input;
  const current: EvidenceCounts = (await store.getEvidence(applicationId)) ?? EMPTY_EVIDENCE;
  const watermark = await store.getEvidenceWatermark(applicationId);

  const events = await source.eventsSince(applicationId, watermark);
  const absolute = await source.absoluteCounts(applicationId);

  const delta: Partial<Record<EvidenceCountKey, number>> = {
    frontendEventCount: events.frontendEventCount,
    backendEventCount: events.backendEventCount,
    browserEventCount: events.browserEventCount,
    endpointCount: events.endpointCount,
  };
  for (const key of ABSOLUTE_KEYS) {
    // Totals can only rise. A lower reading (e.g. a deleted session) is not subtracted.
    delta[key] = Math.max(0, absolute[key] - current[key]);
  }

  const transitions = await applyEvidence(store, {
    applicationId,
    delta,
    behaviorGraphVersion: absolute.behaviorGraphVersion,
  });
  if (events.latestIngestedAt) {
    await store.saveEvidenceWatermark(applicationId, events.latestIngestedAt);
  }

  const recompute = transitions.length > 0
    ? await recomputeCapabilities(store, {
        applicationId,
        planAllows: input.planAllows,
        canView: input.canView,
        flags: input.flags,
        resolverVersion: input.resolverVersion,
        now: input.now,
      })
    : null;

  return { delta, transitions, recompute };
}
