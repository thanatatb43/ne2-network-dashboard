// Queries, fetching and export for /api/office-equipment/dashboard/*.
// The API answers 400 to any parameter an endpoint doesn't know, so each
// endpoint gets its query from its own allowlist, never the whole UI state.
import { bangkokMidnight, isCalendarDate, nextDay } from '../historyDates.js';

const API = import.meta.env?.VITE_API_BASE_URL ?? '';
export const DASHBOARD_PATH = '/api/office-equipment/dashboard';
export const DIST_LIMIT = 10;
export const CONTRACT_LIMIT = 20;
export const PHASE2_LIMIT = 20;
export const REQUEST_TIMEOUT_MS = 20000;

const BASE = ['equipment_group', 'contract_no', 'pea_site_id', 'department', 'equipment_type', 'status', 'search', 'missing_field'];
export const ALLOWED = {
  selectors: BASE,
  summary: BASE,
  quality: BASE,
  distribution: [...BASE, 'group_by', 'page', 'limit', 'sort', 'order'],
  equipment: [...BASE, 'issue', 'expiry_bucket', 'page', 'limit', 'sort', 'order'],
  contracts: [...BASE, 'expiry_bucket', 'page', 'limit', 'sort', 'order'],
  export: [...BASE, 'issue', 'expiry_bucket', 'sort', 'order'],
  loans: [...BASE, 'loan_status', 'from', 'to', 'page', 'limit', 'sort', 'order'],
  repairs: [...BASE, 'from', 'to', 'page', 'limit', 'sort', 'order']
};
export const AUTH_ENDPOINTS = new Set(['export', 'loans', 'repairs']);

export function baseFilters(state) {
  const f = {
    equipment_group: state.group === 'computer' ? 'computer' : '',
    contract_no: state.contract_no, pea_site_id: state.pea_site_id, department: state.department,
    equipment_type: state.equipment_type, status: state.status, search: String(state.search ?? '').trim(),
    missing_field: state.missing_field
  };
  // Never both "ไม่ระบุ" and an exact value for the same dimension.
  if (f.missing_field) f[f.missing_field] = '';
  return f;
}

// Phase 2 date range: Thai calendar days -> RFC3339 with offset, sent as a
// pair, end day included in full (midnight of the next day, exclusive).
export function phase2Range(from, to) {
  if (!from && !to) return { params: {}, error: '' };
  if (!from || !to) return { params: {}, error: 'กรุณาระบุทั้งวันที่เริ่มและวันที่สิ้นสุด' };
  if (!isCalendarDate(from) || !isCalendarDate(to)) return { params: {}, error: 'วันที่ไม่ถูกต้อง' };
  if (from > to) return { params: {}, error: 'วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด' };
  return { params: { from: bangkokMidnight(from), to: bangkokMidnight(nextDay(to)) }, error: '' };
}

function candidates(endpoint, state) {
  switch (endpoint) {
    case 'distribution':
      return { group_by: state.dist_by, page: state.dist_page, limit: DIST_LIMIT, sort: state.dist_sort, order: state.dist_sort === 'label' ? 'asc' : 'desc' };
    case 'equipment':
      return { issue: state.issue, expiry_bucket: state.expiry_bucket, page: state.page, limit: state.limit, sort: state.sort, order: state.order };
    case 'export':
      return { issue: state.issue, expiry_bucket: state.expiry_bucket, sort: state.sort, order: state.order };
    case 'contracts':
      return { expiry_bucket: state.expiry_bucket, page: state.c_page, limit: CONTRACT_LIMIT, sort: state.c_sort, order: state.c_order };
    case 'loans':
      return { loan_status: state.loan_status === 'all' ? '' : state.loan_status, ...phase2Range(state.from, state.to).params, page: state.l_page, limit: PHASE2_LIMIT, sort: state.l_sort, order: state.l_order };
    case 'repairs':
      return { ...phase2Range(state.from, state.to).params, page: state.r_page, limit: PHASE2_LIMIT, sort: state.r_sort, order: state.r_order };
    default:
      return {};
  }
}

// URLSearchParams for one endpoint: allowlisted, empty values dropped.
export function endpointQuery(endpoint, state) {
  const allowed = ALLOWED[endpoint];
  if (!allowed) throw new Error(`unknown dashboard endpoint: ${endpoint}`);
  const all = { ...baseFilters(state), ...candidates(endpoint, state) };
  const params = new URLSearchParams();
  for (const key of allowed) {
    const value = all[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value));
  }
  return params;
}

export const endpointUrl = (endpoint, state) => {
  const query = endpointQuery(endpoint, state).toString();
  return `${API}${DASHBOARD_PATH}/${endpoint}${query ? `?${query}` : ''}`;
};

export class DashboardError extends Error {
  constructor(message, { status = 0, code = '', field = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// Thai message for a failed dashboard request (the API's own message is
// English and meant for developers).
export function errorMessage(status, code, field) {
  if (code === 'TIMEOUT') return 'เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่';
  if (code === 'NETWORK') return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่';
  if (status === 401) return 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลส่วนนี้';
  if (status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลส่วนนี้';
  if (status === 422 && code === 'EXPORT_TOO_LARGE') return 'ข้อมูลที่จะส่งออกมีมากเกินกำหนด กรุณาเลือกตัวกรองเพิ่มเพื่อให้รายการน้อยลง';
  if (status === 400) return `เงื่อนไขการค้นหาไม่ถูกต้อง${field ? ` (${field})` : ''} กรุณาล้างตัวกรองแล้วลองใหม่`;
  if (status === 503) return 'ระบบยังไม่พร้อมให้บริการชั่วคราว กรุณาลองใหม่ภายหลัง';
  if (status >= 500) return 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่';
  return 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่';
}

const readJson = async (res) => {
  try { return await res.json(); } catch { return null; }
};

// GET one endpoint -> { data, pagination, meta }. `signal` aborts it (the
// caller's controller also enforces the timeout).
export async function fetchDashboard(endpoint, state, { token, signal } = {}) {
  const headers = AUTH_ENDPOINTS.has(endpoint) && token ? { Authorization: `Bearer ${token}` } : {};
  let res;
  try {
    res = await fetch(endpointUrl(endpoint, state), { headers, signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new DashboardError(errorMessage(0, 'NETWORK'), { code: 'NETWORK' });
  }
  const body = await readJson(res);
  if (!res.ok || !body || body.success === false) {
    const code = body?.error?.code || '';
    const field = body?.error?.field || null;
    throw new DashboardError(errorMessage(res.status, code, field), { status: res.status, code, field });
  }
  return { data: body.data, pagination: body.pagination || null, meta: body.meta || null };
}

// ---- export ----

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function exportFilename(contentDisposition) {
  const header = String(contentDisposition || '');
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) || /filename\s*=\s*([^;]+)/i.exec(header);
  const name = plain?.[1]?.trim().replace(/[\\/]/g, '_');
  return name || 'office-equipment.xlsx';
}

// null when the header is absent or not a count -- never Number(null) = 0.
export function exportTotal(headerValue) {
  if (headerValue === null || headerValue === undefined) return null;
  const text = String(headerValue).trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

// A fetch Response -> { kind: 'file', blob, filename, total } or
// { kind: 'error', status, code, message }. A JSON error (or anything that
// isn't the spreadsheet) is never handed back as a file.
export async function readExportResponse(res) {
  const type = String(res.headers.get('Content-Type') || '').toLowerCase();
  if (!res.ok) {
    const body = type.includes('json') ? await readJson(res) : null;
    const code = body?.error?.code || '';
    return { kind: 'error', status: res.status, code, message: errorMessage(res.status, code, body?.error?.field) };
  }
  if (!type.startsWith(XLSX_TYPE)) {
    return { kind: 'error', status: res.status, code: 'BAD_CONTENT_TYPE', message: 'เซิร์ฟเวอร์ไม่ได้ส่งไฟล์ Excel กลับมา กรุณาลองใหม่' };
  }
  return {
    kind: 'file',
    blob: await res.blob(),
    filename: exportFilename(res.headers.get('Content-Disposition')),
    total: exportTotal(res.headers.get('X-Export-Total'))
  };
}

export async function downloadExport(state, token) {
  let res;
  try {
    res = await fetch(endpointUrl('export', state), { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { kind: 'error', status: 0, code: 'NETWORK', message: errorMessage(0, 'NETWORK') };
  }
  const result = await readExportResponse(res);
  if (result.kind !== 'file') return result;
  const url = URL.createObjectURL(result.blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return result;
}

// ---- display helpers ----

// "0000-00-00" and Buddhist-era years exist in real data: shown as stored.
export function formatDay(value) {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m || m[1] === '0000' || Number(m[1]) > 2400) return value;
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}

export const formatCount = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('th-TH') : '—');

export const typeBreakdown = (byType) => (byType || []).map(t => `${t.value ?? 'ไม่ระบุ'} ${formatCount(t.count)}`).join(' · ');

// Contract expiry counts from /summary are cumulative (90 ⊂ 180 ⊂ 365).
// Disjoint ranges for a stacked view; never negative if the data is odd.
export function expiryRanges(e) {
  if (!e) return null;
  const d90 = e.within_90_days ?? 0;
  const d180 = e.within_180_days ?? 0;
  const d365 = e.within_365_days ?? 0;
  return {
    expired: e.expired ?? 0,
    d0_90: d90,
    d91_180: Math.max(0, d180 - d90),
    d181_365: Math.max(0, d365 - d180),
    missing_date: e.missing_date ?? 0
  };
}
