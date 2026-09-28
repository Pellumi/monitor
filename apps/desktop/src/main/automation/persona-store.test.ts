import assert from 'node:assert/strict';
import test from 'node:test';
import type { RunDataSet, TestPersona } from '@tellann/desktop-contracts';
import {
  deletePersona, deleteRunDataSet, getPersona, getRunDataSet, listPersonas, listRunDataSets, savePersona, saveRunDataSet,
} from './persona-store';
import type { KeyValueStore } from './persona-store';

const APP_A = '11111111-1111-4111-8111-111111111111';
const APP_B = '22222222-2222-4222-8222-222222222222';

function memoryStore(): KeyValueStore {
  const backing = new Map<string, unknown>();
  return {
    read: <T>(key: string) => (backing.has(key) ? (backing.get(key) as T) : null),
    write: (key, value) => { backing.set(key, value); },
    list: (prefix) => [...backing.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { backing.delete(key); },
  };
}

const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const persona = (overrides: Partial<TestPersona> = {}): TestPersona => ({
  id: 'p1', applicationId: APP_A, name: 'Teacher', roles: ['TEACHER'], authenticated: true, authMethod: 'PASSWORD',
  credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'hunter2' }],
  createdAt: TIMESTAMP, updatedAt: TIMESTAMP, ...overrides,
});

const dataSet = (overrides: Partial<RunDataSet> = {}): RunDataSet => ({
  id: 'd1', applicationId: APP_A, name: 'Exam data',
  values: [{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'Automated QA Exam' }, secret: false }],
  createdAt: TIMESTAMP, updatedAt: TIMESTAMP, ...overrides,
});

test('a saved persona round-trips exactly, including its credentials', () => {
  const store = memoryStore();
  savePersona(persona(), store);
  assert.deepEqual(getPersona(APP_A, 'p1', store), persona());
});

test('a persona for another application, or one never saved, is not found', () => {
  const store = memoryStore();
  savePersona(persona(), store);
  assert.equal(getPersona(APP_B, 'p1', store), null);
  assert.equal(getPersona(APP_A, 'nope', store), null);
});

test('listing returns every persona for the application, sorted by name, and none of another application\'s', () => {
  const store = memoryStore();
  savePersona(persona({ id: 'p2', name: 'Zoe (Admin)' }), store);
  savePersona(persona({ id: 'p1', name: 'Ada (Teacher)' }), store);
  savePersona(persona({ id: 'p3', applicationId: APP_B, name: 'Someone else’s persona' }), store);
  assert.deepEqual(listPersonas(APP_A, store).map((p) => p.name), ['Ada (Teacher)', 'Zoe (Admin)']);
  assert.deepEqual(listPersonas(APP_B, store).map((p) => p.id), ['p3']);
});

test('saving under the same id overwrites, rather than duplicating', () => {
  const store = memoryStore();
  savePersona(persona({ name: 'Original' }), store);
  savePersona(persona({ name: 'Renamed' }), store);
  assert.deepEqual(listPersonas(APP_A, store).map((p) => p.name), ['Renamed']);
});

test('deleting a persona removes only that one', () => {
  const store = memoryStore();
  savePersona(persona({ id: 'p1' }), store);
  savePersona(persona({ id: 'p2' }), store);
  deletePersona(APP_A, 'p1', store);
  assert.equal(getPersona(APP_A, 'p1', store), null);
  assert.ok(getPersona(APP_A, 'p2', store));
});

test('run data sets round-trip and are scoped to their application the same way personas are', () => {
  const store = memoryStore();
  saveRunDataSet(dataSet(), store);
  saveRunDataSet(dataSet({ id: 'd2', applicationId: APP_B, name: 'Other app data' }), store);
  assert.deepEqual(getRunDataSet(APP_A, 'd1', store), dataSet());
  assert.equal(getRunDataSet(APP_B, 'd1', store), null);
  assert.deepEqual(listRunDataSets(APP_A, store).map((d) => d.id), ['d1']);
  deleteRunDataSet(APP_A, 'd1', store);
  assert.equal(getRunDataSet(APP_A, 'd1', store), null);
  assert.ok(getRunDataSet(APP_B, 'd2', store));
});

test('two applications whose ids share a long common prefix still keep separate persona lists', () => {
  const store = memoryStore();
  savePersona(persona({ applicationId: '11111111-1111-4111-8111-111111111111', id: 'p', name: 'App one' }), store);
  savePersona(persona({ applicationId: '11111111-1111-4111-8111-111111111199', id: 'p', name: 'App two' }), store);
  assert.deepEqual(listPersonas('11111111-1111-4111-8111-111111111111', store).map((p) => p.name), ['App one']);
  assert.deepEqual(listPersonas('11111111-1111-4111-8111-111111111199', store).map((p) => p.name), ['App two']);
});
