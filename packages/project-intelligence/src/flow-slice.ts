import type { CodebaseAnalysis, CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';

/**
 * The subgraph relevant to one Flow.
 *
 * An Automated Run compiles its executable contract and navigation graph from the code the Flow's
 * states and transitions are already mapped to (`FlowInitialization.finalMappings`), not from the
 * whole analysis. A large application can carry tens of thousands of entities; expanding a bounded
 * number of hops out from the Flow's own checkpoints, in both directions, captures the handlers,
 * routes, endpoints and controls a compile actually needs while leaving the rest of the codebase
 * out of the run's working set entirely.
 */

export interface FlowSliceOptions {
  /** Hops to expand from each seed, in either direction. */
  depth?: number;
  /** A hard cap, so a checkpoint that touches something central (a shared layout, a base API client) cannot pull in the whole graph. */
  maxEntities?: number;
}

export interface FlowSliceResult {
  entities: CodeEntity[];
  relationships: CodeRelationship[];
  /** True if the cap was reached before expansion naturally stopped: the slice is a partial view. */
  truncated: boolean;
}

export function flowSlice(analysis: CodebaseAnalysis, seedEntityIds: string[], options: FlowSliceOptions = {}): FlowSliceResult {
  const depth = Math.min(Math.max(options.depth ?? 3, 1), 10);
  const maxEntities = Math.min(Math.max(options.maxEntities ?? 5_000, 1), 20_000);

  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const outgoing = new Map<string, CodeRelationship[]>();
  const incoming = new Map<string, CodeRelationship[]>();
  for (const edge of analysis.relationships) {
    pushInto(outgoing, edge.source, edge);
    pushInto(incoming, edge.target, edge);
  }

  const kept = new Map<string, CodeEntity>();
  let frontier: string[] = [];
  for (const id of seedEntityIds) {
    const entity = byId.get(id);
    if (entity && !kept.has(id)) {
      kept.set(id, entity);
      frontier.push(id);
    }
  }

  let truncated = false;
  for (let hop = 0; hop < depth && frontier.length > 0 && kept.size < maxEntities; hop += 1) {
    const next: string[] = [];
    outer: for (const id of frontier) {
      for (const edge of [...(outgoing.get(id) ?? []), ...(incoming.get(id) ?? [])]) {
        const other = edge.source === id ? edge.target : edge.source;
        if (kept.has(other)) continue;
        if (kept.size >= maxEntities) { truncated = true; break outer; }
        const entity = byId.get(other);
        if (!entity) continue;
        kept.set(other, entity);
        next.push(other);
      }
    }
    frontier = next;
  }

  const relationships = analysis.relationships.filter((edge) => kept.has(edge.source) && kept.has(edge.target));
  return { entities: [...kept.values()], relationships, truncated };
}

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
