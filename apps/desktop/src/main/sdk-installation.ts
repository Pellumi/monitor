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
