import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
import type {
  CodebaseAnalysis,
  CodebaseFinding,
  CodeEntity,
  CodeEvidence,
  CodeRelationship,
  SoftwareFeature,
} from '@tellann/desktop-contracts';

const ANALYZER_VERSION = '1.0.0';
const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache', 'vendor']);
const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const UNSUPPORTED_SOURCE = new Set(['.py', '.java', '.go', '.rs', '.cs', '.php', '.rb']);
const ARCHIVE_TEXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.json', '.md', '.txt', '.yaml', '.yml', '.toml', '.graphql', '.gql', '.prisma', '.sql', '.css', '.scss', '.html']);
const SECRET = /(^|\/)(\.env($|\.)|id_rsa|id_ed25519|.*\.(pem|key|p12)$)/i;
const SECRET_CONTENT = /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*['"`]([A-Za-z0-9_+\/.=-]{12,})['"`]/i;

export type AnalysisProgress = (status: CodebaseAnalysis['status'], progress: number, message: string) => void;

type MutableGraph = {
  entities: CodeEntity[];
  relationships: CodeRelationship[];
  entityIds: Set<string>;
  edgeIds: Set<string>;
  findings: CodebaseFinding[];
  warnings: string[];
};

const digest = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const stableId = (type: string, value: string) => `${type}:${digest(value).slice(0, 24)}`;
const slash = (value: string) => value.replaceAll('\\', '/');

function evidence(file: string, source: ts.SourceFile, node: ts.Node, kind: string, confidence: number): CodeEvidence {
  const start = source.getLineAndCharacterOfPosition(node.getStart(source));
  const end = source.getLineAndCharacterOfPosition(node.getEnd());
  return {
    kind,
    path: file,
    startLine: start.line + 1,
    endLine: end.line + 1,
    symbol: null,
    excerpt: node.getText(source).slice(0, 500),
    analyzer: 'typescript-compiler',
    confidence,
  };
}

function addEntity(graph: MutableGraph, entity: CodeEntity): string {
  if (!graph.entityIds.has(entity.id)) {
    graph.entityIds.add(entity.id);
    graph.entities.push(entity);
  }
  return entity.id;
}

function addEdge(graph: MutableGraph, edge: Omit<CodeRelationship, 'id'>): void {
  const id = stableId('edge', `${edge.source}\0${edge.type}\0${edge.target}`);
  if (graph.edgeIds.has(id)) return;
  graph.edgeIds.add(id);
  graph.relationships.push({ id, ...edge });
}

function inventory(root: string): { files: string[]; archiveFiles: string[]; excluded: number; unsupported: Set<string> } {
  const files: string[] = [];
  const archiveFiles: string[] = [];
  const unsupported = new Set<string>();
  let excluded = 0;
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (IGNORED.has(entry.name) || entry.isSymbolicLink()) { excluded += 1; continue; }
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(absolute); continue; }
      const relative = slash(path.relative(root, absolute));
      if (SECRET.test(relative) || fs.statSync(absolute).size > 1_000_000) { excluded += 1; continue; }
      const extension = path.extname(relative).toLowerCase();
      if (SOURCE.has(extension)) files.push(relative);
      else if (UNSUPPORTED_SOURCE.has(extension)) unsupported.add(extension);
      if (ARCHIVE_TEXT.has(extension) || ['Dockerfile', 'Makefile'].includes(entry.name)) archiveFiles.push(relative);
    }
  };
  visit(root);
  return { files: files.sort(), archiveFiles: archiveFiles.sort(), excluded, unsupported };
}

function packageRoots(root: string): Map<string, string> {
  const result = new Map<string, string>();
  const visit = (directory: string, depth: number) => {
    if (depth > 4) return;
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { name?: unknown };
        result.set(slash(path.relative(root, directory)) || '.', typeof parsed.name === 'string' ? parsed.name : path.basename(directory));
      } catch { /* represented later as a warning by the scanner */ }
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !IGNORED.has(entry.name)) visit(path.join(directory, entry.name), depth + 1);
    }
  };
  visit(root, 0);
  return result;
}

function nearestPackage(file: string, packages: Map<string, string>): string {
  return [...packages.keys()]
    .filter((candidate) => candidate === '.' || file === candidate || file.startsWith(`${candidate}/`))
    .sort((a, b) => b.length - a.length)[0] ?? '.';
}

function externalName(expression: string): string | null {
  const known: Array<[RegExp, string]> = [
    [/\bstripe\b/i, 'Stripe'], [/paystack/i, 'Paystack'], [/flutterwave/i, 'Flutterwave'],
    [/sendgrid/i, 'SendGrid'], [/twilio/i, 'Twilio'], [/openai/i, 'OpenAI'],
    [/\baws\b|S3Client|@aws-sdk/i, 'AWS'], [/firebase/i, 'Firebase'],
    [/cloudinary/i, 'Cloudinary'], [/slack/i, 'Slack'], [/axios|fetch\s*\(/i, 'HTTP API'],
  ];
  return known.find(([pattern]) => pattern.test(expression))?.[1] ?? null;
}

function domainFor(file: string): string {
  const parts = file.split('/').map((part) => part.replace(/\.[^.]+$/, ''));
  const ignored = new Set(['src', 'app', 'apps', 'services', 'packages', 'lib', 'components', 'pages', 'routes', 'api', 'index']);
  return parts.find((part) => !ignored.has(part.toLowerCase()) && !/^[[(]/.test(part)) || 'Core';
}

function analyzeFile(root: string, file: string, graph: MutableGraph, packages: Map<string, string>): void {
  const absolute = path.join(root, file);
  const content = fs.readFileSync(absolute, 'utf8');
  const kind = file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
  const fileId = stableId('file', file);
  const pkgRoot = nearestPackage(file, packages);
  const packageId = stableId('package', pkgRoot);
  const domain = domainFor(file);
  const domainId = stableId('domain', domain.toLowerCase());
  addEntity(graph, { id: fileId, type: 'file', name: path.basename(file), path: file, startLine: 1, endLine: source.getLineAndCharacterOfPosition(source.end).line + 1, language: 'TypeScript/JavaScript', confidence: 1, metadata: { hash: digest(content), packageRoot: pkgRoot }, evidence: [] });
  addEntity(graph, { id: domainId, type: 'domain', name: domain, path: null, startLine: null, endLine: null, language: null, confidence: 0.65, metadata: { inferredFrom: 'directory' }, evidence: [] });
  addEdge(graph, { source: fileId, target: domainId, type: 'BELONGS_TO_DOMAIN', confidence: 0.65, evidence: [] });
  addEdge(graph, { source: packageId, target: fileId, type: 'CONTAINS', confidence: 1, evidence: [] });

  const scope: string[] = [fileId];
  const visit = (node: ts.Node) => {
    let entered: string | null = null;
    let entityType: CodeEntity['type'] | null = null;
    let name: string | null = null;
    if (ts.isClassDeclaration(node)) { entityType = 'class'; name = node.name?.text ?? '<anonymous class>'; }
    else if (ts.isInterfaceDeclaration(node)) { entityType = 'interface'; name = node.name.text; }
    else if (ts.isFunctionDeclaration(node)) { entityType = 'function'; name = node.name?.text ?? '<anonymous function>'; }
    else if (ts.isMethodDeclaration(node)) { entityType = 'method'; name = node.name.getText(source); }
    else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) { entityType = 'function'; name = node.name.getText(source); }

    if (entityType && name) {
      entered = stableId(entityType, `${file}:${node.pos}:${name}`);
      addEntity(graph, { id: entered, type: entityType, name, path: file, startLine: evidence(file, source, node, 'ast-definition', 0.95).startLine, endLine: evidence(file, source, node, 'ast-definition', 0.95).endLine, language: 'TypeScript/JavaScript', confidence: 0.95, metadata: { exported: ts.canHaveModifiers(node) ? Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) : false }, evidence: [evidence(file, source, node, 'ast-definition', 0.95)] });
      addEdge(graph, { source: scope[scope.length - 1], target: entered, type: 'DEFINES', confidence: 0.95, evidence: [evidence(file, source, node, 'ast-definition', 0.95)] });
      addEdge(graph, { source: entered, target: domainId, type: 'BELONGS_TO_DOMAIN', confidence: 0.65, evidence: [evidence(file, source, node, 'directory-domain', 0.65)] });
      scope.push(entered);
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const target = stableId(specifier.startsWith('.') ? 'module' : 'package', specifier);
      addEntity(graph, { id: target, type: specifier.startsWith('.') ? 'module' : 'package', name: specifier, path: null, startLine: null, endLine: null, language: null, confidence: specifier.startsWith('.') ? 0.8 : 0.98, metadata: { importSpecifier: specifier }, evidence: [evidence(file, source, node, 'import-declaration', 0.98)] });
      addEdge(graph, { source: fileId, target, type: 'IMPORTS', confidence: 0.98, evidence: [evidence(file, source, node, 'import-declaration', 0.98)] });
    }

    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(source);
      const caller = scope[scope.length - 1];
      const callTarget = stableId('function', call);
      addEntity(graph, { id: callTarget, type: 'function', name: call, path: null, startLine: null, endLine: null, language: 'TypeScript/JavaScript', confidence: 0.6, metadata: { unresolved: true }, evidence: [evidence(file, source, node, 'call-expression', 0.6)] });
      addEdge(graph, { source: caller, target: callTarget, type: 'CALLS', confidence: 0.6, evidence: [evidence(file, source, node, 'call-expression', 0.6)] });

      const endpointMatch = call.match(/(?:app|router|fastify)\.(get|post|put|patch|delete|options|head)$/i);
      const route = node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : null;
      if (endpointMatch && route) {
        const label = `${endpointMatch[1].toUpperCase()} ${route}`;
        const endpointId = stableId('endpoint', `${file}:${label}`);
        addEntity(graph, { id: endpointId, type: 'endpoint', name: label, path: file, startLine: evidence(file, source, node, 'framework-route', 0.98).startLine, endLine: evidence(file, source, node, 'framework-route', 0.98).endLine, language: 'TypeScript/JavaScript', confidence: 0.98, metadata: { method: endpointMatch[1].toUpperCase(), route }, evidence: [evidence(file, source, node, 'framework-route', 0.98)] });
        addEdge(graph, { source: endpointId, target: caller, type: 'ROUTES_TO', confidence: 0.9, evidence: [evidence(file, source, node, 'framework-route', 0.9)] });
      }

      const prisma = call.match(/(?:prisma|tx)\.([A-Za-z0-9_]+)\.(find\w+|aggregate|count|create\w*|update\w*|delete\w*|upsert)$/);
      if (prisma) {
        const modelId = stableId('database_model', prisma[1]);
        addEntity(graph, { id: modelId, type: 'database_model', name: prisma[1], path: null, startLine: null, endLine: null, language: null, confidence: 0.98, metadata: { orm: 'Prisma' }, evidence: [evidence(file, source, node, 'prisma-operation', 0.98)] });
        addEdge(graph, { source: caller, target: modelId, type: /^(find|aggregate|count)/.test(prisma[2]) ? 'READS' : 'WRITES', confidence: 0.98, evidence: [evidence(file, source, node, 'prisma-operation', 0.98)] });
      }

      const publish = call.match(/\.(?:publish|emit)$/);
      const eventName = publish && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : null;
      if (eventName) {
        const eventId = stableId('event', eventName);
        addEntity(graph, { id: eventId, type: 'event', name: eventName, path: null, startLine: null, endLine: null, language: null, confidence: 0.95, metadata: {}, evidence: [evidence(file, source, node, 'event-publication', 0.95)] });
        addEdge(graph, { source: caller, target: eventId, type: 'PUBLISHES', confidence: 0.95, evidence: [evidence(file, source, node, 'event-publication', 0.95)] });
      }

      const external = externalName(node.getText(source));
      if (external) {
        const externalId = stableId('external_service', external);
        addEntity(graph, { id: externalId, type: 'external_service', name: external, path: null, startLine: null, endLine: null, language: null, confidence: external === 'HTTP API' ? 0.7 : 0.85, metadata: {}, evidence: [evidence(file, source, node, 'external-call', 0.85)] });
        addEdge(graph, { source: caller, target: externalId, type: 'CALLS_EXTERNAL', confidence: external === 'HTTP API' ? 0.7 : 0.85, evidence: [evidence(file, source, node, 'external-call', 0.85)] });
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['describe', 'it', 'test'].includes(node.expression.text)) {
      const title = node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : 'Unnamed test';
      const testId = stableId('test', `${file}:${node.pos}:${title}`);
      addEntity(graph, { id: testId, type: 'test', name: title, path: file, startLine: evidence(file, source, node, 'test-declaration', 0.95).startLine, endLine: evidence(file, source, node, 'test-declaration', 0.95).endLine, language: 'TypeScript/JavaScript', confidence: 0.95, metadata: {}, evidence: [evidence(file, source, node, 'test-declaration', 0.95)] });
      addEdge(graph, { source: fileId, target: testId, type: 'DEFINES', confidence: 0.95, evidence: [evidence(file, source, node, 'test-declaration', 0.95)] });
    }

    ts.forEachChild(node, visit);
    if (entered) scope.pop();
  };
  visit(source);
}

function discoverFeatures(graph: MutableGraph): SoftwareFeature[] {
  const outgoing = new Map<string, CodeRelationship[]>();
  for (const edge of graph.relationships) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  const entities = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const entrypoints = graph.entities.filter((entity) => ['endpoint', 'ui_route', 'ui_action', 'job'].includes(entity.type));
  return entrypoints.slice(0, 1_000).map((entry) => {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: entry.id, depth: 0 }];
    const ordered: CodeEntity[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > 8 || visited.size >= 150) continue;
      visited.add(current.id);
      const entity = entities.get(current.id);
      if (entity) ordered.push(entity);
      for (const edge of outgoing.get(current.id) ?? []) queue.push({ id: edge.target, depth: current.depth + 1 });
    }
    const ofType = (type: CodeEntity['type']) => ordered.filter((entity) => entity.type === type).map((entity) => entity.name);
    const domain = ordered.find((entity) => entity.type === 'domain')?.name ?? domainFor(entry.path ?? entry.name);
    const sourceFiles = [...new Set(ordered.flatMap((entity) => entity.path ? [entity.path] : []))];
    return {
      id: stableId('feature', entry.id),
      name: entry.name,
      description: `Handles ${entry.name} through ${Math.max(ordered.length - 1, 0)} discovered code and side-effect steps.`,
      domain,
      triggers: [entry.name],
      entrypoints: [entry.id],
      workflow: ordered.map((entity) => ({ entityId: entity.id, label: entity.name })),
      reads: ofType('database_model').filter((name) => graph.relationships.some((edge) => edge.target === stableId('database_model', name) && edge.type === 'READS')),
      writes: ofType('database_model').filter((name) => graph.relationships.some((edge) => edge.target === stableId('database_model', name) && edge.type === 'WRITES')),
      externalServices: ofType('external_service'),
      emittedEvents: ofType('event'),
      downstreamEffects: [...ofType('external_service'), ...ofType('event')],
      authorization: [],
      sourceFiles,
      confidence: ordered.length > 1 ? 0.82 : 0.6,
      evidence: ordered.flatMap((entity) => entity.evidence).slice(0, 30),
    };
  });
}

function findCycles(graph: MutableGraph): CodebaseFinding[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.relationships.filter((item) => item.type === 'IMPORTS')) adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  const findings: CodebaseFinding[] = [];
  const active = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string, stack: string[]) => {
    if (active.has(id)) {
      const cycle = stack.slice(stack.indexOf(id));
      if (cycle.length > 1) findings.push({ id: stableId('finding', cycle.sort().join(':')), kind: 'CYCLE', severity: 'WARNING', title: 'Circular import dependency', description: `Import cycle involving ${cycle.length} nodes.`, entityIds: cycle, evidence: [] });
      return;
    }
    if (done.has(id)) return;
    active.add(id);
    for (const next of adjacency.get(id) ?? []) walk(next, [...stack, next]);
    active.delete(id); done.add(id);
  };
  for (const id of adjacency.keys()) walk(id, [id]);
  return findings.slice(0, 250);
}

export function analyzeCodebase(rootInput: string, workspaceId: string, repositoryFingerprint: string, onProgress?: AnalysisProgress): CodebaseAnalysis {
  const root = fs.realpathSync.native(rootInput);
  const startedAt = new Date().toISOString();
  const graph: MutableGraph = { entities: [], relationships: [], entityIds: new Set(), edgeIds: new Set(), findings: [], warnings: [] };
  onProgress?.('INGESTING', 10, 'Inventorying repository');
  const scan = inventory(root);
  const packages = packageRoots(root);
  const repositoryId = addEntity(graph, { id: stableId('repository', repositoryFingerprint), type: 'repository', name: path.basename(root), path: null, startLine: null, endLine: null, language: null, confidence: 1, metadata: { repositoryFingerprint }, evidence: [] });
  for (const [packageRoot, name] of packages) {
    const packageId = addEntity(graph, { id: stableId('package', packageRoot), type: packageRoot === '.' ? 'application' : /service|api|worker/i.test(packageRoot) ? 'service' : 'package', name, path: packageRoot, startLine: null, endLine: null, language: null, confidence: 0.98, metadata: { packageRoot }, evidence: [] });
    addEdge(graph, { source: repositoryId, target: packageId, type: 'CONTAINS', confidence: 0.98, evidence: [] });
  }
  onProgress?.('PARSING', 25, `Parsing ${scan.files.length} TypeScript/JavaScript files`);
  scan.files.forEach((file, index) => {
    analyzeFile(root, file, graph, packages);
    if (index > 0 && index % 100 === 0) onProgress?.('PARSING', Math.min(55, 25 + Math.round((index / scan.files.length) * 30)), `Parsed ${index} of ${scan.files.length} files`);
  });
  onProgress?.('LINKING', 60, 'Resolving relationships and evidence');
  if (scan.unsupported.size) {
    const extensions = [...scan.unsupported].sort();
    graph.warnings.push(`Deep analysis is not yet available for: ${extensions.join(', ')}`);
    graph.findings.push({ id: stableId('finding', extensions.join(',')), kind: 'UNSUPPORTED_LANGUAGE', severity: 'INFO', title: 'Unsupported source languages detected', description: `Hierarchy and manifest analysis only for ${extensions.join(', ')}.`, entityIds: [repositoryId], evidence: [] });
  }
  onProgress?.('GRAPHING', 70, 'Building graph projections');
  graph.findings.push(...findCycles(graph));
  onProgress?.('DISCOVERING_FEATURES', 80, 'Discovering functionality from entrypoints and side effects');
  const features = discoverFeatures(graph);
  for (const feature of features) {
    addEntity(graph, { id: feature.id, type: 'feature', name: feature.name, path: null, startLine: null, endLine: null, language: null, confidence: feature.confidence, metadata: { domain: feature.domain }, evidence: feature.evidence });
    for (const entrypoint of feature.entrypoints) addEdge(graph, { source: feature.id, target: entrypoint, type: 'IMPLEMENTS_FEATURE', confidence: feature.confidence, evidence: feature.evidence.slice(0, 5) });
  }
  onProgress?.('ANALYZING_ARCHITECTURE', 90, 'Calculating domains, coupling, and risks');
  const confidences = [...graph.entities.map((item) => item.confidence), ...graph.relationships.map((item) => item.confidence)];
  const supported = scan.files.length;
  const coveragePercent = supported + scan.unsupported.size === 0 ? 100 : Math.round((supported / (supported + scan.unsupported.size)) * 100);
  onProgress?.('SUMMARIZING', 96, 'Preparing analysis views');
  return {
    id: stableId('analysis', `${repositoryFingerprint}:${ANALYZER_VERSION}`),
    workspaceId,
    repositoryFingerprint,
    graphVersion: digest(`${repositoryFingerprint}:${ANALYZER_VERSION}`),
    analyzerVersions: { inventory: ANALYZER_VERSION, typescript: ts.version, frameworkAdapters: ANALYZER_VERSION, featureDiscovery: ANALYZER_VERSION },
    status: graph.warnings.length ? 'PARTIAL' : 'COMPLETED',
    progress: 100,
    stageMessage: graph.warnings.length ? 'Analysis completed with coverage warnings' : 'Analysis completed',
    startedAt,
    completedAt: new Date().toISOString(),
    entities: graph.entities,
    relationships: graph.relationships,
    features,
    findings: graph.findings,
    summary: {
      files: scan.files.length,
      symbols: graph.entities.filter((item) => ['class', 'interface', 'function', 'method'].includes(item.type)).length,
      relationships: graph.relationships.length,
      applications: graph.entities.filter((item) => item.type === 'application').length,
      services: graph.entities.filter((item) => item.type === 'service').length,
      domains: graph.entities.filter((item) => item.type === 'domain').length,
      features: features.length,
      coveragePercent,
      confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 1,
    },
    warnings: [...graph.warnings, ...(scan.excluded ? [`${scan.excluded} paths were excluded by safety and size policies.`] : [])],
  };
}

export function buildSanitizedSourceManifest(rootInput: string): { checksum: string; files: Array<{ path: string; bytes: number; sha256: string }>; excludedFiles: number; totalBytes: number } {
  const root = fs.realpathSync.native(rootInput);
  const scan = inventory(root);
  const files = scan.archiveFiles.map((relative) => {
    const content = fs.readFileSync(path.join(root, relative));
    return { path: relative, bytes: content.byteLength, sha256: digest(content) };
  });
  const totalBytes = files.reduce((sum, item) => sum + item.bytes, 0);
  return { checksum: digest(files.map((item) => `${item.path}\0${item.sha256}`).join('\n')), files, excludedFiles: scan.excluded, totalBytes };
}

export function buildSanitizedSourceArchive(rootInput: string, maxBytes = 20 * 1024 * 1024): { buffer: Buffer; checksum: string; fileCount: number; excludedFiles: number; uncompressedBytes: number } {
  const root = fs.realpathSync.native(rootInput);
  const scan = inventory(root);
  const entries: Array<{ path: string; sha256: string; contentBase64: string }> = [];
  let uncompressedBytes = 0;
  let excludedFiles = scan.excluded;
  for (const relative of scan.archiveFiles) {
    const content = fs.readFileSync(path.join(root, relative));
    if (SECRET_CONTENT.test(content.toString('utf8'))) { excludedFiles += 1; continue; }
    if (uncompressedBytes + content.byteLength > maxBytes) { excludedFiles += 1; continue; }
    uncompressedBytes += content.byteLength;
    entries.push({ path: relative, sha256: digest(content), contentBase64: content.toString('base64') });
  }
  const payload = Buffer.from(JSON.stringify({ format: 'tellann-codebase-v1', files: entries }));
  const buffer = zlib.gzipSync(payload, { level: 9 });
  return { buffer, checksum: digest(buffer), fileCount: entries.length, excludedFiles, uncompressedBytes };
}
