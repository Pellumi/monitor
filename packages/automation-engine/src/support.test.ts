import assert from 'node:assert/strict';
import test from 'node:test';
import { assessAutomationSupport, describeMissingControls, unresolvedOnPath } from './support';
import { lmsContract } from './test-fixtures';

const assess = (...names: string[]) => assessAutomationSupport(names);

test('React and Next.js are supported', () => {
  for (const names of [['React', 'Vite'], ['Next.js', 'React'], ['Next.js']]) {
    const result = assess(...names);
    assert.equal(result.level, 'SUPPORTED', names.join());
    assert.equal(result.canRun, true);
    assert.deepEqual(result.unsupported, []);
  }
});

test('Remix is runnable, with a limit that is stated', () => {
  const result = assess('Remix', 'React');
  assert.equal(result.level, 'PARTIAL');
  assert.equal(result.canRun, true);
  assert.match(result.message, /Remix moves between pages/);
});

test('Vue, Svelte, Angular, Nuxt, SvelteKit and Astro are "not yet", and say it is coming soon', () => {
  for (const name of ['Vue', 'Nuxt', 'Svelte', 'SvelteKit', 'Angular', 'Astro']) {
    const result = assess(name, 'Vite');
    assert.equal(result.level, 'NOT_YET_SUPPORTED', name);
    assert.equal(result.canRun, false);
    assert.deepEqual(result.unsupported, [name]);
    assert.match(result.title, new RegExp(`does not support ${name} yet`));
    assert.match(result.message, /coming soon/);
    assert.match(result.message, /Guided and Assisted/);
    assert.deepEqual(result.alternatives, ['GUIDED', 'ASSISTED']);
  }
});

test('the wording is a notice with a way forward, never an error', () => {
  const shown = assess('Angular');
  const text = `${shown.title} ${shown.message}`;
  for (const harsh of [/error/i, /fail/i, /unsupported/i, /not found/i, /cannot run/i, /invalid/i]) assert.ok(!harsh.test(text), String(harsh));
});

test('a mixed repository is judged on the part that cannot be read', () => {
  const result = assess('React', 'Angular');
  assert.equal(result.level, 'NOT_YET_SUPPORTED');
  assert.deepEqual(result.unsupported, ['Angular']);
});

test('several unsupported frameworks are named together', () => {
  assert.equal(assess('Vue', 'Svelte').title, 'Automated Run does not support Vue and Svelte yet');
});

test('a backend service has no interface to drive, and is told so plainly', () => {
  for (const names of [['Express'], ['NestJS', 'Fastify'], ['Django'], ['FastAPI']]) {
    const result = assess(...names);
    assert.equal(result.level, 'NOT_APPLICABLE', names.join());
    assert.equal(result.canRun, false);
    assert.match(result.message, /backend capture track/);
  }
});

test('a backend behind a supported frontend is still supported', () => {
  assert.equal(assess('Next.js', 'Express').level, 'SUPPORTED');
  assert.equal(assess('React', 'Django').level, 'SUPPORTED');
});

test('nothing recognisable, or tooling alone, is unknown rather than guessed at', () => {
  assert.equal(assess().level, 'UNKNOWN');
  assert.equal(assess('Vite').level, 'UNKNOWN');
  assert.equal(assess().canRun, false);
  assert.match(assess().message, /coming soon/);
});

test('names are matched however the scan spells them', () => {
  assert.equal(assess('next.js').level, 'SUPPORTED');
  assert.equal(assess('SVELTEKIT').level, 'NOT_YET_SUPPORTED');
  assert.equal(assess('  Angular  ').level, 'NOT_YET_SUPPORTED');
  assert.deepEqual(assess('React', 'React').frameworks, ['React'], 'duplicates collapse');
});

test('missing controls on a supported application are described as a mapping gap, not a missing framework', () => {
  assert.equal(describeMissingControls([]), null);
  const one = describeMissingControls([{ action: 'Create Exam', from: 'course_details' }])!;
  assert.match(one, /"Create Exam"/);
  assert.match(one, /mapping to code/);
  assert.ok(!/framework/i.test(one));
  assert.match(describeMissingControls([{ action: null, from: 'a' }, { action: 'X', from: 'b' }])!, /the step out of a.*and 1 more/);
});

test('the steps on the way to the target that have no derived control are found before a run starts', () => {
  const contract = lmsContract();
  assert.deepEqual(unresolvedOnPath(contract, 'exam_created', 'STAGING'), []);
  contract.transitions = contract.transitions.map((transition) => transition.id === 't-submit' ? { ...transition, control: null } : transition);
  assert.deepEqual(unresolvedOnPath(contract, 'exam_created', 'STAGING'), [{ id: 't-submit', action: 'Submit exam', from: 'exam_form' }]);
});

test('a target with no route to it is a different problem and is not confused with a missing control', () => {
  const contract = lmsContract();
  contract.transitions = [];
  assert.equal(unresolvedOnPath(contract, 'exam_created', 'STAGING'), null);
});
