import assert from 'node:assert/strict';
import test from 'node:test';
import { GraphBuilder } from './core';
import type { CodeEntity } from '@tellann/desktop-contracts';

const route = (overrides: Partial<CodeEntity> = {}): CodeEntity => ({
  id: 'route:/login', type: 'ui_route', name: '/login', path: 'src/pages/login.tsx',
  startLine: 1, endLine: null, language: 'TypeScript', confidence: 0.98,
  metadata: { route: '/login' }, evidence: [], ...overrides,
});

test('two files declaring the same route id keep the first path and record the conflict', () => {
  const graph = new GraphBuilder();
  graph.addEntity(route());
  graph.addEntity(route({ path: 'src/pages/admin/account-settings.admin.tsx' }));
  const merged = graph.entity('route:/login');
  assert.equal(merged?.path, 'src/pages/login.tsx', 'the first file analyzed keeps the entity\'s location');
  assert.deepEqual(merged?.metadata.alternatePaths, ['src/pages/admin/account-settings.admin.tsx']);
});

test('the same file reporting the same route twice is not treated as a conflict', () => {
  const graph = new GraphBuilder();
  graph.addEntity(route());
  graph.addEntity(route({ confidence: 0.99 }));
  const merged = graph.entity('route:/login');
  assert.equal(merged?.path, 'src/pages/login.tsx');
  assert.equal(merged?.metadata.alternatePaths, undefined);
});

test('a third colliding file is added to the existing conflict list rather than replacing it', () => {
  const graph = new GraphBuilder();
  graph.addEntity(route());
  graph.addEntity(route({ path: 'src/pages/admin/account-settings.admin.tsx' }));
  graph.addEntity(route({ path: 'src/legacy/old-login-route.tsx' }));
  const merged = graph.entity('route:/login');
  assert.deepEqual(
    new Set(merged?.metadata.alternatePaths as string[]),
    new Set(['src/pages/admin/account-settings.admin.tsx', 'src/legacy/old-login-route.tsx']),
  );
});
