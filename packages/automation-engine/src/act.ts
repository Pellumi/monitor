import { rankControls } from './ranking';
import type { ActionOutcome, AutomationAction, ControlDescriptor, FormInput, SemanticSnapshot } from './types';

/**
 * Performing one control-driven step, shared by the Flow executor and the entry sequence
 * (the pre-boundary walk to the Flow's initial state, including login). Both need the same
 * thing: resolve declared inputs against a data source, find the control on the live page, and
 * click it — reported the same way, so a failure looks identical whether it happened inside the
 * Flow or on the way to it.
 *
 * Split in two on purpose. `resolveStep` is pure and synchronous: it decides *what* would be
 * done and can fail with nothing yet attempted, which is what lets a caller emit "this is the
 * action I chose" before any side effect happens. `performStep` is the part that actually acts.
 */

export type StepFailureReason =
  | 'NO_DERIVED_CONTROL'
  | 'CONTROL_NOT_FOUND'
  | 'CONTROL_AMBIGUOUS'
  | 'DATA_UNAVAILABLE'
  | 'FIELD_NOT_FOUND';

export type ResolveFailure = { ok: false; reason: StepFailureReason; detail: string };

export interface ResolvedStep {
  ok: true;
  controlRef: string;
  method: string;
  score: number;
  fills: Array<{ ref: string; value: string; secret: boolean }>;
}

export interface DataValue {
  value: string;
  secret: boolean;
}

export interface StepInput {
  /** The control to act on. `null` means the code gave no evidence for it: never guessed. */
  control: ControlDescriptor | null;
  /** Fields to fill before clicking, in order. */
  inputs: FormInput[];
  data: (key: string) => DataValue | undefined;
  /** Label used only in failure detail messages. */
  label: string;
  /**
   * Settles a tie between controls the ranking could not separate. It is handed the refs of the tied
   * candidates and may return one of them; anything else is ignored. The caller is responsible for
   * having verified the choice (see `verifyControlProposal`): this only applies it.
   */
  tieBreak?: (tiedRefs: string[]) => string | null;
}

export function resolveStep(snapshot: SemanticSnapshot, input: StepInput): ResolvedStep | ResolveFailure {
  if (!input.control) {
    return { ok: false, reason: 'NO_DERIVED_CONTROL', detail: `The code gives no control for ${input.label}, so the run will not guess one.` };
  }
  const ranked = rankControls(input.control, snapshot.elements);
  if (ranked.ambiguous) {
    const topScore = ranked.candidates[0]?.score;
    const tied = ranked.candidates.filter((candidate) => candidate.score === topScore);
    const picked = input.tieBreak?.(tied.map((candidate) => candidate.element.ref)) ?? null;
    const chosen = picked ? tied.find((candidate) => candidate.element.ref === picked) : undefined;
    if (!chosen) {
      return { ok: false, reason: 'CONTROL_AMBIGUOUS', detail: `More than one control matches ${input.label} equally well.` };
    }
    ranked.best = chosen;
  }
  if (!ranked.best) {
    const hidden = ranked.unusable.length > 0 ? ' A matching control exists but is hidden or disabled.' : '';
    return { ok: false, reason: 'CONTROL_NOT_FOUND', detail: `No control for ${input.label} is on the page.${hidden}` };
  }

  const fills: ResolvedStep['fills'] = [];
  for (const field of input.inputs) {
    const supplied = input.data(field.dataKey);
    if (!supplied) return { ok: false, reason: 'DATA_UNAVAILABLE', detail: `No value is available for "${field.dataKey}".` };
    const target = findField(field.name, field.label, snapshot.elements);
    if (!target) return { ok: false, reason: 'FIELD_NOT_FOUND', detail: `No field for "${field.name}" is on the page.` };
    fills.push({ ref: target.ref, value: supplied.value, secret: supplied.secret });
  }

  return { ok: true, controlRef: ranked.best.element.ref, method: ranked.best.method, score: ranked.best.score, fills };
}

export type PerformResult =
  | { ok: true }
  | { ok: false; stage: 'FILL' | 'CLICK'; error: string };

export async function performStep(
  ports: { act(action: AutomationAction): Promise<ActionOutcome> },
  resolved: ResolvedStep,
): Promise<PerformResult> {
  for (const fill of resolved.fills) {
    const outcome = await ports.act({ kind: 'FILL', ref: fill.ref, value: fill.value, secret: fill.secret });
    if (!outcome.ok) return { ok: false, stage: 'FILL', error: outcome.error ?? 'unknown error' };
  }
  const outcome = await ports.act({ kind: 'CLICK', ref: resolved.controlRef });
  if (!outcome.ok) return { ok: false, stage: 'CLICK', error: outcome.error ?? 'unknown error' };
  return { ok: true };
}

function findField(name: string, label: string | null, elements: SemanticSnapshot['elements']): SemanticSnapshot['elements'][number] | undefined {
  const wanted = [name, label].filter((value): value is string => Boolean(value)).map(normalize);
  return elements.find((element) => {
    if (!element.visible || !element.enabled) return false;
    if (element.fieldName === null && element.label === null && element.testId === null && element.name === null) return false;
    const candidates = [element.fieldName, element.label, element.name, element.testId, element.domId]
      .filter((value): value is string => Boolean(value))
      .map(normalize);
    return wanted.some((target) => candidates.includes(target));
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
