import { planFlowPath } from './flow-path';
import type { PolicyOptions } from './policy';
import { contrastRatio, requiredContrast } from './visual';
import type {
  ActionClass,
  Breakpoint,
  ElementGeometry,
  EnvironmentKind,
  ExecutableContract,
  ExecutableState,
  PageMeasurement,
  SemanticElement,
  ViewportSample,
} from './types';

/**
 * What is wrong with the Flow as a person would meet it, rather than with the application as code.
 *
 * Every rule here is a measurement compared with a published threshold, and every finding carries the numbers
 * that produced it. That matters more than it sounds: a judgement about an interface is worth nothing if the
 * person reading it cannot tell whether to agree. "Submit is 18x18px at 390x844, below the 44x44 minimum" is
 * arguable. "The button feels small" is not, and would not belong in a report this one generates.
 *
 * So there is no model here and no heuristic dressed up as an opinion. Two of the rules need no measurement at
 * all — they are facts about the shape of the declared Flow — and the rest need only what `ElementGeometry`
 * already carries. A rule that cannot be evaluated (nothing was measured, a colour the browser reported in a
 * form we cannot read) produces nothing, never a guess.
 */

export type UiQualityRule =
  /** Text below the size at which it stops being comfortably readable. */
  | 'TEXT_TOO_SMALL'
  /** A control smaller than a fingertip, at a size where fingers are what is used. */
  | 'TAP_TARGET_TOO_SMALL'
  /** Text that does not stand out enough from what it sits on. */
  | 'LOW_CONTRAST'
  /** The action that changes something is drawn more quietly than one that does not. */
  | 'WRONG_BUTTON_WEIGHT'
  /** The page took a visible while to fill in and said nothing while it did. */
  | 'NO_LOADING_AFFORDANCE'
  /** A step that asks nothing of anybody, and exists only to be clicked through. */
  | 'REDUNDANT_STEP'
  /** A state the Flow can get into and not out of. */
  | 'DEAD_END'
  /** The page cannot be read at this width without scrolling sideways. */
  | 'HORIZONTAL_OVERFLOW'
  /** A control the state needs is not reachable at this size. */
  | 'CONTROL_UNREACHABLE_AT_SIZE';

export interface UiQualityFinding {
  rule: UiQualityRule;
  /** `LOW` is worth knowing, `MEDIUM` is worth fixing. Nothing here is ever higher: these are not faults. */
  severity: 'LOW' | 'MEDIUM';
  /** The Flow state it was found in, or null for a finding about the Flow's shape rather than a page. */
  stateKey: string | null;
  /** The window size it was found at, when it depends on one. */
  breakpoint: string | null;
  /** One sentence, carrying the measurement that produced it. */
  detail: string;
  /** What to do about it, when there is something specific to say. */
  recommendation: string | null;
}

// ---------------------------------------------------------------------------
// Thresholds. Every one of these is somebody else's published number, not ours.
// ---------------------------------------------------------------------------

/** Below this, body text is uncomfortable for most people and impossible for some. */
export const MIN_TEXT_PX = 12;
/** WCAG 2.5.5 asks for 44x44 CSS pixels; Apple and Material agree within a pixel or two. */
export const MIN_TAP_TARGET_PX = 44;
/** A width at or below this is a device held in a hand, where a fingertip is the pointer. */
export const TOUCH_WIDTH_PX = 768;
/** Past this, a page that has said nothing is a page that looks broken. */
export const LOADING_AFFORDANCE_MS = 1_000;
/** A little overflow is a rounding artefact; this much is a scrollbar somebody has to use. */
export const OVERFLOW_TOLERANCE_PX = 4;

const MUTATING: ReadonlySet<ActionClass> = new Set<ActionClass>(['SERVER_MUTATION', 'EXTERNAL_SIDE_EFFECT', 'DESTRUCTIVE']);
const EMPHASIS_WEIGHT: Record<ElementGeometry['emphasis'], number> = { FILLED: 3, OUTLINED: 2, TEXT: 1, UNKNOWN: 0 };

const round = (value: number) => Math.round(value * 10) / 10;
const named = (element: SemanticElement) => element.name ?? element.label ?? element.testId ?? element.domId ?? element.tag;

// ---------------------------------------------------------------------------
// The shape of the Flow. No measurement needed, so these hold even for a run
// that measured nothing at all.
// ---------------------------------------------------------------------------

/**
 * States the declared Flow can reach and not leave, and states that exist only to be clicked through.
 *
 * Both are facts about what a person was asked to declare, so they are worth saying even about a Flow nobody
 * has run yet. A terminal state is not a dead end — ending is what it is for.
 */
export function flowShapeFindings(
  contract: ExecutableContract,
  environment: EnvironmentKind,
  policy?: PolicyOptions,
): UiQualityFinding[] {
  const findings: UiQualityFinding[] = [];
  const outgoing = new Map<string, ExecutableContract['transitions']>();
  for (const transition of contract.transitions) {
    const list = outgoing.get(transition.from);
    if (list) list.push(transition);
    else outgoing.set(transition.from, [transition]);
  }

  for (const state of contract.states) {
    if (state.role === 'TERMINAL') continue;
    const out = outgoing.get(state.key) ?? [];
    if (out.length === 0) {
      findings.push({
        rule: 'DEAD_END', severity: 'MEDIUM', stateKey: state.key, breakpoint: null,
        detail: `${state.name} is not an ending of the Flow and nothing leads out of it, so anybody who gets there is stuck.`,
        recommendation: 'Either declare the step that leads on from it, or mark it as one of the Flow\'s endings.',
      });
      continue;
    }
    // A step that asks for nothing, changes nothing and offers one way on is a page a person clicks through
    // without reading. Worth saying; never worth more than LOW, because sometimes that page is a confirmation
    // somebody wanted.
    if (out.length === 1 && out[0]!.actionClass === 'READ' && out[0]!.inputs.length === 0 && !isEntry(contract, state)) {
      findings.push({
        rule: 'REDUNDANT_STEP', severity: 'LOW', stateKey: state.key, breakpoint: null,
        detail: `${state.name} asks for nothing and offers one way on ("${out[0]!.action ?? out[0]!.id}"), so it is a page people click through rather than use.`,
        recommendation: 'If it is not there to confirm or explain something, the step before it could lead straight on.',
      });
    }
  }

  // A state no permitted route reaches cannot be exercised at all, which is a different thing from a dead end.
  for (const state of contract.states) {
    if (state.key === contract.initialStateKey) continue;
    if (planFlowPath(contract, contract.initialStateKey, state.key, environment, policy).ok) continue;
    findings.push({
      rule: 'DEAD_END', severity: 'LOW', stateKey: state.key, breakpoint: null,
      detail: `No declared route leads from ${contract.initialStateKey} to ${state.name}, so nothing in this Flow can reach it.`,
      recommendation: 'Declare the step that leads to it, or remove it from the Flow.',
    });
  }
  return findings;
}

/** The Flow's own first step, which only opens the application and so legitimately asks for nothing. */
function isEntry(contract: ExecutableContract, state: ExecutableState): boolean {
  return state.key === contract.initialStateKey;
}

// ---------------------------------------------------------------------------
// The page as drawn, at the size the run walked it
// ---------------------------------------------------------------------------

export interface StatePageInput {
  stateKey: string;
  /** The state as the contract declares it, for knowing which controls matter. */
  state: ExecutableState | undefined;
  elements: SemanticElement[];
  page: PageMeasurement | undefined;
  /** The transition the run is about to perform from here, and the ones it could. */
  outgoing: ExecutableContract['transitions'];
  /**
   * How long the run waited for this page to settle after the action that led here. Null when not known — the
   * first state of a run was not arrived at by an action, so nothing waited for it.
   */
  settledMs?: number | null;
  /** Whether the page was saying it was busy while that wait was going on. */
  busyIndicator?: boolean;
}

/**
 * Everything wrong with one state as it was drawn: text too small to read, controls too small to hit, text that
 * does not stand out, and an action that changes something drawn more quietly than one that does not.
 */
export function statePageFindings(input: StatePageInput): UiQualityFinding[] {
  const findings: UiQualityFinding[] = [];
  const { stateKey, page } = input;
  const touch = (page?.viewport.width ?? Infinity) <= TOUCH_WIDTH_PX;
  const where = page ? `${page.viewport.width}x${page.viewport.height}` : null;

  if (page?.smallestTextPx !== null && page?.smallestTextPx !== undefined && page.smallestTextPx < MIN_TEXT_PX) {
    findings.push({
      rule: 'TEXT_TOO_SMALL', severity: 'MEDIUM', stateKey, breakpoint: where,
      detail: `The smallest text on this page is ${round(page.smallestTextPx)}px, below the ${MIN_TEXT_PX}px at which text stops being comfortably readable.`,
      recommendation: 'Raise it to at least 12px, or 14px if people are expected to read it rather than glance at it.',
    });
  }

  if (page && page.horizontalOverflowPx > OVERFLOW_TOLERANCE_PX) {
    findings.push({
      rule: 'HORIZONTAL_OVERFLOW', severity: 'MEDIUM', stateKey, breakpoint: where,
      detail: `This page is ${Math.round(page.horizontalOverflowPx)}px wider than the ${page.viewport.width}px window, so it cannot be read without scrolling sideways.`,
      recommendation: 'Find what sets a width this page cannot afford — a fixed-width table, an unbroken string, an image without a max-width.',
    });
  }

  // Only the controls this state is actually about. Every other element on the page is somebody else's concern.
  const controls = relevantControls(input);
  for (const element of controls) {
    const geometry = element.geometry;
    if (!geometry) continue;
    const { rect } = geometry;

    if (touch && rect.width > 0 && rect.height > 0 && (rect.width < MIN_TAP_TARGET_PX || rect.height < MIN_TAP_TARGET_PX)) {
      findings.push({
        rule: 'TAP_TARGET_TOO_SMALL', severity: 'MEDIUM', stateKey, breakpoint: where,
        detail: `"${named(element)}" is ${Math.round(rect.width)}x${Math.round(rect.height)}px at ${where}, below the ${MIN_TAP_TARGET_PX}x${MIN_TAP_TARGET_PX}px a fingertip needs.`,
        recommendation: 'Give it more padding, or a larger hit area than its visible box.',
      });
    }

    const ratio = contrastRatio(geometry.color, geometry.backgroundColor);
    const needed = requiredContrast(geometry);
    if (ratio !== null && ratio < needed) {
      findings.push({
        rule: 'LOW_CONTRAST', severity: 'MEDIUM', stateKey, breakpoint: where,
        detail: `"${named(element)}" has a contrast ratio of ${round(ratio)}:1 against what it sits on, below the ${needed}:1 WCAG AA asks for text this size.`,
        recommendation: 'Darken the text or lighten the background until the ratio clears the threshold.',
      });
    }
  }

  findings.push(...buttonWeightFindings(input, controls, where));

  if (
    input.settledMs !== null && input.settledMs !== undefined
    && input.settledMs > LOADING_AFFORDANCE_MS && input.busyIndicator === false
  ) {
    findings.push({
      rule: 'NO_LOADING_AFFORDANCE', severity: 'MEDIUM', stateKey, breakpoint: where,
      detail: `This page took ${Math.round(input.settledMs)}ms to finish arriving and showed nothing to say it was working, so for about ${Math.round(input.settledMs / 100) / 10}s it looked finished and empty.`,
      recommendation: 'Show a skeleton or a spinner while the data is on its way, and mark the region aria-busy so it is announced too.',
    });
  }
  return findings;
}

/**
 * The action that changes something drawn more quietly than one that does not.
 *
 * This is the one rule here that is about meaning rather than measurement, so it is held to a narrow case: two
 * controls in the same state, one of which changes server state and one of which does not, where the harmless
 * one is drawn with more visual weight than the consequential one. That is a genuine mistake — it is what makes
 * people click Cancel when they meant Save — and it is narrow enough not to fire on a matter of taste.
 */
function buttonWeightFindings(
  input: StatePageInput,
  controls: SemanticElement[],
  where: string | null,
): UiQualityFinding[] {
  const weighted = input.outgoing
    .map((transition) => {
      const element = controls.find((candidate) => describesControl(transition, candidate));
      return element?.geometry ? { transition, element, weight: EMPHASIS_WEIGHT[element.geometry.emphasis] } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.weight > 0);

  const mutating = weighted.filter((entry) => MUTATING.has(entry.transition.actionClass));
  const harmless = weighted.filter((entry) => entry.transition.actionClass === 'READ');
  if (mutating.length === 0 || harmless.length === 0) return [];

  const quietest = mutating.reduce((lowest, entry) => (entry.weight < lowest.weight ? entry : lowest), mutating[0]!);
  const loudest = harmless.reduce((highest, entry) => (entry.weight > highest.weight ? entry : highest), harmless[0]!);
  if (loudest.weight <= quietest.weight) return [];

  return [{
    rule: 'WRONG_BUTTON_WEIGHT', severity: 'LOW', stateKey: input.stateKey, breakpoint: where,
    detail: `"${named(quietest.element)}" is what changes something here and is drawn as a ${describeEmphasis(quietest.element.geometry!.emphasis)}, `
      + `while "${named(loudest.element)}", which changes nothing, is drawn as a ${describeEmphasis(loudest.element.geometry!.emphasis)}.`,
    recommendation: 'The action with consequences should be the one that looks like the primary action, so people do not click past it.',
  }];
}

function describeEmphasis(emphasis: ElementGeometry['emphasis']): string {
  switch (emphasis) {
    case 'FILLED': return 'primary button';
    case 'OUTLINED': return 'secondary button';
    case 'TEXT': return 'plain text link';
    default: return 'control';
  }
}

/**
 * The controls this state is about: the ones it declares, and the ones its own steps act on. Judging every
 * element on the page would report a site's whole footer as a finding about one Flow state.
 */
function relevantControls(input: StatePageInput): SemanticElement[] {
  const wanted = [
    ...(input.state?.requiredElements ?? []),
    ...(input.state?.optionalElements ?? []),
  ];
  const chosen = new Map<string, SemanticElement>();
  for (const element of input.elements) {
    if (!element.visible || !element.enabled) continue;
    const matches = wanted.some((descriptor) => describesDescriptor(descriptor, element))
      || input.outgoing.some((transition) => describesControl(transition, element));
    if (matches) chosen.set(element.ref, element);
  }
  return [...chosen.values()];
}

const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function describesControl(transition: ExecutableContract['transitions'][number], element: SemanticElement): boolean {
  return transition.control !== null && describesDescriptor(transition.control, element);
}

/** Looser than ranking: is this plausibly the element the descriptor names? Presence, not choice. */
function describesDescriptor(descriptor: { labels: string[]; testId: string | null; domId: string | null; actionAnchor: string | null }, element: SemanticElement): boolean {
  if (descriptor.actionAnchor && element.actionAnchor === descriptor.actionAnchor) return true;
  if (descriptor.testId && element.testId === descriptor.testId) return true;
  if (descriptor.domId && element.domId === descriptor.domId) return true;
  const shown = [normalize(element.name), normalize(element.label)].filter(Boolean);
  return descriptor.labels.some((label) => {
    const wanted = normalize(label);
    return Boolean(wanted) && shown.includes(wanted);
  });
}

// ---------------------------------------------------------------------------
// The same state at other window sizes
// ---------------------------------------------------------------------------

/**
 * What goes wrong when the window is a different shape. One sample per size per state, so a finding names the
 * size it was found at and a Flow that is fine everywhere produces nothing.
 *
 * A control the state needs becoming unreachable is the serious one: that is a Flow that cannot be completed on
 * a phone at all, which no amount of reading the code would have told anybody.
 */
export function responsiveFindings(
  stateKey: string,
  state: ExecutableState | undefined,
  outgoing: ExecutableContract['transitions'],
  samples: ViewportSample[],
): UiQualityFinding[] {
  const findings: UiQualityFinding[] = [];
  for (const sample of samples) {
    const label = `${sample.breakpoint.name} (${sample.breakpoint.width}x${sample.breakpoint.height})`;
    findings.push(...statePageFindings({
      stateKey, state, outgoing, elements: sample.elements, page: sample.page,
    }).map((finding) => ({ ...finding, breakpoint: label })));

    // The step the run is about to take has to be reachable, or the Flow simply cannot be finished at this size.
    for (const transition of outgoing) {
      if (!transition.control) continue;
      const element = sample.elements.find((candidate) => describesControl(transition, candidate));
      if (!element) continue;
      const geometry = element.geometry;
      if (!geometry) continue;
      const unusable = geometry.rect.width < 1 || geometry.rect.height < 1 ? 'has no size'
        : !geometry.hitTestOk ? 'is covered by something else'
        : null;
      if (unusable) {
        findings.push({
          rule: 'CONTROL_UNREACHABLE_AT_SIZE', severity: 'MEDIUM', stateKey, breakpoint: label,
          detail: `"${transition.action ?? named(element)}", which this step needs, ${unusable} at ${label}, so the Flow cannot be completed at that size.`,
          recommendation: 'Check what the layout does to it at this width — a collapsed menu it is hidden behind, an overlay that stays open, a container that gives it no room.',
        });
      }
    }
  }
  return dedupe(findings);
}

/**
 * The same problem at four sizes is one problem, said once with the sizes it applies to. A report that repeats
 * itself five times per state teaches people to stop reading it.
 */
export function dedupe(findings: UiQualityFinding[]): UiQualityFinding[] {
  const byKey = new Map<string, { finding: UiQualityFinding; sizes: string[] }>();
  for (const finding of findings) {
    // Keyed on the rule and what it is about, not on the numbers, which differ per size by definition.
    const key = `${finding.rule}|${finding.stateKey}|${finding.detail.replace(/\d+(\.\d+)?/g, '#')}`;
    const seen = byKey.get(key);
    if (seen) {
      if (finding.breakpoint && !seen.sizes.includes(finding.breakpoint)) seen.sizes.push(finding.breakpoint);
      continue;
    }
    byKey.set(key, { finding, sizes: finding.breakpoint ? [finding.breakpoint] : [] });
  }
  return [...byKey.values()].map(({ finding, sizes }) =>
    (sizes.length > 1 ? { ...finding, breakpoint: sizes.join(', ') } : finding));
}

/** Worst first, then by rule, so a report's order is the order somebody should work in. */
export function rankFindings(findings: UiQualityFinding[]): UiQualityFinding[] {
  const weight = (finding: UiQualityFinding) => (finding.severity === 'MEDIUM' ? 0 : 1);
  return [...findings].sort((a, b) => weight(a) - weight(b) || a.rule.localeCompare(b.rule) || (a.stateKey ?? '').localeCompare(b.stateKey ?? ''));
}

/** The breakpoints a run checks when it is not told otherwise: the shapes people actually hold and sit at. */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'foldable', width: 673, height: 841 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1680, height: 1050 },
];
