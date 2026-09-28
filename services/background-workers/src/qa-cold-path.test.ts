import assert from 'node:assert/strict';
import test from 'node:test';
import { runConcurrently } from './qa-cold-path';

const delay = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test('independent steps take as long as the slowest one, not the sum of them', async () => {
  const started = Date.now();
  const result = await runConcurrently({
    ai: () => delay(150, 'ai'),
    resolutions: () => delay(150, 'resolutions'),
    baselines: () => delay(150, 'baselines'),
  });
  const elapsed = Date.now() - started;
  assert.deepEqual(result, { ai: 'ai', resolutions: 'resolutions', baselines: 'baselines' });
  // Sequentially this is 450ms. Allow generous scheduler slack, but it must be nowhere near the sum.
  assert.ok(elapsed < 350, `took ${elapsed}ms`);
});

test('every step has started before any has finished', async () => {
  const order: string[] = [];
  await runConcurrently({
    a: async () => { order.push('a:start'); await delay(30, null); order.push('a:end'); },
    b: async () => { order.push('b:start'); await delay(10, null); order.push('b:end'); },
  });
  assert.deepEqual(order.slice(0, 2), ['a:start', 'b:start']);
});

test('each result is keyed to its own step, whatever order they finish in', async () => {
  const result = await runConcurrently({ slow: () => delay(60, 1), fast: () => delay(5, 2) });
  assert.deepEqual(result, { slow: 1, fast: 2 });
});

test('a step that handles its own failure degrades only itself', async () => {
  const result = await runConcurrently({
    ai: async () => { try { throw new Error('provider down'); } catch { return { status: 'FALLBACK_RULES_ONLY' }; } },
    baselines: () => delay(5, { status: 'READY' }),
  });
  assert.deepEqual(result, { ai: { status: 'FALLBACK_RULES_ONLY' }, baselines: { status: 'READY' } });
});

test('a step that does not handle its failure still fails the report, as it did in sequence', async () => {
  await assert.rejects(() => runConcurrently({ ok: () => delay(5, 1), bad: async () => { throw new Error('boom'); } }), /boom/);
});
