import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { TELLANN } from '../../core/TELLANN';
import { extractCorrelationContext } from '../express';

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
  });

  // Track API completion
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.tellann?.sessionId;
      const requestId = request.headers['x-request-id'] as string | undefined;

      await TELLANN.trackApi({
        endpoint: request.routeOptions?.url ?? request.url,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        sessionId,
        requestId,
        runId: request.tellann?.runId,
        traceId: request.tellann?.traceId,
      });
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
