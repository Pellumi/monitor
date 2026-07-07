import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Suggestion types
// ─────────────────────────────────────────────────────────────

export const SuggestionTypeSchema = z.enum([
  'PREREQUISITE_STATE',
  'VALIDATION_CONSTRAINT',
  'POSTREQUISITE_FLOW',
  'MISSING_FAILURE_PATH',
  'MISSING_RECOVERY_PATH',
  'MISSING_EMPTY_STATE',
  'MISSING_LOADING_STATE',
]);

export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

export const SuggestionSeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type SuggestionSeverity = z.infer<typeof SuggestionSeveritySchema>;

/**
 * Source of a suggestion — used for dashboard labeling and priority ordering.
 */
export type SuggestionSource = 'RULE_BASED' | 'AI_ASSISTED' | 'USER_FEEDBACK';

// ─────────────────────────────────────────────────────────────
// AI suggestion item (raw LLM output after validation)
// ─────────────────────────────────────────────────────────────

export const AIFlowSuggestionItemSchema = z.object({
  type: SuggestionTypeSchema,
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  targetNodeId: z.string().optional(),
  targetFlowId: z.string().optional(),
  suggestedState: z.string().optional(),
  suggestedTransition: z.string().optional(),
  severity: SuggestionSeveritySchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500),
  evidence: z.array(z.string()).default([]),
});

export type AIFlowSuggestionItem = z.infer<typeof AIFlowSuggestionItemSchema>;

export const AIFlowSuggestionResponseSchema = z.object({
  suggestions: z.array(AIFlowSuggestionItemSchema).max(20),
});

export type AIFlowSuggestionResponse = z.infer<typeof AIFlowSuggestionResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Unified suggestion (after merge — combines rule + AI + feedback)
// ─────────────────────────────────────────────────────────────

export interface UnifiedSuggestion {
  /** Unique dedup key: type:normalizedTitle:targetNodeId */
  key: string;
  type: SuggestionType;
  title: string;
  description: string;
  severity: SuggestionSeverity;
  /** Final blended confidence score */
  confidence: number;
  rationale: string;
  evidence: string[];

  /** Which data sources produced this suggestion */
  sources: SuggestionSource[];
  /** Dashboard label: Rule-based / AI-assisted / Experimental */
  label: 'Rule-based' | 'AI-assisted' | 'Experimental' | 'Needs review';

  targetNodeId?: string;
  targetFlowId?: string;
  suggestedState?: string;
  suggestedTransition?: string;

  ruleConfidence?: number;
  aiConfidence?: number;
  evidenceStrength?: number;
}

// ─────────────────────────────────────────────────────────────
// Input for the suggestions engine
// ─────────────────────────────────────────────────────────────

export interface DeclaredFlowSummary {
  flowId: string;
  name: string;
  states: Array<{ name: string; category: string }>;
  transitions: Array<{ from: string; to: string; action?: string }>;
  validations?: string[];
  endpoints?: string[];
}

export interface RuleBasedSuggestionItem {
  type: string;
  title: string;
  description: string;
  rationale: string;
  confidence: number;
  severity?: string;
  targetNodeId?: string;
  patternId?: string;
  evidence?: string[];
}

export interface FlowSuggestionsInput {
  applicationId: string;
  organizationId: string;
  applicationDomain: string;
  /** Sanitized declared flows — no raw user data */
  declaredFlows: DeclaredFlowSummary[];
  /** Summary of observed graph (state counts etc.) — no replay payloads */
  observedGraphSummary?: string;
  /** Already computed rule-based suggestions */
  existingRuleSuggestions: RuleBasedSuggestionItem[];
  /** Optional domain-specific goals */
  userDefinedGoals?: string[];
}

export interface FlowSuggestionsResult {
  suggestions: UnifiedSuggestion[];
  aiCalled: boolean;
  aiRepaired: boolean;
  fallbackUsed: boolean;
  provider?: string;
  model?: string;
  promptHash?: string;
  latencyMs: number;
}
