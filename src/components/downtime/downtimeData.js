export const STORAGE_KEY = 'ne2.downtime.v2';
export const todayThai = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function defaults() {
  const year = todayThai().slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31`, q: '', province: '', status: '', device_id: '', match: 'overlap', page: 1, sort: 'down_at', order: 'desc', bucket_from: '', bucket_to: '' };
}
export function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function nextDay(day) { return new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function validateFilters(f) {
  if (!validDay(f.from) || !validDay(f.to)) return 'กรุณาระบุวันที่เริ่มและสิ้นสุดให้ถูกต้อง';
  if (f.from > f.to) return 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด';
  if (f.from > todayThai()) return 'วันที่เริ่มต้องไม่อยู่ในอนาคต';
  if ((Date.parse(f.to) - Date.parse(f.from)) / 86400000 + 1 > 366) return 'เลือกช่วงเวลาได้ไม่เกิน 366 วัน';
  if ([...f.q.trim()].length > 200) return 'คำค้นต้องไม่เกิน 200 ตัวอักษร';
  if (f.device_id && (!/^\d+$/.test(f.device_id) || Number(f.device_id) < 1 || Number(f.device_id) > 2147483647)) return 'รหัสอุปกรณ์ไม่ถูกต้อง';
  return '';
}
export function readFilters(search = window.location.search) {
  const d = defaults(), p = new URLSearchParams(search);
  for (const key of Object.keys(d)) if (p.has(key)) d[key] = p.get(key);
  if (!['open', 'resolved', 'unknown', ''].includes(d.status)) d.status = '';
  if (!['overlap', 'started'].includes(d.match)) d.match = 'overlap';
  if (!['down_at', 'up_at', 'duration_ms', 'province'].includes(d.sort)) d.sort = 'down_at';
  if (!['asc', 'desc'].includes(d.order)) d.order = 'desc';
  d.page = /^\d+$/.test(String(d.page)) && Number(d.page) > 0 && Number.isSafeInteger(Number(d.page)) ? Number(d.page) : 1;
  if (validateFilters(d)) return defaults();
  if (!validDay(d.bucket_from) || !validDay(d.bucket_to) || d.bucket_from < d.from || d.bucket_to > d.to || d.bucket_from > d.bucket_to || d.bucket_from > todayThai()) {
    d.bucket_from = ''; d.bucket_to = '';
  }
  return d;
}
export function filterParams(f) {
  const p = new URLSearchParams({ date_from: `${f.bucket_from || f.from}T00:00:00+07:00`, date_to_exclusive: `${nextDay(f.bucket_to || f.to)}T00:00:00+07:00`, timezone: 'Asia/Bangkok', match: f.bucket_from ? 'started' : f.match });
  for (const k of ['q', 'province', 'status', 'device_id']) if (f[k]?.trim()) p.set(k, f[k].trim());
  return p;
}
export function bucketFilter(bucket, f, asOf) {
  if (bucket.coverage_status === 'future' || bucket.started_incident_count == null || Date.parse(bucket.period_start) > Date.parse(asOf)) return null;
  const from = bucket.period_start.slice(0, 10);
  const to = new Date(Date.parse(bucket.period_end_exclusive) - 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return { ...f, bucket_from: from > (f.bucket_from || f.from) ? from : (f.bucket_from || f.from), bucket_to: to < (f.bucket_to || f.to) ? to : (f.bucket_to || f.to), page: 1 };
}
export function duration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000), days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return [days ? `${days} วัน` : '', hours ? `${hours} ชม.` : '', minutes ? `${minutes} นาที` : '', !days && !hours ? `${seconds % 60} วินาที` : ''].filter(Boolean).join(' ') || '0 วินาที';
}
export function dateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
}
export function stored() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
export function persist(patch) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored(), ...patch })); } catch { /* Storage may be unavailable. */ } }
export async function request(path, params, signal, token) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 60000);
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/${path}${params ? `?${params}` : ''}`, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const body = await response.json();
    if (!response.ok || body.success !== true || !body.data) {
      const error = new Error(response.status === 410 ? 'ข้อมูลชุดนี้หมดอายุ กรุณารีเฟรชทั้งหน้า' : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
      error.status = response.status; error.code = body.error?.code; throw error;
    }
    if (path !== 'selectors' && (!/^[a-f0-9]{64}$/i.test(body.meta?.snapshot_token || '') || !Number.isFinite(Date.parse(body.meta?.as_of)) || !Number.isFinite(Date.parse(body.meta?.snapshot_expires_at)))) throw new Error('รูปแบบข้อมูลไม่ครบ กรุณาลองใหม่');
    return body;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('ใช้เวลานานเกินไป กรุณาลองใหม่');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
