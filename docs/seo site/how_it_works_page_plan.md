# `/product/how-it-works` — Complete Page Specification

`/product/how-it-works` should explain **the Tellann operating model step by step**.

The visitor should understand:

```text
Connect application
        ↓
Capture behavior
        ↓
Build session
        ↓
Extract states and transitions
        ↓
Discover workflows
        ↓
Build Behavior Graph
        ↓
Measure coverage
        ↓
Detect missing states and flows
        ↓
Analyze endpoints
        ↓
Generate QA reports
```

That lifecycle is already defined across the Developer Demonstration, Behavior Graph, Data Flow, Session Replay, and MVP specifications.    

The page should feel like **watching Tellann think**, without claiming AI capabilities that are outside Phase 1.

---

# 1. Primary role of this page

`/product` answers:

> What is Tellann?

`/product/how-it-works` answers:

> What actually happens after I connect Tellann?

The page should therefore be less marketing-heavy and more operational.

Its core questions are:

```text
How do I integrate Tellann?

What data does it observe?

What happens during a demonstration?

How does Tellann turn events into sessions?

How do sessions become workflows?

How does the Behavior Graph get built?

How is coverage calculated?

How are missing states and flows identified?

How do I investigate what happened?

What do I receive at the end?
```

---

# 2. Recommended page structure

```text
/product/how-it-works
│
├── 01 Global Navigation
├── 02 Hero
├── 03 End-to-End Product Flow
├── 04 Step 1 — Connect
├── 05 Step 2 — Demonstrate
├── 06 Step 3 — Capture Events
├── 07 Step 4 — Build Sessions
├── 08 Step 5 — Discover States & Transitions
├── 09 Step 6 — Discover Workflows
├── 10 Step 7 — Build Behavior Graph
├── 11 Step 8 — Measure Coverage
├── 12 Step 9 — Detect Missing States & Flows
├── 13 Step 10 — Analyze Endpoints
├── 14 Step 11 — Replay & Investigate
├── 15 Step 12 — Generate QA Reports
├── 16 Behind the Pipeline
├── 17 Privacy Throughout the Flow
├── 18 What Happens Next
├── 19 FAQ
├── 20 Final CTA
└── 21 Footer
```

---

# 3. Hero

### Eyebrow

```text
HOW TELLANN WORKS
```

### H1

> **From one application walkthrough to a map of software behavior.**

Alternative:

> **Show Tellann what your application does. See what its quality looks like.**

I prefer the first because it explains the mechanism more clearly.

### Supporting copy

> Connect the SDK, start a demonstration session, and use your application normally. Tellann captures behavioral events, reconstructs sessions, discovers workflows, builds a Behavior Graph, measures coverage, identifies gaps, and generates QA evidence.

This is the documented Developer Demonstration lifecycle. 

### CTA

```text
[ Start a demonstration ]
[ View SDK docs → ]
```

---

# 4. Hero visual

Unlike `/product`, don't use another dashboard montage.

Use an **animated process visualization**.

```text
APPLICATION
     │
     ▼
SDK
     │
     ▼
EVENTS
     │
     ▼
SESSION
     │
     ▼
WORKFLOW
     │
     ▼
BEHAVIOR GRAPH
     │
     ▼
ANALYSIS
     │
     ▼
QA REPORT
```

## Master dimensions

```text
Desktop source:
1920 × 1080

Rendered:
max-width 1280px
approximately 720px high
```

Aspect ratio:

```text
16:9
```

Mobile alternate:

```text
1080 × 1440
3:4
```

The mobile version becomes vertical.

---

# 5. Hero animation

The animation should run roughly **10–12 seconds**.

Sequence:

```text
0–2 sec
Application interaction begins

2–4 sec
Events leave application

4–5 sec
Events group into session

5–7 sec
States and transitions appear

7–8 sec
Workflow emerges

8–10 sec
Behavior Graph builds

10–11 sec
Coverage and gaps appear

11–12 sec
QA report resolves
```

Then restart smoothly.

Use SVG or canvas rather than video if practical.

This allows responsive labels and better accessibility.

---

# 6. Section 03 — End-to-End Product Flow

Heading:

> **The entire process in twelve steps.**

Desktop horizontal flow:

```text
01 Connect
   ↓
02 Demonstrate
   ↓
03 Capture
   ↓
04 Session
   ↓
05 States
   ↓
06 Workflows
   ↓
07 Graph
   ↓
08 Coverage
   ↓
09 Gaps
   ↓
10 Endpoints
   ↓
11 Replay
   ↓
12 Report
```

Better implementation:

Two rows of six.

Each item:

```text
180–190px wide
140–160px high
```

Gap:

```text
16px
```

---

# 7. Interaction

Hovering a step highlights its position in the pipeline.

For example:

```text
07 BEHAVIOR GRAPH
```

causes:

```text
Events → Session → States → Workflow → GRAPH
```

to become emphasized while later outputs become dimmed.

Click scrolls to that detailed section.

---

# 8. Step 1 — Connect the application

Anchor:

```text
#connect
```

### Eyebrow

```text
STEP 01
```

### H2

> **Connect Tellann to your application.**

Tellann's MVP supports a React frontend SDK and Node.js backend SDK. 

The SDK specification also defines support for React, Next.js, Node.js, Express, NestJS and Fastify around the initial JavaScript/TypeScript SDK ecosystem. 

---

# 9. Connect layout

Desktop:

```text
┌──────────────────┬────────────────────────────┐
│                  │                            │
│      COPY        │        CODE PANEL          │
│    5 columns     │         7 columns          │
│                  │                            │
└──────────────────┴────────────────────────────┘
```

Example:

```ts
import { Tellann } from "@tellann/react";

Tellann.initialize({
  apiKey: "...",
  applicationId: "...",
  environment: "demo"
});
```

Use Tellann branding publicly, even if internal documentation still uses historical TELLANN package naming.

---

# 10. Code-panel dimensions

Master visual:

```text
1600 × 900
```

Rendered:

```text
720 × 405
```

or build as real HTML instead of an image.

The latter is preferable.

Display:

```text
Install
Configure
Verify connection
```

Small status indicator:

```text
● SDK connected
```

---

# 11. Animation

Run once on viewport entry:

```text
npm install @tellann/react

        ↓

configuration appears

        ↓

Connecting...

        ↓

● SDK connected
```

Duration:

```text
3–4 seconds
```

Do not fake terminal complexity.

---

# 12. Step 2 — Start a demonstration

### H2

> **Start a demonstration and use the application normally.**

Developer Demonstration Mode is the primary Phase 1 workflow through which the developer teaches Tellann how the application behaves. 

Show three demonstration types:

```text
Guided
Exploratory
Validation
```

These are directly defined in DDMS. 

---

# 13. Demonstration media

Use a real product recording.

## Desktop master

```text
1920 × 1200
```

## Rendered

```text
900 × 562
```

## Duration

```text
8–10 seconds
```

Show:

```text
Application
E-Commerce Demo

[ Start demonstration ]

      ↓

● Recording

Workflow:
Checkout

Duration:
01:42

Events:
184
```

---

# 14. Split-screen demonstration visual

Internally:

```text
┌───────────────────────────────────────────────┐
│ Customer Application       Tellann Observer  │
│                            ● Recording        │
│ Add to cart                PAGE_VISIT        │
│ Checkout                   BUTTON_CLICK      │
│ Payment                    API_REQUEST       │
│                            STATE_TRANSITION  │
└───────────────────────────────────────────────┘
```

Ratio:

```text
70 / 30
```

This should become one of the signature visuals across the Tellann site.

---

# 15. Step 3 — Capture behavioral events

### H2

> **Every meaningful interaction becomes structured behavior.**

Tellann's event model includes categories for session, navigation, UI, forms, state, API and errors. 

Show real event names:

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

---

# 16. Event animation

Visual dimensions:

```text
Desktop source:
1440 × 720

Rendered:
1000 × 500
```

Animation:

```text
Customer Application

[Click checkout]
        │
        ├── BUTTON_CLICK
        ├── STATE_TRANSITION
        ├── API_REQUEST
        └── API_RESPONSE
```

Then each event receives:

```text
timestamp
sessionId
applicationId
source
metadata
```

Those fields derive from the canonical event structure. 

---

# 17. Show event structure

Small expandable card:

```json
{
  "eventType": "BUTTON_CLICK",
  "sessionId": "ses_3817",
  "timestamp": "08:43:18",
  "source": "frontend-sdk",
  "metadata": {
    "buttonId": "checkout"
  }
}
```

Don't overwhelm this section with full schema documentation.

Link:

```text
View event model →
```

---

# 18. Step 4 — Build the session

### H2

> **Events become a chronological session.**

The Session Engine orders events and reconstructs the user journey. 

Visual:

```text
RAW EVENTS

08:43:02 PAGE_VISIT
08:43:05 BUTTON_CLICK
08:43:06 API_REQUEST
08:43:06 API_RESPONSE
08:43:08 STATE_TRANSITION

            ↓

SESSION SES-3817

Duration        06:42
Events          428
Workflows       6
Errors          1
```

---

# 19. Session visual

Master:

```text
1600 × 1000
```

Displayed:

```text
760 × 475
```

Animate unordered events falling into chronological order.

Duration:

```text
4 seconds
```

Then draw a vertical timeline.

---

# 20. Session integrity callout

Show a small detail:

```text
Timeline completeness
98%
```

The Session Replay specification defines replay integrity concepts such as timeline completeness, missing event count and ordering accuracy. 

Don't make this the main focus, but it reinforces technical credibility.

---

# 21. Step 5 — Extract states and transitions

### H2

> **Tellann identifies where the application was—and how it moved.**

State asks:

> Where is the user or system right now?

Action represents the trigger.

Transition represents movement between states. 

Visual:

```text
CART_ACTIVE
     │
     │ CHECKOUT_CLICK
     ▼
CHECKOUT
     │
     │ SUBMIT_PAYMENT
     ▼
PAYMENT_SUCCESS
```

---

# 22. State categories

Use small chips:

```text
NAVIGATION
UI
BUSINESS
ERROR
SYSTEM
```

Those categories are defined in the Behavior Graph Specification. 

---

# 23. State extraction animation

Left side shows events:

```text
ROUTE_CHANGE /cart
BUTTON_CLICK checkout
API_RESPONSE 200
```

Right side resolves into:

```text
CART_ACTIVE
       ↓
CHECKOUT
       ↓
PAYMENT_SUCCESS
```

Dimensions:

```text
1440 × 800 source
900 × 500 display
```

---

# 24. Step 6 — Discover workflows

### H2

> **Connected behavior becomes a workflow.**

A workflow is a connected sequence of states and transitions that accomplishes a business objective. 

Examples:

```text
Registration
Login
Checkout
Password Reset
Subscription Purchase
```

---

# 25. Workflow discovery visual

Start with scattered states:

```text
HOME
LOGIN
PROFILE
CART
PRODUCT
CHECKOUT
PAYMENT_SUCCESS
```

Then cluster them into:

```text
LOGIN WORKFLOW
BROWSE WORKFLOW
CHECKOUT WORKFLOW
```

Master:

```text
1600 × 900
```

Rendered:

```text
1000 × 562
```

Animation duration:

```text
6 seconds
```

---

# 26. Workflow card design

Example:

```text
CHECKOUT

Entry
PRODUCT_VIEW

Exit
PAYMENT_SUCCESS

States
12

Transitions
18

Observed sessions
143
```

Keep numbers marked as demo/sample data.

---

# 27. Step 7 — Build the Behavior Graph

This should visually be one of the largest sections.

### H2

> **The application becomes a Behavior Graph.**

The Behavior Graph is the central intelligence model of Tellann and combines states, transitions, actions and workflows. 

---

# 28. Full graph layout

Use nearly full-bleed container.

```text
Max section width:
1440px

Graph canvas:
1280 × 760 rendered
```

Master:

```text
1920 × 1140
```

Prefer actual SVG/canvas rendering.

Example:

```text
ANONYMOUS
     │
     ▼
REGISTERED
     │
     ▼
AUTHENTICATED
   /         \
  ▼           ▼
PRODUCTS    PROFILE
  │
  ▼
CART
  │
  ▼
CHECKOUT
 /      \
▼        ▼
SUCCESS FAILURE
```

---

# 29. Graph construction animation

Build progressively from session data.

```text
Session 01 adds:
Anonymous → Registered

Session 02 adds:
Registered → Authenticated

Session 03 adds:
Authenticated → Product → Cart

Session 04 adds:
Cart → Checkout → Payment Success
```

Then:

```text
Graph complete
```

This communicates that the graph is derived rather than manually drawn.

---

# 30. Step 8 — Calculate behavioral coverage

### H2

> **Measure what you actually exercised.**

The coverage system measures:

```text
Workflow coverage
State coverage
Transition coverage
Endpoint coverage
Error coverage
```

These are explicitly defined in Developer Demonstration and QA reporting specifications.  

---

# 31. Coverage visual

Use a dashboard-style panel:

```text
CHECKOUT WORKFLOW

Overall coverage
72%

Workflow      72%
States        81%
Transitions   69%
Endpoints     87%
Error paths   42%

Observed paths
18

Missing paths
7
```

Dimensions:

```text
1600 × 1000 master
820 × 512 display
```

---

# 32. Coverage animation

Animate graph paths.

Observed:

```text
solid line
```

Missing:

```text
dashed line
```

Then total resolves:

```text
72%
```

Avoid circular loaders with no context.

---

# 33. Step 9 — Find missing states and flows

### H2

> **Tellann looks beyond the happy path.**

Missing-state categories include:

```text
Loading
Empty
Error
Recovery
```

Missing-flow categories include:

```text
Failure
Alternative
Recovery
Edge-case
```

These are explicit MVP capabilities. 

---

# 34. Gap detection visual

Large graph comparison:

```text
OBSERVED

Cart
 ↓
Checkout
 ↓
Payment Success


LIKELY GAP

Checkout
 ↓
Payment Failure
 ↓
Retry Payment
```

Master:

```text
1600 × 1000
```

Display:

```text
1000 × 625
```

---

# 35. Missing-state list

Example:

```text
Potential quality gaps

HIGH
Payment Failure

MEDIUM
Empty Cart

MEDIUM
Authentication Failure

LOW
404 State

LOW
Loading State
```

Do not imply Phase 3 autonomous quality scoring.

Use simple rule-based classifications if present in product design.

---

# 36. Step 10 — Endpoint intelligence

### H2

> **See the backend behavior behind the workflow.**

The backend SDK captures endpoint metadata, response time and errors and correlates it with frontend sessions where possible. 

Visual:

```text
CHECKOUT WORKFLOW

POST /cart
143ms
✓

POST /checkout
418ms
✓

POST /payment
891ms
7.4% error
```

---

# 37. Endpoint relationship animation

Show:

```text
CHECKOUT STATE
       ↓
POST /checkout
       ↓
POST /payment
       ↓
PAYMENT_SUCCESS
```

If `/payment` fails:

```text
API_ERROR
       ↓
PAYMENT_FAILURE
```

This explains why Tellann combines frontend and backend telemetry.

---

# 38. Endpoint media

Master:

```text
1600 × 1000
```

Display:

```text
760 × 475
```

Can be static with animated rows.

Do not use production trends here; Phase 1 only analyzes captured sessions. 

---

# 39. Step 11 — Replay and investigate

### H2

> **Trace an insight back to what actually happened.**

Tellann Session Replay is a behavioral reconstruction from telemetry rather than a traditional screen recording. 

---

# 40. Replay video

Use actual UI capture.

Master:

```text
1920 × 1200
```

Display:

```text
1100 × 688
```

Duration:

```text
8–12 seconds
```

Shows:

```text
Open session

↓
Play

↓
Jump to ERROR_OCCURRED

↓
Inspect API timeline

↓
Highlight related workflow

↓
Return to graph
```

---

# 41. Replay timeline

Example:

```text
00:00 SESSION_STARTED
00:04 PAGE_VISIT
00:11 BUTTON_CLICK
00:14 STATE_TRANSITION
00:15 API_REQUEST
00:16 API_ERROR
00:18 ERROR_OCCURRED
```

Playback:

```text
◀  ▶  ───────●────────  1×
```

---

# 42. Step 12 — Generate QA reports

### H2

> **Turn everything into QA evidence.**

Phase 1 reports include:

```text
Executive Quality Report
Flow Coverage Report
Behavior Graph Report
Missing Flow Report
Missing State Report
Session Analysis Report
Endpoint Intelligence Report
```



---

# 43. Report media

Use three overlapping report pages.

Master pages:

```text
1000 × 1280 each
```

Composite canvas:

```text
1600 × 1100
```

Rendered:

```text
800 × 550
```

Animation:

```text
Coverage Report slides in
Missing States Report slides behind
Endpoint Report slides behind
```

Very subtle.

---

# 44. Report output line

Show:

```text
PDF
CSV
JSON
HTML
```

Those export formats are explicitly in scope. 

---

# 45. Section 16 — Behind the pipeline

This section explains the system at a higher level.

Heading:

> **One event stream. Multiple intelligence layers.**

Visual:

```text
Customer Application
        ↓
Frontend / Backend SDK
        ↓
Event Collector
        ↓
Event Stream
        ↓
Session Engine
        ↓
Behavior Processing
        ↓
Storage
        ↓
Dashboard & Reports
```

This corresponds directly to Tellann's high-level architecture. 

---

# 46. Architecture visual dimensions

Source:

```text
1800 × 1200
```

Rendered:

```text
1100 × 733
```

Prefer SVG.

Keep implementation technology hidden initially.

Expandable:

```text
View technical architecture
```

reveals:

```text
Kafka
PostgreSQL
ClickHouse
Object Storage
```

Don't force general product visitors through infrastructure jargon.

---

# 47. Section 17 — Privacy through every step

Heading:

> **Privacy filtering happens before behavioral data becomes intelligence.**

The privacy specification requires privacy-by-default controls and filtering before protected information enters the analytics pipeline. 

---

# 48. Privacy process visual

```text
Application
     ↓
SDK capture
     ↓
Privacy Filter
     ↓
Mask / Ignore / Hash
     ↓
Transmit
     ↓
Tellann
```

Example:

```text
email
ph***@domain.com

password
[NOT CAPTURED]

access_token
[NOT CAPTURED]

BUTTON_CLICK
CAPTURED
```

Dimensions:

```text
1200 × 700 source
900 × 525 display
```

---

# 49. Privacy categories

Three cards:

### Collected

```text
Navigation
Clicks
State transitions
Workflow information
API metadata
```

### Masked

```text
User IDs
Emails
Phone numbers
IP addresses
```

### Never collected

```text
Passwords
Credit cards
CVV
Tokens
API secrets
Private keys
```



---

# 50. Section 18 — What happens after the first demonstration?

Important because users may otherwise think Tellann is one-use-only.

Heading:

> **Every demonstration can deepen the behavioral model.**

Show:

```text
Demo 1
Login + Checkout
      ↓

Demo 2
Search + Profile
      ↓

Demo 3
Checkout Failure
      ↓

Expanded Behavior Graph
      ↓

Higher coverage
```

This is consistent with the graph model being generated from multiple observed sessions. 

Do not imply continuous Phase 2 production learning yet.

---

# 51. Optional interactive sandbox

This page would benefit greatly from one small interactive example.

Heading:

> **See the model build itself.**

The user clicks:

```text
[ Visit Product ]
[ Add to Cart ]
[ Checkout ]
```

As they click, an adjacent mini graph updates.

For example:

```text
PRODUCT_VIEW
      ↓
CART_ACTIVE
      ↓
CHECKOUT
```

Then:

```text
Coverage
3 states observed
2 transitions observed
```

This may be the highest-value interactive element on the page.

---

# 52. Interactive sandbox dimensions

Desktop:

```text
1200 × 700
```

Split:

```text
50% demo application
50% Tellann model
```

Mobile:

stack:

```text
Application
↓
Tellann model
```

Don't persist any real user data.

This is purely illustrative.

---

# 53. FAQ section

Recommended questions:

```text
Do I need to manually define workflows?

Does Tellann require production traffic?

What exactly does the SDK capture?

How does Tellann identify a workflow?

What is a Behavior Graph?

How is coverage calculated?

How are missing flows detected?

Is session replay a video recording?

Does Tellann capture passwords or sensitive data?

What happens after I end a demonstration?

Can multiple demonstrations contribute to one application model?

Does Tellann generate automated tests today?
```

The last question should answer:

> Not in the current Behavioral QA phase. Automated test generation belongs to the planned autonomous validation phase. 

That transparency is valuable.

---

# 54. Final CTA

Eyebrow:

```text
YOUR FIRST BEHAVIOR GRAPH
```

H2:

> **Start with one workflow. See what Tellann learns.**

Supporting copy:

> Connect your application, record a demonstration, and turn real software behavior into workflows, coverage, gaps, replays, endpoint insights and QA reports.

Buttons:

```text
[ Start free ]
[ Read integration docs ]
```

---

# 55. Complete media inventory

| Asset                 | Type                |    Master |    Display |
| --------------------- | ------------------- | --------: | ---------: |
| Hero lifecycle        | Animated SVG/Canvas | 1920×1080 |   1280×720 |
| Mobile lifecycle      | SVG                 | 1080×1440 | responsive |
| SDK connection        | HTML/code animation |  1600×900 |    720×405 |
| Demonstration Mode    | Video               | 1920×1200 |    900×562 |
| Event capture         | SVG                 |  1440×720 |   1000×500 |
| Session construction  | SVG/UI              | 1600×1000 |    760×475 |
| State extraction      | SVG                 |  1440×800 |    900×500 |
| Workflow discovery    | SVG                 |  1600×900 |   1000×562 |
| Behavior Graph        | SVG/Canvas          | 1920×1140 |   1280×760 |
| Coverage              | UI                  | 1600×1000 |    820×512 |
| Gap detection         | SVG                 | 1600×1000 |   1000×625 |
| Endpoint intelligence | UI                  | 1600×1000 |    760×475 |
| Session Replay        | Video               | 1920×1200 |   1100×688 |
| Reports               | Composite           | 1600×1100 |    800×550 |
| Architecture pipeline | SVG                 | 1800×1200 |   1100×733 |
| Privacy pipeline      | SVG                 |  1200×700 |    900×525 |
| Interactive sandbox   | Real HTML           |         — |   1200×700 |

Approximately **16 core visual assets**, although many should be generated from reusable product UI components rather than exported separately.

---

# 56. Animation principles

All motion on this page should represent one of:

```text
capture
movement
grouping
construction
discovery
comparison
analysis
```

Examples:

```text
event enters stream
events align into session
states connect
workflow clusters
graph expands
missing path appears
coverage resolves
timeline advances
report assembles
```

Avoid decorative movement.

---

# 57. Scroll choreography

This page can use restrained scroll-based sequencing.

As each step enters:

```text
STEP NUMBER
fade in

↓

H2
slide 12px upward

↓

Explanation
fade in

↓

Media
activate
```

Never bind major product animations directly to every pixel of scroll.

That often becomes jittery and inaccessible.

---

# 58. Sticky progress indicator

Desktop only.

Left edge:

```text
01 Connect
02 Demonstrate
03 Capture
04 Session
05 States
06 Workflows
07 Graph
08 Coverage
09 Gaps
10 Endpoints
11 Replay
12 Reports
```

As the user scrolls, current step becomes active.

Width:

```text
170–190px
```

Only use this at:

```text
≥ 1280px
```

On smaller screens use a small top indicator:

```text
Step 7 of 12
Behavior Graph
```

---

# 59. Desktop grid

Page:

```text
max-width: 1280px
```

Large visual sections:

```text
max-width: 1440px
```

Grid:

```text
12 columns
24px gap
```

Normal text:

```text
max-width: 620–680px
```

---

# 60. Vertical spacing

Desktop:

```text
Hero                 140px top
Major sections       150–180px
Step label → H2       12px
H2 → paragraph        20px
Paragraph → visual    48–64px
```

Mobile:

```text
Major sections       88–104px
```

---

# 61. Mobile behavior

On mobile, the entire process should become naturally vertical.

Do not compress:

```text
events → session → states → graph
```

into a tiny horizontal diagram.

Use:

```text
EVENTS
   ↓
SESSION
   ↓
STATES
   ↓
WORKFLOW
   ↓
GRAPH
```

Graph visual should simplify to the most important path.

---

# 62. Video implementation

Use:

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

Only hero media can load early.

Other videos:

```text
IntersectionObserver
→ preload when ~500px from viewport
```

---

# 63. Reduced motion

When:

```css
prefers-reduced-motion: reduce
```

replace:

```text
animated lifecycle
graph construction
workflow clustering
timeline autoplay
```

with:

```text
static final diagrams
poster frames
```

No information should depend on motion.

---

# 64. SEO

### Title

> **How Tellann Works — From Application Behavior to QA Intelligence**

### Meta description

> See how Tellann captures application behavior, reconstructs sessions, discovers workflows, builds Behavior Graphs, measures coverage, identifies missing states and flows, analyzes endpoints and generates QA reports.

---

# 65. Recommended internal links

Throughout the page:

```text
Behavior Graph
→ /product/behavior-graph

Session Replay
→ /product/session-replay

Coverage
→ /product/coverage

SDK
→ /developers/sdk

Privacy
→ /security or /privacy

Roadmap
→ /roadmap
```

Even if some of these routes are not yet implemented, design the architecture to support them.

---

# 66. What this page must not become

Do **not** turn `/product/how-it-works` into:

```text
architecture documentation
API documentation
SDK reference
marketing slideshow
AI concept animation
feature matrix
```

It should live between product marketing and technical explanation.

The ideal visitor reaction is:

> "I understand exactly what happens after I install this."

---

# 67. The final narrative

The page should feel like this:

```text
CONNECT
Tellann gains permission to observe behavior.

        ↓

DEMONSTRATE
You show it a real workflow.

        ↓

CAPTURE
Interactions become structured events.

        ↓

RECONSTRUCT
Events become chronological sessions.

        ↓

MODEL
Sessions reveal states and transitions.

        ↓

DISCOVER
States combine into workflows.

        ↓

MAP
Workflows become a Behavior Graph.

        ↓

MEASURE
Observed behavior becomes coverage.

        ↓

QUESTION
Missing behavior becomes visible.

        ↓

CORRELATE
Frontend behavior connects to endpoints.

        ↓

INVESTIGATE
Sessions explain what actually happened.

        ↓

COMMUNICATE
Everything becomes QA evidence.
```

That sequence is the real conceptual spine of Tellann's Phase 1 product and should become the spine of `/product/how-it-works` itself.    
