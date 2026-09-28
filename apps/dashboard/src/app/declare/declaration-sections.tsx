"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import {
  CONTROL_ROLE_OPTIONS,
  ENVIRONMENT_OPTIONS,
  HTTP_METHOD_OPTIONS,
  INPUT_ROLE_OPTIONS,
  STEP_MODE_OPTIONS,
  requiresForm,
  requiresSpec,
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
} from "@tellann/flow-layout";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * What a person can declare about a flow so that Tellann does not have to guess: how to recognise a state, how a step is
 * done, what a run needs. The forms and what they save come from `@tellann/flow-layout`, shared with the desktop editor,
 * so both agree on what an empty field means. Every field is optional; what is written outranks what is worked out from
 * the code.
 */

const NONE = "__none__";
const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500";
const control =
  "w-full rounded-lg border border-[#262626] bg-black px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-white focus:outline-none disabled:opacity-60";
const mono = `${control} font-mono`;

function Section({
  title,
  hint,
  dirty,
  disabled,
  saving,
  onSave,
  children,
}: {
  title: string;
  hint: string;
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-[#262626] bg-[#0f0f0f] p-3">
      <div>
        <h3 className="text-xs font-bold text-white">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{hint}</p>
      </div>
      {children}
      {!disabled && (
        <Button size="sm" variant="primary" className="w-full" loading={saving} disabled={saving || !dirty} onClick={onSave}>
          Save
        </Button>
      )}
    </div>
  );
}

function Pick({
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="text-xs" disabled={disabled} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Published flows of the application that another flow could use as one of its states. */
function useReusableFlows(appId: string, flowId: string, enabled: boolean) {
  const { data } = useQuery<Array<{ id: string; name: string; lifecycleStatus?: string; publishedVersionId?: string | null }>>({
    queryKey: ["declared-flows", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api-gateway/v1/applications/${appId}/flows`);
      if (!res.ok) throw new Error("Failed to fetch declared flows");
      return res.json();
    },
    enabled: enabled && !!appId,
  });
  return (data ?? []).filter((flow) => flow.id !== flowId && flow.lifecycleStatus === "PUBLISHED" && Boolean(flow.publishedVersionId));
}

// ── state ───────────────────────────────────────────────────────────────────

export function StateDeclarationSection({
  appId,
  flowId,
  state,
  disabled,
  saving,
  onSave,
}: {
  appId: string;
  flowId: string;
  state: { recognizer?: unknown; subFlowId?: string | null; description?: string | null; actor?: string | null };
  disabled: boolean;
  saving: boolean;
  onSave: (spec: Record<string, unknown>) => void;
}) {
  const stored = stateDeclarationForm(state);
  const [form, setForm] = useState<StateDeclarationForm>(stored);
  useEffect(() => setForm(stateDeclarationForm(state)), [state]);
  const reusable = useReusableFlows(appId, flowId, !disabled);
  const set = (patch: Partial<StateDeclarationForm>) => setForm({ ...form, ...patch });
  const reused = reusable.find((flow) => flow.id === form.subFlowId);

  return (
    <Section
      title="How Tellann recognises this state"
      hint="Say how a run can tell the user is here. What you write outranks what Tellann works out from your code."
      dirty={!sameStateDeclaration(form, stored)}
      disabled={disabled}
      saving={saving}
      onSave={() => onSave(stateDeclarationSpec(form))}
    >
      <div>
        <label className={fieldLabel}>Route (one per line)</label>
        <Textarea rows={2} value={form.routes} disabled={disabled} spellCheck={false} placeholder="/courses/:id" onChange={(e) => set({ routes: e.target.value })} className={mono} />
      </div>
      <div>
        <label className={fieldLabel}>Heading shown on the page</label>
        <Textarea rows={2} value={form.headings} disabled={disabled} placeholder="My courses" onChange={(e) => set({ headings: e.target.value })} className={control} />
      </div>
      <div>
        <label className={fieldLabel}>Who is here</label>
        <Input value={form.actor} disabled={disabled} spellCheck={false} placeholder="GUEST, ADMIN" onChange={(e) => set({ actor: e.target.value })} className={control} />
      </div>
      <div>
        <label className={fieldLabel}>In your words</label>
        <Textarea rows={2} value={form.description} disabled={disabled} placeholder="What the user sees or is doing here" onChange={(e) => set({ description: e.target.value })} className={control} />
      </div>
      <div>
        <label className={fieldLabel}>Use another flow here</label>
        <Pick
          label="Reused flow"
          value={form.subFlowId || NONE}
          disabled={disabled}
          options={[{ value: NONE, label: "No, this is a single state" }, ...reusable.map((flow) => ({ value: flow.id, label: flow.name }))]}
          onChange={(value) => set({ subFlowId: value === NONE ? "" : value })}
        />
        {form.subFlowId ? (
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            {reused ? `“${reused.name}”` : "That flow"} is drawn once and reused. When this flow is published, this state is replaced by that flow&rsquo;s published steps,
            so it needs a start and a successful ending. Changing that flow later does not change this one until it is published again.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

// ── transition ──────────────────────────────────────────────────────────────

export function TransitionDeclarationSection({
  transition,
  actor,
  disabled,
  saving,
  onSave,
}: {
  transition: { control?: unknown; expectedInput?: unknown; expectedOutput?: unknown; mode?: string | null };
  actor?: string;
  disabled: boolean;
  saving: boolean;
  onSave: (spec: Record<string, unknown>) => void;
}) {
  const stored = transitionDeclarationForm(transition);
  const [form, setForm] = useState<TransitionDeclarationForm>(stored);
  useEffect(() => setForm(transitionDeclarationForm(transition)), [transition]);
  const set = (patch: Partial<TransitionDeclarationForm>) => setForm({ ...form, ...patch });
  const mode = STEP_MODE_OPTIONS.find((option) => option.value === form.mode)!;

  return (
    <Section
      title="How this step is done"
      hint="Say what the user operates and what goes in, so a run does not have to guess from the action's name."
      dirty={!sameTransitionDeclaration(form, stored)}
      disabled={disabled}
      saving={saving}
      onSave={() => onSave(transitionDeclarationSpec(form))}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={fieldLabel}>Control</label>
          <Pick
            label="Kind of control"
            value={form.controlRole || NONE}
            disabled={disabled}
            options={CONTROL_ROLE_OPTIONS.map((option) => ({ value: option.value || NONE, label: option.label }))}
            onChange={(value) => set({ controlRole: value === NONE ? "" : value })}
          />
        </div>
        <div>
          <label className={fieldLabel}>Text on it</label>
          <Input value={form.controlLabel} disabled={disabled} placeholder="Create a course" onChange={(e) => set({ controlLabel: e.target.value })} className={control} />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>Test id (data-testid)</label>
        <Input value={form.controlTestId} disabled={disabled} spellCheck={false} placeholder="create-course" onChange={(e) => set({ controlTestId: e.target.value })} className={mono} />
      </div>

      <div className="space-y-2">
        <label className={fieldLabel}>What goes in</label>
        {form.inputs.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              aria-label="Field"
              value={row.name}
              disabled={disabled}
              placeholder="email"
              onChange={(e) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, name: e.target.value } : item)) })}
              className={control}
            />
            <Input
              aria-label="Run data key"
              value={row.dataKey}
              disabled={disabled}
              spellCheck={false}
              placeholder={suggestDataKey(row.name, actor) || "KEY"}
              onChange={(e) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, dataKey: e.target.value } : item)) })}
              className={mono}
            />
            {!disabled && (
              <button type="button" aria-label="Remove input" className="text-neutral-500 hover:text-white" onClick={() => set({ inputs: form.inputs.filter((_, at) => at !== index) })}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="col-span-3">
              <Pick
                label="Where the value comes from"
                value={row.role}
                disabled={disabled}
                options={INPUT_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(role) => set({ inputs: form.inputs.map((item, at) => (at === index ? { ...item, role: role as InputRoleValue } : item)) })}
              />
            </div>
          </div>
        ))}
        {!disabled && (
          <Button size="sm" variant="secondary" onClick={() => set({ inputs: [...form.inputs, { name: "", dataKey: "", role: "GENERATED" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Add input
          </Button>
        )}
        {form.inputs.some((row) => row.role === "PROTECTED") && (
          <p className="text-[11px] leading-relaxed text-neutral-500">A secret is read from the run data or the persona, typed but never recorded, and never made up.</p>
        )}
      </div>

      <div className="space-y-2">
        <label className={fieldLabel}>What the application does</label>
        {form.effects.map((row, index) => (
          <div key={index} className="grid grid-cols-[88px_1fr_64px_auto] gap-2">
            <Pick
              label="Request method"
              value={row.method}
              disabled={disabled}
              options={HTTP_METHOD_OPTIONS.map((method) => ({ value: method, label: method }))}
              onChange={(method) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, method } : item)) })}
            />
            <Input
              aria-label="Request route"
              value={row.route}
              disabled={disabled}
              spellCheck={false}
              placeholder="/api/courses"
              onChange={(e) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, route: e.target.value } : item)) })}
              className={mono}
            />
            <Input
              aria-label="Expected status"
              value={row.status}
              disabled={disabled}
              inputMode="numeric"
              placeholder="201"
              onChange={(e) => set({ effects: form.effects.map((item, at) => (at === index ? { ...item, status: e.target.value.replace(/\D/g, "").slice(0, 3) } : item)) })}
              className={mono}
            />
            {!disabled && (
              <button type="button" aria-label="Remove effect" className="text-neutral-500 hover:text-white" onClick={() => set({ effects: form.effects.filter((_, at) => at !== index) })}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button size="sm" variant="secondary" onClick={() => set({ effects: [...form.effects, { method: "POST", route: "", status: "" }] })}>
            <Plus className="mr-1 h-3 w-3" /> Add request
          </Button>
        )}
        {form.effects.length > 0 && (
          <p className="text-[11px] leading-relaxed text-neutral-500">A run checks these after the step. One that does not show is reported; it does not stop the run.</p>
        )}
      </div>

      <div>
        <label className={fieldLabel}>Who does this step</label>
        <Pick
          label="Who does this step"
          value={form.mode}
          disabled={disabled}
          options={STEP_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(value) => set({ mode: value as TransitionDeclarationForm["mode"] })}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{mode.hint}</p>
      </div>
    </Section>
  );
}

// ── flow ────────────────────────────────────────────────────────────────────

export function RequiresSection({
  requires,
  disabled,
  saving,
  onSave,
}: {
  requires: unknown;
  disabled: boolean;
  saving: boolean;
  onSave: (requires: ReturnType<typeof requiresSpec>) => void;
}) {
  const stored = requiresForm(requires);
  const [form, setForm] = useState<RequiresForm>(stored);
  useEffect(() => setForm(requiresForm(requires)), [requires]);

  return (
    <Section
      title="What a run needs"
      hint="Shown before a run starts, and checked again when it does, so nobody finds out halfway through."
      dirty={!sameRequires(form, stored)}
      disabled={disabled}
      saving={saving}
      onSave={() => onSave(requiresSpec(form))}
    >
      <div>
        <label className={fieldLabel}>Signed in as</label>
        <Input value={form.actor} disabled={disabled} spellCheck={false} placeholder="ADMIN" onChange={(e) => setForm({ ...form, actor: e.target.value })} className={control} />
      </div>
      <fieldset>
        <legend className={fieldLabel}>May be run in</legend>
        <div className="flex gap-4">
          {ENVIRONMENT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                disabled={disabled}
                checked={form.environments.includes(option.value)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    environments: e.target.checked ? [...form.environments, option.value] : form.environments.filter((item) => item !== option.value),
                  })
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Leave both unticked to allow any environment automated runs are allowed in. Production is never run automatically.
        </p>
      </fieldset>
      <div>
        <label className={fieldLabel}>Run data it needs (one key per line)</label>
        <Textarea rows={2} value={form.data} disabled={disabled} spellCheck={false} placeholder="ADMIN_EMAIL" onChange={(e) => setForm({ ...form, data: e.target.value })} className={mono} />
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">The values a step types are added automatically; list only what you need beyond those.</p>
      </div>
    </Section>
  );
}
