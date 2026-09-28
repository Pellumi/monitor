import { Project, SyntaxKind } from 'ts-morph';
import type { JsxOpeningElement, JsxSelfClosingElement, SourceFile } from 'ts-morph';

/**
 * Stable anchors on the controls a Flow's transitions go through.
 *
 * To perform a transition Automated Run has to find its control on the live page. Everything it can find one by
 * except an anchor is a property of how the control *looks*: its visible text, its accessible name, its position. Those
 * change whenever someone rewords a button, and a run that worked on Monday then stops on Tuesday for a reason that has
 * nothing to do with the Flow. An anchor is a `data-tellann-action` attribute the application carries on the control
 * itself, so it survives every rewording. It is the first thing the engine looks for and the strongest match it has.
 *
 * It goes through the same review as every other instrumentation change: it is a proposed operation, shown as a diff,
 * approved per file, checkpointed and reversible. It is also deliberately conservative about *where* it will write:
 *
 *  - only an element that can be found unambiguously at the location the code analysis gave for the control;
 *  - only a native (lowercase) element, since a custom component may not pass the attribute on to the DOM, and an
 *    anchor that never reaches the page is noise in someone's source;
 *  - never over an anchor that is already there under a different value.
 *
 * Anything else is left alone and reported as skipped with the reason. The anchor is an improvement to robustness, so a
 * control that cannot be anchored is not an error: the engine simply finds it the way it did before.
 */

export const ANCHOR_ATTRIBUTE = 'data-tellann-action';
export const ANCHOR_TRANSFORM_ID = 'tellann.action.anchor';
export const ANCHOR_VALUE_PATTERN = /^[A-Za-z0-9:_.-]{1,120}$/;

export interface ControlAnchorLocation {
  file: string;
  /** Where the code analysis found the control: the line its element starts on, and where it ends. */
  startLine: number;
  endLine: number;
  /** The element's tag as the analysis recorded it (`button`, `a`, `Link`), when it did. */
  element: string | null;
}

export type AnchorSkipReason =
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  /** A custom component: it may not hand the attribute to the DOM, so an anchor there could silently do nothing. */
  | 'CUSTOM_COMPONENT'
  | 'ANCHORED_DIFFERENTLY'
  | 'NOT_JSX'
  | 'UNREADABLE';

export type AnchorLookup =
  | { ok: true; element: JsxOpeningElement | JsxSelfClosingElement; alreadyAnchored: boolean }
  | { ok: false; reason: AnchorSkipReason };

const JSX_FILE = /\.[cm]?[jt]sx$/;

/** Find the one element a control lives in, or say why there is not exactly one safe answer. */
export function locateControlElement(source: SourceFile, target: ControlAnchorLocation, value: string): AnchorLookup {
  if (!JSX_FILE.test(source.getFilePath())) return { ok: false, reason: 'NOT_JSX' };
  const all: Array<JsxOpeningElement | JsxSelfClosingElement> = [
    ...source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  const within = all.filter((node) => {
    const line = node.getStartLineNumber();
    return line >= target.startLine && line <= Math.max(target.startLine, target.endLine);
  });
  let candidates = within;
  if (target.element) {
    const tagged = within.filter((node) => node.getTagNameNode().getText() === target.element);
    candidates = tagged;
  }
  if (candidates.length > 1) {
    // A wrapper and the control inside it can both start in range; the one on the recorded line is the control.
    const exact = candidates.filter((node) => node.getStartLineNumber() === target.startLine);
    if (exact.length >= 1) candidates = exact;
  }
  if (candidates.length === 0) return { ok: false, reason: 'NOT_FOUND' };
  if (candidates.length > 1) return { ok: false, reason: 'AMBIGUOUS' };
  const element = candidates[0]!;
  const tag = element.getTagNameNode().getText();
  // `Link`, `Button`, `motion.div`: capitalised or dotted means a component, not a DOM element.
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) return { ok: false, reason: 'CUSTOM_COMPONENT' };
  const existing = element.getAttribute(ANCHOR_ATTRIBUTE);
  if (existing) {
    const text = existing.getText();
    return text.includes(value) ? { ok: true, element, alreadyAnchored: true } : { ok: false, reason: 'ANCHORED_DIFFERENTLY' };
  }
  return { ok: true, element, alreadyAnchored: false };
}

/** Whether a control could be anchored in this file as it stands. Used when proposing, so a plan never contains an operation that cannot be applied. */
export function checkAnchorTarget(filePath: string, content: string, target: ControlAnchorLocation, value: string): { ok: true } | { ok: false; reason: AnchorSkipReason } {
  try {
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const lookup = locateControlElement(project.createSourceFile(filePath, content), target, value);
    return lookup.ok ? { ok: true } : lookup;
  } catch {
    return { ok: false, reason: 'UNREADABLE' };
  }
}

/** Put the anchor on the control. Idempotent: applying twice leaves one attribute. */
export function applyControlAnchor(source: SourceFile, target: ControlAnchorLocation, value: string, operationId: string): void {
  if (!ANCHOR_VALUE_PATTERN.test(value)) throw new Error(`INVALID_CONTROL_ANCHOR_VALUE:${operationId}`);
  const lookup = locateControlElement(source, target, value);
  if (!lookup.ok) throw new Error(`SAFE_CONTROL_ELEMENT_NOT_FOUND:${operationId}:${lookup.reason}`);
  if (lookup.alreadyAnchored) return;
  lookup.element.addAttribute({ name: ANCHOR_ATTRIBUTE, initializer: JSON.stringify(value) });
}
