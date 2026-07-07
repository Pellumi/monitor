# Dynamic Rulesets & Experimental AI-Assisted Flow Intelligence — Launch Implementation Plan

## 1. Implementation Decision

We will implement and ship three related capabilities:

1. **Database-backed dynamic rulesets**

   * Public/core launch feature.
   * Replaces hardcoded domain templates with versioned, database-managed rule packs.
   * Used by domain inference, flow generation, missing flow detection, missing state detection, and coverage analysis.

2. **AI-assisted custom flow generation**

   * Internal/experimental flag.
   * Generates custom flow drafts from a user’s product description and selected/inferred domain rulesets.
   * AI output does not directly mutate active behavior graphs.
   * AI creates a draft/proposal that must be validated and accepted before becoming part of the declared graph.

3. **AI-assisted flow suggestions**

   * Internal/experimental flag.
   * Suggests prerequisite states, validation constraints, missing edge cases, and downstream lifecycle flows while users build or refine declared flows.
   * Suggestions are stored separately from graph truth until accepted, rejected, or edited.

## 2. Launch Boundary

### Publicly Shipped

The public system can say:

> Tellann uses dynamic domain rulesets to help identify likely missing flows, states, and workflow gaps.

### Experimental/Internal Label

For AI features, the UI must clearly say:

> Experimental: AI-generated flow drafts and suggestions are assistive only. Review before applying.

### Do Not Market Yet

Do not market the launch as:

* AI-powered testing
* Autonomous QA
* AI software engineer
* Autonomous validation
* Fully automated test generation
* Self-healing QA

The launch story remains:

> Demonstrate or define your application flow. Tellann helps you generate workflow visibility, coverage, missing states, and missing flows.

## 3. Corrected Architecture

The current plan is directionally correct, but four changes are required:

### Change 1 — Do Not Store AI Output Directly as Active `BehaviorGraph`

Instead of:

```txt
AI generated output → active BehaviorGraph
```

Use:

```txt
AI generated output
        ↓
AIFlowDraft / BehaviorGraphProposal
        ↓
Schema validation
        ↓
Graph validation
        ↓
User review
        ↓
Accepted graph mutation
        ↓
Declared BehaviorGraph version
```

Reason: AI may hallucinate states, invalid transitions, duplicate nodes, impossible paths, or unsupported edge cases.

### Change 2 — `DomainRuleset` Alone Is Too Flat

A single `DomainRuleset` table with `states`, `transitions`, and `edgeCases` JSON fields is acceptable for a quick prototype, but not for launch-ready evolution.

We need:

```txt
Domain
DomainRuleset
DomainRulesetVersion
RulePattern
RuleTrigger
FlowTemplate
RuleCandidate
RuleFeedback
```

Reason: rulesets need versioning, activation, rollback, feedback, promotion, and domain-specific tuning.

### Change 3 — Rules Must Be Versioned

Every generated flow, missing state, missing flow, and suggestion should be traceable to:

```txt
rulesetId
rulesetVersionId
rulePatternIds
aiInvocationId, if AI was used
```

Reason: reports must remain reproducible. If the rules change next week, an old report should still explain which rules produced it.

### Change 4 — AI Needs a Dedicated Boundary Layer

Do not place provider-specific AI logic directly inside `onboarding-api` or `fdrs-api`.

Create:

```txt
packages/ai
services/flow-intelligence-api
```

or, if you want to avoid another service immediately:

```txt
packages/ai
services/onboarding-api/src/modules/flow-intelligence
services/fdrs-api/src/modules/flow-suggestions
```

The important rule is that AI orchestration must be isolated from core graph mutation logic.

---

# 4. Target System Flow

## 4.1 Dynamic Ruleset Flow

```txt
User defines application
        ↓
Domain inference runs
        ↓
Active database rulesets are fetched
        ↓
Rules are compiled into executable rule pack
        ↓
Flow templates / missing flows / edge cases are generated
        ↓
Graph proposal is created
        ↓
User accepts or edits
        ↓
Declared graph version is persisted
```

## 4.2 AI Custom Flow Generation Flow

```txt
User enters product description
        ↓
System infers likely domain
        ↓
System retrieves matching active rulesets
        ↓
Privacy filter sanitizes user input
        ↓
AI prompt is built with strict schema
        ↓
AI provider returns structured JSON
        ↓
Output is parsed and validated
        ↓
Graph validator checks states/transitions
        ↓
AIFlowDraft is stored
        ↓
User reviews draft
        ↓
Accepted items become declared graph nodes/edges
```

## 4.3 AI Flow Suggestion Flow

```txt
User is editing declared flow
        ↓
Current graph context is collected
        ↓
Relevant domain rulesets are loaded
        ↓
AI analyzes missing prerequisites, validations, downstream paths
        ↓
Suggestions are validated
        ↓
Suggestions are saved
        ↓
Dashboard shows suggestion sidebar
        ↓
User accepts, edits, rejects, or ignores suggestions
        ↓
Feedback is stored for future rule refinement
```

---

# 5. Database Implementation

## 5.1 Recommended Prisma Models

### Domain

```prisma
model Domain {
  id          String   @id @default(uuid())
  key         String   @unique // ECOMMERCE, LMS, AUTH, GENERIC_CRUD
  name        String
  description String?
  isSystem    Boolean  @default(true)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rulesets    DomainRuleset[]
}
```

### DomainRuleset

```prisma
model DomainRuleset {
  id          String   @id @default(uuid())
  domainId    String
  key         String
  name        String
  description String?
  scope       RulesetScope @default(GLOBAL)
  status      RulesetStatus @default(ACTIVE)
  priority    Int @default(100)

  organizationId String?
  applicationId  String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  domain      Domain @relation(fields: [domainId], references: [id])
  versions    DomainRulesetVersion[]

  @@unique([domainId, key, organizationId, applicationId])
  @@index([domainId, status])
  @@index([organizationId])
  @@index([applicationId])
}
```

### DomainRulesetVersion

```prisma
model DomainRulesetVersion {
  id          String   @id @default(uuid())
  rulesetId   String
  version     Int
  status      RulesetVersionStatus @default(DRAFT)
  changelog   String?
  metadata    Json?

  createdBy   String?
  promotedBy  String?
  promotedAt  DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ruleset      DomainRuleset @relation(fields: [rulesetId], references: [id])
  patterns     RulePattern[]
  flowTemplates FlowTemplate[]

  @@unique([rulesetId, version])
  @@index([rulesetId, status])
}
```

### RulePattern

```prisma
model RulePattern {
  id              String   @id @default(uuid())
  rulesetVersionId String

  key             String
  name            String
  description     String?
  patternType     RulePatternType
  severity        RuleSeverity @default(INFO)

  matcherJson     Json
  outputJson      Json
  confidenceBase  Float @default(0.7)

  source          RuleSource @default(SYSTEM)
  isActive        Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  rulesetVersion  DomainRulesetVersion @relation(fields: [rulesetVersionId], references: [id])
  triggers        RuleTrigger[]

  @@index([rulesetVersionId, patternType])
  @@index([source])
}
```

### RuleTrigger

```prisma
model RuleTrigger {
  id            String @id @default(uuid())
  rulePatternId String

  triggerType   RuleTriggerType
  value         String
  weight        Float @default(1.0)

  createdAt     DateTime @default(now())

  rulePattern   RulePattern @relation(fields: [rulePatternId], references: [id])

  @@index([triggerType, value])
  @@index([rulePatternId])
}
```

### FlowTemplate

```prisma
model FlowTemplate {
  id                String @id @default(uuid())
  rulesetVersionId  String

  key               String
  name              String
  description       String?
  workflowType      String

  statesJson        Json
  transitionsJson   Json
  edgeCasesJson     Json
  requiredEventsJson Json?
  metadata          Json?

  confidenceBase    Float @default(0.75)
  isActive          Boolean @default(true)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  rulesetVersion    DomainRulesetVersion @relation(fields: [rulesetVersionId], references: [id])

  @@index([rulesetVersionId])
  @@index([workflowType])
}
```

### AIFlowDraft

```prisma
model AIFlowDraft {
  id              String @id @default(uuid())

  organizationId  String
  applicationId   String
  environmentId   String?

  source          AIFlowDraftSource
  status          AIFlowDraftStatus @default(PENDING_REVIEW)

  productDescription String?
  inferredDomainKey  String?
  rulesetVersionIds  String[]

  promptHash      String
  provider        String
  model           String
  aiInvocationId  String?

  draftJson       Json
  validationJson  Json?
  confidence      Float @default(0.0)

  createdBy       String?
  reviewedBy      String?
  reviewedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, applicationId])
  @@index([status])
  @@index([inferredDomainKey])
}
```

### DeclaredStateSuggestion

```prisma
model DeclaredStateSuggestion {
  id              String @id @default(uuid())

  organizationId  String
  applicationId   String
  flowId          String?

  suggestionType  SuggestionType
  title           String
  description     String?
  category        String?
  severity        RuleSeverity @default(INFO)

  suggestedStatesJson      Json?
  suggestedTransitionsJson Json?
  evidenceJson             Json?
  rationale                String?

  source          SuggestionSource
  status          SuggestionStatus @default(PENDING)

  confidence      Float @default(0.0)

  rulesetVersionIds String[]
  rulePatternIds    String[]
  aiInvocationId    String?

  acceptedBy      String?
  acceptedAt      DateTime?
  rejectedBy      String?
  rejectedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, applicationId])
  @@index([flowId])
  @@index([status])
  @@index([suggestionType])
}
```

### RuleFeedback

```prisma
model RuleFeedback {
  id              String @id @default(uuid())

  organizationId  String
  applicationId   String?

  rulePatternId   String?
  suggestionId    String?
  aiFlowDraftId   String?

  feedbackType    RuleFeedbackType
  beforeJson      Json?
  afterJson       Json?
  comment         String?

  createdBy       String?
  createdAt       DateTime @default(now())

  @@index([organizationId, applicationId])
  @@index([rulePatternId])
  @@index([suggestionId])
  @@index([aiFlowDraftId])
}
```

### RuleCandidate

```prisma
model RuleCandidate {
  id              String @id @default(uuid())

  domainId        String?
  organizationId  String?
  applicationId   String?

  source          RuleCandidateSource
  status          RuleCandidateStatus @default(PENDING_REVIEW)

  candidateJson   Json
  evidenceJson    Json?
  confidence      Float @default(0.0)

  promotedRulePatternId String?
  reviewedBy      String?
  reviewedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([domainId])
  @@index([status])
  @@index([source])
}
```

### AIInvocationLog

```prisma
model AIInvocationLog {
  id              String @id @default(uuid())

  organizationId  String
  applicationId   String?

  feature         AIFeature
  provider        String
  model           String

  promptHash      String
  inputSummaryJson Json?
  outputSummaryJson Json?

  status          AIInvocationStatus
  errorCode       String?
  errorMessage    String?

  inputTokens     Int?
  outputTokens    Int?
  latencyMs       Int?
  costEstimate    Decimal?

  createdBy       String?
  createdAt       DateTime @default(now())

  @@index([organizationId, applicationId])
  @@index([feature])
  @@index([provider, model])
  @@index([status])
}
```

## 5.2 Enums

```prisma
enum RulesetScope {
  GLOBAL
  ORGANIZATION
  APPLICATION
}

enum RulesetStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum RulesetVersionStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum RulePatternType {
  DOMAIN_INFERENCE
  STATE_EXPECTATION
  TRANSITION_EXPECTATION
  MISSING_STATE
  MISSING_FLOW
  EDGE_CASE
  VALIDATION_CONSTRAINT
  RECOVERY_FLOW
}

enum RuleTriggerType {
  KEYWORD
  ROUTE_PATTERN
  API_PATTERN
  EVENT_TYPE
  STATE_NAME
  COMPONENT_NAME
  WORKFLOW_NAME
}

enum RuleSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}

enum RuleSource {
  SYSTEM
  ADMIN
  USER_FEEDBACK
  AI_CANDIDATE
  OBSERVED_BEHAVIOR
}

enum AIFlowDraftSource {
  ONBOARDING_PROMPT
  FLOW_BUILDER
  ADMIN_TEST
}

enum AIFlowDraftStatus {
  PENDING_REVIEW
  ACCEPTED
  PARTIALLY_ACCEPTED
  REJECTED
  EXPIRED
}

enum SuggestionType {
  PREREQUISITE
  IN_STATE_VALIDATION
  POST_REQUISITE
  ERROR_PATH
  EMPTY_STATE
  LOADING_STATE
  RECOVERY_PATH
  SECURITY_STATE
  BUSINESS_RULE
}

enum SuggestionSource {
  RULE_ENGINE
  AI
  HYBRID
}

enum SuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
  EDITED
  DISMISSED
}

enum RuleFeedbackType {
  ACCEPTED
  REJECTED
  EDITED
  DISMISSED
  PROMOTED
}

enum RuleCandidateSource {
  AI
  USER_FEEDBACK
  OBSERVED_FLOW_VARIATION
  ADMIN_CREATED
}

enum RuleCandidateStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  PROMOTED
  MERGED
}

enum AIFeature {
  FLOW_GENERATION
  FLOW_SUGGESTION
  DOMAIN_INFERENCE
  OUTPUT_REPAIR
}

enum AIInvocationStatus {
  SUCCESS
  FAILED
  VALIDATION_FAILED
  TIMEOUT
  RATE_LIMITED
}
```

## 5.3 Migration Notes

Use normal Prisma migrations for tables.

For JSON query performance, add indexes via raw SQL where needed:

```sql
CREATE INDEX IF NOT EXISTS idx_rule_pattern_matcher_json
ON "RulePattern" USING GIN ("matcherJson");

CREATE INDEX IF NOT EXISTS idx_rule_pattern_output_json
ON "RulePattern" USING GIN ("outputJson");
```

If `String[]` is retained for any model, add GIN indexes manually:

```sql
CREATE INDEX IF NOT EXISTS idx_ai_flow_draft_ruleset_versions
ON "AIFlowDraft" USING GIN ("rulesetVersionIds");
```

---

# 6. Ruleset Seeding

## 6.1 Seed Sources

Seed initial rules from current static packages:

```txt
packages/rules/src/ecommerce.ts
packages/rules/src/lms.ts
packages/rules/src/generic.ts
packages/rules/src/auth.ts
packages/rules/src/crud.ts
```

## 6.2 Seed Script

Create:

```txt
packages/db/prisma/seeds/rulesets.ts
```

The script should:

1. Upsert default domains.
2. Upsert default rulesets.
3. Create active ruleset version if missing.
4. Insert rule patterns.
5. Insert triggers.
6. Insert flow templates.
7. Archive old active version only when a newer one is promoted.

## 6.3 Seed Idempotency

The seed script must be safe to run repeatedly.

Use stable keys:

```txt
LMS.COURSE_ENROLLMENT
LMS.COURSE_CREATION
LMS.ASSESSMENT_SUBMISSION
ECOMMERCE.CHECKOUT
ECOMMERCE.CART_MANAGEMENT
AUTH.LOGIN
AUTH.REGISTRATION
CRUD.CREATE_ENTITY
```

Do not key seed data by generated UUID alone.

---

# 7. Rules Package Refactor

## 7.1 Keep Static Fallbacks

Do not delete the existing static rules immediately.

Refactor into:

```txt
packages/rules
├── src
│   ├── fallback
│   │   ├── ecommerce.ts
│   │   ├── lms.ts
│   │   ├── auth.ts
│   │   └── generic-crud.ts
│   ├── db
│   │   ├── ruleset-repository.ts
│   │   ├── ruleset-compiler.ts
│   │   └── domain-inference.ts
│   ├── engine
│   │   ├── rule-engine.ts
│   │   ├── matcher.ts
│   │   ├── scoring.ts
│   │   └── suggestions.ts
│   └── index.ts
```

## 7.2 Public Rules API

Expose:

```ts
export async function getActiveRulesets(input: {
  organizationId?: string;
  applicationId?: string;
  domainKey?: string;
}): Promise<CompiledRuleset[]>;

export async function inferDomain(input: {
  description?: string;
  routes?: string[];
  endpoints?: string[];
  labels?: string[];
  organizationId?: string;
  applicationId?: string;
}): Promise<DomainInferenceResult>;

export async function generateRuleBasedFlow(input: {
  domainKey: string;
  productDescription?: string;
  workflowType?: string;
  rulesets: CompiledRuleset[];
}): Promise<FlowDraft>;

export async function suggestFlowGaps(input: {
  domainKey: string;
  currentGraph: DeclaredGraphInput;
  rulesets: CompiledRuleset[];
}): Promise<FlowSuggestion[]>;
```

## 7.3 Domain Inference Scoring

Use weighted signals:

```txt
Product description keyword match       35%
Route/API pattern match                  25%
User-selected category                   20%
Workflow labels                          10%
Existing graph state names               10%
```

Example result:

```json
{
  "domainKey": "LMS",
  "confidence": 0.84,
  "secondaryDomains": [
    {
      "domainKey": "PAYMENTS",
      "confidence": 0.42
    }
  ],
  "matchedTriggers": [
    "course",
    "student",
    "assessment",
    "cohort"
  ]
}
```

## 7.4 Rule Engine Output

Rule engine output should match the same internal schema used by AI:

```ts
type FlowDraft = {
  domainKey: string;
  confidence: number;
  assumptions: string[];
  workflows: GeneratedWorkflow[];
  missingFlowCandidates: GeneratedMissingFlow[];
  missingStateCandidates: GeneratedMissingState[];
  source: "RULE_ENGINE" | "AI" | "HYBRID";
};
```

Reason: the rest of the system should not care whether a draft came from rules or AI.

---

# 8. AI Provider Layer

## 8.1 Package Location

Create:

```txt
packages/ai
```

Recommended structure:

```txt
packages/ai
├── src
│   ├── providers
│   │   ├── base.ts
│   │   ├── gemini-provider.ts
│   │   ├── deepseek-provider.ts
│   │   └── mock-provider.ts
│   ├── prompts
│   │   ├── flow-generation.prompt.ts
│   │   ├── flow-suggestion.prompt.ts
│   │   └── repair-json.prompt.ts
│   ├── schemas
│   │   ├── flow-generation.schema.ts
│   │   ├── flow-suggestion.schema.ts
│   │   └── ai-common.schema.ts
│   ├── ai-client.ts
│   ├── ai-config.ts
│   ├── ai-errors.ts
│   └── index.ts
```

## 8.2 Provider Interface

```ts
export interface AIProvider {
  name: "gemini" | "deepseek" | "mock";

  generateFlow(input: AIFlowGenerationInput): Promise<AIFlowGenerationResult>;

  suggestFlowGaps(input: AIFlowSuggestionInput): Promise<AIFlowSuggestionResult>;

  repairJson?<T>(input: {
    invalidOutput: string;
    schemaName: string;
    errorSummary: string;
  }): Promise<T>;
}
```

## 8.3 Environment Variables

```env
AI_FEATURES_ENABLED=false
AI_FLOW_GENERATION_ENABLED=false
AI_FLOW_SUGGESTIONS_ENABLED=false

AI_PROVIDER=auto
AI_PRIMARY_PROVIDER=gemini
AI_FALLBACK_PROVIDER=deepseek

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat

AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_RETRIES=2
AI_MAX_INPUT_TOKENS=12000
AI_MAX_OUTPUT_TOKENS=4000

AI_LOG_PROMPTS=false
AI_STORE_RAW_OUTPUT=false
AI_REDACT_INPUTS=true
```

## 8.4 Provider Strategy

Use native `fetch`.

Avoid heavy SDK dependencies for launch.

Initial priority:

```txt
1. Gemini structured output if configured
2. DeepSeek JSON output fallback
3. Mock provider for local tests
4. Rule-engine-only fallback if all AI providers fail
```

## 8.5 Timeout and Retry Rules

```txt
Timeout per request: 30 seconds
Retries: 2
Retry only on:
- network timeout
- 429 rate limit
- 5xx provider error

Do not retry on:
- invalid API key
- schema validation failure after repair
- unsafe input rejection
```

## 8.6 AI Error Handling

Return graceful fallback:

```json
{
  "success": false,
  "fallbackUsed": true,
  "message": "AI suggestions are temporarily unavailable. Rule-based suggestions were generated instead.",
  "data": {
    "suggestions": []
  }
}
```

Never block onboarding because AI failed.

---

# 9. AI Input/Output Schemas

## 9.1 Flow Generation Input

```ts
export const AIFlowGenerationInputSchema = z.object({
  organizationId: z.string(),
  applicationId: z.string(),
  productDescription: z.string().min(20).max(5000),
  inferredDomain: z.object({
    key: z.string(),
    confidence: z.number(),
    secondaryDomains: z.array(z.string()).default([]),
  }),
  rulesetContext: z.object({
    domainKey: z.string(),
    activeRulesetVersions: z.array(z.string()),
    flowTemplates: z.array(z.any()),
    rulePatterns: z.array(z.any()),
  }),
  existingGraph: z.any().optional(),
});
```

## 9.2 Flow Generation Output

```ts
export const AIFlowGenerationOutputSchema = z.object({
  domainKey: z.string(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  workflows: z.array(z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    entryState: z.string(),
    exitState: z.string(),
    states: z.array(z.object({
      key: z.string(),
      name: z.string(),
      category: z.enum(["NAVIGATION", "UI", "BUSINESS", "ERROR", "SYSTEM"]),
      description: z.string().optional(),
    })),
    transitions: z.array(z.object({
      from: z.string(),
      to: z.string(),
      action: z.string(),
      type: z.enum(["SUCCESS", "FAILURE", "RETRY", "LOOP", "EXIT"]).default("SUCCESS"),
    })),
    edgeCases: z.array(z.object({
      key: z.string(),
      name: z.string(),
      category: z.string(),
      criticality: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    })).default([]),
    confidence: z.number().min(0).max(1),
  })),
});
```

## 9.3 Flow Suggestion Output

```ts
export const AIFlowSuggestionOutputSchema = z.object({
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.object({
    type: z.enum([
      "PREREQUISITE",
      "IN_STATE_VALIDATION",
      "POST_REQUISITE",
      "ERROR_PATH",
      "EMPTY_STATE",
      "LOADING_STATE",
      "RECOVERY_PATH",
      "SECURITY_STATE",
      "BUSINESS_RULE"
    ]),
    title: z.string(),
    description: z.string(),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
    suggestedStates: z.array(z.object({
      key: z.string(),
      name: z.string(),
      category: z.string(),
    })).default([]),
    suggestedTransitions: z.array(z.object({
      from: z.string(),
      to: z.string(),
      action: z.string(),
    })).default([]),
  })),
});
```

---

# 10. Graph Validation Layer

Create:

```txt
packages/graph-validation
```

or place under existing graph engine:

```txt
services/graph-engine/src/validation
```

## 10.1 Validation Rules

Before AI or ruleset output becomes a graph draft, validate:

```txt
All states have unique keys.
All transitions reference existing states.
No duplicate transitions.
No orphan states unless allowed.
No circular loops unless transition type is LOOP or RETRY.
Entry state exists.
Exit state exists.
State names follow UPPER_SNAKE_CASE or are normalized.
Categories are valid.
Criticality values are valid.
Confidence values are 0–1.
Workflow has at least one state and one transition.
```

## 10.2 Normalization Rules

Normalize:

```txt
"Course Created" → COURSE_CREATED
"course-created" → COURSE_CREATED
"course.created" → COURSE_CREATED
```

## 10.3 Validation Output

```ts
type GraphValidationResult = {
  valid: boolean;
  errors: GraphValidationError[];
  warnings: GraphValidationWarning[];
  normalizedGraph?: GeneratedFlowGraph;
};
```

## 10.4 Hard Failure Conditions

Reject draft if:

```txt
No workflows returned.
Transitions reference missing states.
State count exceeds configured limit.
Output contains unsafe/sensitive data.
Output cannot be parsed.
Provider returned non-JSON after repair.
```

---

# 11. Privacy and Safety Layer

## 11.1 Sanitization Before AI

Create:

```txt
packages/ai/src/privacy/sanitize-ai-input.ts
```

The sanitizer must remove:

```txt
emails
phone numbers
passwords
tokens
API keys
payment details
names where possible
raw form data
raw request bodies
headers
cookies
authorization values
```

## 11.2 AI Input Policy

Allowed input:

```txt
Product description
Domain key
State names
Workflow names
Route patterns
Endpoint patterns without query values
Rule summaries
Graph topology
```

Disallowed input:

```txt
Raw user data
Raw request body
Raw response body
Auth headers
Cookies
Tokens
Secrets
Payment information
Full session replay payloads
```

## 11.3 AI Logging Policy

Default:

```env
AI_LOG_PROMPTS=false
AI_STORE_RAW_OUTPUT=false
```

Store only:

```txt
promptHash
input summary
output summary
provider
model
latency
token count
status
validation result
```

For local debugging, allow raw prompt logging only when explicitly enabled in development.

---

# 12. Feature Flag Strategy

## 12.1 Global Flags

```txt
AI_FEATURES_ENABLED
AI_FLOW_GENERATION_ENABLED
AI_FLOW_SUGGESTIONS_ENABLED
```

## 12.2 Organization-Level Flags

Add or reuse feature entitlement system:

```txt
experimentalAiFlowGeneration
experimentalAiFlowSuggestions
```

## 12.3 User Interface Rules

If flag disabled:

```txt
Hide AI generation buttons.
Hide AI suggestion actions.
Use database-backed rules only.
```

If flag enabled:

```txt
Show "Experimental" badge.
Show review warning before applying AI draft.
Require user confirmation before graph mutation.
```

## 12.4 API-Level Enforcement

Never rely only on UI flags.

Every AI endpoint must check:

```txt
global flag
organization entitlement
user role
rate limit
application ownership
```

---

# 13. API Implementation

## 13.1 Ruleset APIs

Add to `services/fdrs-api` or `services/api-gateway` routed module:

### List Domains

```http
GET /v1/rules/domains
```

### List Rulesets

```http
GET /v1/rules/rulesets?domainKey=LMS
```

### Get Active Ruleset

```http
GET /v1/rules/domains/:domainKey/active
```

### Admin Create Ruleset Version

```http
POST /v1/admin/rules/rulesets/:rulesetId/versions
```

### Promote Ruleset Version

```http
POST /v1/admin/rules/ruleset-versions/:versionId/promote
```

## 13.2 AI Flow Generation API

```http
POST /v1/applications/:appId/flows/ai-drafts
```

Request:

```json
{
  "productDescription": "An LMS where students bid on course access via token auctions",
  "selectedDomainKey": "LMS",
  "mode": "ONBOARDING_PROMPT"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "draftId": "uuid",
    "status": "PENDING_REVIEW",
    "confidence": 0.82,
    "workflows": [],
    "warnings": []
  }
}
```

## 13.3 Accept AI Draft API

```http
POST /v1/applications/:appId/flows/ai-drafts/:draftId/accept
```

Request:

```json
{
  "acceptedWorkflowKeys": ["COURSE_AUCTION_ENROLLMENT"],
  "createDeclaredGraphVersion": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "behaviorGraphId": "uuid",
    "graphVersionId": "uuid",
    "acceptedWorkflows": 1
  }
}
```

## 13.4 Reject AI Draft API

```http
POST /v1/applications/:appId/flows/ai-drafts/:draftId/reject
```

Request:

```json
{
  "reason": "Too generic"
}
```

## 13.5 AI Suggestions API

```http
POST /v1/applications/:appId/declared-flows/:flowId/ai-suggestions
```

Request:

```json
{
  "focusStateKey": "COURSE_ENROLLED",
  "includePrerequisites": true,
  "includeValidations": true,
  "includePostRequisites": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "uuid",
        "type": "PREREQUISITE",
        "title": "Course must be published before enrollment",
        "confidence": 0.91,
        "severity": "HIGH"
      }
    ]
  }
}
```

## 13.6 Suggestion Actions

```http
POST /v1/applications/:appId/declared-flows/:flowId/suggestions/:suggestionId/accept
POST /v1/applications/:appId/declared-flows/:flowId/suggestions/:suggestionId/reject
POST /v1/applications/:appId/declared-flows/:flowId/suggestions/:suggestionId/edit
POST /v1/applications/:appId/declared-flows/:flowId/suggestions/:suggestionId/dismiss
```

---

# 14. Onboarding API Changes

## 14.1 Current Route

```http
POST /applications/:appId/profile
```

## 14.2 Revised Behavior

The route should support:

```txt
DEFAULT_TEMPLATE
PROMPT_RULE_BASED
PROMPT_AI_EXPERIMENTAL
CUSTOM_BLANK
```

## 14.3 Flow

```txt
Receive profile input
        ↓
Infer domain
        ↓
Fetch active rulesets
        ↓
If DEFAULT_TEMPLATE:
    generate rule-based draft
If PROMPT_RULE_BASED:
    customize using dynamic rules only
If PROMPT_AI_EXPERIMENTAL:
    create AIFlowDraft
If CUSTOM_BLANK:
    create empty declared graph
        ↓
Return draft/proposal, not active graph unless user accepts
```

## 14.4 Important Correction

Do not insert AI-generated graph elements directly as active `BehaviorGraph`.

Instead:

```txt
AIFlowDraft.status = PENDING_REVIEW
```

Then the dashboard renders a review screen:

```txt
Generated workflows
Generated states
Generated transitions
Generated edge cases
Assumptions
Warnings
Accept / Edit / Reject
```

---

# 15. Flow Builder UI Implementation

## 15.1 Sidebar Sections

Add a right-side suggestion panel:

```txt
Suggestions
├── Prerequisites
├── Validation / Constraints
├── Downstream Flows
├── Error Paths
├── Recovery Paths
└── Empty / Loading States
```

## 15.2 Suggestion Card

Each card should show:

```txt
Title
Type
Confidence
Severity
Reason
Suggested states/transitions
Accept
Edit
Reject
```

## 15.3 Experimental Badge

Show:

```txt
Experimental AI Suggestion
Review before applying
```

## 15.4 User Actions

### Accept

Creates graph nodes/edges after validation.

### Edit

Opens a modal with editable state/transition fields.

### Reject

Stores feedback.

### Dismiss

Hides without strong negative feedback.

## 15.5 Canvas Integration

Accepted suggestions should appear as:

```txt
New nodes highlighted
New edges highlighted
Unsaved changes indicator
```

The user must still save the graph version.

---

# 16. Rule Learning Loop

## 16.1 Feedback Collection

Every accepted/rejected/edited suggestion creates `RuleFeedback`.

## 16.2 Candidate Generation

A background job should periodically analyze feedback:

```txt
If similar suggestion accepted by many users in same domain:
    create RuleCandidate
```

Example:

```txt
Many LMS users accept:
"Course must be published before enrollment"

Create candidate:
LMS.COURSE_PUBLISHED_BEFORE_ENROLLMENT
```

## 16.3 Promotion

Admin reviews candidate:

```txt
PENDING_REVIEW → APPROVED → PROMOTED
```

Promotion creates a new `RulePattern` in a draft ruleset version.

## 16.4 Version Release

Admin promotes ruleset version:

```txt
DRAFT version 3 → ACTIVE
ACTIVE version 2 → ARCHIVED
```

Old reports remain traceable to version 2.

---

# 17. Background Jobs

Create worker jobs:

```txt
ruleset-feedback-analyzer
ai-draft-expiry-cleaner
ai-invocation-metrics-aggregator
rule-candidate-promoter
ruleset-cache-warmer
```

## 17.1 AI Draft Expiry

Expire unreviewed drafts after:

```txt
Default: 14 days
```

## 17.2 Cache Warmer

Warm active rulesets for common domains:

```txt
ECOMMERCE
LMS
AUTH
GENERIC_CRUD
SAAS
MARKETPLACE
BOOKING
```

---

# 18. Caching Strategy

## 18.1 Cache Active Rulesets

Cache key:

```txt
ruleset:active:{organizationId}:{applicationId}:{domainKey}
```

TTL:

```txt
5 minutes in development
30 minutes in production
```

## 18.2 Bust Cache On

```txt
Ruleset version promoted
Ruleset disabled
Rule pattern updated
Domain disabled
Application-specific override changed
```

## 18.3 Fallback

If database lookup fails:

```txt
Use static fallback templates
Log warning
Continue user flow
```

---

# 19. Observability

## 19.1 Metrics

Track:

```txt
ruleset_lookup_duration_ms
ruleset_cache_hit_rate
domain_inference_confidence
ai_invocation_count
ai_invocation_latency_ms
ai_invocation_failure_rate
ai_validation_failure_rate
ai_draft_acceptance_rate
ai_suggestion_acceptance_rate
ai_suggestion_rejection_rate
rule_candidate_creation_count
```

## 19.2 Logs

Structured logs:

```json
{
  "event": "ai_flow_generation_completed",
  "organizationId": "org_123",
  "applicationId": "app_123",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "status": "SUCCESS",
  "latencyMs": 1842,
  "confidence": 0.82
}
```

Do not log raw prompts by default.

## 19.3 Dashboard Admin View

Add internal admin page:

```txt
AI Usage
Ruleset Versions
Rule Candidates
Suggestion Acceptance Rate
Provider Error Rate
```

---

# 20. Security Controls

## 20.1 Role Permissions

Only users with appropriate roles can:

```txt
Generate AI drafts
Accept AI drafts
Request AI suggestions
Promote rulesets
Edit global rulesets
View AI invocation logs
```

Suggested permissions:

```txt
Developer:
- request AI suggestions
- accept suggestions on own app

QA Engineer:
- request and accept suggestions
- review flow drafts

Organization Admin:
- enable experimental AI for org
- view usage

System Admin:
- edit global rulesets
- promote rule candidates
```

## 20.2 Tenant Isolation

Every query must include:

```txt
organizationId
applicationId where applicable
```

No global ruleset mutation from tenant feedback without review.

## 20.3 Audit Events

Log:

```txt
AI_FLOW_DRAFT_CREATED
AI_FLOW_DRAFT_ACCEPTED
AI_FLOW_DRAFT_REJECTED
AI_SUGGESTION_ACCEPTED
AI_SUGGESTION_REJECTED
RULESET_VERSION_CREATED
RULESET_VERSION_PROMOTED
RULE_PATTERN_CREATED
RULE_CANDIDATE_PROMOTED
EXPERIMENTAL_AI_ENABLED
EXPERIMENTAL_AI_DISABLED
```

---

# 21. Testing Plan

## 21.1 Unit Tests

### Rules Package

Test:

```txt
Domain inference by keyword
Domain inference by route pattern
Domain inference by endpoint pattern
Ruleset compilation
Rule trigger weighting
Fallback template loading
Suggestion generation from rules
```

### AI Package

Test:

```txt
Prompt construction
Input sanitization
Provider request formatting
Gemini response parsing
DeepSeek response parsing
Malformed JSON handling
Schema validation
JSON repair fallback
Timeout handling
Retry handling
```

### Graph Validation

Test:

```txt
Duplicate state detection
Invalid transition detection
Orphan state warning
Circular flow detection
State normalization
Invalid category rejection
Confidence range validation
```

## 21.2 Integration Tests

Test:

```txt
Seed rulesets into database
Fetch active LMS ruleset
Generate rule-based LMS flow
Generate AI draft with mock provider
Accept AI draft into declared graph
Reject AI draft
Generate suggestions for existing flow
Accept suggestion into graph
Store feedback
Create rule candidate from feedback
```

## 21.3 E2E Tests

Scenario 1:

```txt
User creates LMS application
User enters niche LMS description
System infers LMS domain
System creates AI flow draft
User accepts selected workflow
Dashboard renders declared graph
Coverage engine processes graph
```

Scenario 2:

```txt
User opens flow builder
User creates COURSE_ENROLLED state
User requests suggestions
System suggests COURSE_CREATED and COURSE_PUBLISHED prerequisites
User accepts suggestion
Graph updates
Feedback stored
```

Scenario 3:

```txt
AI provider unavailable
User requests AI generation
System falls back gracefully
Rule-based draft still generated
No onboarding failure
```

## 21.4 Manual Verification

Use these test descriptions:

```txt
An LMS where students bid on course access via token auctions.
A healthcare appointment system with doctor availability and insurance approval.
A marketplace where sellers rent digital assets to buyers.
A SaaS billing system with trials, upgrades, downgrades, failed payments, and grace periods.
A logistics platform with pickup scheduling, failed delivery, rerouting, and proof of delivery.
```

Expected result:

```txt
Generated flows include niche domain states.
Suggested gaps are context-aware.
Invalid graph structures are rejected.
No AI output becomes active without review.
Experimental labels are visible.
```

---

# 22. Rollout Plan

## Phase A — Database Ruleset Foundation

Deliver:

```txt
Domain models
Ruleset models
Ruleset versioning
Rule patterns
Rule triggers
Flow templates
Seed script
Fallback static templates
Ruleset repository
Ruleset compiler
Domain inference
```

Exit criteria:

```txt
Existing hardcoded behavior still works.
Rules can be loaded from database.
Fallback works if database rules fail.
Tests pass.
```

## Phase B — Rule-Based Flow Generation

Deliver:

```txt
Rule-based generation from DB templates
Domain inference from description
Onboarding integration
Graph proposal flow
User review before graph activation
```

Exit criteria:

```txt
User can define app with description.
System generates rule-based draft.
User can accept draft into declared graph.
```

## Phase C — AI Provider Layer

Deliver:

```txt
packages/ai
Gemini provider
DeepSeek provider
Mock provider
Prompt builder
Zod schemas
Sanitization
Invocation logging
Retry/fallback logic
```

Exit criteria:

```txt
Mock provider works in tests.
Gemini/DeepSeek work when keys are present.
Malformed outputs are rejected.
AI failures do not break onboarding.
```

## Phase D — Experimental AI Flow Generation

Deliver:

```txt
AIFlowDraft table
POST /flows/ai-drafts
Accept/reject draft APIs
Dashboard review screen
Experimental labels
Feature flag enforcement
```

Exit criteria:

```txt
AI-generated flow is saved as draft.
User reviews before applying.
Accepted graph is valid.
Rejected draft stores feedback.
```

## Phase E — Experimental AI Flow Suggestions

Deliver:

```txt
DeclaredStateSuggestion table
POST /ai-suggestions endpoint
Suggestion sidebar
Accept/edit/reject/dismiss actions
Feedback storage
Graph update after acceptance
```

Exit criteria:

```txt
User can request contextual suggestions.
Suggestions appear in sidebar.
Accepted suggestions update graph safely.
Rejected suggestions store feedback.
```

## Phase F — Rule Feedback and Candidate Loop

Deliver:

```txt
RuleFeedback table
RuleCandidate table
Feedback analyzer job
Internal admin review endpoint
Ruleset version promotion flow
```

Exit criteria:

```txt
Accepted/rejected suggestions influence candidate creation.
Candidates do not become active automatically.
Admin can promote candidates into new ruleset version.
```

## Phase G — Launch Hardening

Deliver:

```txt
Rate limits
Usage metrics
Audit logs
Prompt redaction verification
Provider failure tests
Load tests
Feature flag tests
Docs copy
Experimental UI labels
```

Exit criteria:

```txt
Feature works behind flags.
Public ruleset behavior works without AI.
AI failure does not damage core product flow.
No sensitive data is sent to AI provider.
```

---

# 23. Suggested Implementation Order

Recommended order:

```txt
1. Add database models and migrations.
2. Seed current static rules into DB.
3. Refactor rules package to read DB rules with static fallback.
4. Add ruleset compiler and domain inference.
5. Modify onboarding to use database-backed rules.
6. Add graph proposal/review flow.
7. Add AI package with mock provider first.
8. Add Gemini/DeepSeek providers.
9. Add AIFlowDraft flow.
10. Add AI suggestions endpoint.
11. Add dashboard suggestion sidebar.
12. Add feedback and rule candidate loop.
13. Add admin/internal governance tools.
14. Add full testing and launch flags.
```

---

# 24. Acceptance Criteria

## Dynamic Rulesets

Complete when:

```txt
Rulesets are stored in PostgreSQL.
Rulesets are versioned.
Rulesets can be seeded from existing static templates.
Rulesets can be queried by domain.
Domain inference uses database triggers.
Ruleset fallback works.
Generated reports remain traceable to ruleset version.
```

## AI Flow Generation

Complete when:

```txt
AI generation is behind experimental flag.
AI output is stored as draft/proposal.
AI output is schema-validated.
AI output is graph-validated.
User must accept before graph mutation.
Provider failure falls back gracefully.
AI invocation is logged without raw sensitive data.
```

## AI Flow Suggestions

Complete when:

```txt
Suggestions are generated from current graph context.
Suggestions are grouped into prerequisites, validations, and post-requisites.
Suggestions are stored separately from active graph.
User can accept, edit, reject, or dismiss.
Accepted suggestions pass graph validation.
Feedback is stored.
```

## Launch Safety

Complete when:

```txt
AI can be disabled globally.
AI can be enabled per organization.
AI can be hidden from public users.
No core MVP flow depends on AI.
No raw sensitive data is sent to AI.
All AI outputs are explainable and confidence-scored.
```

---

# 25. Final Engineering Principle

The core product truth must remain:

```txt
Observed behavior
Declared behavior
Approved rulesets
Validated graph structure
```

AI is only allowed to propose.

Rules may guide.

Users approve.

Graphs remember.

Reports explain.
