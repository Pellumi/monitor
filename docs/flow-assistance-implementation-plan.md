# Implementation Plan: AI-Assisted Flow Declaration, Demonstration Analysis, and Expected-vs-Observed QA Reporting Before MVP Launch

## 1. Implementation Objective

The goal is to implement a pre-MVP enhancement that allows Tellann/SOTS to help users define expected application behavior before or during a demonstration session, then compare that expected behavior against what was actually observed.

The implementation should support:

1. Manual flow declaration.
2. Rule-based flow and edge-case suggestions.
3. Optional AI-assisted prompt-to-flow drafting.
4. Editable expected behavior graph.
5. Developer demonstration recording.
6. Observed behavior graph generation.
7. Expected-vs-observed reconciliation.
8. Missing flow and missing state detection.
9. Endpoint performance analysis.
10. QA report generation.

The implementation must not attempt to perform full autonomous test execution, production monitoring, failure injection, database intelligence, regression detection, or behavioral anomaly prediction before MVP launch.

## 2. MVP Boundary

### Included Before MVP Launch

The following features are approved for MVP implementation:

* Application use-case prompt input.
* Flow Builder UI.
* Domain template selection.
* Shopping application default template.
* Rule-based suggested states, transitions, and edge cases.
* Optional AI draft generation for expected flows.
* User approval/editing of suggested flows.
* Expected behavior graph storage.
* Demonstration session recording.
* Observed behavior graph generation.
* Expected-vs-observed graph comparison.
* Missing flow detection.
* Missing state detection.
* Coverage scoring.
* Endpoint latency/error analysis.
* QA report updates.
* Dashboard views for expected graph, observed graph, and gaps.

### Excluded Before MVP Launch

The following features must remain out of MVP:

* Full autonomous test execution.
* Playwright/Cypress test generation as a core product promise.
* Network failure simulation.
* Payment gateway failure injection.
* Production user monitoring.
* Database query intelligence.
* AI root-cause analysis.
* AI quality assistant chat.
* Release regression detection.
* Behavioral anomaly detection.
* Real-user friction prediction.

These can be prepared architecturally but should not be sold or treated as launch functionality.

## 3. Product Flow

The final MVP user flow should be:

```text
Create Organization
    ↓
Create Application
    ↓
Select App Type or Describe Use Case
    ↓
Generate / Build Expected Flow
    ↓
Review Suggested States, Flows, Transitions, Edge Cases
    ↓
Accept / Edit / Reject Suggestions
    ↓
Install SDK
    ↓
Start Demonstration Session
    ↓
Perform Application Walkthrough
    ↓
Generate Observed Graph
    ↓
Compare Expected Graph vs Observed Graph
    ↓
Generate QA Report
```

For the shopping app example:

```text
User describes:
"This is an e-commerce app where users register, login, browse products, wishlist items, add to cart, checkout, pay, and track orders."

System generates:
- Authentication workflow
- Product browsing workflow
- Product details workflow
- Wishlist workflow
- Cart workflow
- Checkout workflow
- Payment workflow
- Order tracking workflow
- Empty states
- Loading states
- Error states
- Recovery flows
```

Then the developer demonstrates the real application.

The system reports:

```text
Expected:
PAYMENT_FAILED

Observed:
Not demonstrated

Finding:
Missing checkout failure path

Recommendation:
Validate payment failure and retry payment handling before release.
```

## 4. Core Concept: Expected Graph vs Observed Graph

The MVP should introduce a clear distinction between four graph concepts.

### 4.1 Expected Graph

The expected graph represents what the user says the application should support.

Sources:

* Manual flow builder.
* Domain templates.
* AI prompt draft.
* System suggestions accepted by user.

This graph is user-approved intent.

### 4.2 Suggested Graph

The suggested graph represents possible states, flows, transitions, and edge cases recommended by the system.

Sources:

* Rule engine.
* Template library.
* AI prompt generation.

Suggested graph items are not facts. They are candidates.

Each suggested item must have a status:

```ts
type SuggestionStatus =
  | "SUGGESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "EDITED";
```

### 4.3 Observed Graph

The observed graph represents what the developer actually performed during the demonstration session.

Sources:

* SDK events.
* Session timeline.
* Route changes.
* Clicks.
* Form submissions.
* API responses.
* Error events.
* State transitions.

This graph is evidence.

### 4.4 Reconciliation Graph

The reconciliation graph is the comparison output.

It answers:

* What expected states were observed?
* What expected states were not observed?
* What expected transitions were observed?
* What expected transitions were not observed?
* What observed behavior was not declared?
* Which missing paths are critical?
* Which missing states should be tested manually?

## 5. Architecture Overview

Add a new pre-MVP capability called:

```text
Flow Declaration & Suggestion Engine
```

Recommended architecture:

```text
Flow Prompt / Manual Builder
        ↓
Domain Template Library
        ↓
Rule-Based Suggestion Engine
        ↓
Optional AI Draft Generator
        ↓
Expected Graph Store
        ↓
Developer Demonstration Session
        ↓
Observed Graph Generator
        ↓
Graph Reconciliation Engine
        ↓
Coverage + Gap Analysis
        ↓
QA Report Engine
        ↓
Dashboard
```

## 6. New and Updated Modules

### 6.1 Flow Builder UI

Location:

```text
apps/dashboard
```

Purpose:

Allow users to create and edit expected workflows visually.

Required screens:

1. Application use-case setup screen.
2. App type selector.
3. Prompt-to-flow screen.
4. Flow graph editor.
5. Suggested states panel.
6. Suggested edge cases panel.
7. Expected graph preview.
8. Demonstration readiness screen.
9. Expected-vs-observed comparison screen.

Core user actions:

* Create workflow.
* Add state.
* Add transition.
* Add edge case.
* Accept suggestion.
* Reject suggestion.
* Edit suggestion.
* Mark flow as critical.
* Save expected graph.
* Start demonstration.

### 6.2 Domain Template Library

Location:

```text
packages/rules
```

Purpose:

Provide deterministic templates for common application domains.

Initial domain templates:

```text
ecommerce
lms
saas
marketplace
fintech_basic
generic_crud
```

For MVP, prioritize:

```text
ecommerce
generic_crud
auth
```

E-commerce template should include:

```text
AUTHENTICATION
PRODUCT_BROWSING
PRODUCT_DETAILS
SEARCH
WISHLIST
CART
CHECKOUT
PAYMENT
ORDER_TRACKING
PROFILE
ERROR_HANDLING
```

Each template should define:

```ts
interface DomainTemplate {
  id: string;
  name: string;
  description: string;
  workflows: WorkflowTemplate[];
}

interface WorkflowTemplate {
  name: string;
  category: "AUTH" | "BROWSING" | "COMMERCE" | "ACCOUNT" | "ERROR" | "RECOVERY";
  states: StateTemplate[];
  transitions: TransitionTemplate[];
  edgeCases: EdgeCaseTemplate[];
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
```

### 6.3 Rule-Based Suggestion Engine

Location:

```text
services/graph-engine
```

or:

```text
services/flow-suggestion-engine
```

Preferred for MVP:

```text
services/graph-engine/src/suggestions
```

Purpose:

Generate edge-case suggestions from observed or declared flows.

Examples:

```text
LOGIN_SUCCESS
    → suggest LOGIN_FAILURE
    → suggest DISABLED_ACCOUNT
    → suggest PASSWORD_RESET
    → suggest SESSION_EXPIRED

PRODUCT_SEARCH
    → suggest NO_RESULTS
    → suggest SEARCH_LOADING
    → suggest SEARCH_API_TIMEOUT

ADD_TO_CART
    → suggest OUT_OF_STOCK
    → suggest CART_EMPTY
    → suggest QUANTITY_LIMIT_EXCEEDED

CHECKOUT_SUCCESS
    → suggest PAYMENT_FAILED
    → suggest PAYMENT_TIMEOUT
    → suggest ADDRESS_VALIDATION_FAILED
    → suggest INVENTORY_CHANGED

ORDER_TRACKING
    → suggest ORDER_NOT_FOUND
    → suggest DELIVERY_DELAYED
    → suggest CANCELLED_ORDER
```

Rule structure:

```ts
interface SuggestionRule {
  id: string;
  trigger: {
    stateName?: string;
    workflowName?: string;
    actionName?: string;
    eventType?: string;
  };
  suggestions: SuggestedGraphItem[];
  confidence: number;
  reason: string;
}
```

Suggestion item:

```ts
interface SuggestedGraphItem {
  type: "STATE" | "TRANSITION" | "WORKFLOW" | "EDGE_CASE";
  name: string;
  category: "NAVIGATION" | "UI" | "BUSINESS" | "ERROR" | "SYSTEM" | "RECOVERY";
  description: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source: "RULE" | "TEMPLATE" | "AI";
  confidence: number;
}
```

### 6.4 Optional AI Draft Generator

Location:

```text
services/flow-suggestion-engine/src/ai
```

Purpose:

Convert a natural language application description into an editable expected graph.

Important boundary:

AI output must never be stored as final truth automatically.

It must be stored as draft suggestions requiring user approval.

Input:

```json
{
  "applicationType": "ecommerce",
  "description": "A shopping app where users register, login, browse products, add to cart, pay, and track orders."
}
```

Output:

```json
{
  "workflows": [],
  "states": [],
  "transitions": [],
  "edgeCases": []
}
```

AI generation should follow strict JSON schema validation.

If the AI response fails validation:

* Reject the response.
* Show a fallback domain template.
* Log the failure.
* Do not break onboarding.

Use this feature as:

```text
Flow Draft Assistant
```

Do not call it:

```text
Autonomous QA
AI Testing Agent
Self-testing App
```

### 6.5 Expected Graph Store

Location:

```text
packages/db
```

You already have behavior graph concepts, so avoid creating a parallel graph system unless necessary.

Recommended approach:

Use the existing BehaviorGraph model if available.

Graph types:

```ts
DECLARED      // expected graph
DEMONSTRATED  // observed graph
PRODUCTION    // future phase
```

Add or confirm support for:

```ts
sourceType:
  USER_DECLARATION
  SYSTEM_GENERATED
  DEMONSTRATION_SESSION

nodeStatus:
  SUGGESTED
  ACCEPTED
  REJECTED
  EDITED
  OBSERVED
  MISSING

edgeStatus:
  SUGGESTED
  ACCEPTED
  REJECTED
  EDITED
  OBSERVED
  MISSING
```

If current graph tables do not support suggestion tracking, add:

```prisma
model FlowSuggestion {
  id              String   @id @default(cuid())
  organizationId  String
  applicationId   String
  graphId         String?
  workflowId      String?
  itemType        SuggestionItemType
  name            String
  category        String
  payload         Json
  source          SuggestionSource
  status          SuggestionStatus
  confidence      Decimal?
  reason          String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum SuggestionItemType {
  STATE
  TRANSITION
  WORKFLOW
  EDGE_CASE
}

enum SuggestionSource {
  RULE
  TEMPLATE
  AI
  USER
}

enum SuggestionStatus {
  SUGGESTED
  ACCEPTED
  REJECTED
  EDITED
}
```

### 6.6 Graph Reconciliation Engine

Location:

```text
services/coverage-engine
```

or:

```text
services/graph-engine/src/reconciliation
```

Purpose:

Compare expected graph against observed graph.

Inputs:

```ts
interface ReconciliationInput {
  applicationId: string;
  expectedGraphId: string;
  observedGraphId: string;
  demonstrationSessionId: string;
}
```

Outputs:

```ts
interface ReconciliationResult {
  coverageScore: number;
  stateCoverage: number;
  transitionCoverage: number;
  workflowCoverage: number;
  missingStates: MissingState[];
  missingTransitions: MissingTransition[];
  missingWorkflows: MissingWorkflow[];
  unexpectedStates: ObservedState[];
  unexpectedTransitions: ObservedTransition[];
  recommendations: Recommendation[];
}
```

Core comparison rules:

```text
Expected state exists in observed graph
    → mark OBSERVED

Expected state missing from observed graph
    → mark MISSING

Expected transition exists in observed graph
    → mark OBSERVED

Expected transition missing from observed graph
    → mark MISSING

Observed state not in expected graph
    → mark UNDECLARED_OBSERVED

Suggested but rejected state
    → do not count against coverage

Suggested but not accepted state
    → do not count against coverage by default

Accepted edge case missing
    → count against coverage
```

Coverage formula:

```text
Coverage = Observed Expected Items / Total Accepted Expected Items * 100
```

Separate scoring:

```text
State Coverage
Transition Coverage
Workflow Coverage
Critical Flow Coverage
Endpoint Coverage
Error Path Coverage
```

### 6.7 Demonstration Analysis Update

Location:

```text
services/demonstration-api
services/graph-engine
services/coverage-engine
services/report-engine
```

Current demonstration analysis should be updated to accept an optional expected graph.

Current:

```text
POST /demonstrations/{id}/analyze
```

Updated request:

```json
{
  "expectedGraphId": "graph_declared_123",
  "analysisMode": "EXPECTED_VS_OBSERVED"
}
```

If no expected graph exists:

* Use the existing behavior.
* Generate observed graph.
* Generate rule-based missing flows from observed behavior.

If expected graph exists:

* Generate observed graph.
* Run reconciliation.
* Generate coverage report based on accepted expected graph.
* Include suggested missing edge cases separately.

## 7. API Implementation Plan

### 7.1 Flow Declaration APIs

Add:

```http
POST /applications/:applicationId/flow-drafts
```

Creates a new expected flow draft.

Request:

```json
{
  "name": "E-commerce Expected Flow",
  "applicationType": "ECOMMERCE",
  "description": "Shopping app with auth, products, cart, checkout, payment and order tracking."
}
```

Response:

```json
{
  "graphId": "graph_123",
  "status": "DRAFT"
}
```

### 7.2 Generate Suggestions from Template

```http
POST /applications/:applicationId/flow-drafts/:graphId/suggestions/template
```

Request:

```json
{
  "template": "ECOMMERCE"
}
```

Response:

```json
{
  "suggestions": []
}
```

### 7.3 Generate Suggestions from Prompt

```http
POST /applications/:applicationId/flow-drafts/:graphId/suggestions/prompt
```

Request:

```json
{
  "prompt": "This is a shopping app where users register, login, browse products, wishlist products, add to cart, checkout, pay and track orders."
}
```

Response:

```json
{
  "suggestions": [],
  "validationStatus": "VALID"
}
```

### 7.4 Accept Suggestions

```http
POST /flow-suggestions/:suggestionId/accept
```

### 7.5 Reject Suggestions

```http
POST /flow-suggestions/:suggestionId/reject
```

### 7.6 Edit Suggestion

```http
PATCH /flow-suggestions/:suggestionId
```

### 7.7 Publish Expected Graph

```http
POST /applications/:applicationId/flow-drafts/:graphId/publish
```

This converts the draft graph into the active expected graph for demonstration analysis.

### 7.8 Get Expected Graph

```http
GET /applications/:applicationId/graphs/expected
```

### 7.9 Compare Expected vs Observed

```http
POST /applications/:applicationId/graphs/reconcile
```

Request:

```json
{
  "expectedGraphId": "graph_expected_123",
  "observedGraphId": "graph_observed_456",
  "demonstrationId": "demo_789"
}
```

### 7.10 Get Reconciliation Result

```http
GET /demonstrations/:demonstrationId/reconciliation
```

## 8. Dashboard Implementation Plan

### 8.1 Application Setup Step

Add a setup step after application creation:

```text
Define Expected Behavior
```

Options:

```text
1. Start from template
2. Describe my application
3. Build manually
4. Skip for now
```

### 8.2 Flow Builder View

Core layout:

```text
Left Sidebar:
- Workflows
- States
- Edge Cases
- Suggestions

Center:
- Graph canvas

Right Panel:
- Selected node/edge details
- Status
- Category
- Criticality
- Source
- Accept/reject/edit controls
```

Recommended graph library:

```text
React Flow
```

Node types:

```text
Navigation State
Business State
UI State
Error State
System State
Recovery State
```

Edge types:

```text
Success Transition
Failure Transition
Retry Transition
Loop Transition
Exit Transition
```

### 8.3 Demonstration Readiness Screen

Before starting recording, show:

```text
Expected Workflows:
- Authentication
- Product Browsing
- Wishlist
- Cart
- Checkout
- Payment
- Order Tracking

Critical Edge Cases:
- Login Failure
- Empty Cart
- Out of Stock
- Payment Failure
- Session Timeout
- Order Not Found
```

Button:

```text
Start Demonstration
```

### 8.4 Analysis Result Screen

Show three tabs:

```text
Expected Graph
Observed Graph
Gaps
```

Gaps tab sections:

```text
Missing Critical Flows
Missing States
Missing Error Paths
Missing Empty States
Missing Loading States
Unexpected Observed Behavior
Endpoint Issues
Recommendations
```

### 8.5 Report Screen Update

Add report sections:

```text
Expected Behavior Summary
Observed Behavior Summary
Coverage Against Expected Behavior
Missing Accepted Flows
Missing Accepted States
Suggested But Not Accepted Edge Cases
Unexpected Observed Paths
Endpoint Performance Findings
QA Recommendations
```

## 9. Rule Library Implementation

Create initial e-commerce rule pack:

```text
packages/rules/src/packs/ecommerce-flow-declaration.ts
```

Example rules:

```ts
export const ecommerceSuggestionRules = [
  {
    id: "auth-login-success-to-failure",
    trigger: { stateName: "LOGIN_SUCCESS" },
    suggestions: [
      {
        type: "STATE",
        name: "LOGIN_FAILURE",
        category: "ERROR",
        criticality: "HIGH",
        reason: "Most login workflows should validate invalid credentials."
      },
      {
        type: "STATE",
        name: "DISABLED_ACCOUNT",
        category: "ERROR",
        criticality: "MEDIUM",
        reason: "Authentication systems often need disabled account handling."
      }
    ]
  },
  {
    id: "checkout-success-to-payment-failure",
    trigger: { workflowName: "CHECKOUT" },
    suggestions: [
      {
        type: "STATE",
        name: "PAYMENT_FAILED",
        category: "ERROR",
        criticality: "CRITICAL",
        reason: "Checkout must handle failed payments."
      },
      {
        type: "STATE",
        name: "PAYMENT_GATEWAY_TIMEOUT",
        category: "SYSTEM",
        criticality: "HIGH",
        reason: "Payment providers can timeout or fail."
      }
    ]
  }
];
```

Rule categories:

```text
Success → Failure
Populated → Empty
Valid Input → Invalid Input
Fast Response → Timeout
Authenticated → Unauthenticated
Available Resource → Not Found
Completed Flow → Abandoned Flow
Single Submit → Duplicate Submit
```

## 10. SDK Requirements

Before MVP launch, ensure the SDK captures enough data to support graph generation and reconciliation.

Required frontend events:

```text
SESSION_STARTED
SESSION_ENDED
PAGE_VISIT
ROUTE_CHANGE
BUTTON_CLICK
LINK_CLICK
FORM_STARTED
FORM_SUBMITTED
FORM_VALIDATION_FAILED
FORM_SUBMISSION_SUCCEEDED
FORM_SUBMISSION_FAILED
STATE_ENTERED
STATE_TRANSITION
ERROR_OCCURRED
UNHANDLED_EXCEPTION
```

Required backend events:

```text
API_REQUEST
API_RESPONSE
API_ERROR
API_TIMEOUT
SERVER_ERROR
```

Required SDK methods:

```ts
SOTS.trackState(stateName, category)
SOTS.trackTransition(fromState, toState, action)
SOTS.startWorkflow(workflowName)
SOTS.completeWorkflow(workflowId)
SOTS.failWorkflow(workflowId, reason)
SOTS.captureException(error)
```

Auto-tracking should capture the default behavior.

Manual tracking should allow developers to improve semantic accuracy.

Recommended position:

```text
autoTrack: true by default in demo environment
autoTrack: configurable in production/staging
```

For MVP, focus on demo environment.

## 11. Privacy and Safety Requirements

The flow declaration feature should not require collecting sensitive data.

Rules:

* Do not store passwords.
* Do not store OTP codes.
* Do not store credit card data.
* Do not store CVV.
* Do not store payment tokens.
* Do not store access tokens.
* Do not store raw user input from sensitive fields.
* AI prompt generation must not receive raw telemetry containing sensitive values.
* AI prompt generation should only receive sanitized app description, workflow names, state names, and metadata.

For AI prompt generation, send only:

```json
{
  "applicationType": "ECOMMERCE",
  "description": "sanitized user description",
  "existingStates": [],
  "existingWorkflows": []
}
```

Do not send:

```text
session replay data
raw form values
headers
tokens
cookies
payment data
user personal data
```

## 12. Report Engine Updates

Update the QA report generator to include expected-vs-observed analysis.

New report sections:

### 12.1 Expected Behavior Overview

```text
Expected Workflows: 8
Expected States: 42
Expected Transitions: 61
Critical Flows: 5
```

### 12.2 Demonstrated Behavior Overview

```text
Observed Workflows: 5
Observed States: 24
Observed Transitions: 31
Observed API Endpoints: 12
```

### 12.3 Coverage Summary

```text
Overall Coverage: 68%
Workflow Coverage: 62%
State Coverage: 71%
Transition Coverage: 58%
Critical Flow Coverage: 45%
```

### 12.4 Missing Critical Flows

```text
PAYMENT_FAILURE
OUT_OF_STOCK
EMPTY_CART
SESSION_TIMEOUT
ORDER_NOT_FOUND
```

### 12.5 Missing States

```text
SEARCH_LOADING
NO_SEARCH_RESULTS
PAYMENT_FAILED
404_PAGE
EMPTY_WISHLIST
```

### 12.6 Unexpected Observed Behavior

```text
User reached CHECKOUT without CART_ACTIVE state.
User triggered API_ERROR on /api/cart but no error UI state was observed.
```

### 12.7 Endpoint Findings

```text
GET /api/products average latency: 480ms
POST /api/checkout error rate: 8%
GET /api/search timeout observed once
```

### 12.8 Recommendations

Recommendations should be deterministic and evidence-based.

Example:

```text
Add a visible payment failure state because CHECKOUT was declared as a critical workflow but no failed payment path was demonstrated.
```

Avoid vague AI-style wording like:

```text
Your app may have vulnerabilities.
```

Be precise.

## 13. Implementation Phases

## Phase 1 — Foundation: Data Model and Graph Semantics

### Goal

Prepare the system to store expected, suggested, and observed behavior without confusing them.

### Tasks

1. Review existing BehaviorGraph, BehaviorGraphNode, and BehaviorGraphEdge models.
2. Confirm support for declared/demonstrated graph types.
3. Add suggestion status fields where missing.
4. Add FlowSuggestion model if required.
5. Add migration scripts.
6. Add shared TypeScript types.
7. Add Zod validation schemas.
8. Add seed data for e-commerce templates.

### Acceptance Criteria

* System can store an expected graph.
* System can store an observed graph.
* System can store suggested states and transitions.
* Suggestions can be accepted, rejected, or edited.
* Declared and observed graph data are never mixed.

## Phase 2 — Domain Template and Rule Suggestion Engine

### Goal

Generate useful edge-case suggestions without relying on AI.

### Tasks

1. Create e-commerce domain template.
2. Create generic auth template.
3. Create generic CRUD template.
4. Implement rule matcher.
5. Implement suggestion generator.
6. Add confidence and criticality scoring.
7. Add unit tests for all rules.
8. Add API endpoint to generate template suggestions.

### Acceptance Criteria

* Selecting “E-commerce” generates expected workflows.
* Login success suggests login failure.
* Product search suggests no results and loading state.
* Checkout suggests payment failure and timeout.
* Cart suggests empty cart and out-of-stock.
* Suggestions are explainable.
* User can accept/reject suggestions.

## Phase 3 — Flow Builder UI

### Goal

Allow users to build and edit expected flows visually.

### Tasks

1. Add “Define Expected Behavior” onboarding step.
2. Add app type selection.
3. Add flow graph canvas.
4. Add state creation form.
5. Add transition creation form.
6. Add workflow grouping.
7. Add suggestion review panel.
8. Add accept/reject/edit controls.
9. Add graph save/publish workflow.
10. Add validation before publishing.

### Acceptance Criteria

* User can manually create workflows.
* User can accept generated template suggestions.
* User can reject irrelevant suggestions.
* User can edit state names/categories.
* User can publish expected graph.
* Published graph is available to demonstration analysis.

## Phase 4 — Optional AI Prompt-to-Flow Draft

### Goal

Allow users to describe their app and get an editable draft graph.

### Tasks

1. Define strict JSON schema for AI flow output.
2. Create prompt template.
3. Create AI adapter service.
4. Validate AI response with Zod.
5. Convert valid AI response to suggestions.
6. Fallback to deterministic template if AI fails.
7. Add usage logging.
8. Add feature flag.

### Acceptance Criteria

* User can describe a shopping app.
* System generates draft workflows, states, transitions, and edge cases.
* Draft items are marked as AI suggestions.
* User must approve before they become expected behavior.
* Invalid AI responses do not break onboarding.
* Feature can be disabled by config.

## Phase 5 — Demonstration Analysis Integration

### Goal

Compare developer demonstration sessions against expected graphs.

### Tasks

1. Update demonstration analysis API to accept expectedGraphId.
2. Generate observed graph from session events.
3. Load active expected graph.
4. Run graph reconciliation.
5. Store reconciliation result.
6. Update analysis job status lifecycle.
7. Add retry/error handling.
8. Add integration tests.

### Acceptance Criteria

* Demonstration works without expected graph.
* Demonstration works with expected graph.
* System identifies observed expected states.
* System identifies missing expected states.
* System identifies observed expected transitions.
* System identifies missing expected transitions.
* System identifies unexpected observed states.
* Reconciliation result is stored and retrievable.

## Phase 6 — Coverage and Missing Gap Enhancements

### Goal

Improve coverage scoring based on accepted expected behavior.

### Tasks

1. Implement expected state coverage.
2. Implement expected transition coverage.
3. Implement workflow coverage.
4. Implement critical flow coverage.
5. Implement missing state severity.
6. Implement missing flow severity.
7. Implement recommendation generator.
8. Add tests using e-commerce fixture sessions.

### Acceptance Criteria

* Coverage is calculated only from accepted expected graph items.
* Rejected suggestions do not reduce coverage.
* Critical missing flows are highlighted.
* Missing states are categorized as loading, empty, error, recovery, or system.
* Recommendations are evidence-based.

## Phase 7 — Report Engine Update

### Goal

Expose the new intelligence in the QA report.

### Tasks

1. Add expected behavior summary.
2. Add observed behavior summary.
3. Add reconciliation summary.
4. Add missing expected flows.
5. Add missing expected states.
6. Add unexpected observed behavior.
7. Add endpoint findings.
8. Add recommendation section.
9. Update export templates.
10. Add report fixtures.

### Acceptance Criteria

* Reports show expected-vs-observed coverage.
* Reports show missing critical flows.
* Reports show missing states.
* Reports show endpoint issues.
* Reports remain understandable to developers, QA, and PMs.
* JSON/PDF/HTML exports include the new sections.

## Phase 8 — Dashboard Results View

### Goal

Make the result visually obvious.

### Tasks

1. Add expected graph tab.
2. Add observed graph tab.
3. Add gaps tab.
4. Add coverage cards.
5. Add missing flow table.
6. Add missing state table.
7. Add endpoint findings table.
8. Add recommendation cards.
9. Add link from report to session replay.
10. Add link from missing item to replay evidence where available.

### Acceptance Criteria

* User can see what was expected.
* User can see what was observed.
* User can see what is missing.
* User can open session replay from analysis.
* User can export the report.

## Phase 9 — Testing and Quality Assurance

### Unit Tests

Required coverage:

* Domain template generation.
* Rule suggestion generation.
* Suggestion status transitions.
* Graph validation.
* AI response validation.
* Reconciliation logic.
* Coverage scoring.
* Report section generation.

### Integration Tests

Required flows:

1. Create app.
2. Generate e-commerce expected graph.
3. Accept suggestions.
4. Start demonstration.
5. Submit sample events.
6. Generate observed graph.
7. Reconcile expected vs observed.
8. Generate report.
9. Export report.

### E2E Test Scenario

Use a sample shopping app.

Expected graph includes:

```text
REGISTER
LOGIN
BROWSE_PRODUCTS
PRODUCT_DETAILS
ADD_TO_CART
CHECKOUT
PAYMENT_SUCCESS
PAYMENT_FAILED
EMPTY_CART
OUT_OF_STOCK
ORDER_TRACKING
```

Demonstration only performs:

```text
REGISTER
LOGIN
BROWSE_PRODUCTS
PRODUCT_DETAILS
ADD_TO_CART
CHECKOUT
PAYMENT_SUCCESS
```

Expected result:

```text
Missing:
PAYMENT_FAILED
EMPTY_CART
OUT_OF_STOCK
ORDER_TRACKING

Observed:
REGISTER
LOGIN
BROWSE_PRODUCTS
PRODUCT_DETAILS
ADD_TO_CART
CHECKOUT
PAYMENT_SUCCESS
```

## 14. Suggested Implementation Order

The best implementation sequence is:

```text
1. Data model updates
2. Shared types and schemas
3. E-commerce template
4. Rule-based suggestion engine
5. Flow declaration APIs
6. Flow Builder UI
7. Expected graph publishing
8. Demonstration analysis update
9. Graph reconciliation engine
10. Coverage engine update
11. Report engine update
12. Dashboard results update
13. Optional AI prompt-to-flow
14. Full E2E test
15. Documentation update
```

Do not start with AI.

Start with deterministic rules and templates.

AI should sit on top as a drafting accelerator, not as the foundation.

## 15. MVP Documentation Updates

Update the following docs/pages:

### Product Docs

* What is Tellann/SOTS?
* Why SOTS Exists
* Getting Started
* Quick Start
* Core Concepts
* First Demonstration Session
* Understanding Your First Report

### New Concept Pages

* Expected Graph
* Observed Graph
* Suggested Flow
* Missing Flow
* Missing State
* Demonstration Session
* Coverage Score

### SDK Docs

* Installing React SDK
* Installing Node SDK
* Auto Tracking
* Manual State Tracking
* Manual Workflow Tracking
* Privacy Rules

### Flow Builder Docs

* Define application behavior
* Use templates
* Use prompt-to-flow draft
* Accept/reject suggestions
* Run demonstration
* Interpret gaps

## 16. Engineering Risks

### Risk 1: AI output becomes unreliable

Mitigation:

* Validate with strict schema.
* Treat AI output as suggestions only.
* Add template fallback.
* Feature flag AI.

### Risk 2: Graph model becomes too complex

Mitigation:

* Reuse existing BehaviorGraph model.
* Keep expected and observed graphs separate.
* Store suggestion status separately.
* Avoid premature Neo4j dependency if current graph store works.

### Risk 3: Reports become too noisy

Mitigation:

* Separate critical, high, medium, low findings.
* Do not show every minor suggestion as a failure.
* Only accepted expected items affect coverage.
* Rejected suggestions should disappear from scoring.

### Risk 4: Users misunderstand suggestions as confirmed bugs

Mitigation:

* Label findings clearly:

  * Observed
  * Missing
  * Suggested
  * Not demonstrated
  * Needs validation

### Risk 5: MVP scope expands into autonomous testing

Mitigation:

* Do not execute generated tests.
* Do not inject failures.
* Do not claim autonomous validation.
* Keep output as QA guidance and coverage intelligence.

## 17. MVP Launch Acceptance Criteria

This functionality is ready for MVP launch when:

1. A developer can create an application.
2. A developer can select “E-commerce” as an app type.
3. The system generates expected workflows and edge cases.
4. The developer can accept, reject, and edit suggestions.
5. The developer can publish an expected graph.
6. The developer can install/connect the SDK.
7. The developer can start a demonstration session.
8. The system captures events.
9. The system generates an observed graph.
10. The system compares expected graph against observed graph.
11. The system identifies missing states.
12. The system identifies missing flows.
13. The system calculates coverage.
14. The system analyzes endpoint latency/errors.
15. The system generates a QA report.
16. The user can export the report.
17. No autonomous test execution is required.
18. No production traffic is required.
19. No sensitive data is captured.
20. The full flow works with the sample shopping application.

## 18. Final MVP Positioning

The public-facing promise should be:

```text
Define or demonstrate your application flow once.
Tellann turns it into a behavior graph, identifies missing states and flows, and generates a QA coverage report.
```

Avoid:

```text
AI tests your app automatically.
The system simulates every possible failure.
The app validates itself.
```

The stronger, safer message is:

```text
Tellann helps your team see what your software does, what it did not demonstrate, and what should be tested next.
```

That is believable, useful, and achievable before MVP launch.
