import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import { TellannBackendConfig } from './TELLANN';

export interface TrackStateOptions {
  stateName: string;
  category?: 'BUSINESS' | 'NAVIGATION' | 'SYSTEM';
  sessionId?: string;
  context?: Record<string, any>;
  runId?: string;
  traceId?: string;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

export async function trackStateEvent(
  config: TellannBackendConfig,
  options: TrackStateOptions
): Promise<void> {
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
    eventType: 'STATE_ENTERED',
    timestamp: new Date().toISOString(),
    metadata: {
      stateName: options.stateName,
      category: options.category ?? 'BUSINESS',
      context: options.context ?? {},
    },
  };

  // Enforce Size Limit
  try {
    const eventJson = JSON.stringify(event);
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    if (eventSize > MAX_EVENT_SIZE_BYTES) {
      console.error(
        `[Tellann Backend] State event discarded. Size (${eventSize} bytes) exceeds limit of ${MAX_EVENT_SIZE_BYTES} bytes.`
      );
      return;
    }
  } catch (err) {
    console.error('[Tellann Backend] Failed to compute size of state event, discarding', err);
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
