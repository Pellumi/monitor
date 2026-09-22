import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import { TellannBackendConfig } from './TELLANN';
import { currentRequestContext } from './requestContext';

export interface CaptureErrorOptions {
  error: Error | unknown;
  context?: Record<string, any>;
  /** Optional: link to a frontend session */
  sessionId?: string;
  eventType?: 'SERVER_ERROR' | 'ERROR_OCCURRED';
  runId?: string;
  traceId?: string;
  /**
   * The route the error came from. Reported alongside the error rather than
   * only inside `context`, because a QA run groups server errors by route and
   * cannot go looking for it in a free-form bag.
   */
  route?: string;
  method?: string;
  statusCode?: number;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function captureErrorEvent(
  config: TellannBackendConfig,
  options: CaptureErrorOptions
): Promise<void> {
  const err = options.error instanceof Error ? options.error : new Error(String(options.error));
  const requestContext = currentRequestContext();

  const event: TellannEvent = {
    eventId: uuidv4(),
    sessionId: options.sessionId ?? requestContext?.sessionId ?? config.sessionId ?? uuidv4(),
    tenantId: config.tenantId ?? 'unknown',
    applicationId: config.applicationId,
    environmentId: config.environmentId ?? null,
    runId: options.runId ?? requestContext?.runId ?? config.runId ?? null,
    traceId: options.traceId ?? requestContext?.traceId ?? config.traceId ?? null,
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
      route: options.route ?? requestContext?.route ?? null,
      method: options.method ?? requestContext?.method ?? null,
      statusCode: options.statusCode ?? null,
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
    if (event.runId) headers['x-tellann-run-id'] = event.runId;
    if (event.traceId) headers['x-tellann-trace-id'] = event.traceId;

    await fetch(`${config.endpoint}/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
  } catch {
    // Silently swallow
  }
}
