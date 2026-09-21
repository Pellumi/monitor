#!/usr/bin/env node
/**
 * Copy the Python SDK's changesets version into the files Python actually reads.
 *
 * Changesets owns the version number for every package in this repository,
 * including the Python one, so there is a single release flow and a single
 * changelog. It can only write `package.json`, so this script propagates that
 * number into `pyproject.toml` and `__init__.py` immediately afterwards - it is
 * chained onto `release:version`, which is what the release workflow runs.
 *
 * Versions are translated on the way across. npm and PEP 440 agree on
 * `1.2.3` and disagree on everything else, and a `1.2.3-beta.0` written
 * verbatim into `pyproject.toml` is rejected by the build backend.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages', 'python-sdk');

/**
 * Translate an npm version to its PEP 440 spelling.
 *
 * `1.2.3-beta.0` is `1.2.3b0`, `1.2.3-rc.1` is `1.2.3rc1`, and the "next" and
 * "canary" tags changesets uses for snapshot releases map to development
 * releases, which is the PEP 440 segment with the same meaning.
 */
export function toPep440(version) {
  const match = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!match) throw new Error(`Cannot translate "${version}" to a PEP 440 version`);
  const [, release, prerelease] = match;
  if (!prerelease) return release;

  const kinds = [
    [/^alpha\.?(\d*)$/i, 'a'],
    [/^a\.?(\d+)$/i, 'a'],
    [/^beta\.?(\d*)$/i, 'b'],
    [/^b\.?(\d+)$/i, 'b'],
    [/^rc\.?(\d*)$/i, 'rc'],
    [/^(?:next|canary|snapshot)\.?(\d*)$/i, '.dev'],
  ];
  for (const [pattern, suffix] of kinds) {
    const found = pattern.exec(prerelease);
    if (found) return `${release}${suffix}${found[1] || '0'}`;
  }
  // An unrecognized tag is still a prerelease; calling it a dev release keeps
  // it installable and keeps it sorting below the final release.
  return `${release}.dev0`;
}

/** Replace `version = "…"` inside the `[project]` table only. */
function writePyproject(file, version) {
  const source = fs.readFileSync(file, 'utf8');
  const project = /(^\[project\][^\[]*?)(^version\s*=\s*")([^"]*)(")/ms.exec(source);
  if (!project) throw new Error(`No [project] version found in ${file}`);
  if (project[3] === version) return false;
  const updated = source.replace(project[0], `${project[1]}${project[2]}${version}${project[4]}`);
  fs.writeFileSync(file, updated);
  return true;
}

function writeDunderVersion(file, version) {
  const source = fs.readFileSync(file, 'utf8');
  const match = /^__version__\s*=\s*"([^"]*)"/m.exec(source);
  if (!match) throw new Error(`No __version__ found in ${file}`);
  if (match[1] === version) return false;
  fs.writeFileSync(file, source.replace(match[0], `__version__ = "${version}"`));
  return true;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const version = toPep440(manifest.version);

  const changed = [
    writePyproject(path.join(packageRoot, 'pyproject.toml'), version) && 'pyproject.toml',
    writeDunderVersion(path.join(packageRoot, 'src', 'tellann', '__init__.py'), version) && 'src/tellann/__init__.py',
  ].filter(Boolean);

  if (changed.length) {
    console.log(`python-sdk: set version ${version} in ${changed.join(', ')}`);
  } else {
    console.log(`python-sdk: already at version ${version}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
