import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';
import { createGraphStore, Neo4jGraphStore } from './index';

type Captured = { statement: string; parameters: Record<string, unknown> };

/**
 * Drive the store against a stubbed HTTP transaction endpoint. This exercises
 * the Cypher the store actually emits and the encoding both ways, without
 * needing a Neo4j instance in the unit suite.
 */
function stubStore(reply: (captured: Captured) => unknown[][]): {
  store: Neo4jGraphStore;
  calls: Captured[];
  restore: () => void;
} {
  const calls: Captured[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { statements: Array<{ statement: string; parameters: Record<string, unknown> }> };
    const captured = { statement: body.statements[0].statement, parameters: body.statements[0].parameters };
    calls.push(captured);
    const rows = reply(captured);
    return {
      ok: true,
      json: async () => ({ results: [{ data: rows.map((row) => ({ row })) }] }),
    };
  }) as unknown as typeof fetch;

  return {
    store: new Neo4jGraphStore('http://neo4j.test', 'neo4j', 'secret'),
    calls,
    restore: () => { globalThis.fetch = originalFetch; },
  };
}

const SCOPE = {
  organizationId: 'org-1',
  applicationId: 'app-1',
  snapshotId: 'snap-1',
  graphVersion: 'v1',
};

const entity = (overrides: Partial<CodeEntity> = {}): CodeEntity => ({
  id: 'function:abc',
  type: 'function',
  name: 'chargeCard',
  path: 'src/payments.ts',
  startLine: 4,
  endLine: 9,
  language: 'TypeScript',
  confidence: 1,
  metadata: { exported: true, packageRoot: 'services/api' },
  evidence: [{
    kind: 'declaration', path: 'src/payments.ts', startLine: 4, endLine: 9,
    symbol: 'chargeCard', excerpt: null, analyzer: 'typescript-ast', confidence: 0.95,
  }],
  ...overrides,
});

const relationship = (): CodeRelationship => ({
  id: 'edge:1',
  source: 'function:abc',
  target: 'database_model:order',
  type: 'WRITES',
  confidence: 0.98,
  evidence: [],
});

test('creates indexes before writing so edge matching is not a full label scan', async () => {
  const { store, calls, restore } = stubStore(() => []);
  try {
    await store.replace(SCOPE, [entity()], [relationship()]);
  } finally {
    restore();
  }
  const indexStatements = calls.filter((call) => call.statement.startsWith('CREATE INDEX'));
  assert.ok(indexStatements.length >= 4, 'identity, tenant, type and relationship indexes are required');
  assert.ok(
    indexStatements.some((call) => call.statement.includes('(n.snapshotId, n.id)')),
    'the edge-matching path needs an index on (snapshotId, id)',
  );
  const firstWrite = calls.findIndex((call) => call.statement.includes('CREATE (n:CodeEntity)'));
  const lastIndex = calls.map((call) => call.statement.startsWith('CREATE INDEX')).lastIndexOf(true);
  assert.ok(lastIndex < firstWrite, 'indexes must exist before the first write');
});

test('scopes every stored node and edge to the organisation, application and snapshot', async () => {
  const { store, calls, restore } = stubStore(() => []);
  try {
    await store.replace(SCOPE, [entity()], [relationship()]);
  } finally {
    restore();
  }
  const nodeWrite = calls.find((call) => call.statement.includes('CREATE (n:CodeEntity)'));
  const written = (nodeWrite?.parameters.nodes as Array<Record<string, unknown>>)[0];
  assert.equal(written.organizationId, 'org-1');
  assert.equal(written.applicationId, 'app-1');
  assert.equal(written.snapshotId, 'snap-1');
  assert.equal(written.graphVersion, 'v1');
  // Neo4j has no nested-map property, so these are stored as JSON text.
  assert.equal(typeof written.metadata, 'string');
  assert.equal(typeof written.evidence, 'string');
});

test('decodes metadata and evidence back into the shape the contract promises', async () => {
  const stored = {
    ...entity(),
    metadata: JSON.stringify({ exported: true, packageRoot: 'services/api' }),
    evidence: JSON.stringify(entity().evidence),
    organizationId: 'org-1', applicationId: 'app-1', snapshotId: 'snap-1', graphVersion: 'v1',
  };
  const { store, restore } = stubStore((captured) =>
    captured.statement.includes('RETURN properties(seed)') ? [[stored]] : [[[], []]]);
  let projection;
  try {
    projection = await store.project(SCOPE, { limit: 10, depth: 1 });
  } finally {
    restore();
  }

  const node = projection.nodes[0];
  assert.ok(node, 'the seed node should be returned');
  assert.equal(typeof node.metadata, 'object', 'metadata must not reach a client as a JSON string');
  assert.equal((node.metadata as Record<string, unknown>).exported, true);
  assert.ok(Array.isArray(node.evidence), 'evidence must not reach a client as a JSON string');
  assert.equal(node.evidence[0].analyzer, 'typescript-ast');
  // Tenant columns are storage bookkeeping and are not part of the entity.
  assert.equal('organizationId' in (node as Record<string, unknown>), false);
});

test('survives a node whose stored JSON is unreadable rather than throwing', async () => {
  const corrupted = { ...entity(), metadata: '{not json', evidence: 'also not json' };
  const { store, restore } = stubStore((captured) =>
    captured.statement.includes('RETURN properties(seed)') ? [[corrupted]] : [[[], []]]);
  let projection;
  try {
    projection = await store.project(SCOPE, { limit: 10 });
  } finally {
    restore();
  }
  assert.deepEqual(projection.nodes[0].metadata, {});
  assert.deepEqual(projection.nodes[0].evidence, []);
});

test('bounds the projection and reports when it was capped', async () => {
  const many = Array.from({ length: 5 }, (_, index) => ({
    ...entity({ id: `function:${index}` }),
    metadata: '{}', evidence: '[]',
  }));
  const { store, calls, restore } = stubStore((captured) =>
    captured.statement.includes('RETURN properties(seed)') ? many.map((item) => [item]) : [[[], []]]);
  let projection;
  try {
    projection = await store.project(SCOPE, { limit: 2, depth: 3 });
  } finally {
    restore();
  }
  assert.equal(projection.nodes.length, 2);
  assert.equal(projection.truncated, true);
  assert.equal(projection.totalMatched, 5);
  const seedQuery = calls.find((call) => call.statement.includes('RETURN properties(seed)'));
  assert.equal(seedQuery?.parameters.seedLimit, 2);
});

test('expands the requested number of hops rather than ignoring depth', async () => {
  const { store, calls, restore } = stubStore((captured) =>
    captured.statement.includes('RETURN properties(seed)')
      ? [[{ ...entity(), metadata: '{}', evidence: '[]' }]]
      : [[[], []]]);
  try {
    await store.project(SCOPE, { limit: 10, depth: 3, direction: 'out' });
  } finally {
    restore();
  }
  const expansion = calls.find((call) => call.statement.includes('MATCH path ='));
  assert.ok(expansion, 'a traversal query should be issued');
  assert.ok(expansion!.statement.includes('-[r:CODE_RELATION*1..3]->'), 'depth and direction must reach the Cypher');
});

test('blast radius follows incoming dependency edges only', async () => {
  const { store, calls, restore } = stubStore((captured) =>
    captured.statement.includes('RETURN properties(seed)')
      ? [[{ ...entity(), metadata: '{}', evidence: '[]' }]]
      : [[[], []]]);
  try {
    await store.blastRadius(SCOPE, 'function:abc', 4);
  } finally {
    restore();
  }
  const expansion = calls.find((call) => call.statement.includes('MATCH path ='));
  assert.ok(expansion!.statement.includes('<-[r:CODE_RELATION*1..4]-'), 'must traverse inbound');
  assert.ok((expansion!.parameters.relationshipTypes as string[]).includes('CALLS'));
});

test('reports health honestly when the endpoint fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
  try {
    assert.equal(await new Neo4jGraphStore('http://neo4j.test', 'neo4j', 'secret').health(), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('is disabled unless every connection setting is present', () => {
  assert.equal(createGraphStore({} as NodeJS.ProcessEnv), null);
  assert.equal(createGraphStore({ NEO4J_URL: 'http://x' } as NodeJS.ProcessEnv), null);
  assert.ok(createGraphStore({
    NEO4J_URL: 'http://x', NEO4J_USERNAME: 'neo4j', NEO4J_PASSWORD: 'p',
  } as NodeJS.ProcessEnv));
});
