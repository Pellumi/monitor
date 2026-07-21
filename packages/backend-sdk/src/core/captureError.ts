import { v4 as uuidv4 } from 'uuid';
import { SotsEvent } from '@sots/shared';
import { SotsBackendConfig } from './SOTS';

export interface CaptureErrorOptions {
  error: Error | unknown;
  context?: Record<string, any>;
  /** Optional: link to a frontend session */
  sessionId?: string;
  eventType?: 'SERVER_ERROR' | 'ERROR_OCCURRED';
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function captureErrorEvent(
  config: SotsBackendConfig,
  options: CaptureErrorOptions
): Promise<void> {
  const err = options.error instanceof Error ? options.error : new Error(String(options.error));

  const event: SotsEvent = {
    eventId: uuidv4(),
    sessionId: options.sessionId ?? uuidv4(),
    tenantId: config.tenantId ?? 'unknown',
    applicationId: config.applicationId,
    environmentId: config.environmentId ?? null,
    source: 'backend-sdk',
    eventVersion: '1.0',
    eventType: options.eventType ?? 'SERVER_ERROR',
    timestamp: new Date().toISOString(),
    metadata: {
      message: err.message,
      stack: err.stack ?? null,
      name: err.name,
      context: options.context ?? {},
    },
  };

  // Enforce Size Limit
  try {
    const eventJson = JSON.stringify(event);
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    if (eventSize > MAX_EVENT_SIZE_BYTES) {
      console.error(
        `[Tellann Backend] Error event discarded. Size (${eventSize} bytes) exceeds limit of ${MAX_EVENT_SIZE_BYTES} bytes.`
      );
      return;
    }
  } catch (err) {
    console.error('[Tellann Backend] Failed to compute size of error event, discarding', err);
    return;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    if (config.environmentId) {
      headers['x-sots-environment-id'] = config.environmentId;
    }

    await fetch(`${config.endpoint}/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
  } catch {
    // Silently swallow
  }
}
