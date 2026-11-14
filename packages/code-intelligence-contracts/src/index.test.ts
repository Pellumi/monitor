import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import { computeAnalysisGraphVersion } from './index';

const base = {
  repositoryFingerprint: 'repo',
  contentHash: 'content',
  analyzerVersions: { coordinator: '2.2.0', typescript: '5.9.3' },
  entities: [
    { id: 'b', evidence: [], metadata: { z: 1, a: 2 } },
    { id: 'a', evidence: [], metadata: {} },
  ],
  relationships: [
    { id: 'r2', evidence: [], source: 'b', target: 'a' },
    { id: 'r1', evidence: [], source: 'a', target: 'b' },
  ],
} as unknown as Pick<CodebaseAnalysis, 'repositoryFingerprint' | 'contentHash' | 'analyzerVersions' | 'entities' | 'relationships'>;

test('graph identity ignores entity, edge, analyzer-map, and object-key insertion order', () => {
  const reordered = {
    ...base,
    analyzerVersions: { typescript: '5.9.3', coordinator: '2.2.0' },
    entities: [...base.entities].reverse(),
    relationships: [...base.relationships].reverse(),
  };
  assert.equal(computeAnalysisGraphVersion(base), computeAnalysisGraphVersion(reordered));
});

test('graph identity changes with content, analyzer, entity, or edge semantics', () => {
  const original = computeAnalysisGraphVersion(base);
  assert.notEqual(original, computeAnalysisGraphVersion({ ...base, contentHash: 'changed' }));
  assert.notEqual(original, computeAnalysisGraphVersion({ ...base, analyzerVersions: { ...base.analyzerVersions, coordinator: '3' } }));
  assert.notEqual(original, computeAnalysisGraphVersion({ ...base, entities: [{ ...base.entities[0]!, name: 'changed' }, base.entities[1]!] }));
  assert.notEqual(original, computeAnalysisGraphVersion({ ...base, relationships: [{ ...base.relationships[0]!, type: 'CALLS' }, base.relationships[1]!] }));
});
