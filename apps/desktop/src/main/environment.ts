import path from 'node:path';
import { app } from 'electron';
import { config } from 'dotenv';

let loaded = false;

export function loadDesktopEnvironment(): void {
  if (loaded) return;
  loaded = true;

  const explicitPath = process.env.TELLANN_DESKTOP_ENV_PATH;
  const appPath = app.getAppPath();
  const executableDirectory = path.dirname(process.execPath);
  const candidates = [
    explicitPath,
    path.join(appPath, '.env.local'),
    path.join(appPath, '.env'),
    path.join(executableDirectory, '.env.local'),
    path.join(executableDirectory, '.env'),
  ].filter((value): value is string => Boolean(value));

  for (const envPath of [...new Set(candidates)]) {
    config({ path: envPath, override: false, quiet: true });
  }
}
