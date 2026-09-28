import { createHash } from "node:crypto";
import fs from "node:fs";
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

/** What approving a profile approves. Stable for identical input, different for any change to what would run. */
export function executionProfileHash(
  profile: ExecutionProfile,
  commands: LocalLaunchCommand[],
  workspaceRoot: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        workspaceRoot: fs.realpathSync.native(workspaceRoot),
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
  return ranked.map((command): ProfileProposal => ({
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
}

function rank(scriptName: string): number {
  const index = PREFERRED_SCRIPTS.indexOf(scriptName);
  return index === -1 ? PREFERRED_SCRIPTS.length : index;
}
