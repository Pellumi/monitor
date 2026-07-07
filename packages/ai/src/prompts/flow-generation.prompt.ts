export function buildFlowGenerationPrompt(input: {
  productDescription: string;
  domainKey: string;
  ruleSummaries: string[];
}): string {
  return [
    'Generate an application behavior-flow draft as strict JSON.',
    'Do not include raw user data, secrets, request bodies, or provider commentary.',
    'Return keys: domainKey, confidence, assumptions, workflows, missingFlowCandidates, missingStateCandidates, suggestions, source.',
    `Domain: ${input.domainKey}`,
    `Rules: ${input.ruleSummaries.join('; ') || 'No specific rules provided.'}`,
    `Product description: ${input.productDescription}`,
  ].join('\n');
}
