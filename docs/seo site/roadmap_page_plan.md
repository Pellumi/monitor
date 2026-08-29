`/roadmap` should be Tellann’s **public product-direction page**: a transparent view of what exists now, what is being developed next, and what belongs to the longer-term vision.

It should not become a public Jira board. Customers care about **capabilities and direction**, not internal ticket IDs, sprint estimates, or architecture chores.

The product already has a natural roadmap structure:

```text
Phase 1
Behavioral QA Platform

        ↓

Phase 2
Production Intelligence Platform

        ↓

Phase 3
Autonomous Validation Engine
```

That progression is consistent across the PRD, functional requirements, architecture, and MVP scope.   

# `/roadmap` — Complete Page Specification

## 1. Primary purpose

The page should answer:

```text
What can Tellann do today?

What is Tellann actively building?

What is planned after that?

What is merely being explored?

How does each capability fit
into the larger Tellann vision?
```

For different audiences:

```text
Existing customer
→ What is coming next?

Prospective customer
→ Is Tellann heading where we need it?

Developer
→ Which integrations/capabilities are planned?

Investor / partner
→ What is the product evolution?

Community
→ What has shipped recently?
```

---

# 2. Important rule: roadmap ≠ promises

Every roadmap page needs this.

Tellann should distinguish:

```text
AVAILABLE
Already generally available.

IN PROGRESS
Actively being implemented.

PLANNED
Intended for a future release.

EXPLORING
Research / design direction,
not committed functionality.
```

Do not publish:

```text
Coming September 12
```

unless you are genuinely willing to treat September 12 as a commitment.

For an early-stage product, I would primarily use **status rather than dates**.

---

# 3. Overall page structure

```text
/roadmap
│
├── 01 Navigation
├── 02 Roadmap Hero
├── 03 Status Legend
├── 04 Current Product Snapshot
├── 05 Phase Navigation
├── 06 Phase 1 — Behavioral QA
├── 07 Phase 2 — Production Intelligence
├── 08 Phase 3 — Autonomous Validation
├── 09 Platform / SDK Evolution
├── 10 Enterprise & Platform Evolution
├── 11 Recently Shipped
├── 12 How We Prioritize
├── 13 Roadmap Feedback
├── 14 Roadmap FAQ
├── 15 Vision CTA
└── 16 Footer
```

---

# 4. Hero

### Eyebrow

```text
TELLANN ROADMAP
```

### H1

> **From observing behavior to continuously understanding quality.**

Supporting copy:

> Tellann begins by turning demonstrated application behavior into quality intelligence. From there, the platform expands into production understanding and eventually behavior-driven autonomous validation.

That accurately reflects the current three-phase product direction. 

### CTA

```text
[ See what is available now ]
[ View changelog ]
```

First scrolls to current capabilities.

Second:

```text
/changelog
```

---

# 5. Hero visual

I would visualize the roadmap as one continuous intelligence progression:

```text
OBSERVE
   ↓
MODEL
   ↓
UNDERSTAND
   ↓
MONITOR
   ↓
COMPARE
   ↓
PREDICT
   ↓
VALIDATE
```

Underneath:

```text
PHASE 1              PHASE 2              PHASE 3
Behavioral QA        Production           Autonomous
                     Intelligence         Validation
```

This is much stronger than a generic horizontal timeline with dates.

---

# 6. Status legend

Immediately establish what labels mean.

```text
● AVAILABLE
Currently usable.

◐ IN PROGRESS
Actively being built.

○ PLANNED
Part of an upcoming product phase.

◇ EXPLORING
Research direction; not committed.
```

Use accessible text, not color alone.

---

# 7. Current product snapshot

Before showing the future, establish reality.

Heading:

> **What Tellann is today**

Status:

```text
PHASE 1
BEHAVIORAL QA
```

Summary:

> Connect an application, record a demonstration, reconstruct its behavior, discover workflows, measure coverage, identify missing states and flows, inspect sessions and endpoints, and generate QA reports.

That is the authoritative MVP workflow. 

---

# 8. Current capability strip

Show concise capability chips/cards:

```text
Developer Demonstration
Behavior Graphs
Workflow Discovery
Session Replay
Coverage Analysis
Missing States
Missing Flows
Endpoint Intelligence
QA Reports
```

These are all explicitly in Phase 1 scope. 

Each can deep-link to its product page.

---

# 9. Phase navigation

Sticky secondary navigation:

```text
Overview   Phase 1   Phase 2   Phase 3   Shipped
```

Desktop can stay sticky below the primary navbar.

Mobile:

```text
Phase
[ Phase 1 ▾ ]
```

---

# 10. Roadmap card structure

Every roadmap capability should use the same model.

Example:

```text
WORKFLOW HEALTH

PLANNED · PHASE 2

Continuously evaluate whether important
application workflows remain healthy as
real users interact with production.

Includes:
• Success rate
• Error rate
• Latency
• Abandonment
• Health trends

Why it matters
Detect workflow degradation before it
becomes widespread customer impact.
```

Optional:

```text
Related:
Journey Intelligence
Error Correlation
```

---

# 11. Roadmap item data model

Implementation-wise:

```ts
type RoadmapStatus =
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "PLANNED"
  | "EXPLORING";

type RoadmapPhase =
  | "PHASE_1"
  | "PHASE_2"
  | "PHASE_3";

interface RoadmapItem {
  id: string;
  slug: string;

  title: string;
  description: string;

  phase: RoadmapPhase;
  status: RoadmapStatus;

  category: string;

  capabilities?: string[];
  rationale?: string;

  productHref?: string;
  changelogHref?: string;

  lastUpdated?: string;
}
```

Do not hardcode each roadmap card into JSX.

---

# 12. Phase 1 — Behavioral QA

Heading:

> **Phase 1 — Understand demonstrated behavior**

Goal:

> Generate useful QA intelligence from developer-led application demonstrations.

This is the MVP's central hypothesis: application behavior can be observed, modeled, and analyzed from demonstration sessions. 

---

# 13. Phase 1 capability groups

I would organize Phase 1 into five categories.

### Capture

```text
Frontend SDK
Backend SDK
Event Capture
Privacy Filtering
```

The MVP explicitly includes React and Node SDK capture. 

### Observe

```text
Developer Demonstration Mode
Session Recording
Session Replay
```

### Model

```text
State Discovery
Transition Discovery
Workflow Discovery
Behavior Graphs
```

### Analyze

```text
Workflow Coverage
State Coverage
Transition Coverage
Missing States
Missing Flows
Endpoint Intelligence
```

### Communicate

```text
Executive QA Report
Flow Coverage Report
Behavior Graph Report
Missing State Report
Missing Flow Report
Session Report
Endpoint Report
```

The Phase 1 reporting set is formally defined in the QA reporting specification. 

---

# 14. Phase 1 card status

Don't automatically label every Phase 1 requirement:

```text
AVAILABLE
```

unless the actual application currently implements it.

The **specification says what Phase 1 must contain**, not necessarily what today's deployment already contains.

So the roadmap dataset should independently determine:

```text
AVAILABLE
IN PROGRESS
PLANNED
```

for each Phase 1 item.

That prevents the roadmap from falsely turning requirements documentation into a shipping claim.

---

# 15. Developer Demonstration card

Example:

```text
DEVELOPER DEMONSTRATION MODE

[actual current status]

Teach Tellann how an application behaves by
performing real workflows instead of manually
describing them.

Developer
   ↓
Application walkthrough
   ↓
Events
   ↓
Workflows
   ↓
Behavior Graph
   ↓
QA Analysis
```

The demonstration lifecycle is already formally specified. 

---

# 16. Behavior Graph card

```text
BEHAVIOR GRAPHS

Turn observed application behavior into
states, actions, transitions and workflows.

State
 ↓
Action
 ↓
Transition
 ↓
Workflow
```

The Behavior Graph is explicitly defined as Tellann's central behavioral intelligence model. 

---

# 17. Coverage card

```text
BEHAVIORAL COVERAGE

Understand which parts of an application
were actually demonstrated.

Workflow
State
Transition
Endpoint
Error
```



---

# 18. Missing states / flows

You can either make them separate cards or one category:

```text
QUALITY GAPS

Missing States
├── Loading
├── Empty
├── Error
└── Recovery

Missing Flows
├── Failure
├── Alternative
├── Recovery
└── Edge-case
```

These are specifically included in MVP scope. 

---

# 19. Phase 2 — Production Intelligence

Heading:

> **Phase 2 — Understand production behavior**

Status:

```text
PLANNED
```

unless actual Phase 2 work has started.

Goal:

> Move from isolated demonstrations to continuous understanding of how real software workflows behave in production.

The architecture defines Phase 2 as the Production Intelligence Platform. 

---

# 20. Phase 2 capability groups

Organize this around four major intelligence areas.

### Production Monitoring

```text
Continuous ingestion
Real-user behavior
Workflow health
Behavioral trends
```

Functional requirements FR-066–069 define live production monitoring. 

---

# 21. Journey Intelligence

```text
Common journeys

Abandoned journeys

High-friction workflows

Repeated actions

Workflow bottlenecks
```

These are explicitly part of FR-070–075. 

Example card:

```text
USER JOURNEY INTELLIGENCE

Understand where real users move through,
struggle with, repeat, and abandon workflows.
```

---

# 22. Workflow Health

This should probably be one of the largest Phase 2 cards.

Visual:

```text
CHECKOUT

Current Health       82
Previous             96

Success ↓
Latency ↑
Errors ↑
Abandonment ↑
```

Workflow-health reporting is part of the Phase 2 reporting direction. 

---

# 23. Endpoint Intelligence expansion

Phase 1 already analyzes endpoints.

Phase 2 expands that into broader continuous endpoint intelligence:

```text
Most used APIs
Least used APIs
Slowest APIs
Unstable APIs
API rankings
```

Those capabilities are defined in FR-076–080. 

Avoid presenting this as a completely new feature if foundational endpoint analysis already exists in Phase 1.

Show:

```text
Endpoint Analysis
Phase 1

        ↓ evolves into ↓

Continuous Endpoint Intelligence
Phase 2
```

---

# 24. Database Intelligence

Card:

```text
DATABASE INTELLIGENCE

Understand database behavior behind
application workflows.

• Frequent queries
• Expensive queries
• Potentially unused fields
• Index recommendations
• Query optimization recommendations
```

These capabilities are defined for Phase 2. 

---

# 25. Error Correlation

This should be one of the strongest future capabilities.

Visual:

```text
CHECKOUT FAILURE
      │
      ├── Session Replay
      ├── Workflow Path
      ├── API Activity
      ├── Logs
      └── Database Activity
```

Tellann's Phase 2 Error Correlation Engine is specifically designed to produce this kind of investigation package. 

Message:

> Move from "an exception occurred" to "this is what the user was doing, which workflow failed, and what systems were involved."

---

# 26. Phase 3 — Autonomous Validation

Heading:

> **Phase 3 — Turn behavioral knowledge into validation**

Status:

```text
FUTURE
```

or individual cards may be `EXPLORING`.

Goal:

> Use accumulated behavior graphs, production telemetry, historical failures, and release history to help validate future software behavior automatically.

The PRD describes this as the ambitious third phase after behavioral and production data have matured. 

---

# 27. Phase 3 capability groups

I would use six.

```text
Test Generation

Regression Detection

Failure Simulation

Optimization Intelligence

Behavioral Anomaly Detection

Quality Intelligence
```

These map directly to the Phase 3 functional requirements. 

---

# 28. Automated test generation

Card:

```text
BEHAVIOR-DRIVEN TEST GENERATION

Observed:
LOGIN_SUCCESS

Generate:
LOGIN_FAILURE
LOCKED_ACCOUNT
EXPIRED_PASSWORD
SESSION_TIMEOUT
```

Tellann's eventual test generation requirements include positive, negative and edge-case scenarios. 

Important copy:

> Generated scenarios would remain traceable to observed behavior.

The non-functional requirements explicitly require this traceability. 

---

# 29. Regression detection

Visual:

```text
Release A                  Release B

CHECKOUT                   CHECKOUT
   │                           │
   ▼                           X
PAYMENT_SUCCESS             missing


REGRESSION
Payment success no longer reachable
```

Phase 3 requires comparing behavioral baselines across releases and identifying workflow deviations, unexpected state transitions, and missing workflows. 

---

# 30. Release validation

Although the FRS groups regression functionality explicitly, the reporting model also defines a future Release Validation Report:

```text
Release v2.4.0

Behavior Match      92%
Missing Workflows    2
New Workflows        3
Release Confidence  ...
```



I would expose this as a roadmap capability under Regression / Release Intelligence.

---

# 31. Failure simulation

```text
Workflow Model
      ↓
Inject failure
      ↓
Observe response
      ↓
Assess resilience
```

Potential scenarios formally defined include:

```text
Network failure
Service failure
Timeout
Workflow failure
```



Do not market this as chaos engineering today.

---

# 32. Behavioral anomalies

Card:

```text
BEHAVIORAL ANOMALY DETECTION

Historical
Checkout abandonment: 12%

Current
Checkout abandonment: 31%

        ↓

ABNORMAL CHANGE DETECTED
```

Future requirements include:

```text
workflow anomalies
abnormal abandonment
latency changes
error increases
```



---

# 33. Quality intelligence

This is the culmination.

Visual:

```text
Behavior Graph
Failures
Regressions
Anomalies
Performance
       │
       ▼
Quality Intelligence
       │
       ├── Risks
       ├── Evidence
       ├── Priorities
       └── Recommended actions
```

Future requirements call for:

* risk identification;
* explanations;
* recommendations;
* prioritization;
* continuous quality assessments;
* an interactive intelligence assistant. 

---

# 34. Explainability callout

Next to Phase 3:

> **Automation should not become a black box.**

Future generated insights are explicitly required to expose confidence, supporting evidence, rationale, and traceability. 

That's strategically important enough to expose publicly.

---

# 35. Section 09 — SDK & ecosystem evolution

The roadmap should also communicate platform coverage.

Heading:

> **Expanding where Tellann can observe.**

Current SDK specification:

```text
CURRENT / DEFINED

JavaScript
TypeScript
React
Next.js
Node.js
Express
NestJS
Fastify
```

Future:

```text
Vue
Angular
React Native
Android
iOS
```

The SDK specification explicitly classifies these latter platforms as future support. 

---

# 36. SDK roadmap visual

```text
WEB

React        [status]
Next.js      [status]

SERVER

Node.js      [status]
Express      [status]
NestJS       [status]
Fastify      [status]

FUTURE

Vue          [planned]
Angular      [planned]

MOBILE

React Native [planned]
Android      [planned]
iOS          [planned]
```

Again, actual shipping status should come from your roadmap dataset rather than automatically from the requirements document.

---

# 37. Section 10 — Deployment / Enterprise roadmap

Tellann also has long-term deployment evolution.

The deployment specification contemplates:

```text
Managed SaaS

and

Enterprise self-hosted deployment
```



Possible public roadmap category:

```text
PLATFORM & ENTERPRISE
```

Items can include, as appropriate:

```text
SSO / federation
Custom retention
Private networking
Data residency
Self hosting
Enterprise SLA
```

Several of these are already part of the intended Enterprise packaging. 

Only show roadmap status where product implementation actually supports the claim.

---

# 38. Roadmap filters

Once there are enough items, support:

```text
All

Behavioral QA
Production
Autonomous Validation
SDKs
Platform
Enterprise
```

and:

```text
Status

All
Available
In Progress
Planned
Exploring
```

URL state:

```text
/roadmap?phase=2
/roadmap?status=planned
/roadmap?category=sdk
```

Canonical remains `/roadmap`.

---

# 39. Search

Probably unnecessary initially.

When there are 50+ roadmap items:

```text
Search roadmap...
```

could become useful.

Do not build complexity for eight cards.

---

# 40. Detail interaction

Clicking a roadmap item can open:

### Option A — drawer

Best initially.

```text
Workflow Health

Status: Planned
Phase: Production Intelligence

What we're building
...

Why
...

Depends on
• Production monitoring
• Behavior graphs

Related
Journey Intelligence
Error Correlation
```

### Option B — dedicated route

Later:

```text
/roadmap/workflow-health
```

Only useful if roadmap items get substantial public commentary.

---

# 41. Dependencies

One interesting Tellann-specific feature would be showing dependencies.

Example:

```text
Production Monitoring
        ↓
Journey Intelligence
        ↓
Behavioral Baselines
        ↓
Anomaly Detection
```

or:

```text
Behavior Graph
      ↓
Release Graph Versions
      ↓
Regression Detection
      ↓
Generated Validation
```

This helps people understand **why Phase 3 cannot simply be shipped first**.

---

# 42. Roadmap graph

I would actually include one high-level dependency graph:

```text
Developer Demonstrations
          │
          ▼
Behavior Graphs
          │
          ├───────────────┐
          ▼               ▼
Coverage              Production Data
                          │
                          ▼
                   Workflow Health
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
            Regressions         Anomalies
                 │                 │
                 └────────┬────────┘
                          ▼
                Quality Intelligence
```

That tells Tellann's story more naturally than a plain checklist.

---

# 43. Recently shipped

Heading:

> **Recently shipped**

This bridges Roadmap and Changelog.

Cards:

```text
Developer Demonstration Mode
Shipped · Version ...

View changelog →
```

or:

```text
Improved Behavior Graph filters
Shipped Aug 2026

View release →
```

Only show real releases.

---

# 44. Roadmap vs changelog

Important distinction:

```text
ROADMAP
Where we're going.

CHANGELOG
What actually shipped.
```

Never overwrite roadmap history to make predictions look correct.

If something ships:

```text
PLANNED
   ↓
IN PROGRESS
   ↓
AVAILABLE
```

Then link its actual release note.

---

# 45. Recently shipped data

Could be automatically derived:

```text
RoadmapItem.status = AVAILABLE
+
changelogReleaseId exists
```

rather than manually duplicating content.

---

# 46. Section 12 — How Tellann prioritizes

Heading:

> **How we decide what comes next.**

I would define four factors.

### Product foundation

Does this strengthen Tellann's core behavioral model?

### Customer value

Does it solve a meaningful software-quality problem?

### Evidence maturity

Do we have sufficient behavior/data for the capability to work reliably?

### Trust

Can the capability be explainable, secure, privacy-preserving, and operationally reliable?

These are consistent with the product's phased philosophy and non-functional constraints.  

---

# 47. Scope discipline

You can make a strong statement:

> **We deliberately do not ship later-phase intelligence merely because it demos well.**

Then:

> Phase 1 exists to establish behavioral evidence. Phase 2 establishes production context. Phase 3 builds intelligence on top of both.

That reasoning is directly present in the PRD: Phase 3 only becomes realistic after Tellann has behavior data, production telemetry, state-transition graphs, and historical failures. 

This is excellent company positioning.

---

# 48. Section 13 — Roadmap feedback

I would include:

> **Is something important missing?**

Supporting:

> Tell us what problem you are trying to solve. We care more about the underlying need than feature voting.

Buttons:

```text
[ Share feedback ]
[ Contact us ]
```

Potential:

```text
/contact?reason=roadmap
```

or general product feedback workflow.

---

# 49. Avoid public vote counts initially

Don't turn Tellann's strategic roadmap into:

```text
SSO             482 votes
Dark mode       401 votes
Android SDK     335 votes
```

Popularity is useful input, but architecture and product sequencing matter.

A behavior-modeling company especially should not confuse votes with evidence.

---

# 50. Feedback form

Simple:

```text
What problem are you trying to solve? *

Which part of Tellann does it relate to?
[ SDK
  Behavioral QA
  Production
  Reporting
  Collaboration
  Enterprise
  Other ]

Tell us more *

Email
[ optional ]
```

---

# 51. Roadmap FAQ

Recommended questions.

### Are roadmap items guaranteed?

> No. Roadmap items represent current product direction and may change as Tellann learns from implementation and customer evidence.

### Why aren't there release dates?

> Because the roadmap communicates direction and status rather than publishing dates that are not yet sufficiently certain.

### Where can I see what actually shipped?

→ `/changelog`

### Is Phase 2 available today?

Answer according to actual deployment status.

Do not derive this blindly from specification phase numbers.

### Is autonomous testing available?

Currently, according to the formal MVP scope, autonomous testing belongs outside Phase 1 and should not be marketed as current MVP capability. 

### Can I request a capability?

→ Feedback.

### Are planned SDKs guaranteed?

No; describe roadmap status.

---

# 52. Phase labels on product pages

I would reuse roadmap status badges across the entire marketing website.

For instance, if a future product page mentions:

```text
Database Intelligence
```

show:

```text
PLANNED · PHASE 2
```

and link:

```text
View roadmap →
```

This prevents visitors from mistaking vision for current functionality.

---

# 53. Roadmap status source of truth

Do not determine status like:

```ts
if (feature.phase === 1) {
   status = "AVAILABLE";
}
```

That's wrong.

Use an explicit roadmap state.

```ts
{
  key: "BEHAVIOR_GRAPH",
  phase: "PHASE_1",
  status: "AVAILABLE"
}
```

Another Phase 1 feature could still be:

```ts
{
  key: "REPORT_EXPORT_HTML",
  phase: "PHASE_1",
  status: "IN_PROGRESS"
}
```

Phase and implementation status are different dimensions.

---

# 54. Feature entitlements are also different

Keep three concepts separate:

```text
ROADMAP PHASE
When in product evolution does this belong?

STATUS
Has it shipped?

PLAN ENTITLEMENT
Which customer plans can use it?
```

For example:

```text
Automated Instrumentation

Phase:
current desktop evolution / configured product layer

Status:
Available

Plans:
Solo+
```

Those must not be collapsed into one enum.

---

# 55. Internal roadmap data structure

I would model:

```ts
interface ProductCapability {
  key: string;

  name: string;
  description: string;

  phase:
    | "BEHAVIORAL_QA"
    | "PRODUCTION_INTELLIGENCE"
    | "AUTONOMOUS_VALIDATION";

  status:
    | "AVAILABLE"
    | "IN_PROGRESS"
    | "PLANNED"
    | "EXPLORING";

  category:
    | "CAPTURE"
    | "SESSIONS"
    | "BEHAVIOR"
    | "ANALYTICS"
    | "REPORTING"
    | "SDK"
    | "PLATFORM"
    | "ENTERPRISE"
    | "INTELLIGENCE";

  planEntitlements?: string[];

  dependencies?: string[];

  productUrl?: string;
  docsUrl?: string;
  changelogUrl?: string;

  public: boolean;

  lastUpdatedAt: string;
}
```

This could ultimately feed:

```text
/roadmap
/product pages
/pricing comparison
/changelog
feature badges
```

---

# 56. Don't expose engineering tasks

Internal roadmap:

```text
Implement ClickHouse distributed table
Upgrade Kafka
Refactor graph consumer
Fix worker queue
Add retry job
```

Public roadmap:

```text
Higher-volume behavioral processing

Faster Behavior Graph generation

More reliable replay processing
```

The customer cares about outcomes.

---

# 57. Security-sensitive roadmap items

Don't announce:

```text
We're currently vulnerable to X,
fix planned for Q4.
```

Security work belongs to internal planning and appropriate security communication.

Public items can be:

```text
Enterprise authentication
Advanced audit controls
Data residency
```

without exposing defensive gaps.

---

# 58. Visual design

The Roadmap should fit Tellann's monochrome technical identity.

Use:

```text
Black / near-black background
Fine borders
Large typography
Status glyphs
Graph lines
Timeline connectors
Minimal shadows
```

Avoid Trello-style colorful cards.

---

# 59. Phase visual differentiation

Because the brand is monochrome, differentiate with luminance and line style rather than rainbow colors.

Example:

```text
AVAILABLE
Bright / solid

IN PROGRESS
Bright outline

PLANNED
Muted

EXPLORING
Very muted / dotted outline
```

But always accompany the visual treatment with text.

---

# 60. Desktop layout

Conceptually:

```text
NAV
──────────────────────────────────

ROADMAP HERO

From observing behavior
to understanding quality.

Observe → Model → Monitor → Validate

──────────────────────────────────

CURRENT

Behavioral QA

[ capabilities ]

──────────────────────────────────

PHASE 1

Capture
Observe
Model
Analyze
Report

──────────────────────────────────

                ↓

PHASE 2

Production
Journeys
Workflow Health
Database
Error Correlation

──────────────────────────────────

                ↓

PHASE 3

Tests
Regressions
Simulation
Anomalies
Quality Intelligence

──────────────────────────────────

SDK EVOLUTION

Web → Server → Mobile

──────────────────────────────────

RECENTLY SHIPPED

──────────────────────────────────

HOW WE PRIORITIZE

──────────────────────────────────

FEEDBACK

──────────────────────────────────

FAQ

──────────────────────────────────

FOOTER
```

---

# 61. Mobile layout

Use a vertical timeline:

```text
NOW
│
● Behavioral QA
│
│ [feature]
│ [feature]
│
NEXT
│
○ Production Intelligence
│
│ [feature]
│ [feature]
│
FUTURE
│
◇ Autonomous Validation
│
│ [feature]
│
```

Much easier to understand than compressing three columns.

---

# 62. Expand/collapse

Mobile and potentially desktop:

```text
Behavioral QA        9 capabilities   −
Production           5 capabilities   +
Autonomous            6 capabilities   +
```

Useful for keeping the page manageable.

---

# 63. Deep linking

Every important section should have stable anchors:

```text
/roadmap#behavioral-qa
/roadmap#production-intelligence
/roadmap#autonomous-validation
/roadmap#sdk
/roadmap#shipped
```

Individual capabilities can have:

```text
/roadmap#workflow-health
```

or drawer state encoded as:

```text
/roadmap?item=workflow-health
```

---

# 64. SEO

Suggested title:

```text
Tellann Roadmap — Behavioral QA to Autonomous Validation
```

Meta:

```text
Explore the Tellann product roadmap, from behavioral QA and workflow intelligence to production monitoring, release validation, and future autonomous quality intelligence.
```

Canonical:

```text
https://tellann.co/roadmap
```

---

# 65. Be careful with future SEO claims

If page title says:

```text
AI Automated Testing Software | Tellann
```

while that capability is Phase 3, you've undone all the careful roadmap labeling.

Search snippets can misrepresent the product too.

Keep roadmap metadata explicitly directional.

---

# 66. Analytics

Track:

```text
ROADMAP_PAGE_VIEWED

ROADMAP_PHASE_VIEWED
ROADMAP_ITEM_OPENED

ROADMAP_FILTER_CHANGED

ROADMAP_PRODUCT_CLICKED
ROADMAP_DOCS_CLICKED
ROADMAP_CHANGELOG_CLICKED

ROADMAP_FEEDBACK_STARTED
ROADMAP_FEEDBACK_SUBMITTED
```

Useful metadata:

```text
phase
capability
status
category
```

---

# 67. Roadmap update timestamps

Show:

```text
Roadmap updated
August 2026
```

or:

```text
Last updated 29 Aug 2026
```

only if you actually keep it updated.

A roadmap last updated 14 months ago is a negative trust signal.

If updates are automated from your capability system, even better.

---

# 68. Optional update subscription

Later:

```text
Want roadmap updates?

[ Follow the changelog ]
```

I would prefer Changelog subscription over a dedicated Roadmap newsletter.

One source of product update communication is cleaner.

---

# 69. Component architecture

```text
RoadmapPage
│
├── MarketingNavbar
├── RoadmapHero
├── RoadmapStatusLegend
├── CurrentProductSection
├── RoadmapNavigation
├── PhaseSection
│   └── CapabilityGroup
│       └── RoadmapCard[]
├── SDKRoadmap
├── EnterpriseRoadmap
├── RecentlyShipped
├── PrioritizationSection
├── RoadmapFeedback
├── RoadmapFAQ
├── FinalCTA
└── MarketingFooter
```

---

# 70. What I would implement now

For the first version:

```text
✓ Hero
✓ Current product summary
✓ Status definitions

✓ Phase 1 section
✓ Phase 2 section
✓ Phase 3 section

✓ Capability cards
✓ Phase/status labels

✓ SDK evolution
✓ Dependency visualization

✓ Recently shipped section
✓ Changelog linking

✓ Product prioritization principles

✓ Roadmap feedback
✓ FAQ
✓ Last-updated indicator
✓ Footer
```

Delay until roadmap size warrants them:

```text
Search
Complex filtering
Voting
Dedicated capability pages
User accounts/following
Quarterly timeline visualization
```

---

# 71. The page's core story

At its simplest, `/roadmap` should communicate:

```text
TODAY

Tellann watches
what you demonstrate.

        ↓

It reconstructs
how the application behaves.

        ↓

It discovers workflows,
coverage and gaps.


NEXT

Tellann observes
real production behavior.

        ↓

It understands workflow health,
journeys and failures.


FUTURE

Tellann compares behavior
across time and releases.

        ↓

It generates validation,
detects regressions,
simulates failures
and explains quality risk.
```

The important thing is that `/roadmap` makes Tellann look **ambitious without becoming dishonest**. Phase 1 should be concrete. Phase 2 should be directional. Phase 3 should feel like the logical consequence of accumulating behavioral evidence—not a collection of AI promises attached to an immature product.  
