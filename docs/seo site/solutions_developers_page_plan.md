# `/solutions/developers` — Complete SEO Marketing Page Specification

TELLANN / SOLUTIONS / DEVELOPERS

# Turn application behavior into something you can actually understand.

A developer-focused landing page covering content, UI components, imagery, animations, videos, interactions, SEO, responsiveness, and implementation requirements.

## 1. Purpose and positioning

The `/solutions/developers` page should explain how Tellann helps software engineers understand, inspect, and validate the behavior of the applications they build.

Unlike `/product`, which explains Tellann's capabilities, this page should speak directly to a developer's daily challenges:

- Understanding what actually happens when users interact with an application.
- Identifying workflows and states that have not been exercised.
- Investigating frontend and backend behavior together.
- Connecting product requirements to real implementation evidence.
- Spending less time manually assembling QA documentation.
- Understanding the consequences of application changes.

The central message should be:

> You already understand your code. Tellann helps you understand what your application actually does.

Tellann's documented Phase 1 workflow is to declare application intent, connect a local workspace, instrument it with appropriate review, demonstrate workflows through the desktop agent, reconcile observed behavior against declared intent, and generate actionable QA reports.

This is the proposition the page should communicate—not autonomous test generation or continuous production monitoring, which belong to later product phases.

## 2. Intended audience

Developers are not one homogeneous audience. Each segment needs a slightly different message.

| Developer class       | Primary concern                          | Tellann value                                           |
| --------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Frontend developers   | UI states, navigation, user interactions | See states and transitions that were observed or missed |
| Backend developers    | API responses, failures, latency         | Connect endpoint activity to demonstrated workflows     |
| Full-stack developers | End-to-end application behavior          | Follow the interaction from UI to backend response      |
| Freelancers           | Delivering reliable client work          | Produce evidence-backed QA reports                      |
| Indie developers      | Limited time and testing resources       | Discover behavioral gaps through guided runs            |
| Technical leads       | Understanding team changes               | Review behavioral evidence and identified workflow gaps |

The page should prioritize frontend, backend, and full-stack developers, then broaden into independent developers and technical leads.

This isn't an enterprise procurement page. It should feel technically credible, concise in its claims, and supported by actual product interfaces.

## 3. Recommended page architecture

```
/solutions/developers
│
├── 01 Global Navbar
├── 02 Developer Hero
├── 03 Developer Pain Points
├── 04 How Tellann Works for Developers
├── 05 Local Workspace & Desktop Agent
├── 06 Behavior Graph & Workflow Discovery
├── 07 Find Missing States and Flows
├── 08 Frontend and Backend Intelligence
├── 09 Session Replay & Debugging
├── 10 Flow Declaration & Reconciliation
├── 11 Developer QA Reports
├── 12 Developer Use Cases
├── 13 Framework Compatibility
├── 14 Privacy & Source Code Protection
├── 15 Developer Demonstration Video
├── 16 Related Product Features
├── 17 Developer FAQs
├── 18 Final Conversion CTA
└── 19 Footer
```

The recommended page length is approximately 8,000–10,000 px on desktop, depending on the final spacing and media treatments.

This is a relatively long landing page, but most visitors should understand the offering from the hero, pain points, and first workflow section alone. The remaining sections provide evidence and search discoverability.

## 4. Visual design direction

The page should inherit Tellann's established monochrome identity, using Satoshi typography, restrained borders, technical diagrams, and realistic product mockups.

Behavior graph

Dark UI · graphite panels · technical diagrams

QA RUN SUMMARY

Checkout validation

Observed states

12

Unobserved paths

3

Light UI · readable reports · high contrast

Use darker sections for behavioral graphs and desktop-agent visuals, with occasional lighter sections for reports and explanatory content. The contrast creates rhythm without introducing unrelated branding.

### Layout standards

| Property            | Desktop      | Tablet    | Mobile       |
| ------------------- | ------------ | --------- | ------------ |
| Main container      | 1200–1280 px | 90% width | 100% − 32 px |
| Hero H1             | 64–72 px     | 48–56 px  | 36–42 px     |
| Section H2          | 44–56 px     | 36–44 px  | 30–36 px     |
| Body                | 17–19 px     | 16–18 px  | 16 px        |
| Section spacing     | 112–144 px   | 80–96 px  | 64–80 px     |
| Split sections      | 45/55        | 45/55     | Stacked      |
| Image corner radius | 12–16 px     | 12 px     | 10–12 px     |

All dimensions below are recommended design targets, not restrictions on device sizes.

# 5. Section 01 — Developer hero

SECTION HEIGHT: APPROX. 820–980 PX DESKTOP

The hero must communicate the developer benefit before mentioning SDKs, graph engines, or event processing.

### Content

Eyebrow: `TELLANN FOR DEVELOPERS`

H1:

> Understand what your application actually does.

Supporting copy:

> Your code describes how an application is built. Tellann helps you see how it behaves. Demonstrate real workflows, discover application states, inspect API activity, and uncover quality gaps before they go unnoticed.

Primary CTA: `Start building with Tellann →` Destination: existing signup/onboarding route.

Secondary CTA: `Watch a demonstration` Action: opens or scrolls to the developer demonstration video.

Below the CTAs, display a short capability strip:

`Guided QA runs` · `Workflow discovery` · `Missing paths` · `Evidence-backed reports`

Avoid decorative fake usage statistics such as “10,000 developers trust Tellann” without verified evidence.

### Hero layout

TELLANN FOR DEVELOPERS

# Understand what your application actually does.

Demonstrate workflows. Discover behavior. Find the gaps.

Start free&#x20;

Watch demo&#x20;

Checkout workflow — Example run

Observed vs Intended

Illustrative layout for the hero product visualization

### Hero media specifications

| Property             | Specification                                    |
| -------------------- | ------------------------------------------------ |
| Media type           | Interactive React/SVG or prerendered UI sequence |
| Source design canvas | 1600 × 800 px                                    |
| Desktop display      | 1180 × 560 px                                    |
| Tablet display       | 100% width, max 520 px height                    |
| Mobile display       | 100% width, approximately 350–450 px height      |
| Placement            | Below centered hero headline and CTAs            |
| Poster image         | 1600 × 800 WebP/AVIF                             |
| Aspect ratio         | Approx. 2:1 desktop                              |

### Hero animation

The animated graph should tell a story in approximately four seconds.

| Time     | Action                                            |
| -------- | ------------------------------------------------- |
| 0.0–0.6s | Workspace panel appears                           |
| 0.6–1.5s | Product, cart, checkout and payment states appear |
| 1.5–2.2s | Observed transitions connect                      |
| 2.2–2.8s | Intended retry path appears as a dashed branch    |
| 2.8–3.5s | “Not observed” label is revealed                  |
| 3.5–4.0s | QA finding card fades in                          |

Afterward, freeze the finished state. Do not continuously loop the sequence.

Important: Missing evidence should not automatically be represented as a confirmed defect. The interface should distinguish a path that was not observed from a proven implementation failure.

# 6. Section 02 — Developer pain points

### Heading

> You can read the code. But can you see every path it takes?

Supporting:

> Modern applications span components, routes, APIs and states. Understanding one function is easy. Understanding the complete behavior of an application is harder.

Use four benefit-oriented cards.

Scattered workflow logic

A single user journey can cross components, routes and backend services.

Unexplored edge cases

Loading, empty, failed and recovery states can escape routine testing.

Hard-to-reconstruct behavior

Investigating a defect often starts with incomplete steps and missing context.

Fragmented QA evidence

Logs, screenshots, test results and product requirements rarely tell one coherent story.

### Interaction

On hover, the border brightens and a short outcome line appears, such as “Tellann maps demonstrated transitions.”

On mobile, cards stack vertically. Avoid hover-dependent explanations.

No video is needed in this section. Keep it text-forward and immediately scannable.

# 7. Section 03 — How Tellann works for developers

### Heading

> From your local project to an evidence-backed QA report.

This section should clarify that Tellann is not a website-only recording tool. The desktop agent handles the local workspace and guided browser demonstration.

01

Declare

Define intended workflows

02

Bind

Connect a local project

03

Instrument

Review the proposed changes

04

Demonstrate

Walk through the application

05

Reconcile

Compare intent and evidence

06

Report

Inspect coverage and gaps

The detailed content beneath should explain:

Declare: Create the intended workflows, such as registration, login, checkout, and password reset. This can be done through the dashboard or desktop agent.

Bind: Download Tellann Desktop, authenticate, and select or clone a local repository.

Instrument: Inspect any proposed instrumentation modifications and approve them before they are applied. Manual instrumentation remains an alternative where automated assistance is not included in the plan.

Demonstrate: Use the managed browser to perform a realistic workflow.

Reconcile: Tellann evaluates recorded evidence against the declared workflow.

Report: Inspect observed states, missing paths, endpoint findings, replay timelines, and quality reports.

### Media specification

Use an interactive horizontal timeline on desktop with six connected stages.

- Canvas: 1200 × 300 px.
- Node width: approximately 170 px.
- Gap: 24 px.
- Connector: thin monochrome line.
- Animation: 1.5 seconds, once on first viewport entry.
- Mobile: vertical six-step timeline.

Each step can show a small preview thumbnail when selected, making this section interactive without forcing the visitor to watch a video.

# 8. Section 04 — Connect your local workspace

### Eyebrow

`LOCAL-FIRST DEVELOPMENT`

### Heading

> Work with your real codebase. Keep control of your working tree.

Supporting:

> Tellann Desktop connects to your project, helps locate workflow checkpoints, and supports controlled instrumentation. Proposed source changes are reviewable and reversible.

The product specification includes local codebase analysis, repository snapshots, code graph exploration, instrumentation planning, diff review, validation, and rollback. Availability and depth differ by plan.

## Recommended visual

[Visual direction reference for Tellann's desktop workspace and instrumentation review section](https://images.openai.com/static-rsc-4/KeF8ezWvPtcvHhOXAasMVmICh7xbB1sLvynEmUGvGtE03WP1TMsvIrgXaXebkwpW2CIKYXubStnuKwKC2mpMCGzwzdcUJs52x_hURJPpzoem7VcNZpMojoAsBkgeNqQ9XCnM7bW7QZZXsmBVKjjJtoNoBUMApoI1jllLuHasPjw?purpose=inline)

[canopy.itsol.tech](https://canopy.itsol.tech/features/code-review)

Visual reference only. The final website should use a Tellann-specific mockup or a genuine sanitized screenshot.

The actual asset should show the following interface structure:

```
┌──────────────────────────────────────────┐
│ Tellann Desktop                          │
├───────────┬──────────────────────────────┤
│           │                              │
│ Workspace │  Project: commerce-web       │
│ Intent    │  Branch: tellann/qa-checkout │
│ Runs      │                              │
│ Reports   │  Instrumentation proposal    │
│           │                              │
│           │  src/app/checkout/...        │
│           │  + workflow checkpoint      │
│           │  + transition event         │
│           │                              │
│           │ [Review diff] [Approve]      │
└───────────┴──────────────────────────────┘
```

### Asset specifications

| Element                | Dimensions    | Notes                                 |
| ---------------------- | ------------- | ------------------------------------- |
| Primary desktop mockup | 1440 × 900 px | Master screenshot                     |
| Displayed screenshot   | 680 × 500 px  | Right side of split layout            |
| Smaller diff panel     | 560 × 300 px  | Floating panel over lower-left edge   |
| Mobile screenshot crop | 720 × 900 px  | Focus on workspace and approval panel |
| Section height         | 680–780 px    | Desktop                               |

Animation: Start with a workspace selection, reveal the code analysis, and show a proposed instrumentation diff. Do not show the application silently modifying source code without approval.

CTA: Explore Tellann Desktop → `/desktop`

# 9. Section 05 — Behavioral graphs and workflow discovery

### Heading

> Stop imagining the workflow. See the path your application took.

Supporting:

> Tellann transforms recorded interactions into states, actions, transitions and workflows, creating a visual model of application behavior.

This should be the page's strongest technical visualization after the hero.

### What developers should learn

A developer should understand how a checkout workflow moves through the application and where alternate states branch away.

Example: Checkout behavior graph

Illustrative data

### Animation requirements

The graph should construct itself progressively:

1. The initial state appears.
2. Observed transitions draw from left to right.
3. Alternative branches appear.
4. Unobserved intended branches display with a dashed outline.
5. A finding panel identifies the evidence gap.

Media source: preferably SVG/React Flow or another graph visualization already used by Tellann.

Canvas dimensions: 1400 × 720 px. Display at 680 × 480 px within the split section, with a full-width graph on smaller tablets if needed.

CTA: Explore Behavior Graphs → `/product/behavior-graphs` (confirm the exact route in the existing routing plan).

# 10. Section 06 — Find missing states and workflows

RECOMMENDED SECTION HEIGHT: 680–760 PX

### Eyebrow

`UNCOVER THE UNTESTED`

### Heading

> The bugs you haven't encountered deserve attention too.

Supporting:

> Happy-path demonstrations tell only part of the story. Tellann helps identify expected application states and workflow paths that have not yet been observed.

This should be differentiated from the previous graph section. There, the developer discovers what happened. Here, they discover what needs further investigation.

### Interactive before-and-after visual

Checkout workflow

Basic walkthroughTellann findings

Cart

Checkout

Success

Paths requiring further validation

Payment failure

Expected failure state not observed

Retry payment

Recovery path not demonstrated

Session timeout

Session-expiry behavior not exercised

Illustrative experience showing the distinction between completed walkthroughs and unobserved scenarios.

### Implementation requirements

The final mockup should distinguish between:

- Observed: A path supported by captured evidence.
- Not observed: An intended path without supporting demonstration evidence.
- Potential missing state: A suspected loading, empty, error or recovery state requiring verification.
- Undeclared: Behavior observed but not represented in the declared flow.

Do not present all unobserved paths as confirmed software defects.

### Media

| Property           | Value                     |
| ------------------ | ------------------------- |
| Primary mockup     | 1440 × 900 px             |
| Desktop rendered   | 700 × 500 px              |
| Mobile visual      | 720 × 960 px              |
| Animation duration | 600–900 ms per transition |
| Implementation     | Interactive HTML/CSS/SVG  |

CTA: Explore Coverage Analysis → to the established coverage-analysis product route.

# 11. Section 07 — Frontend and backend intelligence

### Heading

> Understand both sides of the interaction.

A developer sees a user click a button. But the button may initiate an API request, trigger a database-backed operation, return a response, and update the UI.

Tellann helps correlate the frontend and backend evidence captured during a demonstration.

The Phase 1 specification includes JavaScript/TypeScript and React/Next.js frontend capture, plus Node.js integrations for Express, Fastify and NestJS. Endpoint metadata, response duration and error information are part of the supported analysis.

### Visual

One action. Connected evidence.

Example trace

FRONTEND

User selects Checkout

UI event · BUTTON_CLICK

Correlated request

BACKEND

POST /api/checkout

240 ms

HTTP 200 · Request completed

RESULT

Checkout state updated

Observed transition · CHECKOUT → ORDER_COMPLETE

### Media specifications

- Master visual: 1400 × 900 px.
- Desktop render: 680 × 520 px.
- Mobile render: stacked flow diagram, minimum 320 px wide.
- Animation: button click, request transmission, response, UI state update.
- Total sequence: 3–4 seconds, then static.
- Each step should be visible and readable without playback.

### Copy beneath

Use three short value propositions:

Connect user actions to API activity. Understand which requests were associated with a demonstrated workflow.

Inspect response behavior. Review captured response times, error outcomes and endpoint evidence.

Investigate with context. Move from an application interaction to the supporting recorded technical activity.

Avoid claiming full distributed tracing or universal backend support.

CTA: Explore Endpoint Intelligence → `/product/endpoint-intelligence`

# 12. Section 08 — Session replay and investigation

### Heading

> Stop relying on incomplete descriptions of what happened.

Supporting:

> Reconstruct the sequence of recorded interactions, inspect transitions and associated events, and understand the context around a demonstrated workflow.

A crucial technical distinction: Tellann's session replay is a behavioral reconstruction from captured events, not necessarily a literal video recording of the user's screen.

The marketing visual must reflect that accurately.

### Recommended screenshot

[Reference for Tellann's session replay interface, including an event timeline and application view](https://images.openai.com/static-rsc-4/7M7m6ZLY8OyRr1xDRkz2GkpDNpaFcH9mMHofsCy2eC_GaKeWkoNZ6pGY361YKHwzFFUIwdY6AVD-yWDm50uKiWY5sYh8nk5N4OAZebpaklvdQJX7tSCkE_aeRgbCexcLaz6zLPwb84fsuaXlSPHwMGxgENH2akldYu52mFV5q3g?purpose=inline)

[docs.newrelic.com](https://docs.newrelic.com/es/whats-new/2024/07/whats-new-07-10-dem/)

Design reference. Use an authentic Tellann session replay view for the production website.

### Layout

The split section should show text on the left and a replay interface on the right.

The screenshot should include a reconstructed application view where supported, a timeline, an event list and inspection details.

```
┌────────────────────────────────────────────┐
│ Session Replay: Checkout Demonstration     │
├─────────────────────────┬──────────────────┤
│ Application / State     │ Events           │
│                         │ 00:01 Page view  │
│ Checkout                │ 00:03 Click      │
│                         │ 00:04 API call   │
│                         │ 00:05 Response   │
├─────────────────────────┴──────────────────┤
│ ▶ ━━━━━━━━━●━━━━━━━━━━━━ 00:05 / 00:22     │
└────────────────────────────────────────────┘
```

### Dimensions

| Asset                  | Dimensions     |
| ---------------------- | -------------- |
| Source screenshot      | 1600 × 1000 px |
| Desktop rendering      | 700 × 480 px   |
| Mobile simplified view | 720 × 1050 px  |
| Optional replay clip   | 1920 × 1080 px |
| Loop duration          | 8–12 seconds   |

### Animation

An optional silent loop can show a playhead moving through navigation, interaction and API events. Provide pause/play controls.

Do not fabricate actual replay fidelity. If a feature only reconstructs state and event timelines, the visual should not imply high-fidelity video capture.

CTA: Explore Session Replay → `/product/session-replay`

# 13. Section 09 — Flow declaration and reconciliation

This is the strongest differentiator on the developers page.

### Heading

> Your application should do one thing. Does the evidence agree?

Supporting:

> Declare expected workflows, demonstrate your application, and compare what was intended against what was actually observed.

### Interactive visual

Checkout workflow

Compare graphsReview findings

DECLARED INTENT

Checkout

Payment success

Payment failure

Retry payment

OBSERVED

Checkout

Payment success

Payment failure

Retry not observed

Illustrative reconciliation model; actual findings depend on declared flow rules and recorded evidence.

The canonical reconciliation classifications are Confirmed, True Gap and Undeclared. A “true gap” should only be shown when the reconciliation rules justify that conclusion, rather than assuming every absence from a single run is defective.

### Media dimensions

- Source: 1600 × 1000 px.
- Desktop display: 720 × 520 px.
- Mobile: vertically stacked graphs, 720 × 1100 px equivalent.
- Recommended animation: matching nodes join, mismatches become visible, and the findings summary enters.
- Animation duration: 2.5–3.5 seconds.

CTA links: `/product/flow-declaration` and `/product/reconciliation`.

# 14. Section 10 — Developer QA reports

### Heading

> Turn a walkthrough into evidence you can share.

Supporting:

> Tellann transforms a completed demonstration into structured reporting that helps you understand the observed behavior, coverage gaps and findings worth investigating.

The screenshot should look like a real generated QA report, not a general-purpose admin dashboard.

EXAMPLE REPORT

Commerce Application — QA Run

## 76%

Coverage

## 14

Workflows

## 3

Unobserved paths

Findings requiring review

Checkout retry

Not observed

Empty cart state

Requires verification

Payment API

Response time finding

All figures are illustrative rather than actual Tellann measurements.

### Report benefits by developer class

Full-stack developers: Share an end-to-end view of a workflow.

Freelancers: Include a QA report as part of project delivery.

Technical leads: Review evidence and gaps with the team.

Indie founders: Keep a record of demonstrated functionality as the application evolves.

### Visual specification

- Report mockup master: 1440 × 1000 px.
- Display: 680 × 500 px.
- Optional floating export card: 320 × 180 px.
- Mobile: one-column summary, 720 × 1000 px.
- Animation: metrics reveal once, followed by findings rows.
- No fake composite “application quality score.”

CTA: Explore QA Reports → `/product/qa-reports`

# 15. Section 11 — Real developer use cases

This section should answer a common developer question:

> “When would I actually use Tellann?”

Use scenario-driven cards, not more feature lists.

## Where Tellann fits into your workflow

Before shipping a feature

Demonstrate the new workflow and examine what the run covered—and what still needs checking.

A clearer picture of feature coverage.

When reviewing a complex workflow

Visualize the states and transitions recorded during a real demonstration.

Less guesswork when discussing behavior.

When investigating a failed path

Inspect the replay timeline and endpoint evidence associated with the demonstrated scenario.

More context for debugging.

When delivering client software

Generate a structured QA report to document observed behavior and outstanding gaps.

Shareable evidence of validation work.

For the first version, keep these cards static with subtle hover treatments.

If interactive cards are introduced later, each should link to a genuine use-case example or corresponding product page.

# 16. Section 12 — Framework compatibility

### Heading

> Built around the technologies you already use.

This section should reassure developers that Tellann fits into recognizable development workflows.

The currently specified Phase 1 integrations include JavaScript, TypeScript, React, Next.js, Node.js, Express, Fastify and NestJS.

## JS

JavaScript

## TS

TypeScript

## ⚛

React

## N

Next.js

## ⬡

Node.js

## Ex

Express

## Ns

NestJS

## F

Fastify

Use official framework logos in production where licensing permits, rather than the typographic placeholders above.

### Technical placement

- Section height: 360–440 px.
- Logo SVG size: 48 × 48 px.
- Logo container: 72 × 72 px.
- Desktop: eight-column logo grid or two rows of four.
- Mobile: four columns, two rows.

Link to `/docs` and SDK documentation. Supported integration claims should be verified against published SDK packages and their actual release status before the website goes live.

# 17. Section 13 — Source code and privacy

### Heading

> Your source code belongs on your machine.

Supporting:

> Tellann's desktop agent analyzes your workspace locally by default. Source code is not transmitted without explicit consent, while behavioral evidence and permitted derived information support the platform's analysis.

This matters especially for professional developers working with proprietary repositories.

### Visual

```
YOUR DEVELOPMENT MACHINE           TELLANN CLOUD
────────────────────────           ──────────────

Local repository
      │
      ▼
Tellann Desktop
      │
      ├── Codebase analysis
      ├── Workflow checkpoints
      ├── Reviewed instrumentation
      └── Guided browser run
                 │
                 │ permitted evidence
                 └──────────────────────▶
                                        Behavior graph
                                        Coverage
                                        Reconciliation
                                        QA reports
```

The visual must not suggest that all data stays locally. It should accurately distinguish source code from captured evidence, derived projections and consent-based uploads.

### Asset specifications

| Property         | Specification                          |
| ---------------- | -------------------------------------- |
| Master graphic   | 1600 × 760 px                          |
| Rendered desktop | 1080 × 510 px                          |
| Mobile format    | Vertical SVG, 720 × 1100 px            |
| Animation        | Evidence travels across trust boundary |
| Duration         | 2.5 seconds                            |
| Asset type       | SVG/React                              |

CTA: Explore Desktop Security → `/desktop/security`

# 18. Section 14 — Developer demonstration video

This is the most important video on the page. I would produce one substantial video rather than several small, redundant clips.

[Creative reference for a developer-focused Tellann product demonstration video poster](https://images.openai.com/static-rsc-4/10M9-OIlMmEZR6Nbxcgwp1wJ9xYCSF5qjJA_VAmbpi3w-nS3kNVHJAwjjoRHgvjyymrlOBsYXTaBxRVLgboTt3FKXzgkQv8eWyjZM7G_HHgwecuwTaQyUSBF88Kze4GdLL2bYQ4nPfw6Wac_nQ0ZNmDVlYWmF6ESqndjNWvsl1E?purpose=inline)

[betterlytics.io](https://betterlytics.io/docs/dashboard/session-replay)

Creative direction for the video poster. Replace with genuine Tellann interfaces before publishing.

### Recommended title

From codebase to QA report: Tellann for Developers

### Video specifications

| Property          | Recommendation                       |
| ----------------- | ------------------------------------ |
| Master resolution | 1920 × 1080 px                       |
| Aspect ratio      | 16:9                                 |
| Duration          | 90–120 seconds                       |
| Desktop playback  | 960 × 540 px                         |
| Mobile playback   | Full width, 16:9                     |
| Poster            | 1600 × 900 px                        |
| Export            | MP4 H.264 + WebM                     |
| Captions          | VTT                                  |
| Narration         | Professional, technically grounded   |
| Sound             | Optional low-volume background audio |

### Storyboard

| Time     | Scene             | Visual                                          |
| -------- | ----------------- | ----------------------------------------------- |
| 0–12s    | Why it matters    | An application with several connected workflows |
| 12–28s   | Connect workspace | Tellann Desktop opens a repository              |
| 28–44s   | Define intent     | Checkout flow is declared                       |
| 44–60s   | Instrument        | Developer reviews and approves a proposed diff  |
| 60–78s   | Demonstrate       | Developer completes a checkout walkthrough      |
| 78–92s   | Understand        | Behavior graph builds from recorded evidence    |
| 92–106s  | Discover gaps     | Retry-payment path appears as not observed      |
| 106–120s | Get results       | QA report and final CTA                         |

Use genuine application footage wherever possible.

A generic motion-graphics video may look attractive, but developers will trust a real working interface considerably more.

### Interaction

- Click-to-play by default.
- No autoplay with sound.
- Show captions.
- Provide playback speed and fullscreen where supported.
- The video must be supplemental; all essential content should also exist as crawlable page text.

# 19. Section 15 — Related product capabilities

This is where developers interested in a particular capability can move deeper into the site.

CONTINUE EXPLORING

## Explore the tools behind the workflow.

Developer Demonstration

/product/developer-demonstration

Behavior Graphs

/product/behavior-graphs

Coverage Analysis

/product/coverage-analysis

Session Replay

/product/session-replay

Endpoint Intelligence

/product/endpoint-intelligence

QA Reports

/product/qa-reports

Route names are suggested cross-links; reconcile them with the existing marketing routing plan before implementation.

Each card should be a real link, not a static display in the implemented page. Use conventional accessible anchors so crawlers and keyboard users can navigate them.

# 20. Section 16 — Developer FAQs

Recommended questions and answers:

Do I need to rewrite my application to use Tellann?

No wholesale rewrite is intended. The desktop agent works with a bound local workspace and supports instrumentation planning. Depending on the plan and application, developers may review assisted instrumentation or add instrumentation manually.

Does Tellann automatically write all my tests?

No. The Phase 1 product focuses on guided demonstrations, behavioral modeling, coverage analysis and reconciliation, rather than autonomous test generation.

Can I use Tellann with React and Next.js?

Those are among the documented frontend integration targets. Confirm the availability of specific SDK versions in the documentation.

Does Tellann inspect backend endpoints?

Yes, when the applicable backend instrumentation is configured and the relevant evidence is captured during the run.

Can I run demonstrations without production traffic?

Yes. This is a central purpose of Developer Demonstration Mode.

What happens if Tellann cannot observe an expected workflow?

It can identify an evidence gap relative to declared intent. Further investigation may determine whether the path is untested, unavailable or incorrectly implemented.

Does Tellann send my source code to the cloud?

Source files remain local by default. The product may transmit derived projections and captured behavioral evidence, with separate consent for raw-source uploads.

Is Tellann free for individual developers?

The pricing specifications define a Free plan and paid options. Link to `/pricing` for current entitlements and limits.

Use an accessible accordion (`button`, `aria-expanded`, associated content). Keep FAQ text in server-rendered HTML. Do not rely on FAQ rich results appearing in Google Search.

# 21. Final conversion CTA

BUILD WITH MORE CONFIDENCE

# Your code tells one story. See what your application actually does.

Connect a workspace, demonstrate a workflow, and turn recorded behavior into actionable QA evidence.

Start free&#x20;

View documentation

Primary CTA should open the actual signup flow. Secondary CTA should lead to `/docs`.

If the current onboarding offers the documented 14-day trial, any trial messaging must accurately explain the payment authorization and automatic conversion terms. Do not imply a paid-plan trial requires no card when it does.

# 22. Complete image and video production inventory

This is the asset checklist I would hand to a designer or motion-graphics editor.

| ID     | Asset                       | Source size | Placement               | Priority  |
| ------ | --------------------------- | ----------- | ----------------------- | --------- |
| DEV-01 | Hero behavior graph         | 1600×800    | Hero, below CTA         | Essential |
| DEV-02 | Desktop workspace mockup    | 1440×900    | Local workspace section | Essential |
| DEV-03 | Instrumentation diff panel  | 1120×600    | Overlay on workspace    | Essential |
| DEV-04 | Workflow graph              | 1400×720    | Behavior graph section  | Essential |
| DEV-05 | Missing-path analysis       | 1440×900    | Coverage section        | Essential |
| DEV-06 | Frontend/backend flow       | 1400×900    | Endpoint section        | Essential |
| DEV-07 | Session replay mockup       | 1600×1000   | Session replay section  | Essential |
| DEV-08 | Reconciliation comparison   | 1600×1000   | Intent section          | Essential |
| DEV-09 | QA report mockup            | 1440×1000   | Reporting section       | Essential |
| DEV-10 | Source-code privacy diagram | 1600×760    | Security section        | Essential |
| DEV-11 | Developer video             | 1920×1080   | Demonstration section   | High      |
| DEV-12 | Video poster                | 1600×900    | Video cover             | High      |
| DEV-13 | Social sharing image        | 1200×630    | Open Graph              | Essential |

For the product mockups, capture genuine Tellann screens where possible. If the UI is not finalized, use clearly illustrative mockups matching the actual specification. Never fabricate customer results or present proposed interfaces as deployed features.

## Animation inventory

| Animation                   | Technology   | Duration | Trigger          |
| --------------------------- | ------------ | -------- | ---------------- |
| Hero graph assembly         | SVG / Motion | 4s       | Page load        |
| Pain-point card hover       | CSS          | 180ms    | Hover/focus      |
| Six-step workflow           | CSS / Motion | 1.5s     | Scroll into view |
| Instrumentation approval    | Motion       | 3s       | Scroll into view |
| Graph node construction     | SVG          | 3s       | Scroll into view |
| Missing-path comparison     | React state  | 400ms    | Tab interaction  |
| Frontend/backend connection | SVG          | 3s       | Scroll into view |
| Replay playhead             | Video/CSS    | 8–12s    | User play        |
| Reconciliation comparison   | React state  | 400ms    | Tab interaction  |
| QA report reveal            | CSS          | 600ms    | Scroll into view |
| Privacy data movement       | SVG          | 2.5s     | Scroll into view |

Every scroll animation must respect `prefers-reduced-motion`. Avoid heavy animations during page hydration or before the Largest Contentful Paint element has settled.

# 23. SEO implementation

### Recommended metadata

Title

`Behavioral QA & Workflow Intelligence for Developers | Tellann`

Meta description

`Understand how your application behaves with Tellann. Discover workflows, inspect frontend and backend activity, identify missing paths, and generate QA reports from guided demonstrations.`

Canonical

`https://tellann.co/solutions/developers`

H1

`Understand what your application actually does.`

### Keyword strategy

Primary keyword cluster:

- Behavioral QA for developers
- Software workflow analysis
- Application behavior analysis
- Developer QA tools

Secondary keyword cluster:

- Workflow coverage analysis
- Missing state detection
- Frontend and backend debugging
- Application behavior graphs
- Guided QA testing
- Session replay for developers

These are candidate keyword themes, not verified search-volume rankings. Validate competition and intent through keyword research before treating them as traffic priorities.

### Structured data

Implement `WebPage`, `BreadcrumbList`, `SoftwareApplication` where appropriate, and `VideoObject` once the video is published.

Breadcrumb:

```
Home → Solutions → Developers
```

### Internal linking

The page should link to `/solutions`, `/desktop`, `/desktop/security`, `/pricing`, `/docs`, `/roadmap`, and relevant `/product/*` feature pages.

Avoid placing every keyword in anchor text; links should remain natural and descriptive.

# 24. Technical implementation requirements

### Recommended React/Next.js component structure

```
DevelopersSolutionPage
│
├── MarketingNavbar
├── DevelopersHero
│   └── AnimatedBehaviorGraph
├── DeveloperPainPoints
├── DeveloperWorkflow
├── LocalWorkspaceSection
│   └── InstrumentationPreview
├── BehaviorGraphSection
├── MissingPathsSection
│   └── InteractiveCoverageExample
├── FullStackIntelligenceSection
├── SessionReplaySection
├── ReconciliationSection
│   └── InteractiveGraphComparison
├── QAReportsSection
├── DeveloperUseCases
├── FrameworkCompatibility
├── SourcePrivacySection
├── DeveloperVideo
├── RelatedProductLinks
├── DeveloperFAQ
├── DeveloperCTA
└── MarketingFooter
```

### Performance

- Server-render essential page copy and navigation.
- Prefer SVG and lightweight HTML for simple diagrams.
- Dynamically load complex graph interaction only where necessary.
- Lazy-load below-the-fold screenshots and video players.
- Provide fixed media aspect ratios to prevent layout shift.
- Use AVIF/WebP responsive `srcset` images.
- Do not autoplay several videos simultaneously.
- Ensure mobile media has independently designed crops where desktop screenshots become unreadable.

Targets should include good Core Web Vitals, especially LCP and CLS, measured on real devices rather than assumed from desktop Lighthouse results.

### Accessibility

All diagrams need meaningful text alternatives. Interactive comparison tabs must support keyboard navigation, and animated content must offer reduced-motion treatment. Maintain sufficient contrast across both dark and light UI surfaces.

# 25. Marketing analytics

Track engagement by meaningful action rather than just section exposure.

```
type DeveloperMarketingEvent =
  | "DEVELOPERS_PAGE_VIEWED"
  | "DEVELOPERS_HERO_CTA_CLICKED"
  | "DEVELOPERS_VIDEO_STARTED"
  | "DEVELOPERS_VIDEO_COMPLETED"
  | "DEVELOPERS_WORKFLOW_STEP_SELECTED"
  | "DEVELOPERS_COVERAGE_COMPARISON_CHANGED"
  | "DEVELOPERS_RECONCILIATION_VIEW_CHANGED"
  | "DEVELOPERS_PRODUCT_LINK_CLICKED"
  | "DEVELOPERS_DOCS_CLICKED"
  | "DEVELOPERS_SIGNUP_CLICKED"
  | "DEVELOPERS_SIGNUP_COMPLETED";
```

Capture anonymous marketing event context such as:

```
interface MarketingEventContext {
  page: "/solutions/developers";
  section?: string;
  destination?: string;
  referrer?: string;
  deviceCategory?: "desktop" | "tablet" | "mobile";
  experimentId?: string;
}
```

Do not include source code, secrets or sensitive form data in marketing analytics.

Primary conversion metrics should be signup completion, desktop download, and the percentage of visitors who reach their first successful demonstration run.

# 26. Implementation priorities

Launch checklist

P0 — Launch essentials

Hero, developer pain points, workflow, workspace visual, behavior graphs, missing paths, reconciliation, QA reports, CTA, metadata and FAQ.

P1 — Product proof

Authentic screenshots, frontend/backend trace visual, session replay, privacy diagram, framework compatibility, use-case cards and stronger cross-links.

P2 — Rich interactions

Interactive graph comparisons, guided workflow animations, polished desktop sequence and the 90–120 second developer demonstration video.

P3 — Optimization

Persona-specific landing-page experiments, video engagement analysis, search-performance optimization and A/B testing of hero copy.

## Final recommendation

The developers page should center on three promises:

Understand behavior. See how the application moved through real workflows and states.

Discover gaps. Find intended paths and important states that weren't adequately demonstrated.

Work with evidence. Move from a guided run to replay, reconciliation, endpoint analysis and QA reporting.

Everything else—SDK support, privacy, desktop integration, video and documentation—should reinforce those three promises.

The strongest developer marketing is not a dramatic claim that Tellann will replace debugging, testing or QA. It is the quieter, more credible proposition that Tellann makes demonstrated software behavior visible, explainable and useful.