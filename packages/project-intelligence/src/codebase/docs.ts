import fs from 'node:fs';
import path from 'node:path';
import { CONFIDENCE, evidenceOf, GraphBuilder, stableId } from './core';
import { canonicalRoute, endpointId } from './frameworks';
import type { Inventory } from './inventory';

const DOC_ANALYZER = 'documentation';

function readIfPresent(root: string, relative: string): string | null {
  try {
    return fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Prisma models are a schema contract, not a guess: the datasource declares
 * exactly which models exist, so models found here outrank models inferred from
 * a client call site.
 */
function readPrismaSchemas(root: string, inventory: Inventory, graph: GraphBuilder): number {
  let count = 0;
  for (const file of inventory.files) {
    if (file.extension !== '.prisma') continue;
    const content = readIfPresent(root, file.path);
    if (!content) continue;
    for (const match of content.matchAll(/^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)) {
      const line = content.slice(0, match.index ?? 0).split('\n').length;
      const evidence = evidenceOf({
        kind: 'prisma-schema-model',
        path: file.path,
        startLine: line,
        symbol: match[1],
        analyzer: DOC_ANALYZER,
        confidence: CONFIDENCE.frameworkConfig,
      });
      graph.addEntity({
        id: stableId('database_model', match[1].toLowerCase()),
        type: 'database_model',
        name: match[1],
        path: file.path,
        startLine: line,
        endLine: null,
        language: 'Prisma',
        confidence: CONFIDENCE.frameworkConfig,
        metadata: { orm: 'Prisma', declared: true },
        evidence: [evidence],
      });
      count += 1;
    }
  }
  return count;
}

/** GraphQL SDL operations declared in `.graphql` documents. */
function readGraphQlSchemas(root: string, inventory: Inventory, graph: GraphBuilder): number {
  let count = 0;
  for (const file of inventory.files) {
    if (file.extension !== '.graphql' && file.extension !== '.gql') continue;
    const content = readIfPresent(root, file.path);
    if (!content) continue;
    for (const block of content.matchAll(/\b(?:type|extend\s+type)\s+(Query|Mutation|Subscription)\s*\{([\s\S]*?)\n\}/g)) {
      const operation = block[1].toLowerCase();
      for (const field of block[2].matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*[(:]/gm)) {
        const line = content.slice(0, (block.index ?? 0) + (field.index ?? 0)).split('\n').length;
        const evidence = evidenceOf({
          kind: 'graphql-schema-field',
          path: file.path,
          startLine: line,
          symbol: field[1],
          analyzer: DOC_ANALYZER,
          confidence: CONFIDENCE.frameworkConfig,
        });
        graph.addEntity({
          id: endpointId('GRAPHQL', `/${operation}/${field[1]}`),
          type: 'endpoint',
          name: `GraphQL ${operation} ${field[1]}`,
          path: file.path,
          startLine: line,
          endLine: null,
          language: 'GraphQL',
          confidence: CONFIDENCE.frameworkConfig,
          metadata: { protocol: 'graphql', operation, field: field[1], declared: true },
          evidence: [evidence],
        });
        count += 1;
      }
    }
  }
  return count;
}

type OpenApiDocument = { paths?: Record<string, Record<string, unknown>> };

/** OpenAPI documents describe endpoints the code is supposed to serve. */
function readOpenApi(root: string, inventory: Inventory, graph: GraphBuilder): string[] {
  const documented: string[] = [];
  for (const file of inventory.files) {
    const base = path.basename(file.path).toLowerCase();
    const looksLikeSpec = /openapi|swagger/.test(base) && /\.(json|ya?ml)$/.test(base);
    if (!looksLikeSpec) continue;
    const content = readIfPresent(root, file.path);
    if (!content) continue;

    let paths: Record<string, Record<string, unknown>> | undefined;
    if (base.endsWith('.json')) {
      try { paths = (JSON.parse(content) as OpenApiDocument).paths; } catch { paths = undefined; }
    } else {
      // A dependency-free read of the one section we need out of YAML.
      paths = {};
      const lines = content.split('\n');
      const pathsIndex = lines.findIndex((line) => /^paths:\s*$/.test(line));
      if (pathsIndex >= 0) {
        let current: string | null = null;
        for (const line of lines.slice(pathsIndex + 1)) {
          if (/^\S/.test(line)) break;
          const route = line.match(/^\s{2}(\/[^:\s]*):\s*$/);
          if (route) { current = route[1]; paths[current] = {}; continue; }
          const method = line.match(/^\s{4}(get|post|put|patch|delete|options|head):\s*$/i);
          if (method && current) paths[current][method[1].toLowerCase()] = {};
        }
      }
    }
    if (!paths) continue;

    for (const [route, operations] of Object.entries(paths)) {
      for (const method of Object.keys(operations ?? {})) {
        if (!/^(get|post|put|patch|delete|options|head)$/i.test(method)) continue;
        const canonical = canonicalRoute(route);
        documented.push(`${method.toUpperCase()} ${canonical}`);
        const id = endpointId(method, canonical);
        const evidence = evidenceOf({
          kind: 'openapi-operation',
          path: file.path,
          symbol: `${method.toUpperCase()} ${route}`,
          analyzer: DOC_ANALYZER,
          confidence: CONFIDENCE.documentation,
        });
        // Documented endpoints are recorded, but the confidence stays at
        // documentation level unless code also produced the same node.
        graph.addEntity({
          id,
          type: 'endpoint',
          name: `${method.toUpperCase()} ${canonical}`,
          path: file.path,
          startLine: null,
          endLine: null,
          language: null,
          confidence: CONFIDENCE.documentation,
          metadata: { method: method.toUpperCase(), route: canonical, documented: true },
          evidence: [evidence],
        });
      }
    }
  }
  return documented;
}

export type DocumentationResult = {
  prismaModels: number;
  graphqlFields: number;
  documentedEndpoints: number;
  documents: number;
};

/**
 * Documentation is treated as an independent evidence source. It can corroborate
 * the code or contradict it, but it never overrides it: a documented endpoint
 * with no implementation becomes a finding, not an endpoint the product claims
 * to have.
 */
export function analyzeDocumentation(
  root: string,
  inventory: Inventory,
  graph: GraphBuilder,
): DocumentationResult {
  const prismaModels = readPrismaSchemas(root, inventory, graph);
  const graphqlFields = readGraphQlSchemas(root, inventory, graph);
  const documented = readOpenApi(root, inventory, graph);

  const documents = inventory.files.filter((file) =>
    file.documentation && /(^|\/)(readme|docs?|adr|architecture|contributing)/i.test(file.path));

  // Endpoints named in prose that nothing in the code serves.
  const implemented = new Set(
    graph.ofType('endpoint')
      .filter((entity) => entity.metadata.documented !== true || entity.confidence > CONFIDENCE.documentation)
      .map((entity) => entity.name),
  );
  const missing = documented.filter((name) => !implemented.has(name));
  if (missing.length) {
    graph.finding({
      id: stableId('finding', `stale-openapi:${missing.slice(0, 20).join(',')}`),
      kind: 'STALE_DOCUMENTATION',
      severity: 'WARNING',
      title: 'Documented endpoints with no implementation found',
      description: `${missing.length} endpoint(s) described in an API document were not found in code: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}.`,
      entityIds: missing.slice(0, 20).map((name) => {
        const [method, route] = name.split(' ');
        return endpointId(method, route);
      }),
      evidence: [],
    });
  }

  for (const document of documents.slice(0, 200)) {
    const content = readIfPresent(root, document.path);
    if (!content) continue;
    const id = stableId('file', document.path);
    if (!graph.has(id)) {
      graph.addEntity({
        id,
        type: 'file',
        name: path.basename(document.path),
        path: document.path,
        startLine: 1,
        endLine: null,
        language: 'Markdown',
        confidence: CONFIDENCE.manifest,
        metadata: { documentation: true, title: content.match(/^#\s+(.+)$/m)?.[1]?.slice(0, 120) ?? null },
        evidence: [],
      });
    }
  }

  return {
    prismaModels,
    graphqlFields,
    documentedEndpoints: documented.length,
    documents: documents.length,
  };
}
