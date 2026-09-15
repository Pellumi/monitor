import assert from 'node:assert/strict';
import test from 'node:test';
import { flowInitializationResetOnRejection } from './instrumentation-flow-reset';

const flowPlan = {
  id: 'plan-1',
  workspaceId: 'workspace-1',
  purpose: 'FLOW',
  flowId: 'flow-1',
  flowVersionId: 'version-1',
  workspace: { applicationId: 'app-1' },
};

test('a rejected bootstrap task leaves Flow initializations alone', () => {
  assert.equal(flowInitializationResetOnRejection({ ...flowPlan, purpose: 'BOOTSTRAP' }), null);
});

test('a Flow task missing its Flow version cannot be matched to an initialization', () => {
  assert.equal(flowInitializationResetOnRejection({ ...flowPlan, flowVersionId: null }), null);
});

test('a rejected Flow task sends only its waiting initialization back to choosing a mode', () => {
  const reset = flowInitializationResetOnRejection(flowPlan);
  assert.ok(reset);
  assert.deepEqual(reset.where, {
    applicationId: 'app-1',
    flowId: 'flow-1',
    flowVersionId: 'version-1',
    binding: { workspaceId: 'workspace-1' },
    mode: 'AUTOMATED',
    stage: 'AWAITING_APPROVAL',
    OR: [{ instrumentationPlanId: null }, { instrumentationPlanId: 'plan-1' }],
  });
  assert.deepEqual(reset.data, {
    mode: null,
    stage: 'REVIEW_READY',
    status: 'PROPOSED',
    instrumentationPlanId: null,
    approvedByUserId: null,
    approvedAt: null,
  });
});
