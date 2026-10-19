# Automated QA Run — implementation review

> **Status: the gaps below have been closed.** This document is kept as the audit that produced the work, so
> the reasoning behind each change stays readable. What was built against it:
>
> | Review gap | What was done |
> |---|---|
> | §2.1 deployed-URL runs unreachable | `ExecutionProfileInputSchema` accepts zero processes; a zero-process profile is approved by its shape; an "already running" form and proposal. A local address is allowed too — someone running their own dev server was a third workflow the review never named. |
> | §2.2 authentication coverage | Browser sessions kept between runs (encrypted, per application+persona+origin, with expiry and self-healing); `SEEDED` and `API` personas; identifier-first logins; a hand-over that nudges before giving up. |
> | §2.3 `prepared.login` unread | `LOGIN_NOT_CONFIGURED` / `LOGIN_FORM_NOT_FOUND` refusals, plus `ANALYSIS_STALE`, all mirrored as blockers on the form. |
> | §2.4 no screen analysis | `ElementGeometry` on every element; `visual.ts` breaks ties and catches a control nobody could click (`CONTROL_OBSCURED`). Deterministic — numbers compared with numbers. The model resolver seam is built and tested; see "What is left" below. |
> | §2.5 real-time analysis | Step metrics and an ease-of-access verdict; a responsive sweep at five sizes, on by default; nine UI-quality rules in `ui-quality.ts`, each carrying its measurement, raised as real findings; accessibility scans re-enabled for Automated runs. |
> | §2.6 dead evidence streams | Declared API effects and `blockedActions` now reach the report and both renderers; resolver provenance records where the model ran. |
> | §2.7 web surface behind the desktop | Mode chip and filter, polling while a run is active, a live phase and awaiting-user banner, heartbeat age, and every new section rendered. |
> | §2.9 unverified | `pnpm verify:desktop:automated` extended from 99 to 122 checks. The platform tier still needs a database. |
>
> One gap the new acceptance checks found that this review had missed: a kept session was useless whenever the
> only declared route into an application's authenticated area was its login form, because the planner filtered
> that edge out. Fixed in `entry.ts` — when the browser is already signed in, the sign-in page is just a page
> that forwards you on.
>
> **What is left:** the vision resolver is wired end to end (`vision-resolver.ts`, `ManagerDeps.resolver`,
> `assistedTieBreaking` off by default) and tested against a fake asker, but it is not bound to a model
> provider. Doing that adds the desktop's first AI dependency and is the one change here that relaxes a written
> invariant, so it was left as a deliberate decision rather than taken quietly. Invariants 3 and 4 in
> `automated-run-implementation-plan.md` have been amended to record the shape of that relaxation.

Review of the Automated Run functionality in `apps/desktop`, the packages it rests on, and how it
reaches the web app. Read against the seven-stage run you described (start the app → authenticate →
map the Flow to the code → drive it → analyse in real time → end cleanly → report).

Scope of what was read: `apps/desktop/src/main/automation/*`, `packages/automation-engine/src/*`,
`packages/browser-observer/src/*`, `packages/desktop-contracts/src/automation.ts`,
`apps/desktop/src/renderer/automated-run.tsx`, `apps/desktop/src/main/quality-report-document.ts`,
`services/onboarding-api/src/desktop-routes.ts`,
`services/background-workers/src/qa-automation-report.ts`, `qa-report-worker.ts`,
`qa-frontend-report.ts`, and `apps/dashboard/src/app/qa-runs/**`.

---

## 1. What is implemented, and how it works

### 1.1 The shape of the thing

Automated Run is a **deterministic execution engine**, not an agent looking at screenshots. That is
an explicit, written invariant (`docs/app/automated-run-implementation-plan.md`, "Non-negotiable
invariants" 3 and 4): the hot path is local and synchronous with the browser, there is no cloud call
per action, and **no LLM in the execution loop or in report text**. Everything below follows from
that choice.

Four layers, cleanly separated:

| Layer | Where | Knows about |
|---|---|---|
| Pure engine | `packages/automation-engine/src` (~4.5k LOC, no Electron/Playwright imports) | Structured observations in, decisions out |
| Browser adapter | `packages/browser-observer/src/automation-driver.ts` + `index.ts` | Playwright, evidence, traces |
| Orchestration | `apps/desktop/src/main/automation/*` | Processes, cloud, relay, the person |
| Surfaces | `apps/desktop/src/renderer/automated-run.tsx`, `apps/dashboard/src/app/qa-runs/**` | Setup, live view, report |

The engine's loop is `RECOGNISE → PLAN → POLICY → ACT → SETTLE → VERIFY → (replan | next)`
(`automation-engine/src/executor.ts:runAutomation`). Everything the loop touches is behind an
`AutomationPorts` interface, so the whole thing is tested end to end against a fake application
without launching Chromium, and against real Chromium in
`browser-observer/src/automation-driver.test.ts`.

### 1.2 Stage by stage, against your list

| Your stage | Status | Where |
|---|---|---|
| 3.1 Start the local codebase | **Implemented** | `automation/project-runner.ts` |
| 3.1 Open a deployed URL instead | **Supported by the engine, unreachable from the UI** | see §2.1 |
| 3.2 Authenticate | **Implemented for password forms + hand-over** | `automation-engine/src/entry.ts`, `auth-challenge.ts` |
| 3.3 Map the Flow onto the codebase | **Implemented** | `automation/contract-pipeline.ts`, `automation-engine/src/contract.ts` |
| 3.4 Drive the flow (which button, which field) | **Implemented — from code + DOM semantics, not from the screen** | `ranking.ts`, `act.ts`, `automation-driver.ts` |
| 3.5.1 Time/ease of reaching each element | **Partial** — the signal is collected, never reduced | §2.5 |
| 3.5.2 States/transitions not found | **Implemented** | `executor.ts`, `qa-automation-report.ts` |
| 3.5.3 Errors, slow requests, console, backend | **Implemented** (shared with Guided runs) | `qa-frontend-report.ts`, `qa-backend-report.ts` |
| 3.5.4 Responsiveness across dimensions | **Absent** | §2.5 |
| 3.5.5 UX quality improvement suggestions | **Absent** | §2.5 |
| 3.6 End at terminal state or when stuck | **Implemented, thoroughly** | `executor.ts`, `budget.ts`, `automated-run-manager.ts` |
| 3.7 Produce the QA report | **Implemented, deterministic** | `services/background-workers/src/qa-automation-report.ts` |
| 4 Web app sync | **Mostly implemented; live state and several sections not surfaced** | §4 |

### 1.3 Starting the application (3.1)

`ExecutionProfile` names launch commands the workspace scan already found — it never carries its own
command line, so the launcher's allowlist, workspace scoping and approval hash keep applying
(`desktop-contracts/src/automation.ts:ExecutionProfileProcessSchema`). A profile is only usable once
a person has approved the exact commands, and the approval is a hash of *what those commands resolve
to right now*, so editing a `dev` script silently revokes it (`execution-profile.ts:isProfileApproved`,
checked twice — once in `AutomatedRunManager.start`, once in `ProjectRunner.start`).

`ProjectRunner` starts processes in profile order, waits on a **readiness predicate, never a sleep**
(`PORT` / `HTTP` / `LOG` pattern), tears down in reverse, and reports `APPLICATION_CRASHED` the
moment a supervised process exits mid-run. Every pid goes into a crash-safe journal
(`orphan-journal.ts`, keyed by pid *and* OS start time) swept at next launch, and teardown kills the
whole process tree (`process-tree.ts`, `taskkill /T /F` on Windows).

Notably: after all processes report ready, the runner still waits for `profile.applicationUrl` to
answer (`project-runner.ts:141`). A profile with **zero** processes is therefore a complete,
working description of "my app is already deployed, just check it answers and drive it". The engine
supports it; nothing in the UI can create one (§2.1).

### 1.4 Authenticating (3.2)

Two concepts are deliberately kept apart in `entry.ts`:

- `persona.authenticated` — does this identity ever sign in at all? A guest persona is never walked
  through a login form even if one exists.
- *session* authenticated — is the browser, right now, signed in? Starts false, flips the moment
  login succeeds, and is what guard planning actually reads.

The entry sequence plans over the **navigation graph** (not the Flow contract), because getting to
the Flow's first state is setup, not the thing under test. Login edges are filtered out of ordinary
path search (`navGraph`) so the planner can never route "through" a login with no credentials to
fill; login is performed as its own explicit step.

What it will type: an email/username and a password, into a form a person confirmed the route of.
That is all. `auth-challenge.ts` detects and hands over to the person for:

- **CAPTCHA** — outranks everything, never attempted, never typed on
- **MFA / one-time codes** — including `autocomplete="one-time-code"`
- **External identity provider** — any host that is not `applicationOrigin`
- **SSO / social login** — only when there is no password field beside it
- **Passwordless / magic link / passkey**
- **Unsupported login form** — no password field at all
- **`MANUAL_BY_CHOICE`** — the persona was configured to sign in by hand

Detection is deliberately generous because the cost is asymmetric, and the comment says so.

The hand-over itself is good: the run pauses (`AWAITING_USER`), **evidence recording is paused** so
nothing the person types is captured, the browser is brought to the front, an OS notification fires,
and the run resumes from wherever the person left the browser — re-planning onward rather than
assuming they landed anywhere in particular. Credentials are no longer typed on top of a session a
person established (`signedInByPerson` → `sessionAuthenticated: true, manualAuthentication: false`).
At most `MAX_MANUAL_HAND_OVERS = 3` before it is called a loop rather than a sign-in.

Every value the run will ever type is registered as protected **before anything is typed**
(`run-executor.ts`), so it cannot land in an artifact.

### 1.5 Mapping the Flow to the system (3.3)

`contract-pipeline.ts` is the join of three sources that live in three places:

1. the published, immutable Flow version (platform, cached locally by id),
2. the Flow initialization manifest — every checkpoint's mapping to a code entity (platform, cached),
3. the local codebase analysis, read **fresh** every run.

`compileExecutableContract` turns those into an `ExecutableContract`: states with route patterns,
declared headings/texts, required/optional control descriptors, SDK state signals and expected API
conditions; transitions with a `ControlDescriptor` (labels, testId, domId, element, event,
`data-tellann-action` anchor, href), typed `FormInput`s with an `InputRole`
(`PROTECTED`/`PROVIDED`/`GENERATED`), an `ActionClass`, a `StepMode`, and `codeRefs`.

Each piece carries a `DerivationStatus` (`RESOLVED`/`AMBIGUOUS`/`UNRESOLVED`) and a `controlOrigin`
(`CODE`/`DECLARED`/`BOTH`). Declared beats derived. A transition whose control could not be derived
has `control: null`, and **the run refuses to start** if any such transition sits on the path to the
target (`CONTROLS_NOT_DERIVED`) rather than discovering it halfway.

The contract never leaves the machine — it names the developer's files, symbols and control labels.
What goes to the cloud is a `ContractSummary`: a hash plus counts (`states`, `transitions`,
`controlsDerived`, `controlsMissing`, `anchored`).

### 1.6 Driving the flow (3.4)

This is where the design diverges most from your description, deliberately.

`PageAutomationDriver` turns the live page into a `SemanticSnapshot`: url, canonical path, title,
headings, up to 400 interactive elements (role, accessible name, label, testId, domId, href,
`data-tellann-action`, field name, input type, visible, enabled, checked, select options, popup,
autocomplete, group), SDK states reported since the last action, request metadata, console/runtime
error count, and embedded frame origins. Its header comment is explicit: *"It never reads pixels, and
it never changes the application's DOM"* — element refs are indexes into a page-side array, so the
driver cannot perturb what it is recognising.

`recognizer.ts` scores the page against every declared state (route, declared heading/text, SDK
signal, required/optional elements, expected API) and returns a confidence plus the evidence behind
it. `ranking.ts` picks the control for a transition on a strict evidence ladder:

| Method | Score |
|---|---|
| `ACTION_ANCHOR` (`data-tellann-action`) | 1.00 |
| `TEST_ID` | 0.95 |
| `ROLE_NAME` | 0.85 |
| `LABEL` | 0.75 |
| `HREF` | 0.70 |
| `TEXT` (partial, ≥4 chars) | 0.55 |
| `STRUCTURAL` (domId) | 0.30 |

Below `0.5` nothing is acted on; two *different* elements tying exactly is reported as ambiguous and
the run stops. Ranking never widens its search after it fails. Elements that matched but are hidden
or disabled are kept separately as `unusable` so a report can say *why* nothing was clickable.

Inputs are resolved against the live element, not the Flow's guess: native `<select>` by option
label then value, custom comboboxes by opening and clicking (including type-to-filter), checkboxes
and radios native or ARIA (with a hidden-input/label fallback and a post-click verification), file
uploads inline from base64 with no path on disk, date/time formats. Verified in real Chromium
(`input-types.test.ts`).

Settling is a predicate, never a sleep: `domcontentloaded`, then a DOM quiet window
(`MutationObserver`, 250 ms), then foreground requests drained (anything in flight > 3 s is treated
as background polling), then a 1.5 s grace for the application's own SDK to announce the expected
state — with a hard cap, so states that never report are still recognised from route and elements.

Safety is layered: `policy.ts` gates on `ActionClass`
(`READ` → `CLIENT_STATE_MUTATION` → `SERVER_MUTATION` → `EXTERNAL_SIDE_EFFECT` → `DESTRUCTIVE`) per
environment, the planner excludes blocked classes from path search *and* the decision is re-checked
at the point of acting, navigation off the application's origin is blocked, production is refused
outright at three levels, and **a mutating action is never retried** (`budget.canRetry`).

`StepMode` handles steps the Flow says need a person: `CONFIRM` (the run asks, then re-reads the page
because the person took time) and `MANUAL` (the person does it; the run resolves no control, types
nothing, and verifies the state that follows).

Loop detection is by *progress toward the goal*, not by repetition: landing back on the same state
fingerprint without the remaining path getting shorter is a loop (`budget.ts:LoopDetector`).
Deliberate retries are excluded from that count.

### 1.7 Real-time analysis (3.5)

Two independent streams run during an Automated Run:

**(a) The engine's own evidence.** Eighteen `QA_AUTOMATION_*` event types
(`desktop-contracts/src/automation.ts`), recorded locally and uploaded: plan created, state
evaluated (with full recognition evidence, score, candidates, ambiguity), action selected (with the
match *method* and score, action class, mode, derivation, codeRefs), executed, verified (with
`errorsSince`, declared-effect checks), blocked, replan, initial/terminal reached, stopped, code
evidence, trace retained, render timing, manual action required/completed.

**(b) The shared frontend/backend capture.** The injected QA recorder is installed for *every* mode,
so an Automated Run collects exactly what a Guided run does: page performance (LCP/CLS/INP,
`dataReadyMs`, `visuallyStableMs`), every fetch/XHR with status, size and duration, console errors
and warnings grouped, runtime errors and crashes, interaction events, storage and client-state
mutations, failed resources, and backend spans via the relay. These become `sections.frontend` and
`sections.backend` of the report with web-vitals verdicts, p95 latency, slow-endpoint rows and
baseline comparison.

**Conditional deep diagnostics** (`capture-policy.ts`) is the clever part. A clean run stores almost
nothing. The moment something looks off — low confidence, ambiguous state, unrecognised page, an
action that did not advance, an action that landed somewhere else, new runtime errors, a blocked
action, a run stopping short — the engine asks for forensic depth **for that moment, while the page
still shows it**: a masked screenshot, the redacted accessibility tree, the Playwright trace chunk
for that state visit, and an expansion of the code behind the failing step (handler, its calls, the
destination's guards, a hash of the source range — locations only, never source text).

Traces are recorded without screenshots, DOM snapshots or sources, and are **sanitised on the machine
before storage** (`trace-sanitizer.ts`) because a real Playwright trace quotes every `fill` value
twice, quotes element markup, and stores the result of every `evaluate` — which is how the driver
reads the page. That is a genuinely subtle leak, and it was found and closed.

Opt-in render timing installs a minimal React DevTools hook before the app loads, timing only the
named Flow components (capped at 8, up to 16 in the config).

### 1.8 Ending (3.6)

Twenty-four stop reasons, each mapped once to a `AutomationStopKind`
(`SUCCESS` / `APPLICATION` / `INFRASTRUCTURE` / `USER`) in `AUTOMATION_STOP_REASON_KIND`, with a
comment forbidding callers from re-deriving it. That single table is what keeps "the application
prevented this" from ever reading as "Tellann broke", and vice versa — an `INFRASTRUCTURE` stop fails
the run, an `APPLICATION` stop completes it as `COMPLETED_INCOMPLETE` *with valid evidence*, and a
`USER` stop says plainly that nothing here says anything about the application.

Budgets: max steps, max duration, max replans, max retries (retries only ever for
`READ`/`CLIENT_STATE_MUTATION`). `MAX_UNRECOGNISED = 2` consecutive unreadable pages before stopping
rather than guessing.

Teardown is ordered so nothing is lost: stop driving → close the browser and settle its evidence →
stop the application (so it cannot emit into a closing relay) → flush evidence → tell the platform.
It is idempotent (`active.teardown ??=`), survives a desktop close mid-run, and handles cancel,
application crash, browser crash and a browser the person closed by hand. A failed final sync leaves
a recovery record for the next launch.

### 1.9 The report (3.7)

Deterministic, rebuilt server-side from the persisted `QA_AUTOMATION_*` events — never from the
desktop's live state, so it is reproducible — and **no part of it is model-generated**
(`qa-automation-report.ts` header, QRS-RUN-008).

`sections.automated` carries: the pinned configuration by identifier only (Flow version, initial
state, target, profile, persona, data set, code snapshot, instrumentation manifest, contract hash and
counts); state-by-state records with confidence, route, duration, scope (pre-boundary vs in-flow),
the action taken, how its control was matched, whether the expected state followed, and errors seen;
unreached states split into **`BLOCKED_BY_APPLICATION` vs `NOT_ATTEMPTED`** (those are not the same
claim and the schema comment says so); blocked actions; the stop reason and its kind; reconciliation
attributions (`AUTHORIZATION_MISMATCH` / `DATA_PRECONDITION_FAILURE` / `IMPLEMENTATION_MISMATCH` /
`DECLARATION_MISMATCH`); code evidence; retained traces with reasons; render timing.

It is rendered in two places: the desktop PDF/HTML report document
(`quality-report-document.ts:renderAutomated`) and the dashboard run page
(`apps/dashboard/src/app/qa-runs/[id]/`), whose wording lives in a React-free, tested view model
(`automated-report.ts`) precisely so the "whose fault was this" distinction survives to the screen.

### 1.10 What is genuinely well done

Worth saying before the gap list, because these are the parts not to disturb:

- The engine/adapter/orchestration split. The engine is pure and tested against a fake app; that is
  why the hard cases (hand-over, crash, cancel, loop) are testable at all.
- The honesty discipline. Every place where the code could be tempted to claim a finding, it instead
  records an observation and defers to reconciliation. `AUTOMATION_STOP_REASON_KIND` enforces it.
- The privacy discipline. Protected values registered before typing, capture paused during
  hand-over, trace sanitisation, contract and source staying local, locations-and-hashes only in
  reports.
- Conditional capture. A clean run costs almost nothing to store; a failing run gets depth at the
  exact moment it is worth having.
- Refusing early. Eight refusal codes fire before a run record, a process or a browser exists, so a
  doomed run costs the user nothing and is not metered.

---

## 2. Gaps

### 2.1 The deployed-URL path is unreachable from the UI — *high*

`ExecutionProfileSchema` allows zero processes and documents the case ("A profile with no processes
targets an application that is already running (a deployed staging environment)"), and
`ProjectRunner.start` handles it correctly. But:

- `ExecutionProfileInputSchema.processes` is `.min(1)` (`desktop-contracts/src/automation.ts:362`),
  so the renderer **cannot send** a zero-process profile.
- `ProfileManager` (`renderer/automated-run.tsx:223`) has no create/edit form at all. It only renders
  saved profiles and accepts `proposedProfiles`, which are derived exclusively from workspace launch
  commands (`automation-service.ts:206`) and are suppressed once any profile exists.
- `automationOptions` returns no proposals when `workspace === null`.

Net effect: there is no way for a client with a deployed app to run against it. Half of your stage 3.1
exists in the schema and the runner and nowhere else.

### 2.2 Authentication coverage is narrower than "the types we work with" — *high*

`authMethod` is `'PASSWORD' | 'MANUAL'` (`automation.ts:400`). Missing:

- **Session reuse.** `grep storageState` across `browser-observer` and `apps/desktop/src/main`
  returns nothing — every run gets a fresh `browser.newContext()`. So a `MANUAL` persona needs a
  human to sign in **on every single run**, which makes unattended runs impossible for any app with
  SSO or MFA. This is the single biggest practical limiter on the feature.
- **Programmatic sign-in.** No way to authenticate by API call + cookie/`localStorage` injection, which
  is how most teams seed a test session.
- **Multi-step password forms.** `entry.ts` resolves one form with a password field present. An
  identifier-first flow (email page → continue → password page) has no password field on the first
  page, so `hasPasswordField` fails and it is handed to a person as `UNSUPPORTED_LOGIN_FORM`.
- **Per-run persona overrides** and **role-matrix runs** (same Flow, several personas) — one persona
  per run only.

### 2.3 `PreparedContract.login` is computed and never read — *medium*

`contract-pipeline.ts` produces `login: 'BUILT' | 'NOT_NEEDED' | 'NOT_CONFIGURED' | 'NO_FORM_FOUND'`.
Nothing consumes it (`grep prepared.login` → nothing in the manager or `main.ts`). So a run with an
authenticated persona and no derivable login form starts, burns a run record, starts the application,
opens a browser, and then fails with `INITIAL_STATE_UNREACHABLE`: *"requires logging in, and no login
was found in the application"* — which reads like a finding about the client's app when it is a setup
gap on our side. This should be a pre-flight refusal alongside `CONTROLS_NOT_DERIVED`.

### 2.4 No screen analysis, and no resolver to stand in for it — *architectural*

Your stage 3.4 says "browser screen analysis to know the exact button to click". The implementation
deliberately does the opposite: code-derived descriptors matched against DOM semantics, with pixels
explicitly excluded. That is a defensible and in most ways better choice — it is reproducible,
auditable (`method` + `score` on every action), fast, and works with the model provider disabled.

But it has a hard edge, and nothing currently softens it:

- When the code analysis cannot derive a control, the run **refuses to start** (`CONTROLS_NOT_DERIVED`).
- When two live candidates tie, the run **stops** (`ranking.ts`, `STATE_RECOGNITION_AMBIGUOUS` /
  `EXPECTED_TRANSITION_NOT_FOUND`).
- The escape hatch is designed and gated but **not built**: `AmbiguityResolver` exists,
  `NO_AMBIGUITY_RESOLVER` is the only implementation (`ambiguity.ts:89`), `ambiguity-eval.ts` is the
  shipping gate, `automated-run-semantic-resolver-spike.md` chooses no runtime, and `run-executor.ts`
  never passes a `resolver` on the ports object. So in production the resolver branch in
  `executor.ts:300` and `:410` is dead code.

The verification machinery around it is the valuable part and is already written: a resolver may only
choose among candidates the engine already found, its choice is accepted only if the contract
independently agrees, an assisted state is capped at `MEDIUM` confidence, a mutating step is never
left to a tie the code cannot break, and every assisted decision carries provenance. A vision-based
resolver could be dropped behind that same gate without touching the loop.

### 2.5 The real-time analysis you described is mostly not collected — *high, and the biggest functional gap*

Taking your 3.5 point by point:

**3.5.1 Time to locate / move to each element, ease of access.** The raw signal exists and is thrown
away. `QA_AUTOMATION_ACTION_SELECTED` → `_EXECUTED` → `_VERIFIED` all carry timestamps, and
`ACTION_SELECTED` carries the match `method` and `score` (a real discoverability proxy: an element
found only by `TEXT` at 0.55 is genuinely harder to identify than one found by `TEST_ID`). But
`StateRunRecordSchema` (`automation.ts:602`) keeps only the state's wall-clock `durationMs` and the
action's `method`. No per-action latency, no settle time, no retry count, no `score`, no `unusable`
candidate count. Nothing anywhere models pointer travel, click depth, or number of steps to reach a
state — `path-coverage.ts` computes covering paths but is a spike and is not even exported from the
package.

**3.5.2 States/transitions not found.** Done properly. This is the strongest part of the reporting.

**3.5.3 Errors, slow requests, console, backend.** Collected, via the shared capture — but see §2.6:
two engine-side streams that *are* computed never reach the report.

**3.5.4 Responsiveness across dimensions.** Absent entirely. One viewport per run:
`browserContextViewport(headless)` returns `1440×900` headless and `null` headed (meaning "whatever
the window is") — `browser-observer/src/index.ts:1182`. There is no `setViewportSize` anywhere, no
breakpoint list, no per-dimension pass. `viewportHistory` in the report will contain exactly one
entry for every Automated Run, because nothing ever resizes. Mobile/tablet/foldable/laptop coverage
does not exist.

**3.5.5 UX quality improvement suggestions.** Absent, and structurally so. `extractSemantic`
deliberately collects **no geometry and no computed style** — no `getBoundingClientRect` on the
extracted elements, no font size, no colour, no contrast. So there is no substrate for "text too
small", "tap target under 44 px", "wrong button variant for its purpose", "no skeleton while
loading", "this page adds a step that leads nowhere". The `packages/rules/src/generic/{loading,
empty-states,errors}.ts` rules look relevant but are **declaration-time coverage rules** (which
states a Flow ought to declare), not run-time observations about a page.

Also: **per-state screenshots and accessibility scans are switched off for Automated runs.**
`index.ts:1676` excludes `AUTOMATED` from `captureStateArtifacts`, and the axe-core scan lives
*inside* that function. So a clean Automated Run produces zero screenshots and an empty accessibility
rollup, while a Guided run over the same Flow produces both. Screenshots are the right thing to skip
by default; losing the a11y scan with them looks unintentional, since axe output carries no typed
values and is exactly the sort of finding an unattended run should produce.

### 2.6 Computed evidence that never reaches the report — *medium, cheap to fix*

Three concrete dead ends:

1. **Declared API effects.** `executor.ts:checkDeclaredEffects` compares the requests a step actually
   made against what a person declared it causes, returns `MATCHED` / `STATUS_MISMATCH` /
   `NOT_OBSERVED`, emits them on `QA_AUTOMATION_ACTION_VERIFIED`, and returns them as
   `AutomationResult.effects`. `qa-automation-report.ts` never reads `meta.effects`, and
   `automated-run-manager.outcomeOf` ignores `result.effects`. A declared contract that the app
   silently stopped honouring is detected and then dropped.
2. **`blockedActions`.** Computed in `qa-automation-report.ts:139` and stored in
   `AutomatedRunSectionSchema` (`automation.ts:726`) — then rendered **nowhere**. It is absent from
   the dashboard's `AutomatedSection` type and from `quality-report-document.ts:renderAutomated`.
3. **Resolver provenance.** `resolvedBy` / `resolverRejected` are emitted but, being dead code today
   (§2.4), have no reader either.

### 2.7 Web surface is behind the desktop — *medium*

Covered in §4. Short version: the run list does not show mode (it is fetched and unused), the copy
still says "Guided desktop runs" and "No guided runs yet", and the live `executionPhase` /
`awaitingUser` the desktop faithfully reports every 20 s is stored by the server and displayed by
nothing — so a teammate on the web cannot see that a run is paused waiting for someone to sign in.

### 2.8 Scope ceilings — *by design, worth knowing*

- **One target terminal state per run.** `AUTOMATION_MAX_TARGETS = 1`; the config is *shaped* for
  several and the engine refuses more. Multi-path is designed in
  `automated-run-multi-path-design.md` and not built.
- **One run per desktop.** `RUN_ALREADY_ACTIVE` throws.
- **React / Next.js / Remix only.** `support.ts:READABLE_UI`; Vue, Nuxt, Svelte, SvelteKit, Angular
  and Astro are refused as "not yet supported, coming soon" with Guided/Assisted offered instead.
  This is honest and matches reality — `frameworks.ts:ADAPTERS` has only `reactAdapter` extracting UI
  controls — but it is a large share of the market.
- **Manual wait is 10 minutes**, then `MANUAL_ACTION_REQUIRED` ends the run with no resume path.

### 2.9 Unverified against a real platform — *high risk*

From the plan's own status section: migration `20261006120000_automated_qa_run` **has not been applied
to any database**, and the acceptance script's platform tier, `verify:desktop:phase3` and
`verify-settings-entitlements.ts` were never run (Docker Desktop is broken on the build machine —
a zero-byte `dockerInference` socket entry that cannot be deleted). The local tier passed 99 checks
against real Chromium, the real engine, the real desktop composition and the real report and
reconciliation functions.

So: the engine and desktop are well tested; **the entire cloud round-trip — run creation, phase
reporting, evidence ingestion of the `QA_AUTOMATION_*` types, report generation, reconciliation,
usage metering, the dashboard read path — has never executed end to end.** That is the first thing to
fix, because every §4 improvement is unverifiable until it does.

---

## 3. How to make it work seamlessly, stage by stage

Ordered by what unblocks the most. Each item names the files to touch.

### Stage 0 — unblock verification (do this first)

Repair Docker, apply the migration, run the platform tier. Nothing below can be trusted otherwise.

```bash
docker compose up -d postgres redis neo4j && pnpm --filter @tellann/db migrate:deploy && pnpm billing:seed-plans
```

then `pnpm verify:desktop:automated -- --require-services`, `pnpm verify:desktop:phase3`,
`pnpm verify:settings`.

### Stage 3.1 — starting local *or* deployed

1. Relax `ExecutionProfileInputSchema.processes` to `.max(8)` with no minimum
   (`desktop-contracts/src/automation.ts:362`), and add a `superRefine` requiring `applicationUrl` to
   be non-localhost when `processes` is empty (a zero-process profile pointing at `localhost:3000` is
   almost certainly a mistake).
2. Add a **"My app is already running at a URL"** branch to `ProfileManager`
   (`renderer/automated-run.tsx:223`): a name, a URL, no commands, and no approval step needed —
   there is nothing to approve when nothing is executed. Make `isProfileApproved` return true
   trivially for a zero-process profile so the manager's gate does not reject it.
3. Have `automationOptions` propose a URL-only profile from `workspace.suggestedApplicationUrls` even
   when no launch command was found, and when `workspace === null` but an analysis exists.
4. Surface `ProjectRunner.outputOf(name)` in the `APPLICATION_START_FAILED` path. It already captures
   a redacted output tail; the run manager discards it. Put the last ~40 lines in the live view and
   the report — "your app wouldn't start" is useless without the reason.

### Stage 3.2 — authentication that survives unattended runs

1. **Persist and reuse the session.** Add `storageState` capture after a successful sign-in (manual
   or password), encrypt it into the local store keyed by `(applicationId, personaId, origin)`, and
   pass it to `browser.newContext({ storageState })` on the next run. Expire on first
   `AUTHENTICATION_FAILED` or when the initial state turns out to be a login page. This single
   change converts SSO/MFA applications from "needs a human every run" to "needs a human once" —
   it is the highest-leverage item in this document.
2. **Add `authMethod: 'SEEDED'`** — a persona whose session is supplied as cookies / `localStorage`
   entries / a bearer token the run injects before navigating. Treat every value as protected.
   `entry.ts` then skips the login walk entirely and plans from the first authenticated page.
3. **Add `authMethod: 'API'`** — a declared `POST` with a declared body, response token extracted to
   a declared storage key. Classify it `SERVER_MUTATION` so the policy engine sees it.
4. **Support identifier-first forms.** In `entry.ts`, when the login page has an identifier field and
   a continue control but no password field, fill and submit, settle, then re-run
   `detectAuthChallenge` + `hasPasswordField` on the second page. Bound at two hops so it cannot
   become a crawler.
5. **Refuse early on an undeliverable sign-in** — §2.3. Add refusal codes `LOGIN_NOT_CONFIGURED` and
   `LOGIN_FORM_NOT_FOUND` and gate on `prepared.login` in `AutomatedRunManager.start`.
6. **Keep the hand-over, make it recoverable.** On `TIMED_OUT`, record the run as
   `MANUAL_AUTHENTICATION_REQUIRED` but leave the browser open for a grace period and allow
   "I've signed in now, carry on" to resume rather than forcing a restart.

### Stage 3.3 — flow-to-code mapping

Largely done. Two sharp edges:

1. **Explain `CONTROLS_NOT_DERIVED` actionably.** `describeMissingControls` names transitions; it
   should also name the Flow step in the person's own words and offer the two real fixes — re-run
   initialization for that checkpoint, or apply a `data-tellann-action` anchor (the machinery is
   already there in `anchor-plumbing.ts` + `InstrumentationController`). Right now the user is told
   no and not told how.
2. **Warn on a stale analysis.** The contract pins `analysisIdentity`, but nothing compares the
   analysis's content hash to the working tree's current state. A run against a repo that moved since
   the last analysis will mis-derive controls and report it as an application finding. Add a
   pre-flight staleness check with a "re-analyse" affordance.

### Stage 3.4 — driving, with a safe fallback when the code is not enough

Keep the deterministic engine as the primary path. Add a **verified vision resolver** behind the
existing gate rather than replacing anything:

1. Implement an `AmbiguityResolver` that, on a tie only, is handed the candidate list plus a cropped
   screenshot of each candidate's bounding box and the page's accessibility tree, and returns one
   `ref` with a rationale. It may *only* choose among candidates the engine already found.
2. Wire it in `run-executor.ts` as `ports.resolver`, off by default, behind a setting and an
   entitlement.
3. Run it through `ambiguity-eval.ts` first. The bar is already written and is the right one: an
   abstention costs nothing, and **one accepted-wrong case fails the gate outright**.
4. Leave `verifyControlProposal` untouched — contract agreement, `MEDIUM`-at-best confidence, never
   for a mutating step the code cannot disambiguate, provenance on every assisted decision.

This gives you stage 3.4 as described without giving up reproducibility: the screen is consulted only
where the code was genuinely ambiguous, and the deterministic verifier still has the final say.

### Stage 3.5 — the analysis layer (the real work)

This is where most of the remaining value is. Four additions, in order of value per unit of effort.

**(a) Step-level interaction metrics — cheapest, highest value.**

Extend `StateRunRecordSchema.action` with `selectedAt`, `executedAt`, `settledMs`, `attempts`,
`candidateScore`, `candidateCount`, `unusableCount`, and `effects` (§2.6 item 1). All of it is
already in the events; this is purely a reduction in `qa-automation-report.ts` plus schema and two
renderers. Then derive a per-state **"ease of access"** line the report can state plainly:

- matched only by `TEXT` or `STRUCTURAL` → the control has no stable identity; name it
- `unusableCount > 0` → the right control existed but was hidden or disabled; name which
- `attempts > 1` → the control did not take the action first time
- `settledMs` above a threshold → the transition is slow for a user, not just for the run

That is a genuine, defensible answer to 3.5.1 with no new capture at all.

**(b) Responsive sweep — a new, bounded phase.**

After the run reaches a state and settles, and *before* acting, optionally re-measure that state at a
list of declared breakpoints. Concretely:

- Add `responsiveBreakpoints` to `AutomationConfigSchema` (default empty = off; capped at ~6) with
  presets: mobile 390×844, foldable 673×841, tablet 820×1180, laptop 1280×800, large 1680×1050.
- Add a `measureViewports` port to `AutomationPorts`, implemented in `PageAutomationDriver`:
  `page.setViewportSize` per breakpoint, re-extract geometry, restore the original viewport. Do it
  only on the *first* visit to each state, so a 12-state Flow is 12 sweeps, not one per step.
- Emit `QA_AUTOMATION_RESPONSIVE_SAMPLE` per `(state, breakpoint)` with: horizontal overflow
  (`scrollWidth > clientWidth`), count of required controls that are off-screen or zero-size, count
  of elements overlapping another interactive element, and the smallest tap target among the state's
  required controls.
- Report it as a state × breakpoint matrix. This is the one place a screenshot per sample is worth
  storing, and only for samples that failed a check.

This is self-contained: no engine-decision changes, no new failure modes, and it answers 3.5.4
directly.

**(c) UI-quality heuristics — needs a substrate first.**

`extractSemantic` must start returning geometry and a *small* set of computed styles for the elements
that matter (the state's required/optional controls and the transition's control, not all 400):
`rect`, `fontSize`, `fontWeight`, `color`, `backgroundColor`, `borderStyle`, `cursor`, plus whether
the element is inside a `[role="status"]`/`aria-busy` region. Guard the cost: one `getComputedStyle`
pass over a bounded element set, behind the same opt-in as the sweep.

Then the heuristics become deterministic rules, which is the right shape for this codebase — no model
in the loop, each rule stating the measurement behind it:

| Check | Signal already available after (c) |
|---|---|
| Text too small to read | `fontSize < 12px` on a required control or heading |
| Tap target too small | `rect.width·height < 44×44` on a control, at a mobile breakpoint |
| Insufficient contrast | `color` vs `backgroundColor` → WCAG ratio (reuse axe where possible) |
| Wrong button weight for its purpose | the control performing a `SERVER_MUTATION`/`DESTRUCTIVE` transition renders as ghost/link while a `READ` control on the same state renders as filled primary |
| No loading affordance | `dataReadyMs` over a threshold with no `aria-busy`, `[role="status"]` or skeleton-ish element appearing between action and settle |
| Unnecessary page | a state whose only outgoing transition is `READ`, with no declared inputs and no required control beyond "continue" — i.e. a step that asks nothing of the user |
| Dead end | a non-terminal state from which the planner finds no onward transition |

Note the last two are *already derivable from the contract alone* — `flow-path.ts` plus
`path-coverage.ts` have what is needed — and would be a quick win even before (c) lands.

**(d) Re-enable the accessibility scan for Automated runs.**

Split `runAccessibilityScan` out of `captureStateArtifacts` and call it per first-visit state in
`AUTOMATED` mode, keeping screenshots conditional. axe output is rule metadata and target selectors
only — it already never carries page content — so this is a small change that restores a whole
report section.

### Stage 3.6 — ending

Little to do. Two refinements:

1. **Distinguish "stuck" from "finished".** `TRANSITION_DID_NOT_ADVANCE` and
   `EXPECTED_TRANSITION_NOT_FOUND` are both `APPLICATION`, which is right, but the report should say
   which declared step the Flow was on and what the page showed instead — the data is in the event,
   the summary does not surface it.
2. **Partial-credit outcome.** A run that reached 7 of 9 states and stopped is reported as
   `COMPLETED_INCOMPLETE` with a stop reason. Add "reached *n* of *m* declared states, furthest
   `stateKey`" to the outcome, so progress is legible without reading the state table.

### Stage 3.7 — the report

1. Wire in the three dead evidence streams (§2.6).
2. Add the new sections from 3.5: interaction metrics per step, responsive matrix, UI-quality
   findings, accessibility rollup.
3. **Lead with a prioritised summary.** The report is currently a faithful record in roughly
   chronological order. A reader wants: did it reach the target; what blocked it; the three worst
   quality problems found; what to fix first. Build that deterministically from severities you
   already have (stop kind, finding severity, vital verdicts, blocked actions), not from a model —
   the no-LLM-in-report-text invariant is worth keeping.
4. Keep the "whose fault" discipline as you extend. A UI-quality finding is a finding about the
   application; a missing responsive sample because the sweep was off is not.

---

## 4. Desktop ↔ web integration

### 4.1 What already syncs

The sync path is real and reasonably complete:

1. **Run creation** — `automated-run-host.openRun` → `POST /qa-runs` with `mode: 'AUTOMATED'`, the
   pinned `automation` config, `expectedGraphVersionId`, flow ids, capture tracks, target URL. The
   run exists in the cloud before the browser opens, so it is visible from the web from the start.
2. **Relay + evidence** — a local relay is started with a run credential, the application's own SDK
   markers and all `QA_AUTOMATION_*` evidence events are forwarded to the collector, spooled locally
   and flushed on completion with `drain: true`. A failed flush leaves a recovery record
   (`deps.recovery.write`) retried at the next desktop launch.
3. **Live phase + heartbeat** — `POST /qa-runs/:id/automation-phase`
   (`desktop-routes.ts:1863`) every 20 s and on every phase change, writing `executionPhase`,
   `awaitingUser`, `heartbeatAt` and the `ContractSummary` into `QARun.automation`. Guarded on the
   status it was read with, so a late phase report cannot reopen a terminal run. A desktop that stops
   reporting is swept by `qa-automation-reaper`.
4. **Completion** — `completeRun` with `completionReason` and `automationStopReason`, or
   `completeRunWithoutEvidence` when the browser died before any state was captured, or `failRun` for
   an infrastructure stop.
5. **Report generation** — `qa-report-worker` builds `sections.automated` via
   `summarizeAutomationEvidence`, alongside the shared `frontend`/`backend` sections, plus
   reconciliation with Automated-specific gap attribution
   (`services/fdrs-api/src/automated-reconciliation.ts`), endpoint baselines and the evidence
   appendix.
6. **Web display** — `/qa-runs/[id]` renders the Automated section through the tested view model:
   outcome with tone, pinned configuration, state table, unreached states with their
   blocked-vs-not-attempted distinction, reconciliation, code evidence, retained traces, render
   timing. Artifacts are listed and downloadable.
7. **Notification** — `qa-report-ready` email/notification with a deep link.

Architecturally this is the right shape: the contract and the source stay local, only hashes, counts,
locations and sanitised evidence travel, and the report is rebuilt server-side from stored evidence
rather than trusted from the desktop.

### 4.2 What does not reach the web

| Gap | Where | Fix |
|---|---|---|
| Run list does not show mode | `apps/dashboard/src/app/qa-runs/page.tsx:13` fetches `mode`, never renders it | Mode chip on each row; a filter |
| Copy assumes Guided | same file, lines 78 and 107: "Guided desktop runs", "No guided runs yet" | Reword for all four modes |
| Live phase invisible | `executionPhase` / `awaitingUser` stored by `desktop-routes.ts:1863`, read by nothing in the dashboard | Phase badge + "waiting for someone to sign in" banner on an active run, polled or over SSE |
| Stale-desktop state invisible | `heartbeatAt` is written and unused | "Last heard from the desktop *n* min ago" on an active run |
| `blockedActions` rendered nowhere | in the stored section (`automation.ts:726`), absent from the dashboard `AutomatedSection` type and from the desktop report | Add to both |
| Declared-effect checks never stored | §2.6 item 1 | Read `meta.effects` in `qa-automation-report.ts` |
| Live event log is desktop-only | `AutomatedRunLiveEventSchema` says "Local to this machine and never uploaded, so it may name the controls it is using" | Correct as-is — but the web should then show the *evidence-derived* timeline instead of nothing |
| No cancel from the web | `cancel()` is desktop-only | `POST /qa-runs/:id/cancel` relayed to the owning desktop, or accept that it is desktop-only and say so in the UI |

### 4.3 Recommended sequence for the web work

1. Apply the migration and run the platform tier (§2.9). Everything here is unverified until then.
2. Mode chip + corrected copy + mode filter on the run list. Half a day, removes the impression that
   Automated runs are second-class on the web.
3. Live phase, awaiting-user banner and heartbeat age on the active run page. This is the piece that
   makes a run *watchable* by someone who is not at the desktop, and it is the difference between
   "the web shows finished reports" and "the web shows the run".
4. Render `blockedActions` and the declared-effect checks in both the dashboard section and
   `quality-report-document.ts`.
5. Extend `AutomatedRunSectionSchema` once, for all of §3.5's new data at the same time, so the
   schema, the worker, the dashboard view model and the desktop report document move together — that
   four-file set is the real cost of each addition, and it is much cheaper paid once.

---

## 5. Suggested order of work

| # | Item | Why first |
|---|---|---|
| 1 | Docker + migration + platform-tier verification (§2.9) | Nothing else is verifiable |
| 2 | Session persistence via `storageState` (§3.2 item 1) | Turns SSO/MFA apps from unattendable to attendable |
| 3 | Deployed-URL profiles (§3.1 items 1–3) | Unblocks every client without a local dev setup |
| 4 | Pre-flight refusals: login not derivable, stale analysis (§2.3, §3.3) | Stops blaming the client's app for our setup gaps |
| 5 | Step-level interaction metrics + the three dead streams (§3.5a, §2.6) | Pure reduction of data already captured |
| 6 | Re-enable a11y scans for Automated runs (§3.5d) | Small change, restores a whole report section |
| 7 | Web: mode chip, live phase, awaiting-user (§4.3 items 2–4) | Makes the feature visible to the team |
| 8 | Responsive sweep (§3.5b) | New capability, self-contained |
| 9 | Geometry/style substrate + UI-quality rules (§3.5c) | The largest new surface; do it after 8 proves the per-state measurement pattern |
| 10 | Vision resolver behind `ambiguity-eval` (§3.4) | Highest risk; the gate must come first, and 1–9 reduce how often it is needed |
