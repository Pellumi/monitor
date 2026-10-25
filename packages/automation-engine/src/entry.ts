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
import type { ActionOutcome, AutomationAction, EnvironmentKind, FormInput, SemanticElement, SemanticSnapshot } from './types';

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

export type EntryStopReason = Extract<AutomationStopReason, 'INITIAL_STATE_UNREACHABLE' | 'AUTHENTICATION_FAILED' | 'AUTHORIZATION_BLOCKED' | 'MANUAL_AUTHENTICATION_REQUIRED' | 'SUPPLIED_SESSION_REJECTED'>;

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
  // A persona whose session comes from somewhere else entirely: supplied outright, or fetched from the
  // application before the browser opened. Either way there is no password to type into any form.
  const suppliedSession = options.persona?.authMethod === 'SEEDED' || options.persona?.authMethod === 'API';

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
  //
  // Unless the browser is already signed in, in which case the sign-in page is simply a page that forwards
  // you on, and the edge stands with nothing to fill in. Without this a session that is perfectly good
  // cannot be used at all whenever the only declared way into the authenticated part of an application is
  // through its form — which is the commonest shape there is, and is how every session a run keeps would
  // otherwise have been wasted.
  const navGraph: NavigationGraph = {
    nodes: graph.nodes,
    edges: sessionAuthenticated
      ? graph.edges.map((edge) => (edge.login ? { ...edge, control: null, login: undefined } : edge))
      : graph.edges.filter((edge) => !edge.login),
  };

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

  // The session was handed to this run rather than earned by it, and it did not get in: it was not accepted, or
  // it has expired. There is nothing to type and no form to find, so the one useful thing to say is that.
  if (suppliedSession) {
    return {
      ok: false, stopReason: 'SUPPLIED_SESSION_REJECTED',
      detail: `The session supplied for this persona did not reach ${initialRoute}: the application is treating this browser as signed out.`,
    };
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

  /**
   * Plenty of sign-ins ask who you are on one page and for your password on the next. There is no password field
   * on the first page, which on its own looks exactly like a form this run cannot fill — so before concluding
   * that, the identifier is filled in and the page is allowed to move on. At most `MAX_IDENTIFIER_HOPS` times,
   * and every page is re-checked for something only a person may deal with, so a form that redirects to single
   * sign-on after the email is still handed over rather than typed into.
   */
  let loginPage = reachedLogin.snapshot;
  /** Values already typed on an earlier page of a staged sign-in, so the password page is not asked for them again. */
  const supplied = new Set<string>();
  for (let hops = 0; !hasPasswordField(loginPage) && hops < MAX_IDENTIFIER_HOPS; hops += 1) {
    const advanced = await advanceIdentifierStep(ports, loginPage, loginEdge, loginData, supplied);
    // A page that did not change is a page that did not move on — the identifier was rejected, or that control
    // was not the one. Pressing it again would only type the same thing into the same form.
    if (!advanced || samePage(advanced.snapshot, loginPage)) break;
    loginPage = advanced.snapshot;
    for (const key of advanced.supplied) supplied.add(key);
    const nextChallenge = handOver(loginPage);
    if (nextChallenge) return nextChallenge;
  }

  if (!hasPasswordField(loginPage)) {
    const challenge: AuthChallenge = { kind: 'UNSUPPORTED_LOGIN_FORM', detail: 'This sign-in is not a plain email or username and password form (there is no password field on it), so Tellann cannot fill it in. It needs you to sign in.' };
    return { ok: false, stopReason: 'MANUAL_AUTHENTICATION_REQUIRED', detail: challenge.detail, challenge };
  }
  // Where the password was actually typed, which is not the login page itself when the form asked in two steps.
  const passwordPath = loginPage.path;

  // Only what this page still asks for. A staged sign-in already took the identifier, and its field is gone.
  const remaining = loginInputsForPage(loginEdge.login ?? [], loginPage)
    .filter((field) => !supplied.has(field.dataKey));
  const resolvedLogin = resolveStep(loginPage, { control: loginEdge.control, inputs: remaining, data: loginData, label: 'log in' });
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
  // Submitted the form and never left the page it was on: the credentials were rejected. Compared against where
  // the password was actually typed as well as the login route, because a two-step form ends up somewhere else.
  if (routeMatches(loginEdge.from, afterLogin.path) || afterLogin.path === passwordPath) {
    return { ok: false, stopReason: 'AUTHENTICATION_FAILED', detail: `Submitting the persona's credentials did not leave ${passwordPath}.` };
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

/**
 * How many pages a sign-in may ask for before the password one. Two covers "email, then password" and
 * "email, then choose an account, then password"; past that it is not a form, it is a journey, and a person
 * is better placed to make it than a run following a heuristic.
 */
export const MAX_IDENTIFIER_HOPS = 2;

/**
 * Static analysis can recognise a form as a login form from a nested password input while still
 * failing to recover that input's declaration (component wrappers and spread props are common
 * examples). The live page is authoritative about the controls that are actually present. Once
 * we are on the confirmed login route and have positively identified a visible password input,
 * include it in the login step so the browser is not asked to submit a blank password.
 *
 * This is deliberately password-only: it cannot make the runner type arbitrary persona data into
 * an undeclared field, and the value still has to exist as the selected persona's `password`
 * credential. `resolveStep` performs the normal field matching and fails safely when it does not.
 */
function loginInputsForPage(declared: FormInput[], snapshot: SemanticSnapshot): FormInput[] {
  const inputs = [...declared];
  const declaresPassword = inputs.some(isPasswordInput);
  if (declaresPassword) return inputs;

  const password = snapshot.elements.find((element) =>
    element.visible && element.enabled && element.inputType === 'password');
  if (!password) return inputs;

  inputs.push({
    name: password.fieldName ?? password.name ?? password.label ?? 'password',
    label: password.label ?? password.name ?? null,
    dataKey: 'password',
  });
  return inputs;
}

/** Whether two reads are of the same page, as far as moving a sign-in on is concerned. */
function samePage(a: SemanticSnapshot, b: SemanticSnapshot): boolean {
  return a.path === b.path
    && a.elements.length === b.elements.length
    && a.elements.every((element, index) => element.name === b.elements[index]?.name && element.inputType === b.elements[index]?.inputType);
}

/** A control that moves a staged sign-in on. Deliberately exact: "Continue with Google" is not one of these. */
const CONTINUE_CONTROL = /^(continue|next|sign ?in|log ?in|submit|proceed|go)$/i;

const isPasswordInput = (input: FormInput) => /password/i.test(input.name) || /password/i.test(input.label ?? '');

/**
 * The one control that would move this page on, or null when it cannot be told. A page offering two plausible
 * ones is not something to guess at: the run stops and asks, exactly as it does everywhere else.
 */
function continueControl(snapshot: SemanticSnapshot): SemanticElement | null {
  const clickable = snapshot.elements.filter((element) =>
    element.visible && element.enabled
    && (element.role === 'button' || element.inputType === 'submit'));
  const named = clickable.filter((element) => [element.name, element.label].some((text) => text && CONTINUE_CONTROL.test(text.trim())));
  if (named.length === 1) return named[0]!;
  // No name to go on, but only one thing on the page to press: that is the one.
  return named.length === 0 && clickable.length === 1 ? clickable[0]! : null;
}

/**
 * Fill in what this page of a staged sign-in asks for (everything the Flow declares except the password) and
 * move it on. Returns the page that follows, or null when this is not a page that can be moved on — a missing
 * field, a missing value, two possible controls — in which case the caller reports the form as unfillable.
 */
async function advanceIdentifierStep(
  ports: EntryPorts,
  snapshot: SemanticSnapshot,
  loginEdge: NavigationEdge,
  loginData: (key: string) => MaterializedValue | undefined,
  alreadySupplied: ReadonlySet<string>,
): Promise<{ snapshot: SemanticSnapshot; supplied: string[] } | null> {
  const identifiers = (loginEdge.login ?? []).filter((input) => !isPasswordInput(input) && !alreadySupplied.has(input.dataKey));
  if (identifiers.length === 0) return null;
  const control = continueControl(snapshot);
  if (!control) return null;
  const resolved = resolveStep(snapshot, {
    // The control as the page itself describes it, so the ranking picks out this element and no other.
    control: {
      labels: [control.name, control.label].filter((text): text is string => Boolean(text)),
      testId: control.testId, domId: control.domId, element: control.tag, event: 'click',
      actionAnchor: control.actionAnchor, href: null,
    },
    inputs: identifiers,
    data: loginData,
    label: 'continue signing in',
  });
  if (!resolved.ok) return null;
  const performed = await performStep(ports, resolved);
  if (!performed.ok) return null;
  return { snapshot: await ports.settle(null), supplied: identifiers.map((field) => field.dataKey) };
}

/** A failed walk keeps the page it ended on, so a hand-over to a person (a redirect to a sign-in provider) can be told apart from a broken route. */
type WalkResult = { ok: true; snapshot: SemanticSnapshot } | { ok: false; detail: string; snapshot?: SemanticSnapshot };

/** Perform each navigation edge's control (edges with none are treated as automatic redirects), settling and checking arrival after every step. */
async function walk(ports: EntryPorts, steps: NavigationEdge[], data: (key: string) => MaterializedValue | undefined): Promise<WalkResult> {
  let snapshot = await ports.snapshot();
  for (const edge of steps) {
    // An edge with no control is somewhere the application takes you rather than somewhere you click to.
    // Usually that has already happened by the time the run looks. When it has not, and the destination is a
    // real address rather than a pattern, the run can simply go there — which is what a person with a valid
    // session does, and the only way a kept session reaches a page whose only declared route is a login form.
    if (!edge.control && !routeMatches(edge.to, snapshot.path) && !edge.to.includes('{')) {
      const navigated = await ports.act({ kind: 'NAVIGATE', url: new URL(edge.to, snapshot.url).href });
      if (!navigated.ok) return { ok: false, detail: `Could not open ${edge.to}: ${navigated.error ?? 'unknown error'}`, snapshot };
    }
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
