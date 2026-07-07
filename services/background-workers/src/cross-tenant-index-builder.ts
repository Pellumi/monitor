import { PrismaClient } from '@sots/db';

/**
 * Gap 4 — Cross-Tenant Structural Pattern Matching (Derivation Engine Tier 1.5)
 *
 * This module builds and queries the CrossTenantPatternIndex table.
 *
 * PRIVACY MODEL:
 *   - Only organizations with allowCrossTenantPatterns = true contribute data.
 *   - Organization IDs and Application IDs are NEVER stored in the index.
 *   - Each index entry is the anonymized aggregate of ≥3 distinct organizations.
 *   - Anonymized example stores only { stateName, category, transitionCount }.
 */

const MIN_DISTINCT_ORGS = 3; // minimum number of distinct organizations to form an index entry
const CONFIDENCE_SCALE  = 50; // occurrenceCount / CONFIDENCE_SCALE → capped at 1.0

// ─────────────────────────────────────────────────────────────────────────────
// Index Builder (runs weekly via background-workers)
// ─────────────────────────────────────────────────────────────────────────────

export async function runCrossTenantIndexBuilder(prisma?: PrismaClient): Promise<void> {
  const TAG = '[cross-tenant-index-builder]';
  const db = prisma ?? new PrismaClient();

  try {
    console.log(`${TAG} Starting cross-tenant index build...`);

    // Load all BehaviorGraphNodes from opted-in organizations
    const nodes = await db.behaviorGraphNode.findMany({
      where: {
        graph: {
          application: {
            organization: { allowCrossTenantPatterns: true },
          },
        },
        canonicalBehavior: { not: null },
      },
      select: {
        canonicalBehavior: true,
        category: true,
        graph: {
          select: {
            application: {
              select: {
                organizationId: true,
                organization: {
                  select: { allowCrossTenantPatterns: true },
                },
              },
            },
          },
        },
        edgesFrom: { select: { id: true } },
      },
    });

    // Also infer domain from PatternLibraryEntry or use a flat domain approach
    // For now, derive domain from the BehaviorGraph.workflowType or canonicalBehavior prefix
    type PatternGroup = {
      canonical: string;
      domain: string;
      orgIds: Set<string>;
      categories: string[];
      transitionCounts: number[];
    };

    const groups = new Map<string, PatternGroup>();

    for (const node of nodes) {
      const canonical = node.canonicalBehavior!;
      const orgId = node.graph.application.organizationId ?? 'unknown';
      if (orgId === 'unknown') continue;

      // Infer domain from canonical (first segment) or default to 'generic'
      const domain = inferDomainFromCanonical(canonical);
      const key = `${canonical}::${domain}`;

      if (!groups.has(key)) {
        groups.set(key, {
          canonical,
          domain,
          orgIds: new Set(),
          categories: [],
          transitionCounts: [],
        });
      }

      const group = groups.get(key)!;
      group.orgIds.add(orgId);
      group.categories.push(node.category ?? 'BUSINESS');
      group.transitionCounts.push(node.edgesFrom.length);
    }

    let upserted = 0;
    let skipped = 0;

    for (const [, group] of groups.entries()) {
      if (group.orgIds.size < MIN_DISTINCT_ORGS) {
        skipped++;
        continue; // not enough distinct organizations — privacy threshold
      }

      const occurrenceCount = group.orgIds.size;
      const confidenceScore = Math.min(occurrenceCount / CONFIDENCE_SCALE, 1.0);

      // Compute the most common category
      const categoryCounts = group.categories.reduce<Record<string, number>>(
        (acc, cat) => { acc[cat] = (acc[cat] ?? 0) + 1; return acc; },
        {},
      );
      const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'BUSINESS';

      const avgTransitions = group.transitionCounts.length > 0
        ? group.transitionCounts.reduce((a, b) => a + b, 0) / group.transitionCounts.length
        : 0;

      const anonymizedExample = {
        stateName: group.canonical,
        category: dominantCategory,
        transitionCount: Math.round(avgTransitions),
        // organizationId and applicationId intentionally omitted
      };

      // Build suggested branches from the PatternLibraryEntry (if available)
      const libraryMatches = await db.patternLibraryEntry.findMany({
        where: {
          active: true,
          triggerCanonicals: { contains: group.canonical },
        },
        select: {
          suggestedStateName: true,
          category: true,
          rationale: true,
          confidence: true,
        },
      });

      const suggestedBranches = libraryMatches.map(m => ({
        suggestedStateName: m.suggestedStateName,
        category: m.category,
        rationale: m.rationale,
        confidence: m.confidence,
      }));

      await db.crossTenantPatternIndex.upsert({
        where: { patternKey_domain: { patternKey: group.canonical, domain: group.domain } },
        create: {
          patternKey: group.canonical,
          domain: group.domain,
          anonymizedExample,
          occurrenceCount,
          confidenceScore,
          suggestedBranches,
        },
        update: {
          occurrenceCount,
          confidenceScore,
          anonymizedExample,
          suggestedBranches,
          updatedAt: new Date(),
        },
      });

      upserted++;
    }

    console.log(
      `${TAG} Done — upserted: ${upserted} patterns, ` +
      `skipped: ${skipped} (below ${MIN_DISTINCT_ORGS}-org threshold)`,
    );
  } catch (err) {
    console.error(`${TAG} Error`, err);
  } finally {
    if (!prisma) await db.$disconnect();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-tenant suggestion lookup (called from derivation engine)
// ─────────────────────────────────────────────────────────────────────────────

export interface CrossTenantSuggestion {
  suggestedStateName: string;
  category: string;
  confidence: number;
  rationale: string;
  sourceTier: 'CROSS_TENANT';
  patternId: string;
}

export async function getCrossTenantSuggestions(
  canonical: string,
  domain: string,
  db: PrismaClient,
): Promise<CrossTenantSuggestion[]> {
  try {
    // Look up the index for this canonical+domain
    const entry = await db.crossTenantPatternIndex.findUnique({
      where: { patternKey_domain: { patternKey: canonical, domain } },
    });

    if (!entry) return [];

    const branches = Array.isArray(entry.suggestedBranches) ? entry.suggestedBranches as any[] : [];

    return branches.map((branch: any) => ({
      suggestedStateName: branch.suggestedStateName,
      category: branch.category ?? 'BUSINESS',
      confidence: Math.min((branch.confidence ?? entry.confidenceScore) * 0.9, 0.95),
      // Cross-tenant confidence is slightly discounted vs. internal library
      rationale: branch.rationale ?? `Observed in ${entry.occurrenceCount} org(s) with domain: ${domain}`,
      sourceTier: 'CROSS_TENANT' as const,
      patternId: `ct:${entry.id}`,
    }));
  } catch {
    // Never fail the suggestion pipeline due to cross-tenant lookup errors
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain inference helper
// ─────────────────────────────────────────────────────────────────────────────

function inferDomainFromCanonical(canonical: string): string {
  const lower = canonical.toLowerCase();
  if (lower.includes('checkout') || lower.includes('cart') || lower.includes('product') || lower.includes('order')) {
    return 'ecommerce';
  }
  if (lower.includes('course') || lower.includes('lesson') || lower.includes('enrollment') || lower.includes('quiz')) {
    return 'lms';
  }
  if (lower.includes('login') || lower.includes('signup') || lower.includes('auth') || lower.includes('password')) {
    return 'auth';
  }
  return 'generic';
}
