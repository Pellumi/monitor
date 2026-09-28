import { AIFlowDraft } from '../schemas';
import { AIProvider, GenerateFlowInput, GenerateStructuredInput, StructuredGenerationResult } from './base';

/** One provider's failure inside a fallback run, kept so the caller can explain it. */
export interface ProviderAttempt {
  provider: string;
  model: string;
  error: string;
}

/** Every provider in a fallback run failed. `attempts` says how each one did. */
export class AllProvidersFailedError extends Error {
  readonly code = 'AI_ALL_PROVIDERS_FAILED';
  constructor(readonly attempts: ProviderAttempt[]) {
    super(`AI_ALL_PROVIDERS_FAILED: ${attempts.map((attempt) => `${attempt.provider}/${attempt.model}: ${attempt.error}`).join(' | ')}`);
    this.name = 'AllProvidersFailedError';
  }
}

export function describeProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { code?: unknown })?.code ?? error);
  return message.startsWith('CIRCUIT_OPEN:') ? 'circuit open after repeated failures' : message.slice(0, 240);
}

/**
 * Tries each provider in order and returns the first answer. Presents as the
 * preferred provider, so callers that log `name`/`model` keep working; `lastUsed`
 * says who actually answered.
 */
export class FallbackProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  lastUsed: AIProvider;

  constructor(private readonly providers: AIProvider[]) {
    if (!providers.length) throw new Error('FallbackProvider needs at least one provider');
    this.name = providers[0].name;
    this.model = providers[0].model;
    this.lastUsed = providers[0];
  }

  generateFlowDraft(input: GenerateFlowInput): Promise<AIFlowDraft> {
    return this.firstAnswer((provider) => provider.generateFlowDraft(input));
  }

  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>> {
    return this.firstAnswer((provider) => provider.generateStructured(input), input.signal);
  }

  private async firstAnswer<T>(run: (provider: AIProvider) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const attempts: ProviderAttempt[] = [];
    for (const provider of this.providers) {
      try {
        const answer = await run(provider);
        this.lastUsed = provider;
        return answer;
      } catch (error) {
        // The caller gave up; trying the next model would only waste its money.
        if (signal?.aborted) throw error;
        attempts.push({ provider: provider.name, model: provider.model, error: describeProviderError(error) });
        console.warn(`[AI] ${provider.name}/${provider.model} failed: ${attempts[attempts.length - 1].error}`);
      }
    }
    throw new AllProvidersFailedError(attempts);
  }
}
