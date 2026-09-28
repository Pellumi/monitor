import { pathOnly } from './keys';
import type { SemanticElement, SemanticSnapshot } from './types';

/**
 * Recognising the places a run must hand over to a person.
 *
 * The entry sequence can type an email or username and a password into a plain login form, and that is all it will
 * ever do. Everything else about signing in is something only the person can do, and some of it must never be
 * automated at all:
 *
 *   - a CAPTCHA is a test that exists to tell software from people. It is never solved, bypassed or worked around;
 *   - a one-time code (MFA, SMS, an authenticator app) belongs to the person holding the device;
 *   - single sign-on and social login hand off to another organisation's page, which this run has no business typing into;
 *   - a magic link or passwordless form has nothing to type.
 *
 * Detection is deliberately generous, because the cost is asymmetric: asking a person to sign in when a form would
 * have worked costs them a minute, while typing a persona's password into a page that turned out to be something else
 * is not recoverable. It only reads what is on the page (names, labels, headings, frames and the address); it never
 * reads what a person typed.
 */

export type AuthChallengeKind =
  | 'CAPTCHA'
  | 'MFA'
  | 'SSO'
  | 'EXTERNAL_IDENTITY_PROVIDER'
  | 'PASSWORDLESS'
  /** A login form with no password field: not something this run can fill. */
  | 'UNSUPPORTED_LOGIN_FORM'
  /** The persona was set to sign in by hand. Nothing was wrong; that was the instruction. */
  | 'MANUAL_BY_CHOICE';

export interface AuthChallenge {
  kind: AuthChallengeKind;
  /** Plain language, safe to show: what was seen, and what is needed. */
  detail: string;
}

const CAPTCHA_FRAMES = /(recaptcha|hcaptcha|turnstile|challenges\.cloudflare|arkoselabs|funcaptcha|geetest|captcha)/i;
const CAPTCHA_TEXT = /(captcha|not a (robot|bot)|are you (a )?(human|robot|bot)|(verify|prove|confirm)( that)? you(['’]?re| are)? (a )?(human|person|real person)|human (check|verification)|security check|bot (check|verification|protection))/i;
const MFA_FIELD = /(one[- ]?time|verification|security|authenticat(or|ion)|2fa|two[- ]?factor|otp|passcode|6[- ]?digit|sms|backup) ?(code|pin|token)?/i;
const MFA_HEADING = /(two[- ]?factor|2[- ]?step|multi[- ]?factor|verification code|authenticator app|enter (the|your) (6[- ]digit )?code|check your (phone|email)|we sent (you )?a code)/i;
const SSO_CONTROL = /((continue|sign|log)[ -]?(in|up)?|connect) ?(with|using|via|through) ?(google|microsoft|github|gitlab|okta|azure|apple|facebook|linkedin|twitter|x|slack|auth0|sso|saml|single sign[- ]?on|your (work|company|organi[sz]ation) account)|^(sso|single sign[- ]?on)( login)?$|sign in with sso/i;
const PASSWORDLESS = /(email me a (sign[- ]?in |login |magic )?link|send (me )?a (magic |sign[- ]?in |login )?(link|code)|magic link|passwordless|sign in without a password|use a passkey|sign in with (a )?passkey|touch id|security key)/i;

const texts = (element: SemanticElement): string[] =>
  [element.name, element.label, element.testId, element.domId, element.fieldName].filter((value): value is string => Boolean(value));

const isPasswordField = (element: SemanticElement) => element.inputType === 'password';

/** Whether the page has a field for a password: the line between a login form this run can fill and one it cannot. */
export function hasPasswordField(snapshot: SemanticSnapshot): boolean {
  return snapshot.elements.some((element) => isPasswordField(element) && element.visible && element.enabled);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * The reason a person is needed on this page, or null when there is none. `applicationOrigin` lets an address on
 * someone else's site (an identity provider the login redirected to) be recognised for what it is.
 */
export function detectAuthChallenge(snapshot: SemanticSnapshot, options: { applicationOrigin?: string } = {}): AuthChallenge | null {
  // A CAPTCHA outranks everything: it is the one thing that must never be attempted.
  const frames = snapshot.frameOrigins ?? [];
  const captchaControl = snapshot.elements.find((element) => texts(element).some((text) => CAPTCHA_TEXT.test(text)));
  if (frames.some((frame) => CAPTCHA_FRAMES.test(frame)) || captchaControl || snapshot.headings.some((heading) => CAPTCHA_TEXT.test(heading))) {
    return { kind: 'CAPTCHA', detail: 'This page asks you to prove you are a person (a CAPTCHA). Tellann never tries to get past those, so it needs you to complete it.' };
  }

  if (options.applicationOrigin) {
    const own = hostOf(options.applicationOrigin);
    const here = hostOf(snapshot.url);
    if (own && here && own !== here && !snapshot.url.startsWith('about:')) {
      return { kind: 'EXTERNAL_IDENTITY_PROVIDER', detail: `Signing in sent the browser to ${here}, which is not your application. Tellann does not type into other organisations' sign-in pages, so it needs you to sign in there.` };
    }
  }

  const mfaField = snapshot.elements.find((element) =>
    element.visible && element.enabled && (element.autocomplete === 'one-time-code' || (element.inputType !== 'password' && (element.role === 'textbox' || element.tag === 'input') && texts(element).some((text) => MFA_FIELD.test(text) && /code|pin|token|otp|2fa/i.test(text)))));
  if (mfaField || snapshot.headings.some((heading) => MFA_HEADING.test(heading))) {
    return { kind: 'MFA', detail: 'This page asks for a one-time verification code. That code belongs to the person signing in, so Tellann needs you to enter it.' };
  }

  const password = hasPasswordField(snapshot);
  const passwordless = snapshot.elements.find((element) => element.visible && texts(element).some((text) => PASSWORDLESS.test(text)));
  if (!password && passwordless) {
    return { kind: 'PASSWORDLESS', detail: 'This sign-in sends a link or uses a passkey instead of a password, so there is nothing for Tellann to type. It needs you to sign in.' };
  }

  // Single sign-on offered *next to* a password field is an alternative, not a requirement: the form still works.
  const sso = snapshot.elements.find((element) => element.visible && element.enabled && texts(element).some((text) => SSO_CONTROL.test(text)));
  if (!password && sso) {
    return { kind: 'SSO', detail: `This application signs people in through single sign-on ("${(sso.name ?? sso.label ?? 'sign in').slice(0, 60)}"). Tellann does not sign in through another provider on your behalf, so it needs you to.` };
  }
  return null;
}

/** The address a person is on, without the query: for saying where a hand-over happened without echoing tokens in a URL. */
export function describeLocation(snapshot: SemanticSnapshot): string {
  const host = hostOf(snapshot.url);
  return `${host ?? 'the browser'}${pathOnly(snapshot.url)}`;
}
