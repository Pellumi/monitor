import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { findInstalledPackage, findInstalledPythonDistribution, pythonEnvironments } from './sdk-installation';

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

function installDistribution(sitePackages: string, name: string, version: string | null) {
  const directory = path.join(sitePackages, version ? `${name}-${version}.dist-info` : `${name}.egg-info`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'METADATA'), `Name: ${name}\nVersion: ${version ?? '0.0.0'}\n`);
  return directory;
}

test('finds a pip-installed distribution in the project virtual environment', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pip-'));
  fs.writeFileSync(path.join(root, 'requirements.txt'), 'tellann>=0.1,<1\n');
  // Windows lays a virtual environment out as Lib/site-packages.
  const sitePackages = path.join(root, '.venv', 'Lib', 'site-packages');
  const directory = installDistribution(sitePackages, 'tellann', '0.1.0');

  // The JavaScript probe cannot see it: a pip install never touches node_modules.
  assert.equal(findInstalledPackage(root, 'tellann'), null);
  assert.deepEqual(findInstalledPythonDistribution(root, 'tellann'), {
    directory,
    version: '0.1.0',
    environment: sitePackages,
  });
});

test('finds a distribution in a POSIX-shaped environment and in a parent directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pip-posix-'));
  const service = path.join(root, 'services', 'billing');
  fs.mkdirSync(service, { recursive: true });
  const sitePackages = path.join(root, '.venv', 'lib', 'python3.12', 'site-packages');
  installDistribution(sitePackages, 'tellann', '0.2.1');

  assert.equal(findInstalledPythonDistribution(service, 'tellann')?.version, '0.2.1');
});

test('matches a distribution whose recorded name is normalized differently', () => {
  // PEP 503: runs of -, _ and . collapse, and case folds.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pip-normal-'));
  const sitePackages = path.join(root, 'venv', 'Lib', 'site-packages');
  installDistribution(sitePackages, 'Tellann_SDK', '1.0.0');

  assert.equal(findInstalledPythonDistribution(root, 'tellann-sdk')?.version, '1.0.0');
});

test('finds an editable install, which records no version in its directory name', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pip-editable-'));
  const sitePackages = path.join(root, '.venv', 'Lib', 'site-packages');
  installDistribution(sitePackages, 'tellann', null);

  const found = findInstalledPythonDistribution(root, 'tellann');
  assert.ok(found, 'the egg-info directory is found');
  assert.equal(found!.version, null);
});

test('reports a distribution that is not installed, and an environment that does not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pip-missing-'));
  // The search also walks parents and honours VIRTUAL_ENV, neither of which
  // this test controls, so only the ones inside the fixture are asserted on.
  const within = () => pythonEnvironments(root).filter((directory) => directory.startsWith(root));

  fs.writeFileSync(path.join(root, 'requirements.txt'), 'tellann>=0.1,<1\n');
  assert.equal(findInstalledPythonDistribution(root, 'tellann'), null);
  assert.deepEqual(within(), [], 'no environment is invented when there is none');

  // A different distribution in the same environment is not mistaken for it.
  const sitePackages = path.join(root, '.venv', 'Lib', 'site-packages');
  installDistribution(sitePackages, 'django', '5.0.3');
  assert.equal(findInstalledPythonDistribution(root, 'tellann'), null);
  assert.deepEqual(within(), [sitePackages]);
});
