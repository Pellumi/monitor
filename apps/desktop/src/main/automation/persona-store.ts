import type { RunDataSet, TestPersona } from "@tellann/desktop-contracts";
import { deleteLocalState, listLocalStateKeys, readLocalState, writeLocalState } from "../local-store";

/**
 * Storage for Test Personas and Run Data Sets: the human-owned inputs an Automated Run needs
 * beyond the Flow itself (who to act as, what to type). Credentials never leave this store —
 * `local-store.ts` is the same OS-protected (`safeStorage`) encrypted store everything else in
 * the desktop keeps its local-only state in, and nothing here ever uploads a value.
 *
 * The store is injectable so this module is unit-testable without Electron: `KeyValueStore` is
 * the same four operations `local-store.ts` exposes, and `localKeyValueStore` is the real one.
 */
export interface KeyValueStore {
  read<T>(key: string): T | null;
  write(key: string, value: unknown): void;
  list(prefix: string): string[];
  delete(key: string): void;
}

export const localKeyValueStore: KeyValueStore = {
  read: readLocalState,
  write: writeLocalState,
  list: listLocalStateKeys,
  delete: deleteLocalState,
};

const PERSONA_PREFIX = "automation-persona:";
const RUN_DATA_SET_PREFIX = "automation-run-data:";

function personaKey(applicationId: string, id: string): string {
  return `${PERSONA_PREFIX}${applicationId}:${id}`;
}

function runDataSetKey(applicationId: string, id: string): string {
  return `${RUN_DATA_SET_PREFIX}${applicationId}:${id}`;
}

export function listPersonas(applicationId: string, store: KeyValueStore = localKeyValueStore): TestPersona[] {
  return store
    .list(`${PERSONA_PREFIX}${applicationId}:`)
    .map((key) => store.read<TestPersona>(key))
    .filter((persona): persona is TestPersona => persona !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPersona(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): TestPersona | null {
  return store.read<TestPersona>(personaKey(applicationId, id));
}

export function savePersona(persona: TestPersona, store: KeyValueStore = localKeyValueStore): void {
  store.write(personaKey(persona.applicationId, persona.id), persona);
}

export function deletePersona(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): void {
  store.delete(personaKey(applicationId, id));
}

export function listRunDataSets(applicationId: string, store: KeyValueStore = localKeyValueStore): RunDataSet[] {
  return store
    .list(`${RUN_DATA_SET_PREFIX}${applicationId}:`)
    .map((key) => store.read<RunDataSet>(key))
    .filter((dataSet): dataSet is RunDataSet => dataSet !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getRunDataSet(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): RunDataSet | null {
  return store.read<RunDataSet>(runDataSetKey(applicationId, id));
}

export function saveRunDataSet(dataSet: RunDataSet, store: KeyValueStore = localKeyValueStore): void {
  store.write(runDataSetKey(dataSet.applicationId, dataSet.id), dataSet);
}

export function deleteRunDataSet(applicationId: string, id: string, store: KeyValueStore = localKeyValueStore): void {
  store.delete(runDataSetKey(applicationId, id));
}
