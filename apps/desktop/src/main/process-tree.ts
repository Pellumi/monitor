import { execFile } from "node:child_process";

/**
 * Ending a process and everything it started.
 *
 * An application is almost never one process. `npm run dev` starts a shell script that starts node that starts a
 * compiler and a server; killing the one Tellann spawned leaves the rest running, holding the port, so the *next*
 * run cannot start and the developer is left hunting for a stray node. Ending the tree is the only ending that
 * leaves the machine as it was found.
 *
 * Windows has `taskkill /T`. POSIX has process groups, but only for a process that was started as its own group
 * leader, so the launcher starts children `detached` there and this ends the group. Both escalate: a polite
 * request first, a forced one if the tree is still standing after a grace period.
 */

export interface ProcessTreeDeps {
  platform?: NodeJS.Platform;
  /** Signals a pid or, with a negative pid, a whole process group. Throws if there is no such process. */
  signal?: (pid: number, signal: NodeJS.Signals | 0) => void;
  taskkill?: (pid: number) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}

const defaultTaskkill = (pid: number): Promise<void> =>
  new Promise((resolve) => {
    execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
  });

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Whether a process (or group, for a negative pid) still exists. */
export function isAlive(pid: number, signal: ProcessTreeDeps["signal"] = (target, name) => process.kill(target, name)): boolean {
  try {
    signal!(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists and is not ours to signal: alive.
    return (error as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

/**
 * End `pid` and its descendants. Resolves once the process is gone or the forced attempt has been made.
 * Safe to call for a pid that has already exited.
 */
export async function killProcessTree(
  pid: number,
  options: ProcessTreeDeps & { graceMs?: number; group?: boolean } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const signal = options.signal ?? ((target: number, name: NodeJS.Signals | 0) => process.kill(target, name));
  const sleep = options.sleep ?? defaultSleep;
  if (!Number.isInteger(pid) || pid <= 1) return; // never pid 0 (our own group) or 1

  if (platform === "win32") {
    await (options.taskkill ?? defaultTaskkill)(pid);
    return;
  }

  // The group when the child led one (started detached); otherwise just the process.
  const target = options.group === false ? pid : -pid;
  const send = (name: NodeJS.Signals) => {
    try {
      signal(target, name);
    } catch {
      /* already gone */
    }
  };
  send("SIGTERM");
  const deadline = options.graceMs ?? 3_000;
  const step = 100;
  for (let waited = 0; waited < deadline; waited += step) {
    if (!isAlive(target, signal)) return;
    await sleep(step);
  }
  send("SIGKILL");
}
