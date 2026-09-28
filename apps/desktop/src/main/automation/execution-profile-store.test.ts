import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ExecutionProfile } from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import {
  approveStoredProfile, clearLoginConfig, deleteProfile, getLoginConfig, getProfile, isValidLoginRoute, listProfiles,
  profileStatus, saveLoginConfig, saveProfile,
} from "./execution-profile-store";
import type { KeyValueStore } from "./persona-store";

const APP_A = "11111111-1111-4111-8111-111111111111";
const APP_B = "22222222-2222-4222-8222-222222222222";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    read: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    write: (key, value) => { data.set(key, JSON.parse(JSON.stringify(value))); },
    list: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { data.delete(key); },
  };
}

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tellann-profile-"));
fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
const command = (args: string[] = ["run", "dev"]): LocalLaunchCommand => ({ id: "cmd-dev", label: "npm run dev", executable: "npm", args, cwd: ".", scriptName: "dev" }) as LocalLaunchCommand;

const profile = (over: Partial<ExecutionProfile> = {}): ExecutionProfile => ({
  id: "p1", applicationId: APP_A, name: "Dev server",
  processes: [{ name: "app", launchCommandId: "cmd-dev", readyCondition: { type: "HTTP", url: "http://localhost:5173" }, readyTimeoutMs: 60_000 }],
  applicationUrl: "http://localhost:5173", approvedHash: null, approvedAt: null, ...over,
});

test("profiles are stored per application and listed by name", () => {
  const store = memoryStore();
  saveProfile(profile({ id: "b", name: "Beta" }), store);
  saveProfile(profile({ id: "a", name: "Alpha" }), store);
  saveProfile(profile({ id: "c", applicationId: APP_B, name: "Other app" }), store);
  assert.deepEqual(listProfiles(APP_A, store).map((item) => item.name), ["Alpha", "Beta"]);
  assert.deepEqual(listProfiles(APP_B, store).map((item) => item.name), ["Other app"]);
  assert.equal(getProfile(APP_A, "a", store)?.name, "Alpha");
  assert.equal(getProfile(APP_B, "a", store), null, "another application cannot read it");
});

test("an invalid profile is refused, and a corrupt stored one is skipped rather than breaking the list", () => {
  const store = memoryStore();
  assert.throws(() => saveProfile(profile({ applicationUrl: "not a url" }), store));
  assert.throws(() => saveProfile(profile({ applicationUrl: "http://user:pw@localhost:5173" }), store), /applicationUrl/);
  saveProfile(profile({ id: "ok" }), store);
  store.data.set(`automation-profile:${APP_A}:broken`, { nonsense: true });
  assert.deepEqual(listProfiles(APP_A, store).map((item) => item.id), ["ok"]);
});

test("saving a profile never approves it, and approving is a separate act that stores what was approved", () => {
  const store = memoryStore();
  saveProfile(profile(), store);
  assert.equal(profileStatus(getProfile(APP_A, "p1", store)!, [command()], workspace), "NEEDS_APPROVAL");
  const approved = approveStoredProfile(APP_A, "p1", [command()], workspace, store, new Date("2026-01-01T00:00:00Z"));
  assert.ok(approved.approvedHash);
  assert.equal(approved.approvedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(profileStatus(getProfile(APP_A, "p1", store)!, [command()], workspace), "APPROVED");
});

test("what was approved stops being approved the moment what it would run changes", () => {
  const store = memoryStore();
  saveProfile(profile(), store);
  approveStoredProfile(APP_A, "p1", [command()], workspace, store);
  const stored = getProfile(APP_A, "p1", store)!;
  assert.equal(profileStatus(stored, [command(["run", "dev", "--host"])], workspace), "CHANGED", "the script now runs something else");
  const edited = saveProfile({ ...stored, applicationUrl: "http://localhost:9999" }, store);
  assert.equal(profileStatus(edited, [command()], workspace), "CHANGED", "so does editing where it waits");
  assert.equal(profileStatus(stored, [], workspace), "CHANGED", "and a command that has gone missing");
});

test("approving something that does not exist is refused", () => {
  assert.throws(() => approveStoredProfile(APP_A, "nope", [command()], workspace, memoryStore()), /EXECUTION_PROFILE_NOT_FOUND/);
});

test("a profile can be deleted", () => {
  const store = memoryStore();
  saveProfile(profile(), store);
  deleteProfile(APP_A, "p1", store);
  assert.deepEqual(listProfiles(APP_A, store), []);
});

test("the confirmed login route is stored once per application, and only if it looks like a route", () => {
  const store = memoryStore();
  assert.equal(getLoginConfig(APP_A, store), null);
  const saved = saveLoginConfig({ applicationId: APP_A, loginRoute: "  /login ", source: "CODE_PROPOSAL" }, store, new Date("2026-01-01T00:00:00Z"));
  assert.deepEqual(saved, { applicationId: APP_A, loginRoute: "/login", source: "CODE_PROPOSAL", confirmedAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(getLoginConfig(APP_A, store), saved);
  assert.equal(getLoginConfig(APP_B, store), null);
  clearLoginConfig(APP_A, store);
  assert.equal(getLoginConfig(APP_A, store), null);
});

test("a login route that is not a route on this application is refused", () => {
  for (const bad of ["login", "https://evil.example/login", "//evil.example", "/a/../b", "/x y", "", "/" + "a".repeat(400)]) {
    assert.equal(isValidLoginRoute(bad), false, bad);
    assert.throws(() => saveLoginConfig({ applicationId: APP_A, loginRoute: bad, source: "MANUAL" }, memoryStore()), /INVALID_LOGIN_ROUTE/, bad);
  }
  for (const good of ["/login", "/auth/sign-in", "/users/{param}/login", "/"]) assert.equal(isValidLoginRoute(good), true, good);
});

test("a stored login that has been tampered with into something invalid is ignored", () => {
  const store = memoryStore();
  store.data.set(`automation-login:${APP_A}`, { applicationId: APP_A, loginRoute: "https://evil.example", source: "MANUAL", confirmedAt: "x" });
  assert.equal(getLoginConfig(APP_A, store), null);
});
