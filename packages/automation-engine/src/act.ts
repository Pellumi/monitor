import { rankControls } from './ranking';
import type {
  ActionOutcome,
  AutomationAction,
  AutomationFile,
  ControlDescriptor,
  FormInput,
  SemanticElement,
  SemanticSnapshot,
} from './types';

/**
 * Performing one control-driven step, shared by the Flow executor and the entry sequence
 * (the pre-boundary walk to the Flow's initial state, including login). Both need the same
 * thing: resolve declared inputs against a data source, find the control on the live page, and
 * click it — reported the same way, so a failure looks identical whether it happened inside the
 * Flow or on the way to it.
 *
 * Split in two on purpose. `resolveStep` is pure and synchronous: it decides *what* would be
 * done and can fail with nothing yet attempted, which is what lets a caller emit "this is the
 * action I chose" before any side effect happens. `performStep` is the part that actually acts.
 *
 * A form field is not always a text box. What kind of control it is comes from the element the
 * page actually shows (a `<select>`, a checkbox, a radio group, a date input, a file input, a custom
 * combobox), never from the declared Flow, which only names the field and the data key. The kind decides
 * how the value is applied, and a value the control cannot take (an option it does not offer, a date it
 * cannot parse, a file the data set does not have) is reported as a *data* problem before anything is typed.
 */

export type StepFailureReason =
  | 'NO_DERIVED_CONTROL'
  | 'CONTROL_NOT_FOUND'
  | 'CONTROL_AMBIGUOUS'
  | 'DATA_UNAVAILABLE'
  | 'FIELD_NOT_FOUND'
  /** The field offers a fixed set of choices and the data set's value is not one of them. */
  | 'OPTION_UNAVAILABLE'
  /** A date or time the field cannot take in the format it wants. */
  | 'VALUE_NOT_ACCEPTED'
  /** A file field, and a data value that is not a file. */
  | 'FILE_REQUIRED';

export type ResolveFailure = { ok: false; reason: StepFailureReason; detail: string };

/** Failures that are about the run data rather than about the application. */
export const DATA_FAILURE_REASONS: ReadonlySet<StepFailureReason> = new Set<StepFailureReason>([
  'DATA_UNAVAILABLE', 'OPTION_UNAVAILABLE', 'VALUE_NOT_ACCEPTED', 'FILE_REQUIRED',
]);

export type FieldControl = 'TEXT' | 'SELECT' | 'CHECKED' | 'FILE';

export interface PlannedFill {
  ref: string;
  value: string;
  secret: boolean;
  /** How the value is applied. Omitted means typed text. */
  control?: FieldControl;
  /** For `CHECKED`: the state to leave the control in. */
  checked?: boolean;
  /** For `FILE`: what to upload. */
  file?: AutomationFile;
}

export interface ResolvedStep {
  ok: true;
  controlRef: string;
  method: string;
  score: number;
  fills: PlannedFill[];
}

export interface DataValue {
  value: string;
  secret: boolean;
  /** Set when the value is a file to upload, not text to type. */
  file?: AutomationFile;
}

export interface StepInput {
  /** The control to act on. `null` means the code gave no evidence for it: never guessed. */
  control: ControlDescriptor | null;
  /** Fields to fill before clicking, in order. */
  inputs: FormInput[];
  data: (key: string) => DataValue | undefined;
  /** Label used only in failure detail messages. */
  label: string;
  /**
   * Settles a tie between controls the ranking could not separate. It is handed the refs of the tied
   * candidates and may return one of them; anything else is ignored. The caller is responsible for
   * having verified the choice (see `verifyControlProposal`): this only applies it.
   */
  tieBreak?: (tiedRefs: string[]) => string | null;
}

export function resolveStep(snapshot: SemanticSnapshot, input: StepInput): ResolvedStep | ResolveFailure {
  if (!input.control) {
    return { ok: false, reason: 'NO_DERIVED_CONTROL', detail: `The code gives no control for ${input.label}, so the run will not guess one.` };
  }
  const ranked = rankControls(input.control, snapshot.elements);
  if (ranked.ambiguous) {
    const topScore = ranked.candidates[0]?.score;
    const tied = ranked.candidates.filter((candidate) => candidate.score === topScore);
    const picked = input.tieBreak?.(tied.map((candidate) => candidate.element.ref)) ?? null;
    const chosen = picked ? tied.find((candidate) => candidate.element.ref === picked) : undefined;
    if (!chosen) {
      return { ok: false, reason: 'CONTROL_AMBIGUOUS', detail: `More than one control matches ${input.label} equally well.` };
    }
    ranked.best = chosen;
  }
  if (!ranked.best) {
    const hidden = ranked.unusable.length > 0 ? ' A matching control exists but is hidden or disabled.' : '';
    return { ok: false, reason: 'CONTROL_NOT_FOUND', detail: `No control for ${input.label} is on the page.${hidden}` };
  }

  const fills: PlannedFill[] = [];
  for (const field of input.inputs) {
    const supplied = input.data(field.dataKey);
    if (!supplied) return { ok: false, reason: 'DATA_UNAVAILABLE', detail: `No value is available for "${field.dataKey}".` };
    const planned = planFill(field, supplied, snapshot.elements);
    if (!planned.ok) return planned;
    fills.push(planned.fill);
  }

  return { ok: true, controlRef: ranked.best.element.ref, method: ranked.best.method, score: ranked.best.score, fills };
}

export type PerformResult =
  | { ok: true }
  | { ok: false; stage: 'FILL' | 'CLICK'; error: string };

export async function performStep(
  ports: { act(action: AutomationAction): Promise<ActionOutcome> },
  resolved: ResolvedStep,
): Promise<PerformResult> {
  for (const fill of resolved.fills) {
    const outcome = await ports.act(actionFor(fill));
    if (!outcome.ok) return { ok: false, stage: 'FILL', error: outcome.error ?? 'unknown error' };
  }
  const outcome = await ports.act({ kind: 'CLICK', ref: resolved.controlRef });
  if (!outcome.ok) return { ok: false, stage: 'CLICK', error: outcome.error ?? 'unknown error' };
  return { ok: true };
}

function actionFor(fill: PlannedFill): AutomationAction {
  switch (fill.control ?? 'TEXT') {
    case 'SELECT':
      return { kind: 'SELECT', ref: fill.ref, value: fill.value };
    case 'CHECKED':
      return { kind: 'SET_CHECKED', ref: fill.ref, checked: fill.checked === true };
    case 'FILE':
      return { kind: 'UPLOAD', ref: fill.ref, file: fill.file! };
    default:
      return { kind: 'FILL', ref: fill.ref, value: fill.value, secret: fill.secret };
  }
}

// -- fields -------------------------------------------------------------------

const DATE_INPUT_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

function planFill(
  field: FormInput,
  supplied: DataValue,
  elements: SemanticElement[],
): { ok: true; fill: PlannedFill } | ResolveFailure {
  const wanted = [field.name, field.label].filter((value): value is string => Boolean(value)).map(normalize);
  const matches = elements.filter((element) => named(element, wanted));
  const usable = matches.filter((element) => (element.visible && element.enabled) || (isFileInput(element) && element.enabled));
  if (usable.length === 0) {
    return { ok: false, reason: 'FIELD_NOT_FOUND', detail: `No field for "${field.name}" is on the page.` };
  }

  // A group of radios shares one field name; the value chooses which one to select.
  const radios = usable.filter(isRadio);
  if (radios.length > 1) {
    const want = normalize(supplied.value);
    const chosen = radios.find((radio) => [radio.optionValue, radio.label, radio.name].some((text) => text && normalize(text) === want));
    if (!chosen) {
      return { ok: false, reason: 'OPTION_UNAVAILABLE', detail: `"${field.name}" does not offer the choice in the run data set. It offers: ${radios.map((radio) => radio.label ?? radio.name ?? radio.optionValue).filter(Boolean).join(', ')}.` };
    }
    return { ok: true, fill: { ref: chosen.ref, value: supplied.value, secret: supplied.secret, control: 'CHECKED', checked: true } };
  }

  const target = usable[0]!;
  const base = { ref: target.ref, value: supplied.value, secret: supplied.secret };

  if (isFileInput(target)) {
    if (!supplied.file) return { ok: false, reason: 'FILE_REQUIRED', detail: `"${field.name}" takes a file, and the run data value for it is not one.` };
    return { ok: true, fill: { ...base, control: 'FILE', file: supplied.file } };
  }
  if (isChecklike(target)) {
    return { ok: true, fill: { ...base, control: 'CHECKED', checked: truthy(supplied.value) } };
  }
  if (isChoice(target)) {
    const offered = target.options;
    if (offered && offered.length > 0) {
      const values = supplied.value.split(',').map((part) => normalize(part)).filter(Boolean);
      const known = new Set([...offered, ...(target.optionValues ?? [])].map(normalize));
      const missing = values.filter((value) => !known.has(value));
      if (missing.length > 0) {
        return { ok: false, reason: 'OPTION_UNAVAILABLE', detail: `"${field.name}" does not offer the choice in the run data set. It offers: ${offered.slice(0, 12).join(', ')}${offered.length > 12 ? ', …' : ''}.` };
      }
    }
    return { ok: true, fill: { ...base, control: 'SELECT' } };
  }
  if (target.inputType && DATE_INPUT_TYPES.has(target.inputType)) {
    const formatted = formatForInputType(supplied.value, target.inputType);
    if (formatted === null) {
      return { ok: false, reason: 'VALUE_NOT_ACCEPTED', detail: `"${field.name}" is a ${target.inputType} field, and the run data value for it is not a ${target.inputType === 'time' ? 'time' : 'date'} it can read.` };
    }
    return { ok: true, fill: { ...base, value: formatted, control: 'TEXT' } };
  }
  return { ok: true, fill: { ...base, control: 'TEXT' } };
}

function named(element: SemanticElement, wanted: string[]): boolean {
  if (element.fieldName == null && element.label == null && element.testId == null && element.name == null && element.domId == null && element.group == null) return false;
  // A group name only names the choices inside it (radios, checkboxes), never an unrelated input that happens to share a fieldset.
  const groupName = isRadio(element) || isChecklike(element) ? element.group : null;
  const candidates = [element.fieldName, element.label, element.name, element.testId, element.domId, groupName]
    .filter((value): value is string => Boolean(value))
    .map(normalize);
  return wanted.some((target) => candidates.includes(target));
}

const isFileInput = (element: SemanticElement) => element.inputType === 'file';
const isRadio = (element: SemanticElement) => element.role === 'radio' || element.inputType === 'radio';
const isChecklike = (element: SemanticElement) =>
  element.inputType === 'checkbox' || element.role === 'checkbox' || element.role === 'switch' || isRadio(element);
/** A native select, or a custom combobox/listbox: something the value *chooses among* rather than types into. */
const isChoice = (element: SemanticElement) =>
  element.tag === 'select' || element.role === 'combobox' || element.role === 'listbox' || Boolean(element.popup);

export const truthy = (value: string): boolean => /^(true|yes|on|1|checked|y)$/i.test(value.trim());

/**
 * A date or time in the shape a native input insists on, from an ISO-like value or anything `Date` can read.
 * Null when the value is not a date at all, so a wrong value is reported rather than typed into the field
 * and silently rejected by the browser.
 */
export function formatForInputType(value: string, inputType: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  let year: number, month: number, day: number, hour = 0, minute = 0;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
    hour = iso[4] ? Number(iso[4]) : 0; minute = iso[5] ? Number(iso[5]) : 0;
  } else if (inputType === 'time' && /^\d{1,2}:\d{2}/.test(text)) {
    const [h, m] = text.split(':');
    hour = Number(h); minute = Number(m); year = 1970; month = 1; day = 1;
  } else {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getUTCFullYear(); month = parsed.getUTCMonth() + 1; day = parsed.getUTCDate();
    hour = parsed.getUTCHours(); minute = parsed.getUTCMinutes();
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  switch (inputType) {
    case 'date': return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
    case 'datetime-local': return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
    case 'time': return `${pad(hour)}:${pad(minute)}`;
    case 'month': return `${pad(year, 4)}-${pad(month)}`;
    case 'week': { const week = isoWeek(year, month, day); return `${pad(week.year, 4)}-W${pad(week.week)}`; }
    default: return null;
  }
}

/** ISO 8601 week and week-year: the first days of January can belong to the last week of the year before. */
function isoWeek(year: number, month: number, day: number): { year: number; week: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7) };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
