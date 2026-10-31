import type { DeclaredFlowSummary, RuleBasedSuggestionItem } from './schema';

/**
 * Two or more transitions that leave the same state toward different destinations, with
 * no `condition` on any of them, cannot be told apart by a run — and usually can't be told
 * apart by a reader either. Most of the time this means a branch the source material
 * described (an "if X / otherwise Y", a threshold) got collapsed into parallel paths
 * instead of distinct, named cases.
 *
 * A state with two transitions to the SAME destination is not flagged (that is just two
 * ways to do the same thing, e.g. two buttons that both submit a form) — only branches
 * that actually diverge.
 */
export function findAmbiguousBranches(flow: DeclaredFlowSummary): RuleBasedSuggestionItem[] {
  const byOrigin = new Map<string, DeclaredFlowSummary['transitions']>();
  for (const transition of flow.transitions) {
    const list = byOrigin.get(transition.from) ?? [];
    list.push(transition);
    byOrigin.set(transition.from, list);
  }

  const suggestions: RuleBasedSuggestionItem[] = [];
  for (const [from, transitions] of byOrigin) {
    const destinations = new Set(transitions.map((transition) => transition.to));
    if (destinations.size < 2) continue;
    if (transitions.every((transition) => transition.condition)) continue;

    const destinationList = [...destinations].join(', ');
    suggestions.push({
      type: 'AMBIGUOUS_BRANCH',
      title: `${from} branches without conditions`,
      description: `${from} leads to ${destinations.size} different states (${destinationList}) and at least one of those transitions has no "condition" distinguishing it from the others.`,
      rationale: 'A run (and a reader) cannot tell which outcome applies without a condition on each branch. This is usually a sign a documented "if X, otherwise Y" case was modeled as parallel paths instead of a real branch.',
      confidence: 0.6,
      severity: 'MEDIUM',
      targetNodeId: from,
      evidence: transitions.map((transition) => `${transition.from} → ${transition.to}${transition.action ? ` [${transition.action}]` : ''}${transition.condition ? ` (${transition.condition})` : ' (no condition)'}`),
    });
  }
  return suggestions;
}
