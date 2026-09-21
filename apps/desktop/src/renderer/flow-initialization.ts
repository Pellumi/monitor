import type { DeclaredFlowSummary } from '@tellann/desktop-contracts';

/**
 * Initializing a Flow binds one published Flow version to the attached project
 * folder and one environment, so readiness is never a property of the Flow alone —
 * it lives on the binding recorded against this project.
 */
type FlowBinding = {
  status?: string;
  initializations?: Array<{ status?: string }>;
};

/** The minimum a Flow has to carry to be pointed at the initialization screen. */
type LinkableFlow = {
  id: string;
  publishedVersionId?: string | null;
};

function flowBinding(flow: unknown): FlowBinding | undefined {
  return (flow as { projectBindings?: FlowBinding[] } | null | undefined)
    ?.projectBindings?.[0];
}

/**
 * A run needs a Flow that is both published (a version was published from the
 * declare view) and initialized in *this* project — an active binding whose
 * initialization has completed. A Flow short of that cannot start a run.
 */
export function isFlowReadyToRun(item: DeclaredFlowSummary) {
  const binding = flowBinding(item);
  return (
    Boolean(item.publishedVersionId) &&
    binding?.status === 'ACTIVE' &&
    binding.initializations?.[0]?.status === 'COMPLETED'
  );
}

/**
 * A published Flow this project has not finished initializing — what the
 * "Initialize in project" action exists for. A draft has no version to bind, and
 * an initialized Flow is ready to run instead.
 */
export function isFlowInitializable(item: DeclaredFlowSummary) {
  return Boolean(item.publishedVersionId) && !isFlowReadyToRun(item);
}

/** The Flow an "Initialize a Flow" prompt should open, or null when there is none. */
export function nextFlowToInitialize(items: DeclaredFlowSummary[]) {
  return items.find(isFlowInitializable) ?? null;
}

/**
 * Initialization is rejected outright against production, so every entry point
 * targets the first environment that is not production.
 */
export function nonProductionEnvironmentId(
  application:
    | { environments: Array<{ id: string; type: string }> }
    | undefined
    | null,
) {
  return (
    application?.environments.find((item) => item.type !== 'PRODUCTION')?.id ?? ''
  );
}

/**
 * Instrumentation drives the whole initialization state machine, but only when the
 * URL carries the Flow it is meant to map: without flowId, flowVersionId and
 * environmentId that page falls back to plain SDK setup and the analysis step is
 * unreachable. Returns null when the Flow cannot be initialized yet, so callers
 * render nothing rather than a link that dead-ends.
 */
export function flowInitializationHref(
  projectId: string | undefined,
  flow: LinkableFlow | null | undefined,
  environmentId: string | undefined,
) {
  if (!projectId || !flow?.publishedVersionId || !environmentId) return null;
  const params = new URLSearchParams({
    flowId: flow.id,
    flowVersionId: flow.publishedVersionId,
    environmentId,
  });
  return `/applications/${projectId}/instrumentation?${params.toString()}`;
}
