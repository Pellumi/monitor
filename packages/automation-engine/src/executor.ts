import type { AutomationLimits, AutomationStopReason } from '@tellann/desktop-contracts';
import { DATA_FAILURE_REASONS, performStep, resolveStep } from './act';
import type { DataValue } from './act';
import { askResolver, controlSituation, tiedControls, verifyControlProposal, verifyStateProposal } from './ambiguity';
import type { AmbiguityResolver } from './ambiguity';
import { LoopDetector, RunBudget, stateFingerprint } from './budget';
import { decideCapture } from './capture-policy';
import type { AnomalyReason, CaptureDecision, CaptureInput } from './capture-policy';
import { planFlowPath } from './flow-path';
import { resolveRunTargets } from './targets';
import { evaluateAction, evaluateNavigation } from './policy';
import type { PolicyOptions } from './policy';
import { AMBIGUITY_MARGIN, recognizeAmong } from './recognizer';
import { isEntryStep } from './support';
import { rankControls } from './ranking';
import type {
  ActionClass,
  ActionOutcome,
  ApiCondition,
  AutomationAction,
  EnvironmentKind,
  ExecutableContract,
  ObservedRequest,
  Recognition,
  SemanticSnapshot,
} from './types';

/**
 * The Automated Run loop:  RECOGNISE -> PLAN -> POLICY -> ACT -> SETTLE -> VERIFY -> (replan | next).
 *
 * This is the hot path. It runs entirely on the developer's machine against structured
 * browser state, decides each action deterministically, and never waits on the cloud or a
 * model. Everything it *does not* do is deliberate:
 *
 *  - it never opens the Flow boundary; the application's own SDK markers do (the loop only
 *    emits evidence that it recognised a state),
 *  - it never concludes "this Flow step is missing"; it records that a control was not found
 *    or a transition did not advance, and reconciliation decides what that means,
 *  - it never retries an action that may already have changed server state.
 *
 * The browser is behind `AutomationPorts`, so the loop is tested end to end against a fake
 * application without launching Chromium.
 */

export type AutomationEventType =
  | 'QA_AUTOMATION_PLAN_CREATED'
  | 'QA_AUTOMATION_STATE_EVALUATED'
  | 'QA_AUTOMATION_ACTION_SELECTED'
  | 'QA_AUTOMATION_ACTION_EXECUTED'
  | 'QA_AUTOMATION_ACTION_VERIFIED'
  | 'QA_AUTOMATION_ACTION_BLOCKED'
  | 'QA_AUTOMATION_REPLAN'
  | 'QA_AUTOMATION_INITIAL_STATE_REACHED'
  | 'QA_AUTOMATION_TERMINAL_STATE_REACHED'
  | 'QA_AUTOMATION_STOPPED';

export interface AutomationEvent {
  type: AutomationEventType;
  at: number;
  data: Record<string, unknown>;
}

export type { ActionOutcome };

/** A step the Flow says needs a person: to approve it (CONFIRM), or to do it themselves (MANUAL). */
export interface StepHandOver {
  kind: 'CONFIRM_STEP' | 'MANUAL_STEP';
  transitionId: string;
  action: string | null;
  from: string;
  to: string;
  /** Plain language, safe to show: what is about to happen (or what to do), and why a person is asked. */
  detail: string;
}

/** What a declared effect of a step turned out to be once the step was done. */
export interface EffectCheck {
  transitionId: string;
  method: string;
  route: string;
  expectedStatus: number | null;
  /** MATCHED: seen, with the status expected. STATUS_MISMATCH: seen, with another. NOT_OBSERVED: never seen. */
  outcome: 'MATCHED' | 'STATUS_MISMATCH' | 'NOT_OBSERVED';
  observedStatus: number | null;
}

/**
 * Whether the requests a page made after a step include each request a person declared the step causes.
 * Only declared effects are checked: a request the code analysis merely infers is evidence for recognising
 * a state, not a promise the application made.
 */
export function checkDeclaredEffects(transitionId: string, conditions: ApiCondition[], requests: ObservedRequest[]): EffectCheck[] {
  return conditions.filter((condition) => condition.declared).map((condition) => {
    const same = requests.filter((request) => request.completed && request.method.toUpperCase() === condition.method.toUpperCase() && request.route === condition.route);
    const matched = same.find((request) => condition.expectStatus === null || request.status === condition.expectStatus);
    return {
      transitionId, method: condition.method, route: condition.route, expectedStatus: condition.expectStatus,
      outcome: matched ? 'MATCHED' : same.length > 0 ? 'STATUS_MISMATCH' : 'NOT_OBSERVED',
      observedStatus: (matched ?? same[0])?.status ?? null,
    };
  });
}

export interface AutomationPorts {
  snapshot(): Promise<SemanticSnapshot>;
  act(action: AutomationAction): Promise<ActionOutcome>;
  /**
   * Wait for the application to settle after an action, then return the resulting snapshot.
   * "Settled" is the adapter's job (state predicate, request completion, DOM quiet window) and is
   * never a fixed sleep. `expectedStateKey` lets it also wait for the SDK signal of the state we expect.
   */
  settle(expectedStateKey: string | null): Promise<SemanticSnapshot>;
  emit(event: AutomationEvent): void;
  now(): number;
  /** Whether the application and browser are still alive. Optional: absent means assume so. */
  health?(): Promise<'OK' | 'APPLICATION_CRASHED' | 'BROWSER_CRASHED'>;
  cancelled?(): boolean;
  /**
   * Called when something looked wrong, so the adapter can take forensic evidence (screenshot, full
   * DOM, trace, code evidence) *while the page still shows it*. Never called for a run going to plan.
   * A failure here is swallowed: losing an artifact must not end a run.
   */
  captureEvidence?(decision: CaptureDecision, stateKey: string | null, subject?: { transitionId: string | null }): Promise<void> | void;
  /**
   * A diagnostic recording scoped to one state visit (a browser trace chunk). The loop opens one when
   * a state is entered and closes it when the run moves on; `retain` is true only if something went
   * wrong during the visit, so a run that goes to plan keeps nothing. The chunk before the first
   * recognised state has a `null` stateKey: it covers entry, where an unreachable start is diagnosed.
   */
  traceChunks?: {
    begin(label: string, stateKey: string | null): Promise<void> | void;
    end(result: { stateKey: string | null; retain: boolean; reasons: AnomalyReason[] }): Promise<void> | void;
  };
  /**
   * Optional tie-breaker for the two things the engine refuses to guess: which of several equally
   * good controls to act on, and which of several equally good states the page is. It can only
   * choose among the candidates the engine already found, and its choice is acted on only if the
   * contract independently agrees (see `ambiguity.ts`). Absent means the engine stops, as always.
   */
  resolver?: AmbiguityResolver;
  /**
   * Run data for form inputs. `undefined` means the data set has no such value, which stops the
   * run before any action that would need it. `secret` values are typed but never recorded.
   */
  data?(dataKey: string): DataValue | undefined;
  /**
   * Get from wherever the browser is to the Flow's initial state (login, navigation).
   * Returns the snapshot once there, or null if it could not. Absent means the run starts at the initial state.
   */
  seekInitial?(): Promise<SemanticSnapshot | null>;
  /**
   * Asks a person to approve, or to perform, a step the Flow marks CONFIRM or MANUAL, and resolves when they
   * have answered. Absent means nobody is there to ask, and the run stops before the step instead of doing
   * something it was told needs a person.
   */
  handOver?(request: StepHandOver): Promise<'DONE' | 'CANCELLED' | 'TIMED_OUT'>;
}

export interface AutomationConfig {
  contract: ExecutableContract;
  targetStateKey: string;
  /** The same target as a list. Shaped for runs that will cover several terminal states; more than one is refused today. */
  targetStateKeys?: string[];
  environment: EnvironmentKind;
  applicationOrigin: string;
  limits: AutomationLimits;
  policy?: PolicyOptions;
}

export interface StateRunRecord {
  sequence: number;
  stateKey: string | null;
  confidence: Recognition['confidence'] | null;
  url: string;
  path: string;
  enteredAt: number;
  /** The transition performed to leave this state, if the run left it. */
  leftVia: { transitionId: string; action: string | null; actionClass: ActionClass; method: string } | null;
}

export interface AutomationResult {
  stopReason: AutomationStopReason;
  detail: string | null;
  states: StateRunRecord[];
  steps: number;
  replans: number;
  elapsedMs: number;
  /** What each declared effect of a performed step turned out to be. Empty when no step declared any. */
  effects?: EffectCheck[];
}

/** After this many consecutive reads in which no state was recognised, the run stops rather than guessing. */
const MAX_UNRECOGNISED = 2;

export async function runAutomation(ports: AutomationPorts, config: AutomationConfig): Promise<AutomationResult> {
  const { contract } = config;
  // Not `ports.now` directly: a port is free to implement it with `this`, and a detached method loses it.
  const budget = new RunBudget(config.limits, () => ports.now());
  const loop = new LoopDetector();
  const states: StateRunRecord[] = [];
  const attempts = new Map<string, number>();
  let unrecognised = 0;
  /** Ambiguities a resolver has already been asked about, so a retry of the same read does not ask again. */
  const resolverAsked = new Set<string>();
  const entrySkipped = new Set<string>();
  let initialReported = false;
  // Set when the next pass is a deliberate retry of the same transition. Retries are bounded on their own;
  // counting them as revisits would report a loop before the retry budget was ever spent.
  let retrying = false;

  const emit = (type: AutomationEventType, data: Record<string, unknown>) => ports.emit({ type, at: ports.now(), data });
  const effects: EffectCheck[] = [];
  let currentStateKey: string | null = null;
  /** The transition being attempted, so a failure can be explained by what the code does for *that* control. */
  let currentTransitionId: string | null = null;
  // The trace chunk of the state visit in progress, and why (if at all) it is worth keeping.
  let chunk: { stateKey: string | null; reasons: Set<AnomalyReason> } | null = null;
  const closeChunk = async (): Promise<void> => {
    if (!chunk) return;
    const closing = chunk;
    chunk = null;
    try {
      await ports.traceChunks?.end({ stateKey: closing.stateKey, retain: closing.reasons.size > 0, reasons: [...closing.reasons] });
    } catch {
      // Diagnostics are best-effort.
    }
  };
  const openChunk = async (stateKey: string | null, visit: number): Promise<void> => {
    await closeChunk();
    if (!ports.traceChunks) return;
    chunk = { stateKey, reasons: new Set() };
    try {
      await ports.traceChunks.begin(stateKey ? `${stateKey} (visit ${visit})` : 'entry', stateKey);
    } catch {
      chunk = null;
    }
  };
  const capture = async (input: CaptureInput): Promise<void> => {
    const decision = decideCapture(input);
    if (decision.tier !== 'DEEP') return;
    if (decision.artifacts.trace && chunk) for (const reason of decision.reasons) chunk.reasons.add(reason);
    try {
      await ports.captureEvidence?.(decision, currentStateKey, { transitionId: currentTransitionId });
    } catch {
      // Evidence is best-effort.
    }
  };
  const finish = async (stopReason: AutomationStopReason, detail: string | null = null): Promise<AutomationResult> => {
    await capture({ stopReason });
    await closeChunk();
    emit('QA_AUTOMATION_STOPPED', { stopReason, detail, steps: budget.stepCount, replans: budget.replanCount });
    return { stopReason, detail, states, steps: budget.stepCount, replans: budget.replanCount, elapsedMs: budget.elapsedMs(), ...(effects.length ? { effects } : {}) };
  };

  const targeting = resolveRunTargets(config);
  emit('QA_AUTOMATION_PLAN_CREATED', {
    initialStateKey: contract.initialStateKey,
    targetStateKey: config.targetStateKey,
    targetStateKeys: targeting.ok ? targeting.targets : [config.targetStateKey],
    flowVersionId: contract.flowVersionId,
    flowHash: contract.flowHash,
    unresolvedTransitions: contract.transitions.filter((transition) => transition.derivation === 'UNRESOLVED').map((transition) => transition.id),
  });

  // Refused before anything is touched: a run is never reported against a target it was not pointed at.
  if (!targeting.ok) return finish('AUTOMATION_ENGINE_ERROR', targeting.detail);

  if (!contract.states.some((state) => state.key === config.targetStateKey)) {
    return finish('TERMINAL_STATE_UNREACHABLE', 'The target state is not in the Flow version this run is pinned to.');
  }

  await openChunk(null, 0);
  let snapshot = await ports.snapshot();
  let recognition = recognizeAmong(snapshot, contract.states);

  // Getting to the initial state is setup, not part of the Flow.
  if (!recognition.best) {
    const entered = ports.seekInitial ? await ports.seekInitial() : null;
    if (!entered) return finish('INITIAL_STATE_UNREACHABLE', 'No Flow state was recognised at the starting point and no entry route reached one.');
    snapshot = entered;
    recognition = recognizeAmong(snapshot, contract.states);
    if (!recognition.best) return finish('INITIAL_STATE_UNREACHABLE', 'The entry route ended somewhere no Flow state was recognised.');
  }

  for (;;) {
    if (ports.cancelled?.()) return finish('CANCELLED_BY_USER');
    const exceeded = budget.exceeded();
    if (exceeded) return finish(exceeded);
    const health = await ports.health?.();
    if (health && health !== 'OK') return finish(health);

    const navigation = evaluateNavigation(snapshot.url, config.applicationOrigin, config.policy);
    if (!navigation.allowed) {
      emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: navigation.reason, detail: navigation.detail, url: originOf(snapshot.url) });
      return finish('UNSAFE_ACTION_BLOCKED', navigation.detail);
    }

    // Two states fit the page equally well. If a resolver is configured it may suggest one of *those two*,
    // and the suggestion stands only if the contract agrees; otherwise the read stays ambiguous.
    let stateResolution: { resolver: string; rationale: string; agreement: string[] } | { rejected: string } | null = null;
    if (recognition.best && recognition.ambiguous && ports.resolver) {
      const top = recognition.best;
      const tied = recognition.candidates.filter((candidate) => Math.abs(candidate.score - top.score) <= AMBIGUITY_MARGIN);
      const asked = `${snapshot.path}|${tied.map((candidate) => candidate.stateKey).sort().join(',')}`;
      if (!resolverAsked.has(asked)) {
        resolverAsked.add(asked);
        const proposal = await askResolver(ports.resolver, {
          kind: 'STATE', path: snapshot.path, title: snapshot.title, headings: snapshot.headings,
          candidates: tied.map((candidate) => ({ stateKey: candidate.stateKey, score: candidate.score })),
        });
        if (proposal) {
          const verdict = verifyStateProposal({
            contract, targetStateKey: config.targetStateKey, environment: config.environment, policy: config.policy,
            path: snapshot.path, tied, proposal,
          });
          if (verdict.accepted) {
            const chosen = tied.find((candidate) => candidate.stateKey === verdict.choice)!;
            // Assisted, so never better than MEDIUM: a suggestion is not the same strength of evidence as a match.
            recognition = { ...recognition, best: { ...chosen, confidence: chosen.confidence === 'HIGH' ? 'MEDIUM' : chosen.confidence }, ambiguous: false };
            stateResolution = { resolver: ports.resolver.id, rationale: proposal.rationale, agreement: verdict.agreement };
          } else {
            stateResolution = { rejected: `${verdict.reason}: ${verdict.detail}` };
          }
        }
      }
    }

    const best = recognition.best;
    currentStateKey = best?.stateKey ?? null;
    await capture({ recognition: best ? { confidence: best.confidence, ambiguous: recognition.ambiguous } : null });
    emit('QA_AUTOMATION_STATE_EVALUATED', {
      recognizedStateKey: best?.stateKey ?? null,
      confidence: best?.confidence ?? null,
      score: best?.score ?? null,
      evidence: best?.evidence ?? null,
      ambiguous: recognition.ambiguous,
      candidates: recognition.candidates.slice(0, 3).map((candidate) => ({ stateKey: candidate.stateKey, score: candidate.score })),
      path: snapshot.path,
      ...(stateResolution && 'resolver' in stateResolution ? { resolvedBy: stateResolution } : {}),
      ...(stateResolution && 'rejected' in stateResolution ? { resolverRejected: stateResolution.rejected } : {}),
    });

    // A read we cannot act on: look again once, then stop. Clicking on a guess is how automation goes wrong.
    if (!best || recognition.ambiguous) {
      unrecognised += 1;
      loop.observe(stateFingerprint(snapshot.path, null), -Infinity);
      if (unrecognised > MAX_UNRECOGNISED) {
        return finish('STATE_RECOGNITION_AMBIGUOUS', recognition.ambiguous
          ? 'More than one Flow state fits the current page equally well.'
          : 'The current page does not match any state the Flow declares.');
      }
      snapshot = await ports.settle(null);
      recognition = recognizeAmong(snapshot, contract.states);
      continue;
    }
    unrecognised = 0;

    if (recordState(states, best, snapshot, ports.now())) {
      currentTransitionId = null;
      await openChunk(best.stateKey, states.length);
    }
    if (!initialReported) {
      initialReported = true;
      emit('QA_AUTOMATION_INITIAL_STATE_REACHED', { stateKey: best.stateKey, confidence: best.confidence });
    }

    if (best.stateKey === config.targetStateKey && best.confidence !== 'LOW') {
      emit('QA_AUTOMATION_TERMINAL_STATE_REACHED', { stateKey: best.stateKey, confidence: best.confidence, evidence: best.evidence });
      return finish('TERMINAL_STATE_REACHED');
    }

    const plan = planFlowPath(contract, best.stateKey, config.targetStateKey, config.environment, config.policy);
    if (!plan.ok) {
      if (plan.reason === 'BLOCKED_BY_POLICY') {
        emit('QA_AUTOMATION_ACTION_BLOCKED', {
          reason: 'ACTION_CLASS_BLOCKED',
          transitions: plan.blockedBy.map((transition) => ({ id: transition.id, actionClass: transition.actionClass })),
        });
        return finish('UNSAFE_ACTION_BLOCKED', 'Every route to the target needs an action the environment policy does not permit.');
      }
      return finish('TERMINAL_STATE_UNREACHABLE', `No declared transition leads from ${best.stateKey} to ${config.targetStateKey}.`);
    }

    // Progress is closeness to the goal, so a run that keeps landing back where it was is a loop.
    const remaining = plan.transitions.length;
    const looping = retrying ? false : loop.observe(stateFingerprint(snapshot.path, best.stateKey), -remaining);
    retrying = false;
    if (looping) {
      return finish('LOOP_DETECTED', `The run returned to ${best.stateKey} repeatedly without getting closer to ${config.targetStateKey}.`);
    }

    const next = plan.transitions[0]!;
    currentTransitionId = next.id;
    const stepInput = {
      control: next.control,
      inputs: next.inputs,
      data: (key: string) => ports.data?.(key),
      label: next.action ?? next.id,
    };
    const mode = next.mode ?? 'AUTO';
    // Opening the application has no control: the run did that itself. Look again, once, without the starting state.
    if (mode === 'AUTO' && isEntryStep(contract, next) && !entrySkipped.has(next.id)) {
      entrySkipped.add(next.id);
      snapshot = await ports.settle(null);
      recognition = recognizeAmong(snapshot, contract.states.filter((state) => state.key !== next.from));
      continue;
    }
    // A step a person performs needs no control found and nothing typed: they do it in the browser.
    let resolved = mode === 'MANUAL' ? null : resolveStep(snapshot, stepInput);
    let controlResolution: { resolver: string; rationale: string; agreement: string[] } | null = null;
    if (resolved && !resolved.ok && resolved.reason === 'CONTROL_AMBIGUOUS' && ports.resolver && next.control) {
      const tied = tiedControls(rankControls(next.control, snapshot.elements).candidates);
      const proposal = await askResolver(ports.resolver, controlSituation(next, tied));
      if (proposal) {
        const verdict = verifyControlProposal({ transition: next, destination: contract.states.find((candidate) => candidate.key === next.to), candidates: tied, proposal });
        if (verdict.accepted) {
          resolved = resolveStep(snapshot, { ...stepInput, tieBreak: () => verdict.choice });
          controlResolution = { resolver: ports.resolver.id, rationale: proposal.rationale, agreement: verdict.agreement };
        } else {
          emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: 'RESOLVER_PROPOSAL_REJECTED', transitionId: next.id, resolver: ports.resolver.id, detail: `${verdict.reason}: ${verdict.detail}` });
        }
      }
    }
    if (resolved && !resolved.ok) {
      const stopReason = DATA_FAILURE_REASONS.has(resolved.reason) ? 'TEST_DATA_UNAVAILABLE' : 'EXPECTED_TRANSITION_NOT_FOUND';
      emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: resolved.reason, transitionId: next.id, action: next.action, from: next.from, expectedState: next.to, detail: resolved.detail });
      return finish(stopReason, resolved.detail);
    }

    // Belt and braces: the planner already excluded blocked classes, but the decision to act is made here.
    // (A person doing a step themselves is not the run acting, so the run's safety policy has nothing to decide.)
    if (mode !== 'MANUAL') {
      const decision = evaluateAction(next.actionClass, config.environment, config.policy);
      if (!decision.allowed) {
        emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: decision.reason, transitionId: next.id, actionClass: next.actionClass, from: next.from, expectedState: next.to, detail: decision.detail });
        return finish('UNSAFE_ACTION_BLOCKED', decision.detail);
      }
    }

    emit('QA_AUTOMATION_ACTION_SELECTED', {
      transitionId: next.id,
      action: next.action,
      from: next.from,
      expectedState: next.to,
      actionClass: next.actionClass,
      // Why this control: how it was matched and how well, so the run is auditable without replaying it.
      method: resolved?.ok ? resolved.method : 'PERSON',
      score: resolved?.ok ? resolved.score : null,
      mode,
      derivation: next.derivation,
      codeRefs: next.codeRefs,
      // A choice a resolver made and the contract confirmed is on the record as exactly that.
      ...(controlResolution ? { resolvedBy: controlResolution } : {}),
    });

    if (mode !== 'AUTO') {
      const label = next.action ?? next.id;
      if (!ports.handOver) {
        emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: 'STEP_NEEDS_PERSON', transitionId: next.id, mode, from: next.from, expectedState: next.to });
        return finish('MANUAL_ACTION_REQUIRED', `${label} is marked ${mode === 'MANUAL' ? 'to be done by a person' : 'to be approved by a person'}, and nobody is here to ask.`);
      }
      const answer = await ports.handOver({
        kind: mode === 'MANUAL' ? 'MANUAL_STEP' : 'CONFIRM_STEP',
        transitionId: next.id, action: next.action, from: next.from, to: next.to,
        detail: mode === 'MANUAL'
          ? `Do "${label}" yourself in the browser (from ${next.from}). Tellann will carry on once ${next.to} shows.`
          : `Tellann is about to do "${label}" (${next.actionClass.toLowerCase().replace(/_/g, ' ')}), taking the run from ${next.from} to ${next.to}. Approve it to go ahead.`,
      });
      if (ports.cancelled?.() || answer === 'CANCELLED') {
        return finish('CANCELLED_BY_USER', mode === 'CONFIRM' ? `${label} was not approved.` : `The run was stopped while it waited for you to do ${label}.`);
      }
      if (answer === 'TIMED_OUT') return finish('MANUAL_ACTION_REQUIRED', `Nobody answered before the wait for ${label} ended, so the run stopped.`);
      // A person may take a while; the page may have moved on from what was read before asking.
      if (mode === 'CONFIRM') {
        snapshot = await ports.snapshot();
        resolved = resolveStep(snapshot, stepInput);
        if (!resolved.ok) {
          emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: resolved.reason, transitionId: next.id, action: next.action, from: next.from, expectedState: next.to, detail: resolved.detail });
          return finish(DATA_FAILURE_REASONS.has(resolved.reason) ? 'TEST_DATA_UNAVAILABLE' : 'EXPECTED_TRANSITION_NOT_FOUND', resolved.detail);
        }
      }
    }

    budget.recordStep();
    const before = snapshot;
    const performed: { ok: true } | { ok: false; stage: 'FILL' | 'CLICK'; error: string } = resolved?.ok ? await performStep(ports, resolved) : { ok: true };
    if (!performed.ok && performed.stage === 'FILL') {
      return finish('AUTOMATION_ENGINE_ERROR', `Could not fill a field: ${performed.error}`);
    }
    emit('QA_AUTOMATION_ACTION_EXECUTED', { transitionId: next.id, ok: performed.ok, error: performed.ok ? null : performed.error, by: mode === 'MANUAL' ? 'PERSON' : 'RUN' });
    if (!performed.ok) {
      // The control was there and would not take the action (detached, covered). That is not a Flow finding.
      const tries = (attempts.get(next.id) ?? 0) + 1;
      attempts.set(next.id, tries);
      if (!budget.canRetry(next.actionClass, tries)) return finish('AUTOMATION_ENGINE_ERROR', `The action failed: ${performed.error}`);
      snapshot = await ports.settle(null);
      recognition = recognizeAmong(snapshot, contract.states);
      retrying = true;
      continue;
    }

    states[states.length - 1]!.leftVia = { transitionId: next.id, action: next.action, actionClass: next.actionClass, method: resolved?.ok ? resolved.method : 'PERSON' };
    snapshot = await ports.settle(next.to);
    recognition = recognizeAmong(snapshot, contract.states);
    const landed = recognition.best;
    const advanced = landed !== null && !recognition.ambiguous && landed.stateKey === next.to;
    // What the person said the step causes, checked against what the page actually did. Never gates the run: the
    // state that followed is the verdict on the step, and an effect that did not show is a finding to report.
    const checked = advanced ? checkDeclaredEffects(next.id, next.expectedApi, snapshot.requests) : [];
    effects.push(...checked);
    emit('QA_AUTOMATION_ACTION_VERIFIED', {
      transitionId: next.id,
      ok: advanced,
      expectedState: next.to,
      observedState: landed?.stateKey ?? null,
      confidence: landed?.confidence ?? null,
      errorsSince: Math.max(0, snapshot.errorCount - before.errorCount),
      ...(checked.length ? { effects: checked } : {}),
    });
    await capture({
      recognition: landed ? { confidence: landed.confidence, ambiguous: recognition.ambiguous } : undefined,
      action: { fromState: next.from, expectedState: next.to, observedState: landed?.stateKey ?? null, advanced },
      errorsSince: Math.max(0, snapshot.errorCount - before.errorCount),
    });
    if (advanced) continue;

    // Where did it land instead?
    if (landed && !recognition.ambiguous && landed.stateKey !== next.from) {
      // Somewhere else in the Flow (a branch, an error state): plan again from there.
      budget.recordReplan();
      emit('QA_AUTOMATION_REPLAN', { reason: 'UNEXPECTED_STATE', expected: next.to, observed: landed.stateKey });
      continue;
    }

    // Still where it started (or nowhere we can name). Only a retry-safe action may be tried again; a
    // mutation that did not visibly succeed may still have happened.
    const tries = (attempts.get(next.id) ?? 0) + 1;
    attempts.set(next.id, tries);
    if (!budget.canRetry(next.actionClass, tries)) {
      return finish('TRANSITION_DID_NOT_ADVANCE', `${next.action ?? next.id} was performed but ${next.to} did not follow.`);
    }
    budget.recordReplan();
    retrying = true;
    emit('QA_AUTOMATION_REPLAN', { reason: 'NO_PROGRESS', expected: next.to, observed: landed?.stateKey ?? null, attempt: tries });
  }
}

/** Whether this is a new visit (and so the start of a new diagnostic chunk). */
function recordState(states: StateRunRecord[], recognition: Recognition, snapshot: SemanticSnapshot, now: number): boolean {
  const last = states[states.length - 1];
  // A re-render of the same state (a validation error, a reloaded list) is not a new visit.
  if (last && last.stateKey === recognition.stateKey && last.leftVia === null) return false;
  states.push({
    sequence: states.length,
    stateKey: recognition.stateKey,
    confidence: recognition.confidence,
    url: snapshot.url,
    path: snapshot.path,
    enteredAt: now,
    leftVia: null,
  });
  return true;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'unknown';
  }
}
