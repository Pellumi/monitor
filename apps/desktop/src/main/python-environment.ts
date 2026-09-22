import fs from 'node:fs';
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
 * repository the member may not have reviewed.
 */

/**
 * Directory names that hold a virtual environment, in the order people create
 * them. `.venv` first because it is what `python -m venv` is documented with
 * and what every modern tool (uv, Poetry's in-project mode, PDM) defaults to.
 */
const VIRTUALENV_DIRECTORIES = ['.venv', 'venv', '.env', 'env'];

/** How far up from the project directory a parent environment is looked for. */
const MAX_PARENT_DEPTH = 6;

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
 * The interpreter inside one virtual environment root, or null when the
 * directory is not one.
 *
 * PEP 405 puts it in `Scripts` on Windows and `bin` everywhere else. Both are
 * checked regardless of the host, because a repository is routinely shared
 * between a Windows machine and a Linux one and the environment on disk may
 * have been built by either.
 */
export function interpreterWithin(environmentRoot: string): string | null {
  const candidates = [
    path.join(environmentRoot, 'Scripts', 'python.exe'),
    path.join(environmentRoot, 'bin', 'python3'),
    path.join(environmentRoot, 'bin', 'python'),
  ];
  return candidates.find(isFile) ?? null;
}

/** Virtual environment roots for a project, nearest first. */
function environmentRoots(fromDirectory: string): string[] {
  const roots: string[] = [];
  const add = (directory: string) => {
    if (directory && !roots.includes(directory)) roots.push(directory);
  };
  let current = path.resolve(fromDirectory);
  for (let depth = 0; depth <= MAX_PARENT_DEPTH; depth += 1) {
    for (const name of VIRTUALENV_DIRECTORIES) add(path.join(current, name));
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
    if (value) add(value);
  }
  return roots;
}

/**
 * The `site-packages` directories a project's dependencies could be installed
 * into, nearest first.
 */
export function pythonEnvironments(fromDirectory: string): string[] {
  const found: string[] = [];
  for (const root of environmentRoots(fromDirectory)) {
    for (const sitePackages of sitePackagesWithin(root)) {
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
};

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
  for (const root of environmentRoots(fromDirectory)) {
    const executable = interpreterWithin(root);
    if (executable) return { executable, environmentRoot: root, fromEnvironment: true };
  }
  return { executable: fallbackName, environmentRoot: null, fromEnvironment: false };
}

/** Whether an executable name refers to a Python interpreter rather than a package manager. */
export function isPythonInterpreterName(executable: string): boolean {
  return ['python', 'python3', 'python.exe', 'python3.exe', 'py', 'py.exe']
    .includes(path.basename(executable).toLowerCase());
}
