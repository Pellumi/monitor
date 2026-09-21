import { parentPort, workerData } from 'node:worker_threads';
import { buildSanitizedSourceArchive, previewSanitizedSourceArchive } from '@tellann/project-intelligence';

/**
 * Read the folder for the consent dialog and for the upload, off the main
 * process.
 *
 * Both passes walk, redact and size every source file in the folder
 * synchronously — the same freeze the workspace scan worker exists to avoid, in
 * the two steps immediately after it. On the main process the archive build also
 * made Cancel a dead button for the whole "Preparing the sanitized source
 * snapshot" stage, because the IPC that carries the click cannot be delivered
 * while the archive is being built. Here, cancelling is `worker.terminate()`.
 */

if (!parentPort) throw new Error('SOURCE_ARCHIVE_WORKER_PARENT_REQUIRED');

const port = parentPort;
const input = workerData as { root: string; mode: 'archive' | 'preview'; maxBytes?: number };

try {
  port.postMessage(
    input.mode === 'preview'
      ? { type: 'complete', preview: previewSanitizedSourceArchive(input.root, input.maxBytes) }
      : { type: 'complete', archive: buildSanitizedSourceArchive(input.root, input.maxBytes) },
  );
} catch (error) {
  port.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : 'SOURCE_ARCHIVE_FAILED',
  });
}
