import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { AutomationLimitsSchema } from '@tellann/desktop-contracts';
import { BrowserObserver } from './index';

/**
 * Against a real React 19 development build in real Chromium. The fiber shapes the hook reads are
 * React's private business, so a hand-built fake would only prove the hook agrees with itself.
 */

const APP_SOURCE = `
import React from 'react';
import { createRoot } from 'react-dom/client';

function burn() { let x = 0; for (let i = 0; i < 300000; i += 1) x += i; return x; }

function CreateExamForm() { burn(); return React.createElement('form', { id: 'form' }, React.createElement('button', { id: 'go' }, 'Go')); }
function Unwatched() { burn(); return React.createElement('p', null, 'not watched'); }
const CounterMemo = React.memo(function Counter() {
  const [n, setN] = React.useState(0);
  return React.createElement('button', { id: 'inc', onClick: () => setN(n + 1) }, 'n=' + n);
});
function App() {
  return React.createElement('div', null, React.createElement(CreateExamForm), React.createElement(Unwatched), React.createElement(CounterMemo));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
`;

const bundle = async (): Promise<string> => {
  const result = await build({
    stdin: { contents: APP_SOURCE, resolveDir: __dirname, loader: 'js' },
    bundle: true,
    write: false,
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'silent',
  });
  return result.outputFiles[0]!.text;
};

async function withReactApp<T>(run: (url: string) => Promise<T>): Promise<T> {
  const script = await bundle();
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<div id="root"></div><script>${script.replace(/<\/script/gi, '<\\/script')}</script>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${(server.address() as { port: number }).port}/`);
  } finally {
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
}

const RUN = {
  applicationId: '11111111-1111-4111-8111-111111111111',
  environmentId: '22222222-2222-4222-8222-222222222222',
  workspaceId: null,
  environmentType: 'DEVELOPMENT' as const,
  captureTracks: ['FRONTEND' as const],
  expectedGraphVersionId: '33333333-3333-4333-8333-333333333333',
};

async function start(url: string, components: string[]): Promise<BrowserObserver> {
  const observer = new BrowserObserver({ headless: true });
  await observer.start({
    ...RUN,
    mode: 'AUTOMATED',
    targetUrl: url,
    automation: {
      targetTerminalStateKey: 'exam_created', executionProfileId: 'profile-1',
      limits: AutomationLimitsSchema.parse({}), renderTimingComponents: components,
    },
  }, fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-render-')));
  return observer;
}

// Playwright's `page.waitForSelector` returns once the DOM is there; React has committed by then.
const ready = async (observer: BrowserObserver) => { await observer.getAutomationPage()!.waitForSelector('#go'); };

test('only the named components are timed, with counts and durations', async () => {
  await withReactApp(async (url) => {
    const observer = await start(url, ['CreateExamForm', 'Counter']);
    try {
      await ready(observer);
      const samples = await observer.takeRenderTiming();
      const byName = Object.fromEntries(samples.map((sample) => [sample.component, sample]));
      assert.deepEqual(Object.keys(byName).sort(), ['Counter', 'CreateExamForm'], 'App and Unwatched are not measured');
      assert.equal(byName.CreateExamForm!.mounts, 1);
      assert.equal(byName.CreateExamForm!.updates, 0);
      assert.ok(byName.CreateExamForm!.totalMs > 0, 'a real duration was recorded');
      assert.ok(byName.CreateExamForm!.maxMs <= byName.CreateExamForm!.totalMs);
      assert.equal(byName.Counter!.mounts, 1, 'a memo() component is found by the name of what it wraps');
    } finally {
      await observer.end();
    }
  });
});

test('re-renders are counted as updates, and reading resets the counters', async () => {
  await withReactApp(async (url) => {
    const observer = await start(url, ['CreateExamForm', 'Counter']);
    try {
      await ready(observer);
      await observer.takeRenderTiming();
      assert.deepEqual(await observer.takeRenderTiming(), [], 'nothing rendered since the last read');

      const page = observer.getAutomationPage()!;
      await page.locator('#inc').click();
      await page.waitForFunction(() => document.getElementById('inc')?.textContent === 'n=1');
      const [counter, ...rest] = await observer.takeRenderTiming();
      assert.equal(rest.length, 0, 'only the component that re-rendered');
      assert.equal(counter!.component, 'Counter');
      assert.equal(counter!.updates, 1);
      assert.equal(counter!.mounts, 0);
    } finally {
      await observer.end();
    }
  });
});

test('each render is also published as a User Timing measure', async () => {
  await withReactApp(async (url) => {
    const observer = await start(url, ['CreateExamForm']);
    try {
      await ready(observer);
      const count = await observer.getAutomationPage()!.evaluate(() => performance.getEntriesByName('tellann:render:CreateExamForm').length);
      assert.ok(count >= 1);
      const unwatched = await observer.getAutomationPage()!.evaluate(() => performance.getEntriesByName('tellann:render:Unwatched').length);
      assert.equal(unwatched, 0);
    } finally {
      await observer.end();
    }
  });
});

test('a run that did not opt in installs nothing in the page at all', async () => {
  await withReactApp(async (url) => {
    const observer = await start(url, []);
    try {
      await ready(observer);
      assert.deepEqual(await observer.takeRenderTiming(), []);
      const installed = await observer.getAutomationPage()!.evaluate(() => ({
        hook: '__REACT_DEVTOOLS_GLOBAL_HOOK__' in window,
        timing: '__tellannRenderTiming' in window,
      }));
      assert.deepEqual(installed, { hook: false, timing: false });
    } finally {
      await observer.end();
    }
  });
});

test('the application still works with the hook in place', async () => {
  await withReactApp(async (url) => {
    const observer = await start(url, ['Counter']);
    try {
      await ready(observer);
      const page = observer.getAutomationPage()!;
      await page.locator('#inc').click();
      await page.locator('#inc').click();
      await page.waitForFunction(() => document.getElementById('inc')?.textContent === 'n=2');
      assert.equal(await page.locator('#inc').textContent(), 'n=2');
    } finally {
      await observer.end();
    }
  });
});

test('render timing is refused outside an Automated run', async () => {
  await withReactApp(async (url) => {
    const observer = new BrowserObserver({ headless: true });
    await observer.start({ ...RUN, mode: 'GUIDED', targetUrl: url, automation: undefined }, fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-render-')));
    try {
      assert.deepEqual(await observer.takeRenderTiming(), []);
    } finally {
      await observer.end();
    }
  });
});

test('with no run there is nothing to read', async () => {
  assert.deepEqual(await new BrowserObserver({}).takeRenderTiming(), []);
});
