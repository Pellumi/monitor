# `/product/demonstration-mode` — Complete Page Specification

This page should make **Developer Demonstration Mode** feel like a concrete product capability, not a vague onboarding feature.

The core message is:

> **Don’t manually describe your application. Show Tellann how it behaves.**

Developer Demonstration Mode is explicitly defined as the primary Phase 1 workflow through which a developer introduces an application to Tellann and obtains behavioral graphs, workflow maps, coverage reports, missing states, missing flows, endpoint analysis, replay assets, and QA reports. 

---

# 1. Primary purpose

This page must answer:

```text
What is Demonstration Mode?

Why does Tellann use demonstrations?

How do I start one?

What does Tellann capture while I demonstrate?

What happens when I stop recording?

What outputs are generated?

What kinds of demonstrations can I run?

Can I run multiple demonstrations?

What does Tellann intentionally not capture?

How does this become useful QA intelligence?
```

The visitor should leave understanding:

```text
Developer performs workflow
        ↓
Tellann observes behavior
        ↓
Events become session
        ↓
Session becomes states + transitions
        ↓
States become workflows
        ↓
Behavior Graph
        ↓
Coverage + gaps + replay + reports
```

That is the documented Demonstration Mode lifecycle. 

---

# 2. Page structure

```text
/product/demonstration-mode
│
├── 01 Navigation
├── 02 Hero
├── 03 What Demonstration Mode Is
├── 04 Live Demonstration Experience
├── 05 Three Demonstration Types
├── 06 What Tellann Captures
├── 07 What Happens During Recording
├── 08 What Happens After Recording
├── 09 Behavior Graph Generation
├── 10 Coverage & Gap Detection
├── 11 Session Replay
├── 12 Endpoint Analysis
├── 13 Demonstration QA Report
├── 14 Multiple Demonstrations
├── 15 Privacy & Data Protection
├── 16 When to Use Demonstration Mode
├── 17 What Demonstration Mode Is Not
├── 18 FAQ
├── 19 Final CTA
└── 20 Footer
```

---

# 3. Hero

### Eyebrow

```text
DEVELOPER DEMONSTRATION MODE
```

### H1

> **Teach Tellann how your application behaves.**

Alternative:

> **Demonstrate once. Turn behavior into QA intelligence.**

I would use the first.

### Supporting copy

> Start a demonstration session, perform the workflows that matter, and let Tellann observe navigation, interactions, state changes, API activity, and errors. When the session ends, Tellann reconstructs what happened and turns it into behavioral models and QA analysis.

This is directly aligned with the DDMS capture lifecycle. 

### CTAs

```text
[ Start a demonstration ]
[ See the process → ]
```

Optional tertiary:

```text
Read SDK guide →
```

---

# 4. Hero video

This should be a **real product recording**, not an abstract visual.

## Sequence

```text
1. Developer opens application in Tellann
2. Clicks "Start demonstration"
3. Recording indicator appears
4. Developer performs checkout workflow
5. Tellann event counter increases
6. Workflow label changes
7. Developer clicks "Stop"
8. Processing begins
9. Behavior Graph appears
10. Coverage report appears
11. Missing flow highlighted
```

### Duration

```text
12–16 seconds
```

### Master

```text
1920 × 1200
16:10
```

### Display

```text
max-width: 1280px
approximately 800px high
```

Placement:

```text
Hero copy
   ↓ 48px
Large product recording
```

Do not use a split hero. Demonstration Mode itself should dominate the first viewport.

---

# 5. Mobile hero video

Create a separate edit.

### Master

```text
1080 × 1350
4:5
```

Instead of shrinking the full desktop interface, zoom sequentially into:

```text
Start
↓
Recording
↓
Events
↓
Stop
↓
Graph
↓
Coverage
```

---

# 6. Section — What Demonstration Mode is

Heading:

> **A walkthrough becomes structured behavioral evidence.**

Explain the core idea:

```text
Traditional approach

Write flows
Write test cases
Document edge cases
Maintain all of it manually


Tellann approach

Perform workflow
        ↓
Observe behavior
        ↓
Reconstruct workflow
        ↓
Analyze quality
```

The DDMS explicitly states that the developer is **not writing tests**; they are teaching Tellann how the application behaves. 

---

# 7. Conceptual visual

Use an animated transformation:

```text
Developer
   ↓

REGISTER
LOGIN
SEARCH
CART
CHECKOUT

   ↓

Tellann

   ↓

WORKFLOW MODEL

Anonymous
   ↓
Registered
   ↓
Authenticated
   ↓
Cart
   ↓
Checkout
```

### Source size

```text
1600 × 900
```

### Render

```text
1000 × 562
```

Prefer SVG.

---

# 8. Section — Live Demonstration Experience

Heading:

> **Record the workflow while you actually perform it.**

This section should look like the product itself.

Desktop split:

```text
┌──────────────────────────────────────────────┐
│ Your application           Tellann Observer │
│                            ● RECORDING       │
│                            02:14             │
│ Browse Products            Events      184  │
│ Add to Cart                States       12  │
│ Checkout                   API Calls    24  │
│                            Errors        1   │
└──────────────────────────────────────────────┘
```

Internal split:

```text
68% application
32% Tellann panel
```

---

# 9. Interactive recorder

If possible, make this real HTML rather than video.

User presses:

```text
[ Start demonstration ]
```

Then an illustrative application becomes active.

Actions:

```text
Browse Product
Add to Cart
Checkout
Submit Payment
```

The Tellann pane updates alongside it:

```text
BUTTON_CLICK
STATE_TRANSITION
API_REQUEST
API_RESPONSE
```

This will explain the feature more effectively than static copy.

---

# 10. Interactive recorder dimensions

Desktop:

```text
1200 × 720
```

Tablet:

```text
900 × 600
```

Mobile:

Stack:

```text
Demo app
↓
Tellann observer
```

Minimum mobile visual height:

```text
620–700px
```

---

# 11. Recording state UI

Display:

```text
DEMONSTRATION

● Recording

02:14

Workflow
Checkout

Events
184

States observed
12

API requests
24

Errors
1

[ Stop demonstration ]
```

Do not surface internal Kafka, database, or infrastructure detail here.

This is user-facing workflow information.

---

# 12. Section — Three demonstration types

The DDMS defines three session types. 

Use three large cards.

---

## Guided Demonstration

> Intentionally demonstrate specific workflows you want Tellann to understand.

Examples:

```text
Registration
Login
Checkout
Subscription purchase
```

Use when:

```text
documenting critical workflows
establishing initial coverage
validating a known feature
```

---

## Exploratory Demonstration

> Navigate freely and let Tellann discover what emerges.

Examples:

```text
Explore settings
Navigate products
Open different screens
Try alternate paths
```

Use when:

```text
mapping unfamiliar applications
discovering workflow structure
broadening the Behavior Graph
```

---

## Validation Demonstration

> Demonstrate behavior after a change.

Example:

```text
Release v2.1

Previous:
Checkout

Current:
Checkout
```

The DDMS defines validation demonstrations as walkthroughs performed after changes. 

Be careful not to market this as full automated regression detection; that belongs to Phase 3. 

---

# 13. Demonstration-type visual design

Each card:

```text
360 × 420px
```

Desktop:

```text
3 columns
24px gap
```

Each gets a miniature visual.

### Guided

```text
Login
 ↓
Products
 ↓
Checkout
```

### Exploratory

```text
         Products
        ↙       ↘
Search           Profile
   ↘             ↙
      Settings
```

### Validation

```text
v2.0
Checkout

vs

v2.1
Checkout
```

---

# 14. Section — What Tellann captures

Heading:

> **The demonstration is captured as behavior, not raw application content.**

Tellann records categories including navigation, UI, form, state, API, error and session activity. 

Use grouped columns.

### Navigation

```text
PAGE_VISIT
ROUTE_CHANGE
PAGE_EXIT
```

### UI

```text
BUTTON_CLICK
LINK_CLICK
COMPONENT_INTERACTION
```

### Forms

```text
FORM_STARTED
FORM_SUBMITTED
FORM_VALIDATION_FAILED
```

### States

```text
STATE_ENTERED
STATE_EXITED
STATE_TRANSITION
```

### API

```text
API_REQUEST
API_RESPONSE
API_ERROR
```

### Errors

```text
ERROR_OCCURRED
CLIENT_ERROR
SERVER_ERROR
```

---

# 15. Event stream animation

Use a product-like stream.

Master:

```text
1440 × 900
```

Display:

```text
1000 × 625
```

Visual:

```text
08:42:17 PAGE_VISIT
08:42:19 BUTTON_CLICK
08:42:19 STATE_TRANSITION
08:42:20 API_REQUEST
08:42:20 API_RESPONSE
08:42:24 FORM_SUBMITTED
```

New events should enter from the bottom.

Animation speed:

```text
1 event every 400–600ms
```

Then pause.

---

# 16. Event anatomy

Allow one event to expand:

```json
{
  "eventType": "BUTTON_CLICK",
  "sessionId": "ses_3817",
  "timestamp": "08:42:19",
  "source": "frontend-sdk",
  "metadata": {
    "buttonId": "checkout"
  }
}
```

The canonical event model includes session, source, timestamp, application and metadata context. 

---

# 17. Section — What happens while recording

Heading:

> **Tellann builds context as the demonstration unfolds.**

Visual process:

```text
ACTION
 ↓
EVENT
 ↓
SESSION CONTEXT
 ↓
CURRENT STATE
 ↓
TRANSITION
 ↓
WORKFLOW CONTEXT
```

Example:

```text
Click Checkout
      ↓
BUTTON_CLICK
      ↓
Session SES-3817
      ↓
CART_ACTIVE
      ↓
CHECKOUT
      ↓
Checkout Workflow
```

---

# 18. Context animation

Source:

```text
1600 × 900
```

Render:

```text
960 × 540
```

As the developer performs actions, highlight:

```text
current state
current workflow
current API call
```

This gives the impression that Tellann is constructing structure from observed behavior.

---

# 19. Section — When recording stops

Heading:

> **Stopping the demonstration starts the analysis.**

This is the critical transition.

Visual:

```text
[ Stop demonstration ]

        ↓

Processing session

Ordering events
Extracting states
Discovering transitions
Building workflows
Generating graph
Calculating coverage
Analyzing gaps
Analyzing endpoints
Generating report
```

This sequence matches the documented transformation from captured events into sessions, states, workflows, Behavior Graphs and reports. 

---

# 20. Processing animation

Do not use a generic spinner.

Use progress stages:

```text
✓ Session reconstructed
✓ 12 states discovered
✓ 18 transitions discovered
✓ 3 workflows identified
✓ Behavior Graph generated
● Calculating coverage
```

Then:

```text
Analysis complete
```

Duration:

```text
6–8 second illustrative loop
```

Actual application processing times should not be implied unless measured.

---

# 21. Section — Behavior Graph generation

Heading:

> **The walkthrough becomes a map of application behavior.**

Example:

```text
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
```

This exact conceptual transformation is defined in DDMS. 

---

# 22. Behavior Graph visual

Large full-width graph.

Master:

```text
1920 × 1140
```

Render:

```text
1280 × 760
```

Prefer SVG/canvas.

Graph animation:

```text
Session events appear
      ↓
States emerge
      ↓
Transitions connect
      ↓
Workflow boundary appears
      ↓
Graph settles
```

---

# 23. Graph interaction

Allow users to click nodes.

Example:

```text
CHECKOUT

Category
BUSINESS

Observed in
42 demonstration sessions

Incoming
CART_ACTIVE

Outgoing
PAYMENT_SUCCESS

Related workflow
Checkout
```

Use sample data label.

---

# 24. Section — Coverage generation

Heading:

> **See how much of the discovered workflow you demonstrated.**

Developer Demonstration Mode produces multiple coverage categories. 

Show:

```text
Workflow Coverage
State Coverage
Transition Coverage
Endpoint Coverage
Error Coverage
```

---

# 25. Coverage visual

Example:

```text
CHECKOUT

Overall coverage
72%

Workflow      72%
States        81%
Transitions   69%
Endpoints     87%
Errors        42%

Observed paths
18

Missing paths
7
```

Master:

```text
1600 × 1000
```

Render:

```text
820 × 512
```

---

# 26. Section — Missing flows

Heading:

> **The demonstration also reveals what you never showed.**

Missing-flow categories documented in DDMS include:

```text
Error flows
Alternative flows
Recovery flows
```

Examples:

```text
Login failure
Password reset
Account locked
Session expired
Payment failure
Guest checkout
Retry payment
```



---

# 27. Missing-flow visual

Show:

```text
OBSERVED

Cart
 ↓
Checkout
 ↓
Payment Success


NOT OBSERVED

Checkout
 ↓
Payment Failure
 ↓
Retry Payment
```

Solid:

```text
Observed
```

Dashed:

```text
Potential gap
```

Dimensions:

```text
1600 × 900 source
1000 × 562 render
```

---

# 28. Section — Missing states

Heading:

> **A successful workflow is only one state of reality.**

The DDMS defines missing-state categories such as: 

```text
Loading
Empty
Error
Recovery
```

Example cards:

```text
EMPTY_CART
Not observed

NO_RESULTS
Not observed

PAYMENT_FAILURE
Not observed

AUTHENTICATION_ERROR
Not observed
```

---

# 29. Gap animation

Observed state:

```text
CHECKOUT_SUCCESS
```

Then Tellann visually asks:

```text
What about...
```

and reveals:

```text
PAYMENT_FAILURE
SESSION_TIMEOUT
AUTHENTICATION_EXPIRY
```

Keep the language grounded:

> Potential quality gap

not:

> Tellann guarantees this is a defect.

---

# 30. Section — Session Replay

Heading:

> **Replay exactly how the demonstration unfolded.**

Session Replay reconstructs captured behavioral events into a chronological replay model rather than simply recording a video. 

---

# 31. Replay video

Master:

```text
1920 × 1200
```

Render:

```text
1100 × 688
```

Duration:

```text
8–10 seconds
```

Sequence:

```text
Play
↓
Route change
↓
Button click
↓
API request
↓
State transition
↓
Error event
↓
Seek backward
```

---

# 32. Replay interface

```text
┌──────────────────────────────────────────────────────┐
│ DEMO SESSION SES-3817                    06:42       │
├──────────────────────────────┬───────────────────────┤
│                              │ EVENT TIMELINE        │
│ Reconstructed app behavior   │                       │
│                              │ PAGE_VISIT           │
│                              │ BUTTON_CLICK         │
│                              │ STATE_TRANSITION     │
│                              │ API_REQUEST          │
│                              │ API_RESPONSE         │
├──────────────────────────────┴───────────────────────┤
│ ◀  ▶     ──────────●─────────────       1×          │
└──────────────────────────────────────────────────────┘
```

---

# 33. Section — Endpoint analysis

Heading:

> **See the API activity behind the demonstrated workflow.**

DDM outputs include endpoint analysis, with examples such as most used, slow, and error-prone endpoints. 

Example:

```text
POST /checkout
418ms

POST /payment
891ms
7.4% errors

GET /products
184ms
```

---

# 34. Endpoint visual

Master:

```text
1600 × 1000
```

Display:

```text
760 × 475
```

Layout:

```text
Endpoint              Avg      Errors
GET /products         184ms     0.2%
POST /cart            143ms     0.0%
POST /checkout        418ms     1.2%
POST /payment         891ms     7.4%
```

Then select `/payment`.

---

# 35. Section — Demonstration QA Report

Heading:

> **Every demonstration ends with something your team can use.**

The DDMS defines a Demonstration QA Report containing sections such as: 

```text
Executive Summary
Application Quality Summary
Coverage Score
Workflow Count

Workflow Coverage

Missing Flows

Missing States

Endpoint Analysis

Recommendations
```

Be careful with "quality score" if the current MVP implementation has not shipped one; the DDMS describes it, but the MVP excludes AI-based quality scoring. Label it according to actual implementation status. 

---

# 36. Report visual

Three-layer report stack.

Each report:

```text
1000 × 1280
```

Composite:

```text
1600 × 1100
```

Display:

```text
800 × 550
```

Foreground:

```text
DEMONSTRATION REPORT

Workflows discovered       6
Coverage                  74%

Missing flows              5
Missing states             8
Slow endpoints             2
```

---

# 37. Section — Multiple demonstrations

Heading:

> **One demonstration starts the model. More demonstrations expand it.**

Explain:

```text
Demo 1
Registration + Login

        ↓

Demo 2
Browse + Search

        ↓

Demo 3
Checkout

        ↓

Demo 4
Failure paths

        ↓

Richer Behavior Graph
More observed paths
Greater coverage
```

Behavior Graph generation is based on accumulated observed sessions and transitions. 

---

# 38. Multi-demo animation

Canvas:

```text
1600 × 900
```

Render:

```text
1000 × 562
```

Each demo adds nodes:

```text
Demo 1 → 5 states

Demo 2 → +4 states

Demo 3 → +6 states
```

Then the graph visually expands.

This reinforces the idea of an evolving behavioral model without claiming continuous production learning.

---

# 39. Section — Privacy

Heading:

> **Demonstrate behavior without sending Tellann your secrets.**

The privacy specifications require protection before telemetry leaves the client. 

Three columns.

### Captured

```text
Page visits
Routes
Clicks
State transitions
Workflow events
API metadata
Errors
```

### Masked

```text
Emails
User identifiers
Phone numbers
IP addresses
```

### Blocked

```text
Passwords
CVV
Card numbers
Tokens
Secrets
Private keys
```

---

# 40. Privacy animation

Visual:

```text
Application

Email:
philip@example.com

Password:
mypassword

       ↓

Tellann Privacy Filter

       ↓

Email:
ph***@example.com

Password:
[NOT CAPTURED]

BUTTON_CLICK:
CAPTURED
```

Master:

```text
1400 × 800
```

Render:

```text
900 × 514
```

---

# 41. Section — When to use Demonstration Mode

Heading:

> **Use it whenever behavior matters more than assumptions.**

Cards:

### Initial application mapping

```text
Teach Tellann the major workflows.
```

### Feature QA

```text
Demonstrate a new feature and see what paths were exercised.
```

### Release validation walkthrough

```text
Demonstrate important workflows after a change.
```

### Coverage expansion

```text
Record missing failure, recovery or alternative paths.
```

### Investigation baseline

```text
Create reproducible behavioral evidence for a workflow.
```

---

# 42. Audience strip

Optional:

```text
Software Engineers
QA Engineers
Startup Founders
Technical Product Managers
```

These are among the Phase 1 target users. 

---

# 43. Section — What Demonstration Mode is not

This is strategically important.

Heading:

> **Demonstration Mode does not pretend to be something it isn't.**

Use a clean comparison.

```text
It is

✓ Behavioral observation
✓ Workflow discovery
✓ Session reconstruction
✓ Coverage analysis
✓ Quality-gap detection


It is not

× Autonomous test execution
× Production user monitoring
× AI debugging
× Self-healing software
× Automated release validation
```

The MVP specifically excludes production monitoring, autonomous testing, AI recommendations, regression detection and other Phase 2/3 capabilities. 

This actually strengthens trust.

---

# 44. FAQ

Recommended questions:

```text
What is Developer Demonstration Mode?

Do I need to manually define workflows?

How long can a demonstration be?

What does Tellann capture?

Can I label a demonstration?

What is the difference between Guided and Exploratory mode?

Can I run multiple demonstrations?

Does each demonstration create a new Behavior Graph?

How are missing flows identified?

Can I replay a demonstration?

Does Tellann capture passwords?

Does Demonstration Mode run in production?

Does it automatically generate tests?
```

For unsupported operational limits such as maximum duration, do not invent a number until the application defines one.

---

# 45. Final CTA

### Eyebrow

```text
DEMONSTRATE YOUR FIRST WORKFLOW
```

### H2

> **Your application already contains the behavior. Tellann helps you see it.**

Supporting copy:

> Connect the SDK, start a demonstration, perform a real workflow, and turn that session into a clearer behavioral model of your software.

Buttons:

```text
[ Start free ]
[ Read the Demonstration Mode guide ]
```

---

# 46. Complete media inventory

| Asset                      | Type             |       Master |    Display |
| -------------------------- | ---------------- | -----------: | ---------: |
| Hero demonstration         | Video            |    1920×1200 |   1280×800 |
| Mobile hero                | Video            |    1080×1350 | Responsive |
| Concept transformation     | SVG              |     1600×900 |   1000×562 |
| Live recorder              | Interactive HTML |            — |   1200×720 |
| Demonstration type visuals | SVG              | 720×480 each |    360×240 |
| Event stream               | Animated UI      |     1440×900 |   1000×625 |
| Recording context          | SVG/UI           |     1600×900 |    960×540 |
| Processing lifecycle       | Animated UI      |     1440×900 |    900×562 |
| Behavior Graph             | SVG/Canvas       |    1920×1140 |   1280×760 |
| Coverage                   | UI capture       |    1600×1000 |    820×512 |
| Missing flow               | SVG              |     1600×900 |   1000×562 |
| Session Replay             | Video            |    1920×1200 |   1100×688 |
| Endpoint analysis          | UI               |    1600×1000 |    760×475 |
| QA Report stack            | Composite        |    1600×1100 |    800×550 |
| Multi-demo expansion       | SVG              |     1600×900 |   1000×562 |
| Privacy pipeline           | SVG              |     1400×800 |    900×514 |

---

# 47. Animation language

Animations should represent:

```text
recording
capture
ordering
construction
discovery
expansion
comparison
```

Good:

```text
event enters timeline
state appears
transition line draws
workflow boundary forms
graph expands
coverage resolves
missing branch appears
```

Avoid:

```text
AI particles
neural networks
glowing brains
floating orbs
random 3D geometry
```

Developer Demonstration Mode's appeal is that its mechanism is understandable.

---

# 48. Desktop layout

General page width:

```text
1280px
```

Large graph sections:

```text
1440px
```

Text:

```text
620–680px max
```

Grid:

```text
12 columns
24px gap
```

---

# 49. Spacing

Desktop:

```text
Hero top               130–150px
Major sections         140–180px
Heading → copy          20–24px
Copy → media            48–64px
```

Mobile:

```text
Major sections          88–104px
Heading → copy          16px
Copy → media            32px
```

---

# 50. Responsive behavior

### Desktop

Full split screens and graphs.

### Tablet

Text above media where space becomes tight.

### Mobile

Use natural vertical order:

```text
Start
↓
Record
↓
Capture
↓
Process
↓
Graph
↓
Analyze
```

Do not shrink desktop Behavior Graphs until labels become illegible.

Create simplified graph compositions instead.

---

# 51. Video behavior

All product videos:

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

Hero can autoplay immediately.

Below-the-fold:

```text
lazy preload
IntersectionObserver
```

Each gets a static poster.

---

# 52. Reduced motion

For:

```css
prefers-reduced-motion: reduce
```

replace:

```text
hero loop
event stream
graph construction
processing animation
multi-demo expansion
```

with the final static state.

---

# 53. SEO

### Title

> **Developer Demonstration Mode | Tellann**

### Expanded title

> **Tellann Demonstration Mode — Turn Application Walkthroughs Into QA Intelligence**

### Meta description

> Demonstrate your application and let Tellann capture behavioral events, discover workflows, build Behavior Graphs, measure coverage, identify missing states and flows, replay sessions, and generate QA reports.

---

# 54. Internal links

Recommended contextual links:

```text
How Tellann Works
→ /product/how-it-works

Behavior Graph
→ /product/behavior-graph

Session Replay
→ /product/session-replay

Coverage Analysis
→ /product/coverage

SDK Documentation
→ /developers/sdk

Privacy
→ /privacy

Roadmap
→ /roadmap
```

---

# 55. Analytics events

Track:

```text
demonstration_hero_cta_clicked

demonstration_video_played
demonstration_video_completed

demo_type_selected
guided_demo_selected
exploratory_demo_selected
validation_demo_selected

interactive_demo_started
interactive_demo_completed

behavior_graph_interacted

privacy_section_viewed

demonstration_docs_clicked
demonstration_signup_clicked
```

For signup:

```json
{
  "source": "demonstration_mode"
}
```

---

# 56. Component structure

```tsx
<DemonstrationModePage>
  <SiteHeader />

  <DemonstrationHero />

  <DemonstrationConcept />

  <InteractiveDemonstration />

  <DemonstrationTypes />

  <CapturedBehavior />

  <RecordingContext />

  <ProcessingLifecycle />

  <GeneratedBehaviorGraph />

  <CoverageOutput />

  <MissingFlowOutput />

  <SessionReplayOutput />

  <EndpointAnalysisOutput />

  <DemonstrationReport />

  <MultipleDemonstrations />

  <DemonstrationPrivacy />

  <DemonstrationUseCases />

  <ScopeBoundary />

  <FAQ />

  <FinalCTA />

  <SiteFooter />
</DemonstrationModePage>
```

---

# 57. The page's narrative

The whole page should resolve into this:

```text
START
You begin a demonstration.

      ↓

PERFORM
You use the application normally.

      ↓

OBSERVE
Tellann captures behavioral events.

      ↓

RECONSTRUCT
Those events become a session.

      ↓

UNDERSTAND
States, actions and transitions emerge.

      ↓

DISCOVER
Connected behavior becomes workflows.

      ↓

MODEL
Workflows become the Behavior Graph.

      ↓

MEASURE
Tellann calculates what was observed.

      ↓

QUESTION
Unobserved states and flows become visible.

      ↓

INVESTIGATE
Replay and endpoint data provide context.

      ↓

COMMUNICATE
Everything becomes QA evidence.
```

That is what makes `/product/demonstration-mode` different from the broader `/product` and `/product/how-it-works` pages: it should make the visitor understand that **the demonstration itself is the seed from which Tellann’s entire Phase 1 behavioral model grows**.   
