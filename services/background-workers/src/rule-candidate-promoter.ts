import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Worker: rule-candidate-promoter
// Schedule: Daily (staggered 1h after feedback-analyzer to ensure fresh stats)
//
// Reads accepted/rejected feedback aggregated by the feedback-analyzer,
// promotes high-acceptance patterns to RuleCandidate status, completing
// the feedback loop started in runRulesetFeedbackAnalyzer.
//
// Thresholds (configurable via env):
//   RULE_CANDIDATE_MIN_SUPPORT   = 5   (min accepted votes)
//   RULE_CANDIDATE_MIN_RATE      = 0.7 (min acceptance rate 0–1)
//   RULE_CANDIDATE_LOOKBACK_DAYS = 30  (rolling window)
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SUPPORT_COUNT = parseInt(process.env.RULE_CANDIDATE_MIN_SUPPORT ?? '5', 10);
const MIN_ACCEPTANCE_RATE = parseFloat(process.env.RULE_CANDIDATE_MIN_RATE ?? '0.7');
const LOOKBACK_DAYS = parseInt(process.env.RULE_CANDIDATE_LOOKBACK_DAYS ?? '30', 10);

export async function runRuleCandidatePromoter(): Promise<void> {
  const TAG = '[rule-candidate-promoter]';

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Load all feedback within the rolling window
    const feedback = await prisma.ruleFeedback.findMany({
      where: {
        createdAt: { gte: since },
        rulePatternId: { not: null },
        feedbackType: { in: ['ACCEPTED', 'REJECTED'] },
      },
      select: {
        rulePatternId: true,
        feedbackType: true,
        organizationId: true,
        applicationId: true,
        beforeJson: true,
        afterJson: true,
      },
    });

    if (feedback.length === 0) {
      console.log(`${TAG} No eligible feedback in the last ${LOOKBACK_DAYS} days`);
      return;
    }

    // Aggregate per pattern
    type PatternStats = {
      accepted: number;
      rejected: number;
      orgIds: Set<string>;
      sample: any;
    };

    const patternStats = new Map<string, PatternStats>();

    for (const item of feedback) {
      if (!item.rulePatternId) continue;
      const key = item.rulePatternId;
      if (!patternStats.has(key)) {
        patternStats.set(key, { accepted: 0, rejected: 0, orgIds: new Set(), sample: item.afterJson ?? item.beforeJson });
      }
      const stats = patternStats.get(key)!;
      if (item.feedbackType === 'ACCEPTED') stats.accepted++;
      if (item.feedbackType === 'REJECTED') stats.rejected++;
      stats.orgIds.add(item.organizationId);
    }

    console.log(`${TAG} Evaluated ${patternStats.size} unique patterns`);

    // Fetch already-approved or promoted candidates to skip them
    const existingCandidates = await prisma.ruleCandidate.findMany({
      where: { status: { in: ['APPROVED', 'PROMOTED'] } },
      select: { candidateJson: true },
    });
    const promotedPatternIds = new Set(
      existingCandidates
        .map((c: any) => c.candidateJson?.rulePatternId as string | undefined)
        .filter(Boolean),
    );

    let promoted = 0;
    let skipped = 0;

    for (const [patternId, stats] of patternStats.entries()) {
      const total = stats.accepted + stats.rejected;
      const acceptanceRate = total > 0 ? stats.accepted / total : 0;

      if (stats.accepted < MIN_SUPPORT_COUNT || acceptanceRate < MIN_ACCEPTANCE_RATE) {
        continue; // below threshold
      }

      if (promotedPatternIds.has(patternId)) {
        skipped++;
        continue; // already approved/promoted
      }

      // Upsert a RuleCandidate record
      await prisma.ruleCandidate.upsert({
        where: {
          // Use a composite lookup on status + source + candidateJson would be tricky;
          // instead we key on a unique candidate JSON field we inject.
          // For idempotency, we check existing PENDING_REVIEW candidates first.
          id: await getOrCreateCandidateId(patternId),
        },
        create: {
          source: 'USER_FEEDBACK',
          status: 'PENDING_REVIEW',
          confidence: parseFloat(acceptanceRate.toFixed(4)),
          candidateJson: {
            rulePatternId: patternId,
            acceptedCount: stats.accepted,
            rejectedCount: stats.rejected,
            acceptanceRate: parseFloat(acceptanceRate.toFixed(4)),
            uniqueOrganizations: stats.orgIds.size,
            lookbackDays: LOOKBACK_DAYS,
            promotedFromFeedback: true,
          },
          evidenceJson: {
            supportCount: stats.accepted,
            totalFeedback: total,
            organizations: Array.from(stats.orgIds).slice(0, 10), // limit for privacy
          },
        },
        update: {
          confidence: parseFloat(acceptanceRate.toFixed(4)),
          candidateJson: {
            rulePatternId: patternId,
            acceptedCount: stats.accepted,
            rejectedCount: stats.rejected,
            acceptanceRate: parseFloat(acceptanceRate.toFixed(4)),
            uniqueOrganizations: stats.orgIds.size,
            lookbackDays: LOOKBACK_DAYS,
            promotedFromFeedback: true,
          },
          evidenceJson: {
            supportCount: stats.accepted,
            totalFeedback: total,
            organizations: Array.from(stats.orgIds).slice(0, 10),
          },
          updatedAt: new Date(),
        },
      });

      promoted++;
      console.log(
        `${TAG} Promoted pattern ${patternId}: ` +
        `${stats.accepted}/${total} (${(acceptanceRate * 100).toFixed(1)}%) ` +
        `across ${stats.orgIds.size} org(s)`,
      );
    }

    console.log(`${TAG} Done — promoted: ${promoted}, skipped (already approved): ${skipped}`);
  } catch (err) {
    console.error(`[rule-candidate-promoter] Error`, err);
  }
}

/**
 * Returns the id of an existing PENDING_REVIEW RuleCandidate for this
 * rulePatternId, or a new UUID if none exists. Used for upsert idempotency.
 */
async function getOrCreateCandidateId(rulePatternId: string): Promise<string> {
  const existing = await (prisma.ruleCandidate.findFirst as any)({
    where: {
      status: 'PENDING_REVIEW',
      candidateJson: { path: ['rulePatternId'], equals: rulePatternId },
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const { randomUUID } = await import('crypto');
  return randomUUID();
}
