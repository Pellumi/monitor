import {
  PrismaClient,
  QARunStatus,
  type QARun,
  type QARunProgressEvent,
} from '@prisma/client';

const TERMINAL_RUN_STATUSES = new Set<QARunStatus>([
  QARunStatus.COMPLETED,
  QARunStatus.COMPLETED_INCOMPLETE,
  QARunStatus.FAILED,
  QARunStatus.CANCELLED,
]);

const SUPPORTED_FLOW_EVENTS = new Set([
  'FLOW_INITIAL_STATE',
  'FLOW_STATE_REACHED',
  'FLOW_TRANSITION',
  'FLOW_TERMINAL_STATE',
]);

export type QAFlowBoundaryEventInput = {
  eventId: string;
  eventType: string;
  flowVersionId: string;
  stateKey: string;
  fromStateKey?: string | null;
  toStateKey?: string | null;
  action?: string | null;
  timestamp?: string | Date | null;
  metadata?: Record<string, unknown>;
};

export type QAFlowBoundaryResult = {
  kind: 'NOT_FOUND' | 'RUN_TERMINAL' | 'DUPLICATE' | 'QUARANTINED' | 'ACCEPTED';
  accepted: boolean;
  duplicate: boolean;
  quarantined: boolean;
  reason: string | null;
  shouldStop: boolean;
  phase: 'PRE_BOUNDARY' | 'IN_FLOW';
  run: QARun | null;
  progressEvent?: QARunProgressEvent;
};

export function normalizeQaFlowKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Authoritative, transactional Flow boundary acceptance shared by desktop and
 * SDK ingestion. Runtime routes never call this function.
 */
export async function processQaFlowBoundaryEvent(
  prisma: PrismaClient,
  runId: string,
  input: QAFlowBoundaryEventInput,
): Promise<QAFlowBoundaryResult> {
  return prisma.$transaction(async (tx) => {
    const run = await tx.qARun.findUnique({
      where: { id: runId },
      include: { expectedGraphVersion: true, flow: true },
    });
    if (!run) {
      return { kind: 'NOT_FOUND', accepted: false, duplicate: false, quarantined: false, reason: 'RUN_NOT_FOUND', shouldStop: false, phase: 'PRE_BOUNDARY', run: null };
    }
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      return { kind: 'RUN_TERMINAL', accepted: false, duplicate: false, quarantined: false, reason: 'RUN_IS_TERMINAL', shouldStop: false, phase: run.boundaryStartedAt ? 'IN_FLOW' : 'PRE_BOUNDARY', run };
    }

    const existing = await tx.qARunProgressEvent.findUnique({ where: { id: input.eventId } });
    if (existing) {
      const sameRun = existing.runId === run.id;
      return {
        kind: 'DUPLICATE',
        accepted: sameRun && existing.accepted,
        duplicate: true,
        quarantined: !sameRun || !existing.accepted,
        reason: sameRun ? existing.reason : 'EVENT_ID_COLLISION',
        shouldStop: sameRun && existing.accepted && existing.eventType === 'FLOW_TERMINAL_STATE',
        phase: run.boundaryStartedAt ? 'IN_FLOW' : 'PRE_BOUNDARY',
        run,
        progressEvent: existing,
      };
    }

    const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
    const eventType = String(input.eventType ?? '');
    const snapshot = run.expectedGraphVersion?.snapshot as any;
    const expectedStates = Array.isArray(snapshot?.states) ? snapshot.states : [];

    // A marker in the user's source names its flow and state the way the
    // instrumentation snippet wrote them — a slug of the declared name, not the
    // version UUID and internal key this function used to demand. The run
    // already pins exactly one flow and one expected version, so the slug is
    // enough to resolve. Every alias a state answers to collapses onto one
    // canonical key, and the run's own declared initial/terminal keys go through
    // the same map, so a marker and a declaration written against different
    // fields still compare equal.
    const stateAliases = new Map<string, string>();
    const canonicalKeys = new Set<string>();
    for (const state of expectedStates as any[]) {
      const canonical = normalizeQaFlowKey(state?.behaviorKey ?? state?.stateName ?? state?.name ?? state?.id);
      if (!canonical) continue;
      canonicalKeys.add(canonical);
      for (const alias of [state?.behaviorKey, state?.stateName, state?.name, state?.id, state?.stateId]) {
        const normalized = normalizeQaFlowKey(alias);
        if (normalized && !stateAliases.has(normalized)) stateAliases.set(normalized, canonical);
      }
    }
    const canonicalState = (value: unknown): string => {
      const normalized = normalizeQaFlowKey(value);
      return normalized ? stateAliases.get(normalized) ?? normalized : '';
    };

    // The flow slug identifies the flow, never the version. Matching it against
    // the run's own flow is what lets a marker survive a re-publish: the run
    // supplies the version, the source supplies the name.
    const declaredFlow = metadata.flow ?? metadata.flowKey;
    const flowAliases = new Set(
      [run.flow?.name, snapshot?.name, snapshot?.flowName]
        .map(normalizeQaFlowKey)
        .filter(Boolean),
    );
    const declaredFlowMatchesRun = Boolean(declaredFlow)
      && flowAliases.has(normalizeQaFlowKey(declaredFlow));
    const flowVersionId = String(input.flowVersionId ?? '')
      || (declaredFlowMatchesRun ? String(run.expectedGraphVersionId ?? '') : '');

    const stateKey = canonicalState(
      input.stateKey || input.toStateKey || metadata.state || metadata.stateId,
    );
    const fromStateKey = canonicalState(
      input.fromStateKey ?? metadata.fromStateKey ?? metadata.fromState,
    );
    const knownKeys = canonicalKeys;
    const expectedTransitions = Array.isArray(snapshot?.transitions)
      ? snapshot.transitions
      : Array.isArray(snapshot?.edges) ? snapshot.edges : [];
    const initialKey = canonicalState(run.initialStateKey);
    const terminals = new Set(run.terminalStateKeys.map(canonicalState));
    const waiting = !run.boundaryStartedAt;
    const transitionKnown = eventType !== 'FLOW_TRANSITION' || expectedTransitions.some((transition: any) => {
      const from = canonicalState(transition.fromStateKey ?? transition.from ?? transition.sourceBehaviorKey ?? transition.source ?? transition.fromStateId);
      const to = canonicalState(transition.toStateKey ?? transition.to ?? transition.targetBehaviorKey ?? transition.target ?? transition.toStateId);
      return from === fromStateKey && to === stateKey;
    });

    let reason: string | null = null;
    if (!input.eventId || !eventType || !flowVersionId || !stateKey) reason = 'FLOW_EVENT_CONTEXT_REQUIRED';
    else if (!SUPPORTED_FLOW_EVENTS.has(eventType)) reason = 'UNSUPPORTED_FLOW_EVENT';
    else if (run.status === QARunStatus.PAUSED) reason = 'RUN_PAUSED';
    else if (run.boundaryCompletedAt) reason = 'AFTER_TERMINAL_BOUNDARY';
    else if (flowVersionId !== run.expectedGraphVersionId) reason = 'FLOW_VERSION_MISMATCH';
    else if (!knownKeys.has(stateKey)) reason = 'UNKNOWN_STATE';
    else if (waiting && (eventType !== 'FLOW_INITIAL_STATE' || stateKey !== initialKey)) reason = 'BEFORE_INITIAL_BOUNDARY';
    else if (!waiting && eventType === 'FLOW_INITIAL_STATE') reason = 'INITIAL_BOUNDARY_ALREADY_ACCEPTED';
    else if (eventType === 'FLOW_TRANSITION' && (!fromStateKey || !transitionKnown)) reason = 'UNKNOWN_TRANSITION';
    else if (eventType === 'FLOW_TRANSITION' && run.lastObservedStateKey && canonicalState(run.lastObservedStateKey) !== fromStateKey) reason = 'OUT_OF_ORDER_TRANSITION';
    else if (eventType === 'FLOW_TERMINAL_STATE' && !terminals.has(stateKey)) reason = 'UNDECLARED_TERMINAL_STATE';

    const parsedTimestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    const occurredAt = Number.isNaN(parsedTimestamp.valueOf()) ? new Date() : parsedTimestamp;
    const accepted = reason === null;
    const progressEvent = await tx.qARunProgressEvent.create({
      data: {
        id: input.eventId,
        runId: run.id,
        eventType,
        stateKey,
        accepted,
        reason,
        metadata: {
          ...metadata,
          flowVersionId,
          fromStateKey: fromStateKey || undefined,
          toStateKey: stateKey,
          action: input.action ?? metadata.action ?? undefined,
        },
        occurredAt,
      },
    });

    if (!accepted) {
      return { kind: 'QUARANTINED', accepted: false, duplicate: false, quarantined: true, reason, shouldStop: false, phase: waiting ? 'PRE_BOUNDARY' : 'IN_FLOW', run, progressEvent };
    }

    const now = new Date();
    const terminalReached = eventType === 'FLOW_TERMINAL_STATE' && terminals.has(stateKey);
    const updated = await tx.qARun.update({
      where: { id: run.id },
      data: {
        status: terminalReached ? QARunStatus.PROCESSING : QARunStatus.RECORDING,
        boundaryStartedAt: run.boundaryStartedAt ?? now,
        boundaryCompletedAt: terminalReached ? now : undefined,
        lastObservedStateKey: stateKey,
        completionReason: terminalReached ? 'TERMINAL_STATE_REACHED' : undefined,
      },
    });
    return { kind: 'ACCEPTED', accepted: true, duplicate: false, quarantined: false, reason: null, shouldStop: terminalReached, phase: 'IN_FLOW', run: updated, progressEvent };
  });
}
