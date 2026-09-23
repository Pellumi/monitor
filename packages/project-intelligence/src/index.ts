import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RepositorySnapshotSummary } from '@tellann/desktop-contracts';
import {
  detectPythonFrameworks,
  discoverPythonProjects,
  extractPythonRoutes,
  parsePythonModule,
  findPythonEntryPoints,
  primaryEntryPoint,
  type PythonFrameworkEvidence,
  type PythonProject,
} from '@tellann/python-project';
import { extendGitIgnoreContext, isGitIgnored, type GitIgnoreContext } from './gitignore';
export * from './codebase';
export * from './flow-mapping';
export * from './annotation-source';

const IGNORED = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache',
  'vendor', '.venv', 'venv', 'env', '__pycache__', '.tox', '.nox', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', 'site-packages', 'target', 'bin', 'obj',
]);
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx', '.html', '.htm', '.yaml', '.yml', '.json']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.php', '.cs', '.java']);
const SECRET_FILE = /(^|[/\\])(\.env($|\.)|id_rsa|id_ed25519|.*\.pem$|.*\.key$)/i;
const ROUTE_PATTERN = /(?:path|route|href)\s*[:=]\s*['"`]([^'"`]+)['"`]/g;
const ENDPOINT_PATTERN = /(?:app|router|fastify)\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

function detectedApplicationUrls(
  root: string,
  packageScripts: Record<string, unknown>,
  frameworks: RepositorySnapshotSummary['frameworks'],
  routes: Set<string>,
): NonNullable<RepositorySnapshotSummary['suggestedApplicationUrls']> {
  const launchScript = ['dev', 'start', 'serve', 'preview']
    .map((name) => packageScripts[name])
    .find((script): script is string => typeof script === 'string');
  const explicitPort = launchScript?.match(/(?:--port(?:=|\s+)|(?:^|\s)-p\s+)(\d{2,5})(?:\s|$)/)?.[1];
  let configPort: string | undefined;
  for (const configName of ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']) {
    const configPath = path.join(root, configName);
    if (!fs.existsSync(configPath)) continue;
    configPort = fs.readFileSync(configPath, 'utf8').match(/\bport\s*:\s*(\d{2,5})\b/)?.[1];
    if (configPort) break;
  }
  const frameworkNames = new Set(frameworks.map((item) => item.framework));
  const defaultPort = frameworkNames.has('Vite') ? '5173'
    : frameworkNames.has('Next.js') || frameworkNames.has('React') || frameworkNames.has('Express') || frameworkNames.has('Fastify') || frameworkNames.has('NestJS')
      ? '3000'
      // Each Python framework's own documented development port, so the
      // suggestion matches what `manage.py runserver` or `flask run` prints.
      : frameworkNames.has('Django') || frameworkNames.has('FastAPI') || frameworkNames.has('Starlette')
        ? '8000'
        : frameworkNames.has('Flask')
          ? '5000'
          : undefined;
  const port = explicitPort ?? configPort ?? defaultPort;
  if (!port) return [];
  const preferredRoute = ['/login', '/signin', '/sign-in'].find((candidate) => routes.has(candidate));
  const source = explicitPort ? 'package.json launch script'
    : configPort ? 'Vite server configuration'
      : `${frameworkNames.has('Vite') ? 'Vite' : [...frameworkNames][0] ?? 'framework'} default`;
  return [{
    url: `http://localhost:${port}${preferredRoute ?? ''}`,
    confidence: explicitPort || configPort ? 0.98 : 0.82,
    source,
  }];
}

/**
 * Dotted module path a Python entry-point file is imported as.
 *
 * `app/main.py` is `app.main`, and `shop/__init__.py` is `shop`, which is what
 * `uvicorn` and `flask --app` expect. A leading `src/` is dropped because it is
 * a layout convention, not an importable package.
 */
function pythonModulePath(file: string): string {
  const segments = file.replace(/\.py$/i, '').split('/');
  if (segments[segments.length - 1] === '__init__') segments.pop();
  if (segments[0] === 'src') segments.shift();
  return segments.join('.');
}

/**
 * How to start each detected Python project in development.
 *
 * Only the framework's own documented development command is offered, with no
 * shell and no arguments taken from the repository, so approving a launch
 * approves a known command shape rather than whatever a manifest happened to
 * contain. The desktop launcher re-validates the same shapes before spawning.
 */
function pythonLaunchCommands(
  resolvedRoot: string,
  projects: PythonProject[],
  frameworks: PythonFrameworkEvidence[],
): NonNullable<RepositorySnapshotSummary['launchCommands']> {
  const commands: NonNullable<RepositorySnapshotSummary['launchCommands']> = [];
  const executable = process.platform === 'win32' ? 'python.exe' : 'python3';
  const detected = new Set(frameworks.map((item) => item.id));

  for (const project of projects.slice(0, 5)) {
    const directory = path.join(resolvedRoot, ...(project.root === '.' ? [] : project.root.split('/')));
    const cwd = project.root;

    if (fs.existsSync(path.join(directory, 'manage.py'))) {
      commands.push({
        id: `python-django:${cwd}`,
        label: 'python manage.py runserver',
        executable,
        args: ['manage.py', 'runserver'],
        cwd,
        scriptName: 'runserver',
        runtime: 'python',
      });
      continue;
    }

    if (!detected.has('fastapi') && !detected.has('flask') && !detected.has('starlette')) continue;

    let entryPoints;
    try {
      entryPoints = findPythonEntryPoints(directory);
    } catch {
      continue;
    }

    const asgi = primaryEntryPoint(entryPoints, ['fastapi-app', 'starlette-app']);
    if (asgi?.symbol) {
      const target = `${pythonModulePath(asgi.file)}:${asgi.symbol}`;
      commands.push({
        id: `python-uvicorn:${cwd}`,
        label: `python -m uvicorn ${target} --reload`,
        executable,
        args: ['-m', 'uvicorn', target, '--reload'],
        cwd,
        scriptName: 'uvicorn',
        runtime: 'python',
      });
      continue;
    }

    const flask = primaryEntryPoint(entryPoints, ['flask-app', 'flask-factory']);
    if (flask) {
      const target = pythonModulePath(flask.file);
      commands.push({
        id: `python-flask:${cwd}`,
        label: `python -m flask --app ${target} run`,
        executable,
        args: ['-m', 'flask', '--app', target, 'run'],
        cwd,
        scriptName: 'flask',
        runtime: 'python',
      });
    }
  }

  return commands;
}

type ScanOptions = {
  workspaceId: string;
  scannerVersion?: string;
  maxFiles?: number;
  maxFileBytes?: number;
  /** QA review branch from the application policy, used to measure divergence. */
  upstreamBranch?: string | null;
};

// Ref names reach the scanner from the application's branch policy, so they are
// server-controlled input. execFileSync takes an argv array (no shell), but a
// value like "--upload-pack=..." would still be read by git as an option.
const SAFE_REF = /^(?!-)(?!.*\.\.)[A-Za-z0-9._\/-]{1,200}$/;

export function isSafeBranchName(value: string): boolean {
  return SAFE_REF.test(value) && !value.endsWith('/') && !value.endsWith('.lock');
}

/**
 * How far this checkout has drifted from the shared QA branch. Returns nulls
 * rather than throwing when there is no upstream to compare against (no remote,
 * offline, branch never pushed) - an unknown answer is not a violation.
 */
function divergenceFrom(root: string, upstreamBranch: string | null | undefined) {
  const unknown = { upstreamBranch: null, aheadCount: null, behindCount: null };
  if (!upstreamBranch || !isSafeBranchName(upstreamBranch)) return unknown;
  const upstreamRef = `refs/remotes/origin/${upstreamBranch}`;
  if (!git(root, ['rev-parse', '--verify', '--quiet', upstreamRef])) return unknown;
  const counts = git(root, ['rev-list', '--left-right', '--count', `${upstreamRef}...HEAD`]);
  const [behind, ahead] = (counts ?? '').split(/[ \t]+/).map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(behind) || !Number.isFinite(ahead)) return unknown;
  return { upstreamBranch, aheadCount: ahead, behindCount: behind };
}

function hash(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5_000,
    }).trim() || null;
  } catch {
    return null;
  }
}

const MANIFEST_NAMES = ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb', 'pyproject.toml', 'requirements.txt'];

function manifestHashesOf(resolvedRoot: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const name of MANIFEST_NAMES) {
    const target = path.join(resolvedRoot, name);
    if (fs.existsSync(target)) hashes[name] = hash(fs.readFileSync(target));
  }
  return hashes;
}

/** Bounds on hashing dirty file contents, so a huge rebase stays cheap to identify. */
const HASHED_DIRTY_FILE_LIMIT = 500;
const HASHED_DIRTY_FILE_BYTES = 2_000_000;

function manifestIdentityOf(hashes: Record<string, string>): string {
  return Object.entries(hashes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}:${digest}`)
    // A NUL separator, written as a code point so no control character has to sit in this file.
    .join(String.fromCharCode(0));
}

/**
 * What the working tree looks like right now, including uncommitted edits.
 *
 * `repositoryFingerprint` folds in the revision, so at a single commit it is the
 * same value for every possible set of local changes. Anything that needs to
 * know whether a checkout is still the one it looked at before therefore cannot
 * use it, and the only safe fallback was "a dirty checkout is never the same" —
 * which meant a developer with uncommitted work re-analysed constantly.
 *
 * The porcelain status names every changed path; size and mtime catch a further
 * edit to a path that was already dirty. Cost is one `git status` and one stat
 * per changed file, so this is cheap enough to ask on demand rather than
 * trusting a snapshot taken when the folder was first attached.
 */
export function workingTreeIdentity(
  root: string,
  revision?: string | null,
  manifestIdentity?: string | null,
  status?: string | null,
): string {
  const resolvedRoot = path.resolve(root);
  const porcelain = status ?? git(resolvedRoot, ['status', '--porcelain']) ?? '';
  const head = revision !== undefined ? revision : git(resolvedRoot, ['rev-parse', 'HEAD']);
  // Derived here when the caller has not already computed it. Getting this wrong
  // is invisible in isolation and total in effect: a value that disagrees with
  // the one the scan recorded makes every launch look like a changed tree.
  const manifests = manifestIdentity ?? manifestIdentityOf(manifestHashesOf(resolvedRoot));
  const dirtyPaths = porcelain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // A porcelain line is a one or two character status, whitespace, then the
    // path. Taking it by column would be simpler, but the git helper trims its
    // output — so a leading-space status like " M app.js" arrives one character
    // short and a fixed offset eats into the filename instead of the status.
    .map((line) => line.replace(/^\S{1,2}\s+/, ''))
    // A rename reads "old -> new"; the new path is the one on disk.
    .map((entry) => (entry.includes(' -> ') ? entry.slice(entry.indexOf(' -> ') + 4) : entry))
    .map((entry) => entry.replace(/^"|"$/g, ''))
    .filter(Boolean)
    .sort();
  const stamps = dirtyPaths.map((relative, index) => {
    try {
      const target = path.join(resolvedRoot, relative);
      const stats = fs.statSync(target);
      if (!stats.isFile()) return `${relative}:dir`;
      // Content, not size and mtime. Editing `1` to `2` keeps the size, and two
      // writes in the same millisecond keep the mtime, so a stamp built from
      // those can miss a real change. It also cuts the other way: a checkout or
      // a formatter that rewrites a file without changing it would have looked
      // like a different tree and forced a needless re-analysis.
      if (index < HASHED_DIRTY_FILE_LIMIT && stats.size <= HASHED_DIRTY_FILE_BYTES) {
        return `${relative}:${hash(fs.readFileSync(target))}`;
      }
      // Past those bounds reading every file stops being cheap, and size with
      // mtime is the honest approximation.
      return `${relative}:${stats.size}:${Math.trunc(stats.mtimeMs)}`;
    } catch {
      // Deleted since `git status` ran, which is itself part of the state.
      return `${relative}:missing`;
    }
  });
  return hash(`${head ?? ''}\0${manifests}\0${stamps.join('\n')}`);
}

function githubRemote(remote: string | null): { originHash: string; cloneUrl: string } | null {
  if (!remote) return null;
  const scpMatch = remote.match(/^git@github\.com:([^/\s]+)\/([^\s]+?)(?:\.git)?$/i);
  if (scpMatch) {
    const identity = `github.com/${scpMatch[1].toLowerCase()}/${scpMatch[2].toLowerCase()}`;
    return { originHash: hash(identity), cloneUrl: `https://${identity}.git` };
  }
  try {
    const parsed = new URL(remote);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
    if (parts.length !== 2 || parts.some((part) => !part)) return null;
    const identity = `github.com/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
    return { originHash: hash(identity), cloneUrl: `https://${identity}.git` };
  } catch {
    return null;
  }
}

export function scanWorkspace(root: string, options: ScanOptions): RepositorySnapshotSummary {
  const resolvedRoot = fs.realpathSync.native(root);
  const files: string[] = [];
  let excludedFiles = 0;
  let suspectedSecrets = 0;
  const maxFiles = options.maxFiles ?? 20_000;
  const maxFileBytes = options.maxFileBytes ?? 512_000;

  const visit = (directory: string, inheritedIgnore: GitIgnoreContext = []) => {
    const ignoreContext = extendGitIgnoreContext(resolvedRoot, directory, inheritedIgnore);
    if (files.length >= maxFiles) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;
      if (IGNORED.has(entry.name)) {
        excludedFiles += 1;
        continue;
      }
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(resolvedRoot, absolute).replaceAll('\\', '/');
      if (isGitIgnored(relative, entry.isDirectory(), ignoreContext)) {
        excludedFiles += 1;
        continue;
      }
      if (entry.isSymbolicLink()) {
        excludedFiles += 1;
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute, ignoreContext);
        continue;
      }
      if (SECRET_FILE.test(relative)) {
        suspectedSecrets += 1;
        excludedFiles += 1;
        continue;
      }
      const stat = fs.statSync(absolute);
      if (stat.size > maxFileBytes) {
        excludedFiles += 1;
        continue;
      }
      files.push(relative);
    }
  };
  visit(resolvedRoot);

  const packageJsonPath = path.join(resolvedRoot, 'package.json');
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<string, any>
    : null;
  const dependencies = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  const frameworks: RepositorySnapshotSummary['frameworks'] = [];
  const addFramework = (framework: string, packageName: string, evidence: string[]) => {
    if (dependencies[packageName]) {
      frameworks.push({ framework, version: String(dependencies[packageName]), confidence: 0.98, evidence });
    }
  };
  addFramework('Next.js', 'next', ['package.json dependency: next']);
  addFramework('React', 'react', ['package.json dependency: react']);
  addFramework('Vite', 'vite', ['package.json dependency: vite']);
  addFramework('Express', 'express', ['package.json dependency: express']);
  addFramework('Fastify', 'fastify', ['package.json dependency: fastify']);
  addFramework('NestJS', '@nestjs/core', ['package.json dependency: @nestjs/core']);
  addFramework('Remix', '@remix-run/react', ['package.json dependency: @remix-run/react']);
  addFramework('SvelteKit', '@sveltejs/kit', ['package.json dependency: @sveltejs/kit']);
  addFramework('Nuxt', 'nuxt', ['package.json dependency: nuxt']);
  addFramework('Astro', 'astro', ['package.json dependency: astro']);
  addFramework('Angular', '@angular/core', ['package.json dependency: @angular/core']);
  addFramework('Koa', 'koa', ['package.json dependency: koa']);
  addFramework('Hapi', '@hapi/hapi', ['package.json dependency: @hapi/hapi']);

  // Python projects declare themselves in a different manifest, and often in
  // several at once, so the whole tree is asked rather than one file read.
  const pythonProjects = discoverPythonProjects(resolvedRoot, { maxDepth: 3 });
  const pythonFrameworks: PythonFrameworkEvidence[] = [];
  for (const project of pythonProjects) {
    const directory = path.join(resolvedRoot, ...(project.root === '.' ? [] : project.root.split('/')));
    for (const detected of detectPythonFrameworks(project, directory)) {
      if (pythonFrameworks.some((item) => item.id === detected.id)) continue;
      pythonFrameworks.push(detected);
      frameworks.push({
        framework: detected.label,
        version: detected.version ?? detected.specifier ?? 'unknown',
        confidence: detected.confidence,
        evidence: project.root === '.'
          ? detected.evidence
          : detected.evidence.map((item) => `${project.root}: ${item}`),
      });
    }
  }

  const routes = new Set<string>();
  const endpoints = new Set<string>();
  const languages = new Set<string>();
  const documentation: string[] = [];
  for (const relative of files) {
    const extension = path.extname(relative).toLowerCase();
    if (DOC_EXTENSIONS.has(extension) && /(^|\/)(docs?|readme|requirements?)(\/|\.|$)/i.test(relative)) {
      documentation.push(relative);
    }
    if (!SOURCE_EXTENSIONS.has(extension)) continue;
    languages.add(extension);
    const content = fs.readFileSync(path.join(resolvedRoot, relative), 'utf8');
    if (extension === '.py') {
      // The JavaScript regexes find nothing in Python - a decorated route has
      // no `app.get(` on the same line as its handler - so the module is read
      // structurally instead of scanned for a shape it never has.
      try {
        for (const route of extractPythonRoutes(parsePythonModule(content, relative))) {
          if (route.kind === 'django-view-method') continue;
          if (route.route.startsWith('/')) routes.add(route.route);
          endpoints.add(route.route);
        }
      } catch { /* an unreadable module contributes no routes, like any other */ }
      continue;
    }
    for (const match of content.matchAll(ROUTE_PATTERN)) {
      if (match[1].startsWith('/')) routes.add(match[1]);
    }
    for (const match of content.matchAll(ENDPOINT_PATTERN)) endpoints.add(match[1]);
  }

  const manifestHashes = manifestHashesOf(resolvedRoot);

  const nodePackageManager =
    fs.existsSync(path.join(resolvedRoot, 'pnpm-lock.yaml')) ? 'pnpm' :
    fs.existsSync(path.join(resolvedRoot, 'yarn.lock')) ? 'yarn' :
    fs.existsSync(path.join(resolvedRoot, 'bun.lockb')) ? 'bun' :
    fs.existsSync(path.join(resolvedRoot, 'package-lock.json')) ? 'npm' :
    packageJson ? 'npm' : null;
  // A repository can hold both ecosystems. The reported manager is the one that
  // installs the application being connected, so a Node manager wins when there
  // is one and the Python project's own manager is named otherwise - `pip`,
  // `poetry` or `uv`, never the useless catch-all `python`.
  const rootPythonProject = pythonProjects.find((project) => project.root === '.') ?? pythonProjects[0] ?? null;
  const packageManager = nodePackageManager ?? rootPythonProject?.manager ?? null;
  const packageScripts = packageJson?.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts as Record<string, unknown>
    : {};
  const launchCommands = [
    ...(nodePackageManager
      ? ['dev', 'start', 'serve', 'preview']
        .filter((scriptName) => typeof packageScripts[scriptName] === 'string')
        .map((scriptName) => ({
          id: `package-script:${scriptName}`,
          label: `${nodePackageManager} run ${scriptName}`,
          executable: process.platform === 'win32' ? `${nodePackageManager}.cmd` : nodePackageManager,
          args: ['run', scriptName],
          cwd: '.',
          scriptName,
          runtime: 'node' as const,
        }))
      : []),
    ...pythonLaunchCommands(resolvedRoot, pythonProjects, pythonFrameworks),
  ];
  const suggestedApplicationUrls = detectedApplicationUrls(resolvedRoot, packageScripts, frameworks, routes);
  const revision = git(resolvedRoot, ['rev-parse', 'HEAD']);
  const branch = git(resolvedRoot, ['branch', '--show-current']);
  const status = git(resolvedRoot, ['status', '--porcelain']);
  const remote = githubRemote(git(resolvedRoot, ['remote', 'get-url', 'origin']));
  const portableManifestIdentity = manifestIdentityOf(manifestHashes);

  const divergence = divergenceFrom(resolvedRoot, options.upstreamBranch);

  const workingTreeHash = workingTreeIdentity(resolvedRoot, revision, portableManifestIdentity, status);

  return {
    workspaceId: options.workspaceId,
    revision,
    branch,
    dirty: Boolean(status),
    repositoryFingerprint: hash(`${revision ?? ''}\0${portableManifestIdentity}`),
    // repositoryFingerprint folds in the revision above, so it changes on every
    // commit and cannot identify a repository across teammates. This one can.
    portableManifestIdentity: hash(portableManifestIdentity),
    repositoryOriginHash: remote?.originHash ?? null,
    repositoryCloneUrl: remote?.cloneUrl ?? null,
    languages: [...languages].sort(),
    packageManager,
    launchCommands,
    suggestedApplicationUrls,
    frameworks,
    routes: [...routes].sort().slice(0, 2_000),
    endpoints: [...endpoints].sort().slice(0, 2_000),
    documentation: documentation.sort().slice(0, 2_000),
    manifestHashes,
    workingTreeHash,
    scannerVersion: options.scannerVersion ?? '0.1.0',
    redactionSummary: { excludedFiles, suspectedSecrets },
    upstreamBranch: divergence.upstreamBranch,
    aheadCount: divergence.aheadCount,
    behindCount: divergence.behindCount,
  };
}
