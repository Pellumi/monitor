import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@tellann/db';
import { createFlowLifecycleRouter } from './flow-lifecycle-routes';

/**
 * The Flow initialization routes against a real database.
 *
 * Everything else about evidence-grounded mapping is exercised without one, and
 * that is exactly how the feature could be green everywhere and still not work:
 * the pipeline's first act is to write columns that a database without the
 * flow_mapping_v2 migration does not have. Nothing in a unit test can notice
 * that. This walks the routes a desktop client actually calls, in order, so the
 * schema, the contract enforcement and the mode gate are all proven together.
 */

const prisma = new PrismaClient();

const STATE_START = '10000000-0000-4000-8000-00000000a001';
const STATE_DONE = '10000000-0000-4000-8000-00000000a002';
const TRANSITION = '20000000-0000-4000-8000-00000000a001';

type Seed = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `flow-init-${suffix}@example.test` } });
  const organization = await prisma.organization.create({ data: { name: 'Flow init', slug: `flow-init-${suffix}`, createdByUserId: user.id } });
  await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: organization.id, role: 'OWNER' } });
  const application = await prisma.application.create({ data: { name: 'Flow init app', organizationId: organization.id } });
  const environment = await prisma.environment.create({ data: { applicationId: application.id, name: 'Development', type: 'DEVELOPMENT' } });
  const workspace = await prisma.projectWorkspace.create({ data: {
    organizationId: organization.id, applicationId: application.id, createdByUserId: user.id,
    opaqueLocalId: crypto.randomUUID(), repositoryFingerprint: 'd'.repeat(64), trustStatus: 'TRUSTED', packageManager: 'npm',
  } });
  const snapshot = await prisma.repositorySnapshot.create({ data: {
    workspaceId: workspace.id, revision: 'abc1234', branch: 'main', dirty: true, repositoryFingerprint: 'd'.repeat(64),
    frameworkSummary: [], routeSummary: [], endpointSummary: [], documentationSummary: [], manifestHashes: {},
    scannerVersion: 'test', redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
  } });
  const flow = await prisma.behaviorGraph.create({ data: {
    applicationId: application.id, name: `Checkout ${suffix}`, workflowType: 'USER_JOURNEY', status: 'COMPLETE',
  } });
  const snapshotJson = {
    name: flow.name,
    states: [
      { id: STATE_START, stateName: 'Cart viewed', category: 'UI', role: 'INITIAL' },
      { id: STATE_DONE, stateName: 'Paid', category: 'UI', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ id: TRANSITION, fromStateId: STATE_START, toStateId: STATE_DONE, action: 'Submit payment' }],
  };
  const version = await prisma.behaviorGraphVersion.create({ data: {
    graphId: flow.id, version: 1, snapshot: snapshotJson as never, lifecycleStatus: 'PUBLISHED',
  } });
  // Initialization is refused until the SDK has actually reported in, which is
  // the same gate the desktop shows as "SDK connected". One initialized session
  // is the whole of it.
  const session = await prisma.session.create({ data: {
    id: crypto.randomUUID(), applicationId: application.id, environmentId: environment.id,
    tenantId: organization.id, startTime: new Date(Date.now() - 60_000), endTime: new Date(),
  } });
  await prisma.sessionEvent.create({ data: {
    sessionId: session.id, eventType: 'TELLANN_INITIALIZED', eventVersion: '1.0',
    source: 'frontend-sdk', timestamp: new Date(), metadata: {},
  } });

  // Initialization is only offered for a published Flow pointing at a published
  // version, which is the same precondition the desktop enforces before it
  // shows the button at all.
  const published = await prisma.behaviorGraph.update({
    where: { id: flow.id },
    data: { lifecycleStatus: 'PUBLISHED', publishedVersionId: version.id },
  });
  return { suffix, user, organization, application, environment, workspace, snapshot, flow: published, version, session };
}

async function cleanup(value: Seed) {
  await prisma.sessionEvent.deleteMany({ where: { sessionId: value.session.id } });
  await prisma.session.deleteMany({ where: { id: value.session.id } });
  await prisma.flowInitialization.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.flowScan.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.flowProjectBinding.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.behaviorGraphVersion.deleteMany({ where: { graphId: value.flow.id } });
  await prisma.behaviorGraph.deleteMany({ where: { id: value.flow.id } });
  await prisma.repositorySnapshot.deleteMany({ where: { workspaceId: value.workspace.id } });
  await prisma.projectWorkspace.deleteMany({ where: { id: value.workspace.id } });
  await prisma.environment.deleteMany({ where: { applicationId: value.application.id } });
  await prisma.application.deleteMany({ where: { id: value.application.id } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: value.organization.id } });
  await prisma.organization.deleteMany({ where: { id: value.organization.id } });
  await prisma.user.deleteMany({ where: { id: value.user.id } });
}

async function request(baseUrl: string, userId: string, pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-test-user': userId, ...init.headers },
  });
  // Read once: a response body can only be consumed a single time, and an
  // assertion message that reads it would leave nothing for the assertion.
  const text = await response.text();
  return {
    status: response.status,
    text,
    json: () => JSON.parse(text) as any,
  };
}

/** Assert the status, and show the server's own words when it disagrees. */
function expectStatus(response: { status: number; text: string }, expected: number) {
  assert.equal(response.status, expected, response.text);
}

/** The bundle Electron submits: ranked candidates, one per declared checkpoint. */
function mappingBundle(checkpointIds: string[]) {
  return {
    analysis: {
      id: 'analysis-1', graphVersion: 'graph-1', contentHash: 'content-1',
      revision: 'abc1234', branch: 'main', dirty: true,
    },
    retrievalVersion: '2.0.0',
    consentMode: 'LOCAL_GRAPH_ONLY',
    mappings: checkpointIds.map((checkpointId, index) => ({
      checkpointId,
      status: 'AMBIGUOUS',
      candidates: [
        {
          id: `${checkpointId}:entity-${index}`, entityId: `entity-${index}`,
          file: 'src/checkout.ts', symbol: 'checkout', startLine: 4, endLine: 12,
          score: 0.62, confidence: 0.6, placementKinds: ['FUNCTION_ENTRY'],
          evidenceIds: [`evidence-${index}`], rationale: 'Ranked by codebase analysis.',
        },
        {
          id: `${checkpointId}:entity-alt-${index}`, entityId: `entity-alt-${index}`,
          file: 'src/other.ts', symbol: 'other', startLine: 2, endLine: 9,
          score: 0.55, confidence: 0.5, placementKinds: ['FUNCTION_ENTRY'],
          evidenceIds: [`evidence-alt-${index}`], rationale: 'Also plausible.',
        },
      ],
    })),
  };
}

test('a Flow initializes, resolves and verifies against a real database', async () => {
  const data = await seed();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const verifyJwt = (req: Request & { user?: { id: string; email: string } }, res: Response, next: NextFunction) => {
    if (String(req.headers['x-test-user'] ?? '') !== data.user.id) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    req.user = { id: data.user.id, email: data.user.email };
    next();
  };
  const verifyAppOwnership = (_req: Request, _res: Response, next: NextFunction) => next();
  app.use(createFlowLifecycleRouter({ prisma, verifyJwt, verifyAppOwnership }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. The desktop creates the record before it has finished analysing, so the
    //    window has something to watch. The filename-matched fallback must not
    //    be published as a finished review in the meantime.
    const created = await request(baseUrl, data.user.id, `/flows/${data.flow.id}/initializations`, {
      method: 'POST',
      body: JSON.stringify({
        flowVersionId: data.version.id, workspaceId: data.workspace.id,
        repositorySnapshotId: data.snapshot.id, environmentId: data.environment.id,
        awaitingAnalysis: true,
      }),
    });
    expectStatus(created, 201);
    const body = created.json();
    const initializationId = String(body.initialization.id);
    assert.equal(body.initialization.stage, 'SCANNING');
    assert.equal(body.scan.mappingStatus, 'WAITING_FOR_ANALYSIS');

    const checkpointIds = (body.initialization.manifest.checkpoints as Array<{ id: string }>).map((item) => item.id);
    assert.equal(checkpointIds.length, 3, 'two states and one transition');

    // 2. Progress is reported against the record the window is polling.
    const progressed = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/mapping-progress`, {
      method: 'POST',
      body: JSON.stringify({ progress: {
        status: 'RETRIEVING', completedCheckpoints: 0, totalCheckpoints: 3,
        resolvedCount: 0, ambiguousCount: 0, unresolvedCount: 3, unsupportedCount: 0,
        message: 'Searching the analysed codebase', updatedAt: new Date().toISOString(),
      } }),
    });
    expectStatus(progressed, 200);
    const progressView = (await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/progress`)).json();
    assert.equal(progressView.progress.status, 'RETRIEVING');
    assert.equal(progressView.mappingStatus, 'RETRIEVING');

    // 3. The candidate bundle. No provider is configured in tests, so this takes
    //    the graph-only path — which must never claim to know the exact line.
    const submitted = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/mapping-candidates`, {
      method: 'POST', body: JSON.stringify(mappingBundle(checkpointIds)),
    });
    expectStatus(submitted, 200);
    const mapped = submitted.json();
    assert.equal(mapped.stage, 'REVIEW_READY');
    assert.equal(mapped.mappingVersion, '2.0');
    assert.equal(mapped.codeReviewReport.progress.status, 'NEEDS_REVIEW');
    assert.equal(mapped.codeReviewReport.progress.unresolvedCount, 3);
    assert.equal(mapped.codeReviewReport.analysis.revision, 'abc1234');

    // 4. Automated mode is refused while anything is unplaced.
    const tooEarly = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/mode`, {
      method: 'POST', body: JSON.stringify({ mode: 'AUTOMATED' }),
    });
    assert.equal(tooEarly.status, 409);
    assert.equal(tooEarly.json().error, 'ALL_FLOW_CHECKPOINT_MAPPINGS_REQUIRED');

    // 5. The user chooses a location for each one. This is the step that had no
    //    caller in the UI at all, so nothing could ever leave NEEDS_REVIEW.
    for (const checkpointId of checkpointIds) {
      const confirmed = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/mappings/${encodeURIComponent(checkpointId)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          candidateId: `${checkpointId}:entity-${checkpointIds.indexOf(checkpointId)}`,
          placementKind: 'FUNCTION_ENTRY', anchorText: 'function checkout()',
        }),
      });
      expectStatus(confirmed, 200);
    }

    const ready = (await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/report`)).json();
    assert.equal(ready.report.progress.status, 'READY');
    assert.equal(ready.report.progress.unresolvedCount, 0);

    // 6. Now automated mode is allowed.
    const allowed = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/mode`, {
      method: 'POST', body: JSON.stringify({ mode: 'AUTOMATED' }),
    });
    expectStatus(allowed, 200);
    assert.equal(allowed.json().stage, 'AWAITING_APPROVAL');

    // 7. Automated initialization promised a marker for every checkpoint, so the
    //    boundaries alone are not enough to call it done.
    const stored = await prisma.flowInitialization.findUniqueOrThrow({ where: { id: initializationId } });
    const manifest = stored.manifest as any;
    const markerFor = (id: string) => manifest.checkpoints.find((item: any) => item.id === id).marker;
    const boundaryOnly = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/verification/code-scan`, {
      method: 'POST',
      body: JSON.stringify({ matches: [
        { file: 'src/cart.ts', line: 3, flow: markerFor(`state:${STATE_START}`).flow, state: markerFor(`state:${STATE_START}`).state },
        { file: 'src/paid.ts', line: 9, flow: markerFor(`state:${STATE_DONE}`).flow, state: markerFor(`state:${STATE_DONE}`).state },
      ] }),
    });
    expectStatus(boundaryOnly, 200);
    const partial = boundaryOnly.json();
    assert.equal(partial.completed, false, 'automated mode requires every checkpoint');
    assert.equal(partial.verification.requirement, 'ALL_CHECKPOINTS');
    assert.deepEqual(partial.missingCheckpointIds, [`transition:${TRANSITION}`]);

    // 8. With the transition marker too, and no duplicates, it completes.
    const complete = await request(baseUrl, data.user.id, `/flow-initializations/${initializationId}/verification/code-scan`, {
      method: 'POST',
      body: JSON.stringify({ matches: [
        { file: 'src/cart.ts', line: 3, flow: markerFor(`state:${STATE_START}`).flow, state: markerFor(`state:${STATE_START}`).state },
        { file: 'src/paid.ts', line: 9, flow: markerFor(`state:${STATE_DONE}`).flow, state: markerFor(`state:${STATE_DONE}`).state },
        { file: 'src/pay.ts', line: 5, flow: markerFor(`transition:${TRANSITION}`).flow, transition: markerFor(`transition:${TRANSITION}`).transition },
      ] }),
    });
    expectStatus(complete, 200);
    const done = complete.json();
    assert.equal(done.completed, true, JSON.stringify(done.verification));
    assert.equal(done.verification.status, 'COMPLETED');
    assert.deepEqual(done.verification.markerProblems, []);
    assert.equal(done.initialization.stage, 'COMPLETED');

    // The scan carries the provenance a later run needs to tell staleness.
    const scan = await prisma.flowScan.findUniqueOrThrow({ where: { id: stored.scanId } });
    assert.equal((scan as any).retrievalVersion, '2.0.0');
    assert.equal((scan as any).analysisContentHash, 'content-1');
    assert.equal((scan as any).mappingStatus, 'READY');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup(data);
    await prisma.$disconnect();
  }
});
