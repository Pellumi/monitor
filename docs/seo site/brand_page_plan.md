`/brand` should be a **public brand reference and asset library**, not another marketing page.

Its purpose is different from `/company`:

```text
/company
Why Tellann exists.

/brand
How Tellann should be represented.
```

A journalist, partner, event organizer, designer, developer, or anyone producing material that mentions Tellann should be able to come here and answer:

**What is the correct logo? Which variant do I use? What are the colors? Which typography is official? How do I describe Tellann? How should screenshots and product visuals look? What am I not allowed to do to the brand? Where can I get approved assets?**

There is also one important discrepancy to resolve before shipping this page: the current `DESIGN.md` defines **Poppins for the human/UI layer and JetBrains Mono for technical/data content**, while earlier Tellann branding discussions considered Satoshi. The public Brand page should not quietly combine both. The current design specification supports Poppins + JetBrains Mono, so either that remains authoritative or the design specification should be updated first if Satoshi has now superseded it. 

# `/brand` — Complete Page Specification

## 1. Primary objectives

The page should support four primary audiences:

```text
Press / media
→ "How do I correctly describe Tellann?"

Partners
→ "Which logo and assets should I use?"

Designers / creators
→ "What are the visual rules?"

Developers
→ "What are Tellann's design tokens and interface conventions?"
```

The user journey becomes:

```text
Visit /brand
     ↓
Understand identity
     ↓
Find correct asset/rule
     ↓
Preview usage
     ↓
Download approved asset
     ↓
Use Tellann consistently
```

---

# 2. Recommended page structure

I would implement:

```text
/brand
│
├── 01 Navigation
├── 02 Brand Hero
├── 03 Quick Asset Bar
├── 04 Brand Essence
├── 05 Logo System
├── 06 Logo Usage Rules
├── 07 Clear Space & Minimum Size
├── 08 Color System
├── 09 Typography
├── 10 Visual Language
├── 11 Iconography
├── 12 Product UI Representation
├── 13 Photography / Imagery
├── 14 Motion
├── 15 Tone of Voice
├── 16 Messaging & Approved Descriptions
├── 17 Naming & Terminology
├── 18 Co-branding
├── 19 Social / Press Assets
├── 20 Asset Downloads
├── 21 Usage / Legal Guidance
├── 22 Brand Contact
└── 23 Footer
```

It is intentionally substantial.

This page becomes the **public-facing version of your brand guideline document**.

---

# 3. Section 01 — Navigation

Normal marketing navigation:

```text
Tellann

Product
Solutions
Developers
Resources
Pricing
Company

                         Sign in
                       Start free
```

Company mega menu:

```text
Company Overview
Careers
Contact
Brand
Roadmap
```

`Brand` active.

---

# 4. Section 02 — Brand hero

This page should immediately display the identity rather than explain it with a wall of text.

### Eyebrow

```text
TELLANN BRAND
```

### H1

> **Built to make invisible behavior visible.**

This ties the identity back to the product without repeating the homepage.

Alternative:

> **The visual language of behavioral intelligence.**

---

## Supporting copy

> These guidelines define how Tellann is represented across product, web, media, partnerships, documentation, and communications.

Then:

```text
[ Download logo assets ]
[ View usage guidelines ]
```

The second button scrolls to `#logo`.

---

# 5. Hero visual

Large centered official Tellann lockup.

Using the logo visible in your current navigation:

```text
      node / graph symbol
              +
          Tellann
```

Animate the symbol very subtly:

```text
nodes appear
   ↓
connections form
   ↓
full Tellann mark resolves
```

No neon particle explosion.

The current design language is explicitly **high-contrast monochrome, minimal, precise, technical, and low-noise**. 

---

# 6. Section 03 — Quick asset bar

Directly below the hero:

```text
LOGOS        COLORS        TYPOGRAPHY        PRESS KIT
  ↓             ↓               ↓                ↓
Download      Copy HEX        Guidelines        Download
```

Example:

```text
[ Logo Pack ↓ ]

#000000
#FFFFFF
[ Copy ]

Poppins
JetBrains Mono

[ Media Kit ↓ ]
```

These are convenience actions.

The detailed rules come later.

---

# 7. Section 04 — Brand essence

Heading:

> **What Tellann should feel like.**

The existing design system describes the aesthetic as **Premium Technical**: precise, authoritative, clinical yet sophisticated, minimalist, with subtle glass-like depth rather than decorative noise. 

I would distill that publicly into four pillars.

### Precise

> Every element should appear intentional.

### Technical

> Tellann should feel native to engineering environments.

### Controlled

> Information has hierarchy. Nothing competes unnecessarily.

### Intelligent

> Complexity is exposed clearly rather than disguised with visual spectacle.

---

# 8. Brand personality matrix

Use something like:

```text
WE ARE                           WE ARE NOT

Technical                        Sci-fi fantasy
Precise                          Sterile
Confident                        Loud
Minimal                          Empty
Sophisticated                    Decorative
Evidence-driven                  Hype-driven
Developer-focused                Developer-clichéd
```

This is much more useful to external designers than vague adjectives.

---

# 9. Section 05 — Logo system

Anchor:

```text
#logo
```

Heading:

> **The Tellann mark.**

Introduce the logo as a system rather than a single SVG.

I would define the following approved structures.

### A. Primary horizontal lockup

```text
[ SYMBOL ] Tellann
```

This should be the default.

Uses:

* website navigation;
* presentations;
* press material;
* partner pages;
* documentation headers.

---

## B. Symbol only

```text
[ SYMBOL ]
```

Uses:

* favicon;
* application icon;
* avatars;
* small product surfaces;
* social profile;
* watermark.

---

## C. Wordmark only

```text
Tellann
```

Use where the symbol is already strongly implied or horizontal space is extremely constrained.

Do not make this the primary variant.

---

## D. Stacked lockup

Potentially:

```text
       [ SYMBOL ]

         Tellann
```

Useful for:

* square assets;
* conference material;
* cover pages;
* centered media.

Only include this if you formally approve it as a real logo variant.

---

# 10. Light and dark variants

Because Tellann is monochrome, the system is simple.

### Dark surface

```text
White mark
Black / near-black background
```

### Light surface

```text
Black mark
White / near-white background
```

Preview both.

The design specification's core visual palette is monochrome and depends on luminance hierarchy rather than colorful brand accents. 

---

# 11. Logo asset cards

Each variant:

```text
PRIMARY LOCKUP

Preview

[ SVG ]
[ PNG ]
```

For example:

```text
Symbol — Dark
Symbol — Light
Horizontal — Dark
Horizontal — Light
```

SVG should be the recommended format.

PNG is provided for compatibility.

You can also provide:

```text
WebP
```

if useful.

---

# 12. Never expose random internal files

The public download package should contain only approved exports.

For example:

```text
tellann-brand-assets.zip

/logos
    /svg
    /png

/icons
    favicon.svg
    favicon-32.png
    app-icon.png

/social
    social-card.png

/brand-guide
    tellann-brand-guidelines.pdf
```

Do not simply expose an internal `/assets` directory.

---

# 13. Section 06 — Logo usage

Heading:

> **Keep the mark intact.**

Show correct and incorrect examples visually.

### Correct

```text
✓ Use approved monochrome versions.

✓ Maintain clear space.

✓ Preserve proportions.

✓ Use adequate contrast.

✓ Use official asset files.
```

---

# 14. Incorrect usage

Cards:

```text
✕ Do not stretch.

✕ Do not rotate.

✕ Do not add shadows.

✕ Do not add gradients.

✕ Do not recolor individual nodes.

✕ Do not outline the wordmark.

✕ Do not place inside arbitrary shapes.

✕ Do not reconstruct it manually.

✕ Do not alter node positions.

✕ Do not combine with another symbol.
```

Particularly important for Tellann: don't allow the node mark to become a generic "network" icon through modifications.

---

# 15. Logo misuse visual grid

Something like:

```text
Correct             Stretched
[✓]                  [✕]

Correct             Gradient
[✓]                  [✕]

Correct             Glow
[✓]                  [✕]

Correct             Rotated
[✓]                  [✕]
```

These visuals teach faster than prose.

---

# 16. Section 07 — Clear space

Define a simple measurement unit based on the mark itself.

For example:

```text
x = diameter of one primary logo node
```

Then:

```text
        X

X   [ TELLANN LOGO ]   X

        X
```

But don't invent the exact measurement if the logo geometry hasn't formally established one yet.

The Brand page should consume a canonical clear-space rule from your logo specification.

If none exists, create it before publication.

---

# 17. Minimum size

Define separately:

```text
Digital

Horizontal logo:
Minimum width: [approved px]

Symbol:
Minimum width: [approved px]


Print

Horizontal:
[approved mm]

Symbol:
[approved mm]
```

Again, don't invent these numbers without testing actual logo legibility.

---

# 18. Section 08 — Color system

This should directly represent the current monochrome system.

Heading:

> **Luminance is the accent.**

This is an excellent conceptual phrase because the design specification explicitly defines hierarchy through brightness. 

---

# 19. Core public palette

At minimum:

### Pure Black

```text
#000000

Primary dark canvas.
```

### Charcoal

```text
#262626

Secondary surfaces and containers.
```

### Neutral Accent

```text
#757575

Secondary metadata, inactive states,
subtle borders.
```

### Highlight White

```text
#FFFFFF

Primary text, high-priority controls,
critical visual emphasis.
```

These four are explicitly identified in the current design guide. 

---

# 20. Extended interface palette

Since the actual UI system uses more nuanced surface tokens, include an expandable:

> **Interface neutrals**

For example:

```text
Surface              #131313
Surface Low          #1B1B1B
Surface              #1F1F1F
Surface High         #2A2A2A
Surface Highest      #353535

On Surface           #E2E2E2
On Surface Variant   #C4C7C8

Outline              #8E9192
Outline Variant      #444748
```

These are defined in the current design system. 

Externally, people usually only need the four core brand colors.

Internally, developers/designers may want the complete token system.

---

# 21. Color interaction

Every color card:

```text
PURE BLACK

#000000

RGB 0, 0, 0

[ Copy HEX ]
```

Optional:

```text
CSS variable
--brand-black
```

Do not overwhelm press visitors with design-token data by default.

Put developer data behind:

```text
View design tokens
```

---

# 22. Semantic colors

The UI specification does include an error palette, such as `#FFB4AB`, but these are **interface semantics**, not Tellann brand colors. 

Make that distinction explicit:

```text
Brand palette
≠
Application status palette
```

Otherwise external designers may start using error-red in advertisements as a Tellann brand color.

---

# 23. Section 09 — Typography

Heading:

> **Human language. Machine language.**

This is one of the strongest parts of the current design system.

The existing design specification defines a dual-font approach:

```text
Poppins
Human layer

JetBrains Mono
Machine layer
```



---

# 24. Poppins

Use for:

```text
Headlines
Body copy
Navigation
Buttons
Instructions
Marketing
General UI
```

Example:

> Understand how your software actually behaves.

Show:

```text
Poppins SemiBold
ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789
```

---

# 25. JetBrains Mono

Use for:

```text
IDs
timestamps
event names
metrics
logs
API values
technical metadata
code-like interfaces
```

Example:

```text
SESSION_STARTED
wf_checkout_01
2026-08-29T02:31:14Z
coverage: 72%
```

Show it directly beside Poppins so the contrast is clear.

---

# 26. Typography hierarchy

Public brand guidance:

```text
Display / Hero
Poppins 600

Section heading
Poppins 600

Body
Poppins 400

Navigation
Poppins 500

CTA
Poppins 500

Technical labels
JetBrains Mono 400–500
```

The current design tokens specifically define Poppins headline/body weights and JetBrains Mono data styles. 

---

# 27. Important font-download rule

The public Tellann Brand page should **not distribute font files**.

Instead:

```text
Typography
Poppins
JetBrains Mono

View licensing / official font source →
```

where appropriate.

Your asset zip should contain logos and brand exports—not `.ttf`, `.otf`, or proprietary/local font binaries.

---

# 28. Resolve the Satoshi question

Before shipping `/brand`, make an explicit branding decision.

You currently have two possible systems:

### Option A — Current `DESIGN.md`

```text
Poppins
+
JetBrains Mono
```

### Option B — newer brand direction if formally adopted

```text
Satoshi
+
technical companion font
```

Do not create:

```text
Logo: Satoshi
Marketing: Poppins
Product: another font
Documentation: JetBrains
```

without a deliberate rationale.

That quickly becomes incoherent.

My recommendation, based strictly on the current canonical design file, is:

```text
Poppins
Human

JetBrains Mono
Machine
```

until the source design system itself is revised. 

---

# 29. Section 10 — Visual language

Heading:

> **Technical without becoming theatrical.**

This section explains what a Tellann visual should look like.

Core rules from the design system:

```text
High contrast
Monochrome
Minimal
Structured
Low visual noise
Subtle depth
Precise geometry
Technical information hierarchy
```



---

# 30. Surface system

Visual example:

```text
LEVEL 0

#000000
Infinite canvas


LEVEL 1

#262626
Cards / containers


LEVEL 2

#333333
Popovers / elevated surfaces
```

Depth comes primarily from:

```text
tonal separation
+
thin borders
```

not drop shadows. 

---

# 31. Shapes

Public guidance:

```text
Soft-Technical
```

Examples:

```text
Cards / buttons / inputs
≈ 4px radius

Tags
≈ 2px radius

Pills
only when semantics warrant it
```

The current design system deliberately uses restrained radii rather than very rounded SaaS components. 

---

# 32. Avoid generic SaaS visuals

Explicitly show:

```text
AVOID

Huge 24px card radii

Rainbow gradients

Purple/blue AI glows

Blob backgrounds

3D floating glass spheres

Excessive drop shadows

Generic robot brains

Random neural networks

Decorative grids without meaning
```

Tellann is not "AI magic."

Its design should look like **evidence, structure, systems, and observation**.

---

# 33. Section 11 — Iconography

Heading:

> **Icons should explain, not decorate.**

Rules:

```text
Simple line icons
Consistent stroke
Minimal detail
Optical alignment
Monochrome
```

The design specification recommends approximately a 2px icon stroke with subtly rounded terminals. 

Use icons for concepts such as:

```text
Workflow
Session
Coverage
Graph
Endpoint
Report
Security
Application
```

Avoid using icons just to fill empty card space.

---

# 34. Section 12 — Product representation

This is particularly important.

Partners and press will want screenshots.

Heading:

> **Showing the product.**

Provide approved product screenshots or mockups.

Categories:

```text
Dashboard
Behavior Graph
Session Replay
Coverage
Reports
Desktop
```

Each:

```text
[ screenshot ]

Tellann Behavior Graph

[ Download PNG ]
```

---

# 35. Screenshot rules

Explain:

```text
✓ Use current product screenshots.

✓ Preserve UI proportions.

✓ Keep meaningful context around the feature.

✓ Hide or replace customer-sensitive information.

✓ Use realistic but non-sensitive demo data.

✓ Prefer dark-mode screenshots if that is the canonical presentation.
```

---

# 36. Product screenshot misuse

Don't:

```text
✕ alter UI colors

✕ fabricate metrics

✕ add fake features

✕ crop so tightly the UI is misleading

✕ expose customer data

✕ show unreleased functionality as available
```

The last one matters given Tellann's multi-phase roadmap.

Phase 2/3 concepts must not be presented as current production capabilities. 

---

# 37. Section 13 — Imagery

Tellann does not need conventional corporate photography as its primary visual language.

Define preferred image categories:

### Product

Actual Tellann interfaces.

### Systems

Abstract but meaningful behavioral structures:

```text
nodes
transitions
paths
state maps
event streams
```

### Technical

Code, environments, system structures—but only where contextually relevant.

### People

When used, prefer authentic photography of real Tellann people/events later rather than generic stock developers.

---

# 38. Image treatment

Tellann photography could use:

```text
High contrast
Neutral / desaturated
Restrained framing
Clean negative space
```

Do not over-process every photo into cyberpunk imagery.

---

# 39. Section 14 — Motion

Heading:

> **Motion should reveal behavior.**

Excellent principle for Tellann.

Animations should explain:

```text
State changes
Transitions
Workflow formation
Graph construction
Event progression
Analysis completion
```

Rather than:

```text
decorative movement
```

---

# 40. Motion examples

Good:

```text
Node A
   │
   ├──── event
   ▼
Node B
```

Good:

```text
Events → Session → Graph
```

Bad:

```text
random floating dots
```

---

# 41. Motion rules

```text
Fast enough to feel precise

Slow enough to understand

No unnecessary bouncing

No elastic cartoon physics

Respect prefers-reduced-motion

Transitions should communicate cause
```

---

# 42. Section 15 — Tone of voice

This should be one of the most useful sections.

Heading:

> **Clear enough for developers. Human enough for everyone else.**

I would define Tellann's voice as:

```text
Precise
Calm
Technical
Evidence-driven
Confident
Direct
Explanatory
```

---

# 43. Voice matrix

```text
WE SOUND                       NOT

Confident                      Arrogant
Technical                      Jargon-heavy
Concise                        Cryptic
Intelligent                    Pretentious
Ambitious                      Hype-driven
Human                          Casual/sloppy
Precise                        Bureaucratic
```

---

# 44. Writing principles

### Say what the product does

Good:

> Tellann maps observed application workflows.

Bad:

> Tellann revolutionizes the very fabric of software intelligence.

---

### Distinguish evidence from inference

Good:

> Tellann observed seven checkout paths.

Better than:

> Your checkout is fully understood.

when evidence doesn't justify that.

This is especially aligned with the product's emphasis on explainability and evidence.

---

### Do not overclaim AI

Current MVP positioning specifically avoids presenting Tellann as autonomous or AI-driven testing. 

Bad:

> AI autonomously tests your entire application.

Current:

> Demonstrate your application and Tellann turns observed behavior into workflow and coverage intelligence.

---

# 45. Section 16 — Messaging

Heading:

> **How to describe Tellann.**

This section gives approved copy people can reuse.

---

# 46. One-line description

Recommended:

> **Tellann is a behavioral quality intelligence platform for software teams.**

This matches the product's intended category. 

---

# 47. Short description

> Tellann observes application behavior, models software workflows, measures behavioral coverage, and helps engineering teams identify missing states, flows, and quality gaps.

This is grounded in the current MVP capabilities. 

---

# 48. Medium description

Something like:

> Tellann is a behavioral quality intelligence platform that helps software teams understand how applications actually behave. Developers can demonstrate an application, after which Tellann reconstructs sessions, discovers states and workflows, builds behavioral graphs, measures coverage, identifies missing states and flows, analyzes endpoint behavior, and generates QA reports.

Again, entirely Phase 1-safe. 

---

# 49. Mission statement

You can expose the canonical mission:

> **Help software teams discover, understand, and resolve quality issues before they impact users by transforming application behavior into continuously evolving quality intelligence.**



---

# 50. Vision statement

> **To become the intelligence layer that enables software applications to understand, evaluate, and communicate their own operational quality.**



Mark it as:

```text
VISION
```

not current product functionality.

---

# 51. Taglines

The brand page should define a **small approved set**, not twenty interchangeable taglines.

For example:

### Brand thesis

> Software should be able to explain its own quality.

### Product

> Understand how your software actually behaves.

### Demonstration Mode

> Demonstrate once. See what you missed.

### Developer-focused

> Turn application behavior into quality evidence.

They should have specified usage contexts.

---

# 52. Section 17 — Naming conventions

Heading:

> **Naming Tellann correctly.**

Define:

```text
Correct:
Tellann

Incorrect:
TELLANN
TellAnn
Tell Ann
tellann
```

Exception:

`TELLANN` can be used intentionally in small technical labels if that is part of the UI design language, but the written company/product name remains:

```text
Tellann
```

---

# 53. Product naming

Define canonical names:

```text
Tellann

Tellann Desktop

Developer Demonstration Mode

Behavior Graph

Session Replay

Workflow Coverage

Endpoint Intelligence
```

Avoid external teams inventing:

```text
Tellann AI
Tellann QA AI
Tellann Analytics
Tellann Monitor
```

unless those become actual product names.

---

# 54. Acronyms

I would discourage external use of old internal naming such as:

```text
SOTS
```

The public brand is Tellann.

The PRD may retain historical/internal terminology, but `/brand` should establish the outward-facing name clearly.

---

# 55. Section 18 — Co-branding

This becomes useful when Tellann works with partners.

Heading:

> **Tellann alongside other brands.**

Show:

```text
[ Partner Logo ]   ×   [ Tellann ]
```

or:

```text
Partner Logo       Tellann
```

Rules:

```text
Equal optical scale

Adequate separation

No merging logos

No shared gradient

No "powered by" without approval

No changing Tellann mark to partner colors
```

---

# 56. Partnership lockup

If you eventually support:

```text
Powered by Tellann
```

it should have an official supplied lockup.

External users should not typeset their own.

---

# 57. Section 19 — Social / press assets

Provide:

```text
X profile asset
LinkedIn asset
Open Graph cover
Press image
Presentation cover
Product screenshot set
```

Potential categories:

```text
Social
Press
Events
Presentations
Partnerships
```

---

# 58. Presentation templates

Eventually provide:

```text
Tellann title slide
Section slide
Product screenshot slide
Diagram slide
Closing slide
```

But only when they actually exist.

Don't make `/brand` promise a "Presentation Kit" with no assets behind it.

---

# 59. Section 20 — Downloads

Anchor:

```text
#downloads
```

Heading:

> **Approved assets.**

Suggested asset groups:

```text
LOGOS
[ Download logo pack ]

PRODUCT
[ Download approved screenshots ]

PRESS
[ Download media kit ]

GUIDELINES
[ Download brand guidelines ]
```

---

# 60. Asset metadata

Every package should show:

```text
Logo Pack
ZIP · 2.4 MB
Updated Aug 2026

Contains SVG and PNG exports.
```

Versioning matters.

You don't want outdated logos floating around forever.

---

# 61. Brand asset versioning

Implement:

```text
Brand version
Updated
Change notes
```

Potentially:

```text
Brand assets v1.2
Updated 29 Aug 2026
```

Then if the logo changes:

```text
Deprecated assets
```

should no longer be promoted.

---

# 62. Asset API/data model

Don't hardcode downloads everywhere.

```ts
interface BrandAsset {
  id: string;
  category:
    | "LOGO"
    | "SOCIAL"
    | "PRODUCT"
    | "PRESS"
    | "GUIDELINE";

  name: string;
  description: string;

  fileUrl: string;
  fileType: string;
  fileSize?: number;

  variant?: "LIGHT" | "DARK";

  version: string;
  updatedAt: string;
}
```

---

# 63. Section 21 — Usage guidance

Heading:

> **Using Tellann in external material.**

Simple rule:

> You may use the provided Tellann assets to accurately refer to Tellann, subject to these brand guidelines. Use does not imply endorsement, partnership, sponsorship, or affiliation unless explicitly agreed.

The final legal wording should eventually be reviewed as part of the actual corporate/legal implementation.

Don't invent a trademark policy if none exists yet.

---

# 64. Trademark indicators

If/when Tellann's trademark status is formally established:

```text
Tellann®
Tellann™
```

can be addressed here.

Until then, do not casually put `®` next to the logo.

That symbol carries a specific legal claim.

---

# 65. Section 22 — Brand contact

Heading:

> **Not sure whether your use fits?**

Copy:

> For press, partnership, or brand-use questions, contact the Tellann team.

```text
[ Contact Tellann ]
```

→

```text
/contact?reason=press
```

or partnership depending on context.

---

# 66. Footer

Normal marketing footer.

Company:

```text
Company Overview
Careers
Contact
Brand
Roadmap
```

`Brand` active.

---

# 67. Recommended desktop layout

The page should feel almost like an interactive design manual:

```text
NAV
────────────────────────────────────

BRAND HERO

        [ Tellann Logo ]

Built to make invisible
behavior visible.

[ Download assets ]

────────────────────────────────────

BRAND ESSENCE

Precise
Technical
Controlled
Intelligent

────────────────────────────────────

LOGO

Primary lockup

[ big visual ]

Symbol       Wordmark       Stack

────────────────────────────────────

LOGO USAGE

Correct        Incorrect
✓              ✕

────────────────────────────────────

CLEAR SPACE / SIZE

────────────────────────────────────

COLOR

BLACK     CHARCOAL     GREY     WHITE

────────────────────────────────────

TYPOGRAPHY

HUMAN                      MACHINE

Poppins                    JetBrains Mono

Understand...              SESSION_STARTED

────────────────────────────────────

VISUAL LANGUAGE

Surfaces
Shapes
Icons
Motion

────────────────────────────────────

PRODUCT REPRESENTATION

Dashboard
Graph
Replay
Reports

────────────────────────────────────

VOICE

Precise
Calm
Evidence-driven

────────────────────────────────────

MESSAGING

One line
Short
Medium
Mission
Vision

────────────────────────────────────

CO-BRANDING

────────────────────────────────────

DOWNLOADS

Logo Kit
Press Kit
Screenshots
Guidelines

────────────────────────────────────

BRAND CONTACT

────────────────────────────────────

FOOTER
```

---

# 68. Optional desktop section navigation

Because `/brand` will be long, I would implement a sticky secondary index on large screens:

```text
Brand
│
├── Logo
├── Color
├── Type
├── Visuals
├── Voice
├── Messaging
└── Downloads
```

Or horizontally:

```text
Overview  Logo  Color  Typography  Voice  Downloads
```

Selecting an item scrolls to its section.

This page benefits from it more than most marketing pages.

---

# 69. Mobile layout

Use:

```text
Hero
↓
Quick downloads
↓
Brand essence
↓
Logo
↓
Logo rules
↓
Colors
↓
Typography
↓
Visual system
↓
Product screenshots
↓
Voice
↓
Messaging
↓
Downloads
↓
Contact
↓
Footer
```

Avoid side-by-side misuse examples below ~768px.

Stack them:

```text
Correct
[example]

Don't
[example]
```

---

# 70. Color-copy interaction

Mobile:

```text
Pure Black

████████████████
#000000

[ Copy ]
```

Tapping gives:

```text
Copied #000000
```

Don't rely only on clipboard APIs silently.

---

# 71. Accessibility

This page is highly visual, so accessibility matters.

All logo examples should include text labels.

Color cards should show the value as text.

Don't present:

```text
■ ■ ■ ■
```

and expect users to distinguish colors visually.

Logo misuse examples should say:

```text
Incorrect: stretched logo
```

rather than relying only on red crosses.

---

# 72. SEO

Suggested title:

```text
Tellann Brand — Logos, Colors & Brand Guidelines
```

Meta:

```text
Official Tellann brand resources, including logo usage, colors, typography, product imagery, approved messaging, and downloadable media assets.
```

Canonical:

```text
https://tellann.co/brand
```

---

# 73. Analytics

Track:

```text
BRAND_PAGE_VIEWED

BRAND_LOGO_SECTION_VIEWED
BRAND_COLOR_COPIED
BRAND_ASSET_DOWNLOADED

BRAND_LOGO_PACK_DOWNLOADED
BRAND_MEDIA_KIT_DOWNLOADED
BRAND_SCREENSHOT_DOWNLOADED

BRAND_CONTACT_CLICKED
```

Asset event metadata:

```text
asset_id
asset_category
asset_version
```

Don't need user PII.

---

# 74. Component architecture

```text
BrandPage
│
├── MarketingNavbar
├── BrandHero
├── BrandQuickActions
├── BrandEssence
├── LogoSystem
│   ├── LogoVariant
│   ├── ClearSpaceGuide
│   ├── MinimumSizeGuide
│   └── LogoMisuseGrid
├── ColorSystem
│   └── ColorToken[]
├── TypographySection
│   ├── HumanTypography
│   └── MachineTypography
├── VisualLanguage
├── IconographySection
├── ProductRepresentation
├── ImageryGuidelines
├── MotionGuidelines
├── VoiceSection
├── MessagingSection
├── NamingSection
├── CoBrandingSection
├── BrandDownloads
├── BrandUsageNotice
├── BrandContact
└── MarketingFooter
```

---

# 75. What should be implemented immediately

For the first proper `/brand`, I would ship:

```text
✓ Hero
✓ Brand essence

✓ Primary logo
✓ Symbol
✓ Light/dark variants
✓ Logo download

✓ Correct/incorrect logo usage
✓ Clear-space rule
✓ Minimum sizes

✓ Core colors
✓ Extended interface colors

✓ Typography
✓ Typography hierarchy

✓ Visual direction
✓ Shape language
✓ Icon rules
✓ Motion principles

✓ Tone of voice
✓ Approved descriptions
✓ Mission
✓ Vision
✓ Naming rules

✓ Product screenshots
✓ Download section
✓ Contact path
✓ Footer
```

Potentially delay:

```text
Presentation templates
Partner templates
Extensive photography guidance
Trademark policy
Press kit
Social templates
```

until the actual assets/processes exist.

---

# 76. One thing I would resolve before implementation

The `/brand` page is where inconsistencies become public, so **the brand source of truth needs to be locked first**.

At present, the strongest actual design artifact I can find specifies:

```text
Visual identity
Premium Technical
Monochrome
Minimal
High contrast

Brand/UI type
Poppins

Technical type
JetBrains Mono

Primary brand colors
#000000
#262626
#757575
#FFFFFF
```



That differs from the earlier Satoshi direction. I would not allow `/brand`, the marketing site, and the Tellann product to each tell a different story about typography. Decide which document is now canonical, update the design tokens, and then make `/brand` render from that same source of truth.

Once that is settled, this page becomes more than a place to download a logo: it becomes the **public contract for how Tellann looks, sounds, and is described everywhere outside the product.**
