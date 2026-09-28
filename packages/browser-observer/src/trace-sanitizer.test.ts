import assert from 'node:assert/strict';
import test from 'node:test';
import { REDACTED, crc32, readZip, sanitizeTraceArchive, writeZip } from './trace-sanitizer';

const jsonl = (rows: unknown[]) => Buffer.from(rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');

function archive(entries: Record<string, Buffer | string>): Buffer {
  return writeZip(Object.entries(entries).map(([name, data]) => ({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) })));
}

const linesOf = (zip: Buffer, name: string) => readZip(zip).find((entry) => entry.name === name)!.data.toString('utf8').trim().split('\n').map((line) => JSON.parse(line));

test('the zip codec round-trips entries, including large and binary ones', () => {
  const big = Buffer.alloc(200_000, 'abcdef');
  const binary = Buffer.from([0, 1, 2, 255, 254, 0]);
  const entries = readZip(archive({ 'a.txt': 'hello', 'dir/big.bin': big, 'bin': binary }));
  assert.deepEqual(entries.map((entry) => entry.name), ['a.txt', 'dir/big.bin', 'bin']);
  assert.equal(entries[0]!.data.toString(), 'hello');
  assert.ok(entries[1]!.data.equals(big));
  assert.ok(entries[2]!.data.equals(binary));
});

test('crc32 matches the known check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('something that is not a zip is refused', () => {
  assert.throws(() => readZip(Buffer.from('not a zip at all, just text')), /NOT_A_ZIP_ARCHIVE/);
});

test('the text of a typing action is always removed, whether or not it was registered', () => {
  const zip = archive({
    'trace.trace': jsonl([
      { type: 'before', method: 'fill', params: { selector: '#pw', value: 'hunter2-not-registered' } },
      { type: 'before', method: 'click', params: { selector: 'button' } },
      { type: 'before', method: 'pressSequentially', params: { text: 'secret words' } },
    ]),
  });
  const { archive: out } = sanitizeTraceArchive(zip);
  const [fill, click, typed] = linesOf(out, 'trace.trace');
  assert.equal(fill.params.value, REDACTED);
  assert.equal(fill.params.selector, '#pw', 'what was acted on stays');
  assert.equal(click.params.selector, 'button');
  assert.equal(typed.params.text, REDACTED);
  assert.ok(!Buffer.concat(readZip(out).map((entry) => entry.data)).toString().includes('hunter2'));
});

test('registered protected values are scrubbed wherever they surface', () => {
  const secret = 'Sup3r-Secret-Pass';
  const zip = archive({
    'trace.trace': jsonl([{ type: 'console', text: `login failed for ${secret}` }, { type: 'log', message: 'nothing here' }]),
    'trace.network': jsonl([{ type: 'resource-snapshot', snapshot: { request: { url: `http://app.test/login?pw=${secret}` } } }]),
  });
  const { archive: out, stats } = sanitizeTraceArchive(zip, { protectedValues: [secret] });
  assert.ok(!Buffer.concat(readZip(out).map((entry) => entry.data)).toString().includes(secret));
  assert.ok(stats.redactedValues >= 2);
  assert.match(linesOf(out, 'trace.trace')[0].text, /login failed for \[REDACTED\]/);
});

test('short registered values are not scrubbed, so ordinary words are not mangled', () => {
  const zip = archive({ 'trace.trace': jsonl([{ type: 'console', text: 'the cat sat' }]) });
  const { archive: out } = sanitizeTraceArchive(zip, { protectedValues: ['cat'] });
  assert.equal(linesOf(out, 'trace.trace')[0].text, 'the cat sat');
});

test('cookies and credentials in headers are blanked, other headers are kept', () => {
  const zip = archive({
    'trace.network': jsonl([{
      type: 'resource-snapshot',
      snapshot: {
        request: { method: 'POST', headers: [{ name: 'Cookie', value: 'sid=abc' }, { name: 'Authorization', value: 'Bearer xyz' }, { name: 'Accept', value: 'application/json' }], cookies: [{ name: 'sid', value: 'abc' }], postData: { _sha1: 'deadbeef', mimeType: 'application/json' } },
        response: { status: 200, headers: [{ name: 'Set-Cookie', value: 'sid=new' }, { name: 'Content-Type', value: 'text/html' }], content: { _sha1: 'cafe', size: 10 } },
      },
    }]),
  });
  const { archive: out } = sanitizeTraceArchive(zip);
  const [row] = linesOf(out, 'trace.network');
  const values = Object.fromEntries([...row.snapshot.request.headers, ...row.snapshot.response.headers].map((h: { name: string; value: string }) => [h.name, h.value]));
  assert.equal(values.Cookie, REDACTED);
  assert.equal(values.Authorization, REDACTED);
  assert.equal(values['Set-Cookie'], REDACTED);
  assert.equal(values.Accept, 'application/json');
  assert.equal(values['Content-Type'], 'text/html');
  assert.deepEqual(row.snapshot.request.cookies, []);
  assert.equal(row.snapshot.request.method, 'POST', 'the request itself is still described');
  assert.equal(row.snapshot.response.status, 200);
  const text = JSON.stringify(row);
  assert.ok(!text.includes('sid=') && !text.includes('deadbeef') && !text.includes('cafe'), 'no cookie value or body reference survives');
});

test('resources (screenshots, snapshots, bodies) and unknown entries are dropped', () => {
  const zip = archive({
    'trace.trace': jsonl([{ type: 'log' }]),
    'resources/abc.jpeg': Buffer.from([1, 2, 3]),
    'resources/def': 'response body with a token',
    'trace.stacks': 'stack table',
    'extra.bin': Buffer.from([9]),
  });
  const { archive: out, stats } = sanitizeTraceArchive(zip);
  assert.deepEqual(readZip(out).map((entry) => entry.name).sort(), ['tellann-sanitized.json', 'trace.trace']);
  assert.equal(stats.droppedResources, 4);
});

test('a line that cannot be parsed is dropped rather than trusted', () => {
  const zip = archive({ 'trace.trace': Buffer.from('{"type":"log"}\n{not json password=hunter2\n{"type":"console","text":"kept"}\n') });
  const { archive: out, stats } = sanitizeTraceArchive(zip);
  assert.equal(stats.droppedLines, 1);
  assert.equal(linesOf(out, 'trace.trace').length, 2);
  assert.ok(!Buffer.concat(readZip(out).map((entry) => entry.data)).toString().includes('hunter2'));
});

test('URLs are passed through the URL sanitiser', () => {
  const zip = archive({ 'trace.network': jsonl([{ snapshot: { request: { url: 'http://app.test/cb?token=abc123' } } }]) });
  const { archive: out } = sanitizeTraceArchive(zip, { sanitizeUrl: (url) => url.split('?')[0]! });
  assert.equal(linesOf(out, 'trace.network')[0].snapshot.request.url, 'http://app.test/cb');
});

test('the result says it was sanitised', () => {
  const { archive: out } = sanitizeTraceArchive(archive({ 'trace.trace': jsonl([{ type: 'log' }]) }));
  const marker = JSON.parse(readZip(out).find((entry) => entry.name === 'tellann-sanitized.json')!.data.toString());
  assert.equal(marker.sanitized, true);
});

test('the log line that quotes a typed value is redacted, and element markup is cut back to its tag', () => {
  const zip = archive({
    'trace.trace': jsonl([
      { type: 'before', callId: 'c1', method: 'fill', params: { selector: '#pw', value: 'unregistered-secret' } },
      { type: 'log', callId: 'c1', time: 1, message: '  fill("unregistered-secret")' },
      { type: 'before', callId: 'c2', method: 'click', params: { selector: '#go' } },
      { type: 'log', callId: 'c2', time: 2, message: `  locator resolved to <button id="go" onclick="send('Bearer abc123')">Go</button>` },
      { type: 'log', callId: 'c2', time: 3, message: '  waiting for element to be visible, enabled and stable' },
    ]),
  });
  const rows = linesOf(sanitizeTraceArchive(zip).archive, 'trace.trace');
  assert.equal(rows[1].message, REDACTED);
  assert.equal(rows[3].message, '  locator resolved to <button>');
  assert.equal(rows[4].message, '  waiting for element to be visible, enabled and stable', 'ordinary progress lines are untouched');
  assert.ok(!JSON.stringify(rows).includes('unregistered-secret') && !JSON.stringify(rows).includes('abc123'));
});

test('what an evaluate returns is never kept, nor the code it ran', () => {
  const zip = archive({
    'trace.trace': jsonl([
      { type: 'before', callId: 'c3', class: 'Frame', method: 'evaluateExpression', params: { expression: '(() => document.body.innerText)()', arg: { value: { s: 'private page text' } } } },
      { type: 'after', callId: 'c3', endTime: 9, result: { value: { s: 'private page text' } } },
    ]),
  });
  const rows = linesOf(sanitizeTraceArchive(zip).archive, 'trace.trace');
  assert.equal(rows[0].params.expression, REDACTED);
  assert.equal(rows[0].params.arg, REDACTED);
  assert.equal(rows[1].result, undefined);
  assert.equal(rows[1].endTime, 9, 'timing survives');
  assert.ok(!JSON.stringify(rows).includes('private page text'));
});

test('event kinds that carry page content are dropped whole', () => {
  const zip = archive({
    'trace.trace': jsonl([
      { type: 'frame-snapshot', snapshot: { html: ['<input value="secret">'] } },
      { type: 'screencast-frame', sha1: 'abc' },
      { type: 'input', inputSnapshot: 'x' },
      { type: 'event', class: 'BrowserContext', method: 'page', params: { text: 'x' } },
      { type: 'after', callId: 'c9', endTime: 1, error: { message: 'timeout' } },
    ]),
  });
  const rows = linesOf(sanitizeTraceArchive(zip).archive, 'trace.trace');
  assert.deepEqual(rows.map((row) => row.type), ['after']);
  assert.deepEqual(rows[0].error, { message: 'timeout' }, 'a failure is still explained');
});

test('unrecognised fields on a known event are not carried over', () => {
  const zip = archive({ 'trace.trace': jsonl([{ type: 'console', text: 'hi', args: [{ preview: 'token=abc', value: 'abc' }], location: { url: 'http://x/?t=1' } }]) });
  const [row] = linesOf(sanitizeTraceArchive(zip).archive, 'trace.trace');
  assert.equal(row.args, undefined);
  assert.equal(row.text, 'hi');
});
