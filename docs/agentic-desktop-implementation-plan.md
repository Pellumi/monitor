# Tellann Agentic Desktop Implementation Plan

This is the executable companion to `agentic-desktop-feasibility-study.md`.

## Locked delivery order

1. Hardened Windows Electron shell, device-aware cloud contracts, local project scan, and guided Playwright run.
2. QA-run persistence, browser artifacts, web companion history, and report correlation.
3. Local document extraction and evidence-backed intent drafts.
4. Task-scoped JavaScript/TypeScript instrumentation adapters and local relay.
5. Python SDK and Django, Flask, and FastAPI adapters.
6. PHP, .NET, Java, and enterprise desktop governance.

## Product boundaries

- The existing cloud platform remains authoritative for identity, tenants, applications, entitlements, graph truth, reconciliation, reports, storage, and billing.
- Desktop owns local files, processes, browser control, redaction, and permission enforcement.
- Raw source remains local by default.
- Production environments are observation-only.
- Product remediation is outside scope; Tellann may modify only approved instrumentation files.
- Existing web onboarding and SDK paths remain available until desktop adoption is proven.

## Phase acceptance

- Phase 1 is complete when a Free user can open a project, run a guided browser session without installing an SDK, and receive a correlated QA-run record.
- Phase 2 is complete when a Local user can approve a document-derived graph with evidence citations and reconcile it with a run.
- Phase 3 is complete when a Solo user can approve, validate, and roll back idempotent React/Next/Node instrumentation without losing unrelated edits.
- Later adapters must pass protocol, framework-version, dirty-worktree, scope, rollback, and security gates before release.

See the feasibility study and repository issue tracker for the complete security, testing, rollout, and observability requirements.
