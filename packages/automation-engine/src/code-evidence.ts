import { createHash } from 'node:crypto';
import { routeMatches } from './keys';
import type { CodeRef, DerivationStatus, ExecutableContract, ExecutableState, ExecutableTransition } from './types';

/**
 * Code evidence for a failed transition or an unreadable state.
 *
 * When a run falls short, "the control was not found" or "the action did not advance" leaves the
 * obvious next question: what does the code say happens here? The answer is already on the machine
 * (the Flow's mapping to code, the handler's calls, the guards on the destination route), so it is
 * pulled up locally at the moment of failure and reduced to a summary.
 *
 * The summary is what travels. Source text stays on the machine (invariant 8): the record carries
 * file, symbol, line range and a *hash* of the source range — enough for a person to open the file,
 * and to tell later whether it has changed — and never the code itself. Everything here is
 * deterministic; no model writes it.
 */

/** The parts of a code-analysis entity this module reads (structurally compatible with desktop-contracts' `CodeEntity`). */
export interface CodeEntityView {
  id: string;
  type: string;
  name: string;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  metadata: Record<string, unknown>;
}

export interface CodeRelationshipView {
  source: string;
  target: string;
  type: string;
}

export interface CodeGraphView {
  entities: CodeEntityView[];
  relationships: CodeRelationshipView[];
}

export interface CodeEvidenceGuard {
  kind: string;
  name: string;
  file: string | null;
  requiresAuth: boolean;
  roles: string[];
  /** The route (pattern) it protects. */
  route: string;
}

export interface CodeEvidenceRef {
  file: string;
  symbol: string | null;
  entityId: string | null;
  startLine: number | null;
  endLine: number | null;
  /** sha256 of the referenced lines, or null when the source was unavailable. The source itself is never included. */
  excerptSha256: string | null;
}

export interface CodeEvidence {
  subject: { kind: 'TRANSITION' | 'STATE'; id: string };
  derivation: DerivationStatus;
  refs: CodeEvidenceRef[];
  /** Endpoints the handler is known to call (`CALLS`), by name. */
  calls: string[];
  /** Routes the handler navigates to. */
  navigatesTo: string[];
  guards: CodeEvidenceGuard[];
  /** Endpoints the contract expects the step to hit. */
  expectedApi: Array<{ method: string; route: string }>;
  summary: string;
}

export interface CodeEvidenceSource {
  graph: CodeGraphView;
  /** The text of a workspace file, or null when it cannot be read. Used only to hash a range. */
  readSource?(file: string): string | null;
}

const asString = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

function excerptHash(source: CodeEvidenceSource, file: string, start: number | null, end: number | null): string | null {
  const text = source.readSource?.(file);
  if (text == null) return null;
  const lines = text.split(/\r?\n/);
  const from = Math.max(1, start ?? 1);
  const to = Math.min(lines.length, end ?? start ?? lines.length);
  if (from > lines.length || to < from) return null;
  return createHash('sha256').update(lines.slice(from - 1, to).join('\n')).digest('hex');
}

class Index {
  readonly byId = new Map<string, CodeEntityView>();
  readonly outgoing = new Map<string, CodeRelationshipView[]>();
  readonly routes: CodeEntityView[];

  constructor(graph: CodeGraphView) {
    for (const entity of graph.entities) this.byId.set(entity.id, entity);
    for (const relationship of graph.relationships) {
      const list = this.outgoing.get(relationship.source) ?? [];
      list.push(relationship);
      this.outgoing.set(relationship.source, list);
    }
    this.routes = graph.entities.filter((entity) => entity.type === 'ui_route');
  }

  targets(id: string, type: string): CodeEntityView[] {
    return (this.outgoing.get(id) ?? [])
      .filter((edge) => edge.type === type)
      .map((edge) => this.byId.get(edge.target))
      .filter((entity): entity is CodeEntityView => entity !== undefined);
  }
}

function guardsForRoutes(index: Index, patterns: string[]): CodeEvidenceGuard[] {
  const found = new Map<string, CodeEvidenceGuard>();
  for (const route of index.routes) {
    const routePattern = asString(route.metadata.route);
    if (!routePattern || !patterns.some((pattern) => routeMatches(pattern, routePattern) || routeMatches(routePattern, pattern))) continue;
    for (const guard of index.targets(route.id, 'GUARDED_BY')) {
      found.set(`${guard.id}|${routePattern}`, {
        kind: asString(guard.metadata.source) ?? 'guard',
        name: guard.name,
        file: guard.path,
        requiresAuth: guard.metadata.requiresAuth === true,
        roles: asStrings(guard.metadata.roles),
        route: routePattern,
      });
    }
  }
  return [...found.values()];
}

function refsFor(index: Index, source: CodeEvidenceSource, refs: CodeRef[]): CodeEvidenceRef[] {
  return refs.map((ref) => {
    const entity = ref.entityId ? index.byId.get(ref.entityId) : undefined;
    const startLine = entity?.startLine ?? null;
    const endLine = entity?.endLine ?? null;
    return {
      file: ref.file,
      symbol: ref.symbol,
      entityId: ref.entityId,
      startLine,
      endLine,
      excerptSha256: excerptHash(source, ref.file, startLine, endLine),
    };
  });
}

function describeGuards(guards: CodeEvidenceGuard[]): string {
  return guards.map((guard) => {
    const who = guard.roles.length > 0 ? `roles ${guard.roles.join(', ')}` : guard.requiresAuth ? 'a signed-in user' : 'a condition';
    return `${guard.route} requires ${who} (${guard.kind}${guard.file ? `, ${guard.file}` : ''})`;
  }).join('; ');
}

function cite(ref: CodeEvidenceRef): string {
  const where = ref.startLine ? `${ref.file}:${ref.startLine}${ref.endLine && ref.endLine !== ref.startLine ? `-${ref.endLine}` : ''}` : ref.file;
  return ref.symbol ? `${ref.symbol} (${where})` : where;
}

function summarize(kind: 'TRANSITION' | 'STATE', label: string, evidence: Omit<CodeEvidence, 'summary'>): string {
  const parts: string[] = [];
  if (evidence.refs.length === 0) {
    parts.push(`No code is mapped to ${label}, so there is nothing to compare the run against.`);
  } else {
    parts.push(`${label} is mapped to ${evidence.refs.map(cite).join(' and ')}.`);
  }
  if (evidence.derivation !== 'RESOLVED') parts.push(`That mapping is ${evidence.derivation.toLowerCase()}, so treat it as a lead rather than a fact.`);
  if (evidence.calls.length > 0) parts.push(`The handler calls ${evidence.calls.join(', ')}.`);
  if (evidence.navigatesTo.length > 0) parts.push(`It navigates to ${evidence.navigatesTo.join(', ')}.`);
  if (evidence.guards.length > 0) parts.push(`Guards: ${describeGuards(evidence.guards)}.`);
  else if (kind === 'TRANSITION' && evidence.refs.length > 0) parts.push('No route guard was found on the destination.');
  return parts.join(' ');
}

/** What the code says about one transition of the contract: its handler, what that calls, and who may reach the destination. */
export function expandTransitionEvidence(contract: ExecutableContract, transition: ExecutableTransition, source: CodeEvidenceSource): CodeEvidence {
  const index = new Index(source.graph);
  const refs = refsFor(index, source, transition.codeRefs);
  const calls = new Set<string>();
  const navigatesTo = new Set<string>();
  for (const ref of transition.codeRefs) {
    if (!ref.entityId) continue;
    // The handler and the control that triggers it can both carry the call, so read both sides.
    const ids = [ref.entityId, ...[...index.byId.values()]
      .filter((entity) => (index.outgoing.get(entity.id) ?? []).some((edge) => edge.type === 'ROUTES_TO' && edge.target === ref.entityId))
      .map((entity) => entity.id)];
    for (const id of ids) {
      for (const target of index.targets(id, 'CALLS')) calls.add(target.name);
      for (const edge of index.outgoing.get(id) ?? []) {
        if (edge.type !== 'NAVIGATES_TO') continue;
        const action = index.byId.get(id);
        const destination = asString(action?.metadata.destination) ?? index.byId.get(edge.target)?.name;
        if (destination) navigatesTo.add(destination);
      }
    }
  }
  const destination = contract.states.find((state) => state.key === transition.to);
  const guards = guardsForRoutes(index, destination?.routePatterns ?? []);
  const base = {
    subject: { kind: 'TRANSITION' as const, id: transition.id },
    derivation: transition.derivation,
    refs,
    calls: [...calls].sort(),
    navigatesTo: [...navigatesTo].sort(),
    guards,
    expectedApi: transition.expectedApi.map((api) => ({ method: api.method, route: api.route })),
  };
  return { ...base, summary: summarize('TRANSITION', transition.action ? `"${transition.action}"` : `the ${transition.from} to ${transition.to} transition`, base) };
}

/** What the code says about one state: where it is implemented and who may reach it. */
export function expandStateEvidence(state: ExecutableState, source: CodeEvidenceSource): CodeEvidence {
  const index = new Index(source.graph);
  const base = {
    subject: { kind: 'STATE' as const, id: state.key },
    derivation: state.derivation,
    refs: refsFor(index, source, state.codeRefs),
    calls: [] as string[],
    navigatesTo: [] as string[],
    guards: guardsForRoutes(index, state.routePatterns),
    expectedApi: state.expectedApi.map((api) => ({ method: api.method, route: api.route })),
  };
  return { ...base, summary: summarize('STATE', `the ${state.name || state.key} state`, base) };
}

/**
 * Evidence for whatever a capture decision was about. A failed transition is expanded when one is
 * named; otherwise the state the run was in. Returns null when neither exists in the contract.
 */
export function expandForFailure(
  contract: ExecutableContract,
  subject: { transitionId?: string | null; stateKey?: string | null },
  source: CodeEvidenceSource,
): CodeEvidence | null {
  const transition = subject.transitionId ? contract.transitions.find((candidate) => candidate.id === subject.transitionId) : undefined;
  if (transition) return expandTransitionEvidence(contract, transition, source);
  const state = subject.stateKey ? contract.states.find((candidate) => candidate.key === subject.stateKey) : undefined;
  return state ? expandStateEvidence(state, source) : null;
}
