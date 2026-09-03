import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import zlib from 'node:zlib';
import express, { type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@tellann/db';
import { StorageClient, LocalFsStorageAdapter, decryptArchive } from '@tellann/storage';
import { createCodebaseRouter } from './codebase-routes';

const prisma = new PrismaClient();
const anyPrisma = prisma as any;

type DesktopRequest = Request & { user?: { id: string; email: string } };

async function seed() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `codebase-${suffix}@example.test` } });
  const intruder = await prisma.user.create({ data: { email: `codebase-other-${suffix}@example.test` } });
  const organization = await prisma.organization.create({
    data: { name: 'Codebase', slug: `codebase-${suffix}`, createdByUserId: user.id },
  });
  await prisma.organizationSettings.create({ data: { organizationId: organization.id } });
  await prisma.organizationMembership.create({
    data: { userId: user.id, organizationId: organization.id, role: 'OWNER' },
  });
  const application = await prisma.application.create({
    data: { name: 'Codebase app', organizationId: organization.id },
  });
  const workspace = await prisma.projectWorkspace.create({
    data: {
      organizationId: organization.id, applicationId: application.id, createdByUserId: user.id,
      opaqueLocalId: crypto.randomUUID(), repositoryFingerprint: 'a'.repeat(64),
      trustStatus: 'TRUSTED', packageManager: 'pnpm',
    },
  });
  return { suffix, user, intruder, organization, application, workspace };
}

type Harness = {
  url: string;
  close: () => Promise<void>;
  storageDirectory: string;
  actAs: (userId: string, email: string) => void;
};

/** Minimal stand-in for the entitlement checker, to exercise the paid gate. */
function entitlementStub(allowed: boolean) {
  return { canAccess: async () => allowed } as unknown as Parameters<typeof createCodebaseRouter>[0]['entitlementChecker'];
}

async function harness(
  actingUserId: string,
  actingEmail: string,
  entitlementChecker?: Parameters<typeof createCodebaseRouter>[0]['entitlementChecker'],
): Promise<Harness> {
  let currentUser = { id: actingUserId, email: actingEmail };
  const storageDirectory = `${process.env.TEMP ?? '/tmp'}/tellann-codebase-test-${crypto.randomUUID().slice(0, 8)}`;
  const storage = new StorageClient(new LocalFsStorageAdapter(storageDirectory));

  const app = express();
  app.use(express.json({ limit: '30mb' }));
  const verifyJwt = (req: DesktopRequest, _res: Response, next: NextFunction) => {
    req.user = currentUser;
    next();
  };
  // Mirrors the production check: membership in the owning organisation.
  const verifyAppOwnership = async (req: DesktopRequest, res: Response, next: NextFunction) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.appId },
      select: { organizationId: true },
    });
    if (!application?.organizationId) return res.status(404).json({ error: 'Application not found' });
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: application.organizationId, userId: req.user!.id },
    });
    if (!membership) return res.status(403).json({ error: 'FORBIDDEN' });
    return next();
  };
  app.use(createCodebaseRouter({ prisma, verifyJwt, verifyAppOwnership, storage, entitlementChecker }));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    storageDirectory,
    actAs: (id, email) => { currentUser = { id, email }; },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function call(url: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${url}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** A gzip archive in the format the worker expects to unpack. */
function buildArchive(files: Array<{ path: string; content: string }>) {
  const entries = files.map((file) => {
    const buffer = Buffer.from(file.content, 'utf8');
    return {
      path: file.path,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      contentBase64: buffer.toString('base64'),
    };
  });
  const buffer = zlib.gzipSync(Buffer.from(JSON.stringify({ format: 'tellann-codebase-v1', files: entries })));
  return { buffer, checksum: crypto.createHash('sha256').update(buffer).digest('hex') };
}

async function upload(url: string, appId: string, workspaceId: string, archive: { buffer: Buffer; checksum: string }) {
  const initiated = await call(url, `/applications/${appId}/codebase/uploads`, {
    method: 'POST',
    body: { workspaceId, totalParts: 1, contentHash: archive.checksum, totalBytes: archive.buffer.length },
  });
  await call(url, `/applications/${appId}/codebase/uploads/${initiated.body.uploadId}/parts/0`, {
    method: 'PUT',
    body: { dataBase64: archive.buffer.toString('base64') },
  });
  return call(url, `/applications/${appId}/codebase/snapshots`, {
    method: 'POST',
    body: {
      uploadId: initiated.body.uploadId,
      workspaceId,
      repositoryFingerprint: 'a'.repeat(64),
      scannerVersion: 'test-1',
      revision: 'abc1234',
      branch: 'main',
      dirty: false,
      fileCount: 1,
      totalBytes: archive.buffer.length,
    },
  });
}

test('accepts a chunked upload and queues exactly one analysis job', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const archive = buildArchive([{ path: 'src/index.ts', content: 'export const value = 1;' }]);
  const created = await upload(api.url, data.application.id, data.workspace.id, archive);

  assert.equal(created.status, 202);
  assert.ok(created.body.jobId);
  assert.equal(created.body.encrypted, false, 'no key is configured in this test environment');
  assert.ok(created.body.retentionUntil, 'retention must be set at creation, not left null');

  const job = await anyPrisma.codebaseAnalysisJob.findUnique({ where: { id: created.body.jobId } });
  assert.equal(job.status, 'QUEUED');

  const stored = await anyPrisma.sourceArchive.findUnique({ where: { codebaseSnapshotId: created.body.snapshotId } });
  assert.equal(stored.status, 'READY');
  assert.ok(stored.retentionUntil > new Date(), 'the retention deadline must be in the future');
  assert.ok(stored.objectKey);

  // The stored object must unpack back to what was sent.
  const storage = new StorageClient(new LocalFsStorageAdapter(api.storageDirectory));
  const downloaded = decryptArchive(await storage.download(stored.objectKey));
  const unpacked = JSON.parse(zlib.gunzipSync(downloaded).toString('utf8'));
  assert.equal(unpacked.files[0].path, 'src/index.ts');
});

test('rejects an archive whose checksum does not match what was declared', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const archive = buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]);
  const initiated = await call(api.url, `/applications/${data.application.id}/codebase/uploads`, {
    method: 'POST',
    body: { workspaceId: data.workspace.id, totalParts: 1, contentHash: 'f'.repeat(64), totalBytes: archive.buffer.length },
  });
  await call(api.url, `/applications/${data.application.id}/codebase/uploads/${initiated.body.uploadId}/parts/0`, {
    method: 'PUT', body: { dataBase64: archive.buffer.toString('base64') },
  });
  const created = await call(api.url, `/applications/${data.application.id}/codebase/snapshots`, {
    method: 'POST',
    body: {
      uploadId: initiated.body.uploadId, workspaceId: data.workspace.id,
      repositoryFingerprint: 'a'.repeat(64), scannerVersion: 'test-1',
    },
  });
  assert.equal(created.status, 400);
  assert.equal(created.body.error, 'SOURCE_ARCHIVE_CHECKSUM_MISMATCH');
});

test('refuses to create a snapshot from an incomplete upload and names the missing parts', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const initiated = await call(api.url, `/applications/${data.application.id}/codebase/uploads`, {
    method: 'POST',
    body: { workspaceId: data.workspace.id, totalParts: 3, contentHash: 'b'.repeat(64), totalBytes: 100 },
  });
  await call(api.url, `/applications/${data.application.id}/codebase/uploads/${initiated.body.uploadId}/parts/0`, {
    method: 'PUT', body: { dataBase64: Buffer.from('part-zero').toString('base64') },
  });
  const created = await call(api.url, `/applications/${data.application.id}/codebase/snapshots`, {
    method: 'POST',
    body: {
      uploadId: initiated.body.uploadId, workspaceId: data.workspace.id,
      repositoryFingerprint: 'a'.repeat(64), scannerVersion: 'test-1',
    },
  });
  assert.equal(created.status, 409);
  assert.deepEqual(created.body.missing, [1, 2]);
});

test('re-sending a part resumes a transfer instead of duplicating it', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const archive = buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]);
  const initiated = await call(api.url, `/applications/${data.application.id}/codebase/uploads`, {
    method: 'POST',
    body: { workspaceId: data.workspace.id, totalParts: 1, contentHash: archive.checksum, totalBytes: archive.buffer.length },
  });
  const path = `/applications/${data.application.id}/codebase/uploads/${initiated.body.uploadId}/parts/0`;
  await call(api.url, path, { method: 'PUT', body: { dataBase64: Buffer.from('a bad first attempt').toString('base64') } });
  const second = await call(api.url, path, { method: 'PUT', body: { dataBase64: archive.buffer.toString('base64') } });

  assert.equal(second.body.received, 1, 'the re-sent part replaces the first attempt');
  const created = await call(api.url, `/applications/${data.application.id}/codebase/snapshots`, {
    method: 'POST',
    body: {
      uploadId: initiated.body.uploadId, workspaceId: data.workspace.id,
      repositoryFingerprint: 'a'.repeat(64), scannerVersion: 'test-1',
    },
  });
  assert.equal(created.status, 202);
});

test('supersedes an in-flight analysis when a newer snapshot arrives', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const first = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  const second = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 2;' }]));

  assert.notEqual(first.body.jobId, second.body.jobId);
  const superseded = await anyPrisma.codebaseAnalysisJob.findUnique({ where: { id: first.body.jobId } });
  assert.equal(superseded.status, 'CANCELLED');
  assert.match(superseded.stageMessage, /Superseded/);
});

test('deduplicates an identical snapshot instead of re-analysing it', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const archive = buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]);
  const first = await upload(api.url, data.application.id, data.workspace.id, archive);
  const second = await upload(api.url, data.application.id, data.workspace.id, archive);

  assert.equal(second.status, 200);
  assert.equal(second.body.deduplicated, true);
  assert.equal(second.body.jobId, first.body.jobId);
});

test('cancels a running job and refuses to cancel a finished one twice', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  const first = await call(api.url, `/applications/${data.application.id}/codebase/analyses/${created.body.jobId}/cancel`, { method: 'POST' });
  const second = await call(api.url, `/applications/${data.application.id}/codebase/analyses/${created.body.jobId}/cancel`, { method: 'POST' });

  assert.equal(first.body.cancelled, true);
  assert.equal(second.body.cancelled, false, 'a terminal job cannot be cancelled again');
});

test('refuses to retry when the source snapshot has been deleted under retention', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  await anyPrisma.codebaseAnalysisJob.update({
    where: { id: created.body.jobId },
    data: { status: 'FAILED', completedAt: new Date() },
  });
  await anyPrisma.sourceArchive.update({
    where: { codebaseSnapshotId: created.body.snapshotId },
    data: { status: 'DELETED', objectKey: null, deletedAt: new Date() },
  });

  const retried = await call(api.url, `/applications/${data.application.id}/codebase/analyses/${created.body.jobId}/retry`, { method: 'POST' });
  assert.equal(retried.status, 409);
  assert.equal(retried.body.error, 'SOURCE_ARCHIVE_UNAVAILABLE');
});

test('deletes a snapshot permanently on request', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  const before = await anyPrisma.sourceArchive.findUnique({ where: { codebaseSnapshotId: created.body.snapshotId } });

  const deleted = await call(api.url, `/applications/${data.application.id}/codebase/snapshots/${created.body.snapshotId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);

  const after = await anyPrisma.sourceArchive.findUnique({ where: { codebaseSnapshotId: created.body.snapshotId } });
  assert.equal(after.status, 'DELETED');
  assert.equal(after.objectKey, null);
  const ledger = await prisma.storageLedgerEntry.findFirst({ where: { objectKey: before.objectKey } });
  assert.ok(ledger?.deletedAt, 'the storage ledger must record the deletion');
});

test('stores an organisation retention override and applies it to new snapshots', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const rejected = await call(api.url, `/applications/${data.application.id}/codebase/retention`, {
    method: 'PUT', body: { retentionDays: 4_000 },
  });
  assert.equal(rejected.status, 400);

  const accepted = await call(api.url, `/applications/${data.application.id}/codebase/retention`, {
    method: 'PUT', body: { retentionDays: 3 },
  });
  assert.equal(accepted.status, 200);

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  const archive = await anyPrisma.sourceArchive.findUnique({ where: { codebaseSnapshotId: created.body.snapshotId } });
  const days = (archive.retentionUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1_000);
  assert.ok(days > 2.5 && days < 3.5, `expected roughly 3 days of retention, got ${days}`);
});

test('isolates tenants: a non-member cannot reach another organisation codebase', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  assert.equal(created.status, 202);

  api.actAs(data.intruder.id, data.intruder.email);
  for (const [method, path] of [
    ['GET', `/applications/${data.application.id}/codebase/analyses/latest`],
    ['GET', `/applications/${data.application.id}/codebase/overview`],
    ['POST', `/applications/${data.application.id}/codebase/graph`],
    ['DELETE', `/applications/${data.application.id}/codebase/snapshots/${created.body.snapshotId}`],
  ] as const) {
    const response = await call(api.url, path, { method, body: method === 'POST' ? {} : undefined });
    assert.equal(response.status, 403, `${method} ${path} must be refused for a non-member`);
  }
});

test('will not let one member upload against another member workspace', async (t) => {
  const data = await seed();
  await prisma.organizationMembership.create({
    data: { userId: data.intruder.id, organizationId: data.organization.id, role: 'MEMBER' },
  });
  const api = await harness(data.intruder.id, data.intruder.email);
  t.after(async () => { await api.close(); });

  // The intruder is a member of the organisation, but the workspace is one
  // person's checkout on one machine and is not theirs.
  const response = await call(api.url, `/applications/${data.application.id}/codebase/uploads`, {
    method: 'POST',
    body: { workspaceId: data.workspace.id, totalParts: 1, contentHash: 'c'.repeat(64), totalBytes: 10 },
  });
  assert.equal(response.status, 404);
});

test('reports no analysis rather than an error before the first run', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  for (const path of ['analyses/latest', 'overview', 'features', 'hierarchy']) {
    const response = await call(api.url, `/applications/${data.application.id}/codebase/${path}`);
    assert.equal(response.status, 404, `${path} should report absence, not fail`);
  }
});

test('needs two completed analyses before it will compare them', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const response = await call(api.url, `/applications/${data.application.id}/codebase/compare`);
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'NOT_ENOUGH_ANALYSES');
});

test('validates a graph query and bounds its limits', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const invalid = await call(api.url, `/applications/${data.application.id}/codebase/graph`, {
    method: 'POST', body: { depth: 99, limit: 999_999, types: 'not-an-array' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'INVALID_GRAPH_QUERY');
});

test('reports whether archive encryption is configured rather than assuming it', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email);
  t.after(async () => { await api.close(); });

  const response = await call(api.url, `/applications/${data.application.id}/codebase/health`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.archiveEncryption, 'boolean');
});

test('refuses every codebase route when the plan does not include the feature', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email, entitlementStub(false));
  t.after(async () => { await api.close(); });

  for (const [method, path] of [
    ['POST', `/applications/${data.application.id}/codebase/uploads`],
    ['GET', `/applications/${data.application.id}/codebase/analyses/latest`],
    ['GET', `/applications/${data.application.id}/codebase/overview`],
    ['POST', `/applications/${data.application.id}/codebase/graph`],
    ['POST', `/applications/${data.application.id}/codebase/ask`],
  ] as const) {
    const response = await call(api.url, path, { method, body: method === 'POST' ? {} : undefined });
    assert.equal(response.status, 403, `${method} ${path} must be gated on the entitlement`);
    assert.equal(response.body.feature, 'CODEBASE_INTELLIGENCE');
  }
});

test('allows the same routes once the organisation is entitled', async (t) => {
  const data = await seed();
  const api = await harness(data.user.id, data.user.email, entitlementStub(true));
  t.after(async () => { await api.close(); });

  const created = await upload(api.url, data.application.id, data.workspace.id,
    buildArchive([{ path: 'a.ts', content: 'export const a = 1;' }]));
  assert.equal(created.status, 202);
});

test.after(async () => { await prisma.$disconnect(); });
