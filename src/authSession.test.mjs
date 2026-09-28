import test from 'node:test';
import assert from 'node:assert/strict';
import { classify401, requestToken, isApiRequest, readAuthCode, normalizeSession, idleRemaining, endSessionMessage } from './authSession.js';

const API = 'http://api.test:3000';

test('401 codes that end the current session', () => {
  for (const code of ['AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_INVALID', 'AUTH_TOKEN_REVOKED', 'AUTH_USER_NOT_FOUND', 'AUTH_TOKEN_NOT_ACTIVE', null]) {
    assert.equal(classify401({ code, requestTokenValue: 'B', currentToken: 'B', url: `${API}/api/pea-jobs` }), 'end-session', String(code));
  }
});

test('401 that must not touch the session', () => {
  const base = { requestTokenValue: 'B', currentToken: 'B', url: `${API}/api/pea-jobs` };
  assert.equal(classify401({ ...base, code: 'AUTH_TOKEN_MISSING' }), 'ignore');
  assert.equal(classify401({ ...base, code: 'AUTH_INVALID_CREDENTIALS' }), 'ignore');
  // token A answers late after the user logged in again and holds token B
  assert.equal(classify401({ ...base, code: 'AUTH_TOKEN_EXPIRED', requestTokenValue: 'A' }), 'ignore');
  assert.equal(classify401({ ...base, code: 'AUTH_TOKEN_EXPIRED', requestTokenValue: null }), 'ignore');
  assert.equal(classify401({ ...base, code: 'AUTH_TOKEN_EXPIRED', currentToken: null }), 'ignore');
  assert.equal(classify401({ ...base, code: null, url: `${API}/api/auth/login` }), 'ignore');
  assert.equal(classify401({ ...base, code: 'AUTH_TOKEN_REVOKED', url: `${API}/api/auth/logout` }), 'ignore');
});

test('reads the Bearer token from init headers and Request objects', () => {
  assert.equal(requestToken('/x', { headers: { Authorization: 'Bearer abc' } }), 'abc');
  assert.equal(requestToken('/x', { headers: { authorization: 'bearer abc' } }), 'abc');
  assert.equal(requestToken('/x', { headers: new Headers({ Authorization: 'Bearer h1' }) }), 'h1');
  assert.equal(requestToken('/x', { headers: [['AUTHORIZATION', 'Bearer arr']] }), 'arr');
  assert.equal(requestToken(new Request(`${API}/api/x`, { headers: { Authorization: 'Bearer req' } })), 'req');
  assert.equal(requestToken('/x', { headers: { 'Content-Type': 'application/json' } }), null);
  assert.equal(requestToken('/x'), null);
});

test('only API requests are considered', () => {
  assert.equal(isApiRequest(`${API}/api/pea-jobs`, API), true);
  assert.equal(isApiRequest(new Request(`${API}/api/pea-jobs`), `${API}/`), true);
  assert.equal(isApiRequest('https://tile.openstreetmap.org/1/1/1.png', API), false);
  assert.equal(isApiRequest(`${API}/uploads/x.pdf`, API), false);
});

test('reads the error code without consuming the body', async () => {
  const response = new Response(JSON.stringify({ success: false, error: { code: 'AUTH_TOKEN_REVOKED' } }), { status: 401 });
  assert.equal(await readAuthCode(response), 'AUTH_TOKEN_REVOKED');
  assert.equal((await response.json()).error.code, 'AUTH_TOKEN_REVOKED');
  assert.equal(await readAuthCode(new Response('not json', { status: 401 })), null);
});

test('session metadata and idle time', () => {
  const now = Date.parse('2026-09-28T10:00:00Z');
  assert.deepEqual(normalizeSession({ expires_at: '2026-09-29T10:00:00.000Z', token_ttl_seconds: 86400 }, now), { expiresAt: '2026-09-29T10:00:00.000Z', ttlSeconds: 86400, expired: false });
  assert.equal(normalizeSession({ expires_at: 'nope' }, now), null);
  assert.equal(normalizeSession(null, now), null);
  assert.equal(idleRemaining(String(now - 10 * 60000), 30 * 60000, now), 20 * 60000);
  assert.equal(idleRemaining(String(now - 40 * 60000), 30 * 60000, now), 0);
  assert.equal(idleRemaining(null, 30 * 60000, now), 0);
  assert.match(endSessionMessage('AUTH_TOKEN_EXPIRED'), /24 ชั่วโมง/);
  assert.match(endSessionMessage('SOMETHING_NEW'), /เข้าสู่ระบบใหม่/);
});
