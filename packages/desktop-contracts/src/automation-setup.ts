import type { AutomationExecutionPhase, AutomationOptions } from './automation';

/**
 * What the start form needs to decide, in one place so it can be tested: which endings a Flow offers as a target,
 * what stands between a person and pressing Start (said in plain words, with what to do about each), and the request
 * that Start sends. The form only renders what this says.
 */

export interface DeclaredStateLike {
  stateName?: string | null;
  behaviorKey?: string | null;
  name?: string | null;
  role?: string | null;
  terminalKind?: string | null;
}

export interface TerminalChoice {
  /** Exactly what the platform validates a target against: the state's key as declared, not a tidied version of it. */
  key: string;
  name: string;
  kind: string | null;
}

const KIND_ORDER: Record<string, number> = { SUCCESS: 0, ALTERNATE: 1, CANCELLATION: 2, FAILURE: 3 };

/** The endings of a Flow a run can be pointed at. A success is offered first: it is what nearly everyone means. */
export function terminalChoices(states: DeclaredStateLike[]): TerminalChoice[] {
  return states
    .filter((state) => state.role === 'TERMINAL')
    .flatMap((state) => {
      const key = (state.behaviorKey ?? state.stateName ?? state.name ?? '').trim();
      return key ? [{ key, name: (state.stateName ?? state.name ?? key).trim(), kind: state.terminalKind ?? null }] : [];
    })
    .sort((a, b) => (KIND_ORDER[a.kind ?? ''] ?? 9) - (KIND_ORDER[b.kind ?? ''] ?? 9) || a.name.localeCompare(b.name));
}

export interface AutomatedSelection {
  targetStateKey: string;
  profileId: string;
  personaId: string;
  dataSetId: string;
}

export type BlockerFix =
  | 'CONNECT_FOLDER'
  | 'ANALYSE_CODE'
  | 'INITIALISE_FLOW'
  | 'APPROVE_INSTRUMENTATION'
  | 'CHOOSE_TARGET'
  | 'CHOOSE_PROFILE'
  | 'APPROVE_PROFILE'
  | 'USE_ANOTHER_MODE'
  | 'NONE';

export interface Blocker {
  code: string;
  title: string;
  message: string;
  fix: BlockerFix;
  /** A limit of Tellann's (a framework it cannot read yet) is a notice with a way forward; anything else is something to do. */
  tone: 'notice' | 'todo';
}

export interface BlockerInput {
  options: AutomationOptions | null;
  selection: AutomatedSelection;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  flowReady: boolean;
  /** A validated instrumentation manifest is chosen: the application's own markers are what the run reads its position from. */
  instrumentationChosen: boolean;
  terminals: TerminalChoice[];
}

/** Everything standing in the way of Start, most fundamental first. Empty means the run can begin. */
export function automatedRunBlockers(input: BlockerInput): Blocker[] {
  const blockers: Blocker[] = [];
  const { options, selection } = input;
  if (input.environmentType === 'PRODUCTION') {
    return [{ code: 'PRODUCTION', title: 'Not available for production', message: 'An Automated run operates your application, so it is never run against production. Use Observation only there.', fix: 'USE_ANOTHER_MODE', tone: 'notice' }];
  }
  if (!options) return [{ code: 'LOADING', title: 'Checking this application', message: 'Looking at what Automated Run needs for this application…', fix: 'NONE', tone: 'todo' }];

  if (!options.workspaceConnected) {
    blockers.push({ code: 'NO_WORKSPACE', title: "Connect your application's folder", message: 'Automated Run starts your application from its folder on this computer and reads its code to know what to click.', fix: 'CONNECT_FOLDER', tone: 'todo' });
  } else if (options.support && !options.support.canRun) {
    // Said as what it is: a limit of ours, with the modes that do work. Never an error.
    blockers.push({ code: `SUPPORT_${options.support.level}`, title: options.support.title, message: options.support.message, fix: 'USE_ANOTHER_MODE', tone: 'notice' });
    return blockers;
  } else if (!options.analysisReady) {
    blockers.push({ code: 'NO_ANALYSIS', title: 'Analyse your code first', message: 'Automated Run works out which control performs each step from an analysis of your code, and this application has not been analysed yet.', fix: 'ANALYSE_CODE', tone: 'todo' });
  }
  if (!input.flowReady) {
    blockers.push({ code: 'FLOW_NOT_READY', title: 'Initialise the Flow', message: 'Pick a published Flow that has been initialised for this environment. It is what tells Automated Run which steps to perform.', fix: 'INITIALISE_FLOW', tone: 'todo' });
  }
  if (!input.instrumentationChosen) {
    blockers.push({ code: 'NO_INSTRUMENTATION', title: 'Approve instrumentation first', message: "Automated Run reads where your application says it is from the markers Tellann's instrumentation adds. Apply and validate an instrumentation task, then choose it under Instrumentation evidence.", fix: 'APPROVE_INSTRUMENTATION', tone: 'todo' });
  }
  if (input.terminals.length === 0 && input.flowReady) {
    blockers.push({ code: 'NO_TERMINALS', title: 'This Flow has no ending', message: 'A run needs an ending to aim for. Add a terminal state to the Flow.', fix: 'INITIALISE_FLOW', tone: 'todo' });
  } else if (input.flowReady && (!selection.targetStateKey || !input.terminals.some((terminal) => terminal.key === selection.targetStateKey))) {
    blockers.push({ code: 'NO_TARGET', title: 'Choose where the run should end', message: 'Pick the ending of the Flow you want Tellann to reach.', fix: 'CHOOSE_TARGET', tone: 'todo' });
  }

  const profile = options.profiles.find((candidate) => candidate.id === selection.profileId);
  if (!profile) {
    blockers.push({ code: 'NO_PROFILE', title: 'Choose how to start your application', message: 'Tellann starts your application for you, and only in a way you have approved.', fix: 'CHOOSE_PROFILE', tone: 'todo' });
  } else if (profile.status !== 'APPROVED') {
    blockers.push({
      code: profile.status === 'CHANGED' ? 'PROFILE_CHANGED' : 'PROFILE_NOT_APPROVED',
      title: profile.status === 'CHANGED' ? 'What this would run has changed' : 'Approve how to start your application',
      message: profile.status === 'CHANGED'
        ? 'The commands this profile runs are not the ones you approved. Look at them again and approve, or pick another.'
        : `Review the commands below and approve them before Tellann runs them on this computer: ${profile.commands.join('; ')}`,
      fix: 'APPROVE_PROFILE', tone: 'todo',
    });
  }
  return blockers;
}

export interface StartInputSource {
  applicationId: string;
  environmentId: string;
  workspaceId: string | null;
  flowId: string;
  flowBindingId: string;
  flowInitializationId: string;
  flowScanId: string;
  flowDriftId: string | null;
  expectedGraphVersionId: string;
  patchSetId: string;
  environmentType: 'DEVELOPMENT' | 'STAGING';
  targetUrl: string;
  selection: AutomatedSelection;
  renderTimingComponents?: string[];
}

/** The request Start sends. The modes' shared fields are the same as for a Guided run; `automation` is what is new. */
export function buildAutomatedStartInput(source: StartInputSource) {
  return {
    applicationId: source.applicationId,
    environmentId: source.environmentId,
    workspaceId: source.workspaceId,
    flowId: source.flowId,
    flowBindingId: source.flowBindingId,
    flowInitializationId: source.flowInitializationId,
    flowScanId: source.flowScanId,
    flowDriftId: source.flowDriftId,
    expectedGraphVersionId: source.expectedGraphVersionId,
    captureTracks: ['FRONTEND' as const],
    patchSetId: source.patchSetId,
    environmentType: source.environmentType,
    mode: 'AUTOMATED' as const,
    targetUrl: source.targetUrl,
    automation: {
      targetTerminalStateKey: source.selection.targetStateKey,
      executionProfileId: source.selection.profileId,
      ...(source.selection.personaId ? { testPersonaId: source.selection.personaId } : {}),
      ...(source.selection.dataSetId ? { runDataSetId: source.selection.dataSetId } : {}),
      renderTimingComponents: source.renderTimingComponents ?? [],
    },
  };
}

const PHASES: Record<AutomationExecutionPhase, string> = {
  PREPARING_WORKSPACE: 'Preparing the Flow',
  STARTING_APPLICATION: 'Starting your application',
  LAUNCHING_BROWSER: 'Opening the browser',
  BOOTSTRAPPING: 'Getting ready',
  SEEKING_INITIAL_STATE: 'Getting to where the Flow starts',
  AWAITING_USER: 'Waiting for you to sign in',
  EXECUTING_FLOW: 'Running the Flow',
  VERIFYING_TERMINAL_STATE: 'Confirming the result',
  FLUSHING_EVIDENCE: 'Saving evidence',
  SHUTTING_DOWN: 'Shutting down',
};

export function describeExecutionPhase(phase: AutomationExecutionPhase): string {
  return PHASES[phase];
}

