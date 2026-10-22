import assert from 'node:assert/strict';
import test from 'node:test';
import { applyScreenAnalysis, detectionOverlapsElement, hasVisualText, screenFingerprint } from './screen-analysis';
import { element, snapshot } from './test-fixtures';

function geometry(rect: { x: number; y: number; width: number; height: number }) {
  return {
    rect, inViewport: true, hitTestOk: true, fontSizePx: 16, fontWeight: 600, color: null,
    backgroundColor: null, borderWidthPx: 0, borderStyle: null, cursor: 'pointer', opacity: 1,
    emphasis: 'FILLED' as const,
  };
}

const measured = snapshot({
  path: '/screen',
  page: { viewport: { width: 1000, height: 500 }, horizontalOverflowPx: 0, smallestTextPx: 12 },
  elements: [element({
    ref: 'continue', name: null, geometry: {
      rect: { x: 100, y: 100, width: 200, height: 50 }, inViewport: true, hitTestOk: true,
      fontSizePx: 16, fontWeight: 600, color: null, backgroundColor: null, borderWidthPx: 0,
      borderStyle: null, cursor: 'pointer', opacity: 1, emphasis: 'FILLED',
    },
  })],
});

test('maps OCR pixels to existing DOM geometry without creating elements', () => {
  assert.equal(detectionOverlapsElement([200, 200, 600, 300], { width: 2000, height: 1000 }, measured, measured.elements[0]!), true);
  const applied = applyScreenAnalysis(measured, {
    requestId: 'r', model: 'm', modelRevision: 'v', image: { width: 2000, height: 1000 },
    text: 'Continue', detections: [{ type: 'text', text: 'Continue', boxPixels: [200, 200, 600, 300] }], latencyMs: 1,
  });
  assert.deepEqual(applied.matchedRefs, ['continue']);
  assert.deepEqual(applied.snapshot.elements.map((item) => item.ref), ['continue']);
  assert.deepEqual(applied.snapshot.elements[0]?.visualText, ['Continue']);
});

test('screen fingerprints ignore transient OCR enrichment', () => {
  assert.equal(screenFingerprint(measured), screenFingerprint({ ...measured, visualText: ['Continue'] }));
});

test('treats non-positive image dimensions as no match', () => {
  assert.equal(detectionOverlapsElement([10, 10, 50, 50], { width: 0, height: 1000 }, measured, measured.elements[0]!), false);
  assert.equal(detectionOverlapsElement([10, 10, 50, 50], { width: 1000, height: -5 }, measured, measured.elements[0]!), false);
});

test('does not match a detection box that does not overlap the element geometry', () => {
  assert.equal(detectionOverlapsElement([900, 400, 950, 450], { width: 1000, height: 500 }, measured, measured.elements[0]!), false);
  const applied = applyScreenAnalysis(measured, {
    requestId: 'r', model: 'm', modelRevision: 'v', image: { width: 1000, height: 500 },
    text: '', detections: [{ type: 'text', text: 'Far away', boxPixels: [900, 400, 950, 450] }], latencyMs: 1,
  });
  assert.deepEqual(applied.matchedRefs, []);
  assert.equal(applied.snapshot.elements[0]?.visualText, undefined);
});

test('caps matched text per element and merges without duplicating existing matches', () => {
  const withExisting = { ...measured, elements: [{ ...measured.elements[0]!, visualText: ['Old'] }] };
  const detections = Array.from({ length: 9 }, (_, index) => ({
    type: 'text' as const, text: `T${index}`, boxPixels: [110, 110, 190, 140] as [number, number, number, number],
  }));
  const applied = applyScreenAnalysis(withExisting, {
    requestId: 'r', model: 'm', modelRevision: 'v', image: { width: 1000, height: 500 }, text: '', detections, latencyMs: 1,
  });
  assert.deepEqual(applied.matchedRefs, ['continue']);
  assert.deepEqual(applied.snapshot.elements[0]?.visualText, ['Old', 'T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
});

test('matches independent detections to their own elements', () => {
  const multi = snapshot({
    path: '/screen',
    page: { viewport: { width: 1000, height: 500 }, horizontalOverflowPx: 0, smallestTextPx: 12 },
    elements: [
      element({ ref: 'a', name: null, geometry: geometry({ x: 0, y: 0, width: 100, height: 100 }) }),
      element({ ref: 'b', name: null, geometry: geometry({ x: 200, y: 200, width: 100, height: 100 }) }),
    ],
  });
  const applied = applyScreenAnalysis(multi, {
    requestId: 'r', model: 'm', modelRevision: 'v', image: { width: 1000, height: 500 },
    text: '',
    detections: [
      { type: 'text', text: 'A-text', boxPixels: [10, 10, 50, 50] },
      { type: 'text', text: 'B-text', boxPixels: [210, 210, 250, 250] },
    ],
    latencyMs: 1,
  });
  assert.deepEqual(applied.matchedRefs, ['a', 'b']);
  assert.deepEqual(applied.snapshot.elements[0]?.visualText, ['A-text']);
  assert.deepEqual(applied.snapshot.elements[1]?.visualText, ['B-text']);
});

test('collects deduped, trimmed document-level visual text lines', () => {
  const withExisting = { ...measured, visualText: ['Already'] };
  const applied = applyScreenAnalysis(withExisting, {
    requestId: 'r', model: 'm', modelRevision: 'v', image: { width: 1000, height: 500 },
    text: 'Hello\n\nHello\nWorld  \n', detections: [], latencyMs: 1,
  });
  assert.deepEqual(applied.snapshot.visualText, ['Already', 'Hello', 'World']);
});

test('hasVisualText matches case-insensitively by substring and rejects unmatched labels', () => {
  const withText = { ...measured.elements[0]!, visualText: ['Continue Now'] };
  assert.equal(hasVisualText(withText, ['continue']), true);
  assert.equal(hasVisualText(withText, ['Cancel']), false);
  assert.equal(hasVisualText(measured.elements[0]!, ['continue']), false);
});
