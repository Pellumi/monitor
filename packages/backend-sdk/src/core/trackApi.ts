import { v4 as uuidv4 } from 'uuid';
import type { SotsEvent } from '../event-types';
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
  runId?: string;
  traceId?: string;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function trackApiEvent(
  config: SotsBackendConfig,
  options: TrackApiOptions
): Promise<void> {
  const event: SotsEvent = {
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
        `[Tellann Backend] API request event discarded. Size (${eventSize} bytes) exceeds limit of ${MAX_EVENT_SIZE_BYTES} bytes.`
      );
      return;
    }
  } catch (err) {
    console.error('[Tellann Backend] Failed to compute size of API event, discarding', err);
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
