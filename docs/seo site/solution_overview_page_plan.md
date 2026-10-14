# `/solutions` — Complete SEO Marketing Page Specification

The `/solutions` page should **not behave like another `/product` page**.

The distinction should be:

> **Product pages:** “What does Tellann do?”  
> **Solutions pages:** “What does Tellann do for someone like me?”

That matters because Tellann has several audiences with very different reasons for caring about the same underlying behavioral intelligence. The PRD explicitly identifies Software Engineers, QA Engineers, Engineering Managers, Product Teams, Startup Teams, SaaS businesses, and enterprise organizations as distinct audiences with different needs. prd

For the current marketing site, the strongest promise remains the Phase 1 proposition: a team states what software should do, demonstrates it, and Tellann shows the gap between intention and observed behavior. It should **not** market autonomous QA, self-healing software, production monitoring, or similar future capabilities as if they exist today. mvp_scope

---

# 1. Primary purpose of `/solutions`

The page should answer four questions within the first 20–30 seconds:

```text
Is Tellann relevant to someone in my role?

What problem does it remove for me?

What will I actually get from it?

Where do I go to learn more?
```

The page is primarily a **segmentation + conversion hub**.

It should take someone arriving through search, social media, referral, or the Solutions mega-menu and very quickly route them toward:

```text
Software Engineers
QA Engineers
Engineering Leaders
Product Teams
Startup Teams
Organizations / Enterprise
```

---

# 2. Recommended Solutions route family

I would establish this structure:

```text
/solutions
│
├── /solutions/developers
├── /solutions/qa-teams
├── /solutions/engineering-leaders
├── /solutions/product-teams
├── /solutions/startups
└── /solutions/enterprise
```

I would **not create separate pages for every conceivable job title**.

For example:

```text
Senior Developer
Frontend Developer
Backend Developer
Full-Stack Developer
Platform Engineer
```

all belong under:

```text
/solutions/developers
```

Similarly:

```text
CTO
VP Engineering
Head of Engineering
Engineering Manager
Technical Lead
```

can be grouped under:

```text
/solutions/engineering-leaders
```

This keeps the SEO architecture meaningful instead of generating thin, repetitive pages.

---

# 3. Overall page structure

I recommend:

```text
/solutions
│
├── 01 Navigation
├── 02 Solutions Hero
├── 03 Audience Selector
├── 04 Core Problem / Tellann Difference
├── 05 Solution — Developers
├── 06 Solution — QA Teams
├── 07 Solution — Engineering Leaders
├── 08 Solution — Product Teams
├── 09 Solution — Startups
├── 10 Solution — Organizations / Enterprise
├── 11 How Tellann Works
├── 12 One Platform, Different Outcomes
├── 13 Capability-to-Outcome Grid
├── 14 Privacy / Security Trust Section
├── 15 Future Growth / Platform Evolution
├── 16 Solutions FAQ
├── 17 Final CTA
└── 18 Footer
```

This should be approximately **7,000–9,000 px long on desktop**, depending on final copy density.

---

# 4. Section 01 — Navigation

Use the global Tellann marketing navbar.

Solutions should appear as a mega-menu category.

Example:

```text
Solutions

By role
─────────────────
Developers
QA Teams
Engineering Leaders
Product Teams

By organization
─────────────────
Startups
Enterprise

Explore
─────────────────
All Solutions →
```

`All Solutions →` leads here:

```text
/solutions
```

The navigation should not display feature names like:

```text
Behavior Graph
Session Replay
Endpoint Intelligence
```

Those belong under **Product**.

---

# 5. Section 02 — Hero

## Layout

Desktop:

```text
┌──────────────────────────────────────────────────────┐

              SOLUTIONS

       See software quality
       from where you stand.

 Developers, QA teams, product teams and engineering
 leaders all ask different questions about quality.
 Tellann turns demonstrated application behavior into
 evidence each team can understand and act on.

      [ Find your solution ]
      [ See how Tellann works ]

                   ↓

          HERO PRODUCT VISUAL

└──────────────────────────────────────────────────────┘
```

Suggested H1:

> **See software quality from where you stand.**

Alternative:

> **Quality intelligence for every team that ships software.**

I prefer the first because it naturally introduces persona segmentation.

### Supporting copy

> Developers need to understand behavior. QA teams need to find gaps. Product teams need clarity around intended workflows. Engineering leaders need confidence. Tellann gives each team a shared view of what the application was intended to do and what was actually demonstrated.

### CTA 1

**Find your solution**

Scroll:

```text
#choose-your-role
```

### CTA 2

**See how Tellann works**

Could lead to:

```text
/product
```

or a page anchor:

```text
/solutions#how-it-works
```

---

# 6. Hero visual

Do **not** use a generic photograph of programmers staring at monitors.

The strongest visual is Tellann's core idea.

## Visual concept

```text
DECLARED INTENT                 OBSERVED BEHAVIOR

Checkout                       Checkout
  │                              │
  ├ Payment Success             ├ Payment Success
  ├ Payment Failure             ├ Payment Failure
  └ Retry Payment               │
                                 └───────── missing


                 ↓

             TELLANN

                 ↓

       ✓ 2 paths confirmed
       ! 1 gap discovered
```

This directly expresses Tellann's central proposition.

The underlying product model compares what a team says should happen against what was actually observed. mvp_scope

### Desktop dimensions

Container:

```text
Width: 1180–1280px
Height: 560–640px
Max width: 1280px
Aspect ratio: ~2:1
```

Placed:

```text
32–48px below hero CTAs
```

### Mobile

```text
Width: calc(100vw - 32px)
Height: 420–500px
```

Transform the horizontal comparison into:

```text
DECLARED
   ↓
OBSERVED
   ↓
GAP
```

rather than squeezing two graphs next to one another.

---

# 7. Hero animation

This deserves a restrained animation.

Sequence:

```text
0.0s
Declared graph appears

0.5s
Observed graph builds node-by-node

1.4s
Matching nodes connect

2.0s
Missing branch becomes visible

2.5s
"Gap detected" appears

3.0s
Tellann report card fades upward
```

Duration:

```text
3–4 seconds
```

Then settle into a static state.

Do **not** infinitely animate graph nodes.

The visitor must be able to read the visual.

Respect:

```css
prefers-reduced-motion
```

and immediately render the completed state when enabled.

---

# 8. Section 03 — “Choose what matters to you”

This is arguably the most important portion of `/solutions`.

## Heading

> **What does quality mean to your team?**

Supporting:

> The same application can create very different questions depending on who is looking at it.

Then show six cards.

Desktop:

```text
3 columns × 2 rows
```

Tablet:

```text
2 × 3
```

Mobile:

```text
1 × 6
```

Card dimensions desktop:

```text
Width: ~376px
Min-height: 260px
Padding: 28–32px
Border-radius: 12–16px
```

---

# 9. Audience card — Software Engineers

Icon:

```text
</>
```

Heading:

> **For Developers**

Problem:

> Stop piecing application behavior together from scattered logs, test cases and assumptions.

Value:

```text
See workflows as Tellann observed them.
Inspect states and transitions.
Replay demonstration sessions.
Understand endpoint behavior.
Find missing paths.
```

Outcome statement:

> **Understand what your application actually demonstrated—not merely what the code was supposed to do.**

CTA:

```text
Explore Tellann for Developers →
```

Route:

```text
/solutions/developers
```

---

# 10. Audience card — QA Engineers

Icon:

```text
✓ / inspection mark
```

Heading:

> **For QA Teams**

Problem:

> Knowing what you tested is useful. Knowing what you missed is more valuable.

Tellann supports workflow, state, transition, endpoint and error coverage, alongside missing-flow analysis. mvp_scope

Benefits:

```text
Measure behavioral coverage
Identify missing states
Find missing failure paths
Review application workflows
Generate QA reports
Prioritize what needs attention
```

Outcome:

> **Turn a walkthrough into evidence for where testing effort should go next.**

CTA:

```text
Explore Tellann for QA →
```

---

# 11. Audience card — Engineering Leaders

Heading:

> **For Engineering Leaders**

Problem:

> Release confidence should not depend entirely on asking, “Did all the tests pass?”

Benefits:

```text
See coverage across important workflows
Understand identified quality gaps
Review evidence-backed QA reports
Create a shared behavioral picture
Reduce fragmented quality information
```

Outcome:

> **Give engineering discussions a common source of behavioral evidence.**

CTA:

```text
Explore Tellann for Engineering Leaders →
```

Be careful here.

Do not currently promise:

```text
"Know whether production is healthy in real time"
```

because continuous production monitoring belongs outside the current MVP. The MVP explicitly excludes production traffic monitoring. mvp_scope

---

# 12. Audience card — Product Teams

Heading:

> **For Product Teams**

Problem:

> Product requirements describe what should happen. Implementation tells another story.

Benefits:

```text
Declare intended workflows
Compare intent against demonstrated behavior
See unexpected states
See workflows not demonstrated
Understand implementation gaps
Share behavioral evidence with engineering
```

Outcome:

> **Turn product intent into something that can actually be checked against the software.**

CTA:

```text
Explore Tellann for Product Teams →
```

This is one of Tellann's strongest differentiators.

---

# 13. Audience card — Startups

Heading:

> **For Startups**

Problem:

> Small teams rarely have unlimited QA resources.

Benefits:

```text
Create QA visibility with a small team
Discover workflows automatically
Find overlooked states and paths
Generate structured reports
Reduce manual workflow documentation
Build quality practices earlier
```

Outcome:

> **Get structured QA intelligence without building a large quality organization first.**

CTA:

```text
Explore Tellann for Startups →
```

Startup founders are explicitly included among Tellann's primary MVP audiences. mvp_scope

---

# 14. Audience card — Enterprise / Organizations

Treat this card differently.

Heading:

> **For Growing Organizations**

Rather than:

> Built for complex global enterprises.

That would currently overstate the MVP.

Benefits can safely focus on:

```text
Shared application visibility
Role-based collaboration
Privacy controls
Retention policies
Reporting
Multiple applications
Governance-oriented platform architecture
```

CTA:

```text
Explore Enterprise →
```

Route:

```text
/solutions/enterprise
```

Enterprise Operations, SRE and Security Operations teams are explicitly outside the MVP target audience, so this section should sell organizational scalability and governance—not production operations tooling that Tellann does not yet provide. mvp_scope

---

# 15. Card interaction animation

On hover:

```text
border luminance +10%
arrow moves 4px right
icon line animates
background changes subtly
```

Duration:

```text
150–220ms
```

Do not:

```text
scale(1.08)
```

or add large drop shadows.

Tellann's visual system should remain restrained, technical and monochrome.

---

# 16. Section 04 — Explain the shared problem

After segmenting users, reconnect them around Tellann's single product thesis.

Heading:

> **Different roles. One source of truth.**

Visual:

```text
Product says:
"This workflow should exist."

          ↓

Developer demonstrates:
"This is what the application does."

          ↓

Tellann observes:
"This is what the evidence shows."

          ↓

QA sees gaps
Developers see behavior
Product sees intent alignment
Leaders see evidence
```

This is much stronger than four disconnected marketing messages.

---

# 17. Graphic dimensions

Use a custom vector / DOM visualization.

Desktop:

```text
1280 × 620px canvas
```

Internal:

```text
Declared Intent       300px
Observed Behavior     300px
Tellann Analysis      320px
Outcome Personas      remaining width
```

Mobile:

```text
~360 × 680px
```

Stacked vertically.

SVG or HTML/CSS is preferable to a raster image because the text should remain accessible and responsive.

---

# 18. Section 05 onward — Persona story blocks

After the card selector, give each primary persona a larger section.

Do **not** repeat the card copy.

The cards answer:

> “Is Tellann relevant to me?”

The larger blocks answer:

> “How would Tellann fit into my work?”

Recommended layout:

```text
Developers
QA
Engineering
Product
Startups
```

Alternate:

```text
text | visual
visual | text
text | visual
visual | text
```

Each section:

```text
Height: ~650–800px desktop
Container: 1200–1280px
Text: ~42%
Visual: ~52%
Gap: ~6%
```

---

# 19. Developers solution section

Eyebrow:

```text
FOR SOFTWARE ENGINEERS
```

Heading:

> **See your application as a system of behavior, not just files and functions.**

Copy should explain:

```text
Demonstrate workflow
        ↓
Capture behavior
        ↓
Build session
        ↓
Discover states
        ↓
Build behavior graph
        ↓
Inspect gaps
```

### Visual

Actual-style Tellann application mockup showing:

```text
CHECKOUT FLOW

PRODUCT_VIEW
     ↓
ADD_TO_CART
     ↓
CHECKOUT
     ├── PAYMENT_SUCCESS ✓
     └── PAYMENT_FAILURE !
```

Dimensions:

```text
Desktop visual: 660 × 520px
```

---

# 20. QA solution section

Heading:

> **Move from “what did we test?” to “what did we miss?”**

Visual:

```text
CHECKOUT

Coverage       72%

Observed
███████████████░░░░

Missing
• Payment failure
• Empty cart
• Session timeout
• Retry payment
```

Accompanying small graph:

```text
Observed     solid line
Missing      dotted line
```

Dimensions:

```text
680 × 500px
```

This can resemble a realistic Tellann dashboard rather than an abstract illustration.

---

# 21. Engineering leaders solution section

Heading:

> **Give quality conversations evidence everyone can see.**

Visual:

A report summary.

```text
APPLICATION QUALITY REPORT

Evidence
1 Guided Run

Workflows discovered       14
Workflow coverage          76%
Missing states             11
Missing flows               8
Slow endpoints              3
```

Do not show a fake:

```text
QUALITY SCORE: 94
```

The reporting specification deliberately avoids a composite Phase 1 quality score.

Instead show multiple evidence-backed indicators.

Visual dimensions:

```text
720 × 520px
```

---

# 22. Product teams solution section

Heading:

> **Compare what you designed with what was actually demonstrated.**

This deserves perhaps the most distinctive visualization.

```text
INTENDED                         OBSERVED

Checkout                         Checkout
├ Card Payment                   ├ Card Payment
├ Bank Transfer                  ├ Bank Transfer
└ Retry                          └ Crypto Payment

             RECONCILIATION

✓ Confirmed
! Intended but not observed
+ Observed but undeclared
```

This communicates product-engineering alignment instantly.

Dimensions:

```text
700 × 540px
```

---

# 23. Startup solution section

Heading:

> **Build quality discipline before you build a large QA department.**

Visual should be simpler:

```text
1 developer walkthrough
            ↓
    Tellann observes
            ↓
┌───────────┼──────────────┐
│           │              │
Coverage   Gaps          Report
```

Supporting outcome cards:

```text
Less manual documentation
Better testing direction
Shared quality visibility
```

Do not claim Tellann replaces QA.

The MVP explicitly says it is **not intended to replace QA teams**. mvp_scope

---

# 24. Section 11 — “How Tellann works”

Now explain the common workflow once.

Heading:

> **One workflow. Different value for every team.**

The Phase 1 loop is fundamentally:

```text
DECLARE
   ↓
BIND
   ↓
INSTRUMENT
   ↓
DEMONSTRATE
   ↓
RECONCILE
   ↓
REPORT
```

That is the documented current MVP flow. mvp_scope

---

# 25. How-it-works visual

Desktop layout:

```text
01               02                03
Declare intent → Connect project → Demonstrate

                    ↓

06               05                04
Get report     ← Reconcile       ← Observe
```

Or preferably linear:

```text
Declare → Connect → Demonstrate → Observe → Reconcile → Understand
```

Each node:

```text
160 × 110px
```

Connector length:

```text
32–48px
```

Whole visual:

```text
1200 × ~260px
```

Mobile:

horizontal swipe carousel or vertical sequence.

I prefer vertical because the workflow should remain visible without requiring hidden horizontal content.

---

# 26. Workflow animation

As this section enters the viewport:

```text
Declare
   ●────────

Connect
   ●────────

Demonstrate
   ●────────

Observe
   ●────────

Reconcile
   ●────────

Report
   ●
```

Animate one connector at a time.

Duration:

```text
~150ms/node
Total ~1.2s
```

No looping.

---

# 27. Section 12 — Outcome matrix

This is where the page can explain Tellann differently depending on user class extremely efficiently.

Heading:

> **One behavioral model. Different questions answered.**

| Audience | Their question | Tellann gives them |
|---|---|---|
| Developer | “What did the application actually do?” | Sessions, workflows, states, endpoints |
| QA | “What did we fail to exercise?” | Coverage, missing states, missing flows |
| Product | “Does implementation match intent?” | Declaration and reconciliation |
| Engineering Leader | “What evidence do we have?” | QA reports and behavioral visibility |
| Startup | “Where should our limited QA effort go?” | Prioritized gaps and structured evidence |
| Organization | “How do teams share quality understanding?” | Reports, governance and shared visibility |

This table is extremely good for SEO because it naturally contains persona and product terminology without sounding like keyword stuffing.

---

# 28. Section 13 — Capability-to-outcome mapping

Rather than listing features, translate them.

Example:

```text
Developer Demonstration
→ Teach Tellann how the software behaves.

Behavior Graph
→ See application workflows as connected states.

Coverage Analysis
→ Understand what has and hasn't been demonstrated.

Missing State Detection
→ Find overlooked loading, empty, error and failure states.

Missing Flow Detection
→ Surface recovery, alternative and edge-case paths.

Session Replay
→ Reconstruct what occurred during a run.

Endpoint Intelligence
→ Understand APIs involved in workflows.

Reconciliation
→ Compare intended behavior with observed behavior.

QA Reports
→ Turn analysis into evidence the team can share.
```

Tellann's MVP explicitly includes guided demonstrations, session replay, automatic state/transition/workflow generation and behavioral coverage analysis. mvp_scope

Each item deep-links to its corresponding `/product/*` route.

---

# 29. Cross-linking strategy

This is important for SEO.

Example:

```text
Solutions / Developers
        ↓
Product / Developer Demonstration
Product / Endpoint Intelligence
Product / Session Replay
Product / Behavior Graph

Solutions / QA
        ↓
Product / Coverage Analysis
Product / Missing States
Product / Missing Flows
Product / QA Reports

Solutions / Product Teams
        ↓
Product / Flow Declaration
Product / Reconciliation
Product / Workflow Discovery
```

This creates a strong internal semantic graph.

---

# 30. Section 14 — Trust / privacy

Heading:

> **Understand behavior without surrendering your codebase.**

This is particularly important because visitors will naturally ask:

> “Are you uploading my code?”

Explain simply:

```text
Source code
Stays local by default.

Sensitive values
Protected before collection.

Behavioral evidence
Sent to Tellann for analysis.

Privacy controls
Applied before data enters the platform.
```

The privacy specification requires data minimization, privacy-by-default, sensitive-data exclusion, tenant-controlled masking/redaction/retention, and least visibility. pdcs

Code-derived information can be transmitted as projections, while raw source contents are not transmitted without consent. pdcs

CTA:

```text
Explore Tellann Security →
```

Could route:

```text
/security
```

or your existing security marketing route.

---

# 31. Trust visual

Use a boundary diagram.

```text
YOUR MACHINE                          TELLANN

┌─────────────────┐
│ Source Code     │
│                 │
│ Desktop Agent   │
│     ↓           │
│ Local Analysis  │
└───────┬─────────┘
        │
        │ derived evidence
        │
        ───────────────────────▶
                              ┌───────────────┐
                              │ Behavior      │
                              │ Analysis      │
                              │ Reports       │
                              └───────────────┘
```

Desktop:

```text
1000–1100 × 420px
```

Mobile:

```text
vertical
```

No need for video here.

---

# 32. Section 15 — “Tellann grows with the problem”

You can introduce the longer-term platform story, but carefully.

Heading:

> **Start with demonstrated behavior. Build toward continuous intelligence.**

Three columns:

```text
TODAY
Behavioral QA

Declare
Demonstrate
Discover
Reconcile
Report


NEXT
Production Intelligence

Production behavior
Journey intelligence
Workflow health
Error correlation


FUTURE
Autonomous Intelligence

Regression intelligence
Validation
Simulation
Quality intelligence
```

Every future column should visibly show:

```text
PLANNED
```

or:

```text
ROADMAP
```

Then:

```text
View Tellann roadmap →
```

Do **not** let Google or a casual visitor interpret Phase 3 as currently sold functionality.

---

# 33. Video strategy

Unlike several `/product/...` pages, `/solutions` does **not need many videos**.

Too much product video here would turn the page into a product demo.

I recommend **one primary video**.

## Video 01 — “Tellann for your team”

Placement:

After the audience selector or immediately before “How Tellann Works.”

Dimensions:

```text
Master:
1920 × 1080
16:9

Desktop rendered:
960 × 540px

Tablet:
720 × 405px

Mobile:
calc(100vw - 32px)
16:9
```

Duration:

```text
60–80 seconds
```

Format:

```text
MP4/WebM
Muted preview
Captions available
Poster image
No autoplay with sound
```

---

# 34. Video narrative

Structure:

```text
0–8s
"Software quality means something different
depending on who is looking."

8–20s
Developer:
"What did my application do?"

20–32s
QA:
"What didn't we test?"

32–44s
Product:
"Does this match what we intended?"

44–54s
Engineering:
"How confident should we be?"

54–70s
Tellann:
Declare → Demonstrate → Reconcile → Report

70–80s
"One behavioral model.
Different answers for every team."
```

Style:

```text
UI animation
motion graphics
real Tellann dashboard captures
behavior graphs
minimal narration
```

No actors required.

---

# 35. Video poster

Poster:

```text
1600 × 900px
```

Text:

> **One application. Different questions. One behavioral model.**

Visual underneath:

```text
Developer   QA   Product   Engineering
        ↘   ↓   ↓   ↙
             Tellann
```

---

# 36. Other imagery required

I would create around **7 core visuals** for this page.

| Asset | Recommended size | Placement |
|---|---:|---|
| Hero reconciliation visual | 1600×800 | Hero |
| Persona card icons | 96×96 SVG | Role cards |
| Developer behavior graph | 1400×1050 | Developer section |
| QA coverage interface | 1400×1050 | QA section |
| Engineering report UI | 1400×1050 | Leadership section |
| Product reconciliation visual | 1400×1050 | Product section |
| Privacy architecture visual | 1600×700 | Trust section |

Export at roughly **2× rendered resolution** for high-DPI displays.

Prefer:

```text
SVG
WebP
AVIF
```

where appropriate.

---

# 37. Avoid stock imagery

I would use essentially **zero stock photography** on `/solutions`.

Avoid:

```text
person smiling at laptop
developers pointing at monitor
corporate meeting photo
generic server rack
handshake imagery
```

Tellann's product concept is sufficiently visual that screenshots, diagrams and graphs are far stronger.

---

# 38. Section 16 — FAQ

Recommended questions:

### “Who is Tellann for?”

Explain Software Engineers, QA Engineers, Technical Product Managers, startup teams and Engineering Managers.

### “Does Tellann replace QA engineers?”

No.

It provides behavioral evidence and helps teams identify gaps; the MVP explicitly does not position itself as replacing QA. mvp_scope

### “Do developers need to manually write tests?”

Explain the demonstration approach carefully without claiming Tellann eliminates conventional tests.

### “Can product teams use Tellann without reading technical telemetry?”

Yes—the product is designed to turn behavior into workflow and reconciliation information.

### “Does Tellann upload my source code?”

Explain local-first source handling and consent.

### “Can Tellann monitor production today?”

Answer according to actual release status. Do not market the future Phase 2 roadmap as current.

### “Which solution is right for a startup?”

Point to `/solutions/startups`.

### “Does Tellann support enterprise organizations?”

Describe actual plan/governance capabilities rather than future monitoring functionality.

---

# 39. Final CTA

This should reconnect all personas.

Large centered section.

Eyebrow:

```text
START WITH ONE APPLICATION
```

Heading:

> **Show Tellann how your software should behave. Then show it what actually happens.**

Supporting:

> Turn a guided demonstration into workflows, coverage, quality gaps and evidence your whole team can use.

Buttons:

```text
[ Start free ]
[ Explore the product ]
```

Optionally under the buttons:

```text
For developers · QA · product · engineering
```

---

# 40. CTA visual animation

Behind the final CTA, use a very faint graph.

```text
●────●────●
     ╲
      ●────●
```

Slow line drawing on initial viewport entry.

Opacity:

```text
4–8%
```

No looping particles.

---

# 41. Mobile structure

The page should reduce elegantly.

```text
NAV
──────────────────

HERO
H1
Copy
CTA
CTA

Hero graph
──────────────────

CHOOSE YOUR ROLE

Developer
QA
Engineering
Product
Startups
Enterprise
──────────────────

DIFFERENT ROLES
ONE SOURCE OF TRUTH
──────────────────

Developer section
──────────────────

QA section
──────────────────

Engineering section
──────────────────

Product section
──────────────────

Startup section
──────────────────

HOW IT WORKS
vertical flow
──────────────────

OUTCOME MATRIX
horizontal cards instead
of table
──────────────────

PRIVACY
──────────────────

ROADMAP
──────────────────

FAQ
──────────────────

CTA
──────────────────

FOOTER
```

Do not force the desktop comparison table onto mobile.

Convert each row into cards.

---

# 42. Recommended animation language

Across `/solutions`, use only four animation families:

```text
1. Graph construction
2. Line/path drawing
3. Number / status reveal
4. Soft content fade/translate
```

Do not turn the page into a Framer Motion demonstration.

Typical timings:

```text
Hover          150–200ms
UI reveal      300–450ms
Graph path     500–900ms
Section intro  350–500ms
```

Viewport animations should normally execute **once**.

---

# 43. Visual design

Maintain Tellann's monochrome language.

Primary:

```text
#000 / near black
#FFF / off-white
neutral grays
```

Use semantic state treatment through:

```text
solid lines
dashed lines
opacity
icons
labels
```

rather than introducing several unrelated colors.

Example:

```text
CONFIRMED
solid

MISSING
dashed

UNDECLARED
outlined

UNKNOWN
muted
```

This reinforces Tellann's graph vocabulary.

---

# 44. Page content hierarchy

Typography recommendation:

```text
H1
64–76px desktop
42–48px tablet
36–42px mobile

H2
46–56px desktop

H3
28–34px

Body Large
18–20px

Body
16–18px

Eyebrow
12–14px
uppercase
letter-spacing: 0.08–0.12em
```

Keep paragraphs around:

```text
55–70 characters per line
```

especially because this page is explanatory.

---

# 45. SEO title

Recommended:

> **Software Quality Solutions for Developers, QA & Product Teams | Tellann**

Alternative:

> **Behavioral QA Solutions for Software Teams | Tellann**

I prefer the first because it reaches broader high-intent queries while remaining accurate.

---

# 46. Meta description

Recommended:

> **Explore how Tellann helps developers, QA teams, product teams and engineering leaders understand application behavior, measure workflow coverage, identify quality gaps and compare intended behavior with observed evidence.**

Avoid mentioning:

```text
AI automated testing
autonomous QA
production monitoring
self-healing
```

until those capabilities are genuinely available.

---

# 47. Suggested H1 / H2 keyword structure

Use natural phrases such as:

```text
H1
Software quality intelligence for every team that ships software

H2
Tellann for software developers

H2
Tellann for QA teams

H2
Tellann for engineering leaders

H2
Tellann for product teams

H2
Tellann for startups

H2
How behavioral QA works

H2
One behavioral model, different outcomes
```

This is considerably better SEO than stuffing phrases like:

> Best AI software testing automation platform for developers.

That would both weaken credibility and misrepresent current scope.

---

# 48. Structured data

Implement:

```text
WebPage
BreadcrumbList
FAQPage
SoftwareApplication
VideoObject
```

`VideoObject` only if the explainer video exists.

Breadcrumb:

```text
Home
› Solutions
```

Subpages:

```text
Home
› Solutions
› Developers
```

---

# 49. Open Graph

OG image:

```text
1200 × 630px
```

Suggested content:

```text
TELLLANN

Software quality
from every perspective.

Developers
QA
Product
Engineering

[small behavioral graph]
```

Avoid screenshots with unreadably tiny dashboard text.

---

# 50. Analytics

Track:

```text
SOLUTIONS_PAGE_VIEWED

SOLUTION_PERSONA_VIEWED
SOLUTION_PERSONA_CLICKED

SOLUTION_DEVELOPER_CLICKED
SOLUTION_QA_CLICKED
SOLUTION_ENGINEERING_CLICKED
SOLUTION_PRODUCT_CLICKED
SOLUTION_STARTUP_CLICKED
SOLUTION_ENTERPRISE_CLICKED

SOLUTIONS_VIDEO_STARTED
SOLUTIONS_VIDEO_COMPLETED

SOLUTIONS_PRODUCT_LINK_CLICKED

SOLUTIONS_SECURITY_CLICKED
SOLUTIONS_ROADMAP_CLICKED

SOLUTIONS_PRIMARY_CTA_CLICKED
SOLUTIONS_SECONDARY_CTA_CLICKED

SOLUTIONS_FAQ_OPENED
```

Useful metadata:

```ts
{
  persona,
  section,
  destination,
  viewport,
  referrer
}
```

The most useful measurement will probably be:

> **Which persona does a new visitor self-select into?**

That will eventually tell you which buyer segment is responding strongest to Tellann.

---

# 51. Component architecture

I would implement it roughly as:

```text
SolutionsPage
│
├── MarketingNavbar
│
├── SolutionsHero
│   └── ReconciliationHeroVisual
│
├── PersonaSelector
│   └── PersonaCard[]
│
├── SharedProblemSection
│
├── PersonaSolutionSection[]
│   ├── DeveloperSolution
│   ├── QASolution
│   ├── EngineeringSolution
│   ├── ProductSolution
│   └── StartupSolution
│
├── HowTellannWorks
│
├── AudienceOutcomeMatrix
│
├── CapabilityOutcomeGrid
│
├── SecurityTrustSection
│
├── PlatformEvolutionSection
│
├── SolutionsVideo
│
├── SolutionsFAQ
│
├── FinalCTA
│
└── MarketingFooter
```

Do not hardcode the persona sections six different ways.

Use something like:

```ts
interface SolutionPersona {
  slug: string;
  name: string;
  eyebrow: string;

  problem: string;
  headline: string;
  description: string;

  outcomes: string[];
  capabilities: string[];

  href: string;

  visual:
    | "BEHAVIOR_GRAPH"
    | "COVERAGE"
    | "REPORT"
    | "RECONCILIATION"
    | "STARTUP";

  seoKeywords?: string[];
}
```

That same data can eventually drive the mega-menu and parts of the individual solution pages.

---

# 52. What `/solutions` must **not** become

Do not make it:

```text
Behavior Graph
Coverage
Replay
Endpoints
Reports
Reconciliation
```

with six feature cards.

That is simply `/product` wearing a different heading.

Likewise, do not structure it purely around plans:

```text
Free
Solo
Team
Business
Enterprise
```

That is `/pricing`.

The conceptual separation should remain:

```text
/product
What Tellann does.

         ↓

/solutions
Why it matters to me.

         ↓

/pricing
What level should I buy.

         ↓

/docs
How do I implement it.
```

That distinction will make the entire SEO architecture much cleaner.

---

# 53. Final desktop composition

The finished page should visually feel approximately like this:

```text
NAV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


SOLUTIONS

See software quality
from where you stand.

[ Find your solution ] [ How it works ]

          DECLARED ↔ OBSERVED
                 ↓
               GAP


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT DOES QUALITY MEAN TO YOUR TEAM?

[ Developers ] [ QA ] [ Engineering ]

[ Product    ] [ Startups ] [ Enterprise ]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIFFERENT ROLES.
ONE SOURCE OF TRUTH.

Intent → Evidence → Reconciliation

        ↙       ↓       ↘

 Developer     QA      Product


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOR DEVELOPERS

See your application as behavior,
not just code.

TEXT                     GRAPH UI


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOR QA

Move from:
"What did we test?"

to:
"What did we miss?"

COVERAGE UI               TEXT


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOR ENGINEERING LEADERS

Give quality conversations
evidence everyone can see.

TEXT                      REPORT UI


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOR PRODUCT TEAMS

Compare what you intended
with what was demonstrated.

RECONCILIATION UI         TEXT


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOR STARTUPS

Build quality discipline
before building a large QA team.

TEXT                     WORKFLOW UI


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TELLANN WORKS

Declare
   →
Connect
   →
Demonstrate
   →
Observe
   →
Reconcile
   →
Report


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ONE MODEL.
DIFFERENT QUESTIONS ANSWERED.

Audience × Outcome Matrix


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CAPABILITY → OUTCOME

Demonstration
Behavior Graph
Coverage
Missing States
Missing Flows
Replay
Endpoints
Reports


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR SOURCE CODE STAYS LOCAL.

[privacy architecture]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

START WITH BEHAVIORAL QA.
GROW TOWARD CONTINUOUS INTELLIGENCE.

Today      Next       Future


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAQ


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Show Tellann what your
software is supposed to do.

Then show it what actually happens.

[ Start free ] [ Explore product ]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOOTER
```

The central strategic idea is simple: **`/solutions` should sell Tellann six different ways without pretending Tellann is six different products.** Underneath every persona story is the same engine—declare intent, demonstrate the application, observe behavior, reconcile the two, and expose useful quality evidence. That consistency is what will make the Solutions section credible rather than generic SaaS marketing. mvp_scope