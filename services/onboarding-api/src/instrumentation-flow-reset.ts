type RejectedPlan = {
  id: string;
  workspaceId: string;
  purpose: string;
  flowId: string | null;
  flowVersionId: string | null;
  workspace: { applicationId: string };
};

/**
 * What rejecting a Flow instrumentation task does to its Flow initialization.
 *
 * Choosing "Add them for me" leaves the initialization waiting for a proposal to
 * be approved. Once that proposal is rejected it never will be, so the
 * initialization goes back to choosing how the Flow's start and finish are
 * marked. It is scoped to the initialization this task could belong to — same
 * application, Flow version and workspace, still on the automatic path and
 * still waiting for approval (nothing has been written at that point), and
 * either not yet tied to a plan or tied to this one.
 *
 * Returns null for a task that is not part of a Flow initialization.
 */
export function flowInitializationResetOnRejection(plan: RejectedPlan) {
  if (plan.purpose !== 'FLOW' || !plan.flowId || !plan.flowVersionId) return null;
  return {
    where: {
      applicationId: plan.workspace.applicationId,
      flowId: plan.flowId,
      flowVersionId: plan.flowVersionId,
      binding: { workspaceId: plan.workspaceId },
      mode: 'AUTOMATED' as const,
      stage: 'AWAITING_APPROVAL' as const,
      OR: [{ instrumentationPlanId: null }, { instrumentationPlanId: plan.id }],
    },
    data: {
      mode: null,
      stage: 'REVIEW_READY' as const,
      status: 'PROPOSED' as const,
      instrumentationPlanId: null,
      approvedByUserId: null,
      approvedAt: null,
    },
  };
}
