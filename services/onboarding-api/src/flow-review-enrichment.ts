import { resolveAiProvider } from '@sots/ai';
import { FlowReviewEnrichmentSchema } from '@sots/desktop-contracts';

export async function enrichFlowCodeReview(report: Record<string, any>) {
  const provider = resolveAiProvider();
  if (provider.name === 'mock') return { report, provenance: { engine: 'RULES_FALLBACK', provider: provider.name, model: provider.model, skipped: true } };
  const allowedCheckpointIds = new Set([
    ...(report.missingStates ?? []).map((item: any) => `state:${item.stateId}`),
    ...(report.incompleteTransitions ?? []).map((item: any) => `transition:${item.transitionId}`),
  ]);
  const evidenceInput = {
    summary: report.summary,
    missingStates: report.missingStates,
    incompleteTransitions: report.incompleteTransitions,
    edgeCases: report.edgeCases,
    uncoveredTerminalOutcomes: report.uncoveredTerminalOutcomes,
  };
  const prompt = [
    'You are enriching a deterministic code review for a declared application Flow.',
    'Use only the supplied findings. Do not add files, symbols, checkpoints, or evidence.',
    'Return concise developer guidance as JSON matching the requested schema.',
    JSON.stringify(evidenceInput),
  ].join('\n\n');
  const result = await provider.generateStructured({ prompt, schema: FlowReviewEnrichmentSchema, timeoutMs: 15_000 });
  const recommendations = result.data.recommendations
    .filter((item) => allowedCheckpointIds.has(item.checkpointId))
    .map((item) => ({ ...item, action: 'Review evidence-backed checkpoint mapping' }));
  const edgeCaseByCode = new Map(result.data.edgeCaseExplanations.map((item) => [item.code, item.explanation]));
  return {
    report: {
      ...report,
      engine: 'HYBRID',
      aiSummary: result.data.summary,
      recommendations: recommendations.length ? recommendations : report.recommendations,
      edgeCases: (report.edgeCases ?? []).map((item: any) => ({ ...item, explanation: edgeCaseByCode.get(String(item.code)) ?? item.explanation })),
    },
    provenance: { engine: 'HYBRID', provider: provider.name, model: provider.model, repaired: result.repaired, skipped: false },
  };
}
