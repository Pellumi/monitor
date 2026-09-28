import { AUTOMATION_STOP_REASON_KIND } from './automation';
import type { AutomationStopReason } from './automation';

/**
 * What an Automated Run says to a person about how it went, in plain language.
 *
 * Stop reasons are the engine's vocabulary; nobody should have to read `EXPECTED_TRANSITION_NOT_FOUND`. This is
 * the one place the words live, so the desktop, the report and any later surface say the same thing. Two rules
 * shape the copy. A run that stopped because of the *application* is a finding and is worded as one; a run that
 * stopped because of something on Tellann's side, or something only a person can do, is never worded as if the
 * application were at fault. And a limit of ours (a framework we have not built support for yet) is a notice with a
 * way forward, never an error.
 */

export type MessageTone = 'success' | 'notice' | 'finding' | 'problem';

export interface StopReasonMessage {
  title: string;
  message: string;
  tone: MessageTone;
  /** What the person can do next, when there is something. */
  nextStep: string | null;
}

const OTHER_MODES = 'Meanwhile you can run this Flow in Guided or Assisted mode, which work with any application.';

const MESSAGES: Record<AutomationStopReason, (detail: string | null, target: string | null) => StopReasonMessage> = {
  TERMINAL_STATE_REACHED: (_d, target) => ({
    title: 'Reached the goal',
    message: `Tellann performed every step of the Flow and reached ${target ?? 'the target state'}.`,
    tone: 'success', nextStep: null,
  }),
  INITIAL_STATE_UNREACHABLE: (d) => ({
    title: 'Could not get to where the Flow starts',
    message: d ?? 'Tellann could not find its way from the application\'s first page to the state this Flow begins in.',
    tone: 'finding', nextStep: 'Check that the Flow\'s first state is reachable from the start page for this persona.',
  }),
  TERMINAL_STATE_UNREACHABLE: (d) => ({
    title: 'No declared route leads to the target',
    message: d ?? 'The Flow declares no path from where the run was to the state you chose.',
    tone: 'finding', nextStep: 'Check the Flow\'s transitions, or pick a different target state.',
  }),
  EXPECTED_TRANSITION_NOT_FOUND: (d) => ({
    title: 'A step of the Flow could not be found on the page',
    message: d ?? 'The page did not show the control the Flow says comes next.',
    tone: 'finding', nextStep: 'Open the report to see the page as it was, and what the code says about that step.',
  }),
  TRANSITION_DID_NOT_ADVANCE: (d) => ({
    title: 'A step ran but the next state did not follow',
    message: d ?? 'Tellann performed the step and the application did not move on to the state the Flow declares.',
    tone: 'finding', nextStep: 'The report has a screenshot and a trace of that moment.',
  }),
  STATE_RECOGNITION_AMBIGUOUS: (d) => ({
    title: 'The page could not be matched to a single state',
    message: d ?? 'More than one state of the Flow fits the page equally well, or none does.',
    tone: 'finding', nextStep: 'Adding an instrumentation marker to that page removes the doubt.',
  }),
  AUTHENTICATION_FAILED: () => ({
    title: 'The persona could not sign in',
    message: 'The application did not accept the persona\'s credentials.',
    tone: 'finding', nextStep: 'Check the persona\'s credentials, or set it to sign in manually.',
  }),
  AUTHORIZATION_BLOCKED: (d) => ({
    title: 'This persona is not allowed where the Flow starts',
    message: d ?? 'The persona\'s role does not permit the route the Flow begins on.',
    tone: 'finding', nextStep: 'Choose a persona with the right role.',
  }),
  TEST_DATA_UNAVAILABLE: (d) => ({
    title: 'The run data is missing something the Flow needs',
    message: d ?? 'The data set has no value, or a value the form does not accept, for a field the Flow fills in.',
    tone: 'problem', nextStep: 'Edit the run data set, then start the run again. The application was not changed.',
  }),
  APPLICATION_START_FAILED: (d) => ({
    title: 'The application would not start',
    message: d ?? 'The application did not become ready.',
    tone: 'problem', nextStep: 'Check the execution profile\'s command and readiness check.',
  }),
  APPLICATION_CRASHED: () => ({
    title: 'The application stopped during the run',
    message: 'A process of the application exited while the run was in progress.',
    tone: 'finding', nextStep: 'The application\'s own output is kept with the run.',
  }),
  BROWSER_CRASHED: () => ({
    title: 'The browser closed during the run',
    message: 'The browser Tellann was driving closed before the run finished. This says nothing about your application.',
    tone: 'problem', nextStep: 'Start the run again.',
  }),
  NETWORK_FAILURE: (d) => ({
    title: 'The network failed during the run',
    message: d ?? 'Requests the run depended on failed.',
    tone: 'finding', nextStep: null,
  }),
  UNSAFE_ACTION_BLOCKED: (d) => ({
    title: 'Tellann held back from an action',
    message: d ?? 'The next step is an action this environment\'s safety policy does not allow, so it was not performed.',
    tone: 'notice', nextStep: 'Nothing is wrong with the application. Choose an environment where that action is allowed, or a different path.',
  }),
  MAX_STEPS_EXCEEDED: () => ({
    title: 'The run reached its step limit',
    message: 'It took more steps than allowed without reaching the target.',
    tone: 'finding', nextStep: 'Raise the limit if the Flow is long.',
  }),
  MAX_DURATION_EXCEEDED: () => ({
    title: 'The run reached its time limit',
    message: 'It ran for as long as allowed without reaching the target.',
    tone: 'finding', nextStep: 'Raise the limit if the application is slow.',
  }),
  LOOP_DETECTED: (d) => ({
    title: 'The run was going in circles',
    message: d ?? 'It kept coming back to the same place without getting closer to the target.',
    tone: 'finding', nextStep: null,
  }),
  CANCELLED_BY_USER: () => ({
    title: 'Stopped by you',
    message: 'The run was stopped before it finished. States it did not reach say nothing about the application.',
    tone: 'notice', nextStep: null,
  }),
  AUTOMATION_ENGINE_ERROR: (d) => ({
    title: 'Something went wrong on our side',
    message: `Tellann\'s own automation hit a problem${d ? `: ${d}` : ''}. This is not a finding about your application.`,
    tone: 'problem', nextStep: 'Start the run again. If it keeps happening, please tell us.',
  }),
  MANUAL_AUTHENTICATION_REQUIRED: (d) => ({
    title: 'Signing in needs you',
    message: d ?? 'This application signs people in in a way Tellann does not type into for you (single sign-on, a one-time code, or a CAPTCHA).',
    tone: 'notice', nextStep: 'Sign in yourself in the browser Tellann opened when asked, and the run will carry on from there.',
  }),
  FRAMEWORK_NOT_YET_SUPPORTED: (d) => ({
    title: 'Automated Run does not support this application yet',
    message: d ?? `Automated Run does not understand this kind of application yet. We are working on it and it is coming soon. ${OTHER_MODES}`,
    tone: 'notice', nextStep: 'Use Guided or Assisted mode for now.',
  }),
};

export function describeStopReason(reason: AutomationStopReason, detail: string | null = null, target: string | null = null): StopReasonMessage {
  return MESSAGES[reason](detail, target);
}

/** Whether a run that stopped for this reason is a finding about the application (as opposed to something on Tellann's side or a person's). */
export function isFindingAboutTheApplication(reason: AutomationStopReason): boolean {
  return AUTOMATION_STOP_REASON_KIND[reason] === 'APPLICATION';
}

/**
 * One line of the live view for an event the run recorded, or null for the ones that are not worth a line. The words
 * come from what the run already knows (a Flow step's name, a state's key); they never include a value the run typed,
 * because no event carries one.
 */
export function summarizeAutomationEvent(type: string, data: Record<string, unknown>): { text: string; tone: 'info' | 'success' | 'notice' | 'problem' } | null {
  const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value.slice(0, 120) : null);
  switch (type) {
    case 'QA_AUTOMATION_PLAN_CREATED': return { text: `Planned the run towards ${str(data.targetStateKey) ?? 'the target state'}.`, tone: 'info' };
    case 'QA_AUTOMATION_INITIAL_STATE_REACHED': return { text: `Reached where the Flow starts (${str(data.stateKey) ?? 'first state'}).`, tone: 'success' };
    case 'QA_AUTOMATION_ACTION_SELECTED': return { text: `Doing: ${str(data.action) ?? 'the next step'}.`, tone: 'info' };
    case 'QA_AUTOMATION_ACTION_VERIFIED':
      return data.ok === false
        ? { text: `${str(data.observedState) ? `Ended up in ${str(data.observedState)}` : 'The page did not move on'}, not the expected ${str(data.expectedState) ?? 'state'}.`, tone: 'problem' }
        : { text: `Now in ${str(data.observedState) ?? str(data.expectedState) ?? 'the next state'}.`, tone: 'success' };
    case 'QA_AUTOMATION_ACTION_BLOCKED': return { text: str(data.detail) ?? 'A step was blocked by the safety policy.', tone: 'notice' };
    case 'QA_AUTOMATION_REPLAN': return { text: 'The page was not where expected, so the route was worked out again.', tone: 'notice' };
    case 'QA_AUTOMATION_TERMINAL_STATE_REACHED': return { text: `Reached the goal (${str(data.stateKey) ?? 'target state'}).`, tone: 'success' };
    case 'QA_AUTOMATION_MANUAL_ACTION_REQUIRED': return { text: str(data.detail) ?? 'Waiting for you to sign in.', tone: 'notice' };
    case 'QA_AUTOMATION_MANUAL_ACTION_COMPLETED': return { text: data.outcome === 'DONE' ? 'You finished signing in. Carrying on.' : 'The wait for you to sign in ended.', tone: data.outcome === 'DONE' ? 'success' : 'notice' };
    case 'QA_AUTOMATION_TRACE_RETAINED': return { text: 'Kept a diagnostic trace of the step that went wrong.', tone: 'info' };
    default: return null;
  }
}
