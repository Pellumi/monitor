import { z } from 'zod';

export const FlowStateSchema = z.object({
  key: z.string().optional(),
  name: z.string(),
  category: z.enum(['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM']).default('BUSINESS'),
});

export const FlowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.string().optional(),
  transitionType: z.enum(['NORMAL', 'LOOP', 'RETRY']).default('NORMAL').optional(),
});

export const WorkflowSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  workflowType: z.string().optional(),
  states: z.array(FlowStateSchema).min(1),
  transitions: z.array(FlowTransitionSchema).default([]),
});

export const FlowDraftSchema = z.object({
  domainKey: z.string(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).default([]),
  workflows: z.array(WorkflowSchema).min(1),
  missingFlowCandidates: z.array(z.object({
    key: z.string(),
    title: z.string(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })).default([]),
  missingStateCandidates: z.array(z.object({
    key: z.string(),
    title: z.string(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })).default([]),
  suggestions: z.array(z.object({
    type: z.enum([
      'PREREQUISITE',
      'IN_STATE_VALIDATION',
      'POST_REQUISITE',
      'ERROR_PATH',
      'EMPTY_STATE',
      'LOADING_STATE',
      'RECOVERY_PATH',
      'SECURITY_STATE',
      'BUSINESS_RULE',
    ]),
    title: z.string(),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).default('INFO'),
    suggestedStates: z.array(FlowStateSchema).default([]),
    suggestedTransitions: z.array(FlowTransitionSchema).default([]),
  })).default([]),
  source: z.enum(['RULE_ENGINE', 'AI', 'HYBRID']),
});

export type AIFlowDraft = z.infer<typeof FlowDraftSchema>;
