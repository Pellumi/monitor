import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { findInstalledPackage } from './sdk-installation';

function installPackage(nodeModules: string, manifest: Record<string, unknown>) {
  const directory = path.join(nodeModules, ...String(manifest.name).split('/'));
  fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, 'dist', 'index.js'), 'export const TELLANN = {};');
  return directory;
}

// The published frontend SDK's exports map: only "." is exposed.
const frontendSdk = {
  name: '@tellann/frontend-sdk',
  version: '0.1.0',
  type: 'module',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' } },
};

test('finds a package whose exports map does not expose package.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-sdk-installed-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'app' }));
  const directory = installPackage(path.join(root, 'node_modules'), frontendSdk);

  // The resolution the old check relied on fails for this package.
  assert.throws(
    () => createRequire(path.join(root, 'package.json')).resolve('@tellann/frontend-sdk/package.json'),
    { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
  );
  assert.deepEqual(findInstalledPackage(root, '@tellann/frontend-sdk'), { directory, version: '0.1.0' });
});

test('finds a package hoisted to a parent node_modules, as in a monorepo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-sdk-installed-'));
  const app = path.join(root, 'apps', 'web');
  fs.mkdirSync(app, { recursive: true });
  installPackage(path.join(root, 'node_modules'), frontendSdk);

  assert.equal(findInstalledPackage(app, '@tellann/frontend-sdk')?.version, '0.1.0');
});

test('reports a package that is not installed, or a directory holding a different package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-sdk-installed-'));
  assert.equal(findInstalledPackage(root, '@tellann/frontend-sdk'), null);

  installPackage(path.join(root, 'node_modules'), { ...frontendSdk, name: '@tellann/backend-sdk' });
  fs.renameSync(
    path.join(root, 'node_modules', '@tellann', 'backend-sdk'),
    path.join(root, 'node_modules', '@tellann', 'frontend-sdk'),
  );
  assert.equal(findInstalledPackage(root, '@tellann/frontend-sdk'), null);
});
