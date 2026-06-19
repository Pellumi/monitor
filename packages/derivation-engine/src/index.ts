import { PrismaClient, PatternLibraryEntry } from '@sots/db';

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
  /** Phase 1: always INTERNAL_LIBRARY */
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
// Step 2: Pattern Library Lookup + Ranked Suggestions (Gap #2)
// ---------------------------------------------------------------------------

/**
 * Returns a list of branch-state suggestions for a given raw state name.
 */
export async function getSuggestions(
  rawStateName: string,
  applicationId?: string,
  organizationId?: string
): Promise<SuggestionResult[]> {
  const canonical = await normalizeIntent(rawStateName, applicationId, organizationId);

  const patterns = await prisma.patternLibraryEntry.findMany({
    where: { active: true },
  });

  const matches = patterns.filter((p: PatternLibraryEntry) =>
    p.triggerCanonicals
      .split(',')
      .map((s: string) => s.trim())
      .includes(canonical)
  );

  return matches
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
}

// ---------------------------------------------------------------------------
// Utility: disconnect (for clean shutdown in API services)
// ---------------------------------------------------------------------------

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
