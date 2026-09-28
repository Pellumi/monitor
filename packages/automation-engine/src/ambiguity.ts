import { normalizeStateKey, normalizeText, pathOnly, routeMatches } from './keys';
import { planFlowPath } from './flow-path';
import type { PolicyOptions } from './policy';
import { roleFits } from './ranking';
import type {
  ActionClass,
  ControlCandidate,
  EnvironmentKind,
  ExecutableContract,
  ExecutableState,
  ExecutableTransition,
  Recognition,
} from './types';

/**
 * A place for a local model to break a tie — and nothing more.
 *
 * The engine is deterministic on purpose. When it cannot decide (two controls match a transition
 * equally well, two states fit the page equally well) it stops rather than guess, and that is the
 * right default. This module makes it *possible* to ask something smarter for a suggestion without
 * giving up the properties that make the engine trustworthy:
 *
 *  - A resolver only ever chooses **from the candidates the deterministic engine already produced**.
 *    It cannot introduce an element or a state, so it cannot widen what the run is willing to touch.
 *  - Its suggestion is **verified, not trusted**. It is accepted only if the code-derived contract
 *    agrees with it on two independent counts: the *destination* (the choice leads where the Flow says
 *    this step leads) and the *code mapping* (the choice is the kind of control, carrying the kind of
 *    label, that the handler in the code describes). A suggestion that fails either is discarded and
 *    the run stops exactly as it would have with no resolver at all.
 *  - It is **local and optional**. There is no default resolver (`NO_AMBIGUITY_RESOLVER` returns
 *    nothing), the run works with model providers disabled, and a resolver is handed page-level
 *    metadata about the candidates — never source code, typed values or credentials — and is declared
 *    `local`: it must not send anything off the machine.
 *  - It is bounded: a timeout, and a malformed or throwing resolver is the same as no resolver.
 *  - A mutating step is never left to a coin toss: when the verifier cannot tell the candidates apart
 *    by the code, a resolver's preference is honoured only for steps that cannot change server state.
 *
 * Nothing here ships behaviour by itself: with no resolver configured the executor never calls in.
 */

/** What a resolver is told about one candidate. Page metadata only. */
export interface CandidateView {
  /** Opaque handle; what a proposal must return to choose this candidate. */
  ref: string;
  role: string | null;
  name: string | null;
  label: string | null;
  href: string | null;
  testId: string | null;
}

export type AmbiguitySituation =
  | {
    kind: 'CONTROL';
    transitionId: string;
    action: string | null;
    /** The state the transition leads to, per the Flow. */
    expectedState: string;
    candidates: CandidateView[];
  }
  | {
    kind: 'STATE';
    path: string;
    title: string | null;
    headings: string[];
    candidates: Array<{ stateKey: string; score: number }>;
  };

export interface AmbiguityProposal {
  /** A candidate's `ref` (CONTROL) or `stateKey` (STATE). */
  choice: string;
  /** CONTROL only: the state the resolver believes the choice leads to. Must agree with the Flow. */
  destination?: string;
  /** Why, for the audit trail. Kept short; it is recorded, never acted on. */
  rationale: string;
}

export interface AmbiguityResolver {
  readonly id: string;
  /**
   * A resolver must run entirely on this machine. The literal type is a statement of intent that is
   * checked in review and by the desktop when it constructs one, not something a type can enforce.
   */
  readonly local: true;
  resolve(situation: AmbiguitySituation): Promise<AmbiguityProposal | null>;
}

/** The default: no opinion, so the engine behaves exactly as it did before resolvers existed. */
export const NO_AMBIGUITY_RESOLVER: AmbiguityResolver = {
  id: 'none',
  local: true,
  async resolve() {
    return null;
  },
};

export const RESOLVER_TIMEOUT_MS = 5_000;
const MAX_RATIONALE = 500;

/** Ask a resolver, treating a throw, a timeout or a malformed answer as "no opinion". */
export async function askResolver(
  resolver: AmbiguityResolver,
  situation: AmbiguitySituation,
  timeoutMs = RESOLVER_TIMEOUT_MS,
): Promise<AmbiguityProposal | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answer = await Promise.race([
      resolver.resolve(situation),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (!answer || typeof answer.choice !== 'string' || answer.choice.length === 0) return null;
    return {
      choice: answer.choice,
      ...(typeof answer.destination === 'string' ? { destination: answer.destination } : {}),
      rationale: typeof answer.rationale === 'string' ? answer.rationale.slice(0, MAX_RATIONALE) : '',
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type RejectionReason =
  | 'NOT_A_CANDIDATE'
  | 'DESTINATION_DISAGREES'
  | 'CODE_MAPPING_DISAGREES'
  | 'NOT_DISCRIMINATING'
  | 'NO_ROUTE_TO_TARGET'
  | 'STATE_ROUTE_DISAGREES';

export type Verification =
  | { accepted: true; choice: string; agreement: string[] }
  | { accepted: false; reason: RejectionReason; detail: string };

const reject = (reason: RejectionReason, detail: string): Verification => ({ accepted: false, reason, detail });

const NOISE_TOKENS = new Set(['handle', 'on', 'click', 'button', 'btn', 'the', 'a', 'an', 'to', 'of']);

/** `handleSaveExam` -> ['save', 'exam']; 'Save exam' -> ['save', 'exam']. */
export function tokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
}

interface Agreement {
  kindFits: boolean;
  labels: boolean;
  symbol: boolean;
  href: boolean;
  /** Higher is better; used only to tell candidates apart. */
  score: number;
}

/** How well one element agrees with what the code says the transition's control is. */
function codeAgreement(transition: ExecutableTransition, candidate: ControlCandidate | { element: ControlCandidate['element'] }): Agreement {
  const { element } = candidate;
  const control = transition.control;
  const kindFits = control ? roleFits(control, element) : false;
  const elementText = [element.name, element.label, element.testId, element.domId, element.actionAnchor];
  const elementTokens = new Set(elementText.flatMap(tokens));

  const wantedLabels = (control?.labels ?? []).map(normalizeText).filter(Boolean);
  const labels = wantedLabels.some((wanted) => wanted === normalizeText(element.name) || wanted === normalizeText(element.label))
    || (control?.labels ?? []).some((label) => {
      const wanted = tokens(label);
      return wanted.length > 0 && wanted.every((token) => elementTokens.has(token));
    });
  const symbolTokens = transition.codeRefs.flatMap((ref) => tokens(ref.symbol));
  const symbol = symbolTokens.length > 0 && symbolTokens.some((token) => elementTokens.has(token));
  const href = Boolean(control?.href && element.href && (routeMatches(control.href, pathOnly(element.href)) || pathOnly(control.href) === pathOnly(element.href)));
  return { kindFits, labels, symbol, href, score: (kindFits ? 1 : 0) + (labels ? 2 : 0) + (symbol ? 1 : 0) + (href ? 1 : 0) };
}

const NON_MUTATING = new Set<ActionClass>(['READ', 'CLIENT_STATE_MUTATION']);

export interface ControlVerificationInput {
  transition: ExecutableTransition;
  /** The state the transition leads to, when the contract has it. */
  destination: ExecutableState | undefined;
  /** The tied candidates the deterministic ranking could not separate. */
  candidates: ControlCandidate[];
  proposal: AmbiguityProposal;
}

export function verifyControlProposal(input: ControlVerificationInput): Verification {
  const { transition, destination, candidates, proposal } = input;
  const chosen = candidates.find((candidate) => candidate.element.ref === proposal.choice);
  if (!chosen) return reject('NOT_A_CANDIDATE', 'The suggestion is not one of the controls the engine found. A resolver cannot introduce a control.');

  // Destination agreement: what the resolver believes this leads to must be what the Flow says.
  if (!proposal.destination || normalizeStateKey(proposal.destination) !== transition.to) {
    return reject('DESTINATION_DISAGREES', `The suggestion does not lead to ${transition.to}, where the Flow says this step goes.`);
  }
  const { element } = chosen;
  if (element.href && destination && destination.routePatterns.length > 0) {
    const path = pathOnly(element.href);
    if (!destination.routePatterns.some((pattern) => routeMatches(pattern, path))) {
      return reject('DESTINATION_DISAGREES', `The control links to ${path}, which is not a route of ${destination.key}.`);
    }
  }

  // Code-mapping agreement: it must be the kind of control, carrying the kind of label, the code describes.
  const agreement = codeAgreement(transition, chosen);
  if (!agreement.kindFits || !(agreement.labels || agreement.symbol || agreement.href)) {
    return reject('CODE_MAPPING_DISAGREES', 'Nothing in the code that handles this step describes the suggested control.');
  }

  // A tie the code cannot break is a coin toss, and only a step that cannot change server state may be left to one.
  const rivals = candidates.filter((candidate) => candidate !== chosen);
  const strongestRival = rivals.reduce((best, candidate) => Math.max(best, codeAgreement(transition, candidate).score), -1);
  if (agreement.score < strongestRival) {
    return reject('CODE_MAPPING_DISAGREES', 'Another candidate agrees with the code better than the suggestion does.');
  }
  if (agreement.score === strongestRival && !NON_MUTATING.has(transition.actionClass)) {
    return reject('NOT_DISCRIMINATING', 'The code cannot tell these controls apart, and this step can change server state, so it will not be settled by a suggestion.');
  }

  const why: string[] = ['destination'];
  if (agreement.labels) why.push('label');
  if (agreement.symbol) why.push('handler name');
  if (agreement.href) why.push('link target');
  return { accepted: true, choice: chosen.element.ref, agreement: why };
}

export interface StateVerificationInput {
  contract: ExecutableContract;
  targetStateKey: string;
  environment: EnvironmentKind;
  policy?: PolicyOptions;
  /** The current path, for checking a proposed state's routes against it. */
  path: string;
  /** The states the deterministic recogniser could not separate. */
  tied: Recognition[];
  proposal: AmbiguityProposal;
}

export function verifyStateProposal(input: StateVerificationInput): Verification {
  const { contract, proposal } = input;
  const chosen = input.tied.find((recognition) => recognition.stateKey === normalizeStateKey(proposal.choice));
  if (!chosen) return reject('NOT_A_CANDIDATE', 'The suggestion is not one of the states the engine found. A resolver cannot introduce a state.');
  const state = contract.states.find((candidate) => candidate.key === chosen.stateKey);
  if (!state) return reject('NOT_A_CANDIDATE', 'The suggested state is not in the Flow.');

  // Code-mapping agreement: a state whose code names its routes must be at one of them.
  if (state.routePatterns.length > 0 && !state.routePatterns.some((pattern) => routeMatches(pattern, pathOnly(input.path)))) {
    return reject('STATE_ROUTE_DISAGREES', `The page is at ${pathOnly(input.path)}, which is not a route of ${state.key}.`);
  }
  // Destination agreement: acting from the suggested state must actually lead toward the target.
  const plan = planFlowPath(contract, state.key, input.targetStateKey, input.environment, input.policy);
  if (!plan.ok) return reject('NO_ROUTE_TO_TARGET', `No permitted route leads from ${state.key} to ${input.targetStateKey}.`);
  return { accepted: true, choice: state.key, agreement: state.routePatterns.length > 0 ? ['route', 'route to target'] : ['route to target'] };
}

/** The candidates to offer for a tied control choice: everything scoring what the best one did. */
export function tiedControls(candidates: ControlCandidate[]): ControlCandidate[] {
  const top = candidates[0]?.score;
  return top === undefined ? [] : candidates.filter((candidate) => candidate.score === top);
}

export function controlSituation(transition: ExecutableTransition, tied: ControlCandidate[]): AmbiguitySituation {
  return {
    kind: 'CONTROL',
    transitionId: transition.id,
    action: transition.action,
    expectedState: transition.to,
    candidates: tied.map(({ element }) => ({ ref: element.ref, role: element.role, name: element.name, label: element.label, href: element.href, testId: element.testId })),
  };
}
