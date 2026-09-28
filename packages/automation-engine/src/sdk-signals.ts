import { normalizeStateKey } from './keys';

/**
 * Reading the application's own Flow markers the way the boundary evaluator reads them.
 *
 * The recognizer's strongest evidence is a state the application's SDK says it has reached. But the
 * application can say so in three different shapes, and only one of them names the state the way the
 * contract does:
 *
 *   - the SDK's typed calls:          { flowVersionId, stateKey }
 *   - a hand-written slug marker:     { flow: 'lms-flow', state: 'exam-form' }
 *   - an instrumentation-adapter one: { stateId: 's-form', checkpointId, source: 'tellann-adapter' }
 *
 * The third is what the approved instrumentation an Automated Run requires actually writes, and it
 * names the state by its *id*. Compared as text against the contract's state key it never matches, so
 * the run would see a page that reports a state it cannot recognise as one — silently throwing away its
 * best evidence. `processQaFlowBoundaryEvent` avoids this by collapsing every name a state answers to
 * (`behaviorKey`, `stateName`, `name`, `id`, `stateId`) onto one canonical key; this is the same
 * collapse, so a marker means to the executor exactly what it means to the boundary.
 *
 * Pure, and deliberately a re-statement of the evaluator's rule rather than an import of it: the
 * evaluator lives in the database package, and the engine must stay free of it. A test pins the two
 * to the same behaviour on the same inputs.
 */

export interface StateNames {
  id?: string | null;
  stateId?: string | null;
  behaviorKey?: string | null;
  stateName?: string | null;
  name?: string | null;
}

/** The key a state is known by in the contract, and in `processQaFlowBoundaryEvent`. */
export function canonicalStateKey(state: StateNames): string {
  return normalizeStateKey(state.behaviorKey ?? state.stateName ?? state.name ?? state.id);
}

/**
 * Every normalised name a state answers to, mapped to its canonical key. The first state to claim a
 * name keeps it, as in the evaluator, so two states sharing a name resolve deterministically.
 */
export function stateAliasesOf(states: StateNames[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const state of states) {
    const canonical = canonicalStateKey(state);
    if (!canonical) continue;
    for (const alias of [state.behaviorKey, state.stateName, state.name, state.id, state.stateId]) {
      const normalized = normalizeStateKey(alias);
      if (normalized && !(normalized in aliases)) aliases[normalized] = canonical;
    }
  }
  return aliases;
}

export interface FlowMarkerMetadata {
  stateKey?: unknown;
  toStateKey?: unknown;
  state?: unknown;
  stateId?: unknown;
  [key: string]: unknown;
}

/** The Flow events that assert "the application is in this state". */
export const FLOW_STATE_MARKER_EVENTS = ['FLOW_INITIAL_STATE', 'FLOW_STATE_REACHED', 'FLOW_TRANSITION', 'FLOW_TERMINAL_STATE'] as const;

const nonEmpty = (value: unknown): string => (value == null ? '' : String(value).trim());

/**
 * The canonical state key a marker names, or null when it names none. The field order is the desktop's
 * and the evaluator's: `stateKey`, `toStateKey`, `state`, `stateId`. A name no state answers to is
 * returned as its normalised self, which is what the evaluator does (and then refuses as unknown).
 */
export function resolveMarkerState(aliases: Record<string, string>, metadata: FlowMarkerMetadata): string | null {
  const named = [metadata.stateKey, metadata.toStateKey, metadata.state, metadata.stateId].map(nonEmpty).find((value) => value !== '');
  if (!named) return null;
  const normalized = normalizeStateKey(named);
  if (!normalized) return null;
  return aliases[normalized] ?? normalized;
}

/**
 * The state signals seen since the last action, in the canonical vocabulary. The driver reads
 * `states()` for each snapshot and calls `reset()` when an action begins, so "since the last action" is
 * exactly what the recognizer is told.
 */
export class SdkSignalBuffer {
  private seen: string[] = [];

  constructor(private readonly aliases: Record<string, string>) {}

  /** Feed a Flow marker's metadata. Returns the key it resolved to, or null if it named no state. */
  observe(metadata: FlowMarkerMetadata): string | null {
    const key = resolveMarkerState(this.aliases, metadata);
    if (key) this.seen.push(key);
    return key;
  }

  states(): string[] {
    return [...this.seen];
  }

  reset(): void {
    this.seen = [];
  }
}
