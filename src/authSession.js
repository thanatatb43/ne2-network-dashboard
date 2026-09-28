// Pure helpers for the app's auth/session handling (kept free of React so
// they can be unit-tested). Contract: REMAINING_UX_UI_BACKEND_RESPONSE.md,
// "เพิ่มเติม 28 กันยายน 2026" item 5 -- JWT lives 24 h, no refresh token,
// concurrent logins are allowed and logout revokes only the token it sends.

// 401 codes that mean the token the request carried can no longer be used.
const END_SESSION_CODES = new Set([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_REVOKED',
  'AUTH_USER_NOT_FOUND',
  'AUTH_TOKEN_NOT_ACTIVE'
]);

export const AUTH_MESSAGES = {
  AUTH_TOKEN_EXPIRED: 'เซสชันหมดอายุแล้ว (เข้าสู่ระบบแต่ละครั้งใช้ได้ 24 ชั่วโมง) กรุณาเข้าสู่ระบบใหม่',
  AUTH_TOKEN_REVOKED: 'เซสชันนี้ถูกออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่',
  AUTH_TOKEN_INVALID: 'ข้อมูลการเข้าสู่ระบบไม่ถูกต้องหรือระบบเปลี่ยนการตั้งค่า กรุณาเข้าสู่ระบบใหม่',
  AUTH_USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้นี้ในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ',
  AUTH_TOKEN_NOT_ACTIVE: 'เซสชันยังใช้งานไม่ได้ อาจเป็นเพราะเวลาของเครื่องไม่ตรง กรุณาตรวจสอบเวลาแล้วเข้าสู่ระบบใหม่',
  AUTH_INVALID_CREDENTIALS: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  AUTH_FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้',
  AUTH_SERVICE_UNAVAILABLE: 'ระบบตรวจสอบการเข้าสู่ระบบไม่พร้อมชั่วคราว กรุณาลองใหม่อีกครั้ง',
  UNKNOWN_401: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'
};

export const authCodeOf = (body) => (body && typeof body === 'object' ? body.error?.code || body.code || null : null);

// Reads the error code without consuming the response the caller will read.
export async function readAuthCode(response) {
  try { return authCodeOf(await response.clone().json()); } catch { return null; }
}

const bearerFrom = (value) => {
  const match = /^Bearer\s+(.+)$/i.exec(String(value || '').trim());
  return match ? match[1].trim() : null;
};

const headerValue = (headers, name) => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  if (Array.isArray(headers)) {
    const pair = headers.find(([k]) => String(k).toLowerCase() === name.toLowerCase());
    return pair ? pair[1] : null;
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
};

// The Bearer token a fetch(input, init) call carried, from init.headers or a
// Request object's headers.
export function requestToken(input, init) {
  return bearerFrom(headerValue(init?.headers, 'authorization'))
    || (input && typeof input === 'object' && 'headers' in input ? bearerFrom(headerValue(input.headers, 'authorization')) : null);
}

export function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') return input.url || String(input);
  return '';
}

export const isApiRequest = (input, apiBase) => {
  const url = requestUrl(input);
  return Boolean(apiBase) && url.startsWith(`${String(apiBase).replace(/\/$/, '')}/api/`);
};

// What a 401 on an API request means for the current session:
//  'end-session' -- this session's token is dead: clear it (without calling
//                   logout, the token is already unusable) and ask to log in
//  'ignore'      -- not about the current session (no token sent, an older
//                   token answered late, or the login endpoint itself)
export function classify401({ code, requestTokenValue, currentToken, url = '' }) {
  if (/\/api\/auth\/(login|logout)\b/.test(url)) return 'ignore';
  if (!requestTokenValue || !currentToken) return 'ignore';
  if (requestTokenValue !== currentToken) return 'ignore';
  if (code === 'AUTH_TOKEN_MISSING' || code === 'AUTH_INVALID_CREDENTIALS') return 'ignore';
  if (!code || END_SESSION_CODES.has(code)) return 'end-session';
  return 'ignore';
}

export const endSessionMessage = (code) => AUTH_MESSAGES[code] || AUTH_MESSAGES.UNKNOWN_401;

// Session metadata from login/verify/SSO (never decoded from the JWT).
export function normalizeSession(session, now = Date.now()) {
  if (!session || typeof session !== 'object') return null;
  const at = Date.parse(session.expires_at);
  if (Number.isNaN(at)) return null;
  return { expiresAt: new Date(at).toISOString(), ttlSeconds: Number(session.token_ttl_seconds) || null, expired: at <= now };
}

// The idle timer runs in every tab but last activity is shared through
// localStorage: a tab only ends the session when no tab was active recently.
export function idleRemaining(lastActivity, timeoutMs, now = Date.now()) {
  const last = Number(lastActivity);
  if (!Number.isFinite(last) || last <= 0) return 0;
  return Math.max(0, last + timeoutMs - now);
}
