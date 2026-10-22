import { normalizeText } from './keys';
import type { ScreenAnalysisResult, SemanticElement, SemanticSnapshot } from './types';

const MAX_VISUAL_TEXT_PER_ELEMENT = 8;

function intersectionArea(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

export function detectionOverlapsElement(
  boxPixels: [number, number, number, number],
  image: { width: number; height: number },
  snapshot: SemanticSnapshot,
  element: SemanticElement,
): boolean {
  if (!element.geometry || !snapshot.page || image.width <= 0 || image.height <= 0) return false;
  const [x1, y1, x2, y2] = boxPixels;
  if (x2 <= x1 || y2 <= y1) return false;
  const viewport = snapshot.page.viewport;
  const detection = {
    x: x1 * viewport.width / image.width,
    y: y1 * viewport.height / image.height,
    width: (x2 - x1) * viewport.width / image.width,
    height: (y2 - y1) * viewport.height / image.height,
  };
  const rect = element.geometry.rect;
  const overlap = intersectionArea(detection, rect);
  if (overlap <= 0) return false;
  const detectionArea = detection.width * detection.height;
  const elementArea = rect.width * rect.height;
  const centerX = detection.x + detection.width / 2;
  const centerY = detection.y + detection.height / 2;
  const centerInside = centerX >= rect.x && centerX <= rect.x + rect.width
    && centerY >= rect.y && centerY <= rect.y + rect.height;
  return centerInside || overlap / Math.max(1, Math.min(detectionArea, elementArea)) >= 0.5;
}

export function applyScreenAnalysis(
  snapshot: SemanticSnapshot,
  analysis: ScreenAnalysisResult,
): { snapshot: SemanticSnapshot; matchedRefs: string[] } {
  const matchedRefs: string[] = [];
  const elements = snapshot.elements.map((element) => {
    const visualText = analysis.detections
      .filter((detection) => detection.text && detectionOverlapsElement(detection.boxPixels, analysis.image, snapshot, element))
      .map((detection) => detection.text.trim())
      .filter(Boolean)
      .slice(0, MAX_VISUAL_TEXT_PER_ELEMENT);
    if (visualText.length === 0) return element;
    matchedRefs.push(element.ref);
    return { ...element, visualText: [...new Set([...(element.visualText ?? []), ...visualText])] };
  });
  const visualText = analysis.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    snapshot: { ...snapshot, elements, visualText: [...new Set([...(snapshot.visualText ?? []), ...visualText])] },
    matchedRefs,
  };
}

/** Stable enough to prevent repeated billing for an unchanged rendered decision. */
export function screenFingerprint(snapshot: SemanticSnapshot): string {
  return JSON.stringify({
    path: snapshot.path,
    title: snapshot.title,
    headings: snapshot.headings,
    elements: snapshot.elements.map((element) => [
      element.ref, element.role, element.name, element.label, element.visible, element.enabled,
      element.geometry?.rect.x, element.geometry?.rect.y, element.geometry?.rect.width, element.geometry?.rect.height,
    ]),
  });
}

export function hasVisualText(element: SemanticElement, labels: string[]): boolean {
  const shown = (element.visualText ?? []).map(normalizeText).filter(Boolean);
  return labels.map(normalizeText).filter(Boolean).some((wanted) => shown.some((value) => value === wanted || value.includes(wanted)));
}
