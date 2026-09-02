import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRotation, REFRESH_GRACE_MS, RotatableSession } from './refresh-rotation';

const NOW = new Date('2026-09-03T12:00:00.000Z');

function session(overrides: Partial<RotatableSession> = {}): RotatableSession {
  return {
    refreshTokenHash: 'current-hash',
    previousRefreshTokenHash: null,
    rotatedAt: null,
    revokedAt: null,
    expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

test('the live token rotates normally', () => {
  const result = classifyRotation(session(), 'current-hash', NOW);
  assert.equal(result.status, 'CURRENT');
});

test('a token superseded moments ago is still honoured', () => {
  const rotated = session({
    previousRefreshTokenHash: 'old-hash',
    rotatedAt: new Date(NOW.getTime() - 1_000),
  });
  const result = classifyRotation(rotated, 'old-hash', NOW);
  assert.equal(result.status, 'GRACE');
});

test('the grace window is inclusive of its own boundary', () => {
  const rotated = session({
    previousRefreshTokenHash: 'old-hash',
    rotatedAt: new Date(NOW.getTime() - REFRESH_GRACE_MS),
  });
  assert.equal(classifyRotation(rotated, 'old-hash', NOW).status, 'GRACE');
});

test('the same token one millisecond later is reuse', () => {
  const rotated = session({
    previousRefreshTokenHash: 'old-hash',
    rotatedAt: new Date(NOW.getTime() - REFRESH_GRACE_MS - 1),
  });
  const result = classifyRotation(rotated, 'old-hash', NOW);
  assert.equal(result.status, 'REUSED');
  assert.notEqual(result.session, null);
});

test('a revoked session is unknown rather than reuse, so nothing is re-revoked', () => {
  const revoked = session({
    previousRefreshTokenHash: 'old-hash',
    rotatedAt: new Date(NOW.getTime() - 1_000),
    revokedAt: new Date(NOW.getTime() - 500),
  });
  assert.equal(classifyRotation(revoked, 'current-hash', NOW).status, 'UNKNOWN');
  assert.equal(classifyRotation(revoked, 'old-hash', NOW).status, 'UNKNOWN');
});

test('an expired session is unknown even when the hash matches', () => {
  const expired = session({ expiresAt: new Date(NOW.getTime() - 1) });
  assert.equal(classifyRotation(expired, 'current-hash', NOW).status, 'UNKNOWN');
});

test('a session that has never rotated cannot produce a grace hit', () => {
  // rotatedAt is null, so the epoch fallback must land outside the window
  // rather than treating any unrecognised hash as a race.
  const fresh = session({ previousRefreshTokenHash: 'old-hash' });
  assert.equal(classifyRotation(fresh, 'old-hash', NOW).status, 'REUSED');
});

test('an unknown token resolves to no session at all', () => {
  const result = classifyRotation(null, 'whatever', NOW);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.session, null);
});

test('two racing refreshes both survive a rotation', () => {
  // The scenario the grace window exists for: A rotates R1 to R2, B arrives
  // still holding R1 a moment later. Both must come away with a live session.
  const afterA = session({
    refreshTokenHash: 'R2',
    previousRefreshTokenHash: 'R1',
    rotatedAt: new Date(NOW.getTime() - 50),
  });
  assert.equal(classifyRotation(afterA, 'R2', NOW).status, 'CURRENT');
  assert.equal(classifyRotation(afterA, 'R1', NOW).status, 'GRACE');
});
