/**
 * AI package integration tests — replaces the legacy ts-node script.
 * Tests cover the sanitizer and the mock AI provider end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { generateAiFlowDraft, sanitizeAiInput } from './index';

describe('sanitizeAiInput — integration via index export', () => {
  it('redacts env-style secrets: password=value', () => {
    const result = sanitizeAiInput('password=supersecret123 email a@example.com');
    // The password= pattern matches ENV_SECRET_RE
    expect(result).toMatch(/\[redacted/);
    expect(result).not.toContain('supersecret123');
  });

  it('redacts email addresses', () => {
    const result = sanitizeAiInput('Please contact a@example.com for support');
    expect(result).toContain('[redacted-email]');
    expect(result).not.toContain('a@example.com');
  });
});

describe('generateAiFlowDraft — mock provider', () => {
  it('generates a valid flow graph using the mock AI provider', async () => {
    const result = await generateAiFlowDraft({
      productDescription: 'An LMS where students bid on course access using tokens.',
      domainKey: 'LMS',
      rulesets: [],
    });

    expect(result).toBeDefined();
    expect(result.validation).toBeDefined();
    expect(result.validation.valid).toBe(true);
  }, 15_000);
});
