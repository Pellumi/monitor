# Phase 2 Document Intelligence Acceptance

Status: implemented and service-level acceptance verified on 2026-08-01.

## Delivered scope

- Local extraction for PDF, DOCX, Markdown, plain text, HTML, and OpenAPI JSON/YAML.
- Local secret/PII redaction and segment-level prompt-injection quarantine.
- Derived-summary-first synchronization; raw document bytes remain local unless a future separately approved upload path is used.
- Tenant-scoped source-document manifests, immutable versions, processing jobs, and evidence records.
- Asynchronous document processing and asynchronous intent generation with a deterministic rules fallback when the configured AI provider is unavailable.
- Reviewable intent drafts containing workflows, states, transitions, conflicts, assumptions, confidence, and evidence citations.
- Natural-language correction creates a new draft; it cannot mutate an existing reviewed draft or declared graph.
- Explicit conflict resolution and acceptance are required before a declared graph is created.
- Accepted proposals create immutable `BehaviorGraphVersion` snapshots with an evidence manifest.
- Guided QA runs can select that exact expected graph version, reconcile browser observations against it, and render the same provenance in the canonical report.
- Desktop Sources, Intent, review detail, and expected-version run selection experiences.

## Security invariants

1. The renderer cannot read documents directly; selection and extraction occur through the typed preload/main-process boundary.
2. Absolute paths are rejected by cloud document APIs.
3. Prompt-injection segments are retained as quarantined evidence but excluded from AI-safe text.
4. Raw secrets are redacted before evidence is synchronized.
5. Draft generation and correction only create review records. The declared graph count remains unchanged until the explicit `ACCEPT` review mutation.
6. Source versions, evidence, drafts, graphs, runs, reconciliation, and reports are application- and organization-scoped.

## Automated verification

Run:

```powershell
npx.cmd pnpm --filter @sots/document-intelligence build
npx.cmd pnpm --filter @sots/document-intelligence test
npx.cmd pnpm --filter @sots/background-workers typecheck
npx.cmd pnpm --filter @sots/onboarding-api build
npx.cmd pnpm --filter @sots/fdrs-api build
npx.cmd pnpm --filter @sots/report-engine build
npx.cmd pnpm --filter @sots/api-gateway build
npx.cmd pnpm --filter @sots/desktop typecheck
node scripts/verify-desktop-phase2.mjs
```

The acceptance verifier proves:

- prompt injection was isolated;
- raw document bytes were not uploaded;
- processing produced a version and citations;
- asynchronous intent generation completed;
- graph truth did not change before acceptance;
- explicit acceptance produced an immutable graph version;
- a browser observation reconciled against that version; and
- the canonical run report included intent provenance and reconciliation coverage.

Most recent verified IDs:

```text
documentVersionId: 0793326e-50e6-4ec6-b07d-ac825927f544
draftId:           8a8d5dc8-3f7b-4806-9536-44bf99ff159e
graphVersionId:    5191abb3-5889-4881-92d8-d990a4595239
runId:             58882a9e-6419-4ec0-aff5-19012022b389
reportId:          qa-report:58882a9e-6419-4ec0-aff5-19012022b389
```

## Rendered desktop verification

- The renderer preview loaded without console errors and correctly explained that native capabilities require Electron.
- The real Electron window loaded an authenticated project without a renderer crash.
- The Intent page rendered its review-gated empty state and disabled generation when no processed source was selected.
- The Sources page rendered supported formats and the local-extraction/raw-source privacy notice.

The Phase 1 signed-installer and updater gates remain intentionally deferred; they are not claimed by this Phase 2 acceptance record.
