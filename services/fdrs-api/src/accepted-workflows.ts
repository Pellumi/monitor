import { normalizeWorkflowLanguage, type FlowRequires } from '@tellann/ai';

export interface AcceptedState {
  key: string;
  name: string;
  category?: string;
  role: string;
  terminalKind?: string | null;
  description?: string;
  actor?: string;
  recognizer?: unknown;
  /** A reference by name or id; the caller resolves it to a flow that can be reused. */
  subFlow?: { flowId?: string; name?: string };
  evidenceIds: string[];
  [extra: string]: unknown;
}

export interface AcceptedTransition {
  from: string;
  to: string;
  action?: string;
  condition?: string;
  control?: unknown;
  inputs?: unknown;
  effects?: unknown;
  mode?: string;
  evidenceIds: string[];
  [extra: string]: unknown;
}

/**
 * What a flow made of several journeys needs: the first account any of them names, the environments
 * every one of them allows (a flow can only run where all its journeys can), and all the data any needs.
 */
export function mergeRequires(all: Array<FlowRequires | undefined>): FlowRequires | undefined {
  const present = all.filter((item): item is FlowRequires => Boolean(item));
  if (!present.length) return undefined;
  const restricted = present.filter((item) => item.environments.length > 0);
  const environments = restricted.length
    ? restricted.map((item) => item.environments).reduce((left, right) => left.filter((environment) => right.includes(environment)))
    : [];
  const actor = present.find((item) => item.actor)?.actor;
  return { ...(actor ? { actor } : {}), environments, data: [...new Set(present.flatMap((item) => item.data))] };
}

/**
 * The states and transitions of the workflows a person accepted, as one graph.
 *
 * States keep their own short names (LOGIN_PAGE, not WORKFLOWKEY_LOGIN_PAGE). Journeys
 * that pass through the same place share that state, so a story told in two
 * workflows ("sign in", then "create a course" starting from DASHBOARD) joins up.
 * Drafts stored before the flow language existed, and names a person edited, are
 * brought into it here, so what is accepted is always in the same form.
 *
 * Roles are only partly decided here: the first journey's start is the flow's start,
 * and an ending of one journey that another continues from is no longer an ending
 * (its kind is kept in case it ends up as one). The caller derives the rest.
 */
export function mergeAcceptedWorkflows(
  workflows: any[],
  keptEvidence: (ids: unknown, fallback: string[]) => string[],
  draftEvidenceIds: string[],
): { states: AcceptedState[]; transitions: AcceptedTransition[]; requires?: FlowRequires } {
  const stateByKey = new Map<string, AcceptedState>();
  const transitions: AcceptedTransition[] = [];
  const seen = new Set<string>();
  const requirements: Array<FlowRequires | undefined> = [];

  for (const workflow of workflows) {
    const language = normalizeWorkflowLanguage(workflow);
    requirements.push(language.requires);
    const workflowEvidence = keptEvidence(workflow.evidenceIds, draftEvidenceIds);
    for (const state of language.states) {
      const evidenceIds = keptEvidence(state.evidenceIds, workflowEvidence);
      const known = stateByKey.get(state.key);
      if (known) {
        known.evidenceIds = [...new Set([...known.evidenceIds, ...evidenceIds])];
        known.description ??= state.description;
        known.recognizer ??= state.recognizer;
        known.subFlow ??= state.subFlow;
        continue;
      }
      const hasStart = [...stateByKey.values()].some((item) => item.role === 'INITIAL');
      stateByKey.set(state.key, {
        ...state,
        name: state.key,
        evidenceIds,
        role: state.role === 'INITIAL' && !hasStart ? 'INITIAL' : 'NORMAL',
        terminalKind: state.role === 'TERMINAL' ? state.terminalKind : null,
      });
    }
    for (const transition of language.transitions) {
      const identity = `${transition.from}|${transition.to}|${transition.action}|${transition.condition ?? ''}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      transitions.push({ ...transition, evidenceIds: keptEvidence(transition.evidenceIds, workflowEvidence) });
    }
  }
  const requires = mergeRequires(requirements);
  return { states: [...stateByKey.values()], transitions, ...(requires ? { requires } : {}) };
}
