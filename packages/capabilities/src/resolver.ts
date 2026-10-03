import type { Feature } from '@tellann/shared';
import { CAPABILITY_REGISTRY } from './registry';
import type {
  ApplicationTraits,
  ApplicationTypeKey,
  CapabilityDefinition,
  CapabilityKey,
  CapabilityReasonCode,
  CapabilityState,
  EvidenceKey,
  InstrumentationTrack,
  LimitedMode,
} from './types';

/**
 * Bump whenever resolution semantics change. Every snapshot stores the version it was
 * computed with, so a bump invalidates them all (doc §12, §33).
 */
export const RESOLVER_VERSION = 1;

export interface ResolverInput {
  architecture: {
    /** `UNKNOWN` means the profile is pending analysis (migration path, doc §L). */
    effectiveType: ApplicationTypeKey | 'UNKNOWN';
    traits: ApplicationTraits;
    /** Tracks whose framework has no SDK support today (SDK registry). */
    unsupportedTracks?: InstrumentationTrack[];
  };
  /** Which instrumentation tracks are connected. Absent keys count as not connected. */
  instrumentation: Partial<Record<InstrumentationTrack, boolean>>;
  /**
   * Which evidence sources have been observed. Derived only from telemetry and runs.
   * A manual confirmation must never set these (doc §41).
   */
  evidence: Partial<Record<EvidenceKey, boolean>>;
  /** Plan check, typically backed by EntitlementChecker / resolved entitlement features. */
  planAllows: (feature: Feature) => boolean;
  /** RBAC check for the requesting user. */
  canView: (key: CapabilityKey) => boolean;
  /** Capabilities disabled by rollout flags. */
  disabled?: ReadonlySet<CapabilityKey>;
}

export interface CapabilityResolution {
  state: CapabilityState;
  reason?: CapabilityReasonCode;
  /** Set only when state is LIMITED. */
  mode?: LimitedMode;
}

export type CapabilityResolutionMap = Record<CapabilityKey, CapabilityResolution>;

/**
 * Setup prompt for a missing track. A frontend-only application that consumes APIs is
 * set up through the frontend SDK, because that is the only track it can have.
 */
function missingReason(definition: CapabilityDefinition, traits: ApplicationTraits): CapabilityReasonCode {
  const frontendIsTheWayIn = !traits.backendRuntime
    && definition.limitedModes.some((rule) => rule.whenConnected.includes('FRONTEND_SDK'));
  if (frontendIsTheWayIn) return 'FRONTEND_SDK_NOT_CONNECTED';
  return definition.instrumentationAnyOf.includes('BACKEND_SDK')
    ? 'BACKEND_SDK_NOT_CONNECTED'
    : 'FRONTEND_SDK_NOT_CONNECTED';
}

/** Evidence reason when nothing has been observed yet. */
function waitingReason(definition: CapabilityDefinition): CapabilityReasonCode {
  if (definition.evidenceAnyOf.includes('ENDPOINT_EVENTS')) return 'NO_ENDPOINT_EVIDENCE';
  if (definition.evidenceAnyOf.includes('IN_FLOW_EVENTS')) return 'NO_IN_FLOW_EVIDENCE';
  return 'AWAITING_FIRST_RUN';
}

/** Reason naming the track a partial mode is missing. */
function absentReason(track: InstrumentationTrack): CapabilityReasonCode {
  return track === 'BACKEND_SDK' ? 'BACKEND_SDK_NOT_CONNECTED' : 'FRONTEND_SDK_NOT_CONNECTED';
}

function firstMatchingLimitedMode(
  definition: CapabilityDefinition,
  connected: (track: InstrumentationTrack) => boolean,
): CapabilityDefinition['limitedModes'][number] | undefined {
  return definition.limitedModes.find((rule) =>
    rule.whenConnected.every(connected) && rule.whenAbsent.every((track) => !connected(track)),
  );
}

/**
 * Resolves one capability. Steps run in the doc §6 order; the first verdict wins.
 * Pure: no I/O, no clock, so the same input always yields the same output.
 */
export function resolveCapability(
  definition: CapabilityDefinition,
  input: ResolverInput,
): CapabilityResolution {
  // 1. Shipped?
  if (definition.productStatus !== 'AVAILABLE') {
    return { state: 'UNAVAILABLE', reason: 'CAPABILITY_NOT_SHIPPED' };
  }
  if (input.disabled?.has(definition.key)) {
    return { state: 'UNAVAILABLE', reason: 'ROLLOUT_DISABLED' };
  }

  // 2. User authorized?
  if (!input.canView(definition.key)) {
    return { state: 'NOT_AUTHORIZED', reason: 'ROLE_PERMISSION_MISSING' };
  }

  // 3. Organization entitled?
  if (definition.entitlementKey !== undefined && !input.planAllows(definition.entitlementKey)) {
    return { state: 'PLAN_LOCKED', reason: 'PLAN_ENTITLEMENT_MISSING' };
  }

  // Legacy path: an application whose profile is still pending analysis keeps today's
  // plan-only visibility until it is analysed and confirmed (doc §L).
  if (input.architecture.effectiveType === 'UNKNOWN') {
    return { state: 'AVAILABLE', reason: 'APPLICATION_PROFILE_UNKNOWN' };
  }
  const type = input.architecture.effectiveType;
  const traits = input.architecture.traits;

  // 4. Applicable to architecture?
  const typeApplies = definition.applicability.types.includes(type);
  const traitApplies =
    definition.applicability.traitsAnyOf === undefined ||
    definition.applicability.traitsAnyOf.some((trait) => traits[trait]);
  if (!typeApplies || !traitApplies) {
    return { state: 'NOT_APPLICABLE', reason: definition.notApplicableReason };
  }

  const connected = (track: InstrumentationTrack) => input.instrumentation[track] === true;
  const instrumentationRequired = definition.instrumentationAnyOf.length > 0;
  const instrumentationSatisfied =
    !instrumentationRequired || definition.instrumentationAnyOf.some(connected);
  const partialRule = firstMatchingLimitedMode(definition, connected);

  // 5. Required instrumentation present?
  if (!instrumentationSatisfied) {
    // A partial mode (e.g. frontend-only API activity) takes priority over a setup prompt
    // for a track the application does not have and never will (doc §17, §44).
    const requiredTracks = definition.instrumentationAnyOf;
    const unsupported = requiredTracks.some(
      (track) => input.architecture.unsupportedTracks?.includes(track) === true,
    );
    if (unsupported && partialRule === undefined) {
      return { state: 'NOT_APPLICABLE', reason: 'UNSUPPORTED_FRAMEWORK' };
    }
    if (partialRule === undefined) {
      return { state: 'NEEDS_SETUP', reason: missingReason(definition, traits) };
    }
  }

  // 6. Required evidence present?
  const hasEvidence =
    definition.evidenceAnyOf.length === 0 ||
    definition.evidenceAnyOf.some((key) => input.evidence[key] === true);
  if (!hasEvidence) {
    return { state: 'WAITING_FOR_EVIDENCE', reason: waitingReason(definition) };
  }

  // 7. Full or partial evidence?
  if (partialRule !== undefined) {
    return {
      state: 'LIMITED',
      reason: absentReason(partialRule.whenAbsent[0]),
      mode: partialRule.mode,
    };
  }
  return { state: 'AVAILABLE' };
}

/** Resolves every registered capability against one application's inputs. */
export function resolveCapabilities(input: ResolverInput): CapabilityResolutionMap {
  const result = {} as CapabilityResolutionMap;
  for (const definition of CAPABILITY_REGISTRY) {
    result[definition.key] = resolveCapability(definition, input);
  }
  return result;
}
