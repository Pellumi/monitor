import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import crypto from 'crypto';
import { Services } from '@sots/shared';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const PORT = Services.API_GATEWAY;

const UPSTREAM = {
  EVENT_COLLECTOR:   `http://localhost:${Services.EVENT_COLLECTOR}`,
  GRAPH_ENGINE:      `http://localhost:${Services.GRAPH_ENGINE}`,
  COVERAGE_ENGINE:   `http://localhost:${Services.COVERAGE_ENGINE}`,
  REPORT_ENGINE:     `http://localhost:${Services.REPORT_ENGINE}`,
  DEMONSTRATION_API: `http://localhost:${Services.DEMONSTRATION_API}`,
  ONBOARDING_API:    `http://localhost:${Services.ONBOARDING_API}`,
  ENDPOINT_ENGINE:   `http://localhost:${Services.ENDPOINT_ENGINE}`,
  FDRS_API:          `http://localhost:${Services.FDRS_API}`,
  BILLING_API:       `http://localhost:${Services.BILLING_API}`,
  USAGE_TRACKER:     `http://localhost:${Services.USAGE_TRACKER}`,
  AUTH_API:          `http://localhost:${Services.AUTH_API}`,
};

const ONBOARDING_VALIDATE_URL = `${UPSTREAM.ONBOARDING_API}/internal/validate-key`;

// Routes that bypass API key authentication
const PUBLIC_PREFIXES = ['/health', '/auth'];

// ─────────────────────────────────────────────────────────────
// In-memory key cache (TTL: 60s) to avoid DB round-trip per request
// ─────────────────────────────────────────────────────────────

interface CachedKeyEntry {
  organizationId: string;
  applicationId: string | null;
  environment: {
    id: string;
    name: string;
    type: string;
  } | null;
  planType: string;
  expiresAt: number;
}

const keyCache = new Map<string, CachedKeyEntry>();
const KEY_CACHE_TTL_MS = 60_000;

async function resolveApiKey(
  rawKey: string
): Promise<CachedKeyEntry | null> {
  const cleanKey = rawKey.startsWith('sots_') ? rawKey.slice(5) : rawKey;
  const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex');

  // Check cache
  const cached = keyCache.get(keyHash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  // Validate against Onboarding API
  try {
    const res = await fetch(ONBOARDING_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash }),
    });

    if (!res.ok) return null;

    const body = await res.json() as {
      organizationId: string;
      applicationId: string | null;
      environment: {
        id: string;
        name: string;
        type: string;
      } | null;
      planType: string;
    };
    const entry: CachedKeyEntry = {
      organizationId: body.organizationId,
      applicationId: body.applicationId,
      environment: body.environment ?? null,
      planType: body.planType,
      expiresAt: Date.now() + KEY_CACHE_TTL_MS,
    };
    keyCache.set(keyHash, entry);
    return entry;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Build and Start Fastify
// ─────────────────────────────────────────────────────────────

const fastify = Fastify({ logger: true });

async function main() {
  // CORS — allow all origins so browser SDKs work
  await fastify.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });

  // Rate limiting — keyed on API key prefix header (injected after auth) or IP
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes',
    keyGenerator: (req) =>
      (req.headers['x-sots-org-id'] as string) ?? req.ip,
  });

  // ─────────────────────────────────────────────────────────────
  // Authentication hook (runs before every request except public)
  // ─────────────────────────────────────────────────────────────

  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    // Allow public routes through
    if (PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix))) return;

    const authHeader = request.headers['authorization'];
    
    // Skip gateway API key validation if the request is from the dashboard (cookie-based or no Bearer key)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey) {
      return reply.code(401).send({ error: 'Empty API key' });
    }

    const keyEntry = await resolveApiKey(rawKey);
    if (!keyEntry) {
      return reply.code(401).send({ error: 'Invalid or revoked API key' });
    }

    // Inject resolved identity headers for upstream services
    request.headers['x-sots-org-id'] = keyEntry.organizationId;
    request.headers['x-sots-plan-type'] = keyEntry.planType;
    if (keyEntry.applicationId) {
      request.headers['x-sots-application-id'] = keyEntry.applicationId;
    }
    if (keyEntry.environment) {
      request.headers['x-sots-environment-id'] = keyEntry.environment.id;
      request.headers['x-sots-environment-type'] = keyEntry.environment.type;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Health (public)
  // ─────────────────────────────────────────────────────────────

  fastify.get('/health', async () => ({
    status: 'healthy',
    service: 'api-gateway',
    upstreams: Object.keys(UPSTREAM),
  }));

  function forwardToUpstream(upstreamBase: string) {
    return async function forward(request: FastifyRequest, reply: FastifyReply) {
      const upstreamUrl = `${upstreamBase}${request.url}`;
      const headers = new Headers();

      for (const [key, value] of Object.entries(request.headers)) {
        if (!value || key.toLowerCase() === 'host' || key.toLowerCase() === 'content-length') continue;
        if (Array.isArray(value)) {
          headers.set(key, value.join(','));
        } else {
          headers.set(key, String(value));
        }
      }
      if (request.body !== undefined && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' || request.body === undefined
          ? undefined
          : JSON.stringify(request.body),
      });

      reply.code(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) reply.header('content-type', contentType);
      const contentDisposition = upstream.headers.get('content-disposition');
      if (contentDisposition) reply.header('content-disposition', contentDisposition);

      const bytes = Buffer.from(await upstream.arrayBuffer());
      return reply.send(bytes);
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Proxy routes
  // ─────────────────────────────────────────────────────────────

  // SDK events — high-traffic, no path rewriting
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.EVENT_COLLECTOR,
    prefix: '/v1/events',
    rewritePrefix: '/v1/events',
    http2: false,
  });

  // Demonstration workflow
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.DEMONSTRATION_API,
    prefix: '/demonstrations',
    rewritePrefix: '/demonstrations',
    http2: false,
  });

  // Auth API
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.AUTH_API,
    prefix: '/auth',
    rewritePrefix: '/auth',
    http2: false,
  });

  // Onboarding: orgs, apps, api-keys (public management plane)
  const forwardToFdrs = forwardToUpstream(UPSTREAM.FDRS_API);
  const forwardToReportEngine = forwardToUpstream(UPSTREAM.REPORT_ENGINE);

  fastify.all('/applications/:id/declared-flow', forwardToFdrs);
  fastify.all('/applications/:id/declared-flow/*', forwardToFdrs);
  fastify.all('/applications/:id/reconciliation', forwardToFdrs);
  fastify.all('/applications/:id/reconciliation/*', forwardToFdrs);
  fastify.all('/applications/:id/graph', forwardToReportEngine);
  fastify.all('/applications/:id/workflows', forwardToReportEngine);
  fastify.all('/applications/:id/sessions', forwardToReportEngine);

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ONBOARDING_API,
    prefix: '/organizations',
    rewritePrefix: '/organizations',
    http2: false,
  });

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ONBOARDING_API,
    prefix: '/applications',
    rewritePrefix: '/applications',
    http2: false,
  });

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ONBOARDING_API,
    prefix: '/api-keys',
    rewritePrefix: '/api-keys',
    http2: false,
  });

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ONBOARDING_API,
    prefix: '/environments',
    rewritePrefix: '/environments',
    http2: false,
  });

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ONBOARDING_API,
    prefix: '/internal',
    rewritePrefix: '/internal',
    http2: false,
  });

  // Report engine: reports + sessions + graph + workflows
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.REPORT_ENGINE,
    prefix: '/reports',
    rewritePrefix: '/reports',
    http2: false,
  });

  await fastify.register(httpProxy, {
    upstream: UPSTREAM.REPORT_ENGINE,
    prefix: '/sessions',
    rewritePrefix: '/sessions',
    http2: false,
  });

  // Endpoint intelligence
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.ENDPOINT_ENGINE,
    prefix: '/endpoints',
    rewritePrefix: '/endpoints',
    http2: false,
  });

  // Coverage (for direct access)
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.COVERAGE_ENGINE,
    prefix: '/coverage',
    rewritePrefix: '/coverage',
    http2: false,
  });

  // Billing API (Phase 1.8C)
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.BILLING_API,
    prefix: '/billing',
    rewritePrefix: '/billing',
    http2: false,
  });

  // Usage Tracker (Phase 1.8B)
  await fastify.register(httpProxy, {
    upstream: UPSTREAM.USAGE_TRACKER,
    prefix: '/usage',
    rewritePrefix: '/usage',
    http2: false,
  });

  // ─────────────────────────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────────────────────────

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[API Gateway] Listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
