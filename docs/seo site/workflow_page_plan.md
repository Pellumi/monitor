# `/product/workflow-discovery` — Complete Page Specification

`/product/workflow-discovery` should explain the point where Tellann stops seeing isolated events and starts recognizing **business processes**.

The central message should be:

> **Tellann observes how states connect, discovers where meaningful processes begin and end, and turns those paths into workflows your team can inspect, measure, and improve.**

Workflow Discovery is explicitly part of the MVP. It includes workflow identification, workflow boundaries, entry/exit-point discovery, state extraction, transition extraction, workflow inventory, and workflow visualizations. 

---

# 1. Position in the Product story

The product pages should now form this hierarchy:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does the complete pipeline work?

        ↓

/product/demonstration-mode
How does Tellann observe my software?

        ↓

/product/behavior-graphs
How is observed behavior structured?

        ↓

/product/workflow-discovery
How does Tellann recognize meaningful
business processes inside that structure?
```

The distinction between Behavior Graphs and Workflow Discovery matters:

```text
BEHAVIOR GRAPH
All observed states and relationships.

WORKFLOW DISCOVERY
Meaningful connected regions of that graph
that accomplish a business objective.
```

A workflow is formally a connected sequence of states and transitions that accomplishes a business objective and includes entry/exit states, actions, transitions, success paths, and failure paths. 

---

# 2. Page objectives

The page needs to answer:

```text
What does Tellann consider a workflow?

How does it discover workflows?

Do I need to manually name them?

How are workflow boundaries found?

What is an entry point?

What is an exit point?

Can one workflow have multiple paths?

Can workflows overlap?

How are recurring workflows identified?

What information does a discovered workflow contain?

How does workflow discovery enable coverage?

How does it expose missing paths?

Can I trace a workflow back to sessions?

What happens as I demonstrate more behavior?
```

---

# 3. Recommended page architecture

```text
/product/workflow-discovery
│
├── 01 Global Navigation
├── 02 Hero
├── 03 From Events to Workflows
├── 04 What Counts as a Workflow?
├── 05 Automatic Workflow Discovery
├── 06 Entry & Exit Points
├── 07 Workflow Boundaries
├── 08 Success, Failure & Recovery Paths
├── 09 Recurring Pattern Discovery
├── 10 Interactive Workflow Explorer
├── 11 Workflow Inventory
├── 12 Workflow Metrics
├── 13 Workflow Coverage
├── 14 Missing & Incomplete Workflows
├── 15 Workflow + Session Evidence
├── 16 Workflow + Endpoint Context
├── 17 Multiple Demonstrations
├── 18 Workflow Reports
├── 19 Workflow Discovery vs Manual Mapping
├── 20 Future Workflow Intelligence
├── 21 FAQ
├── 22 Final CTA
└── 23 Footer
```

---

# 4. Hero

### Eyebrow

```text
WORKFLOW DISCOVERY
```

### H1

> **See the workflows hidden inside application behavior.**

Alternative:

> **From scattered interactions to meaningful workflows.**

I prefer the first.

### Supporting copy

> Tellann analyzes observed states and transitions to identify workflow boundaries, entry points, exit points, recurring patterns, and the paths users take through meaningful application processes.

Those capabilities map directly to FR-029–034. 

### CTAs

```text
[ Explore a workflow ]
[ See how discovery works → ]
```

Optional tertiary:

```text
Explore Behavior Graphs →
```

→ `/product/behavior-graphs`

---

# 5. Hero visual

The hero should show a **large application Behavior Graph transforming into identifiable workflows**.

Initial state:

```text
                   AUTHENTICATED
                  /      |       \
                 /       |        \
                ▼        ▼         ▼
           PRODUCTS    PROFILE   SETTINGS
              │           │
              ▼           ▼
        PRODUCT_VIEW   PROFILE_EDIT
           /    \          │
          ▼      ▼          ▼
       SEARCH   CART   PROFILE_UPDATED
                 │
                 ▼
              CHECKOUT
              /      \
             ▼        ▼
        SUCCESS      FAILURE
```

Then workflow boundaries appear:

```text
┌────────────── SEARCH WORKFLOW ───────────────┐

┌────────────── PROFILE WORKFLOW ──────────────┐

┌────────────── CHECKOUT WORKFLOW ─────────────┐
```

This immediately explains the difference between the **whole graph** and the **workflows discovered within it**.

---

# 6. Hero visual dimensions

Prefer SVG/Canvas.

### Design canvas

```text
1920 × 1150
```

### Desktop display

```text
max-width: 1360px
height: 760–800px
```

### Placement

```text
Hero heading/copy
      ↓
48px
      ↓
Full-width discovery animation
```

Do not use a 50/50 split hero.

The transformation itself is the product demonstration.

---

# 7. Hero animation

Duration:

```text
9–11 seconds
```

Sequence:

```text
0–3 sec
Complete raw Behavior Graph appears.

3–5 sec
Repeated paths subtly highlight.

5–7 sec
Workflow boundaries begin forming.

7–8 sec
Entry and exit markers appear.

8–9 sec
Names appear:
CHECKOUT
SEARCH
PROFILE UPDATE

9–10 sec
Workflow inventory panel appears.
```

Then stop or enter a subtle interactive state.

Do not continually loop the boundary animation.

---

# 8. Mobile hero

Do not show the complete application graph.

Use three smaller workflow fragments:

```text
LOGIN

Anonymous
   ↓
Authenticated


CHECKOUT

Product
   ↓
Cart
   ↓
Checkout
  ↙      ↘
Success Failure


PROFILE

Profile
   ↓
Edit
   ↓
Updated
```

Master:

```text
1080 × 1440
```

Display:

```text
width: calc(100vw - 32px)
height: ~680px
```

---

# 9. Section — From events to workflows

### H2

> **Workflows emerge from observed behavior.**

Tellann's demonstration lifecycle converts:

```text
Events
  ↓
Session
  ↓
States
  ↓
Transitions
  ↓
Workflow
  ↓
Behavior Graph
```



This section explains that Workflow Discovery does **not** begin by asking someone to draw a flowchart.

Instead:

```text
PAGE_VISIT
BUTTON_CLICK
FORM_SUBMITTED
API_RESPONSE
STATE_TRANSITION

        ↓

Session sequence

        ↓

PRODUCT_VIEW
   ↓
CART_ACTIVE
   ↓
CHECKOUT
   ↓
PAYMENT_SUCCESS

        ↓

CHECKOUT WORKFLOW
```

---

# 10. Transformation animation

### Master

```text
1800 × 1000
```

### Display

```text
1100 × 611
```

Three-column transformation:

```text
EVENTS        STATES        WORKFLOW

click    →    PRODUCT
route    →       ↓
click    →      CART     →  CHECKOUT
API      →       ↓
API      →    CHECKOUT
                  ↓
               SUCCESS
```

Duration:

```text
6–8 seconds
```

---

# 11. Section — What counts as a workflow?

### H2

> **A workflow is behavior with an objective.**

Formal structure:

```text
ENTRY STATE
     ↓
STATES
     ↓
ACTIONS
     ↓
TRANSITIONS
     ↓
SUCCESS / FAILURE PATHS
     ↓
EXIT STATE
```

Tellann's graph specification defines workflows exactly in terms of these components. 

Examples:

```text
Registration
Login
Checkout
Password Reset
Subscription Purchase
Profile Update
Search
```

---

# 12. Workflow anatomy visual

Example:

```text
CHECKOUT WORKFLOW

ENTRY
PRODUCT_VIEW

      │
      │ ADD_TO_CART
      ▼

CART_ACTIVE

      │
      │ CHECKOUT_CLICK
      ▼

CHECKOUT

   ┌───────────────┐
   │               │
   ▼               ▼

PAYMENT_SUCCESS  PAYMENT_FAILED
   │               │
   │               ▼
   │           RETRY_PAYMENT
   │               │
   │               └────→ CHECKOUT
   ▼

EXIT
ORDER_COMPLETE
```

Master:

```text
1600 × 1000
```

Displayed:

```text
900 × 562
```

---

# 13. Workflow anatomy interaction

Hover:

```text
ENTRY
STATE
ACTION
TRANSITION
SUCCESS PATH
FAILURE PATH
EXIT
```

Highlight each corresponding piece.

This is preferable to explaining all seven concepts with paragraphs.

---

# 14. Section — Automatic Workflow Discovery

### H2

> **The workflow is discovered—not manually wired together.**

Tellann's MVP explicitly includes automatic workflow identification, state extraction, transition extraction, boundaries, entry points, and exit points. 

The conceptual algorithm presented publicly should be:

```text
1. Observe session

2. Extract meaningful states

3. Identify transitions

4. Detect connected sequences

5. Locate entry and exit points

6. Identify recurring patterns

7. Group connected behavior

8. Generate workflow
```

Do not expose implementation details that are still unsettled.

---

# 15. Discovery algorithm animation

Visual:

```text
SESSION SES-3817

Home
 ↓
Products
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Success


SESSION SES-3928

Products
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Success


SESSION SES-4012

Product
 ↓
Cart
 ↓
Checkout
 ↓
Failure
```

Tellann detects the common region:

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
```

and creates:

```text
CHECKOUT WORKFLOW
```

### Dimensions

```text
1800 × 1000 source
1100 × 611 display
```

---

# 16. Important manual-label distinction

Optional workflow labels exist in Demonstration Mode, for example:

```json
{
  "workflow": "Checkout"
}
```

but the system is also specified to identify workflows automatically. 

So the website should communicate:

> **Labels can provide context. They should not be required for discovery.**

Avoid suggesting:

```text
"Tellann only knows a workflow if you name it first."
```

That would weaken the core differentiator.

---

# 17. Section — Entry points

### H2

> **Where does a workflow actually begin?**

The DDMS identifies possible entry points such as:

```text
LANDING_PAGE
LOGIN_PAGE
REGISTRATION_PAGE
```



But entry points should not be presented as "always pages."

They can conceptually be meaningful states.

Visual:

```text
APPLICATION GRAPH

HOME
 │
 ▼

PRODUCT
 │
 │ ← ENTRY
 ▼

CART
 ↓
CHECKOUT
 ↓
SUCCESS
```

---

# 18. Entry-point visual

Master:

```text
1400 × 700
```

Display:

```text
900 × 450
```

Use:

```text
ENTRY
```

badge rather than relying on color.

Animation:

Graph dims except the starting state.

Then downstream workflow lights up.

---

# 19. Section — Exit points

### H2

> **And where is the objective considered complete?**

Examples from DDMS include:

```text
CHECKOUT_COMPLETE
SUBSCRIPTION_ACTIVE
PROFILE_UPDATED
```



Visual:

```text
PROFILE
   ↓
EDIT_PROFILE
   ↓
PROFILE_UPDATED
       ▲
       │
      EXIT
```

---

# 20. Entry + exit comparison

A useful combined visual:

```text
ENTRY                                         EXIT
PRODUCT_VIEW                            ORDER_COMPLETE
     │                                        ▲
     ▼                                        │
   CART ─────→ CHECKOUT ─────→ PAYMENT_SUCCESS
```

Dimensions:

```text
1500 × 600 source
1000 × 400 render
```

---

# 21. Section — Workflow boundaries

### H2

> **Tellann separates meaningful processes from the larger graph.**

Show full application map:

```text
LOGIN → DASHBOARD → PRODUCTS → CART → CHECKOUT
            │                     │
            ▼                     ▼
         PROFILE               PAYMENT
```

Then boundaries:

```text
┌ LOGIN ┐

        ┌ PRODUCT BROWSING ┐

                         ┌ CHECKOUT ┐

       ┌ PROFILE UPDATE ┐
```

The product requirements explicitly require workflow boundary identification. 

---

# 22. Boundary animation

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
Whole graph
↓
Checkout path highlights
↓
Boundary container forms
↓
Entry marked
↓
Exit marked
↓
Workflow label appears
```

Duration:

```text
5 seconds
```

---

# 23. Section — Success, failure, and recovery paths

### H2

> **Real workflows branch. Tellann should preserve those branches.**

A workflow can contain success and failure paths. 

Show:

```text
                     CHECKOUT
                    /        \
                   /          \
                  ▼            ▼
          PAYMENT_SUCCESS   PAYMENT_FAILURE
                                 │
                                 ▼
                            RETRY_PAYMENT
                                 │
                                 └────→ CHECKOUT
```

Also show alternative:

```text
CHECKOUT
 ├── Card
 ├── Wallet
 └── Bank Transfer
```

---

# 24. Path-type cards

Four cards:

```text
SUCCESS
Expected completion

FAILURE
Workflow cannot complete

RECOVERY
Return from failure

ALTERNATIVE
Different valid route
```

Potential future/derived edge cases must be carefully distinguished from **observed** paths.

---

# 25. Path visual design

Each card:

```text
270 × 260px
```

Desktop:

```text
4 columns
20px gap
```

Mobile:

```text
2 × 2
```

Each card uses miniature graph paths rather than generic icons.

---

# 26. Section — Recurring patterns

### H2

> **Repeated paths reveal the workflows that keep happening.**

FR-031 explicitly requires Tellann to identify recurring workflow patterns, and transition frequency is also a required graph metric. 

Show repeated sessions:

```text
SESSION 01
Product → Cart → Checkout

SESSION 02
Product → Cart → Checkout

SESSION 03
Product → Cart → Checkout

SESSION 04
Search → Product → Cart → Checkout
```

Tellann resolves:

```text
COMMON WORKFLOW

Product
  ↓
Cart
  ↓
Checkout
```

---

# 27. Frequency animation

Line thickness can subtly increase as a transition is repeatedly observed.

For example:

```text
PRODUCT ─────→ CART
143 observations
```

But never encode meaning only in line thickness.

Also show:

```text
143×
```

label.

Master:

```text
1500 × 800
```

Display:

```text
960 × 512
```

---

# 28. Section — Interactive Workflow Explorer

This should be the strongest product interaction on the page.

### H2

> **Explore discovered workflows as living structures.**

Desktop:

```text
┌───────────────────────────────────────────────────────┐
│ Workflow Discovery                          Search   │
├─────────────────┬─────────────────────────────────────┤
│ WORKFLOWS       │                                     │
│                 │                                     │
│ Checkout        │          WORKFLOW MAP               │
│ Registration    │                                     │
│ Login           │                                     │
│ Search          │                                     │
│ Profile Update  │                                     │
│                 │                                     │
├─────────────────┴─────────────────────────────────────┤
│ CHECKOUT · 12 states · 18 transitions                 │
└───────────────────────────────────────────────────────┘
```

---

# 29. Explorer dimensions

Desktop:

```text
1280 × 780px
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
Workflow selector
      ↓
Map
      ↓
Workflow summary
```

---

# 30. Workflow explorer controls

Include:

```text
Search workflows

Filter
[ All ]
[ Complete ]
[ Incomplete ]

Fit map
Zoom +
Zoom -
```

I would **not** include production-oriented filters such as "abandonment" in this Phase 1 page.

---

# 31. Selected workflow panel

Example:

```text
CHECKOUT

Entry
PRODUCT_VIEW

Exit
ORDER_COMPLETE

States
12

Transitions
18

Observed sessions
143

Observed paths
6

Potential missing paths
3
```

All numbers should visibly be:

```text
Sample application data
```

---

# 32. State inventory inside workflow

Expandable:

```text
STATES

PRODUCT_VIEW
CART_ACTIVE
CHECKOUT
PAYMENT_PENDING
PAYMENT_SUCCESS
PAYMENT_FAILURE
ORDER_COMPLETE
```

Another tab:

```text
TRANSITIONS
```

Another:

```text
PATHS
```

---

# 33. Section — Workflow Inventory

### H2

> **Turn an application into an inventory of behavior.**

Workflow Discovery's MVP output explicitly includes a workflow inventory. 

Show table/cards:

| Workflow       | Entry        | Exit           | States | Coverage |
| -------------- | ------------ | -------------- | -----: | -------: |
| Checkout       | Product View | Order Complete |     12 |      72% |
| Registration   | Registration | Registered     |      7 |      91% |
| Login          | Login        | Authenticated  |      5 |      88% |
| Search         | Search       | Results        |      8 |      64% |
| Profile Update | Profile      | Updated        |      6 |      83% |

Clearly:

> Illustrative data.

---

# 34. Workflow inventory media

Prefer real HTML, not image.

Desktop:

```text
1200 × auto
```

On mobile convert each row into a card.

Useful controls:

```text
Sort by
Coverage
Name
State count
```

Avoid overbuilding the public demo.

---

# 35. Section — Workflow metrics

### H2

> **A discovered workflow becomes measurable.**

The Phase 1-safe metrics should focus primarily on:

```text
State count
Transition count
Observed sessions
Observed paths
Coverage
Entry points
Exit points
Transition frequencies
Errors observed
```

The reporting specification also defines workflow reports around entry state, exit state, state inventory, transition inventory, success paths, and failure paths. 

---

# 36. Metrics visual

```text
CHECKOUT

Entry
PRODUCT_VIEW

Exit
ORDER_COMPLETE

States
12

Transitions
18

Observed paths
15

Coverage
75%

Errors observed
3
```

Master UI:

```text
1600 × 900
```

Display:

```text
800 × 450
```

---

# 37. Avoid premature Phase 2 metrics

The broader workflow model eventually supports things such as:

```text
production completion rate
abandonment
workflow health
friction
bottlenecks
```

but production User Journey Intelligence belongs to Phase 2, and the MVP explicitly excludes abandonment/friction intelligence. 

Therefore do **not** market:

> "Tellann automatically detects users abandoning checkout in production."

on this current feature page.

---

# 38. Section — Workflow Coverage

### H2

> **Discovery gives coverage something meaningful to measure.**

Without structure:

```text
428 events
```

With Workflow Discovery:

```text
CHECKOUT

Observed paths      15
Missing paths        5
Coverage            75%
```

The system is required to calculate workflow coverage, observed paths, unobserved paths, incomplete workflows, and low-coverage critical workflows. 

---

# 39. Coverage visual

Show one workflow:

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
Observed
solid

Not observed
dashed
```

Dimensions:

```text
1600 × 900 master
1000 × 562 render
```

---

# 40. Section — Missing and incomplete workflows

### H2

> **A discovered workflow also makes its missing branches visible.**

Example:

```text
LOGIN WORKFLOW

Observed

LOGIN
  ↓
AUTHENTICATED


Potential missing paths

LOGIN
 ├── INVALID_PASSWORD
 ├── ACCOUNT_LOCKED
 ├── PASSWORD_RESET
 └── SESSION_EXPIRED
```

Missing-flow detection is explicitly part of the MVP, including failure, alternative, recovery, and edge-case paths. 

---

# 41. Missing-path animation

Duration:

```text
5–6 seconds
```

Sequence:

```text
Observed workflow appears

↓

Observed paths become solid

↓

Unobserved branch placeholders appear

↓

Potential gaps list resolves
```

Again, say:

```text
Potential gap
Not observed
```

rather than:

```text
Bug detected
```

unless actual evidence supports a bug.

---

# 42. Section — Workflow + Session Evidence

### H2

> **Every discovered workflow should lead back to what was observed.**

Visual:

```text
CHECKOUT WORKFLOW
       │
       ├── SES-3817
       ├── SES-3824
       ├── SES-3901
       └── SES-4012
```

Click:

```text
SES-3817
```

then:

```text
Session timeline
↓
Replay
```

Session reconstruction and replay are explicitly part of Phase 1. 

---

# 43. Workflow-to-replay video

Master:

```text
1920 × 1200
```

Display:

```text
1000 × 625
```

Duration:

```text
8–10 sec
```

Sequence:

```text
Select Checkout

↓

Supporting sessions

↓

Select SES-3817

↓

Replay opens

↓

Relevant workflow events highlighted
```

---

# 44. Section — Workflow + Endpoint Context

### H2

> **See the APIs involved in a workflow.**

Example:

```text
PRODUCT_VIEW
    │
    │ POST /cart
    ▼
CART_ACTIVE
    │
    │ POST /checkout
    ▼
CHECKOUT
    │
    │ POST /payment
    ▼
PAYMENT_SUCCESS
```

Backend activity can be associated with frontend sessions where possible. 

---

# 45. Endpoint overlay visual

Use toggle:

```text
[ Workflow ]
[ + API context ]
```

When enabled:

```text
POST /cart      143ms
POST /checkout  418ms
POST /payment   891ms
```

appear on relevant transitions.

Master:

```text
1600 × 1000
```

Render:

```text
900 × 562
```

This makes workflow discovery feel connected to actual application execution rather than merely navigation analytics.

---

# 46. Section — Multiple demonstrations

### H2

> **New demonstrations can reveal new workflows and new branches.**

Example:

```text
DEMO 1

Registration
Login


DEMO 2

Search
Browse


DEMO 3

Cart
Checkout


DEMO 4

Payment Failure
Retry
```

Output:

```text
WORKFLOW INVENTORY

Registration
Login
Search
Browse
Checkout
Payment Recovery
```

---

# 47. Multi-demo animation

Canvas:

```text
1800 × 1000
```

Display:

```text
1100 × 611
```

Each demonstration updates:

```text
Workflows discovered
4 → 5 → 6

States
23 → 31 → 37

Observed paths
12 → 17 → 21
```

Use illustrative values only.

---

# 48. Section — Workflow Reports

### H2

> **A discovered workflow can become a QA artifact.**

The QA report specification defines a Workflow Report containing: 

```text
Workflow Graph
State Inventory
Transition Inventory
Success Paths
Failure Paths
Recommendations
```

Example report header:

```text
WORKFLOW REPORT

Workflow
CHECKOUT

Entry State
PRODUCT_VIEW

Exit State
ORDER_COMPLETE

States
12

Transitions
18
```

---

# 49. Report visual

Master:

```text
1000 × 1280
```

Composite:

```text
1500 × 1000
```

Display:

```text
760 × 507
```

Place:

```text
Copy               Report
5 columns          7 columns
```

Desktop.

Mobile:

```text
Copy
↓
Report preview
```

---

# 50. Section — Workflow Discovery vs manual mapping

This is strategically important.

### H2

> **The map should follow the application—not become another document to maintain.**

Comparison:

| Traditional workflow documentation | Tellann Workflow Discovery         |
| ---------------------------------- | ---------------------------------- |
| Manually drawn                     | Derived from observed sessions     |
| Often outdated                     | Regenerated from observed behavior |
| Describes intended flow            | Represents observed flow           |
| Separate from telemetry            | Traceable to sessions/events       |
| Difficult to measure               | Feeds coverage analysis            |
| Missing branches easy to overlook  | Unobserved paths become visible    |

Keep the claim grounded: Tellann is not proving all intended requirements automatically; it is modeling what was observed and surfacing potential gaps.

---

# 51. Section — Observed vs expected

This distinction deserves a callout.

```text
OBSERVED WORKFLOW

What Tellann saw happen.


EXPECTED / POTENTIAL PATH

A path suggested by rules,
demonstration context, or analysis
that was not observed.
```

This prevents the product from implying that inferred workflow structure is equivalent to product requirements.

That skepticism will improve credibility.

---

# 52. Section — Relationship with Behavior Graphs

Heading:

> **Behavior Graphs provide the map. Workflow Discovery gives the map meaning.**

Show:

```text
BEHAVIOR GRAPH

all application behavior

        ↓ select meaningful region

WORKFLOW

Checkout
```

Button:

```text
Explore Behavior Graphs →
```

→ `/product/behavior-graphs`

---

# 53. Section — Relationship with coverage

Heading:

> **A workflow becomes the unit of quality reasoning.**

Connect:

```text
WORKFLOW DISCOVERY
      ↓
FLOW COVERAGE
      ↓
MISSING PATHS
      ↓
QA REPORT
```

This is the logical next product page architecture.

Potential future routes:

```text
/product/workflow-coverage
/product/missing-states
/product/missing-flows
```

---

# 54. Future Workflow Intelligence

Keep this short and visibly separated.

### Eyebrow

```text
WHERE WORKFLOW INTELLIGENCE GOES NEXT
```

### Phase 1

```text
Discovery
Boundaries
Entry/exit points
Workflow maps
Coverage
Missing paths
```

### Phase 2 — Planned

```text
Production workflow models
Common journeys
Abandonment analysis
Friction detection
Bottleneck analysis
Workflow health
```

The FRS introduces these as Phase 2 user-journey capabilities. 

### Phase 3 — Planned

```text
Workflow comparison
Regression detection
Generated validation scenarios
Behavioral anomaly detection
```

Always show:

```text
PLANNED
```

for future-phase capabilities.

---

# 55. FAQ

Recommended:

```text
What is Workflow Discovery?

How does Tellann identify a workflow?

Do I have to manually name workflows?

What is a workflow entry point?

What is a workflow exit point?

Can a workflow have multiple entry points?

Can one state belong to multiple workflows?

How does Tellann detect recurring patterns?

What is the difference between a workflow and a Behavior Graph?

How are workflow boundaries determined?

Can I view all workflows discovered in an application?

Can I replay the sessions behind a workflow?

How does Workflow Discovery affect coverage?

What happens when a workflow is incomplete?

Does Workflow Discovery monitor production users?

Does Tellann automatically generate tests from discovered workflows?
```

For the last two, current answer should distinguish Phase 1 from planned future functionality.

---

# 56. Final CTA

### Eyebrow

```text
DISCOVER YOUR FIRST WORKFLOW
```

### H2

> **Show Tellann what happens. Let the workflow emerge.**

Supporting copy:

> Record a demonstration and turn observed states and transitions into structured workflows your team can explore, measure, and use as QA evidence.

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

# 57. Complete media inventory

| Asset                       | Type                    |       Master |      Display |
| --------------------------- | ----------------------- | -----------: | -----------: |
| Hero workflow discovery     | SVG/Canvas              |    1920×1150 |     1360×800 |
| Mobile workflow view        | SVG                     |    1080×1440 |   Responsive |
| Events → Workflow           | Animated SVG            |    1800×1000 |     1100×611 |
| Workflow anatomy            | SVG                     |    1600×1000 |      900×562 |
| Automatic discovery         | Animated SVG            |    1800×1000 |     1100×611 |
| Entry-point diagram         | SVG                     |     1400×700 |      900×450 |
| Entry/exit comparison       | SVG                     |     1500×600 |     1000×400 |
| Boundary discovery          | Animated SVG            |    1800×1000 |     1100×611 |
| Path-type mini graphs       | SVG                     | 540×400 each |     ~270×200 |
| Recurring pattern animation | SVG                     |     1500×800 |      960×512 |
| Workflow Explorer           | Interactive HTML/Canvas |            — |     1280×780 |
| Workflow inventory          | HTML table              |            — |  1200px wide |
| Workflow metrics            | Product UI              |     1600×900 |      800×450 |
| Coverage workflow           | Animated SVG            |     1600×900 |     1000×562 |
| Missing paths               | Animated SVG            |     1600×900 |     1000×562 |
| Workflow → Replay           | Video                   |    1920×1200 |     1000×625 |
| Endpoint overlay            | Interactive SVG/UI      |    1600×1000 |      900×562 |
| Multi-demo discovery        | Animated SVG            |    1800×1000 |     1100×611 |
| Workflow Report             | Image/UI                |    1000×1280 | ~760×970 max |

The page therefore needs about **19 visual surfaces**, but many should share the same graph/workflow rendering engine rather than being separate exports.

---

# 58. Reusable visualization architecture

Do not hand-build every workflow graphic.

Extend the Behavior Graph component into:

```tsx
<WorkflowGraph
  workflow={workflow}
  mode="discovery"
/>
```

Suggested modes:

```ts
type WorkflowVisualizationMode =
  | "hero"
  | "anatomy"
  | "boundaries"
  | "entry-exit"
  | "paths"
  | "frequency"
  | "coverage"
  | "missing"
  | "endpoints"
  | "explorer";
```

The same visual grammar should appear in the actual Tellann dashboard later.

---

# 59. Workflow data model

Conceptually:

```ts
interface Workflow {
  id: string;
  name: string;

  entryStates: string[];
  exitStates: string[];

  states: string[];
  transitions: string[];

  successPaths: WorkflowPath[];
  failurePaths: WorkflowPath[];

  observedSessionCount: number;

  coverage?: number;
}
```

The specification currently shows a single `entryState` and `exitState` example, so supporting arrays in the website architecture would be a forward-compatible implementation decision rather than a claim about the existing specification. 

---

# 60. Animation language

Workflow Discovery animation should communicate:

```text
observe
repeat
cluster
bound
name
branch
measure
```

Good motion:

```text
Repeated path becomes brighter
Workflow boundary draws around nodes
Entry marker appears
Exit marker appears
Path branches
Coverage overlays
```

Bad:

```text
floating nodes with no purpose
random particle systems
AI brain graphics
infinite moving graphs
```

---

# 61. Sticky explanatory section

A useful mid-page interaction:

```text
LEFT
Workflow map stays sticky

RIGHT
01 Entry
02 States
03 Transition
04 Branch
05 Exit
06 Workflow
```

Desktop ratio:

```text
7 columns visual
5 columns explanation
```

As the visitor scrolls:

```text
Entry highlighted
↓
Main path highlighted
↓
Failure branch highlighted
↓
Exit highlighted
↓
Whole workflow selected
```

---

# 62. Responsive design

## Desktop ≥1280px

Use complete maps and split UI.

## 1024–1279px

Reduce large diagrams to ~960–1050px.

## Tablet

Text usually moves above visualization.

## Mobile

Workflow Explorer becomes:

```text
Workflow
[ Checkout ▾ ]

Summary

Graph

Paths
[ Observed ]
[ Missing ]

Evidence
```

Do not horizontally squeeze full desktop workflow maps.

---

# 63. Mobile workflow graph

Simplify:

```text
PRODUCT

   ↓

CART

   ↓

CHECKOUT

  ↙   ↘

SUCCESS FAILURE
```

Allow:

```text
[ Open full map ]
```

fullscreen modal.

---

# 64. Accessibility

All visual workflows need a non-graph representation.

Provide:

```text
Graph
List
```

List example:

```text
CHECKOUT

Entry:
PRODUCT_VIEW

1. PRODUCT_VIEW
   → ADD_TO_CART

2. CART_ACTIVE
   → CHECKOUT_CLICK

3. CHECKOUT
   → SUBMIT_PAYMENT

4A. PAYMENT_SUCCESS
4B. PAYMENT_FAILURE
```

This also helps search engines index meaningful page content.

---

# 65. Reduced motion

Under:

```css
@media (prefers-reduced-motion: reduce)
```

replace:

```text
workflow clustering
animated path tracing
boundary drawing
frequency pulses
```

with complete static diagrams.

---

# 66. SEO

### Title

> **Workflow Discovery — Automatically Map Application Workflows | Tellann**

Alternative:

> **Application Workflow Discovery | Tellann**

### Meta description

> See how Tellann discovers application workflows from observed behavior, identifies entry and exit points, maps states and transitions, measures coverage, exposes missing paths, and connects workflows to sessions and API activity.

---

# 67. Suggested H1/H2 structure

```text
H1
See the workflows hidden inside application behavior.

H2
Workflows emerge from observed behavior.

H2
A workflow is behavior with an objective.

H2
The workflow is discovered—not manually wired together.

H2
Where does a workflow actually begin?

H2
And where is the objective considered complete?

H2
Tellann separates meaningful processes from the larger graph.

H2
Real workflows branch.

H2
Repeated paths reveal the workflows that keep happening.

H2
Explore discovered workflows as living structures.

H2
Turn an application into an inventory of behavior.

H2
A discovered workflow becomes measurable.

H2
Discovery gives coverage something meaningful to measure.

H2
A discovered workflow also makes its missing branches visible.

H2
Every discovered workflow should lead back to what was observed.

H2
See the APIs involved in a workflow.

H2
New demonstrations can reveal new workflows and branches.

H2
A discovered workflow can become a QA artifact.

H2
The map should follow the application—not become another document to maintain.

H2
Behavior Graphs provide the map. Workflow Discovery gives the map meaning.

H2
Show Tellann what happens. Let the workflow emerge.
```

---

# 68. Analytics instrumentation

Track:

```text
workflow_hero_interacted

workflow_selected
workflow_path_selected

workflow_entry_selected
workflow_exit_selected

workflow_filter_used
workflow_search_used

workflow_missing_path_opened
workflow_session_opened
workflow_replay_opened

workflow_endpoint_context_enabled

workflow_report_previewed

workflow_demonstration_clicked
workflow_signup_clicked
```

Useful properties:

```json
{
  "workflow": "checkout",
  "interaction": "missing_path_selected"
}
```

---

# 69. Strongest conceptual distinction

This page needs to reinforce one very specific chain:

```text
EVENTS
tell you something happened.

STATES
tell you where the application was.

TRANSITIONS
tell you how it moved.

BEHAVIOR GRAPH
connects all observed behavior.

WORKFLOW DISCOVERY
identifies which connected regions
represent meaningful processes.

COVERAGE
tells you how much of those processes
you actually exercised.
```

That progression is the intellectual center of this page.

---

# 70. Final visitor experience

By the bottom of `/product/workflow-discovery`, the visitor should mentally arrive here:

```text
I performed checkout.

        ↓

Tellann captured the behavior.

        ↓

It reconstructed the states:

Product
Cart
Checkout
Payment

        ↓

It recognized their relationships.

        ↓

It understood that this connected sequence
represents a Checkout workflow.

        ↓

It found where that workflow starts
and where it completes.

        ↓

It preserved success and failure branches.

        ↓

It showed which paths I demonstrated.

        ↓

It showed which paths I did not.

        ↓

It linked the workflow back to
sessions and API activity.

        ↓

Now "coverage" describes meaningful
software behavior—not merely raw events.
```

That is the role `/product/workflow-discovery` should play in the Tellann website: **Behavior Graphs reveal the structure of the application; Workflow Discovery turns that structure into recognizable business processes that the rest of Tellann can measure and reason about.**   
