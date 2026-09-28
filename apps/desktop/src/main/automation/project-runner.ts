import net from "node:net";
import type { ExecutionProfile, ReadyCondition } from "@tellann/desktop-contracts";
import type { LaunchCorrelation, LocalLaunchCommand } from "../application-launcher";
import { LocalApplicationLauncher } from "../application-launcher";
import { isProfileApproved } from "./execution-profile";

/**
 * Supervises the processes of an approved execution profile for one Automated Run.
 *
 * Start order is the profile's order (a backend before the frontend that calls it), each process
 * is waited on until its readiness predicate holds, and teardown is the reverse. Readiness is
 * never a delay. If anything fails to come up, everything already started is stopped and the
 * reason is returned as evidence a report can show; a half-started application is never driven.
 */

/** The slice of `LocalApplicationLauncher` the runner needs, so tests can substitute a process. */
export interface ManagedProcess {
  start(command: LocalLaunchCommand, workspaceRoot: string, correlation: LaunchCorrelation): Promise<{ pid: number }>;
  readonly active: boolean;
  readonly sanitizedOutput: string;
  stop(): Promise<void>;
}

export interface RunnerProbes {
  port(port: number): Promise<boolean>;
  /** True when the server answered: with `status` exactly if given, otherwise with anything below 500. */
  http(url: string, status?: number): Promise<boolean>;
}

export type RunnerEvent = {
  process: string;
  phase: "STARTED" | "READY" | "STOPPED" | "FAILED";
  detail?: string;
  /** The operating-system process id, on STARTED and STOPPED, so a crash-safe journal can note it and strike it off. */
  pid?: number;
};

export type RunnerStartResult =
  | { ok: true; started: string[] }
  | { ok: false; stopReason: "APPLICATION_START_FAILED"; detail: string };

export interface ProjectRunnerDeps {
  createProcess?: () => ManagedProcess;
  probes?: RunnerProbes;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  /** How long the application URL may take to answer after every process reports ready. */
  applicationReadyTimeoutMs?: number;
}

export const defaultProbes: RunnerProbes = {
  port: (port) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      const done = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(1_000, () => done(false));
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
    }),
  http: async (url, status) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: "manual" });
      return status === undefined ? response.status < 500 : response.status === status;
    } catch {
      return false;
    }
  },
};

interface Running {
  name: string;
  handle: ManagedProcess;
  pid: number;
}

export class ProjectRunner {
  private running: Running[] = [];
  private readonly deps: Required<ProjectRunnerDeps>;

  constructor(deps: ProjectRunnerDeps = {}) {
    this.deps = {
      createProcess: deps.createProcess ?? (() => new LocalApplicationLauncher()),
      probes: deps.probes ?? defaultProbes,
      sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now: deps.now ?? Date.now,
      pollMs: deps.pollMs ?? 200,
      applicationReadyTimeoutMs: deps.applicationReadyTimeoutMs ?? 30_000,
    };
  }

  async start(input: {
    profile: ExecutionProfile;
    commands: LocalLaunchCommand[];
    workspaceRoot: string;
    correlation: LaunchCorrelation;
    onEvent?: (event: RunnerEvent) => void;
  }): Promise<RunnerStartResult> {
    const { profile, commands, workspaceRoot, correlation } = input;
    const emit = (event: RunnerEvent) => input.onEvent?.(event);
    const fail = async (detail: string, process?: string): Promise<RunnerStartResult> => {
      if (process) emit({ process, phase: "FAILED", detail });
      await this.stop(input.onEvent);
      return { ok: false, stopReason: "APPLICATION_START_FAILED", detail };
    };

    if (this.running.length > 0) return fail("An application is already running for this runner.");
    // The approval covers the commands as they resolve *now*: an edited script needs a fresh yes.
    if (!isProfileApproved(profile, commands, workspaceRoot)) {
      return fail("The execution profile is not approved, or what it runs has changed since it was.");
    }

    for (const spec of profile.processes) {
      const command = commands.find((candidate) => candidate.id === spec.launchCommandId);
      if (!command) return fail(`The launch command "${spec.launchCommandId}" is no longer in this workspace.`, spec.name);

      const handle = this.deps.createProcess();
      let pid: number;
      try {
        pid = (await handle.start(command, workspaceRoot, correlation)).pid;
      } catch (error) {
        return fail(errorMessage(error), spec.name);
      }
      this.running.push({ name: spec.name, handle, pid });
      emit({ process: spec.name, phase: "STARTED", pid });

      const ready = await this.waitUntilReady(spec.readyCondition, handle, spec.readyTimeoutMs);
      if (ready !== "READY") {
        const tail = handle.sanitizedOutput.slice(-2_000).trim();
        return fail(
          `${spec.name} ${ready === "EXITED" ? "exited before it was ready" : "did not become ready in time"}.${tail ? `\n${tail}` : ""}`,
          spec.name,
        );
      }
      emit({ process: spec.name, phase: "READY" });
    }

    // Even with no processes of our own (a hosted staging app) the URL has to answer before anything is driven.
    const answering = await this.waitFor(
      () => this.deps.probes.http(profile.applicationUrl),
      this.deps.applicationReadyTimeoutMs,
      null,
    );
    if (answering !== "READY") return fail(`${profile.applicationUrl} did not answer.`);
    return { ok: true, started: this.running.map((entry) => entry.name) };
  }

  /** `APPLICATION_CRASHED` once any supervised process has exited while the run is still going. */
  health(): "OK" | "APPLICATION_CRASHED" {
    return this.running.every((entry) => entry.handle.active) ? "OK" : "APPLICATION_CRASHED";
  }

  /** Output of a supervised process, redacted by the launcher, for a failure report. */
  outputOf(name: string): string {
    return this.running.find((entry) => entry.name === name)?.handle.sanitizedOutput ?? "";
  }

  /** Reverse of start order. Safe to call any number of times. */
  async stop(onEvent?: (event: RunnerEvent) => void): Promise<void> {
    const running = this.running;
    this.running = [];
    for (const entry of [...running].reverse()) {
      await entry.handle.stop().catch(() => undefined);
      onEvent?.({ process: entry.name, phase: "STOPPED", pid: entry.pid });
    }
  }

  private waitUntilReady(
    condition: ReadyCondition,
    handle: ManagedProcess,
    timeoutMs: number,
  ): Promise<"READY" | "EXITED" | "TIMEOUT"> {
    const check = async (): Promise<boolean> => {
      switch (condition.type) {
        case "PORT":
          return this.deps.probes.port(condition.port);
        case "HTTP":
          return this.deps.probes.http(condition.url, condition.status);
        case "LOG":
          return new RegExp(condition.pattern).test(handle.sanitizedOutput);
      }
    };
    return this.waitFor(check, timeoutMs, handle);
  }

  private async waitFor(
    check: () => Promise<boolean>,
    timeoutMs: number,
    watch: ManagedProcess | null,
  ): Promise<"READY" | "EXITED" | "TIMEOUT"> {
    const deadline = this.deps.now() + timeoutMs;
    for (;;) {
      if (await check()) return "READY";
      // A process that has died will never become ready; say so now rather than at the timeout.
      if (watch && !watch.active) return "EXITED";
      if (this.deps.now() >= deadline) return "TIMEOUT";
      await this.deps.sleep(this.deps.pollMs);
    }
  }
}

function errorMessage(error: unknown): string {
  // The launcher's own message already carries a redacted output tail and a diagnosis where it has one.
  return String((error as Error)?.message ?? error).replace(/^LOCAL_APPLICATION_LAUNCH_FAILED:/, "The process exited on start: ");
}
