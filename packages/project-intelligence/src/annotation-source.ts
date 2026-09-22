import type { CodebaseAnalysis, CodeEntity, CreateQARunAnnotation } from '@tellann/desktop-contracts';

type Fingerprint = CreateQARunAnnotation['elementFingerprint'];
type SourceMapping = NonNullable<Fingerprint['sourceMapping']>;

const IGNORED = new Set([
  'a', 'an', 'and', 'button', 'div', 'element', 'form', 'input', 'link', 'on', 'onclick',
  'onsubmit', 'page', 'route', 'span', 'the', 'to', 'unnamed',
]);

function terms(value: unknown): Set<string> {
  return new Set(String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !IGNORED.has(term)));
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let matches = 0;
  for (const term of left) if (right.has(term)) matches += 1;
  return matches / Math.max(left.size, right.size);
}

function locationOf(entity: CodeEntity, analysis: CodebaseAnalysis) {
  const evidence = entity.evidence.find((item) => item.path);
  const path = entity.path ?? evidence?.path ?? null;
  if (!path) return null;
  let located = entity;
  if (entity.type === 'ui_action') {
    const related = analysis.relationships
      .filter((relationship) => relationship.source === entity.id && relationship.type === 'ROUTES_TO')
      .map((relationship) => analysis.entities.find((candidate) => candidate.id === relationship.target))
      .filter((candidate): candidate is CodeEntity => Boolean(candidate)
        && (candidate?.type === 'function' || candidate?.type === 'class')
        && candidate.path === path && candidate.startLine !== null);
    const enclosing = related.filter((candidate) =>
      (candidate.startLine ?? 0) <= (entity.startLine ?? 0)
      && (candidate.endLine ?? Number.MAX_SAFE_INTEGER) >= (entity.endLine ?? entity.startLine ?? 0));
    located = enclosing.find((candidate) => /^[A-Z]/.test(candidate.name))
      ?? enclosing[0]
      ?? related.find((candidate) => /^[A-Z]/.test(candidate.name))
      ?? related[0]
      ?? entity;
  }
  if (entity.type === 'ui_route') {
    const declared = analysis.entities.filter((item) =>
      item.path === path && item.id !== entity.id
      && (item.type === 'function' || item.type === 'class') && item.startLine !== null);
    located = declared.find((item) => /^[A-Z]/.test(item.name))
      ?? declared.sort((left, right) => (left.startLine ?? 0) - (right.startLine ?? 0))[0]
      ?? entity;
  }
  return {
    path: path.replaceAll('\\', '/'),
    startLine: located.startLine ?? evidence?.startLine ?? null,
    endLine: located.endLine ?? evidence?.endLine ?? located.startLine ?? evidence?.startLine ?? null,
    symbol: located.type === 'ui_route' ? null : located.name,
  };
}

function normalizedRoute(value: string): string {
  const clean = value.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return clean || '/';
}

/**
 * Maps a rendered inspect target back to the static code graph. Exact UI-action
 * evidence wins; an exact route and its page component are the safe fallback.
 * Low-confidence guesses are deliberately rejected so reports never present a
 * plausible-looking filename as fact.
 */
export function resolveAnnotationSource(
  analysis: CodebaseAnalysis,
  annotation: Pick<CreateQARunAnnotation, 'normalizedRoute' | 'elementFingerprint'>,
): SourceMapping | null {
  const fingerprint = annotation.elementFingerprint;
  const targetTerms = terms([
    fingerprint.accessibleName, fingerprint.id, fingerprint.testId, fingerprint.cssPath,
  ].filter(Boolean).join(' '));

  const actionMatches = analysis.entities
    .filter((entity) => entity.type === 'ui_action')
    .map((entity) => {
      const metadata = entity.metadata as Record<string, unknown>;
      const evidenceText = entity.evidence.map((item) => `${item.symbol ?? ''} ${item.excerpt ?? ''}`).join(' ');
      const nameScore = overlap(targetTerms, terms(`${entity.name} ${evidenceText}`));
      const tagScore = String(metadata.element ?? '').toLowerCase() === fingerprint.tag.toLowerCase() ? 0.15 : 0;
      return { entity, score: Math.min(1, nameScore * 0.85 + tagScore) };
    })
    .filter((candidate) => candidate.score >= 0.55)
    .sort((left, right) => right.score - left.score || right.entity.confidence - left.entity.confidence);

  const action = actionMatches[0];
  if (action) {
    const location = locationOf(action.entity, analysis);
    if (location) return {
      status: 'MATCHED', ...location, confidence: action.score,
      strategy: 'ELEMENT', analysisId: analysis.id,
    };
  }

  const route = normalizedRoute(annotation.normalizedRoute);
  const routeEntity = analysis.entities
    .filter((entity) => entity.type === 'ui_route')
    .find((entity) => normalizedRoute(String((entity.metadata as Record<string, unknown>).route ?? entity.name)) === route);
  if (!routeEntity) return null;
  const location = locationOf(routeEntity, analysis);
  return location ? {
    status: 'MATCHED', ...location,
    confidence: Math.min(0.9, routeEntity.confidence), strategy: 'ROUTE', analysisId: analysis.id,
  } : null;
}
