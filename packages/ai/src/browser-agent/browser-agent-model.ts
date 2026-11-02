import crypto from 'crypto';
import type { ZodType } from 'zod';
import { estimateAiCost, estimateTokensFromText } from '../costs';
import { resolveAiProvider } from '../index';
import type { AIProvider } from '../providers/base';
import {
  buildDecidePrompt, buildDecideRepairPrompt,
  buildExplainFailurePrompt, buildExplainFailureRepairPrompt,
  buildPlanPrompt, buildPlanRepairPrompt,
} from './prompt';
import { ActionProposalSchema, FailureExplanationSchema, TestPlanSchema } from './schema';
import type { ActionProposal, DecisionContext, FailureContext, FailureExplanation, PlanningContext, TestPlan } from './schema';

/**
 * The Gemini-backed (or whatever `resolveAiProvider()` resolves to) implementation of the
 * autonomous QA run's three model questions: what to test (`plan`), what to do about a screen
 * the contract did not anticipate (`decide`), and why a step did not do what was expected
 * (`explainFailure`).
 *
 * Deliberately thin: all of the retry/circuit-breaker/JSON-repair/fallback behaviour already
 * lives in `AIProvider.generateStructured` (see `providers/json-http-provider.ts`). This module
 * only supplies the prompts, the response schemas, and the cost/latency telemetry every call
 * returns alongside its data — `@tellann/automation-engine` never imports this package directly;
 * `apps/desktop` wires it in behind a duck-typed port (mirroring `vision-resolver.ts`'s existing
 * pattern for the deterministic engine's `AmbiguityResolver`).
 */

export interface ModelCallTelemetry {
  provider: string;
  model: string;
  promptHash: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  repaired: boolean;
}

export interface BrowserAgentModel {
  plan(input: PlanningContext): Promise<{ data: TestPlan; telemetry: ModelCallTelemetry }>;
  decide(input: DecisionContext): Promise<{ data: ActionProposal; telemetry: ModelCallTelemetry }>;
  explainFailure(input: FailureContext): Promise<{ data: FailureExplanation; telemetry: ModelCallTelemetry }>;
}

export interface CreateBrowserAgentModelOptions {
  provider?: AIProvider;
  timeoutMs?: number;
}

async function callStructured<T>(
  provider: AIProvider,
  prompt: string,
  // `any, any` rather than `ZodType<T>`: a schema with `.default()` fields has an Output type
  // narrower than its Input type, which `ZodType<T>` (Input defaulted to T) rejects on assignment
  // even though inference from the argument itself is exactly what every caller below relies on.
  schema: ZodType<T, any, any>,
  repairPrompt: (invalidText: string, errors: string) => string,
  timeoutMs: number | undefined,
): Promise<{ data: T; telemetry: ModelCallTelemetry }> {
  const startedAt = Date.now();
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
  const result = await provider.generateStructured<T>({ prompt, schema, repairPrompt, timeoutMs });
  const inputTokens = estimateTokensFromText(prompt);
  const outputTokens = estimateTokensFromText(result.rawText);
  const cost = estimateAiCost({ provider: provider.name, model: provider.model, inputTokens, outputTokens });
  return {
    data: result.data,
    telemetry: {
      provider: provider.name,
      model: provider.model,
      promptHash,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost.estimatedCostUsd,
      latencyMs: Date.now() - startedAt,
      repaired: result.repaired,
    },
  };
}

export function createBrowserAgentModel(options: CreateBrowserAgentModelOptions = {}): BrowserAgentModel {
  const provider = options.provider ?? resolveAiProvider();
  const timeoutMs = options.timeoutMs;

  return {
    async plan(input) {
      const result = await callStructured(provider, buildPlanPrompt(input), TestPlanSchema, buildPlanRepairPrompt, timeoutMs);
      return result as { data: TestPlan; telemetry: ModelCallTelemetry };
    },
    async decide(input) {
      const result = await callStructured(provider, buildDecidePrompt(input), ActionProposalSchema, buildDecideRepairPrompt, timeoutMs);
      return result as { data: ActionProposal; telemetry: ModelCallTelemetry };
    },
    async explainFailure(input) {
      const result = await callStructured(provider, buildExplainFailurePrompt(input), FailureExplanationSchema, buildExplainFailureRepairPrompt, timeoutMs);
      return result as { data: FailureExplanation; telemetry: ModelCallTelemetry };
    },
  };
}
