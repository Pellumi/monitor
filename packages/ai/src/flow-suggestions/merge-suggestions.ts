import type { AIFlowSuggestionItem, RuleBasedSuggestionItem, UnifiedSuggestion, SuggestionType, SuggestionSeverity } from './schema';
import { computeBlendedConfidence, deriveEvidenceStrength } from './confidence';

// ─────────────────────────────────────────────────────────────
// Deduplication key
//
// Key = type:normalizedTitle:targetNodeId (case-insensitive title)
// ─────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function makeDedupKey(type: string, title: string, targetNodeId?: string): string {
  return `${type}:${normalizeTitle(title)}:${targetNodeId ?? ''}`;
}

// ─────────────────────────────────────────────────────────────
// Type normalization helpers
// ─────────────────────────────────────────────────────────────

const VALID_SUGGESTION_TYPES = new Set<SuggestionType>([
  'PREREQUISITE_STATE',
  'VALIDATION_CONSTRAINT',
  'POSTREQUISITE_FLOW',
  'MISSING_FAILURE_PATH',
  'MISSING_RECOVERY_PATH',
  'MISSING_EMPTY_STATE',
  'MISSING_LOADING_STATE',
]);

const RULE_TYPE_TO_SUGGESTION_TYPE: Record<string, SuggestionType> = {
  MISSING_STATE: 'PREREQUISITE_STATE',
  MISSING_FLOW: 'POSTREQUISITE_FLOW',
  PREREQUISITE_STATE: 'PREREQUISITE_STATE',
  POSTREQUISITE_FLOW: 'POSTREQUISITE_FLOW',
  VALIDATION_CONSTRAINT: 'VALIDATION_CONSTRAINT',
  MISSING_FAILURE_PATH: 'MISSING_FAILURE_PATH',
  MISSING_RECOVERY_PATH: 'MISSING_RECOVERY_PATH',
  MISSING_EMPTY_STATE: 'MISSING_EMPTY_STATE',
  MISSING_LOADING_STATE: 'MISSING_LOADING_STATE',
};

function normalizeSuggestionType(type: string): SuggestionType {
  if (VALID_SUGGESTION_TYPES.has(type as SuggestionType)) return type as SuggestionType;
  return RULE_TYPE_TO_SUGGESTION_TYPE[type] ?? 'PREREQUISITE_STATE';
}

function normalizeSeverity(s?: string): SuggestionSeverity {
  const valid: SuggestionSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (s && valid.includes(s as SuggestionSeverity)) return s as SuggestionSeverity;
  return 'INFO';
}

// ─────────────────────────────────────────────────────────────
// Priority order: Human feedback > Rule-based > AI
// This is enforced by inserting in priority order and skipping
// lower-priority duplicates.
// ─────────────────────────────────────────────────────────────

/**
 * Merges rule-based and AI suggestions into a unified, deduplicated list.
 *
 * Priority (§11.5):
 *   Human feedback > ruleset suggestion > AI suggestion
 *
 * Deduplication key: type + normalized title + targetNodeId
 */
export function mergeSuggestions(params: {
  ruleSuggestions: RuleBasedSuggestionItem[];
  aiSuggestions: AIFlowSuggestionItem[];
  /** Maximum number of suggestions to return */
  maxResults?: number;
}): UnifiedSuggestion[] {
  const { ruleSuggestions, aiSuggestions, maxResults = 20 } = params;

  // Map: dedupKey → UnifiedSuggestion (higher-priority wins)
  const seen = new Map<string, UnifiedSuggestion>();

  // ─── 1. Rule-based suggestions (higher priority) ────────────
  for (const rs of ruleSuggestions) {
    const type = normalizeSuggestionType(rs.type);
    const key = makeDedupKey(type, rs.title, rs.targetNodeId);
    if (seen.has(key)) continue; // Already have a higher-priority entry (unlikely at this point)

    const evidenceStrength = deriveEvidenceStrength(rs.evidence ?? []);
    const confidence = computeBlendedConfidence({
      ruleConfidence: rs.confidence,
      evidenceStrength,
      isAiOnly: false,
    });

    seen.set(key, {
      key,
      type,
      title: rs.title,
      description: rs.description,
      severity: normalizeSeverity(rs.severity),
      confidence,
      rationale: rs.rationale,
      evidence: rs.evidence ?? [],
      sources: ['RULE_BASED'],
      label: 'Rule-based',
      targetNodeId: rs.targetNodeId,
      suggestedState: rs.suggestedState,
      suggestedTransition: rs.suggestedTransition,
      ruleConfidence: rs.confidence,
      evidenceStrength,
    });
  }

  // ─── 2. AI suggestions (lower priority, merged if new) ──────
  for (const ai of aiSuggestions) {
    const type = normalizeSuggestionType(ai.type);
    const key = makeDedupKey(type, ai.title, ai.targetNodeId);

    const existing = seen.get(key);
    if (existing) {
      // Merge AI signal into existing rule-based suggestion
      const evidenceStrength = deriveEvidenceStrength([
        ...existing.evidence,
        ...ai.evidence,
      ]);
      const blended = computeBlendedConfidence({
        ruleConfidence: existing.ruleConfidence,
        aiConfidence: ai.confidence,
        evidenceStrength,
        isAiOnly: false,
      });

      seen.set(key, {
        ...existing,
        confidence: blended,
        sources: [...new Set([...existing.sources, 'AI_ASSISTED' as const])] as import('./schema').SuggestionSource[],
        label: 'AI-assisted',
        evidence: [...new Set([...existing.evidence, ...ai.evidence])],
        aiConfidence: ai.confidence,
        evidenceStrength,
        // Keep AI description if more detailed
        description:
          ai.description.length > existing.description.length
            ? ai.description
            : existing.description,
      });
    } else {
      // Pure AI suggestion — cap confidence
      const evidenceStrength = deriveEvidenceStrength(ai.evidence);
      const confidence = computeBlendedConfidence({
        aiConfidence: ai.confidence,
        evidenceStrength,
        isAiOnly: true,
      });

      seen.set(key, {
        key,
        type,
        title: ai.title,
        description: ai.description,
        severity: ai.severity,
        confidence,
        rationale: ai.rationale,
        evidence: ai.evidence,
        sources: ['AI_ASSISTED'],
        label: 'Experimental',
        targetNodeId: ai.targetNodeId,
        targetFlowId: ai.targetFlowId,
        suggestedState: ai.suggestedState,
        suggestedTransition: ai.suggestedTransition,
        aiConfidence: ai.confidence,
        evidenceStrength,
      });
    }
  }

  // ─── 3. Sort by severity then confidence ──────────────────
  const severityOrder: Record<SuggestionSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };

  const merged = Array.from(seen.values()).sort((a, b) => {
    const sev = (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
    if (sev !== 0) return sev;
    return b.confidence - a.confidence;
  });

  return merged.slice(0, maxResults);
}
