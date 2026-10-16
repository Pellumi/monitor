# Tellann Changelog Page — Complete SEO Marketing Specification

TELLANN · RESOURCES · PRODUCT UPDATES

# Every improvement. Clearly explained.

Route: `/changelog` · Page type: Public product update and release history · Primary objectives: Product transparency, feature discovery, customer confidence, and retention.

## 1. Purpose of the Changelog page

The `/changelog` page should be Tellann's official public record of what has actually changed in the product.

It should answer four important questions:

1. What's new? Features, improvements, integrations, and platform changes that have been released.
2. Why does it matter? The practical benefit to developers, QA engineers, managers, and other customers.
3. Who is affected? Which users, subscription plans, platforms, or environments can access the change.
4. What should I do next? Whether users can explore the feature, update their desktop application, change a configuration, or read documentation.

The Changelog should not read like Git commit history.

For example:

AVOID

`feat(reconciler): add transition diff handling`

Meaningful to the implementation team, but unhelpful to most customers.

PREFERRED PUBLIC WRITING

Review missing transitions between declared and observed workflows

A new reconciliation view helps you identify which expected transitions were not demonstrated in a recorded run, so you can decide what needs additional validation.

Illustrative release-note copy—not a statement that this feature has shipped.

The Changelog should make Tellann feel active, dependable, technically thoughtful, and transparent—without exaggerating how much functionality has shipped.

## 2. Distinguishing the Changelog from related pages

| Route           | Primary purpose                                   |
| --------------- | ------------------------------------------------- |
| `/changelog`    | What Tellann has actually released or changed     |
| `/roadmap`      | What Tellann is planning or exploring             |
| `/blog`         | Engineering perspectives, ideas, and explanations |
| `/research`     | Research questions, methods, and findings         |
| `/resources`    | Central educational resource hub                  |
| `/docs`         | How to use and configure the platform             |
| `/case-studies` | Evidence of Tellann's application in practice     |

An important rule: a roadmap item becomes a changelog item only when the change is genuinely available to its stated audience.

A feature specified in the PRD or MVP documentation is not automatically a shipped feature. The Changelog must reflect verified release records from Tellann's actual deployment process.

## 3. Target audience and messaging strategy

The page should use plain-language summaries first, with technical details available when a reader needs them.

| Audience                  | What they want to know                               | What updates should emphasize                                              |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Developers                | What changed in the SDK, desktop agent, or workflow? | Integrations, instrumentation, bug fixes, compatibility, migration actions |
| QA engineers              | What makes validation more useful?                   | Coverage, demonstrations, reconciliation, reporting, evidence              |
| Engineering managers      | Will this affect workflows or deployments?           | Reliability, control, availability, impact, release implications           |
| Product managers          | What new product capabilities are available?         | Changes to workflows, collaboration, visibility, and usability             |
| Startup founders          | Will it save work or make the product easier to use? | Clear benefits, accessibility, time to value                               |
| Enterprise/security teams | Are there security or compatibility implications?    | Security changes, permissions, deployment requirements, supported versions |

A single release may matter to several audiences. Avoid publishing five duplicate changelog entries; instead, offer role-specific summaries within the same canonical release record.

## 4. Complete `/changelog` page structure

```
/changelog
│
├── 01. Global Navigation
├── 02. Changelog Hero
├── 03. Latest Release Highlight
├── 04. Release Navigation and Filters
├── 05. Release Timeline
│   ├── Feature Releases
│   ├── Improvements
│   ├── Fixes
│   ├── Security Updates
│   ├── SDK / API Updates
│   └── Desktop Updates
├── 06. Featured Visual Demonstration
├── 07. Updates by User Role
├── 08. Platform and Compatibility Updates
├── 09. Product Evolution / Milestones
├── 10. Release Subscription
├── 11. Historical Archive
├── 12. Related Resources
├── 13. Final CTA
└── 14. Global Footer
```

This is the complete architecture, not a recommendation to display every section immediately. Modules without meaningful published content should be omitted until needed.

## 5. Design system and visual identity

Keep the existing Tellann monochrome identity: high-contrast typography, subtle borders, restrained greyscale surfaces, and Satoshi.

Unlike `/blog`, the Changelog should feel more structured and chronological. Unlike `/roadmap`, it should not resemble a speculative feature planning board.

The defining visual language should be:

- A clean vertical release timeline.
- Dated release cards.
- Lightweight feature and platform labels.
- Authentic screenshots of changed interfaces.
- Short comparison videos when a change is difficult to explain through text.
- Clear compatibility and action notices.

[Shadcn Pro Blocks - ReUI](https://images.openai.com/static-rsc-4/04UtIifOF7Qs3pUSdPbbRJdLDAJ4lBXUkAJ-7fy-yY93KEXBXhcT3mkJOM1qruJVBfBIJngBmhChnklPY_lFxg2vFFQ8CoEk0Wz5oTUDOe0T4c3oK0ArGjM71RNuibZk7xt4nL6OAl8RvbVwc367iz9TneSXvpznrO8SoajW_uM?purpose=inline)

Chronological structure

Readable update history, generous spacing, and clear dates.

[Agent assisted project updates – Changelog](https://images.openai.com/static-rsc-4/aTfYaGKDEwCW7nQzG4JCZEZSN2jRLzde2RsvzqMi5eim76n6s4AYl0iFG4RCtjtw7qj9Rq9AU5x_UZ_brem1-OUvlW4Ug5zjTRQXsiXEsuvwYOnKeaHIFcrPa7N1RKzPpb6YZnUawBnxs3YH7-Xt-3NrBxQEQglrwxRYg5Y0BWU?purpose=inline)

Product visual evidence

Show the actual interface affected by a release.

[Django REST API Tutorial](https://images.openai.com/static-rsc-4/EeEy9eUXPYuRoCErIsMNnzSSzjcJq34q7VV-rLjfK8t61Kki2__KTubuonE9qYFlnUM51UMPAp3xE54IxVQO28SshN4TSkj9Wnz5HhNQs25FpFDVqFyRCRUJhTYSsXGfBCn-mWZ7KOKnr7tzOCyYCbSw07ahnycrOfX6kmg-hng?purpose=inline)

Platform clarity

Help users identify whether a change affects the desktop agent, web app, API, or SDK.

[Cassidy vs Responsive: AI Automation That Outperforms Strategic Response Tools | Cassidy AI](https://images.openai.com/static-rsc-4/_baHevbRbTLZNYGnWReVn3RXfcJML1tqxE_wiaClKer8Qg97TFWNyjPuFM5jvjtXXq8x7RXncjDwrWlrhh1vXE0WL7mbprpBlJqOry6Aesi8SzPC73dV3YUpAyHnWJ__ka0nfk86CIrfF8AJmEE8mHUDJA4AMnj6K3UtR4eo8S0?purpose=inline)

Editorial highlights

Give major launches distinct visual treatments without disrupting the timeline.

These are style references, not images of confirmed Tellann releases.

### Page design measurements

| Property                | Desktop     | Mobile               |
| ----------------------- | ----------- | -------------------- |
| Main container          | 1200–1280px | Fluid                |
| Main timeline width     | 730–820px   | Full width           |
| Optional filter sidebar | 260–300px   | Collapsible controls |
| Horizontal page padding | 32–48px     | 20–24px              |
| Section spacing         | 96–120px    | 56–72px              |
| H1 size                 | 56–68px     | 36–44px              |
| H2 size                 | 34–44px     | 26–32px              |
| Body size               | 16–18px     | 15–17px              |
| Release card radius     | 12–16px     | 12px                 |
| Timeline stroke         | 1–2px       | 1–2px                |

# Detailed page sections

## 6. Section 01 — Global Navigation

Reuse the established marketing navbar.

Within the Resources mega-menu:

```
Resources
├── Resource Hub        /resources
├── Blog                /blog
├── Research            /research
├── Case Studies        /case-studies
├── Changelog           /changelog
├── Guides              /resources/guides
├── Videos              /resources/videos
└── Documentation       /docs
```

The active Changelog item should be visually identified.

If the page becomes long, an optional slim section menu can contain:

`Latest · All Updates · Desktop · SDK & API · Subscribe`

Do not make the secondary menu sticky on small screens if it significantly reduces the reading area.

## 7. Section 02 — Changelog Hero

### Recommended marketing copy

TELLANN CHANGELOG

# Built, improved, and documented.

Follow new capabilities, improvements, fixes, and platform updates across Tellann. See what changed, why it matters, and how to use it.

Features

Improvements

Fixes

Security

### Main CTAs

Primary: `See latest updates` → scroll to the newest release.

Secondary: `Explore roadmap` → `/roadmap`.

Optional tertiary: `Get release updates` → subscription section.

### Layout

Desktop: two columns.

- Left: 58–62%, containing headline, explanation, and actions.
- Right: 38–42%, containing a small product-evolution illustration.
- Hero height: 400–500px.
- H1 max-width: 700px.

Mobile: headline, summary, buttons, then simplified illustration.

### Hero illustration

A vertical stack of release records, with small connectors showing the product evolving over time.

The image must not contain made-up release dates or fictitious version numbers.

| Asset                          | Master dimensions | Rendered dimensions  |
| ------------------------------ | ----------------- | -------------------- |
| Hero release illustration      | 1200×1000 SVG     | \~430×360px          |
| Mobile simplified illustration | 700×700 SVG       | \~280×280px          |
| Fallback poster                | 1200×1000 WebP    | Same as illustration |
| OG image                       | 1200×630          | Social preview       |

### Hero animation

1. Timeline line appears.
2. Three abstract update cards reveal in sequence.
3. Final state remains static.

Duration: approximately 1.8–2.4 seconds.

No perpetual rotating release cards, noisy particle animation, or invented update counts.

## 8. Section 03 — Latest Release Highlight

### Heading

> The latest from Tellann.

This section should be dynamically populated with the newest eligible public release.

A large highlight is appropriate for meaningful releases, such as a new QA Reports view or major desktop release. Small bug fixes should not automatically receive a massive hero card.

### Example release card

Example release format

FEATURE · WEB APP

[Katalon TrueTest | AI-Driven Automated Testing from Real User Behavior](https://images.openai.com/static-rsc-4/1KRXoWVA7C8xWdPZt7w2GRZO-6lhw9_M1P_1m5BqSR-xK0hjDLHXfybPHULejI6O2dQEsBGZ1enw1J9VFbuW1cpfsWr1UEGU-ebimQi2d9X5wZBpPwFRT7ep0fK_3royVCDb5G45fpAuGc-Sb-hJ7xKc8URjd0WFLJ8PyxhwKTk?purpose=inline)

[katalon.com](https://katalon.com/truetest?utm_source=chatgpt.com)

# A clearer way to review workflow evidence.

Explore how a release note can explain improvements to QA reporting: what changed, which users benefit, and where to learn more.

Conceptual release illustration. Not a claim that this update has shipped.

### Desktop layout

A split feature card:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│ [ FEATURE IMAGE  ] [ DATE + RELEASE LABEL      ] │
│ [ 650 × 366      ] [ HEADLINE                  ] │
│ [                ] [ BENEFIT EXPLANATION       ] │
│ [                ] [ VIEW DETAILS →           ] │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Width: 1200–1280px.
- Height: 400–460px.
- Image: 55–58%.
- Text: 42–45%.
- Image master: 1600×900px.
- Image render: approximately 650×366px.
- Padding: 28–36px.

### Content requirements

Display the real publication date, release type, affected product surface, and availability. Include the version number only where appropriate.

If there are no published release records yet, replace this section with a straightforward introduction to how Tellann communicates changes. Do not create a fake first release.

## 9. Section 04 — Release Navigation and Filters

Users should be able to locate relevant changes quickly without reading the entire history.

### Recommended filters

Explore product updates

Release type

AllFeaturesImprovementsFixesSecurityBreaking changes

Product surface

All platforms

Web app

Desktop

SDK

API

Showing: All · All platforms. The live filters should update the published release entries and the shareable URL.

### Additional filtering

After enough release history exists, add:

- Year selection.
- Version search.
- Keyword search.
- `Breaking changes only`.
- Subscription-plan availability.

Do not make the filter interface more complicated than the available content.

### URL handling

Keep primary records under `/changelog`, with shareable filtered states such as:

```
/changelog?type=security
/changelog?platform=desktop
/changelog?year=2027
```

Filtered views need not all be indexed. The canonical archive should remain the primary SEO target.

## 10. Section 05 — Main Release Timeline

This is the most important component on the page.

### Recommended presentation

Use a reverse-chronological timeline, with the newest updates first.

TIMELINE COMPONENT PREVIEW · FICTIONAL ENTRIES

1. Sample date

   Feature

   Improved workflow reconciliation view

   A clearer presentation of expected and observed states for technical teams reviewing QA evidence.

   Illustrative note only
2. Sample date

   Improvement

   Simplified desktop demonstration setup

   More direct guidance for developers preparing an application for a managed-browser demonstration.

   Illustrative note only
3. Sample date

   Fix

   More consistent session evidence labels

   Example of how a small fix can describe its impact without exposing internal implementation details.

   Illustrative note only

### Release card anatomy

Every update should have:

- A publication date, separate from the actual release or availability date when they differ.
- Release headline.
- Type: feature, improvement, fix, security, or breaking change.
- Affected platform.
- Affected users or subscription plans, where relevant.
- Two- to four-sentence explanation of the practical change.
- Optional screenshot or video.
- Documentation or action link.
- Version or build identifier where applicable.

### Layout dimensions

Desktop:

- Timeline marker column: 36–48px.
- Main content column: 720–820px.
- Optional sidebar: 260–300px.
- Typical text-only entry: 160–240px high.
- Media-rich entry: 440–620px high.
- Spacing between entries: 32–48px.

Mobile:

- Timeline markers: 20–28px area.
- Cards: full remaining width.
- Media: full width, fixed aspect ratio.
- Spacing between entries: 24–32px.

The timeline should prioritize legibility over decorative effects.

### Entry type behavior

| Type            | Specific information to show                              |
| --------------- | --------------------------------------------------------- |
| Feature         | New capability, who can access it, how to start           |
| Improvement     | What became easier, clearer, or more reliable             |
| Fix             | Observable issue addressed, affected scope                |
| Security        | User impact, actions required, advisory where appropriate |
| Breaking change | Migration steps, deadlines, supported versions            |
| Deprecation     | Replacement, compatibility impact, retirement date        |

Never publish sensitive security exploit details before appropriate remediation or disclosure procedures have been completed.

## 11. Section 06 — Featured Visual Demonstrations

### Heading

> See what changed, not just what it's called.

The most valuable release notes often include a short screenshot or video explaining the change.

This section should surface significant visual releases from the main timeline rather than inventing a parallel content library.

### Media types

[BISO — Your Codebase's Immune System](https://images.openai.com/static-rsc-4/wtOGAq36g_1aovmLjaPksmYG0MKT-82-n9L_0WHxw07Q4VhG7Y420HkNA91rlUK-FZTvzm2f-73pkPd6JwW53TZ2X-zctGegrabisnFjci_vHtel0JxdBARNeS-Yk2j1t8OlYAucSeOFJh2mEoMfxVhXh3XDcLmXwGuqUE2WMfk?purpose=inline)

Feature screenshots

Show the updated user interface, with a short annotation identifying the improvement.

[Qoder - Alibaba Cloud Model Studio - Alibaba Cloud ドキュメントセンター](https://images.openai.com/static-rsc-4/3lFgS063Fh7HcH0BXP13DQmWd-aOzArggKHpFIwfdCiFLb4BBceb-8vR2fNYuVQIJgLpKZYvj54Y6HmlCXXzgEa0gqVueAJ8qZCu1udByDMFSCe_cywhOqSMviCyE-rwaZ68Ijr-JJ87jYmXry1ZoB-sAqxuV1oj4ZLFlJH7ecY?purpose=inline)

Before-and-after comparisons

Useful for onboarding, configuration, navigation, and reporting interface changes.

### Recommended media dimensions

| Media                    | Master                  | Typical rendered size |
| ------------------------ | ----------------------- | --------------------- |
| Large release screenshot | 1600×900                | 740×416px             |
| Detail screenshot        | 1200×800                | 650×433px             |
| Comparison images        | 1600×900 each           | Two 350×197px panels  |
| Animated product clip    | 1920×1080               | 740×416px             |
| Video thumbnail          | 1280×720                | 740×416px             |
| Inline SVG diagram       | 1400×800 viewBox        | 600–740px wide        |
| Mobile screenshots       | 900×1600 where relevant | Up to 340px wide      |

### Video requirements

For a substantial visual release:

- Duration: 20–60 seconds for a feature teaser.
- Duration: 2–4 minutes for a detailed walkthrough.
- Resolution: 1920×1080.
- Frame rate: 30fps.
- Captions: mandatory.
- Autoplay audio: never.
- Player: poster-first, lazy-loaded.
- Playback: accessible keyboard controls.

A release video should demonstrate an actual available feature—not a speculative mockup.

### Before-and-after slider

Useful for visual changes to a report, dashboard, or setup flow.

Recommended implementation:

- Both images aligned to the same dimensions.
- Draggable separator.
- Keyboard-operable position control.
- Labels identifying each image and version.
- Static side-by-side fallback.

Only compare authentic versions of the feature. Avoid fabricated “before” screenshots designed to exaggerate improvement.

## 12. Section 07 — Updates by User Role

### Heading

> The updates that matter to your work.

Most users should be able to understand the relevance of an update without knowing Tellann's internal architecture.

Present five role-oriented discovery cards.

| Audience             | What should be highlighted                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| Developers           | Desktop workflows, SDK changes, endpoint tracing, instrumentation, compatibility      |
| QA engineers         | Demonstration evidence, reconciliation, session replay, workflow coverage, QA reports |
| Engineering managers | Report clarity, collaboration, governance, rollout and compatibility implications     |
| Product managers     | Workflow understanding, intended behavior, reviewability, user-facing improvements    |
| Founders             | Getting started, ease of setup, accessible features, pricing and plan changes         |

### Example

A new report-export capability might have the following role-specific explanations.

For a QA engineer: “Export a report that summarizes demonstrated states and workflows requiring more investigation.”

For an engineering manager: “Share reviewable QA evidence with stakeholders without requiring them to inspect each session.”

For a product manager: “Understand which expected product journeys still lack supporting execution evidence.”

The change itself should remain one release record. The role section can dynamically show the relevant explanation.

### Layout

Desktop: a horizontal selector and one shared content panel, approximately 1200×320–380px.

Mobile: horizontal-scroll tabs with a stacked explanation panel.

No large images necessary. Use role icons at 36–48px and a small contextual thumbnail when relevant.

### Data behavior

Role-focused discovery must use structured audience metadata attached to the same public release records.

Avoid duplicating release text for SEO purposes.

## 13. Section 08 — Platform and Compatibility Updates

### Heading

> Know exactly where an update applies.

Tellann spans multiple technical surfaces, so release notes must communicate scope accurately.

### Recommended platform labels

- Web App
- Desktop Agent
- JavaScript/TypeScript SDK
- API
- Backend Services
- Integrations
- Security & Identity
- Billing & Subscription

The most important distinction is between the browser dashboard and the desktop demonstration environment.

Tellann's documented Phase 1 workflow places guided runs in the desktop agent, using a local workspace, reviewed instrumentation, and a managed browser. The web dashboard presents evidence and reports and can hand off to the agent; it should not be described as independently executing those runs.

### Release note compatibility panel

EXAMPLE RELEASE METADATA · NOT A SHIPPED RELEASE

### Desktop agent update

| Component        | Tellann Desktop               |
| ---------------- | ----------------------------- |
| Version          | Populated from actual release |
| Supported OS     | Actual tested platforms only  |
| Update required? | Yes / No / Recommended        |
| Compatibility    | Document supported versions   |
| User action      | Actual update instructions    |

### Special release content

For Desktop releases, include supported operating systems, minimum version, upgrade behavior, permission changes and migration notes.

For SDK releases, include package version, release type, compatibility, API changes and code examples.

For API releases, include affected endpoints, schema changes, deprecations and migration information.

For security-related releases, include applicable advisories and user actions without disclosing unsafe implementation details.

## 14. Section 09 — Product Evolution and Milestones

### Heading

> How Tellann is evolving.

A short retrospective can connect historical releases to larger product milestones.

For example, the product architecture distinguishes:

- Phase 1: Behavioral QA and declared-intent reconciliation.
- Later phases: Broader production intelligence.
- Further future direction: More advanced intelligence and automation.

However, a product phase should appear here as a completed milestone only after it has actually shipped.

### Visualization

Use a horizontal historical milestone strip backed by verified releases.

Desktop:

- Container: 1200px.
- Height: 240–320px.
- Each milestone width: 260–340px.
- Small product thumbnail: 360×200 source.
- Connector: SVG line with date markers.

Mobile: vertical timeline.

Animations: one-time path reveal, no autoplay carousel.

### Roadmap connection

End with:

`Curious about what comes next? View the roadmap →`

The Changelog answers what has happened. The Roadmap answers what Tellann is considering or planning.

## 15. Section 10 — Subscribe to Release Updates

### Heading

> Stay informed when Tellann changes.

Supporting copy:

> Receive important feature releases, improvements, compatibility updates, and relevant security announcements.

### Subscription options

For an initial public launch, a simple email subscription is sufficient.

As the product matures, allow subscribers to select notification categories, such as:

- All important updates.
- Desktop releases.
- SDK and API changes.
- Security advisories.
- Major product features.

Provide immediate subscription confirmation, unsubscribe functionality, email verification, and clear consent.

### Layout

Desktop centered content block:

- Width: 720–840px.
- Height: 260–340px.
- Email input width: approximately 400–460px.
- Button width: 140–170px.

Mobile: field and button stacked vertically.

### Future integrations

An RSS feed at `/changelog/rss.xml` or `/changelog/feed.xml` is highly worthwhile.

A product-settings subscription could eventually allow authenticated customers to follow updates relevant to their installations or plan, but that should not be required to read the public Changelog.

## 16. Section 11 — Historical Release Archive

### Heading

> Browse earlier releases.

Use a chronological archive grouped by year and month.

Example route behavior:

```
/changelog
/changelog/2027
/changelog/2027/03
```

Dedicated annual archive routes should be added only after release volume justifies them. Otherwise, ordinary paginated results are simpler.

Include:

- Search by headline or version.
- Year filter.
- Platform filter.
- Release type.
- Old releases marked as superseded when applicable.

### Pagination

Use accessible URL-based pagination, not infinite scrolling alone.

Provide `Previous` and `Next` controls, and clearly distinguish historical announcements from current documentation.

For technical truthfulness, older release pages may remain indexed while linking to the latest relevant docs.

## 17. Section 12 — Related Resources

Heading:

> Go deeper when an update matters to you.

Use three or four compact links:

| Resource      | Purpose                                                | Route        |
| ------------- | ------------------------------------------------------ | ------------ |
| Documentation | Learn how to use current capabilities                  | `/docs`      |
| Roadmap       | Understand possible future improvements                | `/roadmap`   |
| Blog          | Read engineering perspectives behind product decisions | `/blog`      |
| Resource Hub  | Find learning guides and videos                        | `/resources` |

No expensive imagery required. Use subtle iconography and 1px outlined cards.

## 18. Section 13 — Final CTA

### Heading

> Discover what Tellann can help you understand.

Supporting copy:

> Explore the platform's approach to declared workflows, guided demonstrations, observed behavior, reconciliation, and QA reporting.

Primary CTA: `Explore Tellann`

Secondary CTA: `Start free`

Place this CTA at the end of the archive, not between every release.

### Visual

A static SVG behavior-graph illustration showing the general product workflow.

- SVG source: 1600×650.
- Desktop card: 1100–1200px wide ×320–380px high.
- Mobile: 100% width, natural height.
- Animation: optional 300ms entrance, one-time.

Do not use a looping video here. The timeline already contains multimedia content.

# Individual Changelog Entry Pages

## 19. Dynamic route structure

Use the canonical detail route:

```
/changelog/[slug]
```

Examples of future potential slugs:

```
/changelog/desktop-agent-version-1-2
/changelog/workflow-reconciliation-view
/changelog/sdk-instrumentation-improvements
```

These are example URL patterns, not existing releases.

Avoid using a bare version identifier as the only visible title; it gives search engines and readers little context.

## 20. Full release-entry page template

```
CHANGELOG DETAIL
│
├── Global Navigation
├── Breadcrumbs
├── Release Type / Platform / Version
├── Release Headline
├── Published Date + Availability Date
├── Short User Benefit Summary
├── Featured Screenshot / Video
├── What's New
├── What's Improved
├── What's Fixed
├── Who Is Affected
├── Plan / Platform Availability
├── Required Actions / Migration
├── Known Limitations
├── Technical Notes
├── Documentation Links
├── Previous / Next Release
├── Related Updates
├── Subscribe / Product CTA
└── Global Footer
```

Not every release needs every section. A small UI fix may require only a short description and one screenshot, while a major desktop or SDK release needs comprehensive technical information.

### Detail page layout

- Primary prose column: 700–760px.
- Optional right sidebar: 240–260px.
- Main container: 1200px.
- H1: 42–56px desktop.
- Body: 17–18px.
- Featured visual: up to 1000px wide.
- Metadata panel: compact, above the article body.

### Essential article sections

What's new: Describe the change in a way that makes sense without internal technical knowledge.

Why it matters: Explain who benefits and how their workflow changes.

How to use it: Link to a specific documentation section or guide.

Availability: List the relevant environments, platforms, rollout stage, and subscription access.

What changed technically: Optional expandable section for SDK/API configuration or implementation details.

Known limitations: State relevant constraints, temporary restrictions, or compatibility considerations.

Action required: Prominently display any update or migration requirements.

## 21. Recommended release taxonomy

Use standardized categories to avoid inconsistent editorial labeling.

| Category          | Definition                                                  |
| ----------------- | ----------------------------------------------------------- |
| `FEATURE`         | A newly available capability                                |
| `IMPROVEMENT`     | Meaningful enhancement to an existing capability            |
| `FIX`             | Correction of a previously observable issue                 |
| `PERFORMANCE`     | Verified efficiency, latency, or resource improvement       |
| `SECURITY`        | A security-related change                                   |
| `DEPRECATION`     | A supported feature or API is being phased out              |
| `BREAKING_CHANGE` | A change requiring compatibility or migration action        |
| `MAINTENANCE`     | Infrastructure or operational maintenance of user relevance |

Only claim a performance improvement when supported by credible measurements.

### Release identifiers

I recommend separately maintaining:

- Public release ID.
- Human-readable slug.
- Publication date.
- Effective release date.
- Component-specific version.
- Release channel.
- Deployment environment.
- Rollout stage.
- Public visibility.

A web application deployment might not need an externally visible semantic version, while desktop and SDK releases commonly benefit from one.

## 22. Changelog data model

```
type ReleaseType =
  | "FEATURE"
  | "IMPROVEMENT"
  | "FIX"
  | "PERFORMANCE"
  | "SECURITY"
  | "DEPRECATION"
  | "BREAKING_CHANGE"
  | "MAINTENANCE";

type ReleasePlatform =
  | "WEB"
  | "DESKTOP"
  | "SDK"
  | "API"
  | "BACKEND"
  | "INTEGRATION";

type ReleaseStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED";

interface ChangelogEntry {
  id: string;
  slug: string;

  title: string;
  summary: string;
  content: string;

  type: ReleaseType;
  platforms: ReleasePlatform[];
  audiences: string[];

  version?: string;
  releaseChannel?: "STABLE" | "BETA" | "PREVIEW";

  publishedAt?: string;
  releasedAt?: string;

  status: ReleaseStatus;
  featured: boolean;

  rollout?: {
    scope: "GENERAL" | "LIMITED" | "STAGED";
    details?: string;
  };

  availability?: {
    plans: string[];
    regions?: string[];
    requiredVersion?: string;
  };

  actionRequired?: {
    required: boolean;
    instructions?: string;
    deadline?: string;
  };

  media: {
    type: "IMAGE" | "VIDEO" | "DIAGRAM";
    src: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
  }[];

  knownLimitations?: string[];

  docsLinks?: string[];
  roadmapItemIds?: string[];
  relatedReleaseIds?: string[];

  seo: {
    title: string;
    description: string;
    canonical?: string;
  };
}
```

### Additional operational fields

Internally, store a deployment or release verification reference, reviewer identity, approval timestamp, artifact/checksum when relevant, and audit history.

Those fields do not all need to be public, but they provide a basis for verifying that a changelog entry corresponds to a real deployment.

## 23. Release publication workflow

The Changelog should not depend exclusively on a developer manually remembering to write release notes after deploying.

Recommended pipeline:

1. Code or product change is completed and reviewed.
2. A releasable build is created and tested.
3. The intended rollout and affected audience are identified.
4. Public-facing release notes are drafted and technically reviewed.
5. The change is verified as available to the stated release channel and audience.
6. The entry is published with the correct effective date and availability information.
7. Subscribers or customers are notified according to their preferences and the change's significance.

### Relationship to the Roadmap

The same capability identifier can be referenced in both systems, but their status models should remain separate.

For example:

```
Roadmap capability ID
        │
        ▼
Development / Release Verification
        │
        ▼
Published Changelog Entry
        │
        ▼
Link added to Roadmap Item
```

A release should not automatically change a roadmap capability to fully shipped if only a partial or limited release has occurred.

# SEO, Operations, and Development Priorities

## 24. SEO metadata

### Main page

Title: `Tellann Changelog | Product Updates, Features & Fixes`

Meta description: `Explore the latest Tellann product updates, new features, improvements, fixes, desktop releases, SDK changes, and important platform announcements.`

Canonical: `https://tellann.co/changelog`

### Individual entries

Use descriptive metadata combining the feature benefit and product name.

Example title format:

`[Feature or Improvement Name] — Tellann Release Notes`

### Structured data

Use:

- `CollectionPage` for `/changelog`.
- `BreadcrumbList` for individual entries.
- `ItemList` for the release archive where useful.
- `Article` for detailed changelog pages.
- `VideoObject` for real release videos where applicable.

Do not mark routine release entries as scholarly research or editorial reviews.

### Indexing approach

Index the main Changelog and meaningful release detail pages.

Avoid indexing every possible filtered URL, empty archive page, or near-duplicate patch note.

The Changelog is more valuable for product trust, branded discovery, and customer retention than as a primary source of broad nonbranded search traffic.

## 25. Performance and accessibility

Requirements:

- Server-render release entries.
- Show real chronological content without JavaScript.
- Lazy-load below-the-fold images.
- Load video posters before video players.
- Reserve image dimensions to avoid layout shifts.
- Provide captions, transcripts, and descriptive alt text.
- Support keyboard navigation for filters, links, and media.
- Use accessible chronological structures and readable dates.
- Respect reduced-motion preferences.
- Display dates clearly with the viewer's locale where appropriate, while preserving an unambiguous date representation in metadata.

For pagination, ensure users can reach older release notes without endless client-side loading.

## 26. Analytics events

Recommended marketing event taxonomy:

```
CHANGELOG_PAGE_VIEWED
CHANGELOG_FILTER_APPLIED
CHANGELOG_SEARCH_SUBMITTED
CHANGELOG_ENTRY_OPENED
CHANGELOG_VIDEO_STARTED
CHANGELOG_VIDEO_COMPLETED
CHANGELOG_DOCS_CLICKED
CHANGELOG_DOWNLOAD_CLICKED
CHANGELOG_SUBSCRIBE_CLICKED
CHANGELOG_SUBSCRIPTION_CONFIRMED
CHANGELOG_ROADMAP_CLICKED
CHANGELOG_PRODUCT_CLICKED
CHANGELOG_SIGNUP_CLICKED
```

Useful KPIs include:

- Release-note readership.
- Visits from in-app notifications.
- Documentation engagement after releases.
- Desktop upgrade adoption, when connected to legitimate version telemetry.
- Migration guide visits.
- Email subscription growth.
- Product exploration and qualified signups originating from the Changelog.

Avoid treating high page views as a reliable measure of feature adoption.

## 27. Complete media production checklist

| Asset                             | Initial quantity | Dimensions         |
| --------------------------------- | ---------------- | ------------------ |
| Hero timeline illustration        | 1                | 1200×1000 SVG      |
| Hero mobile variant               | 1                | 700×700 SVG        |
| Featured release cover template   | 1                | 1600×900           |
| General update thumbnail template | 1                | 1200×675           |
| Product screenshot frame          | 1 reusable       | 1600×900           |
| Desktop screenshot frame          | 1 reusable       | 1600×1000          |
| Before/after comparison template  | 1                | 1600×900 per image |
| Release video thumbnail           | 1 reusable       | 1280×720           |
| Major release video               | As needed        | 1920×1080          |
| Platform icons                    | 5–8              | 96×96 SVG          |
| CTA background graphic            | 1                | 1600×650 SVG       |
| Open Graph template               | 1                | 1200×630           |

Do not create media assets for fictional releases just to populate the live timeline. Reusable visual templates are fine; content should be populated only when a verified release exists.

## 28. Development priorities

Phase 1 — Public Changelog Foundation

Build first

Implement the hero, release timeline, reusable entry cards, detail pages, platform/type labels, SEO, pagination, and content management. If no public release history exists, display a transparent initial state rather than manufactured entries.

Phase 2 — Rich Release Communication

Add screenshots, short release videos, role-aware summaries, version compatibility panels, RSS, release subscriptions, and links to related documentation.

Phase 3 — Integrated Release Intelligence

Connect release records to verified deployment metadata, in-app update notifications, desktop update information, migration guidance, and roadmap completion references.

## 29. Complete desktop wireframe

```
┌────────────────────────────────────────────────────────┐
│ GLOBAL NAVIGATION                                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│ TELLANN CHANGELOG                                      │
│                                                        │
│ Built, improved, and documented.                       │
│                                                        │
│ [ Latest Updates ] [ Roadmap ]    [ Release Graphic ]  │
│                                                        │
├────────────────────────────────────────────────────────┤
│ LATEST RELEASE                                         │
│                                                        │
│ [ Product Screenshot    ] [ Release summary          ] │
│ [                       ] [ Date / Availability       ] │
│ [                       ] [ Read release →            ] │
├────────────────────────────────────────────────────────┤
│ BROWSE UPDATES                                         │
│                                                        │
│ [ Search updates...                                  ] │
│ All | Features | Improvements | Fixes | Security       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ RELEASE TIMELINE                    FILTER SIDEBAR      │
│                                                        │
│ ●  Release date                      All platforms     │
│ │  [ Feature release card ]          Web app           │
│ │  [ Screenshot / details ]          Desktop           │
│ │                                    SDK               │
│ ●  Release date                      API               │
│ │  [ Improvement card ]                                │
│ │                                                      │
│ ●  Release date                      YEAR              │
│ │  [ Bug fix card ]                  [ Filter ]        │
│ │                                                      │
│ ●  Older updates                                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│ FEATURE DEMONSTRATION                                  │
│ [ Video / Comparison ] [ What changed and why ]        │
├────────────────────────────────────────────────────────┤
│ UPDATES THAT MATTER TO YOUR ROLE                       │
│ Developer | QA | Manager | Product | Founder           │
│ [ Relevant changes and practical meaning ]             │
├────────────────────────────────────────────────────────┤
│ PLATFORM & COMPATIBILITY UPDATES                       │
│ [ Desktop ] [ Web ] [ SDK ] [ API ]                    │
├────────────────────────────────────────────────────────┤
│ PRODUCT EVOLUTION                                      │
│ [ Verified historical milestones ]                    │
├────────────────────────────────────────────────────────┤
│ SUBSCRIBE TO RELEASE UPDATES                           │
│ [ Email address ] [ Subscribe ]                        │
├────────────────────────────────────────────────────────┤
│ HISTORICAL RELEASE ARCHIVE                             │
│ [ Previous releases and pagination ]                   │
├────────────────────────────────────────────────────────┤
│ DOCUMENTATION       ROADMAP       RESOURCE HUB         │
├────────────────────────────────────────────────────────┤
│ DISCOVER TELLANN                                       │
│ [ Explore Product ] [ Start Free ]                     │
├────────────────────────────────────────────────────────┤
│ GLOBAL FOOTER                                          │
└────────────────────────────────────────────────────────┘
```

## 30. Final recommendation

For Tellann, the Changelog should become the single authoritative source for publicly shipped product changes.

Its competitive advantage will not be how many updates are published, but how clearly each update explains:

What changed → Who benefits → Where it is available → How to use it → What limitations remain.

I would prioritize a clean, accurate release timeline over elaborate animations or large promotional banners.

When a new feature launches, the Changelog should explain the user benefit, show authentic product evidence, link to the relevant documentation, and clearly identify which environments or subscription plans have access.

Done consistently, `/changelog` becomes more than a release archive: it becomes a record of Tellann's technical progress, transparency, and commitment to its users.