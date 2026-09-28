import { planFlowPath } from './flow-path';
import type { PolicyOptions } from './policy';
import type { EnvironmentKind, ExecutableContract, ExecutableTransition } from './types';

/**
 * EXPERIMENTAL — a design spike, not a feature. Deliberately not exported from the package index.
 *
 * The question it answers: if an Automated Run were pointed at *every* way a Flow can end, rather than
 * one, how many separate runs would it take, and which declared steps could never be exercised at all?
 * Knowing that is what lets the multi-path design (docs/app/automated-run-multi-path-design.md) say
 * something concrete about cost, and about how much of a Flow is even testable from its declaration.
 *
 * It is a pure function of the contract. It picks no data, runs nothing, and decides nothing about
 * what a path *means* — a failed branch is still evidence, not a verdict. Nothing in the executor
 * calls it, and a run still goes to exactly one target (`AUTOMATION_MAX_TARGETS`).
 */

export interface CoveringPath {
  /** Transition ids in the order they would be performed, starting at the initial state. */
  transitions: string[];
  /** The state the path ends in. */
  endsAt: string;
  /** How the Flow declares that state: a way to succeed, a way to fail, or unspecified. */
  endsAs: 'SUCCESS' | 'FAILURE' | 'OTHER';
  /** Transitions this path is the first to exercise. */
  newlyCovered: string[];
}

export type UncoveredReason =
  /** No permitted route from the initial state reaches where it starts. */
  | 'UNREACHABLE'
  /** Reachable, but only through actions the environment's policy does not allow. */
  | 'BLOCKED_BY_POLICY'
  /** The code gave no control for it, so it can be planned but never performed. */
  | 'NO_DERIVED_CONTROL';

export interface PathCoverage {
  paths: CoveringPath[];
  uncovered: Array<{ transitionId: string; reason: UncoveredReason }>;
  /** Share of declared transitions the paths exercise. */
  coverage: number;
}

const kindOf = (contract: ExecutableContract, stateKey: string): CoveringPath['endsAs'] => {
  const state = contract.states.find((candidate) => candidate.key === stateKey);
  const kind = state?.terminalKind?.toUpperCase() ?? null;
  if (kind === 'SUCCESS') return 'SUCCESS';
  if (kind === 'FAILURE' || kind === 'ERROR') return 'FAILURE';
  return 'OTHER';
};

/**
 * A small set of end-to-end paths that together exercise every transition that can be exercised.
 * Greedy and deterministic: each path takes the shortest permitted route to the first still-unexercised
 * transition, performs it, then takes the shortest route to a terminal state.
 */
export function coveringPaths(
  contract: ExecutableContract,
  options: { environment?: EnvironmentKind; policy?: PolicyOptions; maxPaths?: number } = {},
): PathCoverage {
  const environment = options.environment ?? 'STAGING';
  const maxPaths = options.maxPaths ?? 25;
  const covered = new Set<string>();
  const uncovered = new Map<string, UncoveredReason>();
  const paths: CoveringPath[] = [];
  const terminals = contract.states.filter((state) => state.role === 'TERMINAL').map((state) => state.key);
  const byId = new Map(contract.transitions.map((transition) => [transition.id, transition]));

  // A transition with no derived control can be planned but never performed, so a path may not rely on one.
  const performable: ExecutableContract = { ...contract, transitions: contract.transitions.filter((transition) => transition.control) };
  const route = (from: string, to: string) => planFlowPath(performable, from, to, environment, options.policy);

  const shortestToTerminal = (from: string): ExecutableTransition[] | null => {
    if (terminals.includes(from)) return [];
    let best: ExecutableTransition[] | null = null;
    for (const terminal of terminals) {
      const found = route(from, terminal);
      if (found.ok && (best === null || found.transitions.length < best.length)) best = found.transitions;
    }
    return best;
  };

  for (const transition of contract.transitions) {
    if (covered.has(transition.id) || uncovered.has(transition.id)) continue;
    if (!transition.control) { uncovered.set(transition.id, 'NO_DERIVED_CONTROL'); continue; }
    const prefix = route(contract.initialStateKey, transition.from);
    if (!prefix.ok) { uncovered.set(transition.id, prefix.reason === 'BLOCKED_BY_POLICY' ? 'BLOCKED_BY_POLICY' : 'UNREACHABLE'); continue; }
    if (paths.length >= maxPaths) break;

    const suffix = shortestToTerminal(transition.to) ?? [];
    const steps = [...prefix.transitions, transition, ...suffix];
    const newly = [...new Set(steps.map((step) => step.id))].filter((id) => !covered.has(id));
    for (const id of newly) covered.add(id);
    const endsAt = steps[steps.length - 1]!.to;
    paths.push({ transitions: steps.map((step) => step.id), endsAt, endsAs: kindOf(contract, endsAt), newlyCovered: newly });
  }

  // A transition can be exercised on the way to another; only those still unaccounted for are uncovered.
  for (const id of [...uncovered.keys()]) if (covered.has(id)) uncovered.delete(id);
  const total = contract.transitions.length;
  return {
    paths,
    uncovered: [...uncovered.entries()].map(([transitionId, reason]) => ({ transitionId, reason })),
    coverage: total === 0 ? 0 : Math.round((covered.size / total) * 1000) / 1000,
  };
}

/** Every declared way for the Flow to end, by kind. The list a multi-target run would be chosen from. */
export function declaredEndings(contract: ExecutableContract): Array<{ stateKey: string; endsAs: CoveringPath['endsAs'] }> {
  return contract.states
    .filter((state) => state.role === 'TERMINAL')
    .map((state) => ({ stateKey: state.key, endsAs: kindOf(contract, state.key) }));
}
