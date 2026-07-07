import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Rule schema for dynamic rulesets
// ─────────────────────────────────────────────────────────────

export const RuleTypeSchema = z.enum([
  'MISSING_STATE',
  'MISSING_FLOW',
  'PREREQUISITE_STATE',
  'POSTREQUISITE_FLOW',
  'VALIDATION_CONSTRAINT',
  'MISSING_FAILURE_PATH',
  'MISSING_RECOVERY_PATH',
  'MISSING_EMPTY_STATE',
  'MISSING_LOADING_STATE',
]);

export type RuleType = z.infer<typeof RuleTypeSchema>;

export const SeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

export const RuleSuggestSchema = z.object({
  key: z.string().min(1).max(128),
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(1000),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
});

export const RuleSchema = z.object({
  id: z.string().min(1),
  type: RuleTypeSchema,
  domain: z.string().min(1),
  when: z.record(z.unknown()),
  suggest: RuleSuggestSchema,
  evidence: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type Rule = z.infer<typeof RuleSchema>;

// ─────────────────────────────────────────────────────────────
// Ruleset version schema — what gets stored in the DB rules JSON
// ─────────────────────────────────────────────────────────────

export const RulesetVersionPayloadSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  rules: z.array(RuleSchema),
  metadata: z.record(z.unknown()).optional(),
});

export type RulesetVersionPayload = z.infer<typeof RulesetVersionPayloadSchema>;

// ─────────────────────────────────────────────────────────────
// AI flow suggestion output schema (used in packages/ai)
// ─────────────────────────────────────────────────────────────

export const AIFlowSuggestionItemSchema = z.object({
  type: z.enum([
    'PREREQUISITE_STATE',
    'VALIDATION_CONSTRAINT',
    'POSTREQUISITE_FLOW',
    'MISSING_FAILURE_PATH',
    'MISSING_RECOVERY_PATH',
    'MISSING_EMPTY_STATE',
    'MISSING_LOADING_STATE',
  ]),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  targetNodeId: z.string().optional(),
  targetFlowId: z.string().optional(),
  suggestedState: z.string().optional(),
  suggestedTransition: z.string().optional(),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500),
  evidence: z.array(z.string()).default([]),
});

export type AIFlowSuggestionItem = z.infer<typeof AIFlowSuggestionItemSchema>;

export const AIFlowSuggestionSchema = z.object({
  suggestions: z.array(AIFlowSuggestionItemSchema).max(20),
});

export type AIFlowSuggestion = z.infer<typeof AIFlowSuggestionSchema>;

// ─────────────────────────────────────────────────────────────
// Validation helper
// ─────────────────────────────────────────────────────────────

export function validateRulesetPayload(json: unknown): {
  valid: boolean;
  data?: RulesetVersionPayload;
  error?: string;
} {
  const result = RulesetVersionPayloadSchema.safeParse(json);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    error: result.error.issues
      .map((i: import('zod').ZodIssue) => `${i.path.join('.')}: ${i.message}`)
      .join('; '),
  };
}
