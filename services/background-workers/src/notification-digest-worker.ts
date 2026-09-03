import {
  EmailDeliveryStatus,
  NotificationEventStatus,
  NotificationFrequency,
  PrismaClient,
} from '@tellann/db';
import {
  BATCHABLE_CATEGORIES,
  DEFERRED_TO_DIGEST_REASON,
  NotificationEmailService,
  appUrl,
  buildIdempotencyKey,
  summarizeNotification,
} from '@tellann/email';

// ─────────────────────────────────────────────────────────────────────────────
// Notification digest delivery
//
// When a user sets a batchable category (Alerts, Reports, Digest) to a daily or
// weekly frequency, `NotificationEmailService` holds the email back and leaves
// its NotificationEvent at status CREATED with the delivery marked
// `Deferred to digest`. This worker is what eventually delivers those: it
// collects each user's held-back events, sends one summary email, and marks the
// events SENT so they are never included twice.
//
// Without this the digest frequencies would be indistinguishable from switching
// the category off.
// ─────────────────────────────────────────────────────────────────────────────

const TAG = '[notification-digest]';

/** How far back a run will look, so a long outage cannot produce a huge digest. */
const MAX_LOOKBACK_DAYS = 14;

interface DigestRunOptions {
  // Prisma emits enums as const objects, so members are values rather than
  // types; the literal union is the type-position equivalent.
  frequency: 'DAILY_DIGEST' | 'WEEKLY_DIGEST';
  periodLabel: string;
  /** Window the digest covers, in days. */
  windowDays: number;
}

export async function runNotificationDigest(
  prisma: PrismaClient,
  options: DigestRunOptions,
): Promise<void> {
  const emailService = new NotificationEmailService(prisma);
  const now = new Date();
  const windowDays = Math.min(options.windowDays, MAX_LOOKBACK_DAYS);
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  // One key per user per period, so a re-run inside the same period is a no-op.
  const periodStamp = periodStampFor(options.frequency, now);

  // Only users who actually asked for this cadence on a batchable category.
  const preferences = await prisma.notificationPreference.findMany({
    where: {
      frequency: options.frequency,
      emailEnabled: true,
      category: { in: [...BATCHABLE_CATEGORIES] },
    },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });

  if (preferences.length === 0) return;

  // Group by (user, organisation): a digest covers one organisation, since that
  // is the scope the preference itself is stored at.
  const groups = new Map<string, {
    userId: string;
    email: string;
    organizationId: string;
    categories: Set<string>;
  }>();

  for (const preference of preferences) {
    if (!preference.user?.email) continue;
    const key = `${preference.userId}:${preference.organizationId}`;
    const group = groups.get(key) ?? {
      userId: preference.userId,
      email: preference.user.email,
      organizationId: preference.organizationId,
      categories: new Set<string>(),
    };
    group.categories.add(preference.category);
    groups.set(key, group);
  }

  let sent = 0;

  for (const group of groups.values()) {
    // Events still awaiting a digest: held back by the email service and not yet
    // rolled into an earlier run.
    const deferred = await prisma.emailDelivery.findMany({
      where: {
        userId: group.userId,
        status: EmailDeliveryStatus.SKIPPED,
        error: DEFERRED_TO_DIGEST_REASON,
        createdAt: { gte: since },
        notificationEvent: {
          organizationId: group.organizationId,
          status: NotificationEventStatus.CREATED,
        },
      },
      include: { notificationEvent: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const lines: string[] = [];
    const eventIds: string[] = [];

    for (const delivery of deferred) {
      const event = delivery.notificationEvent;
      if (!event) continue;
      const payload = (event.payload ?? {}) as {
        templateKey?: string;
        variables?: Record<string, unknown>;
      };
      if (!payload.templateKey) continue;

      const summary = summarizeNotification(payload.templateKey, payload.variables ?? {});
      // Only the categories this user set to this cadence belong in this digest.
      if (!summary || !group.categories.has(summary.category)) continue;

      lines.push(`${formatDay(event.createdAt)} — ${summary.title}`);
      eventIds.push(event.id);
    }

    if (lines.length === 0) continue;

    const result = await emailService.sendTransactional({
      templateKey: 'digest-notifications',
      to: group.email,
      userId: group.userId,
      organizationId: group.organizationId,
      eventType: 'NOTIFICATION_DIGEST',
      // A digest is an email-only rollup of items that already appeared in the
      // in-app feed individually; it should not create its own feed entry.
      _skipCentralNotification: true,
      variables: {
        periodLabel: options.periodLabel,
        notificationCount: lines.length,
        summaryLines: lines.join('\n'),
        dashboardUrl: appUrl('/'),
      },
      idempotencyKey: buildIdempotencyKey([
        'notification-digest',
        options.frequency,
        group.userId,
        group.organizationId,
        periodStamp,
      ]),
    });

    // Only retire the events once the digest itself was not skipped, so a
    // suppressed or failed digest can be retried with its contents intact.
    if (result.status === EmailDeliveryStatus.SENT) {
      await prisma.notificationEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { status: NotificationEventStatus.SENT },
      });
      sent += 1;
    } else {
      console.warn(
        `${TAG} digest for ${group.userId} not sent (${result.status}${result.skippedReason ? `: ${result.skippedReason}` : ''}); ` +
        `${eventIds.length} event(s) left pending`,
      );
    }
  }

  console.log(`${TAG} ${options.frequency}: ${sent} digest(s) sent across ${groups.size} recipient group(s)`);
}

export function runDailyNotificationDigest(prisma: PrismaClient): Promise<void> {
  return runNotificationDigest(prisma, {
    frequency: NotificationFrequency.DAILY_DIGEST,
    periodLabel: 'day',
    windowDays: 1,
  });
}

export function runWeeklyNotificationDigest(prisma: PrismaClient): Promise<void> {
  return runNotificationDigest(prisma, {
    frequency: NotificationFrequency.WEEKLY_DIGEST,
    periodLabel: 'week',
    windowDays: 7,
  });
}

/** Identifies the period a run belongs to, so re-runs inside it deduplicate. */
function periodStampFor(frequency: 'DAILY_DIGEST' | 'WEEKLY_DIGEST', now: Date): string {
  const day = now.toISOString().slice(0, 10);
  if (frequency === NotificationFrequency.DAILY_DIGEST) return day;

  // Monday of the current ISO week.
  const monday = new Date(now);
  const offset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - offset);
  return monday.toISOString().slice(0, 10);
}

function formatDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
