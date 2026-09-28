import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { OrphanJournal, processStartTime } from "./orphan-journal";
import type { KeyValueStore } from "./persona-store";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    read: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    write: (key, value) => { data.set(key, JSON.parse(JSON.stringify(value))); },
    list: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { data.delete(key); },
  };
}

const NOW = new Date("2026-01-01T12:00:00.000Z");
const T0 = Date.UTC(2026, 0, 1, 11, 0, 0);

function journal(over: { starts?: Record<number, number | null>; killed?: number[] } = {}) {
  const store = memoryStore();
  const killed = over.killed ?? [];
  const starts = over.starts ?? {};
  return {
    store, killed, starts,
    journal: new OrphanJournal({ store, now: () => NOW, startTimeOf: async (pid) => starts[pid] ?? null, kill: async (pid) => { killed.push(pid); } }),
  };
}

test("a process is written down as it starts, with when it started, and struck off as it stops", async () => {
  const { journal: j, store, starts } = journal();
  starts[100] = T0;
  await j.record({ pid: 100, runId: "r1", name: "app" });
  assert.deepEqual(j.entries(), [{ pid: 100, runId: "r1", name: "app", startedAtMs: T0, recordedAt: NOW.toISOString() }]);
  j.forget(100);
  assert.deepEqual(j.entries(), []);
  assert.equal(store.data.size, 0);
});

test("what a crashed session left running is ended at the next launch, and struck off", async () => {
  const { journal: j, killed, starts, store } = journal();
  starts[100] = T0;
  await j.record({ pid: 100, runId: "r1", name: "app" });
  // A new session: the same process is still there, started at the same moment.
  const result = await j.sweep();
  assert.deepEqual(killed, [100]);
  assert.deepEqual(result.ended.map((entry) => entry.pid), [100]);
  assert.equal(store.data.size, 0);
});

test("a pid the operating system has since given to a different process is never touched", async () => {
  const { journal: j, killed, starts } = journal();
  starts[100] = T0;
  await j.record({ pid: 100, runId: "r1", name: "app" });
  starts[100] = T0 + 45 * 60_000; // someone else's process, started later, now holding that number
  const result = await j.sweep();
  assert.deepEqual(killed, [], "somebody else's process is left alone");
  assert.deepEqual(result.skipped.map((entry) => entry.pid), [100]);
  assert.deepEqual(j.entries(), [], "and the stale entry is dropped so it cannot be acted on later");
});

test("an entry whose start time was never known cannot be verified, so it is dropped rather than acted on", async () => {
  const { journal: j, killed, starts } = journal();
  starts[100] = null as never; // could not be read when the process started
  await j.record({ pid: 100, runId: "r1", name: "app" });
  starts[100] = T0;
  const result = await j.sweep();
  assert.deepEqual(killed, []);
  assert.equal(result.skipped.length, 1);
});

test("a process that has already exited is simply struck off", async () => {
  const { journal: j, killed, starts } = journal();
  starts[100] = T0;
  await j.record({ pid: 100, runId: "r1", name: "app" });
  delete starts[100];
  const result = await j.sweep();
  assert.deepEqual(killed, []);
  assert.deepEqual(result.gone.map((entry) => entry.pid), [100]);
  assert.deepEqual(j.entries(), []);
});

test("several are dealt with independently, and one that will not die does not stop the rest", async () => {
  const store = memoryStore();
  const starts: Record<number, number | null> = { 1001: T0, 1002: T0, 1003: T0 };
  const killed: number[] = [];
  const j = new OrphanJournal({ store, now: () => NOW, startTimeOf: async (pid) => starts[pid] ?? null, kill: async (pid) => { killed.push(pid); if (pid === 1002) throw new Error("access denied"); } });
  for (const pid of [1001, 1002, 1003]) await j.record({ pid, runId: "r", name: `p${pid}` });
  const result = await j.sweep();
  assert.deepEqual(killed, [1001, 1002, 1003]);
  assert.equal(result.ended.length, 3);
});

test("journalling can fail without failing anything else", async () => {
  const broken: KeyValueStore = { read: () => null, write: () => { throw new Error("disk full"); }, list: () => [], delete: () => { throw new Error("disk full"); } };
  const j = new OrphanJournal({ store: broken, startTimeOf: async () => T0, kill: async () => undefined });
  await j.record({ pid: 5, runId: "r", name: "app" });
  j.forget(5);
  assert.deepEqual(await j.sweep(), { ended: [], gone: [], skipped: [] });
});

test("a corrupt entry is ignored", () => {
  const { journal: j, store } = journal();
  store.data.set("automation-orphan:9", { nonsense: true });
  store.data.set("automation-orphan:10", null);
  assert.deepEqual(j.entries(), []);
});

test("the real operating system reports when a real process started, and nothing for one that does not exist", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  try {
    const before = Date.now();
    const started = await processStartTime(child.pid!);
    assert.ok(started !== null, "a running process has a start time");
    assert.ok(Math.abs(started! - before) < 30_000, `start time ${new Date(started!).toISOString()} is close to now`);
    assert.equal(await processStartTime(2_000_000_000), null);
  } finally {
    child.kill("SIGKILL");
  }
});
