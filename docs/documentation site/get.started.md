For the **Get Started** section, I would avoid making these pages feel like specifications. They should read like a guided product journey.

A new user should be able to read only these pages, install the SDK, run one demonstration, and understand why SOTS matters.

---

# Page 1: What is SOTS?

## Goal

Answer:

> What is this product and what does it actually do?

---

### Hero

# What is SOTS?

SOTS is a Behavioral Quality Intelligence Platform that learns how your software behaves by observing it.

Instead of relying only on test suites, logs, metrics, or analytics, SOTS builds a behavioral model of your application from real interactions.

Install the SDK, demonstrate your application once, and SOTS automatically generates:

* Behavioral Graphs
* Workflow Maps
* Coverage Reports
* Missing State Reports
* Missing Flow Reports
* Session Replays
* Endpoint Intelligence

---

### Traditional QA vs SOTS

| Traditional Approach        | SOTS                             |
| --------------------------- | -------------------------------- |
| Write tests first           | Demonstrate behavior first       |
| Manually document workflows | Automatically discover workflows |
| Find bugs after they occur  | Identify coverage gaps early     |
| Analyze logs and metrics    | Analyze application behavior     |

---

### What SOTS Produces

#### Behavioral Graph

Visual representation of application behavior.

```text
ANONYMOUS
    ↓
REGISTERED
    ↓
AUTHENTICATED
    ↓
CHECKOUT
```

#### Coverage Analysis

Shows what was demonstrated and what was missed.

#### Missing Flows

Examples:

* Login Failure
* Session Expiration
* Payment Failure

#### Session Replay

Replay exactly what happened during a demonstration.

---

### Next Step

→ Why SOTS Exists

---

# Page 2: Why SOTS Exists

## Goal

Explain the problem.

---

# Why SOTS Exists

Modern software teams have plenty of tools.

They have:

* Logs
* Metrics
* Traces
* Analytics
* Session Replays
* Test Suites

Yet teams still struggle to answer simple questions:

* What workflows exist in this application?
* What parts of the application have been demonstrated?
* Which error paths have never been tested?
* What happens if payment fails?
* What behavior is missing?

---

## Existing Tools Answer

### Datadog

Is the infrastructure healthy?

### Sentry

What broke?

### PostHog

How are users behaving?

### Replay

What happened?

---

## SOTS Answers

* What behavior exists?
* What behavior is missing?
* Which workflows lack coverage?
* Which states have never been observed?
* How confident should we be in this release?

---

## The Core Idea

A developer demonstration becomes:

```text
Demonstration
      ↓
Behavior Graph
      ↓
Coverage Analysis
      ↓
Missing States
      ↓
Missing Flows
      ↓
QA Intelligence
```

---

### Next Step

→ Getting Started

---

# Page 3: Getting Started

## Goal

Prepare the user.

---

# Getting Started

SOTS can be integrated into any application using the Frontend SDK, Backend SDK, or both.

---

## Before You Begin

You'll need:

* A SOTS account
* An organization
* An application
* An environment
* An API key

---

## Integration Flow

```text
Create Organization
        ↓
Create Application
        ↓
Create Environment
        ↓
Generate API Key
        ↓
Install SDK
        ↓
Run Demonstration
        ↓
View Reports
```

---

## Supported Platforms

Frontend:

* React
* Next.js
* JavaScript
* TypeScript

Backend:

* Node.js
* Express
* NestJS
* Fastify

---

### Next Step

→ Quick Start (5 Minutes)

---

# Page 4: Quick Start (5 Minutes)

## Goal

Deliver value immediately.

This is arguably the most important page in the entire documentation.

---

# Quick Start

## Step 1 — Install SDK

Frontend

```bash
npm install @sots/react
```

Backend

```bash
npm install @sots/node
```

---

## Step 2 — Initialize SDK

```ts
import { SOTS } from "@sots/react";

SOTS.initialize({
  apiKey: "YOUR_API_KEY",
  applicationId: "YOUR_APP_ID",
  environment: "development"
});
```

---

## Step 3 — Start Application

Run your application normally.

```bash
npm run dev
```

---

## Step 4 — Start Demonstration

Inside SOTS:

```text
Applications
    ↓
Select Application
    ↓
Start Demonstration
```

---

## Step 5 — Demonstrate Behavior

Example:

```text
Register
    ↓
Login
    ↓
Browse Products
    ↓
Add To Cart
    ↓
Checkout
```

---

## Step 6 — Stop Recording

```text
Stop Demonstration
```

---

## Step 7 — View Results

SOTS generates:

* Behavioral Graph
* Coverage Report
* Missing States
* Missing Flows
* Session Replay

---

### Next Step

→ Core Concepts

---

# Page 5: Core Concepts

## Goal

Teach the mental model.

---

# Core Concepts

Understanding these concepts will help you interpret reports correctly.

---

## Event

The smallest unit of observation.

Examples:

```text
BUTTON_CLICK
PAGE_VISIT
API_REQUEST
ERROR_OCCURRED
```

---

## Session

A chronological collection of events.

```text
Session
 ├─ Event
 ├─ Event
 ├─ Event
```

---

## State

A meaningful condition in the application.

Examples:

```text
ANONYMOUS
AUTHENTICATED
CHECKOUT
PAYMENT_FAILED
```

---

## Transition

Movement between states.

```text
CART
   ↓
CHECKOUT
```

---

## Workflow

A business process.

Examples:

* Registration
* Login
* Checkout
* Subscription Purchase

---

## Behavior Graph

A connected model of observed application behavior.

```text
State
   ↓
Transition
   ↓
State
```

---

## Coverage

The percentage of expected behavior that has been observed.

---

## Missing State

A state that should likely exist but has not been demonstrated.

Examples:

* EMPTY_CART
* 404_PAGE
* PAYMENT_FAILED

---

## Missing Flow

A workflow path that has not been demonstrated.

Examples:

* Login Failure
* Retry Payment
* Session Timeout

---

### Next Step

→ First Demonstration Session

---

# Page 6: First Demonstration Session

## Goal

Show users how to perform a good demo.

---

# Your First Demonstration Session

A demonstration session teaches SOTS how your application behaves.

You are not testing.

You are teaching.

---

## Good Demonstration

```text
Register
    ↓
Login
    ↓
Browse Products
    ↓
View Product
    ↓
Add To Cart
    ↓
Checkout
```

---

## Better Demonstration

```text
Register
Login
Logout
Password Reset
Add To Cart
Remove From Cart
Checkout
Payment Success
```

---

## Best Demonstration

Include:

* Success Paths
* Failure Paths
* Empty States
* Validation Errors
* Recovery Flows

Examples:

* Login Failure
* Empty Search Results
* Invalid Form Submission
* Payment Failure
* Retry Actions

---

## Demonstration Tips

* Move slowly
* Complete workflows
* Include edge cases
* Trigger validation errors
* Explore alternate paths

---

### Next Step

→ Understanding Your First Report

---

# Page 7: Understanding Your First Report

## Goal

Teach users how to interpret results.

---

# Understanding Your First Report

After processing a demonstration session, SOTS generates several reports.

---

## Executive Summary

```text
Quality Score: 82
Workflow Coverage: 76%
Missing States: 11
Missing Flows: 8
```

This is your high-level application health overview.

---

## Behavioral Graph

Shows observed application behavior.

```text
ANONYMOUS
    ↓
REGISTERED
    ↓
AUTHENTICATED
```

---

## Coverage Report

Shows how much behavior was observed.

```text
Checkout Coverage
75%
```

---

## Missing States

Examples:

```text
404_PAGE
EMPTY_CART
PAYMENT_FAILED
```

These states were expected but not observed.

---

## Missing Flows

Examples:

```text
Retry Payment
Session Timeout
Login Failure
```

These workflow paths were not demonstrated.

---

## Session Replay

Allows you to inspect exactly what happened during the demonstration.

---

## What To Do Next

1. Review Missing States
2. Review Missing Flows
3. Run another demonstration
4. Improve coverage
5. Establish a behavioral baseline

---

After these seven pages, a user should completely understand the core MVP value proposition without reading a single architecture document, SDK reference page, or API specification. That is exactly the onboarding experience you want for SOTS.
