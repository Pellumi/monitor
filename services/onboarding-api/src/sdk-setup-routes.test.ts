import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@sots/db';
import { createSdkSetupRouter } from './sdk-setup-routes';

const prisma = new PrismaClient();

async function seed() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `sdk-setup-${suffix}@example.test` } });
  const foreignUser = await prisma.user.create({ data: { email: `sdk-setup-foreign-${suffix}@example.test` } });
  const organization = await prisma.organization.create({ data: { name: 'SDK setup', slug: `sdk-setup-${suffix}`, createdByUserId: user.id } });
  const foreignOrganization = await prisma.organization.create({ data: { name: 'Foreign SDK setup', slug: `sdk-setup-foreign-${suffix}`, createdByUserId: foreignUser.id } });
  await prisma.organizationMembership.createMany({ data: [
    { userId: user.id, organizationId: organization.id, role: 'OWNER' },
    { userId: foreignUser.id, organizationId: foreignOrganization.id, role: 'OWNER' },
  ] });
  const application = await prisma.application.create({ data: { name: 'SDK setup app', organizationId: organization.id } });
  const foreignApplication = await prisma.application.create({ data: { name: 'Foreign SDK app', organizationId: foreignOrganization.id } });
  const development = await prisma.environment.create({ data: { applicationId: application.id, name: 'Development', type: 'DEVELOPMENT', isDefault: true } });
  const production = await prisma.environment.create({ data: { applicationId: application.id, name: 'Production', type: 'PRODUCTION' } });
  await prisma.applicationOnboardingProgress.create({ data: { applicationId: application.id } });
  const deviceA = await prisma.deviceSession.create({ data: {
    userId: user.id, organizationId: organization.id, deviceIdentifier: `sdk-a-${suffix}`, deviceName: 'Device A',
    platform: 'win32-x64', appVersion: '0.1.0', scopes: ['desktop:instrumentation'],
    refreshTokenHash: crypto.createHash('sha256').update(`sdk-a-${suffix}`).digest('hex'),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  } });
  const deviceB = await prisma.deviceSession.create({ data: {
    userId: user.id, organizationId: organization.id, deviceIdentifier: `sdk-b-${suffix}`, deviceName: 'Device B',
    platform: 'win32-x64', appVersion: '0.1.0', scopes: ['desktop:instrumentation'],
    refreshTokenHash: crypto.createHash('sha256').update(`sdk-b-${suffix}`).digest('hex'),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  } });
  return { user, foreignUser, organization, foreignOrganization, application, foreignApplication, development, production, deviceA, deviceB };
}

type Seed = Awaited<ReturnType<typeof seed>>;

async function cleanup(value: Seed) {
  await prisma.desktopSetupHandoff.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.apiKey.deleteMany({ where: { environmentId: { in: [value.development.id, value.production.id] } } });
  await prisma.deviceSession.deleteMany({ where: { id: { in: [value.deviceA.id, value.deviceB.id] } } });
  await prisma.environment.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.application.deleteMany({ where: { id: { in: [value.application.id, value.foreignApplication.id] } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: [value.organization.id, value.foreignOrganization.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [value.organization.id, value.foreignOrganization.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [value.user.id, value.foreignUser.id] } } });
}

async function request(baseUrl: string, userId: string, pathname: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-test-user': userId, ...init.headers },
  });
}

test('SDK setup enforces tenancy, environment policy, safe gateway URLs, atomic handoff claims, and active-device consumption', async () => {
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
  app.use(createSdkSetupRouter({ prisma, verifyJwt, verifyAppOwnership }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const descriptor = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup?environmentId=${data.development.id}`);
    assert.equal(descriptor.status, 200);
    const descriptorBody = await descriptor.json() as { gatewayEndpoint: string; targets: unknown[]; hasActiveKey: boolean };
    assert.equal(descriptorBody.gatewayEndpoint, 'http://localhost:3000');
    assert.equal(descriptorBody.targets.length, 2);
    assert.equal(descriptorBody.hasActiveKey, false);

    const foreignDescriptor = await request(baseUrl, data.foreignUser.id, `/applications/${data.application.id}/sdk-setup`);
    assert.equal(foreignDescriptor.status, 403);

    const unsafeGateway = await request(baseUrl, data.user.id, `/applications/${data.application.id}/environments/${data.development.id}/sdk-settings`, {
      method: 'PATCH', body: JSON.stringify({ telemetryGatewayUrl: 'http://example.com/collector?token=secret' }),
    });
    assert.equal(unsafeGateway.status, 400);
    const safeGateway = await request(baseUrl, data.user.id, `/applications/${data.application.id}/environments/${data.development.id}/sdk-settings`, {
      method: 'PATCH', body: JSON.stringify({ telemetryGatewayUrl: 'https://collector.example.test' }),
    });
    assert.equal(safeGateway.status, 200, await safeGateway.text());

    const invalidMethod = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/method`, {
      method: 'PATCH', body: JSON.stringify({ method: 'REMOTE_SHELL' }),
    });
    assert.equal(invalidMethod.status, 400);
    const method = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/method`, {
      method: 'PATCH', body: JSON.stringify({ method: 'DESKTOP' }),
    });
    assert.equal(method.status, 200, await method.text());

    const key = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/key`, {
      method: 'POST', body: JSON.stringify({ environmentId: data.development.id }),
    });
    assert.equal(key.status, 201);
    const keyBody = await key.json() as { rawKey: string; keyPrefix: string };
    assert.match(keyBody.rawKey, /^sots_[a-f0-9]{64}$/);
    assert.ok(keyBody.rawKey.startsWith(keyBody.keyPrefix));
    const storedKey = await prisma.apiKey.findFirstOrThrow({ where: { environmentId: data.development.id, keyPrefix: keyBody.keyPrefix } });
    assert.notEqual(storedKey.keyHash, keyBody.rawKey);
    assert.equal(storedKey.keyHash, crypto.createHash('sha256').update(keyBody.rawKey).digest('hex'));

    const productionKey = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/key`, {
      method: 'POST', body: JSON.stringify({ environmentId: data.production.id }),
    });
    assert.equal(productionKey.status, 403);
    const productionHandoff = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/handoffs`, {
      method: 'POST', body: JSON.stringify({ environmentId: data.production.id }),
    });
    assert.equal(productionHandoff.status, 403);

    const handoff = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/handoffs`, {
      method: 'POST', body: JSON.stringify({ environmentId: data.development.id }),
    });
    assert.equal(handoff.status, 201);
    const handoffBody = await handoff.json() as { handoffToken: string; deepLink: string };
    assert.ok(handoffBody.deepLink.startsWith('tellann://connect?handoff='));
    const foreignClaim = await request(baseUrl, data.foreignUser.id, '/desktop/setup-handoffs/claim', {
      method: 'POST', body: JSON.stringify({ handoffToken: handoffBody.handoffToken, deviceSessionId: data.deviceA.id }),
    });
    assert.equal(foreignClaim.status, 404);

    const claims = await Promise.all([data.deviceA.id, data.deviceB.id].map((deviceSessionId) => request(baseUrl, data.user.id, '/desktop/setup-handoffs/claim', {
      method: 'POST', body: JSON.stringify({ handoffToken: handoffBody.handoffToken, deviceSessionId }),
    })));
    assert.deepEqual(claims.map((response) => response.status).sort(), [200, 409]);
    const winningDevice = claims[0].status === 200 ? data.deviceA : data.deviceB;
    const claimed = await claims.find((response) => response.status === 200)!.json() as { id: string };
    await prisma.deviceSession.update({ where: { id: winningDevice.id }, data: { revokedAt: new Date() } });
    const revokedConsume = await request(baseUrl, data.user.id, `/desktop/setup-handoffs/${claimed.id}/consume`, {
      method: 'POST', body: JSON.stringify({ deviceSessionId: winningDevice.id }),
    });
    assert.equal(revokedConsume.status, 403);

    const secondHandoff = await request(baseUrl, data.user.id, `/applications/${data.application.id}/sdk-setup/handoffs`, {
      method: 'POST', body: JSON.stringify({ environmentId: data.development.id }),
    });
    const second = await secondHandoff.json() as { handoffToken: string };
    const activeDevice = winningDevice.id === data.deviceA.id ? data.deviceB : data.deviceA;
    const secondClaim = await request(baseUrl, data.user.id, '/desktop/setup-handoffs/claim', {
      method: 'POST', body: JSON.stringify({ handoffToken: second.handoffToken, deviceSessionId: activeDevice.id }),
    });
    assert.equal(secondClaim.status, 200);
    const secondClaimed = await secondClaim.json() as { id: string };
    const consumed = await request(baseUrl, data.user.id, `/desktop/setup-handoffs/${secondClaimed.id}/consume`, {
      method: 'POST', body: JSON.stringify({ deviceSessionId: activeDevice.id }),
    });
    assert.equal(consumed.status, 200, await consumed.text());
    const replay = await request(baseUrl, data.user.id, `/desktop/setup-handoffs/${secondClaimed.id}/consume`, {
      method: 'POST', body: JSON.stringify({ deviceSessionId: activeDevice.id }),
    });
    assert.equal(replay.status, 409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup(data);
    await prisma.$disconnect();
  }
});
