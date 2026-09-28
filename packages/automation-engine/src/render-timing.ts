import type { CodeRef, ExecutableContract } from './types';

/**
 * Which components are worth timing.
 *
 * Render timing is opt-in and deliberately narrow. Timing every component in an application is
 * noise, costs the page something on every commit, and says nothing about the Flow. What a Flow
 * report can use is the cost of the components the Flow *itself* maps to: the ones its states and
 * transitions were derived from. Those are the only candidates, and there is a hard cap.
 *
 * This only chooses names. Nothing is added to the application's source; measurement is done in the
 * managed browser (see `@tellann/browser-observer`'s render timing) and only for names on this list.
 */

/** A component name, by React convention: capitalised. Lowercase symbols are helpers, handlers and routes. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9_$]*$/;
export const MAX_RENDER_TIMING_COMPONENTS = 8;

export interface RenderTimingTargets {
  /** Names to time, in a stable order, at most `MAX_RENDER_TIMING_COMPONENTS`. */
  components: string[];
  /** Which of them each state maps to, so a report can read the timings state by state. */
  byState: Record<string, string[]>;
  /** Candidates left out because of the cap. */
  omitted: string[];
}

const symbolsOf = (refs: CodeRef[]): string[] =>
  refs.flatMap((ref) => (ref.symbol && COMPONENT_NAME.test(ref.symbol) ? [ref.symbol] : []));

export function selectRenderTimingTargets(contract: ExecutableContract, max = MAX_RENDER_TIMING_COMPONENTS): RenderTimingTargets {
  const limit = Math.max(0, Math.min(max, MAX_RENDER_TIMING_COMPONENTS));
  const byState: Record<string, string[]> = {};
  const ordered: string[] = [];
  const consider = (stateKey: string, names: string[]) => {
    for (const name of names) {
      if (!ordered.includes(name)) ordered.push(name);
      (byState[stateKey] ??= []);
      if (!byState[stateKey]!.includes(name)) byState[stateKey]!.push(name);
    }
  };

  for (const state of contract.states) consider(state.key, symbolsOf(state.codeRefs));
  // A transition's handler renders in the state it leaves.
  for (const transition of contract.transitions) consider(transition.from, symbolsOf(transition.codeRefs));

  const components = ordered.slice(0, limit);
  const kept = new Set(components);
  for (const [stateKey, names] of Object.entries(byState)) {
    const inState = names.filter((name) => kept.has(name));
    if (inState.length > 0) byState[stateKey] = inState;
    else delete byState[stateKey];
  }
  return { components, byState, omitted: ordered.slice(limit) };
}

/** The states each watched component is the code for; how a timing is attributed, whenever it is read. */
export function statesByComponent(targets: RenderTimingTargets): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [stateKey, names] of Object.entries(targets.byState)) {
    for (const name of names) (out[name] ??= []).push(stateKey);
  }
  return out;
}
