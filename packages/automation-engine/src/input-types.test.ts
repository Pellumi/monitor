import assert from 'node:assert/strict';
import test from 'node:test';
import { DATA_FAILURE_REASONS, formatForInputType, performStep, resolveStep, truthy } from './act';
import type { DataValue, ResolvedStep } from './act';
import { runAutomation } from './executor';
import { materializeRunData } from './persona';
import type { AutomationAction, ControlDescriptor, FormInput, SemanticElement } from './types';
import { ORIGIN, control, element, limits, lmsApp, lmsContract, snapshot } from './test-fixtures';

const save: ControlDescriptor = control({ labels: ['Save'] });
const button = element({ ref: 'save', name: 'Save', role: 'button' });
const field = (ref: string, over: Partial<SemanticElement>): SemanticElement => element({ ref, tag: 'input', role: 'textbox', ...over });

const plan = (elements: SemanticElement[], input: FormInput, value: DataValue) => {
  const resolved = resolveStep(snapshot({ elements: [button, ...elements] }), { control: save, inputs: [input], data: () => value, label: 'save' });
  return resolved;
};
const only = (resolved: ReturnType<typeof plan>) => {
  assert.equal(resolved.ok, true, resolved.ok ? '' : `${resolved.reason}: ${resolved.detail}`);
  return (resolved as ResolvedStep).fills[0]!;
};
const text = (value: string): DataValue => ({ value, secret: false });
const input = (name: string): FormInput => ({ name, label: null, dataKey: name });

// -- what kind of control it is comes from the page --------------------------

test('a text field is typed into', () => {
  const fill = only(plan([field('t', { fieldName: 'title', label: 'Title' })], input('title'), text('Midterm')));
  assert.deepEqual([fill.control, fill.value], ['TEXT', 'Midterm']);
});

test('a native select is chosen from, and a value it does not offer is a data problem', () => {
  const select = field('s', { tag: 'select', role: 'combobox', fieldName: 'subject', options: ['Mathematics', 'Physics'] });
  assert.equal(only(plan([select], input('subject'), text('Physics'))).control, 'SELECT');
  assert.equal(only(plan([select], input('subject'), text('physics'))).control, 'SELECT', 'case does not matter');
  const refused = plan([select], input('subject'), text('Chemistry'));
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.reason, 'OPTION_UNAVAILABLE');
    assert.match(refused.detail, /Mathematics, Physics/, 'it says what the field does offer');
    assert.ok(DATA_FAILURE_REASONS.has(refused.reason));
  }
});

test('a multi-select takes a comma-separated list and checks every entry against what is offered', () => {
  const select = field('s', { tag: 'select', role: 'combobox', fieldName: 'tags', multiple: true, options: ['a', 'b', 'c'] });
  assert.equal(only(plan([select], input('tags'), text('a, c'))).control, 'SELECT');
  assert.equal(plan([select], input('tags'), text('a, z')).ok, false);
});

test('a custom combobox is chosen from, and with no options to check against it is left to the page', () => {
  const combo = field('c', { tag: 'button', role: 'combobox', popup: 'listbox', name: 'Category' });
  assert.equal(only(plan([combo], input('Category'), text('Exam'))).control, 'SELECT');
  const typing = field('t', { role: 'combobox', label: 'Assignee' });
  assert.equal(only(plan([typing], input('Assignee'), text('Ada'))).control, 'SELECT');
});

test('a checkbox is switched on or off by what the data says', () => {
  const box = field('b', { inputType: 'checkbox', role: 'checkbox', fieldName: 'published' });
  const on = only(plan([box], input('published'), text('true')));
  assert.deepEqual([on.control, on.checked], ['CHECKED', true]);
  for (const falsy of ['false', 'no', '0', 'off', '']) assert.equal(only(plan([box], input('published'), text(falsy))).checked, false, falsy);
  for (const yes of ['true', 'YES', 'on', '1', 'checked']) assert.equal(truthy(yes), true, yes);
});

test('a custom switch or ARIA checkbox is treated the same way', () => {
  const toggle = field('n', { tag: 'div', role: 'switch', name: 'Notify students', checked: false });
  assert.deepEqual([only(plan([toggle], input('Notify students'), text('yes'))).control, only(plan([toggle], input('Notify students'), text('yes'))).checked], ['CHECKED', true]);
});

test('a radio group is chosen from by the choice the data names', () => {
  const radios = [
    field('e', { inputType: 'radio', role: 'radio', fieldName: 'difficulty', label: 'Easy', optionValue: 'e' }),
    field('m', { inputType: 'radio', role: 'radio', fieldName: 'difficulty', label: 'Medium', optionValue: 'm' }),
    field('h', { inputType: 'radio', role: 'radio', fieldName: 'difficulty', label: 'Hard', optionValue: 'h' }),
  ];
  const byLabel = only(plan(radios, input('difficulty'), text('Hard')));
  assert.deepEqual([byLabel.ref, byLabel.control, byLabel.checked], ['h', 'CHECKED', true]);
  assert.equal(only(plan(radios, input('difficulty'), text('m'))).ref, 'm', 'or by its value');
  const refused = plan(radios, input('difficulty'), text('Impossible'));
  assert.equal(refused.ok === false && refused.reason, 'OPTION_UNAVAILABLE');
  assert.match(refused.ok ? '' : refused.detail, /Easy, Medium, Hard/);
});

test('radios in a custom group are found by the name of the group', () => {
  const radios = [
    field('p', { tag: 'div', role: 'radio', name: 'Public', group: 'Visibility', checked: false }),
    field('v', { tag: 'div', role: 'radio', name: 'Private', group: 'Visibility', checked: false }),
  ];
  assert.equal(only(plan(radios, input('Visibility'), text('Private'))).ref, 'v');
});

test('a group name does not make an unrelated field in the same fieldset match', () => {
  const stray = field('x', { fieldName: 'phone', label: 'Phone', group: 'Contact' });
  const resolved = plan([stray], input('Contact'), text('1'));
  assert.equal(resolved.ok === false && resolved.reason, 'FIELD_NOT_FOUND');
});

test('a date field is given the shape it insists on, whatever shape the data has', () => {
  const at = '2026-03-04T15:45:10.000Z';
  assert.equal(formatForInputType(at, 'date'), '2026-03-04');
  assert.equal(formatForInputType(at, 'datetime-local'), '2026-03-04T15:45');
  assert.equal(formatForInputType(at, 'time'), '15:45');
  assert.equal(formatForInputType(at, 'month'), '2026-03');
  assert.equal(formatForInputType(at, 'week'), '2026-W10');
  assert.equal(formatForInputType('09:05', 'time'), '09:05');
  assert.equal(formatForInputType('March 4, 2026 10:00 UTC', 'date'), '2026-03-04', 'anything Date can read');
  assert.equal(formatForInputType('not a date', 'date'), null);
  assert.equal(formatForInputType('2026-13-40', 'date'), null);
  assert.equal(formatForInputType('2026-03-04', 'text'), null, 'only the native date types are converted');
  const date = field('d', { inputType: 'date', fieldName: 'opens' });
  assert.equal(only(plan([date], input('opens'), text(at))).value, '2026-03-04');
  const refused = plan([date], input('opens'), text('sometime soon'));
  assert.equal(refused.ok === false && refused.reason, 'VALUE_NOT_ACCEPTED');
});

test('an ISO week number matches the calendar at the year boundary', () => {
  assert.equal(formatForInputType('2021-01-03', 'week'), '2020-W53', 'the first days of January can belong to the last week of the year before');
  assert.equal(formatForInputType('2026-01-05', 'week'), '2026-W02');
});

test('a file field takes a file, even a hidden one, and refuses a value that is not one', () => {
  const file = { name: 'syllabus.txt', mimeType: 'text/plain', base64: Buffer.from('hello').toString('base64') };
  const hidden = field('f', { inputType: 'file', fieldName: 'syllabus', visible: false });
  const fill = only(plan([hidden], input('syllabus'), { value: 'syllabus.txt', secret: false, file }));
  assert.deepEqual([fill.control, fill.file], ['FILE', file]);
  const refused = plan([hidden], input('syllabus'), text('C:/somewhere/syllabus.txt'));
  assert.equal(refused.ok === false && refused.reason, 'FILE_REQUIRED');
  assert.ok(!('file' in (refused as object)), 'a path in the data is never turned into a file read from the machine');
});

test('an invisible text field is still not something to type into', () => {
  const hiddenText = field('h', { fieldName: 'title', visible: false });
  assert.equal(plan([hiddenText], input('title'), text('x')).ok, false);
});

// -- performing --------------------------------------------------------------

test('each kind of control is performed with the action that suits it, in order, before the click', async () => {
  const actions: AutomationAction[] = [];
  const resolved: ResolvedStep = {
    ok: true, controlRef: 'save', method: 'ROLE_NAME', score: 1,
    fills: [
      { ref: 't', value: 'x', secret: false },
      { ref: 's', value: 'Physics', secret: false, control: 'SELECT' },
      { ref: 'c', value: 'true', secret: false, control: 'CHECKED', checked: true },
      { ref: 'f', value: 'a.txt', secret: false, control: 'FILE', file: { name: 'a.txt', mimeType: 'text/plain', base64: 'aGk=' } },
    ],
  };
  const done = await performStep({ act: async (action) => { actions.push(action); return { ok: true }; } }, resolved);
  assert.equal(done.ok, true);
  assert.deepEqual(actions.map((action) => action.kind), ['FILL', 'SELECT', 'SET_CHECKED', 'UPLOAD', 'CLICK']);
});

test('a failure on a choice stops before the click, and is reported as a fill failure', async () => {
  const actions: AutomationAction[] = [];
  const resolved: ResolvedStep = { ok: true, controlRef: 'save', method: 'ROLE_NAME', score: 1, fills: [{ ref: 's', value: 'x', secret: false, control: 'SELECT' }] };
  const done = await performStep({ act: async (action) => { actions.push(action); return { ok: false, error: 'not offered' }; } }, resolved);
  assert.deepEqual(done, { ok: false, stage: 'FILL', error: 'not offered' });
  assert.equal(actions.length, 1, 'nothing was clicked');
});

// -- run data ----------------------------------------------------------------

const RUN_DATA = (values: unknown[]) => ({ id: 'd', applicationId: '11111111-1111-4111-8111-111111111111', name: 'd', values, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }) as never;

test('a file value is materialised as a file held in memory, with a bare name and no path', () => {
  const data = materializeRunData(RUN_DATA([{ key: 'upload', generator: { kind: 'FILE', fileName: 'syllabus.txt', mimeType: 'text/plain', content: 'Week 1: limits' }, secret: false }]));
  const value = data.get('upload')!;
  assert.equal(value.value, 'syllabus.txt');
  assert.equal(Buffer.from(value.file!.base64, 'base64').toString(), 'Week 1: limits');
  assert.equal(value.file!.mimeType, 'text/plain');
});

test('a future timestamp is produced in the format the form wants', () => {
  const now = () => Date.UTC(2026, 0, 31, 8, 5, 0);
  const day = 86_400_000;
  const make = (format?: string) => materializeRunData(RUN_DATA([{ key: 'k', generator: { kind: 'FUTURE_TIMESTAMP', offsetMs: day, ...(format ? { format } : {}) }, secret: false }]), now).get('k')!.value;
  assert.equal(make(), '2026-02-01T08:05:00.000Z');
  assert.equal(make('DATE'), '2026-02-01');
  assert.equal(make('TIME'), '08:05');
  assert.equal(make('US'), '02/01/2026');
  assert.equal(make('EU'), '01/02/2026');
});

// -- in the loop -------------------------------------------------------------

test('a run whose data offers a choice the page does not have stops as a data problem, before clicking', async () => {
  const contract = lmsContract();
  contract.transitions = contract.transitions.map((transition) => transition.id === 't-submit'
    ? { ...transition, inputs: [{ name: 'subject', label: null, dataKey: 'subject' }] }
    : transition);
  const app = lmsApp();
  // The form page offers a select.
  const form = (app as unknown as { options: { pages: Record<string, { elements: SemanticElement[] }> } }).options.pages.form!;
  form.elements = [
    ...form.elements,
    element({ ref: 'e-subject', tag: 'select', role: 'combobox', fieldName: 'subject', options: ['Mathematics', 'Physics'] }),
  ];
  Object.assign(app, { data: (key: string) => (key === 'subject' ? { value: 'Chemistry', secret: false } : undefined) });
  const result = await runAutomation(app, { contract, targetStateKey: 'exam_created', environment: 'STAGING', applicationOrigin: ORIGIN, limits: limits() });
  assert.equal(result.stopReason, 'TEST_DATA_UNAVAILABLE');
  assert.match(result.detail ?? '', /Mathematics, Physics/);
  assert.ok(!app.actions.some((action) => action.kind === 'CLICK' && action.ref === 'e-save'), 'the form was not submitted');
});
