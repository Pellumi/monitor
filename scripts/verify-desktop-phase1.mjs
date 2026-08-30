import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');

const gateway = process.env.API_GATEWAY_URL ?? 'http://127.0.0.1:3000';
const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(`ACCEPTANCE_FAILED: ${message}`);
}

async function request(path, init = {}, token) {
  const response = await fetch(`${gateway}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function rawRequest(path, content, headers, token) {
  const response = await fetch(`${gateway}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      ...headers,
    },
    body: content,
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { memberships: { some: {} } },
    select: { id: true, email: true },
  });
  assert(user, 'A local member account is required');
  const browserAccessToken = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.ACCEPTANCE_JWT_SECRET || process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production',
    { expiresIn: '10m' },
  );

  const verifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const authorization = await request('/auth/desktop/authorize', {
    method: 'POST',
    body: JSON.stringify({
      codeChallenge,
      deviceIdentifier: `phase1-proof-${crypto.randomUUID()}`,
      deviceName: 'Phase 1 acceptance proof',
      platform: 'win32-x64',
      appVersion: '0.1.0',
      scopes: ['desktop:guided-runs', 'desktop:read-workspace'],
    }),
  });
  await request('/auth/desktop/authorize/complete', {
    method: 'POST',
    body: JSON.stringify({ requestToken: authorization.requestToken }),
  }, browserAccessToken);
  const desktopSession = await request('/auth/desktop/token', {
    method: 'POST',
    body: JSON.stringify({ requestToken: authorization.requestToken, codeVerifier: verifier }),
  });
  assert(desktopSession.accessToken && desktopSession.refreshToken, 'Desktop PKCE exchange did not issue tokens');

  const rotated = await request('/auth/desktop/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: desktopSession.refreshToken }),
  });
  assert(rotated.refreshToken !== desktopSession.refreshToken, 'Desktop refresh token was not rotated');
  const token = rotated.accessToken;

  const applications = await request('/applications', {}, token);
  const application = applications.find((item) =>
    item.environments?.some((environment) => environment.type === 'DEVELOPMENT' || environment.type === 'STAGING'));
  assert(application, 'No development or staging application is available');
  const environment = application.environments.find((item) => item.type === 'STAGING')
    ?? application.environments.find((item) => item.type === 'DEVELOPMENT');
  let productionEnvironment = application.environments.find((item) => item.type === 'PRODUCTION');
  let temporaryProductionEnvironment = false;
  if (!productionEnvironment) {
    productionEnvironment = await prisma.environment.create({
      data: {
        applicationId: application.id,
        name: `Phase 1 production policy ${crypto.randomUUID()}`,
        type: 'PRODUCTION',
        sdkEnabled: false,
      },
    });
    temporaryProductionEnvironment = true;
  }
  const blocked = await fetch(`${gateway}/applications/${application.id}/qa-runs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      environmentId: productionEnvironment.id,
      mode: 'GUIDED',
      targetUrl: 'https://example.com',
    }),
  });
  if (temporaryProductionEnvironment) {
    await prisma.environment.delete({ where: { id: productionEnvironment.id } });
  }
  assert(blocked.status === 403, 'Production active browser control was not blocked');

  const opaqueLocalId = crypto.randomUUID();
  const fingerprint = crypto.createHash('sha256').update(`phase1:${application.id}`).digest('hex');
  const workspace = await request(`/applications/${application.id}/workspaces`, {
    method: 'POST',
    body: JSON.stringify({
      opaqueLocalId,
      repositoryFingerprint: fingerprint,
      detectedStack: [{ framework: 'acceptance-proof', confidence: 1 }],
      packageManager: null,
    }),
  }, token);
  assert(!('path' in workspace), 'Cloud workspace leaked an absolute local path');

  const snapshot = await request(`/applications/${application.id}/repository-snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: workspace.id,
      revision: null,
      branch: null,
      dirty: false,
      repositoryFingerprint: fingerprint,
      frameworkSummary: [{ framework: 'acceptance-proof', confidence: 1 }],
      routeSummary: ['/auth/login'],
      endpointSummary: [],
      documentationSummary: ['docs/current-user-guide.md'],
      manifestHashes: {},
      scannerVersion: 'acceptance-proof/1',
      redactionSummary: { excludedFiles: 1, suspectedSecrets: 0 },
    }),
  }, token);

  const run = await request(`/applications/${application.id}/qa-runs`, {
    method: 'POST',
    body: JSON.stringify({
      environmentId: environment.id,
      workspaceId: workspace.id,
      repositorySnapshotId: snapshot.id,
      deviceSessionId: desktopSession.deviceSessionId,
      mode: 'GUIDED',
      targetUrl: 'http://127.0.0.1:3010/auth/login',
    }),
  }, token);
  const sessionId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const runCredential = await request(`/qa-runs/${run.id}/credentials`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, traceId }),
  }, token);
  const claims = jwt.decode(runCredential.credential);
  assert(claims.runId === run.id && claims.sessionId === sessionId && claims.traceId === traceId,
    'Run credential correlation is incomplete');
  await request(`/qa-runs/${run.id}/start`, { method: 'POST' }, token);

  const approvedContent = Buffer.from(`approved binary browser evidence:${run.id}`);
  const checksum = crypto.createHash('sha256').update(approvedContent).digest('hex');
  const mismatch = await rawRequest(
    `/qa-runs/${run.id}/artifacts/${'0'.repeat(64)}/content`,
    approvedContent,
    { 'x-tellann-artifact-type': 'SCREENSHOT' },
    token,
  );
  assert(mismatch.response.status === 422, 'Artifact checksum failure was not rejected');
  const uploaded = await rawRequest(
    `/qa-runs/${run.id}/artifacts/${checksum}/content`,
    approvedContent,
    {
      'x-tellann-artifact-type': 'SCREENSHOT',
      'x-tellann-privacy-classification': 'INTERNAL',
    },
    token,
  );
  assert(uploaded.response.status === 201 && uploaded.body.objectKey, 'Artifact bytes were not uploaded to managed storage');
  await request(`/qa-runs/${run.id}/artifacts`, {
    method: 'POST',
    body: JSON.stringify({
      artifacts: [],
      findings: [{
        category: 'ACCESSIBILITY',
        severity: 'LOW',
        confidence: 0.9,
        title: 'Acceptance evidence finding',
        description: 'Browser evidence reached the tenant-scoped run.',
        url: 'http://127.0.0.1:3010/auth/login',
        viewport: { width: 1440, height: 900 },
        reproductionSteps: ['Open the managed browser', 'Inspect the login page'],
        recommendation: 'Review the captured evidence.',
      }],
    }),
  }, token);
  const firstEventId = crypto.randomUUID();
  const secondEventId = crypto.randomUUID();
  await request(`/qa-runs/${run.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      traceId,
      observations: [
        {
          eventId: firstEventId,
          stateName: 'AUTH_LOGIN',
          category: 'NAVIGATION',
          url: 'http://127.0.0.1:3010/auth/login',
          title: 'Sign in',
          timestamp: new Date(Date.now() - 1_000).toISOString(),
        },
        {
          eventId: secondEventId,
          stateName: 'DASHBOARD',
          category: 'NAVIGATION',
          url: 'http://127.0.0.1:3010/dashboard',
          title: 'Dashboard',
          timestamp: new Date().toISOString(),
        },
      ],
      observedTransitions: [{
        fromEventId: firstEventId,
        toEventId: secondEventId,
        fromState: 'AUTH_LOGIN',
        toState: 'DASHBOARD',
        action: 'NAVIGATE',
        timestamp: new Date().toISOString(),
      }],
    }),
  }, token);
  await request(`/applications/${application.id}/reconciliation/run`, {
    method: 'POST',
    body: JSON.stringify({ environmentId: environment.id, runId: run.id }),
  }, token);
  const report = await request(`/qa-runs/${run.id}/report`, {}, token);
  assert(report.runId === run.id, 'Report is not run-scoped');
  assert(report.summary.artifactCount === 1, 'Approved artifact missing from report');
  assert(report.summary.findingCount === 1, 'Browser finding missing from report');
  const [observedSession, observedStateCount, observedTransitionCount] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.stateObservation.count({ where: { sessionId } }),
    prisma.transitionObservation.count({ where: { sessionId } }),
  ]);
  assert(observedSession?.qaRunId === run.id, 'Browser observations were not correlated to the QA run');
  assert(observedStateCount === 2, 'Browser states were not materialized');
  assert(observedTransitionCount === 1, 'Browser transition was not materialized');

  let foreignUser = await prisma.user.findFirst({
    where: { id: { not: user.id }, memberships: { none: { organizationId: application.organizationId } } },
    select: { id: true, email: true },
  });
  let temporaryForeignUser = false;
  if (!foreignUser) {
    foreignUser = await prisma.user.create({
      data: { email: `phase1-isolation-${crypto.randomUUID()}@tellann.invalid`, displayName: 'Phase 1 isolation proof' },
      select: { id: true, email: true },
    });
    temporaryForeignUser = true;
  }
  const foreignToken = jwt.sign(
    { sub: foreignUser.id, email: foreignUser.email },
    process.env.ACCEPTANCE_JWT_SECRET || process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production',
    { expiresIn: '10m' },
  );
  const denied = await fetch(`${gateway}/qa-runs/${run.id}`, {
    headers: { authorization: `Bearer ${foreignToken}` },
  });
  if (temporaryForeignUser) await prisma.user.delete({ where: { id: foreignUser.id } });
  assert(denied.status === 404, 'Cross-tenant QA-run access was not denied');

  await request(`/auth/desktop/devices/${desktopSession.deviceSessionId}`, { method: 'DELETE' }, token);
  const rejectedRefresh = await fetch(`${gateway}/auth/desktop/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  });
  assert(rejectedRefresh.status === 401, 'Revoked device can still refresh');

  console.log(JSON.stringify({
    accepted: true,
    userId: user.id,
    applicationId: application.id,
    environmentId: environment.id,
    workspaceId: workspace.id,
    repositorySnapshotId: snapshot.id,
    runId: run.id,
    reportId: report.id,
    artifactCount: report.summary.artifactCount,
    findingCount: report.summary.findingCount,
    uploadedArtifactObjectKey: uploaded.body.objectKey,
    observedStateCount,
    observedTransitionCount,
    crossTenantChecked: true,
    productionActiveControlBlocked: true,
    uploadChecksumFailureRejected: true,
    sdkInstalled: false,
    repositoryWriteGranted: false,
    commandPermissionGranted: false,
    deviceRefreshRejectedAfterRevocation: true,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
