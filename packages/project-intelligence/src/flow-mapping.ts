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

function overlapScore(queryTerms: string[], document: string): number {
  if (!queryTerms.length) return 0;
  const documentTerms = new Set(semanticTerms([document]));
  const matched = queryTerms.filter((term) => documentTerms.has(term)).length;
  return matched / Math.min(Math.max(queryTerms.length, 1), 6);
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

function sourceLocation(entity: CodeEntity): { path: string; startLine: number | null; endLine: number | null; symbol: string | null } | null {
  const evidence = entity.evidence.find((item) => item.path);
  const candidatePath = entity.path ?? evidence?.path;
  if (!candidatePath) return null;
  return {
    path: candidatePath.replaceAll('\\', '/'),
    startLine: entity.startLine ?? evidence?.startLine ?? null,
    endLine: entity.endLine ?? evidence?.endLine ?? null,
    symbol: evidence?.symbol ?? (['function', 'method', 'class', 'ui_action', 'endpoint'].includes(entity.type) ? entity.name : null),
  };
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(value, 1)) * 10_000) / 10_000;
}

function relationshipContext(
  analysis: CodebaseAnalysis,
  entity: CodeEntity,
  query: FlowMappingQuery,
  byId: Map<string, CodeEntity>,
): { score: number; paths: FlowMappingRelationshipPath[] } {
  const paths: FlowMappingRelationshipPath[] = [];
  let score = 0;
  for (const relationship of analysis.relationships) {
    if (relationship.source !== entity.id && relationship.target !== entity.id) continue;
    const neighborId = relationship.source === entity.id ? relationship.target : relationship.source;
    const neighbor = byId.get(neighborId);
    if (!neighbor) continue;
    const neighborScore = overlapScore(query.contextTerms, documentForEntity(neighbor));
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

function featureContext(analysis: CodebaseAnalysis, entity: CodeEntity, query: FlowMappingQuery) {
  const matched = analysis.features.filter((feature) =>
    feature.workflow.some((step) => step.entityId === entity.id)
    || feature.entrypoints.includes(entity.id)
    || (entity.path ? feature.sourceFiles.includes(entity.path) : false));
  let score = 0;
  for (const feature of matched) {
    const document = [
      feature.name, feature.description, feature.domain, ...feature.triggers, ...feature.reads,
      ...feature.writes, ...feature.externalServices, ...feature.emittedEvents,
      ...feature.downstreamEffects, ...feature.workflow.map((step) => step.label),
    ].join(' ');
    score = Math.max(score, overlapScore([...query.terms, ...query.contextTerms], document) * feature.confidence);
  }
  return {
    score: round(score),
    featureIds: matched.map((feature) => feature.id).sort(),
    evidence: matched.flatMap((feature) => feature.evidence).slice(0, 6),
  };
}

function candidateFor(
  analysis: CodebaseAnalysis,
  entity: CodeEntity,
  query: FlowMappingQuery,
  byId: Map<string, CodeEntity>,
): FlowMappingCandidate | null {
  const location = sourceLocation(entity);
  if (!location) return null;
  const document = documentForEntity(entity);
  const actionVerb = query.kind === 'TRANSITION' ? splitTerms(query.name)[0] : null;
  const directEntityTerms = new Set(splitTerms(document));
  const lexical = Math.min(1, overlapScore(query.terms, document)
    + (actionVerb && directEntityTerms.has(actionVerb) ? 0.25 : 0));
  const context = overlapScore(query.contextTerms, document);
  const graph = relationshipContext(analysis, entity, query, byId);
  const feature = featureContext(analysis, entity, query);
  const evidence = Math.max(0, ...entity.evidence.map((item) =>
    overlapScore([...query.terms, ...query.contextTerms], [item.symbol, item.path, item.excerpt].filter(Boolean).join(' ')) * item.confidence));

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

function boundedCandidates(candidates: FlowMappingCandidate[], maxCandidates: number, maxFiles: number): FlowMappingCandidate[] {
  const sorted = candidates.sort((left, right) =>
    right.score - left.score
    || right.confidence - left.confidence
    || left.path.localeCompare(right.path)
    || (left.startLine ?? Number.MAX_SAFE_INTEGER) - (right.startLine ?? Number.MAX_SAFE_INTEGER)
    || left.entityId.localeCompare(right.entityId));
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
  const byId = new Map(input.analysis.entities.map((entity) => [entity.id, entity]));
  const mappings = buildFlowMappingQueries(input.flow).map((query): FlowCheckpointMapping => {
    const candidates = boundedCandidates(
      input.analysis.entities
        .map((entity) => candidateFor(input.analysis, entity, query, byId))
        .filter((candidate): candidate is FlowMappingCandidate => candidate !== null),
      maxCandidates,
      maxFiles,
    );
    const outcome = mappingStatus(candidates);
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
): FlowMappingRetrievalResult {
  return retrieveFlowMappings({ analysis, flow });
}
