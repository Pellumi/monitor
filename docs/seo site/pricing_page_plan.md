Yes. `/pricing` should be considerably more than six price cards. It is the page where someone should be able to answer:

**Which Tellann plan fits me? What exactly do I get? What are the limits? What changes when I upgrade? What does Local mean? What happens if I outgrow a plan?**

The underlying pricing philosophy is deliberately value-based: Phase 1 pricing is primarily based on **applications, users, storage and retention**, rather than exposing events, logs or traces as the main customer-facing meter. 

# `/pricing` — Complete Pricing Page Specification

## 1. Primary page objective

The page should convert four kinds of visitors:

```text
Individual developer
        ↓
Free / Local / Solo

Small engineering team
        ↓
Team

Growing organization
        ↓
Business

Large / regulated organization
        ↓
Enterprise
```

The page should accomplish this without requiring sales assistance for the normal plans.

That is actually one of the pricing specification's success criteria: customers should be able to understand and select a plan quickly. 

---

# 2. Important pricing model correction

The original commercial model contains:

```text
Free
Solo
Team
Business
Enterprise
```

with:

| Plan       | Monthly |
| ---------- | ------: |
| Free       |      $0 |
| Solo       |     $29 |
| Team       |     $99 |
| Business   |    $299 |
| Enterprise |  Custom |



However, the newer Tellann Desktop architecture introduces:

```text
Free
↓
Local
↓
Solo
↓
Team
↓
Business
↓
Enterprise
```

with capabilities progressively unlocking as follows:

```text
Free
Guided QA runs

Local
+ document-derived intent

Solo
+ automated instrumentation
+ richer evidence

Team
+ collaboration
+ shared run governance

Business / Enterprise
+ governance
+ policy
+ audit
+ priority processing
```



That newer structure should become the pricing-page hierarchy.

---

# 3. Local plan warning

There is one piece of information that the available specifications **do not define**:

> **The approved Local plan price.**

They also do not formally define its exact:

* application limit;
* storage quota;
* user limit;
* retention period.

The newer desktop specification defines Local's capabilities, but explicitly acknowledges the packaging conflict with the older five-plan commercial structure. 

So I would implement pricing as:

```ts
pricing page
     ↓
billing/pricing configuration
     ↓
actual current price + limits
```

rather than:

```ts
const LOCAL_PRICE = 15;
```

scattered throughout the frontend.

For the rest of this specification, I'll call it:

**Local — dynamic configured price**

until its billing price is formally locked.

---

# 4. Overall page structure

I would structure `/pricing` as:

```text
/pricing
│
├── 01 Navigation
├── 02 Pricing Hero
├── 03 Billing / Currency Controls
├── 04 Plan Cards
│   ├── Free
│   ├── Local
│   ├── Solo
│   ├── Team
│   ├── Business
│   └── Enterprise
│
├── 05 "Which plan is right for me?"
├── 06 Detailed Comparison Matrix
├── 07 Desktop & Local Capabilities
├── 08 Usage / Limits Explanation
├── 09 Report & Export Entitlements
├── 10 Storage & Retention
├── 11 Enterprise Section
├── 12 Pricing Philosophy / No Surprise Billing
├── 13 Future Pricing Evolution
├── 14 FAQ
├── 15 Final CTA
└── 16 Footer
```

---

# 5. Section 01 — Navigation

Use the same main marketing navbar as `/`.

```text
Tellann

Product
Solutions
Developers
Resources
Pricing

                          Sign in
                  Book demo   Start free
```

`Pricing` is active.

Sticky on scroll.

---

# 6. Section 02 — Pricing hero

Keep it simple.

### Eyebrow

```text
PRICING
```

### H1

> **Start small. Scale when your software does.**

Alternative:

> **Quality intelligence for every stage of your team.**

I prefer the first.

### Supporting copy

> Start free, unlock deeper local analysis when you need it, and expand into collaboration, automation and enterprise governance as your applications grow.

This now accounts for the newer Local/Desktop direction rather than describing Tellann purely through the older cloud plans.

---

# 7. Pricing philosophy callout

Immediately below:

> **You pay for capability and scale—not for deciphering telemetry bills.**

Supporting line:

> Tellann's current plans are primarily structured around applications, team size, storage and retention.

This directly reflects the pricing strategy. 

Do not aggressively market:

```text
10 million events
47 million spans
18 billion telemetry units
```

during Phase 1.

That damages the category positioning.

---

# 8. Section 03 — Billing controls

At launch, the specs only establish monthly prices.

So initially:

```text
Billing

[ Monthly ]
```

Do **not** invent an annual discount unless one is formally approved.

Later this can become:

```text
[ Monthly ] [ Annual — Save X% ]
```

when annual pricing actually exists.

---

# 9. Currency selector

If Tellann accepts multiple currencies later:

```text
Currency

USD ▾
```

But the **commercial amount should come from pricing configuration**.

Do not simply convert $29 into a different currency client-side and treat it as regional pricing.

Those are two different things:

```text
Currency conversion
≠
Regional pricing
```

If Local is a named Tellann product plan rather than geographical regional pricing, keep those concepts completely separate.

---

# 10. Section 04 — Main plan cards

There are now effectively six levels.

Desktop:

```text
FREE       LOCAL       SOLO
TEAM       BUSINESS    ENTERPRISE
```

I would **not** force six narrow cards across one row.

Use two logical tiers.

---

# 11. Individual / developer tier

Heading:

> **For individuals and independent developers**

```text
┌─────────────┐
│    FREE     │
└─────────────┘

┌─────────────┐
│    LOCAL    │
└─────────────┘

┌─────────────┐
│    SOLO     │
└─────────────┘
```

Then organization plans below.

This also makes the meaning of Local much easier to understand.

---

# 12. Free plan

## Price

```text
FREE

$0
forever
```

## Tagline

> Experience the Tellann workflow.

## Target

* individual developers;
* students;
* open-source maintainers;
* product evaluation.

Those audiences are explicitly defined in the pricing specification. 

## Limits

```text
1 Application
1 User
1 GB Storage
14-day Retention
Basic Reports
JSON Exports
```



## Core features

```text
✓ Application onboarding
✓ Guided QA runs
✓ Developer Demonstration Mode
✓ Session recording
✓ Session replay
✓ Behavior Graphs
✓ Workflow discovery
✓ Coverage analysis
✓ Missing-state detection
✓ Missing-flow detection
✓ Endpoint analysis
✓ Basic dashboard
✓ Basic browser evidence
```

The newer desktop plan explicitly keeps guided browser runs available on Free. 

---

## Not included

Do not put 30 crossed-out items.

Only show the important upgrade boundaries:

```text
— Document-derived intent
— Automated instrumentation
— Team collaboration
— Advanced exports
— API access
```

CTA:

```text
[ Start free ]
```

Destination:

```text
/signup?plan=free
```

or equivalent app flow.

---

# 13. Local plan

This one needs special treatment.

## Badge

```text
LOCAL
DESKTOP PLAN
```

or:

```text
LOCAL
FOR LOCAL-FIRST QA
```

Avoid "Most Popular" unless usage data eventually supports it.

---

## Positioning

> **Understand your project before instrumenting it.**

Local should be positioned as the bridge between:

```text
Free
"Observe what I demonstrate"

and

Solo
"Let Tellann instrument and analyze more deeply"
```

---

## Price

Do not hardcode one until approved.

UI should consume:

```ts
local.price.monthly
```

from billing configuration.

Render:

```text
$XX / month
```

once configured.

If not configured at public launch, I would not show Local publicly yet.

Do **not** publish:

> Contact us

for what is intended to be a self-serve developer tier.

That creates unnecessary friction.

---

# 14. What Local includes

The desktop implementation specifically establishes:

```text
Everything required for guided QA
+
Document-derived flow inference
```



So its card should emphasize:

```text
✓ Everything in Free
✓ Tellann Desktop
✓ Local workspace analysis
✓ Repository/document sources
✓ Document-derived intent
✓ Documentation-derived workflows
✓ Evidence-backed intent drafts
✓ Expected-vs-observed reconciliation
✓ Basic browser evidence
✓ Local project context
```

The current desktop plan allows repository/document intelligence while keeping raw source local by default and synchronizing derived/redacted information according to user approval. 

---

# 15. Local plan limitations

These distinctions are important:

```text
— Automated instrumentation
— Shared QA runs
— Assignments/review
— Team governance
— Full audit/device policies
```

Automated instrumentation begins at Solo, while shared governance begins at Team. 

---

# 16. Local card explainer

Add a small info link:

```text
What does "Local" mean? ⓘ
```

Popover:

> Local adds Tellann's project and document intelligence while keeping the workflow designed around your local development environment. It does not mean that all Tellann cloud services run locally.

That distinction is crucial.

The architecture remains hybrid:

```text
Tellann Desktop
+
Tellann cloud control plane
+
managed browser
+
cloud graphs/reporting
```



So don't imply:

> All data stays on your machine.

That would be inaccurate.

---

# 17. Solo plan

## Price

```text
SOLO

$29
/month
```



## Tagline

> For serious independent development.

Target:

* freelancers;
* indie developers;
* solo founders;
* small products.

---

## Standard limits

```text
3 Applications
3 Users
25 GB Storage
90-day Retention
Unlimited Reports
PDF / CSV / JSON / HTML
```



---

## Existing cloud features

```text
✓ Everything in Free
✓ Advanced reporting
✓ Historical report access
✓ Multiple environments
✓ Email support
```



---

## New desktop capabilities

Solo now becomes much more meaningful:

```text
✓ Everything in Local
✓ Automated instrumentation
✓ Richer browser evidence
✓ Instrumentation planning
✓ Framework adapter support
✓ Scoped code modifications
✓ Validation
✓ Rollback
```

The current desktop plan explicitly places automated instrumentation at Solo and above. 

---

## CTA

```text
[ Choose Solo ]
```

This is likely the best default recommendation for an individual developer who actively uses Tellann.

Potential badge:

```text
BEST FOR DEVELOPERS
```

That is much more defensible than blindly labelling it "Most popular."

---

# 18. Organization tier

Second grouping:

> **For engineering teams and organizations**

```text
TEAM       BUSINESS       ENTERPRISE
```

---

# 19. Team plan

## Price

```text
TEAM

$99
/month
```



## Tagline

> Collaborate on software quality.

## Target

```text
Startups
QA teams
Product teams
Engineering teams
```

---

## Limits

```text
10 Applications
10 Users
100 GB Storage
180-day Retention
Unlimited Reports
All Export Formats
```



---

## Features

```text
✓ Everything in Solo

Collaboration
✓ Team collaboration
✓ Shared dashboards
✓ Shared QA runs
✓ Assignments and review
✓ Shared run governance

Access
✓ Role-based access control
✓ Application-level permissions

Support
✓ Priority email support
```

The Team tier is also the first desktop tier explicitly intended to support shared run governance and collaboration. 

---

## CTA

```text
[ Choose Team ]
```

This is the plan I would visually highlight as:

```text
RECOMMENDED FOR TEAMS
```

---

# 20. Business plan

## Price

```text
BUSINESS

$299
/month
```



## Tagline

> Quality intelligence across multiple products.

Target:

* scale-ups;
* multi-team organizations;
* growing engineering departments.

---

## Limits

```text
50 Applications
50 Users
500 GB Storage
365-day Retention
Unlimited Reports
All Export Formats
```



---

## Features

```text
✓ Everything in Team

Platform
✓ API access
✓ Advanced RBAC
✓ Audit logs
✓ Priority processing

Desktop governance
✓ Device governance
✓ Policy enforcement
✓ Extended operational controls

Support
✓ Priority support
✓ Dedicated customer success
```

The newer desktop packaging associates Business/Enterprise with audit, policy enforcement, device governance, longer retention and priority processing. 

---

## CTA

```text
[ Choose Business ]
```

---

# 21. Enterprise plan

## Price

```text
ENTERPRISE

Custom
Annual contract
```



## Tagline

> Deployment, governance and control at enterprise scale.

---

## Limits

```text
Applications   Custom
Users          Custom
Storage        Custom
Retention      Custom
```

---

## Features

```text
✓ Everything in Business

Identity
✓ SSO
✓ SAML
✓ OIDC

Deployment
✓ Self-hosting
✓ Private networking
✓ Custom data residency

Data
✓ Custom retention policies

Security
✓ Enterprise SLA
✓ Security reviews
✓ Organization policies

Support
✓ Dedicated support
✓ Custom integrations
✓ Architecture assistance
```

These are already explicitly defined Enterprise entitlements. 

The platform architecture also explicitly supports both Tellann-managed SaaS and customer-controlled self-hosted deployments. 

CTA:

```text
[ Talk to sales ]
```

Secondary:

```text
View enterprise →
```

---

# 22. Recommended visual hierarchy

The page should approximately look like:

```text
                     PRICING

        Start small. Scale when your
                software does.

    Capability-based pricing. No opaque credits.


                FOR INDIVIDUALS

    FREE          LOCAL          SOLO
     $0           $XX            $29


                 FOR TEAMS

    TEAM        BUSINESS       ENTERPRISE
    $99          $299           Custom
```

This is easier to comprehend than:

```text
Free Local Solo Team Business Enterprise
```

compressed across the page.

---

# 23. Local plan visual treatment

Because Local is unusual, give it a subtle different treatment.

For example:

```text
┌────────────────────────────┐
│ LOCAL                      │
│ Desktop-focused            │
│                            │
│ $XX / month                │
│                            │
│ Understand your project    │
│ before instrumenting it.   │
│                            │
│ ✓ Document inference       │
│ ✓ Expected flow drafts     │
│ ✓ Local workspace context  │
│                            │
│ [ Choose Local ]           │
└────────────────────────────┘
```

And a small:

```text
Why Local? →
```

This can anchor down to the dedicated Local explanation later on the page.

---

# 24. Section 05 — "Which plan is right for me?"

Don't force visitors to decode the table.

Create a simple decision section:

### Free

> **I'm evaluating Tellann.**

```text
→ Free
```

### Local

> **I want Tellann to understand my repository and product documentation, but I don't need automated instrumentation.**

```text
→ Local
```

### Solo

> **I work independently and want deeper analysis and automated instrumentation.**

```text
→ Solo
```

### Team

> **Multiple people need to run, review and manage QA together.**

```text
→ Team
```

### Business

> **We operate multiple applications and need API access, auditing and governance.**

```text
→ Business
```

### Enterprise

> **We need SSO, self-hosting, private networking or custom compliance controls.**

```text
→ Enterprise
```

This section alone will eliminate a lot of plan ambiguity.

---

# 25. Section 06 — Complete feature comparison table

After the simple cards comes the detailed table.

Make it sticky horizontally.

Columns:

```text
Feature
Free
Local
Solo
Team
Business
Enterprise
```

Use grouped rows.

---

# 26. Group 1 — Core Behavioral QA

| Capability         | Free | Local | Solo | Team | Business | Enterprise |
| ------------------ | ---: | ----: | ---: | ---: | -------: | ---------: |
| Guided QA runs     |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Demonstration Mode |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Session recording  |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Session replay     |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Behavior Graphs    |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Workflow discovery |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Coverage analysis  |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Missing states     |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Missing flows      |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Endpoint analysis  |    ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |

The original packaging deliberately makes Tellann's core product experience broadly available rather than withholding the core differentiator from Free users. 

---

# 27. Group 2 — Local & project intelligence

This is where the new architecture appears.

| Capability                          |    Free | Local | Solo | Team | Business | Enterprise |
| ----------------------------------- | ------: | ----: | ---: | ---: | -------: | ---------: |
| Tellann Desktop                     |       ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Guided browser runs                 |       ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Basic browser evidence              |       ✓ |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Repository scan                     |   Basic |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Document-derived intent             |       — |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Document/repository evidence        |       — |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Expected-flow drafts                |       — |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Expected-vs-observed reconciliation | Limited |     ✓ |    ✓ |    ✓ |        ✓ |          ✓ |

The hard entitlement boundary that is explicitly supported is **Document Flow Inference beginning at Local**. 

For anything beyond that, the UI should ultimately consume entitlement configuration rather than hardcoding assumptions.

---

# 28. Group 3 — Instrumentation

| Capability                |    Free |   Local | Solo | Team | Business | Enterprise |
| ------------------------- | ------: | ------: | ---: | ---: | -------: | ---------: |
| Manual SDK integration    |       ✓ |       ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Automated instrumentation |       — |       — |    ✓ |    ✓ |        ✓ |          ✓ |
| Instrumentation plans     |       — |       — |    ✓ |    ✓ |        ✓ |          ✓ |
| Code diff review          |       — |       — |    ✓ |    ✓ |        ✓ |          ✓ |
| Validation checks         |       — |       — |    ✓ |    ✓ |        ✓ |          ✓ |
| Rollback support          |       — |       — |    ✓ |    ✓ |        ✓ |          ✓ |
| Rich browser traces       | Limited | Limited |    ✓ |    ✓ |        ✓ |          ✓ |

Solo is the defined threshold for automated instrumentation. 

---

# 29. Group 4 — Collaboration

| Capability              | Free | Local | Solo | Team | Business | Enterprise |
| ----------------------- | ---: | ----: | ---: | ---: | -------: | ---------: |
| Shared QA runs          |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| Assignments             |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| Review workflow         |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| Shared dashboards       |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| Team collaboration      |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| RBAC                    |    — |     — |    — |    ✓ |        ✓ |          ✓ |
| Application permissions |    — |     — |    — |    ✓ |        ✓ |          ✓ |

This aligns the older Team packaging with the newer desktop governance model.  

---

# 30. Group 5 — Platform & governance

| Capability          | Free | Local |    Solo |    Team | Business | Enterprise |
| ------------------- | ---: | ----: | ------: | ------: | -------: | ---------: |
| API access          |    — |     — |       — |       — |        ✓ |          ✓ |
| Audit logs          |    — |     — |       — |       — |        ✓ |          ✓ |
| Advanced RBAC       |    — |     — |       — |       — |        ✓ |          ✓ |
| Device governance   |    — |     — | Limited | Limited |        ✓ |          ✓ |
| Priority processing |    — |     — |       — |       — |        ✓ |          ✓ |
| SSO                 |    — |     — |       — |       — |        — |          ✓ |
| SAML                |    — |     — |       — |       — |        — |          ✓ |
| OIDC                |    — |     — |       — |       — |        — |          ✓ |
| Self hosting        |    — |     — |       — |       — |        — |          ✓ |

 

---

# 31. Group 6 — Reports

| Capability         |    Free |  Local | Solo | Team | Business | Enterprise |
| ------------------ | ------: | -----: | ---: | ---: | -------: | ---------: |
| Basic reports      |       ✓ |      ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| Unlimited reports  |       — | Config |    ✓ |    ✓ |        ✓ |          ✓ |
| Historical reports | Limited | Config |    ✓ |    ✓ |        ✓ |          ✓ |
| JSON exports       |       ✓ |      ✓ |    ✓ |    ✓ |        ✓ |          ✓ |
| PDF exports        |       — | Config |    ✓ |    ✓ |        ✓ |          ✓ |
| CSV exports        |       — | Config |    ✓ |    ✓ |        ✓ |          ✓ |
| HTML exports       |       — | Config |    ✓ |    ✓ |        ✓ |          ✓ |

I use **Config** for Local here deliberately: the uploaded Local-plan materials do not establish these exact report entitlements.

Don't silently inherit them from Solo.

---

# 32. Section 07 — Dedicated Local explanation

This deserves its own homepage-like section.

Heading:

> **What is the Local plan?**

Copy:

> Local is for developers who want Tellann to understand more than what happens in the browser. Tellann Desktop can analyze approved local project structure and product documentation, derive expected application behavior, and reconcile that intent against observed QA runs.

Then diagram:

```text
Repository
    │
    ├──────────┐
    │          │
Documentation │
    │          │
    └────┬─────┘
         ↓
  Tellann Desktop
         ↓
Expected behavior
         │
         │
Guided QA run
         ↓
Observed behavior
         │
         ↓
   Reconciliation
         ↓
      Report
```

This reflects the desktop workflow accurately. 

---

# 33. Important privacy explanation for Local

Show:

```text
Your source code is not automatically uploaded.
```

Then:

```text
Local workspace
      ↓
Local analysis
      ↓
Derived/redacted evidence
      ↓
Tellann cloud
```

The newer desktop architecture says raw source remains local by default, with approved/redacted derived information or explicitly approved artifacts uploaded. 

That's a very strong sales point.

But phrase it precisely.

Do **not** say:

> Tellann never uploads anything.

That is not what the architecture says.

---

# 34. Free vs Local vs Solo explainer

This should be very clear:

```text
FREE

Tellann sees
what you demonstrate.


LOCAL

Tellann understands
what your project expects
and what you demonstrate.


SOLO

Tellann can also help
instrument the project
for deeper observation.
```

That may be the cleanest conceptual explanation of the three plans.

---

# 35. Section 08 — Usage and limits

Heading:

> **Simple limits. No telemetry arithmetic.**

Then four cards:

```text
APPLICATIONS
How many products Tellann can analyze.

USERS
How many people belong to your Tellann workspace.

STORAGE
Replay, report and supported analysis storage.

RETENTION
How long eligible historical data remains available.
```

This matches the Phase 1 pricing philosophy. 

---

# 36. Standard plan limits table

|              |    Free |    Solo |     Team | Business | Enterprise |
| ------------ | ------: | ------: | -------: | -------: | ---------: |
| Applications |       1 |       3 |       10 |       50 |     Custom |
| Users        |       1 |       3 |       10 |       50 |     Custom |
| Storage      |    1 GB |   25 GB |   100 GB |   500 GB |     Custom |
| Retention    | 14 days | 90 days | 180 days | 365 days |     Custom |



Then insert Local between Free and Solo once its approved limits are present in billing config:

```text
LOCAL
Apps: configured
Users: configured
Storage: configured
Retention: configured
```

Again: don't make these numbers up.

---

# 37. Storage usage tooltip

Users will eventually ask:

> What counts toward storage?

Create a tooltip or `/pricing#storage`.

Explain categories in plain language:

```text
Session replay assets
Browser artifacts
Reports
Graph snapshots
Approved uploaded sources
```

The architecture does store replays, exports and graph/report artifacts. 

---

# 38. Section 09 — Reports and exports

Heading:

> **Your analysis should leave Tellann when you need it.**

Show:

```text
JSON
PDF
CSV
HTML
```

Plan rules:

```text
Free
JSON

Solo and above
PDF
CSV
JSON
HTML
```



Local should render whichever entitlement its billing configuration establishes.

---

# 39. Section 10 — Retention

Use a simple timeline graphic:

```text
FREE
14 days

SOLO
90 days

TEAM
180 days

BUSINESS
365 days

ENTERPRISE
Custom
```



Do not bury retention in a 70-row comparison matrix.

It materially affects a user's purchase decision.

---

# 40. Section 11 — Enterprise

Give Enterprise its own substantial section.

Heading:

> **Need Tellann inside your environment?**

Diagram:

```text
Managed Tellann

Your App
   ↓
Tellann Cloud


or


Self-hosted Tellann

Your App
   ↓
Your Infrastructure
   ↓
Tellann Platform
```

The deployment architecture supports both models. 

Then four enterprise pillars:

### Identity

```text
SSO
SAML
OIDC
```

### Infrastructure

```text
Self-hosted
Private networking
Custom data residency
```

### Governance

```text
Audit
Custom retention
Organization policy
```

### Support

```text
SLA
Architecture assistance
Security review
Dedicated support
```

CTA:

```text
[ Talk to Sales ]
```

---

# 41. Section 12 — Pricing transparency

This should be a distinctive Tellann section.

Heading:

> **Pricing shouldn't require reverse engineering.**

Then:

```text
No hidden credits.
No mystery conversion ratios.
No surprise telemetry units.
```

The pricing strategy explicitly requires transparent billable units and rejects opaque credit systems. 

You can then say:

> As Tellann evolves, new consumption dimensions will be clearly separated and explained rather than folded into hidden platform credits.

---

# 42. Future event pricing

This needs careful wording.

Tellann's future Phase 2 pricing is expected to add:

```text
Base plan
+
Included event pool
+
Event overage
```

because production monitoring materially changes infrastructure usage. 

But don't expose a fake number yet.

Use:

> Production monitoring pricing will be disclosed separately before those capabilities become generally available.

If you show it at all.

---

# 43. Future intelligence pricing

Phase 3 pricing anticipates:

```text
Base subscription
+
event consumption
+
AI/intelligence consumption
```

with clear conversion rules rather than opaque credits. 

Again, do not put:

```text
500 AI credits
```

on the current Business card unless those features are actually commercially released.

The packaging document only describes that as future evolution. 

---

# 44. Section 13 — Upgrade path

Visual:

```text
FREE
  │
  ▼
LOCAL
  │
  ▼
SOLO
  │
  ▼
TEAM
  │
  ▼
BUSINESS
  │
  ▼
ENTERPRISE
```

But describe *why* a user moves.

```text
Free → Local
"I need Tellann to understand project intent."

Local → Solo
"I want automated instrumentation."

Solo → Team
"I need collaboration."

Team → Business
"I need APIs, audit and governance."

Business → Enterprise
"I need infrastructure and identity control."
```

This is much better than:

> Upgrade for more features.

---

# 45. Section 14 — FAQ

I would include approximately 8–10 questions.

### "Can I use Tellann for free?"

> Yes. Free includes one application, one user, core behavioral QA capabilities, 1 GB storage and 14-day retention. 

---

### "What is the Local plan?"

Explain project/document intelligence and its position between Free and Solo.

---

### "Does Local mean Tellann is completely offline?"

No.

Explain hybrid architecture.

---

### "Does Tellann upload my source code?"

Explain local-first source analysis and explicit approval model according to the desktop architecture. 

---

### "What happens when I need more applications?"

Point users toward the next tier.

---

### "Can I cancel or downgrade?"

This isn't specified in the supplied pricing docs.

So don't promise specific billing behavior until your billing policy is defined.

---

### "Do you charge per event?"

For the current Phase 1 commercial structure:

> No. Pricing is primarily based on applications, users, storage and retention.

Future production monitoring may introduce event-based usage. 

---

### "Can Tellann be self-hosted?"

> Enterprise supports self-hosted deployments. 

---

### "Which plan supports automated instrumentation?"

> Solo and above. 

---

### "Which plan supports team collaboration?"

> Team and above. 

---

# 46. CTA behavior

Each plan CTA should preserve the selected plan.

For anonymous users:

```text
/pricing
↓
Choose Solo
↓
/signup?plan=solo
↓
Create account
↓
Checkout / activation
```

For logged-in users:

```text
/pricing
↓
Choose Team
↓
app.tellann.co/settings/billing?plan=team
```

Enterprise:

```text
/pricing
↓
Talk to Sales
↓
/contact/sales?plan=enterprise
```

---

# 47. Current customer behavior

If a logged-in user lands on pricing, display:

```text
CURRENT PLAN
Solo
```

on the Solo card.

Button becomes:

```text
Current plan
```

not:

```text
Choose Solo
```

Higher plan:

```text
Upgrade
```

Lower plan:

```text
View downgrade options
```

However, don't make the public `/pricing` page the actual billing-management UI.

Billing changes belong in:

```text
app.tellann.co/settings/billing
```

---

# 48. Plan configuration architecture

I would strongly avoid defining pricing inside the SEO frontend.

Something like:

```ts
type PublicPlan = {
  id:
    | "FREE"
    | "LOCAL"
    | "SOLO"
    | "TEAM"
    | "BUSINESS"
    | "ENTERPRISE";

  name: string;
  description: string;

  pricing: {
    monthly?: number;
    annual?: number;
    currency: string;
    custom: boolean;
  };

  limits: {
    applications?: number;
    users?: number;
    storageGb?: number;
    retentionDays?: number;
  };

  entitlements: string[];

  display: {
    badge?: string;
    recommended?: boolean;
    sortOrder: number;
  };
}
```

Then:

```text
Billing configuration
        ↓
Pricing API
        ↓
tellann.co/pricing

AND

app.tellann.co/settings/billing
```

Both surfaces see identical pricing.

---

# 49. Entitlements, not plan-name checks

This is especially important after adding Local.

Bad:

```ts
if (
  plan === "SOLO" ||
  plan === "TEAM" ||
  plan === "BUSINESS"
) {
  enableInstrumentation();
}
```

Better:

```ts
if (
  entitlements.includes(
    "AUTOMATED_INSTRUMENTATION"
  )
) {
  enableInstrumentation();
}
```

The desktop implementation explicitly recommends feature-based entitlements instead of hardcoding authorization against plan labels. 

This protects you when plans inevitably change.

---

# 50. Mobile layout

Cards become vertical:

```text
FREE

LOCAL

SOLO

TEAM

BUSINESS

ENTERPRISE
```

But keep the two categories:

```text
FOR INDIVIDUALS
Free
Local
Solo

FOR TEAMS
Team
Business
Enterprise
```

Comparison matrix:

```text
Feature dropdown
+
plan selector
```

Don't force users to horizontally scroll through six 200px columns forever.

---

# 51. Mobile comparison pattern

For example:

```text
Compare plans

Plan A
[ Local ▾ ]

Plan B
[ Solo ▾ ]

                LOCAL     SOLO

Document intent   ✓         ✓
Instrumentation   —         ✓
Team review       —         —
Applications      X         3
Storage           X        25GB
```

Much more usable.

---

# 52. SEO

Suggested title:

```text
Tellann Pricing — Free, Local, Solo, Team & Enterprise Plans
```

Meta description:

```text
Compare Tellann plans for individual developers, QA teams and engineering organizations. Start free and scale into local project intelligence, automated instrumentation, collaboration and enterprise governance.
```

Canonical:

```text
https://tellann.co/pricing
```

---

# 53. Page schema

Use:

```text
Product
SoftwareApplication
Offer
```

for the plans that actually have publicly established prices.

Do not put Local structured-data pricing out until the billing value is officially configured.

---

# 54. Analytics

Track:

```text
PRICING_PAGE_VIEWED

BILLING_PERIOD_CHANGED
CURRENCY_CHANGED

PLAN_CARD_VIEWED
PLAN_DETAILS_EXPANDED

FREE_SELECTED
LOCAL_SELECTED
SOLO_SELECTED
TEAM_SELECTED
BUSINESS_SELECTED
ENTERPRISE_CONTACT_SELECTED

COMPARE_TABLE_VIEWED
COMPARE_PLAN_CHANGED

LOCAL_EXPLAINER_VIEWED
ENTERPRISE_SECTION_VIEWED

PRICING_FAQ_EXPANDED
```

Most interesting funnels:

```text
Pricing → Free signup
Pricing → Paid signup

Local viewed → Local purchase

Local viewed → Solo purchase

Solo → Team

Enterprise section → Sales inquiry
```

The **Local → Solo relationship** will be especially valuable to monitor because Local is deliberately a new intermediate tier.

---

# 55. Recommended final plan hierarchy

So the customer-facing Tellann pricing system should now read conceptually as:

| Plan           |                              Price | Best for                      | Core unlock                          |
| -------------- | ---------------------------------: | ----------------------------- | ------------------------------------ |
| **Free**       |                             **$0** | Evaluation                    | Guided QA + core Tellann             |
| **Local**      | **Configured/TBD in current docs** | Local-first developers        | Document/project intent              |
| **Solo**       |                         **$29/mo** | Independent professionals     | Automated instrumentation            |
| **Team**       |                         **$99/mo** | Engineering/QA teams          | Collaboration + RBAC                 |
| **Business**   |                        **$299/mo** | Growing organizations         | API + audit + governance             |
| **Enterprise** |                         **Custom** | Large/regulated organizations | SSO + self-hosting + custom controls |

The published standard prices and existing limits come from the commercial pricing specification.  The newer Local/Solo/Team desktop boundaries come from the subsequent agentic desktop plan. 

The most important thing I would change in the underlying product before implementing this page is therefore **not visual**: formally update the Pricing & Packaging Specification to include Local. Right now, the product architecture treats Local as real, but the authoritative commercial pricing specification still claims that Tellann has only five plans. Until that is reconciled, `/pricing` can easily become the place where two different versions of Tellann's business model collide.
