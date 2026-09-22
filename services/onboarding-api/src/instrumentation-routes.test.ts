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

/**
 * Serve the instrumentation router against the seeded organisation, standing in
 * for the gateway's authentication and ownership middleware.
 */
async function serve(data: Seed) {
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
  const state = { entitled: true };
  const entitlementChecker = { canAccess: async () => state.entitled } as unknown as EntitlementChecker;
  app.use(createInstrumentationRouter({ prisma, entitlementChecker, verifyJwt, verifyAppOwnership, jwtSecret }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, state, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function cleanup(value: Seed) {
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: [value.organization.id, value.foreignOrganization.id] } } });
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
  const { server, state, baseUrl } = await serve(data);

  try {
    const proposedPlan = plan(data);
    const create = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: proposedPlan }),
    });
    assert.equal(create.status, 201, await create.text());

    state.entitled = false;
    const deniedByPlan = await request(baseUrl, data.user.id, `/v1/applications/${data.application.id}/instrumentation/plans`);
    assert.equal(deniedByPlan.status, 403);
    state.entitled = true;

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
          branch: 'tellann/qa-review',
          previousBranch: 'tellann/qa-review',
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
    assert.equal(submittedBody.checkpointMetadata.branch, 'tellann/qa-review');
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

test('setup tasks carry a derived title, filter by title, status, framework and date, and rename, archive and restore into the audit log', async () => {
  const data = await seed();
  const { server, baseUrl } = await serve(data);
  const plansPath = `/v1/applications/${data.application.id}/instrumentation/plans`;
  const flow = await prisma.behaviorGraph.create({ data: {
    applicationId: data.application.id, name: `Checkout ${data.suffix}`, lifecycleStatus: 'PUBLISHED',
  } });
  const version = await prisma.behaviorGraphVersion.create({ data: {
    graphId: flow.id, version: 1, snapshot: { states: [], transitions: [] },
  } });

  try {
    const bootstrap = plan(data);
    const created = await request(baseUrl, data.user.id, plansPath, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: bootstrap }),
    });
    assert.equal(created.status, 201, await created.text());

    const flowPlan = { ...plan(data), instrumentationPurpose: 'FLOW', flowId: flow.id, flowVersionId: version.id };
    const createdFlow = await request(baseUrl, data.user.id, plansPath, {
      method: 'POST', body: JSON.stringify({ workspaceId: data.workspace.id, repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id, deviceSessionId: data.device.id, plan: flowPlan }),
    });
    assert.equal(createdFlow.status, 201, await createdFlow.text());

    // A task is named for what it does: connecting Tellann, or the Flow it sets up.
    const listed = await (await request(baseUrl, data.user.id, plansPath)).json() as Array<{ id: string; title: string }>;
    assert.equal(listed.find((item) => item.id === bootstrap.id)?.title, 'Initialisation');
    assert.equal(listed.find((item) => item.id === flowPlan.id)?.title, `Checkout ${data.suffix}`);

    // Searching reaches those derived titles, not only stored ones.
    const byFlowName = await (await request(baseUrl, data.user.id, `${plansPath}?q=checkout`)).json() as Array<{ id: string }>;
    assert.deepEqual(byFlowName.map((item) => item.id), [flowPlan.id]);
    const byInitialisation = await (await request(baseUrl, data.user.id, `${plansPath}?q=initial`)).json() as Array<{ id: string }>;
    assert.deepEqual(byInitialisation.map((item) => item.id), [bootstrap.id]);

    const byStatus = await (await request(baseUrl, data.user.id, `${plansPath}?status=PROPOSED`)).json() as unknown[];
    assert.equal(byStatus.length, 2);
    assert.equal((await (await request(baseUrl, data.user.id, `${plansPath}?status=COMPLETED`)).json() as unknown[]).length, 0);
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}?status=NOT_A_STATUS`)).status, 400);
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}?adapterId=nope`)).status, 400);
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}?from=yesterday`)).status, 400);

    const byFramework = await (await request(baseUrl, data.user.id, `${plansPath}?adapterId=react-vite`)).json() as unknown[];
    assert.equal(byFramework.length, 2);

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await (await request(baseUrl, data.user.id, `${plansPath}?from=${today}&to=${today}`)).json() as unknown[];
    assert.equal(inRange.length, 2, 'a date-only range covers the whole day it names');
    const beforeRange = await (await request(baseUrl, data.user.id, `${plansPath}?to=2000-01-01`)).json() as unknown[];
    assert.equal(beforeRange.length, 0);

    // Renaming replaces the derived title and is searchable by the new one.
    const renamed = await request(baseUrl, data.user.id, `${plansPath}/${bootstrap.id}`, { method: 'PATCH', body: JSON.stringify({ title: '  Connect the storefront  ' }) });
    assert.equal(renamed.status, 200, await renamed.text());
    const byNewTitle = await (await request(baseUrl, data.user.id, `${plansPath}?q=storefront`)).json() as Array<{ id: string; title: string }>;
    assert.deepEqual(byNewTitle.map((item) => item.id), [bootstrap.id]);
    assert.equal(byNewTitle[0].title, 'Connect the storefront');
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}/${bootstrap.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'x'.repeat(121) }) })).status, 400);

    // Clearing the title restores the derived one rather than leaving it blank.
    const cleared = await request(baseUrl, data.user.id, `${plansPath}/${bootstrap.id}`, { method: 'PATCH', body: JSON.stringify({ title: '' }) });
    assert.equal((await cleared.json() as { title: string }).title, 'Initialisation');

    // Archiving takes a task out of the working list without losing it.
    const archived = await request(baseUrl, data.user.id, `${plansPath}/${flowPlan.id}/archive`, { method: 'POST' });
    assert.equal(archived.status, 200, await archived.text());
    assert.ok((await archived.json() as { archivedAt: string | null }).archivedAt);
    const active = await (await request(baseUrl, data.user.id, plansPath)).json() as Array<{ id: string }>;
    assert.deepEqual(active.map((item) => item.id), [bootstrap.id]);
    const archiveView = await (await request(baseUrl, data.user.id, `${plansPath}?archived=true`)).json() as Array<{ id: string }>;
    assert.deepEqual(archiveView.map((item) => item.id), [flowPlan.id]);
    const both = await (await request(baseUrl, data.user.id, `${plansPath}?archived=all`)).json() as unknown[];
    assert.equal(both.length, 2);
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}?archived=maybe`)).status, 400);

    // A task being applied right now cannot be filed away out from under it.
    await prisma.instrumentationPlan.update({ where: { id: bootstrap.id }, data: { status: 'APPLYING' } });
    assert.equal((await request(baseUrl, data.user.id, `${plansPath}/${bootstrap.id}/archive`, { method: 'POST' })).status, 409);
    await prisma.instrumentationPlan.update({ where: { id: bootstrap.id }, data: { status: 'PROPOSED' } });

    const restored = await request(baseUrl, data.user.id, `${plansPath}/${flowPlan.id}/restore`, { method: 'POST' });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json() as { archivedAt: string | null }).archivedAt, null);
    assert.equal((await (await request(baseUrl, data.user.id, plansPath)).json() as unknown[]).length, 2);

    // Another organisation's member cannot reach any of it.
    assert.equal((await request(baseUrl, data.foreignUser.id, `${plansPath}/${bootstrap.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'theirs' }) })).status, 403);
    assert.equal((await request(baseUrl, data.foreignUser.id, `${plansPath}/${flowPlan.id}/archive`, { method: 'POST' })).status, 403);

    // Every one of those acts is in the organisation's audit history.
    const audits = await prisma.auditLog.findMany({ where: { organizationId: data.organization.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(audits.map((entry) => entry.action), ['INSTRUMENTATION_RENAMED', 'INSTRUMENTATION_RENAMED', 'INSTRUMENTATION_ARCHIVED', 'INSTRUMENTATION_RESTORED']);
    assert.equal(audits.every((entry) => entry.userId === data.user.id), true);
    assert.equal((audits[0].metadata as { title: string }).title, 'Connect the storefront');
    assert.equal((audits[2].metadata as { planId: string }).planId, flowPlan.id);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.instrumentationPlan.deleteMany({ where: { workspaceId: data.workspace.id } });
    await prisma.behaviorGraphVersion.deleteMany({ where: { graphId: flow.id } });
    await prisma.behaviorGraph.deleteMany({ where: { id: flow.id } });
    await cleanup(data);
    await prisma.$disconnect();
  }
});
