import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { SOTS } from '../../core/SOTS';
import { extractSessionId } from '../express'; // Re-use traceparent extraction utility

declare module 'fastify' {
  interface FastifyRequest {
    sots?: {
      sessionId?: string;
    };
  }
}

/**
 * Fastify plugin that automatically tracks every API request and handles error correlation.
 *
 * Usage:
 *   import { sotsFastifyPlugin } from '@sots/backend-sdk';
 *   await fastify.register(sotsFastifyPlugin);
 *
 * The plugin reads the `x-sots-session-id` or W3C `traceparent` header to correlate
 * backend API calls with the originating frontend session.
 */
const sotsFastifyPluginImpl: FastifyPluginAsync = async (fastify) => {
  // Add preHandler to extract session metadata
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const sessionId = extractSessionId(request.headers);
    request.sots = { sessionId };
  });

  // Track API completion
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = request.sots?.sessionId;
      const requestId = request.headers['x-request-id'] as string | undefined;

      await SOTS.trackApi({
        endpoint: request.routeOptions?.url ?? request.url,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        sessionId,
        requestId,
      });
    }
  );

  // Track errors
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const sessionId = request.sots?.sessionId;
      await SOTS.captureError({
        error,
        sessionId,
        eventType: 'SERVER_ERROR',
        context: {
          url: request.url,
          method: request.method,
        },
      });
    }
  );
};

export const sotsFastifyPlugin = fp(sotsFastifyPluginImpl, {
  name: 'sots-fastify-plugin',
  fastify: '>=4.0.0',
});

/** @deprecated Use sotsFastifyPlugin */
export const fastifyPlugin = sotsFastifyPlugin;
