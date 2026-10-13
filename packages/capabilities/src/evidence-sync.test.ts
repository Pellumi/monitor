import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ApplicationTraits } from '@tellann/desktop-contracts';
import type { EvidenceCounts } from './evidence';
import { readRolloutFlags } from './flags';
import { syncEvidence, type AbsoluteCounts, type EventCounts, type EvidenceSource, type EvidenceWatermarkStore } from './evidence-sync';
import { recordArchitectureProjection, type ArchitectureStore, type ProfileRevision, type StateChange, type StoredProfile, type StoredSnapshot } from './service';
import type { CapabilityKey } from './types';

const NONE: ApplicationTraits = {
  browserSurface: false, frontendRuntime: false, backendRuntime: false, clientRouting: false,
  uiStateSurface: false, apiConsumer: false, apiProvider: false, serverActions: false,
  serverRendering: false, managedBrowserRunnable: false,
};
const SERVER: ApplicationTraits = { ...NONE, backendRuntime: true, apiProvider: true };

type Store = ArchitectureStore & EvidenceWatermarkStore & {
  profile: StoredProfile | null;
  evidence: EvidenceCounts | null;
  watermark: Date | null;
  snapshots: Map<CapabilityKey, StoredSnapshot>;
  changes: StateChange[];
};

function store(): Store {
  const s: Store = {
    profile: null,
    evidence: null,
    watermark: null,
    snapshots: new Map(),
    changes: [],
    async getProfile() { return s.profile; },
    async saveProfile(profile) { s.profile = structuredClone(profile); },
    async listRevisions() { return [] as ProfileRevision[]; },
    async appendRevision() { /* not needed here */ },
    async getEvidence() { return s.evidence ? { ...s.evidence } : null; },
    async saveEvidence(_id, counts) { s.evidence = { ...counts }; },
    async getSnapshots() { return new Map(s.snapshots); },
    async saveSnapshots(_id, rows) { for (const row of rows) s.snapshots.set(row.capabilityKey, row); },
    async appendStateChanges(rows) { s.changes.push(...rows); },
    async getEvidenceWatermark() { return s.watermark; },
    async saveEvidenceWatermark(_id, at) { s.watermark = at; },
  };
  return s;
}

/** Fake source over an in-memory "event log": each event has an ingest time and a source. */
function fakeSource(log: Array<{ at: Date; source: 'frontend-sdk' | 'backend-sdk'; endpoint?: boolean }>, absolute: AbsoluteCounts) {
  const source: EvidenceSource = {
    async eventsSince(_id, since) {
      const rows = log.filter((event) => !since || event.at.getTime() > since.getTime());
      const counts: EventCounts = {
        frontendEventCount: rows.filter((r) => r.source === 'frontend-sdk').length,
        backendEventCount: rows.filter((r) => r.source === 'backend-sdk').length,
        browserEventCount: 0,
        endpointCount: rows.filter((r) => r.endpoint).length,
        latestIngestedAt: rows.length ? new Date(Math.max(...rows.map((r) => r.at.getTime()))) : null,
      };
      return counts;
    },
    async absoluteCounts() { return absolute; },
  };
  return { source };
}

const NOTHING: AbsoluteCounts = {
  sessionCount: 0, runCount: 0, observedStateCount: 0, observedWorkflowCount: 0, declaredFlowCount: 0, inFlowEventCount: 0, behaviorGraphVersion: null,
};
const T0 = new Date('2026-10-03T10:00:00Z');
const input = {
  applicationId: 'app-1',
  planAllows: () => true,
  canView: () => true,
  flags: readRolloutFlags({}),
  resolverVersion: 1,
  now: T0,
};

test('the first sync counts everything; a second sync with no new events adds nothing and recomputes nothing', async () => {
  const s = store();
  await recordArchitectureProjection(s, {
    applicationId: 'app-1', organizationId: 'org-1',
    projection: {
      detectedType: 'BACKEND', confidence: 'HIGH', scores: { frontend: 0, backend: 90 }, traits: SERVER,
      frameworks: [{ id: 'express', version: '4.19.0', sdkSupport: 'SUPPORTED' }], routeTemplates: [],
      workspaceRoot: '.', analysisSnapshotId: 'snap-1', detectorVersion: '1', warnings: [],
    },
    now: T0,
  });
  const { source } = fakeSource([
    { at: new Date(T0.getTime() + 1), source: 'backend-sdk', endpoint: true },
    { at: new Date(T0.getTime() + 2), source: 'backend-sdk' },
  ], NOTHING);

  const first = await syncEvidence(s, source, input);
  assert.equal(s.evidence?.backendEventCount, 2);
  assert.ok(first.transitions.includes('BACKEND_EVENTS'));
  assert.ok(first.recompute, 'a new evidence source triggers a recompute');
  assert.equal(s.watermark?.getTime(), T0.getTime() + 2);

  const second = await syncEvidence(s, source, input);
  assert.equal(s.evidence?.backendEventCount, 2, 'no double counting');
  assert.deepEqual(second.transitions, []);
  assert.equal(second.recompute, null);
});

test('a restart resumes from the watermark: events already counted are not counted again', async () => {
  const s = store();
  const log = [{ at: new Date(T0.getTime() + 1), source: 'frontend-sdk' as const }];
  await syncEvidence(s, fakeSource(log, NOTHING).source, input);
  log.push({ at: new Date(T0.getTime() + 5), source: 'frontend-sdk' as const });
  await syncEvidence(s, fakeSource(log, NOTHING).source, input);
  assert.equal(s.evidence?.frontendEventCount, 2);
});

test('relational totals are converted to deltas: a lower reading never reduces a stored count', async () => {
  const s = store();
  await syncEvidence(s, fakeSource([], { ...NOTHING, sessionCount: 10 }).source, input);
  await syncEvidence(s, fakeSource([], { ...NOTHING, sessionCount: 4 }).source, input);
  assert.equal(s.evidence?.sessionCount, 10);
});

test('a relational total that rises is applied as a delta, and a rise from zero triggers a transition', async () => {
  const s = store();
  const first = await syncEvidence(s, fakeSource([], { ...NOTHING, sessionCount: 3 }).source, input);
  assert.equal(first.delta.sessionCount, 3);
  assert.ok(first.transitions.includes('SESSIONS'));
  const second = await syncEvidence(s, fakeSource([], { ...NOTHING, sessionCount: 7 }).source, input);
  assert.equal(second.delta.sessionCount, 4);
  assert.deepEqual(second.transitions, []);
});

test('a behaviour graph appearing is itself evidence', async () => {
  const s = store();
  const result = await syncEvidence(s, fakeSource([], { ...NOTHING, behaviorGraphVersion: 'graph-7' }).source, input);
  assert.ok(result.transitions.includes('BEHAVIOR_GRAPH'));
  assert.equal(s.evidence?.behaviorGraphVersion, 'graph-7');
});

test('an application with no events and no relational data stays at zero, not as an observed claim', async () => {
  const s = store();
  const result = await syncEvidence(s, fakeSource([], NOTHING).source, input);
  assert.deepEqual(result.transitions, []);
  assert.equal(s.watermark, null);
});
