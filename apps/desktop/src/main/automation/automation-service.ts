import crypto from "node:crypto";
import { assessAutomationSupport } from "@tellann/automation-engine";
import { buildLoginEdge, proposeLoginForms } from "@tellann/project-intelligence";
import {
  ExecutionProfileInputSchema,
  ExecutionProfileSchema,
  PersonaInputSchema,
  RunDataSetInputSchema,
  RunDataSetSchema,
  TestPersonaSchema,
} from "@tellann/desktop-contracts";
import type {
  AutomationOptions,
  PersonaInput,
  CodebaseAnalysis,
  ExecutionProfile,
  ExecutionProfileView,
  PersonaView,
  RunDataSet,
  RunDataSetView,
  TestPersona,
} from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import { getLoginConfig, getProfile, listProfiles, profileStatus, saveProfile } from "./execution-profile-store";
import { proposeExecutionProfiles, startsNothing } from "./execution-profile";
import { deletePersona, deleteRunDataSet, getPersona, getRunDataSet, listPersonas, listRunDataSets, savePersona, saveRunDataSet } from "./persona-store";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * What the renderer is allowed to know about the things a run is set up with, and how it changes them.
 *
 * Personas and data sets hold secrets (a password, a token, an uploaded file). They are written from the renderer once,
 * and after that they are only ever *described* to it: which fields have a value, never the value. Editing something
 * therefore cannot require typing a password again, and nothing the renderer holds can leak one.
 */

export function personaView(persona: TestPersona): PersonaView {
  return {
    id: persona.id,
    applicationId: persona.applicationId,
    name: persona.name,
    roles: persona.roles,
    authenticated: persona.authenticated,
    authMethod: persona.authMethod,
    credentialFields: persona.credentials.filter((credential) => credential.value.length > 0).map((credential) => credential.field),
    // Names only. A session cookie's value is exactly as sensitive as a password, so it is described, never shown.
    sessionSeed: persona.sessionSeed
      ? {
        cookies: persona.sessionSeed.cookies.filter((cookie) => cookie.value.length > 0).map((cookie) => cookie.name),
        storageKeys: persona.sessionSeed.storage.filter((entry) => entry.value.length > 0).map((entry) => entry.key),
      }
      : null,
    // Where it would ask and where it would put the answer. Never the body, which carries the credentials.
    apiLogin: persona.apiLogin ? { url: persona.apiLogin.url, target: persona.apiLogin.target } : null,
    updatedAt: persona.updatedAt,
  };
}

/**
 * A supplied session as it should be stored: a value left blank means "keep what is saved", the same rule a
 * blank password follows, so editing which cookie a session uses never means pasting every value again.
 */
function mergeSessionSeed(
  parsed: PersonaInput,
  existing: TestPersona | null,
): TestPersona["sessionSeed"] {
  if (parsed.authMethod !== "SEEDED") return null;
  if (parsed.sessionSeed === undefined) return existing?.sessionSeed ?? null;
  if (parsed.sessionSeed === null) return null;
  const cookies = new Map((existing?.sessionSeed?.cookies ?? []).map((cookie) => [cookie.name, cookie.value]));
  const storage = new Map((existing?.sessionSeed?.storage ?? []).map((entry) => [entry.key, entry.value]));
  return {
    cookies: parsed.sessionSeed.cookies
      .map((cookie) => ({ ...cookie, value: cookie.value.length > 0 ? cookie.value : cookies.get(cookie.name) ?? "" }))
      .filter((cookie) => cookie.value.length > 0),
    storage: parsed.sessionSeed.storage
      .map((entry) => ({ ...entry, value: entry.value.length > 0 ? entry.value : storage.get(entry.key) ?? "" }))
      .filter((entry) => entry.value.length > 0),
  };
}

/** Create or change a persona. An empty credential value on an existing persona keeps the stored one. */
export function savePersonaInput(input: unknown, store: KeyValueStore = localKeyValueStore, now: Date = new Date()): PersonaView {
  const parsed = PersonaInputSchema.parse(input);
  const existing = parsed.id ? getPersona(parsed.applicationId, parsed.id, store) : null;
  const stored = new Map((existing?.credentials ?? []).map((credential) => [credential.field, credential.value]));
  // Credentials are only ever typed into a form, or posted by an API sign-in. A persona that signs in by hand,
  // or whose session is handed over outright, has nothing to type and so has no business storing a password.
  const credentials = parsed.authMethod === "MANUAL" || parsed.authMethod === "SEEDED" || !parsed.authenticated
    ? []
    : parsed.credentials
        .map((credential) => ({ field: credential.field, value: credential.value.length > 0 ? credential.value : stored.get(credential.field) ?? "" }))
        .filter((credential) => credential.value.length > 0);
  const persona = TestPersonaSchema.parse({
    id: existing?.id ?? parsed.id ?? crypto.randomUUID(),
    applicationId: parsed.applicationId,
    name: parsed.name,
    roles: parsed.roles,
    authenticated: parsed.authenticated,
    authMethod: parsed.authMethod,
    credentials,
    sessionSeed: mergeSessionSeed(parsed, existing),
    // An API sign-in still needs its credentials, so they are kept above; only the request itself lives here.
    apiLogin: parsed.authMethod === "API" ? parsed.apiLogin ?? existing?.apiLogin ?? null : null,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  });
  savePersona(persona, store);
  return personaView(persona);
}

export function removePersona(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): void {
  deletePersona(applicationId, id, store);
}

const kindOf = (value: RunDataSet["values"][number]): RunDataSetView["values"][number]["kind"] => value.generator.kind;

function displayOf(value: RunDataSet["values"][number]): string | null {
  if (value.secret) return null;
  const generator = value.generator;
  switch (generator.kind) {
    case "LITERAL": return generator.value;
    case "UNIQUE_SUFFIX": return generator.prefix;
    case "FUTURE_TIMESTAMP": return `${Math.round(generator.offsetMs / 3_600_000)} h from now${generator.format ? ` (${generator.format})` : ""}`;
    case "FILE": return generator.fileName;
  }
}

export function dataSetView(dataSet: RunDataSet): RunDataSetView {
  return {
    id: dataSet.id,
    applicationId: dataSet.applicationId,
    name: dataSet.name,
    updatedAt: dataSet.updatedAt,
    values: dataSet.values.map((value) => ({
      key: value.key,
      secret: value.secret,
      kind: kindOf(value),
      display: displayOf(value),
      hasStoredValue: value.generator.kind === "LITERAL" ? value.generator.value.length > 0 : value.generator.kind === "FILE" ? value.generator.content.length > 0 : true,
    })),
  };
}

/** Create or change a data set. A secret literal, or a file, sent with no value on an existing set keeps what is stored under that key. */
export function saveDataSetInput(input: unknown, store: KeyValueStore = localKeyValueStore, now: Date = new Date()): RunDataSetView {
  const parsed = RunDataSetInputSchema.parse(input);
  const existing = parsed.id ? getRunDataSet(parsed.applicationId, parsed.id, store) : null;
  const before = new Map((existing?.values ?? []).map((value) => [value.key, value]));
  const values = parsed.values.map((value) => {
    const previous = before.get(value.key);
    if (value.generator.kind === "LITERAL" && value.generator.value.length === 0 && previous?.generator.kind === "LITERAL") {
      return { ...value, generator: previous.generator };
    }
    if (value.generator.kind === "FILE" && value.generator.content.length === 0 && previous?.generator.kind === "FILE") {
      return { ...value, generator: { ...value.generator, content: previous.generator.content, mimeType: value.generator.mimeType ?? previous.generator.mimeType } };
    }
    return value;
  });
  const dataSet = RunDataSetSchema.parse({
    id: existing?.id ?? parsed.id ?? crypto.randomUUID(),
    applicationId: parsed.applicationId,
    name: parsed.name,
    values,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  });
  saveRunDataSet(dataSet, store);
  return dataSetView(dataSet);
}

export function removeDataSet(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): void {
  deleteRunDataSet(applicationId, id, store);
}

// -- profiles ---------------------------------------------------------------------------------------

/** What a person is shown to decide whether to approve a profile: the exact commands it would run. */
export function profileView(profile: ExecutionProfile, commands: LocalLaunchCommand[], workspaceRoot: string): ExecutionProfileView {
  return {
    id: profile.id,
    name: profile.name,
    applicationUrl: profile.applicationUrl,
    commands: profile.processes.map((process) => {
      const command = commands.find((candidate) => candidate.id === process.launchCommandId);
      return command ? `${command.executable} ${command.args.join(" ")}`.trim() : `(${process.launchCommandId} is no longer in this workspace)`;
    }),
    startsNothing: startsNothing(profile),
    status: profileStatus(profile, commands, workspaceRoot),
    approvedAt: profile.approvedAt,
  };
}

/**
 * Create or change a profile. It can only name commands the connected folder really has, and it never carries an
 * approval: an edit leaves any earlier approval in place, where it stops matching and reads as "changed".
 */
export function saveProfileInput(input: unknown, commands: LocalLaunchCommand[], store: KeyValueStore = localKeyValueStore): ExecutionProfile {
  const parsed = ExecutionProfileInputSchema.parse(input);
  for (const process of parsed.processes) {
    if (!commands.some((command) => command.id === process.launchCommandId)) throw new Error("LAUNCH_COMMAND_NOT_FOUND");
  }
  const existing = parsed.id ? getProfile(parsed.applicationId, parsed.id, store) : null;
  return saveProfile(ExecutionProfileSchema.parse({
    id: existing?.id ?? parsed.id ?? crypto.randomUUID(),
    applicationId: parsed.applicationId,
    name: parsed.name,
    processes: parsed.processes,
    applicationUrl: parsed.applicationUrl,
    approvedHash: existing?.approvedHash ?? null,
    approvedAt: existing?.approvedAt ?? null,
  }), store);
}

/** The same way of starting the application: the same address, reached by the same commands in the same order. */
function sameProfileShape(a: ExecutionProfile, b: ExecutionProfile): boolean {
  return a.applicationUrl === b.applicationUrl
    && a.processes.length === b.processes.length
    && a.processes.every((process, index) => process.launchCommandId === b.processes[index]?.launchCommandId);
}

// -- everything the start form needs ------------------------------------------------------------------

export interface OptionsInput {
  applicationId: string;
  /** The connected folder, when there is one. */
  workspace: {
    root: string;
    launchCommands: LocalLaunchCommand[];
    suggestedApplicationUrls: Array<{ url: string; confidence: number; source: string }>;
    frameworks: string[];
  } | null;
  analysis: CodebaseAnalysis | null;
  /**
   * Whether that analysis still describes the folder on disk. Decided by whoever owns the analysis cache, which
   * is the only place that can answer it cheaply. Absent means the question was not asked, which is treated as
   * current rather than holding up a run over something unknown.
   */
  analysisCurrent?: boolean;
  store?: KeyValueStore;
}

export function automationOptions(input: OptionsInput): AutomationOptions {
  const store = input.store ?? localKeyValueStore;
  const { workspace } = input;
  const commands = workspace?.launchCommands ?? [];
  const root = workspace?.root ?? "";
  const profiles = listProfiles(input.applicationId, store);
  const support = workspace ? assessAutomationSupport(workspace.frameworks) : null;
  const login = getLoginConfig(input.applicationId, store);
  const analysisReady = Boolean(input.analysis && ["COMPLETED", "PARTIAL"].includes(input.analysis.status));
  return {
    support: support ? { level: support.level, canRun: support.canRun, title: support.title, message: support.message, alternatives: support.alternatives } : null,
    workspaceConnected: workspace !== null,
    analysisReady,
    analysisStale: analysisReady && input.analysisCurrent === false,
    profiles: profiles.map((profile) => profileView(profile, commands, root)),
    // Proposals stay on offer once a profile is saved: a developer who set up a local start command may
    // later want the deployed one too, and hiding it after the first save left no way to reach it.
    // What is filtered out is a proposal that is the same profile as one already saved.
    proposedProfiles: workspace
      ? proposeExecutionProfiles({ applicationId: input.applicationId, launchCommands: commands, suggestedApplicationUrls: workspace.suggestedApplicationUrls })
          .filter(({ profile }) => !profiles.some((saved) => sameProfileShape(saved, profile)))
          .map(({ profile, rationale }) => ({
            profile: profileView(profile, commands, root),
            rationale,
            // What saving it sends: the proposal itself, so accepting one is a click and not a form.
            save: { applicationId: profile.applicationId, name: profile.name, processes: profile.processes, applicationUrl: profile.applicationUrl },
          }))
      : [],
    personas: listPersonas(input.applicationId, store).map(personaView),
    dataSets: listRunDataSets(input.applicationId, store).map(dataSetView),
    login: {
      route: login?.loginRoute ?? null,
      source: login?.source ?? null,
      // Whether the confirmed route actually has a fillable form behind it. The same question the run asks when
      // it compiles its contract, asked here so the answer arrives before Start rather than after a browser opens.
      formFound: login && analysisReady ? buildLoginEdge(input.analysis!, login.loginRoute, "/") !== null : null,
      proposals: analysisReady ? proposeLoginForms(input.analysis!).slice(0, 5) : [],
    },
  };
}
