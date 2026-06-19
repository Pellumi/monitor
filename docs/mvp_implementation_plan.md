Below is a pragmatic MVP implementation plan to bring each area to **90%+ launch readiness**. The key is to fix launch blockers first, then close product completeness gaps, then harden verification.

**MVP Definition**
MVP launch means a paying customer can:

- Create an account/org/app/environment.
- Install SDKs using accurate snippets.
- Send frontend and backend telemetry reliably.
- Declare expected flows.
- Observe sessions and graphs.
- Reconcile declared vs observed behavior.
- View coverage, gaps, sessions, endpoints, and reports through the dashboard.
- Export reports according to plan entitlements.
- Subscribe/pay or be assigned a valid plan.
- Be protected by basic tenant isolation, auth, audit, and operational checks.

**Phase 1: Launch Blockers**
Target: move Billing, Entitlements, SDK, Gateway, and onboarding from risky to usable.

1. **Fix SDK integration**
   - Replace dashboard snippets with actual packages: `@sots/frontend-sdk`, `@sots/backend-sdk`.
   - Replace `SOTS.init()` with `SOTS.initialize()`.
   - Add API key support or update docs/UI to match current `tenantId/applicationId` config.
   - Fix backend SDK default `sessionId`; generate a UUID when none is supplied, or relax collector schema safely.
   - Add tests proving backend SDK events pass `SotsEventSchema`.

   Acceptance:
   - Frontend SDK install snippet works copy-paste.
   - Backend SDK install snippet works copy-paste.
   - Backend API/error/state/workflow events reach collector without explicit session id.

2. **Unify API routing through gateway**
   - Add `FDRS_API` upstream to API Gateway.
   - Proxy `/applications/:id/declared-flow`, `/applications/:id/reconciliation`, and related FDRS routes.
   - Replace dashboard direct calls to `localhost:3008` and `localhost:3004` with gateway-relative routes or `/api-gateway/*`.
   - Keep local dev rewrites, but make production path gateway-first.

   Acceptance:
   - Dashboard works without direct service ports exposed except gateway.
   - FDRS routes inherit gateway auth/context.
   - No dashboard hardcoded internal service URLs remain except dev config.

3. **Build minimal Billing API**
   - Create `services/billing-api`.
   - Implement plan listing, subscription read, checkout session creation, webhook ingest, invoice listing.
   - Support Stripe first; Paystack can be stubbed behind provider interface if needed for MVP.
   - On successful checkout/webhook, update `Subscription`, `Invoice`, `PaymentEvent`, and re-resolve entitlements.
   - Add health endpoint and gateway route verification.

   Acceptance:
   - User can move from Free to paid plan.
   - Webhook updates subscription status.
   - Invoices/payment events are persisted.
   - Failed/cancelled/suspended states affect entitlements.

4. **Wire entitlement enforcement**
   - Enforce `canAccess()` in services:
     - session replay
     - report generation
     - report export
     - endpoint intelligence
     - demonstration mode
     - FDRS/reconciliation if plan-gated
   - Enforce export tiers: JSON-only, JSON/PDF, all formats.
   - Hide or disable gated dashboard actions based on `/entitlements` response.
   - Keep backend enforcement authoritative; UI gating is secondary.

   Acceptance:
   - Free/Local/Solo/Team/Business differences are visible and enforced.
   - Direct API calls cannot bypass plan restrictions.
   - Suspended/cancelled subscriptions block write-heavy/paid features.

**Phase 2: Product Completeness**
Target: bring core behavioral intelligence and dashboard to credible MVP quality.

5. **Complete reconciliation UX**
   - Replace Reconciliation page export alert with real export/download.
   - Add reconciliation-specific export payload including:
     - confirmed states/transitions
     - true gaps
     - undeclared states/transitions
     - expected coverage score
     - transition coverage score
   - Promote Expected Coverage to Overview as a headline KPI.
   - Add empty/loading/error states for no flows, no reports, stale reports.

   Acceptance:
   - Reconciliation can be run, reviewed, promoted/rejected, and exported.
   - Overview clearly shows expected coverage, not only observed coverage.

6. **Finish graph governance loop**
   - Keep existing `BehaviorGraphVersion` and `PromotionDecision`.
   - Add version diff endpoint:
     - added/removed/renamed states
     - added/removed transitions
     - coverage delta
   - Add dashboard view for graph version history and drift.
   - Create `DEMONSTRATED` graph snapshots from demonstration sessions.
   - Optionally defer `PRODUCTION` graphs to post-MVP unless production monitoring is part of launch promise.

   Acceptance:
   - Declared graph versions can be compared.
   - Demonstrated behavior can be reviewed and promoted into declared flows.
   - MVP can explain “what changed” between expected behavior versions.

7. **Improve session completion and replay integrity**
   - Replace `>=5 events` completion heuristic with idle timeout plus explicit end/session stop support.
   - Add replay integrity metrics:
     - timeline completeness
     - missing event count
     - ordering accuracy
     - privacy compliance score
     - replay accuracy score
   - Surface these on Session Replay detail page.

   Acceptance:
   - Short sessions and long sessions are handled correctly.
   - Replay page communicates whether the replay is trustworthy.

8. **Dashboard MVP polish**
   - Standardize API client and app/environment selection.
   - Remove hardcoded fallback app ids like `acadai-local` and fixture defaults.
   - Add global entitlement-aware nav.
   - Add settings page for org, plan, usage, API keys, and billing status.
   - Add clear error boundaries for offline services.

   Acceptance:
   - A new user can complete onboarding without knowing internal ids.
   - Every sidebar page works with selected org/app/environment.
   - Gated pages explain upgrade requirements.

**Phase 3: Auth, Governance, And Tenant Safety**
Target: enough trust for MVP customers without overbuilding enterprise SSO.

9. **Strengthen auth and membership enforcement**
   - Keep OTP auth for MVP.
   - Add role checks for destructive/admin actions:
     - billing changes: owner/admin
     - API key creation/revocation: owner/admin
     - member management: owner/admin
     - view-only analytics: viewer+
   - Add invitation acceptance flow if not fully wired.
   - Add audit logs for billing, API keys, role changes, flow promotion, export downloads.

   Acceptance:
   - Org membership is checked on all management APIs.
   - Viewer cannot mutate resources.
   - Audit log captures MVP-sensitive actions.

10. **Tenant isolation hardening**
   - Audit all service queries for `organizationId`, `applicationId`, and `environmentId` scoping.
   - Add middleware/helpers for resolving org/app access.
   - Add integration tests proving one org cannot access another org’s apps/reports/sessions.
   - Postgres RLS can be post-MVP if app-level isolation is exhaustively tested, but document that decision.

   Acceptance:
   - Cross-tenant access tests pass for dashboard APIs and direct gateway calls.

**Phase 4: Production Readiness And Testing**
Target: make the system operable and verifiable.

11. **Wire real test scripts**
   - Add package `test` scripts for SDKs and core services.
   - Update `turbo.json` so `npm run test` actually runs tests, not only builds.
   - Add tests for:
     - SDK schema compatibility
     - collector size validation
     - entitlement enforcement
     - billing webhook handling
     - gateway FDRS proxy
     - reconciliation classification
     - export tier restrictions
   - Keep e2e tests separate as `test:e2e`.

   Acceptance:
   - `npm run build` passes.
   - `npm run test` runs real unit/integration tests.
   - `npm run test:e2e` validates the declare-observe-reconcile-report loop.

12. **Operational MVP readiness**
   - Add `.env.example` with all service vars.
   - Fix README service list, ports, scripts, and routes.
   - Add health checks for every service.
   - Add startup order notes for Kafka/Postgres/ClickHouse.
   - Add basic logging around dropped events, billing webhooks, entitlement denials, and reconciliation runs.
   - Add Docker/service config for missing runtime services if needed.

   Acceptance:
   - A developer can bootstrap locally from README.
   - Each service has `/health`.
   - Failed dependencies produce actionable errors.

**Target Completion By Area**
| Area | Current | MVP Target | Main Work |
|---|---:|---:|---|
| Core behavioral loop | 80% | 92% | session completion, backend SDK fix, e2e |
| Declared/observed reconciliation | 75% | 92% | export, drift, demonstrated graph snapshots |
| SDK integration | 65% | 95% | snippets, backend UUID/session fix, tests |
| Dashboard UX | 65% | 90% | gateway calls, app/env selector, entitlement-aware UI |
| Entitlements | 45% | 92% | service enforcement, export tiers, dashboard gating |
| Billing | 15% | 90% | billing-api, checkout, webhooks, invoices |
| Auth/governance | 55% | 90% | RBAC checks, audit logs, tenant tests |
| Production/testing | 40% | 90% | real tests, README, health checks, env docs |

**Recommended Order**
1. SDK fixes + onboarding snippets.
2. Gateway/FDRS routing cleanup.
3. Entitlement enforcement.
4. Minimal billing API.
5. Reconciliation export + Expected Coverage on Overview.
6. Auth/RBAC/audit hardening.
7. Real test wiring and e2e launch scenario.
8. README/env/health production cleanup.

This sequence gets the product commercially usable before deeper Phase 2 graph intelligence work.