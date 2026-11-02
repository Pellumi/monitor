import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeAutonomousAction } from './autonomous-risk';
import type { AuthorizeAutonomousActionInput } from './autonomous-risk';

const input = (overrides: Partial<AuthorizeAutonomousActionInput> = {}): AuthorizeAutonomousActionInput => ({
  riskTier: 'READ_ONLY',
  environment: 'STAGING',
  scopeApproval: { approvedAt: '2026-01-01T00:00:00.000Z', approvedByUserId: 'user-1', planVersion: 1 },
  actionFingerprint: 'action-1',
  ...overrides,
});

test('production blocks every tier, even one already carrying a per-action approval', () => {
  for (const riskTier of ['READ_ONLY', 'REVERSIBLE', 'STATE_CHANGING', 'HIGH_IMPACT'] as const) {
    const decision = authorizeAutonomousAction(input({
      riskTier,
      environment: 'PRODUCTION',
      perActionApproval: { actionFingerprint: 'action-1', approvedAt: '2026-01-01T00:00:00.000Z' },
    }));
    assert.equal(decision.allowed, false, riskTier);
    if (!decision.allowed) assert.equal(decision.reason, 'PRODUCTION_BLOCKED');
  }
});

test('read-only, reversible and state-changing actions need only the run\'s scope approved once', () => {
  for (const riskTier of ['READ_ONLY', 'REVERSIBLE', 'STATE_CHANGING'] as const) {
    assert.equal(authorizeAutonomousAction(input({ riskTier })).allowed, true, riskTier);
  }
});

test('without a scope approval, nothing below high-impact is allowed, and a person is asked', () => {
  const decision = authorizeAutonomousAction(input({ riskTier: 'STATE_CHANGING', scopeApproval: null }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresHumanApproval, true);
  if (!decision.allowed) assert.equal(decision.reason, 'NO_SCOPE_APPROVAL');
});

test('high-impact is blocked even with an approved scope, until that exact action is approved', () => {
  const blocked = authorizeAutonomousAction(input({ riskTier: 'HIGH_IMPACT' }));
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.requiresHumanApproval, true);
  if (!blocked.allowed) assert.equal(blocked.reason, 'HIGH_IMPACT_ALWAYS_GATED');

  const approved = authorizeAutonomousAction(input({
    riskTier: 'HIGH_IMPACT',
    perActionApproval: { actionFingerprint: 'action-1', approvedAt: '2026-01-01T00:00:00.000Z' },
  }));
  assert.equal(approved.allowed, true);
});

test('a per-action approval for a different action never covers this one', () => {
  const decision = authorizeAutonomousAction(input({
    riskTier: 'HIGH_IMPACT',
    actionFingerprint: 'action-2',
    perActionApproval: { actionFingerprint: 'action-1', approvedAt: '2026-01-01T00:00:00.000Z' },
  }));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, 'HIGH_IMPACT_ALWAYS_GATED');
});
