import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApprovalHash, detectAdapters, getAdapter, type LocalProjectContext } from './index';

function fixture(input: { dependencies: Record<string, string>; entry: string; content: string }): LocalProjectContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-adapter-'));
  fs.mkdirSync(path.join(root, path.dirname(input.entry)), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { build: 'tsc --noEmit' }, dependencies: input.dependencies }, null, 2));
  fs.writeFileSync(path.join(root, input.entry), input.content);
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
      entry: 'src/index.ts', expected: /app\.use\(sotsExpressMiddleware\(\)\);[\s\S]*app\.use\(sotsExpressErrorHandler\(\)\);[\s\S]*app\.listen/,
    },
    {
      id: 'fastify' as const,
      context: fixture({ dependencies: { fastify: '^5.0.0' }, entry: 'src/server.ts', content: `import fastify from 'fastify';\nconst app = fastify();\napp.listen({ port: 3000 });\n` }),
      entry: 'src/server.ts', expected: /app\.register\(sotsFastifyPlugin\);/,
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
      generated: 'src/tellann.js', entry: 'src/index.js', expectedEntry: /const \{ sotsExpressErrorHandler, sotsExpressMiddleware \} = require\("\.\/tellann"\);/, expectedGenerated: /module\.exports = \{ SOTS, sotsExpressErrorHandler, sotsExpressMiddleware \}/,
    },
    {
      id: 'fastify' as const,
      context: fixture({ dependencies: { fastify: '^5.0.0' }, entry: 'src/server.js', content: `const fastify = require('fastify');\nconst app = fastify();\napp.listen({ port: 3000 });\n` }),
      generated: 'src/tellann.js', entry: 'src/server.js', expectedEntry: /const \{ sotsFastifyPlugin \} = require\("\.\/tellann"\);/, expectedGenerated: /module\.exports = \{ SOTS, sotsFastifyPlugin \}/,
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
  assert.match(fs.readFileSync(path.join(root, 'apps', 'web', 'package.json'), 'utf8'), /@sots\/frontend-sdk/);
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
  assert.equal((entry.match(/sotsExpressMiddleware\(\)/g) ?? []).length, 1);
  assert.equal((entry.match(/sotsExpressErrorHandler\(\)/g) ?? []).length, 1);
  assert.equal((entry.match(/from ['"]\.\/tellann['"]/g) ?? []).length, 1);
});

test('semantic workflow checkpoints are proposed, bounded, and idempotent', async () => {
  const context = fixture({ dependencies: { express: '^4.21.0' }, entry: 'src/index.ts', content: `import express from 'express';
const app = express();
async function createOrder() { return { id: 'one' }; }
app.post('/orders', async (_req, res) => res.json(await createOrder()));
app.listen(3000);
` });
  const adapter = getAdapter('express');
  const plan = await adapter.propose(context);
  const checkpoint = plan.operations.find((operation) => operation.transformId === 'tellann.semantic.function-entry');
  assert.equal(checkpoint?.symbol, 'createOrder');
  const result = await adapter.apply(context, {
    plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
  });
  const source = fs.readFileSync(path.join(context.workspaceRoot, 'src/index.ts'), 'utf8');
  assert.match(source, /tellann:checkpoint:semantic-/);
  assert.match(source, /TellannSOTS\.trackEvent\('WORKFLOW_STARTED'/);
  assert.equal((source.match(/tellann:checkpoint:/g) ?? []).length, 1);
  assert.equal((await adapter.validate(context, result)).valid, true);
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
  const sdkRoot = path.join(context.workspaceRoot, 'node_modules', '@sots', 'frontend-sdk');
  fs.mkdirSync(sdkRoot, { recursive: true });
  fs.writeFileSync(path.join(sdkRoot, 'package.json'), JSON.stringify({ name: '@sots/frontend-sdk', version: '0.1.0', main: 'index.js' }));
  fs.writeFileSync(path.join(sdkRoot, 'index.js'), 'exports.SOTS = {};');

  const plan = await getAdapter('react-vite').propose(context);

  assert.equal(plan.validationCommands.some((command) => command.id === 'install-sdk'), false);
  assert.deepEqual(plan.networkRequirements, []);
});
