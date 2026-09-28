import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestPersona } from '@tellann/desktop-contracts';
import { detectAuthChallenge, hasPasswordField } from './auth-challenge';
import { seekInitialState } from './entry';
import type { EntryPorts } from './entry';
import type { NavigationEdge, NavigationGraph } from './planner';
import { control, element, snapshot } from './test-fixtures';
import type { ActionOutcome, AutomationAction, SemanticElement, SemanticSnapshot } from './types';

const ORIGIN = 'http://localhost:5173';
const page = (over: Partial<SemanticSnapshot> = {}) => snapshot({ url: `${ORIGIN}/login`, path: '/login', ...over });
const input = (ref: string, over: Partial<SemanticElement>) => element({ ref, tag: 'input', role: 'textbox', ...over });
const password = input('pw', { inputType: 'password', fieldName: 'password', label: 'Password' });
const email = input('em', { inputType: 'email', fieldName: 'email', label: 'Email' });
const detect = (s: SemanticSnapshot) => detectAuthChallenge(s, { applicationOrigin: ORIGIN });

// -- detection ---------------------------------------------------------------

test('a plain email and password form is not a challenge', () => {
  assert.equal(detect(page({ elements: [email, password, element({ ref: 's', name: 'Sign in' })] })), null);
  assert.equal(hasPasswordField(page({ elements: [email, password] })), true);
  assert.equal(hasPasswordField(page({ elements: [email] })), false);
  assert.equal(hasPasswordField(page({ elements: [{ ...password, visible: false }] })), false, 'a hidden password field is not one a person could use');
});

test('a CAPTCHA is recognised from its frame, its words or its heading, and outranks everything else', () => {
  assert.equal(detect(page({ elements: [email, password], frameOrigins: ['www.google.com/recaptcha'] }))?.kind, 'CAPTCHA');
  assert.equal(detect(page({ elements: [email, password], frameOrigins: ['newassets.hcaptcha.com'] }))?.kind, 'CAPTCHA');
  assert.equal(detect(page({ elements: [email, password], frameOrigins: ['challenges.cloudflare.com'] }))?.kind, 'CAPTCHA');
  assert.equal(detect(page({ elements: [email, password, element({ ref: 'c', name: "I'm not a robot", role: 'checkbox' })] }))?.kind, 'CAPTCHA');
  assert.equal(detect(page({ headings: ['Verify you are human'] }))?.kind, 'CAPTCHA');
  // The wording varies from site to site, and a phrase we did not think of is a CAPTCHA that gets typed beside.
  for (const wording of ['I am not a robot', 'I’m not a robot', 'Confirm you are not a robot', 'Please verify you are a human', "Prove you're a person", 'Are you a robot?', 'Human verification', 'Bot protection by Acme', 'Not a bot?']) {
    assert.equal(detect(page({ elements: [email, password, element({ ref: 'c', name: wording, role: 'checkbox' })] }))?.kind, 'CAPTCHA', wording);
  }
  for (const ordinary of ['Remember me', 'Sign in', 'Forgot password?', 'Keep me signed in on this computer']) {
    assert.equal(detect(page({ elements: [email, password, element({ ref: 'c', name: ordinary, role: 'button' })] })), null, `${ordinary} is not a CAPTCHA`);
  }
  // Even on a page that also asks for a code and sits on someone else's domain.
  assert.equal(detectAuthChallenge(page({ url: 'https://idp.example/x', headings: ['Security check'], elements: [input('o', { autocomplete: 'one-time-code' })] }), { applicationOrigin: ORIGIN })?.kind, 'CAPTCHA');
  assert.match(detect(page({ headings: ['Verify you are human'] }))!.detail, /never tries to get past/);
});

test('a one-time code prompt is recognised by its autocomplete token, its label or its heading', () => {
  assert.equal(detect(page({ elements: [input('o', { autocomplete: 'one-time-code' })] }))?.kind, 'MFA');
  assert.equal(detect(page({ elements: [input('o', { label: 'Verification code' })] }))?.kind, 'MFA');
  assert.equal(detect(page({ elements: [input('o', { name: 'Authenticator code' })] }))?.kind, 'MFA');
  assert.equal(detect(page({ headings: ['Two-factor authentication'] }))?.kind, 'MFA');
  assert.equal(detect(page({ headings: ['We sent you a code'] }))?.kind, 'MFA');
});

test('an ordinary field that merely mentions a code is not an MFA prompt', () => {
  assert.equal(detect(page({ elements: [email, password, input('z', { label: 'Zip code' }), input('p', { label: 'Promo code' })] })), null);
});

test('single sign-on with no password field is a challenge; next to a working password form it is not', () => {
  const google = element({ ref: 'g', name: 'Continue with Google' });
  assert.equal(detect(page({ elements: [google] }))?.kind, 'SSO');
  assert.equal(detect(page({ elements: [element({ ref: 'o', name: 'Sign in with Okta' })] }))?.kind, 'SSO');
  assert.equal(detect(page({ elements: [element({ ref: 's', name: 'Log in with SSO' })] }))?.kind, 'SSO');
  assert.equal(detect(page({ elements: [element({ ref: 's', name: 'Sign in with your work account' })] }))?.kind, 'SSO');
  assert.equal(detect(page({ elements: [email, password, google] })), null, 'the password form still works');
  assert.match(detect(page({ elements: [google] }))!.detail, /Continue with Google/);
});

test('magic links and passkeys have nothing to type and are recognised', () => {
  assert.equal(detect(page({ elements: [email, element({ ref: 'm', name: 'Email me a sign-in link' })] }))?.kind, 'PASSWORDLESS');
  assert.equal(detect(page({ elements: [element({ ref: 'k', name: 'Sign in with a passkey' })] }))?.kind, 'PASSWORDLESS');
});

test("landing on somebody else's site is a hand-over to a person, not a broken route", () => {
  const challenge = detect(page({ url: 'https://login.microsoftonline.com/common/oauth2', path: '/common/oauth2' }));
  assert.equal(challenge?.kind, 'EXTERNAL_IDENTITY_PROVIDER');
  assert.match(challenge!.detail, /login\.microsoftonline\.com/);
  assert.equal(detectAuthChallenge(page({ url: 'https://elsewhere.example/' }), {}), null, 'without the application origin there is nothing to compare with');
  assert.equal(detect(page({ url: 'about:blank' })), null);
});

test('the words shown never include a query string, which can carry tokens', () => {
  const challenge = detect(page({ url: 'https://idp.example/authorize?code=SECRET&state=abc', path: '/authorize' }));
  assert.ok(!challenge!.detail.includes('SECRET'));
});

// -- the entry sequence ------------------------------------------------------

class Site implements EntryPorts {
  readonly actions: AutomationAction[] = [];
  private fills: Record<string, string> = {};
  constructor(private pages: Record<string, SemanticSnapshot>, private key: string, private clicks: Record<string, string | ((f: Record<string, string>) => string)>) {}
  async snapshot() { return this.pages[this.key]!; }
  async settle() { return this.pages[this.key]!; }
  async act(action: AutomationAction): Promise<ActionOutcome> {
    this.actions.push(action);
    if (action.kind === 'FILL') this.fills[action.ref] = action.value;
    if (action.kind === 'CLICK') {
      const to = this.clicks[action.ref];
      const dest = typeof to === 'function' ? to(this.fills) : to;
      if (dest) this.key = dest;
    }
    return { ok: true };
  }
}

const edge = (over: Partial<NavigationEdge> & { id: string; from: string; to: string }): NavigationEdge => ({
  kind: 'LINK', actionClass: 'READ', confidence: 1, control: control(), guard: null, evidence: { file: 'a', symbol: null, line: null }, ...over,
});
const graph: NavigationGraph = {
  nodes: ['/login', '/dashboard', '/courses/7'],
  edges: [
    edge({ id: 'login', from: '/login', to: '/dashboard', kind: 'FORM_SUBMIT', actionClass: 'CLIENT_STATE_MUTATION', control: control({ testId: 'go' }), login: [{ name: 'email', label: null, dataKey: 'email' }, { name: 'password', label: null, dataKey: 'password' }] }),
    edge({ id: 'course', from: '/dashboard', to: '/courses/7', control: control({ labels: ['Course'] }) }),
  ],
};
const persona = (over: Partial<TestPersona> = {}): TestPersona => ({
  id: 'p', applicationId: '11111111-1111-4111-8111-111111111111', name: 'T', roles: ['TEACHER'], authenticated: true, authMethod: 'PASSWORD',
  credentials: [{ field: 'email', value: 'teacher@x.test' }, { field: 'password', value: 'hunter2' }], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const submit = element({ ref: 'go', testId: 'go', name: 'Log in' });
const at = (path: string, elements: SemanticElement[], over: Partial<SemanticSnapshot> = {}) => snapshot({ url: `${ORIGIN}${path}`, path, elements, ...over });
const dashboard = at('/dashboard', [element({ ref: 'course', name: 'Course' })]);
const course = at('/courses/7', []);
const run = (site: Site, options: Partial<Parameters<typeof seekInitialState>[4]> = {}) =>
  seekInitialState(site, graph, '/courses/7', 'STAGING', { persona: persona(), applicationOrigin: ORIGIN, ...options });

test('a plain login is filled in as before', async () => {
  const site = new Site({ login: at('/login', [email, password, submit]), dashboard, course }, 'login', { go: 'dashboard', course: 'course' });
  const result = await run(site);
  assert.equal(result.ok, true);
  assert.deepEqual(site.actions.filter((a) => a.kind === 'FILL').map((a) => (a as { ref: string }).ref), ['em', 'pw']);
});

test('single sign-on: nothing is typed, and the run hands over', async () => {
  const site = new Site({ login: at('/login', [element({ ref: 'g', name: 'Continue with Google' })]) }, 'login', {});
  const result = await run(site);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'MANUAL_AUTHENTICATION_REQUIRED');
    assert.equal(result.challenge?.kind, 'SSO');
  }
  assert.deepEqual(site.actions, [], 'the persona\'s credentials went nowhere');
});

test('a CAPTCHA on the login page is never touched, and the credentials are not typed beside it', async () => {
  const site = new Site({ login: at('/login', [email, password, submit], { frameOrigins: ['www.google.com/recaptcha'] }) }, 'login', {});
  const result = await run(site);
  assert.equal(result.ok === false && result.challenge?.kind, 'CAPTCHA');
  assert.deepEqual(site.actions, []);
});

test('a code prompt that appears after the password is accepted hands over instead of reporting a failed login', async () => {
  const mfa = at('/login', [input('otp', { autocomplete: 'one-time-code' })], { headings: ['Two-factor authentication'] });
  const site = new Site({ login: at('/login', [email, password, submit]), mfa }, 'login', { go: 'mfa' });
  const result = await run(site);
  assert.equal(result.ok === false && result.stopReason, 'MANUAL_AUTHENTICATION_REQUIRED');
  assert.equal(result.ok === false && result.challenge?.kind, 'MFA');
});

test('a bounce to an identity provider is a hand-over, not an unreachable state', async () => {
  const idp = snapshot({ url: 'https://accounts.google.com/o/oauth2', path: '/o/oauth2', elements: [input('e', { label: 'Email or phone' })] });
  const site = new Site({ login: at('/login', [email, password, submit]), idp }, 'login', { go: 'idp' });
  const result = await run(site);
  assert.equal(result.ok === false && result.challenge?.kind, 'EXTERNAL_IDENTITY_PROVIDER');
});

test('a login form with no password field is not something to fill', async () => {
  const site = new Site({ login: at('/login', [email, submit]) }, 'login', {});
  const result = await run(site);
  assert.equal(result.ok === false && result.challenge?.kind, 'UNSUPPORTED_LOGIN_FORM');
  assert.deepEqual(site.actions, []);
});

test('wrong credentials are still an authentication failure, not a hand-over', async () => {
  const site = new Site({ login: at('/login', [email, password, submit]), dashboard, course }, 'login', { go: (f) => (f.pw === 'right' ? 'dashboard' : 'login') });
  const result = await run(site);
  assert.equal(result.ok === false && result.stopReason, 'AUTHENTICATION_FAILED');
});

test('a persona set to sign in by hand is taken to the login page and left there, with nothing typed', async () => {
  const site = new Site({ start: at('/', [element({ ref: 'l', name: 'Sign in', testId: 'to-login' })]), login: at('/login', [email, password, submit]) }, 'start', { l: 'login' });
  const withLoginLink: NavigationGraph = { ...graph, nodes: ['/', ...graph.nodes], edges: [edge({ id: 'to-login', from: '/', to: '/login', control: control({ testId: 'to-login' }) }), ...graph.edges] };
  const result = await seekInitialState(site, withLoginLink, '/courses/7', 'STAGING', { persona: persona({ authMethod: 'MANUAL' }), applicationOrigin: ORIGIN });
  assert.equal(result.ok === false && result.challenge?.kind, 'MANUAL_BY_CHOICE');
  assert.deepEqual(site.actions.map((a) => a.kind), ['CLICK'], 'it walked to the login page and typed nothing');
});

test('after a person has signed in, the run carries on from wherever they left the browser', async () => {
  const site = new Site({ dashboard, course }, 'dashboard', { course: 'course' });
  const result = await run(site, { sessionAuthenticated: true, manualAuthentication: false, persona: persona({ authMethod: 'MANUAL' }) });
  assert.equal(result.ok, true);
  assert.deepEqual(site.actions.map((a) => a.kind), ['CLICK']);
});

test('a guest persona meeting a challenge is still handed over, since the page needs a person either way', async () => {
  const site = new Site({ home: at('/', [], { frameOrigins: ['hcaptcha.com'] }) }, 'home', {});
  const result = await seekInitialState(site, graph, '/courses/7', 'STAGING', { persona: persona({ authenticated: false }), applicationOrigin: ORIGIN });
  assert.equal(result.ok === false && result.challenge?.kind, 'CAPTCHA');
});
