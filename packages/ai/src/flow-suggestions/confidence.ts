// ─────────────────────────────────────────────────────────────
// Confidence scoring for merged suggestions
//
// Formula (from gaps-fixes-plan §11.5):
//   finalConfidence =
//     ruleConfidence * 0.5 +
//     aiConfidence * 0.3 +
//     evidenceStrength * 0.2
//
// AI-only suggestions are capped at 0.75 until validated by feedback.
// ─────────────────────────────────────────────────────────────

export const AI_ONLY_CONFIDENCE_CAP = 0.75;

export interface ConfidenceInputs {
  ruleConfidence?: number;
  aiConfidence?: number;
  evidenceStrength?: number;
  isAiOnly: boolean;
}

/**
 * Computes the final blended confidence for a suggestion.
 *
 * - If both rule and AI signals are present: full weighted blend.
 * - If AI-only: use AI confidence, capped at AI_ONLY_CONFIDENCE_CAP.
 * - If rule-only: use rule confidence directly.
 * - evidenceStrength: 0-1, derived from number of pieces of supporting evidence.
 */
export function computeBlendedConfidence(inputs: ConfidenceInputs): number {
  const rc = inputs.ruleConfidence ?? 0;
  const ac = inputs.aiConfidence ?? 0;
  const ev = inputs.evidenceStrength ?? 0;

  let score: number;

  if (inputs.ruleConfidence !== undefined && inputs.aiConfidence !== undefined) {
    // Both signals present: weighted blend
    score = rc * 0.5 + ac * 0.3 + ev * 0.2;
  } else if (inputs.aiConfidence !== undefined) {
    // AI-only
    score = ac * 0.8 + ev * 0.2;
    if (inputs.isAiOnly) {
      score = Math.min(score, AI_ONLY_CONFIDENCE_CAP);
    }
  } else {
    // Rule-only
    score = rc * 0.85 + ev * 0.15;
  }

  return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
}

/**
 * Derives evidence strength from an array of evidence strings.
 * 0 evidence → 0, 3+ evidence → 0.6, 6+ → 1.0
 */
export function deriveEvidenceStrength(evidence: string[]): number {
  const count = evidence.length;
  if (count === 0) return 0;
  if (count >= 6) return 1.0;
  return Math.round((count / 6) * 100) / 100;
}
