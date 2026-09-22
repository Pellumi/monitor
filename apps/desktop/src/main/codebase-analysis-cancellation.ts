const ACTIVE_ANALYSIS = new Set([
  'QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
]);

export type AnalysisCancellationState = {
  mode: 'cloud' | 'local';
  cloudJobId: string | null;
  status: string | null;
} | null;

type UploadCancellation = {
  cancelled: boolean;
  abort: (() => void) | null;
};

/**
 * Stop whichever process currently owns an analysis.
 *
 * An active persisted state may have no worker after the desktop restarts. That
 * is still a cancellable run from the member's point of view: marking the stale
 * state cancelled is what releases the UI so a fresh analysis can be started.
 */
export async function cancelCodebaseAnalysisRun(input: {
  state: AnalysisCancellationState;
  upload?: UploadCancellation;
  stopLocalWorker?: () => Promise<void>;
  cancelCloudJob: (jobId: string) => Promise<unknown>;
  markCancelled: () => void;
}): Promise<{ cancelled: boolean }> {
  if (input.upload) {
    input.upload.cancelled = true;
    input.upload.abort?.();
    input.markCancelled();
    return { cancelled: true };
  }

  if (input.state?.mode === 'cloud' && input.state.cloudJobId) {
    await input.cancelCloudJob(input.state.cloudJobId).catch(() => undefined);
    input.markCancelled();
    return { cancelled: true };
  }

  if (input.stopLocalWorker) {
    await input.stopLocalWorker();
    input.markCancelled();
    return { cancelled: true };
  }

  if (input.state?.status && ACTIVE_ANALYSIS.has(input.state.status)) {
    input.markCancelled();
    return { cancelled: true };
  }

  return { cancelled: false };
}
