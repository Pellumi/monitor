import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEndpointMetricValues } from './metric-values';

test('rounds fractional durations for the UInt32 ClickHouse column', () => {
  assert.deepEqual(normalizeEndpointMetricValues(200, 123.397), {
    statusCode: 200,
    durationMs: 123,
  });
  assert.deepEqual(normalizeEndpointMetricValues(200, 123.888), {
    statusCode: 200,
    durationMs: 124,
  });
});

test('rejects values that cannot be inserted into the ClickHouse columns', () => {
  assert.equal(normalizeEndpointMetricValues(200.5, 10), null);
  assert.equal(normalizeEndpointMetricValues(70_000, 10), null);
  assert.equal(normalizeEndpointMetricValues(200, Number.NaN), null);
  assert.equal(normalizeEndpointMetricValues(200, -1), null);
  assert.equal(normalizeEndpointMetricValues(200, 4_294_967_296), null);
});
