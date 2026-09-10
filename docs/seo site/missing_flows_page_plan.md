# `/product/missing-flows` — Complete Page Specification

`/product/missing-flows` should be the page where Tellann explains a very important QA idea:

> **The behavior you observed is only part of the story. The paths you never exercised may matter just as much.**

The product documentation defines Missing Flow Detection as identifying **likely workflow paths that were not demonstrated**, with Phase 1 focused on failure, alternative, recovery, and edge-case paths.  

This page therefore should not simply show a list saying:

```text
Payment Failure
Password Reset
Session Timeout
```

It should visually explain:

```text
What was observed
       ↓
What Tellann expected or inferred could exist
       ↓
Which path was absent
       ↓
Why Tellann surfaced it
       ↓
What evidence supports that finding
       ↓
How the developer can demonstrate it next
```

---

# 1. Position in the Product story

The Product section now progresses as:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does Tellann work?

        ↓

/product/demonstration-mode
How is behavior captured?

        ↓

/product/behavior-graphs
How is behavior structured?

        ↓

/product/workflow-discovery
How are workflows discovered?

        ↓

/product/session-replay
What evidence created those workflows?

        ↓

/product/coverage
Which parts were exercised?

        ↓

/product/missing-flows
Which meaningful paths were not?
```

The distinction between `/coverage` and `/missing-flows` needs to remain clear:

```text
COVERAGE

"We observed 72% of this modeled workflow."


MISSING FLOWS

"Here are the specific paths that may account
for important parts of what wasn't observed."
```

---

# 2. Primary page objective

The visitor needs to understand:

```text
What is a missing flow?

How is it different from a missing state?

How does Tellann identify one?

Why isn't an unobserved path automatically a bug?

What is a failure path?

What is an alternative path?

What is a recovery path?

What is an edge-case path?

How does the system use demonstrated behavior?

How does rule-based Phase 1 inference work?

Can I inspect why Tellann suggested a flow?

Can I demonstrate the missing path afterward?

How does doing that affect coverage?

Can I trace a finding back to the Behavior Graph?

Can missing flows appear in reports?
```

---

# 3. Core positioning

Recommended central statement:

> **Successful behavior tells Tellann what worked. Missing Flow Detection asks what other meaningful paths deserve to be exercised.**

A second supporting statement:

> Tellann analyzes demonstrated workflows and surfaces likely failure, alternative, recovery, and edge-case paths that were not observed.

That wording matches the MVP much better than:

> "Tellann automatically finds every missing test."

The latter would overstate what Phase 1 actually does.

---

# 4. Recommended page architecture

```text
/product/missing-flows
│
├── 01 Global Navigation
├── 02 Hero
├── 03 What Is a Missing Flow?
├── 04 Observed vs Missing
├── 05 How Missing Flow Detection Works
├── 06 Failure Flows
├── 07 Alternative Flows
├── 08 Recovery Flows
├── 09 Edge-Case Flows
├── 10 Rule-Based Detection in Phase 1
├── 11 Interactive Missing Flow Explorer
├── 12 Why Tellann Flagged This
├── 13 Missing Flows on the Behavior Graph
├── 14 Missing Flows + Coverage
├── 15 Missing Flow vs Missing State
├── 16 Missing Flow + Session Evidence
├── 17 Missing Flow + Endpoint Context
├── 18 Demonstrate the Missing Path
├── 19 Multiple Demonstrations
├── 20 Prioritization & Severity
├── 21 Missing Flow Report
├── 22 What a Missing Flow Does Not Mean
├── 23 Future Missing-Flow Intelligence
├── 24 FAQ
├── 25 Final CTA
└── 26 Footer
```

---

# 5. Hero

### Eyebrow

```text
MISSING FLOW DETECTION
```

### H1

> **See the paths your demonstration never reached.**

Alternative:

> **Find the important paths hiding beyond the happy path.**

I would use the first as the H1 and the second idea elsewhere as supporting copy.

### Supporting copy

> Tellann analyzes demonstrated workflows to identify likely failure, alternative, recovery, and edge-case paths that were not observed—then connects those gaps back to the workflow, coverage model, and supporting evidence.

The MVP explicitly defines those four missing-flow categories and examples including Payment Failure, Retry Payment, Login Failure, Password Reset, and Session Expiration. 

### CTAs

```text
[ Explore missing flows ]
[ See how detection works → ]
```

Optional contextual link:

```text
View Coverage →
```

---

# 6. Hero visual

The hero should show **one successful workflow growing into a wider possibility space**.

Initial:

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
   ↓
PAYMENT_SUCCESS
```

Then reveal:

```text
                       CHECKOUT
                    /      |       \
                   /       |        \
                  ▼        ▼         ▼

          PAYMENT_SUCCESS  PAYMENT_FAILURE
                               ┆
                               ┆
                               ▼
                         RETRY_PAYMENT

                             +
                       SESSION_TIMEOUT

                             +
                        OUT_OF_STOCK
```

Legend:

```text
━━ Observed
┄┄ Potential flow not observed
```

The Flow Coverage Report itself uses missing Checkout paths such as `PAYMENT_FAILURE`, `OUT_OF_STOCK`, `INVENTORY_CHANGED`, `SESSION_TIMEOUT`, and `GATEWAY_FAILURE`. 

---

# 7. Hero media dimensions

Use animated SVG or Canvas rather than an exported video.

### Master design

```text
1920 × 1120
```

### Desktop display

```text
max-width: 1320px
height: 730–770px
```

### Tablet

```text
960 × ~650px
```

### Mobile

Use only:

```text
CHECKOUT
  ↙       ↘
SUCCESS   FAILURE
             ┆
             ▼
           RETRY
```

Master mobile composition:

```text
1080 × 1350
4:5
```

---

# 8. Hero animation

Duration:

```text
8–10 seconds
```

Sequence:

```text
0–2s
Observed success workflow draws.

2–4s
Success path becomes solid.

4–6s
Potential failure path appears dashed.

6–7s
Retry recovery branch appears.

7–8s
Session timeout appears.

8–9s
Finding panel resolves:

3 potential flows not observed
```

After animation completes, let users click each dashed path.

No continuous graph movement.

---

# 9. Section — What is a Missing Flow?

### H2

> **A missing flow is a meaningful path Tellann expected or inferred but did not observe.**

The Developer Demonstration specification defines the purpose directly as identifying **likely workflow paths that were not demonstrated**. 

Use a simple contrast:

```text
OBSERVED

Login
  ↓
Dashboard


NOT OBSERVED

Login
 ├── Login Failure
 ├── Password Reset
 ├── Account Locked
 └── Session Expired
```

That same login example appears in the specification. 

---

# 10. Critical terminology

Use these words consistently:

```text
OBSERVED FLOW
A path supported by captured behavioral evidence.

UNOBSERVED FLOW
A modeled path for which the selected dataset
contains no observed evidence.

POTENTIAL MISSING FLOW
An unobserved path surfaced by Tellann's
detection rules or behavioral model.

FAILED FLOW
A path that was actually observed and ended
in failure.
```

Do not merge those concepts.

In particular:

```text
Not observed ≠ failed.
Missing ≠ broken.
Suggested ≠ confirmed requirement.
```

That should become a product-wide Tellann UX principle.

---

# 11. Observed vs Missing section

### H2

> **Start with what Tellann knows. Then expose what it hasn't seen.**

Use side-by-side visual.

```text
OBSERVED                     POTENTIAL GAP

CHECKOUT                     CHECKOUT
   ↓                            ↓
PAYMENT_SUCCESS              PAYMENT_FAILURE
                                ↓
                             RETRY_PAYMENT
```

Desktop:

```text
6 columns / 6 columns
```

Master:

```text
1600 × 850
```

Displayed:

```text
1000 × 531
```

---

# 12. Section — How Missing Flow Detection works

### H2

> **Missing paths are derived from behavioral structure—not guessed in isolation.**

Conceptually show:

```text
DEMONSTRATION

       ↓

SESSION

       ↓

WORKFLOW

       ↓

BEHAVIOR GRAPH

       ↓

COVERAGE ANALYSIS

       ↓

UNOBSERVED PATHS

       ↓

MISSING FLOW RULES

       ↓

POTENTIAL FLOWS
```

The architecture places missing-flow detection inside the Coverage Analysis Engine alongside coverage calculation, missing-state detection, and coverage reporting. 

---

# 13. Detection pipeline animation

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
Observed session appears

↓

Workflow extracted

↓

Observed path becomes solid

↓

Rules inspect path structure

↓

Potential complementary path appears

↓

Finding generated
```

Duration:

```text
7–8 seconds
```

---

# 14. Section — Four categories of missing flows

### H2

> **Not every missing path represents the same kind of behavior.**

Phase 1 includes four primary categories: **failure, alternative, recovery, and edge-case paths**. 

Use four large cards:

| Category    | Core question                                     | Example            |
| ----------- | ------------------------------------------------- | ------------------ |
| Failure     | What happens when the intended action fails?      | Payment Failure    |
| Alternative | Is there another valid way through the workflow?  | Guest Checkout     |
| Recovery    | How does the user/system recover after failure?   | Retry Payment      |
| Edge Case   | What happens under an unusual boundary condition? | Session Expiration |

Each card gets a miniature graph rather than an icon.

---

# 15. Card dimensions

Desktop:

```text
2 × 2

Card:
560 × 330px

Gap:
24px
```

Large desktop could use 4 columns if enough horizontal room, but 2×2 gives each concept more room to breathe.

Mobile:

```text
1 column
```

---

# 16. Failure Flows

### H2

> **What happens when success does not happen?**

Example:

```text
Observed

CHECKOUT
   ↓
PAYMENT_SUCCESS


Potential failure path

CHECKOUT
   ┆
   ▼
PAYMENT_FAILURE
```

Phase 1 rule-based generation explicitly maps observed `CHECKOUT_SUCCESS` to a potential `PAYMENT_FAILED` case. 

Other documented failure examples include:

```text
Authentication Failure
Payment Failure
API Failure
```

---

# 17. Failure-flow visual

Master:

```text
1500 × 850
```

Display:

```text
900 × 510
```

Animate:

```text
Success path
↓
mirror branch appears
↓
failure state appears
↓
"Not demonstrated" label resolves
```

---

# 18. Alternative Flows

### H2

> **Could the same objective be reached another way?**

The Developer Demonstration documentation gives alternative-flow examples including:

```text
Guest Checkout
Social Login
Trial Signup
```

These should be treated as domain examples rather than universal assumptions.

Visual:

```text
CHECKOUT

        ├── Account checkout
        ┆
        └── Guest checkout
```

The second branch remains:

```text
Not observed
```

---

# 19. Important alternative-path rule

Tellann should not blindly assume every application supports:

```text
Guest Checkout
Social Login
Trial Signup
```

The UI must therefore explain *why* an alternative was suggested.

Example:

```text
GUEST CHECKOUT

Reason
Alternative checkout pattern configured for this workflow.

Evidence
Checkout workflow exists.

Status
Not observed.
```

If the product has no basis for an alternative path, it should not invent one merely because another e-commerce app might have it.

---

# 20. Recovery Flows

### H2

> **Failure is only half the story. What happens next?**

Documented recovery examples include:

```text
Retry Payment
Retry Login
Reconnect Session
```

Use:

```text
PAYMENT_FAILURE
      ┆
      ▼
RETRY_PAYMENT
      ┆
      ▼
CHECKOUT
```

A recovery flow is especially valuable because many QA walkthroughs validate failure but forget successful recovery.

---

# 21. Recovery visual dimensions

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
Checkout failure appears
↓
flow ends
↓
Tellann highlights dead-end
↓
Retry path appears dashed
↓
returns to Checkout
```

---

# 22. Edge-Case Flows

### H2

> **Some important behavior only appears at the edges.**

The Phase 1 specification uses rule-based edge-case generation. It defines examples such as:

```text
LOGIN_SUCCESS
       ↓
LOGIN_FAILURE

PRODUCT_SEARCH
       ↓
EMPTY_SEARCH_RESULT

CHECKOUT_SUCCESS
       ↓
PAYMENT_FAILED

FORM_SUBMITTED
       ↓
INVALID_FORM_DATA
```



It also defines the general Phase 1 generation patterns:

```text
Success Path → Failure Path

Populated State → Empty State

Valid Input → Invalid Input

Fast Response → Timeout
```



---

# 23. Edge-case matrix visual

Use an elegant 2×2 transformation:

```text
SUCCESS                FAILURE

PAYMENT_SUCCESS    →   PAYMENT_FAILED


POPULATED              EMPTY

SEARCH_RESULTS     →   EMPTY_RESULTS


VALID                  INVALID

FORM_SUBMITTED     →   INVALID_FORM_DATA


RESPONSIVE             TIMEOUT

API_RESPONSE       →   API_TIMEOUT
```

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

This is one of the most important explanatory visuals on the page because it shows exactly how Phase 1 can work **without AI**.

---

# 24. Section — Rule-Based Detection in Phase 1

### H2

> **Phase 1 begins with explainable rules.**

This should be stated clearly.

The MVP explicitly requires missing-flow detection to work without machine learning or artificial intelligence. 

Tellann's Phase 1 rule engine can conceptually evaluate:

```text
Observed success
→ consider corresponding failure

Observed populated state
→ consider empty state

Observed valid input
→ consider invalid input

Observed fast response
→ consider timeout

Observed failure
→ consider recovery path
```

The first four mappings are directly defined in the Developer Demonstration specification. 

---

# 25. Why this section matters

Do not hide this behind language like:

> "Our intelligence engine knows what you forgot."

The stronger Phase 1 story is:

> **Tellann uses explicit behavioral rules to surface plausible gaps and can explain why each one was suggested.**

That is more technically credible.

---

# 26. Interactive Missing Flow Explorer

This should be the primary interactive feature of the page.

### H2

> **Inspect every missing path in context.**

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Missing Flows                    Workflow: Checkout     │
├───────────────────┬──────────────────────────────────────┤
│                   │                                      │
│ FINDINGS          │          WORKFLOW GRAPH              │
│                   │                                      │
│ Payment Failure   │                                      │
│ Retry Payment     │                                      │
│ Session Timeout   │                                      │
│ Out of Stock      │                                      │
│                   │                                      │
├───────────────────┴──────────────────────────────────────┤
│ PAYMENT_FAILURE · Failure Flow · Not observed           │
└──────────────────────────────────────────────────────────┘
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
Missing-flow list
↓
Graph
↓
Finding inspector
```

---

# 28. Explorer filters

Use:

```text
Workflow
[ Checkout ▾ ]

Category
[ All ]
[ Failure ]
[ Alternative ]
[ Recovery ]
[ Edge Case ]

Status
[ All ]
[ Not observed ]
[ Demonstrated ]
```

If prioritization is implemented:

```text
Priority
[ All ]
[ Critical ]
[ High ]
[ Medium ]
[ Low ]
```

---

# 29. Finding inspector

Selecting:

```text
PAYMENT_FAILURE
```

shows:

```text
PAYMENT FAILURE

Category
Failure Flow

Workflow
Checkout

Status
Not observed

Observed parent
CHECKOUT

Detected from
Success → Failure rule

Supporting behavior
PAYMENT_SUCCESS observed

Coverage impact
Included in uncovered path analysis

[ View graph ]
[ Demonstrate this path ]
```

This is much stronger than simply saying:

```text
Missing: Payment Failure
```

---

# 30. Section — Why Tellann flagged this

### H2

> **Every suggestion should come with a reason.**

Explainability should become a core UX principle for Missing Flows.

Example:

```text
PAYMENT_FAILURE

Why this appears

1. Checkout workflow was discovered.
2. Payment Success was observed.
3. Failure counterpart rule applies.
4. No Payment Failure path exists in the selected observations.

Result

Potential missing failure flow.
```

This is especially important because rule-based inference can produce false or irrelevant suggestions.

---

# 31. Finding confidence

Do not invent probabilistic:

```text
Confidence: 94%
```

unless Tellann has an actual confidence model.

For Phase 1, use:

```text
Detection basis
RULE-BASED

Rule
SUCCESS_TO_FAILURE
```

This is more honest and more useful.

---

# 32. Section — Missing Flows on the Behavior Graph

### H2

> **See the missing branch where it belongs.**

Use the actual Behavior Graph and overlay findings.

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
  ↙      ↘
SUCCESS  PAYMENT_FAILURE
            ┆
            ▼
          RETRY
```

Observed:

```text
solid
```

Potential gap:

```text
dashed
```

Do not build a separate visual language from `/product/behavior-graphs`.

---

# 33. Graph overlay video

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

Enable "Missing Flows"

↓

Potential branches appear

↓

Select PAYMENT_FAILURE

↓

Inspector opens

↓

"Why flagged" expands
```

---

# 34. Section — Missing Flows + Coverage

### H2

> **Missing flows explain where coverage is incomplete.**

Connect the two product concepts:

```text
CHECKOUT

Coverage
72%

Observed paths
18

Unobserved paths
7

        ↓

Potential Missing Flows

Payment Failure
Retry Payment
Session Timeout
```

Coverage outputs explicitly include missing paths and critical gaps, while Missing Flow Detection classifies the kinds of unobserved behavior worth attention. 

---

# 35. Coverage interaction

Selecting:

```text
Missing paths: 7
```

opens:

```text
Failure        3
Recovery       2
Alternative    1
Edge case      1
```

Then clicking:

```text
Failure
```

filters the graph.

This makes the coverage number navigable.

---

# 36. Section — Missing Flow vs Missing State

This distinction needs its own section.

### H2

> **A missing state and a missing flow are not the same thing.**

| Missing state                    | Missing flow                                   |
| -------------------------------- | ---------------------------------------------- |
| A condition not observed         | A behavioral path not observed                 |
| Example: `EMPTY_CART`            | Example: Cart → Empty Cart → Continue Shopping |
| Example: `404_PAGE`              | Example: Invalid Route → 404 → Return Home     |
| Usually one node/state           | Usually multiple states and transitions        |
| Focuses on application condition | Focuses on progression through behavior        |

The MVP separately defines Missing Flow Detection and Missing State Detection. Missing flows include failure, alternative, recovery, and edge-case paths; missing states include loading, empty, error, and recovery states. 

---

# 37. Visual distinction

Use:

```text
MISSING STATE

CHECKOUT
   ┆
   ▼
PAYMENT_FAILURE


MISSING FLOW

CHECKOUT
   ┆
   ▼
PAYMENT_FAILURE
   ┆
   ▼
RETRY
   ┆
   ▼
PAYMENT_SUCCESS
```

Master:

```text
1500 × 750
```

Display:

```text
960 × 480
```

---

# 38. Section — Missing Flow + Session Evidence

### H2

> **A missing-flow finding should still show the evidence around it.**

For example:

```text
PAYMENT_FAILURE

Not observed

Related observed path:

CHECKOUT
   ↓
PAYMENT_SUCCESS

Supporting sessions

SES-3817
SES-3824
SES-3901
```

Click:

```text
SES-3817
```

and open Session Replay.

---

# 39. Evidence video

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
Missing Flow finding
↓
View related observations
↓
Select supporting success session
↓
Replay opens at Checkout
```

The purpose is not to replay the missing behavior—there is no replay for behavior that wasn't observed.

Instead, replay the **related observed evidence** that led to the suggestion.

---

# 40. Section — Endpoint context

### H2

> **Missing behavioral paths can also involve backend outcomes.**

Example:

```text
Observed

POST /payment
     ↓
200
     ↓
PAYMENT_SUCCESS


Potential flow

POST /payment
     ┆
4xx / 5xx / timeout
     ┆
     ▼
PAYMENT_FAILURE
```

Because the backend SDK captures response metadata, timing, errors, and correlates backend activity with frontend sessions where possible, endpoint evidence can provide useful context for demonstrated workflows. 

---

# 41. Important API boundary

Do not claim:

> Tellann can prove an API failure path exists even though it has never happened.

Phase 1 can infer or suggest such a path from configured/rule-based behavior.

Distinguish:

```text
OBSERVED API ERROR
Evidence exists.

POTENTIAL API FAILURE FLOW
Suggested behavior to demonstrate.
```

---

# 42. Section — Demonstrate the Missing Path

This should be the page's most important conversion loop.

### H2

> **Turn a gap into the next demonstration.**

Finding:

```text
PAYMENT_FAILURE

Status
Not observed

[ Demonstrate this path ]
```

Click leads to Demonstration Mode with context:

```text
NEW DEMONSTRATION

Target workflow
Checkout

Target path
Payment Failure

Suggested objective
Exercise the payment failure branch.
```

---

# 43. Product loop

Visual:

```text
DEMONSTRATE
     ↓
DISCOVER
     ↓
MEASURE COVERAGE
     ↓
FIND MISSING FLOW
     ↓
DEMONSTRATE GAP
     ↓
REANALYZE
     ↓
EXPAND GRAPH
```

This should become a defining Tellann Phase 1 interaction loop.

---

# 44. Demonstrate-gap video

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
Open Payment Failure finding

↓

Click Demonstrate this path

↓

Demonstration Mode opens

↓

Developer performs failure scenario

↓

Session processes

↓

PAYMENT_FAILURE becomes observed

↓

Coverage updates
```

Use clearly illustrative UI until this exact workflow is implemented.

---

# 45. Section — Multiple demonstrations

### H2

> **A missing flow today can become observed behavior tomorrow.**

Example:

```text
DEMO 01

Checkout Success

Potential gaps
Payment Failure
Retry Payment


DEMO 02

Payment Failure

Potential gap
Retry Payment


DEMO 03

Retry Payment

Checkout workflow
broader behavioral coverage
```

This helps users understand that findings are not permanent labels.

They change as the observed dataset grows.

---

# 46. Finding state model

Recommended statuses:

```text
NOT_OBSERVED
DEMONSTRATED
DISMISSED
NOT_APPLICABLE
```

`DISMISSED` and `NOT_APPLICABLE` are sensible product-design extensions, not explicitly defined in the provided specs.

They are worth adding because rule-based systems inevitably surface cases that are irrelevant to particular products.

Example:

```text
Guest Checkout

[ Demonstrate ]
[ Not applicable ]
```

That feedback can later improve future intelligence.

---

# 47. Section — Prioritization

### H2

> **Not every missing path deserves the same attention.**

The reporting framework requires findings to support severity classifications:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```



For Missing Flows, severity should not be assigned arbitrarily.

Potential inputs could include:

```text
workflow criticality
flow category
configured business importance
failure impact
coverage contribution
```

The exact ranking formula should remain server-side and documented before marketing it as intelligent prioritization.

---

# 48. Prioritized findings visual

Example:

```text
MISSING FLOWS

HIGH
Payment Failure
Checkout

HIGH
Session Expiration
Authentication

MEDIUM
Retry Payment
Checkout

LOW
Guest Checkout
Checkout
```

All data:

```text
Sample application data
```

---

# 49. Section — Missing Flow Report

### H2

> **Turn uncovered paths into a QA artifact.**

The QA Report Specification explicitly defines a Missing Flow Report whose purpose is to identify workflows likely not demonstrated or observed. Its example includes `PAYMENT_FAILURE`, `RETRY_PAYMENT`, `OUT_OF_STOCK`, `CART_EXPIRATION`, and `SESSION_TIMEOUT`, grouped into failure, recovery, alternative, rare, and edge-case flows. 

The MVP also lists the Missing Flow Report as a Phase 1 report output. 

---

# 50. Missing Flow Report visual

Example:

```text
MISSING FLOW REPORT

Application
Storefront Demo

Workflow
CHECKOUT

Coverage
72%

Missing Flows
5


HIGH
PAYMENT_FAILURE
Failure Flow

HIGH
SESSION_TIMEOUT
Edge Case

MEDIUM
RETRY_PAYMENT
Recovery Flow

MEDIUM
OUT_OF_STOCK
Alternative / Failure Path

LOW
CART_EXPIRATION
Edge Case
```

### Master page

```text
1000 × 1280
```

### Display

```text
600 × 768
```

Desktop layout:

```text
Explanation          Report preview
5 columns            7 columns
```

---

# 51. Report export

Phase 1 reports support:

```text
PDF
JSON
CSV
HTML
```



Use a small export footer rather than dedicating an entire section.

---

# 52. Section — What a Missing Flow does not mean

### H2

> **A suggested path is a question—not automatically a defect.**

This is perhaps the most important trust section on the page.

State explicitly:

```text
A missing flow does not necessarily mean:

the application is broken

the product requirement demands that path

the path is technically possible

the workflow contains a bug

a test has failed
```

Instead:

> A Missing Flow indicates that Tellann identified behavior worth considering that was not observed in the selected demonstrations.

---

# 53. Use careful status copy

Bad:

```text
BUG FOUND
Payment Failure Missing
```

Better:

```text
POTENTIAL GAP
Payment Failure was not observed.
```

Bad:

```text
FAILED TEST
Session timeout missing.
```

Better:

```text
NOT DEMONSTRATED
Session timeout path has not been observed.
```

---

# 54. Manual confirmation controls

A future-ready product UI should allow:

```text
[ Demonstrate ]
[ Mark expected ]
[ Not applicable ]
[ Dismiss ]
```

This enables teams to curate the behavioral model instead of treating Tellann's suggestions as unquestionable truth.

---

# 55. Future Missing-Flow Intelligence

Keep this short.

### Phase 1 — Behavioral QA

```text
Rule-based missing-flow detection
Failure flows
Alternative flows
Recovery flows
Edge-case flows
Coverage integration
Demonstration-driven analysis
Missing Flow reports
```

Phase 1 must work without AI or machine learning. 

### Phase 2 — Planned

The Developer Demonstration specification describes production-aware edge-case generation using signals such as real failure frequency, abandonment, and API slowdown. 

Present as:

```text
Production-aware rare flows
Observed production failures
Journey interruptions
Latency-driven edge cases
```

Clearly label:

```text
PLANNED · PHASE 2
```

### Phase 3 — Planned

```text
Autonomous validation scenarios
Generated tests
Failure simulation
Regression detection
Behavioral risk assessment
```

The MVP explicitly excludes autonomous testing, regression detection, failure simulation, anomaly detection, and quality intelligence from Phase 1. 

---

# 56. FAQ

Recommended questions:

```text
What is a missing flow?

How does Tellann identify missing flows?

What is the difference between a missing flow and a missing state?

Does a missing flow mean my application has a bug?

What is a failure flow?

What is an alternative flow?

What is a recovery flow?

What is an edge-case flow?

Does Tellann use AI to discover missing flows?

Can I see why a flow was suggested?

Can I dismiss irrelevant flows?

Can I demonstrate a missing flow afterward?

Will demonstrating it change coverage?

Can missing flows be linked to sessions?

How do endpoint failures affect missing-flow analysis?

Can Tellann automatically test a missing flow?

Does Tellann discover missing flows from production traffic?
```

The Phase 1 answer to the AI question should be:

> No. Phase 1 is designed around explainable, rule-based detection rather than machine learning or autonomous AI. 

---

# 57. Final CTA

### Eyebrow

```text
GO BEYOND THE HAPPY PATH
```

### H2

> **Find the path you haven't demonstrated yet.**

Supporting copy:

> Show Tellann a workflow, inspect the failure, alternative, recovery, and edge-case paths that remain unobserved, and use those gaps to guide your next demonstration.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Optional:

```text
View Coverage →
```

---

# 58. Complete media inventory

| Asset                         | Type                    |    Master |    Display |
| ----------------------------- | ----------------------- | --------: | ---------: |
| Hero Missing Flow Graph       | SVG/Canvas              | 1920×1120 |   1320×760 |
| Mobile Missing Flow Graph     | SVG                     | 1080×1350 | Responsive |
| Observed vs Missing           | SVG                     |  1600×850 |   1000×531 |
| Detection Pipeline            | Animated SVG            | 1800×1000 |   1100×611 |
| Failure Flow                  | Animated SVG            |  1500×850 |    900×510 |
| Alternative Flow              | SVG                     |  1500×850 |    900×510 |
| Recovery Flow                 | Animated SVG            |  1500×850 |    900×510 |
| Edge-Case Matrix              | Animated SVG            |  1600×900 |   1000×562 |
| Rule-Based Detection          | HTML/SVG                |  1600×900 |   1000×562 |
| Missing Flow Explorer         | Interactive HTML/Canvas |         — |   1280×800 |
| Why Flagged Panel             | Product UI              |  1200×800 |    720×480 |
| Graph Missing-Flow Overlay    | Product video           | 1920×1200 |   1000×625 |
| Coverage Integration          | SVG/UI                  |  1500×850 |    960×544 |
| Missing Flow vs State         | SVG                     |  1500×750 |    960×480 |
| Evidence → Replay             | Product video           | 1920×1200 |   1000×625 |
| Endpoint Context              | SVG/UI                  |  1600×900 |    900×506 |
| Demonstrate Gap Loop          | Product video           | 1920×1200 |   1100×688 |
| Multi-Demonstration Evolution | Animated SVG            |  1600×900 |   1000×562 |
| Prioritized Findings          | Product UI              |  1400×900 |    800×514 |
| Missing Flow Report           | Report UI               | 1000×1280 |    600×768 |

That gives roughly **20 visual surfaces**, but the website should not maintain twenty unrelated graphics. Most should reuse the same workflow/Behavior Graph renderer.

---

# 59. Reusable component architecture

Extend the graph system already used by Behavior Graphs, Workflow Discovery, and Coverage:

```tsx
<MissingFlowGraph
  workflow={workflow}
  findings={findings}
  mode="interactive"
/>
```

Suggested modes:

```ts
type MissingFlowGraphMode =
  | "hero"
  | "failure"
  | "alternative"
  | "recovery"
  | "edge-case"
  | "coverage"
  | "evidence"
  | "explorer";
```

Supporting components:

```tsx
<MissingFlowList />
<MissingFlowInspector />
<DetectionReason />
<FlowCategoryBadge />
<SupportingEvidence />
<DemonstrateGapCTA />
<MissingFlowReportPreview />
```

---

# 60. Suggested frontend finding model

Conceptually:

```ts
interface MissingFlowFinding {
  id: string;

  workflowId: string;

  name: string;

  category:
    | "FAILURE"
    | "ALTERNATIVE"
    | "RECOVERY"
    | "EDGE_CASE";

  status:
    | "NOT_OBSERVED"
    | "DEMONSTRATED"
    | "NOT_APPLICABLE"
    | "DISMISSED";

  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

  sourceState?: string;

  targetState?: string;

  detectionBasis?: {
    type: "RULE";
    rule: string;
  };

  supportingSessionIds?: string[];
}
```

The exact persistence model should follow the backend domain design; this is the frontend/product-view model.

The API specification already reserves `GET /missing-flows` for Phase 1 retrieval. 

---

# 61. Animation language

Missing Flow animation should communicate:

```text
absence
branching
contrast
discovery
completion
```

Good:

```text
solid path stops
dashed branch appears
dead-end highlights
recovery route draws
finding attaches to graph
demonstration converts dashed path to observed
```

Avoid:

```text
danger sirens
flashing red screens
AI particle effects
random graph movement
"bug explosion" animations
```

The feature is analytical, not alarmist.

---

# 62. Visual status language

Use shape, pattern, label, and optional semantic color together.

```text
Observed
━━ solid

Potential gap
┄┄ dashed

Failed observation
━━ solid + FAILED badge

Not applicable
faded + N/A

Dismissed
faded + DISMISSED
```

Do not use:

```text
green = good
red = missing
```

as the only distinction.

---

# 63. Recommended scroll choreography

One effective mid-page sequence:

```text
CHECKOUT SUCCESS

↓ scroll

What if payment fails?

↓ scroll

PAYMENT_FAILURE appears

↓ scroll

What happens after failure?

↓ scroll

RETRY_PAYMENT appears

↓ scroll

What if the request never returns?

↓ scroll

SESSION_TIMEOUT appears

↓ scroll

Potential missing flows: 3
```

This teaches missing-flow reasoning progressively.

---

# 64. Responsive behavior

### Desktop ≥1280px

Use complete workflow graphs and side inspectors.

### Tablet

Move finding inspector beneath the graph.

### Mobile

Use:

```text
Checkout

3 potential flows

[ Failure ]
[ Recovery ]
[ Alternative ]
[ Edge Case ]

Finding card

Graph

Why this was flagged

Actions
```

Do not display an entire application graph on mobile.

---

# 65. Mobile finding card

Example:

```text
PAYMENT FAILURE

Failure Flow
Not observed

Related workflow
Checkout

Detection basis
Success → Failure

[ Why? ]

[ Demonstrate ]
```

This should be the primary mobile interaction.

---

# 66. Accessibility

Every graph finding needs a textual representation.

Provide:

```text
Graph
List
```

List mode:

```text
Checkout

Observed:
Checkout → Payment Success

Potential gaps:

Payment Failure
Type: Failure

Retry Payment
Type: Recovery

Session Timeout
Type: Edge Case
```

Dashed lines cannot be the only way users discover that a path is missing.

---

# 67. Reduced motion

For:

```css
prefers-reduced-motion: reduce
```

show final diagrams immediately.

Do not animate:

```text
dashed path drawing
node emergence
workflow branching
graph transformations
```

Videos should show poster frames and require explicit playback.

---

# 68. SEO

### Recommended title

> **Missing Flow Detection — Find Unobserved Application Paths | Tellann**

Alternative:

> **Find Missing Workflow Paths | Tellann**

### Meta description

> See how Tellann identifies likely failure, alternative, recovery, and edge-case paths that were not demonstrated, connects them to workflow coverage and behavioral evidence, and helps guide the next QA walkthrough.

---

# 69. Recommended heading hierarchy

```text
H1
See the paths your demonstration never reached.

H2
A missing flow is a meaningful path Tellann expected or inferred but did not observe.

H2
Start with what Tellann knows. Then expose what it hasn't seen.

H2
Missing paths are derived from behavioral structure—not guessed in isolation.

H2
Not every missing path represents the same kind of behavior.

H2
What happens when success does not happen?

H2
Could the same objective be reached another way?

H2
Failure is only half the story. What happens next?

H2
Some important behavior only appears at the edges.

H2
Phase 1 begins with explainable rules.

H2
Inspect every missing path in context.

H2
Every suggestion should come with a reason.

H2
See the missing branch where it belongs.

H2
Missing flows explain where coverage is incomplete.

H2
A missing state and a missing flow are not the same thing.

H2
A missing-flow finding should still show the evidence around it.

H2
Missing behavioral paths can also involve backend outcomes.

H2
Turn a gap into the next demonstration.

H2
A missing flow today can become observed behavior tomorrow.

H2
Not every missing path deserves the same attention.

H2
Turn uncovered paths into a QA artifact.

H2
A suggested path is a question—not automatically a defect.

H2
Find the path you haven't demonstrated yet.
```

---

# 70. Analytics events

Track:

```text
missing_flow_hero_interacted

missing_flow_workflow_selected

missing_flow_category_selected

missing_flow_finding_selected

missing_flow_reason_expanded

missing_flow_graph_opened

missing_flow_related_session_opened

missing_flow_replay_opened

missing_flow_demonstrate_clicked

missing_flow_mark_not_applicable

missing_flow_dismissed

missing_flow_report_previewed

missing_flow_coverage_clicked

missing_flow_signup_clicked
```

Useful properties:

```json
{
  "workflow": "checkout",
  "category": "failure",
  "finding": "payment_failure",
  "detectionBasis": "SUCCESS_TO_FAILURE",
  "sourceSection": "missing_flow_explorer"
}
```

---

# 71. Most important UX principle

Every Missing Flow finding should answer five questions:

```text
WHAT?

Payment Failure


WHERE?

Checkout Workflow


STATUS?

Not observed


WHY?

Payment Success was observed and
the Success → Failure rule applied.


WHAT NEXT?

Demonstrate the Payment Failure path.
```

If Tellann cannot answer **why a missing flow exists**, the finding will feel arbitrary.

That explainability is particularly important in Phase 1 because the product intentionally uses rule-based detection rather than AI. 

---

# 72. Strongest relationship with the existing Product pages

The page should reinforce this chain:

```text
WORKFLOW DISCOVERY
"This is Checkout."

        ↓

COVERAGE
"You exercised 72% of the modeled behavior."

        ↓

MISSING FLOWS
"Payment failure, retry, and session timeout
were not observed."

        ↓

SESSION REPLAY
"Here is the evidence from the paths you did observe."

        ↓

DEMONSTRATION MODE
"Now demonstrate one of the missing paths."

        ↓

BEHAVIOR GRAPH
"The graph expands."

        ↓

COVERAGE
"Coverage is recalculated."
```

That circular workflow is more compelling than treating every Tellann feature as an isolated page.

---

# 73. Final visitor experience

The visitor should finish `/product/missing-flows` thinking:

```text
I demonstrated Checkout.

        ↓

Tellann saw:

Product
→ Cart
→ Checkout
→ Payment Success

        ↓

It did not simply stop at:
"Checkout worked."

        ↓

It asked:

What happens if payment fails?

What happens after that failure?

What happens if the request times out?

Are there alternative routes?

        ↓

Those paths are surfaced as
potential missing flows.

        ↓

I can see exactly why
each one was suggested.

        ↓

I can inspect the observed sessions
that produced the surrounding workflow.

        ↓

I can dismiss a path that
doesn't apply to my application.

        ↓

Or I can choose:

Demonstrate this path.

        ↓

Tellann captures the new behavior.

        ↓

The graph expands.

        ↓

Coverage improves.

        ↓

A previously missing path
becomes behavioral evidence.
```

That should define `/product/missing-flows`: **Tellann does not claim that an unobserved branch is automatically a bug. It turns absence into an explainable QA question, shows why that question exists, and gives the developer a direct path from finding the gap to demonstrating it.** This is fully aligned with the Phase 1 principle of measuring coverage, identifying missing flows and states, and generating QA evidence without requiring production traffic, machine learning, AI, or manual workflow modeling. 
