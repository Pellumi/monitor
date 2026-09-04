import fs from 'node:fs';
import path from 'node:path';
import { digest, slash } from './core';

export const IGNORED_DIRECTORIES = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo',
  '.cache', 'vendor', '.venv', 'venv', '__pycache__', 'target', 'obj', '.svelte-kit',
  '.nuxt', '.output', '.parcel-cache', '.yarn', '.pnpm-store', '.gradle', '.idea', '.vscode', '.claude', '.husky', '.changeset', 'storybook-static',
]);

/** Extensions the semantic analyzers understand end to end. */
export const ANALYZABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.java': 'Java', '.go': 'Go', '.rs': 'Rust', '.cs': 'C#',
  '.php': 'PHP', '.rb': 'Ruby', '.kt': 'Kotlin', '.swift': 'Swift', '.scala': 'Scala',
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++', '.m': 'Objective-C',
  '.sql': 'SQL', '.prisma': 'Prisma', '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.css': 'CSS', '.scss': 'SCSS', '.less': 'Less', '.html': 'HTML', '.vue': 'Vue',
  '.svelte': 'Svelte', '.sh': 'Shell', '.bash': 'Shell', '.ps1': 'PowerShell',
  '.yml': 'YAML', '.yaml': 'YAML', '.json': 'JSON', '.toml': 'TOML', '.md': 'Markdown',
};

const LANGUAGE_BY_FILENAME: Record<string, string> = {
  dockerfile: 'Dockerfile', makefile: 'Makefile', 'docker-compose.yml': 'YAML',
};

/**
 * Languages that carry application logic this analyzer cannot yet read. Only
 * these count as a coverage gap.
 *
 * Stylesheets, markup, config formats and shell scripts are deliberately absent:
 * they hold no symbols, calls, or side effects for the graph, so reporting them
 * as "not deeply analysed" would mark almost every web project incomplete for no
 * reason. Prisma and GraphQL are absent too, because their schemas are read.
 */
const DEEP_ANALYSIS_GAP_LANGUAGES = new Set([
  'Python', 'Java', 'Go', 'Rust', 'C#', 'PHP', 'Ruby', 'Kotlin', 'Swift',
  'Scala', 'C', 'C++', 'Objective-C', 'Vue', 'Svelte',
]);

/** Text we are willing to place in a cloud snapshot. */
const ARCHIVABLE = new Set([
  ...ANALYZABLE,
  '.json', '.md', '.mdx', '.txt', '.yaml', '.yml', '.toml', '.graphql', '.gql',
  '.prisma', '.sql', '.css', '.scss', '.less', '.html', '.vue', '.svelte', '.env.example',
]);

const ARCHIVABLE_FILENAMES = new Set(['dockerfile', 'makefile', 'procfile', '.env.example', '.nvmrc']);

/** Paths whose contents never leave the device, whatever they contain. */
const SECRET_PATH = /(^|\/)(\.env(\.[^/]*)?|\.npmrc|\.netrc|id_rsa|id_ed25519|.*\.(pem|key|p12|pfx|jks|keystore))$/i;

/**
 * Secret-shaped assignments. Used to redact the value in place rather than drop
 * the whole file: a config module that happens to contain one literal is still
 * the file that defines half the application's routes.
 */
const SECRET_ASSIGNMENT =
  /((?:api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|connection[_-]?string)\s*[:=]\s*)(['"`])([^'"`\n]{8,})\2/gi;

/** High-entropy provider credentials, matched on their published prefixes. */
const SECRET_LITERAL =
  /\b(sk-[A-Za-z0-9]{16,}|sk_live_[A-Za-z0-9]{16,}|rk_live_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;

export type ExclusionReason =
  | 'ignored-directory' | 'symlink' | 'secret-path' | 'oversized'
  /** An analyzable source file too large to read: a genuine coverage gap. */
  | 'oversized-source'
  | 'binary' | 'unreadable' | 'file-budget' | 'archive-budget';

export type InventoryFile = {
  /** Repository-relative, forward-slashed. */
  path: string;
  extension: string;
  language: string | null;
  bytes: number;
  analyzable: boolean;
  archivable: boolean;
  generated: boolean;
  test: boolean;
  configuration: boolean;
  documentation: boolean;
};

export type PackageBoundary = {
  /** Repository-relative directory, or "." for the root package. */
  root: string;
  name: string;
  kind: 'application' | 'service' | 'package';
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  private: boolean;
};

export type Inventory = {
  files: InventoryFile[];
  analyzable: string[];
  directories: string[];
  packages: PackageBoundary[];
  languageBytes: Record<string, number>;
  unsupportedLanguageFiles: Record<string, number>;
  exclusions: Record<ExclusionReason, number>;
  excludedTotal: number;
  truncated: boolean;
};

const GENERATED = /(^|\/)(generated|__generated__|\.generated|migrations)\//i;
const GENERATED_FILE = /\.(generated|gen)\.[cm]?[jt]sx?$/i;
const TEST_FILE = /(^|\/)(__tests__|tests?|e2e|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
const CONFIG_FILE =
  /(^|\/)(package\.json|tsconfig[^/]*\.json|.*\.config\.[cm]?[jt]s|pnpm-workspace\.yaml|docker-compose[^/]*\.ya?ml|Dockerfile|\.env\.example|turbo\.json|nest-cli\.json|next\.config\.[cm]?[jt]s)$/i;
const DOC_FILE = /\.(md|mdx|txt)$/i;

function classifyLanguage(relative: string, extension: string): string | null {
  const base = path.basename(relative).toLowerCase();
  return LANGUAGE_BY_FILENAME[base] ?? LANGUAGE_BY_EXTENSION[extension] ?? null;
}

function looksBinary(sample: Buffer): boolean {
  const limit = Math.min(sample.length, 4_096);
  for (let index = 0; index < limit; index += 1) if (sample[index] === 0) return true;
  return false;
}

function readManifest(file: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function packageKind(root: string, manifest: Record<string, any>): PackageBoundary['kind'] {
  if (root === '.') return 'application';
  if (/^(services|workers)\//i.test(root) || /(^|[-/])(api|worker|service|server|daemon)$/i.test(root)) return 'service';
  if (/^apps\//i.test(root)) return 'application';
  if (manifest.private === false || /^(packages|libs)\//i.test(root)) return 'package';
  return 'package';
}

export type InventoryOptions = {
  maxFiles?: number;
  maxFileBytes?: number;
};

/**
 * One pass over the working tree producing everything later stages need. Bounded
 * by an explicit file budget so a pathological repository degrades into a
 * reported truncation rather than an unbounded walk.
 */
export function buildInventory(root: string, options: InventoryOptions = {}): Inventory {
  const maxFiles = options.maxFiles ?? 60_000;
  const maxFileBytes = options.maxFileBytes ?? 1_500_000;
  const files: InventoryFile[] = [];
  const directories: string[] = [];
  const languageBytes: Record<string, number> = {};
  const unsupportedLanguageFiles: Record<string, number> = {};
  const exclusions: Record<ExclusionReason, number> = {
    'ignored-directory': 0, symlink: 0, 'secret-path': 0, oversized: 0,
    'oversized-source': 0, binary: 0, unreadable: 0, 'file-budget': 0, 'archive-budget': 0,
  };
  let truncated = false;
  const manifestPaths: string[] = [];

  const visit = (directory: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      exclusions.unreadable += 1;
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        exclusions['file-budget'] += 1;
        return;
      }
      if (entry.isSymbolicLink()) { exclusions.symlink += 1; continue; }
      const absolute = path.join(directory, entry.name);
      const relative = slash(path.relative(root, absolute));
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) { exclusions['ignored-directory'] += 1; continue; }
        directories.push(relative);
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SECRET_PATH.test(relative) && !relative.toLowerCase().endsWith('.env.example')) {
        exclusions['secret-path'] += 1;
        continue;
      }
      let bytes: number;
      try {
        bytes = fs.statSync(absolute).size;
      } catch {
        exclusions.unreadable += 1;
        continue;
      }
      const extension = path.extname(relative).toLowerCase();
      const base = path.basename(relative).toLowerCase();
      if (bytes > maxFileBytes) {
        // A source file we cannot read leaves a hole in the graph; an oversized
        // lockfile or asset does not.
        exclusions[ANALYZABLE.has(extension) ? 'oversized-source' : 'oversized'] += 1;
        continue;
      }
      const language = classifyLanguage(relative, extension);
      const analyzable = ANALYZABLE.has(extension);
      if (language) languageBytes[language] = (languageBytes[language] ?? 0) + bytes;
      if (!analyzable && language && DEEP_ANALYSIS_GAP_LANGUAGES.has(language)) {
        unsupportedLanguageFiles[language] = (unsupportedLanguageFiles[language] ?? 0) + 1;
      }
      if (base === 'package.json') manifestPaths.push(absolute);

      files.push({
        path: relative,
        extension,
        language,
        bytes,
        analyzable,
        archivable: ARCHIVABLE.has(extension) || ARCHIVABLE_FILENAMES.has(base),
        generated: GENERATED.test(relative) || GENERATED_FILE.test(relative),
        test: TEST_FILE.test(relative),
        configuration: CONFIG_FILE.test(relative),
        documentation: DOC_FILE.test(relative),
      });
    }
  };
  visit(root);
  files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const packages: PackageBoundary[] = [];
  for (const manifestPath of manifestPaths) {
    const manifest = readManifest(manifestPath);
    if (!manifest) continue;
    const relativeRoot = slash(path.relative(root, path.dirname(manifestPath))) || '.';
    packages.push({
      root: relativeRoot,
      name: typeof manifest.name === 'string' ? manifest.name : path.basename(path.dirname(manifestPath)),
      kind: packageKind(relativeRoot, manifest),
      dependencies: normalizeVersionMap(manifest.dependencies),
      devDependencies: normalizeVersionMap(manifest.devDependencies),
      scripts: normalizeVersionMap(manifest.scripts),
      private: manifest.private === true,
    });
  }
  packages.sort((left, right) => (left.root < right.root ? -1 : left.root > right.root ? 1 : 0));

  const excludedTotal = Object.values(exclusions).reduce((sum, value) => sum + value, 0);
  return {
    files,
    analyzable: files.filter((file) => file.analyzable && !file.generated).map((file) => file.path),
    directories: directories.sort(),
    packages,
    languageBytes,
    unsupportedLanguageFiles,
    exclusions,
    excludedTotal,
    truncated,
  };
}

function normalizeVersionMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') result[key] = item;
  }
  return result;
}

/**
 * Longest-prefix owner of a file. Precomputed against a prepared package list so
 * callers do not re-sort the boundary set per file.
 */
export function packageOwnerIndex(packages: PackageBoundary[]): (file: string) => string {
  const roots = packages.map((item) => item.root).sort((left, right) => right.length - left.length);
  const cache = new Map<string, string>();
  return (file: string) => {
    const directory = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.';
    const cached = cache.get(directory);
    if (cached !== undefined) return cached;
    const owner = roots.find((candidate) => candidate === '.' || directory === candidate || directory.startsWith(`${candidate}/`)) ?? '.';
    cache.set(directory, owner);
    return owner;
  };
}

export type RedactionOutcome = { content: string; redactions: number };

/**
 * Replace secret-shaped values while preserving the surrounding code. Returning
 * the file with its literals blanked keeps the analyzable structure intact,
 * which dropping the file entirely did not.
 */
export function redactSecrets(content: string): RedactionOutcome {
  let redactions = 0;
  let output = content.replace(SECRET_ASSIGNMENT, (_match, prefix: string, quote: string) => {
    redactions += 1;
    return `${prefix}${quote}[redacted]${quote}`;
  });
  output = output.replace(SECRET_LITERAL, () => {
    redactions += 1;
    return '[redacted]';
  });
  return { content: output, redactions };
}

export type ArchiveEntry = { path: string; sha256: string; contentBase64: string };
export type ArchiveExclusion = { path: string; reason: ExclusionReason };

export type ArchivePlan = {
  entries: ArchiveEntry[];
  excluded: ArchiveExclusion[];
  redactedFiles: number;
  redactions: number;
  uncompressedBytes: number;
  truncated: boolean;
};

/**
 * Order files by how much they matter to analysis so that a repository which
 * exceeds the byte budget loses documentation before it loses source, instead of
 * losing whatever sorted last alphabetically.
 */
function archivePriority(file: InventoryFile): number {
  if (file.analyzable && !file.test && !file.generated) return 0;
  if (file.configuration) return 1;
  if (file.analyzable && file.test) return 2;
  if (file.extension === '.prisma' || file.extension === '.graphql' || file.extension === '.gql') return 1;
  if (file.analyzable) return 3;
  if (file.documentation) return 4;
  return 5;
}

export function planArchive(root: string, inventory: Inventory, maxBytes: number): ArchivePlan {
  const candidates = inventory.files
    .filter((file) => file.archivable)
    .sort((left, right) => archivePriority(left) - archivePriority(right)
      || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const entries: ArchiveEntry[] = [];
  const excluded: ArchiveExclusion[] = [];
  let uncompressedBytes = 0;
  let redactedFiles = 0;
  let redactions = 0;
  let truncated = false;

  for (const file of candidates) {
    let raw: Buffer;
    try {
      raw = fs.readFileSync(path.join(root, ...file.path.split('/')));
    } catch {
      excluded.push({ path: file.path, reason: 'unreadable' });
      continue;
    }
    if (looksBinary(raw)) {
      excluded.push({ path: file.path, reason: 'binary' });
      continue;
    }
    const redacted = redactSecrets(raw.toString('utf8'));
    if (redacted.redactions > 0) {
      redactedFiles += 1;
      redactions += redacted.redactions;
    }
    const content = Buffer.from(redacted.content, 'utf8');
    if (uncompressedBytes + content.byteLength > maxBytes) {
      truncated = true;
      excluded.push({ path: file.path, reason: 'archive-budget' });
      continue;
    }
    uncompressedBytes += content.byteLength;
    entries.push({ path: file.path, sha256: digest(content), contentBase64: content.toString('base64') });
  }

  entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return { entries, excluded, redactedFiles, redactions, uncompressedBytes, truncated };
}
