import type { ExecutableContract } from './types';

/**
 * Which controls should carry a stable anchor, worked out from a compiled contract.
 *
 * The result is what the instrumentation adapter is handed (`controlAnchors`): one entry per transition whose control
 * the analysis located at exactly one place in source. The value is made from the transition's id, so it never depends on
 * what the control says or looks like: that is the point of an anchor.
 */

export interface AnchorTarget {
  transitionId: string;
  value: string;
  file: string;
  startLine: number;
  endLine: number;
  element: string | null;
  label: string | null;
}

/** The anchor value for a transition. Constant for the life of the transition, whatever happens to its control. */
export function anchorValueFor(transitionId: string): string {
  // Only characters the attribute value pattern allows; a transition id that is not already one is reduced to them.
  return `tellann:${transitionId.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 100)}`;
}

export function controlAnchorTargets(contract: ExecutableContract): AnchorTarget[] {
  return contract.transitions.flatMap((transition): AnchorTarget[] => {
    const source = transition.controlSource;
    if (!source || !transition.control) return [];
    return [{
      transitionId: transition.id,
      value: anchorValueFor(transition.id),
      file: source.file,
      startLine: source.startLine,
      endLine: source.endLine,
      element: source.element,
      label: transition.action ?? transition.control.labels[0] ?? null,
    }];
  });
}

/**
 * The anchors a plan actually applied, as the compiler wants them: only these are trusted to be on the page.
 * Reads the operations of an applied instrumentation plan (any object shaped like one).
 */
export function appliedAnchors(plan: { operations: Array<{ transformId: string; id: string; anchorAttribute?: { value: string } | null }> } | null | undefined): Record<string, string> {
  const anchors: Record<string, string> = {};
  for (const operation of plan?.operations ?? []) {
    if (operation.transformId === 'tellann.action.anchor' && operation.anchorAttribute?.value && operation.id.startsWith('anchor:')) {
      anchors[operation.id.slice('anchor:'.length)] = operation.anchorAttribute.value;
    }
  }
  return anchors;
}
