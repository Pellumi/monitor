import type { DeclaredFlowSummary } from '@tellann/desktop-contracts';

/**
 * Initializing a Flow binds one published Flow version to the attached project
 * folder and one environment, so readiness is never a property of the Flow alone —
 * it lives on the binding recorded against this project.
 */
type FlowBinding = {
  id?: string;
  status?: string;
  environmentId?: string;
  flowVersionId?: string;
  initializations?: Array<{ status?: string }>;
  scans?: Array<{ status?: string }>;
};

export type FlowRunReadiness = {
  ready: boolean;
  code: 'READY' | 'DRAFT' | 'NOT_BOUND' | 'INACTIVE_BINDING' | 'STALE_VERSION' | 'INITIALIZATION_REQUIRED' | 'SCAN_REQUIRED';
  message: string;
};

/** The minimum a Flow has to carry to be pointed at the initialization screen. */
type LinkableFlow = {
  id: string;
  publishedVersionId?: string | null;
};

export function flowBindingForEnvironment(
  flow: unknown,
  environmentId?: string,
): FlowBinding | undefined {
  const bindings = (flow as { projectBindings?: FlowBinding[] } | null | undefined)
    ?.projectBindings ?? [];
  if (!environmentId) return bindings[0];
  return bindings.find((binding) => binding.environmentId === environmentId);
}

/**
 * A run needs a Flow that is both published (a version was published from the
 * declare view) and initialized in *this* project — an active binding whose
 * initialization has completed. A Flow short of that cannot start a run.
 */
export function isFlowReadyToRun(item: DeclaredFlowSummary, environmentId?: string) {
  return flowRunReadiness(item, environmentId).ready;
}

export function flowRunReadiness(item: DeclaredFlowSummary, environmentId?: string): FlowRunReadiness {
  const binding = flowBindingForEnvironment(item, environmentId);
  if (!item.publishedVersionId) return { ready: false, code: 'DRAFT', message: 'Publish this Flow before using it for Guided QA.' };
  if (!binding) return { ready: false, code: 'NOT_BOUND', message: 'Initialize this Flow for the selected environment.' };
  if (binding.status !== 'ACTIVE') return { ready: false, code: 'INACTIVE_BINDING', message: 'The project binding is no longer active.' };
  if (binding.flowVersionId && binding.flowVersionId !== item.publishedVersionId) {
    return { ready: false, code: 'STALE_VERSION', message: 'This environment is initialized against an older Flow version.' };
  }
  if (binding.initializations?.[0]?.status !== 'COMPLETED') {
    return { ready: false, code: 'INITIALIZATION_REQUIRED', message: 'Complete Flow initialization for this environment.' };
  }
  if (binding.scans?.[0]?.status !== 'COMPLETED') {
    return { ready: false, code: 'SCAN_REQUIRED', message: 'Complete or refresh the Flow scan before Guided QA.' };
  }
  return { ready: true, code: 'READY', message: 'Ready for Guided QA.' };
}

/**
 * A published Flow this project has not finished initializing — what the
 * "Initialize in project" action exists for. A draft has no version to bind, and
 * an initialized Flow is ready to run instead.
 */
export function isFlowInitializable(item: DeclaredFlowSummary, environmentId?: string) {
  return Boolean(item.publishedVersionId) && !isFlowReadyToRun(item, environmentId);
}

/** The Flow an "Initialize a Flow" prompt should open, or null when there is none. */
export function nextFlowToInitialize(items: DeclaredFlowSummary[]) {
  return items.find((item) => isFlowInitializable(item)) ?? null;
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
