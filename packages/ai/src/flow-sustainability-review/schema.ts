import { z } from 'zod';

/**
 * A place in the model's own narration where it could not go on without guessing — the
 * evidence for criterion 1 ("interpretable end-to-end") and criterion 4 ("business intent
 * derivable from the graph alone") being gated, AI-judgment findings rather than deterministic
 * ones: whether a graph genuinely reads clearly is not something a lint rule can decide.
 */
export const NarrationHedgeSchema = z.object({
  /** The single state this hedge is about, when there is one. */
  stateKey: z.string().min(1).max(80).nullable().optional(),
  /** The transition this hedge is about, when there is one — both set or neither. */
  fromStateKey: z.string().min(1).max(80).nullable().optional(),
  toStateKey: z.string().min(1).max(80).nullable().optional(),
  reason: z.string().min(3).max(300),
});
export type NarrationHedge = z.infer<typeof NarrationHedgeSchema>;

/**
 * A state or transition whose declared name/description/evidence would not be enough, on
 * their own, to confidently tell it apart from the rest of a real codebase.
 *
 * This is a proxy for criterion 2 ("mapped to the codebase"), not the real thing: the actual
 * mapping pipeline (`packages/project-intelligence` + `packages/ai/src/flow-mapping.ts`) only
 * runs against a *published*, project-bound Flow version — `FlowInitialization`/`FlowScan`
 * both key off `BehaviorGraphVersion`, which does not exist yet for a draft. Pre-publish, the
 * best available signal is a model's judgment of how distinctive the declaration itself is,
 * not a grounded resolution against real source. Treat `ambiguousIdentifiers` as "likely to
 * need a person's help mapping this," not as "this will fail to map."
 */
export const AmbiguousIdentifierSchema = z.object({
  stateKey: z.string().min(1).max(80).nullable().optional(),
  fromStateKey: z.string().min(1).max(80).nullable().optional(),
  toStateKey: z.string().min(1).max(80).nullable().optional(),
  reason: z.string().min(3).max(300),
});
export type AmbiguousIdentifier = z.infer<typeof AmbiguousIdentifierSchema>;

export const FlowNarrationResponseSchema = z.object({
  /** The model's attempt at telling the story from the initial state to each terminal state, using only what is declared. */
  narrative: z.string().max(2000),
  /** False the moment the model had to invent a step the graph does not declare, or skip a gap in silence. */
  canNarrateEndToEnd: z.boolean(),
  /** What the model believes this Flow is *for*, in business terms — null when it cannot say without guessing. */
  businessIntentSummary: z.string().max(500).nullable(),
  canDeriveBusinessIntent: z.boolean(),
  hedges: z.array(NarrationHedgeSchema).max(20).default([]),
  ambiguousIdentifiers: z.array(AmbiguousIdentifierSchema).max(20).default([]),
});
export type FlowNarrationResponse = z.infer<typeof FlowNarrationResponseSchema>;

export interface FlowNarrationStateSummary {
  key: string;
  name: string;
  role?: string;
  terminalKind?: string | null;
  description?: string | null;
}

export interface FlowNarrationTransitionSummary {
  from: string;
  to: string;
  action?: string | null;
}

export interface FlowNarrationInput {
  flowName: string;
  states: FlowNarrationStateSummary[];
  transitions: FlowNarrationTransitionSummary[];
}

export interface FlowNarrationResult {
  narration: FlowNarrationResponse | null;
  aiCalled: boolean;
  aiRepaired: boolean;
  fallbackUsed: boolean;
  provider?: string;
  model?: string;
  promptHash?: string;
  latencyMs: number;
}
