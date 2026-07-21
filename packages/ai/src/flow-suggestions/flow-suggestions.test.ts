import { describe, expect, it } from 'vitest';
import { MockProvider } from '../providers/mock-provider';
import { generateFlowSuggestions } from './generate-flow-suggestions';
import { mergeSuggestions } from './merge-suggestions';

const input = {
  applicationId: 'app', organizationId: 'org', applicationDomain: 'AUTH', graphVersion: 3, graphHash: 'hash',
  declaredFlows: [{ flowId: 'flow', name: 'Login', states: [{ name: 'LOGIN', category: 'BUSINESS' }, { name: 'DASHBOARD', category: 'NAVIGATION' }], transitions: [{ from: 'LOGIN', to: 'DASHBOARD', action: 'SUCCESS' }] }],
  existingRuleSuggestions: [],
};

describe('flow suggestion generation', () => {
  it('uses the typed provider path and returns a login failure alternative', async () => {
    const result = await generateFlowSuggestions(input, { enableAi: true, provider: new MockProvider() });
    expect(result.aiCalled).toBe(true);
    expect(result.suggestions.some((suggestion) => suggestion.suggestedState === 'INVALID_CREDENTIALS')).toBe(true);
  });

  it('falls back to rules when the provider fails', async () => {
    const provider = new MockProvider();
    (provider as any).generateStructured = async () => { throw new Error('provider unavailable'); };
    const result = await generateFlowSuggestions({ ...input, existingRuleSuggestions: [{ type: 'MISSING_FAILURE_PATH', title: 'Login failure', description: 'Add login failure handling', rationale: 'Authentication can fail', confidence: .9, severity: 'HIGH', suggestedState: 'LOGIN_FAILURE' }] }, { enableAi: true, provider });
    expect(result.fallbackUsed).toBe(true);
    expect(result.suggestions[0].suggestedState).toBe('LOGIN_FAILURE');
  });

  it('merges equivalent rule and AI signals and caps AI-only confidence', () => {
    const merged = mergeSuggestions({ ruleSuggestions: [{ type: 'MISSING_FAILURE_PATH', title: 'Login failure', description: 'Rule description', rationale: 'Rule rationale', confidence: .9, targetNodeId: 'LOGIN' }], aiSuggestions: [{ type: 'MISSING_FAILURE_PATH', title: 'Login failure', description: 'Longer AI description for the same failure branch', rationale: 'AI rationale', confidence: .99, severity: 'HIGH', evidence: [], targetNodeId: 'LOGIN' }, { type: 'MISSING_RECOVERY_PATH', title: 'Recover account', description: 'Offer a safe account recovery route', rationale: 'Users need recovery', confidence: .99, severity: 'MEDIUM', evidence: [] }] });
    expect(merged.find((item) => item.title === 'Login failure')!.sources).toContain('RULE_BASED');
    expect(merged.find((item) => item.title === 'Recover account')!.confidence).toBeLessThanOrEqual(.75);
  });
});
