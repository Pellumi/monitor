import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, Loader2, Play, ShieldCheck, Square, Trash2, UserRound } from "lucide-react";
import { isSecretDataKey, parseDotenv } from "@tellann/flow-layout";
import { describeExecutionPhase } from "./automation-shared";
import type {
  AutomatedRunStatus,
  AutomationOptions,
  PersonaInput,
  PersonaView,
  RunDataSetInput,
  RunDataSetView,
  TerminalChoice,
} from "@tellann/desktop-contracts";
import type { AutomatedSelection, Blocker } from "./automation-shared";
import { SelectField } from "./components/ui/select";

/**
 * The parts of the app that are only about Automated Run: choosing what a run is set up with, the things it is set up
 * from (how to start the application, who to be, what data to use, where the sign-in page is), and watching it go.
 *
 * Secrets go one way. A password or a token is typed here once and sent to the main process; after that this code
 * only ever sees that a value exists, never the value.
 */

const bridge = () => window.tellann?.automation;

// -- options and status ------------------------------------------------------------------------------------------------

export function useAutomationOptions(applicationId: string | undefined, enabled: boolean) {
  const [options, setOptions] = useState<AutomationOptions | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!applicationId || !enabled || !bridge()) return;
    try {
      setOptions(await bridge()!.getOptions(applicationId));
      setFailure(null);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+':\s*/i, "") : "Could not read the automation settings.");
    }
  }, [applicationId, enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { options, failure, reload };
}

export function useAutomatedRunStatus(): AutomatedRunStatus | null {
  const [status, setStatus] = useState<AutomatedRunStatus | null>(null);
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    let live = true;
    void api.getStatus().then((current) => { if (live) setStatus((existing) => existing ?? current); }).catch(() => undefined);
    const stop = api.onStatusChanged((next) => { if (live) setStatus(next); });
    return () => { live = false; stop(); };
  }, []);
  return status;
}

export function isAutomatedRunActive(status: AutomatedRunStatus | null): boolean {
  return status !== null && status.state !== "FINISHED";
}

// -- the setup panel ------------------------------------------------------------------------------------------------------

interface SetupProps {
  applicationId: string;
  options: AutomationOptions | null;
  loadFailure: string | null;
  blockers: Blocker[];
  terminals: TerminalChoice[];
  selection: AutomatedSelection;
  onSelection(next: AutomatedSelection): void;
  reload(): Promise<void>;
  onUseMode(mode: "GUIDED" | "ASSISTED"): void;
}

export function AutomatedRunSetup(props: SetupProps) {
  const { options, blockers, selection, terminals } = props;
  const set = (patch: Partial<AutomatedSelection>) => props.onSelection({ ...selection, ...patch });
  const notice = blockers.find((blocker) => blocker.tone === "notice");

  // A limit of ours is the only thing said when it applies: nothing else on the form would help.
  if (notice) {
    return (
      <div className="automated-setup">
        <div className="automated-notice" role="status">
          <Info size={18} />
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
            {notice.fix === "USE_ANOTHER_MODE" ? (
              <div className="inline-actions">
                <button className="button" type="button" onClick={() => props.onUseMode("GUIDED")}>Use Guided</button>
                <button className="button" type="button" onClick={() => props.onUseMode("ASSISTED")}>Use Assisted</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="automated-setup">
      {props.loadFailure ? <div className="infobar" data-tone="danger" role="alert"><AlertTriangle size={16} /><span>{props.loadFailure}</span></div> : null}
      {blockers.length > 0 ? (
        <ul className="automated-blockers" aria-label="What is needed before this can start">
          {blockers.map((blocker) => (
            <li key={blocker.code}>
              <AlertTriangle size={14} aria-hidden />
              <span><strong>{blocker.title}.</strong> {blocker.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="form-grid">
        <label className="full">
          Where should the run end?
          <SelectField
            value={selection.targetStateKey}
            onValueChange={(targetStateKey) => set({ targetStateKey })}
            placeholder="Choose an ending of the Flow"
            options={terminals.map((terminal) => ({ value: terminal.key, label: `${terminal.name}${terminal.kind ? ` (${terminal.kind.toLowerCase()})` : ""}` }))}
          />
          <span className="field-hint">Tellann performs each step of the Flow, in order, until it reaches this ending.</span>
        </label>

        <label className="full">
          How should Tellann start your application?
          <SelectField
            value={selection.profileId}
            onValueChange={(profileId) => set({ profileId })}
            placeholder="Choose a saved way of starting it"
            options={(options?.profiles ?? []).map((profile) => ({ value: profile.id, label: `${profile.name}${profile.status === "APPROVED" ? "" : profile.status === "CHANGED" ? " · changed, needs approval" : " · needs approval"}` }))}
          />
        </label>

        <label>
          Sign in as
          <SelectField
            value={selection.personaId}
            onValueChange={(personaId) => set({ personaId })}
            options={[{ value: "", label: "Nobody (the Flow needs no sign-in)" }, ...(options?.personas ?? []).map((persona) => ({ value: persona.id, label: `${persona.name}${persona.roles.length ? ` · ${persona.roles.join(", ")}` : ""}` }))]}
          />
        </label>
        <label>
          Test data
          <SelectField
            value={selection.dataSetId}
            onValueChange={(dataSetId) => set({ dataSetId })}
            options={[{ value: "", label: "None (the Flow types nothing)" }, ...(options?.dataSets ?? []).map((set_) => ({ value: set_.id, label: set_.name }))]}
          />
        </label>
      </div>

      {options ? (
        <div className="automated-managers">
          <ProfileManager applicationId={props.applicationId} options={options} reload={props.reload} onCreated={(profileId) => set({ profileId })} />
          <PersonaManager applicationId={props.applicationId} personas={options.personas} reload={props.reload} onCreated={(personaId) => set({ personaId })} />
          <DataSetManager applicationId={props.applicationId} dataSets={options.dataSets} reload={props.reload} onCreated={(dataSetId) => set({ dataSetId })} />
          <LoginManager applicationId={props.applicationId} options={options} reload={props.reload} />
        </div>
      ) : (
        <p className="field-hint"><Loader2 size={12} className="spin" /> Reading what is saved for this application…</p>
      )}
    </div>
  );
}

// -- shared bits -----------------------------------------------------------------------------------------------------------

function Manager({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <details className="automated-manager">
      <summary><strong>{title}</strong><span>{summary}</span></summary>
      <div className="automated-manager-body">{children}</div>
    </details>
  );
}

/** Runs a settings change and reports a failure in words instead of leaving a button that did nothing. */
function useAction(reload: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+':\s*/i, "") : "That did not work.";
      setError(describeSettingsError(message));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy };
}

const SETTINGS_ERRORS: Array<[RegExp, string]> = [
  [/LAUNCH_COMMAND_NOT_FOUND/, "That command is no longer in this application's folder. Refresh the folder and try again."],
  [/WORKSPACE_NOT_SELECTED/, "Connect the application's folder first."],
  [/INVALID_LOGIN_ROUTE/, "That is not an address on your application. It should start with a single / (for example /login)."],
  [/EXECUTION_PROFILE_NOT_FOUND/, "That way of starting the application is no longer saved."],
];
function describeSettingsError(message: string): string {
  return SETTINGS_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? message.slice(0, 200);
}

const StatusChip = ({ status }: { status: "APPROVED" | "NEEDS_APPROVAL" | "CHANGED" }) => (
  <span className="automated-chip" data-tone={status === "APPROVED" ? "ok" : "warn"}>
    {status === "APPROVED" ? "Approved" : status === "CHANGED" ? "Changed since approved" : "Not approved"}
  </span>
);

// -- profiles ----------------------------------------------------------------------------------------------------------------

function ProfileManager({ applicationId, options, reload, onCreated }: { applicationId: string; options: AutomationOptions; reload(): Promise<void>; onCreated(id: string): void }) {
  const { run, error, busy } = useAction(reload);
  const api = bridge()!;
  return (
    <Manager title="How to start the application" summary={`${options.profiles.length} saved`}>
      <p className="field-hint">
        Tellann starts your application for you, and only with commands you have looked at and approved. Changing what a profile runs takes its approval away until you approve again.
      </p>
      {options.profiles.map((profile) => (
        <div className="automated-row" key={profile.id}>
          <div>
            <strong>{profile.name}</strong> <StatusChip status={profile.status} />
            <code className="automated-commands">{profile.commands.join("  ·  ")}</code>
            <small>Waits for {profile.applicationUrl} to answer.</small>
          </div>
          <div className="inline-actions">
            {profile.status !== "APPROVED" ? (
              <button className="button primary" type="button" disabled={busy} onClick={() => void run(() => api.approveProfile(applicationId, profile.id))}>
                <ShieldCheck size={14} /> Approve these commands
              </button>
            ) : null}
            <button className="button" type="button" disabled={busy} aria-label={`Delete ${profile.name}`} onClick={() => void run(() => api.deleteProfile(applicationId, profile.id))}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {options.proposedProfiles.map((proposal) => (
        <div className="automated-row" key={proposal.profile.id}>
          <div>
            <strong>{proposal.profile.name}</strong> <span className="automated-chip">Suggested</span>
            <small>{proposal.rationale}</small>
          </div>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void run(async () => { const saved = await api.saveProfile(proposal.save); onCreated(saved.id); })}
          >Use this</button>
        </div>
      ))}
      {options.profiles.length === 0 && options.proposedProfiles.length === 0 ? (
        <p className="field-hint">Nothing was found to suggest. Tellann looks for a dev or start script in your project and the address it serves on; connect the folder and analyse it if you have not.</p>
      ) : null}
      {error ? <p className="automated-error" role="alert">{error}</p> : null}
    </Manager>
  );
}

// -- personas ------------------------------------------------------------------------------------------------------------------

type PersonaDraft = { id?: string; name: string; roles: string; how: "PASSWORD" | "MANUAL" | "GUEST"; identity: string; secret: string; identityField: string };
const blankPersona = (): PersonaDraft => ({ name: "", roles: "", how: "PASSWORD", identity: "", secret: "", identityField: "email" });

function PersonaManager({ applicationId, personas, reload, onCreated }: { applicationId: string; personas: PersonaView[]; reload(): Promise<void>; onCreated(id: string): void }) {
  const { run, error, busy } = useAction(reload);
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const api = bridge()!;
  const edit = (persona: PersonaView) => setDraft({
    id: persona.id, name: persona.name, roles: persona.roles.join(", "), identity: "", secret: "",
    how: !persona.authenticated ? "GUEST" : persona.authMethod === "MANUAL" ? "MANUAL" : "PASSWORD",
    identityField: persona.credentialFields.find((field) => field !== "password") ?? "email",
  });
  const save = async () => {
    if (!draft) return;
    const input: PersonaInput = {
      id: draft.id, applicationId, name: draft.name,
      roles: draft.roles.split(",").map((role) => role.trim()).filter(Boolean),
      authenticated: draft.how !== "GUEST",
      authMethod: draft.how === "MANUAL" ? "MANUAL" : "PASSWORD",
      credentials: draft.how === "PASSWORD"
        ? [{ field: draft.identityField.trim() || "email", value: draft.identity }, { field: "password", value: draft.secret }]
        : [],
    };
    let savedId: string | null = null;
    const ok = await run(async () => { savedId = (await api.savePersona(input)).id; });
    if (ok) { setDraft(null); if (savedId && !draft.id) onCreated(savedId); }
  };
  return (
    <Manager title="Personas" summary={`${personas.length} saved`}>
      <p className="field-hint">A persona is who the run signs in as. Credentials stay on this computer, are typed only into your application's own sign-in form, and are never sent to Tellann or written into a report.</p>
      {personas.map((persona) => (
        <div className="automated-row" key={persona.id}>
          <div>
            <strong><UserRound size={13} /> {persona.name}</strong>
            <small>
              {!persona.authenticated ? "Does not sign in" : persona.authMethod === "MANUAL" ? "You sign in yourself when asked" : `Signs in with a saved ${persona.credentialFields.join(" and ") || "login"}`}
              {persona.roles.length ? ` · ${persona.roles.join(", ")}` : ""}
            </small>
          </div>
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => edit(persona)}>Edit</button>
            <button className="button" type="button" disabled={busy} aria-label={`Delete ${persona.name}`} onClick={() => void run(() => api.deletePersona(applicationId, persona.id))}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {draft ? (
        <div className="automated-editor">
          <div className="form-grid">
            <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Teacher" /></label>
            <label>Roles (comma separated)<input value={draft.roles} onChange={(event) => setDraft({ ...draft, roles: event.target.value })} placeholder="TEACHER" /></label>
            <label className="full">
              How does this persona sign in?
              <SelectField
                value={draft.how}
                onValueChange={(how) => setDraft({ ...draft, how: how as PersonaDraft["how"] })}
                options={[
                  { value: "PASSWORD", label: "Email or username and password" },
                  { value: "MANUAL", label: "I sign in myself (single sign-on, a one-time code, a CAPTCHA…)" },
                  { value: "GUEST", label: "It does not sign in" },
                ]}
              />
            </label>
            {draft.how === "PASSWORD" ? (
              <>
                <label>Email or username<input autoComplete="off" value={draft.identity} onChange={(event) => setDraft({ ...draft, identity: event.target.value })} placeholder={draft.id ? "Leave blank to keep the saved one" : ""} /></label>
                <label>Password<input type="password" autoComplete="new-password" value={draft.secret} onChange={(event) => setDraft({ ...draft, secret: event.target.value })} placeholder={draft.id ? "Leave blank to keep the saved one" : ""} /></label>
              </>
            ) : null}
            {draft.how === "MANUAL" ? (
              <p className="field-hint full">When the run reaches the sign-in page, Tellann brings the browser forward and waits. Nothing you type is recorded. Tellann never tries to get past a CAPTCHA.</p>
            ) : null}
          </div>
          <div className="inline-actions">
            <button className="button primary" type="button" disabled={busy || !draft.name.trim()} onClick={() => void save()}>Save persona</button>
            <button className="button" type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="button" type="button" onClick={() => setDraft(blankPersona())}>Add a persona</button>
      )}
      {error ? <p className="automated-error" role="alert">{error}</p> : null}
    </Manager>
  );
}

// -- data sets --------------------------------------------------------------------------------------------------------------------

type ValueDraft = { key: string; secret: boolean; kind: "LITERAL" | "UNIQUE_SUFFIX" | "FUTURE_TIMESTAMP" | "FILE"; text: string; hours: string; format: "ISO" | "DATE" | "TIME" | "US" | "EU"; fileName: string; fileContent: string; stored: boolean };
type SetDraft = { id?: string; name: string; values: ValueDraft[] };
const blankValue = (): ValueDraft => ({ key: "", secret: false, kind: "LITERAL", text: "", hours: "48", format: "ISO", fileName: "", fileContent: "", stored: false });

function draftFromSet(set: RunDataSetView): SetDraft {
  return {
    id: set.id, name: set.name,
    values: set.values.map((value) => ({
      ...blankValue(), key: value.key, secret: value.secret, kind: value.kind, stored: value.hasStoredValue,
      // A secret or a file is never sent back, so what is shown is only that a value exists.
      text: value.kind === "LITERAL" || value.kind === "UNIQUE_SUFFIX" ? value.display ?? "" : "",
      fileName: value.kind === "FILE" ? value.display ?? "" : "",
    })),
  };
}

function inputFromDraft(applicationId: string, draft: SetDraft): RunDataSetInput {
  return {
    id: draft.id, applicationId, name: draft.name,
    values: draft.values.filter((value) => value.key.trim()).map((value) => ({
      key: value.key.trim(), secret: value.secret,
      generator:
        value.kind === "LITERAL" ? { kind: "LITERAL" as const, value: value.text }
        : value.kind === "UNIQUE_SUFFIX" ? { kind: "UNIQUE_SUFFIX" as const, prefix: value.text }
        : value.kind === "FUTURE_TIMESTAMP" ? { kind: "FUTURE_TIMESTAMP" as const, offsetMs: Math.max(1, Number(value.hours) || 1) * 3_600_000, format: value.format }
        : { kind: "FILE" as const, fileName: value.fileName || "upload.txt", content: value.fileContent },
    })),
  };
}

function DataSetManager({ applicationId, dataSets, reload, onCreated }: { applicationId: string; dataSets: RunDataSetView[]; reload(): Promise<void>; onCreated(id: string): void }) {
  const { run, error, busy } = useAction(reload);
  const [draft, setDraft] = useState<SetDraft | null>(null);
  const api = bridge()!;
  const patch = (index: number, change: Partial<ValueDraft>) => draft && setDraft({ ...draft, values: draft.values.map((value, position) => (position === index ? { ...value, ...change } : value)) });
  const save = async () => {
    if (!draft) return;
    let savedId: string | null = null;
    const ok = await run(async () => { savedId = (await api.saveDataSet(inputFromDraft(applicationId, draft))).id; });
    if (ok) { setDraft(null); if (savedId && !draft.id) onCreated(savedId); }
  };
  const readFile = (index: number, file: File | undefined) => {
    if (!file) return;
    if (file.size > 150_000) return;
    const reader = new FileReader();
    reader.onload = () => patch(index, { fileName: file.name, fileContent: String(reader.result ?? ""), stored: true });
    reader.readAsText(file);
  };
  // A pasted .env replaces the value of a key already in the set and adds the rest. Nothing leaves this computer.
  const [envText, setEnvText] = useState<string | null>(null);
  const [envNote, setEnvNote] = useState<string | null>(null);
  const importEnv = () => {
    if (!draft || envText === null) return;
    const { entries, skipped } = parseDotenv(envText);
    if (entries.length === 0) { setEnvNote(skipped > 0 ? "No KEY=value lines were found. Each line should look like ADMIN_PASSWORD=NewPassword." : "Paste at least one KEY=value line."); return; }
    const incoming = new Map(entries.map((entry) => [entry.key, entry.value]));
    const kept = draft.values.filter((value) => value.key.trim() && !incoming.has(value.key.trim()));
    const added = entries.map(({ key, value }): ValueDraft => ({ ...blankValue(), key, text: value, secret: isSecretDataKey(key) }));
    const values = [...kept, ...added];
    if (values.length > 50) { setEnvNote("A data set holds up to 50 values. Remove some, or split them across two sets."); return; }
    setDraft({ ...draft, values });
    setEnvText(null);
    setEnvNote(`Added ${entries.length} value${entries.length === 1 ? "" : "s"}${skipped > 0 ? `, skipped ${skipped} line${skipped === 1 ? "" : "s"} that were not KEY=value` : ""}. Review them, then save.`);
  };
  const readEnvFile = (file: File | undefined) => {
    if (!file || file.size > 150_000) return;
    const reader = new FileReader();
    reader.onload = () => { setEnvText(String(reader.result ?? "")); setEnvNote(null); };
    reader.readAsText(file);
  };
  return (
    <Manager title="Test data" summary={`${dataSets.length} saved`}>
      <p className="field-hint">The values a Flow's forms need. Each is matched to a form field by its key. Anything marked secret is typed but never shown, reported or kept in evidence. If the Flow lists names such as ADMIN_EMAIL and ADMIN_PASSWORD, add a data set and use Paste a .env file to fill them in.</p>
      {dataSets.map((set) => (
        <div className="automated-row" key={set.id}>
          <div><strong>{set.name}</strong><small>{set.values.map((value) => value.key).join(", ") || "No values"}</small></div>
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => setDraft(draftFromSet(set))}>Edit</button>
            <button className="button" type="button" disabled={busy} aria-label={`Delete ${set.name}`} onClick={() => void run(() => api.deleteDataSet(applicationId, set.id))}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {draft ? (
        <div className="automated-editor">
          <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Exam data" /></label>
          {draft.values.map((value, index) => (
            <div className="automated-value" key={index}>
              <input aria-label="Key" placeholder="Key (e.g. examTitle)" value={value.key} onChange={(event) => patch(index, { key: event.target.value })} />
              <SelectField
                value={value.kind}
                ariaLabel="Kind of value"
                onValueChange={(kind) => patch(index, { kind: kind as ValueDraft["kind"] })}
                options={[
                  { value: "LITERAL", label: "Fixed text" },
                  { value: "UNIQUE_SUFFIX", label: "Text, different every run" },
                  { value: "FUTURE_TIMESTAMP", label: "A date in the future" },
                  { value: "FILE", label: "A small text file to upload" },
                ]}
              />
              {value.kind === "LITERAL" ? <input aria-label="Value" type={value.secret ? "password" : "text"} autoComplete="off" placeholder={value.stored && value.secret ? "Leave blank to keep the saved value" : "Value"} value={value.text} onChange={(event) => patch(index, { text: event.target.value })} /> : null}
              {value.kind === "UNIQUE_SUFFIX" ? <input aria-label="Starts with" placeholder="Starts with (e.g. qa-exam-)" value={value.text} onChange={(event) => patch(index, { text: event.target.value })} /> : null}
              {value.kind === "FUTURE_TIMESTAMP" ? (
                <span className="automated-inline">
                  <input aria-label="Hours from now" inputMode="numeric" value={value.hours} onChange={(event) => patch(index, { hours: event.target.value })} /> hours from now, as
                  <SelectField value={value.format} ariaLabel="Format" onValueChange={(format) => patch(index, { format: format as ValueDraft["format"] })} options={[
                    { value: "ISO", label: "Date and time" }, { value: "DATE", label: "Date (2026-01-31)" }, { value: "TIME", label: "Time" }, { value: "US", label: "MM/DD/YYYY" }, { value: "EU", label: "DD/MM/YYYY" },
                  ]} />
                </span>
              ) : null}
              {value.kind === "FILE" ? (
                <span className="automated-inline">
                  <input aria-label="Choose a file" type="file" onChange={(event) => readFile(index, event.target.files?.[0])} />
                  <small>{value.fileName ? `${value.fileName}${value.fileContent ? "" : " (saved)"}` : "Up to 150 KB of text"}</small>
                </span>
              ) : null}
              {value.kind === "LITERAL" ? <label className="check-row automated-secret"><input type="checkbox" checked={value.secret} onChange={(event) => patch(index, { secret: event.target.checked })} /><span>Secret</span></label> : <span />}
              <button className="button" type="button" aria-label="Remove this value" onClick={() => setDraft({ ...draft, values: draft.values.filter((_, position) => position !== index) })}><Trash2 size={14} /></button>
            </div>
          ))}
          {envText !== null ? (
            <div className="automated-env">
              <label>Paste a .env file
                <textarea rows={5} spellCheck={false} autoComplete="off" value={envText} onChange={(event) => setEnvText(event.target.value)} placeholder={'ADMIN_EMAIL=admin@example.com\nADMIN_PASSWORD="NewPassword"'} />
              </label>
              <p className="field-hint">One KEY=value per line. Quotes are optional: ADMIN_PASSWORD=NewPassword and ADMIN_PASSWORD=&quot;NewPassword&quot; both work. Lines starting with # are ignored. Keys with PASSWORD, SECRET, TOKEN or KEY in the name are marked secret. Values are saved on this computer only, never sent to Tellann.</p>
              <div className="inline-actions">
                <button className="button primary" type="button" disabled={!envText.trim()} onClick={importEnv}>Add these values</button>
                <input aria-label="Choose a .env file" type="file" accept=".env,text/plain" onChange={(event) => readEnvFile(event.target.files?.[0])} />
                <button className="button" type="button" onClick={() => { setEnvText(null); setEnvNote(null); }}>Cancel</button>
              </div>
            </div>
          ) : null}
          {envNote ? <p className="field-hint" role="status">{envNote}</p> : null}
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => setDraft({ ...draft, values: [...draft.values, blankValue()] })}>Add a value</button>
            <button className="button" type="button" onClick={() => { setEnvText(envText ?? ""); setEnvNote(null); }}>Paste a .env file</button>
            <button className="button primary" type="button" disabled={busy || !draft.name.trim()} onClick={() => void save()}>Save data set</button>
            <button className="button" type="button" onClick={() => { setDraft(null); setEnvText(null); setEnvNote(null); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="button" type="button" onClick={() => setDraft({ name: "", values: [blankValue()] })}>Add a data set</button>
      )}
      {error ? <p className="automated-error" role="alert">{error}</p> : null}
    </Manager>
  );
}

// -- where the sign-in page is ---------------------------------------------------------------------------------------------------

function LoginManager({ applicationId, options, reload }: { applicationId: string; options: AutomationOptions; reload(): Promise<void> }) {
  const { run, error, busy } = useAction(reload);
  const [typed, setTyped] = useState("");
  const api = bridge()!;
  const { login } = options;
  return (
    <Manager title="Sign-in page" summary={login.route ? login.route : "not set"}>
      <p className="field-hint">If the Flow starts behind a sign-in, Tellann needs to know where that page is. It looks for one in your code and proposes it, but never assumes: you confirm it once.</p>
      {login.route ? (
        <div className="automated-row">
          <div><strong>{login.route}</strong><small>{login.source === "CODE_PROPOSAL" ? "Found in your code and confirmed by you" : "Entered by you"}</small></div>
          <button className="button" type="button" disabled={busy} onClick={() => void run(() => api.clearLogin(applicationId))}>Clear</button>
        </div>
      ) : null}
      {login.proposals.filter((proposal) => proposal.route !== login.route).map((proposal) => (
        <div className="automated-row" key={`${proposal.route}:${proposal.file}`}>
          <div><strong>{proposal.route}</strong><small>{proposal.rationale}</small></div>
          <button className="button" type="button" disabled={busy} onClick={() => void run(() => api.saveLogin(applicationId, proposal.route, "CODE_PROPOSAL"))}>Use this page</button>
        </div>
      ))}
      <div className="automated-inline">
        <input aria-label="Sign-in page address" placeholder="/login" value={typed} onChange={(event) => setTyped(event.target.value)} />
        <button className="button" type="button" disabled={busy || !typed.trim()} onClick={() => void run(async () => { await api.saveLogin(applicationId, typed.trim(), "MANUAL"); setTyped(""); })}>Save address</button>
      </div>
      {error ? <p className="automated-error" role="alert">{error}</p> : null}
    </Manager>
  );
}

// -- watching a run ---------------------------------------------------------------------------------------------------------------

export function AutomatedRunLive({ status }: { status: AutomatedRunStatus }) {
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLLIElement>(null);
  useEffect(() => { listEnd.current?.scrollIntoView?.({ block: "nearest" }); }, [status.events.length]);
  const api = bridge();
  const finished = status.state === "FINISHED";
  const act = async (action: () => Promise<unknown> | undefined) => {
    setBusy(true);
    try { await action(); } catch { /* the status stream shows what happened */ } finally { setBusy(false); }
  };
  return (
    <div className="automated-live">
      <section className="automated-live-head" aria-live="polite">
        {finished ? (
          status.outcome?.result === "COMPLETED" ? <CheckCircle2 className="automated-ok" /> : <Info />
        ) : status.state === "AWAITING_USER" ? <UserRound /> : <Loader2 className="spin" />}
        <div>
          <strong>{finished ? status.outcome?.title ?? "Finished" : status.phase ? describeExecutionPhase(status.phase) : "Working"}</strong>
          <small>
            {status.currentStateKey ? `In ${status.currentStateKey} · ` : ""}{status.steps} step{status.steps === 1 ? "" : "s"} · aiming for {status.targetStateKey}
          </small>
        </div>
        {!finished ? (
          <button className="button" type="button" disabled={busy || !api} onClick={() => void act(() => api?.cancel())}><Square size={14} /> Stop the run</button>
        ) : null}
      </section>

      {status.state === "AWAITING_USER" && status.awaitingUser ? (
        <section className="automated-handover" role="alert">
          <UserRound size={18} />
          <div>
            {status.awaitingUser.kind === "CONFIRM_STEP" ? (
              <>
                <strong>Approve this step</strong>
                <p>{status.awaitingUser.detail}</p>
                <p className="field-hint">The Flow marks this step as one a person approves first. Declining stops the run here; nothing further is done to your application.</p>
                <div className="automated-inline">
                  <button className="button primary" type="button" disabled={busy || !api} onClick={() => void act(() => api?.confirmSignedIn())}><Play size={14} /> Approve and continue</button>
                  <button className="button" type="button" disabled={busy || !api} onClick={() => void act(() => api?.cancel())}><Square size={14} /> Decline and stop</button>
                </div>
              </>
            ) : status.awaitingUser.kind === "MANUAL_STEP" ? (
              <>
                <strong>Tellann needs you to do a step</strong>
                <p>{status.awaitingUser.detail}</p>
                <p className="field-hint">The browser Tellann opened is in front of you. Nothing you type there is recorded. When you have done it, come back here and Tellann will check it worked and carry on.</p>
                <button className="button primary" type="button" disabled={busy || !api} onClick={() => void act(() => api?.confirmSignedIn())}><Play size={14} /> I have done it</button>
              </>
            ) : (
              <>
                <strong>Tellann needs you to sign in</strong>
                <p>{status.awaitingUser.detail}</p>
                <p className="field-hint">The browser Tellann opened is in front of you. Nothing you type there is recorded, and Tellann never tries to get past a CAPTCHA. When you are in, come back here.</p>
                <button className="button primary" type="button" disabled={busy || !api} onClick={() => void act(() => api?.confirmSignedIn())}><Play size={14} /> I have signed in</button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {finished && status.outcome ? (
        <section className="automated-outcome" data-tone={status.outcome.tone}>
          <p>{status.outcome.message}</p>
          {status.outcome.nextStep ? <p className="field-hint">{status.outcome.nextStep}</p> : null}
          {status.outcome.result !== "FAILED" ? <Link className="button primary" to={`/applications/${status.applicationId}/qa-runs/${status.runId}`}>Open the run</Link> : null}
        </section>
      ) : null}

      <ol className="automated-events" aria-label="What the run has done">
        {status.events.map((event, index) => (
          <li key={`${event.at}:${index}`} data-tone={event.tone}>
            <time>{new Date(event.at).toLocaleTimeString()}</time>
            <span>{event.text}</span>
          </li>
        ))}
        <li ref={listEnd} aria-hidden />
      </ol>
    </div>
  );
}
