# `/product/missing-states` — Complete Page Specification

`/product/missing-states` should be the **application-condition gap detection page** of Tellann.

Where `/product/missing-flows` asks:

> **Which meaningful paths were never exercised?**

`/product/missing-states` asks:

> **Which meaningful application conditions were never reached?**

A workflow can appear successful while still never exercising its loading, empty, error, failure, or recovery conditions. Tellann's Phase 1 requirements explicitly call for detecting missing application states, including error, empty, and loading states; the Developer Demonstration specification further defines recovery-state examples such as retry payment, retry upload, and retry submission.  

The central page message should therefore be:

> **The states you never see are often the states that expose how resilient your software really is.**

---

# 1. Position in the Tellann Product story

The growing Product section now has a strong progression:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does the system work?

        ↓

/product/demonstration-mode
How is behavior observed?

        ↓

/product/behavior-graphs
How is behavior structured?

        ↓

/product/workflow-discovery
Which structures form workflows?

        ↓

/product/session-replay
What evidence created the behavior?

        ↓

/product/coverage
Which parts were exercised?

        ↓

/product/missing-flows
Which paths were not exercised?

        ↓

/product/missing-states
Which application conditions were never observed?
```

The distinction between the last two pages is critical:

```text
MISSING FLOW

A behavioral sequence is absent.

CHECKOUT
    ↓
PAYMENT_FAILURE
    ↓
RETRY_PAYMENT


MISSING STATE

A meaningful application condition is absent.

PAYMENT_FAILURE
```

---

# 2. Primary objectives

By the end of `/product/missing-states`, visitors should understand:

```text
What constitutes an application state?

What makes a state "missing"?

How does Tellann infer a state worth checking?

What is a missing loading state?

What is a missing empty state?

What is a missing error state?

What is a missing recovery state?

How are missing states different from unobserved states?

How are they different from missing flows?

Why doesn't a missing state automatically mean there is a bug?

How does Tellann explain why a state was suggested?

How does the Behavior Graph expose missing states?

How do missing states affect coverage?

Can I demonstrate a missing state afterward?

Can a missing state become observed?

How are findings included in QA reports?
```

---

# 3. Recommended page architecture

```text
/product/missing-states
│
├── 01 Global Navigation
├── 02 Hero
├── 03 What Is a Missing State?
├── 04 Observed vs Missing
├── 05 How Detection Works
├── 06 State Taxonomy
├── 07 Missing Loading States
├── 08 Missing Empty States
├── 09 Missing Error States
├── 10 Missing Recovery States
├── 11 Rule-Based Phase 1 Detection
├── 12 Interactive Missing State Explorer
├── 13 Why Tellann Flagged This
├── 14 Missing States on the Behavior Graph
├── 15 Missing States + Coverage
├── 16 Missing State vs Missing Flow
├── 17 Session Evidence
├── 18 Endpoint Context
├── 19 Demonstrate the Missing State
├── 20 Multiple Demonstrations
├── 21 Prioritization & Review
├── 22 Missing State Report
├── 23 What a Missing State Does Not Mean
├── 24 Future State Intelligence
├── 25 FAQ
├── 26 Final CTA
└── 27 Footer
```

---

# 4. Hero

### Eyebrow

```text
MISSING STATE DETECTION
```

### H1

> **See the application states your demonstration never reached.**

Alternative:

> **Find the conditions hiding outside the happy path.**

Use the first for clarity.

### Supporting copy

> Tellann analyzes demonstrated behavior to surface meaningful loading, empty, error, and recovery states that were not observed—then shows where those states belong in your workflow and why they deserve attention.

The Developer Demonstration specification explicitly organizes missing-state detection around loading, empty, error, and recovery states. 

### CTAs

```text
[ Explore missing states ]
[ See how detection works → ]
```

Contextual link:

```text
Explore Missing Flows →
```

---

# 5. Hero visual concept

The hero should make the idea immediately understandable.

Start with a successful Search workflow:

```text
SEARCH
   ↓
SEARCH_RESULTS
```

Then expand it:

```text
                         SEARCH
                           │
                           ▼
                     SEARCH_LOADING
                           ┆
                           ▼
                     SEARCH_RESULTS
                      /         \
                     /           \
                    ▼             ▼

             RESULTS_FOUND     NO_RESULTS
                                   ┆
                                   ▼
                               RETRY_SEARCH
```

Initially only:

```text
SEARCH
↓
SEARCH_RESULTS
```

is solid.

The rest appears as potential missing states.

---

# 6. Hero visual dimensions

Prefer SVG/Canvas.

### Master

```text
1920 × 1120
```

### Desktop

```text
max-width: 1320px
height: 730–770px
```

### Placement

```text
Hero copy
   ↓ 48px
Full-width state graph
```

Do not use a split-screen hero.

### Mobile master

```text
1080 × 1350
4:5
```

Simplified mobile graph:

```text
SEARCH
   ↓
LOADING
   ↓
RESULTS
 ↙       ↘
FOUND   EMPTY
          ┆
        RETRY
```

---

# 7. Hero animation

Duration:

```text
8–10 seconds
```

Sequence:

```text
0–2 sec
Observed SEARCH → RESULTS path draws.

2–4 sec
Existing observed states become solid.

4–5 sec
LOADING appears as a dashed node.

5–6 sec
EMPTY RESULTS appears.

6–7 sec
ERROR appears.

7–8 sec
RETRY appears.

8–9 sec
Finding panel resolves:

4 potential states not observed
```

Afterward, stop animation and allow interaction.

No endlessly moving nodes.

---

# 8. What is a Missing State?

### H2

> **A missing state is a meaningful application condition Tellann expected or inferred but did not observe.**

A state represents a condition such as:

```text
CHECKOUT_LOADING

EMPTY_CART

NO_RESULTS

AUTHENTICATION_ERROR

PAYMENT_FAILURE

RETRY_PAYMENT
```

The formal Missing State requirements include application, error, empty, and loading states, with examples such as Loading State Missing, Empty Cart, 404, and Authentication Failure. 

---

# 9. Establish the vocabulary carefully

Use four statuses throughout the product:

```text
OBSERVED

Behavioral evidence exists for this state.


UNOBSERVED

The state exists in the selected model,
but no selected session reached it.


POTENTIAL MISSING STATE

Tellann inferred or expected a relevant state
that has not been observed.


FAILED STATE

The state was actually observed and represents
a failure condition.
```

Important:

```text
Unobserved ≠ failed.

Missing ≠ broken.

Suggested ≠ required.

Not demonstrated ≠ impossible.
```

This should be one of the strongest trust principles across Tellann.

---

# 10. Observed vs Missing

### H2

> **What worked tells you only one side of the application.**

Use a two-column layout:

```text
OBSERVED                     POTENTIAL STATES

SEARCH                       SEARCH
   ↓                            ┆
RESULTS                      LOADING
                                ┆
                                ▼
                              RESULTS

                             + EMPTY

                             + ERROR

                             + RECOVERY
```

Desktop:

```text
6 columns / 6 columns
```

Master visual:

```text
1600 × 850
```

Display:

```text
1000 × 531
```

---

# 11. How detection works

### H2

> **Missing states emerge from the behavioral model around what you observed.**

Show the analytical pipeline:

```text
DEMONSTRATION
       ↓
SESSION
       ↓
OBSERVED STATES
       ↓
TRANSITIONS
       ↓
WORKFLOW
       ↓
BEHAVIOR GRAPH
       ↓
COVERAGE ANALYSIS
       ↓
STATE RULES
       ↓
POTENTIAL MISSING STATES
```

The architecture assigns coverage calculation, missing-flow detection, missing-state detection, and coverage reporting to the Coverage Analysis Engine. 

---

# 12. Detection animation

Master:

```text
1800 × 1000
```

Displayed:

```text
1100 × 611
```

Duration:

```text
7–8 seconds
```

Sequence:

```text
Session reconstructed
      ↓
Observed states extracted
      ↓
Workflow created
      ↓
State pattern examined
      ↓
Potential complementary state appears
      ↓
Finding generated
```

---

# 13. Primary state taxonomy

The Phase 1 Developer Demonstration specification defines four particularly useful missing-state groups:

| Category | Question                                      | Example              |
| -------- | --------------------------------------------- | -------------------- |
| Loading  | What exists while work is in progress?        | Checkout Loading     |
| Empty    | What happens when useful content is absent?   | Empty Cart           |
| Error    | What happens when something fails?            | Authentication Error |
| Recovery | What state allows the user/system to recover? | Retry Payment        |

Examples in the specification include Product/Checkout/Search Loading; Empty Cart, No Search Results, No Notifications; 404, 500, Validation Error, Authentication Error; and Retry Payment, Retry Upload, Retry Submission. 

The QA reporting taxonomy additionally anticipates Security States. That should only appear as a customer-facing category once Tellann's implemented state-detection model explicitly supports it. 

---

# 14. Category-card design

Use four large cards:

```text
LOADING

EMPTY

ERROR

RECOVERY
```

Each card:

```text
560 × 320px
```

Layout:

```text
Desktop:
2 × 2
24px gap

Mobile:
1 column
```

Each card contains a miniature state graph rather than a generic icon.

---

# 15. Missing Loading States

### H2

> **What does the user see while the application is waiting?**

Examples:

```text
PRODUCT_LOADING
CHECKOUT_LOADING
SEARCH_LOADING
```

These examples are directly specified. 

Visual:

```text
SEARCH

   ↓

SEARCH_LOADING

   ↓

SEARCH_RESULTS
```

Observed demonstration:

```text
SEARCH
   ↓
SEARCH_RESULTS
```

Potential missing state:

```text
SEARCH_LOADING
```

---

# 16. Loading-state animation

Master:

```text
1500 × 850
```

Display:

```text
900 × 510
```

Animation:

```text
SEARCH
↓
API_REQUEST
↓
gap appears between request and results
↓
SEARCH_LOADING node materializes
↓
label:
Potential loading state
```

This communicates why the state exists structurally.

---

# 17. Missing Empty States

### H2

> **What happens when there is nothing to show?**

Examples from the source:

```text
EMPTY_CART
NO_SEARCH_RESULTS
NO_NOTIFICATIONS
```



Visual:

```text
SEARCH
   ↓
RESULTS

  ↙       ↘

RESULTS    NO_RESULTS
FOUND
```

If only `RESULTS_FOUND` was demonstrated:

```text
NO_RESULTS
```

can be surfaced as a potential complementary state.

---

# 18. Empty-state animation

Master:

```text
1500 × 850
```

Display:

```text
900 × 510
```

Animation:

```text
Populated results appear

↓

branch splits

↓

empty-state branch remains dashed

↓

NO_RESULTS
Not observed
```

---

# 19. Missing Error States

### H2

> **What happens when the expected action fails?**

Specified examples include:

```text
404
500
VALIDATION_ERROR
AUTHENTICATION_ERROR
```



Example graph:

```text
LOGIN
   │
   ▼
AUTHENTICATED

   ┆
   └────────────→ AUTHENTICATION_ERROR
```

---

# 20. Error-state visual

Master:

```text
1500 × 850
```

Display:

```text
900 × 510
```

Do not depict error states with aggressive alarm graphics.

Use semantic product styling:

```text
ERROR STATE
AUTHENTICATION_ERROR

Status
Not observed
```

---

# 21. Missing Recovery States

### H2

> **After failure, can the workflow recover?**

This category differentiates Tellann nicely.

Specified examples include:

```text
RETRY_PAYMENT
RETRY_UPLOAD
RETRY_SUBMISSION
```



Show:

```text
PAYMENT_FAILURE
       │
       ┆
       ▼
RETRY_PAYMENT
       │
       ┆
       ▼
PAYMENT_SUCCESS
```

---

# 22. Recovery animation

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
Failure state exists
↓
workflow ends
↓
dead-end highlights
↓
potential recovery node appears
↓
recovery transition connects back
```

This makes recovery feel like a state-design issue rather than merely an error list.

---

# 23. Rule-Based Detection in Phase 1

### H2

> **Phase 1 uses explainable rules—not opaque AI guesses.**

Tellann's MVP explicitly requires these capabilities to work without machine learning or artificial intelligence. 

The Developer Demonstration specification defines Phase 1 mappings such as:

```text
SUCCESS
   ↓
consider FAILURE

POPULATED
   ↓
consider EMPTY

VALID INPUT
   ↓
consider INVALID INPUT

FAST RESPONSE
   ↓
consider TIMEOUT
```



And concrete examples include `LOGIN_SUCCESS → LOGIN_FAILURE`, `PRODUCT_SEARCH → EMPTY_SEARCH_RESULT`, `CHECKOUT_SUCCESS → PAYMENT_FAILED`, and `FORM_SUBMITTED → INVALID_FORM_DATA`. 

---

# 24. Rule matrix visual

Build a 2×2 transformation:

```text
OBSERVED                 CHECK FOR

SUCCESS            →     FAILURE

POPULATED          →     EMPTY

VALID              →     INVALID

RESPONSE           →     TIMEOUT
```

Master:

```text
1600 × 900
```

Displayed:

```text
1000 × 562
```

Use animated arrows appearing one at a time.

Duration:

```text
5–6 seconds
```

---

# 25. Why this matters strategically

Do not market the system as:

> "AI knows every state your app forgot."

Phase 1's stronger claim is:

> **Tellann applies explainable behavioral rules to what was demonstrated and surfaces states worth checking.**

That means findings can be inspected, challenged, dismissed, or demonstrated.

---

# 26. Interactive Missing State Explorer

This should be the page's strongest product interaction.

### H2

> **Inspect missing states where they belong in the workflow.**

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ Missing States                        Workflow: Checkout   │
├──────────────────┬──────────────────────────────────────────┤
│ FINDINGS         │                                          │
│                  │                                          │
│ Checkout Loading │           BEHAVIOR GRAPH                 │
│ Payment Failure  │                                          │
│ Empty Cart       │                                          │
│ Retry Payment    │                                          │
│                  │                                          │
├──────────────────┴──────────────────────────────────────────┤
│ PAYMENT_FAILURE · Error State · Not observed               │
└─────────────────────────────────────────────────────────────┘
```

---

# 27. Explorer dimensions

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
960 × 760px
```

Mobile:

```text
Workflow selector
↓
Category filters
↓
Finding
↓
Graph
↓
Finding details
```

---

# 28. Explorer filters

Include:

```text
Workflow
[ Checkout ▾ ]

Category
[ All ]
[ Loading ]
[ Empty ]
[ Error ]
[ Recovery ]

Status
[ All ]
[ Not observed ]
[ Demonstrated ]
```

Potentially:

```text
Priority
[ All ]
[ High ]
[ Medium ]
[ Low ]
```

only if a defined prioritization model exists.

---

# 29. Missing-State inspector

Click:

```text
PAYMENT_FAILURE
```

and show:

```text
PAYMENT FAILURE

Category
Error State

Workflow
Checkout

Status
Not observed

Related observed state
PAYMENT_SUCCESS

Detection basis
SUCCESS → FAILURE

Supporting workflow
Checkout

[ Why was this flagged? ]

[ Demonstrate this state ]
```

---

# 30. Why Tellann flagged this

### H2

> **A finding should explain itself.**

Example:

```text
PAYMENT_FAILURE

WHY THIS APPEARS

1. Checkout workflow was discovered.
2. PAYMENT_SUCCESS was observed.
3. Success → Failure rule applies.
4. PAYMENT_FAILURE was not observed
   in the selected demonstrations.

RESULT

Potential missing error state.
```

This should become a reusable `DetectionReason` component shared with Missing Flows.

---

# 31. Do not invent AI confidence percentages

Avoid:

```text
Confidence
94%
```

unless there is an actual calibrated confidence model.

Phase 1 should show:

```text
Detection type
RULE-BASED

Rule
SUCCESS_TO_FAILURE
```

That is more useful.

---

# 32. Missing States on the Behavior Graph

### H2

> **A missing state becomes easier to understand when you can see its neighbors.**

Example:

```text
CART_ACTIVE
     ↓
CHECKOUT
  ↙       ↘
SUCCESS   PAYMENT_FAILURE
                ┆
                ▼
           RETRY_PAYMENT
```

Use the same graph renderer as `/product/behavior-graphs`.

Visual meaning:

```text
solid node     Observed

dashed node    Potential / unobserved

solid edge     Observed transition

dashed edge    Potential transition
```

---

# 33. Graph-overlay product video

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
Enable Missing States
↓
Potential nodes appear
↓
Select PAYMENT_FAILURE
↓
Inspector opens
↓
Why flagged expands
```

---

# 34. Missing States + Coverage

### H2

> **A state you never reached is part of the coverage story.**

Example:

```text
CHECKOUT

State coverage
81%

Observed
✓ CART_ACTIVE
✓ CHECKOUT
✓ PAYMENT_SUCCESS

Potential / Unobserved
○ CHECKOUT_LOADING
○ PAYMENT_FAILURE
○ RETRY_PAYMENT
```

State coverage is explicitly one of Tellann's five Phase 1 coverage categories. 

---

# 35. Coverage integration visual

Master:

```text
1600 × 900
```

Displayed:

```text
1000 × 562
```

Layout:

```text
Behavior Graph        Coverage Panel
7 columns             5 columns
```

Panel:

```text
CHECKOUT

State coverage
81%

Observed
9

Potential gaps
3
```

Use illustrative data.

---

# 36. Missing State vs Missing Flow

### H2

> **A state is a condition. A flow is a sequence.**

This should be extremely clear.

|                 | Missing State                      | Missing Flow                       |
| --------------- | ---------------------------------- | ---------------------------------- |
| Unit            | One meaningful condition           | Sequence of conditions/transitions |
| Example         | `PAYMENT_FAILURE`                  | Checkout → Payment Failure → Retry |
| Question        | “Was this condition ever reached?” | “Was this path ever exercised?”    |
| Graph form      | Usually a node                     | Multiple nodes + edges             |
| Related feature | State Coverage                     | Workflow/Path Coverage             |

Tellann's MVP explicitly separates Missing Flow Detection from Missing State Detection. 

---

# 37. Visual comparison

Master:

```text
1500 × 750
```

Display:

```text
960 × 480
```

Composition:

```text
MISSING STATE

[ PAYMENT_FAILURE ]


MISSING FLOW

CHECKOUT
   ┆
   ▼
PAYMENT_FAILURE
   ┆
   ▼
RETRY_PAYMENT
```

This section should cross-link:

```text
Explore Missing Flows →
```

---

# 38. Session Evidence

### H2

> **A missing state has no replay—but the surrounding behavior does.**

This distinction is important.

You cannot replay a state that wasn't observed.

Instead show:

```text
PAYMENT_FAILURE
Not observed

Related observed state
PAYMENT_SUCCESS

Supporting sessions

SES-3817
SES-3824
SES-3901
```

Then:

```text
[ View related replay ]
```

This lets the developer inspect what actually happened around the place where Tellann inferred the gap.

---

# 39. Evidence video

Master:

```text
1920 × 1200
```

Displayed:

```text
1000 × 625
```

Duration:

```text
8–10 seconds
```

Sequence:

```text
Missing State finding
↓
View surrounding evidence
↓
Select supporting session
↓
Replay opens
↓
Related observed state highlighted
```

---

# 40. Endpoint Context

### H2

> **Some missing states are closely tied to backend outcomes.**

Example:

```text
Observed

POST /payment
      ↓
200
      ↓
PAYMENT_SUCCESS


Potential state

POST /payment
      ┆
4xx / 5xx
      ┆
      ▼
PAYMENT_FAILURE
```

Backend capture includes requests, responses, latency, exceptions, endpoint metadata, and session correlation. 

---

# 41. Timeout example

Another useful visual:

```text
SEARCH

   ↓

API_REQUEST

   ├──────── RESPONSE ───────→ RESULTS
   │
   └ - - - TIMEOUT - - - - → SEARCH_ERROR
```

The Phase 1 rule specification explicitly includes `Fast Response → Timeout` as an edge-case generation pattern. 

---

# 42. Demonstrate the Missing State

This should be the page's key product loop.

### H2

> **Turn an unobserved state into behavioral evidence.**

Finding:

```text
EMPTY_CART

Category
Empty State

Status
Not observed

[ Demonstrate this state ]
```

Then move into Demonstration Mode:

```text
NEW DEMONSTRATION

Workflow
Cart

Target state
EMPTY_CART

Objective
Reach and demonstrate the empty-cart condition.

[ Start demonstration ]
```

---

# 43. Demonstrate-state product video

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
Select EMPTY_CART

↓

Demonstrate this state

↓

Demonstration Mode opens

↓

Developer clears cart

↓

EMPTY_CART captured

↓

Session processes

↓

Graph node becomes observed

↓

Coverage updates
```

This is one of the most valuable videos on the page.

---

# 44. Core product loop

Show explicitly:

```text
DEMONSTRATE
     ↓
DISCOVER STATES
     ↓
MEASURE COVERAGE
     ↓
IDENTIFY MISSING STATE
     ↓
DEMONSTRATE STATE
     ↓
REANALYZE
     ↓
EXPAND GRAPH
```

This mirrors the MVP's core principle: observe behavior, build sessions/workflows, measure coverage, identify missing states and flows, then generate QA evidence. 

---

# 45. Multiple Demonstrations

### H2

> **A missing state can become observed as the model grows.**

Example:

```text
DEMO 01

Search success

Potential:
NO_RESULTS
SEARCH_LOADING
SEARCH_ERROR


DEMO 02

No results

Potential:
SEARCH_LOADING
SEARCH_ERROR


DEMO 03

API timeout

Potential:
SEARCH_LOADING
```

Then:

```text
STATE COVERAGE EXPANDS
```

Do not treat findings as permanent.

---

# 46. Recommended finding lifecycle

I would introduce:

```text
NOT_OBSERVED

DEMONSTRATED

NOT_APPLICABLE

DISMISSED
```

`NOT_APPLICABLE` and `DISMISSED` are product-design extensions rather than states explicitly specified in the source documents.

They are important because an explainable rule engine needs a way for teams to reject irrelevant suggestions.

Example:

```text
NO_NOTIFICATIONS

[ Demonstrate ]
[ Not applicable ]
```

---

# 47. Prioritization & Review

### H2

> **Focus on the missing states that matter to important workflows.**

Recommended card:

```text
PAYMENT_FAILURE

Error State

Workflow
Checkout

Priority
High

Status
Not observed

Reason
Success → Failure rule
```

Priority should come from something defensible, such as:

```text
configured workflow importance
state category
configured business criticality
```

Do not automatically invent business-impact scores.

---

# 48. Finding review actions

A practical product view should eventually allow:

```text
Demonstrate
Mark expected
Not applicable
Dismiss
```

These are important for maintaining a useful model.

If a user selects `Not applicable`, optionally ask:

```text
Why?

○ Application does not support this condition
○ Handled externally
○ Duplicate state
○ Other
```

That feedback could later improve detection quality.

---

# 49. Missing State Report

### H2

> **Turn missing application conditions into a QA artifact.**

The QA Report Specification includes a dedicated Missing State Report with examples including `LOADING_STATE`, `EMPTY_CART`, `NO_RESULTS`, `404_PAGE`, `AUTHENTICATION_ERROR`, and `PAYMENT_FAILURE`. 

The MVP explicitly lists Missing State Report as one of its Phase 1 reports. 

---

# 50. Report visual

Example:

```text
MISSING STATE REPORT

Application
Storefront Demo

Detected States
6


LOADING

CHECKOUT_LOADING
Not observed


EMPTY

EMPTY_CART
Not observed

NO_RESULTS
Not observed


ERROR

PAYMENT_FAILURE
Not observed

AUTHENTICATION_ERROR
Not observed


RECOVERY

RETRY_PAYMENT
Not observed
```

### Master

```text
1000 × 1280
```

### Desktop display

```text
600 × 768
```

Layout:

```text
Copy                    Report preview
5 columns               7 columns
```

---

# 51. Report export

Show compact controls:

```text
PDF    CSV    JSON    HTML
```

These are the documented Phase 1 report export formats. 

---

# 52. What a Missing State does not mean

### H2

> **A missing state is a QA question—not automatically a bug.**

State clearly:

```text
A missing state does not necessarily mean:

the application is broken

the state is required by the specification

the state can actually occur

the developer forgot to implement something

a test has failed

Tellann has proven a defect exists
```

Instead:

> Tellann has identified a state worth considering that was not observed in the selected behavioral evidence.

---

# 53. Good vs bad product wording

Bad:

```text
BUG DETECTED
Empty Cart Missing
```

Better:

```text
POTENTIAL MISSING STATE
Empty Cart was not observed.
```

Bad:

```text
ERROR
Loading State Missing
```

Better:

```text
NOT OBSERVED
Checkout Loading may require validation.
```

Bad:

```text
Tellann knows you forgot this state.
```

Better:

```text
Tellann surfaced this state because
the Populated → Empty rule applies.
```

---

# 54. Do not blur detection and implementation

There are at least three different situations:

```text
1. STATE EXISTS
but was never demonstrated.

2. STATE SHOULD EXIST
but may not be implemented.

3. STATE IS NOT APPLICABLE
to this application.
```

Tellann should not present these as identical.

A future product detail panel could expose:

```text
State disposition

Unknown
Observed
Expected
Not applicable
```

That will improve trust substantially.

---

# 55. Future State Intelligence

Keep this short and clearly phased.

### Phase 1 — Behavioral QA

```text
Loading-state detection
Empty-state detection
Error-state detection
Recovery-state detection
Rule-based edge-case generation
Coverage integration
Missing State reports
```

Phase 1 must work without production traffic, machine learning, AI, or manual workflow modeling. 

### Phase 2 — Planned

Potential evolution:

```text
Production-observed rare states
Real failure-state frequencies
Journey interruption states
Workflow-health context
```

Production monitoring and real-user behavior are explicitly Phase 2 rather than Phase 1. 

### Phase 3 — Planned

```text
Automated validation of missing states
Generated edge-case tests
Failure simulation
Regression analysis
Behavioral anomaly detection
Autonomous quality reasoning
```

Those autonomous capabilities are explicitly excluded from the MVP. 

---

# 56. FAQ

Recommended questions:

```text
What is a missing state?

How does Tellann identify missing states?

What is the difference between an unobserved state and a missing state?

What types of states can Tellann detect?

What is a loading state?

What is an empty state?

What is an error state?

What is a recovery state?

Does a missing state mean my application has a bug?

How is a missing state different from a missing flow?

Does Tellann use AI to identify missing states?

Can I see why a state was suggested?

Can I dismiss a state that does not apply?

Can I demonstrate a missing state later?

Will demonstrating a missing state change coverage?

Can I inspect sessions related to a missing state?

Can missing states involve backend/API behavior?

Does Tellann automatically create tests for missing states?
```

---

# 57. Final CTA

### Eyebrow

```text
LOOK BEYOND THE STATES YOU SAW
```

### H2

> **Find the application condition you haven't demonstrated yet.**

Supporting copy:

> Demonstrate a workflow and let Tellann surface loading, empty, error, and recovery states that remain unobserved—then turn those gaps into the next QA walkthrough.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Contextual:

```text
Explore Missing Flows →
```

---

# 58. Complete media inventory

| Asset                    | Type                    |          Master | Recommended display |
| ------------------------ | ----------------------- | --------------: | ------------------: |
| Hero Missing-State Graph | SVG/Canvas              |       1920×1120 |            1320×760 |
| Mobile Hero Graph        | SVG                     |       1080×1350 |          Responsive |
| Observed vs Missing      | SVG                     |        1600×850 |            1000×531 |
| Detection Pipeline       | Animated SVG            |       1800×1000 |            1100×611 |
| State Category Cards     | SVG/HTML                | ~1120×664 total |            2×2 grid |
| Loading State            | Animated SVG            |        1500×850 |             900×510 |
| Empty State              | Animated SVG            |        1500×850 |             900×510 |
| Error State              | SVG/UI                  |        1500×850 |             900×510 |
| Recovery State           | Animated SVG            |        1600×900 |            1000×562 |
| Rule Matrix              | Animated SVG            |        1600×900 |            1000×562 |
| Missing State Explorer   | Interactive HTML/Canvas |               — |            1280×800 |
| Why Flagged              | Product UI              |        1200×800 |             720×480 |
| Graph Overlay            | Product video           |       1920×1200 |            1000×625 |
| Coverage Integration     | SVG/UI                  |        1600×900 |            1000×562 |
| Missing State vs Flow    | SVG                     |        1500×750 |             960×480 |
| Session Evidence         | Product video           |       1920×1200 |            1000×625 |
| Endpoint Context         | Animated SVG            |        1600×900 |             900×506 |
| Demonstrate State Loop   | Product video           |       1920×1200 |            1100×688 |
| Multi-demo Evolution     | Animated SVG            |        1600×900 |            1000×562 |
| Missing State Report     | Report UI               |       1000×1280 |             600×768 |

That is roughly **20 visual surfaces**, but they should resolve into perhaps **5–7 underlying reusable visualization components**, not twenty separately maintained designs.

---

# 59. Reusable component architecture

Reuse the graph system already built for Behavior Graphs, Coverage, and Missing Flows:

```tsx
<MissingStateGraph
  workflow={workflow}
  findings={findings}
  mode="interactive"
/>
```

Suggested modes:

```ts
type MissingStateMode =
  | "hero"
  | "loading"
  | "empty"
  | "error"
  | "recovery"
  | "coverage"
  | "evidence"
  | "explorer";
```

Supporting components:

```tsx
<MissingStateList />
<MissingStateInspector />
<StateCategoryBadge />
<DetectionReason />
<SupportingEvidence />
<DemonstrateStateCTA />
<MissingStateReportPreview />
```

Most importantly:

```text
BehaviorGraph
      +
State Analysis Overlay
      =
MissingStateGraph
```

Do not create a completely new graph language for this page.

---

# 60. Suggested frontend finding model

Conceptually:

```ts
interface MissingStateFinding {
  id: string;

  applicationId: string;
  workflowId?: string;

  stateName: string;

  category:
    | "LOADING"
    | "EMPTY"
    | "ERROR"
    | "RECOVERY";

  status:
    | "NOT_OBSERVED"
    | "DEMONSTRATED"
    | "NOT_APPLICABLE"
    | "DISMISSED";

  relatedObservedState?: string;

  detectionBasis: {
    type: "RULE";
    rule: string;
  };

  supportingSessionIds?: string[];

  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
}
```

The current API specification already reserves retrieval for missing states generally and by loading, error, and empty categories. 

If recovery states are intended to have a dedicated endpoint, add that explicitly to the API specification rather than silently inventing it only in the frontend.

---

# 61. Recommended API consistency fix

There is one specification alignment issue worth resolving during implementation.

The product/MVP documentation defines:

```text
Loading
Empty
Error
Recovery
```

missing-state categories. 

But the current API snippet exposes:

```text
GET /missing-states
GET /missing-states/loading
GET /missing-states/error
GET /missing-states/empty
```

with no corresponding recovery-specific endpoint shown. 

I would either add:

```http
GET /missing-states/recovery
```

or use one canonical filtered endpoint:

```http
GET /missing-states?category=RECOVERY
```

and apply that same pattern to every category.

The latter is cleaner long-term.

---

# 62. Animation language

The visual vocabulary for Missing States should be:

```text
absence
contrast
branching
insertion
completion
verification
```

Good:

```text
node appears between two observed states

empty alternative appears beside populated state

error branch emerges beside success

recovery state connects failure back to workflow

demonstration turns dashed node solid
```

Avoid:

```text
flashing red warnings
AI particle effects
warning sirens
constantly moving graph nodes
dramatic "bug found" animations
```

---

# 63. Sticky educational section

One particularly strong mid-page treatment:

```text
LEFT — STICKY GRAPH
RIGHT — SCROLLING EXPLANATION
```

Desktop:

```text
┌──────────────────────────┬─────────────────────┐
│                          │  Loading            │
│                          │                     │
│      SEARCH WORKFLOW     │  Empty              │
│                          │                     │
│        sticky graph      │  Error              │
│                          │                     │
│                          │  Recovery           │
└──────────────────────────┴─────────────────────┘
```

Ratio:

```text
7 columns / 5 columns
```

As sections scroll:

```text
Loading node appears
↓
Empty branch appears
↓
Error branch appears
↓
Recovery branch appears
```

This can replace four separate oversized sections if page length becomes excessive.

---

# 64. Responsive behavior

### ≥1280px

Full graph + inspector.

### 1024–1279px

Keep graph interactive, reduce side panel.

### 768–1023px

Move inspector below graph.

### <768px

Use:

```text
Workflow
[ Checkout ▾ ]

Potential States
4

[ Loading ]
[ Empty ]
[ Error ]
[ Recovery ]

Finding card

Mini graph

Why this was flagged

Actions
```

Do not compress the full application Behavior Graph onto mobile.

---

# 65. Mobile state card

Example:

```text
PAYMENT FAILURE

ERROR STATE

Not observed

Workflow
Checkout

Detection
Success → Failure

[ Why? ]

[ Demonstrate ]
```

This should be the primary mobile interaction rather than a dense graph.

---

# 66. Accessibility

Every state graph needs:

```text
Graph
List
```

List mode:

```text
CHECKOUT

Observed

CART_ACTIVE
CHECKOUT
PAYMENT_SUCCESS


Potential states

CHECKOUT_LOADING
Loading

PAYMENT_FAILURE
Error

RETRY_PAYMENT
Recovery
```

Also ensure:

```text
Observed
Potential
Error
Recovery
```

are indicated by labels and shape/pattern—not only color.

---

# 67. Reduced motion

Under:

```css
@media (prefers-reduced-motion: reduce)
```

disable:

```text
node emergence
path drawing
state insertion
animated coverage transitions
automatic product-video playback
```

Show completed state maps immediately.

Videos use their poster frame until explicitly started.

---

# 68. SEO

### Recommended title

> **Missing State Detection — Find Unobserved Application States | Tellann**

Alternative:

> **Find Missing Loading, Empty & Error States | Tellann**

### Meta description

> See how Tellann identifies potential loading, empty, error, and recovery states that were not observed during application demonstrations, explains why they were surfaced, and connects them to workflows and behavioral coverage.

---

# 69. Analytics instrumentation

Track events such as:

```text
missing_state_hero_interacted

missing_state_category_selected

missing_state_workflow_selected

missing_state_finding_selected

missing_state_reason_expanded

missing_state_graph_opened

missing_state_related_session_opened

missing_state_replay_opened

missing_state_coverage_opened

missing_state_demonstrate_clicked

missing_state_mark_not_applicable

missing_state_dismissed

missing_state_report_previewed

missing_state_signup_clicked
```

Useful payload:

```json
{
  "workflow": "checkout",
  "category": "error",
  "state": "payment_failure",
  "detectionBasis": "SUCCESS_TO_FAILURE",
  "sourceSection": "missing_state_explorer"
}
```

---

# 70. Most important UX requirement

Every Missing State finding should answer exactly five things:

```text
WHAT?

PAYMENT_FAILURE


WHAT KIND?

Error State


WHERE?

Checkout Workflow


WHY?

PAYMENT_SUCCESS was observed and
the Success → Failure rule applies.


WHAT NEXT?

Demonstrate the Payment Failure state.
```

That explanation is particularly important because Tellann Phase 1 is intentionally based on explainable rule-driven analysis rather than opaque AI. 

---

# 71. How this connects all existing Product pages

The strongest Tellann loop now becomes:

```text
DEMONSTRATION MODE

"I showed Tellann Checkout."

        ↓

WORKFLOW DISCOVERY

"Tellann reconstructed Checkout."

        ↓

BEHAVIOR GRAPH

"It mapped the states and transitions."

        ↓

COVERAGE

"It showed which parts I exercised."

        ↓

MISSING STATES

"Checkout Loading and Payment Failure
were never observed."

        ↓

MISSING FLOWS

"The Payment Failure → Retry path
was also never observed."

        ↓

SESSION REPLAY

"I can inspect the evidence from
the behavior that was observed."

        ↓

DEMONSTRATION MODE

"I demonstrate the missing condition."

        ↓

BEHAVIOR GRAPH

"The new state joins the model."

        ↓

COVERAGE

"The behavioral evidence expands."
```

This circular relationship is far more compelling than presenting Tellann as a collection of disconnected analytics features.

---

# 72. Final visitor experience

The visitor should reach the bottom of `/product/missing-states` thinking:

```text
I demonstrated Search.

        ↓

Tellann saw:

Search
→ Search Results

        ↓

But successful results are
not the entire application state space.

        ↓

What happens while results load?

        ↓

What happens when there are no results?

        ↓

What happens when the request fails?

        ↓

What lets the user recover?

        ↓

Tellann surfaces:

SEARCH_LOADING
NO_RESULTS
SEARCH_ERROR
RETRY_SEARCH

        ↓

It tells me why each state was suggested.

        ↓

It does not pretend each suggestion is a bug.

        ↓

I can mark irrelevant states
as not applicable.

        ↓

Or I can demonstrate one.

        ↓

The state becomes observed.

        ↓

The Behavior Graph expands.

        ↓

Coverage becomes more complete.

        ↓

Tellann has turned an unseen application
condition into something my QA process
can reason about.
```

That should define `/product/missing-states`: **not a page claiming Tellann knows every state an application ought to contain, but a transparent system for turning observed successful behavior into explainable questions about loading, empty, error, and recovery conditions that have not yet been exercised.** That positioning stays fully aligned with the Phase 1 requirements while preserving the credibility needed for the more intelligent capabilities planned later.  
