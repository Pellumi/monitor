/**
 * @sots/telemetry — OpenTelemetry tracing configuration
 *
 * Environment-based configuration for the OTel NodeSDK.
 * Services control tracing through these environment variables:
 *
 *   OTEL_TRACES_ENABLED      — "true" to enable tracing (default: "false")
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP HTTP endpoint (default: "http://localhost:4318")
 *   OTEL_SERVICE_NAME        — Override service name (auto-detected if unset)
 */

export interface TracingConfig {
  /** Human-readable service name shown in Jaeger/Tempo */
  serviceName: string;
  /** OTLP HTTP exporter endpoint */
  endpoint: string;
  /** Whether tracing is enabled */
  enabled: boolean;
}

export function resolveConfig(serviceNameHint: string): TracingConfig {
  return {
    serviceName: process.env.OTEL_SERVICE_NAME || `sots-${serviceNameHint}`,
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    enabled: process.env.OTEL_TRACES_ENABLED === 'true',
  };
}
