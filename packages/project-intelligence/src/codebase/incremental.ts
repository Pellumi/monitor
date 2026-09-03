import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import { digest, slash } from './core';
import type { FileFragment } from './core';
import type { Inventory } from './inventory';

/**
 * What an earlier run of the same analyzer version produced, keyed by file.
 * Held by the caller (the desktop keeps it on disk beside the analysis) and
 * handed back on the next scan.
 */
export type AnalysisCache = {
  version: string;
  analyzerVersions: Record<string, string>;
  revision: string | null;
  /** Repository-relative path to the content hash it was analyzed at. */
  fileHashes: Record<string, string>;
  fragments: FileFragment[];
  /** Import edges from the previous run, used to find reverse dependencies. */
  importEdges: Array<[string, string]>;
};

export type IncrementalPlan = {
  mode: 'full' | 'incremental' | 'unchanged';
  /** Files that must be re-parsed and re-linked. */
  dirty: Set<string>;
  /** Fragments that can be replayed without touching the source. */
  reusable: FileFragment[];
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  /** Files pulled in only because they depend on something that changed. */
  invalidatedDependents: string[];
  reason: string;
};

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
      maxBuffer: 32 * 1024 * 1024,
    }).trim() || null;
  } catch {
    return null;
  }
}

export function hashFile(root: string, relative: string): string | null {
  try {
    return digest(fs.readFileSync(path.join(root, ...relative.split('/'))));
  } catch {
    return null;
  }
}

/**
 * Change set between the cached revision and the working tree. Git is asked
 * first because it reports renames, which lets the plan move a fragment rather
 * than re-analyze it; content hashes then catch uncommitted edits that git
 * status alone would not attribute to a specific prior analysis.
 */
function gitChanges(root: string, fromRevision: string | null): {
  added: string[]; modified: string[]; deleted: string[]; renamed: Array<{ from: string; to: string }>;
} | null {
  if (!fromRevision) return null;
  if (!git(root, ['cat-file', '-e', `${fromRevision}^{commit}`])) return null;
  const output = git(root, ['diff', '--name-status', '-M', '--no-renames=false', fromRevision, '--']);
  if (output === null) return null;

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R') && parts.length >= 3) {
      renamed.push({ from: slash(parts[1]), to: slash(parts[2]) });
    } else if (status.startsWith('A')) added.push(slash(parts[1]));
    else if (status.startsWith('D')) deleted.push(slash(parts[1]));
    else if (parts[1]) modified.push(slash(parts[1]));
  }
  return { added, modified, deleted, renamed };
}

/**
 * Decide how much work this scan actually needs.
 *
 * A file that changed must be re-analyzed. So must every file that imports it,
 * transitively: a call edge recorded in an untouched file points at a
 * declaration in the changed one, and that declaration's identity moves when
 * its position moves. Anything outside that closure is replayed from cache.
 */
export function planIncremental(
  root: string,
  inventory: Inventory,
  cache: AnalysisCache | null,
  analyzerVersion: string,
): IncrementalPlan {
  const present = new Set(inventory.analyzable);
  const empty: IncrementalPlan = {
    mode: 'full',
    dirty: new Set(present),
    reusable: [],
    added: [...present],
    modified: [],
    deleted: [],
    renamed: [],
    invalidatedDependents: [],
    reason: 'No reusable analysis was available for this workspace.',
  };
  if (!cache) return empty;
  if (cache.version !== analyzerVersion) {
    return { ...empty, reason: 'The analyzer version changed, so cached results were discarded.' };
  }

  const currentHashes = new Map<string, string>();
  for (const file of inventory.analyzable) {
    const hash = hashFile(root, file);
    if (hash) currentHashes.set(file, hash);
  }

  const changes = gitChanges(root, cache.revision);
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const renamed = (changes?.renamed ?? []).filter((entry) => present.has(entry.to));

  for (const [file, hash] of currentHashes) {
    const previous = cache.fileHashes[file];
    if (previous === undefined) added.push(file);
    else if (previous !== hash) modified.push(file);
  }
  for (const file of Object.keys(cache.fileHashes)) {
    if (!currentHashes.has(file)) deleted.push(file);
  }

  const changedSet = new Set([...added, ...modified]);
  if (!changedSet.size && !deleted.length) {
    return {
      mode: 'unchanged',
      dirty: new Set(),
      reusable: cache.fragments.filter((fragment) => present.has(fragment.file)),
      added: [], modified: [], deleted: [], renamed: [],
      invalidatedDependents: [],
      reason: 'No analyzable file changed since the previous analysis.',
    };
  }

  // Reverse-import closure over the previous run's edges.
  const dependents = new Map<string, string[]>();
  for (const [from, to] of cache.importEdges) {
    const bucket = dependents.get(to);
    if (bucket) bucket.push(from);
    else dependents.set(to, [from]);
  }
  const dirty = new Set(changedSet);
  for (const file of deleted) dirty.add(file);
  const queue = [...dirty];
  const invalidatedDependents: string[] = [];
  while (queue.length) {
    const current = queue.pop()!;
    for (const dependent of dependents.get(current) ?? []) {
      if (dirty.has(dependent)) continue;
      dirty.add(dependent);
      if (present.has(dependent)) invalidatedDependents.push(dependent);
      queue.push(dependent);
    }
  }

  const reusable = cache.fragments.filter((fragment) =>
    present.has(fragment.file)
    && !dirty.has(fragment.file)
    && currentHashes.get(fragment.file) === fragment.contentHash);

  // Below roughly a third reused there is no benefit left to protect, and a
  // clean full scan is both simpler and less likely to carry stale state.
  if (reusable.length < present.size * 0.3) {
    return { ...empty, reason: 'Too much of the repository changed for incremental reuse to help.' };
  }

  return {
    mode: 'incremental',
    dirty: new Set([...dirty].filter((file) => present.has(file))),
    reusable,
    added, modified, deleted, renamed,
    invalidatedDependents,
    reason: `${reusable.length} file(s) reused, ${dirty.size} re-analyzed (${invalidatedDependents.length} pulled in as reverse dependencies).`,
  };
}

export function buildCache(
  analyzerVersion: string,
  analyzerVersions: Record<string, string>,
  revision: string | null,
  fragments: FileFragment[],
  importEdges: Array<[string, string]>,
): AnalysisCache {
  const fileHashes: Record<string, string> = {};
  for (const fragment of fragments) fileHashes[fragment.file] = fragment.contentHash;
  return { version: analyzerVersion, analyzerVersions, revision, fileHashes, fragments, importEdges };
}

// ── Snapshot comparison ──────────────────────────────────────────────────────

export type AnalysisChange = {
  kind: 'ADDED' | 'REMOVED' | 'CHANGED';
  category: 'entity' | 'dependency' | 'feature' | 'domain' | 'endpoint' | 'external' | 'architecture';
  label: string;
  detail: string;
  entityId: string | null;
};

export type AnalysisComparison = {
  fromAnalysisId: string;
  toAnalysisId: string;
  fromRevision: string | null;
  toRevision: string | null;
  changes: AnalysisChange[];
  summary: {
    entitiesAdded: number; entitiesRemoved: number;
    featuresAdded: number; featuresRemoved: number; featuresChanged: number;
    domainsAdded: number; domainsRemoved: number;
    endpointsAdded: number; endpointsRemoved: number;
    externalsAdded: number; externalsRemoved: number;
  };
};

/**
 * What changed architecturally between two analyses. Compares by stable
 * identity and by the shape of each feature, so "checkout now also writes
 * PaymentAttempt" surfaces rather than being lost in a count.
 */
export function compareAnalyses(before: CodebaseAnalysis, after: CodebaseAnalysis): AnalysisComparison {
  const changes: AnalysisChange[] = [];

  const beforeEntities = new Map(before.entities.map((entity) => [entity.id, entity]));
  const afterEntities = new Map(after.entities.map((entity) => [entity.id, entity]));

  const countByType = (ids: Iterable<string>, source: Map<string, { type: string }>, type: string) => {
    let count = 0;
    for (const id of ids) if (source.get(id)?.type === type) count += 1;
    return count;
  };

  const addedIds = [...afterEntities.keys()].filter((id) => !beforeEntities.has(id));
  const removedIds = [...beforeEntities.keys()].filter((id) => !afterEntities.has(id));

  for (const id of addedIds) {
    const entity = afterEntities.get(id)!;
    if (!['endpoint', 'external_service', 'domain', 'database_model', 'event', 'queue', 'job'].includes(entity.type)) continue;
    changes.push({
      kind: 'ADDED',
      category: entity.type === 'endpoint' ? 'endpoint' : entity.type === 'external_service' ? 'external' : entity.type === 'domain' ? 'domain' : 'entity',
      label: `${entity.type.replaceAll('_', ' ')} added: ${entity.name}`,
      detail: entity.path ? `Introduced in ${entity.path}.` : 'Introduced in this revision.',
      entityId: id,
    });
  }
  for (const id of removedIds) {
    const entity = beforeEntities.get(id)!;
    if (!['endpoint', 'external_service', 'domain', 'database_model', 'event', 'queue', 'job'].includes(entity.type)) continue;
    changes.push({
      kind: 'REMOVED',
      category: entity.type === 'endpoint' ? 'endpoint' : entity.type === 'external_service' ? 'external' : entity.type === 'domain' ? 'domain' : 'entity',
      label: `${entity.type.replaceAll('_', ' ')} removed: ${entity.name}`,
      detail: entity.path ? `Previously defined in ${entity.path}.` : 'No longer present.',
      entityId: id,
    });
  }

  const beforeFeatures = new Map(before.features.map((feature) => [feature.id, feature]));
  const afterFeatures = new Map(after.features.map((feature) => [feature.id, feature]));
  let featuresChanged = 0;

  for (const [id, feature] of afterFeatures) {
    const previous = beforeFeatures.get(id);
    if (!previous) {
      changes.push({
        kind: 'ADDED', category: 'feature',
        label: `Feature added: ${feature.name}`,
        detail: feature.description,
        entityId: id,
      });
      continue;
    }
    const differences: string[] = [];
    const diffList = (name: string, left: string[], right: string[]) => {
      const gained = right.filter((item) => !left.includes(item));
      const lost = left.filter((item) => !right.includes(item));
      if (gained.length) differences.push(`now ${name} ${gained.join(', ')}`);
      if (lost.length) differences.push(`no longer ${name} ${lost.join(', ')}`);
    };
    diffList('writes', previous.writes, feature.writes);
    diffList('reads', previous.reads, feature.reads);
    diffList('calls', previous.externalServices, feature.externalServices);
    diffList('publishes', previous.emittedEvents, feature.emittedEvents);
    if (differences.length) {
      featuresChanged += 1;
      changes.push({
        kind: 'CHANGED', category: 'feature',
        label: `Feature changed: ${feature.name}`,
        detail: `${differences.join('; ')}.`,
        entityId: id,
      });
    }
  }
  for (const [id, feature] of beforeFeatures) {
    if (afterFeatures.has(id)) continue;
    changes.push({
      kind: 'REMOVED', category: 'feature',
      label: `Feature removed: ${feature.name}`,
      detail: feature.description,
      entityId: id,
    });
  }

  const architectureDelta = [
    ['domains', before.summary.domains, after.summary.domains],
    ['services', before.summary.services, after.summary.services],
    ['features', before.summary.features, after.summary.features],
  ] as const;
  for (const [label, from, to] of architectureDelta) {
    if (from === to) continue;
    changes.push({
      kind: 'CHANGED', category: 'architecture',
      label: `${label} ${to > from ? 'increased' : 'decreased'}: ${from} to ${to}`,
      detail: `The number of ${label} discovered changed between these two revisions.`,
      entityId: null,
    });
  }

  return {
    fromAnalysisId: before.id,
    toAnalysisId: after.id,
    fromRevision: before.revision ?? null,
    toRevision: after.revision ?? null,
    changes,
    summary: {
      entitiesAdded: addedIds.length,
      entitiesRemoved: removedIds.length,
      featuresAdded: [...afterFeatures.keys()].filter((id) => !beforeFeatures.has(id)).length,
      featuresRemoved: [...beforeFeatures.keys()].filter((id) => !afterFeatures.has(id)).length,
      featuresChanged,
      domainsAdded: countByType(addedIds, afterEntities, 'domain'),
      domainsRemoved: countByType(removedIds, beforeEntities, 'domain'),
      endpointsAdded: countByType(addedIds, afterEntities, 'endpoint'),
      endpointsRemoved: countByType(removedIds, beforeEntities, 'endpoint'),
      externalsAdded: countByType(addedIds, afterEntities, 'external_service'),
      externalsRemoved: countByType(removedIds, beforeEntities, 'external_service'),
    },
  };
}
