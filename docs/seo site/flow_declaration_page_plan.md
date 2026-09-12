# `/product/flow-declaration` — Complete Page Specification

`/product/flow-declaration` should explain the **intent side of Tellann**.

Until this capability, most of the Product pages answer:

> “What did the application actually do?”

Flow Declaration introduces a second, deliberately separate question:

> **“What is the application supposed to do?”**

That distinction is now fundamental to Tellann's Phase 1 architecture. A team can define intended workflows in a **Declared Intent Graph**, demonstrate the application separately, and then reconcile the declared graph against the observed graph. Declaration remains optional; an application without declared flows can still use Tellann's observation, coverage, missing-state, and other behavioral analysis. 

---

# 1. The core positioning

The page should revolve around:

> **Define what should happen. Then let Tellann compare it with what actually happened.**

Secondary positioning:

> Declare the states and paths that matter to your application, review suggested edge cases, then use that intent as an explicit baseline for guided demonstrations and behavioral reconciliation.

This is more accurate than describing Flow Declaration as manual workflow modeling.

The declared graph is not a replacement for automatic discovery.

It exists alongside it:

```text
DECLARED INTENT
What the team says should happen.

            vs

OBSERVED BEHAVIOR
What Tellann actually sees happen.
```

The specification explicitly keeps `DECLARED`, `DEMONSTRATED`, and later `PRODUCTION` graph types distinct. 

---

# 2. Important change to the Tellann product story

This route makes the Phase 1 story richer than the earlier simplified pipeline.

The best current conceptual model is:

```text
INTENT
"What should the software do?"

        ↓

FLOW DECLARATION
Create Declared Intent Graph

        ↓

DEMONSTRATION
Use the application

        ↓

OBSERVATION
Create Demonstrated Behavior Graph

        ↓

RECONCILIATION
Compare intent vs evidence

        ↓

COVERAGE / GAPS / QA REPORTS
```

The PRD now defines Phase 1 as a **Behavioral QA & Intent Platform**, where teams can declare intended flows, demonstrate them once, and receive reconciliation between what was declared and what was observed. 

---

# 3. Position in the Product navigation

I would now place this route **before Demonstration Mode**, not after all the analysis pages.

Recommended narrative order:

```text
/product
        ↓
/product/how-it-works
        ↓
/product/flow-declaration
        ↓
/product/demonstration-mode
        ↓
/product/behavior-graphs
        ↓
/product/workflow-discovery
        ↓
/product/session-replay
        ↓
/product/coverage
        ↓
/product/missing-flows
        ↓
/product/missing-states
        ↓
/product/endpoint-intelligence
        ↓
/product/qa-reports
```

Why?

Because Flow Declaration can now be Stage 1 of the Demonstration lifecycle:

```text
Create Application
↓
Declare Intended Flows
↓
Review Suggestions
↓
Complete Flow
↓
Compile Ruleset
↓
Demonstrate
```



---

# 4. Page objectives

The page should answer:

```text
What is Flow Declaration?

Do I have to declare flows?

What is the Declared Intent Graph?

How is it different from the Behavior Graph?

How do I create a flow?

What is a state?

What is a transition?

What is an entry state?

What is a terminal state?

Can Tellann suggest branches?

Where do those suggestions come from?

Are suggestions added automatically?

Can I accept only some suggestions?

Can I reject suggestions?

Can Tellann draft a whole flow?

What happens when a flow is complete?

What is the application ruleset?

How does declaration affect Demonstration Mode?

How are declared and observed states compared?

What is CONFIRMED?

What is TRUE_GAP?

What is UNDECLARED?

Can I edit a declaration later?

How does Tellann preserve authorship and provenance?

Does this use AI?

Can Tellann work without declaring anything?
```

---

# 5. Recommended page architecture

```text
/product/flow-declaration
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Intent vs Observation
├── 04 What Is a Declared Flow?
├── 05 Declared Intent Graph
├── 06 How Flow Declaration Works
├── 07 Add States & Transitions
├── 08 Entry & Terminal States
├── 09 Suggestion Engine
├── 10 Suggestion Sources
├── 11 Accept / Reject Suggestions
├── 12 Whole-Flow Review
├── 13 Interactive Flow Builder
├── 14 Flow Drafts & Completion
├── 15 Ruleset Compilation
├── 16 Guided Demonstration
├── 17 Declared vs Demonstrated
├── 18 Reconciliation
├── 19 Confirmed / True Gap / Undeclared
├── 20 Demonstration-Time Promotion
├── 21 Provenance & Human Control
├── 22 Editing & Versioning
├── 23 Optional by Design
├── 24 Document-Assisted Drafting
├── 25 Privacy & Suggestion Sources
├── 26 What Flow Declaration Is Not
├── 27 Future Evolution
├── 28 FAQ
├── 29 Final CTA
└── 30 Footer
```

---

# 6. Hero

### Eyebrow

```text
FLOW DECLARATION
```

### H1

> **Define what should happen before you measure what did.**

Alternative:

> **Give application behavior an explicit baseline.**

The first is stronger for the public website.

### Supporting copy

> Declare the workflows your application is intended to support, review suggested failure and edge-case branches, and give Tellann a human-approved baseline to compare against demonstrated behavior.

### CTAs

```text
[ Declare a sample flow ]
[ See intent vs observation → ]
```

Secondary:

```text
Explore Demonstration Mode →
```

---

# 7. Hero visual concept

This should be one of the strongest interactive diagrams on the entire site.

Start with a **Declared Checkout Flow**:

```text
DECLARED INTENT

PRODUCT_VIEW
     │
     ▼
CART_ACTIVE
     │
     ▼
CHECKOUT
     │
     ▼
PAYMENT_PENDING
   /       \
  ▼         ▼
SUCCESS   FAILURE
             │
             ▼
           RETRY
```

Then beside it show the demonstrated graph:

```text
DEMONSTRATED

PRODUCT_VIEW
     │
     ▼
CART_ACTIVE
     │
     ▼
CHECKOUT
     │
     ▼
PAYMENT_SUCCESS
```

Then resolve reconciliation:

```text
CONFIRMED
Product View
Cart
Checkout
Payment Success

TRUE GAP
Payment Failure
Retry

UNDECLARED
Promo Code Rejected
```

That teaches almost the entire feature in one visual.

---

# 8. Hero dimensions

Use interactive SVG/Canvas.

### Master conceptual canvas

```text
1920 × 1180
```

### Desktop render

```text
max-width: 1360px
height: 780–820px
```

### Placement

```text
Centered hero copy
        ↓
48–56px
        ↓
Intent vs Observed visualization
```

Avoid a small right-side hero mockup.

This visualization deserves the full width.

---

# 9. Hero animation

Duration:

```text
10–12 seconds
```

Sequence:

```text
0–2 sec
Declared Checkout flow builds.

2–4 sec
Demonstrated graph appears beside it.

4–6 sec
Matching nodes connect.

6–7 sec
CONFIRMED labels appear.

7–8 sec
Declared-but-unseen nodes become TRUE GAP.

8–9 sec
Observed-but-undeclared node appears.

9–10 sec
UNDECLARED label resolves.

10–11 sec
Summary panel appears.
```

Then stop and enter interactive mode.

Do not loop the entire reconciliation animation indefinitely.

---

# 10. Mobile hero

Use a vertical comparison:

```text
DECLARED

Checkout
↓
Success
├── Failure
└── Retry


DEMONSTRATED

Checkout
↓
Success


RESULT

✓ Confirmed
○ True Gap
+ Undeclared
```

Master:

```text
1080 × 1440
```

Display:

```text
width: calc(100vw - 32px)
```

---

# 11. Section — Intent vs Observation

### H2

> **Tellann keeps intent and evidence separate.**

This is the most important architectural idea of the page.

Use:

```text
DECLARED GRAPH

What people say should happen.

USER_AUTHORED
SUGGESTED_ACCEPTED
DEMONSTRATION_PROMOTED


OBSERVED GRAPH

What telemetry proves happened.

TELEMETRY_OBSERVED
```

Tellann explicitly keeps declared and observed relationships independently queryable rather than merging them into one source of truth. 

---

# 12. Why this distinction matters

Show:

```text
Declared-only
↓
Potential true gap

Observed-only
↓
Unspecified behavior

Declared + observed
↓
Confirmed behavior
```

This is much stronger than a system that only says:

```text
"Not observed"
```

because Tellann can distinguish:

> “We never saw this.”

from:

> **“You specifically said this should happen, and we never saw it.”**

That stronger `TRUE_GAP` classification is explicitly part of reconciliation. 

---

# 13. Intent vs Observation media

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Use an interactive toggle:

```text
[ Declared ]
[ Demonstrated ]
[ Reconciled ]
```

This toggle can become a reusable pattern across the actual Tellann product.

---

# 14. What is a Declared Flow?

### H2

> **A declared flow describes behavior the team expects the application to support.**

Example:

```text
CHECKOUT

Entry
PRODUCT_VIEW

        ↓

CART_ACTIVE

        ↓

CHECKOUT

        ↓

PAYMENT_PENDING

       / \
      /   \
     ▼     ▼

SUCCESS   FAILURE

            ↓

          RETRY
```

A declared flow contains intended states and transitions, not captured evidence.

---

# 15. Declared Intent Graph

### H2

> **Multiple declared flows become the application's intent map.**

Example:

```text
DECLARED INTENT GRAPH

Registration
       │
       ▼
Authentication
       │
       ├─────────→ Profile
       │
       ▼
Product Browsing
       │
       ▼
Checkout
       │
       ▼
Payment
```

Each completed or in-progress declared workflow contributes to the application's overall Declared Intent Graph. 

---

# 16. Declared graph visual dimensions

Master:

```text
1800 × 1100
```

Display:

```text
1100 × 672
```

Controls:

```text
Workflow
[ All ▾ ]

[ Fit ]
[ Zoom + ]
[ Zoom − ]
```

Do not show observed metrics such as session count on this graph.

It represents intent, not telemetry.

---

# 17. How Flow Declaration works

### H2

> **Build the flow one meaningful state at a time.**

The specified lifecycle is:

```text
ADD STATE
   ↓
ANALYZE STATE
   ↓
GENERATE SUGGESTIONS
   ↓
REVIEW
   ↓
ACCEPT / REJECT
   ↓
ADD NEXT STATE
   ↓
MARK FLOW COMPLETE
   ↓
COMPILE RULESET
```



---

# 18. Flow creation animation

Master:

```text
1800 × 1000
```

Display:

```text
1100 × 611
```

Duration:

```text
8–10 seconds
```

Sequence:

```text
Add LOGIN
↓
Tellann proposes LOGIN_FAILURE
↓
User accepts
↓
Add AUTHENTICATED
↓
Connect transition
↓
Mark complete
```

---

# 19. Add states and transitions

The UI should feel closer to a **focused flow editor** than a general-purpose diagramming tool.

Suggested desktop UI:

```text
┌──────────────────────────────────────────────────────┐
│ Checkout                                DRAFT        │
├──────────────────┬───────────────────────────────────┤
│ FLOW STATES      │                                   │
│                  │                                   │
│ Product View     │          GRAPH CANVAS             │
│ Cart             │                                   │
│ Checkout         │                                   │
│ Payment          │                                   │
│                  │                                   │
├──────────────────┴───────────────────────────────────┤
│ + Add state               Review suggestions         │
└──────────────────────────────────────────────────────┘
```

---

# 20. State creation interaction

Click:

```text
+ Add State
```

Drawer:

```text
STATE NAME

Payment Failure


CATEGORY

○ Navigation
○ UI
● Business
○ Error
○ System


[ Add state ]
```

The declaration model supports category-appropriate suggestions across Navigation, UI, Business, Error, and System state categories. 

---

# 21. Transition creation

Users should be able to connect:

```text
PAYMENT_PENDING
        ↓
PAYMENT_FAILED
```

and optionally describe the transition:

```text
Trigger
PAYMENT_REJECTED
```

For the public demo, keep this light.

Do not turn the website into a full workflow-editor tutorial.

---

# 22. Entry and terminal states

### H2

> **Tell Tellann where meaningful behavior begins and ends.**

Example:

```text
ENTRY
PRODUCT_VIEW

      ↓

CART

      ↓

CHECKOUT

      ↓

ORDER_COMPLETE
EXIT
```

These boundaries later become important to Guided Demonstration Mode and evidence scoping.

---

# 23. Boundary relationship with demonstration

A declared flow gives Tellann a meaningful evidence scope.

In a demonstration run:

```text
PRE-BOUNDARY

login
setup
navigate to starting point

        ↓

INITIAL FLOW BOUNDARY

        ↓

IN-FLOW EVIDENCE

        ↓

TERMINAL STATE
```

The demonstration specification explicitly excludes pre-boundary activity from coverage while retaining it for context/replay; in-flow activity is what coverage and reconciliation are computed from. 

This is worth exposing publicly because it explains why declaration improves measurement precision.

---

# 24. Boundary visual

Master:

```text
1500 × 700
```

Display:

```text
1000 × 467
```

Use a horizontal timeline:

```text
SETUP        FLOW START          FLOW EVIDENCE        END
───────|──────────────────────────────────────────────|────

Context       Included in analysis
```

---

# 25. Suggestion Engine

### H2

> **Declare the main path. Let Tellann help you think about the branches.**

As each state is added, the Derivation Engine can propose:

```text
Failure paths
Edge states
Recovery states
Category-appropriate variants
```



Example:

```text
USER ADDS

LOGIN

        ↓

TELLANN SUGGESTS

LOGIN_FAILURE
ACCOUNT_LOCKED
PASSWORD_RESET_REQUESTED
SESSION_TIMEOUT
```

The internal pattern specification uses essentially this exact login example. 

---

# 26. Suggestion card design

Example:

```text
LOGIN_FAILURE

ERROR STATE

Why this was suggested
Login success paths commonly need
a corresponding failure path.

Source
Pattern Library

[ Accept ] [ Reject ]
```

Card:

```text
360 × 280px
```

Desktop suggestion rail:

```text
3 cards visible
20px gap
```

Mobile:

```text
1 card at a time
horizontal swipe
```

---

# 27. Suggestion source transparency

This should be a major trust feature.

The specification requires surfaced suggestions to expose their source tier. 

Public labels:

```text
PATTERN LIBRARY

CROSS-APPLICATION PATTERN

ASSISTIVE ENRICHMENT
```

Internally the formal source tiers are:

```text
INTERNAL_LIBRARY
CROSS_TENANT
ASSISTIVE_ENRICHMENT
```

For marketing copy, `Cross-application pattern` is easier to understand than `cross-tenant`.

---

# 28. Three suggestion sources

### Pattern Library

Curated QA patterns.

```text
LOGIN
→ Login Failure
→ Account Locked
→ Session Timeout
```

### Structural Pattern

Aggregate application-structure patterns can surface commonly observed/declaratively expected branches without exposing another tenant's application data. The specification restricts this to anonymized structural shape data and aggregate patterns. 

### Assistive Enrichment

For novel state names where internal sources are insufficient, bounded assistive intelligence may enrich the candidate suggestion pool. Its output is normalized and schema-validated before being shown. 

---

# 29. Critical human-control message

This should be repeated prominently:

> **A suggestion never becomes declared intent until a human accepts it.**

The specification explicitly prohibits automatic addition of suggestion nodes to the Declared Intent Graph. 

Visually:

```text
SUGGESTION
     ↓

[ ACCEPT ]   [ REJECT ]

     ↓ only if accepted

DECLARED INTENT
```

---

# 30. Accept / Reject animation

Master:

```text
1400 × 800
```

Display:

```text
900 × 514
```

Duration:

```text
5–6 sec
```

Animation:

```text
LOGIN_FAILURE appears dashed
↓
Accept clicked
↓
Node joins Declared graph

SESSION_TIMEOUT appears
↓
Reject clicked
↓
Suggestion disappears from canvas
↓
Rejected status retained
```

Rejected suggestions remain recorded so unchanged suggestions are not repeatedly resurfaced. 

---

# 31. Whole-flow review

### H2

> **Review the entire declared flow before applying changes.**

The platform supports:

```text
Request Review
      ↓
Preview Proposed Changes
      ↓
Select changes
      ↓
Apply / Decline
```

A whole-flow review must expose the full effect before changes are made, and the declarer can apply only a subset of proposed changes. 

---

# 32. Whole-flow review visual

Desktop:

```text
CURRENT FLOW                  PROPOSED

LOGIN                         LOGIN
  ↓                             ├─ Failure
AUTHENTICATED                  ├─ Locked
                               └─ Reset
```

Right panel:

```text
PROPOSED CHANGES

☑ Login Failure
☑ Account Locked
☐ Password Reset
☐ Session Timeout

[ Apply selected ]
[ Decline review ]
```

Master:

```text
1700 × 950
```

Display:

```text
1100 × 615
```

---

# 33. Interactive Flow Builder

This should be the page's primary interactive product surface.

### H2

> **Build intended behavior without turning Tellann into a diagramming chore.**

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│ CHECKOUT                                           DRAFT  │
├──────────────────┬─────────────────────────────────────────┤
│ STATES           │                                         │
│                  │                                         │
│ Product          │         DECLARED FLOW CANVAS            │
│ Cart             │                                         │
│ Checkout         │                                         │
│ Payment          │                                         │
│                  │                                         │
├──────────────────┼─────────────────────────────────────────┤
│ SUGGESTIONS      │  Selected: PAYMENT_PENDING             │
│                  │                                         │
│ Failure          │  Source: USER_AUTHORED                 │
│ Timeout          │                                         │
├──────────────────┴─────────────────────────────────────────┤
│ Save draft                  Review                  Done   │
└────────────────────────────────────────────────────────────┘
```

---

# 34. Flow Builder dimensions

Desktop:

```text
1280 × 820px
```

Container:

```text
max-width: 1400px
```

Tablet:

```text
960 × ~780
```

Mobile:

```text
Flow header
↓
Canvas
↓
Selected state
↓
Suggestions
↓
Actions
```

---

# 35. Flow Builder controls

Recommended public demo controls:

```text
+ State

Connect

Undo

Fit

Zoom +

Zoom −

Review Suggestions

Save Draft

Mark Complete
```

Do not expose every internal authoring feature on the marketing demo.

---

# 36. Draft vs Complete

### H2

> **Intent stays a draft until the team says it is ready.**

The lifecycle explicitly requires:

```text
DRAFT
```

until the declaring user marks a flow complete.

Draft flows:

* remain visible;
* are editable;
* do **not** participate in ruleset compilation;
* do **not** participate in reconciliation reporting. 

---

# 37. Draft UI

Header:

```text
CHECKOUT

DRAFT
Last edited 4 minutes ago
```

Footer:

```text
[ Save draft ]
[ Mark flow complete ]
```

When complete:

```text
CHECKOUT

COMPLETE
Ruleset updated

[ Reopen for editing ]
```

---

# 38. Completion animation

Duration:

```text
5–6 sec
```

Sequence:

```text
DRAFT
↓
Review complete
↓
Mark Flow Complete
↓
Graph snapshot freezes
↓
Ruleset compilation
↓
COMPLETE
```

Use a purposeful progress sequence rather than a generic spinner.

---

# 39. Ruleset Compilation

### H2

> **Completed intent becomes something Tellann can evaluate against.**

Once a declared flow is completed, it contributes to a versioned application ruleset.

Conceptually:

```text
GENERIC QA RULES
        +
DECLARED FLOW RULES
        +
ACCEPTED SUGGESTION RULES
        ↓
APPLICATION RULESET
```

This composition is explicitly defined by the Behavior Graph specification. 

---

# 40. Ruleset visual

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Example UI:

```text
APPLICATION RULESET

Version
1.4

Sources
Checkout
Registration
Authentication

Rules
47

Compiled
Just now
```

All numbers should be labeled illustrative.

---

# 41. Ruleset versioning

The specification requires:

* ruleset recompilation when source flows change;
* versioned rulesets;
* prior versions retained for historical reconciliation. 

This should be a small trust/technical section, not the center of the marketing page.

---

# 42. Guided Demonstration integration

### H2

> **Declared intent turns Demonstration Mode into a guided validation walkthrough.**

When a declared flow exists:

```text
CHECKOUT
        ↓
Start Guided Run
        ↓
Tellann knows the intended flow
        ↓
Developer demonstrates behavior
        ↓
Expected states can be checked
        ↓
Evidence reconciled
```

Guided Mode explicitly uses a declared flow to walk the developer through its boundaries and expected states. 

---

# 43. Guided Demonstration video

This should be the page's most important real product recording.

### Master

```text
1920 × 1200
```

### Display

```text
1100 × 688
```

### Duration

```text
12–15 seconds
```

Sequence:

```text
Open Checkout declaration
↓
Start Guided Demonstration
↓
Expected state shown
↓
Developer performs Checkout
↓
Expected state confirmed
↓
Flow completes
↓
Reconciliation appears
```

---

# 44. Assisted and Observation-only context

Do not make Guided Mode sound mandatory.

The current run modes include:

```text
GUIDED
Declared flow directs the walkthrough.

ASSISTED
Developer navigates freely;
Tellann relates activity to declared intent.

OBSERVATION ONLY
Record without prompting/directing.
```



A small three-card section can explain how Flow Declaration influences the first two modes.

---

# 45. Declared vs Demonstrated

### H2

> **Intent becomes meaningful when it meets evidence.**

Use:

```text
DECLARED                   DEMONSTRATED

Checkout                   Checkout
├─ Success                 └─ Success
├─ Failure
└─ Retry
```

Then reconciliation.

This should visually echo the hero but with more detail.

---

# 46. Reconciliation

### H2

> **Tellann compares what should happen with what actually happened.**

The Reconciliation Engine compares the Declared Intent Graph with the Observed Behavior Graph rather than assuming either one is automatically correct. 

Three states:

```text
CONFIRMED

Declared + Observed


TRUE GAP

Declared + Not Observed


UNDECLARED

Observed + Not Declared
```

---

# 47. Reconciliation matrix

Use the actual conceptual matrix:

|                  | Observed   | Not observed |
| ---------------- | ---------- | ------------ |
| **Declared**     | CONFIRMED  | TRUE GAP     |
| **Not declared** | UNDECLARED | —            |

This is the cleanest explanatory visual on the page.

---

# 48. Reconciliation visual dimensions

Master:

```text
1500 × 850
```

Display:

```text
960 × 544
```

Animate one case at a time:

```text
Confirmed
↓
True Gap
↓
Undeclared
```

Duration:

```text
6–7 seconds
```

---

# 49. CONFIRMED

Copy:

> A state or transition existed in the declared flow and was observed during demonstration.

Example:

```text
PAYMENT_SUCCESS

Declared ✓
Observed ✓

CONFIRMED
```

This represents evidence-backed coverage. 

---

# 50. TRUE GAP

Copy:

> A state or transition was explicitly declared but never observed.

Example:

```text
PAYMENT_FAILURE

Declared ✓
Observed —

TRUE GAP
```

This is stronger than ordinary missing-state inference because a human explicitly said the behavior should exist. 

---

# 51. UNDECLARED

Copy:

> Tellann observed behavior that was not in the declared flow.

Example:

```text
PROMO_CODE_REJECTED

Declared —
Observed ✓

UNDECLARED
```

This does **not** automatically mean the behavior is wrong.

It may mean:

```text
declaration incomplete
legitimate forgotten flow
unintended behavior
new behavior requiring review
```

The specification explicitly requires Undeclared behavior to be surfaced for review rather than treated as an error by default. 

---

# 52. Interactive Reconciliation Explorer

Desktop:

```text
┌────────────────────────────────────────────────────────┐
│ Checkout Reconciliation                               │
├──────────────┬─────────────────────────────────────────┤
│ FILTER       │                                         │
│              │                                         │
│ All 16       │          RECONCILED GRAPH               │
│ Confirmed 11 │                                         │
│ True Gap 3   │                                         │
│ Undeclared 2 │                                         │
├──────────────┴─────────────────────────────────────────┤
│ PAYMENT_FAILED · TRUE GAP · User authored            │
└────────────────────────────────────────────────────────┘
```

Dimensions:

```text
1280 × 800
```

---

# 53. Reconciliation inspector

Example:

```text
PAYMENT_FAILED

Classification
TRUE GAP

Declared
Yes

Observed
No

Origin
USER_AUTHORED

Declared in
Checkout v3

Evidence basis
Guided Run DEM-3817

[ View declared flow ]
[ View run ]
```

The reconciliation report explicitly preserves whether a True Gap originated as `USER_AUTHORED` or `SUGGESTED_ACCEPTED`. 

---

# 54. Demonstration-time promotion

### H2

> **Observed something you forgot to declare? Add it—with confirmation.**

During a demonstration, Tellann may encounter:

```text
UNDECLARED
PROMO_CODE_REJECTED
```

Prompt:

> This state wasn't in your declared flow. Is it expected?

Actions:

```text
[ Add to declared flow ]
[ Leave undeclared ]
```

If accepted, it becomes:

```text
DEMONSTRATION_PROMOTED
```

and triggers ruleset recompilation.

This always requires explicit human confirmation. 

---

# 55. Promotion animation

Master:

```text
1500 × 850
```

Display:

```text
900 × 510
```

Duration:

```text
6 seconds
```

Sequence:

```text
Observed graph shows new node
↓
UNDECLARED badge
↓
"Is this expected?"
↓
Accept
↓
Node appears in Declared graph
↓
provenance = DEMONSTRATION_PROMOTED
```

---

# 56. Provenance

### H2

> **Tellann remembers where declared intent came from.**

Provenance values include:

```text
USER_AUTHORED

SUGGESTED_ACCEPTED

DEMONSTRATION_PROMOTED
```

while observed graph nodes use telemetry provenance separately. 

This is important for trust.

---

# 57. Provenance UI

Selecting a node could show:

```text
PAYMENT_FAILURE

Declared by
Philip

Origin
USER_AUTHORED

Created
Sep 12, 2026

Flow version
v3
```

Another:

```text
SESSION_TIMEOUT

Origin
SUGGESTED_ACCEPTED

Suggestion source
Pattern Library
```

Do not expose personal names in marketing demo data; use fictitious team members or generic labels.

---

# 58. Editing & correction

### H2

> **Intent changes. The declared model can change with it.**

Completed flows can be reopened and edited.

The system must not overwrite a user-authored declaration because later observed evidence conflicts with it; the conflict is surfaced through reconciliation and the human decides. 

Use:

```text
Checkout v3

COMPLETE

[ Reopen for editing ]
```

After edit:

```text
Draft v4
```

---

# 59. Versioning visual

Show:

```text
CHECKOUT

v1
Product → Cart → Checkout

v2
+ Payment

v3
+ Failure
+ Retry
```

Master:

```text
1500 × 700
```

Display:

```text
1000 × 467
```

Use three mini graphs.

---

# 60. Optional by design

This section is essential because older Tellann positioning emphasized not requiring manual workflow modeling.

### H2

> **Declare what matters—or let Tellann begin with observation alone.**

Show two valid paths:

```text
PATH A — DECLARED

Declare Flow
↓
Demonstrate
↓
Reconcile against intent


PATH B — OBSERVATION ONLY

Demonstrate
↓
Build Observed Graph
↓
Coverage + gap analysis
```

The specification explicitly requires Flow Declaration to remain optional at the application level. 

---

# 61. This resolves the apparent contradiction

The marketing site should no longer say:

> “Tellann requires no workflow definition.”

That's now too absolute.

Better:

> **You don't have to manually model your application to use Tellann. But when explicit intent matters, Flow Declaration gives Tellann a human-approved baseline to evaluate against.**

That accurately reflects the current specification.

---

# 62. Document-assisted drafting

This can be a smaller advanced section.

### H2

> **Already documented the flow somewhere else? Start from that intent.**

The platform specification permits drafting candidate flows from customer-supplied documents, provided the result remains a suggestion until reviewed and accepted. 

Concept:

```text
Product requirement
User story
Process document

        ↓

Intent Draft

        ↓

Review

        ↓

Correct

        ↓

Accept

        ↓

Declared Flow
```

---

# 63. Important document-drafting boundary

Do not say:

> Upload a PRD and Tellann automatically decides your application's intended behavior.

Instead:

> Tellann can assist with drafting candidate intent from supplied materials, but the team reviews and accepts the result before it becomes declared behavior.

The API also specifies intent drafts as asynchronous, cancellable work that becomes declared intent only through review. 

---

# 64. Document-assisted drafting visual

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
Document
    ↓
Candidate Flow
    ↓
Review Changes
    ↓
Declared Intent
```

Do not use generic glowing AI imagery.

---

# 65. Assistive intelligence boundary

### H2

> **Assistance can propose. Evidence and humans decide.**

This deserves a compact trust section.

Permitted:

```text
Suggest branches
Draft candidate intent
Choose an appropriate rule pack
```

Not permitted:

```text
Auto-add to declared intent
Generate evidence
Generate behavioral findings
Decide quality
Assign risk autonomously
```

The specification explicitly makes this boundary part of the MVP design. 

---

# 66. Suggestion-source privacy

If you expose structural pattern suggestions publicly, explain carefully:

> Tellann may use anonymized, aggregated structural patterns to suggest common branches, but the system does not expose another organization's application identity, metadata, or payload contents.

The structural index is restricted to state/category/transition shape data in aggregate form. 

Avoid overexplaining the internal implementation unless a visitor expands:

```text
How suggestions are sourced
```

---

# 67. What Flow Declaration is not

### H2

> **Intent without turning your QA process into diagram maintenance.**

Make these boundaries explicit:

```text
Flow Declaration is not:

a requirement to manually map the whole application

a BPMN replacement

a generic whiteboard

an automatic truth generator

proof that declared behavior exists

a test result

an AI-generated workflow applied without review

a replacement for observed behavior
```

The declared graph expresses **intent**.

The demonstrated graph expresses **evidence**.

Neither should silently overwrite the other.

---

# 68. Relationship with Behavior Graphs

Use:

```text
DECLARED INTENT GRAPH
What should happen

          │
          │ compare
          ▼

DEMONSTRATED BEHAVIOR GRAPH
What did happen
```

Then link:

```text
Explore Behavior Graphs →
```

This relationship should be visible both on `/product/flow-declaration` and `/product/behavior-graphs`.

---

# 69. Relationship with Coverage

Declaration strengthens the meaning of coverage.

Where a declared baseline exists, coverage can be evaluated against expected paths rather than only internally derived expectations. The Demonstration specification explicitly states that declared expected paths can provide the coverage denominator; when no declaration exists, generic compiled rules provide the baseline. 

Marketing copy:

> **With declared intent, “not observed” can mean “something your team explicitly expected but never demonstrated.”**

That's a much stronger QA signal.

---

# 70. Relationship with Missing States and Flows

Show:

```text
DECLARED

Payment Failure
Retry Payment

        ↓

DEMONSTRATED

Payment Success only

        ↓

RECONCILIATION

TRUE GAP
Payment Failure

TRUE GAP
Retry Payment
```

This should be differentiated from Tellann's inferred Missing State / Missing Flow analysis.

A `TRUE_GAP` comes from a human-declared baseline, making it a stronger class of absence than a rule-derived candidate. 

---

# 71. Relationship with QA Reports

Flow Declaration introduces another important report:

```text
FLOW RECONCILIATION REPORT
```

Example:

```text
Checkout

Declared states     14
Observed states     12
Confirmed           11
True gaps            3
Undeclared           2
```

The Reconciliation Report is formally specified as a sibling to Coverage and Missing Flow reports. 

Your `/product/qa-reports` page should therefore eventually be updated to include **Flow Reconciliation Report** in its Phase 1 report catalog.

---

# 72. Reconciliation report preview

Master:

```text
1000 × 1280
```

Display:

```text
600 × 768
```

Example:

```text
FLOW RECONCILIATION REPORT

Workflow
CHECKOUT


DECLARED
14

OBSERVED
12

CONFIRMED
11

TRUE GAPS
3

UNDECLARED
2


TRUE GAPS

PAYMENT_FAILED
USER_AUTHORED

SESSION_TIMEOUT
USER_AUTHORED

GIFT_CARD_APPLIED
SUGGESTED_ACCEPTED
```

---

# 73. Public page interactions

The primary interactive experiences should be only four:

```text
1. Hero Declared vs Demonstrated comparison

2. Interactive Flow Builder

3. Suggestion Review

4. Reconciliation Explorer
```

Do not make every section interactive.

Those four tell the entire feature story.

---

# 74. Videos required

Only two real product videos are necessary.

### Video 1 — Declare → Guided Demonstration

```text
1920 × 1200
12–15 sec
display: 1100 × 688
```

Sequence:

```text
Flow Builder
→ Complete flow
→ Start guided run
→ demonstrate
→ finish
```

### Video 2 — Demonstration → Reconciliation

```text
1920 × 1200
8–10 sec
display: 1000 × 625
```

Sequence:

```text
Completed run
→ reconciliation
→ select True Gap
→ select Undeclared
→ promote expected node
```

Everything else should use HTML/SVG.

---

# 75. Complete media inventory

| Asset                         | Type                    |    Master |    Display |
| ----------------------------- | ----------------------- | --------: | ---------: |
| Hero Declared vs Demonstrated | SVG/Canvas              | 1920×1180 |   1360×800 |
| Mobile Hero                   | SVG                     | 1080×1440 | Responsive |
| Intent vs Observation Toggle  | Interactive SVG         |  1600×900 |   1000×562 |
| Declared Intent Graph         | SVG/Canvas              | 1800×1100 |   1100×672 |
| Declaration Lifecycle         | Animated SVG            | 1800×1000 |   1100×611 |
| Flow Builder                  | Interactive HTML/Canvas |         — |   1280×820 |
| Entry/Exit Boundaries         | SVG                     |  1500×700 |   1000×467 |
| Suggestion Cards              | HTML                    |         — |    360×280 |
| Accept/Reject                 | Animated UI             |  1400×800 |    900×514 |
| Whole-Flow Review             | Interactive HTML        |  1700×950 |   1100×615 |
| Ruleset Compilation           | Animated SVG            |  1600×900 |   1000×562 |
| Guided Demonstration          | Product video           | 1920×1200 |   1100×688 |
| Declared vs Demonstrated      | SVG                     |  1600×900 |   1000×562 |
| Reconciliation Matrix         | Animated SVG            |  1500×850 |    960×544 |
| Reconciliation Explorer       | Interactive HTML/Canvas |         — |   1280×800 |
| Promotion Interaction         | Animated UI             |  1500×850 |    900×510 |
| Provenance Inspector          | HTML                    |         — |    720×460 |
| Flow Versioning               | SVG                     |  1500×700 |   1000×467 |
| Optional Declaration Paths    | SVG                     |  1600×800 |   1000×500 |
| Document → Intent Draft       | Animated SVG            |  1600×900 |   1000×562 |
| Reconciliation Product Video  | Video                   | 1920×1200 |   1000×625 |
| Reconciliation Report         | Report UI               | 1000×1280 |    600×768 |

Approximately **22 visual surfaces**, but they reduce to a much smaller number of reusable components.

---

# 76. Reusable architecture

Do not build another isolated graph system.

Extend your existing graph renderer:

```tsx
<BehaviorGraph
  graphType="DECLARED"
  nodes={nodes}
  edges={edges}
/>
```

Then support:

```ts
type GraphType =
  | "DECLARED"
  | "DEMONSTRATED"
  | "PRODUCTION";
```

`PRODUCTION` remains later-phase product functionality, but keeping the rendering abstraction compatible is worthwhile.

---

# 77. Core component architecture

Suggested:

```tsx
<FlowDeclarationPage>
  <FlowDeclarationHero />

  <IntentVsObservation />

  <DeclaredGraphOverview />

  <DeclarationLifecycle />

  <FlowBuilder />

  <SuggestionEngineDemo />

  <WholeFlowReview />

  <RulesetExplanation />

  <GuidedDemonstrationVideo />

  <ReconciliationExplorer />

  <ProvenanceSection />

  <DeclarationVersioning />

  <OptionalitySection />

  <IntentDraftSection />

  <AssistiveIntelligenceBoundary />

  <FAQ />

  <FinalCTA />
</FlowDeclarationPage>
```

Product components:

```tsx
<DeclaredFlowCanvas />
<FlowStateNode />
<FlowTransition />
<SuggestionQueue />
<SuggestionCard />
<FlowReview />
<ProvenanceBadge />
<RulesetSummary />
<ReconciliationGraph />
<ReconciliationInspector />
```

---

# 78. Suggested frontend flow model

Conceptually:

```ts
interface DeclaredFlow {
  id: string;
  applicationId: string;

  name: string;

  status:
    | "DRAFT"
    | "COMPLETE";

  version: number;

  states: DeclaredState[];
  transitions: DeclaredTransition[];

  entryStateIds: string[];
  terminalStateIds: string[];

  createdAt: string;
  updatedAt: string;
}
```

State:

```ts
interface DeclaredState {
  id: string;
  name: string;

  category:
    | "NAVIGATION"
    | "UI"
    | "BUSINESS"
    | "ERROR"
    | "SYSTEM";

  provenance:
    | "USER_AUTHORED"
    | "SUGGESTED_ACCEPTED"
    | "DEMONSTRATION_PROMOTED";
}
```

These provenance types are directly aligned with the graph specification. 

---

# 79. Suggestion model

Conceptually:

```ts
interface FlowSuggestion {
  id: string;

  parentStateId: string;

  suggestedStateName: string;

  category: string;

  sourceTier:
    | "INTERNAL_LIBRARY"
    | "CROSS_TENANT"
    | "ASSISTIVE_ENRICHMENT";

  rationale: string;

  status:
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED";
}
```

This closely mirrors the actual suggestion output model defined in the specification. 

---

# 80. Reconciliation model

Conceptually:

```ts
type ReconciliationStatus =
  | "CONFIRMED"
  | "TRUE_GAP"
  | "UNDECLARED";
```

This should be a shared status model across:

```text
Flow Declaration
Demonstration results
Coverage
Reports
Dashboard
```

---

# 81. API alignment

The current API architecture already contains dedicated groups for:

```text
declared flows
suggestion generation
accept/reject
whole-flow preview
apply selected suggestions
intent drafts
reconciliation
compiled ruleset
```

and the public/desktop API versions explicitly distinguish independently released consumers. 

Suggestion APIs include explicit accept/reject calls and do not permit automatic addition without an acceptance action. 

That maps cleanly to the website interaction model above.

---

# 82. Suggested navigation inside the actual product

Flow Declaration probably deserves its own dashboard area:

```text
Application

Overview
Demonstrations
Behavior Graph
Coverage
Flows
Reports
Endpoints
```

Inside:

```text
Flows
├── Declared
├── Discovered
└── Reconciliation
```

or:

```text
Intent
├── Declared Flows
├── Suggestions
├── Ruleset
└── Reconciliation
```

I prefer **Flows** publicly, with the tab:

```text
Declared | Observed | Reconciliation
```

because "Intent" may feel abstract to new users.

---

# 83. Visual status language

Use clear labels:

```text
DECLARED
Outlined node

OBSERVED
Solid node

CONFIRMED
Solid + check

TRUE GAP
Dashed + gap badge

UNDECLARED
Solid + plus/review badge

SUGGESTED
Dashed + suggestion badge
```

Do not rely on color alone.

---

# 84. Motion language

The animation vocabulary should be:

```text
declare
suggest
accept
compare
confirm
surface
promote
```

Good motion:

```text
user-created node appears
suggested branch fades in dashed
accepted suggestion becomes declared
observed graph builds beside declaration
matching nodes connect
true gap stays unresolved
undeclared node enters review
```

Avoid:

```text
AI sparkles
random graph physics
glowing neural networks
magic auto-completion
```

The strongest quality of this feature is **explicit human control**.

---

# 85. Accessibility

Every flow builder needs:

```text
Graph
List
```

List view:

```text
CHECKOUT

ENTRY
Product View

1. Product View
   → Add to Cart

2. Cart
   → Start Checkout

3. Checkout
   → Submit Payment

4A. Payment Success

4B. Payment Failure
    → Retry Payment
```

Suggestions should be fully keyboard accessible:

```text
Accept
Reject
Open rationale
```

Never make drag-and-drop the only way to create flow ordering.

---

# 86. Reduced motion

For:

```css
@media (prefers-reduced-motion: reduce)
```

disable:

```text
graph construction animations
suggestion branch drawing
reconciliation connector animation
promotion transitions
autoplay videos
```

Render final states immediately.

---

# 87. Responsive behavior

### Desktop ≥1280

Full graph editor + suggestion rail.

### Tablet

Graph first, suggestion panel underneath.

### Mobile

Use a state-list-first interaction:

```text
Checkout

DRAFT

Flow

1 Product View
2 Cart
3 Checkout
4 Payment Success

Suggestions
2

[ Add state ]
[ Review suggestions ]
```

Do not attempt a dense freeform graph editor at 360px.

Provide:

```text
[ Open graph view ]
```

as fullscreen when needed.

---

# 88. SEO

### Title

> **Flow Declaration — Define Intended Application Workflows | Tellann**

Alternative:

> **Declare Application Workflows & Reconcile Behavior | Tellann**

### Meta description

> Define the workflows your application is intended to support, review suggested failure and edge-case branches, and let Tellann reconcile declared intent against demonstrated behavior.

---

# 89. Recommended heading hierarchy

```text
H1
Define what should happen before you measure what did.

H2
Tellann keeps intent and evidence separate.

H2
A declared flow describes behavior the team expects the application to support.

H2
Multiple declared flows become the application's intent map.

H2
Build the flow one meaningful state at a time.

H2
Tell Tellann where meaningful behavior begins and ends.

H2
Declare the main path. Let Tellann help you think about the branches.

H2
Suggestions never become intent without your approval.

H2
Review the entire flow before applying changes.

H2
Build intended behavior without turning Tellann into a diagramming chore.

H2
Intent stays a draft until the team says it is ready.

H2
Completed intent becomes something Tellann can evaluate against.

H2
Declared intent turns Demonstration Mode into a guided validation walkthrough.

H2
Intent becomes meaningful when it meets evidence.

H2
Tellann compares what should happen with what actually happened.

H2
Observed something you forgot to declare? Add it—with confirmation.

H2
Tellann remembers where declared intent came from.

H2
Intent changes. The declared model can change with it.

H2
Declare what matters—or let Tellann begin with observation alone.

H2
Already documented the flow somewhere else? Start from that intent.

H2
Assistance can propose. Evidence and humans decide.

H2
Define the baseline. Then demonstrate the evidence.
```

---

# 90. Analytics instrumentation

Track:

```text
flow_declaration_hero_interacted

flow_declaration_demo_started

declared_flow_state_added

declared_flow_transition_added

declared_flow_suggestion_opened

declared_flow_suggestion_accepted

declared_flow_suggestion_rejected

declared_flow_review_started

declared_flow_review_applied

declared_flow_saved

declared_flow_completed

declared_flow_reopened

reconciliation_filter_selected

reconciliation_item_selected

undeclared_state_promotion_clicked

intent_draft_section_viewed

flow_declaration_demonstration_clicked

flow_declaration_signup_clicked
```

Useful properties:

```json
{
  "flow": "checkout",
  "suggestionSource": "INTERNAL_LIBRARY",
  "stateCategory": "ERROR",
  "action": "suggestion_accepted"
}
```

---

# 91. Three public-copy rules I would enforce

**First: never say Tellann automatically changes declared intent.** Suggestions and demonstration-time promotions require explicit human approval. 

**Second: never collapse declared and observed behavior into one graph concept.** They are deliberately separate models and reconciliation is a derived comparison. 

**Third: never imply Flow Declaration is required to use Tellann.** It is optional; Tellann must still work using observed behavior alone. 

These are core product truths, not just wording preferences.

---

# 92. One update required to previous website pages

Because the project specification has evolved, several already-planned pages should be lightly revised.

The old simplified story often said:

```text
Tellann requires no manual workflow modeling.
```

Replace that everywhere with:

> **Tellann can discover application behavior without requiring a manually modeled workflow. When teams want an explicit expected baseline, Flow Declaration lets them define intent and reconcile it against observed behavior.**

Specifically update:

```text
/product
/product/how-it-works
/product/demonstration-mode
/product/workflow-discovery
/product/behavior-graphs
/product/coverage
/product/missing-states
/product/missing-flows
/product/qa-reports
```

This prevents Flow Declaration from appearing to contradict the rest of the website.

---

# 93. Another update: QA Reports

Your `/product/qa-reports` specification should now include an **eighth Phase 1 reporting surface**:

```text
FLOW RECONCILIATION REPORT
```

alongside:

```text
Executive Quality
Flow Coverage
Behavioral Graph
Missing Flow
Missing State
Session Analysis
Endpoint Intelligence
```

The graph specification explicitly records the Reconciliation Report as added to the reporting model. 

---

# 94. Highest-priority assets to build

If implementing this route gradually, prioritize:

1. **Hero Declared vs Demonstrated reconciliation graph**
2. **Interactive Flow Builder**
3. **Suggestion review UI**
4. **Guided Demonstration video**
5. **Reconciliation Explorer**
6. **Ruleset compilation visual**
7. **Optional declaration vs observation-only diagram**
8. **Reconciliation Report preview**

Those eight assets communicate almost the entire value proposition.

---

# 95. Final CTA

### Eyebrow

```text
DEFINE THE INTENT
```

### H2

> **Tell Tellann what should happen. Then prove it with behavior.**

Supporting copy:

> Declare the workflows that matter, review the branches worth validating, and use your next demonstration to see what was confirmed, what was never reached, and what happened that nobody declared.

Buttons:

```text
[ Start free ]
[ Explore Demonstration Mode ]
```

Optional contextual:

```text
Explore Behavior Graphs →
```

---

# 96. Final visitor journey

The visitor should reach the bottom thinking:

```text
My application should support Checkout.

        ↓

I declare:

Product
Cart
Checkout
Payment Success
Payment Failure
Retry

        ↓

Tellann suggests:

Session Timeout

        ↓

I review it.

        ↓

I decide it applies.

        ↓

I accept it.

        ↓

The flow becomes complete.

        ↓

Tellann compiles the application's ruleset.

        ↓

I start a Guided Demonstration.

        ↓

I demonstrate:

Product
Cart
Checkout
Payment Success

        ↓

Tellann compares the demonstration
against my declaration.

        ↓

Payment Success
CONFIRMED

        ↓

Payment Failure
TRUE GAP

        ↓

Retry
TRUE GAP

        ↓

Promo Code Rejected
UNDECLARED

        ↓

I inspect the undeclared behavior.

        ↓

It is legitimate.

        ↓

I promote it into declared intent.

        ↓

The intent model evolves.

        ↓

I now have something much stronger than
"Tellann did not see this."

I have:

"We said this should exist,
and the evidence did—or did not—confirm it."
```

That is what `/product/flow-declaration` should represent in Tellann: **the bridge between human intent and observed software behavior**. It gives teams an explicit, versioned, human-controlled definition of what matters, while preserving Tellann's ability to discover behavior independently. The value does not come from drawing workflows; it comes from what happens afterward—**guided demonstration, evidence-backed reconciliation, stronger coverage semantics, explainable gaps, and a clear separation between what the team expected and what the software actually did.**  
