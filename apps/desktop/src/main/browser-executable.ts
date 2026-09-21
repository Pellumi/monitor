import path from 'node:path';

/** Executable staged by scripts/stage-browser.cjs for packaged QA runs. */
export function packagedBrowserExecutable(
  resourcesPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const browserRoot = path.join(resourcesPath, 'chromium', 'browser');
  if (platform === 'win32') return path.join(browserRoot, 'chrome.exe');
  if (platform === 'darwin') {
    return path.join(browserRoot, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  }
  return path.join(browserRoot, 'chrome');
}
