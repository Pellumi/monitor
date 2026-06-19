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
