import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { TELLANN } from '../../core/TELLANN';

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
 * Express middleware that automatically tracks every API request and hydrates req.tellann context.
 *
 * The middleware reads the `X-TELLANN-Session-ID` or W3C `traceparent` header to correlate
 * backend API calls with the originating frontend session.
 */
export function tellannExpressMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const correlation = extractCorrelationContext(req.headers);
    const { sessionId } = correlation;
    const requestId = req.headers['x-request-id'] as string | undefined;

    // Decorate request object
    req.tellann = correlation;

    res.on('finish', () => {
      TELLANN.trackApi({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        sessionId,
        requestId,
        runId: correlation.runId,
        traceId: correlation.traceId,
      });
    });

    next();
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
        method: req.method,
        query: req.query,
      },
    });
    next(err);
  };
}

/** @deprecated Use tellannExpressMiddleware() */
export const expressMiddleware = tellannExpressMiddleware;
