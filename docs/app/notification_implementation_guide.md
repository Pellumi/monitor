Yes. I would treat notifications as a **first-class Tellann subsystem**, not merely browser toasts. Tellann already has a Notification Service in the component design, intended for workflow degradation, anomaly, report, and release-regression notifications, with email, webhook, and in-app delivery.  The API spec also already establishes `/notifications` and webhook endpoints. 

What is missing from the specifications is the detailed **Web Push + Desktop Notification architecture**. The design below extends the existing architecture without changing Tellann's core model.

---

# 1. Overall Tellann Notification Model

I would define five delivery channels:

| Channel            | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| **In-App**         | Notification bell, notification center, live dashboard messages |
| **Web Push**       | Browser notifications when Tellann tab is closed/backgrounded   |
| **Desktop Native** | Windows/macOS/Linux OS notifications from Tellann Desktop       |
| **Email**          | Important events, summaries, security, account activity         |
| **Webhook**        | Machine-to-machine alerts for teams/integrations                |

The last three currently documented channels are email, webhooks and in-app. Web Push and Desktop Native should be formally added to `CDD-NOT-001`. 

The architecture becomes:

```text
Tellann Domain Events
        │
        ▼
Kafka
        │
        ▼
Notification Service
        │
        ├── Rule Engine
        ├── Severity Engine
        ├── Preference Engine
        ├── Deduplication Engine
        ├── Delivery Router
        └── Notification Store
                │
        ┌───────┼────────┬─────────┬─────────┐
        ▼       ▼        ▼         ▼         ▼
     In-App   Web Push  Desktop   Email    Webhook
```

This fits Tellann particularly well because the platform is already event-driven and uses Kafka as its event bus. 

---

# 2. The Most Important Rule

**Do not send a notification for every Tellann event.**

Your event taxonomy contains:

```text
BUTTON_CLICK
PAGE_VISIT
API_REQUEST
API_RESPONSE
STATE_TRANSITION
...
```

Those are telemetry.

They are **not notifications**.

Notifications should be generated when raw events produce something that changes what the user should know or do.

For example:

```text
1,000 API_RESPONSE events
        ↓
Endpoint Analysis
        ↓
Endpoint becomes unhealthy
        ↓
ENDPOINT_HEALTH_CHANGED
        ↓
Notification
```

The Event Taxonomy already contains higher-order events such as `REPORT_GENERATED`, `COVERAGE_DEGRADED`, `QUALITY_RISK_IDENTIFIED`, `ENDPOINT_HEALTH_CHANGED`, `REGRESSION_DETECTED`, `ANOMALY_DETECTED`, and `INSIGHT_GENERATED`. Those should form the backbone of notification triggering. 

---

# 3. Notification Categories

I recommend eight notification families:

```text
Tellann Notifications
│
├── 01 Analysis & Demonstration
├── 02 Quality & Coverage
├── 03 Workflow & Production
├── 04 Endpoint & Error
├── 05 Release & Regression
├── 06 System & Integration
├── 07 Security & Account
└── 08 Billing & Administration
```

Then Phase 3 adds:

```text
09 Anomaly & Intelligence
10 Autonomous Validation
```

---

# 4. Notification Severity

Every notification should have one severity.

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

This aligns with Tellann's existing reporting severity model. 

But severity must affect delivery behavior.

| Severity | In-app |      Web Push |       Desktop |      Email | Typical timing      |
| -------- | -----: | ------------: | ------------: | ---------: | ------------------- |
| Critical |      ✓ |             ✓ |             ✓ |          ✓ | Immediately         |
| High     |      ✓ |             ✓ |             ✓ | Optional ✓ | Immediately         |
| Medium   |      ✓ |    Preference |    Preference |     Digest | Within normal flow  |
| Low      |      ✓ | No by default | No by default |     Digest | Non-urgent          |
| Info     |      ✓ |            No |            No |         No | Notification center |

This single rule will prevent Tellann from becoming noisy.

---

# 5. PHASE 1 — Notifications to Implement Now

This is important.

The MVP specifically excludes:

* continuous production monitoring;
* behavioral anomaly detection;
* production workflow monitoring;
* release regression detection;
* autonomous quality intelligence.

Those belong to Phases 2 and 3. 

So **do not build Phase 3 notification logic into the current MVP just because the notification UI exists.**

Build the infrastructure now, but activate only Phase 1 notification types.

---

# 6. Demonstration Started

### Trigger

```text
Demonstration recording successfully starts
```

### Type

`INFO`

### Delivery

```text
In-App ✓
Desktop optional
Web Push ✗
Email ✗
```

Example:

> **Demonstration started**
> Tellann is now observing Demo Store.

This doesn't usually deserve external push.

---

# 7. Demonstration Successfully Completed

Trigger:

```text
Developer ends demonstration
↓
Session finalized
```

Type:

`INFO`

Example:

> **Demonstration recorded**
> 742 events were captured across 6 observed workflows. Analysis has started.

The demonstration lifecycle already transitions from captured events → session → states → transitions → workflows → behavior graph. 

---

# 8. Demonstration Analysis Complete

This should be one of your most useful push notifications.

Trigger:

```text
POST /demonstrations/{id}/analyze
          ↓
analysis completes
```

Notification:

> **Analysis complete**
> Tellann discovered 8 workflows and 14 potential quality gaps in Storefront Demo.

CTA:

```text
View analysis
```

Deep link:

```text
/applications/{applicationId}/demonstrations/{id}/results
```

Delivery:

```text
In-App ✓
Web Push ✓
Desktop ✓
Email optional
```

This is valuable because analysis can take time and the user may have left the page.

---

# 9. Demonstration Processing Failed

Trigger:

```text
session processing failure
graph generation failure
coverage processing failure
replay processing failure
report generation failure
```

Severity:

```text
HIGH
```

Example:

> **Analysis failed**
> Tellann couldn't complete analysis for Checkout Demo.

CTA:

```text
Review issue
Retry analysis
```

This should produce Web Push/Desktop notification because user action is required.

---

# 10. Session Replay Ready

Your NFR requires replay data to become available within 30 seconds after session completion. 

Trigger:

```text
Replay Builder
↓
Replay assets stored
↓
replay.ready
```

Type:

`INFO`

Default delivery:

```text
In-App ✓
Push ✗
```

I wouldn't push this separately if the overall demonstration analysis is also finishing.

Instead group it:

> **Your Tellann analysis is ready**
> Replay, behavior graph and coverage results are available.

---

# 11. Behavior Graph Generated

Trigger:

```text
graph-engine completed
```

Type:

`INFO`

Example:

> **Behavior graph ready**
> Tellann mapped 31 states, 48 transitions and 7 workflows.

Normally in-app only.

The Behavior Graph is the central model Tellann uses to transform sessions into states, transitions and workflows. 

---

# 12. Coverage Analysis Completed

Trigger:

```text
COVERAGE_CALCULATED
```

Type:

`INFO`

Example:

> **Coverage analysis ready**
> Checkout coverage is 72%. Seven paths remain unobserved.

Push only when requested/analysis was running asynchronously.

---

# 13. Critical Coverage Gap Found

This is different.

If rule-based analysis discovers an important gap:

```text
CHECKOUT
Coverage 72%

Missing:
PAYMENT_FAILURE
SESSION_TIMEOUT
OUT_OF_STOCK
```

Tellann can notify.

Example:

> **Critical checkout paths were not demonstrated**
> Payment failure, timeout and inventory failure paths are currently missing.

Severity:

```text
MEDIUM or HIGH
```

CTA:

```text
Review missing flows
```

Because Phase 1 explicitly includes missing flow and missing state detection, this is within MVP scope. 

---

# 14. Missing State Notifications

Possible triggers:

```text
Missing Loading State
Missing Empty State
Missing Error State
Missing Recovery State
```

But don't create four push notifications.

Group them:

> **6 states may be missing**
> Tellann identified 2 loading, 1 empty, 2 error and 1 recovery state that weren't demonstrated.

Push:

```text
No by default.
```

In-app:

```text
Yes.
```

---

# 15. Endpoint Issue Detected During Demonstration

Phase 1 already includes endpoint intelligence. 

Trigger examples:

```text
API latency exceeds configured threshold

API error rate exceeds configured threshold

API repeatedly times out during demonstration
```

Example:

> **Slow endpoint detected**
> `GET /api/products` averaged 1.84s during your demonstration.

Severity depends on threshold:

```text
>500 ms       LOW
>1 s          MEDIUM
>3 s          HIGH
Repeated 5xx  HIGH
```

These thresholds should eventually be configurable.

---

# 16. QA Report Ready

The QA Report Engine can produce several Phase 1 reports, including coverage, graph, missing-state, missing-flow, session and endpoint reports. 

Trigger:

```text
REPORT_GENERATED
```

Example:

> **QA report ready**
> Your Checkout Demonstration QA Report has been generated.

CTA:

```text
View report
Download report
```

Web Push/Desktop:

```text
Yes if report generation was explicitly requested.
```

---

# 17. Report Generation Failed

Trigger:

```text
report job failed
```

Severity:

`MEDIUM`

Push:

```text
Yes
```

Example:

> **Report generation failed**
> Tellann couldn't generate your Flow Coverage Report.

CTA:

```text
Retry
```

---

# 18. SDK Connected Successfully

After a developer installs the SDK:

```text
SDK initializes
↓
first valid telemetry event arrives
↓
Tellann recognizes installation
```

Notification:

> **Tellann is receiving data**
> React SDK connected successfully to Storefront.

This is extremely useful onboarding feedback.

Delivery:

```text
In-App ✓
Web Push ✗
Desktop ✗
```

---

# 19. SDK Has Stopped Sending Events

This is worth notifying.

Condition:

```text
application previously active
+
expected demonstration/session occurring
+
no telemetry for defined period
```

Example:

> **Telemetry interrupted**
> Tellann stopped receiving events from Storefront while a demonstration was active.

Severity:

`HIGH`

Possible causes:

```text
Invalid SDK key
Network issue
SDK disabled
Collector unavailable
Incorrect environment
```

CTA:

```text
Run diagnostics
```

---

# 20. API/Ingestion Key Notifications

Notify for:

```text
Key created
Key rotated
Key revoked
Key expired
Invalid key repeatedly detected
```

The API-key architecture already requires keys to be application scoped, tenant scoped, rotatable and expirable. 

Examples:

> **API key revoked**

or:

> **SDK key expires in 7 days**

Security-sensitive changes should also be audit logged.

---

# 21. Quota Notifications

These are commercial rather than quality notifications.

Examples:

```text
Storage 75% used
Storage 90% used
Storage limit reached

Application limit reached
User limit reached

Retention-related deletion approaching
```

Recommended triggers:

```text
70%
85%
95%
100%
```

Don't send dozens.

Notify only when crossing a threshold.

---

# 22. Retention Notifications

Since retention differs by plan and replay assets default to finite retention windows, users may need warning before important assets expire. Session replay retention is specified as 90 days by default, with tenant-level configurability. 

Example:

> **3 session replays expire in 7 days**
> Export them or update your retention settings.

This is particularly useful for teams using demonstrations as QA evidence.

---

# 23. Account & Security Notifications

These should be independent of product phase.

Notify when:

```text
Password changed
Email changed
MFA enabled
MFA disabled
New sign-in detected
Suspicious login attempt
User role changed
User removed
API key created
API key revoked
SSO settings changed
Security settings changed
```

Security alerts should use the existing Tellann severity system.

The security architecture explicitly requires monitoring authentication failures, excessive API activity, unauthorized access, privilege escalation and suspicious activity, with administrator notification as a supported response. 

---

# 24. What Should NOT Generate Push Notifications

This is just as important.

Do not push for:

```text
User opens page

Session starts

Individual click captured

Individual API request

Individual state transition

Every new replay event

Individual successful API response

Behavior graph node added

Every low-severity missing state

Every dashboard update
```

Otherwise Tellann becomes unusable.

---

# 25. PHASE 2 — Production Notifications

When Tellann enters Production Intelligence, notification value changes dramatically.

The FRS introduces continuous production monitoring, workflow health, journey intelligence, endpoint intelligence and error correlation. 

This is where notifications become a core operational feature.

---

# 26. Workflow Degradation

Trigger:

```text
Current workflow performance
       ↓
Health calculator
       ↓
Compared against previous health
       ↓
degradation exceeds threshold
```

Example:

```text
CHECKOUT

Previous Health: 96
Current Health: 78
Delta: -18
```

Push:

> **Checkout health degraded**
> Success fell 14% while error rate increased after 07:30.

Severity:

`HIGH`

CTA:

```text
Investigate workflow
```

This is exactly the type of notification explicitly named in the existing Notification Service specification. 

---

# 27. Workflow Failure Spike

Example:

> **Checkout failures increased**
> 38 failed sessions have been observed during the last 20 minutes.

Push:

```text
Web ✓
Desktop ✓
Email ✓ depending severity
Webhook ✓
```

---

# 28. Workflow Abandonment Increase

Example:

> **Users are abandoning checkout more often**
> Abandonment increased from 18% to 31%.

Initially:

`MEDIUM`

Large increase:

`HIGH`

---

# 29. Friction Detected

Phase 2 has `FRICTION_DETECTED` as an event category. 

Example:

> **Repeated interaction detected**
> Users are repeatedly returning to Search before completing Checkout.

Usually:

```text
In-App
Daily digest
```

Not immediate push unless unusually severe.

---

# 30. Endpoint Health Change

Event:

```text
ENDPOINT_HEALTH_CHANGED
```

Example:

> **Payment API health degraded**
> `POST /payments` error rate increased from 0.8% to 8.4%.

High severity:

```text
Web Push ✓
Desktop ✓
Email ✓
Webhook ✓
```

---

# 31. Error Correlation Complete

Suppose Tellann detects:

```text
Checkout failed
│
├── Session Replay
├── Workflow
├── API
├── Trace
├── Logs
└── Database activity
```

Then:

> **Checkout failure investigation is ready**
> Tellann correlated 47 failures with the payment service.

CTA:

```text
Open investigation
```

Error correlation and investigation packages are formal Phase 2 capabilities. 

---

# 32. PHASE 3 — Release Notifications

This is where release confidence becomes central.

---

# 33. Regression Detected

Trigger:

```text
REGRESSION_DETECTED
```

Examples:

> **Behavioral regression detected**
> `PAYMENT_SUCCESS` is no longer reachable in v2.8.0.

or:

> **Checkout regression detected**
> Release v2.8.0 removed a previously observed recovery path.

Severity:

```text
HIGH / CRITICAL
```

Delivery:

```text
All enabled urgent channels
```

The Phase 3 functional requirements explicitly cover baseline comparison, workflow deviations, unexpected transitions, missing workflows and regression reporting. 

---

# 34. Release Validation Complete

Example:

> **Release validation complete**
> v2.8.0 matches 96% of the established behavioral baseline.

CTA:

```text
View release report
```

If confidence is strong:

`INFO`

If regressions exist:

`HIGH`

---

# 35. Missing Workflow After Release

Example:

> **Workflow missing after deployment**
> Password Reset was present in v2.7.4 but has not been observed in v2.8.0.

Push:

`HIGH`

---

# 36. Phase 3 Anomaly Notifications

Events already defined include:

```text
ANOMALY_DETECTED
LATENCY_SPIKE_DETECTED
ABANDONMENT_SPIKE_DETECTED
ERROR_SPIKE_DETECTED
BEHAVIORAL_DRIFT_DETECTED
```



Examples:

> **Behavioral anomaly detected**
> Checkout abandonment is 3.2× above its established baseline.

> **Latency spike detected**
> Search response time increased 186% over its normal range.

> **Behavioral drift detected**
> Users are reaching Checkout through a previously uncommon workflow.

---

# 37. Quality Risk Identified

Phase 3:

```text
QUALITY_RISK_IDENTIFIED
```

Example:

> **High quality risk identified**
> Payment latency, abandonment and gateway failures are increasing together.

Tellann should attach:

```text
Confidence
Evidence
Affected workflow
Severity
Recommended next action
```

The NFR requires generated intelligence to be explainable and supported with evidence/confidence indicators. 

---

# 38. Test Suite Generated

Trigger:

```text
TEST_SUITE_GENERATED
```

Notification:

> **24 validation scenarios generated**
> Tellann generated positive, negative and edge-case tests for Checkout.

CTA:

```text
Review generated tests
```

Mostly in-app/Desktop.

---

# 39. Failure Simulation Complete

Example:

> **Payment timeout simulation complete**
> Checkout partially recovered from the simulated dependency failure.

CTA:

```text
View resilience report
```

---

# 40. Web App Push Architecture

Now to the implementation.

The Web App should support two separate mechanisms:

```text
IN-APP REAL-TIME
+
BROWSER WEB PUSH
```

They serve different purposes.

---

# 41. In-App Real-Time Notifications

Use:

```text
WebSocket
or
Server-Sent Events
```

Flow:

```text
Kafka Event
   ↓
Notification Service
   ↓
Notification created
   ↓
Realtime Gateway
   ↓
Connected browser
   ↓
Notification UI
```

User sees:

```text
Bell badge
Toast
Notification center
```

This is for users currently inside Tellann.

---

# 42. Browser Push

Use the Web Push model:

```text
Browser
   ↓
Permission granted
   ↓
Service Worker
   ↓
Push subscription created
   ↓
Subscription sent to Tellann
   ↓
Stored against user/device
```

Then:

```text
Notification Service
        ↓
Web Push Provider
        ↓
Push Service
        ↓
Browser Service Worker
        ↓
OS Notification
```

This works when the Tellann page isn't open.

---

# 43. Push Permission

Do **not** immediately show:

> Tellann wants to send notifications.

on first page load.

Bad UX.

Instead show an internal Tellann prompt after the user experiences value:

```text
Keep up with important Tellann findings

Receive notifications when:
• analysis completes
• significant quality issues are detected
• reports are ready
• workflow health changes

[Enable notifications]
[Not now]
```

Only after `Enable notifications`:

```javascript
Notification.requestPermission()
```

---

# 44. Web Push Service Worker

Your dashboard application should register:

```text
/service-worker.js
```

Responsibilities:

```text
Receive push payload
Render notification
Handle notification click
Open/deep-link Tellann
Handle notification close
```

Conceptually:

```text
push
 ↓
parse notification
 ↓
showNotification()
 ↓
user clicks
 ↓
notificationclick
 ↓
openWindow(deepLink)
```

---

# 45. Web Push Subscription

Each browser/device gets its own subscription.

Example conceptual model:

```json
{
  "userId": "user_123",
  "deviceId": "device_456",
  "platform": "WEB",
  "endpoint": "...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  },
  "enabled": true
}
```

Don't store this inside `users`.

A user can have:

```text
Chrome desktop
Edge desktop
Laptop
Office PC
PWA
```

Each should be independently revocable.

---

# 46. Desktop Notification Architecture

There are actually **two kinds of desktop notifications**.

### Tellann Desktop open/running

Simple:

```text
Notification Service
↓
WebSocket/SSE
↓
Tellann Desktop
↓
Native OS notification
```

Example:

```text
Windows Notification Center
macOS Notification Center
Linux desktop notification system
```

---

# 47. Desktop Application Closed

This is harder.

If Tellann Desktop is completely terminated, WebSocket communication obviously doesn't exist.

For true closed-application push you need either:

```text
OS push infrastructure

Windows
→ WNS

macOS
→ APNs
```

or:

```text
Tellann background agent
```

that remains running.

For the first desktop version, I would **not** build all of that.

Use:

```text
Phase 1

Desktop running
→ native notifications

Browser/PWA
→ Web Push even when page isn't open
```

Then introduce true OS-level closed-app desktop push once Desktop usage justifies the complexity.

That keeps the architecture sane.

---

# 48. Cross-Device Behavior

Suppose the user has:

```text
Web browser
Desktop app
Laptop
Second browser
```

Do not send every notification everywhere blindly.

Use delivery priorities.

For example:

```text
User active in Tellann Desktop
        ↓
Desktop notification
        ↓
Don't show browser push

User active in browser
        ↓
In-app toast
        ↓
Don't show browser push

User offline
        ↓
Web Push
+
Email if high severity
```

This dramatically reduces noise.

---

# 49. Notification State Model

Every notification should have:

```text
CREATED
QUEUED
DELIVERED
READ
DISMISSED
ACTIONED
EXPIRED
FAILED
```

Separate notification state from channel delivery state.

Example:

```text
Notification: READ

WebPush delivery: DELIVERED
Desktop delivery: SKIPPED
Email delivery: DELIVERED
```

---

# 50. Recommended Database Tables

Your current database specification already mentions both `alerts` and Notifications as PostgreSQL operational data. 

I would formalize it as:

### `notifications`

```text
id
tenant_id
organization_id
user_id

application_id
workflow_id
session_id
report_id

type
category
severity

title
body

source_event_type
source_event_id

deep_link

created_at
read_at
dismissed_at
expires_at

dedupe_key
group_key
metadata
```

---

# 51. `notification_preferences`

```text
id
user_id

notification_type

in_app_enabled
web_push_enabled
desktop_enabled
email_enabled
webhook_enabled

minimum_severity

quiet_hours_enabled
quiet_hours_start
quiet_hours_end

digest_mode
created_at
updated_at
```

---

# 52. `push_subscriptions`

```text
id
user_id

device_id
device_name

platform

WEB
WINDOWS
MACOS
LINUX

provider

endpoint
public_key
auth_secret

enabled

last_seen_at
created_at
updated_at
```

Secrets should be encrypted.

---

# 53. `notification_deliveries`

This table becomes extremely valuable.

```text
id
notification_id

channel

WEB_PUSH
DESKTOP
IN_APP
EMAIL
WEBHOOK

status

QUEUED
SENT
DELIVERED
FAILED
SKIPPED

attempt_count

sent_at
delivered_at
failed_at

error_code
```

Now you can actually measure whether notifications work.

---

# 54. Notification Rules

I'd also introduce:

```text
notification_rules
```

Structure:

```text
id
tenant_id

event_type
minimum_severity

enabled

cooldown_seconds
aggregation_window

channels

conditions
```

Example:

```json
{
  "eventType": "COVERAGE_DEGRADED",
  "minimumSeverity": "HIGH",
  "cooldownSeconds": 3600,
  "channels": [
    "IN_APP",
    "WEB_PUSH",
    "DESKTOP"
  ]
}
```

This keeps behavior configuration-driven, which aligns with your NFR maintainability principles. 

---

# 55. Notification Event

Do not make the Notification Service consume arbitrary database rows.

Create a normalized event:

```text
NOTIFICATION_REQUESTED
```

Example conceptual payload:

```json
{
  "notificationId": "uuid",

  "tenantId": "uuid",
  "applicationId": "uuid",

  "type": "WORKFLOW_DEGRADED",
  "severity": "HIGH",

  "title": "Checkout health degraded",

  "source": {
    "eventType": "COVERAGE_DEGRADED",
    "eventId": "uuid"
  },

  "context": {
    "workflowId": "checkout",
    "previousScore": 92,
    "currentScore": 71
  }
}
```

---

# 56. Kafka Architecture

Your deployment design already includes:

```text
notification.events
```

as a Kafka topic. 

Use it.

For example:

```text
quality.events
workflow.events
anomaly.events
regression.events
reports.events
security.events
billing.events
       │
       ▼
Notification Rule Processor
       │
       ▼
notification.events
       │
       ▼
Notification Service
```

This isolates business detection from delivery.

Very important architectural boundary.

---

# 57. Deduplication

Suppose:

```text
POST /payments failures
```

occur 700 times.

You absolutely do not want 700 notifications.

Generate:

```text
1 incident notification
```

Then update it:

> Payment endpoint failures continue
> 738 occurrences · 214 affected sessions.

Use:

```text
dedupe_key
```

Example:

```text
endpoint_error:
/payments:
500:
2026-09-03T08
```

---

# 58. Aggregation

Tellann should intelligently group related findings.

Instead of:

```text
Missing Payment Failure

Missing Loading State

Missing Retry Path

Missing Session Timeout

Missing Empty Cart
```

Send:

> **5 Checkout quality gaps detected**

Then show details when opened.

---

# 59. Cooldowns

Example:

```text
Checkout degradation detected
08:00 → Notify

Still degraded
08:05 → Don't notify

Still degraded
08:20 → Don't notify

Severity worsens
08:24 → Notify

Resolved
08:42 → Notify
```

Then:

> **Checkout health recovered**
> Workflow health returned to its expected range.

Recovery notifications are important.

---

# 60. State-Change Notifications

This should become one of Tellann's core notification philosophies.

Don't notify continuously about a bad state.

Notify:

```text
Healthy
 ↓
Degraded
       → alert

Degraded
 ↓
Critical
       → alert

Critical
 ↓
Recovered
       → alert
```

That creates signal rather than noise.

---

# 61. Role-Based Notifications

Tellann already defines several roles. 

Use them.

### Developer

Default:

```text
SDK problems
Endpoint failures
Errors
Demonstration completion
Regression
Technical investigation
```

### QA Engineer

```text
Coverage gaps
Missing states
Missing flows
Regression
Generated tests
Reports
```

### Engineering Manager

```text
Critical workflow degradation
Release confidence
High-severity regressions
Quality summaries
```

### Product Manager

Phase 2:

```text
Journey friction
Workflow abandonment
Journey changes
Workflow health
```

### Organization Admin

```text
Security
Billing
Quota
Users
API keys
System-level issues
```

---

# 62. Notification Preferences Page

I would add a section:

```text
/settings/notifications
```

Navigation:

```text
Settings
├── Profile
├── Security & MFA
├── Billing
├── Members
├── Ingestion Keys
└── Notifications
```

---

# 63. Notification Settings

Top-level controls:

```text
Notifications

In-App             [ON]

Browser Push       [ON]
This browser       Chrome · Windows

Desktop            [ON]
PELLU-LAPTOP        Connected

Email              [ON]

Webhooks            Configure →
```

---

# 64. Category Preferences

```text
                          App   Web   Desktop Email

Analysis completed        ✓     ✓       ✓      ○
QA reports                ✓     ○       ○      ○
Coverage issues           ✓     ○       ○      ○
Critical quality issues   ✓     ✓       ✓      ✓
Workflow degradation      ✓     ✓       ✓      ✓
Endpoint failures         ✓     ✓       ✓      ○
Release regressions       ✓     ✓       ✓      ✓
Security                  ✓     ✓       ✓      ✓
Billing                   ✓     ○       ○      ✓
Product updates           ✓     ○       ○      ○
```

---

# 65. Severity Preference

Allow:

```text
Push me for:

○ Critical only

● Critical + High

○ Critical + High + Medium

○ Everything
```

Default:

```text
Critical + High
```

That is the safest default.

---

# 66. Quiet Hours

Support:

```text
Quiet hours

10:00 PM — 7:00 AM
```

But:

```text
CRITICAL
```

may bypass quiet hours if user enables:

```text
Allow critical notifications
during quiet hours.
```

---

# 67. Digests

Low-value notifications should become digests.

Example:

> **Tellann daily quality summary**
> 4 demonstrations analyzed
> 3 reports generated
> 8 new quality gaps
> 2 endpoint warnings
> No critical findings

Options:

```text
Off
Daily
Weekly
```

---

# 68. Notification Center UI

Bell:

```text
🔔 4
```

Panel:

```text
Notifications

[All] [Unread] [Critical]

Today

● Checkout health degraded
  Storefront · High
  6 min ago

● Analysis complete
  Admin Portal
  22 min ago

○ QA report ready
  Dashboard App
  1 hr ago
```

Actions:

```text
Mark all read
Notification settings
```

---

# 69. Notification Detail

A Tellann notification should not merely say:

> Something went wrong.

It should contain context.

Example:

```text
Checkout health degraded

HIGH

Application
Storefront

Workflow
Checkout

Current Health
71

Previous
93

Change
-22

Evidence
Error rate       +18%
Abandonment      +11%
Median latency   +640ms

First detected
08:31

[Investigate workflow]
[View affected sessions]
```

This reinforces Tellann's fundamental positioning: **behavioral context, not generic monitoring alerts.**

---

# 70. Notification Payload Model

I recommend:

```ts
interface TellannNotification {
  id: string;

  tenantId: string;
  organizationId: string;

  userId?: string;

  applicationId?: string;
  workflowId?: string;
  sessionId?: string;
  reportId?: string;
  releaseId?: string;

  type: NotificationType;
  category: NotificationCategory;

  severity:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "INFO";

  title: string;
  message: string;

  deepLink?: string;

  sourceEventType: string;
  sourceEventId: string;

  groupKey?: string;
  dedupeKey?: string;

  metadata: Record<string, unknown>;

  createdAt: string;
  expiresAt?: string;
}
```

---

# 71. Notification Type Enum

Start with:

```text
DEMONSTRATION_STARTED
DEMONSTRATION_COMPLETED
DEMONSTRATION_ANALYSIS_READY
DEMONSTRATION_ANALYSIS_FAILED

SESSION_PROCESSED
SESSION_PROCESSING_FAILED
REPLAY_READY

BEHAVIOR_GRAPH_READY
GRAPH_GENERATION_FAILED

COVERAGE_ANALYSIS_READY
COVERAGE_GAP_DETECTED

MISSING_STATES_DETECTED
MISSING_FLOWS_DETECTED

ENDPOINT_WARNING
ENDPOINT_ERROR

REPORT_READY
REPORT_GENERATION_FAILED

SDK_CONNECTED
SDK_DISCONNECTED
SDK_ERROR

API_KEY_CREATED
API_KEY_EXPIRING
API_KEY_EXPIRED
API_KEY_REVOKED

STORAGE_THRESHOLD
PLAN_LIMIT_REACHED

SECURITY_ALERT
ACCOUNT_CHANGE
MEMBER_CHANGE

SYSTEM_DEGRADED
SYSTEM_RECOVERED
```

Then Phase 2:

```text
WORKFLOW_DEGRADED
WORKFLOW_RECOVERED
WORKFLOW_FAILURE_SPIKE

JOURNEY_ABANDONMENT_INCREASED
FRICTION_DETECTED
BOTTLENECK_DETECTED

ENDPOINT_HEALTH_DEGRADED
ENDPOINT_HEALTH_RECOVERED

ERROR_CORRELATION_READY
```

Phase 3:

```text
REGRESSION_DETECTED
RELEASE_VALIDATION_COMPLETE

ANOMALY_DETECTED
BEHAVIORAL_DRIFT
ERROR_SPIKE
LATENCY_SPIKE
ABANDONMENT_SPIKE

TEST_SUITE_READY
FAILURE_SIMULATION_COMPLETE

QUALITY_RISK_IDENTIFIED
QUALITY_ASSESSMENT_READY
RECOMMENDATION_CREATED
```

---

# 72. Extend the Notification APIs

Your existing API only defines:

```text
GET /notifications
PATCH /notifications/{id}/read
```



I would expand this substantially.

```text
GET    /notifications

GET    /notifications/{id}

PATCH  /notifications/{id}/read

POST   /notifications/read-all

PATCH  /notifications/{id}/dismiss

DELETE /notifications/{id}
```

Preferences:

```text
GET   /notification-preferences

PATCH /notification-preferences

PATCH /notification-preferences/{category}
```

Push:

```text
POST   /push-subscriptions

GET    /push-subscriptions

DELETE /push-subscriptions/{id}

POST   /push-subscriptions/test
```

Desktop:

```text
POST   /notification-devices

PATCH  /notification-devices/{id}

DELETE /notification-devices/{id}
```

---

# 73. Security Requirements

Push payloads must **never contain sensitive customer data**.

That matters especially for Tellann because your privacy spec explicitly prohibits collecting or displaying credentials, tokens, payment data and other restricted information. 

A locked Windows laptop might display:

> Payment failure caused by customer card number...

which would be disastrous.

Push payloads should contain minimal context:

```text
Good

Checkout health degraded
12 sessions affected.
```

Not:

```text
Bad

john@email.com failed payment
with card 4242...
```

---

# 74. Deep-Link Security

A push notification can contain:

```text
/applications/app_123/workflows/wf_456
```

But opening the URL must still go through:

```text
Authentication
↓
Tenant authorization
↓
RBAC
↓
Resource authorization
```

Never treat possession of the notification URL as authorization.

Your existing security architecture already requires tenant/resource ownership validation on every protected request. 

---

# 75. Notification Reliability

Because Tellann itself is a quality platform, its own alerting cannot be unreliable.

Track:

```text
notifications_created_total

notifications_sent_total

notification_delivery_failures

delivery_latency_ms

web_push_failure_rate

desktop_delivery_rate

email_delivery_rate

notification_click_rate
```

Also:

```text
suppressed_notifications

deduplicated_notifications

aggregated_notifications
```

---

# 76. Retry Policy

Delivery failures:

```text
Attempt 1
Immediate

Attempt 2
30 seconds

Attempt 3
2 minutes

Attempt 4
10 minutes

Attempt 5
30 minutes
```

Don't retry indefinitely.

For permanent errors such as:

```text
Push subscription expired
Device unregistered
Permission revoked
```

disable the endpoint automatically.

---

# 77. Recommended Priority for You

I would build this in the following order.

### Notification Foundation

```text
1. notifications table

2. notification_preferences table

3. notification_deliveries table

4. push_subscriptions table

5. Notification Service

6. notification.events Kafka topic/consumer

7. Notification Rule Engine

8. Deduplication

9. Severity handling
```

### Web Experience

```text
10. Notification Bell

11. Notification Center

12. Realtime WebSocket/SSE

13. Web Push service worker

14. Browser subscription registration

15. Deep links
```

### Desktop

```text
16. Device registration

17. Realtime desktop listener

18. Native OS notifications

19. Desktop notification preferences

20. Cross-device suppression
```

Then:

```text
21. Email

22. Webhooks

23. Digests

24. Quiet hours

25. Escalation policies
```

---

# 78. Phase Activation

Your architecture can contain the complete notification machinery now while keeping capabilities gated:

```text
                    PHASE 1   PHASE 2   PHASE 3

Analysis               ✓
Reports                ✓
Coverage               ✓
SDK                     ✓
Security                ✓
Quota                   ✓

Production health               ✓
Workflow degradation            ✓
Journey friction                ✓
Error correlation               ✓

Release regression                         ✓
Behavior anomaly                           ✓
Quality risks                              ✓
Generated tests                            ✓
Simulation                                 ✓
```

This is the cleanest approach.

---

# 79. The Core Philosophy

Tellann's notifications should answer four questions:

```text
WHAT happened?

WHERE did it happen?

WHY should I care?

WHAT should I do next?
```

So avoid:

> **Error detected**

Prefer:

> **Checkout health degraded**
> Payment errors increased 11% across 38 sessions.
> **Investigate Checkout →**

And avoid:

> **Report generated**

Prefer:

> **Checkout analysis is ready**
> Tellann found 4 workflows, 72% coverage and 6 unobserved quality paths.
> **Review analysis →**

That difference is small in implementation but enormous in product quality.

## Recommended end-state architecture

```text
                         TELLANN INTELLIGENCE
                                 │
        ┌────────────────────────┼─────────────────────────┐
        │                        │                         │
 QUALITY EVENTS           WORKFLOW EVENTS          PLATFORM EVENTS
        │                        │                         │
        └────────────────────────┼─────────────────────────┘
                                 ▼
                        Notification Rules
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
             Severity      Deduplication     Aggregation
                │                │                │
                └────────────────┼────────────────┘
                                 ▼
                        Preference Engine
                                 │
                                 ▼
                         Delivery Router
                                 │
       ┌──────────────┬──────────┼─────────┬─────────────┐
       ▼              ▼          ▼         ▼             ▼
     In-App        Web Push   Desktop    Email        Webhook
       │              │          │         │             │
       └──────────────┴──────────┼─────────┴─────────────┘
                                 ▼
                           Tellann User
```

The strongest implementation choice is therefore **one central Notification Service, one normalized notification model, multiple delivery adapters**. Do not build separate browser-notification logic, desktop-notification logic and email logic as disconnected systems. They are merely different mouths speaking from the same intelligence layer.
