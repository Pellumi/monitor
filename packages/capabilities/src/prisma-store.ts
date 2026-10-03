import type { PrismaClient } from '@tellann/db';
import type { ApplicationTraits, DetectedFramework } from '@tellann/desktop-contracts';
import type { ArchitectureStore, StoredProfile, ProfileRevision, StoredSnapshot, StateChange } from './service';
import type { EvidenceWatermarkStore } from './evidence-sync';
import type { EvidenceCounts } from './evidence';
import type { CapabilityKey } from './types';

/** Prisma-backed implementation of the capability store. Counts are BigInt in the database and Number in the domain. */
export function createArchitectureStore(prisma: PrismaClient): ArchitectureStore & EvidenceWatermarkStore {
  const db = prisma as any;

  return {
    async getProfile(applicationId) {
      const row = await db.applicationArchitectureProfile.findUnique({ where: { applicationId } });
      return row ? toProfile(row) : null;
    },

    async saveProfile(profile) {
      const data = {
        organizationId: profile.organizationId,
        detectedType: profile.detectedType,
        confirmedType: profile.confirmedType,
        effectiveType: profile.effectiveType,
        confidence: profile.confidence,
        state: profile.state,
        traits: profile.traits,
        frameworks: profile.frameworks,
        workspaceRoot: profile.workspaceRoot,
        workspaceCandidates: profile.workspaceCandidates,
        analysisSnapshotId: profile.analysisSnapshotId,
        detectorVersion: profile.detectorVersion,
        reviewRequired: profile.reviewRequired,
        detectedAt: profile.detectedAt,
        confirmedAt: profile.confirmedAt,
        confirmedByUserId: profile.confirmedByUserId,
      };
      await db.applicationArchitectureProfile.upsert({
        where: { applicationId: profile.applicationId },
        create: { applicationId: profile.applicationId, ...data },
        update: data,
      });
    },

    async listRevisions(applicationId) {
      const rows = await db.applicationProfileRevision.findMany({
        where: { applicationId },
        orderBy: { revisionNumber: 'asc' },
      });
      return rows.map(toRevision);
    },

    async appendRevision(revision) {
      await db.applicationProfileRevision.create({ data: revision });
    },

    async getEvidence(applicationId) {
      const row = await db.applicationEvidenceSummary.findUnique({ where: { applicationId } });
      return row ? toEvidence(row) : null;
    },

    async saveEvidence(applicationId, counts) {
      const data = {
        frontendEventCount: BigInt(counts.frontendEventCount),
        backendEventCount: BigInt(counts.backendEventCount),
        browserEventCount: BigInt(counts.browserEventCount),
        sessionCount: counts.sessionCount,
        runCount: counts.runCount,
        inFlowEventCount: BigInt(counts.inFlowEventCount),
        endpointCount: counts.endpointCount,
        observedStateCount: counts.observedStateCount,
        observedWorkflowCount: counts.observedWorkflowCount,
        declaredFlowCount: counts.declaredFlowCount,
        behaviorGraphVersion: counts.behaviorGraphVersion,
      };
      await db.applicationEvidenceSummary.upsert({
        where: { applicationId },
        create: { applicationId, ...data },
        update: data,
      });
    },

    async getEvidenceWatermark(applicationId) {
      const row = await db.applicationEvidenceSummary.findUnique({ where: { applicationId }, select: { evidenceSyncedAt: true } });
      return row?.evidenceSyncedAt ?? null;
    },

    async saveEvidenceWatermark(applicationId, at) {
      await db.applicationEvidenceSummary.update({ where: { applicationId }, data: { evidenceSyncedAt: at } });
    },

    async getSnapshots(applicationId) {
      const rows = await db.applicationCapabilitySnapshot.findMany({ where: { applicationId } });
      return new Map(rows.map((row: any) => [row.capabilityKey as CapabilityKey, {
        capabilityKey: row.capabilityKey,
        state: row.state,
        reasonCode: row.reasonCode,
        mode: row.mode,
        resolverVersion: row.resolverVersion,
      } as StoredSnapshot]));
    },

    async saveSnapshots(applicationId, snapshots) {
      await db.$transaction(snapshots.map((snapshot) => db.applicationCapabilitySnapshot.upsert({
        where: { applicationId_capabilityKey: { applicationId, capabilityKey: snapshot.capabilityKey } },
        create: { applicationId, ...snapshot, resolvedAt: new Date() },
        update: { state: snapshot.state, reasonCode: snapshot.reasonCode, mode: snapshot.mode, resolverVersion: snapshot.resolverVersion, resolvedAt: new Date() },
      })));
    },

    async appendStateChanges(changes: StateChange[]) {
      await db.applicationCapabilityStateChange.createMany({
        data: changes.map((change) => ({
          applicationId: change.applicationId,
          capabilityKey: change.capabilityKey,
          previousState: change.previousState,
          newState: change.newState,
          reasonCode: change.reasonCode,
          resolverVersion: change.resolverVersion,
          createdAt: change.createdAt,
        })),
      });
    },
  };
}

function toProfile(row: any): StoredProfile {
  return {
    applicationId: row.applicationId,
    organizationId: row.organizationId,
    detectedType: row.detectedType,
    confirmedType: row.confirmedType,
    effectiveType: row.effectiveType,
    confidence: row.confidence,
    state: row.state,
    traits: row.traits as ApplicationTraits,
    frameworks: row.frameworks as DetectedFramework[],
    workspaceRoot: row.workspaceRoot,
    workspaceCandidates: (row.workspaceCandidates ?? []) as string[],
    analysisSnapshotId: row.analysisSnapshotId,
    detectorVersion: row.detectorVersion,
    reviewRequired: row.reviewRequired,
    detectedAt: row.detectedAt,
    confirmedAt: row.confirmedAt,
    confirmedByUserId: row.confirmedByUserId,
    updatedAt: row.updatedAt,
  };
}

function toRevision(row: any): ProfileRevision {
  return {
    applicationId: row.applicationId,
    revisionNumber: row.revisionNumber,
    detectedType: row.detectedType,
    confirmedType: row.confirmedType,
    traits: row.traits as ApplicationTraits,
    frameworks: row.frameworks as DetectedFramework[],
    analysisSnapshotId: row.analysisSnapshotId,
    detectorVersion: row.detectorVersion,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

function toEvidence(row: any): EvidenceCounts {
  return {
    frontendEventCount: Number(row.frontendEventCount),
    backendEventCount: Number(row.backendEventCount),
    browserEventCount: Number(row.browserEventCount),
    sessionCount: row.sessionCount,
    runCount: row.runCount,
    inFlowEventCount: Number(row.inFlowEventCount),
    endpointCount: row.endpointCount,
    observedStateCount: row.observedStateCount,
    observedWorkflowCount: row.observedWorkflowCount,
    declaredFlowCount: row.declaredFlowCount,
    behaviorGraphVersion: row.behaviorGraphVersion,
  };
}
