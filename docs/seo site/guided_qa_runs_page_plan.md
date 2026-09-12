# `/product/guided-qa-runs` — Complete SEO Marketing Page Specification

For this page, I would make one idea immediately clear:

> **A Guided QA Run is a real walkthrough of the application—not a generated test script. Tellann keeps the walkthrough aligned with the intended flow, records what actually happens, and turns that evidence into QA intelligence.**

That positioning matters because Guided QA Runs sit at the center of Tellann Phase 1. Developer Demonstration Mode takes a developer-led walkthrough and turns it into behavior graphs, workflow maps, coverage, reconciliation, missing-state/flow analysis, endpoint analysis, replay, and a QA Run Report. 

The user should leave `/product/guided-qa-runs` understanding:

```text
Declare what should happen
        ↓
Open a Guided QA Run
        ↓
Perform the real workflow
        ↓
Tellann observes what happened
        ↓
Behavior + Coverage + Gaps + Report
```

---

# 1. Page positioning

The page should primarily answer:

> **How does Tellann observe my application without me writing a complete automated test suite first?**

The answer:

> **You demonstrate the workflow while Tellann guides and records the run.**

A Guided run specifically uses an existing declared flow. Tellann walks the user through it, confirms boundaries, and prompts for states it expects to see. 

This means the page should not feel like a generic browser-testing page.

It should feel like:

> **“Show Tellann the workflow once, under controlled conditions, and get structured evidence back.”**

---

# 2. Difference between this page and Developer Demonstration

These two concepts are related but should not have duplicate pages.

### `/product/developer-demonstration`

Explains the **whole Tellann teaching workflow**:

```text
Declare
→ Bind workspace
→ Analyze
→ Instrument
→ Demonstrate
→ Analyze
→ Report
```

### `/product/guided-qa-runs`

Explains the **actual run experience**:

```text
Choose flow
→ Start managed run
→ Reach starting point
→ Demonstrate workflow
→ Follow expected states
→ Record evidence
→ Complete
→ Receive results
```

So the positioning should be:

> **Developer Demonstration is the broader workflow. Guided QA Runs are how the actual behavioral walkthrough is performed.**

---

# 3. Recommended page structure

```text
/product/guided-qa-runs
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Interactive Guided Run Preview
├── 04 What Is a Guided QA Run?
├── 05 Why This Is Different From Writing Tests
├── 06 Choose the Flow to Demonstrate
├── 07 Tellann Guides the Run
├── 08 Flow Boundaries
├── 09 What Tellann Captures
├── 10 Frontend + Backend Capture
├── 11 Pause, Resume & Incomplete Runs
├── 12 Annotate What You Notice
├── 13 Guided / Assisted / Observation Only
├── 14 From Run to Behavioral Evidence
├── 15 Run Results
├── 16 QA Run Report
├── 17 Session Replay
├── 18 Benefits by User Class
├── 19 Privacy & Protected Values
├── 20 60–75 Second Demo Video
├── 21 How Guided Runs Fit Into Tellann
├── 22 Plan Availability
├── 23 Related Features
├── 24 FAQ
├── 25 Final CTA
└── 26 Footer
```

---

# 4. Hero section

### Eyebrow

```text
GUIDED QA RUNS
Tellann Desktop
```

Plan label:

```text
AVAILABLE ON EVERY PLAN
```

From a packaging perspective, Guided QA Runs are included on Free, Local, Solo, Team, Business, and Enterprise. 

The actual **implementation-status badge** should still come from the roadmap/status dataset rather than being inferred from entitlement.

---

# 5. Hero H1

Preferred:

> **Walk through a workflow. Let Tellann turn it into evidence.**

Alternative:

> **Show Tellann how your application behaves.**

Or a more QA-specific variant:

> **Run the workflow. See what actually happened.**

I prefer:

> **Walk through a workflow. Let Tellann turn it into evidence.**

It explains both user action and product outcome.

---

# 6. Hero supporting copy

> Start a Guided QA Run from Tellann Desktop, perform the real application workflow in a managed browser, and let Tellann track the states, transitions, APIs, errors and findings that occur along the way.

Tellann's demonstration session captures page visits, route changes, button clicks, form submissions, state transitions, API activity, errors and browser findings. 

---

# 7. Hero CTA

Primary:

```text
[ Start a Guided Run ]
```

Secondary:

```text
[ See a Guided Run ↓ ]
```

Tertiary:

```text
Explore Tellann Desktop →
```

Because the formal specification requires demonstration runs to start from the desktop agent, the website CTA should ultimately hand users toward Desktop rather than implying runs execute entirely inside the marketing/dashboard browser. 

---

# 8. Hero layout

Use the same 12-column Tellann marketing grid.

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  COPY                       GUIDED RUN                      │
│  cols 1–5                  cols 6–12                       │
│                                                            │
│  H1                         Checkout                       │
│  supporting                 Step 3 of 5                    │
│  CTA                                                       │
│                             Expected                        │
│                             PAYMENT_SUBMITTED              │
│                                                            │
│                             Current                         │
│                             Checkout page                  │
│                                                            │
│                             [ Pause Run ]                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Recommended dimensions:

* max width: **1280–1360 px**
* hero min-height: **760–820 px**
* copy width: **450–500 px**
* product visual: **690–760 px wide**
* top/bottom padding: **104–128 px**

---

# 9. Hero visual

The hero should use a simulated Tellann Desktop + managed browser composition.

Do **not** use a generic browser screenshot.

Create one product interface containing:

```text
┌───────────────────────────────────────────────────┐
│ TELLANN · GUIDED RUN                 ● RECORDING  │
├──────────────┬────────────────────────────────────┤
│ FLOW         │ MANAGED BROWSER                    │
│              │                                    │
│ ✓ Cart       │              Storefront            │
│ ✓ Checkout   │                                    │
│ ● Payment    │          Payment details           │
│ ○ Complete   │                                    │
│              │              [ Pay ]               │
│              │                                    │
├──────────────┴────────────────────────────────────┤
│ Expected: PAYMENT_SUBMITTED                       │
│ Evidence: 147 events        03:24                  │
│ [ Pause ]                         [ End Run ]       │
└───────────────────────────────────────────────────┘
```

---

# 10. Hero media dimensions

For a static fallback:

**Master:** `1600 × 1050 px`

Displayed:

approximately **720 × 470 px**

Format:

* AVIF
* WebP fallback

But the actual implementation should ideally be **HTML/CSS/SVG**, because the run status, step progression and event count should animate.

---

# 11. Hero animation

A restrained **8-second** sequence:

### 0–1.5 sec

Run starts:

```text
ARMED
```

Flow list visible:

```text
Cart
Checkout
Payment
Confirmation
```

### 1.5–2.5 sec

Status:

```text
Waiting for flow start...
```

### 2.5–3.5 sec

User reaches Checkout.

Status changes:

```text
FLOW STARTED
```

### 3.5–5 sec

Expected state becomes:

```text
PAYMENT_SUBMITTED
```

Browser user clicks:

```text
Pay
```

### 5–6 sec

Step gets a check:

```text
✓ PAYMENT_SUBMITTED
```

Event counter changes:

```text
143 → 151
```

### 6–7 sec

Next expected state:

```text
ORDER_CONFIRMED
```

### 7–8 sec

Final caption:

> **You perform the workflow. Tellann records the evidence.**

Then stop.

Do not run a permanent animation behind the H1.

---

# 12. First explanatory section

### Eyebrow

```text
HUMAN-LED. EVIDENCE-DRIVEN.
```

### H2

> **A Guided QA Run is a controlled application walkthrough.**

Body:

> Choose a declared flow, launch its run through Tellann Desktop, and perform the workflow in the managed browser. Tellann helps keep the walkthrough aligned with the expected states while recording what the application actually does.

Guided mode is specifically intended for cases where a declared flow exists and the goal is to verify it. 

---

# 13. Simple conceptual visual

```text
You

click
type
navigate
submit

        ↓

REAL APPLICATION

        ↓

Tellann observes

        ↓

States
Transitions
APIs
Errors
Findings

        ↓

QA Evidence
```

Dimensions:

**1200 × 560 px SVG**

Displayed:

**1050 × 490 px**

---

# 14. “You are not writing a test script” section

### H2

> **Demonstrate the behavior instead of describing every action as a test.**

Use two columns.

### Traditional setup

```text
Write test setup
Write selectors
Write actions
Write assertions
Maintain script
Debug script
Run script
```

### Guided QA Run

```text
Choose workflow
Start run
Use application normally
Finish workflow
Review evidence
```

Do not frame this as “replace Selenium/Cypress/Playwright.”

Tellann's Phase 1 proposition is different.

It is creating behavioral intelligence from demonstration.

The specification explicitly characterizes the user as teaching Tellann how the application behaves rather than writing tests. 

---

# 15. Important marketing boundary

Do not say:

> **No more automated testing.**

Guided QA Runs are not a claim that scripted automation is obsolete.

Instead:

> **Get useful QA evidence before building comprehensive automation around every workflow.**

Much safer and more credible.

---

# 16. Choose the flow section

### H2

> **Start with the behavior you want to verify.**

Product UI:

```text
NEW QA RUN

Application
Storefront

Environment
QA

Flow
Checkout

Mode
● Guided
○ Assisted
○ Observation Only

Capture
☑ Frontend
☑ Backend

[ Start Run ]
```

Master:

**1500 × 980 px**

Displayed:

**1000 × 650 px**

---

# 17. Flow selector visual

Once `Checkout` is selected:

```text
CHECKOUT

Start
CART_REVIEW

Expected
CHECKOUT_STARTED
PAYMENT_SUBMITTED
ORDER_CONFIRMED

Alternatives
PAYMENT_FAILED
RETRY_PAYMENT

Terminal
ORDER_CONFIRMED
CHECKOUT_CANCELLED
```

This visually reinforces that Guided mode is driven by declared intent.

---

# 18. “Tellann guides you” section

### H2

> **Know what the run expects without turning it into a script.**

This distinction is important.

Tellann can show:

```text
Current position

CHECKOUT_STARTED

Expected next

PAYMENT_SUBMITTED

Alternative expected

CHECKOUT_CANCELLED
```

but should not behave like:

```text
1. Click button #checkout
2. Type 4111...
3. Click #submitPayment
```

unless those exact interaction instructions become a formally designed capability.

The existing specification says Guided mode prompts for the **states it expects to see**, not that it acts as a rigid click-by-click macro. 

---

# 19. Guided-run visual

Use a split view:

```text
FLOW PROGRESS                 APPLICATION

✓ CART_REVIEW                 ┌───────────────────┐
✓ CHECKOUT_STARTED            │ Checkout          │
● PAYMENT_SUBMITTED           │                   │
○ ORDER_CONFIRMED             │ Card details      │
                              │                   │
Expected next                 │ [ Pay ]           │
PAYMENT_SUBMITTED             └───────────────────┘
```

Master:

**1600 × 1000 px**

Display:

**1150 × 720 px**

---

# 20. Flow boundaries section

This should be one of the most important explanatory elements because it shows why Guided Runs produce better evidence than arbitrary session recording.

### H2

> **Tellann knows when the workflow actually begins.**

The product explicitly distinguishes:

```text
PRE-BOUNDARY
```

from:

```text
IN-FLOW
```

Activity before the declared workflow begins—such as login, setup, or navigation—is retained for context and replay but excluded from coverage calculations. Coverage and reconciliation use only in-flow evidence. 

---

# 21. Boundary visual

```text
LOGIN
  ↓
DASHBOARD
  ↓
PRODUCT PAGE

──────── FLOW START ────────

CART
  ↓
CHECKOUT
  ↓
PAYMENT
  ↓
CONFIRMATION

──────── FLOW END ──────────
```

Labels:

```text
Context only
──────────────
Measured workflow
```

Master:

**1400 × 650 px SVG**

Display:

**1050 × 490 px**

---

# 22. Boundary animation

On scroll:

1. entire path appears;
2. first three nodes stay muted;
3. `CART` boundary line animates;
4. workflow nodes brighten;
5. measurement bracket appears:

```text
COVERAGE MEASURED HERE
```

Duration:

**900–1200 ms**

This is a very strong visual explanation of a fairly technical concept.

---

# 23. Supporting copy

> Logging in before a checkout test should not make checkout look more complete. Tellann separates setup activity from the evidence used to evaluate the declared flow.

That is exactly the rationale behind the flow-boundary model. 

---

# 24. What Tellann captures

### H2

> **One walkthrough. Multiple layers of evidence.**

Use an animated evidence rail:

```text
User action
     │
     ├── Page visit
     ├── Route change
     ├── Click
     ├── Form submission
     ├── State transition
     ├── API request
     ├── API response
     ├── Error
     └── Browser finding
```

These are the run-event categories documented for the demonstration session. 

---

# 25. Evidence visualization

Rather than nine cards, use a session timeline.

```text
00:01.231   ROUTE
/cart → /checkout

00:02.044   STATE
CART → CHECKOUT_STARTED

00:03.815   CLICK
Pay

00:03.923   API
POST /api/payment

00:04.170   RESPONSE
201

00:04.311   STATE
PAYMENT_SUBMITTED → ORDER_COMPLETE
```

Master:

**1500 × 850 px**

Display:

**1000 × 570 px**

---

# 26. Frontend and backend capture

### H2

> **See the workflow from the browser and the server.**

Tellann supports separate frontend and backend capture tracks. A run can enable either or both. 

Visual:

```text
FRONTEND                     BACKEND

Checkout page                POST /payment
Click Pay                    ↓
Form submit                  payment-service
Route change                 ↓
Confirmation                 POST /order

          \                 /
           \               /
            RUN-4471
```

---

# 27. Capture-track controls

In the simulated UI:

```text
Capture Tracks

☑ Frontend
   Browser behavior

☑ Backend
   API behavior
```

Important explanation:

> If the backend track is not enabled, Tellann should say endpoint behavior was **not measured**, not report a misleading zero.

The specification explicitly requires this distinction. 

---

# 28. Pause and resume section

### H2

> **A QA run can pause when the real world interrupts it.**

Run lifecycle supports:

```text
RUNNING
   ⇅
PAUSED
```

and the run orchestration component explicitly supports `RUN_PAUSED` and `RUN_RESUMED`. 

Visual:

```text
RUNNING
03:41

151 events

[ Pause ]
```

Then:

```text
PAUSED

Evidence captured so far: 151 events

[ Resume ]
[ End Run ]
```

---

# 29. Incomplete runs

This deserves a small but strong section.

### H2

> **An interrupted run is not automatically useless.**

If the browser closes or the walkthrough ends before a terminal state, Tellann retains the collected evidence and marks the outcome:

```text
COMPLETED_INCOMPLETE
```

rather than discarding it. 

Visual:

```text
Run ended early

Outcome
COMPLETED_INCOMPLETE

Reached
PAYMENT_SUBMITTED

Not reached
ORDER_CONFIRMED

Evidence retained
287 events
```

---

# 30. Important language

Do not display:

```text
Coverage: 0%
```

when the initial workflow boundary was never reached.

The QA reporting specification explicitly says such a run must say **no in-flow evidence was gathered** rather than report zero coverage. 

This is a good example of Tellann's evidence-first philosophy.

---

# 31. Annotations and artifacts

### H2

> **Capture what you notice while the evidence is still fresh.**

During a run, users should be able to attach context to what they observe.

UI example:

```text
02:43 · PAYMENT

Add annotation

“Spinner remained visible for
almost four seconds.”

[ Add ]

Attach
Screenshot
Artifact
```

The run orchestrator is explicitly responsible for capturing annotations and artifacts alongside browser findings. 

---

# 32. Annotation visual

Master:

**1400 × 850 px**

Displayed:

**950 × 575 px**

Composition:

```text
SESSION TIMELINE            ANNOTATION

02:38 Payment submit        “Payment spinner
02:39 API request           remained visible
02:43 API response   ←      longer than expected.”

02:44 Order complete

Attached
screenshot.png
```

For Team+, this can later pair naturally with collaboration/mentions, but avoid promising shared-team capabilities on plans that do not include them.

---

# 33. Run modes section

Although the page is named Guided QA Runs, you should explain the neighboring modes.

### H2

> **Guided when you know the flow. Flexible when you don't.**

Use three large cards.

### Guided

> Tellann has a declared flow and helps you verify it.

```text
Best for:
Known workflow verification
```

### Assisted

> Navigate freely while Tellann observes which declared flow the activity most closely resembles and surfaces expectations without directing the run.

```text
Best for:
Exploration
Partially declared intent
```

### Observation Only

> Tellann records without prompting or directing and restricts itself to read-safe interactions.

```text
Best for:
Sensitive or shared targets
```

These modes and their intended use cases are directly defined in the demonstration specification. 

---

# 34. Run-mode interaction

Use a tabbed animation.

```text
[ Guided ] [ Assisted ] [ Observation Only ]
```

When changed:

### Guided

Flow rail has:

```text
Expected next
```

### Assisted

Flow rail changes to:

```text
Possible match
Checkout · 4 states observed
```

### Observation Only

Flow rail disappears.

Header:

```text
OBSERVATION ONLY
Read-safe interaction
```

Transition:

**250–350 ms**

---

# 35. Keep Guided as the hero

Do not dilute the page by making all three modes equally prominent.

Recommended hierarchy:

```text
GUIDED
primary page story

ASSISTED
secondary option

OBSERVATION ONLY
specialized option
```

The route is `/guided-qa-runs`, so Guided should account for about **70% of the story**.

---

# 36. From run to evidence

### H2

> **The run ends. The evidence keeps working.**

Use a transformation animation:

```text
GUIDED RUN
   ↓
EVENTS
   ↓
SESSION
   ↓
STATES
   ↓
TRANSITIONS
   ↓
WORKFLOW
   ↓
BEHAVIOR GRAPH
```

This is the formal session-processing sequence used by Developer Demonstration Mode. 

---

# 37. Follow immediately with outputs

```text
RUN COMPLETE

        ↓

Session Replay

Behavior Graph

Coverage

Reconciliation

Missing States

Missing Flows

Endpoint Analysis

QA Run Report
```

That clearly answers:

> Why should I perform the run?

---

# 38. Results section

### H2

> **Finish the walkthrough with more than a pass or fail.**

Use a results panel:

```text
CHECKOUT QA RUN

Outcome
COMPLETED

Evidence
418 in-flow events

Coverage
72%

Reconciliation
11 confirmed
3 true gaps
2 undeclared

Missing
Payment failure
Session timeout

Endpoints
2 slow
1 error-prone

[ Open Report ]
[ View Replay ]
```

The Phase 1 QA Run Report contains run context, evidence basis, coverage, reconciliation, missing states/flows, endpoint analysis, browser findings, annotations, artifacts and recommendations. 

---

# 39. QA Run Report section

### H2

> **Every run leaves behind a structured explanation of what was measured.**

This should probably be the second-largest screenshot after the hero.

Master:

**1600 × 1100 px**

Displayed:

**1100 × 755 px**

Layout:

```text
QA RUN REPORT

Checkout
RUN-4471

Mode
GUIDED

Outcome
COMPLETED

Flow boundary
Reached at 00:01:12

In-flow evidence
418 events

────────────────────────────

Coverage
72%

Reconciliation
11 confirmed
3 true gaps
2 undeclared

Missing States
Empty cart
Payment failure

Endpoint Findings
...
```

The report should open with its evidence basis rather than a composite quality score. 

---

# 40. No quality-score hero

Do not show:

```text
QA SCORE
87/100
```

on the Guided Run page.

Phase 1 explicitly does not publish a composite quality score for a single demonstration. 

Prefer:

```text
Measured:
418 events
72% declared-flow coverage
3 true gaps
2 undeclared states
```

Evidence > vanity number.

---

# 41. Session replay section

### H2

> **Replay the run with the evidence beside it.**

Layout:

```text
REPLAY                              EVIDENCE

┌─────────────────────┐           00:34 CART
│                     │           00:37 CHECKOUT
│ Browser replay      │           00:41 API
│                     │           00:42 PAYMENT
└─────────────────────┘

◀  01:23 / 04:18  ▶
```

Use:

**1600 × 950 master**

Display:

**1100 × 650**

CTA:

```text
Explore Session Replay →
```

---

# 42. Benefits by user class

Use four persona tabs:

```text
Developer
QA Engineer
Engineering Manager
Product Manager
```

On mobile use a selector.

---

# 43. Developer benefit

### H3

> **Show the behavior instead of spending the day explaining it.**

Benefits:

* walk the actual application;
* get structured evidence from real behavior;
* see frontend and backend activity in context;
* understand what states actually occurred;
* get a replay and report after the run;
* use results to find gaps before production.

Core line:

> **Use the application normally. Let Tellann structure what happened.**

---

# 44. QA Engineer benefit

This is probably the strongest persona for this page.

### H3

> **Run exploratory QA without losing the evidence trail.**

Benefits:

* start from a declared workflow;
* know which state you are trying to verify;
* separate setup navigation from the flow being evaluated;
* annotate unusual behavior during the run;
* preserve incomplete runs;
* receive coverage, reconciliation and missing-flow results.

Core:

> **Turn a walkthrough into repeatable QA evidence.**

---

# 45. Engineering Manager benefit

### H3

> **Get evidence behind the team's QA conclusions.**

Benefits:

* run mode is recorded;
* capture tracks are known;
* the evidence boundary is explicit;
* incomplete runs remain identifiable;
* findings link back to the run that produced them;
* reports show what was actually measured.

Core:

> **Know what the conclusion was based on—not just whether somebody said the flow passed.**

---

# 46. Product Manager benefit

### H3

> **See whether the intended user journey was actually demonstrated.**

Benefits:

* view the declared flow;
* see where the demonstration matched intent;
* identify undeclared behavior;
* review missing states;
* use replay to understand what occurred;
* discuss concrete evidence with QA and engineering.

Core:

> **Move the conversation from “I think it works” to “this is what we observed.”**

---

# 47. Trust section

### Eyebrow

```text
CONTROLLED OBSERVATION
```

### H2

> **The run observes the application without treating everything as collectable data.**

Use four trust cards.

### Protected values

Sensitive values are classified and protected.

### Scoped evidence

Only in-flow evidence drives coverage and reconciliation.

### Local source

Raw source remains on the developer's machine unless explicit named-purpose consent is provided.

### Read-safe mode

Observation Only restricts itself to read-safe interactions.

The desktop demonstration model is specifically designed around these controls.  

---

# 48. Do not expose raw secrets visually

Any marketing screenshot representing:

```text
Password
Access token
Card
API secret
```

should show:

```text
••••••••
```

or:

```text
[PROTECTED]
```

not realistic values.

---

# 49. Product video

This page absolutely deserves one primary video.

Title:

> **A Guided QA Run in 60 seconds**

Recommended duration:

**65–80 seconds**

Type:

* real Tellann Desktop UI;
* managed browser;
* lightweight motion graphics;
* screen-driven;
* no talking-head requirement.

---

# 50. Video storyboard

### 0–7 sec

Show Checkout declared flow.

Caption:

> You already know the workflow you want to verify.

### 7–15 sec

Tellann Desktop:

```text
Flow: Checkout
Mode: Guided
Frontend ✓
Backend ✓

[ Start Run ]
```

### 15–23 sec

Managed browser launches.

Status:

```text
Waiting for flow start
```

User navigates through login/setup.

### 23–29 sec

User reaches cart.

```text
Flow boundary reached
```

Caption:

> Tellann separates setup activity from the workflow evidence that matters.

### 29–43 sec

User:

* opens checkout;
* submits payment;
* reaches confirmation.

Flow steps check off on left.

### 43–50 sec

Show events:

```text
STATE
API
CLICK
RESPONSE
```

Caption:

> Browser and backend evidence stay connected to the same run.

### 50–58 sec

User adds annotation:

```text
“Payment response felt slow.”
```

### 58–64 sec

Run completes.

```text
PROCESSING
```

### 64–74 sec

Results appear:

```text
Coverage
Reconciliation
Missing states
Endpoint findings
Replay
```

### 74–80 sec

End card:

> **You demonstrate the workflow. Tellann explains what happened.**

CTA:

```text
Start with Tellann Desktop
```

---

# 51. Video dimensions

Master:

**1920 × 1080**

Display desktop:

**960 × 540**

Tablet/mobile:

responsive 16:9.

Poster:

**1600 × 900**

Formats:

```text
WebM
MP4 H.264
```

Captions:

mandatory.

No autoplay sound.

Hero may use an **8–10 second muted excerpt**, but not the full explainer.

---

# 52. “How it fits into Tellann” section

### H2

> **Guided Runs are where declared intent meets real behavior.**

Visual:

```text
Declare Flow
WHAT SHOULD HAPPEN

      ↓

Prepare Workspace

      ↓

Guided QA Run
YOU ARE HERE

      ↓

Observed Behavior
WHAT HAPPENED

      ↓

Behavior Graph

      ↓

Coverage
Reconciliation
Missing States
Missing Flows

      ↓

QA Report
```

This is the central Tellann story.

---

# 53. Related product distinction

Show a compact comparison:

| Capability        | Question answered                               |
| ----------------- | ----------------------------------------------- |
| Flow Declaration  | What should happen?                             |
| Guided QA Runs    | Can we demonstrate that behavior?               |
| Session Replay    | What happened during the walkthrough?           |
| Behavior Graph    | What behavior did Tellann observe?              |
| Coverage Analysis | How much of intended behavior was demonstrated? |
| Reconciliation    | Did observation match intent?                   |
| QA Reports        | What should the team review afterward?          |

---

# 54. Related feature cards

### Flow Declaration

> Define the workflow Tellann should guide.

`/product/flow-declaration`

### Automated Instrumentation

> Prepare the checkpoints Tellann needs to observe.

`/product/automated-instrumentation`

### Session Replay

> Revisit exactly what happened during the run.

`/product/session-replay`

### Reconciliation

> Compare the run against declared intent.

`/product/reconciliation`

### QA Reports

> Turn the run's evidence into something the team can review.

`/product/qa-reports`

---

# 55. Plan availability

Guided QA Runs are one of the best onboarding features because they are available across the entire pricing structure:

| Plan       | Guided QA Runs |
| ---------- | -------------- |
| Free       | Yes            |
| Local      | Yes            |
| Solo       | Yes            |
| Team       | Yes            |
| Business   | Yes            |
| Enterprise | Yes            |



This page therefore should **not** function as an aggressive upgrade page.

Instead, it should function as a **product activation page**.

Primary conversion goal:

```text
Install Desktop
→ Create application
→ Declare flow
→ Run first walkthrough
```

---

# 56. Free-plan callout

A useful section near the bottom:

> **Try the core Tellann workflow for free.**

Supporting:

> Guided QA Runs are available on Free. Start with one application and use the core demonstration workflow before deciding whether your workspace needs paid capabilities such as Codebase Intelligence or Automated Instrumentation.

This is consistent with Tellann's packaging strategy: the Desktop agent and Guided QA Runs are not gated because demonstration is foundational to the product. 

---

# 57. SEO title

Preferred:

> **Guided QA Runs — Turn Application Walkthroughs Into QA Evidence | Tellann**

Shorter alternative:

> **Guided QA Testing & Application Walkthroughs | Tellann**

I prefer the first because “QA evidence” better reflects the product.

---

# 58. Meta description

> Run real application workflows through Tellann Guided QA Runs. Capture frontend and backend behavior, track flow coverage, replay sessions, compare behavior with intent, and generate structured QA reports.

---

# 59. Primary keyword cluster

```text
guided QA testing
guided QA runs
application walkthrough testing
workflow QA testing
behavioral QA
application workflow testing
guided software testing
```

Secondary:

```text
QA session recording
workflow validation
application behavior testing
software walkthrough testing
QA evidence
behavior-driven QA
manual QA session recording
workflow coverage testing
```

Careful with:

```text
automated testing
AI testing
autonomous QA
```

Those terms can incorrectly imply Phase 3 capabilities.

---

# 60. Heading architecture

```text
H1
Walk through a workflow. Let Tellann turn it into evidence.

H2
A Guided QA Run is a controlled application walkthrough.

H2
Demonstrate the behavior instead of describing every action as a test.

H2
Start with the behavior you want to verify.

H2
Know what the run expects without turning it into a script.

H2
Tellann knows when the workflow actually begins.

H2
One walkthrough. Multiple layers of evidence.

H2
See the workflow from the browser and the server.

H2
A QA run can pause when the real world interrupts it.

H2
An interrupted run is not automatically useless.

H2
Capture what you notice while the evidence is still fresh.

H2
Guided when you know the flow. Flexible when you don't.

H2
The run ends. The evidence keeps working.

H2
Finish the walkthrough with more than a pass or fail.

H2
Every run leaves behind a structured explanation.

H2
Replay the run with the evidence beside it.

H2
Guided QA Runs for your role.

H2
Guided Runs are where declared intent meets real behavior.

H2
Frequently asked questions.

H2
Show Tellann the workflow. Keep the evidence.
```

---

# 61. FAQ

### What is a Guided QA Run?

A developer- or QA-led application walkthrough performed in Tellann's managed browser while Tellann observes the declared workflow and records evidence.

### Does Tellann perform the workflow automatically?

Not in Phase 1 Guided mode. The user performs the workflow; Tellann guides and observes it.

### Do I have to declare a flow first?

Guided mode is designed for a declared flow. Tellann also defines Assisted mode for exploration and partially declared intent. 

### What does Tellann record?

Depending on enabled capture tracks, it can capture browser actions, state transitions, API activity, errors and browser findings. 

### Does logging in count toward workflow coverage?

Not if it occurs before the defined flow boundary. Pre-boundary activity is retained for context but excluded from coverage and reconciliation. 

### Can I pause a run?

Yes. Pause and resume are part of the run lifecycle. 

### What if the browser closes before I finish?

Tellann can retain the evidence gathered and mark the run `COMPLETED_INCOMPLETE` rather than silently treating it as a complete run. 

### Do I get a report afterward?

Yes. The Phase 1 model generates a QA Run Report including evidence basis, coverage, reconciliation, missing states/flows, endpoint analysis, findings, annotations and artifacts. 

### Does Tellann calculate a quality score from the run?

Not in Phase 1. The report starts with measured evidence rather than a composite quality score. 

### Which plans include Guided QA Runs?

All plans currently include the capability entitlement. 

---

# 62. Things this page must not claim

Avoid:

```text
Tellann tests your application automatically.
```

That would imply autonomous test execution.

Use:

> Tellann guides and records a developer- or QA-led workflow demonstration.

Avoid:

```text
Replace your entire automated testing suite.
```

Unsupported and strategically unnecessary.

Avoid:

```text
Tellann knows whether your whole application works after one run.
```

One run provides evidence about what was demonstrated.

Avoid:

```text
0% coverage
```

when the initial boundary was never reached.

Use:

> No in-flow evidence gathered.

Avoid:

```text
AI watches you use the application and judges its quality.
```

Wrong architecture.

The Phase 1 analytical outputs are deterministic and evidence-based.

Avoid:

```text
Every action in the browser counts toward coverage.
```

Incorrect—the boundary model deliberately excludes pre-flow activity. 

---

# 63. Media inventory

| Asset                     | Type                | Master dimensions |    Display |
| ------------------------- | ------------------- | ----------------: | ---------: |
| Hero Guided Run UI        | HTML/CSS + fallback |         1600×1050 |   ~720×470 |
| Run configuration         | AVIF/WebP           |          1500×980 |   1000×650 |
| Guided browser split view | Interactive UI      |         1600×1000 |   1150×720 |
| Flow-boundary diagram     | SVG                 |          1400×650 |   1050×490 |
| Evidence timeline         | UI/AVIF             |          1500×850 |   1000×570 |
| Frontend/backend diagram  | SVG                 |          1400×760 |   1050×570 |
| Pause/incomplete state    | UI                  |          1200×760 |   ~800×500 |
| Annotation panel          | UI/AVIF             |          1400×850 |    950×575 |
| Run mode comparison       | HTML cards          |        responsive | ~1100 wide |
| Run-processing graphic    | SVG                 |          1400×600 |   1050×450 |
| Run result dashboard      | UI/AVIF             |          1500×950 |   1050×665 |
| QA Run Report             | AVIF/WebP           |         1600×1100 |   1100×755 |
| Session Replay            | AVIF/WebP           |          1600×950 |   1100×650 |
| Demo video                | WebM/MP4            |         1920×1080 |    960×540 |
| Video poster              | AVIF/WebP           |          1600×900 | responsive |

No stock photography is necessary.

---

# 64. Animation inventory

| Animation                         |         Duration |
| --------------------------------- | ---------------: |
| Run arm → start                   |        400–600ms |
| Flow step completion              |        250–400ms |
| Expected state change             |        200–300ms |
| Boundary highlight                |       900–1200ms |
| Evidence event arrival            |  100–180ms/event |
| Frontend/backend correlation line |        500–700ms |
| Pause/resume                      |        250–350ms |
| Annotation attach                 |        300–450ms |
| Run mode switch                   |        250–350ms |
| Run → graph transformation        |       700–1000ms |
| Result cards reveal               |     60–80ms/card |
| Replay timeline cursor            | tied to playback |

Avoid constant flashing “recording” effects.

A small static recording dot plus subtle pulse every few seconds is enough.

---

# 65. Responsive design

### Desktop

Use rich side-by-side layouts:

```text
Flow rail | Managed browser
```

and:

```text
Replay | Evidence
```

### Tablet

Use roughly 35/65 layouts where readable.

### Mobile

Do not shrink the desktop managed-browser UI.

Convert to:

```text
Checkout

Run status
RECORDING

Expected next
PAYMENT_SUBMITTED

────────────

Browser preview

────────────

Evidence
147 events

[ Pause ]
```

For the flow:

```text
✓ Cart
✓ Checkout
● Payment
○ Complete
```

For evidence:

show only the newest 3–4 timeline events with:

```text
View all evidence →
```

---

# 66. Analytics events

Recommended:

```text
GUIDED_QA_PAGE_VIEWED

GUIDED_QA_HERO_CTA_CLICKED

GUIDED_QA_INTERACTIVE_DEMO_STARTED

GUIDED_QA_DEMO_FLOW_STARTED

GUIDED_QA_DEMO_FLOW_COMPLETED

GUIDED_QA_BOUNDARY_EXPLAINER_VIEWED

GUIDED_QA_CAPTURE_TRACK_CHANGED

GUIDED_QA_RUN_MODE_SELECTED

GUIDED_QA_PAUSE_DEMO_CLICKED

GUIDED_QA_ANNOTATION_DEMO_USED

GUIDED_QA_REPORT_PREVIEW_OPENED

GUIDED_QA_REPLAY_CLICKED

GUIDED_QA_PERSONA_SELECTED

GUIDED_QA_VIDEO_STARTED

GUIDED_QA_VIDEO_COMPLETED

GUIDED_QA_DESKTOP_CLICKED

GUIDED_QA_SIGNUP_CLICKED

GUIDED_QA_FAQ_EXPANDED
```

Useful properties:

```text
persona
run_mode
capture_track
cta_location
demo_flow
device_class
video_progress
referrer
```

---

# 67. Structured data

Use:

```text
WebPage
SoftwareApplication
BreadcrumbList
FAQPage
VideoObject
```

Breadcrumb:

```text
Home
→ Product
→ Guided QA Runs
```

---

# 68. Final CTA

### H2

> **Show Tellann the workflow. Keep the evidence.**

Supporting:

> Start a Guided QA Run, walk through the real application, and turn what happened into replay, coverage, reconciliation and a structured QA report.

Primary:

```text
[ Start with Tellann Desktop ]
```

Secondary:

```text
[ Explore Flow Declaration ]
```

Small line:

> Guided QA Runs are included on every Tellann plan. 

---

# 69. Final page flow

The finished experience should read approximately like this:

```text
NAVIGATION

↓

HERO
Walk through a workflow.
Let Tellann turn it into evidence.

[interactive Guided Run]

↓

WHAT IS A GUIDED RUN?
Human-led
Tellann-guided
Evidence-driven

↓

NOT AN AUTOMATED SCRIPT
Use the real application

↓

CHOOSE A FLOW
Checkout
Login
Registration
etc.

↓

START THE RUN
Guided mode

↓

FLOW GUIDANCE
Current state
Expected next state
Terminal state

↓

FLOW BOUNDARIES
Setup activity
vs
Measured workflow

↓

CAPTURE
Browser
State
API
Errors
Findings

↓

FRONTEND + BACKEND
One correlated run

↓

PAUSE / RESUME
Real QA is not always linear

↓

INCOMPLETE RUNS
Evidence is preserved

↓

ANNOTATIONS & ARTIFACTS
Add human context

↓

RUN MODES
Guided
Assisted
Observation Only

↓

RUN → EVIDENCE
Events
→ Session
→ States
→ Workflow
→ Graph

↓

RESULTS
Coverage
Reconciliation
Missing states
Endpoints

↓

QA RUN REPORT
What was actually measured?

↓

SESSION REPLAY
See the walkthrough again

↓

BENEFITS BY ROLE
Developer
QA
Engineering Manager
Product Manager

↓

TRUST
Boundaries
Protected values
Local source
Read-safe mode

↓

60–80 SECOND VIDEO

↓

HOW IT FITS
Intent
→ Run
→ Behavior
→ Analysis
→ Report

↓

ALL PLANS

↓

RELATED FEATURES

↓

FAQ

↓

FINAL CTA

↓

FOOTER
```

The defining line for this page should be:

> **Guided QA Runs turn a human walkthrough into structured behavioral evidence.**

And inside the broader Tellann product family, the relationship becomes especially clean:

**Flow Declaration** says what should happen. **Guided QA Runs** provide the controlled walkthrough. **Session Replay** preserves what happened. **Behavior Graphs** model what was observed. **Coverage and Reconciliation** explain how that observation compares with intent. **QA Reports** turn the evidence into something the team can act on.
