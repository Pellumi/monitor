# Tellann Phase 1-3 Launch Readiness Report

**Assessment date:** 11 August 2026  
**Scope:** Windows desktop, cloud control plane, web companion, billing, settings, Phase 1 guided runs, Phase 2 document intelligence, and Phase 3 JavaScript/TypeScript instrumentation.  
**Overall status:** Phase 1 and Phase 2 acceptance complete. Phase 3 implementation and service-level acceptance complete. Windows signing remains an approved release exclusion. A final clean-host replay of the packaged managed-browser-to-report leg remains a release-candidate verification gate because the development host became resource-constrained during the final replay.

## 1. Executive conclusion

Tellann has moved beyond the browser-first and document-inference milestones and now contains the Phase 3 JavaScript/TypeScript instrumentation system described in the programme plan. The working product supports:

- device-bound desktop authentication and revocation;
- tenant-scoped organization, application, and environment selection;
- read-only local workspace scanning;
- guided browser QA without SDK installation or repository write/command permission;
- uploaded browser evidence, browser-derived states and transitions, reconciliation, and canonical reports;
- local PDF, DOCX, Markdown, text, HTML, and OpenAPI extraction;
- evidence-backed intent drafts with conflicts, assumptions, confidence, citations, and explicit acceptance;
- immutable document-derived declared graph versions;
- React/Vite, Next.js, Express, Fastify, and NestJS instrumentation adapters;
- bounded task approval, Git/local checkpoints, stale-plan protection, validation, idempotency, and rollback;
- SDK/run/session/trace correlation, local relay buffering, replay, and report provenance;
- web companion run, finding, artifact, report, device, billing, profile, organization, and team surfaces.

The programme is therefore at **Phase 3 stabilization and release-candidate closure**, not Phase 2 development. Phase 4 Python instrumentation should start only after the remaining Windows distribution gates below are closed.

## 2. Acceptance evidence

### Phase 1 — Windows browser-first MVP

Verified through `scripts/verify-desktop-phase1.mjs`, integration tests, rendered dashboard checks, and packaged desktop exercises:

- a Free user can authenticate, select an application/environment, scan a project read-only, run a managed browser workflow, upload artifact content, derive observed states/transitions, reconcile, and receive a report without installing an SDK;
- development/staging active control works while production active control is rejected;
- artifact contents, checksums, ownership, retention metadata, and failure handling are enforced;
- device refresh rotates credentials and revoked devices lose cloud access;
- browser crashes, interruption, upload failure, entitlement, and tenant-isolation paths have automated coverage;
- desktop secure storage uses Electron `safeStorage`, backed by Windows DPAPI in the installed Windows application.

### Phase 2 — Documentation-derived expected flows

Verified through `scripts/verify-desktop-phase2.mjs` and package tests:

- PDF, DOCX, Markdown, text, HTML, OpenAPI JSON/YAML, malformed-file, prompt-injection, secret, and PII paths are covered;
- document manifests and immutable source versions are tenant scoped;
- processing is asynchronous and stores redacted evidence/provenance rather than silently uploading raw source;
- intent drafts expose features, actors, states, transitions, failure/recovery paths, assumptions, conflicts, confidence, and citations;
- acceptance is explicit and creates an immutable declared graph version;
- AI drafts cannot alter canonical graph truth before acceptance;
- accepted document intent reconciles against browser-observed runs and appears in the canonical report.

### Phase 3 — JavaScript/TypeScript instrumentation

Verified through `scripts/verify-desktop-phase3.mjs`, adapter tests, policy tests, relay tests, and the packaged Electron exercise:

- React/Vite, Next.js App Router, Next.js Pages Router, Express, Fastify, and NestJS detection boundaries are implemented;
- TypeScript, JavaScript, JSX, ESM, CommonJS, and nested monorepo application layouts are supported;
- plans list packages, target files/symbols, semantic checkpoints, commands, risk, validation, and rollback;
- approval is bounded to declared files and commands;
- stale plans are rejected, repeated application is idempotent, unrelated dirty work is preserved, and rollback removes only Tellann-authored changes;
- preinstalled SDKs do not incorrectly require a registry installation command;
- run creation carries the selected validated `PatchSet`, and reports retain instrumentation provenance;
- local relay persistence/recovery is serialized so startup replay and manual flush cannot duplicate uploads;
- adapter events correlate through `runId`, `sessionId`, and `traceId` under the existing graph/report contract.

The freshly packaged executable completed real PKCE browser authorization, created a device-bound session, loaded Solo instrumentation entitlement, registered/scanned a read-only workspace, detected React/Vite, proposed and approved a bounded task, applied/validated instrumentation, preserved dirty work, created a QA run, issued a run credential, and began managed-browser evidence ingestion. The final browser-stop, report-read, and rollback portion must be replayed on a clean Windows host because the current host stopped scheduling the packaged Chromium and even basic process/health queries within their normal timeouts.

## 3. Cross-product verification

### Billing and plan enforcement

The billing lifecycle verifier covers the Paystack TEST API contract, signed webhook verification, replay/idempotency, invoice and receipt creation, immediate upgrades, renewal-effective downgrades, cancellation/resumption, dunning, catalog integrity, and the explicit Stripe initial-checkout fallback policy. The six-plan catalog and desktop feature mapping are enforced in the UI, gateway, owning services, artifact processing, and report paths.

A real monetary Paystack charge was intentionally not performed. Live credentials, live webhook delivery, and a production-value transaction remain external deployment checks.

### Settings, security, and tenancy

Automated acceptance covers profile updates, organization settings, contacts, member invitation and roles, ownership protections, usage, audit records, exact plan visibility, foreign identifier rejection, cross-organization denial, revoked devices, expired run credentials, artifact ownership, and plan enforcement.

### Web companion

Rendered browser checks covered authenticated QA-run history and empty state, profile, organization, members, billing, and Security & Sessions/device-revocation views. The checked pages rendered without console errors and showed Free-plan gating where expected.

## 4. Important gaps repaired during stabilization

- Removed the desktop instrumentation dead-end that required an `install-sdk` approval even when the SDK was already present.
- Added real plan entitlement resolution to desktop application selection and disabled instrumentation controls for ineligible plans while preserving browser-only QA.
- Added JavaScript/JSX and CommonJS-safe code generation instead of emitting TypeScript-only files.
- Scoped monorepo plans to the detected nested application while finding the correct root lockfile.
- Carried the selected validated patch set into the QA run and canonical report.
- Serialized local-relay flushes to prevent duplicate replay.
- Replaced the legacy PDF parser with a current parser capable of extracting modern cross-reference PDFs.
- Cleared revoked secure desktop sessions so the renderer returns to authentication immediately.
- Added updater policy tests and fail-closed handling for missing, insecure, invalid, or development update feeds.
- Hardened executable, argument, working-directory, environment, junction/symlink, path-containment, and production action policy validation.

## 5. Windows package evidence and remaining distribution gates

The repository produces:

- `apps/desktop/release/phase1/Tellann-0.1.0-x64.exe`;
- `apps/desktop/release/phase1/Tellann-0.1.0-x64.exe.blockmap`;
- `apps/desktop/release/phase1/win-unpacked/Tellann.exe`.

The package is built from the current desktop bundle and includes the managed Playwright Chromium. The following are still release/distribution gates:

1. **Authenticode signing** — intentionally excluded from this delivery. A trusted publisher certificate is not configured.
2. **Published HTTPS update feed** — updater policy is implemented and tested, but no production feed exists yet, so a real installed old-to-new update cannot be proven.
3. **Final clean-host packaged replay** — repeat packaged authentication through report and rollback on a Windows host without the current resource contention.
4. **Application icon** — electron-builder still falls back to the default Electron icon; this is release polish, not a functional blocker.
5. **Independent security review and penetration test** — organizational gates required by the adopted plan before automated-instrumentation beta/stable distribution.
6. **Live Paystack deployment check** — publish production catalog configuration and verify one controlled real transaction/webhook cycle.
7. **Environment-secret hygiene** — the local `.env` contains a service-account JSON value whose quoting/newlines are not Compose-compatible. Docker Compose printed the malformed value while rejecting the file. Rotate that service-account key, replace the local secret, and store it as a file/secret-manager reference instead of inline JSON before deployment.

## 6. Test inventory

The final acceptance inventory includes:

- Phase 1, Phase 2, and Phase 3 desktop verifier scripts;
- 31 passing integration/isolation E2E tests with 9 intentionally skipped environment-dependent cases;
- 12 instrumentation-adapter tests;
- 6 desktop agent-policy tests;
- 6 desktop main/updater/application-launch tests;
- 4 document-intelligence tests using real PDF and DOCX containers;
- 4 local-relay tests including persisted offline replay and duplicate-flush prevention;
- billing, settings/entitlement, and four legacy golden-flow verifiers;
- desktop, gateway, collector, onboarding, FDRS, report, worker, and dashboard build/type checks performed during the implementation cycle.

## 7. Programme decision and next step

Do not begin Phase 4 as an uncontrolled expansion. The immediate next step is a short **Phase 3 release-candidate closure**:

```text
clean Windows host
  -> final packaged browser/report/rollback replay
  -> trusted signing and branded installer assets
  -> publish HTTPS beta update feed and prove installed update
  -> independent security review
  -> selected-organization beta
```

After those gates pass, begin **Phase 4 — Python instrumentation** in this order:

1. language-native Python SDK and collector contract tests;
2. pip, Poetry, and uv detection;
3. Django adapter;
4. Flask adapter;
5. FastAPI adapter;
6. middleware/checkpoint insertion, validation, idempotency, stale-plan, rollback, and unsupported-version fallback;
7. Node/Python cross-layer reconciliation under the same run/session/trace contract.
