import { v4 as uuidv4 } from 'uuid';
import type { TellannBackendConfig } from './TELLANN';

/**
 * The desktop app's local relay only ever binds to loopback (see
 * `LocalRunRelay.start`), so an endpoint pointed anywhere else is the
 * standing, environment-scoped gateway a deployed server is configured with
 * once and never has to change per run.
 */
export function isLocalRelayEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * One evidence session per process, not per event.
 *
 * `QAEvidenceEventSchema` groups events by `(sessionId, localSequence)` the
 * same way the desktop's own recorder does; a process that lives for the
 * lifetime of a request or a worker keeps one sequence for as long as it
 * runs, so `localSequence` only has to be unique within that lifetime.
 */
let evidenceSessionId: string | null = null;
let evidenceSequence = 0;

export function nextEvidenceEnvelope(): { sessionId: string; localSequence: number } {
  if (!evidenceSessionId) evidenceSessionId = uuidv4();
  evidenceSequence += 1;
  return { sessionId: evidenceSessionId, localSequence: evidenceSequence };
}

export interface QaEvidencePost {
  eventType: 'QA_BACKEND_REQUEST' | 'QA_BACKEND_ERROR' | 'QA_BACKEND_DATA_ACCESS';
  metadata: Record<string, unknown>;
  traceId?: string | null;
  runId?: string | null;
}

/**
 * Posts one backend evidence event through the environment's standing
 * ingestion key rather than a credential scoped to a single run.
 *
 * Which run this lands on is resolved server-side, against whichever run is
 * currently recording for this environment — see
 * `POST /environments/:environmentId/qa-evidence/batch` in onboarding-api.
 * Silently a no-op when the config carries no `apiKey`/`environmentId`
 * (nothing configured to post through) or when the endpoint is the desktop's
 * own local relay (which already carries backend evidence its own way, over
 * `/v1/events`).
 */
export async function postQaEvidence(config: TellannBackendConfig, input: QaEvidencePost): Promise<void> {
  if (!config.apiKey || !config.environmentId || isLocalRelayEndpoint(config.endpoint)) return;
  const envelope = nextEvidenceEnvelope();
  const event = {
    schemaVersion: '2.0' as const,
    eventId: uuidv4(),
    sessionId: envelope.sessionId,
    traceId: input.traceId ?? config.traceId ?? null,
    applicationId: config.applicationId,
    environmentId: config.environmentId,
    localSequence: envelope.localSequence,
    timestamp: new Date().toISOString(),
    eventType: input.eventType,
    source: 'BACKEND_SDK' as const,
    scope: 'PRE_BOUNDARY' as const,
    metadata: input.metadata,
    protectedValues: [] as unknown[],
    ...(input.runId ?? config.runId ? { runId: input.runId ?? config.runId } : {}),
  };
  try {
    await fetch(`${config.endpoint}/environments/${config.environmentId}/qa-evidence/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ events: [event] }),
    });
  } catch {
    // Telemetry never fails the operation it describes.
  }
}
