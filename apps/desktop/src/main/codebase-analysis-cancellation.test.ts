import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelCodebaseAnalysisRun } from './codebase-analysis-cancellation';

test('cancels an interrupted active analysis even when no worker survived the restart', async () => {
  let marked = 0;
  const result = await cancelCodebaseAnalysisRun({
    state: { mode: 'local', cloudJobId: null, status: 'SUMMARIZING' },
    cancelCloudJob: async () => undefined,
    markCancelled: () => { marked += 1; },
  });

  assert.deepEqual(result, { cancelled: true });
  assert.equal(marked, 1);
});

test('terminates a live local worker before recording cancellation', async () => {
  const order: string[] = [];
  const result = await cancelCodebaseAnalysisRun({
    state: { mode: 'local', cloudJobId: null, status: 'PARSING' },
    stopLocalWorker: async () => { order.push('worker'); },
    cancelCloudJob: async () => undefined,
    markCancelled: () => { order.push('state'); },
  });

  assert.deepEqual(result, { cancelled: true });
  assert.deepEqual(order, ['worker', 'state']);
});

test('cancels a cloud job and records a terminal local state', async () => {
  const order: string[] = [];
  const result = await cancelCodebaseAnalysisRun({
    state: { mode: 'cloud', cloudJobId: 'job-1', status: 'GRAPHING' },
    cancelCloudJob: async (jobId) => { order.push(`cloud:${jobId}`); },
    markCancelled: () => { order.push('state'); },
  });

  assert.deepEqual(result, { cancelled: true });
  assert.deepEqual(order, ['cloud:job-1', 'state']);
});

test('does not rewrite a run that is already terminal', async () => {
  let marked = false;
  const result = await cancelCodebaseAnalysisRun({
    state: { mode: 'local', cloudJobId: null, status: 'COMPLETED' },
    cancelCloudJob: async () => undefined,
    markCancelled: () => { marked = true; },
  });

  assert.deepEqual(result, { cancelled: false });
  assert.equal(marked, false);
});
