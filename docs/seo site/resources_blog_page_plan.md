# `/blog` — Complete SEO Marketing Page Specification

TELLANN MARKETING WEBSITE · RESOURCES

# Ideas, insights, and perspectives on building better software.

Route: `/blog` · Page type: Editorial publishing hub · Primary goals: Organic discovery, education, authority, and product conversion

## 1. Primary purpose

The Tellann Blog should become the company's editorial voice on software quality, behavioral testing, application reliability, and the evolving relationship between software intent and observable behavior.

Where `/resources` helps visitors find educational material, `/blog` should provide original perspectives, practical engineering insights, analysis, and stories worth reading.

The distinction is important:

| Page         | Primary question                                     |
| ------------ | ---------------------------------------------------- |
| `/resources` | What can I learn?                                    |
| `/blog`      | What should I understand or think differently about? |
| `/docs`      | How do I implement it?                               |
| `/product`   | How does Tellann help me?                            |
| `/changelog` | What has actually changed?                           |
| `/roadmap`   | Where is Tellann going?                              |

The blog should achieve five outcomes:

1. Attract qualified visitors searching for software-testing and quality-engineering topics.
2. Build credibility through genuinely useful technical and product insights.
3. Educate visitors about behavioral QA without requiring familiarity with Tellann.
4. Guide different user classes toward content that solves their specific problems.
5. Convert interested readers into product explorers, documentation readers, and eventually Tellann customers.

Crucial positioning rule: Tellann's current MVP story is behavioral QA through declared intent, developer demonstrations, observed behavior, reconciliation, coverage, and reports. Production monitoring and autonomous behavioral intelligence belong to later product phases. Blog content must distinguish existing capabilities from future direction.

## 2. Target audiences and their editorial interests

The blog should serve five main audiences.

| Audience             | What they care about                              | Blog emphasis                                    |
| -------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Software developers  | Debugging, workflows, integration, observability  | Technical explanations and engineering practices |
| QA engineers         | Coverage gaps, missing states, validation quality | Testing strategies and practical QA workflows    |
| Engineering managers | Release readiness, risk, productivity             | Evidence-driven decision-making                  |
| Product managers     | Intended behavior, requirements, user journeys    | Product quality and workflow design              |
| Startup founders     | Time, cost, reliability, shipping                 | Lean QA and quality visibility                   |

A developer may search for how to debug an incomplete checkout flow. A product manager may search for how to verify feature requirements. Both could benefit from understanding the difference between intended and observed behavior, but the framing must change.

Do not create five nearly identical SEO articles targeting each audience. Publish one strong article when the underlying search intent is identical, and link to distinct role-oriented guides when their goals differ.

## 3. Page structure

```
/blog
│
├── 01 Global Navigation
├── 02 Editorial Hero
├── 03 Featured Article
├── 04 Search and Category Navigation
├── 05 Latest Stories
├── 06 Explore by Audience
├── 07 Featured Editorial Series
├── 08 Engineering & QA Insights
├── 09 Product & Workflow Thinking
├── 10 Videos and Visual Stories
├── 11 From the Tellann Team
├── 12 Newsletter Subscription
├── 13 Browse the Archive
├── 14 Related Learning Resources
├── 15 Final Conversion CTA
└── 16 Global Footer
```

The page should be editorial, spacious, and highly readable. Avoid trying to show every post on the homepage.

Recommended design foundations:

| Property             | Specification                                           |
| -------------------- | ------------------------------------------------------- |
| Primary container    | 1200–1280px                                             |
| Editorial typography | Satoshi headings, readable body type                    |
| Theme                | Tellann monochrome                                      |
| Main page background | Near-black or white, following existing marketing theme |
| Grid                 | 12-column desktop                                       |
| Card spacing         | 20–28px                                                 |
| Section spacing      | 96–128px desktop, 64–80px mobile                        |
| Borders              | Subtle neutral 1px                                      |
| Animation            | Low-motion, content-first                               |

## 4. Editorial visual direction

The Blog should have a recognizable Tellann identity without making every article look like the same software dashboard.

[INIT · Data & Software Engineering](https://images.openai.com/static-rsc-4/mPn5bU3_HqxVhxa8aY0VwfsH8JfoJB53A7OhwJlFjHS36rp3pQJcO9ap7G9tHGp9lTsLKBkyOPL2mn_QeqPlBjsF1suSfaUh4X3062LiqAkfmTZeivzLKIlQHfM9ecdWuJKj3LtesTni4V0FDbSznKLVBPVq-heecQrf-qXo8IU?purpose=inline)

Behavioral systems

Network structures, connected states, workflow paths, and missing links.

[Jessica Svendsen’s striking designs for the spring issue of MIT Technology Review](https://images.openai.com/static-rsc-4/JMfGmlmKqp533E5KtYDJVn49Ycot6_jhuiy0DOw3CUpjp-iGXYVpRRGdUsyy4VX9Wgsh5Xa0ZLjA0elkmkHcMbH5DnWkaPY-K2ncgHnferI78gS18BJkmSbLAe22SyuTcKJ-d7Dh07VjzkSPC7NJJnfcNe30rOuS-SfYGcsfIBo?purpose=inline)

Editorial perspectives

Strong typography, negative space, clear concepts, and deliberate contrast.

[Lateral Entry — Malla Reddy (MR) Deemed to be University](https://images.openai.com/static-rsc-4/fLZf3K2VdsqjYWxuzR3qqExVdqb86Z6Ht1qXIAxAWkqDiQx9UGI1kM45yvuSIo-SrC2rwc0xuFAz1cpYGLNDbItFKjVcYmA3FBACGXvw6HMwJKLlHXhsVeB-sxRi6augVM5nTL33YseuRY4AFPs78DCjwoSwyMVR_Dl_J7AmwYk?purpose=inline)

Engineering stories

Realistic technology photography when the subject calls for it.

[Spacetime](https://images.openai.com/static-rsc-4/GgZYtevHPwWoRzYJj2iaMsSZQ3dRXVS91IEyC5aPNkZ_XcDqAARWBeVLv-zDYnBNuROaXIWjCLbVgxkvWAU_c6CUMH3sLQ3FPM8hu4ckHiSeHLvh4ahovyTw_Vf3SMTO3vELFArRK08XASggbOPVY93ibz6t7L5O3cd87w6AHuY?purpose=inline)

Technical explanations

Custom diagrams, real product captures, architecture illustrations, and annotated examples.

These are visual references for direction, not assets to publish unchanged.

I would establish four editorial image styles: abstract behavioral diagrams, typographic concept covers, authentic engineering photography, and annotated product or workflow illustrations. Every published image should communicate its article's subject rather than simply fill space.

## 5. Section 01 — Navigation

Reuse the existing global marketing navigation.

Within the Resources mega-menu, include:

```
RESOURCES

Resource Hub         /resources
Blog                 /blog
Guides               /resources/guides
Videos               /resources/videos
Glossary             /resources/glossary
Documentation        /docs
Changelog            /changelog
Roadmap              /roadmap
```

The Blog menu item should resolve directly to `/blog`, not to a category filter under `/resources`.

On article pages, show breadcrumbs:

`Resources / Blog / Article Title`

Breadcrumbs should be accessible navigation links, not merely decorative text.

## 6. Section 02 — Blog Hero

### Recommended hero copy

THE TELLANN BLOG

# Better software begins with better questions.

Explore engineering ideas, testing strategies, product perspectives, and lessons on understanding how software actually behaves.

Engineering

Software Quality

Product Thinking

This works because Tellann's editorial identity should be curious and evidence-driven, rather than full of unqualified promises about automation.

### Hero dimensions

Desktop:

- Container: 1200–1280px.
- Hero height: approximately 380–480px, depending on the featured article placement.
- Copy width: 650–780px.
- H1: 56–72px.
- Supporting text: 18–21px.

Mobile:

- Hero height: content-driven, roughly 300–380px.
- H1: 36–44px.
- Supporting text: 16–18px.
- Horizontal padding: 20–24px.

### Hero background

Use a subtle monochrome line/grid treatment or editorial typographic texture. No enormous autoplay video is needed. The blog's hero needs to load quickly and immediately expose useful content.

### Hero animations

- H1 and supporting copy fade upward once, around 350ms.
- Decorative grid fades in at lower opacity.
- Honor reduced-motion preferences.
- Avoid letter-by-letter heading animations, rotating headlines, particles, or animated background loops.

## 7. Section 03 — Featured Article

This is the primary editorial anchor of `/blog`.

### Heading

> Featured story

The featured article should address a substantial question and establish Tellann's distinctive perspective.

Example launch article:

> Your tests can pass while your workflows remain unproven.

Supporting copy:

> Code execution and business workflow validation answer different questions. Learn why understanding the paths your application has actually demonstrated matters.

Metadata:

`Software Quality · 9 min read · Engineering & QA`

CTA:

`Read the story →`

### Desktop layout

[Programmes IA — Comprendre, construire, intégrer | David Licoppe](https://images.openai.com/static-rsc-4/4RQ2ZUjCh_tNAlE-jCm_xYF22YEExuTV5Tu2vTBc6QlwSHCpRavcNnc4kY0jf6Dj-hIxbtZQI-cdlKvSmwCGxG2iZN5gUFBqa-gERLWt7y732-h409C3Cbx34EqxMZQqM37H-vaS8nSwEfagjvOLzlIi-aEdw3dHsDH9nwv34VM?purpose=inline)

[david-licoppe.com](https://david-licoppe.com/programmes.html?utm_source=chatgpt.com)

FEATURED · SOFTWARE QUALITY

# Your tests can pass while your workflows remain unproven.

Code coverage shows execution. Workflow evidence helps explain which application behaviors were observed—and which remain uncertain.

9 min read · Engineering & QA

Read article&#x20;

For the actual desktop implementation, use a horizontal composition with the image occupying approximately 55–58% of the card and text the remainder.

| Asset/property       | Specification                      |
| -------------------- | ---------------------------------- |
| Feature image source | 1600×900px                         |
| Image aspect ratio   | 16:9                               |
| Rendered image       | \~650×366px                        |
| Featured card        | 1200×410–460px                     |
| Text column          | \~450–500px                        |
| Image format         | AVIF/WebP                          |
| Hover                | Image scale 1.015, brighter border |

On mobile, stack the image above the text; use full content width and preserve the 16:9 media ratio.

The featured article should be configurable in the CMS. Do not permanently hardcode the first launch article.

## 8. Section 04 — Search and category navigation

Immediately after the feature, provide content discovery.

Search should cover:

- Article titles and summaries.
- Categories and tags.
- Author names where applicable.
- Relevant editorial body content through a proper search index.

Use a simple search input with a clear button. As content grows, add autocomplete and keyboard navigation.

### Suggested categories

Search articles, topics, and ideas…

AllEngineeringQA & TestingBehavioral IntelligenceProductStartupsInside Tellann

Selected category: All. In the website, choosing a category filters the article feed and updates a shareable URL.

For SEO, publish important categories as stable routes:

```
/blog/category/engineering
/blog/category/qa-testing
/blog/category/behavioral-intelligence
/blog/category/product
/blog/category/startups
/blog/category/inside-tellann
```

The filter should never lead to a blank page during launch. Publish category routes only when each has a worthwhile body of content.

## 9. Section 05 — Latest Stories

Heading:

> The latest thinking

Supporting:

> Fresh perspectives, practical engineering lessons, and ideas from the Tellann team.

Display the six latest published articles, excluding the currently featured one if necessary.

### Article grid

Desktop: 3 columns, two rows.

Tablet: 2 columns.

Mobile: 1 column.

Each article card should contain an image, category, title, short excerpt, date, reading time, and link.

[Enterprise AI Orchestration: Complete Architecture Guide | Elementum](https://images.openai.com/static-rsc-4/edD4WloU-9RffXgJ63BkuKck1jVPb8qXV_2zNK9ZMx0yvx_-6Jg20budvpesp4JsM4dA-_DnGbSnwYUvOjX7GIzuo7i03vV0QEyN6UyH9WX1rHJFeJqCbIgFtxNxzMwSaV3QPEDzkjpNYVYC4cgnaqEDE23SMT1A19VVPBkj2Hs?purpose=inline)

QA & TESTING

The hidden cost of untested failure paths

Why validating the happy path is rarely enough.

[Coverage Matrix | behavior.engineering](https://images.openai.com/static-rsc-4/vcAXgZDLpg3CrZ5XHRAnN-HTjJjZc3YVxR8RV2SzxCEegMSPgq69JSBT9Kme1fNaURSmS69yQGv5vrA1e30uMxpbDw0Qcy6m1kLbLmccjglLyrIN462myqSyeFtWO5uV67X52cjYEcgR9l4Dotb5c5w-h59fSb4fS4a7SUovquQ?purpose=inline)

ENGINEERING

Code coverage isn't workflow coverage

Understanding what different forms of coverage actually prove.

[UX in Software Development: A Practical Guide](https://images.openai.com/static-rsc-4/2MV17eusavY1U40-bbeitRPaZhSClSkyYPICdKHhPE_uA6IWIGKCnRpWNtkL0g2wF6tsupSTijN2JBH0QAELak0nAL4UpCjw0mf7WCu5HJkMoljCGYdmItEgfFDa8kl1O-iF-ZTTivCoIrqYIqZEMlNUDDt4ZPHzgMGyvtfoXyo?purpose=inline)

PRODUCT

What happens between requirements and reality?

Why intended product behavior deserves explicit validation.

[Why We Are Building "Codatum": A Data Analysis Tool from an Engineer's Perspective - Codatum](https://images.openai.com/static-rsc-4/YT5gpyS9OfrtzAngJ12I_Wt2p74gpXcARFS1IFpEdvYsox-ZZPM5c-OcqWfTHEkH_93PDeE3HLSh5mVAtR7kXM18oj9aYkhHJfpwFnV4ED5Tz9HrcnJN66NWfyZRHH6X5t6UuFRX2DFVczuHn_e1aeTD-CNWkFqcGmN-ChzV7lQ?purpose=inline)

STARTUPS

A practical QA strategy for small teams

Building useful quality checks with limited resources.

These are proposed editorial titles, not claims that the articles are already published.

### Card dimensions

| Element        | Desktop                        |
| -------------- | ------------------------------ |
| Card width     | 370–390px                      |
| Image master   | 1200×675px                     |
| Rendered image | \~380×214px                    |
| Content area   | 160–200px tall                 |
| Image/text gap | 20px                           |
| Card padding   | 0px, or 20px if fully bordered |
| Grid gap       | 24px                           |

Use actual image dimensions or reserved aspect-ratio containers to prevent layout shift.

### Card interactions

The image and title should open the article. Prefer one coherent card link, avoiding nested clickable elements.

Hover animation: a slight image scale, title emphasis, and arrow movement. Do not make cards tilt, bounce, or animate independently in a distracting manner.

## 10. Section 06 — Explore by audience

Heading:

> Different responsibilities. Shared questions about quality.

This section should expose distinct editorial entry points rather than duplicate the general role cards already present in `/resources`.

| Audience            | Editorial question                                        | Recommended stories                                                           |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Developers          | How do we make application behavior easier to understand? | Debugging incomplete workflows; state transitions; observability and QA       |
| QA engineers        | How do we find what our existing tests overlook?          | Failure-path coverage; missing states; practical testing techniques           |
| Engineering leaders | What evidence should influence release decisions?         | Risk-based QA; release readiness; evidence limitations                        |
| Product teams       | How do we know implementation reflects requirements?      | Declared intent; acceptance criteria; product workflow design                 |
| Founders            | How much testing is enough before shipping?               | Small-team QA strategy; prioritizing critical journeys; operational tradeoffs |

### Layout

Use five compact editorial cards, each with a role title, one representative question, 2–3 article links, and a category link.

Desktop: three cards in the first row and two in the second, or a horizontal editorial strip.

Mobile: one row per audience, with expandable related links.

Media: No photographic assets needed. Role-specific typography and a simple icon are enough. Approximate card dimensions: 380×260px on desktop and full-width with a minimum height of 210px on mobile.

This section should help readers self-select without turning the blog into another product-feature catalogue.

## 11. Section 07 — Featured Editorial Series

This is one of the strongest opportunities for building Tellann's search identity.

Heading:

> Explore the ideas shaping better software quality.

Organize related articles into curated editorial series. Initially, I recommend three.

[Abstract connect lines and dots circuit](https://images.openai.com/static-rsc-4/Zx96PilAZ8L8dpAVqxkneGS3N-lQR4M7BuvTrST1iIFe0aVNmKsVefyXFTKg-MQcBDAvm5WMdZeSQKLIASfRA6NxskidlYkcEbktoEDitCOmfWmEy1kYGYzmbRV0I8g2--vouCQj3vhCmaVxjNSIExjSWX3AuwjmKwYlk_cQxwOepwyq0HateHwhYqyjfWEK?purpose=inline)

SERIES 01

Understanding Software Behavior

How states, transitions, workflows and observable evidence reveal what an application has actually done.

Recommended: 4–6 articles

[Deterministic vs. Probabilistic AI: Enterprise Workflow Guide | Elementum](https://images.openai.com/static-rsc-4/Ro4F6Ns_niw-zcrUwXdbx8weGfQ7vB_aNYOZgGgZ2AAaM0OTMsXGKB1s55yQZyHSHz5UoZjmH0wIMt7Ah8130F0C7Zw9Sca1a45snypnR_NNzkfBf03SpyjBX_l78CDHyhIMMdxsENoVIiCgEfmJ6fEM7CKqAoy6lowatAisJ6w?purpose=inline)

SERIES 02

The Gaps We Don't Test

Exploring missing states, alternative paths, failure handling, and the limitations of common coverage metrics.

Recommended: 4–6 articles

[Graph Engineering: Govern AI Agent Connections | TrueFoundry](https://images.openai.com/static-rsc-4/AFZM6OdP0BhiWiszm420jm8Nftmv0UMM-odMNDTYhduI2th8X5nw8dp7aTqPBhAUOOHDcHgSqIJLgtJOjr96tGysBaEHUmBl6Wh3VAmijKr4waq3Zu6gVO1_7SrUHhz_BXmwS-PBZXjK31wgo-9E0SwgQgOqhrkOBy0XKIwaTq4?purpose=inline)

SERIES 03

Intent vs Reality

What requirements, demonstrations, testing evidence, and product behavior can tell teams about implementation quality.

Recommended: 4–6 articles

### Series route strategy

```
/blog/series/understanding-software-behavior
/blog/series/the-gaps-we-dont-test
/blog/series/intent-vs-reality
```

Each series page should include an editorial introduction, numbered article sequence, a progress-independent reading order, related definitions, and relevant Tellann product links.

### Series imagery

- Source: 1200×1500px (4:5).
- Desktop display: 160–240px wide on index cards, depending on layout.
- Series landing page banner: 1600×900px.
- Mobile cards: 96–144px image width alongside text, or stacked at narrow widths.
- Motion: connector lines gradually reveal within an SVG as the series card becomes visible, only once.

These series should be published incrementally. Do not show a public series page with six supposed articles when only one exists.

## 12. Section 08 — Engineering & QA Insights

Heading:

> For the people who build and validate.

This should be a focused editorial section for Tellann's strongest initial acquisition audience: developers and QA engineers.

Recommended article themes:

- Why passing tests don't necessarily prove complete workflows.
- What missing states reveal about application design.
- How to think about edge-case testing.
- When session replay is useful—and when it is insufficient.
- How frontend and backend behavior become one workflow.
- How to investigate slow endpoints in user-flow context.

### Layout

A two-column composition:

```
┌────────────────────────────┬─────────────────────┐
│                            │ Article 01          │
│   LARGE FEATURE STORY      ├─────────────────────┤
│                            │ Article 02          │
│   760 × 430 visual         ├─────────────────────┤
│                            │ Article 03          │
└────────────────────────────┴─────────────────────┘
```

Actual container width: 1200–1280px.

Featured visual: source 1600×900px, rendered approximately 700×394px.

The smaller story links can be text-first. There is no reason to load three extra images if their headlines already communicate enough.

### Featured technical illustration

Use a realistic software-quality scenario, such as a checkout workflow with observed success and unobserved failure branches. Any example metrics must be explicitly identified as illustrative unless drawn from a real test run.

## 13. Section 09 — Product & Workflow Thinking

Heading:

> Software quality is a product question, too.

Supporting copy:

> Good software is not just code that runs. It is an experience that behaves consistently with what its users and creators expect.

This section addresses product managers, technical founders, and engineering leaders.

Suggested articles:

1. Why product requirements should describe observable behavior.
2. Turning acceptance criteria into meaningful workflows.
3. Understanding the difference between a missing feature and an untested path.
4. What a QA report should tell a product manager.
5. How software teams lose context between design, implementation and testing.

### Visual

Use a simple, interactive-but-accessible comparison illustration:

INTENDED

Add to cart

Checkout

Payment outcome

OBSERVED

Add to cart

Checkout

Not observed

Illustrative example: missing observation means a path has not been demonstrated by the available evidence. It does not automatically prove that the underlying feature is absent or broken.

This distinction is vital. Tellann should not imply that unobserved behavior is necessarily defective.

### Production layout

Illustration source: preferably SVG.

Desktop rendered size: 540×360px beside explanatory editorial text.

Mobile: stack the two graphs vertically or provide a clear horizontally scrollable comparison with text alternatives.

Animation: highlight a corresponding state on both sides when a user selects a step. Keep functionality available without animation.

## 14. Section 10 — Videos and Visual Stories

Although `/resources/videos` is the main video library, the blog should contain a smaller editorial video collection.

Heading:

> Some ideas are easier to see.

Unlike product tutorials, blog videos should tell a story or explain a concept.

### Recommended video types

| Video                                   | Format                      | Duration | Audience              |
| --------------------------------------- | --------------------------- | -------- | --------------------- |
| Why code coverage can miss behavior     | Motion graphics             | 3–5 min  | Developers, QA        |
| The hidden paths of a checkout flow     | Animated scenario           | 2–4 min  | QA, Product           |
| What does a behavior graph represent?   | Diagram animation           | 3–5 min  | All technical readers |
| How Tellann approaches software quality | Narrated product philosophy | 3–4 min  | Founders, managers    |
| Engineering discussions                 | Recorded talk/interview     | 8–15 min | Developers, QA        |

These are editorial assets, not demonstrations of features that do not exist yet.

### Featured video layout

Desktop:

```
┌───────────────────────────────┬─────────────────────┐
│                               │ VISUAL STORY        │
│                               │                     │
│        16:9 VIDEO             │ Why coverage is     │
│        720 × 405              │ more than execution │
│                               │                     │
│                               │ Watch →             │
└───────────────────────────────┴─────────────────────┘
```

### Production specifications

| Property           | Requirement                              |
| ------------------ | ---------------------------------------- |
| Master video       | 1920×1080                                |
| Aspect ratio       | 16:9                                     |
| Frame rate         | 30fps                                    |
| Thumbnail master   | 1280×720                                 |
| Featured player    | 640–720px wide                           |
| Smaller video card | \~360×203px                              |
| Audio              | Clear narration, balanced levels         |
| Accessibility      | Captions, transcripts, keyboard controls |
| Delivery           | Lazy-loaded player, compressed streaming |

No video should autoplay with sound. Load its poster first and mount the real player on user interaction.

### Motion graphics style

Use Tellann's black, white and greyscale palette. Draw states and transitions progressively; show diverging user paths; reveal questions and answers through restrained typography.

Avoid using animated programming code as filler. Viewers should understand the concept even if they cannot read code.

## 15. Section 11 — From the Tellann Team

Heading:

> Building Tellann, in the open.

This section should introduce authentic engineering and product thinking from the team.

Editorial content could include:

- Why Tellann focuses on behavioral evidence.
- Design decisions behind its desktop-first demonstration workflow.
- Lessons from building reliable workflow models.
- How Tellann thinks about privacy and local source-code handling.
- Product tradeoffs and what the team learned while validating the MVP.

These articles should be candid, technically accurate, and clearly separated from announcements or release notes.

### Visuals

Use actual product diagrams, engineering sketches, desktop screenshots, real team photography (where available), and real development artifacts that do not reveal secrets or private customer information.

Recommended format:

- One prominent article with a 1200×675 source image.
- Two smaller text-first articles.
- A link to `/company` for visitors interested in the people and mission.

Do not invent founding stories, customer names, adoption figures, or achievements.

## 16. Section 12 — Newsletter

Heading:

> Good ideas, delivered occasionally.

Supporting copy:

> Get thoughtful articles on software quality, behavioral testing, engineering practice, and meaningful updates from Tellann.

Proposed form:

- Email address.
- Subscribe.
- Optional privacy note.

Keep the newsletter opt-in independent from marketing account registration and paid product trials.

### Layout

Desktop: centered block, max-width 760px, approximately 260–340px high.

Mobile: single-column email field and full-width button.

Background: slightly contrasting monochrome surface or subtle border, not an aggressive colored callout.

### Interaction

Use explicit opt-in, a real subscription endpoint, email validation, anti-abuse protection, double opt-in where appropriate, unsubscribe support, and meaningful success/error states.

Do not promise a weekly newsletter unless the content-production schedule can sustain it.

## 17. Section 13 — Browse the Archive

At the lower part of `/blog`, provide a compact archive entry point:

`View all articles →`

The canonical archive can remain `/blog`, using real pagination:

```
/blog?page=2
/blog?page=3
```

I recommend real URL-based pagination rather than infinite scrolling as the only way to discover historical articles.

The archive should sort newest first by default and support the category filter without creating thousands of crawlable query combinations.

Do not add monthly archives, years, tags, authors, and six other navigation systems before article volume justifies them.

## 18. Section 14 — Related Learning Resources

This section should connect the editorial blog back to the wider Tellann educational ecosystem.

Use three compact navigation cards.

| Resource                | Description                                      | Route               |
| ----------------------- | ------------------------------------------------ | ------------------- |
| Practical Guides        | Learn techniques you can apply to your software. | `/resources/guides` |
| Technical Documentation | Install, configure, and integrate Tellann.       | `/docs`             |
| Product Updates         | See what the platform has actually shipped.      | `/changelog`        |

No large images required. Simple line illustrations or icons are sufficient.

## 19. Section 15 — Final CTA

### Eyebrow

`FROM IDEAS TO EVIDENCE`

### H2

> See what your application actually demonstrated.

Supporting text:

> Go from intended workflows to observed behavior, coverage, reconciliation, and QA reports with Tellann.

Primary CTA: `Start free`

Secondary CTA: `Explore the product`

This is preferable to promising that Tellann will automatically eliminate bugs or guarantee a release.

Desktop CTA: max-width 1100–1200px, about 330–400px high.

Mobile: full-width, content-driven height, vertically stacked actions.

Use one subtle behavior-graph illustration as a background layer or side element. Avoid a huge video at the bottom of the page.

## 20. Individual blog article architecture

The blog homepage is only one part of the implementation. Each article should have its own indexable page:

```
/blog/[slug]
```

For example:

```
/blog/workflow-coverage-vs-code-coverage
/blog/why-failure-paths-matter
/blog/understanding-software-behavior
```

The standard article page should include:

```
GLOBAL NAVIGATION

BREADCRUMBS

CATEGORY / AUDIENCE

ARTICLE H1

EXCERPT

AUTHOR · DATE · READING TIME

FEATURED IMAGE

ARTICLE BODY
├── Table of contents
├── Section headings
├── Text
├── Illustrations
├── Code snippets (where relevant)
├── Videos (where helpful)
├── Comparisons
└── Sources and references

RELATED TELLANN CAPABILITY

AUTHOR INFORMATION

RELATED ARTICLES

NEWSLETTER / CTA

FOOTER
```

### Article dimensions

| Element                   | Specification                   |
| ------------------------- | ------------------------------- |
| Overall content container | 1200–1280px                     |
| Article prose width       | 680–760px                       |
| Article H1                | 48–64px desktop; 34–42px mobile |
| Body font                 | 17–19px                         |
| Body line height          | 1.65–1.8                        |
| Featured image            | 1600×900px source               |
| Wide diagram              | Up to 960px rendered            |
| Inline image              | Article width, max 760px        |
| Table of contents         | 240–260px sidebar               |
| Reading progress          | 2–3px top indicator             |
| Article sidebar           | Sticky on desktop only          |

On desktop, use the prose column and optional right-side table of contents. On mobile, move the table of contents into an expandable section above the article.

Avoid two permanent sidebars. Reading should remain the dominant experience.

## 21. Article media guidelines

Not every blog post requires a video, but every substantial article should have appropriate visual evidence.

| Article type                  | Recommended media                                       |
| ----------------------------- | ------------------------------------------------------- |
| Opinion or thought leadership | Editorial cover and optional concept diagram            |
| Technical explanation         | Diagrams, code samples, example outputs                 |
| Practical QA walkthrough      | Real application screenshots, annotated workflows       |
| Product development story     | Authentic Tellann screenshots and engineering artifacts |
| Product announcement          | Real product screenshots and optional demo video        |
| Industry analysis             | Properly sourced tables and charts                      |

For long articles, use a meaningful visual approximately every 500–800 words when it genuinely improves comprehension. Do not insert decorative images merely to satisfy a fixed interval.

### Screenshot preparation

Capture original images at least twice their expected CSS display dimensions where practical. Crop out private data, redact secrets, and identify mock interfaces clearly.

### Diagrams

Prefer SVG or responsive HTML for simple flows. Use static WebP/AVIF for complex visuals that do not need interaction.

### Videos

Embed a short video only when motion demonstrates something the written article cannot explain as clearly. Include descriptive chapter markers, captions, and transcript text.

## 22. SEO architecture

The blog's SEO strategy should be based on topical authority, search intent, and original usefulness—not simply increasing publishing volume.

### Blog homepage metadata

Title:

`Tellann Blog | Software Quality, Testing & Engineering Insights`

Meta description:

`Explore practical perspectives on software testing, behavioral QA, workflow coverage, application reliability, product engineering, and building better software.`

Canonical:

`https://tellann.co/blog`

### Article metadata

Each article needs:

- Unique H1 and SEO title.
- Clear meta description.
- Canonical URL.
- Open Graph and X sharing metadata.
- Actual publication and modification dates.
- Author identity.
- Main image and appropriate alt text.
- Breadcrumbs.
- Relevant related-article links.
- JSON-LD `BlogPosting` or `Article` structured data.

Do not add artificial dates, authors, reviews, or FAQ structured data unsupported by actual content.

### Technical requirements

Use server-rendered or statically generated HTML for article content, ensure the article body is accessible without client-side JavaScript, and include published posts in the XML sitemap.

Category archives should be indexable only when they have distinctive value and sufficient content. Thin tag archives and search-result pages should generally be kept out of the search index.

## 23. Content management architecture

A blog should not require modifying React components every time Tellann publishes an article.

Recommended architecture:

```
Editorial CMS / MDX Repository
           │
           ▼
Content Validation
           │
           ▼
Article Index
           │
           ├── /blog
           ├── /blog/[slug]
           ├── /blog/category/[slug]
           ├── /blog/series/[slug]
           ├── /resources
           └── Sitemap / Search
```

For an early-stage engineering-led product, MDX with a Git-based publishing workflow is perfectly reasonable. If non-developers will publish frequently, a headless CMS is worth considering.

### Article data model

```
type BlogCategory =
  | "ENGINEERING"
  | "QA_TESTING"
  | "BEHAVIORAL_INTELLIGENCE"
  | "PRODUCT"
  | "STARTUPS"
  | "INSIDE_TELLANN";

interface BlogPost {
  id: string;
  slug: string;

  title: string;
  excerpt: string;
  body: string;

  category: BlogCategory;
  tags: string[];

  audiences: string[];

  authorId: string;

  featuredImage: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };

  publishedAt?: string;
  updatedAt?: string;

  status: "DRAFT" | "REVIEW" | "SCHEDULED" | "PUBLISHED";

  featured: boolean;
  seriesId?: string;

  relatedProductPaths?: string[];
  relatedResourceIds?: string[];

  seo: {
    title: string;
    description: string;
    canonical?: string;
    noindex?: boolean;
  };
}
```

Reading time should be computed from the published body rather than manually estimated wherever possible.

Build a simple publishing workflow: draft, technical review, editorial review, scheduled publishing, publication, and periodic factual review.

## 24. SEO content and publishing priorities

I recommend concentrating initial editorial effort on content that connects an existing software-quality problem to Tellann's actual product differentiation.

### Suggested first 12 articles

| Priority | Proposed title                                             | Primary audience |
| -------- | ---------------------------------------------------------- | ---------------- |
| 1        | Your Tests Pass. But What Have You Actually Proven?        | QA, Developers   |
| 2        | Code Coverage vs Workflow Coverage: What's the Difference? | QA, Developers   |
| 3        | Why the Happy Path Is Not Enough                           | QA               |
| 4        | What Is Behavioral QA, and Why Does It Matter?             | All              |
| 5        | The Hidden Cost of Missing Application States              | Developers, QA   |
| 6        | From Product Requirements to Observable Behavior           | Product Managers |
| 7        | How to Think About Checkout Failure Paths                  | Developers, QA   |
| 8        | Why Software Quality Needs Evidence, Not Assumptions       | Managers         |
| 9        | Testing Strategies for Small Startup Teams                 | Founders         |
| 10       | What a Behavior Graph Can Tell You About an Application    | Developers       |
| 11       | When Session Replay Helps—and When It Doesn't              | Developers, QA   |
| 12       | Why We Are Building Tellann Around Declared Intent         | All              |

These titles are an editorial plan, not evidence of current search volumes. Before publishing, validate the search intent and difficulty of the priority topics.

### Publishing cadence

Begin with two thoughtful articles per month if that is the volume you can sustain.

One genuinely useful technical article—with original diagrams, examples, and clear evidence—is more valuable than ten generic AI-generated posts.

## 25. Animation and interaction specification

The blog should feel responsive and refined, but reading speed matters more than visual spectacle.

| Interaction         | Animation                           | Duration  |
| ------------------- | ----------------------------------- | --------- |
| Hero entrance       | Opacity and 12px upward translation | 300–400ms |
| Featured card hover | Image scale 1.015                   | 200ms     |
| Card hover          | Border emphasis, arrow translation  | 180–220ms |
| Category change     | Minimal content transition          | 150–250ms |
| Article load        | No mandatory entrance sequence      | —         |
| Reading progress    | Continuous position-based update    | Immediate |
| Table of contents   | Active section indication           | Immediate |
| Inline diagram      | Optional step reveal                | 250–500ms |
| Video thumbnail     | Play icon emphasis                  | 150ms     |

Do not animate every paragraph as it enters the viewport. It makes long technical articles frustrating to read.

All animation must respect reduced-motion preferences.

## 26. Performance, accessibility, and analytics

### Performance

Target good Core Web Vitals, with particular attention to image LCP and layout stability.

Use responsive image sizes, lazy-load below-the-fold media, preload the actual LCP image, avoid huge animation libraries for trivial effects, and never eagerly load several video players.

### Accessibility

Use correct heading hierarchy, visible keyboard focus, accessible pagination and filters, sufficient text contrast, meaningful image alternatives, captions and transcripts for videos, and responsive tables that remain usable on small screens.

### Analytics

Track the following events in marketing analytics, keeping them separate from Tellann's customer-application behavioral evidence model.

```
BLOG_PAGE_VIEWED
BLOG_ARTICLE_OPENED
BLOG_SEARCH_SUBMITTED
BLOG_CATEGORY_SELECTED
BLOG_SERIES_OPENED
BLOG_RELATED_ARTICLE_CLICKED

BLOG_VIDEO_STARTED
BLOG_VIDEO_COMPLETED

BLOG_NEWSLETTER_SUBMITTED
BLOG_NEWSLETTER_CONFIRMED

BLOG_PRODUCT_CLICKED
BLOG_DOCS_CLICKED
BLOG_SIGNUP_CLICKED
```

Measure meaningful outcomes:

- Organic search visits to articles.
- Search clicks and impressions by topic.
- Article-to-product navigation.
- Article-to-documentation navigation.
- Qualified signups attributed to editorial content.
- Newsletter subscriptions.
- Returning readers.

A high page-view count with no relevant downstream engagement is not automatically a successful blog.

## 27. Recommended implementation sequence

### Phase A — Launch essentials

Build first

- Blog hero, featured story and article grid.
- Basic category navigation and search.
- Individual article template.
- SEO metadata and structured data.
- Responsive imagery and article typography.
- Publishing workflow.
- Related articles and product links.
- At least 6–8 published articles before prominent promotion of the blog.
  ### Phase B — Editorial growth
- Role-oriented discovery.
- Editorial series.
- Video stories and transcripts.
- Newsletter integration.
- Improved search.
- Author and topic archives where useful.
  ### Phase C — Content maturity
- Customer case studies supported by genuine evidence.
- Original research and benchmark publications.
- Multi-author publishing.
- Content refresh automation.
- Advanced recommendations and attribution.

## 28. Recommended final desktop layout

```
┌─────────────────────────────────────────────────────┐
│ GLOBAL NAVIGATION                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ THE TELLANN BLOG                                    │
│ Better software begins with better questions.      │
│                                                     │
├─────────────────────────────────────────────────────┤
│ FEATURED STORY                                      │
│                                                     │
│ [     FEATURE IMAGE     ] [ ARTICLE SUMMARY       ]│
│ [       650×366         ] [ READ ARTICLE →        ]│
│                                                     │
├─────────────────────────────────────────────────────┤
│ [ Search articles...                              ] │
│ All  Engineering  QA  Product  Startups  Tellann   │
├─────────────────────────────────────────────────────┤
│ LATEST THINKING                                     │
│                                                     │
│ [ Article ] [ Article ] [ Article ]                │
│ [ Article ] [ Article ] [ Article ]                │
├─────────────────────────────────────────────────────┤
│ EXPLORE BY AUDIENCE                                 │
│ Developer · QA · Manager · Product · Founder        │
├─────────────────────────────────────────────────────┤
│ EDITORIAL SERIES                                    │
│                                                     │
│ [ Behavior ] [ Testing Gaps ] [ Intent vs Reality ] │
├─────────────────────────────────────────────────────┤
│ ENGINEERING & QA                                    │
│                                                     │
│ [ Featured insight ] [ Short story list          ]│
├─────────────────────────────────────────────────────┤
│ PRODUCT & WORKFLOW THINKING                         │
│                                                     │
│ [ Intent vs Observed illustration ] [ Articles ]    │
├─────────────────────────────────────────────────────┤
│ VIDEOS & VISUAL STORIES                             │
│                                                     │
│ [      Featured video     ] [ video ]              │
├─────────────────────────────────────────────────────┤
│ FROM THE TELLANN TEAM                               │
│                                                     │
│ [ Engineering story ] [ Team articles ]            │
├─────────────────────────────────────────────────────┤
│ GOOD IDEAS, DELIVERED OCCASIONALLY                  │
│ [ Email address                       ] [Subscribe]│
├─────────────────────────────────────────────────────┤
│ BROWSE ARCHIVE                                      │
│ View all articles →                                 │
├─────────────────────────────────────────────────────┤
│ GUIDES               DOCS              CHANGELOG    │
├─────────────────────────────────────────────────────┤
│ SEE WHAT YOUR APPLICATION ACTUALLY DEMONSTRATED     │
│                                                     │
│ [ Start free ] [ Explore product ]                  │
├─────────────────────────────────────────────────────┤
│ FOOTER                                              │
└─────────────────────────────────────────────────────┘
```

## 29. The governing editorial principle

The blog should not become a place where Tellann repeatedly announces that Tellann is innovative.

It should become a place where a developer leaves understanding an engineering problem more clearly, a QA engineer discovers a better way to reason about test coverage, a product manager learns how to challenge assumptions about workflows, and an engineering leader finds a more defensible way to discuss release readiness.

The strongest positioning is education first, evidence second, and product conversion third.

If Tellann consistently publishes technically credible insights about the difference between what software is supposed to do and what has actually been observed, the blog can help establish the company as an authoritative voice in behavioral quality intelligence—without relying on exaggerated claims about capabilities that have not yet shipped.