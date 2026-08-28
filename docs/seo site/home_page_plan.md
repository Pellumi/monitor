For `/`, I would treat the homepage as Tellann’s **primary conversion and category-definition page**.

Its job is not to explain every feature in depth. Its job is to make a technical visitor understand, within roughly one scroll:

**What Tellann is → what problem it solves → how it works → what they receive → why they should trust it → what they should do next.**

The homepage should stay strictly aligned with the current MVP: developer demonstration, behavioral graph generation, workflow discovery, coverage analysis, missing states/flows, session replay, endpoint intelligence, and QA reporting. It should not present production intelligence or autonomous QA as generally available today. 

# `/` — Homepage Implementation Specification

## 1. Primary objective

The homepage should drive one of three actions:

```text
Primary:
Start Free

Secondary:
See How It Works

Tertiary:
View Documentation
```

For larger organizations, introduce:

```text
Book a Demo
```

but it should not compete visually with `Start Free` for developer traffic.

The intended conversion path is:

```text
Visitor lands on /
        ↓
Understands Tellann
        ↓
Sees product proof
        ↓
Understands workflow
        ↓
Recognizes relevant problem
        ↓
Explores feature/use case
        ↓
Start Free
        ↓
app.tellann.co/signup
```

---

# 2. Page structure

I would build the homepage in this order:

```text
/
│
├── 01 Announcement Bar
├── 02 Navigation
├── 03 Hero
├── 04 Interactive Product Preview
├── 05 Trust / Positioning Strip
├── 06 Problem Statement
├── 07 How Tellann Works
├── 08 Behavior Graph Showcase
├── 09 Coverage & Missing Intelligence
├── 10 Session Replay Showcase
├── 11 Endpoint Intelligence
├── 12 QA Report Output
├── 13 Persona / Use Cases
├── 14 Privacy & Security
├── 15 Developer Experience
├── 16 Pricing Teaser
├── 17 Resources / Learning
├── 18 Final CTA
└── 19 Footer
```

That is the complete story of the homepage.

---

# 3. Section 01 — Announcement bar

This is optional, but useful once Tellann starts shipping publicly.

Example:

```text
Tellann is now available for React and Node.js applications →
```

Or:

```text
Introducing Developer Demonstration Mode →
```

Click destination:

```text
/product/demonstration-mode
```

Do not permanently place meaningless copy such as:

> "The future of AI testing is here."

That contradicts your Phase 1 positioning. The MVP specifically avoids marketing Tellann as an AI/autonomous testing platform. 

### Behavior

Desktop:

```text
Full-width, 32–40px height
Centered text
Dismissible optionally
```

Mobile:

```text
1–2 lines maximum
```

---

# 4. Section 02 — Navigation

## Desktop

```text
┌────────────────────────────────────────────────────────────┐
│ Tellann   Product   Solutions   Developers   Resources     │
│                                 Pricing                    │
│                                              Sign in       │
│                                    Book demo   Start free  │
└────────────────────────────────────────────────────────────┘
```

### Logo

Click:

```text
/
```

### Product

Mega-menu:

```text
Product Overview
How Tellann Works
Developer Demonstration

Understand Behavior
├── Behavior Graphs
├── Workflow Discovery
└── Session Replay

Analyze Quality
├── Coverage
├── Missing Flows
├── Missing States
└── Endpoint Intelligence

Communicate
└── QA Reports
```

### Solutions

```text
Developers
QA Engineers
Engineering Leaders
Startups
```

### Developers

```text
Developer Hub
Quickstart
Documentation
SDKs
API Reference
```

### Resources

```text
Blog
Guides
Changelog
Glossary
Roadmap
```

### Right-side actions

```text
Sign in
Book demo
Start free
```

`Start free` should be the highest-emphasis button.

---

# 5. Section 03 — Hero

This is the most important section.

The page should immediately establish the category.

## Eyebrow

Something restrained:

```text
BEHAVIORAL QUALITY INTELLIGENCE
```

Not:

```text
AI REVOLUTION
```

---

## H1

Recommended:

> **Understand how your software actually behaves.**

Alternative:

> **Turn application behavior into QA intelligence.**

I prefer the first because it describes Tellann's deeper product thesis rather than a particular implementation detail.

Your PRD defines the long-term vision around applications observing and explaining their own quality, while the current MVP begins by converting observed developer demonstrations into quality insights. 

---

## Supporting copy

Something like:

> Connect Tellann, demonstrate your application, and automatically map its workflows, measure coverage, uncover missing states and flows, replay sessions, and inspect API behavior.

Every item here exists in the defined MVP scope. 

---

## CTAs

```text
[ Start free ]    [ See how it works ]
```

Below:

```text
No production traffic required.
Start from a single demonstration session.
```

That is an important differentiator because Developer Demonstration Mode is explicitly designed to provide useful intelligence without production traffic or historical telemetry. 

---

# 6. Hero visual

Do not use a generic abstract AI animation.

Show the actual product concept.

I would have the visual transition between three states.

### Frame A

Developer application:

```text
Storefront

[Product]
    ↓
[Add to cart]
    ↓
[Checkout]
```

### Frame B

Tellann observes:

```text
PAGE_VISIT
BUTTON_CLICK
STATE_TRANSITION
API_REQUEST
API_RESPONSE
```

### Frame C

Tellann understands:

```text
PRODUCT_VIEW
     │
     ▼
CART_ACTIVE
     │
     ▼
CHECKOUT
  ↙       ↘
FAILED   SUCCESS
```

With a side panel:

```text
Checkout Coverage
72%

Missing
• Payment failure
• Empty cart
• Session timeout
```

The event examples and behavioral transformation are consistent with the Event Taxonomy and Behavior Graph Specification.  

---

# 7. Hero credibility line

Below the visual:

```text
Observe → Model → Analyze → Understand
```

Or:

```text
Application behavior becomes quality evidence.
```

That reinforces Tellann's product philosophy without overexplaining.

---

# 8. Section 04 — Interactive product preview

Immediately after the hero, let visitors see Tellann in action.

Heading:

> **Demonstrate once. See what you missed.**

Subheading:

> Tellann turns a developer walkthrough into a structured model of application behavior.

The Developer Demonstration specification explicitly describes this process as:

```text
Developer Demonstrates Application
        ↓
SOTS Observes Behavior
        ↓
Builds Workflow Model
        ↓
Identifies Coverage
        ↓
Identifies Missing Paths
        ↓
Generates QA Intelligence
```



---

## Interactive tabs

```text
[ Demonstrate ] [ Observe ] [ Understand ] [ Report ]
```

### Demonstrate

Animation:

```text
Register
Login
Browse
Cart
Checkout
```

### Observe

Show event stream.

### Understand

Show behavior graph.

### Report

Show:

```text
Workflow Coverage: 72%

Missing states: 5
Missing flows: 4
Slow endpoints: 2
```

This section should feel like a compressed product demo.

---

# 9. Section 05 — Positioning / trust strip

Because Tellann is creating a somewhat unfamiliar category, help visitors understand where it sits.

Heading:

> **Testing tells you what you planned. Monitoring tells you what broke. Tellann models what your software actually did.**

Then three columns:

```text
Testing
"What did we test?"

Monitoring
"What failed?"

Analytics
"What did users do?"

Tellann
"How is the software behaving?"
```

This comes directly from the product philosophy: traditional QA, monitoring, and analytics answer separate questions, while Tellann sits at their intersection. 

Do not claim those other disciplines are obsolete.

Tellann complements them.

---

# 10. Section 06 — Problem statement

Heading:

> **Software quality hides between the test cases.**

Then four problem cards.

## Card 1 — Missing paths

```text
The happy path passes.
The failure path was never demonstrated.
```

Examples:

```text
Payment Failure
Session Timeout
Out of Stock
Password Reset
```

---

## Card 2 — Missing states

```text
Your workflow exists.
Its edge states do not.
```

Examples:

```text
Loading
Empty
Error
Recovery
404
```

---

## Card 3 — Unknown workflow coverage

```text
You know code coverage.
But not what percentage of real application behavior you actually validated.
```

---

## Card 4 — Expensive investigation

```text
A failure happens.
Your team reconstructs the journey manually.
```

The PRD specifically identifies late issue discovery, lack of workflow context, difficulty reproducing bugs, and limited visibility into user behavior as core problem areas. 

---

# 11. Section 07 — How Tellann works

Heading:

> **From walkthrough to quality intelligence.**

Use a horizontal four-step process on desktop.

```text
01 Connect
      ↓
02 Demonstrate
      ↓
03 Tellann models behavior
      ↓
04 Review quality insights
```

---

## 01 Connect

```text
Create an application.
Install the Tellann SDK.
Configure your application key.
```

Support currently defined for the SDK ecosystem includes React, Next.js, Node.js, Express, NestJS and Fastify. 

---

## 02 Demonstrate

```text
Start a demonstration session.

Use your application normally:

Register
Login
Search
Checkout
Settings
...
```

The platform supports guided, exploratory, and validation demonstrations. 

---

## 03 Tellann models behavior

Visual:

```text
Events
 ↓
Sessions
 ↓
States
 ↓
Transitions
 ↓
Workflows
 ↓
Behavior Graph
```

This is the defined behavioral graph construction process. 

---

## 04 Review intelligence

```text
Coverage
Missing Flows
Missing States
Session Replay
Endpoint Analysis
QA Reports
```

CTA:

```text
Explore how Tellann works →
```

Destination:

```text
/product/how-it-works
```

---

# 12. Section 08 — Behavior Graph showcase

This is one of the largest homepage sections.

Heading:

> **See your application as a living behavior graph.**

Supporting:

> Tellann converts observed states, actions, transitions and workflows into a visual map of how your application behaves.

The Behavior Graph is the central behavioral representation in Tellann. 

---

## Main visual

Large graph:

```text
                    ┌──────────────┐
                    │  LOGIN FAIL  │
                    └──────▲───────┘
                           │
LANDING → REGISTER → AUTHENTICATED
                          │
                          ▼
                      PRODUCTS
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
            SEARCH                  CART
                                      │
                                      ▼
                                  CHECKOUT
                                ↙          ↘
                         PAYMENT_FAIL   ORDER_COMPLETE
```

Nodes should show hover data such as:

```text
CHECKOUT

Sessions: 124
Transitions: 347
Average duration: 38s
Observed paths: 7
```

Tellann's Behavior Graph specification provides state, transition, and workflow metrics that can support this style of presentation. 

CTA:

```text
Explore Behavior Graphs →
```

---

# 13. Section 09 — Coverage analysis

Heading:

> **Know what you covered—and what you didn't.**

Left side:

```text
Checkout Workflow

Coverage
72%

Observed Paths
18

Missing Paths
7
```

Right side:

```text
✓ Add item
✓ Checkout
✓ Payment success

○ Payment failure
○ Session timeout
○ Inventory changed
○ Gateway failure
```

Coverage in the product includes workflow, state, transition, endpoint, and error coverage. 

---

## Secondary metric strip

```text
Workflow Coverage      72%
State Coverage         81%
Transition Coverage    67%
Endpoint Coverage      91%
Error Coverage         38%
```

This makes Tellann feel concrete rather than abstract.

CTA:

```text
Learn about coverage →
```

---

# 14. Section 10 — Missing states and flows

I would split the section visually into two halves.

Heading:

> **Find the parts of the experience nobody showed you.**

### Missing states

```text
EMPTY_CART
LOADING_PRODUCTS
NO_RESULTS
404_PAGE
AUTHENTICATION_ERROR
```

### Missing flows

```text
PAYMENT_FAILURE
RETRY_PAYMENT
PASSWORD_RESET
SESSION_EXPIRATION
OUT_OF_STOCK
```

The MVP explicitly includes identification of missing loading, empty, error, and recovery states along with failure, alternative, recovery and edge-case flows. 

Each result card can show:

```text
Missing State

EMPTY_CART

Not observed in any demonstration session.

Severity
Medium

Related workflow
Checkout
```

Do not yet claim AI generated this.

Phase 1 detection is grounded in the defined rules/analysis model rather than autonomous intelligence. 

---

# 15. Section 11 — Session Replay

Heading:

> **Replay the behavior, not just the screen.**

This wording matters.

Tellann's replay model is explicitly a behavioral reconstruction based on events, rather than fundamentally a raw screen recording. 

---

## Product mockup

```text
Session SES-2314

▶  01:24 / 04:51       2x

Timeline

00:00 SESSION_STARTED
00:04 PAGE_VISIT          /
00:11 BUTTON_CLICK        register
00:22 FORM_SUBMITTED      registration
00:23 API_REQUEST         POST /users
00:24 API_RESPONSE        201
00:25 STATE_ENTERED       REGISTERED
00:37 PAGE_VISIT          /login
```

Side panel:

```text
Workflows
Registration ✓
Login ✓
Checkout ✕

Errors
1

API calls
14
```

CTA:

```text
Explore Session Replay →
```

---

# 16. Section 12 — Endpoint Intelligence

Heading:

> **Connect frontend behavior to backend performance.**

Visual table:

| Endpoint        | Requests | Avg. latency | Error rate |
| --------------- | -------: | -----------: | ---------: |
| `GET /products` |    2,184 |       122 ms |       0.2% |
| `POST /cart`    |      642 |       214 ms |       0.5% |
| `POST /payment` |      218 |       681 ms |       3.8% |
| `GET /search`   |    1,427 |       942 ms |       1.1% |

Below:

```text
Slow endpoint
GET /search

Error-prone endpoint
POST /payment
```

Phase 1 endpoint analysis includes latency, request volume, error rate, endpoint rankings and optimization suggestions. 

CTA:

```text
Explore Endpoint Intelligence →
```

---

# 17. Section 13 — QA report output

Heading:

> **Turn observed behavior into something your team can act on.**

Use a large report mockup.

```text
Application Quality Report

Application
Commerce Demo

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

Critical Findings
2
```

Then preview report categories.

```text
Executive Quality Report
Flow Coverage Report
Behavioral Graph Report
Missing Flow Report
Missing State Report
Session Analysis Report
Endpoint Intelligence Report
```

Those are the currently specified Phase 1 report types. 

Supported exports:

```text
PDF
CSV
JSON
HTML
```

according to the reporting specification. 

CTA:

```text
Explore QA Reports →
```

---

# 18. Section 14 — Who Tellann is for

Heading:

> **Built for teams responsible for software quality.**

Four cards.

## Developers

> Understand workflows, inspect sessions and find behavior you never accounted for.

CTA:

```text
Tellann for Developers →
```

---

## QA Engineers

> Measure workflow coverage and surface missing states, flows and failure scenarios.

---

## Engineering Leaders

> Gain a clearer view of what your team has actually demonstrated and validated.

---

## Startup Teams

> Build stronger QA visibility without first building a large QA operation.

These audiences are consistent with the PRD and MVP target-user definitions.  

---

# 19. Section 15 — Security and privacy

This should appear on the homepage because Tellann captures application telemetry.

Heading:

> **Observe behavior without collecting what you shouldn't.**

Then three levels.

### Tellann observes

```text
Routes
Clicks
State transitions
Workflow events
API metadata
Latency
Errors
```

### Tellann masks

```text
Emails
Names
User identifiers
IP addresses
Phone numbers
```

### Tellann excludes

```text
Passwords
Payment card details
CVVs
JWTs
Access tokens
API secrets
Private keys
```

The privacy specification requires privacy filtering, masking/redaction, and exclusion of restricted data before sensitive information enters Tellann's analytics pipeline. 

Add trust statements:

```text
Privacy filtering before transmission
Tenant isolation
Encryption in transit
Encryption at rest
Role-based access control
```

These controls are part of the security architecture. 

CTA:

```text
Read about Tellann Security →
```

---

# 20. Section 16 — Developer experience

This should look like an engineering product, not purely a business SaaS.

Heading:

> **A few lines to start observing behavior.**

Example UI:

```bash
npm install @tellann/react
```

Then conceptual initialization:

```ts
Tellann.initialize({
  applicationId: "...",
  apiKey: "...",
  environment: "development"
});
```

The underlying SDK specification currently defines initialization around an API key, application identifier and environment. 

Below:

```text
React
Next.js
Node.js
Express
NestJS
Fastify
```

Then:

```text
[ Read Quickstart ] [ View Documentation ]
```

---

# 21. Small architecture explainer

Under the developer section:

```text
Your Application
      ↓
Tellann SDK
      ↓
Behavior Events
      ↓
Session
      ↓
Behavior Graph
      ↓
Quality Analysis
```

Keep Kafka, ClickHouse, internal processing engines, etc. off the main homepage.

Those details belong in documentation/architecture pages.

---

# 22. Section 17 — Pricing teaser

Do not reproduce the entire pricing matrix on `/`.

Heading:

> **Start with one application. Scale when you need to.**

Three visible cards:

```text
FREE
$0

1 application
1 user
14-day retention
Core Tellann workflow

[ Start free ]


SOLO
$29 / month

3 applications
3 users
90-day retention
Advanced reports

[ View plan ]


TEAM
$99 / month

10 applications
10 users
180-day retention
Collaboration + RBAC

[ View plan ]
```

Then:

```text
Business and Enterprise plans available.
```

CTA:

```text
Compare all plans →
```

The existing packaging specification defines Free, Solo, Team, Business and Enterprise with these initial pricing levels. 

---

# 23. Section 18 — Resource / SEO content

Heading:

> **Learn about behavioral quality.**

Show three current articles/guides.

For example:

```text
What is behavioral testing?

Workflow coverage vs code coverage

How to identify missing user flows
```

And:

```text
View all resources →
```

This section is important for two reasons:

1. internal linking;
2. demonstrating thought leadership around the category Tellann is trying to establish.

---

# 24. Section 19 — Vision / roadmap teaser

I would add a restrained section near the bottom.

Heading:

> **Behavior is only the beginning.**

Then:

```text
Now
Behavioral QA

Next
Production Intelligence

Future
Autonomous Validation
```

Do not represent the latter two as current product functionality.

Something like:

> Tellann begins by understanding demonstrated application behavior. Over time, that behavioral foundation can support production intelligence, release comparison and autonomous validation.

This preserves the product roadmap without violating the MVP positioning.  

CTA:

```text
View roadmap →
```

---

# 25. Section 20 — Final CTA

The final CTA should be extremely simple.

Large headline:

> **Show Tellann how your application works.**

Supporting copy:

> Start with a demonstration session and turn what happened into workflows, coverage and QA insight.

Buttons:

```text
[ Start free ]    [ Read the quickstart ]
```

Small line:

```text
No production traffic required.
```

---

# 26. Footer

I would use a six-column footer.

### Product

```text
Overview
How It Works
Demonstration Mode
Behavior Graphs
Coverage
Missing Flows
Missing States
Session Replay
Endpoint Intelligence
QA Reports
```

### Solutions

```text
Developers
QA Engineers
Engineering Leaders
Startups
SaaS Teams
```

### Developers

```text
Documentation
Quickstart
React
Next.js
Node.js
API Reference
Status
```

### Resources

```text
Blog
Guides
Glossary
Changelog
Roadmap
```

### Company

```text
About
Contact
Careers
Brand
```

### Trust

```text
Security
Privacy
Terms
Cookies
DPA
Subprocessors
```

Bottom:

```text
© 2026 Tellann

GitHub
X
LinkedIn
```

---

# 27. Desktop page hierarchy

Visually, I would make the homepage rhythm look roughly like this:

```text
NAV
────────────────────────────────

                 HERO
        large typography
     substantial whitespace
            product UI

────────────────────────────────

          PRODUCT DEMO

────────────────────────────────

       TEST / MONITOR / TELLANN

────────────────────────────────

          PROBLEM CARDS

────────────────────────────────

        HOW TELLANN WORKS

────────────────────────────────

         BEHAVIOR GRAPH
          huge visual

────────────────────────────────

    COVERAGE + MISSING PATHS

────────────────────────────────

          SESSION REPLAY

────────────────────────────────

       ENDPOINT INTELLIGENCE

────────────────────────────────

           QA REPORTS

────────────────────────────────

           WHO IT'S FOR

────────────────────────────────

         SECURITY / PRIVACY

────────────────────────────────

       DEVELOPER QUICKSTART

────────────────────────────────

             PRICING

────────────────────────────────

            RESOURCES

────────────────────────────────

          PRODUCT VISION

────────────────────────────────

             CTA

────────────────────────────────

            FOOTER
```

There should be substantial breathing room. Tellann's monochrome branding lends itself well to this.

---

# 28. Mobile implementation

Do not simply squash the desktop version.

For mobile:

### Navbar

```text
Tellann                         ☰
```

Sticky.

---

### Hero

```text
BEHAVIORAL QUALITY INTELLIGENCE

Understand how your
software actually behaves.

Supporting copy

[ Start free ]

[ See how it works ]

Product animation
```

---

### Feature sections

Change two-column layouts into:

```text
Heading
Description
Visual
Metrics
CTA
```

not:

```text
tiny visual beside tiny copy
```

---

### Graph

Provide:

```text
Pan
Zoom
Reset
```

Or render a simplified graph snapshot.

Do not expect users to manipulate a huge graph on a 390px screen.

---

# 29. Homepage state behavior

Several sections should have interactive states.

## Behavior graph

```text
Default
Hovered node
Selected node
Loading
No graph
Error
```

## Replay

```text
Playing
Paused
Seeking
Selected event
```

## Product demonstration

```text
Demo
Observe
Graph
Report
```

## Navigation

```text
Default
Scrolled
Mega-menu open
Mobile menu open
```

---

# 30. Navigation behavior

At page top:

```text
transparent / page background
```

After scroll:

```text
sticky navbar
subtle border
slight background opacity
```

Avoid a giant floating pill navbar if it conflicts with the rest of Tellann's identity.

---

# 31. Homepage SEO metadata

Suggested:

### Title

```text
Tellann — Behavioral Quality Intelligence for Software Teams
```

### Meta description

```text
Tellann observes application behavior, discovers workflows, measures coverage, identifies missing states and flows, replays sessions, and generates QA intelligence.
```

### Canonical

```text
https://tellann.co/
```

---

# 32. Structured data

Implement:

```text
Organization
SoftwareApplication
WebSite
```

Potentially later:

```text
FAQPage
```

only if an actual FAQ section is present.

---

# 33. H-tag hierarchy

Do not abuse headings for visual styling.

Example:

```text
H1
Understand how your software actually behaves.

H2
Demonstrate once. See what you missed.

H2
Software quality hides between the test cases.

H2
From walkthrough to quality intelligence.

H2
See your application as a behavior graph.

H2
Know what you covered—and what you didn't.

H2
Find the states and flows you missed.

H2
Replay behavior, not just the screen.

H2
Connect frontend behavior to backend performance.

H2
Turn behavior into actionable QA reports.

H2
Built for teams responsible for software quality.

H2
Observe behavior without collecting what you shouldn't.

H2
A few lines to start observing behavior.
```

---

# 34. Analytics events

Ironically, Tellann's own marketing page should be exceptionally measurable.

Track things like:

```text
HOME_VIEWED

HERO_START_FREE_CLICKED
HERO_HOW_IT_WORKS_CLICKED

PRODUCT_DEMO_STARTED
PRODUCT_DEMO_TAB_CHANGED

BEHAVIOR_GRAPH_INTERACTED

COVERAGE_SECTION_VIEWED

SESSION_REPLAY_PLAYED

SDK_COPY_CLICKED
DOCS_CLICKED

PRICING_VIEWED
PLAN_CLICKED

SECURITY_CLICKED

FINAL_CTA_CLICKED
```

Then measure:

```text
Hero → Signup conversion

Product demo → Signup conversion

Developer docs → Signup conversion

Pricing → Signup conversion

Security → Enterprise demo conversion
```

---

# 35. Performance requirements

Your own NFR target says dashboard pages should load within three seconds, while SDK overhead should remain low; the marketing website should be even stricter where possible. 

For `/`, target approximately:

```text
LCP       < 2.5s
CLS       < 0.1
INP       < 200ms

Initial JS
Keep aggressively low

Images
AVIF / WebP

Videos
Lazy load
Poster frame first

Product demos
Load when near viewport
```

Do not ship a 15 MB hero WebGL animation because the brand is technical.

---

# 36. Accessibility

Implement at minimum:

```text
Keyboard accessible navigation

Visible focus states

Reduced-motion alternative

Semantic headings

ARIA labels where necessary

Alt text

Color contrast compliant

No information communicated by color alone

Graph fallback for screen readers
```

For the graph, provide an accessible textual equivalent:

```text
Checkout workflow:

Product View
→ Cart
→ Checkout
→ Payment Success

Missing:
Payment Failure
Session Timeout
```

---

# 37. Loading and failure behavior

Product mockups should not break the entire page if an interactive demo fails.

For example:

```text
<BehaviorGraphDemo />
```

should support:

```text
loading → skeleton
error   → static screenshot
ready   → interactive graph
```

Likewise for replay.

The homepage should remain fully understandable without JavaScript-heavy product demonstrations.

---

# 38. Reusable components

From an implementation perspective, I would break `/` into something like:

```text
HomePage
│
├── AnnouncementBar
├── MarketingNavbar
├── HeroSection
│   ├── HeroCopy
│   └── ProductHeroDemo
│
├── ProductPreview
│   └── ProductPreviewTabs
│
├── PositioningStrip
├── ProblemSection
│   └── ProblemCard[]
│
├── HowItWorksSection
│   └── StepCard[]
│
├── BehaviorGraphSection
│   └── BehaviorGraphDemo
│
├── CoverageSection
│   ├── CoverageChart
│   └── MissingPathsList
│
├── MissingIntelligenceSection
│   ├── MissingStates
│   └── MissingFlows
│
├── SessionReplaySection
│   └── ReplayDemo
│
├── EndpointSection
│   └── EndpointTable
│
├── ReportsSection
│   └── ReportPreview
│
├── PersonaSection
│   └── PersonaCard[]
│
├── SecuritySection
├── DeveloperSection
│   └── CodeExample
│
├── PricingPreview
├── ResourcesSection
├── RoadmapTeaser
├── FinalCTA
└── MarketingFooter
```

That structure gives you reusable components for the deeper product pages later.

---

# 39. Suggested frontend route file

If this is Next.js App Router:

```text
app/
├── page.tsx
│
├── product/
├── solutions/
├── developers/
├── pricing/
├── security/
├── resources/
└── ...
```

With the homepage:

```text
app/page.tsx
```

mostly composing reusable marketing components rather than containing 1,500 lines of JSX.

For example:

```text
components/
└── marketing/
    ├── navigation/
    ├── hero/
    ├── product-demo/
    ├── behavior-graph/
    ├── coverage/
    ├── replay/
    ├── reports/
    ├── pricing/
    └── footer/
```

---

# 40. The core homepage narrative

If every animation, decorative effect and extra paragraph disappeared, `/` should still communicate this sequence:

```text
Tellann understands software behavior.
                ↓
Connect your application.
                ↓
Demonstrate how it works.
                ↓
Tellann observes events.
                ↓
Events become sessions.
                ↓
Sessions become states and transitions.
                ↓
States and transitions become workflows.
                ↓
Workflows become a Behavior Graph.
                ↓
Tellann measures coverage.
                ↓
Tellann identifies missing states and flows.
                ↓
You inspect replays and endpoint behavior.
                ↓
Tellann generates QA reports.
                ↓
Your team understands what it actually validated.
```

That is the homepage.

It does not need to shout about AI. It does not need to pretend to replace Sentry, Datadog or QA engineers. The product's strongest story is already unusual enough: **show Tellann how your application behaves, and it turns that behavior into structured quality evidence.**   
