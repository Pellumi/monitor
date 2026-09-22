import type { CodebaseAnalysis, CodeEntity, CreateQARunAnnotation } from '@tellann/desktop-contracts';

type Fingerprint = CreateQARunAnnotation['elementFingerprint'];
type SourceMapping = NonNullable<Fingerprint['sourceMapping']>;

/** Short of the 1.0 reserved for a checker-resolved fact: the attribute is
 * literal in the source and verbatim in the DOM, but nothing proves the two
 * elements are the same one. */
const EXACT_IDENTIFIER_CONFIDENCE = 0.98;

const IGNORED = new Set([
  'a', 'an', 'and', 'button', 'div', 'element', 'form', 'input', 'link', 'on', 'onclick',
  'onsubmit', 'page', 'route', 'span', 'the', 'to', 'unnamed',
  // Structural words that splitting identifiers now exposes. `handleSave`
  // yields a useful "save", but also a "handle" that would match every handler
  // in the repository, and a handler body yields the plumbing of the event
  // rather than anything the element renders. Words that are plausible labels
  // in their own right — submit, select, change, close — are deliberately kept.
  'handle', 'handler', 'set', 'get', 'props', 'event', 'target', 'value',
  'true', 'false', 'null', 'undefined', 'async', 'await', 'const', 'return',
]);

/**
 * Terms for matching. Identifiers are split on case and separator boundaries
 * and kept alongside the whole token, so `handleSave` and `save_button` both
 * reach a rendered "Save" without the two having to be spelled the same way.
 */
function terms(value: unknown): Set<string> {
  const collected = new Set<string>();
  for (const word of String(value ?? '').split(/[^A-Za-z0-9]+/)) {
    if (!word) continue;
    for (const part of splitIdentifier(word)) {
      if (part.length > 1 && !IGNORED.has(part)) collected.add(part);
    }
  }
  return collected;
}

function splitIdentifier(word: string): string[] {
  const parts = word
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const whole = word.toLowerCase();
  return parts.length > 1 ? [whole, ...parts] : [whole];
}

/**
 * How much of the rendered element's vocabulary a code entity accounts for.
 * Deliberately asymmetric: the source side carries identifiers, handler bodies
 * and attribute text that a rendered element could never report, and charging
 * it for that breadth — as a symmetric ratio does — rejected otherwise exact
 * matches purely for being described in more words than the browser saw.
 */
function coverage(target: Set<string>, source: Set<string>): number {
  if (!target.size || !source.size) return 0;
  let matches = 0;
  for (const term of target) if (source.has(term)) matches += 1;
  if (!matches) return 0;
  // One shared term is thin evidence however short the target is, so a
  // single-term agreement can never reach certainty on its own.
  const corroboration = matches >= 3 ? 1 : matches === 2 ? 0.9 : 0.75;
  return (matches / target.size) * corroboration;
}

/**
 * A literal `data-testid` or `id` needs no scoring: the value the browser
 * reported was typed into the JSX by hand, so an exact hit is a fact rather
 * than a guess. A value that identifies more than one element identifies
 * nothing, and falls through to the scorer rather than picking a winner.
 */
function exactIdentifierMatch(
  analysis: CodebaseAnalysis,
  fingerprint: Fingerprint,
): CodeEntity | null {
  const wanted: Array<[key: string, value: string]> = [];
  if (fingerprint.testId) wanted.push(['testId', fingerprint.testId]);
  if (fingerprint.id) wanted.push(['domId', fingerprint.id]);
  for (const [key, value] of wanted) {
    const matched = analysis.entities.filter((entity) => entity.type === 'ui_action'
      && String((entity.metadata as Record<string, unknown>)[key] ?? '') === value);
    if (matched.length === 1) return matched[0];
  }
  return null;
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
 * Maps a rendered inspect target back to the static code graph. A literal
 * identifier shared by the DOM and the JSX wins outright; otherwise the
 * element's vocabulary is scored against each UI action, and an exact route
 * with its page component is the safe fallback. Low-confidence guesses are
 * deliberately rejected so reports never present a plausible-looking filename
 * as fact.
 */
export function resolveAnnotationSource(
  analysis: CodebaseAnalysis,
  annotation: Pick<CreateQARunAnnotation, 'normalizedRoute' | 'elementFingerprint'>,
): SourceMapping | null {
  const fingerprint = annotation.elementFingerprint;

  const exact = exactIdentifierMatch(analysis, fingerprint);
  if (exact) {
    const location = locationOf(exact, analysis);
    if (location) return {
      status: 'MATCHED', ...location, confidence: EXACT_IDENTIFIER_CONFIDENCE,
      strategy: 'ELEMENT', analysisId: analysis.id,
    };
  }

  // The CSS path is deliberately absent: as free text it contributed the
  // markup's scaffolding — html, main, section, nth, of, type — as if those
  // were part of the element's identity, and a `[data-testid="..."]` selector
  // contributed the words "data" and "testid". That noise both diluted the
  // real terms and, under the old symmetric ratio, actively pushed correct
  // matches below the threshold.
  const targetTerms = terms([
    fingerprint.accessibleName, fingerprint.id, fingerprint.testId,
  ].filter(Boolean).join(' '));

  const actionMatches = analysis.entities
    .filter((entity) => entity.type === 'ui_action')
    .map((entity) => {
      const metadata = entity.metadata as Record<string, unknown>;
      // Analyses recorded before labels existed still carry the label inside
      // the display name, ahead of the ` (onClick)` suffix.
      const labels = Array.isArray(metadata.labels) && metadata.labels.length
        ? metadata.labels.join(' ')
        : entity.name.replace(/\s*\([^)]*\)\s*$/, '');
      const identifiers = `${metadata.testId ?? ''} ${metadata.domId ?? ''}`;
      const evidenceText = entity.evidence.map((item) => `${item.symbol ?? ''} ${item.excerpt ?? ''}`).join(' ');
      const nameScore = coverage(targetTerms, terms(`${labels} ${identifiers} ${evidenceText}`));
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
