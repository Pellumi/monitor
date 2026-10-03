Yes. I would formalize this as a new platform subsystem rather than treating it as a few conditional sidebar checks.

The implementation should introduce an **Application Intelligence Profile** and a **Capability Resolution Layer** that determines, for every application, what Tellann has detected, what the user confirmed, what telemetry exists, what their plan allows, and therefore what the product should expose.

This fits the existing architecture well. Tellann already distinguishes frontend and backend capture, allows those capture tracks independently, performs local codebase analysis through the desktop agent, and requires entitlement decisions to come from a shared resolver. frs entitlement_spec Code-derived information is also already supposed to leave the desktop only as projections, not raw source. pdcs

# Tellann Application-Aware Capability System

## 1. Objective

The system should answer six questions whenever an application is opened:

```text
1. What kind of application is this?
2. What technical capabilities does the codebase contain?
3. What Tellann instrumentation is connected?
4. What evidence has Tellann actually received?
5. What features is this organization entitled to?
6. Given all of the above, what should Tellann expose?
```

The resulting architecture becomes:

```text
Local Codebase
      │
      ▼
Codebase Analyzer
      │
      ▼
Architecture Detection
      │
      ▼
Application Profile
      │
      ├──────── User Confirmation
      │
      ├──────── Telemetry/Evidence State
      │
      ├──────── Plan Entitlements
      │
      ├──────── User Permissions
      │
      ▼
Capability Resolver
      │
      ▼
Application Capability Snapshot
      │
      ├── Dashboard
      ├── Sidebar
      ├── Reports
      ├── Desktop Agent
      ├── APIs
      ├── Notifications
      └── Setup Guidance
```

The critical rule is:

> **Application type is an input into capability resolution. It is not the capability system itself.**

---

# 2. Core terminology

I recommend standardizing these concepts before implementation.

### Application Type

```ts
type ApplicationType =
  | "FRONTEND"
  | "BACKEND"
  | "MIXED"
  | "UNKNOWN";
```

`MIXED` means the application contains meaningful browser-facing and server-side execution surfaces.

### Detection source

Keep detected architecture and user confirmation separate.

```ts
interface ApplicationTypeResolution {
  detectedType: ApplicationType;
  confirmedType?: ApplicationType;
  effectiveType: ApplicationType;

  confidence: number;

  detectedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;

  analysisSnapshotId: string;
  detectorVersion: string;
}
```

The user confirmation should not erase Tellann's own observation.

For example:

```text
Tellann detected:
FRONTEND

User selected:
MIXED
```

Store both.

---

# 3. Do not stop at application type

A Next.js project demonstrates why.

Tellann may find:

```text
Next.js
├── React client components
├── Server components
├── API routes
├── Route handlers
├── Server actions
└── Middleware
```

Calling this merely `MIXED` loses useful information.

Add capability traits:

```ts
interface ApplicationTraits {
  browserSurface: boolean;

  frontendRuntime: boolean;
  backendRuntime: boolean;

  clientRouting: boolean;
  uiStateSurface: boolean;

  apiConsumer: boolean;
  apiProvider: boolean;

  serverActions: boolean;
  serverRendering: boolean;

  managedBrowserRunnable: boolean;
}
```

Then separately record instrumentation:

```ts
interface InstrumentationState {
  frontendSdk: boolean;
  backendSdk: boolean;

  browserObserver: boolean;

  frontendInstrumentationVersion?: string;
  backendInstrumentationVersion?: string;
}
```

And separately record evidence:

```ts
interface EvidenceState {
  frontendEventsSeen: boolean;
  backendEventsSeen: boolean;

  browserEventsSeen: boolean;

  sessionsSeen: boolean;
  inFlowEvidenceSeen: boolean;

  endpointEvidenceSeen: boolean;

  behaviorGraphExists: boolean;
  declaredIntentExists: boolean;

  lastFrontendEventAt?: string;
  lastBackendEventAt?: string;
}
```

This distinction will save you from a large number of future bugs.

---

# 4. The Capability Resolver

This becomes the central component.

Conceptually:

```ts
resolveApplicationCapabilities({
  productCapabilities,
  architectureProfile,
  instrumentationState,
  evidenceState,
  organizationEntitlements,
  userPermissions
})
```

It returns something like:

```ts
{
  FLOW_DECLARATION: {
    state: "AVAILABLE"
  },

  SESSION_REPLAY: {
    state: "AVAILABLE"
  },

  ENDPOINT_INTELLIGENCE: {
    state: "NEEDS_SETUP",
    reason: "BACKEND_SDK_NOT_CONNECTED"
  },

  ACCESSIBILITY_ANALYSIS: {
    state: "AVAILABLE"
  }
}
```

---

# 5. Capability states

Do not use only `true/false`.

Implement:

```ts
type CapabilityState =
  | "AVAILABLE"
  | "LIMITED"
  | "NEEDS_SETUP"
  | "WAITING_FOR_EVIDENCE"
  | "PLAN_LOCKED"
  | "NOT_AUTHORIZED"
  | "NOT_APPLICABLE"
  | "UNAVAILABLE";
```

Their meanings should be strict:

| State | Meaning |
|---|---|
| `AVAILABLE` | Fully usable |
| `LIMITED` | Applicable, but only partial evidence/capture exists |
| `NEEDS_SETUP` | Applicable, but instrumentation/configuration is missing |
| `WAITING_FOR_EVIDENCE` | Correctly configured, but insufficient evidence has been observed |
| `PLAN_LOCKED` | Applicable but unavailable under the current subscription |
| `NOT_AUTHORIZED` | Organization has it, user role cannot access it |
| `NOT_APPLICABLE` | Feature fundamentally does not apply to this application |
| `UNAVAILABLE` | Product capability has not shipped/is disabled |

This is one of the most important parts of the design.

---

# 6. Resolution order

The resolver should evaluate consistently.

```text
Feature shipped?
      ↓
User authorized?
      ↓
Organization entitled?
      ↓
Applicable to architecture?
      ↓
Required instrumentation present?
      ↓
Required evidence present?
      ↓
Full or partial evidence?
      ↓
AVAILABLE / LIMITED
```

Do not put this logic separately inside each React page.

There should be **one authoritative resolver**.

That mirrors the existing entitlement requirement that different platform surfaces must resolve entitlements through one shared mechanism rather than disagreeing about what a customer may do. entitlement_spec

---

# 7. Feature registry

Create a centrally defined capability registry.

For example:

```ts
interface CapabilityDefinition {
  key: string;
  name: string;

  productStatus:
    | "AVAILABLE"
    | "DISABLED"
    | "FUTURE";

  entitlementKey?: string;

  supportedApplicationTypes: ApplicationType[];

  requiredTraits?: string[];

  requiredInstrumentation?: string[];

  requiredEvidence?: string[];

  limitedModes?: CapabilityLimitedMode[];

  navigation: {
    section: string;
    route: string;
    visibilityPolicy: string;
  };

  reports?: string[];

  resolverVersion: number;
}
```

Example:

```ts
{
  key: "ENDPOINT_INTELLIGENCE",

  supportedApplicationTypes: [
    "BACKEND",
    "MIXED",
    "FRONTEND"
  ],

  requiredEvidence: [
    "API_ACTIVITY"
  ],

  limitedModes: [
    {
      when: "FRONTEND_EVENTS_ONLY",
      label: "CLIENT_API_ACTIVITY"
    }
  ]
}
```

Do not hardcode rules into components such as:

```ts
if (project.type === "BACKEND") {
   showEndpoints();
}
```

That approach will collapse once you support serverless applications, monorepos, mobile applications, SSR, microservices, edge functions, etc.

---

# 8. Application classification engine

This belongs primarily in the **desktop Codebase Analyzer**.

Your current component design already assigns the local analyzer responsibility for code graph construction, checkpoint location, warnings and analysis projections, with source remaining local. component_design

Extend that analyzer.

## Signals to inspect

### Package/manifests

Examples:

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
```

Future language support:

```text
requirements.txt
pyproject.toml
pom.xml
build.gradle
go.mod
Cargo.toml
```

### Framework configuration

Examples:

```text
next.config.*
vite.config.*
nuxt.config.*
angular.json
nest-cli.json
```

### Source topology

Look for:

```text
src/components
src/pages
src/app

controllers
routes
middleware
services
api
server
```

### Imports/dependencies

Detect structural indicators such as:

```text
react
react-dom
next
express
fastify
@nestjs/*
```

### Runtime entrypoints

For example:

```text
server.ts
index.ts
app.ts
main.ts
```

### Route definitions

Distinguish:

```text
browser routes

vs

server/API routes
```

### API providers vs API consumers

This distinction matters greatly.

A React project might make 100 API requests while owning zero API endpoints.

So classify:

```text
apiConsumer = true
apiProvider = false
```

rather than declaring:

```text
backendRuntime = true
```

---

# 9. Detection scoring

Never classify from one signal.

For example:

```text
React dependency       +25
Browser entrypoint     +25
Client router          +20
DOM usage              +15

Express dependency     +25
Server entrypoint      +25
HTTP routes            +30
Server middleware      +15
```

Conceptually:

```text
Frontend score: 85
Backend score: 10

→ FRONTEND
Confidence: HIGH
```

Or:

```text
Frontend score: 84
Backend score: 78

→ MIXED
Confidence: HIGH
```

Or:

```text
Frontend score: 22
Backend score: 19

→ UNKNOWN
Confidence: LOW
```

Do not expose arbitrary percentages as though they represent statistical probability. Internally it can simply be a normalized heuristic score.

---

# 10. User confirmation workflow

After analysis:

```text
Workspace analysis complete

Detected architecture

MIXED APPLICATION

Frameworks
Next.js
React
Node.js

Detected capabilities
✓ Browser UI
✓ Client routing
✓ Server runtime
✓ API routes

Confidence
High

[ Confirm ]

Architecture incorrect?
[ Change ]
```

If changing:

```text
Frontend
Backend
Mixed
Other / Unknown
```

Record:

```text
detectedType
confirmedType
confirmationTimestamp
confirmingUser
analysisSnapshot
```

Never overwrite `detectedType`.

---

# 11. Reconfirmation rules

Do not ask after every scan.

Prompt again only when there is a material architecture change.

For example:

```text
Previous

FRONTEND

New analysis

Browser UI      ✓
Server runtime  ✓
API routes      ✓

Tellann detected that this application
may now be mixed/full-stack.

[ Review architecture ]
```

Possible triggers:

```text
new runtime detected
frontend removed
backend removed
API provider introduced
framework changed
repository root changed
workspace changed substantially
```

---

# 12. Profile versioning

Architecture information must be versioned.

```ts
interface ApplicationProfileRevision {
  id: string;
  applicationId: string;

  detectedType: ApplicationType;
  confirmedType?: ApplicationType;

  traits: ApplicationTraits;

  frameworks: DetectedFramework[];

  snapshotId: string;
  detectorVersion: string;

  createdAt: string;
}
```

This becomes important when somebody asks:

> Why did Endpoint Intelligence disappear?

Tellann can answer:

```text
Endpoint Intelligence changed from AVAILABLE
to NOT_APPLICABLE after workspace analysis
snapshot abc42.

Server routes were no longer detected.
```

---

# 13. Framework support and framework detection must remain separate

This is particularly important given your examples.

Your current Phase 1 specification supports the frontend stack around JavaScript/TypeScript, React and Next.js, and the backend stack around Node.js, Express, Fastify and NestJS. mvp_scope

The SDK specification currently marks Vue as future support. sdk_spec

Therefore Tellann may detect:

```text
Framework:
Vue

Architecture:
Frontend

Tellann support:
Unsupported / planned
```

Those are different facts.

Likewise:

```text
Framework:
Django

Architecture:
Backend

Tellann support:
Backend SDK unavailable
```

You should still recognize the architecture.

You just shouldn't pretend Tellann can instrument it yet.

---

# 14. Capability applicability matrix

For the initial implementation, I would use the following.

| Capability | Frontend | Backend | Mixed |
|---|---:|---:|---:|
| Application Overview | ✅ | ✅ | ✅ |
| Codebase Intelligence | ✅ | ✅ | ✅ |
| Flow Declaration | ✅ | ✅ | ✅ |
| Reconciliation | ✅ | ✅ | ✅ |
| Behavior Graph | ✅ | ✅ | ✅ |
| Workflow Discovery | ✅ | ✅* | ✅ |
| Coverage | ✅ | ✅* | ✅ |
| Missing Flows | ✅ | Limited* | ✅ |
| Missing States | ✅ | Limited* | ✅ |
| Session Timeline | ✅ | ✅ | ✅ |
| Browser Replay | ✅ | ❌ | ✅ |
| UI Interaction Analysis | ✅ | ❌ | ✅ |
| Visual Analysis | ✅ | ❌ | ✅ |
| Accessibility Analysis | ✅ | ❌ | ✅ |
| Browser Trace | ✅ | ❌ | ✅ |
| Client API Activity | ✅ | ❌ | ✅ |
| Endpoint Intelligence | Limited | ✅ | ✅ |
| Server Error Analysis | ❌ | ✅ | ✅ |
| Server Latency | ❌ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |

`*` Backend behavioral analysis should only be enabled to the extent that its deterministic engines understand the available server-side states/workflows.

Do not manufacture backend equivalents merely for symmetry.

---

# 15. Flow Declaration remains cross-platform

This should not be removed from backend projects.

The current requirements explicitly define flow declaration as something users can create **before telemetry exists**, stored independently from observed behavior. frs

Frontend terminology:

```text
Checkout Flow

Product page
→ Cart
→ Checkout
→ Payment
→ Confirmation
```

Backend terminology:

```text
Checkout Service Flow

POST /checkout
→ Validate Cart
→ Reserve Stock
→ Charge Payment
→ Create Order
→ Return Response
```

Mixed:

```text
Checkout

Checkout UI
→ POST /checkout
→ Payment Processing
→ Order Created
→ Confirmation UI
```

The visual editor can therefore adapt its node palette based on application capabilities.

---

# 16. Missing States / Missing Flows

Be cautious here.

Your existing MVP defines missing states largely around things such as:

```text
Loading
Empty
Error
Recovery
404
Authentication Error
```

and missing flows around failure, recovery, alternative and edge-case paths. mvp_scope

Do not immediately generalize all those rules to backend systems.

Instead introduce rule scopes:

```ts
type RuleScope =
  | "FRONTEND"
  | "BACKEND"
  | "CROSS_LAYER";
```

Example:

```text
EMPTY_CART
scope = FRONTEND
```

while:

```text
PAYMENT_TIMEOUT
scope = CROSS_LAYER
```

and perhaps:

```text
UNHANDLED_5XX_RESPONSE
scope = BACKEND
```

Only run applicable rule packs.

---

# 17. Endpoint Intelligence

The current specification defines Endpoint Intelligence around latency, request volume, error rates, rankings and optimization suggestions. mvp_scope

Treat it differently by evidence source.

### Frontend-only

Show:

```text
API Activity
```

Possible:

```text
Observed requests
Failed requests
Client-observed latency
HTTP status
External API destinations
```

Banner:

```text
Limited visibility

Tellann is observing requests from the browser,
but server telemetry is not connected.

[ Connect backend telemetry ]
```

Do not claim:

```text
server execution time
controller duration
database duration
internal service timing
```

### Backend

Show full:

```text
Endpoint Intelligence
```

### Mixed

Correlate:

```text
Browser request
     │
     traceId
     ▼
Backend request
     │
     ▼
Endpoint execution
```

The canonical event model already contains `source` and optional `traceId` specifically for frontend/backend correlation. event_taxonomy

---

# 18. Session presentation

Don't remove sessions from backend projects.

Instead distinguish:

```text
Session Timeline
```

from:

```text
Browser Replay
```

Frontend:

```text
PAGE_VIEW
BUTTON_CLICK
FORM_SUBMIT
API_REQUEST
ROUTE_CHANGE
```

Backend:

```text
API_REQUEST
AUTHORIZATION
API_RESPONSE
ERROR
WORKFLOW_EVENT
```

Mixed:

```text
BUTTON_CLICK
     ↓
API_REQUEST
     ↓
SERVER_PROCESSING
     ↓
API_RESPONSE
     ↓
UI_STATE_CHANGE
```

Session Replay is already defined as reconstruction from telemetry rather than merely screen video. session_replay

---

# 19. Evidence Summary Service

Do not make the capability resolver repeatedly query raw event stores.

Create an aggregate such as:

```ts
interface ApplicationEvidenceSummary {
  applicationId: string;

  frontendEventCount: number;
  backendEventCount: number;

  frontendLastSeenAt?: string;
  backendLastSeenAt?: string;

  sessionCount: number;
  runCount: number;

  inFlowEventCount: number;

  endpointCount: number;

  observedStateCount: number;
  observedWorkflowCount: number;

  declaredFlowCount: number;

  behaviorGraphVersion?: string;

  updatedAt: string;
}
```

Update it asynchronously as evidence is processed.

---

# 20. Database additions

I would add four logical entities.

### `application_architecture_profiles`

```text
application_id
detected_type
confirmed_type
confidence
frameworks
traits
analysis_snapshot_id
detector_version
detected_at
confirmed_at
confirmed_by
```

### `application_profile_revisions`

Immutable history.

### `application_evidence_summary`

Fast aggregate for readiness decisions.

### `application_capability_snapshots`

```text
application_id
capability_key
state
reason_code
resolver_version
profile_revision_id
evidence_revision
resolved_at
```

You do not necessarily need to persist every resolution forever. Store latest state and append meaningful state-change records for audit/history.

---

# 21. Capability reason codes

Never expose only:

```text
Unavailable
```

Use deterministic reasons.

Examples:

```text
NO_BROWSER_SURFACE

NO_SERVER_RUNTIME

BACKEND_SDK_NOT_CONNECTED

FRONTEND_SDK_NOT_CONNECTED

AWAITING_FIRST_RUN

NO_IN_FLOW_EVIDENCE

NO_ENDPOINT_EVIDENCE

UNSUPPORTED_FRAMEWORK

PLAN_ENTITLEMENT_MISSING

ROLE_PERMISSION_MISSING

APPLICATION_PROFILE_UNKNOWN

APPLICATION_ANALYSIS_STALE
```

Then UI copy becomes predictable.

---

# 22. APIs to add

Your current application API already exposes application CRUD, stats, onboarding progress and SDK setup. api_spec

I would extend it with:

```http
GET /applications/{applicationId}/architecture

PATCH /applications/{applicationId}/architecture/confirmation

GET /applications/{applicationId}/capabilities

GET /applications/{applicationId}/evidence-summary

GET /applications/{applicationId}/architecture/history
```

Desktop/internal:

```http
POST /applications/{applicationId}/analysis-projections

POST /applications/{applicationId}/architecture/detection
```

Possible response:

```json
{
  "applicationType": "MIXED",
  "frameworks": ["nextjs", "react", "node"],
  "confidence": "HIGH",

  "traits": {
    "browserSurface": true,
    "backendRuntime": true,
    "apiProvider": true
  }
}
```

Capabilities:

```json
{
  "capabilities": {
    "FLOW_DECLARATION": {
      "state": "AVAILABLE"
    },
    "ENDPOINT_INTELLIGENCE": {
      "state": "NEEDS_SETUP",
      "reason": "BACKEND_SDK_NOT_CONNECTED"
    }
  }
}
```

---

# 23. Backend enforcement is mandatory

The dashboard hiding a link is not security or entitlement enforcement.

If:

```text
Endpoint Intelligence
NOT_AUTHORIZED
```

the API must reject access.

If:

```text
PLAN_LOCKED
```

the API must enforce the entitlement.

If:

```text
NOT_APPLICABLE
```

an analysis job should not waste resources trying to generate it.

Therefore the resolver should be consumable by:

```text
Dashboard API
Analytics services
Reporting system
Desktop agent
Notification system
Export system
```

not merely React.

---

# 24. Adaptive sidebar

Instead of static navigation:

```ts
const navigation = [...]
```

use:

```text
Navigation Definition
        +
Capability Snapshot
        +
Permissions
        ↓
Resolved Navigation
```

Frontend example:

```text
Overview

Behavior
├─ Sessions
├─ Behavior Graph
├─ Flows
├─ Coverage
├─ Missing States
└─ Missing Flows

Quality
├─ Reconciliation
└─ Reports
```

Backend:

```text
Overview

Behavior
├─ Sessions
├─ Behavior Graph
├─ Service Flows
└─ Coverage

API Intelligence
├─ Endpoints
├─ Errors
└─ Performance

Quality
├─ Reconciliation
└─ Reports
```

Mixed:

```text
Overview

Behavior
├─ Sessions
├─ Behavior Graph
├─ Flows
├─ Coverage
├─ Missing States
└─ Missing Flows

API Intelligence
├─ Endpoints
├─ Errors
└─ Performance

Quality
├─ Reconciliation
└─ Reports
```

---

# 25. When to hide and when not to hide

Use this policy.

### `NOT_APPLICABLE`

Hide from normal navigation.

Example:

```text
Accessibility Analysis
```

for a headless Node service.

### `NEEDS_SETUP`

Show.

Example:

```text
Endpoint Intelligence

Backend detected
Connect backend telemetry →
```

The user should know value is available.

### `WAITING_FOR_EVIDENCE`

Show.

Example:

```text
No endpoints observed yet.

Complete a QA run to populate this view.
```

### `PLAN_LOCKED`

Usually show locked if it is a useful upgrade path.

### `LIMITED`

Show with explanation.

### `NOT_AUTHORIZED`

Hide or show disabled depending on role UX and security requirements.

---

# 26. Direct-route behavior

If somebody manually enters:

```text
/apps/123/endpoints
```

for a frontend-only app, do not return:

```text
404
```

Return:

```text
Endpoint Intelligence is not applicable
to the current application architecture.

Detected:
Frontend application

Server runtime:
Not detected

Last analyzed:
...

[ Review architecture ]
```

This makes the system explain itself.

---

# 27. Dashboard cards

The overview must also adapt.

Frontend:

```text
Workflow Coverage
Missing States
Missing Flows
Sessions
Reconciliation
```

Backend:

```text
Endpoint Health
API Errors
Service Coverage
Sessions
Reconciliation
```

Mixed:

```text
Workflow Coverage
Missing States
Endpoint Health
Cross-layer Failures
Sessions
Reconciliation
```

Do not fill unavailable cards with zeros.

```text
Slow endpoints: 0
```

means something completely different from:

```text
Endpoint telemetry unavailable
```

---

# 28. Reports must become capability-aware

Your reporting specification currently includes both behavioral and Endpoint Intelligence reports. qrs

The report generator should therefore build sections based on the capability snapshot used at generation time.

Frontend:

```text
Evidence Basis
Workflow Summary
Coverage
Missing States
Missing Flows
Reconciliation
Client API Activity
```

Backend:

```text
Evidence Basis
Service Workflow Summary
Coverage
Endpoints
Server Errors
Reconciliation
```

Mixed:

```text
Evidence Basis
End-to-End Workflows
Coverage
Missing States
Missing Flows
Endpoint Intelligence
Reconciliation
```

Reports must explicitly say:

```text
Evidence Basis

Frontend telemetry: Connected
Backend telemetry: Not connected
Browser evidence: Present
Declared intent: Present
```

This prevents readers from treating missing evidence as a clean bill of health.

---

# 29. Historical reports

Never rewrite historical reports when an application's type changes.

Suppose:

```text
September 1
MIXED

September 20
backend removed

October 1
FRONTEND
```

A September endpoint report remains valid historical evidence.

Store the relevant:

```text
architectureProfileRevisionId
capabilitySnapshotId
evidenceBasis
```

on each generated report.

---

# 30. Desktop agent changes

Extend the existing analysis lifecycle:

```text
Bind Workspace
     ↓
Snapshot Repository
     ↓
Analyze Codebase
     ↓
Build Code Graph
     ↓
Detect Architecture
     ↓
Detect Frameworks
     ↓
Detect Capabilities
     ↓
Generate Profile Projection
     ↓
Upload Projection
     ↓
User Confirmation
     ↓
Instrumentation Planning
```

The current architecture already requires local code analysis, local source retention, and projection-only output. component_design

---

# 31. Instrumentation planning must use the profile

Frontend:

```text
Frontend SDK
Browser Observer
Client interaction instrumentation
```

Backend:

```text
Backend SDK
Request middleware
Error interception
Trace correlation
```

Mixed:

```text
Frontend SDK
+
Backend SDK
+
trace correlation
```

The current MVP already supports frontend and backend capture tracks independently. frs

---

# 32. Event taxonomy additions

You will likely need platform events such as:

```text
APPLICATION_ARCHITECTURE_DETECTED

APPLICATION_ARCHITECTURE_CONFIRMED

APPLICATION_ARCHITECTURE_CHANGED

APPLICATION_CAPABILITIES_RESOLVED

APPLICATION_CAPABILITY_CHANGED

APPLICATION_INSTRUMENTATION_CHANGED
```

These should be operational/product events, not customer behavior events where inappropriate.

Your taxonomy requires registered event types rather than arbitrary event names, so any new events must be formally added before emitters start sending them. event_taxonomy

Useful metadata:

```json
{
  "applicationId": "...",
  "previousType": "FRONTEND",
  "newType": "MIXED",
  "source": "CODEBASE_ANALYSIS",
  "snapshotId": "...",
  "detectorVersion": "1"
}
```

---

# 33. Caching and invalidation

Capability resolution is read frequently.

Don't recalculate everything on every page request.

Cache:

```text
ApplicationCapabilitySnapshot
```

Recompute when:

```text
architecture changes
user confirms type
instrumentation changes
new evidence type first appears
plan changes
role changes
feature rollout changes
resolver version changes
```

Typical telemetry events should **not** trigger full recomputation.

The first backend event might.

The next million shouldn't.

---

# 34. Product analytics

Track whether your detection is actually working.

Metrics:

```text
Detection confirmation rate

Manual override rate

FRONTEND → MIXED changes

MIXED → FRONTEND changes

UNKNOWN classifications

Unsupported-framework rate

Capability NEEDS_SETUP → AVAILABLE conversion

Misclassification reports

Average time from workspace binding
to confirmed architecture
```

Particularly important:

```text
manualOverrideRateByFramework
```

If 40% of Next.js applications are corrected by users, your classifier is wrong.

---

# 35. Security and privacy requirements

Architecture detection runs locally.

Transmit things like:

```text
framework identifiers
runtime identifiers
file/symbol paths where permitted
capability traits
code graph topology
analysis warnings
```

Do not transmit source merely to classify a project.

This follows Tellann's current privacy model, where code-derived projections may cross the boundary but source contents must not without consent. pdcs

Also never include secrets in detection outputs.

---

# 36. Scope

## In scope

For this functionality specifically:

- Application architecture detection.
- `FRONTEND`, `BACKEND`, `MIXED`, `UNKNOWN` classification.
- Framework detection.
- Capability-trait extraction.
- Detection confidence.
- User confirmation/correction.
- Architecture profile revisions.
- Re-analysis after repository changes.
- Evidence summary.
- Instrumentation-state tracking.
- Central capability registry.
- Central capability resolver.
- Capability reason codes.
- Adaptive dashboard.
- Adaptive sidebar.
- Adaptive feature routes.
- Adaptive empty states.
- Adaptive QA reports.
- Desktop agent integration.
- API enforcement.
- Entitlement integration.
- RBAC integration.
- Capability cache/invalidation.
- Audit trail.
- Analytics/observability.
- Migration of existing applications.

## Explicitly out of scope

For this change, do **not** automatically add:

- Python/Django telemetry SDK.
- Vue telemetry support where it remains unsupported.
- Java/Spring SDK.
- Go SDK.
- Mobile SDKs.
- Production monitoring.
- Real-user monitoring.
- Phase 2 intelligence.
- New AI-driven analytical conclusions.
- Headless API demonstration runner.
- Autonomous testing.
- Automatic splitting of every monorepo into applications.
- Arbitrary source-code upload.
- Rewriting all analytics engines for every application type.

Production monitoring and continuous real-user ingestion are explicitly outside the current Phase 1 MVP. mvp_scope

---

# 37. Important current gap: backend-only demonstrations

There is an existing architectural tension worth documenting.

The current Phase 1 demonstration flow depends on a managed browser session. mvp_scope

But backend SDK capture is also part of Phase 1.

Therefore a truly headless application such as:

```text
payments-api
inventory-service
auth-service
```

has no natural browser walkthrough.

For this implementation:

```text
BACKEND application
+
no browser target
```

should be classified correctly, but Tellann must not pretend the normal guided browser run applies.

Expose something like:

```text
Guided Browser Demonstration
Not applicable to this application.

Backend telemetry can still be configured.
```

A future:

```text
API Demonstration Runner
```

would solve this, but that is a separate product capability and should not sneak into this implementation.

---

# 38. Monorepo gap

Example:

```text
repo/
├── apps/web
├── apps/admin
├── services/api
└── services/payments
```

The repository itself is:

```text
MIXED
```

but that doesn't necessarily mean one Tellann application should represent all four.

For v1:

```text
Monorepo detected.

Select the workspace this Tellann application represents:

○ apps/web
○ apps/admin
○ services/api
○ services/payments
○ Entire repository
```

Store:

```text
workspaceRoot
```

against the binding.

Do not attempt automatic product-boundary inference initially.

---

# 39. External APIs used by frontend applications

This is another major trap.

Suppose React calls:

```text
api.stripe.com
api.example.com
maps.googleapis.com
```

That does not make the React project a backend project.

Use:

```text
apiConsumer = true
apiProvider = false
```

Endpoint Intelligence must distinguish:

```text
Consumed APIs
```

from:

```text
Owned server endpoints
```

---

# 40. Serverless / edge architectures

A project may have no traditional server folder but contain:

```text
/api/*
serverless functions
edge handlers
cloud functions
Next route handlers
```

Therefore:

```text
backendRuntime
```

should really mean:

> code executes in a server-controlled execution context

—not:

> `/server` folder exists.

---

# 41. Manual override drift

Possible:

```text
Tellann detects:
BACKEND

User confirms:
FRONTEND
```

Don't silently pick one.

Store both and expose:

```text
Architecture disagreement

Tellann continues to detect backend execution,
while this application is manually classified
as frontend.

[ Review ]
```

Capability resolution should still use actual evidence conservatively.

A manual label must never conjure nonexistent evidence.

---

# 42. Stale analysis

Codebases change.

Store:

```text
analysisSnapshotId
repositorySnapshotId
analyzedCommit
analyzedAt
```

If:

```text
current snapshot != analyzed snapshot
```

show:

```text
Architecture analysis may be outdated.

[ Analyze again ]
```

Do not immediately disable features simply because the latest repository hasn't been rescanned.

---

# 43. Telemetry contradicting classification

Suppose:

```text
Application profile:
FRONTEND
```

but Tellann receives legitimate:

```text
source = backend-sdk
```

Do not discard the events.

Instead:

```text
Backend telemetry detected.

This application may now be mixed.

[ Review architecture ]
```

Capabilities such as endpoint intelligence can become temporarily:

```text
LIMITED
```

until the architecture is reconciled.

---

# 44. Missing evidence vs feature irrelevance

These must never be confused.

```text
0 backend events
```

could mean:

```text
Frontend-only project
→ NOT_APPLICABLE
```

or:

```text
Backend project
SDK not installed
→ NEEDS_SETUP
```

or:

```text
Backend SDK installed
No run yet
→ WAITING_FOR_EVIDENCE
```

or:

```text
Backend project
Events arriving
→ AVAILABLE
```

The resolver exists precisely to distinguish these cases.

---

# 45. Unsupported frameworks

Tellann should still classify them.

Example:

```text
Django detected

Architecture
Backend

Framework support
Not currently supported

Available
✓ Flow Declaration
✓ Codebase profile

Unavailable
Backend telemetry

Reason
No supported Django SDK
```

This is much better than:

```text
Unknown project
```

---

# 46. External tools

The good news is that **no additional external SaaS platform is fundamentally required**.

Your existing MVP already specifies Electron, Chromium, Kafka, PostgreSQL, ClickHouse, object storage, Next.js and the local desktop analyzer. mvp_scope

For implementation, I would consider:

### TypeScript compiler tooling

For currently supported JS/TS ecosystems:

```text
TypeScript Compiler API
```

or an AST wrapper such as:

```text
ts-morph
```

Useful for:

```text
imports
exports
symbols
entrypoints
route definitions
framework APIs
```

### Tree-sitter — optional

Useful once Tellann starts detecting many languages.

```text
JavaScript
TypeScript
Python
Java
Go
Rust
...
```

I would not require it for the first JS/TS-only implementation.

### Schema validation

Use whatever validation mechanism already fits your services; for a TypeScript implementation, a schema-validation library can validate architecture projections and capability rules.

### Observability

Use your existing structured logging/metrics infrastructure. The NFR already requires platform services and analytics jobs to expose operational telemetry and execution information. nrs

No LLM should be required for determining application type.

Architecture detection should be deterministic.

---

# 47. Do not use AI as the classifier

An LLM could assist someday with ambiguous architectures, but it should not be authoritative.

Prefer:

```text
Repository evidence
+
AST/code graph
+
known framework signatures
+
runtime structures
+
telemetry evidence
+
human confirmation
```

Tellann's current architecture deliberately separates deterministic analytics from assistive language-model functionality.

This feature belongs in the deterministic path.

---

# 48. Implementation phases

## Phase A — Specification and domain model

Update:

```text
PRD
FRS
API Specification
Component Design
Data Flow
Event Taxonomy
Entitlement Specification
Desktop Agent specification
QA Report specification
```

Introduce formal concepts:

```text
ApplicationArchitectureProfile
ApplicationTraits
EvidenceSummary
CapabilityDefinition
CapabilityState
CapabilitySnapshot
```

Do this before coding.

---

## Phase B — Capability registry

Build the static/declarative capability catalogue first.

Define every existing Tellann feature:

```text
FLOW_DECLARATION
WORKFLOW_DISCOVERY
BEHAVIOR_GRAPH
SESSION_REPLAY
COVERAGE
MISSING_STATES
MISSING_FLOWS
ENDPOINT_INTELLIGENCE
RECONCILIATION
QA_REPORTS
CODEBASE_INTELLIGENCE
BROWSER_TRACE
VISUAL_ANALYSIS
...
```

For every capability define:

```text
applicability
required evidence
required setup
entitlement
permission
limited modes
navigation
report behavior
```

---

## Phase C — Local architecture detector

Implement:

```text
framework scanner
manifest scanner
AST/code graph inspection
browser-surface detection
server-runtime detection
API provider detection
API consumer detection
hybrid detection
confidence calculation
```

Output only projections.

---

## Phase D — Architecture profile service

Implement persistence, revisions and confirmation.

Support:

```text
Detected
Confirmed
Effective
Historical
Stale
Disputed
```

states.

---

## Phase E — Evidence summary

Implement aggregation from:

```text
frontend-sdk
backend-sdk
browser-observer
desktop-agent
session engine
graph engine
endpoint engine
```

The event model already distinguishes event sources and carries correlation information. event_taxonomy

---

## Phase F — Capability resolver

Make it a deterministic service/library.

Inputs:

```text
Product Status
Architecture
Traits
Instrumentation
Evidence
Entitlements
Permissions
```

Outputs:

```text
State
Reason
Available mode
Setup CTA
```

Unit test this extremely heavily.

---

## Phase G — API integration

Expose:

```text
architecture
capabilities
evidence
confirmation
history
```

and use the resolver inside protected APIs.

---

## Phase H — Dashboard adaptation

Update:

```text
sidebar
overview
feature routes
cards
search
breadcrumbs
application switcher
settings
empty states
setup flows
```

Do not let each page invent its own logic.

---

## Phase I — Desktop adaptation

Use the same resolved capabilities for:

```text
instrumentation planning
run preparation
capture-track selection
setup warnings
unsupported-framework messages
```

---

## Phase J — Reporting

Make report composition depend on evidence and capabilities.

Stamp reports with:

```text
profileRevision
capabilitySnapshot
evidenceBasis
```

---

## Phase K — Notifications

Do not send:

```text
Endpoint health degraded
```

for an application with no endpoint intelligence.

Notification eligibility should consult the same capability resolver.

---

## Phase L — Migration

Existing applications start as:

```text
UNKNOWN
analysisStatus = NEEDS_ANALYSIS
```

Do not guess based on historical application names.

When desktop agent next binds:

```text
Analyze
→ Detect
→ Confirm
→ Resolve
```

Existing telemetry can provide supporting signals but should not overwrite profile history.

---

# 49. Rollout strategy

Do not switch the entire dashboard in one deployment.

Use stages:

```text
1. Observe-only classifier
2. Compare detection against users internally
3. Add confirmation UI
4. Generate capability snapshots
5. Adaptive dashboard cards
6. Adaptive sidebar
7. Backend enforcement
8. Adaptive reporting
9. Remove old static capability assumptions
```

During early rollout, log disagreements between:

```text
old behavior
vs
new capability resolver
```

without changing the customer's experience.

---

# 50. Main failure scenarios and mitigations

| Risk | Mitigation |
|---|---|
| Next.js misclassified | Trait-based detection, not framework-name classification |
| Frontend consuming APIs marked backend | Separate `apiConsumer` from `apiProvider` |
| Monorepo falsely becomes one mixed app | Bind explicit workspace root |
| Backend SDK missing | `NEEDS_SETUP`, not `NOT_APPLICABLE` |
| No run yet | `WAITING_FOR_EVIDENCE`, not empty metrics |
| User chooses wrong type | Preserve detected + confirmed values |
| Repository evolves | Snapshot-based re-analysis |
| Unsupported framework | Detect architecture but mark adapter unsupported |
| Historical report disappears | Preserve report capability/evidence snapshot |
| Frontend gets server performance claims | Client API Activity mode only |
| Backend gets fake browser replay | Timeline only |
| Plan gating disagrees with dashboard | Shared resolver |
| UI hides feature but API allows it | Resolver enforced server-side |
| Feature state oscillates | Versioned snapshots and event-driven invalidation |
| Missing-state false positives | Architecture-specific rule packs |
| Source-code privacy leak | Projection-only architecture analysis |
| Every telemetry event causes recompute | Evidence threshold/state-change triggers |
| Classifier becomes unmaintainable | Detection adapters + capability registry |
| New framework requires dashboard rewrite | Trait-based capability logic |
| User can't understand hidden features | Explainable direct-route/architecture page |

---

# 51. Testing strategy

You need far more than React tests for this.

### Unit tests

Classifier fixtures:

```text
React/Vite
Next.js frontend-only
Next.js mixed
Express
NestJS
Fastify
unknown JS project
monorepo
unsupported Vue
unsupported Django
```

Capability resolver:

```text
type × telemetry × entitlement × permission × evidence
```

This should be table-driven.

### Integration tests

Test:

```text
Desktop analyzer
→ profile API
→ database
→ capability resolver
→ dashboard API
```

### End-to-end tests

Examples:

```text
React project
→ endpoint nav hidden

Express project
→ visual analysis hidden

Next mixed project
→ both areas visible

Backend project without SDK
→ Endpoint Intelligence shows setup state

Backend project after telemetry
→ Endpoint Intelligence becomes available
```

### Regression tests

Every newly supported framework gets a permanent classification fixture.

---

# 52. Performance requirements

Capability lookup will occur on almost every application page.

Target:

```text
Application profile:
cached

Capability snapshot:
cached

Evidence summary:
pre-aggregated
```

Avoid:

```text
load page
→ scan ClickHouse
→ inspect sessions
→ inspect endpoints
→ calculate applicability
```

That would be unnecessarily expensive.

Your NFR already requires normal dashboard pages to remain fast and encourages configuration-driven behavior. nrs

---

# 53. Administrative tooling

Give internal Tellann admins a diagnostic screen:

```text
Application

Detected:
MIXED

Confirmed:
MIXED

Frameworks:
Next.js
React

Traits:
browserSurface       true
backendRuntime       true
apiProvider          true

Evidence:
frontend             connected
backend              connected

Capabilities:

Flow Declaration        AVAILABLE
Missing States          AVAILABLE
Endpoint Intelligence   AVAILABLE
Visual Analysis         AVAILABLE

Resolver:
v3
```

This will be invaluable when customers report:

> Why can't I see Endpoint Intelligence?

---

# 54. User-facing architecture settings

Add something like:

```text
Settings
→ Application
→ Architecture
```

Show:

```text
Application type
Mixed

Detected frameworks
Next.js
React
Node.js

Browser surface
Detected

Backend runtime
Detected

API provider
Detected

Frontend telemetry
Connected

Backend telemetry
Connected

Last analyzed
...

[ Analyze again ]
[ Review classification ]
```

This makes the adaptive dashboard explainable rather than magical.

---

# 55. Production-readiness checklist

Use this as the final acceptance gate.

### Architecture detection

- [ ] FRONTEND detection implemented.
- [ ] BACKEND detection implemented.
- [ ] MIXED detection implemented.
- [ ] UNKNOWN fallback implemented.
- [ ] Framework detection implemented.
- [ ] Trait detection implemented.
- [ ] API consumer/provider distinction implemented.
- [ ] Confidence model implemented.
- [ ] Detection version recorded.
- [ ] Repository snapshot recorded.
- [ ] Monorepo handling implemented.
- [ ] Unsupported-framework state implemented.

### Confirmation

- [ ] User can confirm detection.
- [ ] User can correct detection.
- [ ] Detected value remains preserved.
- [ ] Confirmed value remains preserved.
- [ ] Effective value is deterministic.
- [ ] Confirmation is audited.
- [ ] Material architecture changes trigger review.

### Data

- [ ] Architecture profile persisted.
- [ ] Profile revision history persisted.
- [ ] Evidence summary implemented.
- [ ] Instrumentation state implemented.
- [ ] Historical reports preserve old profile information.
- [ ] Raw source is not transmitted.

### Capability system

- [ ] Capability registry exists.
- [ ] Every Phase 1 feature is registered.
- [ ] Applicability rules defined.
- [ ] Setup requirements defined.
- [ ] Evidence requirements defined.
- [ ] Entitlement key defined.
- [ ] Permission requirements defined.
- [ ] LIMITED behavior defined.
- [ ] Reason codes defined.
- [ ] Resolver is deterministic.
- [ ] Resolver is versioned.
- [ ] Resolver has exhaustive unit tests.

### UI

- [ ] Sidebar uses resolver.
- [ ] Dashboard cards use resolver.
- [ ] Feature pages use resolver.
- [ ] Settings use resolver.
- [ ] Search uses resolver.
- [ ] Breadcrumbs remain valid.
- [ ] Direct URLs explain unavailable capabilities.
- [ ] `NOT_APPLICABLE` does not appear as zero metrics.
- [ ] `NEEDS_SETUP` provides a setup CTA.
- [ ] `WAITING_FOR_EVIDENCE` explains what must happen next.
- [ ] `LIMITED` explains what evidence is missing.
- [ ] `PLAN_LOCKED` integrates with upgrade UX.

### Frontend projects

- [ ] Frontend behavioral functionality appears.
- [ ] Browser/session functionality appears.
- [ ] Backend-only telemetry does not appear.
- [ ] Client API activity is distinguished from server intelligence.
- [ ] Accessibility/visual analysis remains available where supported.

### Backend projects

- [ ] Endpoint Intelligence appears when supported.
- [ ] Backend errors/performance appear.
- [ ] Browser-only features disappear.
- [ ] Browser replay is not fabricated.
- [ ] Session timelines remain usable.
- [ ] Flow Declaration remains available.
- [ ] Browser demonstration limitation is clearly handled.

### Mixed projects

- [ ] Frontend and backend telemetry can coexist.
- [ ] Trace correlation works.
- [ ] Both capability families appear.
- [ ] Cross-layer sessions remain coherent.
- [ ] Reports identify frontend/backend evidence separately.

### Reports

- [ ] Reports consult capability snapshot.
- [ ] Evidence basis appears in reports.
- [ ] Irrelevant sections are omitted.
- [ ] Missing telemetry is not reported as zero.
- [ ] Historical reports remain unchanged.
- [ ] Export formats behave consistently.

### Backend/API enforcement

- [ ] Hiding navigation is not the only enforcement.
- [ ] Entitlements enforced server-side.
- [ ] RBAC enforced server-side.
- [ ] Unsupported analytical jobs are not scheduled.
- [ ] Direct API requests cannot bypass gating.

### Desktop agent

- [ ] Architecture detection runs locally.
- [ ] Projection format implemented.
- [ ] Source remains local.
- [ ] Analyzer can be cancelled.
- [ ] Analyzer can resume.
- [ ] Instrumentation uses resolved application traits.
- [ ] Correct capture tracks are selected.

### Change handling

- [ ] Re-analysis occurs after meaningful repository change.
- [ ] Stale analysis can be detected.
- [ ] FRONTEND → MIXED works.
- [ ] MIXED → FRONTEND works.
- [ ] BACKEND → MIXED works.
- [ ] New telemetry can trigger review.
- [ ] Capability snapshots invalidate correctly.

### Observability

- [ ] Detection duration measured.
- [ ] Classification result logged.
- [ ] Override rate measured.
- [ ] UNKNOWN rate measured.
- [ ] Capability changes logged.
- [ ] Resolver failures monitored.
- [ ] Cache hit rate monitored.
- [ ] Misclassification reports can be investigated.

### Security/privacy

- [ ] Tenant scoping enforced.
- [ ] Architecture data tenant-scoped.
- [ ] Source is never uploaded merely for classification.
- [ ] Secrets removed from projections.
- [ ] Confirmation actions audited.
- [ ] Admin diagnostics respect tenant access.

### Testing

- [ ] React fixture.
- [ ] Vite fixture.
- [ ] Next frontend-only fixture.
- [ ] Next mixed fixture.
- [ ] Express fixture.
- [ ] Fastify fixture.
- [ ] NestJS fixture.
- [ ] Monorepo fixture.
- [ ] Unsupported Vue fixture.
- [ ] Unsupported Django fixture.
- [ ] UNKNOWN fixture.
- [ ] Entitlement matrix tests.
- [ ] RBAC matrix tests.
- [ ] Evidence-state tests.
- [ ] End-to-end tests.
- [ ] Regression suite.

---

# 56. Definition of done

I would consider this functionality production-ready only when this scenario works without special handling:

```text
Developer connects repository
        ↓
Desktop analyzes workspace
        ↓
Tellann detects architecture
        ↓
Developer confirms
        ↓
Application profile stored
        ↓
Instrumentation determined
        ↓
Telemetry sources connected
        ↓
Evidence received
        ↓
Capability Resolver evaluates application
        ↓
Sidebar adapts
        ↓
Dashboard adapts
        ↓
Feature routes adapt
        ↓
Reports adapt
        ↓
APIs enforce same decision
        ↓
Repository changes
        ↓
Tellann re-analyzes
        ↓
Capabilities update safely
        ↓
Historical evidence remains intact
```

The most important architectural decision here is **not** the frontend/backend/mixed classifier. That classifier is merely the first layer.

The real feature is the **Capability Resolver**.

Build that correctly and, later, adding mobile applications, serverless functions, microservices, desktop applications, Python backends, React Native, or other architectures becomes mostly a matter of adding new detection traits, telemetry adapters and capability rules—not rewriting the Tellann dashboard every time.