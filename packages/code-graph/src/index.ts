import type { CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';

export type GraphScope = { organizationId: string; applicationId: string; snapshotId: string; graphVersion: string };
export type GraphProjectionQuery = { types?: string[]; relationshipTypes?: string[]; search?: string; depth?: number; limit?: number };
export type GraphProjection = { nodes: CodeEntity[]; edges: CodeRelationship[]; truncated: boolean };

export interface GraphStore {
  replace(scope: GraphScope, nodes: CodeEntity[], edges: CodeRelationship[]): Promise<void>;
  project(scope: GraphScope, query: GraphProjectionQuery): Promise<GraphProjection>;
  delete(scope: GraphScope): Promise<void>;
  health(): Promise<boolean>;
}

type Neo4jResponse = { data?: { fields: unknown[]; values: unknown[] }[]; errors?: Array<{ message: string }> };

export class Neo4jGraphStore implements GraphStore {
  constructor(private readonly endpoint: string, private readonly username: string, private readonly password: string) {}

  private async query(statement: string, parameters: Record<string, unknown> = {}): Promise<Neo4jResponse> {
    const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/db/neo4j/tx/commit`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}` },
      body: JSON.stringify({ statements: [{ statement, parameters, resultDataContents: ['row'] }] }),
    });
    if (!response.ok) throw new Error(`NEO4J_HTTP_${response.status}`);
    const body = await response.json() as { results?: Array<{ data?: Array<{ row: unknown[] }> }>; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`NEO4J_QUERY_FAILED: ${body.errors[0].message}`);
    return { data: body.results?.[0]?.data?.map((item) => ({ fields: [], values: item.row })) ?? [] };
  }

  async replace(scope: GraphScope, nodes: CodeEntity[], edges: CodeRelationship[]): Promise<void> {
    await this.delete(scope);
    const common = { organizationId: scope.organizationId, applicationId: scope.applicationId, snapshotId: scope.snapshotId, graphVersion: scope.graphVersion };
    for (let offset = 0; offset < nodes.length; offset += 500) {
      await this.query('UNWIND $nodes AS item CREATE (n:CodeEntity) SET n = item', { nodes: nodes.slice(offset, offset + 500).map((node) => ({ ...node, evidence: JSON.stringify(node.evidence), metadata: JSON.stringify(node.metadata), ...common })) });
    }
    for (let offset = 0; offset < edges.length; offset += 500) {
      await this.query('UNWIND $edges AS item MATCH (a:CodeEntity {id:item.source, snapshotId:$snapshotId}), (b:CodeEntity {id:item.target, snapshotId:$snapshotId}) CREATE (a)-[r:CODE_RELATION {id:item.id, kind:item.type, confidence:item.confidence, evidence:item.evidence, snapshotId:$snapshotId, graphVersion:$graphVersion}]->(b)', { edges: edges.slice(offset, offset + 500).map((edge) => ({ ...edge, evidence: JSON.stringify(edge.evidence) })), snapshotId: scope.snapshotId, graphVersion: scope.graphVersion });
    }
  }

  async project(scope: GraphScope, query: GraphProjectionQuery): Promise<GraphProjection> {
    const limit = Math.min(Math.max(query.limit ?? 250, 1), 1_000);
    const response = await this.query('MATCH (n:CodeEntity {organizationId:$organizationId, applicationId:$applicationId, snapshotId:$snapshotId}) WHERE ($search = "" OR toLower(n.name) CONTAINS toLower($search)) AND (size($types) = 0 OR n.type IN $types) WITH n LIMIT $limit OPTIONAL MATCH (n)-[r:CODE_RELATION]->(m:CodeEntity {snapshotId:$snapshotId}) WHERE size($relationshipTypes) = 0 OR r.kind IN $relationshipTypes RETURN collect(DISTINCT properties(n)), collect(DISTINCT properties(m)), collect(DISTINCT properties(r))', { ...scope, search: query.search ?? '', types: query.types ?? [], relationshipTypes: query.relationshipTypes ?? [], limit: limit + 1 });
    const row = response.data?.[0]?.values ?? [[], [], []];
    const rawNodes = [...((row[0] as CodeEntity[]) ?? []), ...((row[1] as CodeEntity[]) ?? [])];
    const unique = [...new Map(rawNodes.filter(Boolean).map((node) => [node.id, node])).values()];
    return { nodes: unique.slice(0, limit), edges: ((row[2] as CodeRelationship[]) ?? []).filter(Boolean), truncated: unique.length > limit };
  }

  async delete(scope: GraphScope): Promise<void> {
    await this.query('MATCH (n:CodeEntity {organizationId:$organizationId, applicationId:$applicationId, snapshotId:$snapshotId}) DETACH DELETE n', scope);
  }

  async health(): Promise<boolean> {
    try { await this.query('RETURN 1'); return true; } catch { return false; }
  }
}

export function createGraphStore(env: NodeJS.ProcessEnv = process.env): GraphStore | null {
  if (!env.NEO4J_URL || !env.NEO4J_USERNAME || !env.NEO4J_PASSWORD) return null;
  return new Neo4jGraphStore(env.NEO4J_URL, env.NEO4J_USERNAME, env.NEO4J_PASSWORD);
}
