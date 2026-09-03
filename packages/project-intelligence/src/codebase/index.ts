import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import { ANALYZER_VERSIONS, CONFIDENCE, digest, GraphBuilder, slash, stableId } from './core';
import { buildInventory, planArchive, packageOwnerIndex } from './inventory';
import type { Inventory } from './inventory';
import { Budget, collectDeclarations, createAnalysisProgram, resolveReferences } from './program';
import { applyFrameworkAdapters, detectFileScopedRoutes, linkTestSubjects } from './frameworks';
import { analyzeDocumentation } from './docs';
import { discoverFeatures } from './features';
import { analyzeArchitecture, blastRadius } from './architecture';
import { buildCache, hashFile, planIncremental } from './incremental';
import type { AnalysisCache } from './incremental';

export * from './core';
export * from './inventory';
export * from './incremental';
export * from './architecture';
export * from './evidence-bundle';
export { canonicalRoute, endpointId } from './frameworks';
export { blastRadius };

/** Bumped whenever a change would make cached fragments wrong. */
export const CODEBASE_ANALYZER_VERSION = '2.0.0';

export type AnalysisProgress = (
  status: CodebaseAnalysis['status'],
  progress: number,
  message: string,
) => void;

export type AnalyzeCodebaseOptions = {
  onProgress?: AnalysisProgress;
  /** Previous run of this analyzer, for incremental reuse. */
  cache?: AnalysisCache | null;
  /** Wall-clock ceiling for the semantic passes. */
  budgetMs?: number;
  maxSemanticFiles?: number;
  maxFeatures?: number;
};

export type AnalyzeCodebaseResult = {
  analysis: CodebaseAnalysis;
  cache: AnalysisCache;
};

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
    }).trim() || null;
  } catch {
    return null;
  }
}

function repositoryEntities(graph: GraphBuilder, root: string, inventory: Inventory, fingerprint: string): string {
  const repositoryId = graph.addEntity({
    id: stableId('repository', fingerprint),
    type: 'repository',
    name: path.basename(root),
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence: CONFIDENCE.compilerResolved,
    metadata: { repositoryFingerprint: fingerprint },
    evidence: [],
  });

  for (const boundary of inventory.packages) {
    const id = graph.addEntity({
      id: stableId('package', boundary.root),
      type: boundary.kind,
      name: boundary.name,
      path: boundary.root,
      startLine: null,
      endLine: null,
      language: null,
      confidence: CONFIDENCE.manifest,
      metadata: {
        packageRoot: boundary.root,
        private: boundary.private,
        scripts: Object.keys(boundary.scripts),
        dependencyCount: Object.keys(boundary.dependencies).length,
      },
      evidence: [],
    });
    graph.addEdge({
      source: repositoryId, target: id, type: 'CONTAINS', confidence: CONFIDENCE.manifest, evidence: [],
    });

    // Declared dependencies are facts from the manifest, independent of whether
    // any file happens to import them.
    for (const [name, version] of Object.entries(boundary.dependencies)) {
      const workspace = inventory.packages.find((item) => item.name === name);
      const targetId = workspace ? stableId('package', workspace.root) : stableId('package', `external:${name}`);
      if (!workspace) {
        graph.addEntity({
          id: targetId,
          type: 'package',
          name,
          path: null,
          startLine: null,
          endLine: null,
          language: null,
          confidence: CONFIDENCE.manifest,
          metadata: { external: true, version, declared: true },
          evidence: [],
        });
      }
      graph.addEdge({
        source: id, target: targetId, type: 'DEPENDS_ON', confidence: CONFIDENCE.manifest, evidence: [],
      });
    }
  }

  // Directories, so the hierarchy view has something to lazily expand into.
  const owner = packageOwnerIndex(inventory.packages);
  for (const directory of inventory.directories) {
    if (directory.split('/').length > 8) continue;
    const id = stableId('directory', directory);
    graph.addEntity({
      id,
      type: 'directory',
      name: path.basename(directory),
      path: directory,
      startLine: null,
      endLine: null,
      language: null,
      confidence: CONFIDENCE.compilerResolved,
      metadata: { packageRoot: owner(directory) },
      evidence: [],
    });
    const parent = directory.includes('/') ? directory.slice(0, directory.lastIndexOf('/')) : null;
    graph.addEdge({
      source: parent ? stableId('directory', parent) : repositoryId,
      target: id,
      type: 'CONTAINS',
      confidence: CONFIDENCE.compilerResolved,
      evidence: [],
    });
  }

  return repositoryId;
}

/**
 * Run the full pipeline over a working tree.
 *
 * Stages run in the order the job model reports them, and each one is bounded:
 * the analysis of a very large repository degrades into explicit coverage
 * warnings rather than into an unbounded run.
 */
export function analyzeCodebase(
  rootInput: string,
  workspaceId: string,
  repositoryFingerprint: string,
  options: AnalyzeCodebaseOptions = {},
): AnalyzeCodebaseResult {
  const root = fs.realpathSync.native(rootInput);
  const onProgress = options.onProgress;
  const startedAt = new Date().toISOString();
  const budget = new Budget(options.budgetMs ?? 10 * 60_000);
  const graph = new GraphBuilder();

  onProgress?.('INGESTING', 6, 'Inventorying the repository');
  const inventory = buildInventory(root);
  const revision = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['branch', '--show-current']);
  const dirty = Boolean(git(root, ['status', '--porcelain']));

  const fileHashes = new Map<string, string>();
  for (const file of inventory.analyzable) {
    const hash = hashFile(root, file);
    if (hash) fileHashes.set(file, hash);
  }
  const contentHash = digest(
    [...fileHashes.entries()].sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([file, hash]) => `${file}:${hash}`).join('\n'),
  );

  onProgress?.('INGESTING', 12, 'Comparing against the previous analysis');
  const plan = planIncremental(root, inventory, options.cache ?? null, CODEBASE_ANALYZER_VERSION);

  repositoryEntities(graph, root, inventory, repositoryFingerprint);
  for (const fragment of plan.reusable) graph.replayFragment(fragment);

  let stats = {
    callSites: 0, internalCalls: 0, externalCalls: 0, unresolvedCalls: 0,
    imports: 0, internalImports: 0, externalImports: 0, unresolvedImports: 0,
  };
  const environmentKeys = new Set<string>();
  let analyzedFiles = plan.reusable.length;

  if (plan.mode === 'unchanged') {
    onProgress?.('PARSING', 45, 'No source file changed; reusing the previous parse');
  } else {
    onProgress?.('PARSING', 20, `Parsing ${plan.dirty.size} of ${inventory.analyzable.length} source files`);
    const program = createAnalysisProgram(root, inventory, graph, options.maxSemanticFiles ?? 6_000);
    const emitFor = plan.mode === 'incremental' ? plan.dirty : null;

    const declarations = collectDeclarations(program, inventory, graph, emitFor, fileHashes);
    onProgress?.('LINKING', 45, 'Resolving references with the TypeScript checker');
    stats = resolveReferences(
      program, inventory, graph, declarations, budget,
      applyFrameworkAdapters, environmentKeys, emitFor, fileHashes,
    );
    analyzedFiles = emitFor ? emitFor.size + plan.reusable.length : program.sourceFiles.length;
  }

  onProgress?.('GRAPHING', 62, 'Applying framework and documentation analyzers');
  detectFileScopedRoutes(inventory, graph);
  const documentation = analyzeDocumentation(root, inventory, graph);
  linkTestSubjects(graph);

  onProgress?.('DISCOVERING_FEATURES', 74, 'Discovering functionality from entrypoints and side effects');
  const features = discoverFeatures(graph, budget, { maxFeatures: options.maxFeatures ?? 2_000 });

  onProgress?.('ANALYZING_ARCHITECTURE', 86, 'Clustering domains and measuring coupling');
  const unresolvedRatio = stats.callSites ? stats.unresolvedCalls / stats.callSites : 0;
  const architecture = analyzeArchitecture(graph, unresolvedRatio);

  // Domains are known only after clustering, so features are labelled here.
  const domainByEntity = new Map<string, string>();
  for (const edge of graph.edgesOfType('BELONGS_TO_DOMAIN')) {
    if (!domainByEntity.has(edge.source)) domainByEntity.set(edge.source, edge.target);
  }
  for (const feature of features) {
    const anchor = feature.workflow.map((step) => step.entityId).find((id) => domainByEntity.has(id))
      ?? feature.entrypoints.find((id) => domainByEntity.has(id));
    const domainId = anchor ? domainByEntity.get(anchor) : undefined;
    feature.domain = (domainId && graph.entity(domainId)?.name) || 'Core';
    const featureEntity = graph.entity(feature.id);
    if (featureEntity) featureEntity.metadata.domain = feature.domain;
    if (domainId) {
      graph.addEdge({
        source: feature.id, target: domainId, type: 'BELONGS_TO_DOMAIN',
        confidence: CONFIDENCE.directoryHeuristic, evidence: [],
      });
    }
  }

  onProgress?.('SUMMARIZING', 94, 'Preparing analysis views');

  if (Object.keys(inventory.unsupportedLanguageFiles).length) {
    const languages = Object.entries(inventory.unsupportedLanguageFiles)
      .sort(([, left], [, right]) => right - left);
    const total = languages.reduce((sum, [, count]) => sum + count, 0);
    graph.warn(
      `Deep analysis covers TypeScript and JavaScript. ${total} file(s) in ${languages.map(([language, count]) => `${language} (${count})`).join(', ')} received hierarchy and manifest results only.`,
    );
    graph.finding({
      id: stableId('finding', `unsupported:${languages.map(([language]) => language).join(',')}`),
      kind: 'UNSUPPORTED_LANGUAGE',
      severity: 'INFO',
      title: 'Some languages are outside deep-analysis support',
      description: `${total} file(s) were inventoried but not parsed for symbols, calls, or side effects: ${languages.map(([language, count]) => `${language} (${count})`).join(', ')}.`,
      entityIds: [stableId('repository', repositoryFingerprint)],
      evidence: [],
    });
  }
  if (inventory.truncated) {
    graph.warn('The repository exceeded the file budget for a single scan; the inventory is partial.');
  }
  for (const [reason, count] of Object.entries(inventory.exclusions)) {
    if (!count) continue;
    if (reason === 'secret-path') {
      graph.warn(`${count} path(s) matching credential patterns were excluded and never left the device.`);
    }
  }

  const analyzableTotal = inventory.analyzable.length;
  const unsupportedTotal = Object.values(inventory.unsupportedLanguageFiles).reduce((sum, value) => sum + value, 0);
  // Coverage is measured in files, not in distinct extensions: a repository with
  // ten TypeScript files beside five thousand Python ones is not 91% covered.
  const coveragePercent = analyzableTotal + unsupportedTotal === 0
    ? 100
    : Math.round((analyzedFiles / (analyzableTotal + unsupportedTotal)) * 100);

  const confidences = [
    ...graph.entities.map((entity) => entity.confidence),
    ...graph.relationships.map((edge) => edge.confidence),
  ];

  const analyzerVersions: Record<string, string> = {
    ...ANALYZER_VERSIONS,
    coordinator: CODEBASE_ANALYZER_VERSION,
    typescript: ts.version,
  };

  const status: CodebaseAnalysis['status'] = graph.warnings.length ? 'PARTIAL' : 'COMPLETED';
  const analysis: CodebaseAnalysis = {
    // Identity folds in the content hash, so two different dirty trees at the
    // same commit are two different analyses.
    id: stableId('analysis', `${repositoryFingerprint}:${contentHash}:${CODEBASE_ANALYZER_VERSION}`),
    workspaceId,
    repositoryFingerprint,
    graphVersion: digest(`${repositoryFingerprint}:${contentHash}:${CODEBASE_ANALYZER_VERSION}`),
    analyzerVersions,
    status,
    progress: 100,
    stageMessage: graph.warnings.length ? 'Analysis completed with coverage warnings' : 'Analysis completed',
    startedAt,
    completedAt: new Date().toISOString(),
    revision,
    branch,
    dirty,
    contentHash,
    entities: graph.entities,
    relationships: graph.relationships,
    features,
    findings: graph.findings,
    architecture,
    coverage: {
      totalFiles: inventory.files.length,
      analyzableFiles: analyzableTotal,
      analyzedFiles,
      unsupportedLanguageFiles: inventory.unsupportedLanguageFiles,
      excludedByReason: inventory.exclusions,
      languageBytes: inventory.languageBytes,
      internalCallRatio: stats.callSites ? Number((stats.internalCalls / stats.callSites).toFixed(3)) : 0,
      externalCallRatio: stats.callSites ? Number((stats.externalCalls / stats.callSites).toFixed(3)) : 0,
      unresolvedCallRatio: stats.callSites ? Number((stats.unresolvedCalls / stats.callSites).toFixed(3)) : 0,
      internalImportRatio: stats.imports ? Number((stats.internalImports / stats.imports).toFixed(3)) : 0,
      unresolvedImportRatio: stats.imports ? Number((stats.unresolvedImports / stats.imports).toFixed(3)) : 0,
      truncated: inventory.truncated,
    },
    incremental: {
      mode: plan.mode,
      reason: plan.reason,
      reusedFiles: plan.reusable.length,
      reanalyzedFiles: plan.dirty.size,
      addedFiles: plan.added.slice(0, 200),
      modifiedFiles: plan.modified.slice(0, 200),
      deletedFiles: plan.deleted.slice(0, 200),
      invalidatedDependents: plan.invalidatedDependents.length,
    },
    explanations: [],
    summary: {
      files: analyzableTotal,
      symbols: graph.ofType('class').length + graph.ofType('interface').length
        + graph.ofType('function').length + graph.ofType('method').length,
      relationships: graph.relationships.length,
      applications: graph.ofType('application').length,
      services: graph.ofType('service').length,
      domains: graph.ofType('domain').length,
      features: features.length,
      endpoints: graph.ofType('endpoint').length,
      dataModels: graph.ofType('database_model').length + graph.ofType('database_table').length,
      events: graph.ofType('event').length,
      externalServices: graph.ofType('external_service').length,
      tests: graph.ofType('test').length,
      coveragePercent: Math.max(0, Math.min(100, coveragePercent)),
      confidence: confidences.length
        ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(3))
        : 1,
    },
    warnings: graph.warnings,
  };

  const importEdges: Array<[string, string]> = [];
  const fileById = new Map(graph.ofType('file').map((file) => [file.id, file.path ?? '']));
  for (const edge of graph.edgesOfType('IMPORTS')) {
    const from = fileById.get(edge.source);
    const to = fileById.get(edge.target);
    if (from && to) importEdges.push([from, to]);
  }

  const fragments = plan.mode === 'unchanged'
    ? plan.reusable
    : [...plan.reusable, ...graph.fileFragments().filter((fragment) => plan.dirty.has(fragment.file))];

  return {
    analysis,
    cache: buildCache(CODEBASE_ANALYZER_VERSION, analyzerVersions, revision, fragments, importEdges),
  };
}

export type SanitizedArchive = {
  buffer: Buffer;
  checksum: string;
  fileCount: number;
  excludedFiles: number;
  excluded: Array<{ path: string; reason: string }>;
  redactedFiles: number;
  redactions: number;
  uncompressedBytes: number;
  compressedBytes: number;
  truncated: boolean;
};

/**
 * Deterministic, redacted snapshot of the working tree for cloud analysis.
 * Reports what it left out and why, so consent can be given against the actual
 * contents rather than against a general promise.
 */
export function buildSanitizedSourceArchive(rootInput: string, maxBytes = 20 * 1024 * 1024): SanitizedArchive {
  const root = fs.realpathSync.native(rootInput);
  const inventory = buildInventory(root);
  const plan = planArchive(root, inventory, maxBytes);
  const payload = Buffer.from(JSON.stringify({ format: 'tellann-codebase-v1', files: plan.entries }));
  const buffer = zlib.gzipSync(payload, { level: 9 });

  return {
    buffer,
    checksum: digest(buffer),
    fileCount: plan.entries.length,
    excludedFiles: plan.excluded.length + inventory.excludedTotal,
    excluded: plan.excluded.slice(0, 500),
    redactedFiles: plan.redactedFiles,
    redactions: plan.redactions,
    uncompressedBytes: plan.uncompressedBytes,
    compressedBytes: buffer.byteLength,
    truncated: plan.truncated,
  };
}

/** Size and exclusion detail for the consent dialog, without building the archive. */
export function previewSanitizedSourceArchive(rootInput: string, maxBytes = 20 * 1024 * 1024) {
  const root = fs.realpathSync.native(rootInput);
  const inventory = buildInventory(root);
  const plan = planArchive(root, inventory, maxBytes);
  const byReason: Record<string, number> = { ...inventory.exclusions };
  for (const item of plan.excluded) byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
  return {
    fileCount: plan.entries.length,
    uncompressedBytes: plan.uncompressedBytes,
    compressedBytes: zlib.gzipSync(
      Buffer.from(JSON.stringify({ format: 'tellann-codebase-v1', files: plan.entries })),
      { level: 9 },
    ).byteLength,
    redactedFiles: plan.redactedFiles,
    redactions: plan.redactions,
    excludedByReason: byReason,
    truncated: plan.truncated,
    languages: Object.entries(inventory.languageBytes)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 8)
      .map(([language, bytes]) => ({ language, bytes })),
  };
}

export function buildSanitizedSourceManifest(rootInput: string) {
  const root = fs.realpathSync.native(rootInput);
  const inventory = buildInventory(root);
  const plan = planArchive(root, inventory, Number.MAX_SAFE_INTEGER);
  return {
    checksum: digest(plan.entries.map((entry) => `${entry.path} ${entry.sha256}`).join('\n')),
    files: plan.entries.map((entry) => ({
      path: entry.path,
      bytes: Buffer.from(entry.contentBase64, 'base64').byteLength,
      sha256: entry.sha256,
    })),
    excludedFiles: inventory.excludedTotal + plan.excluded.length,
    totalBytes: plan.uncompressedBytes,
  };
}

export { slash };
