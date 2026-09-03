import type { CodebaseAnalysis, SoftwareFeature } from '@tellann/desktop-contracts';

/**
 * The bounded, structured view of one feature that an explanation model is
 * allowed to see. Deliberately not source code: the model interprets evidence
 * the deterministic analyzers already produced, it does not go looking for its
 * own.
 */
export type FeatureEvidenceBundle = {
  featureId: string;
  /** Deterministic name and description, kept as the fallback answer. */
  fallbackName: string;
  fallbackDescription: string;
  trigger: string;
  entrypointType: string;
  domain: string;
  workflow: string[];
  reads: string[];
  writes: string[];
  externalServices: string[];
  emittedEvents: string[];
  downstreamEffects: string[];
  authorization: string[];
  sourceFiles: string[];
  testNames: string[];
  confidence: number;
  /** Every noun the model is permitted to mention, lower-cased. */
  vocabulary: string[];
};

const clamp = <T>(values: readonly T[], limit: number): T[] => values.slice(0, limit);

/**
 * Build the bundle for one feature. Everything the model may name is collected
 * into `vocabulary`, which the caller uses to reject any output that introduces
 * a subject the evidence never mentioned.
 */
export function buildFeatureEvidenceBundle(
  analysis: Pick<CodebaseAnalysis, 'entities'>,
  feature: SoftwareFeature,
  testNames: string[] = [],
): FeatureEvidenceBundle {
  const entityById = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const entrypoint = feature.entrypoints[0] ? entityById.get(feature.entrypoints[0]) : undefined;

  const workflow = clamp(
    feature.workflow
      .map((step) => step.label)
      // Unresolved scaffolding adds tokens without adding meaning.
      .filter((label) => !/^(file|package|module):/i.test(label)),
    25,
  );

  const vocabulary = new Set<string>();
  const remember = (value: string) => {
    for (const token of value.split(/[^A-Za-z0-9]+/)) {
      if (token.length > 2) vocabulary.add(token.toLowerCase());
    }
  };
  [
    feature.name, feature.description, ...feature.triggers, ...workflow,
    ...feature.reads, ...feature.writes, ...feature.externalServices,
    ...feature.emittedEvents, ...feature.downstreamEffects, ...feature.authorization,
    ...feature.sourceFiles, ...testNames,
  ].forEach(remember);

  return {
    featureId: feature.id,
    fallbackName: feature.name,
    fallbackDescription: feature.description,
    trigger: feature.triggers[0] ?? feature.name,
    entrypointType: entrypoint?.type ?? 'unknown',
    domain: feature.domain,
    workflow,
    reads: clamp(feature.reads, 15),
    writes: clamp(feature.writes, 15),
    externalServices: clamp(feature.externalServices, 10),
    emittedEvents: clamp(feature.emittedEvents, 10),
    downstreamEffects: clamp(feature.downstreamEffects, 10),
    authorization: clamp(feature.authorization, 8),
    sourceFiles: clamp(feature.sourceFiles, 12),
    testNames: clamp(testNames, 8),
    confidence: feature.confidence,
    vocabulary: [...vocabulary],
  };
}

/**
 * Tests whose file appears in the feature's own source set. Test names describe
 * intended behaviour in the team's own words, which is unusually good evidence.
 */
export function testNamesForFeature(
  analysis: Pick<CodebaseAnalysis, 'entities' | 'relationships'>,
  feature: SoftwareFeature,
): string[] {
  const featureFiles = new Set(feature.sourceFiles);
  const names: string[] = [];
  const symbolIds = new Set(feature.workflow.map((step) => step.entityId));

  for (const relationship of analysis.relationships) {
    if (relationship.type !== 'TESTS') continue;
    if (!symbolIds.has(relationship.target)) continue;
    const test = analysis.entities.find((entity) => entity.id === relationship.source);
    if (test) names.push(test.name);
    if (names.length >= 8) return names;
  }
  for (const entity of analysis.entities) {
    if (names.length >= 8) break;
    if (entity.type !== 'test' || !entity.path) continue;
    const subject = entity.path.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, '');
    if ([...featureFiles].some((file) => file.startsWith(subject))) names.push(entity.name);
  }
  return names;
}
