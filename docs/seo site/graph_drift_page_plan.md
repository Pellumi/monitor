For `/product/graph-drift`, I would make the page considerably more visual than the Reconciliation page, because **change over time is inherently visual**. The visitor should understand the feature within the first few seconds without knowing what a graph database, telemetry pipeline, or graph diff is.

The public idea is simple:

> **Your application behaved one way before. You demonstrated it again. Tellann shows you what changed.**

That is faithful to the current Phase 1 scope. Graph Drift versions behavioral graphs, compares versions, identifies added/removed/changed states and transitions, retains coverage history, and records drift against declared intent. In Phase 1, all of this operates on **demonstration evidence**; production-baseline drift is Phase 2 and anomaly detection is Phase 3. 

---

# `/product/graph-drift` — Complete SEO Marketing Page Specification

## 1. Primary purpose of the page

The page needs to answer five questions:

1. **What is Graph Drift?**
2. **What exactly can Tellann notice has changed?**
3. **Why should that change matter to me?**
4. **How can I investigate the change?**
5. **How does this help someone in my role?**

Do **not** start with:

> Compare graph snapshots using deterministic structural differencing.

Technically accurate. Commercially terrible.

Start with:

> **See how your application’s behavior changes over time.**

Then explain the mechanism progressively.

The underlying product supports graph version history and comparisons of added/removed states and transitions, transition-frequency changes, and coverage movement. 

---

# 2. Recommended page architecture

```text
/product/graph-drift
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Interactive Hero Graph Comparison
├── 04 Simple Definition — What Is Graph Drift?
├── 05 “What Changed?” Feature Strip
├── 06 Before / After Behavioral Comparison
├── 07 Removed Behavior Spotlight
├── 08 Coverage Change Over Time
├── 09 Intent vs Observed Drift
├── 10 How Graph Drift Works
├── 11 Benefits By Role
├── 12 Investigation / Evidence Section
├── 13 Graph Drift Report Preview
├── 14 Demonstration Video
├── 15 Current Capability vs Future Evolution
├── 16 Related Tellann Features
├── 17 FAQ
├── 18 Final CTA
└── 19 Footer
```

The page should feel like a journey:

```text
BEHAVIOR BEFORE

        ↓

NEW DEMONSTRATION

        ↓

BEHAVIOR NOW

        ↓

WHAT CHANGED?

        ↓

WHY DOES IT MATTER?
```

---

# 3. Hero section

## Eyebrow

```text
GRAPH DRIFT
Behavioral change visibility
```

If the marketing system uses phase badges, add:

```text
PHASE 1 · BEHAVIORAL QA
```

I would **not** automatically add an `AVAILABLE` badge merely because Graph Drift belongs to Phase 1. Your website specification correctly separates roadmap phase, implementation status, and plan entitlement. 

---

## H1

My preferred H1:

> **See what changed in your application’s behavior.**

Alternative:

> **Your software changed. See how its behavior changed with it.**

The first is better for SEO and comprehension.

---

## Supporting copy

> Compare behavioral graph versions from different demonstrations and see which states appeared, disappeared, changed, or became more or less covered — without manually comparing workflows.

Then a smaller sentence:

> Graph Drift turns repeated demonstrations into a visible history of how your application is evolving.

---

## CTAs

Primary:

```text
[ Start a free trial ]
```

Secondary:

```text
[ See how Graph Drift works ↓ ]
```

Optional tertiary text link:

```text
Explore Behavior Graphs →
```

Do not make the primary CTA:

```text
View Graph Drift Report
```

for unauthenticated visitors. The page should sell the outcome before introducing the report.

---

# 4. Hero layout

### Desktop

Use a 12-column max-width container around **1280–1360 px**.

```text
┌───────────────────────────────────────────────────────┐
│                                                       │
│  COPY                    INTERACTIVE GRAPH VISUAL     │
│  col 1–5                 col 6–12                     │
│                                                       │
│  H1                      v6        →        v7        │
│  supporting text         graph              graph     │
│  CTA                     + diff highlights            │
│                                                       │
└───────────────────────────────────────────────────────┘
```

Recommended content proportions:

* Copy width: **440–500 px**
* Visual width: **650–760 px**
* Hero minimum height: **720–780 px**
* Top/bottom padding: **96–120 px**
* Graph visual aspect ratio: approximately **16:10**

### Mobile

Stack:

```text
COPY
↓
CTA
↓
GRAPH COMPARISON
```

Graph visual:

* width: `100%`
* recommended rendered size: **360 × 300 px**
* avoid shrinking a desktop graph until labels become microscopic
* use a simplified 5–7-node demonstration on mobile

---

# 5. Hero visual — the most important asset on the page

This should not be a generic illustration.

Create an **interactive simulated Tellann graph comparison**.

### Visual

Left:

```text
VERSION 6

PRODUCT_VIEW
     ↓
CART
     ↓
INVENTORY_CHECK
     ↓
CHECKOUT
     ↓
PAYMENT_SUCCESS
```

Right:

```text
VERSION 7

PRODUCT_VIEW
     ↓
CART
     ↓
CHECKOUT
     ├──────────────→ PROMO_CODE
     ↓
PAYMENT_SUCCESS
```

A center diff column shows:

```text
+ PROMO_CODE

− INVENTORY_CHECK

~ CART → CHECKOUT
  frequency changed

+4.2%
coverage
```

The underlying Graph Drift model explicitly supports added states/transitions, removed states/transitions, changed transition frequency and coverage delta. 

---

# 6. Hero animation

This is one place where animation genuinely improves understanding.

### Sequence

**0–1.0s**

Render Version 6 graph.

**1.0–1.8s**

Graph subtly shifts left.

**1.8–2.8s**

Version 7 materializes to its right.

**2.8–4.0s**

Unchanged nodes connect visually across both graphs.

**4.0–5.0s**

Changed elements receive emphasis:

```text
+ Added
− Removed
~ Changed
```

**5.0–6.0s**

Summary counter appears:

```text
3 added
1 removed
5 changed
+4.2% coverage
```

Then animation stops.

Do not endlessly pulse everything.

---

## Animation style

Because Tellann uses a monochrome identity, keep:

* unchanged elements → medium gray
* current/important nodes → near white
* previous/removed elements → faded or strikethrough treatment
* additions → bright solid line
* changes → animated dashed line
* background → near black
* borders → low-opacity white

The existing marketing direction calls for near-black backgrounds, fine borders, large typography, graph lines, minimal shadows, and luminance/line treatment rather than rainbow status colors. 

### Accessibility

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

In reduced-motion mode, render Version 6 and Version 7 immediately without transition animation.

---

# 7. Section — “What is Graph Drift?”

This is the plain-English explanation.

### Layout

Centered text, maximum width **760–820 px**.

Eyebrow:

```text
BEHAVIOR CHANGES
```

H2:

> **A history of how your application behaves.**

Body:

> Every Tellann demonstration can produce a version of your application’s behavioral graph. Graph Drift compares those versions so you can see what appeared, disappeared, changed, or became less covered.

Tellann's Behavior Graph is fundamentally a representation of states, actions, transitions and workflows observed in an application. 

Then use a simple equation:

```text
Previous behavior
        +
Current behavior
        =
What changed
```

### Important

Avoid explaining:

* graph algorithms
* relational storage
* diff implementation
* graph IDs
* event aggregation
* Kafka

That belongs in docs.

The marketing website should speak in outcomes; your SEO structure explicitly establishes that principle. 

---

# 8. “What changed?” capability strip

Use four large cards.

## Card 1 — Added behavior

**Title**

> New behavior appeared

**Example**

```text
+ PROMO_CODE_REJECTED
```

**Copy**

> Spot states or paths that were not present in an earlier demonstration.

**Benefit**

> Understand how new features or application changes expanded the workflow.

---

## Card 2 — Removed behavior

**Title**

> Expected behavior disappeared

Example:

```text
− INVENTORY_CHECK
```

Copy:

> Surface states and transitions that existed before but no longer appear.

Benefit:

> Catch important paths that may have become unreachable.

This deserves particular emphasis. Tellann's report specification explicitly says that a removed state must be treated as a **finding rather than cleanup**, because a previously reachable state becoming unreachable is precisely the signal Graph Drift is intended to expose. 

---

## Card 3 — Changed paths

**Title**

> Existing paths changed

Example:

```text
CART → CHECKOUT
14 observations → 6
```

Copy:

> See when the way an application moves between states changes between demonstrations.

---

## Card 4 — Coverage changed

**Title**

> Coverage moved

Example:

```text
Version 6       68%
Version 7       72.2%

Δ +4.2%
```

Copy:

> Understand whether a new demonstration expanded or reduced the behavior you have actually exercised.

Graph Drift's requirements explicitly retain coverage history and present it as a trend. 

---

# 9. Card layout

Desktop:

```text
[ Added ] [ Removed ] [ Changed ] [ Coverage ]
```

Four cards in one row at >1200 px.

Each:

* width: ~**280–300 px**
* height: **250–290 px**
* padding: **28–32 px**
* subtle 1 px border
* minimal radius consistent with Tellann design system

Tablet:

```text
[ Added   ] [ Removed  ]
[ Changed ] [ Coverage ]
```

Mobile:

single-column horizontal snap carousel or vertical stack.

I prefer **vertical stack** here for SEO/content accessibility.

---

# 10. Section — Before vs After

Now explain the feature with a realistic scenario rather than abstract nodes.

### Heading

> **Compare behavior, not screenshots.**

Supporting copy:

> Interface changes can be obvious. Behavioral changes often are not.

Then show an e-commerce checkout example.

---

## Visual asset #2

### Type

High-fidelity Tellann UI mockup / application screenshot.

### Desktop dimensions

Master export:

**1600 × 1000 px**

Displayed approximately:

**1200 × 750 px**

Formats:

* AVIF primary
* WebP fallback
* PNG only where required

### Layout

Full-width visual beneath the copy.

Inside:

```text
┌───────────────────────────────────────────────────────┐
│ CHECKOUT · Graph comparison                           │
│                                                       │
│ Version 6            DIFF             Version 7       │
│                                                       │
│ [graph]              + 3              [graph]         │
│                      - 1                              │
│                      ~ 5                              │
│                                                       │
│ Coverage 68%                           Coverage 72.2%  │
└───────────────────────────────────────────────────────┘
```

---

# 11. Interaction for the comparison visual

Include a draggable comparison selector:

```text
Compare

[ Version 6 ▾ ] → [ Version 7 ▾ ]
```

Below it:

```text
All changes
Added
Removed
Changed
Coverage
```

Visitors can click each filter.

No authentication required because this is a marketing simulation, not the real application.

---

# 12. Section — “The disappearance matters”

This should be one of the strongest sections.

### Layout

Split screen.

Left: large statement.

> **Sometimes what disappeared matters more than what was added.**

Supporting:

> If a state or path existed in an earlier demonstration and is no longer reachable, Tellann makes that change difficult to overlook.

Right:

large mini graph:

```text
VERSION 6

Cart
 ↓
Inventory Check
 ↓
Checkout


VERSION 7

Cart
 ↓
Checkout

         − Inventory Check
```

This is an excellent way to communicate the report rule that removed behavior is deliberately surfaced prominently. 

---

# 13. Animation for removed-state section

Use scroll-triggered transformation.

As user scrolls:

1. `INVENTORY_CHECK` node exists normally.
2. Graph transitions to new version.
3. Node fades.
4. Its incoming/outgoing edges collapse.
5. Side panel appears:

```text
REMOVED

INVENTORY_CHECK

Last observed
Graph v6

Not observed
Graph v7
```

Duration: **500–700ms**.

No dramatic red flashing.

The effect should communicate loss, not catastrophe.

---

# 14. Coverage history section

### H2

> **See whether your behavioral coverage is moving forward.**

Graph Drift stores coverage history as a trend rather than treating each run as an isolated result. 

### Visual asset #3

A minimal line chart:

```text
Coverage

78% ┤                         ●
74% ┤                    ●
70% ┤          ●
66% ┤     ●
62% ┤ ●
    └──────────────────────────
      v3   v4   v5   v6   v7
```

This chart uses **illustrative demo data**, not fabricated product metrics.

Desktop:

**1100 × 520 px**

Mobile:

**360 × 280 px**

Accompany it with three compact summary values:

```text
Current coverage
72.2%

Change
+4.2%

Compared with
Version 6
```

---

# 15. Important wording around coverage

Do not write:

> Quality improved 4.2%.

That is not what the evidence says.

Write:

> Demonstrated coverage increased 4.2 percentage points.

Phase 1 deliberately does **not** publish a composite quality judgement from one point-in-time demonstration. 

This distinction matters enormously for credibility.

---

# 16. Intent drift section

Graph Drift should not be described solely as:

```text
v6 versus v7
```

The Phase 1 requirements also include recording how **observed behavior drifts relative to declared intent over time**. 

### H2

> **See whether what you demonstrate is moving toward—or away from—what you intended.**

Visual:

```text
DECLARED

A → B → C → D
        │
        └→ FAILURE


VERSION 6

A → B → C


VERSION 7

A → B → C → D
```

Then:

```text
Previously absent:
D

Now observed:
D

Still unobserved:
FAILURE
```

This connects Graph Drift naturally to `/product/reconciliation`.

---

# 17. CTA inside this section

```text
See how declared intent is reconciled →
```

Link:

```text
/product/reconciliation
```

This creates a strong SEO/internal-link relationship between the pages.

---

# 18. “How it works” section

Keep this remarkably simple.

### Heading

> **Demonstrate again. Tellann compares what changed.**

Use a four-step horizontal flow.

```text
01
Demonstrate

        →

02
Tellann builds a graph version

        →

03
Demonstrate again

        →

04
Compare the versions
```

Then outcome:

```text
Added
Removed
Changed
Coverage movement
```

The platform's Phase 1 Graph Drift engine versions behavioral graphs, diffs two versions, keeps coverage history and records observed-versus-declared drift. 

---

# 19. Visual animation for “How it works”

Use an SVG/Lottie-like diagram or native CSS/SVG animation.

Recommended canvas:

**1200 × 400 px**

No video needed.

Animation sequence:

```text
Run 1
 ↓
Graph v6
                Run 2
                  ↓
               Graph v7

v6 ──────┐
         ├──── DIFF ──── Changed behavior
v7 ──────┘
```

This is easier to maintain than recording product footage for such a simple concept.

---

# 20. Benefits by user class

This is where the page should become persona-aware.

The formal product roles are Developer, QA Engineer, Engineering Manager and Product Manager. 

Use a four-tab section.

---

## Developer

### Heading

> **Know what your code change did to behavior.**

Benefits:

* Find states that became unreachable after application changes.
* See whether new flows actually appeared in the next demonstration.
* Compare behavioral evidence without manually reviewing event streams.
* Investigate exactly what changed before digging into code.

Mini example:

```text
Changed:
CHECKOUT → PAYMENT_SUCCESS

Previously:
12 observations

Current:
3 observations
```

Primary value:

> Less guessing after a change.

---

# 21. QA Engineer

### Heading

> **See where your next QA run needs attention.**

Benefits:

* Identify behavior that disappeared.
* Find newly introduced paths requiring validation.
* Track behavioral coverage across demonstrations.
* Compare repeated QA runs without manually cross-checking test notes.

Primary value:

> Turn repeated QA runs into a behavioral history.

This persona aligns directly with the platform requirement that QA Engineers validate quality and testing coverage. 

---

# 22. Engineering Manager

### Heading

> **See whether the system is evolving in the direction you expected.**

Benefits:

* Understand high-level behavioral change without inspecting telemetry.
* Review coverage movement across demonstrations.
* Surface removed application behavior.
* Give teams a common evidence trail when discussing change.

Primary value:

> More informed engineering conversations without another wall of logs.

Do **not** promise:

> Release confidence score.

That belongs to later evidence maturity, not this Phase 1 Graph Drift page.

---

# 23. Product Manager

### Heading

> **See whether implementation still matches the intended experience.**

Benefits:

* Compare demonstrated behavior against declared product intent.
* See newly observed states and workflows.
* Discover when an intended path remains absent.
* Discuss product changes using the same evidence engineering sees.

Primary value:

> The gap between product intent and demonstrated behavior becomes visible.

This is especially strong for Tellann because its core model explicitly places declared intent and observed behavior side by side rather than assuming either is automatically correct. 

---

# 24. Persona interaction

Desktop:

```text
[ Developer ] [ QA ] [ Eng. Manager ] [ Product ]

------------------------------------------------

Role-specific copy       Role-specific mini visual
```

Mobile:

Use an accessible select:

```text
I'm a:
[ QA Engineer ▾ ]
```

Do not build four full sections stacked vertically. That will create unnecessary repetition and SEO padding.

---

# 25. Evidence section

This section matters because otherwise Graph Drift can look like vaguely AI-generated speculation.

### H2

> **Every comparison has evidence behind it.**

Body:

> Tellann's comparison is derived from recorded behavioral evidence. Each graph version carries its own evidence basis, allowing the comparison to explain what was actually observed.

Graph Drift comparisons are required to be deterministic and report the evidence basis for each version. 

---

## Evidence UI visual

Dimensions:

**1000 × 620 px**

Example:

```text
VERSION 6
────────────────
Run
RUN-4410

Evidence
386 in-flow events

States
18

Transitions
27

Coverage
68%


VERSION 7
────────────────
Run
RUN-4471

Evidence
418 in-flow events

States
20

Transitions
31

Coverage
72.2%
```

Footer:

```text
Compare evidence →
```

This creates trust without requiring visitors to understand telemetry architecture.

---

# 26. Graph Drift Report section

The product specification defines a dedicated Phase 1 groundwork report.

### Heading

> **A report of what changed—not another dashboard to interpret.**

Actual report dimensions include:

```text
Comparing
v6 → v7

Added States
3

Removed States
1

Changed Transitions
5

Coverage Delta
+4.2%
```

The report then contains:

* version comparison
* added elements
* removed elements
* changed transition frequencies
* coverage delta
* evidence basis for both versions. 

---

# 27. Report image

Use a real or realistic Tellann report screenshot.

Master:

**1600 × 1050 px**

Displayed:

**1100 × 720 px**

Layout:

```text
COPY               REPORT SCREENSHOT
35–40%             60–65%
```

Use browser-window framing only if consistent with other Tellann product pages.

Do not use a laptop/device mockup. It wastes visual area and makes the product interface harder to inspect.

---

# 28. Product video

This page needs **one video**, not several.

## Video title

> **Graph Drift in 60 seconds**

### Duration

**50–75 seconds**

### Format

Prefer screen-driven motion graphics + real UI.

Not talking-head.

---

# 29. Video storyboard

### 0–6s

Text:

> Your application changes.

Old graph appears.

---

### 6–14s

> But what changed in its behavior?

New graph appears.

---

### 14–25s

Automatic comparison highlights:

```text
+ New states
− Removed states
~ Changed transitions
```

---

### 25–36s

Coverage:

```text
68% → 72.2%
```

---

### 36–48s

Removed state selected.

Evidence panel appears.

---

### 48–60s

Intent comparison appears.

Text:

> Compare what you demonstrated with what you intended.

---

### 60–70s

End frame:

> **Your software evolves. Keep its behavior visible.**

Tellann logo.

CTA:

```text
Start free
```

---

# 30. Video technical specification

Primary:

**1920 × 1080**, 16:9

Website embed:

* Desktop: **960 × 540**
* Tablet: full container width
* Mobile: **16:9 responsive**

Formats:

```text
WebM
MP4 H.264 fallback
```

Poster:

**1600 × 900 WebP/AVIF**

Do not autoplay with sound.

If autoplaying a muted hero excerpt, cap it around **8–12 seconds** and loop only the before/after graph transition.

The full 60-second explanation should remain user-initiated.

---

# 31. Current vs future section

This section is essential because Graph Drift deliberately lays groundwork for later capabilities.

### Heading

> **Today: compare demonstrations. Tomorrow: understand continuous change.**

Three columns:

### Phase 1 — Current Graph Drift scope

```text
Demonstration → Demonstration

• Graph version comparison
• Added behavior
• Removed behavior
• Transition changes
• Coverage history
• Intent drift
```

---

### Phase 2

Badge:

```text
PHASE 2
```

```text
Production behavior → Baseline

• Production drift
• Production vs demonstrated behavior
• Workflow degradation context
```

---

### Phase 3

Badge:

```text
PHASE 3
```

```text
Continuous behavioral change

• Drift used as anomaly evidence
• Regression analysis
• Behavioral anomaly detection
```

The formal model follows exactly that evolution: demonstration drift in Phase 1, production-baseline drift in Phase 2, and drift as a continuous anomaly signal in Phase 3. 

This section prevents accidentally marketing the future as present functionality.

---

# 32. Do not say this on the page

Avoid claims such as:

```text
Tellann continuously monitors behavioral drift.
```

Not Phase 1.

Avoid:

```text
Automatically detect production regressions.
```

Not Phase 1.

Avoid:

```text
AI detects unusual behavior before users notice.
```

Wrong phase and wrong positioning.

Avoid:

```text
Graph Drift tells you whether a release is safe.
```

Insufficient evidence in Phase 1.

The MVP explicitly excludes production monitoring, autonomous testing and composite quality judgement. 

---

# 33. Related features section

Heading:

> **Graph Drift becomes more useful when connected to the rest of Tellann.**

Use four related-product cards:

### Behavior Graphs

> Understand the behavioral model behind every comparison.

Route:

```text
/product/behavior-graphs
```

### Reconciliation

> Compare observed behavior with what your application was intended to do.

```text
/product/reconciliation
```

### Coverage Analysis

> See which workflows, states and transitions were actually exercised.

```text
/product/coverage-analysis
```

### QA Reports

> Turn behavioral findings into something the whole team can review.

```text
/product/qa-reports
```

These internal links are particularly valuable for SEO because Graph Drift conceptually sits between the graph, coverage, reconciliation and reporting systems.

---

# 34. Plans / availability

Graph Drift is included in the customer-facing plan specification across Free, Local, Solo, Team, Business and Enterprise. 

Therefore a small section can say:

> **Explore Graph Drift on any Tellann plan.**

CTA:

```text
Compare plans →
```

But again: **plan entitlement does not prove deployment status**.

If the feature has not shipped when the site goes live, show its proper explicit status instead.

---

# 35. FAQ

I would include six questions.

### What is behavioral graph drift?

A simple explanation of comparing versions of an application's observed behavioral model.

### What can Graph Drift detect?

Added states/transitions, removed states/transitions, transition-frequency changes and coverage movement.

### Does Graph Drift monitor production traffic?

> Not in the Phase 1 implementation. Current Graph Drift works from demonstration evidence. Production-baseline comparison belongs to Tellann's production-intelligence phase.

### Is a removed state always a bug?

> No. It is a change worth reviewing. The application may have changed intentionally, the demonstration may have followed a different path, or the state may genuinely have become unreachable.

This nuance is important.

### Can Graph Drift compare against what the application is supposed to do?

> Tellann can track observed behavior relative to declared intent, connecting Graph Drift with Flow Declaration and Reconciliation.

### Does Graph Drift produce a quality score?

> Not from Phase 1 demonstration evidence. Tellann exposes the measured changes and the evidence behind them rather than reducing a single demonstration to an unsupported quality score.

---

# 36. Final CTA

Make the final CTA extremely simple.

### Heading

> **Your application will change. Keep its behavior visible.**

Supporting:

> Demonstrate again and let Tellann show you the difference.

Buttons:

```text
[ Start free ]
[ Explore Behavior Graphs ]
```

Visual behind CTA:

very faint:

```text
v6 ─────────────→ v7
        Δ
```

No giant decorative illustration required.

---

# 37. SEO title and metadata

## Title

```text
Graph Drift — Track Changes in Application Behavior | Tellann
```

Alternative SEO-heavy title:

```text
Behavior Graph Drift & Workflow Change Detection | Tellann
```

I prefer the first because it remains understandable to humans.

---

## Meta description

```text
Compare behavioral graph versions with Tellann Graph Drift. See added and removed states, changed workflow transitions, coverage movement, and how demonstrated behavior changes over time.
```

Approximately 155–165 characters depending on final wording; trim during implementation if needed.

---

# 38. Recommended keyword cluster

Primary:

```text
application behavior changes
behavior graph comparison
graph drift
workflow change detection
software behavior analysis
```

Secondary:

```text
QA workflow comparison
behavioral QA
workflow coverage changes
application workflow analysis
software behavior graph
behavioral regression visibility
```

Be careful with the last term. The body should explain that true cross-release regression detection belongs to later Tellann phases, rather than optimizing the page around an unavailable regression product.

---

# 39. Suggested heading hierarchy

```text
H1
See what changed in your application’s behavior.

H2
A history of how your application behaves.

H2
See exactly what changed.

H2
Sometimes what disappeared matters more.

H2
See whether your behavioral coverage is moving forward.

H2
Compare demonstrated behavior with intended behavior.

H2
Demonstrate again. Tellann compares what changed.

H2
Graph Drift for every part of your product team.

H2
Every comparison has evidence behind it.

H2
A report of what changed.

H2
Today: compare demonstrations. Tomorrow: understand continuous change.

H2
Frequently asked questions.

H2
Your application will change. Keep its behavior visible.
```

This provides enough meaningful text for search engines without turning the page into an article.

---

# 40. Structured data

Implement:

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
→ Graph Drift
```

VideoObject only if the video is actually published and crawlable.

---

# 41. Recommended media inventory

| Asset                | Type                  | Master size |     Display | Purpose                                   |
| -------------------- | --------------------- | ----------: | ----------: | ----------------------------------------- |
| Hero Graph Drift     | Interactive SVG/HTML  |      Vector |  ~720 × 540 | Immediately explain before/after behavior |
| Before/After UI      | AVIF/WebP screenshot  | 1600 × 1000 |  1200 × 750 | Show real comparison UI                   |
| Removed-state visual | SVG                   |      Vector |  ~560 × 520 | Explain disappearing behavior             |
| Coverage history     | Interactive/SVG chart |      Vector |  1100 × 520 | Explain trend history                     |
| Intent drift         | SVG/UI composition    |  1400 × 850 | ~1100 × 670 | Connect Graph Drift to Reconciliation     |
| Evidence panel       | AVIF/WebP             |  1400 × 870 |  1000 × 620 | Establish trust                           |
| Graph Drift report   | AVIF/WebP             | 1600 × 1050 |  1100 × 720 | Show final product output                 |
| Demo video           | WebM/MP4              | 1920 × 1080 |   960 × 540 | Explain feature in ~60 sec                |
| Video poster         | AVIF/WebP             |  1600 × 900 |  responsive | Avoid blank video load                    |

---

# 42. Animation inventory

Keep animations purposeful:

| Animation                   | Trigger         |        Duration |
| --------------------------- | --------------- | --------------: |
| v6 → v7 graph diff          | Hero load       | ~6 sec sequence |
| Node addition               | Hero sequence   |       300–450ms |
| Node removal                | Scroll          |       500–700ms |
| Transition-frequency change | Hover/click     |       250–350ms |
| Coverage line draw          | Section enter   |       700–900ms |
| Intent → observed mapping   | Section enter   |       600–900ms |
| Report rows stagger         | Section enter   |      ~50ms/item |
| Persona visual swap         | Tab interaction |       200–300ms |

Avoid constant ambient motion.

Graph pages can rapidly become visually noisy.

---

# 43. Responsive behavior

### ≥1280 px

Use full split layouts and complete graph views.

### 768–1279 px

Reduce node count and convert some two-column sections to approximately 45/55.

### <768 px

Use:

```text
Copy
↓
Visual
↓
Explanation
```

For graph comparisons, do **not** attempt:

```text
v6 | v7
```

side-by-side if labels become illegible.

Instead:

```text
Version 6
[graph]

      ↓ compare

Version 7
[graph]

Changes
[summary]
```

Comprehension beats preserving desktop composition.

---

# 44. Analytics events

Track at minimum:

```text
GRAPH_DRIFT_PAGE_VIEWED

GRAPH_DRIFT_HERO_CTA_CLICKED

GRAPH_DRIFT_DEMO_PLAYED

GRAPH_DRIFT_DEMO_COMPLETED

GRAPH_DRIFT_COMPARISON_FILTERED

GRAPH_DRIFT_VERSION_SELECTOR_USED

GRAPH_DRIFT_PERSONA_SELECTED

GRAPH_DRIFT_RECONCILIATION_CLICKED

GRAPH_DRIFT_BEHAVIOR_GRAPH_CLICKED

GRAPH_DRIFT_PRICING_CLICKED

GRAPH_DRIFT_SIGNUP_CLICKED

GRAPH_DRIFT_FAQ_EXPANDED
```

Metadata:

```text
persona
comparison_filter
cta_location
referrer
device_class
video_progress
```

---

# 45. The single most important design decision

Do **not** make `/product/graph-drift` look like another observability dashboard.

Graph Drift's marketing concept should be:

```text
BEFORE                       AFTER

How the application          How the application
behaved                      behaves now

              ↓

          THE DIFFERENCE
```

Tellann is positioned around **behavioral quality intelligence**, not selling raw telemetry. The product's own pricing strategy makes the same distinction: customers are buying workflow understanding, coverage visibility and quality confidence—not events, logs or traces. 

That is the thread I would carry through the entire page.

## Recommended final page flow

```text
NAV

↓

HERO
“See what changed in your application’s behavior.”

[animated v6 → v7 graph comparison]

↓

WHAT IS GRAPH DRIFT?
Previous behavior + Current behavior = What changed

↓

WHAT CHANGED?
Added · Removed · Changed · Coverage

↓

BEFORE / AFTER
Interactive graph comparison

↓

REMOVED BEHAVIOR
“Sometimes what disappeared matters more.”

↓

COVERAGE HISTORY
v3 → v4 → v5 → v6 → v7

↓

INTENT DRIFT
Declared vs demonstrated over time

↓

HOW IT WORKS
Demonstrate → Version → Demonstrate → Compare

↓

BENEFITS BY ROLE
Developer · QA · Engineering Manager · Product Manager

↓

EVIDENCE
Every comparison explains its evidence basis

↓

GRAPH DRIFT REPORT
Added / Removed / Changed / Coverage Delta

↓

60-SECOND VIDEO

↓

CURRENT VS FUTURE
Phase 1 demonstration
→ Phase 2 production
→ Phase 3 anomaly intelligence

↓

RELATED FEATURES
Behavior Graphs
Reconciliation
Coverage
QA Reports

↓

FAQ

↓

CTA
“Your application will change.
Keep its behavior visible.”

↓

FOOTER
```

That gives `/product/graph-drift` a clear identity inside the Tellann product family: **Behavior Graphs explain what the application does; Reconciliation explains whether that matches intent; Graph Drift explains how that behavior is changing.** 
