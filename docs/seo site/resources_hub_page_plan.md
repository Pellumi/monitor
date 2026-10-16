Yes. `/resources` should become Tellann’s **public learning and discovery hub**.

Its job is not to overwhelm visitors with every document, article, video, and release note you have. Its job is to answer a much simpler question:

> **“I am this kind of user, with this kind of problem. What should I learn next?”**

That matters because Tellann serves several distinct users. The formal requirements identify Developers, QA Engineers, Engineering Managers, and Product Managers, while the MVP also explicitly targets startup founders and technical product managers. frs mvp_scope

And because this is the SEO marketing site, `/resources` should primarily explain **problems, concepts, outcomes, and workflows**, then route technical users toward documentation. It should not read like internal engineering documentation.

---

# `/resources` — Complete Page Specification

## 1. Primary purpose

The Resource Hub should help visitors:

```text
Understand Tellann
        ↓
Understand their problem
        ↓
Find content for their role
        ↓
Learn the relevant concept
        ↓
See how Tellann solves it
        ↓
Read / watch / follow a guide
        ↓
Try Tellann
```

The fundamental MVP proposition is extremely useful here:

> A team states what its software should do, demonstrates it once, and Tellann shows the difference between intent and observed behavior. mvp_scope

That should quietly shape the whole Resource Hub.

---

# 2. What `/resources` is NOT

Do not make it:

```text
/resources

Latest posts
Blog post
Blog post
Blog post
Blog post
Blog post
```

That wastes the route.

And do not make it:

```text
Documentation
API reference
SDK reference
Architecture
Event schemas
...
```

Technical documentation deserves its own `/docs` environment.

Instead:

```text
/resources
        │
        ├── Learn Tellann
        ├── Browse by role
        ├── Browse by problem
        ├── Guides
        ├── Tutorials
        ├── Videos
        ├── Articles
        ├── Customer / example stories
        ├── Product updates
        ├── Glossary
        └── Documentation gateway
```

Think of `/resources` as the **airport terminal**. It directs people toward the right destination.

---

# 3. Recommended Resource ecosystem

I would ultimately build this resource structure:

```text
/resources
│
├── /resources/guides
│   └── practical long-form guides
│
├── /resources/tutorials
│   └── step-by-step implementation content
│
├── /resources/videos
│   └── demos, explainers and walkthroughs
│
├── /resources/learn
│   └── behavioral QA educational content
│
├── /resources/glossary
│   └── software quality / Tellann terminology
│
├── /resources/case-studies
│   └── later, when genuine customer evidence exists
│
├── /blog
│   └── editorial / thought leadership / announcements
│
├── /docs
│   └── technical documentation
│
├── /changelog
│   └── what shipped
│
└── /roadmap
    └── where the product is going
```

You do **not** need every child route at launch.

For the initial marketing website I would implement:

```text
/resources
/resources/guides
/resources/videos
/resources/glossary

/docs
/blog
/changelog
/roadmap
```

Case studies should wait until you have real cases. Invented or hypothetical “customer success” belongs nowhere near the marketing site.

---

# 4. Overall page architecture

The desktop page should follow approximately:

```text
NAVIGATION
────────────────────────────────────────────

RESOURCE HERO
Learn software quality through behavior.

[ Search resources... ]

Browse:
Developers · QA · Managers · Product · Founders

────────────────────────────────────────────

START HERE
New to Tellann?

Declare → Demonstrate → Understand → Improve

[ 3-minute overview ]

────────────────────────────────────────────

EXPLORE BY ROLE

Developer
QA Engineer
Engineering Manager
Product Team
Startup Founder

────────────────────────────────────────────

EXPLORE BY PROBLEM

What did we miss?
How much have we actually tested?
Why did this workflow fail?
What does the application actually do?
How do I validate intended behavior?
How do I understand an API in workflow context?

────────────────────────────────────────────

FEATURED RESOURCE

Large editorial card + video / guide

────────────────────────────────────────────

LEARN THE TELLANN MODEL

Intent
Demonstration
Behavior Graph
Coverage
Missing States
Missing Flows
Reconciliation
Reports

────────────────────────────────────────────

POPULAR GUIDES

[ card ][ card ][ card ]

────────────────────────────────────────────

WATCH & LEARN

[ featured video ]
[ smaller videos ]

────────────────────────────────────────────

FOR DEVELOPERS

SDK
Desktop
Integration
Privacy
API

────────────────────────────────────────────

FOR QA & PRODUCT TEAMS

Coverage
Reconciliation
Reports
Workflow analysis

────────────────────────────────────────────

PRODUCT UPDATES

Changelog
Roadmap

────────────────────────────────────────────

GLOSSARY / LEARNING LIBRARY

────────────────────────────────────────────

CTA

See what your application
actually demonstrated.

[ Start free ] [ Read docs ]

────────────────────────────────────────────

FOOTER
```

---

# 5. Section 01 — Hero

### Eyebrow

> **TELLANN RESOURCES**

### H1

I would use:

> **Understand software behavior. Build with more confidence.**

Alternative:

> **Learn how to see the gaps your tests don't.**

The first is safer and broader.

### Supporting copy

> Explore guides, tutorials, videos and technical resources for understanding application behavior, workflow coverage, missing states and the difference between intended and observed software.

### Primary actions

```text
[ Explore resources ]

[ Read documentation → ]
```

The first scrolls to the content.

The second goes to `/docs`.

---

# 6. Hero resource search

Immediately below the copy:

```text
┌───────────────────────────────────────────┐
│ 🔍 Search guides, videos and concepts... │
└───────────────────────────────────────────┘

Popular:
Behavior Graphs
Workflow Coverage
Session Replay
Missing States
Desktop Agent
Reconciliation
```

Desktop width:

```text
560–640px
height: 52–56px
```

Mobile:

```text
width: 100%
height: 52px
```

Do not expose 15 filters in the hero.

Search should feel simple.

---

# 7. Hero visual

Do **not** use a developer stock photograph.

Use the product itself as the visual language.

### Recommended visual

A small animated knowledge/resource constellation:

```text
                  Session Replay
                       │
                       │
Coverage ─── Behavior Graph ─── Missing States
                       │
                       │
               Reconciliation
                       │
                   QA Reports
```

Hovering a concept reveals:

```text
BEHAVIOR GRAPH

See how states, actions and
workflows connect.

Learn more →
```

This reinforces that the resources belong to one coherent system.

### Desktop dimensions

Source design:

```text
1400 × 1000
```

Rendered:

```text
Hero content area: 1200–1280px wide

Text:
520–580px

Visual:
560–620px wide
400–460px high
```

### Mobile

Do not reproduce the complex network.

Use:

```text
Behavior Graph
      ↓
Coverage
      ↓
Gaps
      ↓
Reports
```

Rendered approximately:

```text
100% width
260–320px high
```

---

# 8. Hero animation

The graph can subtly construct itself on entrance:

```text
0 ms       central node appears
150 ms     connector lines extend
300 ms     resource nodes appear
450 ms     labels fade in
```

Then stop.

No infinite floating blobs.

No constantly orbiting icons.

The animation should communicate **relationships**, not merely prove that Framer Motion is installed.

Respect:

```css
prefers-reduced-motion
```

---

# 9. Section 02 — “New to Tellann?”

This should be one of the most important sections.

### Heading

> **New to Tellann? Start here.**

### Supporting text

> Tellann begins with a simple idea: describe what the software should do, demonstrate what it actually does, and compare the two.

The current MVP workflow explicitly centers on declaring flows, connecting the local codebase, demonstrating the application, generating behavioral intelligence, reconciling intent against observation, measuring coverage, identifying missing states/flows, analyzing APIs, replaying sessions and generating reports. mvp_scope

Represent that simply:

```text
01
DECLARE

What should happen?

       →

02
DEMONSTRATE

Show Tellann the workflow.

       →

03
OBSERVE

Tellann reconstructs the behavior.

       →

04
COMPARE

Intent vs observation.

       →

05
UNDERSTAND

Coverage, gaps and QA intelligence.
```

The marketing site should explain **this** before explaining Kafka, event collectors, graph stores, or SDK internals.

---

# 10. Starter content beneath it

Three cards:

### Tellann in 5 minutes

```text
GUIDE · 5 MIN

What Tellann does,
what problem it solves,
and where it fits.

Read →
```

### Watch how it works

```text
VIDEO · 3:30

Declare a workflow,
demonstrate it and
inspect the results.

Watch →
```

### Try your first application

```text
TUTORIAL · 10 MIN

Connect an application
and complete your first
guided QA run.

Start →
```

This creates three levels:

```text
Conceptual
↓
Visual
↓
Hands-on
```

---

# 11. Section 03 — Explore by role

This is where your instruction about user classes becomes particularly important.

Heading:

> **Resources for the way you work.**

Supporting:

> Tellann answers different questions depending on what you are responsible for.

Use **five role cards**.

---

## Developer

### Their question

> **“What actually happened in my application?”**

Show:

```text
Understand:
• application states
• workflow transitions
• failed API requests
• session evidence
• missing paths
```

Suggested resources:

```text
Getting started with Tellann Desktop
Understanding Behavior Graphs
Endpoint Intelligence explained
Session Replay for debugging
SDK integration guide
```

CTA:

> **Explore developer resources →**

---

# 12. QA Engineer

Their question:

> **“What haven't we validated?”**

Focus on:

```text
Workflow coverage
Missing states
Missing flows
Failure paths
Reconciliation
QA reports
```

Copy:

> Move beyond counting test cases. See which workflows, states and transitions were actually demonstrated—and which remain unobserved.

CTA:

> **Explore QA resources →**

---

# 13. Engineering Manager

Their question:

> **“What evidence do we have about release quality?”**

Focus on:

```text
Coverage visibility
Critical gaps
Workflow completeness
QA reporting
Evidence history
Team workflows
```

Avoid drowning them in SDK code.

Copy:

> Understand what your team demonstrated, which critical workflows remain uncovered and where additional validation deserves attention.

CTA:

> **Explore engineering leadership resources →**

---

# 14. Product / Technical Product Manager

Their question:

> **“Does the product behave the way we intended?”**

This is especially powerful for Tellann.

Focus on:

```text
Declared intent
Observed workflows
Undeclared behavior
Missing states
Workflow maps
Reconciliation
```

Copy:

> Compare the experience the product was designed to provide with the behavior the application actually demonstrated.

CTA:

> **Explore product resources →**

---

# 15. Startup founder

Their question:

> **“How do I get meaningful QA visibility without building a large QA operation?”**

Focus:

```text
Fast setup
Guided demonstrations
Workflow discovery
Coverage
Reports
Small-team workflows
```

Copy:

> Build quality visibility around your product without first constructing a heavyweight testing and observability operation.

CTA:

> **Explore startup resources →**

These personas fit the actual MVP audience rather than inventing unrelated enterprise/SRE audiences that the MVP explicitly does not target. mvp_scope

---

# 16. Role card layout

Desktop:

```text
Container: 1200px

Row 1:
┌───────────┐ ┌───────────┐ ┌───────────┐
│ Developer │ │    QA     │ │Engineering│
│           │ │ Engineer  │ │ Manager   │
└───────────┘ └───────────┘ └───────────┘

Row 2:
      ┌───────────┐ ┌───────────┐
      │ Product   │ │ Founder   │
      └───────────┘ └───────────┘
```

Card:

```text
width: ~370–390px
min-height: 300–340px
padding: 28–32px
```

Mobile:

```text
one card per row
```

No role photography required.

Use simple monochrome line icons.

---

# 17. Section 04 — Explore by problem

Role segmentation isn't enough.

Some users arrive through Google with a problem, not a job title.

Heading:

> **What are you trying to understand?**

Cards should be written as questions.

For example:

```text
How much of our workflow
have we actually validated?

→ Workflow Coverage


What happens after a user
takes this action?

→ Behavior Graphs


Which states did we never reach?

→ Missing States


Which paths were never demonstrated?

→ Missing Flows


Does our implementation match
the workflow we intended?

→ Reconciliation


What happened during this run?

→ Session Replay


Which API calls affected
this workflow?

→ Endpoint Intelligence
```

This is substantially better SEO architecture than cards titled only:

```text
Coverage
Replay
Graph
Reports
```

because it aligns with search intent.

---

# 18. Problem-card visual design

Use extremely lightweight visuals.

For example:

### Missing state

```text
LOGIN
  │
  ▼
DASHBOARD
  │
  ?
  │
ERROR

Missing:
AUTH_FAILURE
```

### Coverage

```text
CHECKOUT

████████░░

8 / 10
paths observed
```

### Reconciliation

```text
INTENDED           OBSERVED

LOGIN      ✓       LOGIN
CART       ✓       CART
PAYMENT    ✕       —
```

These should be rendered as HTML/SVG rather than screenshots wherever possible.

Benefits:

- responsive;
- accessible;
- sharp at every resolution;
- indexable supporting text;
- cheaper than producing raster assets.

---

# 19. Section 05 — Featured Resource

This provides editorial focus.

Use one large resource.

Desktop:

```text
┌────────────────────┬─────────────────────┐
│                    │ FEATURED GUIDE      │
│     VISUAL         │                     │
│                    │ How behavioral QA   │
│     620×350        │ changes what        │
│                    │ “coverage” means.   │
│                    │                     │
│                    │ 8 min read          │
│                    │ Read guide →        │
└────────────────────┴─────────────────────┘
```

Whole section:

```text
1200 × approximately 430px
```

Featured image source:

```text
1600 × 900
16:9
WebP / AVIF
```

Rendered:

```text
~580 × 326
```

---

# 20. Featured visual style

The image shouldn't just be:

> random person looking at laptop.

Instead create Tellann-specific editorial artwork.

Example:

```text
Known workflow

A ─── B ─── C ─── D
      │
      └── E


Observed

A ─── B ─── C


The interesting part
is what isn't there.
```

This can become a recognizable Tellann content aesthetic.

---

# 21. Section 06 — Learn Tellann's core concepts

Heading:

> **Learn the system, one concept at a time.**

Create eight educational cards.

```text
Declared Intent
Developer Demonstration
Behavior Graphs
Workflow Discovery
Session Replay
Coverage
Missing States & Flows
Reconciliation
```

Each card contains:

```text
Concept
~20-word description
2–4 min read
Learn →
```

Do not try to explain every feature on the resource hub.

The card should answer:

> “Why should I care?”

The linked article answers:

> “How exactly does it work?”

---

# 22. Educational progression

Order the cards intentionally:

```text
DECLARE
   ↓
DEMONSTRATE
   ↓
OBSERVE
   ↓
MODEL
   ↓
ANALYZE
   ↓
RECONCILE
   ↓
REPORT
```

This is much stronger than alphabetical ordering because it teaches the product mental model.

---

# 23. Section 07 — Guides

Heading:

> **Practical guides**

Layout:

```text
[ Large guide ] [ Guide ]
                [ Guide ]
```

or clean three-column cards.

Each card should show:

```text
Category
Title
Description
Reading time
Role
Updated date
```

Example:

```text
QA GUIDE

How to find workflow
coverage gaps before release

Learn how to use observed states
and paths to identify areas that
need additional validation.

8 min

QA Engineers · Developers
```

---

# 24. Initial guide topics

Your initial SEO library should heavily target things people actually search for around software quality rather than constantly writing “What is Tellann?” content.

Early topics could include:

```text
What is behavioral testing?

What is behavioral QA?

Workflow coverage vs code coverage

What is a software behavior graph?

How to identify missing application states

How to test failure paths in web applications

How to map application workflows

How to document application flows

Session replay for software testing

How to validate user journeys

How to detect untested application workflows

Functional testing vs behavioral testing

QA strategy for early-stage startups

What should be tested before a release?

How to test checkout workflows

What is workflow reconciliation?
```

These create SEO entry points that naturally lead into Tellann.

---

# 25. Do not over-brand educational titles

Avoid:

```text
Tellann Behavior Graphs:
The Ultimate Tellann Guide

Tellann Missing States:
How Tellann Does Missing States
```

Prefer:

> **What is a software behavior graph?**

Then explain the general problem first.

Later:

> “Tellann uses this model to…”

Educational SEO earns trust before it asks for a conversion.

---

# 26. Section 08 — Video Library

Heading:

> **See Tellann in action.**

Featured video:

### Title

> **From demonstration to QA report**

Duration:

```text
3–5 minutes
```

Content:

```text
00:00 Application
00:20 Declare intended workflow
00:50 Open Tellann Desktop
01:15 Start guided run
01:45 Demonstrate workflow
02:20 Behavior Graph generated
02:50 Coverage & gaps
03:20 Reconciliation
03:50 QA report
```

---

# 27. Featured video dimensions

Produce master:

```text
1920 × 1080
30fps
16:9
```

Display desktop:

```text
720 × 405
```

or:

```text
640 × 360
```

depending on the copy layout.

Mobile:

```text
width: 100%
aspect-ratio: 16 / 9
```

Poster image:

```text
1600 × 900
AVIF/WebP
```

Do not autoplay with audio.

Prefer click-to-play.

---

# 28. Supporting videos

Three smaller cards:

```text
Tellann Desktop in 2 minutes
2:14

Understanding your Behavior Graph
4:20

Finding missing workflow states
3:45
```

Thumbnail master:

```text
1280 × 720
```

Rendered desktop:

```text
360 × 203
```

Mobile:

```text
100% width
```

Keep the thumbnail treatment monochrome and product-led.

---

# 29. Video thumbnail system

Use:

```text
top-left:
TELLANN

center:
product visualization

bottom:
Behavior Graphs
04:20
```

Not YouTube-style:

```text
😱 YOU'VE BEEN TESTING WRONG!!!!
```

Tellann should feel technical, calm and credible.

---

# 30. Section 09 — Animated explainer

I would add **one major explanatory animation** to the Resource Hub.

Heading:

> **From behavior to evidence.**

Animation:

```text
Developer
   │
   ▼
Demonstration
   │
   ▼
Events
   │
   ▼
States + transitions
   │
   ▼
Behavior Graph
   │
   ├── Coverage
   ├── Missing states
   ├── Missing flows
   ├── Endpoints
   └── Replay
            │
            ▼
          Report
```

Tellann's architecture is event-driven and transforms behavioral evidence into states, workflows and analytical outputs; the marketing version should reduce that complex architecture to this understandable flow. The behavior graph itself is the central model representing observed software behavior. behaviour_graph

---

# 31. Explainer animation dimensions

Desktop:

```text
1200 × 440
```

Tablet:

```text
100% × ~420
```

Mobile:

Convert from horizontal to vertical:

```text
Observe
  ↓
Model
  ↓
Analyze
  ↓
Explain
```

approximately:

```text
100% × 600–700px
```

Avoid shrinking the desktop diagram until nobody can read it.

---

# 32. Animation behavior

Animation should trigger once when it enters the viewport.

Sequence:

```text
Demonstration
      ↓
events pulse through connector
      ↓
graph constructs
      ↓
analysis branches appear
      ↓
report resolves
```

Total:

```text
~2.5–3.5 seconds
```

Then become static.

This teaches something.

---

# 33. Section 10 — Developer resources

This should visually feel more technical.

Heading:

> **Building with Tellann**

Cards:

```text
Documentation
SDK Quickstart
Desktop setup
Frontend integration
Backend integration
API reference
Privacy configuration
```

Current SDK scope supports JavaScript, TypeScript, React, Next.js, Node.js, Express, NestJS and Fastify, making those sensible developer-resource entry points. sdk_spec

Example card:

```text
SDK QUICKSTART

Connect a React application

Add behavioral capture and prepare
your application for a guided run.

React · TypeScript
~10 min

Start tutorial →
```

---

# 34. Code snippets on `/resources`

You can show small snippets, but don't turn it into Docs.

For example:

```ts
import { TELLANN } from "@tellann/frontend-sdk";
```

Then:

> **Integrate your application →**

Do not dump 50-line setup instructions.

The resource hub explains.

Docs implement.

---

# 35. Developer visual

Create an animated integration card:

```text
React application
       │
       ▼
Tellann SDK
       │
       ▼
Behavioral evidence
       │
       ▼
Tellann
```

Desktop:

```text
560 × 320
```

No raster image required.

HTML/SVG animation is preferable.

---

# 36. Section 11 — QA resources

Heading:

> **For teams responsible for quality**

Recommended content:

```text
Planning a guided QA run
Understanding workflow coverage
Reading missing-state findings
Finding missing failure paths
Using replay as evidence
Reading reconciliation reports
Exporting QA reports
```

The reporting system exists specifically to turn raw behavioral data into understandable quality intelligence rather than forcing teams to manually interpret telemetry. qrs

That is exactly how this section should be marketed.

---

# 37. Section 12 — Resources for managers and stakeholders

Heading:

> **Quality evidence without the telemetry maze.**

This section should be intentionally nontechnical.

Cards:

```text
Reading an Executive QA Report

Understanding workflow coverage

What “missing” actually means

Evaluating evidence before release
```

This aligns with Tellann's usability requirement that quality reports remain understandable to non-QA stakeholders. nrs

This is an important differentiator.

Do not assume every visitor wants JSON.

---

# 38. Section 13 — Privacy & trust learning

Tellann observes application behavior, so prospective customers will inevitably ask:

> “What exactly are you collecting?”

Don't hide that question.

Heading:

> **Learn how Tellann handles your data.**

Three resources:

```text
What Tellann observes
→ behavioral events and metadata

What Tellann masks
→ sensitive information

What Tellann never needs
→ secrets and protected values
```

The privacy specification explicitly establishes data minimization, privacy by default, sensitive-data exclusion and tenant-controlled privacy rules. pdcs

CTA:

> **Explore security & privacy →**

Likely routes:

```text
/security
/docs/privacy
```

depending on your final architecture.

---

# 39. Privacy visual

This is one of the few places where a dedicated illustration helps.

```text
APPLICATION

click
route
state
API status
duration

       ↓

PRIVACY LAYER

password      ✕
token         ✕
secret        ✕
card number   ✕

       ↓

BEHAVIORAL EVIDENCE
```

Desktop:

```text
600 × 360
```

Source:

```text
1200 × 720
```

But again, SVG/HTML is preferable.

---

# 40. Section 14 — Latest resources

Only here should `/resources` behave like a conventional content feed.

Heading:

> **Latest from Tellann**

Example:

```text
Guide
Understanding workflow coverage
8 min

Product
Introducing Developer Demonstration Mode
5 min

Engineering
Why behavioral models need deterministic evidence
7 min

Video
From demonstration to QA report
4 min
```

Show:

```text
6 items initially
```

CTA:

> **View all resources →**

---

# 41. Resource card anatomy

Every content card should use the same data structure:

```text
TYPE

Title

Description

Role · Topic · Reading time

Updated Oct 2026

→
```

Example:

```text
GUIDE

Workflow coverage vs code coverage

Code coverage tells you which code executed.
Workflow coverage tells you which application
behaviors were actually observed.

QA Engineers · Coverage · 7 min

Read guide →
```

---

# 42. Card imagery

Not every card needs an image.

I would use:

### Featured cards

Image.

### Standard guide cards

Mostly typography + diagram/icon.

### Video cards

Thumbnail required.

### Case studies

Logo/product visual.

This prevents `/resources` from becoming a wall of generic illustrations.

---

# 43. Image specifications

Use a consistent asset system:

| Asset | Master | Display |
|---|---:|---:|
| Featured editorial | 1600×900 | ~580×326 |
| Article hero | 1600×900 | responsive 16:9 |
| Standard card image | 1200×675 | ~360×203 |
| Video thumbnail | 1280×720 | ~360×203 |
| Social/OG image | 1200×630 | metadata only |
| Resource diagram | SVG preferred | responsive |
| Author avatar | 320×320 | 40–56px |
| Customer logo | SVG preferred | ~120×40 |

Use:

```text
AVIF → primary
WebP → fallback
SVG → diagrams / logos / icons
```

Avoid PNG except when transparency genuinely requires it.

---

# 44. Section 15 — Changelog + Roadmap

Resources should connect learning to product evolution.

Two large cards:

```text
WHAT SHIPPED

Product Changelog

See new capabilities,
improvements and fixes.

View changelog →
```

and

```text
WHAT'S NEXT

Tellann Roadmap

See how Tellann evolves
from behavioral QA toward
production intelligence.

View roadmap →
```

Keep the distinction sharp:

```text
Changelog = history
Roadmap = direction
```

Your current SEO architecture already treats these as different concepts rather than interchangeable pages. SEO Website Structure

---

# 45. Section 16 — Glossary

This has substantial long-term SEO value.

Heading:

> **Software quality, explained plainly.**

Show perhaps eight popular terms:

```text
Behavior Graph
Behavioral QA
Workflow
State
Transition
Workflow Coverage
Missing State
Reconciliation
Session Replay
Declared Intent
Observed Behavior
Endpoint Intelligence
```

Each eventually becomes:

```text
/resources/glossary/behavior-graph
/resources/glossary/workflow-coverage
/resources/glossary/session-replay
```

These can attract informational search traffic.

---

# 46. Glossary page strategy

Each term should have:

```text
Plain-English definition
Why it matters
Example
Diagram
How Tellann uses it
Related concepts
Related guide
Related product capability
```

Do not create 200 thin 150-word glossary pages.

Ten genuinely useful glossary entries beat 500 SEO skeletons.

---

# 47. Section 17 — Resource CTA

Final section:

### H2

> **Ready to look at your own application?**

Supporting:

> Declare what should happen, demonstrate a workflow, and let Tellann show you what the evidence says.

Buttons:

```text
[ Start free ]

[ Read the docs ]
```

Optional tertiary:

```text
See how Tellann works →
```

---

# 48. Resource filtering

Once you have enough content, support filters:

```text
All

ROLE
Developer
QA
Engineering
Product
Founder

TOPIC
Behavior Graphs
Coverage
Replay
Reconciliation
Endpoints
Desktop
SDK
Privacy

FORMAT
Guide
Tutorial
Video
Article
Documentation
Case Study

LEVEL
Beginner
Intermediate
Advanced
```

Do **not** launch with dozens of empty filters.

At the start:

```text
Role
Topic
Format
```

is enough.

---

# 49. Search result interaction

Entering:

```text
coverage
```

could produce:

```text
GUIDE
Workflow coverage vs code coverage

CONCEPT
Understanding workflow coverage

VIDEO
Finding gaps with Tellann

DOCS
Coverage analysis reference
```

This is better than separating search by content system.

---

# 50. Resource data model

I would make the hub CMS/data driven.

```ts
interface Resource {
  id: string;
  slug: string;

  title: string;
  description: string;

  type:
    | "GUIDE"
    | "TUTORIAL"
    | "ARTICLE"
    | "VIDEO"
    | "CASE_STUDY"
    | "DOCS"
    | "GLOSSARY";

  topics: ResourceTopic[];

  audiences: (
    | "DEVELOPER"
    | "QA"
    | "ENGINEERING_MANAGER"
    | "PRODUCT"
    | "FOUNDER"
  )[];

  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

  readingMinutes?: number;
  videoDuration?: number;

  thumbnail?: Asset;

  author?: Author;

  publishedAt: string;
  updatedAt?: string;

  featured: boolean;

  relatedProducts?: string[];
  relatedResources?: string[];

  canonicalUrl: string;
}
```

Do not hardcode the Resources homepage.

---

# 51. Resource relationship model

This becomes extremely useful later:

```text
RESOURCE
   │
   ├── role
   ├── problem
   ├── concept
   ├── product feature
   ├── format
   └── related resources
```

Example:

```text
Workflow coverage vs code coverage

Role:
QA
Developer

Problem:
What haven't we tested?

Concept:
Coverage

Product:
Coverage Analysis

Related:
Missing States
Missing Flows
QA Reports
```

Now the website can automatically generate related-content modules.

---

# 52. Internal linking strategy

Every resource should lead somewhere meaningful.

Example:

```text
Glossary
Behavior Graph
     ↓
Guide
How software behavior graphs work
     ↓
Product
/product/behavior-graphs
     ↓
Guide
Find missing workflows
     ↓
Product
/product/missing-flows
     ↓
CTA
Start free
```

This creates strong topical clusters for SEO.

---

# 53. Recommended SEO clusters

Tellann should build content around perhaps six initial clusters:

```text
Behavioral QA
Workflow Testing
Software Coverage
Application Behavior
Session Investigation
Software Quality / Release Validation
```

Each cluster gets:

```text
pillar page
        │
        ├── glossary articles
        ├── guides
        ├── tutorial
        ├── video
        └── product page
```

That is considerably stronger than publishing unrelated blog posts weekly.

---

# 54. SEO title

Recommended:

> **Software QA Resources, Guides & Tutorials | Tellann**

Alternative:

> **Behavioral QA Resources & Software Testing Guides | Tellann**

I prefer the second once Tellann has established “Behavioral QA” consistently.

Initially, the first may be clearer.

---

# 55. Meta description

> **Explore Tellann guides, tutorials, videos and resources for behavioral QA, workflow coverage, session replay, missing states, API analysis and software quality.**

Keep it descriptive rather than aspirational.

---

# 56. Canonical

```text
https://tellann.co/resources
```

---

# 57. H1 and heading hierarchy

Use one H1:

```text
H1
Understand software behavior.
Build with more confidence.
```

Then:

```text
H2 New to Tellann?
H2 Resources for the way you work
H2 What are you trying to understand?
H2 Featured resource
H2 Learn Tellann
H2 Practical guides
H2 See Tellann in action
H2 Building with Tellann
H2 Quality resources
H2 Latest from Tellann
H2 Software quality glossary
H2 Ready to look at your application?
```

Cards:

```text
H3
```

---

# 58. Structured data

Use:

```text
CollectionPage
BreadcrumbList
ItemList
```

Individual guide pages:

```text
Article
```

Videos:

```text
VideoObject
```

Tutorials where appropriate:

```text
HowTo
```

Do not slap every Schema.org type onto every page.

---

# 59. Crawlable filters

Avoid generating indexable combinations such as:

```text
/resources?role=developer&type=video&topic=coverage
/resources?role=qa&type=guide&topic=coverage
...
```

unless you deliberately decide a filter deserves a permanent SEO landing page.

The primary resource items must exist as normal `<a href>` links even when JavaScript is disabled.

---

# 60. Visual language

Continue Tellann's monochrome identity.

Use:

```text
near-black backgrounds
white/off-white typography
thin neutral borders
subtle grid lines
graph nodes
technical diagrams
very restrained blur
minimal shadows
large editorial typography
```

Use differences in:

```text
line weight
opacity
spacing
pattern
```

rather than turning resource categories into:

```text
Blue = guides
Purple = video
Green = tutorials
Yellow = docs
```

That would weaken the existing identity.

---

# 61. Content type glyphs

You can still differentiate formats monochromatically.

For example:

```text
▤ Guide
▶ Video
⌘ Tutorial
◇ Concept
↗ Docs
○ Changelog
```

Always include text alongside the icon.

---

# 62. Hover animations

Resource cards:

```text
default
border: subdued

hover
border becomes brighter
title moves 2px upward
arrow → shifts 4px
thumbnail zoom: max 1.015
```

Duration:

```text
180–220ms
```

No exaggerated card tilting.

---

# 63. Scroll animation

Keep it subtle.

Sections:

```text
opacity 0 → 1
translateY 12px → 0
300–450ms
```

Stagger cards:

```text
50–70ms
```

The site should feel alive, not theatrical.

---

# 64. Mobile layout

The mobile sequence should become:

```text
NAV

HERO

SEARCH

START HERE

ROLE SELECTOR
[ Developer ▾ ]

PROBLEM CARDS

FEATURED RESOURCE

LEARN TELLANN

GUIDES

VIDEOS

DEVELOPER RESOURCES

QA / PRODUCT

CHANGELOG + ROADMAP

GLOSSARY

CTA

FOOTER
```

Do not retain huge two-column compositions below ~768px.

---

# 65. Mobile role selector

Instead of rendering five enormous role cards immediately:

```text
Resources for:

[ Developer       ▾ ]
```

Then show:

```text
What actually happened
inside my application?

Recommended

Behavior Graphs
Endpoint Intelligence
Session Replay

View developer resources →
```

Users can change persona.

This drastically reduces mobile page length.

---

# 66. Responsive breakpoints

I would approximately use:

```text
< 640px
Mobile

640–1023px
Tablet

1024–1279px
Desktop

1280px+
Wide desktop
```

Primary content:

```text
max-width: 1200–1280px
```

Article prose later:

```text
680–760px
```

Never let guide body text stretch across 1200px.

---

# 67. Performance rules

The Resources page could become asset-heavy, so enforce:

```text
Hero animation:
HTML/SVG preferred

Featured video:
poster only until interaction

Below-fold thumbnails:
lazy-loaded

Images:
AVIF/WebP

No autoplay videos

No enormous JavaScript search package
for 30 resources
```

Search can eventually use a proper indexed backend, but don't architect Algolia-sized infrastructure before you have content worth searching.

---

# 68. Accessibility

All resource cards:

```text
keyboard accessible
visible focus state
semantic link
```

Videos:

```text
captions
transcript
poster alt text
keyboard controls
```

Diagrams:

```text
text alternative
```

Motion:

```text
prefers-reduced-motion
```

Filters:

```text
actual labelled controls
```

Do not communicate:

```text
Beginner = green
Advanced = red
```

through color alone.

---

# 69. Videos should include transcripts

Every video page should contain a proper transcript.

This helps:

```text
Accessibility
SEO
Search indexing
AI/search retrieval
Users who prefer reading
```

It also means a four-minute explainer becomes an indexable resource rather than an opaque iframe.

---

# 70. Resource authorship

For editorial guides, show:

```text
Written by
Name

Role
Engineering / Product / QA

Updated
16 Oct 2026
```

Technical content changes.

Showing update dates builds trust.

Do not leave:

> “Last updated 2024”

on important setup guides in 2027.

---

# 71. Resource freshness

Create status internally:

```ts
contentFreshness:
  | "CURRENT"
  | "REVIEW_DUE"
  | "OUTDATED";
```

Set review windows.

For example:

```text
Concept article
12 months

SDK tutorial
3–6 months

Pricing guide
review on pricing changes

Product walkthrough
review on UI changes
```

An outdated technical guide can be worse than no guide.

---

# 72. Analytics

Track:

```text
RESOURCE_HUB_VIEWED

RESOURCE_SEARCH_USED
RESOURCE_SEARCH_RESULT_CLICKED

RESOURCE_ROLE_SELECTED
RESOURCE_TOPIC_SELECTED
RESOURCE_FORMAT_SELECTED

RESOURCE_CARD_CLICKED

RESOURCE_VIDEO_STARTED
RESOURCE_VIDEO_COMPLETED

RESOURCE_GUIDE_OPENED

RESOURCE_DOCS_CLICKED

RESOURCE_CHANGELOG_CLICKED
RESOURCE_ROADMAP_CLICKED

RESOURCE_CTA_STARTED_TRIAL
```

Useful metadata:

```text
resource_id
resource_type
topic
role
position
search_query
```

---

# 73. Conversion attribution

Also carry resource attribution into signup.

Example:

```text
source = resource
resource = workflow-coverage-vs-code-coverage
topic = coverage
role = qa
```

Then months later you can answer:

> “Which educational content actually creates accounts?”

rather than judging content by page views alone.

---

# 74. Component architecture

I would structure the page roughly as:

```text
ResourcesPage
│
├── MarketingNavbar
│
├── ResourceHero
│   ├── ResourceSearch
│   └── ResourceGraphVisual
│
├── StartHereSection
│   ├── ProductJourney
│   └── StarterResources
│
├── AudienceExplorer
│   └── AudienceCard[]
│
├── ProblemExplorer
│   └── ProblemCard[]
│
├── FeaturedResource
│
├── ConceptLibrary
│   └── ConceptCard[]
│
├── GuideGrid
│   └── ResourceCard[]
│
├── VideoResources
│   ├── FeaturedVideo
│   └── VideoCard[]
│
├── DeveloperResources
│
├── QualityResources
│
├── TrustResources
│
├── LatestResources
│
├── ProductEvolutionLinks
│   ├── ChangelogCard
│   └── RoadmapCard
│
├── GlossaryPreview
│
├── ResourcesCTA
│
└── MarketingFooter
```

---

# 75. Page data should not live inside JSX

Use a common content source:

```text
CMS / content repository
        ↓
Resource index
        ↓
/resources
/blog
related resources
product pages
search
sitemap
```

That becomes important once you have 100+ resources.

---

# 76. Relationship to product pages

The distinction should be:

```text
PRODUCT PAGE

What does Tellann do?
Why should I use this capability?
```

versus:

```text
RESOURCE

Teach me the problem.
Teach me the concept.
Show me how to solve it.
```

For example:

```text
/product/behavior-graphs
→ Sell / explain Behavior Graphs

/resources/guides/what-is-a-software-behavior-graph
→ Teach the concept
```

The educational page links to the product page.

The product page links back to supporting education.

---

# 77. Relationship to Docs

Similarly:

```text
RESOURCE
"How workflow coverage works"

↓

DOCS
"Coverage analysis API / UI / configuration"
```

Different intent.

Mixing them damages both.

---

# 78. Relationship to Blog

Blog should be editorial.

For example:

```text
Why traditional QA coverage creates blind spots

Designing software around observable workflows

Why quality intelligence needs evidence
```

Resources are evergreen.

Blog is chronological.

Some blog content may later be promoted into a permanent resource.

---

# 79. Relationship to YouTube

The `/resources/videos` pages should be the canonical learning destinations even if you host videos on YouTube.

Page:

```text
Video
Transcript
Chapter markers
Related concepts
Related product
Related docs
Next resource
```

Embedding YouTube is fine.

But don't send all educational traffic away from Tellann immediately.

---

# 80. Case studies

Do not build an impressive empty case-study section yet.

When customers exist, each case should answer:

```text
Customer
Context
Problem
Workflow examined
Evidence gathered
Gap discovered
Action taken
Outcome
```

Tellann is an evidence product.

Your own case studies should therefore be evidence-driven too.

---

# 81. Resource imagery philosophy

Across the whole section:

### Use images for:

```text
editorial storytelling
real product interfaces
workflow diagrams
case studies
video thumbnails
```

### Do not use images for:

```text
decoration for decoration's sake
generic offices
random code screenshots
AI people
futuristic glowing brains
robot heads
```

Tellann should visually communicate:

> **evidence → structure → understanding**

not:

> **AI magic.**

That is particularly important because the MVP explicitly says the current product should not be marketed as autonomous testing, self-healing software or an AI agent writing tests. mvp_scope

---

# 82. The most important visual motif

I would make this recurring motif central to `/resources`:

```text
WHAT SHOULD HAPPEN

A ─── B ─── C ─── D

         VS

WHAT WE OBSERVED

A ─── B ─── C
          \
           E
```

Then:

```text
What matched?
What didn't?
What appeared unexpectedly?
What was never reached?
```

That single mental model can explain:

- reconciliation;
- missing flows;
- missing states;
- coverage;
- behavior graphs;
- developer demonstrations;
- QA reports.

It is essentially Tellann's visual grammar.

---

# 83. Recommended first content set

I would **not** delay launching `/resources` until you have 100 pieces of content.

A credible first release could contain about:

```text
4 STARTER RESOURCES

Tellann in 5 minutes
How Tellann works
Your first guided run
Understanding a Tellann QA report


8 CORE CONCEPTS

Behavioral QA
Declared Intent
Observed Behavior
Behavior Graph
Workflow Coverage
Missing States
Missing Flows
Reconciliation


6 PRACTICAL GUIDES

Workflow coverage vs code coverage
Finding missing application states
Mapping application workflows
Testing failure paths
Using session replay for QA
QA strategy for startups


4 VIDEOS

Tellann overview
Desktop walkthrough
Behavior Graph walkthrough
QA report walkthrough


4 TECHNICAL ENTRY POINTS

React
Next.js
Node.js
Desktop
```

That's already a substantial resource ecosystem.

---

# 84. What should NOT be on `/resources`

I would explicitly exclude:

```text
Full API documentation

Detailed pricing tables

Huge FAQ list

Engineering architecture internals

Infrastructure diagrams

Internal product requirements

Fake case studies

Future Phase 2/3 capabilities
presented as current functionality

Hundreds of keyword-generated articles

Random corporate news
```

The hub should feel curated.

---

# 85. Recommended page length

Despite everything described above, don't render every possible resource category at full scale on day one.

For version 1, the actual visible page should probably be around:

```text
Hero

Start Here

Explore by Role

Explore by Problem

Featured Resource

Learn Tellann

Guides

Videos

Developer / QA Resources

Changelog + Roadmap

Glossary

CTA
```

Approximately:

```text
8,000–11,000px desktop page height
```

depending on spacing.

Not a 25,000px encyclopedia.

---

# 86. Initial implementation priority

### Launch now

```text
✓ Hero
✓ Search shell
✓ Popular topics
✓ Start Here journey
✓ Role-based resource discovery
✓ Problem-based discovery
✓ Featured resource
✓ Core concept library
✓ Guide cards
✓ Video section
✓ Developer resources
✓ QA resources
✓ Changelog / Roadmap cards
✓ Glossary preview
✓ Final CTA
✓ SEO metadata
✓ Structured data
✓ Analytics
```

### Add once content volume grows

```text
Resource search backend
Advanced filtering
Personalized recommendations
Case studies
Webinars
Resource collections
Saved resources
Courses / learning paths
Certificates
User-specific resource history
```

Do not build a mini-LMS prematurely.

---

# 87. Recommended desktop wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ NAV                                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ TELLANN RESOURCES                       RESOURCE GRAPH    │
│                                                          │
│ Understand software behavior.           ● Coverage       │
│ Build with more confidence.            ╱                │
│                                   ● Behavior ─ ● Replay  │
│ [ Search resources............. ]       ╲                │
│                                         ● Reports        │
│ Popular: Coverage · Replay · Graph                       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ NEW TO TELLANN?                                          │
│                                                          │
│ Declare → Demonstrate → Observe → Compare → Understand   │
│                                                          │
│ [ Overview ] [ Video ] [ First Run ]                    │
├──────────────────────────────────────────────────────────┤
│ RESOURCES FOR THE WAY YOU WORK                           │
│                                                          │
│ [Developer] [QA] [Engineering]                          │
│          [Product] [Founder]                             │
├──────────────────────────────────────────────────────────┤
│ WHAT ARE YOU TRYING TO UNDERSTAND?                       │
│                                                          │
│ [ Coverage? ] [ Missing states? ] [ Workflow failure? ] │
│ [ Intent?   ] [ API behavior?    ] [ Replay?           ]│
├──────────────────────────────────────────────────────────┤
│ FEATURED                                                 │
│                                                          │
│ [              visual             ][ guide copy        ] │
├──────────────────────────────────────────────────────────┤
│ LEARN TELLANN                                            │
│                                                          │
│ [Intent][Demo][Graph][Coverage]                          │
│ [Replay][Missing][Reconcile][Reports]                    │
├──────────────────────────────────────────────────────────┤
│ PRACTICAL GUIDES                                         │
│                                                          │
│ [ card ] [ card ] [ card ]                              │
├──────────────────────────────────────────────────────────┤
│ SEE TELLANN IN ACTION                                    │
│                                                          │
│ [         FEATURED VIDEO       ] [video]                 │
│                                  [video]                 │
├──────────────────────────────────────────────────────────┤
│ BUILD WITH TELLANN                                       │
│                                                          │
│ Docs · React · Next.js · Node · Desktop                 │
├──────────────────────────────────────────────────────────┤
│ PRODUCT EVOLUTION                                        │
│                                                          │
│ [ CHANGELOG ]                [ ROADMAP ]                 │
├──────────────────────────────────────────────────────────┤
│ GLOSSARY                                                 │
│                                                          │
│ Behavior Graph · Coverage · State · Workflow · ...      │
├──────────────────────────────────────────────────────────┤
│ Ready to look at your own application?                  │
│                                                          │
│ [ Start free ] [ Read docs ]                            │
├──────────────────────────────────────────────────────────┤
│ FOOTER                                                   │
└──────────────────────────────────────────────────────────┘
```

---

# 88. The core story

At its simplest, `/resources` should tell visitors:

```text
YOU DON'T NEED TO
UNDERSTAND TELLANN FIRST.

Tell us what you are
trying to understand.

        ↓

We'll explain the concept.

        ↓

We'll show you
how Tellann approaches it.

        ↓

We'll teach you
how to use it.

        ↓

When you're ready,
you can try it yourself.
```

That is the direction I would take.

`/resources` should therefore be **less like a content archive and more like a guided map of software quality**. A developer should see technical paths. A QA engineer should see coverage and gaps. A manager should see evidence and confidence. A product person should see intent versus observed behavior. A founder should see a practical route to quality visibility without a giant QA operation.

And crucially, all of them should be able to understand why Tellann matters **before they need to understand how Tellann is engineered**.