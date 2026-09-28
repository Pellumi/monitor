import { z } from 'zod';

/**
 * Automated Run contracts.
 *
 * Automated Run executes one pinned, published Flow version from its declared
 * initial state toward one user-selected terminal state. The human owns intent
 * (the declared Flow, the target, the test data policy); Tellann only works out
 * how to realise the transitions and records what it saw.
 */

export const QA_RUN_MODES = ['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY', 'AUTOMATED'] as const;
export const QARunModeSchema = z.enum(QA_RUN_MODES);
export type QARunMode = z.infer<typeof QARunModeSchema>;

/** Evidence events emitted by the desktop automation loop. Never emitted by the application under test. */
export const QA_AUTOMATION_EVENT_TYPES = [
  'QA_AUTOMATION_PLAN_CREATED',
  'QA_AUTOMATION_PROCESS',
  'QA_AUTOMATION_STATE_EVALUATED',
  'QA_AUTOMATION_ACTION_SELECTED',
  'QA_AUTOMATION_ACTION_EXECUTED',
  'QA_AUTOMATION_ACTION_VERIFIED',
  'QA_AUTOMATION_ACTION_BLOCKED',
  'QA_AUTOMATION_REPLAN',
  'QA_AUTOMATION_INITIAL_STATE_REACHED',
  'QA_AUTOMATION_TERMINAL_STATE_REACHED',
  'QA_AUTOMATION_STOPPED',
  /** What the code says about a failed transition or unreadable state: locations and hashes, never source text. */
  'QA_AUTOMATION_CODE_EVIDENCE',
  /** A diagnostic trace of one state visit was kept because something went wrong there. */
  'QA_AUTOMATION_TRACE_RETAINED',
  /** How long the Flow's own components took to render in a state. Only when the run opted in, and only for the components it named. */
  'QA_AUTOMATION_RENDER_TIMING',
] as const;

/** Where an Automated Run currently is. A substate carried in `QARun.automation`; the public run lifecycle is unchanged. */
export const AutomationExecutionPhaseSchema = z.enum([
  'PREPARING_WORKSPACE',
  'STARTING_APPLICATION',
  'LAUNCHING_BROWSER',
  'BOOTSTRAPPING',
  'SEEKING_INITIAL_STATE',
  'EXECUTING_FLOW',
  'VERIFYING_TERMINAL_STATE',
  'FLUSHING_EVIDENCE',
  'SHUTTING_DOWN',
]);
export type AutomationExecutionPhase = z.infer<typeof AutomationExecutionPhaseSchema>;

/**
 * Why an Automated Run stopped. `AUTOMATION_STOP_REASON_KIND` is the split that
 * decides the run's outcome: a run the application prevented from reaching the
 * target still produced valid evidence (COMPLETED_INCOMPLETE); a run Tellann
 * itself could not carry out is FAILED. Callers must not re-derive this.
 */
export const AutomationStopReasonSchema = z.enum([
  'TERMINAL_STATE_REACHED',
  'INITIAL_STATE_UNREACHABLE',
  'TERMINAL_STATE_UNREACHABLE',
  'EXPECTED_TRANSITION_NOT_FOUND',
  /** The control was found and acted on, but the state the Flow declares did not follow. */
  'TRANSITION_DID_NOT_ADVANCE',
  'STATE_RECOGNITION_AMBIGUOUS',
  'AUTHENTICATION_FAILED',
  'AUTHORIZATION_BLOCKED',
  'TEST_DATA_UNAVAILABLE',
  'APPLICATION_START_FAILED',
  'APPLICATION_CRASHED',
  'BROWSER_CRASHED',
  'NETWORK_FAILURE',
  'UNSAFE_ACTION_BLOCKED',
  'MAX_STEPS_EXCEEDED',
  'MAX_DURATION_EXCEEDED',
  'LOOP_DETECTED',
  'CANCELLED_BY_USER',
  'AUTOMATION_ENGINE_ERROR',
]);
export type AutomationStopReason = z.infer<typeof AutomationStopReasonSchema>;

export type AutomationStopKind = 'SUCCESS' | 'APPLICATION' | 'INFRASTRUCTURE' | 'USER';

export const AUTOMATION_STOP_REASON_KIND: Record<AutomationStopReason, AutomationStopKind> = {
  TERMINAL_STATE_REACHED: 'SUCCESS',
  INITIAL_STATE_UNREACHABLE: 'APPLICATION',
  TERMINAL_STATE_UNREACHABLE: 'APPLICATION',
  EXPECTED_TRANSITION_NOT_FOUND: 'APPLICATION',
  TRANSITION_DID_NOT_ADVANCE: 'APPLICATION',
  STATE_RECOGNITION_AMBIGUOUS: 'APPLICATION',
  AUTHENTICATION_FAILED: 'APPLICATION',
  AUTHORIZATION_BLOCKED: 'APPLICATION',
  TEST_DATA_UNAVAILABLE: 'INFRASTRUCTURE',
  APPLICATION_START_FAILED: 'INFRASTRUCTURE',
  APPLICATION_CRASHED: 'APPLICATION',
  BROWSER_CRASHED: 'INFRASTRUCTURE',
  NETWORK_FAILURE: 'APPLICATION',
  UNSAFE_ACTION_BLOCKED: 'APPLICATION',
  MAX_STEPS_EXCEEDED: 'APPLICATION',
  MAX_DURATION_EXCEEDED: 'APPLICATION',
  LOOP_DETECTED: 'APPLICATION',
  CANCELLED_BY_USER: 'USER',
  AUTOMATION_ENGINE_ERROR: 'INFRASTRUCTURE',
};

export const AutomationLimitsSchema = z.object({
  maxSteps: z.number().int().positive().max(1_000).default(100),
  maxDurationMs: z.number().int().positive().max(3_600_000).default(600_000),
  maxReplans: z.number().int().nonnegative().max(100).default(10),
  /** Only ever applied to READ / CLIENT_STATE_MUTATION actions; a mutation is never retried. */
  maxActionRetries: z.number().int().nonnegative().max(10).default(2),
});
export type AutomationLimits = z.infer<typeof AutomationLimitsSchema>;

/**
 * The human-owned inputs of an Automated Run. `flowVersionId` is the run's
 * `expectedGraphVersionId` and is not repeated here.
 */
/**
 * How many terminal states one run may be pointed at. The config is *shaped* for several (see
 * `targetTerminalStateKeys`), but running to more than one is a different feature — separate paths,
 * separate fresh state, separate reporting — that is designed but not built (docs/app/
 * automated-run-multi-path-design.md). The ceiling is one constant so that turning it on later is a
 * change to this number and to the executor, not to every stored run.
 */
export const AUTOMATION_MAX_TARGETS = 1;

export const AutomationConfigSchema = z.object({
  targetTerminalStateKey: z.string().min(1).max(200),
  /**
   * The same thing as a list, for runs that will one day cover more than one terminal state. When
   * present, its first entry is `targetTerminalStateKey`; `automationTargets` reads either spelling.
   */
  targetTerminalStateKeys: z.array(z.string().min(1).max(200)).min(1).max(AUTOMATION_MAX_TARGETS).optional(),
  executionProfileId: z.string().min(1).max(200),
  testPersonaId: z.string().min(1).max(200).optional(),
  runDataSetId: z.string().min(1).max(200).optional(),
  limits: AutomationLimitsSchema.default({}),
  /**
   * Opt-in render timing. The names of the Flow's own components (a handful, never the whole
   * application) whose render cost is measured in each state. Empty means nothing is installed
   * in the page at all.
   */
  renderTimingComponents: z.array(z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/).max(80)).max(16).default([]),
});
export type AutomationConfig = z.infer<typeof AutomationConfigSchema>;

/** The terminal states a run is pointed at, from whichever spelling its config used. */
export function automationTargets(config: Pick<AutomationConfig, 'targetTerminalStateKey' | 'targetTerminalStateKeys'>): string[] {
  return config.targetTerminalStateKeys && config.targetTerminalStateKeys.length > 0
    ? config.targetTerminalStateKeys
    : [config.targetTerminalStateKey];
}

/** The two spellings must not disagree: the list, when given, starts with the single key. */
export function automationTargetsConsistent(config: Pick<AutomationConfig, 'targetTerminalStateKey' | 'targetTerminalStateKeys'>): boolean {
  return !config.targetTerminalStateKeys || config.targetTerminalStateKeys[0] === config.targetTerminalStateKey;
}

/**
 * What the server stores in `QARun.automation`: the config plus what was pinned
 * at creation and how the run is going. A report produced months later reads this
 * to state exactly what Tellann was asked to validate.
 */
export const AutomationRunStateSchema = AutomationConfigSchema.extend({
  initialStateKey: z.string().nullable().optional(),
  codeSnapshotId: z.string().nullable().optional(),
  instrumentationManifestVersion: z.string().nullable().optional(),
  executionPhase: AutomationExecutionPhaseSchema.optional(),
  stopReason: AutomationStopReasonSchema.optional(),
});
export type AutomationRunState = z.infer<typeof AutomationRunStateSchema>;

// ---------------------------------------------------------------------------
// Execution profiles
// ---------------------------------------------------------------------------

/**
 * How the runner knows a process is ready to be driven. Readiness is a predicate on
 * the process, never a delay: a fixed sleep is either too short (flaky) or too long (slow).
 */
export const ReadyConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PORT'), port: z.number().int().min(1).max(65_535) }),
  z.object({
    type: z.literal('HTTP'),
    url: z.string().url(),
    /** An exact status to wait for. Omitted means any response below 500: the server is up and answering. */
    status: z.number().int().min(100).max(599).optional(),
  }),
  /** A pattern in the process's own output, e.g. "Local: http://localhost:5173". */
  z.object({ type: z.literal('LOG'), pattern: z.string().min(1).max(200) }),
]);
export type ReadyCondition = z.infer<typeof ReadyConditionSchema>;

/**
 * One process of the application. It names a launch command the workspace scan found rather
 * than carrying its own command line: everything the launcher's allowlist, workspace scoping
 * and approval hash already enforce keeps applying to it unchanged.
 */
export const ExecutionProfileProcessSchema = z.object({
  name: z.string().min(1).max(60),
  launchCommandId: z.string().min(1).max(200),
  readyCondition: ReadyConditionSchema,
  readyTimeoutMs: z.number().int().min(1_000).max(300_000).default(60_000),
});
export type ExecutionProfileProcess = z.infer<typeof ExecutionProfileProcessSchema>;

/**
 * Everything needed to bring the application up for an Automated Run. A profile with no processes
 * targets an application that is already running (a deployed staging environment): it still has to
 * answer at `applicationUrl` before the run starts.
 */
export const ExecutionProfileSchema = z.object({
  id: z.string().min(1).max(200),
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  processes: z.array(ExecutionProfileProcessSchema).max(8),
  applicationUrl: z.string().url(),
  /**
   * Hash of what was approved (workspace, each command as resolved, readiness, URL). A profile whose current
   * hash differs from this is not approved, so a changed script or working directory needs a fresh yes.
   */
  approvedHash: z.string().nullable().default(null),
  approvedAt: z.string().datetime().nullable().default(null),
}).superRefine((profile, context) => {
  const names = new Set<string>();
  for (const [index, process] of profile.processes.entries()) {
    if (names.has(process.name)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['processes', index, 'name'], message: 'Process names must be unique' });
    names.add(process.name);
  }
  try {
    const url = new URL(profile.applicationUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicationUrl'], message: 'applicationUrl must be an http(s) URL without embedded credentials' });
  }
});
export type ExecutionProfile = z.infer<typeof ExecutionProfileSchema>;

// ---------------------------------------------------------------------------
// Test personas and run data
// ---------------------------------------------------------------------------

/**
 * One value a persona types into a login form. `field` is matched the same way a Flow
 * transition's declared input is (by field name or label), so the same matching logic
 * serves both a Flow's own forms and the entry sequence's login form.
 */
export const TestPersonaCredentialSchema = z.object({
  field: z.string().min(1).max(100),
  value: z.string().max(4_000),
});
export type TestPersonaCredential = z.infer<typeof TestPersonaCredentialSchema>;

/**
 * A named identity an Automated Run can act as. Credentials never leave the desktop:
 * they are held in OS-protected storage and are typed into the application, not uploaded.
 * `authenticated: false` describes a persona that never logs in (a guest/anonymous flow) -
 * `credentials` is then meaningless and ignored.
 */
export const TestPersonaSchema = z.object({
  id: z.string().min(1).max(200),
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  roles: z.array(z.string().min(1).max(60)).max(20),
  authenticated: z.boolean(),
  credentials: z.array(TestPersonaCredentialSchema).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TestPersona = z.infer<typeof TestPersonaSchema>;

/**
 * How a run-data value is produced. `LITERAL` is a fixed value; the others are computed
 * fresh per run so a Flow that needs a value never seen before (an email, a due date) does
 * not collide across runs or replays.
 */
export const RunDataGeneratorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LITERAL'), value: z.string().max(4_000) }),
  /** now() + offsetMs, as an ISO datetime. */
  z.object({ kind: z.literal('FUTURE_TIMESTAMP'), offsetMs: z.number().int().positive().max(365 * 86_400_000) }),
  /** `prefix` followed by a short value unique to this run, e.g. "qa-exam-7f3a2c1e". */
  z.object({ kind: z.literal('UNIQUE_SUFFIX'), prefix: z.string().max(100) }),
]);
export type RunDataGenerator = z.infer<typeof RunDataGeneratorSchema>;

export const RunDataValueSchema = z.object({
  /** Matched against a Flow transition's declared input `dataKey`. */
  key: z.string().min(1).max(200),
  generator: RunDataGeneratorSchema,
  /** Typed values are always registered as protected values; SECRET additionally withholds them from artifacts and reveal-by-default. */
  secret: z.boolean().default(false),
});
export type RunDataValue = z.infer<typeof RunDataValueSchema>;

export const RunDataSetSchema = z.object({
  id: z.string().min(1).max(200),
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  values: z.array(RunDataValueSchema).max(50),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((dataSet, context) => {
  const keys = new Set<string>();
  for (const [index, value] of dataSet.values.entries()) {
    if (keys.has(value.key)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['values', index, 'key'], message: 'Data set keys must be unique' });
    keys.add(value.key);
  }
});
export type RunDataSet = z.infer<typeof RunDataSetSchema>;

/** How a typed run-data value is classified for privacy, mirroring `QAPendingProtectedValueSchema.kind`. */
export const RunDataValueKindSchema = z.enum(['ORDINARY', 'DIRECT_IDENTIFIER', 'SECRET']);
export type RunDataValueKind = z.infer<typeof RunDataValueKindSchema>;

// ---------------------------------------------------------------------------
// Report section
// ---------------------------------------------------------------------------

/**
 * One visit to a Flow state during an Automated Run, as the report presents it. Reconstructed
 * from the run's persisted `QA_AUTOMATION_*` evidence events, never from live desktop state, so a
 * report is reproducible from what was actually stored.
 */
export const StateRunRecordSchema = z.object({
  sequence: z.number().int().nonnegative(),
  stateKey: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable(),
  /** The scope the run was in when it recognised the state: setup before the boundary, or the Flow itself. */
  scope: z.enum(['PRE_BOUNDARY', 'IN_FLOW']),
  route: z.string().nullable(),
  enteredAt: z.string().datetime(),
  exitedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  /** The transition performed to leave this state, and whether the state it should have produced followed. */
  action: z.object({
    transitionId: z.string(),
    label: z.string().nullable(),
    actionClass: z.string().nullable(),
    method: z.string().nullable(),
    expectedState: z.string().nullable(),
    observedState: z.string().nullable(),
    verified: z.boolean().nullable(),
    error: z.string().nullable(),
  }).nullable(),
  /** Runtime errors observed while the run was in this state. */
  errorCount: z.number().int().nonnegative(),
});
export type StateRunRecord = z.infer<typeof StateRunRecordSchema>;

export const AutomatedUnreachedStateSchema = z.object({
  stateKey: z.string(),
  /**
   * `BLOCKED_BY_APPLICATION`: the run tried to reach it and the application prevented it (a control
   * was missing, a transition did not advance). `NOT_ATTEMPTED`: the run stopped before it ever got
   * there. The two are not the same claim, and a report must not present the second as the first.
   */
  status: z.enum(['BLOCKED_BY_APPLICATION', 'NOT_ATTEMPTED']),
  detail: z.string().nullable(),
});
export type AutomatedUnreachedState = z.infer<typeof AutomatedUnreachedStateSchema>;

/**
 * What the code says about a step the run could not complete. Locations and a hash of the source
 * range, so a person can find the code and tell whether it has since changed; the source text itself
 * stays on the developer's machine.
 */
export const AutomatedCodeEvidenceSchema = z.object({
  subject: z.object({ kind: z.enum(['TRANSITION', 'STATE']), id: z.string() }),
  /** The state the run was in when it was gathered. */
  stateKey: z.string().nullable(),
  derivation: z.enum(['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']),
  refs: z.array(z.object({
    file: z.string(),
    symbol: z.string().nullable(),
    startLine: z.number().int().positive().nullable(),
    endLine: z.number().int().positive().nullable(),
    excerptSha256: z.string().nullable(),
  })),
  calls: z.array(z.string()),
  navigatesTo: z.array(z.string()),
  guards: z.array(z.object({
    kind: z.string(),
    name: z.string(),
    file: z.string().nullable(),
    requiresAuth: z.boolean(),
    roles: z.array(z.string()),
    route: z.string(),
  })),
  expectedApi: z.array(z.object({ method: z.string(), route: z.string() })),
  /** A deterministic sentence built from the fields above. */
  summary: z.string(),
  at: z.string().datetime(),
});
export type AutomatedCodeEvidence = z.infer<typeof AutomatedCodeEvidenceSchema>;

export const AutomatedRetainedTraceSchema = z.object({
  stateKey: z.string().nullable(),
  reasons: z.array(z.string()),
  at: z.string().datetime(),
});
export type AutomatedRetainedTrace = z.infer<typeof AutomatedRetainedTraceSchema>;

/**
 * The render cost of one of the Flow's own components. Attributed by what the component *is* (the
 * states the Flow maps it to) rather than by when it was read, because a render is read some time
 * after it happened and the run has usually moved on by then.
 */
export const RenderTimingSampleSchema = z.object({
  component: z.string(),
  /** The Flow states this component is the code for. */
  states: z.array(z.string()),
  /** First renders and re-renders of the component during the run. */
  mounts: z.number().int().nonnegative(),
  updates: z.number().int().nonnegative(),
  /** Time spent rendering it (and what it renders), summed and worst single render. */
  totalMs: z.number().nonnegative(),
  maxMs: z.number().nonnegative(),
});
export type RenderTimingSample = z.infer<typeof RenderTimingSampleSchema>;

export const AutomatedRunSectionSchema = z.object({
  pinned: z.object({
    flowVersionId: z.string().nullable(),
    initialStateKey: z.string().nullable(),
    targetTerminalStateKey: z.string().nullable(),
    executionProfileId: z.string().nullable(),
    /** Identifiers only. Persona credentials and run-data values never reach the platform. */
    testPersonaId: z.string().nullable(),
    runDataSetId: z.string().nullable(),
    codeSnapshotId: z.string().nullable(),
    instrumentationManifestVersion: z.string().nullable(),
    limits: AutomationLimitsSchema.nullable(),
  }),
  outcome: z.object({
    stopReason: AutomationStopReasonSchema.nullable(),
    kind: z.enum(['SUCCESS', 'APPLICATION', 'INFRASTRUCTURE', 'USER']).nullable(),
    reachedTarget: z.boolean(),
    detail: z.string().nullable(),
    steps: z.number().int().nonnegative().nullable(),
    replans: z.number().int().nonnegative().nullable(),
  }),
  states: z.array(StateRunRecordSchema),
  preBoundaryStateCount: z.number().int().nonnegative(),
  inFlowStateCount: z.number().int().nonnegative(),
  unreachedStates: z.array(AutomatedUnreachedStateSchema),
  blockedActions: z.array(z.object({
    reason: z.string(),
    transitionId: z.string().nullable(),
    detail: z.string().nullable(),
    at: z.string().datetime(),
  })),
  /** Counts of reconciliation gaps by the reason the run's evidence gives for them. */
  reconciliation: z.record(z.number().int().nonnegative()),
  /** What the code says about each step that failed. Empty for a run that went to plan. */
  codeEvidence: z.array(AutomatedCodeEvidenceSchema).default([]),
  /** Where a diagnostic trace was kept. A clean run keeps none. */
  retainedTraces: z.array(AutomatedRetainedTraceSchema).default([]),
  /** Render cost per state, for the components the run was asked to watch. Empty unless it opted in. */
  renderTiming: z.array(RenderTimingSampleSchema).default([]),
});
export type AutomatedRunSection = z.infer<typeof AutomatedRunSectionSchema>;
