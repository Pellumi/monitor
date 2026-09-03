/**
 * Central notification orchestrator.
 *
 * One `createNotification()` call per business event:
 *   1. idempotency on (sourceEventType, sourceEventId)
 *   2. dedupe/cooldown folding on (organizationId, dedupeKey)
 *   3. recipient resolution (explicit list, or org members by role)
 *   4. per-recipient preference + severity + quiet-hour routing
 *   5. transactional persistence of Notification + UserNotification + IN_APP delivery
 *   6. asynchronous fan-out to the email, Web Push and desktop adapters
 *
 * Email is one adapter here, not the owner of the record — see
 * docs/notification_implementation_plan.md.
 */
import {
  EmailCategory,
  MemberRole,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationFrequency,
  NotificationSeverity,
  Prisma,
  PrismaClient,
} from '@tellann/db';
import { ALWAYS_ON_CATEGORIES } from './notification-categories';
import type { WebPushPayload, WebPushSender } from './web-push';

export const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const SEVERITY_VALUES = new Set(Object.keys(SEVERITY_RANK));

/** Accepts a loose string (producers pass "INFO"/"high"/…) and clamps to the enum. */
export function coerceSeverity(value: string | null | undefined): NotificationSeverity {
  const upper = (value ?? '').toUpperCase();
  return (SEVERITY_VALUES.has(upper) ? upper : 'INFO') as NotificationSeverity;
}

export function severityAtLeast(value: NotificationSeverity, floor: NotificationSeverity): boolean {
  return SEVERITY_RANK[value] >= SEVERITY_RANK[floor];
}

export interface NotificationRecipientRef {
  userId: string;
  email?: string | null;
}

/** Minimal slice of NotificationPreference the routing logic reads. */
export interface RoutingPreference {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webPushEnabled: boolean;
  desktopEnabled: boolean;
  frequency: NotificationFrequency;
  minSeverity: NotificationSeverity;
  quietHoursEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  criticalOverridesQuietHours: boolean;
}

const DEFAULT_PREFERENCE: RoutingPreference = {
  emailEnabled: true,
  inAppEnabled: true,
  webPushEnabled: false,
  desktopEnabled: true,
  frequency: NotificationFrequency.IMMEDIATE,
  minSeverity: NotificationSeverity.LOW,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  criticalOverridesQuietHours: true,
};

export interface CreateNotificationInput {
  organizationId: string;
  /** Stable notification type, e.g. "DEMONSTRATION_ANALYSIS_READY". */
  type: string;
  category: EmailCategory;
  severity?: NotificationSeverity | string;
  /** Safe, user-facing copy. Never put secrets or customer PII here. */
  title: string;
  body: string;
  /** Relative, allow-listed path. Authorization is still re-checked on open. */
  deepLink?: string | null;
  sourceEventType: string;
  /** Idempotency key for this business event. Re-submitting is a no-op. */
  sourceEventId?: string | null;
  /** Folds repeat detections of the same condition inside `cooldownMs`. */
  dedupeKey?: string | null;
  /** Aggregates related findings in the UI. */
  groupKey?: string | null;
  applicationId?: string | null;
  workflowId?: string | null;
  reportId?: string | null;
  runId?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
  /** Explicit recipients. When omitted, org members (optionally by role). */
  recipients?: NotificationRecipientRef[];
  recipientRoles?: MemberRole[];
  /** Cooldown window for `dedupeKey` folding. Default 1h when a key is set. */
  cooldownMs?: number;
  /** Users with a visible dashboard client right now — suppress redundant OS push. */
  suppressPushForUserIds?: string[];
  /** Email adapter. When present, delivered subject to the recipient's email pref. */
  email?: {
    templateKey: string;
    variables?: Record<string, unknown>;
    severity?: string;
  };
}

export interface OrchestratorDelivery {
  channel: NotificationChannel;
  userId: string | null;
  status: NotificationDeliveryStatus;
  skippedReason?: string;
}

export interface CreateNotificationResult {
  notificationId: string;
  /** False when an idempotency or dedupe match short-circuited creation. */
  created: boolean;
  deduped: boolean;
  recipientUserIds: string[];
  deliveries: OrchestratorDelivery[];
}

/** What the orchestrator hands its email adapter — a subset of the email
 *  service's own input, so `NotificationEmailService` satisfies the interface. */
export interface OrchestratorEmailInput {
  templateKey: string;
  to: string;
  userId?: string | null;
  organizationId?: string | null;
  applicationId?: string | null;
  eventType: string;
  severity?: string;
  variables?: Record<string, unknown>;
  _skipCentralNotification?: boolean;
}

export interface OrchestratorEmailAdapter {
  // Method syntax (bivariant params) so the concrete email service, whose input
  // type is narrower, remains assignable.
  sendTransactional(input: OrchestratorEmailInput): Promise<{
    status: string;
    providerMessageId?: string | null;
    skippedReason?: string;
  }>;
}

/** Optional collaborators. Everything degrades gracefully when absent. */
export interface OrchestratorDeps {
  prisma: PrismaClient;
  /** The existing email service; its `sendTransactional` is reused verbatim. */
  emailService?: OrchestratorEmailAdapter;
  webPush?: WebPushSender | null;
  /** Notified after persistence so an in-process SSE hub can push immediately. */
  onPersisted?: (event: {
    notificationId: string;
    organizationId: string;
    recipientUserIds: string[];
  }) => void;
  now?: () => Date;
}

/** Minutes past midnight, UTC. Quiet hours are evaluated in UTC in Phase 1. */
function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function isWithinQuietHours(pref: RoutingPreference, at: Date): boolean {
  if (!pref.quietHoursEnabled) return false;
  if (pref.quietHoursStart === null || pref.quietHoursEnd === null) return false;
  const now = minutesOfDay(at);
  const { quietHoursStart: start, quietHoursEnd: end } = pref;
  // A window like 22:00 → 07:00 wraps past midnight.
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/** Whether an external (push/desktop) channel may fire for this severity now. */
export function externalChannelAllowed(
  pref: RoutingPreference,
  severity: NotificationSeverity,
  at: Date,
): boolean {
  if (!severityAtLeast(severity, pref.minSeverity)) return false;
  if (isWithinQuietHours(pref, at)) {
    return severity === NotificationSeverity.CRITICAL && pref.criticalOverridesQuietHours;
  }
  return true;
}

export class NotificationOrchestrator {
  private readonly prisma: PrismaClient;
  private readonly emailService?: OrchestratorDeps['emailService'];
  private readonly webPush?: WebPushSender | null;
  private readonly onPersisted?: OrchestratorDeps['onPersisted'];
  private readonly now: () => Date;

  constructor(deps: OrchestratorDeps) {
    this.prisma = deps.prisma;
    this.emailService = deps.emailService;
    this.webPush = deps.webPush ?? null;
    this.onPersisted = deps.onPersisted;
    this.now = deps.now ?? (() => new Date());
  }

  async createNotification(input: CreateNotificationInput): Promise<CreateNotificationResult> {
    const severity = coerceSeverity(input.severity);
    const at = this.now();

    // 1. Idempotency — the same business event submitted twice is one row.
    if (input.sourceEventId) {
      const existing = await this.prisma.notification.findUnique({
        where: {
          sourceEventType_sourceEventId: {
            sourceEventType: input.sourceEventType,
            sourceEventId: input.sourceEventId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return {
          notificationId: existing.id,
          created: false,
          deduped: false,
          recipientUserIds: [],
          deliveries: [],
        };
      }
    }

    // 2. Dedupe / cooldown folding.
    if (input.dedupeKey) {
      const cooldownMs = input.cooldownMs ?? 60 * 60 * 1000;
      const since = new Date(at.getTime() - cooldownMs);
      const match = await this.prisma.notification.findFirst({
        where: {
          organizationId: input.organizationId,
          dedupeKey: input.dedupeKey,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, metadata: true },
      });
      if (match) {
        const meta = (match.metadata ?? {}) as Record<string, unknown>;
        const occurrences = typeof meta.occurrences === 'number' ? meta.occurrences + 1 : 2;
        await this.prisma.notification.update({
          where: { id: match.id },
          data: { metadata: { ...meta, occurrences, lastOccurredAt: at.toISOString() } },
        });
        return {
          notificationId: match.id,
          created: false,
          deduped: true,
          recipientUserIds: [],
          deliveries: [],
        };
      }
    }

    // 3. Recipients.
    const recipientRefs = await this.resolveRecipients(input);
    const recipientUserIds = [...new Set(recipientRefs.map((r) => r.userId))];
    if (recipientUserIds.length === 0) {
      // Still record the logical notification so producers/metrics see it.
      const bare = await this.persist(input, severity, [], new Map());
      return {
        notificationId: bare.notificationId,
        created: bare.created,
        deduped: false,
        recipientUserIds: [],
        deliveries: [],
      };
    }

    // 4. Preferences.
    const prefRows = await this.prisma.notificationPreference.findMany({
      where: {
        organizationId: input.organizationId,
        userId: { in: recipientUserIds },
        category: input.category,
      },
    });
    const prefByUser = new Map<string, RoutingPreference>();
    for (const row of prefRows) {
      prefByUser.set(row.userId, {
        emailEnabled: row.emailEnabled,
        inAppEnabled: row.inAppEnabled,
        webPushEnabled: row.webPushEnabled,
        desktopEnabled: row.desktopEnabled,
        frequency: row.frequency,
        minSeverity: row.minSeverity,
        quietHoursEnabled: row.quietHoursEnabled,
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        criticalOverridesQuietHours: row.criticalOverridesQuietHours,
      });
    }
    const prefFor = (userId: string): RoutingPreference => {
      if (ALWAYS_ON_CATEGORIES.has(input.category)) {
        // Locked categories: in-app + email always on, other prefs still apply.
        const base = prefByUser.get(userId) ?? DEFAULT_PREFERENCE;
        return { ...base, emailEnabled: true, inAppEnabled: true };
      }
      return prefByUser.get(userId) ?? DEFAULT_PREFERENCE;
    };

    // 5. Persist.
    const persisted = await this.persist(input, severity, recipientRefs, prefByUser);
    this.onPersisted?.({
      notificationId: persisted.notificationId,
      organizationId: input.organizationId,
      recipientUserIds,
    });
    if (!persisted.created) {
      return {
        notificationId: persisted.notificationId,
        created: false,
        deduped: false,
        recipientUserIds,
        deliveries: [],
      };
    }

    // 6. Channel fan-out.
    const deliveries: OrchestratorDelivery[] = [];
    const suppressPush = new Set(input.suppressPushForUserIds ?? []);

    for (const ref of recipientRefs) {
      const pref = prefFor(ref.userId);

      deliveries.push({
        channel: NotificationChannel.IN_APP,
        userId: ref.userId,
        status: pref.inAppEnabled
          ? NotificationDeliveryStatus.DELIVERED
          : NotificationDeliveryStatus.SKIPPED,
        skippedReason: pref.inAppEnabled ? undefined : 'in-app disabled',
      });

      if (input.email && this.emailService) {
        deliveries.push(
          await this.deliverEmail(input, persisted.notificationId, severity, ref, pref),
        );
      }

      if (externalChannelAllowed(pref, severity, at)) {
        if (pref.webPushEnabled && !suppressPush.has(ref.userId)) {
          deliveries.push(
            await this.deliverWebPush(input, persisted.notificationId, severity, ref),
          );
        }
        if (pref.desktopEnabled) {
          deliveries.push(
            await this.deliverDesktop(persisted.notificationId, ref),
          );
        }
      }
    }

    return {
      notificationId: persisted.notificationId,
      created: true,
      deduped: false,
      recipientUserIds,
      deliveries,
    };
  }

  private async resolveRecipients(
    input: CreateNotificationInput,
  ): Promise<NotificationRecipientRef[]> {
    if (input.recipients?.length) {
      return input.recipients.filter((r) => !!r.userId);
    }
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.recipientRoles?.length ? { role: { in: input.recipientRoles } } : {}),
      },
      include: { user: { select: { id: true, email: true } } },
    });
    return memberships
      .filter((m) => !!m.user?.id)
      .map((m) => ({ userId: m.user.id, email: m.user.email }));
  }

  /**
   * Creates the Notification and its UserNotification / IN_APP delivery rows in
   * one transaction. Safe under a race: a unique-constraint collision resolves
   * to the already-persisted row.
   */
  private async persist(
    input: CreateNotificationInput,
    severity: NotificationSeverity,
    recipients: NotificationRecipientRef[],
    prefByUser: Map<string, RoutingPreference>,
  ): Promise<{ notificationId: string; created: boolean }> {
    const data: Prisma.NotificationCreateInput = {
      organization: { connect: { id: input.organizationId } },
      applicationId: input.applicationId ?? null,
      workflowId: input.workflowId ?? null,
      reportId: input.reportId ?? null,
      runId: input.runId ?? null,
      type: input.type,
      category: input.category,
      severity,
      title: input.title.slice(0, 300),
      body: input.body.slice(0, 2000),
      deepLink: input.deepLink ?? null,
      sourceEventType: input.sourceEventType,
      sourceEventId: input.sourceEventId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      groupKey: input.groupKey ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      expiresAt: input.expiresAt ?? null,
    };

    try {
      const notificationId = await this.prisma.$transaction(async (tx) => {
        const notification = await tx.notification.create({ data, select: { id: true } });
        if (recipients.length) {
          await tx.userNotification.createMany({
            data: recipients.map((ref) => ({
              notificationId: notification.id,
              userId: ref.userId,
              organizationId: input.organizationId,
              deliveredToFeed: (prefByUser.get(ref.userId) ?? DEFAULT_PREFERENCE).inAppEnabled,
              expiresAt: input.expiresAt ?? null,
            })),
            skipDuplicates: true,
          });
          const feedRecipients = recipients.filter(
            (ref) => (prefByUser.get(ref.userId) ?? DEFAULT_PREFERENCE).inAppEnabled,
          );
          if (feedRecipients.length) {
            await tx.notificationDelivery.createMany({
              data: feedRecipients.map((ref) => ({
                notificationId: notification.id,
                userId: ref.userId,
                channel: NotificationChannel.IN_APP,
                status: NotificationDeliveryStatus.DELIVERED,
                sentAt: this.now(),
                deliveredAt: this.now(),
              })),
              skipDuplicates: true,
            });
          }
        }
        return notification.id;
      });
      return { notificationId, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findExisting(input);
        if (existing) return { notificationId: existing, created: false };
      }
      throw err;
    }
  }

  private async findExisting(input: CreateNotificationInput): Promise<string | null> {
    if (input.sourceEventId) {
      const row = await this.prisma.notification.findUnique({
        where: {
          sourceEventType_sourceEventId: {
            sourceEventType: input.sourceEventType,
            sourceEventId: input.sourceEventId,
          },
        },
        select: { id: true },
      });
      if (row) return row.id;
    }
    if (input.dedupeKey) {
      const row = await this.prisma.notification.findFirst({
        where: { organizationId: input.organizationId, dedupeKey: input.dedupeKey },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (row) return row.id;
    }
    return null;
  }

  private async deliverEmail(
    input: CreateNotificationInput,
    notificationId: string,
    severity: NotificationSeverity,
    ref: NotificationRecipientRef,
    pref: RoutingPreference,
  ): Promise<OrchestratorDelivery> {
    const locked = ALWAYS_ON_CATEGORIES.has(input.category);
    if (!locked && !pref.emailEnabled) {
      await this.recordDelivery(notificationId, ref.userId, NotificationChannel.EMAIL, {
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'email disabled',
      });
      return {
        channel: NotificationChannel.EMAIL,
        userId: ref.userId,
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'email disabled',
      };
    }
    if (!ref.email) {
      return {
        channel: NotificationChannel.EMAIL,
        userId: ref.userId,
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'no address',
      };
    }
    try {
      const result = await this.emailService!.sendTransactional({
        templateKey: input.email!.templateKey,
        to: ref.email,
        userId: ref.userId,
        organizationId: input.organizationId,
        applicationId: input.applicationId ?? null,
        eventType: input.type,
        severity: input.email!.severity ?? severity,
        variables: input.email!.variables ?? {},
        // The email service must not create its own central notification for a
        // message the orchestrator already owns.
        _skipCentralNotification: true,
      });
      const status = mapEmailStatus(result.status);
      await this.recordDelivery(notificationId, ref.userId, NotificationChannel.EMAIL, {
        status,
        providerId: result.providerMessageId ?? undefined,
        skippedReason: result.skippedReason,
      });
      return {
        channel: NotificationChannel.EMAIL,
        userId: ref.userId,
        status,
        skippedReason: result.skippedReason,
      };
    } catch (err) {
      await this.recordDelivery(notificationId, ref.userId, NotificationChannel.EMAIL, {
        status: NotificationDeliveryStatus.FAILED,
        failureCode: 'adapter_error',
      });
      return {
        channel: NotificationChannel.EMAIL,
        userId: ref.userId,
        status: NotificationDeliveryStatus.FAILED,
        skippedReason: err instanceof Error ? err.message.slice(0, 120) : 'email failed',
      };
    }
  }

  private async deliverWebPush(
    input: CreateNotificationInput,
    notificationId: string,
    severity: NotificationSeverity,
    ref: NotificationRecipientRef,
  ): Promise<OrchestratorDelivery> {
    if (!this.webPush) {
      await this.recordDelivery(notificationId, ref.userId, NotificationChannel.WEB_PUSH, {
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'web push not configured',
      });
      return {
        channel: NotificationChannel.WEB_PUSH,
        userId: ref.userId,
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'web push not configured',
      };
    }

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: ref.userId, enabled: true },
    });
    if (subs.length === 0) {
      await this.recordDelivery(notificationId, ref.userId, NotificationChannel.WEB_PUSH, {
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'no subscriptions',
      });
      return {
        channel: NotificationChannel.WEB_PUSH,
        userId: ref.userId,
        status: NotificationDeliveryStatus.SKIPPED,
        skippedReason: 'no subscriptions',
      };
    }

    const payload: WebPushPayload = {
      id: notificationId,
      title: input.title.slice(0, 120),
      body: input.body.slice(0, 240),
      severity,
      deepLink: input.deepLink ?? null,
      tag: notificationId,
    };

    let anyOk = false;
    let lastError: string | undefined;
    for (const sub of subs) {
      const res = await this.webPush.send(sub, payload);
      if (res.ok) {
        anyOk = true;
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failureCount: 0, lastSeenAt: this.now() },
        });
      } else if (res.gone) {
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { enabled: false, failureCount: { increment: 1 } },
        });
        lastError = 'subscription gone';
      } else {
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failureCount: { increment: 1 } },
        });
        lastError = res.error;
      }
    }

    const status = anyOk
      ? NotificationDeliveryStatus.SENT
      : NotificationDeliveryStatus.FAILED;
    await this.recordDelivery(notificationId, ref.userId, NotificationChannel.WEB_PUSH, {
      status,
      failureCode: anyOk ? undefined : 'push_failed',
      skippedReason: anyOk ? undefined : lastError,
    });
    return {
      channel: NotificationChannel.WEB_PUSH,
      userId: ref.userId,
      status,
      skippedReason: anyOk ? undefined : lastError,
    };
  }

  /**
   * Desktop native notifications are shown by the running Electron client when
   * it receives the notification over its stream. The orchestrator only records
   * intent, and only when the user has a device currently marked present.
   */
  private async deliverDesktop(
    notificationId: string,
    ref: NotificationRecipientRef,
  ): Promise<OrchestratorDelivery> {
    const device = await this.prisma.notificationDevice.findFirst({
      where: { userId: ref.userId, enabled: true, present: true },
      select: { id: true },
    });
    const status = device
      ? NotificationDeliveryStatus.SENT
      : NotificationDeliveryStatus.SKIPPED;
    await this.recordDelivery(notificationId, ref.userId, NotificationChannel.DESKTOP, {
      status,
      skippedReason: device ? undefined : 'no running desktop',
    });
    return {
      channel: NotificationChannel.DESKTOP,
      userId: ref.userId,
      status,
      skippedReason: device ? undefined : 'no running desktop',
    };
  }

  private async recordDelivery(
    notificationId: string,
    // A compound-unique `where` cannot target a NULL component, and every
    // orchestrator delivery is per-recipient, so this is always a real user id.
    userId: string,
    channel: NotificationChannel,
    fields: {
      status: NotificationDeliveryStatus;
      providerId?: string;
      failureCode?: string;
      skippedReason?: string;
    },
  ): Promise<void> {
    const now = this.now();
    const sent =
      fields.status === NotificationDeliveryStatus.SENT ||
      fields.status === NotificationDeliveryStatus.DELIVERED
        ? now
        : null;
    await this.prisma.notificationDelivery.upsert({
      where: {
        notificationId_userId_channel: { notificationId, userId, channel },
      },
      create: {
        notificationId,
        userId,
        channel,
        status: fields.status,
        attempts: 1,
        providerId: fields.providerId ?? null,
        failureCode: fields.failureCode ?? null,
        skippedReason: fields.skippedReason ?? null,
        sentAt: sent,
        deliveredAt: fields.status === NotificationDeliveryStatus.DELIVERED ? now : null,
      },
      update: {
        status: fields.status,
        attempts: { increment: 1 },
        providerId: fields.providerId ?? undefined,
        failureCode: fields.failureCode ?? null,
        skippedReason: fields.skippedReason ?? null,
        sentAt: sent ?? undefined,
        deliveredAt:
          fields.status === NotificationDeliveryStatus.DELIVERED ? now : undefined,
      },
    });
  }
}

function mapEmailStatus(status: string): NotificationDeliveryStatus {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return NotificationDeliveryStatus.SENT;
    case 'SUPPRESSED':
      return NotificationDeliveryStatus.SUPPRESSED;
    case 'FAILED':
      return NotificationDeliveryStatus.FAILED;
    default:
      return NotificationDeliveryStatus.SKIPPED;
  }
}
