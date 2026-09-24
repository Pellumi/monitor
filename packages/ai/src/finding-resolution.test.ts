import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AIProvider } from './providers/base';
import { FINDING_RESOLUTION_PROMPT_VERSION, draftFindingResolutions, type FindingResolutionBundle } from './finding-resolution';

const bundle = (overrides: Partial<FindingResolutionBundle> = {}): FindingResolutionBundle => ({
  findingId: 'finding-1',
  title: 'GET /schools/<int:pk>/analytics/ returned 403',
  category: 'BACKEND_CLIENT_ERROR',
  severity: 'MEDIUM',
  description: 'The application\'s own server answered GET /schools/<int:pk>/analytics/ with 403.',
  recommendation: 'Check request validation, authorization and the contract this route publishes.',
  endpoint: { method: 'GET', route: '/schools/<int:pk>/analytics/' },
  occurrences: 1,
  requests: [{
    at: '2026-09-24T10:00:00.000Z', method: 'GET', route: '/schools/<int:pk>/analytics/', statusCode: 403, durationMs: 55,
    handler: 'SchoolAnalyticsView', framework: 'django', requestBytes: 0, responseBytes: 40, models: ['users_user'],
    responseBody: { detail: '[PROTECTED · 20 characters]' },
  }],
  errors: [],
  dataOperations: [{ model: 'users_user', operation: 'select', mutation: false, records: 1, count: 1 }],
  code: {
    refs: [{ id: 'ref1', role: 'handler', name: 'SchoolAnalyticsView', path: 'schools/views.py', startLine: 120, endLine: 168 }],
    authorization: ['IsSchoolAdmin'],
    workflow: ['SchoolAnalyticsView.get'],
    reads: ['users_user'],
    writes: [],
    tests: [],
    revision: 'abc123',
    matchesRun: true,
  },
  ...overrides,
});

const stub = (reply: unknown, name = 'gemini'): AIProvider => ({
  name,
  model: 'test-model',
  generateFlowDraft: async () => { throw new Error('not used'); },
  generateStructured: async <T>({ schema }: { schema: z.ZodType<T> }) => ({ data: schema.parse(reply), rawText: '', repaired: false }),
});

const failing = (): AIProvider => ({
  name: 'gemini',
  model: 'broken',
  generateFlowDraft: async () => { throw new Error('not used'); },
  generateStructured: async () => { throw new Error('PROVIDER_UNAVAILABLE'); },
});

const answer = (overrides: Record<string, unknown> = {}) => ({
  resolutions: [{
    findingId: 'finding-1',
    summary: 'The analytics view rejected the caller with a 403 before it read any data.',
    likelyCause: 'The IsSchoolAdmin permission refused this user, or the school in the path is not theirs.',
    steps: ['Confirm the caller holds the role IsSchoolAdmin requires.', 'Read SchoolAnalyticsView to see how the school is resolved.'],
    codeRefIds: ['ref1'],
    confidence: 0.9,
    ...overrides,
  }],
});

describe('draftFindingResolutions', () => {
  it('keeps a grounded answer and resolves code references from what the bundle offered', async () => {
    const result = await draftFindingResolutions([bundle()], { providers: [stub(answer())] });
    expect(result.resolutions).toHaveLength(1);
    const [resolution] = result.resolutions;
    expect(resolution.codeRefs.map((ref) => ref.path)).toEqual(['schools/views.py']);
    expect(resolution.promptVersion).toBe(FINDING_RESOLUTION_PROMPT_VERSION);
    expect(resolution.basis).toEqual({ requests: 1, dataOperations: 1, code: true });
    // Never more certain than the evidence beneath it.
    expect(resolution.confidence).toBe(0.85);
  });

  it('drops code references the model invented', async () => {
    const result = await draftFindingResolutions([bundle()], { providers: [stub(answer({ codeRefIds: ['ref1', 'ref9'] }))] });
    expect(result.resolutions[0].codeRefs.map((ref) => ref.id)).toEqual(['ref1']);
  });

  it('caps confidence lower when no code location was found', async () => {
    const generic = answer({
      summary: 'The server refused the caller with a 403 before it read any data.',
      likelyCause: 'The caller lacks permission for this school.',
      steps: ['Confirm which role the caller holds.'],
      codeRefIds: [],
    });
    const result = await draftFindingResolutions([bundle({ code: null })], { providers: [stub(generic)] });
    expect(result.resolutions[0].confidence).toBe(0.6);
    expect(result.resolutions[0].basis.code).toBe(false);
  });

  it('rejects prose that names a subject the evidence never mentioned', async () => {
    const result = await draftFindingResolutions([bundle()], {
      providers: [stub(answer({ summary: 'The gateway rejected it because PaymentGateway is misconfigured.' }))],
    });
    expect(result.resolutions).toHaveLength(0);
    expect(result.discarded).toBe(1);
  });

  it('returns nothing, and says why, when the provider is down', async () => {
    const result = await draftFindingResolutions([bundle()], { providers: [failing()] });
    expect(result.resolutions).toHaveLength(0);
    expect(result.unavailable).toBe('PROVIDER_UNAVAILABLE');
  });

  it('does nothing without a real provider', async () => {
    const result = await draftFindingResolutions([bundle()], { providers: [stub(answer(), 'mock')] });
    expect(result.resolutions).toHaveLength(0);
    expect(result.unavailable).toBe('provider_not_configured');
  });

  it('never sends a value that looks like a secret', async () => {
    let prompt = '';
    const spy: AIProvider = {
      name: 'gemini', model: 'm',
      generateFlowDraft: async () => { throw new Error('not used'); },
      generateStructured: async <T>(input: { prompt: string; schema: z.ZodType<T> }) => {
        prompt = input.prompt;
        return { data: input.schema.parse(answer()), rawText: '', repaired: false };
      },
    };
    await draftFindingResolutions([bundle({ requests: [{ ...bundle().requests[0], requestBody: { note: 'contact me at jane@example.com', auth: 'Bearer abcdefghijklmnop123456' } }] })], { providers: [spy] });
    expect(prompt).not.toContain('jane@example.com');
    expect(prompt).not.toContain('abcdefghijklmnop123456');
  });
});
