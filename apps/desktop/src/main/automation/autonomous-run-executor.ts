import { runAutonomousExploration } from "@tellann/automation-engine";
import type {
  AutonomousConfig,
  AutonomousModelPort,
  AutonomousPlan,
  AutonomousPorts,
  AutonomousQuestionPort,
  AutonomousResult,
  EnvironmentKind,
  ExecutableContract,
} from "@tellann/automation-engine";
import type { PageDriver } from "./run-executor";

/**
 * One autonomous run, start to finish, over an already-launched managed browser positioned at (or
 * reachable from) a state the run's contract declares. Mirrors `run-executor.ts`'s composition role
 * for the deterministic engine — this file is only wiring; which decisions to make belongs to
 * `runAutonomousExploration`.
 *
 * Deliberately narrower than `executeAutomatedRun` for now: no entry-walk/sign-in sequence, no
 * render-timing or responsive sweep, no diagnostics capture. Those are future additions to this
 * composition layer, not gaps in the safety properties that matter — the risk-tier authorization
 * gating every action goes through (`@tellann/agent-policy`) applies unconditionally either way.
 */
export interface AutonomousRunInput {
  driver: PageDriver;
  contract: ExecutableContract;
  plan: AutonomousPlan;
  environment: EnvironmentKind;
  applicationOrigin: string;
  limits: AutonomousConfig["limits"];
  approvedOrigins?: string[];
  /** Null means the run's scope has not been approved by a person; nothing beyond a high-impact approval can proceed. */
  scopeApproval: AutonomousConfig["scopeApproval"];
  model: AutonomousModelPort;
  /** Asks a person a question (a required approval, a missing-information gap). Absent means nobody is there to ask. */
  question?: AutonomousQuestionPort;
  cancelled?: () => boolean;
  data?(dataKey: string): { value: string; secret: boolean } | undefined;
  /** Told about every step the sequencer takes, for the live view. Must not throw into the run. */
  emit?(event: { type: string; at: number; data: Record<string, unknown> }): void;
  now?(): number;
}

export async function executeAutonomousRun(input: AutonomousRunInput): Promise<AutonomousResult> {
  const now = input.now ?? (() => Date.now());
  const ports: AutonomousPorts = {
    snapshot: () => input.driver.snapshot(),
    act: (action) => input.driver.act(action),
    settle: (expected) => input.driver.settle(expected),
    emit: (event) => { try { input.emit?.(event); } catch { /* the live view is not the run */ } },
    now,
    health: input.driver.health ? async () => (await input.driver.health!()) : undefined,
    cancelled: input.cancelled,
    data: input.data,
    model: input.model,
    question: input.question,
  };
  const config: AutonomousConfig = {
    contract: input.contract,
    plan: input.plan,
    environment: input.environment,
    applicationOrigin: input.applicationOrigin,
    limits: input.limits,
    approvedOrigins: input.approvedOrigins,
    scopeApproval: input.scopeApproval,
  };
  return runAutonomousExploration(ports, config);
}
