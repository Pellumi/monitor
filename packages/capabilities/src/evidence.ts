import type { InstrumentationTrack, EvidenceKey } from './types';

// ─────────────────────────────────────────────────────────────
// Evidence summary (doc §19, §33). Counts only, monotonic, pre-aggregated.
// The resolver never reads raw event stores; it reads these derived flags.
// ─────────────────────────────────────────────────────────────

export interface EvidenceCounts {
  frontendEventCount: number;
  backendEventCount: number;
  browserEventCount: number;
  sessionCount: number;
  runCount: number;
  inFlowEventCount: number;
  endpointCount: number;
  observedStateCount: number;
  observedWorkflowCount: number;
  declaredFlowCount: number;
  behaviorGraphVersion: string | null;
}

export const EMPTY_EVIDENCE: EvidenceCounts = {
  frontendEventCount: 0,
  backendEventCount: 0,
  browserEventCount: 0,
  sessionCount: 0,
  runCount: 0,
  inFlowEventCount: 0,
  endpointCount: 0,
  observedStateCount: 0,
  observedWorkflowCount: 0,
  declaredFlowCount: 0,
  behaviorGraphVersion: null,
};

/** Numeric count fields. The graph version is not a count and is replaced, not added. */
export type EvidenceCountKey = Exclude<keyof EvidenceCounts, 'behaviorGraphVersion'>;

/**
 * Adds a non-negative delta to each count. Counts never decrease, so a negative delta is a
 * programming error and is rejected rather than silently clamped.
 */
export function applyEvidenceDelta(
  current: EvidenceCounts,
  delta: Partial<Record<EvidenceCountKey, number>>,
  behaviorGraphVersion?: string | null,
): EvidenceCounts {
  const next: EvidenceCounts = { ...current };
  for (const [key, value] of Object.entries(delta) as Array<[EvidenceCountKey, number]>) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Evidence delta for ${key} must be a non-negative integer, got ${value}`);
    }
    next[key] = current[key] + value;
  }
  if (behaviorGraphVersion !== undefined) next.behaviorGraphVersion = behaviorGraphVersion;
  return next;
}

/** Evidence flags the resolver consumes. Derived from counts only; manual labels never set these. */
export function evidenceFlags(counts: EvidenceCounts): Partial<Record<EvidenceKey, boolean>> {
  return {
    FRONTEND_EVENTS: counts.frontendEventCount > 0,
    BACKEND_EVENTS: counts.backendEventCount > 0,
    BROWSER_EVENTS: counts.browserEventCount > 0,
    SESSIONS: counts.sessionCount > 0,
    IN_FLOW_EVENTS: counts.inFlowEventCount > 0,
    ENDPOINT_EVENTS: counts.endpointCount > 0,
    BEHAVIOR_GRAPH: counts.behaviorGraphVersion !== null,
    DECLARED_INTENT: counts.declaredFlowCount > 0,
  };
}

/**
 * An SDK track is connected once it has ever reported an event. Connection is a fact about
 * telemetry, not about configuration, so it is derived here and not read from settings.
 */
export function instrumentationFlags(counts: EvidenceCounts): Partial<Record<InstrumentationTrack, boolean>> {
  return {
    FRONTEND_SDK: counts.frontendEventCount > 0,
    BACKEND_SDK: counts.backendEventCount > 0,
    BROWSER_OBSERVER: counts.browserEventCount > 0,
  };
}

/** Evidence keys that flipped from absent to present. Only these justify a capability recompute (doc §33). */
export function evidenceTransitions(
  before: EvidenceCounts,
  after: EvidenceCounts,
): EvidenceKey[] {
  const previous = evidenceFlags(before);
  const next = evidenceFlags(after);
  const instrumentPrevious = instrumentationFlags(before);
  const instrumentNext = instrumentationFlags(after);
  const transitions: EvidenceKey[] = [];
  for (const key of Object.keys(next) as EvidenceKey[]) {
    if (!previous[key] && next[key]) transitions.push(key);
  }
  // SDK connection is a transition too: connecting the backend SDK changes setup state.
  for (const track of Object.keys(instrumentNext) as InstrumentationTrack[]) {
    if (!instrumentPrevious[track] && instrumentNext[track]) {
      transitions.push(track === 'FRONTEND_SDK' ? 'FRONTEND_EVENTS' : track === 'BACKEND_SDK' ? 'BACKEND_EVENTS' : 'BROWSER_EVENTS');
    }
  }
  return [...new Set(transitions)];
}

/**
 * Telemetry from an SDK the profile does not expect (doc §43). Events are never dropped;
 * the caller marks the profile for review instead.
 */
export function hasTelemetryContradiction(detectedType: string, counts: EvidenceCounts): boolean {
  if (detectedType === 'FRONTEND' && counts.backendEventCount > 0) return true;
  return false;
}
