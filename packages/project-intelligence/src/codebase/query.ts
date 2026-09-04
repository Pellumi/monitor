import type { CodebaseAnalysis, CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';

/**
 * Queries answered directly from a finished analysis.
 *
 * These exist because an analysis can live in two places: in Postgres for a
 * workspace whose source was uploaded, and only on the user's machine for one
 * that declined. Both need the same answers, so the logic lives here rather than
 * being written twice and drifting.
 */

const STRUCTURAL = new Set([
  'IMPORTS', 'CALLS', 'DEPENDS_ON', 'EXTENDS', 'IMPLEMENTS', 'USES',
  'ROUTES_TO', 'TESTS', 'IMPLEMENTS_FEATURE',
]);

export type ProjectionQuery = {
  types?: string[];
  relationshipTypes?: string[];
  search?: string;
  depth?: number;
  limit?: number;
  rootId?: string | null;
  direction?: 'out' | 'in' | 'both';
};

export type Projection = {
  nodes: CodeEntity[];
  edges: CodeRelationship[];
  truncated: boolean;
  totalMatched: number;
};

function adjacency(analysis: CodebaseAnalysis, relationshipTypes: string[]) {
  const outgoing = new Map<string, CodeRelationship[]>();
  const incoming = new Map<string, CodeRelationship[]>();
  for (const edge of analysis.relationships) {
    if (relationshipTypes.length && !relationshipTypes.includes(edge.type)) continue;
    const out = outgoing.get(edge.source);
    if (out) out.push(edge); else outgoing.set(edge.source, [edge]);
    const into = incoming.get(edge.target);
    if (into) into.push(edge); else incoming.set(edge.target, [edge]);
  }
  return { outgoing, incoming };
}

export function projectAnalysis(analysis: CodebaseAnalysis, query: ProjectionQuery): Projection {
  const limit = Math.min(Math.max(query.limit ?? 250, 1), 2_000);
  const depth = Math.min(Math.max(query.depth ?? 1, 1), 6);
  const direction = query.direction ?? 'both';
  const types = query.types ?? [];
  const search = (query.search ?? '').toLowerCase();

  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const { outgoing, incoming } = adjacency(analysis, query.relationshipTypes ?? []);

  const seeds = analysis.entities.filter((entity) => {
    if (query.rootId) return entity.id === query.rootId;
    if (types.length && !types.includes(entity.type)) return false;
    if (!search) return true;
    return entity.name.toLowerCase().includes(search)
      || (entity.path ?? '').toLowerCase().includes(search);
  }).slice(0, limit);

  const nodes = new Map(seeds.map((entity) => [entity.id, entity]));
  const edges = new Map<string, CodeRelationship>();
  let frontier = seeds.map((entity) => entity.id);

  for (let hop = 0; hop < depth && nodes.size < limit; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const candidates = [
        ...(direction !== 'in' ? outgoing.get(id) ?? [] : []),
        ...(direction !== 'out' ? incoming.get(id) ?? [] : []),
      ];
      for (const edge of candidates) {
        edges.set(edge.id, edge);
        const other = edge.source === id ? edge.target : edge.source;
        if (nodes.has(other) || nodes.size >= limit) continue;
        const entity = byId.get(other);
        if (!entity) continue;
        nodes.set(other, entity);
        next.push(other);
      }
    }
    frontier = next;
  }

  const kept = new Set(nodes.keys());
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()].filter((edge) => kept.has(edge.source) && kept.has(edge.target)),
    truncated: nodes.size >= limit,
    totalMatched: nodes.size,
  };
}

export type PathResult = { nodes: CodeEntity[]; edges: CodeRelationship[]; found: boolean };

export function shortestPathInAnalysis(analysis: CodebaseAnalysis, source: string, target: string): PathResult {
  const { outgoing } = adjacency(analysis, []);
  const previous = new Map<string, CodeRelationship>();
  const visited = new Set([source]);
  const queue = [source];

  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) break;
    for (const edge of outgoing.get(current) ?? []) {
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);
      previous.set(edge.target, edge);
      queue.push(edge.target);
    }
  }
  if (source !== target && !previous.has(target)) return { nodes: [], edges: [], found: false };

  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const edges: CodeRelationship[] = [];
  let cursor = target;
  while (cursor !== source) {
    const edge = previous.get(cursor);
    if (!edge) break;
    edges.unshift(edge);
    cursor = edge.source;
  }
  const nodes = [source, ...edges.map((edge) => edge.target)]
    .map((id) => byId.get(id))
    .filter(Boolean) as CodeEntity[];
  return { nodes, edges, found: true };
}

export type BlastRadiusResult = {
  entityId: string;
  affected: { modules: number; functions: number; endpoints: number; jobs: number; tests: number; features: number };
  entityIds: string[];
  entities: CodeEntity[];
  truncated: boolean;
};

/** What could break if this changes: everything that reaches it, not what it reaches. */
export function blastRadiusInAnalysis(
  analysis: CodebaseAnalysis,
  entityId: string,
  maxDepth = 8,
  maxNodes = 2_000,
): BlastRadiusResult {
  const incoming = new Map<string, string[]>();
  for (const edge of analysis.relationships) {
    if (!STRUCTURAL.has(edge.type)) continue;
    const bucket = incoming.get(edge.target);
    if (bucket) bucket.push(edge.source);
    else incoming.set(edge.target, [edge.source]);
  }
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const visited = new Set([entityId]);
  let frontier = [entityId];
  let truncated = false;

  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const dependent of incoming.get(id) ?? []) {
        if (visited.has(dependent)) continue;
        if (visited.size >= maxNodes) { truncated = true; break; }
        visited.add(dependent);
        next.push(dependent);
      }
      if (truncated) break;
    }
    frontier = next;
  }
  visited.delete(entityId);

  const affected = { modules: 0, functions: 0, endpoints: 0, jobs: 0, tests: 0, features: 0 };
  for (const id of visited) {
    const entity = byId.get(id);
    if (!entity) continue;
    if (entity.type === 'file') affected.modules += 1;
    else if (entity.type === 'function' || entity.type === 'method') affected.functions += 1;
    else if (entity.type === 'endpoint' || entity.type === 'ui_route' || entity.type === 'ui_action') affected.endpoints += 1;
    else if (entity.type === 'job' || entity.type === 'queue') affected.jobs += 1;
    else if (entity.type === 'test') affected.tests += 1;
    else if (entity.type === 'feature') affected.features += 1;
  }

  const ids = [...visited];
  return {
    entityId,
    affected,
    entityIds: ids.slice(0, 500),
    entities: ids.slice(0, 200).map((id) => byId.get(id)).filter(Boolean) as CodeEntity[],
    truncated,
  };
}

export type AnsweredFeature = {
  featureId: string;
  name: string;
  summary: string;
  grounded: boolean;
  confidence: number;
  citations: CodebaseAnalysis['features'][number]['evidence'];
  sourceFiles: string[];
};

export type AnswerResult = {
  answer: string;
  grounded: boolean;
  uncertainty: string | null;
  features: AnsweredFeature[];
  citations: CodebaseAnalysis['features'][number]['evidence'];
};

/**
 * Rank features against a question by term overlap. This is the retrieval half
 * of answering; a caller with a model available can then describe the results,
 * and one without still returns the deterministic descriptions and citations.
 */
export function retrieveFeatures(analysis: CodebaseAnalysis, question: string, limit = 5) {
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  if (!terms.length) return [];
  return analysis.features
    .map((feature) => {
      const haystack = [
        feature.name, feature.description, feature.domain, ...feature.triggers,
        ...feature.reads, ...feature.writes, ...feature.externalServices,
        ...feature.emittedEvents, ...feature.sourceFiles,
        ...feature.workflow.map((step) => step.label),
      ].join(' ').toLowerCase();
      return { feature, score: terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name))
    .slice(0, limit);
}

const NOTHING_MATCHED =
  'Nothing in the analysed graph matches that question. The feature, service, or symbol it refers to was not discovered in this snapshot.';

/**
 * Answer a question from the analysis alone, with no model involved. Used when
 * the workspace kept its source on the device, so nothing can be sent anywhere.
 */
export function answerFromAnalysis(analysis: CodebaseAnalysis, question: string): AnswerResult {
  const matches = retrieveFeatures(analysis, question);
  if (!matches.length) {
    return { answer: NOTHING_MATCHED, grounded: false, uncertainty: null, features: [], citations: [] };
  }

  const explanations = new Map(analysis.explanations.map((item) => [item.featureId, item]));
  const features: AnsweredFeature[] = matches.map(({ feature }) => {
    const explanation = explanations.get(feature.id);
    return {
      featureId: feature.id,
      name: explanation?.grounded ? explanation.name : feature.name,
      summary: explanation?.grounded ? explanation.description : feature.description,
      grounded: explanation?.grounded ?? false,
      confidence: feature.confidence,
      citations: feature.evidence.slice(0, 6),
      sourceFiles: feature.sourceFiles.slice(0, 10),
    };
  });

  return {
    answer: features.map((item) => `${item.name}: ${item.summary}`).join('\n\n'),
    grounded: features.some((item) => item.grounded),
    uncertainty: features.every((item) => item.confidence < 0.7)
      ? 'The supporting evidence for this answer is weak. Treat it as a starting point and open the cited files to confirm.'
      : null,
    features,
    citations: features.flatMap((item) => item.citations).slice(0, 20),
  };
}

export type EntityDetail = ReturnType<typeof describeEntity>;

/** Callers, callees, dependencies and side effects for one entity. */
export function describeEntity(analysis: CodebaseAnalysis, entityId: string) {
  const entity = analysis.entities.find((item) => item.id === entityId);
  if (!entity) return null;

  const byId = new Map(analysis.entities.map((item) => [item.id, item]));
  const describe = (edge: CodeRelationship, side: 'source' | 'target') => ({
    relationship: edge.type,
    confidence: edge.confidence,
    evidence: edge.evidence.slice(0, 3),
    entity: byId.get(edge[side]) ?? null,
  });

  const outgoing = analysis.relationships.filter((edge) => edge.source === entity.id);
  const incoming = analysis.relationships.filter((edge) => edge.target === entity.id);
  const dependencyTypes = ['IMPORTS', 'DEPENDS_ON', 'USES'];

  return {
    entity,
    callees: outgoing.filter((edge) => edge.type === 'CALLS').slice(0, 200).map((edge) => describe(edge, 'target')),
    callers: incoming.filter((edge) => edge.type === 'CALLS').slice(0, 200).map((edge) => describe(edge, 'source')),
    dependencies: outgoing.filter((edge) => dependencyTypes.includes(edge.type)).slice(0, 200).map((edge) => describe(edge, 'target')),
    dependents: incoming.filter((edge) => dependencyTypes.includes(edge.type)).slice(0, 200).map((edge) => describe(edge, 'source')),
    dataAccess: outgoing.filter((edge) => edge.type === 'READS' || edge.type === 'WRITES').slice(0, 100).map((edge) => describe(edge, 'target')),
    sideEffects: outgoing.filter((edge) => ['PUBLISHES', 'CALLS_EXTERNAL', 'SUBSCRIBES_TO'].includes(edge.type)).slice(0, 100).map((edge) => describe(edge, 'target')),
    tests: incoming.filter((edge) => edge.type === 'TESTS').slice(0, 50).map((edge) => describe(edge, 'source')),
    features: analysis.features.filter((feature) =>
      feature.workflow.some((step) => step.entityId === entity.id)).slice(0, 20),
    evidence: entity.evidence,
  };
}

/** One level of the hierarchy tree, for lazy expansion. */
export function hierarchyChildren(analysis: CodebaseAnalysis, parentId: string | null) {
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const containment = analysis.relationships.filter(
    (edge) => edge.type === 'CONTAINS' || edge.type === 'DEFINES',
  );
  const expandable = new Set(containment.map((edge) => edge.source));

  let children: CodeEntity[];
  if (!parentId) {
    children = analysis.entities.filter((entity) => entity.type === 'repository');
    if (!children.length) {
      children = analysis.entities.filter((entity) =>
        entity.type === 'application' || entity.type === 'service');
    }
  } else {
    children = containment
      .filter((edge) => edge.source === parentId)
      .map((edge) => byId.get(edge.target))
      .filter(Boolean) as CodeEntity[];
  }

  return children
    .sort((left, right) => (left.type < right.type ? -1
      : left.type > right.type ? 1 : left.name.localeCompare(right.name)))
    .map((entity) => ({ ...entity, expandable: expandable.has(entity.id) }));
}
