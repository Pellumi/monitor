import { normalizeStateKey, normalizeText, patternSpecificity, routeMatches } from './keys';
import type {
  Confidence,
  ControlDescriptor,
  ExecutableState,
  Recognition,
  RecognitionEvidence,
  SemanticElement,
  SemanticSnapshot,
} from './types';

/**
 * State recognition.
 *
 * "Which state is the browser in" is answered from structured evidence, never
 * from pixels: the application's own SDK signal, the route, the elements the
 * code says the state exposes, and the requests it made. Each piece of evidence
 * moves a score; the score and, more importantly, whether anything contradicts
 * the state decide a confidence the executor acts on:
 *
 *   HIGH    proceed
 *   MEDIUM  proceed only after cross-checking (the caller's business)
 *   LOW     do not act; replan or stop
 *
 * A contradiction is not merely a lower score. A state the SDK explicitly says we
 * are *not* in cannot be HIGH however well the route matches.
 */

const WEIGHT = {
  sdkMatch: 0.6,
  sdkConflict: -0.6,
  routeMatch: 0.3,
  routeMismatch: -0.3,
  required: 0.3,
  optional: 0.1,
  api: 0.1,
  /**
   * A heading or text a person declared. Corroboration only: it raises the score of the state it names, which is what
   * tells apart two states that share a route, but its absence costs nothing. Wording changes (a heading that now
   * carries a name, a rewritten button) must not strand a run whose route and SDK signal still say where it is.
   */
  declaredText: 0.25,
} as const;

/** Whether `descriptor` is satisfied by some visible element. Enabled state is irrelevant to *being in* a state. */
export function elementPresent(descriptor: ControlDescriptor, elements: SemanticElement[]): boolean {
  return elements.some((element) => element.visible && describes(descriptor, element));
}

/** Whether an element could be the control a descriptor names. Looser than ranking: presence, not choice. */
export function describes(descriptor: ControlDescriptor, element: SemanticElement): boolean {
  if (descriptor.actionAnchor && element.actionAnchor === descriptor.actionAnchor) return true;
  if (descriptor.testId && element.testId === descriptor.testId) return true;
  if (descriptor.domId && element.domId === descriptor.domId) return true;
  const shown = [element.name, element.label].map(normalizeText).filter(Boolean);
  return descriptor.labels.some((label) => {
    const wanted = normalizeText(label);
    return Boolean(wanted) && shown.includes(wanted);
  });
}

/**
 * How many of the headings and texts a person declared for a state are on the page. A heading is looked for in the
 * page title and headings; a text also in what the visible elements say. Either may be a part of what is shown
 * ("Welcome back, Sam" satisfies "Welcome back"), because a heading that carries a name is still the heading.
 */
function declaredTextPresent(snapshot: SemanticSnapshot, state: ExecutableState): { present: number; total: number } {
  const headings = state.headings ?? [];
  const texts = state.texts ?? [];
  const headingSurface = [snapshot.title, ...snapshot.headings].map(normalizeText).filter(Boolean);
  const textSurface = [
    ...headingSurface,
    ...snapshot.elements.filter((element) => element.visible).flatMap((element) => [element.name, element.label]).map(normalizeText).filter(Boolean),
  ];
  const found = (wanted: string, surface: string[]) => {
    const needle = normalizeText(wanted);
    return Boolean(needle) && surface.some((shown) => shown === needle || shown.includes(needle));
  };
  return {
    present: headings.filter((heading) => found(heading, headingSurface)).length + texts.filter((item) => found(item, textSurface)).length,
    total: headings.length + texts.length,
  };
}

export function recognize(snapshot: SemanticSnapshot, state: ExecutableState): Recognition {
  const evidence: RecognitionEvidence = {
    route: 'NOT_APPLICABLE',
    heading: 'NOT_APPLICABLE',
    sdk: 'ABSENT',
    requiredPresent: 0,
    requiredTotal: state.requiredElements.length,
    optionalPresent: 0,
    optionalTotal: state.optionalElements.length,
    apiMatched: 0,
    apiTotal: state.expectedApi.length,
  };
  let score = 0;
  let contradicted = false;

  // The application's own account of where it is, when it gave one.
  const signals = new Set(state.sdkStateSignals.map(normalizeStateKey));
  const reported = snapshot.sdkStates.map(normalizeStateKey);
  const latest = reported[reported.length - 1];
  if (signals.size > 0 && reported.length > 0) {
    if (latest !== undefined && signals.has(latest)) {
      evidence.sdk = 'MATCH';
      score += WEIGHT.sdkMatch;
    } else {
      // The SDK reported some other state most recently. That is the application
      // disagreeing, which outranks anything the DOM suggests.
      evidence.sdk = 'CONFLICT';
      score += WEIGHT.sdkConflict;
      contradicted = true;
    }
  }

  if (state.routePatterns.length > 0) {
    if (state.routePatterns.some((pattern) => routeMatches(pattern, snapshot.path))) {
      evidence.route = 'MATCH';
      score += WEIGHT.routeMatch;
    } else {
      evidence.route = 'MISMATCH';
      score += WEIGHT.routeMismatch;
      contradicted = true;
    }
  }

  const declaredText = declaredTextPresent(snapshot, state);
  if (declaredText.total > 0) {
    if (declaredText.present === declaredText.total) {
      evidence.heading = 'MATCH';
      score += WEIGHT.declaredText;
    } else {
      // Recorded, so a report can say the wording differs, but not held against the state.
      evidence.heading = 'MISMATCH';
      score += WEIGHT.declaredText * (declaredText.present / declaredText.total);
    }
  }

  if (state.requiredElements.length > 0) {
    evidence.requiredPresent = state.requiredElements.filter((descriptor) => elementPresent(descriptor, snapshot.elements)).length;
    const missing = evidence.requiredTotal - evidence.requiredPresent;
    if (missing === 0) score += WEIGHT.required;
    else {
      score -= WEIGHT.required * (missing / evidence.requiredTotal);
      contradicted = true;
    }
  }

  if (state.optionalElements.length > 0) {
    evidence.optionalPresent = state.optionalElements.filter((descriptor) => elementPresent(descriptor, snapshot.elements)).length;
    score += WEIGHT.optional * (evidence.optionalPresent / evidence.optionalTotal);
  }

  if (state.expectedApi.length > 0) {
    evidence.apiMatched = state.expectedApi.filter((condition) => snapshot.requests.some((request) =>
      request.completed
      && request.method.toUpperCase() === condition.method.toUpperCase()
      && request.route === condition.route
      && (condition.expectStatus === null || request.status === condition.expectStatus))).length;
    score += WEIGHT.api * (evidence.apiMatched / evidence.apiTotal);
  }

  return { stateKey: state.key, score: round(score), confidence: confidenceFor(score, contradicted, evidence), evidence };
}

function confidenceFor(score: number, contradicted: boolean, evidence: RecognitionEvidence): Confidence {
  // A state with nothing to check it against cannot be recognised at all.
  const hadAnyCheck = evidence.sdk !== 'ABSENT' || evidence.route !== 'NOT_APPLICABLE' || (evidence.heading ?? 'NOT_APPLICABLE') !== 'NOT_APPLICABLE'
    || evidence.requiredTotal > 0 || evidence.optionalTotal > 0 || evidence.apiTotal > 0;
  if (!hadAnyCheck) return 'LOW';
  if (contradicted) return 'LOW';
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.3) return 'MEDIUM';
  return 'LOW';
}

export interface RecognitionResult {
  best: Recognition | null;
  /** Every state that scored above LOW, best first. */
  candidates: Recognition[];
  /** More than one state fits about equally well. The executor must not act on an ambiguous read. */
  ambiguous: boolean;
}

export const AMBIGUITY_MARGIN = 0.1;

/** Recognise the most likely state among `states`. */
export function recognizeAmong(snapshot: SemanticSnapshot, states: ExecutableState[]): RecognitionResult {
  const scored = states
    .map((state) => ({ state, recognition: recognize(snapshot, state) }))
    .filter(({ recognition }) => recognition.confidence !== 'LOW')
    .sort((a, b) => b.recognition.score - a.recognition.score
      // Equal scores: the state whose route is the more specific pattern wins (`/courses/new` over `/courses/{param}`).
      || specificity(b.state) - specificity(a.state));
  const candidates = scored.map(({ recognition }) => recognition);
  if (candidates.length === 0) return { best: null, candidates, ambiguous: false };
  const [first, second] = scored;
  const close = second !== undefined
    && Math.abs(first.recognition.score - second.recognition.score) <= AMBIGUITY_MARGIN
    && specificity(first.state) === specificity(second.state);
  return { best: first.recognition, candidates, ambiguous: close };
}

function specificity(state: ExecutableState): number {
  return state.routePatterns.reduce((best, pattern) => Math.max(best, patternSpecificity(pattern)), 0);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
