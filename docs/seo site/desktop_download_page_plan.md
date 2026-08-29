`/desktop/download` should be the **authoritative distribution page for Tellann Desktop**.

Its job is not to sell the concept of Desktop again—that belongs to `/desktop`. Its job is to help a visitor confidently answer:

> **Which installer should I download, is it compatible with my machine, is it authentic, and what happens after I install it?**

The desktop implementation is currently **Electron-based and Windows-first**, with Windows stable release preceding macOS planning. The first-time activation flow also expects a signed desktop application, browser-based authentication, device-bound login, project selection, and local workspace attachment.  

---

# `/desktop/download` — Complete Page Specification

## 1. Primary purpose

The page should answer, in this order:

```text
What platform did Tellann detect?

What is the latest stable Desktop version?

Which architecture should I download?

How large is the installer?

What Windows versions are supported?

Is the installer signed?

What is its SHA-256 checksum?

How do I install it?

How do I verify it?

Can I use another operating system?

What if I came here from a browser-to-desktop handoff?

What if Desktop is already installed?

Where can I find previous releases?

Where can I troubleshoot installation?
```

The visitor journey becomes:

```text
DETECT PLATFORM
      ↓
RECOMMEND ARTIFACT
      ↓
DOWNLOAD
      ↓
VERIFY
      ↓
INSTALL
      ↓
OPEN DESKTOP
      ↓
AUTHENTICATE
      ↓
CONNECT PROJECT
```

---

# 2. Overall page architecture

```text
/desktop/download
│
├── 01 Global Navbar
├── 02 Download Hero
├── 03 Recommended Download Card
├── 04 Platform & Architecture Selector
├── 05 Artifact Verification
├── 06 Installation Steps
├── 07 Browser → Desktop Handoff State
├── 08 What Happens After Installation
├── 09 System Requirements Summary
├── 10 Other Platforms
├── 11 Previous Stable Releases
├── 12 Update / Existing Installation
├── 13 Download FAQ
├── 14 Troubleshooting & Security Links
├── 15 Final Download CTA
└── 16 Global Footer
```

This page should be substantially shorter than `/desktop` or `/desktop/security`.

Recommended full desktop height:

```text
5,500–7,000px
```

---

# 3. Page width and spacing

Use the standard Tellann marketing shell.

```text
Maximum viewport canvas     1440px
Primary container           1280px
Normal content              680–760px
Download card max width     960–1040px
Full-width technical block  1180–1280px

Desktop section spacing     96–120px
Tablet                      72–88px
Mobile                      56–72px

Desktop horizontal padding  64–80px
Tablet                      40px
Mobile                      20–24px
```

Unlike `/desktop`, this page should feel more utilitarian.

Fewer giant marketing sections.

More precise information.

---

# 4. Section 01 — Global navbar

Use the normal marketing navbar.

Context:

```text
Product / Desktop / Download
```

Desktop should remain visually under **Product**.

No download-specific navigation bar.

---

# 5. Section 02 — Download hero

## Layout

Centered.

```text
              TELLANN DESKTOP

        Download Tellann Desktop

Install the local Tellann application and connect
your development workspace to Tellann.

             [Windows icon]
      We detected Windows

      Latest stable · v1.x.x

         [ Download for Windows ]

      x64 · XX MB · Signed installer

          View all platforms ↓
```

---

# 6. Hero typography

Eyebrow:

```text
TELLANN DESKTOP
12–14px
uppercase
letter spacing ~0.14em
```

H1:

> **Download Tellann Desktop**

Sizing:

```text
Desktop: 64–72px
Tablet:  52–58px
Mobile:  40–44px
```

Support copy:

```text
18–20px
Max width 680px
```

Keep this hero more restrained than the `/desktop` hero.

---

# 7. Platform detection

On page load, detect:

```text
Operating system
Architecture where reliably available
Browser/device type
```

Possible platform states:

```text
Windows
macOS
Linux
Mobile / tablet
Unknown
```

Important rule:

**detection chooses a recommendation; it does not start the download automatically.**

---

# 8. Windows detection state

If Windows:

```text
Detected

Windows

Recommended
Tellann Desktop 1.4.0
Windows x64

[ Download .exe ]
```

If ARM architecture is known and supported:

```text
Windows ARM64
```

Otherwise do not guess.

---

# 9. Unsupported-platform state

If macOS before macOS is actually available:

```text
Tellann Desktop for macOS
Coming later

Tellann Desktop is currently available for Windows.

[ Download for Windows ]
[ Get notified about macOS ]
```

I would not add a notify feature unless you actually plan to store those subscriptions.

A simpler alternative:

```text
View roadmap →
```

---

# 10. Mobile visitor state

If Android/iOS:

```text
Tellann Desktop runs on computers.

Choose the computer you use for development:

[ Windows ]
[ macOS — Coming later ]
[ Linux — Coming later ]
```

Optional:

```text
Copy download link
```

or:

```text
Email me the download link
```

Only implement the latter if you genuinely want that workflow.

---

# 11. Hero product image

Unlike `/desktop`, this page does not need a huge product showcase.

Use a compact installer/application image.

### Asset

```text
DL-01
Tellann Desktop installer / launch screen
```

Source:

```text
1400 × 900
```

Displayed:

```text
Desktop:
680 × 437px
```

Placement:

Below the first download card or slightly right of the hero on extremely wide screens.

I would still prefer a **centered download-first hero** over a 50/50 layout.

---

# 12. Hero animation

Keep it minimal.

Possible sequence:

```text
Download
   ↓
Install
   ↓
Open
   ↓
Sign in
   ↓
Connect project
```

Use five tiny inline states beneath the CTA.

Each icon can reveal with:

```text
opacity
translateY 6px
```

Duration:

```text
200ms each
80ms stagger
```

No full-screen installation video in the hero.

---

# 13. Section 03 — Recommended download card

This is the central component.

Example:

```text
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Tellann Desktop                                     │
│                                                      │
│  Version 1.4.0                        STABLE          │
│                                                      │
│  Windows 11 / Windows 10                             │
│  x64                                                 │
│  128.4 MB                                            │
│                                                      │
│  Signed installer                                    │
│                                                      │
│  [ Download Tellann Desktop ]                        │
│                                                      │
│  Released August 28, 2026                            │
│  Release notes →                                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Dimensions:

```text
Desktop width   960–1040px
Min height      340–400px
```

---

# 14. Download CTA behavior

CTA should contain enough information:

```text
Download for Windows
```

Secondary text under button:

```text
Windows x64 · 128.4 MB
```

If user manually selects ARM64:

```text
Download Windows ARM64
```

Do not use generic:

```text
Download now
```

when a platform-specific artifact exists.

---

# 15. Release metadata

The card should expose:

```text
Version
Channel
Release date
Operating system
Architecture
Installer format
File size
Signing status
Minimum supported OS
```

Optional:

```text
Minimum supported Desktop protocol
```

if relevant later.

---

# 16. Release manifest model

All download information should come from one canonical source.

For example:

```ts
interface DesktopReleaseArtifact {
  os: "windows" | "macos" | "linux";
  arch: "x64" | "arm64";

  format: "exe" | "msi" | "dmg" | "pkg" | "deb" | "rpm";

  filename: string;
  url: string;

  sizeBytes: number;

  sha256: string;

  signed: boolean;
  signaturePublisher?: string;

  minimumOs?: string;
}

interface DesktopRelease {
  version: string;

  channel:
    | "stable"
    | "beta"
    | "nightly";

  releasedAt: string;

  artifacts: DesktopReleaseArtifact[];
}
```

Do not hardcode these values into `page.tsx`.

---

# 17. Section 04 — Platform selector

Heading:

> **Choose your platform**

Display tabs/cards:

```text
Windows
Available

macOS
Coming later

Linux
Coming later
```

The current implementation plan explicitly calls for a Windows-first Electron application, with macOS planning only after Windows stability criteria are met. 

---

# 18. Platform cards

Desktop:

```text
3 cards × ~390px
Gap 24px
```

Each card:

```text
Platform icon

Windows

Stable

Windows 10 / 11
x64

[ Download ]
```

Unsupported:

```text
macOS

Coming later

Not currently available.
```

Do not show dead download buttons.

---

# 19. Architecture selector

Inside the Windows card:

```text
Architecture

● x64
○ ARM64
```

Only display ARM64 if an actual artifact exists.

Otherwise:

```text
x64
Available

ARM64
Not currently supported
```

---

# 20. Installer type selector

If you publish multiple formats:

```text
Recommended

.exe installer
```

Secondary:

```text
.msi
Enterprise deployment
```

Only implement if the release pipeline actually produces both.

Do not invent `.msi` merely because it would look professional.

---

# 21. Section 05 — Verify your download

Heading:

> **Verify before you install.**

This is particularly important because the desktop application eventually holds significant local permissions.

The implementation plan explicitly includes packaging/signing/updater configuration and calls for update-signature validation as part of desktop security testing.  

---

# 22. Verification panel

```text
Tellann Desktop 1.4.0

Filename
tellann-desktop-1.4.0-win-x64.exe

Size
128.4 MB

Signature
Valid / Signed

SHA-256
af37f7c9e...

[ Copy SHA-256 ]

[ Verification instructions ]
```

Desktop:

```text
Width 1000–1100px
Height 380–440px
```

---

# 23. Checksum behavior

Display checksum in a monospaced field.

```text
SHA-256

AF2C 4E91 7A...
```

Actions:

```text
Copy
```

After copy:

```text
Copied
```

Accessible status announcement.

Do not visually truncate the checksum unless there is an expandable full value.

---

# 24. Signature information

If Windows Authenticode or equivalent signing is implemented, show:

```text
Digital signature

Publisher
Tellann Technologies Limited

Status
Valid
```

However, the marketing site must read this from release metadata.

Do not hardcode the publisher identity until the certificate actually exists.

---

# 25. Verification diagram

Use a simple SVG:

```text
Downloaded installer
       ↓
Signature
       +
SHA-256
       ↓
Matches Tellann release
       ↓
Safe to continue
```

Dimensions:

```text
Source 1000 × 300 SVG
Display 820 × 246
```

No shield animation necessary.

---

# 26. Section 06 — Installation steps

Heading:

> **Install in a few steps**

Keep it concise.

Desktop:

```text
01 Download
02 Install
03 Sign in
04 Connect project
```

---

# 27. Step 1 — Download

```text
Download the installer appropriate
for your operating system and architecture.
```

Image:

Small screenshot of browser download.

Source:

```text
1000 × 640
```

Displayed:

```text
520 × 333
```

---

# 28. Step 2 — Install

Show Windows installer or security prompt.

Source:

```text
1000 × 700
```

Displayed:

```text
520 × 364
```

Do not manufacture a Windows SmartScreen success state if you do not know what the actual signed build presents.

---

# 29. Step 3 — Sign in

The first-time activation specification says Desktop opens the system browser for Tellann authentication and completes a device-bound login. 

Show:

```text
Tellann Desktop
   ↓
System browser
   ↓
Sign in to Tellann
   ↓
Return to Desktop
```

Use a simple visual rather than another screenshot.

SVG:

```text
900 × 420
```

---

# 30. Step 4 — Connect project

Show:

```text
Open local folder
Clone repository
Attach staging URL
Browser-only
```

The Desktop project flow is explicitly intended to support these working modes. 

Screenshot:

```text
1440 × 900 source
720 × 450 displayed
```

---

# 31. Installation step layout

Desktop:

```text
2 × 2 grid
```

Each card:

```text
580–610px wide
480–520px high
```

Mobile:

```text
single vertical stack
```

---

# 32. Installation animation

I would not use a video.

Use small step-state transitions when cards enter viewport:

```text
Download ✓
Install ✓
Authenticate ✓
Connect ✓
```

Each check appears after:

```text
120ms stagger
```

Keep it restrained.

---

# 33. Section 07 — Browser → Desktop handoff

This section is critical because `/desktop/download` is also the fallback destination when a user clicks an action that expects Desktop.

It needs two modes:

```text
NORMAL DOWNLOAD MODE

and

HANDOFF MODE
```

---

# 34. Normal mode

Normal URL:

```text
/desktop/download
```

Shows the standard download experience.

---

# 35. Handoff mode

Example route state:

```text
/desktop/download?handoff=<opaque-token>
```

or preferably an opaque server-generated handoff identifier.

The page changes its hero to:

> **Continue connecting your Tellann project**

Supporting:

> Tellann Desktop is required to continue this local project workflow.

Actions:

```text
[ Open Tellann Desktop ]

Don't have it installed?

[ Download for Windows ]
```

---

# 36. Custom protocol

The page can invoke:

```text
tellann://connect
```

or an equivalent route.

Important architecture:

```text
Browser
   ↓
Opaque handoff
   ↓
tellann://connect
   ↓
Tellann Desktop
   ↓
Validate token
   ↓
Authenticated device/session
   ↓
Continue intended workflow
```

Never place:

```text
API secrets
refresh tokens
SDK secret values
arbitrary commands
local filesystem paths
```

inside the deep-link URI.

---

# 37. Handoff state — Desktop installed

When the user clicks:

```text
Open Tellann Desktop
```

show:

```text
Opening Tellann Desktop…
```

Then after a short client-side timeout:

```text
Didn't open?

[ Try again ]

or

[ Download Tellann Desktop ]
```

Do not permanently show a spinner.

---

# 38. Handoff state — Desktop missing

Fallback:

```text
Tellann Desktop did not open.

Install the application, then return here.

[ Download for Windows ]

After installation:

[ Open Tellann Desktop ]
```

The intended handoff token should remain valid for an appropriately short period or be recoverable after authentication.

---

# 39. Handoff state — expired

If token is invalid/expired:

```text
This desktop connection has expired.

For security, Tellann desktop handoffs
are temporary.

[ Return to Tellann ]
```

Do not silently proceed.

---

# 40. Handoff illustration

Use a compact SVG.

```text
Browser
  │
  │ tellann://
  ▼
Desktop
  │
  ▼
Project
```

Source:

```text
1100 × 360
```

Display:

```text
900 × 295
```

Animation:

A single token/packet moves from browser to Desktop.

Duration:

```text
1.2–1.6s
```

Trigger only when user presses **Open Tellann Desktop**.

---

# 41. Section 08 — What happens after installation

Heading:

> **What happens the first time you open Tellann Desktop?**

Use the source-backed activation lifecycle.

The current implementation plan describes:

1. install signed application,
2. authenticate in browser,
3. select/create organization/application,
4. open local project/clone repository/attach staging URL,
5. request read-only access,
6. scan without running repository scripts. 

---

# 42. First launch timeline

```text
INSTALL
  ↓
SIGN IN
  ↓
SELECT APPLICATION
  ↓
ATTACH PROJECT
  ↓
READ-ONLY ACCESS
  ↓
WORKSPACE ANALYSIS
  ↓
READY
```

Use a horizontal timeline desktop, vertical mobile.

Dimensions:

```text
Desktop visual:
1200 × 260
```

---

# 43. First-run screenshot

Show:

```text
Welcome to Tellann Desktop

Sign in to continue.

[ Sign in with Tellann ]
```

Source:

```text
1440 × 900
```

Display:

```text
760 × 475
```

If the real first-run UI differs, capture the actual UI instead.

---

# 44. Section 09 — System requirements preview

Do not replicate `/desktop/requirements`.

Heading:

> **Before you install**

Show only:

```text
Operating system
Architecture
Memory
Disk
Network
Development tools
```

Example layout:

```text
OS
Windows 11 / supported Windows 10 release

Architecture
x64

Disk
Measured installed requirement

Network
HTTPS access to Tellann

Additional tools
Project-dependent
```

All values should come from the canonical compatibility data source.

---

# 45. Requirements CTA

```text
View full system requirements →
```

Destination:

```text
/desktop/requirements
```

---

# 46. Requirements visual

No image required.

Use six compact specification cards.

Desktop:

```text
3 × 2
```

Each:

```text
~390 × 140px
```

---

# 47. Section 10 — Other platforms

Heading:

> **Desktop availability**

Use an honest compatibility grid.

```text
Windows
Available

macOS
Planned

Linux
Planned
```

The desktop implementation plan is explicitly Windows-first and does not call for macOS work until Windows stability criteria are met. 

---

# 48. Unsupported platform messaging

Avoid:

> Coming very soon.

Use:

```text
Not currently available
```

or:

```text
Planned after Windows stability milestones
```

if you want to reflect the documented implementation order.

---

# 49. Section 11 — Previous stable releases

Heading:

> **Previous releases**

Do not dump every build.

Show:

```text
Latest stable
Previous stable
Older supported releases
```

For example:

```text
1.4.0
Latest stable
Aug 28, 2026
[ Release notes ] [ Download ]

1.3.4
Supported
Aug 12, 2026
[ Release notes ] [ Download ]

1.3.3
Supported
Jul 29, 2026
[ Release notes ] [ Download ]
```

---

# 50. Previous releases data

Each row:

```text
Version
Release date
Status
OS
Architecture
Security note indicator
Download
```

Link full archive:

```text
View all Desktop releases →
```

Destination:

```text
/desktop/releases
```

---

# 51. Old build warning

If a user downloads an older release:

```text
You're downloading Tellann Desktop 1.2.0.

The current stable version is 1.4.0.

[ Download current stable ]
[ Continue with 1.2.0 ]
```

For security-withdrawn versions:

```text
Download disabled.
```

Do not allow casual access to known-bad artifacts.

---

# 52. Section 12 — Existing installation

Heading:

> **Already have Tellann Desktop?**

Possible actions:

```text
Open Tellann Desktop
Check latest release
View update instructions
```

If handoff present:

```text
Continue in Desktop
```

---

# 53. Minimum supported version

The desktop backend design explicitly anticipates a **minimum supported desktop version response**. 

The marketing page can later expose:

```text
Minimum supported
1.2.0

Current stable
1.4.0
```

But this should be generated from actual backend/release policy.

---

# 54. Update-needed state

If the website knows the installed version through a safe handoff mechanism:

```text
Tellann Desktop 1.1.0 is no longer supported.

Update to 1.4.0 to continue.

[ Download update ]
```

Never fingerprint local installed software through invasive browser tricks.

Only use explicit Desktop/browser communication where available.

---

# 55. Section 13 — FAQ

Recommended questions:

```text
Which operating systems does Tellann Desktop support?

How do I know whether I need x64 or ARM64?

Is Tellann Desktop free to download?

Does installing Desktop give Tellann access to my files?

Do I need the SDK before installing Desktop?

Can I use Tellann Desktop without a repository?

How do I verify the installer?

What does the tellann:// link do?

Can I install an older release?

How are Desktop updates delivered?

What happens if Desktop will not open?
```

Important: don't conflate download entitlement with feature entitlement.

The desktop specification suggests guided browser runs may be broadly available while advanced features are entitlement-based. 

---

# 56. FAQ layout

Desktop:

```text
Left:  35%
Right: 65%
```

Accordion:

```text
max-width 760px
```

Animation:

```text
180–220ms
```

---

# 57. Section 14 — Troubleshooting & trust links

Heading:

> **Need help installing?**

Four cards:

```text
Installation guide
docs.tellann.co/desktop/installation

System requirements
/desktop/requirements

Desktop security
/desktop/security

Release history
/desktop/releases
```

Possible fifth:

```text
Troubleshooting
docs.tellann.co/desktop/troubleshooting
```

---

# 58. Troubleshooting quick links

Useful topics:

```text
Installer won't launch
Windows security warning
Desktop won't open after install
Authentication won't return to Desktop
tellann:// link doesn't open
Unsupported Windows version
Corporate proxy/firewall
Update failed
```

Detailed answers remain in docs.

---

# 59. Section 15 — Final CTA

Final CTA should remain functional rather than marketing-heavy.

Heading:

> **Install Tellann Desktop**

Subtext:

> Connect local development workflows to Tellann from a controlled desktop environment.

Primary:

```text
Download for Windows
```

Secondary:

```text
View system requirements
```

Below:

```text
Stable vX.X.X · Windows x64 · Signed installer
```

---

# 60. Final CTA image

Use a compact Tellann Desktop launch screen.

Source:

```text
1400 × 900
```

Displayed:

```text
840 × 540
```

Only top ~320px visible from bottom of section.

This creates continuity with the main Desktop page without adding another full showcase.

---

# 61. Images required

I would keep the download page lean.

| ID    | Asset                               | Source dimensions | Placement          |
| ----- | ----------------------------------- | ----------------: | ------------------ |
| DL-01 | Desktop installer/app launch screen |          1400×900 | Hero               |
| DL-02 | Browser download screenshot         |          1000×640 | Installation       |
| DL-03 | Windows installer screenshot        |          1000×700 | Installation       |
| DL-04 | Authentication handoff diagram      |       900×420 SVG | Installation       |
| DL-05 | Connect-project screenshot          |          1440×900 | Installation       |
| DL-06 | Browser→Desktop handoff diagram     |      1100×360 SVG | Handoff            |
| DL-07 | First-launch/sign-in screenshot     |          1440×900 | After installation |
| DL-08 | Verification diagram                |      1000×300 SVG | Verification       |
| DL-09 | Final CTA app crop                  |          1400×900 | Final CTA          |
| DL-10 | OpenGraph image                     |          1200×630 | SEO/social         |

Only **6 actual raster product screenshots + 3 SVG diagrams + 1 OG asset** are really necessary.

---

# 62. Video strategy

I would use **no normal video on `/desktop/download`**.

The visitor is here to obtain software, not watch another product demo.

That improves:

```text
page speed
clarity
download conversion
mobile performance
```

The `/desktop` route already carries the product video.

---

# 63. Optional micro-animation instead of video

Use a tiny installation lifecycle:

```text
Browser
   ↓
Installer
   ↓
Desktop
   ↓
Tellann login
```

Source:

HTML/SVG.

Canvas:

```text
900 × 280
```

Duration:

```text
3–4 seconds
```

Run once.

That is sufficient.

---

# 64. Download interaction states

The primary button needs several states.

### Idle

```text
Download for Windows
```

### Resolving

```text
Preparing download…
```

Only momentarily if the URL is generated dynamically.

### Started

```text
Download started
```

Then show:

```text
Having trouble?
Download again
```

### Failed

```text
Download unavailable

[ Try again ]
[ View status ]
```

Never leave the button spinning indefinitely.

---

# 65. Download status analytics

Useful events:

```text
DESKTOP_DOWNLOAD_PAGE_VIEWED

DESKTOP_PLATFORM_DETECTED

DESKTOP_PLATFORM_SELECTED

DESKTOP_ARCH_SELECTED

DESKTOP_DOWNLOAD_STARTED

DESKTOP_DOWNLOAD_FAILED

DESKTOP_CHECKSUM_COPIED

DESKTOP_RELEASE_NOTES_OPENED

DESKTOP_HANDOFF_ATTEMPTED

DESKTOP_HANDOFF_FALLBACK_SHOWN

DESKTOP_REQUIREMENTS_OPENED
```

Do not log the opaque handoff token.

---

# 66. Release URL validation

Each download request should resolve to an artifact from a release manifest.

Conceptually:

```text
GET release manifest
      ↓
Find platform + architecture
      ↓
Validate artifact state
      ↓
Return CDN/object-storage URL
```

Never assemble download paths manually in the browser from:

```text
/version/os/arch.exe
```

unless the manifest validates them.

---

# 67. Release artifact states

Support:

```text
AVAILABLE
WITHDRAWN
DEPRECATED
UNSUPPORTED
COMING_SOON
```

### Withdrawn

```text
This release has been withdrawn.

Reason:
Security or stability issue.

Recommended:
1.4.1
```

No download button.

---

# 68. File-hosting considerations

Installer assets should live behind a stable distribution layer such as:

```text
downloads.tellann.co
```

or a trusted CDN/object-storage domain.

Example conceptual URL:

```text
downloads.tellann.co/desktop/1.4.0/windows/x64/...
```

The marketing route stays:

```text
tellann.co/desktop/download
```

The user should not need to know the underlying object-storage bucket.

---

# 69. Cache policy

HTML:

```text
short cache / revalidate
```

Release artifact:

```text
immutable
```

Release manifest:

```text
short-lived caching
```

because current stable version may change.

Artifacts themselves must never mutate in place.

If:

```text
1.4.0
```

changes, that is a new build/version.

Not a silently replaced installer.

---

# 70. SEO

This page has some search value, but should remain primarily transactional.

Title:

```text
Download Tellann Desktop | Tellann
```

Description:

```text
Download the latest stable Tellann Desktop release,
view supported platforms and system requirements,
and verify installer signatures and SHA-256 checksums.
```

Canonical:

```text
https://tellann.co/desktop/download
```

---

# 71. Structured data

Use:

```text
SoftwareApplication
```

where appropriate.

Fields can include:

```text
name
softwareVersion
operatingSystem
applicationCategory
downloadUrl
fileSize
releaseNotes
```

Only provide values sourced from current release metadata.

---

# 72. OpenGraph asset

Source:

```text
1200 × 630
```

Layout:

```text
TELLANN DESKTOP

Download Tellann Desktop

Windows · Stable release

[small desktop app screenshot]
```

Keep the actual version out of a static OG image unless it is dynamically generated.

Otherwise the preview becomes outdated immediately.

---

# 73. Accessibility

Platform selection must not rely on logos alone.

Use:

```text
Windows
Available
```

not just the Windows icon.

Checksum must be:

```text
selectable
keyboard accessible
copyable
screen-reader labelled
```

Download buttons should expose:

```text
Download Tellann Desktop 1.4.0 for Windows x64
```

to assistive technology.

---

# 74. Mobile design

On mobile:

Hero becomes:

```text
Download Tellann Desktop

Desktop is intended for computers.

Detected:
Android

Choose your development computer:

[ Windows ]
[ macOS — unavailable ]
[ Linux — unavailable ]
```

Do not hide the page from mobile visitors.

---

# 75. Mobile artifact card

Stack:

```text
Version
Platform
Architecture
Size
Signing status

[ Download ]
```

No wide specification table.

---

# 76. Responsive images

Raster sources:

```text
480w
768w
1024w
1400w
```

Use:

```text
AVIF
WebP fallback
```

Technical screenshots containing very fine text may require slightly higher quality than marketing photography.

---

# 77. Performance requirements

This page should be one of the fastest product pages.

Target:

```text
No autoplay video

Hero raster              <250KB ideally
SVG diagrams              <80KB each
Below-fold screenshots    lazy-loaded

LCP                       <2.0–2.5s
CLS                       ~0
```

The download CTA should be usable before all secondary assets load.

---

# 78. Security considerations

The page itself needs a few strong guarantees.

Do not:

```text
embed credentials in download links
embed refresh tokens in tellann:// URLs
trust client-provided version metadata
allow arbitrary protocol parameters
auto-run downloaded files
auto-launch Desktop without explicit user action
```

Browser handoff should use a short-lived opaque server-authorized token.

The desktop architecture already separates Desktop credentials from tested applications and plans short-lived run-scoped credentials instead of exposing management credentials. 

---

# 79. Desktop installer claims

Before launch, verify all of these:

| Claim                     | Required proof                 |
| ------------------------- | ------------------------------ |
| “Signed installer”        | Actual signed release artifact |
| Publisher identity        | Certificate metadata           |
| File size                 | Build artifact metadata        |
| SHA-256                   | CI release output              |
| Windows 10 supported      | Compatibility test             |
| Windows 11 supported      | Compatibility test             |
| x64 supported             | Artifact                       |
| ARM64 supported           | Artifact                       |
| Automatic updates         | Updater implementation         |
| Update verification       | Update-signature test          |
| Minimum supported version | Backend/version policy         |
| `tellann://` handoff      | Registered protocol + test     |

The implementation plan explicitly calls for signing, updater configuration, token security and update-signature testing, but those are implementation requirements, not proof that the current public build already satisfies them.  

---

# 80. Relationship with `/desktop`

The distinction should be obvious.

```text
/desktop

What is Tellann Desktop?
Why do I need it?
What does it do?
```

versus:

```text
/desktop/download

Which build do I install?
How do I verify it?
How do I get started?
```

The download page should not repeat the workspace-intelligence, QA run, architecture, or instrumentation product story in depth.

---

# 81. Relationship with `/desktop/security`

Use:

```text
Why does Tellann Desktop need local access?

Read Desktop Security →
```

Do not reproduce the entire permission model here.

---

# 82. Relationship with `/desktop/requirements`

Use a short compatibility summary:

```text
Windows · x64 · XX GB disk · XX GB RAM
```

then:

```text
View full system requirements →
```

The detailed framework/tool/network matrices remain under `/desktop/requirements`.

---

# 83. Relationship with `/desktop/releases`

The current release card links:

```text
Release notes →
```

to:

```text
/desktop/releases/1.4.0
```

Previous releases link into the same route family.

`/desktop/download` should not become a changelog.

---

# 84. Relationship with documentation

Keep detailed procedures in:

```text
docs.tellann.co/desktop
├── installation
├── verify-download
├── first-launch
├── browser-handoff
├── updates
└── troubleshooting
```

The routing plan already separates developer documentation from the marketing website, which is the correct architectural choice. 

---

# 85. Final page flow

The finished page should feel like this:

```text
DOWNLOAD TELLANN DESKTOP

We detected Windows.

Latest stable
v1.4.0

Windows x64
128 MB
Signed

[ Download ]

         ↓

CHOOSE YOUR PLATFORM

Windows     Available
macOS       Coming later
Linux       Coming later

         ↓

VERIFY YOUR INSTALLER

Filename
Signature
SHA-256
Release

         ↓

INSTALL

Download
   ↓
Install
   ↓
Sign in
   ↓
Connect project

         ↓

COMING FROM TELLANN?

[ Open Tellann Desktop ]

Don't have it installed?
[ Download ]

         ↓

FIRST LAUNCH

Authenticate
Select application
Attach project
Grant read access
Analyze
Ready

         ↓

SYSTEM REQUIREMENTS

         ↓

PREVIOUS RELEASES

         ↓

HELP

Installation
Security
Requirements
Troubleshooting

         ↓

DOWNLOAD TELLANN DESKTOP
```

The key principle is that `/desktop/download` should feel almost like a **software release portal wearing the Tellann brand**, not a second marketing landing page. The visitor should never need to wonder which file to choose, whether it is authentic, whether it will run on their system, or how to continue the browser-to-desktop workflow after installation.
