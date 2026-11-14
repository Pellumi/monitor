import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Eye, EyeOff, Info, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { isSecretDataKey, parseDotenv } from "@tellann/flow-layout";
import type {
  AutomatedRunStatus,
  AutomationOptions,
  PersonaInput,
  PersonaView,
  RunDataSetInput,
  RunDataSetView,
  TerminalChoice,
} from "@tellann/desktop-contracts";
import type { AutomatedSelection, Blocker, DeclaredFlowLogin } from "./automation-shared";
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
  declaredLogin?: DeclaredFlowLogin | null;
  blockerActions?: Partial<Record<Blocker["fix"], { label: string; to: string }>>;
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
              <div className="automated-blocker-content">
                <span><strong>{blocker.title}.</strong> {blocker.message}</span>
                {props.blockerActions?.[blocker.fix] ? (
                  <Link className="button automated-blocker-action" to={props.blockerActions[blocker.fix]!.to}>
                    {props.blockerActions[blocker.fix]!.label}
                  </Link>
                ) : null}
              </div>
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
            options={[{ value: "", label: "No persona selected" }, ...(options?.personas ?? []).map((persona) => ({ value: persona.id, label: `${persona.name}${persona.roles.length ? ` · ${persona.roles.join(", ")}` : ""}` }))]}
          />
        </label>
        <label>
          Test data
          <SelectField
            value={selection.dataSetId}
            onValueChange={(dataSetId) => set({ dataSetId })}
            options={[{ value: "", label: "No data set selected" }, ...(options?.dataSets ?? []).map((set_) => ({ value: set_.id, label: set_.name }))]}
          />
        </label>
      </div>

      {options ? (
        <div className="automated-managers">
          <ProfileManager applicationId={props.applicationId} options={options} reload={props.reload} onCreated={(profileId) => set({ profileId })} />
          <PersonaManager applicationId={props.applicationId} personas={options.personas} reload={props.reload} onCreated={(personaId) => set({ personaId })} />
          <DataSetManager applicationId={props.applicationId} dataSets={options.dataSets} reload={props.reload} onCreated={(dataSetId) => set({ dataSetId })} />
          <LoginManager applicationId={props.applicationId} options={options} reload={props.reload} declaredLogin={props.declaredLogin} />
        </div>
      ) : (
        <p className="field-hint"><Loader2 size={12} className="spin" /> Reading what is saved for this application…</p>
      )}
    </div>
  );
}

// -- shared bits -----------------------------------------------------------------------------------------------------------

function Manager({ title, summary, defaultOpen = false, children }: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="automated-manager" open={defaultOpen || undefined}>
      <summary>
        <strong>{title}</strong>
        <span className="automated-manager-summary">{summary}<ChevronDown size={15} aria-hidden /></span>
      </summary>
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
  const [draft, setDraft] = useState<{ name: string; applicationUrl: string } | null>(null);
  const api = bridge()!;
  const saveDeployed = async () => {
    if (!draft) return;
    let savedId: string | null = null;
    const url = draft.applicationUrl.trim();
    const ok = await run(async () => {
      savedId = (await api.saveProfile({
        applicationId,
        name: draft.name.trim() || hostOfUrl(url),
        // Nothing to start: the application is already answering at this address.
        processes: [],
        applicationUrl: url,
      })).id;
    });
    if (ok) { setDraft(null); if (savedId) onCreated(savedId); }
  };
  return (
    <Manager title="How to start the application" summary={`${options.profiles.length} saved`}>
      <p className="field-hint">
        Tellann can start your application for you — and only with commands you have looked at and approved. Or, if it is
        already running, whether deployed somewhere or started by you in your own terminal, give Tellann the address and it
        will start nothing.
      </p>
      {options.profiles.map((profile) => (
        <div className="automated-row" key={profile.id}>
          <div>
            <strong>{profile.name}</strong> {profile.startsNothing ? <span className="automated-chip">Already running</span> : <StatusChip status={profile.status} />}
            {profile.startsNothing ? null : <code className="automated-commands">{profile.commands.join("  ·  ")}</code>}
            <small>
              {profile.startsNothing
                ? `Starts nothing. Waits for ${profile.applicationUrl} to answer, then drives it there.`
                : `Waits for ${profile.applicationUrl} to answer.`}
            </small>
          </div>
          <div className="inline-actions">
            {!profile.startsNothing && profile.status !== "APPROVED" ? (
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
      {draft ? (
        <div className="automated-editor">
          <div className="form-grid">
            <label>
              Address your application is running at
              <input
                aria-label="Address your application is running at"
                inputMode="url"
                placeholder="https://staging.example.com or http://localhost:5173"
                value={draft.applicationUrl}
                onChange={(event) => setDraft({ ...draft, applicationUrl: event.target.value })}
              />
            </label>
            <label>
              Name for this profile
              <input
                aria-label="Name for this profile"
                placeholder="Staging (optional)"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <p className="field-hint full">
              Tellann will not start or stop anything. It checks the address answers, then runs the Flow against it. Your
              folder is still needed, because Tellann reads your code to know which control performs each step.
            </p>
          </div>
          <div className="inline-actions">
            <button className="button primary" type="button" disabled={busy || !isLikelyUrl(draft.applicationUrl)} onClick={() => void saveDeployed()}>Save</button>
            <button className="button" type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="button" type="button" onClick={() => setDraft({ name: "", applicationUrl: "" })}>
          My application is already running
        </button>
      )}
      {options.profiles.length === 0 && options.proposedProfiles.length === 0 ? (
        <p className="field-hint">Nothing was found to suggest. Tellann looks for a dev or start script in your project and the address it serves on; if your application is deployed instead, add its address above.</p>
      ) : null}
      {error ? <p className="automated-error" role="alert">{error}</p> : null}
    </Manager>
  );
}

/**
 * An http(s) address without credentials in it. A local address is allowed: someone running their own dev server
 * and wanting Tellann only to drive it is as real a case as a deployed one.
 */
function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hostOfUrl(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

// -- personas ------------------------------------------------------------------------------------------------------------------

/** One cookie or storage entry of a supplied session. `stored` means a value is saved and need not be typed again. */
type SeedEntry = { name: string; value: string; stored: boolean };
type PersonaHow = "PASSWORD" | "MANUAL" | "SEEDED" | "API" | "GUEST";
type PersonaDraft = {
  id?: string; name: string; roles: string; how: PersonaHow;
  identity: string; secret: string; identityField: string;
  cookies: SeedEntry[]; storage: SeedEntry[];
  api: { url: string; body: string; tokenPath: string; targetKind: "LOCAL_STORAGE" | "COOKIE"; targetName: string };
};

const blankSeedEntry = (): SeedEntry => ({ name: "", value: "", stored: false });
const blankApi = () => ({ url: "/api/auth/login", body: '{"email":"{{email}}","password":"{{password}}"}', tokenPath: "token", targetKind: "LOCAL_STORAGE" as const, targetName: "auth.token" });
const blankPersona = (): PersonaDraft => ({
  name: "", roles: "", how: "PASSWORD", identity: "", secret: "", identityField: "email",
  cookies: [], storage: [], api: blankApi(),
});

/** What a persona's row says about how it gets in, in the words a person would use. */
function describePersonaSignIn(persona: PersonaView): string {
  if (!persona.authenticated) return "Does not sign in";
  switch (persona.authMethod) {
    case "MANUAL":
      return "You sign in yourself the first time; the session is kept after that";
    case "SEEDED": {
      const parts = [
        persona.sessionSeed?.cookies.length ? `${persona.sessionSeed.cookies.length} cookie${persona.sessionSeed.cookies.length === 1 ? "" : "s"}` : null,
        persona.sessionSeed?.storageKeys.length ? `${persona.sessionSeed.storageKeys.length} stored value${persona.sessionSeed.storageKeys.length === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? `Uses a session you supplied (${parts.join(", ")})` : "Uses a session you supply — none saved yet";
    }
    case "API":
      return persona.apiLogin ? `Fetches its session from ${persona.apiLogin.url}` : "Fetches its session from your application — no request saved yet";
    default:
      return `Signs in with a saved ${persona.credentialFields.join(" and ") || "login"}`;
  }
}

/**
 * A short list of named secrets — the cookies, or the storage entries, a supplied session is made of. An entry
 * whose value is already saved shows as saved and is left blank, so editing one never means pasting them all again.
 */
function SeedList({ label, hint, namePlaceholder, entries, onChange }: {
  label: string; hint: string; namePlaceholder: string;
  entries: SeedEntry[]; onChange(entries: SeedEntry[]): void;
}) {
  const patch = (index: number, change: Partial<SeedEntry>) =>
    onChange(entries.map((entry, position) => (position === index ? { ...entry, ...change } : entry)));
  return (
    <div className="full">
      <strong>{label}</strong>
      <p className="field-hint">{hint}</p>
      {entries.map((entry, index) => (
        <div className="automated-seed" key={index}>
          <input
            aria-label={`${label} name`}
            placeholder={namePlaceholder}
            value={entry.name}
            onChange={(event) => patch(index, { name: event.target.value })}
          />
          <input
            aria-label={`${label} value`}
            type="password"
            autoComplete="off"
            placeholder={entry.stored ? "Leave blank to keep the saved value" : "Value"}
            value={entry.value}
            onChange={(event) => patch(index, { value: event.target.value })}
          />
          <button
            className="button"
            type="button"
            aria-label={`Remove this ${label.toLowerCase()} entry`}
            onClick={() => onChange(entries.filter((_, position) => position !== index))}
          ><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="button" type="button" onClick={() => onChange([...entries, blankSeedEntry()])}>Add {label.toLowerCase()}</button>
    </div>
  );
}

function PersonaManager({ applicationId, personas, reload, onCreated }: { applicationId: string; personas: PersonaView[]; reload(): Promise<void>; onCreated(id: string): void }) {
  const { run, error, busy } = useAction(reload);
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const api = bridge()!;
  const edit = (persona: PersonaView) => {
    setPasswordVisible(false);
    setDraft({
      id: persona.id, name: persona.name, roles: persona.roles.join(", "), identity: "", secret: "",
      how: !persona.authenticated ? "GUEST" : persona.authMethod,
      identityField: persona.credentialFields.find((field) => field !== "password") ?? "email",
      // Names come back; values never do. An entry that already has one shows as saved and is left blank.
      cookies: (persona.sessionSeed?.cookies ?? []).map((name) => ({ name, value: "", stored: true })),
      storage: (persona.sessionSeed?.storageKeys ?? []).map((name) => ({ name, value: "", stored: true })),
      api: persona.apiLogin
        ? { ...blankApi(), url: persona.apiLogin.url, targetKind: persona.apiLogin.target.kind, targetName: persona.apiLogin.target.name }
        : blankApi(),
    });
  };
  const save = async () => {
    if (!draft) return;
    const entries = (list: SeedEntry[]) => list.filter((entry) => entry.name.trim().length > 0);
    const input: PersonaInput = {
      id: draft.id, applicationId, name: draft.name,
      roles: draft.roles.split(",").map((role) => role.trim()).filter(Boolean),
      authenticated: draft.how !== "GUEST",
      authMethod: draft.how === "GUEST" ? "PASSWORD" : draft.how,
      // An API sign-in posts the credentials rather than typing them, so it needs them stored just the same.
      credentials: draft.how === "PASSWORD" || draft.how === "API"
        ? [{ field: draft.identityField.trim() || "email", value: draft.identity }, { field: "password", value: draft.secret }]
        : [],
      ...(draft.how === "SEEDED"
        ? {
          sessionSeed: {
            cookies: entries(draft.cookies).map((entry) => ({ name: entry.name.trim(), value: entry.value })),
            storage: entries(draft.storage).map((entry) => ({ key: entry.name.trim(), value: entry.value })),
          },
        }
        : {}),
      ...(draft.how === "API"
        ? {
          apiLogin: {
            url: draft.api.url.trim(), body: draft.api.body, tokenPath: draft.api.tokenPath.trim(),
            target: { kind: draft.api.targetKind, name: draft.api.targetName.trim() },
          },
        }
        : {}),
    };
    let savedId: string | null = null;
    const ok = await run(async () => { savedId = (await api.savePersona(input)).id; });
    if (ok) { setDraft(null); setPasswordVisible(false); if (savedId && !draft.id) onCreated(savedId); }
  };
  return (
    <Manager title="Personas" summary={`${personas.length} saved`}>
      <p className="field-hint">A persona is who the run signs in as. Credentials stay on this computer, are typed only into your application's own sign-in form, and are never sent to Tellann or written into a report.</p>
      {personas.map((persona) => (
        <div className="automated-row" key={persona.id}>
          <div>
            <strong><UserRound size={13} /> {persona.name}</strong>
            <small>
              {describePersonaSignIn(persona)}
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
                  { value: "SEEDED", label: "I supply the session (cookies or a token)" },
                  { value: "API", label: "Fetch the session from my application" },
                  { value: "GUEST", label: "It does not sign in" },
                ]}
              />
            </label>
            {draft.how === "PASSWORD" || draft.how === "API" ? (
              <>
                <label>Email or username<input autoComplete="off" value={draft.identity} onChange={(event) => setDraft({ ...draft, identity: event.target.value })} placeholder={draft.id ? "Leave blank to keep the saved one" : ""} /></label>
                <label>
                  Password
                  <span className="password-input">
                    <input type={passwordVisible ? "text" : "password"} autoComplete="new-password" value={draft.secret} onChange={(event) => setDraft({ ...draft, secret: event.target.value })} placeholder={draft.id ? "Leave blank to keep the saved one" : ""} />
                    <button
                      type="button"
                      aria-label={passwordVisible ? "Hide password" : "Show password"}
                      aria-pressed={passwordVisible}
                      title={passwordVisible ? "Hide password" : "Show password"}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </span>
                </label>
              </>
            ) : null}
            {draft.how === "MANUAL" ? (
              <p className="field-hint full">When the run reaches the sign-in page, Tellann brings the browser forward and waits. Nothing you type is recorded, and Tellann never tries to get past a CAPTCHA. The session is kept afterwards, so you are asked once rather than once per run.</p>
            ) : null}
            {draft.how === "SEEDED" ? (
              <>
                <p className="field-hint full">
                  Give Tellann the session itself and no sign-in happens at all — which is how a Flow behind single sign-on runs with
                  nobody present. These values are as sensitive as a password: they stay on this computer, are never shown back, and
                  never appear in a report.
                </p>
                <SeedList
                  label="Cookies"
                  hint="The cookie your application reads to know who somebody is."
                  namePlaceholder="Name (e.g. session)"
                  entries={draft.cookies}
                  onChange={(cookies) => setDraft({ ...draft, cookies })}
                />
                <SeedList
                  label="Local storage"
                  hint="A token your application reads from local storage instead."
                  namePlaceholder="Key (e.g. auth.token)"
                  entries={draft.storage}
                  onChange={(storage) => setDraft({ ...draft, storage })}
                />
              </>
            ) : null}
            {draft.how === "API" ? (
              <>
                <p className="field-hint full">
                  Tellann posts the credentials above to your application, reads the token out of the answer, and puts it where your
                  application looks for it — the same thing your own test setup probably does. Nothing is typed into a page.
                </p>
                <label>Address<input aria-label="Sign-in request address" value={draft.api.url} onChange={(event) => setDraft({ ...draft, api: { ...draft.api, url: event.target.value } })} placeholder="/api/auth/login" /></label>
                <label>Where the token is in the answer<input aria-label="Where the token is in the answer" value={draft.api.tokenPath} onChange={(event) => setDraft({ ...draft, api: { ...draft.api, tokenPath: event.target.value } })} placeholder="data.accessToken" /></label>
                <label className="full">
                  What to post
                  <textarea
                    aria-label="What to post"
                    rows={3}
                    value={draft.api.body}
                    onChange={(event) => setDraft({ ...draft, api: { ...draft.api, body: event.target.value } })}
                  />
                  <span className="field-hint">{"{{email}}"} and {"{{password}}"} are replaced by the credentials above. Nothing else is sent.</span>
                </label>
                <label>
                  Where your application reads it
                  <SelectField
                    value={draft.api.targetKind}
                    onValueChange={(targetKind) => setDraft({ ...draft, api: { ...draft.api, targetKind: targetKind as "LOCAL_STORAGE" | "COOKIE" } })}
                    options={[{ value: "LOCAL_STORAGE", label: "Local storage" }, { value: "COOKIE", label: "A cookie" }]}
                  />
                </label>
                <label>Under what name<input aria-label="Under what name" value={draft.api.targetName} onChange={(event) => setDraft({ ...draft, api: { ...draft.api, targetName: event.target.value } })} placeholder="auth.token" /></label>
              </>
            ) : null}
          </div>
          <div className="inline-actions">
            <button className="button primary" type="button" disabled={busy || !draft.name.trim()} onClick={() => void save()}>Save persona</button>
            <button className="button" type="button" onClick={() => { setDraft(null); setPasswordVisible(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="button" type="button" onClick={() => { setPasswordVisible(false); setDraft(blankPersona()); }}>Add a persona</button>
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
  const hasName = Boolean(draft?.name.trim());
  const hasKeyedValue = Boolean(draft?.values.some((value) => value.key.trim()));
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
          <label>Name (required)<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Admin login data" /></label>
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
          {!hasName && hasKeyedValue ? (
            <div className="automated-notice" data-tone="problem" role="alert">
              <AlertTriangle size={18} aria-hidden />
              <div>
                <strong>These credentials are not saved yet.</strong>
                <p>Enter a name for this data set above, then choose Save data set. Tellann will select it for this run after it is saved.</p>
              </div>
            </div>
          ) : !hasName ? <p className="field-hint" role="status">Enter a name for this data set before saving.</p> : null}
          {hasName && !hasKeyedValue ? <p className="field-hint" role="status">Add at least one value with a key before saving.</p> : null}
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => setDraft({ ...draft, values: [...draft.values, blankValue()] })}>Add a value</button>
            <button className="button" type="button" onClick={() => { setEnvText(envText ?? ""); setEnvNote(null); }}>Paste a .env file</button>
            <button className="button primary" type="button" disabled={busy || !hasName || !hasKeyedValue} onClick={() => void save()}>Save data set</button>
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

function LoginManager({ applicationId, options, reload, declaredLogin }: { applicationId: string; options: AutomationOptions; reload(): Promise<void>; declaredLogin?: DeclaredFlowLogin | null }) {
  const { run, error, busy } = useAction(reload);
  const [typed, setTyped] = useState("");
  const api = bridge()!;
  const { login } = options;
  const effectiveRoute = login.route ?? declaredLogin?.route ?? null;
  return (
    <Manager title="Where is the sign-in page?" summary={effectiveRoute ? `${effectiveRoute}${!login.route ? " · from Flow" : ""}` : "Required — enter it below"} defaultOpen={!effectiveRoute}>
      <p className="field-hint">If the Flow starts with a sign-in, Tellann uses the page and fields declared by that Flow. Otherwise it proposes pages found in your code for you to confirm.</p>
      {declaredLogin ? <p className="field-hint"><strong>{declaredLogin.route}</strong> is declared as the initial sign-in page by the selected Flow, including its identity and password fields.</p> : null}
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

