# `/product/session-replay` — Complete Page Specification

`/product/session-replay` should position Session Replay as the **evidence and investigation layer** of Tellann.

The key distinction must be explicit:

> **Tellann Session Replay is not simply a video recording of a user's screen. It is a behavioral reconstruction generated from captured telemetry.**

The Session Replay specification defines the lifecycle as captured events → reconstructed session → chronological timeline → replay model → investigation. It exists to support workflow analysis, graph generation, coverage analysis, and debugging context. 

---

# 1. Position in the Product story

The Product section now progresses naturally:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does the system work?

        ↓

/product/demonstration-mode
How is behavior captured?

        ↓

/product/behavior-graphs
How is behavior modeled?

        ↓

/product/workflow-discovery
How are meaningful workflows discovered?

        ↓

/product/session-replay
What actually happened during an observed session?
```

The conceptual distinction is:

```text
BEHAVIOR GRAPH
Structure.

WORKFLOW DISCOVERY
Meaning.

SESSION REPLAY
Evidence.
```

---

# 2. Page objectives

The page should answer:

```text
What is Session Replay?

What exactly gets replayed?

Is this a screen recording?

How are sessions reconstructed?

What can I inspect during playback?

Can I jump directly to an error or API event?

How does replay connect to workflows?

How does replay connect to Behavior Graphs?

What privacy protections exist?

How do I know the replay is complete?

What happens when events are missing?

How long are replay assets retained?

What changes in future product phases?
```

---

# 3. Recommended page architecture

```text
/product/session-replay
│
├── 01 Global Navigation
├── 02 Hero
├── 03 What Session Replay Is
├── 04 From Events to Replay
├── 05 Replay Viewer
├── 06 Event Timeline
├── 07 Workflow Context
├── 08 API & Error Context
├── 09 Navigation & Controls
├── 10 Jump to Evidence
├── 11 Replay + Behavior Graph
├── 12 Replay + Coverage
├── 13 Replay Integrity
├── 14 Privacy by Default
├── 15 Session Summary
├── 16 Demonstration Replay
├── 17 Multiple Session Investigation
├── 18 What Replay Does Not Capture
├── 19 Future Replay Evolution
├── 20 FAQ
├── 21 Final CTA
└── 22 Footer
```

---

# 4. Hero

### Eyebrow

```text
SESSION REPLAY
```

### H1

> **Replay the behavior behind the insight.**

Alternative:

> **See exactly how the session unfolded.**

I would use the first because it links replay to the rest of Tellann.

### Supporting copy

> Reconstruct observed sessions as chronological behavioral timelines. Inspect navigation, interface interactions, state changes, workflow activity, API calls, and errors without relying on incomplete reproduction steps.

Tellann's replay model includes navigation, UI, forms, state, workflow, API, error, and session events. 

### CTAs

```text
[ Explore a replay ]
[ See how replay is built → ]
```

Optional tertiary:

```text
Explore Behavior Graphs →
```

---

# 5. Hero media

The hero should be an **actual replay-interface recording**.

Not an abstract animation.

## Sequence

```text
1. Open recorded session
2. Replay starts
3. Timeline advances
4. Page transition appears
5. Button interaction is highlighted
6. API request appears
7. State changes
8. Error occurs
9. Playback pauses automatically
10. Error details open
11. User jumps to related workflow
```

### Duration

```text
12–15 seconds
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
   ↓
48px
   ↓
Full-width replay viewer
```

---

# 6. Hero replay interface

Recommended composition:

```text
┌────────────────────────────────────────────────────────────┐
│ Session SES-3817                             06:42         │
├─────────────────────────────────┬──────────────────────────┤
│                                 │ EVENT TIMELINE           │
│                                 │                          │
│      Reconstructed             │ 00:00 SESSION_STARTED    │
│      application behavior      │ 00:04 PAGE_VISIT         │
│                                 │ 00:09 BUTTON_CLICK       │
│                                 │ 00:11 STATE_TRANSITION   │
│                                 │ 00:12 API_REQUEST        │
│                                 │ 00:13 API_ERROR          │
│                                 │ 00:14 ERROR_OCCURRED     │
├─────────────────────────────────┴──────────────────────────┤
│ ◀  ▶       ─────────●──────────────        1×             │
└────────────────────────────────────────────────────────────┘
```

Internal ratio:

```text
68% replay canvas
32% event timeline
```

---

# 7. Mobile hero

Do not shrink the full desktop viewer.

Use:

```text
Replay canvas
      ↓
Playback controls
      ↓
Current event
      ↓
Timeline
```

Master edit:

```text
1080 × 1350
4:5
```

Displayed:

```text
width: calc(100vw - 32px)
```

Timeline should show only approximately 4–6 events at once.

---

# 8. Section — What Session Replay actually is

### H2

> **A reconstruction of behavior—not another screen recording.**

Use a comparison.

| Traditional screen recording          | Tellann Session Replay                  |
| ------------------------------------- | --------------------------------------- |
| Primarily visual footage              | Reconstructed behavioral timeline       |
| Harder to query structurally          | Events remain structured                |
| UI-focused                            | UI + states + workflows + APIs + errors |
| Limited relationship to graph         | Linked to behavioral model              |
| Mostly passive playback               | Investigable event timeline             |
| Sensitive content can appear visually | Privacy controls operate before storage |

The specification explicitly states that Tellann's replay is an interpretation of recorded events rather than a screen recording. 

---

# 9. Comparison visual

Use two panels.

```text
SCREEN RECORDING

[ flat video timeline ]

           VS

TELLANN REPLAY

PAGE_VISIT
    ↓
BUTTON_CLICK
    ↓
API_REQUEST
    ↓
STATE_TRANSITION
    ↓
ERROR_OCCURRED
```

Master:

```text
1600 × 800
```

Display:

```text
1000 × 500
```

Prefer HTML/SVG.

---

# 10. Section — From events to replay

### H2

> **Replay begins with structured telemetry.**

The formal replay lifecycle is: capture events → build session → generate timeline → create replay model → persist replay assets → playback. 

Visual:

```text
EVENTS
   ↓
SESSION
   ↓
ORDERING
   ↓
TIMELINE
   ↓
REPLAY MODEL
   ↓
REPLAY VIEWER
```

---

# 11. Replay construction animation

Master:

```text
1800 × 1000
```

Display:

```text
1100 × 611
```

Animation:

```text
Raw events appear
        ↓
Grouped under sessionId
        ↓
Sorted chronologically
        ↓
Timeline forms
        ↓
Workflow labels attach
        ↓
Replay interface appears
```

Duration:

```text
7–9 seconds
```

---

# 12. Session ordering explanation

Tellann's replay reconstruction is ordered using:

```text
Timestamp
    ↓
Sequence Number
    ↓
Arrival Order
```



This is a good technical-detail callout beneath the animation.

Do not put it in the hero.

---

# 13. Section — The Replay Viewer

### H2

> **One place to inspect the full behavioral session.**

This should be the page's largest interactive section.

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Session Replay                 Workflow: Checkout       │
├──────────────────────────────┬───────────────────────────┤
│                              │ TIMELINE                  │
│                              │                           │
│   Reconstructed behavior     │ Navigation               │
│                              │ UI                        │
│                              │ State                     │
│                              │ API                       │
│                              │ Errors                    │
│                              │                           │
├──────────────────────────────┴───────────────────────────┤
│ Playback                                                │
└──────────────────────────────────────────────────────────┘
```

---

# 14. Replay Explorer dimensions

Desktop:

```text
1280 × 800px
```

Section:

```text
max-width: 1400px
```

Tablet:

```text
960 × 720px
```

Mobile:

```text
Replay
↓
Controls
↓
Timeline
↓
Inspector
```

---

# 15. Replay Viewer controls

The specification defines:

```text
Play
Pause
Seek
Previous Event
Next Event
1×
2×
5×
10×
```



Recommended UI:

```text
|◀ Event|   ▶   |Event ▶|

───────────●────────────────

Speed
[1×] [2×] [5×] [10×]
```

For the marketing demo, 1× and 2× are enough to expose initially; reveal the others through the dropdown.

---

# 16. Section — Event Timeline

### H2

> **Every important moment remains inspectable.**

Show event categories grouped by type.

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
TAB_CHANGE
DROPDOWN_SELECTION
COMPONENT_INTERACTION
```

### Forms

```text
FORM_STARTED
FORM_SUBMITTED
FORM_VALIDATION_FAILED
```

### State

```text
STATE_ENTERED
STATE_EXITED
STATE_TRANSITION
```

### Workflow

```text
WORKFLOW_STARTED
WORKFLOW_COMPLETED
WORKFLOW_FAILED
WORKFLOW_ABANDONED
```

### API

```text
API_REQUEST
API_RESPONSE
API_ERROR
API_TIMEOUT
```

### Errors

```text
ERROR_OCCURRED
CLIENT_ERROR
SERVER_ERROR
UNHANDLED_EXCEPTION
```

These replayable event categories are defined by the Session Replay specification. 

---

# 17. Timeline visual

Master:

```text
1440 × 1000
```

Display:

```text
720 × 500
```

Example:

```text
12:00:00  SESSION_STARTED

12:00:04  PAGE_VISIT
          /products

12:00:08  BUTTON_CLICK
          checkout-button

12:00:11  STATE_TRANSITION
          CART → CHECKOUT

12:00:12  API_REQUEST
          POST /checkout

12:00:13  API_ERROR
          503

12:00:14  ERROR_OCCURRED
```

---

# 18. Timeline interaction

Clicking an event should:

```text
1. Move replay position
2. Highlight relevant application state
3. Open event metadata
4. Highlight associated workflow
5. Show linked API/error context where applicable
```

This is much more valuable than a passive video timeline.

---

# 19. Event inspector

Example:

```text
API_ERROR

Timestamp
00:04:13

Endpoint
POST /payment

Status
503

Duration
893 ms

Workflow
Checkout

State
PAYMENT_PENDING
```

If values are illustrative:

```text
Sample application data
```

must be visible somewhere in the demo.

---

# 20. Section — Workflow context

### H2

> **Replay the session as a workflow, not a list of clicks.**

Show two synchronized timelines:

```text
EVENTS

PAGE_VISIT
BUTTON_CLICK
STATE_TRANSITION
API_REQUEST
API_RESPONSE

        ↓

WORKFLOW

PRODUCT_VIEW
     ↓
CART_ACTIVE
     ↓
CHECKOUT
     ↓
PAYMENT_SUCCESS
```

This is where Tellann differentiates replay from generic replay products.

---

# 21. Workflow Timeline visual

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Layout:

```text
EVENT TIMELINE         WORKFLOW TIMELINE
     55%                     45%
```

Animate synchronized highlighting between both.

---

# 22. Workflow markers

At specific times show:

```text
WORKFLOW_STARTED
Checkout

WORKFLOW_COMPLETED
Checkout
```

or:

```text
WORKFLOW_FAILED
Checkout
```

These are part of Tellann's replayable workflow activity. 

---

# 23. Section — API & Error Context

### H2

> **See what the application was doing behind the interface.**

Replay should expose:

```text
Requests
Responses
Timeouts
Errors
Exceptions
```

The replay investigation view explicitly includes API and error timelines. 

Example:

```text
00:04:12

CHECKOUT
     ↓

POST /payment

Duration
893ms

Status
503

     ↓

API_ERROR

     ↓

PAYMENT_FAILURE
```

---

# 24. API context visual

Master:

```text
1600 × 900
```

Display:

```text
900 × 506
```

Use a synchronized overlay rather than a separate table.

```text
Application State
CHECKOUT

        ↓

POST /payment

        ↓

503

        ↓

PAYMENT_FAILED
```

---

# 25. Section — Jump directly to evidence

### H2

> **Skip the hunt. Jump to the moment that matters.**

Provide filter buttons:

```text
[ All events ]
[ Errors ]
[ API failures ]
[ State changes ]
[ Workflow events ]
```

Then:

```text
3 errors found

00:02:41 API_ERROR
00:04:13 ERROR_OCCURRED
00:05:22 FORM_SUBMISSION_FAILED
```

Clicking one seeks directly to the event.

---

# 26. Error-jump video

This should be the page's second product video.

### Master

```text
1920 × 1200
```

### Display

```text
1000 × 625
```

### Duration

```text
7–9 seconds
```

Sequence:

```text
Open replay
↓
Filter Errors
↓
Select API_ERROR
↓
Timeline seeks
↓
Relevant event highlights
↓
Inspector opens
```

---

# 27. Section — Replay + Behavior Graph

### H2

> **Move between the behavioral map and the session that created it.**

Visual relationship:

```text
BEHAVIOR GRAPH

CART
 ↓
CHECKOUT
 ↓
PAYMENT_FAILED

       ↓ supporting evidence

SESSION SES-3817

00:04:11 STATE_TRANSITION
00:04:12 API_REQUEST
00:04:13 API_ERROR
```

The graph and replay systems are deliberately connected: replay serves as evidence for behavioral graph generation and investigation. 

---

# 28. Graph → Replay interaction

Click graph edge:

```text
CHECKOUT → PAYMENT_FAILED
```

Then:

```text
Observed in 38 sessions

[ View supporting sessions ]
```

Select one:

```text
SES-3817
```

Replay opens at the relevant timestamp.

This should eventually be mirrored in the real product.

---

# 29. Graph-to-replay media

Prefer actual product recording.

Master:

```text
1920 × 1200
```

Render:

```text
1000 × 625
```

Duration:

```text
8–10 seconds
```

---

# 30. Section — Replay + Coverage

### H2

> **Understand which paths produced your coverage.**

Show:

```text
CHECKOUT
Coverage 72%

Observed path
Product → Cart → Checkout → Success

Supporting sessions
143
```

Click:

```text
View sessions
```

Then replay one.

This helps explain that coverage results are rooted in observed behavior rather than arbitrary percentages.

---

# 31. Coverage connection visual

Master:

```text
1500 × 800
```

Display:

```text
960 × 512
```

Concept:

```text
COVERAGE REPORT

Observed path
██████████

         ↓

143 sessions

         ↓

Replay evidence
```

---

# 32. Section — Replay integrity

This is an important technical-trust section.

### H2

> **A replay should tell you how complete its evidence is.**

The Session Replay specification defines integrity metrics including:

```text
Timeline Completeness
Missing Event Count
Ordering Accuracy
Privacy Compliance Score
Replay Accuracy Score
```



Do not hide incomplete data.

---

# 33. Integrity UI

Example:

```text
REPLAY INTEGRITY

Timeline completeness
98%

Ordering accuracy
100%

Missing events
3

Privacy filtering
Applied
```

If you have not actually implemented "Replay Accuracy Score" yet, do not show it as a live feature simply because the specification anticipates it.

---

# 34. Integrity media

Master:

```text
1400 × 800
```

Display:

```text
760 × 434
```

Use a compact product card rather than a giant section.

---

# 35. Missing event representation

If replay detects missing information:

```text
00:03:08 API_REQUEST

      ↓

⚠ EVENT GAP
~620 ms

      ↓

00:03:09 API_RESPONSE
```

This is better than silently pretending the timeline is perfect.

The replay specification requires missing events to be flagged. 

---

# 36. Section — Privacy by default

### H2

> **Replay behavior without replaying secrets.**

Tellann's replay privacy rules prohibit sensitive authentication, financial, credential, and identity data from being replayed. 

Use three classes.

### Recorded

```text
Navigation
Clicks
UI interactions
State changes
Workflow progression
API metadata
Errors
```

### Masked

```text
Emails
User identifiers
Contact information
Configured fields
```

### Never recorded

```text
Passwords
PINs
Security answers
Card numbers
CVV
Payment tokens
JWTs
Access tokens
Refresh tokens
API secrets
Private keys
Raw uploaded files
```

The privacy specification also requires privacy controls to operate before protected information enters storage or analytics. 

---

# 37. Privacy replay visual

Show the replay pane before filtering:

```text
Email
user@example.com

Password
••••••••
```

Then privacy filter:

```text
          ↓
```

Replay:

```text
Email
***@example.com

Password
[NOT CAPTURED]
```

Master:

```text
1400 × 800
```

Display:

```text
900 × 514
```

---

# 38. Privacy animation

Duration:

```text
4–5 seconds
```

Sequence:

```text
Behavior occurs
↓
Field classifier identifies sensitive field
↓
Privacy filter applies
↓
Protected value disappears
↓
Safe event reaches Tellann
```

Avoid showing realistic credit-card values even in demos.

---

# 39. Section — Session Summary

### H2

> **See the session before you press play.**

Every replay should expose high-level context such as:

```text
Duration
Event count
Workflow count
Errors
API activity
```

These categories are part of the replay investigation view. 

Example:

```text
SESSION SES-3817

Duration
06:42

Events
428

Workflows
6

Errors
3

API requests
48
```

---

# 40. Summary card dimensions

Master:

```text
1200 × 700
```

Display:

```text
720 × 420
```

Use real HTML in implementation.

---

# 41. Session metadata

Optional details:

```text
Session type
DEMONSTRATION

Application
Storefront Demo

Started
10:32:18

Ended
10:39:00

Environment
demo
```

Don't expose sensitive user-identifying information.

---

# 42. Section — Demonstration Session Replay

### H2

> **Your demonstration remains inspectable after analysis.**

Connect this directly to Demonstration Mode:

```text
Start demonstration
       ↓
Perform workflow
       ↓
End session
       ↓
Behavior analysis
       ↓
Replay generated
```

Replay is an explicit Phase 1 output of Demonstration Mode. 

---

# 43. Demonstration-to-replay video

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
10–12 seconds
```

Sequence:

```text
Start demonstration
↓
Checkout workflow
↓
Stop
↓
Analysis
↓
Open session
↓
Replay
```

This could be reused partially from the Demonstration Mode page.

---

# 44. Section — Multiple session investigation

### H2

> **One workflow can have many supporting sessions.**

Example:

```text
CHECKOUT

Supporting sessions

SES-3817    Success
SES-3824    Success
SES-3901    Payment failure
SES-4012    Success
SES-4044    Validation failure
```

Allow:

```text
[ Compare evidence ]
```

But do not imply formal Phase 3 regression comparison.

For Phase 1, this is simply selecting and inspecting separate recorded sessions.

---

# 45. Session list visual

Real HTML table rather than an image.

Desktop:

```text
1200px wide
```

Columns:

```text
Session
Duration
Workflow
Events
Errors
Recorded
```

Mobile:

Convert rows into stacked cards.

---

# 46. Section — Replay asset structure

A small technical section can explain what Tellann actually stores conceptually:

```text
Replay
├── Timeline
├── Workflow context
├── Errors
├── API activity
└── Replay metadata
```

This follows the documented replay asset model. 

Do not expose storage implementation details unless the user expands:

```text
Technical details
```

---

# 47. Retention callout

The specification defines:

```text
Session Replay default retention
90 days

Configurable by tenant
```



However, customer-facing retention is also plan-dependent in the pricing model, so the public page should avoid a universal "90-day guarantee" unless product billing behavior actually matches the backend retention specification.

Safer copy:

> Replay retention depends on your plan and organization policy.

Link:

```text
View pricing →
```

---

# 48. Section — What Replay does not capture

This should be explicit.

### H2

> **More data is not always better data.**

Tellann should not capture:

```text
Passwords
OTP/PIN values
Payment card information
Authentication tokens
Private keys
Highly sensitive identity data
Raw uploaded document contents
Images
Videos
Audio contents
```

Only appropriate metadata may be captured for uploaded files. 

This section will help enterprise/security visitors considerably.

---

# 49. Section — Why this is useful

Rather than generic personas, show actual investigation questions.

### Question 1

> What happened before checkout failed?

```text
Replay → jump to API_ERROR
```

### Question 2

> Which route led to this state?

```text
Replay → preceding navigation
```

### Question 3

> Was this path actually demonstrated?

```text
Coverage → supporting sessions
```

### Question 4

> Which API call was involved?

```text
Replay → API timeline
```

### Question 5

> Where did this graph edge come from?

```text
Behavior Graph → supporting replay
```

This anchors the feature in engineering work.

---

# 50. Future replay evolution

Keep this short and explicitly phased.

### Phase 1 — Behavioral QA

```text
Demonstration session replay
Chronological timeline
Workflow context
API context
Error context
Behavior Graph support
Coverage support
```

These are current MVP-oriented capabilities. 

### Phase 2 — Planned

```text
Production session replay
Journey intelligence context
Error correlation
Workflow health investigation
Friction / bottleneck context
```

The replay specification places production replay and error correlation in Phase 2. 

### Phase 3 — Planned

```text
Regression investigation
Generated-test validation
Failure-simulation analysis
Anomaly investigation
Quality-intelligence explanations
```

Label these clearly:

```text
PLANNED
```

---

# 51. FAQ

Recommended questions:

```text
What is Tellann Session Replay?

Is Session Replay a screen recording?

What does Tellann replay?

What data is not captured?

Can I jump directly to an error?

Can I inspect API activity?

Can I view the workflow associated with a session?

Can a Behavior Graph link back to a replay?

How is event ordering preserved?

What happens when events are missing?

Can I change playback speed?

Can I replay demonstration sessions?

How long are replays retained?

Does Tellann support production-user replay today?

Does replay include passwords or card details?
```

---

# 52. Final CTA

### Eyebrow

```text
FOLLOW THE EVIDENCE
```

### H2

> **See the session behind the behavior.**

Supporting copy:

> Record a demonstration, reconstruct the session, and investigate the exact sequence of events, states, workflows, API activity, and errors behind what Tellann discovered.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Secondary:

```text
/product/demonstration-mode
```

---

# 53. Complete media inventory

| Asset                     | Type             |    Master |     Display |
| ------------------------- | ---------------- | --------: | ----------: |
| Hero Replay Viewer        | Product video    | 1920×1200 |    1280×800 |
| Mobile hero replay        | Video            | 1080×1350 |  Responsive |
| Replay vs recording       | SVG/HTML         |  1600×800 |    1000×500 |
| Event → Replay pipeline   | Animated SVG     | 1800×1000 |    1100×611 |
| Replay Explorer           | Interactive HTML |         — |    1280×800 |
| Event Timeline            | UI/HTML          | 1440×1000 |     720×500 |
| Workflow Timeline         | Animated UI      |  1600×900 |    1000×562 |
| API/Error context         | Animated UI      |  1600×900 |     900×506 |
| Jump-to-error interaction | Video            | 1920×1200 |    1000×625 |
| Graph → Replay            | Product video    | 1920×1200 |    1000×625 |
| Coverage → Replay         | SVG/UI           |  1500×800 |     960×512 |
| Replay integrity          | UI               |  1400×800 |     760×434 |
| Privacy filtering         | Animated SVG/UI  |  1400×800 |     900×514 |
| Session Summary           | HTML/UI          |  1200×700 |     720×420 |
| Demonstration → Replay    | Video            | 1920×1200 |    1100×688 |
| Supporting sessions list  | HTML             |         — | 1200px wide |

That gives roughly **16 visual surfaces**, but the number of separately exported assets should be much smaller because Replay Viewer, timeline, session summary, and error inspector should use the same UI component system.

---

# 54. Reusable Replay component architecture

Do not create multiple unrelated mockups.

Build something conceptually like:

```tsx
<SessionReplay
  session={session}
  mode="interactive"
/>
```

Modes:

```ts
type ReplayMode =
  | "hero"
  | "full"
  | "timeline"
  | "workflow"
  | "error"
  | "api"
  | "privacy"
  | "graph-evidence";
```

Supporting components:

```tsx
<ReplayCanvas />
<ReplayTimeline />
<ReplayControls />
<EventInspector />
<WorkflowTimeline />
<ApiTimeline />
<ReplayIntegrity />
<SessionSummary />
```

This should eventually mirror the real dashboard implementation.

---

# 55. Replay page animation language

Motion should represent:

```text
chronology
cause
transition
correlation
investigation
```

Good:

```text
timeline advances
current event highlights
state changes
API call attaches
error marker appears
playhead seeks
workflow segment highlights
```

Avoid:

```text
floating UI panels
random particles
continuous glow
cinematic camera motion
```

The replay itself already contains enough motion.

---

# 56. Important visual rule

Avoid recreating the DOM as though Tellann were FullStory unless the product actually supports visual DOM reconstruction.

The current specification says replay is a **behavioral reconstruction** and lists recorded behavioral events. 

Therefore, if the current implementation renders a structured reconstructed application view rather than exact pixels, market exactly that.

Do not depict pixel-perfect website replay unless Tellann actually provides it.

---

# 57. Desktop grid

Standard sections:

```text
max-width: 1280px
12-column grid
24px gap
```

Large interactive replay:

```text
max-width: 1400px
```

Text:

```text
max-width: 640–680px
```

Page gutters:

```text
Desktop      32–48px
Tablet       24px
Mobile       16px
```

---

# 58. Section spacing

Desktop:

```text
Hero top             130–150px
Major sections       140–180px
Heading → copy       20–24px
Copy → media         48–64px
```

Mobile:

```text
Major sections       88–104px
Copy → media         32px
```

Replay Explorer itself should have generous breathing room because the UI contains substantial information.

---

# 59. Responsive behavior

### ≥1280px

Full replay canvas + side timeline.

### 1024–1279px

Reduce inspector width.

### 768–1023px

Move timeline below replay.

### <768px

Use:

```text
Replay canvas

Playback controls

Current event

Timeline

Inspector
```

Avoid horizontal overflow except in explicitly fullscreen modes.

---

# 60. Fullscreen mobile replay

Provide:

```text
[ Open replay fullscreen ]
```

In fullscreen:

```text
Canvas
Controls

Tabs:
Timeline | Workflow | API | Errors
```

This is much better than compressing all four contextual panels vertically.

---

# 61. Accessibility

Replay must not depend on visuals alone.

Every event should be keyboard-navigable.

Provide:

```text
Previous event
Next event
```

with proper accessible labels.

Also provide:

```text
Replay
Timeline only
```

The timeline-only mode means the feature remains usable when visual reconstruction is inaccessible or unnecessary.

---

# 62. Reduced motion

For:

```css
@media (prefers-reduced-motion: reduce)
```

do not autoplay.

Show:

```text
Static replay state
Timeline
[ Play replay ]
```

User must explicitly initiate playback.

Animated marketing diagrams become final static diagrams.

---

# 63. Video implementation

Product videos:

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

Hero can preload metadata.

All below-fold recordings:

```text
lazy-load near viewport
```

Every video needs a meaningful poster.

---

# 64. SEO

### Recommended title

> **Session Replay — Reconstruct Application Behavior | Tellann**

Alternative:

> **Behavioral Session Replay for Software QA | Tellann**

### Meta description

> Reconstruct application sessions with Tellann and inspect chronological navigation, interactions, state transitions, workflows, API activity, and errors behind your behavioral QA insights.

---

# 65. Suggested H1/H2 structure

```text
H1
Replay the behavior behind the insight.

H2
A reconstruction of behavior—not another screen recording.

H2
Replay begins with structured telemetry.

H2
One place to inspect the full behavioral session.

H2
Every important moment remains inspectable.

H2
Replay the session as a workflow, not a list of clicks.

H2
See what the application was doing behind the interface.

H2
Skip the hunt. Jump to the moment that matters.

H2
Move between the behavioral map and the session that created it.

H2
Understand which paths produced your coverage.

H2
A replay should tell you how complete its evidence is.

H2
Replay behavior without replaying secrets.

H2
See the session before you press play.

H2
Your demonstration remains inspectable after analysis.

H2
One workflow can have many supporting sessions.

H2
More data is not always better data.

H2
See the session behind the behavior.
```

---

# 66. Analytics events

Track:

```text
session_replay_hero_played
session_replay_hero_completed

replay_play_clicked
replay_pause_clicked
replay_seek_used
replay_speed_changed

replay_event_selected
replay_error_filter_used
replay_api_event_selected

replay_workflow_selected

replay_graph_opened
replay_coverage_opened

replay_integrity_viewed
replay_privacy_viewed

replay_signup_clicked
```

Useful properties:

```json
{
  "eventType": "API_ERROR",
  "workflow": "checkout",
  "action": "timeline_selected"
}
```

---

# 67. Strongest conceptual sequence

The page should repeatedly reinforce:

```text
EVENT
Something happened.

↓

SESSION
We know when it happened.

↓

WORKFLOW
We know what process it belonged to.

↓

STATE
We know where the application was.

↓

API / ERROR
We know what happened underneath.

↓

REPLAY
We can reconstruct the entire context.

↓

GRAPH / COVERAGE
We can connect that evidence back
to Tellann's quality model.
```

---

# 68. What must not be claimed

Do not currently advertise Session Replay as:

```text
pixel-perfect screen recording

full production RUM replay

automatic root-cause diagnosis

AI debugging

production friction analysis

automatic anomaly investigation
```

unless those things are actually implemented.

The MVP explicitly limits the current product to demonstration-based Behavioral QA; production monitoring, error correlation, journey intelligence, anomaly detection, and autonomous analysis belong to later phases. 

---

# 69. Final visitor experience

The user should reach the bottom thinking:

```text
Tellann tells me:

Checkout failed.

        ↓

I open the workflow.

        ↓

I see the transition:

CHECKOUT
    ↓
PAYMENT_FAILED

        ↓

I open supporting sessions.

        ↓

I select SES-3817.

        ↓

Replay jumps to the event.

        ↓

I can see:

what happened before it,
which state the application was in,
which API call occurred,
which error followed,
and what happened next.

        ↓

The graph gave me structure.

The replay gave me evidence.
```

That should be the defining idea of `/product/session-replay`: **Tellann does not treat replay as a detached recording feature. Replay is the path from behavioral intelligence back to the chronological evidence that created it.**   
