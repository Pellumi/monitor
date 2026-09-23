import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { bigIntJsonReplacer, useBigIntJson } from '@tellann/shared';

/**
 * A BigInt reaching `res.json` used to end the process rather than the request.
 *
 * Prisma returns `BigInt` for an artifact's size and a snapshot's byte total,
 * and `JSON.stringify` throws on one instead of skipping it. Express 4 does not
 * catch an async handler's rejection, so the API exited and every desktop agent
 * saw ECONNREFUSED on its next call - a failure far larger than the one field
 * that caused it.
 */

/** The replacer the API actually installs, not a copy of it. */
const jsonReplacer = bigIntJsonReplacer;

/** A finding with its evidence's artifact, which is what `/qa-runs/:runId/replay` returns. */
const replayPayload = () => ({
  runId: 'run-1',
  findings: [{
    id: 'finding-1',
    evidence: [{ findingId: 'finding-1', artifact: { id: 'artifact-1', bytes: 4_294_967_296n } }],
  }],
});

test('the payload is exactly what plain JSON.stringify refuses', () => {
  // Asserted directly rather than through a request: unanswered, the real
  // failure hangs the connection and takes the process down with it, which is
  // not something to reproduce inside the test runner.
  assert.throws(() => JSON.stringify(replayPayload()), /BigInt/);
  assert.doesNotThrow(() => JSON.stringify(replayPayload(), jsonReplacer));
});

test('the replacer sends a BigInt as the string the hand-written converters emit', async () => {
  const app = express();
  useBigIntJson(app);
  app.get('/replay', async (_request, response) => { response.json(replayPayload()); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/replay`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      findings: Array<{ evidence: Array<{ artifact: { bytes: unknown } }> }>;
    };
    const bytes = body.findings[0]!.evidence[0]!.artifact.bytes;
    assert.equal(typeof bytes, 'string', 'a string, matching safeArtifact');
    // 2^32 exceeds a 32-bit integer, which is why the column is a BigInt at all.
    assert.equal(bytes, '4294967296');
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
});

test('the replacer leaves every other value alone', async () => {
  const app = express();
  app.set('json replacer', jsonReplacer);
  app.get('/mixed', (_request, response) => {
    response.json({
      number: 42,
      string: 'unchanged',
      boolean: true,
      nothing: null,
      nested: { list: [1, 'two', false], big: 7n },
    });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const body = await (await fetch(`http://127.0.0.1:${port}/mixed`)).json();
    assert.deepEqual(body, {
      number: 42,
      string: 'unchanged',
      boolean: true,
      nothing: null,
      nested: { list: [1, 'two', false], big: '7' },
    });
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
});
