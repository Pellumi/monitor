const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

/**
 * Playwright installs Chromium outside node_modules. Copy the complete browser
 * directory into electron-builder's extraResources input so packaged builds do
 * not depend on a browser cache being present on the user's machine.
 */
module.exports = async function stageBrowser() {
  const executable = chromium.executablePath();
  try {
    await fs.access(executable);
  } catch {
    throw new Error(
      `Playwright Chromium is missing at ${executable}. Run \"pnpm browser:install\" before packaging.`,
    );
  }

  const desktopRoot = path.resolve(__dirname, '..');
  const browserRoot = path.join(desktopRoot, 'build', 'chromium', 'browser');
  const macAppMarker = `${path.sep}Chromium.app${path.sep}`;
  const macAppOffset = executable.indexOf(macAppMarker);
  const source = macAppOffset === -1
    ? path.dirname(executable)
    : executable.slice(0, macAppOffset + `${path.sep}Chromium.app`.length);
  const destination = macAppOffset === -1
    ? browserRoot
    : path.join(browserRoot, 'Chromium.app');
  await fs.rm(browserRoot, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
  console.log(`Staged Playwright Chromium from ${source}.`);
};
