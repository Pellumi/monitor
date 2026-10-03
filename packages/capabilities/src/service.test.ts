import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ApplicationArchitectureProjection, ApplicationTraits } from '@tellann/desktop-contracts';
import { EMPTY_EVIDENCE, type EvidenceCounts } from './evidence';
import { readRolloutFlags } from './flags';
import { notificationEligible } from './notify';
import {
  applyEvidence, ArchitectureError, confirmArchitecture, materialKey, recomputeCapabilities, selectWorkspace,
  recordArchitectureProjection, type ArchitectureStore, type ProfileRevision, type StateChange,
  type StoredProfile, type StoredSnapshot,
} from './service';
import type { CapabilityKey } from './types';

const NONE: ApplicationTraits = {
  browserSurface: false, frontendRuntime: false, backendRuntime: false, clientRouting: false,
  uiStateSurface: false, apiConsumer: false, apiProvider: false, serverActions: false,
  serverRendering: false, managedBrowserRunnable: false,
};
const FRONTEND_TRAITS: ApplicationTraits = { ...NONE, browserSurface: true, frontendRuntime: true, clientRouting: true, apiConsumer: true, managedBrowserRunnable: true };
const SERVER_TRAITS: ApplicationTraits = { ...NONE, backendRuntime: true, apiProvider: true };
const MIXED_TRAITS: ApplicationTraits = { ...FRONTEND_TRAITS, ...SERVER_TRAITS };

interface MemoryStore extends ArchitectureStore {
  profile: StoredProfile | null;
  revisions: ProfileRevision[];
  evidence: EvidenceCounts | null;
  snapshots: Map<CapabilityKey, StoredSnapshot>;
  changes: StateChange[];
}

function memoryStore(): MemoryStore {
  const store: MemoryStore = {
    profile: null,
    revisions: [],
    evidence: null,
    snapshots: new Map(),
    changes: [],
    async getProfile() { return store.profile; },
    async saveProfile(profile) { store.profile = structuredClone(profile); },
    async listRevisions() { return [...store.revisions]; },
    async appendRevision(revision) { store.revisions.push(structuredClone(revision)); },
    async getEvidence() { return store.evidence ? { ...store.evidence } : null; },
    async saveEvidence(_applicationId, counts) { store.evidence = { ...counts }; },
    async getSnapshots() { return new Map(store.snapshots); },
    async saveSnapshots(_applicationId, rows) { for (const row of rows) store.snapshots.set(row.capabilityKey, row); },
    async appendStateChanges(rows) { store.changes.push(...rows); },
  };
  return store;
}

function projection(overrides: Partial<ApplicationArchitectureProjection> = {}): ApplicationArchitectureProjection {
  return {
    detectedType: 'FRONTEND',
    confidence: 'HIGH',
    scores: { frontend: 90, backend: 0 },
    traits: FRONTEND_TRAITS,
    frameworks: [{ id: 'react', version: '18.2.0', sdkSupport: 'SUPPORTED' }],
    routeTemplates: [],
    workspaceRoot: '.',
    analysisSnapshotId: 'snap-1',
    detectorVersion: '1',
    warnings: [],
    ...overrides,
  };
}

const NOW = new Date('2026-10-03T10:00:00Z');
const APP = 'app-1';
const ORG = 'org-1';
const flags = readRolloutFlags({});
const allow = { planAllows: () => true, canView: () => true };

function recompute(store: ArchitectureStore, extra: Partial<Parameters<typeof recomputeCapabilities>[1]> = {}) {
  return recomputeCapabilities(store, { applicationId: APP, flags, resolverVersion: 1, now: NOW, ...allow, ...extra });
}

test('first analysis creates a DETECTED profile with one revision', async () => {
  const store = memoryStore();
  const result = await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  assert.equal(result.status, 'CREATED');
  assert.equal(store.profile?.state, 'DETECTED');
  assert.equal(store.profile?.effectiveType, 'FRONTEND');
  assert.equal(store.revisions.length, 1);
  assert.equal(store.revisions[0].reason, 'DETECTED');
});

test('re-analysis of the same snapshot is a no-op', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const again = await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  assert.equal(again.status, 'UNCHANGED');
  assert.equal(store.revisions.length, 1);
});

test('a new snapshot with the same identity refreshes the profile without writing a revision', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const result = await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG, projection: projection({ analysisSnapshotId: 'snap-2', confidence: 'MEDIUM' }), now: NOW,
  });
  assert.equal(result.status, 'REFRESHED');
  assert.equal(store.profile?.analysisSnapshotId, 'snap-2');
  assert.equal(store.revisions.length, 1);
});

test('server routes appearing is a material change: revision appended, status REDETECTED', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const result = await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG,
    projection: projection({ detectedType: 'MIXED', traits: MIXED_TRAITS, analysisSnapshotId: 'snap-2' }), now: NOW,
  });
  assert.equal(result.status, 'REDETECTED');
  assert.equal(store.revisions.length, 2);
  assert.equal(store.revisions[1].reason, 'TRAIT_CHANGED');
});

test('confirming a different type is a correction: effective changes, detected is preserved', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const result = await confirmArchitecture(store, { applicationId: APP, userId: 'user-1', confirmedType: 'BACKEND', now: NOW });
  assert.equal(result.action, 'CORRECTED');
  assert.equal(result.previousEffectiveType, 'FRONTEND');
  assert.equal(store.profile?.detectedType, 'FRONTEND');
  assert.equal(store.profile?.confirmedType, 'BACKEND');
  assert.equal(store.profile?.effectiveType, 'BACKEND');
  assert.equal(store.revisions.at(-1)?.reason, 'CORRECTED');
});

test('confirming the detected type is a plain confirmation', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const result = await confirmArchitecture(store, { applicationId: APP, userId: 'user-1', confirmedType: 'FRONTEND', now: NOW });
  assert.equal(result.action, 'CONFIRMED');
  assert.equal(store.profile?.confirmedByUserId, 'user-1');
});

test('confirmation before analysis is refused', async () => {
  await assert.rejects(
    confirmArchitecture(memoryStore(), { applicationId: APP, userId: 'u', confirmedType: 'MIXED', now: NOW }),
    (error: unknown) => error instanceof ArchitectureError && error.code === 'NOT_ANALYSED',
  );
});

test('a confirmed architecture that changes materially is flagged for review and keeps its confirmed type', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  await confirmArchitecture(store, { applicationId: APP, userId: 'u', confirmedType: 'FRONTEND', now: NOW });
  const result = await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG,
    projection: projection({ detectedType: 'MIXED', traits: MIXED_TRAITS, analysisSnapshotId: 'snap-2' }), now: NOW,
  });
  assert.equal(result.reviewRequired, true);
  assert.equal(store.profile?.effectiveType, 'FRONTEND');
  assert.equal(store.profile?.detectedType, 'MIXED');
});

test('evidence transitions: the first backend event triggers a recompute, later events do not', async () => {
  const store = memoryStore();
  const first = await applyEvidence(store, { applicationId: APP, delta: { backendEventCount: 1 } });
  assert.ok(first.includes('BACKEND_EVENTS'));
  const second = await applyEvidence(store, { applicationId: APP, delta: { backendEventCount: 500 } });
  assert.deepEqual(second, []);
});

test('negative evidence deltas are rejected', async () => {
  await assert.rejects(applyEvidence(memoryStore(), { applicationId: APP, delta: { sessionCount: -1 } }));
});

test('backend service with its SDK: Endpoint Intelligence moves from waiting to available, logging one change', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, {
    applicationId: APP,
    organizationId: ORG,
    projection: projection({ detectedType: 'BACKEND', traits: SERVER_TRAITS, frameworks: [{ id: 'express', version: '4.19.0', sdkSupport: 'SUPPORTED' }] }),
    now: NOW,
  });
  await applyEvidence(store, { applicationId: APP, delta: { backendEventCount: 3 } });
  await applyEvidence(store, { applicationId: APP, delta: { endpointCount: 2 } });
  const result = await recompute(store);
  assert.equal(result.resolutions.ENDPOINT_INTELLIGENCE.state, 'AVAILABLE');

  const endpointChanges = store.changes.filter((change) => change.capabilityKey === 'ENDPOINT_INTELLIGENCE');
  assert.equal(endpointChanges.length, 1);
  assert.equal(endpointChanges[0].previousState, null);

  const repeat = await recompute(store, { now: new Date(NOW.getTime() + 1000) });
  assert.equal(repeat.changes.length, 0, 'a recompute with no transitions writes no state changes');
});

test('a manual confirmation of a type never makes evidence-backed capabilities available', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  await confirmArchitecture(store, { applicationId: APP, userId: 'u', confirmedType: 'MIXED', now: NOW });
  const result = await recompute(store);
  const evidenceBacked: CapabilityKey[] = ['ENDPOINT_INTELLIGENCE', 'SESSION_TIMELINE', 'MISSING_STATES', 'BEHAVIORAL_GRAPH'];
  for (const key of evidenceBacked) {
    assert.ok(!['AVAILABLE', 'LIMITED'].includes(result.resolutions[key].state), key);
  }
});

test('contradictory telemetry is kept and flags the profile rather than being discarded', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  await applyEvidence(store, { applicationId: APP, delta: { backendEventCount: 4 } });
  const result = await recompute(store);
  assert.equal(result.reviewRequired, true);
  assert.equal(store.evidence?.backendEventCount, 4);
});

test('a kill-switched capability resolves to UNAVAILABLE with the rollout reason', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const result = await recompute(store, { flags: readRolloutFlags({ CAPABILITIES_DISABLED: 'SESSION_TIMELINE' }) });
  assert.deepEqual(result.resolutions.SESSION_TIMELINE, { state: 'UNAVAILABLE', reason: 'ROLLOUT_DISABLED' });
});

test('an unanalysed application uses the legacy path for every plan-allowed capability', async () => {
  const result = await recompute(memoryStore());
  assert.deepEqual(result.resolutions.ENDPOINT_INTELLIGENCE, { state: 'AVAILABLE', reason: 'APPLICATION_PROFILE_UNKNOWN' });
});

test('material identity ignores confidence and snapshot id', () => {
  const a = projection();
  const b = projection({ confidence: 'LOW', analysisSnapshotId: 'other', scores: { frontend: 1, backend: 1 } });
  assert.equal(materialKey(a), materialKey(b));
});

test('rollout flags reject unknown capability keys and parse booleans', () => {
  assert.throws(() => readRolloutFlags({ CAPABILITIES_DISABLED: 'NOPE' }), /unknown capability/);
  const parsed = readRolloutFlags({ CAPABILITIES_ENFORCE: 'true', CAPABILITIES_UI: '1' });
  assert.equal(parsed.enforce, true);
  assert.equal(parsed.ui, true);
  assert.equal(parsed.disabled.size, 0);
});

test('notification eligibility: health alerts need live capability; setup nudges need NEEDS_SETUP', () => {
  assert.equal(notificationEligible('HEALTH_ALERT', 'AVAILABLE'), true);
  assert.equal(notificationEligible('HEALTH_ALERT', 'LIMITED'), true);
  assert.equal(notificationEligible('HEALTH_ALERT', 'NOT_APPLICABLE'), false);
  assert.equal(notificationEligible('HEALTH_ALERT', 'NEEDS_SETUP'), false);
  assert.equal(notificationEligible('SETUP_NUDGE', 'NEEDS_SETUP'), true);
  assert.equal(notificationEligible('SETUP_NUDGE', 'AVAILABLE'), false);
});

test('empty evidence is the zero state', () => {
  assert.equal(EMPTY_EVIDENCE.backendEventCount, 0);
});

test('a monorepo workspace is chosen only from the candidates the analysis found', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG,
    projection: projection({ workspaceCandidates: ['apps/web', 'services/api'] }),
    now: NOW,
  });
  assert.deepEqual(store.profile?.workspaceCandidates, ['apps/web', 'services/api']);

  await assert.rejects(
    selectWorkspace(store, { applicationId: APP, workspaceRoot: 'tools/scripts', now: NOW }),
    (error: unknown) => error instanceof ArchitectureError && error.code === 'INVALID_WORKSPACE',
  );

  const chosen = await selectWorkspace(store, { applicationId: APP, workspaceRoot: 'services/api', now: NOW });
  assert.equal(chosen.workspaceRoot, 'services/api');
  assert.equal(store.profile?.workspaceRoot, 'services/api');
});

test('the repository root is always a valid workspace choice', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, { applicationId: APP, organizationId: ORG, projection: projection(), now: NOW });
  const chosen = await selectWorkspace(store, { applicationId: APP, workspaceRoot: '.', now: NOW });
  assert.equal(chosen.workspaceRoot, '.');
});

test('a re-analysis keeps the chosen workspace rather than resetting it', async () => {
  const store = memoryStore();
  await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG,
    projection: projection({ workspaceCandidates: ['apps/web'] }), now: NOW,
  });
  await selectWorkspace(store, { applicationId: APP, workspaceRoot: 'apps/web', now: NOW });
  await recordArchitectureProjection(store, {
    applicationId: APP, organizationId: ORG,
    projection: projection({ workspaceCandidates: ['apps/web'], analysisSnapshotId: 'snap-2' }), now: NOW,
  });
  assert.equal(store.profile?.workspaceRoot, 'apps/web');
});
