import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@tellann/db';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import { createInstrumentationRouter } from './instrumentation-routes';

const prisma = new PrismaClient();
const jwtSecret = 'instrumentation-route-test-secret-that-is-long-enough';

type Seed = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `phase3-${suffix}@example.test` } });
  const foreignUser = await prisma.user.create({ data: { email: `phase3-foreign-${suffix}@example.test` } });
  const organization = await prisma.organization.create({ data: { name: 'Phase 3', slug: `phase3-${suffix}`, createdByUserId: user.id } });
  const foreignOrganization = await prisma.organization.create({ data: { name: 'Foreign Phase 3', slug: `phase3-foreign-${suffix}`, createdByUserId: foreignUser.id } });
  await prisma.organizationMembership.createMany({ data: [
    { userId: user.id, organizationId: organization.id, role: 'OWNER' },
    { userId: foreignUser.id, organizationId: foreignOrganization.id, role: 'OWNER' },
  ] });
  const application = await prisma.application.create({ data: { name: 'Phase 3 app', organizationId: organization.id } });
  const foreignApplication = await prisma.application.create({ data: { name: 'Foreign app', organizationId: foreignOrganization.id } });
  const environment = await prisma.environment.create({ data: { applicationId: application.id, name: 'Development', type: 'DEVELOPMENT' } });
  const production = await prisma.environment.create({ data: { applicationId: application.id, name: 'Production', type: 'PRODUCTION' } });
  const device = await prisma.deviceSession.create({ data: {
    userId: user.id, organizationId: organization.id, deviceIdentifier: `device-${suffix}`,
    deviceName: 'test', platform: 'win32-x64', appVersion: '0.1.0', scopes: ['desktop:instrumentation'],
    refreshTokenHash: crypto.createHash('sha256').update(`refresh-${suffix}`).digest('hex'),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  } });
  const workspace = await prisma.projectWorkspace.create({ data: {
    organizationId: organization.id, applicationId: application.id, createdByUserId: user.id,
    opaqueLocalId: crypto.randomUUID(), repositoryFingerprint: 'a'.repeat(64), trustStatus: 'TRUSTED', packageManager: 'npm',
  } });
  const snapshot = await prisma.repositorySnapshot.create({ data: {
    workspaceId: workspace.id, revision: null, dirty: true, repositoryFingerprint: 'a'.repeat(64),
    frameworkSummary: [], routeSummary: [], endpointSummary: [], documentationSummary: [], manifestHashes: {},
    scannerVersion: 'test', redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
  } });
  return { suffix, user, foreignUser, organization, foreignOrganization, application, foreignApplication, environment, production, device, workspace, snapshot };
}

function plan(seedValue: Seed, id = crypto.randomUUID(), taskKey = crypto.randomBytes(32).toString('hex')) {
  return {
    contractVersion: '1.0', manifestVersion: '1.0', id, taskKey,
    adapterId: 'react-vite', adapterVersion: '1.0.0', frameworkVersion: '7.0.0', supportedVersionRange: '>=4 <9',
    baseRevision: null, repositoryFingerprint: seedValue.snapshot.repositoryFingerprint,
    approvedFileScopes: ['package.json', 'src/tellann.ts', 'src/main.tsx'],
    packageChanges: [{ packageName: '@tellann/frontend-sdk', version: '^0.1.0', kind: 'dependency' }],
    operations: [
      { id: 'package-sdk', kind: 'UPDATE_PACKAGE', relativePath: 'package.json', symbol: '@tellann/frontend-sdk', transformId: 'tellann.package-json.dependency', transformVersion: '1.0.0', expectedHash: 'b'.repeat(64), description: 'Add SDK', eventMappings: [] },
      { id: 'generated-config', kind: 'CREATE_FILE', relativePath: 'src/tellann.ts', symbol: null, transformId: 'tellann.generated.config', transformVersion: '1.0.0', expectedHash: null, description: 'Create config', eventMappings: [] },
      { id: 'entry-import', kind: 'UPDATE_SOURCE', relativePath: 'src/main.tsx', symbol: 'createRoot', transformId: 'tellann.entry.import', transformVersion: '1.0.0', expectedHash: 'c'.repeat(64), description: 'Import SDK', eventMappings: [] },
    ],
    validationCommands: [
      { id: 'install-sdk', executable: 'npm.cmd', args: ['install', '@tellann/frontend-sdk@^0.1.0'], cwd: '.', timeoutMs: 60_000, allowedEnvironmentKeys: ['PATH', 'SystemRoot'], purpose: 'Install SDK', networkRequired: true },
      { id: 'validate-build', executable: 'npm.cmd', args: ['run', 'build'], cwd: '.', timeoutMs: 60_000, allowedEnvironmentKeys: ['PATH', 'SystemRoot'], purpose: 'Build', networkRequired: false },
    ],
    networkRequirements: ['Package registry'], risk: 'LOW', riskReasons: ['Bounded test task'],
    evidence: { entryPoints: [], existingInstrumentation: [], semanticBoundaries: [] }, createdAt: new Date().toISOString(),
  };
}

async function request(baseUrl: string, userId: string, pathname: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-test-user': userId, ...init.headers },
  });
}

async function cleanup(value: Seed) {
  await prisma.activationEvent.deleteMany({ where: { organizationId: { in: [value.organization.id, value.foreignOrganization.id] } } });
  await prisma.projectWorkspace.deleteMany({ where: { id: value.workspace.id } });
  await prisma.deviceSession.deleteMany({ where: { id: value.device.id } });
  await prisma.environment.deleteMany({ where: { applicationId: { in: [value.application.id, value.foreignApplication.id] } } });
  await prisma.application.deleteMany({ where: { id: { in: [value.application.id, value.foreignApplication.id] } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [value.organization.id, value.foreignOrganization.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [value.organization.id, value.foreignOrganization.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [value.user.id, value.foreignUser.id] } } });
}

test('instrumentation lifecycle enforces tenancy, production policy, approval scope, one-time capability, replay, and device revocation', async () => {
  const data = await seed();
  const app = express();
  app.use(express.json());
  const verifyJwt = (req: Request & { user?: { id: string; email: string } }, res: Response, next: NextFunction) => {
    const id = String(req.headers['x-test-user'] ?? '');
    const selected = id === data.user.id ? data.user : id === data.foreignUser.id ? data.foreignUser : null;
    if (!selected) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    req.user = { id: selected.id, email: selected.email };
    next();
  };
  const verifyAppOwnership = async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
    const allowed = await prisma.application.count({ where: { id: req.params.appId, organization: { memberships: { some: { userId: req.user!.id } } } } });
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    next();
  };
  let entitled = true;
  const entitlementChecker = { canAccess: async () => entitled } as unknown as EntitlementChecker;
  app.use(createInstrumentationRouter({ prisma, entitlementChecker, verifyJwt, verifyAppOwnership, jwtSecret }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const proposedPlan = plan(data);
    const create = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: proposedPlan }),
    });
    assert.equal(create.status, 201, await create.text());

    entitled = false;
    const deniedByPlan = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`);
    assert.equal(deniedByPlan.status, 403);
    entitled = true;

    const maliciousPlan = plan(data);
    maliciousPlan.validationCommands[0].executable = 'powershell.exe';
    const malicious = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: maliciousPlan }),
    });
    assert.equal(malicious.status, 400);

    const foreign = await request(baseUrl, data.user.id, `/v1/applications/${data.foreignApplication.id}/instrumentation/plans`);
    assert.equal(foreign.status, 403);

    const productionPlan = plan(data);
    const production = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.production.id, deviceSessionId: data.device.id, plan: productionPlan }),
    });
    assert.equal(production.status, 403);

    const invalidApproval = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/approve`, {
      method: 'POST', body: JSON.stringify({ approvedFileScopes: ['../outside.ts'], approvedCommandIds: [] }),
    });
    assert.equal(invalidApproval.status, 400);

    const approve = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/approve`, {
      method: 'POST', body: JSON.stringify({ approvedFileScopes: proposedPlan.approvedFileScopes, approvedCommandIds: proposedPlan.validationCommands.map((item) => item.id) }),
    });
    assert.equal(approve.status, 200, await approve.text());

    const intent = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/apply-intent`, {
      method: 'POST', body: JSON.stringify({ deviceSessionId: data.device.id }),
    });
    assert.equal(intent.status, 200);
    const capability = (await intent.json() as { capability: string }).capability;
    const result = { planId: proposedPlan.id, checkpointId: crypto.randomUUID(), baseRevision: null, diffHash: 'd'.repeat(64), files: [{ relativePath: 'package.json', beforeHash: 'b'.repeat(64), afterHash: 'e'.repeat(64), changed: true }] };
    const missingCapability = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/results`, {
      method: 'POST', body: JSON.stringify({ result, validation: { valid: true, checks: [] } }),
    });
    assert.equal(missingCapability.status, 401);
    const submitted = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/results`, {
      method: 'POST', headers: { 'x-tellann-instrumentation-capability': capability }, body: JSON.stringify({
        result,
        validation: { valid: true, checks: [] },
        checkpointKind: 'GIT_BRANCH',
        checkpointMetadata: {
          branch: 'tellann/instrument-20260811T120000Z-a1b2c3',
          previousBranch: 'main',
          baseRevision: null,
          dirty: true,
          reason: null,
          createdAt: new Date().toISOString(),
        },
      }),
    });
    const submittedBody = await submitted.json() as { checkpointKind: string; checkpointMetadata: { branch: string; dirty: boolean }; error?: string };
    assert.equal(submitted.status, 201, submittedBody.error);
    assert.equal(submittedBody.checkpointKind, 'GIT_BRANCH');
    assert.equal(submittedBody.checkpointMetadata.branch, 'tellann/instrument-20260811T120000Z-a1b2c3');
    assert.equal(submittedBody.checkpointMetadata.dirty, true);
    const replay = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${proposedPlan.id}/results`, {
      method: 'POST', headers: { 'x-tellann-instrumentation-capability': capability }, body: JSON.stringify({ result, validation: { valid: true, checks: [] } }),
    });
    assert.equal(replay.status, 200);

    const revokedPlan = plan(data);
    await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`, { method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: revokedPlan }) });
    await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${revokedPlan.id}/approve`, { method: 'POST', body: JSON.stringify({ approvedFileScopes: revokedPlan.approvedFileScopes, approvedCommandIds: revokedPlan.validationCommands.map((item) => item.id) }) });
    const revokedIntentResponse = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${revokedPlan.id}/apply-intent`, { method: 'POST', body: JSON.stringify({ deviceSessionId: data.device.id }) });
    const revokedCapability = (await revokedIntentResponse.json() as { capability: string }).capability;
    await prisma.deviceSession.update({ where: { id: data.device.id }, data: { revokedAt: new Date() } });
    const revokedResult = { ...result, planId: revokedPlan.id, checkpointId: crypto.randomUUID(), diffHash: 'f'.repeat(64) };
    const revoked = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans/${revokedPlan.id}/results`, { method: 'POST', headers: { 'x-tellann-instrumentation-capability': revokedCapability }, body: JSON.stringify({ result: revokedResult, validation: { valid: true, checks: [] } }) });
    assert.equal(revoked.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup(data);
    await prisma.$disconnect();
  }
});
