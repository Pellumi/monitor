import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { scanWorkspace } from '../packages/project-intelligence/dist/index.js';
import {
  createApprovalHash,
  getAdapter,
  refreshPatchResult,
} from '../packages/instrumentation-adapters/dist/index.js';
import { LocalRunRelay } from '../packages/local-relay/dist/index.js';
import { createInstrumentationCheckpoint } from '../apps/desktop/dist/main/main/git-checkpoint.js';

// Container deployments inject the environment directly and ship no .env file.
// loadEnvFile throws ENOENT rather than no-opping, so its absence must be tolerated.
try { process.loadEnvFile?.('.env'); } catch { /* environment already populated by the platform */ }
const gateway = process.env.API_GATEWAY_URL ?? 'http://127.0.0.1:3000';
const prisma = new PrismaClient();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-phase3-'));
const checkpointRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-phase3-checkpoints-'));

function assert(value, message) {
  if (!value) throw new Error(`PHASE3_ACCEPTANCE_FAILED: ${message}`);
}

function run(executable, args, cwd = fixtureRoot) {
  let resolvedExecutable = executable;
  let resolvedArgs = args;
  const manager = executable.replace(/\.cmd$/i, '');
  if (process.platform === 'win32' && ['npm', 'pnpm', 'yarn'].includes(manager)) {
    const launchers = execFileSync('where.exe', [`${manager}.cmd`], { encoding: 'utf8', windowsHide: true })
      .split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const relativeCli = manager === 'npm' ? ['node_modules', 'npm', 'bin', 'npm-cli.js']
      : manager === 'pnpm' ? ['node_modules', 'pnpm', 'bin', 'pnpm.cjs']
        : ['node_modules', 'yarn', 'bin', 'yarn.js'];
    const cli = launchers.map((launcher) => path.join(path.dirname(launcher), ...relativeCli)).find((candidate) => fs.existsSync(candidate));
    assert(cli, `Safe ${manager} CLI could not be resolved`);
    resolvedExecutable = process.execPath;
    resolvedArgs = [cli, ...args];
  }
  return execFileSync(resolvedExecutable, resolvedArgs, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
  }).trim();
}

async function request(pathname, init = {}, token, expectedStatus) {
  const response = await fetch(`${gateway}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${init.method ?? 'GET'} ${pathname} expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`);
  } else if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function createFixture() {
  const packageJson = {
    name: 'tellann-phase3-react-vite-fixture',
    private: true,
    version: '1.0.0',
    scripts: { build: 'node -e "console.log(\'instrumented build passed\')"' },
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', vite: '^7.0.0' },
  };
  fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(path.join(fixtureRoot, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(fixtureRoot, 'src', 'main.tsx'), `import { createRoot } from 'react-dom/client';
async function checkout() { return { ok: true }; }
createRoot(document.body).render(null);
void checkout();
`);
  const sdkTarball = path.resolve('release/sdk/tellann-frontend-sdk-0.1.0.tgz');
  assert(fs.existsSync(sdkTarball), 'Packed frontend SDK artifact is missing; run pnpm pack:sdks');
  run('npm.cmd', ['install', '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', sdkTarball]);
  run('git', ['init']);
  run('git', ['config', 'user.email', 'acceptance@tellann.local']);
  run('git', ['config', 'user.name', 'Tellann Acceptance']);
  run('git', ['add', '.']);
  run('git', ['commit', '-m', 'Phase 3 fixture']);
  fs.writeFileSync(path.join(fixtureRoot, 'user-notes.txt'), 'unrelated dirty user work');
}

async function main() {
  createFixture();
  const soloPlan = await prisma.plan.findFirst({ where: { type: 'SOLO' } });
  assert(soloPlan, 'Solo plan definition is required');
  const suffix = crypto.randomUUID();
  const user = await prisma.user.create({ data: { email: `phase3-${suffix}@example.test` } });
  const organization = await prisma.organization.create({
    data: {
      name: 'Phase 3 acceptance organization',
      slug: `phase3-${suffix}`,
      createdByUserId: user.id,
      memberships: { create: { userId: user.id, role: 'OWNER' } },
      subscription: { create: { planId: soloPlan.id, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000) } },
    },
  });
  const application = await prisma.application.create({ data: { organizationId: organization.id, name: 'Phase 3 React application' } });
  const environment = await prisma.environment.create({ data: { applicationId: application.id, name: 'Development', type: 'DEVELOPMENT' } });
  const device = await prisma.deviceSession.create({ data: {
    userId: user.id,
    organizationId: organization.id,
    deviceIdentifier: `phase3-${suffix}`,
    deviceName: 'Phase 3 verifier',
    platform: 'win32-x64',
    appVersion: '0.1.0',
    scopes: ['desktop:instrumentation', 'desktop:guided-runs'],
    refreshTokenHash: crypto.createHash('sha256').update(`phase3-refresh-${suffix}`).digest('hex'),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  } });
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.ACCEPTANCE_JWT_SECRET || process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production',
    { expiresIn: '15m' },
  );

  const initialSnapshot = scanWorkspace(fixtureRoot, { workspaceId: crypto.randomUUID(), scannerVersion: 'phase3-acceptance/1' });
  const workspace = await request(`/applications/${application.id}/workspaces`, {
    method: 'POST', body: JSON.stringify({
      opaqueLocalId: crypto.randomUUID(),
      repositoryFingerprint: initialSnapshot.repositoryFingerprint,
      detectedStack: initialSnapshot.frameworks,
      packageManager: initialSnapshot.packageManager,
    }),
  }, token);
  const snapshot = scanWorkspace(fixtureRoot, { workspaceId: workspace.id, scannerVersion: 'phase3-acceptance/1' });
  const repositorySnapshot = await request(`/applications/${application.id}/repository-snapshots`, {
    method: 'POST', body: JSON.stringify({
      workspaceId: workspace.id,
      revision: snapshot.revision,
      branch: snapshot.branch,
      dirty: snapshot.dirty,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      frameworkSummary: snapshot.frameworks,
      routeSummary: snapshot.routes,
      endpointSummary: snapshot.endpoints,
      documentationSummary: snapshot.documentation,
      manifestHashes: snapshot.manifestHashes,
      scannerVersion: snapshot.scannerVersion,
      redactionSummary: snapshot.redactionSummary,
    }),
  }, token);

  const adapter = getAdapter('react-vite');
  const context = { workspaceRoot: fixtureRoot, snapshot, environmentType: 'DEVELOPMENT' };
  const plan = await adapter.propose(context);
  assert(!plan.validationCommands.some((command) => command.id === 'install-sdk'), 'Preinstalled SDK still requested registry installation');
  const created = await request(`/v1/applications/${application.id}/instrumentation/plans`, {
    method: 'POST', body: JSON.stringify({
      workspaceId: workspace.id,
      repositorySnapshotId: repositorySnapshot.id,
      environmentId: environment.id,
      deviceSessionId: device.id,
      plan,
    }),
  }, token);
  assert(created.id === plan.id, 'Cloud plan did not retain the local task identity');
  const approvedCommandIds = plan.validationCommands.map((command) => command.id);
  const approval = await request(`/v1/applications/${application.id}/instrumentation/plans/${plan.id}/approve`, {
    method: 'POST', body: JSON.stringify({ approvedFileScopes: plan.approvedFileScopes, approvedCommandIds }),
  }, token);
  const expectedApprovalHash = createApprovalHash(plan, plan.approvedFileScopes, approvedCommandIds);
  assert(approval.approvalHash === expectedApprovalHash, 'Local/cloud task approval hashes diverged');
  const intent = await request(`/v1/applications/${application.id}/instrumentation/plans/${plan.id}/apply-intent`, {
    method: 'POST', body: JSON.stringify({ deviceSessionId: device.id }),
  }, token);

  const checkpoint = await createInstrumentationCheckpoint(fixtureRoot);
  assert(checkpoint.kind === 'GIT_BRANCH', `Expected Git checkpoint, received ${checkpoint.kind}: ${checkpoint.reason ?? ''}`);
  const patch = await adapter.apply(context, {
    plan,
    approvedFileScopes: plan.approvedFileScopes,
    approvedCommandIds,
    approvalHash: expectedApprovalHash,
    checkpointDirectory: checkpointRoot,
  });
  const commandResults = plan.validationCommands.map((command) => {
    const started = Date.now();
    try {
      const output = run(command.executable, command.args, path.resolve(fixtureRoot, command.cwd));
      return { id: command.id, purpose: command.purpose, passed: true, exitCode: 0, durationMs: Date.now() - started, output };
    } catch (error) {
      return { id: command.id, purpose: command.purpose, passed: false, exitCode: 1, durationMs: Date.now() - started, output: String(error) };
    }
  });
  const refreshedPatch = refreshPatchResult(context, patch);
  const validation = await adapter.validate(context, refreshedPatch);
  const sdkResolves = Boolean(createRequire(path.join(fixtureRoot, 'package.json')).resolve('@tellann/frontend-sdk/package.json'));
  validation.checks.push({ name: 'sdk-installed', passed: sdkResolves, output: '@tellann/frontend-sdk resolves from the external fixture' });
  for (const result of commandResults) validation.checks.push({ name: `command:${result.id}`, passed: result.passed, output: result.output });
  validation.valid = validation.checks.every((check) => check.passed);
  assert(validation.valid, `Instrumentation validation failed: ${JSON.stringify(validation.checks)}`);
  assert(fs.readFileSync(path.join(fixtureRoot, 'user-notes.txt'), 'utf8') === 'unrelated dirty user work', 'Instrumentation changed unrelated dirty work');

  const cloudPatch = await request(`/v1/applications/${application.id}/instrumentation/plans/${plan.id}/results`, {
    method: 'POST',
    headers: { 'x-tellann-instrumentation-capability': intent.capability },
    body: JSON.stringify({
      result: {
        planId: refreshedPatch.planId,
        checkpointId: refreshedPatch.checkpointId,
        baseRevision: refreshedPatch.baseRevision,
        files: refreshedPatch.files,
        changedFiles: refreshedPatch.changedFiles,
        diffHash: refreshedPatch.diffHash,
        appliedAt: refreshedPatch.appliedAt,
      },
      validation,
      commandResults,
      checkpointKind: checkpoint.kind,
      checkpointMetadata: checkpoint,
    }),
  }, token);
  assert(cloudPatch.status === 'VALIDATED' && cloudPatch.checkpointKind === 'GIT_BRANCH', 'Validated Git patch was not persisted');

  const runRecord = await request(`/applications/${application.id}/qa-runs`, {
    method: 'POST', body: JSON.stringify({
      environmentId: environment.id,
      workspaceId: workspace.id,
      deviceSessionId: device.id,
      repositorySnapshotId: repositorySnapshot.id,
      patchSetId: cloudPatch.id,
      mode: 'GUIDED',
      targetUrl: 'http://127.0.0.1:4173',
    }),
  }, token);
  const sessionId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const credential = await request(`/qa-runs/${runRecord.id}/credentials`, {
    method: 'POST', body: JSON.stringify({ sessionId, traceId }),
  }, token);
  await request(`/qa-runs/${runRecord.id}/start`, { method: 'POST' }, token);

  const relay = new LocalRunRelay();
  const relayState = await relay.start({
    collectorBaseUrl: gateway,
    runCredential: credential.credential,
    allowedOrigin: 'http://127.0.0.1:4173',
    correlation: {
      runId: runRecord.id,
      sessionId,
      traceId,
      organizationId: organization.id,
      applicationId: application.id,
      environmentId: environment.id,
    },
  });
  await relay.emit('INSTRUMENTATION_VERIFIED', { adapterId: plan.adapterId, manifestVersion: plan.manifestVersion, secret: 'must-redact' });
  await relay.stop();
  assert(relayState.endpoint.startsWith('http://127.0.0.1:'), 'Local relay was not bound to loopback');
  assert(relay.getQueue().length === 0, 'Correlated instrumentation event did not reach the collector');

  const homeEventId = crypto.randomUUID();
  const checkoutEventId = crypto.randomUUID();
  await request(`/qa-runs/${runRecord.id}/complete`, {
    method: 'POST', body: JSON.stringify({
      sessionId,
      traceId,
      observations: [
        { eventId: homeEventId, stateName: 'HOME', category: 'NAVIGATION', url: 'http://127.0.0.1:4173/', title: 'Home', timestamp: new Date().toISOString() },
        { eventId: checkoutEventId, stateName: 'CHECKOUT', category: 'BUSINESS', url: 'http://127.0.0.1:4173/checkout', title: 'Checkout', timestamp: new Date().toISOString() },
      ],
      observedTransitions: [{
        fromState: 'HOME',
        toState: 'CHECKOUT',
        fromEventId: homeEventId,
        toEventId: checkoutEventId,
        action: 'navigate',
        timestamp: new Date().toISOString(),
      }],
    }),
  }, token);
  const report = await request(`/qa-runs/${runRecord.id}/report`, {}, token);
  assert(report.instrumentation?.patchSetId === cloudPatch.id, 'Canonical report omitted the instrumentation patch');
  assert(report.instrumentation?.adapterId === 'react-vite', 'Canonical report omitted adapter provenance');
  assert(report.instrumentation?.validation?.valid === true, 'Canonical report omitted successful validation');
  assert(report.correlation?.sessions?.some((session) => session.sessionId === sessionId && session.traceId === traceId), 'Report lost run/session/trace correlation');
  assert(report.summary.observedStateCount === 2 && report.summary.observedTransitionCount === 1, 'Browser-observed behavior did not reach the report');

  const rollbackIntent = await request(`/v1/applications/${application.id}/instrumentation/plans/${plan.id}/rollback-intent`, {
    method: 'POST', body: JSON.stringify({ deviceSessionId: device.id }),
  }, token);
  const rollback = await adapter.rollback(context, refreshedPatch);
  assert(rollback.verified, `Local rollback failed: ${JSON.stringify(rollback.conflicts)}`);
  await request(`/v1/applications/${application.id}/instrumentation/plans/${plan.id}/rollback-results`, {
    method: 'POST',
    headers: { 'x-tellann-instrumentation-capability': rollbackIntent.capability },
    body: JSON.stringify({ patchSetId: rollbackIntent.patchSetId, result: rollback }),
  }, token);
  assert(!fs.existsSync(path.join(fixtureRoot, 'src', 'tellann.ts')), 'Rollback retained Tellann-generated source');
  assert(fs.readFileSync(path.join(fixtureRoot, 'user-notes.txt'), 'utf8') === 'unrelated dirty user work', 'Rollback removed unrelated dirty work');

  console.log(JSON.stringify({
    success: true,
    applicationId: application.id,
    workspaceId: workspace.id,
    planId: plan.id,
    patchSetId: cloudPatch.id,
    runId: runRecord.id,
    reportId: report.id,
    checkpointKind: checkpoint.kind,
    checkpointBranch: checkpoint.branch,
    sdkArtifactInstalled: true,
    registryInstallSkipped: true,
    validationPassed: true,
    runSessionTraceCorrelated: true,
    dirtyWorkPreserved: true,
    rollbackVerified: true,
  }, null, 2));
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    for (const target of [fixtureRoot, checkpointRoot]) {
      const resolved = path.resolve(target);
      if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('tellann-phase3-')) {
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    }
  });
