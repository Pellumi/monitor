/**
 * What an instrumentation task is called.
 *
 * A task's name follows what it does rather than what it was detected as: the
 * framework (`react-vite`) is an implementation detail of the setup, not the
 * thing the operator is looking for in a list. A task that connects Tellann to
 * a project is an initialisation; a task that sets up a Flow is named after
 * that Flow. An operator who renames a task overrides both, and clearing the
 * name falls back to the derived one rather than leaving the row blank.
 */

export const INITIALISATION_TITLE = 'Initialisation';
/** Used only when a Flow task outlives the Flow it was created for. */
export const UNNAMED_FLOW_TITLE = 'Flow setup';
export const MAX_INSTRUMENTATION_TITLE_LENGTH = 120;

type TitledPlan = {
  title?: string | null;
  purpose?: string | null;
  flowId?: string | null;
};

export function derivedInstrumentationTitle(
  plan: TitledPlan,
  flowName?: string | null,
): string {
  if (plan.purpose === 'FLOW') return flowName?.trim() || UNNAMED_FLOW_TITLE;
  return INITIALISATION_TITLE;
}

export function resolveInstrumentationTitle(
  plan: TitledPlan,
  flowName?: string | null,
): string {
  const own = typeof plan.title === 'string' ? plan.title.trim() : '';
  return own || derivedInstrumentationTitle(plan, flowName);
}

/**
 * Normalize an operator-supplied title. `null` means "go back to the derived
 * name"; anything else is trimmed, collapsed and bounded. Returns `undefined`
 * when the input is not a usable title at all.
 */
export function normalizeInstrumentationTitle(
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_INSTRUMENTATION_TITLE_LENGTH) return undefined;
  return trimmed;
}
