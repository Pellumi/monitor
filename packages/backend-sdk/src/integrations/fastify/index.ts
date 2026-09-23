import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { TELLANN } from '../../core/TELLANN';
import { extractCorrelationContext } from '../express';
import { enterRequestContext, summarizeDataAccess, type TellannRequestContext } from '../../core/requestContext';

declare module 'fastify' {
  interface FastifyRequest {
    tellann?: {
      sessionId?: string;
      runId?: string;
      traceId?: string;
    };
  }
}

/**
 * Fastify plugin that automatically tracks every API request and handles error correlation.
 *
 * Usage:
 *   import { tellannFastifyPlugin } from '@tellann/backend-sdk';
 *   await fastify.register(tellannFastifyPlugin);
 *
 * The plugin reads the `x-tellann-session-id` or W3C `traceparent` header to correlate
 * backend API calls with the originating frontend session.
 */
const tellannFastifyPluginImpl: FastifyPluginAsync = async (fastify) => {
  // Add preHandler to extract session metadata
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.tellann = extractCorrelationContext(request.headers);
    // Kept on the request as well as in async storage: the `onResponse` hook
    // runs after the response is out, where the store is no longer reliable.
    (request as FastifyRequest & { tellannContext?: TellannRequestContext }).tellannContext =
      enterRequestContext({
        ...request.tellann,
        method: request.method,
        route: request.routeOptions?.url ?? request.url.split('?')[0],
        dataAccess: [],
      });
  });

  // The payload is only available on `onSend`, and it is the serialized body
  // rather than the value the handler returned, so it is parsed back for the
  // run to display. Nothing is changed on the way through.
  fastify.addHook('onSend', async (request: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
    (request as FastifyRequest & { tellannResponseBody?: unknown }).tellannResponseBody = payload;
    return payload;
  });

  // Track API completion
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.tellann?.sessionId;
      const requestId = request.headers['x-request-id'] as string | undefined;
      const rawBody = (request as FastifyRequest & { tellannResponseBody?: unknown }).tellannResponseBody;
      const context = (request as FastifyRequest & { tellannContext?: TellannRequestContext }).tellannContext;

      await TELLANN.trackApi({
        endpoint: request.url.split('?')[0],
        route: request.routeOptions?.url ?? request.url.split('?')[0],
        method: request.method,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        sessionId,
        requestId,
        runId: request.tellann?.runId,
        traceId: request.tellann?.traceId,
        framework: 'fastify',
        models: summarizeDataAccess(context?.dataAccess ?? []),
        query: request.query as Record<string, unknown>,
        requestBody: request.body,
        responseBody: typeof rawBody === 'string'
          ? (() => { try { return JSON.parse(rawBody); } catch { return rawBody; } })()
          : rawBody,
        requestHeaders: request.headers as Record<string, unknown>,
        responseHeaders: reply.getHeaders() as Record<string, unknown>,
      });
      await TELLANN.flushDataAccess(context);
    }
  );

  // Track errors
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const sessionId = request.tellann?.sessionId;
      await TELLANN.captureError({
        error,
        sessionId,
        eventType: 'SERVER_ERROR',
        runId: request.tellann?.runId,
        traceId: request.tellann?.traceId,
        route: request.routeOptions?.url ?? request.url.split('?')[0],
        method: request.method,
        statusCode: reply.statusCode,
        context: {
          url: request.url,
          method: request.method,
        },
      });
    }
  );
};

export const tellannFastifyPlugin = fp(tellannFastifyPluginImpl, {
  name: 'tellann-fastify-plugin',
  fastify: '>=4.0.0',
});

/** @deprecated Use tellannFastifyPlugin */
export const fastifyPlugin = tellannFastifyPlugin;
