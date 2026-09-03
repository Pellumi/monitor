import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createNotificationRouter } from './notification-routes';

/**
 * The notification routes are request handling over Prisma, so Prisma is an
 * in-memory fake here. These cover the guarantees the plan's test plan calls
 * out: only the caller's rows are returned, cursor pagination and the unread
 * count stay consistent, and read / read-all / dismiss are idempotent.
 */

type Row = {
  id: string;
  userId: string;
  organizationId: string;
  deliveredToFeed: boolean;
  readAt: Date | null;
  dismissedAt: Date | null;
  actionedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  notification: {
    id: string;
    type: string;
    category: string;
    severity: string;
    title: string;
    body: string;
    deepLink: string | null;
    applicationId: string | null;
    groupKey: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  };
};

function makeRow(over: Partial<Row> & { id: string; userId: string }): Row {
  const now = new Date(Date.now() - Number(over.id.replace(/\D/g, '') || 0) * 1000);
  return {
    organizationId: 'org-1',
    deliveredToFeed: true,
    readAt: null,
    dismissedAt: null,
    actionedAt: null,
    createdAt: now,
    updatedAt: now,
    notification: {
      id: `n-${over.id}`,
      type: 'TEST',
      category: 'ALERTS',
      severity: 'MEDIUM',
      title: `Title ${over.id}`,
      body: 'Body',
      deepLink: '/applications/app-1',
      applicationId: 'app-1',
      groupKey: null,
      metadata: {},
      createdAt: now,
    },
    ...over,
  } as Row;
}

function matches(row: Row, where: any): boolean {
  if (where.userId && row.userId !== where.userId) return false;
  if (where.organizationId && row.organizationId !== where.organizationId) return false;
  if (where.deliveredToFeed !== undefined && row.deliveredToFeed !== where.deliveredToFeed) return false;
  if (where.dismissedAt === null && row.dismissedAt !== null) return false;
  if (where.readAt === null && row.readAt !== null) return false;
  if (where.notification?.severity?.in && !where.notification.severity.in.includes(row.notification.severity)) {
    return false;
  }
  if (where.id && row.id !== where.id) return false;
  return true;
}

function harness(seedRows: Row[]) {
  const rows = seedRows;
  const prisma = {
    userNotification: {
      findMany: async ({ where, take, cursor, skip, orderBy }: any) => {
        let result = rows.filter((r) => matches(r, where));
        result.sort((a, b) =>
          orderBy?.updatedAt === 'asc'
            ? a.updatedAt.getTime() - b.updatedAt.getTime()
            : b.createdAt.getTime() - a.createdAt.getTime(),
        );
        if (cursor) {
          const index = result.findIndex((r) => r.id === cursor.id);
          if (index >= 0) result = result.slice(index + (skip ?? 0));
        }
        return typeof take === 'number' ? result.slice(0, take) : result;
      },
      count: async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
      findFirst: async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
      update: async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        row.updatedAt = new Date();
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const affected = rows.filter((r) => matches(r, where));
        affected.forEach((r) => Object.assign(r, data));
        return { count: affected.length };
      },
    },
  };

  const verifyJwt = (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] ?? 'user-1', email: 'u@x.test' };
    next();
  };
  const verifyOrgMembership = (_req: any, _res: any, next: any) => next();

  const app = express();
  app.use(express.json());
  app.use(
    createNotificationRouter({
      prisma: prisma as never,
      verifyJwt,
      verifyOrgMembership,
      vapidPublicKey: null,
    }),
  );
  return app;
}

async function call(app: express.Express, method: string, path: string, opts: { user?: string } = {}) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(opts.user ? { 'x-test-user': opts.user } : {}) },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as any };
  } finally {
    server.close();
  }
}

test('list returns only the caller rows with an authoritative unread count', async () => {
  const app = harness([
    makeRow({ id: '1', userId: 'user-1' }),
    makeRow({ id: '2', userId: 'user-1', readAt: new Date() }),
    makeRow({ id: '3', userId: 'user-2' }),
  ]);
  const res = await call(app, 'GET', '/organizations/org-1/notifications');
  assert.equal(res.status, 200);
  assert.equal(res.body.notifications.length, 2);
  assert.equal(res.body.unreadCount, 1);
  assert.ok(res.body.notifications.every((n: any) => n.id === '1' || n.id === '2'));
});

test('filter=unread and filter=critical narrow the feed', async () => {
  const app = harness([
    makeRow({ id: '1', userId: 'user-1' }),
    makeRow({ id: '2', userId: 'user-1', readAt: new Date() }),
    makeRow({
      id: '3',
      userId: 'user-1',
      notification: { ...makeRow({ id: '3', userId: 'user-1' }).notification, severity: 'CRITICAL' },
    }),
  ]);
  const unread = await call(app, 'GET', '/organizations/org-1/notifications?filter=unread');
  assert.deepEqual(unread.body.notifications.map((n: any) => n.id).sort(), ['1', '3']);
  const critical = await call(app, 'GET', '/organizations/org-1/notifications?filter=critical');
  assert.deepEqual(critical.body.notifications.map((n: any) => n.id), ['3']);
});

test('cursor pagination yields every row once', async () => {
  const rows = Array.from({ length: 5 }, (_, i) => makeRow({ id: String(i + 1), userId: 'user-1' }));
  const app = harness(rows);
  const first = await call(app, 'GET', '/organizations/org-1/notifications?limit=2');
  assert.equal(first.body.notifications.length, 2);
  assert.ok(first.body.nextCursor);
  const second = await call(
    app,
    'GET',
    `/organizations/org-1/notifications?limit=2&cursor=${first.body.nextCursor}`,
  );
  const seen = new Set([...first.body.notifications, ...second.body.notifications].map((n: any) => n.id));
  assert.equal(seen.size, 4);
});

test('read is idempotent and keeps the unread count consistent', async () => {
  const app = harness([
    makeRow({ id: '1', userId: 'user-1' }),
    makeRow({ id: '2', userId: 'user-1' }),
  ]);
  const first = await call(app, 'PATCH', '/organizations/org-1/notifications/1/read');
  assert.equal(first.status, 200);
  assert.equal(first.body.unreadCount, 1);
  const again = await call(app, 'PATCH', '/organizations/org-1/notifications/1/read');
  assert.equal(again.status, 200);
  assert.equal(again.body.unreadCount, 1);
});

test('read-all clears the unread count', async () => {
  const app = harness([
    makeRow({ id: '1', userId: 'user-1' }),
    makeRow({ id: '2', userId: 'user-1' }),
  ]);
  const res = await call(app, 'POST', '/organizations/org-1/notifications/read-all');
  assert.equal(res.body.updated, 2);
  assert.equal(res.body.unreadCount, 0);
  const list = await call(app, 'GET', '/organizations/org-1/notifications');
  assert.equal(list.body.unreadCount, 0);
});

test('dismiss removes the row from the feed', async () => {
  const app = harness([makeRow({ id: '1', userId: 'user-1' })]);
  const res = await call(app, 'PATCH', '/organizations/org-1/notifications/1/dismiss');
  assert.equal(res.body.dismissed, true);
  const list = await call(app, 'GET', '/organizations/org-1/notifications');
  assert.equal(list.body.notifications.length, 0);
});

test('another user cannot read or address a row that is not theirs', async () => {
  const app = harness([makeRow({ id: '1', userId: 'user-1' })]);
  const get = await call(app, 'GET', '/organizations/org-1/notifications/1', { user: 'user-2' });
  assert.equal(get.status, 404);
  const patch = await call(app, 'PATCH', '/organizations/org-1/notifications/1/read', { user: 'user-2' });
  assert.equal(patch.status, 404);
});

test('action records the click and returns the validated deep link', async () => {
  const app = harness([makeRow({ id: '1', userId: 'user-1' })]);
  const res = await call(app, 'POST', '/organizations/org-1/notifications/1/action');
  assert.equal(res.body.actioned, true);
  assert.equal(res.body.deepLink, '/applications/app-1');
});
