import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import type { TellannBackendConfig } from './TELLANN';
import { currentRequestContext, recordDataAccess } from './requestContext';

export interface TrackDataAccessOptions {
  /** The model, table or collection the operation ran against. */
  model: string;
  /** The operation as the data layer names it: `findMany`, `UPDATE`, `save`. */
  operation: string;
  /** How many records it read or changed, where the data layer reports it. */
  records?: number | null;
  durationMs?: number | null;
  /** Leave unset to infer from the operation name. */
  mutation?: boolean;
  sessionId?: string;
  runId?: string;
  traceId?: string;
}

const MUTATION_PATTERN = /create|update|delete|upsert|insert|write|save|remove|drop|truncate/i;

export function isMutationOperation(operation: string): boolean {
  return MUTATION_PATTERN.test(operation);
}

/**
 * Reports one persistence operation.
 *
 * Two things happen with it. It is attached to the in-flight request, so the
 * request's own event can say which models it touched; and it is sent on its
 * own, so a run still records work that happened outside any request - a
 * migration, a background job, a queue consumer.
 */
export async function trackDataAccessEvent(
  config: TellannBackendConfig,
  options: TrackDataAccessOptions,
): Promise<void> {
  const mutation = options.mutation ?? isMutationOperation(options.operation);
  const context = recordDataAccess({
    model: options.model,
    operation: options.operation,
    records: options.records ?? null,
    durationMs: options.durationMs ?? null,
    mutation,
  }) ?? currentRequestContext();

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
    eventType: 'BUSINESS_EVENT',
    timestamp: new Date().toISOString(),
    metadata: {
      // The desktop routes on this discriminator, the same way it routes
      // client-state evidence from the frontend adapters.
      businessEventType: 'QA_BACKEND_DATA_ACCESS',
      model: String(options.model).slice(0, 120),
      operation: String(options.operation).slice(0, 60),
      records: options.records ?? null,
      durationMs: options.durationMs ?? null,
      mutation,
      route: context?.route ?? null,
      method: context?.method ?? null,
    },
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    if (config.environmentId) headers['x-tellann-environment-id'] = config.environmentId;
    if (event.runId) headers['x-tellann-run-id'] = event.runId;
    if (event.traceId) headers['x-tellann-trace-id'] = event.traceId;
    await fetch(`${config.endpoint}/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
  } catch {
    // Telemetry never fails the operation it describes.
  }
}
