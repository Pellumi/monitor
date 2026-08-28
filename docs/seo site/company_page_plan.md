Now that `/company` is robust, I would **remove `/about` as a separate page**. It has become semantically redundant with `/company`.

The cleaner structure is:

```text
Company
│
├── Company Overview   → /company
├── Careers            → /careers
├── Contact            → /contact
├── Brand              → /brand
└── Roadmap            → /roadmap
```

### 1. `/company` — Keep, and let it absorb `/about`

This becomes the canonical page for:

* why Tellann exists;
* company story;
* mission;
* vision;
* philosophy;
* category positioning;
* principles;
* who Tellann builds for;
* trust/responsibility;
* broad product evolution;
* company direction.

So this:

```text
/company
```

already answers almost everything a traditional `/about` page would answer.

Keeping both:

```text
/company
/about
```

would create two pages fighting to answer the same question: **"Who/what is Tellann?"**

It also creates weak SEO separation.

I would therefore:

```text
/about → 301 redirect → /company
```

and remove `About` from the mega menu.

---

# 2. `/careers` — Keep separate

Careers has a completely different user intent.

Someone visiting Company asks:

> What is Tellann and why does it exist?

Someone visiting Careers asks:

> Can I work here?

That eventually requires substantially different functionality:

```text
/careers

Hero
│
├── Why work at Tellann
├── What we're building
├── Working principles
├── Culture
├── Teams
├── Open positions
├── Hiring process
├── Benefits
├── Remote/location policy
├── Candidate FAQ
└── Apply
```

So yes:

```text
/company     ≠     /careers
```

Keep `/careers`.

If Tellann is not hiring yet, the page can simply say so and allow people to follow future openings. Don't invent jobs just to justify the route.

---

# 3. `/contact` — Definitely keep separate

Contact is transactional, not informational.

It will eventually have multiple paths:

```text
/contact

What can we help with?

├── Sales
├── General enquiry
├── Partnership
├── Press
├── Security
├── Support
└── Enterprise
```

And potentially forms such as:

```text
Name
Work email
Company
Reason for contact
Message
```

So `/contact` should absolutely remain independent.

---

# 4. `/brand` — Keep separate

Especially for Tellann, because you're deliberately building a strong visual identity.

`/company` may briefly mention the Tellann brand, but `/brand` serves an entirely different audience:

* press;
* partners;
* event organizers;
* creators;
* affiliates;
* future employees;
* anyone needing approved brand assets.

Its structure can eventually be:

```text
/brand

Tellann Brand
│
├── Logo
│   ├── Primary
│   ├── Symbol
│   ├── Wordmark
│   └── Clear-space rules
│
├── Colors
│   ├── Primary monochrome
│   └── Secondary palette
│
├── Typography
│   └── Satoshi
│
├── Brand voice
├── Product description
├── Logo misuse
├── Screenshots
├── Media assets
└── Press kit
```

So:

```text
/company = Who Tellann is

/brand = How Tellann is represented
```

Different intent. Keep it.

One caveat: if `/brand` is initially only a logo and two color hex codes, hide it until the page is substantive.

---

# 5. `/roadmap` — Keep separate, but change its role

This one deserves careful distinction.

The `/company` page should contain the **strategic evolution**:

```text
Now
Behavioral QA

Next
Production Intelligence

Future
Autonomous Validation
```

That's enough to explain where Tellann is heading.

But `/roadmap` should go much deeper.

For example:

```text
/roadmap

Tellann Roadmap

NOW
Behavioral QA
├── Developer Demonstration Mode
├── Behavior Graphs
├── Coverage
├── Missing States
├── Missing Flows
├── Session Replay
└── Endpoint Intelligence

NEXT
Production Intelligence
├── Live monitoring
├── Workflow health
├── Journey intelligence
├── Error correlation
└── Database intelligence

LATER
Autonomous Validation
├── Test generation
├── Regression detection
├── Failure simulation
├── Behavioral anomalies
└── Quality intelligence
```

And eventually each roadmap item could have statuses:

```text
Shipped
In progress
Planned
Research
Exploring
```

So the distinction becomes:

```text
/company
"Where is Tellann going?"

/roadmap
"What exactly are you building and what's its status?"
```

Keep `/roadmap`.

---

# 6. Your revised Company mega menu

Your current menu is:

```text
Company
About
Careers
Contact
Brand
Roadmap
```

I would change it to:

```text
COMPANY

┌─────────────────────────────┐
│ Company Overview          → │
│ Learn about Tellann.        │
└─────────────────────────────┘

Careers
Help build Tellann.

Contact
Talk to the Tellann team.

Brand
Tellann brand resources.

Roadmap
See what we're building.
```

So you end up with **five**, not six.

---

# 7. Rename `Company` inside the mega menu

There's one minor UX issue visible in your screenshot.

The navbar says:

```text
Company
```

Then the menu opens with:

```text
EXPLORE
Company
```

and the first featured item is also:

```text
Company
Learn about Tellann.
```

That's too much repetition.

I'd change the mega-menu heading.

Instead of:

```text
EXPLORE
Company
```

use:

```text
EXPLORE
Tellann
```

or simply:

```text
COMPANY
```

Then the featured card:

```text
Company Overview
Learn why Tellann exists.
                             →
```

So visually:

```text
EXPLORE

Tellann
```

and:

```text
TELLANN

┌────────────────────────────┐
│ Company Overview        →  │
│ Our mission, principles    │
│ and what we're building.   │
└────────────────────────────┘

Careers
Help build Tellann.

Contact
Talk to our team.

Brand
Logos, identity and brand resources.

Roadmap
See what we're building next.
```

Much cleaner.

---

# 8. I would also change some of your descriptions

Current:

> Company — Learn about Tellann.

That's very generic.

I'd use:

### Company Overview

> **Why Tellann exists and where we're going.**

### Careers

> **Help build the future of software quality.**

### Contact

> **Talk to the Tellann team.**

### Brand

> **Logos, identity and brand resources.**

### Roadmap

> **See what we're building next.**

They communicate actual intent rather than repeating the title.

---

# 9. What happens to `/about` technically

Don't simply delete it if it has ever been publicly accessible.

Implement:

```text
/about
      ↓ 301
/company
```

Likewise, update:

* sitemap;
* canonical URLs;
* footer;
* navbar;
* internal links;
* metadata;
* structured data.

There should be one canonical company-story URL:

```text
https://tellann.co/company
```

---

# 10. Company-page links to the deeper routes

The `/company` page itself should naturally feed these pages.

For example:

### Product evolution section

```text
We're building this in stages.

[ Explore the full roadmap → ]
```

→ `/roadmap`

### Principles / careers section

```text
Help build Tellann.

[ Explore careers → ]
```

→ `/careers`

### Press section

```text
Need Tellann assets?

[ Brand resources → ]
```

→ `/brand`

### End of page

```text
Want to talk?

[ Contact us → ]
```

→ `/contact`

So `/company` becomes the **hub**, while those pages become deeper branches.

---

# 11. Final Company information architecture

I would settle on:

```text
/company
│
│  Corporate overview
│  Why Tellann exists
│  Mission
│  Vision
│  Philosophy
│  Category
│  Principles
│  Direction
│
├───────────────→ /careers
│                 Employment
│
├───────────────→ /contact
│                 Communication
│
├───────────────→ /brand
│                 Brand assets
│
└───────────────→ /roadmap
                  Product direction
```

And eliminate:

```text
/about
```

as an independent content destination.

### So, in short:

| Current route | Decision              | Reason                            |
| ------------- | --------------------- | --------------------------------- |
| `/company`    | **Keep**              | Canonical company/story page      |
| `/about`      | **Remove / redirect** | Redundant with `/company`         |
| `/careers`    | **Keep**              | Separate employment intent        |
| `/contact`    | **Keep**              | Separate transactional intent     |
| `/brand`      | **Keep**              | Separate media/identity resources |
| `/roadmap`    | **Keep**              | Detailed product direction/status |

This also makes your mega menu stronger: **Company stops being one link among several equivalent company pages and becomes the hub from which the more specialized corporate routes branch outward.**

`/company` should be the **corporate identity page for Tellann**.

It should answer questions that the product pages cannot:

**Why does Tellann exist? What does the company believe? What category is it building? Where is it going? Who is it building for? Can this company be trusted to exist beyond one clever feature?**

I would avoid turning `/company` into a long biography or another product page. Its role is to establish **conviction, legitimacy, philosophy, and direction**.

The strongest foundation already exists in the PRD: Tellann is built around the belief that software generates enough behavioral evidence to reveal its own quality state, and its long-term ambition is to become the intelligence layer through which software can understand and communicate its quality. 

# `/company` — Complete Company Page Specification

## 1. Primary objective

The company page should serve four audiences:

```text
Prospective customer
→ "Who is behind this product, and what do they believe?"

Prospective employee
→ "Is this an interesting company to build with?"

Investor / partner
→ "What category is Tellann trying to create?"

Press / researcher
→ "How should I understand and describe Tellann?"
```

The visitor should leave knowing:

```text
Tellann's mission

Tellann's worldview

What problem it exists to solve

What category it is building

What it is building today

Where the product is heading

What principles govern the company
```

---

# 2. Page structure

I would structure `/company` like this:

```text
/company
│
├── 01 Navigation
├── 02 Company Hero
├── 03 Why Tellann Exists
├── 04 The Problem We Saw
├── 05 Our Core Belief
├── 06 What Tellann Is Building
├── 07 Category Positioning
├── 08 Mission & Vision
├── 09 Product Evolution
├── 10 Company Principles
├── 11 Who We Build For
├── 12 Trust & Responsibility
├── 13 Company / Product Milestones
├── 14 Careers Teaser
├── 15 Press / Brand Resources
├── 16 Final CTA
└── 17 Footer
```

---

# 3. Section 01 — Navigation

Use the normal marketing navigation.

```text
Tellann

Product
Solutions
Developers
Resources
Pricing
Company

                         Sign in
               Book demo   Start free
```

`Company` becomes active.

If Company later becomes a mega-menu, it can contain:

```text
Company
├── Overview
├── About
├── Careers
├── Contact
├── Brand
└── Roadmap
```

But `/company` itself should remain the corporate overview.

---

# 4. Section 02 — Company hero

Unlike the homepage, the hero should not lead with product functionality.

It should lead with the idea behind the company.

## Eyebrow

```text
ABOUT TELLANN
```

or:

```text
THE COMPANY
```

I prefer `ABOUT TELLANN`.

---

## H1

Recommended:

> **Software should be able to explain its own quality.**

This comes directly from the product vision. 

That is considerably stronger than:

> We're building the future of testing.

The latter is generic. The former is a thesis.

---

## Supporting copy

Something like:

> Tellann is building a behavioral quality intelligence platform that helps software teams understand how their applications behave, what they have actually validated, where quality gaps remain, and eventually how software can continuously evaluate its own behavior.

The first half reflects current capabilities; the autonomous evaluation part should clearly be presented as future direction rather than current availability.  

---

## CTA

Keep CTAs restrained:

```text
[ Explore the product ]   [ Read our story ]
```

First:

```text
/product
```

Second can scroll to:

```text
#why-tellann
```

---

# 5. Hero visual

Do not show another dashboard screenshot.

Show the company's central conceptual progression:

```text
Software
   ↓
Behavior
   ↓
Understanding
   ↓
Quality
```

Or more completely:

```text
Observe
   ↓
Understand
   ↓
Evaluate
   ↓
Explain
```

This echoes the long-term product lifecycle described in the PRD. 

With your monochrome identity, this could be a large minimal animated graph rather than a conventional company photograph.

---

# 6. Section 03 — Why Tellann exists

Anchor:

```text
/company#why-tellann
```

Heading:

> **Quality became harder to understand as software became easier to change.**

This section should explain the company-level insight.

Structure it around the change in modern software development:

```text
Faster release cycles
+
Larger applications
+
More distributed systems
+
More user journeys
+
Higher expectations

          ↓

Software changes faster than teams
can manually reason about its behavior.
```

The PRD identifies shorter release cycles, growing application complexity, rising user expectations, and increasingly expensive testing as part of the core problem space. 

---

# 7. Problem narrative

Use perhaps three large statements instead of many cards.

### 01

> **Tests describe what teams expected.**

They are useful, but their existence does not necessarily describe all actual application behavior.

### 02

> **Monitoring describes technical health.**

It can show errors, latency, infrastructure state, traces and related technical signals.

### 03

> **Analytics describes what users did.**

But none of these independently answer:

> **Is this software behaving correctly as a system of workflows?**

That distinction sits at the heart of the product philosophy and competitive positioning.  

---

# 8. Section 04 — The problem we saw

Heading:

> **Software leaves behind evidence of its own quality. Most teams just don't have a model for reading it.**

Then expose the central argument:

```text
Navigation
Clicks
State changes
API activity
Failures
Workflow completion
Response times

        ↓

Behavioral evidence
```

Tellann's event model defines those kinds of observable events as the raw material for behavioral modeling. 

Then:

```text
Behavioral evidence
        ↓
Sessions
        ↓
States
        ↓
Transitions
        ↓
Workflows
        ↓
Behavior Graph
```

That transformation is fundamental to Tellann's Behavior Graph specification. 

---

# 9. Section 05 — Core belief

This should be visually significant.

Large centered quote-style statement:

> **Applications generate enough behavioral data to reveal their own quality state.**

That statement is essentially the core belief of the product philosophy. 

Under it:

> If software behavior can be observed, reconstructed and modeled, then teams can reason about quality from evidence rather than relying only on what they remembered to test.

Then:

```text
Behavior
is not just analytics.

Behavior
is quality evidence.
```

This is the intellectual foundation of Tellann.

---

# 10. Section 06 — What Tellann is building

Now transition from philosophy into the product.

Heading:

> **We're building the behavioral intelligence layer for software quality.**

Then three columns:

```text
OBSERVE

Understand what
actually happened.


MODEL

Turn interactions into
states, transitions
and workflows.


EVALUATE

Measure coverage and
surface quality gaps.
```

For current Phase 1, those map to:

* SDK capture;
* session recording;
* behavior graphs;
* workflow discovery;
* coverage;
* missing states;
* missing flows;
* session replay;
* endpoint analysis;
* reports. 

---

# 11. Current product callout

Make a distinction between what Tellann is **today** and the larger vision.

Something like:

```text
TODAY

Behavioral QA

Connect an application.
Demonstrate workflows.
Generate behavioral graphs.
Measure coverage.
Identify missing paths and states.
Review replay and endpoint evidence.
Generate QA reports.
```

CTA:

```text
Explore Tellann →
```

Destination:

```text
/product
```

---

# 12. Section 07 — Category positioning

This is important for investors, media and technically sophisticated customers.

Heading:

> **Tellann sits between QA, observability and product analytics.**

Then a restrained comparison:

```text
Observability
"What happened technically?"

Product Analytics
"How are people using the product?"

Traditional QA
"What did we test?"

Tellann
"What behavior exists, what is missing,
and what does that tell us about quality?"
```

The competitive analysis explicitly positions Tellann as **Behavioral Quality Intelligence**, rather than as another monitoring, analytics, or replay product. 

---

# 13. Category diagram

A Venn-like conceptual visual:

```text
            QA
             \
              \
           TELLANN
          /       \
         /         \
Observability    Analytics
```

But a more Tellann-specific diagram may be better:

```text
Testing
    │
    ▼
What should work?

Observability
    │
    ▼
What broke?

Analytics
    │
    ▼
What did users do?

Tellann
    │
    ▼
How is the software behaving?
```

Avoid saying:

> We replace all three.

The competitive analysis does not support that claim. In fact, it explicitly frames Tellann as occupying a different layer. 

---

# 14. Section 08 — Mission & vision

This deserves a clean section.

## Mission

Use the established mission:

> **Help software teams discover, understand, and resolve quality issues before they impact users by transforming application behavior into continuously evolving quality intelligence.**



---

## Vision

Use the established vision:

> **To become the intelligence layer that enables software applications to understand, evaluate, and communicate their own operational quality.**



Do not rewrite these every few months unless the underlying product strategy changes.

They should become canonical company language.

---

# 15. Mission/vision layout

Desktop:

```text
┌─────────────────────────────┬─────────────────────────────┐
│ MISSION                     │ VISION                      │
│                             │                             │
│ Help software teams...      │ Become the intelligence... │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘
```

Mobile:

```text
MISSION

...

────────────

VISION

...
```

---

# 16. Section 09 — Product evolution

Heading:

> **We're building this in stages.**

This is where you explain the roadmap without pretending future systems exist now.

Use:

```text
01
Behavioral QA
NOW

02
Production Intelligence
NEXT

03
Autonomous Validation
FUTURE
```

The three-phase evolution is defined consistently across the product and architecture documents.  

---

# 17. Phase 1 — Behavioral QA

Display:

```text
CURRENT

Behavioral QA Platform
```

Copy:

> Begin with evidence from developer demonstrations.

Capabilities:

```text
Developer Demonstration Mode
Session Replay
Behavior Graphs
Workflow Discovery
Coverage Analysis
Missing States
Missing Flows
Endpoint Intelligence
QA Reports
```



---

# 18. Phase 2 — Production Intelligence

Label clearly:

```text
FUTURE
```

or:

```text
PLANNED
```

Capabilities:

```text
Production monitoring
Workflow health
Journey intelligence
Database intelligence
Error correlation
```

These are Phase 2 capabilities in the functional requirements. 

Message:

> Move from understanding demonstrated behavior to understanding how applications behave continuously in production.

---

# 19. Phase 3 — Autonomous Validation

Again:

```text
FUTURE
```

Capabilities:

```text
Test generation
Regression detection
Failure simulation
Behavioral anomaly detection
Optimization intelligence
Quality intelligence
```



Message:

> Turn accumulated behavioral knowledge into evidence-driven validation and quality recommendations.

Do not say:

> Tellann autonomously tests your software today.

The MVP scope explicitly prohibits that positioning. 

---

# 20. Long-term visual

Use the canonical lifecycle:

```text
Observe Applications
        ↓
Understand Behavior
        ↓
Generate Tests
        ↓
Monitor Production
        ↓
Learn User Behavior
        ↓
Recommend Improvements
        ↓
Autonomously Validate Future Releases
```

That progression appears in the PRD as the complete product vision. 

Because some intermediate ordering differs across different phase descriptions, I would visually label this as **long-term vision**, not a strict release timeline.

---

# 21. Section 10 — Company principles

This should not be fluffy values such as:

```text
Integrity
Innovation
Excellence
Customer First
```

Almost every company claims those.

Tellann already has strong product and architectural principles that can become meaningful corporate values.

I would use six.

---

# 22. Principle 01 — Evidence over assumption

> **Evidence over assumption.**

Supporting copy:

> Quality decisions should be grounded in observed software behavior wherever possible.

This directly reflects the product philosophy.

---

# 23. Principle 02 — Understand before automating

> **Understand before automating.**

This is especially important for Tellann.

Phase 1 deliberately prioritizes behavioral visibility before autonomous validation. 

Supporting:

> We would rather build a trustworthy understanding of software behavior than rush toward automation nobody can explain.

---

# 24. Principle 03 — Explainability

> **Intelligence should show its evidence.**

Future intelligence requirements explicitly require confidence indicators, explainability, supporting evidence and rationale. 

Supporting:

> A recommendation without evidence is just another opinion.

---

# 25. Principle 04 — Privacy by design

> **Observe behavior without collecting what you shouldn't.**

The privacy architecture is explicit about minimization, masking, exclusion and customer-controlled privacy policies. 

---

# 26. Principle 05 — Developer trust

> **The tool should earn access to the code and telemetry it observes.**

Supporting principles:

```text
Minimal SDK overhead
Transparent collection
Clear privacy controls
Predictable behavior
Useful output
```

The NFR and SDK specifications require low overhead and privacy controls.  

---

# 27. Principle 06 — Build for evolution

> **Today's architecture should not become tomorrow's ceiling.**

The system architecture explicitly requires evolution from Behavioral QA to Production Intelligence and Autonomous Validation without architectural redesign. 

---

# 28. Principles layout

Use six blocks, but not generic cards.

For instance:

```text
01 / EVIDENCE
Evidence over assumption.

02 / UNDERSTANDING
Understand before automating.

03 / EXPLAINABILITY
Show the evidence.

04 / PRIVACY
Observe responsibly.

05 / TRUST
Earn developer trust.

06 / EVOLUTION
Build for what comes next.
```

Very Tellann.

---

# 29. Section 11 — Who we build for

Heading:

> **For the people accountable when software doesn't behave as expected.**

Then four primary groups.

### Software Engineers

> Need to understand workflow behavior, failures and regressions.

### QA Engineers

> Need visibility into coverage, gaps and overlooked paths.

### Engineering Leaders

> Need confidence that important behavior has actually been validated.

### Product Teams

> Need clearer evidence about journeys, friction and product behavior.

These user groups come directly from the PRD. 

---

# 30. Organizational targets

Second row:

```text
Startups
SaaS businesses
Growing engineering teams
Enterprise organizations
```

But make clear that MVP product emphasis is presently strongest around developers, QA engineers, founders, technical product managers and development teams. 

---

# 31. Section 12 — Trust & responsibility

This section should answer:

> "You're asking to observe my application. Why should I trust you?"

Heading:

> **Observation requires responsibility.**

Then four pillars.

### Privacy

```text
Sensitive-data exclusion
Configurable masking
Privacy before transmission
```



### Security

```text
Authenticated access
Tenant isolation
Encryption
RBAC
Auditability
```



### Transparency

```text
Documented event taxonomy
Documented collection rules
Explainable reports
```



### Control

```text
Retention policies
Privacy rules
Exports
Enterprise deployment controls
```



CTA:

```text
Read about Security →
```

---

# 32. Privacy statement callout

Something like:

> Tellann is designed to understand application behavior, not collect the contents of people's private lives.

Then explain that passwords, authentication tokens, payment credentials, secrets, government identity data and other restricted classes are excluded under the privacy specification. 

This can become a memorable company-level position.

---

# 33. Section 13 — Company milestones

I would implement the component now, but only expose verified milestones.

Potential structure:

```text
2026

Tellann founded / product development began
        │
        ▼
Behavioral QA architecture defined
        │
        ▼
Developer Demonstration Mode
        │
        ▼
First SDK integrations
        │
        ▼
Public launch
```

However, your supplied product specifications do **not** provide authoritative company founding dates, launch dates, funding history, customer counts, employee counts, or revenue.

Therefore do not invent:

```text
Founded in 2024
50+ customers
$2M raised
15 employees
10 million sessions analyzed
```

unless you actually establish those figures separately.

The component can remain hidden until genuine milestones exist.

---

# 34. Alternative if you have few milestones

Instead of a fake timeline, use:

> **What we're working toward**

```text
Current
Ship Behavioral QA

Next
Learn from production behavior

Long term
Enable software to continuously
evaluate and explain quality
```

This is safer and currently supported by the roadmap documents. 

---

# 35. Section 14 — Careers teaser

Even if `/careers` exists separately, `/company` should introduce the idea.

Heading:

> **Help build the intelligence layer for software quality.**

Supporting copy:

> Tellann sits at the intersection of developer tooling, distributed systems, behavioral modeling, observability, QA and eventually machine intelligence.

CTA:

```text
Explore careers →
```

Route:

```text
/careers
```

If you are not hiring, show:

```text
We're not currently hiring.
Follow our progress for future opportunities.
```

Do not fake job listings.

---

# 36. Roles this company will eventually attract

For future career architecture, categories might include:

```text
Engineering
├── Platform
├── Backend
├── Frontend
├── SDK
├── Infrastructure

Product
├── Product Design
├── Product Management

Research / Intelligence
├── Behavioral Systems
├── Applied ML

Go-to-Market
├── Developer Relations
├── Sales
├── Marketing
```

But `/company` only needs a teaser.

---

# 37. Section 15 — Brand / press resources

Heading:

> **Tellann in one sentence.**

Use a canonical press description.

Suggested:

> **Tellann is a behavioral quality intelligence platform that observes software behavior, models application workflows, measures behavioral coverage, and helps engineering teams identify quality gaps.**

This description is grounded in the PRD and current MVP.  

Then:

```text
[ Brand assets ]   [ Contact ]
```

Routes:

```text
/brand
/contact
```

---

# 38. Longer company description

You may also include:

> Tellann is building a software quality intelligence platform designed to understand applications through observed behavior. The platform transforms sessions, states, transitions, workflows and backend activity into behavioral models that engineering teams can use to evaluate coverage and discover quality gaps.

This gives journalists and partners reusable language.

---

# 39. Company statistics

Do not put empty SaaS vanity stats.

Avoid:

```text
10M+
Events analyzed

99.9%
Accuracy

500+
Developers
```

unless independently real and defensible.

Early-stage company pages often look more credible without fake-looking counters.

Eventually this section can support:

```text
Applications analyzed
Sessions processed
Workflows discovered
Developers using Tellann
Countries
```

but only with real data.

---

# 40. Founder's story

I would **not make the founder story dominant** on `/company`.

Tellann should feel larger than one person.

However, later you could add:

```text
A note from the founder →
```

or:

```text
Why I started Tellann
```

if founder-led branding becomes part of your GTM.

That belongs better in:

```text
/company/story
```

or a blog post than as the center of `/company`.

---

# 41. Legal company information

Do not mix legal entity information into the main storytelling sections.

If Tellann eventually operates through a formal parent/subsidiary structure, place actual legal information in the footer or legal pages once established.

Your product documents do not define the legal corporate entity, so `/company` should currently refer to **Tellann** rather than inventing a registered-company name. 

---

# 42. Section 16 — Final CTA

Use a product-focused CTA.

Heading:

> **See what your application's behavior can tell you.**

Supporting:

> Connect Tellann, demonstrate a workflow, and begin turning observed behavior into quality evidence.

Buttons:

```text
[ Start free ]     [ Explore the product ]
```

This brings the philosophical company page back toward conversion.

---

# 43. Footer

Use the full footer component we defined previously.

Company column:

```text
Company
├── Company
├── About
├── Careers
├── Contact
├── Brand
└── Roadmap
```

`Company` can point to `/company`.

---

# 44. Desktop visual hierarchy

I would make `/company` one of the more editorial Tellann pages.

```text
NAV
──────────────────────────────────

HERO

Software should be able
to explain its own quality.

Large conceptual visual

──────────────────────────────────

WHY TELLANN EXISTS

Large editorial typography

──────────────────────────────────

THE PROBLEM

Testing
Monitoring
Analytics
          → missing layer

──────────────────────────────────

CORE BELIEF

"Applications generate enough
behavioral data..."

──────────────────────────────────

WHAT WE'RE BUILDING

Observe
Model
Evaluate

──────────────────────────────────

CATEGORY

QA × Analytics × Observability

──────────────────────────────────

MISSION            VISION

──────────────────────────────────

PRODUCT EVOLUTION

01        02        03
NOW       NEXT      FUTURE

──────────────────────────────────

PRINCIPLES

01 02 03
04 05 06

──────────────────────────────────

WHO WE BUILD FOR

──────────────────────────────────

TRUST

──────────────────────────────────

CAREERS

──────────────────────────────────

ABOUT / PRESS

──────────────────────────────────

FINAL CTA

──────────────────────────────────

FOOTER
```

---

# 45. Visual direction

Unlike `/product`, this page should have fewer product screenshots.

I would use:

* typography;
* diagrams;
* subtle graph visuals;
* architecture-inspired lines;
* whitespace;
* the Tellann node/sigil;
* restrained motion.

It should feel closer to a technology manifesto than a product feature catalog.

---

# 46. Monochrome implementation

Given the established Tellann direction:

```text
Background
Black / near-black or white / near-white

Primary foreground
Opposite monochrome

Secondary foreground
Muted grey

Borders
Low-contrast monochrome

Accent
Extremely limited
```

The company page is where monochrome branding can be especially strong.

---

# 47. Motion

Possible animation sequence in the hero:

```text
isolated events
     ↓
events connect
     ↓
states emerge
     ↓
graph forms
     ↓
"quality becomes visible"
```

Very subtle.

Avoid particle clouds or generic AI brains.

---

# 48. Mobile structure

Mobile:

```text
Navbar

Hero
 ↓
Why Tellann
 ↓
Problem
 ↓
Core belief
 ↓
What we're building
 ↓
Category
 ↓
Mission
 ↓
Vision
 ↓
Roadmap
 ↓
Principles
 ↓
Users
 ↓
Trust
 ↓
Careers
 ↓
Final CTA
 ↓
Footer
```

Mission and Vision stack rather than remain side-by-side.

Product phases can become a vertical timeline:

```text
01 NOW
Behavioral QA
│
02 NEXT
Production Intelligence
│
03 FUTURE
Autonomous Validation
```

---

# 49. SEO metadata

Suggested title:

```text
Company | Tellann — Building Behavioral Quality Intelligence
```

Meta description:

```text
Learn why Tellann exists, the principles behind behavioral quality intelligence, and our vision for software that can understand, evaluate, and communicate its own quality.
```

Canonical:

```text
https://tellann.co/company
```

---

# 50. H-tag structure

```text
H1
Software should be able to explain its own quality.

H2
Why Tellann exists

H2
Software leaves behind evidence of its own quality

H2
What we're building

H2
A new layer for software quality

H2
Our mission and vision

H2
We're building this in stages

H2
The principles behind Tellann

H2
Who we build for

H2
Observation requires responsibility

H2
Help build Tellann
```

---

# 51. Analytics

Track:

```text
COMPANY_PAGE_VIEWED

COMPANY_PRODUCT_CLICKED
COMPANY_STORY_CLICKED

COMPANY_ROADMAP_PHASE_VIEWED

COMPANY_SECURITY_CLICKED
COMPANY_CAREERS_CLICKED
COMPANY_BRAND_CLICKED

COMPANY_START_FREE_CLICKED
COMPANY_PRODUCT_CTA_CLICKED
```

Potentially useful engagement:

```text
mission_section_viewed
roadmap_section_viewed
principles_section_viewed
trust_section_viewed
```

---

# 52. Reusable component architecture

```text
CompanyPage
│
├── MarketingNavbar
├── CompanyHero
├── WhyTellannSection
├── ProblemNarrative
├── CoreBeliefSection
├── CompanyProductSection
├── CategoryPositioning
├── MissionVisionSection
├── EvolutionTimeline
│   └── ProductPhase[]
├── PrinciplesSection
│   └── Principle[]
├── AudienceSection
│   └── AudienceCard[]
├── TrustSection
├── MilestonesSection
├── CareersCTA
├── PressBrandSection
├── FinalCTA
└── MarketingFooter
```

---

# 53. Content data structures

For principles:

```ts
type CompanyPrinciple = {
  number: string;
  title: string;
  description: string;
};
```

For roadmap:

```ts
type CompanyPhase = {
  number: number;
  status: "CURRENT" | "PLANNED" | "FUTURE";
  name: string;
  description: string;
  capabilities: string[];
};
```

For user groups:

```ts
type CompanyAudience = {
  name: string;
  description: string;
  href: string;
};
```

Keep these content-driven rather than embedding everything directly in JSX.

---

# 54. Important distinction: `/company` vs `/about`

I would actually reconsider whether you need both.

If you have:

```text
/company
/about
```

and they contain nearly identical information, you're manufacturing unnecessary navigation.

I would recommend:

```text
/company
```

as the primary corporate page.

Then inside Company:

```text
/company
/company/careers
/company/contact
/company/brand
/company/roadmap
```

or keep your shorter existing marketing routes:

```text
/company
/careers
/contact
/brand
/roadmap
```

But I would **drop a separate `/about` page** unless it serves a genuinely different function.

The cleaner public architecture is:

```text
Company → /company
```

not:

```text
Company → /company
About → /about
```

where both answer "what is Tellann?"

---

# 55. The narrative the page must communicate

If all design disappeared, the page should still tell this story:

```text
Modern software changes rapidly.
        ↓
Quality has become difficult
to understand from tests alone.
        ↓
Applications constantly produce
behavioral evidence.
        ↓
That evidence can be modeled.
        ↓
Those models can reveal
workflows and quality gaps.
        ↓
Tellann begins by turning
developer demonstrations
into behavioral QA intelligence.
        ↓
Over time that behavioral foundation
can support production intelligence
and autonomous validation.
        ↓
Our goal:
software capable of understanding
and communicating its own quality.
```

That is the `/company` page I would build.

The most important difference from the homepage is subtle but fundamental: **the homepage sells what Tellann can do; the company page explains why Tellann deserves to exist.**  
