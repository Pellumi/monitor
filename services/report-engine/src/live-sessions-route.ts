import type { PrismaClient } from '@tellann/db';
import type { Express, RequestHandler, Response } from 'express';
import type { CallerRequest } from './auth';

/**
 * Sessions that are recording right now.
 *
 * A reader who has just asked a user to reproduce something wants to watch it arrive, and
 * until now the only option was to reload the list and hope.
 *
 * Modelled on the notification stream in onboarding-api, deliberately, and NOT on the
 * api-gateway's `sseClients: Set`. That set is per process, so behind more than one replica a
 * client connected to instance A never hears about anything instance B wrote. This re-queries
 * Postgres on a timestamp cursor, so it is eventually correct however many replicas there
 * are — the poll is the mechanism and any in-process signal would only be an optimisation.
 */

/** How often the cursor is re-queried. */
const POLL_MS = 3_000;
/** A comment frame often enough to keep proxies and load balancers from idling us out. */
const HEARTBEAT_MS = 25_000;
/** Sessions per frame. A burst is truncated rather than allowed to stall the stream. */
const PAGE_SIZE = 25;

interface LiveSessionFrame {
  id: string;
  startTime: string;
  lastActivityAt: string;
  eventCount: number;
  endUserLabel: string | null;
  deviceType: string | null;
  /** True once completion has claimed it, which is when it becomes searchable. */
  isComplete: boolean;
}

export interface LiveSessionRouteDeps {
  prisma: PrismaClient;
  /** The guards this service already uses, passed in rather than re-derived here. */
  verifyCaller: RequestHandler;
  /** Ownership check that takes an explicit id, since this route's is in the query. */
  assertApplicationAccess: (
    req: CallerRequest,
    res: Response,
    applicationId: string,
  ) => Promise<unknown | null>;
}

/**
 * Mounted under `/sessions`, with the application in the query rather than the path.
 *
 * Not `/applications/:id/sessions/live`, which would be the natural shape: the gateway
 * forwards that prefix with `forwardToUpstream`, and that helper buffers the entire upstream
 * response before replying (`Buffer.from(await upstream.arrayBuffer())`). For an event stream
 * that never completes, so the request would simply hang. `/sessions` is registered as an
 * `@fastify/http-proxy` prefix, which streams — the same reason the notification stream lives
 * under `/organizations`.
 */
export function registerLiveSessionRoute(app: Express, deps: LiveSessionRouteDeps): void {
  const { prisma, verifyCaller, assertApplicationAccess } = deps;

  app.get(
    '/sessions/live',
    verifyCaller,
    async (req: CallerRequest, res: Response) => {
      const applicationId = typeof req.query.applicationId === 'string' ? req.query.applicationId : '';
      if (!applicationId) {
        res.status(400).json({ error: 'applicationId is required' });
        return;
      }
      // Ownership before anything is streamed, and before the headers go out -- once the
      // stream has started there is no way to answer 403.
      if (!(await assertApplicationAccess(req, res, applicationId))) return;

      const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : null;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Without this, nginx buffers the stream and nothing arrives until it decides to
        // flush — which for an event stream means never.
        'X-Accel-Buffering': 'no',
      });
      // Tells EventSource how long to wait before reconnecting, so a restart does not
      // produce a reconnect storm.
      res.write('retry: 5000\n\n');

      // Resume from where the client left off, so a reconnect does not replay everything or
      // skip what happened while it was away.
      const resume =
        (typeof req.headers['last-event-id'] === 'string' && req.headers['last-event-id'])
        || (typeof req.query.cursor === 'string' && req.query.cursor)
        || new Date(Date.now() - 5 * 60_000).toISOString();
      let cursor = new Date(resume);
      if (Number.isNaN(cursor.getTime())) cursor = new Date(Date.now() - 5 * 60_000);

      let closed = false;

      async function flush(): Promise<void> {
        if (closed) return;
        try {
          const sessions = await prisma.session.findMany({
            where: {
              applicationId,
              ...(environmentId ? { environmentId } : {}),
              // `updatedAt`, not startTime: a session that began before the cursor but is
              // still receiving events is exactly the one being watched.
              updatedAt: { gt: cursor },
            },
            orderBy: { updatedAt: 'asc' },
            take: PAGE_SIZE,
            select: {
              id: true,
              startTime: true,
              updatedAt: true,
              completedAt: true,
              deviceType: true,
              endUser: { select: { externalId: true, externalIdHash: true } },
              statistics: { select: { eventCount: true } },
              _count: { select: { events: true } },
            },
          });

          if (sessions.length === 0) return;

          for (const session of sessions) {
            const frame: LiveSessionFrame = {
              id: session.id,
              startTime: session.startTime.toISOString(),
              lastActivityAt: session.updatedAt.toISOString(),
              // The live count from the rows, not from statistics: statistics only exist
              // once the session has been completed, which is the opposite of live.
              eventCount: session.statistics?.eventCount ?? session._count.events,
              endUserLabel: session.endUser
                ? session.endUser.externalId ?? session.endUser.externalIdHash.slice(0, 12)
                : null,
              deviceType: session.deviceType,
              isComplete: session.completedAt !== null,
            };
            // The id is the cursor, which is what makes Last-Event-ID resumption work
            // without the client having to understand our pagination.
            res.write(`id: ${frame.lastActivityAt}\n`);
            res.write('event: session\n');
            res.write(`data: ${JSON.stringify(frame)}\n\n`);
          }

          cursor = sessions[sessions.length - 1].updatedAt;
        } catch (err) {
          // A failed poll must not end the stream: the next tick retries, and the client
          // keeps its place.
          console.error('[ReportEngine] Live session poll failed', err);
        }
      }

      const pollTimer = setInterval(() => { void flush(); }, POLL_MS);
      const heartbeatTimer = setInterval(() => {
        if (!closed) res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
      }, HEARTBEAT_MS);

      // Send whatever is already in flight, so the pane is not empty for the first poll
      // interval.
      void flush();

      req.on('close', () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
      });
    },
  );
}
