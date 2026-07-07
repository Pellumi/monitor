export type EventRule = { type: 'event', eventType: string, state: string };
export type MetadataRule = { type: 'metadata', field: string, equals: string, state: string };
export type RoutePatternRule = { type: 'routePattern', pattern: RegExp, state: string };
export type ExactRouteRule = { type: 'exactRoute', route: string, state: string };

export type StateExtractionRule = EventRule | MetadataRule | RoutePatternRule | ExactRouteRule;

export interface MissingStateRule {
  trigger: string;
  candidate: string;
  confidence: number;
  reason: string;
}

export interface FlowTransformation {
  replace: {
    from: string;
    to: string;
  };
}

export interface MissingFlowRule {
  pattern: string[];
  transformation: FlowTransformation;
  confidence: number;
  reason: string;
}

export interface ApplicationRuleSet {
  stateExtractors: StateExtractionRule[];
  missingStates: MissingStateRule[];
  missingFlows: MissingFlowRule[];
}

export type FlowStateCategory = 'NAVIGATION' | 'UI' | 'BUSINESS' | 'ERROR' | 'SYSTEM';
export type FlowCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SuggestionStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED' | 'EDITED';
export type SuggestionSource = 'RULE' | 'TEMPLATE' | 'AI' | 'USER';

export interface StateTemplate {
  name: string;
  category: FlowStateCategory;
}

export interface TransitionTemplate {
  from: string;
  to: string;
  action?: string;
}

export interface EdgeCaseTemplate {
  trigger: string;
  name: string;
  category: FlowStateCategory;
  criticality: FlowCriticality;
  confidence: number;
  reason: string;
}

export interface DomainTemplate {
  id: string;
  name: string;
  description: string;
  workflowType: string;
  states: StateTemplate[];
  transitions: TransitionTemplate[];
  edgeCases: EdgeCaseTemplate[];
}

export interface CompiledRulePattern {
  id?: string;
  key: string;
  name: string;
  patternType: string;
  severity: FlowCriticality | 'INFO';
  matcher: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  triggers: Array<{
    type: string;
    value: string;
    weight: number;
  }>;
}

export interface CompiledFlowTemplate {
  id?: string;
  key: string;
  name: string;
  description?: string;
  workflowType: string;
  states: StateTemplate[];
  transitions: TransitionTemplate[];
  edgeCases: EdgeCaseTemplate[];
  confidence: number;
}

export interface CompiledRuleset {
  domainKey: string;
  rulesetId?: string;
  rulesetVersionId?: string;
  version: number;
  rulePatterns: CompiledRulePattern[];
  flowTemplates: CompiledFlowTemplate[];
  source: 'DATABASE' | 'FALLBACK';
}

export interface DomainInferenceResult {
  domainKey: string;
  confidence: number;
  secondaryDomains: Array<{
    domainKey: string;
    confidence: number;
  }>;
  matchedTriggers: string[];
}

export interface GeneratedWorkflow {
  key: string;
  name: string;
  description?: string;
  workflowType: string;
  states: Array<StateTemplate & { key: string }>;
  transitions: TransitionTemplate[];
}

export interface GeneratedMissingFlow {
  key: string;
  title: string;
  reason: string;
  confidence: number;
}

export interface GeneratedMissingState {
  key: string;
  title: string;
  reason: string;
  confidence: number;
}

export interface FlowDraft {
  domainKey: string;
  confidence: number;
  assumptions: string[];
  workflows: GeneratedWorkflow[];
  missingFlowCandidates: GeneratedMissingFlow[];
  missingStateCandidates: GeneratedMissingState[];
  suggestions: Array<{
    type: 'PREREQUISITE' | 'IN_STATE_VALIDATION' | 'POST_REQUISITE' | 'ERROR_PATH' | 'EMPTY_STATE' | 'LOADING_STATE' | 'RECOVERY_PATH' | 'SECURITY_STATE' | 'BUSINESS_RULE';
    title: string;
    rationale: string;
    confidence: number;
    severity: FlowCriticality | 'INFO';
    suggestedStates: StateTemplate[];
    suggestedTransitions: TransitionTemplate[];
  }>;
  source: 'RULE_ENGINE' | 'AI' | 'HYBRID';
}

export interface DeclaredGraphInput {
  states: Array<{ key?: string; name: string; category?: string }>;
  transitions: Array<{ from: string; to: string; action?: string }>;
}

export interface FlowSuggestion {
  type: FlowDraft['suggestions'][number]['type'];
  title: string;
  rationale: string;
  confidence: number;
  severity: FlowCriticality | 'INFO';
  suggestedStates: StateTemplate[];
  suggestedTransitions: TransitionTemplate[];
  rulesetVersionIds: string[];
  rulePatternIds: string[];
}
