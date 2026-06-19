import { v4 as uuidv4 } from 'uuid';
import { SotsEvent } from '@sots/shared';
import { SotsBackendConfig } from './SOTS';

export interface TrackApiOptions {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  /** Optional: correlate with a frontend session via X-SOTS-Session-ID header */
  sessionId?: string;
  /** Optional: idempotency / tracing */
  requestId?: string;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function trackApiEvent(
  config: SotsBackendConfig,
  options: TrackApiOptions
): Promise<void> {
  const event: SotsEvent = {
    eventId: uuidv4(),
    sessionId: options.sessionId ?? uuidv4(),
    tenantId: config.tenantId ?? 'unknown',
    applicationId: config.applicationId,
    environmentId: config.environmentId ?? null,
    source: 'backend-sdk',
    eventVersion: '1.0',
    eventType: 'API_REQUEST',
    timestamp: new Date().toISOString(),
    metadata: {
      requestId: options.requestId ?? uuidv4(),
      endpoint: options.endpoint,
      method: options.method.toUpperCase(),
      statusCode: options.statusCode,
      durationMs: options.durationMs,
    },
  };

  // Enforce Size Limit
  try {
    const eventJson = JSON.stringify(event);
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    if (eventSize > MAX_EVENT_SIZE_BYTES) {
      console.error(
        `[SOTS Backend] API request event discarded. Size (${eventSize} bytes) exceeds limit of ${MAX_EVENT_SIZE_BYTES} bytes.`
      );
      return;
    }
  } catch (err) {
    console.error('[SOTS Backend] Failed to compute size of API event, discarding', err);
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
