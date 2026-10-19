import assert from 'node:assert/strict';
import test from 'node:test';
import { element } from './test-fixtures';
import {
  contrastRatio,
  describeObscured,
  obscuredReason,
  parseColor,
  requiredContrast,
  verifyVisually,
  visualTieBreak,
} from './visual';
import type { ControlCandidate, ElementGeometry, SemanticElement } from './types';

const geometry = (over: Partial<ElementGeometry> = {}): ElementGeometry => ({
  rect: { x: 10, y: 10, width: 120, height: 40 },
  inViewport: true,
  hitTestOk: true,
  fontSizePx: 16,
  fontWeight: 400,
  color: 'rgb(255, 255, 255)',
  backgroundColor: 'rgb(37, 99, 235)',
  borderWidthPx: 0,
  borderStyle: 'none',
  cursor: 'pointer',
  opacity: 1,
  emphasis: 'FILLED',
  ...over,
});

const drawn = (ref: string, over: Partial<ElementGeometry> = {}, rest: Partial<SemanticElement> = {}): SemanticElement =>
  ({ ...element({ ref, ...rest }), geometry: geometry(over) });

const candidate = (el: SemanticElement, score = 0.85): ControlCandidate => ({ element: el, method: 'ROLE_NAME', score });

// -- a control a person could not use --------------------------------------------------------------

test('a box with no size, one off screen and one with something on top of it are told apart', () => {
  assert.equal(obscuredReason(drawn('a', { rect: { x: 0, y: 0, width: 0, height: 0 } })), 'ZERO_SIZE');
  assert.equal(obscuredReason(drawn('b', { inViewport: false })), 'OFF_SCREEN');
  assert.equal(obscuredReason(drawn('c', { hitTestOk: false })), 'COVERED');
  assert.equal(obscuredReason(drawn('d')), null);
});

test('an element that was never measured is never reported as a problem', () => {
  // Not measuring is not evidence. A run must never fail over a measurement it did not take.
  assert.equal(obscuredReason(element({ ref: 'x' })), null);
  assert.deepEqual(verifyVisually(element({ ref: 'x' })), { usable: true });
});

test('being scrolled away is not a failure, because the adapter scrolls to a control before acting', () => {
  assert.deepEqual(verifyVisually(drawn('a', { inViewport: false })), { usable: true });
  assert.deepEqual(verifyVisually(drawn('b', { hitTestOk: false })), { usable: false, reason: 'COVERED' });
  assert.deepEqual(verifyVisually(drawn('c', { rect: { x: 0, y: 0, width: 1, height: 1 } })), { usable: false, reason: 'ZERO_SIZE' });
});

test('what is said about an unusable control names what a person would have found', () => {
  assert.match(describeObscured('COVERED', '"Save exam"'), /something is drawn on top of it/);
  assert.match(describeObscured('COVERED', '"Save exam"'), /"Save exam"/);
  assert.match(describeObscured('ZERO_SIZE', 'the step'), /no size/);
  assert.match(describeObscured('OFF_SCREEN', 'the step'), /outside the window/);
});

// -- separating controls the code cannot ------------------------------------------------------------

test('the one a person could actually click wins', () => {
  const chosen = visualTieBreak([
    candidate(drawn('hidden', { hitTestOk: false })),
    candidate(drawn('real')),
  ]);
  assert.equal(chosen?.ref, 'real');
  assert.ok(chosen!.because.some((reason) => /actually click/.test(reason)));
});

test('on screen beats scrolled away, and styled-as-clickable beats not', () => {
  assert.equal(visualTieBreak([candidate(drawn('away', { inViewport: false })), candidate(drawn('here'))])?.ref, 'here');
  assert.equal(
    visualTieBreak([
      candidate(drawn('plain', { cursor: 'default', emphasis: 'TEXT' })),
      candidate(drawn('button', { cursor: 'pointer', emphasis: 'TEXT' })),
    ])?.ref,
    'button',
  );
});

test('a visually heavier control wins, because that is how an application marks its primary action', () => {
  const chosen = visualTieBreak([
    candidate(drawn('ghost', { emphasis: 'TEXT' })),
    candidate(drawn('primary', { emphasis: 'FILLED' })),
  ]);
  assert.equal(chosen?.ref, 'primary');
  assert.ok(chosen!.because.some((reason) => /primary action/.test(reason)));
});

test('two controls the rendered page cannot separate either are refused, not guessed at', () => {
  // Identical in every respect. This is exactly where guessing is worst, so the run stops as it always did.
  assert.equal(visualTieBreak([candidate(drawn('a')), candidate(drawn('b'))]), null);
});

test('nothing is decided from a page that was not measured, or measured only in part', () => {
  assert.equal(visualTieBreak([candidate(element({ ref: 'a' })), candidate(element({ ref: 'b' }))]), null);
  assert.equal(visualTieBreak([candidate(drawn('a')), candidate(element({ ref: 'b' }))]), null, 'half-measured is no basis for a choice');
  assert.equal(visualTieBreak([candidate(drawn('only'))]), null, 'one candidate is not a tie');
  assert.equal(visualTieBreak([]), null);
});

// -- colour ----------------------------------------------------------------------------------------

test('colours are read in the forms a browser reports them in', () => {
  assert.deepEqual(parseColor('rgb(17, 24, 39)'), { r: 17, g: 24, b: 39, a: 1 });
  assert.deepEqual(parseColor('rgba(17, 24, 39, 0.5)'), { r: 17, g: 24, b: 39, a: 0.5 });
  assert.deepEqual(parseColor('rgb(17 24 39 / 50%)'), { r: 17, g: 24, b: 39, a: 0.5 });
  assert.deepEqual(parseColor('#111827'), { r: 17, g: 24, b: 39, a: 1 });
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.equal(parseColor('transparent'), null, 'a keyword is not something to compute a ratio from');
  assert.equal(parseColor(null), null);
});

test('contrast is the ratio WCAG defines, and semi-transparent text is composited first', () => {
  // Black on white is the maximum, 21:1.
  assert.equal(Math.round(contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')!), 21);
  assert.equal(Math.round(contrastRatio('rgb(255, 255, 255)', 'rgb(255, 255, 255)')!), 1);
  // Grey-on-white at half opacity reads lighter than it is declared, which is what a person sees.
  const declared = contrastRatio('rgb(100, 100, 100)', 'rgb(255, 255, 255)')!;
  const faded = contrastRatio('rgba(100, 100, 100, 0.5)', 'rgb(255, 255, 255)')!;
  assert.ok(faded < declared);
  assert.equal(contrastRatio('rgb(0, 0, 0)', null), null, 'with nothing to read it against there is no ratio');
  assert.equal(contrastRatio('rgb(0,0,0)', 'rgba(0, 0, 0, 0)'), null);
});

test('large text is allowed less contrast, which is why the size has to be known first', () => {
  assert.equal(requiredContrast({ fontSizePx: 16, fontWeight: 400 }), 4.5);
  assert.equal(requiredContrast({ fontSizePx: 24, fontWeight: 400 }), 3);
  assert.equal(requiredContrast({ fontSizePx: 19, fontWeight: 700 }), 3, 'bold counts as large from 18.66px');
  assert.equal(requiredContrast({ fontSizePx: 19, fontWeight: 400 }), 4.5);
  assert.equal(requiredContrast({ fontSizePx: null, fontWeight: null }), 4.5, 'unknown is treated as ordinary body text');
});
