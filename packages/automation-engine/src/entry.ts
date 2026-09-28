import type { AutomationStopReason, TestPersona } from '@tellann/desktop-contracts';
import { performStep, resolveStep } from './act';
import { pathOnly, routeMatches } from './keys';
import { detectAuthChallenge, hasPasswordField } from './auth-challenge';
import type { AuthChallenge } from './auth-challenge';
import { planPath } from './planner';
import type { NavigationEdge, NavigationGraph } from './planner';
import { evaluateAction } from './policy';
import type { PolicyOptions } from './policy';
import { personaCredentialData } from './persona';
import type { MaterializedValue } from './persona';
import type { ActionOutcome, AutomationAction, EnvironmentKind, SemanticElement, SemanticSnapshot } from './types';

/**
 * The entry sequence: everything before the Flow's declared boundary. Getting from wherever the
 * browser starts to the Flow's initial state is setup, not the thing under test — the paste's
 * "pre-boundary navigation becomes a goal-planning problem" — so it is scored, retried and reported
 * separately from the Flow itself, using the navigation graph rather than the Flow contract.
 *
 * A `TestPersona` carries two different facts that must not be conflated:
 *   - `persona.authenticated` (identity): does this persona ever log in at all? A guest persona
 *     is `false` and must never be walked through a login form.
 *   - the *session*: is the browser, right now, already authenticated as that persona? This is
 *     `false` for a fresh browser and is what actually decides whether declared guards pass while
 *     planning, so it is passed in separately and updated internally the moment login succeeds.
 */

export interface EntryPorts {
  snapshot(): Promise<SemanticSnapshot>;
  act(action: AutomationAction): Promise<ActionOutcome>;
  settle(expectedStateKey: string | null): Promise<SemanticSnapshot>;
}

export type EntryStopReason = Extract<AutomationStopReason, 'INITIAL_STATE_UNREACHABLE' | 'AUTHENTICATION_FAILED' | 'AUTHORIZATION_BLOCKED' | 'MANUAL_AUTHENTICATION_REQUIRED'>;

export type EntryResult =
  | { ok: true; snapshot: SemanticSnapshot }
  | { ok: false; stopReason: EntryStopReason; detail: string; /** Set for `MANUAL_AUTHENTICATION_REQUIRED`: what needs a person, and why. */ challenge?: AuthChallenge };

export interface EntryOptions {
  persona: TestPersona | null;
  /** Whether the current browser session is already authenticated as `persona`. Defaults to false: a fresh session. */
  sessionAuthenticated?: boolean;
  /** Overrides the persona's stored credentials, e.g. to keep them out of a unit test. Defaults to `personaCredentialData(persona)`. */
  loginData?: (key: string) => MaterializedValue | undefined;
  policy?: PolicyOptions;
  /**
   * The application's own origin. With it, a redirect to somebody else's site (an identity provider) is
   * recognised as a hand-over to a person rather than mistaken for a route that failed to load.
   */
  applicationOrigin?: string;
  /** Sign in by hand rather than typing credentials. Set when the persona says so, and when a person has already done it (then false). */
  manualAuthentication?: boolean;
}

export async function seekInitialState(
  ports: EntryPorts,
  graph: NavigationGraph,
  initialRoute: string,
  environment: EnvironmentKind,
  options: EntryOptions,
): Promise<EntryResult> {
  const requiresLogin = options.persona?.authenticated ?? false;
  const roles = options.persona?.roles ?? [];
  const loginData = options.loginData ?? personaCredentialData(options.persona);
  let sessionAuthenticated = options.sessionAuthenticated ?? false;
  const manual = options.manualAuthentication ?? (options.persona?.authMethod === 'MANUAL');

  /** A page a person has to deal with, or null. Checked wherever the run lands, before anything is typed into it. */
  const handOver = (snapshot: SemanticSnapshot | undefined): EntryResult | null => {
    if (!snapshot) return null;
    const challenge = detectAuthChallenge(snapshot, { applicationOrigin: options.applicationOrigin });
    return challenge ? { ok: false, stopReason: 'MANUAL_AUTHENTICATION_REQUIRED', detail: challenge.detail, challenge } : null;
  };
  const unreachable = (walked: { detail: string; snapshot?: SemanticSnapshot }): EntryResult =>
    handOver(walked.snapshot) ?? { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: walked.detail };

  // A login edge carries no guard of its own — an unauthenticated visitor is exactly who it is
  // for — so to an ordinary path search it looks like any other free edge. Left in, the planner
  // would happily route a "direct" plan straight through it with no credentials to fill. Login is
  // performed as its own explicit step below instead; every other plan searches around it.
  const navGraph: NavigationGraph = { nodes: graph.nodes, edges: graph.edges.filter((edge) => !edge.login) };

  const snapshot = await ports.snapshot();
  if (routeMatches(initialRoute, snapshot.path)) return { ok: true, snapshot };
  const early = handOver(snapshot);
  if (early) return early;

  const direct = planPath({ graph: navGraph, fromPath: snapshot.path, toRoute: initialRoute, persona: { authenticated: sessionAuthenticated, roles }, environment, policy: options.policy });
  if (direct.ok) {
    const executed = await walk(ports, direct.steps, () => undefined);
    if (!executed.ok) return unreachable(executed);
    if (!routeMatches(initialRoute, executed.snapshot.path)) {
      return handOver(executed.snapshot) ?? { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `Reached ${executed.snapshot.path} instead of ${initialRoute}.` };
    }
    return { ok: true, snapshot: executed.snapshot };
  }

  if (sessionAuthenticated) {
    // Already logged in and still can't get there: a guard we don't satisfy, or no route at all.
    if (direct.failure.kind === 'BLOCKED_BY_GUARD') {
      return {
        ok: false, stopReason: 'AUTHORIZATION_BLOCKED',
        detail: `${roles.join(', ') || 'This persona'} cannot reach ${initialRoute}: ${direct.failure.blockedBy.map((edge) => edge.id).join(', ')} requires a role it does not have.`,
      };
    }
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `No declared route leads from ${snapshot.path} to ${initialRoute}.` };
  }

  if (!requiresLogin) {
    // A guest persona is never sent through a login form, even if one exists.
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `No route accessible without logging in leads from ${snapshot.path} to ${initialRoute}.` };
  }

  const loginEdge = graph.edges.find((edge) => edge.login);

  if (manual) {
    // The persona signs in by hand. Take the person to the login page if we know the way, and stop there; typing nothing.
    if (loginEdge) {
      const toLoginPage = planPath({ graph: navGraph, fromPath: snapshot.path, toRoute: loginEdge.from, persona: { authenticated: false, roles }, environment, policy: options.policy });
      if (toLoginPage.ok) await walk(ports, toLoginPage.steps, () => undefined);
    }
    const here = await ports.snapshot();
    return {
      ok: false, stopReason: 'MANUAL_AUTHENTICATION_REQUIRED',
      detail: 'This persona signs in by hand. Sign in in the browser Tellann opened and the run will carry on from there.',
      challenge: { kind: 'MANUAL_BY_CHOICE', detail: `Sign in in the browser${here.path ? ` (you are on ${here.path})` : ''}.` },
    };
  }

  if (!loginEdge) {
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `${initialRoute} requires logging in, and no login was found in the application.` };
  }

  const toLogin = planPath({ graph: navGraph, fromPath: snapshot.path, toRoute: loginEdge.from, persona: { authenticated: false, roles }, environment, policy: options.policy });
  if (!toLogin.ok) {
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `No route leads from ${snapshot.path} to the login page.` };
  }
  const reachedLogin = await walk(ports, toLogin.steps, () => undefined);
  if (!reachedLogin.ok) return unreachable(reachedLogin);

  // Before a single credential is typed: is this a login this run may fill in at all?
  const challenged = handOver(reachedLogin.snapshot);
  if (challenged) return challenged;
  if (!hasPasswordField(reachedLogin.snapshot)) {
    const challenge: AuthChallenge = { kind: 'UNSUPPORTED_LOGIN_FORM', detail: 'This sign-in is not a plain email or username and password form (there is no password field on it), so Tellann cannot fill it in. It needs you to sign in.' };
    return { ok: false, stopReason: 'MANUAL_AUTHENTICATION_REQUIRED', detail: challenge.detail, challenge };
  }

  const resolvedLogin = resolveStep(reachedLogin.snapshot, { control: loginEdge.control, inputs: loginEdge.login ?? [], data: loginData, label: 'log in' });
  if (!resolvedLogin.ok) {
    // Missing form, field or credential is a setup problem, not a wrong-password failure.
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `Could not log in: ${resolvedLogin.detail}` };
  }
  const performedLogin = await performStep(ports, resolvedLogin);
  if (!performedLogin.ok) return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `Could not log in: ${performedLogin.error}` };

  const afterLogin = await ports.settle(null);
  // A prompt for a code, a CAPTCHA, or a bounce to an identity provider appears *after* the password is accepted.
  const afterChallenge = handOver(afterLogin);
  if (afterChallenge) return afterChallenge;
  if (routeMatches(loginEdge.from, afterLogin.path)) {
    // Submitted the form and never left the login page: the credentials were rejected.
    return { ok: false, stopReason: 'AUTHENTICATION_FAILED', detail: `Submitting the persona's credentials did not leave ${loginEdge.from}.` };
  }
  sessionAuthenticated = true;
  if (routeMatches(initialRoute, afterLogin.path)) return { ok: true, snapshot: afterLogin };

  const afterLoginPlan = planPath({ graph: navGraph, fromPath: afterLogin.path, toRoute: initialRoute, persona: { authenticated: sessionAuthenticated, roles }, environment, policy: options.policy });
  if (!afterLoginPlan.ok) {
    if (afterLoginPlan.failure.kind === 'BLOCKED_BY_GUARD') {
      return {
        ok: false, stopReason: 'AUTHORIZATION_BLOCKED',
        detail: `Logged in, but ${roles.join(', ') || 'this persona'} cannot reach ${initialRoute}.`,
      };
    }
    return { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `Logged in, but no declared route leads from ${afterLogin.path} to ${initialRoute}.` };
  }
  const final = await walk(ports, afterLoginPlan.steps, () => undefined);
  if (!final.ok) return unreachable(final);
  if (!routeMatches(initialRoute, final.snapshot.path)) {
    return handOver(final.snapshot) ?? { ok: false, stopReason: 'INITIAL_STATE_UNREACHABLE', detail: `Reached ${final.snapshot.path} instead of ${initialRoute}.` };
  }
  return { ok: true, snapshot: final.snapshot };
}

/** A failed walk keeps the page it ended on, so a hand-over to a person (a redirect to a sign-in provider) can be told apart from a broken route. */
type WalkResult = { ok: true; snapshot: SemanticSnapshot } | { ok: false; detail: string; snapshot?: SemanticSnapshot };

/** Perform each navigation edge's control (edges with none are treated as automatic redirects), settling and checking arrival after every step. */
async function walk(ports: EntryPorts, steps: NavigationEdge[], data: (key: string) => MaterializedValue | undefined): Promise<WalkResult> {
  let snapshot = await ports.snapshot();
  for (const edge of steps) {
    if (edge.control) {
      const resolved = resolveStep(snapshot, { control: edge.control, inputs: edge.login ?? [], data, label: edge.id });
      if (resolved.ok) {
        const performed = await performStep(ports, resolved);
        if (!performed.ok) return { ok: false, detail: `${edge.id} failed: ${performed.error}`, snapshot };
      } else if (resolved.reason === 'CONTROL_NOT_FOUND' && (edge.login ?? []).length === 0) {
        // The graph may be stale (a label or test id changed) without the underlying navigation
        // having gone anywhere: fall back to finding whatever is on the live page that actually
        // leads to the edge's declared destination, rather than giving up on the descriptor alone.
        // Never attempted for a login edge, which needs a specific field-bearing form, not any link.
        const discovered = discoverByDestination(snapshot.elements, edge.to);
        if (!discovered) return { ok: false, detail: resolved.detail, snapshot };
        const outcome = await ports.act({ kind: 'CLICK', ref: discovered.ref });
        if (!outcome.ok) return { ok: false, detail: `${edge.id} failed: ${outcome.error ?? 'unknown error'}`, snapshot };
      } else {
        return { ok: false, detail: resolved.detail, snapshot };
      }
    }
    snapshot = await ports.settle(null);
    if (!routeMatches(edge.to, snapshot.path)) {
      return { ok: false, detail: `After ${edge.id}, landed on ${snapshot.path} instead of ${edge.to}.`, snapshot };
    }
  }
  return { ok: true, snapshot };
}

/**
 * Any live, visible, enabled control whose destination plainly matches the route we need —
 * independent of the stale descriptor entirely. A route match is strong enough evidence to act on
 * (an href pointing at `/courses/{param}` is not a coincidence), but only when it is unambiguous:
 * two different live candidates leading to the same declared route is not a control to click, it is
 * a sign the graph no longer reflects one page's structure, and that failure is reported honestly
 * rather than guessed away.
 */
function discoverByDestination(elements: SemanticElement[], targetRoute: string): SemanticElement | null {
  const candidates = elements.filter((element) =>
    element.visible && element.enabled && element.href && routeMatches(targetRoute, pathOnly(element.href)));
  return candidates.length === 1 ? candidates[0]! : null;
}

/**
 * Replay a previously recorded entry path (an Entry Recipe: the route Tellann took to reach the
 * Flow's initial state on an earlier run, cached against the repository, persona and Flow version
 * it was recorded for). Every step's action class is re-checked against the current environment's
 * policy before anything is done — a recipe recorded once must not bypass the checks a fresh plan
 * would apply, especially once cached and reused across environments.
 *
 * A recipe is a hint, not a guarantee: the application may have changed since it was recorded.
 * Any mismatch — a blocked class, a missing control, an unexpected landing route — fails cleanly
 * so the caller can fall back to a full `seekInitialState` search rather than trust a stale path.
 */
export async function replayEntryRecipe(
  ports: EntryPorts,
  steps: NavigationEdge[],
  environment: EnvironmentKind,
  policy?: PolicyOptions,
): Promise<WalkResult> {
  for (const step of steps) {
    const decision = evaluateAction(step.actionClass, environment, policy);
    if (!decision.allowed) return { ok: false, detail: `The recorded step ${step.id} is a ${step.actionClass} action, which ${environment} does not permit: ${decision.detail}` };
  }
  return walk(ports, steps, () => undefined);
}
