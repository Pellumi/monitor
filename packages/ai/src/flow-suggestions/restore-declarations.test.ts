import { describe, expect, it } from 'vitest';
import { restoreDeclarationSuggestions } from './restore-declarations';
import type { DroppedDeclarationInput } from './schema';

describe('restoreDeclarationSuggestions', () => {
  it('suggests restoring a detail whose citation now checks out against the document', () => {
    const leftOut: DroppedDeclarationInput[] = [
      { code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'CONFIDENCE_PAGE', message: 'The heading "How prepared are you?" for CONFIDENCE_PAGE was left out: there is no text to check it against.', detail: 'How prepared are you?' },
    ];
    const suggestions = restoreDeclarationSuggestions(leftOut, 'The page asks How prepared are you? with three options.');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].type).toBe('RESTORE_DECLARATION');
    expect(suggestions[0].restoreDeclaration).toEqual({ targetKind: 'STATE', target: 'CONFIDENCE_PAGE', detail: 'How prepared are you?', code: 'UNSUPPORTED_DETAIL' });
  });

  it('does not suggest restoring a detail the document still does not support', () => {
    const leftOut: DroppedDeclarationInput[] = [
      { code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'CONFIDENCE_PAGE', message: 'left out', detail: 'a heading never written anywhere' },
    ];
    expect(restoreDeclarationSuggestions(leftOut, 'Completely unrelated text.')).toEqual([]);
  });

  it('never restores a whole dropped state or transition (UNSUPPORTED_TOPOLOGY) — only a sub-field', () => {
    const leftOut: DroppedDeclarationInput[] = [
      { code: 'UNSUPPORTED_TOPOLOGY', severity: 'WARNING', target: 'BILLING_PORTAL', message: 'removed', detail: 'the billing portal' },
    ];
    expect(restoreDeclarationSuggestions(leftOut, 'Manage your billing on the billing portal page.')).toEqual([]);
  });

  it('marks a transition target correctly from the "from → to" label', () => {
    const leftOut: DroppedDeclarationInput[] = [
      { code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'LOGIN_PAGE → DASHBOARD', message: 'left out', detail: 'Sign in' },
    ];
    const suggestions = restoreDeclarationSuggestions(leftOut, 'They click Sign in to continue.');
    expect(suggestions[0].restoreDeclaration?.targetKind).toBe('TRANSITION');
    expect(suggestions[0].targetNodeId).toBeUndefined();
  });

  it('carries field and the structured value through, for a precise restore', () => {
    const leftOut: DroppedDeclarationInput[] = [
      {
        code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'LOGIN_PAGE → DASHBOARD', message: 'left out',
        detail: 'Sign in', field: 'control', value: { role: 'button', label: 'Sign in' },
      },
    ];
    const suggestions = restoreDeclarationSuggestions(leftOut, 'They click the Sign in button to continue.');
    expect(suggestions[0].restoreDeclaration).toEqual({
      targetKind: 'TRANSITION', target: 'LOGIN_PAGE → DASHBOARD', detail: 'Sign in', code: 'UNSUPPORTED_DETAIL',
      field: 'control', value: { role: 'button', label: 'Sign in' },
    });
  });

  it('treats an environment or actor drop as a FLOW-level target, not a state', () => {
    const leftOut: DroppedDeclarationInput[] = [
      { code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'the flow', message: 'left out', detail: 'STAGING', field: 'environment' },
      { code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target: 'the flow', message: 'left out', detail: 'ADMIN', field: 'actor' },
    ];
    const suggestions = restoreDeclarationSuggestions(leftOut, 'Run this in staging only, signed in as an admin.');
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((suggestion) => suggestion.restoreDeclaration?.targetKind === 'FLOW')).toBe(true);
    expect(suggestions.every((suggestion) => suggestion.targetNodeId === undefined)).toBe(true);
  });
});
