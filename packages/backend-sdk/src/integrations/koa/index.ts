import { TELLANN } from '../../core/TELLANN';
import { extractCorrelationContext } from '../express';
import { runInRequestContext } from '../../core/requestContext';

/**
 * Koa integration.
 *
 * Koa's types are described structurally rather than imported, so installing
 * this SDK never drags `koa` and `@types/koa` into a project that does not use
 * them. The shape used here is the stable part of Koa's context contract.
 */
export type TellannKoaContext = {
  method: string;
  path: string;
  status: number;
  /** Set by `koa-router`; the matched pattern rather than the concrete path. */
  _matchedRoute?: string;
  /** Present when a body parser is registered. */
  body?: unknown;
  query?: Record<string, unknown>;
  request: { headers: Record<string, any>; body?: unknown };
  response?: { headers?: Record<string, any> };
  state: Record<string, any>;
};

export type TellannKoaMiddleware = (
  context: TellannKoaContext,
  next: () => Promise<any>,
) => Promise<void>;

/**
 * Track every request, and re-throw whatever the downstream middleware threw.
 *
 * The matched router pattern is preferred over `ctx.path`: reporting the
 * concrete path would put identifiers from URLs into telemetry and would make
 * every request to `/users/:id` a distinct endpoint.
 */
export function tellannKoaMiddleware(): TellannKoaMiddleware {
  return async (context, next) => {
    const start = Date.now();
    const correlation = extractCorrelationContext(context.request?.headers ?? {});
    context.state.tellann = correlation;

    await runInRequestContext(
      {
        ...correlation,
        method: context.method,
        route: context._matchedRoute ?? context.path,
        dataAccess: [],
      },
      async () => {
        try {
          await next();
        } catch (error) {
          await TELLANN.captureError({
            error: error as Error,
            sessionId: correlation.sessionId,
            runId: correlation.runId,
            traceId: correlation.traceId,
            eventType: 'SERVER_ERROR',
            route: context._matchedRoute ?? context.path,
            method: context.method,
            statusCode: context.status,
          });
          throw error;
        } finally {
          await TELLANN.trackApi({
            endpoint: context.path,
            // Read after `next`, by which point the router has matched.
            route: context._matchedRoute ?? context.path,
            method: context.method,
            statusCode: context.status,
            durationMs: Date.now() - start,
            sessionId: correlation.sessionId,
            runId: correlation.runId,
            traceId: correlation.traceId,
            framework: 'koa',
            query: context.query,
            requestBody: context.request?.body,
            responseBody: context.body,
            requestHeaders: context.request?.headers,
            responseHeaders: context.response?.headers,
          });
        }
      },
    );
  };
}
