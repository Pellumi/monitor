import type {
  CodebaseAnalysis,
  CodeEntity,
  CodeEvidence,
  CodeRelationship,
} from '@tellann/desktop-contracts';

/** Increment when ranking semantics or the returned evidence shape changes. */
export const FLOW_MAPPING_RETRIEVAL_VERSION = '2.0.0';

export type FlowCheckpointKind = 'STATE' | 'TRANSITION';
export type FlowMappingStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'UNSUPPORTED';
export type FlowPlacementKind =
  | 'COMPONENT_MOUNT'
  | 'FUNCTION_ENTRY'
  | 'CALLBACK_ENTRY'
  | 'ROUTE_HANDLER_ENTRY'
  | 'BRANCH_ENTRY'
  | 'BEFORE_STATEMENT'
  | 'AFTER_STATEMENT';

export type FlowMappingStateInput = {
  id: string;
  stateName: string;
  category?: string | null;
  role?: 'NORMAL' | 'INITIAL' | 'TERMINAL' | null;
  terminalKind?: 'SUCCESS' | 'FAILURE' | 'CANCELLATION' | 'ALTERNATE' | null;
  canonicalBehavior?: string | null;
  aliases?: string[] | null;
};

export type FlowMappingTransitionInput = {
  id: string;
  fromStateId: string;
  toStateId: string;
  action?: string | null;
  condition?: string | null;
  aliases?: string[] | null;
};

export type FlowMappingFlowInput = {
  id: string;
  name: string;
  purpose?: string | null;
  scopeStatement?: string | null;
  tags?: string[] | null;
  states: FlowMappingStateInput[];
  transitions: FlowMappingTransitionInput[];
};

export type FlowMappingQuery = {
  checkpointId: string;
  kind: FlowCheckpointKind;
  name: string;
  terms: string[];
  contextTerms: string[];
  neighborNames: string[];
  stateRole: FlowMappingStateInput['role'];
  terminalKind: FlowMappingStateInput['terminalKind'];
  category: string | null;
  sourceStateId: string | null;
  sourceStateName: string | null;
  targetStateId: string | null;
  targetStateName: string | null;
};

export type FlowMappingRelationshipPath = {
  relationshipId: string;
  type: CodeRelationship['type'];
  source: string;
  target: string;
  neighborId: string;
  neighborName: string;
};

export type FlowMappingScoreBreakdown = {
  lexical: number;
  entityType: number;
  graph: number;
  feature: number;
  evidence: number;
  sourceLocation: number;
};

export type FlowMappingCandidate = {
  id: string;
  entityId: string;
  entityType: CodeEntity['type'];
  name: string;
  path: string;
  symbol: string | null;
  startLine: number | null;
  endLine: number | null;
  score: number;
  scoreBreakdown: FlowMappingScoreBreakdown;
  confidence: number;
  placementKinds: FlowPlacementKind[];
  featureIds: string[];
  evidence: CodeEvidence[];
  relationshipPaths: FlowMappingRelationshipPath[];
};

export type FlowCheckpointMapping = {
  checkpointId: string;
  kind: FlowCheckpointKind;
  name: string;
  status: FlowMappingStatus;
  confidence: number;
  query: FlowMappingQuery;
  selectedCandidateId: string | null;
  candidates: FlowMappingCandidate[];
};

export type FlowMappingRetrievalResult = {
  version: '2.0';
  retrievalVersion: string;
  analysis: {
    id: string;
    graphVersion: string;
    contentHash: string;
    revision: string | null;
    branch: string | null;
    dirty: boolean;
  };
  mappings: FlowCheckpointMapping[];
  coverage: {
    total: number;
    resolved: number;
    ambiguous: number;
    unresolved: number;
    unsupported: number;
  };
};

export type RetrieveFlowMappingsInput = {
  flow: FlowMappingFlowInput;
  analysis: CodebaseAnalysis;
  maxCandidates?: number;
  maxFiles?: number;
  /** A prebuilt index for this analysis, when the caller is holding one. */
  index?: RetrievalIndex;
  /** Called as each checkpoint is ranked, so a caller can report real progress. */
  onProgress?: (completed: number, total: number, status: FlowMappingStatus) => void;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'is', 'of', 'on',
  'or', 'page', 'state', 'the', 'then', 'to', 'user', 'with',
]);

const CONCEPTS = [
  ['login', 'signin', 'authenticate', 'authentication', 'auth', 'session'],
  ['logout', 'signout'],
  ['credential', 'credentials', 'password', 'email', 'username'],
  ['verify', 'verifying', 'verification', 'validate', 'validation', 'check'],
  ['submit', 'send', 'confirm'],
  ['dashboard', 'home', 'overview'],
  ['failure', 'failed', 'error', 'invalid'],
  ['success', 'succeeded', 'complete', 'completed'],
  ['register', 'registration', 'signup'],
] as const;

const CONCEPT_BY_TERM = new Map<string, readonly string[]>();
for (const concept of CONCEPTS) for (const term of concept) CONCEPT_BY_TERM.set(term, concept);

function splitTerms(value: string): string[] {
  const expandedCamelCase = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const normalizedPhrases = expandedCamelCase
    .replace(/sign[\s_/-]*in/gi, ' login ')
    .replace(/log[\s_/-]*in/gi, ' login ')
    .replace(/sign[\s_/-]*up/gi, ' register ')
    .replace(/sign[\s_/-]*out/gi, ' logout ');
  return normalizedPhrases.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function semanticTerms(values: Array<string | null | undefined>): string[] {
  const direct = new Set(values.flatMap((value) => value ? splitTerms(value) : []));
  const expanded = new Set(direct);
  for (const term of direct) for (const synonym of CONCEPT_BY_TERM.get(term) ?? []) expanded.add(synonym);
  return [...expanded].sort();
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildFlowMappingQueries(flow: FlowMappingFlowInput): FlowMappingQuery[] {
  const byId = new Map(flow.states.map((state) => [state.id, state]));
  const stateQueries = flow.states.map((state): FlowMappingQuery => {
    const adjacent = flow.transitions.filter((transition) =>
      transition.fromStateId === state.id || transition.toStateId === state.id);
    const neighborNames = unique(adjacent.flatMap((transition) => {
      const otherId = transition.fromStateId === state.id ? transition.toStateId : transition.fromStateId;
      return [transition.action, byId.get(otherId)?.stateName];
    }));
    return {
      checkpointId: `state:${state.id}`,
      kind: 'STATE',
      name: state.stateName,
      terms: semanticTerms([state.stateName, state.canonicalBehavior, ...(state.aliases ?? [])]),
      contextTerms: semanticTerms([flow.name, flow.purpose, flow.scopeStatement, state.category, state.role, state.terminalKind, ...neighborNames]),
      neighborNames,
      stateRole: state.role ?? null,
      terminalKind: state.terminalKind ?? null,
      category: state.category ?? null,
      sourceStateId: null,
      sourceStateName: null,
      targetStateId: null,
      targetStateName: null,
    };
  });

  const transitionQueries = flow.transitions.map((transition): FlowMappingQuery => {
    const source = byId.get(transition.fromStateId);
    const target = byId.get(transition.toStateId);
    const name = transition.action || `${source?.stateName ?? transition.fromStateId} to ${target?.stateName ?? transition.toStateId}`;
    const neighborNames = unique([source?.stateName, target?.stateName]);
    return {
      checkpointId: `transition:${transition.id}`,
      kind: 'TRANSITION',
      name,
      terms: semanticTerms([name, transition.condition, ...(transition.aliases ?? [])]),
      contextTerms: semanticTerms([flow.name, flow.purpose, flow.scopeStatement, source?.stateName, target?.stateName, transition.condition]),
      neighborNames,
      stateRole: null,
      terminalKind: target?.terminalKind ?? null,
      category: null,
      sourceStateId: transition.fromStateId,
      sourceStateName: source?.stateName ?? null,
      targetStateId: transition.toStateId,
      targetStateName: target?.stateName ?? null,
    };
  });

  return [...stateQueries, ...transitionQueries];
}

function documentForEntity(entity: CodeEntity): string {
  const metadata = Object.values(entity.metadata).flatMap((value) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    return [];
  });
  return [
    entity.name, entity.path, entity.type, ...metadata,
    ...entity.evidence.flatMap((item) => [item.symbol, item.path, item.excerpt]),
  ].filter((item): item is string => Boolean(item)).join(' ');
}

/**
 * How much of a checkpoint's language a document contains.
 *
 * Takes an already-tokenized document because tokenizing is the expensive part
 * and every document is compared against every checkpoint: doing it here would
 * re-split the same text once per checkpoint per comparison.
 */
function overlapScore(queryTerms: string[], documentTerms: Set<string>): number {
  if (!queryTerms.length) return 0;
  let matched = 0;
  for (const term of queryTerms) if (documentTerms.has(term)) matched += 1;
  return matched / Math.min(Math.max(queryTerms.length, 1), 6);
}

function termSet(value: string): Set<string> {
  return new Set(semanticTerms([value]));
}

function entityTypeScore(query: FlowMappingQuery, type: CodeEntity['type']): number {
  if (query.kind === 'TRANSITION') {
    if (type === 'ui_action') return 1;
    if (type === 'function' || type === 'method') return 0.9;
    if (type === 'endpoint') return 0.85;
    if (type === 'event' || type === 'queue' || type === 'job') return 0.75;
    if (type === 'ui_route') return 0.45;
    return 0.15;
  }
  if (query.category?.toLowerCase().includes('ui')) {
    if (type === 'ui_route') return 1;
    if (type === 'ui_action') return 0.75;
  }
  if (type === 'ui_route') return 0.9;
  if (type === 'function' || type === 'method') return 0.75;
  if (type === 'endpoint') return 0.65;
  if (type === 'event' || type === 'queue' || type === 'job') return 0.6;
  return 0.2;
}

function placementKinds(entity: CodeEntity): FlowPlacementKind[] {
  switch (entity.type) {
    case 'ui_route': return ['COMPONENT_MOUNT', 'FUNCTION_ENTRY'];
    case 'ui_action': return ['CALLBACK_ENTRY', 'BEFORE_STATEMENT', 'AFTER_STATEMENT'];
    case 'endpoint': return ['ROUTE_HANDLER_ENTRY', 'FUNCTION_ENTRY'];
    case 'function':
    case 'method': return ['FUNCTION_ENTRY', 'BRANCH_ENTRY', 'BEFORE_STATEMENT', 'AFTER_STATEMENT'];
    case 'event':
    case 'queue':
    case 'job': return ['CALLBACK_ENTRY', 'FUNCTION_ENTRY'];
    default: return [];
  }
}

/**
 * The component a file-scoped route renders.
 *
 * A Next.js `page.tsx` becomes a `ui_route` entity named after its URL, derived
 * from where the file sits rather than from any declaration — so it carries a
 * path, line 1, and no symbol. Instrumentation needs a real declaration to
 * anchor against, and a person reviewing the mapping needs a name to recognise,
 * so resolve the route to the component declared in the same file.
 */
function routeComponent(entity: CodeEntity, byPath: Map<string, CodeEntity[]>): CodeEntity | null {
  if (!entity.path) return null;
  const declared = (byPath.get(entity.path) ?? []).filter((item) =>
    item.id !== entity.id && (item.type === 'function' || item.type === 'class') && item.startLine !== null);
  if (!declared.length) return null;
  // A React component is conventionally PascalCase; prefer one, and otherwise
  // take the outermost declaration in the file rather than guessing.
  return declared.find((item) => /^[A-Z]/.test(item.name))
    ?? [...declared].sort((left, right) => (left.startLine ?? 0) - (right.startLine ?? 0))[0];
}

const SYMBOL_BEARING_TYPES = ['function', 'method', 'class', 'ui_action', 'endpoint'];

function sourceLocation(entity: CodeEntity, byPath: Map<string, CodeEntity[]>): { path: string; startLine: number | null; endLine: number | null; symbol: string | null } | null {
  const evidence = entity.evidence.find((item) => item.path);
  const candidatePath = entity.path ?? evidence?.path;
  if (!candidatePath) return null;
  const component = entity.type === 'ui_route' ? routeComponent(entity, byPath) : null;
  return {
    path: candidatePath.replaceAll('\\', '/'),
    startLine: component?.startLine ?? entity.startLine ?? evidence?.startLine ?? null,
    endLine: component?.endLine ?? entity.endLine ?? evidence?.endLine ?? null,
    symbol: component?.name
      ?? evidence?.symbol
      ?? (SYMBOL_BEARING_TYPES.includes(entity.type) ? entity.name : null),
  };
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(value, 1)) * 10_000) / 10_000;
}

/**
 * Everything about the analysis that does not depend on which checkpoint is
 * being matched, computed once.
 *
 * Ranking compares every checkpoint against every entity, and the original
 * shape of this code re-derived per comparison what is actually a property of
 * the codebase: each entity's tokens, the relationships touching it, the
 * features claiming it. That made the work checkpoints x entities x
 * relationships, with a full re-tokenization at the innermost step — fine for a
 * three-state fixture, and minutes of a blocked process for a real repository
 * with fifty checkpoints. Hoisting it here leaves the scoring identical and the
 * cost proportional to the graph rather than to its square.
 */
export type RetrievalIndex = {
  byId: Map<string, CodeEntity>;
  entityTerms: Map<string, Set<string>>;
  entityDirectTerms: Map<string, Set<string>>;
  relationships: Map<string, CodeRelationship[]>;
  features: Map<string, CodebaseAnalysis['features']>;
  featureTerms: Map<string, Set<string>>;
  evidenceTerms: Map<string, Array<{ terms: Set<string>; confidence: number }>>;
  location: Map<string, { path: string; startLine: number | null; endLine: number | null; symbol: string | null }>;
  /** term -> every entity whose document contains it. */
  postings: Map<string, string[]>;
  /** term -> every feature whose description contains it. */
  featurePostings: Map<string, string[]>;
  /** feature -> every entity it claims. */
  featureMembers: Map<string, string[]>;
  /** Entities that can be a candidate at all, in stable order. */
  locatable: CodeEntity[];
};

function buildRetrievalIndex(analysis: CodebaseAnalysis): RetrievalIndex {
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const byPath = new Map<string, CodeEntity[]>();
  for (const entity of analysis.entities) {
    if (!entity.path) continue;
    const existing = byPath.get(entity.path);
    if (existing) existing.push(entity);
    else byPath.set(entity.path, [entity]);
  }

  const entityTerms = new Map<string, Set<string>>();
  const entityDirectTerms = new Map<string, Set<string>>();
  const evidenceTerms = new Map<string, Array<{ terms: Set<string>; confidence: number }>>();
  const location = new Map<string, { path: string; startLine: number | null; endLine: number | null; symbol: string | null }>();
  for (const entity of analysis.entities) {
    const document = documentForEntity(entity);
    entityTerms.set(entity.id, termSet(document));
    entityDirectTerms.set(entity.id, new Set(splitTerms(document)));
    evidenceTerms.set(entity.id, entity.evidence.map((item) => ({
      terms: termSet([item.symbol, item.path, item.excerpt].filter(Boolean).join(' ')),
      confidence: item.confidence,
    })));
    const resolved = sourceLocation(entity, byPath);
    if (resolved) location.set(entity.id, resolved);
  }

  const relationships = new Map<string, CodeRelationship[]>();
  const attach = (id: string, relationship: CodeRelationship) => {
    const existing = relationships.get(id);
    if (existing) existing.push(relationship);
    else relationships.set(id, [relationship]);
  };
  for (const relationship of analysis.relationships) {
    attach(relationship.source, relationship);
    if (relationship.target !== relationship.source) attach(relationship.target, relationship);
  }

  const features = new Map<string, CodebaseAnalysis['features']>();
  const featureTerms = new Map<string, Set<string>>();
  const featureMembers = new Map<string, string[]>();
  for (const feature of analysis.features) {
    featureTerms.set(feature.id, termSet([
      feature.name, feature.description, feature.domain, ...feature.triggers, ...feature.reads,
      ...feature.writes, ...feature.externalServices, ...feature.emittedEvents,
      ...feature.downstreamEffects, ...feature.workflow.map((step) => step.label),
    ].join(' ')));
    const claimed = new Set<string>([
      ...feature.workflow.map((step) => step.entityId),
      ...feature.entrypoints,
    ]);
    for (const sourceFile of feature.sourceFiles) {
      for (const entity of byPath.get(sourceFile) ?? []) claimed.add(entity.id);
    }
    featureMembers.set(feature.id, [...claimed]);
    for (const entityId of claimed) {
      const existing = features.get(entityId);
      if (existing) existing.push(feature);
      else features.set(entityId, [feature]);
    }
  }

  // The inverted lists. Scoring used to visit every entity for every checkpoint
  // and discard almost all of them at the final rejection — the zeros cost the
  // same as the matches, and on a real repository they are the overwhelming
  // majority of the work. These make it possible to enumerate only the entities
  // that can survive that rejection, without changing what the rejection is.
  const postings = new Map<string, string[]>();
  for (const [entityId, terms] of entityTerms) {
    for (const term of terms) {
      const existing = postings.get(term);
      if (existing) existing.push(entityId);
      else postings.set(term, [entityId]);
    }
  }
  const featurePostings = new Map<string, string[]>();
  for (const [featureId, terms] of featureTerms) {
    for (const term of terms) {
      const existing = featurePostings.get(term);
      if (existing) existing.push(featureId);
      else featurePostings.set(term, [featureId]);
    }
  }

  return {
    byId, entityTerms, entityDirectTerms, relationships, features, featureTerms, evidenceTerms, location,
    postings, featurePostings, featureMembers,
    locatable: analysis.entities.filter((entity) => location.has(entity.id)),
  };
}

/**
 * The index for this analysis, built at most once.
 *
 * Tokenizing every entity's document is the expensive half of retrieval and is a
 * property of the analysed tree, not of the Flow being mapped — so initializing
 * a second Flow against the same analysis used to pay for it again, at full
 * price.
 *
 * Keyed on the analysis object rather than on `analysis.id`. An id is a claim
 * about content that this module cannot check, and an index handed back for a
 * graph it was not built from is not a slow answer but a wrong one. Identity is
 * free to verify and cannot be wrong; a caller that wants the saving keeps the
 * analysis it is mapping against, which is what holding it in a worker does.
 */
const indexByAnalysis = new WeakMap<CodebaseAnalysis, RetrievalIndex>();

export function flowRetrievalIndexFor(analysis: CodebaseAnalysis): RetrievalIndex {
  const existing = indexByAnalysis.get(analysis);
  if (existing) return existing;
  const index = buildRetrievalIndex(analysis);
  indexByAnalysis.set(analysis, index);
  return index;
}

/**
 * Every entity that could survive scoring for this checkpoint.
 *
 * Mirrors the rejection in `candidateFor` exactly, one clause at a time: an
 * entity is kept when its own document shares a term with the query (lexical or
 * context), when it neighbours something whose document shares a context term
 * (graph), or when a feature that shares a query term claims it (feature). An
 * entity outside all three scores zero on all four axes and is rejected, so
 * leaving it out changes nothing about the result — only about how long it takes
 * to reach.
 */
function reachableCandidates(index: RetrievalIndex, query: FlowMappingQuery, allQueryTerms: string[]): CodeEntity[] {
  const keep = new Set<string>();
  for (const term of allQueryTerms) {
    for (const entityId of index.postings.get(term) ?? []) {
      if (index.location.has(entityId)) keep.add(entityId);
    }
  }

  // A graph score needs a *neighbour* whose document matches the context, and
  // that neighbour need not be placeable itself.
  const contextMatches = new Set<string>();
  for (const term of query.contextTerms) {
    for (const entityId of index.postings.get(term) ?? []) contextMatches.add(entityId);
  }
  for (const entityId of contextMatches) {
    for (const relationship of index.relationships.get(entityId) ?? []) {
      const neighborId = relationship.source === entityId ? relationship.target : relationship.source;
      if (index.location.has(neighborId)) keep.add(neighborId);
    }
  }

  const matchedFeatures = new Set<string>();
  for (const term of allQueryTerms) {
    for (const featureId of index.featurePostings.get(term) ?? []) matchedFeatures.add(featureId);
  }
  for (const featureId of matchedFeatures) {
    for (const entityId of index.featureMembers.get(featureId) ?? []) {
      if (index.location.has(entityId)) keep.add(entityId);
    }
  }

  // Returned in the analysis's own order so ranking ties break the same way they
  // did when every entity was walked.
  return index.locatable.filter((entity) => keep.has(entity.id));
}

function relationshipContext(
  index: RetrievalIndex,
  entity: CodeEntity,
  query: FlowMappingQuery,
): { score: number; paths: FlowMappingRelationshipPath[] } {
  const paths: FlowMappingRelationshipPath[] = [];
  let score = 0;
  for (const relationship of index.relationships.get(entity.id) ?? []) {
    const neighborId = relationship.source === entity.id ? relationship.target : relationship.source;
    const neighbor = index.byId.get(neighborId);
    if (!neighbor) continue;
    const neighborScore = overlapScore(query.contextTerms, index.entityTerms.get(neighborId)!);
    if (neighborScore <= 0) continue;
    const relationshipWeight = ['ROUTES_TO', 'CALLS', 'HANDLED_BY', 'IMPLEMENTS_FEATURE'].includes(relationship.type) ? 1 : 0.7;
    // For a transition, the source of CALLS/ROUTES_TO is normally the action
    // site while the target is the work it triggers. Preserve that direction
    // so a generic `submit` handler can beat a downstream verifier when the
    // declared checkpoint is the submit action itself.
    const directionWeight = query.kind === 'TRANSITION' && relationship.target === entity.id ? 0.6 : 1;
    score = Math.max(score, neighborScore * relationship.confidence * relationshipWeight * directionWeight);
    paths.push({
      relationshipId: relationship.id,
      type: relationship.type,
      source: relationship.source,
      target: relationship.target,
      neighborId,
      neighborName: neighbor.name,
    });
  }
  return { score: round(score), paths: paths.slice(0, 6) };
}

function featureContext(index: RetrievalIndex, entity: CodeEntity, allQueryTerms: string[]) {
  const matched = index.features.get(entity.id) ?? [];
  let score = 0;
  for (const feature of matched) {
    score = Math.max(score, overlapScore(allQueryTerms, index.featureTerms.get(feature.id)!) * feature.confidence);
  }
  return {
    score: round(score),
    featureIds: matched.map((feature) => feature.id).sort(),
    evidence: matched.flatMap((feature) => feature.evidence).slice(0, 6),
  };
}

function candidateFor(
  index: RetrievalIndex,
  entity: CodeEntity,
  query: FlowMappingQuery,
  actionVerb: string | null,
  allQueryTerms: string[],
): FlowMappingCandidate | null {
  const location = index.location.get(entity.id);
  if (!location) return null;
  const documentTerms = index.entityTerms.get(entity.id)!;
  const lexical = Math.min(1, overlapScore(query.terms, documentTerms)
    + (actionVerb && index.entityDirectTerms.get(entity.id)!.has(actionVerb) ? 0.25 : 0));
  const context = overlapScore(query.contextTerms, documentTerms);
  const graph = relationshipContext(index, entity, query);
  const feature = featureContext(index, entity, allQueryTerms);
  const evidence = Math.max(0, ...(index.evidenceTerms.get(entity.id) ?? []).map((item) =>
    overlapScore(allQueryTerms, item.terms) * item.confidence));

  // A candidate must contain direct intent language or be supported by graph/feature context.
  // Merely having the right entity type is deliberately insufficient.
  if (lexical === 0 && context < 0.2 && graph.score === 0 && feature.score === 0) return null;

  const breakdown: FlowMappingScoreBreakdown = {
    lexical: round(lexical),
    entityType: round(entityTypeScore(query, entity.type)),
    graph: round(graph.score),
    feature: round(feature.score),
    evidence: round(evidence),
    sourceLocation: location.startLine !== null ? 1 : 0.45,
  };
  const score = round(
    breakdown.lexical * 0.46
    + breakdown.entityType * 0.14
    + breakdown.graph * 0.14
    + breakdown.feature * 0.14
    + breakdown.evidence * 0.07
    + breakdown.sourceLocation * 0.05,
  );
  const combinedEvidence = [...entity.evidence, ...feature.evidence]
    .sort((left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path))
    .slice(0, 8);
  return {
    id: `${query.checkpointId}:${entity.id}`,
    entityId: entity.id,
    entityType: entity.type,
    name: entity.name,
    ...location,
    score,
    scoreBreakdown: breakdown,
    confidence: round(Math.min(score, entity.confidence, Math.max(entity.confidence * 0.75, score))),
    placementKinds: placementKinds(entity),
    featureIds: feature.featureIds,
    evidence: combinedEvidence,
    relationshipPaths: graph.paths,
  };
}

function rankCandidates(left: FlowMappingCandidate, right: FlowMappingCandidate): number {
  return right.score - left.score
    || right.confidence - left.confidence
    || left.path.localeCompare(right.path)
    || (left.startLine ?? Number.MAX_SAFE_INTEGER) - (right.startLine ?? Number.MAX_SAFE_INTEGER)
    || left.entityId.localeCompare(right.entityId);
}

/**
 * How deep a shortlist is kept before bounding.
 *
 * The final list is at most eight candidates across five files, but the file
 * budget means the eighth can be some way down the ranking, so a plain top-eight
 * would not always agree with sorting everything. This is far past the depth any
 * file budget can reach and keeps the collector's cost constant in the number of
 * scored entities rather than growing with it.
 */
const RANKED_BUFFER = 256;

/** The best `limit` candidates, without sorting the whole list to find them. */
function topRanked(limit: number): { offer(candidate: FlowMappingCandidate): void; take(): FlowMappingCandidate[] } {
  const ranked: FlowMappingCandidate[] = [];
  return {
    offer(candidate) {
      if (ranked.length >= limit && rankCandidates(candidate, ranked[ranked.length - 1]) >= 0) return;
      // Insertion point by binary search: the buffer is bounded, so this is a
      // fixed cost per candidate.
      let low = 0;
      let high = ranked.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (rankCandidates(candidate, ranked[middle]) < 0) high = middle;
        else low = middle + 1;
      }
      ranked.splice(low, 0, candidate);
      if (ranked.length > limit) ranked.pop();
    },
    take: () => ranked,
  };
}

function boundedCandidates(candidates: FlowMappingCandidate[], maxCandidates: number, maxFiles: number): FlowMappingCandidate[] {
  const sorted = candidates.sort(rankCandidates);
  const locations = new Set<string>();
  const files = new Set<string>();
  const bounded: FlowMappingCandidate[] = [];
  for (const candidate of sorted) {
    const location = `${candidate.path}:${candidate.startLine ?? ''}:${candidate.endLine ?? ''}`;
    if (locations.has(location)) continue;
    if (!files.has(candidate.path) && files.size >= maxFiles) continue;
    locations.add(location);
    files.add(candidate.path);
    bounded.push(candidate);
    if (bounded.length >= maxCandidates) break;
  }
  return bounded;
}

function mappingStatus(candidates: FlowMappingCandidate[]): { status: FlowMappingStatus; confidence: number } {
  if (!candidates.length) return { status: 'UNRESOLVED', confidence: 0 };
  const supported = candidates.filter((candidate) => candidate.placementKinds.length > 0);
  if (!supported.length) return { status: 'UNSUPPORTED', confidence: candidates[0].confidence };
  const top = supported[0];
  const runnerUp = supported[1];
  const margin = top.score - (runnerUp?.score ?? 0);
  if (top.score >= 0.5 && (!runnerUp || margin >= 0.08)) return { status: 'RESOLVED', confidence: top.confidence };
  return { status: 'AMBIGUOUS', confidence: top.confidence };
}

export function retrieveFlowMappings(input: RetrieveFlowMappingsInput): FlowMappingRetrievalResult {
  const maxCandidates = Math.min(Math.max(input.maxCandidates ?? 8, 1), 8);
  const maxFiles = Math.min(Math.max(input.maxFiles ?? 5, 1), 5);
  const index = input.index ?? flowRetrievalIndexFor(input.analysis);
  const queries = buildFlowMappingQueries(input.flow);
  const mappings = queries.map((query, position): FlowCheckpointMapping => {
    const actionVerb = query.kind === 'TRANSITION' ? splitTerms(query.name)[0] ?? null : null;
    const allQueryTerms = [...query.terms, ...query.contextTerms];
    const ranked = topRanked(RANKED_BUFFER);
    for (const entity of reachableCandidates(index, query, allQueryTerms)) {
      const candidate = candidateFor(index, entity, query, actionVerb, allQueryTerms);
      if (candidate) ranked.offer(candidate);
    }
    const candidates = boundedCandidates(ranked.take(), maxCandidates, maxFiles);
    const outcome = mappingStatus(candidates);
    // Reported per checkpoint rather than per run: mapping a large Flow takes
    // long enough that a banner which never moves is indistinguishable from a
    // hang, and only this loop knows how far along it is.
    input.onProgress?.(position + 1, queries.length, outcome.status);
    return {
      checkpointId: query.checkpointId,
      kind: query.kind,
      name: query.name,
      status: outcome.status,
      confidence: outcome.confidence,
      query,
      selectedCandidateId: outcome.status === 'RESOLVED'
        ? candidates.find((candidate) => candidate.placementKinds.length > 0)?.id ?? null
        : null,
      candidates,
    };
  });
  const count = (status: FlowMappingStatus) => mappings.filter((mapping) => mapping.status === status).length;
  return {
    version: '2.0',
    retrievalVersion: FLOW_MAPPING_RETRIEVAL_VERSION,
    analysis: {
      id: input.analysis.id,
      graphVersion: input.analysis.graphVersion,
      contentHash: input.analysis.contentHash,
      revision: input.analysis.revision,
      branch: input.analysis.branch,
      dirty: input.analysis.dirty,
    },
    mappings,
    coverage: {
      total: mappings.length,
      resolved: count('RESOLVED'),
      ambiguous: count('AMBIGUOUS'),
      unresolved: count('UNRESOLVED'),
      unsupported: count('UNSUPPORTED'),
    },
  };
}

/** Convenience entrypoint used by API and Electron callers. */
export function retrieveFlowCheckpointCandidates(
  analysis: CodebaseAnalysis,
  flow: FlowMappingFlowInput,
  options: { index?: RetrievalIndex; onProgress?: RetrieveFlowMappingsInput['onProgress'] } = {},
): FlowMappingRetrievalResult {
  return retrieveFlowMappings({ analysis, flow, ...options });
}
