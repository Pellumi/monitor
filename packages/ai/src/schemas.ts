import { z } from 'zod';
import {
  sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeMode, sanitizeRecognizer, sanitizeRequires, sanitizeSubFlow,
} from './flow-spec';

/**
 * What a model returns is not what a schema author imagines. Live models send
 * `null` for a field they have nothing to say about, `"0.8"` for a number, a bare
 * string where a candidate object was asked for, and an enum value in the wrong
 * case. Rejecting the whole draft over any of that throws away a good flow because
 * of a field nobody reads, so the schema accepts what is unambiguous and drops what
 * is not. The flow itself (states and transitions) stays strict: it is what the
 * reviewer is asked to approve.
 */

/** A string a model may leave out or send as null. */
const text = () => z.string().nullish().transform((value) => value ?? undefined);

/** An enum value in any case or spelling ("Not Started" -> NOT_STARTED). */
function choice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : value),
    z.enum(values as unknown as [T[number], ...T[number][]]),
  );
}

/** A 0-1 number from `0.8`, `"0.8"`, `"80%"` or `80`. */
function unit(fallback: number) {
  return z
    .preprocess((value) => {
      const number = typeof value === 'string' ? Number(value.replace('%', '').trim()) : value;
      if (typeof number !== 'number' || Number.isNaN(number)) return undefined;
      return Math.min(1, Math.max(0, number > 1 ? number / 100 : number));
    }, z.number().min(0).max(1))
    .catch(fallback);
}

/** A list where an entry that does not fit is dropped instead of failing the list. */
function lenientList<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((entry) => item.safeParse(entry).success) : []),
    z.array(item),
  );
}

const CATEGORIES = ['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM'] as const;

export const FlowStateSchema = z.object({
  key: text(),
  name: z.string(),
  category: choice(CATEGORIES).catch('BUSINESS'),
  /** Exactly one state of a flow is INITIAL; every ending is TERMINAL. */
  role: choice(['NORMAL', 'INITIAL', 'TERMINAL']).nullish().catch(undefined).transform((value) => value ?? undefined),
  terminalKind: choice(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']).nullish().catch(undefined),
  /** One plain sentence on what the person sees or is doing in this state. */
  description: text(),
  /** Who is in this state: GUEST, ADMIN, STUDENT ... */
  actor: text(),
  /** How to tell the user is here. Anything unreadable is dropped, never repaired. */
  recognizer: z.unknown().transform(sanitizeRecognizer),
  /** Another flow used here in place of drawing its states again. */
  subFlow: z.unknown().transform(sanitizeSubFlow),
});

export const FlowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: text(),
  /** When the transition applies and another one does not: ON_SUCCESS, ON_FAILURE, ... */
  condition: text(),
  /** What the user operates, what goes in, what the application does, and who does it. */
  control: z.unknown().transform(sanitizeControl),
  inputs: z.unknown().transform((value) => { const inputs = sanitizeInputs(value); return inputs.length ? inputs : undefined; }),
  effects: z.unknown().transform((value) => { const effects = sanitizeEffects(value); return effects.length ? effects : undefined; }),
  mode: z.unknown().transform(sanitizeMode),
  transitionType: choice(['NORMAL', 'LOOP', 'RETRY']).nullish().catch(undefined).transform((value) => value ?? undefined),
});

const slug = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const WorkflowSchema = z.preprocess(
  // A workflow with a name but no key is still a workflow.
  (value) => {
    if (value && typeof value === 'object' && !(value as any).key && typeof (value as any).name === 'string') {
      return { ...(value as object), key: slug((value as any).name) || 'WORKFLOW' };
    }
    return value;
  },
  z.object({
    key: z.string(),
    name: z.string(),
    description: text(),
    workflowType: text(),
    states: z.array(FlowStateSchema).min(1),
    transitions: z.array(FlowTransitionSchema).nullish().transform((value) => value ?? []),
    requires: z.unknown().transform((value) => sanitizeRequires(value)),
  }),
);

const Candidate = z.object({
  key: z.string(),
  title: z.string(),
  reason: z.string(),
  confidence: unit(0.5),
});

export const FlowDraftSchema = z.object({
  domainKey: z.string().catch(''),
  confidence: unit(0.6),
  assumptions: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []),
    z.array(z.string()),
  ),
  workflows: z.array(WorkflowSchema).min(1),
  missingFlowCandidates: lenientList(Candidate),
  missingStateCandidates: lenientList(Candidate),
  suggestions: lenientList(
    z.object({
      type: choice([
        'PREREQUISITE',
        'IN_STATE_VALIDATION',
        'POST_REQUISITE',
        'ERROR_PATH',
        'EMPTY_STATE',
        'LOADING_STATE',
        'RECOVERY_PATH',
        'SECURITY_STATE',
        'BUSINESS_RULE',
      ]),
      title: z.string(),
      rationale: z.string(),
      confidence: unit(0.5),
      severity: choice(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).catch('INFO'),
      suggestedStates: lenientList(FlowStateSchema),
      suggestedTransitions: lenientList(FlowTransitionSchema),
    }),
  ),
  // Recorded by us, not decided by the model.
  source: choice(['RULE_ENGINE', 'AI', 'HYBRID']).catch('AI'),
});

export type AIFlowDraft = z.infer<typeof FlowDraftSchema>;
