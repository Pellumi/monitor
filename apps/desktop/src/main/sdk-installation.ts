import fs from 'node:fs';
import path from 'node:path';
import { isDirectory, pythonEnvironments, readDirectory } from './python-environment';

// Discovering where a project's interpreter and its packages live belongs with
// the rest of the Python environment handling; this module only answers whether
// a distribution is installed in one.
export { pythonEnvironments } from './python-environment';

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

/**
 * PEP 503 normalization, which is what a `.dist-info` directory name is built
 * from: runs of `-`, `_` and `.` collapse to a single separator, and case is
 * folded. `Flask_SQLAlchemy` and `flask-sqlalchemy` are the same distribution.
 */
function normalizeDistribution(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}

export type InstalledDistribution = {
  /** The `.dist-info` or `.egg-info` directory that proves the install. */
  directory: string;
  version: string | null;
  /** The environment the distribution was found in, for the check's output. */
  environment: string;
};

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
