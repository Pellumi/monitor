# `/product/qa-reports` — Complete Page Specification

`/product/qa-reports` should be the **final synthesis layer of the Phase 1 Tellann product story**.

The earlier pages explain individual intelligence surfaces:

```text
Demonstration Mode
        ↓
Behavior Graphs
        ↓
Workflow Discovery
        ↓
Session Replay
        ↓
Coverage
        ↓
Missing Flows
        ↓
Missing States
        ↓
Endpoint Intelligence
        ↓
QA REPORTS
```

QA Reports should answer:

> **“How does all of the behavioral evidence Tellann collected become something an engineering or QA team can actually review, share, export, and act on?”**

The QA Reporting specification explicitly describes reporting as the communication layer between Tellann's intelligence engines and engineering teams, with the purpose of transforming behavioral data into actionable quality information rather than forcing teams to manually interpret telemetry, workflows, and sessions. 

---

# 1. Role of `/product/qa-reports`

The page should not primarily sell:

> “Tellann can generate PDFs.”

That is too shallow.

The product story is:

> **Tellann converts behavioral evidence into structured QA artifacts.**

A report should preserve the relationship between:

```text
WHAT WAS OBSERVED
        +
HOW THE APPLICATION BEHAVED
        +
WHAT WAS COVERED
        +
WHAT WAS NOT OBSERVED
        +
WHAT ENDPOINTS PARTICIPATED
        +
WHAT SESSIONS SUPPORT THE FINDING
        ↓
ACTIONABLE QA EVIDENCE
```

This makes QA Reports the **communication endpoint of the entire Tellann Phase 1 pipeline**.

---

# 2. Position in the Product navigation

I would place it near the bottom of the Product mega-menu:

```text
Understand

Behavior Graphs
Workflow Discovery


Investigate

Session Replay
Endpoint Intelligence


Analyze

Coverage
Missing Flows
Missing States


Communicate

QA Reports
```

That grouping makes the feature hierarchy clearer.

---

# 3. Core questions the page must answer

The page should make it easy to understand:

* What reports does Tellann generate?
* What information goes into those reports?
* When is a report generated?
* Can a report drill into workflows, coverage, gaps, sessions, and endpoints?
* What is an Executive Quality Report?
* What is a Flow Coverage Report?
* What is a Behavioral Graph Report?
* What is a Missing Flow Report?
* What is a Missing State Report?
* What is a Session Analysis Report?
* What is an Endpoint Intelligence Report?
* What severity levels exist?
* Can reports be exported?
* Can an exported report still point back to Tellann?
* Are report findings explainable?
* Which reports are available in Phase 1 versus future phases?

Phase 1 formally defines seven report families: **Executive Quality, Flow Coverage, Behavioral Graph, Missing Flow, Missing State, Session Analysis, and Endpoint Intelligence**. 

---

# 4. Recommended page architecture

```text
/product/qa-reports
│
├── 01 Global Navigation
├── 02 Hero
├── 03 From Behavior to QA Evidence
├── 04 Report Library Overview
├── 05 Executive Quality Report
├── 06 Flow Coverage Report
├── 07 Behavioral Graph Report
├── 08 Missing Flow Report
├── 09 Missing State Report
├── 10 Session Analysis Report
├── 11 Endpoint Intelligence Report
├── 12 Interactive Report Explorer
├── 13 Findings & Severity
├── 14 Evidence Traceability
├── 15 Report Generation Lifecycle
├── 16 Demonstration → Report
├── 17 Report History & Metadata
├── 18 Export & Sharing
├── 19 Report Actions / Drill-down
├── 20 What Reports Do Not Mean
├── 21 Phase-Based Report Evolution
├── 22 FAQ
├── 23 Final CTA
└── 24 Footer
```

---

# 5. Hero

### Eyebrow

```text
QA REPORTS
```

### Recommended H1

> **Turn application behavior into QA evidence your team can use.**

Alternative:

> **From observed behavior to a complete QA picture.**

The first is stronger.

### Supporting copy

> Tellann brings workflows, behavioral graphs, coverage, missing states, missing flows, session evidence, and endpoint analysis together in structured reports designed for engineering and QA review.

### Primary CTA

```text
[ Explore a sample report ]
```

### Secondary CTA

```text
[ See what Tellann reports → ]
```

Optional tertiary:

```text
View Coverage →
```

---

# 6. Hero visual concept

This should not start with a static PDF page floating in space.

Instead show **multiple Tellann intelligence surfaces collapsing into a report**.

```text
Behavior Graph ─────┐
                    │
Coverage ───────────┤
                    │
Missing Flows ──────┤
                    ├────→ QA REPORT
Missing States ─────┤
                    │
Session Evidence ───┤
                    │
Endpoints ──────────┘
```

Then the report resolves:

```text
APPLICATION QUALITY REPORT

Workflows
14

Workflow Coverage
76%

Missing States
11

Missing Flows
8

Slow Endpoints
3
```

Those categories mirror the Executive Quality Report structure in the specification. 

---

# 7. Hero media dimensions

Prefer **interactive HTML + SVG** rather than a prerecorded hero video.

### Master design canvas

```text
1920 × 1120
```

### Desktop display

```text
max-width: 1320px
height: 730–770px
```

### Placement

```text
Hero copy
   ↓
48px
   ↓
Full-width report-generation visual
```

### Mobile

Use a simplified vertical sequence:

```text
Graph
 ↓
Coverage
 ↓
Gaps
 ↓
Report
```

Mobile conceptual canvas:

```text
1080 × 1350
4:5
```

---

# 8. Hero animation

Duration:

```text
10–12 seconds
```

Sequence:

```text
0–2s
Behavior Graph appears.

2–4s
Coverage metrics attach.

4–5s
Missing Flow findings appear.

5–6s
Missing State findings appear.

6–7s
Endpoint evidence appears.

7–8s
Session evidence attaches.

8–10s
Elements collapse into a report.

10–11s
Report preview resolves.
```

Afterward, stop.

Do not continuously shuffle report pages.

---

# 9. Section — From behavior to QA evidence

### H2

> **One behavioral model. Multiple QA views.**

Show the complete data relationship:

```text
TELEMETRY
    ↓
SESSIONS
    ↓
BEHAVIOR GRAPH
    ↓
ANALYSIS ENGINES
    ↓
REPORT GENERATION
    ↓
DASHBOARD
    ↓
EXPORT
    ↓
ENGINEERING TEAM
```

That sequence is formally defined as the reporting lifecycle. 

---

# 10. Lifecycle animation

### Master

```text
1800 × 900
```

### Display

```text
1100 × 550
```

### Duration

```text
6–8 seconds
```

Use progressive construction:

```text
Telemetry
→ Session
→ Graph
→ Analysis
→ Report
```

Do not depict AI or LLMs in this Phase 1 pipeline.

---

# 11. Report Library Overview

### H2

> **Seven report types. One behavioral QA model.**

Display seven report cards.

```text
01 Executive Quality

02 Flow Coverage

03 Behavioral Graph

04 Missing Flow

05 Missing State

06 Session Analysis

07 Endpoint Intelligence
```

These are precisely the Phase 1 reporting set defined in the reporting specification. 

---

# 12. Report card layout

Desktop:

```text
3 + 4 grid
```

or:

```text
4 + 3
```

Card dimensions:

```text
~285 × 320px
```

Gap:

```text
20–24px
```

Each card should contain:

```text
REPORT TYPE

Short purpose

Mini report preview

Key outputs

[ Preview ]
```

Mobile:

```text
horizontal snap carousel
```

or one-column cards.

I prefer a horizontally scrollable card row on mobile because seven large cards would make this page unnecessarily long.

---

# 13. Executive Quality Report

### H2

> **The high-level picture of application quality.**

The specification describes the Executive Quality Report as the high-level quality summary, including workflow, coverage, missing-state, endpoint, risk, and recommendation summaries. 

Recommended public preview:

```text
APPLICATION QUALITY REPORT

Application
Storefront Demo

Workflows Discovered
14

Workflow Coverage
76%

Missing States
11

Missing Flows
8

Slow Endpoints
3


SECTIONS

Workflow Summary
Coverage Summary
Missing States
Missing Flows
Endpoint Summary
Findings
```

---

# 14. Important Quality Score issue

The specification currently shows:

```text
Quality Score
82/100
```

and the broader scoring framework includes a 0–100 Quality Score.  

However, your MVP scope separately excludes **AI quality scoring** from Phase 1. 

Those statements are not necessarily contradictory—a deterministic Phase 1 quality score could exist—but the supplied documents do **not establish the actual non-AI formula**.

Therefore, for the public website I would currently avoid prominently showing:

```text
Application Quality
82/100
```

until the score calculation is formally defined.

Instead use concrete metrics:

```text
Workflow Coverage     76%
Missing Flows          8
Missing States        11
Slow Endpoints         3
```

This is more defensible.

---

# 15. Executive Report visual

Master page:

```text
1000 × 1280
```

Website composite:

```text
1600 × 1100
```

Display:

```text
800 × 550
```

Use 3 overlapping report pages:

```text
Executive
Coverage
Missing Flows
```

with Executive in front.

Animation:

```text
pages slide apart by 24–32px
```

only once when entering viewport.

---

# 16. Flow Coverage Report

### H2

> **See what was exercised—and what remained unseen.**

The formal Flow Coverage Report includes:

```text
Workflow
Coverage
Observed Paths
Missing Paths

Workflow Coverage
State Coverage
Transition Coverage
Endpoint Coverage
Error Coverage
```



Example UI:

```text
FLOW COVERAGE REPORT

Checkout

Coverage
75%

Observed paths
15

Missing paths
5

Potential gaps

PAYMENT_FAILURE
OUT_OF_STOCK
INVENTORY_CHANGED
SESSION_TIMEOUT
GATEWAY_FAILURE
```

---

# 17. Coverage report media

Master:

```text
1000 × 1280
```

Display:

```text
600 × 768
```

Desktop layout:

```text
Copy                    Report
5 columns               7 columns
```

Beside the report, optionally show a mini graph:

```text
observed = solid
unobserved = dashed
```

---

# 18. Behavioral Graph Report

### H2

> **Capture the structure of observed application behavior.**

The Behavioral Graph Report is intended to visualize observed application behavior and includes metrics such as states, transitions, workflow count, entry points, exit points, and state frequency. 

Preview:

```text
BEHAVIORAL GRAPH REPORT

Application Map

ANONYMOUS
    ↓
REGISTERED
    ↓
AUTHENTICATED
    ↓
PRODUCT_BROWSING
    ↓
CART_ACTIVE
    ↓
CHECKOUT

States
28

Transitions
41

Workflows
6
```

---

# 19. Graph Report visual

Do not make the report entirely textual.

The Behavior Graph should occupy approximately:

```text
65–70% of page
```

on the report preview.

Master:

```text
1200 × 1500
```

Website render:

```text
640 × 800
```

The graph should match the same visual language used on `/product/behavior-graphs`.

---

# 20. Missing Flow Report

### H2

> **Turn unobserved paths into a reviewable QA artifact.**

The formal report includes missing-flow categories such as failure, recovery, alternative, rare, and edge-case flows, with examples such as `PAYMENT_FAILURE`, `RETRY_PAYMENT`, `OUT_OF_STOCK`, `CART_EXPIRATION`, and `SESSION_TIMEOUT`. 

Preview:

```text
MISSING FLOW REPORT

Workflow
Checkout

Potential Missing Flows

HIGH
PAYMENT_FAILURE

MEDIUM
RETRY_PAYMENT

MEDIUM
OUT_OF_STOCK

LOW
CART_EXPIRATION

INFO
SESSION_TIMEOUT
```

All sample severity assignments should be marked illustrative unless an actual ranking model exists.

---

# 21. Missing State Report

### H2

> **Document application conditions that were never observed.**

The Missing State Report is formally defined around missing states such as:

```text
LOADING_STATE
EMPTY_CART
NO_RESULTS
404_PAGE
AUTHENTICATION_ERROR
PAYMENT_FAILURE
```

and categories including loading, empty, error, recovery, and security states. 

Public report preview:

```text
MISSING STATE REPORT

LOADING
Checkout Loading

EMPTY
Empty Cart
No Results

ERROR
Authentication Error
Payment Failure

RECOVERY
Retry Payment
```

I would omit the `Security States` category from the marketing preview until its exact Phase 1 detection behavior is clearly specified.

---

# 22. Session Analysis Report

### H2

> **Summarize the behavioral evidence behind a demonstration.**

The Session Analysis Report is intended to summarize demonstration sessions and includes timeline, workflow summary, user journey, errors, and API activity. 

Preview:

```text
SESSION ANALYSIS

Session
SES-1001

Duration
18 minutes

Events
652

Workflows
6

States
28


TIMELINE
...

WORKFLOWS
...

ERRORS
...

API ACTIVITY
...
```

---

# 23. Session Report visual

Use a hybrid portrait format:

```text
Top 30%
summary metrics

Middle 40%
timeline

Bottom 30%
workflows + errors + APIs
```

Master:

```text
1000 × 1400
```

Display:

```text
600 × 840
```

Clicking the timeline in the interactive website version should link conceptually to Session Replay.

---

# 24. Endpoint Intelligence Report

### H2

> **Bring API behavior into the same QA evidence model.**

The Endpoint Intelligence Report is designed to analyze API performance and includes response timing, requests, error rates, endpoint categorization, and recommendations. 

Phase 1-safe preview:

```text
ENDPOINT INTELLIGENCE REPORT

Endpoints observed
12

Slow endpoints
2

Elevated error endpoints
1


POST /payment
Avg. 891 ms
Errors 13.3%

POST /checkout
Avg. 418 ms
```

Avoid displaying large production-style request counts unless clearly labeled as illustrative demonstration data.

---

# 25. Interactive Report Explorer

This should be the strongest interactive section on the page.

### H2

> **Explore the report before you export it.**

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ QA Reports                         Storefront Demo         │
├─────────────────┬───────────────────────────────────────────┤
│ REPORTS         │                                           │
│                 │                                           │
│ Executive       │             REPORT VIEWER                 │
│ Coverage        │                                           │
│ Graph           │                                           │
│ Missing Flow    │                                           │
│ Missing State   │                                           │
│ Session         │                                           │
│ Endpoint        │                                           │
│                 │                                           │
├─────────────────┴───────────────────────────────────────────┤
│ Generated Sep 10 · v1.0                  Export ▾         │
└─────────────────────────────────────────────────────────────┘
```

---

# 26. Report Explorer dimensions

Desktop:

```text
1280 × 820px
```

Container:

```text
max-width: 1400px
```

Tablet:

```text
960 × ~780px
```

Mobile:

```text
Report selector
↓
Report summary
↓
Report viewer
↓
Actions
```

Do not try to show an A4-like report at unreadably small scale on mobile.

---

# 27. Report Explorer controls

Recommended:

```text
Report Type
[ Executive ▾ ]

Application
[ Storefront Demo ▾ ]

Demonstration
[ Latest ▾ ]

[ Preview ]
[ Export ▾ ]
```

Report navigation:

```text
Overview
Workflows
Coverage
Missing Flows
Missing States
Endpoints
```

Do not make the marketing demo as complex as the full product.

---

# 28. Report drill-down

Reports should not feel like dead documents.

Click:

```text
Missing Flows
8
```

and conceptually open:

```text
PAYMENT_FAILURE
RETRY_PAYMENT
SESSION_TIMEOUT
...
```

Click:

```text
PAYMENT_FAILURE
```

and show:

```text
Workflow
Checkout

Status
Not observed

Detection basis
SUCCESS → FAILURE

[ Open in Missing Flow Analysis ]
```

The same principle applies to coverage, states, endpoints, and sessions.

---

# 29. Evidence traceability

### H2

> **Every important finding should lead back to evidence.**

Show:

```text
QA REPORT

Payment Failure
Potential Gap

        ↓

MISSING FLOW

        ↓

CHECKOUT WORKFLOW

        ↓

BEHAVIOR GRAPH

        ↓

SUPPORTING SESSIONS

        ↓

SESSION REPLAY

        ↓

EVENTS
```

This is arguably the strongest differentiating idea for Tellann's reports.

They should not be isolated PDFs produced by a black box.

---

# 30. Evidence trace animation

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Duration:

```text
7–9 seconds
```

Sequence:

```text
Report finding
↓
workflow
↓
graph edge
↓
session
↓
event
```

Then reverse navigation back to the report.

---

# 31. Findings & Severity

### H2

> **Separate information from what deserves attention.**

The reporting standard defines:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

for report findings. 

Use a consistent badge system across all reports.

For example:

```text
HIGH
Payment Failure not demonstrated

MEDIUM
Checkout Loading not observed

INFO
Retry Payment not demonstrated
```

Do **not** invent severity purely from missing-flow category.

Severity requires defensible prioritization logic.

---

# 32. Severity design

Use:

```text
label
icon/shape
border treatment
optional semantic color
```

Do not rely only on:

```text
red
orange
yellow
```

Accessibility first.

---

# 33. Report generation lifecycle

### H2

> **Analysis becomes a report when the demonstration ends.**

The Developer Demonstration specification says a Demonstration QA Report is generated after every demonstration. 

Show:

```text
START DEMONSTRATION
       ↓
PERFORM WORKFLOW
       ↓
STOP
       ↓
PROCESS SESSION
       ↓
BUILD BEHAVIOR MODEL
       ↓
CALCULATE COVERAGE
       ↓
DETECT GAPS
       ↓
ANALYZE ENDPOINTS
       ↓
GENERATE REPORT
```

This is a very strong end-to-end visual.

---

# 34. Demonstration → Report product video

This should be the page's main real product video.

### Master

```text
1920 × 1200
16:10
```

### Display

```text
1100 × 688
```

### Duration

```text
12–15 seconds
```

Sequence:

```text
Stop demonstration
↓
Processing
↓
Analysis complete
↓
QA report generated
↓
Open report
↓
Coverage
↓
Missing Flows
↓
Endpoint finding
```

This can reuse UI footage from `/product/demonstration-mode`.

---

# 35. Report Metadata

Every report is specified to carry:

```text
reportId
reportType
applicationId
generatedAt
generatedBy
version
```



Public UI should render friendlier equivalents:

```text
Report
Flow Coverage

Application
Storefront Demo

Generated
Sep 10, 2026

Version
1.0
```

Hide internal UUIDs by default.

---

# 36. Report History

Although the metadata standard includes report versions, the supplied source does not define a full end-user report-history interaction model.

Still, the UI can safely support a library/history concept if implemented:

```text
LATEST REPORTS

Executive Quality
Today · 10:42

Flow Coverage
Today · 10:42

Missing Flows
Today · 10:42
```

If historical comparison is not actually available yet, avoid:

```text
Compare report versions
```

as a shipping claim.

---

# 37. Export & Sharing

### H2

> **Use the report inside Tellann—or take it with you.**

The report specification requires all reports to support:

```text
PDF
CSV
JSON
HTML
```



Show:

```text
EXPORT

PDF
For reviews and sharing

CSV
For tabular analysis

JSON
For structured data

HTML
For portable web viewing
```

---

# 38. Export interaction video

A short second video can show:

```text
Open report
↓
Export
↓
PDF / CSV / JSON / HTML
↓
PDF selected
↓
export generated
```

Master:

```text
1920 × 1200
```

Display:

```text
900 × 562
```

Duration:

```text
6–8 seconds
```

Do not show operating-system download UI if unnecessary.

---

# 39. Recommended HTML export behavior

If you implement HTML reports, I would make them self-contained and readable outside the authenticated dashboard where policy allows.

They should preserve:

```text
report title
generated timestamp
application
findings
graphs as SVG
tables
Tellann branding
```

Interactive links back to Tellann can be present when appropriate.

Avoid embedding sensitive session payloads directly into a portable HTML export.

---

# 40. Report actions

Inside the actual product, each report finding should support contextual actions such as:

```text
Open analysis
View workflow
View graph
View supporting sessions
Open replay
Demonstrate this gap
```

This creates:

```text
REPORT
 ↓
FINDING
 ↓
EVIDENCE
 ↓
ACTION
```

instead of:

```text
REPORT
 ↓
PDF
 ↓
done
```

That is a far more valuable product philosophy.

---

# 41. Report relationships

You should visually show how each report maps to the rest of Tellann:

| Report                | Primary source          | Natural drill-down    |
| --------------------- | ----------------------- | --------------------- |
| Executive             | All Phase 1 analysis    | Dashboard             |
| Flow Coverage         | Coverage engine         | Coverage              |
| Behavioral Graph      | Behavior Graph          | Graph Explorer        |
| Missing Flow          | Missing-flow detection  | Missing Flows         |
| Missing State         | Missing-state detection | Missing States        |
| Session Analysis      | Session engine          | Session Replay        |
| Endpoint Intelligence | Backend telemetry       | Endpoint Intelligence |

This table can be actual page content because it helps explain that reports are views over the same model, not seven disconnected systems.

---

# 42. What Reports do not mean

### H2

> **A report summarizes evidence. It does not magically prove software quality.**

Important trust copy:

```text
A high coverage score does not mean
the application contains no bugs.

A missing flow does not automatically
mean a workflow is broken.

A missing state does not automatically
mean implementation is incomplete.

An endpoint warning does not automatically
identify root cause.

A report finding should always remain
traceable to its detection basis and evidence.
```

This is especially important for Tellann.

---

# 43. Another important distinction: report vs test result

Avoid language like:

```text
TEST REPORT

Passed
Failed
```

for the general QA report engine unless actual validation tests were executed.

Phase 1 is primarily:

```text
Observed
Unobserved
Potential Gap
Failure Observed
Coverage
```

Autonomous test generation/execution belongs later.

---

# 44. Phase 1 reporting boundaries

Phase 1 reports are intended to help teams understand application behavior. The reporting roadmap then expands into production intelligence and autonomous-quality reporting in later phases. 

Therefore `/product/qa-reports` should focus overwhelmingly on:

```text
Behavioral QA Reports
```

rather than teasing dozens of future reports throughout the page.

---

# 45. Future report evolution

A small roadmap section can show:

### NOW — Phase 1

```text
Executive Quality
Flow Coverage
Behavioral Graph
Missing Flow
Missing State
Session Analysis
Endpoint Intelligence
```

### NEXT — Phase 2 / Planned

```text
Workflow Health
User Journey
Database Intelligence
Error Investigation
```

### LATER — Phase 3 / Planned

```text
Release Validation
Regression
Generated Test
Failure Simulation
Behavioral Anomaly
Quality Intelligence
```

That exact report evolution is defined by the QA Reporting specification. 

Visually mark future groups:

```text
PLANNED
```

---

# 46. Do not promote future reports as available

For example:

Bad:

```text
Generate Regression Reports
```

on the main feature grid.

Better:

```text
PLANNED · PHASE 3

Regression Reports
Compare behavioral changes between releases.
```

Release validation, regressions, generated tests, failure simulation, anomaly reporting, and autonomous quality reports are future report families—not current Phase 1 capabilities. 

---

# 47. Recommended FAQ

Include questions such as:

```text
What is a Tellann QA Report?

When are reports generated?

Which reports are available in Phase 1?

What is an Executive Quality Report?

What is a Flow Coverage Report?

Can I see the Behavior Graph inside a report?

How are missing flows represented?

How are missing states represented?

Can a report link to Session Replay?

Can I inspect endpoints from a report?

What does report severity mean?

Does a high coverage score mean my application is bug-free?

Does Tellann automatically pass or fail my application?

Can reports be exported?

Which export formats are supported?

Are reports generated with AI?

Does Tellann generate regression reports today?

Does Tellann generate test reports today?
```

---

# 48. Final CTA

### Eyebrow

```text
TURN BEHAVIOR INTO QA EVIDENCE
```

### H2

> **Demonstrate the workflow. Let Tellann build the report.**

Supporting copy:

> Connect your application, record a demonstration, and turn observed behavior into workflows, coverage, gaps, session evidence, endpoint insights, and structured QA reports.

Buttons:

```text
[ Start free ]

[ Explore Demonstration Mode ]
```

Optional:

```text
View Coverage →
```

---

# 49. Complete media inventory

| Asset                       | Type             | Master dimensions | Website display |
| --------------------------- | ---------------- | ----------------: | --------------: |
| Hero Intelligence → Report  | HTML/SVG         |         1920×1120 |        1320×760 |
| Mobile Hero                 | SVG              |         1080×1350 |      Responsive |
| Report Lifecycle            | Animated SVG     |          1800×900 |        1100×550 |
| Report Library              | Interactive HTML |                 — |          1200px |
| Executive Report            | UI/report        |         1000×1280 |       600–800px |
| Flow Coverage Report        | UI/report        |         1000×1280 |         600×768 |
| Behavioral Graph Report     | UI/report        |         1200×1500 |         640×800 |
| Missing Flow Report         | UI/report        |         1000×1280 |         600×768 |
| Missing State Report        | UI/report        |         1000×1280 |         600×768 |
| Session Analysis Report     | UI/report        |         1000×1400 |         600×840 |
| Endpoint Report             | UI/report        |         1000×1280 |         600×768 |
| Interactive Report Explorer | HTML             |                 — |        1280×820 |
| Evidence Traceability       | Animated SVG     |          1600×900 |        1000×562 |
| Demonstration → Report      | Product video    |         1920×1200 |        1100×688 |
| Severity UI                 | HTML             |                 — |       ~1000×400 |
| Report Metadata/History     | HTML             |                 — |       ~1000×500 |
| Export Interaction          | Product video    |         1920×1200 |         900×562 |
| Phase Evolution             | SVG/HTML         |          1600×800 |        1000×500 |

So there are roughly **18 major visual surfaces**, but only **two actual videos** are necessary:

1. Demonstration → generated report — **12–15 seconds**
2. Report export interaction — **6–8 seconds**

Everything else should preferably use native HTML, SVG, and existing Tellann visualization components.

---

# 50. Report visual design system

All seven reports should share one template system rather than being independently designed.

Conceptually:

```tsx
<QAReport>
  <ReportHeader />
  <ReportSummary />
  <ReportSections />
  <ReportFindings />
  <ReportEvidence />
  <ReportFooter />
</QAReport>
```

Then:

```tsx
<ExecutiveQualityReport />
<FlowCoverageReport />
<BehaviorGraphReport />
<MissingFlowReport />
<MissingStateReport />
<SessionAnalysisReport />
<EndpointIntelligenceReport />
```

should provide content blocks into the same report shell.

---

# 51. Report template anatomy

Every exported/preview report should use approximately:

```text
HEADER
Tellann
Report name
Application
Generated date
Version


EXECUTIVE SUMMARY
High-level metrics


PRIMARY ANALYSIS
Report-specific visualization


FINDINGS
Structured issues / gaps


EVIDENCE
Relevant sources


RECOMMENDATIONS / NEXT STEPS
Where supported


METADATA
Report/version/application information
```

This gives the entire reporting suite a recognizable visual identity.

---

# 52. Report visual language

Stay monochrome:

```text
Black
White
Off-white
Gray
```

Use limited semantic colors only for:

```text
critical
high
medium
low
observed
potential gap
failure
```

Report graphs should use the same node/edge styling as Tellann's dashboard and Product pages.

This is important because exporting a Behavior Graph Report should not produce a completely different graph style from the dashboard.

---

# 53. Recommended report typography

Use Satoshi consistently with the Tellann brand.

Example:

```text
Report title
32–38px / Bold

Section heading
20–24px / Semibold

Metric value
30–36px / Medium

Body
14–16px

Table
12–14px

Metadata
11–12px
```

Exported reports should prioritize readability over the more spacious marketing-site typography.

---

# 54. Interactive report implementation

Conceptually:

```ts
type ReportType =
  | "EXECUTIVE_QUALITY"
  | "FLOW_COVERAGE"
  | "BEHAVIOR_GRAPH"
  | "MISSING_FLOW"
  | "MISSING_STATE"
  | "SESSION_ANALYSIS"
  | "ENDPOINT_INTELLIGENCE";
```

Report metadata aligns naturally with the existing standard containing report ID, type, application, generation time, generator, and version. 

---

# 55. Report data should not be duplicated

Architecturally:

```text
Coverage Report
        ↓
Coverage API

Missing Flow Report
        ↓
Missing Flow domain

Session Report
        ↓
Session domain
```

Do not independently recalculate product intelligence inside the report renderer.

The report layer should **consume canonical analysis output**.

That keeps:

```text
Dashboard coverage
=
Exported report coverage
```

instead of creating two competing calculations.

---

# 56. Suggested component tree

```tsx
<QAReportsPage>
  <SiteHeader />

  <QAReportsHero />

  <ReportingLifecycle />

  <ReportLibrary>
    <ReportCard />
  </ReportLibrary>

  <ExecutiveReportSection />
  <CoverageReportSection />
  <BehaviorGraphReportSection />
  <MissingFlowReportSection />
  <MissingStateReportSection />
  <SessionReportSection />
  <EndpointReportSection />

  <InteractiveReportExplorer />

  <SeverityModel />

  <EvidenceTraceability />

  <DemonstrationToReport />

  <ReportMetadata />

  <ReportExport />

  <ReportingBoundaries />

  <ReportRoadmap />

  <FAQ />

  <FinalCTA />

  <SiteFooter />
</QAReportsPage>
```

---

# 57. Responsive design

### Desktop ≥1280px

Use:

```text
Report copy | Report preview
```

5/7 layout.

Interactive report explorer remains full-width.

### Tablet

```text
Copy
↓
Report
```

Report preview approximately:

```text
650–720px wide
```

### Mobile

Do not scale an A4 report down until the text is microscopic.

Instead render:

```text
Report title

Summary cards

Key findings

[ Preview full report ]

[ Export ]
```

Opening `Preview full report` launches a fullscreen scrollable report.

---

# 58. Mobile report preview

Example:

```text
FLOW COVERAGE

Checkout

75%
Coverage

15
Observed paths

5
Missing paths

────────────

Top gaps

Payment Failure
Session Timeout
Out of Stock

[ View complete report ]
```

This is much better than showing a 320px-wide PDF screenshot.

---

# 59. Accessibility

Every report graph must also provide tabular/text alternatives.

For example:

```text
Behavior Graph
[ Graph ] [ Table ]
```

Severity must never be color-only.

Exports should use semantic headings/tables where the chosen format permits.

Product videos require captions or equivalent descriptive transcripts.

---

# 60. Reduced motion

Under:

```css
@media (prefers-reduced-motion: reduce)
```

disable:

```text
report page stacking animation
pipeline drawing
metric count-up
automatic report transitions
autoplay product videos
```

Show completed report layouts immediately.

---

# 61. Performance

Do not preload seven high-resolution report screenshots.

Use:

```text
AVIF/WebP preview
       ↓
load high-resolution version
only when report enters viewport
```

Even better, render report previews as native HTML where practical.

Video:

```text
WebM
MP4 fallback
poster
preload="metadata"
```

Only the first meaningful product recording should preload.

---

# 62. SEO

### Recommended title

> **QA Reports — Turn Application Behavior Into QA Evidence | Tellann**

Alternative:

> **Behavioral QA Reports for Software Teams | Tellann**

### Meta description

> Generate structured behavioral QA reports with Tellann covering workflows, coverage, Behavior Graphs, missing flows, missing states, session evidence, and endpoint intelligence.

---

# 63. Analytics instrumentation

Track:

```text
qa_reports_hero_interacted

qa_report_type_selected

qa_report_previewed

qa_report_section_opened

qa_report_finding_selected

qa_report_evidence_opened

qa_report_workflow_opened

qa_report_replay_opened

qa_report_endpoint_opened

qa_report_export_opened

qa_report_export_format_selected

qa_report_phase_future_viewed

qa_report_signup_clicked
```

Useful properties:

```json
{
  "reportType": "MISSING_FLOW",
  "action": "finding_selected",
  "sourceSection": "report_explorer"
}
```

---

# 64. Two specification issues to resolve before launch

There are two things I would formalize before turning all QRS examples into public claims.

**First: scoring formulas.** The reporting specification defines 0–100 ranges for Coverage, Workflow Health, Endpoint Health, Release Confidence, and Quality scores.  But it does not provide the calculation formulas in the retrieved section, while several of these scores belong to later product phases. The site should therefore show only scores whose formulas and phase availability are actually implemented.

**Second: recommendations.** Some reports contain a Recommendations section, but Phase 1 explicitly excludes AI recommendations. Recommendations shown on Phase 1 reports should therefore be deterministic/rule-based or directly evidence-backed—not described as autonomous AI conclusions.

Both changes preserve the strength of Tellann's reporting story without overpromising.

---

# 65. Most important UX principle for QA Reports

Every meaningful report finding should support:

```text
WHAT?

Payment Failure


WHERE?

Checkout Workflow


WHAT DID TELLANN SEE?

Payment Success


WHAT IS THE FINDING?

Payment Failure was not observed.


WHY IS IT HERE?

Success → Failure detection rule.


WHAT EVIDENCE EXISTS?

15 related Checkout sessions.


WHAT CAN I DO?

View workflow
View evidence
Demonstrate path
```

That makes a Tellann report **explainable and actionable**, rather than just polished output.

---

# 66. Highest-priority assets to implement first

If building incrementally, prioritize:

1. **Hero Behavior → Report animation** — this defines the page.
2. **Interactive Report Explorer** — demonstrates that reports are part of the product, not static PDFs.
3. **Executive Report template** — establishes the reporting design system.
4. **Flow Coverage Report** — strongest Phase 1 analysis report.
5. **Demonstration → Report video** — communicates the complete workflow.
6. **Evidence Traceability interaction** — differentiates Tellann from generic report-generation products.
7. **Missing Flow / Missing State report templates** — reinforces the core QA differentiator.

Once these exist, the Session and Endpoint templates can reuse most of the reporting system.

---

# 67. Final page narrative

The visitor should ultimately experience:

```text
I demonstrate Checkout.

        ↓

Tellann captures the session.

        ↓

It reconstructs the workflow.

        ↓

It creates the Behavior Graph.

        ↓

It measures coverage.

        ↓

It surfaces missing states.

        ↓

It surfaces missing flows.

        ↓

It analyzes observed endpoints.

        ↓

All of that becomes structured QA evidence.

        ↓

I open the Executive Report.

        ↓

I see that Checkout coverage is low.

        ↓

I click the coverage finding.

        ↓

I see the missing Payment Failure path.

        ↓

I inspect why Tellann surfaced it.

        ↓

I open the supporting sessions.

        ↓

I replay the observed Checkout behavior.

        ↓

I decide to demonstrate Payment Failure next.

        ↓

Tellann receives new behavioral evidence.

        ↓

The next report reflects the expanded model.
```

That is what `/product/qa-reports` should communicate: **reports are not an afterthought or an export button. They are the final communication layer of Tellann's Behavioral QA system—turning the Behavior Graph, workflows, coverage, gaps, sessions, and endpoint observations into structured evidence that engineering teams can understand and act on.** Phase 1 already defines the seven-report family and the Telemetry → Sessions → Behavior Graph → Analysis → Report → Export lifecycle needed to support that story. 
