/**
 * Operational metrics for evidence-grounded Flow mapping.
 *
 * The one rule this file exists to enforce is that a metric carries identifiers
 * and counts and nothing else. Mapping handles the user's source, so a metric
 * that accidentally interpolated a rationale, an anchor or an excerpt would ship
 * their code to wherever logs go. The record types below admit only ids, enums
 * and numbers, and `recordFlowMappingMetric` refuses anything that looks like
 * prose at runtime — a type is a promise to the author, not to the pipeline.
 */

export type FlowMappingMetric =
  | {
      name: 'flow_mapping.resolution';
      initializationId: string;
      flowId: string;
      retrievalVersion: string;
      total: number;
      resolved: number;
      ambiguous: number;
      unresolved: number;
      unsupported: number;
    }
  | {
      name: 'flow_mapping.provider';
      initializationId: string;
      provider: string | null;
      model: string | null;
      attempted: boolean;
      fallbackUsed: boolean;
      repaired: boolean;
      consentMode: string;
    }
  | {
      name: 'flow_mapping.override';
      initializationId: string;
      checkpointId: string;
      candidateId: string;
      previousStatus: string;
    }
  | {
      name: 'flow_mapping.confirmations';
      initializationId: string;
      preserved: number;
      dropped: number;
    }
  | {
      name: 'flow_mapping.stale_analysis';
      initializationId: string;
      code: string;
    }
  | {
      name: 'flow_mapping.validation';
      initializationId: string;
      requirement: string;
      status: string;
      observed: number;
      missing: number;
      duplicateMarkers: number;
      unknownMarkers: number;
    };

/** Anything longer than this is prose, and prose is how source text escapes. */
const MAX_METRIC_STRING = 120;

export type FlowMappingMetricSink = (metric: FlowMappingMetric) => void;

const defaultSink: FlowMappingMetricSink = (metric) => {
  console.log(`[FlowMapping] ${JSON.stringify(metric)}`);
};

let sink: FlowMappingMetricSink = defaultSink;

/** Tests replace the sink; production leaves it alone. Returns the previous one. */
export function setFlowMappingMetricSink(next: FlowMappingMetricSink | null): FlowMappingMetricSink {
  const previous = sink;
  sink = next ?? defaultSink;
  return previous;
}

export function recordFlowMappingMetric(metric: FlowMappingMetric): void {
  for (const [key, value] of Object.entries(metric)) {
    if (typeof value === 'string' && value.length > MAX_METRIC_STRING) {
      throw new Error(`FLOW_MAPPING_METRIC_FIELD_TOO_LONG:${metric.name}.${key}`);
    }
  }
  try {
    sink(metric);
  } catch {
    // A metric must never be the reason initialization fails.
  }
}
