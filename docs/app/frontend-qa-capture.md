# Frontend QA Capture, Inspect Mode, and Report V2

## Summary

Upgrade frontend QA into a boundary-aware capture system that:

- Records browser, interaction, request, storage, performance, and Flow evidence.
- Treats emitted Flow events—not URL guesses—as the authoritative initial, intermediate, transition, and terminal boundaries.
- Enables browser-based element inspection, comments, and organization-member mentions.
- Closes Chromium and immediately navigates to the run detail page when the run ends.
- Generates a durable asynchronous report whose primary output is evidence-backed, prioritized improvements.
- Preserves production observation-only safety and applies privacy protection before evidence is persisted.

Success means a user can complete a Flow, see every expected state and transition Tellann detected or missed, understand what happened around each interaction, annotate specific UI elements, and receive a reliable report without exposing passwords, tokens, payment data, or raw PII.

## 1. Capture architecture and privacy

### Boundary-aware capture phases

Introduce these capture phases:

| Phase | Behavior |
|---|---|
| `PRE_BOUNDARY` | Record routes, viewport, request metadata, console errors, crashes, and emitted Flow events. Do not retain form values, request bodies, or client-state values. |
| `IN_FLOW` | Starts only after the cloud accepts the emitted initial Flow event. Enable meticulous interaction, field, storage, state-management, request-body, and performance capture. |
| `FINALIZING` | Freeze event collection, capture final sanitized artifacts, close Chromium, and synchronize remaining evidence. |
| `COMPLETE` | Evidence is durable; report generation proceeds asynchronously. |

All evidence carries `scope: PRE_BOUNDARY | IN_FLOW`. Report sections 1–3 use `IN_FLOW`; only high-confidence/high-severity system risks from `PRE_BOUNDARY` appear in the critical out-of-flow section.

### Authoritative Flow events

Use the existing Flow event vocabulary:

- `FLOW_INITIAL_STATE`
- `FLOW_STATE_REACHED`
- `FLOW_TRANSITION`
- `FLOW_TERMINAL_STATE`

Require events to include the run, Flow version, state key, event ID, and timestamp. Transition events also include `fromStateKey`, `toStateKey`, and action.

The local relay forwards these events to the existing boundary endpoint. The cloud validates them against the immutable selected Flow version and returns accepted, quarantined, and terminal outcomes.

- An accepted initial event switches the browser observer to `IN_FLOW`.
- A terminal event closes capture only after the server confirms that it is a declared terminal.
- Unknown, duplicate, pre-initial, and out-of-order events remain quarantined and visible in diagnostics.
- URL-derived states remain observational candidates but no longer start or complete the Flow automatically.
- Frontend and backend SDK events may confirm boundaries, provided they use the run credential.

### Privacy policy

Implement a shared QA privacy classifier used in the browser process, ingestion API, report worker, and reveal endpoint.

- Never capture password values, authentication tokens, cookies, session IDs, private keys, CVVs, payment-card values, hidden fields, or file contents. Record only safe metadata such as “field populated.”
- Pseudonymize email addresses, phone numbers, user/account identifiers, and similarly classified direct identifiers with a versioned keyed HMAC. Reports show a stable fingerprint, never the original value.
- Encrypt ordinary form values and permitted same-origin payload fields with AES-256-GCM at rest.
- Default report rendering shows `[PROTECTED · n characters]`.
- Only the run creator and organization Owners/Admins may reveal encrypted ordinary values. Every reveal is individually authorized, audit logged, rate limited, and returned with `Cache-Control: no-store`.
- Encrypt offline desktop evidence queues with Electron `safeStorage`; never write raw protected values to manifests or logs.
- Recursively redact values both before upload and again at ingestion.
- Strip URL fragments and query values; retain query parameter names for debugging.
- Blur sensitive field regions in final and inspect-mode screenshots.
- Disable DOM/screenshot Playwright tracing by default when protected-value capture is active, because trace snapshots can contain unredacted page content.
- Honor `data-tellann-ignore` and add `data-tellann-sensitive` for application-defined exclusions.

This follows OWASP guidance that passwords, tokens, session data, payment data, and PII should be removed, masked, pseudonymized, or encrypted rather than logged directly. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Environment policy

- Development and staging: full `IN_FLOW` capture after explicit start-screen disclosure and consent.
- Production: retain request metadata, performance, routes, viewport, critical errors, and inspect annotations; never retain field values, storage values, request/response bodies, or client-state values.
- Inspect mode remains available in production because selection prevents the underlying page action and only stores sanitized element metadata and screenshots.

## 2. Evidence collection

### Canonical QA evidence contract

Add a versioned `QAEvidenceEvent` contract with:

- Identity: event, run, session, trace, application, environment.
- Ordering: monotonically increasing local sequence and timestamp.
- Classification: event type, source, boundary scope, privacy classification.
- Context: page URL, normalized route, accepted Flow state, viewport.
- Causality: `interactionGroupId` and optional `causedByEventId`.
- Safe searchable metadata.
- Optional encrypted payload envelope with key version, IV, ciphertext, and authentication tag.

Persist events in a new `QARunEvidenceEvent` model instead of overloading boundary-progress events. Upload idempotent batches during the run and flush the encrypted local spool before completion. Retain the existing 32 KB event and 5 MB batch limits; never silently sample. Any quota, size, or upload loss creates an explicit `CAPTURE_DEGRADED` finding.

### Outgoing requests

Capture the full Playwright request lifecycle for every page, frame, popup, worker, and service worker associated with the managed context:

- Request start, response, completion, redirect, and failure.
- Method, sanitized origin/path, resource type, initiator, status, timing phases, transferred bytes, and response content type.
- Safe allow-listed headers only; never authorization, cookie, or set-cookie values.
- Same-origin JSON or form request/response bodies only, recursively redacted and capped at 16 KB each.
- Cross-origin and binary traffic remains metadata-only.
- WebSocket open/close/error and outgoing frame metadata; retain capped JSON frames only for same-origin sockets after redaction.
- Correlate requests to the most recent click, form submission, route change, or Flow transition.

Playwright exposes distinct request, response, finished, and failed lifecycle events, which should be combined into one durable request record. [Playwright request lifecycle](https://playwright.dev/docs/api/class-request)

### Window and route evidence

Record:

- Viewport width/height, outer-window dimensions, screen dimensions, device pixel ratio, orientation, and timestamp.
- Initial resolution and debounced resize changes.
- Full document navigation, redirects, popup creation, history push/replace, popstate, hash changes, and title changes.
- Repository route match and confidence when the active repository snapshot contains the normalized runtime route.
- Runtime-only status when no codebase route match exists.

### Console and runtime failures

Capture context-level console messages from pages and workers:

- Level/type, sanitized rendered message, safe structured arguments, source URL, line, and column.
- Uncaught exceptions, promise rejections, page crashes, blank/broken render detection, and browser disconnection.
- Apply the privacy classifier before persistence.
- Deduplicate repeated identical messages while preserving count, first occurrence, and last occurrence.

### Buttons, forms, and fields

Inject one QA recorder into every same-origin document and frame.

For clicks:

- Resolve the composed event path to the nearest button, link, submit control, or role-based control.
- Record tag, role, accessible name, visible text, ID, name, test ID, button type, containing form, stable selector fingerprint, and element bounds.
- Generate an `interactionGroupId`.

For forms:

- Record submit intent and final submission separately.
- Associate a submit with the initiating button through `causedByEventId`.
- Correlate route changes, requests, emitted state changes, and Flow transitions caused by the interaction.

For fields:

- Capture on debounced change, blur, and submit—not every keystroke.
- Record field type, ID, name, accessible label, form ID/name, autocomplete classification, validation state, required/disabled/read-only state, and value length.
- Apply the selected protection policy to the value.
- Never capture file contents or secret field values.

### Browser and application state

Support:

- `localStorage` and `sessionStorage`: instrument `setItem`, `removeItem`, and `clear`, recording key, operation, and protected previous/new values.
- Cookies: metadata only—name fingerprint, domain, path, secure, same-site, and expiry; never values.
- Redux: instrumentation adapter adds QA-only middleware that records action type, changed slice paths, and protected values.
- React Context: instrument only providers/setters explicitly identified and approved in the validated Flow instrumentation manifest.
- `useState`: instrument only approved Flow-relevant setters found during static analysis; do not attempt blanket React-internals interception.
- Other stores: expose a small SDK API, `trackClientState(store, key, previous, next)`, for Zustand, MobX, custom context, and future adapters.

If no validated state instrumentation is installed, the report states that framework-state evidence was unavailable; browser-level QA remains functional.

### Page performance

Install `PerformanceObserver` before application code and collect:

- Navigation timing and DOM content loaded/load.
- First Contentful Paint and Largest Contentful Paint.
- Cumulative Layout Shift.
- Interaction/event timing where supported.
- Long tasks.
- Resource timing.
- Route-to-data-ready time.
- Route-to-visually-stable time.

For SPA routes:

- Start timing when navigation is initiated.
- Define data-ready as a 500 ms quiet period with no relevant in-flight same-origin data requests, capped at 10 seconds.
- Define visually stable as two animation frames plus 250 ms without meaningful DOM mutation after data-ready, capped at 10 seconds.
- Mark unsupported metrics explicitly rather than fabricating values.

Compare runtime routes with repository route and endpoint analysis when available. Code analysis supplies ownership and expected dependencies, not synthetic performance expectations. `PerformanceObserver` is the preferred standards-based collection mechanism for navigation, resource, paint, and long-task data. [W3C Performance Timeline](https://www.w3.org/TR/performance-timeline/), [W3C Resource Timing](https://www.w3.org/TR/resource-timing/)

## 3. Inspect mode

### Desktop and Chromium interaction

Replace Pause as the primary secondary control with a clear segmented mode selector:

- `Navigate`
- `Inspect`

Pause remains a separate true-capture control and must synchronize browser observation, relay intake, and cloud status.

Switching to Inspect sends a typed IPC command to the browser observer. Switching back removes the overlay without reloading the page.

### Browser overlay

Because the selected authoring experience is inside Chromium:

- Inject the overlay into a closed Shadow DOM with isolated styles.
- Use a crosshair cursor and hover outline.
- Prevent the selection click from navigating, submitting, or invoking the underlying application.
- Support mouse selection, keyboard focus plus Enter, Escape to cancel, visible focus indicators, and screen-reader live announcements.
- Allow inspection inside same-origin frames and open shadow roots. For inaccessible cross-origin content, anchor to the iframe element itself.
- Keep overlay nodes and events out of application telemetry and screenshots unless the annotation marker is intentionally rendered.

After element selection, open a browser-side annotation panel containing:

- Element preview and route.
- Plain-text comment field, 2,000-character maximum.
- Organization-member search and multi-mention chips.
- Save, reselect, and cancel actions.

Member search goes through a randomly named Playwright binding to the Electron main process. Return only accepted organization members’ user IDs, display names, avatars, and roles—never email addresses. Exclude the annotation author and pending invitations.

### Annotation persistence

Add `QARunAnnotation` and `QARunAnnotationMention` records containing:

- Run, author, boundary scope, Flow state, route, timestamp.
- Comment as plain text.
- Stable element fingerprint:
  - tag and role
  - accessible name
  - ID/test ID
  - sanitized CSS path
  - frame URL
  - DOM fingerprint
- Document and viewport bounding boxes.
- Window resolution.
- Sanitized screenshot artifact with a numbered pin.
- Mentioned member IDs plus display-name snapshots for historical rendering.

Allow annotations while the run is active, including pre-boundary annotations. Classify pre-boundary annotations as contextual/out-of-flow rather than discarding them.

The cloud revalidates author membership and every mentioned user at save time. Removed users remain visible historically but do not receive report notifications.

## 4. Completion, pending-state UX, and report generation

### Browser completion

Refactor completion into two stages.

1. Local finalization:
   - Stop accepting new detailed events.
   - Flush observers.
   - Capture sanitized final screenshot and accessibility snapshot.
   - Persist the encrypted recovery journal.
   - Close Chromium.
   - Emit a renderer lifecycle event immediately.

2. Background synchronization:
   - Flush evidence batches and SDK events.
   - Upload approved artifacts.
   - Persist findings and annotations.
   - Complete the cloud run.
   - Enqueue report generation.
   - Retry safely after desktop restart if synchronization was interrupted.

Both automatic terminal completion and manual End use the same idempotent path.

### Desktop behavior

On an accepted terminal event:

- Show an in-app success notification: “Terminal state reached. Chromium was closed and your QA report is being prepared.”
- Optionally issue a native desktop notification according to the user’s notification preference.
- Navigate immediately to `/applications/:applicationId/qa-runs/:runId`.
- Clear the stale local active-run state.

On manual stop:

- Navigate to the same detail page.
- State clearly whether the initial boundary or terminal boundary was missing.
- Generate an incomplete report from whatever valid scoped evidence exists.

### Run detail while pending

Upgrade the run detail page to display live synchronized summaries before the final report exists:

- Flow and boundary status.
- Current processing stage:
  - Finalizing locally
  - Uploading evidence
  - Reconciling Flow
  - Generating improvements
  - Ready / Failed
- Duration, target URL, environment, capture tracks, instrumentation status.
- Evidence counts by type.
- Expected states/transitions visited and missing.
- Annotation count and mentioned teammates.
- Preliminary critical failures.
- Retry action for failed evidence sync or report generation.

Use lifecycle IPC events for immediate local state, then poll the cloud with bounded exponential backoff. Avoid storing high-frequency evidence arrays in React component state; retain counters and selected records to prevent renderer churn.

### Durable asynchronous report

Add a one-to-one `QAReport` and `QAReportGenerationJob`:

- Report statuses: `PENDING`, `RECONCILING`, `ANALYZING`, `GENERATING`, `READY`, `FAILED`.
- Store schema version, immutable final JSON payload, generator provenance, AI/rules status, attempts, timestamps, and safe failure reason.
- Completion creates the report/job transactionally.
- A background worker atomically claims jobs, retries up to three times, and remains functional through the existing interval fallback when Redis is unavailable.
- Report failure does not change an already completed QA run to failed.
- A manual retry resets only the report job.
- Do not emit `FLOW_QA_REPORT_READY` until the durable report snapshot is actually `READY`.

### Report analysis

Run deterministic analysis first:

- Declared versus observed states and transitions.
- Missing required states/transitions.
- Unexpected states/transitions.
- Failed requests and 4xx/5xx clusters.
- Console/runtime exceptions.
- Slow page/data/render timings.
- Broken/blank pages.
- Interaction with no expected effect.
- Form validation failures.
- High-confidence absence of pagination when code and runtime evidence show a large collection without paging controls.
- Capture/instrumentation gaps.

Then run AI synthesis when entitled and configured:

- Input only sanitized summaries, Flow structure, deterministic findings, performance values, and evidence identifiers.
- Never send protected field values, bodies, raw screenshots, full console payloads, annotation comments, or member data to the AI provider.
- Require a strict Zod result containing priority, impact, confidence, rationale, suggested action, expected outcome, affected state/transition, and evidence references.
- Deduplicate AI suggestions against deterministic improvements.
- Fall back to the complete rules-only report if AI is unavailable or invalid.
- AI recommendations never modify the declared Flow or application code automatically.

### Final report structure

Render these sections in this order:

1. **Flow summary**
   - Name, purpose, scope, initial state, terminal states, declared state/transition counts, version, and provenance.

2. **QA run summary**
   - URL, environment, capture track, instrumentation evidence, repository revision, viewport history, duration, boundary outcome, event counts, and capture degradation warnings.

3. **In-Flow findings and prioritized improvements**
   - Only evidence between accepted initial and terminal boundaries.
   - Put a ranked “Recommended next actions” list first.
   - Group detailed findings by state and transition.
   - Show severity, user impact, confidence, effort, reproduction path, recommendation, and direct evidence links.
   - Clearly distinguish deterministic versus AI-synthesized recommendations.

4. **Critical system-wide findings**
   - High/critical issues outside the selected Flow that materially affect the application.
   - Include page crashes, blank renders, severe loading delays, systemic request failures, and high-confidence scalability/usability problems.
   - Never dilute this section with ordinary unrelated warnings.

5. **User annotations**
   - Screenshot with numbered element pin.
   - Comment, author, timestamp, route, Flow state, resolution, and mentioned teammates.
   - Link annotations to related findings when they share the same route/state/element.

6. **Evidence appendix**
   - Request timeline, console, routes, forms, protected-field metadata, storage/state mutations, performance metrics, artifacts, accepted/quarantined Flow events, and capture limitations.

The report page must provide masked values by default and a per-value audited reveal action only to the authorized roles chosen above.

## 5. Interfaces and service changes

### Desktop IPC

Add typed commands/events:

- `runs.setInteractionMode("NAVIGATE" | "INSPECT")`
- `runs.pauseCapture()` / `runs.resumeCapture()` with real cloud synchronization
- `runs.onLifecycleEvent(handler)`
- `runs.retrySynchronization(runId)`
- `runs.searchMentionableMembers(runId, query)`
- Browser binding callbacks for element selection, annotation save, member search, and overlay status.

`RunLifecycleEvent` includes run ID, phase, local/cloud status, completion reason, terminal state, evidence counts, report status, and optional safe error.

### Cloud APIs

Add or extend:

- `POST /qa-runs/:runId/evidence-events/batch`
- `GET /qa-runs/:runId/evidence-summary`
- `POST /qa-runs/:runId/annotations`
- `GET /qa-runs/:runId/annotations`
- `GET /qa-runs/:runId/report-status`
- `POST /qa-runs/:runId/report/retry`
- `POST /qa-runs/:runId/protected-values/:valueId/reveal`
- Extend organization member listing with bounded display-name search.
- Extend run detail with report status, synchronization status, boundary progress, evidence counts, performance summary, and annotation count.

`GET /qa-runs/:runId/report` returns:

- `202` with report status and progress while pending.
- `200` with the immutable versioned report when ready.
- A safe failure envelope and retry eligibility when failed.

Existing completed report IDs remain valid. Legacy runs without a `QAReport` row continue through the current dynamic assembler and can be lazily snapshotted; no destructive backfill is required.

### Database changes

Add:

- `QARunEvidenceEvent`
- `QARunAnnotation`
- `QARunAnnotationMention`
- `QAReport`
- `QAReportGenerationJob`
- Event-to-finding evidence links.
- Finding scope, dedupe key, and generator provenance.
- Report and evidence reveal audit actions.

Extend artifact types with inspect screenshot and sanitized final screenshot variants. All new records cascade from the QA run and participate in the existing behavioral-data retention process.

### Notifications

Create:

- `QA_TERMINAL_REACHED` for the initiating user’s desktop/in-app experience.
- `QA_REPORT_READY` for the run creator.
- `QA_REPORT_MENTIONED` for mentioned teammates.

When a report reaches `READY`:

- Send one idempotent in-app/email notification per mentioned member per report, even if they were mentioned multiple times.
- Include application, Flow, author, annotation count, and a deep link to the report’s annotation section.
- Do not include comment text, screenshots, field data, or captured payloads in email.
- Revalidate organization membership before sending.
- Respect report notification preferences, suppressions, and delivery auditing.

## 6. Test plan and acceptance criteria

### Capture tests

- Every HTTP request produces one completed or failed record with correct redirect and timing data.
- Safe same-origin JSON bodies survive; secrets are redacted; cross-origin bodies are absent.
- WebSocket messages, console levels, worker logs, popups, iframes, SPA routes, and resize events are correlated correctly.
- Button-triggered form submission shares an interaction group and causal reference.
- Field labels resolve through `label[for]`, wrapping labels, ARIA, and fallback attributes.
- Password, card, token, cookie, file, ignored, and sensitive fields never persist raw values.
- Local/session storage and Redux events carry protected diffs.
- Performance observers produce route-scoped metrics and explicit unsupported/timeout states.

### Flow-boundary tests

- Detailed capture remains disabled before an accepted initial event.
- Browser route matching alone cannot start or stop the run.
- Duplicate/out-of-order/unknown events are idempotently quarantined.
- Accepted terminal event finalizes exactly once.
- Manual stop before initial and before terminal creates the correct incomplete outcome.
- Frontend and backend Flow events can both advance the same run safely.

### Inspect-mode tests

- Navigate mode behaves exactly like the application.
- Inspect selection never invokes the underlying click, navigation, or submit.
- Hover, keyboard selection, Escape, focus trapping, live announcements, and visible focus satisfy accessibility expectations.
- Element anchors survive common DOM rerenders and degrade to screenshot/fingerprint when the node disappears.
- Member search never exposes emails or cross-organization users.
- Annotation screenshots redact sensitive fields.
- Multiple mentions are persisted and deduplicated correctly.

### Security and authorization tests

- Tenant isolation on every evidence, annotation, report, member-search, and reveal route.
- Only creator/Owner/Admin can reveal encrypted ordinary values.
- Reveal produces an audit event and no-cache response.
- Pseudonymized fields cannot be revealed.
- Production rejects protected values and payload bodies even if a compromised client submits them.
- Encrypted local queues recover after restart without plaintext files.
- Missing encryption configuration fails closed in production.

### Report and lifecycle tests

- Terminal completion closes Chromium, notifies the renderer, clears active state, and navigates to run detail.
- Run detail shows local summary immediately and converges to cloud data.
- Report moves through pending stages and becomes a durable immutable snapshot.
- Reconciliation uses only the selected run and Flow version.
- Rules-only fallback remains complete when AI fails or is not entitled.
- Every recommendation references evidence and no AI output invents routes, states, or findings.
- Mention notifications send once per member after—and only after—the report is ready.
- Interrupted uploads and desktop restarts resume without duplicate evidence, findings, annotations, reports, or email.

### Verification commands and smoke flow

- Prisma format/validate and migration tests.
- Desktop contracts, browser observer, local relay, frontend/backend SDK, onboarding API, report engine, FDRS, email, and worker typechecks/tests.
- Desktop production build.
- Playwright fixture application covering clicks, forms, storage, Redux, slow requests, SPA navigation, resize, initial/terminal Flow events, and inspect annotations.
- Signed-in desktop smoke run from start through automatic terminal navigation and report-ready notification.
- Production observation-only smoke run proving that values and bodies never leave the browser.

## 7. Rollout and observability

- Gate the new pipeline behind `QA_CAPTURE_V2`.
- Deploy schema and ingestion support first.
- Dual-write existing route observations/findings and V2 evidence during validation.
- Enable V2 for development/staging organizations before production metadata-only capture.
- Keep the legacy report assembler until migrated clients and old run links are verified.
- Instrument event throughput, rejected/redacted fields, spool backlog, capture degradation, evidence upload latency, report queue time, reconciliation time, AI fallback rate, reveal attempts, and notification delivery.
- Alert on report-job failure, encryption failure, sustained evidence backlog, missing terminal synchronization, and capture-drop findings.
- Document the QA capture disclosure, production restrictions, encryption/HMAC key rotation, data retention, and authorized reveal behavior.

## Assumptions locked for implementation

- Browser overlay is the chosen annotation experience.
- Comments are plain text; mentions reference accepted organization members only.
- Email/phone/direct identifiers are pseudonymized and cannot be revealed.
- Passwords and secrets are never captured, even in encrypted form.
- Ordinary protected values are revealable only by the run creator and organization Owners/Admins.
- Same-origin JSON/form bodies are capped and redacted; cross-origin bodies are never retained.
- Production remains metadata-only but supports inspect annotations.
- Recommendations use deterministic analysis plus entitled AI synthesis with a complete rules-only fallback.
- Generic interception of every React `useState` or `useContext` value is not considered reliable; only validated, approved instrumentation is reported as captured.
- Accessible focus management, keyboard inspection, live status announcements, and visible focus indicators are acceptance requirements for both the desktop controls and injected browser overlay.
