import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScreenAnalysisRequest, proxyScreenAnalysis, ScreenAnalysisError } from './screen-analysis';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]).toString('base64');

test('accepts only a bounded PNG payload and known reason', () => {
  const parsed = parseScreenAnalysisRequest({ requestId: 'r1', reason: 'CONTROL_NOT_FOUND', mimeType: 'image/png', imageBase64: PNG });
  assert.equal(parsed.requestId, 'r1');
  assert.throws(() => parseScreenAnalysisRequest({ requestId: 'r1', reason: 'OTHER', mimeType: 'image/png', imageBase64: PNG }), ScreenAnalysisError);
  assert.throws(() => parseScreenAnalysisRequest({ requestId: 'r1', reason: 'CONTROL_NOT_FOUND', mimeType: 'image/jpeg', imageBase64: PNG }), ScreenAnalysisError);
});

test('forwards secrets only as Modal headers and strips raw model output', async () => {
  let captured: RequestInit | undefined;
  const response = await proxyScreenAnalysis(
    parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
    { baseUrl: 'https://worker.example', modalKey: 'wk-secret', modalSecret: 'ws-secret' },
    async (_url, init) => {
      captured = init;
      return new Response(JSON.stringify({
        request_id: 'r1', model: 'baidu/Unlimited-OCR', model_revision: 'rev',
        image: { width: 1280, height: 720 }, text: 'Continue', raw_text: 'must-not-leave-backend', latency_ms: 10,
        detections: [{ type: 'text', text: 'Continue', box_pixels: [1, 2, 30, 20] }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  );
  assert.equal((captured?.headers as Record<string, string>)['Modal-Key'], 'wk-secret');
  assert.equal((captured?.headers as Record<string, string>)['Modal-Secret'], 'ws-secret');
  assert.ok(!JSON.stringify(response).includes('must-not-leave-backend'));
  assert.deepEqual(response.detections[0]?.boxPixels, [1, 2, 30, 20]);
});

test('configuration failures never include credential values', async () => {
  await assert.rejects(
    proxyScreenAnalysis(parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_UNRECOGNIZED', mimeType: 'image/png', imageBase64: PNG }), {}),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_NOT_CONFIGURED',
  );
});

test('rejects an image over the size limit', () => {
  const oversized = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(12 * 1024 * 1024 + 1024),
  ]).toString('base64');
  assert.throws(
    () => parseScreenAnalysisRequest({ requestId: 'r1', reason: 'CONTROL_NOT_FOUND', mimeType: 'image/png', imageBase64: oversized }),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_IMAGE_INVALID',
  );
});

test('rejects malformed base64 and valid base64 that is not a PNG', () => {
  assert.throws(
    () => parseScreenAnalysisRequest({ requestId: 'r1', reason: 'CONTROL_NOT_FOUND', mimeType: 'image/png', imageBase64: 'not-valid-base64!!' }),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_IMAGE_INVALID',
  );
  const notPng = Buffer.from('this is not a png').toString('base64');
  assert.throws(
    () => parseScreenAnalysisRequest({ requestId: 'r1', reason: 'CONTROL_NOT_FOUND', mimeType: 'image/png', imageBase64: notPng }),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_IMAGE_INVALID',
  );
});

test('maps an upstream timeout to SCREEN_ANALYSIS_TIMEOUT', async () => {
  await assert.rejects(
    proxyScreenAnalysis(
      parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
      { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
      async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); },
    ),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_TIMEOUT',
  );
});

test('maps a generic fetch failure to SCREEN_ANALYSIS_UPSTREAM_UNAVAILABLE', async () => {
  await assert.rejects(
    proxyScreenAnalysis(
      parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
      { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
      async () => { throw new Error('network down'); },
    ),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_UPSTREAM_UNAVAILABLE',
  );
});

test('maps a non-ok upstream response to SCREEN_ANALYSIS_UPSTREAM_REJECTED', async () => {
  await assert.rejects(
    proxyScreenAnalysis(
      parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
      { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
      async () => new Response('server error', { status: 500 }),
    ),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_UPSTREAM_REJECTED',
  );
});

test('clamps the number of detections to 500', async () => {
  const detections = Array.from({ length: 600 }, (_, index) => ({ type: 'text', text: `t${index}`, box_pixels: [0, 0, 10, 10] }));
  const response = await proxyScreenAnalysis(
    parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
    { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
    async () => new Response(JSON.stringify({
      request_id: 'r1', model: 'm', model_revision: 'v', image: { width: 100, height: 100 }, text: '', latency_ms: 1, detections,
    }), { status: 200 }),
  );
  assert.equal(response.detections.length, 500);
});

test('drops detections with malformed box_pixels', async () => {
  const response = await proxyScreenAnalysis(
    parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
    { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
    async () => new Response(JSON.stringify({
      request_id: 'r1', model: 'm', model_revision: 'v', image: { width: 100, height: 100 }, text: '', latency_ms: 1,
      detections: [
        { type: 'text', text: 'good', box_pixels: [1, 2, 3, 4] },
        { type: 'text', text: 'bad-length', box_pixels: [1, 2, 3] },
        { type: 'text', text: 'bad-negative', box_pixels: [-1, 2, 3, 4] },
        { type: 'text', text: 'bad-nonfinite', box_pixels: [1, 2, 3, 'oops'] },
      ],
    }), { status: 200 }),
  );
  assert.deepEqual(response.detections.map((item) => item.text), ['good']);
});

test('rejects a malformed upstream response missing required fields', async () => {
  await assert.rejects(
    proxyScreenAnalysis(
      parseScreenAnalysisRequest({ requestId: 'r1', reason: 'STATE_AMBIGUOUS', mimeType: 'image/png', imageBase64: PNG }),
      { baseUrl: 'https://worker.example', modalKey: 'k', modalSecret: 's' },
      async () => new Response(JSON.stringify({ model: 'm' }), { status: 200 }),
    ),
    (error: unknown) => error instanceof ScreenAnalysisError && error.message === 'SCREEN_ANALYSIS_RESPONSE_INVALID',
  );
});
