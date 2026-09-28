import { evaluateAction } from './policy';
import type { PolicyOptions } from './policy';
import type { ActionClass, EnvironmentKind, ExecutableContract, ExecutableTransition } from './types';

/**
 * The route through the *declared* Flow from where the run is to the target terminal state.
 *
 * Distinct from the navigation planner: that finds a way across the application's routes
 * to reach the Flow's initial state; this picks which declared transitions to perform once in
 * it. A Flow can branch, so there may be several ways to the target; the cheapest wins, where
 * cost prefers transitions whose control we could actually derive and which do the least damage.
 */

const CLASS_COST: Record<ActionClass, number> = {
  READ: 1,
  CLIENT_STATE_MUTATION: 1.5,
  SERVER_MUTATION: 3,
  EXTERNAL_SIDE_EFFECT: 8,
  DESTRUCTIVE: 20,
};

export function transitionCost(transition: ExecutableTransition): number {
  const derivation = transition.derivation === 'RESOLVED' ? 0
    : transition.derivation === 'AMBIGUOUS' ? 2
      : 6; // Unresolved: no control to act on. Prefer any alternative, but keep it planned so the failure is reported precisely.
  return CLASS_COST[transition.actionClass] + derivation;
}

export type FlowPathResult =
  | { ok: true; transitions: ExecutableTransition[]; cost: number }
  | { ok: false; reason: 'UNKNOWN_STATE' | 'UNREACHABLE' | 'BLOCKED_BY_POLICY'; blockedBy: ExecutableTransition[] };

export function planFlowPath(
  contract: ExecutableContract,
  fromKey: string,
  targetKey: string,
  environment: EnvironmentKind,
  policy?: PolicyOptions,
): FlowPathResult {
  const known = new Set(contract.states.map((state) => state.key));
  if (!known.has(fromKey) || !known.has(targetKey)) return { ok: false, reason: 'UNKNOWN_STATE', blockedBy: [] };
  if (fromKey === targetKey) return { ok: true, transitions: [], cost: 0 };

  const permitted = (transition: ExecutableTransition) => evaluateAction(transition.actionClass, environment, policy).allowed;
  const found = dijkstra(contract, fromKey, targetKey, permitted);
  if (found) return { ok: true, ...found };

  const ignoringPolicy = dijkstra(contract, fromKey, targetKey, () => true);
  if (ignoringPolicy) {
    return { ok: false, reason: 'BLOCKED_BY_POLICY', blockedBy: ignoringPolicy.transitions.filter((transition) => !permitted(transition)) };
  }
  return { ok: false, reason: 'UNREACHABLE', blockedBy: [] };
}

function dijkstra(
  contract: ExecutableContract,
  from: string,
  target: string,
  passable: (transition: ExecutableTransition) => boolean,
): { transitions: ExecutableTransition[]; cost: number } | null {
  const outgoing = new Map<string, ExecutableTransition[]>();
  for (const transition of contract.transitions) {
    if (!passable(transition)) continue;
    const list = outgoing.get(transition.from);
    if (list) list.push(transition);
    else outgoing.set(transition.from, [transition]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const via = new Map<string, ExecutableTransition>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) if (!done.has(node) && d < best) { best = d; current = node; }
    if (current === null) return null;
    if (current === target) break;
    done.add(current);
    for (const transition of outgoing.get(current) ?? []) {
      const next = best + transitionCost(transition);
      if (next < (dist.get(transition.to) ?? Infinity)) {
        dist.set(transition.to, next);
        via.set(transition.to, transition);
      }
    }
  }
  const transitions: ExecutableTransition[] = [];
  for (let node = target; node !== from;) {
    const transition = via.get(node);
    if (!transition) return null;
    transitions.unshift(transition);
    node = transition.from;
  }
  return { transitions, cost: dist.get(target) ?? 0 };
}
