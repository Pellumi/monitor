import { execFile } from "node:child_process";
import { killProcessTree } from "../process-tree";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * Applications an Automated Run started, remembered so that a desktop that dies mid-run does not leave them behind.
 *
 * On a clean exit the run manager stops what it started. On a crash, a power cut or a killed process it cannot, and
 * on Windows a child does not die with its parent: the development server keeps running and holding its port, so the
 * next run cannot start and the developer has to work out why. So every process is written down as it starts, struck
 * off as it stops, and whatever is still on the list at the next launch is dealt with then.
 *
 * Dealing with it means killing a process by a number written down earlier, which is only safe if the number still
 * means the same process. Operating systems reuse them. So the entry also records when the process *started*, and
 * a sweep ends a process only if it was started at that moment. If the start time could not be read when the entry
 * was written, the entry cannot be verified later and is dropped rather than acted on: leaving a stray process is
 * recoverable, ending somebody else's is not.
 */

export interface OrphanEntry {
  pid: number;
  runId: string;
  /** The process's name in the execution profile, for a message that says what was left behind. */
  name: string;
  /** When the OS says this process started (ms since epoch), or null if that could not be read. */
  startedAtMs: number | null;
  recordedAt: string;
}

export interface OrphanDeps {
  store?: KeyValueStore;
  /** When the process with this pid started, or null if there is no such process. */
  startTimeOf?: (pid: number) => Promise<number | null>;
  kill?: (pid: number) => Promise<void>;
  now?: () => Date;
  /** How far apart two readings of a start time may be and still be the same process. */
  toleranceMs?: number;
}

const PREFIX = "automation-orphan:";
const key = (pid: number) => `${PREFIX}${pid}`;

export const processStartTime = (pid: number): Promise<number | null> =>
  new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", `$p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; if ($p) { [DateTimeOffset]::new($p.StartTime).ToUnixTimeMilliseconds() }`],
        { windowsHide: true, timeout: 10_000 },
        (error, stdout) => {
          const value = Number(String(stdout).trim());
          resolve(error || !Number.isFinite(value) || value <= 0 ? null : value);
        },
      );
      return;
    }
    execFile("ps", ["-o", "lstart=", "-p", String(Number(pid))], { timeout: 5_000 }, (error, stdout) => {
      const parsed = Date.parse(String(stdout).trim());
      resolve(error || Number.isNaN(parsed) ? null : parsed);
    });
  });

export class OrphanJournal {
  private readonly store: KeyValueStore;
  private readonly startTimeOf: (pid: number) => Promise<number | null>;
  private readonly kill: (pid: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly toleranceMs: number;

  constructor(deps: OrphanDeps = {}) {
    this.store = deps.store ?? localKeyValueStore;
    this.startTimeOf = deps.startTimeOf ?? processStartTime;
    this.kill = deps.kill ?? ((pid) => killProcessTree(pid, { group: process.platform !== "win32" }));
    this.now = deps.now ?? (() => new Date());
    this.toleranceMs = deps.toleranceMs ?? 3_000;
  }

  /** Write a process down as it starts. Best effort: failing to journal must never fail the run. */
  async record(input: { pid: number; runId: string; name: string }): Promise<void> {
    try {
      const entry: OrphanEntry = {
        pid: input.pid, runId: input.runId, name: input.name,
        startedAtMs: await this.startTimeOf(input.pid).catch(() => null),
        recordedAt: this.now().toISOString(),
      };
      this.store.write(key(input.pid), entry);
    } catch {
      /* journalling is a safety net, not a dependency */
    }
  }

  /** Strike a process off as it stops. */
  forget(pid: number): void {
    try {
      this.store.delete(key(pid));
    } catch {
      /* nothing to do */
    }
  }

  entries(): OrphanEntry[] {
    return this.store.list(PREFIX).flatMap((name) => {
      const entry = this.store.read<OrphanEntry>(name);
      return entry && Number.isInteger(entry.pid) ? [entry] : [];
    });
  }

  /**
   * Deal with whatever a previous session left behind. Returns what it did, so the caller can tell the person if
   * something was actually found.
   */
  async sweep(): Promise<{ ended: OrphanEntry[]; gone: OrphanEntry[]; skipped: OrphanEntry[] }> {
    const ended: OrphanEntry[] = [];
    const gone: OrphanEntry[] = [];
    const skipped: OrphanEntry[] = [];
    for (const entry of this.entries()) {
      const current = await this.startTimeOf(entry.pid).catch(() => null);
      if (current === null) {
        gone.push(entry); // already exited: nothing to do but strike it off
      } else if (entry.startedAtMs === null || Math.abs(current - entry.startedAtMs) > this.toleranceMs) {
        // Either we never knew when it started, or the number now belongs to a different process.
        skipped.push(entry);
      } else {
        await this.kill(entry.pid).catch(() => undefined);
        ended.push(entry);
      }
      this.forget(entry.pid);
    }
    return { ended, gone, skipped };
  }
}
