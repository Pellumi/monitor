import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight, RefreshCw, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type { DeclaredStateSuggestion, FlowReviewPreview, FlowSuggestionMeta } from '@tellann/desktop-contracts';
import { SelectField } from '../components/ui/select';
import { confirmAction, formatEnum, statusTone } from '../components/desktop-ui';
import { stateRoleLabel } from './graph-elements';
import type {
  FlowDetail,
  FlowSettingsInput,
  FlowState,
  FlowTransition,
  StateInput,
  StateRole,
  TerminalKind,
} from './use-flow-editor';

export const STATE_CATEGORIES = [
  { value: 'BUSINESS', label: 'Business' },
  { value: 'UI', label: 'UI' },
  { value: 'NAVIGATION', label: 'Navigation' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'ERROR', label: 'Error' },
];
const STATE_ROLES = [
  { value: 'INITIAL', label: 'Initial' },
  { value: 'NORMAL', label: 'Intermediate' },
  { value: 'TERMINAL', label: 'Terminal' },
];
export const TERMINAL_KINDS = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure' },
  { value: 'CANCELLATION', label: 'Cancellation' },
  { value: 'ALTERNATE', label: 'Alternate completion' },
];
const WORKFLOW_TYPES = [
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'CHECKOUT', label: 'Checkout' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'ENROLLMENT', label: 'Enrollment' },
];
const FLOW_NAME_MAX = 20;
const FLOW_PURPOSE_MAX = 200;
const FLOW_SCOPE_MAX = 200;

export function StatusPill({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span className="status-pill" data-tone={tone ?? (typeof children === 'string' ? statusTone(children) : 'neutral')}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

function stateToInput(state: FlowState): StateInput {
  return {
    stateName: state.stateName,
    category: state.category || 'BUSINESS',
    role: (state.role as StateRole | undefined) ?? 'NORMAL',
    terminalKind: (state.terminalKind as TerminalKind | null | undefined) ?? 'SUCCESS',
  };
}

function sameState(a: StateInput, b: StateInput) {
  return a.stateName.trim() === b.stateName.trim()
    && a.category === b.category
    && a.role === b.role
    && (a.role !== 'TERMINAL' || a.terminalKind === b.terminalKind);
}

/** Name and role up front; category is behind More because most states are Business. */
function StateFields({
  value,
  disabled,
  nameInputId,
  autoFocus,
  onChange,
}: {
  value: StateInput;
  disabled: boolean;
  nameInputId?: string;
  autoFocus?: boolean;
  onChange(next: StateInput): void;
}) {
  return (
    <>
      <label className="flow-field">
        <span>Name</span>
        <input
          id={nameInputId}
          value={value.stateName}
          disabled={disabled}
          autoFocus={autoFocus}
          spellCheck={false}
          placeholder="e.g. PAYMENT_SUBMITTED"
          onChange={(event) => onChange({ ...value, stateName: event.target.value })}
        />
      </label>
      <div className="flow-field-row">
        <label className="flow-field">
          <span>Role</span>
          <SelectField
            ariaLabel="Role"
            value={value.role}
            disabled={disabled}
            options={STATE_ROLES}
            onValueChange={(role) => onChange({ ...value, role: role as StateRole })}
          />
        </label>
        {value.role === 'TERMINAL' ? (
          <label className="flow-field">
            <span>Outcome</span>
            <SelectField
              ariaLabel="Terminal outcome"
              value={value.terminalKind}
              disabled={disabled}
              options={TERMINAL_KINDS}
              onValueChange={(kind) => onChange({ ...value, terminalKind: kind as TerminalKind })}
            />
          </label>
        ) : null}
      </div>
      <details className="flow-more">
        <summary>
          <ChevronRight size={13} aria-hidden="true" />
          More
          <small>{formatEnum(value.category)}</small>
        </summary>
        <label className="flow-field">
          <span>Category</span>
          <SelectField
            ariaLabel="Category"
            value={value.category}
            disabled={disabled}
            options={STATE_CATEGORIES}
            onValueChange={(category) => onChange({ ...value, category })}
          />
        </label>
      </details>
    </>
  );
}

export function AddStateForm({
  stateCount,
  disabled,
  onAdd,
}: {
  stateCount: number;
  disabled: boolean;
  onAdd(input: StateInput): Promise<boolean>;
}) {
  // The first state of a flow is almost always where it starts.
  const defaultRole: StateRole = stateCount === 0 ? 'INITIAL' : 'NORMAL';
  const [value, setValue] = useState<StateInput>({
    stateName: '',
    category: 'BUSINESS',
    role: defaultRole,
    terminalKind: 'SUCCESS',
  });
  const [roleTouched, setRoleTouched] = useState(false);

  useEffect(() => {
    if (!roleTouched) setValue((current) => ({ ...current, role: defaultRole }));
  }, [defaultRole, roleTouched]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.stateName.trim()) return;
    if (await onAdd(value)) {
      setValue({ stateName: '', category: 'BUSINESS', role: 'NORMAL', terminalKind: 'SUCCESS' });
      setRoleTouched(false);
    }
  };

  return (
    <form className="flow-section" onSubmit={(event) => void submit(event)}>
      <h3 className="flow-section-title">Add state</h3>
      <StateFields
        value={value}
        disabled={disabled}
        onChange={(next) => {
          if (next.role !== value.role) setRoleTouched(true);
          setValue(next);
        }}
      />
      <button className="button primary" type="submit" disabled={disabled || !value.stateName.trim()}>
        Add state
      </button>
      <p className="flow-section-hint">Or double-click an empty spot on the canvas.</p>
    </form>
  );
}

export function AddTransitionForm({
  states,
  disabled,
  onAdd,
}: {
  states: FlowState[];
  disabled: boolean;
  onAdd(fromStateId: string, toStateId: string, action: string): Promise<boolean>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const options = states.map((state) => ({ value: state.id, label: state.stateName }));

  if (states.length < 2) {
    return (
      <section className="flow-section">
        <h3 className="flow-section-title">Connect states</h3>
        <p className="flow-section-hint">Add a second state, then drag from one state’s edge to another on the canvas.</p>
      </section>
    );
  }

  return (
    <form
      className="flow-section"
      onSubmit={(event) => {
        event.preventDefault();
        if (!from || !to || from === to) return;
        void onAdd(from, to, action).then((added) => {
          if (!added) return;
          setAction('');
          setTo('');
        });
      }}
    >
      <h3 className="flow-section-title">Connect states</h3>
      <div className="flow-field-row">
        <label className="flow-field">
          <span>From</span>
          <SelectField ariaLabel="From state" value={from} disabled={disabled} options={options} placeholder="Choose" onValueChange={setFrom} />
        </label>
        <label className="flow-field">
          <span>To</span>
          <SelectField ariaLabel="To state" value={to} disabled={disabled} options={options} placeholder="Choose" onValueChange={setTo} />
        </label>
      </div>
      <label className="flow-field">
        <span>Action (optional)</span>
        <input value={action} disabled={disabled} placeholder="e.g. submit payment" onChange={(event) => setAction(event.target.value)} />
      </label>
      <button className="button" type="submit" disabled={disabled || !from || !to || from === to}>
        Add transition
      </button>
    </form>
  );
}

export function StateList({
  states,
  selectedId,
  unreachableIds,
  onSelect,
}: {
  states: FlowState[];
  selectedId: string | null;
  unreachableIds: Set<string>;
  onSelect(stateId: string): void;
}) {
  if (!states.length) return null;
  return (
    <section className="flow-section">
      <h3 className="flow-section-title">
        States <small>{states.length}</small>
      </h3>
      <div className="flow-list" role="list">
        {states.map((state) => (
          <button
            key={state.id}
            type="button"
            role="listitem"
            aria-current={state.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(state.id)}
          >
            <span>{state.stateName}</span>
            <small data-warning={unreachableIds.has(state.id) ? 'true' : undefined}>
              {unreachableIds.has(state.id) ? 'Not reachable' : stateRoleLabel(state)}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function SelectedStateEditor({
  state,
  editable,
  connectedCount,
  onSave,
  onDelete,
  onClose,
}: {
  state: FlowState;
  editable: boolean;
  connectedCount: number;
  onSave(input: StateInput): Promise<boolean>;
  onDelete(): void;
  onClose(): void;
}) {
  const [value, setValue] = useState(() => stateToInput(state));
  useEffect(() => setValue(stateToInput(state)), [state]);
  const dirty = !sameState(value, stateToInput(state));

  return (
    <form
      className="flow-section"
      aria-label="Selected state"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && value.stateName.trim()) void onSave(value);
      }}
    >
      <h3 className="flow-section-title">
        Edit state
        <button type="button" className="flow-icon-button" onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={14} />
        </button>
      </h3>
      <StateFields value={value} disabled={!editable} nameInputId="flow-selected-state-name" onChange={setValue} />
      <p className="flow-section-hint">
        {connectedCount ? `${connectedCount} connected transition${connectedCount === 1 ? '' : 's'}` : 'Not connected yet'}
      </p>
      {editable ? (
        <div className="flow-actions">
          <button className="button primary" type="submit" disabled={!dirty || !value.stateName.trim()}>
            Save
          </button>
          <button className="button icon danger" type="button" title="Delete state (Delete)" aria-label="Delete state" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function SelectedTransitionEditor({
  transition,
  fromName,
  toName,
  editable,
  onSave,
  onDelete,
  onClose,
}: {
  transition: FlowTransition;
  fromName: string;
  toName: string;
  editable: boolean;
  onSave(action: string): Promise<boolean>;
  onDelete(): void;
  onClose(): void;
}) {
  const [action, setAction] = useState(transition.action ?? '');
  useEffect(() => setAction(transition.action ?? ''), [transition]);
  const dirty = action.trim() !== (transition.action ?? '').trim();

  return (
    <form
      className="flow-section"
      aria-label="Selected transition"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) void onSave(action);
      }}
    >
      <h3 className="flow-section-title">
        Edit transition
        <button type="button" className="flow-icon-button" onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={14} />
        </button>
      </h3>
      <p className="flow-transition-route">
        <span>{fromName}</span>
        <ArrowRight size={13} aria-hidden="true" />
        <span>{toName}</span>
      </p>
      <label className="flow-field">
        <span>Action (optional)</span>
        <input
          id="flow-selected-transition-action"
          value={action}
          disabled={!editable}
          placeholder="e.g. submit payment"
          onChange={(event) => setAction(event.target.value)}
        />
      </label>
      {editable ? (
        <div className="flow-actions">
          <button className="button primary" type="submit" disabled={!dirty}>
            Save
          </button>
          <button className="button icon danger" type="button" title="Delete transition (Delete)" aria-label="Delete transition" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
    </form>
  );
}

function suggestionSource(source: string | undefined) {
  if (source === 'AI') return 'AI-assisted';
  if (source === 'HYBRID') return 'Hybrid';
  return 'Rule-based';
}

export function SuggestionsPanel({
  editable,
  stateCount,
  suggestions,
  meta,
  loading,
  actionId,
  unappliableIds,
  onRefresh,
  onAct,
  review,
}: {
  editable: boolean;
  stateCount: number;
  suggestions: DeclaredStateSuggestion[];
  meta: FlowSuggestionMeta | null;
  loading: boolean;
  actionId: string | null;
  unappliableIds: Set<string>;
  onRefresh(): void;
  onAct(suggestionId: string, action: 'accept' | 'reject' | 'dismiss'): void;
  review: {
    suggestions: DeclaredStateSuggestion[];
    meta: FlowSuggestionMeta | null;
    selectedIds: Set<string>;
    preview: FlowReviewPreview | null;
    loading: boolean;
    previewLoading: boolean;
    applying: boolean;
    notice: string | null;
    request(): void;
    toggle(suggestionId: string): void;
    apply(): void;
    decline(): void;
  };
}) {
  const planNote = meta?.mode === 'RULE_ONLY' && !meta.aiAllowed
    ? 'Rule-guided. Local and Solo plans add AI analysis.'
    : meta?.mode === 'RULE_FALLBACK'
      ? 'AI was unavailable, so these come from the rules engine.'
      : null;
  const reviewBlocked = stateCount < 2;

  return (
    <>
      <section className="flow-section">
        <h3 className="flow-section-title">
          State suggestions
          <button
            type="button"
            className="flow-icon-button"
            onClick={onRefresh}
            disabled={loading || !editable}
            aria-label="Refresh suggestions"
            title="Refresh suggestions"
          >
            <RefreshCw size={14} className={loading ? 'spin' : undefined} />
          </button>
        </h3>
        {planNote ? <p className="flow-section-hint">{planNote}</p> : null}
        {suggestions.length ? (
          suggestions.map((suggestion) => {
            const states = suggestion.suggestedStatesJson?.length
              ? suggestion.suggestedStatesJson
              : [{ name: suggestion.suggestedStateName, category: suggestion.category }];
            const unappliable = unappliableIds.has(suggestion.id);
            const busy = actionId === suggestion.id;
            return (
              <article key={suggestion.id} className="flow-card" data-warning={unappliable ? 'true' : undefined}>
                <div className="flow-card-heading">
                  <strong>{suggestion.title || `Add ${suggestion.suggestedStateName}`}</strong>
                  <small>{suggestionSource(suggestion.source)} · {Math.round(suggestion.confidence * 100)}%</small>
                </div>
                <div className="flow-chips">
                  {states.map((state) => (
                    <span key={`${suggestion.id}-${state.name}`}>{state.name}</span>
                  ))}
                </div>
                {suggestion.suggestedTransitionsJson?.length ? (
                  <ul className="flow-patch-list">
                    {suggestion.suggestedTransitionsJson.map((edge, index) => (
                      <li key={`${suggestion.id}-edge-${index}`}>
                        {edge.from} <ArrowRight size={11} aria-hidden="true" /> {edge.to}
                        {edge.action ? ` · ${edge.action}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p>{suggestion.rationale}</p>
                {unappliable ? (
                  <p className="flow-status-line" data-tone="warning">No longer fits the current graph. Dismiss it or refresh.</p>
                ) : null}
                {editable ? (
                  <div className="flow-actions">
                    {!unappliable ? (
                      <>
                        <button className="button primary" type="button" disabled={busy} onClick={() => onAct(suggestion.id, 'accept')}>
                          <Check size={14} /> Accept
                        </button>
                        <button className="button" type="button" disabled={busy} onClick={() => onAct(suggestion.id, 'reject')}>
                          Decline
                        </button>
                      </>
                    ) : null}
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      title="Hide this suggestion from the queue"
                      onClick={() => onAct(suggestion.id, 'dismiss')}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="flow-empty-line">{loading ? 'Checking the flow for missing states…' : 'No suggestions right now.'}</p>
        )}
      </section>

      <section className="flow-section">
        <h3 className="flow-section-title">Whole-flow review</h3>
        <p className="flow-section-hint">
          Tellann checks purpose, scope, states and transitions together. Nothing changes until you apply the proposals you select.
        </p>
        <span className="flow-tooltip-wrap" title={reviewBlocked ? 'Add at least two states first' : undefined}>
          <button
            className="button"
            type="button"
            disabled={!editable || reviewBlocked || review.loading || review.applying}
            onClick={review.request}
          >
            {/* <Sparkles size={14} className={review.loading ? 'spin' : undefined} /> */}
            {review.loading ? 'Reviewing…' : review.suggestions.length ? 'Review again' : 'Review whole flow'}
          </button>
        </span>
        {review.meta?.stage === 'CONNECTION_REPAIR' && review.suggestions.length ? (
          <p className="flow-status-line" data-tone="warning">Connecting the existing states first; new states come after every state is reachable.</p>
        ) : null}
        {review.notice ? <p className="flow-status-line">{review.notice}</p> : null}
        {review.suggestions.length ? (
          <div className="flow-review-list">
            {review.suggestions.map((suggestion) => {
              const states = suggestion.suggestedStatesJson ?? [];
              const edges = suggestion.suggestedTransitionsJson ?? [];
              return (
                <label key={suggestion.id} className="flow-card flow-check" data-selected={review.selectedIds.has(suggestion.id) ? 'true' : undefined}>
                  <input
                    type="checkbox"
                    checked={review.selectedIds.has(suggestion.id)}
                    disabled={review.applying}
                    onChange={() => review.toggle(suggestion.id)}
                  />
                  <span>
                    <span className="flow-card-heading">
                      <strong>{suggestion.title || (states.length ? 'Missing state' : 'Missing transition')}</strong>
                      <small>{suggestionSource(suggestion.source)} · {Math.round(suggestion.confidence * 100)}%</small>
                    </span>
                    <ul className="flow-patch-list">
                      {states.map((state) => (
                        <li key={`${suggestion.id}-${state.name}`}>Add state {state.name}</li>
                      ))}
                      {edges.map((edge, index) => (
                        <li key={`${suggestion.id}-edge-${index}`}>
                          {edge.from} <ArrowRight size={11} aria-hidden="true" /> {edge.to}
                          {edge.action ? ` · ${edge.action}` : ''}
                        </li>
                      ))}
                    </ul>
                    <p>{suggestion.rationale}</p>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
        {review.selectedIds.size ? (
          <div className="flow-card">
            <div className="flow-card-heading">
              <strong>Preview of selected changes</strong>
              {review.previewLoading ? <small>Updating…</small> : (
                <StatusPill tone={review.preview?.validation.valid ? 'success' : 'warning'}>
                  {review.preview?.validation.valid ? 'Valid' : 'Needs attention'}
                </StatusPill>
              )}
            </div>
            {review.preview?.validation.issues.length ? (
              <ul className="flow-patch-list">
                {review.preview.validation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
            <p className="flow-status-line" data-tone="warning">
              <Sparkles size={13} aria-hidden="true" />
              Shown on the canvas in yellow until you apply them.
            </p>
          </div>
        ) : null}
        {review.suggestions.length ? (
          <div className="flow-actions">
            <button
              className="button primary"
              type="button"
              disabled={!review.selectedIds.size || review.previewLoading || review.applying || !review.preview?.validation.valid}
              onClick={review.apply}
            >
              {review.applying ? 'Applying…' : `Apply selected (${review.selectedIds.size})`}
            </button>
            <button className="button" type="button" disabled={review.applying} onClick={review.decline}>
              Decline
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} hr ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
}

export function HistoryPanel({
  history,
  loading,
  editable,
  restoringId,
  onLoad,
  onRestore,
}: {
  history: FlowDraftHistory | null;
  loading: boolean;
  editable: boolean;
  restoringId: string | null;
  onLoad(): void;
  onRestore(snapshotId: string): void;
}) {
  useEffect(() => {
    onLoad();
  }, [onLoad]);
  const snapshots = history?.snapshots ?? [];

  return (
    <section className="flow-section">
      <h3 className="flow-section-title">
        Draft history
        {history ? <small>v{history.version}</small> : null}
      </h3>
      <p className="flow-section-hint">
        Each accepted suggestion or restore saves a draft (d1, d2, …). Restoring rolls the graph back and saves the rollback as a new draft, so nothing is lost.
      </p>
      {loading && !snapshots.length ? (
        <div className="loading-skeleton" role="status" aria-label="Loading draft history">
          <div className="skeleton-block" />
        </div>
      ) : snapshots.length ? (
        snapshots.map((snapshot) => (
          <article key={snapshot.id} className="flow-card" data-selected={snapshot.isCurrent ? 'true' : undefined}>
            <div className="flow-card-heading">
              <strong>
                d{snapshot.draftSeq} · {snapshot.label ?? `Draft ${snapshot.draftSeq}`}
              </strong>
              {snapshot.isCurrent ? <StatusPill tone="success">Current</StatusPill> : <small>{formatRelativeTime(snapshot.createdAt)}</small>}
            </div>
            <p>
              {snapshot.stateCount} states · {snapshot.transitionCount} transitions
            </p>
            {editable && !snapshot.isCurrent ? (
              <button
                className="button"
                type="button"
                disabled={Boolean(restoringId)}
                onClick={() => {
                  void confirmAction({
                    title: 'Restore draft',
                    message: `Restore draft d${snapshot.draftSeq}?`,
                    detail: 'The graph rolls back to this draft. The rollback is saved as a new draft, so you can return to the current graph.',
                    confirmLabel: 'Restore',
                  }).then((confirmed) => {
                    if (confirmed) onRestore(snapshot.id);
                  });
                }}
              >
                <RotateCcw size={14} className={restoringId === snapshot.id ? 'spin' : undefined} />
                {restoringId === snapshot.id ? 'Restoring…' : 'Restore'}
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <p className="flow-empty-line">No drafts yet. Accepting a suggestion creates the first restore point.</p>
      )}
    </section>
  );
}

function settingsFromFlow(flow: FlowDetail): FlowSettingsInput {
  return {
    name: flow.name ?? '',
    purpose: flow.purpose ?? '',
    scopeStatement: flow.scopeStatement ?? '',
    workflowType: flow.workflowType ?? 'CUSTOM',
  };
}

export function SettingsPanel({
  flow,
  editable,
  onSave,
  onDelete,
}: {
  flow: FlowDetail;
  editable: boolean;
  onSave(input: FlowSettingsInput): Promise<boolean>;
  onDelete(): void;
}) {
  const [value, setValue] = useState(() => settingsFromFlow(flow));
  useEffect(() => setValue(settingsFromFlow(flow)), [flow]);
  const saved = settingsFromFlow(flow);
  const dirty = (Object.keys(value) as Array<keyof FlowSettingsInput>).some((key) => value[key].trim() !== saved[key].trim());

  return (
    <>
      <form
        className="flow-section"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && value.name.trim()) {
            void onSave({
              name: value.name.trim(),
              purpose: value.purpose.trim(),
              scopeStatement: value.scopeStatement.trim(),
              workflowType: value.workflowType,
            });
          }
        }}
      >
        <h3 className="flow-section-title">Flow settings</h3>
        <label className="flow-field">
          <span className="flow-field-meta">
            Name <small>{value.name.length}/{FLOW_NAME_MAX}</small>
          </span>
          <input
            value={value.name}
            disabled={!editable}
            maxLength={FLOW_NAME_MAX}
            onChange={(event) => setValue({ ...value, name: event.target.value.slice(0, FLOW_NAME_MAX) })}
          />
        </label>
        <label className="flow-field">
          <span>Workflow type</span>
          <SelectField
            ariaLabel="Workflow type"
            value={value.workflowType}
            disabled={!editable}
            options={WORKFLOW_TYPES}
            onValueChange={(workflowType) => setValue({ ...value, workflowType })}
          />
        </label>
        <label className="flow-field">
          <span className="flow-field-meta">
            Purpose <small>{value.purpose.length}/{FLOW_PURPOSE_MAX}</small>
          </span>
          <textarea
            rows={3}
            value={value.purpose}
            disabled={!editable}
            maxLength={FLOW_PURPOSE_MAX}
            placeholder="What should this capability achieve?"
            onChange={(event) => setValue({ ...value, purpose: event.target.value.slice(0, FLOW_PURPOSE_MAX) })}
          />
        </label>
        <label className="flow-field">
          <span className="flow-field-meta">
            Scope boundary <small>{value.scopeStatement.length}/{FLOW_SCOPE_MAX}</small>
          </span>
          <textarea
            id="flow-settings-scope"
            rows={3}
            value={value.scopeStatement}
            disabled={!editable}
            maxLength={FLOW_SCOPE_MAX}
            placeholder="e.g. Guest lands on the cart through order confirmation"
            onChange={(event) => setValue({ ...value, scopeStatement: event.target.value.slice(0, FLOW_SCOPE_MAX) })}
          />
        </label>
        <p className="flow-section-hint">
          Required before publishing. Keep each flow to one bounded capability, such as authentication, checkout, password reset or account deletion. A whole application declared as one flow reduces precision.
        </p>
        {editable ? (
          <button className="button primary" type="submit" disabled={!dirty || !value.name.trim()}>
            Save changes
          </button>
        ) : null}
      </form>

      <details className="flow-section flow-danger">
        <summary>
          <ChevronRight size={13} aria-hidden="true" />
          Danger zone
        </summary>
        <p className="flow-section-hint">
          Deleting this flow also removes its published versions and the QA runs, reports, bindings and scans recorded against it.
        </p>
        <button className="button danger" type="button" onClick={onDelete}>
          <Trash2 size={14} /> Delete flow…
        </button>
      </details>
    </>
  );
}

/**
 * Deleting a flow also removes the QA runs, reports, versions, bindings and
 * scans recorded against it, so the name has to be typed to confirm.
 */
export function DeleteFlowDialog({
  flowName,
  onCancel,
  onConfirm,
}: {
  flowName: string;
  onCancel(): void;
  onConfirm(): Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = `DELETE ${flowName}`;
  const canDelete = !deleting && typed.trim() === expected;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleting, onCancel]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (cause) {
      setError(
        String(cause instanceof Error ? cause.message : cause)
          .replace(/^Error invoking remote method '[^']+':\s*/i, '')
          .slice(0, 240) || 'The flow could not be deleted.',
      );
      setDeleting(false);
    }
  };

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onCancel();
      }}
    >
      <form
        className="desktop-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="flow-delete-title"
        aria-describedby="flow-delete-description"
        onSubmit={(event) => {
          event.preventDefault();
          if (canDelete) void confirm();
        }}
      >
        <h2 id="flow-delete-title">Delete “{flowName}”?</h2>
        <p id="flow-delete-description">
          This permanently deletes the flow, its published versions, and the QA runs, reconciliation reports, bindings and scans recorded against it. It cannot be undone. Your documents are kept.
        </p>
        <label className="flow-field">
          <span>
            Type <code className="mono">{expected}</code> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            disabled={deleting}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="flow-status-line" data-tone="danger">
            {error}
          </p>
        ) : null}
        <div className="desktop-modal-actions">
          <button type="button" disabled={deleting} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="confirm danger" disabled={!canDelete}>
            {deleting ? 'Deleting…' : 'Delete flow'}
          </button>
        </div>
      </form>
    </div>
  );
}
