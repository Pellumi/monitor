Below is the email system I would design for **Tellann / SOTS**. Treat email as a product layer, not just a notification tool. The goal is simple: move users from **signup → SDK installed → first demo → first report → habit formation → upgrade**.

## 1. Email categories

I would split all emails into **six families**:

1. **Account & security emails**
   Login, OTP, invitations, MFA, suspicious activity.

2. **Onboarding & activation emails**
   Welcome, SDK setup, first event received, demo reminder, first report ready.

3. **Product intelligence emails**
   Reports, missing flows, missing states, endpoint issues, workflow health.

4. **Team & organization emails**
   Invites, role changes, API key changes, app/environment changes.

5. **Billing & plan emails**
   Subscription changes, payment failures, usage limits, upgrade nudges.

6. **Lifecycle & education emails**
   Weekly summaries, unused feature nudges, documentation links, best practices.

Resend is a good fit because it supports API-based email sending, Node.js SDK usage, hosted templates, webhooks, idempotency keys, batch sending, and unsubscribe handling patterns. The Resend API is HTTPS-only and authenticates requests using a bearer API key. ([Resend][1]) It also supports sending with published templates, which fits your HTML-template approach. ([Resend][2])

---

# 2. Complete email breakdown

## A. Authentication & account security emails

These are **transactional** and should always be sent. Users should not be able to unsubscribe from critical security emails.

| Email                      | Trigger                              | Recipient                                      | Purpose                                      | Template                        |
| -------------------------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------- | ------------------------------- |
| Email verification / OTP   | User signs up or requests login code | User                                           | Verify ownership of email                    | `auth-otp.html`                 |
| Login code                 | Passwordless login requested         | User                                           | Let user authenticate                        | `auth-login-code.html`          |
| Welcome after verification | Email verified successfully          | User                                           | Confirm account creation and guide next step | `auth-welcome.html`             |
| Password reset             | User requests reset                  | User                                           | Reset account credential                     | `auth-password-reset.html`      |
| Password changed           | Password successfully changed        | User                                           | Security confirmation                        | `auth-password-changed.html`    |
| New device login           | Login from new device/location       | User                                           | Detect account compromise early              | `security-new-device.html`      |
| MFA enabled                | User enables MFA                     | User                                           | Confirm stronger protection                  | `security-mfa-enabled.html`     |
| MFA disabled               | User disables MFA                    | User + org admin if enterprise policy requires | Security warning                             | `security-mfa-disabled.html`    |
| Too many failed logins     | Failed-login threshold exceeded      | User                                           | Warn of possible attack                      | `security-failed-logins.html`   |
| Session revoked            | User/admin revokes active session    | User                                           | Confirm logout/revocation                    | `security-session-revoked.html` |
| Email changed              | User changes account email           | Old + new email                                | Prevent account takeover                     | `security-email-changed.html`   |

**Important implementation rule:** never include raw tokens, refresh tokens, API secrets, or sensitive telemetry in emails. Your privacy spec says passwords, tokens, secrets, payment data, medical data, and similar sensitive fields must never be collected or exposed; emails should follow the same discipline. 

---

## B. Organization, team, and access emails

These support collaboration, RBAC, and tenant safety.

| Email                 | Trigger                         | Recipient                    | Purpose                    | Template                         |
| --------------------- | ------------------------------- | ---------------------------- | -------------------------- | -------------------------------- |
| Organization created  | Org setup completed             | Org creator                  | Confirm workspace creation | `org-created.html`               |
| User invited          | Admin invites team member       | Invitee                      | Accept invite              | `team-invite.html`               |
| Invite accepted       | Invitee joins                   | Inviter/admin                | Confirm user joined        | `team-invite-accepted.html`      |
| Invite expiring       | Invite near expiry              | Invitee                      | Reduce failed onboarding   | `team-invite-expiring.html`      |
| Role changed          | Admin changes role              | Affected user                | RBAC transparency          | `team-role-changed.html`         |
| Member removed        | Admin removes user              | Removed user + admins        | Security/accountability    | `team-member-removed.html`       |
| Ownership transferred | Org owner changes               | Old owner, new owner, admins | Governance trail           | `org-owner-transfer.html`        |
| SSO configured        | Enterprise SSO setup completed  | Org admins                   | Confirm identity setup     | `enterprise-sso-configured.html` |
| SSO failure           | SSO login/config error detected | Org admins                   | Prevent lockout            | `enterprise-sso-failed.html`     |

Your security architecture already defines RBAC roles such as Organization Admin, Engineering Manager, QA Engineer, Developer, and Product Manager, with different permissions for billing, reports, replay, users, API keys, and intelligence features.  So every access-related email should say **what changed**, **who changed it**, and **where to review it**.

---

## C. Onboarding and activation emails

These are the most important emails commercially. They should pull the user toward the “aha” moment.

| Email                         | Trigger                                | Recipient       | Purpose                                          | Template                         |
| ----------------------------- | -------------------------------------- | --------------- | ------------------------------------------------ | -------------------------------- |
| Welcome to Tellann            | User verifies account                  | User            | Show the 3-step path                             | `onboarding-welcome.html`        |
| Create your first application | No app created within 1 hour/day       | User            | Push toward setup                                | `onboarding-create-app.html`     |
| Application created           | App created                            | Creator         | Confirm and show SDK install                     | `app-created.html`               |
| Environment created           | Dev/staging/prod env created           | Creator/admin   | Confirm environment setup                        | `environment-created.html`       |
| API key generated             | API key created                        | Creator/admin   | Show next SDK step, not raw key after first view | `api-key-created.html`           |
| SDK setup guide               | API key created but no events received | Developer       | Help integration                                 | `sdk-install-guide.html`         |
| First event received          | First telemetry event ingested         | Developer/admin | Celebrate progress; next step: demo              | `sdk-first-event.html`           |
| SDK inactive warning          | App created but no events after X days | Developer/admin | Recover stalled onboarding                       | `sdk-no-events.html`             |
| Start your first demo         | SDK active but no demo session         | Developer/QA    | Move user to value                               | `demo-start-reminder.html`       |
| First demonstration completed | Demo stopped successfully              | Developer/QA    | Tell them analysis is running                    | `demo-completed-processing.html` |
| First report ready            | QA analysis completed                  | Developer/QA/PM | Deliver value                                    | `report-first-ready.html`        |

This matches your MVP flow: **Deploy app → Install SDK → Configure application → Start demo recording → Walk through app → Receive analysis**. 

---

## D. Developer Demonstration Mode emails

These emails should be precise, almost like flight instruments. They guide the user through teaching Tellann how the application behaves.

| Email                        | Trigger                                 | Recipient                | Purpose                     | Template                    |
| ---------------------------- | --------------------------------------- | ------------------------ | --------------------------- | --------------------------- |
| Demo session started         | `DEMONSTRATION_STARTED`                 | User who started demo    | Confirm capture is active   | `demo-started.html`         |
| Demo session stopped         | `DEMONSTRATION_STOPPED`                 | User                     | Confirm recording ended     | `demo-stopped.html`         |
| Demo processing started      | Analysis job queued                     | User                     | Set expectation             | `demo-processing.html`      |
| Demo analysis failed         | Job failed                              | User + developer/admin   | Recovery path               | `demo-analysis-failed.html` |
| Demo QA report ready         | Report generated                        | User + selected watchers | Core value delivery         | `demo-report-ready.html`    |
| Low coverage warning         | Coverage below threshold                | QA/developer             | Encourage another demo pass | `demo-low-coverage.html`    |
| Missing critical flows found | Missing failure/recovery paths detected | QA/developer/PM          | Drive action                | `demo-missing-flows.html`   |
| Missing states found         | Loading/empty/error states missing      | QA/developer             | Drive UI-quality work       | `demo-missing-states.html`  |
| Endpoint issue found         | Slow/error-prone API detected           | Developer                | Drive backend fix           | `demo-endpoint-issue.html`  |

The email body should never be a giant report. It should summarize the sharp edges: **coverage %, workflows discovered, missing flows, missing states, slow endpoints, and CTA to open report**. Your DDM spec says the demonstration QA report includes executive summary, quality score, coverage score, workflow count, workflow coverage, missing flows, missing states, endpoint analysis, and recommendations. 

---

## E. QA report and export emails

Your report system is central. Reports are the “voice” of the product.

| Email                     | Trigger                           | Recipient          | Purpose                    | Template                     |
| ------------------------- | --------------------------------- | ------------------ | -------------------------- | ---------------------------- |
| Report generated          | Any report completes              | Requester/watchers | Notify report availability | `report-generated.html`      |
| Report generation failed  | Report job fails                  | Requester          | Recovery action            | `report-failed.html`         |
| Export ready              | PDF/CSV/JSON/HTML export complete | Requester          | Download artifact          | `report-export-ready.html`   |
| Export failed             | Export job fails                  | Requester          | Retry path                 | `report-export-failed.html`  |
| Report shared with you    | User shares report                | Recipient          | Collaboration              | `report-shared.html`         |
| Weekly QA summary         | Weekly schedule                   | Opted-in users     | Habit formation            | `digest-weekly-quality.html` |
| Monthly executive summary | Monthly schedule                  | Managers/admins    | Leadership visibility      | `digest-monthly-exec.html`   |

Your QRS defines reports across executive quality, flow coverage, workflow, behavioral graph, missing flow, missing state, session analysis, endpoint intelligence, error, journey, database, release, regression, generated test, anomaly, and quality intelligence reports.  For MVP, keep weekly digest limited to **Executive Quality, Flow Coverage, Behavioral Graph, Missing Flow, Missing State, Session Analysis, and Endpoint Intelligence**, because those are Phase 1 reports. 

---

## F. Session replay emails

Session replay is powerful but sensitive. Use these carefully.

| Email                       | Trigger                   | Recipient            | Purpose               | Template               |
| --------------------------- | ------------------------- | -------------------- | --------------------- | ---------------------- |
| Replay ready                | Replay timeline generated | Demo owner/QA        | Open replay           | `replay-ready.html`    |
| Replay generation failed    | Replay job fails          | Demo owner/developer | Retry/debug           | `replay-failed.html`   |
| Replay shared               | User shares replay        | Recipient            | Collaboration         | `replay-shared.html`   |
| Replay retention expiring   | Replay near deletion date | Admin/demo owner     | Save/export if needed | `replay-expiring.html` |
| Replay accessed by new user | Sensitive replay viewed   | Admin/security owner | Audit awareness       | `replay-accessed.html` |

Do not send replay screenshots or sensitive captured data in the email. Send metadata only: app name, session duration, event count, workflows, error count, and dashboard link. Your privacy rules require session replay to mask or block sensitive fields such as passwords, credit cards, authentication tokens, and secrets. 

---

## G. Application, environment, and API key emails

These are operational emails. They prevent silent misconfiguration.

| Email                      | Trigger                       | Recipient         | Purpose                          | Template                     |
| -------------------------- | ----------------------------- | ----------------- | -------------------------------- | ---------------------------- |
| Application archived       | App archived                  | Admins/developers | Confirm removal from active view | `app-archived.html`          |
| Environment connected      | Env receives first event      | Developers/admins | Confirm telemetry path           | `environment-connected.html` |
| Environment inactive       | Env has no events for X days  | Developers/admins | Catch broken SDK/integration     | `environment-inactive.html`  |
| API key created            | New key generated             | Creator/admins    | Audit and next step              | `api-key-created.html`       |
| API key rotated            | Key rotated                   | Admins/developers | Update SDK/config                | `api-key-rotated.html`       |
| API key revoked            | Key revoked                   | Admins/developers | Confirm access removed           | `api-key-revoked.html`       |
| API key expiring           | Key near expiry               | Admins/developers | Prevent ingestion outage         | `api-key-expiring.html`      |
| Invalid API key traffic    | Ingestion rejects invalid key | Admins/developers | Detect wrong config or abuse     | `api-key-invalid-usage.html` |
| Schema validation failures | Events rejected repeatedly    | Developers        | Fix SDK/custom event payloads    | `events-schema-errors.html`  |

Your API spec includes authentication, organizations, users, API keys, applications, telemetry ingestion, sessions, demonstrations, graphs, coverage, missing states, endpoints, reports, notifications, privacy/retention, and admin APIs.  This email group should mirror those lifecycle events.

---

## H. Workflow, coverage, endpoint, and quality emails

These are product-value emails. They are the ones users will remember.

| Email                          | Trigger                                    | Recipient      | Purpose                | Template                         |
| ------------------------------ | ------------------------------------------ | -------------- | ---------------------- | -------------------------------- |
| Coverage improved              | Coverage crosses configured target         | QA/dev/manager | Positive reinforcement | `coverage-improved.html`         |
| Coverage degraded              | Coverage drops versus previous report      | QA/dev/manager | Investigation          | `coverage-degraded.html`         |
| Critical missing flow detected | Missing high-risk workflow path            | QA/dev/PM      | Actionable QA work     | `missing-critical-flow.html`     |
| Missing state detected         | Missing loading/empty/error/recovery state | QA/dev         | Improve UX resilience  | `missing-state-detected.html`    |
| Slow endpoint detected         | Endpoint exceeds threshold                 | Developer      | Performance fix        | `endpoint-slow.html`             |
| Endpoint error spike           | Error rate exceeds threshold               | Developer      | Stability fix          | `endpoint-error-spike.html`      |
| Broken/unused endpoint found   | Endpoint appears unused or failing         | Developer      | Clean up/improve       | `endpoint-unused-or-broken.html` |
| Quality score changed          | Score moves significantly                  | Manager/QA     | Track trend            | `quality-score-changed.html`     |

Your event taxonomy already includes quality events such as `COVERAGE_CALCULATED`, `COVERAGE_DEGRADED`, `QUALITY_RISK_IDENTIFIED`, `ENDPOINT_HEALTH_CHANGED`, and `REPORT_GENERATED`, which are natural triggers for these emails. 

---

## I. Production Intelligence emails — Phase 2

Do **not** overbuild these in the MVP. Define them now, implement later.

| Email                             | Trigger                               | Recipient          | Purpose                 | Template                         |
| --------------------------------- | ------------------------------------- | ------------------ | ----------------------- | -------------------------------- |
| Production monitoring enabled     | Live env connected                    | Admin/dev/manager  | Confirm Phase 2 setup   | `production-enabled.html`        |
| Workflow degradation alert        | Workflow health drops                 | Dev/QA/manager     | Early warning           | `workflow-degraded.html`         |
| Abandonment spike                 | Journey abandonment rises             | PM/manager/QA      | Product-quality insight | `journey-abandonment-spike.html` |
| Friction detected                 | Repetitive actions/bottleneck found   | PM/QA              | UX investigation        | `journey-friction.html`          |
| Error investigation package ready | Error correlated with replay/API/logs | Developer          | Faster debugging        | `error-investigation-ready.html` |
| Database recommendation           | Slow query/index issue found          | Developer/DB owner | Optimization            | `database-recommendation.html`   |
| Production weekly health digest   | Weekly schedule                       | Managers/admins    | Operational rhythm      | `digest-production-health.html`  |

The PRD says Phase 2 introduces live production monitoring, user journey analytics, endpoint intelligence, database intelligence, and error correlation.  The component design also defines the Notification Service as responsible for workflow degradation alerts, anomaly alerts, report notifications, and release regression alerts across email, webhooks, and in-app notifications. 

---

## J. Autonomous Validation emails — Phase 3

These are future-facing. Keep them out of MVP except as placeholders in your notification taxonomy.

| Email                       | Trigger                               | Recipient          | Purpose                     | Template                           |
| --------------------------- | ------------------------------------- | ------------------ | --------------------------- | ---------------------------------- |
| Release validation complete | Release comparison finishes           | Dev/QA/manager     | Release confidence          | `release-validation-complete.html` |
| Regression detected         | Behavior differs from baseline        | Dev/QA/manager     | Block risky release         | `regression-detected.html`         |
| Generated tests ready       | Test suite generated                  | QA/dev             | Convert behavior into tests | `tests-generated.html`             |
| Failure simulation complete | Simulation result ready               | Dev/QA             | Resilience assessment       | `simulation-complete.html`         |
| Behavioral anomaly detected | Anomaly engine detects drift/spike    | Dev/QA/manager     | Investigate quality drift   | `anomaly-detected.html`            |
| Quality assessment ready    | Quality intelligence report generated | Manager/QA/dev     | Strategic quality view      | `quality-assessment-ready.html`    |
| Recommendation created      | New corrective action generated       | Assigned user/team | Drive action                | `recommendation-created.html`      |

The API spec places release validation, test generation, regression detection, failure simulation, optimization intelligence, behavioral anomaly detection, and the quality intelligence assistant in Phase 3. 

---

## K. Billing, subscription, and usage emails

These should be clean, direct, and boring. Billing emails are not a place for poetry.

| Email                     | Trigger                          | Recipient           | Purpose                      | Template                          |
| ------------------------- | -------------------------------- | ------------------- | ---------------------------- | --------------------------------- |
| Plan activated            | User starts Free/Solo/Team/etc.  | Billing owner/admin | Confirm plan                 | `billing-plan-activated.html`     |
| Trial started             | Trial begins                     | Billing owner       | Explain limits and end date  | `billing-trial-started.html`      |
| Trial ending              | Trial near end                   | Billing owner/admin | Convert                      | `billing-trial-ending.html`       |
| Subscription upgraded     | Plan upgraded                    | Billing owner/admin | Confirm entitlements         | `billing-upgraded.html`           |
| Subscription downgraded   | Plan downgraded                  | Billing owner/admin | Confirm feature changes      | `billing-downgraded.html`         |
| Payment succeeded         | Invoice paid                     | Billing owner       | Receipt                      | `billing-payment-success.html`    |
| Payment failed            | Payment fails                    | Billing owner/admin | Prevent account interruption | `billing-payment-failed.html`     |
| Invoice available         | Invoice generated                | Billing owner       | Finance record               | `billing-invoice.html`            |
| Usage limit warning       | 80%, 90%, 100% of limit          | Admin/billing owner | Avoid surprise block         | `billing-usage-warning.html`      |
| Storage retention warning | Replay/report storage near limit | Admin               | Prompt cleanup/upgrade       | `billing-storage-warning.html`    |
| Upgrade recommendation    | User hits plan constraint        | Admin/billing owner | Natural expansion            | `billing-upgrade-suggestion.html` |

Your packaging spec has Free, Local, Solo, Team, Business, and Enterprise plans, with limits around applications, users, storage, retention, reports, exports, team collaboration, API access, audit logs, SSO, and self-hosting. Local is Nigeria-only and NGN-only. Those limits should drive usage-warning and upgrade emails.

---

## L. Privacy, compliance, and audit emails

These matter for enterprise trust.

| Email                    | Trigger                   | Recipient            | Purpose                      | Template                        |
| ------------------------ | ------------------------- | -------------------- | ---------------------------- | ------------------------------- |
| Privacy rule created     | New privacy rule added    | Admin/security owner | Audit privacy config         | `privacy-rule-created.html`     |
| Privacy rule changed     | Existing rule edited      | Admin/security owner | Prevent silent privacy drift | `privacy-rule-updated.html`     |
| Retention policy changed | Retention setting changed | Admin/security owner | Compliance visibility        | `retention-policy-updated.html` |
| Data export requested    | User requests export      | Requester/admin      | Confirm processing           | `data-export-requested.html`    |
| Data export ready        | Export complete           | Requester            | Download link                | `data-export-ready.html`        |
| Data deletion requested  | Deletion request created  | Admin/requester      | Compliance trail             | `data-deletion-requested.html`  |
| Data deletion completed  | Deletion complete         | Admin/requester      | Confirmation                 | `data-deletion-complete.html`   |
| Audit log export ready   | Audit export generated    | Admin/security owner | Governance                   | `audit-export-ready.html`       |

Your privacy specification requires customer-defined retention policies, data deletion requests, data export requests, auditability of privacy actions, and privacy rule customization. 

---

# 3. Email preference model

Use this preference structure:

```ts
type EmailCategory =
  | "SECURITY"
  | "ACCOUNT"
  | "ONBOARDING"
  | "REPORTS"
  | "ALERTS"
  | "BILLING"
  | "TEAM"
  | "DIGEST"
  | "PRODUCT_EDUCATION"
  | "COMPLIANCE";

type DeliveryChannel = "EMAIL" | "IN_APP" | "WEBHOOK";

type NotificationPreference = {
  userId: string;
  organizationId: string;
  category: EmailCategory;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  frequency: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST" | "NEVER";
};
```

Recommended default:

| Category          | Default                           |
| ----------------- | --------------------------------- |
| Security          | Always on                         |
| Billing           | Always on for billing owner/admin |
| Compliance        | Always on for admins              |
| Onboarding        | On                                |
| Reports           | On                                |
| Alerts            | On for relevant roles             |
| Digests           | Weekly on                         |
| Product education | On, unsubscribe allowed           |

For marketing, education, newsletters, and non-critical lifecycle emails, include unsubscribe controls. For transactional emails, use preference controls but do not allow users to disable critical security/billing/compliance messages. Resend documents support for unsubscribe patterns, including using `List-Unsubscribe` headers for transactional-style emails when you manage your own list. ([Resend][3])

---

# 4. Template naming convention

Use stable template keys. Do not name templates by subject line.

```txt
auth-otp
auth-login-code
auth-password-reset
security-new-device
org-created
team-invite
app-created
api-key-created
sdk-install-guide
sdk-first-event
demo-report-ready
report-generated
report-export-ready
coverage-degraded
missing-critical-flow
endpoint-slow
workflow-degraded
regression-detected
billing-payment-failed
privacy-rule-updated
digest-weekly-quality
```

Each template should have:

```ts
type EmailTemplate = {
  key: string;
  category: EmailCategory;
  subject: string;
  preheader: string;
  htmlTemplatePath: string;
  textTemplatePath: string;
  requiredVariables: string[];
  defaultFrom: string;
  replyTo?: string;
};
```

---

# 5. Suggested sender addresses

Use different sender identities for trust and filtering:

| Sender                                   | Use                                   |
| ---------------------------------------- | ------------------------------------- |
| `Tellann <hello@tellann.co>`             | Welcome, onboarding                   |
| `Tellann Security <security@tellann.co>` | OTP, login, MFA, suspicious activity  |
| `Tellann Reports <reports@tellann.co>`   | QA reports, exports, summaries        |
| `Tellann Alerts <alerts@tellann.co>`     | Workflow degradation, endpoint alerts |
| `Tellann Billing <billing@tellann.co>`   | invoices, plan, payment               |
| `Tellann Support <support@tellann.co>`   | human support threads                 |

Do not send everything from `no-reply`. It feels cold. Use `no-reply` only where replies are useless.

---

# 6. Sending architecture with Resend

Recommended flow:

```txt
Domain Event
  ↓
Notification Service
  ↓
Preference Resolver
  ↓
Template Renderer
  ↓
Email Queue
  ↓
Resend Provider
  ↓
Webhook Handler
  ↓
Delivery Status Store
```

The Notification Service already belongs in your component design and supports email, webhooks, and in-app notifications.  Use Resend as the email provider, but keep a provider abstraction so you are not permanently locked in.

Resend supports Node.js SDK sending, and its docs require an API key and a verified domain before sending properly. ([Resend][4]) Resend also supports webhooks for delivery/subscription events, so you can store statuses like sent, delivered, bounced, complained, opened, and clicked depending on the events you enable. ([Resend][5])

---

# 7. Minimal database tables

Add these tables or equivalent Prisma models:

```txt
EmailTemplate
- id
- key
- category
- subject
- preheader
- htmlPath
- textPath
- version
- isActive
- createdAt
- updatedAt

NotificationPreference
- id
- userId
- organizationId
- category
- emailEnabled
- inAppEnabled
- webhookEnabled
- frequency
- createdAt
- updatedAt

NotificationEvent
- id
- organizationId
- applicationId nullable
- eventType
- severity
- payload jsonb
- status
- createdAt

EmailDelivery
- id
- notificationEventId
- userId
- toEmail
- templateKey
- provider
- providerMessageId
- idempotencyKey
- status
- error
- sentAt
- deliveredAt
- openedAt
- clickedAt
- bouncedAt

EmailSuppression
- id
- email
- reason
- category
- createdAt
```

Use `idempotencyKey = organizationId + eventType + resourceId + recipientId + templateKey` for emails that must not duplicate. Resend supports idempotency keys to ensure the same email request is processed only once when retried. ([Resend][6])

---

# 8. Resend sending example

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) {
  return resend.emails.send(
    {
      from: "Tellann Reports <reports@tellann.co>",
      to,
      subject,
      html,
      text,
      headers: {
        "X-Tellann-Notification": "true",
      },
    },
    {
      idempotencyKey,
    }
  );
}
```

For batch notifications such as weekly digests or report-ready notifications to multiple watchers, use batch sending where appropriate. Resend documents batch sending as a way to send up to 100 emails in one API call. ([Resend][7])

---

# 9. Template variable examples

## `demo-report-ready`

```ts
{
  userName: "Philip",
  applicationName: "Acadai LMS",
  environmentName: "staging",
  demoName: "Checkout Validation",
  workflowsDiscovered: 7,
  coverageScore: 72,
  missingFlowCount: 5,
  missingStateCount: 3,
  slowEndpointCount: 2,
  reportUrl: "https://app.tellann.co/reports/...",
  dashboardUrl: "https://app.tellann.co/apps/..."
}
```

## `workflow-degraded`

```ts
{
  applicationName: "Acadai LMS",
  workflowName: "Student Quiz Submission",
  previousHealth: 96,
  currentHealth: 78,
  severity: "HIGH",
  affectedSessions: 42,
  topSignal: "API error rate increased",
  investigationUrl: "https://app.tellann.co/workflows/..."
}
```

## `api-key-expiring`

```ts
{
  applicationName: "Acadai LMS",
  environmentName: "production",
  keyName: "Production SDK Key",
  expiresAt: "2026-07-21",
  rotateUrl: "https://app.tellann.co/settings/api-keys"
}
```

---

# 10. Email design rules

Every email should have this structure:

```txt
Subject:
Clear result or required action.

Preheader:
One sentence explaining why it matters.

Header:
Tellann logo + category label.

Body:
What happened.
Why it matters.
What to do next.

Primary CTA:
Open report / Fix SDK / View replay / Rotate key / Review billing.

Secondary CTA:
Docs link or settings link.

Footer:
Organization name, app name, notification preferences, legal address.
```

Example subject lines:

```txt
Your first QA report is ready
Checkout coverage dropped to 62%
Payment failure flow is missing from your demo
Tellann received your first SDK event
Your production API key expires in 7 days
Weekly quality summary for Acadai LMS
```

Avoid vague subjects like:

```txt
Important update
Action required
System notification
```

They are dead leaves in the inbox.

---

# 11. MVP email set to build first

Do **not** build all emails immediately. For MVP, build only these:

1. `auth-otp`
2. `auth-welcome`
3. `team-invite`
4. `org-created`
5. `app-created`
6. `api-key-created`
7. `sdk-install-guide`
8. `sdk-first-event`
9. `demo-start-reminder`
10. `demo-completed-processing`
11. `demo-report-ready`
12. `report-export-ready`
13. `demo-analysis-failed`
14. `coverage-degraded`
15. `missing-critical-flow`
16. `endpoint-slow`
17. `billing-payment-failed`
18. `usage-limit-warning`
19. `security-new-device`
20. `privacy-rule-updated`

That is enough to support onboarding, activation, reporting, alerts, billing, and trust without drowning users.

---

# 12. Hard rule

Never let email become noise. For Tellann, the strongest emails should feel like this:

> “Your software just revealed something important.”

Everything else should be suppressed, digested, or moved in-app.

[1]: https://resend.com/docs/api-reference/introduction?utm_source=chatgpt.com "Introduction"
[2]: https://resend.com/docs/api-reference/emails/send-email?utm_source=chatgpt.com "Send Email"
[3]: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails?utm_source=chatgpt.com "Add an unsubscribe link to transactional emails"
[4]: https://resend.com/docs/send-with-nodejs?utm_source=chatgpt.com "Send emails with Node.js"
[5]: https://resend.com/docs/webhooks/introduction?utm_source=chatgpt.com "Managing Webhooks"
[6]: https://resend.com/docs/dashboard/emails/idempotency-keys?utm_source=chatgpt.com "Idempotency Keys"
[7]: https://resend.com/docs/dashboard/emails/batch-sending?utm_source=chatgpt.com "Batch Sending"
