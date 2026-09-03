import { parentPort, workerData } from 'node:worker_threads';
import { analyzeCodebase } from '@tellann/project-intelligence';

if (!parentPort) throw new Error('CODEBASE_WORKER_PARENT_REQUIRED');

const port = parentPort;
const input = workerData as {
  root: string;
  workspaceId: string;
  repositoryFingerprint: string;
  cache?: unknown;
};

try {
  const result = analyzeCodebase(input.root, input.workspaceId, input.repositoryFingerprint, {
    cache: (input.cache as never) ?? null,
    onProgress: (status, progress, stageMessage) => {
      port.postMessage({ type: 'progress', status, progress, stageMessage });
    },
  });
  // The cache travels back with the result so the next scan can reuse the
  // fragments for files that did not change.
  port.postMessage({ type: 'complete', analysis: result.analysis, cache: result.cache });
} catch (error) {
  port.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : 'Codebase analysis failed',
  });
}
