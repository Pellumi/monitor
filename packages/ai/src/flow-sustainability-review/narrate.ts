import crypto from 'crypto';
import { buildFlowNarrationPrompt, buildFlowNarrationRepairPrompt } from './prompt';
import { FlowNarrationResponseSchema, type FlowNarrationInput, type FlowNarrationResult } from './schema';
import { resolveAiProvider } from '../index';
import type { AIProvider } from '../providers/base';

/**
 * The AI-judgment half of a pre-publish Flow Sustainability Review (criterion 1 and 4): asks
 * a model to narrate the declared Flow using only its own vocabulary, and to state its
 * business purpose. One call answers both — they are the same underlying question ("does
 * this graph read clearly on its own?") asked from two angles, so a second round trip would
 * only double the latency and cost for no new evidence.
 *
 * Mirrors `generateFlowSuggestions`'s shape (env-gated, provider chain, JSON repair) so a
 * caller already familiar with that module recognises this one.
 */
export async function generateFlowNarration(
  input: FlowNarrationInput,
  options?: {
    provider?: AIProvider;
    enableAi?: boolean;
    timeoutMs?: number;
  },
): Promise<FlowNarrationResult> {
  const startedAt = Date.now();
  const aiEnabled = options?.enableAi ?? true;

  if (!aiEnabled) {
    return { narration: null, aiCalled: false, aiRepaired: false, fallbackUsed: false, latencyMs: Date.now() - startedAt };
  }

  const prompt = buildFlowNarrationPrompt(input);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  const provider = options?.provider ?? resolveAiProvider();

  try {
    const generated = await provider.generateStructured({
      prompt,
      schema: FlowNarrationResponseSchema,
      timeoutMs: options?.timeoutMs ?? 15_000,
      repairPrompt: buildFlowNarrationRepairPrompt,
    });
    return {
      // `.default([])` leaves the parsed type's array fields formally optional at this call
      // site (a zod quirk `generateFlowSuggestions` works around the same way for its `evidence` field).
      narration: {
        ...generated.data,
        hedges: generated.data.hedges ?? [],
        ambiguousIdentifiers: generated.data.ambiguousIdentifiers ?? [],
      },
      aiCalled: true, aiRepaired: generated.repaired, fallbackUsed: false,
      provider: provider.name, model: provider.model, promptHash, latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    console.warn('[FlowSustainabilityReview] Narration call failed:', err instanceof Error ? err.message : String(err));
    return {
      narration: null, aiCalled: true, aiRepaired: false, fallbackUsed: true,
      provider: provider.name, model: provider.model, promptHash, latencyMs: Date.now() - startedAt,
    };
  }
}
