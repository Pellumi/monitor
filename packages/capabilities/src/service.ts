import type {
  ApplicationArchitectureProjection,
  ApplicationProfileState,
  ApplicationTraits,
  ApplicationType,
  ArchitectureConfidence,
  CapabilityReasonCode,
  DetectedFramework,
} from '@tellann/desktop-contracts';
import { toResolverInput } from './bridge';
import { applyEvidenceDelta, evidenceFlags, evidenceTransitions, hasTelemetryContradiction, instrumentationFlags, EMPTY_EVIDENCE, type EvidenceCountKey, type EvidenceCounts } from './evidence';
import { resolveCapabilities, type CapabilityResolutionMap } from './resolver';
import type { RolloutFlags } from './flags';
import type { ApplicationTypeKey, CapabilityKey, EvidenceKey } from './types';
import { CAPABILITY_KEYS } from './types';
import type { Feature } from '@tellann/shared';

// ─────────────────────────────────────────────────────────────
// Architecture profile and capability state orchestration (doc §10–§12, §33, Phase D/F/G).
//
// Persistence is behind `ArchitectureStore` so the rules are testable without a database.
// The Prisma adapter lives with the API service.
// ─────────────────────────────────────────────────────────────

export type RevisionReason = 'DETECTED' | 'CONFIRMED' | 'CORRECTED' | 'REANALYZED' | 'TRAIT_CHANGED';

export interface StoredProfile {
  applicationId: string;
  organizationId: string;
  detectedType: ApplicationType;
  confirmedType: ApplicationTypeKey | null;
  effectiveType: ApplicationType;
  confidence: ArchitectureConfidence;
  state: ApplicationProfileState;
  traits: ApplicationTraits;
  frameworks: DetectedFramework[];
  workspaceRoot: string;
  /** Package roots the user may select from. Empty for a single-package repository. */
  workspaceCandidates: string[];
  analysisSnapshotId: string | null;
  detectorVersion: string;
  reviewRequired: boolean;
  detectedAt: Date;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  updatedAt: Date;
}

export interface ProfileRevision {
  applicationId: string;
  revisionNumber: number;
  detectedType: ApplicationType;
  confirmedType: ApplicationTypeKey | null;
  traits: ApplicationTraits;
  frameworks: DetectedFramework[];
  analysisSnapshotId: string | null;
  detectorVersion: string;
  reason: RevisionReason;
  createdAt: Date;
}

export interface StoredSnapshot {
  capabilityKey: CapabilityKey;
  state: string;
  reasonCode: CapabilityReasonCode | null;
  mode: string | null;
  resolverVersion: number;
}

export interface StateChange {
  applicationId: string;
  capabilityKey: CapabilityKey;
  previousState: string | null;
  newState: string;
  reasonCode: CapabilityReasonCode | null;
  resolverVersion: number;
  createdAt: Date;
}

export interface ArchitectureStore {
  getProfile(applicationId: string): Promise<StoredProfile | null>;
  saveProfile(profile: StoredProfile): Promise<void>;
  listRevisions(applicationId: string): Promise<ProfileRevision[]>;
  appendRevision(revision: ProfileRevision): Promise<void>;
  getEvidence(applicationId: string): Promise<EvidenceCounts | null>;
  saveEvidence(applicationId: string, counts: EvidenceCounts): Promise<void>;
  getSnapshots(applicationId: string): Promise<Map<CapabilityKey, StoredSnapshot>>;
  saveSnapshots(applicationId: string, snapshots: StoredSnapshot[]): Promise<void>;
  appendStateChanges(changes: StateChange[]): Promise<void>;
}

export class ArchitectureError extends Error {
  constructor(readonly code: 'NOT_ANALYSED' | 'INVALID_CONFIRMATION' | 'INVALID_WORKSPACE', message: string) {
    super(message);
  }
}

/** Identity of a profile for change detection. Confidence and snapshot id are not material. */
export function materialKey(profile: { detectedType: string; traits: ApplicationTraits; frameworks: Array<{ id: string }> }): string {
  const traits = Object.keys(profile.traits).sort().map((key) => `${key}=${profile.traits[key as keyof ApplicationTraits]}`);
  const frameworks = profile.frameworks.map((framework) => framework.id).sort();
  return JSON.stringify([profile.detectedType, traits, frameworks]);
}

export type RecordStatus = 'CREATED' | 'REDETECTED' | 'REFRESHED' | 'UNCHANGED';

/**
 * Stores an analysis projection. Idempotent per analysis snapshot. A revision is appended only
 * when the material identity changes (doc §11, §12), so routine re-scans leave history alone.
 */
export async function recordArchitectureProjection(
  store: ArchitectureStore,
  input: { applicationId: string; organizationId: string; projection: ApplicationArchitectureProjection; now: Date },
): Promise<{ status: RecordStatus; reviewRequired: boolean }> {
  const { projection, now } = input;
  const existing = await store.getProfile(input.applicationId);
  if (existing && existing.analysisSnapshotId === projection.analysisSnapshotId) {
    return { status: 'UNCHANGED', reviewRequired: existing.reviewRequired };
  }

  const material = !existing || materialKey(existing) !== materialKey(projection);
  const confirmedType = existing?.confirmedType ?? null;
  const profile: StoredProfile = {
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    detectedType: projection.detectedType,
    confirmedType,
    effectiveType: confirmedType ?? projection.detectedType,
    confidence: projection.confidence,
    state: confirmedType ? 'CONFIRMED' : 'DETECTED',
    traits: projection.traits,
    frameworks: projection.frameworks,
    workspaceRoot: existing?.workspaceRoot ?? projection.workspaceRoot,
    workspaceCandidates: projection.workspaceCandidates ?? [],
    analysisSnapshotId: projection.analysisSnapshotId,
    detectorVersion: projection.detectorVersion,
    // A material change to a confirmed architecture needs a human look (doc §11).
    reviewRequired: material && confirmedType !== null ? true : existing?.reviewRequired ?? false,
    detectedAt: now,
    confirmedAt: existing?.confirmedAt ?? null,
    confirmedByUserId: existing?.confirmedByUserId ?? null,
    updatedAt: now,
  };

  await store.saveProfile(profile);
  if (material) {
    const revisions = await store.listRevisions(input.applicationId);
    await store.appendRevision({
      applicationId: input.applicationId,
      revisionNumber: (revisions.at(-1)?.revisionNumber ?? 0) + 1,
      detectedType: profile.detectedType,
      confirmedType,
      traits: profile.traits,
      frameworks: profile.frameworks,
      analysisSnapshotId: profile.analysisSnapshotId,
      detectorVersion: profile.detectorVersion,
      reason: existing ? 'TRAIT_CHANGED' : 'DETECTED',
      createdAt: now,
    });
  }

  const status: RecordStatus = !existing ? 'CREATED' : material ? 'REDETECTED' : 'REFRESHED';
  return { status, reviewRequired: profile.reviewRequired };
}

/**
 * Records the user's confirmation. The detected type is never overwritten (doc §10). A
 * confirmation that differs from detection is a correction and is recorded as one.
 */
export async function confirmArchitecture(
  store: ArchitectureStore,
  input: { applicationId: string; userId: string; confirmedType: ApplicationTypeKey; now: Date },
): Promise<{ profile: StoredProfile; action: 'CONFIRMED' | 'CORRECTED'; previousEffectiveType: ApplicationType }> {
  const profile = await store.getProfile(input.applicationId);
  if (!profile) throw new ArchitectureError('NOT_ANALYSED', 'Analyse the workspace before confirming its architecture.');
  if (!['FRONTEND', 'BACKEND', 'MIXED'].includes(input.confirmedType)) {
    throw new ArchitectureError('INVALID_CONFIRMATION', `Cannot confirm ${input.confirmedType}.`);
  }

  const action = input.confirmedType === profile.detectedType ? 'CONFIRMED' : 'CORRECTED';
  const previousEffectiveType = profile.effectiveType;
  const updated: StoredProfile = {
    ...profile,
    confirmedType: input.confirmedType,
    effectiveType: input.confirmedType,
    state: 'CONFIRMED',
    reviewRequired: false,
    confirmedAt: input.now,
    confirmedByUserId: input.userId,
    updatedAt: input.now,
  };
  await store.saveProfile(updated);

  const revisions = await store.listRevisions(input.applicationId);
  await store.appendRevision({
    applicationId: input.applicationId,
    revisionNumber: (revisions.at(-1)?.revisionNumber ?? 0) + 1,
    detectedType: profile.detectedType,
    confirmedType: input.confirmedType,
    traits: profile.traits,
    frameworks: profile.frameworks,
    analysisSnapshotId: profile.analysisSnapshotId,
    detectorVersion: profile.detectorVersion,
    reason: action === 'CORRECTED' ? 'CORRECTED' : 'CONFIRMED',
    createdAt: input.now,
  });
  return { profile: updated, action, previousEffectiveType };
}

/**
 * Applies a telemetry batch to the evidence summary. Returns the evidence keys that newly
 * became present. Only those justify a capability recompute (doc §33).
 */
export async function applyEvidence(
  store: ArchitectureStore,
  input: { applicationId: string; delta: Partial<Record<EvidenceCountKey, number>>; behaviorGraphVersion?: string | null },
): Promise<EvidenceKey[]> {
  const current = (await store.getEvidence(input.applicationId)) ?? EMPTY_EVIDENCE;
  const next = applyEvidenceDelta(current, input.delta, input.behaviorGraphVersion);
  await store.saveEvidence(input.applicationId, next);
  return evidenceTransitions(current, next);
}

/**
 * Chooses the workspace a monorepo application represents (doc §38). Only a candidate the analysis
 * found, or the repository root, is accepted. The next analysis then detects that workspace.
 */
export async function selectWorkspace(
  store: ArchitectureStore,
  input: { applicationId: string; workspaceRoot: string; now: Date },
): Promise<StoredProfile> {
  const profile = await store.getProfile(input.applicationId);
  if (!profile) throw new ArchitectureError('NOT_ANALYSED', 'Analyse the repository before choosing a workspace.');
  const allowed = new Set(['.', ...profile.workspaceCandidates]);
  if (!allowed.has(input.workspaceRoot)) {
    throw new ArchitectureError('INVALID_WORKSPACE', `${input.workspaceRoot} is not a workspace in this repository.`);
  }
  const updated: StoredProfile = { ...profile, workspaceRoot: input.workspaceRoot, updatedAt: input.now };
  await store.saveProfile(updated);
  return updated;
}

export interface RecomputeInput {
  applicationId: string;
  planAllows: (feature: Feature) => boolean;
  canView: (key: CapabilityKey) => boolean;
  flags: RolloutFlags;
  resolverVersion: number;
  now: Date;
}

export interface RecomputeResult {
  resolutions: CapabilityResolutionMap;
  changes: StateChange[];
  reviewRequired: boolean;
}

/**
 * Resolves every capability for one application, stores the snapshot, and logs only real
 * transitions. Reads of the stored snapshot never call this; it runs on invalidation.
 */
export async function recomputeCapabilities(store: ArchitectureStore, input: RecomputeInput): Promise<RecomputeResult> {
  const profile = await store.getProfile(input.applicationId);
  const evidence = (await store.getEvidence(input.applicationId)) ?? EMPTY_EVIDENCE;
  const previous = await store.getSnapshots(input.applicationId);

  const resolverInput = toResolverInput({
    projection: profile,
    confirmedType: profile?.confirmedType ?? undefined,
    instrumentation: instrumentationFlags(evidence),
    evidence: evidenceFlags(evidence),
    planAllows: input.planAllows,
    canView: input.canView,
    disabled: input.flags.disabled,
  });
  const resolutions = resolveCapabilities(resolverInput);

  // Contradictory telemetry is kept, never dropped; the profile is flagged for review (doc §43).
  let reviewRequired = profile?.reviewRequired ?? false;
  if (profile && !profile.reviewRequired && hasTelemetryContradiction(profile.detectedType, evidence)) {
    reviewRequired = true;
    await store.saveProfile({ ...profile, reviewRequired: true, updatedAt: input.now });
  }

  const changes: StateChange[] = [];
  const snapshots: StoredSnapshot[] = [];
  for (const key of CAPABILITY_KEYS) {
    const next = resolutions[key];
    const prior = previous.get(key);
    const reasonCode = next.reason ?? null;
    const mode = next.mode ?? null;
    const unchanged = prior !== undefined
      && prior.state === next.state
      && prior.reasonCode === reasonCode
      && prior.mode === mode
      && prior.resolverVersion === input.resolverVersion;
    if (unchanged) continue;
    snapshots.push({ capabilityKey: key, state: next.state, reasonCode, mode, resolverVersion: input.resolverVersion });
    changes.push({
      applicationId: input.applicationId,
      capabilityKey: key,
      previousState: prior?.state ?? null,
      newState: next.state,
      reasonCode,
      resolverVersion: input.resolverVersion,
      createdAt: input.now,
    });
  }
  if (snapshots.length > 0) await store.saveSnapshots(input.applicationId, snapshots);
  if (changes.length > 0) await store.appendStateChanges(changes);

  return { resolutions, changes, reviewRequired };
}
