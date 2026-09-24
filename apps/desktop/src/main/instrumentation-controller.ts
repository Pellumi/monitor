import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app, shell } from "electron";
import {
  resolveWithinWorkspace,
  validateStructuredCommand,
} from "@tellann/agent-policy";
import type {
  InstrumentationPlanFilters,
  RepositorySnapshotSummary,
} from "@tellann/desktop-contracts";
import {
  assignFlowCheckpoints,
  createApprovalHash,
  detectAdapters,
  getAdapter,
  isPythonAdapterId,
  refreshPatchResult,
  validateInstrumentationPlan,
  type ApprovedInstrumentationTask,
  type FrameworkId,
  type InstrumentationPlan,
  type LocalProjectContext,
  type PatchResult,
  type StructuredCommand,
  type ValidationResult,
} from "@tellann/instrumentation-adapters";
import type { DesktopCloudClient } from "./cloud-client";
import { readLocalState, writeLocalState } from "./local-store";
import {
  createInstrumentationCheckpoint,
  type InstrumentationCheckpoint,
} from "./git-checkpoint";
import type { LocalApplicationLauncher } from "./application-launcher";
import {
  findInstalledPackage,
  findInstalledPythonDistribution,
} from "./sdk-installation";
import {
  environmentForInterpreter,
  isPythonInterpreterName,
  pythonEnvironments,
  resolvePythonInterpreter,
  type ResolvedInterpreter,
} from "./python-environment";

const execFileAsync = promisify(execFile);

export type SelectedWorkspace = {
  applicationId: string;
  localId: string;
  cloudId: string;
  snapshotId: string;
  root: string;
  snapshot: RepositorySnapshotSummary;
};

type EnvironmentContext = {
  applicationId: string;
  environmentId: string;
  environmentType: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  instrumentationPurpose?: "BOOTSTRAP" | "FLOW";
  flowId?: string;
  flowVersionId?: string;
  flowInitializationId?: string;
  /**
   * Every adapter the user is proposing for in this pass. A Flow can span a web
   * app and an API, and the checkpoints are split across those packages, so each
   * adapter needs to know which share is its own and which are someone else's.
   */
  selectedAdapterIds?: FrameworkId[];
};

type LocalApproval = {
  planId: string;
  applicationId: string;
  environmentId: string;
  environmentType: EnvironmentContext["environmentType"];
  files: string[];
  commandIds: string[];
  approvalHash: string;
};

export type CommandResult = {
  id: string;
  purpose: string;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string;
};

/**
 * One step of applying an approved task, reported as it happens so the member
 * can see what Tellann is doing to their project. `detail` names the file or
 * command a step is about, when there is one.
 */
export type InstrumentationProgressUpdate = {
  step: string;
  status: "RUNNING" | "DONE" | "FAILED";
  message: string;
  detail: string | null;
  at: string;
};

function assertUuid(value: unknown, name: string): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }
}

function safeOutput(value: unknown, workspaceRoot?: string): string {
  let output = String(value ?? "")
    .replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, "$1[REDACTED]")
    .replace(
      /((?:auth|password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@");
  if (workspaceRoot) {
    output = output
      .replaceAll(workspaceRoot, "<workspace>")
      .replaceAll(workspaceRoot.replaceAll("\\", "/"), "<workspace>");
  }
  return output.slice(-12_000);
}

function isTellannRelatedBuildFailure(output: string): boolean {
  return [
    /(?:cannot find module|failed to resolve).*@tellann\/(?:frontend|backend)-sdk/i,
    /(?:src[\\/])?tellann\.[cm]?[jt]sx?/i,
    /tellann:generated/i,
    /\bTELLANN(?:\.|\s|$)/,
    /TELLANN_(?:GATEWAY|INGESTION|APPLICATION|ENVIRONMENT)/,
  ].some((pattern) => pattern.test(output));
}

/** Whether a command printed anything besides "> script" banners and the failure line. */
function buildProducedOutput(output: string): boolean {
  return output.split(/\r?\n/).some((line) => {
    const text = line.trim();
    return Boolean(text) && !text.startsWith(">") && !/^Command failed:/i.test(text);
  });
}

/** The commands whose failure may be the project's own, not Tellann's. */
const PROJECT_HEALTH_COMMANDS = new Set(["validate-build", "validate-types"]);

function validationCheckForCommand(
  result: CommandResult,
): ValidationResult["checks"][number] {
  if (PROJECT_HEALTH_COMMANDS.has(result.id) && result.passed) {
    const warningCount = (
      result.output.match(/\bwarning\b|\(\s*!\s*\)/gi) ?? []
    ).length;
    return {
      name: "command:validate-build",
      passed: true,
      output: warningCount
        ? `Project build completed successfully with ${warningCount} non-blocking bundler warning${warningCount === 1 ? "" : "s"}. See Project build health for guidance.`
        : "Project build completed successfully.",
    };
  }
  // A build that printed nothing beyond the package manager's banner never ran
  // (npm could not start the script, for example). Calling that "application
  // errors unrelated to Tellann" would send the member looking for errors that
  // do not exist.
  if (
    PROJECT_HEALTH_COMMANDS.has(result.id) &&
    !result.passed &&
    !buildProducedOutput(result.output)
  ) {
    return {
      name: "command:validate-build",
      passed: false,
      output: `The build script exited before producing any output${result.exitCode === null ? "" : ` (exit code ${result.exitCode})`}, so the build did not run. Run the build yourself to see why, then re-run local checks.`,
    };
  }
  if (
    PROJECT_HEALTH_COMMANDS.has(result.id) &&
    !result.passed &&
    !isTellannRelatedBuildFailure(result.output)
  ) {
    return {
      name: "project-build-warning",
      passed: true,
      output:
        "Tellann checks passed, but the application build has errors that do not reference the Tellann SDK or generated configuration. The original diagnostics are available under Project build health.",
    };
  }
  return {
    name: `command:${result.id}`,
    passed: result.passed,
    output: result.output,
  };
}

function resolveCommand(command: StructuredCommand, cwd: string): {
  executable: string;
  args: string[];
  interpreter?: ResolvedInterpreter;
} {
  // `python -m pip install tellann` has to install into the interpreter the
  // project actually runs on. Resolved by name it would install into whichever
  // Python is on the desktop application's PATH - a different interpreter from
  // the project's virtual environment, so the SDK would land somewhere the
  // application never imports from and `compileall` would check the wrong one.
  if (isPythonInterpreterName(command.executable)) {
    const interpreter = resolvePythonInterpreter(cwd, command.executable);
    return { executable: interpreter.executable, args: command.args, interpreter };
  }
  const manager = command.executable.replace(/\.cmd$/i, "");
  if (
    process.platform !== "win32" ||
    !["pnpm", "npm", "yarn"].includes(manager)
  ) {
    return { executable: command.executable, args: command.args };
  }
  const where = require("node:child_process").execFileSync(
    "where.exe",
    [`${manager}.cmd`],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    },
  ) as string;
  const launchers = where
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const relativeCli =
    manager === "pnpm"
      ? ["node_modules", "pnpm", "bin", "pnpm.cjs"]
      : manager === "npm"
        ? ["node_modules", "npm", "bin", "npm-cli.js"]
        : ["node_modules", "yarn", "bin", "yarn.js"];
  for (const launcher of launchers) {
    const cli = path.join(path.dirname(launcher), ...relativeCli);
    const nodeExecutable = path.join(path.dirname(launcher), "node.exe");
    if (fs.existsSync(cli) && fs.existsSync(nodeExecutable))
      return { executable: nodeExecutable, args: [cli, ...command.args] };
  }
  throw new Error(`SAFE_${manager.toUpperCase()}_EXECUTABLE_NOT_FOUND`);
}

async function runCommand(
  command: StructuredCommand,
  workspaceRoot: string,
): Promise<CommandResult> {
  validateStructuredCommand(command, workspaceRoot);
  const cwd = resolveWithinWorkspace(workspaceRoot, command.cwd);
  const resolved = resolveCommand(command, cwd);
  const env: Record<string, string> = Object.fromEntries(
    command.allowedEnvironmentKeys.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
  // Package managers run a script such as "vite build" through the Windows
  // command shell, which they find through ComSpec. Without it npm exits with
  // code 1 before the script starts and prints nothing. ComSpec names a system
  // binary rather than project or user data, so it is always passed through.
  if (process.platform === "win32" && process.env.ComSpec && !env.ComSpec) {
    env.ComSpec = process.env.ComSpec;
  }
  // `python -m pip install tellann` installs into the interpreter it runs on,
  // but a build backend or a package's own setup step shells out by name, and
  // those have to land in the same environment rather than on the desktop
  // application's PATH. The allowlist above still decides what is inherited;
  // this only adds the environment Tellann resolved.
  const environment = resolved.interpreter
    ? environmentForInterpreter(resolved.interpreter, env)
    : env;
  const started = Date.now();
  try {
    const result = await execFileAsync(resolved.executable, resolved.args, {
      cwd,
      env: environment,
      timeout: command.timeoutMs,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    return {
      id: command.id,
      purpose: command.purpose,
      passed: true,
      exitCode: 0,
      durationMs: Date.now() - started,
      output: safeOutput(`${result.stdout}\n${result.stderr}`, workspaceRoot),
    };
  } catch (error) {
    const failure = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      id: command.id,
      purpose: command.purpose,
      passed: false,
      exitCode: typeof failure.code === "number" ? failure.code : null,
      durationMs: Date.now() - started,
      output: safeOutput(
        `${failure.stdout ?? ""}\n${failure.stderr ?? ""}\n${failure.message ?? ""}`,
        workspaceRoot,
      ),
    };
  }
}

/**
 * Whether the SDK the plan declares is actually present in the project.
 *
 * The answer is looked for where the plan's own runtime installs things: a
 * JavaScript package lands in `node_modules`, a Python distribution in a
 * virtual environment's `site-packages`. Probing `node_modules` for a pip
 * distribution never finds it, which used to fail this check - and with it the
 * whole validation, and with that the telemetry verification that follows it -
 * for every correctly instrumented Django, Flask, FastAPI and Starlette
 * project.
 *
 * A Python environment can also live somewhere this process cannot see: a
 * Conda prefix, a `pyenv` shim, a system interpreter. When the distribution is
 * not on disk anywhere inspectable, the installer's own exit code is the better
 * evidence, so it is used rather than reporting an install that succeeded as
 * missing.
 */
function installedSdkCheck(
  plan: InstrumentationPlan,
  root: string,
  commandResults: CommandResult[] = [],
): ValidationResult["checks"][number] {
  const packageName = plan.packageChanges[0]?.packageName;
  if (!packageName)
    return {
      name: "sdk-installed",
      passed: false,
      output: "No SDK package declared by the plan",
    };
  const packageOperation = plan.operations.find(
    (operation) => operation.id === "package-sdk",
  );
  const packageManifest = packageOperation
    ? resolveWithinWorkspace(root, packageOperation.relativePath)
    : path.join(root, "package.json");
  const packageDirectory = path.dirname(packageManifest);

  if (isPythonAdapterId(plan.adapterId)) {
    const distribution = findInstalledPythonDistribution(packageDirectory, packageName);
    if (distribution)
      return {
        name: "sdk-installed",
        passed: true,
        output: `${packageName}${distribution.version ? ` ${distribution.version}` : ""} is installed in ${safeOutput(distribution.environment, root)}`,
      };
    const install = commandResults.find((result) => result.id === "install-sdk");
    if (install?.passed)
      return {
        name: "sdk-installed",
        passed: true,
        output: `${packageName} was installed by the approved install command. No virtual environment was found in the project, so the interpreter it went into could not be inspected directly.`,
      };
    const environments = pythonEnvironments(packageDirectory);
    return {
      name: "sdk-installed",
      passed: false,
      output: environments.length
        ? `${packageName} is declared in ${packageOperation?.relativePath ?? "the project manifest"} but is not installed in ${safeOutput(environments[0], root)}. Install it into that environment, then re-run local checks.`
        : `${packageName} is declared in ${packageOperation?.relativePath ?? "the project manifest"} but the install did not run and no virtual environment was found to check. Install it with your project's package manager, then re-run local checks.`,
    };
  }

  const installed = findInstalledPackage(packageDirectory, packageName);
  return installed
    ? {
        name: "sdk-installed",
        passed: true,
        output: `${packageName}${installed.version ? `@${installed.version}` : ""} is installed`,
      }
    : {
        name: "sdk-installed",
        passed: false,
        output: `${packageName} is declared but not installed in node_modules. Run your package manager's install, then re-run local checks.`,
      };
}

function currentHash(root: string, relativePath: string): string | null {
  const target = resolveWithinWorkspace(root, relativePath);
  return fs.existsSync(target)
    ? crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex")
    : null;
}

function mergeEnvironmentFile(
  existing: string,
  values: Record<string, string>,
): string {
  const lines = existing ? existing.replace(/\r\n/g, "\n").split("\n") : [];
  for (const [key, value] of Object.entries(values)) {
    const next = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  }
  return `${lines.filter(Boolean).join("\n")}\n`;
}

/**
 * The environment-variable prefix each frontend framework exposes to client
 * code. Server frameworks, Python included, read unprefixed variables, so they
 * are simply absent from this map.
 */
const FRONTEND_ADAPTER_PREFIXES = new Map<string, string>([
  ["nextjs", "NEXT_PUBLIC_"],
  ["react-vite", "VITE_"],
  ["remix", "VITE_"],
  ["sveltekit", "PUBLIC_"],
  ["astro", "PUBLIC_"],
  ["nuxt", "NUXT_PUBLIC_"],
  ["angular", "VITE_"],
]);

export class InstrumentationController {
  constructor(
    private readonly cloud: DesktopCloudClient,
    private readonly workspace: (
      applicationId: string,
    ) => SelectedWorkspace | null,
    private readonly launcher?: LocalApplicationLauncher,
    /** Rescans the attached folder and registers the result as the workspace's current snapshot. */
    private readonly refreshWorkspace?: (applicationId: string) => Promise<void>,
  ) {}

  private selected(applicationId: string): SelectedWorkspace {
    const workspace = this.workspace(applicationId);
    if (!workspace || workspace.applicationId !== applicationId)
      throw new Error("MATCHING_WORKSPACE_SELECTION_REQUIRED");
    resolveWithinWorkspace(workspace.root, ".");
    return workspace;
  }

  private context(
    workspace: SelectedWorkspace,
    environmentType: EnvironmentContext["environmentType"],
    flow?: Pick<
      EnvironmentContext,
      | "instrumentationPurpose"
      | "flowId"
      | "flowVersionId"
      | "flowInitializationId"
    > & { flowManifest?: any; flowCheckpointIds?: string[] },
  ): LocalProjectContext {
    return {
      workspaceRoot: workspace.root,
      snapshot: workspace.snapshot,
      environmentType,
      instrumentationPurpose: flow?.instrumentationPurpose ?? "BOOTSTRAP",
      flowId: flow?.flowId,
      flowVersionId: flow?.flowVersionId,
      flowInitializationId: flow?.flowInitializationId,
      flowManifest: flow?.flowManifest,
      flowCheckpointIds: flow?.flowCheckpointIds,
    };
  }

  async detect(input: EnvironmentContext) {
    const workspace = this.selected(input.applicationId);
    const detections = detectAdapters(
      this.context(workspace, input.environmentType),
    );
    return this.cloud.detectInstrumentation(input.applicationId, {
      workspaceId: workspace.cloudId,
      environmentId: input.environmentId,
      detections,
    });
  }

  async propose(input: EnvironmentContext & { adapterId: FrameworkId }) {
    if (input.environmentType === "PRODUCTION")
      throw new Error("PRODUCTION_OBSERVATION_ONLY");
    // Applying refuses a plan whose revision is not the project's current commit.
    // Build the plan from the project as it is now: the snapshot taken when the
    // folder was attached goes stale after any commit, branch switch or install,
    // and every plan built from it would then fail to apply.
    await this.refreshWorkspace?.(input.applicationId);
    const workspace = this.selected(input.applicationId);
    const initialization =
      input.instrumentationPurpose === "FLOW" && input.flowInitializationId
        ? await this.cloud.flowInitialization(input.flowInitializationId)
        : null;
    // Split the Flow across the packages being instrumented. With one adapter
    // this assigns it everything and behaves exactly as before; with several it
    // is what lets a single Flow reach both a web app and its API.
    let flowCheckpointIds: string[] | undefined;
    if (input.instrumentationPurpose === "FLOW" && initialization?.manifest) {
      const selected = input.selectedAdapterIds?.length
        ? input.selectedAdapterIds
        : [input.adapterId];
      const assignment = assignFlowCheckpoints(
        workspace.root,
        initialization.manifest as any,
        selected,
      );
      if (assignment.unassigned.length) {
        // Name the files: "outside the framework package" is only actionable if
        // the user can see which checkpoint landed where.
        throw new Error(
          `FLOW_CHECKPOINT_OUTSIDE_DETECTED_PACKAGES:${assignment.unassigned
            .map((item) => item.file || item.checkpointId)
            .join(",")}`,
        );
      }
      flowCheckpointIds = assignment.byAdapter[input.adapterId] ?? [];
    }
    const plan = await getAdapter(input.adapterId).propose(
      this.context(workspace, input.environmentType, {
        ...input,
        flowManifest: initialization?.manifest,
        flowCheckpointIds,
      }),
    );
    const packageManifest =
      plan.operations.find((operation) => operation.id === "package-sdk")
        ?.relativePath ?? "package.json";
    const packageRoot =
      path.posix.dirname(packageManifest) === "."
        ? ""
        : path.posix.dirname(packageManifest);
    const envFile = packageRoot ? `${packageRoot}/.env.local` : ".env.local";
    const ignoreFile = packageRoot ? `${packageRoot}/.gitignore` : ".gitignore";
    plan.operations.push(
      {
        id: "tellann-local-environment",
        kind: fs.existsSync(resolveWithinWorkspace(workspace.root, envFile))
          ? "UPDATE_SOURCE"
          : "CREATE_FILE",
        relativePath: envFile,
        symbol: null,
        transformId: "tellann.environment.local",
        transformVersion: plan.adapterVersion,
        expectedHash: currentHash(workspace.root, envFile),
        description:
          "Write environment-scoped Tellann credentials to a local ignored environment file",
        eventMappings: [],
      },
      {
        id: "tellann-environment-ignore",
        kind: fs.existsSync(resolveWithinWorkspace(workspace.root, ignoreFile))
          ? "UPDATE_SOURCE"
          : "CREATE_FILE",
        relativePath: ignoreFile,
        symbol: null,
        transformId: "tellann.environment.gitignore",
        transformVersion: plan.adapterVersion,
        expectedHash: currentHash(workspace.root, ignoreFile),
        description:
          "Ensure the local Tellann environment file is excluded from Git",
        eventMappings: [],
      },
    );
    plan.approvedFileScopes = [
      ...new Set([...plan.approvedFileScopes, envFile, ignoreFile]),
    ];
    plan.taskKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          base: plan.taskKey,
          environmentId: input.environmentId,
          envFile,
          ignoreFile,
        }),
      )
      .digest("hex");
    writeLocalState(`instrumentation-plan:${plan.id}`, plan);
    return this.cloud.createInstrumentationPlan(input.applicationId, {
      workspaceId: workspace.cloudId,
      repositorySnapshotId: workspace.snapshotId,
      environmentId: input.environmentId,
      deviceSessionId: String(this.cloud.getSession().deviceSessionId),
      plan,
    });
  }

  list(applicationId: string, filters: InstrumentationPlanFilters = {}) {
    assertUuid(applicationId, "application_id");
    return this.cloud.instrumentationPlans(applicationId, filters);
  }

  /** Rename a setup task. A null title restores the derived one. */
  async rename(applicationId: string, planId: string, title: string | null) {
    assertUuid(applicationId, "application_id");
    assertUuid(planId, "plan_id");
    return this.cloud.renameInstrumentationPlan(applicationId, planId, title);
  }

  async archive(applicationId: string, planId: string) {
    assertUuid(applicationId, "application_id");
    assertUuid(planId, "plan_id");
    return this.cloud.archiveInstrumentationPlan(applicationId, planId);
  }

  async restore(applicationId: string, planId: string) {
    assertUuid(applicationId, "application_id");
    assertUuid(planId, "plan_id");
    return this.cloud.restoreInstrumentationPlan(applicationId, planId);
  }

  get(applicationId: string, planId: string) {
    assertUuid(applicationId, "application_id");
    assertUuid(planId, "plan_id");
    return this.cloud.instrumentationPlan(applicationId, planId);
  }

  localResult(applicationId: string, planId: string) {
    this.selected(applicationId);
    assertUuid(planId, "plan_id");
    return readLocalState<Record<string, unknown>>(
      `instrumentation-result:${planId}`,
    );
  }

  async approve(
    input: EnvironmentContext & {
      planId: string;
      approvedFileScopes: string[];
      approvedCommandIds: string[];
    },
  ) {
    if (input.environmentType === "PRODUCTION")
      throw new Error("PRODUCTION_OBSERVATION_ONLY");
    const plan = this.localPlan(input.planId);
    const approvalHash = createApprovalHash(
      plan,
      input.approvedFileScopes,
      input.approvedCommandIds,
    );
    const approved = await this.cloud.approveInstrumentation(
      input.applicationId,
      input.planId,
      input,
    );
    if (String(approved.approvalHash) !== approvalHash)
      throw new Error("CLOUD_APPROVAL_HASH_MISMATCH");
    const local: LocalApproval = {
      planId: input.planId,
      applicationId: input.applicationId,
      environmentId: input.environmentId,
      environmentType: input.environmentType,
      files: input.approvedFileScopes,
      commandIds: input.approvedCommandIds,
      approvalHash,
    };
    writeLocalState(`instrumentation-approval:${input.planId}`, local);
    return approved;
  }

  async reject(applicationId: string, planId: string, reason?: string) {
    assertUuid(applicationId, "application_id");
    assertUuid(planId, "plan_id");
    return this.cloud.rejectInstrumentation(applicationId, planId, reason);
  }

  /**
   * Install the SDK on its own, before anything is written.
   *
   * Dependency installation is the longest step in applying a plan and the only
   * one that needs the network, but it is not a change to the user's code: it
   * needs no checkpoint and nothing about it to roll back. Running it inside
   * `apply` meant it began only after the user had finished reading the diff and
   * pressed the button, so its minutes were minutes of watching a spinner.
   * Started at approval instead, it overlaps with the reading.
   *
   * Idempotent: a second call with a recorded success does nothing.
   */
  async installDependencies(
    applicationId: string,
    planId: string,
    onProgress?: (update: InstrumentationProgressUpdate) => void,
  ) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    if (approval.applicationId !== applicationId) throw new Error("INVALID_LOCAL_APPROVAL_SCOPE");
    const command = plan.validationCommands.find((item) => item.id === "install-sdk");
    if (!command) return { installed: true, skipped: "NO_INSTALL_REQUIRED" as const };
    if (!approval.commandIds.includes("install-sdk")) throw new Error("SDK_INSTALL_COMMAND_APPROVAL_REQUIRED");
    const recorded = readLocalState<CommandResult>(`instrumentation-install:${planId}`);
    if (recorded?.passed) return { installed: true, skipped: "ALREADY_INSTALLED" as const, result: recorded };
    onProgress?.({
      step: "COMMAND:install-sdk", status: "RUNNING", message: command.purpose,
      detail: `${command.executable} ${command.args.join(" ")}`, at: new Date().toISOString(),
    });
    const result = await runCommand(command, workspace.root);
    writeLocalState(`instrumentation-install:${planId}`, result);
    onProgress?.({
      step: "COMMAND:install-sdk",
      status: result.passed ? "DONE" : "FAILED",
      message: result.passed
        ? `Finished in ${Math.max(1, Math.round(result.durationMs / 1000))}s`
        : `Failed after ${Math.max(1, Math.round(result.durationMs / 1000))}s`,
      detail: null, at: new Date().toISOString(),
    });
    return { installed: result.passed, result };
  }

  async apply(
    applicationId: string,
    planId: string,
    onProgress?: (update: InstrumentationProgressUpdate) => void,
  ) {
    let currentStep = "PREPARE";
    const report = (
      step: string,
      status: InstrumentationProgressUpdate["status"],
      message: string,
      detail: string | null = null,
    ) => {
      if (status === "RUNNING") currentStep = step;
      onProgress?.({ step, status, message, detail, at: new Date().toISOString() });
    };
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    if (
      approval.applicationId !== applicationId ||
      approval.environmentType === "PRODUCTION"
    )
      throw new Error("INVALID_LOCAL_APPROVAL_SCOPE");
    if (
      plan.validationCommands.some((command) => command.id === "install-sdk") &&
      !approval.commandIds.includes("install-sdk")
    ) {
      throw new Error("SDK_INSTALL_COMMAND_APPROVAL_REQUIRED");
    }
    report("PREPARE", "RUNNING", "Confirming your approval with Tellann Cloud");
    const intent = await this.cloud.instrumentationApplyIntent(
      applicationId,
      planId,
    );
    if (intent.approvalHash !== approval.approvalHash)
      throw new Error("CLOUD_APPROVAL_HASH_MISMATCH");
    report("PREPARE", "DONE", "Approval confirmed");
    const context = this.context(workspace, approval.environmentType);
    let appliedPatch: PatchResult | null = null;
    try {
      const task: ApprovedInstrumentationTask = {
        plan,
        approvedFileScopes: approval.files,
        approvedCommandIds: approval.commandIds,
        approvalHash: approval.approvalHash,
        checkpointDirectory: path.join(
          app.getPath("userData"),
          "instrumentation-checkpoints",
          workspace.localId,
        ),
      };
      report("CHECKPOINT", "RUNNING", "Recording where your project is before changing anything");
      const checkpoint = await createInstrumentationCheckpoint(workspace.root);
      writeLocalState(`instrumentation-checkpoint:${planId}`, checkpoint);
      report(
        "CHECKPOINT",
        "DONE",
        checkpoint.kind === "GIT_BRANCH"
          ? `On ${checkpoint.branch ?? "a detached HEAD"}${checkpoint.baseRevision ? ` at ${checkpoint.baseRevision.slice(0, 7)}` : ""}${checkpoint.dirty ? ", with your uncommitted changes left as they are" : ""}`
          : "Saved a local checkpoint of the files Tellann will touch",
      );
      // The environment file and its ignore rule are written further down.
      const fileOperations = plan.operations.filter(
        (operation) =>
          operation.id !== "tellann-local-environment" &&
          operation.id !== "tellann-environment-ignore",
      );
      report(
        "WRITE_FILES",
        "RUNNING",
        `Writing ${fileOperations.length} approved change${fileOperations.length === 1 ? "" : "s"}`,
      );
      let patch = await getAdapter(plan.adapterId).apply(context, task);
      appliedPatch = patch;
      for (const operation of fileOperations) {
        report("WRITE_FILES", "RUNNING", operation.description, operation.relativePath);
      }
      report(
        "WRITE_FILES",
        "DONE",
        `Wrote ${fileOperations.length} change${fileOperations.length === 1 ? "" : "s"}`,
      );
      report("CREDENTIALS", "RUNNING", "Creating a setup key for this environment");
      const setup = await this.cloud.sdkSetup(
        applicationId,
        approval.environmentId,
      );
      const credential = await this.cloud.issueSetupKey(
        applicationId,
        approval.environmentId,
      );
      const envOperation = plan.operations.find(
        (operation) => operation.id === "tellann-local-environment",
      );
      const ignoreOperation = plan.operations.find(
        (operation) => operation.id === "tellann-environment-ignore",
      );
      if (!envOperation || !ignoreOperation)
        throw new Error("PERMANENT_SETUP_ENVIRONMENT_SCOPE_MISSING");
      const frontend = FRONTEND_ADAPTER_PREFIXES.has(plan.adapterId);
      // Each bundler only exposes variables carrying its own prefix, so the
      // value has to be written under the prefix the framework actually reads;
      // a correct value under the wrong prefix is invisible to the application.
      const prefix = FRONTEND_ADAPTER_PREFIXES.get(plan.adapterId) ?? "";
      const environmentValues = frontend
        ? {
            [`${prefix}TELLANN_GATEWAY_URL`]: String(setup.gatewayEndpoint),
            [`${prefix}TELLANN_INGESTION_KEY`]: credential.rawKey,
            [`${prefix}TELLANN_APPLICATION_ID`]: applicationId,
            [`${prefix}TELLANN_ENVIRONMENT_ID`]: approval.environmentId,
          }
        : {
            TELLANN_GATEWAY_URL: String(setup.gatewayEndpoint),
            TELLANN_INGESTION_KEY: credential.rawKey,
            TELLANN_APPLICATION_ID: applicationId,
            TELLANN_ENVIRONMENT_ID: approval.environmentId,
          };
      const envTarget = resolveWithinWorkspace(
        workspace.root,
        envOperation.relativePath,
      );
      fs.mkdirSync(path.dirname(envTarget), { recursive: true });
      fs.writeFileSync(
        envTarget,
        mergeEnvironmentFile(
          fs.existsSync(envTarget) ? fs.readFileSync(envTarget, "utf8") : "",
          environmentValues,
        ),
      );
      const ignoreTarget = resolveWithinWorkspace(
        workspace.root,
        ignoreOperation.relativePath,
      );
      fs.mkdirSync(path.dirname(ignoreTarget), { recursive: true });
      const ignoreSource = fs.existsSync(ignoreTarget)
        ? fs.readFileSync(ignoreTarget, "utf8")
        : "";
      if (!ignoreSource.split(/\r?\n/).includes(".env.local"))
        fs.writeFileSync(
          ignoreTarget,
          `${ignoreSource.trimEnd()}${ignoreSource.trim() ? "\n" : ""}.env.local\n`,
        );
      report(
        "CREDENTIALS",
        "RUNNING",
        "Saved the setup key and connection settings",
        envOperation.relativePath,
      );
      report("CREDENTIALS", "RUNNING", "Kept the key out of Git", ignoreOperation.relativePath);
      report("CREDENTIALS", "DONE", "Setup key added");
      patch = refreshPatchResult(context, patch);
      appliedPatch = patch;
      // An install that already ran at approval time is not run again; its
      // result still counts towards validation, because validation is about
      // whether the SDK is present, not about when it arrived.
      const completedInstall = readLocalState<CommandResult>(`instrumentation-install:${planId}`);
      const installAlreadyDone = Boolean(completedInstall?.passed);
      const commands = plan.validationCommands.filter((command) =>
        approval.commandIds.includes(command.id)
        && !(installAlreadyDone && command.id === "install-sdk"),
      );
      const commandResults: CommandResult[] = installAlreadyDone && completedInstall ? [completedInstall] : [];
      if (installAlreadyDone) {
        report("COMMAND:install-sdk", "DONE", "Already installed while you reviewed the changes");
      }
      for (const command of commands) {
        const step = `COMMAND:${command.id}`;
        report(step, "RUNNING", command.purpose, `${command.executable} ${command.args.join(" ")}`);
        const result = await runCommand(command, workspace.root);
        commandResults.push(result);
        const seconds = Math.max(1, Math.round(result.durationMs / 1000));
        report(
          step,
          result.passed ? "DONE" : "FAILED",
          result.passed
            ? `Finished in ${seconds}s`
            : `Failed after ${seconds}s${result.exitCode === null ? "" : ` (exit code ${result.exitCode})`}`,
        );
        if (!result.passed) break;
      }
      patch = refreshPatchResult(context, patch);
      appliedPatch = patch;
      report("VALIDATE", "RUNNING", "Checking the changes Tellann made");
      const validation = await getAdapter(plan.adapterId).validate(
        context,
        patch,
      );
      validation.checks.push(installedSdkCheck(plan, workspace.root, commandResults));
      for (const command of commandResults)
        validation.checks.push(validationCheckForCommand(command));
      validation.valid = validation.checks.every((check) => check.passed);
      report(
        "VALIDATE",
        validation.valid ? "DONE" : "FAILED",
        `${validation.checks.filter((check) => check.passed).length} of ${validation.checks.length} checks passed`,
      );
      let telemetryVerified = false;
      const launchCommand = workspace.snapshot.launchCommands?.[0];
      if (validation.valid && launchCommand && this.launcher) {
        report("VERIFY", "RUNNING", "Starting your app to confirm the connection");
        await this.launcher.startPermanent(launchCommand, workspace.root, {
          endpoint: String(setup.gatewayEndpoint),
          ingestionKey: credential.rawKey,
          applicationId,
          environmentId: approval.environmentId,
        });
        try {
          if (frontend && typeof setup.baseUrl === "string") {
            const target = new URL(setup.baseUrl);
            if (!["http:", "https:"].includes(target.protocol))
              throw new Error("INVALID_SETUP_TARGET_URL");
            const healthDeadline = Date.now() + 30_000;
            while (Date.now() < healthDeadline) {
              try {
                const response = await fetch(target);
                if (response.ok) break;
              } catch {
                /* wait for the approved local process */
              }
              await new Promise((resolve) => setTimeout(resolve, 1_000));
            }
            await shell.openExternal(target.toString());
          }
          report("VERIFY", "RUNNING", "Waiting for your app's first event (up to 45 seconds)");
          const deadline = Date.now() + 45_000;
          while (Date.now() < deadline) {
            const latest = await this.cloud.sdkSetup(
              applicationId,
              approval.environmentId,
            );
            const latestReadiness = latest.readiness as
              | Record<string, unknown>
              | undefined;
            if (latestReadiness?.installationTestPassed === true) {
              telemetryVerified = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2_000));
          }
        } finally {
          await this.launcher.stop();
        }
        validation.checks.push({
          name: "telemetry-verification",
          passed: telemetryVerified,
          output: telemetryVerified
            ? "TELLANN_ONBOARDING_TEST received"
            : "Application started but no onboarding test event was observed before timeout",
        });
        report(
          "VERIFY",
          telemetryVerified ? "DONE" : "FAILED",
          telemetryVerified
            ? "Your app sent its first event"
            : "No event arrived in time. You can confirm the connection later",
        );
        validation.valid = validation.checks.every((check) => check.passed);
      }
      const localResult = {
        patch,
        commandResults,
        validation,
        checkpoint,
        cloudPatchIdentity: {
          checkpointId: patch.checkpointId,
          diffHash: patch.diffHash,
        },
      };
      writeLocalState(`instrumentation-result:${planId}`, localResult);
      report("SYNC", "RUNNING", "Saving the result to Tellann Cloud");
      const cloudResult = await this.cloud.submitInstrumentationResult(
        applicationId,
        planId,
        intent.capability,
        patch,
        validation,
        commandResults,
        checkpoint,
      );
      report("SYNC", "DONE", "Saved");
      return {
        patch,
        commandResults,
        validation,
        checkpoint,
        telemetryVerified,
        cloud: cloudResult,
      };
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Local instrumentation application failed";
      report(currentStep, "FAILED", reason);
      if (appliedPatch) {
        report("ROLLBACK", "RUNNING", "Undoing Tellann's changes");
        await getAdapter(plan.adapterId)
          .rollback(context, refreshPatchResult(context, appliedPatch))
          .catch(() => undefined);
        report("ROLLBACK", "DONE", "Your files are back as they were");
      }
      await this.cloud
        .failInstrumentation(applicationId, planId, intent.capability, reason)
        .catch(() => undefined);
      throw error;
    }
  }

  async validate(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    const stored = readLocalState<{
      patch: PatchResult;
      commandResults?: CommandResult[];
      cloudPatchIdentity?: { checkpointId?: string; diffHash?: string };
      [key: string]: unknown;
    }>(`instrumentation-result:${planId}`);
    if (!stored) throw new Error("LOCAL_PATCH_RESULT_NOT_FOUND");
    const patch = refreshPatchResult(
      this.context(workspace, approval.environmentType),
      stored.patch,
    );
    const validation = await getAdapter(plan.adapterId).validate(
      this.context(workspace, approval.environmentType),
      patch,
    );
    // `install-sdk` is not re-run here, so the result it recorded when it did
    // run is what tells the check whether the SDK ever arrived.
    const recordedInstall =
      readLocalState<CommandResult>(`instrumentation-install:${planId}`)
      ?? stored.commandResults?.find((result) => result.id === "install-sdk")
      ?? null;
    validation.checks.push(
      installedSdkCheck(plan, workspace.root, recordedInstall ? [recordedInstall] : []),
    );
    const commandResults: CommandResult[] = [];
    for (const command of plan.validationCommands.filter(
      (item) =>
        item.id !== "install-sdk" && approval.commandIds.includes(item.id),
    )) {
      const result = await runCommand(command, workspace.root);
      commandResults.push(result);
      validation.checks.push(validationCheckForCommand(result));
    }
    validation.valid = validation.checks.every((check) => check.passed);
    let cloudPatchIdentity = stored.cloudPatchIdentity;
    if (!cloudPatchIdentity?.checkpointId || !cloudPatchIdentity.diffHash) {
      const cloudPlan = (await this.cloud.instrumentationPlan(
        applicationId,
        planId,
      )) as { patchSets?: Array<{ checkpointId?: string; diffHash?: string }> };
      const latestCloudPatch = cloudPlan.patchSets?.[0];
      if (!latestCloudPatch?.checkpointId || !latestCloudPatch.diffHash)
        throw new Error("CLOUD_PATCH_IDENTITY_NOT_FOUND");
      cloudPatchIdentity = {
        checkpointId: latestCloudPatch.checkpointId,
        diffHash: latestCloudPatch.diffHash,
      };
    }
    writeLocalState(`instrumentation-result:${planId}`, {
      ...stored,
      patch,
      commandResults,
      validation,
      cloudPatchIdentity,
      revalidatedAt: new Date().toISOString(),
    });
    const checkpointId = cloudPatchIdentity.checkpointId;
    const diffHash = cloudPatchIdentity.diffHash;
    if (!checkpointId || !diffHash)
      throw new Error("CLOUD_PATCH_IDENTITY_NOT_FOUND");
    await this.cloud.revalidateInstrumentation(applicationId, planId, {
      checkpointId,
      diffHash,
      validation,
      commandResults,
    });
    return validation;
  }

  async rollback(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    const stored = readLocalState<{ patch: PatchResult }>(
      `instrumentation-result:${planId}`,
    );
    if (!stored) throw new Error("LOCAL_PATCH_RESULT_NOT_FOUND");
    const intent = await this.cloud.instrumentationRollbackIntent(
      applicationId,
      planId,
    );
    const result = await getAdapter(plan.adapterId).rollback(
      this.context(workspace, approval.environmentType),
      stored.patch,
    );
    await this.cloud.submitInstrumentationRollback(
      applicationId,
      planId,
      intent.patchSetId,
      intent.capability,
      result,
    );
    writeLocalState(`instrumentation-rollback:${planId}`, {
      ...result,
      rolledBackAt: new Date().toISOString(),
    });
    return result;
  }

  checkpoint(
    applicationId: string,
    planId: string,
  ): InstrumentationCheckpoint | null {
    this.selected(applicationId);
    assertUuid(planId, "plan_id");
    return readLocalState<InstrumentationCheckpoint>(
      `instrumentation-checkpoint:${planId}`,
    );
  }

  private localPlan(planId: string): InstrumentationPlan {
    assertUuid(planId, "plan_id");
    const value = readLocalState<InstrumentationPlan>(
      `instrumentation-plan:${planId}`,
    );
    if (!value) throw new Error("LOCAL_INSTRUMENTATION_PLAN_NOT_FOUND");
    return validateInstrumentationPlan(value);
  }

  private localApproval(planId: string): LocalApproval {
    const value = readLocalState<LocalApproval>(
      `instrumentation-approval:${planId}`,
    );
    if (!value) throw new Error("LOCAL_INSTRUMENTATION_APPROVAL_NOT_FOUND");
    return value;
  }
}
