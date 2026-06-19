Yes. With the cleaner setup, we should treat the three surfaces as three separate deployable apps inside the same monorepo:

```txt
domain-name.com          Marketing / SEO site
app.domain-name.com      Authenticated SOTS product
docs.domain-name.com     Documentation
```

The key architectural decision: **do not move the dashboard under `/app`**. Since the product gets its own subdomain, `app.domain-name.com/` can remain the authenticated dashboard overview.

**Target Monorepo Shape**

Current:

```txt
apps/
  dashboard/             Existing product app
packages/
services/
```

Target:

```txt
apps/
  marketing/             domain-name.com
  dashboard/             app.domain-name.com
  docs/                  docs.domain-name.com

packages/
  shared/
  backend-sdk/
  frontend-sdk/
  ...
services/
  api-gateway/
  auth-api/
  billing-api/
  ...
```

Recommended package names:

```txt
apps/marketing   -> @sots/marketing
apps/dashboard   -> dashboard or @sots/dashboard
apps/docs        -> @sots/docs
```

**Domain Responsibility**

| Domain | App | Purpose |
|---|---|---|
| `domain-name.com` | `apps/marketing` | Public SEO, product positioning, conversion |
| `app.domain-name.com` | `apps/dashboard` | Authenticated product, onboarding, dashboard |
| `docs.domain-name.com` | `apps/docs` | Public documentation and user education |

Optional later:

```txt
api.domain-name.com      Public API gateway / SDK ingestion
```

For MVP, the dashboard can keep proxying API calls through `/api-gateway`, but for production SDK usage, `api.domain-name.com` is cleaner.

---

**Phase 1: Prepare The Monorepo**

1. Add `apps/marketing`.
2. Add `apps/docs`.
3. Keep both as Next.js apps, matching the existing dashboard stack:
   - Next.js
   - React
   - TypeScript
   - Tailwind
   - pnpm workspace
   - Turbo build orchestration

4. Update root scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev --concurrency=20",
    "dev:marketing": "pnpm --filter @sots/marketing dev",
    "dev:app": "pnpm --filter dashboard dev",
    "dev:docs": "pnpm --filter @sots/docs dev",
    "build": "turbo run build",
    "build:marketing": "pnpm --filter @sots/marketing build",
    "build:app": "pnpm --filter dashboard build",
    "build:docs": "pnpm --filter @sots/docs build"
  }
}
```

5. Assign local ports:

```txt
marketing   localhost:3009
dashboard   localhost:3010
docs        localhost:3011
api-gateway localhost:3000
```

---

**Phase 2: Marketing Site**

Create the SEO site at:

```txt
apps/marketing
```

Recommended routes:

```txt
/
 /pricing
 /security
 /contact
 /privacy
 /terms
 /robots.txt
 /sitemap.xml
```

The homepage should explain SOTS clearly:

```txt
Hero:
  Self-observing QA intelligence for modern software teams.

Core loop:
  Declare -> Observe -> Reconcile -> Report

Audience sections:
  QA teams
  Developers
  Project managers
  Engineering leaders

Feature sections:
  Behavioral graph
  Flow declaration
  SDK telemetry
  Reconciliation
  Missing states and flows
  Session review
  Endpoint analysis
  Report exports
  Entitlements and billing

CTA:
  Start reviewing your system -> app.domain-name.com/auth/login
  Read the docs -> docs.domain-name.com
```

SEO requirements:

- full metadata per page
- Open Graph image
- Twitter card image
- canonical URLs
- structured data using JSON-LD
- sitemap
- robots.txt
- clean headings
- optimized copy for search terms like:
  - software testing coverage
  - QA intelligence
  - behavioral testing
  - application workflow coverage
  - missing test paths
  - session-based QA reports

Marketing app environment:

```env
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
NEXT_PUBLIC_SITE_URL=https://domain-name.com
```

---

**Phase 3: Documentation Site**

Create the documentation app at:

```txt
apps/docs
```

Recommended routes:

```txt
/
 /getting-started
 /concepts
 /qa-guide
 /developer-guide
 /project-manager-guide
 /admin-guide
 /sdk/frontend
 /sdk/backend
 /api-reference
 /reconciliation
 /reports
 /billing
 /entitlements
 /security
 /troubleshooting
```

Recommended docs structure:

```txt
apps/docs/content/
  getting-started.mdx
  concepts/
    declare-observe-reconcile-report.mdx
    behavioral-graph.mdx
    expected-coverage.mdx
  qa/
    declaring-flows.mdx
    running-a-review.mdx
    interpreting-gaps.mdx
  developers/
    frontend-sdk.mdx
    backend-sdk.mdx
    express-fastify.mdx
    api-keys.mdx
  project-managers/
    release-readiness.mdx
    coverage-reports.mdx
  admins/
    organizations.mdx
    users-roles.mdx
    billing.mdx
    audit-logs.mdx
  api/
    gateway.mdx
    events.mdx
    reports.mdx
    reconciliation.mdx
```

Docs should include:

- copy-paste SDK snippets
- screenshots or diagrams
- role-specific guides
- troubleshooting
- glossary
- API reference
- billing/entitlement behavior
- “first review” walkthrough

Docs app environment:

```env
NEXT_PUBLIC_SITE_URL=https://docs.domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
```

For implementation, I would use either:

- plain Next.js + MDX for maximum control
- or Fumadocs/Nextra if you want built-in docs navigation, search, sidebar, and table of contents

For MVP speed, I’d choose **Next.js + MDX or Fumadocs**.

---

**Phase 4: Keep Dashboard As The Product App**

The existing dashboard becomes:

```txt
app.domain-name.com
```

Routes remain mostly unchanged:

```txt
/
 /auth/login
 /onboarding
 /onboarding/new-app
 /onboarding/api-keys
 /declare
 /reconciliation
 /graph
 /workflows
 /missing-states
 /missing-flows
 /sessions
 /endpoints
 /reports
 /settings/profile
```

First-time app journey:

```txt
app.domain-name.com/auth/login
  -> app.domain-name.com/onboarding
  -> app.domain-name.com/onboarding/new-app
  -> app.domain-name.com/onboarding/api-keys
  -> app.domain-name.com/declare
  -> app.domain-name.com/reconciliation
  -> app.domain-name.com/
```

Returning users:

```txt
app.domain-name.com/auth/login
  -> app.domain-name.com/
```

Dashboard environment:

```env
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_API_GATEWAY_URL=https://api.domain-name.com
```

If `api.domain-name.com` is not added for MVP, keep:

```txt
/app-domain /api-gateway/* -> internal API gateway
```

---

**Phase 5: Authentication And Cookies**

Because the product lives on `app.domain-name.com`, authentication should be scoped there.

Recommended MVP cookie strategy:

```txt
access_token cookie domain: app.domain-name.com
refresh token cookie domain: app.domain-name.com
```

Do not share auth cookies with:

```txt
domain-name.com
docs.domain-name.com
```

This keeps marketing and docs public and reduces security risk.

Marketing and docs should link into the app:

```txt
https://app.domain-name.com/auth/login
https://app.domain-name.com/onboarding
```

If a logged-out user visits:

```txt
https://app.domain-name.com/
```

middleware redirects to:

```txt
https://app.domain-name.com/auth/login
```

---

**Phase 6: Cross-Domain Navigation**

All three apps should share basic brand navigation.

Marketing header:

```txt
Logo
Product
Pricing
Security
Docs
Login
Get Started
```

Docs header:

```txt
Logo
Docs Search
Guides
API Reference
Login
Open App
```

App header/sidebar:

```txt
Product navigation
Docs link
Profile menu
Organization switcher
```

Important links:

```txt
Marketing -> Docs: https://docs.domain-name.com
Marketing -> App: https://app.domain-name.com/auth/login
Docs -> App: https://app.domain-name.com/auth/login
App -> Docs: https://docs.domain-name.com
```

---

**Phase 7: Deployment Setup**

Recommended deployment model: **one deployment project per app**.

If using Vercel:

```txt
Project 1:
  Name: sots-marketing
  Root Directory: apps/marketing
  Domain: domain-name.com

Project 2:
  Name: sots-dashboard
  Root Directory: apps/dashboard
  Domain: app.domain-name.com

Project 3:
  Name: sots-docs
  Root Directory: apps/docs
  Domain: docs.domain-name.com
```

Build command for each:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Or filtered:

```bash
pnpm --filter @sots/marketing build
pnpm --filter dashboard build
pnpm --filter @sots/docs build
```

Output:

```txt
Next.js default deployment output
```

DNS records:

```txt
domain-name.com        -> marketing deployment
www.domain-name.com    -> redirect to domain-name.com
app.domain-name.com    -> dashboard deployment
docs.domain-name.com   -> docs deployment
```

If using Vercel, these are usually `CNAME` records for subdomains and an `A`/`ALIAS`/`CNAME` setup for apex depending on registrar.

---

**Phase 8: Environment Configuration**

Marketing:

```env
NEXT_PUBLIC_SITE_URL=https://domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
```

Docs:

```env
NEXT_PUBLIC_SITE_URL=https://docs.domain-name.com
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
```

Dashboard:

```env
NEXT_PUBLIC_APP_URL=https://app.domain-name.com
NEXT_PUBLIC_DOCS_URL=https://docs.domain-name.com
NEXT_PUBLIC_MARKETING_URL=https://domain-name.com
NEXT_PUBLIC_API_GATEWAY_URL=https://api.domain-name.com
```

Backend/API services:

```env
APP_ORIGIN=https://app.domain-name.com
MARKETING_ORIGIN=https://domain-name.com
DOCS_ORIGIN=https://docs.domain-name.com
CORS_ALLOWED_ORIGINS=https://app.domain-name.com
```

If SDK ingestion uses `api.domain-name.com`:

```env
PUBLIC_API_URL=https://api.domain-name.com
```

---

**Phase 9: Analytics And SEO**

Marketing analytics should track:

- landing page visits
- CTA clicks
- docs clicks
- login/get-started clicks
- signup funnel entry

Docs analytics should track:

- most viewed docs
- search terms
- SDK page visits
- copy-code interactions
- dead-end pages

App analytics should track product usage separately:

- onboarding started
- API key created
- SDK connected
- first reconciliation run
- report exported

Use cross-domain analytics carefully so the journey is visible:

```txt
domain-name.com -> app.domain-name.com -> onboarding complete
```

---

**Phase 10: CI/CD**

CI should validate all three apps:

```bash
pnpm build
pnpm test
```

Optional filtered CI jobs:

```bash
pnpm --filter @sots/marketing build
pnpm --filter @sots/docs build
pnpm --filter dashboard build
```

Add lightweight checks:

- marketing page renders
- docs page renders
- dashboard auth redirect works
- sitemap generated
- docs links are valid
- no broken internal links
- no accidental dashboard routes exposed on marketing/docs

---

**Phase 11: Design And Content Workflow**

Before implementation, create approved visual concepts for:

Marketing:

- homepage hero
- product explanation section
- audience/use-case section
- feature section
- pricing/CTA section

Docs:

- docs homepage
- article page
- API reference page
- SDK guide page

Then implement from those concepts using shared visual tokens where useful.

The marketing and docs sites should feel related to the app, but not identical. Suggested direction:

```txt
Marketing: polished, trust-building, conversion-focused
Docs: readable, fast, structured, searchable
App: dense, operational, dashboard-focused
```

---

**Implementation Order**

1. Create `apps/marketing` and `apps/docs`.
2. Add package scripts and workspace lockfile updates.
3. Build public marketing homepage.
4. Build docs shell and first complete docs set.
5. Add domain-aware environment variables.
6. Update dashboard links to docs and marketing.
7. Configure auth middleware for `app.domain-name.com`.
8. Configure deployment projects.
9. Add DNS records.
10. Add analytics, sitemap, robots, metadata.
11. Run build/test.
12. Deploy staging domains.
13. Validate:
    - `domain-name.com`
    - `app.domain-name.com`
    - `docs.domain-name.com`
14. Promote to production.

---

**MVP Acceptance Criteria**

Marketing is ready when:

- `domain-name.com` explains SOTS clearly
- metadata, sitemap, robots, canonical URLs exist
- CTA links to app and docs work
- mobile and desktop layouts are polished
- Lighthouse SEO/accessibility scores are healthy

Docs are ready when:

- `docs.domain-name.com` has role-based guides
- SDK installation docs are copy-paste accurate
- QA/developer/project manager flows are documented
- API/reference pages cover current gateway/report/reconciliation behavior
- docs search or clear navigation exists

App is ready when:

- `app.domain-name.com` remains protected
- logged-out users redirect to `/auth/login`
- onboarding still works
- dashboard API proxy still works
- docs and marketing links are present
- auth cookies are scoped to the app domain

This gives you a clean SaaS-grade MVP boundary: public acquisition on the main domain, secure product usage on the app subdomain, and durable user education on the docs subdomain.