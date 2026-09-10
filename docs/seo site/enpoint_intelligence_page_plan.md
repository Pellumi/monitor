# `/product/endpoint-intelligence` — Complete Page Specification

`/product/endpoint-intelligence` should be the page where Tellann reveals the **backend behavior underneath an observed workflow**.

The core positioning should be:

> **See the endpoints behind the behavior.**

A traditional API dashboard often starts with an endpoint and asks whether it is fast or failing. Tellann should approach the problem from the opposite direction:

```text
Workflow
   ↓
State transition
   ↓
API activity
   ↓
Response / latency / error
   ↓
Resulting application behavior
```

That distinction matters. Tellann's Phase 1 backend SDK captures API request and response information, response time, errors, endpoint metadata, and session correlation specifically so server-side execution can be associated with user workflows. 

The functional requirements then require average response-time calculation, slow-endpoint identification, frequently accessed endpoint identification, elevated-error-rate detection, endpoint health reporting, and optimization recommendations. 

---

# 1. Position in the Product architecture

The Tellann Product story now becomes:

```text
/product
What is Tellann?

        ↓

/product/how-it-works
How does the complete system operate?

        ↓

/product/demonstration-mode
How is behavior captured?

        ↓

/product/behavior-graphs
How is application behavior structured?

        ↓

/product/workflow-discovery
Which structures represent workflows?

        ↓

/product/session-replay
What evidence created those workflows?

        ↓

/product/coverage
Which behavior was exercised?

        ↓

/product/missing-flows
Which paths were never observed?

        ↓

/product/missing-states
Which application conditions were never observed?

        ↓

/product/endpoint-intelligence
What happened in the backend
while those workflows executed?
```

The distinction from generic API monitoring should be:

```text
GENERIC API MONITORING

Endpoint
↓
Latency
Errors
Traffic


TELLANN ENDPOINT INTELLIGENCE

Workflow
↓
State
↓
Endpoint
↓
Response
↓
Resulting State
↓
Behavioral Evidence
```

---

# 2. Primary purpose of the page

The visitor should understand:

```text
Which APIs participated in a workflow?

How does Tellann capture backend behavior?

Can frontend and backend activity be correlated?

Which endpoints are slow?

Which endpoints fail most often?

Which endpoints are used most frequently?

What does Endpoint Health mean?

Can I inspect an endpoint inside a workflow?

Can I trace an endpoint call back to a session?

Can I trace an API failure to an application state?

How does endpoint activity affect coverage?

Can Tellann identify endpoints that were never exercised?

What recommendations exist in Phase 1?

Is this production monitoring?

Does Tellann provide distributed tracing?

Does Tellann inspect my database?
```

---

# 3. Core message

The page should repeatedly reinforce:

> **An endpoint is more useful when you know what the application was trying to do when it ran.**

For example:

```text
POST /payment
891ms
503
```

is useful.

But:

```text
Checkout Workflow

PAYMENT_PENDING
       ↓
POST /payment
891ms
503
       ↓
PAYMENT_FAILURE
```

is significantly more useful.

That should be the visual and conceptual identity of this route.

---

# 4. Recommended page architecture

```text
/product/endpoint-intelligence
│
├── 01 Global Navigation
├── 02 Hero
├── 03 Why Endpoint Context Matters
├── 04 How Backend Capture Works
├── 05 Workflow → Endpoint Correlation
├── 06 Endpoint Inventory
├── 07 Response Time Analysis
├── 08 Slow Endpoint Detection
├── 09 Request Volume / Frequency
├── 10 Error Rate Analysis
├── 11 Endpoint Health
├── 12 Interactive Endpoint Explorer
├── 13 Endpoint + Behavior Graph
├── 14 Endpoint + Workflow Context
├── 15 Endpoint + Session Replay
├── 16 Endpoint + Coverage
├── 17 Endpoint + Missing States / Flows
├── 18 Endpoint Rankings
├── 19 Recommendations
├── 20 Endpoint Intelligence Report
├── 21 Privacy & Captured Metadata
├── 22 What Endpoint Intelligence Is Not
├── 23 Phase 1 Implementation Boundaries
├── 24 Future Endpoint Intelligence
├── 25 FAQ
├── 26 Final CTA
└── 27 Footer
```

---

# 5. Hero

### Eyebrow

```text
ENDPOINT INTELLIGENCE
```

### H1

> **See the backend behavior behind every workflow.**

Alternative:

> **Connect API performance to application behavior.**

I would use the first as the H1 and the second as supporting language.

### Supporting copy

> Tellann captures endpoint activity during observed application sessions and connects requests, responses, latency, and errors back to the workflows and states they supported.

This stays directly within the Phase 1 backend SDK scope. 

### CTAs

```text
[ Explore endpoint intelligence ]
[ See how correlation works → ]
```

Contextual tertiary:

```text
Explore Session Replay →
```

---

# 6. Hero visual concept

Do **not** lead with a conventional endpoint table.

Use a synchronized workflow/backend visualization:

```text
CHECKOUT WORKFLOW


CART_ACTIVE
     │
     │ POST /cart
     │ 143 ms
     ▼
CHECKOUT
     │
     │ POST /checkout
     │ 418 ms
     ▼
PAYMENT_PENDING
     │
     │ POST /payment
     │ 891 ms · 503
     ▼
PAYMENT_FAILURE
```

Beside or below it:

```text
ENDPOINT SUMMARY

POST /payment

Response
503

Duration
891 ms

Related workflow
Checkout

Resulting state
PAYMENT_FAILURE
```

The point is immediately:

> Tellann does not detach API activity from application behavior.

---

# 7. Hero dimensions

Use actual HTML/SVG/Canvas rather than an image.

### Master design canvas

```text
1920 × 1120
```

### Desktop render

```text
max-width: 1320px
height: 730–770px
```

### Placement

```text
Hero text
   ↓ 48px
Workflow + Endpoint visualization
```

Use a full-width stacked hero.

---

# 8. Hero animation

Duration:

```text
9–11 seconds
```

Sequence:

```text
0–2s
Checkout workflow draws.

2–4s
POST /cart attaches to transition.

4–5s
POST /checkout appears.

5–7s
POST /payment executes.

7–8s
503 response appears.

8–9s
PAYMENT_FAILURE state resolves.

9–10s
Endpoint inspector opens.
```

Then leave the visualization interactive.

No continuous packet-animation loop.

---

# 9. Mobile hero

Simplify aggressively.

```text
CHECKOUT
   ↓

POST /payment

891ms
503

   ↓

PAYMENT_FAILURE
```

Below:

```text
Endpoint
POST /payment

Status
503

Workflow
Checkout
```

### Master mobile asset

```text
1080 × 1350
```

The responsive implementation should preferably be native HTML rather than a separate raster asset.

---

# 10. Section — Why Endpoint Context Matters

### H2

> **API metrics tell you what happened. Behavioral context tells you why it mattered.**

Use a comparison.

```text
WITHOUT WORKFLOW CONTEXT

POST /payment
891 ms
503


WITH TELLANN CONTEXT

Checkout
   ↓
Payment pending
   ↓
POST /payment
891 ms · 503
   ↓
Payment failure
```

This should not claim root-cause analysis.

It is **contextual correlation**, not automatic causal proof.

---

# 11. Visual dimensions

Master:

```text
1600 × 850
```

Display:

```text
1000 × 531
```

Desktop:

```text
5 columns — isolated metric
7 columns — behavioral context
```

The contextual side should receive more space.

---

# 12. Section — How backend capture works

### H2

> **Backend behavior is captured alongside the session.**

The Phase 1 backend SDK includes API request capture, response capture, response-time capture, error capture, endpoint metadata collection, and session correlation. 

Present a simple public-facing lifecycle:

```text
APPLICATION

Frontend SDK
     │
     │ session context
     ↓

Backend SDK

Request
Response
Latency
Error
Endpoint metadata

     ↓

Tellann

     ↓

SESSION + WORKFLOW CONTEXT
```

Do not expose Kafka/PostgreSQL/ClickHouse in this section.

---

# 13. Backend capture animation

Master:

```text
1800 × 1000
```

Display:

```text
1100 × 611
```

Animation:

```text
User clicks Checkout
        ↓
Frontend event captured
        ↓
Backend request intercepted
        ↓
Response captured
        ↓
shared session context connects activity
        ↓
workflow view updates
```

Duration:

```text
7–9 seconds
```

The system architecture assigns backend interception, error tracking, request tracing, and session correlation to the backend SDK layer. 

---

# 14. Section — Workflow → Endpoint Correlation

This should be one of the largest sections.

### H2

> **See which endpoints participate in each workflow.**

Example:

```text
CHECKOUT

PRODUCT_VIEW
     │
     │ GET /products/:id
     ▼
PRODUCT_READY
     │
     │ POST /cart
     ▼
CART_ACTIVE
     │
     │ POST /checkout
     ▼
CHECKOUT
     │
     │ POST /payment
     ▼
PAYMENT_SUCCESS
```

Then add an endpoint summary:

```text
4 endpoints observed
6 requests
842ms cumulative observed request duration
1 API error
```

Keep cumulative metrics labeled illustrative unless formally implemented.

---

# 15. Correlation visual dimensions

Master:

```text
1800 × 1100
```

Display:

```text
1100 × 672
```

Desktop layout:

```text
Workflow graph
8 columns

Endpoint activity
4 columns
```

Mobile:

```text
Workflow
↓
Selected transition
↓
Endpoint
```

---

# 16. Endpoint selector interaction

User clicks:

```text
POST /payment
```

Workflow dims except:

```text
PAYMENT_PENDING
      ↓
POST /payment
      ↓
PAYMENT_SUCCESS
```

Inspector displays:

```text
POST /payment

Method
POST

Observed requests
15

Average response time
891ms

Errors
1

Associated sessions
15

Workflow
Checkout
```

All demonstration numbers should display:

```text
Sample application data
```

---

# 17. Section — Endpoint Inventory

### H2

> **Turn observed API activity into an endpoint inventory.**

Use real HTML.

Example:

| Endpoint    | Method | Requests | Avg. response | Error rate | Workflows |
| ----------- | ------ | -------: | ------------: | ---------: | --------: |
| `/products` | GET    |       42 |        184 ms |         0% |         2 |
| `/cart`     | POST   |       28 |        143 ms |         0% |         1 |
| `/checkout` | POST   |       18 |        418 ms |       1.2% |         1 |
| `/payment`  | POST   |       15 |        891 ms |       7.4% |         1 |

The product requirements explicitly include frequency, average-response, slow-endpoint, and elevated-error-rate analysis. 

---

# 18. Endpoint Inventory dimensions

Desktop:

```text
1200px wide
```

Row:

```text
56–64px
```

Controls:

```text
Search endpoints

Workflow
[ All ▾ ]

Sort
[ Response time ▾ ]
```

Mobile converts rows into cards.

---

# 19. Recommended Endpoint details route

The marketing page should simulate an endpoint details drawer.

In the actual product, support something conceptually like:

```text
/endpoints/{endpointId}
```

or drawer navigation from endpoint inventory.

Information:

```text
Method + Route
Summary
Performance
Errors
Observed sessions
Workflows
State transitions
Coverage
Recommendations
```

---

# 20. Section — Response Time Analysis

### H2

> **Measure how long backend operations took during observed behavior.**

The requirements specifically call for average endpoint response-time calculation. 

Visual:

```text
POST /payment

Average
891 ms

Observed requests
15


REQUEST DURATIONS

742ms
801ms
856ms
890ms
912ms
...
```

Do not market percentiles unless the implementation actually calculates them.

---

# 21. Response time media

Prefer a compact horizontal distribution/timeline UI rather than a generic chart-heavy dashboard.

Master:

```text
1500 × 850
```

Display:

```text
850 × 482
```

You can show:

```text
Average
Minimum
Maximum
```

only if supported by implementation.

At minimum, average response time is formally required.

---

# 22. Section — Slow Endpoint Detection

### H2

> **Find backend calls that slow down the demonstrated workflow.**

The FRS requires slow-endpoint identification, and Developer Demonstration Mode explicitly expects Slow Endpoint output.  

Use ranking:

```text
SLOWEST OBSERVED ENDPOINTS

1  POST /payment       891ms
2  POST /checkout      418ms
3  GET /search         371ms
4  GET /products       184ms
```

Again:

```text
Sample data
```

---

# 23. Slow endpoint visual dimensions

Master:

```text
1440 × 900
```

Display:

```text
800 × 500
```

Use horizontal rows rather than animated speedometers.

On hover:

```text
POST /payment

Workflow
Checkout

Observed sessions
15

View context →
```

---

# 24. Section — Request Volume

### H2

> **See which APIs your demonstrated workflows rely on most.**

Frequently accessed endpoint identification is explicitly required. 

Developer Demonstration Mode also defines "Most Used Endpoints" as a generated output. 

Example:

```text
MOST OBSERVED

GET /products      48
GET /search        31
POST /cart         28
POST /checkout     18
POST /payment      15
```

Use wording:

```text
Observed requests
```

rather than:

```text
Traffic
```

for Phase 1.

That prevents the page from sounding like continuous production monitoring.

---

# 25. Section — Error Rate Analysis

### H2

> **Find endpoints that produced errors during the workflow.**

The FRS requires endpoints with elevated error rates to be identified. 

Example:

```text
POST /payment

Requests
15

Errors
2

Observed error rate
13.3%
```

Then:

```text
Associated states

PAYMENT_FAILURE

Associated workflow

Checkout
```

This is stronger than an isolated `13.3%` card.

---

# 26. Error-rate visual

Master:

```text
1600 × 900
```

Display:

```text
900 × 506
```

Use:

```text
Endpoint statistics
+
workflow mini-map
```

Desktop ratio:

```text
5 / 7
```

---

# 27. Error event interaction

Click one error:

```text
503
```

show:

```text
API ERROR

POST /payment

Status
503

Duration
893ms

Session
SES-3817

Workflow
Checkout

Application state
PAYMENT_PENDING

Resulting state
PAYMENT_FAILURE

[ View session ]
```

Avoid calling this:

```text
Root cause
```

Phase 1 does not provide automatic root-cause analysis.

---

# 28. Section — Endpoint Health

### H2

> **Summarize endpoint behavior without losing the evidence beneath it.**

The architecture defines Endpoint Health alongside response time, error rate, and request volume as a core Endpoint Intelligence metric. 

Potential UI:

```text
POST /payment

Endpoint Health
Needs attention

Response time
891ms

Observed errors
2 / 15

Workflows
Checkout
```

---

# 29. Important health-score boundary

Do not invent:

```text
Endpoint Health
74/100
```

unless a formal scoring model exists and is implemented.

The specifications say Endpoint Health is a metric/output area, but the retrieved material does not define the exact formula for an endpoint-health score.

Phase 1 can safely use rule-driven categories such as:

```text
Healthy
Attention
Slow
Elevated Errors
```

provided their thresholds are explicitly configured.

---

# 30. Interactive Endpoint Explorer

This should be the page's strongest interaction.

### H2

> **Move from endpoint metrics to behavioral context.**

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ Endpoint Intelligence                  Workflow: Checkout   │
├────────────────────┬─────────────────────────────────────────┤
│ ENDPOINTS          │                                         │
│                    │                                         │
│ GET /products      │          WORKFLOW GRAPH                 │
│ POST /cart         │                                         │
│ POST /checkout     │                                         │
│ POST /payment      │                                         │
│                    │                                         │
├────────────────────┴─────────────────────────────────────────┤
│ POST /payment · 891ms · 2 errors · 15 observations          │
└──────────────────────────────────────────────────────────────┘
```

---

# 31. Explorer dimensions

Desktop:

```text
1280 × 800
```

Section:

```text
max-width: 1400px
```

Tablet:

```text
960 × 760
```

Mobile:

```text
Workflow selector
↓
Endpoint selector
↓
Metrics
↓
Workflow context
↓
Supporting sessions
```

---

# 32. Explorer filters

Recommended:

```text
Workflow
[ Checkout ▾ ]

Category
[ All ]
[ Slow ]
[ High error ]
[ Frequently observed ]

Method
[ All ]
[ GET ]
[ POST ]
[ PUT ]
[ PATCH ]
[ DELETE ]
```

Potential:

```text
Status
[ All ]
[ Success ]
[ Error ]
```

Avoid production-oriented controls like:

```text
Last 24 hours
Live traffic
Current RPM
```

on Phase 1 marketing materials.

---

# 33. Endpoint Inspector

Example:

```text
POST /payment

Observed activity

Requests
15

Average
891ms

Errors
2

Observed error rate
13.3%

WORKFLOWS

Checkout

STATES

PAYMENT_PENDING
PAYMENT_SUCCESS
PAYMENT_FAILURE

SESSIONS

15

[ View sessions ]
```

This is the core product experience.

---

# 34. Endpoint + Behavior Graph

### H2

> **See exactly where an endpoint participates in application behavior.**

Behavior Graph:

```text
CART
  ↓
CHECKOUT
  ↓
PAYMENT_PENDING
  ↓
PAYMENT_SUCCESS
```

Activate:

```text
[ API context ]
```

and reveal:

```text
CART
  │
  │ POST /checkout
  ▼
CHECKOUT
  │
  │ POST /payment
  ▼
PAYMENT_SUCCESS
```

This should reuse the `/product/behavior-graphs` renderer.

---

# 35. Behavior Graph overlay video

### Master

```text
1920 × 1200
```

### Display

```text
1000 × 625
```

### Duration

```text
8–10 seconds
```

Sequence:

```text
Open graph

↓

Enable API context

↓

Endpoints appear on transitions

↓

Select POST /payment

↓

Relevant graph path isolates

↓

Endpoint inspector opens
```

---

# 36. Endpoint + Workflow Discovery

### H2

> **Understand APIs as parts of workflows—not an unrelated inventory.**

Example:

```text
CHECKOUT

Endpoints observed

GET /products/:id
POST /cart
POST /checkout
POST /payment
```

Then another workflow:

```text
LOGIN

POST /auth/login
GET /profile
```

This lets users ask:

> Which endpoints does Checkout depend on?

rather than only:

> Which endpoints exist?

---

# 37. Workflow-to-endpoints visual

Master:

```text
1600 × 900
```

Display:

```text
1000 × 562
```

Three workflow cards:

```text
CHECKOUT          LOGIN           SEARCH

4 endpoints       2 endpoints     2 endpoints
```

Click a card to expand its mini graph.

---

# 38. Endpoint + Session Replay

### H2

> **Trace an endpoint observation back to the session where it happened.**

Example:

```text
POST /payment

2 error observations

        ↓

SES-3817
SES-4021

        ↓

Session Replay
```

Because backend events are associated with sessions where possible, this should be a major interaction. 

---

# 39. Endpoint → Replay video

Master:

```text
1920 × 1200
```

Display:

```text
1000 × 625
```

Duration:

```text
8–10 seconds
```

Sequence:

```text
Select POST /payment

↓

Open errors

↓

Select SES-3817

↓

Replay opens

↓

Seek directly to API_REQUEST

↓

API_ERROR appears

↓

PAYMENT_FAILURE state highlights
```

---

# 40. Important Phase 1 wording

You can say:

> **Trace captured endpoint activity to the session where it occurred.**

Do not say:

> **Tellann automatically finds the root cause of backend failures.**

Contextual error investigation packages including logs, database activity, and richer correlation belong to Phase 2, not the MVP. 

---

# 41. Endpoint + Coverage

### H2

> **Know which backend paths your demonstrations actually exercised.**

Endpoint coverage is explicitly one of the Phase 1 coverage categories. 

Example:

```text
CHECKOUT ENDPOINT COVERAGE

Observed

✓ POST /cart
✓ POST /checkout
✓ POST /payment


Not observed

○ POST /payment/retry
○ DELETE /cart/item
```

Again, "not observed" only makes sense for endpoints Tellann knows are in the modeled workflow or endpoint inventory.

---

# 42. Endpoint Coverage visual

Master:

```text
1600 × 900
```

Display:

```text
900 × 506
```

Layout:

```text
Workflow map          Endpoint coverage
7 columns             5 columns
```

Panel:

```text
Checkout

Endpoint coverage
87%

Observed
4

Unobserved
1
```

Use illustrative data.

---

# 43. Critical endpoint-coverage boundary

There is an important implementation question here.

Tellann can certainly say:

```text
Endpoint observed
```

because telemetry proves it.

To say:

```text
Endpoint exists but was not observed
```

Tellann needs a known endpoint inventory from something beyond captured calls, or a previously observed/modelled endpoint.

Therefore never infer:

> "Unused API"

from absence of telemetry alone.

The QA Reporting specification includes an `Unused Endpoints` category. 

But that claim requires an authoritative endpoint inventory. Without one, the safer product wording is:

```text
Not observed in selected demonstrations
```

This is an implementation/specification point I would resolve before launch.

---

# 44. Recommended API inventory solution

Long term, distinguish:

```text
DISCOVERED ENDPOINT
Seen through captured telemetry.

KNOWN ENDPOINT
Declared/imported from application definition.

UNOBSERVED ENDPOINT
Known but not exercised in selected sessions.
```

Endpoint sources could eventually include:

```text
SDK observation
OpenAPI import
Manual declaration
Framework route discovery
```

But only SDK-observed endpoint behavior is clearly established by the current Phase 1 source material.

Do not advertise OpenAPI import or route scanning until actually specified and implemented.

---

# 45. Endpoint + Missing States

### H2

> **Backend outcomes can explain where important application states may be missing.**

Example:

```text
Observed

POST /payment
      ↓
200
      ↓
PAYMENT_SUCCESS


Potential missing state

POST /payment
      ┆
4xx / 5xx
      ┆
PAYMENT_FAILURE
```

The site should make it clear that this is **rule-based potential-state analysis**, not proof that the failed API branch exists.

---

# 46. Endpoint + Missing Flows

Example:

```text
CHECKOUT
   ↓
POST /payment
   ↓
PAYMENT_FAILURE
   ↓
RETRY_PAYMENT
   ↓
POST /payment
```

If only successful payment is observed:

```text
Payment failure
Retry payment
```

may appear as unobserved/potential paths.

Cross-link:

```text
Explore Missing Flows →
```

---

# 47. Section — Endpoint Rankings

### H2

> **Find the endpoints that deserve attention first.**

The architecture explicitly identifies API rankings as an Endpoint Intelligence output. 

Use tabs:

```text
[ Slowest ]
[ Most observed ]
[ Highest error ]
```

Example:

```text
SLOWEST

1 POST /payment        891ms
2 POST /checkout       418ms
3 GET /search          371ms
```

---

# 48. Ranking media dimensions

Use actual HTML.

Container:

```text
1000 × ~520px
```

Desktop:

```text
metric tabs
↓
ranking rows
```

Mobile ranking rows:

```text
#1

POST /payment
891 ms

Checkout
```

---

# 49. Section — Recommendations

### H2

> **Turn endpoint observations into practical next steps.**

The functional requirements call for endpoint optimization recommendations, and the architecture lists Optimization Suggestions as an Endpoint Intelligence output.  

The QA Report specification gives recommendation examples including:

```text
Pagination Recommended
Caching Recommended
Query Optimization Recommended
```



---

# 50. Important recommendation boundary

Phase 1 explicitly excludes AI optimization and AI recommendations. Therefore endpoint recommendations must not be marketed as AI-generated. 

Use:

```text
RULE-BASED RECOMMENDATION
```

or simply:

```text
Suggestion
```

Example:

```text
GET /products

Observed average
480ms

Suggestion
Consider pagination where large response
collections contribute to request cost.

Basis
Endpoint response-time rule.
```

Only provide recommendations that the backend actually has sufficient evidence to support.

---

# 51. Be careful with Query Optimization

A recommendation such as:

```text
Query Optimization Recommended
```

can imply database visibility.

But Phase 1 **does not include Database Intelligence**. Query analysis, query optimization, index recommendations, and field-utilization analysis belong to Phase 2. 

Therefore I would modify the public Phase 1 recommendation language.

Safe:

```text
Investigate backend processing
```

Unsafe without database telemetry:

```text
Optimize this SQL query
```

That is another small specification inconsistency worth cleaning up.

---

# 52. Recommended Phase 1 suggestion types

Safe examples could include:

```text
Elevated latency observed
Review endpoint processing

Elevated error rate observed
Investigate error responses

High request frequency observed
Review repeated request behavior

Large workflow dependency
Review endpoint criticality

Not exercised during demonstration
Demonstrate endpoint path
```

These stay within observed evidence.

---

# 53. Endpoint Intelligence Report

### H2

> **Turn backend observations into a QA artifact.**

The QA Reporting specification defines a dedicated Endpoint Intelligence Report to analyze API performance. Its example contains endpoint average response time, request count, error rate, categories for fast/slow/high-error/frequently-used/unused endpoints, and recommendations. 

---

# 54. Report visual

Example:

```text
ENDPOINT INTELLIGENCE REPORT

Application
Storefront Demo

Demonstration
DEM-3817


ENDPOINT SUMMARY

Endpoints observed
12

Slow endpoints
2

Elevated-error endpoints
1


SLOWEST

POST /payment
891ms

POST /checkout
418ms


HIGHEST ERROR

POST /payment
13.3%


MOST OBSERVED

GET /products
48 requests
```

Do not include unsupported production totals.

---

# 55. Report dimensions

Portrait:

```text
1000 × 1280
```

Display:

```text
600 × 768
```

Desktop:

```text
Explanation            Report
5 columns              7 columns
```

Mobile:

```text
Explanation
↓
Report preview
```

---

# 56. Endpoint report export

Use existing report infrastructure:

```text
PDF
CSV
JSON
HTML
```

Keep it as a small strip under the report.

---

# 57. Privacy & Captured Metadata

### H2

> **Analyze backend behavior without turning telemetry into payload surveillance.**

The public page should distinguish:

```text
CAPTURE

HTTP method
Endpoint/route
Response status
Response time
Error metadata
Session correlation


DO NOT PROMISE TO CAPTURE

Full request body
Sensitive credentials
Authentication secrets
Payment data
Private tokens
```

The current Phase 1 source explicitly says endpoint **metadata** is captured. 

So the website should avoid screenshots that show raw request/response bodies unless the privacy specification explicitly permits them.

---

# 58. Privacy visual

```text
POST /payment

Method            ✓
Route             ✓
Status            ✓
Duration          ✓

Authorization     [REDACTED]
Card number       [NOT CAPTURED]
Access token      [NOT CAPTURED]
```

Master:

```text
1400 × 800
```

Display:

```text
900 × 514
```

This also strengthens the security story.

---

# 59. What Endpoint Intelligence is not

### H2

> **Backend context without pretending to be an entire observability stack.**

Use a clean boundary.

```text
PHASE 1 IS

Endpoint metadata capture
Request/response observation
Response-time analysis
Error-rate analysis
Request-frequency analysis
Session correlation
Workflow correlation
Endpoint coverage
Endpoint reports


PHASE 1 IS NOT

Full distributed tracing platform
Log aggregation
Database query intelligence
Production APM
Continuous production monitoring
Automatic root-cause analysis
AI optimization
Infrastructure monitoring
```

The MVP explicitly excludes production monitoring, database intelligence, error-correlation investigation packages, AI debugging, and AI optimization. 

---

# 60. This distinction matters strategically

Tellann should not try to compete with Datadog on:

```text
CPU
Memory
Hosts
Containers
Infrastructure
APM traces
Production metrics
```

on this page.

Tellann's narrative is:

> **We care about the API because of the behavior it enabled or disrupted.**

That keeps Endpoint Intelligence subordinate to Tellann's broader Behavioral QA model rather than letting it become a generic monitoring feature.

---

# 61. Phase 1 implementation story

The MVP flow for the feature should be:

```text
Developer Demonstration
        ↓
Frontend action
        ↓
Backend endpoint executes
        ↓
Backend SDK captures metadata
        ↓
Activity correlates with session
        ↓
Session reconstructs workflow
        ↓
Endpoint Intelligence analyzes:

response time
request frequency
error rate

        ↓
Endpoint appears in:

Workflow
Behavior Graph
Coverage
Session Replay
QA Report
```

That is the ideal story for `/product/endpoint-intelligence`.

---

# 62. Future Endpoint Intelligence

Keep this visually separate.

### Phase 1 — Behavioral QA

```text
Captured endpoint activity
Latency analysis
Observed request volume
Error-rate analysis
Slow endpoints
Frequently observed endpoints
Workflow correlation
Session correlation
Endpoint coverage
Endpoint reports
```

These correspond to current functional requirements. 

### Phase 2 — Planned

```text
Continuous production endpoint monitoring
Workflow-health correlation
Production trends
Error-investigation context
Database intelligence
Logs / trace correlation
```

Production monitoring and contextual error investigation belong to Phase 2. 

### Phase 3 — Planned

```text
Regression detection
Automated failure validation
Failure simulation
Optimization intelligence
Anomaly detection
Autonomous quality recommendations
```

Clearly label:

```text
PLANNED
```

---

# 63. FAQ

Recommended questions include:

```text
What is Endpoint Intelligence?

What endpoint data does Tellann capture?

How does Tellann associate API calls with workflows?

Does Tellann capture request bodies?

Can I see which endpoint caused a state transition?

How does Tellann identify slow endpoints?

How is endpoint error rate calculated?

What does "most observed" mean?

What is endpoint coverage?

Can I see sessions that called an endpoint?

Can I open Session Replay from an endpoint?

Does Tellann support backend errors?

Does Endpoint Intelligence monitor production APIs?

Is Tellann an APM platform?

Does Tellann collect logs?

Does Tellann analyze database queries?

Does Tellann provide distributed tracing?

Are optimization recommendations AI-generated?

Can I export an Endpoint Intelligence Report?
```

---

# 64. Final CTA

### Eyebrow

```text
CONNECT BEHAVIOR TO THE BACKEND
```

### H2

> **See what your APIs were doing when the workflow changed.**

Supporting copy:

> Connect Tellann's backend SDK, demonstrate a workflow, and inspect the requests, responses, latency, errors, and endpoint activity behind the behavior you observed.

Buttons:

```text
[ Start free ]
[ View SDK documentation ]
```

Contextual:

```text
Explore Session Replay →
```

---

# 65. Complete media inventory

| Asset                           | Type                    |    Master | Recommended display |
| ------------------------------- | ----------------------- | --------: | ------------------: |
| Hero Workflow + Endpoint Graph  | HTML/SVG/Canvas         | 1920×1120 |            1320×760 |
| Mobile Hero                     | HTML/SVG                | 1080×1350 |          Responsive |
| API vs Behavioral Context       | SVG/HTML                |  1600×850 |            1000×531 |
| Backend Capture Pipeline        | Animated SVG            | 1800×1000 |            1100×611 |
| Workflow → Endpoint Correlation | Interactive SVG         | 1800×1100 |            1100×672 |
| Endpoint Inventory              | HTML table              |         — |              1200px |
| Response Time Analysis          | HTML/UI                 |  1500×850 |             850×482 |
| Slow Endpoint Ranking           | HTML/UI                 |  1440×900 |             800×500 |
| Request Frequency Ranking       | HTML/UI                 |  1440×900 |             800×500 |
| Error Rate Context              | HTML/SVG                |  1600×900 |             900×506 |
| Endpoint Health                 | HTML/UI                 |  1400×800 |             760×434 |
| Endpoint Explorer               | Interactive HTML/Canvas |         — |            1280×800 |
| Behavior Graph API Overlay      | Product video           | 1920×1200 |            1000×625 |
| Workflow Endpoint Map           | SVG/UI                  |  1600×900 |            1000×562 |
| Endpoint → Replay               | Product video           | 1920×1200 |            1000×625 |
| Endpoint Coverage               | SVG/UI                  |  1600×900 |             900×506 |
| Endpoint + Missing State        | SVG                     |  1500×850 |             900×510 |
| Endpoint + Missing Flow         | SVG                     |  1500×850 |             900×510 |
| Endpoint Rankings               | HTML                    |         — |            1000×520 |
| Recommendation Panel            | HTML/UI                 |  1400×850 |             800×486 |
| Endpoint Intelligence Report    | Report UI               | 1000×1280 |             600×768 |
| Privacy Metadata Diagram        | SVG                     |  1400×800 |             900×514 |

This gives about **22 visual surfaces**, but many are simply different views of the same reusable Endpoint Intelligence component system.

---

# 66. Which assets should actually be videos?

Do not make everything video.

Only three product videos are really necessary:

```text
1. Hero / workflow-to-endpoint correlation
   12–15 sec

2. Behavior Graph → API Context
   8–10 sec

3. Endpoint → Session Replay
   8–10 sec
```

Everything else should preferably be:

```text
live HTML
SVG
Canvas
CSS animation
```

This will keep the page lighter and more interactive.

---

# 67. Reusable Endpoint component architecture

Conceptually:

```tsx
<EndpointIntelligence
  application={application}
  workflow={workflow}
  endpoints={endpoints}
/>
```

Supporting components:

```tsx
<EndpointExplorer />
<EndpointList />
<EndpointInspector />
<EndpointMetrics />
<EndpointWorkflowMap />
<EndpointGraphOverlay />
<EndpointSessionList />
<EndpointCoverage />
<EndpointRecommendation />
<EndpointReportPreview />
```

And importantly:

```text
BehaviorGraph
      +
Endpoint Overlay
      =
Endpoint Behavior View
```

Do not build a completely separate graph renderer.

---

# 68. Suggested frontend endpoint model

Conceptually:

```ts
interface EndpointObservation {
  id: string;

  method:
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";

  route: string;

  requestCount: number;

  averageResponseTime?: number;

  errorCount?: number;
  errorRate?: number;

  workflowIds?: string[];
  sessionIds?: string[];

  relatedStateIds?: string[];

  lastObservedAt?: string;
}
```

Avoid putting production-only concepts such as:

```text
liveRps
24HourTraffic
productionHealthTrend
```

into the Phase 1 marketing data model.

---

# 69. Suggested API architecture

The current API specification already defines:

```text
GET /endpoints
GET /endpoints/health
GET /endpoints/rankings
GET /endpoints/slow
GET /endpoints/errors
GET /endpoints/recommendations
```

for Endpoint Intelligence. 

For the richer UI described above, I would ensure the backend also supports endpoint-specific relationships conceptually such as:

```text
GET /endpoints/{id}

GET /endpoints/{id}/sessions

GET /endpoints/{id}/workflows
```

Those additional routes are my implementation recommendation; they are not present in the retrieved API specification.

---

# 70. One API improvement I would strongly consider

The existing endpoint API is category-oriented:

```text
/endpoints/slow
/endpoints/errors
/endpoints/rankings
```

For the frontend, a filterable canonical endpoint can reduce duplication:

```http
GET /endpoints?
  workflowId=...
  sort=responseTime
  health=slow
  hasErrors=true
```

while keeping dedicated convenience routes if desired.

This makes the actual Endpoint Explorer much easier to implement.

---

# 71. Visual design language

Stay within Tellann's monochrome system.

The primary palette remains:

```text
Black
White
Off-white
Gray
```

Semantic color may appear inside product UI for:

```text
success
error
warning
selected states
```

but should be restrained.

Endpoint method badges can be differentiated through:

```text
GET
POST
PUT
DELETE
```

text + border treatment rather than rainbow API-documentation colors.

---

# 72. Animation language

Endpoint Intelligence motion should communicate:

```text
request
response
latency
correlation
failure
context
```

Good:

```text
request moves along workflow edge
response resolves
duration appears
API error changes resulting state
endpoint overlay fades onto Behavior Graph
session opens at matching API event
```

Avoid:

```text
network-map particles
server-rack animation
floating code
cybersecurity-style glowing lines
generic cloud diagrams
```

The page is about software behavior, not data-center imagery.

---

# 73. Scroll choreography

One particularly strong storytelling sequence could remain sticky:

```text
LEFT
Checkout workflow

RIGHT
scrolling endpoint analysis
```

As the visitor scrolls:

```text
01 CART_ACTIVE
POST /cart appears

02 CHECKOUT
POST /checkout appears

03 PAYMENT_PENDING
POST /payment appears

04 FAILURE
503 appears

05 INVESTIGATE
Session link appears
```

Desktop:

```text
7 columns graph
5 columns explanation
```

This could become the signature visual sequence of the page.

---

# 74. Desktop layout

Global:

```text
max-width: 1280px
```

Interactive sections:

```text
max-width: 1400px
```

Grid:

```text
12 columns
24px gaps
```

Text blocks:

```text
620–680px max
```

Major visual sections:

```text
1000–1280px
```

---

# 75. Spacing

Desktop:

```text
Hero top                130–150px

Major section spacing   140–180px

H2 → paragraph          20–24px

Paragraph → visual      48–64px
```

Mobile:

```text
Major sections          88–104px

Copy → visual           32px
```

---

# 76. Responsive behavior

### ≥1280px

Full workflow and endpoint context side-by-side.

### 1024–1279px

Reduce inspector width.

### 768–1023px

Use:

```text
Workflow graph
↓
Endpoint metrics
```

### <768px

Use:

```text
Workflow
[ Checkout ▾ ]

Endpoint
[ POST /payment ▾ ]

Metrics

Workflow context

Errors

Sessions
```

Never squeeze a 30-endpoint table onto mobile.

---

# 77. Mobile Endpoint card

Example:

```text
POST /payment

Checkout

Avg.
891ms

Observed
15

Errors
2

[ View context ]
```

When expanded:

```text
Related states

PAYMENT_PENDING
PAYMENT_SUCCESS
PAYMENT_FAILURE

[ View sessions ]
```

---

# 78. Accessibility

All endpoint context must be available without interacting with a graph.

Offer:

```text
Graph
Table
```

Table form:

```text
Workflow       Transition                    Endpoint

Checkout       Cart → Checkout               POST /checkout

Checkout       Payment Pending → Success      POST /payment

Checkout       Payment Pending → Failure      POST /payment
```

Also avoid using only color for:

```text
Slow
Error
Healthy
Selected
```

Include text labels.

---

# 79. Reduced motion

Under:

```css
@media (prefers-reduced-motion: reduce)
```

disable:

```text
request-flow animation
response animation
graph edge tracing
automatic inspector sequencing
autoplay product videos
```

Show final correlation state immediately.

---

# 80. Performance

The hero should not require a heavyweight graph/video bundle before first content paint.

Recommended:

```text
Initial:
static SVG/poster

After hydration:
interactive graph

Below fold:
lazy-loaded Endpoint Explorer
```

Product videos:

```text
WebM primary
MP4 fallback
poster image
preload="metadata"
muted
playsinline
```

Only autoplay when visible.

---

# 81. SEO

### Recommended title

> **Endpoint Intelligence — Connect API Performance to Application Behavior | Tellann**

Alternative:

> **API & Endpoint Intelligence for Behavioral QA | Tellann**

### Meta description

> See how Tellann connects API requests, responses, latency, errors, and endpoint activity to application workflows, behavioral states, sessions, coverage, and QA reports.

---

# 82. Suggested heading structure

The main H2 progression should read almost like a story:

```text
H1
See the backend behavior behind every workflow.

H2
API metrics tell you what happened. Behavioral context tells you why it mattered.

H2
Backend behavior is captured alongside the session.

H2
See which endpoints participate in each workflow.

H2
Turn observed API activity into an endpoint inventory.

H2
Measure how long backend operations took during observed behavior.

H2
Find backend calls that slow down the demonstrated workflow.

H2
See which APIs your demonstrated workflows rely on most.

H2
Find endpoints that produced errors during the workflow.

H2
Summarize endpoint behavior without losing the evidence beneath it.

H2
Move from endpoint metrics to behavioral context.

H2
See exactly where an endpoint participates in application behavior.

H2
Understand APIs as parts of workflows—not an unrelated inventory.

H2
Trace an endpoint observation back to the session where it happened.

H2
Know which backend paths your demonstrations actually exercised.

H2
Find the endpoints that deserve attention first.

H2
Turn endpoint observations into practical next steps.

H2
Turn backend observations into a QA artifact.

H2
Analyze backend behavior without turning telemetry into payload surveillance.

H2
Backend context without pretending to be an entire observability stack.

H2
See what your APIs were doing when the workflow changed.
```

---

# 83. Analytics instrumentation

Track events such as:

```text
endpoint_hero_interacted

endpoint_workflow_selected

endpoint_selected

endpoint_sort_changed

endpoint_slow_filter_used

endpoint_error_filter_used

endpoint_method_filter_used

endpoint_graph_context_enabled

endpoint_session_opened

endpoint_replay_opened

endpoint_coverage_opened

endpoint_missing_state_opened

endpoint_missing_flow_opened

endpoint_recommendation_opened

endpoint_report_previewed

endpoint_sdk_docs_clicked

endpoint_signup_clicked
```

Example properties:

```json
{
  "endpoint": "POST /payment",
  "workflow": "checkout",
  "interaction": "session_opened",
  "sourceSection": "endpoint_explorer"
}
```

---

# 84. Three implementation issues I would resolve before building the public page

There are three places where the source documents should be made more precise before the marketing copy becomes definitive.

**First, “Unused Endpoints.”** The QA Report spec includes an Unused Endpoints category.  But absence of observed requests does not prove an endpoint exists and is unused. You need an authoritative endpoint inventory before making that claim. Otherwise call it **“not observed in selected demonstrations.”**

**Second, “Query Optimization Recommended.”** The reporting spec gives this as an example recommendation.  But database query analysis and query optimization are explicitly Phase 2.  I would replace Phase 1 public wording with **“Investigate backend processing”** unless database visibility has actually been introduced.

**Third, “Endpoint Health.”** The architecture defines Endpoint Health, but the retrieved specifications do not define a calculation formula.  Until a scoring model is formalized, prefer deterministic statuses such as `Slow`, `Elevated Errors`, and `Observed Normally` rather than inventing a 0–100 health score.

These changes would make the page significantly more defensible.

---

# 85. Highest-priority media to produce first

If you are implementing the website incrementally, the first five assets I would prioritize are:

```text
1. Hero Workflow ↔ Endpoint visualization
   The defining page visual.

2. Backend Capture / Session Correlation animation
   Explains how the data gets there.

3. Interactive Endpoint Explorer
   Demonstrates the actual product experience.

4. Endpoint → Session Replay video
   Shows Tellann's key contextual advantage.

5. Behavior Graph API Overlay
   Connects this feature to the rest of the product.
```

Everything else can be added after these are polished.

---

# 86. Final page narrative

The user should reach the bottom understanding this exact story:

```text
I demonstrate Checkout.

        ↓

The browser enters CART_ACTIVE.

        ↓

I click Checkout.

        ↓

Tellann sees the frontend behavior.

        ↓

The backend executes:

POST /checkout

        ↓

The workflow reaches PAYMENT_PENDING.

        ↓

POST /payment executes.

        ↓

Tellann captures:

endpoint
response
duration
error metadata

        ↓

The request returns 503.

        ↓

The application moves into:

PAYMENT_FAILURE

        ↓

Tellann now connects:

Workflow
+
State
+
Endpoint
+
Response
+
Session

        ↓

I can see that POST /payment
was slow and produced an error.

        ↓

I can open the exact session.

        ↓

I can see where the endpoint sits
inside the Behavior Graph.

        ↓

I can see whether other endpoint
paths were ever exercised.

        ↓

I can include the finding
in my QA report.
```

That should define `/product/endpoint-intelligence`: **not another isolated API-performance dashboard, but the backend execution layer of Tellann's behavioral model—connecting endpoints to the workflows, states, sessions, coverage, errors, and QA evidence they actually affected.** The current specifications support response-time analysis, frequency analysis, error-rate analysis, endpoint health/reporting, session correlation, rankings, and recommendations in Phase 1 while deliberately leaving continuous production monitoring, database intelligence, full error-correlation investigation, and autonomous intelligence for later phases.  
