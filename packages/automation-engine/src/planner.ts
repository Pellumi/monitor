import { patternSpecificity, routeMatches } from './keys';
import { evaluateAction } from './policy';
import type { PolicyOptions } from './policy';
import type { ActionClass, ControlDescriptor, EnvironmentKind, FormInput } from './types';

/**
 * Path planning over the application's navigation graph.
 *
 * Nodes are routes; edges are the ways the code says one route leads to another
 * (a link, a router push, a redirect, a form submit). The planner finds the
 * cheapest way to a target route, where "cheap" is not distance: an edge is costly
 * when we are unsure it exists, when taking it mutates the server, or when it is
 * behind a guard the persona may not satisfy.
 *
 * The plan is a hypothesis. The executor re-recognises the state after every action
 * and replans when reality differs, so a wrong edge costs a replan, not a wrong run.
 */

export type NavigationKind = 'LINK' | 'NAVIGATE' | 'CLICK' | 'FORM_SUBMIT' | 'REDIRECT';

export interface EdgeGuard {
  requiresAuth: boolean;
  /** Any one of these roles satisfies the guard. Empty means any authenticated user. */
  roles: string[];
  /** How sure the extractor is that this is a real guard. Low-confidence guards cost, they do not block. */
  confidence: number;
}

export interface NavigationEdge {
  id: string;
  from: string;
  to: string;
  kind: NavigationKind;
  actionClass: ActionClass;
  /** 0..1: how sure the extractor is that this navigation exists. */
  confidence: number;
  control: ControlDescriptor | null;
  guard: EdgeGuard | null;
  /**
   * Present only on the edge that submits a login form. Its `dataKey`s are matched against the
   * persona's credentials (by field name), not the run data set — the entry sequence is the only
   * caller that fills a `login` edge, and it fills every other edge with no inputs at all.
   */
  login?: FormInput[];
  /** Where in the source it came from, carried through to reports. */
  evidence: { file: string; symbol: string | null; line: number | null };
}

export interface NavigationGraph {
  /** Canonical route patterns. */
  nodes: string[];
  edges: NavigationEdge[];
}

export interface Persona {
  authenticated: boolean;
  roles: string[];
}

export interface PlanInput {
  graph: NavigationGraph;
  fromPath: string;
  toRoute: string;
  persona: Persona;
  environment: EnvironmentKind;
  policy?: PolicyOptions;
}

export type PlanFailure =
  /** No route from here to the target exists in the graph. */
  | { kind: 'NO_PATH' }
  /** A path exists but every one is blocked by the persona's roles. */
  | { kind: 'BLOCKED_BY_GUARD'; blockedBy: NavigationEdge[] }
  /** A path exists but every one needs an action the policy forbids. */
  | { kind: 'BLOCKED_BY_POLICY'; blockedBy: NavigationEdge[] }
  | { kind: 'UNKNOWN_START' }
  | { kind: 'UNKNOWN_TARGET' };

export type PlanResult =
  | { ok: true; steps: NavigationEdge[]; cost: number }
  | { ok: false; failure: PlanFailure };

const MUTATION_COST: Record<ActionClass, number> = {
  READ: 0,
  CLIENT_STATE_MUTATION: 0.5,
  SERVER_MUTATION: 3,
  EXTERNAL_SIDE_EFFECT: 8,
  DESTRUCTIVE: 20,
};

export function edgeCost(edge: NavigationEdge): number {
  const action = 1;
  const uncertainty = (1 - clamp01(edge.confidence)) * 4;
  // A guard we are not sure about is a reason to prefer another route, not a wall.
  const guardDoubt = edge.guard ? (1 - clamp01(edge.guard.confidence)) * 2 : 0;
  return action + uncertainty + MUTATION_COST[edge.actionClass] + guardDoubt;
}

/** The graph node a concrete path belongs to: the most specific matching pattern. */
export function nodeForPath(graph: NavigationGraph, path: string): string | null {
  const matches = graph.nodes.filter((node) => routeMatches(node, path));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => patternSpecificity(b) - patternSpecificity(a))[0];
}

export function planPath(input: PlanInput): PlanResult {
  const start = nodeForPath(input.graph, input.fromPath);
  if (!start) return { ok: false, failure: { kind: 'UNKNOWN_START' } };
  const target = input.graph.nodes.find((node) => node === input.toRoute)
    ?? nodeForPath(input.graph, input.toRoute);
  if (!target) return { ok: false, failure: { kind: 'UNKNOWN_TARGET' } };

  const guardBlocked = (edge: NavigationEdge) => !guardSatisfied(edge, input.persona);
  const policyBlocked = (edge: NavigationEdge) => !evaluateAction(edge.actionClass, input.environment, input.policy).allowed;

  const allowed = shortest(input.graph, start, target, (edge) => !guardBlocked(edge) && !policyBlocked(edge));
  if (allowed) return { ok: true, ...allowed };

  // Nothing is passable. Work out *why*, because "no route" and "the persona is not allowed on the
  // route" are different stop reasons and different findings.
  const ignoringGuards = shortest(input.graph, start, target, (edge) => !policyBlocked(edge));
  if (ignoringGuards) {
    return { ok: false, failure: { kind: 'BLOCKED_BY_GUARD', blockedBy: ignoringGuards.steps.filter(guardBlocked) } };
  }
  const ignoringPolicy = shortest(input.graph, start, target, (edge) => !guardBlocked(edge));
  if (ignoringPolicy) {
    return { ok: false, failure: { kind: 'BLOCKED_BY_POLICY', blockedBy: ignoringPolicy.steps.filter(policyBlocked) } };
  }
  const unconstrained = shortest(input.graph, start, target, () => true);
  if (unconstrained) {
    return { ok: false, failure: { kind: 'BLOCKED_BY_GUARD', blockedBy: unconstrained.steps.filter((edge) => guardBlocked(edge) || policyBlocked(edge)) } };
  }
  return { ok: false, failure: { kind: 'NO_PATH' } };
}

export function guardSatisfied(edge: NavigationEdge, persona: Persona): boolean {
  const guard = edge.guard;
  if (!guard) return true;
  // A low-confidence guard is a guess about the source; it must not veto a route.
  if (guard.confidence < 0.5) return true;
  if (guard.requiresAuth && !persona.authenticated) return false;
  if (guard.roles.length === 0) return true;
  return guard.roles.some((role) => persona.roles.map((r) => r.toLowerCase()).includes(role.toLowerCase()));
}

function shortest(
  graph: NavigationGraph,
  start: string,
  target: string,
  passable: (edge: NavigationEdge) => boolean,
): { steps: NavigationEdge[]; cost: number } | null {
  if (start === target) return { steps: [], cost: 0 };
  const dist = new Map<string, number>([[start, 0]]);
  const via = new Map<string, NavigationEdge>();
  const done = new Set<string>();
  const outgoing = new Map<string, NavigationEdge[]>();
  for (const edge of graph.edges) {
    if (!passable(edge)) continue;
    const list = outgoing.get(edge.from);
    if (list) list.push(edge);
    else outgoing.set(edge.from, [edge]);
  }
  // Navigation graphs are small (tens to low hundreds of routes); a linear scan beats a heap's bookkeeping.
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!done.has(node) && d < best) { best = d; current = node; }
    }
    if (current === null) return null;
    if (current === target) break;
    done.add(current);
    for (const edge of outgoing.get(current) ?? []) {
      const next = best + edgeCost(edge);
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        via.set(edge.to, edge);
      }
    }
  }
  const steps: NavigationEdge[] = [];
  for (let node = target; node !== start;) {
    const edge = via.get(node);
    if (!edge) return null;
    steps.unshift(edge);
    node = edge.from;
  }
  return { steps, cost: dist.get(target) ?? 0 };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
