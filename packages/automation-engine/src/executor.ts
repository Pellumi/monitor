import type { AutomationLimits, AutomationStopReason } from '@tellann/desktop-contracts';
import { DATA_FAILURE_REASONS, performStep, resolveStep } from './act';
import type { DataValue } from './act';
import { askResolver, controlSituation, tiedControls, verifyControlProposal, verifyStateProposal } from './ambiguity';
import type { AmbiguityResolver } from './ambiguity';
import { LoopDetector, RunBudget, stateFingerprint } from './budget';
import { decideCapture } from './capture-policy';
import type { AnomalyReason, CaptureDecision, CaptureInput } from './capture-policy';
import { planFlowPath } from './flow-path';
import { dedupe, flowShapeFindings, rankFindings, responsiveFindings, statePageFindings } from './ui-quality';
import { resolveRunTargets } from './targets';
import { evaluateAction, evaluateNavigation } from './policy';
import type { PolicyOptions } from './policy';
import { AMBIGUITY_MARGIN, recognize, recognizeAmong } from './recognizer';
import { isEntryStep } from './support';
import { rankControls } from './ranking';
import { applyScreenAnalysis, screenFingerprint } from './screen-analysis';
import type {
  ActionClass,
  ActionOutcome,
  ApiCondition,
  AutomationAction,
  Breakpoint,
  EnvironmentKind,
  ExecutableContract,
  ExecutableTransition,
  ObservedRequest,
  Recognition,
  ScreenAnalysisReason,
  ScreenAnalysisResult,
  SemanticSnapshot,
  ViewportSample,
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
  | 'QA_AUTOMATION_STOPPED'
  | 'QA_AUTOMATION_OCR_ANALYSIS'
  | 'QA_AUTOMATION_RESPONSIVE_SAMPLE'
  | 'QA_AUTOMATION_UI_QUALITY';

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
   * The adapter's own per-state checks — an accessibility scan — on the first visit to a state. Best-effort and
   * never consulted: nothing found here changes what the run does, so a failure is a missing report row.
   */
  inspectPage?(stateKey: string): Promise<void> | void;
  /**
   * Re-measure the state the run has just reached at other window sizes. Called once per state, on the first
   * visit, after it has been recognised and before anything is done in it — so a sweep can never change what
   * the run does. The adapter restores the original size before returning. Absent means no sweep.
   */
  measureViewports?(breakpoints: Breakpoint[]): Promise<ViewportSample[]>;
  /**
   * Optional tie-breaker for the two things the engine refuses to guess: which of several equally
   * good controls to act on, and which of several equally good states the page is. It can only
   * choose among the candidates the engine already found, and its choice is acted on only if the
   * contract independently agrees (see `ambiguity.ts`). Absent means the engine stops, as always.
   */
  resolver?: AmbiguityResolver;
  /**
   * Optional masked-pixel fallback. The adapter owns capture and transport;
   * the engine receives only sanitized OCR text and boxes.
   */
  screenAnalysis?(input: { reason: ScreenAnalysisReason; snapshot: SemanticSnapshot }): Promise<ScreenAnalysisResult | null>;
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
  /**
   * The window sizes each state is re-measured at, the first time it is reached. Empty (or no `measureViewports`
   * port) means the Flow is only ever judged at the size it was walked at.
   */
  responsiveBreakpoints?: Breakpoint[];
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
  /** One paid OCR attempt per rendered screen and failure reason. */
  const screenAnalysisAsked = new Set<string>();
  const entrySkipped = new Set<string>();
  let initialReported = false;
  // Set when the next pass is a deliberate retry of the same transition. Retries are bounded on their own;
  // counting them as revisits would report a loop before the retry budget was ever spent.
  let retrying = false;

  const emit = (type: AutomationEventType, data: Record<string, unknown>) => ports.emit({ type, at: ports.now(), data });
  const analyzeScreen = async (reason: ScreenAnalysisReason, source: SemanticSnapshot) => {
    if (!ports.screenAnalysis || config.environment === 'PRODUCTION') return null;
    const key = `${reason}|${screenFingerprint(source)}`;
    if (screenAnalysisAsked.has(key)) return null;
    screenAnalysisAsked.add(key);
    try {
      const analysis = await ports.screenAnalysis({ reason, snapshot: source });
      if (!analysis) {
        emit('QA_AUTOMATION_OCR_ANALYSIS', { reason, status: 'UNAVAILABLE', outcome: 'NO_CHANGE' });
        return null;
      }
      const applied = applyScreenAnalysis(source, analysis);
      return { ...applied, analysis };
    } catch {
      emit('QA_AUTOMATION_OCR_ANALYSIS', { reason, status: 'UNAVAILABLE', outcome: 'NO_CHANGE' });
      return null;
    }
  };
  const stateReason = (source: SemanticSnapshot, result: ReturnType<typeof recognizeAmong>, initial: boolean): ScreenAnalysisReason | null => {
    if (result.ambiguous) return 'STATE_AMBIGUOUS';
    if (result.best?.confidence === 'LOW') return 'STATE_LOW_CONFIDENCE';
    if (result.best) return null;
    if (initial) return 'INITIAL_STATE_UNRECOGNIZED';
    const low = contract.states.map((state) => recognize(source, state)).sort((a, b) => b.score - a.score)[0];
    return low && low.score > 0 ? 'STATE_LOW_CONFIDENCE' : 'STATE_UNRECOGNIZED';
  };
  const assistState = async (source: SemanticSnapshot, result: ReturnType<typeof recognizeAmong>, initial: boolean) => {
    const reason = stateReason(source, result, initial);
    if (!reason) return { snapshot: source, recognition: result };
    const assisted = await analyzeScreen(reason, source);
    if (!assisted) return { snapshot: source, recognition: result };
    const next = recognizeAmong(assisted.snapshot, contract.states);
    if (next.best) next.best = { ...next.best, confidence: next.best.confidence === 'HIGH' ? 'MEDIUM' : next.best.confidence };
    const outcome = next.best && !next.ambiguous ? 'ASSISTED' : 'NO_CHANGE';
    emit('QA_AUTOMATION_OCR_ANALYSIS', {
      reason, status: 'SUCCEEDED', outcome,
      requestId: assisted.analysis.requestId,
      model: assisted.analysis.model,
      modelRevision: assisted.analysis.modelRevision,
      latencyMs: assisted.analysis.latencyMs,
      detectionCount: assisted.analysis.detections.length,
      matchedRefs: assisted.matchedRefs,
      recognizedStateKey: next.best?.stateKey ?? null,
    });
    return { snapshot: assisted.snapshot, recognition: next };
  };
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
  /** How long the run waited for each state to arrive, so a slow page can be told from a quick one. */
  const settleTimes = new Map<string, number>();
  /**
   * Everything about how one state is drawn: at the size the run is walking it, and at every other size the run
   * was asked about. Findings carry the measurement behind them; the samples are recorded whether or not
   * anything was wrong with them, because "checked at five sizes, all clear" is worth saying too.
   *
   * Entirely best-effort. Nothing here decides anything about the run, so a measurement that fails is a row
   * missing from a report, never a run that stops.
   */
  const inspectState = async (stateKey: string, snapshot: SemanticSnapshot, settledMs: number | null): Promise<void> => {
    try {
      await ports.inspectPage?.(stateKey);
    } catch {
      // The adapter's own checks are its business, and losing one is never a reason to stop.
    }
    const state = contract.states.find((candidate) => candidate.key === stateKey);
    const outgoing = contract.transitions.filter((transition) => transition.from === stateKey);
    const findings = statePageFindings({
      stateKey, state, outgoing, elements: snapshot.elements, page: snapshot.page,
      settledMs, busyIndicator: snapshot.page?.busyIndicator,
    });

    const breakpoints = config.responsiveBreakpoints ?? [];
    if (ports.measureViewports && breakpoints.length > 0) {
      try {
        const samples = await ports.measureViewports(breakpoints);
        if (samples.length > 0) {
          emit('QA_AUTOMATION_RESPONSIVE_SAMPLE', {
            stateKey,
            samples: samples.map((sample) => ({
              name: sample.breakpoint.name,
              width: sample.breakpoint.width,
              height: sample.breakpoint.height,
              horizontalOverflowPx: Math.round(sample.page.horizontalOverflowPx),
              smallestTextPx: sample.page.smallestTextPx === null ? null : Math.round(sample.page.smallestTextPx * 10) / 10,
              smallestTapTargetPx: smallestTapTarget(sample, outgoing),
              controlsChecked: sample.elements.filter((element) => element.visible && element.enabled).length,
            })),
          });
          findings.push(...responsiveFindings(stateKey, state, outgoing, samples));
        }
      } catch {
        // A size that could not be measured is a row missing from a report, not a failed run.
      }
    }

    const ranked = rankFindings(dedupe(findings));
    if (ranked.length > 0) emit('QA_AUTOMATION_UI_QUALITY', { stateKey, findings: ranked });
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

  // What is wrong with the shape of the declared Flow — a state nothing leads out of, a step that asks for
  // nothing, a state nothing can reach. All facts about what somebody declared, so they hold before the run
  // touches anything, and they are said once rather than once per visit.
  const shape = rankFindings(flowShapeFindings(contract, config.environment, config.policy));
  if (shape.length > 0) emit('QA_AUTOMATION_UI_QUALITY', { stateKey: null, findings: shape });

  // Refused before anything is touched: a run is never reported against a target it was not pointed at.
  if (!targeting.ok) return finish('AUTOMATION_ENGINE_ERROR', targeting.detail);

  if (!contract.states.some((state) => state.key === config.targetStateKey)) {
    return finish('TERMINAL_STATE_UNREACHABLE', 'The target state is not in the Flow version this run is pinned to.');
  }

  await openChunk(null, 0);
  let snapshot = await ports.snapshot();
  let recognition = recognizeAmong(snapshot, contract.states);
  ({ snapshot, recognition } = await assistState(snapshot, recognition, true));

  // Getting to the initial state is setup, not part of the Flow.
  if (!recognition.best) {
    const entered = ports.seekInitial ? await ports.seekInitial() : null;
    if (!entered) return finish('INITIAL_STATE_UNREACHABLE', 'No Flow state was recognised at the starting point and no entry route reached one.');
    snapshot = entered;
    recognition = recognizeAmong(snapshot, contract.states);
    ({ snapshot, recognition } = await assistState(snapshot, recognition, true));
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

    ({ snapshot, recognition } = await assistState(snapshot, recognition, false));

    // Two states fit the page equally well. If a resolver is configured it may suggest one of *those two*,
    // and the suggestion stands only if the contract agrees; otherwise the read stays ambiguous.
    let stateResolution: { resolver: string; locality: string; rationale: string; agreement: string[] } | { rejected: string } | null = null;
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
            stateResolution = { resolver: ports.resolver.id, locality: ports.resolver.locality, rationale: proposal.rationale, agreement: verdict.agreement };
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
      // The first time this state is reached, and only then: judge how it is drawn, and re-measure it at the
      // other window sizes. Before planning and before acting, so a sweep can never change what the run does —
      // which is the only basis on which it could be on by default.
      await inspectState(best.stateKey, snapshot, settleTimes.get(best.stateKey) ?? null);
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
    // Counted before anything is attempted, so a step that could not be resolved still says how close it came.
    let ranking = next.control ? rankControls(next.control, snapshot.elements) : null;
    // Opening the application has no control: the run did that itself. Look again, once, without the starting state.
    if (mode === 'AUTO' && isEntryStep(contract, next) && !entrySkipped.has(next.id)) {
      entrySkipped.add(next.id);
      snapshot = await ports.settle(null);
      recognition = recognizeAmong(snapshot, contract.states.filter((state) => state.key !== next.from));
      continue;
    }
    // A step a person performs needs no control found and nothing typed: they do it in the browser.
    let resolved = mode === 'MANUAL' ? null : resolveStep(snapshot, stepInput);
    let controlResolution: { resolver: string; locality: string; rationale: string; agreement: string[] } | null = null;
    if (resolved && !resolved.ok && next.control
      && (resolved.reason === 'CONTROL_AMBIGUOUS' || resolved.reason === 'CONTROL_NOT_FOUND')) {
      const reason: ScreenAnalysisReason = resolved.reason === 'CONTROL_AMBIGUOUS' ? 'CONTROL_AMBIGUOUS' : 'CONTROL_NOT_FOUND';
      const assisted = await analyzeScreen(reason, snapshot);
      if (assisted) {
        snapshot = assisted.snapshot;
        ranking = rankControls(next.control, snapshot.elements);
        resolved = resolveStep(snapshot, stepInput);
        emit('QA_AUTOMATION_OCR_ANALYSIS', {
          reason, status: 'SUCCEEDED', outcome: resolved.ok ? 'ASSISTED' : 'NO_CHANGE',
          requestId: assisted.analysis.requestId,
          model: assisted.analysis.model,
          modelRevision: assisted.analysis.modelRevision,
          latencyMs: assisted.analysis.latencyMs,
          detectionCount: assisted.analysis.detections.length,
          matchedRefs: assisted.matchedRefs,
          selectedRef: resolved.ok ? resolved.controlRef : null,
        });
      }
    }
    if (resolved && !resolved.ok && resolved.reason === 'CONTROL_AMBIGUOUS' && ports.resolver && next.control) {
      const tied = tiedControls(rankControls(next.control, snapshot.elements).candidates);
      const proposal = await askResolver(ports.resolver, controlSituation(next, tied));
      if (proposal) {
        const verdict = verifyControlProposal({ transition: next, destination: contract.states.find((candidate) => candidate.key === next.to), candidates: tied, proposal });
        if (verdict.accepted) {
          resolved = resolveStep(snapshot, { ...stepInput, tieBreak: () => verdict.choice });
          controlResolution = { resolver: ports.resolver.id, locality: ports.resolver.locality, rationale: proposal.rationale, agreement: verdict.agreement };
        } else {
          emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: 'RESOLVER_PROPOSAL_REJECTED', transitionId: next.id, resolver: ports.resolver.id, detail: `${verdict.reason}: ${verdict.detail}` });
        }
      }
    }
    if (resolved && !resolved.ok) {
      // "It was not there" and "it was there and unusable" are different findings about the application, and the
      // second one is the more actionable: something is covering the control a person is meant to press.
      const stopReason = DATA_FAILURE_REASONS.has(resolved.reason) ? 'TEST_DATA_UNAVAILABLE'
        : resolved.reason === 'CONTROL_OBSCURED' ? 'CONTROL_OBSCURED'
        : resolved.reason === 'REQUIRED_FIELD_NOT_DECLARED' ? 'REQUIRED_FIELD_NOT_DECLARED'
        : 'EXPECTED_TRANSITION_NOT_FOUND';
      emit('QA_AUTOMATION_ACTION_BLOCKED', { reason: resolved.reason, transitionId: next.id, action: next.action, from: next.from, expectedState: next.to, detail: resolved.detail });
      return finish(stopReason, resolved.detail);
    }

    const candidateCount = ranking?.candidates.length ?? 0;
    const unusableCount = ranking?.unusable.length ?? 0;

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
      // How hard it was to find, which is what "how easy is this to get at" is actually measured from. A
      // control matched only by its visible text, or found among four identical ones, or present but hidden,
      // is harder for a person to pick out too — and all of it was already known here and thrown away.
      candidates: candidateCount,
      unusable: unusableCount,
      attempt: (attempts.get(next.id) ?? 0) + 1,
      // A choice a resolver made and the contract confirmed is on the record as exactly that.
      ...(controlResolution ? { resolvedBy: controlResolution } : {}),
      // So is one the rendered page made, which is a different kind of evidence and should read as one.
      ...(resolved?.ok && resolved.resolvedBy ? { resolvedByRendering: resolved.resolvedBy } : {}),
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
          return finish(
            DATA_FAILURE_REASONS.has(resolved.reason) ? 'TEST_DATA_UNAVAILABLE'
              : resolved.reason === 'CONTROL_OBSCURED' ? 'CONTROL_OBSCURED'
              : resolved.reason === 'REQUIRED_FIELD_NOT_DECLARED' ? 'REQUIRED_FIELD_NOT_DECLARED'
              : 'EXPECTED_TRANSITION_NOT_FOUND',
            resolved.detail,
          );
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
    const settleStartedAt = ports.now();
    snapshot = await ports.settle(next.to);
    // How long the page the action led to took to arrive, kept against the state it led to, so a finding about
    // a slow page names the state that was slow.
    settleTimes.set(next.to, ports.now() - settleStartedAt);
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
      // How long a person would have waited for this, and whether the page said anything while they did.
      settledMs: settleTimes.get(next.to) ?? null,
      busyIndicator: snapshot.page?.busyIndicator ?? null,
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

// ─────────────────────────────────────────────────────────────
// Coverage review: the live half of a pre-publish Flow Sustainability Review (criterion 5,
// reinforcing criterion 3). Deliberately not a mode on `runAutomation` above — that loop's
// whole shape is "stop at the first unresolved step," which is correct for a QA run (one
// failure is the result) and wrong here (every declared transition needs its own verdict, so
// one failure must never stop the rest from being checked).
// ─────────────────────────────────────────────────────────────

export interface CoverageReviewConfig {
  contract: ExecutableContract;
  environment: EnvironmentKind;
  limits: AutomationLimits;
  policy?: PolicyOptions;
}

export interface CoverageReviewFinding {
  transitionId: string | null;
  stateKey: string | null;
  reason: 'REQUIRED_FIELD_NOT_DECLARED' | 'DATA_UNAVAILABLE' | 'FIELD_NOT_FOUND' | 'UNREACHABLE';
  detail: string | null;
}

export interface CoverageReviewResult {
  visitedStateKeys: string[];
  visitedTransitionIds: string[];
  findings: CoverageReviewFinding[];
  elapsedMs: number;
}

/**
 * Performs just enough of the declared Flow to resolve — never necessarily perform — every
 * transition reachable from the initial state, against the live, running application.
 *
 * `resolveStep` is pure and read-only: finding the control and planning the fills it would
 * need (exactly what catches `REQUIRED_FIELD_NOT_DECLARED`, `DATA_UNAVAILABLE` and
 * `FIELD_NOT_FOUND`) never touches the page. That is what makes full coverage affordable in
 * one walk: every outgoing transition of a visited state can be resolved against the same
 * snapshot — branch and all — and only one of them, the one that carries the walk onward, is
 * ever actually clicked. A branch the walk itself never takes (because taking it would leave
 * this state for good) still gets its declared fields checked against the real page; it just
 * is not performed, exactly as `AUTO` steps are never guessed at elsewhere in this engine.
 */
export async function runCoverageReview(ports: AutomationPorts, config: CoverageReviewConfig): Promise<CoverageReviewResult> {
  const { contract } = config;
  const budget = new RunBudget(config.limits, () => ports.now());
  const findings: CoverageReviewFinding[] = [];
  const visitedStateKeys = new Set<string>();
  const visitedTransitionIds = new Set<string>();
  const data = (key: string) => ports.data?.(key);

  // Every transition whose `from` state has no declared route from the initial state is
  // reported once, up front, without touching the app: nothing live will ever reach it to
  // test it otherwise, and that is itself the finding.
  for (const transition of contract.transitions) {
    if (transition.from === contract.initialStateKey) continue;
    const reachable = planFlowPath(contract, contract.initialStateKey, transition.from, config.environment, config.policy);
    if (!reachable.ok) {
      findings.push({
        transitionId: transition.id, stateKey: transition.from, reason: 'UNREACHABLE',
        detail: `No declared route from the initial state reaches ${transition.from}, so ${transition.id} was never tested against the live application.`,
      });
    }
  }

  let snapshot = await ports.snapshot();
  let recognition = recognizeAmong(snapshot, contract.states);
  // Getting to the initial state is setup, not part of the Flow — the same split `runAutomation` makes.
  if (!recognition.best) {
    const entered = ports.seekInitial ? await ports.seekInitial() : null;
    if (!entered) return { visitedStateKeys: [], visitedTransitionIds: [], findings, elapsedMs: budget.elapsedMs() };
    snapshot = entered;
    recognition = recognizeAmong(snapshot, contract.states);
  }
  const queue: string[] = recognition.best ? [recognition.best.stateKey] : [];

  while (queue.length > 0) {
    if (budget.exceeded()) break;
    const stateKey = queue.shift()!;
    if (visitedStateKeys.has(stateKey)) continue;

    if (recognition.best?.stateKey !== stateKey) {
      const plan = planFlowPath(contract, recognition.best?.stateKey ?? contract.initialStateKey, stateKey, config.environment, config.policy);
      if (!plan.ok) continue; // Unreachable from here right now; already on record above if it is unreachable from the start at all.
      const walked = await walkCoverageSteps(ports, plan.transitions, data, config.environment, config.policy);
      if (!walked.ok) continue;
      snapshot = walked.snapshot;
      recognition = recognizeAmong(snapshot, contract.states);
      if (recognition.best?.stateKey !== stateKey) continue; // Landed somewhere else; this visit does not count.
    }
    visitedStateKeys.add(stateKey);

    let advanceVia: { transition: ExecutableTransition; resolved: Extract<ReturnType<typeof resolveStep>, { ok: true }> } | null = null;
    for (const transition of contract.transitions.filter((candidate) => candidate.from === stateKey)) {
      visitedTransitionIds.add(transition.id);
      if ((transition.mode ?? 'AUTO') !== 'AUTO' || !transition.control) continue; // A person's own step, or nothing to resolve against: not this check's business.
      const resolved = resolveStep(snapshot, { control: transition.control, inputs: transition.inputs, data, label: transition.action ?? transition.id });
      if (!resolved.ok) {
        if (resolved.reason === 'REQUIRED_FIELD_NOT_DECLARED' || resolved.reason === 'DATA_UNAVAILABLE' || resolved.reason === 'FIELD_NOT_FOUND') {
          findings.push({ transitionId: transition.id, stateKey, reason: resolved.reason, detail: resolved.detail });
        }
        continue;
      }
      // The first resolvable, policy-permitted transition carries the walk onward; any other
      // resolvable sibling was still checked above, just never clicked — performing every
      // branch would mean reaching this state more than once, which only a dedicated
      // multi-path run supports. A resolvable transition the environment's safety policy
      // blocks is still worth having resolved (its declared fields are now known-good), but
      // it is never the one the walk acts on — exactly the belt-and-braces check `runAutomation` applies.
      if (!advanceVia && evaluateAction(transition.actionClass, config.environment, config.policy).allowed) {
        advanceVia = { transition, resolved };
      }
    }

    if (advanceVia) {
      const performed = await performStep(ports, advanceVia.resolved);
      budget.recordStep();
      if (performed.ok) {
        snapshot = await ports.settle(advanceVia.transition.to);
        recognition = recognizeAmong(snapshot, contract.states);
        if (!visitedStateKeys.has(advanceVia.transition.to)) queue.push(advanceVia.transition.to);
      }
    }
  }

  return {
    visitedStateKeys: [...visitedStateKeys], visitedTransitionIds: [...visitedTransitionIds],
    findings, elapsedMs: budget.elapsedMs(),
  };
}

/** A single, unretried attempt at a declared path, for getting the coverage walk to a state it has not visited yet. */
async function walkCoverageSteps(
  ports: AutomationPorts,
  transitions: ExecutableTransition[],
  data: (key: string) => DataValue | undefined,
  environment: EnvironmentKind,
  policy: PolicyOptions | undefined,
): Promise<{ ok: true; snapshot: SemanticSnapshot } | { ok: false }> {
  let snapshot = await ports.snapshot();
  for (const transition of transitions) {
    if ((transition.mode ?? 'AUTO') !== 'AUTO' || !transition.control) return { ok: false };
    if (!evaluateAction(transition.actionClass, environment, policy).allowed) return { ok: false };
    const resolved = resolveStep(snapshot, { control: transition.control, inputs: transition.inputs, data, label: transition.action ?? transition.id });
    if (!resolved.ok) return { ok: false };
    const performed = await performStep(ports, resolved);
    if (!performed.ok) return { ok: false };
    snapshot = await ports.settle(transition.to);
  }
  return { ok: true, snapshot };
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

/**
 * The smallest of the controls this state's own steps act on, at this size. Null when none of them could be
 * found or measured, which `responsiveFindings` reports in its own right.
 */
function smallestTapTarget(sample: ViewportSample, outgoing: ExecutableContract['transitions']): number | null {
  let smallest: number | null = null;
  for (const transition of outgoing) {
    const labels = transition.control?.labels ?? [];
    const match = sample.elements.find((element) =>
      (transition.control?.testId !== null && transition.control?.testId !== undefined && element.testId === transition.control.testId)
      || labels.some((label) => sameText(label, element.name) || sameText(label, element.label)));
    const rect = match?.geometry?.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const side = Math.min(rect.width, rect.height);
    if (smallest === null || side < smallest) smallest = side;
  }
  return smallest === null ? null : Math.round(smallest);
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return Boolean(a) && Boolean(b) && normalize(a as string) === normalize(b as string);
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'unknown';
  }
}
