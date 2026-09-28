import assert from 'node:assert/strict';
import test from 'node:test';
import type { QAEvidenceEvent } from '@tellann/desktop-contracts';
import { deleteEntryRecipe, getEntryRecipe, recipeFromGuidedRunEvidence, saveEntryRecipe } from './entry-recipe-store';
import type { EntryRecipe, EntryRecipeIdentity } from './entry-recipe-store';
import type { KeyValueStore } from './persona-store';

function memoryStore(): KeyValueStore {
  const backing = new Map<string, unknown>();
  return {
    read: <T>(key: string) => (backing.has(key) ? (backing.get(key) as T) : null),
    write: (key, value) => { backing.set(key, value); },
    list: (prefix) => [...backing.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { backing.delete(key); },
  };
}

const identity = (overrides: Partial<EntryRecipeIdentity> = {}): EntryRecipeIdentity => ({
  applicationId: '11111111-1111-4111-8111-111111111111', flowVersionId: 'flow-v1', personaId: 'p1',
  repoSnapshotHash: 'a'.repeat(64), lockfileHash: 'b'.repeat(64), ...overrides,
});

const RECORDED_AT = '2026-01-01T00:00:00.000Z';
const recipe = (overrides: Partial<EntryRecipe> = {}): EntryRecipe => ({
  ...identity(), steps: [], recordedAt: RECORDED_AT, source: 'AUTOMATED_RUN', ...overrides,
});

test('a saved recipe is found only by its exact identity', () => {
  const store = memoryStore();
  saveEntryRecipe(recipe(), store);
  assert.deepEqual(getEntryRecipe(identity(), store), recipe());
  assert.equal(getEntryRecipe(identity({ flowVersionId: 'flow-v2' }), store), null, 'a different flow version');
  assert.equal(getEntryRecipe(identity({ personaId: 'p2' }), store), null, 'a different persona');
  assert.equal(getEntryRecipe(identity({ repoSnapshotHash: 'c'.repeat(64) }), store), null, 'a different commit');
  assert.equal(getEntryRecipe(identity({ lockfileHash: 'c'.repeat(64) }), store), null, 'a different lockfile');
});

test('a guest-only recipe (no persona) is its own identity, distinct from any persona', () => {
  const store = memoryStore();
  saveEntryRecipe(recipe({ personaId: null }), store);
  assert.deepEqual(getEntryRecipe(identity({ personaId: null }), store), recipe({ personaId: null }));
  assert.equal(getEntryRecipe(identity({ personaId: 'p1' }), store), null);
});

test('saving replaces the recipe for the same identity; deleting removes only that one', () => {
  const store = memoryStore();
  saveEntryRecipe(recipe({ source: 'GUIDED_RUN' }), store);
  saveEntryRecipe(recipe({ source: 'AUTOMATED_RUN' }), store);
  assert.equal(getEntryRecipe(identity(), store)?.source, 'AUTOMATED_RUN');
  saveEntryRecipe(recipe({ ...identity({ flowVersionId: 'flow-v2' }), steps: [], recordedAt: new Date().toISOString(), source: 'AUTOMATED_RUN' }), store);
  deleteEntryRecipe(identity(), store);
  assert.equal(getEntryRecipe(identity(), store), null);
  assert.ok(getEntryRecipe(identity({ flowVersionId: 'flow-v2' }), store));
});

const RUN_ID = '11111111-1111-4111-8111-111111111111';
let sequence = 0;
const base = (overrides: Partial<QAEvidenceEvent>): QAEvidenceEvent => ({
  schemaVersion: '2.0', eventId: `e${sequence}`, runId: RUN_ID, sessionId: RUN_ID, traceId: null,
  applicationId: RUN_ID, environmentId: RUN_ID, localSequence: sequence++, timestamp: new Date().toISOString(),
  eventType: 'QA_ROUTE_CHANGED', source: 'DESKTOP_BROWSER', scope: 'PRE_BOUNDARY', privacyClassification: 'INTERNAL',
  pageUrl: null, normalizedRoute: null, acceptedFlowStateKey: null, viewport: null, interactionGroupId: null,
  causedByEventId: null, metadata: {}, protectedValues: [],
  ...overrides,
} as QAEvidenceEvent);

const route = (normalizedRoute: string) => base({ eventType: 'QA_ROUTE_CHANGED', normalizedRoute });
const click = (metadata: Record<string, unknown>) => base({ eventType: 'QA_CONTROL_CLICKED', metadata });

test('a route, a click, then the next route becomes one recipe step', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([
    route('/dashboard'),
    click({ testId: 'course-link', accessibleName: 'My Course' }),
    route('/courses/{param}'),
  ]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0]!.from, '/dashboard');
  assert.equal(edges[0]!.to, '/courses/{param}');
  assert.equal(edges[0]!.control?.testId, 'course-link');
  assert.deepEqual(edges[0]!.control?.labels, ['My Course']);
  assert.equal(edges[0]!.actionClass, 'READ');
});

test('several route-click-route hops become a chain of steps', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([
    route('/dashboard'),
    click({ testId: 'course-link' }),
    route('/courses/{param}'),
    click({ testId: 'exams-tab' }),
    route('/courses/{param}/exams'),
  ]);
  assert.deepEqual(edges.map((e) => [e.from, e.to]), [['/dashboard', '/courses/{param}'], ['/courses/{param}', '/courses/{param}/exams']]);
});

test('a click with no identifying evidence at all is dropped, not guessed', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([route('/dashboard'), click({}), route('/courses/{param}')]);
  assert.deepEqual(edges, []);
});

test('a click that leads nowhere (no route change followed it) contributes no step', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([route('/dashboard'), click({ testId: 'toggle-theme' })]);
  assert.deepEqual(edges, []);
});

test('a route falls back to the page URL\'s path when no normalized route was recorded', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([
    base({ eventType: 'QA_ROUTE_CHANGED', pageUrl: 'https://app.test/dashboard' }),
    click({ testId: 'course-link' }),
    base({ eventType: 'QA_ROUTE_CHANGED', pageUrl: 'https://app.test/courses/7' }),
  ]);
  assert.deepEqual(edges.map((e) => [e.from, e.to]), [['/dashboard', '/courses/7']]);
});

test('everything from the Flow boundary onward is excluded: the recipe is the path to it, not the Flow itself', () => {
  sequence = 0;
  const edges = recipeFromGuidedRunEvidence([
    route('/dashboard'),
    click({ testId: 'course-link' }),
    route('/courses/{param}'),
    base({ eventType: 'QA_FLOW_EVENT', scope: 'IN_FLOW' }),
    click({ testId: 'create-exam' }),
    route('/courses/{param}/exams/new'),
  ]);
  assert.deepEqual(edges.map((e) => e.to), ['/courses/{param}']);
});

test('events are read in evidence order, not array order', () => {
  const first = route('/dashboard');
  const second = click({ testId: 'course-link' });
  const third = route('/courses/{param}');
  const edges = recipeFromGuidedRunEvidence([third, first, second]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0]!.from, '/dashboard');
});

test('an empty or Flow-only evidence stream produces no recipe', () => {
  assert.deepEqual(recipeFromGuidedRunEvidence([]), []);
});
