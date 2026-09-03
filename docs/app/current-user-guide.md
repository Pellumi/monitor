# Tellann Current User Guide

## Purpose and scope

This guide documents the user journey that is implemented in the current Tellann repository. It follows a user from their first sign-in through organization and application setup, expected-flow declaration, SDK connection, behavioral demonstration, reconciliation, and the final QA report.

Tellann uses two models of the application:

- **Expected behavior**: the states and transitions the team declares.
- **Observed behavior**: telemetry collected while people or automation use the instrumented application.

Tellann compares the two models to show what was confirmed, what was expected but not reached, and what happened without being declared.

## The complete journey at a glance

```text
Authenticate
  -> Select or create an organization
  -> Register an application
  -> Select an application profile
  -> Define and compile expected flows
  -> Create an environment-scoped ingestion key
  -> Install and initialize an SDK
  -> Verify the SDK connection
  -> Demonstrate the application
  -> Analyze and reconcile expected vs observed behavior
  -> Complete onboarding
  -> Review graphs, workflows, sessions, gaps, endpoints, and reports
  -> Export the report in a plan-supported format
```

## Before the user starts

The user needs:

- Access to the Tellann dashboard.
- An email inbox that can receive a one-time passcode, unless the account already has password sign-in configured.
- Permission to create or join an organization.
- Access to the source code of the application being observed.
- A running frontend, backend, or both.
- An environment in which the user can safely exercise success, failure, validation, empty, and recovery paths.

The first application created in an organization receives a default **Development** environment. Ingestion keys are scoped to an environment, not just to the organization or application.

## 1. Authenticate

### 1.1 Enter an email address

Open `/auth/login` and enter the account email. Tellann first identifies whether the account exists and which authentication method it prefers.

The system then follows one of these paths:

- **New email**: sends a sign-up OTP.
- **Existing OTP account**: sends a login OTP.
- **Existing password-preferred account with a password set**: displays the password form.

OTP remains the basic account creation and sign-in path. A signed-in user can later set or change a password and select the preferred authentication mode in **Settings -> Security & Sessions**.

### 1.2 Complete OTP or password verification

For OTP:

1. Retrieve the code from the email inbox.
2. Enter the code in the verification screen.
3. Use resend when the timer allows it if the code does not arrive.

For password:

1. Enter the configured password.
2. If necessary, choose the OTP alternative from the login experience.

A newly created user is sent to `/onboarding`. A returning user is sent to the originally requested protected page, or to the dashboard.

### 1.3 Session behavior

The dashboard uses cookie-backed sessions:

- The short-lived access session lasts 15 minutes.
- The refresh session is rotating and lasts 30 days.
- Authenticated dashboard requests attempt one refresh and retry after an access-session failure.
- If refresh also fails, the user returns to login with the original path and query preserved.

The user can review and revoke sessions from **Settings -> Security & Sessions** and can sign out through the dashboard menu.

## 2. Select or create an organization

On `/onboarding`, the user sees organizations they already belong to.

They can:

- Select an existing organization and choose **Continue**.
- Choose **Create New Organization**, enter a name, create it, select it, and continue.

An organization is the workspace and tenant boundary. Its subscription controls limits and capabilities such as the number of applications, report generation, report export formats, team features, and retention.

If the user is joining an existing team, an organization invitation can be accepted after authentication. Organization owners and authorized members manage invitations and roles under **Settings -> Members & Access**.

## 3. Register an application

The application screen asks only for an **Application Name**, for example `Production E-commerce Store`.

Before allowing creation, Tellann checks the organization's application limit. If the limit is reached, the user must return to an existing application or upgrade the plan.

After creation, Tellann:

- Associates the application with the selected organization.
- Creates the default Development environment.
- Creates onboarding-progress state.
- Sends the user into the declaration wizard for that application.

The active application is carried through dashboard URLs as `appId`. Application-specific pages do not show data until a valid application belonging to the selected organization is available.

## 4. Select the application's behavioral profile

The first declaration step asks the user to choose a profile:

- **E-commerce Store**: preloads a typical path such as Anonymous -> Browse -> View Product -> Add to Cart -> Checkout -> Success.
- **Education / LMS**: preloads a typical path such as Anonymous -> View Courses -> Select -> Enroll -> Start Lesson -> Complete.
- **Custom Flow**: starts with a blank behavioral model.

This is not an SDK technology choice. It is the starting model for the behavior the organization expects the application to support.

Choose the closest template when the application resembles one of the supported domains. Choose Custom when the application's workflows are materially different. The generated model is editable before it is compiled.

## 5. Declare expected flows

The Flow Declaration Builder is where the user defines the intended behavior before comparing it with telemetry.

### 5.1 Create or select a flow

A flow has:

- A human-readable name, such as `Checkout Flow`.
- A workflow type: Custom, Checkout, Authentication, Registration, Assessment, or Enrollment.
- A version.
- A status, initially `DRAFT`.

Template selection may preload a flow. Otherwise the user creates one.

### 5.2 Add states

A state is a meaningful condition, not every click or component. Examples include:

- `ANONYMOUS`
- `AUTHENTICATED`
- `CART_WITH_ITEMS`
- `CHECKOUT`
- `PAYMENT_FAILED`
- `ORDER_CONFIRMED`

The builder supports state categories including business, error, and system/API-oriented states. Use stable names that describe conditions the team will recognize in a report.

Good declarations include:

- Happy-path states.
- Validation and authorization failures.
- Empty states.
- Dependency or API failures.
- Retry and recovery states.
- Terminal success and cancellation states.

### 5.3 Add transitions

A transition joins a source state to a destination state and can include an action, for example:

```text
CART_WITH_ITEMS -> CHECKOUT        action: CLICK_CHECKOUT
CHECKOUT -> PAYMENT_FAILED         action: PAYMENT_DECLINED
PAYMENT_FAILED -> CHECKOUT         action: RETRY_PAYMENT
CHECKOUT -> ORDER_CONFIRMED        action: PAYMENT_SUCCEEDED
```

Transitions express what the team expects to be possible. They later become the denominator for transition coverage.

### 5.4 Review Tellann suggestions

For a draft flow, Tellann can generate suggestions. A suggestion may be:

- Accepted into the declared model.
- Edited and then accepted.
- Rejected with a reason.
- Dismissed.

The user remains responsible for deciding whether a suggested state or transition belongs in the intended product contract.

### 5.5 Compile the declaration

Choose **Mark Complete & Compile** when the expected model is ready.

Compilation:

- Changes the flow from `DRAFT` to `COMPLETE`.
- Freezes that version for comparison.
- Advances first-time onboarding toward SDK setup.

A completed flow can be reopened for editing. Reopening creates another opportunity to change the expected model and its version, so coverage results should always be interpreted against the version shown in the interface.

At least one state is required before the UI permits completion. In practice, useful reconciliation also requires meaningful transitions and explicit failure/recovery states.

## 6. Generate an ingestion key

The onboarding SDK screen can generate an **environment-scoped API key** for the application's Development environment.

Important handling rules:

- Copy the raw key when it is created.
- Existing keys are masked after creation; Tellann does not redisplay the original secret.
- If the raw value is lost, create a replacement key.
- Do not commit a key to source control.
- Store it in an environment variable or secret manager.
- Use different keys for different environments.
- Revoke keys that are exposed or no longer needed under **Settings -> Ingestion Keys**.

An ingestion key authorizes telemetry upload. It is not the same as the management/programmatic tokens found under **Settings -> Integrations**.

## 7. Install and initialize an SDK

The current repository contains two SDK packages:

- `@tellann/frontend-sdk`
- `@tellann/backend-sdk`

Use the frontend SDK for browser navigation, interactions, forms, client errors, business states, and frontend workflows. Use the backend SDK for server APIs, server errors, backend states, and backend workflows. A full-stack application can use both, provided events use the same Tellann application and environment.

> The packages are workspace packages in the current repository at version `0.1.0`. External npm publication and customer installation commands must be confirmed for the target deployment before presenting them as publicly installable packages.

### 7.1 Frontend SDK

Install the package using the package source available to the deployment, then initialize it once near the root of the browser application.

For a Next.js client provider:

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { TELLANN } from '@tellann/frontend-sdk';

export function TellannProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    TELLANN.initialize({
      endpoint: process.env.NEXT_PUBLIC_TELLANN_GATEWAY_URL!,
      apiKey: process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY!,
      applicationId: process.env.NEXT_PUBLIC_TELLANN_APPLICATION_ID!,
      environmentId: process.env.NEXT_PUBLIC_TELLANN_ENVIRONMENT_ID!,
      debug: process.env.NODE_ENV !== 'production',
    });

    void TELLANN.verifyInstallation();

    return () => TELLANN.teardown();
  }, []);

  return children;
}
```

The onboarding wizard currently displays `http://localhost:3000` as the gateway endpoint. Replace it with the deployed gateway URL outside local development.

The frontend SDK automatically enables click, form, route, and error tracking unless those options are disabled. Initialization starts a session, records the initial page view, buffers events, and flushes them to `/v1/events/batch`.

Because browser-side values can be inspected by end users, the ingestion key must be treated as a narrowly scoped write credential. It must never be a dashboard-management or administrative token.

### 7.2 Backend SDK

Initialize the backend singleton once during server startup:

```ts
import { TELLANN } from '@tellann/backend-sdk';

TELLANN.initialize({
  endpoint: process.env.TELLANN_GATEWAY_URL!,
  apiKey: process.env.TELLANN_INGESTION_KEY!,
  applicationId: process.env.TELLANN_APPLICATION_ID!,
  environmentId: process.env.TELLANN_ENVIRONMENT_ID!,
});

await TELLANN.verifyInstallation();
```

The backend package also exports Express middleware, a Fastify integration, and helpers for API calls, errors, states, and workflows. Use the framework integration where possible and manual calls for business-level meaning that middleware cannot infer.

### 7.3 Track meaningful states and transitions

Auto-tracking supplies interaction evidence, but explicit state events make expected-vs-observed reconciliation much more reliable:

```ts
TELLANN.trackState('CHECKOUT', 'BUSINESS');
TELLANN.trackTransition('CART_WITH_ITEMS', 'CHECKOUT', 'CLICK_CHECKOUT');
```

The names should match the declared states. A spelling or naming mismatch is treated as undeclared observed behavior rather than as confirmation of the expected state.

### 7.4 Track workflows

```ts
const workflowId = TELLANN.startWorkflow('Checkout');

try {
  await submitOrder();
  TELLANN.completeWorkflow(workflowId);
} catch (error) {
  TELLANN.failWorkflow(workflowId, 'Order submission failed');
  TELLANN.captureException(error, { workflow: 'Checkout' });
}
```

On the backend, the workflow methods are asynchronous when completing or failing, and accept an optional correlated session ID.

### 7.5 Correlate frontend and backend evidence

The backend SDK creates a new session ID when none is supplied. For an end-to-end journey, propagate a safe correlation/session identifier from the frontend request to the backend and pass it into backend tracking calls. Without correlation, the browser and server evidence can appear as separate sessions.

### 7.6 Privacy and data minimization

The frontend auto-tracker sanitizes common sensitive metadata, but the integrating team must still avoid sending:

- Passwords.
- Access or refresh tokens.
- API keys and private keys.
- Card numbers, CVVs, or other payment secrets.
- Sensitive form values.
- Full request or response bodies unless they are explicitly redacted and necessary.

Prefer stable IDs, state names, route templates, status codes, durations, and non-sensitive diagnostic categories.

## 8. Verify the SDK connection

The onboarding screen checks three conditions:

1. **Initialize SDK in code**.
2. **Establish session connection**: at least one telemetry session is observed.
3. **Onboarding test event pass**: `TELLANN_ONBOARDING_TEST` is received.

Calling `TELLANN.verifyInstallation()` sends the test event. The onboarding page polls readiness and also provides **Force check**.

If verification does not pass:

1. Confirm the application ID and environment ID match the currently selected Tellann application.
2. Confirm the ingestion key belongs to that environment and has not been revoked.
3. Confirm the gateway URL is reachable from the application.
4. Inspect the browser network panel or server logs for `/v1/events/batch` or `/v1/events`.
5. Confirm the SDK initialization code actually executes.
6. Confirm CORS permits the browser application's origin.
7. Trigger `verifyInstallation()` again after correcting configuration.

## 9. Demonstrate the application

Once installation verification passes, Tellann asks the user to start their application and interact with it.

This is a behavioral walkthrough, not merely a page-loading check. The user should exercise the declared workflow and deliberately cover:

- Normal success.
- Invalid input.
- Empty results or no-data behavior.
- Permission denial.
- External dependency failure where safe to simulate.
- Retry and recovery.
- Cancellation or abandonment.
- Logout and session expiry where appropriate.

During the walkthrough, Tellann polls observed state counts. Analysis unlocks when the number of unique observed states reaches:

```text
max(3, ceil(25% of the expected state count))
```

This threshold only means enough data exists to run the first comparison. It does not mean the application has adequate behavioral coverage.

The wizard displays expected states and transitions as a walkthrough guide. The integrating application must emit corresponding `STATE_ENTERED` and `STATE_TRANSITION` telemetry for manual state visits to contribute directly to the observed graph.

## 10. Analyze and reconcile

When the observation threshold is met, choose **Analyze Demonstration & Generate Report**.

In the current implementation, this action:

1. Marks the demonstration and first-report onboarding milestones complete.
2. Runs reconciliation for the active environment.
3. Checks whether the user has reached the first-value milestone.

The reconciliation model classifies results as:

- **Confirmed states/transitions**: expected and observed.
- **True gaps**: declared but not observed.
- **Undeclared states/transitions**: observed but not declared.
- **Expected state coverage**: confirmed expected states divided by the relevant expected-state total.
- **Transition coverage**: confirmed expected transitions divided by the relevant expected-transition total.

An undeclared state is not automatically a defect. It may be:

- A legitimate behavior missing from the declaration.
- A naming mismatch.
- Instrumentation noise.
- An unintended product path.

The user must inspect context before deciding.

## 11. Resolve reconciliation findings

After onboarding, open **Reconciliation** or return to **Declare Flows** for the active application.

For each completed declared flow:

1. Review state and transition coverage.
2. Inspect true gaps.
3. Inspect undeclared states and transitions.
4. If undeclared behavior is valid, promote it into the expected model.
5. If it is invalid, investigate the application or instrumentation.
6. Reopen and update the declaration when product intent has changed.
7. Run another demonstration and reconciliation.

The reconciliation screen can export its expected-vs-observed findings. This export is distinct from the broader QA report export.

## 12. Complete onboarding

When first value is realized, Tellann shows:

- Missing states: declared but not reached.
- Unexpected states: reached but not declared.
- An optional 1-5 setup rating and free-text feedback.

Choose **Complete Onboarding & Go to Dashboard**. Feedback is non-gating.

After completion, the same `/declare` route becomes the ongoing Flow Declaration Builder rather than the first-time setup wizard.

## 13. Understand the dashboard outputs

Every application-scoped view should be read with the selected organization, application, and environment in mind.

### Overview

The overview summarizes:

- State coverage.
- Transition coverage.
- Flow coverage.
- Total sessions.
- Missing states.
- Missing flows.

It is a high-level snapshot, not the detailed evidence view.

### Behavioral Graph

Shows the observed state-and-transition topology built from telemetry. Use it to understand what the application actually did.

### Declare Flows

Shows the expected model. Use it to create versions, edit intent, consider suggestions, compile flows, and inspect per-flow reconciliation.

### Reconciliation

Compares expected and observed behavior for completed flows and the selected environment. Use it for gap triage and promotion decisions.

### Graph Drift

Compares behavioral graph versions over time. Use it to detect added, removed, or changed behavior after releases or new demonstrations.

### Workflows

Lists discovered repeatable paths and execution counts.

### Missing States

Lists expected conditions that the observed evidence did not reach. Confidence and reasoning help prioritize review but do not replace product judgment.

### Missing Flows

Lists expected paths or workflow variations not seen in evidence.

### Sessions

Lists captured sessions. Opening a session shows its chronological replay/evidence. Use this to understand the exact events behind a graph or report finding.

### Endpoints

Shows API endpoint intelligence such as request count, latency, error rate, slow endpoints, and error-prone endpoints. Backend SDK or API telemetry is needed for useful results.

### Reports

Combines sessions, discovered workflows, coverage, missing states, missing flows, and endpoint intelligence into the application's QA report.

## 14. Read the QA report

The report screen contains:

- **State Coverage**: how much expected state behavior was observed.
- **Transition Coverage**: how much expected movement between states was observed.
- **Flow Coverage**: how much expected workflow behavior was observed.
- **Discovered Workflows**: observed paths and execution counts.
- **Unreached States**: expected states with confidence and a reason.
- **Uncovered Paths**: expected paths not observed, with confidence and a reason.
- **Endpoint Intelligence** in report generation/export where endpoint evidence exists.

A report with no sessions and no workflows is treated as not ready. The user is directed back to SDK connection or demonstration.

### Interpreting the metrics

Coverage is evidence of what was exercised, not proof that the implementation is correct.

- High coverage can still contain incorrect behavior.
- Low coverage may mean missing demonstrations, incorrect telemetry names, or genuine product gaps.
- A high-confidence missing state is a strong review candidate, not an automatic bug.
- Endpoint error rates and latency describe observed traffic, not every possible load condition.

The most useful review order is:

1. Confirm the selected application and environment.
2. Review true gaps and missing flows.
3. Open relevant sessions.
4. Check endpoint errors and latency.
5. Decide whether to fix the application, improve instrumentation, or update the declaration.
6. Demonstrate again and compare the new result.

## 15. Export the report

Available formats are subscription-dependent:

- `JSON_ONLY`: JSON.
- `JSON_PDF`: JSON and PDF.
- `ALL_FORMATS`: JSON, PDF, HTML, and CSV.

The report service may return a time-limited download URL from object storage. The dashboard also supports a legacy direct-download response.

Use:

- **JSON** for automation, archival, or downstream tools.
- **CSV** for spreadsheet analysis.
- **HTML** for a portable browser-readable report.
- **PDF** for executive and review distribution.

## 16. Recommended first run

For a first useful result, a user should:

1. Declare one bounded, valuable workflow such as Login or Checkout.
2. Include the success path, one validation failure, one operational failure, and one recovery path.
3. Instrument explicit state entries and transitions with exact matching names.
4. Verify the installation test.
5. Demonstrate every declared branch that is safe to exercise.
6. Generate the reconciliation.
7. Inspect the session behind every surprising result.
8. Correct naming or instrumentation issues.
9. Promote legitimate undeclared behavior or update the application when behavior is unintended.
10. Run a second demonstration and compare coverage/drift.
11. Export the resulting report.

## 17. Ongoing operating cycle

Tellann is most useful as a repeated quality loop:

```text
Update product intent
  -> Version declared flows
  -> Instrument new behavior
  -> Demonstrate manually or through automation
  -> Reconcile
  -> Triage gaps and unexpected paths
  -> Inspect sessions and endpoints
  -> Fix product, declaration, or instrumentation
  -> Repeat and compare drift
```

Run this loop for major features, risky releases, authorization changes, payment changes, migrations, and important regression suites.

## 18. Current-system caveats

These points are important when training users or publishing external documentation:

1. **Tellann and TELLANN names coexist.** The UI and logs use Tellann, while package names, event names, and some docs still use `TELLANN`.
2. **Older docs contain stale package names.** The current packages are `@tellann/frontend-sdk` and `@tellann/backend-sdk`, not `@tellann/react` and `@tellann/node`.
3. **The onboarding snippet is local-development oriented.** It hardcodes `http://localhost:3000`; production documentation must substitute the deployed gateway.
4. **SDK packages are repository workspace packages.** Public package distribution should be verified before telling external users to run a public npm install.
5. **The wizard does not explicitly start and stop a named demonstration session.** It observes telemetry for the application/environment, waits for the state threshold, and then triggers reconciliation.
6. **The first onboarding “report” and the Reports page are related but not identical.** The first result is reconciliation for declared versus observed behavior; the Reports page is the broader application QA report.
7. **Clicking Analyze currently marks onboarding report milestones before checking whether reconciliation succeeds.** If reconciliation fails, the user may need support or a retry even though progress flags have advanced.
8. **The onboarding threshold is readiness, not quality.** Three states, or 25% of expected states, is only enough to enable analysis.
9. **Explicit state naming matters.** Automatic click/form/route capture does not guarantee that domain states will match the declaration.
10. **Frontend and backend correlation is an integration responsibility.** Without a shared session/correlation ID, full-stack evidence can fragment.
11. **Feedback in the completion screen is only local UI state in the current page.** It is not visibly persisted by the onboarding flow.
12. **Report availability and export formats are entitlement-controlled.** Users may see fewer export buttons than another organization.

## 19. User completion checklist

A user has completed a meaningful Tellann setup when:

- [ ] They can sign in and recover a session.
- [ ] They belong to the correct organization.
- [ ] The correct application and environment are selected.
- [ ] At least one useful flow is declared and compiled.
- [ ] The ingestion key is stored safely.
- [ ] The appropriate SDK is initialized against the correct gateway.
- [ ] `TELLANN_ONBOARDING_TEST` passes.
- [ ] Domain states and transitions are emitted with declaration-matching names.
- [ ] A representative success path and failure/recovery path have been demonstrated.
- [ ] Reconciliation has been generated and reviewed.
- [ ] Unexpected behavior has been triaged rather than blindly accepted.
- [ ] Relevant sessions and endpoint evidence have been inspected.
- [ ] The broader QA report is populated.
- [ ] The report has been exported in an allowed format.
- [ ] A repeat demonstration has been run after fixing at least one finding.

