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
  /** A step the source document describes that has no state/transition in the declared flow at all. */
  'MISSING_DOCUMENTED_STEP',
  /** A detail dropped during document generation (no text to check it against at the time) that can now be verified. */
  'RESTORE_DECLARATION',
  /** Two or more transitions leave the same state toward different destinations with no `condition` distinguishing them. */
  'AMBIGUOUS_BRANCH',
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
  suggestedStates: z.array(z.object({ name: z.string(), category: z.string(), role: z.enum(['NORMAL', 'INITIAL', 'TERMINAL']).optional(), terminalKind: z.string().nullable().optional() })).max(20).optional(),
  suggestedTransitions: z.array(z.object({ from: z.string(), to: z.string(), action: z.string().optional(), condition: z.string().optional() })).max(40).optional(),
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
  suggestedStates?: Array<{ name: string; category: string; role?: string; terminalKind?: string | null }>;
  suggestedTransitions?: Array<{ from: string; to: string; action?: string; condition?: string }>;

  ruleConfidence?: number;
  aiConfidence?: number;
  evidenceStrength?: number;

  /** RESTORE_DECLARATION only: what to re-attach and to what, once accepted. */
  restoreDeclaration?: RestoreDeclaration;
}

// ─────────────────────────────────────────────────────────────
// Input for the suggestions engine
// ─────────────────────────────────────────────────────────────

export interface DeclaredFlowSummary {
  flowId: string;
  name: string;
  purpose?: string | null;
  scopeStatement?: string | null;
  workflowType?: string | null;
  states: Array<{ name: string; category: string; role?: string; terminalKind?: string | null }>;
  transitions: Array<{ from: string; to: string; action?: string; condition?: string | null }>;
  validations?: string[];
  endpoints?: string[];
}

/**
 * One declaration document-generation left out, exactly as stored in
 * `BehaviorGraph.aiDraftIssues.leftOut` (see `packages/ai/src/flow-grounding.ts`).
 * `restoreDeclarationSuggestions` re-checks these against newly available document text.
 */
export interface DroppedDeclarationInput {
  code: string;
  severity: string;
  message: string;
  target?: string;
  /** The literal cited value (a route, heading, label, or evidence quote) — what gets re-checked. */
  detail?: string;
  /** Which field this came from — see `FlowLanguageIssue.field` in `flow-language.ts`. */
  field?: 'route' | 'heading' | 'text' | 'control' | 'input' | 'effect' | 'environment' | 'actor';
  /** The structured value to restore, when richer than `detail` alone. */
  value?: unknown;
}

/**
 * What a RESTORE_DECLARATION suggestion re-attaches, and to what, once accepted — exact,
 * not a guess: `field` says which part of the state/transition/flow it belongs to, and
 * `value` (when present) is the structured value to write, not just a display string.
 */
export interface RestoreDeclaration {
  targetKind: 'STATE' | 'TRANSITION' | 'FLOW';
  target: string;
  detail: string;
  code: string;
  field?: DroppedDeclarationInput['field'];
  value?: unknown;
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
  suggestedState?: string;
  suggestedTransition?: string;
  suggestedStates?: Array<{ name: string; category: string; role?: string; terminalKind?: string | null }>;
  suggestedTransitions?: Array<{ from: string; to: string; action?: string; condition?: string }>;
  /** RESTORE_DECLARATION only: what to re-attach and to what, once accepted. */
  restoreDeclaration?: RestoreDeclaration;
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
  graphVersion?: number;
  graphHash?: string;
  latestMutation?: string;
  latestState?: { id?: string; name: string; category: string; role?: string; terminalKind?: string | null };
  mode?: 'GAP_REVIEW' | 'CONNECTION_REPAIR' | 'WHOLE_FLOW_REVIEW';
  /**
   * An excerpt of the document a flow was generated from (its `aiSafeText`, already
   * prompt-injection-filtered — see `@tellann/document-intelligence`), so the AI pass can
   * compare what the document describes against what the flow actually declares and
   * suggest MISSING_DOCUMENTED_STEP where they diverge. Omit when the flow was not
   * generated from a document, or the text is unavailable.
   */
  sourceDocumentExcerpt?: string;
  /**
   * What document generation left out for this flow (`BehaviorGraph.aiDraftIssues.leftOut`).
   * Combined with `sourceDocumentExcerpt`, re-checked by `restoreDeclarationSuggestions` —
   * a detail dropped for lack of text to check it against, now checkable, becomes a
   * RESTORE_DECLARATION suggestion instead of staying silently and permanently lost.
   */
  droppedDeclarations?: DroppedDeclarationInput[];
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
