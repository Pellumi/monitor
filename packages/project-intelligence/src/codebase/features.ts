import type { CodeEntity, SoftwareFeature } from '@tellann/desktop-contracts';
import { CONFIDENCE, GraphBuilder, stableId } from './core';
import type { Budget } from './program';

/** Edges that carry execution forward from an entrypoint. */
const FORWARD_EDGES = new Set(['ROUTES_TO', 'CALLS', 'READS', 'WRITES', 'PUBLISHES', 'CALLS_EXTERNAL', 'SUBSCRIBES_TO']);

const ENTRYPOINT_TYPES: CodeEntity['type'][] = ['endpoint', 'ui_route', 'ui_action', 'job'];

const AUTHORIZATION = /\b(auth|authorize|authorisation|authorization|guard|permission|role|policy|verifyjwt|requireauth|ensureauth|iscp?authenticated|session|rbac|acl|tenant|ownership)\b/i;

export type FeatureDiscoveryOptions = {
  maxFeatures?: number;
  maxNodesPerFeature?: number;
  maxDepth?: number;
};

type Traversal = {
  ordered: CodeEntity[];
  reads: Set<string>;
  writes: Set<string>;
  externals: Set<string>;
  events: Set<string>;
  queues: Set<string>;
  sourceFiles: Set<string>;
  authorization: Set<string>;
  truncated: boolean;
};

/**
 * Bounded forward walk. Side effects are accumulated as the walk visits them,
 * which is what keeps discovery linear; the previous implementation re-scanned
 * every relationship per model per feature.
 */
function walkForward(graph: GraphBuilder, startId: string, maxNodes: number, maxDepth: number): Traversal {
  const result: Traversal = {
    ordered: [],
    reads: new Set(), writes: new Set(), externals: new Set(),
    events: new Set(), queues: new Set(), sourceFiles: new Set(),
    authorization: new Set(), truncated: false,
  };
  const visited = new Set<string>([startId]);
  let queue: string[] = [startId];
  let depth = 0;

  while (queue.length && depth <= maxDepth) {
    const next: string[] = [];
    for (const id of queue) {
      const entity = graph.entity(id);
      if (!entity) continue;
      result.ordered.push(entity);
      if (entity.path) result.sourceFiles.add(entity.path);
      if (AUTHORIZATION.test(entity.name)) result.authorization.add(entity.name);

      for (const edge of graph.outgoingOf(id)) {
        if (!FORWARD_EDGES.has(edge.type)) continue;
        switch (edge.type) {
          case 'READS': result.reads.add(edge.target); break;
          case 'WRITES': result.writes.add(edge.target); break;
          case 'CALLS_EXTERNAL': result.externals.add(edge.target); break;
          case 'PUBLISHES': {
            const target = graph.entity(edge.target);
            if (target?.type === 'queue') result.queues.add(edge.target);
            else result.events.add(edge.target);
            break;
          }
          case 'SUBSCRIBES_TO': {
            const target = graph.entity(edge.target);
            if (target?.type === 'queue') result.queues.add(edge.target);
            break;
          }
          default: break;
        }
        if (visited.has(edge.target)) continue;
        if (visited.size >= maxNodes) { result.truncated = true; continue; }
        visited.add(edge.target);
        next.push(edge.target);
      }
    }
    queue = next;
    depth += 1;
  }
  if (queue.length) result.truncated = true;
  return result;
}

/**
 * Consumers of the events and queues a feature emits. This is the reverse half
 * of discovery: without it, an emailed receipt triggered by `order.created`
 * never appears as an effect of checking out.
 */
function downstreamOf(graph: GraphBuilder, traversal: Traversal, maxNodes: number): { labels: string[]; entityIds: string[] } {
  const labels = new Set<string>();
  const entityIds = new Set<string>();
  const sources = [...traversal.events, ...traversal.queues];

  for (const channelId of sources) {
    const channel = graph.entity(channelId);
    for (const edge of graph.outgoingOf(channelId)) {
      if (edge.type !== 'HANDLED_BY') continue;
      const handler = graph.entity(edge.target);
      if (!handler) continue;
      entityIds.add(handler.id);
      // What the consumer itself goes on to do is the effect worth reporting.
      const consumerEffects = walkForward(graph, handler.id, Math.min(maxNodes, 60), 4);
      const effects: string[] = [];
      for (const id of consumerEffects.externals) {
        const entity = graph.entity(id);
        if (entity) effects.push(entity.name);
      }
      for (const id of consumerEffects.writes) {
        const entity = graph.entity(id);
        if (entity) effects.push(`writes ${entity.name}`);
      }
      const detail = effects.length ? ` (${[...new Set(effects)].slice(0, 4).join(', ')})` : '';
      labels.add(`${channel?.name ?? 'event'} handled by ${handler.name}${detail}`);
      if (labels.size >= 40) break;
    }
  }
  return { labels: [...labels], entityIds: [...entityIds] };
}

const VERB_BY_METHOD: Record<string, string> = {
  GET: 'View', POST: 'Create', PUT: 'Replace', PATCH: 'Update', DELETE: 'Delete', ALL: 'Handle',
};

/** A name a person would recognise, derived from the entrypoint. */
function featureName(entity: CodeEntity): string {
  if (entity.type === 'endpoint') {
    const method = String(entity.metadata.method ?? '').toUpperCase();
    const route = String(entity.metadata.route ?? entity.name);
    if (entity.metadata.protocol === 'graphql') {
      return `${String(entity.metadata.operation ?? 'query')} ${String(entity.metadata.field ?? entity.name)}`
        .replace(/^./, (character) => character.toUpperCase());
    }
    const segments = route.split('/').filter((part) => part && part !== '{param}');
    const subject = segments.length ? segments[segments.length - 1].replace(/[-_]/g, ' ') : 'root';
    const verb = VERB_BY_METHOD[method] ?? method;
    return `${verb} ${subject}`.replace(/\s+/g, ' ').trim();
  }
  if (entity.type === 'ui_route') {
    const segments = entity.name.split('/').filter((part) => part && part !== '{param}');
    return segments.length ? `${segments.join(' ').replace(/[-_]/g, ' ')} page` : 'Home page';
  }
  return entity.name;
}

function describe(entity: CodeEntity, traversal: Traversal, downstream: string[]): string {
  const parts: string[] = [];
  if (traversal.reads.size) parts.push(`reads ${traversal.reads.size} data model(s)`);
  if (traversal.writes.size) parts.push(`writes ${traversal.writes.size} data model(s)`);
  if (traversal.externals.size) parts.push(`calls ${traversal.externals.size} external service(s)`);
  if (traversal.events.size) parts.push(`publishes ${traversal.events.size} event(s)`);
  if (downstream.length) parts.push(`triggers ${downstream.length} downstream handler(s)`);
  const trigger = entity.type === 'endpoint' ? `Entered through ${entity.name}`
    : entity.type === 'ui_route' ? `Entered from the ${entity.name} page`
      : entity.type === 'ui_action' ? `Triggered by ${entity.name}`
        : `Started by ${entity.name}`;
  return parts.length
    ? `${trigger}; ${parts.join(', ')}.`
    : `${trigger}. No data, event, or external side effects were resolved from this entrypoint.`;
}

/**
 * Confidence in a feature is the confidence of the evidence that built it, not
 * a fixed number. A feature assembled from checker-resolved calls into a
 * declared Prisma model is a stronger claim than one hanging off a single
 * heuristic route match.
 */
function featureConfidence(entity: CodeEntity, traversal: Traversal): number {
  const signals = [entity.confidence];
  if (traversal.ordered.length > 1) signals.push(CONFIDENCE.ast);
  if (traversal.writes.size || traversal.reads.size) signals.push(CONFIDENCE.frameworkConfig);
  if (traversal.externals.size) signals.push(CONFIDENCE.ast);
  const mean = signals.reduce((sum, value) => sum + value, 0) / signals.length;
  // A lone entrypoint that reached nothing is a weaker claim than the
  // entrypoint's own evidence suggests.
  const isolated = traversal.ordered.length <= 1;
  return Number((isolated ? Math.min(mean, CONFIDENCE.namingHeuristic) : mean).toFixed(3));
}

export function discoverFeatures(
  graph: GraphBuilder,
  budget: Budget,
  options: FeatureDiscoveryOptions = {},
): SoftwareFeature[] {
  const maxFeatures = options.maxFeatures ?? 2_000;
  const maxNodes = options.maxNodesPerFeature ?? 200;
  const maxDepth = options.maxDepth ?? 10;

  const entrypoints: CodeEntity[] = [];
  for (const type of ENTRYPOINT_TYPES) entrypoints.push(...graph.ofType(type));
  // Queue and event consumers are entrypoints too - work arrives at them from
  // outside the process just as surely as it arrives at an HTTP route.
  for (const channel of [...graph.ofType('queue'), ...graph.ofType('event')]) {
    const handlers = graph.outgoingOf(channel.id).filter((edge) => edge.type === 'HANDLED_BY');
    if (handlers.length) entrypoints.push(channel);
  }

  // Deterministic order so two runs of the same commit produce the same output.
  entrypoints.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  const features: SoftwareFeature[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const entry of entrypoints) {
    if (features.length >= maxFeatures) { truncated = true; break; }
    if (budget.exhausted) { truncated = true; break; }
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);

    const traversal = walkForward(graph, entry.id, maxNodes, maxDepth);
    const downstream = downstreamOf(graph, traversal, maxNodes);
    const nameOf = (id: string) => graph.entity(id)?.name ?? id;

    const id = stableId('feature', entry.id);
    const confidence = featureConfidence(entry, traversal);
    const evidence = traversal.ordered.flatMap((entity) => entity.evidence).slice(0, 20);

    features.push({
      id,
      name: featureName(entry),
      description: describe(entry, traversal, downstream.labels),
      domain: '',
      triggers: [entry.name],
      entrypoints: [entry.id],
      workflow: traversal.ordered
        .slice(0, 60)
        .map((entity) => ({ entityId: entity.id, label: `${entity.type.replaceAll('_', ' ')}: ${entity.name}` })),
      reads: [...traversal.reads].map(nameOf).sort(),
      writes: [...traversal.writes].map(nameOf).sort(),
      externalServices: [...traversal.externals].map(nameOf).sort(),
      emittedEvents: [...traversal.events].map(nameOf).sort(),
      downstreamEffects: downstream.labels.sort(),
      authorization: [...traversal.authorization].sort().slice(0, 10),
      sourceFiles: [...traversal.sourceFiles].sort().slice(0, 40),
      confidence,
      evidence,
    });
  }

  if (truncated) {
    graph.warn(
      `Feature discovery stopped at ${features.length} features; the remaining entrypoints are present in the graph but were not expanded into feature records.`,
    );
  }

  for (const feature of features) {
    graph.addEntity({
      id: feature.id,
      type: 'feature',
      name: feature.name,
      path: feature.sourceFiles[0] ?? null,
      startLine: null,
      endLine: null,
      language: null,
      confidence: feature.confidence,
      metadata: {
        triggers: feature.triggers,
        reads: feature.reads.length,
        writes: feature.writes.length,
        externals: feature.externalServices.length,
      },
      evidence: feature.evidence.slice(0, 5),
    });
    for (const entrypoint of feature.entrypoints) {
      graph.addEdge({
        source: feature.id,
        target: entrypoint,
        type: 'IMPLEMENTS_FEATURE',
        confidence: feature.confidence,
        evidence: feature.evidence.slice(0, 3),
      });
    }
  }

  return features;
}
