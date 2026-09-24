import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Finding the interpreter a Python project actually runs on.
 *
 * Spawning `python` by name uses whatever is on PATH, and the PATH a command
 * inherits here is the desktop application's own - the one it was started from
 * a launcher or a Start menu entry with, where no virtual environment has been
 * activated. So `python manage.py runserver` ran against the system interpreter
 * and failed with "No module named 'django'" while the project's own
 * environment sat in `.venv` beside it, and `python -m pip install tellann`
 * installed the SDK into that same wrong interpreter.
 *
 * A project's environment is read off the filesystem instead. Nothing here runs
 * an interpreter: the layout of a virtual environment is defined by PEP 405 and
 * a directory listing answers the question without executing code from a
 * repository the member may not have reviewed. That rules out asking the tools
 * themselves - `poetry env info -p` would be authoritative and is exactly the
 * kind of thing this module will not do - so the environments those tools keep
 * outside the repository are found by reading the locations they document.
 */

/**
 * Directory names that hold a virtual environment, in the order people create
 * them. `.venv` first because it is what `python -m venv` is documented with
 * and what every modern tool (uv, Poetry's in-project mode, PDM) defaults to.
 */
const VIRTUALENV_DIRECTORIES = ['.venv', 'venv', '.env', 'env'];

/** How far up from the project directory a parent environment is looked for. */
const MAX_PARENT_DEPTH = 6;

/** How an environment was found, so a failure can say where it came from. */
export type InterpreterDiscovery =
  | 'project'
  | 'pdm'
  | 'poetry'
  | 'pipenv'
  | 'pyenv'
  | 'process';

export function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function readDirectory(target: string): string[] {
  try {
    return fs.readdirSync(target);
  } catch {
    return [];
  }
}

function isFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function readFile(target: string): string | null {
  try {
    return fs.readFileSync(target, 'utf8');
  } catch {
    return null;
  }
}

/** Every `site-packages` directory under one virtual environment root. */
function sitePackagesWithin(environmentRoot: string): string[] {
  const found: string[] = [];
  // Windows puts them at `Lib/site-packages`; POSIX at `lib/pythonX.Y/site-packages`.
  const windows = path.join(environmentRoot, 'Lib', 'site-packages');
  if (isDirectory(windows)) found.push(windows);
  const lib = path.join(environmentRoot, 'lib');
  if (isDirectory(lib)) {
    for (const entry of readDirectory(lib)) {
      const nested = path.join(lib, entry, 'site-packages');
      if (isDirectory(nested)) found.push(nested);
    }
  }
  return found;
}

/**
 * The interpreter inside one environment root, or null when the directory is
 * not one.
 *
 * PEP 405 puts it in `Scripts` on Windows and `bin` everywhere else. Both are
 * checked regardless of the host, because a repository is routinely shared
 * between a Windows machine and a Linux one and the environment on disk may
 * have been built by either. The bare prefix is checked last, for Conda and
 * pyenv-win, which both put `python.exe` directly in it.
 */
export function interpreterWithin(environmentRoot: string): string | null {
  const candidates = [
    path.join(environmentRoot, 'Scripts', 'python.exe'),
    path.join(environmentRoot, 'bin', 'python3'),
    path.join(environmentRoot, 'bin', 'python'),
    path.join(environmentRoot, 'python.exe'),
  ];
  return candidates.find(isFile) ?? null;
}

/** Conda marks its prefixes with a `conda-meta` directory; virtual environments have none. */
export function isCondaPrefix(environmentRoot: string): boolean {
  return isDirectory(path.join(environmentRoot, 'conda-meta'));
}

/**
 * A name reduced to what it has in common across the tools that mangle it.
 *
 * Poetry and pipenv both derive a directory name from the project's name and a
 * hash of its path, and both replace the characters a directory may not hold -
 * but not identically, and not the same way across their own versions. Matching
 * on a normalised prefix accepts every spelling of the same project.
 */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * The project's own name, for matching against an environment directory that
 * was named after it.
 *
 * Read with a regular expression rather than a TOML parser: the only field
 * wanted is the name, a dependency to read it would be a poor trade, and a
 * pyproject.toml this misreads falls back to the directory name - which is what
 * the name usually is anyway.
 */
function projectNames(directory: string): string[] {
  const names = [path.basename(directory)];
  const manifest = readFile(path.join(directory, 'pyproject.toml'));
  const declared = manifest && /^\s*name\s*=\s*["']([^"']+)["']/m.exec(manifest)?.[1];
  if (declared) names.unshift(declared);
  return names.map(normalizeName).filter(Boolean);
}

/** The directories Poetry keeps the environments it builds outside a project in. */
function poetryVirtualenvDirectories(): string[] {
  const directories: string[] = [];
  const add = (value: string | undefined | null) => {
    if (value && !directories.includes(value)) directories.push(value);
  };
  add(process.env.POETRY_VIRTUALENVS_PATH);
  if (process.env.POETRY_CACHE_DIR)
    add(path.join(process.env.POETRY_CACHE_DIR, 'virtualenvs'));
  const home = os.homedir();
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    // Poetry 1.2 and newer nest the environments under `Cache`; older ones did not.
    add(path.join(localAppData, 'pypoetry', 'Cache', 'virtualenvs'));
    add(path.join(localAppData, 'pypoetry', 'virtualenvs'));
  } else if (process.platform === 'darwin') {
    add(path.join(home, 'Library', 'Caches', 'pypoetry', 'virtualenvs'));
  }
  const cache = process.env.XDG_CACHE_HOME ?? path.join(home, '.cache');
  add(path.join(cache, 'pypoetry', 'virtualenvs'));
  return directories;
}

/** Where pipenv and virtualenvwrapper keep theirs. */
function workonDirectories(): string[] {
  const directories = [path.join(os.homedir(), '.virtualenvs')];
  if (process.env.WORKON_HOME) directories.unshift(process.env.WORKON_HOME);
  return directories;
}

/** pyenv's version store, including the extra level pyenv-win adds. */
function pyenvVersionDirectories(): string[] {
  const roots = process.env.PYENV_ROOT
    ? [process.env.PYENV_ROOT]
    : [path.join(os.homedir(), '.pyenv')];
  return roots.flatMap((root) => [
    path.join(root, 'versions'),
    path.join(root, 'pyenv-win', 'versions'),
  ]);
}

/**
 * Environments in one of the shared stores that were named after this project.
 *
 * The name a tool builds is the project's plus a hash of its path, and the hash
 * is not reproduced here - Poetry's depends on the exact spelling of the path
 * as Python saw it, which differs between a drive letter's two cases and
 * between a repository's two checkouts. A prefix match finds the environment
 * whatever the hash is, and a candidate still has to hold an interpreter to be
 * used at all. Most recently written first, so the one in current use wins when
 * a project has an environment per Python version.
 */
function namedEnvironments(directory: string, stores: string[]): string[] {
  const names = projectNames(directory);
  if (!names.length) return [];
  const matches: Array<{ root: string; modified: number }> = [];
  for (const store of stores) {
    for (const entry of readDirectory(store)) {
      const normalized = normalizeName(entry);
      if (!names.some((name) => normalized === name || normalized.startsWith(`${name}-`)))
        continue;
      const root = path.join(store, entry);
      if (!isDirectory(root)) continue;
      let modified = 0;
      try {
        modified = fs.statSync(root).mtimeMs;
      } catch {
        modified = 0;
      }
      matches.push({ root, modified });
    }
  }
  return matches
    .sort((left, right) => right.modified - left.modified || left.root.localeCompare(right.root))
    .map((match) => match.root);
}

/**
 * The environment PDM recorded for a project.
 *
 * PDM writes the interpreter's own path into `.pdm-python`, which makes it the
 * one tool here that does not have to be guessed at.
 */
function pdmEnvironment(directory: string): string | null {
  const recorded = readFile(path.join(directory, '.pdm-python'))?.trim();
  if (!recorded || !isFile(recorded)) return null;
  const parent = path.dirname(recorded);
  return ['scripts', 'bin'].includes(path.basename(parent).toLowerCase())
    ? path.dirname(parent)
    : parent;
}

/**
 * The environments a `.python-version` file names.
 *
 * The file holds either a plain version that pyenv installed or the name of a
 * pyenv-virtualenv environment; both are directories in the same version store,
 * so both are answered by looking its contents up there.
 */
function pyenvEnvironments(directory: string): string[] {
  const requested = readFile(path.join(directory, '.python-version'))
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (!requested?.length) return [];
  const found: string[] = [];
  const add = (root: string) => {
    if (isDirectory(root) && !found.includes(root)) found.push(root);
  };
  for (const version of requested) {
    for (const store of pyenvVersionDirectories()) {
      add(path.join(store, version));
      // pyenv-virtualenv also keeps each environment under its base version.
      const nested = path.join(store, version, 'envs');
      for (const entry of readDirectory(nested)) add(path.join(nested, entry));
    }
  }
  return found;
}

type EnvironmentCandidate = { root: string; discovery: InterpreterDiscovery };

/**
 * Environment roots for a project, nearest first.
 *
 * At each level the project's own directories come before any shared store,
 * because a `.venv` beside the code is a more specific answer than an
 * environment named after the project in a cache that may hold several. A whole
 * level is exhausted before walking up, so a backend's own environment beats
 * the repository root's.
 */
function environmentCandidates(fromDirectory: string): EnvironmentCandidate[] {
  const candidates: EnvironmentCandidate[] = [];
  const add = (root: string, discovery: InterpreterDiscovery) => {
    if (root && !candidates.some((candidate) => candidate.root === root))
      candidates.push({ root, discovery });
  };
  let current = path.resolve(fromDirectory);
  for (let depth = 0; depth <= MAX_PARENT_DEPTH; depth += 1) {
    for (const name of VIRTUALENV_DIRECTORIES) add(path.join(current, name), 'project');
    const pdm = pdmEnvironment(current);
    if (pdm) add(pdm, 'pdm');
    // Only a level that looks like a Python project is matched against the
    // shared stores, so a directory that happens to share a name with somebody
    // else's environment is not adopted on the strength of the name alone.
    const hasPyproject = isFile(path.join(current, 'pyproject.toml'));
    if (hasPyproject) {
      for (const root of namedEnvironments(current, poetryVirtualenvDirectories()))
        add(root, 'poetry');
    }
    if (hasPyproject || isFile(path.join(current, 'Pipfile'))) {
      for (const root of namedEnvironments(current, workonDirectories())) add(root, 'pipenv');
    }
    for (const root of pyenvEnvironments(current)) add(root, 'pyenv');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // An environment the member activated that lives outside the repository,
  // which is what Conda and a shared `~/.virtualenvs` both look like. It comes
  // after the project's own, because a `.venv` beside the code is a more
  // specific answer than whatever the desktop application happened to inherit.
  for (const variable of ['VIRTUAL_ENV', 'CONDA_PREFIX']) {
    const value = process.env[variable];
    if (value) add(value, 'process');
  }
  return candidates;
}

/**
 * The `site-packages` directories a project's dependencies could be installed
 * into, nearest first.
 */
export function pythonEnvironments(fromDirectory: string): string[] {
  const found: string[] = [];
  for (const candidate of environmentCandidates(fromDirectory)) {
    for (const sitePackages of sitePackagesWithin(candidate.root)) {
      if (!found.includes(sitePackages)) found.push(sitePackages);
    }
  }
  return found;
}

export type ResolvedInterpreter = {
  executable: string;
  /** The environment root it came from, or null when it is just a name on PATH. */
  environmentRoot: string | null;
  /** False when no environment was found and PATH is being trusted. */
  fromEnvironment: boolean;
  /** Where the environment was found, or null when PATH is being trusted. */
  discovery: InterpreterDiscovery | null;
  /** Conda prefixes are activated differently from PEP 405 environments. */
  conda: boolean;
};

/** How an environment was found, in words a failure message can use. */
export function discoveryDescription(discovery: InterpreterDiscovery | null): string {
  switch (discovery) {
    case 'project':
      return 'the environment in the project directory';
    case 'pdm':
      return "the interpreter PDM recorded in '.pdm-python'";
    case 'poetry':
      return "Poetry's environment for this project";
    case 'pipenv':
      return 'the environment named after this project in your virtualenvs directory';
    case 'pyenv':
      return "the version named in '.python-version'";
    case 'process':
      return 'the environment active in the desktop application';
    default:
      return 'PATH';
  }
}

/**
 * The interpreter to run a project's Python with.
 *
 * Falls back to the name it was given - `python`, `python3` - so a project
 * without a virtual environment behaves as it did before, running against
 * whatever is on PATH. `fromEnvironment` says which of the two happened, so a
 * failure can tell the member whether an environment was even found.
 */
export function resolvePythonInterpreter(
  fromDirectory: string,
  fallbackName: string,
): ResolvedInterpreter {
  for (const candidate of environmentCandidates(fromDirectory)) {
    const executable = interpreterWithin(candidate.root);
    if (executable)
      return {
        executable,
        environmentRoot: candidate.root,
        fromEnvironment: true,
        discovery: candidate.discovery,
        conda: isCondaPrefix(candidate.root),
      };
  }
  return {
    executable: fallbackName,
    environmentRoot: null,
    fromEnvironment: false,
    discovery: null,
    conda: false,
  };
}

/** Whether an executable name refers to a Python interpreter rather than a package manager. */
export function isPythonInterpreterName(executable: string): boolean {
  return ['python', 'python3', 'python.exe', 'python3.exe', 'py', 'py.exe']
    .includes(path.basename(executable).toLowerCase());
}

/**
 * The directories an activated environment puts on PATH ahead of everything
 * else.
 *
 * A virtual environment contributes the one directory its interpreter lives in.
 * Conda contributes several on Windows, which is what its own activation does
 * and what packages carrying native libraries in `Library/bin` need to load.
 */
function activationPath(environmentRoot: string, conda: boolean): string[] {
  if (!conda) {
    const scripts = path.join(environmentRoot, 'Scripts');
    return isDirectory(scripts) ? [scripts] : [path.join(environmentRoot, 'bin')];
  }
  const directories = [environmentRoot];
  for (const relative of [
    ['Library', 'mingw-w64', 'bin'],
    ['Library', 'usr', 'bin'],
    ['Library', 'bin'],
    ['Scripts'],
    ['bin'],
  ]) {
    const directory = path.join(environmentRoot, ...relative);
    if (isDirectory(directory)) directories.push(directory);
  }
  return directories;
}

/**
 * The key an environment variable already occupies, so a write replaces it.
 *
 * Windows treats variable names case-insensitively and `process.env` mirrors
 * that, but a plain object copied out of it does not: spreading an environment
 * whose key is `Path` and then setting `PATH` leaves both in the object, and
 * the child process reads whichever it happens to find first. Every write here
 * goes through the key that is already there.
 */
function environmentKey(environment: NodeJS.ProcessEnv, name: string): string {
  if (process.platform !== 'win32') return name;
  const lowered = name.toLowerCase();
  return Object.keys(environment).find((key) => key.toLowerCase() === lowered) ?? name;
}

function deleteVariable(environment: NodeJS.ProcessEnv, name: string): void {
  const lowered = name.toLowerCase();
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === lowered) delete environment[key];
  }
}

/**
 * A child environment with the project's Python environment activated.
 *
 * Spawning the environment's own interpreter by absolute path is enough for the
 * interpreter itself - PEP 405 has it derive `sys.prefix` from its own location,
 * and Django's reloader re-executes `sys.executable` - but it is not enough for
 * anything the application shells out to. A `subprocess` call to `python`, a
 * `pip` invoked by name, a test runner, a library reading `VIRTUAL_ENV` to find
 * the environment it should install into: all of those were still seeing the
 * desktop application's PATH, where nothing is activated. This puts the
 * environment's script directory first and marks it active the way its own
 * activation script does, so a child process finds the interpreter its parent
 * ran on.
 */
export function environmentForInterpreter(
  interpreter: ResolvedInterpreter,
  base: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...base };
  if (!interpreter.fromEnvironment || !interpreter.environmentRoot) return environment;
  const root = interpreter.environmentRoot;

  // PYTHONHOME overrides the prefix an interpreter works out for itself, which
  // would point this environment's interpreter at another installation's
  // standard library. Activation scripts unset it for the same reason.
  deleteVariable(environment, 'PYTHONHOME');

  // The two are mutually exclusive markers of which environment is active, and
  // a stale one inherited from the desktop application's own environment sends
  // tools looking in the wrong place.
  deleteVariable(environment, interpreter.conda ? 'VIRTUAL_ENV' : 'CONDA_PREFIX');
  if (interpreter.conda) {
    environment[environmentKey(environment, 'CONDA_PREFIX')] = root;
    environment[environmentKey(environment, 'CONDA_DEFAULT_ENV')] = path.basename(root);
  } else {
    environment[environmentKey(environment, 'VIRTUAL_ENV')] = root;
    environment[environmentKey(environment, 'VIRTUAL_ENV_PROMPT')] = path.basename(root);
  }

  const key = environmentKey(environment, 'PATH');
  const existing = environment[key];
  environment[key] = [
    ...activationPath(root, interpreter.conda),
    ...(existing ? [existing] : []),
  ].join(path.delimiter);
  return environment;
}
