import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { TELLANN } from '../../core/TELLANN';
import { runInRequestContext } from '../../core/requestContext';

declare global {
  namespace Express {
    interface Request {
      tellann?: {
        sessionId?: string;
        runId?: string;
        traceId?: string;
      };
    }
  }
}

export function extractSessionId(headers: Record<string, any>): string | undefined {
  if (headers['x-tellann-session-id'] || headers['x-tellann-session-id']) {
    return (headers['x-tellann-session-id'] || headers['x-tellann-session-id']) as string;
  }
  const traceparent = headers['traceparent'] as string | undefined;
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 2 && parts[1].length === 32) {
      const t = parts[1];
      return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
    }
  }
  return undefined;
}

export function extractCorrelationContext(headers: Record<string, any>): { sessionId?: string; runId?: string; traceId?: string } {
  const traceparent = headers.traceparent as string | undefined;
  const traceId = (headers['x-tellann-trace-id'] as string | undefined) ?? traceparent?.split('-')[1];
  return {
    sessionId: extractSessionId(headers),
    runId: headers['x-tellann-run-id'] as string | undefined,
    traceId,
  };
}

/**
 * The route template Express matched, e.g. `/orders/:id`.
 *
 * `req.route` is only populated once a route handler has run, and a router
 * mounted under a prefix reports its own path, so the mount point is prepended.
 * When nothing matched - a 404, or an error thrown in middleware - there is no
 * template, and the caller falls back to the concrete path.
 */
export function expressRouteTemplate(req: Request): string | undefined {
  const route = (req as Request & { route?: { path?: string } }).route?.path;
  if (!route) return undefined;
  const base = req.baseUrl ?? '';
  const joined = `${base}${route}`.replace(/\/{2,}/g, '/');
  return joined === '' ? '/' : joined;
}

/**
 * Captures a response body without changing what the client receives.
 *
 * `res.json` and `res.send` are wrapped rather than the socket being tapped:
 * the wrapper sees the value the application passed, which is what a QA run
 * should show, and it avoids buffering streamed or piped responses.
 */
function captureResponseBody(res: Response, onBody: (body: unknown) => void): void {
  const json = res.json.bind(res);
  const send = res.send.bind(res);
  let captured = false;
  res.json = ((body: unknown) => {
    if (!captured) { captured = true; onBody(body); }
    return json(body as never);
  }) as Response['json'];
  res.send = ((body: unknown) => {
    if (!captured) { captured = true; onBody(body); }
    return send(body as never);
  }) as Response['send'];
}

/**
 * Express middleware that automatically tracks every API request and hydrates req.tellann context.
 *
 * The middleware reads the `X-TELLANN-Session-ID` or W3C `traceparent` header to correlate
 * backend API calls with the originating frontend session.
 *
 * Register it before the body parser and the routes: it opens the per-request
 * context that the ORM hooks report into, and the handlers run inside it.
 */
export function tellannExpressMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const correlation = extractCorrelationContext(req.headers);
    const { sessionId } = correlation;
    const requestId = req.headers['x-request-id'] as string | undefined;

    // Decorate request object
    req.tellann = correlation;

    let responseBody: unknown;
    captureResponseBody(res, (body) => { responseBody = body; });

    res.on('finish', () => {
      TELLANN.trackApi({
        endpoint: req.originalUrl?.split('?')[0] ?? req.path,
        route: expressRouteTemplate(req),
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        sessionId,
        requestId,
        runId: correlation.runId,
        traceId: correlation.traceId,
        framework: 'express',
        query: req.query as Record<string, unknown>,
        // `req.body` is whatever the body parser produced. With no parser
        // registered it is undefined, and the request is reported without one.
        requestBody: req.body,
        responseBody,
        requestHeaders: req.headers as Record<string, unknown>,
        responseHeaders: res.getHeaders() as Record<string, unknown>,
      });
    });

    runInRequestContext(
      {
        ...correlation,
        method: req.method,
        // The template is not known until a route matches, so the context
        // starts with the concrete path and the event uses the template.
        route: req.originalUrl?.split('?')[0] ?? req.path,
        dataAccess: [],
      },
      () => next(),
    );
  };
}

/**
 * Global Express error-handling middleware that automatically captures unhandled errors.
 */
export function tellannExpressErrorHandler(): ErrorRequestHandler {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.tellann?.sessionId;
    TELLANN.captureError({
      error: err,
      sessionId,
      eventType: 'SERVER_ERROR',
      runId: req.tellann?.runId,
      traceId: req.tellann?.traceId,
      context: {
        path: req.path,
        route: expressRouteTemplate(req),
        method: req.method,
        query: req.query,
      },
    });
    next(err);
  };
}

/** @deprecated Use tellannExpressMiddleware() */
export const expressMiddleware = tellannExpressMiddleware;
