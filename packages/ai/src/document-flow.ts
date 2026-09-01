import crypto from 'crypto';
import { z } from 'zod';
import { sanitizeAiInputFull } from './privacy/sanitize-ai-input';

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
});

export const DocumentFlowTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  action: z.string().optional(),
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
});

export type DocumentFlow = z.infer<typeof DocumentFlowSchema>;

export interface DocumentFlowResult extends DocumentFlow {
  provider: string;
  model: string;
  promptHash: string;
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
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['name', 'states', 'transitions'],
} as const;

function buildPrompt(filename: string): string {
  return [
    'You are a product analyst. The attached document describes a software product or a feature of one.',
    `Filename: ${filename}`,
    '',
    'Extract ONE focused user-facing flow (a bounded capability such as checkout, sign-up, password reset, course enrolment — not the entire product) as a finite state machine.',
    '',
    'Rules:',
    '- STATE names: SCREAMING_SNAKE_CASE, concise, describe a stable situation the user/system is in (e.g. CART_REVIEW, PAYMENT_PENDING, ORDER_CONFIRMED).',
    '- Exactly one state has role "INITIAL". At least one state has role "TERMINAL" with a terminalKind.',
    '- category: NAVIGATION | UI | BUSINESS | ERROR | SYSTEM.',
    '- TRANSITIONS connect state names that appear in "states". "action" is an optional short verb phrase (e.g. SUBMIT_PAYMENT).',
    '- Include the obvious error/failure branch if the document implies one.',
    '- 4–14 states is typical. Do not invent requirements that are not supported by the document.',
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
  const model = env.GEMINI_MULTIMODAL_MODEL || 'gemini-2.5-flash';
  const base =
    env.GEMINI_GENERATE_CONTENT_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models';
  return { apiKey, model, url: `${base}/${model}:generateContent` };
}

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

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 60_000,
  );

  let payload: any;
  try {
    const res = await fetch(`${gemini.url}?key=${gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.fileBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `DOCUMENT_FLOW_PROVIDER_ERROR:${res.status}:${detail.slice(0, 300)}`,
      );
    }
    payload = await res.json();
  } finally {
    clearTimeout(timeout);
  }

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

  const flow = DocumentFlowSchema.parse(parsed);

  // Guardrail: strip transitions that reference unknown states, and make sure
  // there is exactly one INITIAL state.
  const names = new Set(flow.states.map((s) => s.name));
  flow.transitions = flow.transitions.filter(
    (t) => names.has(t.from) && names.has(t.to),
  );
  const initials = flow.states.filter((s) => s.role === 'INITIAL');
  if (initials.length === 0 && flow.states[0]) flow.states[0].role = 'INITIAL';
  if (initials.length > 1) {
    let seen = false;
    for (const s of flow.states) {
      if (s.role !== 'INITIAL') continue;
      if (seen) s.role = 'NORMAL';
      seen = true;
    }
  }
  for (const s of flow.states) {
    if (s.role === 'TERMINAL' && !s.terminalKind) s.terminalKind = 'SUCCESS';
    if (s.role !== 'TERMINAL') s.terminalKind = null;
  }

  // Privacy: the derived name/purpose/scope come back into our system, so scrub
  // them the same way free-text description input is scrubbed.
  const scrub = (value: string) =>
    value ? sanitizeAiInputFull(value).sanitizedText : value;

  return {
    ...flow,
    name: scrub(flow.name) || 'New Flow',
    purpose: scrub(flow.purpose),
    scopeStatement: scrub(flow.scopeStatement),
    provider: 'gemini',
    model: gemini.model,
    promptHash,
  };
}
