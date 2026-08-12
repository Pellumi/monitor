# Tellann Phase 3 JavaScript/TypeScript Instrumentation Implementation Plan

Status: approved for implementation

Programme scope: Phase 3 of `tellann_agentic_desktop_upgrade_implementation_plan.md`

Excluded from this phase: product defect remediation, autonomous browser exploration, Python/PHP/.NET/Java instrumentation, production mutation, and Windows application signing.

## 1. Outcome

Phase 3 converts the existing instrumentation placeholder into a safe, reviewable agent workflow for React/Vite, Next.js, Express, Fastify, and NestJS applications.

The completed user journey is:

```text
Open a trusted local project
  -> Tellann detects supported frameworks and versions
  -> Tellann indexes candidate integration points without executing repository code
  -> Tellann proposes a bounded instrumentation task
  -> user reviews packages, files, symbols, checkpoints, commands, risks, and rollback
  -> user approves the exact task and file/command scope
  -> Tellann creates a Git or local checkpoint
  -> Tellann applies syntax-aware, idempotent changes
  -> Tellann installs dependencies with the detected package manager
  -> Tellann runs approved validation commands
  -> user reviews the final diff and validation results
  -> Tellann launches a correlated QA run through the local relay
  -> browser and SDK evidence reconcile under one run/session/trace context
  -> user can roll back only Tellann-authored changes
```

Solo and higher plans receive automated instrumentation. Lower plans retain browser-only runs and manual SDK integration.

## 2. Current-state gap assessment

Reusable foundations already exist:

- `packages/agent-policy`: path containment, structured command validation, and production mutation denial.
- `packages/project-intelligence`: bounded read-only scans and framework/package-manager detection.
- `packages/instrumentation-adapters`: a preliminary adapter interface and delivery order.
- Prisma `InstrumentationPlan`, `PatchSet`, `PermissionGrant`, `ProjectWorkspace`, and `RepositorySnapshot` models.
- Frontend and backend TypeScript SDKs with single/batch event ingestion.
- Express and Fastify backend middleware.
- run-scoped credentials and correlation enrichment in the event collector.
- Electron renderer isolation, typed preload IPC, secure credential storage, workspace selection, and managed browser runs.

Missing or insufficient foundations:

- No adapter implementation or adapter registry.
- The adapter contract lacks local workspace input, evidence, supported versions, symbol operations, checkpoint manifests, command policy, and rollback verification.
- No tenant-scoped instrumentation plan or patch lifecycle APIs.
- No desktop plan, approval, diff, apply, validation, history, or rollback flow.
- No task-scoped local permission engine.
- No syntax-aware transforms or idempotency markers.
- No Git/local checkpoint engine that preserves unrelated dirty changes.
- SDKs do not carry `runId`, stable cross-layer `sessionId`, `traceId`, agent version, or instrumentation-manifest version.
- No desktop-owned local telemetry relay.
- No installation verification bound to an instrumentation manifest and QA run.
- Existing Prisma status fields are untyped strings and do not capture approvals, stale state, rollback failures, commands, or manifest versions strongly enough.

## 3. Non-negotiable invariants

1. Instrumentation applies only in development or staging workspaces. Production is observation-only locally and in cloud authorization.
2. Tellann modifies instrumentation only. It never changes business logic to repair product defects.
3. Repository files are untrusted input and cannot expand permissions, commands, paths, or policy.
4. Cloud responses may describe tasks but cannot directly execute local actions.
5. The renderer never receives direct filesystem, Git, process, shell, token, or browser-control access.
6. A task may write only canonical paths covered by its approved file scope.
7. A task may execute only structured commands explicitly approved for that task.
8. Stale base revisions, manifest hashes, or target-file hashes invalidate a task before the first write.
9. Pre-existing dirty changes are preserved through apply and rollback.
10. Every transform is idempotent. Reapplying the same manifest creates no duplicate imports, providers, middleware, initialization, or events.
11. Rollback removes only operations recorded in the Tellann patch manifest.
12. Secrets, environment values, Git credentials, browser credentials, and raw source never enter cloud plan records.
13. Validation output is locally sanitized and bounded before synchronization.
14. `AUTOMATED_INSTRUMENTATION` is enforced in desktop, gateway, service, permission mutation, worker processing, and report generation.
15. Task denial or adapter failure leaves browser-only and manual SDK workflows usable.

## 4. Contract and schema design

### 4.1 Adapter contract

Replace the preliminary adapter types with versioned runtime schemas and these concepts:

- `AdapterDescriptor`: ID, version, ecosystem, supported framework/version ranges, supported package managers, capabilities.
- `LocalProjectContext`: canonical workspace root, snapshot, file inventory, package manifests, Git state, environment type.
- `DetectionResult`: support state, confidence, evidence, unsupported reason, version compatibility.
- `AdapterEvidence`: entry points, routes, providers, middleware, controllers, handlers, existing SDK setup, tests, and citations by path hash/symbol/locator.
- `InstrumentationProposal`: deterministic task ID, base revision/fingerprint, operations, checkpoints, package changes, commands, risks, network requirements, and rollback strategy.
- `PatchOperation`: operation ID, transform ID/version, target relative path, target symbol, expected preimage hash, expected postcondition, and semantic event mapping.
- `PatchResult`: checkpoint, manifest, changed-file before/after hashes, unified diff, operation outcomes, and preserved dirty-file evidence.
- `ValidationResult`: build/type/syntax/SDK/idempotency checks with bounded sanitized output.
- `RollbackResult`: restored files, retained unrelated changes, verification checks, and any manual action required.

Runtime Zod validation is required at adapter, IPC, local persistence, and HTTP boundaries.

### 4.2 Cloud persistence

Replace string lifecycle fields with enums:

```text
InstrumentationPlanStatus:
  PROPOSED -> APPROVED -> APPLYING -> APPLIED -> VALIDATING
  -> COMPLETED | VALIDATION_FAILED | STALE | REJECTED | FAILED | ROLLED_BACK

PatchSetStatus:
  CHECKPOINTED -> APPLYING -> APPLIED -> VALIDATED
  -> VALIDATION_FAILED | ROLLING_BACK | ROLLED_BACK | ROLLBACK_FAILED
```

Extend `InstrumentationPlan` with:

- organization/application/environment/device ownership;
- deterministic `taskKey` and `manifestVersion`;
- framework/version evidence;
- base revision, repository fingerprint, and target hashes;
- package, file, symbol, command, network, checkpoint, event-mapping, and risk manifests;
- approval user/time, approval hash, expiry, rejection reason, and stale reason;
- adapter/rules/scanner/agent versions.

Extend `PatchSet` with:

- manifest version;
- before/after hashes per Tellann operation;
- unified diff hash and approved scope hash;
- local checkpoint kind and opaque checkpoint identifier;
- command and validation summaries;
- apply/validate/rollback actor and timestamps;
- rollback verification and safe failure reason.

Cloud records store relative path hashes and user-approved relative paths, never absolute local paths or raw file contents.

### 4.3 Local persistence

Persist locally:

- full proposed plan and evidence;
- permission decision and scope hash;
- target file preimages for Tellann-touched regions/files;
- Git checkpoint/branch metadata;
- full patch/diff;
- command results;
- validation results;
- relay queue and installation-verification events;
- rollback journal.

Persist credentials only through Electron secure storage. Encrypt sensitive local manifests using a key protected by Windows DPAPI/Electron `safeStorage`.

## 5. Tenant-scoped cloud APIs

Add routes through the API gateway and onboarding/project service:

```text
POST   /v1/applications/:appId/instrumentation/detect
POST   /v1/applications/:appId/instrumentation/plans
GET    /v1/applications/:appId/instrumentation/plans
GET    /v1/applications/:appId/instrumentation/plans/:planId
POST   /v1/applications/:appId/instrumentation/plans/:planId/approve
POST   /v1/applications/:appId/instrumentation/plans/:planId/reject
POST   /v1/applications/:appId/instrumentation/plans/:planId/apply-intent
POST   /v1/applications/:appId/instrumentation/plans/:planId/results
POST   /v1/applications/:appId/instrumentation/plans/:planId/rollback-intent
POST   /v1/applications/:appId/instrumentation/plans/:planId/rollback-results
GET    /v1/applications/:appId/instrumentation/manifests/:manifestId
```

The cloud service:

- validates membership, application/environment/workspace ownership, active device, plan entitlement, and environment policy;
- verifies the plan is based on a tenant-owned repository snapshot;
- records approval but never performs local writes or commands;
- issues a short-lived, single-task capability token bound to plan ID, device ID, workspace opaque ID, scope hash, action, and expiry;
- rejects replay, task expansion, stale plan results, foreign artifacts, and invalid state transitions;
- records audit events for propose, approve, reject, apply, validate, rollback, and failure.

## 6. Local execution architecture

Create these modules under the desktop main/utility boundary:

- `instrumentation-controller`: orchestrates detect/propose/approve/apply/validate/rollback.
- `workspace-reader`: bounded reads and hashes, no execution.
- `git-checkpoint`: detects Git/worktree state, creates `tellann/instrument-<timestamp>` when selected, or records a local checkpoint.
- `patch-engine`: applies typed adapter operations atomically and journals each operation.
- `command-runner`: executes approved executable + argument arrays without a shell, with timeouts, environment allowlists, output bounds, and cancellation.
- `package-manager`: npm, pnpm, yarn, and Bun detection/install argument generation.
- `local-relay`: loopback-only telemetry ingestion, correlation, redaction, buffering, and forwarding.
- `installation-verifier`: confirms SDK package/configuration, relay reachability, and expected verification events.

Privileged work should execute in the existing Electron utility-process boundary or a dedicated utility process. IPC exposes only high-level typed task operations and progress events.

## 7. Framework adapters

### 7.1 Shared transformation rules

- Use `ts-morph`/TypeScript AST for TS/JS/TSX/JSX source and `jsonc-parser` for package/config manifests.
- Preserve module style, quote style where practical, formatting, comments, and line endings.
- Insert stable Tellann markers only around Tellann-owned generated blocks.
- Prefer a dedicated generated integration module plus minimal entry-point import/call.
- Never insert checkpoints into every click or render.
- Instrument authentication/authorization outcomes, workflow start/success/failure/cancellation, validation results, external dependency outcomes, important persisted transitions, and asynchronous completion boundaries.
- If safe symbol resolution is ambiguous, return a non-mutating proposal with manual placement guidance.

### 7.2 React/Vite

Detect Vite config, React dependency, source root, entry module, router, providers, API client, and environment conventions.

Apply:

- frontend SDK dependency;
- generated `tellann.ts` configuration module;
- one entry-point initialization call;
- optional router correlation hook;
- adapter-proposed semantic checkpoints only where confidence and symbol evidence meet policy.

Validate package manifest, import resolution, Vite build/typecheck if available, duplicate markers, and verification event delivery through the relay.

### 7.3 Next.js

Support App Router and conventional Pages Router separately.

Apply client instrumentation in a client-safe provider and server instrumentation in supported route/middleware/server modules. Never leak server credentials into client bundles. Respect Next.js runtime boundaries and unsupported Edge-runtime behavior.

Validate Next build/typecheck, server/client import boundaries, provider uniqueness, route handling, and relay events.

### 7.4 Express

Detect application/router construction and middleware registration order.

Apply backend SDK initialization and Tellann middleware after essential request parsing but before route handlers/error middleware. Preserve existing error-handler order.

Validate syntax/typecheck, middleware uniqueness, request correlation propagation, response/error capture, and installation verification.

### 7.5 Fastify

Detect Fastify instance/plugin registration and encapsulation boundaries.

Apply a generated plugin or supported integration registration once, respecting plugin scope and hook order.

Validate plugin registration, typecheck/build, correlation propagation, response/error events, and idempotency.

### 7.6 NestJS

Detect bootstrap, root module, adapters, global interceptors/filters, and conventional module structure.

Apply generated instrumentation module/provider/interceptor through supported Nest APIs. Avoid rewriting controller business methods when global interceptors provide sufficient coverage.

Validate Nest build/typecheck, dependency injection, singleton registration, correlation, and verification events.

## 8. SDK protocol evolution

Extend frontend and backend configuration with optional backward-compatible fields:

```ts
type RunCorrelationContext = {
  runId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
  instrumentationManifestVersion?: string;
};
```

Add:

- stable configured session ID instead of generating a disconnected ID in each backend event;
- run/trace/agent/manifest fields on every event;
- propagation and extraction of `x-tellann-run-id`, `x-tellann-session-id`, and W3C trace context only for configured application origins;
- workflow cancellation event;
- installation verification event carrying manifest and adapter versions;
- bounded retry/backoff and offline buffer behavior;
- optional relay endpoint that defaults only when explicitly injected by the desktop-launched process/browser.

Existing SDK configurations, ingestion keys, event types, and direct collector endpoints remain compatible.

## 9. Local relay

The relay binds to a random loopback port and uses a per-run nonce plus short-lived scoped credential.

Responsibilities:

- accept single/batch SDK events from configured local origins;
- enforce body/event limits and origin policy;
- attach or verify run/session/trace/application/environment context;
- redact secrets and disallowed metadata locally;
- assign idempotency keys;
- store a bounded encrypted offline queue;
- forward to the existing event collector;
- expose health and installation-verification status to the desktop main process only.

It never exposes dashboard JWTs, device refresh tokens, management API keys, or repository data.

## 10. Desktop experience

Replace the current Phase 3 placeholder with:

1. Framework detection summary and support status.
2. Plan creation with adapter evidence.
3. Task review grouped by dependencies, files/symbols, checkpoints, commands, network access, risk, validation, and rollback.
4. Explicit approval checkboxes for file and command scopes.
5. Progress timeline for checkpoint, patching, dependency install, validation, and verification.
6. Diff viewer with Tellann operations and preserved pre-existing changes clearly separated.
7. Validation screen with sanitized outputs and actionable failures.
8. Rollback action and rollback verification.
9. Instrumentation history and manifest detail.
10. QA-run linkage showing which patch/manifest produced the telemetry.

React implementation rules:

- fetch independent plan/history/detection resources concurrently;
- keep heavyweight diff rendering lazy-loaded;
- avoid renderer-side filesystem parsing;
- use stable callbacks and derived render state;
- virtualize or apply `content-visibility` to large operation/validation lists.

## 11. Failure and recovery behavior

- Unsupported framework/version: non-mutating proposal and browser/document modes remain available.
- Dirty worktree: preserve existing edits and explicitly label overlap risks.
- Stale task: reject before write and offer regeneration.
- File changes during apply: stop, journal completed operations, and offer safe rollback.
- Package install failure: retain diff/checkpoint, show output, allow retry or rollback.
- Validation failure: repair only within the approved task and file scope; otherwise stop.
- Relay/cloud unavailable: buffer locally and complete local validation; sync idempotently later.
- Desktop interruption: journal state and resume or rollback deterministically.
- Browser/run failure: preserve instrumentation state and report run failure separately.
- Rollback conflict with subsequent user edits: do not overwrite; produce a conflict report and manual recovery guidance.

## 12. Testing strategy

### Unit and contract

- Zod contract validation and version negotiation.
- framework/version detection fixtures.
- transform fixtures for TS, JS, TSX, JSX, ESM, CommonJS, monorepos, and multiple package managers.
- path traversal, symlink/junction containment, command argument injection, environment leakage, and scope-expansion denial.
- SDK correlation and backwards compatibility.
- relay authentication, origin policy, limits, redaction, retry, and replay idempotency.

### Adapter acceptance matrix

Every adapter must prove:

- supported and unsupported version behavior;
- clean and dirty Git repositories;
- repository without Git;
- package dependency insertion;
- entry/provider/middleware insertion;
- semantic checkpoint insertion;
- formatting/comment preservation;
- repeated apply idempotency;
- stale revision and target-hash rejection;
- task file/command scope enforcement;
- build/type/syntax validation;
- verification event receipt;
- rollback that preserves unrelated edits.

### Cloud and tenancy

- foreign organization/application/workspace/snapshot/plan rejection;
- revoked and expired device rejection;
- expired/replayed capability token rejection;
- entitlement enforcement at UI, gateway, service, result upload, report, and audit layers;
- production instrumentation rejection;
- idempotent plan/result synchronization.

### End-to-end

1. Solo React/Vite project: propose, approve, apply twice, validate, run, correlate, report, rollback.
2. Next.js App Router and Pages Router fixtures.
3. Express, Fastify, and NestJS services with correlated frontend/backend evidence.
4. Dirty worktree and stale task rejection.
5. Offline relay buffering and replay.
6. User denial leaves browser-only QA available.
7. Production rejects plan approval/application locally and in cloud.

## 13. Delivery waves

### Wave A — Contracts and lifecycle

- schemas, migrations, audit actions, cloud routes, capability tokens, permission policy, local journal.

Exit: a tenant-scoped plan can be proposed, approved, rejected, made stale, and synchronized without local mutation.

### Wave B — Execution and relay foundation

- checkpoint engine, patch engine, command runner, package managers, relay, SDK correlation.

Exit: a fixture task can apply/validate/rollback safely and correlated events reach the collector.

### Wave C — React/Vite vertical slice

- full adapter and desktop workflow.

Exit: the Solo-user acceptance journey passes on clean, dirty, stale, idempotent, failed-validation, and rollback fixtures.

### Wave D — Next.js

- App and Pages Router support with client/server boundary tests.

### Wave E — Express and Fastify

- middleware/plugin instrumentation and cross-layer correlation.

### Wave F — NestJS

- module/provider/interceptor instrumentation.

### Wave G — Phase 3 closure

- complete security, tenancy, entitlement, interruption, offline, report, desktop, and web-companion acceptance matrix.

## 14. Phase 3 definition of done

Phase 3 is complete only when all five adapters pass their supported-version fixture matrices and the following are proven from the real desktop application:

- repeated instrumentation is idempotent;
- unrelated dirty worktree changes survive apply and rollback;
- stale tasks are rejected before writes;
- commands and paths cannot escape approved scope;
- validation/build/SDK-verification results render before completion;
- frontend/backend/browser evidence shares run/session/trace context;
- rollback removes only Tellann-authored operations;
- production mutation is rejected locally and by the cloud;
- lower plans cannot invoke apply APIs but retain browser/manual alternatives;
- the canonical report identifies adapter, manifest, patch, validation, and correlated evidence provenance.

## 15. Post-Phase 3 launch-readiness programme

After Phase 3 acceptance, execute the user-requested launch audit without treating source/build proof as runtime proof:

1. Start databases, queues, storage, all microservices, web surfaces, and Electron desktop.
2. Run Phase 1-3 journeys through the actual desktop and web companion.
3. Verify Paystack-first checkout, raw-body signature validation, provider-native idempotency, webhook reconciliation, invoices, receipts, renewal, upgrade, downgrade, cancellation, dunning, and Stripe fallback policy.
4. Verify every settings page, security/session control, profile action, password/auth-mode flow, organization setting, notification preference, ingestion key, and integration control.
5. Verify member invitation, acceptance, roles, removal, ownership protections, audit logs, and collaboration entitlements.
6. Execute a plan-by-plan entitlement matrix for Free, Local, Solo, Team, Business, and Enterprise at UI and backend enforcement points.
7. Record launch evidence and remaining risks. Windows application signing is the only pre-approved exclusion; missing live provider credentials or external certification must be reported as external release blockers rather than silently mocked.
