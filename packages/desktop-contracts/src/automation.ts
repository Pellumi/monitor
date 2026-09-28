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
  /** The run reached a point only a person can get past (a CAPTCHA, an MFA prompt, single sign-on) and is waiting for them. */
  'QA_AUTOMATION_MANUAL_ACTION_REQUIRED',
  /** The person finished, or the wait ended; the run carries on or stops. */
  'QA_AUTOMATION_MANUAL_ACTION_COMPLETED',
] as const;

/** Where an Automated Run currently is. A substate carried in `QARun.automation`; the public run lifecycle is unchanged. */
export const AutomationExecutionPhaseSchema = z.enum([
  'PREPARING_WORKSPACE',
  'STARTING_APPLICATION',
  'LAUNCHING_BROWSER',
  'BOOTSTRAPPING',
  'SEEKING_INITIAL_STATE',
  /** Paused for a person: signing in by hand where the run cannot (SSO, MFA, CAPTCHA). */
  'AWAITING_USER',
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
  /** The login is not a plain email/username and password form, and nobody signed in by hand. */
  'MANUAL_AUTHENTICATION_REQUIRED',
  /** Automated Run does not yet understand this kind of application. Not a finding, and not a failure. */
  'FRAMEWORK_NOT_YET_SUPPORTED',
  /** The Flow declares what a run needs (an account, an environment, data) and this run does not have it. */
  'FLOW_REQUIREMENTS_NOT_MET',
  /** A step the Flow marks as needing a person (to approve it, or to do it) was not answered. */
  'MANUAL_ACTION_REQUIRED',
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
  // Neither says anything about the application, and neither is a fault of Tellann's machinery: each needs
  // something from the person (an authentication only they can complete, a framework we have not built yet).
  MANUAL_AUTHENTICATION_REQUIRED: 'USER',
  FRAMEWORK_NOT_YET_SUPPORTED: 'USER',
  // Nothing about the application either: the Flow asked for a person or for something the run was not given.
  FLOW_REQUIREMENTS_NOT_MET: 'USER',
  MANUAL_ACTION_REQUIRED: 'USER',
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

/**
 * What leaves the machine about the executable contract a run was compiled into: a hash and counts, never the
 * contract itself. The contract names files, symbols and control labels from the developer's source, and stays local
 * (invariant 8); this is enough for a report to say *which* contract a run used and how much of it was derivable.
 */
export const ContractSummarySchema = z.object({
  hash: z.string().length(64),
  flowHash: z.string().length(64),
  analysisIdentity: z.string().max(200).nullable(),
  states: z.number().int().nonnegative(),
  transitions: z.number().int().nonnegative(),
  /** Transitions whose control could be derived from the code. */
  controlsDerived: z.number().int().nonnegative(),
  /** Transitions for which it could not (a mapping that is missing or unclear). */
  controlsMissing: z.number().int().nonnegative(),
  /** Transitions whose control carries a stable `data-tellann-action` anchor. */
  anchored: z.number().int().nonnegative(),
});
export type ContractSummary = z.infer<typeof ContractSummarySchema>;

/** What the desktop reports while a run is going: where it is, and (implicitly, by arriving at all) that it is still alive. */
export const AutomationPhaseUpdateSchema = z.object({
  executionPhase: AutomationExecutionPhaseSchema.optional(),
  awaitingUser: z.object({ kind: z.string().min(1).max(40), detail: z.string().max(300) }).nullable().optional(),
  contract: ContractSummarySchema.optional(),
});
export type AutomationPhaseUpdate = z.infer<typeof AutomationPhaseUpdateSchema>;

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
  /** The last time the desktop reported in. A run that stops reporting is one whose desktop is gone. */
  heartbeatAt: z.string().datetime().optional(),
  /** Set while the run is paused for a person (signing in by hand), so a viewer can say why it is waiting. */
  awaitingUser: z.object({ kind: z.string().max(40), detail: z.string().max(300) }).nullable().optional(),
  /** Which contract the run was compiled into, by hash and counts. */
  contract: ContractSummarySchema.optional(),
});
export type AutomationRunState = z.infer<typeof AutomationRunStateSchema>;

// ---------------------------------------------------------------------------
// The live view of a run, and what a start can be refused with
// ---------------------------------------------------------------------------

/** One line of the live view. Local to this machine and never uploaded, so it may name the controls it is using. */
export const AutomatedRunLiveEventSchema = z.object({
  at: z.string().datetime(),
  type: z.string().max(80),
  text: z.string().max(300),
  tone: z.enum(['info', 'success', 'notice', 'problem']),
});
export type AutomatedRunLiveEvent = z.infer<typeof AutomatedRunLiveEventSchema>;

export const AUTOMATED_RUN_LIVE_EVENT_LIMIT = 100;

/** How a finished run ended, in the words a person reads (see `describeStopReason`). */
export const AutomatedRunOutcomeSchema = z.object({
  stopReason: AutomationStopReasonSchema,
  /** The run as the platform records it. */
  result: z.enum(['COMPLETED', 'COMPLETED_INCOMPLETE', 'FAILED']),
  title: z.string(),
  message: z.string(),
  tone: z.enum(['success', 'notice', 'finding', 'problem']),
  nextStep: z.string().nullable(),
});
export type AutomatedRunOutcome = z.infer<typeof AutomatedRunOutcomeSchema>;

export const AutomatedRunStatusSchema = z.object({
  runId: z.string(),
  applicationId: z.string(),
  /** PREPARING: before the browser. RUNNING: driving. AWAITING_USER: paused for a person. FINISHING: saving evidence. FINISHED: done. */
  state: z.enum(['PREPARING', 'RUNNING', 'AWAITING_USER', 'FINISHING', 'FINISHED']),
  phase: AutomationExecutionPhaseSchema.nullable(),
  awaitingUser: z.object({ kind: z.string(), detail: z.string() }).nullable(),
  targetStateKey: z.string(),
  currentStateKey: z.string().nullable(),
  steps: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  events: z.array(AutomatedRunLiveEventSchema).max(AUTOMATED_RUN_LIVE_EVENT_LIMIT),
  outcome: AutomatedRunOutcomeSchema.nullable(),
});
export type AutomatedRunStatus = z.infer<typeof AutomatedRunStatusSchema>;

/**
 * A start that was declined before anything was created: no run record, no process, no browser. Not an error
 * and not a finding: a limit, said in plain words with the modes that do work.
 */
export const AutomatedRunRefusalSchema = z.object({
  code: z.enum([
    'FRAMEWORK_NOT_YET_SUPPORTED', 'CODE_ANALYSIS_REQUIRED', 'FLOW_MAPPING_REQUIRED', 'FLOW_INVALID', 'CONTROLS_NOT_DERIVED',
    'TARGET_NOT_IN_FLOW', 'TEST_DATA_UNAVAILABLE', 'PROFILE_NOT_APPROVED', 'WORKSPACE_NOT_SELECTED', 'PERSONA_NOT_FOUND',
    'RUN_DATA_NOT_FOUND', 'PROFILE_NOT_FOUND',
  ]),
  title: z.string(),
  message: z.string(),
  tone: z.enum(['notice', 'problem']),
  alternatives: z.array(z.enum(['GUIDED', 'ASSISTED'])).default([]),
});
export type AutomatedRunRefusal = z.infer<typeof AutomatedRunRefusalSchema>;

export type StartAutomatedRunResult = { ok: true; status: AutomatedRunStatus } | { ok: false; refusal: AutomatedRunRefusal };

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

/** What the renderer sends to create or change a profile. It cannot send an approval: approving is its own act. */
export const ExecutionProfileInputSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  applicationId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  processes: z.array(ExecutionProfileProcessSchema).min(1).max(8),
  applicationUrl: z.string().url(),
});
export type ExecutionProfileInput = z.infer<typeof ExecutionProfileInputSchema>;

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
  /**
   * How the run signs this persona in. `PASSWORD` types the stored credentials into an email/username and
   * password form. `MANUAL` is for anything else (single sign-on, MFA, magic links): the run stops at the login
   * page and asks the person to sign in themselves in the browser it opened, then carries on from there.
   * Nothing the person types is recorded.
   */
  authMethod: z.enum(['PASSWORD', 'MANUAL']).default('PASSWORD'),
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
  /**
   * now() + offsetMs. `format` is the shape the form wants: an ISO datetime (default), a date, a time, or a
   * US (MM/DD/YYYY) or EU (DD/MM/YYYY) date for a plain text field that is not a native date input.
   */
  z.object({
    kind: z.literal('FUTURE_TIMESTAMP'),
    offsetMs: z.number().int().positive().max(365 * 86_400_000),
    format: z.enum(['ISO', 'DATE', 'TIME', 'US', 'EU']).optional(),
  }),
  /**
   * A small file to upload into a file field. Its content is held here and handed to the browser directly:
   * nothing is written to disk and no path is involved. The name is a bare file name, never a path.
   */
  z.object({
    kind: z.literal('FILE'),
    fileName: z.string().min(1).max(120).regex(/^[^\\/:*?"<>|\u0000-\u001f]+$/, 'A file name, not a path'),
    mimeType: z.string().min(1).max(100).regex(/^[\w.+-]+\/[\w.+-]+$/).optional(),
    content: z.string().max(200_000),
  }),
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
// What the renderer may see and send. Secrets only ever travel one way: in.
// ---------------------------------------------------------------------------

/** A persona as the renderer sees it: what it is called and how it signs in, never what it types. */
export const PersonaViewSchema = z.object({
  id: z.string(),
  applicationId: z.string().uuid(),
  name: z.string(),
  roles: z.array(z.string()),
  authenticated: z.boolean(),
  authMethod: z.enum(['PASSWORD', 'MANUAL']),
  /** Which fields hold a stored value. The values themselves stay on this machine and are never sent back. */
  credentialFields: z.array(z.string()),
  updatedAt: z.string(),
});
export type PersonaView = z.infer<typeof PersonaViewSchema>;

/**
 * What the renderer sends to create or change a persona. A credential with an empty value on an existing persona
 * means "keep what is stored", so editing a name never requires typing a password again.
 */
export const PersonaInputSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  applicationId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  roles: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  authenticated: z.boolean(),
  authMethod: z.enum(['PASSWORD', 'MANUAL']).default('PASSWORD'),
  credentials: z.array(TestPersonaCredentialSchema).max(20).default([]),
});
export type PersonaInput = z.infer<typeof PersonaInputSchema>;

/** A run-data value as the renderer sees it: a secret, or a file's content, is withheld and only its presence is said. */
export const RunDataValueViewSchema = z.object({
  key: z.string(),
  secret: z.boolean(),
  kind: z.enum(['LITERAL', 'FUTURE_TIMESTAMP', 'FILE', 'UNIQUE_SUFFIX']),
  /** A literal's value, or a generator's setting, when it is safe to show. Null for a secret and for a file. */
  display: z.string().nullable(),
  hasStoredValue: z.boolean(),
});
export const RunDataSetViewSchema = z.object({
  id: z.string(),
  applicationId: z.string().uuid(),
  name: z.string(),
  values: z.array(RunDataValueViewSchema),
  updatedAt: z.string(),
});
export type RunDataSetView = z.infer<typeof RunDataSetViewSchema>;

/**
 * Sent to create or change a data set. A secret literal or a file whose value is empty on an existing set keeps what
 * is stored under the same key.
 */
export const RunDataSetInputSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  applicationId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  values: z.array(RunDataValueSchema).max(50),
});
export type RunDataSetInput = z.infer<typeof RunDataSetInputSchema>;

export const ExecutionProfileViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  applicationUrl: z.string(),
  /** What approving it would let Tellann run: the commands, as they will be typed. */
  commands: z.array(z.string()),
  status: z.enum(['APPROVED', 'NEEDS_APPROVAL', 'CHANGED']),
  approvedAt: z.string().nullable(),
});
export type ExecutionProfileView = z.infer<typeof ExecutionProfileViewSchema>;

export const LoginProposalViewSchema = z.object({
  route: z.string(),
  file: z.string(),
  confidence: z.number(),
  fields: z.array(z.string()),
  rationale: z.string(),
});
export type LoginProposalView = z.infer<typeof LoginProposalViewSchema>;

export const AutomationOptionsSchema = z.object({
  /** Null until the application's folder has been connected and scanned: nothing can be said about it yet. */
  support: z.object({
    level: z.enum(['SUPPORTED', 'PARTIAL', 'NOT_YET_SUPPORTED', 'NOT_APPLICABLE', 'UNKNOWN']),
    canRun: z.boolean(),
    title: z.string(),
    message: z.string(),
    alternatives: z.array(z.enum(['GUIDED', 'ASSISTED'])),
  }).nullable(),
  workspaceConnected: z.boolean(),
  analysisReady: z.boolean(),
  profiles: z.array(ExecutionProfileViewSchema),
  /** Suggested profiles from the scan, offered when none is saved. Nothing runs from a proposal. */
  proposedProfiles: z.array(z.object({ profile: ExecutionProfileViewSchema, rationale: z.string(), save: ExecutionProfileInputSchema })),
  personas: z.array(PersonaViewSchema),
  dataSets: z.array(RunDataSetViewSchema),
  login: z.object({
    route: z.string().nullable(),
    source: z.enum(['CODE_PROPOSAL', 'MANUAL']).nullable(),
    proposals: z.array(LoginProposalViewSchema),
  }),
});
export type AutomationOptions = z.infer<typeof AutomationOptionsSchema>;

/** Channel names for the automation IPC. The preload repeats these (it cannot import), and a test keeps the two in step. */
export const AUTOMATION_IPC = {
  options: 'tellann:automation:options',
  start: 'tellann:automation:start',
  cancel: 'tellann:automation:cancel',
  confirmSignedIn: 'tellann:automation:confirm-signed-in',
  status: 'tellann:automation:status',
  statusChanged: 'tellann:automation:status-changed',
  saveProfile: 'tellann:automation:profile:save',
  approveProfile: 'tellann:automation:profile:approve',
  deleteProfile: 'tellann:automation:profile:delete',
  savePersona: 'tellann:automation:persona:save',
  deletePersona: 'tellann:automation:persona:delete',
  saveDataSet: 'tellann:automation:data-set:save',
  deleteDataSet: 'tellann:automation:data-set:delete',
  saveLogin: 'tellann:automation:login:save',
  clearLogin: 'tellann:automation:login:clear',
} as const;

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
    /** The executable contract the run was compiled into, by hash and counts. The contract itself never leaves the desktop. */
    contract: ContractSummarySchema.nullable().default(null),
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
