# Complete Codebase Analysis System

## Summary

Replace the current synchronous regex summary with an asynchronous, versioned Codebase Intelligence Engine. Attaching a workspace will immediately create an immutable source snapshot, upload its sanitized contents, queue a staged analysis, and progressively populate one canonical knowledge graph. The Workspace page will expose hierarchy, dependencies, architecture, functionality, APIs, data, events, external systems, evidence, risks, and change analysis as projections of that graph.

The first launch will deeply support TypeScript/JavaScript repositories, including React, Next.js, Express, NestJS, Prisma, monorepos, tests, and documentation. Runtime/OpenTelemetry evidence and additional language analyzers remain post-launch extensions. All static-analysis, graph, AI, and desktop visualization capabilities ship behind one release gate.

## Implementation Changes

### 1. Snapshot ingestion and job lifecycle

- Preserve the existing user/device-scoped workspace binding, but split attachment from deep analysis:
  1. Select and validate the folder.
  2. Run a fast inventory, Git, manifest, framework, secret, and size pass.
  3. Build a deterministic, content-addressed archive excluding secrets, ignored/generated directories, unsupported binaries, symlinks, and oversized files.
  4. Show explicit full-source cloud-upload consent, archive size, exclusions, retention policy, and repository identity.
  5. Upload the encrypted snapshot through presigned multipart storage.
  6. Create an analysis job and return immediately.
- Identify every snapshot by application, workspace, repository identity, branch, exact commit, dirty-state/content hash, scanner version, analyzer versions, and timestamp. Never treat a branch name alone as an analyzed version.
- Introduce `QUEUED → INGESTING → PARSING → LINKING → GRAPHING → DISCOVERING_FEATURES → ANALYZING_ARCHITECTURE → SUMMARIZING → COMPLETED | PARTIAL | FAILED | CANCELLED`.
- Persist per-stage progress, timestamps, retry count, warnings, file/entity/edge totals, safe failure details, and heartbeat/lease data. Make stages idempotent and resumable.
- Automatically cancel or supersede stale queued work when the same workspace is rescanned, while retaining completed snapshots for comparisons.
- Keep the existing lightweight `RepositorySnapshotSummary` as a compatibility/attachment summary; reference the new immutable codebase snapshot and latest analysis rather than expanding it into the complete graph payload.

### 2. Canonical storage and service architecture

- Add PostgreSQL models for `CodebaseSnapshot`, `SourceArchive`, `AnalysisJob`, `AnalysisStageRun`, `AnalyzerRun`, `AnalysisWarning`, and `AnalysisProjection`. Relate them to `Application`, `ProjectWorkspace`, and `RepositorySnapshot`.
- Store encrypted source archives in the existing S3-compatible storage layer. Record checksums, byte/file counts, encryption/version metadata, retention status, and organization ownership in the storage ledger; never expose object keys directly to clients.
- Add Neo4j to local/deployed infrastructure behind a `GraphStore` interface. Namespace every node and relationship by organization, application, snapshot, and graph version.
- Keep raw source outside Neo4j. Graph evidence references snapshot ID, relative path, symbol, line/column range, content hash, analyzer, confidence, and optional approved excerpt.
- Create a dedicated code-intelligence worker bounded context instead of reusing the runtime `graph-engine`. Use the existing Redis/BullMQ worker infrastructure for durable stage execution, concurrency limits, retry/backoff, cancellation, and operations visibility.
- Add reconciliation/cleanup workers for abandoned uploads, expired leases, orphan graph versions, retention deletion, and PostgreSQL/Neo4j consistency checks.
- Enforce tenant authorization at the API and graph-query layers. Encrypt archives at rest, use short-lived signed access, audit source access, redact secrets before upload, and support organization-configurable retention and permanent deletion.

### 3. Deterministic analysis pipeline

- Refactor `@tellann/project-intelligence` into a coordinator plus independently versioned analyzers:
  - repository inventory and hierarchy;
  - Git and incremental-diff analysis;
  - language and package/workspace boundary detection;
  - language analyzers;
  - framework adapters;
  - semantic linker;
  - feature/domain/architecture engines;
  - projection builders.
- Define a canonical IR containing repositories, applications, services, packages, directories, files, modules, symbols, classes, interfaces, functions, methods, tests, UI routes/actions, endpoints, database models/tables, jobs, events, queues, external systems, domains, features, and workflows.
- Define canonical relationships including `CONTAINS`, `DEFINES`, `IMPORTS`, `EXPORTS`, `CALLS`, `USES`, `IMPLEMENTS`, `EXTENDS`, `ROUTES_TO`, `READS`, `WRITES`, `PUBLISHES`, `SUBSCRIBES_TO`, `HANDLED_BY`, `CALLS_EXTERNAL`, `TESTS`, `CONFIGURES`, `BELONGS_TO_DOMAIN`, and `IMPLEMENTS_FEATURE`.
- Require every entity, relationship, domain assignment, feature, and explanation to carry confidence, provenance, and evidence. Treat unresolved/dynamic behavior as uncertainty rather than inventing an edge.
- Implement TypeScript/JavaScript syntax extraction with Tree-sitter and precise semantic resolution with the TypeScript compiler APIs. Resolve aliases, workspaces, re-exports, definitions, references, inheritance, calls, and package/module ownership.
- Add adapters for React, Next.js, Express, NestJS, Prisma, REST/OpenAPI, GraphQL, common queue/event libraries, cron/background jobs, frontend API clients, environment-backed integrations, and external HTTP/SDK services.
- Extract test names, subjects, fixtures, assertions, documentation, OpenAPI/GraphQL schemas, ADRs, JSDoc, and docstrings as independent evidence sources. Documentation may corroborate or conflict with code but never override it.
- Detect frontend-to-backend flows: UI route → component/action → API client → endpoint → controller → service → database/event/external side effect.
- Generate feature candidates through bounded forward traversal from entrypoints and reverse traversal from side effects. Materialize feature triggers, workflow steps, reads/writes, authorization, events, downstream effects, source files, domain, confidence, and evidence.
- Infer domains using paths, names, shared models/routes, dependency density, and graph clustering. Calculate cycles, strongly connected components, coupling, centrality, hotspots, service boundaries, unreachable/orphan nodes, and blast radius.
- Use AI only after deterministic analysis. Send bounded evidence bundles, demand schema-valid structured output, prohibit unsupported claims, record model/prompt versions, and retain deterministic fallback descriptions if the provider is unavailable.
- Implement incremental rescans from Git diff and file hashes: reuse unchanged analyzer output, delete obsolete nodes, reparse changed files, relink affected references/reverse dependencies, and recompute only impacted features, domains, metrics, and projections.

### 4. APIs and shared contracts

- Add typed desktop/cloud contracts for:
  - source-upload initiation, part completion, and cancellation;
  - analysis creation, cancellation, retry, status, progress, warnings, and stage history;
  - analysis overview and snapshot history;
  - hierarchy children with lazy pagination;
  - graph projection queries with view, granularity, filters, search, depth, and node limits;
  - entity details, evidence, callers/callees, dependencies, and source preview;
  - features, domains, endpoints, data stores, events, external systems, and findings;
  - shortest path, dependency path, blast radius, and commit-to-commit comparison;
  - evidence-grounded repository questions with streamed answers and citations.
- Route these endpoints through the API gateway with existing JWT/application-ownership checks, pagination, query limits, tenant scoping, and entitlement/rate-limit enforcement.
- Add Electron IPC for archive construction/upload, starting/cancelling/rescanning analysis, subscribing to progress, and opening evidence locally. Validate all inputs in shared Zod schemas and keep absolute paths out of cloud payloads.
- Link codebase features/domains to existing published Flow versions using explicit references and evidence; do not merge the physical code graph with the declared/runtime behavior graph. Preserve existing Flow initialization, rescan, drift, and QA compatibility.

### 5. Desktop analysis experience

- Break the current `WorkspacePage` into focused routes/components and replace inline styling with reusable analysis UI styles.
- Show attachment/upload/analysis as a durable progress experience with current stage, percent, elapsed time, discovered totals, warnings, cancellation, retry, and partial-result navigation. Restoring the desktop must restore the active job rather than restarting it.
- Provide these views:
  - **Overview:** snapshot identity, languages, frameworks, applications/services/packages, analysis coverage, confidence distribution, risks, and key findings.
  - **Hierarchy:** virtualized lazy tree from repository to symbols.
  - **Architecture:** progressively disclosed domains, services, data stores, queues, and external systems.
  - **Dependencies:** selectable package/module/file/class/function resolution with direction and relationship filters.
  - **Features:** complete functionality catalogue with trigger, end-to-end workflow, side effects, authorization, evidence, and source links.
  - **Graph Explorer:** bounded interactive graph with search, filters, clustering, expand/collapse, minimap, fit/reset, and details drawer.
  - **APIs & UI:** HTTP/GraphQL/webhook/UI entrypoints and frontend-to-backend paths.
  - **Data & Events:** database reads/writes, models, queues, publishers, consumers, jobs, and downstream effects.
  - **External Systems:** SDK/config/call evidence and impacted features.
  - **Risks:** cycles, coupling, unresolved references, stale-doc conflicts, dynamic-code gaps, and blast-radius queries.
  - **Changes:** entity, dependency, feature, domain, and architecture differences between snapshots.
  - **Ask:** evidence-grounded GraphRAG answers with clickable citations and explicit uncertainty.
- Use progressive disclosure, lazy graph queries, result caps, virtualization, memoized expensive components, deferred search/filter rendering, and dynamically loaded visualization bundles so large repositories do not freeze Electron.
- Allow every node, edge, feature step, finding, and AI statement to open an evidence drawer and then the exact local file/line when the matching workspace is available.
- Clearly distinguish completed, partial, stale, failed, unsupported-language, excluded-file, and provider-unavailable states. Never label a workspace fully analyzed merely because the fast inventory completed.

## Test Plan

- Unit-test path normalization, ignore/redaction rules, secret detection, archive determinism, repository identity, dirty snapshots, analyzer versioning, confidence aggregation, IR validation, link resolution, bounded traversal, feature construction, domain clustering, and incremental invalidation.
- Build fixture repositories covering single-package and pnpm-monorepo layouts; React/Next frontend actions; Express/Nest endpoints; Prisma reads/writes; REST/GraphQL; jobs, events, queues, external APIs; aliases/re-exports; cycles; dynamic imports; generated files; tests; conflicting documentation; and partial/unresolvable code.
- Contract-test desktop IPC, gateway APIs, upload resumption, job transitions, cancellation/retry, tenant isolation, pagination, source authorization, graph query bounds, Neo4j/PostgreSQL reconciliation, and backward compatibility with existing snapshots.
- Verify deterministic results by analyzing the same commit twice and comparing normalized IR/graph hashes; verify incremental output against a clean full scan after add/modify/delete/rename changes.
- Test worker crashes and lease recovery, duplicate delivery, Neo4j/storage/provider outages, malformed archives, quota exhaustion, stale analyzer versions, deleted snapshots, AI schema failures, and safe partial completion.
- Renderer-test every view, empty/loading/partial/error states, evidence navigation, filters, keyboard accessibility, large virtualized trees, capped graphs, restored progress after restart, and rescans.
- Run end-to-end acceptance on this repository: attach → consent/upload → observe every stage → inspect all maps and feature evidence → query a known workflow → run blast radius → commit a fixture change → rescan → confirm the expected change report.
- Release only when Prisma migration validation, package builds, analyzer fixtures, worker integration tests, gateway contracts, desktop typechecks/build, native Electron interaction tests, performance targets, security review, and a deployed Neo4j/storage/worker smoke test all pass.

## Assumptions and Release Gates

- Deep launch support is TypeScript/JavaScript; unsupported languages still receive repository hierarchy, language, manifest, and package-boundary results with an explicit coverage warning.
- Full sanitized source snapshots are cloud-stored with explicit user consent, encryption, tenant isolation, audited access, configurable retention, and deletion support.
- Neo4j is the canonical relationship store; PostgreSQL remains authoritative for tenancy, jobs, versions, metadata, and lifecycle state.
- Analysis begins automatically after attachment and continues asynchronously with partial results.
- Static code, test-file, and documentation evidence are included at launch; executing tests and OpenTelemetry/runtime fusion are deferred without blocking the static system.
- The product ships as one feature-gated launch. Internal milestones may be implemented sequentially, but the gate stays closed until ingestion, deterministic analysis, graph construction, functionality/architecture discovery, AI explanations, all desktop views, security, and operational readiness are complete.
- Existing local workspace identity, repository binding, Flow, initialization, rescan, drift, and QA records remain compatible and are migrated rather than discarded.
