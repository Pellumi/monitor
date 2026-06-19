export const Topics = {
  TELEMETRY_EVENTS: 'telemetry.events',
  SESSIONS_COMPLETED: 'sessions.completed',
  WORKFLOW_EVENTS: 'workflow.events',
  QUALITY_EVENTS: 'quality.events',
} as const;

export type TopicName = typeof Topics[keyof typeof Topics];
