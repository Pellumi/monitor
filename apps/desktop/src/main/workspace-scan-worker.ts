import { parentPort, workerData } from 'node:worker_threads';
import { scanWorkspace } from '@tellann/project-intelligence';

/**
 * Take the repository snapshot off the main process.
 *
 * Scanning reads every source file in the folder — up to twenty thousand of them
 * — synchronously, and regex-matches each one for routes and endpoints. Doing
 * that on the Electron main process freezes the window for as long as it takes,
 * which is the same problem the Flow mapping worker exists to solve, in the step
 * immediately before it. It also runs again on every instrumentation proposal,
 * so it is not a one-off cost paid at attach time.
 */

if (!parentPort) throw new Error('WORKSPACE_SCAN_WORKER_PARENT_REQUIRED');

const port = parentPort;
const input = workerData as {
  root: string;
  options: Parameters<typeof scanWorkspace>[1];
};

try {
  port.postMessage({ type: 'complete', snapshot: scanWorkspace(input.root, input.options) });
} catch (error) {
  port.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : 'WORKSPACE_SCAN_FAILED',
  });
}
