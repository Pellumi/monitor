import fs from 'node:fs';
import path from 'node:path';

export type InstalledPackage = { directory: string; version: string | null };

/**
 * Finds an installed package the way Node looks for one: `node_modules/<name>`
 * in the starting directory, then in each parent.
 *
 * The manifest is read from disk rather than resolved as `<name>/package.json`.
 * That resolution goes through the package's `exports` map, and a map that does
 * not list `./package.json` (as the published Tellann frontend SDK's does not)
 * makes it throw ERR_PACKAGE_PATH_NOT_EXPORTED even when the package is
 * installed.
 */
export function findInstalledPackage(fromDirectory: string, packageName: string): InstalledPackage | null {
  let current = path.resolve(fromDirectory);
  for (;;) {
    const manifest = path.join(current, 'node_modules', ...packageName.split('/'), 'package.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { name?: unknown; version?: unknown };
      if (parsed.name === packageName) {
        return {
          directory: path.dirname(manifest),
          version: typeof parsed.version === 'string' ? parsed.version : null,
        };
      }
    } catch {
      // Not installed at this level (or an unreadable manifest); keep looking up.
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export type InstalledDistribution = {
  /** The `.dist-info` or `.egg-info` directory that proves the install. */
  directory: string;
  version: string | null;
  /** The environment the distribution was found in, for the check's output. */
  environment: string;
};

/**
 * Directory names that hold a virtual environment, in the order people create
 * them. `.venv` first because it is what `python -m venv` is documented with
 * and what every modern tool (uv, poetry's in-project mode, PDM) defaults to.
 */
const VIRTUALENV_DIRECTORIES = ['.venv', 'venv', '.env', 'env'];

/**
 * PEP 503 normalization, which is what a `.dist-info` directory name is built
 * from: runs of `-`, `_` and `.` collapse to a single separator, and case is
 * folded. `Flask_SQLAlchemy` and `flask-sqlalchemy` are the same distribution.
 */
function normalizeDistribution(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
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

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function readDirectory(target: string): string[] {
  try {
    return fs.readdirSync(target);
  } catch {
    return [];
  }
}

/**
 * The interpreter environments a project's dependencies could have been
 * installed into, nearest first.
 *
 * `VIRTUAL_ENV` is checked because the member may have activated an environment
 * that lives outside the repository, which is what Conda and a shared
 * `~/.virtualenvs` both look like.
 */
export function pythonEnvironments(fromDirectory: string): string[] {
  const found: string[] = [];
  const add = (directory: string) => {
    if (directory && !found.includes(directory)) found.push(directory);
  };
  let current = path.resolve(fromDirectory);
  for (;;) {
    for (const name of VIRTUALENV_DIRECTORIES) {
      for (const sitePackages of sitePackagesWithin(path.join(current, name))) add(sitePackages);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const variable of ['VIRTUAL_ENV', 'CONDA_PREFIX']) {
    const value = process.env[variable];
    if (value) for (const sitePackages of sitePackagesWithin(value)) add(sitePackages);
  }
  return found;
}

/**
 * Finds a pip-installed distribution the way the packaging tools record one:
 * a `<name>-<version>.dist-info` directory in `site-packages` (PEP 376), or the
 * older `.egg-info` that a `setup.py develop` install still leaves behind.
 *
 * This reads the filesystem rather than asking an interpreter. Running the
 * project's Python to import a module would execute code from a repository the
 * member may not have reviewed, for a question a directory listing answers.
 */
export function findInstalledPythonDistribution(
  fromDirectory: string,
  distribution: string,
): InstalledDistribution | null {
  const wanted = normalizeDistribution(distribution);
  for (const sitePackages of pythonEnvironments(fromDirectory)) {
    for (const entry of readDirectory(sitePackages)) {
      const match = /^(.+?)-([^-]+)\.(dist-info|egg-info)$/.exec(entry)
        // `pip install -e .` writes `<name>.egg-info` with no version in the name.
        ?? /^(.+?)()\.(egg-info)$/.exec(entry);
      if (!match) continue;
      if (normalizeDistribution(match[1]) !== wanted) continue;
      const directory = path.join(sitePackages, entry);
      if (!isDirectory(directory)) continue;
      return { directory, version: match[2] || null, environment: sitePackages };
    }
  }
  return null;
}
