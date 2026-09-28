import { canonicalRoute } from '@tellann/shared';

/** Re-exported so browser-side code canonicalises request routes the same way the engine does. */
export { canonicalRouteFromPath } from '@tellann/shared';

/**
 * The one state key the engine uses.
 *
 * This is byte-for-byte the normalisation `processQaFlowBoundaryEvent` applies
 * (`normalizeQaFlowKey` in packages/db/src/qa-flow-boundary.ts). Tellann has two
 * other ways of naming a state (`ROUTE_<CANONICAL>` in session-core, uppercase route
 * names in the browser observer); a recognizer that used either would report a state
 * the boundary evaluator does not know. `keys.test.ts` pins the behaviour.
 */
export function normalizeStateKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** `/courses/{param}` from any framework's spelling of it. */
export function canonicalPattern(route: string): string {
  return canonicalRoute(route);
}

/**
 * Whether a concrete path (`/courses/17/exams`) satisfies a canonical pattern
 * (`/courses/{param}/exams`). A `{param}` matches exactly one non-empty segment.
 */
export function routeMatches(pattern: string, path: string): boolean {
  const wanted = canonicalPattern(pattern).split('/');
  const actual = pathOnly(path).split('/');
  if (wanted.length !== actual.length) return false;
  for (let index = 0; index < wanted.length; index += 1) {
    if (wanted[index] === '{param}') {
      if (!actual[index]) return false;
      continue;
    }
    if (wanted[index] !== actual[index]) return false;
  }
  return true;
}

/** Lower-cased path without query, fragment or trailing slash. */
export function pathOnly(input: string): string {
  let path = input.trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    // Fall through with the raw string.
  }
  path = path.replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!path.startsWith('/')) path = `/${path}`;
  return (path === '' ? '/' : path).toLowerCase();
}

/**
 * How specific a pattern is: literal segments count, `{param}` does not.
 * Used to prefer `/courses/new` over `/courses/{param}` when both match.
 */
export function patternSpecificity(pattern: string): number {
  return canonicalPattern(pattern).split('/').filter((segment) => segment && segment !== '{param}').length;
}

/** Text comparison used for labels and accessible names: case, punctuation and spacing insensitive. */
export function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
