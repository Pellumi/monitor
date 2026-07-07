/**
 * @sots/shared — Prometheus metrics helpers
 *
 * Creates a per-service metrics registry with standard SOTS metrics.
 * Each service imports this and mounts GET /metrics using the returned
 * `metricsHandler`. All counters and histograms are pre-labelled with
 * the service name so dashboards can filter per-service easily.
 *
 * Usage:
 *   import { createMetricsRegistry } from '@sots/shared/metrics';
 *   const { register, metricsHandler, http } = createMetricsRegistry('auth-api');
 *   app.get('/metrics', metricsHandler);
 *   // In your middleware: http.requestDuration.observe(...)
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

export interface SotsMetrics {
  register: Registry;
  metricsHandler: (req: any, res: any) => Promise<void>;

  http: {
    requestDuration: Histogram<string>;
    requestTotal: Counter<string>;
    activeConnections: Gauge<string>;
  };

  worker: {
    jobProcessed: Counter<string>;
    jobFailed:    Counter<string>;
    jobDuration:  Histogram<string>;
  };

  ruleset: {
    cacheHit:  Counter<string>;
    cacheMiss: Counter<string>;
    cacheSize: Gauge<string>;
  };

  ai: {
    invocationTotal:   Counter<string>;
    invocationFailed:  Counter<string>;
    invocationLatency: Histogram<string>;
    tokensUsed:        Counter<string>;
    costUsd:           Counter<string>;
  };
}

export function createMetricsRegistry(serviceName: string): SotsMetrics {
  const register = new Registry();

  // Default Node.js process metrics (CPU, memory, event loop lag)
  collectDefaultMetrics({ register, labels: { service: serviceName } });

  // ─── HTTP metrics ─────────────────────────────────────────────────────────
  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['service', 'method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  const httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['service', 'method', 'route', 'status_code'],
    registers: [register],
  });

  const httpActiveConnections = new Gauge({
    name: 'http_active_connections',
    help: 'Number of active HTTP connections',
    labelNames: ['service'],
    registers: [register],
  });

  // ─── Worker metrics ───────────────────────────────────────────────────────
  const workerJobProcessed = new Counter({
    name: 'worker_job_processed_total',
    help: 'Total number of background jobs processed',
    labelNames: ['service', 'worker'],
    registers: [register],
  });

  const workerJobFailed = new Counter({
    name: 'worker_job_failed_total',
    help: 'Total number of background jobs that failed',
    labelNames: ['service', 'worker'],
    registers: [register],
  });

  const workerJobDuration = new Histogram({
    name: 'worker_job_duration_seconds',
    help: 'Duration of background job execution in seconds',
    labelNames: ['service', 'worker'],
    buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300],
    registers: [register],
  });

  // ─── Ruleset cache metrics ────────────────────────────────────────────────
  const rulesetCacheHit = new Counter({
    name: 'ruleset_cache_hit_total',
    help: 'Total number of ruleset cache hits',
    labelNames: ['service', 'domain'],
    registers: [register],
  });

  const rulesetCacheMiss = new Counter({
    name: 'ruleset_cache_miss_total',
    help: 'Total number of ruleset cache misses',
    labelNames: ['service', 'domain'],
    registers: [register],
  });

  const rulesetCacheSize = new Gauge({
    name: 'ruleset_cache_size',
    help: 'Current number of entries in the ruleset cache',
    labelNames: ['service'],
    registers: [register],
  });

  // ─── AI metrics ───────────────────────────────────────────────────────────
  const aiInvocationTotal = new Counter({
    name: 'ai_invocation_total',
    help: 'Total number of AI invocations',
    labelNames: ['service', 'feature', 'provider', 'model'],
    registers: [register],
  });

  const aiInvocationFailed = new Counter({
    name: 'ai_invocation_failed_total',
    help: 'Total number of failed AI invocations',
    labelNames: ['service', 'feature', 'provider', 'model'],
    registers: [register],
  });

  const aiInvocationLatency = new Histogram({
    name: 'ai_invocation_duration_seconds',
    help: 'Duration of AI invocations in seconds',
    labelNames: ['service', 'feature', 'provider', 'model'],
    buckets: [0.5, 1, 2, 5, 10, 15, 30, 60],
    registers: [register],
  });

  const aiTokensUsed = new Counter({
    name: 'ai_tokens_used_total',
    help: 'Total number of AI tokens consumed',
    labelNames: ['service', 'feature', 'provider', 'model', 'token_type'],
    registers: [register],
  });

  const aiCostUsd = new Counter({
    name: 'ai_cost_usd_total',
    help: 'Total estimated AI cost in USD',
    labelNames: ['service', 'feature', 'provider', 'model'],
    registers: [register],
  });

  // ─── Metrics HTTP handler ─────────────────────────────────────────────────
  const metricsHandler = async (_req: any, res: any): Promise<void> => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  };

  return {
    register,
    metricsHandler,
    http: {
      requestDuration: httpRequestDuration,
      requestTotal: httpRequestTotal,
      activeConnections: httpActiveConnections,
    },
    worker: {
      jobProcessed: workerJobProcessed,
      jobFailed:    workerJobFailed,
      jobDuration:  workerJobDuration,
    },
    ruleset: {
      cacheHit:  rulesetCacheHit,
      cacheMiss: rulesetCacheMiss,
      cacheSize: rulesetCacheSize,
    },
    ai: {
      invocationTotal:   aiInvocationTotal,
      invocationFailed:  aiInvocationFailed,
      invocationLatency: aiInvocationLatency,
      tokensUsed:        aiTokensUsed,
      costUsd:           aiCostUsd,
    },
  };
}

/**
 * Express/Fastify-compatible middleware that records HTTP request duration and
 * increments the request counter for each completed request.
 */
export function createHttpMetricsMiddleware(
  metrics: SotsMetrics,
  serviceName: string,
) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    metrics.http.activeConnections.inc({ service: serviceName });

    res.on('finish', () => {
      const durationSeconds = (Date.now() - start) / 1000;
      const route = (req.route?.path as string) ?? req.path ?? 'unknown';
      const labels = {
        service:     serviceName,
        method:      req.method ?? 'UNKNOWN',
        route,
        status_code: String(res.statusCode),
      };
      metrics.http.requestDuration.observe(labels, durationSeconds);
      metrics.http.requestTotal.inc(labels);
      metrics.http.activeConnections.dec({ service: serviceName });
    });

    next();
  };
}
