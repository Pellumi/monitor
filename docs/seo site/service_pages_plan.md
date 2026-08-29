Yes. At this point I would add a dedicated **service/utility layer** to the Tellann marketing architecture.

These pages are different from Product, Company, Pricing, etc. They exist because something has gone wrong, a resource is unavailable, or a machine/user needs infrastructure information.

One distinction matters immediately:

> **Not every HTTP error deserves its own public route.**

A 404, 500, 503, status page, and machine-readable health endpoints are useful. Creating decorative `/400`, `/401`, `/402`, `/405`, `/406`, `/409`, `/422`, etc. marketing pages would be architecture theatre.

Tellann's requirements already establish 99.9% availability, graceful degradation, service health monitoring, alerting, and availability during non-critical maintenance.  The API architecture also explicitly defines `/system/status` and `/health`. 

# 1. Recommended service-page architecture

I would implement this structure:

```text
tellann.co
│
├── [404 handler]
│   └── Resource not found
│
├── [500 handler]
│   └── Unexpected application error
│
├── /maintenance
│   └── Planned service maintenance
│
├── /offline
│   └── Optional — only if PWA/offline support exists
│
├── /status
│   └── Redirect → status.tellann.co
│
├── /.well-known/security.txt
│   └── Security disclosure metadata
│
├── /robots.txt
├── /sitemap.xml
├── /site.webmanifest
│
└── service states
    ├── 403 Forbidden
    ├── 429 Rate Limited
    └── 503 Service Unavailable
```

Then separately:

```text
status.tellann.co
```

becomes the actual public operational status service.

And:

```text
api.tellann.co/health
api.tellann.co/v1/system/status
```

remain **machine-facing API endpoints**, not website pages. The API specification explicitly defines both health/status surfaces. 

---

# 2. Which ones actually need dedicated pages?

I would classify them like this:

| Service surface    |              Implement? | Public route?                      |
| ------------------ | ----------------------: | ---------------------------------- |
| 404 Not Found      |                 **Yes** | Framework handler                  |
| 500 Internal Error |                 **Yes** | Framework error boundary           |
| 503 Maintenance    |                 **Yes** | `/maintenance` + HTTP 503 behavior |
| Unplanned outage   |                 **Yes** | 503 variant                        |
| Public status      |                 **Yes** | `status.tellann.co`                |
| `/status`          |                 **Yes** | Redirect to status site            |
| 403 Forbidden      | **Yes, reusable state** | Usually app-side                   |
| 401 Unauthorized   |        Usually redirect | No marketing page                  |
| 429 Rate Limit     | **Yes, reusable state** | Not necessarily indexed route      |
| Offline page       |             Conditional | `/offline` only if useful          |
| 400 Bad Request    |            No full page | Error component                    |
| 422 Validation     |            No full page | Inline form errors                 |
| 410 Gone           |             Conditional | Server response + simple template  |
| `/health`          |                 **Yes** | API endpoint, not HTML page        |
| `/system/status`   |                 **Yes** | API endpoint                       |
| `robots.txt`       |                 **Yes** | Machine endpoint                   |
| `sitemap.xml`      |                 **Yes** | Machine endpoint                   |
| `security.txt`     |             Recommended | Machine/security endpoint          |

So there are really **five core human-facing service experiences**:

```text
404
500
503 / Maintenance
Status
429 / access failure states
```

---

# 3. 404 Not Found

This should be the most designed of the service pages because it is the one normal visitors will encounter most often.

But it still needs to be fast.

## Concept

Tellann has a perfect native metaphor:

> **This path wasn't observed.**

That ties directly into workflows, states, transitions, and missing paths without becoming childish.

Tellann's core behavioral model represents software as states and transitions, making a broken path metaphor legitimate rather than decorative. 

---

# 4. Recommended 404 copy

### Technical label

```text
404 / ROUTE_NOT_FOUND
```

Use JetBrains Mono / technical typography if consistent with the final brand system.

### H1

> **This path doesn't exist.**

Alternative:

> **We couldn't find this state.**

I prefer:

> **This path doesn't exist.**

because everyone immediately understands what happened.

### Supporting copy

> The page may have moved, the address may be incorrect, or the route no longer exists.

Do not overdo the product metaphor to the point that users don't understand that it is a 404.

---

# 5. 404 actions

Primary:

```text
[ Back to home ]
```

→ `/`

Secondary:

```text
[ Explore Tellann ]
```

→ `/product`

Tertiary text link:

```text
Looking for documentation? → docs.tellann.co
```

Optional:

```text
Go back
```

using browser history.

---

# 6. 404 visual

Use a lightweight Behavior Graph illustration.

Desktop:

```text
                 HOME
                   │
                   ▼
                PRODUCT
                   │
                   ▼
            ┌───────────────┐
            │ UNKNOWN_ROUTE │
            │      404      │
            └───────┬───────┘
                    ╳
              PATH NOT FOUND
```

Or:

```text
KNOWN_STATE ─────────→ KNOWN_STATE
       \
        \........→ ?
                  404
```

### Dimensions

Desktop:

```text
~680–760px wide
~260–320px high
```

Mobile:

```text
~300–340px wide
~180–220px high
```

No video.

No 3D asset.

No giant WebGL dependency.

---

# 7. 404 animation

Subtle only.

Sequence:

```text
Known nodes appear
        ↓
transition line travels
        ↓
line reaches missing node
        ↓
line stops / fades
        ↓
404 label appears
```

Duration:

```text
~1.5–2.5 seconds
```

Then remain mostly static.

Respect:

```text
prefers-reduced-motion
```

Reduced motion version simply displays the final graph.

---

# 8. 404 page layout

Desktop:

```text
NAV
────────────────────────────────

         404 / ROUTE_NOT_FOUND

        This path doesn't exist.

The page may have moved, been removed,
or the address may be incorrect.

     [ Back to home ] [ Product ]

             graph visual

────────────────────────────────

Helpful paths

Product      Documentation
Pricing      Company

────────────────────────────────

MINIMAL FOOTER
```

I would not use the enormous complete marketing footer here.

Use a **service footer**:

```text
© Tellann
Status
Privacy
Contact
```

---

# 9. Helpful paths on 404

Four cards/links maximum:

```text
Product
Understand what Tellann does.

/product


Documentation
Integrate Tellann.

docs.tellann.co


Pricing
Compare plans.

/pricing


Company
Learn why Tellann exists.

/company
```

Don't show 15 links.

---

# 10. 404 search

I would **not initially add a search box**.

Unless Tellann later has strong site-wide search, a fake search field that only looks useful adds complexity.

If search exists later:

```text
Search Tellann...
```

could query Product, Docs, Blog, Guides, etc.

---

# 11. 404 SEO behavior

Critical:

The rendered page must return:

```text
HTTP 404
```

not:

```text
HTTP 200
```

A pretty page that returns `200 OK` creates a soft-404 SEO problem.

Metadata:

```text
<title>Page Not Found | Tellann</title>
<meta name="robots" content="noindex">
```

Do not canonicalize arbitrary missing URLs to `/`.

---

# 12. Next.js implementation

If you're using App Router:

```text
app/
├── not-found.tsx
```

Use:

```ts
notFound()
```

when a requested entity/page genuinely does not exist.

Do **not** create:

```text
app/404/page.tsx
```

as the primary mechanism.

The user can type `/404`, but that is different from a real HTTP 404.

---

# 13. 500 — Unexpected server/application error

This page serves a completely different purpose.

404 means:

> We found the website, not the resource.

500 means:

> Something broke on our side.

The copy needs to admit that clearly.

---

# 14. 500 content

Technical label:

```text
500 / INTERNAL_ERROR
```

H1:

> **Something didn't complete correctly.**

Supporting:

> Tellann encountered an unexpected error while processing this request.

Don't say:

> Something went wrong :(

Keep the brand technical and composed.

---

# 15. 500 actions

Primary:

```text
[ Try again ]
```

Secondary:

```text
[ Back to home ]
```

Additional:

```text
Check system status →
```

→ `status.tellann.co`

If you have a safe request ID:

```text
Reference: req_73K8F2
```

This can be useful when contacting support.

---

# 16. 500 visual

Instead of "broken robot":

```text
EVENT
  │
  ▼
PROCESS
  │
  ╳
  │
ANALYSIS
```

or:

```text
REQUEST
  │
  ▼
PROCESSING
  │
 [!]
  │
RETRY
```

The point is not humor.

It should communicate interrupted processing.

---

# 17. 500 architecture

Next.js:

```text
app/
├── error.tsx
└── global-error.tsx
```

`error.tsx` catches segment errors.

`global-error.tsx` is the final fallback when the root layout itself fails.

These should not depend on your normal page component tree to render successfully.

---

# 18. Critical 500 rule

Your error page must be **more reliable than the page that failed**.

Therefore avoid dependencies on:

```text
CMS
marketing API
pricing API
feature-flag service
analytics bootstrap
personalization
complex animations
remote content
```

Use embedded static copy and core local assets.

---

# 19. Service failure reference ID

A failure can generate:

```text
Error reference
ERR-W4Z2K8
```

Internally map it to:

```text
requestId
traceId
timestamp
service
```

Tellann's API architecture already establishes request and trace identifiers as part of request traceability. 

Do not expose:

```text
stack traces
database names
container names
internal hostnames
exception details
```

to public visitors.

---

# 20. 503 — Service unavailable

This is one of the most important pages operationally.

There are **two different 503 states**:

```text
Planned Maintenance

and

Unplanned Service Disruption
```

They should share the same infrastructure but different copy.

---

# 21. Planned maintenance page

Route:

```text
/maintenance
```

but when used as outage fallback, server response should still be:

```text
HTTP 503 Service Unavailable
```

Prefer:

```text
Retry-After: ...
```

where a reliable estimate exists.

---

# 22. Planned maintenance content

Label:

```text
MAINTENANCE
```

H1:

> **Tellann is undergoing scheduled maintenance.**

Supporting:

> Some services are temporarily unavailable while we perform planned platform maintenance.

Show only verified data:

```text
Affected services
Dashboard
API

Started
[time]

Expected restoration
[time if genuinely known]
```

CTA:

```text
[ View system status ]
```

Secondary:

```text
[ Retry ]
```

---

# 23. Don't fabricate maintenance completion time

Never show:

```text
We'll be back in 15 minutes.
```

because somebody wrote it in the UI.

Instead:

```text
Estimated completion
03:30 UTC
```

only when sourced from the incident/maintenance record.

Otherwise:

```text
We're working to restore normal service.
```

---

# 24. Unplanned outage variant

Label:

```text
SERVICE DISRUPTION
```

H1:

> **Tellann is temporarily unavailable.**

Copy:

> We're experiencing a service disruption. Operational updates are available on the Tellann status page.

Actions:

```text
[ View status ]
[ Retry ]
```

No marketing CTAs.

When the product is down, this is not the time for:

```text
Start Free
Book Demo
Read Our Blog
```

---

# 25. Critical 503 infrastructure rule

The maintenance/error page should ideally be served from a layer **outside the failing primary application**.

For example:

```text
CDN / Edge
    │
    ├── healthy → Tellann marketing/application
    │
    └── failure → static service page
```

Otherwise:

```text
application fails
    ↓
maintenance page also fails
```

which defeats the entire purpose.

The Tellann deployment architecture expects load balancing, independent services, observability, disaster recovery, and fault isolation. 

---

# 26. Public status page

I would make this a separate property:

```text
status.tellann.co
```

not:

```text
tellann.co/status
```

The main `/status` route can simply redirect.

Why?

Because if `tellann.co` itself fails, a status page hosted inside the same deployment can disappear at exactly the moment it is needed.

---

# 27. Status page hero

```text
Tellann Status

● All Systems Operational
```

or:

```text
◐ Partial Service Disruption
```

or:

```text
● Major Service Outage
```

Then:

```text
Last checked
30 seconds ago
```

only if actually updated.

---

# 28. Status component list

Tellann's architecture is service-oriented, so expose operationally meaningful customer components rather than every Kubernetes service. 

I would show:

```text
Tellann Website

Tellann Dashboard

Authentication

Public API

Telemetry Ingestion

Session Processing

Session Replay

Behavior Graph Processing

Coverage Analysis

Report Generation

Object / Export Storage

Documentation
```

Later:

```text
Production Monitoring

Journey Intelligence

Database Intelligence

Error Correlation

Intelligence Services
```

as those phases become real.

---

# 29. Don't expose internal topology

Do not show customers:

```text
kafka-broker-7
clickhouse-replica-3
graph-engine-pod-42
redis-node-a
postgres-primary-02
```

Those belong in internal observability.

Public:

```text
Behavior Graph Processing
```

Internal:

```text
graph-engine / kafka consumer group / Neo4j
```

---

# 30. Component states

Each public component:

```text
Operational

Degraded Performance

Partial Outage

Major Outage

Maintenance
```

Example:

| Component           | Status      |
| ------------------- | ----------- |
| Website             | Operational |
| Dashboard           | Operational |
| API                 | Operational |
| Telemetry ingestion | Degraded    |
| Session replay      | Operational |
| Report generation   | Operational |

---

# 31. System overview

At top:

```text
Current status

All systems operational
```

Then optional rolling availability:

```text
Past 90 days
99.98%
```

Only display real measured availability.

The NFR target is at least 99.9% monthly availability. 

Do not transform a design requirement into a fake historical metric.

---

# 32. Incident history

Structure:

```text
Incident History

August 29

Telemetry ingestion delays

Resolved

12:31
Processing recovered.

12:12
Backlog is draining.

11:58
We identified elevated ingestion latency.

11:46
Investigating.
```

This creates trust.

---

# 33. Incident model

```ts
type Incident = {
  id: string;
  title: string;
  status:
    | "INVESTIGATING"
    | "IDENTIFIED"
    | "MONITORING"
    | "RESOLVED";

  impact:
    | "MINOR"
    | "MAJOR"
    | "CRITICAL";

  affectedComponents: string[];
  updates: IncidentUpdate[];
  startedAt: string;
  resolvedAt?: string;
};
```

---

# 34. Scheduled maintenance

Separate section:

```text
Scheduled maintenance

Database maintenance
September 3
01:00–02:00 UTC

Expected impact:
Dashboard analytics may be briefly unavailable.
Telemetry ingestion will remain operational.
```

The architecture explicitly requires critical ingestion to remain available through non-critical subsystem failures, while the dashboard should remain available during non-critical maintenance where possible. 

---

# 35. Status subscriptions

Eventually support:

```text
Subscribe to updates

[ Email ]
[ RSS ]
[ Webhook ]
```

Potentially:

```text
Slack
```

later.

This is useful for Business/Enterprise users.

---

# 36. Status API

Machine-facing:

```text
GET /health
```

Response:

```json
{
  "status": "UP"
}
```

and:

```text
GET /system/status
```

are already specified in Tellann's API architecture. 

You could additionally have the public status platform expose a standard public JSON feed later, but that is outside the current API specification.

---

# 37. 403 Forbidden

This is more important inside:

```text
app.tellann.co
```

than the marketing website.

Examples:

```text
User lacks permission

Feature belongs to another organization

Admin-only setting

Enterprise capability
```

H1:

> **You don't have access to this resource.**

Copy:

> Your account is signed in, but your current permissions do not allow access to this page.

Actions:

```text
[ Back to dashboard ]
[ Request access ]
```

Where appropriate:

```text
Contact your organization administrator.
```

Tellann uses RBAC and fine-grained authorization, so this state will be necessary in the application. 

---

# 38. Do not confuse 403 and plan restrictions

These are different:

```text
403
You are not authorized.

Plan restriction
Your organization has not purchased this capability.
```

For plan gating, use:

```text
Upgrade required
```

not:

```text
Forbidden
```

That distinction matters.

---

# 39. 401 Unauthorized

Do not build an elaborate page.

Expected app behavior:

```text
Protected resource
       ↓
No valid session
       ↓
Redirect to sign in
       ↓
Preserve return URL
```

Example:

```text
/login?returnTo=/applications/app_123
```

If authentication expires while the user is already working:

```text
Your session expired.

[ Sign in again ]
```

modal/state is better than a giant 401 marketing page.

---

# 40. 429 Too Many Requests

This becomes necessary for:

* login abuse;
* contact forms;
* public APIs;
* SDK/API rate limits;
* repeated expensive actions.

Tellann's gateway architecture includes rate limiting. 

H1:

> **Too many requests.**

Supporting:

> This request has been temporarily limited. Wait a moment and try again.

Where server provides a retry time:

```text
Try again in 42 seconds.
```

Button:

```text
[ Try again ]
```

For API requests, primarily return JSON rather than an HTML page.

---

# 41. 429 API response

For APIs:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests."
  },
  "requestId": "..."
}
```

Don't return the website error page to SDK/API consumers.

The API already uses a structured standard error model with code, message, and request ID. 

---

# 42. Offline page

This is **conditional**.

Implement:

```text
/offline
```

only if Tellann marketing/docs/application uses service workers/PWA caching meaningfully.

H1:

> **You're offline.**

Copy:

> Tellann can't reach the network right now.

Actions:

```text
[ Try again ]
```

Optionally show cached documentation/resources.

Don't build an offline route merely because websites can have one.

---

# 43. Offline product behavior

This is especially interesting for SDKs because Tellann's SDK specification already anticipates local buffering and retry behavior when connectivity is unavailable. 

But that is an **SDK behavior**, not a reason to claim the Tellann dashboard works offline.

Keep them separate.

---

# 44. 410 Gone

Not required initially, but useful later.

Use when content has intentionally and permanently been removed.

Examples:

```text
old campaign pages
retired developer guide
deprecated resource
```

Message:

> **This page has been retired.**

Then point toward replacement content if one exists.

HTTP:

```text
410 Gone
```

rather than 404 when the distinction helps search engines and users.

---

# 45. 400 Bad Request

No dedicated marketing page needed.

For malformed website request:

```text
We couldn't process this request.
```

with a compact error state.

For API:

structured JSON.

---

# 46. 422 validation

Never full-screen this.

For contact/pricing/signup forms:

```text
Email
[ invalid-address ]

Enter a valid email address.
```

Validation errors belong beside the field.

---

# 47. Unsupported browser

I would **not** create:

```text
/unsupported-browser
```

unless Tellann actually cannot function on certain browsers.

The NFR requires support for modern browsers. 

If a browser is outdated:

```text
Your browser may not support all Tellann features.
```

small notice is sufficient.

---

# 48. Machine-facing service endpoints

These aren't pages, but they belong in the complete service architecture.

## `/robots.txt`

Required.

Example conceptually:

```text
User-agent: *
Allow: /

Disallow: /api/
Disallow: /internal/

Sitemap: https://tellann.co/sitemap.xml
```

Exact exclusions depend on implementation.

---

# 49. `/sitemap.xml`

Required for SEO.

Include only canonical public indexable pages:

```text
/
/product
/product/*
/solutions/*
/pricing
/company
/careers
/contact
/brand
/roadmap
/blog/*
/guides/*
...
```

Exclude:

```text
404
500
maintenance
status query states
auth pages where appropriate
preview pages
internal APIs
```

---

# 50. `/.well-known/security.txt`

Strong recommendation for Tellann.

Example fields eventually:

```text
Contact:
Expires:
Policy:
Acknowledgments:
Preferred-Languages:
Canonical:
```

It should direct legitimate security researchers toward Tellann's approved security disclosure channel.

This aligns particularly well with a product whose security architecture emphasizes auditability, privacy, encryption, tenant isolation, and incident response. 

---

# 51. `/site.webmanifest`

If you support installability or product-like browser presentation:

```json
{
  "name": "Tellann",
  "short_name": "Tellann",
  "start_url": "/",
  "display": "standalone"
}
```

plus official icons/theme metadata.

If you aren't building PWA behavior, keep it minimal.

---

# 52. Service footer component

I would create a separate:

```text
<ServiceFooter />
```

rather than loading the full marketing footer on error pages.

Data:

```text
Tellann

Status
Security
Privacy
Contact

© 2026 Tellann
```

This component appears on:

```text
404
500
maintenance
offline
403
429
```

---

# 53. Service navigation

Similarly:

```text
<ServiceHeader />
```

instead of full mega menus.

Desktop:

```text
Tellann                                      Status
```

Click Tellann → `/`

Status → `status.tellann.co`

Why?

Because service pages should remain dependable even if navigation APIs/complex menu code fail.

---

# 54. Shared service-page shell

I would create:

```text
ServicePageShell
│
├── ServiceHeader
├── ServiceContent
│   ├── ErrorCode
│   ├── Heading
│   ├── Description
│   ├── Actions
│   └── Illustration
└── ServiceFooter
```

Then reuse it.

---

# 55. Error state model

```ts
type ServicePageType =
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "MAINTENANCE"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "OFFLINE";
```

Configuration:

```ts
interface ServicePageConfig {
  code?: number;
  label: string;
  title: string;
  description: string;

  primaryAction?: Action;
  secondaryAction?: Action;

  showStatusLink?: boolean;
  showReferenceId?: boolean;
}
```

---

# 56. Visual design across all service pages

Tellann service pages should share one visual language:

```text
Monochrome
Large whitespace
Small technical error labels
Simple graph/event illustration
No decorative photography
No videos
Minimal dependencies
```

Each can have a graph metaphor:

```text
404
Missing path

500
Processing interrupted

503
System unavailable

403
Transition blocked

429
Request throttled

Offline
Connection lost
```

This turns failures into a coherent Tellann design system.

---

# 57. Example visual language

### 404

```text
A ───→ B ───→ ?
              404
```

### 500

```text
REQUEST ───→ PROCESS ──╳──→ RESPONSE
```

### 503

```text
CLIENT ───→ TELLANN
             │
             ◐
          MAINTENANCE
```

### 403

```text
USER ───╳──→ RESOURCE
```

### 429

```text
REQUEST REQUEST REQUEST REQUEST
             │
             ▼
          RATE LIMIT
```

### Offline

```text
CLIENT ─ - - - ╳ - - - ─ CLOUD
```

---

# 58. Performance requirements

Service pages should be the lightest pages on the site.

Targets:

```text
HTML/CSS first
Minimal JS
Local logo asset
No video
No CMS dependency
No large fonts required to render fallback
No analytics requirement before paint
```

404 can use more of the normal layout because the site is operational.

500/503 should be aggressively dependency-light.

---

# 59. Analytics behavior

### 404

Track:

```text
SERVICE_404_VIEWED
```

Metadata:

```text
requested_path
referrer_path
```

Be careful not to capture sensitive query parameters.

This lets you discover broken internal links.

---

# 60. 500 analytics

Track server-side rather than relying primarily on browser analytics:

```text
error_id
request_id
route
timestamp
release_version
```

The page analytics script may itself fail.

Operational logging is authoritative.

---

# 61. 503 analytics

Don't rely on primary analytics infrastructure.

Status/outage monitoring should come from independent health checks.

Tellann's NFR requires critical failures to generate alerts and platform services to expose operational telemetry. 

---

# 62. Accessibility

All service pages:

```text
H1 explaining problem

Readable error code

Keyboard accessible actions

No color-only status communication

Reduced-motion support

Visible focus state

Screen-reader status text
```

For maintenance:

```html
role="status"
```

where appropriate.

---

# 63. Mobile layout

Standard:

```text
Tellann

404 / ROUTE_NOT_FOUND

This path doesn't exist.

Description

[ Back to home ]

[ Product ]

    visual

Helpful links

Status · Contact

© Tellann
```

Everything vertical.

No full mega menus.

---

# 64. Status mobile layout

```text
Tellann Status

● All systems operational

Updated...

────────────────

Website
Operational

Dashboard
Operational

API
Operational

Ingestion
Degraded

Replay
Operational

────────────────

Active incident

...

────────────────

Incident history

────────────────

Subscribe
```

---

# 65. Status architecture should be independent

Ideally:

```text
Primary Tellann Infrastructure

AWS / cloud / provider A
        │
        X


Status infrastructure

Separate provider / isolated service
        │
        ✓
status.tellann.co
```

It doesn't have to be a completely different cloud on day one, but avoid coupling it tightly to the primary app.

The deployment design includes disaster recovery, failover, backup architecture, and RPO/RTO objectives, so a credible status surface fits naturally into the operating model. 

---

# 66. Disaster recovery status

The deployment architecture currently specifies:

```text
RPO ≤ 15 minutes
RTO ≤ 1 hour
```

as disaster recovery objectives. 

Do **not** automatically advertise these as an SLA on the status page.

Architectural target:

```text
≠
contractual customer guarantee
```

Important distinction.

---

# 67. Sitemap of service surfaces

The complete service layer I recommend is:

```text
SERVICE / UTILITY SURFACES

Human-facing
│
├── 404 Not Found
├── 500 Internal Error
├── 503 Service Unavailable
├── /maintenance
├── 403 Forbidden
├── 429 Rate Limited
├── /offline                  [conditional]
└── /status
      ↓
      status.tellann.co


Status property
│
├── /
├── /history
├── /incidents/[id]
└── /subscribe                [later]


Machine-facing
│
├── /robots.txt
├── /sitemap.xml
├── /site.webmanifest
├── /.well-known/security.txt
│
└── api.tellann.co
    ├── /health
    └── /v1/system/status
```

---

# 68. What I would NOT create

I would not create public pages for every numeric HTTP code:

```text
/400
/401
/402
/405
/406
/408
/409
/411
/412
/415
/418
/422
/502
/504
```

Most should map into reusable families:

```text
USER / REQUEST ERROR
→ inline/service-state component

SERVER FAILURE
→ 500

TEMPORARY AVAILABILITY
→ 503

MISSING RESOURCE
→ 404
```

The goal is a robust system, not an HTTP museum.

---

# 69. Recommended Next.js file structure

For the marketing site:

```text
app/
│
├── layout.tsx
├── page.tsx
│
├── not-found.tsx
├── error.tsx
├── global-error.tsx
│
├── maintenance/
│   └── page.tsx
│
├── offline/
│   └── page.tsx
│
├── status/
│   └── route.ts
│
├── robots.ts
├── sitemap.ts
└── manifest.ts
```

Shared:

```text
components/
└── service/
    ├── service-page-shell.tsx
    ├── service-header.tsx
    ├── service-footer.tsx
    ├── service-illustration.tsx
    ├── error-reference.tsx
    └── retry-action.tsx
```

---

# 70. App-specific service states

For:

```text
app.tellann.co
```

you need additional product-level states:

```text
Application not found

Session not found

Report not found

Behavior Graph unavailable

Report still processing

Replay processing

Application archived

Permission denied

Plan upgrade required

Data retention expired

No data yet
```

These are **not website 404 pages**.

For example:

```text
SESSION_NOT_FOUND

The session may have expired,
been removed, or belong to another
application.

[ Back to sessions ]
```

The API architecture already standardizes errors around codes such as `RESOURCE_NOT_FOUND` and request IDs. 

---

# 71. Processing states are especially important for Tellann

Tellann generates artifacts asynchronously.

The NFR allows:

```text
Session replay available
within 30 seconds

Behavior Graph
within 5 minutes

Coverage reports
within 5 minutes
```

under the specified operating conditions. 

So don't show:

```text
404
```

when an analysis simply isn't ready yet.

Use:

```text
ANALYSIS_PROCESSING

Tellann is building this Behavior Graph.

Events processed       4,182
Sessions analyzed         12
Current stage          Workflow discovery
```

Then poll/refresh.

This is a service **state**, not an error page.

---

# 72. Product unavailable vs no data

Also distinguish:

```text
NO DATA
Nothing has been captured yet.

PROCESSING
Data exists; output isn't finished.

FAILED
Processing attempted and failed.

UNAVAILABLE
Service cannot currently fulfill request.

NOT FOUND
Resource does not exist.
```

Those five states should never be visually collapsed into one generic "Oops."

---

# 73. Recommended product-state component

```text
<ResourceState
  type="PROCESSING"
  title="Building your Behavior Graph"
  description="Tellann is processing this demonstration."
/>
```

Types:

```ts
type ResourceState =
  | "EMPTY"
  | "PROCESSING"
  | "FAILED"
  | "UNAVAILABLE"
  | "NOT_FOUND"
  | "FORBIDDEN";
```

This will become useful throughout the authenticated dashboard.

---

# 74. Launch priority

### P0 — must exist before public launch

```text
✓ 404
✓ error.tsx
✓ global-error.tsx
✓ 503 fallback
✓ /maintenance
✓ /status redirect
✓ status.tellann.co
✓ /health
✓ robots.txt
✓ sitemap.xml
✓ security.txt
```

### P1 — soon after

```text
✓ 403 product state
✓ 429 product/API state
✓ incident history
✓ maintenance history
✓ status subscriptions
✓ resource processing/failure states
```

### P2 — only when warranted

```text
Offline page
410 template
Status RSS
Status webhook subscriptions
Public status API
Advanced historical uptime graphs
```

---

# 75. The core service architecture

The final conceptual system becomes:

```text
USER REQUEST
     │
     ▼
Can resource be resolved?
     │
 ┌───┴────┐
 │        │
YES       NO
 │         │
 ▼         ▼
PAGE      404


PAGE EXECUTION
     │
 ┌───┴─────────────┐
 │                 │
SUCCESS          FAILURE
 │                 │
 ▼                 ▼
PAGE              500


PLATFORM HEALTH
     │
 ┌───┴───────────────┐
 │                   │
AVAILABLE         TEMPORARILY DOWN
 │                   │
 ▼                   ▼
NORMAL               503
                      │
                      ▼
              status.tellann.co


AUTHORIZED?
     │
 ┌───┴────┐
 │        │
YES       NO
 │         │
 ▼         ▼
PAGE      401/403


RATE ACCEPTABLE?
     │
 ┌───┴────┐
 │        │
YES       NO
 │         │
 ▼         ▼
PROCESS   429
```

The key principle is that Tellann's service pages should embody the same philosophy as the product itself: **a failure should not merely say that something went wrong; it should identify what state the system is in, explain what the user can do next, and preserve enough traceability for investigation.**

That is especially appropriate for Tellann because reliability, health monitoring, structured errors, traceability, graceful degradation, and service observability are already explicit architectural requirements—not ornamental additions.  
