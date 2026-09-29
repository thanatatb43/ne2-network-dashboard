// Date-range helpers for GET /api/test/history (date_from inclusive,
// date_to_exclusive exclusive, ISO 8601 with a timezone). Dates the user picks
// are calendar days in Thailand (UTC+7, no DST).

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 etc.).
export function isCalendarDate(value) {
  const m = DAY.exec(String(value || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export function nextDay(value) {
  const m = DAY.exec(value);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}

export const bangkokMidnight = (day) => `${day}T00:00:00+07:00`;

// { params: {date_from?, date_to_exclusive?}, error } for a from/to pair of
// YYYY-MM-DD strings; either may be empty (= unbounded on that side). The
// end day is included in full: it is sent as midnight of the next day.
export function historyRange(from, to) {
  const f = String(from || '').trim();
  const t = String(to || '').trim();
  if (f && !isCalendarDate(f)) return { params: {}, error: 'วันที่เริ่มไม่ถูกต้อง' };
  if (t && !isCalendarDate(t)) return { params: {}, error: 'วันที่สิ้นสุดไม่ถูกต้อง' };
  if (f && t && f > t) return { params: {}, error: 'วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด' };
  const params = {};
  if (f) params.date_from = bangkokMidnight(f);
  if (t) params.date_to_exclusive = bangkokMidnight(nextDay(t));
  return { params, error: '' };
}
