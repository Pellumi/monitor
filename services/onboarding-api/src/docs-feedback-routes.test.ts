import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createDocsFeedbackRouter } from './docs-feedback-routes';

const VALID = { feedbackId: '123e4567-e89b-42d3-a456-426614174000', pageId: 'demonstration-guided', docsVersion: 'v1', helpful: true };

function harness(options: { existing?: { id: string; helpful: boolean } | null; recent?: number; fail?: boolean; rateLimitMax?: number } = {}) {
  const created: any[] = [];
  const updated: any[] = [];
  const prisma = { docsPageFeedback: {
    count: async () => options.recent || 0,
    findUnique: async () => options.fail ? Promise.reject(new Error('db')) : options.existing || null,
    create: async ({ data }: any) => { created.push(data); return { id: 'created', ...data }; },
    update: async ({ data }: any) => { updated.push(data); return data; },
  }};
  const app = express();
  app.use(express.json({ limit: '4kb' }));
  app.use(createDocsFeedbackRouter({ prisma: prisma as never, docsOrigin: 'https://docs.tellann.test', hashSecret: 'test-secret', rateLimitMax: options.rateLimitMax || 30, rateLimitWindowMs: 3600000 }));
  return { app, created, updated };
}

async function post(app: express.Express, body: unknown, origin = 'https://docs.tellann.test') {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/docs/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  } finally { server.close(); }
}

test('records a first anonymous vote without raw identifiers', async () => {
  const { app, created } = harness();
  const result = await post(app, VALID);
  assert.deepEqual(result, { status: 201, body: { status: 'RECORDED' } });
  assert.equal(created.length, 1);
  assert.equal(typeof created[0].ipHash, 'string');
  assert.equal('ipAddress' in created[0], false);
  assert.equal('requestBody' in created[0], false);
});

test('updates a changed vote and keeps an identical vote idempotent', async () => {
  const changed = harness({ existing: { id: 'one', helpful: false } });
  assert.equal((await post(changed.app, VALID)).body.status, 'UPDATED');
  assert.equal(changed.updated.length, 1);
  const same = harness({ existing: { id: 'one', helpful: true } });
  assert.equal((await post(same.app, VALID)).body.status, 'RECORDED');
  assert.equal(same.updated.length, 0);
});

test('rejects malformed, unknown-page, extra-field, and cross-origin payloads', async () => {
  const { app, created } = harness();
  assert.equal((await post(app, { ...VALID, feedbackId: 'bad' })).status, 400);
  assert.equal((await post(app, { ...VALID, pageId: 'not-a-page' })).status, 400);
  assert.equal((await post(app, { ...VALID, email: 'person@example.test' })).status, 400);
  assert.equal((await post(app, VALID, 'https://attacker.test')).status, 403);
  assert.equal(created.length, 0);
});

test('rate limits abusive senders and handles storage failure', async () => {
  const limited = harness({ recent: 2, rateLimitMax: 2 });
  assert.equal((await post(limited.app, VALID)).status, 429);
  const failed = harness({ fail: true });
  assert.equal((await post(failed.app, VALID)).status, 500);
});
