/**
 * What a declared flow can say beyond "this state, then that one".
 *
 * The flow language (see `flow-language.ts`) names the places and the acts. This is
 * the part that lets Tellann act on them without guessing:
 *
 *   state       recognizer   how to tell the user is here (route, heading, text)
 *   transition  control      what the user operates (link "Courses", button "Create")
 *               inputs       what goes in, and where each value comes from
 *               effects      what the application does in response (POST /courses -> 201)
 *               mode         AUTO, CONFIRM (a person approves) or MANUAL (a person does it)
 *   flow        requires     the account, environment and data a run needs
 *   state       subFlow      a whole other flow used here, so it is drawn once
 *
 * Every field is optional and none is ever invented: a person who has not said what a
 * button is called leaves it out, and the run falls back to what the code analysis
 * shows. What is here overrides that, because a person declared it.
 *
 * Everything in this file is a pure function over untrusted input (a model's answer, a
 * request body, a form), so all of it is defensive: a value that cannot be read
 * safely is dropped rather than repaired into something the person did not write.
 */

export type StepMode = 'AUTO' | 'CONFIRM' | 'MANUAL';
export type InputRole = 'PROTECTED' | 'PROVIDED' | 'GENERATED';
export type ControlRole = 'link' | 'button' | 'tab' | 'menuitem' | 'checkbox' | 'radio' | 'field' | 'select';
export type RunEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export interface StateRecognizer {
  /** Canonical route patterns such as `/courses/{param}`. */
  routes: string[];
  headings: string[];
  texts: string[];
}

export interface TransitionControl {
  role?: ControlRole;
  label: string;
  testId?: string;
}

export interface TransitionInput {
  /** The field as the page names it: "email", "Course title". */
  name: string;
  label?: string;
  /** The run-data key the value is read from. */
  dataKey: string;
  role: InputRole;
}

export interface TransitionEffect {
  method: string;
  /** Canonical route, `/api/courses/{param}`. */
  route: string;
  status?: number;
}

export interface FlowRequires {
  /** Who must be signed in: ADMIN, STUDENT ... Compared with the persona's roles. */
  actor?: string;
  /** Where the flow may be run. Empty means anywhere automated runs are allowed. */
  environments: RunEnvironment[];
  /** Run-data keys the flow needs. Derived from its inputs when the person did not list them. */
  data: string[];
}

export interface SubFlowRef {
  /** The reused flow. Set once the reference is resolved to a flow in the application. */
  flowId?: string;
  /** How a draft names it before it is resolved: the reused flow's name. */
  name?: string;
}

export const STEP_MODES: readonly StepMode[] = ['AUTO', 'CONFIRM', 'MANUAL'];
export const INPUT_ROLES: readonly InputRole[] = ['PROTECTED', 'PROVIDED', 'GENERATED'];
export const CONTROL_ROLES: readonly ControlRole[] = ['link', 'button', 'tab', 'menuitem', 'checkbox', 'radio', 'field', 'select'];
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const MAX_LIST = 6;
const MAX_TEXT = 80;
const MAX_INPUTS = 20;
const MAX_EFFECTS = 6;
const MAX_DATA_KEYS = 30;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function line(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A list, or the single value a person or model gave where a list was meant. */
function listOrOne(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

/**
 * The route pattern a path stands for, the way the run compares them: query and host
 * removed, every dynamic segment (`:id`, `[id]`, `{id}`, `<int:pk>`, `${id}`) written
 * `{param}`, lower case, no trailing slash. Mirrors `canonicalRoute` in `@tellann/shared`
 * (which this package does not depend on); a change to one belongs in both.
 * Returns undefined for something that is not a path.
 */
export function canonicalRoutePattern(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  let route = input.trim().replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  if (!route.startsWith('/')) return undefined;
  route = route.replace(/[?#].*$/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  if (route.length > 200 || /\s/.test(route)) return undefined;
  route = route
    .replace(/\[\.{3}[^\]]+\]/g, '{param}')
    .replace(/\[\[?([^\]]+)\]?\]/g, '{param}')
    .replace(/:[A-Za-z0-9_]+/g, '{param}')
    .replace(/\{[^}]*\}/g, '{param}')
    .replace(/\$\{[^}]*\}/g, '{param}')
    .replace(/<[^>]*>/g, '{param}');
  return route.toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// State: recognizer
// ─────────────────────────────────────────────────────────────

export function sanitizeRecognizer(raw: unknown): StateRecognizer | undefined {
  const source = record(raw);
  if (!source) return undefined;
  const routes = unique(listOrOne(source.routes ?? source.route).map(canonicalRoutePattern).filter((route): route is string => Boolean(route))).slice(0, MAX_LIST);
  const headings = unique(listOrOne(source.headings ?? source.heading).map((item) => line(item)).filter((item): item is string => Boolean(item))).slice(0, MAX_LIST);
  const texts = unique(listOrOne(source.texts ?? source.text).map((item) => line(item)).filter((item): item is string => Boolean(item))).slice(0, MAX_LIST);
  return routes.length || headings.length || texts.length ? { routes, headings, texts } : undefined;
}

// ─────────────────────────────────────────────────────────────
// Transition: control, inputs, effects, mode
// ─────────────────────────────────────────────────────────────

const ROLE_ALIASES: Record<string, ControlRole> = {
  a: 'link', anchor: 'link', link: 'link', button: 'button', btn: 'button', submit: 'button',
  tab: 'tab', menuitem: 'menuitem', 'menu item': 'menuitem', menu: 'menuitem',
  checkbox: 'checkbox', radio: 'radio', input: 'field', field: 'field', textbox: 'field', select: 'select', dropdown: 'select', combobox: 'select',
};

export function sanitizeControl(raw: unknown): TransitionControl | undefined {
  const source = record(raw);
  if (!source) return undefined;
  const label = line(source.label ?? source.name ?? source.text);
  const testId = line(source.testId ?? source.testid, 60);
  if (!label && !testId) return undefined;
  const role = typeof source.role === 'string' ? ROLE_ALIASES[source.role.trim().toLowerCase()] : undefined;
  return { ...(role ? { role } : {}), label: label ?? testId!, ...(testId ? { testId } : {}) };
}

const CREDENTIAL_FIELD = /pass(word|code)?|secret|token|otp|pin\b|credential|api[-_ ]?key|ssn/i;
const DATA_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

function keyFromName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

/** The role a field takes when the person did not say: anything that looks like a credential is protected. */
export function inferInputRole(name: string, dataKey?: string): InputRole {
  return CREDENTIAL_FIELD.test(name) || (dataKey ? CREDENTIAL_FIELD.test(dataKey) : false) ? 'PROTECTED' : 'PROVIDED';
}

export function sanitizeInputs(raw: unknown): TransitionInput[] {
  const seen = new Set<string>();
  const inputs: TransitionInput[] = [];
  for (const item of list(raw)) {
    const source = typeof item === 'string' ? { name: item } : record(item);
    if (!source) continue;
    const name = line(source.name ?? source.field, 60);
    if (!name) continue;
    const declaredKey = line(source.dataKey ?? source.key, 64);
    const dataKey = declaredKey && DATA_KEY.test(declaredKey) ? declaredKey : keyFromName(name).slice(0, 64);
    if (!dataKey || !DATA_KEY.test(dataKey)) continue;
    const declaredRole = typeof source.role === 'string' ? source.role.trim().toUpperCase() as InputRole : undefined;
    // A credential is never downgraded to an ordinary value by a model that forgot to mark it.
    const inferred = inferInputRole(name, dataKey);
    const role = inferred === 'PROTECTED' ? 'PROTECTED' : declaredRole && INPUT_ROLES.includes(declaredRole) ? declaredRole : 'PROVIDED';
    const identity = `${name.toLowerCase()}|${dataKey}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const label = line(source.label, 60);
    inputs.push({ name, ...(label && label.toLowerCase() !== name.toLowerCase() ? { label } : {}), dataKey, role });
    if (inputs.length >= MAX_INPUTS) break;
  }
  return inputs;
}

export function sanitizeEffects(raw: unknown): TransitionEffect[] {
  const seen = new Set<string>();
  const effects: TransitionEffect[] = [];
  for (const item of list(raw)) {
    let source = record(item);
    if (typeof item === 'string') {
      // "POST /courses -> 201"
      const match = /^\s*([A-Za-z]+)\s+(\S+?)(?:\s*(?:->|=>|→|returns?|returning|responds?(?: with)?|responding(?: with)?|with status)\s*(\d{3}))?\s*$/.exec(item);
      if (match) source = { method: match[1], route: match[2], status: match[3] };
    }
    if (!source) continue;
    const method = typeof source.method === 'string' ? source.method.trim().toUpperCase() : '';
    const route = canonicalRoutePattern(source.route ?? source.path ?? source.url);
    if (!route || !(HTTP_METHODS as readonly string[]).includes(method)) continue;
    const status = Number(source.status ?? source.expectStatus);
    const validStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
    const identity = `${method} ${route} ${validStatus ?? ''}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    effects.push({ method, route, ...(validStatus ? { status: validStatus } : {}) });
    if (effects.length >= MAX_EFFECTS) break;
  }
  return effects;
}

export function sanitizeMode(raw: unknown): StepMode | undefined {
  if (typeof raw !== 'string') return undefined;
  const mode = raw.trim().toUpperCase();
  return (STEP_MODES as readonly string[]).includes(mode) ? mode as StepMode : undefined;
}

const NEEDS_A_PERSON = /\b(captcha|otp|one[-_ ]?time|mfa|2fa|two[-_ ]?factor|sso|single[-_ ]?sign|passkey|magic[-_ ]?link|verify[-_ ]?(?:email|phone|identity))\b|(?:^|_)(?:CAPTCHA|OTP|MFA|SSO|PASSKEY|MAGIC_LINK)(?:_|$)/i;
const RISKY = /(?:^|[\s_])(delete|remove|destroy|erase|purge|terminate|deactivate|pay|payments?|purchase|buy|checkout|charge|subscribe|refund|invite|send_?email|send_?sms|publish|archive|cancel_?(?:subscription|account|plan|order))(?:$|[\s_])/i;

/**
 * The mode a step takes when the person did not choose one.
 *
 * Deliberately conservative in one direction only: it never makes a step *more*
 * automatic than AUTO, and asks a person only for the things automation must not do
 * unattended (a code sent to their phone, sign-in through another provider) or that
 * cannot be undone (deleting, paying, sending). A step the person marked AUTO
 * stays AUTO; the caller only asks for an inference when nothing was declared.
 */
export function inferStepMode(step: { action?: string; control?: TransitionControl; effects?: TransitionEffect[] }): StepMode {
  const text = [step.action, step.control?.label].filter(Boolean).join(' ');
  if (NEEDS_A_PERSON.test(text)) return 'MANUAL';
  if (RISKY.test(text.replace(/([a-z])([A-Z])/g, '$1 $2')) || (step.effects ?? []).some((effect) => effect.method === 'DELETE')) return 'CONFIRM';
  return 'AUTO';
}

// ─────────────────────────────────────────────────────────────
// Flow: requires, and state: sub-flow
// ─────────────────────────────────────────────────────────────

const ENVIRONMENT_ALIASES: Record<string, RunEnvironment> = {
  DEV: 'DEVELOPMENT', DEVELOPMENT: 'DEVELOPMENT', LOCAL: 'DEVELOPMENT',
  STAGE: 'STAGING', STAGING: 'STAGING', QA: 'STAGING', TEST: 'STAGING',
  PROD: 'PRODUCTION', PRODUCTION: 'PRODUCTION', LIVE: 'PRODUCTION',
};

export function sanitizeRequires(raw: unknown, inputs: TransitionInput[] = []): FlowRequires | undefined {
  const source = record(raw);
  const actor = line(source?.actor ?? source?.account, 40)?.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const environments = unique(listOrOne(source?.environments ?? source?.environment)
    .map((item) => (typeof item === 'string' ? ENVIRONMENT_ALIASES[item.trim().toUpperCase()] : undefined))
    .filter((item): item is RunEnvironment => Boolean(item)));
  const declared = list(source?.data).map((item) => line(item, 64)).filter((item): item is string => Boolean(item) && DATA_KEY.test(item as string));
  // What the flow types is what it needs, whether or not the person listed it.
  const needed = inputs.filter((input) => input.role !== 'GENERATED').map((input) => input.dataKey);
  const data = unique([...declared, ...needed]).slice(0, MAX_DATA_KEYS);
  if (!actor && !environments.length && !data.length) return undefined;
  return { ...(actor ? { actor } : {}), environments, data };
}

export function sanitizeSubFlow(raw: unknown): SubFlowRef | undefined {
  const source = typeof raw === 'string' ? { name: raw } : record(raw);
  if (!source) return undefined;
  const flowId = typeof source.flowId === 'string' && /^[0-9a-f-]{36}$/i.test(source.flowId) ? source.flowId : undefined;
  const name = line(source.name, 80);
  return flowId || name ? { ...(flowId ? { flowId } : {}), ...(name ? { name } : {}) } : undefined;
}
