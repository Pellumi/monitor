import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();
const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-packaged-phase3-'));
const executablePath = path.resolve('apps/desktop/release/phase1/win-unpacked/Tellann.exe');
const sdkTarball = path.resolve('release/sdk/sots-frontend-sdk-0.1.0.tgz');
const authorizationHandoffPath = path.join(os.tmpdir(), 'tellann-packaged-phase3-authorize-url.txt');
const progressPath = path.join(os.tmpdir(), 'tellann-packaged-phase3-progress.txt');
const acceptancePassword = 'PackagedAcceptance42!';

function assert(value, message) {
  if (!value) throw new Error(`PACKAGED_PHASE3_ACCEPTANCE_FAILED: ${message}`);
}

function progress(message) {
  fs.writeFileSync(progressPath, `${new Date().toISOString()} ${message}\n`, { encoding: 'utf8', flag: 'a' });
}

async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, value) => error ? reject(error) : resolve(value));
  });
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

function command(executable, args, cwd = workspaceRoot) {
  let resolvedExecutable = executable;
  let resolvedArgs = args;
  if (process.platform === 'win32' && /^(npm|pnpm|yarn)\.cmd$/i.test(executable)) {
    const manager = executable.replace(/\.cmd$/i, '').toLowerCase();
    const launchers = execFileSync('where.exe', [`${manager}.cmd`], { encoding: 'utf8', windowsHide: true })
      .split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const relativeCli = manager === 'npm' ? ['node_modules', 'npm', 'bin', 'npm-cli.js']
      : manager === 'pnpm' ? ['node_modules', 'pnpm', 'bin', 'pnpm.cjs']
        : ['node_modules', 'yarn', 'bin', 'yarn.js'];
    const cli = launchers.map((launcher) => path.join(path.dirname(launcher), ...relativeCli)).find((candidate) => fs.existsSync(candidate));
    assert(cli, `${manager} CLI was not resolved safely`);
    resolvedExecutable = process.execPath;
    resolvedArgs = [cli, ...args];
  }
  return execFileSync(resolvedExecutable, resolvedArgs, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 }).trim();
}

function createFixture() {
  assert(fs.existsSync(sdkTarball), 'frontend SDK tarball is missing');
  fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'tellann-packaged-desktop-acceptance', private: true, version: '1.0.0',
    scripts: { build: `node -e "console.log('packaged desktop validation passed')"` },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      vite: '^7.0.0',
      '@sots/frontend-sdk': `file:${sdkTarball.replace(/\\/g, '/')}`,
    },
  }, null, 2));
  fs.writeFileSync(path.join(workspaceRoot, 'src', 'main.tsx'), `import { createRoot } from 'react-dom/client';\nasync function checkout() { return { ok: true }; }\ncreateRoot(document.body).render(null);\nvoid checkout();\n`);
  fs.writeFileSync(path.join(workspaceRoot, '.gitignore'), 'node_modules/\n');
  const sdkDirectory = path.join(workspaceRoot, 'node_modules', '@sots', 'frontend-sdk');
  fs.mkdirSync(sdkDirectory, { recursive: true });
  command('tar.exe', ['-xf', sdkTarball, '-C', sdkDirectory, '--strip-components=1']);
  command('git', ['init']);
  command('git', ['config', 'user.email', 'packaged-acceptance@tellann.local']);
  command('git', ['config', 'user.name', 'Tellann Packaged Acceptance']);
  command('git', ['add', '.']);
  command('git', ['commit', '-m', 'Packaged desktop acceptance fixture']);
  fs.writeFileSync(path.join(workspaceRoot, 'user-notes.txt'), 'preserve unrelated dirty work');
}

async function main() {
  assert(fs.existsSync(executablePath), 'packaged desktop executable is missing');
  fs.rmSync(authorizationHandoffPath, { force: true });
  fs.rmSync(progressPath, { force: true });
  progress('creating fixture');
  createFixture();
  progress('fixture ready');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><title>Packaged QA fixture</title></head><body><main><h1>Checkout ready</h1><button aria-label="Complete checkout">Complete checkout</button></main></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string', 'fixture server did not bind');

  let desktop;
  let originalPlanId = null;
  let organizationId = null;
  let acceptanceUserId = null;
  try {
    const abandonedAcceptance = await prisma.user.deleteMany({ where: { email: { startsWith: 'packaged-phase3-', endsWith: '@example.com' } } });
    const targetMembership = await prisma.organizationMembership.findFirst({
      where: { organization: { applications: { some: { environments: { some: { type: { in: ['DEVELOPMENT', 'STAGING'] } } } } } } },
      select: { organizationId: true },
      orderBy: { joinedAt: 'asc' },
    });
    assert(targetMembership, 'no organization with a controllable application is available');
    const acceptanceEmail = `packaged-phase3-${crypto.randomUUID()}@example.com`;
    const acceptanceUser = await prisma.user.create({
      data: {
        email: acceptanceEmail,
        displayName: 'Packaged Phase 3 Acceptance',
        passwordHash: await passwordHash(acceptancePassword),
        preferredAuthMode: 'PASSWORD',
        passwordUpdatedAt: new Date(),
        memberships: { create: { organizationId: targetMembership.organizationId, role: 'OWNER' } },
      },
    });
    acceptanceUserId = acceptanceUser.id;
    progress('acceptance identity ready');
    desktop = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${path.join(workspaceRoot, '.tellann-user-data')}`],
      env: {
        ...process.env,
        TELLANN_API_URL: 'http://127.0.0.1:3000',
        TELLANN_AUTH_URL: 'http://127.0.0.1:3000',
        TELLANN_BROWSER_HEADLESS: 'true',
      },
      timeout: 60_000,
    });
    progress('packaged process launched');
    const page = await desktop.firstWindow({ timeout: 60_000 });
    progress('desktop window ready');
    await page.waitForFunction(() => Boolean(window.tellann), undefined, { timeout: 30_000 });
    progress('preload bridge ready');
    progress('managed browser automation configured');
    let session = await page.evaluate(() => window.tellann.auth.getSession());
    progress(`session read: ${session.authenticated ? 'authenticated' : 'anonymous'}`);
    if (!session.authenticated) {
      console.log('PACKAGED_DESKTOP_AUTHORIZATION_REQUIRED');
      progress('installing system-browser capture');
      const captureInstalled = await desktop.evaluate(({ shell }) => {
        globalThis.__tellannCapturedExternalUrl = null;
        const capture = async (url) => {
          globalThis.__tellannCapturedExternalUrl = url;
        };
        const before = Object.getOwnPropertyDescriptor(shell, 'openExternal');
        Object.defineProperty(shell, 'openExternal', { configurable: true, enumerable: true, value: capture, writable: true });
        return { installed: shell.openExternal === capture, before: { configurable: before?.configurable, writable: before?.writable } };
      });
      assert(captureInstalled.installed, 'could not install packaged system-browser authorization capture');
      progress(`system-browser capture installed: ${JSON.stringify(captureInstalled)}`);
      await page.evaluate(() => {
        window.__tellannPackagedSignIn = window.tellann.auth.signIn();
      });
      progress('desktop sign-in initiated');
      let authorizeUrl = null;
      for (let attempt = 0; attempt < 50 && !authorizeUrl; attempt += 1) {
        authorizeUrl = await desktop.evaluate(() => globalThis.__tellannCapturedExternalUrl);
        if (!authorizeUrl) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert(authorizeUrl, 'packaged desktop did not open the system-browser authorization URL');
      fs.writeFileSync(authorizationHandoffPath, JSON.stringify({ authorizeUrl, email: acceptanceEmail, password: acceptancePassword }), { encoding: 'utf8', mode: 0o600 });
      console.log(`PACKAGED_DESKTOP_AUTHORIZE_URL=${authorizeUrl}`);
      progress('waiting for system-browser authorization');
      session = await page.evaluate(() => window.__tellannPackagedSignIn);
    }
    progress('desktop authorization complete');
    assert(session.authenticated && session.user?.id, 'packaged desktop system-browser authentication did not complete');
    assert(session.user.id === acceptanceUserId, 'packaged desktop authenticated the wrong acceptance user');

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { include: { applications: { include: { environments: true } }, subscription: true } } },
      orderBy: { joinedAt: 'desc' },
    });
    assert(membership?.organization.applications.length, 'authenticated desktop user has no application');
    organizationId = membership.organizationId;
    originalPlanId = membership.organization.subscription?.planId ?? null;
    const solo = await prisma.plan.findUnique({ where: { type: 'SOLO' } });
    const free = abandonedAcceptance.count > 0 ? await prisma.plan.findUnique({ where: { type: 'FREE' } }) : null;
    if (abandonedAcceptance.count > 0 && free) originalPlanId = free.id;
    assert(solo, 'Solo plan is missing');
    if (membership.organization.subscription) {
      await prisma.subscription.update({ where: { organizationId }, data: { planId: solo.id, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000) } });
    } else {
      await prisma.subscription.create({ data: { organizationId, planId: solo.id, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000) } });
    }
    await prisma.entitlement.deleteMany({ where: { organizationId } });

    const applications = await page.evaluate(() => window.tellann.projects.list());
    progress('application entitlements loaded');
    const application = applications.find((item) => item.organizationId === organizationId);
    assert(application?.entitlements?.features.AUTOMATED_INSTRUMENTATION, 'desktop did not resolve the temporary Solo instrumentation entitlement');
    const environment = application.environments.find((item) => item.type === 'DEVELOPMENT') ?? application.environments.find((item) => item.type === 'STAGING');
    assert(environment, 'application has no development or staging environment');
    const localWorkspaceId = crypto.randomUUID();
    await page.evaluate(({ path, applicationId, workspaceId }) => window.tellann.projects.scanWorkspace({ path, applicationId, workspaceId }), {
      path: workspaceRoot, applicationId: application.id, workspaceId: localWorkspaceId,
    });
    progress('workspace scanned');
    const context = { applicationId: application.id, environmentId: environment.id, environmentType: environment.type };
    const detection = await page.evaluate((input) => window.tellann.instrumentation.detect(input), context);
    const react = detection.detections.find((item) => item.adapterId === 'react-vite');
    assert(react?.supported, 'packaged desktop did not detect the React/Vite fixture');
    const created = await page.evaluate((input) => window.tellann.instrumentation.propose({ ...input, adapterId: 'react-vite' }), context);
    const planId = String(created.id);
    const record = await page.evaluate(({ applicationId, planId }) => window.tellann.instrumentation.get(applicationId, planId), { applicationId: application.id, planId });
    const plan = record.planJson;
    assert(!plan.validationCommands.some((command) => command.id === 'install-sdk'), 'preinstalled SDK incorrectly required registry installation');
    await page.evaluate((input) => window.tellann.instrumentation.approve(input), {
      ...context, planId, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: plan.validationCommands.map((command) => command.id),
    });
    const applied = await page.evaluate(({ applicationId, planId }) => window.tellann.instrumentation.apply(applicationId, planId), { applicationId: application.id, planId });
    progress('instrumentation applied and validated');
    assert(applied.validation.valid, 'packaged desktop validation failed');
    assert(fs.readFileSync(path.join(workspaceRoot, 'user-notes.txt'), 'utf8') === 'preserve unrelated dirty work', 'packaged apply changed unrelated dirty work');

    const run = await page.evaluate((input) => window.tellann.runs.start(input), {
      applicationId: application.id, environmentId: environment.id, workspaceId: localWorkspaceId,
      expectedGraphVersionId: null, patchSetId: applied.cloud.id, environmentType: environment.type,
      mode: 'GUIDED', targetUrl: `http://127.0.0.1:${address.port}`,
    });
    progress('managed browser run started');
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const ended = await page.evaluate(() => window.tellann.runs.end());
    progress('managed browser evidence synchronized');
    assert(ended.observations.length > 0, 'managed browser produced no observed state');
    let report = null;
    for (let attempt = 0; attempt < 20 && !report; attempt += 1) {
      report = await page.evaluate((runId) => window.tellann.runs.getReport(runId).catch(() => null), run.runId);
      if (!report) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(report?.instrumentation?.patchSetId === applied.cloud.id, 'packaged run report lost instrumentation provenance');
    assert(report.summary.observedStateCount > 0, 'packaged run report has no browser-observed states');
    progress('canonical report received');

    const rollback = await page.evaluate(({ applicationId, planId }) => window.tellann.instrumentation.rollback(applicationId, planId), { applicationId: application.id, planId });
    assert(rollback.verified, 'packaged desktop rollback was not verified');
    assert(!fs.existsSync(path.join(workspaceRoot, 'src', 'tellann.ts')), 'packaged rollback retained generated instrumentation');
    assert(fs.readFileSync(path.join(workspaceRoot, 'user-notes.txt'), 'utf8') === 'preserve unrelated dirty work', 'packaged rollback removed unrelated dirty work');
    progress('instrumentation rollback verified');

    console.log(JSON.stringify({
      success: true, applicationId: application.id, environmentId: environment.id, planId,
      patchSetId: applied.cloud.id, runId: run.runId, reportId: report.id,
      entitlementResolvedInDesktop: true, managedBrowserObserved: true,
      instrumentationProvenanceInReport: true, validationRenderedContractAvailable: true,
      dirtyWorkPreserved: true, rollbackVerified: true,
    }, null, 2));
  } finally {
    await desktop?.close().catch(() => undefined);
    await new Promise((resolve) => server.close(() => resolve()));
    if (organizationId) {
      if (originalPlanId) await prisma.subscription.update({ where: { organizationId }, data: { planId: originalPlanId } }).catch(() => undefined);
      await prisma.entitlement.deleteMany({ where: { organizationId } }).catch(() => undefined);
    }
    if (acceptanceUserId) await prisma.user.delete({ where: { id: acceptanceUserId } }).catch(() => undefined);
    fs.rmSync(authorizationHandoffPath, { force: true });
    await prisma.$disconnect();
    const resolved = path.resolve(workspaceRoot);
    if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('tellann-packaged-phase3-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
