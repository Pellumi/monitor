import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isSystemAdmin, grantSystemAdmin, revokeSystemAdmin } from './system-admin';

// ─── Mock PrismaClient ─────────────────────────────────────────────────────────
const mockFindFirst = vi.fn();
const mockUpsert = vi.fn().mockResolvedValue({});
const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

const mockPrisma = {
  systemAdmin: {
    findFirst: mockFindFirst,
    upsert: mockUpsert,
    updateMany: mockUpdateMany,
  },
} as any;

describe('isSystemAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when an active SystemAdmin record exists', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'admin-record-1' });
    const result = await isSystemAdmin(mockPrisma, 'user-123');
    expect(result).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-123', revokedAt: null },
      select: { id: true },
    });
  });

  it('returns false when no active SystemAdmin record exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await isSystemAdmin(mockPrisma, 'user-456');
    expect(result).toBe(false);
  });

  it('returns false (fail-safe) when DB throws', async () => {
    mockFindFirst.mockRejectedValueOnce(new Error('DB timeout'));
    const result = await isSystemAdmin(mockPrisma, 'user-789');
    // Must fail SAFE — return false, not throw
    expect(result).toBe(false);
  });

  it('only queries with revokedAt: null — revoked admins are denied', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await isSystemAdmin(mockPrisma, 'revoked-user');
    const query = mockFindFirst.mock.calls[0][0];
    expect(query.where.revokedAt).toBeNull();
  });
});

describe('grantSystemAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts a SystemAdmin record with FULL scope by default', async () => {
    await grantSystemAdmin(mockPrisma, { userId: 'user-111', grantedBy: 'super-admin' });
    expect(mockUpsert).toHaveBeenCalledOnce();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'user-111' });
    expect(call.create.scope).toBe('FULL');
    expect(call.create.grantedBy).toBe('super-admin');
    expect(call.update.revokedAt).toBeNull(); // Re-activates if previously revoked
  });

  it('accepts custom scope READ_ONLY', async () => {
    await grantSystemAdmin(mockPrisma, { userId: 'user-222', scope: 'READ_ONLY' });
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.scope).toBe('READ_ONLY');
    expect(call.update.scope).toBe('READ_ONLY');
  });
});

describe('revokeSystemAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes by setting revokedAt on active records', async () => {
    await revokeSystemAdmin(mockPrisma, 'user-333');
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-333', revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
  });

  it('does not touch already-revoked records (WHERE revokedAt: null)', async () => {
    await revokeSystemAdmin(mockPrisma, 'already-revoked');
    const query = mockUpdateMany.mock.calls[0][0];
    expect(query.where.revokedAt).toBeNull();
  });
});

describe('makeRequireSystemAdmin middleware', async () => {
  const { makeRequireSystemAdmin } = await import('./system-admin');

  beforeEach(() => vi.clearAllMocks());

  it('calls next() for an active system admin', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'admin-record' });
    const req = { user: { id: 'admin-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    const middleware = makeRequireSystemAdmin(mockPrisma);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin user', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const req = { user: { id: 'regular-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    const middleware = makeRequireSystemAdmin(mockPrisma);
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is attached to the request', async () => {
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    const middleware = makeRequireSystemAdmin(mockPrisma);
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
