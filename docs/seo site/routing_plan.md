Yes. Based on the product documents, I would structure **tellann.co** as a developer-first marketing website whose job is to move someone through:

**Problem → Understanding → Proof → Trust → Pricing → Adoption**

That aligns with Tellann's MVP positioning: *demonstrate an application, observe its behavior, generate behavioral graphs, identify missing flows/states, measure coverage, inspect endpoints, and generate QA reports.*  

One important constraint: the public site should **not presently market Tellann as autonomous QA, AI testing, AI observability, self-healing software, or autonomous validation**. Those belong to later phases. 

# 1. Overall Tellann web ecosystem

I would actually divide Tellann into four web properties:

```text
tellann.co
│
├── Marketing website
│
│
├── app.tellann.co
│   └── Tellann application/dashboard
│
├── docs.tellann.co
│   └── Developer documentation
│
└── status.tellann.co
    └── Platform/service status
```

Potentially later:

```text
changelog.tellann.co
community.tellann.co
```

The important distinction is:

```text
tellann.co
= Sell / explain Tellann

app.tellann.co
= Use Tellann

docs.tellann.co
= Integrate Tellann
```

---

# 2. Recommended main navigation

Your desktop navigation could be:

```text
[Tellann Logo]

Product
Solutions
Developers
Resources
Pricing
Company

                     Sign in
                     Book demo
                     [Start free]
```

On mobile, these collapse into the menu.

I would **not** put 10–12 links directly in the navbar. Product and Resources should be mega menus.

---

# 3. Complete route structure

> **Implemented.** This tree is the live contract, held in
> `apps/marketing/src/config/site-routes.ts`. Every route below exists today —
> either as a real page or as a `planned` stub rendered by the `[...slug]`
> catch-all. See section 47 for how status is tracked and how to promote a stub.
>
> Legend: `*` = page built · everything else = stub awaiting content.

```text
/                                          *
│
├── /product                               *
│   ├── /product/how-it-works              *
│   ├── /product/demonstration-mode        *
│   │
│   ├── Declare & verify
│   │   ├── /product/flow-declaration
│   │   ├── /product/reconciliation
│   │   ├── /product/graph-drift
│   │   ├── /product/automated-instrumentation
│   │   ├── /product/document-flow-inference
│   │   └── /product/guided-qa-runs
│   │
│   ├── Understand behavior
│   │   ├── /product/behavior-graphs       *
│   │   ├── /product/workflow-discovery    *
│   │   └── /product/session-replay        *
│   │
│   ├── Analyze & report
│   │   ├── /product/coverage              *
│   │   ├── /product/missing-flows         *
│   │   ├── /product/missing-states        *
│   │   ├── /product/endpoint-intelligence *
│   │   └── /product/qa-reports
│   │
│   └── Operate
│       ├── /product/environments
│       ├── /product/team-access
│       ├── /product/audit-logs
│       ├── /product/notifications
│       ├── /product/integrations
│       └── /product/data-retention
│
├── /desktop                               *
│   ├── /desktop/download                  *
│   ├── /desktop/releases                  *
│   │   └── /desktop/releases/[version]    *
│   ├── /desktop/security                  *
│   ├── /desktop/requirements              *
│   ├── /desktop/windows
│   ├── /desktop/troubleshooting
│   └── /desktop/updates
│
├── /solutions
│   ├── /solutions/developers
│   ├── /solutions/qa-engineers
│   ├── /solutions/engineering-leaders
│   ├── /solutions/product-teams
│   ├── /solutions/startups
│   ├── /solutions/saas
│   ├── /solutions/enterprise
│   └── /solutions/agencies
│
├── /use-cases
│   ├── /use-cases/workflow-coverage
│   ├── /use-cases/find-missing-flows
│   ├── /use-cases/find-missing-states
│   ├── /use-cases/application-walkthrough
│   ├── /use-cases/api-performance-analysis
│   ├── /use-cases/qa-planning
│   ├── /use-cases/debug-user-workflows
│   ├── /use-cases/regression-detection
│   ├── /use-cases/release-readiness
│   ├── /use-cases/legacy-application-mapping
│   ├── /use-cases/documenting-user-journeys
│   └── /use-cases/onboarding-engineers
│
├── /developers
│   ├── /developers/quickstart
│   ├── /developers/sdk
│   ├── /developers/api
│   ├── /developers/examples
│   │
│   ├── Frameworks
│   │   ├── /developers/react
│   │   ├── /developers/nextjs
│   │   ├── /developers/nodejs
│   │   ├── /developers/express
│   │   ├── /developers/fastify
│   │   └── /developers/nestjs          ← no adapter ships yet; see §48
│   │
│   └── Platform
│       ├── /developers/events
│       ├── /developers/webhooks
│       └── /developers/self-hosting
│
├── /docs → docs.tellann.co              * (redirect, next.config.ts)
│
├── /pricing                               *
│
├── /security                              *
│   ├── /security/privacy
│   ├── /security/data-collection
│   ├── /security/session-replay
│   ├── /security/enterprise
│   ├── /security/architecture
│   ├── /security/authentication
│   ├── /security/access-control
│   ├── /security/audit-logging
│   ├── /security/responsible-disclosure
│   └── /security/compliance
│
├── /resources
│   ├── /blog
│   │   ├── /blog/behavioral-testing
│   │   ├── /blog/software-quality
│   │   ├── /blog/qa-engineering
│   │   ├── /blog/session-replay
│   │   ├── /blog/application-observability
│   │   ├── /blog/testing-strategy
│   │   └── /blog/release-quality
│   ├── /guides
│   ├── /case-studies
│   ├── /research
│   ├── /glossary
│   │   ├── /glossary/behavior-graph
│   │   ├── /glossary/workflow-coverage
│   │   ├── /glossary/session-replay
│   │   ├── /glossary/application-state
│   │   ├── /glossary/state-transition
│   │   ├── /glossary/user-workflow
│   │   ├── /glossary/behavioral-testing
│   │   ├── /glossary/qa-coverage
│   │   ├── /glossary/declared-flow
│   │   ├── /glossary/reconciliation
│   │   ├── /glossary/missing-flow
│   │   ├── /glossary/missing-state
│   │   ├── /glossary/graph-drift
│   │   ├── /glossary/demonstration-mode
│   │   └── /glossary/endpoint-intelligence
│   ├── /templates
│   ├── /changelog
│   └── /faq
│
├── /compare
│   ├── /compare/sentry
│   ├── /compare/posthog
│   ├── /compare/datadog
│   ├── /compare/new-relic
│   ├── /compare/replay
│   ├── /compare/playwright
│   ├── /compare/cypress
│   ├── /compare/logrocket
│   ├── /compare/fullstory
│   └── /compare/mabl
│
├── /company                               *
│   ├── /about → /company                  * (redirect)
│   ├── /careers                           *
│   ├── /contact                           *
│   ├── /brand                             *
│   ├── /roadmap                           *
│   ├── /demo
│   ├── /press
│   └── /partners
│
├── /legal
│   ├── /privacy                           *
│   ├── /terms                             *
│   ├── /cookies
│   ├── /dpa
│   ├── /subprocessors
│   ├── /acceptable-use
│   ├── /sla
│   └── /accessibility
│
├── /login  → app.tellann.co/auth/login    * (redirect, next.config.ts)
└── /signup → app.tellann.co/auth/login    * (redirect, next.config.ts)
```

Menu grouping is a presentation concern and does not always follow the URL
tree — the Product menu's *Platform* column carries `/desktop` and
`/desktop/security` alongside the `/product` entry points, because that is how
a reader looks for them. Section 50 covers the menu layout rules.

Service and operational routes also exist outside the marketing tree:
`/offline`, `/maintenance`, `/rate-limited`, `/forbidden`, `/service-unavailable`,
`/status`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and
`/.well-known/security.txt`.

This gives you both a **good human navigation architecture** and a very strong SEO foundation.

---

# 4. Home page `/`

The homepage should **not attempt to explain every capability**.

Its job is to answer five questions quickly:

```text
What is Tellann?
Why should I care?
How does it work?
Can I trust it?
How do I start?
```

I would structure it like this.

## Hero

Something around:

> Understand how your software actually behaves.

Supporting proposition:

```text
Demonstrate your application.
Tellann maps its workflows,
measures behavioral coverage,
and reveals the states and paths you missed.
```

Primary CTA:

**Start free**

Secondary CTA:

**See how it works**

This closely follows the MVP positioning established in your specification. 

---

## Visual product demonstration

Your short looping video would work exceptionally well here.

For example:

```text
Application
    ↓

Developer clicks through:

Register
Login
Browse
Cart
Checkout

    ↓

Tellann

    ↓

Behavior Graph
Coverage: 72%
Missing: Payment Failure
Missing: Empty Cart
Slow endpoint detected
```

The Developer Demonstration Mode is explicitly intended to transform a developer walkthrough into behavioral graphs, coverage reports, missing-flow/state findings, endpoint analysis and QA reports. 

---

## Problem section

Something like:

```text
Tests tell you what you expected.
Tellann shows you what you actually demonstrated.
```

Then three/four problems:

* Important user flows get forgotten.
* Edge cases remain invisible.
* QA coverage becomes difficult to reason about.
* Debugging requires reconstructing what happened.

These connect directly to the product problem space. 

---

## How Tellann works

A simple 4-step sequence:

```text
01 Connect
Install the Tellann SDK.

02 Demonstrate
Walk through your application normally.

03 Observe
Tellann reconstructs states, transitions and workflows.

04 Understand
Receive coverage, missing-flow and quality reports.
```

The SDK currently targets React/Next.js on the frontend and Node.js/Express/NestJS/Fastify server environments. 

---

## Product pillars

Four large cards:

```text
Observe
Session Replay

Model
Behavior Graphs

Measure
Workflow Coverage

Discover
Missing States & Flows
```

Then perhaps:

```text
Analyze
Endpoint Intelligence

Communicate
QA Reports
```

---

# 5. `/product`

This is the high-level product overview.

Think of Home as:

> Why Tellann?

Product becomes:

> What exactly does Tellann do?

Sections:

```text
Tellann Platform

Observe
├── SDK
├── Session Recording
└── Session Replay

Understand
├── Workflow Discovery
├── States
├── Transitions
└── Behavior Graph

Analyze
├── Coverage
├── Missing States
├── Missing Flows
└── Endpoint Intelligence

Communicate
├── QA Reports
└── Report Exports
```

This reflects the MVP workflow:

```text
Observe Behavior
      ↓
Build Sessions
      ↓
Generate Workflows
      ↓
Measure Coverage
      ↓
Identify Missing States
      ↓
Identify Missing Flows
      ↓
Generate QA Reports
```



---

# 6. `/product/how-it-works`

This should be one of the site's most important conversion pages.

### Step 1 — Create an application

```text
Create application
↓
Receive SDK credentials
```

### Step 2 — Install Tellann

```bash
npm install ...
```

### Step 3 — Start demonstration

```text
Start Recording
```

### Step 4 — Use the application

```text
Register
↓
Login
↓
Search
↓
Cart
↓
Checkout
```

### Step 5 — Tellann processes behavior

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

### Step 6 — Analysis appears

```text
Coverage
Missing states
Missing flows
Endpoints
Replay
Reports
```

This is essentially the Developer Demonstration lifecycle specified for Tellann. 

---

# 7. `/product/demonstration-mode`

This should arguably be the **signature Tellann feature page**.

The concept is simple enough to own:

> Don't describe your application to Tellann. Show it.

The developer performs the workflow instead of manually documenting it.

The system observes:

```text
PAGE_VISIT
ROUTE_CHANGE
BUTTON_CLICK
FORM_SUBMITTED
STATE_TRANSITION
API_REQUEST
API_RESPONSE
ERROR_OCCURRED
```

Those event families come directly from Tellann's event model. 

The page should show:

```text
Demo Session

00:00 Landing Page
00:06 Register
00:19 Registration Complete
00:25 Login
00:39 Product Search
00:52 Product Viewed
01:04 Add to Cart
01:16 Checkout
01:33 Payment Success

                ↓

Tellann understands:

Registration Workflow
Login Workflow
Search Workflow
Checkout Workflow
```

---

# 8. `/product/behavior-graphs`

This should explain your strongest technical differentiator.

Tellann's behavioral model consists of:

```text
State
 ↓
Action
 ↓
Transition
 ↓
Workflow
```



Example visual:

```text
                         ┌─ PAYMENT_FAILED
                         │
PRODUCT_VIEW → CART → CHECKOUT → PAYMENT_SUCCESS
                  │
                  └─ CART_EMPTY
```

The page should explain:

* States
* Actions
* Transitions
* Workflows
* Entry points
* Exit points
* Frequencies

And finish with:

**See what your application's behavior looks like.**

---

# 9. `/product/workflow-discovery`

This page focuses specifically on:

> Automatically turn interactions into understandable application workflows.

Example:

```text
Observed Events

click
route
form
API
state
click
API

        ↓

Discovered Workflow

PRODUCT_VIEW
     ↓
ADD_TO_CART
     ↓
CART
     ↓
CHECKOUT
     ↓
PAYMENT_SUCCESS
```

Workflow discovery is explicitly part of the Phase 1 product. 

---

# 10. `/product/coverage`

SEO title could target phrases such as:

> User Flow Coverage for Web Applications | Tellann

The page should explain the different coverage dimensions Tellann already defines:

```text
Workflow Coverage
State Coverage
Transition Coverage
Endpoint Coverage
Error Coverage
```



Example:

```text
Checkout

Coverage             72%

Observed              18 paths
Missing                7 paths

✓ Checkout success
✓ Add item
✓ Remove item

○ Payment failure
○ Session expiry
○ Inventory change
○ Gateway timeout
```

---

# 11. `/product/missing-flows`

Focus purely on unobserved scenarios.

Examples already specified include:

```text
Payment Failure
Retry Payment
Password Reset
Session Expiration
Out of Stock
Gateway Failure
```



This page could rank particularly well for developer searches around:

```text
missing test cases
edge case detection
QA coverage gaps
user flow testing
application flow testing
```

---

# 12. `/product/missing-states`

Different from missing flows.

Show examples:

```text
Missing

Loading state
Empty state
Error state
Recovery state
404 state
Authentication failure
No results
```

Tellann specifically defines these categories as part of the Phase 1 analysis. 

This distinction should be made very obvious because it helps establish Tellann's terminology.

---

# 13. `/product/session-replay`

This page should make one distinction very clear:

**Tellann replay is not fundamentally a video recording.**

It reconstructs behavior from telemetry:

```text
Captured Events
       ↓
Session
       ↓
Timeline
       ↓
Replay Model
```



Then show:

```text
12:00:00 Session Started
12:00:04 Home
12:00:08 Register clicked
12:00:15 Form submitted
12:00:18 POST /register
12:00:19 200 OK
12:00:20 Registration completed
```

Privacy becomes a major section of this page.

---

# 14. `/product/endpoint-intelligence`

This gives Tellann a stronger engineering angle.

Show:

```text
Endpoint                         Avg       Error

GET /api/products              122ms      0.2%
POST /api/cart                 214ms      0.4%
POST /api/payment              681ms      3.8%
GET /api/search                942ms      1.1%
```

Then:

```text
Slow endpoints
Frequent endpoints
Error-prone endpoints
Endpoint rankings
```

Those capabilities are part of the current functional requirements. 

---

# 15. `/product/qa-reports`

Show actual report screenshots/mockups.

Tellann currently defines:

```text
Executive Quality Report
Flow Coverage Report
Behavioral Graph Report
Missing Flow Report
Missing State Report
Session Analysis Report
Endpoint Intelligence Report
```

for Phase 1. 

That makes this an extremely strong trust page because prospective customers can see **what they actually receive**.

---

# 16. Solutions architecture

You need two different concepts.

### Product pages

Explain:

> What does Tellann do?

### Solution pages

Explain:

> What does Tellann do for me?

So:

```text
/solutions/developers
/solutions/qa-engineers
/solutions/engineering-leaders
/solutions/product-teams
/solutions/startups
/solutions/saas
```

Your existing product definition explicitly identifies developers, QA engineers, engineering managers and product teams as core users. 

---

# 17. `/solutions/developers`

Message:

> Stop reconstructing application behavior manually.

Focus:

```text
Understand the exact workflow.
Replay sessions.
Inspect API activity.
Find paths you forgot.
Debug with behavioral context.
```

CTA:

**Analyze your application**

---

# 18. `/solutions/qa-engineers`

Message:

> See what's covered—and what isn't.

Focus heavily on:

```text
Workflow coverage
Missing flows
Missing states
Failure paths
QA reports
```

CTA:

**Generate your first QA report**

---

# 19. `/solutions/engineering-leaders`

Different message:

> Know what your team actually validated.

Show:

```text
Coverage Summary
Workflow Inventory
Critical Gaps
Endpoint Risks
Quality Reports
```

Less technical installation detail.

---

# 20. `/solutions/startups`

This is commercially important.

The MVP explicitly targets startup founders in addition to developers and QA engineers. 

Message:

> Get meaningful QA visibility without building a large QA operation.

Then explain demonstration → intelligence.

---

# 21. Use-case SEO pages

These are different from persona pages.

```text
/use-cases/workflow-coverage
/use-cases/find-missing-flows
/use-cases/find-missing-states
/use-cases/api-performance-analysis
/use-cases/qa-planning
/use-cases/application-walkthrough
```

These target **problem-aware Google searches**.

For instance:

```text
Google:
"how to identify missing test cases"

↓

Tellann:
/use-cases/find-missing-flows

↓

Learn how it works

↓

/product/missing-flows

↓

Start free
```

That is a much stronger SEO architecture than expecting everyone to land on `/`.

---

# 22. Developers hub

Because Tellann is developer infrastructure, `/developers` should be almost a second homepage.

```text
/developers
```

Hero:

> Tellann for developers

Then:

```text
Quickstart

1. Install SDK
2. Initialize Tellann
3. Start session
4. Demonstrate workflow
5. View analysis
```

Platforms presently documented include JavaScript/TypeScript, React, Next.js, Node.js, Express, NestJS and Fastify. 

Then framework pages:

```text
/developers/react
/developers/nextjs
/developers/nodejs
/developers/express
/developers/nestjs
```

These have substantial SEO potential.

---

# 23. Documentation

I'd separate documentation from the marketing website:

```text
docs.tellann.co
```

Structure:

```text
Getting Started

SDK
├── React
├── Next.js
├── Node.js
├── Express
├── NestJS
└── Fastify

Concepts
├── Events
├── Sessions
├── States
├── Workflows
├── Behavior Graphs
└── Demonstrations

Features
├── Session Replay
├── Coverage
├── Missing States
├── Missing Flows
├── Endpoint Intelligence
└── Reports

Configuration
├── Privacy
├── Environments
├── SDK Keys
└── Data Retention

API Reference

Examples

Troubleshooting
```

---

# 24. Pricing `/pricing`

Pricing already has a very clean ladder:

```text
Free
$0

Solo
$29

Team
$99

Business
$299

Enterprise
Custom
```



I'd design the page so a visitor sees the conceptual difference before the detailed table:

```text
FREE
Try Tellann

SOLO
Build independently

TEAM
Work together

BUSINESS
Scale across products

ENTERPRISE
Control everything
```

Then the detailed comparison below.

Importantly, Phase 1 pricing should primarily communicate **applications, users, storage and retention**, rather than events. That's explicitly consistent with Tellann's pricing strategy. 

---

# 25. Security `/security`

For a product observing customer applications, this page is not optional.

It belongs almost alongside Pricing in importance.

Structure:

```text
/security

Security at Tellann

├── Encryption
├── Tenant isolation
├── Authentication
├── RBAC
├── SDK security
├── Privacy filtering
├── Audit logging
└── Data protection
```

Tellann's design requires TLS protection, encryption at rest, tenant isolation, RBAC, API-key security and privacy controls. 

---

# 26. `/security/privacy`

Make this particularly detailed.

Tellann has a strong differentiator here because the architecture specifies privacy filtering **before transmission**.

Your page can explain:

```text
COLLECT

Navigation
Clicks
Routes
State transitions
API metadata
Performance information


MASK

Emails
User IDs
Names
Phone numbers
IP addresses


NEVER COLLECT

Passwords
Credit cards
CVV
JWTs
API secrets
Private keys
```



This page will matter tremendously once people realize what Tellann observes.

---

# 27. Resources

```text
/resources
```

Acts as a content hub.

Then:

```text
/blog
/guides
/case-studies
/research
/glossary
/changelog
```

---

# 28. Blog architecture

Don't organize the blog randomly.

Use categories around Tellann's product category.

```text
/blog/behavioral-testing
/blog/software-quality
/blog/qa-engineering
/blog/session-replay
/blog/application-observability
/blog/testing-strategy
/blog/release-quality
```

Article URLs:

```text
/blog/what-is-behavioral-testing
/blog/how-to-find-missing-user-flows
/blog/qa-coverage-vs-code-coverage
/blog/how-to-test-user-workflows
/blog/session-replay-for-debugging
```

This creates topic authority.

---

# 29. Glossary

This is particularly useful for SEO.

```text
/glossary/behavior-graph
/glossary/workflow-coverage
/glossary/session-replay
/glossary/application-state
/glossary/state-transition
/glossary/user-workflow
/glossary/behavioral-testing
/glossary/qa-coverage
```

These can become stable evergreen SEO pages.

---

# 30. Competitor comparison pages

Your competitive document provides enough differentiation to justify this entire category. Tellann sits across QA, observability, analytics, replay and behavioral modeling rather than matching one of those categories exactly. 

So create:

```text
/compare/sentry
/compare/posthog
/compare/replay
/compare/datadog
/compare/new-relic
```

Potential titles:

```text
Tellann vs Sentry
Tellann vs PostHog
Tellann vs Replay
```

But avoid childish:

> "Tellann destroys Sentry."

Instead explain:

```text
If you need exception tracking → Sentry

If you need product analytics → PostHog

If you need behavioral QA intelligence → Tellann
```

That honesty actually strengthens the brand.

---

# 31. About `/about`

I would **not** make About Tellann a generic corporate essay.

Structure:

```text
Why Tellann exists
      ↓

Modern software generates enormous behavioral evidence,
yet QA is still largely defined manually.
      ↓

Our belief:
software behavior itself can reveal quality.
      ↓

Our mission
      ↓

The future we're building
```

The underlying product philosophy is already explicit: testing focuses on tests, monitoring on failures, analytics on usage, while Tellann is intended to sit at their intersection. 

---

# 32. Roadmap `/roadmap`

This is where future capabilities belong.

For example:

```text
NOW
Behavioral QA

Demonstration Mode
Behavior Graphs
Coverage
Missing States
Missing Flows
Session Replay
Endpoint Intelligence


NEXT
Production Intelligence

Production observation
Journey intelligence
Workflow health
Error correlation


LATER
Autonomous Validation

Test generation
Regression detection
Failure simulation
Behavioral anomalies
Quality intelligence
```

That prevents a major marketing mistake:

**promising Phase 3 as though customers can use it today.**

---

# 33. Company pages

Eventually:

```text
/company
/about
/careers
/contact
/brand
/roadmap
```

`/brand` can provide:

```text
Tellann logo
Colors
Brand usage
Press description
Media kit
```

---

# 34. Footer architecture

I'd make the footer substantial.

```text
PRODUCT

Overview
How it works
Demonstration Mode
Behavior Graphs
Coverage
Session Replay
Endpoint Intelligence
Reports


SOLUTIONS

Developers
QA Engineers
Engineering Leaders
Startups
SaaS Teams


DEVELOPERS

Documentation
React
Next.js
Node.js
API Reference
SDK Reference
Status


RESOURCES

Blog
Guides
Case Studies
Glossary
Changelog
Roadmap


COMPANY

About
Careers
Contact
Brand


LEGAL & TRUST

Security
Privacy
Terms
Cookies
DPA
Subprocessors
```

---

# 35. The actual user navigation journeys

The architecture becomes clearer if we look at visitors rather than pages.

## Journey A — Developer discovers Tellann

```text
Google / X / GitHub
        ↓
      Home
        ↓
   How it Works
        ↓
Demonstration Mode
        ↓
     Quickstart
        ↓
      Signup
        ↓
app.tellann.co
        ↓
Create Application
        ↓
Install SDK
        ↓
Record Demonstration
```

---

# 36. Journey B — QA engineer

```text
Google:
"find missing test cases"

        ↓

/use-cases/find-missing-flows

        ↓

/product/missing-flows

        ↓

/product/coverage

        ↓

See sample report

        ↓

Start Free
```

---

# 37. Journey C — Engineering manager

```text
LinkedIn / Search
        ↓
Home
        ↓
Solutions
        ↓
Engineering Leaders
        ↓
QA Reports
        ↓
Security
        ↓
Pricing
        ↓
Book Demo
```

Different buyer, different path.

---

# 38. Journey D — technically skeptical developer

This one matters enormously for Tellann.

```text
Homepage
   ↓
"Sounds interesting, but what are you collecting?"
   ↓
Security
   ↓
Privacy
   ↓
SDK Docs
   ↓
GitHub / technical docs
   ↓
Quickstart
   ↓
Start Free
```

Given Tellann's SDK and replay model, this user journey could decide whether someone trusts the product at all.

---

# 39. Journey E — startup founder

```text
Homepage
   ↓
Solutions → Startups
   ↓
How it Works
   ↓
Pricing
   ↓
Free vs Solo
   ↓
Signup
```

No need to show Kafka, event schemas or telemetry architecture unless they deliberately go into documentation.

---

# 40. Journey F — enterprise prospect

```text
Homepage
   ↓
Product
   ↓
Security
   ↓
Privacy
   ↓
Enterprise
   ↓
Architecture / Deployment
   ↓
Pricing
   ↓
Contact Sales
```

The architecture already contemplates both SaaS and future self-hosted enterprise deployment. 

---

# 41. SEO architecture

I'd think about your SEO pages as layers.

### Layer 1 — Brand

```text
/
 /about
 /pricing
 /product
```

### Layer 2 — Features

```text
/product/behavior-graphs
/product/session-replay
/product/coverage
/product/missing-flows
```

### Layer 3 — Problems

```text
/use-cases/find-missing-test-cases
/use-cases/workflow-coverage
/use-cases/qa-planning
```

### Layer 4 — Audiences

```text
/solutions/developers
/solutions/qa-engineers
/solutions/startups
```

### Layer 5 — Technologies

```text
/developers/react
/developers/nextjs
/developers/nodejs
```

### Layer 6 — Competitors

```text
/compare/sentry
/compare/posthog
```

### Layer 7 — Education

```text
/blog/*
/guides/*
/glossary/*
```

That creates an internal linking graph instead of isolated pages.

---

# 42. Internal linking model

For example:

```text
/blog/how-to-find-missing-test-cases
             ↓
/use-cases/find-missing-flows
             ↓
/product/missing-flows
             ↓
/product/demonstration-mode
             ↓
/developers/quickstart
             ↓
/signup
```

The visitor gradually moves from:

```text
Learning
→ Problem awareness
→ Product awareness
→ Evaluation
→ Adoption
```

That is exactly what you want.

---

# 43. Header mega-menu structure

### PRODUCT

```text
Platform
├─ Product Overview
├─ How Tellann Works
└─ Demonstration Mode

Understand Behavior
├─ Behavior Graphs
├─ Workflow Discovery
└─ Session Replay

Analyze Quality
├─ Coverage
├─ Missing Flows
├─ Missing States
└─ Endpoint Intelligence

Communicate
└─ QA Reports
```

### SOLUTIONS

```text
By Role
├─ Developers
├─ QA Engineers
├─ Engineering Leaders
└─ Product Teams

By Organization
├─ Startups
└─ SaaS Teams

Use Cases
├─ Workflow Coverage
├─ Missing Flows
└─ QA Planning
```

### DEVELOPERS

```text
Quickstart
Documentation
SDKs
API Reference
Examples
GitHub
Status
```

### RESOURCES

```text
Blog
Guides
Glossary
Case Studies
Changelog
Roadmap
```

---

# 44. What I would NOT put in the main navigation

Avoid:

```text
Features
Solutions
Platform
Capabilities
Technology
Product
Why Tellann
```

all as separate top-level items.

They overlap conceptually.

Also avoid exposing:

```text
Behavior Graph Engine
Session Engine
Kafka
ClickHouse
Event Collector
Graph Repository
Coverage Engine
```

on the main marketing pages.

Those belong in technical documentation.

Customers should encounter:

> Behavior Graph

not:

> Neo4j Behavioral Graph Repository Consumer Pipeline.

---

# 45. The core information architecture

Ultimately, I would organize the entire website around five concepts:

```text
                   TELLANN
                      │
       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼
    PRODUCT        SOLUTIONS      DEVELOPERS
What Tellann does   Why I need it  How I implement it
       │              │              │
       └──────────────┼──────────────┘
                      │
                      ▼
                  RESOURCES
                  Learn/SEO
                      │
                      ▼
                   PRICING
                 Make decision
                      │
                      ▼
                  START FREE
                      │
                      ▼
                app.tellann.co
```

# 46. Recommended launch sitemap

I would **not build all 70+ pages immediately**.

For the first polished launch, I'd ship these roughly **25 priority pages**:

```text
/

PRODUCT
/product
/product/how-it-works
/product/demonstration-mode
/product/behavior-graphs
/product/coverage
/product/missing-flows
/product/missing-states
/product/session-replay
/product/endpoint-intelligence
/product/qa-reports

SOLUTIONS
/solutions/developers
/solutions/qa-engineers
/solutions/startups
/solutions/engineering-leaders

DEVELOPERS
/developers
/developers/quickstart
/docs

BUSINESS
/pricing
/security
/security/privacy

RESOURCES
/blog
/guides
/changelog

COMPANY
/about
/contact
```

Then expand the `/use-cases`, `/compare`, `/glossary`, framework-specific developer pages and case studies as the content engine matures.

The resulting site has a very clear narrative:

> **Tellann observes how your application behaves → reconstructs its workflows → builds a behavior graph → measures what you demonstrated → identifies what you missed → gives your team evidence about application quality.**

That is both faithful to the current MVP and considerably stronger for SEO than a conventional **Home / Product / About / Pricing / Contact** five-page SaaS website.   


---

# 47. Route status — how the tree is maintained

Every route lives in one file:

```text
apps/marketing/src/config/site-routes.ts
```

Each entry carries a status:

```ts
export type SiteRoute = {
  href: string;
  label: string;
  description: string;
  status: 'live' | 'planned';
};
```

Two helpers create them — `live(...)` for a page that exists under `src/app`,
and `route(...)` for a route reserved for launch.

**Status controls how search engines see a route**, so promoting a page is a
one-word change:

```text
status: 'planned'
  ├── excluded from sitemap.xml
  └── served with <meta name="robots" content="noindex, follow">

status: 'live'
  ├── included in sitemap.xml
  └── indexable
```

**Navigation is deliberately separate.** Planned routes stay in the header and
footer while the site is being built: the menus show the full intended
structure, nothing is lost track of, and every link lands on a coming-soon stub
instead of a 404. Search engines are already protected by the two rules above,
so there is no need to hide the routes from people.

## Promoting a stub

1. Build the real page at `src/app/<route>/page.tsx`.
2. Change its `route(` to `live(` in `site-routes.ts`.
3. Give the page a self-referencing canonical:
   `alternates: { canonical: '/your-route' }`.

Step 3 matters — the root layout sets `canonical: '/'`, so a page without its
own canonical tells search engines it is a duplicate of the homepage.

## Hiding planned routes at launch

When the site goes live you may want visitors to see only finished pages. One
flag drops every planned route from the header and footer:

```bash
NEXT_PUBLIC_HIDE_PLANNED_ROUTES=true
```

It changes navigation only — stub URLs stay reachable either way, and the
routes stay in `site-routes.ts` as the build checklist. Leave it unset while
building.

## Structural rules

- **Redirects are not stubs.** `/login`, `/signup` and `/docs` are handled in
  `next.config.ts` and must never be registered in `site-routes.ts`, or the
  catch-all would render a coming-soon page for them. `/about` redirects to
  `/company` and is unregistered for the same reason.
- **Dynamic collections need real route files.** `/blog/[slug]`,
  `/glossary/[term]`, `/guides/[slug]`, `/case-studies/[slug]` and
  `/careers/[slug]` cannot be represented as stubs. The index and category
  routes are registered now; the `[slug]` handlers arrive with the content layer.
- **Blog categories and glossary terms** are exported separately
  (`blogCategoryRoutes`, `glossaryRoutes`) and deliberately kept out of the
  navigation groups so the Resources mega-menu stays readable. Their index
  pages link them.
- **Empty groups disappear.** A navigation section left with no visible routes
  is dropped rather than rendered as an empty mega-menu or footer column. This
  only has an effect once NEXT_PUBLIC_HIDE_PLANNED_ROUTES is on.

---

# 48. Why these routes exist — product coverage

The route set was reconciled against what the dashboard (`apps/dashboard`) and
desktop application (`apps/desktop`) actually ship. Several shipped
capabilities had no marketing page at all, and several were sold on `/pricing`
with nowhere to link.

## The declared-intent half of the product

The original plan described Tellann as *demonstrate → observe → discover*. The
product now also asks a team to **declare intended behavior first, then prove
it**. These routes cover that half:

```text
/product/flow-declaration            ← dashboard /declare, desktop Intent
/product/reconciliation              ← dashboard /reconciliation (FDRS)
/product/graph-drift                 ← dashboard /graph-drift
/product/automated-instrumentation   ← desktop instrumentation-controller
/product/document-flow-inference     ← desktop document → intent drafts
/product/guided-qa-runs              ← desktop guided runs, dashboard /qa-runs
```

## The workspace and platform layer

Each of these is a paid row on `/pricing` that previously had no destination:

```text
/product/environments      ← settings/environments
/product/team-access       ← settings/members, application permissions
/product/audit-logs        ← settings/audit-logs
/product/notifications     ← the notification pipeline (in-app, push, email)
/product/integrations      ← management API tokens, outbound webhooks
/product/data-retention    ← settings/data
```

## Accuracy constraints

Three limits were applied deliberately, and should be rechecked before launch:

- **No integrations directory.** Only outbound webhooks and management API
  tokens exist. There is no Slack, GitHub, Jira or Linear integration, so no
  `/integrations/<vendor>` routes were created.
- **`/developers/nestjs` has no adapter.** `packages/backend-sdk/src/integrations`
  ships `express` and `fastify` only. Build the adapter or drop the route —
  do not publish the page as-is. Vue, Angular and Svelte pages should wait until
  the frontend SDK documents them.
- **Desktop ships Windows only.** `/desktop/windows` is registered;
  `/desktop/macos` and `/desktop/linux` should be added when those builds ship.
- **`/security/compliance`** should stay a stub until there is something
  factual to state.

---

# 49. Recommended build order

The launch list in section 46 still holds, reordered for what is now known:

```text
1  /product/qa-reports
   The homepage and /product already link to it. Highest-value fix.

2  /product/flow-declaration
   /product/reconciliation
   Without these the site describes a product Tellann no longer ships.

3  /security/privacy
   /security/data-collection
   The trust gate for a developer audience.

4  /developers
   /developers/quickstart
   Mostly links into docs.tellann.co, which is already written.

5  /product/environments, /product/team-access, /product/audit-logs,
   /product/notifications, /product/integrations, /product/data-retention
   Gives every pricing row a destination.

6  /product/automated-instrumentation
   /product/document-flow-inference
   /product/guided-qa-runs
   The paid gates buyers cannot currently read about.

7  /solutions/*  then  /use-cases/*
   SEO layers 3 and 4.

8  /compare/*, /blog/*, /glossary/*
   The content engine.
```


---

# 50. Mega-menu layout rules

With 138 routes registered, the navigation needs rules or it grows past the
screen. Three constraints keep every menu to **one row, no scrolling**, at every
desktop width down to 1101px.

## 1. One column per group, capped at five

The header sets `--mega-cols` from the group count and the grid reads it:

```css
grid-template-columns: repeat(min(var(--mega-cols, 4), 5), minmax(0, 1fr));
```

A menu is then exactly as wide as it needs to be — Company gets 2 columns,
Solutions 3, Product 5 — and never wraps onto a second row. The practical
consequence: **a menu section must not exceed five groups.** If a sixth is
needed, merge two or move a group to another section.

## 2. A group shows at most six routes

Longer groups are capped in the menu and finish with a "See all" link:

```ts
{
  label: 'Use cases',
  limit: 6,
  seeAll: '/use-cases',
  routes: [ /* 13 entries, ordered by priority */ ],
}
```

Declaration order is priority order — the first `limit` entries are what the
menu shows. The footer and the group's index page still list everything, so
nothing becomes unreachable. Mobile ignores the cap; it is a scrolling list
already.

## 3. Descriptions are clamped to two lines

`.mega-menu-link-copy > span` uses `-webkit-line-clamp: 2`, which bounds every
item at roughly 64px no matter how narrow the column gets. Write descriptions
under about 40 characters so the clamp never actually truncates.

## Resulting geometry

Measured at 1400×900 and again at the tightest desktop size, 1102×720:

```text
Menu         Groups  Columns  Scrolls
Product         5        5       no
Solutions       3        3       no
Developers      3        3       no
Resources       2        2       no
Company         2        2       no
```

The Product menu went from 1046px tall (scrolling, two rows) to 542px in a
single row by merging seven groups into five:

```text
before                          after
─────────────────────────────   ─────────────────────────────
Platform                        Platform
Desktop                           + Desktop app, Desktop security
Declare & verify                Declare & verify
Understand behavior             Understand behavior
Analyze quality                 Analyze & report
Communicate                       + QA reports
Operate                         Operate
```

No routes were removed to achieve this — all 138 remain registered, in the
footer, and reachable.
