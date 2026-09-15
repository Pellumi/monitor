For `/product/automated-instrumentation`, I would make **control and trust** the dominant story.

The page should not lead with “Tellann edits your code automatically.” That phrasing creates the wrong mental model immediately. The actual product is considerably safer and more disciplined:

> **Tellann finds where behavioral instrumentation belongs, proposes the exact change, shows the diff, waits for approval, applies it locally, validates it, and keeps a rollback ready.**

That is the core story. The Instrumentation Controller is explicitly designed to make modifications **bounded, reviewable and reversible**; no write is allowed without an approved plan, and validation failure attributable to the plan triggers rollback. 

---

# `/product/automated-instrumentation` — Complete SEO Marketing Page Specification

## 1. Primary purpose of the page

The page should answer:

```text
Why does Tellann need instrumentation?

How does Tellann know where to instrument?

Will Tellann change my code without permission?

Can I inspect the changes first?

What happens if the change breaks something?

Does my source code leave my machine?

What does this save me as a developer or QA team?

Which plans include it?
```

The simple marketing proposition should be:

> **Instrument the behavior that matters without manually wiring every checkpoint yourself.**

The deeper message is:

> **Automation without surrendering control.**

---

# 2. Recommended page structure

```text
/product/automated-instrumentation
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Interactive Instrumentation Preview
├── 04 What Automated Instrumentation Means
├── 05 The Manual Problem
├── 06 How Tellann Knows Where to Instrument
├── 07 Review Before Anything Changes
├── 08 Apply → Validate → Roll Back
├── 09 Local-First Source Handling
├── 10 Branch Safety & Workspace Control
├── 11 What Gets Instrumented
├── 12 Benefits by User Class
├── 13 Basic vs Advanced Instrumentation
├── 14 Instrumentation Report
├── 15 60–75 Second Product Video
├── 16 How It Fits Into the Tellann Workflow
├── 17 Security / Trust Section
├── 18 Related Features
├── 19 Pricing / Availability
├── 20 FAQ
├── 21 Final CTA
└── 22 Footer
```

The visual story should flow like this:

```text
UNDERSTAND THE FLOW

        ↓

FIND THE CHECKPOINTS

        ↓

PROPOSE CHANGES

        ↓

YOU REVIEW

        ↓

YOU APPROVE

        ↓

TELLANN APPLIES

        ↓

VALIDATE

        ↓

KEEP OR ROLL BACK
```

That is almost exactly the actual product lifecycle. 

---

# 3. Hero section

### Eyebrow

```text
AUTOMATED INSTRUMENTATION

Tellann Desktop
```

Status badge:

```text
AVAILABLE · SOLO+
```

Your existing SEO/roadmap structure already uses Automated Instrumentation as the example of an available desktop capability for Solo+ plans. Keep status driven by the actual product-status dataset rather than inferring it from Phase 1 alone. 

---

## H1

My preferred headline:

> **Instrument your application without giving up control.**

This is stronger than:

> Automated application instrumentation.

because it simultaneously communicates benefit and addresses fear.

Alternative:

> **Let Tellann handle the instrumentation. You approve every change.**

That is excellent campaign copy, but slightly less SEO-friendly as the H1.

---

## Supporting copy

> Tellann analyzes your bound workspace, finds the code behind the workflows you want to demonstrate, and prepares the instrumentation required to observe them. Review the diff, approve the plan, and let Tellann apply, validate and roll back the changes when necessary.

The actual desktop workflow first analyzes the workspace, builds a code graph and locates flow checkpoints so instrumentation can be targeted instead of applied blindly across the codebase. 

---

## Hero CTA

Primary:

```text
[ Start with Tellann Desktop ]
```

Secondary:

```text
[ See how instrumentation works ↓ ]
```

Optional link:

```text
Explore Codebase Intelligence →
```

---

# 4. Hero layout

Desktop, 12-column container:

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  COPY                    INSTRUMENTATION PLAN            │
│  cols 1–5               cols 6–12                      │
│                                                         │
│  H1                      app/checkout.ts                │
│  body                    ┌─────────────────────────┐    │
│  CTA                     │ proposed diff           │    │
│                          │ + Tellann checkpoint    │    │
│                          │                         │    │
│                          │ [Reject] [Approve]      │    │
│                          └─────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Recommended:

* page max width: **1280–1360 px**
* hero min height: **760–820 px**
* copy width: **460–500 px**
* visual width: **680–760 px**
* vertical padding: **104–128 px**

---

# 5. Hero visual

This is the most important visual on the page.

Do not use a generic image of code.

Build a high-fidelity simulated Tellann Desktop instrumentation interface.

### Master asset / implementation canvas

If static fallback:

**1600 × 1050 px**

Displayed:

approximately **720 × 470 px** in the hero.

If implemented interactively, build as HTML/CSS rather than an exported image.

---

## Hero UI example

```text
INSTRUMENTATION PLAN
Checkout Flow

3 files affected
6 checkpoints
Validation: pending

──────────────────────────────

src/checkout/Checkout.tsx

  const checkout = async () => {

+   tellann.trackState("CHECKOUT_STARTED")

    const result = await submitOrder()

+   tellann.trackTransition(
+     "CHECKOUT_STARTED",
+     "ORDER_COMPLETE"
+   )

    return result
  }

──────────────────────────────

✓ No secrets detected
✓ Working tree checkpointed
✓ Rollback available

[ Reject plan ]       [ Approve & apply ]
```

The diff shown to the user should be redacted for secrets before display, and no working-tree write should occur until approval. 

---

# 6. Hero animation

Use a short, self-explanatory sequence.

### 0–1.0 sec

Code appears uninstrumented.

### 1.0–2.2 sec

Tellann identifies two checkpoint positions.

Very subtle line markers:

```text
CHECKOUT_STARTED
ORDER_COMPLETE
```

### 2.2–3.5 sec

Proposed lines appear in diff form.

### 3.5–4.5 sec

Approval button receives focus.

Do **not** automatically click it immediately.

### 4.5–5.2 sec

A cursor clicks:

```text
Approve & apply
```

### 5.2–6.2 sec

Status becomes:

```text
Applying...
```

### 6.2–7.2 sec

Then:

```text
✓ Validation passed
✓ Rollback recorded
```

Final message:

> **Nothing changes until you approve it.**

Then stop.

---

# 7. First explanatory section

### Eyebrow

```text
AUTOMATION, WITH REVIEW
```

### H2

> **Tellann proposes. You decide.**

Body:

> Automated Instrumentation does not give Tellann unrestricted permission to modify your project. The desktop agent creates a scoped instrumentation plan, shows you the proposed changes, and waits for an authorized user to approve them.

The specification explicitly requires human approval before applying a patch set. 

Then:

```text
Detect
   ↓
Plan
   ↓
Review
   ↓
Approve
   ↓
Apply
   ↓
Validate
   ↓
Rollback if necessary
```

---

# 8. “Why instrumentation exists” section

Many prospective customers will not know why they should care.

### H2

> **Tellann needs to know where meaningful behavior happens.**

Do not explain instrumentation as:

> injecting SDK hooks.

Explain:

> When a user completes checkout, authenticates, retries a payment or reaches an important workflow state, Tellann needs reliable evidence that the transition happened.

Then:

```text
Raw application

User clicks “Pay”

        ↓

Application logic runs

        ↓

Order is completed


With behavioral instrumentation

User clicks “Pay”

        ↓

CHECKOUT_STARTED

        ↓

PAYMENT_SUBMITTED

        ↓

ORDER_COMPLETE
```

Caption:

> Instrumentation gives Tellann reliable behavioral checkpoints it can use to build workflows, measure coverage and reconcile observed behavior against intent.

---

# 9. Manual problem section

### H2

> **The hard part is not adding a tracking call. It is knowing where every meaningful one belongs.**

This is where the page sells the time saving.

Three problems:

### Finding the right files

```text
Where does “checkout complete”
actually happen?
```

### Knowing what already exists

```text
Is this workflow already instrumented?
```

### Keeping instrumentation consistent

```text
Are the frontend and backend
describing the same workflow?
```

Then:

> Tellann first analyzes the bound workspace and locates flow checkpoints so instrumentation is targeted rather than blanket. 

---

# 10. Visual — “Find the checkpoints”

Create a repository-tree visualization.

### Dimensions

Master:

**1600 × 900 px**

Displayed:

**1200 × 675 px**

### Layout

```text
Repository                        Checkout workflow

src/
├── components/
├── auth/
├── checkout/
│   ├── Checkout.tsx       ← CHECKOUT_STARTED
│   ├── payment.ts         ← PAYMENT_SUBMITTED
│   └── confirmation.ts    ← ORDER_COMPLETE
├── api/
│   └── orders.ts          ← ORDER_CREATED
└── ...
```

The right side can display:

```text
FLOW

CART
 ↓
CHECKOUT_STARTED
 ↓
PAYMENT_SUBMITTED
 ↓
ORDER_COMPLETE
```

Animated connectors should map flow nodes to code locations.

---

# 11. Checkpoint animation

On section entry:

1. repo tree appears
2. flow appears
3. `CHECKOUT_STARTED` illuminates
4. line traces toward `Checkout.tsx`
5. next state traces toward `payment.ts`
6. final node maps to confirmation code

Duration:

**1.5–2.2 seconds**

No infinite animation.

This demonstrates what “codebase intelligence” contributes without forcing the visitor to understand code graphs.

---

# 12. Review section

This should be large.

### H2

> **Review the code before Tellann touches the code.**

Supporting:

> Every proposed change is presented as a diff first.

Layout:

```text
COPY          DIFF VIEWER
35%           65%
```

Screenshot/UI dimensions:

**1500 × 950 master**

Displayed around:

**900 × 570 px**

---

# 13. Diff viewer content

Include:

```text
Instrumentation Plan #IN-418

Flow
CHECKOUT

Affected files
3

Checkpoints
6

────────────────────────────

Checkout.tsx

+ tellann.startWorkflow("CHECKOUT")

payment.ts

+ tellann.trackState("PAYMENT_SUBMITTED")

confirmation.ts

+ tellann.completeWorkflow("CHECKOUT")

────────────────────────────

[ Reject ]      [ Approve plan ]
```

Below:

```text
Secrets redacted before display
```

The product requirements require a reviewable diff of every proposed change, redacted of secrets. 

---

# 14. Interaction

Allow visitors on the marketing page to click:

```text
Checkout.tsx
payment.ts
confirmation.ts
```

and switch between simulated diffs.

Also include:

```text
[ Before ] [ Diff ] [ After ]
```

Default to `Diff`.

---

# 15. Apply / validate / rollback section

### H2

> **Applied does not mean trusted. Tellann validates the result.**

This is a major differentiator.

Use a three-stage visual:

```text
APPLY
Patch set written

        ↓

VALIDATE
Build / tests checked

        ↓

KEEP
or
ROLL BACK
```

The desktop agent must validate applied plans and report build or test failures attributable to them; every plan must remain reversible. 

---

# 16. Failure animation

Show:

```text
Applying patch
     ↓
Validation
     ↓
✕ Build failed
     ↓
Rolling back
     ↓
✓ Original state restored
```

Timing:

* Apply: 500ms
* Validation spinner: 800ms
* Failure: 350ms
* Rollback: 700ms
* Restore: 350ms

The Instrumentation Controller explicitly specifies automatic rollback when a validation failure is attributable to the plan. 

---

# 17. Strong trust statement

Large centered typography:

> **Automation should be reversible.**

Supporting:

> Every applied Tellann instrumentation plan has a recorded rollback.

That is a much stronger marketing statement than listing internal technical safeguards.

---

# 18. Local-first source handling section

This is essential.

### Eyebrow

```text
YOUR SOURCE STAYS LOCAL
```

### H2

> **Tellann works with your source code on your machine.**

Supporting:

> The desktop agent performs codebase analysis locally. By default, Tellann receives derived projections such as code topology, checkpoint locations and warnings—not your raw source files.

This is explicitly part of Tellann's source-handling architecture. 

---

# 19. Visual — trust boundary

Use a diagram:

```text
YOUR MACHINE
────────────────────────────────

Repository
    │
    ↓
Tellann Desktop
    │
    ├── Code analysis
    ├── Instrumentation plan
    ├── Apply
    └── Rollback

             │
             │ derived projections
             ▼

TELLANN CLOUD
────────────────────────────────

• checkpoint locations
• graph topology
• analysis warnings
• instrumentation results
```

Under repository:

```text
Raw source stays here by default
```

Dimensions:

**1400 × 760 px**

Displayed:

**1100 × 600 px**

---

# 20. Important marketing line

> **Your repository is not uploaded just because Tellann needs to understand it.**

If raw source ever needs to be transmitted, the security specification requires explicit consent for a named purpose; that permission does not generalize across purposes or sessions. 

This is particularly important for enterprise adoption.

---

# 21. Branch safety section

### H2

> **Keep instrumentation where it belongs.**

Explain:

> Organizations set a QA review branch. Tellann applies instrumentation there without creating branches of its own, and asks before applying anywhere else.

Visual:

```text
main
 │
 ├── tellann/qa-review
 │        ↑
 │   changes applied here
 │
 └── feature/checkout
```

Then:

```text
QA review branch
tellann/qa-review

Changes applied
On the QA review branch

On another branch?
Tellann asks before applying

Undo
Only Tellann-authored changes
```

The architecture supports a QA review branch policy, time-boxed checkout grants for switching a workspace onto that branch, and a confirmation step before instrumentation is applied on any other branch.

---

# 22. Do not make branch governance the hero

This is important.

Developers care about it.

Most marketing visitors do not need Git governance in their first screen.

Put it around **55–65% down the page**, once trust has already become relevant.

---

# 23. “What Tellann can instrument” section

Avoid pretending Tellann supports arbitrary language/framework mutation if that is not documented.

Keep this conceptual.

Use six capability cards:

### Workflow boundaries

```text
CHECKOUT_STARTED
CHECKOUT_COMPLETE
```

### States

```text
AUTHENTICATED
PAYMENT_FAILED
```

### Transitions

```text
CART → CHECKOUT
```

### Frontend behavior

```text
page
component
form
interaction
```

### Backend behavior

```text
request
response
error
latency
```

### Flow checkpoints

```text
entry
milestone
terminal state
```

The Phase 1 demonstration system ultimately captures navigation, clicks, form submissions, state transitions, APIs, errors and browser findings. 

---

# 24. “It detects what already exists”

One compact section:

### H2

> **No need to instrument what is already instrumented.**

Body:

> Tellann first detects existing instrumentation and installed SDKs before preparing a plan.

The Instrumentation Controller explicitly has this responsibility. 

Visual:

```text
Detected

✓ @tellann/frontend-sdk
✓ Session capture
✓ Navigation tracking

Missing

○ CHECKOUT workflow checkpoints
○ Payment failure state
○ Order completion state

Recommended plan
6 additions
```

---

# 25. Benefits by user class

Use persona tabs again.

```text
Developer
QA Engineer
Engineering Manager
Product / Technical PM
```

---

# 26. Developer

### H3

> **Spend less time wiring instrumentation by hand.**

Benefits:

* Tellann finds likely checkpoint locations.
* Proposed changes are already organized as a plan.
* Diffs can be reviewed before application.
* The agent can apply the patch instead of requiring manual edits.
* Validation catches plan-related breakage.
* Rollback remains available.

Core message:

> **You still review the code. You stop doing the repetitive part.**

That fits the commercial positioning exactly: without automated instrumentation a developer can instrument manually from the proposed plan; with automation the agent applies and rolls the change back itself. 

---

# 27. QA Engineer

### H3

> **Get observable workflows without becoming the instrumentation coordinator.**

Benefits:

* Focus on what needs validation rather than where SDK calls belong.
* Translate declared flows into observable checkpoints.
* Confirm what instrumentation was applied before the demonstration.
* Review validation outcomes.
* Inspect the final instrumentation report.

Core message:

> **Spend QA time validating behavior, not chasing instrumentation setup.**

---

# 28. Engineering Manager

### H3

> **Automation with an audit trail.**

Benefits:

* Human approval remains required.
* Workspace and approving user are attributable.
* Branch policy can constrain changes.
* Applied plans have rollbacks.
* Validation and rollback outcomes are recorded.

Every modification-related action—plan proposal, approval, patch application, validation and rollback—is designed to be auditable. 

Core message:

> **Increase developer speed without turning the working tree into a black box.**

---

# 29. Product Manager / Technical Product Manager

The value is indirect, so do not pretend Product Managers are reviewing patches all day.

### H3

> **Get from intended workflow to observable workflow faster.**

Benefits:

* Declared flows can become demonstrable sooner.
* Product intent can be connected to actual application evidence.
* Less setup friction before QA demonstrations.
* More reliable coverage and reconciliation evidence.

Core message:

> **Less time preparing the observation layer. More time understanding whether the product behaves as intended.**

---

# 30. Organization / Platform Admin

I would add this as a smaller fifth persona or separate enterprise panel.

### H3

> **Decide who can change what—and where.**

Benefits:

* workspace trust
* branch policy
* role controls
* entitlement checks
* device trust
* audit history

Instrumentation approval requires MEMBER or above and only applies to a workspace that user has bound; role alone is not sufficient because entitlement, device trust and workspace trust are separate checks. 

---

# 31. Basic vs Advanced instrumentation

This deserves a section because the capability is tiered.

### Heading

> **Automation that scales with the complexity of your workspace.**

Two cards:

### BASIC

**Solo**

```text
Single-flow instrumentation plans
```

Use cases:

* instrument login
* instrument checkout
* instrument onboarding
* instrument one declared workflow at a time

### ADVANCED

**Team · Business · Enterprise**

```text
Multi-flow plans
Bootstrap instrumentation
```

The entitlement specification defines BASIC as single-flow plans and ADVANCED as multi-flow plans plus bootstrap instrumentation. 

---

# 32. Pricing presentation

Current entitlement structure:

| Plan       | Automated Instrumentation |
| ---------- | ------------------------- |
| Free       | No                        |
| Local      | No                        |
| Solo       | Basic                     |
| Team       | Advanced                  |
| Business   | Advanced                  |
| Enterprise | Advanced                  |

This is the actual configured plan matrix. 

Do not hide the absence on Free/Local.

Turn it into good product positioning:

> **Automated Instrumentation saves time; it does not gate the Tellann workflow.**

Free and Local developers can still instrument manually using the plan Tellann provides and continue with the demonstration. The entitlement specification explicitly requires automated instrumentation being unavailable **not** to prevent a run. 

That is excellent messaging.

---

# 33. Recommended pricing copy

```text
FREE / LOCAL

Tellann shows you what needs to be instrumented.
You apply the changes.


SOLO

Tellann can apply single-flow instrumentation
for you after approval.


TEAM+

Tellann can handle broader multi-flow and
bootstrap instrumentation plans.
```

This is far easier for users to understand than “Basic” and “Advanced” alone.

---

# 34. Instrumentation Report section

### H2

> **Know exactly what changed.**

Tellann's Phase 1 reporting model includes an Instrumentation Report containing:

* Plan Summary
* Files Affected
* Capabilities Applied
* Validation Outcome
* Rollback Availability
* Approving User. 

---

# 35. Report visual

Master:

**1600 × 1050 px**

Displayed:

**1100 × 720 px**

Example UI:

```text
INSTRUMENTATION REPORT

Plan
IN-4418

Status
APPLIED · VALIDATED

Approved by
Philip A.

Files affected
4

Checkpoints added
8

Validation
PASSED

Rollback
AVAILABLE

──────────────────────

Files

Checkout.tsx        2 changes
payment.ts          3 changes
orders.ts           2 changes
confirmation.ts     1 change
```

CTA:

```text
View instrumentation history →
```

---

# 36. Failed-plan report example

Consider a small alternate state:

```text
Status
ROLLED BACK

Reason
Validation failed

Working tree
RESTORED

Rollback
COMPLETED
```

This communicates maturity better than showing only a perfect success state.

Instrumentation reports are generated even for failed and rolled-back plans. 

---

# 37. Product video

One primary explainer:

> **Automated Instrumentation in 60 seconds**

Recommended duration:

**60–75 seconds**

Type:

**real UI + lightweight motion graphics**

Avoid talking-head presentation.

---

# 38. Video storyboard

### 0–7 sec

Repository appears.

Voice/caption:

> Instrumenting every workflow manually takes time.

---

### 7–15 sec

Declared checkout flow appears.

Tellann maps it into the repository.

> Tellann analyzes your workspace and locates the code behind the flow.

---

### 15–25 sec

Instrumentation plan appears.

> It creates a scoped plan for the checkpoints that are missing.

---

### 25–35 sec

Diff displayed.

> Nothing changes yet.

Cursor moves between files.

---

### 35–42 sec

User clicks:

```text
Approve plan
```

> You review and approve the change.

---

### 42–52 sec

Patch applied.

Validation begins.

> Tellann applies the patch locally and validates the result.

---

### 52–60 sec

Show success.

Then quickly show alternative:

```text
Validation failed
→ rollback
→ restored
```

> If the plan causes a validation failure, Tellann can restore the previous state.

---

### 60–68 sec

Trust-boundary visual:

```text
Source code
YOUR MACHINE
```

> Your source remains local by default.

---

### 68–75 sec

End card:

> **Automation you can inspect, approve and reverse.**

CTA:

```text
Get Tellann Desktop
```

---

# 39. Video dimensions

Master:

**1920 × 1080**

16:9.

Website:

* desktop: **960 × 540**
* tablet: `100%`, 16:9
* mobile: `100%`, 16:9

Poster:

**1600 × 900 AVIF/WebP**

Formats:

```text
WebM
MP4 H.264 fallback
```

Do not autoplay the full video.

A silent **8–10 second** hero animation is enough.

---

# 40. “How it fits into Tellann” section

This page should not make instrumentation feel like a standalone DevOps tool.

### H2

> **Instrumentation is the bridge between intent and evidence.**

Visual:

```text
Declare flow

    ↓

Bind workspace

    ↓

Analyze code

    ↓

Instrument
YOU ARE HERE

    ↓

Demonstrate

    ↓

Build Behavior Graph

    ↓

Reconcile

    ↓

Coverage + QA Report
```

The Developer Demonstration lifecycle puts workspace binding and code analysis immediately before instrumentation, followed by the managed demonstration session. 

---

# 41. Trust section

Use four simple trust cards.

### Review first

> Tellann cannot write to your working tree without an approved plan.

### Source stays local

> Raw source stays on the developer machine by default.

### Secrets stay out of the diff

> Displayed instrumentation diffs are redacted.

### Every change can be reversed

> Applied plans include a recorded rollback.

All four are explicit architecture requirements. 

---

# 42. Important AI clarification

Include this either as FAQ or trust copy:

### Does AI edit my source code?

Answer:

> No. Tellann may use bounded assistive intelligence elsewhere for drafting or enrichment, but model output is not executed or written directly into a customer system. Instrumentation changes pass through Tellann's planned, reviewed and approved instrumentation workflow.

The security architecture explicitly states that model output must never be executed, evaluated or written to a customer system. 

This is a very important credibility point.

---

# 43. Related features

Use four cards.

### Codebase Intelligence

> Understand where declared workflows live in the local codebase.

Route:

```text
/product/codebase-intelligence
```

### Flow Declaration

> Define the workflows Tellann should prepare to observe.

```text
/product/flow-declaration
```

### Developer Demonstration

> Run the instrumented application through a controlled walkthrough.

```text
/product/developer-demonstration
```

### Reconciliation

> Compare what you intended with what Tellann actually observed.

```text
/product/reconciliation
```

Automated Instrumentation should visually sit between **Codebase Intelligence** and **Developer Demonstration**.

---

# 44. FAQ

I recommend at least eight questions.

### What is automated instrumentation?

> Tellann prepares the behavioral instrumentation needed for a declared workflow, presents the changes for review and—when the plan allows—applies them through the desktop agent after approval.

### Does Tellann change my source without asking?

> No. An approved instrumentation plan is required before any working-tree write. 

### Can I see what will change first?

> Yes. Proposed changes are presented as a reviewable diff.

### What if the instrumentation breaks my build?

> Tellann validates applied plans. A plan-related validation failure can trigger rollback and restore the branch. 

### Does my source code get uploaded?

> Source analysis is local by default. Derived projections are transmitted instead; raw source requires explicit consent for a named purpose. 

### Can I use my own QA branch?

> Tellann's branch policy can constrain which branch instrumentation belongs on, and the original branch state can be restored afterward. 

### Can I still use Tellann without Automated Instrumentation?

> Yes. You can apply the instrumentation plan manually and continue the demonstration. 

### Which plans include Automated Instrumentation?

> Solo includes Basic automation; Team, Business and Enterprise include Advanced automation. Free and Local use manual instrumentation. 

---

# 45. Things this page must NOT say

Do not say:

```text
Tellann automatically modifies your application.
```

Too broad.

Use:

> Tellann applies approved instrumentation plans to a bound workspace.

---

Do not say:

```text
AI writes instrumentation into your codebase.
```

Incorrect.

---

Do not say:

```text
Tellann autonomously decides what changes your code needs.
```

Incorrect mental model.

---

Do not say:

```text
Zero human intervention.
```

Human approval is deliberately part of the design.

---

Do not say:

```text
No risk of breaking your application.
```

There is always risk when changing software. Your product is designed to **control that risk through review, validation and rollback**.

That is a more credible claim.

---

# 46. SEO title

Recommended:

```text
Automated Application Instrumentation | Tellann
```

Alternative:

```text
Automated Instrumentation for Behavioral QA | Tellann
```

I prefer the second. It is more differentiated and avoids sounding like generic observability auto-instrumentation.

---

# 47. Meta description

```text
Automatically instrument application workflows with Tellann. Review every proposed code change, approve scoped instrumentation, validate the result, and roll back safely when needed.
```

---

# 48. Keyword cluster

Primary:

```text
automated instrumentation
application instrumentation
software instrumentation
behavioral instrumentation
application workflow instrumentation
```

Secondary:

```text
automatic SDK instrumentation
QA instrumentation
workflow tracking instrumentation
code instrumentation automation
developer instrumentation tools
behavioral QA tooling
```

Avoid over-optimizing for:

```text
AI code generation
AI software engineer
autonomous coding
self-healing software
```

Those describe a different product category.

---

# 49. Heading structure

```text
H1
Instrument your application without giving up control.

H2
Tellann proposes. You decide.

H2
Tellann needs to know where meaningful behavior happens.

H2
Find the right checkpoints without searching the entire codebase.

H2
Review the code before Tellann touches the code.

H2
Applied does not mean trusted. Tellann validates the result.

H2
Automation should be reversible.

H2
Tellann works with your source code on your machine.

H2
Keep instrumentation where it belongs.

H2
No need to instrument what is already instrumented.

H2
Automated Instrumentation for your role.

H2
Automation that scales with your workspace.

H2
Know exactly what changed.

H2
Instrumentation is the bridge between intent and evidence.

H2
Frequently asked questions.

H2
Spend less time wiring behavior. Keep control of every change.
```

---

# 50. Media inventory

| Asset                              | Type                          | Master dimensions |    Display | Purpose                  |
| ---------------------------------- | ----------------------------- | ----------------: | ---------: | ------------------------ |
| Hero instrumentation diff          | Interactive HTML / screenshot |         1600×1050 |   ~720×470 | Explain review/approval  |
| Flow → code checkpoint map         | SVG/UI                        |          1600×900 |   1200×675 | Explain targeting        |
| Diff review screenshot             | AVIF/WebP                     |          1500×950 |   ~900×570 | Establish control        |
| Validation/rollback visual         | SVG/UI                        |          1400×700 |  ~1000×500 | Explain reversibility    |
| Local trust boundary               | SVG                           |          1400×760 |   1100×600 | Explain source handling  |
| Branch safety diagram              | SVG                           |          1200×600 |   ~900×450 | Explain branch policy    |
| Existing instrumentation detection | UI screenshot                 |          1400×850 |   1000×607 | Explain detection        |
| Instrumentation report             | AVIF/WebP                     |         1600×1050 |   1100×720 | Show auditability        |
| Explainer video                    | WebM/MP4                      |         1920×1080 |    960×540 | Full feature explanation |
| Video poster                       | AVIF/WebP                     |          1600×900 | responsive | Video preview            |

---

# 51. Animation inventory

| Animation                   | Trigger             |     Duration |
| --------------------------- | ------------------- | -----------: |
| Checkpoint discovery        | Hero/scroll         |   800–1200ms |
| Proposed diff insertion     | Hero                |    600–800ms |
| Approval state              | Hero                |    250–350ms |
| Patch application           | Hero                |    500–700ms |
| Validation                  | Hero                |    700–900ms |
| Rollback                    | Section interaction |   700–1000ms |
| Flow-to-file connector draw | Scroll              |  1000–1500ms |
| Branch restore              | Scroll              |    500–700ms |
| Report row reveal           | Scroll              | 40–60ms/item |
| Persona tab transition      | Click               |    200–300ms |

Every animation should explain a state transition. Avoid decorative code rain, floating particles or glowing terminal nonsense.

---

# 52. Responsive behavior

Desktop:

```text
COPY | PRODUCT UI
```

Tablet:

roughly **40/60** or stacked depending on the complexity of the screenshot.

Mobile:

```text
Heading
Copy
CTA
Visual
Supporting explanation
```

For diffs, never shrink a full desktop code viewer to 350 px.

Instead show:

```text
Checkout.tsx

+ tellann.startWorkflow(...)
+ tellann.trackState(...)

3 changes

[ View next file → ]
```

One file at a time.

---

# 53. Structured data

Implement:

```text
WebPage
SoftwareApplication
FAQPage
BreadcrumbList
VideoObject
```

Breadcrumb:

```text
Home
→ Product
→ Automated Instrumentation
```

---

# 54. Analytics events

```text
AUTO_INSTRUMENTATION_PAGE_VIEWED

AUTO_INSTRUMENTATION_HERO_CTA_CLICKED

AUTO_INSTRUMENTATION_DIFF_FILE_CHANGED

AUTO_INSTRUMENTATION_APPROVAL_DEMO_CLICKED

AUTO_INSTRUMENTATION_ROLLBACK_DEMO_CLICKED

AUTO_INSTRUMENTATION_PERSONA_CHANGED

AUTO_INSTRUMENTATION_VIDEO_STARTED

AUTO_INSTRUMENTATION_VIDEO_COMPLETED

AUTO_INSTRUMENTATION_CODEBASE_INTELLIGENCE_CLICKED

AUTO_INSTRUMENTATION_DESKTOP_CLICKED

AUTO_INSTRUMENTATION_PRICING_CLICKED

AUTO_INSTRUMENTATION_SIGNUP_CLICKED

AUTO_INSTRUMENTATION_FAQ_OPENED
```

Useful properties:

```text
persona
plan_interest
cta_location
demo_action
device_type
video_progress
```

---

# 55. Final CTA

### H2

> **Spend less time wiring behavior. Keep control of every change.**

Supporting:

> Let Tellann prepare and apply the instrumentation your workflows need—after you review and approve it.

Primary:

```text
[ Start with Tellann Desktop ]
```

Secondary:

```text
[ Compare plans ]
```

Small line:

```text
Automated Instrumentation starts on Solo.
```

---

# 56. Final recommended page flow

```text
NAVIGATION

↓

HERO
“Instrument your application
without giving up control.”

[animated instrumentation plan]

↓

TELLANN PROPOSES. YOU DECIDE.
Detect → Plan → Review → Approve → Apply

↓

WHY INSTRUMENTATION?
Turn application actions into
observable behavioral checkpoints

↓

FIND THE CHECKPOINTS
Declared flow ↔ code locations

↓

REVIEW THE DIFF
See every proposed change

↓

APPLY + VALIDATE
Tellann applies locally
and validates

↓

ROLLBACK
If the plan causes failure,
restore the working tree

↓

SOURCE STAYS LOCAL
Trust-boundary visualization

↓

BRANCH SAFETY
QA branch + restore original branch

↓

WHAT GETS INSTRUMENTED?
States · Transitions · Flows · APIs

↓

EXISTING INSTRUMENTATION
Detect before adding anything

↓

BENEFITS BY ROLE
Developer
QA
Engineering Manager
Product Manager

↓

BASIC VS ADVANCED
Solo vs Team+

↓

INSTRUMENTATION REPORT
What changed · validation · rollback · approval

↓

60-SECOND VIDEO

↓

TELLANN WORKFLOW
Declare
→ Analyze
→ Instrument
→ Demonstrate
→ Reconcile
→ Report

↓

TRUST
Review first
Local source
Redacted diffs
Recorded rollback

↓

RELATED FEATURES
Codebase Intelligence
Flow Declaration
Developer Demonstration
Reconciliation

↓

PLANS

↓

FAQ

↓

FINAL CTA

↓

FOOTER
```

The page's central line should effectively be:

> **Tellann automates the repetitive part of instrumentation, not the decision to change your code.**

That is the distinction that makes this feature compelling rather than frightening. It also matches the commercial strategy: Automated Instrumentation is deliberately an upgrade that **returns developer time**, while manual instrumentation remains a valid path for Free and Local customers. 
