import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import semver from 'semver';
import { Project, QuoteKind, SyntaxKind, type SourceFile } from 'ts-morph';
import { z } from 'zod';
import { resolveWithinWorkspace } from '@sots/agent-policy';
import type { FlowInitializationManifest, RepositorySnapshotSummary } from '@sots/desktop-contracts';

export const INSTRUMENTATION_CONTRACT_VERSION = '1.0';
export const INSTRUMENTATION_MANIFEST_VERSION = '1.0';

export const RiskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const OperationKindSchema = z.enum(['CREATE_FILE', 'UPDATE_SOURCE', 'UPDATE_PACKAGE']);
export const FrameworkIdSchema = z.enum(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']);
export const PlanStatusSchema = z.enum([
  'PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED',
  'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK',
]);

export type Risk = z.infer<typeof RiskSchema>;
export type FrameworkId = z.infer<typeof FrameworkIdSchema>;

export type StructuredCommand = {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  allowedEnvironmentKeys: string[];
  purpose: string;
  networkRequired: boolean;
};

export type LocalProjectContext = {
  workspaceRoot: string;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  snapshot: RepositorySnapshotSummary;
  instrumentationPurpose?: 'BOOTSTRAP' | 'FLOW';
  flowId?: string;
  flowVersionId?: string;
  flowInitializationId?: string;
  flowManifest?: FlowInitializationManifest;
};

export type DetectionResult = {
  adapterId: FrameworkId;
  adapterVersion: string;
  supported: boolean;
  confidence: number;
  frameworkVersion: string | null;
  supportedVersionRange: string;
  evidence: string[];
  reasons: string[];
};

export type AdapterEvidence = {
  entryPoints: Array<{ file: string; symbol: string | null; confidence: number }>;
  existingInstrumentation: Array<{ file: string; marker: string }>;
  semanticBoundaries: Array<{
    file: string;
    symbol: string | null;
    eventType: string;
    confidence: number;
    rationale: string;
  }>;
};

export type PatchOperation = {
  id: string;
  kind: z.infer<typeof OperationKindSchema>;
  relativePath: string;
  symbol: string | null;
  transformId: string;
  transformVersion: string;
  expectedHash: string | null;
  description: string;
  eventMappings: Array<{ eventType: string; expectedState: string | null; checkpointId?: string; stateId?: string | null; transitionId?: string | null; terminalKind?: string | null }>;
  content?: string;
  importModule?: string;
  flowInitializationId?: string;
};

export type InstrumentationPlan = {
  contractVersion: string;
  manifestVersion: string;
  id: string;
  taskKey: string;
  adapterId: FrameworkId;
  adapterVersion: string;
  frameworkVersion: string | null;
  supportedVersionRange: string;
  baseRevision: string | null;
  repositoryFingerprint: string;
  approvedFileScopes: string[];
  packageChanges: Array<{ packageName: string; version: string; kind: 'dependency' | 'devDependency' }>;
  operations: PatchOperation[];
  validationCommands: StructuredCommand[];
  networkRequirements: string[];
  risk: Risk;
  riskReasons: string[];
  evidence: AdapterEvidence;
  instrumentationPurpose: 'BOOTSTRAP' | 'FLOW';
  flowId: string | null;
  flowVersionId: string | null;
  flowInitializationId?: string | null;
  flowManifest?: FlowInitializationManifest | null;
  createdAt: string;
};

export type ApprovedInstrumentationTask = {
  plan: InstrumentationPlan;
  approvedFileScopes: string[];
  approvedCommandIds: string[];
  approvalHash: string;
  checkpointDirectory: string;
};

export type PatchFileResult = {
  relativePath: string;
  beforeHash: string | null;
  afterHash: string;
  changed: boolean;
};

export type PatchResult = {
  planId: string;
  checkpointId: string;
  checkpointDirectory: string;
  baseRevision: string | null;
  files: PatchFileResult[];
  changedFiles: string[];
  diff: string;
  diffHash: string;
  appliedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; output: string }>;
};

export type RollbackResult = {
  rolledBackFiles: string[];
  conflicts: Array<{ relativePath: string; reason: string }>;
  verified: boolean;
};

export interface InstrumentationAdapter {
  readonly id: FrameworkId;
  readonly version: string;
  readonly supportedVersionRange: string;
  detect(input: LocalProjectContext): DetectionResult;
  index(input: LocalProjectContext): Promise<AdapterEvidence>;
  propose(input: LocalProjectContext): Promise<InstrumentationPlan>;
  apply(input: LocalProjectContext, task: ApprovedInstrumentationTask): Promise<PatchResult>;
  validate(input: LocalProjectContext, result: PatchResult): Promise<ValidationResult>;
  rollback(input: LocalProjectContext, result: PatchResult): Promise<RollbackResult>;
}

const PLAN_SCHEMA = z.object({
  contractVersion: z.literal(INSTRUMENTATION_CONTRACT_VERSION),
  manifestVersion: z.literal(INSTRUMENTATION_MANIFEST_VERSION),
  id: z.string().uuid(),
  taskKey: z.string().min(32),
  adapterId: FrameworkIdSchema,
  adapterVersion: z.string(),
  frameworkVersion: z.string().nullable(),
  supportedVersionRange: z.string(),
  baseRevision: z.string().nullable(),
  repositoryFingerprint: z.string().min(32),
  approvedFileScopes: z.array(z.string()),
  packageChanges: z.array(z.object({ packageName: z.string(), version: z.string(), kind: z.enum(['dependency', 'devDependency']) })),
  operations: z.array(z.object({
    id: z.string(), kind: OperationKindSchema, relativePath: z.string(), symbol: z.string().nullable(), transformId: z.string(),
    transformVersion: z.string(), expectedHash: z.string().nullable(), description: z.string(),
    eventMappings: z.array(z.object({ eventType: z.string(), expectedState: z.string().nullable(), checkpointId: z.string().optional(), stateId: z.string().nullable().optional(), transitionId: z.string().nullable().optional(), terminalKind: z.string().nullable().optional() })),
    content: z.string().optional(), importModule: z.string().optional(), flowInitializationId: z.string().uuid().optional(),
  })),
  validationCommands: z.array(z.object({
    id: z.string(), executable: z.string(), args: z.array(z.string()), cwd: z.string(), timeoutMs: z.number(),
    allowedEnvironmentKeys: z.array(z.string()), purpose: z.string(), networkRequired: z.boolean(),
  })),
  networkRequirements: z.array(z.string()),
  risk: RiskSchema,
  riskReasons: z.array(z.string()),
  evidence: z.any(),
  instrumentationPurpose: z.enum(['BOOTSTRAP', 'FLOW']).default('BOOTSTRAP'),
  flowId: z.string().uuid().nullable().optional(),
  flowVersionId: z.string().uuid().nullable().optional(),
  flowInitializationId: z.string().uuid().nullable().optional(),
  flowManifest: z.any().nullable().optional(),
  createdAt: z.string(),
});

export function validateInstrumentationPlan(value: unknown): InstrumentationPlan {
  return PLAN_SCHEMA.parse(value) as InstrumentationPlan;
}

function hash(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeVersion(value: string | undefined): string | null {
  if (!value) return null;
  return semver.coerce(value)?.version ?? null;
}

function readJson(target: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, any>;
}

function relativeImport(from: string, to: string): string {
  const value = path.relative(path.dirname(from), to).replaceAll('\\', '/').replace(/\.[cm]?[jt]sx?$/, '');
  return value.startsWith('.') ? value : `./${value}`;
}

function isCommonJsEntry(root: string, relativePath: string): boolean {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === '.cjs') return true;
  if (['.ts', '.tsx', '.mts', '.mjs'].includes(extension)) return false;
  const source = fs.readFileSync(resolveWithinWorkspace(root, relativePath), 'utf8');
  if (/^\s*(?:import|export)\b/m.test(source)) return false;
  if (/\brequire\s*\(/.test(source)) return true;
  let directory = path.dirname(resolveWithinWorkspace(root, relativePath));
  const canonicalRoot = fs.realpathSync.native(root);
  while (directory.startsWith(canonicalRoot)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) return readJson(manifest).type !== 'module';
    if (directory === canonicalRoot) break;
    directory = path.dirname(directory);
  }
  return true;
}

function generatedFileFor(definition: AdapterDefinition, entryFile: string): string {
  const extension = path.extname(entryFile).toLowerCase();
  const typed = ['.ts', '.tsx', '.mts', '.cts'].includes(extension);
  if (definition.id === 'nextjs') return typed ? 'src/tellann.tsx' : 'src/tellann.js';
  if (definition.sdkPackage === '@sots/frontend-sdk') return typed ? 'src/tellann.ts' : 'src/tellann.js';
  if (extension === '.cjs') return 'src/tellann.cjs';
  if (extension === '.mjs') return 'src/tellann.mjs';
  return typed ? 'src/tellann.ts' : 'src/tellann.js';
}

function findSourceFiles(root: string, max = 5_000): string[] {
  const result: string[] = [];
  const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);
  const visit = (directory: string) => {
    if (result.length >= max) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) result.push(path.relative(root, absolute).replaceAll('\\', '/'));
      if (result.length >= max) break;
    }
  };
  visit(root);
  return result;
}

function packageInfo(root: string) {
  const target = path.join(root, 'package.json');
  const json = readJson(target);
  return { target, json, dependencies: { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) } as Record<string, string> };
}

type FrameworkPackage = ReturnType<typeof packageInfo> & { root: string; relativeRoot: string };

function frameworkPackage(root: string, definition: AdapterDefinition): FrameworkPackage | null {
  const manifests: string[] = [];
  const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);
  const visit = (directory: string, depth: number) => {
    if (depth > 5 || manifests.length >= 500) return;
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) manifests.push(manifest);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      visit(path.join(directory, entry.name), depth + 1);
    }
  };
  visit(root, 0);
  const matches = manifests.flatMap((manifest) => {
    try {
      const packageRoot = path.dirname(manifest);
      const info = packageInfo(packageRoot);
      const hasAll = definition.packageNames.every((name) => Boolean(info.dependencies[name]));
      if (!hasAll) return [];
      const version = normalizeVersion(info.dependencies[definition.versionPackage]);
      return [{ ...info, root: packageRoot, relativeRoot: path.relative(root, packageRoot).replaceAll('\\', '/'), supported: Boolean(version && semver.satisfies(version, definition.supportedVersionRange)) }];
    } catch {
      return [];
    }
  });
  return matches.find((item) => item.supported) ?? matches[0] ?? null;
}

function withinPackage(relativeRoot: string, relativePath: string): string {
  return relativeRoot ? path.posix.join(relativeRoot, relativePath) : relativePath;
}

function fileHash(root: string, relativePath: string): string | null {
  const target = resolveWithinWorkspace(root, relativePath);
  return fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
}

function currentGitRevision(root: string): string | null {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 }).trim() || null;
  } catch {
    return null;
  }
}

function commandFor(root: string, packageRoot: string, relativePackageRoot: string, snapshot: RepositorySnapshotSummary, sdkPackage: string): StructuredCommand[] {
  const manager = snapshot.packageManager;
  if (!manager || !['pnpm', 'npm', 'yarn', 'bun'].includes(manager)) return [];
  const executable = process.platform === 'win32' ? `${manager}.cmd` : manager;
  const packageJson = packageInfo(packageRoot).json;
  let sdkResolves = false;
  try {
    createRequire(path.join(packageRoot, 'package.json')).resolve(`${sdkPackage}/package.json`);
    sdkResolves = true;
  } catch {
    // A declared but unresolved dependency is not considered installed.
  }
  const commands: StructuredCommand[] = [];
  if (!sdkResolves) {
    const installArgs = manager === 'npm'
      ? ['install', `${sdkPackage}@^0.1.0`]
      : ['add', `${sdkPackage}@^0.1.0`];
    commands.push({
      id: 'install-sdk', executable, args: installArgs, cwd: relativePackageRoot || '.', timeoutMs: 15 * 60_000,
      allowedEnvironmentKeys: ['CI', 'NODE_ENV', 'NPM_CONFIG_REGISTRY', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PNPM_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'],
      purpose: `Install ${sdkPackage} using the detected ${manager} package manager`, networkRequired: true,
    });
  }
  if (typeof packageJson.scripts?.build === 'string') {
    commands.push({
      id: 'validate-build', executable, args: ['run', 'build'], cwd: relativePackageRoot || '.', timeoutMs: 15 * 60_000,
      allowedEnvironmentKeys: ['CI', 'NODE_ENV', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'], purpose: 'Validate the instrumented application build', networkRequired: false,
    });
  }
  return commands;
}

function packageManagerLockfile(root: string, packageRoot: string, manager: string | null): string | null {
  const names = manager === 'pnpm' ? ['pnpm-lock.yaml']
    : manager === 'npm' ? ['package-lock.json']
      : manager === 'yarn' ? ['yarn.lock']
        : manager === 'bun' ? ['bun.lockb', 'bun.lock'] : [];
  let directory = packageRoot;
  const canonicalRoot = fs.realpathSync.native(root);
  while (directory.startsWith(canonicalRoot)) {
    for (const name of names) {
      const target = path.join(directory, name);
      if (fs.existsSync(target)) return path.relative(root, target).replaceAll('\\', '/');
    }
    if (directory === canonicalRoot) break;
    directory = path.dirname(directory);
  }
  return null;
}

function updatePackageDependency(source: string, section: 'dependencies' | 'devDependencies', packageName: string, version: string): string {
  const insertSpaces = !/^\t/m.test(source);
  const indentation = source.match(/^( +)"/m)?.[1].length ?? 2;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const unit = insertSpaces ? ' '.repeat(indentation) : '\t';
  const property = JSON.stringify(packageName);
  const value = JSON.stringify(version);
  const sectionPattern = new RegExp(`${JSON.stringify(section)}\\s*:\\s*\\{`);
  const match = sectionPattern.exec(source);
  if (!match) {
    const closing = source.lastIndexOf('}');
    if (closing < 0) throw new Error('INVALID_PACKAGE_JSON');
    const before = source.slice(0, closing).trimEnd();
    const separator = before.endsWith('{') ? '' : ',';
    return `${before}${separator}${eol}${unit}${JSON.stringify(section)}: {${eol}${unit}${unit}${property}: ${value}${eol}${unit}}${eol}${source.slice(closing)}`;
  }
  const open = match.index + match[0].lastIndexOf('{');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let close = -1;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) { close = index; break; }
  }
  if (close < 0) throw new Error('INVALID_PACKAGE_JSON');
  const body = source.slice(open + 1, close).trim();
  const insertion = `${body ? ',' : ''}${eol}${unit}${unit}${property}: ${value}${eol}${unit}`;
  return `${source.slice(0, close).trimEnd()}${insertion}${source.slice(close)}`;
}

function generatedFrontendModule(typed: boolean): string {
  const runDeclaration = typed
    ? `const run = (globalThis as typeof globalThis & { __TELLANN_RUN__?: Record<string, string> }).__TELLANN_RUN__ ?? {};`
    : `const run = globalThis.__TELLANN_RUN__ ?? {};`;
  return `/* tellann:generated:start manifest=${INSTRUMENTATION_MANIFEST_VERSION} */\nimport { SOTS } from '@sots/frontend-sdk';\n\n${runDeclaration}\nconst configured = import.meta.env ?? {};\n\nSOTS.initialize({\n  endpoint: run.relayEndpoint ?? configured.VITE_TELLANN_GATEWAY_URL ?? '/tellann-relay',\n  applicationId: run.applicationId ?? configured.VITE_TELLANN_APPLICATION_ID ?? 'configure-in-tellann-desktop',\n  environmentId: run.environmentId ?? configured.VITE_TELLANN_ENVIRONMENT_ID,\n  apiKey: run.relayToken ?? configured.VITE_TELLANN_INGESTION_KEY,\n  runId: run.runId,\n  sessionId: run.sessionId,\n  traceId: run.traceId,\n  agentVersion: run.agentVersion,\n  instrumentationManifestVersion: '${INSTRUMENTATION_MANIFEST_VERSION}',\n});\nvoid SOTS.verifyInstallation();\n\nexport { SOTS };\n/* tellann:generated:end */\n`;
}

function backendInitialization(): string {
  return `SOTS.initialize({
  endpoint: process.env.TELLANN_RELAY_ENDPOINT ?? process.env.TELLANN_GATEWAY_URL ?? process.env.TELLANN_ENDPOINT ?? 'http://127.0.0.1:43117',
  applicationId: process.env.TELLANN_APPLICATION_ID ?? 'configure-in-tellann-desktop',
  environmentId: process.env.TELLANN_ENVIRONMENT_ID,
  apiKey: process.env.TELLANN_RUN_CREDENTIAL ?? process.env.TELLANN_INGESTION_KEY,
  runId: process.env.TELLANN_RUN_ID,
  sessionId: process.env.TELLANN_SESSION_ID,
  traceId: process.env.TELLANN_TRACE_ID,
  agentVersion: process.env.TELLANN_AGENT_VERSION,
  instrumentationManifestVersion: '${INSTRUMENTATION_MANIFEST_VERSION}',
});
void SOTS.verifyInstallation();`;
}

function generatedBackendModule(adapterId: FrameworkId, commonJs: boolean): string {
  if (commonJs) {
    const names = adapterId === 'express' ? 'SOTS, sotsExpressErrorHandler, sotsExpressMiddleware'
      : adapterId === 'fastify' ? 'SOTS, sotsFastifyPlugin'
        : 'SOTS';
    return `/* tellann:generated:start manifest=${INSTRUMENTATION_MANIFEST_VERSION} */
const { ${names} } = require('@sots/backend-sdk');

${backendInitialization()}

module.exports = { ${names} };
/* tellann:generated:end */
`;
  }
  const integration = adapterId === 'express'
    ? `import { SOTS, sotsExpressErrorHandler, sotsExpressMiddleware } from '@sots/backend-sdk';\n\n${backendInitialization()}\n\nexport { SOTS, sotsExpressErrorHandler, sotsExpressMiddleware };`
    : adapterId === 'fastify'
      ? `import { SOTS, sotsFastifyPlugin } from '@sots/backend-sdk';\n\n${backendInitialization()}\n\nexport { SOTS, sotsFastifyPlugin };`
      : adapterId === 'nestjs'
        ? `import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { SOTS, extractCorrelationContext } from '@sots/backend-sdk';

${backendInitialization()}

@Injectable()
export class TellannInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const correlation = extractCorrelationContext(request.headers ?? {});
    const startedAt = Date.now();
    const track = () => SOTS.trackApi({
      endpoint: request.route?.path ?? request.url ?? 'unknown',
      method: request.method ?? 'UNKNOWN',
      statusCode: response.statusCode ?? 200,
      durationMs: Date.now() - startedAt,
      sessionId: correlation.sessionId,
      runId: correlation.runId,
      traceId: correlation.traceId,
    });
    return next.handle().pipe(
      tap(() => void track()),
      catchError((error) => {
        void SOTS.captureError({ error, sessionId: correlation.sessionId, runId: correlation.runId, traceId: correlation.traceId, eventType: 'SERVER_ERROR' });
        return throwError(() => error);
      }),
    );
  }
}

export { SOTS };`
        : `import { SOTS } from '@sots/backend-sdk';\n\n${backendInitialization()}\n\nexport { SOTS };`;
  return `/* tellann:generated:start manifest=${INSTRUMENTATION_MANIFEST_VERSION} */\n${integration}\n/* tellann:generated:end */\n`;
}

function generatedNextProvider(typed: boolean): string {
  const reactImport = typed ? `import { useEffect, type ReactNode } from 'react';` : `import { useEffect } from 'react';`;
  const signature = typed ? `export function TellannProvider({ children }: { children: ReactNode }) {` : `export function TellannProvider({ children }) {`;
  const runDeclaration = typed
    ? `const run = (globalThis as typeof globalThis & { __TELLANN_RUN__?: Record<string, string> }).__TELLANN_RUN__ ?? {};`
    : `const run = globalThis.__TELLANN_RUN__ ?? {};`;
  return `/* tellann:generated:start manifest=${INSTRUMENTATION_MANIFEST_VERSION} */
'use client';

${reactImport}
import { SOTS } from '@sots/frontend-sdk';

${signature}
  useEffect(() => {
    ${runDeclaration}
    const configured = {
      endpoint: process.env.NEXT_PUBLIC_TELLANN_GATEWAY_URL,
      applicationId: process.env.NEXT_PUBLIC_TELLANN_APPLICATION_ID,
      environmentId: process.env.NEXT_PUBLIC_TELLANN_ENVIRONMENT_ID,
      apiKey: process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY,
    };
    SOTS.initialize({
      endpoint: run.relayEndpoint ?? configured.endpoint ?? '/tellann-relay',
      applicationId: run.applicationId ?? configured.applicationId ?? 'configure-in-tellann-desktop',
      environmentId: run.environmentId ?? configured.environmentId,
      apiKey: run.relayToken ?? configured.apiKey,
      runId: run.runId,
      sessionId: run.sessionId,
      traceId: run.traceId,
      agentVersion: run.agentVersion,
      instrumentationManifestVersion: '${INSTRUMENTATION_MANIFEST_VERSION}',
    });
    void SOTS.verifyInstallation();
  }, []);
  return children;
}
export { SOTS };
/* tellann:generated:end */
`;
}

type AdapterDefinition = {
  id: FrameworkId;
  packageNames: string[];
  versionPackage: string;
  supportedVersionRange: string;
  sdkPackage: '@sots/frontend-sdk' | '@sots/backend-sdk';
  generatedFile: string;
  entryMatchers: RegExp[];
  symbolMatchers: RegExp[];
};

const DEFINITIONS: AdapterDefinition[] = [
  { id: 'react-vite', packageNames: ['react', 'vite'], versionPackage: 'vite', supportedVersionRange: '>=4 <9', sdkPackage: '@sots/frontend-sdk', generatedFile: 'src/tellann.ts', entryMatchers: [/(^|\/)src\/(main|index)\.[jt]sx?$/], symbolMatchers: [/createRoot\s*\(/, /ReactDOM\.render\s*\(/] },
  { id: 'nextjs', packageNames: ['next'], versionPackage: 'next', supportedVersionRange: '>=12 <17', sdkPackage: '@sots/frontend-sdk', generatedFile: 'src/tellann.tsx', entryMatchers: [/(^|\/)(src\/)?pages\/_app\.[jt]sx?$/, /(^|\/)(src\/)?app\/layout\.[jt]sx?$/], symbolMatchers: [/function\s+App\b/, /function\s+RootLayout\b/, /export\s+default/] },
  { id: 'express', packageNames: ['express'], versionPackage: 'express', supportedVersionRange: '>=4 <6', sdkPackage: '@sots/backend-sdk', generatedFile: 'src/tellann.ts', entryMatchers: [/(^|\/)(src\/)?(index|server|app|main)\.[jt]s$/], symbolMatchers: [/\.listen\s*\(/, /express\s*\(/] },
  { id: 'fastify', packageNames: ['fastify'], versionPackage: 'fastify', supportedVersionRange: '>=4 <6', sdkPackage: '@sots/backend-sdk', generatedFile: 'src/tellann.ts', entryMatchers: [/(^|\/)(src\/)?(index|server|app|main)\.[jt]s$/], symbolMatchers: [/fastify\s*\(/i, /\.listen\s*\(/] },
  { id: 'nestjs', packageNames: ['@nestjs/core'], versionPackage: '@nestjs/core', supportedVersionRange: '>=9 <12', sdkPackage: '@sots/backend-sdk', generatedFile: 'src/tellann.ts', entryMatchers: [/(^|\/)src\/main\.[jt]s$/], symbolMatchers: [/NestFactory\.create\s*\(/, /bootstrap\s*\(/] },
];

function addNamedImport(source: SourceFile, moduleSpecifier: string, names: string[]): void {
  const existing = source.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
  if (existing) {
    const current = new Set(existing.getNamedImports().map((item) => item.getName()));
    existing.addNamedImports(names.filter((name) => !current.has(name)));
  } else {
    source.insertImportDeclaration(0, { moduleSpecifier, namedImports: names });
  }
}

function addCommonJsBindings(source: SourceFile, moduleSpecifier: string, names: string[]): void {
  const statement = `const { ${names.join(', ')} } = require(${JSON.stringify(moduleSpecifier)});`;
  if (!source.getFullText().includes(statement)) source.insertStatements(0, statement);
}

function addCheckpointImport(source: SourceFile, moduleSpecifier: string, commonJs: boolean): void {
  if (commonJs) {
    const statement = `const { SOTS: TellannSOTS } = require(${JSON.stringify(moduleSpecifier)});`;
    if (!source.getFullText().includes(statement)) source.insertStatements(0, statement);
    return;
  }
  const existing = source.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
  const alreadyImported = existing?.getNamedImports().some((item) => item.getName() === 'SOTS' && item.getAliasNode()?.getText() === 'TellannSOTS');
  if (alreadyImported) return;
  if (existing) existing.addNamedImport({ name: 'SOTS', alias: 'TellannSOTS' });
  else source.insertImportDeclaration(0, { moduleSpecifier, namedImports: [{ name: 'SOTS', alias: 'TellannSOTS' }] });
}

function applySemanticCheckpoint(source: SourceFile, operation: PatchOperation, commonJs: boolean): void {
  if (!operation.symbol || !operation.importModule) throw new Error('INVALID_SEMANTIC_CHECKPOINT_OPERATION');
  const marker = `tellann:checkpoint:${operation.id}`;
  if (source.getFullText().includes(marker)) return;
  addCheckpointImport(source, operation.importModule, commonJs);
  const functionDeclaration = source.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).find((item) => item.getName() === operation.symbol);
  const methodDeclaration = source.getDescendantsOfKind(SyntaxKind.MethodDeclaration).find((item) => item.getName() === operation.symbol);
  const variableDeclaration = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === operation.symbol);
  const body = functionDeclaration?.getBody()
    ?? methodDeclaration?.getBody()
    ?? variableDeclaration?.getInitializer()?.getFirstChildByKind(SyntaxKind.Block);
  if (!body || body.getKind() !== SyntaxKind.Block || !('insertStatements' in body)) throw new Error(`SAFE_SEMANTIC_BOUNDARY_NOT_FOUND:${operation.symbol}`);
  const mapping = operation.eventMappings[0];
  (body as unknown as { insertStatements(index: number, text: string): unknown }).insertStatements(0,
    `/* ${marker} */\nvoid TellannSOTS.trackEvent(${JSON.stringify(mapping?.eventType ?? 'FLOW_STATE_REACHED')}, { checkpointId: ${JSON.stringify(mapping?.checkpointId ?? operation.id)}, stateId: ${JSON.stringify(mapping?.stateId ?? null)}, transitionId: ${JSON.stringify(mapping?.transitionId ?? null)}, terminalKind: ${JSON.stringify(mapping?.terminalKind ?? null)}, flowInitializationId: ${JSON.stringify((operation as any).flowInitializationId ?? null)}, source: 'tellann-adapter' });`);
}

function frameworkVariable(source: SourceFile, matcher: RegExp): string | null {
  return source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => matcher.test(declaration.getInitializer()?.getText() ?? ''))
    ?.getName() ?? null;
}

function appendAfterVariable(source: SourceFile, variableName: string, statementText: string): void {
  if (source.getFullText().includes(statementText)) return;
  const declaration = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === variableName);
  const statement = declaration?.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (!statement) throw new Error(`SAFE_INTEGRATION_POINT_NOT_FOUND:${variableName}`);
  statement.replaceWithText(`${statement.getText()}\n${statementText}`);
}

function insertBeforeListen(source: SourceFile, variableName: string, statementText: string): void {
  if (source.getFullText().includes(statementText)) return;
  const listen = source.getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .find((statement) => statement.getText().includes(`${variableName}.listen(`));
  if (!listen) throw new Error(`SAFE_LISTEN_BOUNDARY_NOT_FOUND:${variableName}`);
  listen.replaceWithText(`${statementText}\n${listen.getText()}`);
}

function applyEntryTransform(definition: AdapterDefinition, source: SourceFile, moduleSpecifier: string, commonJs: boolean): void {
  if (definition.id === 'react-vite') {
    if (commonJs) {
      const statement = `require(${JSON.stringify(moduleSpecifier)});`;
      if (!source.getFullText().includes(statement)) source.insertStatements(0, statement);
      return;
    }
    if (!source.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier)) {
      source.insertImportDeclaration(0, { moduleSpecifier });
    }
    return;
  }
  if (definition.id === 'nextjs') {
    addNamedImport(source, moduleSpecifier, ['TellannProvider']);
    const component = source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      .find((element) => element.getTagNameNode().getText() === 'Component');
    if (component && !component.getFirstAncestor((ancestor) => ancestor.getText().startsWith('<TellannProvider'))) {
      component.replaceWithText(`<TellannProvider>${component.getText()}</TellannProvider>`);
      return;
    }
    const children = source.getDescendantsOfKind(SyntaxKind.JsxExpression)
      .find((expression) => expression.getExpression()?.getText() === 'children');
    if (children && !children.getFirstAncestor((ancestor) => ancestor.getKind() === SyntaxKind.JsxElement && ancestor.getText().startsWith('<TellannProvider'))) {
      children.replaceWithText(`<TellannProvider>{children}</TellannProvider>`);
      return;
    }
    throw new Error('SAFE_NEXT_RENDER_BOUNDARY_NOT_FOUND');
  }
  if (definition.id === 'express') {
    if (commonJs) addCommonJsBindings(source, moduleSpecifier, ['sotsExpressErrorHandler', 'sotsExpressMiddleware']);
    else addNamedImport(source, moduleSpecifier, ['sotsExpressErrorHandler', 'sotsExpressMiddleware']);
    const application = frameworkVariable(source, /\bexpress\s*\(/);
    if (!application) throw new Error('SAFE_EXPRESS_APP_NOT_FOUND');
    appendAfterVariable(source, application, `${application}.use(sotsExpressMiddleware());`);
    insertBeforeListen(source, application, `${application}.use(sotsExpressErrorHandler());`);
    return;
  }
  if (definition.id === 'fastify') {
    if (commonJs) addCommonJsBindings(source, moduleSpecifier, ['sotsFastifyPlugin']);
    else addNamedImport(source, moduleSpecifier, ['sotsFastifyPlugin']);
    const application = frameworkVariable(source, /\bfastify\s*\(/i);
    if (!application) throw new Error('SAFE_FASTIFY_APP_NOT_FOUND');
    appendAfterVariable(source, application, `${application}.register(sotsFastifyPlugin);`);
    return;
  }
  if (definition.id === 'nestjs') {
    if (commonJs) addCommonJsBindings(source, moduleSpecifier, ['TellannInterceptor']);
    else addNamedImport(source, moduleSpecifier, ['TellannInterceptor']);
    const application = frameworkVariable(source, /NestFactory\.create\s*\(/);
    if (!application) throw new Error('SAFE_NEST_APP_NOT_FOUND');
    appendAfterVariable(source, application, `${application}.useGlobalInterceptors(new TellannInterceptor());`);
    return;
  }
  throw new Error(`UNSUPPORTED_ENTRY_TRANSFORM:${definition.id}`);
}

class TypeScriptAdapter implements InstrumentationAdapter {
  readonly version = '1.0.0';
  readonly id: FrameworkId;
  readonly supportedVersionRange: string;

  constructor(private readonly definition: AdapterDefinition) {
    this.id = definition.id;
    this.supportedVersionRange = definition.supportedVersionRange;
  }

  detect(input: LocalProjectContext): DetectionResult {
    const detectedPackage = frameworkPackage(input.workspaceRoot, this.definition);
    const dependencies = detectedPackage?.dependencies ?? {};
    const manifest = detectedPackage?.relativeRoot ? `${detectedPackage.relativeRoot}/package.json` : 'package.json';
    const evidence = this.definition.packageNames.filter((name) => dependencies[name]).map((name) => `${manifest}:${name}@${dependencies[name]}`);
    const hasAll = Boolean(detectedPackage) && this.definition.packageNames.every((name) => Boolean(dependencies[name]));
    const frameworkVersion = normalizeVersion(dependencies[this.definition.versionPackage]);
    const versionSupported = frameworkVersion ? semver.satisfies(frameworkVersion, this.supportedVersionRange) : false;
    return {
      adapterId: this.id, adapterVersion: this.version, supported: hasAll && versionSupported,
      confidence: hasAll ? (versionSupported ? 0.99 : 0.8) : evidence.length / this.definition.packageNames.length,
      frameworkVersion, supportedVersionRange: this.supportedVersionRange, evidence,
      reasons: [
        ...(!hasAll ? [`Missing required packages: ${this.definition.packageNames.filter((name) => !dependencies[name]).join(', ')}`] : []),
        ...(hasAll && !versionSupported ? [`${this.definition.versionPackage} ${frameworkVersion ?? 'unknown'} is outside ${this.supportedVersionRange}`] : []),
      ],
    };
  }

  async index(input: LocalProjectContext): Promise<AdapterEvidence> {
    const files = findSourceFiles(input.workspaceRoot);
    const entryPoints: AdapterEvidence['entryPoints'] = [];
    const existingInstrumentation: AdapterEvidence['existingInstrumentation'] = [];
    const semanticBoundaries: AdapterEvidence['semanticBoundaries'] = [];
    for (const relativePath of files) {
      const content = fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, relativePath), 'utf8');
      if (content.includes('tellann:generated:start') || /@sots\/(frontend|backend)-sdk/.test(content)) {
        existingInstrumentation.push({ file: relativePath, marker: content.includes('tellann:generated:start') ? 'generated-block' : 'sdk-import' });
      }
      if (this.definition.entryMatchers.some((matcher) => matcher.test(relativePath)) && this.definition.symbolMatchers.some((matcher) => matcher.test(content))) {
        entryPoints.push({ file: relativePath, symbol: this.definition.symbolMatchers.find((matcher) => matcher.test(content))?.source ?? null, confidence: 0.94 });
      }
      if (/\b(login|signIn|authenticate|validate|save|create|update|delete|persist)[A-Za-z0-9_]*\b/.test(content)) {
        const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
        const source = project.createSourceFile(relativePath, content);
        const names = new Set<string>();
        for (const declaration of source.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
          if (declaration.getName() && declaration.getBody()?.getKind() === SyntaxKind.Block) names.add(declaration.getName()!);
        }
        for (const declaration of source.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
          if (declaration.getBody()?.getKind() === SyntaxKind.Block) names.add(declaration.getName());
        }
        for (const declaration of source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          const initializer = declaration.getInitializer();
          if ([SyntaxKind.ArrowFunction, SyntaxKind.FunctionExpression].includes(initializer?.getKind() as SyntaxKind)
            && initializer?.getFirstChildByKind(SyntaxKind.Block)) names.add(declaration.getName());
        }
        for (const symbol of names) {
          const authentication = /login|signin|authenticate/i.test(symbol);
          const validation = /validate/i.test(symbol);
          const persistence = /save|create|update|delete|persist/i.test(symbol);
          if (!authentication && !validation && !persistence) continue;
          semanticBoundaries.push({
            file: relativePath, symbol, eventType: 'WORKFLOW_STARTED', confidence: 0.78,
            rationale: authentication ? 'Authentication workflow entry' : validation ? 'Validation workflow entry' : 'Persisted business workflow entry',
          });
        }
      }
    }
    return { entryPoints: entryPoints.slice(0, 20), existingInstrumentation, semanticBoundaries: semanticBoundaries.slice(0, 100) };
  }

  async propose(input: LocalProjectContext): Promise<InstrumentationPlan> {
    if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
    const detection = this.detect(input);
    if (!detection.supported) throw new Error(`UNSUPPORTED_FRAMEWORK_VERSION:${detection.reasons.join(';')}`);
    const evidence = await this.index(input);
    const detectedPackage = frameworkPackage(input.workspaceRoot, this.definition);
    if (!detectedPackage) throw new Error('FRAMEWORK_PACKAGE_NOT_FOUND');
    const entry = evidence.entryPoints.find((candidate) => !detectedPackage.relativeRoot || candidate.file.startsWith(`${detectedPackage.relativeRoot}/`));
    if (!entry) throw new Error('SAFE_ENTRY_POINT_NOT_IN_FRAMEWORK_PACKAGE');
    const generatedFile = withinPackage(detectedPackage.relativeRoot, generatedFileFor(this.definition, entry.file));
    const commonJs = isCommonJsEntry(input.workspaceRoot, entry.file);
    const typed = /\.[cm]?tsx?$/.test(entry.file);
    const generated = this.id === 'nextjs'
      ? generatedNextProvider(typed)
      : this.definition.sdkPackage === '@sots/frontend-sdk'
        ? generatedFrontendModule(typed)
        : generatedBackendModule(this.id, commonJs);
    const operations: PatchOperation[] = [
      {
        id: 'package-sdk', kind: 'UPDATE_PACKAGE', relativePath: withinPackage(detectedPackage.relativeRoot, 'package.json'), symbol: this.definition.sdkPackage,
        transformId: 'tellann.package-json.dependency', transformVersion: this.version, expectedHash: fileHash(input.workspaceRoot, withinPackage(detectedPackage.relativeRoot, 'package.json')),
        description: `Add ${this.definition.sdkPackage} without changing scripts or unrelated dependencies`, eventMappings: [],
      },
      {
        id: 'generated-config', kind: fs.existsSync(resolveWithinWorkspace(input.workspaceRoot, generatedFile)) ? 'UPDATE_SOURCE' : 'CREATE_FILE',
        relativePath: generatedFile, symbol: null, transformId: 'tellann.generated.config', transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, generatedFile), description: 'Create the Tellann SDK configuration and correlation module',
        eventMappings: [{ eventType: 'TELLANN_INITIALIZED', expectedState: null }], content: generated,
      },
      {
        id: 'entry-import', kind: 'UPDATE_SOURCE', relativePath: entry.file, symbol: entry.symbol,
        transformId: 'tellann.entry.import', transformVersion: this.version, expectedHash: fileHash(input.workspaceRoot, entry.file),
        description: this.id === 'react-vite' ? 'Import the Tellann configuration once at the application entry point' : `Install the ${this.id} runtime integration at a safe framework boundary`, eventMappings: [],
        importModule: relativeImport(entry.file, generatedFile),
      },
    ];
    const manifestCheckpoints = input.instrumentationPurpose === 'FLOW' ? input.flowManifest?.checkpoints ?? [] : [];
    const unresolvedRequired = manifestCheckpoints.filter((checkpoint) => checkpoint.required && (checkpoint.mapping.confidence < 0.65 || !checkpoint.mapping.file || !checkpoint.mapping.symbol));
    if (input.instrumentationPurpose === 'FLOW' && !input.flowManifest) throw new Error('FLOW_INITIALIZATION_MANIFEST_REQUIRED');
    if (unresolvedRequired.length) throw new Error(`FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED:${unresolvedRequired.map((item) => item.id).join(',')}`);
    const selectedBoundaries = manifestCheckpoints.length
      ? manifestCheckpoints.flatMap((checkpoint) => {
          const boundary = evidence.semanticBoundaries.find((item) => item.file === checkpoint.mapping.file && item.symbol === checkpoint.mapping.symbol);
          return boundary ? [{ boundary, checkpoint }] : [];
        })
      : (input.instrumentationPurpose === 'FLOW' && this.id !== 'nextjs' ? evidence.semanticBoundaries : [])
          .filter((item) => item.confidence >= 0.75 && item.symbol && (!detectedPackage.relativeRoot || item.file.startsWith(`${detectedPackage.relativeRoot}/`)))
          .slice(0, 12)
          .map((boundary) => ({ boundary, checkpoint: null }));
    for (const { boundary, checkpoint } of selectedBoundaries) {
      operations.push({
        id: checkpoint?.id ?? `semantic-${hash(`${boundary.file}:${boundary.symbol}`).slice(0, 12)}`,
        kind: 'UPDATE_SOURCE', relativePath: boundary.file, symbol: boundary.symbol,
        transformId: 'tellann.semantic.function-entry', transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, boundary.file),
        description: checkpoint ? `Add declared Flow checkpoint ${checkpoint.id} to ${boundary.symbol}` : `Add an explicit workflow-entry checkpoint to ${boundary.symbol}`,
        eventMappings: checkpoint ? [{ eventType: checkpoint.eventType, expectedState: checkpoint.expectedState, checkpointId: checkpoint.id, stateId: checkpoint.stateId, transitionId: checkpoint.transitionId, terminalKind: checkpoint.terminalKind }] : [{ eventType: boundary.eventType, expectedState: boundary.symbol }],
        importModule: relativeImport(boundary.file, generatedFile),
        flowInitializationId: input.flowInitializationId,
      });
    }
    const lockfile = packageManagerLockfile(input.workspaceRoot, detectedPackage.root, input.snapshot.packageManager);
    if (lockfile) {
      operations.splice(1, 0, {
        id: 'package-lockfile', kind: 'UPDATE_PACKAGE', relativePath: lockfile, symbol: null,
        transformId: 'tellann.package-manager.lockfile', transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, lockfile),
        description: `Allow the detected ${input.snapshot.packageManager} package manager to update its lockfile`,
        eventMappings: [],
      });
    }
    const canonical = JSON.stringify({ adapter: this.id, version: this.version, revision: input.snapshot.revision, fingerprint: input.snapshot.repositoryFingerprint, operations: operations.map(({ content, ...operation }) => operation) });
    const taskKey = hash(canonical);
    const validationCommands = commandFor(input.workspaceRoot, detectedPackage.root, detectedPackage.relativeRoot, input.snapshot, this.definition.sdkPackage);
    return {
      contractVersion: INSTRUMENTATION_CONTRACT_VERSION, manifestVersion: INSTRUMENTATION_MANIFEST_VERSION,
      id: crypto.randomUUID(), taskKey, adapterId: this.id, adapterVersion: this.version,
      instrumentationPurpose: input.instrumentationPurpose ?? 'BOOTSTRAP',
      flowId: input.flowId ?? null,
      flowVersionId: input.flowVersionId ?? null,
      flowInitializationId: input.flowInitializationId ?? null,
      flowManifest: input.flowManifest ?? null,
      frameworkVersion: detection.frameworkVersion, supportedVersionRange: this.supportedVersionRange,
      baseRevision: input.snapshot.revision, repositoryFingerprint: input.snapshot.repositoryFingerprint,
      approvedFileScopes: [...new Set(operations.map((operation) => operation.relativePath))],
      packageChanges: [{ packageName: this.definition.sdkPackage, version: '^0.1.0', kind: 'dependency' }],
      operations, validationCommands,
      networkRequirements: validationCommands.some((command) => command.id === 'install-sdk')
        ? ['Package registry access when the SDK is not already installed']
        : [],
      risk: evidence.existingInstrumentation.length || operations.some((operation) => operation.transformId === 'tellann.semantic.function-entry') ? 'MEDIUM' : 'LOW',
      riskReasons: [
        ...(evidence.existingInstrumentation.length ? ['Existing instrumentation requires duplicate-registration checks'] : []),
        ...(operations.some((operation) => operation.transformId === 'tellann.semantic.function-entry') ? ['Semantic workflow-entry checkpoints modify explicitly listed functions'] : []),
        ...(!evidence.existingInstrumentation.length && !operations.some((operation) => operation.transformId === 'tellann.semantic.function-entry') ? ['Changes are limited to one dependency, one generated module, and one framework integration'] : []),
      ],
      evidence, createdAt: new Date().toISOString(),
    };
  }

  async apply(input: LocalProjectContext, task: ApprovedInstrumentationTask): Promise<PatchResult> {
    if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
    const plan = validateInstrumentationPlan(task.plan);
    if (plan.adapterId !== this.id) throw new Error('ADAPTER_PLAN_MISMATCH');
    if (plan.repositoryFingerprint !== input.snapshot.repositoryFingerprint || plan.baseRevision !== input.snapshot.revision) throw new Error('STALE_INSTRUMENTATION_PLAN');
    if (plan.baseRevision && currentGitRevision(input.workspaceRoot) !== plan.baseRevision) throw new Error('STALE_INSTRUMENTATION_BASE_REVISION');
    const approved = new Set(task.approvedFileScopes);
    if (plan.operations.some((operation) => !approved.has(operation.relativePath) || !plan.approvedFileScopes.includes(operation.relativePath))) throw new Error('TASK_SCOPE_EXPANSION_DENIED');
    const expectedApprovalHash = hash(JSON.stringify({ planId: plan.id, taskKey: plan.taskKey, files: [...approved].sort(), commands: [...task.approvedCommandIds].sort() }));
    if (task.approvalHash !== expectedApprovalHash) throw new Error('INVALID_TASK_APPROVAL');
    for (const operation of plan.operations) {
      if (fileHash(input.workspaceRoot, operation.relativePath) !== operation.expectedHash) throw new Error(`STALE_TARGET_FILE:${operation.relativePath}`);
    }
    fs.mkdirSync(task.checkpointDirectory, { recursive: true });
    const checkpointId = crypto.randomUUID();
    const checkpointRoot = path.join(task.checkpointDirectory, checkpointId);
    fs.mkdirSync(checkpointRoot, { recursive: true });
    const before = new Map<string, string | null>();
    const after = new Map<string, string>();
    for (const operation of plan.operations) {
      const target = resolveWithinWorkspace(input.workspaceRoot, operation.relativePath);
      const original = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
      before.set(operation.relativePath, original);
      const backupTarget = path.join(checkpointRoot, operation.relativePath.replaceAll('/', path.sep));
      fs.mkdirSync(path.dirname(backupTarget), { recursive: true });
      if (original !== null) fs.writeFileSync(backupTarget, original);
      else fs.writeFileSync(`${backupTarget}.tellann-absent`, 'absent');
    }
    try {
    const packageOperation = plan.operations.find((operation) => operation.id === 'package-sdk');
    if (packageOperation) {
      const target = resolveWithinWorkspace(input.workspaceRoot, packageOperation.relativePath);
      let source = fs.readFileSync(target, 'utf8');
      for (const change of plan.packageChanges) {
        const section = change.kind === 'devDependency' ? 'devDependencies' : 'dependencies';
        const json = JSON.parse(source) as Record<string, Record<string, string> | undefined>;
        if (!json[section]?.[change.packageName]) source = updatePackageDependency(source, section, change.packageName, change.version);
      }
      fs.writeFileSync(target, source);
    }
    const generatedOperation = plan.operations.find((operation) => operation.id === 'generated-config');
    if (generatedOperation?.content) {
      const target = resolveWithinWorkspace(input.workspaceRoot, generatedOperation.relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
      if (!current.includes('tellann:generated:start')) fs.writeFileSync(target, generatedOperation.content);
    }
    const importOperation = plan.operations.find((operation) => operation.id === 'entry-import');
    if (importOperation?.importModule) {
      const target = resolveWithinWorkspace(input.workspaceRoot, importOperation.relativePath);
      const project = new Project({ manipulationSettings: { quoteKind: QuoteKind.Single }, useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
      const source = project.addSourceFileAtPath(target);
      applyEntryTransform(this.definition, source, importOperation.importModule, isCommonJsEntry(input.workspaceRoot, importOperation.relativePath));
      source.saveSync();
    }
    for (const operation of plan.operations.filter((item) => item.transformId === 'tellann.semantic.function-entry')) {
      const target = resolveWithinWorkspace(input.workspaceRoot, operation.relativePath);
      const project = new Project({ manipulationSettings: { quoteKind: QuoteKind.Single }, useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
      const source = project.addSourceFileAtPath(target);
      applySemanticCheckpoint(source, operation, isCommonJsEntry(input.workspaceRoot, operation.relativePath));
      source.saveSync();
    }
    const files: PatchFileResult[] = [];
    const diffParts: string[] = [];
    for (const relativePath of before.keys()) {
      const target = resolveWithinWorkspace(input.workspaceRoot, relativePath);
      const exists = fs.existsSync(target);
      const content = exists ? fs.readFileSync(target, 'utf8') : '';
      const original = before.get(relativePath) ?? null;
      after.set(relativePath, content);
      const changed = original === null ? exists : original !== content;
      files.push({ relativePath, beforeHash: original === null ? null : hash(original), afterHash: hash(content), changed });
      if (changed) diffParts.push(`--- a/${relativePath}\n+++ b/${relativePath}\n@@ Tellann instrumentation @@\n-${original ?? ''}\n+${content}`);
    }
    const diff = diffParts.join('\n');
    const manifest = { planId: plan.id, checkpointId, files, baseRevision: plan.baseRevision, appliedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(checkpointRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return { planId: plan.id, checkpointId, checkpointDirectory: task.checkpointDirectory, baseRevision: plan.baseRevision, files, changedFiles: files.filter((file) => file.changed).map((file) => file.relativePath), diff, diffHash: hash(diff), appliedAt: manifest.appliedAt };
    } catch (error) {
      for (const relativePath of before.keys()) {
        const target = resolveWithinWorkspace(input.workspaceRoot, relativePath);
        const backup = path.join(checkpointRoot, relativePath.replaceAll('/', path.sep));
        if (fs.existsSync(`${backup}.tellann-absent`)) fs.rmSync(target, { force: true });
        else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(backup, target);
        }
      }
      throw error;
    }
  }

  async validate(input: LocalProjectContext, result: PatchResult): Promise<ValidationResult> {
    const checks: ValidationResult['checks'] = [];
    for (const file of result.files) {
      const current = fileHash(input.workspaceRoot, file.relativePath);
      const unchangedAbsent = !file.changed && file.beforeHash === null && current === null;
      checks.push({ name: `hash:${file.relativePath}`, passed: unchangedAbsent || current === file.afterHash, output: unchangedAbsent || current === file.afterHash ? 'Expected instrumented hash present' : 'File changed after instrumentation' });
    }
    const packageOperation = result.files.find((file) => /(^|\/)package\.json$/.test(file.relativePath));
    const packageJson = packageOperation ? readJson(resolveWithinWorkspace(input.workspaceRoot, packageOperation.relativePath)) : {};
    checks.push({ name: 'sdk-dependency', passed: Boolean(packageJson.dependencies?.[this.definition.sdkPackage] || packageJson.devDependencies?.[this.definition.sdkPackage]), output: this.definition.sdkPackage });
    const generatedOperation = result.files.find((file) => /(^|\/)tellann\.[cm]?[jt]sx?$/.test(file.relativePath));
    const generatedPath = generatedOperation ? resolveWithinWorkspace(input.workspaceRoot, generatedOperation.relativePath) : null;
    checks.push({ name: 'generated-config', passed: Boolean(generatedPath && fs.existsSync(generatedPath) && fs.readFileSync(generatedPath, 'utf8').includes('tellann:generated:start')), output: generatedOperation?.relativePath ?? 'missing generated config' });
    const duplicated = findSourceFiles(input.workspaceRoot).flatMap((relativePath) => {
      const content = fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, relativePath), 'utf8');
      return (content.match(/tellann:generated:start/g) ?? []).length > 1 ? [relativePath] : [];
    });
    checks.push({ name: 'idempotency-markers', passed: duplicated.length === 0, output: duplicated.length ? `Duplicate markers: ${duplicated.join(', ')}` : 'No duplicate generated markers' });
    return { valid: checks.every((check) => check.passed), checks };
  }

  async rollback(input: LocalProjectContext, result: PatchResult): Promise<RollbackResult> {
    const checkpointRoot = path.join(result.checkpointDirectory, result.checkpointId);
    const rolledBackFiles: string[] = [];
    const conflicts: RollbackResult['conflicts'] = [];
    for (const file of result.files) {
      const target = resolveWithinWorkspace(input.workspaceRoot, file.relativePath);
      const currentHash = fileHash(input.workspaceRoot, file.relativePath);
      const unchangedAbsent = !file.changed && file.beforeHash === null && currentHash === null;
      if (!unchangedAbsent && currentHash !== file.afterHash) {
        conflicts.push({ relativePath: file.relativePath, reason: 'File changed after Tellann instrumentation; rollback would overwrite user work' });
        continue;
      }
      const backup = path.join(checkpointRoot, file.relativePath.replaceAll('/', path.sep));
      if (fs.existsSync(`${backup}.tellann-absent`)) fs.rmSync(target, { force: true });
      else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(backup, target);
      }
      rolledBackFiles.push(file.relativePath);
    }
    const verified = conflicts.length === 0 && result.files.every((file) => {
      const backup = path.join(checkpointRoot, file.relativePath.replaceAll('/', path.sep));
      return fs.existsSync(`${backup}.tellann-absent`)
        ? !fs.existsSync(resolveWithinWorkspace(input.workspaceRoot, file.relativePath))
        : fileHash(input.workspaceRoot, file.relativePath) === hash(fs.readFileSync(backup));
    });
    return { rolledBackFiles, conflicts, verified };
  }
}

export function refreshPatchResult(input: LocalProjectContext, result: PatchResult): PatchResult {
  const checkpointRoot = path.join(result.checkpointDirectory, result.checkpointId);
  const files: PatchFileResult[] = [];
  const diffParts: string[] = [];
  for (const existing of result.files) {
    const target = resolveWithinWorkspace(input.workspaceRoot, existing.relativePath);
    const backup = path.join(checkpointRoot, existing.relativePath.replaceAll('/', path.sep));
    const wasAbsent = fs.existsSync(`${backup}.tellann-absent`);
    const original = wasAbsent ? null : fs.readFileSync(backup, 'utf8');
    const exists = fs.existsSync(target);
    const current = exists ? fs.readFileSync(target, 'utf8') : '';
    const changed = original === null ? exists : original !== current;
    files.push({ relativePath: existing.relativePath, beforeHash: original === null ? null : hash(original), afterHash: hash(current), changed });
    if (changed) diffParts.push(`--- a/${existing.relativePath}\n+++ b/${existing.relativePath}\n@@ Tellann instrumentation @@\n-${original ?? ''}\n+${current}`);
  }
  const diff = diffParts.join('\n');
  const next = { ...result, files, changedFiles: files.filter((file) => file.changed).map((file) => file.relativePath), diff, diffHash: hash(diff) };
  fs.writeFileSync(path.join(checkpointRoot, 'manifest.json'), JSON.stringify({
    planId: result.planId,
    checkpointId: result.checkpointId,
    files,
    baseRevision: result.baseRevision,
    appliedAt: result.appliedAt,
  }, null, 2));
  return next;
}

export const adapters: InstrumentationAdapter[] = DEFINITIONS.map((definition) => new TypeScriptAdapter(definition));
export const adapterRegistry = new Map(adapters.map((adapter) => [adapter.id, adapter]));

export function detectAdapters(input: LocalProjectContext): DetectionResult[] {
  return adapters.map((adapter) => adapter.detect(input)).sort((left, right) => right.confidence - left.confidence);
}

export function getAdapter(id: string): InstrumentationAdapter {
  const adapter = adapterRegistry.get(id as FrameworkId);
  if (!adapter) throw new Error(`UNKNOWN_INSTRUMENTATION_ADAPTER:${id}`);
  return adapter;
}

export function createApprovalHash(plan: InstrumentationPlan, files: string[], commandIds: string[]): string {
  return hash(JSON.stringify({ planId: plan.id, taskKey: plan.taskKey, files: [...files].sort(), commands: [...commandIds].sort() }));
}

export const plannedAdapterOrder = ['react-vite', 'nextjs', 'express', 'fastify', 'nestjs', 'django', 'flask', 'fastapi', 'laravel', 'aspnet-core', 'spring-boot'] as const;
