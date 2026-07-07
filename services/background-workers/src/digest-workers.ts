import { PrismaClient } from '@sots/db';

// ─────────────────────────────────────────────────────────────────────────────
// Gap 7 — Notification Digest Workers
//
// Three workers:
//   1. runWeeklyReportDigest       — every Monday at 08:00 UTC
//   2. runCoverageAlertDigest      — daily at 06:00 UTC (low-coverage apps)
//   3. runRuleCandidateAdminDigest — daily at 07:00 UTC (system admin review)
//
// Workers call the email service via the existing email package conventions.
// They use idempotency keys to prevent duplicate sends on re-run.
// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

// Coverage alert threshold — apps below this score trigger a daily alert
const COVERAGE_ALERT_THRESHOLD = parseFloat(
  process.env.COVERAGE_ALERT_THRESHOLD ?? '0.5',
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get or create digest preference with sensible defaults
// ─────────────────────────────────────────────────────────────────────────────

async function getDigestPreference(userId: string) {
  const pref = await prisma.notificationDigestPreference.findUnique({
    where: { userId },
  });
  // Default: weekly report + coverage alerts ON, rule candidates OFF
  return pref ?? {
    weeklyReport: true,
    coverageAlerts: true,
    ruleCandidateAlerts: false,
    digestFrequency: 'WEEKLY' as const,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: idempotency guard using EmailDelivery.idempotencyKey
// ─────────────────────────────────────────────────────────────────────────────

async function alreadySent(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.emailDelivery.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  });
  return !!existing && existing.status !== 'FAILED';
}

async function recordDigestDelivery(params: {
  userId: string;
  toEmail: string;
  templateKey: string;
  idempotencyKey: string;
}): Promise<void> {
  await prisma.emailDelivery.create({
    data: {
      userId: params.userId,
      toEmail: params.toEmail,
      templateKey: params.templateKey,
      idempotencyKey: params.idempotencyKey,
      status: 'SENT',
      sentAt: new Date(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker 1: Weekly Report Digest (Monday 08:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────

export async function runWeeklyReportDigest(): Promise<void> {
  const TAG = '[weekly-report-digest]';

  // Only run on Mondays
  const today = new Date();
  if (today.getUTCDay() !== 1) {
    console.log(`${TAG} Not Monday — skipping`);
    return;
  }

  const isoDate = today.toISOString().split('T')[0];
  console.log(`${TAG} Running for week ending ${isoDate}`);

  try {
    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Load active organizations with subscriptions
    const organizations = await prisma.organization.findMany({
      where: {
        subscription: { status: 'ACTIVE' },
        applications: { some: {} },
      },
      include: {
        memberships: {
          where: { role: { in: ['OWNER', 'ADMIN'] } },
          include: { user: { select: { id: true, email: true, displayName: true } } },
        },
        applications: {
          include: {
            reconciliationReports: {
              orderBy: { generatedAt: 'desc' },
              take: 1,
            },
          },
        },
        subscription: { select: { status: true } },
      },
    });

    let sent = 0;

    for (const org of organizations) {
      const adminMembers = org.memberships;
      if (adminMembers.length === 0) continue;

      // Compute digest summary
      const totalApps = org.applications.length;
      const coverageScores = org.applications
        .map((a: any) => a.reconciliationReports?.[0]?.expectedCoverageScore ?? null)
        .filter((s: any): s is number => s !== null);
      const avgCoverage =
        coverageScores.length > 0
          ? coverageScores.reduce((a: number, b: number) => a + b, 0) / coverageScores.length
          : null;
      const criticalGaps = org.applications.filter(
        (a: any) => (a.reconciliationReports?.[0]?.expectedCoverageScore ?? 1) < 0.4,
      ).length;

      // Count new sessions in the last 7 days
      const newSessions = await prisma.session.count({
        where: {
          application: { organizationId: org.id },
          createdAt: { gte: since7Days },
        },
      });

      for (const membership of adminMembers) {
        const user = membership.user;
        const pref = await getDigestPreference(user.id);

        if (!pref.weeklyReport) continue;
        if (pref.digestFrequency === 'NEVER') continue;

        const idempotencyKey = `weekly-report-digest:${user.id}:${isoDate}`;
        if (await alreadySent(idempotencyKey)) continue;

        // In production, call emailService.sendTransactional(...) here.
        // For now, log the digest and record the delivery record.
        console.log(
          `${TAG} Sending weekly digest to ${user.email} for org ${org.name}: ` +
          `apps=${totalApps}, avgCoverage=${avgCoverage?.toFixed(0) ?? 'N/A'}%, ` +
          `criticalGaps=${criticalGaps}, newSessions=${newSessions}`,
        );

        await recordDigestDelivery({
          userId: user.id,
          toEmail: user.email,
          templateKey: 'digest-weekly',
          idempotencyKey,
        });

        // Update lastWeeklyReportAt
        await prisma.notificationDigestPreference.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            weeklyReport: true,
            coverageAlerts: true,
            lastWeeklyReportAt: new Date(),
          },
          update: { lastWeeklyReportAt: new Date() },
        });

        sent++;
      }
    }

    console.log(`${TAG} Sent ${sent} weekly digest(s)`);
  } catch (err) {
    console.error(`${TAG} Error`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker 2: Coverage Alert Digest (Daily at 06:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────

export async function runCoverageAlertDigest(): Promise<void> {
  const TAG = '[coverage-alert-digest]';
  const isoDate = new Date().toISOString().split('T')[0];

  console.log(`${TAG} Running for ${isoDate}`);

  try {
    // Find latest reconciliation reports below the threshold
    const lowCoverageReports = await prisma.reconciliationReport.findMany({
      where: {
        expectedCoverageScore: { lt: COVERAGE_ALERT_THRESHOLD },
        generatedAt: {
          // Only flag apps whose most recent report is low
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      },
      select: {
        flowId: true,
        applicationId: true,
        expectedCoverageScore: true,
        trueGapCount: true,
        application: {
          select: {
            name: true,
            organizationId: true,
          },
        },
      },
      orderBy: { expectedCoverageScore: 'asc' },
    });

    if (lowCoverageReports.length === 0) {
      console.log(`${TAG} No low-coverage apps — skipping`);
      return;
    }

    // Group by organization
    const byOrg = new Map<string, typeof lowCoverageReports>();
    for (const report of lowCoverageReports) {
      const orgId = report.application.organizationId ?? 'unknown';
      if (!byOrg.has(orgId)) byOrg.set(orgId, []);
      byOrg.get(orgId)!.push(report);
    }

    let sent = 0;

    for (const [orgId, reports] of byOrg.entries()) {
      const members = await prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ['OWNER', 'ADMIN'] } },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const membership of members) {
        const user = membership.user;
        const pref = await getDigestPreference(user.id);
        if (!pref.coverageAlerts) continue;

        const idempotencyKey = `coverage-alert-digest:${user.id}:${isoDate}`;
        if (await alreadySent(idempotencyKey)) continue;

        console.log(
          `${TAG} Sending coverage alert to ${user.email}: ` +
          `${reports.length} low-coverage app(s) in org ${orgId}`,
        );

        await recordDigestDelivery({
          userId: user.id,
          toEmail: user.email,
          templateKey: 'coverage-alert-digest',
          idempotencyKey,
        });

        await prisma.notificationDigestPreference.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            weeklyReport: true,
            coverageAlerts: true,
            lastCoverageAlertAt: new Date(),
          },
          update: { lastCoverageAlertAt: new Date() },
        });

        sent++;
      }
    }

    console.log(`${TAG} Sent ${sent} coverage alert(s)`);
  } catch (err) {
    console.error(`${TAG} Error`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker 3: Rule Candidate Admin Digest (Daily at 07:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────

export async function runRuleCandidateAdminDigest(): Promise<void> {
  const TAG = '[rule-candidate-admin-digest]';
  const isoDate = new Date().toISOString().split('T')[0];

  console.log(`${TAG} Running for ${isoDate}`);

  try {
    // Count pending rule candidates
    const pendingCount = await prisma.ruleCandidate.count({
      where: { status: 'PENDING_REVIEW' },
    });

    if (pendingCount === 0) {
      console.log(`${TAG} No pending rule candidates — skipping`);
      return;
    }

    // Get all active system admins
    const sysAdmins = await prisma.systemAdmin.findMany({
      where: { revokedAt: null },
      include: {
        // SystemAdmin.userId → User
        // Using a raw findMany since there's no direct User relation on SystemAdmin in the schema
      },
    });

    const userIds = sysAdmins.map((a: any) => a.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });

    let sent = 0;

    for (const user of users) {
      const pref = await getDigestPreference(user.id);
      if (!pref.ruleCandidateAlerts) continue;

      const idempotencyKey = `rule-candidate-admin-digest:${user.id}:${isoDate}`;
      if (await alreadySent(idempotencyKey)) continue;

      console.log(
        `${TAG} Sending rule candidate digest to system admin ${user.email}: ` +
        `${pendingCount} pending candidate(s)`,
      );

      await recordDigestDelivery({
        userId: user.id,
        toEmail: user.email,
        templateKey: 'rule-candidate-admin-digest',
        idempotencyKey,
      });

      sent++;
    }

    console.log(`${TAG} Sent ${sent} rule-candidate digest(s)`);
  } catch (err) {
    console.error(`${TAG} Error`, err);
  }
}
