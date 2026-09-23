import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import { TellannBackendConfig } from './TELLANN';
import {
  payloadBytes,
  resolveCaptureConfig,
  sanitizeHeaders,
  sanitizePayload,
} from './capture';
import { currentRequestContext, summarizeDataAccess } from './requestContext';
import { postQaEvidence } from './qaEvidence';

export interface TrackApiOptions {
  /** The concrete path the client called. */
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  /**
   * The route template the framework matched, e.g. `/orders/:id`. Supplying it
   * is what keeps a thousand calls to `/orders/17` from reading as a thousand
   * distinct endpoints, and keeps identifiers out of the grouping key.
   */
  route?: string;
  /** Optional: correlate with a frontend session via X-TELLANN-Session-ID header */
  sessionId?: string;
  /** Optional: idempotency / tracing */
  requestId?: string;
  runId?: string;
  traceId?: string;
  /** Parsed query parameters. Credential-shaped keys are dropped. */
  query?: Record<string, unknown>;
  requestBody?: unknown;
  responseBody?: unknown;
  requestHeaders?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
  /** The function or controller that served the request, where it is known. */
  handler?: string;
  framework?: string;
  /**
   * Models this request touched. Left unset, it is taken from whatever the
   * data-access hooks recorded while the request was in flight.
   */
  models?: Array<{ model: string; operation?: string; records?: number | null }>;
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit

function eventBytes(event: TellannEvent): number | null {
  try {
    return Buffer.byteLength(JSON.stringify(event), 'utf8');
  } catch {
    return null;
  }
}

export async function trackApiEvent(
  config: TellannBackendConfig,
  options: TrackApiOptions
): Promise<void> {
  const capture = resolveCaptureConfig(config.capture);
  const context = currentRequestContext();
  const models = options.models?.length
    ? options.models.map((entry) => ({
        model: String(entry.model),
        operation: entry.operation ?? null,
        records: entry.records ?? null,
      }))
    : summarizeDataAccess(context?.dataAccess ?? []);

  const requestBody = capture.requestBody ? sanitizePayload(options.requestBody, capture) : undefined;
  const responseBody = capture.responseBody ? sanitizePayload(options.responseBody, capture) : undefined;
  const query = sanitizePayload(options.query, capture);

  const event: TellannEvent = {
    eventId: uuidv4(),
    sessionId: options.sessionId ?? context?.sessionId ?? config.sessionId ?? uuidv4(),
    tenantId: config.tenantId ?? 'unknown',
    applicationId: config.applicationId,
    environmentId: config.environmentId ?? null,
    runId: options.runId ?? context?.runId ?? config.runId ?? null,
    traceId: options.traceId ?? context?.traceId ?? config.traceId ?? null,
    agentVersion: config.agentVersion ?? null,
    instrumentationManifestVersion: config.instrumentationManifestVersion ?? null,
    source: 'backend-sdk',
    eventVersion: '1.0',
    eventType: 'API_REQUEST',
    timestamp: new Date().toISOString(),
    metadata: {
      requestId: options.requestId ?? uuidv4(),
      endpoint: options.endpoint,
      route: options.route ?? context?.route ?? null,
      method: options.method.toUpperCase(),
      statusCode: options.statusCode,
      durationMs: options.durationMs,
      handler: options.handler ?? null,
      framework: options.framework ?? null,
      // Sizes are reported even when the bodies themselves are not captured,
      // so a run can still show throughput for an endpoint whose payloads are
      // switched off.
      requestBytes: payloadBytes(options.requestBody) ?? null,
      responseBytes: payloadBytes(options.responseBody) ?? null,
      models,
      ...(query === undefined ? {} : { query }),
      ...(requestBody === undefined ? {} : { requestBody }),
      ...(responseBody === undefined ? {} : { responseBody }),
      ...(() => {
        const requestHeaders = sanitizeHeaders(options.requestHeaders, capture);
        const responseHeaders = sanitizeHeaders(options.responseHeaders, capture);
        return {
          ...(requestHeaders ? { requestHeaders } : {}),
          ...(responseHeaders ? { responseHeaders } : {}),
        };
      })(),
    },
  };

  // Enforce the size limit. An oversized event used to be dropped whole, which
  // silently lost the request from the run because one of its payloads was
  // large. Shedding the payloads keeps the request, its timing and its models.
  const size = eventBytes(event);
  if (size === null) return;
  if (size > MAX_EVENT_SIZE_BYTES) {
    const metadata = event.metadata as Record<string, unknown>;
    delete metadata.requestBody;
    delete metadata.responseBody;
    metadata.payloadsOmitted = 'EVENT_SIZE_LIMIT';
    const reduced = eventBytes(event);
    if (reduced === null || reduced > MAX_EVENT_SIZE_BYTES) {
      console.error(
        `[Tellann Backend] API request event discarded. Size (${size} bytes) exceeds limit of ${MAX_EVENT_SIZE_BYTES} bytes.`
      );
      return;
    }
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

  // A no-op unless this process is configured with a standing ingestion key
  // rather than a per-run relay credential — see `postQaEvidence`.
  await postQaEvidence(config, {
    eventType: 'QA_BACKEND_REQUEST',
    metadata: event.metadata as Record<string, unknown>,
    traceId: event.traceId,
    runId: event.runId,
  });
}
