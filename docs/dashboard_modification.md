# Tellann Adaptive User Dashboard Specification

## 1. Purpose

The Tellann Dashboard is the primary orientation and quality-intelligence surface of the platform.

It must not be treated simply as a collection of analytics cards.

Its responsibility is to help the user understand:

1. **What Tellann currently knows about the application**
2. **Whether the application has supplied enough behavioral evidence**
3. **What workflows have been observed**
4. **What parts of the application remain unexplored**
5. **What quality gaps have been detected**
6. **What sessions generated those findings**
7. **What endpoints require attention**
8. **What the user should do next**

The dashboard therefore changes according to the maturity of the user's Tellann workspace.

The experience for:

* a user who signed up two minutes ago,
* a developer who has installed the SDK,
* a developer who just completed their first demonstration,
* and a team that has accumulated hundreds of demonstrations

must not be identical.

Tellann's MVP exists specifically to transform developer demonstrations into behavioral graphs, workflow discovery, coverage analysis, missing-state detection, missing-flow detection, endpoint analysis, replayable sessions, and QA reports.

---

# 2. Dashboard Design Principle

The dashboard should follow:

**Context → Status → Intelligence → Evidence → Action**

Rather than:

**Metric → Metric → Metric → Empty Card → Empty Card**

The dashboard should continually move the user toward the next useful state.

---

# 3. Dashboard Lifecycle States

Tellann should determine a dashboard state dynamically.

Recommended states:

```text
NEW_ACCOUNT
    ↓
APPLICATION_CREATED
    ↓
SDK_NOT_CONNECTED
    ↓
SDK_CONNECTED
    ↓
AWAITING_DEMONSTRATION
    ↓
DEMONSTRATION_IN_PROGRESS
    ↓
ANALYSIS_IN_PROGRESS
    ↓
FIRST_ANALYSIS_READY
    ↓
ACTIVE
    ↓
MATURE
```

There should also be secondary operational states:

```text
NO_RECENT_DATA
INGESTION_PROBLEM
ANALYSIS_FAILED
PRIVACY_CONFIGURATION_REQUIRED
PLAN_LIMIT_REACHED
```

The user's dashboard layout should derive from these states rather than simply displaying zeros.

---

# 4. Global Dashboard Header

Every dashboard state should retain a common application context header.

## Display

### Page Title

```text
Overview
```

or:

```text
Coverage Overview
```

For the broader dashboard redesign, **Overview** is preferable because coverage becomes only one dimension of the page.

---

## Application Context

Display:

**Application**

```text
Snippets
```

Application selector should allow switching between applications permitted by the user's subscription.

Plan limits currently defined by Tellann are:

| Plan       | Applications |
| ---------- | -----------: |
| Free       |            1 |
| Solo       |            3 |
| Team       |           10 |
| Business   |           50 |
| Enterprise |       Custom |

These limits originate from the current Pricing & Packaging Specification.

---

## Environment Selector

Display the currently analyzed environment.

Examples:

```text
Demo
Development
Staging
Production
```

For the MVP, `demo`, `development`, and `staging` may be relevant, while production intelligence remains a Phase 2 capability.

The SDK specification already recognizes:

```text
demo
development
staging
production
```

as environment values.

---

## Date/Analysis Range

Once data exists:

```text
Last demonstration
Last 7 days
Last 30 days
Custom
All time
```

For a new user, this control should be hidden or disabled.

---

## Quick Action

Primary action changes dynamically.

Examples:

```text
Create Application
Connect SDK
Start Demonstration
Continue Demonstration
View Analysis
Record Another Demonstration
Generate Report
```

There should never be more than one visually dominant primary action.

---

# 5. State 1 — Brand-New Account

## Condition

```text
applications = 0
```

or no configured application exists.

## Objective

Do not show analytics.

The user has provided Tellann with nothing to analyze.

Displaying:

```text
State Coverage: 0%
Flow Coverage: 0%
Sessions: 0
```

is misleading because `0%` implies that measurement occurred and produced a bad result.

The correct state is:

```text
Not measured yet
```

---

# 6. New User Dashboard

The page should become an onboarding dashboard.

## Welcome Hero

Example:

### Teach Tellann how your application behaves

Connect your application and run one normal walkthrough. Tellann will observe the session and turn it into workflows, coverage analysis, missing states, missing flows, endpoint intelligence, and a replayable behavioral timeline.

Primary CTA:

```text
Create Application
```

Secondary:

```text
View Quick Start
```

This follows the Developer Demonstration lifecycle defined by Tellann:

```text
Create Application
↓
Install SDK
↓
Configure SDK Key
↓
Start Recording
↓
Demonstrate Workflows
↓
Generate Intelligence
```

---

# 7. Setup Progress Card

Immediately below the hero:

## Getting Started

```text
0 of 6 completed
```

Progress bar:

```text
[──────────────] 0%
```

Steps:

### 1. Create your application

Description:

> Tellann needs an application workspace before telemetry can be associated with your project.

CTA:

```text
Create Application
```

---

### 2. Connect the frontend SDK

Status:

```text
Not started
```

CTA:

```text
View React Setup
```

The MVP requires React frontend behavioral capture.

---

### 3. Connect backend telemetry

CTA:

```text
View Node.js Setup
```

This can be presented as recommended rather than blocking if frontend-only analysis is currently possible.

Tellann's backend SDK is responsible for API requests, responses, latency, errors, endpoint metadata, and frontend-session correlation.

---

### 4. Verify your connection

Tellann waits for the first valid event.

State:

```text
Waiting for events...
```

Once received:

```text
Connection verified
Last event received 12 seconds ago
SDK v1.x.x
```

---

### 5. Record your first demonstration

CTA:

```text
Start Demonstration
```

Explain:

> Use the application normally. Register, log in, navigate features, submit forms, and complete important workflows.

---

### 6. Review your first analysis

Locked until the first analysis completes.

```text
Available after your first demonstration
```

---

# 8. What You Will Get Card

A new user should understand the reward before performing setup.

Display six small preview cards:

```text
Behavior Graph
See discovered application states and transitions.

Workflow Coverage
Measure demonstrated paths and gaps.

Missing States
Discover loading, empty, error and recovery states.

Missing Flows
Find failure, alternative and recovery paths.

Session Replay
Inspect the exact behavioral timeline.

Endpoint Analysis
See latency, volume and error behavior.
```

These capabilities form the core Tellann MVP.

---

# 9. State 2 — Application Created, SDK Not Connected

## Condition

```text
applications > 0
events = 0
sdkConnection = false
```

The dashboard changes its hero.

### Snippets is ready for observation

```text
Tellann has created the application workspace, but no behavioral events have been received yet.
```

Primary CTA:

```text
Connect SDK
```

---

## Connection Status

Show:

```text
Frontend SDK       Not connected
Backend SDK        Not connected
Last event         —
Environment        Development
Ingestion key      Created
```

Do not reveal the actual secret key directly.

Allow:

```text
Copy setup instructions
Manage ingestion keys
```

---

# 10. State 3 — SDK Connected but No Demonstrations

## Condition

```text
events > 0
demonstrations = 0
```

The dashboard should celebrate successful integration but direct the user immediately toward product value.

## Hero

### Tellann can see your application

```text
Telemetry is arriving successfully. Record a demonstration so Tellann can begin constructing your behavioral model.
```

Primary action:

```text
Start First Demonstration
```

---

## Telemetry Health Card

Display:

```text
Connection            Healthy
Last event             8 seconds ago
Events received        142
Frontend capture       Active
Backend capture        Active
Replay capture         Active
```

If backend telemetry is absent:

```text
Backend capture        Not configured
```

with a non-blocking action.

---

# 11. Demonstration Guide

Before the first recording, show guidance.

Example:

### What should I demonstrate?

Tellann should encourage the user to perform important normal workflows.

Example:

```text
✓ Registration
✓ Login
✓ Search
✓ Browse products
✓ Add to cart
✓ Checkout
```

Then encourage alternate behavior later:

```text
Login failure
Empty results
Payment failure
Form validation
Retry behavior
```

The first demonstration should prioritize the application's **normal intended path**.

Tellann can later identify likely unobserved failure, recovery and alternative paths. The Developer Demonstration specification explicitly defines this model.

---

# 12. State 4 — Demonstration In Progress

## Condition

```text
activeDemonstration != null
```

The dashboard should temporarily become a live recording control surface.

## Recording Card

```text
● Demonstration recording

Started                   08:42
Duration                  06:18
Events captured           387
States observed           14
Transitions observed      22
API calls captured        81
Errors observed           1
```

Primary:

```text
Stop & Analyze
```

Secondary:

```text
Open Session
```

---

## Live Observed Activity

Show a lightweight timeline:

```text
08:46:20  PAGE_VISIT            /checkout
08:46:22  BUTTON_CLICK          pay-button
08:46:22  API_REQUEST           POST /api/payment
08:46:23  API_RESPONSE          200 • 384 ms
08:46:24  STATE_TRANSITION      CHECKOUT → PAYMENT_SUCCESS
```

Tellann's official event model includes navigation, UI, forms, states, APIs, errors, workflows and session events.

This activity feed should use friendly display labels by default, while developers can reveal raw event names when necessary.

---

# 13. State 5 — Analysis In Progress

After the demonstration stops:

```text
Events
↓
Session
↓
States
↓
Transitions
↓
Workflow
↓
Behavior Graph
↓
Coverage Analysis
↓
Reports
```

This sequence follows the documented Tellann behavioral processing lifecycle.

## Dashboard

Do not return to a screen full of zeroes.

Show:

### Analyzing your demonstration

```text
Session reconstructed          ✓
Events ordered                 ✓
States extracted               ✓
Transitions identified         ✓
Workflows discovering          ●
Coverage calculating           ○
Missing states analyzing       ○
Missing flows analyzing        ○
Endpoint analysis              ○
QA report generation           ○
```

Provide:

```text
View Session
```

while analysis continues.

---

# 14. State 6 — First Analysis Ready

This is one of the most important product moments.

The dashboard should clearly announce:

### Your first behavioral model is ready

Then show a concise summary.

Example:

```text
5 workflows discovered
21 states observed
33 transitions observed
67% workflow coverage
7 missing states detected
5 missing flows detected
2 endpoint concerns
```

Primary:

```text
Explore Analysis
```

Secondary:

```text
Record Another Demonstration
```

---

# 15. Mature Dashboard Structure

After the user has usable analysis, the dashboard becomes an intelligence dashboard.

Recommended structure:

```text
┌────────────────────────────────────────────────────────────────┐
│ Application Context / Environment / Time Range / Actions        │
├────────────────────────────────────────────────────────────────┤
│ Quality Summary                                                  │
├────────────────────────────────────────────────────────────────┤
│ Coverage Overview                                                │
├───────────────────────────────┬────────────────────────────────┤
│ Behavioral Graph Preview      │ Workflow Coverage              │
├───────────────────────────────┼────────────────────────────────┤
│ Missing States               │ Missing Flows                  │
├───────────────────────────────┼────────────────────────────────┤
│ Recent Sessions              │ Endpoint Health                │
├───────────────────────────────┼────────────────────────────────┤
│ Recent Reports               │ Activity / Alerts              │
├────────────────────────────────────────────────────────────────┤
│ Recommended Next Demonstrations                                │
└────────────────────────────────────────────────────────────────┘
```

---

# 16. Section A — Application Quality Summary

The first mature dashboard row should provide a compact behavioral summary.

For the **MVP**, avoid inventing an AI-based quality score.

The MVP scope explicitly excludes AI quality scoring and autonomous recommendations.

Instead show factual evidence.

Recommended cards:

### Workflows Discovered

```text
12
+2 since previous demonstration
```

### States Observed

```text
48
```

### Transitions Observed

```text
73
```

### Sessions

```text
26
```

### Findings

```text
14 open
3 high priority
```

---

# 17. Section B — Coverage Overview

The existing coverage metrics should remain, but become more complete.

The reporting specification defines:

* Workflow Coverage
* State Coverage
* Transition Coverage
* Endpoint Coverage
* Error Coverage

as formal coverage dimensions.

Recommended cards:

```text
Workflow Coverage
76%

State Coverage
81%

Transition Coverage
69%

Endpoint Coverage
72%

Error Coverage
44%
```

---

## Coverage Change

When historical sessions exist:

```text
Workflow Coverage
76%
↑ 8% from previous demonstration
```

or:

```text
Transition Coverage
69%
↓ 3%
```

Comparison across sessions is supported by the functional specification.

---

## Expected Coverage

The existing `Expected Coverage: N/A` should be removed unless Tellann has a real expected model.

Replace it with:

```text
Coverage calculated from 12 discovered workflows
```

If expected-path modeling exists:

```text
Observed 42 of 55 expected paths
```

Never show `N/A` as one of the primary dashboard metrics.

---

# 18. Section C — Behavioral Graph Preview

The Behavior Graph is Tellann's central intelligence model and should therefore have visible dashboard prominence.

Show a reduced interactive graph.

Example:

```text
ANONYMOUS
    ↓
REGISTERED
    ↓
AUTHENTICATED
   ↙      ↘
SEARCH   PROFILE
   ↓
PRODUCT_VIEW
   ↓
CART
   ↓
CHECKOUT
```

Card metadata:

```text
48 states
73 transitions
12 workflows
5 entry points
9 exit points
```

CTA:

```text
Open Behavioral Graph
```

---

# 19. Section D — Workflow Coverage

Instead of showing only an aggregate percentage, show actual workflows.

Example:

| Workflow       | Coverage | States | Missing Paths |
| -------------- | -------: | -----: | ------------: |
| Registration   |      92% |      8 |             1 |
| Login          |      74% |      6 |             3 |
| Checkout       |      61% |     12 |             5 |
| Search         |      48% |      7 |             4 |
| Profile Update |     100% |      5 |             0 |

Sort by:

1. Lowest coverage
2. Highest severity
3. Most recently changed

CTA:

```text
View All Workflows
```

---

# 20. Section E — Missing States

Your current dashboard displays:

```text
Top Missing States
No missing states found.
```

For a new account this wording is incorrect.

There is not enough evidence to say that no missing states exist.

Use three distinct empty states.

### Before analysis

```text
Missing states have not been analyzed yet.
Complete a demonstration to begin detection.
```

### Analysis completed with none

```text
No missing states detected in the analyzed workflows.
```

### Findings exist

Show ranked findings.

Example:

```text
HIGH      PAYMENT_FAILURE
Checkout
Failure state has not been demonstrated.

MEDIUM    EMPTY_CART
Cart
Empty state has not been observed.

MEDIUM    NO_SEARCH_RESULTS
Search
No-results state has not been demonstrated.

LOW       CHECKOUT_LOADING
Checkout
Loading behavior has not been observed.
```

Tellann's documented missing-state categories include:

* loading states
* empty states
* error states
* recovery states

CTA:

```text
View Missing States
```

---

# 21. Section F — Missing Flows

The same logic applies.

Possible categories:

```text
Failure Flow
Alternative Flow
Recovery Flow
Rare Flow
Edge-Case Flow
```

The QA Reporting specification defines these categories for Missing Flow Reports.

Example:

```text
HIGH
Payment Failure
Checkout
Not demonstrated

HIGH
Authentication Failure
Login
Not demonstrated

MEDIUM
Retry Payment
Checkout
Recovery path not demonstrated

LOW
Password Reset
Authentication
Alternative path not demonstrated
```

CTA:

```text
View Missing Flows
```

---

# 22. Section G — Recommended Next Demonstrations

This should become one of the most valuable dashboard components.

It should not make AI claims.

It can simply transform deterministic findings into actions.

Example:

### Improve your coverage

```text
Checkout currently has the largest coverage gap.

Try demonstrating:

1. Payment failure
2. Retry payment
3. Empty cart
4. Session timeout
```

CTA:

```text
Start Checkout Demonstration
```

The recommendation should always link back to the evidence.

For example:

```text
Why this is suggested
Checkout has 5 unobserved paths.
```

---

# 23. Section H — Recent Sessions

Show the most relevant recent demonstrations.

Example:

| Session  | Type        | Duration | Events | Workflows | Findings | Time       |
| -------- | ----------- | -------: | -----: | --------: | -------: | ---------- |
| SES-2048 | Guided      |      14m |    682 |         5 |        7 | 12 min ago |
| SES-2047 | Exploratory |       8m |    327 |         3 |        2 | Yesterday  |
| SES-2046 | Validation  |      11m |    491 |         4 |        3 | Aug 10     |

Actions:

```text
Replay
Open Timeline
View Analysis
```

Session replay is explicitly intended to expose session summary, workflow timeline, errors and API activity.

---

# 24. Session Quality Indicators

Each session may show:

```text
Timeline completeness     99%
Missing events            2
Ordering accuracy         100%
```

These correspond to replay integrity concepts defined in the Session Replay specification.

Do not expose overly technical integrity metrics prominently unless something is wrong.

Healthy values can remain behind:

```text
Session Details
```

---

# 25. Section I — Endpoint Health

Show backend evidence if the Node SDK is connected.

Cards:

```text
Endpoints Observed       38
Average Latency          241 ms
Slow Endpoints           4
Error-Prone Endpoints    2
```

Then:

### Needs Attention

```text
GET /api/search
842 ms average
Slow

POST /api/payment
4.8% error rate
High errors

GET /api/products
623 ms average
Slow
```

Tellann's Phase 1 endpoint capabilities include latency, request volume, error rate, rankings and optimization suggestions.

CTA:

```text
Open Endpoint Analysis
```

If backend telemetry is unavailable:

```text
Connect the Node SDK to include API performance in your QA analysis.
```

---

# 26. Section J — Reports

Show recent generated reports.

Example:

```text
Executive Quality Report
Generated 14 minutes ago

Flow Coverage Report
Generated 14 minutes ago

Missing State Report
Generated 14 minutes ago

Endpoint Intelligence Report
Generated 14 minutes ago
```

Actions depend on plan:

```text
View
Export
Regenerate
```

Phase 1 supports:

* Executive Quality Report
* Flow Coverage Report
* Behavioral Graph Report
* Missing Flow Report
* Missing State Report
* Session Analysis Report
* Endpoint Intelligence Report

---

# 27. Section K — Activity

Useful once several people or demonstrations exist.

Example:

```text
10:41  Checkout demonstration analyzed
10:38  4 missing flows detected
09:16  Sarah recorded a validation session
Yesterday  Coverage increased from 61% → 68%
Yesterday  Executive report generated
```

For Solo and Free accounts this can remain compact.

For Team and above it becomes significantly more valuable.

---

# 28. Section L — Application Observation Status

Provide a small system-status component.

Example:

```text
Observation Status

Frontend SDK       Healthy
Backend SDK        Healthy
Replay             Enabled
Environment        Development
Last event         11 sec ago
Last analysis      18 min ago
```

Possible warning:

```text
No events received for 3 days.
```

CTA:

```text
Check Integration
```

This prevents a stale dashboard from silently misleading users.

---

# 29. Section M — Privacy Status

Tellann collects behavioral telemetry, so privacy status deserves visible reassurance without overwhelming users.

Display:

```text
Privacy protection
Active

Sensitive fields blocked
Replay masking enabled
Custom rules: 3
```

CTA:

```text
Privacy Settings
```

Tellann's privacy specification requires privacy-by-default behavior, client-side sensitive-field exclusion, replay masking and tenant-specific privacy rules.

---

# 30. Empty-State Rules

The dashboard must distinguish four fundamentally different situations.

## Never analyzed

Use:

```text
Not analyzed yet
```

Never:

```text
0%
```

---

## Analyzed and zero result

Use:

```text
No missing states detected
```

---

## Insufficient evidence

Use:

```text
Not enough behavioral evidence yet
```

---

## Feature unavailable

Use:

```text
Not available on your plan
```

or:

```text
Available in a later Tellann phase
```

These states must never be mixed.

---

# 31. Dashboard for Long-Term Users

Once the application has accumulated substantial behavioral history, onboarding disappears entirely.

The mature dashboard prioritizes change.

Instead of:

```text
48 states
73 transitions
76% coverage
```

emphasize:

```text
Coverage
76%
+8% this month

New States
4

New Missing Flows
2

Resolved Findings
7

Demonstrations
18 this month
```

The dashboard's question evolves from:

> What has Tellann discovered?

to:

> What changed?

---

# 32. Mature User — Change Summary

Recommended top section:

### Since your previous analysis

```text
+3 states discovered
+5 transitions observed
+2 workflows expanded
+6 missing paths resolved
+1 new missing flow identified
Workflow coverage +4.7%
```

This creates a reason to return to Tellann.

---

# 33. Workflow Trend Section

For applications with sufficient history:

```text
Coverage Trend
```

Plot coverage across analyses.

Possible series:

```text
Workflow Coverage
State Coverage
Transition Coverage
Endpoint Coverage
Error Coverage
```

Users may toggle series.

---

# 34. Workflow Change Feed

Example:

```text
CHECKOUT
61% → 73%
Improved

LOGIN
88% → 88%
Stable

SEARCH
72% → 64%
Declined
```

Clicking a workflow opens its detailed coverage page.

---

# 35. Frequently Demonstrated Workflows

Use observed evidence:

```text
Checkout          24 sessions
Login             19 sessions
Search            17 sessions
Registration       9 sessions
Password Reset     2 sessions
```

This tells the QA team where their demonstration effort is concentrated.

---

# 36. Underrepresented Workflows

Example:

```text
Password Reset
2 demonstrations

Account Recovery
1 demonstration

Delete Account
0 demonstrations
```

This is particularly valuable because Tellann's philosophy revolves around exposing behavior that remains unexplored.

---

# 37. Application Behavior Summary

The Behavior Graph specification defines useful graph metrics including:

### State metrics

* visit count
* unique users
* session count
* time spent

### Transition metrics

* frequency
* success rate
* failure rate
* average transition duration

### Workflow metrics

* completion rate
* abandonment rate
* coverage
* error rate

For the MVP demonstration environment, prioritize metrics that genuinely derive from demonstration sessions.

Production-specific interpretation should wait until Phase 2.

---

# 38. Do Not Mix Phase 2 Into the MVP Dashboard

The current MVP explicitly excludes:

* real-user production monitoring
* live workflow health
* production journey intelligence
* friction analysis
* abandonment intelligence
* database intelligence
* error correlation
* regression detection
* anomaly detection
* autonomous testing
* AI recommendations
* AI quality scoring

Therefore, the current dashboard should **not** contain active widgets such as:

```text
Production Health
Live Users
Conversion Drop
Behavioral Anomalies
Release Confidence
AI Recommendations
Database Bottlenecks
```

until the corresponding phases are implemented.

Doing so would muddy Tellann's positioning and make the dashboard promise capabilities that the MVP deliberately excludes.

---

# 39. Future Phase 2 Dashboard Evolution

When Phase 2 ships, the same dashboard architecture can expand.

Add:

### Production Workflow Health

```text
Checkout Health
82%
↓ 14%
```

### Journey Intelligence

```text
Most common journeys
Abandoned journeys
Friction points
Bottlenecks
```

### Production Activity

```text
Active Sessions
Workflow Completion
Workflow Failures
```

### Error Correlation

```text
Failure
├─ Replay
├─ Workflow
├─ API trace
├─ Logs
└─ Database activity
```

These capabilities belong to Phase 2 in the functional requirements.

---

# 40. Future Phase 3 Dashboard Evolution

Phase 3 can introduce:

```text
Release Confidence
Regression Findings
Generated Tests
Behavioral Anomalies
Risk Assessment
Quality Assessment
Recommendations
Intelligence Assistant
```

Again, these should not contaminate the MVP interface before implementation.

---

# 41. Role-Based Dashboard Adaptation

Tellann defines multiple user roles.

The dashboard should preserve the same underlying application truth while changing emphasis according to role.

## Developer

Prioritize:

```text
SDK health
Recent sessions
Endpoint problems
Errors
Behavior Graph
Missing states
```

---

## QA Engineer

Prioritize:

```text
Coverage
Missing states
Missing flows
Workflow coverage
Recent demonstrations
Reports
```

---

## Engineering Manager

Prioritize:

```text
Coverage trend
High-priority findings
Application summaries
Recent reports
Team activity
```

---

## Product Manager

MVP:

```text
Workflow inventory
Behavior Graph
Coverage
Workflow summaries
```

Phase 2 can add:

```text
Journey intelligence
Workflow health
Friction
Abandonment
```

---

## Organization Admin

Add:

```text
Application utilization
Team activity
Plan usage
Security notices
Integration state
```

---

# 42. Plan-Based Dashboard Adaptation

Plan limitations should alter controls, not destroy core product value.

All plans currently receive the essential Phase 1 behavioral capabilities.

## Free

Show:

```text
1 application
1 user
1 GB storage
14-day retention
JSON export
```

Display usage near thresholds.

Example:

```text
Storage
820 MB / 1 GB
```

---

## Solo

Additional dashboard value:

```text
Multiple applications
Historical reports
Multiple environments
Advanced reports
```

---

## Team

Add:

```text
Team Activity
Shared dashboards
Role indicators
Application permissions
```

---

## Business

Add:

```text
Audit activity
API access
Advanced RBAC
Processing status
```

---

## Enterprise

Add:

```text
SSO status
Retention policy
Data residency
Deployment status
Enterprise SLA
```

---

# 43. Usage Indicator

Avoid making pricing usage the dominant dashboard element.

A small footer/sidebar component is sufficient:

```text
Free Plan

Applications      1 / 1
Storage           0.8 / 1 GB
Retention         14 days
```

CTA:

```text
View Plan
```

Only escalate this into the primary dashboard when limits affect operation.

Example:

```text
Storage is 94% full.
Older replay assets may be removed according to your retention policy.
```

---

# 44. Dashboard Quick Actions

Actions should adapt to lifecycle.

Possible actions:

```text
Start Demonstration
Create Application
Connect SDK
Open Behavioral Graph
View Latest Session
Generate Report
View Missing Flows
View Missing States
Analyze Endpoints
```

On a mature dashboard, primary action should usually remain:

```text
Start Demonstration
```

because demonstration is the behavior-acquisition loop at the heart of the Phase 1 product.

---

# 45. Suggested Final Mature Dashboard Layout

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Overview                        Snippets / Development / Last 30 days    │
│                                              [Start Demonstration]       │
├──────────────────────────────────────────────────────────────────────────┤
│ Since Last Analysis                                                     │
│ +3 states  +7 transitions  +4.2% coverage  2 new findings              │
├─────────────────┬─────────────────┬─────────────────┬────────────────────┤
│ Workflow        │ State           │ Transition      │ Error              │
│ Coverage        │ Coverage        │ Coverage        │ Coverage           │
│ 76% ↑4%         │ 81% ↑2%         │ 69% ↑6%         │ 44% —              │
├────────────────────────────────────┬─────────────────────────────────────┤
│ Behavioral Graph                   │ Workflow Coverage                   │
│                                    │ Checkout       61%                  │
│ [interactive graph preview]        │ Login          74%                  │
│                                    │ Registration   92%                  │
│ 48 states • 73 transitions         │ Search         48%                  │
├────────────────────────────────────┼─────────────────────────────────────┤
│ Missing States                     │ Missing Flows                       │
│ 7 open                             │ 5 open                              │
│ 2 high priority                    │ 2 high priority                     │
├────────────────────────────────────┼─────────────────────────────────────┤
│ Recent Sessions                    │ Endpoint Health                     │
│ SES-2048 • 14m • 682 events        │ 38 endpoints                        │
│ SES-2047 • 8m • 327 events         │ 4 slow • 2 high error              │
├────────────────────────────────────┼─────────────────────────────────────┤
│ Recent Reports                     │ Recommended Next Demonstration      │
│ Executive Report                   │ Checkout                            │
│ Coverage Report                    │ Payment Failure                     │
│ Missing States Report              │ Retry Payment                       │
│                                    │ [Start Demonstration]               │
└────────────────────────────────────┴─────────────────────────────────────┘
```

---

# 46. Suggested New-User Layout

For the account shown in the current Tellann screenshot, the dashboard should look conceptually closer to this:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Welcome to Tellann                                      Snippets         │
│                                                                          │
│ Teach Tellann how your application behaves.                              │
│ Connect the SDK and perform your first application walkthrough.          │
│                                                                          │
│ [Connect SDK]                                         [View Quick Start] │
├──────────────────────────────────────────────────────────────────────────┤
│ Getting Started                                              1 of 6      │
│                                                                          │
│ ✓ Application created                                                    │
│ ○ Connect frontend SDK                                                   │
│ ○ Connect backend SDK                                                    │
│ ○ Verify telemetry                                                       │
│ ○ Record demonstration                                                   │
│ ○ Review first analysis                                                  │
├────────────────────────────────────┬─────────────────────────────────────┤
│ Connection                         │ What Tellann Will Generate           │
│ Frontend SDK     Not connected     │ Behavior Graph                      │
│ Backend SDK      Not connected     │ Workflow Coverage                   │
│ Last event       —                 │ Missing States                      │
│ Replay           Waiting           │ Missing Flows                       │
│                                    │ Session Replay                      │
│                                    │ Endpoint Analysis                   │
├────────────────────────────────────┴─────────────────────────────────────┤
│ Your quality analysis will appear here after the first demonstration.    │
└──────────────────────────────────────────────────────────────────────────┘
```

This is substantially more useful than:

```text
Expected Coverage: N/A
State Coverage: 0%
Transition Coverage: 0%
Flow Coverage: 0%
Sessions: 0
```

---

# 47. Dashboard API Mapping

The existing API specification already supports much of the dashboard.

## Overview

```http
GET /dashboard/overview
```

## Workflows

```http
GET /dashboard/workflows
GET /applications/{applicationId}/graph/workflows
```

## Sessions

```http
GET /dashboard/sessions
GET /sessions
```

## Endpoints

```http
GET /dashboard/endpoints
GET /endpoints/health
```

## Coverage

```http
GET /coverage
GET /coverage/workflows
```

## Missing States

```http
GET /missing-states
```

## Missing Flows

```http
GET /missing-flows
```

## Reports

```http
GET /reports
```

## Demonstrations

```http
GET /demonstrations
POST /demonstrations/start
POST /demonstrations/{id}/stop
POST /demonstrations/{id}/analyze
```

These endpoints are already defined by the Tellann/SOTS API specification.

---

# 48. Recommended Dashboard Overview Response

Rather than having the frontend independently calculate lifecycle status, `GET /dashboard/overview` should eventually expose a normalized dashboard state.

Recommended extension:

```json
{
  "dashboardState": "AWAITING_DEMONSTRATION",
  "application": {},
  "integration": {},
  "onboarding": {},
  "latestAnalysis": {},
  "coverage": {},
  "graph": {},
  "findings": {},
  "sessions": {},
  "endpoints": {},
  "reports": {},
  "usage": {}
}
```

This specific response shape is a recommended implementation extension; it is not currently defined in the supplied API specification.

The advantage is that lifecycle logic remains centralized rather than duplicated across every frontend component.

---

# 49. Dashboard Preferences

Tellann's current database design already contains:

```text
dashboard_preferences
```

with:

```text
user_id
preferences JSONB
```

This should eventually support:

```json
{
  "defaultApplication": "",
  "defaultEnvironment": "",
  "defaultDateRange": "30d",
  "collapsedSections": [],
  "preferredCoverageMetrics": [],
  "dashboardDensity": "comfortable"
}
```

Role and plan restrictions must override user customization.

---

# 50. Dashboard Priority Algorithm

The interface should determine importance approximately in this order:

```text
1. Blocking setup problem
2. Active demonstration
3. Analysis in progress
4. New critical/high finding
5. Significant coverage regression/change
6. Recommended next demonstration
7. Recent analysis
8. Historical information
```

Therefore:

A user with a disconnected SDK should not be greeted primarily by historical coverage.

A user with an analysis running should not be shown an onboarding hero.

A user with significant quality gaps should not have those gaps buried beneath session counts.

---

# 51. Finding Severity

Use Tellann's existing reporting severity model:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Severity must always be accompanied by evidence.

Example:

```text
HIGH

PAYMENT_FAILURE not demonstrated

Workflow:
Checkout

Evidence:
0 of 6 demonstrations contain a payment failure path.
```

---

# 52. Dashboard Navigation Relationships

Every dashboard card should lead somewhere meaningful.

```text
Behavioral Graph
→ Behavioral Graph page

Workflow Coverage
→ Workflows / Coverage

Missing State
→ Missing States

Missing Flow
→ Missing Flows

Session
→ Session Details / Replay

Endpoint
→ Endpoint Analysis

Report
→ Report Details

Demonstration Recommendation
→ Start Demonstration
```

The dashboard should summarize.

The sidebar pages should investigate.

This prevents the dashboard from becoming an enormous replacement for the rest of the product.

---

# 53. First-Session Product Moment

The first completed analysis should receive special treatment.

Instead of silently replacing empty metrics, show:

```text
Your first behavioral model is ready.
```

Then:

```text
Tellann observed

5 workflows
21 states
33 transitions
4 API endpoints

and identified

7 missing states
5 missing flows
2 endpoint concerns
```

Then:

```text
[Explore Your Application]
```

This moment communicates the core Tellann value proposition far more clearly than immediately dropping the user into charts.

---

# 54. Returning User Product Moment

For returning users, the hero should disappear.

Replace it with:

```text
Since your last demonstration

Coverage        +4.7%
New states      3
Resolved gaps   6
New findings    2
```

The dashboard gradually becomes quieter as the user becomes more sophisticated.

That is desirable.

New users need explanation.

Experienced users need signal.

---

# 55. Summary of Required Dashboard Components

The complete Phase 1 dashboard system should therefore contain:

1. Application/environment context
2. Adaptive primary action
3. Lifecycle-aware onboarding
4. SDK/telemetry connection status
5. Demonstration status
6. Analysis processing status
7. Behavioral summary
8. Coverage metrics
9. Coverage changes
10. Behavioral Graph preview
11. Workflow coverage ranking
12. Missing states
13. Missing flows
14. Recommended next demonstrations
15. Recent sessions
16. Replay shortcuts
17. Endpoint health
18. Recent reports
19. Application activity
20. Privacy status
21. Integration health
22. Plan usage
23. Role-aware personalization
24. Plan-aware feature access
25. Long-term trend information
26. Clear empty/error/loading states

---

# 56. Core Rule

The central rule for the Tellann dashboard should be:

> **Never show the absence of evidence as evidence of poor quality.**

A brand-new application does not have:

```text
0% coverage
```

It has:

```text
Coverage not measured yet.
```

After observation begins, Tellann earns the right to show percentages.

That distinction is small in code and enormous in product perception.

---

# 57. Final Dashboard Evolution

The adaptive progression should ultimately feel like:

```text
NEW USER
"What do I do?"
      ↓

CONNECTED USER
"Is Tellann receiving data?"
      ↓

FIRST DEMONSTRATION
"What did Tellann learn?"
      ↓

ACTIVE USER
"What is missing?"
      ↓

EXPERIENCED USER
"What changed?"
      ↓

MATURE TEAM
"What should we investigate next?"
```

That progression mirrors Tellann's deeper product philosophy:

```text
Observe
↓
Understand
↓
Measure
↓
Identify Gaps
↓
Explain Quality
```

The dashboard should therefore evolve alongside the behavioral understanding of the application rather than presenting the same static analytics grid to every user.
