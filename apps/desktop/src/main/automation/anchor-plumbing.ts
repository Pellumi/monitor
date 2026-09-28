import { appliedAnchors } from "@tellann/automation-engine";

/**
 * Which `data-tellann-action` anchors are really in the developer's source right now.
 *
 * An instrumentation plan says which anchors it *intended* to put on controls. What a run may trust is different: a control
 * matched by anchor is treated as certain, so an anchor that a rollback removed, or that a later edit displaced, must
 * not be claimed. The plan is therefore only where candidates come from; each one is kept only if its attribute is in the
 * file it was applied to, exactly once.
 */

export interface PlanLike {
  operations: Array<{ transformId: string; id: string; relativePath: string; anchorAttribute?: { name?: string; value: string } | null }>;
}

const ATTRIBUTE = "data-tellann-action";

export function verifiedAnchors(plans: PlanLike[], readSource: (relativePath: string) => string | null): Record<string, string> {
  const verified: Record<string, string> = {};
  for (const plan of plans) {
    const candidates = appliedAnchors(plan as never);
    for (const operation of plan.operations) {
      if (operation.transformId !== "tellann.action.anchor" || !operation.id.startsWith("anchor:")) continue;
      const transitionId = operation.id.slice("anchor:".length);
      const value = candidates[transitionId];
      if (!value) continue;
      const source = readSource(operation.relativePath);
      if (source === null) continue;
      const occurrences = source.split(`${ATTRIBUTE}="${value}"`).length - 1;
      if (occurrences === 1) verified[transitionId] = value;
    }
  }
  return verified;
}

/** The anchors a plan applied, in the shape the adapter checks them in when it validates. */
export function anchorTargetsOfPlan(plan: PlanLike & { operations: Array<{ startLine?: number; endLine?: number }> }): Array<{ transitionId: string; value: string; file: string; startLine: number; endLine: number; element: string | null; label: null }> {
  return plan.operations.flatMap((operation) => {
    const item = operation as PlanLike["operations"][number] & { startLine?: number; endLine?: number; anchorAttribute?: { value: string; element?: string | null } | null };
    if (item.transformId !== "tellann.action.anchor" || !item.id.startsWith("anchor:") || !item.anchorAttribute?.value) return [];
    return [{
      transitionId: item.id.slice("anchor:".length), value: item.anchorAttribute.value, file: item.relativePath,
      startLine: item.startLine ?? 1, endLine: item.endLine ?? item.startLine ?? 1, element: item.anchorAttribute.element ?? null, label: null,
    }];
  });
}
