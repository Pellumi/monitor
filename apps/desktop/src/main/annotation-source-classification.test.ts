import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySourceAvailability } from './annotation-source-classification';

test('no connected workspace — including a deployed-URL run with no local checkout — is NOT_CONNECTED, regardless of analysis state', () => {
  assert.deepEqual(classifySourceAvailability(false, null), { status: 'NOT_CONNECTED' });
  assert.deepEqual(
    classifySourceAvailability(false, { id: 'a1', status: 'COMPLETED' }),
    { status: 'NOT_CONNECTED' },
    'a workspace being connected to a DIFFERENT application must not leak that application\'s finished analysis',
  );
});

test('a connected workspace with no analysis yet, or a failed/pending one, is ANALYSIS_UNAVAILABLE', () => {
  assert.deepEqual(classifySourceAvailability(true, null), { status: 'ANALYSIS_UNAVAILABLE', analysisId: null });
  assert.deepEqual(
    classifySourceAvailability(true, { id: 'a1', status: 'FAILED' }),
    { status: 'ANALYSIS_UNAVAILABLE', analysisId: 'a1' },
  );
  assert.deepEqual(
    classifySourceAvailability(true, { id: 'a1', status: 'PENDING' }),
    { status: 'ANALYSIS_UNAVAILABLE', analysisId: 'a1' },
  );
});

test('a completed or partial analysis on a connected workspace is handed off to resolveAnnotationSource', () => {
  assert.deepEqual(classifySourceAvailability(true, { id: 'a1', status: 'COMPLETED' }), { status: 'RESOLVE', analysisId: 'a1' });
  assert.deepEqual(classifySourceAvailability(true, { id: 'a1', status: 'PARTIAL' }), { status: 'RESOLVE', analysisId: 'a1' });
});
