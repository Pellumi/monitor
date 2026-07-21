import { ZodType, ZodError } from 'zod';
import { FlowDraftSchema } from '../schemas';
import { AIProvider, GenerateFlowInput, GenerateStructuredInput, StructuredGenerationResult } from './base';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

class FetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.random() * ms * 0.3;
}

// ─────────────────────────────────────────────────────────────
// JSON extraction helpers (Phase 5)
// ─────────────────────────────────────────────────────────────

/**
 * Attempts to extract and parse JSON from a raw LLM response string.
 * Handles markdown fences, leading/trailing prose, and partial objects.
 */
export function extractJson(raw: string): unknown {
  if (typeof raw !== 'string') return raw;

  // 1. Strip markdown code fences
  let cleaned = raw
    .replace(/```json\s*([\s\S]*?)\s*```/g, '$1')
    .replace(/```\s*([\s\S]*?)\s*```/g, '$1')
    .trim();

  // 2. Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // 3. Find the first { or [ and attempt to extract from there
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace <= firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    const substring = cleaned.slice(startIdx);
    // Find matching close — try progressively smaller substrings
    for (let end = substring.length; end > 0; end--) {
      try {
        return JSON.parse(substring.slice(0, end));
      } catch (_) {
        // continue shrinking
      }
    }
  }

  // 4. Try loose JSON (single quotes, trailing commas) — very basic normalization
  try {
    const normalized = cleaned
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1') // trailing commas
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys
    return JSON.parse(normalized);
  } catch (_) {
    // fall through
  }

  throw new SyntaxError('Could not extract valid JSON from LLM response');
}

// ─────────────────────────────────────────────────────────────
// Circuit breaker (per-provider, in-process)
// ─────────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const circuitMap = new Map<string, CircuitState>();
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 2 * 60 * 1000; // 2 minutes

function getCircuit(name: string): CircuitState {
  if (!circuitMap.has(name)) circuitMap.set(name, { failures: 0, openedAt: null });
  return circuitMap.get(name)!;
}

function isCircuitOpen(name: string): boolean {
  const state = getCircuit(name);
  if (state.openedAt === null) return false;
  if (Date.now() - state.openedAt >= CIRCUIT_RESET_MS) {
    state.openedAt = null;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordSuccess(name: string): void {
  const state = getCircuit(name);
  state.failures = 0;
  state.openedAt = null;
}

function recordFailure(name: string): void {
  const state = getCircuit(name);
  state.failures += 1;
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
    console.warn(`[CircuitBreaker] Circuit opened for provider: ${name}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export interface JsonHttpProviderOptions {
  /** Request timeout in milliseconds (default: 15 000) */
  timeoutMs?: number;
  /** Enable JSON repair prompt on parse/validation failure (default: env AI_JSON_REPAIR_ENABLED) */
  enableRepair?: boolean;
  /** Repair request timeout in milliseconds (default: 20 000) */
  repairTimeoutMs?: number;
}

export interface FlowDraftWithMeta {
  draft: ReturnType<typeof FlowDraftSchema.parse>;
  rawText: string;
  repaired: boolean;
  repairAttempted: boolean;
  repairSucceeded: boolean;
  originalValidationError?: string;
  repairedValidationError?: string;
}

export class JsonHttpProvider implements AIProvider {
  readonly timeoutMs: number;
  private readonly enableRepair: boolean;
  private readonly repairTimeoutMs: number;

  constructor(
    public name: 'gemini' | 'deepseek',
    public model: string,
    private readonly endpoint: string,
    private readonly apiKey: string,
    options?: JsonHttpProviderOptions,
  ) {
    this.timeoutMs = options?.timeoutMs ?? 15_000;
    this.enableRepair =
      options?.enableRepair ?? String(process.env.AI_JSON_REPAIR_ENABLED).toLowerCase() !== 'false';
    this.repairTimeoutMs = options?.repairTimeoutMs ?? 20_000;
  }

  // ─────────────────────────────────────────────────────────────
  // Public: generateFlowDraft
  // ─────────────────────────────────────────────────────────────

  async generateFlowDraft(input: GenerateFlowInput): Promise<ReturnType<typeof FlowDraftSchema.parse>> {
    const result = await this.generateFlowDraftWithMeta(input);
    return result.draft;
  }

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>> {
    if (isCircuitOpen(this.name)) throw new Error(`CIRCUIT_OPEN:${this.name}`);
    const timeoutMs = input.timeoutMs ?? this.timeoutMs;
    let lastError: unknown;
    let invalidText = '';

    for (const delay of [0, 500, 1500]) {
      if (delay) await sleep(jitter(delay));
      const controller = new AbortController();
      const abort = () => controller.abort();
      input.signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        invalidText = await this.callStructuredPrompt(input.prompt, controller.signal);
        const data = input.schema.parse(extractJson(invalidText));
        recordSuccess(this.name);
        return { data, rawText: invalidText, repaired: false };
      } catch (error) {
        lastError = error;
        if (input.repairPrompt && invalidText && !(error instanceof FetchError)) {
          try {
            const details = error instanceof Error ? error.message : String(error);
            const repairedText = await this.callStructuredPrompt(input.repairPrompt(invalidText, details), controller.signal);
            const data = input.schema.parse(extractJson(repairedText));
            recordSuccess(this.name);
            return { data, rawText: repairedText, repaired: true };
          } catch (repairError) {
            lastError = repairError;
          }
        }
        recordFailure(this.name);
        if (!(error instanceof FetchError) || !RETRYABLE_STATUS_CODES.has(error.status)) break;
      } finally {
        clearTimeout(timeout);
        input.signal?.removeEventListener('abort', abort);
      }
    }
    throw lastError ?? new Error(`${this.name} structured generation failed`);
  }

  private async callStructuredPrompt(prompt: string, signal: AbortSignal): Promise<string> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
      signal,
    });
    if (!res.ok) throw new FetchError(`${this.name} provider failed with ${res.status}`, res.status);
    const payload = await res.json() as any;
    return payload?.choices?.[0]?.message?.content ?? payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? payload?.text ?? JSON.stringify(payload);
  }

  /**
   * Full result including repair metadata.
   * Used by generateAiFlowDraft() to record repaired/fallbackUsed in AI logs.
   */
  async generateFlowDraftWithMeta(input: GenerateFlowInput): Promise<FlowDraftWithMeta> {
    if (isCircuitOpen(this.name)) {
      throw new Error(`CIRCUIT_OPEN:${this.name}`);
    }

    const maxRetries = 3;
    const retryDelays = [0, 500, 1500];
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0 && retryDelays[attempt]) {
        await sleep(jitter(retryDelays[attempt]));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: input.prompt }],
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const fetchErr = new FetchError(`${this.name} provider failed with ${res.status}`, res.status);
          if (RETRYABLE_STATUS_CODES.has(res.status)) {
            lastError = fetchErr;
            recordFailure(this.name);
            continue;
          }
          recordFailure(this.name);
          throw fetchErr;
        }

        const payload = await res.json() as any;
        const rawText: string =
          payload?.choices?.[0]?.message?.content ??
          payload?.candidates?.[0]?.content?.parts?.[0]?.text ??
          payload?.text ??
          JSON.stringify(payload);

        // Phase 5: Try JSON extraction + validation, repair if needed
        const result = await this.parseWithRepair(rawText, input);

        recordSuccess(this.name);
        return result;
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof DOMException && err.name === 'AbortError') {
          lastError = new Error(`TIMEOUT:${this.name} request timed out after ${this.timeoutMs}ms`);
          recordFailure(this.name);
          continue;
        }

        if (err instanceof FetchError && RETRYABLE_STATUS_CODES.has(err.status)) {
          lastError = err;
          continue;
        }

        // Parse/validation errors are not retried — fail immediately
        if (err instanceof SyntaxError || err instanceof ZodError) {
          recordFailure(this.name);
          throw err;
        }

        recordFailure(this.name);
        throw err;
      }
    }

    recordFailure(this.name);
    throw lastError ?? new Error(`${this.name} provider failed after ${maxRetries} attempts`);
  }

  // ─────────────────────────────────────────────────────────────
  // Private: Phase 5 — Parse with repair
  // ─────────────────────────────────────────────────────────────

  private async parseWithRepair(rawText: string, input: GenerateFlowInput): Promise<FlowDraftWithMeta> {
    // Step 1: Direct extraction + parse
    let parsed: unknown;
    let extractionError: string | undefined;

    try {
      parsed = extractJson(rawText);
    } catch (err) {
      extractionError = err instanceof Error ? err.message : String(err);
    }

    // Step 2: Zod validation
    if (parsed !== undefined) {
      const zodResult = FlowDraftSchema.safeParse(parsed);
      if (zodResult.success) {
        return {
          draft: zodResult.data,
          rawText,
          repaired: false,
          repairAttempted: false,
          repairSucceeded: false,
        };
      }
      extractionError = zodResult.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
    }

    // Step 3: Attempt repair (one try only)
    if (!this.enableRepair) {
      throw new Error(`AI_JSON_INVALID: ${extractionError}`);
    }

    console.warn(`[AI:${this.name}] JSON invalid, attempting repair. Error: ${extractionError}`);

    let repairedText: string | undefined;
    let repairValidationError: string | undefined;

    try {
      repairedText = await this.callRepairPrompt(rawText, extractionError ?? 'Unknown parse error', input);
      const repairedParsed = extractJson(repairedText);
      const repairedResult = FlowDraftSchema.safeParse(repairedParsed);

      if (repairedResult.success) {
        console.log(`[AI:${this.name}] Repair succeeded`);
        return {
          draft: repairedResult.data,
          rawText: repairedText,
          repaired: true,
          repairAttempted: true,
          repairSucceeded: true,
          originalValidationError: extractionError,
          repairedValidationError: undefined,
        };
      }

      repairValidationError = repairedResult.error.issues
        .map((i: import('zod').ZodIssue) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');

      console.warn(`[AI:${this.name}] Repair produced invalid JSON: ${repairValidationError}`);
    } catch (repairErr) {
      repairValidationError = repairErr instanceof Error ? repairErr.message : String(repairErr);
      console.error(`[AI:${this.name}] Repair call failed: ${repairValidationError}`);
    }

    // Repair failed — throw so caller can use rule-based fallback
    const repairError = new Error('AI_JSON_REPAIR_FAILED');
    (repairError as any).code = 'AI_JSON_REPAIR_FAILED';
    (repairError as any).originalValidationError = extractionError;
    (repairError as any).repairedValidationError = repairValidationError;
    throw repairError;
  }

  // ─────────────────────────────────────────────────────────────
  // Private: Repair prompt call
  // ─────────────────────────────────────────────────────────────

  private async callRepairPrompt(
    invalidJson: string,
    validationErrors: string,
    _input: GenerateFlowInput,
  ): Promise<string> {
    const repairPrompt = buildRepairPrompt(invalidJson, validationErrors);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.repairTimeoutMs);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: repairPrompt }],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Repair call failed with HTTP ${res.status}`);
      }

      const payload = await res.json() as any;
      return (
        payload?.choices?.[0]?.message?.content ??
        payload?.candidates?.[0]?.content?.parts?.[0]?.text ??
        payload?.text ??
        JSON.stringify(payload)
      );
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Repair prompt builder
// ─────────────────────────────────────────────────────────────

function buildRepairPrompt(invalidJson: string, validationErrors: string): string {
  // Truncate if very large to avoid token explosion
  const truncated = invalidJson.length > 8000
    ? invalidJson.slice(0, 8000) + '\n...[truncated]'
    : invalidJson;

  return [
    'You are a JSON repair service.',
    'Return ONLY valid JSON. No explanation. No markdown. No commentary.',
    'Preserve the intended data structure.',
    'Conform exactly to the schema below.',
    '',
    'REQUIRED SCHEMA SUMMARY:',
    '  { domainKey: string, confidence: number (0-1), assumptions: string[],',
    '    workflows: [{ key: string, name: string, states: [{ name: string, category: "NAVIGATION"|"UI"|"BUSINESS"|"ERROR"|"SYSTEM" }],',
    '               transitions: [{ from: string, to: string, action?: string }] }],',
    '    missingFlowCandidates: [], missingStateCandidates: [], suggestions: [],',
    '    source: "RULE_ENGINE"|"AI"|"HYBRID" }',
    '',
    'VALIDATION ERRORS:',
    validationErrors,
    '',
    'INVALID JSON TO REPAIR:',
    truncated,
  ].join('\n');
}
