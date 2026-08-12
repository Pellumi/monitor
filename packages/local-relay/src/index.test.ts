import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { LocalRunRelay, redactRelayValue } from './index';

test('redacts secret-shaped fields recursively', () => {
  assert.deepEqual(redactRelayValue({ password: 'bad', nested: { apiKey: 'bad', ok: 'yes' } }), {
    password: '[REDACTED]', nested: { apiKey: '[REDACTED]', ok: 'yes' },
  });
});

test('relay requires its local token and forces run correlation', async () => {
  let received: any = null;
  const collector = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => { received = JSON.parse(Buffer.concat(chunks).toString('utf8')); response.writeHead(202).end(); });
  });
  await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
  const address = collector.address();
  assert.ok(address && typeof address !== 'string');
  const relay = new LocalRunRelay();
  const started = await relay.start({
    collectorBaseUrl: `http://127.0.0.1:${address.port}`, runCredential: 'scoped-cloud-token',
    allowedOrigin: 'http://localhost:5173',
    correlation: { runId: 'run', sessionId: 'session', traceId: 'trace', organizationId: 'org', applicationId: 'app', environmentId: 'env' },
  });
  const denied = await fetch(`${started.endpoint}/v1/events`, { method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 401);
  const accepted = await fetch(`${started.endpoint}/v1/events`, { method: 'POST', headers: { origin: 'http://localhost:5173', authorization: `Bearer ${started.relayToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ runId: 'forged', password: 'secret' }) });
  assert.equal(accepted.status, 202);
  assert.equal(received.runId, 'run');
  assert.equal(received.password, '[REDACTED]');
  await relay.stop();
  await new Promise<void>((resolve) => collector.close(() => resolve()));
});

test('relay buffers an unavailable collector request and reports queue changes', async () => {
  const queueSizes: number[] = [];
  const relay = new LocalRunRelay();
  const started = await relay.start({
    collectorBaseUrl: 'http://127.0.0.1:1', runCredential: 'scoped-cloud-token',
    allowedOrigin: 'http://localhost:5173',
    correlation: { runId: 'run', sessionId: 'session', traceId: 'trace', organizationId: 'org', applicationId: 'app', environmentId: 'env' },
    onQueueChanged: (queue) => queueSizes.push(queue.length),
  });
  const response = await fetch(`${started.endpoint}/v1/events`, {
    method: 'POST', headers: { origin: 'http://localhost:5173', authorization: `Bearer ${started.relayToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ eventType: 'STATE_ENTERED', metadata: { stateName: 'CHECKOUT' } }),
  });
  assert.equal(response.status, 202);
  assert.equal((await response.json() as { buffered: boolean }).buffered, true);
  assert.equal(relay.getQueue().length, 1);
  assert.ok(queueSizes.includes(1));
  await relay.stop();
});

test('relay replays a persisted queue once and clears it after collector recovery', async () => {
  let available = false;
  const receivedIds: string[] = [];
  const collector = http.createServer((request, response) => {
    if (!available) { response.writeHead(503).end(); return; }
    receivedIds.push(String(request.headers['x-tellann-relay-request-id']));
    response.writeHead(202).end();
  });
  await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
  const address = collector.address();
  assert.ok(address && typeof address !== 'string');
  const options = {
    collectorBaseUrl: `http://127.0.0.1:${address.port}`, runCredential: 'scoped-cloud-token',
    allowedOrigin: 'http://localhost:5173',
    correlation: { runId: 'run', sessionId: 'session', traceId: 'trace', organizationId: 'org', applicationId: 'app', environmentId: 'env' },
  };
  const first = new LocalRunRelay();
  await first.start(options);
  await first.emit('INSTRUMENTATION_VERIFIED');
  const persisted = first.getQueue();
  assert.equal(persisted.length, 1);
  await first.stop();
  available = true;
  const second = new LocalRunRelay();
  await second.start({ ...options, initialQueue: persisted });
  await second.flush();
  assert.equal(second.getQueue().length, 0);
  assert.equal(receivedIds.length, 1);
  await second.flush();
  assert.equal(receivedIds.length, 1);
  await second.stop();
  await new Promise<void>((resolve) => collector.close(() => resolve()));
});
