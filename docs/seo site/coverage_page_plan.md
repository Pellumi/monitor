# `/product/coverage` — Complete Page Specification

`/product/coverage` should be the **measurement layer of Tellann's Phase 1 product story**.

The Behavior Graph tells a team **what behavior exists**. Workflow Discovery tells them **which connected behaviors form meaningful processes**. Coverage answers:

> **How much of that behavior have we actually exercised—and what have we not seen yet?**

This is explicitly a Phase 1 capability. Tellann's requirements call for workflow coverage percentages, observed and unobserved paths, incomplete workflows, coverage reports, low-coverage critical-workflow highlighting, and session-to-session coverage comparison. 

The MVP expands coverage into five dimensions: **workflow, state, transition, endpoint, and error coverage**, with outputs for coverage %, observed paths, missing paths, and critical gaps. 

---

# 1. Position in the Product story

The current product journey becomes:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does the full pipeline operate?

        ↓

/product/demonstration-mode
How is behavior captured?

        ↓

/product/behavior-graphs
How is behavior structured?

        ↓

/product/workflow-discovery
Which structures represent workflows?

        ↓

/product/session-replay
What evidence produced the behavior?

        ↓

/product/coverage
How much of that behavior have we exercised?
```

The conceptual division should stay very clear:

```text
BEHAVIOR GRAPH
What behavior is represented?

WORKFLOW DISCOVERY
Which behaviors form meaningful processes?

SESSION REPLAY
What happened in an individual session?

COVERAGE
Which parts of those processes were observed—
and which remain unobserved?
```

---

# 2. Primary page message

The strongest positioning is:

> **Coverage should tell you more than whether code executed. It should tell you which software behavior you actually exercised.**

Supporting idea:

> Tellann measures demonstrated workflows across states, transitions, endpoints, errors, and paths—so a percentage can be traced back to actual behavior.

Do not position Tellann coverage as conventional:

```text
line coverage
branch coverage
function coverage
statement coverage
```

Those measure **source-code execution**.

Tellann is measuring **behavioral coverage**.

---

# 3. Page objectives

The page needs to explain:

```text
What does Tellann mean by coverage?

How is behavioral coverage different from code coverage?

What is workflow coverage?

What is state coverage?

What is transition coverage?

What is endpoint coverage?

What is error coverage?

What is an observed path?

What is an unobserved path?

What makes a workflow incomplete?

How do missing states affect coverage?

How do missing flows affect coverage?

Can coverage be traced back to sessions?

Can two demonstration sessions be compared?

What constitutes a critical gap?

What does a Coverage Report contain?
```

---

# 4. Important specification boundary

The uploaded requirements define **coverage categories, required outputs, and functional behavior**, but they do **not provide a definitive mathematical formula for every coverage dimension** in the material retrieved here.

Therefore the public page should confidently explain:

```text
what is measured
what was observed
what was unobserved
which gaps exist
how sessions contributed
```

but you should **not publish invented formulas such as**:

```text
Coverage =
Observed States / All Possible States × 100
```

until the Coverage Analysis Engine has an authoritative denominator and calculation specification.

That distinction is important because "all possible behavior" is not necessarily knowable merely from demonstration telemetry.

---

# 5. Recommended page architecture

```text
/product/coverage
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Behavioral Coverage Explained
├── 04 Coverage vs Code Coverage
├── 05 The Five Coverage Dimensions
├── 06 Workflow Coverage
├── 07 State Coverage
├── 08 Transition Coverage
├── 09 Endpoint Coverage
├── 10 Error Coverage
├── 11 Observed vs Unobserved Paths
├── 12 Interactive Coverage Explorer
├── 13 Coverage on the Behavior Graph
├── 14 Incomplete Workflows
├── 15 Critical Gaps
├── 16 Missing States + Coverage
├── 17 Missing Flows + Coverage
├── 18 Coverage + Session Evidence
├── 19 Coverage Comparison
├── 20 Coverage Report
├── 21 Improving Coverage
├── 22 What Coverage Does Not Mean
├── 23 Future Coverage Intelligence
├── 24 FAQ
├── 25 Final CTA
└── 26 Footer
```

---

# 6. Hero

### Eyebrow

```text
BEHAVIORAL COVERAGE
```

### H1

> **Know what your workflow covered—and what it didn't.**

Alternative:

> **Measure the behavior you actually exercised.**

I prefer the first for this page because it communicates both measurement and gaps.

### Supporting copy

> Tellann turns demonstrated behavior into measurable workflow coverage across states, transitions, endpoints, errors, and paths—then shows the evidence behind what was observed and what remains unseen.

The five Phase 1 coverage categories and path-level outputs are explicitly included in MVP scope. 

### CTA

```text
[ Explore coverage ]
[ See how it is measured → ]
```

Tertiary:

```text
Explore Workflow Discovery →
```

---

# 7. Hero visual

Do **not** begin with a gauge saying `72%`.

The first visual should explain where that percentage comes from.

Use a Behavior Graph with observed and unobserved paths.

Example:

```text
                     CHECKOUT WORKFLOW


PRODUCT_VIEW
     │
     │ observed
     ▼
CART_ACTIVE
     │
     │ observed
     ▼
CHECKOUT
  /       |        \
 /        |         \
▼         ▼          ▼

SUCCESS   FAILURE    SESSION_TIMEOUT
  │        ┆              ┆
  │        ┆              ┆
observed  unobserved     unobserved


Coverage
72%
```

This tells a much stronger story than a generic analytics dashboard.

---

# 8. Hero visual dimensions

Use SVG/Canvas.

### Master canvas

```text
1920 × 1120
```

### Desktop render

```text
max-width: 1320px
height: 730–770px
```

### Placement

```text
Hero text
   ↓ 48px
Interactive coverage graph
```

Use full-width stacked hero rather than 50/50.

---

# 9. Hero animation

Duration:

```text
8–10 seconds
```

Sequence:

```text
0–2s
Complete workflow appears faintly.

2–4s
Observed nodes resolve.

4–6s
Observed transitions become solid.

6–7s
Unobserved paths remain dashed.

7–8s
Coverage dimensions appear.

8–9s
72% resolves.

9–10s
"3 potential gaps" appears.
```

Then enter interactive state.

Do not continuously animate coverage.

---

# 10. Mobile hero

Simplify to:

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
  ↙      ↘
SUCCESS  FAILURE
          ┆
       RETRY
```

Where:

```text
solid = observed
dashed = not observed
```

Dimensions:

```text
Master: 1080 × 1350
Display: calc(100vw - 32px)
Height: ~620px
```

---

# 11. Section — What behavioral coverage means

### H2

> **Coverage becomes useful when it describes behavior.**

Show:

```text
428 captured events
```

versus:

```text
Checkout Workflow

12 states
18 transitions
6 observed paths
3 unobserved paths
72% coverage
```

Tellann's requirements explicitly place coverage after behavioral graph and workflow reconstruction rather than treating raw event volume itself as coverage. 

---

# 12. Concept visual

Transformation:

```text
EVENTS

click
route
API
state
form

       ↓

WORKFLOW MODEL

PRODUCT
   ↓
CART
   ↓
CHECKOUT

       ↓

COVERAGE

Observed
Missing
Incomplete
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

# 13. Section — Behavioral coverage vs code coverage

### H2

> **Code coverage asks what executed. Tellann asks what behavior you exercised.**

Use a direct comparison.

| Code coverage                                        | Tellann behavioral coverage             |
| ---------------------------------------------------- | --------------------------------------- |
| Source-code oriented                                 | Workflow oriented                       |
| Lines/functions/branches                             | States/transitions/paths                |
| Shows whether code executed                          | Shows whether behavior was observed     |
| Often tied to test execution                         | Derived from observed sessions          |
| Does not inherently describe business workflows      | Structured around application workflows |
| Does not tell you which user path produced execution | Traceable to behavioral sessions        |

Don't frame this as:

> Tellann replaces code coverage.

Better:

> They answer different QA questions.

That is more credible and leaves Tellann complementary to existing testing tools.

---

# 14. Comparison media

Prefer HTML rather than an exported image.

Desktop container:

```text
1200 × ~520px
```

Layout:

```text
CODE COVERAGE              BEHAVIORAL COVERAGE

████████░░ 82%            Checkout
                           Product
                              ↓
                           Cart
                              ↓
                           Checkout
                           ↙     ↘
                       Success   Failure
```

The Tellann side should visually dominate slightly.

---

# 15. Section — The five coverage dimensions

### H2

> **Coverage has more than one dimension.**

The MVP explicitly includes five forms of coverage. 

Use five horizontally aligned cards on large desktop:

```text
WORKFLOW

STATE

TRANSITION

ENDPOINT

ERROR
```

For each, provide a one-line question.

```text
Workflow
Which workflow paths were exercised?

State
Which meaningful application states appeared?

Transition
Which movements between states occurred?

Endpoint
Which workflow-related endpoints were exercised?

Error
Which error behavior was actually observed?
```

---

# 16. Five-card dimensions

Desktop ≥1280:

```text
5 columns
220–235px wide
260px high
16px gap
```

Tablet:

```text
3 + 2
```

Mobile:

```text
horizontal swipe cards
or single column
```

Each card gets a miniature data visualization rather than a generic icon.

---

# 17. Workflow Coverage section

### H2

> **Did you exercise the workflow—or only its happy path?**

Example:

```text
CHECKOUT

Observed:

Product
  ↓
Cart
  ↓
Checkout
  ↓
Payment Success


Not observed:

Checkout
  ├── Payment Failure
  ├── Session Timeout
  ├── Inventory Changed
  └── Out of Stock
```

The QA Report specification uses Checkout as an example with observed and missing paths including Payment Failure, Out of Stock, Inventory Changed, Session Timeout, and Gateway Failure. 

---

# 18. Workflow Coverage visual

Master:

```text
1600 × 1000
```

Display:

```text
1000 × 625
```

Layout:

```text
Graph               Coverage summary
7 columns           5 columns
```

Coverage summary:

```text
CHECKOUT

Coverage
75%

Observed paths
15

Missing paths
5
```

Use:

```text
Sample application
```

label.

---

# 19. State Coverage section

### H2

> **Which application states did the demonstration actually reach?**

Show state inventory:

```text
OBSERVED

✓ PRODUCT_VIEW
✓ CART_ACTIVE
✓ CHECKOUT
✓ PAYMENT_SUCCESS


NOT OBSERVED

○ PAYMENT_FAILURE
○ EMPTY_CART
○ CHECKOUT_LOADING
○ SESSION_EXPIRED
```

Missing state capabilities specifically include missing error, empty, loading, and failure states. 

---

# 20. State Coverage visualization

Grid of nodes:

```text
PRODUCT_VIEW      ✓
CART_ACTIVE       ✓
CHECKOUT          ✓
PAYMENT_PENDING   ✓
PAYMENT_SUCCESS   ✓

PAYMENT_FAILURE   ○
EMPTY_CART        ○
LOADING           ○
```

Master:

```text
1440 × 900
```

Display:

```text
820 × 512
```

Animate observed states filling from the underlying session.

---

# 21. Transition Coverage section

### H2

> **A state matters. The path into and out of it matters too.**

Example:

```text
CART
 │
 │ observed
 ▼
CHECKOUT
 │
 ├──────── observed ──────→ SUCCESS
 │
 ├ - - unobserved - - - → FAILURE
 │
 └ - - unobserved - - - → TIMEOUT
```

Tellann is explicitly required to identify state transitions and calculate transition frequencies before using them in coverage analysis. 

---

# 22. Transition animation

Master:

```text
1500 × 800
```

Display:

```text
900 × 480
```

Animation:

```text
Session enters CART

→ CART → CHECKOUT becomes solid

→ CHECKOUT → SUCCESS becomes solid

→ alternative edges remain dashed
```

Duration:

```text
5–6 seconds
```

---

# 23. Endpoint Coverage section

### H2

> **See which backend behavior supported the demonstrated workflow.**

Example:

```text
CHECKOUT WORKFLOW

GET /products        observed
POST /cart           observed
POST /checkout       observed
POST /payment        observed

POST /payment/retry  not observed
```

Backend capture includes request/response metadata, response times, API errors, execution statistics, and session correlation where possible. 

---

# 24. Endpoint visual

Prefer real product UI:

```text
Endpoint                Observed     Sessions

GET /products              ✓          24
POST /cart                 ✓          18
POST /checkout             ✓          15
POST /payment              ✓          15
POST /payment/retry        —           0
```

Master screenshot:

```text
1600 × 1000
```

Display:

```text
760 × 475
```

Do not imply source-code endpoint discovery if the endpoint was never observed unless another system actually provides that inventory.

---

# 25. Error Coverage section

### H2

> **A workflow is not covered simply because success worked.**

This is an important section.

Visual:

```text
PAYMENT

Successful payment
✓ observed

Payment rejected
○ not observed

Gateway error
○ not observed

Timeout
○ not observed

Retry
○ not observed
```

The MVP's missing-flow model specifically includes failure, alternative, recovery, and edge-case paths. 

---

# 26. Error Coverage visual dimensions

Master:

```text
1440 × 850
```

Display:

```text
900 × 531
```

Use a branch graph rather than a donut chart.

---

# 27. Section — Observed vs unobserved

### H2

> **Coverage is a map of evidence and absence.**

This should establish the page's graphical language.

```text
SOLID NODE
Observed state

SOLID EDGE
Observed transition

DASHED NODE
Potential / expected state not observed

DASHED EDGE
Potential / expected path not observed

EVIDENCE COUNT
Number of supporting observations
```

Never use color alone to distinguish observed/unobserved.

---

# 28. Observed-path interaction

Click:

```text
PRODUCT → CART → CHECKOUT → SUCCESS
```

Panel:

```text
OBSERVED PATH

Observed in
15 sessions

States
4

Transitions
3

Errors
0

[ View supporting sessions ]
```

---

# 29. Unobserved-path interaction

Click:

```text
CHECKOUT → PAYMENT_FAILURE
```

Panel:

```text
POTENTIAL GAP

Status
Not observed

Category
Failure path

Related workflow
Checkout

Suggested next step
Demonstrate this path
```

Do not call it a defect.

---

# 30. Interactive Coverage Explorer

This should be the strongest interactive product surface on the page.

### H2

> **Explore coverage from score to evidence.**

Desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ Checkout                              Coverage 72%      │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│ COVERAGE        │          WORKFLOW GRAPH               │
│                 │                                       │
│ Workflow 72%    │                                       │
│ State    81%    │                                       │
│ Transition 69%  │                                       │
│ Endpoint 87%    │                                       │
│ Error    42%    │                                       │
│                 │                                       │
├─────────────────┴───────────────────────────────────────┤
│ Selected: PAYMENT_FAILURE · Not observed               │
└─────────────────────────────────────────────────────────┘
```

All example values must be labeled illustrative/sample.

---

# 31. Explorer dimensions

Desktop:

```text
1280 × 800px
```

Container:

```text
max-width: 1400px
```

Tablet:

```text
960 × ~760px
```

Mobile:

```text
Coverage summary
↓
Dimension selector
↓
Workflow graph
↓
Selected finding
```

---

# 32. Explorer controls

Use:

```text
Workflow
[ Checkout ▾ ]

Coverage
[ Overall ]
[ States ]
[ Transitions ]
[ Endpoints ]
[ Errors ]

Paths
[ All ]
[ Observed ]
[ Unobserved ]
```

Optional:

```text
[ Fit graph ]
[ Zoom + ]
[ Zoom − ]
```

Do not load the public demo with dashboard-level complexity.

---

# 33. Coverage Summary component

Example:

```text
CHECKOUT

Overall coverage
72%

────────────────

Workflow
72%

State
81%

Transition
69%

Endpoint
87%

Error
42%

────────────────

Observed paths
18

Missing paths
7
```

The five dimensions are defined in both MVP and QA reporting specifications. 

---

# 34. Do not overstate "Overall Coverage"

If Tellann does not yet have an authoritative weighting model for combining the five dimensions:

```text
Workflow
State
Transition
Endpoint
Error
```

do not invent:

```text
Overall =
20% + 20% + 20% + 20% + 20%
```

The public UI can instead show:

```text
Workflow coverage
72%
```

as the primary metric, with the dimensions underneath.

Once a scoring specification exists, you can introduce a formal composite score.

---

# 35. Section — Coverage on the Behavior Graph

### H2

> **The graph shows exactly where coverage exists.**

Use the full Behavior Graph:

```text
AUTHENTICATED
     │
     ▼
PRODUCTS
     │
     ▼
PRODUCT
     │
     ▼
CART
     │
     ▼
CHECKOUT
  ↙     ↘
SUCCESS FAILURE
```

Coverage overlay causes:

```text
observed regions → strong
unobserved regions → dashed/dimmed
```

This directly connects `/product/coverage` with `/product/behavior-graphs`.

---

# 36. Coverage-overlay video

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
7–9 seconds
```

Sequence:

```text
Open Behavior Graph

↓

Select "Coverage"

↓

Observed graph regions resolve

↓

Unobserved branches appear dashed

↓

Select Checkout

↓

Coverage panel opens
```

---

# 37. Section — Incomplete workflows

### H2

> **A workflow can exist without being fully exercised.**

The functional requirements explicitly require Tellann to identify incomplete workflows. 

Example:

```text
REGISTRATION

Registration Form
     ↓
Submit
     ↓
Registered
```

Observed.

But:

```text
Invalid Input
Email Exists
Network Failure
```

not observed.

Display:

```text
INCOMPLETE COVERAGE
```

not:

```text
BROKEN WORKFLOW
```

---

# 38. Incomplete-workflow card

Example:

```text
REGISTRATION

Coverage
61%

Observed paths
4

Unobserved paths
5

Potential gaps

• Invalid submission
• Existing account
• API failure
```

Dimensions:

```text
360 × 360px
```

Use three example cards:

```text
Checkout
Registration
Search
```

---

# 39. Section — Critical gaps

### H2

> **Not every uncovered path deserves equal attention.**

FR-040 requires low-coverage critical workflows to be highlighted. 

This lets the page introduce prioritization without claiming autonomous AI reasoning.

Example:

```text
CRITICAL WORKFLOW

Checkout
Coverage 45%

Potential gaps
Payment Failure
Session Timeout
Inventory Change
```

---

# 40. Critical-gap UI

Use:

```text
Criticality
High

Coverage
45%

Missing paths
5
```

But criticality should come from configured workflow importance or a defined product rule.

Do not silently infer business criticality.

A good future configuration is:

```text
Workflow priority

Critical
High
Normal
Low
```

Then coverage can prioritize accordingly.

---

# 41. Section — Missing states + coverage

### H2

> **Sometimes the missing piece is a state, not an entire workflow.**

Example:

```text
SEARCH

Search form
   ↓
Results

Observed
✓ Results populated

Missing
○ Loading
○ Empty results
○ API error
```

MVP missing-state detection explicitly covers loading, empty, error, and recovery states. 

---

# 42. Missing-state animation

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Sequence:

```text
Observed flow appears

↓

Populated state highlighted

↓

Loading placeholder appears

↓

Empty placeholder appears

↓

Error placeholder appears
```

Use label:

```text
Potential missing state
```

---

# 43. Section — Missing flows + coverage

### H2

> **Sometimes the missing piece is an entire branch.**

Example:

```text
LOGIN

Observed

Credentials
    ↓
Authenticated


Unobserved

Credentials
 ├── Invalid password
 ├── Account locked
 ├── Password reset
 └── Session expired
```

Developer Demonstration documentation explicitly describes missing flows as likely workflow paths that were not demonstrated and groups them into error, alternative, and recovery flows. 

---

# 44. Section — Coverage + Session Evidence

### H2

> **Every observed path should be backed by sessions.**

Show:

```text
OBSERVED PATH

Product
 ↓
Cart
 ↓
Checkout
 ↓
Success

Observed in
15 sessions

          ↓

SES-3817
SES-3824
SES-3901
...
```

Clicking a session:

```text
Open replay →
```

This creates a critical relationship:

```text
Coverage
   ↓
Path
   ↓
Session
   ↓
Replay
   ↓
Events
```

---

# 45. Coverage-to-Replay video

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
8–10 seconds
```

Sequence:

```text
Coverage dashboard

↓

Click observed path

↓

Supporting sessions

↓

Select SES-3817

↓

Session Replay opens
```

---

# 46. Section — Coverage Comparison

### H2

> **See what changed between demonstrations.**

Coverage comparison between sessions is explicitly a Phase 1 functional requirement, and the API specification defines a `/coverage/comparison` endpoint accepting two sessions.  

Example:

```text
CHECKOUT

SESSION A             SESSION B

Workflow  55%         72%
States    64%         81%
Transitions 51%       69%
Endpoints 72%         87%
Errors    14%         42%
```

All values illustrative.

---

# 47. Comparison visual

Use two synchronized graphs rather than just numbers.

```text
SESSION A                    SESSION B

PRODUCT                      PRODUCT
  ↓                            ↓
CART                         CART
  ↓                            ↓
CHECKOUT                     CHECKOUT
  ↓                           ↙    ↘
SUCCESS                   SUCCESS FAILURE
```

Then show:

```text
Newly observed
PAYMENT_FAILURE
```

This is much easier to understand.

---

# 48. Comparison media dimensions

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
Session A graph
↓
Session B graph
↓
new state pulses once
↓
coverage delta appears
```

Duration:

```text
6 seconds
```

---

# 49. Avoid calling this regression detection

This matters.

Session-to-session coverage comparison is Phase 1.

Automated **regression detection and release validation** are Phase 3 concepts in the reporting architecture. The QA reporting specification places release validation and regression reports in later phases. 

Therefore say:

> **Compare demonstrated coverage.**

Not:

> **Automatically detect regressions between releases.**

---

# 50. Section — Coverage Report

### H2

> **Turn coverage into a QA artifact.**

The QA Report Specification defines the Flow Coverage Report specifically to measure workflow completeness and includes:

```text
Workflow
Coverage
Observed Paths
Missing Paths

Coverage Metrics:
Workflow Coverage
State Coverage
Transition Coverage
Endpoint Coverage
Error Coverage
```



---

# 51. Coverage Report visual

Use a portrait report.

Example:

```text
FLOW COVERAGE REPORT

Application
Storefront Demo

Workflow
CHECKOUT

Coverage
75%

Observed Paths
15

Missing Paths
5


COVERAGE

Workflow       75%
State          83%
Transition     71%
Endpoint       89%
Error          40%


MISSING

Payment Failure
Out of Stock
Inventory Changed
Session Timeout
Gateway Failure
```

### Master

```text
1000 × 1280
```

### Display

```text
600 × 768px
```

Desktop layout:

```text
Copy                   Report preview
5 columns              7 columns
```

---

# 52. Export

The report system supports:

```text
PDF
CSV
JSON
HTML
```



Show a small export strip under the report preview.

Don't make export formats a major page section.

---

# 53. Section — Improving coverage

### H2

> **The next useful demonstration is the one that fills a real gap.**

Show iterative process:

```text
DEMO 01

Checkout success
Coverage 45%

        ↓

Tellann surfaces:
Payment Failure
Session Timeout

        ↓

DEMO 02

Demonstrate Payment Failure

        ↓

Behavior model expands
Coverage increases
```

This is the practical loop that makes coverage actionable.

---

# 54. Improvement-loop visual

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Animation:

```text
45%
↓
missing branch selected
↓
new demonstration
↓
branch becomes observed
↓
coverage resolves upward
```

Do not hardcode the resulting percentage unless it is illustrative.

---

# 55. Suggested gap CTA

When a path is not observed:

```text
PAYMENT_FAILURE
Not observed

[ Demonstrate this path ]
```

This should eventually launch or configure Demonstration Mode around that workflow.

This creates a powerful product loop:

```text
Analyze
    ↓
Find gap
    ↓
Demonstrate
    ↓
Re-analyze
    ↓
Expand coverage
```

---

# 56. Section — What coverage does not mean

This is important enough for its own section.

### H2

> **Coverage is evidence—not a guarantee.**

Explain clearly:

```text
90% coverage does NOT mean
"the application is 90% bug-free."

100% observed workflow coverage does NOT mean
"every possible failure condition has been tested."

An unobserved path does NOT automatically mean
"there is a bug."

Coverage tells you what behavioral surface
has been exercised relative to the model
Tellann is analyzing.
```

This makes the product considerably more trustworthy.

---

# 57. Another important distinction

Separate:

```text
OBSERVED
Tellann has behavioral evidence.

UNOBSERVED
Tellann has no evidence from the selected dataset.

MISSING / POTENTIAL GAP
Tellann's model or rules indicate behavior worth exercising.

FAILED
Observed behavior actually resulted in failure.
```

Do not mix these statuses.

---

# 58. Recommended status vocabulary

Use the same throughout the product:

```text
OBSERVED
UNOBSERVED
PARTIAL
POTENTIAL GAP
FAILED
```

Avoid ambiguous:

```text
PASSED
```

unless Tellann actually applied validation criteria.

Observation is not automatically verification.

---

# 59. Future coverage intelligence

Keep this section compact.

### Phase 1 — Behavioral QA

```text
Workflow coverage
State coverage
Transition coverage
Endpoint coverage
Error coverage
Observed paths
Unobserved paths
Session comparison
Coverage reports
```

These are current Phase 1 requirements. 

### Phase 2 — Planned

```text
Production coverage comparison
Workflow-health context
Real-user journey coverage
Behavior trends
```

Continuous production monitoring and workflow-health metrics begin in Phase 2. 

### Phase 3 — Planned

```text
Release coverage delta
Regression analysis
Generated validation coverage
Risk-oriented quality intelligence
```

Clearly label:

```text
PLANNED
```

---

# 60. FAQ

Recommended questions:

```text
What is behavioral coverage?

How is Tellann coverage different from code coverage?

What is workflow coverage?

What is state coverage?

What is transition coverage?

What is endpoint coverage?

What is error coverage?

What is an observed path?

What is an unobserved path?

Does an unobserved path mean something is broken?

How are missing paths discovered?

Can I see the sessions behind a coverage result?

Can I compare coverage between demonstrations?

Does Tellann replace unit or integration-test coverage?

Can coverage reach 100%?

Does 100% coverage mean the application has no bugs?

Does Tellann measure production traffic today?
```

The last should explicitly distinguish Phase 1 Demonstration Mode from planned Phase 2 production monitoring.

---

# 61. Final CTA

### Eyebrow

```text
SEE WHAT YOU HAVEN'T EXERCISED
```

### H2

> **Turn one workflow into measurable behavioral coverage.**

Supporting copy:

> Demonstrate an application workflow and see which states, transitions, endpoints, errors, and paths Tellann observed—and where the remaining gaps may be.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Optional contextual:

```text
Explore Workflow Discovery →
```

---

# 62. Complete media inventory

| Asset                           | Type                    | Master dimensions |      Display |
| ------------------------------- | ----------------------- | ----------------: | -----------: |
| Hero Coverage Graph             | SVG/Canvas              |         1920×1120 |     1320×760 |
| Mobile Coverage Graph           | SVG                     |         1080×1350 |   Responsive |
| Events → Coverage               | Animated SVG            |          1600×900 |     1000×562 |
| Code vs Behavioral Coverage     | HTML/SVG                |                 — |     1200×520 |
| Five Coverage Cards             | HTML/SVG                |                 — | 5 × ~230×260 |
| Workflow Coverage               | SVG/UI                  |         1600×1000 |     1000×625 |
| State Coverage                  | Animated SVG            |          1440×900 |      820×512 |
| Transition Coverage             | Animated SVG            |          1500×800 |      900×480 |
| Endpoint Coverage               | Product UI              |         1600×1000 |      760×475 |
| Error Coverage                  | SVG                     |          1440×850 |      900×531 |
| Coverage Explorer               | Interactive HTML/Canvas |                 — |     1280×800 |
| Behavior Graph Coverage Overlay | Product video           |         1920×1200 |     1000×625 |
| Incomplete Workflow Cards       | HTML                    |                 — | 360×360 each |
| Missing State Analysis          | Animated SVG            |          1600×900 |     1000×562 |
| Missing Flow Analysis           | Animated SVG            |          1600×900 |     1000×562 |
| Coverage → Replay               | Product video           |         1920×1200 |     1000×625 |
| Session Comparison              | Animated SVG/UI         |         1800×1000 |     1100×611 |
| Flow Coverage Report            | Report image/UI         |         1000×1280 |      600×768 |
| Coverage Improvement Loop       | Animated SVG            |          1600×900 |     1000×562 |

So `/product/coverage` contains roughly **19 visual surfaces**, but many should be rendered from reusable product components rather than maintained as nineteen independent assets.

---

# 63. Reusable Coverage architecture

Build a common coverage visual layer rather than hardcoding each page section:

```tsx
<CoverageGraph
  workflow={workflow}
  dimension="overall"
  showObserved
  showUnobserved
/>
```

Suggested modes:

```ts
type CoverageDimension =
  | "workflow"
  | "state"
  | "transition"
  | "endpoint"
  | "error";

type CoverageView =
  | "hero"
  | "summary"
  | "graph"
  | "gaps"
  | "comparison"
  | "evidence";
```

Then reuse the Behavior Graph rendering system underneath it:

```text
BehaviorGraph
      +
Coverage Overlay
      =
CoverageGraph
```

That will keep `/product/behavior-graphs`, `/product/workflow-discovery`, and `/product/coverage` visually consistent.

---

# 64. Conceptual data model

A useful frontend model could look like:

```ts
interface WorkflowCoverage {
  workflowId: string;

  workflowCoverage?: number;
  stateCoverage?: number;
  transitionCoverage?: number;
  endpointCoverage?: number;
  errorCoverage?: number;

  observedPaths: CoveragePath[];
  unobservedPaths: CoveragePath[];

  supportingSessions: string[];
}
```

But do not encode arbitrary scoring formulas in the frontend.

The API already reserves coverage overview, workflow coverage, workflow detail, and comparison endpoints. 

Calculation belongs in the coverage domain/service layer.

---

# 65. Primary animation language

This page should use:

```text
reveal
compare
fill
trace
differentiate
expand
```

Examples:

```text
observed edge becomes solid
unobserved branch remains dashed
path lights from entry to exit
new demonstration fills a missing branch
session comparison reveals new nodes
```

Avoid:

```text
spinning percentages
decorative particle systems
animated gauges everywhere
random graph motion
```

Coverage is inherently visual already.

---

# 66. Scroll choreography

A particularly effective section can progressively build the meaning of `72%`:

```text
72%

↓ scroll

72% of what?

↓ scroll

Checkout workflow

↓ scroll

12 states

↓ scroll

18 transitions

↓ scroll

15 observed paths

↓ scroll

5 unobserved paths

↓ scroll

Supporting sessions
```

This communicates the principle:

> **Never show a coverage percentage without explaining its behavioral denominator/model.**

That should become a Tellann UX rule beyond the marketing page.

---

# 67. Responsive behavior

### Desktop ≥1280px

Use complete split layouts and interactive graphs.

### 1024–1279px

Keep graph and summary, but reduce side-panel width.

### Tablet

Stack:

```text
Coverage summary
↓
Graph
```

### Mobile

Use:

```text
Checkout
72%

[ Workflow ]
[ States ]
[ Transitions ]
[ Endpoints ]
[ Errors ]

Graph

Observed 18
Unobserved 7

Findings
```

The dimension buttons can horizontally scroll.

---

# 68. Mobile graph simplification

Never squeeze a 30-node graph onto 360px.

Show the selected workflow only:

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
  ↙      ↘
SUCCESS FAILURE
```

Provide:

```text
[ Open full graph ]
```

for fullscreen exploration.

---

# 69. Accessibility

Coverage must never be encoded only through:

```text
green = observed
red = missing
```

Use:

```text
✓ Observed

○ Unobserved

┄ Potential gap
```

and graph edge styles.

Also offer:

```text
Graph
Table
```

Table:

```text
Path                     Status

Product → Cart           Observed
Cart → Checkout          Observed
Checkout → Success       Observed
Checkout → Failure       Unobserved
Failure → Retry          Unobserved
```

---

# 70. Reduced motion

For:

```css
prefers-reduced-motion: reduce
```

render:

```text
final coverage state
static graph overlays
static comparison
static missing paths
```

rather than path-tracing animations.

Product videos should not autoplay under reduced motion.

---

# 71. SEO

### Recommended title

> **Behavioral Coverage — Measure Application Workflow Coverage | Tellann**

Alternative:

> **Application Workflow Coverage | Tellann**

### Meta description

> Measure demonstrated software behavior with Tellann across workflows, states, transitions, endpoints, errors, observed paths, and missing paths—and trace coverage back to supporting sessions.

---

# 72. Recommended heading structure

```text
H1
Know what your workflow covered—and what it didn't.

H2
Coverage becomes useful when it describes behavior.

H2
Code coverage asks what executed. Tellann asks what behavior you exercised.

H2
Coverage has more than one dimension.

H2
Did you exercise the workflow—or only its happy path?

H2
Which application states did the demonstration actually reach?

H2
A state matters. The path into and out of it matters too.

H2
See which backend behavior supported the demonstrated workflow.

H2
A workflow is not covered simply because success worked.

H2
Coverage is a map of evidence and absence.

H2
Explore coverage from score to evidence.

H2
The graph shows exactly where coverage exists.

H2
A workflow can exist without being fully exercised.

H2
Not every uncovered path deserves equal attention.

H2
Sometimes the missing piece is a state, not an entire workflow.

H2
Sometimes the missing piece is an entire branch.

H2
Every observed path should be backed by sessions.

H2
See what changed between demonstrations.

H2
Turn coverage into a QA artifact.

H2
The next useful demonstration is the one that fills a real gap.

H2
Coverage is evidence—not a guarantee.

H2
Turn one workflow into measurable behavioral coverage.
```

---

# 73. Analytics instrumentation

Track:

```text
coverage_hero_interacted

coverage_dimension_selected

coverage_workflow_selected

coverage_observed_path_selected

coverage_unobserved_path_selected

coverage_gap_selected

coverage_session_opened

coverage_replay_opened

coverage_comparison_started

coverage_session_a_selected

coverage_session_b_selected

coverage_report_previewed

coverage_demonstrate_gap_clicked

coverage_signup_clicked
```

Useful properties:

```json
{
  "workflow": "checkout",
  "dimension": "transition",
  "pathStatus": "unobserved",
  "sourceSection": "coverage_explorer"
}
```

---

# 74. Critical UX rule for the actual product

Every number should answer:

```text
72%

Coverage of what?

Based on which sessions?

Which paths were observed?

Which were not?

Why is this considered a gap?

What evidence supports it?
```

So clicking any coverage score should progressively expose:

```text
COVERAGE
   ↓
DIMENSION
   ↓
WORKFLOW
   ↓
PATH
   ↓
SESSION
   ↓
EVENT
```

That traceability is what can make Tellann coverage much more useful than another dashboard percentage.

---

# 75. Relationship with the next product capabilities

`/product/coverage` should also become the natural transition toward the deeper analysis features:

```text
COVERAGE
"What wasn't exercised?"

       ↓

MISSING STATES
"Which application conditions may be absent?"

       ↓

MISSING FLOWS
"Which complete paths may be absent?"

       ↓

QA REPORTS
"How do we communicate all of this?"
```

So at the bottom of specific findings you can place contextual links:

```text
Explore Missing States →
Explore Missing Flows →
View QA Reports →
```

If those later capabilities remain grouped rather than receiving separate routes, point them to the relevant future product-analysis page instead.

---

# 76. Final page narrative

The visitor should ultimately understand the page in this order:

```text
I demonstrated Checkout.

        ↓

Tellann reconstructed the workflow.

        ↓

It identified the states.

        ↓

It identified the transitions.

        ↓

It associated API and error behavior.

        ↓

It can now show which parts were observed.

        ↓

Checkout success was demonstrated.

        ↓

Payment failure wasn't.

Session timeout wasn't.

Recovery wasn't.

        ↓

So "72% coverage" is not merely a number.

        ↓

I can inspect exactly what contributed to it.

        ↓

I can open the sessions behind an observed path.

        ↓

I can choose an uncovered path
and demonstrate it next.

        ↓

The graph expands.

The evidence grows.

Coverage becomes more complete.
```

That should be the identity of `/product/coverage`: **not another percentage dashboard, but a visual, traceable explanation of which parts of the application's behavioral model have actually been exercised and which parts still deserve attention.** The requirements explicitly establish this Phase 1 loop through workflow coverage, observed and unobserved paths, incomplete workflows, critical gaps, reports, and session comparison.  
