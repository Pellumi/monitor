import { frameworkSdkSupport, type ApplicationArchitectureProjection, type SdkTrack } from '@tellann/desktop-contracts';
import type { Feature } from '@tellann/shared';
import type { ResolverInput } from './resolver';
import type { ApplicationTypeKey, CapabilityKey, InstrumentationTrack } from './types';

const TRACK_TO_INSTRUMENTATION: Record<SdkTrack, InstrumentationTrack> = {
  FRONTEND: 'FRONTEND_SDK',
  BACKEND: 'BACKEND_SDK',
};

/**
 * Tracks whose detected frameworks all lack SDK support. A track with at least one
 * supported framework is never reported as unsupported.
 */
export function unsupportedInstrumentation(projection: Pick<ApplicationArchitectureProjection, 'frameworks'>): InstrumentationTrack[] {
  const byTrack = new Map<SdkTrack, { supported: boolean; planned: boolean }>();
  for (const framework of projection.frameworks) {
    const support = frameworkSdkSupport(framework.id);
    if (!support) continue;
    const entry = byTrack.get(support.track) ?? { supported: false, planned: false };
    if (support.status === 'SUPPORTED') entry.supported = true;
    else entry.planned = true;
    byTrack.set(support.track, entry);
  }
  return [...byTrack.entries()]
    .filter(([, entry]) => entry.planned && !entry.supported)
    .map(([track]) => TRACK_TO_INSTRUMENTATION[track]);
}

/** The parts of a stored profile resolution depends on. */
export type ArchitectureProfileLike = Pick<ApplicationArchitectureProjection, 'detectedType' | 'traits' | 'frameworks'>;

export interface BridgeInput {
  /** Stored profile, or null when the application has never been analysed. */
  projection: ArchitectureProfileLike | null;
  /** Confirmed type when the user has confirmed one, otherwise undefined. */
  confirmedType?: ApplicationTypeKey;
  instrumentation: Partial<Record<InstrumentationTrack, boolean>>;
  evidence: ResolverInput['evidence'];
  planAllows: (feature: Feature) => boolean;
  canView: ResolverInput['canView'];
  disabled?: ReadonlySet<CapabilityKey>;
}

/**
 * Builds resolver input from stored state. Effective type is `confirmed ?? detected`
 * (doc §10). Without a projection, the profile is UNKNOWN and the legacy path applies.
 */
export function toResolverInput(input: BridgeInput): ResolverInput {
  const projection = input.projection;
  if (!projection) {
    return {
      architecture: { effectiveType: 'UNKNOWN', traits: NO_TRAITS },
      instrumentation: input.instrumentation,
      evidence: input.evidence,
      planAllows: input.planAllows,
      canView: input.canView,
      disabled: input.disabled,
    };
  }
  const effectiveType = input.confirmedType ?? projection.detectedType;
  return {
    architecture: {
      effectiveType,
      traits: projection.traits,
      unsupportedTracks: unsupportedInstrumentation(projection),
    },
    instrumentation: input.instrumentation,
    evidence: input.evidence,
    planAllows: input.planAllows,
    canView: input.canView,
    disabled: input.disabled,
  };
}

const NO_TRAITS = {
  browserSurface: false,
  frontendRuntime: false,
  backendRuntime: false,
  clientRouting: false,
  uiStateSurface: false,
  apiConsumer: false,
  apiProvider: false,
  serverActions: false,
  serverRendering: false,
  managedBrowserRunnable: false,
} as const;
