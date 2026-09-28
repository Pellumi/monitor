import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { SelectField } from '../components/ui/select';
import {
  CONTROL_ROLE_OPTIONS,
  ENVIRONMENT_OPTIONS,
  HTTP_METHOD_OPTIONS,
  INPUT_ROLE_OPTIONS,
  STEP_MODE_OPTIONS,
  requiresForm,
  requiresSpec,
  runDataHasValues,
  sameRequires,
  sameStateDeclaration,
  sameTransitionDeclaration,
  stateDeclarationForm,
  stateDeclarationSpec,
  suggestDataKey,
  transitionDeclarationForm,
  transitionDeclarationSpec,
  type InputRoleValue,
  type RequiresForm,
  type StateDeclarationForm,
  type TransitionDeclarationForm,
} from '@tellann/flow-layout';
import type { FlowDetail, FlowState, FlowTransition, ReusableFlow } from './use-flow-editor';

/**
 * What a person can declare about a flow so that Tellann does not have to guess: how to recognise a state, how a step is
 * done, what a run needs. Each section saves on its own, and every field is optional: what is left out is worked out from
 * the code as before, and what is written outranks that.
 */

const NONE = '__none__';

function DeclarationSection({
  title,
  hint,
  label,
  editable,
  dirty,
  onSubmit,
  children,
}: {
  title: string;
  hint: string;
  label: string;
  editable: boolean;
  dirty: boolean;
  onSubmit(): void;
  children: ReactNode;
}) {
  return (
    <form
      className="flow-section"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) onSubmit();
      }}
    >
      <h3 className="flow-section-title">{title}</h3>
      <p className="flow-section-hint">{hint}</p>
      {children}
      {editable ? (
        <div className="flow-actions">
          <button className="button primary" type="submit" disabled={!dirty}>
            Save
          </button>
        </div>
      ) : null}
    </form>
  );
}

// ── state ───────────────────────────────────────────────────────────────────

export function StateDeclarationEditor({
  state,
  editable,
  reusableFlows,
  onSave,
}: {
  state: FlowState;
  editable: boolean;
  reusableFlows: ReusableFlow[];
  onSave(spec: Record<string, unknown>): Promise<boolean>;
}) {
  const stored = stateDeclarationForm(state as never);
  const [form, setForm] = useState<StateDeclarationForm>(stored);
  useEffect(() => setForm(stateDeclarationForm(state as never)), [state]);
  const dirty = !sameStateDeclaration(form, stored);
  const set = (patch: Partial<StateDeclarationForm>) => setForm({ ...form, ...patch });
  const reused = reusableFlows.find((flow) => flow.id === form.subFlowId);

  return (
    <DeclarationSection
      title="How Tellann recognises this state"
      label="State recognition"
      hint="Say how a run can tell the user is here. What you write outranks what Tellann works out from your code."
      editable={editable}
      dirty={dirty}
      onSubmit={() => void onSave(stateDeclarationSpec(form))}
    >
      <label className="flow-field">
        <span>Route (one per line)</span>
        <textarea rows={2} value={form.routes} disabled={!editable} spellCheck={false} placeholder="/courses/:id" onChange={(event) => set({ routes: event.target.value })} />
      </label>
      <label className="flow-field">
        <span>Heading shown on the page</span>
        <textarea rows={2} value={form.headings} disabled={!editable} placeholder="My courses" onChange={(event) => set({ headings: event.target.value })} />
      </label>
      <div className="flow-field-row">
        <label className="flow-field">
          <span>Who is here</span>
          <input value={form.actor} disabled={!editable} spellCheck={false} placeholder="GUEST, ADMIN" onChange={(event) => set({ actor: event.target.value })} />
        </label>
      </div>
      <label className="flow-field">
        <span>In your words</span>
        <textarea rows={2} value={form.description} disabled={!editable} placeholder="What the user sees or is doing here" onChange={(event) => set({ description: event.target.value })} />
      </label>
      <label className="flow-field">
        <span>Use another flow here</span>
        <SelectField
          ariaLabel="Reused flow"
          value={form.subFlowId || NONE}
          disabled={!editable}
          options={[{ value: NONE, label: 'No, this is a single state' }, ...reusableFlows.map((flow) => ({ value: flow.id, label: flow.name }))]}
          onValueChange={(value) => set({ subFlowId: value === NONE ? '' : value })}
        />
      </label>
      {form.subFlowId ? (
        <p className="flow-section-hint">
          {reused ? `“${reused.name}”` : 'That flow'} is drawn once and reused. When this flow is published, this state is replaced by that flow&rsquo;s published steps, so
          it needs a start and a successful ending. Changing that flow later does not change this one until it is published again.
        </p>
      ) : null}
    </DeclarationSection>
  );
}

// ── transition ──────────────────────────────────────────────────────────────

export function TransitionDeclarationEditor({
  transition,
  actor,
  editable,
  onSave,
}: {
  transition: FlowTransition;
  /** Who signs in, for suggesting credential keys (`ADMIN_EMAIL`). */
  actor?: string;
  editable: boolean;
  onSave(spec: Record<string, unknown>): Promise<boolean>;
}) {
  const stored = transitionDeclarationForm(transition as never);
  const [form, setForm] = useState<TransitionDeclarationForm>(stored);
  useEffect(() => setForm(transitionDeclarationForm(transition as never)), [transition]);
  const dirty = !sameTransitionDeclaration(form, stored);
  const set = (patch: Partial<TransitionDeclarationForm>) => setForm({ ...form, ...patch });
  const mode = STEP_MODE_OPTIONS.find((option) => option.value === form.mode)!;

  return (
    <DeclarationSection
      title="How this step is done"
      label="Step details"
      hint="Say what the user operates and what goes in, so a run does not have to guess from the action's name."
      editable={editable}
      dirty={dirty}
      onSubmit={() => void onSave(transitionDeclarationSpec(form))}
    >
      <div className="flow-field-row">
        <label className="flow-field">
          <span>Control</span>
          <SelectField
            ariaLabel="Kind of control"
            value={form.controlRole || NONE}
            disabled={!editable}
            options={CONTROL_ROLE_OPTIONS.map((option) => ({ value: option.value || NONE, label: option.label }))}
            onValueChange={(value) => set({ controlRole: value === NONE ? '' : value })}
          />
        </label>
        <label className="flow-field">
          <span>Text on it</span>
          <input value={form.controlLabel} disabled={!editable} placeholder="Create a course" onChange={(event) => set({ controlLabel: event.target.value })} />
        </label>
      </div>
      <details className="flow-more" open={Boolean(form.controlTestId)}>
        <summary>More</summary>
        <label className="flow-field">
          <span>Test id (data-testid)</span>
          <input value={form.controlTestId} disabled={!editable} spellCheck={false} placeholder="create-course" onChange={(event) => set({ controlTestId: event.target.value })} />
        </label>
      </details>

      <div className="flow-rows" aria-label="Inputs">
        <span className="flow-rows-title">What goes in</span>
        {form.inputs.map((row, index) => (
          <div className="flow-row" key={index}>
            <input
              aria-label="Field"
              value={row.name}
              disabled={!editable}
              placeholder="email"
              onChange={(event) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, name: event.target.value } : item)) })}
            />
            <input
              aria-label="Run data key"
              value={row.dataKey}
              disabled={!editable}
              spellCheck={false}
              placeholder={suggestDataKey(row.name, actor) || 'KEY'}
              onChange={(event) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, dataKey: event.target.value } : item)) })}
            />
            <SelectField
              ariaLabel="Where the value comes from"
              value={row.role}
              disabled={!editable}
              options={INPUT_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              onValueChange={(role) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, role: role as InputRoleValue } : item)) })}
            />
            {editable ? (
              <button type="button" className="flow-icon-button" aria-label="Remove input" onClick={() => set({ inputs: form.inputs.filter((_, at) => at !== index) })}>
                <X size={13} />
              </button>
            ) : null}
          </div>
        ))}
        {editable ? (
          <button type="button" className="button" onClick={() => set({ inputs: [...form.inputs, { name: '', dataKey: '', role: 'GENERATED' }] })}>
            <Plus size={13} /> Add input
          </button>
        ) : null}
        {form.inputs.some((row) => row.role === 'PROTECTED') ? (
          <p className="flow-section-hint">A secret is read from the run data or the persona, typed but never recorded, and never made up.</p>
        ) : null}
      </div>

      <div className="flow-rows" aria-label="Effects">
        <span className="flow-rows-title">What the application does</span>
        {form.effects.map((row, index) => (
          <div className="flow-row" key={index}>
            <SelectField
              ariaLabel="Request method"
              value={row.method}
              disabled={!editable}
              options={HTTP_METHOD_OPTIONS.map((method) => ({ value: method, label: method }))}
              onValueChange={(method) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, method } : item)) })}
            />
            <input
              aria-label="Request route"
              value={row.route}
              disabled={!editable}
              spellCheck={false}
              placeholder="/api/courses"
              onChange={(event) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, route: event.target.value } : item)) })}
            />
            <input
              aria-label="Expected status"
              value={row.status}
              disabled={!editable}
              inputMode="numeric"
              placeholder="201"
              onChange={(event) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, status: event.target.value.replace(/\D/g, '').slice(0, 3) } : item)) })}
            />
            {editable ? (
              <button type="button" className="flow-icon-button" aria-label="Remove effect" onClick={() => set({ effects: form.effects.filter((_, at) => at !== index) })}>
                <X size={13} />
              </button>
            ) : null}
          </div>
        ))}
        {editable ? (
          <button type="button" className="button" onClick={() => set({ effects: [...form.effects, { method: 'POST', route: '', status: '' }] })}>
            <Plus size={13} /> Add request
          </button>
        ) : null}
        {form.effects.length ? (
          <p className="flow-section-hint">A run checks these after the step. One that does not show is reported; it does not stop the run.</p>
        ) : null}
      </div>

      <label className="flow-field">
        <span>Who does this step</span>
        <SelectField
          ariaLabel="Who does this step"
          value={form.mode}
          disabled={!editable}
          options={STEP_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onValueChange={(value) => set({ mode: value as TransitionDeclarationForm['mode'] })}
        />
      </label>
      <p className="flow-section-hint">{mode.hint}</p>
    </DeclarationSection>
  );
}

// ── flow ────────────────────────────────────────────────────────────────────

export function RequiresEditor({
  flow,
  editable,
  onSave,
}: {
  flow: FlowDetail;
  editable: boolean;
  onSave(requires: ReturnType<typeof requiresSpec>): Promise<boolean>;
}) {
  const stored = requiresForm((flow as { requires?: unknown }).requires);
  const [form, setForm] = useState<RequiresForm>(stored);
  useEffect(() => setForm(requiresForm((flow as { requires?: unknown }).requires)), [flow]);
  const dirty = !sameRequires(form, stored);

  return (
    <DeclarationSection
      title="What a run needs"
      label="Run requirements"
      hint="Shown before a run starts, and checked again when it does, so nobody finds out halfway through."
      editable={editable}
      dirty={dirty}
      onSubmit={() => void onSave(requiresSpec(form))}
    >
      <label className="flow-field">
        <span>Signed in as</span>
        <input value={form.actor} disabled={!editable} spellCheck={false} placeholder="ADMIN" onChange={(event) => setForm({ ...form, actor: event.target.value })} />
      </label>
      <fieldset className="flow-field flow-checks">
        <legend>May be run in</legend>
        {ENVIRONMENT_OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              disabled={!editable}
              checked={form.environments.includes(option.value)}
              onChange={(event) => setForm({
                ...form,
                environments: event.target.checked ? [...form.environments, option.value] : form.environments.filter((item) => item !== option.value),
              })}
            />
            {option.label}
          </label>
        ))}
        <small>Leave both unticked to allow any environment automated runs are allowed in. Production is never run automatically.</small>
      </fieldset>
      <label className="flow-field">
        <span>Run data it needs (names only, one per line)</span>
        <textarea rows={3} value={form.data} disabled={!editable} spellCheck={false} placeholder={'ADMIN_EMAIL\nADMIN_PASSWORD'} onChange={(event) => setForm({ ...form, data: event.target.value })} />
      </label>
      {runDataHasValues(form.data) ? (
        <p className="flow-section-hint is-warning" role="alert">
          Only the names are saved. This flow is stored on Tellann&apos;s servers, so a value such as a password is dropped when you save. Add the values under Test data instead.
        </p>
      ) : null}
      <p className="flow-section-hint">
        List what a run must have before it starts, such as ADMIN_EMAIL and ADMIN_PASSWORD. Do not put values here. When you start an automated run, add them under Test data, either by pasting a .env file (ADMIN_PASSWORD=NewPassword, or ADMIN_PASSWORD=&quot;NewPassword&quot;) or through a persona that stores the sign-in. They stay on this computer and are never sent to Tellann. The values a step types are added automatically; list only what you need beyond those.
      </p>
    </DeclarationSection>
  );
}
