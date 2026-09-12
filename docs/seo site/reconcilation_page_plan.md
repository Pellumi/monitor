# `/product/reconciliation` — SEO Marketing Page Specification

For `/product/reconciliation`, I would make one important change from several of the deeper product pages we have designed:

**this page should not feel like documentation.**

A visitor should understand the feature within the first 15–20 seconds without knowing what a graph, telemetry event, state transition, or reconciliation engine is.

The core message should simply be:

> **Compare what your software is supposed to do with what it actually did.**

That is the commercial value of Reconciliation.

Tellann maintains a human-declared model of intended behavior alongside a model built from observed evidence. Reconciliation compares the two and classifies behavior as **Confirmed**, **True Gap**, or **Undeclared**. 

---

# 1. What this page should sell

The user should not initially be presented with:

```text
Declared Intent Graph
Observed Behavior Graph
FDRS
Reconciliation Engine
Graph provenance
Ruleset compilation
```

Those concepts matter in the product, but they are not the opening marketing message.

Instead:

```text
YOU SAID

Checkout should support:

Success
Payment failure
Retry

            ↓

TELLANN OBSERVED

Success

            ↓

TELLANN SHOWS YOU

✓ Success was confirmed

○ Payment failure was never reached

○ Retry was never reached

+ A promo-code rejection happened
  that nobody declared
```

Then introduce the formal terminology:

```text
CONFIRMED
TRUE GAP
UNDECLARED
```

The product specification defines exactly these three reconciliation outcomes. 

---

# 2. Primary SEO positioning

The page should rank conceptually around terms such as:

```text
application workflow validation
software workflow verification
behavioral QA
declared vs observed behavior
workflow coverage gaps
application behavior analysis
software QA workflow analysis
expected vs actual software behavior
QA reconciliation
workflow testing visibility
```

Do **not** optimize around generic:

```text
data reconciliation
financial reconciliation
database reconciliation
account reconciliation
```

because those are unrelated search intents.

Every SEO signal should anchor reconciliation to:

```text
software
QA
workflows
application behavior
testing
```

---

# 3. Recommended page title

### Primary

> **Software Workflow Reconciliation — Compare Expected vs Actual Behavior | Tellann**

Alternative:

> **Application Behavior Reconciliation for QA | Tellann**

I prefer the first because a visitor can understand it without already knowing Tellann's category.

---

# 4. Meta description

> Compare intended software workflows with observed application behavior. Tellann shows what was confirmed, what expected behavior was never reached, and what happened that nobody declared.

This is short, clear, and covers the three reconciliation outcomes.

---

# 5. Page architecture

I would make the marketing page approximately:

```text
/product/reconciliation
│
├── 01 Global Navigation
├── 02 Hero
├── 03 The Problem
├── 04 Reconciliation in One Picture
├── 05 Three Outcomes
├── 06 How It Works
├── 07 Benefits by Role
│   ├── Developers
│   ├── QA Engineers
│   ├── Engineering Managers
│   └── Product Managers
├── 08 Declared vs Observed Example
├── 09 Interactive Reconciliation Explorer
├── 10 True Gaps
├── 11 Undeclared Behavior
├── 12 Evidence Behind Every Result
├── 13 Reconciliation + Demonstration Mode
├── 14 Reconciliation Over Multiple Runs
├── 15 Flow Reconciliation Report
├── 16 Human Intent Stays in Control
├── 17 Reconciliation Without Flow Declaration
├── 18 Reconciliation vs Other Tellann Analysis
├── 19 Common Use Cases
├── 20 Product Evolution
├── 21 FAQ
├── 22 Final CTA
└── 23 Footer
```

That is enough depth for SEO without turning the page into a technical specification.

---

# 6. Hero

### Eyebrow

```text
WORKFLOW RECONCILIATION
```

### H1

> **Compare what your software should do with what it actually did.**

This should absolutely be the primary headline.

It is far more understandable than:

> Reconcile Declared Intent Graphs against Observed Behavior Graphs.

### Supporting copy

> Tellann compares the workflows your team expects with the behavior captured during a demonstration—showing what was confirmed, what was never reached, and what happened that nobody declared.

This directly reflects Phase 1's model: teams declare intended flows, demonstrate the application, and receive reconciliation between intent and observation. 

### CTAs

Primary:

```text
[ See reconciliation in action ]
```

Secondary:

```text
[ Explore Flow Declaration → ]
```

Tertiary text link:

```text
How Tellann works →
```

---

# 7. Hero layout

Do not use a 50/50 text/image hero.

Use:

```text
                EYEBROW

                  H1

            Supporting copy

        [ CTA ]      [ CTA ]

                  ↓
                48px

     FULL-WIDTH RECONCILIATION VISUAL
```

### Container

```text
max-width: 1280px
```

Hero graphic:

```text
max-width: 1320px
```

You can allow the visual to slightly exceed the main text container.

---

# 8. Hero visual

Use three columns:

```text
WHAT SHOULD HAPPEN        WHAT HAPPENED          RESULT

Checkout                   Checkout
   │                          │
   ▼                          ▼
Payment Pending            Payment Pending
  /  \                         │
 /    \                        ▼
▼      ▼                  Payment Success
Success Failure
         │
         ▼
       Retry
```

Then reconciliation labels resolve:

```text
Payment Pending      CONFIRMED

Payment Success      CONFIRMED

Payment Failure      TRUE GAP

Retry                TRUE GAP
```

Then an extra observed node appears:

```text
Promo Rejected       UNDECLARED
```

---

# 9. Hero animation dimensions

Use SVG/Canvas/HTML.

### Design canvas

```text
1920 × 1120
```

### Desktop display

```text
width: min(1320px, calc(100vw - 64px))
height: 700–760px
```

### Tablet

```text
960 × ~650px
```

### Mobile master

```text
1080 × 1440
```

Mobile should reorganize vertically:

```text
EXPECTED

[ graph ]

     ↓

OBSERVED

[ graph ]

     ↓

RESULT

✓ Confirmed  2
○ True gaps 2
+ Undeclared 1
```

---

# 10. Hero animation sequence

Duration:

```text
9–11 seconds
```

Sequence:

```text
0–2s
Expected Checkout workflow draws.

2–4s
Observed Checkout workflow appears.

4–6s
Matching states connect.

6–7s
Confirmed states receive ✓.

7–8s
Payment Failure and Retry receive
TRUE GAP.

8–9s
Promo Rejected appears.

9–10s
UNDECLARED resolves.

10–11s
Summary:
2 Confirmed · 2 True Gaps · 1 Undeclared
```

Then **stop**.

Let users interact afterward.

Do not continuously repeat it.

---

# 11. Section — Explain the problem first

### H2

> **Teams know what software is supposed to do. But that is not always what the software actually does.**

Supporting copy:

> Product requirements describe expected behavior. QA plans describe the scenarios that matter. Developers implement those flows. But until the application is exercised, there is still a gap between intention and evidence.

Then:

```text
EXPECTED

Customer can:
✓ Add to cart
✓ Pay
✓ Handle payment failure
✓ Retry

                vs

OBSERVED

Customer:
✓ Added to cart
✓ Paid successfully
? Payment failure never occurred
? Retry never occurred
```

This turns reconciliation into a very familiar problem.

---

# 12. Problem visual

Do not use a product screenshot here.

Use a simple marketing diagram.

### Master

```text
1600 × 800
```

### Display

```text
1000 × 500
```

Layout:

```text
Expected workflow
      ↘
       Comparison
      ↗
Observed workflow
```

Minimal animation:

```text
Expected slides from left.
Observed slides from right.
Result appears center.
```

Duration:

```text
4–5 seconds
```

---

# 13. Reconciliation in one picture

### H2

> **Tellann gives you one answer for every expected and observed behavior.**

Then the three outcomes:

```text
✓ CONFIRMED

You expected it.
Tellann saw it.


○ TRUE GAP

You expected it.
Tellann never saw it.


+ UNDECLARED

Tellann saw it.
Nobody declared it.
```

This is the simplest explanation of the feature.

These categories map directly to Tellann's formal three-way reconciliation model. 

---

# 14. Outcome cards

Use three large cards.

Desktop:

```text
3 columns
```

Card dimensions:

```text
380 × 320px
```

Gap:

```text
24px
```

### Confirmed card

```text
✓ CONFIRMED

Expected
Payment Success

Observed
Payment Success

Your expectation is backed
by behavioral evidence.
```

### True Gap card

```text
○ TRUE GAP

Expected
Payment Failure

Observed
—

An expected part of the workflow
was never reached.
```

### Undeclared card

```text
+ UNDECLARED

Expected
—

Observed
Promo Rejected

The application did something
that was not part of the declared flow.
```

---

# 15. Very important terminology rule

On the SEO marketing page, use:

```text
TRUE GAP

Expected behavior that
was never observed.
```

before introducing:

```text
Declared but not observed.
```

The first is understandable.

The second is product terminology.

Likewise:

```text
UNDECLARED

Behavior Tellann observed
that was not part of your declared flow.
```

Don't assume visitors understand "undeclared state."

---

# 16. Section — How it works

### H2

> **From intention to evidence in four steps.**

Use just four steps.

### Step 1 — Define

```text
Define the workflow that matters.
```

Example:

```text
Checkout
Success
Payment Failure
Retry
```

### Step 2 — Demonstrate

```text
Use your application normally
through Tellann's demonstration environment.
```

### Step 3 — Observe

```text
Tellann builds the behavior it actually witnessed.
```

### Step 4 — Reconcile

```text
Tellann compares both models and
shows confirmed behavior, true gaps
and undeclared behavior.
```

This follows the Phase 1 adoption sequence in the PRD. 

---

# 17. Four-step media

Use one continuous horizontal animation.

### Master

```text
1800 × 700
```

### Display

```text
1100 × 428
```

Sequence:

```text
DECLARE
  ↓
DEMONSTRATE
  ↓
OBSERVE
  ↓
RECONCILE
```

On mobile:

```text
DECLARE
   │
   ▼
DEMONSTRATE
   │
   ▼
OBSERVE
   │
   ▼
RECONCILE
```

Do not show infrastructure.

---

# 18. Most important marketing section — Benefits by role

### H2

> **One comparison. Different answers for every team.**

This should be one of the largest sections because the user specifically wants visitors to understand the benefit **depending on their class**.

The formal Tellann user roles are:

* Developer
* QA Engineer
* Engineering Manager
* Product Manager. 

Use role tabs:

```text
[ Developers ]
[ QA Engineers ]
[ Engineering Leaders ]
[ Product Teams ]
```

---

# 19. Developers

### Tab heading

> **For developers — know when implementation differs from intent.**

Core problem:

> A successful happy path does not tell a developer whether every intended branch can actually be reached.

Show:

```text
Expected

Checkout
├── Success
├── Payment Failure
└── Retry


Observed

Checkout
└── Success


Tellann

Payment Failure     TRUE GAP
Retry               TRUE GAP
```

### Benefits

Keep the website language practical:

**Find expected behavior that never appeared.** See states and transitions your team explicitly expected but the demonstration never reached.

**Spot unexpected behavior.** Surface observed behavior that was never part of the intended workflow.

**Jump from a result to evidence.** Move from reconciliation into the relevant Behavior Graph, session, or replay instead of reproducing behavior from scratch.

**Separate implementation issues from specification issues.** An undeclared behavior might represent unexpected code—or simply intent that nobody documented.

The PRD defines software engineers as users needing visibility into failures, regressions, and workflow behavior. 

### CTA

```text
[ Explore Behavior Graphs → ]
```

---

# 20. Developer visual

Do not show a managerial dashboard.

Show a detailed graph comparison.

### Master

```text
1600 × 900
```

### Display

```text
900 × 506
```

Layout:

```text
Declared graph    Observed graph

          ↓

selected:
PAYMENT_FAILURE

TRUE GAP

[ View evidence ]
```

---

# 21. QA Engineers

### Tab heading

> **For QA — know exactly which expected scenarios still lack evidence.**

This is probably the strongest persona for the feature.

The formal QA role is responsible for application-quality validation and coverage review. 

Key benefits:

**Turn requirements into an evidence baseline.**

Instead of asking:

> “Did we remember to test everything?”

QA can ask:

> “Which expected paths have behavioral evidence?”

**Distinguish inferred gaps from explicit gaps.**

This is crucial.

A Tellann Missing State might say:

```text
Payment Failure may be worth testing.
```

Reconciliation can say:

```text
Your team explicitly declared
Payment Failure.

It was never observed.

TRUE GAP.
```

The specification explicitly treats this as a stronger signal than ordinary missing-state/flow inference because a human asserted that the behavior should be reachable. 

**Prioritize the next demonstration.**

```text
TRUE GAPS

Payment Failure
Session Timeout
Retry Payment
```

becomes a practical checklist.

**Reduce manual comparison between requirements and walkthrough results.**

---

# 22. QA visual

Use a reconciliation checklist:

```text
CHECKOUT RECONCILIATION

11 Confirmed
3 True Gaps
2 Undeclared


✓ Add to Cart
✓ Checkout
✓ Payment Success

○ Payment Failure
○ Session Timeout
○ Retry Payment

+ Promo Rejected
+ Cart Merge
```

Master:

```text
1440 × 900
```

Display:

```text
800 × 500
```

This should feel immediately useful to QA.

---

# 23. Engineering Managers

### Tab heading

> **For engineering leaders — get a clearer view of pre-production quality risk.**

Do **not** frame this as Phase 3 release validation.

Keep it within Phase 1:

> Before shipping, understand whether important declared workflows were actually exercised in your QA demonstration.

The formal engineering-manager role needs visibility into software quality and release readiness. 

Benefits:

**Get an overview without inspecting raw sessions.**

```text
Checkout

Declared       14
Confirmed      11
True Gaps       3
Undeclared      2
```

**Identify critical workflows with unresolved expected behavior.**

**See where QA effort should go next.**

**Ask better release questions.**

Instead of:

> “Did QA finish?”

Ask:

> “Which declared Checkout behaviors still have no evidence?”

That is strong marketing language for this persona.

---

# 24. Engineering leader visual

Use a high-level summary—not the full graph.

```text
CHECKOUT

73%
Declared behavior confirmed

11  Confirmed
3   True Gaps
2   Undeclared


Needs review

Payment Failure
Session Timeout
Retry Payment
```

Important: don't publish the `73%` unless it is genuinely derived from current product semantics. Safer public demo:

```text
11 of 14 declared states confirmed
```

This is clearer and harder to misinterpret.

### Dimensions

```text
Master: 1400 × 850
Display: 800 × 486
```

---

# 25. Product Managers

### Tab heading

> **For product teams — verify that implemented behavior still matches product intent.**

The formal Product Manager role is oriented toward workflow performance and user behavior. 

Benefits:

**Make intended product behavior explicit.**

A PM can help establish:

```text
User can:
Purchase
Fail payment gracefully
Retry
Cancel
```

**Discover behavior nobody specified.**

`UNDECLARED` is especially useful here.

Example:

```text
PROMO_CODE_REJECTED

Observed 4 times

Not in declared Checkout flow
```

Questions:

```text
Is this expected?

Did requirements miss it?

Is the application doing something unintended?

Should this become part of the declared flow?
```

**Keep product intent and implementation connected.**

**Review what should be promoted into the expected workflow.**

Observed-but-undeclared behavior can be reviewed and, with explicit human confirmation, promoted to declared intent. 

---

# 26. Product team visual

Use:

```text
UNDECLARED BEHAVIOR

Promo Code Rejected

Observed
4 times

Workflow
Checkout

Not present in intended flow

[ Expected behavior ]
[ Leave undeclared ]
```

### Dimensions

```text
Master: 1400 × 850
Display: 800 × 486
```

---

# 27. Role switcher implementation

Desktop:

```text
Developers | QA | Engineering Leaders | Product Teams
```

Content below:

```text
┌─────────────────┬──────────────────────┐
│ copy            │ persona-specific     │
│                 │ product visual       │
│ 5 cols          │ 7 cols               │
└─────────────────┴──────────────────────┘
```

Minimum section height:

```text
620–680px
```

Do not make the content change section height dramatically when switching tabs.

Mobile:

```text
Who are you?

[ QA Engineer ▾ ]
```

Then show one persona at a time.

---

# 28. Optional secondary-audience strip

Under the four primary personas, include smaller cards for Tellann's secondary target classes:

```text
STARTUP TEAMS

Get stronger QA visibility without
building a large QA operation.


SAAS TEAMS

Keep changing workflows aligned with
the behavior your team expects.


ENTERPRISE TEAMS

Review intended and demonstrated
behavior across complex applications.
```

The PRD explicitly identifies startup teams, SaaS businesses, and enterprise organizations as secondary users. 

Keep this section compact.

---

# 29. Section — A realistic example

### H2

> **See reconciliation through one Checkout workflow.**

Use one example throughout the page rather than constantly changing domains.

### Declared

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
   ↓
PAYMENT
 ↙      ↘
SUCCESS  FAILURE
           ↓
         RETRY
```

### Demonstrated

```text
PRODUCT
   ↓
CART
   ↓
CHECKOUT
   ↓
PAYMENT
   ↓
SUCCESS

        +
PROMO_REJECTED
```

### Result

```text
CONFIRMED

Product
Cart
Checkout
Payment
Success


TRUE GAPS

Payment Failure
Retry


UNDECLARED

Promo Rejected
```

---

# 30. Example animation

### Master

```text
1800 × 1000
```

### Display

```text
1100 × 611
```

Duration:

```text
8 seconds
```

The visitor can then toggle:

```text
[ Expected ]
[ Observed ]
[ Reconciled ]
```

This toggle is especially good for SEO-page engagement.

---

# 31. Interactive Reconciliation Explorer

### H2

> **Go from summary to the exact behavior that needs attention.**

This is the main product demo on the page.

But keep it simpler than the actual dashboard.

Desktop:

```text
┌────────────────────────────────────────────────────────┐
│ Checkout                                               │
│                                                        │
│ 11 Confirmed     3 True Gaps     2 Undeclared        │
├──────────────────┬─────────────────────────────────────┤
│                  │                                     │
│ FILTER           │        RECONCILED WORKFLOW          │
│                  │                                     │
│ All              │                                     │
│ Confirmed        │                                     │
│ True Gaps        │                                     │
│ Undeclared       │                                     │
│                  │                                     │
├──────────────────┴─────────────────────────────────────┤
│ Payment Failure · TRUE GAP                            │
│ Expected but not observed                             │
└────────────────────────────────────────────────────────┘
```

---

# 32. Explorer dimensions

Desktop:

```text
1280 × 800px
```

Outer page container:

```text
max-width: 1400px
```

Tablet:

```text
960 × 720px
```

Mobile:

```text
Workflow
↓
Summary
↓
Filter chips
↓
Finding card
↓
Mini graph
```

---

# 33. Explorer interactions

Click:

```text
TRUE GAPS
```

Graph filters.

Then select:

```text
PAYMENT_FAILURE
```

Show:

```text
PAYMENT FAILURE

TRUE GAP

Your team declared this behavior.

Tellann did not observe it
during the selected demonstration.

Declared origin
Team authored

[ View expected flow ]

[ View related session ]
```

Notice how user-friendly the copy is.

Don't lead with:

```text
provenance = USER_AUTHORED
```

until a technical details drawer.

---

# 34. True Gap marketing section

### H2

> **Know when “we didn't see it” becomes “we expected this and never saw it.”**

This is probably the feature's biggest differentiator.

Explain:

```text
MISSING STATE

Tellann thinks this state may
be worth exercising.


TRUE GAP

Your team explicitly said this
state should be reachable—
but it was never observed.
```

That distinction is strongly supported by the reconciliation specification. 

---

# 35. True Gap visual

Use side-by-side cards:

```text
POTENTIAL GAP

Payment Failure
Suggested by Tellann


TRUE GAP

Payment Failure
Declared by your team
Not observed
```

Dimensions:

```text
1600 × 700 master
1000 × 438 display
```

This also naturally links:

```text
Explore Missing States →
Explore Missing Flows →
```

---

# 36. Undeclared Behavior section

### H2

> **Discover behavior your team never specified.**

This should feel intriguing, not alarming.

Example:

```text
CHECKOUT

Expected

Payment Success
Payment Failure


Observed

Payment Success
Promo Rejected
```

Then:

```text
PROMO_REJECTED

UNDECLARED

Observed
4 times
```

Copy:

> Undeclared does not automatically mean wrong. It tells your team there is behavior worth reviewing.

The specification explicitly says undeclared behavior may represent an incomplete declaration, legitimate forgotten behavior, an unintended code path, or other emergent behavior, and should not be treated as an error by default. 

---

# 37. Review interaction

Use:

```text
This behavior wasn't declared.

Is it expected?

[ Yes, add to intent ]
[ Leave undeclared ]
```

This maps directly to the human-confirmed promotion workflow. 

---

# 38. Evidence section

### H2

> **Reconciliation doesn't stop at a label. Follow the result back to evidence.**

Visual chain:

```text
TRUE GAP

Payment Failure

        ↓

Declared Checkout Flow

        ↓

Observed Checkout Run

        ↓

Behavior Graph

        ↓

Related Sessions

        ↓

Session Replay
```

Tellann's broader product requirements emphasize evidence attribution and deterministic analytical output rather than quality judgements produced by model output. 

---

# 39. Evidence trace video

This should be one of only two major videos.

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
8–10 seconds
```

Sequence:

```text
Open reconciliation
↓
Select True Gap
↓
Open observed run
↓
Session timeline
↓
Behavior Graph
↓
return to finding
```

This communicates trust much better than another decorative animation.

---

# 40. Reconciliation + Demonstration Mode

### H2

> **One demonstration can turn intent into evidence.**

Sequence:

```text
Declare Checkout
        ↓
Start Guided Demonstration
        ↓
Use Checkout
        ↓
Tellann builds observed behavior
        ↓
Reconcile
```

Phase 1 requires only a demonstration as its evidence basis. 

---

# 41. Main product video

This should be the page's flagship recording.

### Sequence

```text
1. Open declared Checkout flow.
2. Start Guided Demonstration.
3. Developer completes Checkout success.
4. Stop demonstration.
5. Processing completes.
6. Open Reconciliation.
7. Confirmed appears.
8. True Gaps appear.
9. Undeclared behavior appears.
```

### Duration

```text
12–15 seconds
```

### Master

```text
1920 × 1200
```

### Display

```text
1100 × 688
```

Placement:

```text
Centered below section heading.
```

Use a poster showing the final reconciliation state.

---

# 42. Multiple runs

### H2

> **Run it again. Reconciliation updates as the evidence grows.**

The PRD explicitly says returning usage involves another demonstration and incremental reconciliation. 

Example:

```text
RUN 1

Confirmed        8
True Gaps        5
Undeclared       1

        ↓

RUN 2

Demonstrate Payment Failure

        ↓

Confirmed        10
True Gaps         3
Undeclared        1
```

Don't make the marketing section about internal incremental algorithms.

The user benefit is:

> **Each new demonstration can turn previously unresolved intent into evidence.**

---

# 43. Multi-run visual

Use an animated before/after.

### Master

```text
1600 × 900
```

### Display

```text
1000 × 562
```

Duration:

```text
6–7 seconds
```

Use:

```text
Run 1
→
Run 2
```

with newly confirmed nodes becoming solid.

---

# 44. Flow Reconciliation Report

### H2

> **Share the result without making everyone open the graph.**

Example:

```text
FLOW RECONCILIATION REPORT

Workflow
Checkout


Declared States
14

Observed States
12


Confirmed
11

True Gaps
3

Undeclared
2


TRUE GAPS

Payment Failure
Session Timeout
Retry Payment


UNDECLARED

Promo Code Rejected
Cart Merge
```

This report type is explicitly part of Tellann's reconciliation specification. 

---

# 45. Report audience framing

This is another great place to reinforce personas.

```text
DEVELOPER

Which expected states
never appeared?


QA ENGINEER

Which scenarios still
need evidence?


ENGINEERING LEAD

Which important flows
remain unresolved?


PRODUCT MANAGER

Which observed behaviors
weren't part of intent?
```

This makes the report feel cross-functional.

---

# 46. Report dimensions

Master:

```text
1000 × 1280
```

Display:

```text
600 × 768
```

Desktop section:

```text
Copy                   Report
5 columns              7 columns
```

Mobile:

```text
Summary cards
↓
Top findings
↓
[ View full report ]
```

---

# 47. Human control section

### H2

> **Tellann compares intent. It doesn't rewrite it.**

Keep this very clear.

```text
OBSERVED BEHAVIOR

may reveal something new.

        ↓

Tellann asks

"Is this expected?"

        ↓

YOU DECIDE

Add it
or
leave it undeclared.
```

User-authored declarations cannot be overwritten automatically by conflicting observed evidence; the conflict is surfaced for review. 

---

# 48. AI positioning

This should be only a small trust callout, not an AI marketing section.

Recommended copy:

> **Reconciliation is based on behavioral evidence—not a model guessing whether your software is correct.**

Supporting:

> Tellann can use assistive intelligence when helping teams draft intent, but behavioral graphs, coverage, reconciliation, findings, and endpoint analysis are computed from recorded evidence. 

That's a very strong trust message.

---

# 49. Optionality section

### H2

> **Don't want to declare flows first? Tellann can still observe your application.**

This matters because reconciliation depends on declared intent, but the overall platform doesn't.

Explain:

```text
WITH DECLARATION

Intent
+
Observation
=
Reconciliation


WITHOUT DECLARATION

Observation
=
Behavior Graph
Coverage
Missing States
Missing Flows
```

Flow Declaration is optional at the application level; observed-behavior analysis continues to function without a Declared Intent Graph. 

CTA:

```text
Explore Workflow Discovery →
```

---

# 50. Reconciliation vs other analysis

This section is excellent for SEO/internal linking.

### H2

> **Reconciliation answers a different question from Tellann's other analysis tools.**

| Capability         | Question                                                           |
| ------------------ | ------------------------------------------------------------------ |
| Workflow Discovery | What workflows did Tellann observe?                                |
| Coverage           | How much behavior was exercised?                                   |
| Missing States     | Which conditions may deserve testing?                              |
| Missing Flows      | Which paths may deserve testing?                                   |
| **Reconciliation** | **Did observed behavior match what the team explicitly expected?** |

This helps visitors understand why the route exists separately.

---

# 51. Internal links

Use contextual links throughout the page:

```text
/product/flow-declaration

/product/demonstration-mode

/product/behavior-graphs

/product/coverage

/product/missing-states

/product/missing-flows

/product/session-replay

/product/qa-reports
```

Don't dump them all into a "related features" footer.

Place them where the concepts arise.

---

# 52. Common use cases

### H2

> **Where Reconciliation becomes useful.**

Use four problem-based cards rather than technical capability cards.

### Before release

> Check whether the critical behavior your team expected was actually exercised during QA.

### New workflow

> Declare a new Checkout or Registration path, demonstrate it, and immediately see what remains unconfirmed.

### Unexpected behavior

> Surface application behavior that appeared during a walkthrough but was never part of the expected flow.

### Changing requirements

> Update intended behavior when product requirements change, then use future demonstrations against the new baseline.

---

# 53. Use-case card dimensions

Desktop:

```text
2 × 2
```

Card:

```text
560 × 300px
```

Mobile:

```text
1 column
```

Avoid illustrations here.

Use one strong micro-diagram inside each card.

---

# 54. What Reconciliation should NOT claim

Because this is a marketing page, this deserves careful enforcement.

Do not say:

```text
Tellann proves your application is correct.

Tellann guarantees release readiness.

Tellann automatically knows your requirements.

Tellann detects every bug.

Tellann automatically fixes mismatches.

Tellann uses AI to determine whether
your software is correct.

Tellann monitors real production behavior
for reconciliation today.
```

Phase 1 compares declared intent against demonstration evidence. Production comparison belongs to the next phase. 

---

# 55. Future evolution

Keep this short.

### Phase 1

```text
DECLARED
vs
DEMONSTRATED
```

### Planned Phase 2

```text
DECLARED
vs
DEMONSTRATED
vs
PRODUCTION
```

The graph architecture intentionally keeps declared, demonstrated, and later production graph types separate, enabling future comparison without overwriting either existing model. 

Marketing copy:

> **Today, reconciliation can compare what your team intended with what a QA demonstration proved. The same model is designed to extend into production behavior later.**

Label:

```text
PLANNED · PHASE 2
```

---

# 56. FAQ

Use questions that match search intent rather than internal terminology.

### What is software workflow reconciliation?

Explain expected vs observed application behavior.

### How does Tellann know what my application should do?

Through optional Flow Declaration, where the team defines intended behavior.

### What is a True Gap?

Behavior explicitly expected by the team but not observed in the selected demonstration.

### What is Undeclared behavior?

Observed behavior that was not part of the declared workflow.

### Does Undeclared mean there is a bug?

No. It requires review.

### How is Reconciliation different from coverage?

Coverage measures exercised behavior; Reconciliation compares behavior against explicit team intent.

### How is Reconciliation different from missing-state detection?

Missing-state detection may infer a potentially useful state. A True Gap comes from a human-declared expectation.

### Do I need to declare every application workflow?

No.

### Does Tellann automatically change my declared flow?

No. Human confirmation is required.

### Does Reconciliation use AI to decide whether behavior is correct?

No. Reconciliation itself is computed from declared intent and recorded evidence.

### Can I see the evidence behind a reconciliation result?

Yes—results should remain connected to the relevant behavioral model and captured run.

### Does Tellann reconcile production traffic today?

Not in Phase 1; production-aware comparison belongs to the planned production-intelligence phase.

---

# 57. FAQ structured data

Because this is a marketing/SEO page, implement:

```text
FAQPage
```

JSON-LD for genuinely visible FAQ questions.

Also:

```text
SoftwareApplication
```

schema at the site/product level if already used globally.

Do not fabricate review ratings or pricing schema just for SEO.

---

# 58. Final CTA

### Eyebrow

```text
INTENT, MEET EVIDENCE
```

### H2

> **See whether the software did what your team said it should.**

Supporting:

> Define an important workflow, demonstrate it once, and let Tellann show what was confirmed, what expected behavior was never reached, and what happened that nobody declared.

Primary:

```text
[ Start free ]
```

Secondary:

```text
[ Explore Flow Declaration ]
```

Optional:

```text
See Demonstration Mode →
```

---

# 59. Complete media inventory

| Asset                           | Type                    |    Master | Website display |
| ------------------------------- | ----------------------- | --------: | --------------: |
| Hero Expected vs Observed       | SVG/Canvas              | 1920×1120 |        1320×740 |
| Mobile Hero                     | SVG                     | 1080×1440 |      Responsive |
| Problem: Expected vs Actual     | Animated SVG            |  1600×800 |        1000×500 |
| Three Outcome Cards             | HTML/SVG                |         — |     3 × 380×320 |
| Four-Step Process               | Animated SVG            |  1800×700 |        1100×428 |
| Developer Persona Visual        | UI/SVG                  |  1600×900 |         900×506 |
| QA Persona Visual               | UI                      |  1440×900 |         800×500 |
| Engineering Leader Visual       | UI                      |  1400×850 |         800×486 |
| Product Team Visual             | UI                      |  1400×850 |         800×486 |
| Checkout Reconciliation Example | Animated SVG            | 1800×1000 |        1100×611 |
| Reconciliation Explorer         | Interactive HTML/Canvas |         — |        1280×800 |
| Potential Gap vs True Gap       | SVG                     |  1600×700 |        1000×438 |
| Undeclared Review               | HTML/UI                 |  1400×800 |         800×457 |
| Evidence Trace                  | Product video           | 1920×1200 |        1000×625 |
| Demonstration → Reconciliation  | Product video           | 1920×1200 |        1100×688 |
| Multi-Run Evolution             | Animated SVG            |  1600×900 |        1000×562 |
| Reconciliation Report           | Report UI               | 1000×1280 |         600×768 |
| Human-Control Diagram           | SVG                     |  1400×700 |         900×450 |
| Optional Declaration Diagram    | SVG                     |  1600×800 |        1000×500 |
| Phase Evolution                 | SVG                     |  1600×700 |        1000×438 |

That gives roughly **20 visual surfaces**, but most are native HTML/SVG rather than heavy media.

---

# 60. Only two actual videos

I would deliberately limit video to:

**1. Demonstration → Reconciliation**

```text
12–15 seconds
1920 × 1200 master
1100 × 688 display
```

This explains the entire feature.

**2. Finding → Evidence**

```text
8–10 seconds
1920 × 1200 master
1000 × 625 display
```

This proves that reconciliation is traceable rather than a black-box result.

Everything else should use live SVG/HTML/CSS animation.

---

# 61. Page spacing

Desktop:

```text
Hero top
140–160px

Hero → next section
160px

Major sections
140–170px

Section heading → body
20–24px

Body → media
48–56px
```

Persona section:

```text
160–180px
```

because it is strategically important.

Mobile:

```text
Major section spacing
88–104px

Text → visual
32px
```

---

# 62. Responsive strategy

Desktop:

```text
12-column
max-width: 1280px
gap: 24px
```

Interactive visual container:

```text
max-width: 1400px
```

Tablet:

```text
Copy
↓
Visual
```

Mobile:

Do not show side-by-side graphs where labels become unreadable.

Use:

```text
EXPECTED

[ mini graph ]

OBSERVED

[ mini graph ]

RESULT

✓ 11 Confirmed
○ 3 True Gaps
+ 2 Undeclared
```

---

# 63. Accessibility

All graph-based content requires a list alternative.

For example:

```text
[ Graph ] [ List ]
```

List:

```text
CONFIRMED

Product View
Cart Active
Checkout
Payment Success


TRUE GAPS

Payment Failure
Retry Payment


UNDECLARED

Promo Code Rejected
```

Never depend on:

```text
green
red
orange
```

alone.

Use:

```text
✓ Confirmed
○ True Gap
+ Undeclared
```

plus labels.

---

# 64. Reduced motion

For:

```css
@media (prefers-reduced-motion: reduce)
```

show final diagrams immediately.

Disable:

```text
graph building
node matching
connector animations
number count-ups
autoplay videos
```

Videos should use poster frames and explicit play.

---

# 65. Suggested page component tree

```tsx
<ReconciliationMarketingPage>
  <SiteHeader />

  <ReconciliationHero />

  <ProblemSection />

  <ThreeOutcomes />

  <HowReconciliationWorks />

  <AudienceBenefits>
    <DeveloperBenefit />
    <QABenefit />
    <EngineeringLeaderBenefit />
    <ProductTeamBenefit />
  </AudienceBenefits>

  <CheckoutExample />

  <ReconciliationExplorer />

  <TrueGapSection />

  <UndeclaredBehavior />

  <EvidenceTraceability />

  <DemonstrationIntegration />

  <MultiRunSection />

  <ReconciliationReport />

  <HumanControl />

  <OptionalDeclaration />

  <RelatedAnalysis />

  <UseCases />

  <PhaseEvolution />

  <FAQ />

  <FinalCTA />

  <SiteFooter />
</ReconciliationMarketingPage>
```

---

# 66. Reusable marketing data model

For persona content:

```ts
interface ReconciliationAudience {
  id:
    | "DEVELOPER"
    | "QA"
    | "ENGINEERING_LEADER"
    | "PRODUCT";

  title: string;
  headline: string;
  painPoint: string;
  benefits: string[];
  visualMode: string;
  relatedHref: string;
}
```

Do **not** hardcode four large conditional JSX blocks.

This also makes A/B testing persona messaging easier later.

---

# 67. Analytics

Track the marketing funnel rather than dashboard-like interactions.

```text
reconciliation_hero_cta_clicked

reconciliation_outcome_opened

reconciliation_role_selected

reconciliation_example_interacted

reconciliation_true_gap_opened

reconciliation_undeclared_opened

reconciliation_evidence_video_played

reconciliation_demo_video_played

reconciliation_report_viewed

reconciliation_flow_declaration_clicked

reconciliation_demonstration_clicked

reconciliation_signup_clicked
```

Important property:

```json
{
  "role": "QA",
  "sourceSection": "audience_benefits"
}
```

This could eventually tell you which persona messaging attracts actual conversions.

---

# 68. Suggested internal SEO anchor text

Avoid linking everything as:

```text
Learn more
```

Use descriptive anchors:

```text
Declare expected application workflows

See how Developer Demonstration Mode works

Explore behavioral coverage

Find missing application states

Find missing workflow paths

Inspect sessions with Session Replay

Generate behavioral QA reports
```

This is better both for SEO and accessibility.

---

# 69. Visual priority

The page should not have every graphic competing equally.

### Tier 1

Large, immersive:

```text
Hero
Role benefits
Reconciliation Explorer
Demonstration → Reconciliation video
```

### Tier 2

Medium:

```text
Three Outcomes
True Gap comparison
Undeclared Behavior
Report
```

### Tier 3

Small explanatory:

```text
How it works
Human control
Phase evolution
Optional declaration
```

This keeps the page visually disciplined.

---

# 70. The biggest marketing mistake to avoid

Do not make `/product/reconciliation` read like:

> Tellann implements a deterministic diff operation between a Declared Intent Graph and an Observed Behavior Graph.

That is technically accurate but commercially weak.

The visitor needs to think:

```text
We say Checkout should work like this.

Tellann watches us demonstrate it.

Then Tellann tells us:

what we proved,
what we never reached,
and what happened unexpectedly.
```

**Only after that** should Tellann explain the underlying graph model.

---

# 71. The final visitor journey

The page should lead the visitor through this exact mental progression:

```text
My team knows what our software
is supposed to do.

        ↓

But requirements and implementation
are not the same thing.

        ↓

Tellann lets us define important behavior.

        ↓

We demonstrate the application.

        ↓

Tellann sees what actually happened.

        ↓

Then it compares both.

        ↓

If we expected something
and saw it:

CONFIRMED.

        ↓

If we expected something
and never saw it:

TRUE GAP.

        ↓

If something happened
that nobody declared:

UNDECLARED.

        ↓

As a developer,
I can investigate the difference.

As QA,
I know exactly what still lacks evidence.

As an engineering leader,
I can see unresolved expected behavior.

As a product manager,
I can see behavior that wasn't part
of the intended product flow.

        ↓

And every result remains connected
to the behavior that produced it.

        ↓

That gives the team something
stronger than assumption:

evidence that the software
did—or did not—behave as intended.
```

That should define `/product/reconciliation` as an SEO marketing page: **not a technical explanation of graph comparison, but a clear promise that Tellann can help different members of a software team understand whether the behavior they intended is the behavior their application actually demonstrated.** The feature is especially powerful because Tellann deliberately treats neither intent nor observation as unquestionable truth—the gap between the two is what the team gets to investigate. 
