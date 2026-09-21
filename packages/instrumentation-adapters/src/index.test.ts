import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assignFlowCheckpoints, calculateFlowAnchorHash, createApprovalHash, detectAdapters, getAdapter, type LocalProjectContext } from './index';

function fixture(input: { dependencies: Record<string, string>; entry: string; content: string; extraFiles?: Record<string, string> }): LocalProjectContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-adapter-'));
  fs.mkdirSync(path.join(root, path.dirname(input.entry)), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { build: 'tsc --noEmit' }, dependencies: input.dependencies }, null, 2));
  fs.writeFileSync(path.join(root, input.entry), input.content);
  for (const [relativePath, content] of Object.entries(input.extraFiles ?? {})) {
    fs.mkdirSync(path.join(root, path.dirname(relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), content);
  }
  return {
    workspaceRoot: root,
    environmentType: 'DEVELOPMENT',
    snapshot: {
      workspaceId: '00000000-0000-4000-8000-000000000001', revision: null, branch: null, dirty: true,
      repositoryFingerprint: 'a'.repeat(64), languages: ['.ts', '.tsx'], packageManager: 'npm',
      frameworks: [], routes: [], endpoints: [], documentation: [], manifestHashes: {}, scannerVersion: 'test',
      redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
    },
  };
}

test('React/Vite apply is bounded, validates, and rollback restores the dirty fixture', async () => {
  const context = fixture({ dependencies: { react: '^19.0.0', vite: '^7.0.0' }, entry: 'src/main.tsx', content: `import React from 'react';\ncreateRoot(document.body).render(<div />);\n` });
  fs.writeFileSync(path.join(context.workspaceRoot, 'unrelated-user-change.txt'), 'preserve me');
  const adapter = getAdapter('react-vite');
  const plan = await adapter.propose(context);
  const task = {
    plan,
    approvedFileScopes: plan.approvedFileScopes,
    approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  };
  const result = await adapter.apply(context, task);
  assert.deepEqual(new Set(result.changedFiles), new Set(['package.json', 'src/tellann.ts', 'src/main.tsx']));
  const validation = await adapter.validate(context, result);
  assert.equal(validation.valid, true);
  assert.match(fs.readFileSync(path.join(context.workspaceRoot, 'src/main.tsx'), 'utf8'), /import ['"]\.\/tellann['"]/);
  const rollback = await adapter.rollback(context, result);
  assert.equal(rollback.verified, true);
  assert.equal(fs.existsSync(path.join(context.workspaceRoot, 'src/tellann.ts')), false);
  assert.doesNotMatch(fs.readFileSync(path.join(context.workspaceRoot, 'src/main.tsx'), 'utf8'), /tellann/);
  assert.equal(fs.readFileSync(path.join(context.workspaceRoot, 'unrelated-user-change.txt'), 'utf8'), 'preserve me');
});

test('all five adapters detect their supported fixtures', () => {
  const fixtures = [
    fixture({ dependencies: { react: '^18.0.0', vite: '^5.0.0' }, entry: 'src/main.tsx', content: 'createRoot(root).render(null);' }),
    fixture({ dependencies: { next: '^15.0.0' }, entry: 'app/layout.tsx', content: 'export default function RootLayout() {}' }),
    fixture({ dependencies: { express: '^4.0.0' }, entry: 'src/index.ts', content: 'const app = express(); app.listen(3000);' }),
    fixture({ dependencies: { fastify: '^5.0.0' }, entry: 'src/server.ts', content: 'const app = fastify(); app.listen({port:3000});' }),
    fixture({ dependencies: { '@nestjs/core': '^10.0.0' }, entry: 'src/main.ts', content: 'async function bootstrap(){ await NestFactory.create(AppModule); }' }),
  ];
  const expected = ['react-vite', 'nextjs', 'express', 'fastify', 'nestjs'];
  fixtures.forEach((context, index) => {
    const detected = detectAdapters(context).find((item) => item.adapterId === expected[index]);
    assert.equal(detected?.supported, true, expected[index]);
  });
});

test('all five adapters enforce their declared supported-version boundaries', async () => {
  const cases: Array<{
    id: 'react-vite' | 'nextjs' | 'express' | 'fastify' | 'nestjs';
    packageName: string;
    companion: Record<string, string>;
    supported: string;
    unsupported: string;
    entry: string;
    content: string;
  }> = [
    { id: 'react-vite' as const, packageName: 'vite', companion: { react: '^18.0.0' }, supported: '4.0.0', unsupported: '3.2.0', entry: 'src/main.tsx', content: 'createRoot(root).render(null);' },
    { id: 'nextjs' as const, packageName: 'next', companion: {}, supported: '12.0.0', unsupported: '11.1.0', entry: 'app/layout.tsx', content: 'export default function RootLayout() {}' },
    { id: 'express' as const, packageName: 'express', companion: {}, supported: '4.0.0', unsupported: '3.21.0', entry: 'src/index.ts', content: 'const app = express(); app.listen(3000);' },
    { id: 'fastify' as const, packageName: 'fastify', companion: {}, supported: '4.0.0', unsupported: '3.29.0', entry: 'src/server.ts', content: 'const app = fastify(); app.listen({port:3000});' },
    { id: 'nestjs' as const, packageName: '@nestjs/core', companion: {}, supported: '9.0.0', unsupported: '8.4.0', entry: 'src/main.ts', content: 'async function bootstrap(){ const app = await NestFactory.create(AppModule); await app.listen(3000); }' },
  ];
  for (const item of cases) {
    const adapter = getAdapter(item.id);
    const supported = fixture({ dependencies: { ...item.companion, [item.packageName]: item.supported }, entry: item.entry, content: item.content });
    const unsupported = fixture({ dependencies: { ...item.companion, [item.packageName]: item.unsupported }, entry: item.entry, content: item.content });
    assert.equal(adapter.detect(supported).supported, true, `${item.id} supported lower boundary`);
    assert.equal(adapter.detect(unsupported).supported, false, `${item.id} unsupported lower boundary`);
    await assert.rejects(adapter.propose(unsupported), /UNSUPPORTED_FRAMEWORK_VERSION/, `${item.id} unsupported proposal`);
  }
});

test('framework-specific transforms install runtime integrations at safe boundaries', async () => {
  const cases = [
    {
      id: 'react-vite' as const,
      context: fixture({ dependencies: { react: '^18.0.0', vite: '^5.0.0' }, entry: 'src/main.tsx', content: `import { createRoot } from 'react-dom/client';\ncreateRoot(document.body).render(<div />);\n` }),
      entry: 'src/main.tsx', expected: /import ['"]\.\/tellann['"]/,
    },
    {
      id: 'nextjs' as const,
      context: fixture({ dependencies: { next: '^15.0.0', react: '^19.0.0' }, entry: 'app/layout.tsx', content: `export default function RootLayout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }\n` }),
      entry: 'app/layout.tsx', expected: /<TellannProvider>\{children\}<\/TellannProvider>/,
    },
    {
      id: 'express' as const,
      context: fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: `import express from 'express';\nconst app = express();\napp.get('/health', (_req, res) => res.send('ok'));\napp.listen(3000);\n` }),
      entry: 'src/index.ts', expected: /app\.use\(tellannExpressMiddleware\(\)\);[\s\S]*app\.use\(tellannExpressErrorHandler\(\)\);[\s\S]*app\.listen/,
    },
    {
      id: 'fastify' as const,
      context: fixture({ dependencies: { fastify: '^5.0.0' }, entry: 'src/server.ts', content: `import fastify from 'fastify';\nconst app = fastify();\napp.listen({ port: 3000 });\n` }),
      entry: 'src/server.ts', expected: /app\.register\(tellannFastifyPlugin\);/,
    },
    {
      id: 'nestjs' as const,
      context: fixture({ dependencies: { '@nestjs/core': '^10.0.0', '@nestjs/common': '^10.0.0', rxjs: '^7.0.0' }, entry: 'src/main.ts', content: `import { NestFactory } from '@nestjs/core';\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n}\nvoid bootstrap();\n` }),
      entry: 'src/main.ts', expected: /app\.useGlobalInterceptors\(new TellannInterceptor\(\)\);/,
    },
  ];
  for (const item of cases) {
    const adapter = getAdapter(item.id);
    const plan = await adapter.propose(item.context);
    const task = {
      plan,
      approvedFileScopes: plan.approvedFileScopes,
      approvedCommandIds: [],
      approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
      checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
    };
    const result = await adapter.apply(item.context, task);
    assert.match(fs.readFileSync(path.join(item.context.workspaceRoot, item.entry), 'utf8'), item.expected, item.id);
    assert.equal((await adapter.validate(item.context, result)).valid, true, item.id);
  }
});

test('JavaScript, JSX, Next Pages Router, and CommonJS fixtures receive runnable source variants', async () => {
  const cases = [
    {
      id: 'react-vite' as const,
      context: fixture({ dependencies: { react: '^18.0.0', vite: '^5.0.0' }, entry: 'src/main.jsx', content: `import { createRoot } from 'react-dom/client';\n// preserve-react-comment\ncreateRoot(document.body).render(<div />);\n` }),
      generated: 'src/tellann.js', entry: 'src/main.jsx', expectedEntry: /import ['"]\.\/tellann['"]/, expectedGenerated: /const run = globalThis\.__TELLANN_RUN__/,
    },
    {
      id: 'nextjs' as const,
      context: fixture({ dependencies: { next: '^15.0.0', react: '^19.0.0' }, entry: 'pages/_app.jsx', content: `export default function App({ Component, pageProps }) { return <Component {...pageProps} />; }\n` }),
      generated: 'src/tellann.js', entry: 'pages/_app.jsx', expectedEntry: /<TellannProvider><Component/, expectedGenerated: /export function TellannProvider\(\{ children \}\)/,
    },
    {
      id: 'express' as const,
      context: fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.js', content: `const express = require('express');\n// preserve-express-comment\nconst app = express();\napp.listen(3000);\n` }),
      generated: 'src/tellann.js', entry: 'src/index.js', expectedEntry: /const \{ tellannExpressErrorHandler, tellannExpressMiddleware \} = require\("\.\/tellann"\);/, expectedGenerated: /module\.exports = \{ TELLANN, tellannExpressErrorHandler, tellannExpressMiddleware \}/,
    },
    {
      id: 'fastify' as const,
      context: fixture({ dependencies: { fastify: '^5.0.0' }, entry: 'src/server.js', content: `const fastify = require('fastify');\nconst app = fastify();\napp.listen({ port: 3000 });\n` }),
      generated: 'src/tellann.js', entry: 'src/server.js', expectedEntry: /const \{ tellannFastifyPlugin \} = require\("\.\/tellann"\);/, expectedGenerated: /module\.exports = \{ TELLANN, tellannFastifyPlugin \}/,
    },
  ];
  for (const item of cases) {
    const adapter = getAdapter(item.id);
    const plan = await adapter.propose(item.context);
    assert.ok(plan.approvedFileScopes.includes(item.generated), `${item.id} generated JavaScript path`);
    const result = await adapter.apply(item.context, {
      plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
      approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
      checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
    });
    assert.match(fs.readFileSync(path.join(item.context.workspaceRoot, item.entry), 'utf8'), item.expectedEntry, `${item.id} entry`);
    assert.match(fs.readFileSync(path.join(item.context.workspaceRoot, item.generated), 'utf8'), item.expectedGenerated, `${item.id} generated`);
    assert.equal((await adapter.validate(item.context, result)).valid, true, `${item.id} validation`);
  }
});

test('a monorepo plan is scoped to the detected application package and root lockfile', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-adapter-monorepo-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'workspace-root', private: true, workspaces: ['apps/*'] }, null, 2));
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  fs.mkdirSync(path.join(root, 'apps', 'web', 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps', 'web', 'package.json'), JSON.stringify({ name: 'web', scripts: { build: 'vite build' }, dependencies: { react: '^18.0.0', vite: '^5.0.0' } }, null, 2));
  fs.writeFileSync(path.join(root, 'apps', 'web', 'src', 'main.tsx'), `import { createRoot } from 'react-dom/client';\ncreateRoot(document.body).render(<div />);\n`);
  const context: LocalProjectContext = {
    workspaceRoot: root, environmentType: 'DEVELOPMENT',
    snapshot: {
      workspaceId: '00000000-0000-4000-8000-000000000001', revision: null, branch: null, dirty: true,
      repositoryFingerprint: 'b'.repeat(64), languages: ['.ts', '.tsx'], packageManager: 'pnpm',
      frameworks: [], routes: [], endpoints: [], documentation: [], manifestHashes: {}, scannerVersion: 'test',
      redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
    },
  };
  const adapter = getAdapter('react-vite');
  assert.equal(adapter.detect(context).supported, true);
  const rootPackageBefore = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const plan = await adapter.propose(context);
  assert.ok(plan.approvedFileScopes.includes('apps/web/package.json'));
  assert.ok(plan.approvedFileScopes.includes('apps/web/src/tellann.ts'));
  assert.ok(plan.approvedFileScopes.includes('pnpm-lock.yaml'));
  assert.ok(plan.validationCommands.every((command) => command.cwd === 'apps/web'));
  await adapter.apply(context, {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  });
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), rootPackageBefore);
  assert.match(fs.readFileSync(path.join(root, 'apps', 'web', 'package.json'), 'utf8'), /@tellann\/frontend-sdk/);
});

test('re-proposing and applying instrumentation is idempotent', async () => {
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: `import express from 'express';\nconst app = express();\napp.listen(3000);\n` });
  const adapter = getAdapter('express');
  const apply = async () => {
    const plan = await adapter.propose(context);
    return adapter.apply(context, {
      plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
      approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
      checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
    });
  };
  await apply();
  await apply();
  const entry = fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8');
  assert.equal((entry.match(/tellannExpressMiddleware\(\)/g) ?? []).length, 1);
  assert.equal((entry.match(/tellannExpressErrorHandler\(\)/g) ?? []).length, 1);
  assert.equal((entry.match(/from ['"]\.\/tellann['"]/g) ?? []).length, 1);
});

test('bootstrap instrumentation does not add Flow checkpoints', async () => {
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: `import express from 'express';
const app = express();
async function createOrder() { return { id: 'one' }; }
app.post('/orders', async (_req, res) => res.json(await createOrder()));
app.listen(3000);
` });
  const adapter = getAdapter('express');
  const plan = await adapter.propose(context);
  const checkpoint = plan.operations.find((operation) => operation.transformId === 'tellann.semantic.function-entry');
  assert.equal(checkpoint, undefined);
  const result = await adapter.apply(context, {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  });
  const source = fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8');
  assert.doesNotMatch(source, /tellann:checkpoint:/);
  assert.doesNotMatch(source, /WORKFLOW_STARTED/);
  assert.equal((await adapter.validate(context, result)).valid, true);
});

test('Flow proposals use the initialization manifest and reject uncertain mappings', async () => {
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: `import express from 'express';
const app = express();
async function createOrder() { return { id: 'one' }; }
app.post('/orders', async (_req, res) => res.json(await createOrder()));
app.listen(3000);
` });
  const baseManifest = {
    version: '1.0' as const,
    graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64), repositorySnapshotId: '00000000-0000-4000-8000-000000000021',
    initialStateId: 'order', terminalStateIds: ['order'], paths: [['order']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
    checkpoints: [{ id: 'state:order', kind: 'STATE' as const, stateId: 'order', transitionId: null, stateRole: 'INITIAL' as const, terminalKind: null, eventType: 'FLOW_INITIAL_STATE', expectedState: 'order', fromCheckpointId: null, toCheckpointId: null, required: true, mapping: { file: 'src/index.ts', symbol: 'createOrder', confidence: 0.92, rationale: 'Matched handler' } }],
  };
  const flowContext = { ...context, instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022', flowVersionId: baseManifest.graphVersionId, flowInitializationId: '00000000-0000-4000-8000-000000000023', flowManifest: baseManifest };
  const adapter = getAdapter('express');
  const plan = await adapter.propose(flowContext);
  const checkpoint = plan.operations.find((operation) => operation.id === 'state:order');
  assert.equal(checkpoint?.eventMappings[0]?.checkpointId, 'state:order');
  const result = await adapter.apply(flowContext, { plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [], approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []), checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')) });
  assert.match(fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8'), /FLOW_INITIAL_STATE/);
  assert.match(fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8'), /state:order/);
  assert.equal((await adapter.validate(flowContext, result)).valid, true);
  await assert.rejects(adapter.propose({ ...flowContext, flowManifest: { ...baseManifest, checkpoints: [{ ...baseManifest.checkpoints[0], mapping: { file: null, symbol: null, confidence: 0.2, rationale: 'Unmapped' } }] } }), /FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED/);
});

test('Flow v2 proposals consume every resolved mapping without keyword rediscovery', async () => {
  const content = `import express from 'express';
const app = express();
async function beginCheckout() {
  const order = await loadCart();
  if (order.ready) {
    await charge(order);
  }
  return order;
}
app.post('/checkout', async (_req, res) => res.json(await beginCheckout()));
app.listen(3000);
`;
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content });
  const mapping = (placementKind: string, anchor: string, startLine: number, endLine = startLine) => ({
    status: 'RESOLVED', file: 'src/index.ts', symbol: 'beginCheckout', startLine, endLine,
    placementKind, anchor, anchorHash: calculateFlowAnchorHash('src/index.ts', 'beginCheckout', placementKind, anchor), confidence: 0.94,
    rationale: 'Grounded in the codebase analysis', evidenceIds: [], alternatives: [], userConfirmed: true, userOverrode: false,
  });
  const checkpoint = (id: string, placementKind: string, anchor: string, startLine: number, endLine = startLine) => ({
    id, kind: id.startsWith('state:') ? 'STATE' : 'TRANSITION', stateId: id.startsWith('state:') ? id : null,
    transitionId: id.startsWith('transition:') ? id : null, stateRole: 'NORMAL', terminalKind: null,
    eventType: 'FLOW_CHECKPOINT_REACHED', expectedState: id, fromCheckpointId: null, toCheckpointId: null,
    required: true, mapping: mapping(placementKind, anchor, startLine, endLine),
  });
  const manifest = {
    version: '2.0', graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64),
    repositorySnapshotId: '00000000-0000-4000-8000-000000000021', initialStateId: 'checkout',
    terminalStateIds: ['complete'], paths: [['checkout', 'complete']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
    checkpoints: [
      checkpoint('state:checkout', 'FUNCTION_ENTRY', 'async function beginCheckout()', 3),
      checkpoint('transition:cart-loaded', 'AFTER_STATEMENT', 'const order = await loadCart();', 4),
      checkpoint('transition:charge', 'BRANCH_ENTRY', 'if (order.ready)', 5, 7),
      checkpoint('state:complete', 'BEFORE_STATEMENT', 'return order;', 8),
    ],
  };
  const flowContext = {
    ...context, instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: manifest.graphVersionId, flowInitializationId: '00000000-0000-4000-8000-000000000023',
    flowManifest: manifest as never,
  };
  const adapter = getAdapter('express');
  const plan = await adapter.propose(flowContext);
  const checkpointOperations = plan.operations.filter((operation) => operation.eventMappings.some((item) => item.checkpointId));
  assert.equal(checkpointOperations.length, manifest.checkpoints.length);
  assert.deepEqual(checkpointOperations.map((operation) => operation.id), manifest.checkpoints.map((item) => item.id));
  const result = await adapter.apply(flowContext, {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  });
  const instrumented = fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8');
  for (const item of manifest.checkpoints) assert.match(instrumented, new RegExp(`tellann:checkpoint:${item.id}`));
  assert.match(instrumented, /transition:cart-loaded[\s\S]*return order/);
  assert.equal((await adapter.validate(flowContext, result)).valid, true);
});

test('Flow v2 proposal is atomic and rejects unresolved, stale, or unsupported checkpoint mappings', async () => {
  const content = `import express from 'express';
const app = express();
async function beginCheckout() { return true; }
app.listen(3000);
`;
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content });
  const baseMapping = {
    status: 'RESOLVED', file: 'src/index.ts', symbol: 'beginCheckout', startLine: 3, endLine: 3,
    placementKind: 'FUNCTION_ENTRY', anchor: 'async function beginCheckout()',
    anchorHash: calculateFlowAnchorHash('src/index.ts', 'beginCheckout', 'FUNCTION_ENTRY', 'async function beginCheckout()'), confidence: 0.95,
    rationale: 'Grounded mapping', evidenceIds: [], alternatives: [], userConfirmed: true, userOverrode: false,
  };
  const makeContext = (mapping: Record<string, unknown>) => ({
    ...context, instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: '00000000-0000-4000-8000-000000000020', flowInitializationId: '00000000-0000-4000-8000-000000000023',
    flowManifest: {
      version: '2.0', graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64),
      repositorySnapshotId: '00000000-0000-4000-8000-000000000021', initialStateId: 'checkout', terminalStateIds: ['checkout'],
      paths: [['checkout']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
      checkpoints: [{ id: 'state:checkout', kind: 'STATE', stateId: 'checkout', transitionId: null, stateRole: 'INITIAL', terminalKind: null,
        eventType: 'FLOW_INITIAL_STATE', expectedState: 'checkout', fromCheckpointId: null, toCheckpointId: null, required: true, mapping }],
    } as never,
  });
  const adapter = getAdapter('express');
  await assert.rejects(adapter.propose(makeContext({ ...baseMapping, status: 'AMBIGUOUS' })), /FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED:state:checkout/);
  await assert.rejects(adapter.propose(makeContext({ ...baseMapping, anchorHash: 'f'.repeat(64) })), /STALE_FLOW_CHECKPOINT_ANCHOR:state:checkout/);
  await assert.rejects(adapter.propose(makeContext({ ...baseMapping, placementKind: 'COMPONENT_MOUNT' })), /SAFE_COMPONENT_BOUNDARY_NOT_FOUND|STALE_FLOW_CHECKPOINT_SYMBOL/);
});

/**
 * A file-scoped route has no exported symbol to name, so a component-mount
 * mapping has to be able to stand on the file alone. This is the plan's lead
 * case — a declared `LOGIN PAGE` state landing on a real React page.
 */
function componentMountManifest(input: { file: string; symbol: string | null; anchorText: string; startLine: number; endLine: number }) {
  return {
    version: '2.0', graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64),
    repositorySnapshotId: '00000000-0000-4000-8000-000000000021', initialStateId: 'login', terminalStateIds: ['login'],
    paths: [['login']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
    checkpoints: [{
      id: 'state:login', kind: 'STATE', stateId: 'login', transitionId: null, stateRole: 'INITIAL', terminalKind: null,
      eventType: 'FLOW_INITIAL_STATE', expectedState: 'login', fromCheckpointId: null, toCheckpointId: null, required: true,
      mapping: {
        status: 'RESOLVED', file: input.file, symbol: input.symbol, startLine: input.startLine, endLine: input.endLine,
        placementKind: 'COMPONENT_MOUNT', anchor: input.anchorText,
        anchorHash: calculateFlowAnchorHash(input.file, input.symbol, 'COMPONENT_MOUNT', input.anchorText),
        confidence: 0.92, rationale: 'Login route component', evidenceIds: ['evidence-1'], alternatives: [],
        userConfirmed: false, userOverrode: false,
      },
    }],
  } as never;
}

test('Flow v2 mounts a React checkpoint on a default-exported component with no mapped symbol', async () => {
  const page = `export default function LoginPage() {
  return <form />;
}
`;
  const context = {
    ...fixture({
      dependencies: { react: '^19.0.0', vite: '^7.0.0' }, entry: 'src/main.tsx',
      content: `import React from 'react';
createRoot(document.body).render(<div />);
`,
      extraFiles: { 'src/LoginPage.tsx': page },
    }),
    instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: '00000000-0000-4000-8000-000000000020', flowInitializationId: '00000000-0000-4000-8000-000000000023',
    // The mapping carries no symbol at all, exactly as a file-scoped route arrives.
    flowManifest: componentMountManifest({ file: 'src/LoginPage.tsx', symbol: null, anchorText: 'export default function LoginPage()', startLine: 1, endLine: 3 }),
  };
  const adapter = getAdapter('react-vite');
  const plan = await adapter.propose(context);
  const checkpoint = plan.operations.find((operation) => operation.id === 'state:login');
  assert.equal(checkpoint?.relativePath, 'src/LoginPage.tsx');
  assert.equal(checkpoint?.placementKind, 'COMPONENT_MOUNT');

  const task = {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  };
  await adapter.apply(context, task);
  const written = fs.readFileSync(path.join(context.workspaceRoot, 'src/LoginPage.tsx'), 'utf8');
  assert.match(written, /useEffect\(\(\) => \{/, 'mounts through an effect');
  assert.match(written, /\}, \[\]\);/, 'runs once on mount');
  assert.match(written, /tellann:checkpoint:state:login/);
  assert.match(written, /from "react"|from 'react'/);

  assert.equal(written.match(/tellann:checkpoint:state:login/g)?.length, 1, 'one marker per checkpoint');
  assert.equal(written.match(/useEffect\(/g)?.length, 1, 'one effect per checkpoint');

  // The insert moved the component, so the mapping's source range no longer
  // holds its anchor. Proposing again has to fail closed and send the user back
  // to analysis rather than instrument a line that has since shifted.
  await assert.rejects(adapter.propose(context), /STALE_FLOW_CHECKPOINT_SOURCE_RANGE:state:login/);
});

test('Flow v2 refuses a component mount in a Next.js App Router server component', async () => {
  const serverPage = `export default function Page() {
  return <main />;
}
`;
  const base = {
    instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: '00000000-0000-4000-8000-000000000020', flowInitializationId: '00000000-0000-4000-8000-000000000023',
  };
  const serverContext = {
    ...fixture({
      dependencies: { next: '^15.0.0' }, entry: 'app/layout.tsx',
      content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`,
      extraFiles: { 'app/login/page.tsx': serverPage },
    }),
    ...base,
    flowManifest: componentMountManifest({ file: 'app/login/page.tsx', symbol: null, anchorText: 'export default function Page()', startLine: 1, endLine: 3 }),
  };
  await assert.rejects(getAdapter('nextjs').propose(serverContext), /UNSUPPORTED_SERVER_COMPONENT_MOUNT:state:login/);

  const clientPage = `'use client';
export default function Page() {
  return <main />;
}
`;
  const clientContext = {
    ...fixture({
      dependencies: { next: '^15.0.0' }, entry: 'app/layout.tsx',
      content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`,
      extraFiles: { 'app/login/page.tsx': clientPage },
    }),
    ...base,
    flowManifest: componentMountManifest({ file: 'app/login/page.tsx', symbol: null, anchorText: 'export default function Page()', startLine: 2, endLine: 4 }),
  };
  const plan = await getAdapter('nextjs').propose(clientContext);
  assert.equal(plan.operations.find((operation) => operation.id === 'state:login')?.placementKind, 'COMPONENT_MOUNT');
});

test('Flow v2 supports method, arrow-function, and named route-handler entry placements', async () => {
  const content = `import express from 'express';
const app = express();
class CheckoutService { approve() { return true; } }
const submitCheckout = async () => { return new CheckoutService().approve(); };
async function routeCheckout(_req: unknown, res: any) { return res.json(await submitCheckout()); }
app.post('/checkout', routeCheckout);
app.listen(3000);
`;
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content });
  const placements = [
    ['state:approved', 'approve', 'FUNCTION_ENTRY', 'approve()', 3],
    ['transition:submit', 'submitCheckout', 'FUNCTION_ENTRY', 'const submitCheckout = async ()', 4],
    ['transition:route', 'routeCheckout', 'ROUTE_HANDLER_ENTRY', 'async function routeCheckout', 5],
  ] as const;
  const manifest = {
    version: '2.0', graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64),
    repositorySnapshotId: '00000000-0000-4000-8000-000000000021', initialStateId: 'approved', terminalStateIds: ['approved'],
    paths: [['approved']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
    checkpoints: placements.map(([id, symbol, placementKind, anchorText, line]) => ({
      id, kind: id.startsWith('state:') ? 'STATE' : 'TRANSITION', stateId: id.startsWith('state:') ? id : null,
      transitionId: id.startsWith('transition:') ? id : null, stateRole: 'NORMAL', terminalKind: null,
      eventType: 'FLOW_CHECKPOINT_REACHED', expectedState: id, fromCheckpointId: null, toCheckpointId: null, required: true,
      mapping: { status: 'RESOLVED', file: 'src/index.ts', symbol, startLine: line, endLine: line, placementKind,
        anchor: anchorText, anchorHash: calculateFlowAnchorHash('src/index.ts', symbol, placementKind, anchorText), confidence: 0.95, rationale: 'Resolved', evidenceIds: [],
        alternatives: [], userConfirmed: true, userOverrode: false },
    })),
  };
  const flowContext = { ...context, instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: manifest.graphVersionId, flowInitializationId: '00000000-0000-4000-8000-000000000023', flowManifest: manifest as never };
  const adapter = getAdapter('express');
  const plan = await adapter.propose(flowContext);
  const result = await adapter.apply(flowContext, { plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []), checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')) });
  const instrumented = fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8');
  for (const [id] of placements) assert.match(instrumented, new RegExp(`tellann:checkpoint:${id}`));
  assert.equal((await adapter.validate(flowContext, result)).valid, true);
});

test('stale target hashes and production application are rejected before writes', async () => {
  const context = fixture({ dependencies: { react: '^18.0.0', vite: '^5.0.0' }, entry: 'src/main.tsx', content: 'createRoot(root).render(null);' });
  const adapter = getAdapter('react-vite');
  const plan = await adapter.propose(context);
  fs.appendFileSync(path.join(context.workspaceRoot, 'src/main.tsx'), '\n// user edit');
  const task = { plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [], approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []), checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')) };
  await assert.rejects(adapter.apply(context, task), /STALE_TARGET_FILE/);
  await assert.rejects(adapter.propose({ ...context, environmentType: 'PRODUCTION' }), /PRODUCTION_OBSERVATION_ONLY/);
});

test('rollback refuses to overwrite edits made after instrumentation', async () => {
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: 'const app = express(); app.listen(3000);' });
  const adapter = getAdapter('express');
  const plan = await adapter.propose(context);
  const task = { plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [], approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []), checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')) };
  const result = await adapter.apply(context, task);
  fs.appendFileSync(path.join(context.workspaceRoot, 'src/index.ts'), '\n// user edit after apply');
  const rollback = await adapter.rollback(context, result);
  assert.equal(rollback.verified, false);
  assert.ok(rollback.conflicts.some((item) => item.relativePath === 'src/index.ts'));
});

test('a transform failure restores every Tellann-authored write automatically', async () => {
  const original = `import express from 'express';\nconst app = express();\nexport { app };\n`;
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: original });
  const packageBefore = fs.readFileSync(path.join(context.workspaceRoot, 'package.json'), 'utf8');
  const adapter = getAdapter('express');
  const plan = await adapter.propose(context);
  await assert.rejects(adapter.apply(context, {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  }), /SAFE_LISTEN_BOUNDARY_NOT_FOUND/);
  assert.equal(fs.readFileSync(path.join(context.workspaceRoot, 'package.json'), 'utf8'), packageBefore);
  assert.equal(fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8'), original);
  assert.equal(fs.existsSync(path.join(context.workspaceRoot, 'src/tellann.ts')), false);
});

test('an already installed SDK does not request registry access or redundant installation approval', async () => {
  const context = fixture({ dependencies: { react: '^18.0.0', vite: '^5.0.0' }, entry: 'src/main.tsx', content: 'createRoot(root).render(null);' });
  const sdkRoot = path.join(context.workspaceRoot, 'node_modules', '@tellann', 'frontend-sdk');
  fs.mkdirSync(sdkRoot, { recursive: true });
  fs.writeFileSync(path.join(sdkRoot, 'package.json'), JSON.stringify({ name: '@tellann/frontend-sdk', version: '0.1.0', main: 'index.js' }));
  fs.writeFileSync(path.join(sdkRoot, 'index.js'), 'exports.TELLANN = {};');

  const plan = await getAdapter('react-vite').propose(context);

  assert.equal(plan.validationCommands.some((command) => command.id === 'install-sdk'), false);
  assert.deepEqual(plan.networkRequirements, []);
});

test('a Flow that spans packages is split across adapters instead of refused', () => {
  // A login page in the web app and its handler in the API is one Flow and two
  // packages. No single framework adapter can instrument both, so the manifest
  // is divided by which detected package holds each file; together the approved
  // plans still cover every checkpoint.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-monorepo-'));
  fs.mkdirSync(path.join(root, 'apps/web/app/login'), { recursive: true });
  fs.mkdirSync(path.join(root, 'services/api/src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', private: true }));
  fs.writeFileSync(path.join(root, 'apps/web/package.json'), JSON.stringify({ name: 'web', dependencies: { next: '^15.0.0' } }));
  fs.writeFileSync(path.join(root, 'services/api/package.json'), JSON.stringify({ name: 'api', dependencies: { express: '^4.21.0' } }));
  fs.writeFileSync(path.join(root, 'apps/web/app/login/page.tsx'), "'use client';\nexport default function Page() { return <main />; }\n");
  fs.writeFileSync(path.join(root, 'services/api/src/login.ts'), 'export async function handleLogin() { return true; }\n');

  const manifest = {
    checkpoints: [
      { id: 'state:login', mapping: { file: 'apps/web/app/login/page.tsx' } },
      { id: 'transition:submit', mapping: { file: 'services/api/src/login.ts' } },
    ],
  } as never;

  const split = assignFlowCheckpoints(root, manifest, ['nextjs', 'express']);
  assert.deepEqual(split.byAdapter.nextjs, ['state:login']);
  assert.deepEqual(split.byAdapter.express, ['transition:submit']);
  assert.deepEqual(split.unassigned, []);

  // With only the web adapter selected, the API checkpoint is reported by file
  // rather than swallowed, so the user can be told what is still uncovered.
  const partial = assignFlowCheckpoints(root, manifest, ['nextjs']);
  assert.deepEqual(partial.byAdapter.nextjs, ['state:login']);
  assert.deepEqual(partial.unassigned, [{ checkpointId: 'transition:submit', file: 'services/api/src/login.ts' }]);
});

test('an adapter given its share proposes only that share', async () => {
  const content = `import express from 'express';
const app = express();
async function handleLogin() { return true; }
async function handleLogout() { return true; }
app.listen(3000);
`;
  const anchorFor = (symbol: string) => `async function ${symbol}()`;
  const mappingFor = (symbol: string, line: number) => ({
    status: 'RESOLVED', file: 'src/index.ts', symbol, startLine: line, endLine: line,
    placementKind: 'FUNCTION_ENTRY', anchor: anchorFor(symbol),
    anchorHash: calculateFlowAnchorHash('src/index.ts', symbol, 'FUNCTION_ENTRY', anchorFor(symbol)),
    confidence: 0.95, rationale: 'Grounded', evidenceIds: ['e1'], alternatives: [],
    userConfirmed: true, userOverrode: false,
  });
  const context = {
    ...fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content }),
    instrumentationPurpose: 'FLOW' as const, flowId: '00000000-0000-4000-8000-000000000022',
    flowVersionId: '00000000-0000-4000-8000-000000000020', flowInitializationId: '00000000-0000-4000-8000-000000000023',
    flowManifest: {
      version: '2.0', graphVersionId: '00000000-0000-4000-8000-000000000020', graphHash: 'b'.repeat(64),
      repositorySnapshotId: '00000000-0000-4000-8000-000000000021', initialStateId: 'in', terminalStateIds: ['out'],
      paths: [['in', 'out']], unreachableStateIds: [], generatedAt: new Date().toISOString(),
      checkpoints: [
        { id: 'state:in', kind: 'STATE', stateId: 'in', transitionId: null, stateRole: 'INITIAL', terminalKind: null, eventType: 'FLOW_INITIAL_STATE', expectedState: 'in', fromCheckpointId: null, toCheckpointId: null, required: true, mapping: mappingFor('handleLogin', 3) },
        { id: 'state:out', kind: 'STATE', stateId: 'out', transitionId: null, stateRole: 'TERMINAL', terminalKind: 'SUCCESS', eventType: 'FLOW_TERMINAL_STATE', expectedState: 'out', fromCheckpointId: null, toCheckpointId: null, required: true, mapping: mappingFor('handleLogout', 4) },
      ],
    } as never,
    flowCheckpointIds: ['state:in'],
  };
  const plan = await getAdapter('express').propose(context);
  const checkpointOps = plan.operations.filter((operation) => operation.eventMappings.some((item) => item.checkpointId));
  assert.deepEqual(checkpointOps.map((operation) => operation.id), ['state:in']);
});
