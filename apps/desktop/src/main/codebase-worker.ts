import { parentPort, workerData } from 'node:worker_threads';
import { analyzeCodebase } from '@tellann/project-intelligence';

if (!parentPort) throw new Error('CODEBASE_WORKER_PARENT_REQUIRED');

const input = workerData as { root: string; workspaceId: string; repositoryFingerprint: string };
try {
  const analysis = analyzeCodebase(input.root, input.workspaceId, input.repositoryFingerprint, (status, progress, stageMessage) => {
    parentPort!.postMessage({ type: 'progress', status, progress, stageMessage });
  });
  parentPort.postMessage({ type: 'complete', analysis });
} catch (error) {
  parentPort.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Codebase analysis failed' });
}
