import { createBrowserAgentModel, resolveAiProvider } from "@tellann/ai";
import type { AIProvider } from "@tellann/ai";
import type { AmbiguityResolver, AutonomousModelPort } from "@tellann/automation-engine";
import { createVisionResolver } from "./vision-resolver";

/**
 * Bridges `@tellann/ai`'s Gemini-backed `BrowserAgentModel` into the two engine-side ports that
 * need it, following `vision-resolver.ts`'s existing duck-typed pattern: neither
 * `@tellann/automation-engine` nor the deterministic engine's `AmbiguityResolver` contract ever
 * imports `@tellann/ai` directly — only this adapter does, which is what keeps the engine's own
 * test suite network-free.
 */

export interface BrowserAgentAdapterOptions {
  provider?: AIProvider;
  timeoutMs?: number;
}

/** The autonomous sequencer's model port, for the undeclared-screen fallback and failure explanations. */
export function createAutonomousModelPort(options: BrowserAgentAdapterOptions = {}): AutonomousModelPort {
  const model = createBrowserAgentModel(options);
  return {
    async decide(input) {
      const { data } = await model.decide(input);
      return { proposal: data };
    },
    async explainFailure(input) {
      const { data } = await model.explainFailure(input);
      return { explanation: data };
    },
  };
}

/**
 * Finally wires a real resolver into the deterministic engine's assisted tie-breaking.
 *
 * `AutomatedRunManager` has had an optional `deps.resolver` slot since tie-breaking was built, but
 * nothing in `main.ts` ever supplied one — so a run with `assistedTieBreaking` turned on behaved
 * exactly like one with it off. Passing the result of this into that slot is what makes the
 * setting do what it has always claimed to. It changes nothing about how a suggestion is
 * accepted: `verifyControlProposal`/`verifyStateProposal` still verify every answer against the
 * contract, unchanged.
 */
export function createGeminiAmbiguityResolver(options: BrowserAgentAdapterOptions = {}): AmbiguityResolver {
  return createVisionResolver({
    asker: options.provider ?? resolveAiProvider(),
    locality: "CLOUD",
    timeoutMs: options.timeoutMs,
  });
}
