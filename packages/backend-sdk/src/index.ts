import { SOTS } from './core/SOTS';
import { TrackApiOptions } from './core/trackApi';
import { CaptureErrorOptions } from './core/captureError';
import { TrackStateOptions } from './core/trackState';

export * from './core/SOTS';
export { TrackApiOptions } from './core/trackApi';
export { CaptureErrorOptions } from './core/captureError';
export { TrackStateOptions } from './core/trackState';
export * from './integrations/express';
export * from './integrations/fastify';

/**
 * Backward compatible helper to track an API call using the initialized SOTS singleton.
 */
export async function trackApi(options: TrackApiOptions): Promise<void> {
  await SOTS.trackApi(options);
}

/**
 * Backward compatible helper to capture an error using the initialized SOTS singleton.
 */
export async function captureError(options: CaptureErrorOptions): Promise<void> {
  await SOTS.captureError(options);
}

/**
 * Backward compatible helper to track a state transition using the initialized SOTS singleton.
 */
export async function trackState(options: TrackStateOptions): Promise<void> {
  await SOTS.trackState(options);
}
