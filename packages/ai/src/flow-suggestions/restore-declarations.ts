import { isStatedInDocument } from '../flow-grounding';
import type { DroppedDeclarationInput, RuleBasedSuggestionItem } from './schema';

/**
 * Document generation drops a state, transition, or sub-field it cannot verify — most
 * often because no text was available to check it against at the time (a PDF with no
 * extractable text layer, or extraction that failed). That drop is permanent today: a
 * reviewer never sees it again unless they re-read the original document by hand.
 *
 * This re-checks each previously dropped declaration (`BehaviorGraph.aiDraftIssues.leftOut`)
 * against text that is now available — typically because the document was re-processed,
 * or because grounding has since been fixed to extract text for this mime type — and turns
 * one that now checks out into a suggestion, rather than leaving the loss silent and final.
 *
 * Deliberately conservative in two ways: it only fires for a detail whose own re-check now
 * passes, and it only covers UNSUPPORTED_DETAIL — a sub-field dropped from a state or
 * transition that still exists, so re-attaching it is a one-field change. UNSUPPORTED_TOPOLOGY
 * (a whole state or transition removed) is not handled here: nothing but its evidence phrase
 * and key was kept, not its category, description, or connections, so restoring it properly
 * means regenerating from the document, not reconstructing it from an issue record.
 */
/** `drop()` in flow-grounding.ts always writes `target: 'the flow'` for environment/actor — the only two fields that attach to the flow itself rather than a state or transition. */
function targetKindOf(issue: Pick<DroppedDeclarationInput, 'target' | 'field'>): 'STATE' | 'TRANSITION' | 'FLOW' {
  if (issue.field === 'environment' || issue.field === 'actor') return 'FLOW';
  return issue.target?.includes('→') ? 'TRANSITION' : 'STATE';
}

export function restoreDeclarationSuggestions(
  leftOut: DroppedDeclarationInput[],
  documentText: string,
): RuleBasedSuggestionItem[] {
  const suggestions: RuleBasedSuggestionItem[] = [];
  for (const issue of leftOut) {
    if (issue.code !== 'UNSUPPORTED_DETAIL') continue;
    const detail = issue.detail?.trim();
    if (!detail || !issue.target) continue;
    if (!isStatedInDocument(documentText, detail)) continue;

    const targetKind = targetKindOf(issue);
    suggestions.push({
      type: 'RESTORE_DECLARATION',
      title: `Restore "${detail}" on ${issue.target}`,
      description: `${issue.message} The document now checks out for this phrase — it can be re-attached.`,
      rationale: `"${detail}" previously could not be verified and was left off ${issue.target}; it is now found in the document text.`,
      confidence: 0.8,
      severity: 'MEDIUM',
      targetNodeId: targetKind === 'STATE' ? issue.target : undefined,
      evidence: [detail],
      restoreDeclaration: {
        targetKind, target: issue.target, detail, code: issue.code,
        ...(issue.field ? { field: issue.field } : {}),
        ...(issue.value !== undefined ? { value: issue.value } : {}),
      },
    });
  }
  return suggestions;
}
