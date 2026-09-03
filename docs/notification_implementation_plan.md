# Tellann Notifications Implementation Plan

## Summary

Replace the current email-derived, polling-only implementation with one centralized notification pipeline that creates a single logical notification and delivers it through in-app, browser push, desktop native, email, and webhook adapters according to user preferences.

Current findings:

- Dashboard notifications are derived from organization-wide `NotificationEvent` email records and polled every 60 seconds.
- Browser alerts use foreground-only `new Notification(...)`; there is no service worker, Push API subscription, VAPID delivery, or background Web Push.
- Read state is a local timestamp keyed only by organization, so it is neither user-specific nor synchronized across logins, tabs, browsers, or devices.
- Opening the bell marks every item read immediately; individual read, dismiss, detail, action, pagination, and server-side unread counts do not exist.
- Events are created inside the email service, sometimes once per recipient, which can duplicate logical notifications and means events without an email template cannot appear.
- Some desktop QA events write incompatible payloads without template keys and are silently excluded from the dashboard feed.
- Desktop has no notification API, IPC bridge, native Electron notification adapter, realtime listener, device presence, preferences, or deep-link handling for notifications.
- Existing notification preferences cover email, in-app, webhook, and digest frequency only; browser push and desktop delivery are not modeled.
- Phase 1 will cover the current account, application, SDK, asynchronous analysis/QA, report, coverage, endpoint, quota, billing, and security events. Production-health and release-intelligence event families remain feature-gated.
- Desktop native notifications are required while Tellann Desktop is running, including minimized or unfocused. True delivery after the process has exited is deferred.

## Implementation Changes

### 1. Central notification domain and persistence

- Introduce a shared notification contract containing:
  - Stable notification type and category enums.
  - `INFO | LOW | MEDIUM | HIGH | CRITICAL` severity.
  - Safe title, message, deep link, source event identity, application/workflow/report/run references, metadata, dedupe key, group key, timestamps, and expiry.
  - Channel and delivery-status enums.
- Replace email-owned creation with a central notification orchestrator:
  - Producers submit one normalized notification request per business event.
  - The orchestrator resolves authorized recipients, preferences, severity, role targeting, cooldowns, aggregation, and channel routing.
  - Email becomes one delivery adapter instead of the owner of the notification record.
  - Keep a compatibility wrapper around current `NotificationEmailService` call sites during migration so email behavior is not interrupted.
- Add or reshape persistence into:
  - `Notification`: one logical event, scoped to its organization and optional application/resource.
  - `UserNotification`: per-recipient state including delivered-to-feed, read, dismissed, actioned, and expiry timestamps.
  - `NotificationDelivery`: one recipient/channel attempt with status, attempts, provider identifier, timestamps, and sanitized failure code.
  - `NotificationPreference`: per user, organization, and category settings for in-app, Web Push, desktop, email, webhook, minimum severity, digest, and quiet hours.
  - `PushSubscription`: encrypted endpoint/key material, browser/device identity, enabled state, failure count, and last-seen timestamp.
  - `NotificationDevice`: desktop installation identity, platform/version, enabled state, presence, and last-seen timestamp.
- Backfill existing `NotificationEvent` records into logical notifications and recipient rows only where recipient authorization can be established. Do not replay migrated history as unread or external push.
- Retain existing email delivery history and link new email deliveries to the central notification. Remove the legacy event model only after all producers and digest workers use the new contract.

### 2. Notification service, routing, and producers

- Add a dedicated notification service/worker behind the gateway:
  - Accept authenticated internal notification requests with source-event idempotency.
  - Persist notification and recipients transactionally before asynchronous channel delivery.
  - Provide bounded retries at immediate, 30-second, 2-minute, 10-minute, and 30-minute intervals.
  - Disable permanently invalid push subscriptions automatically.
  - Record skipped/suppressed delivery reasons rather than silently dropping them.
- Use a queue/topic abstraction for `notification.events`; connect it to the repository’s production event infrastructure when available while retaining a database-backed local/test transport.
- Apply cross-channel policy:
  - In-app feed is the baseline for supported Phase 1 events.
  - Foreground browser users receive an accessible in-app toast; the service worker suppresses redundant OS push when a visible dashboard client is active.
  - Running desktop clients receive native notifications only while minimized, hidden, or unfocused; active desktop users receive an in-app alert instead.
  - Web Push is used when no visible dashboard client is active.
  - Email remains enabled according to category requirements and existing preferences.
  - `INFO` and routine success events default to in-app only unless they represent completion of a user-started asynchronous operation.
  - `HIGH` and `CRITICAL` events may use push and email; locked security, billing, and compliance email behavior remains intact.
- Migrate existing producers and add missing Phase 1 producers for:
  - Organization/application creation, invitations, membership/account changes, API keys, SDK connection and failures.
  - Demonstration processing/analysis, QA run completion/failure, graph generation, report/export readiness, and background tasks initiated by the user.
  - Coverage degradation, missing critical flows/states, endpoint problems, quota/plan thresholds, billing events, and security alerts.
- Every producer must supply safe user-facing copy, an authorized deep link, recipient/role policy, severity, source identity, and dedupe key. Raw telemetry and routine processing steps must not generate notifications.
- Aggregate related findings, enforce cooldowns, and emit recovery notifications for state transitions instead of repeatedly alerting on unchanged conditions.

### 3. Public APIs and security

Expose authenticated, organization-scoped APIs through the gateway:

- `GET /organizations/:orgId/notifications` with cursor pagination, filters, and authoritative unread count.
- `GET /organizations/:orgId/notifications/:id`.
- `PATCH /organizations/:orgId/notifications/:id/read`.
- `POST /organizations/:orgId/notifications/read-all`.
- `PATCH /organizations/:orgId/notifications/:id/dismiss`.
- `POST /organizations/:orgId/notifications/:id/action`.
- `GET/PATCH /organizations/:orgId/notification-preferences`.
- `POST/GET/DELETE /organizations/:orgId/push-subscriptions`.
- `POST /organizations/:orgId/push-subscriptions/test`.
- `POST/PATCH/DELETE /organizations/:orgId/notification-devices`.
- `GET /organizations/:orgId/notification-stream` as an authenticated SSE stream with reconnect cursor/heartbeat support.

API guarantees:

- Return only the current user’s recipient records; organization membership alone must never expose another recipient’s notification.
- Validate membership, tenant ownership, role, and resource authorization again when a deep link is opened.
- Never include secrets, customer PII, credentials, payment details, or raw captured session data in push/native payloads.
- Use opaque notification IDs and relative allow-listed deep links.
- Make creation and channel delivery idempotent independently.
- Expose VAPID public configuration only; keep private keys and stored subscription secrets server-side and encrypted.
- Add environment validation for VAPID subject/public/private keys and notification worker configuration.

### 4. Dashboard experience and Web Push

- Replace the localStorage timestamp with server-owned read state. Scope all query keys and transient client state by both user and organization, and clear notification query data when the authenticated identity changes.
- Subscribe through SSE while authenticated, with a lightweight periodic reconciliation poll only as recovery for missed events.
- Update the bell and notification center to support:
  - Server-provided unread count.
  - All, unread, and critical filters.
  - Individual read/dismiss behavior and explicit “Mark all read.”
  - Pagination, loading, empty, offline, reconnecting, and retry states.
  - Severity, application context, time, and safe deep-link actions.
  - Accessible foreground toast announcements that do not mark an item read automatically.
- Do not mark notifications read merely because the dropdown opened; mark them after an explicit action or when an individual notification/detail is intentionally viewed.
- Add a same-origin service worker that:
  - Receives Web Push while the dashboard is closed.
  - Validates and displays minimal payloads using notification ID tags.
  - Suppresses OS display when a visible Tellann client already handled the event.
  - Focuses an existing client or opens the safe deep link on click.
  - Reports click/close interaction and handles subscription changes.
- The settings page must:
  - Explain the distinction between in-app and browser push.
  - Request permission only after the user presses Enable.
  - Register and persist the resulting `PushSubscription`.
  - Show the current browser/device, blocked/unsupported/stale states, disable/re-enable controls, and a test-notification action.
  - Add per-category channel choices, severity threshold, digest settings, quiet hours, and critical quiet-hour override.
- Register/unregister subscriptions on permission changes and logout without deleting notification/read history.

### 5. Desktop experience

- Add notification methods to the desktop cloud client, shared desktop contracts, preload bridge, and renderer typings for feed retrieval, read/dismiss/action, preferences, device registration, presence, and stream lifecycle.
- In the Electron main process:
  - Register a stable installation-specific device after authentication and revoke/disable it on explicit sign-out.
  - Maintain the authenticated SSE connection with exponential reconnect and last-event cursor recovery.
  - Use Electron’s native `Notification` API with the packaged application icon and stable AppUserModelID.
  - Display native notifications only when the main window is not focused; use renderer alerts while focused.
  - On click, restore/focus the existing window and navigate through a validated internal notification route.
  - Stop listeners and clear user-scoped transient state on sign-out; re-register cleanly on account change.
- Add a desktop notification center/badge using the same server data and read semantics as the dashboard.
- Surface notification preferences in the desktop UI, including desktop enablement, severity threshold, quiet hours, and a native test notification.
- Emit immediate local completion/failure alerts for desktop-managed long-running tasks only after the cloud notification has been durably created; use the notification ID as the native tag so subsequent stream delivery cannot duplicate it.
- Keep the application process running behavior unchanged. Closed-process WNS/APNs/background-agent delivery is explicitly excluded from Phase 1.

### 6. Reliability, rollout, and observability

- Add metrics for created, queued, sent, failed, skipped, suppressed, deduplicated, aggregated, and clicked notifications; channel failure rate and delivery latency; active subscriptions/devices; SSE connections and reconnects.
- Add structured logs keyed by notification, source event, recipient, delivery, and correlation IDs without logging endpoint secrets or payload-sensitive metadata.
- Roll out behind independent flags for the central pipeline, SSE, Web Push, and desktop native delivery.
- Initially dual-record legacy email events and new notifications while only the legacy email path sends externally; compare counts and recipient resolution.
- Then enable in-app/SSE, migrate read state, enable Web Push for test users, enable running-desktop native notifications, and finally switch email creation to the centralized router.
- Provide an operator checklist covering database migration, worker deployment, gateway routes, HTTPS/service-worker scope, VAPID key provisioning, notification icons, desktop signing/AppUserModelID, metrics, and rollback flags.

## Test Plan

- Database and service tests:
  - One source event creates one notification and the correct authorized recipient rows.
  - Multiple email recipients do not create duplicate logical notifications.
  - Dedupe, aggregation, cooldown, recovery, preference, severity, quiet-hour, expiry, and retry behavior.
  - Invalid subscriptions are disabled and permanent errors are not retried.
  - Cross-tenant and unauthorized resource access returns no notification data.
  - Legacy events backfill as read and never trigger external delivery.
- API tests:
  - Cursor pagination and unread counts remain stable under concurrent creation/read operations.
  - Individual read, mark-all-read, dismiss, action, preference, device, and subscription operations are idempotent.
  - SSE reconnect with `Last-Event-ID` neither loses nor duplicates events.
  - Logout invalidates the stream but preserves server-side read state.
- Dashboard tests:
  - Granting permission creates a server subscription and the test endpoint produces an OS notification.
  - Push arrives with the page closed; a visible page receives one toast without duplicate OS push.
  - Clicking a notification authenticates and opens only an authorized deep link.
  - Read badges remain cleared after logout/login, refresh, another tab, and another browser.
  - Switching users or organizations never leaks cached notifications or read state.
  - Denied, revoked, unsupported, offline, expired-subscription, and service-worker-update states are understandable and recoverable.
- Desktop tests:
  - Focused window produces an in-app alert; minimized/background window produces one native OS notification.
  - Clicking restores/focuses the existing single instance and navigates correctly.
  - Stream reconnect and a locally completed task do not produce duplicates.
  - Sign-out stops delivery; a different signed-in user cannot see the previous user’s data.
  - Windows packaged build displays Tellann identity/icon correctly; macOS/Linux behavior is validated where release targets exist.
  - Fully exited desktop receives no notification in Phase 1.
- End-to-end acceptance:
  - Trigger representative app-created, async-analysis-completed, report-ready, coverage-degraded, quota, billing, and security events.
  - Confirm notification record, recipient state, delivery records, dashboard feed/toast, closed-page Web Push, running-desktop native notification, email behavior, deep link, read synchronization, metrics, and sanitized logs.
  - Run focused service tests, Prisma validation/migration checks, dashboard lint/typecheck/build, desktop renderer/main typecheck/build, browser service-worker tests over HTTPS or localhost, and packaged native smoke tests.

## Assumptions

- Phase 1 builds the extensible architecture but activates only the selected Phase 1 event families.
- Browser delivery means standards-based Web Push, not foreground `new Notification(...)` polling.
- Desktop Phase 1 supports running, minimized, hidden, or unfocused instances; fully terminated application delivery is deferred.
- Server-side per-user state is authoritative; local storage may cache UI state but cannot define unread status.
- Existing uncommitted dashboard, schema, email, gateway, and onboarding changes must be preserved and reconciled during implementation.
- SSE is the realtime transport for dashboard and desktop because delivery is server-to-client and does not require a bidirectional socket.
