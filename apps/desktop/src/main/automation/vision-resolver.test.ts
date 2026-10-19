import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_AMBIGUITY_RESOLVER, askResolver, verifyControlProposal } from '@tellann/automation-engine';
import type { AmbiguitySituation, ControlCandidate, ExecutableState, ExecutableTransition, SemanticElement } from '@tellann/automation-engine';
import { createVisionResolver, promptFor } from './vision-resolver';
import type { StructuredAsker } from './vision-resolver';

const CROP = { mimeType: 'image/png', base64: 'aGk=' };

/** An asker whose answer the test controls, which records exactly what it was sent. */
function asker(answer: unknown, name = 'fake'): StructuredAsker & { sent: Array<{ prompt: string; images?: unknown[] }> } {
  const sent: Array<{ prompt: string; images?: unknown[] }> = [];
  return {
    name,
    sent,
    async generateStructured(input: { prompt: string; images?: Array<{ mimeType: string; base64: string }>; schema: { parse(value: unknown): unknown } }) {
      sent.push({ prompt: input.prompt, images: input.images });
      return { data: input.schema.parse(answer) as never };
    },
  } as StructuredAsker & { sent: Array<{ prompt: string; images?: unknown[] }> };
}

const controlSituation = (refs: string[]): AmbiguitySituation => ({
  kind: 'CONTROL',
  transitionId: 't-open',
  action: 'Open exam',
  expectedState: 'exam_page',
  candidates: refs.map((ref) => ({ ref, role: 'link', name: 'Open', label: null, href: '/exams/42', testId: null })),
});

const stateSituation: AmbiguitySituation = {
  kind: 'STATE',
  path: '/courses/7',
  title: 'Course',
  headings: ['Course details'],
  candidates: [{ stateKey: 'course_details', score: 0.8 }, { stateKey: 'course_overview', score: 0.8 }],
};

test('it answers with a choice the engine can act on, and says where it ran', async () => {
  const resolver = createVisionResolver({
    asker: asker({ choice: 'e2', destination: 'exam_page', rationale: 'the one in the exam row' }),
    locality: 'CLOUD',
  });
  assert.equal(resolver.locality, 'CLOUD', 'a report has to be able to say a model somewhere else chose this');
  assert.match(resolver.id, /^vision:fake$/);

  const proposal = await resolver.resolve(controlSituation(['e1', 'e2']));
  assert.deepEqual(proposal, { choice: 'e2', destination: 'exam_page', rationale: 'the one in the exam row' });
});

test('a picture of every candidate is sent, or none at all', async () => {
  const both = asker({ choice: 'e1', destination: 'exam_page', rationale: 'x' });
  await createVisionResolver({ asker: both, locality: 'LOCAL', cropFor: async () => CROP }).resolve(controlSituation(['e1', 'e2']));
  assert.equal(both.sent[0]!.images?.length, 2);
  assert.match(both.sent[0]!.prompt, /pictures are in the same order/);

  // Half the pictures is worse than none: the model would compare a control it can see against one it cannot.
  const partial = asker({ choice: 'e1', destination: 'exam_page', rationale: 'x' });
  await createVisionResolver({
    asker: partial, locality: 'LOCAL',
    cropFor: async (ref) => (ref === 'e1' ? CROP : null),
  }).resolve(controlSituation(['e1', 'e2']));
  assert.equal(partial.sent[0]!.images, undefined);
  assert.ok(!/pictures are in the same order/.test(partial.sent[0]!.prompt));
});

test('a crop that throws is no picture, not a failed run', async () => {
  const sent = asker({ choice: 'e1', destination: 'exam_page', rationale: 'x' });
  const proposal = await createVisionResolver({
    asker: sent, locality: 'LOCAL',
    cropFor: async () => { throw new Error('the page navigated'); },
  }).resolve(controlSituation(['e1', 'e2']));
  assert.equal(proposal?.choice, 'e1');
  assert.equal(sent.sent[0]!.images, undefined);
});

test('it is never asked about something that is not a tie', async () => {
  const sent = asker({ choice: 'e1', rationale: 'x' });
  const resolver = createVisionResolver({ asker: sent, locality: 'LOCAL' });
  assert.equal(await resolver.resolve(controlSituation(['e1'])), null, 'one candidate is not a tie');
  assert.equal(await resolver.resolve(controlSituation(['a', 'b', 'c', 'd', 'e', 'f', 'g'])), null, 'seven is not a tie either');
  assert.deepEqual(sent.sent, [], 'and nothing was asked');
});

test('an answer that is not the shape asked for is the same as no answer', async () => {
  // `askResolver` is the gate the executor goes through, and it swallows a throwing or malformed resolver.
  const broken = createVisionResolver({ asker: asker({ choice: 42 }), locality: 'LOCAL' });
  assert.equal(await askResolver(broken, controlSituation(['e1', 'e2'])), null);

  const empty = createVisionResolver({ asker: asker({ choice: '', rationale: 'I cannot tell' }), locality: 'LOCAL' });
  assert.equal(await askResolver(empty, controlSituation(['e1', 'e2'])), null, 'refusing is allowed and costs nothing');
});

test('the prompt carries page metadata and never anything else', () => {
  const prompt = promptFor(controlSituation(['e1', 'e2']), true);
  assert.match(prompt, /Open exam/);
  assert.match(prompt, /exam_page/);
  assert.match(prompt, /ref e1/);
  assert.ok(!/password|secret|token|source|\.tsx/i.test(prompt), 'no credentials and no source');
  // Refusing has to be offered, or the model will always pick something.
  assert.match(prompt, /If you cannot tell/);

  const state = promptFor(stateSituation, false);
  assert.match(state, /course_details/);
  assert.match(state, /\/courses\/7/);
  assert.match(state, /nothing will be decided/);
});

// -- the gate it has to pass -----------------------------------------------------------------------

const element = (over: Partial<SemanticElement> & { ref: string }): SemanticElement => ({
  tag: 'a', role: 'link', name: null, label: null, testId: null, domId: null, href: null,
  actionAnchor: null, fieldName: null, inputType: null, visible: true, enabled: true, ...over,
});
const candidate = (el: SemanticElement): ControlCandidate => ({ element: el, method: 'ROLE_NAME', score: 0.85 });

const transition: ExecutableTransition = {
  id: 't-open', from: 'list', to: 'exam_page', action: 'Open exam',
  control: { labels: ['Open'], testId: null, domId: null, element: 'a', event: 'click', actionAnchor: null, href: '/exams/{param}' },
  inputs: [], actionClass: 'READ', expectedApi: [], codeRefs: [{ file: 'src/Exams.tsx', symbol: 'openExam', entityId: 'e1' }],
  derivation: 'RESOLVED',
};
const destination: ExecutableState = {
  key: 'exam_page', name: 'Exam page', role: 'NORMAL', terminalKind: null, routePatterns: ['/exams/{param}'],
  requiredElements: [], optionalElements: [], sdkStateSignals: [], expectedApi: [], codeRefs: [], derivation: 'RESOLVED',
};

test('a suggestion the contract does not agree with is still refused, exactly as before', async () => {
  const candidates = [
    candidate(element({ ref: 'e1', name: 'Open', href: '/exams/42' })),
    candidate(element({ ref: 'e2', name: 'Open', href: '/help' })),
  ];
  const resolver = createVisionResolver({
    // The model prefers the one that leads to the help page.
    asker: asker({ choice: 'e2', destination: 'exam_page', rationale: 'it looks like the primary link' }),
    locality: 'CLOUD',
  });
  const proposal = (await askResolver(resolver, controlSituation(['e1', 'e2'])))!;
  const verdict = verifyControlProposal({ transition, destination, candidates, proposal });

  assert.equal(verdict.accepted, false, 'turning the model on cannot make a run click something the code disowns');
  assert.equal(verdict.accepted === false && verdict.reason, 'DESTINATION_DISAGREES');
});

test('a suggestion the contract does agree with is accepted, and says why', async () => {
  const candidates = [
    candidate(element({ ref: 'e1', name: 'Open', href: '/exams/42' })),
    candidate(element({ ref: 'e2', name: 'Open', href: '/exams/43' })),
  ];
  const resolver = createVisionResolver({ asker: asker({ choice: 'e1', destination: 'exam_page', rationale: 'the exam row' }), locality: 'LOCAL' });
  const proposal = (await askResolver(resolver, controlSituation(['e1', 'e2'])))!;
  const verdict = verifyControlProposal({ transition, destination, candidates, proposal });

  assert.equal(verdict.accepted, true);
  assert.ok(verdict.accepted && verdict.agreement.includes('destination'));
});

test('with nothing supplied the engine behaves exactly as it did before resolvers existed', async () => {
  assert.equal(await askResolver(NO_AMBIGUITY_RESOLVER, controlSituation(['e1', 'e2'])), null);
  assert.equal(NO_AMBIGUITY_RESOLVER.locality, 'LOCAL');
});
