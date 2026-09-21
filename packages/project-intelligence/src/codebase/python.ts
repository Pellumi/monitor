import fs from 'node:fs';
import path from 'node:path';
import {
  callsByScope,
  extractPythonDataAccess,
  extractPythonEnvironmentKeys,
  extractPythonEvents,
  extractPythonModels,
  extractPythonOutboundCalls,
  extractPythonRoutes,
  extractPythonTasks,
  extractPythonTests,
  parsePythonModule,
  type PythonModule,
  type PythonNode,
} from '@tellann/python-project';
import type { CodeEvidence } from '@tellann/desktop-contracts';
import { CONFIDENCE, declarationId, evidenceOf, GraphBuilder, slash, stableId } from './core';
import { canonicalRoute, endpointId } from './frameworks';
import { packageOwnerIndex, type Inventory } from './inventory';

const PYTHON_ANALYZER = 'python-structure';
const PYTHON_FRAMEWORK_ANALYZER = 'python-framework-adapter';

/**
 * Python analysis for the codebase graph.
 *
 * This produces the same node and edge vocabulary as the TypeScript passes -
 * files, declarations, endpoints, models, events, jobs, external services - so
 * a repository with a React frontend and a Django backend yields one connected
 * graph. It does not use a Python runtime: shelling out to an interpreter that
 * may not exist, in an environment the user has not approved, to read code that
 * has not been reviewed is not something an analyzer should do on its own, so
 * the structure is read directly from source.
 *
 * Confidence is reported honestly. A decorator-declared route is read straight
 * off the syntax tree, and gets AST confidence; a call resolved only through an
 * import binding rather than through a type checker is a naming heuristic, and
 * says so.
 */

export type PythonAnalysisStats = {
  files: number;
  declarations: number;
  endpoints: number;
  models: number;
  calls: number;
  internalCalls: number;
  unresolvedCalls: number;
};

type ModuleIndex = {
  /** Dotted module name to repository-relative file path. */
  byName: Map<string, string>;
  /** Repository-relative file path to dotted module name. */
  byFile: Map<string, string>;
};

/**
 * Dotted module name for a file.
 *
 * `src/` and a project subdirectory are both stripped when they are not
 * themselves importable packages, because `src/billing/models.py` is imported
 * as `billing.models`, never as `src.billing.models`.
 */
function moduleNameFor(root: string, file: string): string {
  const segments = file.replace(/\.pyi?$/i, '').split('/');
  if (segments[segments.length - 1] === '__init__') segments.pop();
  // Walk down from the repository root while the directory is not a package;
  // the first packaged directory begins the importable name.
  let start = 0;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const directory = path.join(root, ...segments.slice(0, index + 1));
    if (fs.existsSync(path.join(directory, '__init__.py'))) {
      start = index;
      break;
    }
    start = index + 1;
  }
  return segments.slice(start).join('.');
}

function buildModuleIndex(root: string, files: string[]): ModuleIndex {
  const byName = new Map<string, string>();
  const byFile = new Map<string, string>();
  for (const file of files) {
    const name = moduleNameFor(root, file);
    if (!name) continue;
    byFile.set(file, name);
    // A shallower file wins a name collision: `app/models.py` over a vendored copy.
    const existing = byName.get(name);
    if (!existing || file.split('/').length < existing.split('/').length) byName.set(name, file);
  }
  return { byName, byFile };
}

/**
 * Resolve a dotted module name to a repository file, with no fallback.
 *
 * Used where an approximate answer would be wrong: `from billing.models import
 * Invoice` must not bind `Invoice` to the `billing.models` module itself, but
 * `from . import views` must bind `views` to `billing/views.py` rather than to
 * the package that contains it.
 */
function resolveModuleExact(
  index: ModuleIndex,
  fromFile: string,
  moduleName: string,
  relativeLevel: number,
): string | null {
  if (relativeLevel === 0) return index.byName.get(moduleName) ?? null;
  const ownName = index.byFile.get(fromFile) ?? '';
  const ownSegments = ownName.split('.').filter(Boolean);
  const isPackageInit = fromFile.endsWith('/__init__.py') || fromFile === '__init__.py';
  const base = isPackageInit ? ownSegments : ownSegments.slice(0, -1);
  const trimmed = base.slice(0, Math.max(0, base.length - (relativeLevel - 1)));
  return index.byName.get([...trimmed, ...moduleName.split('.')].join('.')) ?? null;
}

/** Resolve an import's module to a repository file, following relative levels. */
function resolveImportTarget(
  index: ModuleIndex,
  fromFile: string,
  moduleName: string | null,
  relativeLevel: number,
): string | null {
  if (relativeLevel > 0) {
    const ownName = index.byFile.get(fromFile) ?? '';
    const ownSegments = ownName.split('.').filter(Boolean);
    // `from . import x` inside `a/b.py` is relative to package `a`.
    const isPackageInit = fromFile.endsWith('/__init__.py') || fromFile === '__init__.py';
    const base = isPackageInit ? ownSegments : ownSegments.slice(0, -1);
    const trimmed = base.slice(0, Math.max(0, base.length - (relativeLevel - 1)));
    const candidate = [...trimmed, ...(moduleName ? moduleName.split('.') : [])].join('.');
    return index.byName.get(candidate) ?? null;
  }
  if (!moduleName) return null;
  const direct = index.byName.get(moduleName);
  if (direct) return direct;
  // `from billing.models import Invoice` where `billing.models` is a package.
  const parent = moduleName.split('.').slice(0, -1).join('.');
  return parent ? index.byName.get(parent) ?? null : null;
}

type Binding = {
  /** File the name was imported from, when it resolves inside the repository. */
  file: string | null;
  /** Symbol name inside that file, or null when the whole module was bound. */
  symbol: string | null;
  /** Distribution or module the name came from, for external attribution. */
  external: string | null;
};

function bindingsFor(module: PythonModule, index: ModuleIndex): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const item of module.imports) {
    if (item.plain) {
      for (const entry of item.names) {
        const target = resolveImportTarget(index, module.path, entry.name, 0);
        const local = entry.alias ?? entry.name.split('.')[0];
        bindings.set(local, {
          file: target,
          symbol: null,
          external: target ? null : entry.name.split('.')[0],
        });
      }
      continue;
    }
    const target = resolveImportTarget(index, module.path, item.module, item.relativeLevel);
    for (const entry of item.names) {
      if (entry.name === '*') continue;
      const local = entry.alias ?? entry.name;
      // `from . import views` imports a module, not a symbol inside one. Bound
      // as a symbol it would resolve to the package's `__init__.py`, and every
      // `views.Something` reference through it would miss.
      const submodule = resolveModuleExact(
        index,
        module.path,
        item.module ? `${item.module}.${entry.name}` : entry.name,
        item.relativeLevel,
      );
      if (submodule) {
        bindings.set(local, { file: submodule, symbol: null, external: null });
        continue;
      }
      bindings.set(local, {
        file: target,
        symbol: entry.name,
        external: target ? null : (item.module ?? '').split('.')[0] || null,
      });
    }
  }
  return bindings;
}

function entityTypeFor(node: PythonNode, parent: PythonNode): 'class' | 'function' | 'method' {
  if (node.kind === 'class') return 'class';
  return parent.kind === 'class' ? 'method' : 'function';
}

function evidenceFor(
  file: string,
  startLine: number,
  endLine: number,
  symbol: string | null,
  kind: string,
  analyzer: string,
  confidence: number,
  excerpt?: string,
): CodeEvidence {
  return evidenceOf({ kind, path: file, startLine, endLine, symbol, excerpt: excerpt ?? null, analyzer, confidence });
}

export type AnalyzePythonOptions = {
  /** Files to emit for; null emits everything. Unlisted files were replayed. */
  emitFor?: Set<string> | null;
  fileHashes?: Map<string, string>;
  environmentKeys?: Set<string>;
  maxFiles?: number;
};

/**
 * Walk the Python half of a repository and add it to the graph.
 *
 * Runs after the TypeScript passes so endpoints declared on both sides land on
 * the same node: a browser `fetch('/api/users')` and a FastAPI `@router.get`
 * share one endpoint identity because both go through `endpointId`.
 */
export function analyzePythonSources(
  root: string,
  inventory: Inventory,
  graph: GraphBuilder,
  options: AnalyzePythonOptions = {},
): PythonAnalysisStats {
  const stats: PythonAnalysisStats = {
    files: 0, declarations: 0, endpoints: 0, models: 0, calls: 0, internalCalls: 0, unresolvedCalls: 0,
  };
  const candidates = inventory.pythonAnalyzable ?? [];
  if (!candidates.length) return stats;

  const files = candidates.slice(0, options.maxFiles ?? 12_000);
  const index = buildModuleIndex(root, files);
  const packageOf = packageOwnerIndex(inventory.packages);
  const emitFor = options.emitFor ?? null;
  const fileHashes = options.fileHashes ?? new Map<string, string>();
  const environmentKeys = options.environmentKeys ?? new Set<string>();

  /** Declaration entity ids by `file` then qualified name, for call linking. */
  const declarationIds = new Map<string, Map<string, string>>();
  const parsedModules: Array<{ module: PythonModule; fileId: string; file: string }> = [];

  // First pass: declarations, so a call in one file can reach a definition in
  // another regardless of the order the files happen to be walked in.
  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
    } catch {
      graph.warn(`A Python source file could not be read and is missing from the graph: ${file}`);
      continue;
    }

    let module: PythonModule;
    try {
      module = parsePythonModule(source, file);
    } catch {
      graph.warn(`A Python source file could not be read and is missing from the graph: ${file}`);
      continue;
    }

    const record = inventory.files.find((item) => item.path === file);
    const fileId = stableId('file', file);
    const emit = emitFor === null || emitFor.has(file);
    parsedModules.push({ module, fileId, file });
    stats.files += 1;

    const perFile = new Map<string, string>();
    declarationIds.set(file, perFile);

    if (emit) {
      graph.beginFile(file, fileHashes.get(file) ?? '');
      graph.addEntity({
        id: fileId,
        type: 'file',
        name: path.posix.basename(file),
        path: file,
        startLine: 1,
        endLine: module.lineCount,
        language: 'Python',
        confidence: CONFIDENCE.manifest,
        metadata: {
          packageRoot: packageOf(file),
          test: Boolean(record?.test),
          generated: Boolean(record?.generated),
          configuration: Boolean(record?.configuration),
          bytes: record?.bytes ?? 0,
          module: index.byFile.get(file) ?? null,
        },
        evidence: [],
      });
      graph.addEdge({
        source: stableId('package', packageOf(file)),
        target: fileId,
        type: 'CONTAINS',
        confidence: CONFIDENCE.manifest,
        evidence: [],
      });
    }

    const emitDeclaration = (node: PythonNode, parent: PythonNode, scopeId: string) => {
      const type = entityTypeFor(node, parent);
      const id = declarationId(type, file, node.startOffset, node.qualifiedName);
      perFile.set(node.qualifiedName, id);
      stats.declarations += 1;

      if (emit) {
        graph.addEntity({
          id,
          type,
          name: node.name,
          path: file,
          startLine: node.startLine,
          endLine: node.endLine,
          language: 'Python',
          confidence: CONFIDENCE.ast,
          metadata: {
            qualifiedName: node.qualifiedName,
            async: node.isAsync,
            decorators: node.decorators.map((decorator) => decorator.name),
            bases: node.bases,
            parameters: node.parameters,
            // Python has no export keyword; a leading underscore is the
            // convention that says "internal", so the inverse is reported.
            exported: !node.name.startsWith('_'),
            test: Boolean(record?.test),
            packageRoot: packageOf(file),
            docstring: node.docstring,
          },
          evidence: [evidenceFor(file, node.startLine, node.endLine, node.qualifiedName, 'declaration', PYTHON_ANALYZER, CONFIDENCE.ast)],
        });
        graph.addEdge({ source: scopeId, target: id, type: 'DEFINES', confidence: CONFIDENCE.ast, evidence: [] });
        if (!node.name.startsWith('_')) {
          graph.addEdge({ source: fileId, target: id, type: 'EXPORTS', confidence: CONFIDENCE.ast, evidence: [] });
        }
      }

      for (const child of node.children) emitDeclaration(child, node, id);
    };

    for (const child of module.root.children) emitDeclaration(child, module.root, fileId);
    for (const key of extractPythonEnvironmentKeys(module)) environmentKeys.add(key);
    if (emit) graph.endFile();
  }

  /**
   * HTTP methods each class-based view implements, by file and class name.
   *
   * A Django `path()` names no method, so an endpoint read from a URLconf
   * alone is `ALL /invoices`, which never matches the `GET /invoices` a
   * browser call produces - the two halves of the same endpoint stay
   * disconnected. Resolving the view through its import binding recovers the
   * methods it actually implements, which is what lets a React `fetch` and the
   * Django view that serves it land on one node.
   */
  const viewMethods = new Map<string, Map<string, string[]>>();
  for (const { module, file } of parsedModules) {
    const perFile = new Map<string, string[]>();
    for (const route of extractPythonRoutes(module)) {
      if (route.kind !== 'django-view-method' || !route.handler) continue;
      const className = route.handler.slice(0, route.handler.lastIndexOf('.'));
      if (!className) continue;
      const bucket = perFile.get(className);
      if (bucket) bucket.push(route.method);
      else perFile.set(className, [route.method]);
    }
    if (perFile.size) viewMethods.set(file, perFile);
  }

  // Second pass: everything that needs the whole declaration index.
  for (const { module, fileId, file } of parsedModules) {
    const emit = emitFor === null || emitFor.has(file);
    if (!emit) continue;
    graph.beginFile(file, fileHashes.get(file) ?? '');

    const bindings = bindingsFor(module, index);
    const perFile = declarationIds.get(file) ?? new Map<string, string>();
    const boundary = inventory.packages.find((item) => item.root === packageOf(file));

    const scopeIdOf = (node: PythonNode): string =>
      node.kind === 'module' ? fileId : perFile.get(node.qualifiedName) ?? fileId;

    // Imports.
    for (const item of module.imports) {
      const target = resolveImportTarget(index, file, item.plain ? item.names[0]?.name ?? null : item.module, item.relativeLevel);
      const evidence = evidenceFor(file, item.line, item.line, null, 'python-import', PYTHON_ANALYZER, CONFIDENCE.ast, item.text);
      if (target) {
        graph.addEdge({
          source: fileId,
          target: stableId('file', target),
          type: 'IMPORTS',
          confidence: CONFIDENCE.ast,
          evidence: [evidence],
        });
        continue;
      }
      const distribution = (item.plain ? item.names[0]?.name : item.module)?.split('.')[0];
      if (!distribution || item.relativeLevel > 0) continue;
      // Only third-party imports become package dependencies; the standard
      // library is not a dependency the project declared or can change.
      const declared = boundary?.dependencies[distribution] ?? boundary?.devDependencies[distribution];
      if (!declared) continue;
      graph.addEdge({
        source: stableId('package', packageOf(file)),
        target: stableId('package', `external:${distribution}`),
        type: 'DEPENDS_ON',
        confidence: CONFIDENCE.ast,
        evidence: [evidence],
      });
    }

    // Calls, resolved through the import bindings.
    for (const call of module.calls) {
      stats.calls += 1;
      const scopeId = scopeIdOf(call.scope);
      const segments = call.callee.split('.');
      const local = perFile.get(call.callee);
      if (local) {
        graph.addEdge({
          source: scopeId,
          target: local,
          type: 'CALLS',
          confidence: CONFIDENCE.ast,
          evidence: [evidenceFor(file, call.line, call.line, call.callee, 'python-call', PYTHON_ANALYZER, CONFIDENCE.ast)],
        });
        stats.internalCalls += 1;
        continue;
      }
      const binding = bindings.get(segments[0]);
      if (binding?.file) {
        const targetDeclarations = declarationIds.get(binding.file);
        const qualified = binding.symbol
          ? [binding.symbol, ...segments.slice(1)].join('.')
          : segments.slice(1).join('.');
        const targetId = targetDeclarations?.get(qualified);
        if (targetId) {
          graph.addEdge({
            source: scopeId,
            target: targetId,
            type: 'CALLS',
            // Resolved by name through an import rather than by a checker, so
            // it ranks below what the TypeScript pass can prove.
            confidence: CONFIDENCE.namingHeuristic,
            evidence: [evidenceFor(file, call.line, call.line, call.callee, 'python-call', PYTHON_ANALYZER, CONFIDENCE.namingHeuristic)],
          });
          stats.internalCalls += 1;
          continue;
        }
        graph.addEdge({
          source: scopeId,
          target: stableId('file', binding.file),
          type: 'USES',
          confidence: CONFIDENCE.namingHeuristic,
          evidence: [evidenceFor(file, call.line, call.line, call.callee, 'python-call', PYTHON_ANALYZER, CONFIDENCE.namingHeuristic)],
        });
        stats.internalCalls += 1;
        continue;
      }
      stats.unresolvedCalls += 1;
    }

    /** The methods a URLconf's handler implements, when it resolves to a view. */
    const methodsForHandler = (handler: string | null): string[] => {
      if (!handler) return [];
      const segments = handler.split('.');
      const symbol = segments[segments.length - 1];
      const local = declarationIds.get(file)?.has(symbol) ? file : null;
      const target = local ?? bindings.get(segments[0])?.file ?? null;
      if (!target) return [];
      return viewMethods.get(target)?.get(symbol) ?? [];
    };

    // Endpoints.
    for (const route of extractPythonRoutes(module)) {
      if (route.kind === 'django-view-method') {
        // The handler is known but the URL is not; recording a `{ClassName}`
        // path would invent an endpoint nothing can match, so only the
        // handler's role is recorded.
        const handlerId = route.handler ? perFile.get(route.handler) : undefined;
        if (!handlerId) continue;
        const entity = graph.entity(handlerId);
        if (entity) entity.metadata.httpMethod = route.method;
        continue;
      }
      const canonical = canonicalRoute(route.route);
      const evidence = evidenceFor(file, route.line, route.line, route.handler, route.kind, PYTHON_FRAMEWORK_ANALYZER, route.confidence, route.excerpt);
      const handlerId = route.handler ? perFile.get(route.handler) : undefined;
      // A URLconf entry whose view declares its own HTTP methods becomes one
      // endpoint per method; a plain function view genuinely serves every
      // method, and `ALL` says so rather than guessing at one.
      const resolved = route.method === 'ALL' ? methodsForHandler(route.handler) : [];
      const methods = resolved.length ? resolved : [route.method];

      for (const method of methods) {
        const id = endpointId(method, canonical);
        graph.addEntity({
          id,
          type: 'endpoint',
          name: `${method.toUpperCase()} ${canonical}`,
          path: file,
          startLine: route.line,
          endLine: route.line,
          language: null,
          confidence: route.confidence,
          metadata: { method: method.toUpperCase(), route: canonical, framework: route.kind },
          evidence: [evidence],
        });
        graph.addEdge({
          source: id,
          target: handlerId ?? fileId,
          type: 'ROUTES_TO',
          confidence: route.confidence,
          evidence: [evidence],
        });
        stats.endpoints += 1;
      }
    }

    // Data models and the operations against them.
    for (const model of extractPythonModels(module)) {
      const declarationIdForModel = perFile.get(model.name);
      const id = stableId('database_model', model.name.toLowerCase());
      const evidence = evidenceFor(file, model.line, model.line, model.name, `${model.orm}-model`, PYTHON_FRAMEWORK_ANALYZER, CONFIDENCE.ast, model.excerpt);
      graph.addEntity({
        id,
        type: 'database_model',
        name: model.name,
        path: file,
        startLine: model.line,
        endLine: model.line,
        language: null,
        confidence: CONFIDENCE.ast,
        metadata: { orm: model.orm, table: model.table },
        evidence: [evidence],
      });
      graph.addEdge({
        source: declarationIdForModel ?? fileId,
        target: id,
        type: 'DEFINES',
        confidence: CONFIDENCE.ast,
        evidence: [evidence],
      });
      stats.models += 1;
    }

    for (const access of extractPythonDataAccess(module)) {
      const id = stableId('database_model', access.model.toLowerCase());
      const evidence = evidenceFor(file, access.line, access.line, access.model, `${access.orm}-operation`, PYTHON_FRAMEWORK_ANALYZER, CONFIDENCE.ast);
      graph.addEntity({
        id,
        type: 'database_model',
        name: access.model,
        path: null,
        startLine: null,
        endLine: null,
        language: null,
        confidence: CONFIDENCE.ast,
        metadata: { orm: access.orm },
        evidence: [evidence],
      });
      graph.addEdge({
        source: scopeIdOf(access.scope),
        target: id,
        type: access.write ? 'WRITES' : 'READS',
        confidence: CONFIDENCE.ast,
        evidence: [evidence],
      });
    }

    // Background work.
    for (const task of extractPythonTasks(module)) {
      const id = stableId('job', `${file}:${task.name}`);
      const evidence = evidenceFor(file, task.line, task.line, task.name, task.kind, PYTHON_FRAMEWORK_ANALYZER, CONFIDENCE.ast);
      graph.addEntity({
        id,
        type: 'job',
        name: task.name,
        path: file,
        startLine: task.line,
        endLine: task.line,
        language: null,
        confidence: CONFIDENCE.ast,
        metadata: { kind: task.kind },
        evidence: [evidence],
      });
      graph.addEdge({
        source: id,
        target: scopeIdOf(task.scope),
        type: 'HANDLED_BY',
        confidence: CONFIDENCE.ast,
        evidence: [evidence],
      });
    }

    // Events.
    for (const event of extractPythonEvents(module)) {
      const id = stableId('event', event.name.toLowerCase());
      const evidence = evidenceFor(file, event.line, event.line, event.name, event.publishes ? 'event-publish' : 'event-subscribe', PYTHON_FRAMEWORK_ANALYZER, CONFIDENCE.ast);
      graph.addEntity({
        id,
        type: 'event',
        name: event.name,
        path: null,
        startLine: null,
        endLine: null,
        language: null,
        confidence: CONFIDENCE.ast,
        metadata: { channel: event.channel },
        evidence: [evidence],
      });
      const scopeId = scopeIdOf(event.scope);
      if (event.publishes) {
        graph.addEdge({ source: scopeId, target: id, type: 'PUBLISHES', confidence: CONFIDENCE.ast, evidence: [evidence] });
      } else {
        graph.addEdge({ source: scopeId, target: id, type: 'SUBSCRIBES_TO', confidence: CONFIDENCE.ast, evidence: [evidence] });
        graph.addEdge({ source: id, target: scopeId, type: 'HANDLED_BY', confidence: CONFIDENCE.ast, evidence: [evidence] });
      }
    }

    // Outbound HTTP. An absolute URL is a dependency on someone else; a
    // relative path is this application's own endpoint, so it attaches to the
    // shared endpoint node and the client-to-server path stays connected.
    for (const outbound of extractPythonOutboundCalls(module)) {
      const scopeId = scopeIdOf(outbound.scope);
      const evidence = evidenceFor(file, outbound.line, outbound.line, outbound.target, 'python-http-client', PYTHON_FRAMEWORK_ANALYZER, CONFIDENCE.ast);
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(outbound.target)) {
        let host = outbound.target;
        try {
          host = new URL(outbound.target).hostname;
        } catch { /* a templated URL keeps its raw spelling as the service name */ }
        const id = stableId('external_service', host.toLowerCase());
        graph.addEntity({
          id,
          type: 'external_service',
          name: host,
          path: null,
          startLine: null,
          endLine: null,
          language: null,
          confidence: CONFIDENCE.ast,
          metadata: { client: outbound.client },
          evidence: [evidence],
        });
        graph.addEdge({ source: scopeId, target: id, type: 'CALLS_EXTERNAL', confidence: CONFIDENCE.ast, evidence: [evidence] });
        continue;
      }
      if (!outbound.target.startsWith('/')) continue;
      const canonical = canonicalRoute(outbound.target);
      const id = endpointId(outbound.method, canonical);
      graph.addEntity({
        id,
        type: 'endpoint',
        name: `${outbound.method.toUpperCase()} ${canonical}`,
        path: null,
        startLine: null,
        endLine: null,
        language: null,
        confidence: CONFIDENCE.ast,
        metadata: { method: outbound.method.toUpperCase(), route: canonical, calledFromClient: true },
        evidence: [evidence],
      });
      // `CALLS`, matching the TypeScript client adapter, so a caller and a
      // handler of the same endpoint are one relationship shape whichever
      // language each half is written in.
      graph.addEdge({ source: scopeId, target: id, type: 'CALLS', confidence: CONFIDENCE.ast, evidence: [evidence] });
    }

    // Tests, and what they exercise.
    const scopes = callsByScope(module);
    for (const test of extractPythonTests(module)) {
      const id = stableId('test', `${file}:${test.qualifiedName}`);
      const evidence = evidenceFor(file, test.startLine, test.endLine, test.qualifiedName, 'python-test', PYTHON_ANALYZER, CONFIDENCE.testAssertion);
      graph.addEntity({
        id,
        type: 'test',
        name: test.qualifiedName,
        path: file,
        startLine: test.startLine,
        endLine: test.endLine,
        language: 'Python',
        confidence: CONFIDENCE.testAssertion,
        metadata: { framework: test.bases.length ? 'unittest' : 'pytest' },
        evidence: [evidence],
      });
      const declarationForTest = perFile.get(test.qualifiedName);
      if (declarationForTest) {
        graph.addEdge({ source: id, target: declarationForTest, type: 'TESTS', confidence: CONFIDENCE.testAssertion, evidence: [evidence] });
      }
      for (const call of scopes.get(test) ?? []) {
        const binding = bindings.get(call.callee.split('.')[0]);
        if (!binding?.file) continue;
        const target = declarationIds.get(binding.file)?.get(
          binding.symbol ? [binding.symbol, ...call.callee.split('.').slice(1)].join('.') : call.callee,
        );
        if (target) {
          graph.addEdge({ source: id, target, type: 'TESTS', confidence: CONFIDENCE.namingHeuristic, evidence: [evidence] });
        }
      }
    }

    graph.endFile();
  }

  return stats;
}

/** Repository-relative Python files, for callers building their own indexes. */
export function pythonModuleName(root: string, file: string): string {
  return moduleNameFor(root, slash(file));
}
