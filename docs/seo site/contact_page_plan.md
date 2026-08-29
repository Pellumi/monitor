`/contact` should be the **routing layer between a visitor and the right part of Tellann**.

It should not be one generic form that sends every message into the same inbox. A prospective enterprise customer, a developer with an SDK problem, a security researcher, a journalist, and a potential partner have fundamentally different intents.

The page should therefore answer:

**Why are you contacting Tellann? → What information do we need? → Where should the request go? → What should happen next?**

# `/contact` — Complete Page Specification

## 1. Primary objectives

The page should support these contact intents:

```text
Sales / Demo
Enterprise
Technical Support
General Enquiry
Partnerships
Press / Media
Security
Privacy / Data Request
```

The primary commercial journey is:

```text
Visitor
   ↓
Choose reason
   ↓
Complete contextual form
   ↓
Submission confirmed
   ↓
Correct internal destination
```

For existing Tellann customers:

```text
Existing customer
   ↓
Support
   ↓
Authenticated support workflow
```

rather than treating them like an anonymous sales lead.

---

# 2. Recommended route strategy

Initially, keep one canonical page:

```text
/contact
```

and control the selected intent using query parameters:

```text
/contact?reason=sales
/contact?reason=enterprise
/contact?reason=support
/contact?reason=partnership
/contact?reason=press
/contact?reason=security
```

This means buttons throughout the website can deep-link directly into the correct form state.

For example:

```text
/pricing
   ↓
Talk to Sales
   ↓
/contact?reason=enterprise
```

I would **not** immediately create:

```text
/contact/sales
/contact/support
/contact/press
/contact/security
```

unless those contact experiences later become substantial enough to warrant their own SEO/content pages.

---

# 3. Complete page structure

```text
/contact
│
├── 01 Navigation
├── 02 Contact Hero
├── 03 Contact Intent Selector
├── 04 Contextual Contact Form
├── 05 Alternative Contact Paths
├── 06 Existing Customer Support
├── 07 Sales / Enterprise Information
├── 08 Security & Privacy Contact
├── 09 Response Expectations
├── 10 FAQ
├── 11 Final Help Block
└── 12 Footer
```

---

# 4. Section 01 — Navigation

Use the standard Tellann navbar:

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

Within the Company mega-menu:

```text
Company Overview
Careers
Contact
Brand
Roadmap
```

`Contact` should show the active state.

---

# 5. Section 02 — Contact hero

This should be simpler than the Company and Careers pages.

### Eyebrow

```text
CONTACT TELLANN
```

### H1

Recommended:

> **Talk to the right team.**

Supporting copy:

> Whether you're evaluating Tellann, working through an integration, exploring a partnership, or contacting us about security or privacy, we'll help route your request appropriately.

Primary goal:

**reduce uncertainty before the form appears.**

---

# 6. Hero secondary links

Under the intro:

```text
Already use Tellann? → Get support

Looking for documentation? → Read the docs
```

Routes:

```text
app.tellann.co/...support
docs.tellann.co
```

once those destinations exist.

This prevents the contact form from becoming a substitute for documentation.

---

# 7. Section 03 — Contact intent selector

Heading:

> **What can we help with?**

Use large selectable cards.

Desktop:

```text
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Sales & Demo     │ │ Enterprise       │ │ Support          │
│                  │ │                  │ │                  │
│ Evaluate Tellann │ │ Security, scale  │ │ Product or SDK   │
│ for your team.   │ │ and deployment.  │ │ assistance.      │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Partnerships     │ │ Press & Media    │ │ General          │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────┐ ┌──────────────────┐
│ Security         │ │ Privacy          │
└──────────────────┘ └──────────────────┘
```

Mobile becomes a single-column list.

---

# 8. Sales & Demo

Description:

> **See whether Tellann fits your engineering or QA workflow.**

Use this for:

* product evaluation;
* demo requests;
* pricing questions;
* implementation questions before purchase;
* team adoption discussions.

Selecting this changes the form accordingly.

---

# 9. Enterprise

Description:

> **Discuss deployment, governance, security, identity and organizational requirements.**

This should be separate from normal sales because Tellann's Enterprise packaging includes capabilities such as SSO, SAML/OIDC, custom retention, self-hosting, private networking, data-residency controls and security reviews. 

---

# 10. Support

Description:

> **Get help using Tellann, the SDK, integrations or your workspace.**

If the visitor is logged in:

```text
Support
   ↓
Open authenticated support
```

rather than exposing the generic public form.

If anonymous:

```text
Are you already a Tellann customer?

[ Sign in for support ]

or

Continue with general technical enquiry
```

---

# 11. Partnerships

Description:

> **Explore technology, ecosystem, integration or commercial partnerships.**

Potential categories later:

```text
Technology integration
Developer ecosystem
Cloud / infrastructure
Consulting partnership
Reseller / commercial
Community / education
```

Do not expose these subcategories until partnerships become operationally meaningful.

---

# 12. Press & Media

Description:

> **For interviews, product information and media enquiries.**

Quick links:

```text
Company overview
Brand resources
Product description
```

Routes:

```text
/company
/brand
/product
```

This lets a journalist answer common questions without waiting for a response.

---

# 13. Security

This one should **not behave like an ordinary contact form**.

Tellann processes behavioral telemetry and maintains explicit security architecture around authentication, tenant isolation, encryption, auditability and monitoring. 

The card should say:

> **Report a security concern or suspected vulnerability.**

Then either:

```text
Report security issue →
```

or a dedicated security disclosure form.

Eventually this may deserve:

```text
/security/report
```

rather than `/contact`.

---

# 14. Privacy

Description:

> **Ask about data handling, retention, deletion or privacy controls.**

Tellann's privacy specification explicitly supports configurable privacy policies, retention, deletion requests, export requests and auditable privacy actions. 

This route should therefore distinguish:

```text
Product privacy question
Data access request
Data deletion request
Data export request
Privacy complaint
```

If legal identity verification is required for a formal data request later, that workflow should be handled separately and securely rather than collecting sensitive identity documents through a normal form.

---

# 15. General enquiry

Use only when none of the defined categories fit.

Description:

> **Something else? Send it here.**

This should deliberately be last.

Otherwise everyone picks "General" and defeats the entire routing system.

---

# 16. Section 04 — Contextual form

The form changes based on contact reason.

There should be a common base plus intent-specific fields.

---

# 17. Common fields

Use:

```text
First name *
Last name *

Work email *

Company / Organization

Reason for contact *
[ selected automatically ]

Message *
```

Potentially:

```text
Country / Region
```

only if required operationally.

Do not collect data simply because CRM tools usually have the field.

---

# 18. Work email

For commercial forms, label:

```text
Work email
```

rather than:

```text
Email
```

But do **not** block Gmail or other personal domains.

Independent developers, startup founders, students and open-source maintainers are legitimate Tellann audiences. 

Blocking them would conflict with your actual market.

---

# 19. Sales form

When `reason=sales`:

```text
First name *
Last name *
Work email *
Company

Role
[ Developer
  QA Engineer
  Engineering Manager
  Product
  Founder
  Other ]

Team size
[ 1
  2–10
  11–50
  51–200
  200+ ]

What are you looking to solve?
[ textarea ]

Interested plan
[ Not sure
  Free
  Local
  Solo
  Team
  Business
  Enterprise ]
```

The roles correspond well to Tellann's current target users. 

---

# 20. Do not overqualify sales leads

Avoid a 15-field form requiring:

```text
annual revenue
funding stage
phone number
exact budget
implementation deadline
number of engineers
technology stack
```

before someone can ask a question.

For Tellann at this stage:

```text
5–7 useful fields
```

is enough.

---

# 21. Enterprise form

Fields:

```text
Name *
Work email *
Organization *
Role *

Organization size
[ optional ]

Number of applications
[ optional ]

Primary requirement *
[ SSO / Identity
  Security Review
  Self Hosting
  Private Networking
  Data Residency
  Custom Retention
  Large-scale Deployment
  Procurement
  Other ]

Tell us about your requirements *
```

Optional:

```text
Target timeline
```

---

# 22. Enterprise architecture link

Beside the form:

```text
Evaluating architecture?

View:
Security →
Enterprise →
Deployment options →
```

Tellann's deployment design supports both managed SaaS and customer-controlled self-hosted deployment. 

---

# 23. Support form

If anonymous support must be allowed:

```text
Name *
Email *
Tellann workspace / organization
Application name
Issue category *
```

Categories:

```text
Account
Billing
SDK
Application integration
Session recording
Behavior Graph
Reports
Dashboard
Other
```

Then:

```text
Subject *
Description *
```

Optional:

```text
Error ID / Request ID
```

This is far better than asking users to paste credentials or raw secrets.

---

# 24. Support security warning

Under the message field:

> **Do not include passwords, API secrets, access tokens, private keys, payment information or other sensitive credentials.**

That is consistent with Tellann's own collection model, which explicitly forbids credentials, authentication tokens, secrets and financial credentials. 

---

# 25. File attachments

Support may eventually allow:

```text
Screenshots
Logs
Exported Tellann reports
```

But attachments should be:

* optional;
* size-limited;
* malware scanned;
* access controlled;
* stored according to an explicit retention policy.

Do not implement unrestricted:

```text
Upload any file
```

for a public contact form.

---

# 26. Partnership form

Fields:

```text
Name *
Work email *
Company / Project *

Partnership type
[ Technology
  Integration
  Commercial
  Community
  Education
  Other ]

Website
[ optional ]

Proposal *
```

That's enough.

---

# 27. Press form

Fields:

```text
Name *
Work email *
Publication / Organization *

Enquiry type
[ Interview
  Product Information
  Company Information
  Media Assets
  Other ]

Deadline
[ optional ]

Message *
```

The optional deadline matters for journalists.

---

# 28. General form

Keep this extremely simple:

```text
Name *
Email *
Subject *
Message *
```

---

# 29. Security form

Security reports require a more specialized structure:

```text
Name / Alias
Email *

Affected product/component *
Issue summary *
Technical description *
Potential impact *
Reproduction steps *
```

Optional:

```text
Supporting attachment
```

Include:

> Do not access, modify, or retain data that does not belong to you while investigating.

Eventually `/security` should contain the full responsible-disclosure policy.

---

# 30. Privacy form

Fields:

```text
Name *
Email *
Organization
Request type *

[ Privacy question
  Access request
  Export request
  Deletion request
  Retention question
  Other ]

Message *
```

Do not ask for more identity data than necessary in the first step.

---

# 31. Form UX

Each selected intent should update:

```text
Title
Description
Fields
Submission destination
Success message
```

without reloading the entire page.

Example:

```text
Sales & Demo selected

Tell us what you're evaluating.

[ form ]
```

If the URL contains:

```text
/contact?reason=enterprise
```

Enterprise should already be selected on load.

---

# 32. Form step design

I would keep it single-page rather than multi-step for most intents.

Exception:

Enterprise could eventually use:

```text
01 About you
02 Requirements
```

if the form grows.

At launch, one screen is preferable.

---

# 33. Required-field behavior

Display:

```text
*
```

and accessible labels.

Validation should happen:

```text
on blur
+
on submit
```

rather than shouting errors while a user is still typing.

---

# 34. Error messages

Bad:

```text
Invalid input.
```

Better:

```text
Enter a valid email address.
```

Bad:

```text
This field is invalid.
```

Better:

```text
Tell us briefly what you need help with.
```

---

# 35. Submission state

Support four states:

```text
IDLE
SUBMITTING
SUCCESS
ERROR
```

### Submitting

```text
Sending...
```

Disable repeat submission.

### Success

Specific to intent.

Sales:

> **Thanks. Your request has been sent to the Tellann team.**

Support:

> **Your support request has been received.**

Security:

> **Your security report has been received.**

Never promise:

> We'll respond within two hours.

unless that SLA actually exists.

---

# 36. Error state

Use:

> **We couldn't send your request. Your message hasn't been submitted. Please try again.**

Preserve form contents.

Do not wipe a user's 500-word message after a server error.

---

# 37. Spam protection

Do not start with hostile CAPTCHAs unless needed.

Recommended stack:

```text
Honeypot
        ↓
Rate limiting
        ↓
Server-side validation
        ↓
Abuse detection
        ↓
CAPTCHA only if risk warrants
```

This keeps conversion friction low.

---

# 38. Backend routing

The user sees one form system, but requests should be internally routed.

Conceptually:

```text
POST /contact
       ↓
Validate
       ↓
Classify reason
       ↓
Create enquiry
       ↓
Route
```

Then:

```text
SALES
→ commercial queue

ENTERPRISE
→ enterprise queue

SUPPORT
→ support queue

PARTNERSHIP
→ partnerships queue

PRESS
→ communications queue

SECURITY
→ restricted security queue

PRIVACY
→ privacy/legal queue

GENERAL
→ general queue
```

Security and privacy submissions should not simply land in a broad company inbox.

---

# 39. Contact record data model

Something like:

```ts
type ContactRequest = {
  id: string;

  type:
    | "SALES"
    | "ENTERPRISE"
    | "SUPPORT"
    | "PARTNERSHIP"
    | "PRESS"
    | "SECURITY"
    | "PRIVACY"
    | "GENERAL";

  firstName?: string;
  lastName?: string;

  email: string;
  organization?: string;

  subject?: string;
  message: string;

  metadata?: Record<string, unknown>;

  status:
    | "NEW"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED";

  createdAt: string;
};
```

---

# 40. Data minimization

Tellann's own privacy philosophy requires collecting only information required to perform the intended function. 

Apply the same principle here.

Don't collect:

```text
phone number
street address
date of birth
job title
company revenue
```

unless there is a concrete reason.

---

# 41. Consent notice

Under the form:

> By submitting this form, you agree that Tellann may use the information provided to respond to your enquiry. See our Privacy Policy.

Link:

```text
/legal/privacy
```

Don't sneak marketing subscription consent into this statement.

If you later want permission to send marketing:

```text
□ Send me Tellann product updates.
```

must be separate and optional where appropriate.

---

# 42. Section 05 — Alternative contact paths

Heading:

> **Looking for something else?**

Use quick links.

```text
Documentation
Technical guides and SDK reference.
→ docs.tellann.co

Security
Learn how Tellann protects application data.
→ /security

Privacy
Understand what Tellann collects and excludes.
→ /security/privacy

Careers
Interested in building Tellann?
→ /careers

Brand
Looking for logos or media assets?
→ /brand
```

This prevents unnecessary submissions.

---

# 43. Section 06 — Existing customer support

Heading:

> **Already using Tellann?**

Copy:

> The fastest way to get help with a workspace, application, billing issue or integration is through authenticated support.

Buttons:

```text
[ Sign in for support ]
[ Read documentation ]
```

This is important because authenticated support can automatically know:

```text
Organization
Plan
Application
User
Recent request identifiers
```

without asking users to manually provide everything.

---

# 44. Do not expose customer telemetry automatically

Even authenticated support should not automatically attach replay/session/application telemetry unless product policy explicitly allows it and customer access controls are respected.

Tellann's security architecture requires authenticated, role-aware, tenant-isolated access. 

---

# 45. Section 07 — Sales & enterprise support panel

For commercial visitors, show a side panel:

> **Evaluating Tellann for your team?**

Then:

```text
Behavioral QA
Developer Demonstration Mode
Behavior Graphs
Workflow coverage
Session Replay
Endpoint intelligence
QA reports
```

These are current MVP capabilities. 

CTA:

```text
View pricing →
```

---

# 46. Enterprise panel

Small section:

> **Need more control?**

```text
SSO
Custom retention
Self hosting
Private networking
Data residency
Enterprise support
```

These align with current Enterprise packaging. 

CTA:

```text
Select Enterprise enquiry
```

---

# 47. Section 08 — Security and privacy contact

This deserves visual separation.

```text
SECURITY & PRIVACY

Security issue?
Report security concern →

Privacy request?
Contact privacy →
```

Add explanatory copy:

> Security and privacy enquiries are routed separately from general commercial requests.

That reassures users these requests are handled differently.

---

# 48. Section 09 — Response expectations

Do not invent response SLAs.

Use honest statements.

For example:

```text
Sales
We review product and evaluation enquiries through the commercial queue.

Support
Existing customers should use authenticated support where available.

Security
Security submissions are routed directly to the appropriate review process.

Privacy
Privacy requests are handled separately from product enquiries.
```

Once actual target response windows exist, you can add them.

---

# 49. Section 10 — FAQ

Recommended questions:

### Can I try Tellann without talking to sales?

> Yes. Tellann has a Free plan intended for evaluation and individual use. 

CTA:

```text
Start free →
```

---

### Do I need a demo before signing up?

> No. Self-service plans should be available without a sales process.

---

### Where should I report a security issue?

Point to the security contact path.

---

### Where can I get SDK help?

```text
Documentation
→ Support
```

---

### I'm interested in self-hosting. Who should I contact?

Enterprise.

Self-hosting belongs to the Enterprise deployment model. 

---

### Can I request deletion or export of data?

Route to Privacy.

Tellann's privacy specification anticipates deletion and export requests. 

---

### Where can I find your brand assets?

→ `/brand`

---

# 50. Final help block

Rather than another generic CTA:

> **Not sure where your question belongs?**

Supporting:

> Choose General Enquiry and we'll route it from there.

```text
[ General enquiry ]
```

Simple.

---

# 51. Footer

Use the standard marketing footer.

Company section:

```text
Company Overview
Careers
Contact
Brand
Roadmap
```

`Contact` active where relevant.

---

# 52. Desktop layout

I would use an asymmetrical form layout.

```text
NAV
──────────────────────────────────────

                 CONTACT

             Talk to the
              right team.

──────────────────────────────────────

       WHAT CAN WE HELP WITH?

 Sales     Enterprise     Support
 Partner   Press          General
 Security  Privacy

──────────────────────────────────────

┌───────────────────┬───────────────────────────┐
│                   │                           │
│ SALES & DEMO      │ Contact Form              │
│                   │                           │
│ Relevant context  │ Name                      │
│ Helpful links     │ Email                     │
│                   │ Company                   │
│                   │ Role                      │
│                   │ Message                   │
│                   │                           │
│                   │ [ Send request ]          │
│                   │                           │
└───────────────────┴───────────────────────────┘

──────────────────────────────────────

        ALREADY USING TELLANN?

──────────────────────────────────────

          SECURITY & PRIVACY

──────────────────────────────────────

                 FAQ

──────────────────────────────────────

               FOOTER
```

The form should be the dominant element.

---

# 53. Mobile layout

```text
Hero
↓
Reason selector
↓
Selected reason description
↓
Form
↓
Existing customer support
↓
Alternative links
↓
Security/privacy
↓
FAQ
↓
Footer
```

Intent cards could become:

```text
[ Sales & Demo        > ]
[ Enterprise          > ]
[ Support             > ]
[ Partnerships        > ]
[ Press & Media       > ]
[ Security            > ]
[ Privacy             > ]
[ General enquiry     > ]
```

---

# 54. Mobile form considerations

Use correct input types:

```html
type="email"
```

Avoid unnecessary side-by-side fields.

Instead of:

```text
First Name | Last Name
```

use stacked fields on narrow screens.

Textareas should have reasonable minimum height.

The submit button should be full-width.

---

# 55. Accessibility

Every field needs:

* visible label;
* programmatic label;
* explicit error association;
* keyboard accessibility;
* meaningful focus state.

For errors:

```text
Email
[ abc ]

⚠ Enter a valid email address.
```

Use:

```text
aria-describedby
aria-invalid
```

appropriately.

---

# 56. SEO metadata

Suggested title:

```text
Contact Tellann — Sales, Support & General Enquiries
```

Meta description:

```text
Contact Tellann for product questions, enterprise requirements, technical support, partnerships, media enquiries, security concerns or privacy requests.
```

Canonical:

```text
https://tellann.co/contact
```

---

# 57. Do not index form-state URLs separately

These:

```text
/contact?reason=sales
/contact?reason=enterprise
/contact?reason=support
```

should canonicalize to:

```text
/contact
```

They are states, not separate SEO documents.

---

# 58. Analytics

Track:

```text
CONTACT_PAGE_VIEWED

CONTACT_REASON_SELECTED

CONTACT_FORM_STARTED

CONTACT_FORM_SUBMITTED
CONTACT_FORM_FAILED
```

With safe metadata:

```text
reason
```

For example:

```json
{
  "event": "CONTACT_FORM_SUBMITTED",
  "reason": "ENTERPRISE"
}
```

Do **not** send:

```text
name
email
message
```

into general marketing analytics.

---

# 59. Conversion tracking

Commercially useful metrics:

```text
Contact page → form start

Form start → submission

Sales submissions

Enterprise submissions

Pricing → enterprise contact

Security page → security report

Docs → support request
```

You can eventually understand whether users are failing to self-serve.

For instance, a huge number of:

```text
SDK support requests
```

may indicate weak documentation rather than a need for more support staff.

---

# 60. Component architecture

```text
ContactPage
│
├── MarketingNavbar
├── ContactHero
├── ContactReasonSelector
│   └── ContactReasonCard[]
├── ContactWorkspace
│   ├── ContactContext
│   └── ContactForm
│       ├── CommonFields
│       └── IntentSpecificFields
├── CustomerSupportSection
├── AlternativeContactPaths
├── SecurityPrivacySection
├── ResponseExpectations
├── ContactFAQ
└── MarketingFooter
```

---

# 61. Form architecture

Don't build eight entirely separate forms.

Use a configuration model:

```ts
type ContactReasonConfig = {
  id: ContactReason;
  label: string;
  description: string;
  fields: ContactField[];
  submitLabel: string;
};
```

Then:

```text
reason
  ↓
configuration
  ↓
dynamic form
```

This avoids duplicating:

```text
validation
submission states
accessibility
spam protection
analytics
```

eight times.

---

# 62. Contact reason type

```ts
type ContactReason =
  | "SALES"
  | "ENTERPRISE"
  | "SUPPORT"
  | "PARTNERSHIP"
  | "PRESS"
  | "SECURITY"
  | "PRIVACY"
  | "GENERAL";
```

---

# 63. Submission response

API response:

```json
{
  "success": true,
  "requestId": "REQ-..."
}
```

Show the reference where useful:

```text
Reference: REQ-24F91
```

Especially useful for:

```text
support
security
privacy
```

because the user can refer to it later.

---

# 64. Rate limiting

Protect:

```text
IP
email
submission frequency
```

but avoid aggressive false positives.

Security researchers or enterprise users may submit longer reports and should not be accidentally blocked by simplistic filters.

---

# 65. Logging

Operational logs should contain:

```text
requestId
reason
status
routing result
timestamp
```

but avoid writing the entire contact message into ordinary application logs.

Tellann's security architecture already emphasizes auditability and secret-safe operation. 

---

# 66. Notifications

Internal processing:

```text
Contact submitted
       ↓
Persist
       ↓
Route
       ↓
Notify relevant internal owner
```

Potentially:

```text
Email
CRM
Support system
Internal workspace
```

later.

But persistence should occur before notification so a failed email notification does not destroy the enquiry.

---

# 67. Confirmation email

Send an acknowledgement for important requests:

```text
We've received your Tellann enquiry.

Reference: ...
Type: Enterprise enquiry

You don't need to submit the form again.
```

Do not echo the entire potentially sensitive message back via email.

---

# 68. What I would not implement

I would avoid:

### A giant public telephone number

unless Tellann actually provides phone support.

### Live chat

until someone reliably staffs it.

A dead:

```text
We're currently offline.
```

bubble on every page is worse than no chat.

### Fake office address

Do not publish one for cosmetic credibility.

### "24/7 support"

unless it exists contractually.

### Ten different public email addresses

Avoid clutter like:

```text
hello@
sales@
support@
press@
careers@
partners@
security@
privacy@
billing@
enterprise@
```

The website's routing layer should hide most of that complexity.

---

# 69. What should be implemented now

For the first production version, I would build:

```text
✓ Contact hero
✓ Intent selector

✓ Sales form
✓ Enterprise form
✓ Support routing
✓ Partnership form
✓ Press form
✓ General enquiry

✓ Security path
✓ Privacy path

✓ Contextual validation
✓ Success/error states
✓ Spam protection
✓ Backend routing
✓ Reference IDs

✓ Documentation links
✓ Existing-user support CTA
✓ FAQ
✓ Analytics
✓ Footer
```

You can connect the internal destinations to whatever CRM/support tooling Tellann eventually adopts.

---

# 70. The core page logic

The entire `/contact` page can ultimately be understood as:

```text
Why are you here?
       ↓
Sales
Enterprise
Support
Partnership
Press
Security
Privacy
General
       ↓
Ask only what is relevant
       ↓
Route correctly
       ↓
Give clear confirmation
```

That is the right contact experience for Tellann. The same philosophy that governs the product should govern this page: **reduce noise, preserve context, and route evidence to where it is actually useful.**
