import crypto from 'node:crypto';
import {
  CodebaseAnalysisSchema,
  CodeEntitySchema,
  CodeRelationshipSchema,
} from '@tellann/desktop-contracts';

export {
  CodebaseAnalysisSchema,
  CodeEntitySchema,
  CodeRelationshipSchema,
} from '@tellann/desktop-contracts';
export type {
  CodebaseAnalysis,
  CodebaseAnalysisStatus,
  CodebaseFinding,
  CodeEntity,
  CodeEvidence,
  CodeRelationship,
  SoftwareFeature,
} from '@tellann/desktop-contracts';
import type { CodebaseAnalysis, CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';

/** Bump only when the serialized analyzer → graph-store boundary changes. */
export const CODE_INTELLIGENCE_SCHEMA_VERSION = '1.0';

export type AnalysisIdentity = {
  schemaVersion: string;
  graphVersion: string;
  contentHash: string;
  analyzerVersions: Record<string, string>;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

function byCanonicalValue(left: unknown, right: unknown): number {
  return JSON.stringify(canonical(left)).localeCompare(JSON.stringify(canonical(right)));
}

function canonicalEntity(entity: CodeEntity): unknown {
  return canonical({
    ...entity,
    evidence: [...entity.evidence].sort(byCanonicalValue),
  });
}

function canonicalRelationship(relationship: CodeRelationship): unknown {
  return canonical({
    ...relationship,
    evidence: [...relationship.evidence].sort(byCanonicalValue),
  });
}

/**
 * Content-address the semantic graph, not timestamps, job ids, or insertion
 * order. Local and cloud runs over the same snapshot must produce this value.
 */
export function computeAnalysisGraphVersion(
  analysis: Pick<CodebaseAnalysis, 'repositoryFingerprint' | 'contentHash' | 'analyzerVersions' | 'entities' | 'relationships'>,
): string {
  const payload = {
    schemaVersion: CODE_INTELLIGENCE_SCHEMA_VERSION,
    repositoryFingerprint: analysis.repositoryFingerprint,
    contentHash: analysis.contentHash,
    analyzerVersions: canonical(analysis.analyzerVersions),
    entities: [...analysis.entities].sort((a, b) => a.id.localeCompare(b.id)).map(canonicalEntity),
    relationships: [...analysis.relationships].sort((a, b) => a.id.localeCompare(b.id)).map(canonicalRelationship),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function analysisIdentity(analysis: CodebaseAnalysis): AnalysisIdentity {
  return {
    schemaVersion: CODE_INTELLIGENCE_SCHEMA_VERSION,
    graphVersion: analysis.graphVersion,
    contentHash: analysis.contentHash,
    analyzerVersions: analysis.analyzerVersions,
  };
}

/** Validate both the public shape and referential/content identity. */
export function assertCanonicalAnalysis(value: unknown): asserts value is CodebaseAnalysis {
  const analysis = CodebaseAnalysisSchema.parse(value);
  const entityIds = new Set<string>();
  for (const entity of analysis.entities) {
    CodeEntitySchema.parse(entity);
    if (entityIds.has(entity.id)) throw new Error(`DUPLICATE_CODE_ENTITY:${entity.id}`);
    entityIds.add(entity.id);
  }
  const relationshipIds = new Set<string>();
  for (const relationship of analysis.relationships) {
    CodeRelationshipSchema.parse(relationship);
    if (relationshipIds.has(relationship.id)) throw new Error(`DUPLICATE_CODE_RELATIONSHIP:${relationship.id}`);
    if (!entityIds.has(relationship.source) || !entityIds.has(relationship.target)) {
      throw new Error(`DANGLING_CODE_RELATIONSHIP:${relationship.id}`);
    }
    relationshipIds.add(relationship.id);
  }
  const expected = computeAnalysisGraphVersion(analysis);
  if (analysis.graphVersion !== expected) {
    throw new Error(`CODE_GRAPH_VERSION_MISMATCH:expected=${expected}:actual=${analysis.graphVersion}`);
  }
}
