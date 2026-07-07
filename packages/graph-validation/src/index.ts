export type GraphStateCategory = 'NAVIGATION' | 'UI' | 'BUSINESS' | 'ERROR' | 'SYSTEM';

export interface GeneratedFlowState {
  key?: string;
  name: string;
  category?: GraphStateCategory | string;
}

export interface GeneratedFlowTransition {
  from: string;
  to: string;
  action?: string;
  transitionType?: 'NORMAL' | 'LOOP' | 'RETRY';
}

export interface GeneratedWorkflow {
  key: string;
  name: string;
  description?: string;
  workflowType?: string;
  states: GeneratedFlowState[];
  transitions: GeneratedFlowTransition[];
}

export interface GeneratedFlowGraph {
  workflows: GeneratedWorkflow[];
}

export interface GraphValidationIssue {
  code: string;
  message: string;
  workflowKey?: string;
  path?: string;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: GraphValidationIssue[];
  warnings: GraphValidationIssue[];
  normalizedGraph?: GeneratedFlowGraph;
}

const VALID_CATEGORIES = new Set(['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM']);

export function normalizeStateKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function normalizeCategory(category: unknown): GraphStateCategory {
  const normalized = typeof category === 'string' ? category.trim().toUpperCase() : '';
  return (VALID_CATEGORIES.has(normalized) ? normalized : 'BUSINESS') as GraphStateCategory;
}

export function validateGeneratedGraph(input: GeneratedFlowGraph, options?: { maxStates?: number }): GraphValidationResult {
  const errors: GraphValidationIssue[] = [];
  const warnings: GraphValidationIssue[] = [];
  const maxStates = options?.maxStates ?? 100;

  if (!input || !Array.isArray(input.workflows) || input.workflows.length === 0) {
    return {
      valid: false,
      errors: [{ code: 'NO_WORKFLOWS', message: 'At least one workflow is required.' }],
      warnings,
    };
  }

  let totalStates = 0;
  const normalizedWorkflows: GeneratedWorkflow[] = input.workflows.map((workflow, workflowIndex) => {
    const workflowKey = normalizeStateKey(workflow.key || workflow.name || `WORKFLOW_${workflowIndex + 1}`);
    const states = Array.isArray(workflow.states) ? workflow.states : [];
    const transitions = Array.isArray(workflow.transitions) ? workflow.transitions : [];

    if (states.length === 0) {
      errors.push({
        code: 'WORKFLOW_HAS_NO_STATES',
        message: 'Workflow must include at least one state.',
        workflowKey,
      });
    }
    if (transitions.length === 0 && states.length > 1) {
      errors.push({
        code: 'WORKFLOW_HAS_NO_TRANSITIONS',
        message: 'Workflow with more than one state must include transitions.',
        workflowKey,
      });
    }

    const seenStates = new Set<string>();
    const normalizedStates = states.map((state, stateIndex) => {
      const key = normalizeStateKey(state.key || state.name || `STATE_${stateIndex + 1}`);
      if (seenStates.has(key)) {
        errors.push({
          code: 'DUPLICATE_STATE',
          message: `Duplicate state key: ${key}`,
          workflowKey,
          path: `states.${stateIndex}`,
        });
      }
      seenStates.add(key);
      return {
        key,
        name: key,
        category: normalizeCategory(state.category),
      };
    });

    totalStates += normalizedStates.length;

    const seenTransitions = new Set<string>();
    const normalizedTransitions = transitions.map((transition, transitionIndex) => {
      const from = normalizeStateKey(transition.from);
      const to = normalizeStateKey(transition.to);
      const action = transition.action ? normalizeStateKey(transition.action) : undefined;
      const edgeKey = `${from}->${to}:${action || ''}`;

      if (!seenStates.has(from) || !seenStates.has(to)) {
        errors.push({
          code: 'TRANSITION_REFERENCES_MISSING_STATE',
          message: `Transition ${from} -> ${to} references a missing state.`,
          workflowKey,
          path: `transitions.${transitionIndex}`,
        });
      }
      if (seenTransitions.has(edgeKey)) {
        errors.push({
          code: 'DUPLICATE_TRANSITION',
          message: `Duplicate transition: ${edgeKey}`,
          workflowKey,
          path: `transitions.${transitionIndex}`,
        });
      }
      seenTransitions.add(edgeKey);
      if (from === to && transition.transitionType !== 'LOOP' && transition.transitionType !== 'RETRY') {
        warnings.push({
          code: 'SELF_TRANSITION',
          message: `Self-transition ${from} -> ${to} should be marked LOOP or RETRY if intentional.`,
          workflowKey,
          path: `transitions.${transitionIndex}`,
        });
      }
      return { from, to, action, transitionType: transition.transitionType };
    });

    const connected = new Set<string>();
    for (const transition of normalizedTransitions) {
      connected.add(transition.from);
      connected.add(transition.to);
    }
    for (const state of normalizedStates) {
      if (normalizedStates.length > 1 && !connected.has(state.key)) {
        warnings.push({
          code: 'ORPHAN_STATE',
          message: `State ${state.key} is not connected by any transition.`,
          workflowKey,
        });
      }
    }

    return {
      ...workflow,
      key: workflowKey,
      name: workflow.name || workflowKey,
      workflowType: workflow.workflowType || workflowKey,
      states: normalizedStates,
      transitions: normalizedTransitions,
    };
  });

  if (totalStates > maxStates) {
    errors.push({
      code: 'STATE_LIMIT_EXCEEDED',
      message: `Generated graph has ${totalStates} states; limit is ${maxStates}.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedGraph: {
      workflows: normalizedWorkflows,
    },
  };
}
