import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { config } from 'dotenv';

let loaded = false;

/**
 * Walk up from `startDir` until a directory containing `package.json` is found.
 * In development this resolves to `apps/desktop` regardless of how Electron was
 * launched or what `app.getAppPath()` / `process.cwd()` happen to be.
 */
function findPackageRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function loadDesktopEnvironment(): void {
  if (loaded) return;
  loaded = true;

  const explicitPath = process.env.TELLANN_DESKTOP_ENV_PATH;
  const appPath = app.getAppPath();
  const executableDirectory = path.dirname(process.execPath);
  // `app.getAppPath()` is unreliable in `electron dist/main/main/main.js` dev
  // launches, so also anchor on the compiled file's own location and the cwd.
  const packageRoot = findPackageRoot(__dirname);
  // In a packaged build .env is not inside the asar (see package.json build.files),
  // so also look next to the installed executable and under resources/, where
  // electron-builder extraResources ships the committed .env.production defaults.
  const resourcesDirectory = process.resourcesPath;

  const searchDirs = [
    packageRoot,
    process.cwd(),
    appPath,
    executableDirectory,
    resourcesDirectory,
  ].filter((value): value is string => Boolean(value));

  const candidates = [
    explicitPath,
    // `.env.local` and `.env` first so a developer's local overrides win over
    // the committed `.env.production` defaults.
    ...searchDirs.flatMap((dir) => [
      path.join(dir, '.env.local'),
      path.join(dir, '.env'),
    ]),
    ...searchDirs.map((dir) => path.join(dir, '.env.production')),
  ].filter((value): value is string => Boolean(value));

  const loadedFiles: string[] = [];
  for (const envPath of [...new Set(candidates)]) {
    const result = config({ path: envPath, override: false, quiet: true });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      loadedFiles.push(envPath);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[env] ${loadedFiles.length ? `loaded ${loadedFiles.join(', ')}` : 'no .env file found'} — API ${process.env.TELLANN_API_URL ?? '(default 127.0.0.1:3000)'}`,
  );
}
