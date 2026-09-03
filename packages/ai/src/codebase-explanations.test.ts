import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AIProvider } from './providers/base';
import {
  EXPLANATION_PROMPT_VERSION, explainFeatures, isGrounded,
  type FeatureEvidenceBundle,
} from './codebase-explanations';

const bundle = (overrides: Partial<FeatureEvidenceBundle> = {}): FeatureEvidenceBundle => ({
  featureId: 'feature:checkout',
  fallbackName: 'Create checkout',
  fallbackDescription: 'Entered through POST /checkout; writes 1 data model(s).',
  trigger: 'POST /checkout',
  entrypointType: 'endpoint',
  domain: 'Payments',
  workflow: ['function: checkout', 'function: chargeCard'],
  reads: ['Cart'],
  writes: ['Order'],
  externalServices: ['Stripe'],
  emittedEvents: ['order.created'],
  downstreamEffects: [],
  authorization: [],
  sourceFiles: ['services/api/src/index.ts'],
  testNames: [],
  confidence: 0.82,
  vocabulary: ['checkout', 'chargecard', 'cart', 'order', 'stripe', 'created', 'payments', 'services', 'api'],
  ...overrides,
});

function stubProvider(reply: unknown, name = 'gemini'): AIProvider {
  return {
    name,
    model: 'test-model',
    generateFlowDraft: async () => { throw new Error('not used'); },
    generateStructured: async <T>({ schema }: { schema: z.ZodType<T> }) => ({
      data: schema.parse(reply),
      rawText: JSON.stringify(reply),
      repaired: false,
    }),
  };
}

function failingProvider(name = 'gemini'): AIProvider {
  return {
    name,
    model: 'broken-model',
    generateFlowDraft: async () => { throw new Error('not used'); },
    generateStructured: async () => { throw new Error('PROVIDER_UNAVAILABLE'); },
  };
}

describe('grounding check', () => {
  it('accepts text that only names subjects present in the evidence', () => {
    expect(isGrounded('Checkout charges the card through Stripe and writes an Order.', bundle().vocabulary)).toBe(true);
  });

  it('rejects text that introduces a service the evidence never mentioned', () => {
    expect(isGrounded('Checkout charges the card through PayPal.', bundle().vocabulary)).toBe(false);
  });

  it('does not penalise ordinary prose', () => {
    expect(isGrounded('The request creates a record and returns a response.', bundle().vocabulary)).toBe(true);
  });
});

describe('explainFeatures', () => {
  it('accepts a grounded model answer and records its provenance', async () => {
    const explanations = await explainFeatures([bundle()], {
      providers: [stubProvider({
        features: [{
          featureId: 'feature:checkout',
          name: 'Complete a checkout',
          description: 'Charges the card through Stripe and writes an Order.',
        }],
      })],
    });

    expect(explanations).toHaveLength(1);
    expect(explanations[0].name).toBe('Complete a checkout');
    expect(explanations[0].grounded).toBe(true);
    expect(explanations[0].model).toBe('test-model');
    expect(explanations[0].promptVersion).toBe(EXPLANATION_PROMPT_VERSION);
    // A description can never be more certain than the evidence beneath it.
    expect(explanations[0].confidence).toBeLessThanOrEqual(0.82);
  });

  it('discards an answer that invents a service and keeps the deterministic text', async () => {
    const explanations = await explainFeatures([bundle()], {
      providers: [stubProvider({
        features: [{
          featureId: 'feature:checkout',
          name: 'Complete a checkout',
          description: 'Charges the card through PayPal and notifies Twilio.',
        }],
      })],
    });

    expect(explanations[0].grounded).toBe(false);
    expect(explanations[0].name).toBe('Create checkout');
    expect(explanations[0].description).toBe(bundle().fallbackDescription);
  });

  it('falls back to deterministic descriptions when every provider fails', async () => {
    const explanations = await explainFeatures([bundle()], {
      providers: [failingProvider(), failingProvider('deepseek')],
    });

    expect(explanations).toHaveLength(1);
    expect(explanations[0].grounded).toBe(false);
    expect(explanations[0].name).toBe('Create checkout');
  });

  it('does not call a provider at all when only the mock is configured', async () => {
    const explanations = await explainFeatures([bundle()], {
      providers: [{
        name: 'mock',
        model: 'mock',
        generateFlowDraft: async () => { throw new Error('should not be called'); },
        generateStructured: async () => { throw new Error('should not be called'); },
      }],
    });

    expect(explanations[0].model).toBe('deterministic');
    expect(explanations[0].grounded).toBe(false);
  });

  it('keeps the deterministic answer for a feature the model omitted', async () => {
    const first = bundle();
    const second = bundle({ featureId: 'feature:refund', fallbackName: 'Create refund' });
    const explanations = await explainFeatures([first, second], {
      providers: [stubProvider({
        features: [{
          featureId: 'feature:checkout',
          name: 'Complete a checkout',
          description: 'Charges the card through Stripe and writes an Order.',
        }],
      })],
    });

    expect(explanations).toHaveLength(2);
    expect(explanations.find((item) => item.featureId === 'feature:refund')?.grounded).toBe(false);
    expect(explanations.find((item) => item.featureId === 'feature:refund')?.name).toBe('Create refund');
  });

  it('returns nothing for an empty bundle list', async () => {
    expect(await explainFeatures([])).toEqual([]);
  });
});
