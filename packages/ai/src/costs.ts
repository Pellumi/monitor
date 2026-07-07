// ─────────────────────────────────────────────────────────────
// AI Cost Estimation
//
// Prices are configurable via environment variables.
// Fallback to approximate public pricing if not set.
// ─────────────────────────────────────────────────────────────

export interface CostEstimateInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CostEstimateResult {
  estimatedCostUsd: number;
  inputCostUsd: number;
  outputCostUsd: number;
  /** Price per 1M input tokens used */
  inputPricePer1M: number;
  /** Price per 1M output tokens used */
  outputPricePer1M: number;
}

/**
 * Read price-per-1M-tokens from environment, with a fallback default.
 */
function getPricePerMillion(envKey: string, fallbackUsd: number): number {
  const raw = process.env[envKey];
  if (raw) {
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return fallbackUsd;
}

/**
 * Approximate public pricing defaults (USD per 1M tokens).
 * These should be overridden via environment variables in production.
 */
const DEFAULTS: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 3.50, output: 10.50 },
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

function getDefaultPrice(provider: string, model: string): { input: number; output: number } {
  if (DEFAULTS[model]) return DEFAULTS[model];
  // Fallback by provider
  if (provider === 'gemini') return { input: 0.075, output: 0.30 };
  if (provider === 'deepseek') return { input: 0.27, output: 1.10 };
  return { input: 0.001, output: 0.002 };
}

/**
 * Estimates the cost in USD for an AI invocation.
 *
 * Configure via env:
 *   AI_GEMINI_INPUT_COST_PER_1M
 *   AI_GEMINI_OUTPUT_COST_PER_1M
 *   AI_DEEPSEEK_INPUT_COST_PER_1M
 *   AI_DEEPSEEK_OUTPUT_COST_PER_1M
 */
export function estimateAiCost(input: CostEstimateInput): CostEstimateResult {
  const defaults = getDefaultPrice(input.provider, input.model);

  let inputPricePer1M: number;
  let outputPricePer1M: number;

  if (input.provider === 'gemini') {
    inputPricePer1M = getPricePerMillion('AI_GEMINI_INPUT_COST_PER_1M', defaults.input);
    outputPricePer1M = getPricePerMillion('AI_GEMINI_OUTPUT_COST_PER_1M', defaults.output);
  } else if (input.provider === 'deepseek') {
    inputPricePer1M = getPricePerMillion('AI_DEEPSEEK_INPUT_COST_PER_1M', defaults.input);
    outputPricePer1M = getPricePerMillion('AI_DEEPSEEK_OUTPUT_COST_PER_1M', defaults.output);
  } else {
    inputPricePer1M = defaults.input;
    outputPricePer1M = defaults.output;
  }

  const inputCostUsd = (input.inputTokens / 1_000_000) * inputPricePer1M;
  const outputCostUsd = (input.outputTokens / 1_000_000) * outputPricePer1M;

  return {
    estimatedCostUsd: inputCostUsd + outputCostUsd,
    inputCostUsd,
    outputCostUsd,
    inputPricePer1M,
    outputPricePer1M,
  };
}

/**
 * Rough token count estimation from text (4 chars ≈ 1 token).
 * Use only when the provider doesn't return token counts.
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}
