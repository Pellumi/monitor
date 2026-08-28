The footer should behave like a **secondary navigation system**, not a dumping ground.

For Tellann, it needs to serve four purposes at once:

**navigation, developer discovery, trust, and conversion.**

Because Tellann spans product, developer tooling, security, pricing, documentation, and eventually enterprise deployment, the footer should be deliberately structured rather than reduced to a few generic links.

# Footer component — overall structure

I would structure it as:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Brand / CTA area                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRODUCT   SOLUTIONS   DEVELOPERS   RESOURCES   COMPANY     │
│                                                             │
│                         TRUST & LEGAL                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status / Social / Copyright / Region                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

For desktop, I would use a **two-stage footer**:

```text
CTA / Brand block
        ↓
Navigation grid
        ↓
Legal / social bottom bar
```

---

# 1. Footer CTA area

This should appear before the navigation links.

It gives the user one final clear action after reaching the bottom of any marketing page.

## Layout

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Show Tellann how your application works.                 │
│                                                            │
│  Turn a demonstration into workflows, coverage,           │
│  missing-state analysis and QA evidence.                  │
│                                                            │
│                    [ Start free ]  [ View docs ]           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Mobile:

```text
Show Tellann how your
application works.

Short supporting copy.

[ Start free ]

[ View documentation ]
```

---

## Recommended content

### Heading

> **Show Tellann how your application works.**

### Supporting copy

> Start with a demonstration session and turn observed behavior into workflows, coverage, missing-state and missing-flow analysis, session replay, endpoint intelligence, and QA reports.

Those are current Phase 1 capabilities.

### Primary CTA

```text
Start free
```

Destination:

```text
/signup
```

or:

```text
https://app.tellann.co/signup
```

depending on final application routing.

### Secondary CTA

```text
View documentation
```

Destination:

```text
https://docs.tellann.co
```

---

# 2. Main footer layout

Desktop should use approximately six columns.

```text
BRAND

PRODUCT

SOLUTIONS

DEVELOPERS

RESOURCES

COMPANY

TRUST & LEGAL
```

You can technically fit seven columns on large screens, but I would instead make the Brand column wider.

Something like:

```text
┌──────────────┬──────────┬───────────┬───────────┬──────────┬─────────┐
│ BRAND        │ PRODUCT  │ SOLUTIONS │ DEVELOPERS│ RESOURCES│ COMPANY │
│              │          │           │           │          │         │
│              │          │           │           │          │ TRUST   │
└──────────────┴──────────┴───────────┴───────────┴──────────┴─────────┘
```

---

# 3. Brand column

This should occupy about **25–30%** of the footer width.

## Tellann logo

Use:

```text
Tellann symbol + wordmark
```

Click:

```text
/
```

---

## Short brand description

Keep it short.

Recommended:

> **Behavioral quality intelligence for software teams. Tellann observes application behavior, maps workflows, measures coverage, and reveals what your team missed.**

This is directly aligned with the product positioning.

Do not place the entire mission statement here.

---

## Short category label

Optional:

```text
Behavioral Quality Intelligence
```

This can be presented in small muted typography beneath the wordmark.

---

# 4. Product column

Heading:

```text
PRODUCT
```

Links:

```text
Overview
How It Works
Demonstration Mode
Behavior Graphs
Workflow Discovery
Coverage Analysis
Missing Flows
Missing States
Session Replay
Endpoint Intelligence
QA Reports
```

Routes:

```text
/product
/product/how-it-works
/product/demonstration-mode
/product/behavior-graphs
/product/workflow-discovery
/product/coverage
/product/missing-flows
/product/missing-states
/product/session-replay
/product/endpoint-intelligence
/product/qa-reports
```

These correspond to the core MVP capabilities.

---

# 5. Product column hierarchy

Don't display all links at the exact same visual weight.

Use something like:

```text
PRODUCT

Overview
How It Works

Understand
Behavior Graphs
Workflow Discovery
Session Replay

Analyze
Coverage
Missing Flows
Missing States
Endpoint Intelligence

Reports
QA Reports
```

The headings `Understand`, `Analyze`, and `Reports` would be muted sublabels rather than actual pages.

This mirrors the internal product story:

```text
Observe
↓
Model
↓
Analyze
↓
Report
```

---

# 6. Solutions column

Heading:

```text
SOLUTIONS
```

Break it into role-based and organization-based links.

### By role

```text
Developers
QA Engineers
Engineering Leaders
Product Teams
```

Routes:

```text
/solutions/developers
/solutions/qa-engineers
/solutions/engineering-leaders
/solutions/product-teams
```

The product requirements identify developers, QA engineers, engineering managers, and product teams as major user groups.

---

## By organization

```text
Startups
SaaS Teams
```

Routes:

```text
/solutions/startups
/solutions/saas
```

---

## Optional use cases

Don't overload the footer with every use-case page.

I would only expose the three strongest:

```text
Workflow Coverage
Find Missing Flows
QA Planning
```

Routes:

```text
/use-cases/workflow-coverage
/use-cases/find-missing-flows
/use-cases/qa-planning
```

The other use-case pages can remain accessible through internal SEO navigation.

---

# 7. Developers column

This is extremely important because Tellann is a developer product.

Heading:

```text
DEVELOPERS
```

Links:

```text
Developer Hub
Quickstart
Documentation
SDKs
API Reference
React
Next.js
Node.js
Express
NestJS
Status
```

---

## Routes

```text
/developers
/developers/quickstart
https://docs.tellann.co
/developers/sdk
/developers/api
/developers/react
/developers/nextjs
/developers/nodejs
/developers/express
/developers/nestjs
https://status.tellann.co
```

The documented SDK ecosystem currently includes React, Next.js, Node.js, Express, NestJS, Fastify and related JavaScript/TypeScript environments.

You may optionally include Fastify:

```text
Fastify
```

But if footer length becomes excessive, framework-specific links belong primarily inside the Developer hub.

---

# 8. GitHub link

Once Tellann has public SDKs or public repositories, place:

```text
GitHub ↗
```

under Developers.

External-link icon required.

Do not display GitHub until there is actually something public worth sending users to.

---

# 9. Resources column

Heading:

```text
RESOURCES
```

Links:

```text
Blog
Guides
Case Studies
Research
Glossary
Changelog
Roadmap
```

Routes:

```text
/blog
/guides
/case-studies
/research
/glossary
/changelog
/roadmap
```

---

# 10. Resource behavior

`Blog`

General educational content.

`Guides`

Long-form technical and QA guides.

`Case Studies`

Actual customer outcomes.

Do not launch with fake case studies.

If none exist yet, hide this link.

`Research`

Later useful for behavioral QA benchmarks, application quality studies, testing data, etc.

`Glossary`

High-value SEO content.

`Changelog`

Product updates.

`Roadmap`

Current and future product development.

---

# 11. Company column

Heading:

```text
COMPANY
```

Links:

```text
About
Contact
Careers
Brand
Pricing
```

Routes:

```text
/about
/contact
/careers
/brand
/pricing
```

Optionally:

```text
Press
```

later.

---

# 12. About link

`About` should explain:

```text
Why Tellann exists
Product philosophy
Mission
Long-term vision
```

The underlying product philosophy is that applications generate behavioral evidence capable of revealing their quality state.

---

# 13. Careers link

Only expose `/careers` if there is something useful there.

Early stage:

```text
Careers
We're not actively hiring.
Follow Tellann for future roles.
```

is acceptable.

A completely empty careers page is worse than hiding it.

---

# 14. Brand link

This will eventually connect to your branding assets:

```text
Logo
Wordmark
Colors
Typography
Press description
Brand usage rules
```

Since you've already established a monochrome identity and Satoshi-based branding, this becomes useful for partners and press.

---

# 15. Trust & Legal column

This column should receive higher priority than most SaaS sites give it because Tellann observes customer applications.

Heading:

```text
TRUST & LEGAL
```

Links:

```text
Security
Privacy
Data Collection
Session Replay Privacy
Enterprise Security
Terms
Cookie Policy
DPA
Subprocessors
Acceptable Use
```

Routes:

```text
/security
/security/privacy
/security/data-collection
/security/session-replay
/security/enterprise

/legal/terms
/legal/privacy
/legal/cookies
/legal/dpa
/legal/subprocessors
/legal/acceptable-use
```

---

# 16. Security link

The Security page should be highly visible.

Tellann's architecture already defines:

```text
TLS
Encryption at rest
Tenant isolation
RBAC
Audit logging
API key controls
Privacy filtering
```

So users should be able to reach this information from every page.

---

# 17. Privacy link

This is especially important due to session recording.

The footer should give direct access to information explaining:

```text
What Tellann collects
What Tellann masks
What Tellann never collects
```

The privacy specification explicitly separates collected, masked, and prohibited data.

---

# 18. Data collection link

I would make this separate from the legal Privacy Policy.

This distinction matters:

```text
/legal/privacy
=
legal privacy policy

/security/data-collection
=
technical explanation of what the SDK captures
```

Developers generally care more about the second.

---

# 19. Status indicator

At the very bottom of the footer:

```text
● All systems operational
```

Click:

```text
https://status.tellann.co
```

States:

```text
● Operational
● Degraded Performance
● Partial Outage
● Major Outage
```

Do not hardcode:

```text
All systems operational
```

It should ideally consume the status service.

Fallback:

```text
System Status
```

without claiming current operational state.

---

# 20. Bottom bar

Below the main footer navigation:

```text
──────────────────────────────────────────────────────────

© 2026 Tellann        Privacy     Terms     Cookies

System Status          GitHub   X   LinkedIn
```

Desktop layout:

```text
LEFT                                  RIGHT

© Tellann                             System Status
Privacy                              GitHub
Terms                                X
Cookies                              LinkedIn
```

---

# 21. Copyright

Use:

```text
© 2026 Tellann. All rights reserved.
```

Once the legal company structure is established, you may eventually change it to something like:

```text
© 2026 Tellann Technologies Limited.
```

or:

```text
Tellann is a product of PEP Holdings Limited.
```

But do not publish that company attribution until the actual legal structure exists.

---

# 22. Social links

Recommended:

```text
GitHub
X
LinkedIn
```

Potentially later:

```text
YouTube
Discord
```

I would avoid placing:

```text
Instagram
TikTok
Facebook
```

unless Tellann actually maintains meaningful channels there.

Developer brands benefit from restraint.

---

# 23. Social icon behavior

Icons should have:

```text
aria-label="Tellann on GitHub"
aria-label="Tellann on X"
aria-label="Tellann on LinkedIn"
```

Open external links in appropriate context.

Always visually indicate external destination if the design permits.

---

# 24. Newsletter

I would **not** add a generic:

```text
Subscribe to our newsletter
[email@example.com]
```

just because SaaS footers usually contain one.

Add it only when you have an actual newsletter/content cadence.

If implemented later:

```text
Behavioral Quality Notes

Product updates, engineering research,
and practical QA insights.

[ email                       ]
[ Subscribe ]
```

No spammy:

> JOIN 10,000+ DEVELOPERS

unless that number is real.

---

# 25. Footer logo treatment

Given your monochrome identity, I would use:

```text
white / near-white logo
```

on the dark footer.

Or inverse if the website runs light mode.

Avoid placing the neon/product dashboard color palette in the footer if the brand itself is monochrome.

---

# 26. Suggested desktop footer

A realistic structure:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Show Tellann how your application works.                              │
│   Turn observed behavior into structured QA intelligence.               │
│                                                                         │
│                                   [ Start free ]  [ Documentation ]     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ TELLANN       PRODUCT       SOLUTIONS       DEVELOPERS                  │
│                                                                         │
│ [logo]        Overview      Developers      Developer Hub               │
│               How it works  QA Engineers    Quickstart                  │
│ Behavioral    Demo Mode     Eng Leaders     Documentation               │
│ quality       Graphs        Product Teams   SDKs                        │
│ intelligence Coverage       Startups        API Reference               │
│ for software  Missing       SaaS Teams      React                       │
│ teams.        States                         Next.js                     │
│               Replay                         Node.js                     │
│               Endpoints                      GitHub ↗                    │
│               Reports                                                   │
│                                                                         │
│               RESOURCES      COMPANY         TRUST & LEGAL              │
│                                                                         │
│               Blog           About           Security                   │
│               Guides         Pricing         Privacy                    │
│               Glossary       Contact         Data Collection            │
│               Changelog      Careers         Terms                      │
│               Roadmap        Brand           Cookies                    │
│                                               DPA                       │
│                                               Subprocessors             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ © 2026 Tellann. All rights reserved.          ● System Status           │
│                                               GitHub  X  LinkedIn       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 27. Mobile layout

On mobile, don't render 50 links fully expanded.

Use accordion groups.

```text
Tellann

Behavioral quality intelligence
for software teams.

[ Start free ]

────────────────────

Product                       +
Solutions                     +
Developers                    +
Resources                     +
Company                       +
Trust & Legal                 +

────────────────────

● System Status

GitHub   X   LinkedIn

© 2026 Tellann
Privacy · Terms · Cookies
```

---

# 28. Mobile accordion behavior

When opened:

```text
Product                       −

Overview
How It Works
Demonstration Mode
Behavior Graphs
Coverage
Missing Flows
Missing States
Session Replay
Endpoint Intelligence
QA Reports
```

Only one group needs to be open at a time if you want to reduce scrolling.

But do not force that behavior if accessibility suffers.

---

# 29. Responsive breakpoints

Conceptually:

```text
≥ 1280px
6-column grid

1024–1279px
4-column grid

768–1023px
2–3 columns

< 768px
Accordion
```

---

# 30. Footer spacing

The footer should feel substantial.

Desktop:

```text
CTA top padding       ~80–120px
CTA bottom padding    ~80px

Navigation top        ~64px
Navigation bottom     ~64px

Bottom bar            ~24–32px
```

Exact values depend on your design tokens.

---

# 31. Visual separation

Use:

```text
subtle border-top
```

between:

```text
CTA
Navigation
Bottom bar
```

Avoid card borders around every navigation group.

The footer should feel like one coherent surface.

---

# 32. Typography

Recommended hierarchy:

```text
CTA heading
32–48px desktop

Brand description
14–16px

Column headings
11–12px
uppercase / letter-spaced

Links
14px

Bottom legal
12–13px
```

Using Satoshi or your established primary Tellann typography.

---

# 33. Link hover states

Desktop:

```text
default:
muted grey

hover:
foreground white / strong contrast

transition:
150–200ms
```

Optional:

```text
→
```

animation for feature links.

Don't make links jump around horizontally.

---

# 34. Focus states

Keyboard navigation must be obvious.

Example:

```text
outline: 2px
outline-offset: 3px
```

using accessible contrast.

Footer accessibility is often neglected because designers treat it as decoration.

It isn't.

---

# 35. External links

External destinations:

```text
docs.tellann.co
status.tellann.co
GitHub
X
LinkedIn
```

Can include:

```text
↗
```

to distinguish them.

---

# 36. Footer data model

Do not manually write every link into JSX.

Define it as data.

For example:

```ts
const footerNavigation = [
  {
    title: "Product",
    groups: [
      {
        links: [
          { label: "Overview", href: "/product" },
          { label: "How It Works", href: "/product/how-it-works" },
          {
            label: "Demonstration Mode",
            href: "/product/demonstration-mode",
          },
        ],
      },
    ],
  },
];
```

Then render reusable:

```text
FooterGroup
FooterLink
```

---

# 37. Recommended data schema

```ts
type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  badge?: string;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

type FooterSocial = {
  name: string;
  href: string;
  icon: IconType;
};
```

---

# 38. Feature flags

Some footer items should be conditionally shown.

For example:

```text
Case Studies
Careers
Research
GitHub
Roadmap
Newsletter
```

Don't display empty destinations.

Implementation:

```ts
{
  label: "Case Studies",
  href: "/case-studies",
  enabled: featureFlags.caseStudies
}
```

---

# 39. Status data

Could be modeled as:

```ts
type PlatformStatus =
  | "OPERATIONAL"
  | "DEGRADED"
  | "PARTIAL_OUTAGE"
  | "MAJOR_OUTAGE"
  | "UNKNOWN";
```

Display:

```text
OPERATIONAL
All systems operational

DEGRADED
Degraded performance

PARTIAL_OUTAGE
Partial system outage

MAJOR_OUTAGE
Service disruption

UNKNOWN
View system status
```

---

# 40. Analytics

Track footer engagement.

Examples:

```text
FOOTER_VISIBLE

FOOTER_START_FREE_CLICKED
FOOTER_DOCS_CLICKED

FOOTER_PRODUCT_LINK_CLICKED
FOOTER_SOLUTION_LINK_CLICKED
FOOTER_DEVELOPER_LINK_CLICKED

FOOTER_SECURITY_CLICKED
FOOTER_PRIVACY_CLICKED

FOOTER_STATUS_CLICKED

FOOTER_GITHUB_CLICKED
FOOTER_X_CLICKED
FOOTER_LINKEDIN_CLICKED
```

You don't need a separate unique event for every route if your analytics already captures:

```text
link_text
link_href
link_group
```

Better:

```json
{
  "event": "FOOTER_LINK_CLICKED",
  "group": "developers",
  "label": "Quickstart",
  "href": "/developers/quickstart"
}
```

---

# 41. SEO behavior

Footer links help internal crawling, but don't turn it into a sitemap containing 150 SEO routes.

Footer should expose:

```text
major category pages
important product pages
important trust pages
developer entry points
```

Not every:

```text
/glossary/state-transition
/blog/how-to-test-cart
/compare/vendor-x
```

Those should be linked contextually.

---

# 42. Legal pages

Minimum production-ready footer should eventually include:

```text
Privacy Policy
Terms of Service
Cookie Policy
```

Before significant enterprise adoption:

```text
DPA
Subprocessors
Acceptable Use Policy
Security
```

Because Tellann captures application telemetry and session information, these cannot remain afterthoughts. The platform's own privacy and security specifications already establish strong data-handling requirements.

---

# 43. Cookie settings

Once cookie consent is implemented, the bottom bar should include:

```text
Cookie Settings
```

This should reopen the consent preference panel.

Don't route it to `/legal/cookies`.

These are different:

```text
Cookie Policy
→ document

Cookie Settings
→ actual preference control
```

---

# 44. Language / region selector

I would **not implement this initially**.

Don't add:

```text
English (US) ▾
United States ▾
```

unless the website actually supports localization/regional pricing.

Fake selectors make a young product look unfinished.

---

# 45. Pricing shortcut

Because `/pricing` is commercially important, include it either under Company or as its own visible footer link.

I would actually place:

```text
Pricing
```

under Product or Company.

Given your main navigation already has Pricing, putting it under Company is acceptable.

---

# 46. "Sign in" in footer

Optional.

I would add a small:

```text
Sign in
```

near the CTA or brand block:

```text
Already using Tellann? Sign in →
```

Not necessary in the navigation columns.

---

# 47. Footer conversion logic

The footer journey should be:

```text
Reached bottom
     ↓
Still convinced?
     ↓
Start free
```

or:

```text
Need more proof?
     ↓
Documentation / Security / Pricing
```

or:

```text
Enterprise concern?
     ↓
Security / Enterprise / Contact
```

That means the footer has three conversion pathways:

```text
ADOPT
Start Free

EVALUATE
Docs / Pricing / Security

CONTACT
Enterprise / Contact
```

---

# 48. Pages that should use this footer

The main marketing footer should appear on:

```text
/
 /product/*
 /solutions/*
 /use-cases/*
 /developers/*
 /pricing
 /security/*
 /resources/*
 /blog/*
 /guides/*
 /about
 /contact
 /company/*
 /legal/*
```

---

# 49. Pages that should NOT use it

Do not use this massive footer inside:

```text
app.tellann.co
```

The authenticated product should have its own shell/navigation.

Likewise:

```text
docs.tellann.co
```

may use a simplified docs-specific footer.

---

# 50. Recommended React component structure

Something like:

```text
MarketingFooter
│
├── FooterCTA
│   ├── CTAContent
│   └── CTAActions
│
├── FooterNavigation
│   ├── FooterBrand
│   ├── FooterGroup
│   ├── FooterGroup
│   ├── FooterGroup
│   ├── FooterGroup
│   ├── FooterGroup
│   └── FooterGroup
│
└── FooterBottom
    ├── Copyright
    ├── LegalLinks
    ├── PlatformStatus
    └── SocialLinks
```

For mobile:

```text
FooterGroup
↓
FooterAccordion
```

using the same underlying navigation data.

---

# 51. Final footer information architecture

The final hierarchy should be:

```text
TELLANN
Behavioral Quality Intelligence


PRODUCT
Overview
How It Works
Demonstration Mode
Behavior Graphs
Workflow Discovery
Coverage
Missing Flows
Missing States
Session Replay
Endpoint Intelligence
QA Reports


SOLUTIONS
Developers
QA Engineers
Engineering Leaders
Product Teams
Startups
SaaS


DEVELOPERS
Developer Hub
Quickstart
Documentation
SDKs
API Reference
React
Next.js
Node.js
GitHub
Status


RESOURCES
Blog
Guides
Case Studies
Research
Glossary
Changelog
Roadmap


COMPANY
About
Pricing
Contact
Careers
Brand


TRUST & LEGAL
Security
Privacy
Data Collection
Session Replay Privacy
Enterprise Security
Terms
Cookie Policy
DPA
Subprocessors
Acceptable Use


BOTTOM BAR
© 2026 Tellann
Cookie Settings
System Status
GitHub
X
LinkedIn
```

The central design principle is that a visitor reaching the bottom should **never reach a dead end**. From there they should be able to go deeper into the product, validate Tellann technically, verify how their data is handled, compare pricing, or simply start using it. For Tellann in particular, **Developers and Trust should receive almost the same visual importance as Product**—because the sale depends not only on what the system can discover, but whether an engineering team is willing to let it observe their software in the first place.
