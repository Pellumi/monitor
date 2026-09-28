import { normalizeText, pathOnly, routeMatches } from './keys';
import type { CandidateMethod, ControlCandidate, ControlDescriptor, SemanticElement } from './types';

/**
 * Choosing the control for a transition.
 *
 * The descriptor comes from the code that handles the transition, so the best
 * evidence is the one that survives UI changes: an instrumented anchor, then a test id, then
 * the accessible name on the right kind of element. Visible text and structure are
 * last resorts and score too low to act on unless nothing better exists.
 *
 * Ranking never widens the search after it fails. If the best candidate is below
 * the acceptance threshold, or two different elements tie, the answer is "no
 * confident candidate" and the executor records that instead of clicking one.
 */

const BASE_SCORE: Record<CandidateMethod, number> = {
  ACTION_ANCHOR: 1,
  TEST_ID: 0.95,
  ROLE_NAME: 0.85,
  LABEL: 0.75,
  HREF: 0.7,
  TEXT: 0.55,
  STRUCTURAL: 0.3,
};

/** Below this a candidate is reported but never acted on. */
export const ACCEPTANCE_THRESHOLD = 0.5;

const ROLE_FOR_ELEMENT: Record<string, string[]> = {
  button: ['button'],
  a: ['link'],
  input: ['button', 'textbox', 'checkbox', 'radio', 'combobox'],
  select: ['combobox', 'listbox'],
  textarea: ['textbox'],
  form: ['form'],
};

export interface RankResult {
  /** The candidate to act on, or null when none is confident enough. */
  best: ControlCandidate | null;
  ambiguous: boolean;
  candidates: ControlCandidate[];
  /** Candidates that matched but cannot be acted on (hidden or disabled), so a report can say why. */
  unusable: ControlCandidate[];
}

export function rankControls(descriptor: ControlDescriptor, elements: SemanticElement[]): RankResult {
  const usable: ControlCandidate[] = [];
  const unusable: ControlCandidate[] = [];
  for (const element of elements) {
    const matched = bestMethod(descriptor, element);
    if (!matched) continue;
    const candidate: ControlCandidate = { element, method: matched.method, score: matched.score };
    (element.visible && element.enabled ? usable : unusable).push(candidate);
  }
  usable.sort((a, b) => b.score - a.score);
  const [first, second] = usable;
  const best = first && first.score >= ACCEPTANCE_THRESHOLD ? first : null;
  // Two *different* elements matching equally well is not a choice we can justify.
  const ambiguous = best !== null && second !== undefined
    && second.element.ref !== best.element.ref
    && second.score === best.score;
  return { best: ambiguous ? null : best, ambiguous, candidates: usable, unusable };
}

function bestMethod(descriptor: ControlDescriptor, element: SemanticElement): { method: CandidateMethod; score: number } | null {
  if (descriptor.actionAnchor && element.actionAnchor === descriptor.actionAnchor) {
    return { method: 'ACTION_ANCHOR', score: BASE_SCORE.ACTION_ANCHOR };
  }
  if (descriptor.testId && element.testId === descriptor.testId) {
    return { method: 'TEST_ID', score: BASE_SCORE.TEST_ID };
  }

  const name = normalizeText(element.name);
  const label = normalizeText(element.label);
  const labels = descriptor.labels.map(normalizeText).filter(Boolean);
  const exact = labels.some((wanted) => wanted === name || wanted === label);
  if (exact && roleFits(descriptor, element)) return { method: 'ROLE_NAME', score: BASE_SCORE.ROLE_NAME };
  if (exact) return { method: 'LABEL', score: BASE_SCORE.LABEL };

  if (descriptor.href && element.href && hrefMatches(descriptor.href, element.href)) {
    return { method: 'HREF', score: BASE_SCORE.HREF };
  }
  // Partial text: the accessible name contains the label. Weaker, and only for names long enough to mean something.
  const contains = labels.some((wanted) => wanted.length >= 4 && (name.includes(wanted) || label.includes(wanted)));
  if (contains) return { method: 'TEXT', score: BASE_SCORE.TEXT };

  if (descriptor.domId && element.domId === descriptor.domId) {
    return { method: 'STRUCTURAL', score: BASE_SCORE.STRUCTURAL };
  }
  return null;
}

/** When the source told us which element the handler is on, the element must be the right kind. */
export function roleFits(descriptor: ControlDescriptor, element: SemanticElement): boolean {
  if (!descriptor.element) return true;
  const roles = ROLE_FOR_ELEMENT[descriptor.element.toLowerCase()];
  if (!roles) return true;
  return element.role === null ? true : roles.includes(element.role);
}

function hrefMatches(wanted: string, actual: string): boolean {
  if (routeMatches(wanted, pathOnly(actual))) return true;
  return pathOnly(wanted) === pathOnly(actual);
}
