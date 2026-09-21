I'll start by mapping the repo structure and finding the relevant subsystems.

There's already a `flow_mapping_v2` migration. Let me examine the core implementation files.

I've traced the full pipeline. Here's what I found.

## Verification basis

I read the retrieval engine, AI resolver, API routes, contracts, Prisma migration, adapter, and desktop main/renderer, and ran `pnpm --filter @tellann/project-intelligence test` (39/39 pass, including 5 flow-mapping tests). Everything below is grounded in the code, not inferred from the doc.

## Headline

**Sections 1–4 of the plan are ~75% built. Section 5 is ~0% built — and that's what makes the whole thing look unfinished.** The retrieval engine, the grounded AI resolver, the v2 contracts, the migration, the API routes, and the adapter's resolved-mapping consumption all exist and are wired. What does not exist is the desktop UI that lets a user resolve an ambiguous checkpoint — and because automated mode is hard-gated on *every* checkpoint being `RESOLVED`, a single `AMBIGUOUS` result permanently blocks the feature with no user-facing way out.

There are also three concrete breaks that kill the plan's own headline acceptance case (`LOGIN PAGE` → a React component) before it reaches the UI.

---

## Blocking gaps

### 1. The staged mapping review UI does not exist (§5)

[FlowReviewPanel](apps/desktop/src/renderer/pages.tsx:6462) is still the v1 panel: it renders `missingStates` / `incompleteTransitions` / `edgeCases` / `uncoveredTerminalOutcomes`, an `X/N mapped` metric row, and the literal string `"No confident file mapping was found."` — the exact message the plan says to eliminate. No freshness, no progress, no status grouping, no candidate picker, no excerpt display, no "Show me where".

`confirmFlowMapping` is plumbed end to end — [desktop-context.tsx:646](apps/desktop/src/renderer/desktop-context.tsx:646) → [preload.ts:262](apps/desktop/src/preload/preload.ts:262) → [main.ts:1695](apps/desktop/src/main/main.ts:1695) → [cloud-client.ts:991](apps/desktop/src/main/cloud-client.ts:991) → [route :340](services/onboarding-api/src/flow-lifecycle-routes.ts:340) — and has **zero callers in the renderer**. Combined with the `AUTOMATED` guard at [flow-lifecycle-routes.ts:291](services/onboarding-api/src/flow-lifecycle-routes.ts:291) (`unresolvedCount > 0` → 409), ambiguity is a dead end.

**Fix:** rewrite the panel against `report.progress`, `report.analysis`, `report.ai`, and `manifest.checkpoints[].mapping`. Group by STATE/TRANSITION × status; for `AMBIGUOUS`, render `mapping.alternatives` (file, symbol, lines, confidence, rationale) with a Confirm button calling the existing bridge; gate the mode-choice card on `progress.status === 'READY'` and show the remaining count; wire "Show me where" to the existing `IPC.openPath`.

### 2. `COMPONENT_MOUNT` is unimplemented — the plan's lead case dies at proposal

Contracts allow it ([index.ts:821](packages/desktop-contracts/src/index.ts:821)), retrieval makes it the *first* choice for `ui_route` ([flow-mapping.ts:275](packages/project-intelligence/src/flow-mapping.ts:275)), the AI resolver accepts it ([ai/flow-mapping.ts:38](packages/ai/src/flow-mapping.ts:38)). The adapter's own enum at [instrumentation-adapters/src/index.ts:92](packages/instrumentation-adapters/src/index.ts:92) omits it, `applySemanticCheckpoint` has no branch for it, and [index.test.ts:355](packages/instrumentation-adapters/src/index.test.ts:355) *asserts it is rejected*. So a login page retrieves fine, resolves fine, then throws `UNSUPPORTED_FLOW_CHECKPOINT_PLACEMENT`.

**Fix:** add it to the adapter enum (better: import the contracts enum rather than redeclaring); implement the deduplicated `useEffect(() => {…}, [])` transform with React-import insertion and marker-presence skip; validate the symbol is a component in `validateResolvedFlowMapping`; convert that test to a positive react-vite / Next App Router / Next Pages Router fixture.

### 3. UI-route candidates have `symbol: null`, which the adapter requires

[validateResolvedFlowMapping:771](packages/instrumentation-adapters/src/index.ts:771) throws `FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED` without a symbol, and `applySemanticCheckpoint` throws `INVALID_SEMANTIC_CHECKPOINT_OPERATION`. But `sourceLocation()` ([flow-mapping.ts:287](packages/project-intelligence/src/flow-mapping.ts:287)) only synthesizes a symbol for `function | method | class | ui_action | endpoint` — `ui_route` gets `null` unless evidence happens to carry one. Every route/page state is therefore systematically unusable for automated mode, independently of gap 2.

**Fix:** have the analyzer emit the component/default-export name for `ui_route` entities, or add a default-export resolution path in the adapter when `symbol` is null.

### 4. Retrieval is fed a degraded flow document

[flowInputFromInitialization](apps/desktop/src/main/main.ts:1055) builds the retrieval input from `report.stateFindings` / `transitionFindings` — the **v1 keyword-matcher output**, which carries only id/name/role/terminalKind. So `category`, `aliases`, `canonicalBehavior`, transition `condition`, and flow `purpose`/`scopeStatement`/`tags` are all null. `buildFlowMappingQueries` weights `contextTerms` heavily on exactly those fields, and the passing tests feed a full `DeclaredFlowDetail`. Note `item.category` is read at main.ts:1063 but `stateFindings` never emits it — always null.

Real-world ranking will be meaningfully worse than the green test suite implies. `cloud.getDeclaredFlow` already exists ([cloud-client.ts:672](apps/desktop/src/main/cloud-client.ts:672)).

**Fix:** fetch the published `DeclaredFlowDetail` and pass it straight to `retrieveFlowCheckpointCandidates`; keep the findings-derived path only as a fallback.

### 5. Excerpts are never actually read from disk

The plan's "Load bounded excerpts from retained snapshot" step is really "reuse whatever excerpt the analyzer happened to store": [main.ts:1087](apps/desktop/src/main/main.ts:1087) takes `candidate.evidence.find(i => i.excerpt)?.excerpt`. Nothing opens the file at the candidate's line range. Worse, [main.ts:985](apps/desktop/src/main/main.ts:985) returns `false` without prompting when no evidence carries an excerpt — so the user is *silently* dropped to `GRAPH_ONLY` with no dialog and no explanation in the report.

**Fix:** read the bounded line ranges from disk in the main process, redact, and send those. Only skip consent when there is genuinely nothing to send, and record that in `report.limitations`.

---

## Correctness / contract gaps

### 6. The v2 zod schemas are dead code, and current payloads would fail them

`FlowCodeReviewReportSchema` and `FlowInitializationManifestSchema` have **no runtime consumers** outside desktop-contracts' own test. Three producer divergences are live today:

- `FlowStateFindingV2Schema` / `FlowTransitionFindingV2Schema` require `checkpointId`; [`finding()`](services/onboarding-api/src/flow-initialization-analysis.ts:252) spreads the v1 finding and never adds it.
- `FlowMappingCandidateSchema` requires `evidenceIds.min(1)`, `anchor.min(1)`, `anchorHash.min(1)`; [`normalizeAlternative`](services/onboarding-api/src/flow-initialization-analysis.ts:211) defaults `evidenceIds` to `[]` and `anchor` to `''`.
- The adapter's placement enum diverges from the contracts enum (gap 2).

**Fix:** parse at the write boundary in `resolveSubmittedMappings` and the confirm route; fix the three producers; derive the adapter enum from contracts.

### 7. Confirmations are written but never read back

`mappingConfirmations` is persisted ([route :375](services/onboarding-api/src/flow-lifecycle-routes.ts:375)) and has no reader anywhere. `POST /analyze` regenerates the v1 manifest from scratch and the desktop re-submits fresh mappings — every prior confirmation is silently dropped, including ones whose checkpoint and anchor hash are unchanged. §3 requires preservation; §5 requires a warning before replacement.

**Fix:** after enrichment, re-apply stored confirmations whose recomputed `anchorHash` still matches; return a dropped-confirmation count; add the renderer warning.

### 8. The server still treats the v1 keyword matcher as success

[POST /flows/:flowId/initializations:105](services/onboarding-api/src/flow-lifecycle-routes.ts:105) always runs `analyzeFlowInitialization` against `RepositorySnapshot` summaries, persists that v1 report, and returns it — with no check that a current `CodebaseAnalysis` exists. Freshness is enforced *only* in Electron ([currentFlowCodebaseAnalysis](apps/desktop/src/main/main.ts:1030)), so any non-desktop caller gets keyword-matched results presented as a completed review. §1 says that matcher is a legacy-record fallback only.

The idempotency short-circuit at `:129` keys on `repositorySnapshotId` alone, not on flow version + content hash + retrieval version + prompt version as §3 requires.

**Fix:** require analysis identity on the initialize route (or set `mappingStatus: 'WAITING_FOR_ANALYSIS'` and withhold the report until a bundle arrives); widen the idempotency key.

### 9. Automated verification still only checks the two boundaries

[evaluateCodeScanCoverage:456](services/onboarding-api/src/flow-initialization-analysis.ts:456) computes `COMPLETED` from the initial state plus one terminal, for **both** modes. §4 requires automated initialization to verify *every* planned marker with expected flow/checkpoint IDs and to fail on duplicate, misplaced, stale, or mismatched markers with file/line evidence. Today a plan that wrote 12 markers where only 2 landed still reports `COMPLETED`. Duplicates are collapsed into a set and ignored.

**Fix:** pass `mode` in; for `AUTOMATED` require all manifest checkpoint IDs; report duplicates and unknown markers as failures using the file/line already present in `codeEvidence`.

### 10. Monorepo / full-stack flows are rejected outright

`propose()` throws `FLOW_CHECKPOINT_OUTSIDE_FRAMEWORK_PACKAGE` for any checkpoint outside the single detected framework package ([index.ts:930](packages/instrumentation-adapters/src/index.ts:930)). A flow with a React page state and an Express handler transition — the plan's own end-to-end fixture — cannot produce one atomic plan. §Test plan explicitly requires monorepo handling.

**Fix:** validate each checkpoint against the workspace root and the set of detected packages rather than one package, or emit per-adapter plans approved together as a unit.

### 11. Progress is a terminal snapshot, not a pipeline

`FlowAnalysisProgressSchema` defines seven statuses; only two are ever produced — `NEEDS_REVIEW` / `READY`, at the very end ([flow-initialization-analysis.ts:305](services/onboarding-api/src/flow-initialization-analysis.ts:305)). `WAITING_FOR_ANALYSIS`, `RETRIEVING`, `CONTEXTUALIZING`, `RESOLVING`, `FAILED` are never written, there's no `GET …/progress` route, and the renderer shows one static banner. Since `waitForCodebaseAnalysis` can block **10 minutes**, the user sees an unexplained stall.

**Fix:** write `mappingProgress` on `FlowScan` at each stage, add the GET route, render it.

### 12. Manual roadmap contradicts the plan's completion semantics

[buildManualRoadmap](services/onboarding-api/src/flow-initialization-analysis.ts:332) emits file/symbol/lines/confidence/alternatives/placementKind (good) but no `evidenceIds`, and folds rationale into the description string. `alternatives` is typed `z.array(z.unknown())`. The renderer displays none of it. And every intermediate checkpoint is labelled *"Optional — not needed to initialize this flow"* while §Assumptions states automated initialization targets every declared state and transition — manual and automated now disagree about what "done" means.

**Fix:** type `alternatives`, add evidence/rationale as fields, render them, and reconcile required/optional across both modes.

---

## Process gaps

### 13. `FLOW_CODE_MAPPING_V2` does not exist

Zero references outside the doc. No shadow-run comparison, no staged enablement, no kill switch. The desktop unconditionally calls `submitCurrentFlowMappings` at [main.ts:1679](apps/desktop/src/main/main.ts:1679) and `:1693`.

**Fix:** gate those two call sites plus `/mapping-candidates`. Shadow mode = run retrieval, persist `candidateEvidence` + `mappingProgress` on `FlowScan`, leave `codeReviewReport` at v1.

### 14. No metrics at all

None of the nine required counters are emitted; `packages/telemetry` has no flow-mapping instrumentation. The data already exists at four points — retrieval `coverage`, resolver `provenance`, the confirm route, and the adapter throw sites.

### 15. Test coverage is well below the acceptance plan

| Area | Have | Missing |
|---|---|---|
| Retrieval | 5 tests, passing | duplicate state names, frontend/backend ranking, monorepo, renamed files, dynamic routes, partial analyses, unsupported languages |
| AI | 3 vitest tests (grounded accept, hallucination reject, provider fallback) | prompt injection inside excerpts, schema repair, timeout, all-providers-fail → graph-only, consent-denial-sends-nothing |
| Adapter | v2 express fixtures; COMPONENT_MOUNT tested only as a *rejection* | react-vite, Next App + Pages, fastify, nestjs on the v2 path; repeat-propose idempotency for checkpoints; rollback |
| API | **none** — `flow-lifecycle-routes` has no test file and isn't in [package.json:8](services/onboarding-api/package.json:8) | bundle bounds, path traversal, unknown checkpoint, excerpt size, confirm, legacy 1.0 reads, idempotency |
| Desktop | none | the entire review flow |

---

## Suggested order

1. **Gaps 2 + 3** — smallest change that unblocks the plan's own acceptance case end to end.
2. **Gap 1** — the review UI; without it nothing else is reachable by a user.
3. **Gap 4** — pass the real `DeclaredFlowDetail`; cheap, and it's what makes ranking match the tests.
4. **Gaps 6 + 7 + 8** — contract enforcement, confirmation preservation, server-side freshness.
5. **Gaps 9 + 10 + 12** — verification fidelity and multi-package plans.
6. **Gaps 5, 11, 13, 14, 15** — excerpt sourcing, progress, flag, metrics, tests.

One note on scope: gaps 2, 3, and 4 are each a few hours, and together they'd probably move the observed symptom (`0/N` mapped, automated mode never available) more than anything else on this list. I'd resist starting with the UI rewrite.

Want me to write this up as a shareable page, or start on the first cluster?