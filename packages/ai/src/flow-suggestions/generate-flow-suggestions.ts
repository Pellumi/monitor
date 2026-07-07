import crypto from 'crypto';
import { buildFlowSuggestionsPrompt, buildFlowSuggestionsRepairPrompt } from './prompt';
import { mergeSuggestions } from './merge-suggestions';
import {
  AIFlowSuggestionResponseSchema,
  AIFlowSuggestionItem,
  FlowSuggestionsInput,
  FlowSuggestionsResult,
} from './schema';
import { extractJson } from '../providers/json-http-provider';
import { resolveAiProvider } from '../index';
import { AIProvider } from '../providers/base';
import { JsonHttpProvider } from '../providers/json-http-provider';

// ─────────────────────────────────────────────────────────────
// Main entry point: generateFlowSuggestions
//
// Pipeline:
//   1. Rule-based suggestions (already computed by caller)
//   2. Optional AI suggestions (via env flag)
//   3. Merge + deduplicate
//   4. Confidence blending
//   5. Return unified list with source labels
// ─────────────────────────────────────────────────────────────

export async function generateFlowSuggestions(
  input: FlowSuggestionsInput,
  options?: {
    provider?: AIProvider;
    /** If false, skip AI call (only rule-based) — default from AI_FLOW_SUGGESTIONS_ENABLED env */
    enableAi?: boolean;
    /** Timeout for AI call in ms */
    timeoutMs?: number;
  },
): Promise<FlowSuggestionsResult> {
  const startedAt = Date.now();

  const aiEnabled =
    options?.enableAi ??
    String(process.env.AI_FLOW_SUGGESTIONS_ENABLED ?? '').toLowerCase() === 'true';

  // If AI is disabled or not configured, return rule-based only
  if (!aiEnabled) {
    const merged = mergeSuggestions({
      ruleSuggestions: input.existingRuleSuggestions,
      aiSuggestions: [],
    });
    return {
      suggestions: merged,
      aiCalled: false,
      aiRepaired: false,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Build prompt
  const prompt = buildFlowSuggestionsPrompt({
    applicationDomain: input.applicationDomain,
    declaredFlows: input.declaredFlows,
    observedGraphSummary: input.observedGraphSummary,
    existingRuleSuggestions: input.existingRuleSuggestions,
    userDefinedGoals: input.userDefinedGoals,
  });

  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

  // Resolve provider
  const provider = options?.provider ?? resolveAiProvider();
  let aiSuggestions: AIFlowSuggestionItem[] = [];
  let aiCalled = false;
  let aiRepaired = false;
  let fallbackUsed = false;

  try {
    aiCalled = true;

    // Call provider with timeout
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let rawText: string;

    try {
      const requestBody = {
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      };

      // Access internals via provider instance cast
      const httpProvider = provider instanceof JsonHttpProvider ? provider : null;
      if (!httpProvider) {
        // MockProvider or similar — ask it to generate a flow draft and ignore (suggestions not supported)
        throw new Error('PROVIDER_NOT_SUPPORTED_FOR_SUGGESTIONS');
      }

      // Make the HTTP call directly (reuse the same endpoint/auth as the main provider)
      const res = await (httpProvider as any)['callSuggestionsEndpoint']?.(prompt, controller.signal) as Response | undefined;

      if (res) {
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
        const payload = await res.json() as any;
        rawText = payload?.choices?.[0]?.message?.content ?? payload?.text ?? JSON.stringify(payload);
      } else {
        // No direct suggestions endpoint — use the internal fetch method pattern
        clearTimeout(timeout);
        throw new Error('PROVIDER_NOT_SUPPORTED_FOR_SUGGESTIONS');
      }
    } catch (providerErr) {
      clearTimeout(timeout);
      throw providerErr;
    }

    // Parse + validate
    const { suggestions: parsed, repaired } = await parseWithRepair(rawText, provider);
    aiSuggestions = parsed;
    aiRepaired = repaired;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUnsupported = msg.includes('NOT_SUPPORTED_FOR_SUGGESTIONS');

    if (!isUnsupported) {
      console.warn('[FlowSuggestions] AI call failed, using rule-based only:', msg);
    }
    fallbackUsed = !isUnsupported;
    aiCalled = !isUnsupported;
  }

  // Merge rule + AI suggestions
  const merged = mergeSuggestions({
    ruleSuggestions: input.existingRuleSuggestions,
    aiSuggestions,
  });

  return {
    suggestions: merged,
    aiCalled,
    aiRepaired,
    fallbackUsed,
    provider: provider.name,
    model: provider.model,
    promptHash,
    latencyMs: Date.now() - startedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Internal: parse + repair
// ─────────────────────────────────────────────────────────────

async function parseWithRepair(
  rawText: string,
  _provider: AIProvider,
): Promise<{ suggestions: AIFlowSuggestionItem[]; repaired: boolean }> {
  let parsed: unknown;
  let parseError: string | undefined;

  try {
    parsed = extractJson(rawText);
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  if (parsed !== undefined) {
    const result = AIFlowSuggestionResponseSchema.safeParse(parsed);
    if (result.success) {
      return { suggestions: result.data.suggestions, repaired: false };
    }
    parseError = result.error.issues
      .slice(0, 5)
      .map((i: import('zod').ZodIssue) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
  }

  // JSON repair is not supported for suggestions via a second API call here
  // (to keep the flow suggestions path lightweight — repair is for the main flow draft).
  // Instead, try a lenient extraction: look for a suggestions array anywhere in the text.
  const lenientMatch = rawText.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
  if (lenientMatch) {
    try {
      const lenient = JSON.parse(`{"suggestions":[${lenientMatch[1]}]}`);
      const lenientResult = AIFlowSuggestionResponseSchema.safeParse(lenient);
      if (lenientResult.success && lenientResult.data.suggestions.length > 0) {
        return { suggestions: lenientResult.data.suggestions, repaired: true };
      }
    } catch (_) {
      // fall through
    }
  }

  console.warn(`[FlowSuggestions] Could not parse AI response: ${parseError}`);
  return { suggestions: [], repaired: false };
}
