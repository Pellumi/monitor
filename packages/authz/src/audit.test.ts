import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { writeAuditLog, extractAuditContext } from './audit';
import { AuditAction } from '@sots/db';

// ─── Mock PrismaClient ─────────────────────────────────────────────────────────
const mockCreate = vi.fn().mockResolvedValue({});
const mockPrisma = {
  auditLog: { create: mockCreate },
} as any;

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an audit log entry with all required fields', async () => {
    await writeAuditLog(mockPrisma, {
      action: AuditAction.API_KEY_CREATED,
      userId: 'user-123',
      organizationId: 'org-456',
      applicationId: 'app-789',
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      metadata: { keyPrefix: 'sk_live_abc' },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0].data;
    expect(call.action).toBe(AuditAction.API_KEY_CREATED);
    expect(call.userId).toBe('user-123');
    expect(call.organizationId).toBe('org-456');
    expect(call.ipAddress).toBe('1.2.3.4');
    expect(call.userAgent).toBe('Mozilla/5.0');
    expect(call.metadata).toMatchObject({ applicationId: 'app-789', keyPrefix: 'sk_live_abc' });
  });

  it('does NOT throw when the DB write fails (fail-silent contract)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));

    // Must not throw — audit failures should never surface to the caller
    await expect(
      writeAuditLog(mockPrisma, { action: AuditAction.API_KEY_REVOKED }),
    ).resolves.toBeUndefined();
  });

  it('handles null userId and organizationId gracefully', async () => {
    await writeAuditLog(mockPrisma, {
      action: AuditAction.SUBSCRIPTION_ACTIVATED,
      userId: null,
      organizationId: null,
    });

    const call = mockCreate.mock.calls[0][0].data;
    expect(call.userId).toBeNull();
    expect(call.organizationId).toBeNull();
  });

  it('writes minimal entry with only action field', async () => {
    await writeAuditLog(mockPrisma, { action: AuditAction.RULESET_VERSION_PROMOTED });
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe('extractAuditContext', () => {
  it('extracts ip from x-forwarded-for header', () => {
    const req = { headers: { 'x-forwarded-for': '10.0.0.1', 'user-agent': 'curl/7.0' } };
    const ctx = extractAuditContext(req);
    expect(ctx.ipAddress).toBe('10.0.0.1');
    expect(ctx.userAgent).toBe('curl/7.0');
  });

  it('falls back to req.ip when x-forwarded-for is absent', () => {
    const req = { ip: '192.168.1.1', headers: {} };
    const ctx = extractAuditContext(req);
    expect(ctx.ipAddress).toBe('192.168.1.1');
  });

  it('returns nulls when no ip context is available', () => {
    const req = { headers: {} };
    const ctx = extractAuditContext(req);
    expect(ctx.ipAddress).toBeNull();
    expect(ctx.userAgent).toBeNull();
  });
});
