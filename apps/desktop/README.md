# Tellann Desktop

## Build for Linux

Build on a Linux machine so Electron and Playwright stage Linux binaries. From
the repository root, install the workspace dependencies and then package the
application:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tellann/desktop package:linux
```

The command downloads the matching Playwright Chromium build, compiles the
desktop app, and creates both AppImage and Debian artifacts under
`apps/desktop/release/phase1/`.

To create only one format, use `package:linux:appimage` or
`package:linux:deb`. AppImage is the most portable option for local testing;
the Debian package integrates with Debian and Ubuntu package management.

On a clean Linux build host, Chromium may also need distribution libraries.
Install those once before packaging:

```bash
pnpm --filter @tellann/desktop exec playwright install-deps chromium
```

That command may request elevated privileges through the operating system's
package manager. The packaged app includes its own Playwright Chromium binary,
so end users do not need to run `playwright install`.

Linux packages should be produced on Linux. The same applies to Windows: run
`package:win` on Windows so the staged Chromium binary matches the target OS.
