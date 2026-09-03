# Tellann Agentic Desktop Application Feasibility Study

## 1. Executive summary

### Decision

The proposed change is **technically feasible and strategically aligned with Tellann's original goal**, but it should be implemented as a **hybrid desktop-and-cloud evolution**, not as a simple conversion of the current website into a desktop wrapper.

The recommended product becomes:

```text
Tellann Cloud Control Plane
  + Tellann Desktop Execution Agent
  + Managed Browser Observation
  + Documentation and Repository Intelligence
  + Existing Telemetry, Graph, Reconciliation, and Report Pipeline
```

The desktop application should remove most integration work from the QA user:

- The user signs in.
- Opens or clones a project.
- Reviews a permission request.
- Adds product documentation.
- Lets Tellann inspect the repository and propose expected flows.
- Reviews and edits those proposals.
- Approves an instrumentation plan and code patch.
- Lets Tellann install dependencies and start the application.
- Demonstrates workflows in a controlled browser, or lets the agent explore approved flows.
- Receives visual, behavioral, API, accessibility, and expected-versus-observed findings.

### Feasibility assessment

| Capability | Feasibility | Current foundation | Main missing work |
|---|---:|---|---|
| Desktop shell and authentication | High | Existing authentication and cloud dashboard | Desktop shell, device login, secure token storage, updater |
| Local project import and inspection | High | TypeScript monorepo expertise and SDKs | Repository scanner, language/framework adapters, permission broker |
| Automated SDK installation | Medium-High | Frontend/backend SDK packages and onboarding test event | Patch planner, dependency installer, framework-specific transforms, rollback |
| Automatic checkpoint insertion | Medium | State/transition event model | Static analysis, instrumentation policy, confidence scoring, patch validation |
| Documentation-derived expected flows | High | AI drafts, rulesets, validation, suggestions, review lifecycle | File ingestion, extraction, document provenance, multi-document synthesis UI |
| Browser-driven flow observation | High | Event/session/graph/report pipeline | Playwright/CDP controller, browser permissions, visual capture, correlation |
| Visual and UI quality analysis | Medium-High | Session replay and report framework | Screenshot/DOM/accessibility/network analyzers, evidence model, new report types |
| Fully autonomous QA | Medium-Low initially | AI/rule engines and graph comparison | Safe planning, credentials, test data, destructive-action boundaries, reliability |
| Cloud reporting and collaboration | High | Already implemented | Adapt APIs and UI for desktop-originated runs |

### Strategic conclusion

The highest-value change is not "desktop instead of web." It is moving integration and execution into a **trusted local agent** while retaining cloud coordination and reporting.

The current system already has much of the difficult downstream intelligence:

- Organizations, applications, environments, entitlements, and audit logs.
- Ingestion keys and telemetry gateways.
- Frontend and backend SDKs.
- Sessions and replay storage.
- Observed behavior graphs.
- Declared graphs and versions.
- AI-generated flow drafts.
- Dynamic rules and rule-based fallback generation.
- Suggestions with accept, edit, reject, and dismiss states.
- Graph validation.
- Expected-versus-observed reconciliation.
- Missing-state and missing-flow analysis.
- Endpoint intelligence.
- Report generation, export, storage, and retention.

The desktop proposal primarily replaces the current manual **input and execution layer**. It does not require rebuilding the analysis and reporting platform.

## 2. Problem statement

The current workflow asks a QA user to perform work that often belongs to a developer or systems engineer:

1. Understand package installation.
2. Modify application bootstrap code.
3. Handle API keys and environment IDs.
4. Match SDK event names to declared states.
5. Correlate frontend and backend telemetry.
6. Diagnose networking, CORS, and gateway failures.
7. Manually enumerate states and transitions.
8. Maintain large expected-flow graphs as the application changes.

This creates three product problems.

### 2.1 The user is not the required operator

The product is intended to simplify QA, but its first-value path assumes codebase access and development knowledge. A QA professional may know what the application should do without knowing where to initialize a TypeScript SDK or how to modify middleware.

### 2.2 Setup cost grows with product complexity

Manual state and transition declaration scales poorly:

```text
Small application
  -> a few states and transitions

Large application
  -> many roles
  -> many routes
  -> many permissions
  -> alternate outcomes
  -> background jobs
  -> external dependencies
  -> versioned workflows
  -> hundreds or thousands of graph elements
```

The declaration process can become a second documentation system that users must maintain manually.

### 2.3 Telemetry alone is incomplete QA evidence

Instrumented state checkpoints explain semantic behavior, but they do not fully explain the rendered experience. The current system cannot reliably detect, from state events alone:

- A hidden or overlapped button.
- A broken responsive layout.
- Missing labels or focus indicators.
- A blank page caused by a client runtime exception.
- A visually misleading success state.
- A modal outside the viewport.
- A slow or failed resource visible only in browser/network evidence.
- A flow that technically completed but was unusable.

The proposed desktop application addresses all three by combining repository intelligence, controlled code modification, browser observation, and human review.

## 3. Product principle

The new product promise should be:

> Open your project, provide the product intent, approve Tellann's plan, and demonstrate the application. Tellann handles instrumentation, observation, comparison, and reporting.

The QA user should verify intent and findings, not perform integration engineering.

The operating principles should be:

1. **Infer first; ask the user to verify.**
2. **Propose changes before mutating the project.**
3. **Use least privilege and progressive permission grants.**
4. **Keep every code change reviewable and reversible.**
5. **Combine code, documentation, runtime, browser, and telemetry evidence.**
6. **Keep expected behavior separate from observed behavior.**
7. **Never let AI output silently become graph truth.**
8. **Never let the agent perform destructive business actions without explicit approval.**
9. **Attach provenance and confidence to every inferred flow and finding.**
10. **Allow a manual path when automation cannot safely understand a project.**

## 4. Current system assessment

## 4.1 Components that should be retained

### Authentication and organization control

The current authentication service already supports:

- Email identification.
- OTP sign-up and login.
- Password login.
- Session refresh.
- Logout.
- User profile and preferences.
- Active session management.
- Organization membership.

These should remain cloud-owned. The desktop application becomes another authenticated client.

### Onboarding and application model

The current organization, application, environment, entitlement, ingestion-key, and onboarding-progress models remain useful. The desktop application should create and select these through the existing API gateway.

### SDKs and event contract

The frontend and backend SDKs already emit the event types used by the graph pipeline. They should be retained as one instrumentation option.

The desktop agent can make their installation automatic while the protocol remains compatible.

### AI and ruleset foundation

The current flow intelligence implementation is directly relevant:

- Product descriptions are sanitized.
- Domain inference selects relevant rulesets.
- AI generation can fall back to rule-based generation.
- Drafts are stored separately from active graphs.
- Outputs pass schema and graph validation.
- Drafts can be accepted partially or rejected.
- AI invocation metadata and feedback are stored.
- Suggestions carry lifecycle state and confidence.

This is the basis for documentation-driven flow inference.

### Graph and reconciliation pipeline

The existing declared/observed graph separation is correct for the proposed product. It allows Tellann to compare:

- What documentation and users say should happen.
- What source analysis suggests can happen.
- What the browser and SDK actually observed.

### Storage and reporting

The existing storage abstraction, storage ledger, retention worker, replay storage, report export, and entitlement enforcement should be extended for:

- Uploaded documents.
- Repository scan summaries.
- Patch artifacts.
- Browser traces.
- Screenshots.
- Accessibility snapshots.
- Network logs.
- Run videos where enabled.

## 4.2 Components that need substantial modification

### Current onboarding wizard

The profile -> manual graph -> SDK snippet -> demonstration sequence should be replaced by a desktop-guided workspace:

```text
Project
  -> Intent
  -> Proposed flows
  -> Proposed instrumentation
  -> Launch
  -> Observe
  -> Review
```

### Flow declaration UI

The current node-by-node builder should become an advanced correction tool, not the primary onboarding path.

The default experience should show:

- Inferred workflows grouped by feature.
- Source documentation supporting each workflow.
- Repository evidence supporting each state.
- Assumptions and unresolved questions.
- Confidence and conflict indicators.
- Bulk accept, reject, merge, rename, and edit actions.

### SDK onboarding

The user should no longer copy a snippet. The agent should:

1. Detect the framework.
2. Select the appropriate integration adapter.
3. Show the planned dependency and file changes.
4. Create a safety checkpoint.
5. Apply the patch after approval.
6. Install dependencies after approval.
7. Run build/type checks.
8. Start the application.
9. Verify telemetry.
10. Offer rollback when validation fails.

### Demonstration model

The current threshold-based observation step should become a named **QA Run** with:

- Selected application and environment.
- Selected expected flows.
- Repository revision and dirty-state snapshot.
- Launch command and services.
- Browser context.
- Start and end time.
- Screenshots, trace, console, network, accessibility, and telemetry evidence.
- Credentials or test-data profile references.
- Analysis status and report ID.

## 4.3 Components that do not exist yet

The following are net-new:

- Desktop shell.
- Local agent runtime.
- Secure OS credential storage.
- Device authorization and revocation.
- Project chooser and optional Git clone.
- Workspace trust.
- File-system permission broker.
- Repository indexing.
- Framework and package-manager detection.
- Local command policy.
- Process supervisor and port detection.
- Patch plan and diff review.
- AST-based code transforms.
- Git safety/checkpoint integration.
- Browser automation and browser evidence capture.
- Credential/test-data vault.
- Document upload and extraction pipeline.
- Evidence provenance graph.
- Local/cloud synchronization and offline queue.
- Desktop update, signing, and release infrastructure.

## 5. Recommended target architecture

## 5.1 Hybrid architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Tellann Desktop                                              │
│                                                              │
│  Trusted local UI                                            │
│  Permission broker                                           │
│  Repository indexer                                          │
│  Code intelligence                                            │
│  Patch planner and applier                                    │
│  Process supervisor                                           │
│  Browser controller                                           │
│  Local evidence store                                         │
│  Sync client                                                  │
└───────────────┬───────────────────────┬──────────────────────┘
                │                       │
                │ local filesystem      │ authenticated HTTPS
                │ processes/browser     │
                ▼                       ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│ Customer application      │   │ Tellann Cloud               │
│                           │   │                              │
│ Source repository         │   │ Auth and organizations       │
│ Frontend/backend services │   │ Application/environment      │
│ Test environment          │   │ Flow intelligence            │
│ Local or remote browser   │   │ Telemetry collection         │
└───────────────────────────┘   │ Graph and reconciliation     │
                                │ Reports and collaboration     │
                                │ Object storage and retention  │
                                └──────────────────────────────┘
```

### Why hybrid is preferable

Local execution is necessary because the product needs controlled access to files, commands, ports, and browser processes. Cloud services remain necessary because the product also needs:

- Shared organizations and applications.
- Team collaboration.
- Central entitlements and billing.
- Cross-run history.
- Report sharing.
- Auditing.
- Central AI provider control.
- Storage and retention policy.
- Revocation of desktop sessions.

## 5.2 Desktop shell recommendation

### Recommended for the first production version: Electron

Electron is the most pragmatic first choice because:

- The repository is TypeScript/Node-oriented.
- Existing SDK and shared packages can be reused directly.
- Process management, file access, Git, package managers, and Playwright integrate naturally with Node.
- Chromium behavior is consistent across supported desktop platforms.
- The team can implement the shell without introducing Rust as a critical-path language.

Electron must be hardened:

- Local packaged renderer, not an untrusted remote dashboard with native access.
- `nodeIntegration: false`.
- `contextIsolation: true`.
- Renderer sandbox enabled.
- Narrow, typed IPC methods exposed through a preload bridge.
- IPC sender and argument validation.
- Navigation and new-window restrictions.
- Permission request handlers.
- Restrictive Content Security Policy.
- No arbitrary shell strings from the renderer or cloud.
- Signed application and signed updates.

Official Electron guidance specifically warns against giving remote content Node access and recommends context isolation, sandboxing, permission handlers, navigation restrictions, and IPC validation.

### Alternative: Tauri

Tauri is viable and provides a granular capability/permission model with a smaller native shell. It becomes preferable if:

- Binary footprint is a primary constraint.
- The team is prepared to maintain Rust.
- Browser execution remains a sidecar or separately managed process.
- Native capability policy is considered worth the cross-language complexity.

For this repository, Tauri would increase first-release implementation risk without eliminating the need for Node-based language tooling and browser automation. It should remain an architectural option after the local-agent boundaries stabilize.

## 5.3 Desktop process boundaries

The desktop application should use separate processes:

### Renderer

Responsible only for UI:

- Project selection.
- Permission presentation.
- Plans and diffs.
- Flow review.
- Run controls.
- Evidence and reports.

It must not receive unrestricted file-system or process APIs.

### Main process

Responsible for:

- Window lifecycle.
- Authentication redirect handling.
- Secure token storage.
- Permission decisions.
- IPC policy.
- Agent process lifecycle.
- Updates.

### Agent utility process

Responsible for privileged and failure-prone work:

- Repository scanning.
- AST analysis.
- Patch generation.
- Dependency installation.
- Builds and tests.
- Dev-server management.
- Browser control.
- Evidence packaging.

Crashes or hangs in the agent should not terminate the UI.

### Cloud sync worker

Responsible for:

- Upload queues.
- Resumable artifacts.
- Retry and backoff.
- Retention metadata.
- Redaction.
- Run status synchronization.

## 6. New desktop-domain model

The cloud database needs additional entities or equivalents.

### DeviceSession

Tracks:

- User and organization.
- Device identifier and public key.
- Platform and app version.
- Last seen time.
- Granted scopes.
- Revoked time.

### ProjectWorkspace

Tracks:

- Application.
- Local opaque workspace ID.
- Repository origin fingerprint, not necessarily the full local path.
- Framework and package manager.
- default branch and revision.
- Workspace trust status.
- Last scan.

Do not upload a user's absolute local path unless required and explicitly allowed.

### PermissionGrant

Tracks explicit permissions:

- Read project files.
- Write selected project files.
- Run approved commands.
- Install dependencies.
- Start local servers.
- Control a Tellann-managed browser.
- Capture screenshots.
- Capture network/console data.
- Upload selected source summaries.
- Upload full files only when separately approved.

Every grant should include scope, duration, purpose, and revocation.

### RepositorySnapshot

Tracks:

- Commit/revision.
- Dirty-state hash.
- detected frameworks.
- routes and endpoints.
- commands.
- dependency manifest hashes.
- scan findings.
- redaction summary.

The default cloud payload should contain derived summaries, not the entire repository.

### InstrumentationPlan

Tracks:

- Files proposed for change.
- Packages proposed for installation.
- Checkpoints proposed.
- Rationale and confidence.
- Expected event mappings.
- Risk level.
- Required permissions.
- Validation commands.

### PatchSet

Tracks:

- Base revision.
- Unified diff or structured operations.
- Approval status.
- Applied status.
- validation output.
- rollback/checkpoint reference.
- agent/model/tool versions.

### SourceDocument

Tracks:

- Application and organization.
- Filename and MIME type.
- Object-storage key.
- checksum.
- extracted text or structured sections.
- retention classification.
- parser version.
- uploader and upload time.
- processing state.

### IntentEvidence

Links an inferred state or transition to:

- Document and page/section.
- Route or component.
- API endpoint.
- schema or permission rule.
- user statement.
- ruleset pattern.
- AI invocation.

### QARun

Tracks the complete observation:

- Selected flow versions.
- environment.
- repository snapshot.
- patch set.
- launched services.
- browser context.
- evidence artifacts.
- observed graph version.
- reconciliation.
- report.
- status and failure reason.

### BrowserFinding

Tracks:

- Finding category.
- Severity and confidence.
- URL and viewport.
- screenshot/trace evidence.
- DOM selector or accessibility node.
- console/network correlation.
- related flow, state, and session.
- suggested remediation.
- user disposition.

## 7. Project import and permission model

## 7.1 Import options

The desktop application should support:

1. **Open local folder**.
2. **Clone Git repository** using a user-provided URL and credential method.
3. **Attach an already running application** by URL for browser-only analysis.
4. Later, **connect a remote development environment**.

Browser-only analysis should remain available for users who cannot grant source access, although results will have less semantic depth.

## 7.2 Workspace trust

Opening a repository is security-sensitive because repository scripts may be malicious or compromised.

The desktop app must first operate in **read-only scan mode**:

- Do not install dependencies.
- Do not execute lifecycle scripts.
- Do not run project commands.
- Do not load repository code into the desktop renderer.
- Parse manifests and source as data.

After inspection, show:

- Detected languages and frameworks.
- Package manager.
- Proposed commands.
- Files that may be read.
- Files that may be changed.
- Network access required.
- Risks such as post-install scripts.

The user then grants narrowly scoped permissions.

## 7.3 Permission levels

### Level 0: Browser only

- Open a URL.
- Capture browser evidence.
- No repository access.

### Level 1: Read project

- Index approved directory.
- Infer routes, components, endpoints, and flows.
- No file writes or commands.

### Level 2: Propose changes

- Generate a patch in memory.
- Show diff.
- No application until approved.

### Level 3: Apply approved patch

- Write only approved files.
- Create new approved files.
- No arbitrary commands.

### Level 4: Run approved commands

- Install dependencies.
- Build/test.
- Start declared services.
- Commands are structured and individually visible.

### Level 5: Controlled QA actions

- Use test credentials.
- Submit forms.
- Create or modify test data.
- Each sensitive or destructive action is policy-gated.

Permission escalation should be prompted at the moment it is needed.

## 8. Repository understanding

## 8.1 Detection pipeline

The scanner should inspect:

- Git metadata.
- Package manifests and lockfiles.
- Framework configuration.
- Application entry points.
- Route definitions.
- UI components.
- API clients.
- Backend controllers/routes.
- schemas and migrations.
- authentication and authorization middleware.
- test files.
- existing analytics and error instrumentation.
- environment examples, without reading real secret values by default.
- product documentation in the repository.

## 8.2 Framework adapter architecture

Do not build one generic prompt that rewrites arbitrary code. Use versioned adapters:

```text
FrameworkAdapter
  detect()
  indexRoutes()
  indexEndpoints()
  locateBootstrap()
  locateAuthBoundaries()
  proposeSdkIntegration()
  proposeCheckpointSites()
  validatePatch()
  determineLaunchCommands()
```

Initial adapters should target the narrowest useful market:

- React with Vite.
- Next.js.
- Node with Express.
- Node with Fastify.
- NestJS.

Later adapters can add other ecosystems.

## 8.3 Static flow inference

Source analysis can infer candidates from:

- Route trees.
- redirects.
- navigation calls.
- form submit handlers.
- API mutations.
- state machines and reducers.
- guards and middleware.
- permission checks.
- status enums.
- error branches.
- tests.
- schemas.

Static analysis should output candidates with evidence and confidence, not claim runtime truth.

Example:

```json
{
  "state": "PASSWORD_RESET_REQUESTED",
  "confidence": 0.88,
  "evidence": [
    {
      "type": "ROUTE",
      "file": "src/app/auth/forgot-password/page.tsx",
      "symbol": "ForgotPasswordPage"
    },
    {
      "type": "API",
      "file": "src/lib/auth.ts",
      "symbol": "requestPasswordReset"
    }
  ]
}
```

## 9. Automated SDK installation

## 9.1 Installation workflow

```text
Detect framework and entry points
  -> Select adapter
  -> Determine frontend/backend/both
  -> Generate instrumentation plan
  -> Show packages, files, and events
  -> User approves
  -> Create Git or local checkpoint
  -> Apply AST-based changes
  -> Install dependencies
  -> Build/type-check/test
  -> Start app
  -> Send onboarding test event
  -> Confirm server receipt
  -> Keep or roll back
```

## 9.2 Patch techniques

Preferred order:

1. Framework-native configuration.
2. AST transforms/codemods.
3. Structured file insertion.
4. Text patch only when syntax-aware approaches are unavailable.

Never allow a language model to overwrite whole files when a bounded transform is possible.

## 9.3 Safety checkpoint

Before writes:

- Record Git branch, commit, and dirty state.
- Refuse to silently overwrite existing user changes.
- Offer a new `tellann/...` branch when Git is available.
- Store the proposed diff.
- Provide one-click rollback of Tellann's patch.

Rollback must revert only the agent's edits, not unrelated user changes.

## 9.4 Dependency installation

The agent must detect npm, pnpm, Yarn, or Bun from the lockfile and project metadata.

Before running installation:

- Show the exact structured command.
- Warn about lifecycle scripts.
- Prefer locked/frozen installation where appropriate.
- Enforce command timeouts.
- Capture output.
- Avoid passing secrets to logs.

## 9.5 Checkpoint policy

Not every UI action needs an SDK event. Instrumentation should focus on semantic boundaries:

- Authentication state changes.
- Business-process start, success, failure, and cancellation.
- Validation results.
- Authorization decisions.
- external dependency outcomes.
- persisted state transitions.
- important async/background outcomes.

Browser evidence supplies low-level clicks and visuals. Semantic checkpoints supply business meaning. The two should complement each other.

## 10. Documentation-driven flow inference

## 10.1 Supported inputs

Initial support:

- Markdown.
- Plain text.
- PDF.
- DOCX.
- HTML.
- OpenAPI JSON/YAML.
- User stories and acceptance criteria.

Later:

- Images and diagrams.
- Figma exports or linked design context.
- Jira/Confluence/Notion/GitHub issues through explicit integrations.

## 10.2 Processing pipeline

```text
Upload or select documents
  -> Virus and file-type validation
  -> Object storage
  -> Text/structure extraction
  -> Secret and personal-data scanning
  -> Section and requirement segmentation
  -> Feature clustering
  -> Actor/role extraction
  -> State and transition inference
  -> Rule and repository enrichment
  -> Graph validation
  -> Conflict detection
  -> Reviewable flow proposal
```

## 10.3 Inference schema

Each proposed workflow should include:

- Name and purpose.
- Actors and roles.
- Preconditions.
- States.
- transitions and triggering actions.
- success outcomes.
- validation failures.
- authorization failures.
- dependency failures.
- recovery paths.
- terminal outcomes.
- source citations.
- assumptions.
- unresolved questions.
- confidence.

## 10.4 Multiple documents and conflicts

Real documentation is inconsistent. The system must not merge conflicts silently.

Example:

```text
PRD: guest checkout is allowed
API documentation: authenticated user ID is required
Source code: route redirects guests to login
Runtime: browser confirms redirect
```

The system should create a conflict card showing all four claims and ask which behavior is intended.

## 10.5 Human verification model

The user should review at feature level:

- Accept complete feature.
- Accept selected paths.
- Rename or merge states.
- Edit preconditions.
- Reject irrelevant behavior.
- Mark uncertain behavior for later.
- Add a short correction in natural language.

The graph editor remains accessible for advanced users, but should not be the default interaction.

## 10.6 Reuse of current implementation

The current `AIFlowDraft` and suggestion lifecycle should be generalized:

- Add `DOCUMENT_UPLOAD`, `REPOSITORY_SCAN`, and `HYBRID_ANALYSIS` draft sources.
- Allow a draft to contain multiple evidence references.
- Convert accepted workflows into declared graph versions.
- Continue schema and graph validation before acceptance.
- Preserve AI provider, model, prompt hash, ruleset versions, and user feedback.
- Add document parser and repository analyzer versions for reproducibility.

## 11. Browser integration and visual QA

## 11.1 Managed browser

The desktop agent should launch a dedicated Playwright Chromium context by default rather than taking over the user's everyday browser.

Benefits:

- Isolated cookies and credentials.
- Reproducible viewport and locale.
- Controlled permissions.
- Trace, screenshots, DOM snapshots, console, and network capture.
- Easy cleanup.
- Lower risk of reading unrelated personal browsing data.

An optional "attach to existing Chrome" mode can come later and requires stronger disclosure.

Playwright supports capturing browser operations, network activity, screenshots, and DOM snapshots in traces. These artifacts can be attached to Tellann runs and findings.

## 11.2 Observation layers

### Browser interaction evidence

- navigation.
- clicks.
- form submission.
- dialogs.
- downloads.
- popups.
- route changes.

### Visual evidence

- full-page and element screenshots.
- viewport variations.
- layout shifts.
- clipping and overlap.
- contrast and text visibility.
- loading, empty, error, and success rendering.

### DOM and accessibility evidence

- semantic roles.
- accessible names.
- labels.
- focus order.
- keyboard reachability.
- landmarks.
- heading hierarchy.
- ARIA misuse.

### Runtime evidence

- console errors and warnings.
- uncaught exceptions.
- failed resources.
- request and response metadata.
- API status and latency.
- redirects.
- storage/cookie changes under policy.

### Tellann semantic evidence

- state entry.
- state transition.
- workflow lifecycle.
- business events.
- server endpoints.
- errors.

## 11.3 Correlation

Every QA run needs a shared correlation context:

```text
runId
  -> browserContextId
  -> sessionId
  -> traceId
  -> frontend events
  -> backend events
  -> screenshots
  -> network requests
  -> declared flow version
```

The desktop agent can inject a run header or configured test-session identifier into browser traffic. The SDKs should consume and propagate it. This resolves the current fragmentation risk between frontend and backend evidence.

## 11.4 Manual and agentic modes

### Guided demonstration

The human uses the application. Tellann observes and displays progress against expected flows.

Best for:

- exploratory QA.
- complex business judgment.
- MFA and human verification.
- workflows with sensitive effects.

### Agent-assisted demonstration

The agent follows an approved plan, pausing for:

- credentials.
- MFA.
- payment or external effects.
- destructive operations.
- ambiguous UI.

### Autonomous safe exploration

The agent explores only a defined test environment with:

- approved routes.
- seeded test accounts.
- action allowlist.
- prohibited operations.
- data cleanup policy.

Autonomous mode should not be the initial public capability.

## 11.5 Visual finding categories

Initial useful categories:

- Page failed to render.
- Console/runtime error.
- Broken navigation.
- Element not visible or not actionable.
- Element overlap or clipping.
- Responsive overflow.
- Missing form label.
- Keyboard trap or unreachable control.
- Missing loading/error/empty feedback.
- Failed API request.
- Slow interaction or endpoint.
- Declared outcome not visibly confirmed.
- Visually confirmed outcome inconsistent with semantic event.

Each finding must include evidence, reproduction steps, affected flow/state, confidence, and suggested next action.

## 12. Simplified target user journey

## 12.1 First-time journey

### Step 1: Sign in

The user signs in through the desktop application using the existing Tellann account flow.

### Step 2: Open project

The user selects a local project folder, clones a repository, or enters a running application URL.

### Step 3: Grant initial read permission

Tellann requests read-only project access and explains what will be inspected.

### Step 4: Add product intent

The user:

- Uploads existing documents.
- Selects documentation already in the repository.
- Adds a short natural-language product description.

### Step 5: Review inferred system map

Tellann combines documents, source structure, routes, APIs, tests, and rulesets to propose:

- features.
- actors.
- workflows.
- states.
- transitions.
- edge cases.
- unresolved conflicts.

The user reviews and corrects proposals rather than drawing everything manually.

### Step 6: Approve integration plan

Tellann shows:

- packages to add.
- files to change.
- semantic checkpoints.
- launch commands.
- permissions required.

The user approves all or selected changes.

### Step 7: Let Tellann integrate and validate

Tellann:

- creates a checkpoint.
- applies changes.
- installs dependencies.
- builds/tests.
- starts the application.
- verifies the telemetry connection.

Failures are explained with rollback or repair options.

### Step 8: Run QA

Tellann opens the managed browser. The user chooses:

- guided manual demonstration.
- agent-assisted execution.

The app displays flow progress and captures visual, accessibility, network, console, SDK, and server evidence.

### Step 9: Review report

Tellann produces:

- expected-versus-observed coverage.
- missing states and paths.
- unexpected behavior.
- visual and accessibility problems.
- runtime and API errors.
- endpoint performance.
- session/trace replay.
- evidence-backed remediation suggestions.

### Step 10: Iterate

The user can ask Tellann to:

- update the declaration.
- improve instrumentation.
- propose a code fix.
- rerun affected flows.
- compare results with the previous run.

## 12.2 Returning user journey

```text
Open project
  -> Detect repository/document changes
  -> Refresh affected flow proposals
  -> Review small diff
  -> Run selected QA suite
  -> Review report and drift
```

The full onboarding should not repeat.

## 13. Security and privacy architecture

This is the most important feasibility constraint because the desktop agent would hold materially more power than the current website.

## 13.1 Threats

- Malicious repository scripts.
- Prompt injection inside source files or documentation.
- Compromised dependencies.
- A compromised cloud instruction attempting local execution.
- Renderer compromise reaching native APIs.
- Accidental upload of source code or secrets.
- Incorrect patches damaging user work.
- Browser capture collecting passwords or personal data.
- QA actions modifying production data.
- Token theft from local storage.
- Cross-organization artifact leakage.

## 13.2 Required controls

### Local authority

Cloud responses may propose operations but must not directly execute arbitrary local commands. The local policy engine validates every operation against:

- Current permission grants.
- Workspace path.
- command allowlist.
- file-write scope.
- action risk.
- user approval.

### Structured commands

Represent commands as executable plus argument array and working directory. Do not accept concatenated shell strings.

### Path containment

Resolve and verify every read/write path is inside the approved workspace. Symlinks and junctions require explicit handling.

### Secret protection

- Use OS secure credential storage.
- Never store desktop refresh tokens in ordinary JSON/config files.
- Scan patches, logs, documents, and uploads for secrets.
- Redact environment values by default.
- Do not upload `.env`, private keys, credential stores, or browser profiles.

### Prompt-injection isolation

Treat repository and document text as untrusted data:

- It cannot grant permissions.
- It cannot change system policy.
- It cannot authorize commands.
- It cannot suppress user confirmation.
- It cannot request secrets.

### Code-change governance

- Diff before apply.
- File and line provenance.
- Base revision check.
- Syntax/build validation.
- targeted rollback.
- Audit log.

### Browser privacy

- Managed isolated browser profile.
- Password-field masking.
- Configurable screenshot redaction.
- No capture on excluded URLs.
- Exclude authentication, payment, health, and other sensitive fields by policy.
- Explicit consent for video or full DOM snapshots.

### Tenant isolation

Every uploaded artifact and derived record must carry organization and application ownership. Existing gateway authorization patterns should be applied consistently to all new endpoints.

## 13.3 Production safety

The first release should target local, development, preview, and staging systems.

Production QA requires:

- explicit environment classification.
- stronger confirmation.
- read-only default.
- action restrictions.
- test-account policy.
- data cleanup.
- audit visibility.
- optional administrator approval.

## 14. API and service changes

## 14.1 Existing services to extend

### Auth API

Add:

- Desktop device authorization.
- Device list/revocation.
- PKCE or loopback/deep-link sign-in completion.
- Device-bound refresh session metadata.

### Onboarding API

Add:

- Project workspace registration.
- Desktop permission metadata.
- repository snapshot summaries.
- document metadata and upload intents.
- desktop onboarding state.

### FDRS API

Add:

- document/repository/hybrid AI draft sources.
- provenance and conflict endpoints.
- bulk graph proposal review.
- draft version comparison.
- source-to-state evidence links.

### Event collector

Add:

- Run ID and desktop agent metadata.
- browser-evidence event types.
- stronger idempotency for offline/resumed upload.

### Session engine

Add:

- browser trace/screenshot associations.
- richer correlation.
- artifact manifests.

### Report engine

Add report sections for:

- repository understanding.
- instrumentation changes.
- visual findings.
- accessibility findings.
- browser/runtime findings.
- evidence provenance.
- agent actions and validation.

### Usage tracker and billing

Potential new usage dimensions must not be introduced casually. Product packaging must explicitly decide whether to limit:

- AI document processing.
- repository scans.
- browser run minutes.
- artifact storage.
- retained traces/videos.

## 14.2 Recommended new cloud service

Create a dedicated **project-intelligence service** for:

- document extraction orchestration.
- repository summary ingestion.
- cross-source evidence synthesis.
- conflict detection.
- draft generation jobs.

Do not place file parsing and large asynchronous analysis directly into the existing synchronous onboarding routes.

## 14.3 Local-only responsibilities

Keep these out of the cloud:

- Raw unrestricted filesystem access.
- Arbitrary local command execution.
- application process control.
- browser process control.
- local Git credentials.
- unredacted secret files.

## 15. Data and event contract evolution

Maintain backward compatibility with existing SDK events while adding:

```text
QA_RUN_STARTED
QA_RUN_COMPLETED
QA_RUN_FAILED
BROWSER_PAGE_LOADED
BROWSER_CONSOLE_ERROR
BROWSER_NETWORK_FAILED
VISUAL_ASSERTION_FAILED
ACCESSIBILITY_FINDING
INSTRUMENTATION_VERIFIED
REPOSITORY_SNAPSHOT_CREATED
EXPECTED_FLOW_VERSION_SELECTED
```

Every event should support:

- `organizationId`
- `applicationId`
- `environmentId`
- `runId`
- `sessionId`
- `traceId`
- `source`
- `timestamp`
- privacy classification
- artifact references where applicable

## 16. Rollout plan

The following estimates assume a focused team of approximately:

- 2 desktop/platform engineers.
- 2 full-stack/backend engineers.
- 1 browser automation/QA engineer.
- 1 AI/code-intelligence engineer.
- shared product design, security, and DevOps support.

They are planning ranges, not commitments.

## Phase 0: Architecture and threat-model prototype

**Estimated duration: 3-5 weeks**

Deliver:

- Electron proof of concept.
- Desktop authentication.
- open-folder flow.
- read-only repository scan.
- managed Playwright browser.
- one QA run uploaded to the existing application.
- formal threat model.

Exit criteria:

- No unrestricted renderer access.
- Local policy engine demonstrated.
- One existing report can identify a desktop-originated run.

## Phase 1: Browser-first desktop MVP

**Estimated duration: 6-9 additional weeks**

Deliver:

- Signed Windows development build.
- Project and URL modes.
- managed browser.
- console/network/screenshot/trace capture.
- manual guided demonstration.
- existing SDK telemetry correlation when already installed.
- QA run entity and report extensions.

Why browser-first:

It creates user value before automatic code modification is trusted.

## Phase 2: Documentation-to-flow generation

**Estimated duration: 6-8 additional weeks, partly parallel**

Deliver:

- PDF, DOCX, Markdown, text, HTML, and OpenAPI ingestion.
- secure storage and extraction.
- document-derived flow drafts.
- source citations.
- conflict detection.
- feature-level bulk review.
- conversion into declared graph versions.

This phase removes much of the manual declaration burden without yet changing source code.

## Phase 3: Automated integration for supported stacks

**Estimated duration: 8-12 additional weeks**

Deliver:

- React/Vite and Next.js frontend adapters.
- Express/Fastify/NestJS backend adapters.
- AST-based SDK installation.
- checkpoint proposals.
- diff approval.
- Git checkpoint and rollback.
- package-manager integration.
- build/type/test validation.
- automatic installation verification.

Exit criteria:

- High success rate across a curated compatibility matrix.
- No loss of unrelated dirty-worktree changes.
- Deterministic rollback.

## Phase 4: Agent-assisted execution and remediation

**Estimated duration: 8-12 additional weeks**

Deliver:

- Flow execution plans.
- test credential profiles.
- approval pauses.
- accessibility analysis.
- responsive visual checks.
- evidence-backed code-fix proposals.
- targeted rerun.

## Phase 5: Enterprise hardening

**Estimated duration: 8-16 additional weeks**

Deliver:

- macOS and Windows signing/notarization.
- updater.
- device governance.
- proxy/certificate support.
- SSO considerations.
- offline/resumable operation.
- admin policies.
- retention and data residency.
- penetration test.
- supply-chain review.

### Overall estimate

A useful browser-first desktop MVP is realistic in approximately **2-4 months**. A dependable multi-framework agentic product with document inference, safe code modification, and assisted execution is more realistically a **6-12 month program**.

## 17. Recommended scope for the first marketable release

Include:

- Windows desktop application.
- Existing Tellann authentication.
- Open local React/Next.js project.
- Read-only project understanding.
- Documentation upload.
- Inferred flows with citations.
- User verification and bulk editing.
- Managed Chromium browser.
- Guided manual demonstration.
- Browser console, network, screenshot, accessibility, and SDK evidence.
- Existing reconciliation and report pipeline.
- Optional approved SDK installation for one frontend stack.

Exclude initially:

- Arbitrary-language repositories.
- Full autonomous application exploration.
- Production mutation.
- Existing personal browser takeover.
- Automatic fixes without diff approval.
- Mobile/native application testing.
- Arbitrary shell access.
- Invisible source-code upload.

## 18. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Agent damages user code | Critical | Diff approval, base revision checks, AST edits, checkpoint, targeted rollback |
| Repository executes malicious scripts | Critical | Read-only trust phase, explicit command approval, sandbox/process limits |
| Source or secrets leave device | Critical | Local-first indexing, derived summaries, secret scanning, upload manifest |
| Desktop renderer compromise | Critical | Sandboxed local renderer, context isolation, narrow IPC, CSP |
| AI hallucinates expected behavior | High | Provenance, confidence, graph validation, human acceptance |
| Documentation conflicts with source | High | Conflict cards, never silently select truth |
| Browser agent changes real data | High | Environment classification, action policy, staged rollout, approvals |
| Automatic instrumentation is noisy | High | Semantic checkpoint policy, adapter tests, user review |
| Framework versions vary | High | Adapter compatibility matrix, detection, fallback to guided integration |
| Reports overstate certainty | High | Evidence classes, confidence, source labels, explicit unverified findings |
| Desktop updates introduce supply-chain risk | High | Signed builds, signed updates, controlled release channels, SBOM |
| Artifact storage becomes expensive | Medium | Quotas, retention, compression, selective capture |
| Desktop and cloud state drift | Medium | Run manifests, idempotent sync, resumable uploads, versioned contracts |

## 19. Success metrics

The redesign succeeds if it reduces time and expertise required to reach the first credible report.

### Activation

- Median time from sign-in to first observed run.
- Percentage of users completing setup without developer assistance.
- Percentage of imported projects successfully understood.
- Percentage of installations verified on first attempt.

### Flow quality

- Percentage of inferred workflows accepted unchanged.
- Percentage accepted after edits.
- Average time spent reviewing a feature.
- Number of documentation/source conflicts surfaced.
- State-name mismatch rate between declared and observed graphs.

### Agent reliability

- Patch application success rate.
- Build/test validation success rate.
- rollback success rate.
- projects requiring manual integration.
- unsafe command or path attempts blocked.

### QA value

- Evidence-backed findings per run.
- confirmed finding rate.
- false-positive dismissal rate.
- time from finding to verified rerun.
- coverage improvement between runs.

### Trust

- Permission abandonment rate.
- source-upload opt-in rate.
- number of security/privacy incidents.
- rate of users inspecting diffs before approval.

## 20. Required proof before public release

### Security

- Desktop threat model reviewed.
- IPC surface tested.
- path traversal and symlink tests.
- command injection tests.
- prompt-injection tests from source and documents.
- secret leakage tests.
- token storage review.
- penetration test.

### Code modification

- Dirty-worktree preservation.
- idempotent instrumentation.
- repeat-run behavior.
- rollback.
- framework-version matrix.
- dependency-manager matrix.
- build/test failure recovery.

### Browser

- popup and multi-tab flows.
- downloads and uploads.
- permissions.
- responsive viewports.
- authentication and MFA pauses.
- console/network correlation.
- screenshot redaction.
- trace retention.

### Intelligence

- document extraction accuracy.
- provenance completeness.
- conflict detection.
- graph schema validation.
- role-specific flow inference.
- hallucination and unsupported-assumption review.

### Cloud

- organization isolation.
- device revocation.
- resumable artifact upload.
- entitlement enforcement.
- storage quota.
- retention deletion.
- audit completeness.

## 21. Recommended architectural decisions

1. **Keep the cloud platform.**
2. **Add a desktop execution agent instead of wrapping the existing dashboard URL.**
3. **Use Electron for the first implementation, with strict process isolation.**
4. **Use a managed Playwright Chromium browser initially.**
5. **Make documentation and repository inference the default declaration path.**
6. **Keep manual graph editing as an advanced fallback.**
7. **Keep AI output as a proposal until validated and accepted.**
8. **Use framework adapters and AST transforms for code changes.**
9. **Require diff approval and reversible checkpoints.**
10. **Start with read-only and browser-first capabilities before autonomous modification.**
11. **Use local-first repository processing and upload derived evidence by default.**
12. **Create an explicit QA Run model to unify browser, SDK, graph, and report evidence.**

## 22. Final feasibility verdict

The concept is feasible and would materially improve Tellann's value proposition.

The current system is not wasted work. Its cloud services form the analysis and collaboration backbone needed by the desktop product. In particular, the existing AI draft lifecycle, ruleset engine, graph validation, suggestions, reconciliation, storage, session, and reporting capabilities significantly reduce the work required.

The difficult work is concentrated in four new areas:

1. A secure local authority and permission model.
2. Reliable framework-specific repository understanding and code transformation.
3. Managed browser observation with unified evidence correlation.
4. Documentation ingestion with provenance-aware flow inference.

The product should therefore be repositioned from:

```text
Configure Tellann manually, declare a graph, install an SDK, and demonstrate.
```

to:

```text
Open your project, show Tellann what the product should do, approve its plan,
and let it instrument, observe, compare, and report.
```

That is a credible route to making advanced QA accessible to non-developers while preserving user control, evidence quality, and system safety.
