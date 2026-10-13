import type { PrismaClient } from '@tellann/db';
import { getCapabilityDefinition, notificationEligible, setupNudgeKey, type CapabilityKey, type CapabilityState } from '@tellann/capabilities';
import { NotificationOrchestrator } from '@tellann/email';

// ─────────────────────────────────────────────────────────────
// Capability-linked notifications (doc Phase K).
//
// Only setup nudges are produced here, because they come from a real state transition. Health
// alerts need an endpoint-health signal that does not exist yet, so none are sent.
//
// A nudge is sent once per transition into NEEDS_SETUP. The orchestrator dedupes on the
// sourceEventId, so a rescan of the recent window cannot resend it.
// ─────────────────────────────────────────────────────────────

/** How far back to look for transitions. Longer than the job interval, so a missed run is caught up. */
const LOOKBACK_MS = 24 * 60 * 60_000;
const BATCH_SIZE = 500;

export async function runCapabilitySetupNudges(prisma: PrismaClient): Promise<{ sent: number; skipped: number }> {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const transitions = await prisma.applicationCapabilityStateChange.findMany({
    where: {
      newState: 'NEEDS_SETUP',
      createdAt: { gte: since },
      // Only transitions into the state, not reason changes within it.
      OR: [{ previousState: null }, { previousState: { not: 'NEEDS_SETUP' } }],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  });

  const notifications = new NotificationOrchestrator({ prisma });
  let sent = 0;
  let skipped = 0;
  for (const transition of transitions) {
    if (!notificationEligible('SETUP_NUDGE', transition.newState as CapabilityState)) {
      skipped += 1;
      continue;
    }
    const application = await prisma.application.findUnique({
      where: { id: transition.applicationId },
      select: { name: true, organizationId: true },
    });
    if (!application?.organizationId) {
      skipped += 1;
      continue;
    }

    let capabilityName: string;
    try {
      capabilityName = getCapabilityDefinition(transition.capabilityKey as CapabilityKey).name;
    } catch {
      skipped += 1;
      continue;
    }

    await notifications.createNotification({
      organizationId: application.organizationId,
      type: 'CAPABILITY_SETUP_NEEDED',
      category: 'PRODUCT_EDUCATION',
      severity: 'info',
      title: `Connect telemetry for ${capabilityName}`,
      body: `${application.name} needs telemetry before ${capabilityName} can show results.`,
      deepLink: `/applications/${transition.applicationId}/connect`,
      sourceEventType: 'APPLICATION_CAPABILITY_CHANGED',
      // The transition row identifies the business event, so a repeat submission is a no-op.
      sourceEventId: setupNudgeKey(transition.applicationId, transition.capabilityKey, transition.id),
    });
    sent += 1;
  }
  return { sent, skipped };
}
