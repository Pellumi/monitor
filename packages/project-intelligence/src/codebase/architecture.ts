import type { CodebaseFinding, CodeEntity } from '@tellann/desktop-contracts';
import { CONFIDENCE, GraphBuilder, stableId } from './core';

/** Structural edges that mean "this unit needs that unit". */
const STRUCTURAL = new Set(['IMPORTS', 'CALLS', 'DEPENDS_ON', 'EXTENDS', 'IMPLEMENTS', 'USES']);

/** Directory segments that describe layout rather than subject matter. */
const GENERIC_SEGMENT = new Set([
  'src', 'lib', 'libs', 'app', 'apps', 'packages', 'services', 'components', 'pages',
  'routes', 'api', 'index', 'utils', 'util', 'helpers', 'common', 'shared', 'core',
  'internal', 'server', 'client', 'main', 'renderer', 'dist', 'types', 'hooks', 'test', 'tests',
]);

export type ArchitectureMetrics = {
  modules: number;
  domains: number;
  cycles: number;
  stronglyConnectedComponents: number;
  averageFanIn: number;
  averageFanOut: number;
  maxFanIn: number;
  orphanModules: number;
  unresolvedCallRatio: number;
};

export type CouplingRecord = {
  entityId: string;
  name: string;
  path: string | null;
  fanIn: number;
  fanOut: number;
  /** Ce / (Ca + Ce). 0 is maximally depended upon, 1 depends on everything. */
  instability: number;
  centrality: number;
};

export type ArchitectureResult = {
  metrics: ArchitectureMetrics;
  coupling: CouplingRecord[];
  hotspots: CouplingRecord[];
  domains: Array<{ id: string; name: string; memberCount: number; confidence: number; signals: string[] }>;
};

type ModuleGraph = {
  ids: string[];
  index: Map<string, number>;
  out: number[][];
  in: number[][];
  /** Undirected adjacency with weights, for community detection. */
  neighbours: Array<Map<number, number>>;
  degree: number[];
  totalWeight: number;
};

/** Files are the unit of architecture: small enough to cluster, big enough to name. */
function buildModuleGraph(graph: GraphBuilder): ModuleGraph {
  const files = graph.ofType('file').filter((file) => file.metadata.documentation !== true);
  const ids = files.map((file) => file.id);
  const index = new Map(ids.map((id, position) => [id, position]));
  const out: number[][] = ids.map(() => []);
  const incoming: number[][] = ids.map(() => []);
  const neighbours: Array<Map<number, number>> = ids.map(() => new Map());
  const degree = new Array<number>(ids.length).fill(0);
  let totalWeight = 0;

  // Symbol-level edges are lifted to the file that declares the symbol so that
  // one call graph serves both the dependency view and the clustering.
  const fileOfEntity = new Map<string, number>();
  for (const entity of graph.entities) {
    if (!entity.path) continue;
    const position = index.get(stableId('file', entity.path));
    if (position !== undefined) fileOfEntity.set(entity.id, position);
  }

  const seen = new Set<string>();
  for (const edge of graph.relationships) {
    if (!STRUCTURAL.has(edge.type)) continue;
    const from = fileOfEntity.get(edge.source) ?? index.get(edge.source);
    const to = fileOfEntity.get(edge.target) ?? index.get(edge.target);
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}>${to}`;
    if (!seen.has(key)) {
      seen.add(key);
      out[from].push(to);
      incoming[to].push(from);
    }
    neighbours[from].set(to, (neighbours[from].get(to) ?? 0) + 1);
    neighbours[to].set(from, (neighbours[to].get(from) ?? 0) + 1);
    degree[from] += 1;
    degree[to] += 1;
    totalWeight += 1;
  }

  return { ids, index, out, in: incoming, neighbours, degree, totalWeight };
}

/**
 * Tarjan's algorithm, iterative so a deep dependency chain cannot overflow the
 * stack. Returns every component with more than one member: those are the
 * places where everything can reach everything else.
 */
function stronglyConnectedComponents(module: ModuleGraph): number[][] {
  const size = module.ids.length;
  const index = new Array<number>(size).fill(-1);
  const low = new Array<number>(size).fill(0);
  const onStack = new Array<boolean>(size).fill(false);
  const stack: number[] = [];
  const components: number[][] = [];
  let counter = 0;

  for (let start = 0; start < size; start += 1) {
    if (index[start] !== -1) continue;
    const work: Array<{ node: number; edge: number }> = [{ node: start, edge: 0 }];
    while (work.length) {
      const frame = work[work.length - 1];
      const { node } = frame;
      if (frame.edge === 0) {
        index[node] = counter;
        low[node] = counter;
        counter += 1;
        stack.push(node);
        onStack[node] = true;
      }
      let recursed = false;
      while (frame.edge < module.out[node].length) {
        const next = module.out[node][frame.edge];
        frame.edge += 1;
        if (index[next] === -1) {
          work.push({ node: next, edge: 0 });
          recursed = true;
          break;
        }
        if (onStack[next]) low[node] = Math.min(low[node], index[next]);
      }
      if (recursed) continue;
      if (low[node] === index[node]) {
        const component: number[] = [];
        for (;;) {
          const member = stack.pop()!;
          onStack[member] = false;
          component.push(member);
          if (member === node) break;
        }
        if (component.length > 1) components.push(component);
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].node;
        low[parent] = Math.min(low[parent], low[node]);
      }
    }
  }
  return components;
}

/**
 * Modularity-optimising community detection (the Louvain local-moving phase,
 * iterated with aggregation). Clusters propose boundaries; naming and evidence
 * decide what those boundaries actually are.
 */
function detectCommunities(module: ModuleGraph, maxPasses = 8): number[] {
  const size = module.ids.length;
  if (!size || module.totalWeight === 0) return new Array<number>(size).fill(0);

  let community = Array.from({ length: size }, (_, position) => position);
  let nodes = Array.from({ length: size }, (_, position) => [position]);
  let neighbours = module.neighbours;
  let degree = module.degree.slice();
  const twoM = module.totalWeight * 2;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const current = Array.from({ length: neighbours.length }, (_, position) => position);
    const communityDegree = degree.slice();
    let moved = false;

    for (let iteration = 0; iteration < 10; iteration += 1) {
      let changedThisRound = false;
      for (let node = 0; node < neighbours.length; node += 1) {
        const from = current[node];
        communityDegree[from] -= degree[node];
        const weights = new Map<number, number>();
        for (const [neighbour, weight] of neighbours[node]) {
          if (neighbour === node) continue;
          const target = current[neighbour];
          weights.set(target, (weights.get(target) ?? 0) + weight);
        }
        let best = from;
        let bestGain = (weights.get(from) ?? 0) - (communityDegree[from] * degree[node]) / twoM;
        for (const [candidate, weight] of weights) {
          const gain = weight - (communityDegree[candidate] * degree[node]) / twoM;
          if (gain > bestGain + 1e-9) { bestGain = gain; best = candidate; }
        }
        communityDegree[best] += degree[node];
        if (best !== from) { current[node] = best; changedThisRound = true; moved = true; }
      }
      if (!changedThisRound) break;
    }
    if (!moved) break;

    // Aggregate: each community becomes one node for the next pass.
    const labels = new Map<number, number>();
    for (const label of current) if (!labels.has(label)) labels.set(label, labels.size);
    const nextCount = labels.size;
    const nextNodes: number[][] = Array.from({ length: nextCount }, () => []);
    const nextNeighbours: Array<Map<number, number>> = Array.from({ length: nextCount }, () => new Map());
    const nextDegree = new Array<number>(nextCount).fill(0);

    for (let node = 0; node < neighbours.length; node += 1) {
      const label = labels.get(current[node])!;
      nextNodes[label].push(...nodes[node]);
      for (const [neighbour, weight] of neighbours[node]) {
        const otherLabel = labels.get(current[neighbour])!;
        nextNeighbours[label].set(otherLabel, (nextNeighbours[label].get(otherLabel) ?? 0) + weight);
        nextDegree[label] += weight;
      }
    }

    const assignment = new Array<number>(size).fill(0);
    for (let label = 0; label < nextCount; label += 1) {
      for (const original of nextNodes[label]) assignment[original] = label;
    }
    community = assignment;
    nodes = nextNodes;
    neighbours = nextNeighbours;
    degree = nextDegree;
    if (nextCount === neighbours.length && nextCount <= 1) break;
  }
  return community;
}

const titleCase = (value: string): string =>
  value.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (character) => character.toUpperCase()).trim();

/** Split an identifier into words: PaymentService -> [payment, service]. */
function tokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 2 && !GENERIC_SEGMENT.has(part));
}

const NAMING_NOISE = new Set([
  'service', 'controller', 'repository', 'handler', 'manager', 'provider', 'factory',
  'module', 'component', 'page', 'route', 'router', 'model', 'entity', 'schema',
  'client', 'config', 'error', 'type', 'interface', 'const', 'default', 'props', 'state',
  // DOM and interaction vocabulary: describes how a control is wired, never what
  // subject the surrounding code is about.
  'click', 'submit', 'change', 'input', 'keydown', 'keyup', 'blur', 'focus', 'drop',
  'toggle', 'select', 'button', 'form', 'div', 'span', 'element', 'onclick', 'onsubmit',
  'get', 'post', 'put', 'patch', 'delete', 'view', 'create', 'update', 'handle', 'fetch',
  'data', 'value', 'item', 'list', 'name', 'null', 'undefined', 'string', 'number',
  // English filler that survives identifier splitting.
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'not', 'are', 'was', 'has',
  'new', 'set', 'add', 'all', 'any', 'one', 'two', 'use', 'run', 'end', 'top',
]);

/**
 * Name a cluster from several independent signals. Clustering says these files
 * belong together; the directory they share, the models they touch and the
 * routes they serve say what they are.
 */
function nameCommunity(
  graph: GraphBuilder,
  members: CodeEntity[],
): { name: string; signals: string[]; confidence: number } {
  const signals: string[] = [];
  const scores = new Map<string, number>();
  const bump = (candidate: string, weight: number, signal: string) => {
    if (!candidate) return;
    const key = candidate.toLowerCase();
    if (GENERIC_SEGMENT.has(key) || NAMING_NOISE.has(key)) return;
    scores.set(key, (scores.get(key) ?? 0) + weight);
    if (!signals.includes(signal)) signals.push(signal);
  };

  // Directory layout.
  const directoryCounts = new Map<string, number>();
  for (const member of members) {
    if (!member.path) continue;
    for (const segment of member.path.split('/').slice(0, -1)) {
      const key = segment.toLowerCase();
      if (GENERIC_SEGMENT.has(key)) continue;
      directoryCounts.set(key, (directoryCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [segment, count] of directoryCounts) {
    if (count >= Math.max(2, members.length * 0.3)) bump(segment, count * 2, `directory:${segment}`);
  }

  // Data models the cluster touches, and routes it serves.
  const memberIds = new Set(members.map((member) => member.id));
  const modelCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  for (const entity of graph.entities) {
    if (!entity.path) continue;
    if (!memberIds.has(stableId('file', entity.path))) continue;
    for (const edge of graph.outgoingOf(entity.id)) {
      if (edge.type !== 'READS' && edge.type !== 'WRITES') continue;
      const model = graph.entity(edge.target);
      if (model) modelCounts.set(model.name.toLowerCase(), (modelCounts.get(model.name.toLowerCase()) ?? 0) + 1);
    }
    if (entity.type === 'endpoint' || entity.type === 'ui_route') {
      const route = String(entity.metadata.route ?? entity.name);
      const first = route.split('/').filter((part) => part && part !== '{param}')[0];
      if (first) routeCounts.set(first.toLowerCase(), (routeCounts.get(first.toLowerCase()) ?? 0) + 1);
    }
    // UI actions are named after the control and the DOM event, which says
    // nothing about subject matter, so they are excluded from naming signals.
    if (entity.type !== 'ui_action' && entity.type !== 'ui_route' && entity.type !== 'endpoint') {
      for (const token of tokens(entity.name)) bump(token, 0.4, 'naming');
    }
  }
  for (const [model, count] of modelCounts) if (count >= 2) bump(model, count * 1.5, `shared-model:${model}`);
  for (const [route, count] of routeCounts) if (count >= 2) bump(route, count * 1.5, `shared-route:/${route}`);

  const best = [...scores.entries()].sort((left, right) =>
    right[1] - left[1] || (left[0] < right[0] ? -1 : 1))[0];
  if (!best) {
    const fallback = members[0]?.path?.split('/').find((part) => !GENERIC_SEGMENT.has(part.toLowerCase()));
    return { name: titleCase(fallback ?? 'Core'), signals: ['directory'], confidence: CONFIDENCE.directoryHeuristic };
  }

  // Corroboration raises confidence; a single weak signal does not.
  const distinctSignals = new Set(signals.map((signal) => signal.split(':')[0])).size;
  const confidence = distinctSignals >= 3 ? 0.85
    : distinctSignals === 2 ? 0.75
      : CONFIDENCE.directoryHeuristic;
  return { name: titleCase(best[0]), signals: signals.slice(0, 6), confidence };
}

/**
 * Fallback name for a cluster too small to stand on its own: the package that
 * owns most of its files. A declared workspace boundary is a better answer than
 * a two-file community with an invented subject.
 */
function packageDomainName(graph: GraphBuilder, members: CodeEntity[]): string {
  const counts = new Map<string, number>();
  for (const member of members) {
    const root = String(member.metadata.packageRoot ?? '');
    if (!root) continue;
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((left, right) =>
    right[1] - left[1] || (left[0] < right[0] ? -1 : 1))[0];
  if (!best || best[0] === '.') return 'Core';
  const boundary = graph.entities.find((entity) =>
    entity.path === best[0] && ['application', 'service', 'package'].includes(entity.type));
  const raw = boundary?.name ?? best[0];
  // Strip a scope so "@tellann/onboarding-api" reads as "Onboarding Api".
  return titleCase(raw.replace(/^@[^/]+\//, '').replace(/^.*\//, ''));
}

export function analyzeArchitecture(
  graph: GraphBuilder,
  unresolvedCallRatio: number,
): ArchitectureResult {
  const module = buildModuleGraph(graph);
  const size = module.ids.length;

  // ── Domains ────────────────────────────────────────────────────────────────
  const communities = detectCommunities(module);
  const grouped = new Map<number, CodeEntity[]>();
  for (let position = 0; position < size; position += 1) {
    const entity = graph.entity(module.ids[position]);
    if (!entity) continue;
    const bucket = grouped.get(communities[position]);
    if (bucket) bucket.push(entity);
    else grouped.set(communities[position], [entity]);
  }

  // A cluster of two files is not an architectural domain. Small communities are
  // folded into the package that owns them, which is a boundary the repository
  // actually declares, and the total is capped so the architecture view stays
  // readable rather than becoming a second file list.
  const MIN_DOMAIN_MEMBERS = 4;
  const MAX_DOMAINS = 40;
  const ordered = [...grouped.entries()].sort((left, right) => right[1].length - left[1].length);
  const named = new Map<string, CodeEntity[]>();
  for (const [index, [, members]] of ordered.entries()) {
    const small = members.length < MIN_DOMAIN_MEMBERS || index >= MAX_DOMAINS;
    const label = small ? packageDomainName(graph, members) : nameCommunity(graph, members).name;
    const bucket = named.get(label);
    if (bucket) bucket.push(...members);
    else named.set(label, [...members]);
  }

  const domains: ArchitectureResult['domains'] = [];
  for (const [label, members] of [...named.entries()].sort((left, right) => right[1].length - left[1].length)) {
    // The merged membership is re-examined so the recorded signals and
    // confidence describe the domain as it finally stands, not one cluster of it.
    const detail = nameCommunity(graph, members);
    const domainId = stableId('domain', label.toLowerCase());
    graph.addEntity({
      id: domainId,
      type: 'domain',
      name: label,
      path: null,
      startLine: null,
      endLine: null,
      language: null,
      confidence: detail.confidence,
      metadata: { signals: detail.signals, memberCount: members.length, method: 'louvain+semantic' },
      evidence: [],
    });
    domains.push({
      id: domainId,
      name: label,
      memberCount: members.length,
      confidence: detail.confidence,
      signals: detail.signals,
    });

    for (const member of members) {
      graph.addEdge({
        source: member.id,
        target: domainId,
        type: 'BELONGS_TO_DOMAIN',
        confidence: detail.confidence,
        evidence: [],
      });
    }
  }

  // Symbols inherit the domain of the file that declares them.
  const domainByFile = new Map<string, string>();
  for (const edge of graph.edgesOfType('BELONGS_TO_DOMAIN')) domainByFile.set(edge.source, edge.target);
  for (const entity of graph.entities) {
    if (!entity.path || entity.type === 'file' || entity.type === 'domain') continue;
    const domainId = domainByFile.get(stableId('file', entity.path));
    if (!domainId) continue;
    graph.addEdge({
      source: entity.id,
      target: domainId,
      type: 'BELONGS_TO_DOMAIN',
      confidence: CONFIDENCE.directoryHeuristic,
      evidence: [],
    });
  }

  // ── Cycles and strongly connected components ───────────────────────────────
  const components = stronglyConnectedComponents(module);
  for (const component of components.slice(0, 100)) {
    const members = component.map((position) => graph.entity(module.ids[position])).filter(Boolean) as CodeEntity[];
    const finding: CodebaseFinding = {
      id: stableId('finding', `scc:${component.slice().sort((a, b) => a - b).join(',')}`),
      kind: 'CYCLE',
      severity: component.length > 6 ? 'HIGH' : 'WARNING',
      title: `Circular dependency across ${component.length} modules`,
      description: `${members.slice(0, 6).map((member) => member.path ?? member.name).join(' -> ')}${component.length > 6 ? ' -> …' : ''}. Every module in this group can reach every other, so they cannot be changed or tested independently.`,
      entityIds: members.map((member) => member.id).slice(0, 30),
      evidence: [],
    };
    graph.finding(finding);
  }

  // ── Coupling and centrality ────────────────────────────────────────────────
  const coupling: CouplingRecord[] = [];
  let fanInTotal = 0;
  let fanOutTotal = 0;
  let maxFanIn = 0;
  let orphanModules = 0;

  const centrality = degreeCentrality(module);
  for (let position = 0; position < size; position += 1) {
    const entity = graph.entity(module.ids[position]);
    if (!entity) continue;
    const fanIn = module.in[position].length;
    const fanOut = module.out[position].length;
    fanInTotal += fanIn;
    fanOutTotal += fanOut;
    maxFanIn = Math.max(maxFanIn, fanIn);
    if (fanIn === 0 && fanOut === 0) orphanModules += 1;
    coupling.push({
      entityId: entity.id,
      name: entity.name,
      path: entity.path,
      fanIn,
      fanOut,
      instability: fanIn + fanOut === 0 ? 0 : Number((fanOut / (fanIn + fanOut)).toFixed(3)),
      centrality: Number(centrality[position].toFixed(5)),
    });
  }
  coupling.sort((left, right) => right.centrality - left.centrality || right.fanIn - left.fanIn);

  // A hotspot is depended upon widely and depends widely itself: changing it is
  // expensive and it is hard to change safely.
  const hotspots = coupling
    .filter((record) => record.fanIn >= 5 && record.fanOut >= 5)
    .slice(0, 25);
  for (const hotspot of hotspots.slice(0, 10)) {
    graph.finding({
      id: stableId('finding', `coupling:${hotspot.entityId}`),
      kind: 'COUPLING',
      severity: hotspot.fanIn >= 20 ? 'HIGH' : 'WARNING',
      title: `Highly coupled module: ${hotspot.name}`,
      description: `${hotspot.path ?? hotspot.name} is depended on by ${hotspot.fanIn} module(s) and depends on ${hotspot.fanOut}. Changes here have a wide blast radius.`,
      entityIds: [hotspot.entityId],
      evidence: [],
    });
  }

  // Modules nothing reaches and that are not themselves entrypoints.
  const entrypointFiles = new Set<string>();
  for (const type of ['endpoint', 'ui_route', 'ui_action', 'job'] as const) {
    for (const entity of graph.ofType(type)) if (entity.path) entrypointFiles.add(stableId('file', entity.path));
  }
  const unreachable = coupling.filter((record) =>
    record.fanIn === 0 && record.fanOut > 0 && !entrypointFiles.has(record.entityId));
  if (unreachable.length) {
    graph.finding({
      id: stableId('finding', `orphans:${unreachable.length}`),
      kind: 'UNRESOLVED_REFERENCE',
      severity: 'INFO',
      title: `${unreachable.length} module(s) are never imported`,
      description: `These modules import others but nothing imports them, and they are not entrypoints. They may be dead code, or reached only through a dynamic mechanism static analysis cannot see: ${unreachable.slice(0, 5).map((item) => item.path).join(', ')}${unreachable.length > 5 ? '…' : ''}.`,
      entityIds: unreachable.slice(0, 30).map((item) => item.entityId),
      evidence: [],
    });
  }

  if (unresolvedCallRatio > 0.35) {
    graph.finding({
      id: stableId('finding', 'dynamic-code'),
      kind: 'DYNAMIC_CODE',
      severity: 'WARNING',
      title: 'A large share of call sites could not be resolved',
      description: `${Math.round(unresolvedCallRatio * 100)}% of call expressions did not resolve to a declaration. That usually means dynamic dispatch, runtime dependency injection, or calls into dependencies whose types were not loaded. Paths through those calls are missing from the graph.`,
      entityIds: [],
      evidence: [],
    });
  }

  return {
    metrics: {
      modules: size,
      domains: domains.length,
      cycles: components.length,
      stronglyConnectedComponents: components.length,
      averageFanIn: size ? Number((fanInTotal / size).toFixed(2)) : 0,
      averageFanOut: size ? Number((fanOutTotal / size).toFixed(2)) : 0,
      maxFanIn,
      orphanModules,
      unresolvedCallRatio: Number(unresolvedCallRatio.toFixed(3)),
    },
    coupling: coupling.slice(0, 300),
    hotspots,
    domains,
  };
}

function degreeCentrality(module: ModuleGraph): number[] {
  const size = module.ids.length;
  if (!size) return [];
  // Normalised weighted degree: cheap, stable, and adequate for ranking which
  // modules sit at the centre of the dependency structure.
  const maximum = Math.max(1, ...module.degree);
  return module.degree.map((value) => value / maximum);
}

export type BlastRadius = {
  entityId: string;
  affected: { modules: number; functions: number; endpoints: number; jobs: number; tests: number; features: number };
  entityIds: string[];
  truncated: boolean;
};

/**
 * What could break if this changes. Walks incoming dependency edges, so the
 * answer is "everything that reaches this", not "everything this reaches".
 */
export function blastRadius(graph: GraphBuilder, entityId: string, maxDepth = 8, maxNodes = 2_000): BlastRadius {
  const visited = new Set<string>([entityId]);
  let frontier = [entityId];
  let truncated = false;
  let depth = 0;

  while (frontier.length && depth < maxDepth) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.incomingOf(id)) {
        if (!STRUCTURAL.has(edge.type) && edge.type !== 'ROUTES_TO' && edge.type !== 'TESTS' && edge.type !== 'IMPLEMENTS_FEATURE') continue;
        if (visited.has(edge.source)) continue;
        if (visited.size >= maxNodes) { truncated = true; break; }
        visited.add(edge.source);
        next.push(edge.source);
      }
      if (truncated) break;
    }
    frontier = next;
    depth += 1;
  }
  visited.delete(entityId);

  const affected = { modules: 0, functions: 0, endpoints: 0, jobs: 0, tests: 0, features: 0 };
  for (const id of visited) {
    const entity = graph.entity(id);
    if (!entity) continue;
    if (entity.type === 'file') affected.modules += 1;
    else if (entity.type === 'function' || entity.type === 'method') affected.functions += 1;
    else if (entity.type === 'endpoint' || entity.type === 'ui_route' || entity.type === 'ui_action') affected.endpoints += 1;
    else if (entity.type === 'job' || entity.type === 'queue') affected.jobs += 1;
    else if (entity.type === 'test') affected.tests += 1;
    else if (entity.type === 'feature') affected.features += 1;
  }

  return { entityId, affected, entityIds: [...visited].slice(0, 500), truncated };
}
