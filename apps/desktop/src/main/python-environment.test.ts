import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  environmentForInterpreter,
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

/** A Conda prefix, which puts its interpreter in the prefix and marks itself with conda-meta. */
function makeCondaPrefix(root: string) {
  const binary = path.join(root, 'python.exe');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(binary, '');
  fs.mkdirSync(path.join(root, 'conda-meta'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Library', 'bin'), { recursive: true });
  return { binary };
}

/** Run with environment variables set, restoring whatever was there before. */
function withEnvironment(values: Record<string, string | undefined>, body: () => void) {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    body();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('a Poetry environment outside the repository is found from pyproject.toml', () => {
  // Poetry keeps the environment in a shared cache, not beside the code, and the
  // desktop application is started from the Start menu with nothing activated -
  // so nothing pointed at it and the project silently ran on PATH.
  const root = fixture();
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[tool.poetry]\nname = "billing-api"\n');
  const store = fixture();
  const { binary } = makeVirtualenv(path.join(store, 'billing-api-9WQ7Bqcf-py3.12'), 'windows');

  withEnvironment({ POETRY_VIRTUALENVS_PATH: store }, () => {
    const resolved = resolvePythonInterpreter(root, 'python');
    assert.equal(resolved.executable, binary);
    assert.equal(resolved.discovery, 'poetry');
  });
});

test('the hash Poetry appends does not have to be reproduced', () => {
  // Poetry's hash is taken over the path as Python spelled it, which differs
  // between a drive letter's two cases and between two checkouts. The prefix is
  // what identifies the project; the interpreter inside is what confirms it.
  const root = fixture();
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "billing-api"\n');
  const store = fixture();
  fs.mkdirSync(path.join(store, 'billing-api-ZZZZZZZZ-py3.9'), { recursive: true });
  const current = makeVirtualenv(path.join(store, 'billing-api-AAAAAAAA-py3.12'), 'windows');

  withEnvironment({ POETRY_VIRTUALENVS_PATH: store }, () => {
    // The one without an interpreter is not an environment, whatever it is named.
    assert.equal(resolvePythonInterpreter(root, 'python').executable, current.binary);
  });
});

test("a project's own environment still beats the one in the shared cache", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "billing-api"\n');
  const store = fixture();
  makeVirtualenv(path.join(store, 'billing-api-9WQ7Bqcf-py3.12'), 'windows');
  const own = makeVirtualenv(path.join(root, '.venv'), 'windows');

  withEnvironment({ POETRY_VIRTUALENVS_PATH: store }, () => {
    const resolved = resolvePythonInterpreter(root, 'python');
    assert.equal(resolved.executable, own.binary);
    assert.equal(resolved.discovery, 'project');
  });
});

test('a name match alone does not adopt somebody else that environment', () => {
  // Without a manifest the directory is not a Python project, and a shared cache
  // full of other people's environments is not searched on a name alone.
  const root = fixture();
  const store = fixture();
  makeVirtualenv(path.join(store, `${path.basename(root)}-9WQ7Bqcf-py3.12`), 'windows');

  withEnvironment({ POETRY_VIRTUALENVS_PATH: store }, () => {
    assert.equal(resolvePythonInterpreter(root, 'python').fromEnvironment, false);
  });
});

test('a pipenv environment is found under WORKON_HOME', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'Pipfile'), '[packages]\ndjango = "*"\n');
  const store = fixture();
  const { binary } = makeVirtualenv(path.join(store, `${path.basename(root)}-abc123`), 'windows');

  withEnvironment({ WORKON_HOME: store }, () => {
    const resolved = resolvePythonInterpreter(root, 'python');
    assert.equal(resolved.executable, binary);
    assert.equal(resolved.discovery, 'pipenv');
  });
});

test('PDM names its interpreter outright, so it is read rather than guessed at', () => {
  const root = fixture();
  const elsewhere = fixture();
  const { binary } = makeVirtualenv(path.join(elsewhere, 'pdm-env'), 'windows');
  fs.writeFileSync(path.join(root, '.pdm-python'), `${binary}\n`);

  const resolved = resolvePythonInterpreter(root, 'python');
  assert.equal(resolved.executable, binary);
  assert.equal(resolved.environmentRoot, path.join(elsewhere, 'pdm-env'));
  assert.equal(resolved.discovery, 'pdm');
});

test('a version in .python-version resolves through the pyenv store', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, '.python-version'), '3.11.4\n');
  const pyenv = fixture();
  const binary = path.join(pyenv, 'versions', '3.11.4', 'python.exe');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, '');

  withEnvironment({ PYENV_ROOT: pyenv }, () => {
    const resolved = resolvePythonInterpreter(root, 'python');
    assert.equal(resolved.executable, binary);
    assert.equal(resolved.discovery, 'pyenv');
  });
});

test('a pyenv-virtualenv name resolves through the same store', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, '.python-version'), 'billing-3.11\n');
  const pyenv = fixture();
  const { binary } = makeVirtualenv(
    path.join(pyenv, 'versions', 'billing-3.11'),
    'posix',
  );

  withEnvironment({ PYENV_ROOT: pyenv }, () => {
    assert.equal(resolvePythonInterpreter(root, 'python').executable, binary);
  });
});

test('a launched process runs inside the environment, not merely on its interpreter', () => {
  // Running the right interpreter by absolute path is enough for the interpreter
  // itself, but anything the application shells out to - a subprocess call to
  // `python`, a `pip` by name, a library reading VIRTUAL_ENV - was still seeing
  // the desktop application's PATH, where nothing is activated.
  const root = fixture();
  const environmentRoot = path.join(root, '.venv');
  makeVirtualenv(environmentRoot, 'windows');
  const interpreter = resolvePythonInterpreter(root, 'python');

  const environment = environmentForInterpreter(interpreter, {
    PATH: '/usr/bin',
    PYTHONHOME: '/some/other/python',
  });

  assert.equal(environment.VIRTUAL_ENV, environmentRoot);
  assert.equal(
    environment.PATH,
    [path.join(environmentRoot, 'Scripts'), '/usr/bin'].join(path.delimiter),
    'the environment goes in front of what was inherited, not after it',
  );
  assert.equal(
    environment.PYTHONHOME,
    undefined,
    'an inherited PYTHONHOME would point this interpreter at another standard library',
  );
});

test('without an environment nothing is activated', () => {
  const root = fixture();
  const interpreter = resolvePythonInterpreter(root, 'python');
  const environment = environmentForInterpreter(interpreter, { PATH: '/usr/bin' });
  assert.equal(environment.VIRTUAL_ENV, undefined);
  assert.equal(environment.PATH, '/usr/bin', 'PATH is left exactly as it was');
});

test('a Conda prefix is activated as Conda, not as a virtual environment', () => {
  const root = fixture();
  const prefix = path.join(root, '.venv');
  makeCondaPrefix(prefix);
  const interpreter = resolvePythonInterpreter(root, 'python');
  assert.equal(interpreter.conda, true);

  const environment = environmentForInterpreter(interpreter, {
    PATH: '/usr/bin',
    VIRTUAL_ENV: '/a/stale/virtualenv',
  });
  assert.equal(environment.CONDA_PREFIX, prefix);
  assert.equal(
    environment.VIRTUAL_ENV,
    undefined,
    'the two markers are mutually exclusive, and a stale one misdirects tools',
  );
  assert.ok(
    environment.PATH?.startsWith(prefix),
    'Conda puts the prefix itself on PATH, where its interpreter lives',
  );
  assert.ok(
    environment.PATH?.includes(path.join(prefix, 'Library', 'bin')),
    'packages with native libraries load them from Library/bin',
  );
});

test('a stale CONDA_PREFIX is cleared when a virtual environment is activated', () => {
  const root = fixture();
  makeVirtualenv(path.join(root, '.venv'), 'windows');
  const environment = environmentForInterpreter(resolvePythonInterpreter(root, 'python'), {
    PATH: '/usr/bin',
    CONDA_PREFIX: '/a/stale/conda',
  });
  assert.equal(environment.CONDA_PREFIX, undefined);
  assert.equal(environment.VIRTUAL_ENV, path.join(root, '.venv'));
});

test('PATH is replaced rather than duplicated under its other spelling', {
  skip: process.platform !== 'win32' ? 'Windows names variables case-insensitively' : false,
}, () => {
  // Spreading an environment whose key is `Path` and then setting `PATH` leaves
  // both in the object, and the child reads whichever it finds first - so the
  // activated entry would be dropped half the time.
  const root = fixture();
  makeVirtualenv(path.join(root, '.venv'), 'windows');
  const environment = environmentForInterpreter(resolvePythonInterpreter(root, 'python'), {
    Path: '/usr/bin',
  });

  const keys = Object.keys(environment).filter((key) => key.toLowerCase() === 'path');
  assert.deepEqual(keys, ['Path'], 'the key that was already there is the one written to');
  assert.ok(environment.Path?.startsWith(path.join(root, '.venv', 'Scripts')));
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
