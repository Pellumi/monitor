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
      include: { expectedGraphVersion: true },
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
    const flowVersionId = String(input.flowVersionId ?? '');
    const stateKey = normalizeQaFlowKey(input.stateKey || input.toStateKey);
    const fromStateKey = normalizeQaFlowKey(input.fromStateKey ?? metadata.fromStateKey);
    const snapshot = run.expectedGraphVersion?.snapshot as any;
    const expectedStates = Array.isArray(snapshot?.states) ? snapshot.states : [];
    const knownKeys = new Set(expectedStates.map((state: any) => normalizeQaFlowKey(state.behaviorKey ?? state.stateName ?? state.name)));
    const expectedTransitions = Array.isArray(snapshot?.transitions)
      ? snapshot.transitions
      : Array.isArray(snapshot?.edges) ? snapshot.edges : [];
    const initialKey = normalizeQaFlowKey(run.initialStateKey);
    const terminals = new Set(run.terminalStateKeys.map(normalizeQaFlowKey));
    const waiting = !run.boundaryStartedAt;
    const transitionKnown = eventType !== 'FLOW_TRANSITION' || expectedTransitions.some((transition: any) => {
      const from = normalizeQaFlowKey(transition.fromStateKey ?? transition.from ?? transition.sourceBehaviorKey ?? transition.source);
      const to = normalizeQaFlowKey(transition.toStateKey ?? transition.to ?? transition.targetBehaviorKey ?? transition.target);
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
    else if (eventType === 'FLOW_TRANSITION' && run.lastObservedStateKey && normalizeQaFlowKey(run.lastObservedStateKey) !== fromStateKey) reason = 'OUT_OF_ORDER_TRANSITION';
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
