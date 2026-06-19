import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { SOTS } from '../../core/SOTS';

declare global {
  namespace Express {
    interface Request {
      sots?: {
        sessionId?: string;
      };
    }
  }
}

export function extractSessionId(headers: Record<string, any>): string | undefined {
  if (headers['x-sots-session-id']) {
    return headers['x-sots-session-id'] as string;
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

/**
 * Express middleware that automatically tracks every API request and hydrates req.sots context.
 *
 * The middleware reads the `X-SOTS-Session-ID` or W3C `traceparent` header to correlate
 * backend API calls with the originating frontend session.
 */
export function sotsExpressMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const sessionId = extractSessionId(req.headers);
    const requestId = req.headers['x-request-id'] as string | undefined;

    // Decorate request object
    req.sots = { sessionId };

    res.on('finish', () => {
      SOTS.trackApi({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        sessionId,
        requestId,
      });
    });

    next();
  };
}

/**
 * Global Express error-handling middleware that automatically captures unhandled errors.
 */
export function sotsExpressErrorHandler(): ErrorRequestHandler {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.sots?.sessionId;
    SOTS.captureError({
      error: err,
      sessionId,
      eventType: 'SERVER_ERROR',
      context: {
        path: req.path,
        method: req.method,
        query: req.query,
      },
    });
    next(err);
  };
}

/** @deprecated Use sotsExpressMiddleware() */
export const expressMiddleware = sotsExpressMiddleware;
