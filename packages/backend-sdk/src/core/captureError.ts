import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import { TellannBackendConfig } from './TELLANN';

export interface CaptureErrorOptions {
  error: Error | unknown;
  context?: Record<string, any>;
  /** Optional: link to a frontend session */
  sessionId?: string;
  eventType?: 'SERVER_ERROR' | 'ERROR_OCCURRED';
  runId?: string;
  traceId?: string;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function captureErrorEvent(
  config: TellannBackendConfig,
  options: CaptureErrorOptions
): Promise<void> {
  const err = options.error instanceof Error ? options.error : new Error(String(options.error));

  const event: TellannEvent = {
    eventId: uuidv4(),
    sessionId: options.sessionId ?? config.sessionId ?? uuidv4(),
    tenantId: config.tenantId ?? 'unknown',
    applicationId: config.applicationId,
    environmentId: config.environmentId ?? null,
    runId: options.runId ?? config.runId ?? null,
    traceId: options.traceId ?? config.traceId ?? null,
    agentVersion: config.agentVersion ?? null,
    instrumentationManifestVersion: config.instrumentationManifestVersion ?? null,
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
      headers['x-tellann-environment-id'] = config.environmentId;
    }
    if (config.runId) headers['x-tellann-run-id'] = config.runId;
    if (config.traceId) headers['x-tellann-trace-id'] = config.traceId;

    await fetch(`${config.endpoint}/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
  } catch {
    // Silently swallow
  }
}
