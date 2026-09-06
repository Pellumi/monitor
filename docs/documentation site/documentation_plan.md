Yes. I would redesign the documentation sidebar before expanding the current content further.

Your present `docs.ts` already has substantial coverage, but it is essentially **flat**: every page has one `category` string, and the navigation is manually ordered through `CATEGORY_ORDER`.  That has produced 16 top-level categories ranging from Get Started and Concepts to Reconciliation, Architecture, Why Tellann, Troubleshooting, and Tutorials. 

The problem is not lack of documentation. It is **information architecture**.

Tellann's natural user journey is much simpler:

> Connect → Observe → Demonstrate → Model → Analyze → Investigate → Act.

The MVP itself supports that progression: SDK capture, demonstrations, session reconstruction/replay, behavioral graphs, workflow discovery, coverage, missing states/flows, endpoint intelligence, reports, and the dashboard. 

I would therefore rebuild the docs around that mental model.

---

# 1. Recommended overall documentation architecture

Do **not** expose 16–20 unrelated category headings at the same visual level.

Instead, use five large sidebar regions:

```text
TELLANN DOCUMENTATION

START
├── Overview
└── Get Started

UNDERSTAND
├── Core Concepts
├── Demonstration Mode
├── Behavior & Workflows
├── Coverage & Quality
├── Sessions & Replay
├── Endpoint Intelligence
└── Reports

BUILD
├── Integrate Tellann
├── Events & Telemetry
├── SDK Reference
└── API Reference

OPERATE
├── Workspace & Administration
├── Security & Privacy
├── Billing & Usage
├── Deployment
└── Platform Architecture

RESOURCES
├── Tutorials
├── Troubleshooting
├── Glossary
├── FAQ
├── Changelog
├── Roadmap
└── Support
```

This gives you **five conceptual areas**, while still allowing dozens or eventually hundreds of documentation pages underneath them.

---

# 2. START

This is where every first-time user should begin.

## 2.1 Overview

```text
Overview
├── What is Tellann?
├── Why Tellann Exists
├── How Tellann Works
├── What Tellann Produces
├── Supported Platforms
├── Tellann Product Model
└── Feature Availability
```

### What is Tellann?

Keep your current page.

It already establishes the correct positioning:

* behavioral quality intelligence
* behavioral graphs
* workflow maps
* coverage reports
* missing states
* missing flows
* session replay
* endpoint intelligence. 

Route:

```text
/docs/overview/what-is-tellann
```

### Why Tellann Exists

Keep the conceptual explanation, but remove the competitor-comparison-heavy content from the sidebar.

Route:

```text
/docs/overview/why-tellann
```

### How Tellann Works

This should become one of the most important overview pages.

Show:

```text
Application
    ↓
Tellann SDK
    ↓
Behavioral Events
    ↓
Session
    ↓
States + Transitions
    ↓
Workflows
    ↓
Behavior Graph
    ↓
Coverage / Missing Behavior
    ↓
Quality Intelligence
```

### What Tellann Produces

Explain each output briefly:

```text
Behavior Graph
Workflow Inventory
Coverage Analysis
Missing States
Missing Flows
Session Replay
Endpoint Intelligence
QA Reports
```

### Supported Platforms

The current specification supports:

* JavaScript
* TypeScript
* React
* Next.js
* Node.js
* Express
* NestJS
* Fastify

while Vue, Angular, React Native, Android, and iOS are future targets. 

That distinction should be visible rather than implying every SDK exists today.

### Feature Availability

Very important.

Create:

```text
/docs/overview/feature-availability
```

Use labels such as:

```text
Generally Available
Beta
Preview
Enterprise
Planned
```

Because Tellann is explicitly designed across Phase 1, Phase 2, and Phase 3, future functionality should not silently sit beside current functionality as though it already ships. 

---

# 3. GET STARTED

This should be aggressively task-oriented.

```text
Get Started
├── Quickstart
├── Prerequisites
├── Create Your Organization
├── Create an Application
├── Create an Environment
├── Create an Ingestion Key
├── Install the Frontend SDK
├── Install the Backend SDK
├── Verify Your Integration
├── Run Your First Demonstration
├── View Your First Behavior Graph
├── Understand Your First Report
└── Next Steps
```

Your existing Getting Started flow already expects organization → application → environment → API key → SDK → demonstration → reports. 

### Quickstart

Keep:

```text
Quick Start (5 Minutes)
```

But this should be the first prominent sidebar item underneath Get Started.

### Verify Your Integration

This page is missing from the current structure and is essential.

Show users how to verify:

```text
SDK initialized
↓
Session created
↓
Event received
↓
Application appears connected
↓
Events visible
↓
Ready to demonstrate
```

Include common status indicators such as:

* Connected
* No events received
* Invalid key
* Wrong environment
* Collector unavailable
* SDK version outdated

### Next Steps

After integration, offer paths:

```text
I want to...
→ Run a demonstration
→ Instrument custom behavior
→ Understand behavior graphs
→ Configure privacy
→ Integrate my backend
→ Invite my team
```

---

# 4. UNDERSTAND — CORE CONCEPTS

Your current Concepts section is directionally good, but should be rebuilt around Tellann's actual behavioral model.

```text
Core Concepts
├── Behavioral Quality Intelligence
├── Events
├── Sessions
├── States
├── Actions
├── Transitions
├── Workflows
├── Behavior Graphs
├── Behavioral Coverage
├── Missing States
├── Missing Flows
├── Endpoint Intelligence
├── Demonstrated vs Observed Behavior
└── Quality Intelligence
```

## Events

Explain:

> The smallest observable unit.

Examples:

```text
PAGE_VISIT
BUTTON_CLICK
FORM_SUBMITTED
API_REQUEST
API_RESPONSE
ERROR_OCCURRED
```

## Sessions

Explain:

> A chronologically correlated collection of events representing an observed interaction period.

## States

Examples:

```text
ANONYMOUS
AUTHENTICATED
PRODUCT_VIEW
CART_ACTIVE
CHECKOUT
PAYMENT_FAILED
```

## Actions

This deserves its own page. It is currently missing from your Concepts navigation.

Actions explain **why a transition occurred**.

Example:

```text
CART_ACTIVE
   │
   │ CHECKOUT_CLICKED
   ▼
CHECKOUT
```

## Transitions

Movement between states.

## Workflows

Business-level sequences:

```text
Registration
Login
Checkout
Password Reset
Subscription Purchase
```

## Behavior Graphs

A connected representation of observed software behavior.

The Behavior Graph specification defines the graph as Tellann's central behavioral intelligence model and builds it around states, transitions, actions, and workflows. 

## Missing States / Missing Flows

Keep them separate.

They represent different concepts and deserve distinct documentation.

---

# 5. DEMONSTRATION MODE

Keep this as a major product section.

It is a foundational Tellann workflow, not merely another guide. The Demonstration specification describes it as the primary entry point for generating behavioral intelligence without requiring production traffic or historical telemetry. 

Recommended tree:

```text
Demonstration Mode
├── Overview
├── How Demonstrations Work
├── Start a Demonstration
├── Stop a Demonstration
├── Guided Demonstrations
├── Exploratory Demonstrations
├── Validation Demonstrations
├── Workflow Labels
├── Demonstration Processing
├── Understanding Results
├── Demonstration Best Practices
├── Comparing Demonstrations
└── Troubleshooting Demonstrations
```

### How Demonstrations Work

Show:

```text
Developer
   ↓
Application Walkthrough
   ↓
Events
   ↓
Session
   ↓
States
   ↓
Transitions
   ↓
Workflows
   ↓
Behavior Graph
   ↓
Quality Analysis
```

### Demonstration types

Your current pages for Guided, Exploratory, and Validation are worth retaining.

They should explain **when to choose each one**, not only define them.

---

# 6. BEHAVIOR & WORKFLOWS

I would create this as a new major subsection under Understand.

```text
Behavior & Workflows
├── Behavior Graph Overview
├── Graph Viewer
├── State Discovery
├── Action Discovery
├── Transition Discovery
├── Workflow Discovery
├── Workflow Inventory
├── Workflow Entry Points
├── Workflow Exit Points
├── Success Paths
├── Failure Paths
├── Alternative Paths
├── Recovery Paths
├── Graph Filtering
├── Graph Metrics
└── Graph Lifecycle
```

This is one of Tellann's biggest differentiators, so it deserves considerably more documentation than the current handful of Behavior Graph pages.

The MVP explicitly includes automatic extraction of states, actions, transitions, workflows, entry points, exit points, and workflow maps. 

---

# 7. COVERAGE & QUALITY

Move much of your existing **Analysis & Reports** and parts of **Reconciliation** here.

```text
Coverage & Quality
├── Coverage Overview
├── Workflow Coverage
├── State Coverage
├── Transition Coverage
├── Endpoint Coverage
├── Error Coverage
├── Observed Paths
├── Missing Paths
├── Missing States
├── Missing Flows
├── Critical Gaps
├── Coverage Comparison
├── Interpreting Coverage
└── Quality Limitations
```

The MVP defines all five coverage dimensions:

* workflow
* state
* transition
* endpoint
* error. 

### Important: include a "Quality Limitations" page

Tell users clearly:

```text
Coverage ≠ correctness.

Observed ≠ verified correct.

100% behavioral coverage ≠ bug-free software.

Missing-flow suggestions may require human validation.
```

This kind of page is important for building trust in Tellann.

---

# 8. WHAT I WOULD DO WITH "RECONCILIATION"

I would **remove `RECONCILIATION` as a primary sidebar category for now**.

Your current docs elevate:

* Expected Graphs
* Demonstrated Graphs
* Observed Graphs
* Gap Detection
* Coverage Scoring
* Release Confidence

into a dedicated public product area. 

But the authoritative MVP is currently framed around:

```text
Behavior Graphs
Workflow Discovery
Coverage
Missing States
Missing Flows
Endpoint Intelligence
Reports
```

rather than a user-facing "Reconciliation Engine." 

So I would distribute those pages:

```text
Expected vs Observed
→ Core Concepts / Preview

Gap Detection
→ Coverage & Quality

Coverage Scoring
→ Coverage & Quality

Demonstrated Graph
→ Behavior & Workflows

Observed Graph
→ Production Intelligence / Preview

Release Confidence
→ Future / Preview
```

The engine can still exist internally. It simply does not need to become part of the user's vocabulary unless Tellann ultimately exposes it as a first-class product feature.

---

# 9. SESSIONS & REPLAY

Expand this significantly.

```text
Sessions & Replay
├── Sessions Overview
├── Session Lifecycle
├── Session Metadata
├── Find and Filter Sessions
├── Session Timeline
├── Session Events
├── Replay Overview
├── Replay Viewer
├── Timeline Navigation
├── Workflow Activity
├── API Activity
├── Error Activity
├── Investigating Failures
├── Replay Integrity
├── Replay Privacy
└── Replay Troubleshooting
```

One distinction should be made especially clear:

> Tellann Session Replay is not screen/video recording. It reconstructs behavior from captured telemetry. 

That should appear near the top of the Replay Overview page.

---

# 10. ENDPOINT INTELLIGENCE

This deserves its own section rather than being buried inside general Analysis.

```text
Endpoint Intelligence
├── Overview
├── Endpoint Inventory
├── Request Volume
├── Response Time
├── Error Rates
├── Slow Endpoints
├── Endpoint Rankings
├── Endpoint Recommendations
├── Session Correlation
└── Interpreting Endpoint Health
```

The MVP explicitly includes latency, request volume, error-rate analysis, rankings, and optimization suggestions. 

---

# 11. REPORTS

Break the generic Reports page apart.

```text
Reports
├── Reports Overview
├── Executive Quality Report
├── Flow Coverage Report
├── Behavior Graph Report
├── Missing Flow Report
├── Missing State Report
├── Session Analysis Report
├── Endpoint Intelligence Report
├── Generate a Report
├── Filter Reports
├── Export Reports
└── Report Retention
```

Those seven report families are explicitly part of the MVP. 

For each report page document:

```text
Purpose
When to use it
Data included
Metrics
How to interpret it
Available filters
Example output
Export options
Known limitations
Related reports
```

---

# 12. BUILD — INTEGRATE TELLANN

This should be distinct from SDK Reference.

**Integration docs teach. Reference docs enumerate.**

Recommended:

```text
Integrate Tellann
├── Integration Overview
├── Frontend
│   ├── React
│   ├── Next.js
│   └── JavaScript / TypeScript
│
├── Backend
│   ├── Node.js
│   ├── Express
│   ├── NestJS
│   └── Fastify
│
├── Frontend + Backend Correlation
├── Configuration
├── Environments
├── Ingestion Keys
├── Automatic Tracking
├── Custom Events
├── Custom States
├── Custom Transitions
├── Custom Workflows
├── Error Capture
├── API Tracking
├── Session Tracking
├── Privacy Configuration
├── Debug Mode
└── SDK Diagnostics
```

This uses the supported platform matrix rather than giving users generic "Frontend SDK" and "Backend SDK" pages only. 

---

# 13. EVENTS & TELEMETRY

This needs to become a first-class section.

```text
Events & Telemetry
├── Event Model
├── Canonical Event Schema
├── Event Naming
├── Session Events
├── Navigation Events
├── UI Events
├── Form Events
├── State Events
├── API Events
├── Error Events
├── Workflow Events
├── Custom Events
├── Event Metadata
├── Event Ordering
├── Event Batching
├── Event Delivery
├── Retry Behavior
├── Event Validation
├── Event Versioning
└── Telemetry Privacy
```

Tellann has a formal event taxonomy, so one generic `Event Reference` page is eventually insufficient.

---

# 14. SDK REFERENCE

Your current three pages should become a proper API-style SDK reference.

```text
SDK Reference
├── Overview
├── Installation
├── Initialization
├── Configuration
├── Core
│   ├── initialize()
│   ├── shutdown()
│   └── getStatus()
│
├── Events
│   ├── trackEvent()
│   └── trackCustomEvent()
│
├── Sessions
│   ├── startSession()
│   ├── endSession()
│   ├── pauseSession()
│   └── resumeSession()
│
├── States
│   ├── trackState()
│   └── trackTransition()
│
├── Workflows
│   ├── startWorkflow()
│   ├── completeWorkflow()
│   └── failWorkflow()
│
├── API Tracking
├── Error Capture
├── Replay
├── Privacy
├── Plugins
├── Diagnostics
├── SDK Errors
└── Version Compatibility
```

The SDK specification already exposes modules for core, events, sessions, users, states, workflows, API tracking, errors, replay, privacy, buffering, networking, storage, logging, plugins, and diagnostics. 

That model should drive the reference documentation.

---

# 15. API REFERENCE

The current API sidebar is incomplete.

I would structure it like this:

```text
API Reference
├── API Overview
├── Base URLs
├── Authentication
├── Request IDs & Tracing
├── Standard Responses
├── Errors
├── Pagination
├── Filtering
├── Rate Limits
│
├── Organizations
├── Users
├── Applications
├── API / Ingestion Keys
│
├── Events
├── Sessions
├── Demonstrations
├── Behavior Graphs
├── Workflows
├── Coverage
├── Missing States
├── Missing Flows
├── Endpoints
├── Dashboard
├── Reports
│
├── Notifications
├── Webhooks
├── Privacy Rules
├── Retention Policies
├── Audit Logs
└── Health
```

The formal API specification already covers Dashboard and Reports APIs as well as notifications/webhooks, privacy/retention, administrative endpoints, and standard responses.  

### Future API endpoints

Do **not** mix Phase 2 and Phase 3 APIs into current APIs without labels.

Use:

```text
PREVIEW APIs
├── Production Monitoring
├── User Journeys
├── Database Intelligence
├── Error Correlation
├── Releases
├── Test Generation
├── Failure Simulation
├── Anomalies
└── Quality Intelligence
```

The specification clearly marks those later APIs as Phase 2 or Phase 3. 

---

# 16. OPERATE — WORKSPACE & ADMINISTRATION

Rename the current generic "Administration" section.

```text
Workspace & Administration
├── Organizations
├── Applications
├── Environments
├── Members
├── Invitations
├── Roles
├── Permissions
├── RBAC
├── Application Permissions
├── Ingestion Keys
├── Audit Logs
├── Notifications
├── Data Retention
├── Delete / Archive Applications
└── Organization Settings
```

For permissions, include role matrices rather than only prose.

Example:

| Capability         | Owner/Admin | Developer | QA | Product | Viewer |
| ------------------ | ----------: | --------: | -: | ------: | -----: |
| Manage application |           ✓ |         ✓ |  — |       — |      — |
| Run demonstration  |           ✓ |         ✓ |  ✓ |       — |      — |
| View reports       |           ✓ |         ✓ |  ✓ |       ✓ |      ✓ |
| Manage keys        |           ✓ |         ✓ |  — |       — |      — |
| Manage billing     |           ✓ |         — |  — |       — |      — |

---

# 17. SECURITY & PRIVACY

Your current two pages are far too compressed for what Tellann collects and analyzes.

Recommended:

```text
Security & Privacy
├── Security Overview
├── Privacy Overview
├── Privacy by Default
├── What Tellann Collects
├── What Tellann Masks
├── What Tellann Never Collects
├── PII Handling
├── Custom Privacy Rules
├── Form Field Masking
├── Session Replay Privacy
├── Data Encryption
├── Authentication
├── MFA
├── SSO
├── API Key Security
├── Tenant Isolation
├── Access Control
├── Audit Logging
├── Data Retention
├── Data Deletion
├── Data Residency
├── Compliance
└── Security FAQ
```

Privacy is particularly important because the platform's design explicitly calls for data minimization, privacy by default, sensitive-data exclusion, customer-defined retention/redaction/masking, and explainable collection. 

The documentation should also clearly distinguish:

```text
COLLECTED
Behavioral/session/telemetry data

MASKED
PII/user identifiers/contact information

IGNORED
Credentials/financial data/secrets/security tokens
```

That classification already exists in the privacy specification. 

This should be publicly understandable documentation, not merely security architecture prose.

---

# 18. BILLING & USAGE

I would rename Billing & Plans to:

> **Billing & Usage**

Structure:

```text
Billing & Usage
├── Billing Overview
├── Plans
├── Plan Comparison
├── Feature Entitlements
├── Application Limits
├── Member Limits
├── Storage Usage
├── Data Retention Limits
├── Demonstration Usage
├── Usage Warnings
├── Upgrade a Plan
├── Downgrade a Plan
├── Billing Changes
└── Billing FAQ
```

Avoid documenting internal "entitlement enforcement" mechanics in a customer-oriented sidebar. Users care about:

> What do I have, what is my limit, what happens when I reach it?

Not:

> How does Tellann's internal enforcement engine work?

---

# 19. DEPLOYMENT

Separate deployment from architecture.

```text
Deployment
├── Deployment Overview
├── Tellann Cloud
├── Self-Hosted
├── System Requirements
├── Network Requirements
├── Kubernetes
├── Helm
├── Configuration
├── Environment Variables
├── Secrets
├── Storage Requirements
├── Kafka Requirements
├── PostgreSQL Requirements
├── ClickHouse Requirements
├── Neo4j Requirements
├── Backups
├── Disaster Recovery
├── Scaling
├── Upgrades
├── Private Networking
├── Data Residency
└── Deployment Troubleshooting
```

Enterprise/self-hosted users should see this section; a Free-plan developer probably does not need it expanded by default.

---

# 20. PLATFORM ARCHITECTURE

Keep architecture, but put it under **Operate → Advanced** near the bottom.

```text
Platform Architecture
├── Architecture Overview
├── Capture Layer
├── Ingestion Layer
├── Streaming Layer
├── Processing Layer
├── Storage Layer
├── Presentation Layer
├── Event Pipeline
├── Session Engine
├── Replay Engine
├── Behavior Graph Engine
├── Coverage Engine
├── Report Engine
├── Multi-Tenancy
├── Data Flow
└── Storage Architecture
```

The public architecture overview should explain how the system behaves.

Deep discussions about Kafka consumer groups, individual databases and microservice topology belong here rather than in normal user guides.

---

# 21. RESOURCES — TUTORIALS

Keep tutorials, but make them much more practical.

```text
Tutorials
├── Build Your First Tellann Integration
├── Analyze an E-commerce Application
├── Analyze a SaaS Application
├── Analyze an LMS
├── Validate Registration
├── Validate Authentication
├── Validate Checkout
├── Detect Missing Error Paths
├── Detect Missing Empty States
├── Investigate a Failed Session
├── Diagnose a Slow Endpoint
├── Create a Privacy Rule
├── Prepare a Release Validation Demo
└── Generate and Export a QA Report
```

I would remove or delay tutorials such as:

```text
Create Your First Expected Graph
Compare Expected vs Observed Behavior
```

until that user-facing functionality is actually part of the current product.

---

# 22. TROUBLESHOOTING

Build it around symptoms.

```text
Troubleshooting
├── Troubleshooting Overview
│
├── Installation
│   ├── SDK Won't Initialize
│   ├── Package Installation Errors
│   └── Unsupported Environment
│
├── Connectivity
│   ├── SDK Not Sending Events
│   ├── Invalid API Key
│   ├── Collector Unreachable
│   └── CORS / Network Errors
│
├── Sessions
│   ├── Session Not Created
│   ├── Missing Events
│   ├── Incorrect Event Order
│   └── Session Never Completes
│
├── Demonstrations
│   ├── Demonstration Won't Start
│   ├── Demonstration Won't Stop
│   ├── Demonstration Stuck Processing
│   └── No Results Generated
│
├── Behavior Graphs
│   ├── Graph Empty
│   ├── States Missing
│   ├── Incorrect Transitions
│   └── Workflow Not Discovered
│
├── Coverage
│   ├── Coverage Looks Wrong
│   └── Missing Behavior Not Detected
│
├── Replay
│   ├── Replay Won't Load
│   └── Replay Has Missing Events
│
└── API
    ├── 400 Errors
    ├── 401 / 403 Errors
    ├── 404 Errors
    ├── 429 Errors
    └── 5xx Errors
```

This is much easier to search than troubleshooting pages organized by internal component names.

---

# 23. GLOSSARY

Add this.

```text
Glossary
```

Include every Tellann-specific term:

```text
Action
Application
Behavior
Behavior Graph
Behavioral Coverage
Demonstration
Environment
Event
Ingestion Key
Missing Flow
Missing State
Observed Path
Replay
Session
State
Transition
Workflow
Workflow Coverage
Workflow Entry Point
Workflow Exit Point
```

Each definition should link to its full conceptual page.

---

# 24. CHANGELOG, ROADMAP AND STATUS

At the bottom of the sidebar:

```text
Product
├── Changelog ↗
├── Roadmap ↗
└── System Status ↗
```

These can link outside `/docs`.

They do not need to become giant docs categories.

---

# 25. REMOVE "WHY TELLANN?" AS A SIDEBAR CATEGORY

I would remove:

```text
Tellann vs Datadog
Tellann vs Sentry
Tellann vs PostHog
Tellann vs Replay.io
```

from the technical documentation sidebar.

Those are **marketing / competitive positioning pages**, not documentation.

Put them on your website under something like:

```text
/compare/datadog
/compare/sentry
/compare/posthog
/compare/replay
```

The docs can retain one neutral page:

```text
/docs/overview/how-tellann-differs
```

explaining distinctions between:

```text
Testing
Monitoring
Observability
Product Analytics
Session Replay
Behavioral Quality Intelligence
```

without turning documentation into a sales brochure.

---

# 26. REMOVE THE CURRENT "GUIDES" TOP-LEVEL SECTION

You currently have Developer, QA, Product Manager and Admin guides. 

I would not delete the content, but I would **remove that sidebar category**.

People do not normally think:

> "I am a developer, show me the developer manual."

They think:

> "How do I integrate the SDK?"

or:

> "How do I investigate a missing flow?"

Instead, put persona cards on `/docs`:

```text
Documentation for

[ Developers ]
Integrate Tellann and investigate behavior.

[ QA Engineers ]
Run demonstrations and analyze coverage.

[ Engineering Managers ]
Understand quality reports and release risk.

[ Product Teams ]
Understand workflows and user journeys.

[ Administrators ]
Manage teams, security and billing.
```

Those cards deep-link into the task-oriented docs.

---

# 27. FINAL SIDEBAR TREE

This is the structure I would actually implement.

```text
⌕ Search documentation                         ⌘ K
Tellann Docs                              v1 ▾


START

▾ Overview
  What is Tellann?
  How Tellann Works
  What Tellann Produces
  Supported Platforms
  Feature Availability

▾ Get Started
  Quickstart
  Prerequisites
  Create an Organization
  Create an Application
  Create an Environment
  Create an Ingestion Key
  Install the SDK
  Verify Your Integration
  First Demonstration
  First Behavior Graph
  First Report
  Next Steps


UNDERSTAND

▾ Core Concepts
  Behavioral Quality Intelligence
  Events
  Sessions
  States
  Actions
  Transitions
  Workflows
  Behavior Graphs
  Behavioral Coverage
  Missing States
  Missing Flows
  Endpoint Intelligence

▾ Demonstration Mode
  Overview
  How Demonstrations Work
  Start / Stop
  Guided
  Exploratory
  Validation
  Workflow Labels
  Processing
  Results
  Best Practices

▾ Behavior & Workflows
  Behavior Graph Overview
  Graph Viewer
  State Discovery
  Action Discovery
  Transition Discovery
  Workflow Discovery
  Workflow Inventory
  Entry & Exit Points
  Success Paths
  Failure Paths
  Graph Metrics

▾ Coverage & Quality
  Coverage Overview
  Workflow Coverage
  State Coverage
  Transition Coverage
  Endpoint Coverage
  Error Coverage
  Observed Paths
  Missing Paths
  Missing States
  Missing Flows
  Critical Gaps
  Coverage Comparison
  Interpreting Coverage

▾ Sessions & Replay
  Sessions Overview
  Find Sessions
  Session Timeline
  Session Events
  Replay Overview
  Replay Viewer
  Timeline Navigation
  Workflow Activity
  API Activity
  Error Activity
  Investigating Failures
  Replay Privacy

▾ Endpoint Intelligence
  Overview
  Endpoint Inventory
  Request Volume
  Response Time
  Error Rates
  Slow Endpoints
  Rankings
  Recommendations

▾ Reports
  Reports Overview
  Executive Quality Report
  Flow Coverage Report
  Behavior Graph Report
  Missing Flow Report
  Missing State Report
  Session Analysis Report
  Endpoint Intelligence Report
  Export Reports


BUILD

▾ Integrate Tellann
  Integration Overview
  React
  Next.js
  JavaScript / TypeScript
  Node.js
  Express
  NestJS
  Fastify
  Full-stack Correlation
  Configuration
  Environments
  Automatic Tracking
  Custom Events
  Custom States
  Custom Transitions
  Custom Workflows
  Error Capture
  API Tracking
  Privacy Configuration
  Diagnostics

▾ Events & Telemetry
  Event Model
  Canonical Schema
  Event Naming
  Session Events
  Navigation Events
  UI Events
  Form Events
  State Events
  API Events
  Error Events
  Workflow Events
  Custom Events
  Metadata
  Ordering
  Batching
  Delivery & Retry
  Validation
  Event Versioning

▾ SDK Reference
  Overview
  Initialization
  Configuration
  Core
  Events
  Sessions
  States
  Workflows
  API Tracking
  Errors
  Replay
  Privacy
  Plugins
  Diagnostics
  SDK Errors
  Version Compatibility

▾ API Reference
  Overview
  Base URLs
  Authentication
  Responses
  Errors
  Pagination
  Rate Limits
  Organizations
  Users
  Applications
  API Keys
  Events
  Sessions
  Demonstrations
  Behavior Graphs
  Workflows
  Coverage
  Missing States
  Missing Flows
  Endpoints
  Dashboard
  Reports
  Notifications
  Webhooks
  Privacy Rules
  Retention Policies
  Audit Logs
  Health


OPERATE

▾ Workspace & Administration
  Organizations
  Applications
  Environments
  Members
  Invitations
  Roles & Permissions
  RBAC
  API Keys
  Audit Logs
  Notifications
  Retention

▾ Security & Privacy
  Security Overview
  Privacy Overview
  What Tellann Collects
  What Tellann Masks
  What Tellann Never Collects
  PII Handling
  Custom Privacy Rules
  Replay Privacy
  Encryption
  Authentication
  MFA
  SSO
  API Key Security
  Tenant Isolation
  Access Control
  Audit Logging
  Data Retention
  Data Deletion
  Data Residency
  Compliance

▾ Billing & Usage
  Overview
  Plans
  Plan Comparison
  Entitlements
  Application Limits
  Member Limits
  Storage
  Retention
  Demonstration Usage
  Usage Warnings
  Upgrade / Downgrade
  Billing FAQ

▾ Deployment
  Overview
  Tellann Cloud
  Self-Hosted
  Requirements
  Kubernetes
  Helm
  Network Configuration
  Environment Variables
  Secrets
  Storage
  Backups
  Disaster Recovery
  Scaling
  Upgrades
  Private Networking
  Data Residency

▾ Platform Architecture
  Architecture Overview
  Capture Layer
  Ingestion Layer
  Streaming Layer
  Processing Layer
  Storage Layer
  Presentation Layer
  Event Pipeline
  Session Engine
  Replay Engine
  Graph Engine
  Coverage Engine
  Multi-Tenancy
  Data Flow


RESOURCES

▾ Tutorials
  First Integration
  E-commerce
  SaaS
  LMS
  Registration
  Authentication
  Checkout
  Missing Error Paths
  Missing States
  Failed Session Investigation
  Slow Endpoint Investigation
  Privacy Configuration
  Generate a QA Report

▾ Troubleshooting
  Installation
  Connectivity
  API Keys
  Sessions
  Demonstrations
  Behavior Graphs
  Coverage
  Session Replay
  API Errors

Glossary
FAQ
Changelog ↗
Roadmap ↗
System Status ↗
Contact Support ↗
```

---

# 28. Sidebar UX behaviour

The information architecture is only half of it. I would implement several navigation behaviours.

### Only one primary section expanded by default

If the user is at:

```text
/docs/demonstration/guided
```

show:

```text
UNDERSTAND

▾ Demonstration Mode
   Overview
   How Demonstrations Work
   Start / Stop
   ● Guided
   Exploratory
   Validation
```

Other large sections remain collapsed.

### Preserve expansion state

Navigating between pages should not reset the sidebar.

### Highlight the current page

Use both:

* text weight
* subtle background

not only color.

### Search

At the top:

```text
⌕ Search documentation      ⌘K
```

Search:

* titles
* descriptions
* headings
* body content
* method names
* endpoints
* error codes
* event names.

For example typing:

```text
BUTTON_CLICK
```

should immediately surface Event Reference.

### Version selector

```text
Tellann Docs
[v1 ▾]
```

Eventually:

```text
v1
v2
Preview
```

This will become important as SDK and API contracts evolve.

---

# 29. Use feature badges

Small labels should appear beside relevant navigation items:

```text
Self-Hosted                ENTERPRISE
SSO                        ENTERPRISE
Vue SDK                    PLANNED
Production Monitoring      PREVIEW
Test Generation            FUTURE
```

I would use four product-status terms:

```text
GA
BETA
PREVIEW
PLANNED
```

and separately:

```text
ENTERPRISE
```

for plan restrictions.

Do not use Phase 2/Phase 3 as the normal customer's primary status language.

---

# 30. Add a right-hand page navigation

The **left sidebar answers**:

> Where am I in the documentation?

The **right sidebar answers**:

> Where am I on this page?

Example:

```text
ON THIS PAGE

Overview
Install
Configure
Initialize
Verify connection
Configuration options
Common errors
Next steps
```

Below:

```text
Was this page helpful?   Yes  No

Edit this page
Report an issue
```

---

# 31. Change the underlying `DocPage` model

Your current model has:

```ts
type DocPage = {
  slug: string;
  title: string;
  description: string;
  category: string;
  sections: ...
}
```

That `category: string` architecture is the structural reason everything eventually becomes a flat category list.

I would move toward something like:

```ts
type DocStatus =
  | "ga"
  | "beta"
  | "preview"
  | "planned";

type DocAudience =
  | "developer"
  | "qa"
  | "manager"
  | "product"
  | "admin";

interface DocPage {
  id: string;
  slug: string;
  title: string;
  description: string;

  group: string;
  section: string;

  order: number;

  status?: DocStatus;
  audiences?: DocAudience[];
  plans?: string[];
  tags?: string[];

  related?: string[];

  sections: DocSection[];
}
```

And navigation separately:

```ts
interface DocsNavGroup {
  id: string;
  title: string;

  sections: DocsNavSection[];
}

interface DocsNavSection {
  id: string;
  title: string;
  icon?: string;

  pages?: string[];
  children?: DocsNavSection[];
}
```

This is an important distinction:

> **Content should not define your navigation architecture.**

Your navigation config should reference content.

---

# 32. I would eventually move away from one giant `docs.ts`

The current file has already become very large.

I would move toward:

```text
content/
└── docs/
    ├── overview/
    │   ├── what-is-tellann.mdx
    │   ├── how-it-works.mdx
    │   └── feature-availability.mdx
    │
    ├── get-started/
    ├── concepts/
    ├── demonstrations/
    ├── behavior/
    ├── coverage/
    ├── sessions/
    ├── endpoints/
    ├── reports/
    ├── integrations/
    ├── events/
    ├── sdk/
    ├── api/
    ├── administration/
    ├── security/
    ├── billing/
    ├── deployment/
    ├── architecture/
    ├── tutorials/
    └── troubleshooting/

config/
└── docs-navigation.ts
```

MDX would make documentation easier because you will eventually need:

```text
Code blocks
API method components
Request/response tabs
Warnings
Notes
Tables
Diagrams
Videos
Callouts
Package-manager tabs
Framework tabs
Interactive API requests
```

A giant array of escaped strings becomes painful very quickly.

---

# 33. The major changes I would make to what you have now

| Current               | Recommendation                                                   |
| --------------------- | ---------------------------------------------------------------- |
| 🚀 Get Started        | Split into **Overview + Get Started**                            |
| 📚 Concepts           | Keep, expand into proper behavioral model                        |
| 👥 Guides             | Remove top-level category; use persona landing cards             |
| 🎬 Demonstration Mode | Keep and expand                                                  |
| 📊 Analysis & Reports | Split into Behavior, Coverage, Endpoint Intelligence and Reports |
| 🔄 Reconciliation     | Remove as top-level; distribute concepts                         |
| 🎥 Session Replay     | Expand into Sessions & Replay                                    |
| 🧩 SDK Reference      | Keep, massively expand                                           |
| 🔌 API Reference      | Keep, massively expand                                           |
| 🏢 Administration     | Rename Workspace & Administration                                |
| 🔒 Security & Privacy | Keep, massively expand                                           |
| 💳 Billing & Plans    | Rename Billing & Usage                                           |
| 🏗 Architecture       | Move lower under Operate/Advanced                                |
| 🆚 Why Tellann?       | Move competitor pages to marketing site                          |
| 🛠 Troubleshooting    | Keep and organize by symptoms                                    |
| 🎓 Tutorials          | Keep and make task-oriented                                      |

That is the architecture I would use for the Tellann documentation site going forward.

The central principle is simple: **the sidebar should follow how someone learns and operates Tellann, not mirror the names of Tellann's internal subsystems**. Your current documentation already contains many of the necessary raw pages; the next step is chiefly to reorganize them, fill the missing reference material, and clearly isolate current functionality from future/preview capabilities.
