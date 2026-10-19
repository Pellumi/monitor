import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestPersona } from '@tellann/desktop-contracts';
import { fetchApiSession, storageStateFromSeed, suppliedSessionValues } from './supplied-session';
import type { FetchLike } from './supplied-session';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

const persona = (over: Partial<TestPersona> = {}): TestPersona => ({
  id: 'p1', applicationId: APP_ID, name: 'Teacher', roles: ['TEACHER'], authenticated: true, authMethod: 'SEEDED',
  credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'hunt"er2' }],
  createdAt: TIMESTAMP, updatedAt: TIMESTAMP, ...over,
});

const answering = (status: number, body: string): FetchLike => async () => ({ ok: status < 400, status, text: async () => body });

// -- a session supplied outright -------------------------------------------------------------------

test('a supplied cookie gets the host of the address the run is pointed at, and the scheme decides `secure`', () => {
  const secure = storageStateFromSeed({ cookies: [{ name: 'sid', value: 'abc' }], storage: [] }, 'https://staging.example.com/app');
  assert.deepEqual(secure.cookies, [{ name: 'sid', value: 'abc', domain: 'staging.example.com', path: '/', expires: -1, httpOnly: false, secure: true, sameSite: 'Lax' }]);

  // A secure cookie handed to an http origin is one the browser drops without saying so, which would look
  // exactly like a session the application rejected.
  const plain = storageStateFromSeed({ cookies: [{ name: 'sid', value: 'abc' }], storage: [] }, 'http://localhost:5173/');
  assert.equal(plain.cookies[0]!.secure, false);
  assert.equal(plain.cookies[0]!.domain, 'localhost');
});

test('a cookie that names its own domain and path keeps them', () => {
  const state = storageStateFromSeed({ cookies: [{ name: 'sid', value: 'abc', domain: '.example.com', path: '/app' }], storage: [] }, 'https://staging.example.com/');
  assert.equal(state.cookies[0]!.domain, '.example.com');
  assert.equal(state.cookies[0]!.path, '/app');
});

test('storage entries are written for the run\'s own origin, and nothing is written when there are none', () => {
  const withStorage = storageStateFromSeed({ cookies: [], storage: [{ key: 'auth.token', value: 'jwt' }] }, 'https://staging.example.com/app?x=1');
  assert.deepEqual(withStorage.origins, [{ origin: 'https://staging.example.com', localStorage: [{ name: 'auth.token', value: 'jwt' }] }]);
  assert.deepEqual(storageStateFromSeed({ cookies: [], storage: [] }, 'https://x.example.com').origins, []);
});

test('every value a supplied session is made of is offered for protection, and nothing else is', () => {
  const values = suppliedSessionValues(persona({ sessionSeed: { cookies: [{ name: 'sid', value: 'cookie-value' }], storage: [{ key: 'k', value: 'storage-value' }] } }));
  assert.deepEqual(values.sort(), ['cookie-value', 'storage-value']);
  assert.deepEqual(suppliedSessionValues(persona()), [], 'a persona with no supplied session has nothing to protect');
  assert.deepEqual(suppliedSessionValues(null), []);
});

// -- a session fetched from the application --------------------------------------------------------

const apiLogin = { url: '/api/auth/login', body: '{"email":"{{email}}","password":"{{password}}"}', tokenPath: 'data.accessToken', target: { kind: 'LOCAL_STORAGE' as const, name: 'auth.token' } };

test('the token is read from the answer and put where the application looks for it', async () => {
  const sent: Array<{ url: string; body: string }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    sent.push({ url, body: init.body });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: { accessToken: 'jwt-123' } }) };
  };
  const result = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://staging.example.com/app', fetchImpl);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.token, 'jwt-123');
  assert.deepEqual(result.storageState.origins, [{ origin: 'https://staging.example.com', localStorage: [{ name: 'auth.token', value: 'jwt-123' }] }]);
  assert.equal(sent[0]!.url, 'https://staging.example.com/api/auth/login', 'a path is resolved against the run\'s address');
});

test('a cookie target produces a cookie instead', async () => {
  const result = await fetchApiSession(
    { ...apiLogin, target: { kind: 'COOKIE', name: 'sid' } },
    persona({ authMethod: 'API' }),
    'https://staging.example.com/',
    answering(200, JSON.stringify({ data: { accessToken: 'jwt-123' } })),
  );
  assert.equal(result.ok && result.storageState.cookies[0]?.name, 'sid');
  assert.equal(result.ok && result.storageState.cookies[0]?.value, 'jwt-123');
});

test('a credential placeholder is escaped as JSON, so a password with a quote in it does not break the request', async () => {
  let body = '';
  await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://x.example.com', async (_url, init) => {
    body = init.body;
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: { accessToken: 't' } }) };
  });
  assert.equal(body, '{"email":"teacher@test.dev","password":"hunt\\"er2"}');
  assert.deepEqual(JSON.parse(body), { email: 'teacher@test.dev', password: 'hunt"er2' }, 'and the server reads back what was meant');
});

test('a placeholder with nothing behind it fails the request rather than posting it literally', async () => {
  let called = false;
  const result = await fetchApiSession(
    { ...apiLogin, body: '{"tenant":"{{tenantId}}"}' },
    persona({ authMethod: 'API' }),
    'https://x.example.com',
    async () => { called = true; return { ok: true, status: 200, text: async () => '{}' }; },
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.detail, /no stored tenantId/);
  assert.equal(called, false, 'nothing was sent');
});

test('a refused sign-in reports the status and never the answer, which routinely echoes what was sent', async () => {
  const result = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://staging.example.com/', answering(401, '{"error":"bad password for teacher@test.dev"}'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.detail, /answered 401/);
  assert.ok(!result.detail.includes('teacher@test.dev'), 'the reason does not quote back the credentials');
  assert.ok(!result.detail.includes('bad password'));
});

test('an answer that is not JSON, or has no token where it was promised, says which', async () => {
  const notJson = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://x.example.com', answering(200, '<html>no</html>'));
  assert.match(notJson.ok ? '' : notJson.detail, /not JSON/);

  const noToken = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://x.example.com', answering(200, JSON.stringify({ data: {} })));
  assert.match(noToken.ok ? '' : noToken.detail, /no token at "data\.accessToken"/);

  const notAString = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://x.example.com', answering(200, JSON.stringify({ data: { accessToken: { nested: true } } })));
  assert.equal(notAString.ok, false);
});

test('a request that cannot be made at all is reported without the body in it', async () => {
  const bad = await fetchApiSession({ ...apiLogin, url: 'ftp://files.example.com/' }, persona({ authMethod: 'API' }), 'https://x.example.com', answering(200, '{}'));
  assert.match(bad.ok ? '' : bad.detail, /only be fetched over http/);

  const threw = await fetchApiSession(apiLogin, persona({ authMethod: 'API' }), 'https://x.example.com', async () => {
    throw new Error('getaddrinfo ENOTFOUND x.example.com\n  body: {"password":"hunt\\"er2"}');
  });
  assert.equal(threw.ok, false);
  if (threw.ok) return;
  assert.match(threw.detail, /ENOTFOUND/);
  assert.ok(!threw.detail.includes('hunt'), 'only the first line of the failure, which cannot carry the body');
});
