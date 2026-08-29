The `/desktop` page should become the **canonical product page for Tellann Desktop**. It should explain the desktop application's role, show how the local execution layer works, demonstrate the experience visually, establish trust around repository access, and then move the visitor toward `/desktop/download`.

It should **not** become an installation manual, release archive, or full security document. Those belong to `/desktop/download`, `/desktop/releases`, `/desktop/security`, and `/desktop/requirements`.

The underlying desktop direction supports this positioning: Tellann Desktop is intended to own local workspace access, repository scanning, managed-browser QA runs, instrumentation operations, local permissions, and local artifact preparation, while the cloud remains authoritative for organization/application state, accepted graphs, reports, billing, audit, and collaboration. 

There is one important implementation constraint: the current desktop plan is **Windows-first and browser-first**. Guided QA runs and read-only repository analysis precede automatic instrumentation; automatic code modification comes later. The marketing page must therefore derive badges such as `Available`, `Beta`, and `Coming later` from the actual shipping version rather than presenting the entire desktop roadmap as currently available. 

---

# `/desktop` — Complete Page Specification

## 1. Primary purpose

The page needs to answer, in order:

```text
What is Tellann Desktop?

Why does Tellann need a desktop application?

What does it do with my project?

How does the local project connect to Tellann?

What can it detect?

What happens during a QA run?

Can it modify my code?

What remains local?

Can I trust it?

Will it work with my stack?

How do I get it?
```

The narrative should therefore be:

```text
INTRODUCE
     ↓
SHOW PRODUCT
     ↓
EXPLAIN LOCAL ROLE
     ↓
CONNECT PROJECT
     ↓
UNDERSTAND WORKSPACE
     ↓
RUN QA
     ↓
REVIEW / INSTRUMENT
     ↓
LOCAL ↔ CLOUD BOUNDARY
     ↓
SECURITY
     ↓
COMPATIBILITY
     ↓
DOWNLOAD
```

---

# 2. Page architecture

```text
/desktop
│
├── 01 Global Navbar
├── 02 Desktop Hero
├── 03 Product Proof / Status Strip
├── 04 Why Tellann Desktop Exists
├── 05 Connect Your Project
├── 06 Workspace Intelligence
├── 07 Guided QA Runs
├── 08 From Expected Behavior to Evidence
├── 09 Review Before Tellann Changes Anything
├── 10 Desktop + Cloud Architecture
├── 11 Privacy / Local Trust Boundary
├── 12 Supported Ecosystem
├── 13 Desktop Product Gallery
├── 14 Current Release
├── 15 Desktop FAQ
├── 16 Final Download CTA
└── 17 Global Footer
```

At 1440px desktop, I would target roughly **8,500–10,000px page height**. It should feel substantial but not like documentation.

---

# 3. Global page dimensions

### Content shell

```text
Maximum page width       1440px
Primary content width    1280px
Text content width       640–760px
Wide media width         1180–1280px
Section padding desktop  112–144px vertical
Section padding tablet   80–96px
Section padding mobile   64–72px

Horizontal padding
Desktop                  64–80px
Tablet                   40px
Mobile                   20–24px
```

Use the current monochrome Tellann design:

```text
Background       near-black / black
Primary text     near-white
Secondary text   neutral grey
Borders          #262626-ish neutral
Surface          dark neutral
Bright accent    mostly white
Status colors    only when semantically necessary
```

Desktop should not become a Windows-blue sub-brand.

---

# 4. Section 01 — Global navbar

Reuse the global marketing navbar.

Desktop will be discoverable from:

```text
Product
└── Desktop app
```

The route's nav state should highlight **Product**, not Developers.

Right side remains:

```text
Sign in
Book demo
Start free
```

No special Desktop-only navbar.

---

# 5. Section 02 — Hero

This is the most important section visually.

## Layout

Desktop ≥ 1200px:

```text
┌───────────────────────────────────────────────┐
│                                               │
│                TELLANN DESKTOP                │
│                                               │
│     Bring Tellann closer to your code.        │
│                                               │
│  Connect your local project, understand its   │
│  structure and run Tellann from the            │
│  environment where you build.                  │
│                                               │
│ [Download for Windows] [See how it works]     │
│                                               │
│ Windows · Current stable vX.X.X               │
│                                               │
│        ┌──────────────────────────────┐        │
│        │                              │        │
│        │      DESKTOP UI MEDIA        │        │
│        │                              │        │
│        └──────────────────────────────┘        │
│                                               │
└───────────────────────────────────────────────┘
```

Centered hero rather than a 50/50 split.

Why? The desktop application itself becomes the visual protagonist.

---

## Hero typography

Eyebrow:

```text
TELLANN DESKTOP
12–14px
uppercase
letter-spacing: 0.12–0.16em
```

H1:

```text
Desktop: 72–88px
Tablet:  56–64px
Mobile:  42–48px
Max width: 920px
Line height: 0.98–1.05
```

Suggested direction:

> **Bring Tellann closer to your code.**

Supporting copy:

> Connect your local project, understand its structure, run guided QA sessions, and keep sensitive development operations under your control.

Maximum:

```text
640–720px
18–20px
line-height 1.55
```

---

# 6. Hero CTAs

Primary:

```text
Download for Windows
```

Secondary:

```text
See how it works
```

Primary button should be OS-aware.

If visiting from unsupported/mobile OS:

```text
Download Tellann Desktop
```

rather than pretending the device itself can install it.

Underneath:

```text
Windows · x64 · Stable v1.x.x
```

Values must come from the release manifest.

---

# 7. Hero media

I would use a **real product video loop** as the main hero asset once sufficient UI exists.

Until then use a high-resolution screenshot.

### Source video

```text
Source resolution:   1600 × 1000px
Aspect ratio:        16:10
Frame rate:          30fps
Duration:            10–14 seconds
Codec:               WebM primary
Fallback:            H.264 MP4
Audio:               None
Autoplay:            yes
Muted:               yes
Loop:                 yes
Controls:             no
```

Displayed:

```text
Desktop:
1180 × 738px approximately

Tablet:
calc(100vw - 80px)

Mobile:
full container width
```

Do not crop the UI.

---

# 8. Hero video storyboard

The sequence should be slow enough to understand:

```text
0.0s
Tellann Desktop — Projects

2.0s
User chooses "Attach local folder"

4.0s
Workspace analysis begins

6.0s
React / Next.js / pnpm / Git detected

8.0s
Project overview appears

10.0s
"Ready for QA run"

12.0s
Return to opening frame
```

Avoid cursor flying around the screen.

Avoid fake terminal output.

Avoid showing automatic source modification in the hero unless it is actually available in the public build.

---

# 9. Hero application frame

Wrap screenshot/video in a realistic desktop-window treatment:

```text
Border radius:       14–18px
Outer border:        1px neutral
Shadow:              extremely soft
Chrome/header:       actual app chrome
```

Do not add fake macOS traffic-light controls to a Windows-first product.

Use the application's real window chrome.

---

# 10. Hero ambient animation

Behind the application screenshot, use a faint architecture motif:

```text
local/
   ├─ src/
   ├─ package.json
   ├─ routes/
   └─ tests/

          ↓

      Tellann
```

Very subtle.

Opacity:

```text
3–7%
```

Animation:

```text
nodes drift or resolve
6–10 second cycle
```

Not glowing neon lines.

---

# 11. Section 03 — Product status strip

Immediately beneath hero.

Purpose: explain what the user is looking at.

Layout:

```text
┌────────────┬────────────┬────────────┬────────────┐
│ Windows    │ Local      │ Guided QA  │ Cloud      │
│ Desktop    │ Workspace  │ Runs       │ Connected  │
└────────────┴────────────┴────────────┴────────────┘
```

Possible current states:

```text
Windows-first
Read-only workspace analysis
Guided QA runs
Tellann cloud connection
```

These align with the browser-first Windows direction in the desktop plan. 

Dimensions:

```text
Container width: 1280px
Height:          110–130px
4 equal columns
```

Mobile:

```text
2 × 2 grid
```

No images required.

---

# 12. Section 04 — Why Tellann Desktop exists

## Heading

> **Some parts of software can only be understood where the software lives.**

Copy explains that the browser/cloud cannot safely inspect arbitrary local repositories, control local development processes or perform bounded source operations.

---

## Layout

Desktop:

```text
40% text
60% architecture visual
```

```text
┌───────────────────┬───────────────────────────────┐
│                   │                               │
│ Heading + copy    │       Architecture image      │
│                   │                               │
│ Learn security →  │                               │
│                   │                               │
└───────────────────┴───────────────────────────────┘
```

---

# 13. Architecture visual #1

Create a custom SVG rather than a raster image.

### Source

```text
Canvas: 1400 × 900
Aspect ratio: 14:9
Format: SVG
```

Displayed:

```text
700–760px wide
```

Diagram:

```text
YOUR COMPUTER

Repository
    │
    ├──── Git state
    ├──── package manager
    ├──── frameworks
    ├──── routes
    ├──── endpoints
    └──── documentation
          │
          ▼
   TELLANN DESKTOP
          │
          ▼
Approved derived data
          │
          ▼

TELLANN CLOUD

Application
Intent
Runs
Reports
Collaboration
```

The separation mirrors the desktop specification: local repository execution belongs to Desktop; shared application and report state remains cloud-authoritative. 

---

# 14. Architecture animation

Animate only the data path.

Sequence:

```text
Repository node appears
      ↓
Scanner nodes resolve
      ↓
Desktop surface resolves
      ↓
A small "derived data" packet
travels toward Tellann Cloud
```

Duration:

```text
4.5–6 seconds
```

Run once when entering viewport.

Do not loop continuously.

Respect:

```css
prefers-reduced-motion
```

---

# 15. Section 05 — Connect your project

This section moves from concept to actual workflow.

Heading:

> **Connect the project you already have.**

Supporting copy should mention supported working modes from the desktop specification:

* local folder,
* cloned repository,
* development URL,
* preview/staging URL,
* browser-only mode. 

---

# 16. Connect-project workflow visual

Use an interactive 4-step product sequence.

Desktop:

```text
[1 Attach] → [2 Analyze] → [3 Review] → [4 Ready]

                ↓

           MAIN SCREENSHOT
```

Tabs should swap screenshots.

Not a carousel that automatically changes while the user reads.

---

# 17. Screenshot set — project connection

### Screenshot A — Attach project

Show:

```text
Open local project
Clone repository
Attach development URL
Attach staging URL
Browser-only
```

Source:

```text
1440 × 900
```

Displayed:

```text
960 × 600
```

---

### Screenshot B — Permission prompt

Show:

```text
Tellann wants read access to:
C:\...\commerce-app

Allowed:
✓ Read project structure
✓ Analyze configuration
✓ Detect frameworks

Not allowed:
— Modify files
— Run commands
— Upload raw source

[Allow read access]
[Continue browser-only]
```

This is grounded in the documented permission model: initial attachment requests browser-only/read-workspace access rather than write/command access. 

Source:

```text
1280 × 800
```

Displayed:

```text
840 × 525
```

---

### Screenshot C — Workspace detected

Show:

```text
React
Next.js
TypeScript
pnpm
Git branch: main
23 routes
14 API endpoints
12 tests
```

The proposed scanner explicitly analyzes Git state, package managers, languages/frameworks, entry points, scripts, routes, endpoints, controllers/middleware, schemas, tests and repository documentation without executing project scripts. 

---

### Screenshot D — Ready

Show project overview:

```text
Workspace       Ready
Intent          Not reviewed
Instrumentation Browser-only
QA Runs         Ready
```

CTA:

```text
Start QA run
```

---

# 18. Screenshot interaction

When switching steps:

```text
old screenshot:
opacity 1 → 0
translateY 0 → 6px

new screenshot:
opacity 0 → 1
translateY 8px → 0

duration:
240–320ms
```

Do not slide the entire 960px image across the screen.

---

# 19. Section 06 — Workspace intelligence

Heading:

> **Know what Tellann sees before anything changes.**

This section should highlight read-only analysis.

Use a dark code/workspace visualization.

---

# 20. Workspace visual layout

Desktop:

```text
┌──────────────────────────────────────────────┐
│ Repository                                   │
│                                              │
│ commerce-app                                 │
│ ├─ app/                                      │
│ ├─ components/                               │
│ ├─ package.json         ─────► Next.js       │
│ ├─ pnpm-lock.yaml       ─────► pnpm          │
│ └─ tsconfig.json        ─────► TypeScript    │
│                                              │
│ Detected                                     │
│ Next.js · TypeScript · pnpm · Git            │
└──────────────────────────────────────────────┘
```

Source:

```text
1440 × 900 PNG/AVIF
```

Display:

```text
1080 × 675
```

Or build it in HTML/CSS instead of using an image.

I prefer HTML/CSS because:

* it stays sharp,
* data can animate,
* responsive adaptation is easier,
* text remains accessible.

---

# 21. Workspace scan animation

On viewport entry:

```text
1. repository tree appears
2. package.json highlights
3. "Next.js" badge appears
4. pnpm lockfile highlights
5. "pnpm" appears
6. app/routes resolves
7. "23 routes detected"
8. final Ready state
```

Total:

```text
4–5 seconds
```

Run once.

No fake "AI thinking" gradient.

---

# 22. Capability cards beneath workspace media

Use a 3 × 2 grid:

```text
Framework detection
Package-manager detection
Repository structure

Routes & entry points
Endpoint discovery
Repository documentation
```

Each:

```text
Width: 400px approximately
Min-height: 170–190px
```

Mobile:

```text
1 column
```

---

# 23. Section 07 — Guided QA runs

This should be the second strongest product demonstration.

The desktop specification calls QA Runs the operational heart of the desktop client, covering run creation, managed Chromium, guided execution, correlation, local evidence capture, privacy indicators and artifact synchronization. 

Heading:

> **Run QA where the application actually runs.**

---

# 24. QA Run video

This deserves a larger video than the hero loop.

### Source

```text
1920 × 1200
16:10
30fps
18–25 seconds
WebM + MP4
```

Displayed:

```text
Desktop: 1280 × 800
Tablet:  full width
```

Controls:

```text
Play/pause
Replay
Optional progress indicator
No audio required
```

Do not autoplay this entire video.

Use a poster frame with:

```text
▶ Watch a guided QA run
```

---

# 25. QA Run video storyboard

```text
00:00
Project overview

00:02
Click New QA Run

00:04
Choose Development

00:06
Choose Browser-only / expected intent

00:08
Managed Chromium opens

00:10
Developer performs login workflow

00:13
Live evidence begins appearing:
Navigation
Console
Network
Accessibility

00:16
Expected state matched

00:19
Run ends

00:21
Processing

00:23
Report ready
```

Do not show the application automatically clicking through the workflow in v1. The desktop specification explicitly says Tellann must not autonomously click through the application in the initial guided-run model. 

---

# 26. QA Run callouts

Overlay small callouts outside the video frame, not over important UI:

```text
Expected flow
Managed browser
Live evidence
Run/session correlation
Privacy boundary
```

Callouts animate in when the video reaches relevant timestamps only if implementing synchronized playback is reasonable.

Otherwise leave them static.

---

# 27. Section 08 — From expected behavior to evidence

This section explains Tellann's distinctive logic.

Layout:

```text
EXPECTED                    OBSERVED

Intent                      QA Run
────────                    ─────────

Login                       Login
 ↓                           ↓
Dashboard                   Dashboard
 ↓                           ↓
Checkout                    Checkout
                             ↓
                         Payment error

             ↓

         RECONCILIATION
```

Heading:

> **Compare what should happen with what actually happened.**

The desktop architecture distinguishes **Intent**—reviewed expected behavior—from the observed graph generated during a run. 

---

# 28. Reconciliation visual

Prefer interactive HTML/SVG.

Canvas:

```text
1440 × 820
```

Displayed:

```text
1180 × 672 approximately
```

States:

```text
Matched
Expected but not observed
Observed but undeclared
Partial
Missing evidence
```

Hovering/clicking a state can reveal:

```text
Evidence
Timestamp
Route
Confidence
```

But keep it simplified enough for marketing.

---

# 29. Reconciliation animation

On viewport:

```text
Expected graph enters left
Observed graph enters right
Matching nodes connect
Unmatched branch remains
Coverage result appears
```

Example:

```text
8 states matched
2 expected states not observed
1 undeclared behavior
Coverage 78%
```

Use mock data only if explicitly labelled as illustrative.

Better: generate the visual from a controlled Tellann demo application.

---

# 30. Section 09 — Review before Tellann changes anything

This section should exist even while automated instrumentation is not yet generally available, because it explains the future trust model.

But status must be explicit.

For example:

```text
AUTOMATED INSTRUMENTATION
Coming later / Beta
```

if not shipped.

The desktop implementation plan states that automatic instrumentation comes after the browser-first release, with users approving bounded tasks/files and Tellann unable to expand scope without renewed approval. 

---

# 31. Instrumentation workflow

Visual:

```text
DETECT
   ↓
PROPOSE
   ↓
REVIEW
   ↓
APPROVE
   ↓
APPLY
   ↓
VALIDATE
   ↓
KEEP / ROLLBACK
```

Use horizontal flow on desktop.

Vertical on mobile.

---

# 32. Instrumentation screenshot

Show a real proposed-change screen.

Source:

```text
1440 × 900
```

Displayed:

```text
1040 × 650
```

Example UI:

```text
Instrumentation plan

Packages
+ @tellann/react

Files
M app/layout.tsx
M app/api/orders/route.ts

Commands
pnpm add @tellann/react
pnpm typecheck

Scope
2 files

Tellann may not modify files outside this scope.

[Review diff]
[Approve task]
```

Do **not** show:

```text
Allow Tellann to edit entire repository
```

The plan specifically constrains instrumentation to approved task/file scope. 

---

# 33. Diff detail visual

Use a small secondary crop beside explanatory copy.

Source:

```text
1200 × 900
4:3
```

Displayed:

```text
560 × 420
```

Show:

```diff
+ import { Tellann } from "@tellann/react"
```

with a tiny scope indicator:

```text
1 of 2 approved files
```

No need for a large decorative code editor.

---

# 34. Validation animation

After screenshot:

```text
Syntax          ✓
Type check      ✓
SDK connection  ✓
Telemetry       ✓
```

Animate each result:

```text
120ms stagger
```

Total animation:

```text
<1 second
```

If failed:

```text
Validation failed
Rollback available
```

Avoid green confetti.

---

# 35. Section 10 — Desktop + cloud architecture

Heading:

> **Local execution. Shared intelligence.**

This should explain the hybrid system more precisely.

The desktop spec explicitly makes Desktop authoritative for local execution while the web/cloud remains authoritative for canonical reports, organizations, billing, shared history and governance. 

---

# 36. Architecture visual #2

Full-width.

```text
Canvas: 1600 × 900
Display: 1280 × 720
```

Diagram:

```text
┌──────────────────────────────┐
│ YOUR MACHINE                 │
│                              │
│ Repository                   │
│    ↓                         │
│ Tellann Desktop              │
│ ├ Workspace scanner          │
│ ├ Permissions                │
│ ├ Managed browser            │
│ ├ QA execution               │
│ └ Local artifacts            │
└────────────┬─────────────────┘
             │
             │ secure sync
             ▼
┌──────────────────────────────┐
│ TELLANN CLOUD                │
│                              │
│ Applications                 │
│ Intent versions              │
│ Reconciliation               │
│ Reports                      │
│ Collaboration                │
└──────────────────────────────┘
```

---

# 37. Architecture animation

Animate:

```text
Local run starts
↓
Evidence collected
↓
Approved artifacts synchronize
↓
Cloud processing
↓
Report returns
```

4–6 seconds.

Loop no more than twice.

---

# 38. Section 11 — Privacy and local trust

This section must be substantial enough to establish trust without duplicating `/desktop/security`.

Heading:

> **Your repository is not an unrestricted permission.**

Subheading:

> Tellann Desktop separates reading, modifying, running and synchronizing into distinct permissions.

---

# 39. Permission ladder visual

```text
LEVEL 0
Browser only

        ↓

LEVEL 1
Read workspace

        ↓

LEVEL 2
Propose instrumentation

        ↓

LEVEL 3
Apply approved task

        ↓

LEVEL 4
Run approved commands
```

The desktop specification explicitly separates browser-only, read-workspace, instrumentation and command permissions. 

Dimensions:

```text
Desktop visual area: 520 × 640
```

Use HTML rather than image.

---

# 40. Trust cards

Beside ladder:

```text
Raw source stays local by default

Read access ≠ write access

Commands require separate scope

Production is observation-only

Changes remain bounded

Permissions can be revoked
```

The implementation direction states that raw source remains local by default and production is observation-only. 

CTA:

```text
Read Desktop security →
```

to:

```text
/desktop/security
```

---

# 41. Section 12 — Supported ecosystem

Heading:

> **Built around modern development workflows.**

This section should display **actual Desktop support**, not merely SDK compatibility.

---

# 42. Framework compatibility component

Desktop:

```text
┌──────────────────────────────────────────────────────┐
│ Technology    Detect    Instrument    Guided QA      │
├──────────────────────────────────────────────────────┤
│ React         ✓         Status        ✓              │
│ Next.js       ✓         Status        ✓              │
│ Express       ✓         Status        ✓              │
│ Fastify       ✓         Status        ✓              │
│ NestJS        ✓         Status        ✓              │
└──────────────────────────────────────────────────────┘
```

The desktop implementation plan orders instrumentation adapters React/Vite → Next.js → Express → Fastify → NestJS, with Python ecosystems and others later. 

But do not translate that roadmap directly into `✓` marks.

Use statuses:

```text
Supported
Beta
Browser-only
Manual setup
Coming later
```

---

# 43. Package managers

Below framework matrix:

```text
npm
pnpm
yarn
bun
```

Only display verified support.

Use monochrome wordmarks or simple text.

I would avoid large colorful logos here because it breaks the brand system.

---

# 44. Platform support

Compact card:

```text
Windows
Available

macOS
Coming later

Linux
Coming later
```

If only Windows is shipped.

CTA:

```text
View system requirements →
```

to:

```text
/desktop/requirements
```

---

# 45. Section 13 — Desktop product gallery

Now that the visitor understands the system, give them a wider look at the actual product.

Heading:

> **Inside Tellann Desktop**

Use a horizontally scrollable gallery on mobile and a 2×2 grid desktop.

---

# 46. Product screenshot inventory

### Image 1 — Projects

```text
Source: 1440 × 900
Display: 620 × 388
```

Show:

```text
Projects
Workspace status
Framework
Branch
Latest run
Latest report
```

The project overview is supposed to surface workspace health, repository snapshot, Intent readiness, instrumentation state, recent runs and latest reports. 

Caption:

> **Projects**
> Your local workspace and Tellann application in one place.

---

### Image 2 — Intent

```text
Source: 1440 × 900
Display: 620 × 388
```

Show:

```text
Expected workflows
States
Transitions
Failures
Recovery paths
Evidence
```

Caption:

> **Intent**
> Review the behavior Tellann expects before comparing it with a run.

---

### Image 3 — QA Runs

```text
Source: 1440 × 900
Display: 620 × 388
```

Show active managed browser + evidence.

Caption:

> **QA Runs**
> Demonstrate real workflows while Tellann collects structured evidence.

---

### Image 4 — Reports

```text
Source: 1440 × 900
Display: 620 × 388
```

Show:

```text
Coverage
Findings
Missing states
Runtime issues
Endpoint analysis
Evidence links
```

Caption:

> **Reports**
> Turn run evidence into a reviewable quality report.

---

# 47. Gallery interaction

Desktop:

```text
2 × 2
16–24px gap
```

Hover:

```text
image scale 1 → 1.008
border slightly brighter
```

No dramatic zoom.

Click:

Open lightbox/product viewer.

Lightbox max:

```text
1440 × 900 equivalent
90vw × 88vh
```

Add:

```text
Previous
Next
Close
caption
```

---

# 48. Section 14 — Current release

This is a preview of `/desktop/releases`, not a release page.

Layout:

```text
┌─────────────────────────────────────────────────────┐
│ TELLANN DESKTOP                                     │
│                                                     │
│ Current stable                                      │
│ v1.4.0                                              │
│                                                     │
│ Released August 28, 2026                            │
│ Windows x64                                         │
│                                                     │
│ [Download] [Release notes]                          │
└─────────────────────────────────────────────────────┘
```

Data must come from the release manifest.

---

# 49. Release card dimensions

Desktop:

```text
Width:  1280px
Height: 320–380px
```

Use two columns:

```text
60% release information
40% download / platform summary
```

Mobile stacks vertically.

---

# 50. Release decoration

Add a small installer artifact representation:

```text
tellann-desktop-1.4.0-x64.exe
124 MB
Signed
SHA-256 available
```

Do not expose the full checksum here.

Link:

```text
Verify download →
```

to `/desktop/download` or documentation.

---

# 51. Section 15 — FAQ

Keep desktop-specific FAQs only.

Recommended 7 questions:

```text
Why does Tellann need a desktop application?

Does Tellann upload my source code?

Can I use Tellann without the desktop app?

Can Tellann modify my repository?

Does Tellann run commands automatically?

Can I use Tellann against production?

Which operating systems are supported?
```

Answers should be concise.

Links can route into:

```text
/desktop/security
/desktop/requirements
/docs
```

---

# 52. FAQ layout

Desktop:

```text
left 35%:
heading

right 65%:
accordion
```

Maximum accordion width:

```text
760px
```

Open/close animation:

```text
180–220ms
```

No rotating 360° icons.

---

# 53. Section 16 — Final CTA

The page should end with conversion.

Large centered section.

Eyebrow:

```text
TELLANN DESKTOP
```

H2:

> **Start with the project already on your machine.**

Buttons:

```text
[ Download for Windows ]
[ View requirements ]
```

Below:

```text
Current stable vX.X.X
```

---

# 54. CTA visual

Use a **cropped partial application screenshot** rising from below the fold.

Source:

```text
1600 × 1000
```

Displayed:

```text
1000 × 625
```

But crop lower half with container overflow:

```text
Visible height: ~340px
```

This gives the impression that the application continues below the page.

Do not use a different decorative illustration.

---

# 55. Section 17 — Footer

Use the global Tellann footer.

Relevant links:

```text
Product
Desktop

Developers
Download Desktop
System Requirements

Resources
Desktop Releases

Legal & Trust
Desktop Security
```

---

# 56. Complete media asset list

The initial `/desktop` implementation would need roughly:

| ID     | Asset                           | Source dimensions | Placement            |
| ------ | ------------------------------- | ----------------: | -------------------- |
| DSK-01 | Hero product loop               |         1600×1000 | Hero                 |
| DSK-02 | Hero poster                     |         1600×1000 | Hero fallback        |
| DSK-03 | Local/cloud diagram             |      1400×900 SVG | Why Desktop          |
| DSK-04 | Attach-project screenshot       |          1440×900 | Connect workflow     |
| DSK-05 | Permission screenshot           |          1280×800 | Connect workflow     |
| DSK-06 | Workspace analysis screenshot   |          1440×900 | Connect/workspace    |
| DSK-07 | Project-ready screenshot        |          1440×900 | Connect workflow     |
| DSK-08 | QA Run video                    |         1920×1200 | QA Runs              |
| DSK-09 | QA Run poster                   |         1920×1200 | Video fallback       |
| DSK-10 | Reconciliation diagram          |      1440×820 SVG | Expected vs observed |
| DSK-11 | Instrumentation-plan screenshot |          1440×900 | Instrumentation      |
| DSK-12 | Diff screenshot                 |          1200×900 | Instrumentation      |
| DSK-13 | Hybrid architecture diagram     |      1600×900 SVG | Local/cloud          |
| DSK-14 | Projects gallery                |          1440×900 | Product gallery      |
| DSK-15 | Intent gallery                  |          1440×900 | Product gallery      |
| DSK-16 | QA Runs gallery                 |          1440×900 | Product gallery      |
| DSK-17 | Reports gallery                 |          1440×900 | Product gallery      |
| DSK-18 | Final CTA screenshot            |         1600×1000 | Final CTA            |
| DSK-19 | OG/social preview               |          1200×630 | Metadata             |

That is about **13 product screenshots/posters + 2 videos + 3 SVG diagrams + 1 social image**. Some screenshots can reuse the same original capture with different crops.

---

# 57. Video strategy

I would use only **two videos**.

### Video 1 — Hero

```text
Purpose:
Quick product comprehension

Duration:
10–14 sec

Autoplay:
Yes

Interaction:
None
```

### Video 2 — Guided QA Run

```text
Purpose:
Actual workflow demonstration

Duration:
18–25 sec

Autoplay:
No

Interaction:
Play/pause/restart
```

Any more video starts increasing page weight without substantially increasing understanding.

---

# 58. Animation strategy

Use four meaningful animation families.

### A. Local → cloud data movement

Used in architecture diagrams.

```text
SVG path
4–6 sec
viewport-triggered
```

### B. Workspace detection

```text
repository item highlights
result badges appear
```

### C. Expected → observed reconciliation

```text
matching graph nodes connect
coverage appears
```

### D. Validation sequence

```text
Syntax ✓
Type ✓
SDK ✓
Telemetry ✓
```

Everything else should use standard motion:

```text
fade
translateY 8–16px
180–400ms
```

---

# 59. What not to animate

Do not animate:

```text
Every heading
Every card
Every screenshot
Navigation continuously
Framework logos
Download CTA pulsing
Large background gradients
Fake code constantly typing
```

Tellann should feel deliberate and technical, not restless.

---

# 60. Mobile layout

At `<768px`:

Hero:

```text
Text
↓
CTAs
↓
Video
```

Architecture sections:

```text
Text
↓
Diagram
```

Connect-project tabs:

```text
horizontal scroll tabs
↓
single screenshot
```

Product gallery:

```text
horizontal snap carousel
```

Compatibility:

```text
technology cards
```

instead of the wide table.

---

# 61. Mobile media sizes

Use responsive sources.

For screenshots, provide at least:

```text
480w
768w
1280w
1600w
```

via `srcset`.

Do not send a 1.8MB 1600px screenshot to a 390px phone.

---

# 62. Image formats

Use:

```text
AVIF primary
WebP fallback
PNG only where absolute fidelity is required
SVG for diagrams
```

Screenshots should preferably be:

```text
AVIF quality ~70–80
```

while preserving text readability.

Do not aggressively compress product text.

---

# 63. Video loading

Hero video:

```text
preload="metadata"
poster="/..."
autoplay
muted
playsinline
loop
```

QA video:

```text
preload="none"
poster="/..."
```

Load it only when approaching viewport.

---

# 64. Performance targets

The product page contains a lot of media, so enforce limits.

Initial page load:

```text
Hero poster        < 250KB ideally
Hero video         lazy/stream
SVG diagrams       < 100KB each
Below-fold images  lazy
```

Target:

```text
LCP < 2.5s
CLS ≈ 0
```

Always reserve media aspect ratios so the page does not jump while loading.

---

# 65. Product screenshot rules

Every screenshot should:

* use one consistent desktop-app version,
* use one demo project,
* use realistic data,
* avoid personally identifiable information,
* avoid absolute local paths where not appropriate,
* avoid fake capabilities,
* avoid conflicting version numbers,
* use the same window dimensions,
* show a controlled Git/repository state.

I would create a permanent demo project named something like:

```text
Commerce Demo
```

and use it throughout the site.

---

# 66. Demo project continuity

For example, every image/video can use:

```text
Application:
Commerce Demo

Framework:
Next.js

Language:
TypeScript

Package manager:
pnpm

Branch:
main
```

Then the page feels like a single story:

```text
Attach Commerce Demo
       ↓
Analyze
       ↓
Review expected checkout
       ↓
Run checkout
       ↓
Observe payment problem
       ↓
Generate report
```

Much better than random screenshots showing unrelated applications.

---

# 67. Critical claim-status system

Marketing copy should understand three states:

```text
AVAILABLE
Shipping in stable Desktop.

BETA
Actually usable but not yet stable.

COMING LATER
Documented direction but not shipping.
```

For example, the source material currently puts signed Windows browser-first operation ahead of documentation inference and ahead again of JavaScript/TypeScript automated instrumentation. 

Therefore, if launch occurs during the browser-first release:

```text
Workspace analysis        Available
Guided QA runs            Available
Managed browser           Available
Automatic instrumentation Coming later
Python instrumentation    Future
```

Do not flatten them into one feature list.

---

# 68. Recommended page narrative in final form

The finished `/desktop` visitor journey should feel like this:

```text
Tellann Desktop
Bring Tellann closer to your code.

              ↓

[REAL PRODUCT]

              ↓

Why a desktop application?
Because your repository and local environment
require a controlled local execution boundary.

              ↓

Connect your project.

Folder → Read access → Analyze → Ready

              ↓

Understand the workspace.

Next.js
TypeScript
pnpm
Routes
Endpoints
Tests

              ↓

Run QA.

Expected workflow
     +
Managed browser
     +
Live evidence

              ↓

Understand the difference.

Expected behavior
vs
Observed behavior

              ↓

Review every change.

Propose
Review
Approve
Apply
Validate
Rollback

              ↓

Local execution.
Shared intelligence.

Desktop ↔ Tellann Cloud

              ↓

Your repository is not
an unrestricted permission.

              ↓

Supported stack.

              ↓

Inside Tellann Desktop.

Projects
Intent
QA Runs
Reports

              ↓

Current stable release.

              ↓

Download Tellann Desktop.
```

That gives `/desktop` a very clear role: **it sells the concept and experience of the desktop product**. `/desktop/download` handles distribution, `/desktop/security` handles the deep trust model, `/desktop/requirements` handles compatibility, `/desktop/releases` handles provenance, and the documentation handles instructions.

Most importantly, the visual story mirrors what the desktop itself is meant to become: **Projects → Intent → Instrumentation → QA Runs → Reports**, with local workspace execution on the desktop side and canonical shared intelligence on the Tellann cloud side. 
