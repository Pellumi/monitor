import fs from 'node:fs';
import path from 'node:path';
import { parseToml, tomlPath, type TomlTable, type TomlValue } from './toml';
import { resolvePinnedVersion } from './version';

/**
 * Where a Python project declares itself.
 *
 * Unlike `package.json`, Python has no single manifest: the same project may
 * pin in `requirements.txt`, describe itself in `pyproject.toml` and lock in
 * `poetry.lock`, and all three are normal. Detection therefore reads every
 * manifest it finds in a directory and merges them, rather than picking one and
 * calling a project unsupported when it used a different convention.
 */
export type PythonManifestKind =
  | 'pyproject' | 'requirements' | 'pipfile' | 'setup-py' | 'setup-cfg' | 'conda';

export type PythonPackageManager = 'poetry' | 'uv' | 'pipenv' | 'conda' | 'pdm' | 'pip';

export type PythonDependency = {
  /** PEP 503 normalized distribution name, e.g. `djangorestframework`. */
  name: string;
  /** The raw specifier as written, e.g. `>=4.2,<6` or `^0.110`. */
  specifier: string;
  /** Best concrete version the specifier implies, for support checks. */
  resolved: string | null;
  /** Declared under a dev/test/optional group rather than as a runtime need. */
  development: boolean;
  source: PythonManifestKind;
};

export type PythonProject = {
  /** Repository-relative, forward-slashed. `.` for the repository root. */
  root: string;
  name: string;
  manifests: Array<{ kind: PythonManifestKind; path: string }>;
  manager: PythonPackageManager;
  dependencies: Record<string, PythonDependency>;
  /** `requires-python`, when the project states one. */
  requiresPython: string | null;
};

const SKIPPED_DIRECTORIES = new Set([
  '.git', 'node_modules', '.venv', 'venv', 'env', '__pycache__', '.tox', '.nox',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', 'site-packages', 'dist', 'build',
  '.eggs', '.next', '.turbo', 'htmlcov', '.idea', '.vscode',
]);

/** PEP 503 name normalization: the only way two spellings compare equal. */
export function normalizeDistribution(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, '-');
}

const REQUIREMENT_LINE =
  /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*([^;#]*?)\s*(?:;.*)?$/;

/**
 * One line of a `requirements.txt`. Returns null for options (`-r`, `--index-url`),
 * URLs, VCS references and blank or comment lines, all of which are common and
 * none of which name a version this reader can use.
 */
export function parseRequirementLine(line: string): { name: string; specifier: string } | null {
  const withoutComment = line.replace(/\s+#.*$/, '').trim();
  if (!withoutComment || withoutComment.startsWith('#') || withoutComment.startsWith('-')) return null;
  if (/^[a-z+]+:\/\//i.test(withoutComment) || withoutComment.includes('@ ')) {
    // `name @ https://…` still names a distribution, just not a version.
    const direct = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*@/.exec(withoutComment);
    return direct ? { name: normalizeDistribution(direct[1]), specifier: '' } : null;
  }
  const match = REQUIREMENT_LINE.exec(withoutComment);
  if (!match) return null;
  return { name: normalizeDistribution(match[1]), specifier: (match[3] ?? '').trim() };
}

/**
 * Poetry's caret and tilde ranges, rewritten as a PEP 440 specifier set so one
 * comparison path serves every manifest style.
 */
export function normalizePoetrySpecifier(raw: string): string {
  const value = raw.trim();
  const caret = /^\^\s*(\d+(?:\.\d+)*)/.exec(value);
  if (caret) {
    const parts = caret[1].split('.').map(Number);
    const upper = parts[0] > 0
      ? [parts[0] + 1, 0, 0]
      : parts[1] !== undefined && parts[1] > 0
        ? [0, parts[1] + 1, 0]
        : [0, (parts[1] ?? 0), (parts[2] ?? 0) + 1];
    return `>=${caret[1]},<${upper.join('.')}`;
  }
  const tilde = /^~\s*(\d+(?:\.\d+)*)$/.exec(value);
  if (tilde) {
    const parts = tilde[1].split('.').map(Number);
    const upper = parts.length >= 2 ? [parts[0], parts[1] + 1, 0] : [parts[0] + 1, 0, 0];
    return `>=${tilde[1]},<${upper.join('.')}`;
  }
  if (value === '*' || value === '') return '';
  return value;
}

function dependencyOf(
  name: string,
  specifier: string,
  development: boolean,
  source: PythonManifestKind,
): PythonDependency {
  const normalizedSpecifier = normalizePoetrySpecifier(specifier);
  return {
    name: normalizeDistribution(name),
    specifier: normalizedSpecifier,
    resolved: resolvePinnedVersion(normalizedSpecifier),
    development,
    source,
  };
}

/** Poetry and Pipenv both allow `{ version = "…", extras = […] }` entries. */
function specifierFromTableEntry(value: TomlValue): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const version = (value as TomlTable).version;
    if (typeof version === 'string') return version;
  }
  return '';
}

function collectPyproject(file: string, into: Record<string, PythonDependency>): { name: string | null; requiresPython: string | null; manager: PythonPackageManager | null } {
  let table: TomlTable;
  try {
    table = parseToml(fs.readFileSync(file, 'utf8'));
  } catch {
    return { name: null, requiresPython: null, manager: null };
  }

  const add = (name: string, specifier: string, development: boolean) => {
    const dependency = dependencyOf(name, specifier, development, 'pyproject');
    const existing = into[dependency.name];
    // A runtime pin outranks the same distribution listed in a dev group.
    if (!existing || (existing.development && !development)) into[dependency.name] = dependency;
  };

  const readRequirementArray = (value: TomlValue | undefined, development: boolean) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const parsed = parseRequirementLine(item);
      if (parsed) add(parsed.name, parsed.specifier, development);
    }
  };

  // PEP 621
  readRequirementArray(tomlPath(table, 'project', 'dependencies'), false);
  const optional = tomlPath(table, 'project', 'optional-dependencies');
  if (optional && typeof optional === 'object' && !Array.isArray(optional)) {
    for (const group of Object.values(optional as TomlTable)) readRequirementArray(group, true);
  }
  readRequirementArray(tomlPath(table, 'dependency-groups', 'dev'), true);
  readRequirementArray(tomlPath(table, 'tool', 'uv', 'dev-dependencies'), true);
  readRequirementArray(tomlPath(table, 'tool', 'pdm', 'dev-dependencies'), true);

  // Poetry
  const poetryDependencies = tomlPath(table, 'tool', 'poetry', 'dependencies');
  if (poetryDependencies && typeof poetryDependencies === 'object' && !Array.isArray(poetryDependencies)) {
    for (const [name, value] of Object.entries(poetryDependencies as TomlTable)) {
      if (normalizeDistribution(name) === 'python') continue;
      add(name, specifierFromTableEntry(value), false);
    }
  }
  const poetryGroups = tomlPath(table, 'tool', 'poetry', 'group');
  if (poetryGroups && typeof poetryGroups === 'object' && !Array.isArray(poetryGroups)) {
    for (const group of Object.values(poetryGroups as TomlTable)) {
      const groupDependencies = tomlPath(group as TomlTable, 'dependencies');
      if (!groupDependencies || typeof groupDependencies !== 'object' || Array.isArray(groupDependencies)) continue;
      for (const [name, value] of Object.entries(groupDependencies as TomlTable)) {
        if (normalizeDistribution(name) === 'python') continue;
        add(name, specifierFromTableEntry(value), true);
      }
    }
  }
  const poetryDev = tomlPath(table, 'tool', 'poetry', 'dev-dependencies');
  if (poetryDev && typeof poetryDev === 'object' && !Array.isArray(poetryDev)) {
    for (const [name, value] of Object.entries(poetryDev as TomlTable)) {
      if (normalizeDistribution(name) === 'python') continue;
      add(name, specifierFromTableEntry(value), true);
    }
  }

  const projectName = tomlPath(table, 'project', 'name') ?? tomlPath(table, 'tool', 'poetry', 'name');
  const requiresPython = tomlPath(table, 'project', 'requires-python')
    ?? specifierFromTableEntry(tomlPath(table, 'tool', 'poetry', 'dependencies', 'python') ?? '');
  const buildBackend = tomlPath(table, 'build-system', 'build-backend');
  const manager: PythonPackageManager | null =
    typeof buildBackend === 'string' && buildBackend.includes('poetry') ? 'poetry'
    : tomlPath(table, 'tool', 'poetry') ? 'poetry'
    : tomlPath(table, 'tool', 'uv') ? 'uv'
    : tomlPath(table, 'tool', 'pdm') ? 'pdm'
    : null;

  return {
    name: typeof projectName === 'string' ? projectName : null,
    requiresPython: typeof requiresPython === 'string' && requiresPython ? requiresPython : null,
    manager,
  };
}

function collectRequirements(file: string, into: Record<string, PythonDependency>): void {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const development = /(dev|test|lint|docs)[^/\\]*\.txt$/i.test(path.basename(file));
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseRequirementLine(line);
    if (!parsed) continue;
    const dependency = dependencyOf(parsed.name, parsed.specifier, development, 'requirements');
    const existing = into[dependency.name];
    if (!existing || (existing.development && !development)) into[dependency.name] = dependency;
  }
}

function collectPipfile(file: string, into: Record<string, PythonDependency>): void {
  let table: TomlTable;
  try {
    table = parseToml(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  for (const [section, development] of [['packages', false], ['dev-packages', true]] as const) {
    const group = tomlPath(table, section);
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    for (const [name, value] of Object.entries(group as TomlTable)) {
      const specifier = specifierFromTableEntry(value);
      const dependency = dependencyOf(name, specifier === '*' ? '' : specifier, development, 'pipfile');
      const existing = into[dependency.name];
      if (!existing || (existing.development && !development)) into[dependency.name] = dependency;
    }
  }
}

const SETUP_REQUIRES = /install_requires\s*=\s*\[([\s\S]*?)\]/;

function collectSetupPy(file: string, into: Record<string, PythonDependency>): void {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const match = SETUP_REQUIRES.exec(text);
  if (!match) return;
  for (const literal of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
    const parsed = parseRequirementLine(literal[1]);
    if (!parsed) continue;
    const dependency = dependencyOf(parsed.name, parsed.specifier, false, 'setup-py');
    if (!into[dependency.name]) into[dependency.name] = dependency;
  }
}

function collectSetupCfg(file: string, into: Record<string, PythonDependency>): void {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const section = /\n\s*install_requires\s*=\s*\n((?:[ \t]+.*\n?)+)/.exec(`\n${text}`);
  if (!section) return;
  for (const line of section[1].split(/\r?\n/)) {
    const parsed = parseRequirementLine(line);
    if (!parsed) continue;
    const dependency = dependencyOf(parsed.name, parsed.specifier, false, 'setup-cfg');
    if (!into[dependency.name]) into[dependency.name] = dependency;
  }
}

function collectConda(file: string, into: Record<string, PythonDependency>): void {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  // `dependencies:` holds `- name=version` entries and an optional nested pip list.
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*-\s+([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:[=<>!~]=?\s*([^\s#]+))?\s*$/.exec(line);
    if (!match) continue;
    const name = normalizeDistribution(match[1]);
    if (name === 'python' || name === 'pip') continue;
    const dependency = dependencyOf(name, match[2] ? `==${match[2]}` : '', false, 'conda');
    if (!into[dependency.name]) into[dependency.name] = dependency;
  }
}

const MANIFEST_MATCHERS: Array<{ kind: PythonManifestKind; test: (base: string) => boolean }> = [
  { kind: 'pyproject', test: (base) => base === 'pyproject.toml' },
  { kind: 'requirements', test: (base) => /^requirements(-[a-z0-9._-]+)?\.txt$/i.test(base) },
  { kind: 'pipfile', test: (base) => base === 'pipfile' },
  { kind: 'setup-py', test: (base) => base === 'setup.py' },
  { kind: 'setup-cfg', test: (base) => base === 'setup.cfg' },
  { kind: 'conda', test: (base) => base === 'environment.yml' || base === 'environment.yaml' },
];

/** True when this directory looks like the root of a Python project. */
function manifestsIn(directory: string): Array<{ kind: PythonManifestKind; path: string }> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: Array<{ kind: PythonManifestKind; path: string }> = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const base = entry.name.toLowerCase();
    const matcher = MANIFEST_MATCHERS.find((item) => item.test(base));
    if (matcher) found.push({ kind: matcher.kind, path: path.join(directory, entry.name) });
  }
  return found;
}

function managerFor(directory: string, declared: PythonPackageManager | null, manifests: Array<{ kind: PythonManifestKind }>): PythonPackageManager {
  const has = (name: string) => fs.existsSync(path.join(directory, name));
  if (has('uv.lock')) return 'uv';
  if (has('poetry.lock')) return 'poetry';
  if (has('pdm.lock')) return 'pdm';
  if (has('Pipfile.lock') || manifests.some((item) => item.kind === 'pipfile')) return 'pipenv';
  if (declared) return declared;
  if (manifests.some((item) => item.kind === 'conda')) return 'conda';
  return 'pip';
}

export type DiscoverPythonProjectsOptions = {
  /** How deep below the root to look for nested Python projects. */
  maxDepth?: number;
  maxProjects?: number;
};

/**
 * Every Python project rooted at or below `root`.
 *
 * A directory counts when it holds a manifest, or when it holds the file that
 * makes a framework's layout unambiguous - `manage.py` for Django. Django
 * projects generated by `startproject` frequently have no manifest at all, and
 * refusing to see them would exclude the single most common Django layout.
 */
export function discoverPythonProjects(
  root: string,
  options: DiscoverPythonProjectsOptions = {},
): PythonProject[] {
  const maxDepth = options.maxDepth ?? 4;
  const maxProjects = options.maxProjects ?? 50;
  const projects: PythonProject[] = [];

  const visit = (directory: string, depth: number) => {
    if (projects.length >= maxProjects || depth > maxDepth) return;
    const manifests = manifestsIn(directory);
    const hasDjangoEntry = fs.existsSync(path.join(directory, 'manage.py'));
    if (manifests.length || hasDjangoEntry) {
      const dependencies: Record<string, PythonDependency> = {};
      let declaredName: string | null = null;
      let requiresPython: string | null = null;
      let declaredManager: PythonPackageManager | null = null;
      for (const manifest of manifests) {
        if (manifest.kind === 'pyproject') {
          const info = collectPyproject(manifest.path, dependencies);
          declaredName ??= info.name;
          requiresPython ??= info.requiresPython;
          declaredManager ??= info.manager;
        }
        if (manifest.kind === 'requirements') collectRequirements(manifest.path, dependencies);
        if (manifest.kind === 'pipfile') collectPipfile(manifest.path, dependencies);
        if (manifest.kind === 'setup-py') collectSetupPy(manifest.path, dependencies);
        if (manifest.kind === 'setup-cfg') collectSetupCfg(manifest.path, dependencies);
        if (manifest.kind === 'conda') collectConda(manifest.path, dependencies);
      }
      const relative = path.relative(root, directory).replaceAll('\\', '/') || '.';
      projects.push({
        root: relative,
        name: declaredName ?? path.basename(directory),
        manifests: manifests.map((item) => ({
          kind: item.kind,
          path: path.relative(root, item.path).replaceAll('\\', '/'),
        })),
        manager: managerFor(directory, declaredManager, manifests),
        dependencies,
        requiresPython,
      });
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
      visit(path.join(directory, entry.name), depth + 1);
    }
  };

  visit(root, 0);
  return projects;
}

/** Install command for one distribution under the project's package manager. */
export function pythonInstallCommand(manager: PythonPackageManager, distribution: string): string {
  switch (manager) {
    case 'poetry': return `poetry add ${distribution}`;
    case 'uv': return `uv add ${distribution}`;
    case 'pdm': return `pdm add ${distribution}`;
    case 'pipenv': return `pipenv install ${distribution}`;
    case 'conda': return `python -m pip install ${distribution}`;
    default: return `python -m pip install ${distribution}`;
  }
}
