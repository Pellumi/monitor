import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeAiInputFull } from './privacy/sanitize-ai-input';
import { normalizeWorkflowLanguage, lintWorkflowLanguage } from './flow-language';
import { groundInDocument } from './flow-grounding';
import type { FlowLanguageIssue } from './flow-language';
import { sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeMode, sanitizeRecognizer, sanitizeRequires, sanitizeSubFlow } from './flow-spec';
import type { FlowRequires, StateRecognizer, StepMode, SubFlowRef, TransitionControl, TransitionEffect, TransitionInput } from './flow-spec';
import { FLOW_LANGUAGE_PROMPT } from './prompts/flow-language.prompt';

// ─────────────────────────────────────────────────────────────
// Document → flow inference (Gemini multimodal)
//
// Unlike `generateAiFlowDraft` (which works from a text description), this hands
// the raw file bytes to Gemini's native multimodal `generateContent` endpoint so
// PDFs, DOCX, Markdown, etc. are understood directly — no local text extraction.
// ─────────────────────────────────────────────────────────────

/** A short phrase copied verbatim from the document — what `groundInDocument` checks a state/transition against. */
const evidenceField = z.string().nullish().transform((value) => value?.trim().slice(0, 200) || undefined);

export const DocumentFlowStateSchema = z.object({
  name: z.string().min(1),
  category: z
    .enum(['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM'])
    .default('BUSINESS'),
  role: z.enum(['NORMAL', 'INITIAL', 'TERMINAL']).default('NORMAL'),
  terminalKind: z
    .enum(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE'])
    .nullish(),
  description: z.string().nullish().transform((value) => value ?? undefined),
  actor: z.string().nullish().transform((value) => value ?? undefined),
  recognizer: z.unknown().transform(sanitizeRecognizer),
  subFlow: z.unknown().transform(sanitizeSubFlow),
  evidence: evidenceField,
});

export const DocumentFlowTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  action: z.string().nullish().transform((value) => value ?? undefined),
  condition: z.string().nullish().transform((value) => value ?? undefined),
  control: z.unknown().transform(sanitizeControl),
  inputs: z.unknown().transform((value) => { const inputs = sanitizeInputs(value); return inputs.length ? inputs : undefined; }),
  effects: z.unknown().transform((value) => { const effects = sanitizeEffects(value); return effects.length ? effects : undefined; }),
  mode: z.unknown().transform(sanitizeMode),
  evidence: evidenceField,
});

export const DocumentFlowSchema = z.object({
  name: z.string().min(1).default('New Flow'),
  purpose: z.string().default(''),
  scopeStatement: z.string().default(''),
  workflowType: z
    .enum([
      'CUSTOM',
      'CHECKOUT',
      'AUTHENTICATION',
      'REGISTRATION',
      'ASSESSMENT',
      'ENROLLMENT',
    ])
    .default('CUSTOM'),
  states: z.array(DocumentFlowStateSchema).min(1),
  transitions: z.array(DocumentFlowTransitionSchema).default([]),
  requires: z.unknown().transform((value) => sanitizeRequires(value)),
});

export type DocumentFlow = z.infer<typeof DocumentFlowSchema>;

export interface DocumentFlowResult extends DocumentFlow {
  provider: string;
  model: string;
  promptHash: string;
  /** Details — and, now, whole states/transitions — the document does not support, so were left out. */
  leftOut?: FlowLanguageIssue[];
  /** Structural problems in the resulting graph itself (no initial state, an unreachable state, ...). */
  structuralIssues?: FlowLanguageIssue[];
  /** True when the self-consistency pass found and repaired an ordering problem. */
  repairedOrdering?: boolean;
  /** Provider calls this generation made: 1, or 2 when the self-consistency pass ran (whether or not it changed anything) — the real cost unit, not wall time alone. */
  providerCalls: number;
  /** Wall time in ms for the whole call, generation plus the repair pass if it ran. */
  generationMs: number;
}

export interface GenerateFlowFromDocumentOptions {
  /** Base64-encoded file bytes (no data: prefix). */
  fileBase64: string;
  /** MIME type of the file, e.g. application/pdf. */
  mimeType: string;
  /** Original filename — used only to give the model context. */
  filename: string;
  /**
   * The document's extracted text, when the caller already has it (for example via
   * `@tellann/document-intelligence`). When present, grounding checks every recognizer,
   * control, effect, requirement AND every state/transition's `evidence` against it —
   * instead of the file bytes alone, which for most non-text mime types (PDF included)
   * cannot be checked at all. Pass this whenever the caller can extract it.
   */
  documentText?: string;
  /** Evidence segments (from `@tellann/document-intelligence`), used to attach `evidenceIds` to the output. */
  evidenceSegments?: Array<{ id: string; excerpt: string }>;
  /** Other flows in this application the model may reference with `subFlow`, instead of only drawing one flow in isolation. */
  existingFlows?: DocumentFlowExistingFlow[];
  /** Narrows generation to one journey the document describes, for multi-flow decomposition (see `decomposeDocumentIntoFlows`). */
  journey?: DocumentFlowJourneyHint;
  /** Skip the self-consistency repair pass (it costs a second call; on by default when `documentText` is given). */
  skipConsistencyCheck?: boolean;
  env?: NodeJS.ProcessEnv;
  /** Per-attempt timeout (default 60s — multimodal calls are slower). */
  timeoutMs?: number;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    purpose: { type: 'string' },
    scopeStatement: { type: 'string' },
    workflowType: {
      type: 'string',
      enum: [
        'CUSTOM',
        'CHECKOUT',
        'AUTHENTICATION',
        'REGISTRATION',
        'ASSESSMENT',
        'ENROLLMENT',
      ],
    },
    states: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: {
            type: 'string',
            enum: ['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM'],
          },
          role: { type: 'string', enum: ['NORMAL', 'INITIAL', 'TERMINAL'] },
          terminalKind: {
            type: 'string',
            enum: ['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE'],
          },
          description: { type: 'string' },
          actor: { type: 'string' },
          recognizer: {
            type: 'object',
            properties: {
              routes: { type: 'array', items: { type: 'string' } },
              headings: { type: 'array', items: { type: 'string' } },
              texts: { type: 'array', items: { type: 'string' } },
            },
          },
          subFlow: { type: 'object', properties: { name: { type: 'string' } } },
          evidence: { type: 'string' },
        },
        required: ['name', 'category', 'role'],
      },
    },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          action: { type: 'string' },
          condition: { type: 'string' },
          control: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['link', 'button', 'tab', 'menuitem', 'checkbox', 'radio', 'field', 'select'] },
              label: { type: 'string' },
            },
          },
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                dataKey: { type: 'string' },
                role: { type: 'string', enum: ['PROTECTED', 'PROVIDED', 'GENERATED'] },
              },
              required: ['name'],
            },
          },
          effects: {
            type: 'array',
            items: {
              type: 'object',
              properties: { method: { type: 'string' }, route: { type: 'string' }, status: { type: 'integer' } },
              required: ['method', 'route'],
            },
          },
          mode: { type: 'string', enum: ['AUTO', 'CONFIRM', 'MANUAL'] },
          evidence: { type: 'string' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['name', 'states', 'transitions'],
} as const;
// `requires` is left out of the response schema on purpose: the document rarely says it, and a schema
// that lists it invites a model to fill it in.

export interface DocumentFlowJourneyHint {
  name: string;
  purpose: string;
  entryHint?: string;
  exitHint?: string;
}

export interface DocumentFlowExistingFlow {
  name: string;
  purpose?: string;
}

function buildPrompt(
  filename: string,
  options?: { journey?: DocumentFlowJourneyHint; existingFlows?: DocumentFlowExistingFlow[] },
): string {
  const scope = options?.journey
    ? [
        `Extract ONLY the following journey as a finite state machine — ignore everything else in the document, including other journeys it describes:`,
        `  Journey: ${options.journey.name}`,
        `  Purpose: ${options.journey.purpose}`,
        ...(options.journey.entryHint ? [`  Starts at: ${options.journey.entryHint}`] : []),
        ...(options.journey.exitHint ? [`  Ends at: ${options.journey.exitHint}`] : []),
      ]
    : [
        'Extract ONE focused user-facing flow (a bounded capability such as checkout, sign-up, password reset, course enrolment — not the entire product) as a finite state machine.',
      ];
  const existingFlows = options?.existingFlows?.length
    ? [
        `EXISTING FLOWS you may reuse as a subFlow — a state that stands for one of these in full, instead of repeating its steps:`,
        ...options.existingFlows.map((flow) => `  - ${flow.name}${flow.purpose ? `: ${flow.purpose}` : ''}`),
        'Use subFlow ONLY for a state that genuinely hands off to one of these flows end-to-end (for example, a step that pays and unlocks access). Do not invent a flow name that is not in this list.',
      ]
    : ['EXISTING FLOWS you may reuse as a subFlow: none. Do not use subFlow.'];
  return [
    'You are a product analyst. The attached document describes a software product or a feature of one.',
    `Filename: ${filename}`,
    '',
    ...scope,
    '',
    ...FLOW_LANGUAGE_PROMPT,
    '',
    'EVIDENCE. For every state and every transition, set "evidence" to a short phrase (3-12 words) copied verbatim from the document that says this state or step exists. This is checked mechanically afterward: a state or transition whose evidence cannot be found in the document is removed, so a wrong or missing citation loses that state or transition entirely, not just one detail. Leave "evidence" empty only for a state that is the flow\'s implicit, undescribed starting point (e.g. "the user is signed in already") — never for a state or transition the document actually describes. Never copy text from a different part of the document than the one that describes this state or step.',
    '',
    'BRANCHES. When the document describes two or more outcomes for the same situation with language like "if X / otherwise Y", "when X vs when Y", or a threshold ("less than N", "more than N"), model it as two (or more) transitions leaving the same state, each with a distinct "condition" naming which case it is (e.g. EXAM_LT_2_DAYS / EXAM_GTE_2_DAYS, SUBSCRIBED / NOT_SUBSCRIBED) — never collapse them into a single path or drop the branch the document also describes.',
    '',
    'ORDER. When the document states that one thing only happens after another ("does not X until Y", "once Y, then X"), the transitions must reflect that exact order. Re-read the document for this before finishing: a flow that silently reorders or skips a stated dependency is wrong even if every individual state and transition is otherwise correct.',
    '',
    ...existingFlows,
    '- Do not invent requirements that are not supported by the document.',
    '- "name" is a short human title for the flow. "purpose" is one sentence. "scopeStatement" states the boundary (first state → last state).',
    '',
    'Respond ONLY with JSON matching the provided schema.',
  ].join('\n');
}

function resolveGemini(env: NodeJS.ProcessEnv) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;
  // A dedicated multimodal model override — NOT GEMINI_MODEL, which elsewhere
  // points at a lightweight text model that may not accept file inputs.
  const base =
    env.GEMINI_GENERATE_CONTENT_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models';
  const models = [
    ...new Set([
      env.GEMINI_MULTIMODAL_MODEL || 'gemini-2.5-flash',
      ...(env.GEMINI_MULTIMODAL_FALLBACK_MODELS ?? 'gemini-2.5-flash-lite,gemini-3.5-flash-lite')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ]),
  ];
  return { apiKey, models, url: (model: string) => `${base}/${model}:generateContent` };
}

/** Load or availability problems that another model may not share. */
const RETRY_WITH_NEXT_MODEL = new Set([404, 408, 429, 500, 502, 503, 504]);

type Gemini = NonNullable<ReturnType<typeof resolveGemini>>;

/**
 * One call to Gemini with the model-fallback chain, returning the concatenated text of
 * the first candidate. Shared by document generation, the self-consistency repair pass,
 * and journey decomposition, so all three fail over models and report errors the same way.
 */
async function callGemini(gemini: Gemini, body: string, timeoutMs: number): Promise<{ text: string; usedModel: string }> {
  let payload: any;
  let usedModel = gemini.models[0];
  let lastError: Error | undefined;
  for (const model of gemini.models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${gemini.url(model)}?key=${gemini.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        lastError = new Error(`DOCUMENT_FLOW_PROVIDER_ERROR:${res.status}:${model}:${detail.slice(0, 300)}`);
        if (RETRY_WITH_NEXT_MODEL.has(res.status)) continue;
        throw lastError;
      }
      payload = await res.json();
      usedModel = model;
      break;
    } catch (error) {
      if (error === lastError) throw error;
      // A timeout or a dropped connection is worth one try on the next model.
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!payload) throw lastError ?? new Error('DOCUMENT_FLOW_PROVIDER_ERROR');

  const text: string | undefined =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text)
      .filter(Boolean)
      .join('') ?? undefined;
  if (!text) throw new Error('DOCUMENT_FLOW_EMPTY_RESPONSE');
  return { text, usedModel };
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('DOCUMENT_FLOW_UNPARSEABLE_RESPONSE');
    return JSON.parse(match[0]);
  }
}

const REPAIR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    changed: { type: 'boolean' },
    explanation: { type: 'string' },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' }, to: { type: 'string' }, action: { type: 'string' }, condition: { type: 'string' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['changed', 'transitions'],
} as const;

const RepairResponseSchema = z.object({
  changed: z.boolean().default(false),
  explanation: z.string().nullish(),
  transitions: z.array(z.object({
    from: z.string().min(1), to: z.string().min(1),
    action: z.string().nullish().transform((v) => v ?? undefined),
    condition: z.string().nullish().transform((v) => v ?? undefined),
  })).default([]),
});

/**
 * A second, text-only pass: shows the model its own draft next to the document and asks
 * it to check ONLY for two mistakes a single generation pass is prone to — a step
 * sequenced before something the document says must happen first, and a branch the
 * document describes ("if X / otherwise Y") that got collapsed into one path. It may
 * only return a revised transition list; it cannot add, rename, or remove states, and
 * any transition it returns that does not resolve to an existing state is dropped by
 * `normalizeWorkflowLanguage` the same way a first-pass mistake would be.
 */
async function repairOrdering(input: {
  gemini: Gemini;
  documentText: string;
  flow: { key: string; name: string; states: Array<{ key: string; name: string }>; transitions: Array<{ from: string; to: string; action?: string; condition?: string }> };
  timeoutMs: number;
}): Promise<{ transitions: Array<{ from: string; to: string; action?: string; condition?: string }>; changed: boolean } | null> {
  const draft = {
    states: input.flow.states.map((state) => state.key),
    transitions: input.flow.transitions.map((transition) => ({ from: transition.from, to: transition.to, action: transition.action, condition: transition.condition })),
  };
  const prompt = [
    'You checked a document and drew this flow from it:',
    JSON.stringify(draft),
    '',
    'Re-read the document below. Check for exactly two kinds of mistake:',
    '1. A transition that is sequenced before something the document says must happen first (e.g. the document says X only happens after Y is confirmed, but the draft has X before Y).',
    '2. A branch the document describes with "if X / otherwise Y" or a threshold that the draft collapsed into a single path, dropping one of the cases.',
    '',
    'If you find either, return a corrected "transitions" array that fixes ONLY that — same states, same "from"/"to" values (you may not introduce a state name not already listed above), minimally reordered or branched. Set "changed": true and say what you fixed in "explanation".',
    'If the draft already reflects the document correctly, return "changed": false and an empty "transitions" array. Do not make a change you cannot point to in the text below.',
    '',
    'DOCUMENT:',
    input.documentText.slice(0, 20_000),
    '',
    'Respond ONLY with JSON matching the provided schema.',
  ].join('\n');
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: REPAIR_RESPONSE_SCHEMA },
  });
  try {
    const { text } = await callGemini(input.gemini, body, input.timeoutMs);
    const result = RepairResponseSchema.parse(parseJsonLoose(text));
    return result.changed && result.transitions.length ? result : { transitions: [], changed: false };
  } catch {
    // The repair pass is an enhancement, never a requirement — the first-pass draft still stands on its own.
    return null;
  }
}

/**
 * Sends the raw file to Gemini and returns a validated single-flow graph.
 * Throws on missing credentials, transport failure, or an unparseable response.
 */
export async function generateFlowFromDocument(
  input: GenerateFlowFromDocumentOptions,
): Promise<DocumentFlowResult> {
  const startedAt = Date.now();
  let providerCalls = 0;
  const env = input.env ?? process.env;
  const gemini = resolveGemini(env);
  if (!gemini) {
    throw new Error('DOCUMENT_FLOW_PROVIDER_UNCONFIGURED');
  }

  const prompt = buildPrompt(input.filename, { journey: input.journey, existingFlows: input.existingFlows });
  const promptHash = crypto
    .createHash('sha256')
    .update(`${prompt}:${input.mimeType}:${input.fileBase64.length}`)
    .digest('hex');

  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: input.mimeType, data: input.fileBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const { text, usedModel } = await callGemini(gemini, body, input.timeoutMs ?? 60_000);
  providerCalls += 1;
  const parsedFlow = DocumentFlowSchema.parse(parseJsonLoose(text));

  // Whatever the model wrote, the flow the rest of Tellann sees is in the flow
  // language: compact state keys, verb-phrase actions, one INITIAL, real endings,
  // and no transition pointing at a state that does not exist.
  const language = normalizeWorkflowLanguage({
    key: 'DOCUMENT_FLOW',
    name: parsedFlow.name,
    states: parsedFlow.states,
    transitions: parsedFlow.transitions,
    requires: parsedFlow.requires,
  });

  // A document the caller already extracted text from (any mime type) can be checked in
  // full; otherwise only a handful of text-ish mime types can be decoded straight from
  // the base64 bytes. A PDF is neither — this is the gap that used to drop every
  // recognizer, control detail and evidence citation for the most common upload type.
  const readableByMime = /^(text\/|application\/(json|xml|x-yaml|yaml))/.test(input.mimeType);
  const documentText = input.documentText ?? (readableByMime ? Buffer.from(input.fileBase64, 'base64').toString('utf8') : null);

  let groundedWorkflow = language;
  const dropped: FlowLanguageIssue[] = [];
  let repairedOrdering = false;
  if (documentText !== null) {
    // One self-consistency pass before grounding: a reordered or collapsed branch is a
    // topology mistake grounding cannot see (both halves may each be individually
    // well-cited), so it is checked and, if possible, fixed first.
    if (!input.skipConsistencyCheck) {
      const repair = await repairOrdering({
        gemini, documentText,
        flow: { key: language.key, name: language.name, states: language.states, transitions: language.transitions },
        timeoutMs: Math.min(input.timeoutMs ?? 30_000, 30_000),
      });
      providerCalls += 1;
      if (repair?.changed) {
        repairedOrdering = true;
        // The repair pass only echoes back from/to/action/condition — richer fields
        // (control, inputs, effects, mode, evidence) are carried over from the original
        // transition with the same (from, to, action) identity, where one exists. A
        // transition the repair newly introduces (a restored branch) has none of those
        // yet; it still passes through grounding, just with nothing extra to verify.
        const byIdentity = new Map(language.transitions.map((transition) => [`${transition.from}|${transition.to}|${transition.action ?? ''}`, transition]));
        const merged = repair.transitions.map((transition) => {
          const original = byIdentity.get(`${transition.from}|${transition.to}|${transition.action ?? ''}`);
          return original ? { ...original, condition: transition.condition ?? original.condition } : transition;
        });
        groundedWorkflow = normalizeWorkflowLanguage({
          ...language,
          // States are not up for revision in the repair pass — only how they connect.
          states: language.states,
          transitions: merged,
        }) as typeof language;
      }
    }
  }
  // What a model declares outranks what the code says, so nothing is kept that the document does not support.
  const ground = groundInDocument(groundedWorkflow, documentText);
  const normalized = ground.workflow;
  dropped.push(...ground.dropped);

  const structuralIssues = lintWorkflowLanguage({ key: normalized.key, name: normalized.name, states: normalized.states, transitions: normalized.transitions });

  // Privacy: the derived name/purpose/scope come back into our system, so scrub
  // them the same way free-text description input is scrubbed.
  const scrub = (value: string) =>
    value ? sanitizeAiInputFull(value).sanitizedText : value;

  // Correlate each surviving state/transition's evidence quote back to the segment(s) it
  // was drawn from, so the graph carries citations a reviewer (or the suggestions
  // pipeline) can jump to — `BehaviorGraphNode.evidenceIds` / `...Edge.evidenceIds`
  // already exist for exactly this.
  const evidenceIdsFor = (evidence: string | undefined): string[] | undefined => {
    if (!evidence || !input.evidenceSegments?.length) return undefined;
    const needle = evidence.toLowerCase();
    const ids = input.evidenceSegments.filter((segment) => segment.excerpt.toLowerCase().includes(needle)).map((segment) => segment.id);
    return ids.length ? ids.slice(0, 5) : undefined;
  };

  return {
    ...parsedFlow,
    states: normalized.states.map((state) => ({
      name: state.name,
      category: state.category as DocumentFlow['states'][number]['category'],
      role: state.role as DocumentFlow['states'][number]['role'],
      terminalKind: state.role === 'TERMINAL' ? (state.terminalKind as DocumentFlow['states'][number]['terminalKind']) : null,
      description: state.description ? scrub(state.description) : undefined,
      actor: state.actor ? scrub(state.actor) : undefined,
      recognizer: state.recognizer as StateRecognizer | undefined,
      subFlow: state.subFlow as SubFlowRef | undefined,
      ...(evidenceIdsFor(state.evidence) ? { evidenceIds: evidenceIdsFor(state.evidence) } : {}),
    })),
    transitions: normalized.transitions.map((transition) => ({
      from: transition.from,
      to: transition.to,
      action: transition.action,
      condition: transition.condition,
      control: transition.control as TransitionControl | undefined,
      inputs: transition.inputs as TransitionInput[] | undefined,
      effects: transition.effects as TransitionEffect[] | undefined,
      mode: transition.mode as StepMode | undefined,
      ...(evidenceIdsFor(transition.evidence) ? { evidenceIds: evidenceIdsFor(transition.evidence) } : {}),
    })),
    requires: normalized.requires as FlowRequires | undefined,
    name: scrub(parsedFlow.name) || 'New Flow',
    purpose: scrub(parsedFlow.purpose),
    scopeStatement: scrub(parsedFlow.scopeStatement),
    provider: 'gemini',
    model: usedModel,
    promptHash,
    leftOut: dropped,
    structuralIssues,
    repairedOrdering,
    providerCalls,
    generationMs: Date.now() - startedAt,
  };
}

export interface DocumentJourney {
  name: string;
  purpose: string;
  entryHint?: string;
  exitHint?: string;
}

const DECOMPOSE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    journeys: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, purpose: { type: 'string' }, entryHint: { type: 'string' }, exitHint: { type: 'string' },
        },
        required: ['name', 'purpose'],
      },
    },
  },
  required: ['journeys'],
} as const;

const DecomposeResponseSchema = z.object({
  journeys: z.array(z.object({
    name: z.string().min(1),
    purpose: z.string().default(''),
    entryHint: z.string().nullish().transform((v) => v ?? undefined),
    exitHint: z.string().nullish().transform((v) => v ?? undefined),
  })).max(8),
});

/**
 * First pass of multi-flow generation: lists the distinct journeys the document
 * describes, so each can be generated as its own flow (via `generateFlowFromDocument`
 * with `journey` set) and reference the others with `subFlow` instead of one generation
 * call being forced to compress — or truncate — an entire document into a single flow.
 */
export async function decomposeDocumentIntoFlows(input: {
  fileBase64: string;
  mimeType: string;
  filename: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<DocumentJourney[]> {
  const env = input.env ?? process.env;
  const gemini = resolveGemini(env);
  if (!gemini) throw new Error('DOCUMENT_FLOW_PROVIDER_UNCONFIGURED');

  const prompt = [
    'You are a product analyst. The attached document describes a software product or a feature of one.',
    `Filename: ${input.filename}`,
    '',
    'List the DISTINCT user-facing journeys this document describes — each a bounded, nameable capability a user completes start to finish (such as "first-time onboarding", "checkout", "password reset"). Steps that follow one another as part of the same story belong in ONE journey, not several — only split when journeys begin in different places and do not simply continue one another.',
    '- For each journey give: "name" (a short title), "purpose" (one sentence), "entryHint" (how the document says this journey begins) and "exitHint" (how it ends).',
    '- A journey that mainly exists to be reused inside others (for example, a payment step reused from several places) should still be listed once on its own — it will be generated once and referenced from the rest via subFlow.',
    '- List at most 8 journeys. Prefer fewer, correctly-scoped journeys over many overlapping ones.',
    '',
    'Respond ONLY with JSON matching the provided schema.',
  ].join('\n');

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: input.mimeType, data: input.fileBase64 } }, { text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: DECOMPOSE_RESPONSE_SCHEMA },
  });

  const { text } = await callGemini(gemini, body, input.timeoutMs ?? 45_000);
  return DecomposeResponseSchema.parse(parseJsonLoose(text)).journeys;
}
