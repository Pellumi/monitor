import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAuthChallenge, materializeRunData, performStep, resolveStep, runDataPort } from '@tellann/automation-engine';
import type { ControlDescriptor, FormInput } from '@tellann/automation-engine';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { PageAutomationDriver } from './automation-driver';

/**
 * Every kind of form control, in real Chromium: what the page shows decides how a value is applied, and the
 * page records what it actually received. The assertions are about what the *application* got, not about what
 * the driver believes it did.
 */

const PAGE = `<!doctype html><html><body>
<h1>New exam</h1>
<label for="title">Title</label><input id="title" name="title"/>
<label for="description">Description</label><textarea id="description" name="description"></textarea>

<label for="subject">Subject</label>
<select id="subject" name="subject"><option value="">Choose…</option><option value="math">Mathematics</option><option value="phys">Physics</option></select>
<label for="tags">Tags</label>
<select id="tags" name="tags" multiple><option>alpha</option><option>beta</option><option>gamma</option></select>

<fieldset><legend>Difficulty</legend>
  <label><input type="radio" name="difficulty" value="e"/> Easy</label>
  <label><input type="radio" name="difficulty" value="m"/> Medium</label>
  <label><input type="radio" name="difficulty" value="h"/> Hard</label>
</fieldset>
<label><input type="checkbox" name="published"/> Published</label>
<label><input type="checkbox" name="proctored" checked/> Proctored</label>

<label for="opens">Opens</label><input id="opens" name="opens" type="date"/>
<label for="closes">Closes at</label><input id="closes" name="closes" type="datetime-local"/>
<label for="starts">Starts</label><input id="starts" name="starts" type="time"/>
<label for="deadline">Deadline</label><input id="deadline" name="deadline" placeholder="MM/DD/YYYY"/>

<label for="attachment">Attachment</label><input id="attachment" name="attachment" type="file"/>
<input id="syllabus" name="syllabus" type="file" style="display:none"/><button type="button" id="pick-syllabus" aria-label="Upload syllabus">Upload syllabus</button>

<div id="category-wrap">
  <button type="button" id="category" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Category">Select category</button>
  <ul id="category-list" role="listbox" hidden></ul>
</div>
<label for="assignee">Assignee</label>
<input id="assignee" role="combobox" aria-haspopup="listbox" aria-autocomplete="list"/>
<ul id="assignee-list" role="listbox" hidden></ul>

<div id="notify" role="switch" aria-checked="false" aria-label="Notify students" tabindex="0" style="display:inline-block;width:40px;height:20px;border:1px solid #888"></div>
<div role="radiogroup" aria-label="Visibility">
  <div role="radio" aria-checked="false" tabindex="0" id="vis-public">Public</div>
  <div role="radio" aria-checked="false" tabindex="0" id="vis-private">Private</div>
</div>
<div id="notes" role="textbox" contenteditable="true" aria-label="Notes"></div>

<button type="button" id="save">Save</button>
<script>
window.__submitted = null;
const $ = (id) => document.getElementById(id);
const CATEGORIES = ['Quiz', 'Exam', 'Assignment'];
const PEOPLE = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'];
let category = null; let assignee = null;
function renderList(list, items, choose) {
  list.innerHTML = '';
  for (const item of items) { const li = document.createElement('li'); li.setAttribute('role', 'option'); li.textContent = item; li.onclick = () => choose(item); list.appendChild(li); }
  list.hidden = false;
}
$('category').onclick = () => { renderList($('category-list'), CATEGORIES, (item) => { category = item; $('category').textContent = item; $('category-list').hidden = true; }); };
$('assignee').oninput = () => { const q = $('assignee').value.toLowerCase(); renderList($('assignee-list'), PEOPLE.filter((p) => p.toLowerCase().includes(q)), (item) => { assignee = item; $('assignee').value = item; $('assignee-list').hidden = true; }); };
$('notify').onclick = () => { $('notify').setAttribute('aria-checked', String($('notify').getAttribute('aria-checked') !== 'true')); };
for (const id of ['vis-public', 'vis-private']) $(id).onclick = () => { for (const other of ['vis-public', 'vis-private']) $(other).setAttribute('aria-checked', String(other === id)); };
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { $('category-list').hidden = true; $('assignee-list').hidden = true; } });
$('pick-syllabus').onclick = () => $('syllabus').click();
async function readFile(input) { const f = input.files[0]; if (!f) return null; return { name: f.name, type: f.type, text: await f.text() }; }
$('save').onclick = async () => {
  const checked = (name) => document.querySelector('input[name=' + name + ']').checked;
  window.__submitted = {
    title: $('title').value, description: $('description').value, subject: $('subject').value,
    tags: Array.from($('tags').selectedOptions).map((o) => o.value),
    difficulty: (document.querySelector('input[name=difficulty]:checked') || {}).value || null,
    published: checked('published'), proctored: checked('proctored'),
    opens: $('opens').value, closes: $('closes').value, starts: $('starts').value, deadline: $('deadline').value,
    attachment: await readFile($('attachment')), syllabus: await readFile($('syllabus')),
    category, assignee, notify: $('notify').getAttribute('aria-checked') === 'true',
    visibility: ['vis-public', 'vis-private'].filter((id) => $(id).getAttribute('aria-checked') === 'true').map((id) => $(id).textContent),
    notes: $('notes').textContent,
  };
};
</script></body></html>`;

let browser: Browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser.close(); });

async function withPage<T>(run: (page: Page, driver: PageAutomationDriver) => Promise<T>): Promise<T> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(PAGE);
    return await run(page, new PageAutomationDriver(page, { sdkStates: () => [], quietMs: 50 }));
  } finally {
    await context.close();
  }
}

const SAVE: ControlDescriptor = { labels: ['Save'], testId: null, domId: null, element: 'button', event: null, actionAnchor: null, href: null };
const field = (name: string): FormInput => ({ name, label: null, dataKey: name });
const set = (entries: Record<string, unknown>) => Object.entries(entries).map(([key, generator]) => ({ key, generator, secret: false }));
const dataSet = (values: ReturnType<typeof set>) => ({ id: 'd', applicationId: '11111111-1111-4111-8111-111111111111', name: 'd', values, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }) as never;
const literal = (value: string) => ({ kind: 'LITERAL', value });

async function fillAndSave(page: Page, driver: PageAutomationDriver, inputs: FormInput[], values: Record<string, unknown>) {
  const data = runDataPort(materializeRunData(dataSet(set(values)), () => Date.UTC(2026, 0, 31, 8, 5, 0)));
  const resolved = resolveStep(await driver.snapshot(), { control: SAVE, inputs, data, label: 'Save' });
  assert.equal(resolved.ok, true, resolved.ok ? '' : `${resolved.reason}: ${resolved.detail}`);
  if (!resolved.ok) throw new Error('unreachable');
  const performed = await performStep(driver, resolved);
  assert.equal(performed.ok, true, performed.ok ? '' : `${performed.stage}: ${performed.error}`);
  await page.waitForFunction(() => (window as unknown as { __submitted: unknown }).__submitted !== null);
  return page.evaluate(() => (window as unknown as { __submitted: Record<string, unknown> }).__submitted);
}

test('text, textarea, contenteditable', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('title'), field('description'), field('Notes')], {
      title: literal('Midterm'), description: literal('Chapters 1 to 4'), Notes: literal('Bring a calculator'),
    });
    assert.equal(got.title, 'Midterm');
    assert.equal(got.description, 'Chapters 1 to 4');
    assert.equal(got.notes, 'Bring a calculator');
  });
});

test('a native select, by label and by value, and a multi-select', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('subject'), field('tags')], { subject: literal('Physics'), tags: literal('alpha, gamma') });
    assert.equal(got.subject, 'phys');
    assert.deepEqual(got.tags, ['alpha', 'gamma']);
  });
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('subject')], { subject: literal('math') });
    assert.equal(got.subject, 'math', 'a value works as well as a label');
  });
});

test('a radio group is chosen by label, and a checkbox is set on and off', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('difficulty'), field('published'), field('proctored')], {
      difficulty: literal('Hard'), published: literal('yes'), proctored: literal('no'),
    });
    assert.equal(got.difficulty, 'h');
    assert.equal(got.published, true);
    assert.equal(got.proctored, false, 'a box that started checked is switched off');
  });
});

test('a radio group named by its legend, and an already-correct checkbox left alone', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('Difficulty'), field('proctored')], { Difficulty: literal('m'), proctored: literal('true') });
    assert.equal(got.difficulty, 'm');
    assert.equal(got.proctored, true);
  });
});

test('native date, datetime, time and a typed text date are each given in the shape they want', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('opens'), field('Closes at'), field('starts'), field('deadline')], {
      opens: { kind: 'FUTURE_TIMESTAMP', offsetMs: 86_400_000 },
      'Closes at': { kind: 'FUTURE_TIMESTAMP', offsetMs: 2 * 86_400_000 },
      starts: { kind: 'FUTURE_TIMESTAMP', offsetMs: 0, format: 'TIME' },
      deadline: { kind: 'FUTURE_TIMESTAMP', offsetMs: 7 * 86_400_000, format: 'US' },
    });
    assert.equal(got.opens, '2026-02-01');
    assert.equal(got.closes, '2026-02-02T08:05');
    assert.equal(got.starts, '08:05');
    assert.equal(got.deadline, '02/07/2026');
  });
});

test('a file input, and a hidden one behind a button', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('attachment'), field('syllabus')], {
      attachment: { kind: 'FILE', fileName: 'notes.txt', mimeType: 'text/plain', content: 'Week 1: limits' },
      syllabus: { kind: 'FILE', fileName: 'syllabus.csv', mimeType: 'text/csv', content: 'week,topic\n1,limits' },
    });
    assert.deepEqual(got.attachment, { name: 'notes.txt', type: 'text/plain', text: 'Week 1: limits' });
    assert.deepEqual(got.syllabus, { name: 'syllabus.csv', type: 'text/csv', text: 'week,topic\n1,limits' });
  });
});

test('a custom combobox is opened and its option clicked, and a typing combobox is filtered then chosen', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('Category'), field('assignee')], { Category: literal('Exam'), assignee: literal('Alan Turing') });
    assert.equal(got.category, 'Exam');
    assert.equal(got.assignee, 'Alan Turing');
  });
});

test('a custom switch and a custom radio group are toggled the way a person would', async () => {
  await withPage(async (page, driver) => {
    const got = await fillAndSave(page, driver, [field('Notify students'), field('Visibility')], { 'Notify students': literal('on'), Visibility: literal('Private') });
    assert.equal(got.notify, true);
    assert.deepEqual(got.visibility, ['Private']);
  });
});

test('a switch that is already on is left on', async () => {
  await withPage(async (page, driver) => {
    await page.click('#notify');
    const got = await fillAndSave(page, driver, [field('Notify students')], { 'Notify students': literal('true') });
    assert.equal(got.notify, true, 'not toggled back off');
  });
});

test('a choice the page does not offer is refused before anything is typed', async () => {
  await withPage(async (page, driver) => {
    const data = runDataPort(materializeRunData(dataSet(set({ title: literal('Should not be typed'), subject: literal('Chemistry') }))));
    const resolved = resolveStep(await driver.snapshot(), { control: SAVE, inputs: [field('title'), field('subject')], data, label: 'Save' });
    assert.equal(resolved.ok, false);
    if (!resolved.ok) assert.equal(resolved.reason, 'OPTION_UNAVAILABLE');
    assert.equal(await page.inputValue('#title'), '', 'the form was left untouched');
  });
});

test('a custom list that lacks the option fails the step and leaves nothing open', async () => {
  await withPage(async (page, driver) => {
    const data = runDataPort(materializeRunData(dataSet(set({ Category: literal('Lab report') }))));
    const resolved = resolveStep(await driver.snapshot(), { control: SAVE, inputs: [field('Category')], data, label: 'Save' });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    const performed = await performStep(driver, resolved);
    assert.equal(performed.ok, false);
    if (!performed.ok) {
      assert.equal(performed.stage, 'FILL');
      assert.ok(!performed.error.includes('Lab report'), 'the value is not echoed');
    }
    assert.equal(await page.locator('#category-list').isHidden(), true, 'the list is not left hanging open');
  });
});

test('the snapshot reports the facts a choice needs, and nothing a person typed', async () => {
  await withPage(async (page, driver) => {
    await page.fill('#title', 'secret-typed-value');
    const snapshot = await driver.snapshot();
    const byName = (name: string) => snapshot.elements.find((e) => e.name === name || e.label === name || e.fieldName === name)!;
    assert.deepEqual(byName('subject').options, ['Mathematics', 'Physics']);
    assert.equal(byName('tags').multiple, true);
    assert.equal(byName('Notify students').checked, false);
    assert.equal(snapshot.elements.find((e) => e.label === 'Proctored')!.checked, true);
    assert.equal(snapshot.elements.find((e) => e.label === 'Hard')!.optionValue, 'h');
    assert.equal(snapshot.elements.find((e) => e.label === 'Hard')!.group, 'Difficulty');
    assert.equal(byName('Category').popup, 'listbox');
    assert.ok(!JSON.stringify(snapshot).includes('secret-typed-value'), 'a typed value is never part of what the engine sees');
  });
});

// -- pages that need a person --------------------------------------------------

test('an embedded CAPTCHA frame and a one-time-code field are seen for what they are, from a real page', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.route('https://www.google.com/recaptcha/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>challenge</p>' }));
    await page.route('http://app.test/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<h1>Sign in</h1><input name="email"/><input type="password" name="password"/><iframe src="https://www.google.com/recaptcha/api2/anchor?k=SECRETKEY"></iframe>',
    }));
    await page.goto('http://app.test/login');
    await page.waitForSelector('iframe');
    await page.frameLocator('iframe').locator('p').waitFor();
    const captcha = await new PageAutomationDriver(page, { sdkStates: () => [] }).snapshot();
    assert.deepEqual(captcha.frameOrigins, ['www.google.com/recaptcha/api2/anchor'], 'host and path only, never the query');
    assert.equal(detectAuthChallenge(captcha, { applicationOrigin: 'http://app.test' })?.kind, 'CAPTCHA');

    await page.setContent('<h1>Enter code</h1><label>Code <input name="code" autocomplete="one-time-code"/></label>');
    const mfa = await new PageAutomationDriver(page, { sdkStates: () => [] }).snapshot();
    assert.equal(mfa.elements.find((element) => element.fieldName === 'code')?.autocomplete, 'one-time-code');
    assert.equal(detectAuthChallenge(mfa, {})?.kind, 'MFA');

    await page.setContent('<h1>Sign in</h1><label>Email <input name="email"/></label><label>Password <input type="password" name="password"/></label><button>Sign in</button>');
    assert.equal(detectAuthChallenge(await new PageAutomationDriver(page, { sdkStates: () => [] }).snapshot(), {}), null, 'an ordinary login is left alone');
  } finally {
    await context.close();
  }
});
