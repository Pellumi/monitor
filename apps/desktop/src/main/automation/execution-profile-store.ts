import { ExecutionProfileSchema } from "@tellann/desktop-contracts";
import type { ExecutionProfile } from "@tellann/desktop-contracts";
import type { LocalLaunchCommand } from "../application-launcher";
import { approveProfile, isProfileApproved } from "./execution-profile";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * Storage for execution profiles and for the login a person has confirmed, both local to this machine.
 *
 * A profile is *how to start the application*: a definition of what will be run on this computer. It lives here,
 * beside the persona and run-data stores, and never goes to the platform. Approval is part of it: saving a profile
 * never approves it (an edit clears the approval by changing what the hash covers), and approving is a separate,
 * explicit act that records what the person was shown.
 */

const PROFILE_PREFIX = "automation-profile:";
const LOGIN_PREFIX = "automation-login:";

const profileKey = (applicationId: string, id: string) => `${PROFILE_PREFIX}${applicationId}:${id}`;
const loginKey = (applicationId: string) => `${LOGIN_PREFIX}${applicationId}`;

export function listProfiles(applicationId: string, store: KeyValueStore = localKeyValueStore): ExecutionProfile[] {
  return store
    .list(`${PROFILE_PREFIX}${applicationId}:`)
    .flatMap((key) => {
      const parsed = ExecutionProfileSchema.safeParse(store.read(key));
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getProfile(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): ExecutionProfile | null {
  const parsed = ExecutionProfileSchema.safeParse(store.read(profileKey(applicationId, id)));
  return parsed.success ? parsed.data : null;
}

/**
 * Save a profile as written. An edit to a profile that was approved keeps its old approval hash on purpose:
 * the hash no longer matches what the profile would run, so it reads as unapproved until it is approved again.
 */
export function saveProfile(profile: ExecutionProfile, store: KeyValueStore = localKeyValueStore): ExecutionProfile {
  const valid = ExecutionProfileSchema.parse(profile);
  store.write(profileKey(valid.applicationId, valid.id), valid);
  return valid;
}

export function deleteProfile(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): void {
  store.delete(profileKey(applicationId, id));
}

/** Approve a stored profile against what its commands resolve to right now, and store the approval. */
export function approveStoredProfile(
  applicationId: string,
  id: string,
  commands: LocalLaunchCommand[],
  workspaceRoot: string,
  store: KeyValueStore = localKeyValueStore,
  now: Date = new Date(),
): ExecutionProfile {
  const profile = getProfile(applicationId, id, store);
  if (!profile) throw new Error("EXECUTION_PROFILE_NOT_FOUND");
  const approved = approveProfile(profile, commands, workspaceRoot, now);
  store.write(profileKey(applicationId, id), approved);
  return approved;
}

export function profileStatus(profile: ExecutionProfile, commands: LocalLaunchCommand[], workspaceRoot: string): "APPROVED" | "NEEDS_APPROVAL" | "CHANGED" {
  if (isProfileApproved(profile, commands, workspaceRoot)) return "APPROVED";
  // An approval that exists but no longer matches is a different situation from one never given: something changed.
  return profile.approvedHash ? "CHANGED" : "NEEDS_APPROVAL";
}

// -- the login a person has confirmed ----------------------------------------

/**
 * Where the application's sign-in page is. Never derived silently: the code can propose a form (see
 * `proposeLoginForms`), and this records the answer once a person has said which one is right, or typed the route.
 */
export interface LoginConfig {
  applicationId: string;
  /** The route the sign-in page is served at, e.g. `/login`. A pattern, as routes are elsewhere. */
  loginRoute: string;
  source: "CODE_PROPOSAL" | "MANUAL";
  confirmedAt: string;
}

const ROUTE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/{}]*$/;

export function isValidLoginRoute(route: string): boolean {
  return route.length <= 300 && ROUTE.test(route) && !route.includes("//") && !route.includes("..");
}

export function getLoginConfig(applicationId: string, store: KeyValueStore = localKeyValueStore): LoginConfig | null {
  const config = store.read<LoginConfig>(loginKey(applicationId));
  return config && typeof config.loginRoute === "string" && isValidLoginRoute(config.loginRoute) ? config : null;
}

export function saveLoginConfig(
  input: { applicationId: string; loginRoute: string; source: LoginConfig["source"] },
  store: KeyValueStore = localKeyValueStore,
  now: Date = new Date(),
): LoginConfig {
  const loginRoute = input.loginRoute.trim();
  if (!isValidLoginRoute(loginRoute)) throw new Error("INVALID_LOGIN_ROUTE");
  const config: LoginConfig = { applicationId: input.applicationId, loginRoute, source: input.source, confirmedAt: now.toISOString() };
  store.write(loginKey(input.applicationId), config);
  return config;
}

export function clearLoginConfig(applicationId: string, store: KeyValueStore = localKeyValueStore): void {
  store.delete(loginKey(applicationId));
}
