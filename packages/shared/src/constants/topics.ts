/**
 * Canonical Kafka topic names for the SOTS platform.
 *
 * Naming convention: {domain}.{entity}.{action|state}
 * All consumers must reference these constants — never hard-code topic strings.
 */
export const Topics = {
  // ── Telemetry ingestion ──────────────────────────────────────────────────
  TELEMETRY_EVENTS:        'sots.telemetry.events.raw',
  TELEMETRY_EVENTS_PARSED: 'sots.telemetry.events.parsed',

  // ── Session lifecycle ────────────────────────────────────────────────────
  SESSIONS_COMPLETED: 'sots.sessions.completed',
  SESSION_REPLAYS:    'sots.sessions.replays',

  // ── Workflow / behavioral graph ──────────────────────────────────────────
  WORKFLOW_EVENTS:    'sots.workflow.events',
  FLOW_DECLARED:      'sots.flows.declared',
  FLOW_RECONCILED:    'sots.flows.reconciled',

  // ── Quality events ───────────────────────────────────────────────────────
  QUALITY_EVENTS:     'sots.quality.events',
  COVERAGE_COMPUTED:  'sots.coverage.computed',
  ENDPOINT_ALERTS:    'sots.endpoints.alerts',

  // ── AI / FDRS pipeline ───────────────────────────────────────────────────
  AI_INVOCATIONS:     'sots.ai.invocations',
  RULE_CANDIDATES:    'sots.rules.candidates',

  // ── Billing events ───────────────────────────────────────────────────────
  BILLING_EVENTS:     'sots.billing.events',
  PAYMENT_COMPLETED:  'sots.billing.payment.completed',
} as const;

export type TopicName = typeof Topics[keyof typeof Topics];

/**
 * Consumer group IDs for each service.
 * Using a central registry prevents accidental group ID collisions.
 */
export const ConsumerGroups = {
  GRAPH_ENGINE:          'sots.graph-engine',
  SESSION_ENGINE:        'sots.session-engine',
  COVERAGE_ENGINE:       'sots.coverage-engine',
  REPORT_ENGINE:         'sots.report-engine',
  CLICKHOUSE_INGESTER:   'sots.clickhouse-ingester',
  BILLING_WORKER:        'sots.billing-worker',
} as const;

export type ConsumerGroupId = typeof ConsumerGroups[keyof typeof ConsumerGroups];
