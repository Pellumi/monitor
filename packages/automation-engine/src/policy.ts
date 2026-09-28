import type { ActionClass, EnvironmentKind } from './types';

/**
 * What an automated run is allowed to do, decided *before* it does it.
 *
 * Browser reasoning does not decide what is safe. Every action carries a class
 * derived from evidence about its handler, and the environment says which classes
 * it permits. Anything unknown is treated as the more dangerous reading, never the
 * safer one: a button with no evidence about what it does is not a READ.
 */

export interface PolicyOptions {
  /**
   * Classes the developer explicitly approved for this run beyond what the environment permits by default
   * (for example EXTERNAL_SIDE_EFFECT for a checkout flow against a sandboxed payment provider).
   * Never widens PRODUCTION.
   */
  approvedClasses?: ActionClass[];
  /** Origins the run may navigate to besides the application's own (for example an auth provider the developer approved). */
  approvedOrigins?: string[];
}

const PERMITTED: Record<EnvironmentKind, ActionClass[]> = {
  DEVELOPMENT: ['READ', 'CLIENT_STATE_MUTATION', 'SERVER_MUTATION'],
  STAGING: ['READ', 'CLIENT_STATE_MUTATION', 'SERVER_MUTATION'],
  // Automated runs are never permitted in production. Listed empty so this
  // table cannot be read as an oversight.
  PRODUCTION: [],
};

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: 'PRODUCTION_BLOCKED' | 'ACTION_CLASS_BLOCKED' | 'EXTERNAL_ORIGIN_BLOCKED'; detail: string };

export function evaluateAction(
  actionClass: ActionClass,
  environment: EnvironmentKind,
  options: PolicyOptions = {},
): PolicyDecision {
  if (environment === 'PRODUCTION') {
    return { allowed: false, reason: 'PRODUCTION_BLOCKED', detail: 'Automated runs are not permitted against production.' };
  }
  if (options.approvedClasses?.includes(actionClass)) return { allowed: true };
  if (PERMITTED[environment].includes(actionClass)) return { allowed: true };
  return {
    allowed: false,
    reason: 'ACTION_CLASS_BLOCKED',
    detail: `${actionClass} actions are not permitted in ${environment} unless explicitly approved.`,
  };
}

/**
 * Whether the browser may go to `url`. The application's own origin is always fine;
 * anything else needs to have been approved, so a "Pay now" redirect to a real
 * payment provider stops the run instead of completing it.
 */
export function evaluateNavigation(url: string, applicationOrigin: string, options: PolicyOptions = {}): PolicyDecision {
  let origin: string;
  try {
    origin = new URL(url, applicationOrigin).origin;
  } catch {
    return { allowed: false, reason: 'EXTERNAL_ORIGIN_BLOCKED', detail: 'The destination is not a valid URL.' };
  }
  if (origin === applicationOrigin) return { allowed: true };
  if ((options.approvedOrigins ?? []).includes(origin)) return { allowed: true };
  return { allowed: false, reason: 'EXTERNAL_ORIGIN_BLOCKED', detail: `Navigation to ${origin} is outside the application.` };
}

const DESTRUCTIVE_LABEL = /\b(delete|remove|destroy|erase|wipe|purge|terminate|deactivate|close account|cancel (my )?(subscription|account|plan))\b/i;
const EXTERNAL_LABEL = /\b(pay|purchase|buy now|place order|checkout|subscribe|charge|send (email|sms|invite)s?|invite)\b/i;

export interface ActionEvidence {
  /** HTTP methods of the endpoints the handler is known to call. */
  methods: string[];
  /** Labels the control carries. */
  labels: string[];
  /** The control is a plain link or navigation (an anchor with an href). */
  isNavigation: boolean;
  /** Whether the handler's calls could be traced at all. */
  handlerTraced: boolean;
  /** The handler submits a form. */
  submitsForm: boolean;
}

/**
 * Classify an action from what the code tells us about its handler.
 *
 * Deliberately conservative in one direction only. Evidence of danger raises the class; a *lack* of evidence
 * never lowers it below CLIENT_STATE_MUTATION for anything that is not a plain link,
 * because "we could not see what it does" is not "it does nothing".
 */
export function classifyAction(evidence: ActionEvidence): ActionClass {
  const methods = evidence.methods.map((method) => method.toUpperCase());
  const label = evidence.labels.join(' ');
  if (methods.includes('DELETE') || DESTRUCTIVE_LABEL.test(label)) return 'DESTRUCTIVE';
  if (EXTERNAL_LABEL.test(label)) return 'EXTERNAL_SIDE_EFFECT';
  if (methods.some((method) => method === 'POST' || method === 'PUT' || method === 'PATCH') || evidence.submitsForm) {
    return 'SERVER_MUTATION';
  }
  if (evidence.isNavigation) return 'READ';
  if (evidence.handlerTraced && methods.length > 0 && methods.every((method) => method === 'GET')) return 'READ';
  return 'CLIENT_STATE_MUTATION';
}

/** Which classes may be retried after an ambiguous outcome. A mutation that may have happened must not happen twice. */
export function isRetrySafe(actionClass: ActionClass): boolean {
  return actionClass === 'READ' || actionClass === 'CLIENT_STATE_MUTATION';
}
