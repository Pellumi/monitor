/**
 * @sots/telemetry
 *
 * Shared OpenTelemetry tracing bootstrap for SOTS services.
 *
 * Usage — add to the very top of your service's src/index.ts:
 *
 * ```ts
 * import { initTracing } from '@sots/telemetry';
 * initTracing('api-gateway');
 * ```
 *
 * Environment variables:
 *   OTEL_TRACES_ENABLED           — "true" to enable (default: disabled)
 *   OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP HTTP endpoint (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — Override service name
 */

export { initTracing, shutdownTracing } from './tracer';
export { resolveConfig } from './config';
export type { TracingConfig } from './config';
