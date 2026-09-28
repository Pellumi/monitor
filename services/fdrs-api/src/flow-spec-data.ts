import {
  sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeMode, sanitizeRecognizer, sanitizeRequires, sanitizeSubFlow,
  type FlowRequires, type StateRecognizer, type StepMode, type SubFlowRef, type TransitionControl, type TransitionEffect, type TransitionInput,
} from '@tellann/ai';

/**
 * Reading the flow specification out of a request body.
 *
 * Each field is a three-way choice, and the routes depend on telling them apart:
 *   absent   -> leave what is stored alone
 *   null     -> clear it
 *   a value  -> replace it, after it has been cleaned
 * A value that cannot be cleaned into anything usable clears the field rather than
 * storing something the person did not write.
 */

const has = (body: unknown, key: string) => Boolean(body) && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, key);
const field = (body: unknown, key: string): unknown => (body as Record<string, unknown>)[key];

export interface StateSpecPatch {
  recognizer?: StateRecognizer | null;
  /** A reference still to be resolved to a flow of the application; see `resolveSubFlow`. */
  subFlow?: SubFlowRef | null;
}

export function stateSpecPatch(body: unknown): StateSpecPatch {
  const patch: StateSpecPatch = {};
  if (has(body, 'recognizer')) patch.recognizer = sanitizeRecognizer(field(body, 'recognizer')) ?? null;
  if (has(body, 'subFlowId') || has(body, 'subFlow')) {
    const raw = has(body, 'subFlowId') ? { flowId: field(body, 'subFlowId') } : field(body, 'subFlow');
    patch.subFlow = sanitizeSubFlow(raw) ?? null;
  }
  return patch;
}

export interface TransitionSpecPatch {
  control?: TransitionControl | null;
  inputs?: TransitionInput[] | null;
  effects?: TransitionEffect[] | null;
  mode?: StepMode;
}

export interface TransitionSpecResult {
  patch: TransitionSpecPatch;
  /** Fields that were present but not understood at all (a mode that is not one of the three). */
  invalid: string[];
}

export function transitionSpecPatch(body: unknown): TransitionSpecResult {
  const patch: TransitionSpecPatch = {};
  const invalid: string[] = [];
  if (has(body, 'control')) patch.control = sanitizeControl(field(body, 'control')) ?? null;
  if (has(body, 'inputs')) {
    const inputs = sanitizeInputs(field(body, 'inputs'));
    patch.inputs = inputs.length ? inputs : null;
  }
  if (has(body, 'effects')) {
    const effects = sanitizeEffects(field(body, 'effects'));
    patch.effects = effects.length ? effects : null;
  }
  if (has(body, 'mode')) {
    const mode = sanitizeMode(field(body, 'mode'));
    // Silently treating an unknown mode as AUTO would make a step *less* supervised than asked.
    if (mode) patch.mode = mode;
    else invalid.push('mode');
  }
  return { patch, invalid };
}

/** `requires` for a flow; `null` clears it. Its data keys are completed from the flow's own inputs by the caller. */
export function flowRequiresPatch(body: unknown, inputs: TransitionInput[] = []): FlowRequires | null | undefined {
  if (!has(body, 'requires')) return undefined;
  const raw = field(body, 'requires');
  return raw === null ? null : sanitizeRequires(raw, inputs) ?? null;
}

/** The inputs stored on a graph's transitions, for completing `requires`. */
export function inputsOfEdges(edges: Array<{ expectedInput?: unknown }>): TransitionInput[] {
  return edges.flatMap((edge) => sanitizeInputs(edge.expectedInput));
}
