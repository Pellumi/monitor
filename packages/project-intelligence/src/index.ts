import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RepositorySnapshotSummary } from '@tellann/desktop-contracts';
export { analyzeCodebase, buildSanitizedSourceArchive, buildSanitizedSourceManifest } from './codebase-analysis';

const IGNORED = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache',
  'vendor', '.venv', 'venv', '__pycache__', 'target', 'bin', 'obj',
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

  const visit = (directory: string) => {
    if (files.length >= maxFiles) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;
      if (IGNORED.has(entry.name)) {
        excludedFiles += 1;
        continue;
      }
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        excludedFiles += 1;
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      const relative = path.relative(resolvedRoot, absolute).replaceAll('\\', '/');
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
    for (const match of content.matchAll(ROUTE_PATTERN)) {
      if (match[1].startsWith('/')) routes.add(match[1]);
    }
    for (const match of content.matchAll(ENDPOINT_PATTERN)) endpoints.add(match[1]);
  }

  const manifestNames = ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb', 'pyproject.toml', 'requirements.txt'];
  const manifestHashes: Record<string, string> = {};
  for (const name of manifestNames) {
    const target = path.join(resolvedRoot, name);
    if (fs.existsSync(target)) manifestHashes[name] = hash(fs.readFileSync(target));
  }

  const packageManager =
    fs.existsSync(path.join(resolvedRoot, 'pnpm-lock.yaml')) ? 'pnpm' :
    fs.existsSync(path.join(resolvedRoot, 'yarn.lock')) ? 'yarn' :
    fs.existsSync(path.join(resolvedRoot, 'bun.lockb')) ? 'bun' :
    fs.existsSync(path.join(resolvedRoot, 'package-lock.json')) ? 'npm' :
    fs.existsSync(path.join(resolvedRoot, 'pyproject.toml')) ? 'python' : null;
  const packageScripts = packageJson?.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts as Record<string, unknown>
    : {};
  const launchCommands = packageManager && ['pnpm', 'npm', 'yarn', 'bun'].includes(packageManager)
    ? ['dev', 'start', 'serve', 'preview']
      .filter((scriptName) => typeof packageScripts[scriptName] === 'string')
      .map((scriptName) => ({
        id: `package-script:${scriptName}`,
        label: `${packageManager} run ${scriptName}`,
        executable: process.platform === 'win32' ? `${packageManager}.cmd` : packageManager,
        args: ['run', scriptName],
        cwd: '.',
        scriptName,
      }))
    : [];
  const suggestedApplicationUrls = detectedApplicationUrls(resolvedRoot, packageScripts, frameworks, routes);
  const revision = git(resolvedRoot, ['rev-parse', 'HEAD']);
  const branch = git(resolvedRoot, ['branch', '--show-current']);
  const status = git(resolvedRoot, ['status', '--porcelain']);
  const remote = githubRemote(git(resolvedRoot, ['remote', 'get-url', 'origin']));
  const portableManifestIdentity = Object.entries(manifestHashes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, digest]) => `${name}:${digest}`)
    .join('\0');

  const divergence = divergenceFrom(resolvedRoot, options.upstreamBranch);

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
    scannerVersion: options.scannerVersion ?? '0.1.0',
    redactionSummary: { excludedFiles, suspectedSecrets },
    upstreamBranch: divergence.upstreamBranch,
    aheadCount: divergence.aheadCount,
    behindCount: divergence.behindCount,
  };
}
