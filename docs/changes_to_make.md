### 1. Replace `ACTIVE_MATURE` with separate lifecycle and maturity concepts

This is the biggest state-model change.

Your current state engine ends with:

```ts
if (hasSessions) return ACTIVE_MATURE;
```

That is too broad. Someone with one session is not a mature user.

Instead of one giant enum, separate **lifecycle** from **maturity/health**:

```ts
type DashboardLifecycle =
  | "NEW_ACCOUNT"
  | "SDK_SETUP"
  | "READY_TO_DEMONSTRATE"
  | "DEMONSTRATION_IN_PROGRESS"
  | "ANALYSIS_IN_PROGRESS"
  | "FIRST_ANALYSIS_READY"
  | "ACTIVE";

type DashboardMaturity =
  | "NEW"
  | "EARLY"
  | "ESTABLISHED";

type DashboardHealthIssue =
  | "INGESTION_PROBLEM"
  | "ANALYSIS_FAILED"
  | "NO_RECENT_DATA"
  | "PRIVACY_ATTENTION"
  | "PLAN_LIMIT_REACHED";
```

This prevents impossible combinations and lets you represent situations such as:

> Established application + ingestion problem.

or:

> Active application + analysis currently running.

The existing plan currently collapses too many of those conditions into one mutually exclusive lifecycle. 

---

### 2. Remove `APPLICATION_CREATED` and `SDK_CONNECTED` as full dashboard states

These are better represented as **milestones**, not page states.

For example:

```text
NEW_ACCOUNT
    ↓
SDK_SETUP
    ↓
READY_TO_DEMONSTRATE
    ↓
DEMONSTRATION_IN_PROGRESS
    ↓
ANALYSIS_IN_PROGRESS
    ↓
FIRST_ANALYSIS_READY
    ↓
ACTIVE
```

Inside `SDK_SETUP`, show:

```text
Application created       ✓
Frontend SDK connected    ✓
Backend SDK connected     ○
Telemetry verified        ✓
```

Otherwise you end up with subtle logic problems:

```ts
if (!sdkConnected) return SDK_NOT_CONNECTED;
```

means `APPLICATION_CREATED` barely has an independent meaning.

---

### 3. Do not determine `FIRST_ANALYSIS_READY` using "recently"

Your plan currently proposes:

```ts
firstAnalysisCompletedRecently
```

That should change.

The first-analysis experience is a **product milestone**, not a time window.

Use something closer to:

```ts
analysisCount === 1 &&
firstAnalysisAcknowledged === false
```

Once the user opens/explores the first result:

```ts
firstAnalysisAcknowledged = true
```

Otherwise someone who returns three days later may miss the most important activation moment because the analysis is no longer "recent."

---

# 4. Add the missing failure/exception states

The earlier dashboard design includes several operational conditions that are missing from the implementation plan.

You need explicit UI handling for:

```text
ANALYSIS_FAILED
INGESTION_PROBLEM
NO_RECENT_DATA
PLAN_LIMIT_REACHED
PRIVACY_CONFIGURATION_REQUIRED
```

For example:

```text
Analysis could not be completed

421 events were received successfully,
but workflow extraction failed.

[Retry Analysis] [View Session]
```

These should generally be **health overlays**, not lifecycle states.

---

# 5. Do not silently use mock data when APIs return `404`

I would change Open Question #1 substantially.

The proposed:

> enrich the fallback mock adapter inside the query function when specific backend sub-endpoints return 404/empty

should **not** become normal application behavior.

A `404` should never magically turn into plausible-looking dashboard metrics.

That would violate the same principle as the `0%` problem.

Instead use explicit development fixtures:

```ts
NEXT_PUBLIC_DASHBOARD_DATA_MODE=mock
```

or:

```ts
const provider =
  process.env.NEXT_PUBLIC_USE_DASHBOARD_FIXTURES === "true"
    ? fixtureDashboardProvider
    : apiDashboardProvider;
```

Production should distinguish:

```text
No data
Not measured
API unavailable
Feature unavailable
Request failed
```

These are fundamentally different conditions.

---

# 6. Use `/dashboard/overview` as the main backend contract

This should become a central part of the implementation plan.

The API specification already defines:

```http
GET /dashboard/overview
GET /dashboard/workflows
GET /dashboard/sessions
GET /dashboard/endpoints
GET /dashboard/quality
```



So instead of making `page.tsx` orchestrate ten independent APIs and infer lifecycle state itself, I would introduce a dashboard aggregation/BFF response.

Something like:

```ts
interface DashboardOverviewResponse {
  lifecycle: DashboardLifecycle;
  maturity: DashboardMaturity;

  application: ApplicationContext;

  onboarding: {
    applicationCreated: boolean;
    frontendConnected: boolean;
    backendConnected: boolean;
    telemetryVerified: boolean;
    firstDemonstrationCompleted: boolean;
    firstAnalysisReviewed: boolean;
  };

  telemetry: {
    frontendStatus: IntegrationStatus;
    backendStatus: IntegrationStatus;
    lastEventAt: string | null;
  };

  analysis: {
    status:
      | "NOT_STARTED"
      | "QUEUED"
      | "PROCESSING"
      | "COMPLETED"
      | "FAILED";
    latestAnalysisId?: string;
  };

  summary?: DashboardSummary;
  coverage?: DashboardCoverage;
  findings?: DashboardFindings;
  graph?: DashboardGraphSummary;
  sessions?: RecentSession[];
  endpoints?: EndpointSummary;
  reports?: ReportSummary[];

  healthIssues: DashboardHealthIssue[];
}
```

The frontend should **render state**, not reverse-engineer the entire backend state.

---

# 7. Add an `evidenceStatus` concept

This is necessary to correctly implement:

> Never show absence of evidence as evidence of poor quality.

A number alone isn't enough.

Instead of:

```ts
workflowCoverage: 0
```

use:

```ts
{
  status: "NOT_MEASURED",
  value: null
}
```

Possible values:

```ts
type MeasurementStatus =
  | "NOT_MEASURED"
  | "INSUFFICIENT_EVIDENCE"
  | "MEASURED";
```

Then:

```tsx
switch (coverage.status) {
  case "NOT_MEASURED":
    return "Not measured yet";

  case "INSUFFICIENT_EVIDENCE":
    return "Not enough evidence";

  case "MEASURED":
    return `${coverage.value}%`;
}
```

This is far safer than relying on `null`, `0`, `undefined`, or `N/A`.

The platform's non-functional requirements also explicitly require communicating data completeness where applicable. 

---

# 8. Make backend SDK setup recommended, not necessarily blocking

Your six-step onboarding currently implies:

```text
Connect React SDK
↓
Connect Node SDK
↓
Verify
↓
Record Demo
```

But the frontend behavioral layer is enough to begin generating significant Tellann value.

I would change it to:

```text
1. Create application                  Required
2. Connect frontend SDK                Required
3. Verify telemetry                    Required
4. Record first demonstration          Required
5. Review first analysis               Required

Enhance your analysis
○ Connect backend SDK                  Recommended
```

Unless your actual implementation requires backend correlation before demonstrations can work.

The MVP defines both SDKs, but much of behavioral discovery originates from browser behavior, while the backend SDK adds API latency/error/endpoint intelligence. 

---

# 9. Remove confidence indicators from Phase 1 missing-state cards

Your plan currently says:

> severity badges (...) and confidence indicators.

I would remove **confidence indicators** for now.

The Phase 1 missing-state/flow system is rule/evidence based. The explicit confidence-indicator requirement belongs to future intelligence capabilities, particularly Phase 3. 

Keep:

```text
HIGH
Payment Failure

Not observed in 6 checkout demonstrations.
```

instead of:

```text
Confidence: 91%
```

unless you have actually defined a deterministic confidence algorithm.

Otherwise the number is theater.

---

# 10. Rename "Recommended Demonstrations" internally

The component itself is good, but avoid accidentally turning it into an "AI recommendations" feature.

I would name the underlying concept:

```text
Coverage Opportunities
```

or:

```text
Suggested Next Demonstrations
```

with deterministic evidence:

```text
Checkout has 5 unobserved paths.

Suggested demonstrations:
• Payment failure
• Retry payment
• Empty cart
```

That stays within Phase 1 because it is merely surfacing existing missing-flow evidence rather than pretending to provide autonomous intelligence. AI recommendations are explicitly outside MVP scope. 

---

# 11. Remove the coverage donut

I would change this part:

> Coverage Radial / Donut Chart comparing coverage across dimensions.

Workflow coverage, state coverage, transition coverage, endpoint coverage, and error coverage are **independent percentages**.

They are not slices of one whole.

A donut visually implies:

```text
Workflow + State + Transition + Endpoint + Error = 100%
```

which is false.

Better:

```text
Workflow     ███████████████░░ 76%
State        ████████████████░ 81%
Transition   █████████████░░░░ 69%
Endpoint     ██████████████░░░ 72%
Error        █████████░░░░░░░░ 44%
```

Or use five small progress/gauge cards.

Keep the **historical trend chart** once there are at least two analyses.

---

# 12. Do not show a trend chart with one analysis

Define chart eligibility explicitly:

```ts
if (analysisHistory.length < 2) {
  return <TrendEmptyState />;
}
```

For one analysis:

```text
Coverage trend

A trend will appear after another demonstration
has been analyzed.
```

Not:

```text
[chart with one lonely point]
```

---

# 13. Split endpoint latency and error visualizations

The proposed:

> Endpoint Latency/Error Dual Bar Chart

combines values measured in:

```text
milliseconds
```

and:

```text
percent
```

That is difficult to read honestly.

Better:

### Slowest endpoints

```text
GET /search        842 ms
GET /products      623 ms
POST /checkout     481 ms
```

### Highest error rates

```text
POST /payment      4.8%
POST /login        2.3%
GET /profile       1.4%
```

Two compact charts/tables will communicate more clearly.

---

# 14. Never hardcode the sample behavioral graph

This part needs changing:

> rendering core state nodes `(ANONYMOUS → REGISTERED → AUTHENTICATED → SEARCH → PRODUCT → CART → CHECKOUT)`

Those are examples from the documentation, not universal Tellann states.

The actual mature graph preview must come from:

```http
GET /applications/{applicationId}/graph
```

or preferably summarized dashboard graph data.

The behavior graph is supposed to represent the **actual observed application**, and is Tellann's central behavioral model. 

The example graph can exist only in the new-user onboarding preview with a clear:

```text
Example
```

label.

---

# 15. Add backend requirements for analysis progress

This UI:

```text
Session reconstructed ✓
Events ordered        ✓
States extracted      ✓
Workflows discovered  ●
Coverage calculated   ○
```

requires actual server progress.

Otherwise the UI will fabricate what the backend is doing.

Add something like:

```http
GET /analyses/{analysisId}/status
```

Response:

```json
{
  "status": "PROCESSING",
  "currentStage": "WORKFLOW_DISCOVERY",
  "completedStages": [
    "SESSION_RECONSTRUCTION",
    "STATE_EXTRACTION",
    "TRANSITION_EXTRACTION"
  ]
}
```

Or use SSE/WebSocket if you already have job events.

If you only have:

```text
PROCESSING
```

then the UI should simply display an indeterminate processing state.

---

# 16. The live demonstration UI also needs backend work

Your plan proposes:

```text
duration
events captured
states observed
transitions observed
API calls
errors
live event feed
```

That does not currently emerge automatically from the documented start/stop demonstration API.

You therefore need to specify how it arrives.

For example:

```http
GET /demonstrations/{id}/live
```

or SSE:

```http
GET /demonstrations/{id}/stream
```

with sanitized events:

```json
{
  "eventCount": 387,
  "stateCount": 14,
  "transitionCount": 22,
  "apiCallCount": 81,
  "errorCount": 1,
  "recentEvents": []
}
```

Do not build the UI first and then discover there is nothing authoritative to populate it with.

---

# 17. Add support for workflow-targeted demonstrations

Your planned CTA says:

```text
Demonstrate Payment Failure
[Start Demonstration]
```

The start demonstration API currently documents only application/release information. 

Consider extending it:

```json
{
  "applicationId": "...",
  "workflowId": "...",
  "targetFindingId": "...",
  "demonstrationType": "GUIDED"
}
```

That enables Tellann to preserve context:

```text
Why did this demonstration begin?
→ User was addressing PAYMENT_FAILURE gap in CHECKOUT.
```

That becomes valuable later when reconciling findings.

---

# 18. Be careful with "Open Findings" and "Resolved Findings"

Your plan includes:

```text
Open Findings
Resolved findings
+6 missing paths resolved
```

This requires findings to have persistent identity across analyses.

Right now your reports describe findings, but that is different from maintaining a lifecycle such as:

```text
OPEN
RESOLVED
REOPENED
IGNORED
```

If you want this feature now, introduce something like:

```ts
Finding {
  id
  fingerprint
  applicationId
  workflowId
  type
  severity

  firstSeenAt
  lastSeenAt

  status
  resolvedAt

  sourceAnalysisId
}
```

Without this, change wording to:

```text
Current findings
Previous analysis: 11
Current analysis: 7
```

rather than claiming four specific issues were "resolved."

---

# 19. Coverage history also needs an explicit data source

Your trend chart needs:

```text
analysis 1 → 52%
analysis 2 → 61%
analysis 3 → 68%
analysis 4 → 76%
```

The existing API supports point-in-time coverage and comparisons, but your implementation plan should explicitly provide history.

Either add:

```http
GET /coverage/history
```

or include it in:

```http
GET /dashboard/overview
```

as:

```json
{
  "coverageHistory": [
    {
      "analysisId": "...",
      "timestamp": "...",
      "workflow": 76,
      "state": 81,
      "transition": 69
    }
  ]
}
```

---

# 20. Add role-aware dashboard composition

This is missing from the current implementation plan.

Tellann already defines different roles and permissions. 

Add something like:

```text
Developer
→ Integration + endpoints + sessions emphasized

QA Engineer
→ Coverage + gaps + workflows emphasized

Engineering Manager
→ Summary + trends + reports emphasized

Product Manager
→ Workflows + behavior graph emphasized

Organization Admin
→ Usage + integration + governance emphasized
```

You do not need five completely different dashboards.

Use ordering/visibility:

```ts
getDashboardLayoutForRole(role)
```

and enforce permissions server-side as well.

---

# 21. Add plan-aware controls

The footer plan card alone is not enough.

The current packaging distinguishes capabilities such as report export formats, team collaboration, API access, audit logs, SSO, and self-hosting. 

Introduce:

```ts
interface DashboardEntitlements {
  canExportPdf: boolean;
  canExportCsv: boolean;
  canUseTeamFeatures: boolean;
  canAccessApi: boolean;
  canAccessAuditLogs: boolean;
}
```

Then:

```tsx
<ExportButton disabled={!entitlements.canExportPdf} />
```

But authorization must still be enforced by the backend.

---

# 22. Clarify production environment behavior

You currently plan:

```text
Demo | Development | Staging | Production
```

The SDK recognizes these environment names. 

However, **production monitoring is Phase 2**, not MVP. 

So if `Production` remains selectable in Phase 1, make it clear that it is merely the application's environment label.

Do not expose Phase 2 language like:

```text
Live production health
Real-user monitoring
Production anomalies
```

yet.

---

# 23. Add loading, empty and error contracts to every component

Each dashboard module should implement:

```ts
type DataState<T> =
  | { status: "loading" }
  | { status: "error"; error: DashboardError }
  | { status: "not_available" }
  | { status: "not_measured" }
  | { status: "insufficient_evidence" }
  | { status: "ready"; data: T };
```

That gives your UI a common behavioral language.

This is especially important for Tellann because **absence of data has semantic meaning**.

---

# 24. Add accessibility to the implementation plan

Charts cannot be the only representation.

Every visualization should also expose text/table equivalents.

For example:

```text
Workflow coverage: 76%, up 4 percentage points
State coverage: 81%, up 2 percentage points
```

Also add:

* keyboard-accessible table rows;
* visible focus states;
* chart summaries;
* `aria-label`s;
* no severity indicated only by color;
* reduced-motion support for animated graph edges;
* sufficient monochrome contrast.

This also aligns with the dashboard usability requirements. 

---

# 25. Add a dashboard performance budget

The NFR requires dashboard pages to load within three seconds under normal conditions. 

Your new dashboard is much heavier than the existing one, so explicitly plan for:

```text
/dashboard/overview request
       ↓
render primary information
       ↓
lazy-load graph
       ↓
lazy-load historical charts
       ↓
lazy-load lower-priority tables
```

For example:

```tsx
const GraphPreview = dynamic(
  () => import("./graph-preview"),
  {
    ssr: false,
    loading: () => <GraphPreviewSkeleton />
  }
);
```

Do not block first paint on Recharts plus graph visualization plus every historical query.

---

# 26. Reconsider "glassmorphism"

Your plan says:

> dark mode glassmorphism design tokens

I would change this to:

> existing Tellann monochrome design system and dashboard surface tokens.

Glassmorphism shouldn't become an architectural requirement.

Your current Tellann interface already has a disciplined monochrome aesthetic. Heavy blur/transparency would add visual noise to an information-dense engineering product.

---

# 27. Expand automated testing considerably

Current verification:

```bash
pnpm --filter dashboard build
pnpm --filter dashboard lint
```

is insufficient for a state-driven dashboard.

Add:

### State engine unit tests

```text
0 apps
→ NEW_ACCOUNT

app + no events
→ SDK_SETUP

events + no demo
→ READY_TO_DEMONSTRATE

active demo
→ DEMONSTRATION_IN_PROGRESS

analysis processing
→ ANALYSIS_IN_PROGRESS

first analysis
→ FIRST_ANALYSIS_READY

multiple analyses
→ ACTIVE
```

### Measurement-state tests

```text
null + NOT_MEASURED
→ "Not measured yet"

0 + MEASURED
→ "0%"

no findings + analysis complete
→ "No missing states detected"
```

That second distinction is critical.

### Component tests

Test:

```text
Loading
API failure
No evidence
Measured zero
Measured non-zero
Plan restricted
Permission restricted
```

### E2E tests

At minimum:

```text
New account
→ create application
→ connect telemetry
→ start demonstration
→ stop demonstration
→ analyze
→ first-result dashboard
```

That is effectively Tellann's MVP activation journey. 

---

# 28. I would revise the component tree slightly

Your current tree is good. 

I'd evolve it to:

```text
components/dashboard/
│
├── core/
│   ├── types.ts
│   ├── state-engine.ts
│   ├── entitlements.ts
│   ├── dashboard-provider.ts
│   └── measurement-state.ts
│
├── onboarding/
│   ├── lifecycle-hero.tsx
│   ├── setup-progress.tsx
│   └── first-analysis-ready.tsx
│
├── overview/
│   ├── quality-summary.tsx
│   ├── coverage-summary.tsx
│   ├── coverage-trend.tsx
│   ├── graph-preview.tsx
│   └── workflow-coverage-list.tsx
│
├── findings/
│   ├── missing-states-card.tsx
│   ├── missing-flows-card.tsx
│   └── suggested-demonstrations.tsx
│
├── activity/
│   ├── recent-sessions.tsx
│   ├── endpoint-health.tsx
│   └── recent-reports.tsx
│
└── status/
    ├── observation-status.tsx
    ├── privacy-status.tsx
    └── plan-usage.tsx
```

This gives you better boundaries than putting sessions and endpoint logic into the same component.

---

## The backend/API additions I would add to the implementation plan

This is the part I think your current document most needs.

```text
BACKEND / DASHBOARD AGGREGATION
───────────────────────────────

GET /dashboard/overview
→ lifecycle
→ onboarding progress
→ integration state
→ summary
→ coverage
→ graph summary
→ findings summary
→ session summary
→ endpoint summary
→ report summary
→ usage
→ health issues

GET /coverage/history
→ historical coverage values

GET /analyses/:id/status
→ real analysis processing progress

GET /demonstrations/:id/live
or SSE
→ live demonstration statistics/events

OPTIONAL:
POST /demonstrations/start
+ workflowId
+ findingId
→ targeted demonstrations
```

Without these additions, much of the impressive dashboard proposed in your plan will either require excessive frontend fan-out or fictional placeholder state.

---

## I would also update the "Open Questions"

Your current two questions can largely be resolved now.

**1. Backend fallback mocks:** use explicit fixtures only in development; never silently substitute mocks because an endpoint returned `404`.

**2. Chart library:** Recharts is reasonable for this kind of dashboard, but the library choice is secondary. I would first reduce the proposed chart set: keep the coverage trend and simple bar/progress representations; drop the coverage donut and split latency/error visualization.

---

## Revised implementation order

I would also change the order of execution. Right now the plan risks building the visual dashboard before the information model is stable.

1. **Dashboard contracts first** — lifecycle, maturity, measurement status, health overlays and `/dashboard/overview`.
2. **State engine + test fixtures** — create deterministic fixtures for new account, SDK setup, ready-to-demo, recording, analyzing, first result, active, and error conditions.
3. **Onboarding states** — build new-account, integration and first-demonstration experience first.
4. **First-analysis experience** — this is Tellann's main activation moment.
5. **Core mature dashboard** — summary, coverage, graph, workflows, findings.
6. **Sessions/endpoints/reports**.
7. **Historical deltas/trends** after persistence/history contracts exist.
8. **Role/plan adaptation**.
9. **Accessibility, responsive behaviour and performance tuning**.
10. **E2E lifecycle verification**.

So I **would not discard your current implementation plan**. Roughly 75–80% of it is in the right direction. The main correction is architectural: make the backend deliver an explicit dashboard state and evidence model, then let the UI render that truth. Otherwise `page.tsx` slowly becomes an unofficial analytics engine—the exact kind of hidden complexity Tellann is supposed to expose, not create.
