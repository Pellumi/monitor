`/desktop/security` should be the **technical trust page for Tellann Desktop**.

The broader `/security` page answers, “How is the Tellann platform secured?” `/desktop/security` answers the harder question:

> **What exactly happens when I give Tellann access to my computer, repository, browser, and development environment?**

That distinction matters. The desktop specification makes the installed application authoritative for local workspace access, repository scanning, managed-browser runs, instrumentation, local permissions, and local artifact preparation, while cloud services remain authoritative for shared applications, reports, governance, billing, and audit. 

The security architecture itself is built around zero trust, least privilege, defense in depth, privacy by design, secure defaults, tenant isolation, and auditability. Those principles should become visible product behavior on this page rather than disappearing into compliance language. 

---

# `/desktop/security` — Complete Page Specification

## 1. Page objective

The page should answer these questions in order:

```text
Why should I trust Tellann Desktop?

What can it see?

What remains local?

What can be synchronized?

Does read access allow modification?

Can Tellann execute commands?

Can it modify my code?

What happens before a modification?

Can changes be rolled back?

What does Tellann capture during QA runs?

What information is explicitly excluded?

What happens in production environments?

How is the desktop application authenticated?

How do I verify the installer?
```

The narrative:

```text
TRUST
  ↓
BOUNDARY
  ↓
PERMISSIONS
  ↓
LOCAL SCANNING
  ↓
DATA MOVEMENT
  ↓
PRIVACY FILTERING
  ↓
SOURCE CHANGES
  ↓
COMMAND EXECUTION
  ↓
VALIDATION / ROLLBACK
  ↓
PRODUCTION SAFETY
  ↓
AUTHENTICATION / ENCRYPTION
  ↓
INSTALLER TRUST
  ↓
FULL SECURITY DOCUMENTATION
```

---

# 2. Overall page architecture

```text
/desktop/security
│
├── 01 Global Navbar
├── 02 Security Hero
├── 03 Trust Principles
├── 04 Local ↔ Cloud Trust Boundary
├── 05 Permission Model
├── 06 What Workspace Analysis Can Inspect
├── 07 What Tellann Does Not Do During Analysis
├── 08 What Stays Local / What May Synchronize
├── 09 Privacy Filtering Before Transmission
├── 10 Sensitive Data Exclusion
├── 11 Safe Instrumentation
├── 12 Diff Review & Approved Scope
├── 13 Command Execution Controls
├── 14 Validation & Rollback
├── 15 Production Environment Restrictions
├── 16 QA Run Privacy
├── 17 Authentication & Device Trust
├── 18 Encryption & Secure Communication
├── 19 Auditability & Permission History
├── 20 Installer & Update Integrity
├── 21 Security FAQ
├── 22 Security Resources
├── 23 Final CTA
└── 24 Global Footer
```

This can comfortably run **9,000–11,000px** at desktop width because security buyers will actually read it.

---

# 3. Layout system

Use the same Tellann monochrome system as `/desktop`.

```text
Maximum viewport canvas     1440px
Main content width          1280px
Normal text width           620–720px
Technical text width        760–840px
Large diagrams              1180–1280px
Section vertical spacing    120–144px
Mobile spacing              64–80px

Desktop horizontal padding  64–80px
Tablet                      40px
Mobile                      20–24px
```

Security pages should use more whitespace and fewer decorative effects than the main `/desktop` product page.

---

# 4. Section 01 — Global navbar

Use normal marketing navigation.

Breadcrumb-like context can appear below the nav:

```text
Product / Desktop / Security
```

Desktop Security should **not** become a new top-level navigation category.

---

# 5. Section 02 — Security hero

## Layout

Centered text with a large trust-boundary diagram immediately beneath it.

```text
             DESKTOP SECURITY

Your repository is not
an unrestricted permission.

Tellann Desktop separates inspection,
modification, command execution and cloud
synchronization into explicit security boundaries.

[ See the trust model ]   [ Platform security → ]


         LARGE TRUST DIAGRAM
```

---

# 6. Hero typography

Eyebrow:

```text
DESKTOP SECURITY
12–14px
uppercase
tracking 0.14em
```

H1:

```text
Desktop: 72–80px
Tablet:  56–64px
Mobile:  42–46px
Max-width: 960px
```

Recommended H1:

> **Your repository is not an unrestricted permission.**

Supporting copy:

> Tellann Desktop is designed around explicit permissions. Reading a workspace, proposing a change, modifying approved files, running commands, and synchronizing information are separate operations.

This directly reflects the desktop permission model, where entitlements and local permission are independent and permission escalation is explicit. 

---

# 7. Hero CTAs

Primary scroll CTA:

```text
See the trust boundary
```

Secondary:

```text
Platform security →
```

to:

```text
/security
```

Tertiary subtle link:

```text
Privacy & data collection →
```

to:

```text
/security/privacy
```

---

# 8. Hero visual — trust boundary

This is the single most important visual asset on the page.

Use **SVG/HTML**, not an exported image.

### Canvas

```text
Source canvas:    1600 × 920
Display desktop:  1240 × 713
Aspect ratio:     ~1.74:1
```

Diagram:

```text
┌────────────────────────────────┐
│ YOUR COMPUTER                  │
│                                │
│ Repository                     │
│ ├─ Git                         │
│ ├─ package.json                │
│ ├─ routes                      │
│ ├─ tests                       │
│ └─ documentation               │
│         │                      │
│         ▼                      │
│    TELLANN DESKTOP             │
│                                │
│ Read     Modify    Run         │
│   │        │        │          │
│ separate permission boundaries│
└──────────────┬─────────────────┘
               │
               │ Approved /
               │ derived information
               ▼
┌────────────────────────────────┐
│ TELLANN CLOUD                  │
│                                │
│ Applications                   │
│ Intent                         │
│ Runs                           │
│ Reports                        │
│ Governance                     │
└────────────────────────────────┘
```

Desktop remains the execution environment, while cloud state remains authoritative for shared product information. 

---

# 9. Hero animation

One-time viewport animation:

```text
0.0s  Repository appears
0.7s  Desktop boundary appears
1.4s  READ permission resolves
2.0s  MODIFY remains locked
2.5s  RUN remains locked
3.0s  Derived-data path appears
3.8s  Tellann Cloud resolves
```

Duration:

```text
4–5 seconds
```

Run once.

No glowing security shields flying around.

---

# 10. Section 03 — Trust principles

Heading:

> **Security begins with narrower permissions, not broader promises.**

Use four horizontal cards:

```text
LEAST PRIVILEGE
Request only what is needed.

LOCAL FIRST
Local execution stays local where possible.

EXPLICIT SCOPE
Changes and commands have defined boundaries.

REVOCABLE
Access can be denied or revoked.
```

The platform security specification explicitly requires least privilege, zero trust, privacy-by-design, secure defaults and auditability. 

Desktop:

```text
4 × 1
Card width ~300px
Height 190–220px
```

Tablet:

```text
2 × 2
```

Mobile:

```text
1 × 4
```

---

# 11. Section 04 — Permission model

Heading:

> **One permission does not become every permission.**

This should be one of the strongest sections.

The desktop specification defines separate levels:

1. browser-only,
2. read workspace,
3. propose instrumentation,
4. apply approved task,
5. run approved commands,
6. confirm sensitive browser action. 

---

# 12. Permission ladder

Use HTML/CSS.

Desktop layout:

```text
Browser only
     ↓
Read workspace
     ↓
Propose changes
     ↓
Apply approved task
     ↓
Run approved commands
     ↓
Sensitive action confirmation
```

Dimensions:

```text
Left visual:  500 × 720
Right copy:   600–650px
Gap:          80px
```

Each permission node:

```text
Width 420px
Height 72–84px
```

---

# 13. Permission interaction

Clicking each level expands details.

Example:

### Read workspace

```text
CAN

Read permitted files
Inspect Git metadata
Detect frameworks
Analyze routes
Detect package manager

CANNOT

Modify files
Run repository commands
Install dependencies
Submit forms
Upload arbitrary source
```

The initial desktop project flow explicitly requests browser-only or read-workspace access first; write, command, and instrumentation permissions are not requested during initial attachment. 

---

# 14. Permission-prompt screenshot

A real desktop UI screenshot should sit beside/under the permission section.

### Source

```text
1440 × 900
```

### Display

```text
Desktop: 880 × 550
```

Example UI:

```text
Read access requested

Tellann wants to analyze:
commerce-demo

Purpose
Detect frameworks, routes and project structure.

Tellann may:
✓ Read permitted project files
✓ Inspect Git metadata

Tellann may not:
— Modify files
— Execute repository scripts

[Allow read access]
[Continue browser-only]
```

The page should show the *exact style* of permission users will actually encounter.

---

# 15. Section 05 — What workspace analysis inspects

Heading:

> **Workspace analysis is inspection before execution.**

The desktop specification currently defines read-only analysis of:

* Git state,
* package managers,
* languages/frameworks,
* entry points,
* scripts,
* routes,
* endpoints,
* controllers/middleware,
* schemas/state models,
* tests,
* repository documentation. 

Use that actual terminology.

---

# 16. Repository analysis visual

Prefer interactive HTML.

```text
commerce-demo/
│
├── app/
│   ├── checkout/
│   └── api/
│
├── tests/
│
├── package.json ─────────── Next.js
│
├── pnpm-lock.yaml ───────── pnpm
│
└── tsconfig.json ────────── TypeScript


READ-ONLY ANALYSIS

Git
Frameworks
Routes
Endpoints
Tests
Documentation
```

Displayed desktop:

```text
1180 × 680
```

---

# 17. Workspace animation

Sequential highlights:

```text
package.json
   ↓
Framework detected

lockfile
   ↓
Package manager detected

app/
   ↓
Routes detected

tests/
   ↓
Test structure detected

git
   ↓
Branch / revision detected
```

Duration:

```text
4–5 seconds
```

Run once.

---

# 18. Section 06 — What Tellann does not do during read analysis

This should be very direct.

Three large negative cards:

```text
NO SCRIPT EXECUTION

Selecting or analyzing a folder
does not run repository scripts.


NO WRITE ACCESS

Read-workspace permission does
not allow source modification.


NO SILENT ESCALATION

A later operation requiring more
access must request that scope separately.
```

The desktop spec explicitly says no repository command should run during folder selection and read-only analysis should not execute repository scripts. 

---

# 19. Section 07 — Local vs synchronized data

Heading:

> **Know what crosses the boundary.**

This deserves a detailed matrix.

---

# 20. Data-boundary matrix

Three categories:

```text
LOCAL

MAY SYNCHRONIZE

EXPLICIT APPROVAL
```

Possible source-grounded structure:

| Data                            | Default handling                                  |
| ------------------------------- | ------------------------------------------------- |
| Repository root / absolute path | Local                                             |
| Git state                       | Local analysis; derived status may be represented |
| Framework/package manager       | Derived information may synchronize               |
| Repository summary              | Derived information                               |
| Attached documents              | Controlled by source approval scope               |
| Evidence excerpts               | Approval-dependent                                |
| Full file upload                | Explicit approval                                 |
| QA run/report state             | Synchronizes as product data                      |

The desktop source specification explicitly distinguishes source approval as **derived summary only**, **evidence excerpts**, or **explicit full-file upload**. 

Be careful here: do not invent an exact cloud payload until the synchronization contracts are implemented.

---

# 21. Data-boundary visual

Use a 3-column animated pipeline.

```text
LOCAL SOURCE
     │
     ▼
PRIVACY / APPROVAL
     │
     ▼
APPROVED DERIVED DATA
     │
     ▼
TELLANN CLOUD
```

Canvas:

```text
1400 × 700 SVG
Display: 1180 × 590
```

---

# 22. Section 08 — Privacy before transmission

Heading:

> **Sensitive data should be stopped before it travels.**

This is strongly supported by Tellann's privacy architecture.

The privacy specification requires:

* data minimization,
* privacy by default,
* sensitive-data exclusion,
* configurable tenant rules,
* explainable collection,
* traceability. 

---

# 23. Privacy pipeline visual

Use:

```text
Captured
   ↓
Field classification
   ↓
Privacy filter
   ↓
Mask / hash / redact / ignore
   ↓
Validation
   ↓
Transmission
```

This closely reflects the security/privacy pipeline documented for Tellann. 

### Dimensions

```text
Canvas:          1500 × 480
Display desktop: 1240 × 397
```

Use horizontal desktop, vertical mobile.

---

# 24. Privacy animation

A sample event enters:

```text
email: john@example.com
password: secret123
route: /checkout
```

Pipeline transforms it:

```text
email → HASH / MASK

password → BLOCKED

route → ALLOWED
```

Then:

```text
Only approved output
crosses boundary.
```

Animation duration:

```text
5–6 seconds
```

This should be illustrative, with a small:

```text
Example
```

badge.

---

# 25. Section 09 — Collect / Mask / Ignore

Heading:

> **Not every piece of application data is treated the same way.**

Three-column layout.

### Collect

```text
Navigation
Route changes
Clicks
State transitions
API metadata
Workflow data
Session metadata
```

### Mask / pseudonymize

```text
Emails
User IDs
Names
Phone numbers
IP addresses
Business identifiers
```

### Never collect

```text
Passwords
PINs
Card numbers
CVV
JWTs
OAuth tokens
Refresh tokens
API secrets
Private keys
Authentication cookies
```

These classifications come directly from the privacy specification. 

---

# 26. Layout

Desktop:

```text
┌────────────────┬────────────────┬────────────────┐
│ COLLECT        │ MASK           │ IGNORE         │
│                │                │                │
│ ...            │ ...            │ ...            │
└────────────────┴────────────────┴────────────────┘
```

Height:

```text
500–600px
```

Mobile stacks vertically.

Use textual labels, not green/yellow/red alone.

---

# 27. Section 10 — Safe instrumentation

Heading:

> **A proposal comes before a modification.**

This section explains source mutation.

The instrumentation specification requires plans to identify:

* framework/version evidence,
* adapter/version,
* SDK packages,
* files/symbols to modify,
* commands,
* risk classification,
* validation commands,
* rollback method,
* base revision and target file hashes,
* user-approved scope.

Preparing the plan itself requires no write access. 

---

# 28. Instrumentation safety workflow

Large horizontal flow:

```text
ANALYZE
   ↓
PLAN
   ↓
REVIEW SCOPE
   ↓
REVIEW DIFF
   ↓
APPROVE
   ↓
APPLY
   ↓
VALIDATE
   ↓
ACCEPT / ROLLBACK
```

Desktop:

```text
1200 × 260
```

Mobile becomes vertical.

---

# 29. Instrumentation plan screenshot

Source:

```text
1440 × 900
```

Displayed:

```text
940 × 588
```

Example:

```text
Instrumentation plan

Adapter
Next.js 15

Packages
+ @tellann/react

Approved files
app/layout.tsx
app/api/orders/route.ts

Commands
pnpm add @tellann/react
pnpm typecheck

Base revision
ab173d9

Risk
Low

Rollback
Git checkpoint

[Review diff]
[Approve task]
```

Only use fields implemented in the actual client.

---

# 30. Section 11 — Diff review and bounded scope

Heading:

> **Tellann should be able to explain every line it intends to change.**

Two-column layout:

```text
55% diff screenshot
45% explanation
```

---

# 31. Diff screenshot

Source:

```text
1400 × 1000
```

Display:

```text
700 × 500
```

Show:

```text
2 approved files

app/layout.tsx
+ import { TellannProvider } ...

app/api/orders/route.ts
+ checkpoint(...)
```

Sidebar:

```text
Approved scope
2 files

Outside scope
Read-only

Unrelated dirty files
3 — untouched
```

The desktop spec specifically requires changed files, Tellann-authored hunks, package/config changes, semantic checkpoints, unrelated-dirty-file warnings and stale-plan warnings to be visible during diff review. 

---

# 32. High-risk warning

Add a small callout:

> Whole-file replacement should be treated as higher risk when a bounded transformation is possible.

That principle is directly specified in the desktop instrumentation design. 

---

# 33. Section 12 — Command execution

Heading:

> **Reading a command is different from running it.**

This needs its own section because shell access is a serious trust boundary.

Explain:

```text
Detected command
        ↓
Shown to user
        ↓
Structured scope
        ↓
Approval
        ↓
Execution
        ↓
Exit code + redacted logs
```

The desktop model explicitly separates command permission from workspace access and states that launching local processes requires separately approved structured commands. 

---

# 34. Command approval screenshot

Source:

```text
1280 × 800
```

Display:

```text
760 × 475
```

Example:

```text
Command permission requested

pnpm typecheck

Working directory
commerce-demo/

Reason
Validate instrumentation

Duration
This operation only

Network access
None required

[Run command]
[Cancel]
```

Do not show generic:

```text
Allow terminal access?
```

That is exactly the kind of vague permission model the page is meant to reject.

---

# 35. Section 13 — Validation & rollback

Heading:

> **A modification is incomplete until it is verified.**

The desktop workflow requires:

1. revalidate revision and hashes,
2. create branch/checkpoint,
3. apply bounded transformations,
4. install dependencies,
5. run approved commands,
6. syntax/type/build checks,
7. verify SDK/event protocol,
8. check idempotency,
9. show final diff,
10. accept or rollback. 

---

# 36. Validation visual

Use a central product screenshot or HTML reconstruction.

```text
Validation

✓ Base revision unchanged
✓ File hashes valid
✓ Syntax
✓ Type check
✓ SDK initialized
✓ Event protocol
✓ Idempotency

Final status
Validated

[Accept changes]
[Rollback]
```

Source screenshot:

```text
1440 × 900
```

Display:

```text
920 × 575
```

---

# 37. Validation animation

Stagger results:

```text
Base revision     ✓
Syntax            ✓
Type              ✓
SDK               ✓
Telemetry         ✓
```

Timing:

```text
150ms between items
```

Avoid artificially showing success if the actual demo contains failures.

A second static state can show:

```text
Validation failed
Rollback available
```

---

# 38. Rollback diagram

Small diagram beside copy:

```text
BEFORE
revision A
   │
   ▼
TELLANN CHANGE
   │
   ▼
VALIDATION FAILED
   │
   ▼
ROLLBACK
   │
   ▼
revision A
```

Canvas:

```text
520 × 540 SVG
```

---

# 39. Section 14 — Production safety

Heading:

> **Production is observation-only.**

This should be visually unmistakable.

The current desktop specification says that for production:

* Apply Task is disabled,
* process launch is disabled,
* automated interaction is disabled,
* form submission is disabled,
* only explicitly approved observation-only browser attachment is allowed. 

---

# 40. Production policy visual

Split:

```text
DEVELOPMENT / STAGING          PRODUCTION

✓ Guided interaction          ✓ Observation
✓ Approved instrumentation    ✓ Evidence capture
✓ Approved commands

                              — Source modification
                              — Process launch
                              — Automated interaction
                              — Form submission
```

Source:

```text
Pure HTML/CSS
```

Container:

```text
1180 × 520
```

---

# 41. Production UI screenshot

Show the actual environment selector:

```text
Environment

○ Development
○ Staging
● Production

Production policy
Observation only

Disabled:
Apply instrumentation
Launch process
Submit forms
Automated interaction
```

Source:

```text
1280 × 800
```

Displayed:

```text
720 × 450
```

This is more credible than a shield illustration.

---

# 42. Section 15 — QA run privacy

Heading:

> **Observation should not become credential collection.**

Tie Desktop's managed-browser execution to the broader privacy architecture.

Tellann's privacy rules explicitly exclude passwords, payment information, authentication tokens, secrets, medical/government identity data, and biometrics, while masking selected identifiers and contact information. 

---

# 43. QA privacy screenshot

Show a browser/evidence view:

```text
Login form

Email
***@example.com

Password
[NOT CAPTURED]


Evidence

ROUTE_CHANGE
/login → /dashboard

FORM_SUBMITTED
login-form

API_RESPONSE
POST /api/login
200
```

Source:

```text
1440 × 900
```

Displayed:

```text
980 × 613
```

Do not expose a real password even in marketing fixtures.

---

# 44. Section 16 — Authentication and device trust

Heading:

> **Desktop access still begins with identity.**

Keep this high-level because the canonical platform security page owns the full model.

Platform architecture currently specifies authenticated access using OAuth 2.0/OIDC, enterprise SSO capability, scoped API keys, MFA support, session expiration/revocation, and device tracking. 

Use four cards:

```text
AUTHENTICATED USERS
Desktop sessions require identity.

SCOPED APPLICATION ACCESS
Resources remain tenant/application scoped.

REVOCABLE SESSIONS
Sessions and devices can be invalidated.

ENTERPRISE IDENTITY
SSO/OIDC where the customer's plan supports it.
```

Don't advertise a specific Desktop OAuth implementation until verified.

---

# 45. Device revocation visual

A small screenshot:

```text
Devices & security

Tellann Desktop
PELUMI-PC
Windows

Last active
Today

[Revoke]
```

Source:

```text
1100 × 700
```

Displayed:

```text
580 × 369
```

The desktop specification indicates device revocation belongs primarily to the web companion, with the desktop linking to or showing a compact view. 

---

# 46. Section 17 — Encryption

Heading:

> **Protected in transit. Protected at rest.**

The platform security architecture requires TLS 1.3 for communications and AES-256 for sensitive data at rest. 

Use simple architecture:

```text
Desktop
  │
 TLS 1.3
  │
  ▼
Tellann API
  │
  ▼
Encrypted storage
```

Do not turn this into an oversized cryptography tutorial.

---

# 47. Encryption diagram

Canvas:

```text
1200 × 420 SVG
Display: 1000 × 350
```

Show:

```text
Desktop
     │
Encrypted transport
     ▼
API boundary
     │
Tenant authorization
     ▼
Encrypted platform storage
```

---

# 48. Section 18 — Auditability

Heading:

> **Sensitive actions should leave evidence.**

The security architecture requires security-sensitive actions to be traceable and identifies permission changes, authentication events, key actions, exports and configuration changes as auditable events. 

Desktop-specific activity can surface:

```text
Workspace permission granted
Instrumentation task approved
Instrumentation applied
Command approved
Validation completed
Rollback performed
Permission revoked
```

Exact event availability must be confirmed against implementation.

---

# 49. Audit timeline visual

Use HTML.

```text
10:22
Read workspace granted
Philip
commerce-demo

10:31
Instrumentation plan approved
2 files

10:32
pnpm typecheck approved

10:34
Validation passed

10:35
Task accepted
```

Dimensions:

```text
760 × 620
```

Beside copy:

```text
Audit history itself remains
cloud-authoritative.
```

which matches the desktop/web responsibility split. 

---

# 50. Section 19 — Installer & update integrity

Heading:

> **Trust starts before Tellann runs.**

This section should cover:

```text
HTTPS distribution
Installer signature
Publisher identity
SHA-256 verification
Release version
Update validation
Release notes
```

However, there is a source limitation:

**the uploaded security and desktop-navigation specifications do not establish the exact current Windows code-signing certificate, checksum publication pipeline, or updater verification implementation.**

Therefore, design the section now, but only publish definitive claims such as:

```text
Signed by Tellann Technologies Limited
```

once release engineering actually provides evidence.

---

# 51. Installer verification visual

Once implemented:

```text
tellann-desktop-1.4.0-x64.exe

Publisher
Tellann Technologies Limited

Signature
Valid

SHA-256
a3cf...98d1

[Copy checksum]
[View release notes]
```

Source screenshot/UI:

```text
1200 × 760
```

Displayed:

```text
720 × 456
```

Link:

```text
Verify Tellann Desktop →
```

to either:

```text
/desktop/download
```

or:

```text
docs.tellann.co/desktop/verify-download
```

---

# 52. Update integrity

If automatic updates exist, the page should eventually explain:

```text
Update detected
      ↓
Artifact downloaded securely
      ↓
Signature / integrity validation
      ↓
Update permitted
```

Do not claim automatic update signing before that pipeline exists.

---

# 53. Section 20 — Security control summary

A compact reference table near the bottom.

| Capability                     | Default                  |
| ------------------------------ | ------------------------ |
| Browser-only QA                | No repository permission |
| Workspace analysis             | Read permission          |
| Repository scripts during scan | Not executed             |
| Instrumentation planning       | No write access required |
| File modification              | Approved task scope      |
| Command execution              | Separate permission      |
| Production modification        | Disabled                 |
| Sensitive-field capture        | Blocked/masked by policy |
| Permission revocation          | Supported                |
| Platform transport             | Encrypted                |
| Tenant access                  | Authenticated/authorized |

This becomes the page's skimmable executive summary.

---

# 54. Section 21 — FAQ

Recommended questions:

```text
Does Tellann upload my repository?

Does selecting a project let Tellann modify it?

Does Tellann execute npm/pnpm scripts during scanning?

Can Tellann modify files outside an approved plan?

Can Tellann run terminal commands?

What happens if validation fails?

Can Tellann modify production?

What happens to passwords and authentication tokens?

Can I revoke repository access?

Where are my Tellann credentials stored?

How do I verify the desktop installer?
```

Important: for credential storage, if the implementation has not committed to a specific OS keychain/credential manager, say exactly that in the current site copy or omit the mechanism.

---

# 55. FAQ layout

Desktop:

```text
35% title/description
65% accordion
```

Accordion:

```text
max-width 780px
```

Animation:

```text
180–220ms
```

---

# 56. Section 22 — Security resources

Heading:

> **Go deeper**

Four links:

```text
Platform Security
/security

Privacy & Data Collection
/security/privacy

Desktop Requirements
/desktop/requirements

Security Documentation
docs.tellann.co/desktop/security
```

Possible fifth:

```text
Release Integrity
/desktop/releases
```

---

# 57. Section 23 — Final CTA

Do not make the final security CTA aggressively sales-like.

Better:

> **Inspect the boundaries before you install the software.**

Buttons:

```text
[ Download Tellann Desktop ]
[ View system requirements ]
```

Supporting links:

```text
Desktop releases
Desktop security documentation
```

---

# 58. Final CTA visual

Use the permission-dialog screenshot partially rising from below the section.

Source:

```text
1400 × 900
```

Displayed:

```text
900 × 579
```

Visible crop:

```text
~330px high
```

This reinforces the core message—explicit consent—rather than showing a generic product dashboard.

---

# 59. Media asset inventory

The page should require approximately:

| ID      | Asset                     | Source dimensions | Placement           |
| ------- | ------------------------- | ----------------: | ------------------- |
| SEC-D01 | Trust-boundary diagram    |      1600×920 SVG | Hero                |
| SEC-D02 | Permission prompt         |          1440×900 | Permission model    |
| SEC-D03 | Workspace analysis visual |  1440×900 or HTML | Scanning            |
| SEC-D04 | Data-boundary diagram     |      1400×700 SVG | Local/cloud         |
| SEC-D05 | Privacy pipeline          |      1500×480 SVG | Privacy             |
| SEC-D06 | Instrumentation plan      |          1440×900 | Source changes      |
| SEC-D07 | Diff review               |         1400×1000 | Approved scope      |
| SEC-D08 | Command approval          |          1280×800 | Commands            |
| SEC-D09 | Validation screen         |          1440×900 | Validation          |
| SEC-D10 | Rollback diagram          |       520×540 SVG | Rollback            |
| SEC-D11 | Production environment UI |          1280×800 | Production policy   |
| SEC-D12 | QA privacy screen         |          1440×900 | QA privacy          |
| SEC-D13 | Device/security view      |          1100×700 | Authentication      |
| SEC-D14 | Encryption diagram        |      1200×420 SVG | Encryption          |
| SEC-D15 | Installer verification    |          1200×760 | Installer integrity |
| SEC-D16 | Final permission crop     |          1400×900 | Final CTA           |
| SEC-D17 | Social/OpenGraph asset    |          1200×630 | Metadata            |

You can reuse SEC-D02 for SEC-D16 with a different crop.

So practically:

**10–12 unique product captures + 5 technical SVG/HTML diagrams + 1 OG image.**

---

# 60. Video strategy

Unlike `/desktop`, **I would not put a traditional product video on this page**.

Security concepts are better demonstrated through:

* interactive diagrams,
* actual permission dialogs,
* diff reviews,
* command prompts,
* validation sequences.

A glossy security video usually explains less and feels more like marketing.

If you want one video, use only a short **permission escalation demonstration**.

---

# 61. Optional security video

### Purpose

Show that capabilities are requested incrementally.

### Source

```text
1600 × 1000
16:10
12–16 seconds
30fps
No audio
```

### Storyboard

```text
0s
Project attaches browser-only

3s
Read permission requested

6s
Workspace analyzed

9s
Instrumentation plan prepared

11s
Write access requested

13s
User cancels

15s
Read-only workflow remains available
```

This would communicate an important property:

> refusing a higher permission does not destroy lower-privilege workflows.

That behavior is explicitly required by the desktop specification. 

Display:

```text
1040 × 650
```

Autoplay muted only if subtle. Otherwise click-to-play.

---

# 62. Animation strategy

Use only six meaningful animations:

```text
1. Trust-boundary resolution
2. Permission ladder escalation
3. Workspace scan
4. Privacy filtering pipeline
5. Validation sequence
6. Data synchronization flow
```

All animations should explain a security concept.

No ornamental “cybersecurity particles.”

---

# 63. Animation durations

```text
UI transition              180–280ms
Permission progression      350–500ms/node
Diagram path                600–900ms
Workspace scan              4–5s total
Privacy pipeline            5–6s total
Validation check sequence   700–1200ms total
```

Use:

```css
@media (prefers-reduced-motion: reduce)
```

to show completed static states.

---

# 64. Mobile behavior

At `<768px`:

Trust diagram becomes:

```text
YOUR COMPUTER
      ↓
TELLANN DESKTOP
      ↓
APPROVED DATA
      ↓
TELLANN CLOUD
```

Permission ladder remains vertical.

Collect/Mask/Ignore becomes stacked:

```text
COLLECT
↓
MASK
↓
IGNORE
```

Diff and validation screenshots use horizontal internal scrolling only if unavoidable; preferably responsive image scaling.

Tables become cards.

---

# 65. Mobile screenshot dimensions

Generate responsive variants:

```text
480w
768w
1024w
1440w
```

For high-density devices, AVIF/WebP responsive assets are enough.

Do not send original 1440×900 PNGs indiscriminately.

---

# 66. Security page visual tone

This page should feel **quiet, precise and somewhat austere**.

Do not use:

```text
padlock stock art
hooded hackers
green matrix code
glowing shields
neon cybersecurity grids
fingerprint stock imagery
```

Use the product itself as evidence.

The visual language should say:

> Here are the exact boundaries.

Not:

> Trust us, we look secure.

---

# 67. Page-specific iconography

Use thin monochrome symbols for:

```text
Read
Write
Command
Cloud
Local
Blocked
Masked
Encrypted
Verified
Audit
Rollback
```

Recommended icon size:

```text
20–24px inside UI
28–32px in principle cards
```

No 96px decorative shield icons.

---

# 68. Accessibility

Security information must not depend on color.

Bad:

```text
Green = allowed
Red = blocked
```

Good:

```text
✓ Allowed
— Not permitted
⊘ Blocked
```

Also:

* keyboard-operable permission details,
* SVG labels exposed to screen readers,
* descriptive captions under screenshots,
* code/checksum values selectable,
* copy checksum buttons with accessible feedback,
* diagrams followed by equivalent text.

---

# 69. Metadata

Recommended:

```text
Title:
Tellann Desktop Security | Tellann

Description:
Understand how Tellann Desktop handles local repositories,
workspace permissions, privacy, source-code changes,
command execution, validation, rollback and cloud synchronization.
```

Canonical:

```text
https://tellann.co/desktop/security
```

---

# 70. OpenGraph image

Source:

```text
1200 × 630
```

Layout:

```text
TELLANN

Desktop Security

Local execution.
Explicit permission.
Controlled synchronization.

[small trust-boundary diagram]
```

Do not use an enormous padlock.

---

# 71. Relationship to `/security`

Avoid duplication.

`/security` should continue to explain:

```text
Authentication
Encryption
Tenant isolation
RBAC
Infrastructure
Audit
Platform data protection
```

The routing plan already establishes those as the platform-level security topics. 

`/desktop/security` owns:

```text
Filesystem access
Repository scanning
Permission escalation
Source-code modification
Commands
Managed browser boundaries
Local/cloud synchronization
Production restrictions
Desktop credentials
Installer integrity
Rollback
```

---

# 72. Relationship to `/security/privacy`

Likewise:

```text
/security/privacy
```

owns the complete Tellann data-classification model.

`/desktop/security` should summarize only what matters to Desktop:

```text
what is local
what can synchronize
what is masked
what is blocked
when explicit approval is required
```

The privacy specification already provides the authoritative collect/mask/ignore rules. 

---

# 73. Relationship to `/desktop/requirements`

Do not document compatibility here beyond minimal context.

Security:

```text
What access does Windows require?
```

Requirements:

```text
Which Windows versions are supported?
Which architectures?
Which tools?
Which filesystem configurations?
```

---

# 74. Relationship to documentation

Deep technical material should live in:

```text
docs.tellann.co/desktop/security
├── permission-model
├── workspace-access
├── privacy
├── instrumentation-safety
├── command-execution
├── production-policy
├── credential-storage
├── installer-verification
└── incident-response
```

Marketing explains the model.

Docs explain implementation and operational procedure.

---

# 75. Important claim gate

Before launch, every statement on `/desktop/security` needs an implementation proof.

Maintain:

| Claim                             | Evidence required                       |
| --------------------------------- | --------------------------------------- |
| Read access cannot write          | Desktop permission enforcement test     |
| Scan does not run scripts         | Scanner integration tests               |
| Absolute paths remain local       | Synchronization contract/test           |
| Raw source stays local by default | Network/data-flow test                  |
| Commands require approval         | Command broker implementation           |
| Scope cannot silently expand      | Authorization test                      |
| Rollback works                    | Instrumentation test                    |
| Production is observation-only    | Renderer + backend authorization        |
| Passwords excluded                | Privacy-filter tests                    |
| TLS version                       | Deployed endpoint configuration         |
| Credentials stored securely       | Desktop credential-store implementation |
| Installer signed                  | Release pipeline artifact               |
| Checksum valid                    | Release manifest/build pipeline         |

This is particularly important because parts of the desktop document are explicitly marked as **proposed implementation specification**, not evidence that everything is already shipping. 

---

# 76. Claims that can already be designed confidently

Based on the specifications, the page can safely be designed around these intended product rules:

```text
Least privilege

Read access and write access are distinct

Initial attachment does not require write access

Read-only scanning does not execute repository scripts

Instrumentation planning does not require write access

Instrumentation has explicit file/command scope

Validation and rollback belong to the change workflow

Production is observation-only

Sensitive data must be filtered before transmission

Passwords, payment credentials, tokens and secrets
are explicitly excluded from data collection
```

Those ideas are well supported by the desktop, privacy and security specifications.    

---

# 77. Claims that need implementation verification

Do **not** publish these yet without evidence:

```text
"Your source code never leaves your machine"
```

The source model allows explicit full-file upload under an approval scope, so the absolute claim would be wrong. 

Similarly verify before publishing:

```text
Windows Credential Manager is used

All installers are Authenticode signed

Updates use certificate pinning

Every installer exposes SHA-256

Desktop tokens are hardware-backed

Source files are never transmitted under any condition
```

The provided specifications do not establish those exact current implementation details.

---

# 78. Final page flow

The complete visitor experience should read almost like a contract:

```text
DESKTOP SECURITY

Your repository is not
an unrestricted permission.

        ↓

THE TRUST BOUNDARY

Your machine
    ↕
Tellann Desktop
    ↕
Approved information
    ↕
Tellann Cloud

        ↓

PERMISSIONS ARE SEPARATE

Browser
Read
Propose
Write
Command
Sensitive action

        ↓

READ-ONLY WORKSPACE ANALYSIS

Git
Framework
Packages
Routes
Endpoints
Tests
Docs

No scripts executed.

        ↓

KNOW WHAT LEAVES

Local
Derived
Explicitly approved

        ↓

PRIVACY BEFORE TRANSMISSION

Capture
Filter
Mask
Block
Transmit

        ↓

COLLECT / MASK / IGNORE

        ↓

SAFE INSTRUMENTATION

Analyze
Plan
Review
Approve
Apply

        ↓

BOUNDED DIFF

Tellann can explain
what it wants to change.

        ↓

COMMAND CONTROL

Show
Scope
Approve
Run
Record

        ↓

VALIDATE OR ROLLBACK

        ↓

PRODUCTION IS OBSERVATION-ONLY

        ↓

AUTHENTICATION
ENCRYPTION
AUDIT

        ↓

VERIFY THE SOFTWARE ITSELF

Installer
Signature
Checksum
Release

        ↓

READ THE FULL SECURITY MODEL

        ↓

DOWNLOAD TELLANN DESKTOP
```

That is the direction I would use.

The core design principle for `/desktop/security` should be: **do not ask the visitor to trust Tellann because the page says Tellann is secure. Show them the boundaries, the prompts, the blocked actions, the exact scope, the diff, and the rollback path.** For software capable of interacting with a developer's repository, trust has to be observable too.
