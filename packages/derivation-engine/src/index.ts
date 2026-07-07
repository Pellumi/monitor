import { PrismaClient, PatternLibraryEntry } from '@sots/db';
import { getCrossTenantSuggestions, CrossTenantSuggestion } from './cross-tenant';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestionResult {
  suggestedStateName: string;
  category: string;
  /** 0.0–1.0. Higher = more universally applicable. */
  confidence: number;
  rationale: string;
  /** Tier 1: INTERNAL_LIBRARY, Tier 1.5: CROSS_TENANT */
  sourceTier: 'INTERNAL_LIBRARY' | 'CROSS_TENANT' | 'EXTERNAL_ENRICHMENT';
  patternId: string;
  libraryVersion: string;
}

// ---------------------------------------------------------------------------
// Step 1: Scoped Intent Normalization (Gap #1 + Governance Scopes)
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw user-entered state name to a canonical behavior ID by
 * querying the IntentNormalizationEntry table. Supports APPLICATION,
 * ORGANIZATION, and GLOBAL scopes with prioritized lookup.
 */
export async function normalizeIntent(
  rawStateName: string,
  applicationId?: string,
  organizationId?: string
): Promise<string> {
  const normalized = rawStateName.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');

  // 1. Check APPLICATION scope
  if (applicationId) {
    const appEntry = await prisma.intentNormalizationEntry.findFirst({
      where: { scope: 'APPLICATION', rawName: normalized, applicationId },
    });
    if (appEntry) return appEntry.canonical;
  }

  // 2. Check ORGANIZATION scope
  if (organizationId) {
    const orgEntry = await prisma.intentNormalizationEntry.findFirst({
      where: { scope: 'ORGANIZATION', rawName: normalized, organizationId },
    });
    if (orgEntry) return orgEntry.canonical;
  }

  // 3. Check GLOBAL scope
  const globalEntry = await prisma.intentNormalizationEntry.findFirst({
    where: { scope: 'GLOBAL', rawName: normalized },
  });
  if (globalEntry) return globalEntry.canonical;

  return normalized;
}

// ---------------------------------------------------------------------------
// Step 2: Pattern Library Lookup + Ranked Suggestions (Gap #2 — Tier 1)
// ---------------------------------------------------------------------------

/**
 * Returns a list of branch-state suggestions for a given raw state name.
 *
 * Sources (in priority order):
 *   Tier 1  — Internal pattern library (PatternLibraryEntry)
 *   Tier 1.5 — Cross-tenant anonymized patterns (CrossTenantPatternIndex)
 *              Only included if organizationId is provided and the org has
 *              allowCrossTenantPatterns = true.
 */
export async function getSuggestions(
  rawStateName: string,
  applicationId?: string,
  organizationId?: string
): Promise<SuggestionResult[]> {
  const canonical = await normalizeIntent(rawStateName, applicationId, organizationId);

  // ── Tier 1: Internal library ──────────────────────────────────────────────
  const patterns = await prisma.patternLibraryEntry.findMany({
    where: { active: true },
  });

  const internalMatches = patterns.filter((p: PatternLibraryEntry) =>
    p.triggerCanonicals
      .split(',')
      .map((s: string) => s.trim())
      .includes(canonical)
  );

  const tier1Results: SuggestionResult[] = internalMatches
    .map((p: PatternLibraryEntry) => ({
      suggestedStateName: p.suggestedStateName,
      category: p.category,
      confidence: p.confidence,
      rationale: p.rationale,
      sourceTier: 'INTERNAL_LIBRARY' as const,
      patternId: p.patternId,
      libraryVersion: p.libraryVersion,
    }))
    .sort((a: SuggestionResult, b: SuggestionResult) => b.confidence - a.confidence);

  // ── Tier 1.5: Cross-tenant patterns ──────────────────────────────────────
  let tier15Results: SuggestionResult[] = [];

  if (organizationId) {
    // Check if the org is opted in to cross-tenant patterns
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { allowCrossTenantPatterns: true },
    });

    if (org?.allowCrossTenantPatterns) {
      // Infer domain from the canonical (simple heuristic — same as index builder)
      const domain = inferDomainFromCanonical(canonical);
      const crossTenantMatches: CrossTenantSuggestion[] = await getCrossTenantSuggestions(
        canonical,
        domain,
        prisma,
      );

      // Build existing internal suggestion name set for deduplication
      const internalNames = new Set(tier1Results.map(r => r.suggestedStateName.toUpperCase()));

      tier15Results = crossTenantMatches
        .filter(ct => !internalNames.has(ct.suggestedStateName.toUpperCase()))
        .map(ct => ({
          ...ct,
          libraryVersion: 'cross-tenant-v1',
        }));
    }
  }

  // Internal library first, cross-tenant appended at lower priority
  return [...tier1Results, ...tier15Results];
}

// ---------------------------------------------------------------------------
// Utility: disconnect (for clean shutdown in API services)
// ---------------------------------------------------------------------------

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Internal: domain inference (same logic as cross-tenant index builder)
// ---------------------------------------------------------------------------

function inferDomainFromCanonical(canonical: string): string {
  const lower = canonical.toLowerCase();
  if (lower.includes('checkout') || lower.includes('cart') || lower.includes('product') || lower.includes('order')) return 'ecommerce';
  if (lower.includes('course') || lower.includes('lesson') || lower.includes('enrollment') || lower.includes('quiz')) return 'lms';
  if (lower.includes('login') || lower.includes('signup') || lower.includes('auth') || lower.includes('password')) return 'auth';
  return 'generic';
}
