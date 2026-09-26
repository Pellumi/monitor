import { canonicalRouteFromPath, isErrorEventType, readErrorEventDetail, type TellannEvent } from '@tellann/shared';

/**
 * The per-session summary every search filter reads.
 *
 * Computed inside the completion transaction, which costs nothing extra: completion
 * already loads every event to work out eventCount, errorCount and durationMs.
 */

/** Bumped whenever a facet field is added or its derivation changes. */
export const SESSION_FACET_VERSION = 1;

/** How much error text is kept for substring search. */
const ERROR_TEXT_LIMIT = 4_000;
/** Ceiling on each presence array, so one pathological session cannot bloat a row. */
const ARRAY_LIMIT = 200;

export interface SessionFacetInput {
  sessionId: string;
  applicationId: string;
  environmentId: string | null;
  tenantId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  eventCount: number;
  errorCount: number;
  qaRunId: string | null;
  anonymousId: string | null;
  endUserId: string | null;
  endUserIds: string[];
  deviceType: string | null;
  browserName: string | null;
  osName: string | null;
  releaseVersion: string | null;
  sampleRate: number | null;
  eventTypes: string[];
  routes: string[];
  statusCodes: number[];
  maxStatusCode: number | null;
  errorNames: string[];
  errorText: string | null;
  facetVersion: number;
}

export interface SessionRowForFacet {
  id: string;
  applicationId: string;
  environmentId: string | null;
  tenantId: string;
  qaRunId: string | null;
  anonymousId: string | null;
  endUserId: string | null;
  deviceType: string | null;
  browserName: string | null;
  osName: string | null;
  releaseVersion: string | null;
  sampleRate: number | null;
}

function capped<T>(values: Iterable<T>): T[] {
  return [...values].slice(0, ARRAY_LIMIT);
}

/**
 * The route an event touched, canonicalised.
 *
 * `canonicalRouteFromPath` collapses identifier-shaped segments to `{param}`, which is
 * the only thing keeping this column's cardinality bounded — and therefore the only
 * thing keeping its GIN index selective. It already existed in @tellann/shared and was
 * used solely by endpoint-engine; the observed graph never used it, which is part of
 * why `/orders/17` and `/orders/18` read as different places.
 */
function routeOf(event: TellannEvent): string | null {
  const metadata = event.metadata ?? {};
  const raw = typeof metadata.endpoint === 'string'
    ? metadata.endpoint
    : typeof metadata.url === 'string' ? metadata.url : null;
  if (!raw) return null;

  try {
    // A full URL carries an origin that is not part of the route.
    const path = raw.startsWith('http') ? new URL(raw).pathname : raw;
    const canonical = canonicalRouteFromPath(path);
    return canonical || null;
  } catch {
    return null;
  }
}

export function computeSessionFacet(input: {
  session: SessionRowForFacet;
  events: TellannEvent[];
  statistics: { eventCount: number; errorCount: number; durationMs: number };
}): SessionFacetInput {
  const { session, events, statistics } = input;

  const eventTypes = new Set<string>();
  const routes = new Set<string>();
  const statusCodes = new Set<number>();
  const errorNames = new Set<string>();
  const endUserIds = new Set<string>();
  const errorMessages: string[] = [];
  let maxStatusCode: number | null = null;

  for (const event of events) {
    eventTypes.add(event.eventType);

    const route = routeOf(event);
    if (route) routes.add(route);

    const metadata = (event.metadata ?? {}) as Record<string, unknown>;

    if (typeof metadata.statusCode === 'number' && Number.isFinite(metadata.statusCode)) {
      const code = Math.trunc(metadata.statusCode);
      statusCodes.add(code);
      if (maxStatusCode === null || code > maxStatusCode) maxStatusCode = code;
    }

    if (isErrorEventType(event.eventType)) {
      // Read through the shared normalizer: the five error types do not agree on where
      // they put the message, so a local `metadata.message` misses most of them.
      const detail = readErrorEventDetail(metadata);
      if (detail.message) errorMessages.push(detail.message);
      const name = typeof metadata.name === 'string' ? metadata.name : event.eventType;
      errorNames.add(name);
    }

    if (event.endUserExternalId) endUserIds.add(event.endUserExternalId);
  }

  // The session's own endUserId is the durable identity; the envelope's external ids are
  // what the events asserted. Both belong in the filter set.
  if (session.endUserId) endUserIds.add(session.endUserId);

  const errorText = errorMessages.length > 0
    ? errorMessages.join(' | ').slice(0, ERROR_TEXT_LIMIT)
    : null;

  const first = events[0];
  const last = events[events.length - 1];

  return {
    sessionId: session.id,
    applicationId: session.applicationId,
    environmentId: session.environmentId,
    tenantId: session.tenantId,
    startTime: new Date(first.timestamp),
    endTime: new Date(last.timestamp),
    durationMs: statistics.durationMs,
    eventCount: statistics.eventCount,
    errorCount: statistics.errorCount,
    qaRunId: session.qaRunId,
    anonymousId: session.anonymousId,
    endUserId: session.endUserId,
    endUserIds: capped(endUserIds),
    deviceType: session.deviceType,
    browserName: session.browserName,
    osName: session.osName,
    releaseVersion: session.releaseVersion,
    sampleRate: session.sampleRate,
    eventTypes: capped(eventTypes),
    routes: capped(routes),
    statusCodes: capped(statusCodes),
    maxStatusCode,
    errorNames: capped(errorNames),
    errorText,
    facetVersion: SESSION_FACET_VERSION,
  };
}

export interface FlowFacets {
  stateNames: string[];
  workflowNames: string[];
  enteredFlows: string[];
  reachedTerminalFlows: string[];
  abandoned: boolean;
}

/**
 * The flow-shaped half of a facet, which only the graph projection knows.
 *
 * A session's states and workflows are not derivable from its raw events — they depend
 * on the application's rule set — so completion writes the facet and projection
 * enriches it afterwards. `abandoned` is the point of the exercise: entered a flow and
 * never reached a terminal state is the question the product promises to answer, and
 * before this there was no column behind it.
 */
export function computeFlowFacets(input: {
  stateNames: string[];
  workflowNames: string[];
  terminalStateNames: string[];
}): FlowFacets {
  const stateNames = capped(new Set(input.stateNames));
  const workflowNames = capped(new Set(input.workflowNames));
  const terminals = new Set(input.terminalStateNames);

  // A flow is "entered" by touching any of its states, and "reached terminal" by
  // touching one the declaration marks as an end.
  const enteredFlows = workflowNames;
  const reachedTerminal = stateNames.some((name) => terminals.has(name));
  const reachedTerminalFlows = reachedTerminal ? workflowNames : [];

  // Abandonment is only meaningful against a declaration of what finishing means. With
  // no declared terminal states there is nothing to have failed to reach, so this stays
  // false rather than labelling every session in an undeclared application a failure --
  // which is exactly what a bare `reachedTerminalFlows.length === 0` would do, and did.
  const abandonmentIsKnowable = terminals.size > 0;

  return {
    stateNames,
    workflowNames,
    enteredFlows,
    reachedTerminalFlows,
    abandoned: abandonmentIsKnowable && enteredFlows.length > 0 && !reachedTerminal,
  };
}
