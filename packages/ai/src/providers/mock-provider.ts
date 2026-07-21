import { generateRuleBasedFlow, getFallbackCompiledRuleset } from '@sots/rules';
import { AIProvider, GenerateFlowInput, GenerateStructuredInput, StructuredGenerationResult } from './base';

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

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>> {
    const response = {
      suggestions: [{
        type: 'MISSING_FAILURE_PATH', title: 'Handle invalid login credentials',
        description: 'Add an invalid-credentials branch from LOGIN so failed authentication is represented.',
        targetNodeId: 'LOGIN', suggestedState: 'INVALID_CREDENTIALS',
        suggestedTransition: 'LOGIN->INVALID_CREDENTIALS[INVALID_CREDENTIALS]',
        severity: 'HIGH', confidence: 0.72,
        rationale: 'Successful login paths should be paired with a deterministic credential failure path.',
        evidence: ['LOGIN state', 'SUCCESS transition'],
      }],
    };
    return { data: input.schema.parse(response), rawText: JSON.stringify(response), repaired: false };
  }
}
