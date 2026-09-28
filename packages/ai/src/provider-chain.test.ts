import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AllProvidersFailedError, FallbackProvider, buildProviderChain, generateAiFlowDraft, resolveAiProvider } from './index';

const ENV = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'model-preferred' };

const validDraft = {
  domainKey: 'LMS', confidence: 0.8, assumptions: [], source: 'AI',
  workflows: [{
    key: 'LOGIN', name: 'Sign in',
    states: [{ name: 'GUEST', role: 'INITIAL' }, { name: 'LOGIN_PAGE' }, { name: 'DASHBOARD', role: 'TERMINAL', terminalKind: 'SUCCESS' }],
    transitions: [{ from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' }, { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'SUBMIT_CREDENTIALS' }],
  }],
};

/** A fetch that answers per model: `503` for an overloaded one, an object for a working one. */
function stubGemini(byModel: Record<string, 503 | 402 | object>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const model = JSON.parse(init.body).model as string;
    calls.push(model);
    const answer = byModel[model];
    if (typeof answer === 'number') {
      return new Response(JSON.stringify([{ error: { message: answer === 503 ? 'This model is currently experiencing high demand.' : 'Insufficient Balance' } }]), { status: answer });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Retry backoff is real time; skip it here, but leave the (much longer) request timeouts alone. */
function skipBackoff() {
  const realSetTimeout = globalThis.setTimeout;
  vi.stubGlobal('setTimeout', ((handler: () => void, ms?: number, ...rest: unknown[]) =>
    realSetTimeout(handler, (ms ?? 0) < 10_000 ? 0 : ms, ...rest)) as typeof setTimeout);
}

function useEnv(extra: Record<string, string> = {}) {
  skipBackoff();
  for (const [name, value] of Object.entries({ ...ENV, ...extra })) vi.stubEnv(name, value);
}

describe('provider chain', () => {
  it('lists the preferred Gemini model first, then its fallbacks, without repeats', () => {
    const chain = buildProviderChain({ ...ENV, GEMINI_FALLBACK_MODELS: 'model-b, model-preferred, model-c' });
    expect(chain.map((provider) => provider.model)).toEqual(['model-preferred', 'model-b', 'model-c']);
  });

  it('has a fallback model with no configuration at all', () => {
    expect(buildProviderChain(ENV).map((provider) => provider.model)).toEqual(['model-preferred', 'gemini-2.5-flash', 'gemini-flash-latest']);
  });

  it('is only the mock provider when nothing is configured', () => {
    expect(buildProviderChain({}).map((provider) => provider.name)).toEqual(['mock']);
    expect(resolveAiProvider({}).name).toBe('mock');
  });
});

describe('generateAiFlowDraft with an overloaded model', () => {
  it('answers from the fallback model when the preferred one is at capacity', async () => {
    useEnv({ GEMINI_MODEL: 'busy-1', GEMINI_FALLBACK_MODELS: 'fallback-1' });
    const calls = stubGemini({ 'busy-1': 503, 'fallback-1': validDraft });
    const result = await generateAiFlowDraft({ productDescription: 'admin signs in', domainKey: 'LMS', rulesets: [] });
    expect(result.model).toBe('fallback-1');
    expect(result.fallbackUsed).toBe(true);
    expect(calls).toContain('busy-1');
    expect(calls[calls.length - 1]).toBe('fallback-1');
  }, 20_000);

  it('says why every provider failed, using the providers own words', async () => {
    useEnv({ GEMINI_MODEL: 'busy-2', GEMINI_FALLBACK_MODELS: 'broke-2' });
    stubGemini({ 'busy-2': 503, 'broke-2': 402 });
    const error = await generateAiFlowDraft({ productDescription: 'x', domainKey: 'LMS', rulesets: [] }).catch((caught) => caught);
    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect((error as AllProvidersFailedError).attempts.map((attempt) => attempt.model)).toEqual(['busy-2', 'broke-2']);
    expect((error as AllProvidersFailedError).attempts[0].error).toMatch(/503.*high demand/);
    expect((error as AllProvidersFailedError).attempts[1].error).toMatch(/402.*Insufficient Balance/);
  }, 20_000);

  it('does not let one models failures close the circuit for the next', async () => {
    useEnv({ GEMINI_MODEL: 'model-tripped', GEMINI_FALLBACK_MODELS: 'model-healthy' });
    stubGemini({ 'model-tripped': 503, 'model-healthy': validDraft });
    // Enough failed requests to trip the preferred model's breaker.
    for (let run = 0; run < 3; run += 1) {
      const result = await generateAiFlowDraft({ productDescription: 'x', domainKey: 'LMS', rulesets: [] });
      expect(result.model).toBe('model-healthy');
    }
  }, 40_000);
});

describe('FallbackProvider', () => {
  it('returns the first answer and remembers who gave it', async () => {
    const schema = z.object({ ok: z.boolean() });
    const failing = { name: 'a', model: 'a-1', generateFlowDraft: vi.fn(), generateStructured: vi.fn().mockRejectedValue(new Error('gemini failed with 503')) };
    const working = { name: 'b', model: 'b-1', generateFlowDraft: vi.fn(), generateStructured: vi.fn().mockResolvedValue({ data: { ok: true }, rawText: '{}', repaired: false }) };
    const provider = new FallbackProvider([failing as any, working as any]);
    const result = await provider.generateStructured({ prompt: 'p', schema });
    expect(result.data).toEqual({ ok: true });
    expect(provider.lastUsed.model).toBe('b-1');
    expect(provider.model).toBe('a-1');
  });

  it('stops trying further models once the caller has aborted', async () => {
    const controller = new AbortController();
    const first = { name: 'a', model: 'a-1', generateFlowDraft: vi.fn(), generateStructured: vi.fn().mockImplementation(async () => { controller.abort(); throw new Error('aborted'); }) };
    const second = { name: 'b', model: 'b-1', generateFlowDraft: vi.fn(), generateStructured: vi.fn() };
    const provider = new FallbackProvider([first as any, second as any]);
    await expect(provider.generateStructured({ prompt: 'p', schema: z.object({}), signal: controller.signal })).rejects.toThrow('aborted');
    expect(second.generateStructured).not.toHaveBeenCalled();
  });
});
