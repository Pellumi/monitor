# Dynamic Rulesets & AI-Assisted Flow Intelligence — Implementation Plan

## 1. Implementation Objective

The goal is to safely complete the Dynamic Rulesets and AI-Assisted Flow Intelligence work without compromising platform security, tenant isolation, onboarding stability, or MVP positioning.

This implementation should deliver four outcomes:

1. Secure rule and flow intelligence APIs with proper RBAC and tenant isolation.
2. Move domain rulesets into PostgreSQL with versioning, promotion, feedback, and caching.
3. Add AI-assisted draft generation and flow suggestions as internal/experimental capabilities.
4. Ensure AI failure never blocks onboarding or core behavioral QA workflows.

The important product rule is this:

**Rules remain the source of truth. AI only proposes. Humans approve. The system records everything.**

---

## 2. Strategic Implementation Decision

This work should be split into three tracks:

### Track A

* RBAC enforcement
* System admin enforcement
* Tenant access validation
* Sanitized AI draft storage
* AI failure isolation
* AI provider timeout/retry handling
* Ruleset caching
* Invocation logging
* Feature flags

### Track B

* AI-generated flow drafts
* AI-assisted missing prerequisite suggestions
* AI-assisted validation constraint suggestions
* AI-assisted post-requisite lifecycle suggestions
* AI usage metrics
* Rule candidate generation

### Track C

* Full admin governance dashboard
* Automated candidate promotion
* Cost dashboards
* AI-powered organization-level recommendations
* Public-facing AI intelligence assistant

---

## 3. Phase 0 — Security Emergency Patch

### 3.1 Add Central Authorization Middleware

Create a shared authorization layer, preferably in:

```txt
packages/authz/
```

or inside a shared server package if one already exists.

Required helpers:

```ts
requireAuth(req)
requireSystemAdmin(req)
requireOrgMembership(req, organizationId)
requireOrgRole(req, organizationId, allowedRoles)
requireOrgPermission(req, organizationId, permission)
requireApplicationAccess(req, applicationId, permission)
requireGraphAccess(req, graphId, permission)
requireRulesetAdmin(req)
```

The middleware must always resolve:

```ts
{
  userId: string;
  organizationId?: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  permissions: string[];
}
```

### 3.2 Permission Model

Add permission constants:

```ts
export const Permissions = {
  RULESET_READ: "ruleset:read",
  RULESET_WRITE: "ruleset:write",
  RULESET_PROMOTE: "ruleset:promote",

  FLOW_READ: "flow:read",
  FLOW_WRITE: "flow:write",
  FLOW_DELETE: "flow:delete",
  FLOW_COMPLETE: "flow:complete",
  FLOW_REOPEN: "flow:reopen",

  AI_DRAFT_CREATE: "ai:draft:create",
  AI_SUGGESTION_CREATE: "ai:suggestion:create",
  AI_SUGGESTION_ACCEPT: "ai:suggestion:accept",

  GRAPH_VERSION_READ: "graph_version:read",
  GRAPH_VERSION_WRITE: "graph_version:write",
  GRAPH_VERSION_DELETE: "graph_version:delete",

  REPORT_EXPORT: "report:export",

  AUDIT_READ: "audit:read"
} as const;
```

### 3.3 Organization Role Matrix

| Action                    | OWNER | ADMIN | MEMBER |           VIEWER |
| ------------------------- | ----: | ----: | -----: | ---------------: |
| View applications         |   Yes |   Yes |    Yes |              Yes |
| View declared flows       |   Yes |   Yes |    Yes |              Yes |
| Create/edit flows         |   Yes |   Yes |    Yes |               No |
| Complete/reopen flows     |   Yes |   Yes |    Yes |               No |
| Delete flows              |   Yes |   Yes |     No |               No |
| Request AI flow draft     |   Yes |   Yes |    Yes |               No |
| Accept AI suggestions     |   Yes |   Yes |    Yes |               No |
| Delete graph versions     |   Yes |   Yes |     No |               No |
| Manage organization rules |   Yes |   Yes |     No |               No |
| View AI usage metrics     |   Yes |   Yes |     No |               No |
| Export reports            |   Yes |   Yes |    Yes | No or plan-gated |

### 3.4 System Admin Matrix

| Action                         | SYSTEM_ADMIN | ORG_OWNER | ORG_ADMIN |
| ------------------------------ | -----------: | --------: | --------: |
| Create global ruleset          |          Yes |        No |        No |
| Create global ruleset version  |          Yes |        No |        No |
| Promote global ruleset version |          Yes |        No |        No |
| Disable global ruleset         |          Yes |        No |        No |
| View global AI metrics         |          Yes |        No |        No |
| View tenant-local AI metrics   |          Yes |       Yes |       Yes |

### 3.5 Patch Vulnerable Endpoints

Patch these immediately:

```txt
POST /v1/admin/rules/rulesets/:rulesetId/versions
POST /v1/admin/rules/ruleset-versions/:versionId/promote
```

Current behavior:

```txt
JWT only
```

Required behavior:

```txt
JWT + SYSTEM_ADMIN
```

Example:

```ts
app.post(
  "/v1/admin/rules/rulesets/:rulesetId/versions",
  verifyJwt,
  requireSystemAdmin,
  async (req, res) => {
    // create version
  }
);
```

### 3.6 Patch Tenant APIs

Every tenant resource must validate tenant ownership before mutation.

Patch these endpoint families:

```txt
/fdrs/*
/applications/:appId/*
/organizations/:orgId/*
/graphs/*
/flows/*
/ai-drafts/*
/ai-suggestions/*
```

Never trust `organizationId`, `applicationId`, `graphId`, or `flowId` from the request body alone. Resolve ownership from the database.

---

## 4. Phase 1 — Privacy & AI Input Safety

### 4.1 Stop Storing Raw Product Descriptions

Current risk:

```txt
Raw productDescription is sanitized before sending to AI, but raw text is stored in PostgreSQL.
```

Fix:

Store only the sanitized/redacted version by default.

Change:

```ts
productDescription: rawProductDescription
```

to:

```ts
productDescriptionRedacted: sanitizedProductDescription
productDescriptionHash: sha256(rawProductDescription)
```

Optional, only for internal debugging:

```ts
productDescriptionEncrypted: encrypt(rawProductDescription)
```

But default should be:

```txt
Do not store raw text.
```

### 4.2 Add AI Input Sanitization Pipeline

Create:

```txt
packages/ai/src/privacy/sanitize-ai-input.ts
```

The sanitizer should remove or redact:

* Emails
* Phone numbers
* JWTs
* API keys
* Bearer tokens
* Password-like values
* Private keys
* OAuth tokens
* Credit card patterns
* Secrets in `.env` style formats
* URLs with embedded credentials
* Long unstructured payloads

Example output:

```ts
{
  sanitizedText: string;
  redactions: [
    {
      type: "EMAIL" | "API_KEY" | "TOKEN" | "SECRET" | "PHONE";
      count: number;
    }
  ];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}
```

### 4.3 Add Storage Policy

For `AIFlowDraft`, store:

```ts
{
  productDescriptionRedacted,
  productDescriptionHash,
  redactionSummary,
  inputRiskLevel,
  promptVersion,
  provider,
  model,
  createdByUserId,
  organizationId,
  applicationId
}
```

Do not store:

```txt
raw credentials
raw secrets
raw tokens
full user-generated sensitive text
```

### 4.4 Add Prompt Injection Guardrails

Before calling the provider, run a simple classifier:

```ts
detectPromptInjection(text)
```

Flag patterns like:

```txt
ignore previous instructions
reveal system prompt
send secrets
bypass policies
act as system admin
```

If detected, continue only with a hardened system prompt and mark the invocation:

```ts
promptInjectionRisk: true
```

Do not block ordinary users unnecessarily. Just reduce trust in the result.

---

## 5. Phase 2 — Dynamic Ruleset Foundation

### 5.1 Database Models

Add or confirm these models:

```prisma
model Ruleset {
  id             String   @id @default(cuid())
  key            String   @unique
  name           String
  description    String?
  domain         String
  scope          RulesetScope @default(GLOBAL)
  organizationId String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  versions       RulesetVersion[]
}

model RulesetVersion {
  id             String   @id @default(cuid())
  rulesetId      String
  version        Int
  status         RulesetVersionStatus @default(DRAFT)
  rules          Json
  createdById    String?
  promotedById   String?
  promotedAt     DateTime?
  checksum       String
  createdAt      DateTime @default(now())

  ruleset        Ruleset @relation(fields: [rulesetId], references: [id])
}

model RuleSuggestionFeedback {
  id              String   @id @default(cuid())
  organizationId  String
  applicationId   String?
  rulesetId       String?
  suggestionKey   String
  suggestionType  String
  action          FeedbackAction
  reason          String?
  createdById     String
  createdAt       DateTime @default(now())
}

model RuleCandidate {
  id              String   @id @default(cuid())
  organizationId  String?
  source          RuleCandidateSource
  domain          String
  candidate       Json
  confidence      Float
  supportCount    Int      @default(0)
  status          RuleCandidateStatus @default(PENDING)
  createdAt       DateTime @default(now())
  reviewedAt      DateTime?
  reviewedById    String?
}
```

Enums:

```prisma
enum RulesetScope {
  GLOBAL
  ORGANIZATION
}

enum RulesetVersionStatus {
  DRAFT
  ACTIVE
  ARCHIVED
  REJECTED
}

enum FeedbackAction {
  ACCEPTED
  REJECTED
  DISMISSED
}

enum RuleCandidateSource {
  USER_FEEDBACK
  AI_SUGGESTION
  SYSTEM_ANALYSIS
}

enum RuleCandidateStatus {
  PENDING
  APPROVED
  REJECTED
  PROMOTED
}
```

### 5.2 Promotion Rules

Ruleset version promotion must be transactional:

```txt
1. Validate user is SYSTEM_ADMIN for global rules.
2. Validate JSON schema.
3. Archive previous ACTIVE version.
4. Promote selected version to ACTIVE.
5. Clear ruleset cache.
6. Write audit log.
7. Emit RULESET_VERSION_PROMOTED event.
```

Pseudo-flow:

```ts
await prisma.$transaction(async (tx) => {
  await tx.rulesetVersion.updateMany({
    where: { rulesetId, status: "ACTIVE" },
    data: { status: "ARCHIVED" }
  });

  await tx.rulesetVersion.update({
    where: { id: versionId },
    data: {
      status: "ACTIVE",
      promotedById: user.id,
      promotedAt: new Date()
    }
  });

  await tx.auditLog.create({
    data: {
      action: "RULESET_VERSION_PROMOTED",
      userId: user.id,
      resourceId: versionId
    }
  });
});
```

### 5.3 Rule Schema Validation

Create a Zod schema for dynamic rules:

```txt
packages/rules/src/schema.ts
```

Required structure:

```ts
const RuleSchema = z.object({
  id: z.string(),
  type: z.enum([
    "MISSING_STATE",
    "MISSING_FLOW",
    "PREREQUISITE_STATE",
    "POSTREQUISITE_FLOW",
    "VALIDATION_CONSTRAINT"
  ]),
  domain: z.string(),
  when: z.object({}).passthrough(),
  suggest: z.object({
    key: z.string(),
    title: z.string(),
    description: z.string(),
    severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    confidence: z.number().min(0).max(1)
  }),
  evidence: z.array(z.string()).default([])
});
```

Invalid rules must never be promoted.

---

## 6. Phase 3 — Ruleset Caching

### 6.1 Add Cache Layer

Create:

```txt
packages/rules/src/cache.ts
```

Use in-memory cache first. Redis can come later.

Cache key:

```ts
rulesets:${organizationId ?? "global"}:${domain}:${environment}:${activeVersion}
```

TTL:

```txt
5 minutes default
```

### 6.2 Cache Invalidation

Invalidate cache when:

* Ruleset version is promoted
* Ruleset is disabled
* Organization-specific ruleset is edited
* Rule candidate is promoted
* Admin manually flushes cache

### 6.3 Cache API

```ts
getActiveRulesetsCached({
  organizationId,
  domain,
  environment
})

invalidateRulesetCache({
  organizationId,
  rulesetId
})
```

### 6.4 Cache Warmer Job

Add:

```txt
workers/ruleset-cache-warmer
```

Runs every 10–15 minutes.

Warms:

* Global ecommerce rules
* Global LMS rules
* Generic QA packs
* Active organization overrides

---

## 7. Phase 4 — AI Provider Hardening

### 7.1 Provider Interface

Create a stable AI abstraction:

```ts
export interface AIProvider {
  name: "gemini" | "deepseek";
  generateJson<T>(input: GenerateJsonInput<T>): Promise<GenerateJsonResult<T>>;
}
```

Input:

```ts
type GenerateJsonInput<T> = {
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  repair?: boolean;
  metadata?: Record<string, unknown>;
};
```

Output:

```ts
type GenerateJsonResult<T> = {
  data: T;
  rawText: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  latencyMs: number;
  repaired: boolean;
};
```

### 7.2 Add Timeout

Wrap `fetch` with `AbortController`.

Default:

```txt
8 seconds for onboarding
15 seconds for explicit AI actions
30 seconds for admin/internal jobs
```

Example:

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: controller.signal
  });
} finally {
  clearTimeout(timeout);
}
```

### 7.3 Add Retry Policy

Retry only transient failures:

```txt
408
429
500
502
503
504
network timeout
```

Do not retry:

```txt
400
401
403
404
schema-invalid business errors
```

Retry schedule:

```txt
Attempt 1: immediate
Attempt 2: 500ms + jitter
Attempt 3: 1500ms + jitter
```

### 7.4 Add Circuit Breaker

If provider failure rate exceeds threshold:

```txt
5 failures in 60 seconds
```

Open circuit for:

```txt
2 minutes
```

During open circuit:

* Skip AI call.
* Return rule-based fallback.
* Log degraded invocation.
* Do not break onboarding.

### 7.5 Add Provider Fallback

Preferred order:

```txt
Gemini → DeepSeek → Rule-based fallback
```

This fallback should be configurable:

```env
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDER=deepseek
AI_ENABLE_PROVIDER_FALLBACK=true
```

---

## 8. Phase 5 — JSON Repair Fallback

### 8.1 Add Repair Flow

If the LLM response fails JSON parsing or Zod validation:

```txt
1. Attempt direct JSON extraction.
2. Attempt loose parse.
3. Run repair prompt.
4. Validate repaired JSON.
5. If still invalid, fail gracefully.
```

### 8.2 Repair Prompt

The repair prompt must be narrow:

```txt
You are a JSON repair service.
Return only valid JSON.
Do not add explanation.
Do not add markdown.
Preserve the intended data.
Conform exactly to this schema summary:
...
Invalid JSON:
...
Validation errors:
...
```

### 8.3 Repair Limits

Only one repair attempt per invocation.

Never run endless repair loops.

If repair fails:

```ts
return {
  success: false,
  fallbackUsed: true,
  suggestions: ruleBasedSuggestions,
  errorCode: "AI_JSON_REPAIR_FAILED"
}
```

### 8.4 Store Repair Metadata

Log:

```ts
{
  repaired: true,
  repairAttempted: true,
  repairSucceeded: true,
  originalValidationError,
  repairedValidationError: null
}
```

---

## 9. Phase 6 — AI Invocation Logging & Cost Metrics

### 9.1 Extend AIInvocationLog

Add fields if missing:

```prisma
model AIInvocationLog {
  id                 String   @id @default(cuid())
  organizationId     String?
  applicationId      String?
  userId             String?
  provider           String
  model              String
  feature            String
  status             AIInvocationStatus
  inputTokens        Int?
  outputTokens       Int?
  totalTokens        Int?
  estimatedCostUsd   Decimal?
  latencyMs          Int?
  promptVersion      String?
  requestHash        String?
  responseHash       String?
  repaired           Boolean @default(false)
  fallbackUsed       Boolean @default(false)
  errorCode          String?
  errorMessageSafe   String?
  createdAt          DateTime @default(now())
}
```

Statuses:

```ts
enum AIInvocationStatus {
  SUCCESS
  FAILED
  DEGRADED
  FALLBACK_USED
  BLOCKED_BY_POLICY
  TIMEOUT
  RATE_LIMITED
}
```

### 9.2 Do Not Store Raw Prompts by Default

Store hashes and safe metadata:

```txt
requestHash
responseHash
promptVersion
redactionSummary
```

Only store raw prompt/response in development if explicitly enabled:

```env
AI_STORE_RAW_IO=false
```

### 9.3 Token Usage Parsing

Provider adapters should normalize usage.

Gemini adapter output:

```ts
{
  inputTokens,
  outputTokens,
  totalTokens
}
```

DeepSeek adapter output:

```ts
{
  inputTokens,
  outputTokens,
  totalTokens
}
```

If unavailable:

```ts
estimatedTokens = estimateTokensFromText(text)
```

### 9.4 Cost Estimation

Create:

```txt
packages/ai/src/costs.ts
```

Example:

```ts
estimateAiCost({
  provider,
  model,
  inputTokens,
  outputTokens
})
```

Keep prices configurable:

```env
AI_GEMINI_INPUT_COST_PER_1M=
AI_GEMINI_OUTPUT_COST_PER_1M=
AI_DEEPSEEK_INPUT_COST_PER_1M=
AI_DEEPSEEK_OUTPUT_COST_PER_1M=
```

Do not hardcode pricing permanently.

---

## 10. Phase 7 — AI Must Not Block Onboarding

### 10.1 Localize Try/Catch

Patch:

```txt
services/onboarding-api/src/index.ts
POST /applications/:appId/profile
```

Current issue:

```txt
generateAiFlowDraft failure can throw 500 and block onboarding.
```

Required behavior:

```ts
let aiDraft = null;
let aiStatus = "SKIPPED";

try {
  if (flags.aiFlowDraftsEnabled) {
    aiDraft = await generateAiFlowDraft(...);
    aiStatus = "CREATED";
  }
} catch (error) {
  aiStatus = "FAILED_NON_BLOCKING";

  logger.warn({
    error,
    appId,
    organizationId
  }, "AI flow draft failed during onboarding");

  await logAiInvocationFailure(...);
}

return res.status(200).json({
  success: true,
  data: {
    profile,
    aiDraft,
    aiStatus
  }
});
```

### 10.2 User-Facing Behavior

If AI fails:

```txt
Application profile saved.
AI draft generation is temporarily unavailable.
You can continue setup manually.
```

Never:

```txt
500 onboarding failed
```

### 10.3 Queue AI Draft Generation

Better implementation:

```txt
Onboarding API creates profile immediately.
Worker generates AI draft asynchronously.
Dashboard polls draft status.
```

Add:

```prisma
model AIFlowDraftJob {
  id             String @id @default(cuid())
  organizationId String
  applicationId  String
  status         JobStatus
  attempts       Int @default(0)
  errorCode      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

## 11. Phase 8 — True AI-Assisted Flow Suggestions

### 11.1 Keep Rule-Based Suggestions as Baseline

Current `/ai-suggestions` uses `suggestFlowGaps` from `@sots/rules`.

Do not remove it.

Instead, make the pipeline:

```txt
Declared Flow
↓
Rule-Based Suggestions
↓
Optional AI Suggestions
↓
Merge + Deduplicate
↓
Confidence Scoring
↓
Return Suggestions
```

### 11.2 New Suggestion Engine

Create:

```txt
packages/ai/src/flow-suggestions/
```

Files:

```txt
schema.ts
prompt.ts
generate-flow-suggestions.ts
merge-suggestions.ts
confidence.ts
```

### 11.3 Zod Schema

```ts
export const AIFlowSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    type: z.enum([
      "PREREQUISITE_STATE",
      "VALIDATION_CONSTRAINT",
      "POSTREQUISITE_FLOW",
      "MISSING_FAILURE_PATH",
      "MISSING_RECOVERY_PATH",
      "MISSING_EMPTY_STATE",
      "MISSING_LOADING_STATE"
    ]),
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(500),
    targetNodeId: z.string().optional(),
    targetFlowId: z.string().optional(),
    suggestedState: z.string().optional(),
    suggestedTransition: z.string().optional(),
    severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(500),
    evidence: z.array(z.string()).default([])
  })).max(20)
});
```

### 11.4 Prompt Inputs

Only send sanitized minimal context:

```ts
{
  applicationDomain,
  declaredFlows: [
    {
      name,
      states,
      transitions,
      validations,
      endpoints
    }
  ],
  observedGraphSummary,
  existingRuleSuggestions,
  userDefinedGoals
}
```

Do not send:

* Raw replay payloads
* Raw form values
* Raw API bodies
* Tokens
* Secrets
* Personal data

### 11.5 Suggestion Merge Rules

Deduplicate by:

```txt
type + normalized title + target node/flow
```

Priority:

```txt
Accepted human feedback > ruleset suggestion > AI suggestion
```

Confidence formula:

```ts
finalConfidence =
  ruleConfidence * 0.5 +
  aiConfidence * 0.3 +
  evidenceStrength * 0.2
```

If suggestion is AI-only:

```txt
max confidence = 0.75
```

Unless later supported by feedback or ruleset evidence.

### 11.6 Dashboard Labeling

Use clear labels:

```txt
Rule-based
AI-assisted
Experimental
Needs review
```

Do not present AI suggestions as truth.

---

## 12. Phase 9 — Background Workers

Create a worker package:

```txt
services/background-workers
```

Use one of:

* BullMQ + Redis
* Temporal
* Simple cron worker first
* Kubernetes CronJobs later

For MVP simplicity, start with cron workers and a shared job runner.

### 12.1 ai-draft-expiry-cleaner

Purpose:

```txt
Delete or archive stale AI drafts.
```

Schedule:

```txt
Daily
```

Logic:

```txt
Find AIFlowDraft where status = DRAFT and createdAt < now - 30 days.
Archive or delete depending on retention policy.
```

### 12.2 ruleset-feedback-analyzer

Purpose:

```txt
Aggregate accepted/rejected suggestion feedback.
```

Schedule:

```txt
Daily
```

Outputs:

```txt
Suggestion acceptance rate
Rejected suggestion clusters
Candidate rules
Low-confidence noisy rules
```

### 12.3 rule-candidate-promoter

Purpose:

```txt
Create promotion candidates from repeated accepted suggestions.
```

Schedule:

```txt
Daily or weekly
```

Do not auto-promote directly in early versions.

Instead:

```txt
Candidate → Admin review → Promote
```

### 12.4 ruleset-cache-warmer

Purpose:

```txt
Warm active domain rulesets into cache.
```

Schedule:

```txt
Every 10–15 minutes
```

### 12.5 ai-invocation-metrics-aggregator

Purpose:

```txt
Aggregate provider usage, cost, latency, failure rate, repair rate, and fallback rate.
```

Schedule:

```txt
Hourly
```

Create table:

```prisma
model AIUsageDailyAggregate {
  id               String @id @default(cuid())
  organizationId   String?
  provider         String
  model            String
  feature          String
  date             DateTime
  invocationCount  Int
  successCount     Int
  failureCount     Int
  totalInputTokens Int
  totalOutputTokens Int
  totalCostUsd     Decimal
  avgLatencyMs     Int
}
```

---

## 13. Phase 10 — Admin Governance Views

### 13.1 Dashboard Routes

Add:

```txt
/apps/dashboard/src/app/admin/rulesets
/apps/dashboard/src/app/admin/rulesets/[rulesetId]
/apps/dashboard/src/app/admin/rule-candidates
/apps/dashboard/src/app/admin/ai-usage
/apps/dashboard/src/app/admin/audit-logs
```

### 13.2 Ruleset Admin View

Features:

* List rulesets
* View active version
* View draft versions
* Compare versions
* Create new version
* Validate schema
* Promote version
* Archive version
* View promotion history

### 13.3 Rule Candidate Review View

Features:

* Candidate list
* Confidence score
* Support count
* Source
* Example organizations or anonymized domain evidence
* Accept/reject
* Convert to ruleset draft

### 13.4 AI Usage View

Metrics:

* Invocation count
* Success rate
* Failure rate
* Timeout rate
* Rate-limit rate
* JSON repair rate
* Fallback rate
* Token usage
* Estimated cost
* Cost by organization
* Cost by feature
* Cost by provider/model

### 13.5 Audit Log View

Show security-sensitive actions:

* Ruleset version created
* Ruleset version promoted
* Rule candidate approved/rejected
* AI draft accepted
* AI suggestion accepted
* Graph version deleted
* Flow deleted
* Permissions changed

---

## 14. Phase 11 — API Contract Updates

### 14.1 Ruleset APIs

```txt
GET    /v1/admin/rules/rulesets
POST   /v1/admin/rules/rulesets
GET    /v1/admin/rules/rulesets/:rulesetId
POST   /v1/admin/rules/rulesets/:rulesetId/versions
GET    /v1/admin/rules/rulesets/:rulesetId/versions
POST   /v1/admin/rules/ruleset-versions/:versionId/validate
POST   /v1/admin/rules/ruleset-versions/:versionId/promote
```

Protection:

```txt
SYSTEM_ADMIN only for global rulesets.
ORG_OWNER / ORG_ADMIN for organization-scoped rulesets.
```

### 14.2 AI Draft APIs

```txt
POST /v1/applications/:appId/ai-flow-drafts
GET  /v1/applications/:appId/ai-flow-drafts
GET  /v1/ai-flow-drafts/:draftId
POST /v1/ai-flow-drafts/:draftId/accept
POST /v1/ai-flow-drafts/:draftId/reject
```

Protection:

```txt
requireApplicationAccess(appId, AI_DRAFT_CREATE)
```

### 14.3 AI Suggestion APIs

```txt
POST /v1/flows/:flowId/ai-suggestions
GET  /v1/flows/:flowId/ai-suggestions
POST /v1/ai-suggestions/:suggestionId/accept
POST /v1/ai-suggestions/:suggestionId/reject
```

Protection:

```txt
VIEWER: read suggestions only
MEMBER+: request and accept suggestions
```

### 14.4 Admin Metrics APIs

```txt
GET /v1/admin/ai-usage
GET /v1/admin/ai-usage/daily
GET /v1/admin/ai-usage/providers
GET /v1/admin/rule-candidates
POST /v1/admin/rule-candidates/:candidateId/approve
POST /v1/admin/rule-candidates/:candidateId/reject
```

---

## 15. Phase 12 — Feature Flags & Entitlements

### 15.1 Feature Flags

Add flags:

```txt
FDRS_DYNAMIC_RULESETS_ENABLED=true
AI_FLOW_DRAFTS_ENABLED=false
AI_FLOW_SUGGESTIONS_ENABLED=false
AI_RULE_CANDIDATES_ENABLED=false
AI_PROVIDER_FALLBACK_ENABLED=true
AI_JSON_REPAIR_ENABLED=true
AI_STORE_RAW_IO=false
```

### 15.2 Organization-Level Flags

Add table if missing:

```prisma
model OrganizationFeatureFlag {
  id             String @id @default(cuid())
  organizationId String
  key            String
  enabled        Boolean @default(false)
  metadata       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, key])
}
```

### 15.3 Internal Experimental Rollout

Rollout order:

```txt
1. Local development only
2. Internal organization only
3. One test organization
4. Beta organizations
5. Plan-gated public release
```

---

## 16. Phase 13 — Testing Plan

### 16.1 Security Tests

Add tests for:

* Viewer cannot create AI draft.
* Viewer cannot accept suggestions.
* Member cannot delete graph version.
* Org member cannot access another org’s flows.
* Org admin cannot promote global ruleset.
* Authenticated non-admin cannot access `/v1/admin/rules/*`.
* System admin can promote ruleset.
* Audit log is written after promotion.
* Deleted/disabled user cannot mutate resources.

### 16.2 Privacy Tests

Add tests for:

* Product description stores redacted text only.
* API keys are redacted.
* JWTs are redacted.
* Emails are hashed or masked.
* Raw prompt storage is disabled by default.
* AI logs contain hashes, not raw secrets.
* Prompt injection patterns are flagged.

### 16.3 AI Provider Tests

Add tests for:

* Timeout triggers abort.
* 429 retries.
* 401 does not retry.
* Invalid JSON triggers repair.
* Repair failure returns rule-based fallback.
* Provider failure does not block onboarding.
* Circuit breaker opens after repeated failures.
* Fallback provider is called when primary fails.

### 16.4 Ruleset Tests

Add tests for:

* Invalid ruleset schema rejected.
* Active version promotion archives previous active version.
* Cache returns active rules.
* Cache invalidates after promotion.
* Organization-specific rules override or extend global rules correctly.
* Dynamic rules generate same suggestions as previous static rules where applicable.

### 16.5 Integration Tests

End-to-end test:

```txt
Create org
Create app
Create environment
Create API key
Submit profile
AI draft fails
Onboarding still succeeds
Declare flow
Request suggestions
Rule suggestions return
AI suggestions return if flag enabled
Accept suggestion
Feedback stored
Metrics logged
```

---

## 17. Phase 14 — Observability & Alerts

### 17.1 Metrics

Emit:

```txt
ai_invocation_total
ai_invocation_failed_total
ai_invocation_timeout_total
ai_invocation_repair_total
ai_invocation_fallback_total
ai_invocation_latency_ms
ai_invocation_cost_usd
ruleset_cache_hit_total
ruleset_cache_miss_total
ruleset_promotion_total
ruleset_validation_failed_total
authorization_denied_total
```

### 17.2 Logs

All AI and ruleset logs should include:

```ts
{
  requestId,
  organizationId,
  applicationId,
  userId,
  feature,
  provider,
  model,
  status,
  latencyMs
}
```

Do not log:

```txt
raw prompt
raw response
API keys
tokens
secrets
raw product descriptions
```

### 17.3 Alerts

Create alerts for:

* AI provider failure rate > 20% over 10 minutes.
* AI invocation cost spike.
* Ruleset promotion failure.
* Unauthorized admin access attempt.
* Cross-tenant access denied event.
* Cache miss rate unusually high.
* JSON repair rate unusually high.

---

## 18. Recommended Implementation Order

### Sprint 1 — Security & Privacy Lockdown

Deliver:

* `requireSystemAdmin`
* `requireOrgPermission`
* Endpoint protection
* Tenant ownership checks
* Audit logging
* Redacted AI draft storage
* Security tests

This sprint closes the dangerous holes.

### Sprint 2 — Dynamic Ruleset Reliability

Deliver:

* Ruleset schema
* Ruleset versions
* Promotion workflow
* Cache layer
* Cache invalidation
* Ruleset tests

This makes rulesets database-backed without making the system fragile.

### Sprint 3 — AI Provider Infrastructure

Deliver:

* Provider abstraction
* Gemini adapter
* DeepSeek adapter
* Timeout
* Retry
* Circuit breaker
* JSON repair
* Invocation logging
* Cost estimation

This makes AI safe enough to exist.

### Sprint 4 — Non-Blocking Onboarding AI Drafts

Deliver:

* Onboarding try/catch
* Optional async draft job
* AI draft status
* Fallback behavior
* Dashboard draft display
* Feature flag

This prevents AI from becoming a gatekeeper.

### Sprint 5 — AI-Assisted Suggestions

Deliver:

* AI suggestion schema
* Prompt builder
* Suggestion merger
* Confidence scoring
* Feedback capture
* Experimental dashboard labeling

This turns the current misleading “AI Suggestions” label into a real but controlled capability.

### Sprint 6 — Workers & Governance

Deliver:

* Draft expiry worker
* Feedback analyzer
* Rule candidate generator
* Cache warmer
* Metrics aggregator
* Admin views

This turns the system from a feature into an operating platform.

---

## 19. Acceptance Criteria

This implementation is complete when:

1. No authenticated non-admin user can mutate global rulesets.
2. No organization member can mutate resources beyond their role.
3. No tenant can access another tenant’s flows, graphs, drafts, suggestions, or rules.
4. Raw product descriptions are not stored by default.
5. Secrets, tokens, credentials, and PII are redacted before AI calls and storage.
6. AI provider failure does not block onboarding.
7. Invalid AI JSON triggers repair, then fallback.
8. Ruleset lookups use cache and invalidate correctly.
9. AI invocation logs include provider, model, latency, token usage, cost estimate, status, and fallback state.
10. Background workers handle expiry, feedback aggregation, cache warming, and usage aggregation.
11. Admin users can review ruleset versions, rule candidates, AI usage, and audit logs.
12. AI suggestions are clearly labeled experimental and never automatically mutate flows without user approval.
13. All changes are covered by security, privacy, provider, ruleset, and integration tests.

---

## 20. Final Architecture After Implementation

The final flow should look like this:

```txt
User declares or edits flow
        ↓
RBAC + tenant authorization
        ↓
Load active dynamic rulesets from cache
        ↓
Generate rule-based suggestions
        ↓
If experimental AI enabled:
    sanitize context
    call AI provider with timeout/retry
    validate JSON
    repair if needed
    log invocation
        ↓
Merge suggestions
        ↓
Show suggestions with source + confidence
        ↓
User accepts/rejects
        ↓
Store feedback
        ↓
Background workers aggregate feedback
        ↓
Admin reviews rule candidates
        ↓
Approved candidates become ruleset versions
        ↓
System admin promotes version
        ↓
Cache invalidates
        ↓
New rules become active
```

This creates the right loop:

```txt
Human workflow knowledge
↓
Rules
↓
AI assistance
↓
User feedback
↓
Governance
↓
Better rules
↓
Better quality intelligence
```
