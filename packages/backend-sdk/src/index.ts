import { TELLANN } from './core/TELLANN';
import { TrackApiOptions } from './core/trackApi';
import { CaptureErrorOptions } from './core/captureError';
import { TrackStateOptions } from './core/trackState';
import { TrackDataAccessOptions } from './core/trackDataAccess';

export * from './core/TELLANN';
export type { EventType, TellannEvent } from './event-types';
export { TrackApiOptions } from './core/trackApi';
export { CaptureErrorOptions } from './core/captureError';
export { TrackStateOptions } from './core/trackState';
export { TrackDataAccessOptions, isMutationOperation } from './core/trackDataAccess';
export type { TellannCaptureConfig } from './core/capture';
export {
  currentRequestContext,
  recordDataAccess,
  runInRequestContext,
  summarizeDataAccess,
} from './core/requestContext';
export type { TellannDataAccess, TellannRequestContext } from './core/requestContext';
export * from './integrations/express';
export * from './integrations/fastify';
export * from './integrations/koa';
export * from './integrations/hapi';
export * from './integrations/prisma';

/**
 * Backward compatible helper to track an API call using the initialized TELLANN singleton.
 */
export async function trackApi(options: TrackApiOptions): Promise<void> {
  await TELLANN.trackApi(options);
}

/**
 * Backward compatible helper to capture an error using the initialized TELLANN singleton.
 */
export async function captureError(options: CaptureErrorOptions): Promise<void> {
  await TELLANN.captureError(options);
}

/**
 * Backward compatible helper to track a state transition using the initialized TELLANN singleton.
 */
export async function trackState(options: TrackStateOptions): Promise<void> {
  await TELLANN.trackState(options);
}

/**
 * Backward compatible helper to report a persistence operation using the
 * initialized TELLANN singleton.
 */
export async function trackDataAccess(options: TrackDataAccessOptions): Promise<void> {
  await TELLANN.trackDataAccess(options);
}
