const UINT16_MAX = 65_535;
const UINT32_MAX = 4_294_967_295;

/**
 * Convert API metrics to the integer representation used by ClickHouse.
 * Some instrumentation sources use high-resolution timers and therefore emit
 * fractional milliseconds, while endpoint_metrics_v2 stores whole milliseconds.
 */
export function normalizeEndpointMetricValues(
  statusCode: unknown,
  durationMs: unknown,
): { statusCode: number; durationMs: number } | null {
  if (
    typeof statusCode !== 'number'
    || !Number.isInteger(statusCode)
    || statusCode < 0
    || statusCode > UINT16_MAX
    || typeof durationMs !== 'number'
    || !Number.isFinite(durationMs)
    || durationMs < 0
    || durationMs > UINT32_MAX
  ) {
    return null;
  }

  return {
    statusCode,
    durationMs: Math.round(durationMs),
  };
}
