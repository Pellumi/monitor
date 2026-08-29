# `/product/behavior-graphs` — Complete Page Specification

`/product/behavior-graphs` should be one of the most important pages on the entire Tellann website because the **Behavior Graph is the central intelligence model of the product**.

The Behavior Graph specification describes it as the primary representation of how software behaves in practice: raw events and sessions are transformed into states, actions, transitions, and workflows, creating an evolving map that other Tellann capabilities can analyze. 

The core idea of the page should therefore be:

> **Your application is more than pages and endpoints. It is a network of behavior. Tellann maps that network.**

---

# 1. Role of this page

The surrounding pages answer different questions:

```text
/product
What is Tellann?

/product/how-it-works
How does the Tellann pipeline work?

/product/demonstration-mode
How does Tellann first observe my application?

/product/behavior-graphs
What does Tellann build from that behavior?
```

This page needs to answer:

```text
What is a Behavior Graph?

What is a state?

What is an action?

What is a transition?

What is a workflow?

How does Tellann discover these automatically?

What information does the graph contain?

How does the graph evolve across demonstrations?

How do I explore it?

How does it power coverage and gap detection?

What can the graph eventually enable?
```

---

# 2. Core page narrative

The visitor should gradually understand this transformation:

```text
RAW EVENTS

PAGE_VISIT
BUTTON_CLICK
FORM_SUBMITTED
API_RESPONSE
STATE_TRANSITION

        ↓

SESSIONS

        ↓

STATES

        ↓

ACTIONS

        ↓

TRANSITIONS

        ↓

WORKFLOWS

        ↓

BEHAVIOR GRAPH

        ↓

Coverage
Missing States
Missing Flows
Replay Context
Endpoint Context
QA Reports
```

That follows Tellann's formal graph-construction process. 

---

# 3. Page architecture

```text
/product/behavior-graphs
│
├── 01 Global Navigation
├── 02 Hero
├── 03 What Is a Behavior Graph?
├── 04 Anatomy of Behavior
├── 05 State Model
├── 06 Actions & Transitions
├── 07 Workflow Discovery
├── 08 How the Graph Is Built
├── 09 Interactive Graph Explorer
├── 10 Graph Metrics
├── 11 Coverage Through the Graph
├── 12 Missing States & Paths
├── 13 Graph + Session Replay
├── 14 Graph + Endpoint Context
├── 15 Graph Evolution
├── 16 Multiple Workflows / Application Map
├── 17 Graph Versioning
├── 18 Explainability & Traceability
├── 19 Future Graph Intelligence
├── 20 FAQ
├── 21 Final CTA
└── 22 Footer
```

---

# 4. Hero

### Eyebrow

```text
BEHAVIOR GRAPHS
```

### H1

> **See your application as a network of behavior.**

Alternative:

> **Turn application behavior into a map you can reason about.**

I prefer the first because it is simpler and more visually connected to the product.

### Supporting copy

> Tellann reconstructs observed sessions into states, actions, transitions, and workflows—creating a Behavior Graph that shows how your application actually behaves and provides the foundation for coverage analysis, missing-state detection, and behavioral QA.

The Behavior Graph is explicitly the central model supporting workflow discovery, coverage, gap detection, and future intelligence. 

### CTAs

```text
[ Explore a Behavior Graph ]
[ See how graphs are built → ]
```

Secondary should scroll to graph construction.

---

# 5. Hero visual

This should be the **largest graph visualization anywhere on the Tellann public site**.

Do not show a dashboard screenshot first.

Show the graph.

Example:

```text
                         ANONYMOUS
                              │
                           REGISTER
                              ▼
                         REGISTERED
                              │
                            LOGIN
                              ▼
                        AUTHENTICATED
                         /     |      \
                        /      |       \
                       ▼       ▼        ▼
                 PRODUCTS   PROFILE   SETTINGS
                     │
                 VIEW_PRODUCT
                     ▼
               PRODUCT_VIEW
                  /       \
                 ▼         ▼
           ADD_TO_CART    SEARCH
                 │
                 ▼
             CART_ACTIVE
                 │
              CHECKOUT
                 ▼
              CHECKOUT
              /      \
             /        \
            ▼          ▼
   PAYMENT_SUCCESS  PAYMENT_FAILURE
                          │
                        RETRY
                          │
                          └──────→ CHECKOUT
```

This should immediately communicate that Tellann is modeling **software behavior rather than infrastructure topology**.

---

# 6. Hero graph dimensions

Prefer SVG or Canvas/WebGL rather than an exported image.

### Design canvas

```text
1920 × 1180
```

### Desktop display

```text
max-width: 1380px
height: 760–820px
```

### Tablet

```text
960 × ~650px visible area
```

Allow panning.

### Mobile

Do **not** shrink the entire graph.

Use a simplified workflow:

```text
ANONYMOUS
    ↓
REGISTERED
    ↓
AUTHENTICATED
    ↓
PRODUCT
    ↓
CART
    ↓
CHECKOUT
   ↙      ↘
SUCCESS FAILURE
```

Mobile viewport:

```text
calc(100vw - 32px)
height: 620–680px
```

---

# 7. Hero graph animation

Do not load with all nodes already present.

Build it.

Sequence:

```text
0.0s
ANONYMOUS

0.7s
REGISTERED appears

1.2s
Transition line draws

2.0s
AUTHENTICATED

3.0s
Product branch forms

4.0s
Cart → Checkout

5.0s
Payment success

6.0s
Payment failure

7.0s
Retry loop

8.0s
Workflow boundaries appear
```

Then the graph becomes interactive.

Total:

```text
8–10 seconds
```

Run once on first viewport appearance.

Do not continuously rebuild the graph.

---

# 8. Hero graph interaction

Nodes should respond to hover.

Example:

```text
CHECKOUT

BUSINESS STATE

Sessions
143

Incoming transitions
3

Outgoing transitions
4

Observed workflows
2
```

Click opens a larger inspection panel.

This makes the page function as a lightweight product demo rather than merely a marketing illustration.

---

# 9. Section — What is a Behavior Graph?

### H2

> **A structural model of what your software actually does.**

The graph should be explained in plain language:

> A Behavior Graph represents meaningful application states and the observed actions that move the application between them. Connected state transitions form workflows, allowing Tellann to model how business processes unfold in practice.

That is the formal graph model defined by the Behavior Graph Specification. 

Visual formula:

```text
STATE
  +
ACTION
  +
TRANSITION
  +
WORKFLOW

      ↓

BEHAVIOR GRAPH
```

---

# 10. Concept diagram

Use four objects entering a graph.

```text
[ STATE ]

CHECKOUT

        +

[ ACTION ]

SUBMIT_PAYMENT

        +

[ TRANSITION ]

CHECKOUT
    ↓
PAYMENT_SUCCESS

        +

[ WORKFLOW ]

Purchase

        ↓

BEHAVIOR GRAPH
```

### Source

```text
1600 × 900
```

### Display

```text
1000 × 562
```

Prefer SVG.

---

# 11. Section — Anatomy of behavior

Heading:

> **Four concepts describe the application.**

Use four large cards.

```text
01 STATE
Where the user or system is.

02 ACTION
What caused something to happen.

03 TRANSITION
How the application moved.

04 WORKFLOW
What business objective the sequence represents.
```

These are the four foundational elements in the Behavior Graph model. 

---

# 12. Card dimensions

Desktop:

```text
2 × 2 grid

card:
560 × 310px approximately
```

Gap:

```text
24px
```

Mobile:

```text
1 column
```

Each card contains a miniature animated graph rather than an icon.

---

# 13. State card

Visual:

```text
┌─────────────────┐
│    CHECKOUT     │
│                 │
│ BUSINESS STATE  │
└─────────────────┘
```

Copy:

> A state represents a meaningful condition of the application.

Examples from the specification include:

```text
AUTHENTICATED
SEARCH_RESULTS
CART_ACTIVE
CHECKOUT
PAYMENT_SUCCESS
PAYMENT_FAILURE
```



---

# 14. State categories

Create a dedicated subsection.

### Navigation

```text
HOME
PRODUCTS
CHECKOUT
PROFILE
SETTINGS
```

### UI

```text
LOADING
EMPTY_CART
NO_RESULTS
MODAL_OPEN
```

### Business

```text
AUTHENTICATED
SUBSCRIPTION_ACTIVE
ORDER_COMPLETED
```

### Error

```text
PAYMENT_FAILED
AUTHENTICATION_FAILED
VALIDATION_ERROR
```

### System

```text
API_UNAVAILABLE
DATABASE_TIMEOUT
RATE_LIMITED
```

These categories are defined in the Behavior Graph Specification. 

---

# 15. State-category visualization

Rather than cards only, show a graph with different node shapes or subtle semantic labels.

For example:

```text
NAVIGATION
Products

        ↓

UI
Product Modal

        ↓

BUSINESS
Cart Active

        ↓

ERROR
Payment Failed
```

Avoid depending entirely on color.

Use:

```text
node label
category icon
border treatment
```

---

# 16. Section — Actions & transitions

### H2

> **Behavior exists in the movement between states.**

The page should explain that a transition is:

```text
State A
   │
 Action
   ▼
State B
```

Example:

```text
CART_ACTIVE
     │
     │ CHECKOUT_CLICK
     ▼
CHECKOUT
```

Actions can originate from captured interactions such as button clicks, form submissions, API activity, links and component interactions. 

---

# 17. Transition animation

Source:

```text
1440 × 720
```

Display:

```text
900 × 450
```

Animate:

```text
CART_ACTIVE

      ↓

BUTTON_CLICK arrives

      ↓

line draws

      ↓

CHECKOUT appears
```

Then show transition metadata:

```text
Frequency
148

Success rate
96%

Average duration
420ms
```

The graph specification defines transition metrics including frequency, success/failure rate and average duration. 

---

# 18. Transition types

Use an interactive strip.

```text
Success
Failure
Retry
Loop
Exit
```

Examples:

### Success

```text
CART
 ↓
CHECKOUT
```

### Failure

```text
CHECKOUT
 ↓
PAYMENT_FAILED
```

### Retry

```text
PAYMENT_FAILED
 ↓
RETRY_PAYMENT
 ↓
CHECKOUT
```

### Loop

```text
SEARCH
 ↓
SEARCH_RESULTS
 ↓
SEARCH
```

### Exit

```text
CHECKOUT
 ↓
ORDER_COMPLETE
```

These transition patterns are all explicitly described in the graph specification. 

---

# 19. Section — Workflow discovery

### H2

> **Transitions become business workflows.**

Explain:

> Tellann looks for connected sequences of states and transitions that represent meaningful objectives such as registration, login, checkout, password reset, or subscription purchase.

A workflow formally contains:

```text
Entry state
Exit state
States
Transitions
Actions
Success paths
Failure paths
```



---

# 20. Workflow clustering animation

Start with a large unstructured graph.

Then group related nodes visually.

```text
[ LOGIN WORKFLOW ]

Anonymous
 ↓
Login
 ↓
Authenticated


[ CHECKOUT WORKFLOW ]

Product
 ↓
Cart
 ↓
Checkout
 ↓
Payment
```

### Master

```text
1800 × 1000
```

### Display

```text
1100 × 611
```

### Duration

```text
6–7 seconds
```

Workflow containers should fade in around relevant nodes.

---

# 21. Section — How the graph is built

This should connect back to Demonstration Mode.

### H2

> **The graph is discovered from sessions—not manually drawn.**

The construction process formally follows: 

```text
1. CAPTURE EVENTS

PAGE_VISIT
BUTTON_CLICK
FORM_SUBMITTED
API_RESPONSE
STATE_TRANSITION

         ↓

2. BUILD SESSION

         ↓

3. EXTRACT STATES

         ↓

4. DETECT TRANSITIONS

         ↓

5. DISCOVER WORKFLOWS

         ↓

6. BUILD GRAPH
```

---

# 22. Construction media

This should be a **10–12 second animation**.

Best built with SVG/HTML rather than exported video.

### Master conceptual canvas

```text
1920 × 1080
```

### Desktop render

```text
1200 × 675
```

Sequence:

```text
Events stream in
→ event timeline forms
→ meaningful states are extracted
→ transitions connect them
→ workflows are bounded
→ complete graph appears
```

This should be the second major visual after the hero.

---

# 23. Section — Interactive Graph Explorer

This could be the strongest part of the page.

### H2

> **Explore behavior instead of staring at telemetry.**

Build a miniature working graph explorer.

Desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ Workflows                    Search                     │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│ CHECKOUT             │                                  │
│ REGISTRATION         │          BEHAVIOR GRAPH          │
│ SEARCH               │                                  │
│ PROFILE              │                                  │
│                      │                                  │
├──────────────────────┴──────────────────────────────────┤
│ Selected state: CHECKOUT                                │
└─────────────────────────────────────────────────────────┘
```

---

# 24. Explorer dimensions

Desktop:

```text
1280 × 780px
```

Section width:

```text
max-width: 1400px
```

Tablet:

```text
960 × 700
```

Mobile:

Switch to:

```text
Workflow selector
↓
Graph
↓
Selected node inspector
```

---

# 25. Explorer controls

Include:

```text
Search states
Filter workflow
Fit graph
Zoom +
Zoom -
Reset
```

Optional:

```text
Show
[ States ]
[ Actions ]
[ Endpoints ]
```

But keep the public demo simpler than the real dashboard.

---

# 26. Node inspection panel

Clicking:

```text
PAYMENT_FAILED
```

shows:

```text
PAYMENT_FAILED

Category
ERROR

Workflow
Checkout

Observed sessions
38

Incoming
CHECKOUT

Outgoing
RETRY_PAYMENT
CART_ACTIVE

Associated API
POST /payment

Source evidence
38 sessions
76 events
```

This reinforces Tellann's explainability.

---

# 27. Edge inspection

Click transition:

```text
CHECKOUT
   ↓
PAYMENT_FAILED
```

Panel:

```text
Transition

Trigger
SUBMIT_PAYMENT

Observed
38 times

Average duration
893ms

Failure rate
7.4%

Source sessions
View →
```

Use explicitly sample/demo data.

---

# 28. Section — Graph metrics

### H2

> **Every node and path carries evidence.**

The graph specification defines metrics at three levels. 

### State metrics

```text
Visit count
Unique users
Session count
Time spent
```

For Phase 1 marketing, emphasize demonstration sessions rather than production users where appropriate.

### Transition metrics

```text
Frequency
Success rate
Failure rate
Average duration
```

### Workflow metrics

```text
Completion rate
Abandonment rate
Coverage
Error rate
```

Be careful: continuous production abandonment analysis is Phase 2. On the Phase 1 page, distinguish **graph model capabilities** from currently shipped production intelligence. 

---

# 29. Metrics visual

Use one selected workflow:

```text
CHECKOUT

States
12

Transitions
18

Sessions
143

Coverage
72%

Error paths observed
3
```

Below:

```text
Most observed transition

CART → CHECKOUT

148 observations
```

Master screenshot:

```text
1600 × 1000
```

Display:

```text
760 × 475
```

---

# 30. Section — Coverage through the graph

### H2

> **Coverage becomes visible when behavior has structure.**

Tellann can use the Behavior Graph to determine which:

```text
states
transitions
paths
workflows
```

were observed.

The Behavior Graph is the input to the Coverage Analysis Engine, which produces coverage percentage, observed paths, missing paths and critical gaps. 

---

# 31. Coverage graph visual

Before:

```text
Everything gray
```

Then:

```text
Observed paths
solid

Potential missing paths
dashed
```

Example:

```text
PRODUCT
   │
   ▼
CART
   │
   ▼
CHECKOUT
 /      \
▼        ▼
SUCCESS FAILURE
██████   - - - -
```

Then:

```text
Coverage
72%
```

### Master

```text
1600 × 900
```

### Display

```text
1000 × 562
```

---

# 32. Section — Missing states and missing paths

### H2

> **The empty spaces in the graph can matter as much as the nodes.**

Show comparison:

```text
Observed:

CHECKOUT
    ↓
PAYMENT_SUCCESS


Potential gap:

CHECKOUT
    ⇢
PAYMENT_FAILURE
```

Missing-state detection in Phase 1 includes loading, empty, error and failure states. 

---

# 33. Gap visual animation

Sequence:

```text
Observed graph appears

↓

Tellann evaluates workflow

↓

Dashed PAYMENT_FAILURE node appears

↓

EMPTY_CART appears

↓

SESSION_TIMEOUT appears

↓

Potential gaps: 3
```

Duration:

```text
5–6 seconds
```

Avoid a dramatic red warning style.

These are analytical findings, not guaranteed defects.

---

# 34. Section — Graph + Session Replay

### H2

> **Every graph path can lead back to behavioral evidence.**

The graph should not feel detached from reality.

Show:

```text
Behavior Graph
     │
select transition
     ↓
Session SES-3817
     ↓
Replay timeline
```

Session Replay serves as a bridge between captured telemetry and explainable behavioral analysis. 

---

# 35. Graph-to-replay video

### Master

```text
1920 × 1200
```

### Render

```text
1000 × 625
```

### Duration

```text
8–10 seconds
```

Sequence:

```text
Open CHECKOUT workflow

↓

Click CHECKOUT → PAYMENT_FAILED

↓

View supporting sessions

↓

Open session

↓

Replay jumps directly to relevant event
```

This is a very strong product demonstration.

---

# 36. Section — Graph + endpoint context

### H2

> **Connect interface behavior to backend behavior.**

Example:

```text
CHECKOUT
    │
    │ POST /checkout
    ▼
PAYMENT_PENDING
    │
    │ POST /payment
    ▼
PAYMENT_SUCCESS
```

Then expose:

```text
POST /payment

Average
891ms

Errors
7.4%
```

Backend telemetry can be correlated with frontend sessions and graph behavior where possible. 

---

# 37. Endpoint overlay visual

Master:

```text
1600 × 1000
```

Render:

```text
900 × 562
```

Toggle:

```text
[ Behavior ]
[ + API context ]
```

When API context is enabled, endpoint labels appear along transitions.

This is far stronger than showing another independent endpoint table.

---

# 38. Section — Graph evolution

### H2

> **One demonstration starts the map. More observations expand it.**

Visual:

```text
DEMO 01

Anonymous
 ↓
Login
 ↓
Dashboard


DEMO 02

      Products
        ↓
       Cart


DEMO 03

      Checkout
      ↙     ↘
 Success   Failure
```

Then merge into:

```text
APPLICATION GRAPH
```

The Behavior Graph specification supports graphs generated from multiple sessions and tracks transition frequency as behavior is repeatedly observed. 

---

# 39. Graph evolution animation

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
Demo 1 nodes
        ↓
Demo 2 nodes attach
        ↓
Demo 3 adds branch
        ↓
frequency counts update
```

Do not imply live production learning on the current Phase 1 product page.

---

# 40. Section — Application-level map

The user must understand that Tellann can contain multiple workflows inside one larger behavioral model.

### H2

> **Workflows connect into an application-wide behavioral map.**

Example:

```text
                  APPLICATION

       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼

 REGISTRATION      CHECKOUT       PROFILE
       │              │              │
       ▼              ▼              ▼

      AUTHENTICATED USER STATE

              │
              ▼

             SEARCH
```

This shows that the graph is more than individual flowcharts.

---

# 41. Application map dimensions

Full width.

```text
1920 × 1200 source
1280 × 800 render
```

Scrollable / pannable.

Add workflow filters:

```text
All
Registration
Login
Checkout
Search
Profile
```

---

# 42. Section — Graph versioning

This should be a smaller technical credibility section.

### H2

> **Behavior can be preserved as the application evolves.**

The graph specification defines graph versions with application-version and creation metadata and requires snapshots to support historical comparison and future regression analysis. 

Visual:

```text
Graph v1.0
Application v2.3.0

        ↓

Graph v1.1
Application v2.4.0

        ↓

Graph v1.2
Application v2.5.0
```

Clearly label advanced release comparison as future/Phase 3 where relevant. 

---

# 43. Graph version visual

Dimensions:

```text
1200 × 500
```

Three mini graph snapshots:

```text
340 × 250 each
```

Animation:

A single new branch appears between versions.

---

# 44. Section — Explainability and traceability

### H2

> **Every graph element should have evidence behind it.**

This is important for Tellann's credibility.

The BGS requires graph nodes to remain traceable to source sessions and events, and graph generation should be reproducible from identical datasets. 

Show:

```text
PAYMENT_FAILED
      │
      ├── 38 Sessions
      │
      ├── 76 Events
      │
      └── POST /payment
```

Then:

```text
View evidence →
```

---

# 45. Traceability visual

```text
GRAPH NODE

PAYMENT_FAILED

      ↓

TRANSITION

CHECKOUT
→ PAYMENT_FAILED

      ↓

SESSION

SES-3817

      ↓

EVENT

API_ERROR
```

Master:

```text
1400 × 700
```

Display:

```text
900 × 450
```

---

# 46. Section — Future graph intelligence

This section should stay brief.

### Eyebrow

```text
WHERE THE GRAPH LEADS
```

### H2

> **The same behavioral model can support progressively deeper intelligence.**

Three phases:

### Phase 1 — Available product direction

```text
Workflow discovery
Behavioral graphs
Coverage analysis
Missing states
Missing flows
Session replay context
```

### Phase 2 — Planned

```text
Production journey intelligence
Workflow health
Behavioral evolution
Error correlation
```

### Phase 3 — Planned

```text
Test generation
Regression detection
Failure simulation
Behavioral anomaly detection
Quality intelligence
```

These phase-specific graph capabilities are defined in the Behavior Graph specification. 

And Phase 2/3 capabilities remain explicitly outside current MVP scope. 

Use prominent:

```text
PLANNED
```

labels.

---

# 47. Don't overmarket AI here

Do not turn the graph page into:

```text
"AI-powered knowledge graph"

"Neural behavioral brain"

"AI understands your entire application"

"Digital twin of your software"
```

None of those descriptions are necessary to make the technology compelling.

The much stronger claim is:

> Tellann reconstructs observed application behavior into a graph that remains traceable to actual sessions and events.

That is concrete and supported by the specifications. 

---

# 48. FAQ

Recommended:

```text
What is a Behavior Graph?

How does Tellann discover states?

What counts as a state?

What is the difference between a state and a page?

What is a transition?

What is an action?

How does Tellann identify workflows?

Do I need to draw the graph manually?

Does every demonstration create a separate graph?

Can multiple demonstrations expand the same graph?

Can I inspect the sessions behind a graph node?

How does the graph help calculate coverage?

How are missing states discovered?

Can Tellann compare graphs between releases?

Does the Behavior Graph contain sensitive user information?
```

---

# 49. Final CTA

### Eyebrow

```text
BUILD YOUR FIRST GRAPH
```

### H2

> **Show Tellann a workflow. See the behavior emerge.**

Supporting copy:

> Start with a demonstration session and turn application interactions into states, transitions, workflows, coverage, and a structured map of how your software behaves.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Second:

```text
/product/demonstration-mode
```

---

# 50. Complete media inventory

| Asset                      | Type               | Master dimensions |    Display |
| -------------------------- | ------------------ | ----------------: | ---------: |
| Hero Behavior Graph        | SVG/Canvas         |         1920×1180 |   1380×800 |
| Mobile graph               | SVG                |         1080×1440 | responsive |
| Graph anatomy              | Animated SVG       |          1600×900 |   1000×562 |
| State categories           | SVG                |          1440×900 |    900×562 |
| Transition demo            | Animated SVG       |          1440×720 |    900×450 |
| Workflow clustering        | Animated SVG       |         1800×1000 |   1100×611 |
| Graph construction         | SVG/HTML animation |         1920×1080 |   1200×675 |
| Interactive Graph Explorer | HTML/Canvas        |                 — |   1280×780 |
| Graph metrics              | UI                 |         1600×1000 |    760×475 |
| Coverage graph             | Animated SVG       |          1600×900 |   1000×562 |
| Gap detection              | Animated SVG       |          1600×900 |   1000×562 |
| Graph → Replay             | Product video      |         1920×1200 |   1000×625 |
| Endpoint overlay           | Interactive SVG/UI |         1600×1000 |    900×562 |
| Graph evolution            | Animated SVG       |         1800×1000 |   1100×611 |
| Application map            | Canvas/SVG         |         1920×1200 |   1280×800 |
| Version history            | SVG                |          1200×500 |   1000×417 |
| Evidence trace             | SVG                |          1400×700 |    900×450 |

This gives the page roughly **17 visual assets**, although many should be generated from the same graph component rather than maintained as separate exported images.

---

# 51. Most important implementation decision

Do **not** create fifteen separate static graph illustrations.

Build one reusable component:

```tsx
<BehaviorGraph
  nodes={nodes}
  edges={edges}
  workflows={workflows}
  mode="interactive"
/>
```

Then support modes such as:

```ts
type GraphMode =
  | "hero"
  | "construction"
  | "coverage"
  | "gaps"
  | "metrics"
  | "endpoints"
  | "evolution"
  | "explorer";
```

This keeps visual language consistent between the public website and eventually the actual product.

---

# 52. Recommended graph node model

Conceptually:

```ts
interface BehaviorGraphNode {
  id: string;
  name: string;

  category:
    | "NAVIGATION"
    | "UI"
    | "BUSINESS"
    | "ERROR"
    | "SYSTEM";

  metrics?: {
    visits?: number;
    sessions?: number;
    duration?: number;
  };
}
```

Transition:

```ts
interface BehaviorGraphEdge {
  id: string;

  source: string;
  target: string;

  action: string;

  metrics?: {
    frequency?: number;
    successRate?: number;
    failureRate?: number;
    averageDuration?: number;
  };
}
```

This closely mirrors the state and transition models in the Behavior Graph specification. 

---

# 53. Graph rendering recommendation

For the actual implementation, choose something built for interactive graph behavior.

Possible architecture:

```text
React / Next.js
      ↓
Graph component
      ↓
SVG or Canvas renderer
```

Requirements:

```text
pan
zoom
fit view
node selection
edge selection
workflow filtering
dynamic highlighting
large graph support
```

The platform's NFR explicitly requires behavioral graphs to remain readable for large workflows and support filtering/exploration. 

---

# 54. Motion language

This page's animation vocabulary should be:

```text
node appears
edge draws
path activates
cluster forms
branch emerges
frequency increases
gap materializes
graph expands
```

Not:

```text
floating
spinning
glowing
bouncing
random particles
```

Everything moving should communicate new behavioral information.

---

# 55. Scroll behavior

The graph page can use slightly more advanced scroll choreography than the rest of the website.

For example:

```text
EVENTS
↓ scroll

STATES
↓ scroll

TRANSITIONS
↓ scroll

WORKFLOWS
↓ scroll

COMPLETE GRAPH
```

But keep this as discrete state transitions rather than locking the entire page into a long scroll-controlled animation.

---

# 56. Sticky graph explanation

One particularly effective section could use:

```text
LEFT
Sticky graph

RIGHT
Scrollable explanation
```

Desktop layout:

```text
┌───────────────────────┬───────────────────┐
│                       │  01 State         │
│                       │                   │
│    BEHAVIOR GRAPH     │  02 Action        │
│       STICKY          │                   │
│                       │  03 Transition    │
│                       │                   │
│                       │  04 Workflow      │
└───────────────────────┴───────────────────┘
```

Ratio:

```text
7 columns / 5 columns
```

As each explanation enters, the graph highlights the corresponding concept.

This would be ideal for the **Anatomy of Behavior** section.

---

# 57. Responsive behavior

## Desktop ≥1280

Full graph interactions.

## Tablet

Keep panning/zoom.

Stack descriptive text above the graph when necessary.

## Mobile

Do not expose the complete dense graph immediately.

Provide:

```text
Workflow
[ Checkout ▾ ]

Graph

Zoom / Fullscreen

Selected node
```

Users can tap:

```text
View application graph
```

to open a fullscreen graph explorer.

---

# 58. Accessibility

Nodes need keyboard accessibility.

For example:

```html
<button aria-label="Checkout business state">
```

Graph information must also have a non-visual representation.

Provide:

```text
View as graph
View as list
```

List version:

```text
CHECKOUT
Business state

Incoming:
CART_ACTIVE

Outgoing:
PAYMENT_SUCCESS
PAYMENT_FAILURE
```

Do not make the graph the only way to access information.

---

# 59. Reduced motion

Under:

```css
@media (prefers-reduced-motion: reduce)
```

disable:

```text
graph construction
animated edges
path particles
workflow clustering animations
continuous transition movement
```

Show completed diagrams.

---

# 60. SEO

### Title

> **Behavior Graphs — Map How Your Software Actually Behaves | Tellann**

### Alternative

> **Application Behavior Graphs | Tellann**

### Meta description

> See how Tellann turns observed application sessions into states, actions, transitions, workflows, and Behavior Graphs for workflow discovery, coverage analysis, missing-state detection, replay context, and behavioral QA.

---

# 61. Structured page headings

```text
H1
See your application as a network of behavior.

H2
A structural model of what your software actually does.

H2
Four concepts describe the application.

H2
Behavior exists in the movement between states.

H2
Transitions become business workflows.

H2
The graph is discovered from sessions—not manually drawn.

H2
Explore behavior instead of staring at telemetry.

H2
Every node and path carries evidence.

H2
Coverage becomes visible when behavior has structure.

H2
The empty spaces in the graph can matter as much as the nodes.

H2
Every graph path can lead back to behavioral evidence.

H2
Connect interface behavior to backend behavior.

H2
One demonstration starts the map. More observations expand it.

H2
Workflows connect into an application-wide behavioral map.

H2
Behavior can be preserved as the application evolves.

H2
Every graph element should have evidence behind it.

H2
The same behavioral model can support progressively deeper intelligence.

H2
Show Tellann a workflow. See the behavior emerge.
```

---

# 62. Analytics events

Track:

```text
behavior_graph_hero_interacted
behavior_graph_node_selected
behavior_graph_edge_selected

behavior_graph_zoomed
behavior_graph_workflow_filtered
behavior_graph_search_used

behavior_graph_replay_opened
behavior_graph_endpoint_overlay_enabled

behavior_graph_future_roadmap_clicked

behavior_graph_signup_clicked
```

Useful event properties:

```json
{
  "nodeCategory": "BUSINESS",
  "workflow": "checkout",
  "interaction": "node_selected"
}
```

Ironically, the Behavior Graph marketing page itself could become a useful example of Tellann's behavioral philosophy.

---

# 63. Recommended visual hierarchy

The page should deliberately progress from **simple → complex → useful**:

```text
STATE

↓

STATE + ACTION

↓

TRANSITION

↓

WORKFLOW

↓

BEHAVIOR GRAPH

↓

GRAPH METRICS

↓

COVERAGE

↓

MISSING BEHAVIOR

↓

SESSION EVIDENCE

↓

APPLICATION MODEL
```

Never open by throwing fifty unexplained nodes at the visitor.

Teach the graph before showing its full complexity.

---

# 64. The strongest conceptual message

The main differentiation to reinforce repeatedly is:

```text
Analytics sees events.

Monitoring sees metrics.

Replay sees sessions.

Tellann connects those observations
into an explicit model of behavior.
```

That positioning is consistent with the competitive analysis: Tellann's distinctive capability is not merely collecting telemetry but using it to construct behavioral graphs and workflow-level quality intelligence. 

---

# 65. Final visitor experience

The page should ultimately feel like:

```text
OBSERVE

"This click happened."

        ↓

STRUCTURE

"The user was in CART_ACTIVE."

        ↓

RELATE

"Checkout moved them into CHECKOUT."

        ↓

GROUP

"These transitions form the checkout workflow."

        ↓

MAP

"That workflow is part of a larger application graph."

        ↓

MEASURE

"We observed 72% of this workflow."

        ↓

QUESTION

"Payment failure was never demonstrated."

        ↓

INVESTIGATE

"These sessions and API calls created this path."

        ↓

UNDERSTAND

"I can now reason about application quality
through behavior rather than isolated telemetry."
```

That is the experience `/product/behavior-graphs` should deliver. The user should not merely understand that Tellann **has a graph visualization**; they should understand that the Behavior Graph is the **structural layer tying together Demonstration Mode, sessions, workflow discovery, coverage, missing states, missing flows, endpoint context, replay, and eventually Tellann's deeper intelligence capabilities**.   
