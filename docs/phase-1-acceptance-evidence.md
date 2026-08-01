# Phase 1 stabilization and acceptance evidence

Date: 2026-07-29

## Outcome

The browser-first Free-plan journey is operational without an SDK, repository
write access, or command permission. The release is not yet eligible to be
called a signed Windows beta because the generated binaries do not have a
trusted Authenticode signature.

## Packaged Electron acceptance run

The packaged application in `apps/desktop/release/phase1/win-unpacked` was used
for the acceptance journey, rather than the API verifier:

1. Completed system-browser OTP authentication.
2. Selected the real organization, application, and Development environment.
3. Opened the `monitor` repository through the read-only folder picker.
4. Started the bundled Playwright Chromium browser.
5. Demonstrated navigation from `/auth/login` to `/auth/register`.
6. Captured console, network, screenshot, accessibility, and navigation
   evidence.
7. Ended the run in the desktop UI and synchronized approved evidence.
8. Opened the canonical report in the web companion.

Packaged acceptance run:

- Run: `77c09fc5-3171-4978-9535-b13070712ff1`
- Status: `COMPLETED`
- Approved stored artifacts: 2
- Findings: 1
- Observed sessions: 1
- Observed states: 2
- Observed transitions: 1
- SDK installed: no
- Repository write permission: no
- Command permission: no

The report rendered the screenshot and accessibility artifact byte sizes, the
browser-console finding, and the run/session/trace correlation context.

## Automated integration verification

`node scripts/verify-desktop-phase1.mjs` passed with:

- tenant-scoped workspace registration and repository snapshots;
- QA-run creation, start, completion, report generation, and artifact storage;
- artifact checksum mismatch rejection;
- two browser-derived states and one transition;
- cross-tenant run access rejection;
- production active-control rejection;
- revoked device refresh rejection;
- no SDK, repository write, or command permission.

Latest verifier run:

- Run: `166ae528-44f3-4193-bca4-e48239029c29`
- Report: `qa-report:166ae528-44f3-4193-bca4-e48239029c29`
- Stored artifact object:
  `qa-runs/e04ea095-4ec8-4d24-901c-c84edb1e23ba/3100ce9e-c589-46ca-acea-dc45e8b806a0/166ae528-44f3-4193-bca4-e48239029c29/ff9cbf5a6dc40130643d1e6fb314a165bef6754c1d117fd8dd297ff914bc4f67.png`

## Failure and policy behavior

- Production `GUIDED` run creation is rejected by the cloud API.
- Production active control is also rejected locally before browser launch.
- Trace upload is entitlement-gated; a denied trace does not prevent a Free
  user from completing the run with basic approved evidence.
- Binary uploads retry transient server errors and reject checksum mismatch.
- Closing the desktop during a run aborts local capture and marks the cloud run
  failed.
- Browser launch failures now mark the already-created cloud run failed.
- Browser page crashes and unexpected browser disconnection persist partial
  local evidence and mark the cloud run failed.
- Device revocation prevents refresh and future cloud synchronization.

## Build evidence and open release gates

Final candidate output:

- Installer:
  `apps/desktop/release/phase1-final/Tellann-0.1.0-x64.exe`
- Installer size: 246,681,524 bytes
- Block map:
  `apps/desktop/release/phase1-final/Tellann-0.1.0-x64.exe.blockmap`
- Bundled browser:
  `apps/desktop/release/phase1-final/win-unpacked/resources/chromium/chrome-win64/chrome.exe`

Open gates:

1. Windows reports both the installer and unpacked application as `NotSigned`.
   Configure the release certificate, rebuild, and require a valid trusted
   Authenticode result before beta distribution.
2. The NSIS-installed application still requires an explicit installation
   acceptance pass. The unpacked packaged application has been exercised, but
   that is not a substitute for validating install, uninstall, shortcuts, and
   updater behavior in the installed location.
3. A real HTTPS update feed and signed update metadata are not configured.
   The client safely disables updates when the URL is missing and rejects
   non-HTTPS feeds, but download, signature verification, and install-on-quit
   need the release feed and signing certificate.

Phase 1 should be marked **functionally accepted, release-gated**, not generally
available, until these three release gates are closed.
