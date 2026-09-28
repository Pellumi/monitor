import { describe, expect, it } from 'vitest';
import { FlowDraftSchema } from './schemas';

/** The shapes a live Gemini response actually had: each of these used to reject the whole draft. */
const sloppy = {
  domainKey: 'LMS',
  confidence: '0.85',
  assumptions: ['Admin signs in first', 42],
  source: 'ai',
  workflows: [{
    name: 'Create a course',
    description: null,
    states: [
      { name: 'GUEST', category: 'navigation', role: 'initial', terminalKind: null, description: null, actor: null },
      { name: 'LOGIN_PAGE', category: 'Navigation', role: null },
      { name: 'DASHBOARD', category: 'NAVIGATION', role: 'TERMINAL', terminalKind: 'success' },
    ],
    transitions: [
      { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP', condition: null },
      { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: null, condition: 'ON_SUCCESS', transitionType: null },
    ],
  }],
  missingFlowCandidates: ['Password reset', 'Sign up'],
  missingStateCandidates: [{ key: 'ERR', title: 'Login error', reason: 'Bad password', confidence: '70%' }],
  suggestions: [{ type: 'error path', title: 'x', rationale: 'y', confidence: 0.4, severity: 'urgent' }, 'not an object'],
};

describe('FlowDraftSchema tolerates what models really send', () => {
  const draft = FlowDraftSchema.parse(sloppy);

  it('accepts null for unused optional fields and fixes enum case', () => {
    const [workflow] = draft.workflows;
    expect(workflow.description).toBeUndefined();
    expect(workflow.states.map((state) => [state.category, state.role, state.terminalKind])).toEqual([
      ['NAVIGATION', 'INITIAL', null],
      ['NAVIGATION', undefined, undefined],
      ['NAVIGATION', 'TERMINAL', 'SUCCESS'],
    ]);
    expect(workflow.transitions[0].condition).toBeUndefined();
    expect(workflow.transitions[1].action).toBeUndefined();
  });

  it('reads confidence from a string or a percentage, and gives the workflow a key', () => {
    expect(draft.confidence).toBe(0.85);
    expect(draft.missingStateCandidates[0].confidence).toBe(0.7);
    expect(draft.workflows[0].key).toBe('CREATE_A_COURSE');
  });

  it('drops entries that are not objects instead of failing the draft', () => {
    expect(draft.missingFlowCandidates).toEqual([]);
    expect(draft.assumptions).toEqual(['Admin signs in first']);
    expect(draft.suggestions).toHaveLength(1);
    expect(draft.suggestions[0].type).toBe('ERROR_PATH');
    expect(draft.suggestions[0].severity).toBe('INFO');
    expect(draft.source).toBe('AI');
  });

  it('still refuses a draft with no usable flow', () => {
    expect(() => FlowDraftSchema.parse({ ...sloppy, workflows: [] })).toThrow();
    expect(() => FlowDraftSchema.parse({ ...sloppy, workflows: [{ name: 'x', states: [] }] })).toThrow();
    expect(() => FlowDraftSchema.parse({ ...sloppy, workflows: [{ name: 'x', states: [{ name: 'A' }], transitions: [{ from: 'A' }] }] })).toThrow();
  });
});
