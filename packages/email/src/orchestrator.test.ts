import { describe, expect, it, vi } from 'vitest';
import {
  NotificationOrchestrator,
  coerceSeverity,
  externalChannelAllowed,
  isWithinQuietHours,
  severityAtLeast,
  type RoutingPreference,
} from './orchestrator';

/**
 * The orchestrator is pure coordination over Prisma, so these tests run against
 * an in-memory fake rather than a database. They cover the behaviour the plan's
 * test plan calls out: one event → one notification with the right recipient
 * rows, dedupe/idempotency, and per-recipient channel routing.
 */

type Row = Record<string, any>;

function makeFakePrisma(seed: {
  members?: Array<{ userId: string; email: string; role?: string }>;
  preferences?: Row[];
  pushSubscriptions?: Row[];
  presentDeviceUserIds?: string[];
} = {}) {
  const notifications: Row[] = [];
  const userNotifications: Row[] = [];
  const deliveries: Row[] = [];
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;

  const api = {
    notification: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.sourceEventType_sourceEventId) {
          const { sourceEventType, sourceEventId } = where.sourceEventType_sourceEventId;
          return (
            notifications.find(
              (n) => n.sourceEventType === sourceEventType && n.sourceEventId === sourceEventId,
            ) ?? null
          );
        }
        return notifications.find((n) => n.id === where.id) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          notifications.find(
            (n) =>
              (!where.organizationId || n.organizationId === where.organizationId) &&
              (!where.dedupeKey || n.dedupeKey === where.dedupeKey),
          ) ?? null
        );
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = notifications.find((n) => n.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: id('notif'),
          organizationId: data.organization?.connect?.id ?? data.organizationId,
          ...data,
          createdAt: new Date(),
        };
        notifications.push(row);
        return row;
      }),
    },
    userNotification: {
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) {
          if (
            !userNotifications.some(
              (u) => u.notificationId === d.notificationId && u.userId === d.userId,
            )
          ) {
            userNotifications.push({ id: id('un'), ...d });
          }
        }
        return { count: data.length };
      }),
    },
    notificationDelivery: {
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) deliveries.push({ id: id('del'), ...d });
        return { count: data.length };
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.notificationId_userId_channel;
        const found = deliveries.find(
          (d) =>
            d.notificationId === key.notificationId &&
            d.userId === key.userId &&
            d.channel === key.channel,
        );
        if (found) {
          Object.assign(found, update, { attempts: (found.attempts ?? 0) + 1 });
          return found;
        }
        const row = { id: id('del'), ...create };
        deliveries.push(row);
        return row;
      }),
    },
    notificationPreference: {
      findMany: vi.fn(async ({ where }: any) => {
        return (seed.preferences ?? []).filter(
          (p) =>
            p.organizationId === where.organizationId &&
            p.category === where.category &&
            where.userId.in.includes(p.userId),
        );
      }),
    },
    organizationMembership: {
      findMany: vi.fn(async ({ where }: any) => {
        return (seed.members ?? [])
          .filter((m) => !where.role || where.role.in.includes(m.role))
          .map((m) => ({ user: { id: m.userId, email: m.email } }));
      }),
    },
    pushSubscription: {
      findMany: vi.fn(async ({ where }: any) =>
        (seed.pushSubscriptions ?? []).filter((s) => s.userId === where.userId && s.enabled),
      ),
      update: vi.fn(async () => ({})),
    },
    notificationDevice: {
      findFirst: vi.fn(async ({ where }: any) =>
        (seed.presentDeviceUserIds ?? []).includes(where.userId) ? { id: 'device-1' } : null,
      ),
    },
    $transaction: vi.fn(async (fn: any) => fn(api)),
  };
  return { api, notifications, userNotifications, deliveries };
}

const BASE = {
  organizationId: 'org-1',
  type: 'DEMONSTRATION_ANALYSIS_READY',
  category: 'ALERTS' as any,
  title: 'Analysis complete',
  body: 'Tellann discovered 8 workflows.',
  sourceEventType: 'demonstration.analysis.completed',
};

describe('severity helpers', () => {
  it('clamps loose strings to the enum', () => {
    expect(coerceSeverity('high')).toBe('HIGH');
    expect(coerceSeverity('bogus')).toBe('INFO');
    expect(coerceSeverity(undefined)).toBe('INFO');
  });

  it('orders INFO < LOW < MEDIUM < HIGH < CRITICAL', () => {
    expect(severityAtLeast('HIGH', 'MEDIUM')).toBe(true);
    expect(severityAtLeast('LOW', 'HIGH')).toBe(false);
  });
});

describe('quiet hours', () => {
  const pref = (over: Partial<RoutingPreference>): RoutingPreference => ({
    emailEnabled: true,
    inAppEnabled: true,
    webPushEnabled: true,
    desktopEnabled: true,
    frequency: 'IMMEDIATE' as any,
    minSeverity: 'LOW' as any,
    quietHoursEnabled: true,
    quietHoursStart: 22 * 60,
    quietHoursEnd: 7 * 60,
    criticalOverridesQuietHours: true,
    ...over,
  });

  it('treats a window that wraps midnight correctly', () => {
    expect(isWithinQuietHours(pref({}), new Date('2026-09-03T23:30:00Z'))).toBe(true);
    expect(isWithinQuietHours(pref({}), new Date('2026-09-03T05:00:00Z'))).toBe(true);
    expect(isWithinQuietHours(pref({}), new Date('2026-09-03T12:00:00Z'))).toBe(false);
  });

  it('lets CRITICAL through quiet hours when the override is on', () => {
    const at = new Date('2026-09-03T23:30:00Z');
    expect(externalChannelAllowed(pref({}), 'HIGH' as any, at)).toBe(false);
    expect(externalChannelAllowed(pref({}), 'CRITICAL' as any, at)).toBe(true);
    expect(externalChannelAllowed(pref({ criticalOverridesQuietHours: false }), 'CRITICAL' as any, at)).toBe(false);
  });

  it('gates on the minimum severity threshold', () => {
    const at = new Date('2026-09-03T12:00:00Z');
    expect(externalChannelAllowed(pref({ quietHoursEnabled: false, minSeverity: 'HIGH' as any }), 'MEDIUM' as any, at)).toBe(false);
    expect(externalChannelAllowed(pref({ quietHoursEnabled: false, minSeverity: 'HIGH' as any }), 'HIGH' as any, at)).toBe(true);
  });
});

describe('createNotification', () => {
  it('creates one notification and one feed row per resolved member', async () => {
    const { api, notifications, userNotifications } = makeFakePrisma({
      members: [
        { userId: 'u1', email: 'a@x.test' },
        { userId: 'u2', email: 'b@x.test' },
      ],
    });
    const orch = new NotificationOrchestrator({ prisma: api as never });

    const result = await orch.createNotification({ ...BASE, sourceEventId: 'evt-1' });

    expect(notifications).toHaveLength(1);
    expect(userNotifications).toHaveLength(2);
    expect(result.created).toBe(true);
    expect(result.recipientUserIds.sort()).toEqual(['u1', 'u2']);
  });

  it('is idempotent on (sourceEventType, sourceEventId)', async () => {
    const { api, notifications } = makeFakePrisma({
      members: [{ userId: 'u1', email: 'a@x.test' }],
    });
    const orch = new NotificationOrchestrator({ prisma: api as never });

    const first = await orch.createNotification({ ...BASE, sourceEventId: 'evt-1' });
    const second = await orch.createNotification({ ...BASE, sourceEventId: 'evt-1' });

    expect(notifications).toHaveLength(1);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.notificationId).toBe(first.notificationId);
  });

  it('folds a repeat detection into the existing notification within the cooldown', async () => {
    const { api, notifications } = makeFakePrisma({
      members: [{ userId: 'u1', email: 'a@x.test' }],
    });
    const orch = new NotificationOrchestrator({ prisma: api as never });

    await orch.createNotification({ ...BASE, dedupeKey: 'endpoint:/payments:500' });
    const again = await orch.createNotification({ ...BASE, dedupeKey: 'endpoint:/payments:500' });

    expect(notifications).toHaveLength(1);
    expect(again.deduped).toBe(true);
    expect(notifications[0].metadata.occurrences).toBe(2);
  });

  it('records an email delivery only when the recipient has email enabled', async () => {
    const sendTransactional = vi.fn(async () => ({ status: 'SENT', providerMessageId: 'p1' }));
    const { api, deliveries } = makeFakePrisma({
      members: [
        { userId: 'u1', email: 'a@x.test' },
        { userId: 'u2', email: 'b@x.test' },
      ],
      preferences: [
        { organizationId: 'org-1', userId: 'u2', category: 'ALERTS', emailEnabled: false, inAppEnabled: true, webPushEnabled: false, desktopEnabled: false, frequency: 'IMMEDIATE', minSeverity: 'LOW', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, criticalOverridesQuietHours: true },
      ],
    });
    const orch = new NotificationOrchestrator({ prisma: api as never, emailService: { sendTransactional } });

    await orch.createNotification({
      ...BASE,
      sourceEventId: 'evt-1',
      email: { templateKey: 'coverage-degraded' },
    });

    expect(sendTransactional).toHaveBeenCalledTimes(1);
    expect(sendTransactional.mock.calls[0][0]).toMatchObject({ to: 'a@x.test', _skipCentralNotification: true });
    const emailDeliveries = deliveries.filter((d) => d.channel === 'EMAIL');
    expect(emailDeliveries.map((d) => [d.userId, d.status]).sort()).toEqual([
      ['u1', 'SENT'],
      ['u2', 'SKIPPED'],
    ]);
  });

  it('skips push for a user with a visible dashboard client', async () => {
    const { api, deliveries } = makeFakePrisma({
      members: [{ userId: 'u1', email: 'a@x.test' }],
      preferences: [
        { organizationId: 'org-1', userId: 'u1', category: 'ALERTS', emailEnabled: true, inAppEnabled: true, webPushEnabled: true, desktopEnabled: false, frequency: 'IMMEDIATE', minSeverity: 'LOW', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, criticalOverridesQuietHours: true },
      ],
      pushSubscriptions: [{ id: 's1', userId: 'u1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a', enabled: true }],
    });
    const webPush = { send: vi.fn(async () => ({ ok: true, gone: false, statusCode: 201 })), publicKey: 'pk' };
    const orch = new NotificationOrchestrator({ prisma: api as never, webPush: webPush as never });

    await orch.createNotification({
      ...BASE,
      severity: 'HIGH',
      sourceEventId: 'evt-1',
      suppressPushForUserIds: ['u1'],
    });

    expect(webPush.send).not.toHaveBeenCalled();
    expect(deliveries.some((d) => d.channel === 'WEB_PUSH')).toBe(false);
  });

  it('sends web push when no dashboard client is visible', async () => {
    const { api, deliveries } = makeFakePrisma({
      members: [{ userId: 'u1', email: 'a@x.test' }],
      preferences: [
        { organizationId: 'org-1', userId: 'u1', category: 'ALERTS', emailEnabled: true, inAppEnabled: true, webPushEnabled: true, desktopEnabled: false, frequency: 'IMMEDIATE', minSeverity: 'LOW', quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, criticalOverridesQuietHours: true },
      ],
      pushSubscriptions: [{ id: 's1', userId: 'u1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a', enabled: true }],
    });
    const webPush = { send: vi.fn(async () => ({ ok: true, gone: false, statusCode: 201 })), publicKey: 'pk' };
    const orch = new NotificationOrchestrator({ prisma: api as never, webPush: webPush as never });

    await orch.createNotification({ ...BASE, severity: 'HIGH', sourceEventId: 'evt-1' });

    expect(webPush.send).toHaveBeenCalledTimes(1);
    const push = deliveries.find((d) => d.channel === 'WEB_PUSH');
    expect(push?.status).toBe('SENT');
  });
});
