import { v4 as uuidv4 } from 'uuid';
import type { TellannEvent } from '../event-types';
import type { TellannBackendConfig } from './TELLANN';
import {
  currentRequestContext,
  recordDataAccess,
  summarizeDataAccess,
  type TellannRequestContext,
} from './requestContext';

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
 * Inside a request it is recorded and nothing is sent: the request's own
 * middleware flushes one event per model and operation when the response is
 * done, so a handler that reads a model in a loop produces one row rather than
 * a thousand. Outside a request - a migration, a queue consumer, a management
 * command - there is nothing to flush it later, so it is sent immediately.
 */
export async function trackDataAccessEvent(
  config: TellannBackendConfig,
  options: TrackDataAccessOptions,
): Promise<void> {
  const mutation = options.mutation ?? isMutationOperation(options.operation);
  const recorded = recordDataAccess({
    model: options.model,
    operation: options.operation,
    records: options.records ?? null,
    durationMs: options.durationMs ?? null,
    mutation,
  });
  if (recorded) return;
  await sendDataAccessEvent(config, {
    model: options.model,
    operation: options.operation,
    records: options.records ?? null,
    durationMs: options.durationMs ?? null,
    mutation,
    count: 1,
  }, currentRequestContext(), options);
}

/**
 * Sends one event per model and operation the request touched.
 *
 * Called by the framework integrations once the response is done. Safe to call
 * twice: the context is emptied as it is flushed.
 */
export async function flushRequestDataAccess(
  config: TellannBackendConfig,
  context: TellannRequestContext | undefined,
): Promise<void> {
  if (!context?.dataAccess.length) return;
  const summary = summarizeDataAccess(context.dataAccess);
  context.dataAccess = [];
  await Promise.all(summary.map((entry) => sendDataAccessEvent(config, {
    model: entry.model,
    operation: entry.operation,
    records: entry.records,
    durationMs: null,
    mutation: entry.mutation,
    count: entry.count,
  }, context, {})));
}

async function sendDataAccessEvent(
  config: TellannBackendConfig,
  access: {
    model: string;
    operation: string;
    records: number | null;
    durationMs: number | null;
    mutation: boolean;
    count: number;
  },
  context: TellannRequestContext | undefined,
  options: Partial<TrackDataAccessOptions>,
): Promise<void> {
  const { model, operation, records, durationMs, mutation } = access;
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
      model: String(model).slice(0, 120),
      operation: String(operation).slice(0, 60),
      records,
      durationMs,
      mutation,
      // How many individual operations this row stands for.
      count: access.count,
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
