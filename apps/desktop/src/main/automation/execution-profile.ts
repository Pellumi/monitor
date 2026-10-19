import { createHash } from "node:crypto";
import fs from "node:fs";
import { isLoopbackApplicationUrl } from "@tellann/desktop-contracts";
import type { ExecutionProfile } from "@tellann/desktop-contracts";
import { launchApprovalHash, type LocalLaunchCommand } from "../application-launcher";

/**
 * Execution profiles: how to bring the application up for an Automated Run.
 *
 * A profile names launch commands the workspace scan found; it never carries a command line of
 * its own. So everything the launcher already enforces (the package-script and Python allowlists,
 * workspace scoping, no shell) applies to a profile's processes exactly as it does to a Guided
 * run's `launchCommandId`, and there is no second, weaker way to start a process.
 *
 * Approval is a hash over what will actually run. If the script, working directory, readiness
 * condition or URL changes, the hash changes and the profile is no longer approved, so a
 * repository edit cannot quietly change what Tellann spawns.
 *
 * A profile with no processes is the other kind: an application already running somewhere the
 * developer gave the address of (a deployed staging environment). Tellann starts nothing for it and
 * only waits for the URL to answer, so there is no command to show anybody and nothing to withhold
 * consent from — it needs no approval. That is not a hole in the approval rule; it is the rule
 * having nothing to cover, and it is decided from the profile's own shape, never from a flag.
 */

export class ExecutionProfileError extends Error {
  constructor(
    readonly code: "EXECUTION_PROFILE_COMMAND_MISSING" | "EXECUTION_PROFILE_NOT_APPROVED",
    message: string,
  ) {
    super(message);
  }
}

function commandFor(commands: LocalLaunchCommand[], id: string): LocalLaunchCommand {
  const found = commands.find((command) => command.id === id);
  if (!found) {
    throw new ExecutionProfileError(
      "EXECUTION_PROFILE_COMMAND_MISSING",
      `The launch command "${id}" is no longer in this workspace.`,
    );
  }
  return found;
}

/** A profile that runs nothing: the application is already serving at its URL. */
export function startsNothing(profile: Pick<ExecutionProfile, "processes">): boolean {
  return profile.processes.length === 0;
}

/** What approving a profile approves. Stable for identical input, different for any change to what would run. */
export function executionProfileHash(
  profile: ExecutionProfile,
  commands: LocalLaunchCommand[],
  workspaceRoot: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        // Only meaningful when something is started from the folder. A profile that starts nothing is the same
        // profile wherever the folder happens to be, and asking for a real path would make it need one on disk.
        workspaceRoot: startsNothing(profile) ? null : fs.realpathSync.native(workspaceRoot),
        applicationUrl: profile.applicationUrl,
        processes: profile.processes.map((process) => ({
          name: process.name,
          readyCondition: process.readyCondition,
          readyTimeoutMs: process.readyTimeoutMs,
          // As resolved now, not as it was when the profile was written.
          command: launchApprovalHash(commandFor(commands, process.launchCommandId), workspaceRoot),
        })),
      }),
    )
    .digest("hex");
}

export function isProfileApproved(
  profile: ExecutionProfile,
  commands: LocalLaunchCommand[],
  workspaceRoot: string,
): boolean {
  // Nothing is run, so there is nothing for a person to have consented to. Reading the URL is not an act
  // that needs permission, and demanding one here would only be a button with nothing behind it.
  if (startsNothing(profile)) return true;
  if (!profile.approvedHash) return false;
  try {
    return executionProfileHash(profile, commands, workspaceRoot) === profile.approvedHash;
  } catch {
    // A command that no longer exists is a profile that is no longer approved.
    return false;
  }
}

export function approveProfile(
  profile: ExecutionProfile,
  commands: LocalLaunchCommand[],
  workspaceRoot: string,
  now: Date = new Date(),
): ExecutionProfile {
  return {
    ...profile,
    approvedHash: executionProfileHash(profile, commands, workspaceRoot),
    approvedAt: now.toISOString(),
  };
}

export interface ProfileProposal {
  profile: ExecutionProfile;
  rationale: string;
}

const PREFERRED_SCRIPTS = ["dev", "start", "serve", "preview"];

/**
 * Suggest profiles from what the workspace scan found: one process per candidate command,
 * readiness at the most likely application URL. These are proposals only. Nothing runs until the
 * developer approves one, and a scan that found no URL yields no proposal rather than a guessed one.
 *
 * A project with no startable script still gets one proposal — "it is already running at this
 * address" — because that is the other true answer to "how should Tellann start your application",
 * and without it an application the developer deploys rather than runs has no way in at all. It is
 * only offered for an address that is not on this machine: a local one with nothing to start it
 * would never answer.
 */
export function proposeExecutionProfiles(input: {
  applicationId: string;
  launchCommands: LocalLaunchCommand[];
  suggestedApplicationUrls: Array<{ url: string; confidence: number; source: string }>;
}): ProfileProposal[] {
  const url = [...input.suggestedApplicationUrls].sort((a, b) => b.confidence - a.confidence)[0];
  if (!url) return [];
  const ranked = [...input.launchCommands].sort(
    (a, b) => rank(a.scriptName) - rank(b.scriptName) || a.label.localeCompare(b.label),
  );
  const proposals = ranked.map((command): ProfileProposal => ({
    profile: {
      id: `profile:${command.id}`,
      applicationId: input.applicationId,
      name: command.label,
      processes: [
        {
          name: "app",
          launchCommandId: command.id,
          readyCondition: { type: "HTTP", url: url.url },
          readyTimeoutMs: 60_000,
        },
      ],
      applicationUrl: url.url,
      approvedHash: null,
      approvedAt: null,
    },
    rationale: `Runs \`${command.label}\` and waits for ${url.url} to answer (${url.source}).`,
  }));

  // With no script to run, "it is already running" is the only true answer, whatever the address: someone who
  // starts their own dev server is the commonest case of all. With scripts to run, it is only worth offering for
  // an address that is somewhere else — offering "already running at localhost" beside "run npm run dev" would
  // be two readings of the same thing and a choice nobody can make.
  const byConfidence = [...input.suggestedApplicationUrls].sort((a, b) => b.confidence - a.confidence);
  const deployed = proposals.length === 0
    ? byConfidence[0]
    : byConfidence.find((candidate) => !isLoopbackApplicationUrl(candidate.url));
  if (deployed) {
    proposals.push({
      profile: {
        id: "profile:already-running",
        applicationId: input.applicationId,
        name: `Already running at ${hostOf(deployed.url)}`,
        processes: [],
        applicationUrl: deployed.url,
        approvedHash: null,
        approvedAt: null,
      },
      rationale: `Starts nothing. Waits for ${deployed.url} to answer (${deployed.source}), then drives it there.`,
    });
  }
  return proposals;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function rank(scriptName: string): number {
  const index = PREFERRED_SCRIPTS.indexOf(scriptName);
  return index === -1 ? PREFERRED_SCRIPTS.length : index;
}
