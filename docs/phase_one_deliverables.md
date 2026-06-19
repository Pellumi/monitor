Phase 1 is actually much more focused than the architecture documents make it appear. The MVP scope is centered around a single promise:

> Demonstrate your application once, and SOTS automatically discovers workflows, measures coverage, identifies missing states, identifies missing flows, and generates QA intelligence. 

Everything in Phase 1 should support that outcome.

---

# Phase 1 Deliverables

## 1. Application Onboarding

A developer can:

* Create an organization
* Create an application
* Generate API keys
* Configure SDKs
* Connect an application to SOTS

APIs:

```text
POST /applications
POST /api-keys
```



---

# 2. Frontend SDK

React SDK.

Captures:

* Page visits
* Route changes
* Button clicks
* Link clicks
* Form interactions
* Form submissions
* UI interactions
* Errors
* Session lifecycle

Current SDK interfaces:

```ts
SOTS.initialize()

SOTS.trackEvent()

SOTS.trackState()

SOTS.trackTransition()

SOTS.startWorkflow()

SOTS.completeWorkflow()

SOTS.captureException()
```

### Phase 1.5B Extension

You have effectively added:

```ts
Sots.trackBusinessEvent()
```

although the SDK specification still needs updating. 

---

# 3. Backend SDK

Node SDK.

Captures:

* API requests
* API responses
* Response latency
* Error events
* Session correlation

Example:

```ts
SOTS.trackApi({
  endpoint: "/api/orders",
  method: "POST",
  statusCode: 200,
  durationMs: 150
});
```

---

# 4. Demonstration Mode

This is the centerpiece of Phase 1.

Workflow:

```text
Create App
↓
Install SDK
↓
Start Recording
↓
Perform Walkthrough
↓
Upload Session
↓
Generate Analysis
```

Developer performs:

```text
Register
↓
Login
↓
Browse
↓
Checkout
```

SOTS learns application behavior from the walkthrough.

---

# 5. Session Recording Engine

Responsible for:

* Event collection
* Event sequencing
* Session construction
* Timeline generation

Produces:

```text
Session
Timeline
Metadata
Statistics
```



---

# 6. Session Replay

Not video replay.

Behavior replay.

Produces:

```text
Timeline Playback
Workflow Timeline
API Timeline
Error Timeline
```

Example:

```text
12:00 Login
12:01 Browse
12:02 Checkout
12:03 Payment Success
```



---

# 7. Behavior Graph Generation

The primary differentiator.

Converts:

```text
Events
↓
States
↓
Transitions
↓
Workflows
```

into a behavior graph.

Example:

```text
ANONYMOUS
↓
AUTHENTICATED
↓
PRODUCT_VIEW
↓
CART
↓
CHECKOUT
```

### Phase 1.5B Enhancement

State extraction hierarchy:

```text
Business Event
↓
Metadata Match
↓
Regex Pattern
↓
Exact URL
```

---

# 8. Workflow Discovery

Automatically discovers:

* Entry points
* Exit points
* Workflow boundaries
* Workflow inventory

Outputs:

```text
Checkout Workflow
Registration Workflow
Search Workflow
Subscription Workflow
```

No manual workflow modeling required.

---

# 9. Coverage Engine

Measures:

* Workflow coverage
* State coverage
* Transition coverage
* Endpoint coverage
* Error coverage

Example:

```text
Checkout Flow

Observed:
✓ Add Item
✓ Checkout
✓ Payment Success

Missing:
✗ Payment Failure
✗ Empty Cart

Coverage:
60%
```



---

# 10. Missing State Detection

Detects missing:

### Loading States

```text
SEARCH_LOADING
CHECKOUT_LOADING
```

### Empty States

```text
EMPTY_CART
NO_RESULTS
```

### Error States

```text
404
500
AUTH_FAILURE
```

### Recovery States

```text
RETRY_PAYMENT
RETRY_UPLOAD
```

### Phase 1.5B Enhancement

Generic QA packs:

```text
auth
crud
api
errors
permissions
search
upload
empty-states
recovery
loading
```

---

# 11. Missing Flow Detection

Detects:

### Failure Flows

```text
LOGIN_FAILURE
PAYMENT_FAILURE
API_FAILURE
```

### Alternative Flows

```text
SOCIAL_LOGIN
GUEST_CHECKOUT
```

### Recovery Flows

```text
RETRY_LOGIN
RETRY_PAYMENT
```



### Phase 1.5B Enhancement

Transformation engine:

```ts
{
  pattern: ["$prefix", "CART", "CHECKOUT"],
  transformation: {
    replace: {
      from: "CHECKOUT",
      to: "EMPTY_CART"
    }
  }
}
```

---

# 12. Endpoint Intelligence

Analyzes:

* Slow endpoints
* Error-prone endpoints
* Request volume
* Latency

Example:

```text
/api/search

Average:
1.8s

Recommendation:
Investigate performance
```

---

# 13. Reporting Engine

Generates:

### Executive Report

### Flow Coverage Report

### Behavioral Graph Report

### Missing State Report

### Missing Flow Report

### Session Analysis Report

### Endpoint Intelligence Report

Export formats:

```text
PDF
JSON
CSV
HTML
```

---

# 14. Dashboard

Views:

### Application Overview

### Session Viewer

### Replay Viewer

### Behavior Graph Viewer

### Coverage Viewer

### Missing State Viewer

### Missing Flow Viewer

### Endpoint Viewer

### Reports Viewer

Technology:

```text
Next.js
```



---

# Infrastructure Deliverables

Phase 1 services:

```text
API Gateway
Event Collector
Session Engine
Replay Engine
Graph Engine
Coverage Engine
Endpoint Engine
Report Engine
Dashboard
```

Storage:

```text
PostgreSQL
ClickHouse
Object Storage
Kafka
```

The deployment architecture also includes Neo4j for behavior graph storage, although whether you ship it in the very first production release is an implementation choice. 

---

# What Is NOT In Phase 1

These are explicitly excluded:

### Production Monitoring

```text
Live workflow monitoring
Production baselines
Continuous monitoring
```

### Database Intelligence

```text
Query analysis
Index recommendations
```

### Error Correlation

```text
Log correlation
Trace correlation
Root cause analysis
```

### Autonomous Testing

```text
Test generation
Test execution
Regression suites
```

### AI Features

```text
AI recommendations
AI assistants
AI optimization
Quality scoring
```

### Anomaly Detection

```text
Behavioral anomalies
Latency anomalies
Drift detection
```

All of those belong to Phase 2 or Phase 3. 

---

# If I Condense Phase 1 Into One Diagram

```text
Developer Walkthrough
          ↓
Frontend SDK + Backend SDK
          ↓
Session Recording
          ↓
Session Replay
          ↓
Behavior Graph
          ↓
Workflow Discovery
          ↓
Coverage Analysis
          ↓
Missing States
          ↓
Missing Flows
          ↓
Endpoint Analysis
          ↓
QA Reports
          ↓
Dashboard
```

Phase 1.5B has improved the middle of this pipeline by replacing route-centric state discovery with behavior-centric discovery, but it doesn't fundamentally change the Phase 1 deliverables—it makes the Graph Engine, Coverage Engine, and Missing Flow Engine significantly smarter.
