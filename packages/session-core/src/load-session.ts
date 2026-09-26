import type { Prisma, PrismaClient } from '@tellann/db';
import type { TellannEvent } from '@tellann/shared';

/** The slice of a session row the envelope reconstruction needs. */
interface SessionWithEvents {
  tenantId: string;
  applicationId: string;
  environmentId: string | null;
  qaRunId: string | null;
  traceId: string | null;
  events: Array<{
    id: string;
    sessionId: string;
    eventType: string;
    eventVersion: string;
    source: string;
    timestamp: Date;
    metadata: unknown;
  }>;
}

/**
 * Rebuilds envelopes from persisted rows.
 *
 * The correlation fields live on the session, not on each event, so they are
 * stamped back onto every envelope here. Kept in one place because completion and
 * the replay endpoint both need it and had their own copies.
 */
export function toEventEnvelopes(session: SessionWithEvents): TellannEvent[] {
  return session.events.map((event) => ({
    eventId: event.id,
    sessionId: event.sessionId,
    tenantId: session.tenantId,
    applicationId: session.applicationId,
    environmentId: session.environmentId,
    runId: session.qaRunId,
    traceId: session.traceId,
    eventType: event.eventType as TellannEvent['eventType'],
    eventVersion: event.eventVersion as TellannEvent['eventVersion'],
    source: event.source,
    timestamp: event.timestamp.toISOString(),
    metadata: (event.metadata ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Every event of a session, oldest first, in envelope form.
 *
 * Reads through the `SessionEvent(sessionId, timestamp)` index built by the
 * schema-bootstrap job. Before that index existed this was a sequential scan of
 * the largest table in the schema, on every completion and every replay render.
 *
 * Accepts a transaction client as well as the plain client, so completion can do
 * this read *under* its advisory lock rather than before taking it.
 */
export async function loadSessionEvents(
  client: PrismaClient | Prisma.TransactionClient,
  sessionId: string,
): Promise<TellannEvent[]> {
  const session = await client.session.findUnique({
    where: { id: sessionId },
    include: { events: { orderBy: { timestamp: 'asc' } } },
  });
  if (!session) return [];
  return toEventEnvelopes(session);
}
