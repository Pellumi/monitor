/**
 * What the desktop sends the platform when the application reports it has reached a Flow state.
 *
 * The platform's boundary route needs to know which Flow version a marker is about: either explicitly
 * (`flowVersionId`) or by the Flow's slug (`flow`). The SDK's typed calls and hand-written markers give
 * one of those. The markers that instrumentation adapters write — the only markers an Automated Run's
 * required, approved instrumentation produces — give neither: they name their state by id and carry the
 * checkpoint and initialization they came from, and nothing else. Sent as they are, every one is refused as
 * lacking Flow context, so the Flow's boundary would never open.
 *
 * A run pins exactly one Flow version. For a marker that says it came from the adapter and names no
 * other Flow, that version is the only thing it can be about, so it is supplied here. Everything else
 * is left exactly as the application wrote it: a marker that names a version keeps it (and is refused
 * by the platform if it is the wrong one), and one that names a Flow by slug is still matched against the run's
 * Flow by the platform, never by this function.
 */

export interface RelayedFlowEvent {
  eventId?: unknown;
  eventType?: unknown;
  timestamp?: unknown;
  metadata?: unknown;
}

export interface ActiveRunContext {
  /** The Flow version the run is pinned to. */
  expectedGraphVersionId?: string | null;
}

export interface BoundaryRequest {
  eventId: unknown;
  eventType: string;
  timestamp: unknown;
  flowVersionId: unknown;
  stateKey: string;
  fromStateKey: unknown;
  toStateKey: unknown;
  metadata: Record<string, unknown>;
}

const text = (value: unknown): string => (value == null ? "" : String(value).trim());

/** The state a marker names, in the order the platform reads the fields. */
export function markerStateKey(metadata: Record<string, unknown>): string {
  return [metadata.stateKey, metadata.toStateKey, metadata.state, metadata.stateId].map(text).find((value) => value !== "") ?? "";
}

/** Whether a marker is one the instrumentation adapter wrote. */
export function isAdapterMarker(metadata: Record<string, unknown>): boolean {
  return metadata.source === "tellann-adapter";
}

export function boundaryRequestFor(event: RelayedFlowEvent, active: ActiveRunContext): { stateKey: string; request: BoundaryRequest } {
  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : {};
  const stateKey = markerStateKey(metadata);
  const named = text(metadata.flowVersionId);
  const namesAFlow = named !== "" || text(metadata.flow ?? metadata.flowKey) !== "";
  const pinned = text(active.expectedGraphVersionId);
  const flowVersionId = named !== ""
    ? metadata.flowVersionId
    : isAdapterMarker(metadata) && !namesAFlow && pinned !== ""
      ? pinned
      : metadata.flowVersionId;
  return {
    stateKey,
    request: {
      eventId: event.eventId,
      eventType: String(event.eventType ?? ""),
      timestamp: event.timestamp,
      flowVersionId,
      stateKey,
      fromStateKey: metadata.fromStateKey,
      toStateKey: metadata.toStateKey,
      metadata,
    },
  };
}
