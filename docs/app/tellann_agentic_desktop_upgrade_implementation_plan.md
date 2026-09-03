# Tellann Agentic Desktop Upgrade Implementation Plan

## 1. Summary and locked decisions

Tellann will evolve into a hybrid platform:

```text
Windows desktop execution agent
  + existing Tellann cloud control plane
  + managed Chromium browser
  + documentation/repository intelligence
  + existing telemetry, graph, reconciliation, and reporting services
```

The implementation will preserve the current web dashboard as a companion for reports, collaboration, settings, billing, and administration.

Locked product decisions:

- Electron-based Windows-first desktop application.
- Browser-first MVP before automatic code modification.
- Guided human demonstrations in v1.
- Active control limited to local, development, preview, and staging environments.
- Production is observation-only.
- Raw source stays local by default; only redacted derived summaries and explicitly approved artifacts are uploaded.
- Initial documentation sources: repository documentation and local PDF, DOCX, Markdown, text, HTML, OpenAPI JSON/YAML files.
- Automatic instrumentation will eventually support multiple web ecosystems.
- Adapter order: React/Vite, Next.js, Express, Fastify, NestJS, followed by Django, Flask, and FastAPI; PHP, .NET, and Java follow later.
- Users approve a bounded instrumentation task and file scope. Tellann may iterate inside that scope but cannot expand it without renewed approval.
- Tellann modifies code only for instrumentation. It reports product defects but does not modify business behavior to fix them.
- Desktop capabilities use progressive plan entitlements:
  - All plans: desktop guided runs.
  - Local and above: documentation-derived flow inference.
  - Solo and above: automated instrumentation.
  - Team and above: shared run governance and collaboration.

The implementation plan will be preserved in `docs/agentic-desktop-implementation-plan.md` when execution begins.

## 2. Target user journey

### First-time activation

1. User installs the signed Tellann desktop application.
2. Desktop opens the system browser for Tellann authentication and completes a device-bound login.
3. User selects or creates an organization and application.
4. User opens a local project, clones a repository, or attaches a staging URL.
5. Tellann requests read-only workspace access.
6. Tellann scans project structure without executing repository scripts.
7. User selects repository documentation and optionally uploads additional product documents.
8. Tellann derives features, actors, workflows, states, transitions, failures, recovery paths, assumptions, and conflicts.
9. User reviews the inferred feature map and accepts, edits, merges, or rejects proposals.
10. User starts a guided QA run.
11. Tellann launches or attaches to the application and opens an isolated managed Chromium browser.
12. User performs workflows while Tellann captures browser, accessibility, console, network, SDK, API, session, and visual evidence.
13. Tellann builds the observed graph, reconciles it against the accepted expected-flow version, and generates the report.
14. User reviews the report in desktop or the web companion dashboard.

### Automated instrumentation journey

Available from Solo upward after the browser-first release:

1. Tellann detects the application frameworks.
2. It generates a bounded instrumentation task listing packages, files, semantic checkpoints, commands, and expected events.
3. User approves the task and file scope.
4. Tellann creates a Git/local checkpoint.
5. Framework adapters apply syntax-aware changes.
6. Tellann installs dependencies using the detected package manager.
7. It runs targeted build, type, syntax, and SDK verification checks.
8. If validation fails, Tellann repairs only inside the approved task scope or offers rollback.
9. User reviews the final diff and validation results.
10. Tellann never changes application business behavior as part of instrumentation.

## 3. Desktop application architecture

### Workspace structure

Add a new `apps/desktop` workspace containing:

- Electron main process.
- Sandboxed React renderer.
- Typed preload bridge.
- Privileged agent utility process.
- Cloud synchronization worker.
- Packaging, signing, and updater configuration.

Create reusable packages:

- `packages/desktop-contracts`: IPC, permission, run, artifact, and cloud-sync schemas.
- `packages/project-intelligence`: framework detection, repository indexing, evidence derivation, and redaction.
- `packages/instrumentation-adapters`: adapter interfaces and implementations.
- `packages/browser-observer`: Playwright lifecycle and evidence capture.
- `packages/document-intelligence`: local extraction, segmentation, and provenance generation.
- `packages/agent-policy`: path containment, command validation, task scope, and risk classification.

### Security boundaries

- Renderer receives no direct Node, filesystem, shell, Git, process, or browser-control access.
- `nodeIntegration` remains disabled.
- `contextIsolation` and renderer sandboxing remain enabled.
- Preload exposes narrow, versioned, schema-validated IPC functions.
- Main process validates IPC sender, arguments, current device session, workspace trust, and permission scope.
- Privileged operations run in a separate utility process.
- Cloud responses may propose operations but cannot directly execute local commands.
- Commands are represented as executable, argument array, working directory, timeout, environment allowlist, and risk classification.
- File operations resolve canonical paths and remain inside approved workspace roots.
- Repository content and documents are always treated as untrusted input and cannot grant permissions or override policy.

### Local persistence

Use an encrypted local database for:

- Registered workspaces.
- Local permission grants.
- Pending instrumentation tasks.
- QA-run manifests.
- Artifact upload queues.
- Redaction manifests.
- Non-secret UI state.

Store access and refresh credentials only in Windows Credential Manager through a maintained secure-storage integration.

Never store raw secrets, environment values, Git credentials, or browser passwords in the local database.

### Desktop updates

- Produce signed Windows installers.
- Sign application binaries and update packages.
- Separate stable, beta, and internal release channels.
- Verify update signatures before installation.
- Block unsupported desktop versions through a cloud-configured minimum version only after an upgrade path is available.

## 4. Authentication, devices, and permissions

### Device authentication

Extend the auth service with a desktop authorization flow using system-browser authentication and PKCE:

- Desktop creates a verifier, challenge, nonce, and local callback/deep-link state.
- Browser uses the existing OTP/password/SSO experience.
- Auth service returns a short-lived authorization code bound to the desktop challenge.
- Desktop exchanges the code for a device-bound session.
- Tokens rotate using the current refresh-session model.
- Logout revokes the device session and clears secure local credentials.

Do not send the desktop through the current cookie-only dashboard flow inside an embedded native-capable window.

### New cloud models

Add:

- `DeviceSession`: user, device public identifier, platform, app version, granted scopes, last seen, expiry, and revocation.
- `ProjectWorkspace`: application, opaque local workspace ID, repository fingerprint, detected stack, trust state, and latest scan.
- `PermissionGrant`: workspace, permission type, path/command scope, purpose, grantor, expiry, and revocation.
- `RepositorySnapshot`: revision, dirty-state hash, framework summary, route/endpoint summary, manifest hashes, scanner version, and redaction summary.

Do not persist absolute local paths in cloud records.

### Permission levels

- Browser-only: launch/attach browser and capture approved evidence.
- Read workspace: inspect approved files without execution.
- Propose instrumentation: build a patch plan without writing.
- Apply task: write only within approved task/file scope.
- Run commands: execute individually approved structured commands.
- Sensitive browser actions: require explicit confirmation for authentication, uploads, downloads, data mutation, external navigation, or destructive behavior.

Permission escalation occurs only when required. Denial leaves the lower-privilege workflow usable.

## 5. Project and documentation intelligence

### Repository scanner

The local scanner will:

- Detect Git state, worktrees, repository root, revision, branch, and dirty files.
- Detect package managers, languages, frameworks, application entry points, scripts, and launch commands.
- Index routes, UI components, API clients, backend endpoints, controllers, middleware, permissions, schemas, status enums, state machines, tests, and repository documentation.
- Ignore dependency, build, generated, binary, secret, and user-configured excluded paths.
- Read environment-example variable names but not real environment values by default.
- Produce derived evidence records rather than uploading raw files.

### Framework-neutral adapter interface

Each adapter implements:

```ts
interface InstrumentationAdapter {
  id: string;
  version: string;
  detect(snapshot: LocalProjectSnapshot): DetectionResult;
  index(input: AdapterIndexInput): Promise<AdapterEvidence>;
  propose(input: InstrumentationProposalInput): Promise<InstrumentationPlan>;
  apply(input: ApprovedInstrumentationTask): Promise<PatchResult>;
  validate(input: PatchValidationInput): Promise<ValidationResult>;
  rollback(input: RollbackInput): Promise<RollbackResult>;
}
```

Adapters must return confidence, supported version range, evidence, changed-file scope, validation commands, and rollback information.

### Adapter delivery order

1. React with Vite.
2. Next.js App Router and supported Pages Router projects.
3. Express.
4. Fastify.
5. NestJS.
6. Django.
7. Flask.
8. FastAPI.
9. Laravel and conventional PHP.
10. ASP.NET Core.
11. Spring Boot.

Unsupported stacks remain usable in browser-only and documentation-inference modes.

### Document ingestion

Local extraction supports:

- PDF.
- DOCX.
- Markdown.
- Plain text.
- HTML.
- OpenAPI JSON/YAML.

Processing flow:

```text
Validate type and size
  -> malware/unsafe-file screening
  -> extract text and structure locally
  -> detect secrets and personal data
  -> segment requirements and features
  -> derive redacted evidence
  -> upload approved document or derived summary
  -> generate a reviewable flow draft
```

The default sends derived summaries and evidence excerpts. Full files require separate user approval and an upload manifest.

### Flow proposal model

Extend AI flow drafts to support:

- Sources: product description, document, repository scan, hybrid analysis, and user correction.
- Multiple document/repository evidence references.
- Actors and roles.
- Preconditions.
- States and transitions.
- failure, validation, authorization, empty, loading, cancellation, and recovery paths.
- assumptions.
- unresolved questions.
- cross-source conflicts.
- confidence by workflow, state, transition, and evidence.
- parser, scanner, adapter, ruleset, prompt, provider, and model versions.

AI output remains a draft. Graph validation and user acceptance are required before it becomes a declared graph.

### Review experience

Replace manual node-by-node declaration as the default with:

- Feature-grouped workflow cards.
- Document and code evidence citations.
- Conflict cards.
- Bulk acceptance of features or selected branches.
- Natural-language correction.
- Rename, merge, split, reject, and defer actions.
- Advanced graph editor for detailed changes.

Accepted proposals create immutable declared graph versions. Subsequent document or repository changes generate diffs against the accepted version instead of replacing it.

## 6. Instrumentation and SDK evolution

### SDK changes

Extend frontend and backend SDK configuration with:

- `runId`.
- stable cross-layer `sessionId`.
- `traceId`.
- `agentVersion`.
- installation/instrumentation manifest version.
- optional local relay endpoint.

SDKs must accept correlation context from the desktop-launched browser and propagate it through supported backend integrations.

Add event support for:

- QA run lifecycle.
- installation verification.
- browser evidence references.
- expected-flow version selection.
- semantic checkpoints proposed by adapters.

Retain backward compatibility for existing SDK users and ingestion keys.

### Local relay

Add a local Tellann relay owned by the desktop agent:

- Receives SDK telemetry during local runs.
- Adds run and correlation metadata.
- Redacts against local privacy policy.
- Buffers when cloud connectivity is unavailable.
- Forwards to the existing event collector using a scoped run credential.
- Never exposes dashboard or management credentials to the tested application.

The tested application receives a short-lived run-scoped ingestion credential rather than the desktop refresh token.

### Instrumentation planning

Every plan contains:

- Framework and version evidence.
- SDK packages to install.
- Files and symbols to modify.
- Proposed semantic checkpoints.
- Expected event/state mappings.
- Commands required.
- Network requirements.
- Risk rating.
- validation commands.
- rollback method.

Checkpoint insertion targets business boundaries rather than every interaction:

- authentication and authorization outcomes.
- business workflow start/success/failure/cancellation.
- validation results.
- external dependency outcomes.
- important persisted transitions.
- asynchronous/background completion.

### Safe application

- Require task-level approval and declared file scope.
- Create a `tellann/instrument-<timestamp>` branch when Git is available unless the user selects the current branch.
- Preserve unrelated dirty changes.
- Reject stale plans when the base revision or target file hash changes.
- Prefer framework configuration, AST transforms, and codemods.
- Avoid whole-file replacement when a bounded transform is possible.
- Run idempotency checks so repeated instrumentation does not duplicate providers, middleware, imports, or events.
- Roll back only Tellann-authored operations.

### Multi-language protocol strategy

JavaScript/TypeScript adapters use the existing packages.

Python, PHP, .NET, and Java adapters use language-native SDKs that implement the same event protocol and privacy contract. Do not shell out to the Node SDK from production application processes.

Each new SDK requires:

- Typed configuration.
- batch and single-event ingestion.
- run/session/trace correlation.
- framework middleware.
- error and API capture.
- state, transition, and workflow APIs.
- installation verification.
- buffering/retry.
- secret sanitization.
- contract tests against the event collector.

## 7. Managed browser and QA runs

### QA Run model

Add a first-class `QARun` containing:

- Organization, application, and environment.
- Desktop device and workspace.
- Repository snapshot.
- Accepted expected graph version.
- Instrumentation manifest.
- run mode and status.
- browser context metadata.
- start/end time.
- observed sessions and graph.
- artifact manifest.
- reconciliation and report references.
- failure reason and retry lineage.

Add supporting models:

- `QARunArtifact`.
- `BrowserFinding`.
- `IntentEvidence`.
- `PatchSet`.
- `InstrumentationPlan`.
- `SourceDocument`.
- `SourceDocumentVersion`.

### Environment enforcement

Desktop active control is allowed only for `DEVELOPMENT` and `STAGING` environments.

For `PRODUCTION`:

- Disable process launch, automated interaction, form submission, and instrumentation application.
- Allow explicitly approved observation-only browser attachment.
- Mark all production evidence visibly.
- Enforce restrictions locally and in cloud authorization.

### Managed browser

Use a dedicated Playwright Chromium profile per run:

- No access to the user's personal browser profile.
- Configurable viewport, locale, timezone, color scheme, and permissions.
- Capture navigation, screenshots, DOM snapshots, accessibility snapshots, console messages, uncaught errors, requests, failures, status codes, and timing.
- Enable trace capture according to plan entitlement and retention policy.
- Close and clean the browser context at run completion.
- Persist only approved artifacts.

### Guided execution

The user performs the workflow while desktop displays:

- Selected expected flow.
- Current expected state.
- observed matching state.
- remaining expected branches.
- runtime errors.
- privacy capture indicator.
- pause/resume/end controls.

Tellann does not autonomously click through workflows in v1.

### Evidence correlation

Every artifact and event carries:

- `runId`.
- `sessionId`.
- `traceId`.
- application and environment.
- expected graph version.
- source.
- timestamp.
- privacy classification.

Browser requests include a Tellann run correlation header only for configured application origins. SDK and server adapters propagate it where supported.

### Finding generation

Generate evidence-backed findings for:

- render failures.
- broken navigation.
- console/runtime errors.
- failed or slow network requests.
- invisible, clipped, overlapping, or non-actionable elements.
- responsive overflow.
- missing accessible names or labels.
- keyboard and focus problems.
- missing loading/error/empty feedback.
- expected outcomes not visibly confirmed.
- semantic events inconsistent with rendered outcomes.
- expected states or transitions not reached.
- undeclared observed behavior.

Each finding includes severity, confidence, URL, viewport, reproduction sequence, related workflow/state, evidence references, and recommended developer action. Tellann does not apply the recommended product fix.

## 8. Cloud service and API changes

### Auth API

Add:

- Desktop authorization initialization and exchange.
- Device-session refresh and revocation.
- Device listing.
- Desktop logout.
- Minimum supported desktop version response.

### Onboarding API

Add:

- Workspace registration.
- repository snapshot upload.
- permission metadata.
- source-document metadata and upload intents.
- desktop onboarding progress.
- environment action-policy response.
- short-lived run credential issuance.

### Project Intelligence service

Create a dedicated asynchronous service for:

- document processing jobs.
- repository-summary processing.
- cross-source feature clustering.
- conflict detection.
- hybrid flow generation.
- provenance assembly.
- affected-flow diff generation.

Use the existing AI package, rulesets, graph validation, AI invocation logs, and background-job conventions. Do not place long-running parsing/inference inside synchronous onboarding routes.

### FDRS API

Extend with:

- Hybrid flow-draft creation.
- draft evidence and conflict retrieval.
- bulk review mutations.
- natural-language correction.
- partial acceptance.
- accepted-draft-to-declared-graph conversion.
- expected graph version diff.
- run-bound reconciliation.

Continue using the declared-flow route family as canonical graph truth.

### Event collector and graph/session engines

Add:

- Run-scoped credential validation.
- run/session/trace metadata.
- idempotent offline replay.
- browser and semantic artifact references.
- correlation-aware session aggregation.
- observed graph construction limited to selected application/environment/run.

### Report engine

Add report sections for:

- expected intent and evidence provenance.
- repository/document analysis summary.
- accepted assumptions and unresolved conflicts.
- instrumentation manifest and validation.
- browser/runtime evidence.
- accessibility and visual findings.
- expected-versus-observed coverage.
- session/trace reproduction.
- endpoint intelligence.
- comparison with previous runs.

Desktop and web must render the same canonical report contract.

### Storage and retention

Extend storage categories for:

- source documents.
- extracted document artifacts.
- repository summaries.
- patch sets.
- screenshots.
- browser traces.
- accessibility snapshots.
- run manifests.

Storage ledger, entitlement checks, and retention workers must cover all categories.

## 9. Public interfaces and schema additions

### Core API routes

Add versioned routes equivalent to:

```text
POST   /v1/desktop/authorize
POST   /v1/desktop/token
POST   /v1/desktop/refresh
GET    /v1/desktop/devices
DELETE /v1/desktop/devices/:deviceId

POST   /v1/applications/:appId/workspaces
POST   /v1/applications/:appId/repository-snapshots
POST   /v1/applications/:appId/source-documents/upload-intent
POST   /v1/applications/:appId/source-documents/:documentId/process

POST   /v1/applications/:appId/intent-drafts
GET    /v1/applications/:appId/intent-drafts/:draftId
POST   /v1/applications/:appId/intent-drafts/:draftId/review
POST   /v1/applications/:appId/intent-drafts/:draftId/correct

POST   /v1/applications/:appId/qa-runs
POST   /v1/qa-runs/:runId/credentials
POST   /v1/qa-runs/:runId/artifacts
POST   /v1/qa-runs/:runId/complete
POST   /v1/qa-runs/:runId/fail
GET    /v1/qa-runs/:runId
GET    /v1/applications/:appId/qa-runs
```

Exact handlers remain behind the API gateway and enforce user membership, application ownership, environment policy, device status, and plan entitlement.

### Shared types

Define versioned contracts for:

- `DesktopDevice`.
- `DesktopPermission`.
- `ProjectWorkspace`.
- `RepositorySnapshotSummary`.
- `SourceDocumentManifest`.
- `IntentDraft`.
- `IntentConflict`.
- `IntentEvidence`.
- `InstrumentationTask`.
- `PatchOperation`.
- `QARun`.
- `QARunArtifact`.
- `BrowserFinding`.
- `RunCorrelationContext`.
- `DesktopEntitlements`.

Use runtime schema validation for desktop IPC and HTTP boundaries.

### Entitlements

Add feature flags:

- `DESKTOP_GUIDED_RUNS`.
- `DOCUMENT_FLOW_INFERENCE`.
- `AUTOMATED_INSTRUMENTATION`.
- `SHARED_RUN_GOVERNANCE`.
- `BROWSER_TRACE_CAPTURE`.
- `VISUAL_ACCESSIBILITY_ANALYSIS`.

Default mapping:

- Free: guided runs with existing storage/session limits and basic evidence.
- Local: guided runs plus document inference.
- Solo: document inference, automated instrumentation, richer evidence, and existing advanced reporting.
- Team: shared runs, assignments/review, RBAC integration, and collaboration.
- Business/Enterprise: audit, policy enforcement, longer retention, device governance, and priority processing.

Apply enforcement in desktop UI, gateway, owning service, artifact upload, worker processing, and report generation.

## 10. Web companion modifications

- Replace the existing manual-first onboarding with a choice between **Open in Tellann Desktop** and legacy/manual integration.
- Add desktop download and deep-link launch actions.
- Display connected devices and revoke controls in Security & Sessions.
- Add QA Run history, run status, artifacts, findings, and comparison views.
- Preserve organization/application selection, settings, billing, members, audit, reports, and administration.
- Keep the manual flow editor and ingestion-key pages as advanced/legacy paths.
- Clearly distinguish documentation-inferred, repository-inferred, user-authored, and observed graph provenance.

## 11. Delivery phases

### Phase 0 — Foundations and threat model

Deliver:

- Architecture decision records.
- Desktop threat model.
- IPC and permission contracts.
- Electron shell proof of concept.
- system-browser authentication.
- secure token storage.
- open-folder/read-only scan.
- managed Chromium proof.
- desktop build/signing pipeline skeleton.

Acceptance:

- Renderer cannot access privileged APIs directly.
- A revoked device cannot refresh.
- All file access is contained to the approved root.
- A browser run can be associated with an existing application without source mutation.

### Phase 1 — Windows browser-first MVP

Deliver:

- Signed Windows beta.
- local folder and staging URL modes.
- application/environment selection.
- read-only repository summary.
- guided QA runs.
- isolated browser.
- console/network/screenshot/accessibility evidence.
- QA Run persistence.
- reconciliation and report extension.
- web companion run history.
- desktop entitlement enforcement.

Acceptance:

- A QA user can reach a first report without installing an SDK.
- No repository command or write permission is required.
- Production active control is blocked.
- Raw source is not uploaded.
- Run artifacts are correlated and retained according to plan.

### Phase 2 — Documentation-derived expected flows

Deliver:

- Local extraction for supported document types.
- source-document storage manifests.
- hybrid intent drafts.
- provenance and conflicts.
- feature-level review.
- declared graph version generation.
- incremental document/repository diffs.

Acceptance:

- Accepted states and transitions retain evidence citations.
- Conflicting sources are never silently merged.
- AI output cannot mutate graph truth without user review.
- Local and higher plans enforce document-inference access.

### Phase 3 — JavaScript/TypeScript instrumentation

Deliver:

- React/Vite, Next.js, Express, Fastify, and NestJS adapters.
- task-scoped approval.
- AST/codemod patches.
- package-manager support.
- Git/local checkpoint and rollback.
- SDK correlation updates.
- local relay.
- automatic installation verification.

Acceptance:

- Repeated instrumentation is idempotent.
- Dirty worktree changes are preserved.
- Stale plans are rejected.
- Rollback removes only Tellann changes.
- Build and SDK verification results are visible before task completion.

### Phase 4 — Python instrumentation

Deliver:

- Python SDK.
- Django, Flask, and FastAPI adapters.
- pip, Poetry, and uv project detection.
- middleware and semantic-checkpoint insertion.
- protocol contract parity.

Acceptance:

- Python and Node events reconcile under the same graph contract.
- Adapter failures fall back to a non-mutating proposal.
- Unsupported project versions remain browser/document capable.

### Phase 5 — Broader web ecosystems

Deliver in order:

- Laravel/PHP.
- ASP.NET Core.
- Spring Boot.

Each ecosystem must pass its own framework-version, package-manager, patch-idempotency, rollback, security, and protocol-contract gates before general availability.

### Phase 6 — Enterprise hardening

Deliver:

- Device policies and organization revocation.
- proxy and enterprise certificate handling.
- audit-grade command/permission history.
- resumable uploads.
- storage and retention governance.
- offline queue.
- updater hardening.
- penetration and supply-chain assessment.
- Windows stable release.
- macOS planning only after Windows stability criteria are met.

## 12. Testing strategy

### Desktop security

- IPC sender and payload validation.
- renderer sandbox escape regression.
- path traversal, symlink, and junction containment.
- command argument injection.
- cloud-instruction rejection.
- prompt injection from documentation/source.
- token storage and device revocation.
- update signature validation.
- secret scanning and redaction.

### Repository scanning

Test:

- clean and dirty Git repositories.
- nested workspaces and monorepos.
- missing Git.
- locked files.
- unsupported languages.
- generated and dependency exclusions.
- malicious package scripts.
- secret files.
- large repositories.
- interrupted scans.

### Document intelligence

Test:

- valid and malformed PDF, DOCX, Markdown, HTML, text, and OpenAPI.
- conflicting requirements.
- duplicate documents.
- updated versions.
- secret/PII redaction.
- prompt injection.
- unsupported/encrypted files.
- provenance preservation.
- partial acceptance and correction.

### Browser runs

Test:

- single-page and multi-page applications.
- redirects, popups, downloads, and uploads.
- authentication and MFA pauses.
- console errors.
- failed requests.
- slow endpoints.
- responsive viewports.
- accessibility failures.
- screenshot redaction.
- interrupted and resumed runs.
- browser crash.
- local server termination.
- production control blocking.

### Instrumentation

For every adapter:

- supported-version detection.
- unsupported-version fallback.
- dependency insertion.
- provider/middleware insertion.
- checkpoint insertion.
- formatting preservation.
- idempotent rerun.
- stale-base rejection.
- dirty-worktree preservation.
- task-scope enforcement.
- build/type/syntax validation.
- SDK installation verification.
- rollback.

### Cloud and tenancy

- Cross-organization access denial.
- foreign application/environment rejection.
- revoked-device denial.
- expired run credential denial.
- artifact ownership.
- entitlement enforcement at every layer.
- storage quota.
- retention deletion.
- audit completeness.
- idempotent run completion and artifact upload.

### End-to-end acceptance scenarios

1. Free user opens a React project, performs a guided run without SDK installation, and receives a basic report.
2. Local user uploads a PRD, reviews inferred flows with citations, demonstrates one workflow, and receives reconciliation.
3. Solo user approves a React instrumentation task, validates it, runs the application, and receives correlated frontend/backend evidence.
4. Team members share a run and review findings without cross-organization leakage.
5. User revokes a desktop device and the application loses cloud access.
6. Production environment rejects active browser control and code instrumentation.
7. Offline run buffers evidence and synchronizes idempotently after reconnect.
8. Instrumentation failure rolls back Tellann changes while preserving user edits.

## 13. Rollout, monitoring, and migration

- Keep existing web onboarding and SDK setup working throughout migration.
- Introduce desktop features behind organization and plan feature flags.
- Release to internal users, then selected beta organizations, then Windows general availability.
- Do not migrate existing declared graphs automatically; mark their provenance and allow desktop-generated proposals to diff against them.
- Existing ingestion keys and SDK integrations remain compatible.
- Add API and IPC version negotiation before stable release.
- Monitor activation time, first-report completion, scan failures, document-processing failures, patch success, rollback success, browser crashes, rejected permissions, artifact upload failures, AI draft acceptance, false-positive dismissal, and cross-run coverage improvement.
- Define rollback switches for desktop authentication, document inference, individual adapters, local relay, browser artifact categories, and cloud processing jobs.
- Require an independent security review before automated instrumentation beta and a penetration test before stable distribution.

## 14. Assumptions

- The existing cloud services remain authoritative for users, organizations, applications, entitlements, graphs, reconciliation, reports, audit, and billing.
- Electron is the selected desktop framework for Windows v1.
- The desktop renderer is packaged locally and does not wrap the remote dashboard with native privileges.
- Playwright Chromium is the managed browser for v1.
- Raw source remains local unless the user separately approves file upload.
- The first public release is guided and browser-first; autonomous exploration is outside the current plan.
- Product-code remediation is outside scope. Only instrumentation code may be modified.
- Existing manual onboarding remains available as a fallback until desktop adoption and compatibility are proven.
- macOS and Linux are outside the first-release commitment.
