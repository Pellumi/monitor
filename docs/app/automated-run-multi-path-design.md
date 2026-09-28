# Automated Run — multi-path groundwork (Wave 10 design)

Status: **design and spike only.** Nothing described here as "later" is built. A run is pointed at exactly
one terminal state today, and the code refuses anything else rather than quietly running the first.

## What is in place now

The shapes are ready so that multi-path can be turned on without migrating stored runs or reports.

| Where | What changed | Behaviour |
|---|---|---|
| `AutomationConfig` (`packages/desktop-contracts/src/automation.ts`) | Optional `targetTerminalStateKeys[]`, bounded by `AUTOMATION_MAX_TARGETS` (= 1). `automationTargets()` reads either spelling; `automationTargetsConsistent()` requires the list to start with `targetTerminalStateKey`. | A list of more than one is rejected at the schema. |
| Server (`buildAutomationRunState`) | Validates every listed target against the Flow's terminal states and stores **both** spellings on `QARun.automation`. | Same as before for one target. |
| Engine (`packages/automation-engine/src/targets.ts`) | `resolveRunTargets()` runs before anything is touched. `terminalStatesOf()` lists what a run could be pointed at. | More than one target stops the run with `AUTOMATION_ENGINE_ERROR` and no action taken — it is never reported against a target it was not pointed at. |
| `QA_AUTOMATION_PLAN_CREATED` | Carries `targetStateKeys`. | Informational. |

The single constant `AUTOMATION_MAX_TARGETS` is the switch. Raising it is necessary but not sufficient: the executor
still has to learn to loop, and the pieces below have to exist first.

## The question the spike answers

If a run were pointed at *every* way a Flow can end, how many separate runs would that take, and which declared
steps could never be exercised at all?

`packages/automation-engine/src/path-coverage.ts` (deliberately **not** exported from the package index, imported only
by its tests) computes that from the contract alone: a small set of end-to-end paths that together exercise every
transition that can be exercised, plus the transitions that cannot and why (`UNREACHABLE`, `BLOCKED_BY_POLICY`,
`NO_DERIVED_CONTROL`). For the LMS fixture Flow it yields two paths — one ending in the success state, one in the
failure state — and full coverage.

It is a function of the contract. It picks no data, runs nothing, and decides nothing about what a path means.

## Design for shipping it

### 1. A run is a set of independent attempts, not one long run

Each path is an attempt of its own, with its own fresh browser context, its own pre-boundary entry, its own
budget. A failure in path 2 must not contaminate path 3, and a path that fails is *evidence about that path*, the
same as a single run today. Reusing one browser session across paths saves seconds and costs correctness: state left
by one path (a created exam, a logged-in session with the wrong role) changes what the next one sees.

The unit of reporting becomes `PathRunRecord { path, target, stopReason, states[] }`, with the existing
`StateRunRecord[]` inside it. `QARun.automation` gains `paths[]` next to the existing single-target fields, which
stay populated for one-target runs so nothing reading them changes.

### 2. What "covering" means, and what it does not

Covering paths exercise **declared** transitions. That is coverage of what the Flow says, and the report must say
exactly that. It is not coverage of the application: an undeclared branch is invisible to it by construction, and
"every declared transition was exercised" is not "the feature works".

Reconciliation stays the judge. A path that could not be completed is classified the way a single run's gap already
is (`AUTHORIZATION_MISMATCH`, `DATA_PRECONDITION_FAILURE`, `IMPLEMENTATION_MISMATCH`, `DECLARATION_MISMATCH`); the
runner does not conclude that a step is missing.

### 3. Negative paths are a data problem before they are a planning problem

Reaching a declared failure state (`exam_error`, "card declined") usually needs *input that makes the application
refuse*, not a different route. The planner can already find the transition; what it cannot supply is the input.
So negative-path support needs run-data sets with a `purpose` (`VALID` / `INVALID_FOR:<transition id>`), authored by
a person, with generators only for shapes that are safe to invent (an empty required field, an over-long string).
Inventing "a declined card number" is not something the engine should do; it is a fixture the team owns.

Until such data exists, a failure terminal is reported as `NO_DATA_FOR_PATH` (a variant of `TEST_DATA_UNAVAILABLE`),
never silently skipped and never attempted with valid data.

### 4. Mutation budget and cleanup

A single run performs the mutations on its one path. Several paths multiply them. Before shipping:

* a per-run **mutation budget** (default small) that stops further paths, distinct from the step budget;
* paths ordered cheapest and least destructive first, so a budget stop costs the riskiest paths, not the safest;
* no automatic cleanup. Deleting what a run created is itself a destructive action against an environment the run
  does not own; the report lists what was created (from the mutating transitions performed) and leaves removal to the team.

### 5. Ordering and stopping

* Default: run paths in order of `cost` (existing `planFlowPath` cost model), stopping on the first
  `INFRASTRUCTURE` failure (the environment is unhealthy; more paths add noise) but *not* on an `APPLICATION`
  failure (that is the finding).
* The user picks targets from `declaredEndings()`, never free text. "All" means all declared endings the policy allows.

### 6. Entitlement and metering

One run with N paths is N attempts for metering (`ums.txt`). Decide before shipping whether `AUTOMATED_QA_RUNS`
covers the whole set or a per-path quota applies; the config already carries the list needed to count them.

## This needs a scope decision, not just an implementation

`mvp_scope.txt` carves Automated Run out of "Autonomous Testing" precisely because it executes *one* human-declared
Flow toward *one* terminal state the developer selected, and it says the feature "shall not be extended into test
generation, branch exploration or regression suites without a scope change". Running to every declared ending is
branch coverage over declared transitions: still no generated tests and no invented intent, but it is close enough to
"branch exploration" that raising `AUTOMATION_MAX_TARGETS` should be preceded by that scope change being made
deliberately in `mvp_scope.txt` and `developer_demonstration.txt` (DDM-MODE-002), not discovered later. The groundwork
in this document is written to be safe to leave in place until then.

## What must exist before `AUTOMATION_MAX_TARGETS` goes above 1

1. `PathRunRecord` and the `paths[]` shape on `QARun.automation`, with the report section grouped by path.
2. Run-data purposes (item 3) and the `NO_DATA_FOR_PATH` reason.
3. The mutation budget (item 4) and its stop reason.
4. Executor: an outer loop that resets the browser context between paths (an `AutomatedRunManager` concern; the
   inner `runAutomation` stays single-target and unchanged).
5. Acceptance: the LMS fixture with a failing-submit variant proves two paths report independently and that a
   failure in the first does not stop the second.

## Non-goals

* Discovering transitions the Flow does not declare. That is exploration, which is Assisted mode's job.
* Fuzzing. Input generation beyond the safe shapes above.
* Anything that makes the plan depend on a model.
