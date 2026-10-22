import {
  checkFlowRequirements,
  materializeRunData,
  personaCredentialData,
  resolveRunData,
  runCoverageReview,
} from "@tellann/automation-engine";
import type {
  AutomationPorts,
  CoverageReviewConfig,
  CoverageReviewResult,
  EnvironmentKind,
  ExecutableContract,
  NavigationGraph,
  PolicyOptions,
} from "@tellann/automation-engine";
import type { AutomationLimits, RunDataSet, TestPersona } from "@tellann/desktop-contracts";
import type { ManagedBrowser, PageDriver } from "./run-executor";
import { personaCredentialDataValues, walkToInitialState } from "./run-executor";

/**
 * The live half of a pre-publish Flow Sustainability Review (criterion 5, reinforcing
 * criterion 3): walks every transition `runCoverageReview` can reach and reports what it
 * found back to `fdrs-api` via the `PATCH .../coverage-walk` route.
 *
 * Deliberately a trimmed sibling of `executeAutomatedRun`, not a mode on it: a coverage walk
 * shares that function's setup (materialize run data, protect what the persona types, get to
 * the Flow's initial state) but has nothing to do with its reporting surface — no render
 * timing, no responsive sweep, no resolver, no report-facing phases. Reusing `walkToInitialState`
 * directly rather than duplicating it keeps the two entry paths — a real run's and a coverage
 * walk's — behaving identically, which matters: a Flow that cannot be entered cannot have its
 * transitions checked either, and that should read as the same failure in both places.
 */

export interface CoverageReviewInput {
  browser: ManagedBrowser;
  driver: PageDriver;
  contract: ExecutableContract;
  navigation: NavigationGraph | null;
  persona: TestPersona | null;
  runData: RunDataSet | null;
  environment: EnvironmentKind;
  applicationOrigin: string;
  limits: AutomationLimits;
  policy?: PolicyOptions;
  cancelled?: () => boolean;
  now?: () => number;
}

export type CoverageReviewOutcome =
  | { ok: true; result: CoverageReviewResult }
  | { ok: false; stopReason: "INITIAL_STATE_UNREACHABLE" | "TEST_DATA_UNAVAILABLE" | "FLOW_REQUIREMENTS_NOT_MET" | "MANUAL_AUTHENTICATION_REQUIRED" | "AUTOMATION_ENGINE_ERROR"; detail: string };

export async function executeCoverageReview(input: CoverageReviewInput): Promise<CoverageReviewOutcome> {
  const now = input.now ?? (() => Date.now());
  try {
    return await execute(input, now);
  } catch (error) {
    let health: "OK" | "BROWSER_CRASHED" | undefined;
    try { health = await input.driver.health?.(); } catch { health = "BROWSER_CRASHED"; }
    const detail = health === "BROWSER_CRASHED"
      ? "The managed browser closed while the coverage walk was in progress."
      : `The coverage walk failed: ${(error instanceof Error ? error.message : String(error)).split(/\r?\n/)[0]!.slice(0, 300)}`;
    return { ok: false, stopReason: "AUTOMATION_ENGINE_ERROR", detail };
  }
}

async function execute(input: CoverageReviewInput, now: () => number): Promise<CoverageReviewOutcome> {
  const materialized = materializeRunData(input.runData, now);
  const requirements = checkFlowRequirements(input.contract, { environment: input.environment, persona: input.persona, materialized });
  if (!requirements.ok) return { ok: false, stopReason: requirements.stopReason, detail: requirements.detail };

  const data = resolveRunData(input.contract, materialized, input.persona);
  input.browser.protectAutomationValues([
    ...personaCredentialDataValues(input.persona),
    ...[...materialized.values()].filter((value) => value.secret).map((value) => value.value),
    ...data.protectedValues,
  ]);

  const initial = input.contract.states.find((state) => state.key === input.contract.initialStateKey);
  const initialRoute = initial?.routePatterns[0];
  if (initialRoute && input.navigation) {
    // `walkToInitialState` reads `AutomatedRunInput`, but only the fields it actually uses —
    // browser, driver, navigation, persona, environment, applicationOrigin, policy, cancelled,
    // onPhase, session, manualAuthentication — so a coverage walk (which offers neither a
    // kept session nor a person to hand a sign-in to) can pass this narrower shape as-is.
    const walked = await walkToInitialState(
      { ...input, targetStateKey: input.contract.initialStateKey },
      initialRoute,
      () => {},
      false,
    );
    if (!walked.ok) {
      if (walked.stopReason === "MANUAL_AUTHENTICATION_REQUIRED" || walked.stopReason === "SUPPLIED_SESSION_REJECTED") {
        return { ok: false, stopReason: "MANUAL_AUTHENTICATION_REQUIRED", detail: walked.detail };
      }
      return { ok: false, stopReason: "INITIAL_STATE_UNREACHABLE", detail: walked.detail };
    }
  }

  const ports: AutomationPorts = {
    snapshot: () => input.driver.snapshot(),
    act: (action) => input.driver.act(action),
    settle: (expected) => input.driver.settle(expected),
    emit: () => {}, // The coverage walk reports one finished result, not a live event stream.
    now,
    health: input.driver.health ? async () => (await input.driver.health?.()) ?? "OK" : undefined,
    data: data.port,
    cancelled: input.cancelled,
  };
  const config: CoverageReviewConfig = {
    contract: input.contract, environment: input.environment, limits: input.limits, policy: input.policy,
  };
  const result = await runCoverageReview(ports, config);
  return { ok: true, result };
}
