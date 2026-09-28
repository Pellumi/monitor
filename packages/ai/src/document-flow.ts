import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeAiInputFull } from './privacy/sanitize-ai-input';
import { normalizeWorkflowLanguage } from './flow-language';
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
  /** Details the model declared that the document does not support, and so were left out. */
  leftOut?: FlowLanguageIssue[];
}

export interface GenerateFlowFromDocumentOptions {
  /** Base64-encoded file bytes (no data: prefix). */
  fileBase64: string;
  /** MIME type of the file, e.g. application/pdf. */
  mimeType: string;
  /** Original filename — used only to give the model context. */
  filename: string;
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
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['name', 'states', 'transitions'],
} as const;
// `requires` is left out of the response schema on purpose: the document rarely says it, and a schema
// that lists it invites a model to fill it in.

function buildPrompt(filename: string): string {
  return [
    'You are a product analyst. The attached document describes a software product or a feature of one.',
    `Filename: ${filename}`,
    '',
    'Extract ONE focused user-facing flow (a bounded capability such as checkout, sign-up, password reset, course enrolment — not the entire product) as a finite state machine.',
    '',
    ...FLOW_LANGUAGE_PROMPT,
    '',
    'EXISTING FLOWS you may reuse as a subFlow: none. Do not use subFlow.',
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

/**
 * Sends the raw file to Gemini and returns a validated single-flow graph.
 * Throws on missing credentials, transport failure, or an unparseable response.
 */
export async function generateFlowFromDocument(
  input: GenerateFlowFromDocumentOptions,
): Promise<DocumentFlowResult> {
  const env = input.env ?? process.env;
  const gemini = resolveGemini(env);
  if (!gemini) {
    throw new Error('DOCUMENT_FLOW_PROVIDER_UNCONFIGURED');
  }

  const prompt = buildPrompt(input.filename);
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

  // A model that is overloaded or gone should not fail the upload while the next
  // one is up. Each model gets the full timeout; the last failure is what is reported.
  let payload: any;
  let usedModel = gemini.models[0];
  let lastError: Error | undefined;
  for (const model of gemini.models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 60_000);
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('DOCUMENT_FLOW_UNPARSEABLE_RESPONSE');
    parsed = JSON.parse(match[0]);
  }

  const parsedFlow = DocumentFlowSchema.parse(parsed);

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
  // What a model declares outranks what the code says, so nothing is kept that the document does not support. A file
  // read as text can be checked; one the model read directly (a PDF) cannot, so what would silently override the code
  // when wrong (routes, headings, requests, environments) is left out and the rest is kept for the reviewer to see.
  const readable = /^(text\/|application\/(json|xml|x-yaml|yaml))/.test(input.mimeType);
  const { workflow: normalized, dropped } = groundInDocument(language, readable ? Buffer.from(input.fileBase64, 'base64').toString('utf8') : null);

  // Privacy: the derived name/purpose/scope come back into our system, so scrub
  // them the same way free-text description input is scrubbed.
  const scrub = (value: string) =>
    value ? sanitizeAiInputFull(value).sanitizedText : value;

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
    })),
    requires: normalized.requires as FlowRequires | undefined,
    name: scrub(parsedFlow.name) || 'New Flow',
    purpose: scrub(parsedFlow.purpose),
    scopeStatement: scrub(parsedFlow.scopeStatement),
    provider: 'gemini',
    model: usedModel,
    promptHash,
    leftOut: dropped,
  };
}
