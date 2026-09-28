import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { CodebaseAnalysis } from "@tellann/desktop-contracts";
import { AutomationOptionsSchema, PersonaViewSchema, RunDataSetViewSchema } from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import { automationOptions, dataSetView, saveDataSetInput, savePersonaInput } from "./automation-service";
import { approveStoredProfile, saveLoginConfig, saveProfile } from "./execution-profile-store";
import { getPersona, getRunDataSet } from "./persona-store";
import type { KeyValueStore } from "./persona-store";

const APP = "11111111-1111-4111-8111-111111111111";
const T1 = new Date("2026-01-01T00:00:00Z");
const T2 = new Date("2026-02-01T00:00:00Z");

function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>();
  return {
    read: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    write: (key, value) => { data.set(key, JSON.parse(JSON.stringify(value))); },
    list: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { data.delete(key); },
  };
}

const PASSWORD = "Sup3r-Secret-Pass!";

test("a persona is described to the renderer without a single stored value", () => {
  const store = memoryStore();
  const view = savePersonaInput({ applicationId: APP, name: "Teacher", roles: ["TEACHER"], authenticated: true, credentials: [{ field: "email", value: "t@lms.test" }, { field: "password", value: PASSWORD }] }, store, T1);
  assert.deepEqual(view.credentialFields, ["email", "password"]);
  assert.ok(PersonaViewSchema.safeParse(view).success);
  const serialised = JSON.stringify(view);
  assert.ok(!serialised.includes(PASSWORD) && !serialised.includes("t@lms.test"));
  assert.equal(getPersona(APP, view.id, store)!.credentials.find((c) => c.field === "password")!.value, PASSWORD, "and the real value is what is stored");
});

test("editing a persona without retyping the password keeps it, and typing a new one replaces it", () => {
  const store = memoryStore();
  const first = savePersonaInput({ applicationId: APP, name: "Teacher", roles: [], authenticated: true, credentials: [{ field: "email", value: "t@lms.test" }, { field: "password", value: PASSWORD }] }, store, T1);
  savePersonaInput({ id: first.id, applicationId: APP, name: "Head teacher", roles: ["TEACHER"], authenticated: true, credentials: [{ field: "email", value: "" }, { field: "password", value: "" }] }, store, T2);
  const kept = getPersona(APP, first.id, store)!;
  assert.equal(kept.name, "Head teacher");
  assert.equal(kept.credentials.find((c) => c.field === "password")!.value, PASSWORD);
  assert.equal(kept.createdAt, T1.toISOString());
  assert.equal(kept.updatedAt, T2.toISOString());
  savePersonaInput({ id: first.id, applicationId: APP, name: "Head teacher", roles: [], authenticated: true, credentials: [{ field: "password", value: "new-one" }] }, store, T2);
  assert.equal(getPersona(APP, first.id, store)!.credentials.find((c) => c.field === "password")!.value, "new-one");
});

test("a persona that signs in by hand, or never signs in, stores no credentials at all", () => {
  const store = memoryStore();
  const manual = savePersonaInput({ applicationId: APP, name: "SSO user", authenticated: true, authMethod: "MANUAL", credentials: [{ field: "password", value: PASSWORD }] }, store, T1);
  assert.deepEqual(getPersona(APP, manual.id, store)!.credentials, [], "nothing to type, so nothing is kept that could be typed by mistake");
  const guest = savePersonaInput({ applicationId: APP, name: "Guest", authenticated: false, credentials: [{ field: "password", value: PASSWORD }] }, store, T1);
  assert.deepEqual(getPersona(APP, guest.id, store)!.credentials, []);
  assert.throws(() => savePersonaInput({ applicationId: APP, name: "", authenticated: true }, store, T1));
});

test("a data set hides its secrets and its files, and keeps them when edited without them", () => {
  const store = memoryStore();
  const view = saveDataSetInput({
    applicationId: APP, name: "Exam data",
    values: [
      { key: "examTitle", secret: false, generator: { kind: "LITERAL", value: "Midterm" } },
      { key: "apiToken", secret: true, generator: { kind: "LITERAL", value: "tok_live_123" } },
      { key: "syllabus", secret: false, generator: { kind: "FILE", fileName: "syllabus.txt", content: "the whole syllabus" } },
      { key: "suffix", secret: false, generator: { kind: "UNIQUE_SUFFIX", prefix: "qa-" } },
    ],
  }, store, T1);
  assert.ok(RunDataSetViewSchema.safeParse(view).success);
  const serialised = JSON.stringify(view);
  assert.ok(!serialised.includes("tok_live_123") && !serialised.includes("the whole syllabus"));
  assert.deepEqual(view.values.map((v) => [v.key, v.display]), [["examTitle", "Midterm"], ["apiToken", null], ["syllabus", "syllabus.txt"], ["suffix", "qa-"]]);

  saveDataSetInput({
    id: view.id, applicationId: APP, name: "Exam data v2",
    values: [
      { key: "examTitle", secret: false, generator: { kind: "LITERAL", value: "Final" } },
      { key: "apiToken", secret: true, generator: { kind: "LITERAL", value: "" } },
      { key: "syllabus", secret: false, generator: { kind: "FILE", fileName: "syllabus.txt", content: "" } },
    ],
  }, store, T2);
  const stored = getRunDataSet(APP, view.id, store)!;
  const byKey = new Map(stored.values.map((value) => [value.key, value.generator]));
  assert.deepEqual(byKey.get("apiToken"), { kind: "LITERAL", value: "tok_live_123" });
  assert.equal((byKey.get("syllabus") as { content: string }).content, "the whole syllabus");
  assert.equal((byKey.get("examTitle") as { value: string }).value, "Final", "an ordinary value is simply replaced");
  assert.equal(stored.name, "Exam data v2");
  assert.equal(dataSetView(stored).values.find((v) => v.key === "apiToken")!.hasStoredValue, true);
});

test("duplicate keys in a data set are refused", () => {
  assert.throws(() => saveDataSetInput({ applicationId: APP, name: "d", values: [
    { key: "a", secret: false, generator: { kind: "LITERAL", value: "1" } }, { key: "a", secret: false, generator: { kind: "LITERAL", value: "2" } },
  ] }, memoryStore(), T1));
});

// -- the options a start form is built from ----------------------------------------------------------------

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-options-"));
fs.writeFileSync(path.join(workspaceRoot, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
const command = { id: "cmd-dev", label: "npm run dev", executable: "npm", args: ["run", "dev"], cwd: ".", scriptName: "dev" } as LocalLaunchCommand;
const workspace = (frameworks: string[]) => ({ root: workspaceRoot, launchCommands: [command], suggestedApplicationUrls: [{ url: "http://localhost:5173", confidence: 0.9, source: "vite config" }], frameworks });

const analysis = {
  id: "a", status: "COMPLETED", contentHash: "c".repeat(64), entities: [
    { id: "r", type: "ui_route", name: "/login", path: "src/Login.tsx", language: null, startLine: 1, endLine: null, evidence: [], confidence: 0.9, metadata: { route: "/login" } },
    { id: "f", type: "ui_form", name: "login", path: "src/Login.tsx", language: null, startLine: 1, endLine: null, evidence: [], confidence: 0.9, metadata: { hasPasswordField: true, fields: [{ name: "email", label: "Email" }, { name: "password", label: "Password" }] } },
  ], relationships: [],
} as unknown as CodebaseAnalysis;

test("before a folder is connected, nothing is claimed about the application", () => {
  const options = automationOptions({ applicationId: APP, workspace: null, analysis: null, store: memoryStore() });
  assert.ok(AutomationOptionsSchema.safeParse(options).success);
  assert.equal(options.support, null);
  assert.equal(options.workspaceConnected, false);
  assert.deepEqual(options.proposedProfiles, []);
});

test("an application built with a framework Automated Run cannot read is said so, kindly, before anything else", () => {
  const options = automationOptions({ applicationId: APP, workspace: workspace(["vue"]), analysis: null, store: memoryStore() });
  assert.equal(options.support!.canRun, false);
  assert.equal(options.support!.level, "NOT_YET_SUPPORTED");
  assert.match(options.support!.message, /coming soon/);
  assert.deepEqual(options.support!.alternatives, ["GUIDED", "ASSISTED"]);
});

test("with no saved profile the scan's suggestion is offered, unapproved, and saving it never approves it", () => {
  const store = memoryStore();
  const first = automationOptions({ applicationId: APP, workspace: workspace(["react", "vite"]), analysis, store });
  assert.equal(first.profiles.length, 0);
  assert.equal(first.proposedProfiles.length, 1);
  assert.deepEqual(first.proposedProfiles[0]!.profile.commands, ["npm run dev"]);
  assert.equal(first.proposedProfiles[0]!.profile.status, "NEEDS_APPROVAL");
  assert.equal(first.support!.canRun, true);
  assert.equal(first.analysisReady, true);

  saveProfile({
    id: "p1", applicationId: APP, name: "Dev server", applicationUrl: "http://localhost:5173", approvedHash: null, approvedAt: null,
    processes: [{ name: "app", launchCommandId: "cmd-dev", readyCondition: { type: "HTTP", url: "http://localhost:5173" }, readyTimeoutMs: 60_000 }],
  }, store);
  const saved = automationOptions({ applicationId: APP, workspace: workspace(["react"]), analysis, store });
  assert.equal(saved.profiles[0]!.status, "NEEDS_APPROVAL");
  assert.deepEqual(saved.proposedProfiles, [], "a saved profile replaces the suggestion");

  approveStoredProfile(APP, "p1", [command], workspaceRoot, store);
  assert.equal(automationOptions({ applicationId: APP, workspace: workspace(["react"]), analysis, store }).profiles[0]!.status, "APPROVED");
  const changed = { ...command, args: ["run", "dev", "--host"] } as LocalLaunchCommand;
  assert.equal(automationOptions({ applicationId: APP, workspace: { ...workspace(["react"]), launchCommands: [changed] }, analysis, store }).profiles[0]!.status, "CHANGED");
});

test("sign-in forms the code contains are proposed, and the one a person confirmed is the one used", () => {
  const store = memoryStore();
  const before = automationOptions({ applicationId: APP, workspace: workspace(["react"]), analysis, store });
  assert.equal(before.login.route, null);
  assert.deepEqual(before.login.proposals.map((proposal) => proposal.route), ["/login"]);
  saveLoginConfig({ applicationId: APP, loginRoute: "/login", source: "CODE_PROPOSAL" }, store);
  const after = automationOptions({ applicationId: APP, workspace: workspace(["react"]), analysis, store });
  assert.equal(after.login.route, "/login");
  assert.equal(after.login.source, "CODE_PROPOSAL");
});

test("no analysis means no login proposals and says the analysis is not ready", () => {
  const options = automationOptions({ applicationId: APP, workspace: workspace(["react"]), analysis: null, store: memoryStore() });
  assert.equal(options.analysisReady, false);
  assert.deepEqual(options.login.proposals, []);
});
