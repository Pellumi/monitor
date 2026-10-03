import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApplicationArchitectureProjectionSchema, type SdkTrack } from '@tellann/desktop-contracts';
import { detectApplicationProfile, unsupportedSdkTracks, type ApplicationProfileInput } from './application-profile';
import type { PackageBoundary } from './inventory';

function pkg(
  root: string,
  dependencies: Record<string, string>,
  options: { ecosystem?: 'node' | 'python'; scripts?: Record<string, string> } = {},
): PackageBoundary {
  return {
    root,
    name: root,
    kind: 'application',
    ecosystem: options.ecosystem ?? 'node',
    dependencies,
    devDependencies: {},
    scripts: options.scripts ?? {},
    private: true,
  };
}

function detect(overrides: Partial<ApplicationProfileInput> & Pick<ApplicationProfileInput, 'packages' | 'files'>) {
  return detectApplicationProfile({
    workspaceRoot: '.',
    analysisSnapshotId: 'snapshot-1',
    ...overrides,
  });
}

const REACT_DEPENDENCIES = { react: '^18.2.0', 'react-dom': '^18.2.0' };

test('React + Vite frontend is FRONTEND with high confidence and no backend runtime', () => {
  const result = detect({
    packages: [pkg('.', { ...REACT_DEPENDENCIES }, { scripts: { dev: 'vite' } })],
    files: ['src/main.tsx', 'src/App.tsx', 'src/components/Button.tsx'],
  });
  assert.equal(result.detectedType, 'FRONTEND');
  assert.equal(result.confidence, 'HIGH');
  assert.equal(result.traits.browserSurface, true);
  assert.equal(result.traits.backendRuntime, false);
  assert.equal(result.traits.apiProvider, false);
  assert.equal(result.traits.managedBrowserRunnable, true);
  assert.equal(result.traits.apiConsumer, true, 'browser app is assumed to call an API until the AST pass says otherwise');
});

test('Next.js without route handlers is FRONTEND, with client routing and no server actions', () => {
  const result = detect({
    packages: [pkg('.', { next: '14.2.0', ...REACT_DEPENDENCIES }, { scripts: { dev: 'next dev' } })],
    files: ['app/page.tsx', 'app/layout.tsx'],
  });
  assert.equal(result.detectedType, 'FRONTEND');
  assert.equal(result.traits.clientRouting, true);
  assert.equal(result.traits.backendRuntime, false);
  assert.equal(result.traits.serverRendering, false);
});

test('Next.js with route handlers is MIXED and exposes an API provider', () => {
  const result = detect({
    packages: [pkg('.', { next: '14.2.0', ...REACT_DEPENDENCIES })],
    files: ['app/page.tsx', 'app/layout.tsx', 'app/api/orders/[id]/route.ts'],
    routeTemplates: ['/api/orders/[id]'],
  });
  assert.equal(result.detectedType, 'MIXED');
  assert.equal(result.traits.backendRuntime, true);
  assert.equal(result.traits.apiProvider, true);
  assert.equal(result.traits.serverRendering, true);
  assert.deepEqual(result.routeTemplates, ['/api/orders/{param}']);
});

test('Express service with routes is BACKEND with high confidence and no browser surface', () => {
  const result = detect({
    packages: [pkg('.', { express: '^4.19.0' })],
    files: ['src/server.ts', 'src/routes/orders.ts'],
    routeTemplates: ['/orders/:id', '/health'],
  });
  assert.equal(result.detectedType, 'BACKEND');
  assert.equal(result.confidence, 'HIGH');
  assert.equal(result.traits.browserSurface, false);
  assert.equal(result.traits.apiConsumer, false);
  assert.equal(result.traits.apiProvider, true);
  assert.deepEqual(result.frameworks.map((f) => f.id), ['express']);
});

test('NestJS controller service is BACKEND', () => {
  const result = detect({
    packages: [pkg('.', { '@nestjs/core': '^10.0.0' })],
    files: ['src/main.ts', 'src/controllers/orders.controller.ts'],
    routeTemplates: ['/orders'],
  });
  assert.equal(result.detectedType, 'BACKEND');
  assert.equal(result.frameworks[0].sdkSupport, 'SUPPORTED');
});

test('Fastify service is BACKEND', () => {
  const result = detect({
    packages: [pkg('.', { fastify: '^4.26.0' })],
    files: ['src/app.ts'],
    routeTemplates: ['/health'],
  });
  assert.equal(result.detectedType, 'BACKEND');
});

test('plain JavaScript with no framework signals is UNKNOWN with low confidence', () => {
  const result = detect({
    packages: [pkg('.', { lodash: '^4.17.21' })],
    files: ['src/index.js', 'src/util.js'],
  });
  assert.equal(result.detectedType, 'UNKNOWN');
  assert.equal(result.confidence, 'LOW');
  assert.ok(result.warnings.some((w) => w.includes('threshold')));
});

test('Vue is recognised as a frontend, but flagged as having no instrumentation support', () => {
  const result = detect({
    packages: [pkg('.', { vue: '^3.4.0' })],
    files: ['src/main.ts', 'src/App.vue'],
  });
  assert.equal(result.detectedType, 'FRONTEND');
  assert.equal(result.frameworks[0].id, 'vue');
  assert.equal(result.frameworks[0].sdkSupport, 'PLANNED');
  assert.ok(result.warnings.some((w) => w.includes('cannot instrument')));
  assert.deepEqual(unsupportedSdkTracks(result.frameworks), ['FRONTEND' satisfies SdkTrack]);
});

test('Django is recognised as a backend from Python manifests, with a supported SDK', () => {
  const result = detect({
    packages: [pkg('.', { Django: '>=4.2' }, { ecosystem: 'python' })],
    files: ['manage.py', 'orders/views.py', 'orders/urls.py'],
    routeTemplates: ['/orders/<int:id>/'],
  });
  assert.equal(result.detectedType, 'BACKEND');
  assert.equal(result.frameworks[0].id, 'django');
  assert.equal(result.frameworks[0].sdkSupport, 'SUPPORTED');
  assert.deepEqual(result.routeTemplates, ['/orders/{param}']);
});

test('a serverless API route folder alone is BACKEND, with medium confidence', () => {
  const result = detect({
    packages: [pkg('.', {})],
    files: ['app/api/orders/route.ts'],
  });
  assert.equal(result.detectedType, 'BACKEND');
  assert.equal(result.confidence, 'MEDIUM');
  assert.equal(result.traits.apiProvider, true);
  assert.equal(result.traits.backendRuntime, true);
});

test('monorepo: the selected workspace decides the type, not the whole repository', () => {
  const packages = [
    pkg('apps/web', { ...REACT_DEPENDENCIES }),
    pkg('services/api', { express: '^4.19.0' }),
  ];
  const files = ['apps/web/src/main.tsx', 'apps/web/src/App.tsx', 'services/api/src/server.ts'];
  const routeTemplates = ['/orders'];

  const web = detect({ workspaceRoot: 'apps/web', packages, files, routeTemplates });
  assert.equal(web.detectedType, 'FRONTEND');
  assert.equal(web.workspaceRoot, 'apps/web');

  const api = detect({ workspaceRoot: 'services/api', packages, files, routeTemplates });
  assert.equal(api.detectedType, 'BACKEND');

  const whole = detect({ workspaceRoot: '.', packages, files, routeTemplates });
  assert.equal(whole.detectedType, 'MIXED');
});

test('an empty workspace reports that no manifest was found, and does not throw', () => {
  const result = detect({ workspaceRoot: 'missing', packages: [], files: [] });
  assert.equal(result.detectedType, 'UNKNOWN');
  assert.ok(result.warnings.some((w) => w.includes('No package manifest')));
});

test('a server runtime without resolved routes is flagged rather than silently accepted', () => {
  const result = detect({
    packages: [pkg('.', { express: '^4.19.0' })],
    files: ['src/server.ts'],
  });
  assert.equal(result.detectedType, 'BACKEND');
  assert.ok(result.warnings.some((w) => w.includes('no route templates')));
});

test('route variants are canonicalised and de-duplicated', () => {
  const result = detect({
    packages: [pkg('.', { express: '^4.19.0' })],
    files: ['src/server.ts'],
    routeTemplates: ['/orders/:id', '/orders/[id]', '/orders/{orderId}/'],
  });
  assert.deepEqual(result.routeTemplates, ['/orders/{param}']);
});

test('the projection carries only contract fields: no source, literals or environment values', () => {
  const result = detect({
    packages: [pkg('.', { express: '^4.19.0' })],
    files: ['src/server.ts'],
    routeTemplates: ['/health'],
  });
  assert.deepEqual(Object.keys(result).sort(), Object.keys(ApplicationArchitectureProjectionSchema.shape).sort());
  assert.doesNotMatch(JSON.stringify(result), /API_KEY|secret|password/i);
});

test('detection is deterministic for identical input', () => {
  const input = {
    packages: [pkg('.', { next: '14.2.0', ...REACT_DEPENDENCIES })],
    files: ['app/page.tsx', 'app/api/x/route.ts'],
    routeTemplates: ['/api/x'],
  };
  assert.deepEqual(detect(input), detect(input));
});

test('explicit signals override the defaults for API consumption and server actions', () => {
  const result = detect({
    packages: [pkg('.', { ...REACT_DEPENDENCIES })],
    files: ['src/main.tsx'],
    signals: { consumesHttpApi: false, useServerDirective: true },
  });
  assert.equal(result.traits.apiConsumer, false);
  assert.equal(result.traits.serverActions, true);
});

test('unsupportedSdkTracks ignores a track that has at least one supported framework', () => {
  assert.deepEqual(unsupportedSdkTracks([{ id: 'react' }, { id: 'vue' }]), []);
  assert.deepEqual(unsupportedSdkTracks([{ id: 'react' }]), []);
});

test('workspace candidates come from the whole repository, even when one workspace is analysed', () => {
  const packages = [pkg('apps/web', { ...REACT_DEPENDENCIES }), pkg('services/api', { express: '^4.19.0' })];
  const result = detect({ workspaceRoot: 'apps/web', packages, files: ['apps/web/src/main.tsx'] });
  assert.deepEqual(result.workspaceCandidates, ['apps/web', 'services/api']);
  assert.equal(result.workspaceRoot, 'apps/web');
});

test('a single-package repository offers no workspace candidates', () => {
  const result = detect({ packages: [pkg('.', { express: '^4.19.0' })], files: ['src/server.ts'] });
  assert.deepEqual(result.workspaceCandidates, []);
});
