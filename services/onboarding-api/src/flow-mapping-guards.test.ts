import assert from 'node:assert/strict';
import test from 'node:test';
import { flowMappingMode } from './flow-mapping-flag';
import { recordFlowMappingMetric, setFlowMappingMetricSink, type FlowMappingMetric } from './flow-mapping-telemetry';

test('the rollout flag defaults to on and reads the three stages', () => {
  // `on` is the steady state; an operator opts down from it while watching a
  // change, so an unset or unrecognised value must not disable mapping.
  assert.equal(flowMappingMode({} as NodeJS.ProcessEnv), 'on');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: '' } as NodeJS.ProcessEnv), 'on');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: 'nonsense' } as NodeJS.ProcessEnv), 'on');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: 'shadow' } as NodeJS.ProcessEnv), 'shadow');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: 'SHADOW' } as NodeJS.ProcessEnv), 'shadow');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: 'off' } as NodeJS.ProcessEnv), 'off');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: 'false' } as NodeJS.ProcessEnv), 'off');
  assert.equal(flowMappingMode({ FLOW_CODE_MAPPING_V2: '0' } as NodeJS.ProcessEnv), 'off');
});

test('metrics carry identifiers and counts, and refuse anything that reads as source', () => {
  const seen: FlowMappingMetric[] = [];
  const previous = setFlowMappingMetricSink((metric) => seen.push(metric));
  try {
    recordFlowMappingMetric({
      name: 'flow_mapping.resolution', initializationId: 'init-1', flowId: 'flow-1',
      retrievalVersion: '2.0.0', total: 6, resolved: 4, ambiguous: 1, unresolved: 2, unsupported: 0,
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].name, 'flow_mapping.resolution');

    // A rationale or an excerpt interpolated into a metric would ship the user's
    // code to wherever logs go, so length is checked at the boundary rather than
    // trusted to the caller's discipline.
    assert.throws(
      () => recordFlowMappingMetric({
        name: 'flow_mapping.override', initializationId: 'init-1',
        checkpointId: 'state:login', candidateId: 'c1',
        previousStatus: 'x'.repeat(200),
      }),
      /FLOW_MAPPING_METRIC_FIELD_TOO_LONG:flow_mapping\.override\.previousStatus/,
    );
    assert.equal(seen.length, 1, 'a refused metric is not emitted');
  } finally {
    setFlowMappingMetricSink(previous);
  }
});

test('a failing metric sink never breaks the operation being measured', () => {
  const previous = setFlowMappingMetricSink(() => {
    throw new Error('the log pipeline is down');
  });
  try {
    assert.doesNotThrow(() => recordFlowMappingMetric({
      name: 'flow_mapping.confirmations', initializationId: 'init-1', preserved: 2, dropped: 1,
    }));
  } finally {
    setFlowMappingMetricSink(previous);
  }
});
