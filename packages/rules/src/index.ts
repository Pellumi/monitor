import { ecommerceRules } from './ecommerce';
import { lmsRules } from './lms';
import { ApplicationRuleSet } from './types';

export * from './types';
export * from './templates';
export * from './dynamic';
export * from './cache';
export * from './schema';

export const ruleSets: Record<string, ApplicationRuleSet> = {
  ECOMMERCE: ecommerceRules,
  LMS: lmsRules,
};

export function getRuleSet(profileType: string): ApplicationRuleSet | null {
  return ruleSets[profileType.toUpperCase()] || null;
}

export function reconstructRuleSet(compiledRules: any, profileType: string): ApplicationRuleSet {
  const baseRuleSet = getRuleSet(profileType) || { stateExtractors: [], missingStates: [], missingFlows: [] };

  const stateExtractors = [...baseRuleSet.stateExtractors];
  const missingStates = [...baseRuleSet.missingStates];
  const missingFlows = [...baseRuleSet.missingFlows];

  if (!compiledRules) {
    return {
      stateExtractors,
      missingStates,
      missingFlows,
    };
  }

  let rulesArray: any[] = [];
  if (Array.isArray(compiledRules)) {
    rulesArray = compiledRules;
  } else if (typeof compiledRules === 'object') {
    const rulesets = (compiledRules as any).rulesets;
    if (Array.isArray(rulesets)) {
      for (const ruleset of rulesets) {
        if (Array.isArray(ruleset.rulePatterns)) {
          for (const pattern of ruleset.rulePatterns) {
            if (pattern.patternType === 'STATE_EXPECTATION' && pattern.matcher?.stateName) {
              rulesArray.push({
                type: 'EXPECTED_STATE',
                stateName: pattern.matcher.stateName,
                confidence: pattern.confidence,
              });
            } else if (pattern.patternType === 'TRANSITION_EXPECTATION' && pattern.matcher?.fromState && pattern.matcher?.toState) {
              rulesArray.push({
                type: 'EXPECTED_TRANSITION',
                fromState: pattern.matcher.fromState,
                toState: pattern.matcher.toState,
                confidence: pattern.confidence,
              });
            }
          }
        }
      }
    }
  }

  for (const rule of rulesArray) {
    if (rule.type === 'EXPECTED_STATE' && rule.stateName) {
      const exists = stateExtractors.some(
        (e) => e.type === 'event' && e.eventType === rule.stateName
      );
      if (!exists) {
        stateExtractors.push({
          type: 'event',
          eventType: rule.stateName,
          state: rule.stateName,
        });
      }
    } else if (rule.type === 'EXPECTED_TRANSITION' && rule.fromState && rule.toState) {
      const exists = missingStates.some(
        (m) => m.trigger === rule.fromState && m.candidate === rule.toState
      );
      if (!exists) {
        missingStates.push({
          trigger: rule.fromState,
          candidate: rule.toState,
          confidence: rule.confidence ?? 1.0,
          reason: `Declared transition from ${rule.fromState} to ${rule.toState}`,
        });
      }
    }
  }

  return {
    stateExtractors,
    missingStates,
    missingFlows,
  };
}
