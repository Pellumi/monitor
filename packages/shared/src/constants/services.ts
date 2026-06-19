export const Services = {
  API_GATEWAY:       3000,   // Unified public entry point
  EVENT_COLLECTOR:   3001,
  GRAPH_ENGINE:      3002,
  COVERAGE_ENGINE:   3003,
  REPORT_ENGINE:     3004,
  DEMONSTRATION_API: 3005,
  ONBOARDING_API:    3006,   // org / app / API key management
  ENDPOINT_ENGINE:   3007,   // ClickHouse-backed endpoint intelligence
  FDRS_API:          3008,   // Flow Declaration & Reconciliation System (Section 22)
  BILLING_API:       3009,   // Payment processing and invoicing
  USAGE_TRACKER:     3012,   // Usage aggregation and limit warning emitter
  AUTH_API:          3013,   // Authentication & session management service
} as const;


export type ServiceName = keyof typeof Services;
