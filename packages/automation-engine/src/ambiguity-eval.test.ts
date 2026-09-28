import assert from 'node:assert/strict';
import test from 'node:test';
import type { AmbiguityResolver } from './ambiguity';
import { passesShippingGate, scoreControlResolver } from './ambiguity-eval';
import type { LabelledControlCase } from './ambiguity-eval';
import { rankControls } from './ranking';
import { tiedControls } from './ambiguity';
import { control, element, state, transition } from './test-fixtures';

const link = (ref: string, href: string | null) => element({ ref, tag: 'a', role: 'link', name: 'Open exam', href });

const open = transition({
  id: 't-open', from: 'list', to: 'exam_page', action: 'Open exam',
  control: control({ labels: ['Open exam'], element: 'a', href: '/exams/{param}' }),
  actionClass: 'SERVER_MUTATION',
  codeRefs: [{ file: 'a.tsx', symbol: 'OpenExamLink', entityId: null }],
});
const destination = state({ key: 'exam_page', routePatterns: ['/exams/{param}'] });

const makeCase = (name: string, elements: ReturnType<typeof link>[], correctRef: string | null): LabelledControlCase => ({
  name, transition: open, destination, correctRef,
  candidates: tiedControls(rankControls(open.control!, elements).candidates),
});

const cases: LabelledControlCase[] = [
  // The link with a real target is the right one; the code can tell them apart.
  makeCase('linked vs unlinked', [link('good', '/exams/1'), link('bad', null)], 'good'),
  makeCase('linked vs elsewhere', [link('good', '/exams/2'), link('decoy', '/help')], 'good'),
  // Neither is right: stopping is the right answer.
  makeCase('nothing right', [link('a', '/help'), link('b', '/about')], null),
];

const answering = (choose: (ref: string[]) => string | null): AmbiguityResolver => ({
  id: 'fake', local: true,
  resolve: async (situation) => {
    if (situation.kind !== 'CONTROL') return null;
    const choice = choose(situation.candidates.map((c) => c.ref));
    return choice ? { choice, destination: 'exam_page', rationale: 'r' } : null;
  },
});

test('a resolver that always abstains is safe and useless', async () => {
  const score = await scoreControlResolver(answering(() => null), cases);
  assert.deepEqual([score.acceptedCorrect, score.acceptedWrong, score.abstained], [0, 0, 3]);
  const gate = passesShippingGate(score);
  assert.equal(gate.pass, false);
  assert.match(gate.reasons.join(' '), /0% of answerable/);
});

test('a resolver that is right where the code agrees passes', async () => {
  const score = await scoreControlResolver(answering((refs) => refs.find((ref) => ref === 'good') ?? null), cases);
  assert.equal(score.acceptedCorrect, 2);
  assert.equal(score.acceptedWrong, 0);
  assert.equal(score.answerable, 2);
  assert.deepEqual(passesShippingGate(score), { pass: true, reasons: [] });
});

test('the verifier catches a resolver that picks the decoy, so a wrong choice never counts as accepted', async () => {
  const score = await scoreControlResolver(answering((refs) => refs.find((ref) => ['bad', 'decoy', 'a'].includes(ref)) ?? null), cases);
  assert.equal(score.acceptedWrong, 0);
  assert.ok(score.rejected >= 2, 'the decoys were refused by the verifier');
});

test('a single wrong acceptance fails the gate however good the rest is', () => {
  const gate = passesShippingGate({ total: 100, answerable: 100, abstained: 0, rejected: 0, acceptedCorrect: 99, acceptedWrong: 1, latencyMs: [10] });
  assert.equal(gate.pass, false);
  assert.match(gate.reasons.join(' '), /disqualifying/);
});

test('a resolver that is too slow, or measured on nothing, does not pass', () => {
  const slow = passesShippingGate({ total: 2, answerable: 2, abstained: 0, rejected: 0, acceptedCorrect: 2, acceptedWrong: 0, latencyMs: [10, 5000] });
  assert.match(slow.reasons.join(' '), /5000 ms/);
  assert.equal(passesShippingGate({ total: 0, answerable: 0, abstained: 0, rejected: 0, acceptedCorrect: 0, acceptedWrong: 0, latencyMs: [] }).pass, false);
});

test('latency is measured per case', async () => {
  let clock = 0;
  const score = await scoreControlResolver(answering(() => null), cases, { now: () => (clock += 7) });
  assert.deepEqual(score.latencyMs, [7, 7, 7]);
});
