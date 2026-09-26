import { describe, expect, it } from 'vitest';
import { kafkaEnabled, telemetryTransport } from './kafka';

describe('kafkaEnabled', () => {
  // The bug this replaces: event-collector read `=== 'true'` and session-engine
  // read `!== 'false'`, so an unset variable sent events to Postgres while
  // session-engine tried to consume Kafka, failed to connect, and exited 1.
  it('is disabled when the variable is unset', () => {
    expect(kafkaEnabled({})).toBe(false);
  });

  it('is enabled only for the exact string "true"', () => {
    expect(kafkaEnabled({ KAFKA_ENABLED: 'true' })).toBe(true);
    expect(kafkaEnabled({ KAFKA_ENABLED: 'TRUE' })).toBe(false);
    expect(kafkaEnabled({ KAFKA_ENABLED: '1' })).toBe(false);
    expect(kafkaEnabled({ KAFKA_ENABLED: 'yes' })).toBe(false);
  });

  it('is disabled for "false"', () => {
    expect(kafkaEnabled({ KAFKA_ENABLED: 'false' })).toBe(false);
  });

  // An empty string is what a compose file or Railway variable set to nothing
  // produces, and it must not read as enabled.
  it('is disabled for an empty string', () => {
    expect(kafkaEnabled({ KAFKA_ENABLED: '' })).toBe(false);
  });
});

describe('telemetryTransport', () => {
  it('names the transport the collector will actually use', () => {
    expect(telemetryTransport({})).toBe('postgres');
    expect(telemetryTransport({ KAFKA_ENABLED: 'false' })).toBe('postgres');
    expect(telemetryTransport({ KAFKA_ENABLED: 'true' })).toBe('kafka');
  });
});
