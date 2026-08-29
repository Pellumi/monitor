# `/product` — Tellann Product Overview Page Specification

`/product` should be the **canonical explanation of what Tellann is, how it works, and why its approach to software quality is different**.

It should not behave like a conventional feature catalogue. The visitor should leave with one mental model:

> **Tellann observes an application being used, reconstructs its behavior, turns that behavior into workflows, measures what was covered or missed, and gives engineering teams evidence about software quality.**

That is directly aligned with the PRD's product philosophy and the MVP hypothesis that software behavior can be observed, modeled, and analyzed automatically.  

---

# 1. Primary purpose of `/product`

The page needs to answer six questions in sequence:

```text
What is Tellann?
        ↓
What does it observe?
        ↓
How does it understand behavior?
        ↓
What does it produce?
        ↓
How does that help my team?
        ↓
How do I start?
```

For the MVP, the product flow is:

```text
Connect Application
        ↓
Install SDK
        ↓
Start Demonstration
        ↓
Use Application Normally
        ↓
Tellann Captures Behavior
        ↓
Build Session
        ↓
Discover States + Workflows
        ↓
Generate Behavior Graph
        ↓
Measure Coverage
        ↓
Find Missing States / Flows
        ↓
Analyze Endpoints
        ↓
Generate QA Report
```

That mirrors the documented Developer Demonstration and MVP lifecycle.  

---

# 2. Recommended page architecture

```text
/product
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Product Intelligence Pipeline
├── 04 Interactive Product Overview
├── 05 Developer Demonstration Mode
├── 06 Behavior Graph
├── 07 Workflow Discovery
├── 08 Coverage & Quality Gaps
├── 09 Session Replay
├── 10 Endpoint Intelligence
├── 11 QA Reports
├── 12 Everything Connected
├── 13 Who Tellann Is For
├── 14 Privacy by Design
├── 15 Product Evolution
├── 16 Product CTA
└── 17 Footer
```

The page should be long enough to explain the product, but each section must move the story forward.

---

# 3. Section 01 — Navigation

Use the same global navbar defined for the rest of the public site.

The Product item should appear active.

Desktop:

```text
Tellann

Product        Solutions        Developers
Resources      Company          Pricing

                       Sign in    Start free
```

If Product remains a mega-menu, `/product` is the **Overview** destination.

Example:

```text
PRODUCT

Overview               /product
Developer Demonstration
Behavior Graphs
Session Replay
Coverage Analysis
Endpoint Intelligence
QA Reports
```

You do not necessarily need separate public routes for every capability immediately. The links can initially resolve to anchors such as:

```text
/product#demonstration
/product#behavior-graph
/product#coverage
```

and later graduate into dedicated SEO pages.

---

# 4. Section 02 — Hero

This is the most important part of the page.

## Eyebrow

```text
BEHAVIORAL QUALITY INTELLIGENCE
```

## H1

I would use:

> **See how your software actually behaves.**

Alternative:

> **Turn application behavior into quality intelligence.**

The first is emotionally stronger.

## Supporting copy

Something along these lines:

> Connect Tellann, demonstrate the workflows that matter, and turn observed application behavior into workflows, coverage analysis, missing states, session replays, endpoint insights, and actionable QA reports.

This remains entirely within the defined MVP. 

## CTAs

Primary:

```text
[ Start for free ]
```

Secondary:

```text
[ See how it works → ]
```

Secondary scrolls to the product pipeline.

Below:

```text
No production traffic required
No manually modeled workflows
Privacy controls enabled by default
```

The "no production traffic" and "no manual workflow modeling" claims are supported by the MVP success criteria. 

---

# 5. Hero media — main product video

This should be the strongest visual asset on `/product`.

Do **not** use an abstract AI animation here.

Show Tellann itself.

## Content

A seamless sequence showing:

```text
1. Developer opens Tellann
2. Starts demonstration
3. Interacts with sample application
4. Tellann captures events
5. Session finishes
6. Processing animation
7. Behavior Graph appears
8. Checkout workflow selected
9. Coverage = 72%
10. Missing flow: PAYMENT_FAILURE
11. Session Replay opened
12. QA report summary appears
```

This tells the whole product story without explanation.

### Duration

```text
14–18 seconds
```

Loop continuously.

### Audio

None.

Autoplay should work muted.

### Master export

Desktop:

```text
1920 × 1200 px
16:10
60 fps source
30 fps delivery acceptable
```

Formats:

```text
AV1 / WebM
MP4 H.264 fallback
```

### Display size

Maximum:

```text
1280 × 800 px
```

Container:

```css
width: min(1280px, calc(100vw - 64px));
aspect-ratio: 16 / 10;
border-radius: 20px;
```

Placement:

```text
Hero heading/copy
        ↓
       48px
        ↓
Full-width product video
```

Not left/right split.

The UI is sufficiently complex that a large canvas will sell the product better.

---

# 6. Hero video framing

Use a subtle application-window frame:

```text
┌─────────────────────────────────────────────┐
│ ● ● ●          app.tellann.co              │
├─────────────────────────────────────────────┤
│                                             │
│             Tellann Dashboard               │
│                                             │
└─────────────────────────────────────────────┘
```

Avoid fake browser chrome if it makes the interface smaller.

The goal is to make the product feel tangible.

---

# 7. Mobile hero media

Do not simply shrink the 1920×1200 recording.

Create an alternate mobile composition.

Master:

```text
1080 × 1350 px
4:5
```

Displayed approximately:

```text
calc(100vw - 32px)
```

The video should zoom between key UI regions rather than display the entire dashboard simultaneously.

Sequence:

```text
Demonstration
      ↓
Graph
      ↓
Coverage
      ↓
Replay
      ↓
Report
```

---

# 8. Hero animations

On load:

```text
Eyebrow     opacity 0 → 1
H1          translateY(16px) → 0
Copy        translateY(12px) → 0
CTA         translateY(8px) → 0
Video       scale(.985) → 1
```

Duration:

```text
400–650 ms
```

Stagger:

```text
60–90 ms
```

Avoid dramatic parallax.

Tellann should feel like engineering infrastructure, not a gaming website.

---

# 9. Section 03 — Product intelligence pipeline

Heading:

> **From interaction to understanding.**

Supporting line:

> Tellann turns ordinary application activity into a structured model of how your software behaves.

Visual:

```text
INTERACTIONS
     ↓
EVENTS
     ↓
SESSIONS
     ↓
STATES
     ↓
TRANSITIONS
     ↓
WORKFLOWS
     ↓
BEHAVIOR GRAPH
     ↓
QUALITY ANALYSIS
```

The architecture is explicitly event-first, and sessions are transformed into states, transitions, workflows, graphs and quality analysis.  

---

# 10. Pipeline animation

This should be a custom SVG rather than video.

Desktop dimensions:

```text
1440 × 540 px source
```

Rendered:

```text
1200 × 450 px maximum
```

Layout:

```text
[ Click ]
[ Route ] ─┐
[ API   ] ─┼─→ SESSION → STATES → WORKFLOW → GRAPH → QA
[ Form  ] ─┤
[ Error ] ─┘
```

Animation:

Events appear from different sources and move toward the session node.

Then:

```text
Session pulses
      ↓
States materialize
      ↓
Connections form
      ↓
Coverage calculation appears
```

Total loop:

```text
8–10 seconds
```

Very subtle.

---

# 11. Event labels to display

Use real Tellann event terminology:

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

These come directly from Tellann's canonical event taxonomy. 

This is better branding than inventing vague labels like:

```text
User action
Data point
AI event
```

---

# 12. Section 04 — Interactive product overview

Heading:

> **One platform. One behavioral model. Multiple views of quality.**

Implement a tabbed product showcase.

Tabs:

```text
Demonstrate
Model
Analyze
Investigate
Report
```

Clicking a tab swaps the central UI visual and copy.

---

# 13. Tab 1 — Demonstrate

Label:

```text
01 / DEMONSTRATE
```

Heading:

> **Show Tellann how your application works.**

Copy:

> Start a demonstration session and perform the workflows you care about. Tellann observes navigation, interface interactions, state transitions, API activity and errors while you use the application.

Developer Demonstration Mode is explicitly designed around the developer teaching the platform through normal application usage rather than manually documenting workflows. 

Visual:

Tellann Demonstration Mode.

Master screenshot:

```text
1600 × 1000
```

Displayed:

```text
720 × 450
```

Desktop layout:

```text
5 columns text
7 columns visual
```

---

# 14. Demonstration visual contents

UI should show:

```text
Demonstration Session

E-Commerce Demo

● Recording

00:02:43

Events captured         347
Routes observed           8
API requests             42
Errors                     1

CURRENT WORKFLOW
Checkout

Recent activity
────────────────────────────
BUTTON_CLICK
ROUTE_CHANGE
API_REQUEST
STATE_TRANSITION
```

The numbers are demonstration data, not customer claims.

---

# 15. Demonstration video

Inside the media card, optionally use a **6–8 second** micro-video rather than a static screenshot.

Master:

```text
1600 × 1000
```

Shows:

```text
Start recording
→ events begin incrementing
→ workflow changes
→ Stop demonstration
→ Processing
```

No audio.

---

# 16. Tab 2 — Model

Heading:

> **Turn behavior into a living application map.**

Copy:

> Tellann extracts states, actions and transitions from observed sessions and groups them into workflows.

The Behavior Graph's four foundational elements are:

```text
State
Transition
Action
Workflow
```



Visual:

Behavior Graph.

---

# 17. Behavior Graph visual dimensions

This deserves a major visual rather than a tiny dashboard screenshot.

Master:

```text
1800 × 1100
```

Rendered:

```text
760 × 465
```

Example:

```text
                 ┌──────────────┐
                 │  ANONYMOUS   │
                 └──────┬───────┘
                        │ REGISTER
                        ▼
                 ┌──────────────┐
                 │  REGISTERED  │
                 └──────┬───────┘
                        │ LOGIN
                        ▼
                 ┌──────────────┐
                 │ AUTHENTICATED│
                 └──────┬───────┘
                       / \
                      /   \
                     ▼     ▼
               PRODUCTS   PROFILE
                  │
                  ▼
                 CART
                  │
                  ▼
               CHECKOUT
              /        \
             ▼          ▼
      PAYMENT_SUCCESS PAYMENT_FAILED
```

---

# 18. Graph animation

Animate graph construction rather than graph movement.

Sequence:

```text
ANONYMOUS appears
     ↓
REGISTERED appears
     ↓
connecting line draws
     ↓
AUTHENTICATED
     ↓
branches appear
     ↓
checkout workflow highlighted
```

Duration:

```text
5–7 seconds
```

After construction, subtle transition-frequency particles can travel through the most common path.

Avoid moving nodes continuously.

The graph must remain readable.

The NFR explicitly requires behavioral graphs to remain readable for large workflows. 

---

# 19. Tab 3 — Analyze

Heading:

> **See what you covered—and what you didn't.**

Visual combines:

```text
Coverage
+
Missing States
+
Missing Flows
```

Example:

```text
CHECKOUT

Workflow coverage
72%

Observed paths
18

Missing paths
7


MISSING

Payment failure
Out of stock
Empty cart
Session timeout
Authentication failure
```

The MVP explicitly includes workflow/state/transition/endpoint/error coverage, missing flows and missing states. 

---

# 20. Coverage visual

Master:

```text
1600 × 1000
```

Displayed:

```text
720 × 450
```

Don't rely only on a circular percentage indicator.

Show:

```text
72% coverage

██████████████░░░░░

Observed     18
Missing       7

Coverage by type
Workflow     72%
States       81%
Transitions  69%
Endpoints    87%
Errors       42%
```

This communicates substantially more value.

---

# 21. Missing-state animation

When the card enters the viewport:

```text
Observed
✓ PAYMENT_SUCCESS
✓ CART_ACTIVE
✓ CHECKOUT

Potential gaps
+ PAYMENT_FAILURE
+ EMPTY_CART
+ SESSION_TIMEOUT
```

The missing items fade in sequentially.

No red flashing.

---

# 22. Tab 4 — Investigate

Heading:

> **Replay behavior, not guesswork.**

Use Session Replay.

Tellann replay is not defined as screen-recorded video; it is a behavioral reconstruction generated from captured telemetry. 

That distinction should appear subtly in the copy.

---

# 23. Session Replay visual

Master:

```text
1920 × 1200
```

Display:

```text
760 × 475
```

Layout within screenshot:

```text
┌───────────────────────────────────────────────────┐
│ Session SES-3817                    06:42         │
├──────────────────────────────┬────────────────────┤
│                              │  EVENT TIMELINE    │
│   Application reconstruction │                    │
│                              │  00:00 PAGE_VISIT │
│                              │  00:04 CLICK      │
│                              │  00:08 API_REQUEST│
│                              │  00:09 API_ERROR  │
│                              │  00:11 FORM_RETRY │
├──────────────────────────────┴────────────────────┤
│ ◀  ▶        ─────────●────────────  1×           │
└───────────────────────────────────────────────────┘
```

Playback controls documented for replay include Play, Pause, Seek, previous/next event and multiple playback speeds. 

---

# 24. Replay animation

Use a **7–10 second UI recording**.

Demonstrate:

```text
Play
↓
Timeline progresses
↓
API request event
↓
Error event highlighted
↓
Seek backwards
↓
Related workflow selected
```

Don't show private user information.

---

# 25. Tab 5 — Report

Heading:

> **Turn behavior into QA evidence.**

Visual:

Executive QA Report.

Example:

```text
APPLICATION QUALITY REPORT

Workflows discovered       14
Workflow coverage          76%
Missing states             11
Missing flows               8
Slow endpoints              3
Critical findings           2
```

The reporting system is specifically intended to translate telemetry, sessions and workflows into information teams can understand without manually inspecting raw data. 

---

# 26. Section 05 — Developer Demonstration Mode

This needs its own large section because it is one of Tellann's strongest differentiators.

Heading:

> **Don't describe the workflow. Demonstrate it.**

Supporting copy:

> Start a session, perform the actual workflow, and let Tellann reconstruct what happened.

The DDMS explicitly defines the developer as **teaching the platform how the application behaves**. 

---

# 27. Demonstration process layout

Desktop:

```text
1. CONNECT
      ↓
2. RECORD
      ↓
3. DEMONSTRATE
      ↓
4. PROCESS
      ↓
5. UNDERSTAND
```

Better visually as horizontal five-step cards:

```text
[ Connect ] → [ Record ] → [ Use ] → [ Analyze ] → [ Results ]
```

Each card:

```text
240 × 190 px
```

Gap:

```text
16–20 px
```

---

# 28. Supporting demonstration animation

A single large browser mockup sits below the five-step sequence.

Desktop:

```text
1200 × 750 display
```

Master:

```text
1920 × 1200
```

Split internally:

```text
70%
Example application

30%
Tellann observation panel
```

When the user clicks:

```text
Add to cart
```

the Tellann pane emits:

```text
BUTTON_CLICK
STATE_TRANSITION
API_REQUEST
API_RESPONSE
```

This is one of the most compelling animations you can build for the entire website.

---

# 29. Section 06 — Behavior Graph

Heading:

> **Your application, reconstructed as behavior.**

Copy should explain the abstraction:

```text
State
Where the application is.

Action
What caused change.

Transition
How one state became another.

Workflow
The business process those transitions form.
```

These concepts come directly from the behavior graph specification. 

---

# 30. Behavior Graph section layout

Desktop:

```text
┌──────────────┬──────────────────────────────┐
│              │                              │
│  Explanation │        Animated Graph        │
│    4 cols    │           8 cols             │
│              │                              │
└──────────────┴──────────────────────────────┘
```

Graph canvas:

```text
800 × 600 displayed
1600 × 1200 source if raster
```

Prefer SVG/canvas so the graph remains sharp.

---

# 31. Graph interaction

Allow hover/click.

Click:

```text
CHECKOUT
```

opens:

```text
CHECKOUT

Category
BUSINESS

Sessions
148

Transitions
6

Observed actions
Checkout click
Payment submit
Payment success

Connected workflows
Purchase
Guest checkout
```

This makes the product feel real without requiring the visitor to log in.

---

# 32. Section 07 — Workflow Discovery

Heading:

> **Workflows emerge from what users actually do.**

Show a graph being reorganized into named workflow groups.

Example:

```text
Registration
Login
Browse
Checkout
Profile Update
```

The platform is designed to identify workflow entry points, exit points, recurring patterns and workflow relationships automatically. 

---

# 33. Workflow cards

Three examples:

```text
CHECKOUT
7 states
11 transitions
72% coverage

REGISTRATION
5 states
8 transitions
91% coverage

SEARCH
6 states
14 transitions
48% coverage
```

Again, these should be clearly demo/sample data.

---

# 34. Section 08 — Coverage & Quality Gaps

This should be one of the strongest sections.

Heading:

> **Quality is not only what worked. It is also what you never exercised.**

Then two columns.

### Left

```text
WHAT YOU OBSERVED

Payment success
Successful login
Product search
Checkout completion
Profile update
```

### Right

```text
WHAT MAY BE MISSING

Payment failure
Authentication failure
No results
Empty cart
Session timeout
```

This directly communicates Tellann's missing-state/missing-flow differentiation.

---

# 35. Quality gap visual

Master:

```text
1600 × 1100
```

Desktop rendered:

```text
1120 × 770
```

Visually represent:

```text
                  CHECKOUT

PRODUCT ───→ CART ───→ PAYMENT ───→ SUCCESS
                           │
                           │
                           ╳
                           ↓
                       FAILURE
                       Missing
```

Use solid lines for observed behavior.

Use dashed lines for identified gaps.

This becomes a recognizable Tellann visual motif.

---

# 36. Section 09 — Session Replay

Heading:

> **Follow the evidence back to the session.**

Subcopy:

> Inspect the sequence of navigation, interactions, API activity, state changes and failures behind a workflow.

Session replay is expressly designed to provide behavioral context for investigation and graph/coverage analysis. 

---

# 37. Replay section visual layout

Full-width dark application panel:

```text
1200 × 720
```

Inside, show:

```text
Replay                              Timeline

Application view                    PAGE_VISIT
                                    BUTTON_CLICK
                                    FORM_SUBMITTED
                                    API_REQUEST
                                    API_ERROR
                                    STATE_ENTERED

Session                             API Activity
06:42                               POST /checkout
428 events                          503 · 890ms
```

Allow the right-side timeline to scroll during the demo.

---

# 38. Section 10 — Endpoint Intelligence

Heading:

> **Connect user behavior to API behavior.**

The backend SDK captures API requests, responses, response times, errors, endpoint metadata and frontend-session correlation. 

Visual:

```text
ENDPOINTS

Endpoint             Requests   Avg      Errors
GET /products         1,820     184ms     0.2%
GET /search             918     721ms     1.7%
POST /checkout          241     486ms     3.8%
POST /payment           213     893ms     7.4%
```

And:

```text
POST /payment
893 ms

SLOW

Recommendation
Review endpoint performance
```

---

# 39. Endpoint media

Master:

```text
1600 × 1000
```

Desktop display:

```text
720 × 450
```

Use animated sorting:

```text
All
↓
Slowest
↓
Highest errors
```

Avoid implying Phase 2 production monitoring.

The Phase 1 endpoint capability is analysis of captured demonstration activity. 

---

# 40. Section 11 — QA Reports

Heading:

> **From telemetry to something your team can act on.**

Show a report stack.

```text
Executive Quality Report
Flow Coverage Report
Behavior Graph Report
Missing Flow Report
Missing State Report
Session Analysis Report
Endpoint Intelligence Report
```

These seven reports are explicitly included in Phase 1. 

---

# 41. Report visual design

Main foreground report:

```text
1000 × 1280 master
```

Portrait because it represents an exported report.

On desktop, show three sheets:

```text
             ┌─────────┐
        ┌─────────┐    │
   ┌─────────┐    │    │
   │ Report  │    │    │
   │         │    │    │
   └─────────┘    │    │
        └─────────┘    │
             └─────────┘
```

Displayed region approximately:

```text
600 × 650
```

---

# 42. Export formats

Small line underneath:

```text
Export as PDF · CSV · JSON · HTML
```

All four formats are within the MVP report specification. 

---

# 43. Section 12 — Everything connected

This is where you show Tellann's architecture conceptually without exposing internal implementation complexity.

Heading:

> **One behavior. Multiple perspectives.**

Center node:

```text
BEHAVIOR
```

Surrounding:

```text
            Session Replay

Coverage ← Behavior Graph → Endpoints

            QA Reports

Missing States          Missing Flows
```

The message:

> These are not isolated tools. They are different views over the same observed application behavior.

That is central to Tellann's product philosophy.

---

# 44. Full product ecosystem visual

Use SVG.

Master viewport:

```text
1400 × 900
```

Desktop render:

```text
1100 × 707
```

Animation:

One selected event propagates through:

```text
EVENT
 ↓
SESSION
 ↓
GRAPH
 ├────────→ COVERAGE
 ├────────→ MISSING STATES
 ├────────→ WORKFLOWS
 ├────────→ REPLAY
 └────────→ REPORT
```

---

# 45. Section 13 — Who Tellann is for

The PRD targets software engineers, QA engineers, engineering managers and product teams, while the MVP particularly focuses on engineers, QA, startup founders and technical product managers.  

Use four cards.

### Software engineers

> Understand failures, endpoints and workflows without reconstructing every interaction manually.

### QA engineers

> See demonstrated coverage, missing states and unobserved paths.

### Engineering teams

> Build a shared behavioral picture of application quality.

### Technical product teams

> Understand which business workflows were actually exercised.

---

# 46. Persona visual design

No stock photography.

Use product-derived diagrams.

Each persona card:

```text
280 × 310
```

with miniature UI visualization.

For example:

```text
QA ENGINEER

   72%
 Coverage

Missing
• Payment failure
• Empty cart
```

This is much more authentic than photographs of developers staring at monitors.

---

# 47. Section 14 — Privacy by design

Because Tellann records application behavior, privacy cannot be buried in the footer.

Heading:

> **Observe behavior. Not secrets.**

Explain:

```text
Captured
✓ Navigation
✓ Clicks
✓ State transitions
✓ API metadata
✓ Workflow behavior

Masked
◐ Email
◐ User identifiers
◐ Phone numbers
◐ IP addresses

Never captured
× Passwords
× Credit card numbers
× CVV
× Access tokens
× API secrets
× Private keys
```

These categories are explicitly defined by the Privacy & Data Collection Specification. 

---

# 48. Privacy visual

Dimensions:

```text
1200 × 620
```

Layout:

```text
APPLICATION

email        ***@example.com
password     [BLOCKED]
card_number  [BLOCKED]

             ↓

PRIVACY FILTER

             ↓

TELLANN

BUTTON_CLICK
ROUTE_CHANGE
STATE_TRANSITION
API_RESPONSE
```

Animate the protected values disappearing **before** the arrow reaches Tellann.

This communicates client-side filtering visually.

---

# 49. Section 15 — Product evolution

Keep this short because `/roadmap` handles the full future.

Heading:

> **Built to evolve with the software it observes.**

Three columns:

```text
NOW
Behavioral QA

NEXT
Production Intelligence

LATER
Autonomous Validation
```

### Now

```text
Demonstration
Behavior Graphs
Coverage
Missing States
Missing Flows
Session Replay
Endpoint Intelligence
QA Reports
```

### Next

```text
Production Monitoring
Workflow Health
Journey Intelligence
Error Correlation
```

### Later

```text
Regression Detection
Test Generation
Failure Simulation
Quality Intelligence
```

The three-phase evolution is part of the authoritative product roadmap.  

Every future column must visibly say:

```text
PLANNED
```

Then:

```text
[ Explore the roadmap → ]
```

→ `/roadmap`

---

# 50. What NOT to put on `/product`

Do not say that current Tellann:

```text
Uses AI to automatically fix your software.
Generates production tests autonomously.
Predicts every defect.
Monitors every production user.
Performs database optimization.
Automatically validates releases.
Replaces your QA team.
```

The MVP document explicitly excludes AI recommendations, autonomous testing, production monitoring, journey intelligence, database intelligence, regression detection, failure simulation and anomaly detection. 

This boundary matters enormously.

Overselling Phase 3 on the main product page would weaken trust in the actual Phase 1 innovation.

---

# 51. Section 16 — Final CTA

Large centered section.

Eyebrow:

```text
START OBSERVING
```

H2:

> **Teach Tellann how your application behaves.**

Copy:

> Connect an application, record your first demonstration, and turn observed behavior into a clearer picture of software quality.

Buttons:

```text
[ Start for free ]
[ Read the docs ]
```

Small supporting text:

```text
1 application free
No credit card required
```

Only include "no credit card required" if that is actually your signup policy.

---

# 52. Complete media inventory

I would build the following assets for `/product`:

| Asset                   | Type             | Master dimensions | Placement              |
| ----------------------- | ---------------- | ----------------: | ---------------------- |
| Product overview        | Video            |         1920×1200 | Hero                   |
| Mobile product overview | Video            |         1080×1350 | Mobile hero            |
| Intelligence pipeline   | Animated SVG     |          1440×540 | After hero             |
| Demonstration Mode      | Video/UI capture |         1600×1000 | Product overview + DDM |
| Behavior Graph          | SVG/Canvas       |         1800×1100 | Modeling section       |
| Coverage dashboard      | UI capture       |         1600×1000 | Coverage section       |
| Missing-path graph      | Animated SVG     |         1600×1100 | Quality gaps           |
| Session Replay          | Video/UI capture |         1920×1200 | Replay                 |
| Endpoint Intelligence   | UI capture       |         1600×1000 | Endpoint section       |
| QA Report               | Image            |         1000×1280 | Reports                |
| Connected intelligence  | Animated SVG     |          1400×900 | Ecosystem              |
| Privacy pipeline        | Animated SVG     |          1200×620 | Privacy                |

That is approximately **11 core media assets**, but several can reuse the same actual product interface recordings.

---

# 53. Media treatment

All screenshots should be of **Tellann itself**, not decorative illustrations pretending to be software.

Use:

```text
Actual dashboard UI
Actual graph UI
Actual replay UI
Actual reports
Actual analysis views
```

For functionality that has not yet been implemented, use one of:

```text
Product concept
Planned
Design preview
```

Do not silently pass a Figma concept off as an existing capability.

---

# 54. Image format

For screenshots:

```text
AVIF primary
WebP fallback
PNG only where necessary
```

Generate approximately:

```text
480w
768w
1024w
1440w
1920w
```

with responsive `srcset`.

Avoid shipping 1920px assets to mobile.

---

# 55. Video implementation

HTML:

```html
<video
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  poster="..."
/>
```

Do not immediately preload every product video on the page.

Recommended:

```text
Hero
preload metadata

Below fold videos
lazy load when approaching viewport
```

Use IntersectionObserver.

---

# 56. Poster frames

Every video gets a high-quality static poster.

This matters for:

```text
slow connections
reduced motion
failed autoplay
SEO rendering
mobile battery usage
```

Poster should show the video's final/intelligence state rather than an empty dashboard.

---

# 57. Motion accessibility

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

When enabled:

```text
Stop graph animation
Stop looping diagram animations
Replace video autoplay with poster
Remove scroll-linked movement
```

Users must never lose information because animation is disabled.

---

# 58. Desktop grid

Main content:

```text
max-width: 1280px
```

Wide visual sections:

```text
max-width: 1440px
```

Text:

```text
max-width: 680px
```

Grid:

```text
12 columns
24px gap
```

Page gutter:

```text
Desktop       32–48px
Tablet        24px
Mobile        16px
```

---

# 59. Vertical spacing

For the product page, give the media breathing room.

Desktop:

```text
Hero top            120–150px
Major sections      140–180px
Section H2 → copy    20–24px
Copy → visual        48–64px
Cards                20–24px
```

Mobile:

```text
Major sections       88–112px
Heading → copy       16px
Copy → visual        32px
```

---

# 60. Responsive behavior

## ≥1280px

Full 12-column presentation.

## 1024–1279px

Reduce media to approximately:

```text
960–1100px
```

## 768–1023px

Two-column content often becomes:

```text
text
↓
visual
```

## <768px

Everything stacked.

Product tabs become horizontally scrollable:

```text
Demonstrate  Model  Analyze  Replay  Report
```

Graphs should support:

```text
pinch / drag
```

or provide a simplified mobile graph.

Never compress the entire desktop graph until labels become unreadable.

---

# 61. Mobile Behavior Graph

Instead of 20 tiny nodes, simplify.

```text
Anonymous
    ↓
Registered
    ↓
Authenticated
    ↓
Cart
    ↓
Checkout
   ↙    ↘
Success Failure
```

Button:

```text
Explore full graph →
```

---

# 62. Visual language

Retain Tellann's monochrome visual system, but use information hierarchy rather than decorative color.

Most UI:

```text
black
white
off-white
gray
```

Semantic accents can exist inside product screenshots for things such as:

```text
Success
Warning
Missing
Critical
```

but the public page itself should remain predominantly monochrome.

It helps the behavior graphs and data visualizations feel like technical instruments rather than marketing illustrations.

---

# 63. Animation language

Tellann's motion system should communicate:

```text
Observation
Connection
Construction
Discovery
Comparison
```

Good animations:

```text
nodes forming
lines connecting
events propagating
missing paths appearing
timeline advancing
coverage resolving
```

Avoid:

```text
floating blobs
AI particles
random glowing cubes
neural-brain imagery
rotating 3D objects
```

Those would dilute Tellann's actual differentiation.

---

# 64. SEO title

Recommended:

> **Tellann Product — Behavioral QA & Software Quality Intelligence**

Alternative:

> **Behavioral QA Platform | Tellann**

---

# 65. Meta description

Approximately:

> See how Tellann turns demonstrated application behavior into workflow maps, behavior graphs, coverage analysis, session replays, missing-state detection, endpoint insights, and QA reports.

---

# 66. Recommended H1/H2 structure

```text
H1
See how your software actually behaves.

H2
From interaction to understanding.

H2
One platform. Multiple views of quality.

H2
Don't describe the workflow. Demonstrate it.

H2
Your application, reconstructed as behavior.

H2
Workflows emerge from what users actually do.

H2
Quality is also what you never exercised.

H2
Follow the evidence back to the session.

H2
Connect user behavior to API behavior.

H2
From telemetry to something your team can act on.

H2
Observe behavior. Not secrets.

H2
Built to evolve with the software it observes.

H2
Teach Tellann how your application behaves.
```

---

# 67. Structured data

For `/product`, I would implement:

```text
SoftwareApplication
BreadcrumbList
FAQPage
```

`SoftwareApplication` is more appropriate than treating Tellann like a physical ecommerce product.

Include:

```text
name
applicationCategory
operatingSystem
description
offers
url
```

Pricing can point back to `/pricing`.

---

# 68. FAQ

Keep it product-specific.

Suggested questions:

```text
What does Tellann actually capture?

Do I need to write test cases first?

Does Tellann require production traffic?

What is Developer Demonstration Mode?

What is a Behavior Graph?

How does Tellann calculate workflow coverage?

What does Tellann exclude from capture?

Does Tellann replace my testing tools?

Does Tellann use AI?

Can I use Tellann with React and Node.js?
```

For the last question, current SDK scope includes React and Node.js; broader frameworks belong to future SDK evolution. 

---

# 69. Analytics events for the page

Track product-page engagement:

```text
product_hero_cta_clicked
product_demo_played
product_demo_completed

product_tab_selected

product_graph_interacted

product_section_viewed
product_replay_played

product_roadmap_clicked
product_docs_clicked
product_signup_clicked
```

Also track which capability generated the signup:

```json
{
  "sourceSection": "behavior_graph"
}
```

That will eventually tell you what part of Tellann's story actually converts visitors.

---

# 70. Recommended implementation component tree

```tsx
<ProductPage>
  <SiteHeader />

  <ProductHero />

  <BehaviorPipeline />

  <ProductTour>
    <DemonstrateTab />
    <ModelTab />
    <AnalyzeTab />
    <InvestigateTab />
    <ReportTab />
  </ProductTour>

  <DeveloperDemonstrationSection />

  <BehaviorGraphSection />

  <WorkflowDiscoverySection />

  <CoverageSection />

  <SessionReplaySection />

  <EndpointIntelligenceSection />

  <QAReportsSection />

  <ConnectedIntelligenceSection />

  <AudienceSection />

  <PrivacySection />

  <ProductEvolutionSection />

  <ProductCTA />

  <SiteFooter />
</ProductPage>
```

---

# 71. Media component architecture

Don't scatter raw `<video>` and `<img>` elements across the page.

Build:

```tsx
<ProductMedia
  type="video"
  src={...}
  poster={...}
  aspectRatio="16/10"
  caption="Developer Demonstration Mode"
/>
```

And:

```tsx
<AnimatedProductDiagram
  diagram="behavior-pipeline"
  reducedMotionFallback={...}
/>
```

This will keep `/product` and future dedicated feature pages visually consistent.

---

# 72. Most important visual sequence

If resources are limited, prioritize these **five** assets before everything else:

```text
1. Hero product overview video
2. Developer Demonstration interaction demo
3. Animated Behavior Graph
4. Coverage / missing-path visualization
5. Session Replay demonstration
```

Those five explain Tellann better than twenty paragraphs ever could.

The underlying reason is architectural: Tellann's differentiator is not any single dashboard widget. It is the sequence:

```text
Observe
    ↓
Reconstruct
    ↓
Model
    ↓
Find gaps
    ↓
Investigate
    ↓
Communicate
```

The behavior graph sits at the center of that model, while demonstration sessions provide the initial behavioral evidence and reports communicate the results.   

---

## Final page rhythm

The complete visitor experience should feel like this:

```text
SEE
"Tellann understands application behavior."

        ↓

WATCH
"I can see the product doing it."

        ↓

UNDERSTAND
"It observes events and reconstructs workflows."

        ↓

DISCOVER
"It finds what I exercised and what I missed."

        ↓

INVESTIGATE
"I can inspect the actual session and API behavior."

        ↓

ACT
"It turns everything into usable QA evidence."

        ↓

TRUST
"It protects sensitive information by default."

        ↓

BELIEVE
"There is a much larger platform direction behind this."

        ↓

START
"Let me demonstrate my application."
```

That is the `/product` page I would implement. It presents Tellann as a concrete **Behavioral QA / Quality Intelligence product**, rather than another abstract "AI-powered testing platform," while leaving enough visible architectural depth to make the product feel larger than a collection of QA reports.  
