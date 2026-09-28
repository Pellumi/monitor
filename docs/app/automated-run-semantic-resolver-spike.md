# Automated Run — optional local semantic resolver (Wave 9 spike)

Status: **interface and gate built; no runtime chosen; nothing depends on it.** The spike is explicitly not
required to ship Automated Run, and Automated Run ships without it.

## What exists

`packages/automation-engine/src/ambiguity.ts` defines the seam:

* `AmbiguityResolver` — `{ id, local: true, resolve(situation) }`. The default, `NO_AMBIGUITY_RESOLVER`, returns
  nothing. With no resolver configured the executor never calls in and behaves exactly as it did before.
* Two situations a resolver can be asked about, and only these two, because they are the two things the engine
  refuses to guess: **which of several equally good controls** to act on, and **which of several equally good
  states** the page is.
* `verifyControlProposal` / `verifyStateProposal` — the part that makes a suggestion usable.

`ambiguity-eval.ts` is the gate a candidate resolver has to pass, and is the measurable half of this spike.

## The properties that are enforced, not hoped for

1. **A resolver chooses from the deterministic candidates only.** It cannot introduce a control or a state; a
   choice outside the tied set is `NOT_A_CANDIDATE` and nothing is done.
2. **A suggestion is verified against the code-derived contract on two independent counts** before it is acted on:
   * *destination agreement* — it must lead where the Flow says this step leads (and, for a link, to a route of that
     state); for a state suggestion, a permitted route to the target must exist from it;
   * *code-mapping agreement* — it must be the kind of control, carrying the kind of label (or handler name, or
     link target), that the code handling the step describes; for a state, one of its routes must be the current page.
3. **A mutating step is never left to a coin toss.** If the code cannot tell the tied candidates apart, the
   resolver's preference is honoured only for steps that cannot change server state (`READ`,
   `CLIENT_STATE_MUTATION`). A `SERVER_MUTATION` or worse stops, as it would with no resolver.
4. **A resolver-assisted state is never rated above `MEDIUM`.** A suggestion is not the same strength of
   evidence as a match.
5. **A resolver cannot end a run that did not need it.** It is consulted only after the engine has failed to
   decide. A throw, a timeout (5 s) or a malformed answer is the same as no answer. The same ambiguity is not put to
   it twice on retries.
6. **Every assisted decision is on the record as one:** `resolvedBy { resolver, rationale, agreement }` on the
   action or state event; a refused suggestion is a `QA_AUTOMATION_ACTION_BLOCKED` with
   `RESOLVER_PROPOSAL_REJECTED` (or `resolverRejected` on the state event) and the verifier's reason. The report
   can therefore say plainly which choices a model made.
7. **What a resolver sees is page metadata only:** for each candidate, its role, accessible name, label, href and
   test id. No source code, no typed values, no credentials, no screenshots.

## The gate

`scoreControlResolver` runs a resolver over hand-labelled ties through the exact path the executor uses (ask, then
verify), and `passesShippingGate` decides:

* **Any wrong suggestion that passes verification fails the gate outright.** This is what would click the wrong
  control. It is also how holes in the verifier would show up.
* It must settle at least 60% of the ties that have a right answer (otherwise it is complexity for nothing).
* Its slowest answer must be within 2 s (a tie-break that takes longer than the run it saves is not one).
* Abstaining is free. A resolver that never answers passes safety and fails usefulness.

The labelled set is the real work of the spike: ties collected from actual runs (the `CONTROL_AMBIGUOUS` and
`STATE_RECOGNITION_AMBIGUOUS` stops are already recorded with their candidates), labelled by a person with the right
answer or "none of these".

## Open: which local runtime, and how "local" is enforced

Nothing here picks one. What a candidate has to demonstrate before it is worth wiring up:

| Question | Why it matters |
|---|---|
| Runs fully offline, with no model download at run time | An Automated Run works with model providers disabled; a resolver may not be the reason it stops working. |
| **No network egress, demonstrated** | Node's permission model does not restrict the network on the versions in use, so `local: true` is a statement of intent, not a guarantee. The candidate must run somewhere egress can be shown to be blocked (a child process with no route out, checked with a capture), or the spike does not proceed. |
| Footprint (disk, memory, cold start) on a developer laptop | The desktop is a developer tool, not a server. |
| Passes the gate above on real ties | The only thing that decides whether it is worth having. |
| Deterministic enough to reproduce a decision | A report months later must be able to say what was chosen and why; a temperature-0 fixed seed and a recorded rationale are the minimum. |

Kinds of runtime to compare (none is preferred): a small instruction-tuned model behind an embedded inference
library; an embedding-similarity ranker over label text with no generation at all (likely enough for most ties and
much easier to make deterministic); a rules-only "second opinion" using the same evidence differently.

The embedding-ranker option deserves to be tried first. The ties the engine cannot break are mostly "two buttons
with the same visible text", and what separates them is usually context (the row, the heading above it) that the
resolver would need to be handed. That is a change to what a `CandidateView` carries, and would be made with the
gate, not before it.

## Decision rule

Ship a resolver only if it passes the gate on ties from real runs *and* the egress question has a demonstrated
answer. Until then the correct behaviour on an ambiguous read is the current one: stop, say why, and let the
report describe it as evidence rather than as a verdict.
