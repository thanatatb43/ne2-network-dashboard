// /api/office-drawings: queries (per-endpoint allowlists -- the API answers
// 400 to unknown parameters), requests with timeout, Thai error text and the
// writable payload for POST/PUT. Read endpoints are public: the token is
// attached only when there is a session (permissions come back with it).

const API = import.meta.env?.VITE_API_BASE_URL ?? '';
export const DRAWINGS_PATH = '/api/office-drawings';
export const REQUEST_TIMEOUT_MS = 20000;
export const LIST_LIMIT = 20;
export const SITES_LIMIT = 50;
export const OPTIONS_LIMIT = 20;
export const EDIT_ROLES = ['super_admin', 'network_admin', 'computer_admin'];
export const roleCanEdit = (user) => EDIT_ROLES.includes(user?.role);

export const LIST_SORTS = ['updated_at', 'name', 'created_at'];
const ALLOWED = {
  selectors: ['search', 'page', 'limit'],
  list: ['pea_site_id', 'search', 'drawing_type', 'page', 'limit', 'sort', 'order'],
  equipmentOptions: ['pea_site_id', 'kind', 'search', 'page', 'limit']
};

export function buildQuery(endpoint, params) {
  const q = new URLSearchParams();
  for (const key of ALLOWED[endpoint]) {
    const v = params[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') q.set(key, String(v).trim());
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const urls = {
  selectors: (p) => `${API}${DRAWINGS_PATH}/selectors${buildQuery('selectors', p)}`,
  capabilities: () => `${API}${DRAWINGS_PATH}/capabilities`,
  list: (p) => `${API}${DRAWINGS_PATH}${buildQuery('list', p)}`,
  drawing: (id) => `${API}${DRAWINGS_PATH}/${encodeURIComponent(id)}`,
  links: (id) => `${API}${DRAWINGS_PATH}/${encodeURIComponent(id)}/equipment-links`,
  create: () => `${API}${DRAWINGS_PATH}`,
  equipmentOptions: (p) => `${API}${DRAWINGS_PATH}/equipment-options${buildQuery('equipmentOptions', p)}`
};

export function errorText(result) {
  const { status, code, field } = result;
  if (code === 'TIMEOUT') return 'เซิร์ฟเวอร์ตอบช้าเกินไป';
  if (code === 'NETWORK') return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
  if (status === 401) return 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ';
  if (status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการนี้';
  if (status === 404 || code === 'DRAWING_NOT_FOUND') return 'ไม่พบแบบนี้ หรือแบบถูกลบแล้ว';
  if (status === 409 || code === 'VERSION_CONFLICT') return 'มีผู้อื่นบันทึกแบบนี้ไปก่อนแล้ว';
  if (status === 413 || code === 'DOCUMENT_TOO_LARGE') return 'แบบมีขนาดใหญ่เกินที่ระบบรับได้ (2 MB) กรุณาลดจำนวนวัตถุหรือข้อความ';
  if (status === 422 || code === 'INVALID_ASSET_REFERENCE') return 'อุปกรณ์ที่ผูกไว้ใช้ไม่ได้ (อยู่สำนักงานอื่น ถูกลบ หรือไม่มีในทะเบียน) กรุณาถอดหรือเลือกใหม่';
  if (code === 'UNSUPPORTED_SCHEMA_VERSION') return 'แบบนี้ใช้รูปแบบข้อมูลรุ่นใหม่กว่าที่หน้านี้รองรับ';
  if (code === 'INVALID_DOCUMENT') return `ข้อมูลแบบไม่ถูกต้อง${field ? ` (${field})` : ''}`;
  if (status === 400) return `คำขอไม่ถูกต้อง${field ? ` (${field})` : ''}`;
  if (status === 503) return 'ระบบยืนยันตัวตนขัดข้องชั่วคราว กรุณาลองใหม่';
  if (status >= 500) return 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่';
  return 'ดำเนินการไม่สำเร็จ';
}

// -> { ok: true, data, pagination, body } | { ok: false, status, code, field,
// message, currentVersion, updatedAt }. Network failure and timeout are
// status 0 (for a POST/PUT/DELETE: the outcome is unknown).
export async function request(url, { method = 'GET', token = null, body, signal, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      const code = timedOut ? 'TIMEOUT' : 'NETWORK';
      return { ok: false, status: 0, code, message: errorText({ code }) };
    }
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    if (res.ok && json && json.success !== false) return { ok: true, status: res.status, data: json.data, pagination: json.pagination || null, body: json };
    const err = json?.error || {};
    const result = { ok: false, status: res.status, code: err.code || '', field: err.field || null, currentVersion: err.current_version ?? null, updatedAt: err.updated_at ?? null };
    return { ...result, message: errorText(result) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---- payloads ----

export const entryFromDrawing = (d) => ({
  meta: { name: d.name ?? '', drawing_type: d.drawing_type, building_label: d.building_label ?? null, floor_label: d.floor_label ?? null },
  doc: d.document
});

const nullable = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s ? s : null;
};

// Only the fields POST/PUT accept (the server rejects id, version,
// permissions, pea_site_name, created_*/updated_*).
export function writablePayload({ meta, doc }, { siteId, expectedVersion } = {}) {
  const body = {};
  if (expectedVersion !== undefined) body.expected_version = expectedVersion;
  if (siteId !== undefined) body.pea_site_id = Number(siteId);
  Object.assign(body, {
    name: String(meta.name ?? '').trim(),
    drawing_type: meta.drawing_type,
    building_label: nullable(meta.building_label),
    floor_label: nullable(meta.floor_label),
    schema_version: 1,
    document: doc
  });
  return body;
}

export const createDrawing = (entry, siteId, token) => request(urls.create(), { method: 'POST', token, body: writablePayload(entry, { siteId }) });
export const updateDrawing = (id, entry, expectedVersion, token) => request(urls.drawing(id), { method: 'PUT', token, body: writablePayload(entry, { expectedVersion }) });
export const deleteDrawing = (id, expectedVersion, token) => request(urls.drawing(id), { method: 'DELETE', token, body: { expected_version: expectedVersion } });

// Links that can't be saved as new ones (a copy makes every link new).
export const staleLinkIds = (links) => (links || []).filter(l => l.state !== 'available').map(l => l.object_id);

export function stripAssetRefs(doc, objectIds = null) {
  const set = objectIds ? new Set(objectIds) : null;
  return { ...doc, objects: doc.objects.map(o => (o.asset_ref && (!set || set.has(o.id)) ? { ...o, asset_ref: null } : o)) };
}

export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
