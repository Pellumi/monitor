import { afterEach, describe, expect, it, vi } from 'vitest';
import { decomposeDocumentIntoFlows, generateFlowFromDocument } from './document-flow';

const ENV = { GEMINI_API_KEY: 'test-key' };

function geminiResponse(data: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }), { status: 200 });
}

function isMultimodalCall(body: any): boolean {
  return Array.isArray(body?.contents?.[0]?.parts) && body.contents[0].parts.some((part: any) => part.inline_data);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function useEnv(extra: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({ ...ENV, ...extra })) vi.stubEnv(name, value);
}

const DOCUMENT_TEXT = [
  'Upload your notes to get started.',
  'How prepared are you? Options: I am completely blank, I know a little bit, I am mostly confident.',
  'They click "Lock in now" to continue.',
  'It does not actually generate anything until their payment is confirmed.',
  'If exam date is less than 2 days away, show an emergency plan message. Otherwise, show a normal plan message.',
].join(' ');

const DRAFT = {
  name: 'Confidence check',
  purpose: 'Capture how prepared the student feels.',
  scopeStatement: 'UPLOAD_PAGE to CONFIDENCE_PAGE',
  workflowType: 'CUSTOM',
  states: [
    { name: 'UPLOAD_PAGE', category: 'NAVIGATION', role: 'INITIAL', evidence: 'Upload your notes' },
    { name: 'CONFIDENCE_PAGE', category: 'UI', role: 'TERMINAL', terminalKind: 'SUCCESS', evidence: 'How prepared are you' },
    { name: 'BILLING_PORTAL', category: 'NAVIGATION', role: 'NORMAL', evidence: 'the billing portal subscription page' },
  ],
  transitions: [
    { from: 'UPLOAD_PAGE', to: 'CONFIDENCE_PAGE', action: 'CLICK_LOCK_IN', evidence: 'Lock in now' },
    { from: 'CONFIDENCE_PAGE', to: 'BILLING_PORTAL', action: 'OPEN_BILLING', evidence: 'manage your billing details' },
  ],
};

describe('generateFlowFromDocument with real document text', () => {
  it('keeps a state/transition whose evidence is written, and drops one that is invented', async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (isMultimodalCall(body)) return geminiResponse(DRAFT);
      // The self-consistency repair pass: nothing to fix in this test.
      return geminiResponse({ changed: false, transitions: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    useEnv();

    const result = await generateFlowFromDocument({
      fileBase64: Buffer.from('ignored').toString('base64'),
      mimeType: 'application/pdf',
      filename: 'spec.pdf',
      documentText: DOCUMENT_TEXT,
    });

    const stateNames = result.states.map((state) => state.name);
    expect(stateNames).toContain('UPLOAD_PAGE');
    expect(stateNames).toContain('CONFIDENCE_PAGE');
    expect(stateNames).not.toContain('BILLING_PORTAL');
    expect(result.transitions).toHaveLength(1);
    expect(result.leftOut?.some((issue) => issue.code === 'UNSUPPORTED_TOPOLOGY')).toBe(true);
  });

  it('without documentText or a text-ish mime type, nothing can be checked and nothing is dropped by evidence', async () => {
    const fetchMock = vi.fn(async () => geminiResponse(DRAFT));
    vi.stubGlobal('fetch', fetchMock);
    useEnv();

    const result = await generateFlowFromDocument({
      fileBase64: Buffer.from('ignored').toString('base64'),
      mimeType: 'application/pdf',
      filename: 'spec.pdf',
    });

    expect(result.states.map((state) => state.name)).toContain('BILLING_PORTAL');
    // No documentText means the repair pass is skipped too (only one fetch call).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.providerCalls).toBe(1);
  });

  it('runs a self-consistency repair pass and applies a corrected transition order', async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (isMultimodalCall(body)) return geminiResponse(DRAFT);
      return geminiResponse({
        changed: true,
        explanation: 'Payment must precede the billing portal state per the document.',
        transitions: [
          { from: 'UPLOAD_PAGE', to: 'CONFIDENCE_PAGE', action: 'CLICK_LOCK_IN' },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    useEnv();

    const result = await generateFlowFromDocument({
      fileBase64: Buffer.from('ignored').toString('base64'),
      mimeType: 'application/pdf',
      filename: 'spec.pdf',
      documentText: DOCUMENT_TEXT,
    });

    expect(result.repairedOrdering).toBe(true);
    expect(result.transitions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.providerCalls).toBe(2);
    expect(result.generationMs).toBeGreaterThanOrEqual(0);
  });

  it('sends the existing-flows list and journey scope in the prompt when given', async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      return geminiResponse(isMultimodalCall(body) ? DRAFT : { changed: false, transitions: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    useEnv();

    await generateFlowFromDocument({
      fileBase64: Buffer.from('ignored').toString('base64'),
      mimeType: 'application/pdf',
      filename: 'spec.pdf',
      documentText: DOCUMENT_TEXT,
      existingFlows: [{ name: 'Pay & Unlock Plan', purpose: 'Takes payment and activates a subscription.' }],
      journey: { name: 'First-time onboarding', purpose: 'Get a new student to their first study plan.', entryHint: 'Dashboard', exitHint: 'Generated plan' },
    });

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt: string = firstCallBody.contents[0].parts.find((part: any) => part.text).text;
    expect(prompt).toContain('Pay & Unlock Plan');
    expect(prompt).toContain('First-time onboarding');
    expect(prompt).not.toContain('EXISTING FLOWS you may reuse as a subFlow: none');
  });
});

describe('decomposeDocumentIntoFlows', () => {
  it('returns the journeys the model lists', async () => {
    const fetchMock = vi.fn(async () => geminiResponse({
      journeys: [
        { name: 'First-time onboarding', purpose: 'Upload materials and unlock a plan.', entryHint: 'Dashboard', exitHint: 'Generated plan' },
        { name: 'Study with plan', purpose: 'Adaptive pre-assessment and practice loop.' },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    useEnv();

    const journeys = await decomposeDocumentIntoFlows({
      fileBase64: Buffer.from('ignored').toString('base64'),
      mimeType: 'application/pdf',
      filename: 'spec.pdf',
    });

    expect(journeys).toHaveLength(2);
    expect(journeys[0].name).toBe('First-time onboarding');
    expect(journeys[1].entryHint).toBeUndefined();
  });
});
