import type { CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';

export type GraphScope = {
  organizationId: string;
  applicationId: string;
  snapshotId: string;
  graphVersion: string;
};

export type GraphProjectionQuery = {
  types?: string[];
  relationshipTypes?: string[];
  search?: string;
  /** Expand this many hops out from the matched seed set. */
  depth?: number;
  limit?: number;
  /** Anchor the projection on one node instead of a type/search match. */
  rootId?: string | null;
  direction?: 'out' | 'in' | 'both';
};

export type GraphProjection = {
  nodes: CodeEntity[];
  edges: CodeRelationship[];
  truncated: boolean;
  totalMatched: number;
};

export type GraphPath = {
  nodes: CodeEntity[];
  edges: CodeRelationship[];
  found: boolean;
};

export interface GraphStore {
  /** Create indexes and constraints. Safe to call repeatedly. */
  initialize(): Promise<void>;
  replace(scope: GraphScope, nodes: CodeEntity[], edges: CodeRelationship[]): Promise<void>;
  project(scope: GraphScope, query: GraphProjectionQuery): Promise<GraphProjection>;
  neighbors(scope: GraphScope, id: string, direction?: 'out' | 'in' | 'both'): Promise<GraphProjection>;
  shortestPath(scope: GraphScope, source: string, target: string, maxDepth?: number): Promise<GraphPath>;
  /** Everything that transitively depends on this node. */
  blastRadius(scope: GraphScope, id: string, maxDepth?: number): Promise<GraphProjection>;
  delete(scope: GraphScope): Promise<void>;
  /** Remove every graph for a snapshot that is no longer current. */
  deleteOtherVersions(scope: GraphScope): Promise<number>;
  health(): Promise<boolean>;
}

type Row = { row: unknown[] };

/** Property keys stored as JSON text because Neo4j has no nested-map values. */
const JSON_PROPERTIES = ['metadata', 'evidence'] as const;

function encodeNode(node: CodeEntity, scope: GraphScope): Record<string, unknown> {
  return {
    ...node,
    metadata: JSON.stringify(node.metadata ?? {}),
    evidence: JSON.stringify(node.evidence ?? []),
    organizationId: scope.organizationId,
    applicationId: scope.applicationId,
    snapshotId: scope.snapshotId,
    graphVersion: scope.graphVersion,
  };
}

/**
 * Reverse `encodeNode`. Without this the API hands clients a node whose
 * `metadata` and `evidence` are JSON strings while the contract promises an
 * object and an array.
 */
function decodeNode(raw: unknown): CodeEntity | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = { ...(raw as Record<string, unknown>) };
  for (const key of JSON_PROPERTIES) {
    if (typeof value[key] === 'string') {
      try {
        value[key] = JSON.parse(value[key] as string);
      } catch {
        value[key] = key === 'evidence' ? [] : {};
      }
    }
    if (value[key] === undefined || value[key] === null) value[key] = key === 'evidence' ? [] : {};
  }
  for (const key of ['organizationId', 'applicationId', 'snapshotId', 'graphVersion']) delete value[key];
  return value as unknown as CodeEntity;
}

function decodeEdge(raw: unknown): CodeRelationship | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string') return null;
  let evidence: unknown = value.evidence;
  if (typeof evidence === 'string') {
    try { evidence = JSON.parse(evidence); } catch { evidence = []; }
  }
  return {
    id: value.id,
    source: String(value.source ?? ''),
    target: String(value.target ?? ''),
    type: value.kind as CodeRelationship['type'],
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    evidence: Array.isArray(evidence) ? evidence as CodeRelationship['evidence'] : [],
  };
}

export class Neo4jGraphStore implements GraphStore {
  private initialized = false;

  constructor(
    private readonly endpoint: string,
    private readonly username: string,
    private readonly password: string,
    private readonly database = 'neo4j',
  ) {}

  private async query(statement: string, parameters: Record<string, unknown> = {}): Promise<Row[]> {
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/db/${this.database}/tx/commit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
      },
      body: JSON.stringify({ statements: [{ statement, parameters, resultDataContents: ['row'] }] }),
    });
    if (!response.ok) throw new Error(`NEO4J_HTTP_${response.status}`);
    const body = await response.json() as {
      results?: Array<{ data?: Row[] }>;
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) throw new Error(`NEO4J_QUERY_FAILED: ${body.errors[0].message}`);
    return body.results?.[0]?.data ?? [];
  }

  /**
   * Without these, every edge insert scans the whole label. On a graph of tens
   * of thousands of nodes that turns ingestion quadratic.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const statements = [
      'CREATE INDEX code_entity_identity IF NOT EXISTS FOR (n:CodeEntity) ON (n.snapshotId, n.id)',
      'CREATE INDEX code_entity_tenant IF NOT EXISTS FOR (n:CodeEntity) ON (n.organizationId, n.applicationId, n.snapshotId)',
      'CREATE INDEX code_entity_type IF NOT EXISTS FOR (n:CodeEntity) ON (n.snapshotId, n.type)',
      'CREATE INDEX code_entity_name IF NOT EXISTS FOR (n:CodeEntity) ON (n.name)',
      'CREATE INDEX code_relation_kind IF NOT EXISTS FOR ()-[r:CODE_RELATION]-() ON (r.snapshotId, r.kind)',
    ];
    for (const statement of statements) await this.query(statement);
    this.initialized = true;
  }

  async replace(scope: GraphScope, nodes: CodeEntity[], edges: CodeRelationship[]): Promise<void> {
    await this.initialize();
    await this.delete(scope);

    for (let offset = 0; offset < nodes.length; offset += 1_000) {
      await this.query(
        'UNWIND $nodes AS item CREATE (n:CodeEntity) SET n = item',
        { nodes: nodes.slice(offset, offset + 1_000).map((node) => encodeNode(node, scope)) },
      );
    }
    for (let offset = 0; offset < edges.length; offset += 1_000) {
      await this.query(
        `UNWIND $edges AS item
         MATCH (a:CodeEntity {id: item.source, snapshotId: $snapshotId})
         MATCH (b:CodeEntity {id: item.target, snapshotId: $snapshotId})
         CREATE (a)-[:CODE_RELATION {
           id: item.id, kind: item.kind, source: item.source, target: item.target,
           confidence: item.confidence, evidence: item.evidence,
           snapshotId: $snapshotId, graphVersion: $graphVersion,
           organizationId: $organizationId, applicationId: $applicationId
         }]->(b)`,
        {
          edges: edges.slice(offset, offset + 1_000).map((edge) => ({
            id: edge.id,
            kind: edge.type,
            source: edge.source,
            target: edge.target,
            confidence: edge.confidence,
            evidence: JSON.stringify(edge.evidence ?? []),
          })),
          snapshotId: scope.snapshotId,
          graphVersion: scope.graphVersion,
          organizationId: scope.organizationId,
          applicationId: scope.applicationId,
        },
      );
    }
  }

  /**
   * Seed the projection from a type/search match (or an explicit root), then
   * expand `depth` hops. Every clause is scoped to the tenant, so a caller
   * cannot reach another organisation's graph by guessing an id.
   */
  async project(scope: GraphScope, query: GraphProjectionQuery): Promise<GraphProjection> {
    await this.initialize();
    const limit = Math.min(Math.max(query.limit ?? 250, 1), 2_000);
    const depth = Math.min(Math.max(query.depth ?? 1, 1), 6);
    const direction = query.direction ?? 'both';
    const pattern = direction === 'out' ? '-[r:CODE_RELATION*1..%d]->'
      : direction === 'in' ? '<-[r:CODE_RELATION*1..%d]-'
        : '-[r:CODE_RELATION*1..%d]-';
    const hops = pattern.replace('%d', String(depth));

    const tenant = {
      organizationId: scope.organizationId,
      applicationId: scope.applicationId,
      snapshotId: scope.snapshotId,
    };

    // Step one: the seed set. Kept separate from expansion so the limit applies
    // to what the caller asked for rather than to whatever the traversal found.
    const seedRows = await this.query(
      `MATCH (seed:CodeEntity {organizationId: $organizationId, applicationId: $applicationId, snapshotId: $snapshotId})
       WHERE ($rootId IS NULL OR seed.id = $rootId)
         AND ($search = '' OR toLower(seed.name) CONTAINS toLower($search)
              OR toLower(coalesce(seed.path, '')) CONTAINS toLower($search))
         AND (size($types) = 0 OR seed.type IN $types)
       RETURN properties(seed) ORDER BY seed.id LIMIT $seedLimit`,
      {
        ...tenant,
        rootId: query.rootId ?? null,
        search: query.search ?? '',
        types: query.types ?? [],
        seedLimit: limit,
      },
    );

    const nodeMap = new Map<string, CodeEntity>();
    const seedIds: string[] = [];
    for (const seed of seedRows) {
      const node = decodeNode(seed.row[0]);
      if (!node?.id) continue;
      nodeMap.set(node.id, node);
      seedIds.push(node.id);
    }

    const edgeMap = new Map<string, CodeRelationship>();
    if (seedIds.length) {
      // Step two: expand outward from the seeds, bounded by depth and by the
      // relationship filter, then return the nodes and edges along those paths.
      const expansionRows = await this.query(
        `MATCH (seed:CodeEntity {snapshotId: $snapshotId})
         WHERE seed.id IN $seedIds
         MATCH path = (seed)${hops}(:CodeEntity {snapshotId: $snapshotId})
         WHERE all(edge IN relationships(path)
                   WHERE (size($relationshipTypes) = 0 OR edge.kind IN $relationshipTypes)
                     AND edge.snapshotId = $snapshotId)
         WITH path LIMIT $pathLimit
         UNWIND nodes(path) AS node
         WITH collect(DISTINCT properties(node)) AS nodeProperties, collect(path) AS paths
         UNWIND paths AS p
         UNWIND relationships(p) AS edge
         RETURN nodeProperties, collect(DISTINCT properties(edge))`,
        {
          snapshotId: scope.snapshotId,
          seedIds,
          relationshipTypes: query.relationshipTypes ?? [],
          pathLimit: limit * 10,
        },
      );
      const row = expansionRows[0]?.row ?? [[], []];
      for (const raw of (row[0] as unknown[]) ?? []) {
        const node = decodeNode(raw);
        if (node?.id) nodeMap.set(node.id, node);
      }
      for (const raw of (row[1] as unknown[]) ?? []) {
        const edge = decodeEdge(raw);
        if (edge) edgeMap.set(edge.id, edge);
      }
    }

    const nodes = [...nodeMap.values()].slice(0, limit);
    const kept = new Set(nodes.map((node) => node.id));
    const edges = [...edgeMap.values()].filter((edge) => kept.has(edge.source) && kept.has(edge.target));
    return {
      nodes,
      edges,
      truncated: nodeMap.size > nodes.length,
      totalMatched: nodeMap.size,
    };
  }

  async neighbors(scope: GraphScope, id: string, direction: 'out' | 'in' | 'both' = 'both'): Promise<GraphProjection> {
    return this.project(scope, { rootId: id, depth: 1, direction, limit: 500 });
  }

  async shortestPath(scope: GraphScope, source: string, target: string, maxDepth = 12): Promise<GraphPath> {
    await this.initialize();
    const rows = await this.query(
      `MATCH (a:CodeEntity {id: $source, organizationId: $organizationId, applicationId: $applicationId, snapshotId: $snapshotId}),
             (b:CodeEntity {id: $target, snapshotId: $snapshotId})
       MATCH path = shortestPath((a)-[:CODE_RELATION*1..${Math.min(Math.max(maxDepth, 1), 20)}]->(b))
       RETURN [n IN nodes(path) | properties(n)], [e IN relationships(path) | properties(e)]`,
      {
        source, target,
        organizationId: scope.organizationId,
        applicationId: scope.applicationId,
        snapshotId: scope.snapshotId,
      },
    );
    const row = rows[0]?.row;
    if (!row) return { nodes: [], edges: [], found: false };
    return {
      nodes: ((row[0] as unknown[]) ?? []).map(decodeNode).filter(Boolean) as CodeEntity[],
      edges: ((row[1] as unknown[]) ?? []).map(decodeEdge).filter(Boolean) as CodeRelationship[],
      found: true,
    };
  }

  async blastRadius(scope: GraphScope, id: string, maxDepth = 6): Promise<GraphProjection> {
    return this.project(scope, {
      rootId: id,
      depth: maxDepth,
      direction: 'in',
      limit: 1_000,
      relationshipTypes: ['IMPORTS', 'CALLS', 'DEPENDS_ON', 'EXTENDS', 'IMPLEMENTS', 'USES', 'ROUTES_TO', 'TESTS'],
    });
  }

  async delete(scope: GraphScope): Promise<void> {
    // Batched so a large graph does not build one enormous transaction.
    for (;;) {
      const rows = await this.query(
        `MATCH (n:CodeEntity {organizationId: $organizationId, applicationId: $applicationId, snapshotId: $snapshotId})
         WITH n LIMIT 5000 DETACH DELETE n RETURN count(n)`,
        scope,
      );
      const deleted = Number(rows[0]?.row?.[0] ?? 0);
      if (!deleted) break;
    }
  }

  async deleteOtherVersions(scope: GraphScope): Promise<number> {
    const rows = await this.query(
      `MATCH (n:CodeEntity {organizationId: $organizationId, applicationId: $applicationId, snapshotId: $snapshotId})
       WHERE n.graphVersion <> $graphVersion
       WITH n LIMIT 20000 DETACH DELETE n RETURN count(n)`,
      scope,
    );
    return Number(rows[0]?.row?.[0] ?? 0);
  }

  async health(): Promise<boolean> {
    try {
      await this.query('RETURN 1');
      return true;
    } catch {
      return false;
    }
  }
}

export function createGraphStore(env: NodeJS.ProcessEnv = process.env): GraphStore | null {
  if (!env.NEO4J_URL || !env.NEO4J_USERNAME || !env.NEO4J_PASSWORD) return null;
  return new Neo4jGraphStore(
    env.NEO4J_URL,
    env.NEO4J_USERNAME,
    env.NEO4J_PASSWORD,
    env.NEO4J_DATABASE || 'neo4j',
  );
}
