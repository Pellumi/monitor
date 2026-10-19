import type { ControlCandidate, ElementGeometry, SemanticElement } from './types';

/**
 * Reading the rendered page, deterministically.
 *
 * The engine decides what to click from the code that handles the step and the DOM that is on the page. That is
 * the right default — it is reproducible, auditable and needs nothing but the page itself — but it is blind to
 * two things a person using the application would notice immediately: that one of two identical-looking buttons
 * is the one actually on screen, and that the button it picked is underneath a cookie banner.
 *
 * So this is the third kind of evidence, after the code and the DOM: what the browser actually drew. Everything
 * here is a number compared with a number, so a run that consults it stays as reproducible as one that does not,
 * and a page that offers no geometry falls back to exactly the behaviour the engine had before.
 *
 * It never *widens* what a run will touch. `visualTieBreak` chooses among candidates the ranking already found
 * and already deemed equal; `verifyVisually` can only refuse the one it was given. Neither can introduce a
 * control, and neither overrides the code: a candidate the code did not describe never reaches here.
 */

/** Below this a box is a layout artefact, not something a person clicks. */
const MIN_CLICKABLE_PX = 2;

/** Weight given to each piece of visual evidence when separating two controls the code cannot. */
const EMPHASIS_RANK: Record<ElementGeometry['emphasis'], number> = {
  FILLED: 3,
  OUTLINED: 2,
  TEXT: 1,
  UNKNOWN: 0,
};

export type ObscuredReason = 'ZERO_SIZE' | 'OFF_SCREEN' | 'COVERED';

/**
 * Why a control the code correctly identified still could not be acted on, or null when it can.
 *
 * Returning null for an element with no geometry is deliberate: not measuring is not evidence of a problem, and
 * a run must never fail over a measurement it did not take.
 */
export function obscuredReason(element: SemanticElement): ObscuredReason | null {
  const geometry = element.geometry;
  if (!geometry) return null;
  const { rect } = geometry;
  if (rect.width < MIN_CLICKABLE_PX || rect.height < MIN_CLICKABLE_PX) return 'ZERO_SIZE';
  if (!geometry.inViewport) return 'OFF_SCREEN';
  if (!geometry.hitTestOk) return 'COVERED';
  return null;
}

/** What to tell somebody about a control that is there in the markup and not there to a person. */
export function describeObscured(reason: ObscuredReason, label: string): string {
  switch (reason) {
    case 'ZERO_SIZE':
      return `${label} is on the page but has no size, so there is nothing for anybody to click.`;
    case 'OFF_SCREEN':
      return `${label} is on the page but outside the window, so it could not be reached at this size.`;
    case 'COVERED':
      return `${label} is on the page but something is drawn on top of it, so a click would land on that instead.`;
  }
}

/**
 * Whether the control the engine chose is one a person could actually use. `OFF_SCREEN` is not a failure on its
 * own — the adapter scrolls to an element before acting — so only the two that scrolling cannot fix are refused.
 */
export function verifyVisually(element: SemanticElement): { usable: true } | { usable: false; reason: ObscuredReason } {
  const reason = obscuredReason(element);
  return reason === null || reason === 'OFF_SCREEN' ? { usable: true } : { usable: false, reason };
}

export interface VisualChoice {
  ref: string;
  /** Why this one, in the words a report uses. */
  because: string[];
}

/**
 * Separate controls the code and the DOM rank equally, using only what the browser drew.
 *
 * In order of how much it tells you: a control a person could click beats one they could not; one on screen
 * beats one scrolled away; one the page styles as clickable beats one it does not; and a visually heavier
 * control beats a lighter one, because that is how applications mark the primary action. Returns null when the
 * rendered page separates them no better than the code did — which is the honest answer, and leaves the run
 * stopping exactly as it would have.
 */
export function visualTieBreak(tied: ControlCandidate[]): VisualChoice | null {
  if (tied.length < 2) return null;
  const measured = tied.filter((candidate) => candidate.element.geometry);
  // Nothing to go on, or not enough: this is not a decision the rendered page can make either.
  if (measured.length < 2 || measured.length !== tied.length) return null;

  const scored = measured.map((candidate) => ({ candidate, ...scoreOf(candidate.element) }));
  const best = scored.reduce((winner, entry) => (entry.score > winner.score ? entry : winner), scored[0]!);
  // A tie on the rendered page too. Two controls that look the same and sit in the same place is exactly the
  // situation where guessing is worst, so it is refused.
  if (scored.filter((entry) => entry.score === best.score).length > 1) return null;
  return { ref: best.candidate.element.ref, because: best.because };
}

function scoreOf(element: SemanticElement): { score: number; because: string[] } {
  const geometry = element.geometry!;
  const because: string[] = [];
  let score = 0;
  if (obscuredReason(element) === null) {
    score += 100;
    because.push('the only one a person could actually click');
  } else if (geometry.inViewport && geometry.hitTestOk) {
    score += 50;
  }
  if (geometry.inViewport) {
    score += 20;
    because.push('on screen');
  }
  if (geometry.cursor === 'pointer') {
    score += 10;
    because.push('styled as clickable');
  }
  const emphasis = EMPHASIS_RANK[geometry.emphasis];
  score += emphasis;
  if (emphasis >= EMPHASIS_RANK.OUTLINED) because.push(`drawn as the ${geometry.emphasis === 'FILLED' ? 'primary' : 'secondary'} action`);
  return { score, because };
}

// ---------------------------------------------------------------------------
// Colour, for contrast
// ---------------------------------------------------------------------------

/** `rgb(17, 24, 39)` / `rgba(17, 24, 39, 0.8)` / `#111827` to channels, or null for anything else. */
export function parseColor(value: string | null | undefined): { r: number; g: number; b: number; a: number } | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4]);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: Number.isFinite(alpha) ? alpha : 1 };
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const digits = hex[1]!.length === 3 ? hex[1]!.split('').map((digit) => digit + digit).join('') : hex[1]!;
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), a: 1 };
  }
  return null;
}

/** Relative luminance, as WCAG defines it. */
function luminance(channel: { r: number; g: number; b: number }): number {
  const scale = (value: number) => {
    const fraction = value / 255;
    return fraction <= 0.03928 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * scale(channel.r) + 0.7152 * scale(channel.g) + 0.0722 * scale(channel.b);
}

/**
 * The contrast ratio between text and what it sits on, as WCAG defines it, or null when either colour cannot be
 * read. Semi-transparent text is composited onto its background first, because that is what a person sees.
 */
export function contrastRatio(foreground: string | null | undefined, background: string | null | undefined): number | null {
  const text = parseColor(foreground);
  const behind = parseColor(background);
  if (!text || !behind || behind.a === 0) return null;
  const composited = text.a >= 1
    ? text
    : {
      r: text.r * text.a + behind.r * (1 - text.a),
      g: text.g * text.a + behind.g * (1 - text.a),
      b: text.b * text.a + behind.b * (1 - text.a),
    };
  const lighter = Math.max(luminance(composited), luminance(behind));
  const darker = Math.min(luminance(composited), luminance(behind));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The ratio WCAG AA asks of this text. Large text (18pt, or 14pt bold) is allowed less, which is why the size
 * and weight have to be known before the number means anything.
 */
export function requiredContrast(geometry: Pick<ElementGeometry, 'fontSizePx' | 'fontWeight'>): number {
  const size = geometry.fontSizePx ?? 16;
  const bold = (geometry.fontWeight ?? 400) >= 700;
  const large = size >= 24 || (bold && size >= 18.66);
  return large ? 3 : 4.5;
}
