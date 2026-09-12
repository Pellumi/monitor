For `/product/document-flow-inference`, the page should sell one very specific outcome:

> **Turn existing product documentation into reviewable workflow drafts instead of rebuilding those flows manually inside Tellann.**

The feature exists to **reduce the cost of stating intent**. Tellann processes customer-supplied product documents, produces candidate declared flows, and keeps every result as a proposal until a human explicitly accepts it. It is not allowed to use those drafts to manufacture behavior graphs, coverage results, findings, quality scores, or risk judgments. 

That distinction should define the entire marketing page.

# `/product/document-flow-inference` — Complete SEO Marketing Page Specification

## 1. Core positioning

The simplest explanation of the feature should be:

> **Your product documentation already describes how the application should work. Tellann helps turn that documentation into flows you can review, refine and declare.**

Do not market this as:

> AI reads your PRD and automatically knows how your application should behave.

That is too broad and contradicts the product's human-acceptance boundary.

A better conceptual equation is:

```text
Product documentation
        +
Tellann inference
        +
Human review
        =
Declared workflow draft
```

The formal architecture describes the Document Intelligence Engine as converting source-document versions into **intent drafts for human review**, with drafts never applied without review. 

---

# 2. Primary user problem

The page should establish this problem early:

A team may already have:

```text
PRDs
requirements
acceptance criteria
user stories
workflow descriptions
feature specifications
internal product documentation
```

Yet when QA starts, somebody still has to manually translate that material into:

```text
Login
  ↓
Authenticated
  ↓
Dashboard

Checkout
  ↓
Payment
  ↓
Confirmation
```

Document Flow Inference reduces that translation work.

Important: the current project specifications establish **customer-supplied product documents** and source-document versions, but they do **not** define a public supported-file-format matrix in the material retrieved here. Therefore the marketing page should avoid promises such as “Upload PDF, DOCX, Confluence, Notion and Jira” until those integrations or formats are formally defined. 

---

# 3. Page architecture

I would implement:

```text
/product/document-flow-inference
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Hero Document → Flow Demo
├── 04 The Manual Translation Problem
├── 05 What Document Flow Inference Does
├── 06 From Document to Candidate Flow
├── 07 Source Traceability
├── 08 Human Review & Acceptance
├── 09 Edit, Reject & Regenerate
├── 10 Multiple Candidate Flows
├── 11 From Draft to Declared Intent
├── 12 What Tellann Does Not Infer
├── 13 Benefits by User Class
├── 14 Product Workflow Integration
├── 15 Trust & Assisted Intelligence
├── 16 Product Demonstration Video
├── 17 Plan Availability
├── 18 Related Features
├── 19 FAQ
├── 20 Final CTA
└── 21 Footer
```

The page should feel closer to **“document → structured intent”** than to an AI-content-generation landing page.

---

# 4. Hero section

### Eyebrow

```text
DOCUMENT FLOW INFERENCE
```

Plan/status badge should be generated separately from your product capability source of truth.

Entitlement currently begins with Local:

```text
Free       No
Local      Standard
Solo       Advanced
Team       Advanced
Business   Advanced
Enterprise Advanced
```



Do not automatically convert that entitlement into an `AVAILABLE` status. Your SEO specification explicitly keeps **phase, implementation status and plan entitlement** separate. 

---

## 5. Hero H1

Preferred:

> **Turn product documentation into reviewable application flows.**

Alternative, more conversational:

> **Your requirements already describe the workflow. Let Tellann draft it.**

I prefer the first for SEO.

---

## 6. Hero supporting copy

> Import product documentation and let Tellann draft the application flows it describes. Review the states and paths, correct anything that is wrong, and explicitly accept only the intent your team actually means.

This accurately reflects the requirement that customer documents become candidate flows and every assisted output remains a proposal requiring explicit acceptance. 

---

## 7. Hero CTAs

Primary:

```text
[ Create flows from a document ]
```

Secondary:

```text
[ See how it works ↓ ]
```

Optional tertiary link:

```text
Declare flows manually →
```

This is strategically important because the underlying product must remain usable manually even when assisted intelligence is unavailable. 

---

# 8. Hero layout

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   HERO COPY                 DOCUMENT → FLOW               │
│   cols 1–5                 cols 6–12                     │
│                                                          │
│   H1                        Product Requirement           │
│   supporting               ┌─────────────────────┐       │
│   CTA                      │ User can checkout   │       │
│                            │ with saved card...  │       │
│                            └──────────┬──────────┘       │
│                                       ↓                  │
│                            Candidate Checkout Flow       │
│                            CART → PAYMENT → COMPLETE     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Dimensions:

* max content width: **1280–1360 px**
* hero minimum height: **760–820 px**
* text width: **450–500 px**
* visual width: **680–760 px**
* top/bottom padding: **104–128 px**

---

# 9. Hero visual

This should be an interactive simulated Tellann UI rather than a decorative illustration.

Master fallback asset:

**1600 × 1050 px**

Displayed:

approximately **720 × 475 px**

The visual should be divided into two panes.

### Left pane — source document

```text
Checkout Requirements

Users can review the items
in their cart before checkout.

After selecting Checkout,
the application requests payment.

If payment succeeds,
the order confirmation page appears.

If payment fails,
the user should be able to retry.
```

Highlight relevant phrases.

### Right pane — candidate flow

```text
CHECKOUT

CART_REVIEW
     ↓
CHECKOUT_STARTED
     ↓
PAYMENT_SUBMITTED
   ↙       ↘
FAILED    SUCCESS
  ↓          ↓
RETRY     ORDER_CONFIRMED
```

Bottom status:

```text
Candidate draft
Not yet part of declared intent
```

That line is extremely important.

---

# 10. Hero animation

Recommended loop length:

**7–9 seconds**, then stop or restart only after a long pause.

### 0–1.5 sec

Document appears.

### 1.5–3 sec

Phrase:

```text
“If payment succeeds…”
```

receives a subtle underline.

### 3–4 sec

Connector draws toward:

```text
PAYMENT_SUCCESS
```

### 4–5 sec

Phrase:

```text
“If payment fails…”
```

maps toward:

```text
PAYMENT_FAILED
```

### 5–6.5 sec

Candidate flow completes.

### 6.5–8 sec

Bottom action bar appears:

```text
[ Reject ]   [ Edit draft ]   [ Accept flow ]
```

Final caption:

> **Tellann drafts. Your team decides.**

No autoplaying “Accept” click. That would visually imply automatic acceptance.

---

# 11. First explanatory section

### Eyebrow

```text
FROM DOCUMENTS TO INTENT
```

### H2

> **Stop rewriting requirements as workflows by hand.**

Supporting copy:

> Product requirements often already contain the users, states, actions, branches and outcomes a QA team needs. Document Flow Inference helps structure that information into a draft Tellann flow your team can review.

Visual equation:

```text
REQUIREMENT

“When payment fails,
the customer can retry.”

             ↓

CANDIDATE FLOW

PAYMENT_SUBMITTED
      ↓
PAYMENT_FAILED
      ↓
RETRY_PAYMENT
```

---

# 12. “What it does” section

Use four cards.

### Extract workflow intent

Turns workflow descriptions into candidate states and transitions.

### Identify alternative paths

Surfaces branches implied by the document.

### Build complete draft flows

Groups related states into a reviewable workflow.

### Keep the human in control

Nothing becomes declared intent until accepted.

The MVP explicitly permits drafting candidate flows but prohibits adding anything to the Declared Intent Graph without explicit acceptance. 

---

# 13. “From document to candidate flow”

This should be the main process section.

### H2

> **From a paragraph to something your QA process can use.**

Use a five-stage horizontal visual:

```text
IMPORT
Product document

    ↓

PROCESS
Create source-document version

    ↓

DRAFT
Identify candidate flow

    ↓

REVIEW
Edit / accept / reject

    ↓

DECLARE
Accepted intent becomes part
of the application definition
```

The platform is formally required to process imported customer product documents into source-document versions before drafting candidate flows. 

---

# 14. Process visual dimensions

Interactive HTML/SVG preferred.

Master fallback:

**1500 × 650 px**

Displayed:

**1180 × 510 px**

Mobile:

vertical version:

```text
Import
 ↓
Process
 ↓
Draft
 ↓
Review
 ↓
Declare
```

Do not squeeze all five stages horizontally on mobile.

---

# 15. Source-document versioning section

This is useful because it communicates traceability without becoming too technical.

### H2

> **Know which document the draft came from.**

Visual:

```text
Checkout Requirements

Version 3
Updated 11 Sep 2026

        ↓

Candidate flow
Checkout v1 draft

Source
Checkout Requirements · v3
```

The system explicitly processes documents into **source document versions**, which means the marketing UI should visually retain source attribution instead of making a flow appear from nowhere. 

---

# 16. Source-trace visual

Recommended desktop UI:

**1400 × 860 px master**

Displayed:

**1000 × 615 px**

Layout:

```text
┌────────────────────┬────────────────────────────┐
│ DOCUMENT           │ FLOW DRAFT                 │
│                    │                            │
│ lines 42–57        │ PAYMENT_SUBMITTED          │
│ highlighted        │      ↓                     │
│                    │ PAYMENT_FAILED             │
│ Source v3          │      ↓                     │
│                    │ RETRY_PAYMENT              │
└────────────────────┴────────────────────────────┘
```

On hover over `PAYMENT_FAILED`, highlight the source sentence from which it was inferred.

That gives the user immediate explainability.

---

# 17. Review section

This should be one of the largest sections.

### H2

> **A suggestion is not the same thing as product truth.**

Supporting:

> Tellann's draft gives your team a starting point. The team decides what the application is actually intended to do.

Visual:

```text
CHECKOUT FLOW DRAFT

✓ CART_REVIEW
✓ CHECKOUT_STARTED
✓ PAYMENT_SUBMITTED

? PAYMENT_FAILED
  Suggested from:
  “If payment fails, the customer can retry.”

✓ RETRY_PAYMENT

[ Reject suggestion ]
[ Edit ]
[ Accept ]
```

The product explicitly requires assisted outputs to remain proposals. 

---

# 18. Whole-flow preview

Do not force people to approve individual nodes blindly.

Show a “Review full flow” interface:

```text
Candidate: Checkout

Entry
CART_REVIEW

States
6

Branches
2

Terminal states
ORDER_CONFIRMED
CHECKOUT_CANCELLED

────────────────

[ Preview graph ]

[ Reject draft ]   [ Apply accepted flow ]
```

The MVP includes whole-flow review with preview before apply. 

---

# 19. Edit, reject and regenerate

### H2

> **Wrong suggestion? Correct it instead of starting over.**

This is a good differentiator.

UI:

```text
Suggested

PAYMENT_FAILED
     ↓
RETRY_PAYMENT


Your correction

PAYMENT_DECLINED
     ↓
CHOOSE_ANOTHER_METHOD
     ↓
RETRY_PAYMENT


[ Regenerate draft ]
```

The FRS explicitly requires users to be able to correct a generated draft and regenerate from that correction. 

---

# 20. Regeneration animation

Sequence:

1. candidate node selected
2. user edits label
3. correction field appears
4. “Regenerate” clicked
5. surrounding branch reorganizes
6. new draft marked:

```text
Updated proposal
Requires review
```

Duration:

**1.2–1.8 sec**

No magic sparkle animation.

Use simple structural movement.

---

# 21. Multiple-flow discovery

A product document may imply several workflows.

Show:

```text
Product Requirements v5

3 candidate flows found

01  User registration
02  Password recovery
03  Checkout

[ Review registration ]
[ Review recovery ]
[ Review checkout ]
```

This is a reasonable representation of drafting candidate flows from customer-supplied documents, but do not put precise claims like “Tellann always discovers every workflow” because the specifications do not guarantee completeness. 

Use language such as:

> **Candidate flows found**

not:

> **All workflows discovered**

---

# 22. Confidence presentation

I would **not** display fake numeric AI confidence like:

```text
93.7% confidence
```

unless your actual implementation exposes a meaningful calibrated metric.

Instead use evidence-oriented labels:

```text
Directly described
Likely branch
Needs review
User corrected
Accepted
Rejected
```

Tellann's philosophy is much stronger when it tells users **what state the proposal is in** rather than inventing precision.

---

# 23. From draft to Declared Intent

### H2

> **Accepted flows become something Tellann can compare against evidence.**

Show progression:

```text
Product Document

      ↓

Candidate Flow
PROPOSAL

      ↓ human accepts

Declared Intent
WHAT SHOULD HAPPEN

      ↓ demonstration

Observed Behavior
WHAT DID HAPPEN

      ↓

Reconciliation
WHAT IS DIFFERENT
```

This connects the feature directly to Tellann's central value proposition.

The Declared Intent Graph is specifically meant to give coverage and reconciliation a human-declared baseline rather than treating absence as proof of incompleteness. 

---

# 24. Key marketing message

Use a large typography callout:

> **Documents describe intention. Demonstrations provide evidence. Tellann connects the two.**

This is probably the strongest sentence on the page after the hero.

---

# 25. “What Tellann does not do” section

This feature especially needs boundaries because otherwise visitors may interpret it as an AI QA engine.

### H2

> **Drafting intent is not judging quality.**

Use two columns.

### Document Flow Inference can help with

```text
Drafting candidate flows
Suggesting states
Suggesting branches
Structuring documented intent
Preparing flows for review
```

### It does not decide

```text
Whether your application is high quality
Whether a workflow actually works
What coverage you achieved
Whether behavior matches intent
Severity of QA findings
A quality or risk score
```

The Phase 1 boundary explicitly prohibits model-generated behavioral graphs, coverage, reconciliation, findings, severity and quality/risk judgments. 

This section substantially increases credibility.

---

# 26. Do not market it as the core AI product

Your MVP scope literally states:

> Assisted intelligence is never marketed as the product. The product is behavioral evidence. 

So avoid:

```text
AI-powered QA starts with your documents.
```

Prefer:

> **Use your documents to get to behavioral evidence faster.**

That keeps Tellann differentiated.

---

# 27. Benefits by user class

Use four persona tabs:

```text
Developer
QA Engineer
Engineering Manager
Product Manager
```

Desktop:

horizontal tabs.

Mobile:

```text
I'm a:
[ QA Engineer ▾ ]
```

---

# 28. Developer benefit

### H3

> **Spend less time translating requirements before you can instrument and demonstrate.**

Benefit copy:

A developer can start from a reviewed workflow draft rather than manually reconstructing every product flow from a PRD before binding it to the codebase.

Useful outcomes:

* clearer flows before instrumentation;
* fewer back-and-forth conversations about expected behavior;
* accepted intent can later be mapped to code checkpoints;
* corrections are made before the demonstration begins.

Core sentence:

> **Know what the workflow is supposed to represent before touching the code.**

---

# 29. QA Engineer benefit

### H3

> **Turn written requirements into a QA baseline faster.**

This may be the strongest persona for this feature.

Benefits:

* quickly convert requirements into candidate workflows;
* surface branches hidden inside prose;
* review failure and alternative paths before testing;
* avoid manually recreating the same workflow structure in another tool;
* use accepted flow intent later for reconciliation and coverage.

Core:

> **Spend more time validating behavior and less time transcribing requirements.**

---

# 30. Engineering Manager benefit

### H3

> **Make intended behavior explicit before teams measure it.**

Benefits:

* create a shared representation of expected workflows;
* reduce ambiguity between product, development and QA;
* preserve a review step before inferred intent becomes authoritative;
* establish traceable intent that can later be compared to demonstrations;
* ensure AI assistance remains outside the actual analytical path.

Core message:

> **Align teams around reviewed intent—not an AI-generated assumption.**

The Assistive Intelligence layer is structurally separated from the analytical engines; graphs, coverage and reconciliation do not depend on it. 

---

# 31. Product Manager benefit

This is probably the second-strongest persona.

### H3

> **Turn product thinking into something engineering and QA can verify.**

Benefits:

* reuse existing product documentation;
* review how Tellann interpreted important user journeys;
* correct misunderstood paths;
* accept the intended experience;
* later compare that intent with demonstrated behavior.

Core:

> **Make the product specification testable without becoming a QA engineer.**

---

# 32. Persona interaction visual

Keep one core document and change the right-hand explanation per role.

Example:

```text
QA Engineer
───────────
“Which branches should I test?”

Developer
─────────
“Which flow needs to be instrumented?”

Product Manager
──────────────
“Did Tellann interpret the requirement correctly?”

Engineering Manager
───────────────────
“Are teams using the same definition of expected behavior?”
```

Do not create four nearly identical 800 px sections.

---

# 33. Document review UI

One high-fidelity UI screenshot should show the actual product concept.

Master:

**1600 × 1050 px**

Displayed:

**1100 × 720 px**

Contents:

```text
Source Documents

checkout-requirements
Version 4

────────────────────────────────

Candidate Flows                         Status

Checkout                                Needs review
Payment failure recovery                Needs review
Order cancellation                      Accepted

────────────────────────────────

Selected: Checkout

Source references                 Flow preview
lines 18–31                       CART
lines 42–46                         ↓
                                 CHECKOUT
                                    ↓
                                 PAYMENT
```

---

# 34. Document upload imagery

Avoid giant cloud-upload illustrations.

Use a restrained product interface:

```text
Add product document

[ Select document ]

Name
Checkout Requirements

Application
Storefront

Description
Optional

[ Import document ]
```

Dimensions:

* master screenshot: **1200 × 760 px**
* displayed: **760 × 480 px**

Since supported file formats are not established in the retrieved specification, do not show a row like:

```text
PDF DOCX TXT MD
```

until that capability is formally defined.

---

# 35. “Human review” animation

This can be one of the strongest page interactions.

Candidate branch:

```text
PAYMENT
├── SUCCESS → CONFIRMATION
└── FAILURE → RETRY
```

Hover `FAILURE`.

Side panel:

```text
Why was this suggested?

Source:
“If payment fails,
the user may retry payment.”

Document:
Checkout Requirements v4

[ Reject ]
[ Edit ]
[ Accept ]
```

This immediately explains how the product works.

---

# 36. Suggestion lifecycle

Use subtle states:

```text
SUGGESTED
    ↓
REVIEWED
 ┌────┴────┐
 ↓         ↓
ACCEPTED  REJECTED
```

Rejected suggestions should not simply disappear conceptually; the underlying Flow Declaration specification retains rejected suggestions so Tellann does not repeatedly re-suggest the same thing. 

You do not need to explain the storage mechanism publicly, but you can say:

> **Reject a suggestion once rather than repeatedly fighting the same draft.**

---

# 37. Trust / assisted intelligence section

### Eyebrow

```text
ASSISTANCE, NOT AUTHORITY
```

### H2

> **Tellann can help state intent without becoming the source of truth.**

Four trust cards:

**Proposal only**

> Generated flows start as drafts.

**Human acceptance**

> Nothing enters declared intent without explicit approval.

**Analysis stays evidence-based**

> Coverage, reconciliation and findings come from recorded evidence, not generated text.

**Product keeps working**

> Manual flow declaration remains available even if assistance is unavailable.

These boundaries are explicitly established by the MVP Assisted Intelligence rules. 

---

# 38. Deterministic-before-assisted messaging

You can mention this, but keep it simple.

Do not expose:

```text
Tier 1
Tier 1.5
Tier 2
```

on the main marketing flow unless this becomes important for technical buyers.

Instead say:

> **Tellann uses structured rules and known patterns first, and only falls back to bounded assistance where necessary.**

The architecture requires deterministic paths to be consulted first; assisted enrichment is a fallback. 

That is a very good trust signal.

---

# 39. Technical trust drawer

For technical visitors, include:

```text
How assistance is bounded →
```

Expanding reveals:

```text
• Inputs are sanitized before assisted processing.
• Outputs are schema validated.
• Malformed outputs are repaired or rejected.
• Every invocation is logged.
• Generated content remains a proposal.
• Analytical engines do not depend on the model provider.
```

These constraints are formally specified. 

---

# 40. Product video

Recommended title:

> **Turn a product document into a Tellann flow in 60 seconds**

Duration:

**65–80 seconds**

Format:

Real UI + subtle motion graphics.

Do not use a talking head as the primary video.

---

# 41. Video storyboard

### 0–7 sec

Show a long product requirements document.

Caption:

> Your requirements already describe what the product should do.

### 7–14 sec

User imports document.

> Tellann processes the document into a version it can reference.

### 14–25 sec

Relevant sentences highlight.

Candidate flow forms beside document.

> It drafts the workflows described inside it.

### 25–36 sec

Show:

```text
Checkout
Password recovery
Order cancellation
```

> Each becomes a candidate—not declared truth.

### 36–48 sec

User opens Checkout.

Edits one branch.

Rejects another.

### 48–56 sec

Clicks:

```text
Accept flow
```

Draft becomes:

```text
DECLARED
```

### 56–67 sec

Transition:

```text
Declared Intent
       vs
Observed Behavior
```

> Once accepted, the flow gives Tellann something real demonstrations can be compared against.

### 67–75 sec

Show evidence boundary:

```text
Documents → help state intent
Demonstrations → provide evidence
```

### 75–80 sec

End card:

> **Turn documentation into intent. Then validate it with evidence.**

CTA:

```text
Start with Tellann
```

---

# 42. Video technical specification

Master:

**1920 × 1080**

Website display:

**960 × 540 px**

Formats:

* WebM
* MP4 H.264 fallback

Poster:

**1600 × 900 px AVIF/WebP**

Behavior:

* no autoplay sound;
* optional muted **8–12 second** excerpt;
* captions mandatory;
* poster lazy-loaded below fold.

---

# 43. How it fits into the Tellann workflow

### H2

> **Start with what should happen. Then show Tellann what actually happens.**

Visual:

```text
Product document
      ↓
Document Flow Inference
      ↓
Candidate flow
      ↓
Human review
      ↓
Declared Intent
      ↓
Codebase mapping
      ↓
Instrumentation
      ↓
Developer demonstration
      ↓
Observed Behavior
      ↓
Reconciliation
```

This section is essential because otherwise visitors may assume Document Flow Inference is a standalone requirements-analysis product.

---

# 44. Product-page relationship

The conceptual distinction should be very clear:

```text
Document Flow Inference
“What might the document be saying?”

Flow Declaration
“What do we officially say should happen?”

Developer Demonstration
“What did we show the application doing?”

Behavior Graph
“What behavior did Tellann observe?”

Reconciliation
“Does observed behavior match declared intent?”
```

This makes the product family much easier to understand.

---

# 45. Related feature cards

Use four.

### Flow Declaration

> Review and formally declare how an application should behave.

Route:

```text
/product/flow-declaration
```

### Reconciliation

> Compare accepted intent with demonstrated behavior.

```text
/product/reconciliation
```

### Codebase Intelligence

> Locate where accepted flows live in the source code.

```text
/product/codebase-intelligence
```

### Automated Instrumentation

> Add the observation checkpoints needed to demonstrate those flows.

```text
/product/automated-instrumentation
```

---

# 46. Plan availability

Current entitlement matrix:

| Plan       | Document Flow Inference |
| ---------- | ----------------------- |
| Free       | No                      |
| Local      | Standard                |
| Solo       | Advanced                |
| Team       | Advanced                |
| Business   | Advanced                |
| Enterprise | Advanced                |



Important: the retrieved specifications establish `STANDARD` and `ADVANCED` entitlement levels, but do not give enough customer-facing detail here to claim specific behavioral differences between Standard and Advanced Document Flow Inference.

So for now, do **not** invent:

```text
Standard = 5 documents/month
Advanced = unlimited
```

or:

```text
Standard = 1 flow/document
Advanced = unlimited flows
```

unless that gets formally defined.

A simple plan CTA is enough:

> Available from Local. Advanced entitlement from Solo upward.

---

# 47. Free-plan messaging

Don't frame Free users negatively.

Instead:

> **Flow Declaration still works without Document Flow Inference.**

Then:

> Free users can define flows manually. Document Flow Inference reduces the work of turning existing product documentation into those declarations.

This aligns with the requirement that underlying capabilities remain usable manually when assistance is unavailable. 

---

# 48. FAQ

Recommended questions:

### What is Document Flow Inference?

> It converts customer-supplied product documentation into candidate application flows for human review.

### Does Tellann automatically add inferred flows to my application definition?

> No. Every assisted result remains a proposal until explicitly accepted. 

### Can I edit an inferred flow?

> Yes. Generated drafts can be corrected, and Tellann supports regenerating from a user's correction. 

### What happens if Tellann interprets my requirement incorrectly?

> Edit or reject the suggestion. The document is an input to drafting—not an authority over your intended behavior.

### Does Document Flow Inference generate my Behavior Graph?

> No. Behavioral graphs are produced from observed evidence, not from assisted document inference. 

### Does it calculate coverage?

> No. Coverage is computed from behavioral evidence after demonstration.

### Does it determine whether a workflow is good or bad?

> No. Phase 1 assisted intelligence is specifically prohibited from generating quality or risk judgments. 

### Does Tellann still work without its assistance provider?

> Yes. Manual declaration and Tellann's analytical capabilities remain operational; only suggestion quality is reduced. 

### Which plans include it?

> Local includes Standard entitlement; Solo, Team, Business and Enterprise include Advanced entitlement. 

---

# 49. Things this page must not say

Avoid:

```text
Tellann automatically understands your entire PRD.
```

Too strong.

Use:

> Tellann drafts candidate flows from your product documentation.

Avoid:

```text
AI creates your QA plan.
```

Wrong scope.

Avoid:

```text
Upload your PRD and Tellann knows how your application should work.
```

The human remains authoritative.

Avoid:

```text
Automatically generate your Behavior Graph from documentation.
```

Incorrect. Behavior Graphs come from evidence.

Avoid:

```text
AI detects missing functionality from your requirements.
```

That conflates drafting intent with evidence-based missing-flow analysis.

Avoid:

```text
Instantly validate your product requirements.
```

Document Flow Inference structures intent; it does not validate correctness.

---

# 50. SEO title

Preferred:

> **Document Flow Inference for Software QA | Tellann**

Alternative:

> **Turn Product Requirements Into Application Flows | Tellann**

I would probably use:

```text
Document Flow Inference — Turn Requirements Into QA Flows | Tellann
```

---

# 51. Meta description

> Turn product documentation into reviewable application flow drafts with Tellann. Extract candidate workflows, edit inferred states and branches, and accept only the intent your team approves.

---

# 52. Keyword strategy

Primary:

```text
document flow inference
requirements to workflow
product requirements workflow
software workflow extraction
application flow generation
```

Secondary:

```text
PRD to test flow
requirements to QA workflow
software requirements analysis
application workflow modeling
QA workflow planning
product requirement testing
behavioral QA
declared application intent
```

Use “AI” sparingly.

Possible long-tail:

```text
convert product requirements into QA workflows
turn software requirements into test flows
generate workflows from product documentation
```

---

# 53. Heading structure

```text
H1
Turn product documentation into reviewable application flows.

H2
Stop rewriting requirements as workflows by hand.

H2
From a paragraph to something your QA process can use.

H2
Know which document the draft came from.

H2
A suggestion is not the same thing as product truth.

H2
Wrong suggestion? Correct it instead of starting over.

H2
Turn candidate flows into declared intent.

H2
Drafting intent is not judging quality.

H2
Document Flow Inference for your role.

H2
Tellann can help state intent without becoming the source of truth.

H2
Start with what should happen. Then show Tellann what actually happens.

H2
Frequently asked questions.

H2
Your documentation already contains the intent. Put it to work.
```

---

# 54. Media inventory

| Asset                       | Type                 |    Master |    Display |
| --------------------------- | -------------------- | --------: | ---------: |
| Hero document → flow        | Interactive HTML/SVG | 1600×1050 |   ~720×475 |
| Document process pipeline   | SVG                  |  1500×650 |   1180×510 |
| Source-to-flow trace        | UI/AVIF              |  1400×860 |   1000×615 |
| Full flow review            | UI/AVIF              | 1600×1050 |   1100×720 |
| Correction/regeneration     | Interactive UI       |  1400×850 |   ~950×575 |
| Candidate-flow dashboard    | UI/AVIF              | 1600×1050 |   1100×720 |
| Declared-vs-observed visual | SVG                  |  1400×800 |   1050×600 |
| Trust boundary graphic      | SVG                  |  1200×620 |    900×465 |
| Explainer video             | WebM/MP4             | 1920×1080 |    960×540 |
| Video poster                | AVIF/WebP            |  1600×900 | responsive |

I would use **no stock photography** on this page.

The product concept itself is visual enough.

---

# 55. Animation inventory

| Interaction                  |   Duration |
| ---------------------------- | ---------: |
| Document phrase highlight    |  250–350ms |
| Phrase → state connector     |  600–800ms |
| Candidate node reveal        |  250–400ms |
| Branch construction          |  500–700ms |
| Accept/reject state          |  200–300ms |
| Edit/regenerate transition   | 800–1200ms |
| Source reference hover       |  150–250ms |
| Draft → declared transition  |  500–700ms |
| Persona switch               |  200–300ms |
| Workflow connector animation |  600–900ms |

Avoid:

* glowing AI orbs;
* magic particles;
* constantly moving text;
* “neural network” imagery;
* robot icons;
* fake typing loops.

The UI should communicate **structured assistance**, not “magic AI.”

---

# 56. Responsive behavior

Desktop:

```text
SOURCE DOCUMENT | CANDIDATE FLOW
```

Tablet:

Still side-by-side where readable.

Mobile:

Use sequential cards:

```text
Source requirement
        ↓
Candidate state
        ↓
Source requirement
        ↓
Candidate state
```

For flow graphs on mobile, use vertical structure rather than horizontally shrinking complex graphs.

Example:

```text
CART
 ↓
CHECKOUT
 ↓
PAYMENT
 ├─ Success
 │    ↓
 │ Confirmation
 │
 └─ Failed
      ↓
    Retry
```

---

# 57. Analytics

Track:

```text
DOCUMENT_FLOW_PAGE_VIEWED
DOCUMENT_FLOW_HERO_CTA_CLICKED
DOCUMENT_FLOW_DEMO_STARTED
DOCUMENT_FLOW_SOURCE_HOVERED
DOCUMENT_FLOW_CANDIDATE_OPENED
DOCUMENT_FLOW_DEMO_ACCEPTED
DOCUMENT_FLOW_DEMO_REJECTED
DOCUMENT_FLOW_DEMO_EDITED
DOCUMENT_FLOW_REGENERATE_CLICKED
DOCUMENT_FLOW_PERSONA_SELECTED
DOCUMENT_FLOW_VIDEO_STARTED
DOCUMENT_FLOW_VIDEO_COMPLETED
DOCUMENT_FLOW_DECLARATION_CLICKED
DOCUMENT_FLOW_RECONCILIATION_CLICKED
DOCUMENT_FLOW_PRICING_CLICKED
DOCUMENT_FLOW_SIGNUP_CLICKED
DOCUMENT_FLOW_FAQ_EXPANDED
```

Useful metadata:

```text
persona
cta_location
candidate_flow
demo_action
device_class
video_progress
source_section
```

---

# 58. Structured data

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
→ Document Flow Inference
```

---

# 59. Final CTA

### H2

> **Your documentation already contains the intent. Put it to work.**

Supporting:

> Let Tellann turn existing product requirements into workflow drafts your team can review, correct and declare.

Primary:

```text
[ Start with Tellann ]
```

Secondary:

```text
[ Explore Flow Declaration ]
```

Optional small line:

```text
Document Flow Inference is available from Local plan.
```

---

# 60. Final recommended page flow

```text
NAVIGATION

↓

HERO
Turn product documentation
into reviewable application flows.

[document → candidate graph]

↓

STOP REWRITING REQUIREMENTS
AS FLOWS BY HAND

↓

DOCUMENT → DRAFT
Import
Process
Infer
Review
Declare

↓

SOURCE TRACEABILITY
See exactly where the suggestion came from

↓

HUMAN REVIEW
Accept
Edit
Reject

↓

CORRECT & REGENERATE
Tellann adapts to the human correction

↓

MULTIPLE CANDIDATE FLOWS
Review workflows individually

↓

DECLARED INTENT
Accepted flow becomes the baseline

↓

NOT A QUALITY JUDGEMENT
Documents state intent
Evidence measures behavior

↓

BENEFITS BY ROLE
Developer
QA Engineer
Engineering Manager
Product Manager

↓

TRUST
Proposal only
Human acceptance
Evidence-based analysis
Manual fallback

↓

60–80 SECOND DEMO

↓

HOW IT FITS
Document
→ Intent
→ Code
→ Instrument
→ Demonstrate
→ Reconcile

↓

PLANS

↓

RELATED FEATURES

↓

FAQ

↓

FINAL CTA

↓

FOOTER
```

The defining line for `/product/document-flow-inference` should be:

> **Tellann does not turn documentation into truth. It turns documentation into a draft your team can turn into truth.**

And inside the wider Tellann product family, the distinction becomes very clean:

**Document Flow Inference** helps extract what the documentation appears to intend. **Flow Declaration** establishes what the team officially intends. **Developer Demonstration** captures what the application actually does. **Reconciliation** shows the difference.
