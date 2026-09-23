/**
 * Whether the Tellann SDK a project has installed is behind what is
 * published — for the desktop app's run page, not for instrumentation
 * planning. A run still works on an old SDK, so this only ever informs; it
 * never blocks anything.
 */

import { execFileSync } from 'node:child_process';
import semver from 'semver';
import { comparePythonVersions, parsePythonVersion } from '@tellann/python-project';

export type SdkVersionStatus = {
  ecosystem: 'npm' | 'pypi';
  package: string;
  installed: string;
  latest: string | null;
  /** True only once both versions are known and the installed one is strictly behind. */
  outdated: boolean;
};

// Cached for the process: this is asked at most once per run start, and the
// newest published version does not change on that timescale.
const npmVersionCache = new Map<string, string | null>();
const pypiVersionCache = new Map<string, string | null>();

/**
 * `npm view` is used rather than a direct registry fetch so the lookup
 * honours the user's registry configuration and credentials, including a
 * private mirror — the same reasoning `resolveSdkInstallSpec` follows.
 */
export function latestNpmVersion(packageName: string): string | null {
  const cached = npmVersionCache.get(packageName);
  if (cached !== undefined) return cached;
  let resolved: string | null = null;
  try {
    const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const output = execFileSync(executable, ['view', packageName, 'version'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
    }).trim();
    // An unpublished package prints nothing and still exits zero.
    if (semver.valid(output)) resolved = output;
  } catch {
    // Offline or the registry is unreachable: the caller reports "installed,
    // unknown latest" rather than treating this as an error.
  }
  npmVersionCache.set(packageName, resolved);
  return resolved;
}

/** The public JSON API rather than `pip index versions`, which is still marked experimental and needs a working interpreter on PATH to shell out to. */
export async function latestPyPiVersion(packageName: string): Promise<string | null> {
  const cached = pypiVersionCache.get(packageName);
  if (cached !== undefined) return cached;
  let resolved: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`, { signal: controller.signal });
      if (response.ok) {
        const body = await response.json() as { info?: { version?: unknown } };
        const version = body.info?.version;
        if (typeof version === 'string' && parsePythonVersion(version)) resolved = version;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Offline or PyPI is unreachable: same fallback as the npm lookup.
  }
  pypiVersionCache.set(packageName, resolved);
  return resolved;
}

/** Pure comparison, split out from the network lookup so it can be tested without one. */
export function isNpmVersionOutdated(installed: string, latest: string | null): boolean {
  if (!latest) return false;
  const installedCoerced = semver.coerce(installed);
  return Boolean(installedCoerced && semver.lt(installedCoerced, latest));
}

/** Pure comparison, split out from the network lookup so it can be tested without one. */
export function isPyPiVersionOutdated(installed: string, latest: string | null): boolean {
  if (!latest) return false;
  const installedParsed = parsePythonVersion(installed);
  const latestParsed = parsePythonVersion(latest);
  return Boolean(installedParsed && latestParsed && comparePythonVersions(installedParsed, latestParsed) < 0);
}

export async function npmVersionStatus(packageName: string, installed: string): Promise<SdkVersionStatus> {
  const latest = latestNpmVersion(packageName);
  return { ecosystem: 'npm', package: packageName, installed, latest, outdated: isNpmVersionOutdated(installed, latest) };
}

export async function pypiVersionStatus(packageName: string, installed: string): Promise<SdkVersionStatus> {
  const latest = await latestPyPiVersion(packageName);
  return { ecosystem: 'pypi', package: packageName, installed, latest, outdated: isPyPiVersionOutdated(installed, latest) };
}
