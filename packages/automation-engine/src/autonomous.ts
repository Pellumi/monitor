import { authorizeAutonomousAction } from '@tellann/agent-policy';
import type { AutonomousPerActionApproval, AutonomousScopeApproval } from '@tellann/agent-policy';
import { DATA_FAILURE_REASONS, performStep, resolveStep, truthy } from './act';
import type { DataValue } from './act';
import { AutonomousBudget } from './autonomous-budget';
import type { AutonomousLimits } from './autonomous-budget';
import { riskTierOf } from './autonomous-risk';
import { undeclaredCandidatesFrom, verifyUndeclaredActionProposal } from './autonomous-verification';
import type { UndeclaredActionProposal, UndeclaredCandidate } from './autonomous-verification';
import { checkDeclaredEffects } from './executor';
import type { EffectCheck } from './executor';
import { planFlowPath } from './flow-path';
import { classifyAction } from './policy';
import type { ActionEvidence, PolicyOptions } from './policy';
import { recognizeAmong } from './recognizer';
import { rankControls } from './ranking';
import type {
  ActionClass,
  AutomationAction,
  EnvironmentKind,
  ExecutableContract,
  SemanticSnapshot,
} from './types';

/**
 * The autonomous sequencer: given a contract-grounded `AutonomousPlan` (which declared states
 * each scenario should reach, produced by a model and approved by a person before this ever
 * runs), drive the SAME deterministic primitives the ordinary Automated Run engine uses
 * (`planFlowPath`, `rankControls`/`resolveStep`/`performStep`, `recognizeAmong`,
 * `checkDeclaredEffects`) toward each target in turn, one step at a time, re-recognising and
 * re-planning after every action exactly as `runAutomation` does.
 *
 * The only genuinely new decision this module makes is what to do when the page does not match
 * any contract-declared state at all — the doc's "unexpected 'Choose account type' screen"
 * case. That narrow fallback is the one place a model proposes an action; the proposal is
 * verified against the live candidates (never trusted, never allowed to invent an element — see
 * `autonomous-verification.ts`), classified by the same risk-blind evidence-based
 * `classifyAction` the deterministic engine already uses, and authorized by
 * `@tellann/agent-policy` before anything is performed.
 */

// ---------------------------------------------------------------------------
// Plan, ports and config
// ---------------------------------------------------------------------------

export interface AutonomousScenario {
  key: string;
  title: string;
  /** Contract-declared state keys to reach, in order. */
  targetStateKeys: string[];
  successCriteria: string[];
  exploratory: boolean;
}

export interface AutonomousPlan {
  goal: string;
  scenarios: AutonomousScenario[];
}

export type AutonomousEventType =
  | 'AUTONOMOUS_SCENARIO_STARTED'
  | 'AUTONOMOUS_ACTION_PROPOSED'
  | 'AUTONOMOUS_ACTION_EXECUTED'
  | 'AUTONOMOUS_ACTION_BLOCKED'
  | 'AUTONOMOUS_RECOVERY_ATTEMPTED'
  | 'AUTONOMOUS_INTERVENTION_REQUESTED'
  | 'AUTONOMOUS_INTERVENTION_RESOLVED'
  | 'AUTONOMOUS_REPLAN'
  | 'AUTONOMOUS_SCENARIO_COMPLETED'
  | 'AUTONOMOUS_STOPPED';

export interface AutonomousEvent {
  type: AutonomousEventType;
  at: number;
  data: Record<string, unknown>;
}

export type AutonomousQuestionCategory = 'MISSING_INFORMATION' | 'MISSING_AUTHORITY' | 'EXTERNAL_DEPENDENCY' | 'HIGH_IMPACT_APPROVAL';

export interface AutonomousQuestion {
  category: AutonomousQuestionCategory;
  text: string;
  allowedResponses: string[];
  /** Set for HIGH_IMPACT_APPROVAL: the one proposed action this answer, if affirmative, approves. */
  actionFingerprint?: string;
}

export type AutonomousQuestionAnswer = { response: string } | { cancelled: true } | { timedOut: true };

export interface AutonomousQuestionPort {
  ask(question: AutonomousQuestion): Promise<AutonomousQuestionAnswer>;
}

export type AutonomousFailureCause = 'APPLICATION_DEFECT' | 'TEST_SETUP' | 'TRANSIENT' | 'UNKNOWN';
export type AutonomousFailureRecovery = 'RETRY' | 'ALTERNATIVE_SELECTOR' | 'REPLAN' | 'ASK_HUMAN' | 'GIVE_UP';

export interface AutonomousFailureExplanation {
  likelyCause: AutonomousFailureCause;
  explanation: string;
  suggestedRecovery: AutonomousFailureRecovery;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AutonomousModelPort {
  decide(input: {
    goal: string;
    scenarioTitle: string;
    path: string;
    title: string | null;
    headings: string[];
    candidates: UndeclaredCandidate[];
    history: string[];
  }): Promise<{ proposal: UndeclaredActionProposal }>;
  explainFailure(input: {
    scenarioTitle: string;
    attemptedAction: string;
    expected: string;
    observed: string;
  }): Promise<{ explanation: AutonomousFailureExplanation }>;
}

export interface AutonomousPorts {
  snapshot(): Promise<SemanticSnapshot>;
  act(action: AutomationAction): Promise<{ ok: boolean; error?: string }>;
  settle(expectedStateKey: string | null): Promise<SemanticSnapshot>;
  emit(event: AutonomousEvent): void;
  now(): number;
  health?(): Promise<'OK' | 'APPLICATION_CRASHED' | 'BROWSER_CRASHED'>;
  cancelled?(): boolean;
  data?(dataKey: string): DataValue | undefined;
  model: AutonomousModelPort;
  /** Absent means nobody is there to ask, and the run stops before anything that needs one. */
  question?: AutonomousQuestionPort;
}

export interface AutonomousConfig {
  contract: ExecutableContract;
  plan: AutonomousPlan;
  environment: EnvironmentKind;
  applicationOrigin: string;
  limits: AutonomousLimits;
  /**
   * Origins the run may navigate to besides the application's own. Deliberately does NOT narrow
   * which action classes are routable (unlike the deterministic engine's `PolicyOptions`,
   * autonomous mode always allows `planFlowPath` to route through every class, including
   * HIGH_IMPACT ones) — the real gate is `scopeApproval`/per-action authorization below, checked
   * on every single action, not a blanket allow/deny on the class before routing even considers it.
   */
  approvedOrigins?: string[];
  /** Null means the run's scope has not been approved by a person; nothing beyond READ can proceed. */
  scopeApproval: AutonomousScopeApproval | null;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type AutonomousScenarioStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE' | 'NOT_RUN';

export interface AutonomousScenarioResult {
  key: string;
  title: string;
  status: AutonomousScenarioStatus;
  detail: string | null;
  steps: number;
  effects: EffectCheck[];
}

export type AutonomousRunStopReason = 'COMPLETED' | 'BUDGET_EXCEEDED' | 'CANCELLED_BY_USER' | 'AUTOMATION_ENGINE_ERROR';

export interface AutonomousResult {
  stopReason: AutonomousRunStopReason;
  scenarios: AutonomousScenarioResult[];
  steps: number;
  replans: number;
  modelCalls: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Every class routing may use. The deterministic class-level block stays only for PRODUCTION (see `evaluateAction`). */
const ALL_ACTION_CLASSES: ActionClass[] = ['READ', 'CLIENT_STATE_MUTATION', 'SERVER_MUTATION', 'EXTERNAL_SIDE_EFFECT', 'DESTRUCTIVE'];

/** Bounded re-attempts at the same target before a scenario is reported inconclusive rather than looping forever. */
const MAX_ATTEMPTS_PER_TARGET = 6;

function actionFingerprint(scenarioKey: string, sequence: number, action: string, targetRef: string | null): string {
  return `${scenarioKey}:${sequence}:${action}:${targetRef ?? ''}`;
}

/** No evidence is gathered for an undeclared control beyond its own label — `classifyAction` already treats that conservatively. */
function evidenceFor(candidate: UndeclaredCandidate): ActionEvidence {
  return {
    methods: [],
    labels: [candidate.name, candidate.label].filter((value): value is string => Boolean(value)),
    isNavigation: candidate.role === 'link',
    handlerTraced: false,
    submitsForm: false,
  };
}

function toAutomationAction(proposal: UndeclaredActionProposal): AutomationAction | null {
  switch (proposal.action) {
    case 'CLICK':
      return { kind: 'CLICK', ref: proposal.targetRef! };
    case 'FILL':
      return { kind: 'FILL', ref: proposal.targetRef!, value: proposal.value ?? '', secret: false };
    case 'SELECT':
      return { kind: 'SELECT', ref: proposal.targetRef!, value: proposal.value ?? '' };
    case 'CHECK':
      return { kind: 'SET_CHECKED', ref: proposal.targetRef!, checked: truthy(proposal.value ?? 'true') };
    case 'WAIT':
      return null;
  }
}

interface TargetOutcome {
  ok: boolean;
  status?: AutonomousScenarioStatus;
  detail?: string;
  snapshot: SemanticSnapshot;
  steps: number;
  effects: EffectCheck[];
  stop?: AutonomousRunStopReason;
}

/** Drives the run from wherever it is now toward one target state, one action at a time. */
async function runTowardState(
  ports: AutonomousPorts,
  config: AutonomousConfig,
  budget: AutonomousBudget,
  scenario: AutonomousScenario,
  targetStateKey: string,
  startSnapshot: SemanticSnapshot,
): Promise<TargetOutcome> {
  const { contract, environment } = config;
  const routingPolicy: PolicyOptions = { approvedClasses: ALL_ACTION_CLASSES, approvedOrigins: config.approvedOrigins };
  let snapshot = startSnapshot;
  let steps = 0;
  const effects: EffectCheck[] = [];
  const history: string[] = [];
  const emit = (type: AutonomousEventType, data: Record<string, unknown>) => ports.emit({ type, at: ports.now(), data });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_TARGET; attempt += 1) {
    if (ports.cancelled?.()) return { ok: false, status: 'BLOCKED', detail: 'Cancelled.', snapshot, steps, effects, stop: 'CANCELLED_BY_USER' };
    const exceeded = budget.exceeded();
    if (exceeded) {
      return { ok: false, status: 'BLOCKED', detail: `Run budget exhausted (${exceeded}) before reaching ${targetStateKey}.`, snapshot, steps, effects, stop: 'BUDGET_EXCEEDED' };
    }

    const recognized = recognizeAmong(snapshot, contract.states);
    const currentKey = recognized.best && !recognized.ambiguous ? recognized.best.stateKey : null;
    if (currentKey === targetStateKey) return { ok: true, snapshot, steps, effects };

    if (currentKey) {
      // -- contract-grounded routing, one hop at a time ------------------------------------------------
      const planResult = planFlowPath(contract, currentKey, targetStateKey, environment, routingPolicy);
      if (!planResult.ok) {
        return { ok: false, status: 'BLOCKED', detail: `No permitted route leads from ${currentKey} to ${targetStateKey} (${planResult.reason}).`, snapshot, steps, effects };
      }
      const transition = planResult.transitions[0]!;
      const resolved = resolveStep(snapshot, {
        control: transition.control,
        inputs: transition.inputs,
        data: (key) => ports.data?.(key),
        label: transition.action ?? transition.id,
      });
      if (!resolved.ok) {
        const status: AutonomousScenarioStatus = DATA_FAILURE_REASONS.has(resolved.reason) ? 'BLOCKED' : 'FAIL';
        return { ok: false, status, detail: resolved.detail, snapshot, steps, effects };
      }

      const riskTier = riskTierOf(transition.actionClass);
      const fingerprint = actionFingerprint(scenario.key, steps, transition.action ?? transition.id, resolved.controlRef);
      emit('AUTONOMOUS_ACTION_PROPOSED', { transitionId: transition.id, riskTier, fingerprint });
      const authorized = await authorize(ports, config, riskTier, fingerprint, `${transition.action ?? 'This step'} (${riskTier.toLowerCase().replace('_', ' ')})`);
      if (!authorized.ok) {
        emit('AUTONOMOUS_ACTION_BLOCKED', { transitionId: transition.id, reason: authorized.reason });
        return { ok: false, status: 'BLOCKED', detail: authorized.detail, snapshot, steps, effects };
      }

      const performed = await performStep(ports, resolved);
      steps += 1;
      budget.recordStep();
      if (!performed.ok) {
        return { ok: false, status: 'FAIL', detail: `${performed.stage} failed: ${performed.error}`, snapshot, steps, effects };
      }
      emit('AUTONOMOUS_ACTION_EXECUTED', { transitionId: transition.id, controlRef: resolved.controlRef });
      snapshot = await ports.settle(transition.to);
      effects.push(...checkDeclaredEffects(transition.id, transition.expectedApi, snapshot.requests));

      const after = recognizeAmong(snapshot, contract.states);
      // Check this before the next loop pass's budget check: an action that both lands correctly and
      // happens to exhaust the budget must still be reported as having reached the target, not as blocked.
      if (after.best && !after.ambiguous && after.best.stateKey === targetStateKey) return { ok: true, snapshot, steps, effects };
      const looping = budget.observeProgress(`${snapshot.path}::${after.best?.stateKey ?? 'unrecognised'}`, steps);
      if (looping) return { ok: false, status: 'INCONCLUSIVE', detail: 'The run is revisiting the same screen without making progress.', snapshot, steps, effects };
      if (after.best?.stateKey !== transition.to) {
        emit('AUTONOMOUS_RECOVERY_ATTEMPTED', { transitionId: transition.id, expected: transition.to, observed: after.best?.stateKey ?? null });
        budget.recordModelCall();
        try {
          await ports.model.explainFailure({
            scenarioTitle: scenario.title,
            attemptedAction: transition.action ?? transition.id,
            expected: transition.to,
            observed: after.best?.stateKey ?? 'an unrecognised screen',
          });
        } catch {
          // Best-effort evidence only; a failed explanation never stops the run by itself.
        }
        budget.recordReplan();
        emit('AUTONOMOUS_REPLAN', { from: currentKey, towards: targetStateKey });
      }
      continue;
    }

    // -- undeclared screen: the narrow model-assisted fallback --------------------------------------
    const candidates = undeclaredCandidatesFrom(snapshot.elements);
    budget.recordModelCall();
    if (budget.exceeded()) {
      return { ok: false, status: 'BLOCKED', detail: 'Model-call budget exhausted while on an unrecognised screen.', snapshot, steps, effects, stop: 'BUDGET_EXCEEDED' };
    }
    const { proposal } = await ports.model.decide({
      goal: config.plan.goal,
      scenarioTitle: scenario.title,
      path: snapshot.path,
      title: snapshot.title,
      headings: snapshot.headings,
      candidates,
      history,
    });
    const verification = verifyUndeclaredActionProposal(proposal, candidates);
    if (!verification.accepted) {
      return { ok: false, status: 'INCONCLUSIVE', detail: verification.detail, snapshot, steps, effects };
    }

    const chosen = candidates.find((candidate) => candidate.ref === proposal.targetRef);
    const actionClass = chosen ? classifyAction(evidenceFor(chosen)) : 'CLIENT_STATE_MUTATION';
    const riskTier = riskTierOf(actionClass);
    const fingerprint = actionFingerprint(scenario.key, steps, proposal.action, proposal.targetRef);
    emit('AUTONOMOUS_ACTION_PROPOSED', { undeclared: true, proposal, riskTier, fingerprint });
    const authorized = await authorize(ports, config, riskTier, fingerprint, `${proposal.action} on an unrecognised screen (${riskTier.toLowerCase().replace('_', ' ')})`);
    if (!authorized.ok) {
      emit('AUTONOMOUS_ACTION_BLOCKED', { undeclared: true, reason: authorized.reason });
      return { ok: false, status: 'BLOCKED', detail: authorized.detail, snapshot, steps, effects };
    }

    const action = toAutomationAction(proposal);
    if (action) {
      const outcome = await ports.act(action);
      if (!outcome.ok) {
        history.push(`${proposal.action} ${proposal.targetRef ?? ''} failed: ${outcome.error ?? 'unknown error'}`);
        continue;
      }
    }
    steps += 1;
    budget.recordStep();
    emit('AUTONOMOUS_ACTION_EXECUTED', { undeclared: true, proposal });
    history.push(`${proposal.action}${proposal.targetRef ? ` ${proposal.targetRef}` : ''}: ${proposal.rationale}`);
    snapshot = await ports.settle(null);
    const landed = recognizeAmong(snapshot, contract.states);
    if (landed.best && !landed.ambiguous && landed.best.stateKey === targetStateKey) return { ok: true, snapshot, steps, effects };
  }

  return { ok: false, status: 'INCONCLUSIVE', detail: `Could not reach ${targetStateKey} within ${MAX_ATTEMPTS_PER_TARGET} attempts.`, snapshot, steps, effects };
}

async function authorize(
  ports: AutonomousPorts,
  config: AutonomousConfig,
  riskTier: ReturnType<typeof riskTierOf>,
  fingerprint: string,
  humanDescription: string,
): Promise<{ ok: true } | { ok: false; reason: string; detail: string }> {
  const decision = authorizeAutonomousAction({
    riskTier,
    environment: config.environment,
    scopeApproval: config.scopeApproval,
    actionFingerprint: fingerprint,
  });
  if (decision.allowed) return { ok: true };
  if (!decision.requiresHumanApproval || !ports.question) {
    return { ok: false, reason: decision.reason, detail: humanAuthorizationDetail(decision.reason, humanDescription) };
  }
  const answer = await ports.question.ask({
    category: 'HIGH_IMPACT_APPROVAL',
    text: `Approve this action? ${humanDescription}`,
    allowedResponses: ['Approve', 'Decline'],
    actionFingerprint: fingerprint,
  });
  if (!('response' in answer) || answer.response !== 'Approve') {
    return { ok: false, reason: decision.reason, detail: 'The action needed approval, and it was not given.' };
  }
  const perActionApproval: AutonomousPerActionApproval = { actionFingerprint: fingerprint, approvedAt: new Date(ports.now()).toISOString() };
  const reauthorized = authorizeAutonomousAction({
    riskTier,
    environment: config.environment,
    scopeApproval: config.scopeApproval,
    actionFingerprint: fingerprint,
    perActionApproval,
  });
  if (!reauthorized.allowed) return { ok: false, reason: reauthorized.reason, detail: 'Approved, but authorization still refused it.' };
  return { ok: true };
}

function humanAuthorizationDetail(reason: string, humanDescription: string): string {
  if (reason === 'NO_SCOPE_APPROVAL') return `This run's scope has not been approved, so nothing beyond reading the page may happen yet.`;
  if (reason === 'PRODUCTION_BLOCKED') return 'Autonomous runs are not permitted against production.';
  return `${humanDescription} needed approval and nobody could be asked.`;
}

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

export async function runAutonomousExploration(ports: AutonomousPorts, config: AutonomousConfig): Promise<AutonomousResult> {
  const budget = new AutonomousBudget(config.limits, () => ports.now());
  const startedAt = ports.now();
  const scenarioResults: AutonomousScenarioResult[] = [];
  let totalSteps = 0;
  let snapshot = await ports.snapshot();
  let runStop: AutonomousRunStopReason = 'COMPLETED';

  for (const scenario of config.plan.scenarios) {
    if (runStop !== 'COMPLETED') {
      scenarioResults.push({ key: scenario.key, title: scenario.title, status: 'NOT_RUN', detail: null, steps: 0, effects: [] });
      continue;
    }
    if (ports.cancelled?.()) {
      runStop = 'CANCELLED_BY_USER';
      scenarioResults.push({ key: scenario.key, title: scenario.title, status: 'NOT_RUN', detail: null, steps: 0, effects: [] });
      continue;
    }
    const budgetHit = budget.exceeded();
    if (budgetHit) {
      runStop = 'BUDGET_EXCEEDED';
      scenarioResults.push({ key: scenario.key, title: scenario.title, status: 'NOT_RUN', detail: null, steps: 0, effects: [] });
      continue;
    }

    ports.emit({ type: 'AUTONOMOUS_SCENARIO_STARTED', at: ports.now(), data: { scenarioKey: scenario.key } });
    let status: AutonomousScenarioStatus = 'PASS';
    let detail: string | null = null;
    let scenarioSteps = 0;
    const scenarioEffects: EffectCheck[] = [];

    for (const targetStateKey of scenario.targetStateKeys) {
      const outcome = await runTowardState(ports, config, budget, scenario, targetStateKey, snapshot);
      snapshot = outcome.snapshot;
      scenarioSteps += outcome.steps;
      scenarioEffects.push(...outcome.effects);
      if (!outcome.ok) {
        status = outcome.status ?? 'FAIL';
        detail = outcome.detail ?? null;
        if (outcome.stop) runStop = outcome.stop;
        break;
      }
    }

    if (status === 'PASS' && scenarioEffects.some((effect) => effect.outcome === 'STATUS_MISMATCH')) {
      status = 'FAIL';
      detail = 'A declared effect of this scenario happened with a different outcome than expected.';
    }

    totalSteps += scenarioSteps;
    scenarioResults.push({ key: scenario.key, title: scenario.title, status, detail, steps: scenarioSteps, effects: scenarioEffects });
    ports.emit({ type: 'AUTONOMOUS_SCENARIO_COMPLETED', at: ports.now(), data: { scenarioKey: scenario.key, status } });
  }

  ports.emit({ type: 'AUTONOMOUS_STOPPED', at: ports.now(), data: { stopReason: runStop } });
  return {
    stopReason: runStop,
    scenarios: scenarioResults,
    steps: totalSteps,
    replans: budget.replanCount,
    modelCalls: budget.modelCallCount,
    elapsedMs: ports.now() - startedAt,
  };
}
