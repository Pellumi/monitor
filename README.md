# Self-Observing Testing System (SOTS)

SOTS is a software quality intelligence platform that continuously observes application behavior, automatically discovers workflows, measures coverage, identifies missing states/flows, and generates QA reports.

Demonstrate your application once (via manual walkthrough or automation), and SOTS maps your system's behavioral topology, highlighting what was missed.

---

## 1. System Architecture Overview

SOTS is designed as a modular microservices platform communicating via HTTP APIs, Kafka events, and relational/time-series databases.

```text
                                  ┌────────────────────────┐
                                  │  Developer Application │
                                  └───────────┬────────────┘
                                              │ (Frontend + Backend SDKs)
                                              ▼
                                  ┌────────────────────────┐
                                  │   API Gateway (3000)   │ (Auth, CORS, Rate Limit)
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┼────────────────────────┐
                      │                       │                        │
                      ▼                       ▼                        ▼
         ┌────────────────────────┐┌─────────────────────┐┌────────────────────────┐
         │ Event Collector (3001) ││ Onboarding API (3006)││  Report Engine (3004)  │
         └────────────┬───────────┘└──────────┬──────────┘└────────────▲───────────┘
                      │ (Publish)             │ (Read/Write)           │ (Aggregates)
                      ▼                       ▼                        │
                  [ Kafka ]─────────────►[ PostgreSQL ]────────────────┤
                      │                       ▲                        │
                      ├───────────────────────┼────────────────────────┤
                      │ (Subscribe)           │ (Write Snapshot)       │
                      ▼                       │                        │
         ┌────────────────────────┐           │                        │
         │  Session Engine (3002) ├───────────┤                        │
         └────────────┬───────────┘           │                        │
                      │ (Publish Session)     │                        │
                      ▼                       │                        │
         ┌────────────────────────┐           │                        │
         │  Graph Engine (3002)   ├───────────┤                        │
         └────────────────────────┘           │                        │
                      │ (Publish Completed)   │                        │
                      ▼                       │                        │
         ┌────────────────────────┐           │                        │
         │ Coverage Engine (3003) ├───────────┘                        │
         └────────────────────────┘                                    │
                      │                                                │
                      ▼ (ClickHouse Sync)                              │
         ┌────────────────────────┐                                    │
         │ Endpoint Engine (3007) ├────────────────────────────────────┘
         └────────────┬───────────┘
                      │ (Read/Write)
                      ▼
               [ ClickHouse ]
```

### Core Microservices

*   **API Gateway (Port 3000)**: fastify service running `@fastify/http-proxy`. Validates API keys against the onboarding database, caches validations, and securely proxies requests to internal upstreams.
*   **Event Collector (Port 3001)**: Receives batched telemetry event arrays from frontend/backend SDKs and publishes them directly to Kafka.
*   **Session Engine**: Kafka consumer that tracks session state lifecycles and structures chronological events.
*   **Graph Engine**: Listens for completed session notifications and compiles state navigation topologies.
*   **Coverage Engine (Port 3003)**: Compares observed behavioral topologies against application profile rules to measure state, transition, and workflow coverage.
*   **Onboarding API (Port 3006)**: Manages organizations, applications, and API keys, utilizing PostgreSQL.
*   **Endpoint Engine (Port 3007)**: Ingests `API_REQUEST` telemetry events, stores them in ClickHouse, and computes latency aggregates and error rates.
*   **FDRS API (Port 3008)**: Manages declared flows, reconciliation, promotion decisions, and reconciliation exports.
*   **Billing API (Port 3009)**: Manages plans, checkout intents, invoices, payment webhooks, and subscription status.
*   **Usage Tracker (Port 3012)**: Aggregates usage records and plan-limit snapshots.
*   **Auth API (Port 3013)**: Handles OTP login, refresh sessions, user identity, memberships, and audit logging.
*   **Report Engine (Port 3004)**: Generates execution reports and orchestrates PDF, HTML, CSV, and JSON downloads.
*   **Dashboard UI (Port 3010)**: Next.js frontend wizard and visualization dashboard.

---

## 2. Infrastructure Setup & Installation

SOTS requires **Node.js (>= 18)** and **pnpm (>= 9)**.

### Step 1: Start Infrastructure Containers

Run the docker-compose file to provision Kafka, PostgreSQL, ClickHouse, and supporting services:

```bash
docker-compose up -d
```

Verify that all services are healthy.

### Step 2: Install Workspace Dependencies

From the project root directory, install the monorepo packages:

```bash
npx pnpm install
```

### Step 3: Synchronize Relational Database Schema

Apply the Prisma migrations to configure PostgreSQL:

```bash
npx pnpm --filter @sots/db run push
```

### Step 4: Run the Compilation Build

Build all packages to generate typing structures:

```bash
npx pnpm build
```

---

## 3. Quick-Start Guide

### Step 1: Start the Development Server

Execute turbo to spin up all microservices and the Next.js dashboard concurrently:

```bash
npx pnpm dev
```

The services will listen on their mapped ports (e.g., API Gateway on port `3000`, Dashboard on `3010`).

### Step 2: Access the Dashboard Wizard

1. Open your browser and navigate to `http://localhost:3010/onboarding`.
2. Create an **Organization**.
3. Create an **Application** and select its profile structure (`ECOMMERCE` or `LMS`).
4. Generate a new **API Key**. Copy the initialization snippet.

### Step 3: Run E2E Verification Tests

Verify system behavior against the integrated Golden-Master E2E scenarios:

```bash
npx pnpm --filter @sots/e2e-tests run test:e2e
```

---

## 4. SDK Integration Reference

SOTS supports unified tracking across client and server environments. Both SDKs point to the **API Gateway** (`http://localhost:3000`) and require your API key in the `Authorization: Bearer <key>` header (automatically handled by the initialization config).

### A. Frontend SDK (`@sots/frontend-sdk`)

#### 1. Initialization
```typescript
import { SOTS } from '@sots/frontend-sdk';

SOTS.initialize({
  endpoint: 'http://localhost:3000',
  tenantId: 'your-org-uuid',
  applicationId: 'your-app-uuid'
});
```

#### 2. Tracking Interactions
Page visits are tracked automatically on start. Track clicks or forms using:
```typescript
// Generic Event
SOTS.trackEvent('BUTTON_CLICK', { elementId: 'checkout-btn' });

// Business/Domain Event
SOTS.trackBusinessEvent({
  type: 'CHECKOUT_START',
  payload: { cartValue: 149.99 }
});
```

---

### B. Backend SDK (`@sots/backend-sdk`)

#### 1. Initialization
```typescript
import { SOTS } from '@sots/backend-sdk';

SOTS.initialize({
  endpoint: 'http://localhost:3000',
  tenantId: 'your-org-uuid',
  applicationId: 'your-app-uuid'
});
```

#### 2. Express Middleware Integration
Integrate the automatic API logger middleware to track route latency and status codes:
```typescript
import express from 'express';
import { sotsExpressMiddleware } from '@sots/backend-sdk';

const app = express();
app.use(sotsExpressMiddleware());
```

#### 3. Fastify Plugin Integration
```typescript
import Fastify from 'fastify';
import { sotsFastifyPlugin } from '@sots/backend-sdk';

const fastify = Fastify();
fastify.register(sotsFastifyPlugin);
```

#### 4. Manual Metric Captures
```typescript
import { trackApi, captureError } from '@sots/backend-sdk';

// Manual API Request Log
await trackApi({
  endpoint: '/api/v1/payment',
  method: 'POST',
  statusCode: 201,
  durationMs: 382,
  sessionId: 'frontend-correlated-session-uuid'
});

// Exception Capture
try {
  // logic
} catch (error) {
  await captureError({
    error,
    context: { step: 'billing' }
  });
}
```

---

## 5. API Reference Documentation

All public APIs routes route through the **API Gateway (Port 3000)** and require the following authentication header:
`Authorization: Bearer <API_KEY>`

### Gateway Route Mappings

| Route Prefix | Target Microservice | Port |
| :--- | :--- | :--- |
| `/v1/events/*` | Event Collector | 3001 |
| `/organizations/*`, `/applications/*`, `/api-keys/*` | Onboarding API | 3006 |
| `/reports/*`, `/sessions/*`, `/applications/:id/graph` | Report Engine | 3004 |
| `/endpoints/*` | Endpoint Engine | 3007 |
| `/demonstrations/*` | Demonstration API | 3005 |

---

### Key Endpoint Specifications

#### 1. POST `/v1/events/batch`
Sends telemetry payloads.
*   **Body Schema (Array of Events)**:
```json
[
  {
    "eventId": "uuid-string",
    "sessionId": "uuid-string",
    "tenantId": "org-uuid",
    "applicationId": "app-uuid",
    "source": "frontend-sdk",
    "eventVersion": "1.0",
    "eventType": "PAGE_VIEW",
    "timestamp": "2026-06-16T19:00:00Z",
    "metadata": { "url": "http://localhost:3010/checkout" }
  }
]
```

#### 2. GET `/reports/:applicationId/latest`
Returns calculated snapshot statistics.
*   **Response Schema**:
```json
{
  "application": "App Name",
  "summary": {
    "workflowCount": 5,
    "sessionCount": 22
  },
  "coverage": {
    "stateCoverage": 82.5,
    "transitionCoverage": 71.0,
    "flowCoverage": 65.0
  },
  "workflows": [
    { "name": "Purchase Workflow", "path": ["HOME", "CART", "CHECKOUT"], "executionCount": 12 }
  ],
  "missingStates": [
    { "stateName": "PAYMENT_FAILURE", "confidence": 0.9, "reason": "Checkout was executed but payment failures were never triggered." }
  ],
  "missingFlows": [
    { "path": ["CART", "EMPTY_CART"], "confidence": 0.8, "reason": "Alternative workflow path from Cart to Empty Cart has zero coverage." }
  ]
}
```

#### 3. GET `/reports/:applicationId/export`
Generates formatted diagnostic downloads.
*   **Query Parameters**:
    *   `format` (`json` | `csv` | `html` | `pdf`)
*   **Behavior**: Responds with appropriate binary downloads (`Content-Disposition: attachment`). The `pdf` format downloads a multipage styled executive summary generated via PDFKit.

#### 4. GET `/endpoints/:applicationId/analysis`
Fetches ClickHouse time-series metrics.
*   **Response Schema**:
```json
{
  "endpoints": [
    {
      "endpoint": "/api/checkout",
      "method": "POST",
      "requestCount": 142,
      "avgMs": 1840,
      "p95Ms": 3200,
      "errorRate": 0.042,
      "recommendations": ["Investigate performance — average latency exceeds 1s"]
    }
  ]
}
```
