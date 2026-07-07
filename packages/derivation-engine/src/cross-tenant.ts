import { PrismaClient } from '@sots/db';

export interface CrossTenantSuggestion {
  suggestedStateName: string;
  category: string;
  confidence: number;
  rationale: string;
  sourceTier: 'CROSS_TENANT';
  patternId: string;
}

/**
 * Queries the CrossTenantPatternIndex for branch-state suggestions
 * matching the given canonical state name and domain.
 *
 * Returns an empty array (never throws) to keep the suggestion pipeline safe.
 */
export async function getCrossTenantSuggestions(
  canonical: string,
  domain: string,
  db: PrismaClient,
): Promise<CrossTenantSuggestion[]> {
  try {
    const entry = await (db as any).crossTenantPatternIndex.findUnique({
      where: { patternKey_domain: { patternKey: canonical, domain } },
    });

    if (!entry) return [];

    const branches: any[] = Array.isArray(entry.suggestedBranches) ? entry.suggestedBranches : [];

    return branches.map((branch: any) => ({
      suggestedStateName: branch.suggestedStateName,
      category: branch.category ?? 'BUSINESS',
      confidence: Math.min((branch.confidence ?? (entry.confidenceScore as number)) * 0.9, 0.95),
      rationale:
        branch.rationale ??
        `Observed in ${entry.occurrenceCount} organization(s) with domain: ${domain}`,
      sourceTier: 'CROSS_TENANT' as const,
      patternId: `ct:${entry.id}`,
    }));
  } catch {
    // Never fail the suggestion pipeline due to cross-tenant lookup errors
    return [];
  }
}
