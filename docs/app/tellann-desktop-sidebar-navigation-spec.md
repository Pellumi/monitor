# Tellann Desktop Sidebar and Navigation Specification

**Document status:** Proposed implementation specification  
**Target:** Tellann Windows desktop application  
**Scope:** Applications, Intent, Instrumentation, QA Runs, Reports, workspace status, run status  
**Source context:** Tellann Agentic Desktop Upgrade Implementation Plan

---

## 1. Purpose

This document defines exactly where every item in the Tellann desktop sidebar must lead, what each destination must contain, how it behaves when prerequisites are missing, and how the desktop experience differs from the Tellann web companion.

The central rule is simple:

> Every visible navigation item must resolve to a real route and produce an understandable screen state. A click must never appear to do nothing.

The desktop application is an execution environment. It owns local workspace access, repository scanning, managed-browser runs, instrumentation operations, local permissions, and local artifact preparation. The cloud remains authoritative for organizations, applications, entitlements, accepted graphs, reconciliation, reports, billing, audit, and collaboration.

---

## 2. Navigation principles

### 2.1 Route-driven navigation

The sidebar must use URL-backed routes rather than only local component state. This ensures:

- Clicking a navigation item changes the route.
- Browser history and Electron navigation history work.
- Refreshing the renderer restores the current page.
- Deep links can reopen a specific project, run, report, or instrumentation task.
- The selected project is explicit rather than hidden in transient state.
- The active sidebar item is derived from the current pathname.

### 2.2 Project-scoped destinations

`Intent`, `Instrumentation`, `QA Runs`, and `Reports` are project-scoped. Their canonical routes must contain a project identifier.

A project in the desktop UI is an aggregate of:

- A cloud `Application`.
- A local `ProjectWorkspace`, when a folder is attached.
- One or more environments.
- The latest `RepositorySnapshot`.
- Attached source documents.
- Accepted intent or declared-graph versions.
- Instrumentation manifests.
- QA runs and reports.

The desktop label for this aggregate is **Applications**, matching the cloud `Application` and the web dashboard. Do not introduce a second cloud entity for it — the aggregate is a presentation of one `Application`, not a separate record.

### 2.3 No silent disabled states

When a destination cannot yet be used, the page must still open and explain why.

Examples:

- No project selected → show a project-selection screen.
- No local folder attached → explain that browser-only URL mode remains available.
- Workspace not scanned → show **Analyze workspace**.
- Feature not included in the plan → show the entitlement and upgrade path.
- Feature not delivered in the current release → show its release state and the usable fallback.
- Production environment selected → explain observation-only restrictions.
- User lacks permission → show the required permission and who can grant it.
- Cloud is offline → show locally available data and queued synchronization state.

### 2.4 Desktop focus

The main desktop sidebar should remain execution-focused:

1. Applications
2. Intent
3. Instrumentation
4. QA Runs
5. Reports

Organization members, billing, audit administration, SSO, and most account settings should remain in the web companion. The desktop account menu may contain **Open web dashboard**, **Devices & security**, **Check for updates**, and **Sign out**, but these do not need to become primary sidebar destinations.

---

## 3. Canonical route map

```text
/applications
/applications/new
/applications/:projectId
/applications/:projectId/workspace
/applications/:projectId/sources
/applications/:projectId/environments
/applications/:projectId/activity

/applications/:projectId/intent
/applications/:projectId/intent/drafts/:draftId
/applications/:projectId/intent/versions
/applications/:projectId/intent/versions/:versionId
/applications/:projectId/intent/compare
/applications/:projectId/intent/editor

/applications/:projectId/instrumentation
/applications/:projectId/instrumentation/plans/:planId
/applications/:projectId/instrumentation/plans/:planId/diff
/applications/:projectId/instrumentation/plans/:planId/validation
/applications/:projectId/instrumentation/history
/applications/:projectId/instrumentation/manifests/:manifestId

/applications/:projectId/qa-runs
/applications/:projectId/qa-runs/new
/applications/:projectId/qa-runs/:runId
/applications/:projectId/qa-runs/:runId/live
/applications/:projectId/qa-runs/:runId/evidence
/applications/:projectId/qa-runs/:runId/findings
/applications/:projectId/qa-runs/:runId/replay
/applications/:projectId/qa-runs/:runId/graph
/applications/:projectId/qa-runs/:runId/reconciliation
/applications/:projectId/qa-runs/:runId/artifacts

/applications/:projectId/reports
/applications/:projectId/reports/:reportId
/applications/:projectId/reports/compare
/applications/:projectId/reports/:reportId/export
```

Optional unscoped aliases may exist only as route resolvers:

```text
/intent
/instrumentation
/qa-runs
/reports
```

Each alias must resolve to the last selected project or redirect to:

```text
/applications?next=<requested-section>
```

The user’s intended destination must be preserved after project selection.

---

## 4. Sidebar route behavior

| Sidebar item | Primary destination | Scope | Always clickable | Main responsibility |
|---|---|---:|---:|---|
| Applications | `/applications` | Organization/device | Yes | Create, select, attach, scan, and manage applications |
| Intent | `/applications/:projectId/intent` | Project | Yes | Define and review expected application behavior |
| Instrumentation | `/applications/:projectId/instrumentation` | Project/workspace | Yes | Inspect, plan, apply, verify, and roll back Tellann instrumentation |
| QA Runs | `/applications/:projectId/qa-runs` | Project | Yes | Create, control, inspect, and compare guided QA runs |
| Reports | `/applications/:projectId/reports` | Project | Yes | View canonical quality reports and run comparisons |

When no project is selected, project-scoped links should resolve to the project picker with the intended section retained. They must not be inert.

---

# 5. Applications

## 5.1 Destination

**Sidebar route:** `/applications`

## 5.2 Purpose

Applications is the desktop entry point. It creates a Tellann cloud application and connects it to a local repository, a staging URL, or both. Creation posts to the same `POST /organizations/:orgId/applications` endpoint the web dashboard uses, so plan limits, role checks and the APP_CREATED broadcast behave identically on both surfaces.

It answers:

- What application am I working on?
- Which local workspace is attached?
- Which environments can Tellann observe or control?
- Has the workspace been analyzed?
- What stack was detected?
- Are local permissions sufficient?
- Is the repository snapshot current?
- What should I do next?

## 5.3 Applications list page

The page should display cards or rows containing:

- Project/application name.
- Organization.
- Attached workspace name, never the absolute local path in cloud-derived UI.
- Environment badges.
- Detected framework and package manager.
- Current branch and dirty-state indicator.
- Workspace trust state.
- Last analyzed time.
- Intent state:
  - No intent.
  - Draft available.
  - Accepted.
  - Changes detected.
  - Conflicts unresolved.
- Instrumentation state:
  - Browser-only.
  - Manual SDK.
  - Plan pending.
  - Applied.
  - Validation failed.
  - Update available.
- Latest QA run and status.
- Latest report summary.
- Local-only or synchronized status.

Primary actions:

- **Open project**
- **Create project**
- **Attach local folder**
- **Attach staging URL**
- **Resume active run**
- **Analyze workspace**
- **Open latest report**

Filters:

- Organization.
- Environment.
- Framework.
- Workspace status.
- Last activity.
- Archived status.

## 5.4 Create project flow

**Route:** `/applications/new`

Wizard:

### Step 1 — Cloud application

- Select an existing Tellann application.
- Or create a new application.
- Select the organization.
- Confirm entitlement and application limits.

### Step 2 — Working mode

Choose one or more:

- Open local project folder.
- Clone repository.
- Attach development URL.
- Attach preview/staging URL.
- Continue in browser-only mode.

No repository command should run during folder selection.

### Step 3 — Environment

Select:

- Development.
- Preview, represented through the staging policy where required.
- Staging.
- Production observation-only.

The UI must visibly explain that production cannot be launched, instrumented, or actively manipulated.

### Step 4 — Local permission

Request only what is needed:

- Browser-only.
- Read workspace.

Write, command, and instrumentation permissions are not requested during first attachment.

### Step 5 — Read-only analysis

Analyze:

- Git state.
- Package managers.
- Languages and frameworks.
- Entry points.
- Scripts.
- Routes.
- Endpoints.
- controllers and middleware.
- schemas and state models.
- tests.
- repository documentation.

Do not execute repository scripts.

### Step 6 — Optional sources

Attach supported local documents:

- PDF.
- DOCX.
- Markdown.
- Text.
- HTML.
- OpenAPI JSON or YAML.

### Step 7 — Ready

Show:

- What was detected.
- What remains local.
- What derived information may be synchronized.
- Current permission scope.
- Recommended next step:
  - Review Intent.
  - Start browser-only QA run.
  - Prepare instrumentation.

## 5.5 Project overview

**Route:** `/applications/:projectId`

Sections:

- Readiness summary.
- Application and environment.
- Workspace health.
- Repository snapshot.
- Intent readiness.
- Instrumentation status.
- Recent QA runs.
- Latest findings.
- Latest report.
- Storage and synchronization status.
- Recommended next action.

This is the preferred landing page after selecting a project.

## 5.6 Workspace page

**Route:** `/applications/:projectId/workspace`

Contains:

- Local workspace identity.
- Repository root display, local-only.
- Git branch, revision, worktree, dirty files.
- Detected frameworks and confidence.
- Package manager.
- launch commands detected but not executed.
- Supported adapter status.
- Excluded paths.
- Current permission grants.
- Snapshot hash and scanner version.
- Last scan.
- Scan warnings.
- Redaction summary.
- **Rescan**, **Change folder**, **Revoke access**, and **Review exclusions**.

## 5.7 Sources page

**Route:** `/applications/:projectId/sources`

Contains:

- Repository documentation.
- Uploaded/attached product documents.
- Product description.
- OpenAPI sources.
- Source versions.
- Processing status.
- Redaction status.
- Approval scope:
  - Derived summary only.
  - Evidence excerpts.
  - Explicit full-file upload.
- Source conflicts.
- Affected intent workflows.

## 5.8 Environments page

**Route:** `/applications/:projectId/environments`

Contains:

- Development URLs and launch configuration.
- Staging/preview URLs.
- Production observation-only URLs.
- Allowed application origins.
- Correlation-header origin allowlist.
- Browser permissions.
- Authentication and sensitive-action policy.
- Artifact capture policy per environment.

## 5.9 Project empty and error states

- No projects → explain the two fastest paths: local folder or staging URL.
- Folder missing → allow relink without deleting cloud history.
- Workspace moved → detect fingerprint mismatch and request confirmation.
- Scan failed → show exact scanner stage and retry.
- Unsupported framework → preserve browser-only and document modes.
- Cloud application deleted → offer detach/archive; never silently remap.
- Permission revoked → show which local features are unavailable.
- Snapshot stale → prevent stale instrumentation plans but allow browsing prior reports.

---

# 6. Intent

## 6.1 Destination

**Sidebar route:** `/applications/:projectId/intent`

## 6.2 Product meaning

Intent is Tellann’s model of **expected behavior**. The term is product-relevant but abstract, so the page heading should be:

> **Intent**  
> Expected workflows, states, transitions, failures, and recovery paths.

Intent is not the observed graph. It is the reviewed, accepted expectation against which a QA run is reconciled.

## 6.3 Intent overview

The page should show:

- Current accepted declared-graph version.
- Source provenance:
  - User-authored.
  - Documentation-inferred.
  - Repository-inferred.
  - Hybrid.
- Pending draft count.
- Detected source changes.
- Workflow count.
- State and transition count.
- Confidence summary.
- Conflict count.
- Unresolved question count.
- Last accepted by and timestamp.
- Runs using this version.
- Whether a newer draft exists.

Primary actions:

- **Generate draft**
- **Review draft**
- **Add source**
- **Describe expected behavior**
- **Compare with accepted version**
- **Open advanced editor**
- **Create new version**

## 6.4 Default review experience

The default experience must not begin as a blank node canvas.

Use feature-grouped workflow cards containing:

- Workflow name.
- Actor or role.
- Preconditions.
- Entry state.
- Success path.
- Failure paths.
- Validation paths.
- Authorization paths.
- Empty states.
- Loading states.
- Cancellation paths.
- Recovery paths.
- Confidence.
- Evidence citations.
- Assumptions.
- Conflicts.
- Unresolved questions.

Review actions:

- Accept workflow.
- Accept selected branches.
- Reject.
- Defer.
- Rename.
- Merge.
- Split.
- Correct using natural language.
- Edit evidence mapping.
- Open detailed graph view.

## 6.5 Draft detail

**Route:** `/applications/:projectId/intent/drafts/:draftId`

Tabs:

1. **Overview**
2. **Workflows**
3. **Evidence**
4. **Conflicts**
5. **Questions**
6. **Changes**
7. **Validation**

A draft may never silently become canonical. Acceptance creates an immutable declared-graph version.

## 6.6 Versions

**Route:** `/applications/:projectId/intent/versions`

List:

- Version number.
- Provenance.
- Created by.
- Accepted by.
- Source snapshot versions.
- Workflow/state/transition counts.
- Runs that used the version.
- Superseded status.
- Diff from previous version.

Version detail:

**Route:** `/applications/:projectId/intent/versions/:versionId`

Contains:

- Read-only graph.
- Workflow inventory.
- Evidence provenance.
- Accepted assumptions.
- Resolved and unresolved conflicts.
- Scanner/parser/model/ruleset versions.
- Run usage history.

## 6.7 Compare

**Route:** `/applications/:projectId/intent/compare`

Comparisons:

- Draft against accepted version.
- Accepted version against newer repository snapshot.
- Accepted version against changed document set.
- Version against version.

Diff categories:

- Added workflow.
- Removed workflow.
- Changed precondition.
- Added state.
- Removed state.
- Changed transition.
- Changed failure/recovery path.
- Evidence changed.
- Confidence changed.
- Source conflict introduced or resolved.

## 6.8 Advanced editor

**Route:** `/applications/:projectId/intent/editor`

The advanced graph editor supports detailed manipulation but is not the default onboarding experience.

It must preserve:

- Stable node identifiers.
- Transition source and destination.
- Triggering actions.
- Evidence links.
- Validation rules.
- Version history.
- Draft status until acceptance.

The desktop may deep-link to the web graph editor during an earlier delivery phase, provided the accepted graph remains cloud-authoritative.

## 6.9 Intent phase behavior

### Browser-first release

Available:

- Select an existing accepted graph.
- View current expected workflow.
- Add product description.
- View repository summary.
- Use existing manual graph as a fallback.
- Run without accepted intent, marked **observational run**, when allowed.

### Documentation-intelligence release

Add:

- Local document extraction.
- Hybrid drafts.
- Evidence citations.
- Conflict cards.
- Feature-level acceptance.
- Incremental diffs.

### Later instrumentation releases

Add:

- Semantic checkpoints mapped to accepted intent.
- Adapter proposals informed by expected workflows.
- Manifest-to-intent traceability.

## 6.10 Intent empty and guarded states

- No project → select project.
- No source → attach source or describe behavior.
- No accepted version → permit draft review or clearly labeled observational run.
- Draft processing → show job stages.
- Conflicting sources → require explicit resolution; never silently merge.
- Stale repository snapshot → show affected workflows.
- Plan lacks document inference → keep manual and existing graph paths usable.
- User cannot accept graph → permit review/comment but require authorized approval.

---

# 7. Instrumentation

## 7.1 Destination

**Sidebar route:** `/applications/:projectId/instrumentation`

## 7.2 Purpose

Instrumentation manages how Tellann adds semantic observation to an application. It does not repair product behavior and it must never disguise itself as a general code-fixing agent.

It answers:

- Is browser-only capture sufficient?
- Is an SDK already installed?
- Which frameworks and versions were detected?
- Which adapter is available?
- What files would Tellann modify?
- What commands are required?
- What semantic checkpoints would be added?
- Has the change been validated?
- Can it be rolled back safely?

## 7.3 Instrumentation overview

Display three modes:

### Browser-only

- No source mutation.
- Managed browser evidence.
- Console, network, visual, accessibility, and navigation capture.
- Available to all guided-run entitlements.

### Manual integration

- Existing SDK and ingestion-key path.
- Installation instructions.
- SDK health.
- Event validation.
- Link to advanced/legacy web integration management.

### Automated instrumentation

- Framework adapter detection.
- Proposed task.
- File scope.
- command scope.
- Git/local checkpoint.
- validation.
- rollback.

Show:

- Detected frontend/backend stacks.
- Adapter support and confidence.
- Current instrumentation manifest.
- SDK package versions.
- Relay status.
- Last verification.
- Detected duplicate/partial installation.
- Pending plan.
- Applied task history.
- Validation failures.

## 7.4 Create instrumentation plan

Primary action: **Prepare instrumentation plan**

The plan must include:

- Framework and version evidence.
- Adapter identifier and version.
- SDK packages.
- Files and symbols to modify.
- Proposed semantic checkpoints.
- Expected event/state mappings.
- Commands.
- Network requirements.
- Risk classification.
- Validation commands.
- Rollback method.
- Base revision and target file hashes.
- User-approved scope.

Preparing a plan requires no write access.

## 7.5 Plan detail

**Route:** `/applications/:projectId/instrumentation/plans/:planId`

Tabs:

1. Summary.
2. Evidence.
3. File scope.
4. Semantic checkpoints.
5. Commands.
6. Risks.
7. Validation.
8. Rollback.

Actions:

- Approve task.
- Edit allowed file scope.
- Reject.
- Regenerate from new snapshot.
- Export plan.
- Request reviewer approval, Team and above.
- Apply task, only after authorization.

## 7.6 Diff review

**Route:** `/applications/:projectId/instrumentation/plans/:planId/diff`

Display:

- Changed files.
- Tellann-authored hunks.
- Package changes.
- Configuration changes.
- Provider/middleware insertion.
- Semantic checkpoint insertion.
- Generated manifest.
- Unrelated dirty-file warning.
- Stale-plan warning.

Whole-file replacement should be called out as high risk and generally rejected when a bounded transform is available.

## 7.7 Application and validation

After approval:

1. Revalidate base revision and file hashes.
2. Create Git branch or local checkpoint.
3. Apply bounded transformations.
4. Install dependencies with the detected package manager.
5. Run approved structured commands.
6. Perform syntax/type/build checks.
7. Verify SDK initialization and event protocol.
8. Check idempotency.
9. Present the final diff.
10. Allow accept or rollback.

**Validation route:**  
`/applications/:projectId/instrumentation/plans/:planId/validation`

Display each check separately:

- Status.
- command.
- start/end time.
- exit code.
- redacted logs.
- failure explanation.
- whether Tellann may retry inside scope.

## 7.8 History

**Route:** `/applications/:projectId/instrumentation/history`

Contains:

- Plans.
- Applied tasks.
- Rejected tasks.
- Rollbacks.
- Manifest versions.
- Adapter versions.
- Approvers.
- validation results.
- affected runs.
- audit references.

## 7.9 Production policy

For a production environment:

- Disable **Apply task**.
- Disable process launch.
- Disable automated interaction.
- Disable form submission.
- Allow explicitly approved observation-only browser attachment.
- Mark all production evidence clearly.
- Enforce this in both the renderer and cloud authorization.

A hidden button is insufficient. The page should explain the policy.

## 7.10 Unsupported stacks

Unsupported stacks must not produce a dead end.

Show:

- Browser-only mode available.
- Document-derived intent available when entitled.
- Manual integration status.
- Adapter roadmap state.
- Ability to export a non-mutating instrumentation proposal.
- No claim that automated application is supported.

## 7.11 Instrumentation release behavior

### Phase 1

The page exists and contains:

- Browser-only status.
- Detected stack.
- Repository summary.
- Manual SDK status.
- A clear statement that no source mutation is needed for guided runs.

### Phase 2

Add:

- Intent-aware semantic checkpoint suggestions.
- Documentation/repository evidence mapping.
- Non-mutating proposals.

### Phase 3

Enable:

- React/Vite.
- Next.js.
- Express.
- Fastify.
- NestJS.
- Apply/validate/rollback workflow.
- Local relay.
- installation verification.

Later phases add Python, PHP, .NET, and Java adapters.

---

# 8. QA Runs

## 8.1 Destination

**Sidebar route:** `/applications/:projectId/qa-runs`

## 8.2 Purpose

QA Runs is the operational heart of the desktop application.

It owns:

- Run creation.
- Environment policy.
- Managed Chromium.
- Guided execution.
- run/session/trace correlation.
- local evidence capture.
- privacy indicators.
- active-run controls.
- artifact synchronization.
- run processing state.
- run history and comparison.

## 8.3 QA run list

Display:

- Run name or identifier.
- Mode:
  - Guided.
  - Exploratory.
  - Validation.
  - Observation-only.
- Environment.
- Expected intent version.
- Repository snapshot.
- Instrumentation manifest.
- Started by.
- Device.
- Start/end time.
- Status.
- Duration.
- Workflow count.
- Finding counts by severity.
- Report status.
- Synchronization state.
- Retry lineage.

Filters:

- Status.
- Mode.
- Environment.
- Expected version.
- branch/revision.
- creator.
- date.
- severity.
- report readiness.

Primary actions:

- **New QA run**
- **Resume active run**
- **Open latest run**
- **Compare runs**

## 8.4 New QA run wizard

**Route:** `/applications/:projectId/qa-runs/new`

### Step 1 — Project and environment

Confirm application, workspace, and environment.

Rules:

- Development and staging permit active guided control.
- Production permits observation-only attachment.

### Step 2 — Application source

Choose:

- Launch local application.
- Attach to running local application.
- Open staging URL.
- Attach observation-only production URL.

Launching a local process requires separately approved structured commands.

### Step 3 — Repository snapshot

Show:

- Revision.
- branch.
- dirty state.
- snapshot age.
- detected stack.

A run may continue without a repository when using URL-only mode.

### Step 4 — Expected behavior

Choose:

- Current accepted intent version.
- Another immutable version.
- No expected graph, labeled **Observational run**.

The selected version becomes immutable run metadata.

### Step 5 — Instrumentation

Choose:

- Browser-only.
- Existing instrumentation manifest.
- Verified automated instrumentation.

A failed or stale instrumentation task cannot be silently selected.

### Step 6 — Browser configuration

Configure:

- Viewport.
- locale.
- timezone.
- color scheme.
- permissions.
- origin allowlist.
- authentication pause behavior.

### Step 7 — Privacy and artifacts

Choose according to entitlement and policy:

- Screenshots.
- DOM snapshots.
- accessibility snapshots.
- console.
- network.
- trace.
- approved uploads/download metadata.

Display retention and privacy classification before starting.

### Step 8 — Review and start

Show all permissions and restrictions in one final summary.

## 8.5 Active run page

**Route:** `/applications/:projectId/qa-runs/:runId/live`

Recommended layout:

### Left panel — Expected flow

- Selected workflow.
- Current expected state.
- observed matching state.
- completed branches.
- remaining branches.
- conflicts or ambiguity.
- switch workflow.
- mark step intentionally skipped.

### Center — Managed browser

- Dedicated Playwright Chromium context.
- No personal browser profile.
- visible capture boundary.
- viewport controls.
- URL/origin status.

### Right panel — Live evidence

- Current run status.
- event count.
- session/trace identifiers.
- console errors.
- failed requests.
- slow requests.
- accessibility alerts.
- screenshots captured.
- privacy redactions.
- artifact queue.

### Run controls

- Pause.
- Resume.
- End run.
- Mark workflow complete.
- Add note.
- Capture screenshot.
- Confirm sensitive action.
- Abort and retain partial evidence.

Tellann must not autonomously click through the application in v1.

## 8.6 Sensitive action confirmations

Require explicit confirmation for:

- Authentication.
- File uploads.
- Downloads.
- External navigation.
- Data mutation.
- Destructive actions.
- Submission of production forms.
- Any action outside configured origins.

Production form submission remains blocked even after a generic confirmation.

## 8.7 Run detail

**Route:** `/applications/:projectId/qa-runs/:runId`

Summary:

- Run metadata.
- Environment.
- repository snapshot.
- expected version.
- instrumentation manifest.
- status timeline.
- observed sessions.
- observed graph.
- finding summary.
- artifact summary.
- reconciliation status.
- report status.
- failure reason.
- retry lineage.

## 8.8 Evidence

**Route:** `/applications/:projectId/qa-runs/:runId/evidence`

Categories:

- Browser navigation.
- Console.
- Network.
- runtime errors.
- screenshots.
- DOM snapshots.
- accessibility snapshots.
- SDK events.
- API events.
- semantic checkpoints.
- user notes.

Every item must expose:

- `runId`.
- `sessionId`.
- `traceId`.
- source.
- timestamp.
- environment.
- expected graph version.
- privacy classification.

## 8.9 Findings

**Route:** `/applications/:projectId/qa-runs/:runId/findings`

Finding categories:

- Render failure.
- Broken navigation.
- Console/runtime error.
- Failed request.
- Slow request.
- invisible/clipped/overlapping element.
- responsive overflow.
- missing accessible name or label.
- keyboard/focus issue.
- missing loading/error/empty feedback.
- expected outcome not visibly confirmed.
- semantic event inconsistent with rendered result.
- expected state or transition not reached.
- undeclared observed behavior.

Finding detail:

- Severity.
- confidence.
- URL.
- viewport.
- reproduction sequence.
- workflow/state.
- evidence references.
- recommended developer action.
- status:
  - Open.
  - Accepted.
  - Dismissed.
  - Duplicate.
  - Deferred.
- assignee and reviewer, where entitled.

Tellann may recommend a product fix but must not apply it.

## 8.10 Replay

**Route:** `/applications/:projectId/qa-runs/:runId/replay`

Provide:

- Event timeline.
- browser state timeline.
- workflow markers.
- console/network overlays.
- screenshot/DOM points.
- play, pause, seek, speed.
- jump to finding.
- jump to state transition.
- privacy and completeness indicators.

## 8.11 Observed graph

**Route:** `/applications/:projectId/qa-runs/:runId/graph`

Show:

- States.
- transitions.
- actions.
- workflows.
- entry and exit points.
- evidence counts.
- confidence.
- undeclared behavior.
- links back to replay and evidence.

Do not confuse this with Intent. This is what Tellann observed during the run.

## 8.12 Reconciliation

**Route:** `/applications/:projectId/qa-runs/:runId/reconciliation`

Compare expected intent with observed behavior:

- Matched states.
- matched transitions.
- expected but not observed.
- observed but undeclared.
- mismatched outcomes.
- partial paths.
- missing evidence.
- confidence.
- coverage.
- selected intent version.

## 8.13 Run statuses

Use a clear state machine:

```text
DRAFT
PREPARING
WAITING_FOR_PERMISSION
READY
RUNNING
PAUSED
ENDING
UPLOADING
PROCESSING
RECONCILING
REPORTING
COMPLETED
FAILED
CANCELLED
PARTIAL
```

The UI should distinguish local execution status from cloud processing status.

---

# 9. Reports

## 9.1 Destination

**Sidebar route:** `/applications/:projectId/reports`

## 9.2 Purpose

Reports translates run evidence into canonical quality intelligence. Desktop and web must render the same report contract.

The desktop focuses on immediate review after a run. The web companion adds broader collaboration, administration, long-term history, and sharing.

## 9.3 Report list

Display:

- Report title/type.
- Source QA run.
- Environment.
- expected intent version.
- repository snapshot.
- instrumentation manifest.
- generated time.
- status.
- quality/coverage summary.
- finding counts.
- export availability.
- retention date.
- comparison availability.

Filters:

- Report type.
- environment.
- run mode.
- version.
- date.
- severity.
- status.
- creator.

Primary actions:

- Open.
- Compare.
- Export.
- Open in web.
- Regenerate, when the underlying contract permits it.
- Delete, subject to policy and permission.

## 9.4 Report detail

**Route:** `/applications/:projectId/reports/:reportId`

Sections:

1. Executive summary.
2. Expected intent and evidence provenance.
3. Repository/document analysis summary.
4. Accepted assumptions.
5. Unresolved conflicts.
6. Instrumentation manifest and validation.
7. Browser/runtime evidence.
8. Accessibility and visual findings.
9. Expected-versus-observed coverage.
10. Missing states and paths.
11. Session/trace reproduction.
12. Endpoint intelligence.
13. Comparison with previous runs.
14. Recommended developer actions.
15. Data completeness, privacy, and confidence.

Every finding must link back to its run evidence.

## 9.5 Report comparison

**Route:** `/applications/:projectId/reports/compare`

Compare:

- Run against run.
- Report against report.
- branch/revision against branch/revision.
- intent version against intent version.
- instrumentation manifest against manifest.

Show deltas for:

- Coverage.
- workflows.
- states.
- transitions.
- findings.
- endpoint performance.
- accessibility issues.
- runtime errors.
- undeclared behavior.
- evidence completeness.

A comparison must never imply release regression unless the selected data supports that claim.

## 9.6 Export

**Route:** `/applications/:projectId/reports/:reportId/export`

Formats depend on entitlement and report contract:

- JSON.
- PDF.
- CSV.
- HTML.

The export screen must show:

- Included sections.
- redaction policy.
- privacy classification.
- retention implications.
- audit logging.
- destination.
- estimated size.

## 9.7 Report states

- Run still active → report unavailable, link to active run.
- Processing → show current stage.
- Partial evidence → show completeness warning.
- Failed generation → show retry and support details.
- Expired artifacts → preserve report metadata and explain missing evidence.
- Plan-gated export → allow report viewing; gate only the export capability.
- Offline → show cached report if available and synchronization state.

---

# 10. Sidebar footer status areas

The screenshot shows **Workspace** and **Run Status** blocks. These should be actionable navigation elements, not decorative labels.

## 10.1 Workspace status

Click destination:

```text
/applications/:projectId/workspace
```

States:

- Not selected.
- Folder not attached.
- Permission required.
- Ready to analyze.
- Scanning.
- Analyzed.
- Changes detected.
- Rescan required.
- Unsupported stack.
- Scan failed.
- Folder unavailable.
- Local-only.
- Sync pending.

Recommended display:

```text
WORKSPACE
Analyzed
React/Vite · main
```

or:

```text
WORKSPACE
Changes detected
Rescan required
```

The current wording **Not analyzed** should be clickable and lead directly to the workspace analysis action.

## 10.2 Run status

Click behavior:

- Active run exists → open `/applications/:projectId/qa-runs/:runId/live`.
- No active run → open `/applications/:projectId/qa-runs`.
- Run processing → open run detail.
- Run failed → open run detail at failure stage.

States:

- Ready.
- Preparing.
- Running.
- Paused.
- Uploading.
- Processing.
- Completed.
- Failed.
- Offline queue pending.

Recommended display:

```text
RUN STATUS
Running
Checkout · 06:42
```

or:

```text
RUN STATUS
Ready
No active run
```

## 10.3 Status colors and accessibility

Do not rely on color alone. Use:

- Icon.
- text label.
- optional progress value.
- accessible status announcement.

---

# 11. Plan and entitlement behavior

The renderer must not hardcode plan names as the authorization source. It must consume `DesktopEntitlements` from the cloud and use feature flags.

Required feature flags:

- `DESKTOP_GUIDED_RUNS`
- `DOCUMENT_FLOW_INFERENCE`
- `AUTOMATED_INSTRUMENTATION`
- `SHARED_RUN_GOVERNANCE`
- `BROWSER_TRACE_CAPTURE`
- `VISUAL_ACCESSIBILITY_ANALYSIS`

Suggested behavior:

| Capability | Free | Local | Solo | Team | Business/Enterprise |
|---|---:|---:|---:|---:|---:|
| Guided browser runs | Yes | Yes | Yes | Yes | Yes |
| Basic browser evidence | Yes | Yes | Yes | Yes | Yes |
| Document-derived intent | No | Yes | Yes | Yes | Yes |
| Automated instrumentation | No | No | Yes | Yes | Yes |
| Rich trace/visual analysis | Limited | Limited/configured | Yes | Yes | Yes |
| Shared run governance | No | No | No | Yes | Yes |
| Assignments/review | No | No | No | Yes | Yes |
| Audit/device policy | No | No | Limited | Limited | Yes |
| Longer retention/priority processing | No | No | Plan-based | Plan-based | Yes |

### Important packaging conflict

The desktop implementation plan introduces a **Local** plan, while the established commercial packaging uses **Free, Solo, Team, Business, Enterprise**.

This must be resolved before exposing plan names in the UI.

Safe implementation:

- Authorize by feature flags.
- Render the plan label returned by billing configuration.
- Do not write checks such as `plan === "LOCAL"` throughout the renderer.
- Until pricing is finalized, describe gating as **Available on plans with Document Flow Inference** rather than hardcoding “Local”.

---

# 12. Permission behavior

Permissions are separate from plan entitlements.

A user may be entitled to a capability but still lack local or organizational permission.

## 12.1 Permission levels

1. Browser-only.
2. Read workspace.
3. Propose instrumentation.
4. Apply approved task.
5. Run approved commands.
6. Confirm sensitive browser action.

## 12.2 Permission prompts

Each prompt must show:

- Requested capability.
- Why it is needed.
- Exact path or command scope.
- Duration.
- Whether it is local-only.
- What remains usable after denial.
- Revocation path.

Permission denial must preserve lower-privilege workflows.

Example:

> Tellann needs read access to analyze routes and framework configuration. No scripts will run and no files will be uploaded. You can still perform a URL-only guided run without granting access.

---

# 13. Desktop versus web responsibility

| Capability | Desktop | Web companion |
|---|---|---|
| Open local folder | Authoritative | No |
| Repository scan | Authoritative local execution | Derived summaries/history |
| Document extraction | Local extraction | Approved metadata/history |
| Managed browser | Authoritative | Run status/history only |
| Active guided QA run | Authoritative | Observe/share where supported |
| Instrumentation apply/rollback | Authoritative local execution | Governance/audit/history |
| Intent review | Yes | Yes |
| Advanced graph editing | Yes or deep-link | Yes |
| Canonical declared graph | Consumes/updates through cloud | Cloud authoritative |
| Reconciliation | Displays | Cloud authoritative processing |
| Reports | Displays canonical contract | Displays canonical contract |
| Members/RBAC | Link out | Authoritative |
| Billing | Link out | Authoritative |
| Organization settings | Link out | Authoritative |
| Device revocation | Link or compact view | Authoritative full view |
| Audit | Limited task context | Authoritative |
| Ingestion keys | Advanced/legacy link | Authoritative |

---

# 14. Global page states

Every top-level page must implement the following states consistently.

## Loading

- Skeleton matching the destination.
- Do not keep the previous page active without explanation.

## Empty

- Explain why data is absent.
- Give one primary action.
- Do not show an empty table without guidance.

## Permission required

- Show required permission.
- Show exact scope.
- Preserve available lower-privilege actions.

## Plan restricted

- Explain the capability, not merely “upgrade”.
- Keep unaffected features usable.
- Use cloud-provided entitlement data.

## Offline

- Show cached data.
- Show local-only actions.
- Show queued synchronization work.
- Never imply cloud confirmation when offline.

## Processing

- Show pipeline stage.
- Show whether closing the page is safe.
- Show retry or cancellation behavior.

## Failure

- Show the failed subsystem.
- Show a human-readable explanation.
- Include technical detail in an expandable panel.
- Provide retry, rollback, or fallback.

## Stale

- Show what changed.
- Prevent unsafe operations such as applying a stale instrumentation plan.
- Permit read-only historical review.

---

# 15. Sidebar interaction contract

Suggested TypeScript shape:

```ts
type DesktopSection =
  | "projects"
  | "intent"
  | "instrumentation"
  | "qa-runs"
  | "reports";

interface DesktopNavItem {
  id: DesktopSection;
  label: string;
  icon: React.ComponentType;
  projectScoped: boolean;
  resolveHref(context: {
    activeProjectId?: string;
  }): string;
}

const navItems: DesktopNavItem[] = [
  {
    id: "projects",
    label: "Applications",
    icon: Folder,
    projectScoped: false,
    resolveHref: () => "/applications",
  },
  {
    id: "intent",
    label: "Intent",
    icon: Workflow,
    projectScoped: true,
    resolveHref: ({ activeProjectId }) =>
      activeProjectId
        ? `/applications/${activeProjectId}/intent`
        : "/applications?next=intent",
  },
  {
    id: "instrumentation",
    label: "Instrumentation",
    icon: Code2,
    projectScoped: true,
    resolveHref: ({ activeProjectId }) =>
      activeProjectId
        ? `/applications/${activeProjectId}/instrumentation`
        : "/applications?next=instrumentation",
  },
  {
    id: "qa-runs",
    label: "QA Runs",
    icon: Play,
    projectScoped: true,
    resolveHref: ({ activeProjectId }) =>
      activeProjectId
        ? `/applications/${activeProjectId}/qa-runs`
        : "/applications?next=qa-runs",
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    projectScoped: true,
    resolveHref: ({ activeProjectId }) =>
      activeProjectId
        ? `/applications/${activeProjectId}/reports`
        : "/applications?next=reports",
  },
];
```

Active-state matching should support descendant routes:

```ts
function isNavItemActive(
  pathname: string,
  projectId: string | undefined,
  section: DesktopSection,
): boolean {
  if (section === "projects") {
    return pathname === "/applications" ||
      /^\/applications\/[^/]+(?:\/workspace|\/sources|\/environments|\/activity)?$/.test(pathname);
  }

  if (!projectId) return false;

  return pathname.startsWith(`/applications/${projectId}/${section}`);
}
```

Do not use a click handler that merely sets an `activeTab` class. Navigation and rendered content must share the same route source of truth.

---

# 16. Recommended redirect rules

## After sign-in

1. Active run exists → active run page.
2. Last selected valid project exists → project overview.
3. Otherwise → project list.

## After project creation

- Workspace attached and scanned → project overview.
- Documents attached and inference entitled → Intent.
- URL-only mode → New QA Run.

## After intent acceptance

- First-time project → New QA Run.
- Existing instrumentation required → Instrumentation.
- Otherwise → Intent version detail.

## After successful instrumentation

- New QA Run with manifest preselected.

## After run completion

- Run detail while processing.
- Then report detail when ready.

## After report generation

- Report detail, with **Open in web** available.

---

# 17. Delivery-phase navigation behavior

| Area | Phase 0 | Phase 1 | Phase 2 | Phase 3+ |
|---|---|---|---|---|
| Applications | Shell/auth/folder proof | Full project attach and read-only scan | Sources and change diffs | Adapter-rich workspace intelligence |
| Intent | Placeholder/current graph selection | Basic expected version selection | Full document/repository drafts and review | Intent-aware instrumentation mapping |
| Instrumentation | Security shell | Browser-only/manual status | Proposal-only | Apply, validate, rollback |
| QA Runs | Managed browser proof | Full guided browser-first runs | Runs against accepted inferred intent | Correlated SDK/semantic runs |
| Reports | Basic run association | Canonical browser-first reports | Provenance/conflict sections | Instrumentation and cross-layer evidence |

A feature that has not reached its delivery phase must still have a useful destination page and a usable fallback. It must never be an inert sidebar label.

---

# 18. Acceptance criteria

## Navigation

- Every sidebar item changes the URL.
- Every route renders a page.
- Refresh preserves the destination.
- Back and forward navigation work.
- Active styling follows the route.
- Descendant pages keep the parent sidebar item active.
- Missing project context produces a project-selection flow.
- No visible item silently ignores a click.

## Applications

- A user can attach a folder without executing scripts.
- A user can use URL-only mode.
- Workspace status is visible and actionable.
- Absolute local paths are not uploaded.

## Intent

- A draft is distinguishable from an accepted version.
- AI/inferred output cannot mutate canonical intent without acceptance.
- Evidence and conflicts are visible.
- Version history is immutable.

## Instrumentation

- Plan generation does not require write access.
- Scope is explicit before approval.
- Stale plans are rejected.
- Rollback affects only Tellann-authored changes.
- Production application is blocked.

## QA Runs

- A user can produce a browser-first report without installing an SDK.
- Managed Chromium is isolated from the personal browser profile.
- Active run status is always recoverable from the sidebar.
- Evidence is correlated by run/session/trace.
- Sensitive actions require confirmation.
- Production remains observation-only.

## Reports

- Desktop and web render the same canonical contract.
- Every finding links to evidence.
- Partial data is clearly marked.
- Export respects privacy, plan, and permission policy.

---

# 19. Immediate implementation order

1. Create route definitions for the five primary destinations.
2. Replace active-tab-only sidebar code with route links.
3. Add active-project resolution and `next` redirect handling.
4. Implement the Applications list and application overview.
5. Make workspace and run status blocks clickable.
6. Add contextual empty states for the other four destinations.
7. Implement QA Runs list, new-run wizard, and active-run route.
8. Implement report list/detail using the canonical report contract.
9. Implement Intent version selection, then full draft review in Phase 2.
10. Implement Instrumentation browser-only/manual status, then automated planning and application in Phase 3.
11. Add entitlement and permission guards centrally.
12. Add route restoration and deep-link tests.

---

# 20. Final information architecture

```text
Tellann Desktop
│
├── Applications
│   ├── Project list
│   ├── Create/attach
│   ├── Overview
│   ├── Workspace
│   ├── Sources
│   ├── Environments
│   └── Activity
│
├── Intent
│   ├── Overview
│   ├── Draft review
│   ├── Evidence
│   ├── Conflicts
│   ├── Versions
│   ├── Compare
│   └── Advanced editor
│
├── Instrumentation
│   ├── Overview
│   ├── Plan
│   ├── Scope
│   ├── Diff
│   ├── Validation
│   ├── Manifest
│   ├── History
│   └── Rollback
│
├── QA Runs
│   ├── History
│   ├── New run
│   ├── Active run
│   ├── Evidence
│   ├── Findings
│   ├── Replay
│   ├── Observed graph
│   ├── Reconciliation
│   └── Artifacts
│
├── Reports
│   ├── History
│   ├── Report detail
│   ├── Comparison
│   └── Export
│
└── Sidebar status
    ├── Workspace → workspace page
    └── Run status → active run or run history
```

The resulting sidebar is not merely a menu. It represents Tellann’s operating sequence:

```text
Select the software
→ establish expected behavior
→ prepare observation
→ perform the run
→ understand the evidence
```
