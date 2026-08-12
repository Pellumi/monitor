import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { RepositorySnapshotSummary } from '@sots/desktop-contracts';

const IGNORED = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache',
  'vendor', '.venv', 'venv', '__pycache__', 'target', 'bin', 'obj',
]);
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx', '.html', '.htm', '.yaml', '.yml', '.json']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.php', '.cs', '.java']);
const SECRET_FILE = /(^|[/\\])(\.env($|\.)|id_rsa|id_ed25519|.*\.pem$|.*\.key$)/i;
const ROUTE_PATTERN = /(?:path|route|href)\s*[:=]\s*['"`]([^'"`]+)['"`]/g;
const ENDPOINT_PATTERN = /(?:app|router|fastify)\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

type ScanOptions = {
  workspaceId: string;
  scannerVersion?: string;
  maxFiles?: number;
  maxFileBytes?: number;
};

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
  const revision = git(resolvedRoot, ['rev-parse', 'HEAD']);
  const branch = git(resolvedRoot, ['branch', '--show-current']);
  const status = git(resolvedRoot, ['status', '--porcelain']);

  return {
    workspaceId: options.workspaceId,
    revision,
    branch,
    dirty: Boolean(status),
    repositoryFingerprint: hash(`${resolvedRoot}\0${revision ?? ''}\0${Object.values(manifestHashes).join(':')}`),
    languages: [...languages].sort(),
    packageManager,
    launchCommands,
    frameworks,
    routes: [...routes].sort().slice(0, 2_000),
    endpoints: [...endpoints].sort().slice(0, 2_000),
    documentation: documentation.sort().slice(0, 2_000),
    manifestHashes,
    scannerVersion: options.scannerVersion ?? '0.1.0',
    redactionSummary: { excludedFiles, suspectedSecrets },
  };
}
