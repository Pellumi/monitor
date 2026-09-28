/**
 * The flow language.
 *
 * A declared flow is how a person's picture of their application is written down
 * in terms Tellann can act on. It has to be readable at a glance, and it has to be
 * precise enough that flow initialization can bind each part to code and a QA run
 * can walk it. Both needs are met by the same small vocabulary:
 *
 *   GUEST ──OPEN_APP──▶ LOGIN_PAGE ──SUBMIT_CREDENTIALS──▶ DASHBOARD ──CLICK_COURSES_LINK──▶ COURSES_PAGE
 *
 * - A STATE is a stable place the user is in: `GUEST`, `LOGIN_PAGE`,
 *   `CREATE_COURSE_MODAL`. It is a short noun phrase, never a sentence. What the
 *   person wrote goes in `description`, not in the name.
 * - A TRANSITION is one thing the user does to get from one state to the next:
 *   `CLICK_COURSES_LINK`, `SUBMIT_CREDENTIALS`. It is a short verb phrase.
 *   Whether it applies only sometimes is written in `condition`.
 * - Exactly one state is INITIAL. Every ending is TERMINAL and says how it ended.
 *
 * Everything that produces a draft (an AI provider, the document baseline, a rule
 * template) runs its output through `normalizeWorkflowLanguage`, so the reviewer
 * sees one consistent language whatever produced the draft.
 */

import {
  inferStepMode, sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeMode, sanitizeRecognizer, sanitizeRequires, sanitizeSubFlow,
  type FlowRequires, type StateRecognizer, type StepMode, type SubFlowRef, type TransitionControl, type TransitionEffect, type TransitionInput,
} from './flow-spec';

export const MAX_STATE_WORDS = 4;
export const MAX_STATE_KEY_CHARS = 32;
export const MAX_ACTION_WORDS = 4;
export const MAX_ACTION_KEY_CHARS = 32;

export type LanguageCategory = 'NAVIGATION' | 'UI' | 'BUSINESS' | 'ERROR' | 'SYSTEM';
export type LanguageRole = 'NORMAL' | 'INITIAL' | 'TERMINAL';
export type LanguageTerminalKind = 'SUCCESS' | 'FAILURE' | 'CANCELLATION' | 'ALTERNATE';

export interface LanguageState {
  key?: string;
  name: string;
  category?: string;
  role?: string;
  terminalKind?: string | null;
  description?: string;
  actor?: string;
  /** How to tell the user is in this state (route, heading, text). */
  recognizer?: StateRecognizer;
  /** Another flow used here in place of drawing its states again. */
  subFlow?: SubFlowRef;
  [extra: string]: unknown;
}

export interface LanguageTransition {
  from: string;
  to: string;
  action?: string;
  condition?: string;
  /** What the user operates to do it. */
  control?: TransitionControl;
  /** What goes in, and where each value comes from. */
  inputs?: TransitionInput[];
  /** What the application does in response. */
  effects?: TransitionEffect[];
  /** Absent means AUTO. */
  mode?: StepMode;
  [extra: string]: unknown;
}

export interface LanguageWorkflow {
  key: string;
  name: string;
  states: LanguageState[];
  transitions: LanguageTransition[];
  /** What a run needs before it starts. */
  requires?: FlowRequires;
  [extra: string]: unknown;
}

/**
 * A workflow as it arrives: from a model, a request body or a person. The
 * specification fields may be anything, and `normalizeWorkflowLanguage` decides
 * what of them is usable. What comes out is a `NormalizedWorkflow`.
 */
export interface UntrustedState {
  key?: string;
  name: string;
  category?: string;
  role?: string;
  terminalKind?: string | null;
  description?: string;
  actor?: string;
  recognizer?: unknown;
  subFlow?: unknown;
  [extra: string]: unknown;
}

export interface UntrustedTransition {
  from: string;
  to: string;
  action?: string;
  condition?: string;
  control?: unknown;
  inputs?: unknown;
  effects?: unknown;
  mode?: unknown;
  [extra: string]: unknown;
}

export interface UntrustedWorkflow {
  key: string;
  name: string;
  states: UntrustedState[];
  transitions: UntrustedTransition[];
  requires?: unknown;
  [extra: string]: unknown;
}

export interface FlowLanguageIssue {
  code:
    | 'STATE_NAME_NOT_COMPACT'
    | 'ACTION_MISSING'
    | 'ACTION_GENERIC'
    | 'NO_INITIAL_STATE'
    | 'MULTIPLE_INITIAL_STATES'
    | 'NO_TERMINAL_STATE'
    | 'UNREACHABLE_STATE'
    | 'DEAD_END_STATE'
    /** A declared detail (a route, a control, a request) the source text does not support, so it was left out. */
    | 'UNSUPPORTED_DETAIL';
  severity: 'WARNING' | 'ERROR';
  message: string;
  target?: string;
}

// ─────────────────────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────────────────────

/** Nouns that say a phrase names a place on screen. */
export const PLACE_NOUNS = [
  'page', 'screen', 'modal', 'dialog', 'popup', 'dashboard', 'form', 'view', 'wizard', 'overview',
  'sidebar', 'menu', 'tab', 'panel', 'list', 'table', 'drawer', 'window', 'portal', 'homepage',
] as const;
const PLACE_NOUN_SET = new Set<string>(PLACE_NOUNS);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'their', 'his', 'her', 'its', 'our', 'your', 'my', 'they', 'them', 'he', 'she', 'it', 'this', 'that', 'these',
  'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'will', 'would', 'should', 'can', 'could', 'may', 'shall', 'to', 'of',
  'on', 'in', 'at', 'for', 'from', 'by', 'with', 'into', 'onto', 'and', 'or', 'then', 'so', 'as', 'which', 'who', 'once', 'after',
  'when', 'if', 'also', 'now', 'new', 'own', 'able',
]);

/** Verbs that describe getting somewhere or doing something, never the name of where you are. */
const VERBS = new Set([
  'land', 'lands', 'landed', 'open', 'opens', 'opened', 'see', 'sees', 'view', 'views', 'click', 'clicks', 'clicked', 'tap', 'taps',
  'press', 'presses', 'select', 'selects', 'navigate', 'navigates', 'navigated', 'carried', 'taken', 'redirected', 'routed', 'sent',
  'brought', 'directed', 'appear', 'appears', 'shown', 'show', 'shows', 'display', 'displays', 'displayed', 'refresh', 'refreshes',
  'load', 'loads', 'loaded', 'go', 'goes', 'enter', 'enters', 'input', 'inputs', 'submit', 'submits', 'create', 'creates', 'created',
  'presented', 'get', 'gets', 'got', 'move', 'moves', 'moved', 'arrive', 'arrives', 'arrived', 'take', 'takes', 'return', 'returns',
  'returned',
]);

const GENERIC_ACTIONS = new Set(['NEXT', 'THEN', 'CONTINUE', 'PROCEED', 'GO', 'STEP', 'MOVE_ON', 'NEXT_STEP', 'TRANSITION']);

const SNAKE_KEY = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function toKey(list: string[]): string {
  return list.join('_').toUpperCase();
}

/** Uppercase snake key with no length rules; the shape every state and action key takes. */
export function toSnakeKey(input: string): string {
  return toKey(words(String(input ?? '')));
}

function fit(list: string[], maxWords: number, maxChars: number): string {
  let kept = list.slice(0, maxWords);
  while (kept.length > 1 && toKey(kept).length > maxChars) kept = kept.slice(0, -1);
  return toKey(kept).slice(0, maxChars).replace(/_+$/, '');
}

// ─────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────

/** A name that is already a short key needs no help. */
export function isCompactKey(value: string, maxWords = MAX_STATE_WORDS, maxChars = MAX_STATE_KEY_CHARS): boolean {
  return SNAKE_KEY.test(value) && value.split('_').length <= maxWords && value.length <= maxChars;
}

/** Short, punctuation-free and free of filler words: written as a name, not as a sentence. */
function looksLikeKey(raw: string): boolean {
  const text = raw.trim();
  return /^[A-Za-z][A-Za-z0-9]*(?:[_\s-][A-Za-z0-9]+){0,3}$/.test(text)
    && !words(text).some((word) => STOPWORDS.has(word.toLowerCase()) && word.length > 1 && text.includes(' '));
}

/** The words worth keeping from a phrase: no articles, pronouns, or verbs of arrival. */
function significant(list: string[]): string[] {
  return list.filter((word) => !STOPWORDS.has(word.toLowerCase()) && !VERBS.has(word.toLowerCase()));
}

/**
 * Finds the place a phrase names ("lands on the login page" -> LOGIN_PAGE).
 * Returns null when the phrase names no place.
 */
export function placeKeyFromPhrase(phrase: string): string | null {
  const tokens = words(phrase);
  // In a run of place nouns ("course overview page") the last one is the head noun. A
  // sentence that mentions several places ("on the dashboard sidebar ... navigated to
  // the Courses page") is about where the user ends up, which is the last one named.
  let at = -1;
  tokens.forEach((token, index) => {
    if (PLACE_NOUN_SET.has(token.toLowerCase()) && !PLACE_NOUN_SET.has((tokens[index + 1] ?? '').toLowerCase())) at = index;
  });
  if (at === -1) return null;
  // Take the noun and up to two qualifiers before it ("course overview page"), and a
  // trailing qualifier only when the noun leads ("page not found").
  const before = significant(tokens.slice(Math.max(0, at - 3), at)).slice(-2);
  return fit([...before, tokens[at]], MAX_STATE_WORDS, MAX_STATE_KEY_CHARS);
}

/**
 * A state key from whatever the source called the state.
 *
 * Something already short and key-shaped is only normalised. A sentence is reduced
 * to the place it names, or failing that to its first few meaningful words.
 */
export function compactStateName(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return 'STATE';
  const direct = toSnakeKey(text);
  if (looksLikeKey(text) && isCompactKey(direct)) return direct;
  const place = placeKeyFromPhrase(text);
  if (place) return place;
  const meaningful = significant(words(text));
  return fit(meaningful.length ? meaningful : words(text), 3, MAX_STATE_KEY_CHARS) || 'STATE';
}

/**
 * An action key: a short verb phrase such as CLICK_COURSES_LINK. Generic filler
 * ("next") says nothing a run could act on, so it becomes GO_TO_<destination>.
 */
export function compactActionName(raw: string | undefined | null, destination?: string): string {
  const text = String(raw ?? '').trim();
  const fallback = destination ? fit(['GO', 'TO', ...words(destination)], MAX_ACTION_WORDS, MAX_ACTION_KEY_CHARS) : '';
  if (!text) return fallback;
  const direct = toSnakeKey(text);
  if (GENERIC_ACTIONS.has(direct)) return fallback;
  if (looksLikeKey(text) && isCompactKey(direct, MAX_ACTION_WORDS, MAX_ACTION_KEY_CHARS)) return direct;
  const list = words(text).filter((word) => !STOPWORDS.has(word.toLowerCase()));
  return fit(list.length ? list : words(text), MAX_ACTION_WORDS, MAX_ACTION_KEY_CHARS) || fallback;
}

export function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ');
}

// ─────────────────────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────────────────────

const FAILURE_NAME = /(FAIL|ERROR|DENIED|INVALID|REJECT|DECLINE|BLOCKED|LOCKED|EXPIRED)/;
const CANCEL_NAME = /(CANCEL|ABANDON|DISMISS|CLOSED)/;

export function inferTerminalKind(state: Pick<LanguageState, 'name' | 'category'>): LanguageTerminalKind {
  const name = toSnakeKey(state.name);
  if (String(state.category ?? '').toUpperCase() === 'ERROR' || FAILURE_NAME.test(name)) return 'FAILURE';
  if (CANCEL_NAME.test(name)) return 'CANCELLATION';
  return 'SUCCESS';
}

const TERMINAL_KINDS = new Set(['SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE']);

/**
 * Exactly one INITIAL, and every ending TERMINAL with a kind. A run plans its path
 * from the initial state to a terminal one, so a flow missing either cannot be run.
 */
/** The little `assignFlowRoles` reads of a state, so callers with richer state shapes need not fit `LanguageState`. */
export interface RoleBearing {
  key?: string;
  name: string;
  category?: string;
  role?: string;
  terminalKind?: string | null;
}

export function assignFlowRoles<S extends RoleBearing>(
  states: S[],
  transitions: Array<Pick<LanguageTransition, 'from' | 'to'>>,
): Array<S & { role: LanguageRole; terminalKind?: string | null }> {
  if (!states.length) return [];
  const incoming = new Set(transitions.map((transition) => transition.to));
  const outgoing = new Set(transitions.map((transition) => transition.from));
  const keyOf = (state: S) => String(state.key ?? state.name);

  const declared = states.filter((state) => state.role === 'INITIAL');
  const initial = declared[0]
    ?? states.find((state) => !incoming.has(keyOf(state)) && state.role !== 'TERMINAL')
    ?? states[0];

  return states.map((state) => {
    const key = keyOf(state);
    if (state === initial) return { ...state, role: 'INITIAL', terminalKind: null };
    const dead = !outgoing.has(key) && states.length > 1;
    if (state.role === 'TERMINAL' || dead) {
      const kind = TERMINAL_KINDS.has(String(state.terminalKind)) ? state.terminalKind as string : inferTerminalKind(state);
      return { ...state, role: 'TERMINAL', terminalKind: kind };
    }
    return { ...state, role: 'NORMAL', terminalKind: null };
  });
}

// ─────────────────────────────────────────────────────────────
// Normalising a whole workflow
// ─────────────────────────────────────────────────────────────

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}_${counter}`)) counter += 1;
  return `${base}_${counter}`;
}

function clip(value: unknown, max: number): string | undefined {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, max) : undefined;
}

/**
 * Rewrites a workflow into the flow language.
 *
 * States get compact keys (`name` and `key` are the same), the sentence a source
 * used moves to `description`, transitions are re-pointed at the new keys and get
 * short verb-phrase actions, and roles are assigned. Transitions that point at a
 * state that does not exist are dropped rather than guessed at.
 */
export type NormalizedWorkflow<W extends UntrustedWorkflow> = Omit<W, 'states' | 'transitions' | 'requires'> & {
  states: Array<LanguageState & { key: string; category: string; role: LanguageRole }>;
  transitions: LanguageTransition[];
  requires?: FlowRequires;
};

export function normalizeWorkflowLanguage<W extends UntrustedWorkflow>(workflow: W): NormalizedWorkflow<W> {
  const taken = new Set<string>();
  const byReference = new Map<string, string>();

  const states = workflow.states.map((state) => {
    const source = String(state.name ?? state.key ?? '').trim() || String(state.key ?? '');
    const compact = compactStateName(source);
    const key = uniqueKey(compact, taken);
    taken.add(key);
    for (const reference of [state.key, state.name, source]) {
      if (typeof reference !== 'string' || !reference.trim()) continue;
      byReference.set(reference, key);
      byReference.set(toSnakeKey(reference), key);
    }
    const wasSentence = toSnakeKey(source) !== key && !isCompactKey(toSnakeKey(source));
    const recognizer = sanitizeRecognizer(state.recognizer);
    const subFlow = sanitizeSubFlow(state.subFlow);
    const { recognizer: _recognizer, subFlow: _subFlow, ...rest } = state;
    return {
      ...rest,
      key,
      name: key,
      category: String(state.category ?? 'BUSINESS').toUpperCase(),
      // The person's own words are worth keeping, just not as the name.
      description: clip(state.description, 240) ?? (wasSentence ? clip(source, 240) : undefined),
      ...(recognizer ? { recognizer } : {}),
      ...(subFlow ? { subFlow } : {}),
    };
  });

  const resolve = (reference: string): string | undefined => byReference.get(reference) ?? byReference.get(toSnakeKey(reference));
  const seen = new Set<string>();
  const transitions: LanguageTransition[] = [];
  for (const transition of workflow.transitions ?? []) {
    const from = resolve(transition.from);
    const to = resolve(transition.to);
    if (!from || !to) continue;
    const action = compactActionName(transition.action, to);
    const condition = clip(transition.condition, 120);
    const identity = `${from}|${to}|${action}|${condition ?? ''}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const control = sanitizeControl(transition.control);
    const inputs = sanitizeInputs(transition.inputs);
    const effects = sanitizeEffects(transition.effects);
    // A step the person marked is kept as marked; only an unmarked one is judged.
    const mode = sanitizeMode(transition.mode) ?? inferStepMode({ action, control, effects });
    const { control: _control, inputs: _inputs, effects: _effects, mode: _mode, ...rest } = transition;
    transitions.push({
      ...rest, from, to, action,
      ...(condition ? { condition } : {}),
      ...(control ? { control } : {}),
      ...(inputs.length ? { inputs } : {}),
      ...(effects.length ? { effects } : {}),
      ...(mode !== 'AUTO' ? { mode } : {}),
    });
  }

  const requires = sanitizeRequires(workflow.requires, transitions.flatMap((transition) => transition.inputs ?? []));
  const { requires: _requires, ...workflowRest } = workflow;
  return { ...workflowRest, states: assignFlowRoles(states, transitions), transitions, ...(requires ? { requires } : {}) } as unknown as NormalizedWorkflow<W>;
}

// ─────────────────────────────────────────────────────────────
// Checking a workflow
// ─────────────────────────────────────────────────────────────

/** What a reviewer, or a QA run, would trip over. An empty list means the flow is in good shape. */
export function lintWorkflowLanguage(workflow: LanguageWorkflow): FlowLanguageIssue[] {
  const issues: FlowLanguageIssue[] = [];
  const keys = workflow.states.map((state) => String(state.key ?? state.name));

  for (const state of workflow.states) {
    const key = String(state.key ?? state.name);
    if (!isCompactKey(key)) {
      issues.push({ code: 'STATE_NAME_NOT_COMPACT', severity: 'WARNING', target: key, message: `"${key.slice(0, 60)}" is not a short state name such as LOGIN_PAGE.` });
    }
  }
  for (const transition of workflow.transitions) {
    const label = `${transition.from} → ${transition.to}`;
    if (!transition.action) issues.push({ code: 'ACTION_MISSING', severity: 'WARNING', target: label, message: `${label} does not say what the user does.` });
    else if (GENERIC_ACTIONS.has(toSnakeKey(transition.action))) {
      issues.push({ code: 'ACTION_GENERIC', severity: 'WARNING', target: label, message: `${label} says "${transition.action}", which a run cannot act on.` });
    }
  }

  const initial = workflow.states.filter((state) => state.role === 'INITIAL');
  const terminal = workflow.states.filter((state) => state.role === 'TERMINAL');
  if (initial.length === 0) issues.push({ code: 'NO_INITIAL_STATE', severity: 'ERROR', message: 'No state is marked as the start of the flow.' });
  if (initial.length > 1) issues.push({ code: 'MULTIPLE_INITIAL_STATES', severity: 'ERROR', message: 'More than one state is marked as the start of the flow.' });
  if (terminal.length === 0) issues.push({ code: 'NO_TERMINAL_STATE', severity: 'ERROR', message: 'No state is marked as an ending of the flow.' });

  if (initial.length === 1) {
    const reachable = new Set<string>([String(initial[0].key ?? initial[0].name)]);
    const queue = [...reachable];
    while (queue.length) {
      const current = queue.shift()!;
      for (const transition of workflow.transitions) {
        if (transition.from === current && !reachable.has(transition.to)) {
          reachable.add(transition.to);
          queue.push(transition.to);
        }
      }
    }
    for (const key of keys) {
      if (!reachable.has(key)) issues.push({ code: 'UNREACHABLE_STATE', severity: 'ERROR', target: key, message: `${key} cannot be reached from the start.` });
    }
  }
  const outgoing = new Set(workflow.transitions.map((transition) => transition.from));
  for (const state of workflow.states) {
    const key = String(state.key ?? state.name);
    if (state.role !== 'TERMINAL' && !outgoing.has(key)) issues.push({ code: 'DEAD_END_STATE', severity: 'ERROR', target: key, message: `${key} has no way forward and is not marked as an ending.` });
  }
  return issues;
}
