/**
 * User-facing notification API (Phase 1).
 *
 * All routes are organization-scoped and return only the calling user's own
 * recipient rows — organization membership alone never exposes another
 * recipient's notification. Mounted behind the gateway's `/organizations/*`
 * proxy, which terminates auth via the same cookie/JWT the other routes use.
 */
import { EventEmitter } from 'node:events';
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationDevicePlatform,
  NotificationSeverity,
  type PrismaClient,
} from '@tellann/db';

type AuthedRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: AuthedRequest, res: Response, next: NextFunction) => unknown;

/**
 * In-process fan-out: when onboarding-api creates a notification itself it
 * publishes here so any SSE stream held open by the same process flushes at
 * once. Cross-process producers are picked up by the stream's reconciliation
 * poll instead.
 */
export const notificationHub = new EventEmitter();
notificationHub.setMaxListeners(0);

export interface NotificationCreatedEvent {
  organizationId: string;
  recipientUserIds: string[];
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const MAX_PAGE = 50;
const DEFAULT_PAGE = 20;
const STREAM_POLL_MS = 4_000;
const STREAM_HEARTBEAT_MS = 25_000;

/** A deep link is safe to hand back only if it stays inside this app. */
function safeDeepLink(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

function serializeRow(row: {
  id: string;
  readAt: Date | null;
  dismissedAt: Date | null;
  actionedAt: Date | null;
  createdAt: Date;
  notification: {
    id: string;
    type: string;
    category: string;
    severity: NotificationSeverity;
    title: string;
    body: string;
    deepLink: string | null;
    applicationId: string | null;
    groupKey: string | null;
    metadata: unknown;
    createdAt: Date;
  };
}) {
  return {
    // The opaque per-recipient row id is what every mutation route addresses.
    id: row.id,
    notificationId: row.notification.id,
    type: row.notification.type,
    category: row.notification.category,
    severity: row.notification.severity,
    title: row.notification.title,
    body: row.notification.body,
    deepLink: safeDeepLink(row.notification.deepLink),
    applicationId: row.notification.applicationId,
    groupKey: row.notification.groupKey,
    metadata: row.notification.metadata ?? {},
    createdAt: row.notification.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    actionedAt: row.actionedAt?.toISOString() ?? null,
  };
}

const NOTIFICATION_INCLUDE = {
  notification: {
    select: {
      id: true,
      type: true,
      category: true,
      severity: true,
      title: true,
      body: true,
      deepLink: true,
      applicationId: true,
      groupKey: true,
      metadata: true,
      createdAt: true,
    },
  },
} as const;

/** Minimal shape of the email package's WebPushSender, kept structural so this
 *  router does not need a direct dependency on it. */
export interface WebPushLike {
  send: (
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: { id: string; title: string; body: string; severity: string; tag: string; deepLink?: string | null },
  ) => Promise<{ ok: boolean; gone: boolean; statusCode?: number; error?: string }>;
}

export function createNotificationRouter(input: {
  prisma: PrismaClient;
  verifyJwt: Middleware;
  verifyOrgMembership: Middleware;
  vapidPublicKey?: string | null;
  webPush?: WebPushLike | null;
}) {
  const { prisma, verifyJwt, verifyOrgMembership, vapidPublicKey, webPush } = input;
  const router = Router();
  const guard: Middleware[] = [verifyJwt, verifyOrgMembership];

  // ── Feed ──────────────────────────────────────────────────────────────────

  /**
   * GET /organizations/:orgId/notifications
   * Query: filter=all|unread|critical, limit, cursor (opaque), includeDismissed
   * Returns { notifications, unreadCount, nextCursor }.
   */
  router.get('/organizations/:orgId/notifications', ...guard, async (req: AuthedRequest, res: Response) => {
    const { orgId } = req.params;
    const userId = req.user!.id;
    const filter = String(req.query.filter ?? 'all');
    const includeDismissed = req.query.includeDismissed === 'true';
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_PAGE, 1), MAX_PAGE);
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;

    const where: Record<string, unknown> = {
      userId,
      organizationId: orgId,
      deliveredToFeed: true,
    };
    if (!includeDismissed) where.dismissedAt = null;
    if (filter === 'unread') where.readAt = null;
    if (filter === 'critical') {
      where.notification = { severity: { in: [NotificationSeverity.HIGH, NotificationSeverity.CRITICAL] } };
    }

    try {
      const [rows, unreadCount] = await Promise.all([
        prisma.userNotification.findMany({
          where,
          include: NOTIFICATION_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        prisma.userNotification.count({
          where: { userId, organizationId: orgId, deliveredToFeed: true, dismissedAt: null, readAt: null },
        }),
      ]);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        notifications: page.map(serializeRow),
        unreadCount,
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Notifications] list error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /** GET /organizations/:orgId/notifications/:id — a single feed row. */
  router.get('/organizations/:orgId/notifications/:id', ...guard, async (req: AuthedRequest, res: Response) => {
    const row = await prisma.userNotification.findFirst({
      where: { id: req.params.id, userId: req.user!.id, organizationId: req.params.orgId },
      include: NOTIFICATION_INCLUDE,
    });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(serializeRow(row));
  });

  // ── Read / dismiss / action ───────────────────────────────────────────────

  async function ownRow(orgId: string, userId: string, id: string) {
    return prisma.userNotification.findFirst({
      where: { id, userId, organizationId: orgId },
      select: { id: true, readAt: true, dismissedAt: true, notificationId: true },
    });
  }

  /** PATCH /…/notifications/:id/read — idempotent. */
  router.patch('/organizations/:orgId/notifications/:id/read', ...guard, async (req: AuthedRequest, res: Response) => {
    const row = await ownRow(req.params.orgId, req.user!.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    const updated = row.readAt
      ? row
      : await prisma.userNotification.update({ where: { id: row.id }, data: { readAt: new Date() } });
    const unreadCount = await prisma.userNotification.count({
      where: { userId: req.user!.id, organizationId: req.params.orgId, deliveredToFeed: true, dismissedAt: null, readAt: null },
    });
    res.json({ id: updated.id, readAt: (updated.readAt ?? new Date()).toISOString?.() ?? updated.readAt, unreadCount });
  });

  /** POST /…/notifications/read-all — marks every unread feed row read. */
  router.post('/organizations/:orgId/notifications/read-all', ...guard, async (req: AuthedRequest, res: Response) => {
    const result = await prisma.userNotification.updateMany({
      where: { userId: req.user!.id, organizationId: req.params.orgId, deliveredToFeed: true, readAt: null, dismissedAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: result.count, unreadCount: 0 });
  });

  /** PATCH /…/notifications/:id/dismiss — hides the row; also marks it read. */
  router.patch('/organizations/:orgId/notifications/:id/dismiss', ...guard, async (req: AuthedRequest, res: Response) => {
    const row = await ownRow(req.params.orgId, req.user!.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    const now = new Date();
    await prisma.userNotification.update({
      where: { id: row.id },
      data: { dismissedAt: row.dismissedAt ?? now, readAt: row.readAt ?? now },
    });
    const unreadCount = await prisma.userNotification.count({
      where: { userId: req.user!.id, organizationId: req.params.orgId, deliveredToFeed: true, dismissedAt: null, readAt: null },
    });
    res.json({ id: row.id, dismissed: true, unreadCount });
  });

  /**
   * POST /…/notifications/:id/action — records that the user followed the
   * notification's call to action and returns the validated deep link. The
   * caller must still be authorized for whatever the link opens.
   */
  router.post('/organizations/:orgId/notifications/:id/action', ...guard, async (req: AuthedRequest, res: Response) => {
    const row = await prisma.userNotification.findFirst({
      where: { id: req.params.id, userId: req.user!.id, organizationId: req.params.orgId },
      include: { notification: { select: { deepLink: true } } },
    });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    const now = new Date();
    await prisma.userNotification.update({
      where: { id: row.id },
      data: { actionedAt: row.actionedAt ?? now, readAt: row.readAt ?? now },
    });
    res.json({ id: row.id, actioned: true, deepLink: safeDeepLink(row.notification.deepLink) });
  });

  // ── Web Push subscriptions ────────────────────────────────────────────────

  /** GET /…/push-config — the VAPID public key and whether push is configured. */
  router.get('/organizations/:orgId/push-config', ...guard, async (_req: AuthedRequest, res: Response) => {
    res.json({
      vapidPublicKey: vapidPublicKey ?? null,
      webPushConfigured: !!vapidPublicKey,
    });
  });

  /** GET /…/push-subscriptions — this user's registered browsers. */
  router.get('/organizations/:orgId/push-subscriptions', ...guard, async (req: AuthedRequest, res: Response) => {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, endpoint: true, deviceLabel: true, userAgent: true, enabled: true, failureCount: true, lastSeenAt: true, createdAt: true },
    });
    res.json(
      subs.map((s) => ({
        ...s,
        // The endpoint is a capability URL; only its origin is useful to show.
        endpointOrigin: safeOrigin(s.endpoint),
        endpoint: undefined,
        lastSeenAt: s.lastSeenAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    );
  });

  /**
   * POST /…/push-subscriptions — register (or refresh) a browser subscription.
   * Body: { endpoint, keys: { p256dh, auth }, deviceLabel? }
   */
  router.post('/organizations/:orgId/push-subscriptions', ...guard, async (req: AuthedRequest, res: Response) => {
    const { endpoint, keys, deviceLabel } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      return res.status(400).json({ error: 'INVALID_ENDPOINT' });
    }
    if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
      return res.status(400).json({ error: 'INVALID_KEYS' });
    }
    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 400) || null;
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user!.id,
        organizationId: req.params.orgId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        deviceLabel: typeof deviceLabel === 'string' ? deviceLabel.slice(0, 120) : null,
      },
      update: {
        // Re-claim the endpoint for whoever is signed in here now.
        userId: req.user!.id,
        organizationId: req.params.orgId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        enabled: true,
        failureCount: 0,
        lastSeenAt: new Date(),
      },
      select: { id: true, enabled: true, createdAt: true },
    });
    res.status(201).json({ id: sub.id, enabled: sub.enabled });
  });

  /** DELETE /…/push-subscriptions/:id — unregister one browser by row id. */
  router.delete('/organizations/:orgId/push-subscriptions/:id', ...guard, async (req: AuthedRequest, res: Response) => {
    const result = await prisma.pushSubscription.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ deleted: true });
  });

  /**
   * POST /…/push-subscriptions/unregister — remove by endpoint, which is what
   * the browser knows about itself on logout / permission change.
   */
  router.post('/organizations/:orgId/push-subscriptions/unregister', ...guard, async (req: AuthedRequest, res: Response) => {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null;
    if (!endpoint) return res.status(400).json({ error: 'ENDPOINT_REQUIRED' });
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.id } });
    res.json({ deleted: true });
  });

  /**
   * POST /…/push-subscriptions/test — send a test push to the user's
   * subscriptions. Needs the orchestrator's Web Push sender to be configured.
   */
  router.post('/organizations/:orgId/push-subscriptions/test', ...guard, async (req: AuthedRequest, res: Response) => {
    if (!webPush) return res.status(503).json({ error: 'WEB_PUSH_NOT_CONFIGURED' });
    const subs = await prisma.pushSubscription.findMany({ where: { userId: req.user!.id, enabled: true } });
    if (subs.length === 0) return res.status(400).json({ error: 'NO_SUBSCRIPTIONS' });
    let sent = 0;
    const failures: Array<{ statusCode?: number; error?: string }> = [];
    for (const sub of subs) {
      const result = await webPush.send(sub, {
        id: 'test',
        title: 'Tellann test notification',
        body: 'Browser notifications are working.',
        severity: 'INFO',
        tag: 'tellann-test',
      });
      if (result.ok) {
        sent += 1;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failureCount: 0, lastSeenAt: new Date() } });
      } else {
        failures.push({ statusCode: result.statusCode, error: result.error });
        console.warn('[Notifications] test push send failed', {
          subscriptionId: sub.id,
          endpointOrigin: safeOrigin(sub.endpoint),
          statusCode: result.statusCode,
          error: result.error,
        });
        if (result.gone) {
          await prisma.pushSubscription.update({ where: { id: sub.id }, data: { enabled: false } });
        } else {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { failureCount: { increment: 1 } },
          });
        }
      }
    }
    res.json({ sent, total: subs.length, failures });
  });

  // ── Desktop devices ───────────────────────────────────────────────────────

  /**
   * POST /…/notification-devices — register (or refresh) a running desktop
   * installation. Body: { installationId, platform, appVersion?, label? }
   */
  router.post('/organizations/:orgId/notification-devices', ...guard, async (req: AuthedRequest, res: Response) => {
    const { installationId, platform, appVersion, label } = req.body ?? {};
    if (typeof installationId !== 'string' || installationId.length < 8) {
      return res.status(400).json({ error: 'INVALID_INSTALLATION_ID' });
    }
    const normalizedPlatform = String(platform ?? '').toUpperCase();
    if (!(normalizedPlatform in NotificationDevicePlatform)) {
      return res.status(400).json({ error: 'INVALID_PLATFORM', platforms: Object.keys(NotificationDevicePlatform) });
    }
    const device = await prisma.notificationDevice.upsert({
      where: { installationId },
      create: {
        userId: req.user!.id,
        organizationId: req.params.orgId,
        installationId,
        platform: normalizedPlatform as NotificationDevicePlatform,
        appVersion: typeof appVersion === 'string' ? appVersion.slice(0, 40) : null,
        label: typeof label === 'string' ? label.slice(0, 80) : null,
        enabled: true,
        present: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: req.user!.id,
        organizationId: req.params.orgId,
        platform: normalizedPlatform as NotificationDevicePlatform,
        appVersion: typeof appVersion === 'string' ? appVersion.slice(0, 40) : undefined,
        present: true,
        enabled: true,
        lastSeenAt: new Date(),
      },
      select: { id: true, enabled: true, present: true },
    });
    res.status(201).json(device);
  });

  /**
   * PATCH /…/notification-devices/:installationId — presence heartbeat or
   * enable/disable toggle. Body: { present?, enabled? }
   */
  router.patch('/organizations/:orgId/notification-devices/:installationId', ...guard, async (req: AuthedRequest, res: Response) => {
    const device = await prisma.notificationDevice.findFirst({
      where: { installationId: req.params.installationId, userId: req.user!.id },
      select: { id: true },
    });
    if (!device) return res.status(404).json({ error: 'NOT_FOUND' });
    const data: Record<string, unknown> = { lastSeenAt: new Date() };
    if (typeof req.body?.present === 'boolean') data.present = req.body.present;
    if (typeof req.body?.enabled === 'boolean') data.enabled = req.body.enabled;
    const updated = await prisma.notificationDevice.update({
      where: { id: device.id },
      data,
      select: { id: true, enabled: true, present: true },
    });
    res.json(updated);
  });

  /** DELETE /…/notification-devices/:installationId — revoke on sign-out. */
  router.delete('/organizations/:orgId/notification-devices/:installationId', ...guard, async (req: AuthedRequest, res: Response) => {
    const result = await prisma.notificationDevice.deleteMany({
      where: { installationId: req.params.installationId, userId: req.user!.id },
    });
    if (result.count === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ deleted: true });
  });

  // ── SSE stream ────────────────────────────────────────────────────────────

  /**
   * GET /organizations/:orgId/notification-stream
   *
   * Server-to-client only, so SSE rather than a socket. Emits `notification`
   * events carrying the changed feed rows, plus periodic `: heartbeat` comments.
   * `Last-Event-ID` (or `?cursor=`) resumes without loss or duplication: it is
   * the ISO timestamp of the last change the client saw.
   */
  router.get('/organizations/:orgId/notification-stream', ...guard, async (req: AuthedRequest, res: Response) => {
    const { orgId } = req.params;
    const userId = req.user!.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');

    const startCursor =
      (typeof req.headers['last-event-id'] === 'string' && req.headers['last-event-id']) ||
      (typeof req.query.cursor === 'string' && req.query.cursor) ||
      new Date().toISOString();
    let cursor = new Date(startCursor);
    if (Number.isNaN(cursor.getTime())) cursor = new Date();

    let closed = false;
    let wake = false;

    async function flush() {
      if (closed) return;
      const rows = await prisma.userNotification.findMany({
        where: {
          userId,
          organizationId: orgId,
          deliveredToFeed: true,
          updatedAt: { gt: cursor },
        },
        include: NOTIFICATION_INCLUDE,
        orderBy: { updatedAt: 'asc' },
        take: 50,
      });
      if (rows.length === 0) return;
      for (const row of rows) {
        const payload = serializeRow(row);
        res.write(`id: ${(row as { updatedAt: Date }).updatedAt.toISOString()}\n`);
        res.write('event: notification\n');
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
      cursor = (rows[rows.length - 1] as { updatedAt: Date }).updatedAt;
    }

    const onHubEvent = (evt: NotificationCreatedEvent) => {
      if (evt.organizationId === orgId && evt.recipientUserIds.includes(userId)) wake = true;
    };
    notificationHub.on('notification.created', onHubEvent);

    // Initial catch-up for anything created between page load and connect.
    await flush().catch((err) => console.error('[Notifications] stream flush error', err));

    const poll = setInterval(() => {
      if (closed) return;
      if (!wake) return void pollTick();
      wake = false;
      void pollTick();
    }, STREAM_POLL_MS);
    async function pollTick() {
      try {
        await flush();
      } catch (err) {
        console.error('[Notifications] stream poll error', err);
      }
    }

    const heartbeat = setInterval(() => {
      if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
    }, STREAM_HEARTBEAT_MS);

    req.on('close', () => {
      closed = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      notificationHub.off('notification.created', onHubEvent);
    });
  });

  return router;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Ordinal comparison for severity filters shared with the client. */
export function severityRank(s: NotificationSeverity): number {
  return SEVERITY_RANK[s];
}

export const NOTIFICATION_ROUTE_CONSTANTS = {
  MAX_PAGE,
  DEFAULT_PAGE,
  Channel: NotificationChannel,
  DeliveryStatus: NotificationDeliveryStatus,
};
