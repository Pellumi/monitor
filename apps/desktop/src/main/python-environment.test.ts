import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  interpreterWithin,
  isPythonInterpreterName,
  pythonEnvironments,
  resolvePythonInterpreter,
} from './python-environment';

function fixture(): string {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-pyenv-')));
}

/** A virtual environment as `python -m venv` lays one out on the given platform. */
function makeVirtualenv(root: string, platform: 'windows' | 'posix', pythonVersion = '3.12') {
  const binary = platform === 'windows'
    ? path.join(root, 'Scripts', 'python.exe')
    : path.join(root, 'bin', 'python3');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, '');
  const sitePackages = platform === 'windows'
    ? path.join(root, 'Lib', 'site-packages')
    : path.join(root, 'lib', `python${pythonVersion}`, 'site-packages');
  fs.mkdirSync(sitePackages, { recursive: true });
  return { binary, sitePackages };
}

test('the project virtual environment supplies the interpreter, not PATH', () => {
  // Spawning `python` by name used the desktop application's PATH, which has no
  // activated environment - so Django ran on the system interpreter and failed
  // with "No module named 'django'" while `.venv` sat beside the code.
  const root = fixture();
  const { binary } = makeVirtualenv(path.join(root, '.venv'), 'windows');

  const resolved = resolvePythonInterpreter(root, 'python');
  assert.equal(resolved.executable, binary);
  assert.equal(resolved.fromEnvironment, true);
  assert.equal(resolved.environmentRoot, path.join(root, '.venv'));
});

test('a POSIX-shaped environment resolves too, whatever host is reading it', () => {
  // A repository moves between a Windows machine and a Linux one; the layout on
  // disk is the one that built it, not the one reading it.
  const root = fixture();
  const { binary } = makeVirtualenv(path.join(root, '.venv'), 'posix');
  assert.equal(resolvePythonInterpreter(root, 'python').executable, binary);
});

test('.venv wins over the other conventional names', () => {
  const root = fixture();
  makeVirtualenv(path.join(root, 'venv'), 'windows');
  const preferred = makeVirtualenv(path.join(root, '.venv'), 'windows');
  assert.equal(resolvePythonInterpreter(root, 'python').executable, preferred.binary);
});

test('an environment at the repository root serves a backend in a subdirectory', () => {
  const root = fixture();
  const backend = path.join(root, 'services', 'billing');
  fs.mkdirSync(backend, { recursive: true });
  const { binary } = makeVirtualenv(path.join(root, '.venv'), 'windows');
  assert.equal(resolvePythonInterpreter(backend, 'python').executable, binary);
});

test('the nearest environment wins over one further up', () => {
  const root = fixture();
  const backend = path.join(root, 'services', 'billing');
  fs.mkdirSync(backend, { recursive: true });
  makeVirtualenv(path.join(root, '.venv'), 'windows');
  const nearest = makeVirtualenv(path.join(backend, '.venv'), 'windows');
  assert.equal(resolvePythonInterpreter(backend, 'python').executable, nearest.binary);
});

test('without an environment the given name is used, and says so', () => {
  const root = fixture();
  const resolved = resolvePythonInterpreter(root, 'python3');
  assert.equal(resolved.executable, 'python3', 'PATH is trusted, as before');
  assert.equal(resolved.fromEnvironment, false, 'the caller can say no environment was found');
  assert.equal(resolved.environmentRoot, null);
});

test('a directory that only looks like an environment is not one', () => {
  const root = fixture();
  // `.venv` with no interpreter in it - a leftover, or a name collision.
  fs.mkdirSync(path.join(root, '.venv', 'Scripts'), { recursive: true });
  assert.equal(resolvePythonInterpreter(root, 'python').fromEnvironment, false);
  assert.equal(interpreterWithin(path.join(root, '.venv')), null);
});

test('site-packages discovery follows the same environments', () => {
  const root = fixture();
  const windows = makeVirtualenv(path.join(root, '.venv'), 'windows');
  const found = pythonEnvironments(root).filter((directory) => directory.startsWith(root));
  assert.deepEqual(found, [windows.sitePackages]);
});

test('interpreter names are told apart from package managers', () => {
  for (const name of ['python', 'python3', 'python.exe', 'py']) {
    assert.equal(isPythonInterpreterName(name), true, name);
  }
  // These install the SDK but are not interpreters, so they resolve their own way.
  for (const name of ['poetry', 'uv', 'pdm', 'pipenv', 'npm.cmd', 'pnpm']) {
    assert.equal(isPythonInterpreterName(name), false, name);
  }
});
