/**
 * @sots/telemetry — NodeSDK tracer bootstrap
 *
 * Sets up the OpenTelemetry NodeSDK with:
 *   - Auto-instrumentation for HTTP, Express, Fastify, Prisma, Redis
 *   - OTLP HTTP trace exporter (compatible with Jaeger, Tempo, etc.)
 *   - W3C Trace Context propagation (standard traceparent header)
 *   - Resource attributes (service.name, service.version)
 *
 * IMPORTANT: This must be imported BEFORE any instrumented library
 * (express, http, etc.) to ensure monkey-patching hooks install correctly.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { resolveConfig } from './config';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing for a SOTS service.
 *
 * @param serviceName — short lowercase name (e.g. 'api-gateway', 'event-collector')
 *
 * @example
 * ```ts
 * // At the very top of src/index.ts, BEFORE other imports:
 * import { initTracing } from '@sots/telemetry';
 * initTracing('api-gateway');
 * ```
 */
export function initTracing(serviceName: string): void {
  const config = resolveConfig(serviceName);

  if (!config.enabled) {
    console.log(`[telemetry] Tracing disabled for ${config.serviceName} (set OTEL_TRACES_ENABLED=true to enable)`);
    return;
  }

  if (sdk) {
    console.warn(`[telemetry] Tracing already initialized for ${config.serviceName}`);
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Fine-tune auto-instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },  // Too noisy
        '@opentelemetry/instrumentation-dns': { enabled: false }, // Too noisy
      }),
    ],
  });

  sdk.start();

  console.log(`[telemetry] Tracing initialized for ${config.serviceName} → ${config.endpoint}`);

  // Graceful shutdown on process exit
  const shutdown = async () => {
    try {
      await sdk?.shutdown();
      console.log(`[telemetry] Tracing shut down for ${config.serviceName}`);
    } catch (err) {
      console.error(`[telemetry] Error shutting down tracing:`, err);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Manually shut down the tracer (flushes pending spans).
 * Called automatically on SIGTERM/SIGINT.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
