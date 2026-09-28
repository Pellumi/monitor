// Shared by the desktop and web flow editors: what they show, save and clear when a person declares how a state is
// recognised, how a step is done, and what a run needs. Pure functions, no dependencies, so both apps (and their
// tests) agree on what "empty" means and what a save sends.

/**
 * What a person declares about a flow beyond its states and transitions, as the editor's forms hold it, and back.
 *
 * Forms deal in text a person types (a route per line, a field name); the platform wants cleaned structures. This
 * file is the one place that converts between them, so the editor and its tests agree on what "empty" means and
 * what a save sends. The platform cleans everything again on arrival: nothing here is the last line of defence.
 */

export type StepModeValue = 'AUTO' | 'CONFIRM' | 'MANUAL';
export type InputRoleValue = 'PROTECTED' | 'PROVIDED' | 'GENERATED';

export const STEP_MODE_OPTIONS: ReadonlyArray<{ value: StepModeValue; label: string; hint: string }> = [
  { value: 'AUTO', label: 'Tellann does it', hint: 'The run performs this step by itself.' },
  { value: 'CONFIRM', label: 'Tellann does it, after you approve', hint: 'The run stops and asks you first. Use it for anything that cannot be undone: deleting, paying, sending.' },
  { value: 'MANUAL', label: 'You do it', hint: 'The run waits while you do this step in the browser, then checks it worked and carries on. Use it for a code sent to your phone, single sign-on or a CAPTCHA.' },
];

export const CONTROL_ROLE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Any kind' },
  { value: 'button', label: 'Button' },
  { value: 'link', label: 'Link' },
  { value: 'tab', label: 'Tab' },
  { value: 'menuitem', label: 'Menu item' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Dropdown' },
  { value: 'field', label: 'Text field' },
];

export const INPUT_ROLE_OPTIONS: ReadonlyArray<{ value: InputRoleValue; label: string; hint: string }> = [
  { value: 'GENERATED', label: 'Any unique value', hint: 'A title or a name: Tellann makes one for the run unless your data set has it.' },
  { value: 'PROVIDED', label: 'A value you supply', hint: 'The run data must have it, or the run will not start.' },
  { value: 'PROTECTED', label: 'A secret', hint: 'A credential. Read from the run data or the persona, typed but never recorded, and never invented.' },
];

export const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export const ENVIRONMENT_OPTIONS: ReadonlyArray<{ value: 'DEVELOPMENT' | 'STAGING'; label: string }> = [
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'STAGING', label: 'Staging' },
];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const lines = (value: string): string[] => [...new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))];
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const textList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

// ── state ───────────────────────────────────────────────────────────────────

export interface StateDeclarationSource {
  recognizer?: unknown;
  subFlowId?: string | null;
  description?: string | null;
  actor?: string | null;
}

export interface StateDeclarationForm {
  /** One route per line: `/courses/:id`. */
  routes: string;
  headings: string;
  texts: string;
  subFlowId: string;
  description: string;
  actor: string;
}

export function stateDeclarationForm(state: StateDeclarationSource): StateDeclarationForm {
  const recognizer = isRecord(state.recognizer) ? state.recognizer : {};
  return {
    routes: textList(recognizer.routes).join('\n'),
    headings: textList(recognizer.headings).join('\n'),
    texts: textList(recognizer.texts).join('\n'),
    subFlowId: state.subFlowId ?? '',
    description: state.description ?? '',
    actor: state.actor ?? '',
  };
}

/** What a save sends. An emptied form clears the field, so that removing a route in the editor removes it in the flow. */
export function stateDeclarationSpec(form: StateDeclarationForm): Record<string, unknown> {
  const routes = lines(form.routes);
  const headings = lines(form.headings);
  const texts = lines(form.texts);
  return {
    recognizer: routes.length || headings.length || texts.length ? { routes, headings, texts } : null,
    subFlowId: form.subFlowId.trim() || null,
    description: form.description.trim() || null,
    actor: form.actor.trim() || null,
  };
}

export function sameStateDeclaration(left: StateDeclarationForm, right: StateDeclarationForm): boolean {
  const key = (form: StateDeclarationForm) => JSON.stringify(stateDeclarationSpec(form));
  return key(left) === key(right);
}

// ── transition ──────────────────────────────────────────────────────────────

export interface TransitionDeclarationSource {
  control?: unknown;
  expectedInput?: unknown;
  expectedOutput?: unknown;
  mode?: string | null;
}

export interface InputRow {
  name: string;
  dataKey: string;
  role: InputRoleValue;
}

export interface EffectRow {
  method: string;
  route: string;
  status: string;
}

export interface TransitionDeclarationForm {
  controlRole: string;
  controlLabel: string;
  controlTestId: string;
  inputs: InputRow[];
  effects: EffectRow[];
  mode: StepModeValue;
}

const INPUT_ROLES = new Set<string>(['PROTECTED', 'PROVIDED', 'GENERATED']);

export function transitionDeclarationForm(transition: TransitionDeclarationSource): TransitionDeclarationForm {
  const control = isRecord(transition.control) ? transition.control : {};
  const inputs = (Array.isArray(transition.expectedInput) ? transition.expectedInput : []).flatMap((item): InputRow[] => {
    if (typeof item === 'string') return [{ name: item, dataKey: item, role: 'PROVIDED' }];
    if (!isRecord(item) || !text(item.name)) return [];
    const role = text(item.role).toUpperCase();
    return [{ name: text(item.name), dataKey: text(item.dataKey), role: INPUT_ROLES.has(role) ? role as InputRoleValue : 'PROVIDED' }];
  });
  const effects = (Array.isArray(transition.expectedOutput) ? transition.expectedOutput : []).flatMap((item): EffectRow[] => {
    if (!isRecord(item) || !text(item.route)) return [];
    return [{ method: text(item.method).toUpperCase() || 'GET', route: text(item.route), status: item.status === undefined || item.status === null ? '' : String(item.status) }];
  });
  const mode = text(transition.mode).toUpperCase();
  return {
    controlRole: text(control.role),
    controlLabel: text(control.label),
    controlTestId: text(control.testId),
    inputs,
    effects,
    mode: mode === 'CONFIRM' || mode === 'MANUAL' ? mode : 'AUTO',
  };
}

export function transitionDeclarationSpec(form: TransitionDeclarationForm): Record<string, unknown> {
  const label = form.controlLabel.trim();
  const testId = form.controlTestId.trim();
  const inputs = form.inputs.filter((row) => row.name.trim()).map((row) => ({
    name: row.name.trim(),
    ...(row.dataKey.trim() ? { dataKey: row.dataKey.trim() } : {}),
    role: row.role,
  }));
  const effects = form.effects.filter((row) => row.route.trim()).map((row) => ({
    method: row.method,
    route: row.route.trim(),
    ...(row.status.trim() ? { status: Number(row.status) } : {}),
  }));
  return {
    control: label || testId ? { ...(form.controlRole ? { role: form.controlRole } : {}), ...(label ? { label } : {}), ...(testId ? { testId } : {}) } : null,
    inputs,
    effects,
    mode: form.mode,
  };
}

export function sameTransitionDeclaration(left: TransitionDeclarationForm, right: TransitionDeclarationForm): boolean {
  const key = (form: TransitionDeclarationForm) => JSON.stringify(transitionDeclarationSpec(form));
  return key(left) === key(right);
}

/** A run-data key for a field: `course title` -> `COURSE_TITLE`, and for a credential, prefixed with who signs in (`ADMIN_EMAIL`). */
export function suggestDataKey(fieldName: string, actor?: string): string {
  const key = fieldName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  if (!key) return '';
  const credential = /(?:^|_)(EMAIL|USERNAME|PASSWORD)$/.test(key);
  const who = (actor ?? '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  return credential && who && !key.startsWith(`${who}_`) ? `${who}_${key}` : key;
}

/** The short facts about a step, for showing without opening it: `button "Create"`, `2 inputs`, `POST /courses`, `you do this`. */
export function transitionDeclarationSummary(transition: TransitionDeclarationSource): string[] {
  const form = transitionDeclarationForm(transition);
  const facts: string[] = [];
  if (form.controlLabel) facts.push(`${form.controlRole || 'control'} "${form.controlLabel}"`);
  else if (form.controlTestId) facts.push(`test id ${form.controlTestId}`);
  if (form.inputs.length) facts.push(`${form.inputs.length} input${form.inputs.length === 1 ? '' : 's'}${form.inputs.some((row) => row.role === 'PROTECTED') ? ' (secret)' : ''}`);
  for (const effect of form.effects.slice(0, 2)) facts.push(`${effect.method} ${effect.route}${effect.status ? ` → ${effect.status}` : ''}`);
  if (form.mode === 'CONFIRM') facts.push('you approve first');
  if (form.mode === 'MANUAL') facts.push('you do this');
  return facts;
}

// ── flow ────────────────────────────────────────────────────────────────────

export interface RequiresForm {
  actor: string;
  environments: string[];
  /** One run-data key per line. */
  data: string;
}

export function requiresForm(requires: unknown): RequiresForm {
  const source = isRecord(requires) ? requires : {};
  return { actor: text(source.actor), environments: textList(source.environments), data: textList(source.data).join('\n') };
}

export interface DotenvEntry { key: string; value: string }

const DOTENV_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** One `KEY=value` line, or null for a blank line, a comment, or something that is not an assignment. */
function dotenvLine(raw: string): DotenvEntry | null {
  const line = raw.trim().replace(/^export\s+/, '');
  if (!line || line.startsWith('#')) return null;
  const equals = line.indexOf('=');
  if (equals < 1) return null;
  const key = line.slice(0, equals).trim();
  if (!DOTENV_KEY.test(key)) return null;
  const rest = line.slice(equals + 1).trim();
  const quote = rest[0];
  if (quote === '"' || quote === "'") {
    let end = -1;
    for (let at = 1; at < rest.length; at += 1) {
      if (quote === '"' && rest[at] === '\\') { at += 1; continue; }
      if (rest[at] === quote) { end = at; break; }
    }
    if (end > 0) {
      const inner = rest.slice(1, end);
      // Only double quotes interpret escapes, as in a .env file; single quotes are literal.
      return { key, value: quote === '"' ? inner.replace(/\\(["\\nrt])/g, (_, c: string) => ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[c] ?? c) : inner };
    }
  }
  // Unquoted: an inline comment starts at a space followed by `#`, so a `#` inside a password survives.
  return { key, value: rest.replace(/\s+#.*$/, '').trim() };
}

/** Reads `KEY=value`, `KEY="value"`, `KEY='value'` and `export KEY=value` lines. A later line for the same key wins. */
export function parseDotenv(source: string): { entries: DotenvEntry[]; skipped: number } {
  const byKey = new Map<string, string>();
  let skipped = 0;
  for (const raw of source.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const entry = dotenvLine(raw);
    if (!entry) { skipped += 1; continue; }
    byKey.set(entry.key, entry.value);
  }
  return { entries: [...byKey].map(([key, value]) => ({ key, value })), skipped };
}

/** A key whose value should be treated as secret without asking: passwords, tokens, keys. */
export function isSecretDataKey(key: string): boolean {
  return /(pass(word|wd)?|pwd|secret|token|api.?key|private.?key|credential)/i.test(key);
}

/**
 * The run-data keys a Flow asks for, from what was typed. A line may be a bare key or a pasted `KEY=value`: only
 * the key is kept, because a flow is stored on the platform and a value never belongs there.
 */
export function runDataKeys(value: string): string[] {
  const keys: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const entry = dotenvLine(line);
    if (entry) { keys.push(entry.key); continue; }
    keys.push(...line.split(',').map((item) => item.trim().replace(/^export\s+/, '')).filter((item) => item && !item.startsWith('#')));
  }
  return [...new Set(keys)];
}

/** Whether what was typed includes a value, so the form can say it will not be kept. */
export function runDataHasValues(value: string): boolean {
  return value.split(/\r?\n/).some((line) => (dotenvLine(line)?.value ?? '') !== '');
}

/** `null` clears what the flow requires, so that emptying the form removes the requirement. */
export function requiresSpec(form: RequiresForm): { actor?: string; environments: string[]; data: string[] } | null {
  const actor = form.actor.trim();
  const data = runDataKeys(form.data);
  if (!actor && form.environments.length === 0 && data.length === 0) return null;
  return { ...(actor ? { actor } : {}), environments: [...form.environments], data };
}

export function sameRequires(left: RequiresForm, right: RequiresForm): boolean {
  return JSON.stringify(requiresSpec(left)) === JSON.stringify(requiresSpec(right));
}
