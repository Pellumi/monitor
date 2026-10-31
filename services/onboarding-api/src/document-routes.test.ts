import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createDocumentRouter } from './document-routes';

/**
 * The document routes are pure request/orchestration over several collaborators
 * (prisma, storage, entitlements, and the AI generation/decomposition/extraction
 * calls) — all stubbed, so these tests are about what the endpoint does with what
 * those collaborators return, not about a real database or a real model.
 */
function harness(options: {
  entitled?: boolean;
  generateFlowFromDocument?: any;
  decomposeDocumentIntoFlows?: any;
  extractDocument?: any;
  publishedFlows?: Array<{ id: string; name: string; purpose: string | null }>;
} = {}) {
  const graphs: any[] = [];
  const nodes: any[] = [];
  const edges: any[] = [];
  const evidenceRows: any[] = [];
  const sourceDocuments: any[] = [];

  const prisma = {
    application: {
      findUnique: async () => ({ id: 'app-1', organizationId: 'org-1' }),
    },
    sourceDocument: {
      upsert: async ({ create }: any) => {
        const row = { id: `doc-${sourceDocuments.length + 1}`, ...create };
        sourceDocuments.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = sourceDocuments.find((candidate) => candidate.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    intentEvidence: {
      create: async ({ data }: any) => {
        const row = { id: `evidence-${evidenceRows.length + 1}`, ...data };
        evidenceRows.push(row);
        return row;
      },
    },
    environment: {
      findFirst: async () => null,
    },
    behaviorGraph: {
      create: async ({ data }: any) => {
        const row = { id: `graph-${graphs.length + 1}`, ...data };
        graphs.push(row);
        return row;
      },
      findMany: async () => options.publishedFlows ?? [],
    },
    behaviorGraphNode: {
      create: async ({ data }: any) => {
        const row = { id: `node-${nodes.length + 1}`, ...data };
        nodes.push(row);
        return row;
      },
    },
    behaviorGraphEdge: {
      create: async ({ data }: any) => {
        const row = { id: `edge-${edges.length + 1}`, ...data };
        edges.push(row);
        return row;
      },
    },
  };

  const entitlementChecker = { canAccess: async () => options.entitled ?? true };
  const storage = { uploadAndPresign: async () => 'https://example.test/signed' };
  const verifyJwt = (req: any, _res: any, next: any) => { req.user = { id: 'user-1', email: 'user@example.test' }; next(); };
  const verifyAppOwnership = (_req: any, _res: any, next: any) => next();

  const app = express();
  app.use(express.json({ limit: '30mb' }));
  app.use(createDocumentRouter({
    prisma: prisma as never,
    entitlementChecker: entitlementChecker as never,
    verifyJwt, verifyAppOwnership,
    storage: storage as never,
    generateFlowFromDocument: options.generateFlowFromDocument,
    decomposeDocumentIntoFlows: options.decomposeDocumentIntoFlows,
    extractDocument: options.extractDocument,
  }));
  return { app, graphs, nodes, edges, evidenceRows, sourceDocuments };
}

async function post(app: express.Express, path: string, body: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) as any };
  } finally {
    server.close();
  }
}

const DATA_BASE64 = Buffer.from('%PDF-1.4 fake pdf bytes for a test').toString('base64');
const UPLOAD = { filename: 'spec.pdf', mimeType: 'application/pdf', dataBase64: DATA_BASE64 };

function extractedDocument(text = 'Upload your notes to get started.') {
  return {
    filename: 'spec.pdf', mimeType: 'application/pdf', kind: 'PDF' as const, checksum: 'abc', processorVersion: 'test',
    title: 'Spec', summary: text, aiSafeText: text,
    segments: [{ id: 'seg-1', heading: null, excerpt: text, locator: 'lines:1-1', confidence: 0.9, excludedFromAi: false }],
    structure: { headings: [] },
    redaction: { riskLevel: 'LOW' as const, redactions: [], promptInjectionDetected: false, excludedSegmentCount: 0 },
  };
}

function flowResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Onboarding', purpose: 'Get started', scopeStatement: 'GUEST to DONE', workflowType: 'CUSTOM',
    states: [
      { name: 'GUEST', category: 'NAVIGATION', role: 'INITIAL', terminalKind: null },
      { name: 'DONE', category: 'BUSINESS', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{ from: 'GUEST', to: 'DONE', action: 'FINISH', condition: undefined }],
    requires: undefined,
    provider: 'gemini', model: 'gemini-2.5-flash', promptHash: 'hash',
    leftOut: [], structuralIssues: [], repairedOrdering: false, providerCalls: 1, generationMs: 10,
    ...overrides,
  };
}

test('generate-flow: creates a draft graph with its states and transitions', async () => {
  const { app, graphs, nodes, edges } = harness({
    extractDocument: async () => extractedDocument(),
    generateFlowFromDocument: async () => flowResult(),
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', UPLOAD);

  assert.equal(result.status, 201);
  assert.equal(result.body.flowId, graphs[0].id);
  assert.equal(result.body.stateCount, 2);
  assert.equal(result.body.transitionCount, 1);
  assert.equal(graphs[0].aiDraftStatus, 'PENDING_REVIEW');
  assert.equal(nodes.length, 2);
  assert.equal(edges.length, 1);
  assert.equal(result.body.meta.providerCalls, 1);
});

test('generate-flow: refuses a request missing required fields', async () => {
  const { app } = harness();
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', { filename: 'x.pdf' });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_DOCUMENT_PAYLOAD');
});

test('generate-flow: refuses an unsupported mime type', async () => {
  const { app } = harness();
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', { ...UPLOAD, mimeType: 'application/zip' });
  assert.equal(result.status, 415);
  assert.equal(result.body.error, 'UNSUPPORTED_DOCUMENT_TYPE');
});

test('generate-flow: refuses a request when the feature is not entitled', async () => {
  const { app } = harness({ entitled: false });
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', UPLOAD);
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'FEATURE_NOT_ENTITLED');
});

test('generate-flow: reports generation failure without crashing the request', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    generateFlowFromDocument: async () => { throw new Error('DOCUMENT_FLOW_PROVIDER_ERROR:503:gemini-2.5-flash:overloaded'); },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', UPLOAD);
  assert.equal(result.status, 422);
  assert.equal(result.body.error, 'DOCUMENT_FLOW_GENERATION_FAILED');
});

test('generate-flow: a text extraction failure does not block generation', async () => {
  const { app, graphs } = harness({
    extractDocument: async () => { throw new Error('UNSUPPORTED_DOCUMENT_TYPE'); },
    generateFlowFromDocument: async (input: any) => {
      assert.equal(input.documentText, undefined);
      return flowResult();
    },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flow', UPLOAD);
  assert.equal(result.status, 201);
  assert.equal(graphs.length, 1);
});

test('generate-flows: generates one flow per journey and reports a failed one by name and reason', async () => {
  const { app, graphs } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([
      { name: 'Onboarding', purpose: 'First-time setup' },
      { name: 'Broken Journey', purpose: 'This one fails' },
    ]),
    generateFlowFromDocument: async (input: any) => {
      if (input.journey?.name === 'Broken Journey') throw new Error('DOCUMENT_FLOW_EMPTY_RESPONSE');
      return flowResult({ name: input.journey?.name ?? 'Onboarding' });
    },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', UPLOAD);

  assert.equal(result.status, 201);
  assert.equal(result.body.journeyCount, 2);
  assert.equal(result.body.flows.length, 1);
  assert.equal(result.body.flows[0].name, 'Onboarding');
  assert.equal(result.body.failed.length, 1);
  assert.equal(result.body.failed[0].journey, 'Broken Journey');
  assert.match(result.body.failed[0].reason, /DOCUMENT_FLOW_EMPTY_RESPONSE/);
  assert.equal(graphs.length, 1);
  assert.ok(result.body.meta.totalProviderCalls >= 2); // 1 decompose + at least 1 generation attempt
});

test('generate-flows: a later journey can subFlow-reference an earlier one from the same request', async () => {
  const { app, nodes } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([
      { name: 'Pay & Unlock Plan', purpose: 'Takes payment' },
      { name: 'Onboarding', purpose: 'First-time setup' },
    ]),
    generateFlowFromDocument: async (input: any) => {
      if (input.journey?.name === 'Onboarding') {
        // References the flow generated just before it in this same request.
        assert.ok(input.existingFlows.some((flow: any) => flow.name === 'Pay & Unlock Plan'));
        return flowResult({
          name: 'Onboarding',
          states: [
            { name: 'GUEST', category: 'NAVIGATION', role: 'INITIAL', terminalKind: null },
            { name: 'PAY', category: 'BUSINESS', role: 'TERMINAL', terminalKind: 'SUCCESS', subFlow: { name: 'Pay & Unlock Plan' } },
          ],
          transitions: [{ from: 'GUEST', to: 'PAY', action: 'CHECKOUT' }],
        });
      }
      return flowResult({ name: 'Pay & Unlock Plan' });
    },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', UPLOAD);

  assert.equal(result.status, 201);
  assert.equal(result.body.flows.length, 2);
  const payNode = nodes.find((node) => node.stateName === 'PAY');
  assert.ok(payNode.subFlowId, 'the PAY state should resolve subFlowId to the Pay & Unlock Plan graph created earlier in the request');
});

test('generate-flows: offers already-published flows as subFlow candidates', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    publishedFlows: [{ id: 'graph-published-1', name: 'Pay & Unlock Plan', purpose: 'Takes payment' }],
    decomposeDocumentIntoFlows: async () => ([{ name: 'Onboarding', purpose: 'First-time setup' }]),
    generateFlowFromDocument: async (input: any) => {
      assert.ok(input.existingFlows.some((flow: any) => flow.name === 'Pay & Unlock Plan'));
      return flowResult({ name: 'Onboarding' });
    },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', UPLOAD);
  assert.equal(result.status, 201);
});

test('generate-flows: maxJourneys caps generation and reports what was skipped', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([
      { name: 'A', purpose: 'a' }, { name: 'B', purpose: 'b' }, { name: 'C', purpose: 'c' },
    ]),
    generateFlowFromDocument: async (input: any) => flowResult({ name: input.journey?.name }),
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', { ...UPLOAD, maxJourneys: 2 });

  assert.equal(result.status, 201);
  assert.equal(result.body.flows.length, 2);
  assert.deepEqual(result.body.skippedJourneys, ['C']);
  assert.equal(result.body.meta.maxJourneys, 2);
});

test('generate-flows: skipConsistencyCheck is threaded through to generation', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([{ name: 'Onboarding', purpose: 'First-time setup' }]),
    generateFlowFromDocument: async (input: any) => {
      assert.equal(input.skipConsistencyCheck, true);
      return flowResult();
    },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', { ...UPLOAD, skipConsistencyCheck: true });
  assert.equal(result.status, 201);
  assert.equal(result.body.meta.skipConsistencyCheck, true);
});

test('generate-flows: no journey found at all is a 422, not a 201 with an empty list', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([]),
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', UPLOAD);
  assert.equal(result.status, 422);
  assert.equal(result.body.error, 'NO_JOURNEYS_FOUND');
});

test('generate-flows: every journey failing is a 422 that still lists why each one failed', async () => {
  const { app } = harness({
    extractDocument: async () => extractedDocument(),
    decomposeDocumentIntoFlows: async () => ([{ name: 'Onboarding', purpose: 'First-time setup' }]),
    generateFlowFromDocument: async () => { throw new Error('DOCUMENT_FLOW_EMPTY_RESPONSE'); },
  });
  const result = await post(app, '/applications/app-1/source-documents/generate-flows', UPLOAD);
  assert.equal(result.status, 422);
  assert.equal(result.body.error, 'DOCUMENT_FLOW_GENERATION_FAILED');
  assert.equal(result.body.failed.length, 1);
});
