import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditAction, PrismaClient } from '@tellann/db';
import { findOrganizationAuditLogs, parseAuditLogTimestamp } from './organization-audit-log-query';

test('parseAuditLogTimestamp accepts ISO timestamps and rejects invalid values', () => {
  assert.equal(parseAuditLogTimestamp(undefined, 'from'), undefined);
  assert.equal(parseAuditLogTimestamp('2026-09-22T00:00:00.000Z', 'from')?.toISOString(), '2026-09-22T00:00:00.000Z');
  assert.throws(() => parseAuditLogTimestamp('not-a-date', 'to'), /INVALID_TO/);
});

test('findOrganizationAuditLogs applies searchable fields, dates, and pagination to data and count queries', async () => {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const mockPrisma = {
    $queryRaw: async (statement: { strings: readonly string[]; values: unknown[] }) => {
      const text = statement.strings.join('?');
      statements.push({ text, values: statement.values });
      if (text.includes('COUNT(*)')) return [{ count: 1n }];
      return [{
        id: 'audit-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: AuditAction.LOGIN_SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Test browser',
        metadata: { source: 'dashboard' },
        createdAt: new Date('2026-09-22T12:00:00.000Z'),
        userEmail: 'person@example.com',
        userDisplayName: 'Test Person',
      }];
    },
  } as unknown as PrismaClient;

  const result = await findOrganizationAuditLogs(mockPrisma, {
    organizationId: 'org-1',
    page: 2,
    limit: 25,
    query: '%_actor',
    action: AuditAction.LOGIN_SUCCESS,
    from: new Date('2026-09-01T00:00:00.000Z'),
    to: new Date('2026-09-30T23:59:59.999Z'),
  });

  assert.equal(result.total, 1);
  assert.deepEqual(result.data[0]?.user, { email: 'person@example.com', displayName: 'Test Person' });
  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement.text, /audit\."metadata"::text/);
    assert.match(statement.text, /audit\."ipAddress"/);
    assert.match(statement.text, /actor\."email"/);
    assert.match(statement.text, /audit\."createdAt" >=/);
    assert.match(statement.text, /audit\."createdAt" <=/);
    assert.ok(statement.values.includes('%\\%\\_actor%'));
  }
  assert.ok(statements.some((statement) => statement.values.includes(25)));
});

test('findOrganizationAuditLogs normalizes display-form action text', async () => {
  const values: unknown[] = [];
  const mockPrisma = {
    $queryRaw: async (statement: { strings: readonly string[]; values: unknown[] }) => {
      values.push(...statement.values);
      return statement.strings.join('').includes('COUNT(*)') ? [{ count: 0n }] : [];
    },
  } as unknown as PrismaClient;

  await findOrganizationAuditLogs(mockPrisma, {
    organizationId: 'org-1',
    page: 1,
    limit: 25,
    query: 'LOGIN SUCCESS',
  });

  assert.ok(values.includes('%LOGIN\\_SUCCESS%'));
});
