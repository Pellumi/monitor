import { generateRuleBasedFlow, getFallbackCompiledRuleset } from '@sots/rules';
import { AIProvider, GenerateFlowInput } from './base';

export class MockProvider implements AIProvider {
  name = 'mock';
  model = 'mock-flow-intelligence-v1';

  async generateFlowDraft(input: GenerateFlowInput) {
    const rulesets = [getFallbackCompiledRuleset(input.domainKey)];
    const draft = await generateRuleBasedFlow({
      domainKey: input.domainKey,
      productDescription: input.productDescription,
      rulesets,
    });
    return {
      ...draft,
      confidence: Math.max(0.72, draft.confidence),
      assumptions: [
        ...draft.assumptions,
        'Mock AI provider used; draft is deterministic and safe for local tests.',
      ],
      source: 'AI' as const,
    };
  }
}
