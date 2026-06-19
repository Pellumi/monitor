import { ecommerceRules } from './ecommerce';
import { lmsRules } from './lms';
import { ApplicationRuleSet } from './types';

export * from './types';

export const ruleSets: Record<string, ApplicationRuleSet> = {
  ECOMMERCE: ecommerceRules,
  LMS: lmsRules,
};

export function getRuleSet(profileType: string): ApplicationRuleSet | null {
  return ruleSets[profileType.toUpperCase()] || null;
}

export function reconstructRuleSet(compiledRules: any[], profileType: string): ApplicationRuleSet {
  const baseRuleSet = getRuleSet(profileType) || { stateExtractors: [], missingStates: [], missingFlows: [] };

  const stateExtractors = [...baseRuleSet.stateExtractors];
  const missingStates = [...baseRuleSet.missingStates];
  const missingFlows = [...baseRuleSet.missingFlows];

  for (const rule of compiledRules) {
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
