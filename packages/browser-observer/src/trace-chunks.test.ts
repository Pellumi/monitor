import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BrowserObserver } from './index';
import type { GuidedRunState } from './index';
import { readZip } from './trace-sanitizer';

/** Real headless Chromium: the point is what Playwright actually writes, not what we assume it writes. */

const AUTOMATED_RUN = {
  applicationId: '11111111-1111-4111-8111-111111111111',
  environmentId: '22222222-2222-4222-8222-222222222222',
  workspaceId: null,
  environmentType: 'DEVELOPMENT' as const,
  captureTracks: ['FRONTEND' as const],
  expectedGraphVersionId: '33333333-3333-4333-8333-333333333333',
};

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-trace-'));

async function withApp<T>(run: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'sid=session-cookie-value' });
      res.end('{"ok":true,"echo":"response-body-marker"}');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      '<input id="pw" type="password" />'
      + '<button id="go" onclick="fetch(\'/login\',{method:\'POST\',headers:{Authorization:\'Bearer bearer-token-value\'},body:document.getElementById(\'pw\').value})">Go</button>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as { port: number }).port}/`);
  } finally {
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
}

const retainedTraces = (state: GuidedRunState) => fs.readdirSync(state.artifactDirectory).filter((name) => /^trace-\d/.test(name));

async function startAutomated(url: string, mode: 'AUTOMATED' | 'GUIDED' | 'ASSISTED' = 'AUTOMATED'): Promise<BrowserObserver> {
  const observer = new BrowserObserver({ headless: true });
  await observer.start({ ...AUTOMATED_RUN, mode, targetUrl: url }, tempRoot());
  return observer;
}

test('a retained trace chunk is sanitised: no typed password, header value, body or picture survives', async () => {
  const secret = 'Correct-Horse-Battery-Staple';
  await withApp(async (url) => {
    const observer = await startAutomated(url);
    let kept = false;
    let ended: GuidedRunState;
    try {
      observer.protectAutomationValues([secret]);
      assert.equal(await observer.beginAutomationTraceChunk('login (visit 1)'), true);
      const page = observer.getAutomationPage()!;
      await page.locator('#pw').fill(secret);
      await page.locator('#go').click();
      await page.waitForResponse((response) => response.url().endsWith('/login'));
      kept = await observer.endAutomationTraceChunk({ retain: true, stateKey: 'login', reasons: ['ACTION_DID_NOT_ADVANCE'] });
    } finally {
      ended = await observer.end();
    }
    assert.equal(kept, true);
    const traces = retainedTraces(ended);
    assert.equal(traces.length, 1, 'one retained trace');
    assert.equal(fs.readdirSync(ended.artifactDirectory).filter((name) => name.startsWith('trace-raw')).length, 0, 'the unsanitised recording is gone');

    const entries = readZip(fs.readFileSync(path.join(ended.artifactDirectory, traces[0]!)));
    const names = entries.map((entry) => entry.name);
    assert.ok(names.includes('tellann-sanitized.json'));
    assert.ok(names.some((name) => name.endsWith('.trace')), 'the action log is kept');
    assert.ok(!names.some((name) => name.startsWith('resources/')), 'no screenshots, DOM snapshots or bodies');
    const everything = Buffer.concat(entries.map((entry) => entry.data)).toString('utf8');
    assert.ok(everything.includes('fill'), 'the fill action is still described');
    for (const leaked of [secret, 'bearer-token-value', 'session-cookie-value', 'response-body-marker']) {
      assert.ok(!everything.includes(leaked), `${leaked} must not appear in a stored trace`);
    }

    const manifest = JSON.parse(fs.readFileSync(path.join(ended.artifactDirectory, 'manifest.json'), 'utf8'));
    const listed = manifest.artifacts.find((artifact: { name: string }) => artifact.name === traces[0]);
    assert.ok(listed, 'the trace is listed for upload');
    assert.equal(listed.context.stateKey, 'login');
    assert.match(listed.context.title, /ACTION_DID_NOT_ADVANCE/);
  });
});

test('a discarded trace chunk leaves nothing behind', async () => {
  await withApp(async (url) => {
    const observer = await startAutomated(url);
    let kept = true;
    let ended: GuidedRunState;
    try {
      assert.equal(await observer.beginAutomationTraceChunk('clean state'), true);
      await observer.getAutomationPage()!.reload();
      kept = await observer.endAutomationTraceChunk({ retain: false, stateKey: 'clean', reasons: [] });
      assert.equal(await observer.endAutomationTraceChunk({ retain: true, stateKey: 'x' }), false, 'nothing is open any more');
    } finally {
      ended = await observer.end();
    }
    assert.equal(kept, false);
    assert.equal(fs.readdirSync(ended.artifactDirectory).filter((name) => name.endsWith('.zip')).length, 0);
  });
});

test('starting a chunk while one is open replaces it', async () => {
  await withApp(async (url) => {
    const observer = await startAutomated(url);
    let ended: GuidedRunState;
    try {
      assert.equal(await observer.beginAutomationTraceChunk('first'), true);
      assert.equal(await observer.beginAutomationTraceChunk('second'), true);
      await observer.getAutomationPage()!.reload();
      assert.equal(await observer.endAutomationTraceChunk({ retain: true, stateKey: 'second', reasons: ['RUNTIME_ERRORS'] }), true);
    } finally {
      ended = await observer.end();
    }
    assert.equal(retainedTraces(ended).length, 1);
  });
});

test('a run that ends inside a chunk keeps that last stretch only if the run failed', async () => {
  for (const [how, expected] of [['end', 0], ['abort', 1]] as const) {
    await withApp(async (url) => {
      const observer = await startAutomated(url);
      await observer.beginAutomationTraceChunk('last');
      await observer.getAutomationPage()!.reload();
      const ended = await (how === 'end' ? observer.end() : observer.abort('crashed'));
      assert.equal(retainedTraces(ended).length, expected, how);
    });
  }
});

test('the number of retained traces per run is bounded', async () => {
  await withApp(async (url) => {
    const observer = await startAutomated(url);
    let ended: GuidedRunState;
    try {
      for (let index = 0; index < 12; index += 1) {
        await observer.beginAutomationTraceChunk(`state ${index}`);
        await observer.endAutomationTraceChunk({ retain: true, stateKey: `s${index}`, reasons: ['RUNTIME_ERRORS'] });
      }
    } finally {
      ended = await observer.end();
    }
    assert.equal(retainedTraces(ended).length, 8);
  });
});

test('traces are for Automated runs only', async () => {
  await withApp(async (url) => {
    for (const mode of ['GUIDED', 'ASSISTED'] as const) {
      const observer = await startAutomated(url, mode);
      try {
        assert.equal(await observer.beginAutomationTraceChunk('x'), false, mode);
        assert.equal(await observer.endAutomationTraceChunk({ retain: true, stateKey: null }), false, mode);
      } finally {
        await observer.end();
      }
    }
    assert.equal(await new BrowserObserver({}).beginAutomationTraceChunk('x'), false, 'no run at all');
  });
});
