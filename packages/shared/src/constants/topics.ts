/**
 * Canonical Kafka topic names for the TELLANN platform.
 *
 * Naming convention: {domain}.{entity}.{action|state}
 * All consumers must reference these constants — never hard-code topic strings.
 */
export const Topics = {
  // ── Telemetry ingestion ──────────────────────────────────────────────────
  TELEMETRY_EVENTS:        'tellann.telemetry.events.raw',
  TELEMETRY_EVENTS_PARSED: 'tellann.telemetry.events.parsed',

  // ── Session lifecycle ────────────────────────────────────────────────────
  SESSIONS_COMPLETED: 'tellann.sessions.completed',
  SESSION_REPLAYS:    'tellann.sessions.replays',

  // ── Workflow / behavioral graph ──────────────────────────────────────────
  WORKFLOW_EVENTS:    'tellann.workflow.events',
  FLOW_DECLARED:      'tellann.flows.declared',
  FLOW_RECONCILED:    'tellann.flows.reconciled',

  // ── Quality events ───────────────────────────────────────────────────────
  QUALITY_EVENTS:     'tellann.quality.events',
  COVERAGE_COMPUTED:  'tellann.coverage.computed',
  ENDPOINT_ALERTS:    'tellann.endpoints.alerts',

  // ── AI / FDRS pipeline ───────────────────────────────────────────────────
  AI_INVOCATIONS:     'tellann.ai.invocations',
  RULE_CANDIDATES:    'tellann.rules.candidates',

  // ── Billing events ───────────────────────────────────────────────────────
  BILLING_EVENTS:     'tellann.billing.events',
  PAYMENT_COMPLETED:  'tellann.billing.payment.completed',
} as const;

export type TopicName = typeof Topics[keyof typeof Topics];

/**
 * Consumer group IDs for each service.
 * Using a central registry prevents accidental group ID collisions.
 */
export const ConsumerGroups = {
  GRAPH_ENGINE:          'tellann.graph-engine',
  SESSION_ENGINE:        'tellann.session-engine',
  COVERAGE_ENGINE:       'tellann.coverage-engine',
  REPORT_ENGINE:         'tellann.report-engine',
  CLICKHOUSE_INGESTER:   'tellann.clickhouse-ingester',
  BILLING_WORKER:        'tellann.billing-worker',
} as const;

export type ConsumerGroupId = typeof ConsumerGroups[keyof typeof ConsumerGroups];
