import { askResolver, controlSituation, verifyControlProposal } from './ambiguity';
import type { AmbiguityResolver } from './ambiguity';
import type { ControlCandidate, ExecutableState, ExecutableTransition } from './types';

/**
 * The gate a local resolver has to pass before anyone considers shipping it.
 *
 * This is the measurable half of the Wave 9 spike. Which local runtime to try is an open question
 * (see docs/app/automated-run-semantic-resolver-spike.md); *whether* one is good enough is not: it is
 * scored here, against hand-labelled ties, through exactly the path the executor uses (ask, then
 * verify), so what is measured is what would happen in a run.
 *
 * The bar is asymmetric on purpose. A resolver that abstains costs nothing: the run stops as it does
 * today. One that is *wrongly accepted* — chosen by the resolver and passed by the verifier while being
 * the wrong control — would click the wrong thing, so a single such case fails the gate outright.
 * The verifier is the safety net, and this is where its holes would show up.
 */

export interface LabelledControlCase {
  name: string;
  transition: ExecutableTransition;
  destination: ExecutableState | undefined;
  /** The tied candidates the ranking could not separate. */
  candidates: ControlCandidate[];
  /** The candidate that is actually right; `null` when none of them is (the right answer is to stop). */
  correctRef: string | null;
}

export interface ResolverScore {
  total: number;
  /** Cases where a right answer existed. */
  answerable: number;
  abstained: number;
  /** Proposed, and the verifier refused it. */
  rejected: number;
  acceptedCorrect: number;
  /** Accepted and wrong: what must never happen. */
  acceptedWrong: number;
  /** How long the resolver took to answer, per case (ms), for the latency budget. */
  latencyMs: number[];
}

export async function scoreControlResolver(
  resolver: AmbiguityResolver,
  cases: LabelledControlCase[],
  options: { timeoutMs?: number; now?: () => number } = {},
): Promise<ResolverScore> {
  const now = options.now ?? (() => Date.now());
  const score: ResolverScore = { total: cases.length, answerable: 0, abstained: 0, rejected: 0, acceptedCorrect: 0, acceptedWrong: 0, latencyMs: [] };
  for (const item of cases) {
    if (item.correctRef !== null) score.answerable += 1;
    const started = now();
    const proposal = await askResolver(resolver, controlSituation(item.transition, item.candidates), options.timeoutMs);
    score.latencyMs.push(now() - started);
    if (!proposal) { score.abstained += 1; continue; }
    const verdict = verifyControlProposal({ transition: item.transition, destination: item.destination, candidates: item.candidates, proposal });
    if (!verdict.accepted) { score.rejected += 1; continue; }
    if (verdict.choice === item.correctRef) score.acceptedCorrect += 1;
    else score.acceptedWrong += 1;
  }
  return score;
}

export interface GateOptions {
  /** Share of answerable cases the resolver must settle correctly to be worth having. */
  minCoverage?: number;
  /** Slowest acceptable answer (ms): a tie-break that takes longer than the run it saves is not one. */
  maxLatencyMs?: number;
}

export function passesShippingGate(score: ResolverScore, options: GateOptions = {}): { pass: boolean; reasons: string[] } {
  const minCoverage = options.minCoverage ?? 0.6;
  const maxLatencyMs = options.maxLatencyMs ?? 2_000;
  const reasons: string[] = [];
  if (score.total === 0) reasons.push('There are no labelled cases, so nothing was measured.');
  if (score.acceptedWrong > 0) reasons.push(`${score.acceptedWrong} wrong suggestion(s) passed verification. Any is disqualifying.`);
  const coverage = score.answerable === 0 ? 0 : score.acceptedCorrect / score.answerable;
  if (score.total > 0 && coverage < minCoverage) reasons.push(`It settled ${Math.round(coverage * 100)}% of answerable ties; at least ${Math.round(minCoverage * 100)}% is needed to be worth the complexity.`);
  const slowest = Math.max(0, ...score.latencyMs);
  if (slowest > maxLatencyMs) reasons.push(`Its slowest answer took ${slowest} ms; the limit is ${maxLatencyMs} ms.`);
  return { pass: reasons.length === 0, reasons };
}
