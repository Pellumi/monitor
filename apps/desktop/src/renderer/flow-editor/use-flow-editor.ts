import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DeclaredFlowDetail,
  DeclaredStateSuggestion,
  FlowReviewPreview,
  FlowSuggestionMeta,
  FlowSuggestionsResponse,
} from '@tellann/desktop-contracts';
import { normalizeDesktopError } from '../desktop-context';

export type FlowDetail = DeclaredFlowDetail;
export type FlowState = DeclaredFlowDetail['states'][number];
export type FlowTransition = DeclaredFlowDetail['transitions'][number];
export type StateRole = 'NORMAL' | 'INITIAL' | 'TERMINAL';
export type TerminalKind = 'SUCCESS' | 'FAILURE' | 'CANCELLATION' | 'ALTERNATE';
export type StateInput = { stateName: string; category: string; role: StateRole; terminalKind: TerminalKind };
export type FlowSettingsInput = { name: string; purpose: string; scopeStatement: string; workflowType: string };

type SuggestionTrigger =
  | 'STATE_ADDED'
  | 'STATE_UPDATED'
  | 'STATE_DELETED'
  | 'TRANSITION_ADDED'
  | 'SUGGESTION_ACCEPTED'
  | 'MANUAL_REFRESH';
type GraphResult = {
  state?: Record<string, unknown>;
  graphVersion?: number;
  data?: { graphVersion?: number };
};
type ReviewRevision = { graphVersion: number; graphHash: string };
type Outcome<T> = { ok: true; value: T } | { ok: false };

const PENDING_SUGGESTION = new Set(['PENDING', 'SUGGESTED', 'EDITED']);

function intent() {
  const bridge = window.tellann?.intent;
  if (!bridge) throw new Error('Open Tellann in the desktop app to edit flows.');
  return bridge;
}

export function flowIsEditable(flow: FlowDetail | null): boolean {
  if (!flow) return false;
  return flow.status !== 'COMPLETE' && (flow.lifecycleStatus ?? 'DRAFT') === 'DRAFT';
}

/**
 * Loads a declared flow and exposes every edit the graph editor makes, plus the
 * state suggestion queue, whole-flow review, and draft history.
 */
export function useFlowEditor(projectId: string, flowId: string) {
  const [flow, setFlow] = useState<FlowDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<DeclaredStateSuggestion[]>([]);
  const [suggestionMeta, setSuggestionMeta] = useState<FlowSuggestionMeta | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(null);
  const [unappliableIds, setUnappliableIds] = useState<Set<string>>(() => new Set());

  const [reviewSuggestions, setReviewSuggestions] = useState<DeclaredStateSuggestion[]>([]);
  const [reviewMeta, setReviewMeta] = useState<FlowSuggestionMeta | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewRevision, setReviewRevision] = useState<ReviewRevision | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(() => new Set());
  const [reviewPreview, setReviewPreview] = useState<FlowReviewPreview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewPreviewLoading, setReviewPreviewLoading] = useState(false);
  const [reviewApplying, setReviewApplying] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const previewSequence = useRef(0);

  const [history, setHistory] = useState<FlowDraftHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const suggestionTimer = useRef<number | null>(null);

  const refreshFlow = useCallback(async () => {
    const next = await intent().getDeclaredFlow(projectId, flowId);
    setFlow(next);
    return next;
  }, [flowId, projectId]);

  const showReview = useCallback((payload: FlowSuggestionsResponse, suggestionsForReview = payload.suggestions) => {
    setReviewSuggestions(suggestionsForReview);
    setReviewMeta(payload.meta ?? null);
    setReviewId(payload.reviewId ?? suggestionsForReview.find((item) => item.reviewId)?.reviewId ?? null);
    setReviewRevision({ graphVersion: payload.graphVersion, graphHash: payload.graphHash });
    setSelectedReviewIds(new Set(suggestionsForReview.map((item) => item.id)));
  }, []);

  const clearReview = useCallback(() => {
    setReviewSuggestions([]);
    setReviewId(null);
    setReviewRevision(null);
    setSelectedReviewIds(new Set());
    setReviewPreview(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFlow(null);
    setLoadError(null);
    setError(null);
    setSuggestions([]);
    setSuggestionMeta(null);
    setUnappliableIds(new Set());
    setReviewMeta(null);
    setReviewNotice(null);
    setHistory(null);
    clearReview();
    void (async () => {
      try {
        const next = await intent().getDeclaredFlow(projectId, flowId);
        if (!cancelled) setFlow(next);
      } catch (cause) {
        if (!cancelled) setLoadError(normalizeDesktopError(cause));
        return;
      }
      try {
        const payload = await intent().getFlowSuggestions(projectId, flowId);
        if (cancelled) return;
        setSuggestions(payload.suggestions.filter((item) => !item.reviewId));
        setSuggestionMeta(payload.meta ?? null);
        const latestReviewId = payload.suggestions.find((item) => item.reviewId)?.reviewId;
        if (latestReviewId) {
          showReview(payload, payload.suggestions.filter((item) => item.reviewId === latestReviewId));
        }
      } catch {
        // Suggestions are optional; the graph stays editable without them.
      }
    })();
    return () => {
      cancelled = true;
      if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
    };
  }, [clearReview, flowId, projectId, showReview]);

  const run = useCallback(async <T>(label: string, action: () => Promise<T>): Promise<Outcome<T>> => {
    setPendingAction(label);
    setError(null);
    try {
      return { ok: true, value: await action() };
    } catch (cause) {
      setError(normalizeDesktopError(cause));
      return { ok: false };
    } finally {
      setPendingAction(null);
    }
  }, []);

  // Debounced so a burst of edits asks for suggestions once.
  const refreshSuggestions = useCallback((trigger: SuggestionTrigger, result?: GraphResult) => {
    if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
    suggestionTimer.current = window.setTimeout(() => {
      setSuggestionsLoading(true);
      void Promise.resolve()
        .then(() => intent().generateFlowSuggestions(projectId, flowId, {
          trigger,
          graphVersion: result?.graphVersion ?? result?.data?.graphVersion,
          latestState: result?.state,
        }))
        .then((payload) => {
          setSuggestions(payload.suggestions.filter((item) => !item.reviewId));
          setSuggestionMeta(payload.meta ?? null);
          setUnappliableIds(new Set());
        })
        .catch((cause) => {
          if (trigger === 'MANUAL_REFRESH') setError(`Suggestions could not be refreshed: ${normalizeDesktopError(cause)}`);
        })
        .finally(() => setSuggestionsLoading(false));
    }, trigger === 'MANUAL_REFRESH' ? 0 : 400);
  }, [flowId, projectId]);

  const afterGraphChange = useCallback(async (trigger: SuggestionTrigger | null, result?: GraphResult) => {
    try {
      await refreshFlow();
    } catch (cause) {
      setError(normalizeDesktopError(cause));
    }
    if (trigger) refreshSuggestions(trigger, result);
  }, [refreshFlow, refreshSuggestions]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await intent().getFlowDraftHistory(projectId, flowId));
    } catch (cause) {
      setError(`Draft history could not be loaded: ${normalizeDesktopError(cause)}`);
    } finally {
      setHistoryLoading(false);
    }
  }, [flowId, projectId]);

  const addState = useCallback(async (input: StateInput, onCreated?: (stateId: string) => void) => {
    const outcome = await run('add-state', () => intent().addDeclaredState(
      projectId,
      flowId,
      input.stateName.trim(),
      input.category,
      input.role,
      input.role === 'TERMINAL' ? input.terminalKind : null,
    ));
    if (!outcome.ok) return false;
    const result = outcome.value as GraphResult;
    const stateId = result.state?.id;
    if (typeof stateId === 'string') onCreated?.(stateId);
    await afterGraphChange('STATE_ADDED', result);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const updateState = useCallback(async (state: FlowState, patch: Partial<StateInput>) => {
    const role: StateRole = patch.role ?? (state.role as StateRole | undefined) ?? 'NORMAL';
    const terminalKind = role === 'TERMINAL'
      ? patch.terminalKind ?? (state.terminalKind as TerminalKind | null | undefined) ?? 'SUCCESS'
      : null;
    const outcome = await run('update-state', () => intent().updateDeclaredState(
      projectId,
      flowId,
      state.id,
      (patch.stateName ?? state.stateName).trim(),
      patch.category ?? (state.category || 'BUSINESS'),
      role,
      terminalKind,
    ));
    if (!outcome.ok) return false;
    await afterGraphChange('STATE_UPDATED', outcome.value as GraphResult);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  /** A flow has one initial state, so any other initial state becomes intermediate. */
  const setInitialState = useCallback(async (state: FlowState) => {
    const others = (flow?.states ?? []).filter((item) => item.id !== state.id && item.role === 'INITIAL');
    const outcome = await run('update-state', async () => {
      for (const other of others) {
        await intent().updateDeclaredState(projectId, flowId, other.id, other.stateName, other.category, 'NORMAL', null);
      }
      return intent().updateDeclaredState(projectId, flowId, state.id, state.stateName, state.category, 'INITIAL', null);
    });
    if (!outcome.ok) return false;
    await afterGraphChange('STATE_UPDATED', outcome.value as GraphResult);
    return true;
  }, [afterGraphChange, flow?.states, flowId, projectId, run]);

  const deleteState = useCallback(async (stateId: string) => {
    const outcome = await run('delete-state', () => intent().deleteDeclaredState(projectId, flowId, stateId));
    if (!outcome.ok) return false;
    await afterGraphChange('STATE_DELETED', outcome.value as GraphResult);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const addTransition = useCallback(async (fromStateId: string, toStateId: string, action?: string) => {
    if (fromStateId === toStateId) return false;
    const outcome = await run('add-transition', () => intent().addDeclaredTransition(
      projectId,
      flowId,
      fromStateId,
      toStateId,
      action?.trim() || undefined,
    ));
    if (!outcome.ok) return false;
    await afterGraphChange('TRANSITION_ADDED', outcome.value as GraphResult);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const updateTransition = useCallback(async (transitionId: string, action: string) => {
    const outcome = await run('update-transition', () => intent().updateDeclaredTransition(projectId, flowId, transitionId, action.trim()));
    if (!outcome.ok) return false;
    await afterGraphChange(null);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const deleteTransition = useCallback(async (transitionId: string) => {
    const outcome = await run('delete-transition', () => intent().deleteDeclaredTransition(projectId, flowId, transitionId));
    if (!outcome.ok) return false;
    await afterGraphChange(null);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const updateFlow = useCallback(async (input: Partial<FlowSettingsInput>) => {
    const outcome = await run('update-flow', () => intent().updateDeclaredFlow(projectId, flowId, input));
    if (!outcome.ok) return false;
    await afterGraphChange(null);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const publish = useCallback(async () => {
    const outcome = await run('publish', () => intent().completeDeclaredFlow(projectId, flowId));
    if (!outcome.ok) return false;
    await afterGraphChange(null);
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const revise = useCallback(async () => {
    const outcome = await run('revise', () => intent().reopenDeclaredFlow(projectId, flowId));
    if (!outcome.ok) return false;
    await afterGraphChange(null);
    void loadHistory();
    return true;
  }, [afterGraphChange, flowId, loadHistory, projectId, run]);

  /** Throws so the confirmation dialog can show why a delete failed. */
  const deleteFlow = useCallback(async () => {
    await intent().deleteDeclaredFlow(projectId, flowId);
  }, [flowId, projectId]);

  const resolveAiDraft = useCallback(async (decision: 'accept' | 'decline') => {
    const outcome = await run('ai-draft', () => intent().resolveAiFlowDraft(projectId, flowId, decision));
    if (!outcome.ok) return false;
    if (decision === 'accept') await afterGraphChange('MANUAL_REFRESH');
    return true;
  }, [afterGraphChange, flowId, projectId, run]);

  const actOnSuggestion = useCallback(async (suggestionId: string, action: 'accept' | 'reject' | 'dismiss') => {
    setSuggestionActionId(suggestionId);
    setError(null);
    try {
      if (action === 'accept') {
        const response = await intent().acceptFlowSuggestion(projectId, flowId, suggestionId) as GraphResult;
        setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
        await afterGraphChange('SUGGESTION_ACCEPTED', response);
        void loadHistory();
      } else {
        if (action === 'reject') await intent().rejectFlowSuggestion(projectId, flowId, suggestionId);
        else await intent().dismissFlowSuggestion(projectId, flowId, suggestionId);
        setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
      }
    } catch (cause) {
      const detail = normalizeDesktopError(cause);
      // A queued suggestion the graph has outgrown can only be dismissed.
      if (action === 'accept' && /GRAPH_REVISION_STALE|422|no longer|unappliable/i.test(detail)) {
        setUnappliableIds((current) => new Set(current).add(suggestionId));
      } else {
        setError(detail);
      }
    } finally {
      setSuggestionActionId(null);
    }
  }, [afterGraphChange, flowId, loadHistory, projectId]);

  const pendingSuggestions = suggestions.filter((item) => PENDING_SUGGESTION.has(String(item.status).toUpperCase()) || !item.status);

  // Preview the graph the selected review proposals would produce.
  useEffect(() => {
    if (!reviewRevision || selectedReviewIds.size === 0) {
      setReviewPreview(null);
      return;
    }
    const sequence = ++previewSequence.current;
    const timer = window.setTimeout(() => {
      setReviewPreviewLoading(true);
      void Promise.resolve()
        .then(() => intent().previewFlowReview(projectId, flowId, { suggestionIds: [...selectedReviewIds], ...reviewRevision }))
        .then((payload) => {
          if (sequence === previewSequence.current) setReviewPreview(payload);
        })
        .catch((cause) => {
          if (sequence !== previewSequence.current) return;
          setReviewPreview(null);
          setError(normalizeDesktopError(cause));
        })
        .finally(() => {
          if (sequence === previewSequence.current) setReviewPreviewLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [flowId, projectId, reviewRevision, selectedReviewIds]);

  const requestReview = useCallback(async () => {
    if (!flow || flow.states.length < 2) return;
    setReviewLoading(true);
    setReviewNotice(null);
    setReviewPreview(null);
    setError(null);
    try {
      showReview(await intent().generateFlowSuggestions(projectId, flowId, {
        trigger: 'FLOW_REVIEW_REQUESTED',
        graphVersion: flow.version,
      }));
    } catch (cause) {
      setError(normalizeDesktopError(cause));
    } finally {
      setReviewLoading(false);
    }
  }, [flow, flowId, projectId, showReview]);

  const toggleReviewSuggestion = useCallback((suggestionId: string) => {
    setSelectedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(suggestionId)) next.delete(suggestionId);
      else next.add(suggestionId);
      return next;
    });
  }, []);

  const applyReview = useCallback(async () => {
    if (!reviewRevision || !selectedReviewIds.size || !reviewPreview?.validation.valid) return;
    setReviewApplying(true);
    setError(null);
    try {
      const result = await intent().applyFlowReview(projectId, flowId, {
        suggestionIds: [...selectedReviewIds],
        ...reviewRevision,
      }) as { graphVersion?: number; validation?: { valid: boolean } };
      clearReview();
      await afterGraphChange(null);
      void loadHistory();
      setReviewNotice('Applied. Checking for optional states and alternate paths…');
      // Once the core flow is connected, the next review looks for enrichments.
      if (result.validation?.valid && result.graphVersion !== undefined) {
        setReviewLoading(true);
        try {
          const next = await intent().generateFlowSuggestions(projectId, flowId, {
            trigger: 'FLOW_REVIEW_REQUESTED',
            graphVersion: result.graphVersion,
          });
          showReview(next);
          setReviewNotice(next.suggestions.length
            ? 'The core flow is connected. Optional states and paths are ready to review.'
            : 'The flow is connected and no further states were recommended.');
        } finally {
          setReviewLoading(false);
        }
      }
    } catch (cause) {
      setError(normalizeDesktopError(cause));
    } finally {
      setReviewApplying(false);
    }
  }, [afterGraphChange, clearReview, flowId, loadHistory, projectId, reviewPreview, reviewRevision, selectedReviewIds, showReview]);

  const declineReview = useCallback(async () => {
    if (!reviewId) return;
    setReviewApplying(true);
    setError(null);
    try {
      await intent().declineFlowReview(projectId, flowId, reviewId);
      clearReview();
      setReviewNotice('Review declined. The graph was not changed.');
    } catch (cause) {
      setError(normalizeDesktopError(cause));
    } finally {
      setReviewApplying(false);
    }
  }, [clearReview, flowId, projectId, reviewId]);

  const restoreDraft = useCallback(async (snapshotId: string) => {
    setRestoringId(snapshotId);
    try {
      const outcome = await run('restore-draft', () => intent().restoreFlowDraft(projectId, flowId, snapshotId));
      if (!outcome.ok) return false;
      await afterGraphChange('MANUAL_REFRESH');
      await loadHistory();
      return true;
    } finally {
      setRestoringId(null);
    }
  }, [afterGraphChange, flowId, loadHistory, projectId, run]);

  return {
    flow,
    loadError,
    error,
    clearError: () => setError(null),
    pendingAction,
    refreshFlow,
    addState,
    updateState,
    setInitialState,
    deleteState,
    addTransition,
    updateTransition,
    deleteTransition,
    updateFlow,
    publish,
    revise,
    deleteFlow,
    resolveAiDraft,
    suggestions: pendingSuggestions,
    suggestionMeta,
    suggestionsLoading,
    suggestionActionId,
    unappliableIds,
    refreshSuggestions: () => refreshSuggestions('MANUAL_REFRESH'),
    actOnSuggestion,
    review: {
      suggestions: reviewSuggestions,
      meta: reviewMeta,
      selectedIds: selectedReviewIds,
      preview: reviewPreview,
      loading: reviewLoading,
      previewLoading: reviewPreviewLoading,
      applying: reviewApplying,
      notice: reviewNotice,
      request: requestReview,
      toggle: toggleReviewSuggestion,
      apply: applyReview,
      decline: declineReview,
    },
    history,
    historyLoading,
    restoringId,
    loadHistory,
    restoreDraft,
  };
}
