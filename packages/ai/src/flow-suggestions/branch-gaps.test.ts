import { describe, expect, it } from 'vitest';
import { findAmbiguousBranches } from './branch-gaps';
import type { DeclaredFlowSummary } from './schema';

const base: DeclaredFlowSummary = {
  flowId: 'f1', name: 'Onboarding',
  states: [
    { name: 'BACKGROUND_WORK_PAGE', category: 'SYSTEM' },
    { name: 'PRICING_PAGE', category: 'NAVIGATION' },
    { name: 'GUEST', category: 'NAVIGATION' },
  ],
  transitions: [],
};

describe('findAmbiguousBranches', () => {
  it('flags two transitions to different destinations with no condition on either', () => {
    const flow: DeclaredFlowSummary = {
      ...base,
      transitions: [
        { from: 'BACKGROUND_WORK_PAGE', to: 'PRICING_PAGE', action: 'CLICK_UNLOCK_PLAN' },
        { from: 'BACKGROUND_WORK_PAGE', to: 'GUEST', action: 'LOSE_PLAN_RETURN_HOME' },
      ],
    };
    const suggestions = findAmbiguousBranches(flow);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe('AMBIGUOUS_BRANCH');
    expect(suggestions[0].targetNodeId).toBe('BACKGROUND_WORK_PAGE');
  });

  it('does not flag branches that already carry distinguishing conditions', () => {
    const flow: DeclaredFlowSummary = {
      ...base,
      transitions: [
        { from: 'BACKGROUND_WORK_PAGE', to: 'PRICING_PAGE', action: 'CLICK_UNLOCK_PLAN', condition: 'EXAM_LT_2_DAYS' },
        { from: 'BACKGROUND_WORK_PAGE', to: 'GUEST', action: 'LOSE_PLAN_RETURN_HOME', condition: 'EXAM_GTE_2_DAYS' },
      ],
    };
    expect(findAmbiguousBranches(flow)).toEqual([]);
  });

  it('does not flag two transitions to the same destination (not a real branch)', () => {
    const flow: DeclaredFlowSummary = {
      ...base,
      transitions: [
        { from: 'BACKGROUND_WORK_PAGE', to: 'PRICING_PAGE', action: 'CLICK_UNLOCK_PLAN' },
        { from: 'BACKGROUND_WORK_PAGE', to: 'PRICING_PAGE', action: 'CLICK_SEE_PLANS' },
      ],
    };
    expect(findAmbiguousBranches(flow)).toEqual([]);
  });

  it('does not flag a single outgoing transition', () => {
    const flow: DeclaredFlowSummary = { ...base, transitions: [{ from: 'BACKGROUND_WORK_PAGE', to: 'PRICING_PAGE', action: 'CLICK_UNLOCK_PLAN' }] };
    expect(findAmbiguousBranches(flow)).toEqual([]);
  });
});
