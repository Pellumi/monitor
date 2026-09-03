# Notifications — operator checklist & rollout

Companion to `notification_implementation_plan.md`. Covers what an operator does to
turn the central notification pipeline on, and how to roll it back.

## What shipped

| Area | Where |
| --- | --- |
| Domain models | `packages/db/prisma/schema.prisma` — `Notification`, `UserNotification`, `NotificationDelivery`, `PushSubscription`, `NotificationDevice`; `NotificationPreference` gains `webPushEnabled`, `desktopEnabled`, `minSeverity`, quiet-hours fields |
| Migration | `packages/db/prisma/migrations/20260903140000_central_notification_pipeline/migration.sql` (idempotent, additive) |
| Orchestrator | `packages/email/src/orchestrator.ts` — `NotificationOrchestrator.createNotification()` |
| Web Push adapter | `packages/email/src/web-push.ts` (`web-push` dependency) |
| Compatibility shim | `NotificationEmailService.sendTransactional` / `sendToOrganizationMembers` now also create one central `Notification` + per-recipient feed rows. No producer change required for in-app delivery. |
| Producer API | `POST /internal/notifications` (onboarding-api) |
| User API | `services/onboarding-api/src/notification-routes.ts` — feed, read/read-all/dismiss/action, push-subscriptions, notification-devices, SSE stream, `GET …/push-config` |
| Dashboard | `notifications-provider.tsx` (server read state + SSE + reconciliation poll), `notification-bell.tsx` (center: filters, per-item read/dismiss, pagination), `notification-toaster.tsx`, `lib/push-manager.ts`, `public/sw.js`, settings page |
| Desktop | `apps/desktop/src/main/notification-client.ts` — device registration, authenticated SSE, native `Notification` when unfocused, presence heartbeat; IPC + preload bridge |

## 1. Database migration

```bash
pnpm --filter @tellann/db exec prisma migrate deploy
```

The migration only `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so it
is safe to run ahead of the code deploy. Nothing is dropped; the legacy
`NotificationEvent` / `EmailDelivery` tables are untouched.

## 2. Environment

Add to every service that loads `@tellann/email` (onboarding-api at minimum;
also the engines and background-workers if you want push/desktop from their
producers):

```
VAPID_PUBLIC_KEY=…        # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:alerts@tellann.co
NOTIFICATIONS_INTERNAL_SECRET=…   # optional; gates POST /internal/notifications
```

Without the VAPID keys the pipeline still runs (in-app + email + desktop); only
standards-based browser push is disabled. onboarding-api logs
`[Onboarding] Web Push …` at boot describing the state (`describeWebPushConfig`).

## 3. Gateway / routing

No gateway change is required — the notification routes live under the existing
`/organizations/*` proxy to onboarding-api, and cookie/JWT auth is already
terminated there. Confirm the proxy does not buffer `text/event-stream`
(`@fastify/http-proxy` streams by default); the dashboard also runs a 60 s
reconciliation poll so a broken stream degrades rather than fails.

## 4. Service worker & HTTPS

`public/sw.js` is served at `/sw.js` with page scope `/`. Web Push requires a
secure context: production HTTPS, or `http://localhost` in dev. The dashboard
registers the worker only for users who have already granted permission; the
settings screen drives first-time enrolment from an explicit gesture.

Icons: the worker references `/logo_icon.png` (already in `apps/dashboard/public`).

## 5. Desktop

- `app.setAppUserModelId('com.tellann.desktop')` is already set in `main.ts`; keep
  it stable so Windows attributes notifications to Tellann.
- The packaged build must ship `build/icon.png` (already wired) for the toast icon.
- Signing is unchanged; native notifications need no extra entitlement on Windows.
  macOS shows notifications once the app is signed and launched at least once.

## 6. Metrics / logs

`NotificationOrchestrator.createNotification()` returns a structured result
(`created`, `deduped`, `recipientUserIds`, per-channel `deliveries[]`).
`NotificationDelivery` rows carry `status` / `failureCode` / `skippedReason` and
are the source of truth for created/sent/failed/skipped/suppressed counts and
channel failure rate. `PushSubscription.failureCount` and `enabled=false` track
invalid endpoints (disabled automatically on 404/410).

## 7. Rollout order

1. Deploy the migration.
2. Deploy services **without** VAPID keys → in-app + email only. The shim
   dual-writes; compare `Notification` counts against `NotificationEvent` for a
   day.
3. Enable the dashboard SSE + feed (already automatic once the API responds).
4. Provision VAPID keys → browser push for test users (they must press Enable).
5. Ship the desktop build → running-desktop native notifications.
6. Migrate remaining producers to `POST /internal/notifications` (or add
   `deepLink` to their existing `sendTransactional` calls) for richer copy and
   deep links. Representative producers already updated: coverage-degraded,
   missing-critical-flow, endpoint-slow, demo-report-ready / -completed /
   -analysis-failed, report-export-ready.

## 8. Rollback

- **Web Push**: unset `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` and redeploy. The
  sender becomes `null`; deliveries record `SKIPPED (web push not configured)`.
- **Desktop native**: ship a build that does not call
  `notificationClient.setActiveOrganization(...)` (or gate it behind a flag).
- **Whole pipeline**: the shim is the only always-on change. To disable it,
  revert `packages/email/src/index.ts` to skip `ensureCentralNotification` /
  `persistCentralNotification`; the legacy `NotificationEvent` feed code was
  removed from onboarding-api, so also restore that handler if you need the old
  feed. The new tables can stay in place empty.
