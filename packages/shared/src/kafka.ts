/**
 * Whether this deployment moves telemetry through Kafka.
 *
 * This existed three times with two different meanings. `event-collector` read
 * `=== 'true'`, so an unset variable meant "write straight to Postgres";
 * `session-engine`, `graph-engine` and `endpoint-engine` read `!== 'false'`, so
 * the same unset variable meant "start the Kafka consumer". With no broker
 * configured — which is every deployment that never set the variable, including
 * the one described by `.env.example` — the collector wrote to Postgres while
 * session-engine's `producer.connect()` exhausted its retries and exited 1. It
 * crash-looped, so the orphan sweeper never ran, so nothing on the Postgres path
 * was ever completed.
 *
 * The collector's polarity is the correct one: it decides where events actually
 * go, and a consumer must never expect a transport the producer is not using.
 * So Kafka is opt-in, and every service asks this function.
 */
export function kafkaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.KAFKA_ENABLED === 'true';
}

/** The transport name, for health payloads and start-up logs. */
export function telemetryTransport(
  env: Record<string, string | undefined> = process.env,
): 'kafka' | 'postgres' {
  return kafkaEnabled(env) ? 'kafka' : 'postgres';
}
