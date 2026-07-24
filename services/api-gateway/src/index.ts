import { initTracing } from '@sots/telemetry';
initTracing('api-gateway');

import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import httpProxy from '@fastify/http-proxy';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Services } from '@sots/shared';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || Services.API_GATEWAY);

const UPSTREAM = {
  EVENT_COLLECTOR:   process.env.EVENT_COLLECTOR_URL || `http://localhost:${Services.EVENT_COLLECTOR}`,
  GRAPH_ENGINE:      process.env.GRAPH_ENGINE_URL || `http://localhost:${Services.GRAPH_ENGINE}`,
  COVERAGE_ENGINE:   process.env.COVERAGE_ENGINE_URL || `http://localhost:${Services.COVERAGE_ENGINE}`,
  REPORT_ENGINE:     process.env.REPORT_ENGINE_URL || `http://localhost:${Services.REPORT_ENGINE}`,
  DEMONSTRATION_API: process.env.DEMONSTRATION_API_URL || `http://localhost:${Services.DEMONSTRATION_API}`,
  ONBOARDING_API:    process.env.ONBOARDING_API_URL || `http://localhost:${Services.ONBOARDING_API}`,
  ENDPOINT_ENGINE:   process.env.ENDPOINT_ENGINE_URL || `http://localhost:${Services.ENDPOINT_ENGINE}`,
  FDRS_API:          process.env.FDRS_API_URL || `http://localhost:${Services.FDRS_API}`,
  BILLING_API:       process.env.BILLING_API_URL || `http://localhost:${Services.BILLING_API}`,
  USAGE_TRACKER:     process.env.USAGE_TRACKER_URL || `http://localhost:${Services.USAGE_TRACKER}`,
  AUTH_API:          process.env.AUTH_API_URL || `http://localhost:${Services.AUTH_API}`,
};

const ONBOARDING_VALIDATE_URL = `${UPSTREAM.ONBOARDING_API}/internal/validate-key`;
const PROGRAMMATIC_VALIDATE_URL = `${UPSTREAM.ONBOARDING_API}/internal/validate-programmatic-token`;
const isProduction = process.env.NODE_ENV === 'production';
const API_RATE_LIMIT_MAX = Number(process.env.API_GATEWAY_API_RATE_LIMIT_MAX || 100);
const DASHBOARD_RATE_LIMIT_MAX = Number(
  process.env.API_GATEWAY_DASHBOARD_RATE_LIMIT_MAX || (isProduction ? 1_000 : 10_000),
);
const RATE_LIMIT_WINDOW = process.env.API_GATEWAY_RATE_LIMIT_WINDOW || '15 minutes';

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

function requiredProgrammaticScope(url: string, method: string): string | null {
  if (url.startsWith('/reports') && url.includes('/export')) return 'reports:export';
  if (url.startsWith('/reports')) return 'reports:read';
  if (url.startsWith('/graph') || url.includes('declared-flow')) return 'graphs:read';
  if (url.startsWith('/coverage') || url.includes('reconciliation')) return 'coverage:read';
  if (url.startsWith('/applications') && method === 'GET') return 'applications:read';
  return null;
}

async function resolveProgrammaticToken(rawToken: string): Promise<{ organizationId: string; scopes: string[] } | null> {
  const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  try {
    const response = await fetch(PROGRAMMATIC_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash }),
    });
    return response.ok ? await response.json() as { organizationId: string; scopes: string[] } : null;
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
    max: (req) =>
      req.headers.authorization?.startsWith('Bearer ')
        ? API_RATE_LIMIT_MAX
        : DASHBOARD_RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW,
    keyGenerator: (req) => {
      const authorization = req.headers.authorization;
      if (authorization?.startsWith('Bearer ')) {
        return `api:${crypto.createHash('sha256').update(authorization).digest('hex')}`;
      }
      return `dashboard:${req.ip}`;
    },
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

    if (rawKey.startsWith('sots_pat_')) {
      const token = await resolveProgrammaticToken(rawKey);
      if (!token) return reply.code(401).send({ error: 'Invalid, revoked, or unentitled programmatic token' });
      const requiredScope = requiredProgrammaticScope(url, request.method);
      if (!requiredScope || !token.scopes.includes(requiredScope)) {
        return reply.code(403).send({ error: 'PROGRAMMATIC_SCOPE_REQUIRED', requiredScope });
      }
      request.headers['x-sots-org-id'] = token.organizationId;
      request.headers['x-sots-auth-mode'] = 'PROGRAMMATIC_TOKEN';
      return;
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

  // ─────────────────────────────────────────────────────────────
  // OpenAPI 3.1 Spec (Gap 2)
  // GET /openapi.json  → machine-readable spec
  // GET /docs          → Swagger UI HTML
  // ─────────────────────────────────────────────────────────────

  const OPENAPI_SPEC = {
    openapi: '3.1.0',
    info: {
      title: 'Tellann Platform API',
      version: '1.0.0',
      description:
        'Tellann behavioral QA platform. Includes SDK telemetry ingestion, report generation, session replay, flow declaration, reconciliation, billing, and organization management.',
    },
    servers: [{ url: process.env.API_GATEWAY_INTERNAL_URL || 'http://localhost:3000', description: 'API Gateway' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key (sots_...)' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token', description: 'Dashboard JWT cookie' },
      },
    },
    paths: {
      '/health': {
        get: { summary: 'Health check', tags: ['System'], security: [], responses: { '200': { description: 'Healthy' } } },
      },
      '/v1/events': {
        post: {
          summary: 'Ingest SDK telemetry events',
          tags: ['SDK Telemetry'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'applicationId', 'events'],
                  properties: {
                    sessionId: { type: 'string' },
                    applicationId: { type: 'string' },
                    tenantId: { type: 'string' },
                    events: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Events accepted' }, '401': { description: 'Invalid API key' } },
        },
      },
      '/reports/{applicationId}/latest': {
        get: {
          summary: 'Get the latest report for an application',
          tags: ['Reports'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'applicationId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Report data' }, '404': { description: 'No report found' } },
        },
      },
      '/reports/{applicationId}/export': {
        get: {
          summary: 'Export a report as PDF, CSV, HTML, or JSON',
          tags: ['Reports'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'applicationId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['pdf', 'csv', 'html', 'json'], default: 'pdf' } },
          ],
          responses: {
            '200': {
              description: 'Presigned download URL and expiry',
              content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' }, expiresAt: { type: 'string' }, filename: { type: 'string' } } } } },
            },
          },
        },
      },
      '/sessions/{sessionId}/replay': {
        get: {
          summary: 'Fetch session replay data',
          tags: ['Sessions'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Replay payload with events, timeline, and state transitions' } },
        },
      },
      '/applications/{appId}/declared-flow': {
        get: {
          summary: 'List declared flows (behavior graphs) for an application',
          tags: ['Flow Declaration'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Array of declared flows' } },
        },
      },
      '/applications/{appId}/reconciliation/run': {
        post: {
          summary: 'Run behavioral reconciliation for an application',
          tags: ['Reconciliation'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Reconciliation reports generated' } },
        },
      },
      '/applications/{appId}/reconciliation/export': {
        get: {
          summary: 'Export reconciliation report as CSV or JSON',
          tags: ['Reconciliation'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'appId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'json'], default: 'json' } },
            { name: 'flowId', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Downloaded file' } },
        },
      },
      '/organizations/{orgId}/entitlement': {
        get: {
          summary: 'Get resolved feature entitlements for an organization',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Entitlement object with planType, features, limits' } },
        },
      },
      '/organizations/{orgId}/members': {
        get: {
          summary: 'List organization members',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Array of TeamMember objects' } },
        },
      },
      '/organizations/{orgId}/members/{userId}': {
        delete: {
          summary: 'Remove an organization member',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Member removed' }, '403': { description: 'Owner role required' } },
        },
      },
      '/organizations/{orgId}/invitations': {
        post: {
          summary: 'Invite a new organization member',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['ADMIN', 'MEMBER', 'VIEWER'] } } },
              },
            },
          },
          responses: { '201': { description: 'Invitation created and email queued' } },
        },
      },
      '/organizations/{orgId}/invitations/pending': {
        get: {
          summary: 'List pending organization invitations',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Pending invitations' } },
        },
      },
      '/organizations/{orgId}/invitations/{invitationId}': {
        delete: {
          summary: 'Rescind a pending organization invitation',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'invitationId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Invitation rescinded' } },
        },
      },
      '/organizations/{orgId}/audit-logs': {
        get: {
          summary: 'List organization audit log entries',
          tags: ['Organizations'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'action', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Paginated audit log entries' }, '403': { description: 'Audit Logs entitlement required' } },
        },
      },
      '/organizations/{orgId}/api-keys': {
        get: {
          summary: 'List API keys for all environments in an organization',
          tags: ['API Keys'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Array of API key records (never includes the raw key)' } },
        },
        post: {
          summary: 'Create a new API key for an environment',
          tags: ['API Keys'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['environmentId'],
                  properties: { environmentId: { type: 'string' }, label: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Key created. Returns { keyPrefix, rawKey } — raw key shown once only.' },
          },
        },
      },
      '/v1/applications/{appId}/flows/ai-drafts': {
        post: {
          summary: 'Queue an async AI flow draft generation job',
          tags: ['AI Flow'],
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', required: ['productDescription'], properties: { productDescription: { type: 'string' }, selectedDomainKey: { type: 'string' } } },
              },
            },
          },
          responses: { '202': { description: 'Job queued. Returns { jobId, status: "QUEUED" }' } },
        },
      },
      '/v1/applications/{appId}/flows/ai-drafts/jobs/{jobId}': {
        get: {
          summary: 'Poll AI draft job status',
          tags: ['AI Flow'],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'appId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Job status. draftId is populated when COMPLETED.' } },
        },
      },
      '/billing/plans': {
        get: { summary: 'List available pricing plans', tags: ['Billing'], security: [{ cookieAuth: [] }], responses: { '200': { description: 'Plan array' } } },
      },
      '/billing/checkout': {
        post: { summary: 'Initiate Stripe or Paystack checkout', tags: ['Billing'], security: [{ cookieAuth: [] }], responses: { '200': { description: 'Checkout redirect URL' } } },
      },
    },
  } as const;

  fastify.get('/openapi.json', { config: { public: true } }, async (_req, reply) => {
    return reply.header('content-type', 'application/json').send(OPENAPI_SPEC);
  });

  // Swagger UI (served inline — no external plugin dependency)
  fastify.get('/docs', { config: { public: true } }, async (_req, reply) => {
    return reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tellann Platform API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    });
  </script>
</body>
</html>`);
  });

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

  fastify.all('/v1/rules/*', forwardToFdrs);
  fastify.all('/v1/admin/rules/*', forwardToFdrs);
  fastify.all('/v1/applications/:id/flows/*', forwardToFdrs);
  fastify.all('/v1/applications/:id/declared-flows/*', forwardToFdrs);
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
  // Admin Routes (JWT + system-admin required)
  // ─────────────────────────────────────────────────────────────
  // These routes proxy to onboarding-api, which does its own auth.
  // The gateway adds a system-admin prevalidation hook.

  const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

  async function requireSystemAdmin(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isSystemAdmin) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'System admin access required.' });
      }
    } catch {
      return reply.code(401).send({ error: 'TOKEN_INVALID', message: 'Invalid or expired token.' });
    }
  }

  // Admin: forward to onboarding-api which proxies member management
  const forwardToOnboarding = forwardToUpstream(UPSTREAM.ONBOARDING_API);

  fastify.get('/admin/ai-usage', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.get('/admin/ai-usage/daily', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.post('/admin/ai-usage/backfill', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.get('/admin/audit-logs', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.get('/admin/rulesets', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.post('/admin/rulesets/:id/promote', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.get('/admin/rule-candidates', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.post('/admin/rule-candidates/:id/approve', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
  });

  fastify.post('/admin/rule-candidates/:id/reject', { preHandler: requireSystemAdmin }, async (request, reply) => {
    return forwardToOnboarding({ ...request, url: request.url } as any, reply);
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
