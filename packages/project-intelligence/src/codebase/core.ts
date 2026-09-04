import crypto from 'node:crypto';
import type {
  CodebaseFinding,
  CodeEntity,
  CodeEvidence,
  CodeRelationship,
} from '@tellann/desktop-contracts';

/**
 * Confidence scale. These mirror the analysis design note: a fact resolved by
 * the TypeScript type checker is not the same kind of claim as a fact guessed
 * from a directory name, and the graph has to be able to tell them apart.
 */
export const CONFIDENCE = {
  /** Resolved through the TypeScript checker to a concrete declaration. */
  compilerResolved: 1,
  /** Declared in a manifest, or matched against a framework's own contract. */
  manifest: 0.98,
  frameworkConfig: 0.98,
  /** Read straight off the syntax tree with no resolution step. */
  ast: 0.95,
  testAssertion: 0.95,
  documentation: 0.75,
  /** Inferred from a directory layout. */
  directoryHeuristic: 0.65,
  /** Inferred from an identifier's spelling. */
  namingHeuristic: 0.6,
  /** Produced by a language model from a bounded evidence bundle. */
  llmInference: 0.5,
} as const;

export const ANALYZER_VERSIONS = {
  inventory: '2.0.0',
  typescriptSemantic: '2.0.0',
  frameworkAdapters: '2.0.0',
  documentation: '2.0.0',
  featureDiscovery: '2.0.0',
  architecture: '2.0.0',
} as const;

export type EntityType = CodeEntity['type'];
export type RelationshipType = CodeRelationship['type'];

export const digest = (value: string | Buffer): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const stableId = (type: string, value: string): string =>
  `${type}:${digest(value).slice(0, 24)}`;

export const slash = (value: string): string => value.replaceAll('\\', '/');

/**
 * Identity for a declaration, keyed on file plus declaration offset so the same
 * declaration always resolves to the same node. That is what lets the linker
 * attach a call site to the definition it actually reached.
 */
export const declarationId = (type: string, file: string, position: number, name: string): string =>
  stableId(type, [file, position, name].join(' '));

export function evidenceOf(input: {
  kind: string;
  path: string;
  startLine?: number | null;
  endLine?: number | null;
  symbol?: string | null;
  excerpt?: string | null;
  analyzer: string;
  confidence: number;
}): CodeEvidence {
  return {
    kind: input.kind,
    path: input.path,
    startLine: input.startLine ?? null,
    endLine: input.endLine ?? null,
    symbol: input.symbol ?? null,
    excerpt: input.excerpt ? input.excerpt.slice(0, 500) : null,
    analyzer: input.analyzer,
    confidence: input.confidence,
  };
}

/**
 * The canonical IR under construction.
 *
 * Every lookup the later stages need is maintained incrementally here. The
 * previous implementation rebuilt adjacency with array spreads and answered
 * "does an edge like this exist" with a full relationship scan, which made
 * feature discovery quadratic in the size of the repository - a 63-file scan
 * took three minutes and a full one never finished. Keeping the indexes beside
 * the arrays keeps every downstream stage linear.
 */
/**
 * Everything one source file contributed to the graph. Kept per file so an
 * incremental rescan can drop and replay exactly the fragments belonging to the
 * files that actually changed.
 */
export type FileFragment = {
  file: string;
  contentHash: string;
  entities: CodeEntity[];
  relationships: Array<Omit<CodeRelationship, 'id'>>;
};

export class GraphBuilder {
  readonly entities: CodeEntity[] = [];
  readonly relationships: CodeRelationship[] = [];
  readonly findings: CodebaseFinding[] = [];
  readonly warnings: string[] = [];
  readonly notices: string[] = [];

  private readonly entityById = new Map<string, CodeEntity>();
  private readonly edgeIds = new Set<string>();
  private readonly outgoing = new Map<string, CodeRelationship[]>();
  private readonly incoming = new Map<string, CodeRelationship[]>();
  private readonly byType = new Map<EntityType, CodeEntity[]>();
  private readonly edgesByType = new Map<RelationshipType, CodeRelationship[]>();
  /** Set of `TYPE targetId`, so "is this model ever written?" is O(1). */
  private readonly edgeTargetIndex = new Set<string>();

  private ownerFile: string | null = null;
  private readonly fragments = new Map<string, FileFragment>();

  /** Attribute everything added until `endFile` to this source file. */
  beginFile(file: string, contentHash: string): void {
    this.ownerFile = file;
    if (!this.fragments.has(file)) {
      this.fragments.set(file, { file, contentHash, entities: [], relationships: [] });
    }
  }

  endFile(): void {
    this.ownerFile = null;
  }

  /** Fragments for the files analyzed in this run, for the incremental cache. */
  fileFragments(): FileFragment[] {
    return [...this.fragments.values()];
  }

  /** Replay a fragment captured by an earlier run of the same analyzer version. */
  replayFragment(fragment: FileFragment): void {
    this.beginFile(fragment.file, fragment.contentHash);
    for (const entity of fragment.entities) {
      this.addEntity({ ...entity, metadata: { ...entity.metadata }, evidence: [...entity.evidence] });
    }
    for (const edge of fragment.relationships) this.addEdge(edge);
    this.endFile();
  }

  private record(entity?: CodeEntity, edge?: Omit<CodeRelationship, 'id'>): void {
    if (!this.ownerFile) return;
    const fragment = this.fragments.get(this.ownerFile);
    if (!fragment) return;
    if (entity) fragment.entities.push(entity);
    if (edge) fragment.relationships.push(edge);
  }

  addEntity(entity: CodeEntity): string {
    this.record(entity);
    const existing = this.entityById.get(entity.id);
    if (existing) {
      // Keep the most confident description, and merge bounded evidence so a
      // symbol seen by two analyzers carries both justifications.
      if (entity.confidence > existing.confidence) {
        existing.confidence = entity.confidence;
        existing.type = entity.type;
      }
      if (existing.path === null && entity.path !== null) {
        existing.path = entity.path;
        existing.startLine = entity.startLine;
        existing.endLine = entity.endLine;
      }
      for (const item of entity.evidence) {
        if (existing.evidence.length >= 8) break;
        existing.evidence.push(item);
      }
      Object.assign(existing.metadata, entity.metadata);
      return existing.id;
    }
    this.entityById.set(entity.id, entity);
    this.entities.push(entity);
    const bucket = this.byType.get(entity.type);
    if (bucket) bucket.push(entity);
    else this.byType.set(entity.type, [entity]);
    return entity.id;
  }

  addEdge(edge: Omit<CodeRelationship, 'id'>): void {
    this.record(undefined, edge);
    const id = stableId('edge', [edge.source, edge.type, edge.target].join(' '));
    if (this.edgeIds.has(id)) return;
    this.edgeIds.add(id);
    const relationship: CodeRelationship = { id, ...edge };
    this.relationships.push(relationship);

    const out = this.outgoing.get(edge.source);
    if (out) out.push(relationship);
    else this.outgoing.set(edge.source, [relationship]);

    const into = this.incoming.get(edge.target);
    if (into) into.push(relationship);
    else this.incoming.set(edge.target, [relationship]);

    const typed = this.edgesByType.get(edge.type);
    if (typed) typed.push(relationship);
    else this.edgesByType.set(edge.type, [relationship]);

    this.edgeTargetIndex.add([edge.type, edge.target].join(' '));
  }

  has(id: string): boolean {
    return this.entityById.has(id);
  }

  entity(id: string): CodeEntity | undefined {
    return this.entityById.get(id);
  }

  outgoingOf(id: string): readonly CodeRelationship[] {
    return this.outgoing.get(id) ?? [];
  }

  incomingOf(id: string): readonly CodeRelationship[] {
    return this.incoming.get(id) ?? [];
  }

  ofType(type: EntityType): readonly CodeEntity[] {
    return this.byType.get(type) ?? [];
  }

  edgesOfType(type: RelationshipType): readonly CodeRelationship[] {
    return this.edgesByType.get(type) ?? [];
  }

  /** O(1) replacement for scanning every relationship looking for one shape. */
  hasEdgeInto(type: RelationshipType, target: string): boolean {
    return this.edgeTargetIndex.has([type, target].join(' '));
  }

  /**
   * A genuine coverage gap: something the analyzers could not read, so the graph
   * is incomplete. Only these make an analysis PARTIAL.
   */
  warn(message: string): void {
    if (!this.warnings.includes(message)) this.warnings.push(message);
  }

  /**
   * Something worth telling the user that is not a gap - a redaction that worked,
   * a policy that applied. Reporting these as warnings would mark almost every
   * repository partial and make the status meaningless.
   */
  notice(message: string): void {
    if (!this.notices.includes(message)) this.notices.push(message);
  }

  finding(finding: CodebaseFinding): void {
    this.findings.push(finding);
  }
}
