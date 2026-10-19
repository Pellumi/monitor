import assert from 'node:assert/strict';
import test from 'node:test';
import { control, element } from './test-fixtures';
import {
  DEFAULT_BREAKPOINTS,
  MIN_TAP_TARGET_PX,
  dedupe,
  flowShapeFindings,
  rankFindings,
  responsiveFindings,
  statePageFindings,
} from './ui-quality';
import type { UiQualityFinding } from './ui-quality';
import type {
  ElementGeometry,
  ExecutableContract,
  ExecutableState,
  PageMeasurement,
  SemanticElement,
  ViewportSample,
} from './types';

const geometry = (over: Partial<ElementGeometry> = {}): ElementGeometry => ({
  rect: { x: 10, y: 10, width: 120, height: 48 },
  inViewport: true, hitTestOk: true,
  fontSizePx: 16, fontWeight: 400,
  color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(37, 99, 235)',
  borderWidthPx: 0, borderStyle: 'none', cursor: 'pointer', opacity: 1, emphasis: 'FILLED',
  ...over,
});

const drawn = (ref: string, name: string, over: Partial<ElementGeometry> = {}): SemanticElement =>
  ({ ...element({ ref, name }), geometry: geometry(over) });

const page = (over: Partial<PageMeasurement> = {}): PageMeasurement =>
  ({ viewport: { width: 1280, height: 800 }, horizontalOverflowPx: 0, smallestTextPx: 16, ...over });

const state = (over: Partial<ExecutableState> = {}): ExecutableState => ({
  key: 'exam_form', name: 'Exam form', role: 'NORMAL', terminalKind: null, routePatterns: [],
  requiredElements: [], optionalElements: [], sdkStateSignals: [], expectedApi: [], codeRefs: [],
  derivation: 'RESOLVED', ...over,
});

const transition = (over: Partial<ExecutableContract['transitions'][number]> = {}): ExecutableContract['transitions'][number] => ({
  id: 't', from: 'exam_form', to: 'exam_created', action: 'Save exam', control: control({ labels: ['Save exam'] }),
  inputs: [], actionClass: 'SERVER_MUTATION', expectedApi: [], codeRefs: [], derivation: 'RESOLVED', ...over,
});

const rules = (findings: UiQualityFinding[]) => findings.map((finding) => finding.rule).sort();

// -- the shape of the Flow, which needs no measurement ---------------------------------------------

const shaped = (over: Partial<ExecutableContract> = {}): ExecutableContract => ({
  flowVersionId: 'v1', flowHash: 'h'.repeat(64), analysisIdentity: null, initialStateKey: 'start',
  states: [
    state({ key: 'start', name: 'Start', role: 'INITIAL' }),
    state({ key: 'middle', name: 'Middle' }),
    state({ key: 'done', name: 'Done', role: 'TERMINAL', terminalKind: 'SUCCESS' }),
  ],
  transitions: [
    transition({ id: 'a', from: 'start', to: 'middle', action: 'Begin', actionClass: 'READ' }),
    transition({ id: 'b', from: 'middle', to: 'done', action: 'Finish' }),
  ],
  ...over,
});

test('a state the Flow can get into and not out of is a finding, and an ending is not', () => {
  const stuck = shaped({ transitions: [transition({ id: 'a', from: 'start', to: 'middle', action: 'Begin', actionClass: 'READ' })] });
  const findings = flowShapeFindings(stuck, 'STAGING');

  // `middle` is reachable and leads nowhere: somebody gets there and is stuck.
  const trapped = findings.find((finding) => finding.stateKey === 'middle')!;
  assert.equal(trapped.rule, 'DEAD_END');
  assert.equal(trapped.severity, 'MEDIUM');
  assert.match(trapped.detail, /nothing leads out of it/);

  // `done` is an ending, so it is never faulted for leading nowhere — but with that step gone, nothing reaches
  // it either, and that is a different thing said differently.
  const orphaned = findings.find((finding) => finding.stateKey === 'done')!;
  assert.match(orphaned.detail, /nothing in this Flow can reach it/);
  assert.ok(!/nothing leads out of it/.test(orphaned.detail), 'an ending is what it is for');
});

test('a step that asks for nothing and offers one way on is reported, gently', () => {
  // `middle` only leads on, with no inputs and no consequence: a page people click through.
  const findings = flowShapeFindings(shaped({
    transitions: [
      transition({ id: 'a', from: 'start', to: 'middle', action: 'Begin', actionClass: 'READ' }),
      transition({ id: 'b', from: 'middle', to: 'done', action: 'Continue', actionClass: 'READ' }),
    ],
  }), 'STAGING');
  const redundant = findings.filter((finding) => finding.rule === 'REDUNDANT_STEP');
  assert.deepEqual(redundant.map((finding) => finding.stateKey), ['middle']);
  assert.equal(redundant[0]!.severity, 'LOW', 'sometimes that page is a confirmation somebody wanted');
  assert.match(redundant[0]!.detail, /click through rather than use/);
});

test('a step that asks for something, or changes something, is not redundant', () => {
  const withInput = flowShapeFindings(shaped({
    transitions: [
      transition({ id: 'a', from: 'start', to: 'middle', action: 'Begin', actionClass: 'READ' }),
      transition({ id: 'b', from: 'middle', to: 'done', action: 'Save', actionClass: 'READ', inputs: [{ name: 'title', label: null, dataKey: 'title' }] }),
    ],
  }), 'STAGING');
  assert.deepEqual(rules(withInput), [], 'it asks for a title, so it is a step with a purpose');

  const mutates = flowShapeFindings(shaped(), 'STAGING');
  assert.ok(!mutates.some((finding) => finding.rule === 'REDUNDANT_STEP'), 'and one that changes server state never is');
});

test('a state nothing can reach is said to be unreachable, which is not the same as a dead end', () => {
  const orphan = shaped({
    states: [...shaped().states, state({ key: 'orphan', name: 'Orphan', role: 'TERMINAL', terminalKind: 'FAILURE' })],
  });
  const findings = flowShapeFindings(orphan, 'STAGING').filter((finding) => finding.stateKey === 'orphan');
  assert.deepEqual(findings.map((finding) => finding.rule), ['DEAD_END']);
  assert.match(findings[0]!.detail, /nothing in this Flow can reach it/);
});

test('a well-shaped Flow produces nothing at all', () => {
  assert.deepEqual(flowShapeFindings(shaped(), 'STAGING'), []);
});

// -- the page as drawn ------------------------------------------------------------------------------

test('text below the readable minimum is reported with the size that produced it', () => {
  const findings = statePageFindings({ stateKey: 'exam_form', state: state(), outgoing: [], elements: [], page: page({ smallestTextPx: 9.5 }) });
  assert.deepEqual(rules(findings), ['TEXT_TOO_SMALL']);
  assert.match(findings[0]!.detail, /9\.5px/);
  assert.match(findings[0]!.detail, /12px/, 'and the threshold it fell below, so the reader can disagree');
});

test('a page wider than its window is reported; a rounding artefact is not', () => {
  assert.deepEqual(rules(statePageFindings({ stateKey: 's', state: state(), outgoing: [], elements: [], page: page({ horizontalOverflowPx: 240 }) })), ['HORIZONTAL_OVERFLOW']);
  assert.deepEqual(statePageFindings({ stateKey: 's', state: state(), outgoing: [], elements: [], page: page({ horizontalOverflowPx: 2 }) }), []);
});

test('a control too small for a fingertip is reported only where fingers are the pointer', () => {
  const small = drawn('a', 'Close', { rect: { x: 0, y: 0, width: 18, height: 18 } });
  const input = { stateKey: 's', state: state({ requiredElements: [control({ labels: ['Close'] })] }), outgoing: [], elements: [small] };

  const phone = statePageFindings({ ...input, page: page({ viewport: { width: 390, height: 844 } }) });
  assert.ok(phone.some((finding) => finding.rule === 'TAP_TARGET_TOO_SMALL'));
  assert.match(phone.find((finding) => finding.rule === 'TAP_TARGET_TOO_SMALL')!.detail, new RegExp(`18x18px.*${MIN_TAP_TARGET_PX}x${MIN_TAP_TARGET_PX}`));

  const laptop = statePageFindings({ ...input, page: page() });
  assert.ok(!laptop.some((finding) => finding.rule === 'TAP_TARGET_TOO_SMALL'), 'a mouse can hit an 18px target');
});

test('text that does not stand out from what it sits on is reported against the ratio AA asks for', () => {
  const faint = drawn('a', 'Save', { color: 'rgb(200, 200, 200)', backgroundColor: 'rgb(255, 255, 255)' });
  const findings = statePageFindings({
    stateKey: 's', state: state({ requiredElements: [control({ labels: ['Save'] })] }), outgoing: [], elements: [faint], page: page(),
  });
  const contrast = findings.find((finding) => finding.rule === 'LOW_CONTRAST')!;
  assert.ok(contrast, JSON.stringify(findings));
  assert.match(contrast.detail, /4\.5:1/);
  assert.match(contrast.detail, /"Save"/);
});

test('only the controls the state is about are judged, not everything on the page', () => {
  const footerLink = drawn('footer', 'Privacy policy', { color: 'rgb(220, 220, 220)', backgroundColor: 'rgb(255, 255, 255)', rect: { x: 0, y: 0, width: 10, height: 10 } });
  const findings = statePageFindings({
    stateKey: 's', state: state(), outgoing: [], elements: [footerLink], page: page({ viewport: { width: 390, height: 844 } }),
  });
  assert.deepEqual(findings, [], "a site's footer is not a finding about one Flow state");
});

test('the action with consequences being the quiet one is reported; the other way round is not', () => {
  const save = drawn('save', 'Save exam', { emphasis: 'TEXT' });
  const back = drawn('back', 'Back to list', { emphasis: 'FILLED' });
  const outgoing = [
    transition({ id: 'save', action: 'Save exam', control: control({ labels: ['Save exam'] }), actionClass: 'SERVER_MUTATION' }),
    transition({ id: 'back', action: 'Back to list', control: control({ labels: ['Back to list'] }), actionClass: 'READ' }),
  ];
  const wrong = statePageFindings({ stateKey: 's', state: state(), outgoing, elements: [save, back], page: page() });
  const weight = wrong.find((finding) => finding.rule === 'WRONG_BUTTON_WEIGHT')!;
  assert.ok(weight, JSON.stringify(rules(wrong)));
  assert.match(weight.detail, /"Save exam" is what changes something/);
  assert.match(weight.detail, /plain text link/);
  assert.match(weight.detail, /"Back to list", which changes nothing/);

  const right = statePageFindings({
    stateKey: 's', state: state(), outgoing,
    elements: [drawn('save', 'Save exam', { emphasis: 'FILLED' }), drawn('back', 'Back to list', { emphasis: 'TEXT' })],
    page: page(),
  });
  assert.ok(!right.some((finding) => finding.rule === 'WRONG_BUTTON_WEIGHT'));
});

test('a page that took a visible while and said nothing is reported; one that said something is not', () => {
  const base = { stateKey: 's', state: state(), outgoing: [], elements: [], page: page() };
  const loading = (findings: UiQualityFinding[]) => findings.some((finding) => finding.rule === 'NO_LOADING_AFFORDANCE');
  assert.ok(loading(statePageFindings({ ...base, settledMs: 2_400, busyIndicator: false })));
  assert.ok(!loading(statePageFindings({ ...base, settledMs: 2_400, busyIndicator: true })), 'it said it was working');
  assert.ok(!loading(statePageFindings({ ...base, settledMs: 120, busyIndicator: false })), 'nobody notices 120ms');
  assert.ok(!loading(statePageFindings({ ...base, settledMs: 2_400 })), 'not knowing is not a finding');
  assert.match(
    statePageFindings({ ...base, settledMs: 2_400, busyIndicator: false }).find((finding) => finding.rule === 'NO_LOADING_AFFORDANCE')!.detail,
    /2400ms/,
  );
});

test('a page nothing measured produces nothing, rather than a guess', () => {
  assert.deepEqual(statePageFindings({ stateKey: 's', state: state(), outgoing: [], elements: [element({ ref: 'a', name: 'Save' })], page: undefined }), []);
});

// -- the same state at other sizes -----------------------------------------------------------------

const sample = (name: string, width: number, elements: SemanticElement[], over: Partial<PageMeasurement> = {}): ViewportSample => ({
  breakpoint: { name, width, height: 800 },
  page: page({ viewport: { width, height: 800 }, ...over }),
  elements,
});

test('a step whose control is unreachable at one size says the Flow cannot be finished there', () => {
  const outgoing = [transition({ action: 'Save exam', control: control({ labels: ['Save exam'] }) })];
  const findings = responsiveFindings('exam_form', state(), outgoing, [
    sample('mobile', 390, [drawn('save', 'Save exam', { hitTestOk: false })]),
    sample('laptop', 1280, [drawn('save', 'Save exam')]),
  ]);
  const unreachable = findings.filter((finding) => finding.rule === 'CONTROL_UNREACHABLE_AT_SIZE');
  assert.equal(unreachable.length, 1, 'only the size it is broken at');
  assert.match(unreachable[0]!.breakpoint!, /mobile \(390x800\)/);
  assert.match(unreachable[0]!.detail, /covered by something else/);
  assert.match(unreachable[0]!.detail, /cannot be completed at that size/);
});

test('the same problem at several sizes is said once, with the sizes it applies to', () => {
  const findings = responsiveFindings('s', state(), [], [
    sample('mobile', 390, [], { horizontalOverflowPx: 120 }),
    sample('tablet', 820, [], { horizontalOverflowPx: 90 }),
    sample('laptop', 1280, [], { horizontalOverflowPx: 0 }),
  ]);
  const overflow = findings.filter((finding) => finding.rule === 'HORIZONTAL_OVERFLOW');
  assert.equal(overflow.length, 1, 'a report that repeats itself teaches people to stop reading it');
  assert.match(overflow[0]!.breakpoint!, /mobile/);
  assert.match(overflow[0]!.breakpoint!, /tablet/);
  assert.ok(!/laptop/.test(overflow[0]!.breakpoint!), 'and never a size where it was fine');
});

test('a Flow that holds up at every size produces nothing', () => {
  assert.deepEqual(
    responsiveFindings('s', state(), [transition({ control: control({ labels: ['Save exam'] }) })], DEFAULT_BREAKPOINTS.map((breakpoint) =>
      sample(breakpoint.name, breakpoint.width, [drawn('save', 'Save exam', { rect: { x: 0, y: 0, width: 120, height: 48 } })]))),
    [],
  );
});

test('the sizes checked by default are the shapes people actually hold and sit at', () => {
  assert.deepEqual(DEFAULT_BREAKPOINTS.map((breakpoint) => breakpoint.name), ['mobile', 'foldable', 'tablet', 'laptop', 'desktop']);
  assert.ok(DEFAULT_BREAKPOINTS.every((breakpoint) => breakpoint.width > 0 && breakpoint.height > 0));
});

test('findings are ordered worst first, so the order is the order to work in', () => {
  const ranked = rankFindings([
    { rule: 'REDUNDANT_STEP', severity: 'LOW', stateKey: 'a', breakpoint: null, detail: 'x', recommendation: null },
    { rule: 'TEXT_TOO_SMALL', severity: 'MEDIUM', stateKey: 'b', breakpoint: null, detail: 'y', recommendation: null },
  ]);
  assert.deepEqual(ranked.map((finding) => finding.rule), ['TEXT_TOO_SMALL', 'REDUNDANT_STEP']);
});

test('deduping keys on what a finding is about, not on the numbers in it', () => {
  const once = dedupe([
    { rule: 'TEXT_TOO_SMALL', severity: 'MEDIUM', stateKey: 's', breakpoint: 'mobile', detail: 'The smallest text is 9px, below the 12px minimum.', recommendation: null },
    { rule: 'TEXT_TOO_SMALL', severity: 'MEDIUM', stateKey: 's', breakpoint: 'tablet', detail: 'The smallest text is 10px, below the 12px minimum.', recommendation: null },
  ]);
  assert.equal(once.length, 1);
  assert.equal(once[0]!.breakpoint, 'mobile, tablet');
});
