Yes. I would treat the desktop application as a **new first-class product surface** within the marketing architecture, not merely as a download utility.

The existing routing plan deliberately separates **Product = what Tellann does**, **Developers = how developers use/integrate it**, **Resources = learning/change history**, and **Security = trust**. The desktop route family should preserve that logic while creating a stable home for the locally installed Tellann execution environment. 

The desktop specification gives us the conceptual boundary: the desktop client owns local workspace access, repository scanning, instrumentation operations, managed QA runs, local permissions, and artifact preparation; the cloud remains authoritative for shared applications, accepted graphs, reports, collaboration, billing, and audit. 

# 1. Final routing architecture

I would update the public route tree to include:

```text
/
│
├── /product
│   ├── /product/how-it-works
│   ├── /product/demonstration-mode
│   ├── /product/behavior-graphs
│   ├── /product/workflow-discovery
│   ├── /product/coverage
│   ├── /product/missing-flows
│   ├── /product/missing-states
│   ├── /product/session-replay
│   ├── /product/endpoint-intelligence
│   └── /product/qa-reports
│
├── /desktop
│   ├── /desktop/download
│   ├── /desktop/releases
│   │   └── /desktop/releases/[version]
│   ├── /desktop/security
│   └── /desktop/requirements
│
├── /solutions
│   └── ...
│
├── /developers
│   └── ...
│
├── /security
│   └── ...
│
├── /resources
│   └── /changelog
│
└── ...
```

There is an important conceptual distinction:

```text
/product
"What does Tellann do?"

/desktop
"What is the local Tellann application?"

/developers
"How do I integrate or configure Tellann?"

/security
"How does the Tellann platform protect me?"

/desktop/security
"What can the installed application do to my computer/codebase?"
```

That separation is worth preserving.

---

# 2. New pages required

| Route                         | Purpose                             | Priority |
| ----------------------------- | ----------------------------------- | -------: |
| `/desktop`                    | Canonical desktop product overview  |       P0 |
| `/desktop/download`           | Stable installer destination        |       P0 |
| `/desktop/releases`           | Desktop release history             |       P0 |
| `/desktop/releases/[version]` | Permanent release notes             |       P0 |
| `/desktop/security`           | Local trust boundary                |       P0 |
| `/desktop/requirements`       | OS, hardware and tool compatibility |       P0 |

I would ship all six together. A desktop download route without security, requirements and release provenance feels unfinished for a tool that can inspect and potentially modify source code.

---

# 3. `/desktop` — Desktop application overview

## Purpose

`/desktop` becomes the canonical answer to:

> What is Tellann Desktop, and why would I install it?

The current `/desktop` implementation should therefore **not be deleted**. Its download detection and handoff logic should be extracted and reused, while the page itself becomes a proper product page.

### Recommended SEO

```text
Title:
Tellann Desktop — Local Application Analysis & QA

Description:
Connect local projects to Tellann, inspect your workspace,
review instrumentation changes, run guided QA sessions,
and keep sensitive source-code operations under local control.
```

Do not advertise any implementation claim until it has been verified against `apps/desktop`.

---

## Section 1 — Hero

Eyebrow:

```text
TELLANN DESKTOP
```

H1:

> **Bring Tellann closer to your code.**

Supporting copy should explain that the desktop application bridges a developer's local environment with Tellann without turning the website/cloud dashboard into an unrestricted filesystem agent.

Primary CTA:

```text
[ Download for Windows ]
```

or dynamically:

```text
[ Download for your platform ]
```

Secondary:

```text
[ See how it works ]
```

Tertiary:

```text
Current version 1.x.x
View release notes →
```

The actual version must come from release metadata rather than JSX.

---

# 4. Hero media

Use a real desktop application screenshot once available.

Recommended master screenshot:

```text
1440 × 900 px
16:10
PNG / AVIF
```

Displayed desktop width:

```text
1120–1240px
```

Show the desktop application in a meaningful state such as:

```text
Project: Commerce App

Workspace
React + Next.js
pnpm
Git: main

Intent       Ready
Instrumentation
QA Runs
Reports
```

Avoid showing a generic empty shell.

A subtle 12–18 second product loop can eventually replace the static screenshot:

```text
Open project
    ↓
Workspace detected
    ↓
Review analysis
    ↓
Review instrumentation
    ↓
Start QA run
    ↓
Open report
```

Recommended source:

```text
1600 × 1000
WebM + MP4 fallback
24/30fps
No audio
Autoplay muted
Loop
```

Only include steps that the shipping desktop client genuinely performs.

---

# 5. Section — Why a desktop application exists

This is important because visitors will reasonably ask:

> Why can't Tellann just do this in the browser?

Use a two-column section.

### Browser/cloud

```text
Applications
Reports
Accepted workflow models
Organization state
Collaboration
Billing
Audit history
```

### Desktop/local

```text
Workspace attachment
Repository inspection
Local environment detection
Source-aware setup
Approved instrumentation
Development process interaction
Local diagnostics
```

The desktop specification explicitly treats the client as the execution environment for local repository access and local operations rather than duplicating the cloud application. 

---

# 6. Section — Connect a local project

This should be one of the strongest visuals.

```text
Local repository
      │
      ▼
Tellann Desktop
      │
      ├── Framework detection
      ├── Package manager
      ├── Repository structure
      ├── Routes / entry points
      ├── Existing instrumentation
      └── Local environment
      │
      ▼
Approved derived information
      │
      ▼
Tellann
```

Visually distinguish:

```text
REMAINS LOCAL
```

from:

```text
MAY SYNCHRONIZE
```

because trust is part of the product experience, not merely legal copy.

The current desktop specification describes read-only analysis of Git state, package managers, frameworks, entry points, scripts, routes, endpoints, controllers, middleware, schemas, tests and repository documentation without initially executing repository scripts. 

---

# 7. Section — Capability overview

Use 6 capability cards.

### Connect projects

Attach:

```text
Local folder
Repository
Development URL
Staging/preview URL
```

### Understand the workspace

Detect:

```text
Framework
Package manager
Entry points
Repository structure
Environment
```

### Review before modification

Show:

```text
Files affected
Packages required
Commands proposed
Risks
Validation steps
Rollback method
```

### Instrument safely

Explain syntax/source-aware instrumentation only if implemented.

### Run Tellann QA

The desktop spec already anticipates project-scoped QA Runs and Reports alongside Intent and Instrumentation. 

### Diagnose integration

Expose:

```text
SDK status
Workspace health
Environment problems
Connectivity
Configuration errors
```

---

# 8. Section — Human approval

This should visually show:

```text
Detect
  ↓
Propose
  ↓
Review
  ↓
Approve
  ↓
Apply
  ↓
Validate
```

Not:

```text
Scan → silently modify repository
```

This distinction matters enormously.

---

# 9. Section — Supported ecosystem

Display detected/supported technologies.

The broader Tellann SDK specification currently defines JavaScript, TypeScript, React, Next.js, Node.js, Express, NestJS and Fastify support. 

However, **do not automatically assume the desktop scanner/instrumentation system supports every framework supported by the SDK**.

The site should therefore source desktop-specific states such as:

```text
React             Supported
Next.js           Supported
Node.js           Supported
Express           Supported
NestJS            Beta
Fastify           Manual setup
Vue               Coming later
```

from a desktop capability registry derived from the codebase.

Not from marketing assumptions.

---

# 10. Section — Desktop + cloud workflow

Illustrate:

```text
tellann.co
Learn about Tellann
      ↓

app.tellann.co
Create/select application
      ↓

tellann://connect
      ↓

Tellann Desktop
Attach local workspace
      ↓

Analyze / instrument / QA run
      ↓

Tellann Cloud
Reports + behavioral intelligence
```

This is also where the existing browser-to-desktop handoff should be introduced.

---

# 11. Section — Security teaser

Do not dump the entire security specification here.

Show four short principles:

```text
Local-first repository access

Explicit permission elevation

Review before source changes

Signed and verifiable installers
```

CTA:

```text
[ How Tellann Desktop handles your code → ]
```

Destination:

```text
/desktop/security
```

---

# 12. Section — Current release

Reusable component:

```text
Tellann Desktop

Stable
v1.4.0

Released
28 August 2026

Windows x64

[ Download ]
[ Release notes ]
```

Never hardcode this section separately from `/desktop/download`.

It should consume the exact same release manifest.

---

# 13. `/desktop/download`

This page becomes the authoritative installer destination.

Its job is very different from `/desktop`.

```text
/desktop
= convince/explain

/desktop/download
= select/verify/install
```

---

# 14. Download page hero

H1:

> **Download Tellann Desktop**

Subtext:

> Install the local Tellann application and connect your development workspace.

Then immediately show the detected platform.

For example:

```text
We detected Windows

Tellann Desktop 1.4.0
Windows 11 / Windows 10
x64
124 MB

[ Download .exe ]
```

Do **not** initiate the download merely because the operating system was detected.

Detection chooses the recommended artifact; the user still clicks.

---

# 15. OS selector

Below detection:

```text
[ Windows ] [ macOS ] [ Linux ]
```

If only Windows currently exists:

```text
Windows
Available

macOS
Coming soon

Linux
Coming soon
```

Do not hide unsupported operating systems. Honest unsupported states are more trustworthy.

Given that the current desktop navigation specification explicitly targets the Windows desktop application, Windows should be treated as the documented baseline unless the code/release pipeline proves otherwise. 

---

# 16. Artifact information

Every downloadable artifact needs:

```text
Version
Release date
Filename
Architecture
File size
SHA-256
Signing status
Minimum OS
Release channel
```

Example:

```text
tellann-desktop-1.4.0-x64.exe

Version       1.4.0
Architecture  x64
Size          124.8 MB
Signed        Yes
SHA-256       a3d9...
```

Provide:

```text
[ Copy SHA-256 ]
```

and:

```text
How to verify →
```

---

# 17. Architecture selector

Do not show architectures that are not actually built.

Possible model:

```text
Windows

x64     Recommended     [Download]
ARM64   Not available
```

If both exist:

```text
x64
ARM64
```

OS detection and architecture detection should be treated independently.

---

# 18. Installation instructions

Keep marketing-site instructions short:

```text
1. Download the installer.
2. Verify the signature if required.
3. Run the installer.
4. Sign in to Tellann.
5. Connect a project.
```

Detailed material belongs in:

```text
docs.tellann.co/desktop/installation
```

---

# 19. Browser → desktop handoff

This needs special treatment.

If someone reaches:

```text
/desktop/download?handoff=...
```

or whatever current handoff model already exists, the page should recognize that context and show:

> **Continue connecting your Tellann project**

Then:

```text
[ Open Tellann Desktop ]
```

using:

```text
tellann://connect/...
```

Fallback:

```text
Don't have Tellann Desktop?
[ Download ]
```

After installation:

```text
[ I installed Tellann — open it ]
```

The existing handoff logic should be preserved, but extracted from the present `/desktop/page.tsx` into reusable logic.

I would avoid putting application secrets, SDK secrets or long-lived credentials inside deep-link URLs. A short-lived opaque handoff credential is safer.

---

# 20. Previous versions

Below installation:

> Previous stable releases

Show perhaps the last 3–5 supported releases:

```text
1.3.4
1.3.3
1.2.9
```

Each links to:

```text
/desktop/releases/1.3.4
```

Do not simply expose an unstructured bucket of historical binaries.

---

# 21. `/desktop/releases`

This becomes the desktop application's distribution history.

It must remain separate from the generic `/changelog`.

The existing routing plan treats Changelog as a general Resources destination. 

The distinction should be:

```text
/changelog
Tellann-wide product changes

/desktop/releases
Desktop installer/release history
```

---

# 22. Release history hero

H1:

> **Tellann Desktop releases**

Supporting copy:

> Release notes, compatibility information, security changes and installers for Tellann Desktop.

Current stable card:

```text
LATEST STABLE

v1.4.0
August 28, 2026

Workspace diagnostics improvements
Instrumentation validation updates
Installer security fixes

[ View release ]
[ Download ]
```

---

# 23. Release listing

Each release entry should expose:

```text
Version
Release date
Status
Supported OS
Highlights
Security indicator
Known-issue indicator
```

Example:

```text
v1.4.0
Stable · 28 Aug 2026

New
• Workspace scanner improvements
• ...

Fixed
• ...

Security
• Installer verification update

[ Release notes ]
```

Filters become useful later:

```text
All
Stable
Beta
Security
```

Do not add beta/nightly filters until such channels actually exist.

---

# 24. `/desktop/releases/[version]`

Every published release gets a permanent canonical URL:

```text
/desktop/releases/1.4.0
```

Prefer canonical URLs without `v`.

You may redirect:

```text
/desktop/releases/v1.4.0
→
/desktop/releases/1.4.0
```

---

# 25. Version page structure

Hero:

```text
Tellann Desktop 1.4.0

Stable

Released August 28, 2026

[ Download ]
```

Then sections:

### What's new

Meaningful user-facing capabilities.

### Improvements

Smaller improvements.

### Fixes

Resolved defects.

### Security

Security-impacting changes.

### Breaking changes

Only if applicable.

### Known issues

Do not hide them.

### Compatibility

```text
Windows 11   Supported
Windows 10   Supported
x64          Supported
ARM64        Unsupported
```

### Artifacts

```text
Windows x64
Filename
Size
SHA-256
Signature
Download
```

### Upgrade notes

Anything users must do.

### Rollback notes

Whether downgrade is supported.

### Documentation

Links relevant to this release.

---

# 26. Release page status

Support states:

```text
Latest stable
Supported
Previous stable
Deprecated
Withdrawn
Prerelease
```

A withdrawn build should not disappear silently.

Show:

> This release was withdrawn.

Explain why and link to the recommended version.

That creates dependable security provenance.

---

# 27. Invalid version

For:

```text
/desktop/releases/9.99.99
```

do not use an empty generic page.

Use the site's standard 404 shell but add:

```text
That Tellann Desktop release doesn't exist.

[ View current releases ]
[ Download latest stable ]
```

---

# 28. `/desktop/security`

This is arguably the second-most important desktop page after `/desktop`.

The general Tellann privacy model already emphasizes privacy-by-default, sensitive-data exclusion, configurable redaction and data minimization. 

Desktop security must go further by explaining **local machine powers**.

---

# 29. Security page hero

Eyebrow:

```text
DESKTOP SECURITY
```

H1:

> **Your codebase should never become a black box permission.**

Supporting copy:

> Tellann Desktop separates inspection, modification and execution permissions so developers can understand what the application is allowed to do before granting additional access.

---

# 30. Trust-boundary diagram

Recommended visual:

```text
1200 × 760
SVG preferred
```

Diagram:

```text
┌──────────────────────────┐
│ Your computer            │
│                          │
│ Repository               │
│ Git state                │
│ Local tools              │
│ Development environment  │
│                          │
│      Tellann Desktop     │
└────────────┬─────────────┘
             │
             │ Approved /
             │ derived data
             ▼
┌──────────────────────────┐
│ Tellann Cloud            │
│                          │
│ Application              │
│ Intent                   │
│ Runs                     │
│ Reports                  │
│ Collaboration            │
└──────────────────────────┘
```

Use animation only for the approved data boundary, not everything.

Respect `prefers-reduced-motion`.

---

# 31. What is scanned locally

Explicitly document categories such as:

```text
Repository metadata
Git state
Frameworks
Languages
Package managers
Entry points
Routes
Endpoints
Scripts
Tests
Documentation
Instrumentation state
```

Again, the final list must match the shipping scanner.

The desktop specification already proposes this read-only workspace analysis model. 

---

# 32. What can leave the computer

This should not say merely:

> We respect privacy.

Instead use a matrix.

| Information              | Local |                   Cloud | Approval   |
| ------------------------ | ----: | ----------------------: | ---------- |
| Absolute repository path |     ✓ |           No by default | —          |
| Framework detection      |     ✓ | Derived result may sync | Policy     |
| Package manager          |     ✓ |                May sync | Policy     |
| Repository summary       |     ✓ |   Derived data may sync | Policy     |
| Source excerpts          |     ✓ |    Only where permitted | Required   |
| Full source file         |     ✓ |           No by default | Explicit   |
| Report/result metadata   |     — |                       ✓ | Run policy |

Exact states should come from implementation.

---

# 33. Permission model

Make permission escalation legible.

```text
LEVEL 0
Browser only

LEVEL 1
Read workspace

LEVEL 2
Modify approved files

LEVEL 3
Run approved commands

LEVEL 4
Apply approved instrumentation
```

The important rule:

> Attaching a workspace should not silently grant write or command execution.

The desktop spec already establishes that initial folder attachment should request read access only and that additional permissions should be requested later as required. 

---

# 34. Source-code modification

Document:

```text
Tellann proposes
      ↓
You review files
      ↓
You review diff
      ↓
You approve
      ↓
Tellann applies
      ↓
Tellann validates
```

Explain what is never acceptable:

```text
Unapproved files
Unrelated dirty files
Silent dependency changes
Silent command execution
Whole-file replacement where bounded edits are possible
```

---

# 35. Validation and rollback

Show:

```text
Before
Repository state

        ↓

Approved instrumentation

        ↓

Validation

        ↓

PASS
Keep

or

FAIL
Rollback
```

The desktop specification explicitly makes validation and rollback part of the instrumentation workflow. 

---

# 36. Credential storage

The page should eventually document:

```text
Authentication tokens
Application credentials
Local secrets
Deep-link handoff credentials
```

and where each is stored.

Do not claim:

> Stored in Windows Credential Manager

until that is actually how `apps/desktop` behaves.

The marketing page should derive this claim from the implementation/security architecture.

---

# 37. Installer verification

Explain:

```text
Code signing
Publisher identity
SHA-256
TLS download
Update validation
```

Link to exact verification instructions.

---

# 38. Relationship with `/security`

At the bottom:

```text
Desktop security
→ local repository and device trust

Platform security
→ authentication, encryption,
tenant isolation, infrastructure

Privacy
→ behavioral-data collection rules
```

Links:

```text
/security
/security/privacy
/desktop/security
```

No duplication.

---

# 39. `/desktop/requirements`

This page answers:

> Will Tellann Desktop work on my machine/project?

H1:

> **Tellann Desktop system requirements**

---

# 40. Operating systems

Use a support matrix.

```text
Windows 11              Supported
Windows 10              Supported
macOS                   Coming soon
Linux                   Coming soon
```

Only publish validated OS versions.

Avoid:

```text
Windows
```

as the entire requirement.

Specify the minimum supported build where known.

---

# 41. CPU architectures

```text
x86-64 / x64
ARM64
```

with:

```text
Supported
Experimental
Not supported
Coming soon
```

---

# 42. Hardware

Document:

```text
Minimum RAM
Recommended RAM

Installer size
Installed disk footprint
Temporary disk requirement

Minimum CPU class
```

These numbers must come from measured builds.

Do not invent a neat-looking `8 GB RAM` requirement unless it has been tested.

---

# 43. Development tools

Depending on desktop functionality:

```text
Git
Node.js
npm
pnpm
yarn
bun
Docker
Browsers
```

But distinguish:

```text
Required to launch Tellann Desktop
```

from:

```text
Required only when your project uses it
```

For example:

```text
Git
Recommended for rollback/version-aware workflows.

Node.js
Required only for Node-based projects Tellann needs to run.

pnpm
Required only when the attached project uses pnpm.
```

That avoids misleading people into installing tools they do not need.

---

# 44. Supported frameworks

This page can contain the authoritative **desktop compatibility matrix**:

```text
Framework    Detection    Instrumentation    QA run

React        Yes          Yes                Yes
Next.js      Yes          Yes                Yes
Express      Yes          ...
NestJS       ...
```

Again: desktop support and SDK support are not automatically identical.

---

# 45. Package managers

Separate matrix:

```text
npm
pnpm
yarn
bun
```

Possible columns:

```text
Detect
Install package
Run scripts
Validate
```

---

# 46. Network requirements

Document domains/service types rather than vague:

> Internet access required.

For example:

```text
Authentication
Tellann API
Release/update service
Telemetry endpoint
```

Include:

```text
HTTPS 443
Proxy support
Firewall considerations
Offline behavior
```

if implemented.

---

# 47. Permissions

Explain required OS capabilities:

```text
Filesystem access
Network access
Custom protocol registration
Process launch
Update installation
```

and which are optional.

---

# 48. Unsupported configurations

This section matters.

Examples:

```text
Unsupported framework versions
Read-only drives
Restricted enterprise devices
Unsupported package-manager versions
Repositories above tested size limits
Monorepo limitations
WSL/network-share limitations
```

Only list verified limitations.

---

# 49. Diagnostic CTA

Bottom CTA:

```text
Having compatibility problems?

[ Desktop troubleshooting ]
[ View known issues ]
```

Links:

```text
docs.tellann.co/desktop/troubleshooting

/desktop/releases
```

---

# 50. Supporting documentation pages

The marketing route family should remain concise. The routing plan already separates marketing from `docs.tellann.co`, which exists to explain integration rather than sell the product. 

I would therefore add these documentation destinations if they do not already exist:

```text
docs.tellann.co/desktop
├── /installation
├── /connect-project
├── /workspace-scanning
├── /permissions
├── /instrumentation
├── /browser-handoff
├── /updates
├── /verify-download
└── /troubleshooting
```

You do **not** need matching marketing routes for these.

---

# 51. Changes required to the existing `/desktop` implementation

The existing:

```text
apps/marketing/src/app/desktop/page.tsx
```

should be redesigned, but useful logic should be preserved.

I would split it roughly into:

```text
app/desktop/page.tsx
        │
        ├── DesktopHero
        ├── DesktopCapabilities
        ├── DesktopWorkflow
        ├── DesktopTrust
        ├── DesktopCompatibility
        └── DesktopReleaseCTA
```

with reusable infrastructure:

```text
components/desktop/
├── DesktopDownloadCTA.tsx
├── PlatformSelector.tsx
├── ReleaseBadge.tsx
├── ReleaseArtifactCard.tsx
├── ChecksumDisplay.tsx
├── DesktopHandoff.tsx
├── CompatibilityMatrix.tsx
└── DesktopReleaseCard.tsx
```

OS detection and handoff behavior should not remain buried inside the overview page.

---

# 52. Homepage `/` changes

The homepage currently explains Tellann through:

```text
Connect
Demonstrate
Observe
Understand
```

and positions the site around product comprehension before adoption. 

Add one desktop-specific section, not five.

Recommended placement:

**after “How Tellann works” or before the final conversion CTA.**

Heading:

> **Connect Tellann to the environment where you build.**

Visual:

```text
Local project
      ↓
Tellann Desktop
      ↓
Demonstrate / Instrument
      ↓
Behavioral intelligence
```

CTA:

```text
[ Explore Tellann Desktop ]
```

Do not make `Download` the homepage's primary CTA. `Start free` should remain the main conversion path.

---

# 53. `/product` changes

The Product overview currently groups Tellann into Observe, Understand, Analyze and Communicate. 

Add a new layer explaining **where execution occurs**.

For example:

```text
CONNECT
Tellann Desktop + SDKs

        ↓

OBSERVE
Sessions + telemetry

        ↓

UNDERSTAND
Workflows + behavior graphs

        ↓

ANALYZE
Coverage + missing behavior

        ↓

COMMUNICATE
Reports
```

Add a dedicated desktop card:

```text
Desktop app

Connect local projects, inspect the
development environment and prepare
Tellann securely from your machine.

[ Explore Desktop ]
```

---

# 54. `/product/how-it-works` changes

This page needs the most important workflow modification.

Current conceptual path:

```text
Create application
↓
Install SDK
↓
Start demonstration
↓
Use application
↓
Tellann analyzes behavior
```

Add two paths:

```text
                     CREATE APPLICATION
                            │
               ┌────────────┴────────────┐
               │                         │
               ▼                         ▼

          MANUAL SETUP               DESKTOP SETUP

          Install SDK                Open Desktop
               │                         │
          Configure SDK              Attach project
               │                         │
               │                     Scan workspace
               │                         │
               │                     Review setup
               └────────────┬────────────┘
                            │
                            ▼
                     RUN / DEMONSTRATE
                            │
                            ▼
                     TELLANN ANALYSIS
```

This preserves manual integration.

Do not imply Tellann Desktop becomes mandatory unless that is an intentional product decision.

---

# 55. `/product/demonstration-mode` changes

Add a section:

> **Demonstrate from Tellann Desktop**

Explain how a desktop-managed QA run relates to Developer Demonstration Mode.

Possible visual:

```text
Desktop

Start QA Run
    ↓

Launch approved environment
    ↓

Perform workflow
    ↓

Capture evidence
    ↓

Review findings
    ↓

Tellann report
```

The desktop navigation model already includes project-scoped QA Runs and Reports, so the connection is conceptually sound. 

But only market this once the corresponding desktop run lifecycle is actually shipped.

---

# 56. `/developers` changes

The routing plan treats `/developers` almost as a second homepage for technical adoption. 

Add:

```text
GET STARTED

Option 1
Use Tellann Desktop

[ Download Desktop ]

Option 2
Integrate manually

[ SDK Quickstart ]
```

This is much better than forcing every developer into the same setup path.

---

# 57. `/developers/quickstart` changes

Add:

```text
Choose your setup

[ Desktop-assisted ]
[ Manual SDK ]
```

Desktop-assisted path:

```text
1. Create Tellann application
2. Download Desktop
3. Sign in
4. Open local project
5. Review detected stack
6. Approve setup
7. Verify connection
```

Manual path remains the existing SDK flow.

---

# 58. `/developers/sdk` changes

Do not replace SDK documentation with Desktop.

Add a callout:

> Prefer guided setup?

```text
Tellann Desktop can inspect supported projects
and prepare the correct integration workflow.

[ Use Desktop ]
```

The SDK remains a product primitive even if Desktop makes installing it easier.

---

# 59. Product mega-menu changes

The current Product menu separates platform, behavior understanding, quality analysis and reporting. 

I would modify it to:

```text
PRODUCT

Platform
├─ Product Overview
├─ How Tellann Works
└─ Demonstration Mode

Desktop
├─ Desktop App
├─ How Desktop Works → /desktop
└─ Desktop Security

Understand Behavior
├─ Behavior Graphs
├─ Workflow Discovery
└─ Session Replay

Analyze Quality
├─ Coverage
├─ Missing Flows
├─ Missing States
└─ Endpoint Intelligence

Communicate
└─ QA Reports
```

Do not put all five `/desktop/*` routes into the mega-menu.

`Download`, `Releases` and `Requirements` belong elsewhere.

---

# 60. Developer mega-menu changes

Current Developer navigation includes Quickstart, Documentation, SDKs, API Reference, Examples, GitHub and Status. 

Change to:

```text
DEVELOPERS

Get Started
├─ Quickstart
├─ Download Desktop
└─ Documentation

SDKs
├─ React
├─ Next.js
├─ Node.js
└─ SDK Reference

Resources
├─ API Reference
├─ Examples
├─ GitHub
└─ Status
```

`Download Desktop` should be prominent here.

---

# 61. Footer changes

The existing footer architecture deliberately has Product, Solutions, Developers, Resources, Company and Legal & Trust columns. 

I would modify it to:

```text
PRODUCT

Overview
How it works
Demonstration Mode
Behavior Graphs
Coverage
Session Replay
Desktop


DEVELOPERS

Documentation
Quickstart
Download Desktop
System Requirements
React
Next.js
Node.js
API Reference
Status


RESOURCES

Blog
Guides
Case Studies
Glossary
Changelog
Desktop Releases
Roadmap


LEGAL & TRUST

Security
Privacy
Desktop Security
Terms
DPA
Subprocessors
```

Do not create a seventh footer column just for Desktop.

---

# 62. `/security` changes

Add a new subsection/card:

> **Desktop application security**

Copy:

> Understand how Tellann handles local repositories, filesystem permissions, instrumentation changes and installer integrity.

CTA:

```text
[ Desktop security ]
```

Destination:

```text
/desktop/security
```

---

# 63. `/security/privacy` changes

Add one concise desktop subsection:

```text
Local repository data

Tellann Desktop applies separate rules to local
source-code access and cloud synchronization.

[ Read Desktop security ]
```

Do not duplicate the entire desktop trust model.

The existing Tellann privacy specification already requires privacy-by-default, data minimization and explicit control over expanded collection. 

---

# 64. `/roadmap` changes

Add Desktop as a platform capability with honest status.

For example:

```text
TELLANN DESKTOP

AVAILABLE
Windows desktop application

IN PROGRESS
Expanded adapter coverage

PLANNED
Additional operating systems
```

But statuses must be generated from actual product state.

This follows the broader routing strategy that Roadmap contains future capabilities rather than allowing future functionality to leak into current product claims. 

---

# 65. Generic `/changelog` changes

Desktop announcements can appear here:

```text
Tellann Desktop 1.4.0 released

New workspace diagnostics and
instrumentation improvements.

[ Full desktop release notes → ]
```

Destination:

```text
/desktop/releases/1.4.0
```

The generic changelog should **not duplicate** the entire desktop release entry.

---

# 66. `/pricing` changes

This depends on commercial policy.

The current pricing structure defines entitlements around applications, users, storage, collaboration, API access, SSO and self-hosting, but it does not formally establish Desktop as a plan-gated product. 

Therefore, do not invent:

```text
Desktop available from Team
```

or:

```text
Free users cannot use Desktop
```

until packaging is decided.

Once decided, add a row:

```text
Tellann Desktop
```

and perhaps:

```text
Desktop automated instrumentation
```

if those have separate entitlements.

---

# 67. `status.tellann.co` changes

If your status application supports component-level status, add:

```text
Desktop Downloads
Desktop Update Service
Authentication / Handoff
```

This is particularly useful when:

```text
The website works
but desktop downloads are unavailable.
```

or:

```text
Desktop works
but update checks fail.
```

---

# 68. 404 changes

The generic 404 does not need a redesign.

Add context-aware recovery for `/desktop/*`.

Examples:

```text
Invalid release version
→ View desktop releases

Invalid desktop page
→ Explore Tellann Desktop

Missing download
→ Download latest stable
```

---

# 69. Sitemap changes

Add static:

```text
/desktop
/desktop/download
/desktop/releases
/desktop/security
/desktop/requirements
```

and dynamically add:

```text
/desktop/releases/1.0.0
/desktop/releases/1.1.0
/desktop/releases/1.2.0
...
```

Only published releases should enter the sitemap.

Do not add draft/unreleased release URLs.

---

# 70. Internal search changes

If Tellann has site search later, index:

```text
Desktop
Desktop download
Windows app
Desktop security
System requirements
Release notes
Installer
Checksum
```

Release pages should also be searchable by version:

```text
1.4.0
v1.4.0
```

---

# 71. Required shared data architecture

Do not hardcode release facts independently into five pages.

Create one canonical release model.

For example:

```ts
type DesktopChannel =
  | "stable"
  | "beta"
  | "nightly";

type DesktopOS =
  | "windows"
  | "macos"
  | "linux";

type DesktopArch =
  | "x64"
  | "arm64";

interface DesktopArtifact {
  os: DesktopOS;
  arch: DesktopArch;
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
  sha256: string;
  signed: boolean;
  minimumOs?: string;
}

interface DesktopRelease {
  version: string;
  channel: DesktopChannel;
  publishedAt: string;

  title?: string;
  summary: string;

  features: string[];
  improvements: string[];
  fixes: string[];
  security: string[];
  breakingChanges: string[];
  knownIssues: string[];

  artifacts: DesktopArtifact[];

  deprecated?: boolean;
  withdrawn?: boolean;
}
```

Then all of these consume it:

```text
/desktop
/desktop/download
/desktop/releases
/desktop/releases/[version]
/changelog
Footer release CTA
```

One truth, many views.

---

# 72. Desktop capability registry

Likewise, create:

```ts
interface DesktopCapability {
  id: string;
  title: string;

  status:
    | "supported"
    | "beta"
    | "limited"
    | "coming-soon";

  frameworks?: string[];
  platforms?: string[];
  architectures?: string[];

  minimumVersion?: string;
  documentationHref?: string;
}
```

This powers:

```text
/desktop
/desktop/requirements
/docs
```

and prevents marketing drift.

---

# 73. Release pipeline integration

The ideal pipeline becomes:

```text
Desktop source
     ↓

CI build
     ↓

Test
     ↓

Sign artifact
     ↓

Calculate SHA-256
     ↓

Publish artifact
     ↓

Generate release manifest
     ↓

Marketing site consumes manifest
     ↓

/desktop/download
/releases
/version
```

The website should not depend on someone manually copying:

```text
Version: 1.4.0
Size: 124 MB
SHA: ...
```

into several React components after every release.

---

# 74. Handoff architecture

Centralize browser-to-desktop behavior.

Conceptually:

```text
Web application

POST /desktop/handoff
        ↓
Short-lived opaque token
        ↓
tellann://connect?<token>
        ↓
Desktop application
        ↓
Authenticate
        ↓
Validate handoff
        ↓
Select application/project
```

The custom protocol handler should validate:

```text
Origin
Token
Expiration
Intended organization/application
Current authenticated user
```

before acting.

Never trust arbitrary commands passed through the URI.

---

# 75. Analytics events

Track useful funnel data without turning the download flow into invasive telemetry.

Recommended web events:

```text
DESKTOP_PAGE_VIEWED

DESKTOP_DOWNLOAD_PLATFORM_SELECTED

DESKTOP_DOWNLOAD_STARTED

DESKTOP_RELEASE_VIEWED

DESKTOP_CHECKSUM_COPIED

DESKTOP_REQUIREMENTS_VIEWED

DESKTOP_SECURITY_VIEWED

DESKTOP_HANDOFF_STARTED

DESKTOP_HANDOFF_FALLBACK_SHOWN
```

The last two help determine whether the web → desktop connection is working.

---

# 76. SEO structured data

### `/desktop`

Use:

```text
SoftwareApplication
```

with actual supported OS and current version.

### `/desktop/download`

Also `SoftwareApplication`, but make `/desktop` canonical for broad product intent unless you specifically want download search traffic separated.

### Release pages

Use:

```text
TechArticle
```

or equivalent release-note article semantics.

Avoid stuffing every release page with identical software-application content.

---

# 77. Metadata

Suggested canonical titles:

```text
/desktop
Tellann Desktop | Tellann

/desktop/download
Download Tellann Desktop | Tellann

/desktop/releases
Tellann Desktop Releases | Tellann

/desktop/releases/1.4.0
Tellann Desktop 1.4.0 Release Notes | Tellann

/desktop/security
Tellann Desktop Security | Tellann

/desktop/requirements
Tellann Desktop System Requirements | Tellann
```

---

# 78. Social-preview assets

Create one reusable Desktop OpenGraph master:

```text
1200 × 630
```

Composition:

```text
Tellann logo

Tellann Desktop

Local project intelligence
with explicit developer control

[desktop screenshot crop]
```

Individual release pages can dynamically overlay:

```text
Desktop 1.4.0
```

but there is no need for a unique hand-designed image for every patch release.

---

# 79. Visual system

The current lightweight Windows utility presentation should be replaced with the current Tellann monochrome visual language.

Use:

```text
Near-black / black backgrounds
White primary text
Neutral gray borders
Muted secondary text
Sparse accent states
Large screenshots
Fine architectural lines
```

Avoid turning Desktop into a blue Windows-themed mini-brand.

It should look unmistakably like Tellann.

---

# 80. Animation system

Useful animations:

```text
Browser → Desktop handoff line
Local → Cloud permission boundary
Workspace scan progression
Review → Apply → Validate workflow
```

Keep them subtle.

Recommended durations:

```text
UI transitions       180–300ms
Diagram movements    600–1000ms
Looping architecture 6–10s
```

No endless glowing scanner animations.

---

# 81. Responsive behavior

The desktop product itself may target desktop computers, but the marketing pages must remain mobile-friendly.

Desktop compatibility tables should collapse from:

```text
Framework | Detection | Instrumentation | QA
```

into stacked cards.

Download page on phones should still work because someone may send themselves the installer link later.

If mobile OS is detected:

```text
Tellann Desktop isn't available for this device.

Choose your computer:
[ Windows ]
[ macOS ]
[ Linux ]
```

Do not show:

```text
Download for Android
```

simply because Android was detected.

---

# 82. Accessibility

Especially important on status matrices:

Do not represent:

```text
Supported = green dot
Unsupported = red dot
```

without text.

Use:

```text
✓ Supported
○ Coming soon
— Unsupported
```

Ensure:

```text
Keyboard-accessible OS tabs
Copy checksum button labels
Reduced-motion support
Readable code/checksum values
Focus states
Semantic tables
```

---

# 83. Claim-audit gate

Before public deployment, create a desktop marketing audit.

Each claim gets:

```text
Claim
Implementation source
Test evidence
Minimum supported version
Owner
Public status
```

For example:

| Claim                        | Must be verified from           |
| ---------------------------- | ------------------------------- |
| Detects Next.js              | Scanner implementation          |
| Supports pnpm                | package-manager adapter         |
| Modifies source syntax-aware | instrumentation implementation  |
| Rolls back changes           | rollback implementation/tests   |
| Stores credentials securely  | credential store implementation |
| Windows 10 supported         | packaged app testing            |
| Installer is signed          | release pipeline                |
| ARM64 supported              | published artifact              |
| SHA-256                      | release pipeline                |
| Runs approved dev processes  | command execution layer         |

This is necessary because the current product documents represent intended functionality, not automatically evidence that every capability has shipped.

---

# 84. Do not let Desktop expand MVP marketing incorrectly

Your existing routing plan is explicit that Tellann's public product should not presently be marketed as autonomous QA, AI testing, self-healing software or autonomous validation. 

The desktop application must not accidentally reintroduce that problem through copy such as:

```text
AI understands your whole repository
and automatically fixes your QA.
```

Prefer:

```text
Analyze the workspace.

Propose setup.

Review the changes.

Run Tellann.

Validate the connection.
```

The desktop application should make Tellann more capable without making the marketing more fantastical.

---

# 85. Final existing-page change matrix

| Existing surface              | Required change                                       |
| ----------------------------- | ----------------------------------------------------- |
| `routing_plan.md`             | Add `/desktop` family                                 |
| Shared route config           | Register Desktop routes                               |
| Navbar Product menu           | Add Desktop app + security                            |
| Developer mega-menu           | Add Download Desktop                                  |
| Footer                        | Add Desktop, Download, Releases, Requirements         |
| `/`                           | Add Desktop feature/workflow section                  |
| `/product`                    | Explain Desktop as local execution/connect layer      |
| `/product/how-it-works`       | Add manual vs Desktop-assisted setup                  |
| `/product/demonstration-mode` | Add Desktop-run workflow where shipped                |
| `/developers`                 | Add Desktop setup path                                |
| `/developers/quickstart`      | Add Desktop-assisted quickstart                       |
| `/developers/sdk`             | Link Desktop-guided SDK installation                  |
| `/security`                   | Add Desktop security card                             |
| `/security/privacy`           | Add local repository privacy link                     |
| `/pricing`                    | Add Desktop entitlement only after packaging decision |
| `/roadmap`                    | Add platform/OS expansion status                      |
| `/changelog`                  | Link Desktop announcements to release pages           |
| `status.tellann.co`           | Add Desktop download/update components                |
| XML sitemap                   | Add Desktop routes + releases                         |
| Site search                   | Index Desktop/release terms                           |
| 404                           | Add Desktop-specific recovery actions                 |
| SEO metadata                  | Add SoftwareApplication/release metadata              |
| Analytics                     | Add Desktop acquisition/handoff funnel                |

---

# 86. What should **not** change

Desktop should not cause architectural chaos elsewhere.

Do **not**:

```text
Rename /product to /platform.

Move SDK documentation under /desktop.

Move /security into /desktop/security.

Replace Developer Demonstration Mode with Desktop.

Turn /changelog into Desktop release history.

Make Desktop mandatory merely because it exists.

Create separate /windows, /mac and /linux marketing pages.

Expose internal repository-scanner architecture in the navbar.
```

The routing plan already has a strong information hierarchy. Desktop should become a new branch, not a root-system rewrite.

---

# 87. Recommended implementation order

I would execute it in this order:

```text
PHASE 1 — ROUTING FOUNDATION

1. Add /desktop route definitions.
2. Add shared Desktop nav configuration.
3. Add release/capability data models.
4. Extract existing download/handoff logic.

             ↓

PHASE 2 — CORE DESKTOP SURFACE

5. Redesign /desktop.
6. Build /desktop/download.
7. Preserve tellann://connect.
8. Add OS/architecture detection.

             ↓

PHASE 3 — DISTRIBUTION TRUST

9. Build /desktop/releases.
10. Build /desktop/releases/[version].
11. Connect release pipeline.
12. Publish SHA-256/signing data.

             ↓

PHASE 4 — TRUST & COMPATIBILITY

13. Build /desktop/security.
14. Build /desktop/requirements.
15. Audit actual desktop capabilities.

             ↓

PHASE 5 — SITE INTEGRATION

16. Product mega-menu.
17. Developer mega-menu.
18. Footer.
19. Homepage.
20. /product.
21. /product/how-it-works.
22. Developers hub.
23. Security pages.
24. Changelog.
25. Roadmap.

             ↓

PHASE 6 — DISCOVERY

26. Sitemap.
27. SEO metadata.
28. Structured data.
29. Site search.
30. Analytics.

             ↓

PHASE 7 — DOCUMENTATION

31. Installation guide.
32. Workspace guide.
33. Permission guide.
34. Handoff guide.
35. Update guide.
36. Verification guide.
37. Troubleshooting.
```

---

# 88. Final architecture

The resulting customer journey becomes:

```text
Discovery
   │
   ▼
/desktop
Understand the desktop product
   │
   ├───────────────┐
   │               │
   ▼               ▼
Security       Requirements
Trust it       Can I run it?
   │               │
   └───────┬───────┘
           ▼
     /desktop/download
           │
           ▼
     Install Tellann
           │
           ▼
     tellann://connect
           │
           ▼
      Local project
           │
           ▼
   Workspace analysis
           │
           ▼
Review → Approve → Validate
           │
           ▼
        QA Run
           │
           ▼
      Tellann Cloud
           │
           ▼
Reports / Behavior Intelligence
```

And the supporting maintenance path becomes:

```text
Desktop user
    │
    ├── What's new?
    │      ↓
    │ /desktop/releases
    │
    ├── Is my machine supported?
    │      ↓
    │ /desktop/requirements
    │
    ├── What can Tellann access?
    │      ↓
    │ /desktop/security
    │
    └── Something isn't working
           ↓
      docs.tellann.co/desktop/troubleshooting
```

That is the architecture I would implement.

The crucial change is conceptual: **`/desktop` stops being a download button with a page around it and becomes the public product surface for Tellann's local execution layer.** `/desktop/download` handles distribution, `/desktop/releases` provides provenance, `/desktop/security` earns permission to touch a developer's machine, and `/desktop/requirements` prevents ambiguous compatibility claims. Everything else in the existing marketing architecture then points into those pages without losing the Product → Understanding → Trust → Adoption journey established in the uploaded routing plan. 
