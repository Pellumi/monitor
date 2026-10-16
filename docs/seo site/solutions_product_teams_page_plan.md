# `/solutions/product-teams` — Complete SEO Marketing Page Specification

TELLANN / SOLUTIONS / PRODUCT TEAMS

# Know whether your product behaves the way you intended.

A complete, implementation-ready specification for Tellann's Product Teams landing page, including audience-specific benefits, content, imagery, videos, animation, interactive components, SEO, responsive layouts, conversion paths, and analytics.

## 1. Page purpose and positioning

The `/solutions/product-teams` page should show product managers, product owners, business analysts, and product-focused founders how Tellann helps connect product expectations to demonstrated application behavior.

Product teams often write requirements, define user journeys, establish acceptance criteria, and collaborate with designers, developers, and QA engineers. Yet after implementation, they may struggle to determine whether the application behaves as originally intended.

Tellann addresses this problem through two complementary models:

- Declared Intent Graph: What the product team says the application should do.
- Observed Behavior Graph: What Tellann actually witnessed during a guided demonstration.

The Flow Declaration & Reconciliation System compares these models, identifying confirmed behavior, gaps, and observed behavior outside the original declaration.

The core marketing message should be:

> You define the experience. Tellann helps you see whether the demonstrated application matches it.

### Recommended H1

Know whether your product behaves the way you intended.

### Supporting positioning

> From onboarding to checkout, every user journey starts with an expectation. Tellann helps your team define intended workflows, compare them with demonstrated behavior, and uncover gaps before they become overlooked product issues.

### What this page is not

This is not a product analytics or conversion-funnel page.

Tellann's longer-term product vision includes production journey analysis, behavioral trends, and workflow health. However, the Phase 1 MVP is based on controlled demonstrations—not continuous production traffic.

Therefore, do not advertise:

- Live customer journey monitoring.
- Real user conversion analytics.
- Automatic churn prediction.
- Continuous funnel abandonment tracking.
- AI-generated product-roadmap decisions.
- Automatic detection of business impact or revenue loss.

The Phase 1 benefit is validating intended user journeys against demonstrated evidence.

## 2. Intended audiences and their benefits

| Audience                   | Core concern                                              | How Tellann helps                                          |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| Product managers           | Did engineering implement the expected journey?           | Compare declared and demonstrated workflows                |
| Product owners             | Are acceptance expectations reflected in the application? | Examine supporting behavior evidence                       |
| Business analysts          | Were all relevant paths and exceptions considered?        | Review missing states, branches, and undeclared behavior   |
| Technical product managers | How do I bridge specifications and implementation?        | Use shared intent graphs and reconciliation reports        |
| Product-focused founders   | Is the MVP behaving as planned?                           | Validate core product journeys with a small team           |
| UAT stakeholders           | What remains unverified before acceptance?                | Identify gaps that require further demonstration or review |

The page should primarily target product managers, product owners, and technical product managers.

For product designers, mention the value of validating designed workflows and UI states, but avoid claiming automatic comparison against Figma files unless that integration is developed.

## 3. How this page differs from other Solutions pages

| Solution page       | Central message                                        |
| ------------------- | ------------------------------------------------------ |
| Developers          | Understand what your application actually does         |
| QA Engineers        | Know what you've tested and what you've missed         |
| Engineering Leaders | Lead with evidence, not assumptions                    |
| Product Teams       | Know whether your product behaves the way you intended |

This page should be the most accessible of the four.

It should rely on familiar product concepts—user journeys, requirements, acceptance, expected outcomes, and product experience—before introducing technical terms.

# 4. Recommended page architecture

```
/solutions/product-teams
│
├── 01 Global Navigation & Breadcrumb
├── 02 Product Teams Hero
├── 03 The Product Expectation Gap
├── 04 How Tellann Works for Product Teams
├── 05 Define Your Intended User Journeys
├── 06 Discover Important Missing Scenarios
├── 07 Compare Intended vs Demonstrated Behavior
├── 08 Review Unexpected Product Behavior
├── 09 Turn Acceptance Criteria into Evidence
├── 10 Product Journey Coverage
├── 11 Product and Engineering Collaboration
├── 12 QA Reports for Product Reviews
├── 13 Product Team Use Cases
├── 14 Value by Product Role
├── 15 Main Product Teams Video
├── 16 Product Workflow Adoption
├── 17 Privacy & Responsible Data Collection
├── 18 Related Product Capabilities
├── 19 FAQ
├── 20 Final Conversion CTA
└── 21 Global Footer
```

Recommended desktop length: 8,000–9,800 px after consolidation and responsive adjustments.

The most important sections are intent declaration, demonstrated behavior, reconciliation, and product acceptance. Other sections support the central narrative.

# 5. Visual design direction

Continue Tellann's monochrome brand system using Satoshi typography, graphite panels, restrained borders, and clear diagrams.

For this page, the visuals should be noticeably less technical than those on `/solutions/developers`.

Instead of emphasizing code editors and API traces, emphasize journey maps, expected outcomes, user-flow diagrams, acceptance checkpoints, and understandable report summaries.

Checkout journey

Example product flow

Visual language: understandable journeys and evidence, not abstract AI graphics.

### Layout standards

| Property          | Desktop    | Tablet   | Mobile       |
| ----------------- | ---------- | -------- | ------------ |
| Max content width | 1280 px    | 90%      | 100% − 32 px |
| Hero H1           | 64–72 px   | 48–56 px | 36–42 px     |
| Section H2        | 44–54 px   | 36–42 px | 30–36 px     |
| Body              | 18–19 px   | 17 px    | 16 px        |
| Section spacing   | 112–136 px | 80–96 px | 64–80 px     |
| Split sections    | 48/52      | 50/50    | Stacked      |
| Image radius      | 16 px      | 12 px    | 12 px        |
| Button height     | 48–52 px   | 48 px    | 48 px        |

# 6. Section 01 — Navigation and breadcrumb

Use the global Tellann navigation.

Breadcrumb:

`Home → Solutions → Product Teams`

Make `/solutions/product-teams` the canonical product-team solution URL.

The Solutions mega-menu item should read:

Product Teams Connect product expectations to demonstrated behavior.

The current solution should be highlighted within the menu.

# 7. Section 02 — Hero

DESKTOP HEIGHT: APPROXIMATELY 820–960 PX

### Eyebrow

`TELLANN FOR PRODUCT TEAMS`

### H1

> Know whether your product behaves the way you intended.

### Supporting copy

> Define what your application should do. See what your team actually demonstrated. Tellann brings intended journeys and observed behavior together, helping you discover gaps, validate product expectations, and collaborate with engineering using real evidence.

### Primary CTA

Start with your product journey →

Destination: the actual onboarding/signup route, ideally with a product-team context parameter.

### Secondary CTA

See how Tellann works

Scroll to `#how-it-works`.

### Supporting microcopy

`Define journeys` · `Validate expectations` · `Discover gaps` · `Share evidence`

## Hero layout

TELLANN FOR PRODUCT TEAMS

# Know whether your product behaves the way you intended.

From product expectations to demonstrated evidence.

Start free&#x20;

See how it works&#x20;

WHAT YOU EXPECTED

Add item to cart

Complete checkout

Payment failure

Retry payment

WHAT WAS DEMONSTRATED

Add item to cart

Complete checkout

Payment failure

Retry not observed

Illustrative hero UI showing the difference between intended and demonstrated behavior.

### Hero media specifications

| Property          | Specification                        |
| ----------------- | ------------------------------------ |
| Master artboard   | 1600 × 900 px                        |
| Desktop rendering | 1180 × 580 px                        |
| Tablet            | 960 × 540 px, fluid                  |
| Mobile            | Custom stacked design, 720 × 1050 px |
| Asset type        | React/SVG interactive visualization  |
| Static fallback   | 1600 × 900 WebP/AVIF                 |
| Placement         | Centered below headline and CTAs     |
| Radius            | 16 px                                |

### Hero animation storyboard

| Time     | Sequence                                    |
| -------- | ------------------------------------------- |
| 0–0.6s   | Declared journey appears                    |
| 0.6–1.5s | Observed journey populates                  |
| 1.5–2.2s | Corresponding states are visually connected |
| 2.2–3.0s | Missing retry evidence is identified        |
| 3.0–3.8s | A reconciliation summary appears            |

Animate once, then remain static.

Do not characterize the retry path as a broken feature merely because it wasn't observed. The wording must reflect the evidence classification.

# 8. Section 03 — The product expectation gap

### Heading

> A feature can be delivered without every expectation being demonstrated.

Supporting:

> Requirements describe the intended experience. Design shows how it should look. Implementation turns it into software. But teams still need a reliable way to compare those expectations against how the application behaves.

Use four problem cards:

Requirements get lost in translation

What was described in a product specification may not be fully reflected in the demonstrated workflow.

Important journeys have hidden branches

Success, failure, validation and recovery paths may receive different levels of attention.

Acceptance discussions lack shared evidence

Product, QA and engineering may describe the same functionality differently.

Feature completion is difficult to evaluate

A completed ticket does not necessarily mean every intended state or path has been validated.

### Layout and animation

- Cards: \~570 × 210 px.
- Desktop: two columns.
- Tablet: two columns where readable.
- Mobile: single column.
- Padding: 28–32 px.
- Motion: 180 ms border treatment on hover/focus.

No video is necessary here.

# 9. Section 04 — How Tellann works for product teams

### Heading

> From product expectations to a clearer picture of what was built.

This is the most important educational section.

Unlike the Developers page, avoid presenting source instrumentation as the primary activity. It is part of the workflow, but not the primary product-manager responsibility.

### Six-step model

01

Define

Describe intended journeys

02

Prepare

Engineering connects the application

03

Demonstrate

QA or developers exercise the workflows

04

Observe

Tellann builds behavior evidence

05

Compare

Review intention against observation

06

Decide

Identify what needs more validation

### Exact division of responsibilities

Product team: Defines intended outcomes, important workflows, alternative paths and expectations.

Developer: Connects the local application, reviews instrumentation, and prepares the technical demonstration environment.

QA or developer: Performs the guided workflow demonstration.

Tellann: Constructs observed behavioral evidence and reconciles it with declared intent.

Product team and QA: Review findings, clarify requirements, and decide which scenarios should be validated next.

An important detail from the specification: product teams can declare intended flows in the web dashboard before installing the desktop agent. The dashboard, however, should not be portrayed as launching or controlling the guided run itself.

### Media requirements

- Master canvas: 1600 × 540 px.
- Desktop: 1200 × 390 px.
- Mobile: 720 × 1250 px vertical timeline.
- Animation: 1.5-second line progression.
- Interaction: clicking a step expands an explanatory sentence.
- CTA: Explore Flow Declaration → `/product/flow-declaration`.

# 10. Section 05 — Define your intended user journeys

MAJOR DIFFERENTIATOR / HIGH VISUAL PRIORITY

### Eyebrow

`FLOW DECLARATION`

### Heading

> Give your product expectations a structure everyone can understand.

Supporting:

> Describe the journeys your application is supposed to support—from successful outcomes to validation errors and recovery paths. Tellann turns that declaration into a model that can later be compared with demonstrated behavior.

This should be the page's primary product visualization.

### Example

A product manager declares the expected checkout journey:

```
Product selected
       ↓
Add to cart
       ↓
Checkout
       ↓
Payment submitted
       ├── Success → Order confirmation
       └── Failure → Display error → Retry
```

A non-technical visitor should immediately understand this diagram.

## Interactive journey builder preview

DECLARED USER JOURNEY

Checkout experience

Success pathFailure path

Product selected

Cart reviewed

Payment submitted

Order confirmed

Expected successful outcome

Interactive illustration of intended-flow declaration, not a live flow editor.

### Visual requirements

| Item            | Specification                 |
| --------------- | ----------------------------- |
| Main source     | 1600 × 1000 px                |
| Desktop display | 700 × 520 px                  |
| Mobile display  | 720 × 1100 px                 |
| Layout          | Text left, diagram right      |
| Background      | Neutral graphite or white     |
| Interaction     | Success/failure branch toggle |
| Transition      | 200–300 ms                    |
| Section height  | 700–820 px                    |

### Important product-detail callouts

The underlying specification supports human-authored flows, suggested branches that require acceptance, and an independent Declared Intent Graph.

Marketing copy may therefore emphasize:

- Human ownership of product expectations.
- The ability to define a flow before instrumentation.
- Explicit review of suggested branches.
- A reusable description of intended application behavior.
- Flow history that can support future reconciliation.

Avoid saying Tellann automatically derives all requirements from a PRD or design file.

CTA: Explore Flow Declaration → `/product/flow-declaration`

# 11. Section 06 — Discover scenarios that were overlooked

### Heading

> Don't stop at the ideal user journey.

Supporting:

> Most product flows are designed around a successful outcome. But users may enter incomplete information, encounter failed requests, lose connectivity, or need to retry an operation. Tellann helps product teams consider these alternate scenarios and see which ones have supporting demonstration evidence.

### Example scenario grid

Successful journey

The user completes the expected action and reaches the intended outcome.

Failure scenario

An operation fails and the application should communicate what happened.

Recovery scenario

The user retries an unsuccessful operation or follows an alternative path.

Validation scenario

The user enters incomplete or invalid information and receives appropriate guidance.

### Visual recommendation

Use an animated journey tree that begins with one successful path, then expands into the alternate paths listed above.

This should look like a product journey map rather than a complex engineering graph.

Media dimensions: 1440 × 900 px master, 680 × 500 px rendered desktop, 720 × 1100 px vertical mobile version.

Animation: Successful path first; alternative paths reveal 200 ms apart. Total duration approximately three seconds.

CTA: `Explore Missing Flow Detection →` linking to the existing product route.

A crucial distinction: Tellann can help surface relevant branches and missing evidence, but the product team remains responsible for deciding which user experiences are intentional and required.

# 12. Section 07 — Intended versus demonstrated behavior

PRIMARY PRODUCT VALUE / HIGHEST CONVERSION PRIORITY

### Eyebrow

`BEHAVIOR RECONCILIATION`

### Heading

> See where the demonstrated experience matches your vision—and where it doesn't.

Supporting:

> Tellann compares your declared workflows with captured application behavior, making it easier to identify supported expectations, missing evidence, and unexpected paths.

The marketing experience should expose Tellann's three reconciliation classifications in plain language.

| Tellann classification | Product-team explanation                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Confirmed              | This intended behavior has matching evidence                                |
| True Gap               | The declared and observed models have a validated reconciliation difference |
| Undeclared             | The demonstration revealed behavior outside the declared flow               |

Be precise: a True Gap is a classification produced under reconciliation rules, not automatically proof of a software bug.

## Interactive comparison

Checkout journey reconciliation

CompareFindings

INTENDED

Cart

Checkout

Payment success

Payment failure

Retry

DEMONSTRATED

Cart

Checkout

Payment success

Payment failure

Retry not observed

Example reconciliation; findings depend on the declared flow and recorded evidence.

### Production visual requirements

- Master canvas: 1600 × 1000 px.
- Desktop display: 720 × 540 px.
- Tablet: 100% width.
- Mobile: vertically stacked graphs, 720 × 1200 px equivalent.
- Interaction: Compare/Findings toggle.
- Animation: graph alignment and difference reveal, 2.5–3 seconds.
- Fallback: side-by-side static comparison with descriptive captions.

### CTA

Explore Reconciliation → `/product/reconciliation`

# 13. Section 08 — Unexpected behavior and product discovery

### Heading

> Sometimes the application shows you a path you never planned.

Not every difference is a missing feature. Sometimes a demonstration reveals a path that the team didn't explicitly declare.

That could indicate an overlooked requirement, an acceptable alternative, or behavior needing further review.

### Example narrative

A product team declares:

`Search → Select product → Checkout`

The observed graph also includes:

`Search → Product unavailable → Return to results`

The product manager should be able to review that additional path and decide whether to incorporate it into intended product behavior.

### Visual

Undeclared behavior example

Illustrative

OBSERVED PATH

Search

Unavailable

Return

Product review question

Is this an intended alternative journey that should be declared, or does it require a product change?

### Asset specifications

- Master: 1440 × 820 px.
- Desktop: 680 × 460 px.
- Mobile: 720 × 900 px.
- Animation: new branch appears, then review question reveals.
- Duration: 2.5 seconds.

The website should emphasize human review and explicit acceptance of changes to declared intent, not silently updating product requirements.

# 14. Section 09 — Acceptance criteria and product validation

### Heading

> Give feature acceptance more than a completed checklist.

This section speaks directly to product owners, product managers, and UAT stakeholders.

### Supporting copy

> Acceptance criteria explain what a feature is expected to do. Tellann helps organize the underlying workflows and supplies demonstration evidence that can support a more informed feature review.

### Example

A checkout feature might have the following expectations:

| Acceptance expectation                    | Example evidence status |
| ----------------------------------------- | ----------------------- |
| User can review the cart                  | Observed                |
| User can submit a valid payment           | Observed                |
| User receives an error when payment fails | Not observed            |
| User can retry after failure              | Not observed            |

These statuses indicate demonstration evidence, not a formal automatic pass/fail verdict for every acceptance criterion.

### Visual composition

Show an acceptance-review panel with a list of intended behaviors on the left and evidence references on the right.

- Master: 1440 × 1000 px.
- Desktop render: 700 × 500 px.
- Mobile: 720 × 1100 px.
- Interaction: selecting an acceptance item highlights the supporting observed state or evidence.
- Animation: 200 ms row transition.

### CTA

See How Flow Declaration Works → `/product/flow-declaration`

Product boundary: Do not promise automatic import of Jira, Linear, Notion, Figma or PRD files as acceptance criteria unless those integrations have been delivered.

# 15. Section 10 — Product journey coverage

### Heading

> Understand how much of the intended journey has been demonstrated.

Product teams don't necessarily need detailed code coverage. They need to understand which parts of their intended experience have supporting validation evidence.

### Interactive example

Journey coverage

OnboardingCheckout

User onboarding

# 4 / 5

Illustrative workflows

Sign-up

Observed

Email verification

Observed

Profile setup

Observed

Welcome experience

Observed

Recovery path

Not observed

### Requirements

The actual product implementation must derive coverage from the supported evidence model. Do not calculate a marketing-only metric and imply it matches Tellann's canonical coverage algorithm.

Dimensions:

- Master: 1600 × 960 px.
- Desktop: 700 × 520 px.
- Mobile: 720 × 1050 px.
- Animation: progress bar and row changes, 250–600 ms.
- Layout: alternating with the previous sections.

### CTA

Explore Coverage Analysis → existing coverage-analysis product route.

# 16. Section 11 — Product and engineering collaboration

### Heading

> Keep product, QA, and engineering aligned around the same experience.

The audience needs to understand that Tellann creates a common behavioral reference.

Product teams

Define what the experience should do.

Developers

Prepare and demonstrate the implemented application.

QA engineers

Review evidence and investigate gaps.

Below the three cards, place a shared flow-reconciliation report that connects the roles.

### Media requirements

- Master: 1600 × 700 px.
- Desktop: 1100 × 470 px.
- Mobile: 720 × 1150 px, vertically connected.
- Animation: role cards connect to a central report over 1.5 seconds.

This section should not assume every account includes multi-member collaboration. Show collaboration benefits as appropriate for team-enabled plans.

CTA: Explore Plans for Teams → `/pricing`

# 17. Section 12 — Reports for product reviews

### Heading

> Bring evidence into your next product review.

Supporting:

> Instead of relying only on demonstrations, ticket updates, or verbal explanations, product teams can review structured findings about intended journeys, observed behavior, and outstanding validation gaps.

### Report mockup

FLOW RECONCILIATION REPORT

Customer Onboarding

## 5

Declared states

## 4

Observed

## 1

Requires review

Outstanding finding

Account recovery was declared but was not observed during the demonstration.

Suggested team discussion

Does this scenario need a new demonstration, or should the intended journey be revised?

Illustrative report content rather than genuine run results.

### Product value

The copy should emphasize:

- Clearer feature-review discussions.
- Evidence for intended versus demonstrated journeys.
- Easier identification of unresolved acceptance questions.
- A shared reference for further testing or product clarification.
- Exportable reports where supported.

### Asset dimensions

| Asset                    | Master         | Render       |
| ------------------------ | -------------- | ------------ |
| Main report interface    | 1440 × 1000 px | 700 × 520 px |
| Secondary finding detail | 800 × 600 px   | 350 × 260 px |
| Mobile report            | 720 × 1100 px  | Full width   |

Animation: metric and finding rows reveal once over 600–800 ms.

CTA: Explore QA Reports → `/product/qa-reports`

# 18. Section 13 — Product team use cases

### Heading

> Wherever a user journey matters, expectations matter too.

Present four practical scenarios.

Launching a new onboarding flow

Define the sign-up and activation journey, then review which intended states were demonstrated.

Clarity about outstanding onboarding validation.

Improving checkout

Review successful payments alongside failure, cancellation, and recovery scenarios.

A clearer picture of checkout behavior.

Changing authentication

Compare expected login, failure, and recovery paths with evidence from a guided run.

More informed feature acceptance.

Preparing an MVP launch

Identify the critical user journeys that should be exercised before product delivery.

A practical evidence base for launch discussions.

### Dimensions

- Desktop card: 570 × 250 px.
- Optional scenario thumbnails: 560 × 280 px.
- Mobile: single-column cards.
- Hover: subtle border transition.

A dedicated mini-video is not required for each use case. The main product video is sufficient.

# 19. Section 14 — Value by product role

### Heading

> Built for the different people who define product success.

PMPOAnalystFounder

## For product managers

Keep intended user journeys visible throughout implementation and validation.

Declare the experience the product should support

Review demonstrated behavior against intended flows

Use evidence when discussing outstanding product work

### Responsive rules

On mobile, allow the role selector to scroll horizontally if it cannot fit without reducing labels to unreadable sizes.

Dimensions: 1100 × 450 px desktop, natural height mobile.

Animation: 200 ms crossfade.

# 20. Section 15 — Product team demonstration video

The video's purpose is to explain the journey from product expectations to validation evidence, not to advertise a complex debugging interface.

### Recommended title

From product requirements to demonstrated behavior — Tellann for Product Teams

[Visual direction reference for Tellann's Product Teams explanatory video](https://images.openai.com/static-rsc-4/F5Z96bxxeq2J7lnx9x4NGWvXVvVkuZTO4cSqWyLF3JF3yL6DNBA44B6oyUlOFUPap2Qpk6dwKYcP3mzP4TrgU77EV9ER8rO-nCZmPAs28DiNU1BiuRrt5NsLd4pbqb-9kXafC6iqcfOQe9GV1G7Dv6fCmmOZHOLIbmhUiqfzCMU?purpose=inline)

[nop-station.com](https://www.nop-station.com/how-we-built-an-ai-qa-agent-that-changed-our-release-cycle)

Use a genuine Tellann flow-declaration and reconciliation interface in the final production poster.

### Video production specifications

| Property          | Requirement                     |
| ----------------- | ------------------------------- |
| Master resolution | 1920 × 1080 px                  |
| Aspect ratio      | 16:9                            |
| Duration          | 90–110 seconds                  |
| Desktop display   | 960 × 540 px                    |
| Mobile display    | Full-width 16:9                 |
| Poster image      | 1600 × 900 px                   |
| Formats           | MP4 H.264 and WebM              |
| Captions          | English VTT                     |
| Narration         | Plain-language, product-focused |
| Playback          | User-initiated                  |

### Detailed storyboard

| Time    | Scene                 | Visual                                                              |
| ------- | --------------------- | ------------------------------------------------------------------- |
| 0–12s   | Product problem       | Intended journey described in a product planning document           |
| 12–25s  | Define expectations   | Product manager declares intended checkout states                   |
| 25–38s  | Include alternatives  | Failure and retry branches are added                                |
| 38–52s  | Prepare demonstration | Developer connects the application through Tellann Desktop          |
| 52–66s  | Observe behavior      | QA practitioner completes a guided walkthrough                      |
| 66–80s  | Compare results       | Declared and observed graphs appear side by side                    |
| 80–95s  | Review gaps           | Unobserved retry path is highlighted                                |
| 95–110s | Product review        | Team reviews a reconciliation report and identifies the next action |

### Suggested narration opening

> Every product feature begins with an expectation. But how do you know whether the implemented experience matches what your team intended? Tellann connects declared user journeys to evidence from real application demonstrations, helping product teams understand what's confirmed and what still needs review.

### Placement

Place the video after the major product-benefit sections and role-based examples.

Include an optional “Watch a product walkthrough” link in the hero, but avoid automatically playing media while scrolling.

# 21. Section 16 — Adoption workflow

### Heading

> Start with one important user journey.

Product teams should understand that they can begin with one workflow rather than migrate their entire product process.

Use four stages:

1. Choose a critical journey. Select onboarding, checkout, registration, or another important product experience.
2. Declare what should happen. Define intended outcomes and the essential alternative paths.
3. Ask the team to demonstrate it. Developers and QA prepare the application and run the workflow through Tellann Desktop.
4. Review the findings. Compare intended and observed behavior, clarify gaps, and identify the next validation task.

### Media specifications

- Master: 1440 × 600 px.
- Desktop: 1120 × 450 px.
- Mobile: 720 × 1000 px.
- Animation: one-time connector reveal, 1.5 seconds.
- CTA: Explore How Tellann Works → `/product`

Do not imply that a product manager must write instrumentation code to create a Declared Intent Graph.

# 22. Section 17 — Privacy and responsible data collection

### Heading

> Review product behavior without exposing unnecessary data.

This matters for product managers handling workflows that involve customer accounts, authentication, payments, or personal information.

The page should explain three principles.

Sensitive-data protection

Behavioral collection follows masking and data-minimization rules.

Local-first source analysis

Source code stays on the developer's machine by default.

Controlled collaboration

Access to shared evidence follows available account roles and entitlements.

### Media

Use a simple trust-boundary graphic explaining how permitted behavioral evidence moves from a local development environment into Tellann's analysis platform.

- Master: 1600 × 700 px.
- Desktop: 1050 × 450 px.
- Mobile: 720 × 1000 px.
- Format: SVG.
- Animation: 2 seconds, once.

CTA: Explore Desktop Security → `/desktop/security`

# 23. Section 18 — Related product capabilities

Use a 3×2 card grid on desktop, two columns on tablet, and single-column cards on mobile.

| Product capability | Benefit for product teams                  | Destination                    |
| ------------------ | ------------------------------------------ | ------------------------------ |
| Flow Declaration   | Define intended user journeys              | `/product/flow-declaration`    |
| Reconciliation     | Compare expectations and observed behavior | `/product/reconciliation`      |
| Behavior Graphs    | Understand demonstrated paths              | Existing behavior-graphs route |
| Coverage Analysis  | Identify missing validation evidence       | Existing coverage route        |
| QA Reports         | Review findings with the team              | `/product/qa-reports`          |
| Session Replay     | Inspect the recorded interaction sequence  | `/product/session-replay`      |

Each card should have a short description, small SVG icon, and a clear text link.

Recommended card size: 380 × 180 px with 24 px padding.

Use route constants from the existing marketing routing configuration.

# 24. Section 19 — Product Teams FAQs

Can a product manager use Tellann without writing code?

Yes. Product managers can declare intended workflows through the dashboard without installing the desktop agent. Application binding, instrumentation, and guided demonstrations may require developer or QA involvement.

Does Tellann automatically understand my product requirements?

Product teams explicitly define intended workflows. Tellann may suggest additional branches, but suggested states and paths require appropriate user acceptance.

Can Tellann determine whether a feature meets its acceptance criteria?

Tellann can provide behavioral evidence that supports acceptance reviews. It does not replace product judgment or automatically certify that every acceptance criterion has been satisfied.

Can I see the user journeys my application supports?

Tellann can visualize workflows and transitions captured during guided demonstrations.

Does Tellann identify missing product journeys?

It can highlight intended workflows and states that lack supporting evidence and report observed behavior outside the declaration.

Does Tellann analyze live customer funnels?

Continuous production behavioral analytics is outside the Phase 1 MVP. The current focus is guided demonstrations and intent reconciliation.

Can my product team collaborate with engineering?

Yes, through appropriate declaration, reporting, and collaboration workflows, subject to plan entitlements.

Can I use Tellann for MVP acceptance testing?

Yes. An MVP's critical user journeys are a suitable starting point for declaring expectations and reviewing demonstration evidence.

FAQs should be server-rendered and accessible by keyboard.

# 25. Final conversion CTA

FROM PRODUCT VISION TO BEHAVIORAL EVIDENCE

# You know what your product should do. See what it actually demonstrates.

Define your important user journeys, compare them with observed behavior, and bring clearer evidence into product decisions.

Start free&#x20;

Explore the product

Primary CTA: actual signup route.

Secondary CTA: `/product`.

For team plans, include a small tertiary link to `/pricing`, but don't turn the page into an enterprise sales pitch.

# 26. Complete media production inventory

The following is the recommended production checklist.

| ID    | Asset                          | Source dimensions | Page placement        | Priority |
| ----- | ------------------------------ | ----------------- | --------------------- | -------- |
| PT-01 | Hero intended/observed journey | 1600×900          | Hero                  | P0       |
| PT-02 | Product challenges icons       | 96×96 SVG         | Pain points           | P0       |
| PT-03 | Six-stage process diagram      | 1600×540          | How it works          | P0       |
| PT-04 | Declared journey editor        | 1600×1000         | Flow declaration      | P0       |
| PT-05 | Alternative scenario graph     | 1440×900          | Missing scenarios     | P0       |
| PT-06 | Reconciliation comparison      | 1600×1000         | Intent vs observation | P0       |
| PT-07 | Undeclared behavior graph      | 1440×820          | Unexpected behavior   | P0       |
| PT-08 | Acceptance review panel        | 1440×1000         | Acceptance criteria   | P0       |
| PT-09 | Product journey coverage       | 1600×960          | Coverage              | P0       |
| PT-10 | Shared product/QA/dev evidence | 1600×700          | Collaboration         | P1       |
| PT-11 | Reconciliation report          | 1440×1000         | Reports               | P0       |
| PT-12 | Findings detail overlay        | 800×600           | Reports               | P1       |
| PT-13 | Product use-case visuals       | 560×280 each      | Use cases             | P2       |
| PT-14 | Adoption workflow graphic      | 1440×600          | Adoption              | P1       |
| PT-15 | Privacy diagram                | 1600×700          | Trust                 | P1       |
| PT-16 | Main product-team video        | 1920×1080         | Video                 | P1       |
| PT-17 | Video poster                   | 1600×900          | Video                 | P1       |
| PT-18 | Open Graph image               | 1200×630          | Social sharing        | P0       |

### Image production rules

Prefer real, sanitized Tellann screenshots wherever the interface already exists.

Any conceptual screenshot should follow the actual component design system, with no fabricated user statistics, reviews, or deployment claims.

Do not use generic business-team stock photos. The product journey diagrams are the page's most valuable visual assets.

# 27. Animation inventory

| Animation                     | Technology   | Duration | Trigger          |
| ----------------------------- | ------------ | -------- | ---------------- |
| Hero journey comparison       | SVG / Motion | 3.8s     | First load       |
| Pain-point hover              | CSS          | 180ms    | Hover/focus      |
| Process diagram               | SVG          | 1.5s     | Scroll into view |
| Declared journey branching    | React state  | 250ms    | User selection   |
| Missing scenario branches     | SVG          | 3s       | Scroll into view |
| Reconciliation matching       | SVG          | 3s       | Scroll into view |
| Undeclared path reveal        | SVG          | 2.5s     | Scroll into view |
| Acceptance evidence highlight | React state  | 200ms    | Row selection    |
| Coverage selector             | React state  | 250ms    | User selection   |
| Shared-team diagram           | SVG          | 1.5s     | Scroll into view |
| Report reveal                 | CSS          | 700ms    | Scroll into view |
| Role selector                 | React state  | 200ms    | User selection   |
| Adoption diagram              | SVG          | 1.5s     | Scroll into view |

All animations should be nonessential for understanding the page, respect reduced-motion settings, and have static fallbacks.

# 28. SEO implementation

### Metadata

| Field     | Proposed value                                               |
| --------- | ------------------------------------------------------------ |
| Route     | `/solutions/product-teams`                                   |
| SEO title | `User Journey Validation & Product QA for Teams \\| Tellann` |
| H1        | `Know whether your product behaves the way you intended.`    |
| Canonical | `https://tellann.co/solutions/product-teams`                 |
| Robots    | `index, follow` when launched                                |

Meta description:

> Help product teams validate intended user journeys, compare requirements with demonstrated application behavior, discover gaps, and review evidence with Tellann.

### Suggested keyword clusters

Primary:

- User journey validation
- Product QA software
- Product requirements validation
- Workflow validation tools

Secondary:

- Intended vs actual behavior
- Product acceptance testing
- User journey testing
- Product workflow analysis
- Software acceptance criteria
- Behavioral QA platform

These are keyword hypotheses, not measured search-volume findings.

### Schema

Use `WebPage`, `BreadcrumbList`, and `VideoObject` after publishing the video. Add `SoftwareApplication` where appropriate and supported by real product metadata.

### Internal linking

Link to `/solutions`, `/solutions/developers`, `/solutions/qa-engineers`, `/solutions/engineering-leaders`, `/product/flow-declaration`, `/product/reconciliation`, `/product/qa-reports`, `/pricing`, and `/docs`.

# 29. Recommended React/Next.js implementation structure

```
ProductTeamsSolutionPage
│
├── MarketingNavbar
├── ProductTeamsHero
│   └── AnimatedIntentComparison
├── ProductExpectationChallenges
├── ProductTeamsWorkflow
├── FlowDeclarationSection
│   └── InteractiveJourneyPreview
├── MissingScenariosSection
│   └── AlternativePathVisualization
├── ProductReconciliationSection
│   └── IntentVsObservedComparison
├── UndeclaredBehaviorSection
├── AcceptanceReviewSection
├── ProductJourneyCoverage
│   └── JourneyCoverageSelector
├── CrossFunctionalCollaboration
├── ProductReviewReports
├── ProductTeamUseCases
├── ProductRoleSelector
├── ProductTeamsVideo
├── ProductAdoptionWorkflow
├── PrivacySection
├── RelatedProductCapabilities
├── ProductTeamsFAQ
├── ProductTeamsFinalCTA
└── MarketingFooter
```

### Key implementation decisions

Reuse existing functionality: Flow graphs, reconciliation previews, cards, FAQs, and analytics helpers should reuse primitives from the Developers, QA Engineers, and Engineering Leaders pages.

Do not overuse client components: Server-render the copy and links. Only load JavaScript for genuinely interactive diagrams.

Responsive media: Use dedicated mobile compositions for complex graphs. Simply scaling down a 1600 px desktop interface will make labels unreadable.

Evidence integrity: Sample data must always be visibly illustrative and should never look like a verified customer success story.

Performance: Lazy-load below-the-fold screenshots and video players. Preload only the actual hero image or necessary fonts.

Accessibility: Give diagrams text alternatives, use proper tab semantics, and avoid conveying statuses solely through color.

# 30. Analytics and conversion tracking

Recommended event taxonomy:

```
type ProductTeamsMarketingEvent =
  | "PRODUCT_TEAMS_PAGE_VIEWED"
  | "PRODUCT_TEAMS_HERO_CTA_CLICKED"
  | "PRODUCT_TEAMS_JOURNEY_BRANCH_CHANGED"
  | "PRODUCT_TEAMS_RECONCILIATION_VIEW_CHANGED"
  | "PRODUCT_TEAMS_COVERAGE_CHANGED"
  | "PRODUCT_TEAMS_ROLE_SELECTED"
  | "PRODUCT_TEAMS_VIDEO_STARTED"
  | "PRODUCT_TEAMS_VIDEO_COMPLETED"
  | "PRODUCT_TEAMS_FEATURE_LINK_CLICKED"
  | "PRODUCT_TEAMS_SIGNUP_CLICKED"
  | "PRODUCT_TEAMS_SIGNUP_COMPLETED";
```

### Recommended conversion funnel

`Product Teams Page → Signup → First Declared Flow → Workspace Connected → Guided Demonstration → First Reconciliation Report`

For product teams, the first declared user journey is an especially useful activation milestone because declaration can happen before desktop setup.

The first completed reconciliation is the stronger measure of the promised value being realized.

# 31. Implementation priorities

P0 — Launch essentials

Hero, expectation-gap content, workflow, flow declaration, reconciliation, missing scenarios, acceptance evidence, reports, FAQ, final CTA and SEO.

P1 — Strong product proof

Authentic screenshots, coverage interaction, undeclared-behavior example, team collaboration visuals, privacy diagram and main explainer video.

P2 — Interactive polish

Branch selector, reconciliation comparison, role switcher, graph animations and refined mobile media.

P3 — Optimization

Search-intent improvements, messaging tests, CTA experiments, product-team activation analytics and relevant case studies when evidence becomes available.

# 32. Final desktop page composition

```
GLOBAL NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TELLANN FOR PRODUCT TEAMS

Know whether your product behaves
the way you intended.

[ Start with your journey ]
[ See how Tellann works ]

   Intended vs Demonstrated Experience

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE PRODUCT EXPECTATION GAP

4 Problem Cards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM EXPECTATIONS TO EVIDENCE

6-Step Product Team Workflow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFINE YOUR USER JOURNEYS

Text               Interactive Flow Editor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DON'T STOP AT THE HAPPY PATH

Alternate Journey Diagram

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTENDED VS DEMONSTRATED BEHAVIOR

       Reconciliation Comparison

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISCOVER UNEXPECTED PATHS

New Branch          Product Review Question

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCEPTANCE CRITERIA + EVIDENCE

Acceptance Review Interface

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JOURNEY COVERAGE

Coverage Panel       Benefits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALIGN PRODUCT, QA AND ENGINEERING

Shared Evidence Diagram

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REPORTS FOR PRODUCT REVIEWS

Product Report       Supporting Copy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REAL PRODUCT TEAM USE CASES

4 Scenario Cards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALUE BY ROLE

PM | PO | Analyst | Founder

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUCT TEAMS VIDEO

90–110 Second Walkthrough

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

START WITH ONE USER JOURNEY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIVACY AND DATA PROTECTION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RELATED PRODUCT CAPABILITIES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAQ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU KNOW WHAT YOUR PRODUCT SHOULD DO.
SEE WHAT IT ACTUALLY DEMONSTRATES.

[ Start free ] [ Explore product ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GLOBAL FOOTER
```

## Final recommendation

For `/solutions/product-teams`, build the entire narrative around the difference between intention and demonstrated reality.

The three promises should be:

Define: Give product teams a clear way to express the user journeys they expect.

Validate: Compare those expectations against real evidence from guided application demonstrations.

Align: Give product, QA, and engineering teams a shared basis for deciding what needs additional work or validation.

The strongest differentiator on this page is Tellann's Flow Declaration & Reconciliation System. Make the interactive intended-versus-demonstrated comparison the visual centerpiece, supported by practical examples that a product manager can understand without being a software engineer.