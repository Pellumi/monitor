import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildCapabilityBasis, evidenceBasis } from './basis';
import { EMPTY_EVIDENCE } from './evidence';

test('evidence basis distinguishes connected telemetry from absent telemetry', () => {
  const lines = evidenceBasis({ ...EMPTY_EVIDENCE, frontendEventCount: 12, browserEventCount: 3 });
  assert.deepEqual(lines, [
    { label: 'Frontend telemetry', status: 'CONNECTED' },
    { label: 'Backend telemetry', status: 'NOT_CONNECTED' },
    { label: 'Browser evidence', status: 'PRESENT' },
    { label: 'Declared intent', status: 'ABSENT' },
  ]);
});

test('with no evidence summary at all, every line reads as not connected or absent, never as present', () => {
  for (const line of evidenceBasis(null)) {
    assert.ok(line.status === 'NOT_CONNECTED' || line.status === 'ABSENT', line.label);
  }
});

test('a basis records each capability with its reason, the architecture revision, and the resolver version', () => {
  const basis = buildCapabilityBasis({
    resolverVersion: 1,
    architectureRevisionNumber: 4,
    resolutions: {
      ENDPOINT_INTELLIGENCE: { state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED' },
      FLOW_DECLARATION: { state: 'AVAILABLE' },
    } as never,
    counts: null,
    stampedAt: new Date('2026-10-03T10:00:00Z'),
  });
  assert.equal(basis.architectureRevisionNumber, 4);
  assert.equal(basis.resolverVersion, 1);
  assert.deepEqual(basis.capabilities.ENDPOINT_INTELLIGENCE, { state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED' });
  assert.deepEqual(basis.capabilities.FLOW_DECLARATION, { state: 'AVAILABLE', reason: null });
  assert.equal(basis.stampedAt, '2026-10-03T10:00:00.000Z');
});
