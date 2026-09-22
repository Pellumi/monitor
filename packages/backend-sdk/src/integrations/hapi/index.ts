import { TELLANN } from '../../core/TELLANN';
import { extractCorrelationContext } from '../express';
import { enterRequestContext } from '../../core/requestContext';

/**
 * hapi integration, written as a hapi plugin.
 *
 * As with the Koa integration, hapi's types are described structurally so that
 * this SDK never requires `@hapi/hapi` to be installed in a project that does
 * not use it.
 */
export type TellannHapiRequest = {
  method: string;
  path: string;
  headers: Record<string, any>;
  query?: Record<string, unknown>;
  payload?: unknown;
  /** The route table entry; its `path` is the pattern, not the request path. */
  route?: { path?: string };
  response?: {
    statusCode?: number;
    isBoom?: boolean;
    source?: unknown;
    headers?: Record<string, any>;
    output?: { statusCode?: number };
  };
  app: Record<string, any>;
  info?: { received?: number };
};

export type TellannHapiServer = {
  ext(event: string, handler: (request: TellannHapiRequest, h: any) => any): void;
  events?: { on(name: string, handler: (...args: any[]) => void): void };
};

function statusOf(request: TellannHapiRequest): number {
  const response = request.response;
  if (!response) return 0;
  return (response.isBoom ? response.output?.statusCode : response.statusCode) ?? 0;
}

/**
 * The hapi plugin object, registered with `await server.register(tellannHapiPlugin)`.
 */
export const tellannHapiPlugin = {
  name: 'tellann',
  version: '1.0.0',
  register(server: TellannHapiServer): void {
    server.ext('onRequest', (request, h) => {
      request.app.tellann = {
        ...extractCorrelationContext(request.headers ?? {}),
        startedAt: Date.now(),
      };
      // hapi extensions do not wrap the handler, so the context is bound to
      // this execution rather than to a callback.
      enterRequestContext({
        ...extractCorrelationContext(request.headers ?? {}),
        method: request.method?.toUpperCase?.() ?? 'GET',
        route: request.route?.path ?? request.path,
        dataAccess: [],
      });
      return h.continue;
    });

    server.ext('onPreResponse', (request, h) => {
      const correlation = request.app.tellann ?? {};
      const startedAt = typeof correlation.startedAt === 'number' ? correlation.startedAt : Date.now();

      void TELLANN.trackApi({
        endpoint: request.path,
        // The route table's pattern, so `/users/{id}` stays one endpoint.
        route: request.route?.path ?? request.path,
        method: request.method?.toUpperCase?.() ?? 'GET',
        statusCode: statusOf(request),
        durationMs: Date.now() - startedAt,
        sessionId: correlation.sessionId,
        runId: correlation.runId,
        traceId: correlation.traceId,
        framework: 'hapi',
        query: request.query,
        requestBody: request.payload,
        // A Boom error's `source` is the error payload hapi will serialize.
        responseBody: request.response?.isBoom ? undefined : request.response?.source,
        requestHeaders: request.headers,
        responseHeaders: request.response?.headers,
      });

      if (request.response?.isBoom) {
        void TELLANN.captureError({
          error: request.response as unknown as Error,
          sessionId: correlation.sessionId,
          runId: correlation.runId,
          traceId: correlation.traceId,
          eventType: 'SERVER_ERROR',
          route: request.route?.path ?? request.path,
          method: request.method?.toUpperCase?.() ?? 'GET',
          statusCode: statusOf(request),
        });
      }

      return h.continue;
    });
  },
};
