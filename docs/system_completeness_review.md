# SOTS System Completeness Review

> **Reviewed against all 33 documentation files in `/docs` and the full codebase structure.**
> Rating scale: ✅ Complete · 🟡 Partially Complete · ❌ Missing / Not Implemented

---

## Executive Summary

The SOTS platform has a **strong architectural foundation** and impressive depth in its AI/ruleset/FDRS layers. However, several critical MVP-blocking gaps remain — most severely in billing, entitlement enforcement, ClickHouse/Kafka infrastructure, Neo4j graph storage, observability/metrics, and the test harness. The documentation is well ahead of the implementation in multiple areas.

**Overall completeness estimate: ~62% toward an MVP-ready system.**

---

## 1. Core Architecture & Infrastructure

### 1.1 Services Inventory

| Documented Service | Exists | Src Size | Status |
|---|---|---|---|
| `api-gateway` | ✅ | 12 KB | 🟡 Partial |
| `auth-api` | ✅ | Present | 🟡 Partial |
| `event-collector` | ✅ | 3.6 KB | 🟡 Thin |
| `session-engine` | ✅ | 6.3 KB | 🟡 Thin |
| `graph-engine` | ✅ | 10.7 KB | 🟡 Partial |
| `coverage-engine` | ✅ | 13.9 KB | 🟡 Partial |
| `endpoint-engine` | ✅ | 9.8 KB | 🟡 Partial |
| `report-engine` | ✅ | 38.6 KB | 🟡 Most complete |
| `fdrs-api` | ✅ | 67.5 KB main + reconciliation | ✅ Well-built |
| `onboarding-api` | ✅ | 65.9 KB | ✅ Substantial |
| `billing-api` | ✅ | 13.1 KB | 🟡 Stub-level |
| `background-workers` | ✅ | 7.4 KB | 🟡 Cron framework only |
| `demonstration-api` | ✅ | Present | 🟡 Status unknown |
| `usage-tracker` | ✅ | Present | ❌ Not inspected |

**Gap:** Nearly every service is a single flat `index.ts` file. The architecture doc calls for distinct internal modules (e.g. `Session Builder`, `Event Sequencer`, `Replay Renderer`). None of those internal modular boundaries exist in code — all logic is monolithic within each service file.

### 1.2 Storage Infrastructure

| Documented DB | Implementation Status |
|---|---|
| PostgreSQL (via Prisma) | ✅ Fully modeled — rich 1,448-line schema |
| ClickHouse | ❌ **Not implemented.** No ClickHouse client, tables, or ingestion pipeline exists in any service. Events go into PostgreSQL (`SessionEvent`) — not a time-series store. |
| Neo4j | ❌ **Not implemented.** Database design doc specifies Neo4j for behavioral graph relationships. The actual codebase uses PostgreSQL (`BehaviorGraph`, `BehaviorGraphNode`, `BehaviorGraphEdge` tables). This is a viable pivot but it's undocumented and no graph query layer exists. |
| Kafka / Event Bus | ❌ **Not implemented.** The architecture specifies Kafka as the streaming layer between collector and processing. No Kafka producer/consumer exists. The event-collector appears to write directly to Postgres. |
| Object Storage | ❌ **Not implemented.** No S3/GCS integration for session replay assets, graph snapshots, or report exports. |
| Redis (for caching) | ❌ Not implemented. Ruleset cache is in-memory (`packages/rules/src/cache.ts`). |

> [!CAUTION]
> The 5 non-Postgres storage systems (ClickHouse, Neo4j, Kafka, Object Storage, Redis) are all specified but none are implemented. For a production-grade platform handling millions of events, this is a critical infrastructure gap.

### 1.3 Docker / Deployment

- `docker-compose.yml` exists at root — likely starts Postgres and perhaps Kafka.
- No Kubernetes manifests or Helm charts found (architecture calls for K8s cluster).
- No Terraform or infrastructure-as-code found under `infrastructure/`.
- `infrastructure/` directory exists but was not inspected — may contain partial configs.

---

## 2. SDK Layer

### 2.1 Frontend SDK (`packages/frontend-sdk`)

| Specified Feature | Status |
|---|---|
| Page visits / route changes | ✅ Auto-track exists |
| Button/link clicks | ✅ Auto-track |
| Form interactions/submissions | ✅ Auto-track |
| State transitions (`trackState`) | ✅ |
| Workflow tracking (`startWorkflow`, `completeWorkflow`) | ✅ `workflow-tracker.ts` |
| `trackBusinessEvent()` (Phase 1.5B) | 🟡 Mentioned in docs, unclear if exported |
| Error capture (`captureException`) | ✅ |
| Privacy filter / masking | 🟡 Unclear if implemented in SDK |
| Session ID generation | ✅ |
| Buffering + async transport | 🟡 Unknown — single transport call pattern |
| **Tests** | ✅ `index.test.ts` exists |

**Gap from MVP plan:** The docs note that SDK snippets shown in the dashboard need to match the actual package names (`@sots/frontend-sdk`, not placeholders). This is flagged as launch-blocking in `mvp_implementation_plan.md`.

### 2.2 Backend SDK (`packages/backend-sdk`)

| Specified Feature | Status |
|---|---|
| Request interceptor | ✅ `core/` directory |
| Response/error interceptor | ✅ |
| Express / Fastify integrations | ✅ `integrations/` directory |
| Session correlation | 🟡 Default `sessionId` issue flagged in MVP plan |
| Trace correlator | ❌ Not confirmed |
| **Tests** | ✅ `index.test.ts` exists |

**Gap:** The MVP plan identifies that the backend SDK generates a missing `sessionId` as a launch blocker — events may fail schema validation at the collector.

---

## 3. Event Collector & Ingestion

| Spec Item | Status |
|---|---|
| Event reception endpoint | ✅ (event-collector exists) |
| Schema validation | 🟡 Thin (3.6KB service) |
| Authentication layer | 🟡 Unclear from service size |
| Rate limiting | ❌ Not confirmed |
| Kafka publishing | ❌ Not present — goes directly to DB |
| Multi-tenant routing | 🟡 Partial |
| Batch event endpoint | 🟡 Unknown |

**Gap:** The documented event flow is:
```
SDK → Event Collector → Kafka → Processing Layer
```
The actual flow appears to be:
```
SDK → Event Collector → PostgreSQL (direct write)
```
This removes the entire async processing decoupling layer.

---

## 4. FDRS — Flow Declaration & Reconciliation System

This is the **most complete** subsystem in the codebase.

| Spec Item | Status |
|---|---|
| `BehaviorGraph` model (Declared Intent Graph) | ✅ Full Prisma model |
| `BehaviorGraphNode` + `BehaviorGraphEdge` | ✅ |
| `DeclaredStateSuggestion` | ✅ |
| `CompiledRuleset` | ✅ |
| `ReconciliationReport` | ✅ — with transition coverage fields |
| `BehaviorGraphVersion` | ✅ — with baseline/expected coverage |
| `GraphRelationship` model | ✅ |
| `PatternLibraryEntry` | ✅ |
| `IntentNormalizationEntry` | ✅ (Gap #1 from `behaviour_graph_review.md` is addressed) |
| `SuggestionOutcome` + `PatternObservation` | ✅ |
| `PromotionDecision` | ✅ |
| `ObservedGraphSnapshot` | ✅ |
| FDRS API routes | ✅ 67.5 KB `fdrs-api/src/index.ts` — very substantial |
| Reconciliation engine (`reconciliation.ts`) | ✅ 13 KB |
| Compiler (`compiler.ts`) | ✅ 2.6 KB |
| Three-way classification (CONFIRMED/TRUE_GAP/UNDECLARED) | ✅ Specified in BGS §22.5 and in DB model |
| `expectedCoverageScore` metric | ✅ Present in `ReconciliationReport` |
| Derivation Engine (Tier 1 library) | 🟡 `derivation-engine/src/index.ts` exists (3.6 KB) — appears limited |
| Cross-tenant structural matching (Tier 1.5) | ❌ Not confirmed |
| External search enrichment (Tier 2) | ❌ Not confirmed |
| Dashboard FDRS UI (declare page) | ✅ 107 KB `declare/page.tsx` — very large, likely complete |
| Dashboard reconciliation UI | ✅ `reconciliation/` exists |

**Remaining Gaps:**

1. **Reconciliation export** — `mvp_implementation_plan.md` notes the export button shows an alert, not a real download. This is a UX blocker.
2. **Expected Coverage on Overview** — flagged as not yet promoted to the main dashboard KPI.
3. **Graph version diff endpoint** — added/removed/renamed states between graph versions not implemented.
4. **`DEMONSTRATED` graph snapshots** — demonstration sessions should create `DEMONSTRATED` graph type snapshots; unclear if wired.
5. **Demonstration-time node promotion** — FDRS-DEMO-001 requires explicit dev confirmation when an undeclared node appears during demonstration; dashboard prompt unclear if built.

---

## 5. Dynamic Rulesets & Rules Package

| Spec Item | Status |
|---|---|
| `Domain`, `DomainRuleset`, `DomainRulesetVersion` models | ✅ |
| `RulePattern`, `RuleTrigger`, `FlowTemplate` models | ✅ |
| `RuleCandidate`, `RuleFeedback` models | ✅ |
| Static fallbacks (`ecommerce.ts`, `lms.ts`, etc.) | ✅ In `packages/rules/src/` |
| Dynamic rule loading from DB | ✅ `dynamic.ts` (12.5 KB) |
| In-memory ruleset cache | ✅ `cache.ts` (3.8 KB) |
| Rule schema validation (Zod) | ✅ `schema.ts` (4.3 KB) |
| Ruleset seeding script | 🟡 `packages/db/prisma/seeds/` exists but unconfirmed |
| Cache invalidation on promotion | 🟡 Logic present but Redis not wired |
| Cache warmer background worker | ✅ In `background-workers/src/index.ts` |
| Promotion workflow (transactional) | 🟡 API routes exist but SYSTEM_ADMIN enforcement is env-var based |
| Admin ruleset governance endpoints | 🟡 Partially in `fdrs-api` |
| Dashboard ruleset admin views | ❌ `/admin/rulesets`, `/admin/rule-candidates`, `/admin/ai-usage` routes **not found** in `apps/dashboard/src/app/` |

**Gap:** The admin governance dashboard (Phase 10 of `gaps-fixes-plan.md`) — ruleset version management, rule candidate review, AI usage views, audit log viewer — has **no dashboard routes**.

---

## 6. AI Layer

### 6.1 Provider Infrastructure

| Spec Item | Status |
|---|---|
| `AIProvider` interface | ✅ `providers/base.ts` |
| Gemini adapter | ✅ Via `JsonHttpProvider` |
| DeepSeek adapter | ✅ Via `JsonHttpProvider` |
| Mock provider | ✅ |
| Provider fallback chain | ✅ `buildProviderChain()` |
| `AI_PRIMARY_PROVIDER` / `AI_FALLBACK_PROVIDER` env flags | ✅ |
| Timeout with `AbortController` | ✅ (in `json-http-provider.ts`) |
| Retry on transient failures | ✅ |
| Circuit breaker | ✅ Present in provider |
| JSON repair flow | ✅ `repairAttempted` / `repaired` fields |

### 6.2 AI Features

| Spec Item | Status |
|---|---|
| AI input sanitization pipeline | ✅ `privacy/sanitize-ai-input.ts` (6.6 KB) |
| Prompt injection detection | ✅ In `generateAiFlowDraft()` |
| `AIFlowDraft` storage model | ✅ Full Prisma model |
| Flow draft generation (`generateAiFlowDraft`) | ✅ `packages/ai/src/index.ts` |
| Flow suggestions engine | ✅ `packages/ai/src/flow-suggestions/` (6 files) |
| Suggestion merge/deduplication | ✅ `merge-suggestions.ts` |
| Confidence scoring | ✅ `confidence.ts` |
| `AIInvocationLog` model | ✅ Full model with all required fields |
| Cost estimation | ✅ `packages/ai/src/costs.ts` (3.5 KB) |
| AI invocation logging to DB | 🟡 Model exists; unclear if all endpoints actually write logs |
| `AIUsageDailyAggregate` model | ❌ **Missing from schema** — specified in `gaps-fixes-plan.md` §9.5 but not in `schema.prisma` |
| AI-generated draft stored as `AIFlowDraft` (not active graph) | ✅ Correctly separated |
| Onboarding try/catch (AI failure non-blocking) | 🟡 Flagged as required; unclear if fully wired |
| `AIFlowDraftJob` model for async queue | ❌ **Not in schema** — specified in gaps plan §10.3 |
| `AI_STORE_RAW_IO=false` enforcement | 🟡 Flag defined but enforcement uncertain |
| Raw product description NOT stored | 🟡 Schema has `productDescription String?` — still stored |

> [!WARNING]
> `AIUsageDailyAggregate` model is specified in the gaps plan for the hourly metrics aggregator worker but is absent from the Prisma schema. The background worker aggregates stats to `console.log` only — it never writes to a database table.

---

## 7. Background Workers

| Specified Worker | Status |
|---|---|
| `ai-draft-expiry-cleaner` (daily) | ✅ Archives stale drafts |
| `ruleset-feedback-analyzer` (daily) | ✅ Stub — logs stats, TODO for candidate creation |
| `rule-candidate-promoter` (daily/weekly) | ❌ Not implemented — feedback analyzer has a `TODO` comment |
| `ruleset-cache-warmer` (every 10 min) | ✅ Warms all active domains |
| `ai-invocation-metrics-aggregator` (hourly) | 🟡 Aggregates to console only, no DB write |
| Persistent job queue (BullMQ/Temporal) | ❌ Simple `setInterval` only — no persistence, no retry on crash |
| `workers/ruleset-cache-warmer` as separate job | 🟡 Merged into same process |

**Gap:** The single `background-workers` process uses `setInterval` without any persistence layer. If the process restarts, jobs are silently lost. The plan specifies BullMQ + Redis or Temporal for production-grade scheduling.

---

## 8. Authorization & Security

| Spec Item | Status |
|---|---|
| `packages/authz` with `requireAuth`, `requireSystemAdmin`, etc. | ✅ All helpers implemented |
| Permission constants (`Permissions.*`) | ✅ |
| Role permission matrix (OWNER/ADMIN/MEMBER/VIEWER) | ✅ |
| `SYSTEM_ADMIN_USER_IDS` env-var based check | ✅ (but flagged as needing DB-backed role) |
| `makeRequireApplicationAccess` middleware | ✅ |
| `makeRequireOrgMembership` / `makeRequireOrgRole` | ✅ |
| Authz middleware applied to admin ruleset endpoints | 🟡 Must be verified per-service |
| Tenant isolation (never trust body-supplied IDs) | 🟡 Pattern defined, application-wide enforcement uncertain |
| Audit log for security-sensitive actions | 🟡 `AuditLog` model exists but only covers `AuditAction` enum (identity events) — **ruleset promotion, flow deletion, AI suggestion acceptance are not in the enum** |
| Row-level security (Postgres RLS) | ❌ Not implemented (deferred post-MVP) |

> [!IMPORTANT]
> The `AuditAction` enum covers authentication events only (`LOGIN_SUCCESS`, `OTP_SENT`, etc.). The `gaps-fixes-plan.md` requires audit entries for: ruleset version promotion, rule candidate approval, AI draft acceptance, graph version deletion, flow deletion, and permission changes. **None of these are in the enum or written to the audit log.**

---

## 9. Billing & Entitlements

### 9.1 Database Models

| Model | Status |
|---|---|
| `Plan`, `FeatureFlag` | ✅ |
| `Subscription`, `Entitlement` | ✅ |
| `UsageRecord`, `UsageSnapshot` | ✅ |
| `Invoice`, `PaymentEvent` | ✅ |
| Stripe / Paystack fields on Subscription | ✅ |

### 9.2 Billing API (`services/billing-api`)

The billing API exists (13 KB) but based on `mvp_implementation_plan.md`:

| Feature | Status |
|---|---|
| Plan listing | 🟡 |
| Subscription read | 🟡 |
| Stripe checkout session creation | ❌ Not confirmed |
| Paystack checkout | ❌ Not confirmed |
| Webhook ingestion (Stripe/Paystack) | ❌ **Flagged as missing in MVP plan** |
| Invoice listing | ❌ |
| Subscription status updates from webhooks | ❌ |
| Entitlement re-resolution after payment | ❌ |

### 9.3 Entitlement Enforcement

| Feature | Status |
|---|---|
| `packages/entitlement-checker` | ✅ Exists |
| Session replay gate | ❌ Not enforced in session engine |
| Report export tier restrictions | ❌ Not enforced in report engine |
| Dashboard UI gating | 🟡 Mentioned but not confirmed |
| Direct API bypass prevention | ❌ Backend enforcement not confirmed |

> [!CAUTION]
> The MVP plan rates Billing at **15% complete** and Entitlements at **45% complete**. These are the two lowest-scoring areas and both are launch-blocking for a paying customer.

---

## 10. Authentication

| Spec Item | Status |
|---|---|
| OTP auth flow | ✅ `auth-api` exists, `OtpCode` model present |
| JWT access/refresh tokens | ✅ `UserSession` with `refreshTokenHash` |
| Password-based auth | ✅ `passwordHash` on User |
| `preferredAuthMode` | ✅ |
| Organization invitations | ✅ `OrganizationInvitation` model |
| Invitation acceptance flow | 🟡 Model exists; dashboard route not confirmed |
| MFA | 🟡 `MFA_ENABLED`/`MFA_DISABLED` in `AuditAction` enum only |
| SSO/OAuth 2.0/OIDC | ❌ Phase 2 — not implemented |
| Cookie scoping to `app.domain-name.com` | 🟡 Conceptually described, deployment not configured |

---

## 11. Notification & Email System

| Spec Item | Status |
|---|---|
| `packages/email` | ✅ Two files: `index.ts` (17.6 KB) + `templates.ts` (10.2 KB) |
| `EmailTemplate`, `NotificationPreference`, `NotificationEvent`, `EmailDelivery`, `EmailSuppression` models | ✅ All in schema |
| Resend provider integration | 🟡 `EmailProvider.RESEND` in schema — actual Resend client unclear |
| Console fallback provider | ✅ |
| Webhook/in-app notification channels | 🟡 Fields on `NotificationPreference` but service unclear |
| Workflow degradation alerts | ❌ No alert trigger wired to graph/reconciliation events |
| Report-ready notifications | ❌ Not confirmed |
| Daily/weekly digest | ❌ `NotificationFrequency.DAILY_DIGEST` exists in schema but no worker |

---

## 12. Dashboard — UI Completeness

| Page / Feature | Status |
|---|---|
| Auth (`/auth`) | ✅ |
| Onboarding (`/onboarding`) | ✅ |
| Declare flow (`/declare`) | ✅ 107 KB page — comprehensive |
| Reconciliation (`/reconciliation`) | ✅ Exists |
| Graph viewer (`/graph`) | ✅ |
| Workflows (`/workflows`) | ✅ |
| Missing states (`/missing-states`) | ✅ |
| Missing flows (`/missing-flows`) | ✅ |
| Sessions (`/sessions`) | ✅ |
| Endpoints (`/endpoints`) | ✅ |
| Reports (`/reports`) | ✅ |
| Settings — profile (`/settings/profile`) | ✅ |
| Settings — billing / plan / usage | ❌ No `/settings/billing`, `/settings/plan`, `/settings/usage` routes found |
| Settings — org members / roles | ❌ Not found |
| Settings — API keys | ❌ Not found |
| Admin — rulesets | ❌ Not found |
| Admin — rule candidates | ❌ Not found |
| Admin — AI usage | ❌ Not found |
| Admin — audit logs | ❌ Not found |
| Organization/App/Env switcher | 🟡 Flagged as needed in MVP plan |
| Entitlement-aware nav (hide gated features) | ❌ Not confirmed |
| Expected Coverage Score on Overview | 🟡 Flagged as not yet promoted to headline KPI |
| Reconciliation export (real download) | 🟡 Flagged as alert-only currently |

---

## 13. Marketing & Documentation Sites

| Specified Deliverable | Status |
|---|---|
| `apps/marketing` (Next.js) | ✅ Exists with pages: `/`, `/pricing`, `/contact`, `/privacy`, `/security`, `/terms` |
| Marketing homepage hero, feature sections | ✅ `page.tsx` (11.5 KB) — built |
| SEO: `robots.ts`, `sitemap.ts` | ✅ Both present |
| Open Graph / Twitter card metadata | 🟡 Presence uncertain |
| `apps/docs` | ✅ Exists with pages and components |
| SDK installation docs (copy-paste accurate) | 🟡 Unknown — docs content not reviewed |
| Role-specific guides (QA/dev/PM) | 🟡 Unknown |
| API reference pages | 🟡 Unknown |
| OpenAPI spec (`/openapi.json`, `/swagger`) | ❌ No OpenAPI generation found in any service |

---

## 14. Session Replay

| Spec Item | Status |
|---|---|
| Session builder & event sequencer | 🟡 `session-engine/src/index.ts` (6.3 KB) |
| Timeline generator | 🟡 |
| Replay renderer | ❌ No replay renderer found |
| Playback API | ❌ |
| Session replay dashboard viewer | ✅ `sessions/` route exists |
| Object storage for replay assets | ❌ Not wired |
| Replay integrity metrics | ❌ Flagged in MVP plan as missing |
| Session completion heuristic fix (idle timeout) | ❌ Flagged in MVP plan as `>= 5 events` still used |

---

## 15. Report Engine

The report engine (`services/report-engine/src/index.ts` at 38.5 KB) is one of the more complete services.

| Report Type | Status |
|---|---|
| Executive Report | 🟡 |
| Flow Coverage Report | ✅ |
| Behavioral Graph Report | ✅ |
| Missing State Report | ✅ |
| Missing Flow Report | ✅ |
| Session Analysis Report | 🟡 |
| Endpoint Intelligence Report | ✅ |
| **Export: JSON** | ✅ |
| **Export: PDF** | 🟡 Likely stubbed |
| **Export: CSV** | 🟡 |
| **Export: HTML** | 🟡 |
| Object storage for exported reports | ❌ Not wired |
| Export tier enforcement (plan-gated) | ❌ Not enforced |

---

## 16. Test Coverage

| Area | Status |
|---|---|
| Frontend SDK unit tests | ✅ `index.test.ts` |
| Backend SDK unit tests | ✅ `index.test.ts` |
| AI package unit tests | ✅ `index.test.ts` |
| Graph validation tests | ✅ `index.test.ts` |
| Rules templates tests | ✅ `templates.test.ts` |
| E2E test harness | 🟡 `packages/e2e-tests/` exists with fixtures |
| Security RBAC tests | ❌ Specified in gaps plan §16.1 but not found |
| Privacy/redaction tests | ❌ Specified in gaps plan §16.2 |
| AI provider behavior tests | ❌ Specified in gaps plan §16.3 |
| Ruleset promotion/cache tests | ❌ Specified in gaps plan §16.4 |
| Integration test (declare → observe → reconcile) | ❌ Specified in gaps plan §16.5 |
| Billing webhook tests | ❌ |
| `turbo.json` test pipeline | ❌ MVP plan flags that `npm run test` doesn't run real tests |

---

## 17. Observability & Operational Readiness

| Spec Item | Status |
|---|---|
| OpenTelemetry instrumentation | ❌ Not found |
| Prometheus metrics | ❌ Not found |
| Grafana dashboards | ❌ Not found |
| Loki log aggregation | ❌ Not found |
| Per-service `/health` endpoint | 🟡 Some services likely have one; not confirmed for all |
| Structured JSON logging | 🟡 Console logging only seen in workers |
| AI metrics (`ai_invocation_total`, etc.) | ❌ Not emitted |
| Ruleset cache metrics | ❌ Not emitted |
| Alert rules (e.g. AI failure rate > 20%) | ❌ Not configured |
| `.env.example` completeness | 🟡 Root `.env.example` exists (3.2 KB) — may be incomplete |
| README accuracy | 🟡 Flagged as needing updates in MVP plan |

---

## 18. Gaps From `behaviour_graph_review.md`

The review document identified 4 architectural gaps:

| Gap | Status |
|---|---|
| **Gap 1: Intent Normalization Layer** — "Create Account" → `USER_REGISTRATION` | ✅ **Addressed**: `IntentNormalizationEntry` model exists in schema; `derivation-engine` includes normalization logic |
| **Gap 2: Confidence Scoring on suggestions** | ✅ **Addressed**: `confidence` field on `DeclaredStateSuggestion`; `confidence.ts` in AI package |
| **Gap 3: Expected Coverage Score metric** | ✅ **Addressed**: `expectedCoverageScore` in `ReconciliationReport` |
| **Gap 4: Version-to-version graph drift analysis** | 🟡 **Partially addressed**: `BehaviorGraphVersion` model exists with baseline fields; diff endpoint not built |

---

## 19. Gaps From `gaps-fixes-plan.md` Acceptance Criteria

The plan defines 13 acceptance criteria for completeness. Current status:

| # | Criterion | Status |
|---|---|---|
| 1 | No non-admin can mutate global rulesets | 🟡 Middleware exists; per-endpoint enforcement needs audit |
| 2 | No org member can exceed role permissions | 🟡 Authz package built; application coverage needs audit |
| 3 | No cross-tenant access to resources | 🟡 Pattern defined; comprehensive tests missing |
| 4 | Raw product descriptions not stored by default | ❌ `productDescription String?` still in `AIFlowDraft` |
| 5 | Secrets/PII redacted before AI calls | ✅ `sanitize-ai-input.ts` |
| 6 | AI failure does not block onboarding | 🟡 Try/catch pattern defined but full wiring unconfirmed |
| 7 | Invalid AI JSON triggers repair then fallback | ✅ In `JsonHttpProvider` |
| 8 | Ruleset cache works and invalidates | 🟡 In-memory only; Redis not wired |
| 9 | AI logs include all required fields | 🟡 Model has all fields; write-path coverage uncertain |
| 10 | Background workers handle all 5 jobs | 🟡 4 of 5 present; rule-candidate-promoter is a TODO |
| 11 | Admin views for rulesets/candidates/AI/audit | ❌ No dashboard routes exist |
| 12 | AI suggestions labeled experimental, never auto-applied | 🟡 Architecture correct; UI labeling unconfirmed |
| 13 | Security/privacy/provider/ruleset/integration tests present | ❌ Most categories missing |

---

## 20. Priority Gap Summary

### 🔴 Critical / Launch-Blocking

1. **Billing API** — no checkout, no webhooks, no invoice lifecycle. Paying customers cannot pay.
2. **Entitlement enforcement** — plan restrictions not enforced at API level. All features accessible to all plans.
3. **ClickHouse / Kafka** — documented as core infrastructure; absent entirely. Events stored in Postgres will not scale.
4. **Admin dashboard routes** — ruleset governance, AI usage, audit logs, rule candidates: zero dashboard UI.
5. **`AIUsageDailyAggregate` DB model** — background worker aggregates to console only; no persistent cost/usage tracking.
6. **`AuditLog` gaps** — security-sensitive actions (ruleset promotion, flow deletion, AI acceptance) not audited.
7. **Test harness** — `npm run test` not wired for real tests; security, privacy, and integration tests all missing.

### 🟠 High Priority / Pre-Launch

8. **Object storage** — reports and session replays have no durable export destination.
9. **OpenAPI spec** — no `GET /openapi.json` or Swagger UI despite being specified.
10. **Reconciliation export** — export button shows alert, not download.
11. **Raw product description storage** — `AIFlowDraft.productDescription` should store only redacted version.
12. **Session replay integrity** — completion heuristic, replay renderer, and timeline accuracy incomplete.
13. **`BehaviorGraph` version diff endpoint** — needed for drift analysis between declared graph versions.
14. **Dashboard settings pages** — no billing, member management, or API key management UI.
15. **`AIFlowDraftJob` async queue model** — needed for non-blocking AI draft generation.

### 🟡 Medium Priority / Post-Launch

16. Redis for ruleset caching (current in-memory cache resets on restart).
17. `rule-candidate-promoter` worker completing the feedback loop.
18. Neo4j vs Postgres graph storage — documentation says Neo4j, code uses Postgres; needs a decision and updated docs.
19. Cross-tenant structural pattern matching (Derivation Engine Tier 1.5).
20. MFA implementation.
21. SSO/OIDC (Phase 2 but flagged in security spec).
22. Notification digest workers.
23. Prometheus/Grafana observability stack.
24. Demonstration-time node promotion UI prompt.
25. Graph drift dashboard view.
