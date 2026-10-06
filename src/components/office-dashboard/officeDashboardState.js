// UI state of the office-equipment dashboard and its round trip through the
// URL query string (so a link, a refresh or Back from an equipment page
// restores the same view). Pure: no React, no fetch.

export const TABS = ['overview', 'equipment', 'contracts', 'loans', 'repairs'];
export const PHASE2_TABS = ['loans', 'repairs'];

// Dimensions that have a "ไม่ระบุ" (missing) group in the selectors.
export const DIMENSIONS = ['contract_no', 'pea_site_id', 'department', 'equipment_type', 'status'];
export const CONTRACT_DATES = ['contract_start_date', 'contract_expiry_date'];
export const DIMENSION_LABELS = { contract_no: 'สัญญา', pea_site_id: 'สำนักงาน', department: 'แผนก', equipment_type: 'ประเภท', status: 'สถานะ', contract_start_date: 'วันเริ่มสัญญา', contract_expiry_date: 'วันสิ้นสุดสัญญา' };

export const COMPUTER_TYPES = ['PC', 'Notebook'];
export const ISSUES = ['missing_owner', 'missing_owner_emp_id', 'missing_department', 'missing_site', 'missing_serial', 'missing_equipment_code', 'missing_contract', 'missing_contract_expiry', 'duplicate_serial', 'duplicate_equipment_code'];
export const EXPIRY_BUCKETS = ['expired', 'within_90_days', 'within_180_days', 'within_365_days', 'missing_date'];
export const EXPIRY_LABELS = {
  expired: 'หมดสัญญาแล้ว', within_90_days: 'หมดภายใน 90 วัน', within_180_days: 'หมดภายใน 180 วัน',
  within_365_days: 'หมดภายใน 365 วัน', missing_date: 'ไม่มีวันสิ้นสุดสัญญา'
};
export const GROUP_BY = ['site', 'department', 'equipment_type', 'status'];
export const EQUIPMENT_SORTS = ['updatedAt', 'id', 'name', 'equipment_type', 'equipment_code', 'serial_number', 'department', 'status', 'contract_start_date', 'contract_expiry_date'];
export const CONTRACT_SORTS = ['earliest_expiry_date', 'contract_no', 'equipment_count'];
export const LOAN_STATUSES = ['all', 'open', 'returned', 'overdue'];
export const LOAN_SORTS = ['borrowed_at', 'due_date'];
export const REPAIR_SORTS = ['repair_count', 'last_reported_at'];
export const LIMITS = [20, 50, 100];

export const DEFAULT_STATE = Object.freeze({
  tab: 'overview',
  group: 'computer',
  contract_no: '', pea_site_id: '', department: '', equipment_type: '', status: '', search: '', missing_field: '',
  // equipment table (issue only applies here; expiry is shared with contracts)
  issue: '', expiry_bucket: '', page: 1, limit: 20, sort: 'updatedAt', order: 'desc',
  contract_start_date: '', contract_expiry_date: '',
  // distribution chart
  dist_by: 'site', dist_page: 1, dist_sort: 'total',
  // contracts table
  c_page: 1, c_sort: 'earliest_expiry_date', c_order: 'asc',
  // phase 2 (from/to are Thai calendar days, YYYY-MM-DD)
  loan_status: 'all', l_page: 1, l_sort: 'borrowed_at', l_order: 'desc',
  r_page: 1, r_sort: 'repair_count', r_order: 'desc',
  from: '', to: ''
});

const PAGE_KEYS = ['page', 'dist_page', 'c_page', 'l_page', 'r_page'];
const ENUMS = {
  tab: TABS, group: ['computer', 'all'], missing_field: ['', ...DIMENSIONS, ...CONTRACT_DATES], issue: ['', ...ISSUES], expiry_bucket: ['', ...EXPIRY_BUCKETS],
  sort: EQUIPMENT_SORTS, order: ['asc', 'desc'], dist_by: GROUP_BY, dist_sort: ['total', 'label'],
  c_sort: CONTRACT_SORTS, c_order: ['asc', 'desc'], loan_status: LOAN_STATUSES, l_sort: LOAN_SORTS, l_order: ['asc', 'desc'],
  r_sort: REPAIR_SORTS, r_order: ['asc', 'desc']
};
const TEXT_KEYS = ['contract_no', 'department', 'equipment_type', 'status', 'search'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

// Rules every state must satisfy, whatever produced it (URL, UI or drill-down).
export function normalizeState(input) {
  const s = { ...DEFAULT_STATE, ...input };
  for (const [key, allowed] of Object.entries(ENUMS)) if (!allowed.includes(s[key])) s[key] = DEFAULT_STATE[key];
  for (const key of TEXT_KEYS) s[key] = String(s[key] ?? '');
  s.search = s.search.slice(0, 200);
  s.pea_site_id = positiveInt(s.pea_site_id) ? String(positiveInt(s.pea_site_id)) : '';
  for (const key of PAGE_KEYS) s[key] = positiveInt(s[key]) || 1;
  s.limit = LIMITS.includes(Number(s.limit)) ? Number(s.limit) : DEFAULT_STATE.limit;
  for (const key of ['from', 'to', ...CONTRACT_DATES]) s[key] = DAY.test(String(s[key] ?? '')) ? s[key] : '';
  // The API rejects missing_field together with the same dimension's filter.
  if (s.missing_field) s[s.missing_field] = '';
  // Computers never have an empty type, and other types are outside the group.
  if (s.group === 'computer') {
    if (s.equipment_type && !COMPUTER_TYPES.includes(s.equipment_type)) s.equipment_type = '';
    if (s.missing_field === 'equipment_type') s.missing_field = '';
  }
  return s;
}

export function parseState(search) {
  const params = new URLSearchParams(search);
  const raw = {};
  for (const key of Object.keys(DEFAULT_STATE)) if (params.has(key)) raw[key] = params.get(key);
  return normalizeState(raw);
}

// Only values that differ from the defaults, in a stable order.
export function stateToSearch(state) {
  const s = normalizeState(state);
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_STATE)) {
    if (String(s[key]) !== String(DEFAULT_STATE[key])) params.set(key, String(s[key]));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

// A shared filter changed: every list goes back to its first page.
export function withFilters(state, changes) {
  const next = { ...state, ...changes };
  for (const key of PAGE_KEYS) next[key] = 1;
  return normalizeState(next);
}

// Picking a value (or null = "ไม่ระบุ") for one dimension. Only one dimension
// can be "ไม่ระบุ" at a time: picking a second one returns `replaces` so the
// UI can tell the user which condition it drops.
export function pickDimension(state, dimension, value) {
  if (value === null) {
    const replaces = state.missing_field && state.missing_field !== dimension ? state.missing_field : '';
    return { state: withFilters(state, { missing_field: dimension, [dimension]: '' }), replaces };
  }
  const changes = { [dimension]: String(value ?? '') };
  if (state.missing_field === dimension) changes.missing_field = '';
  return { state: withFilters(state, changes), replaces: '' };
}

// Opens the equipment table for a chart bar, contract row or KPI card: the
// drill-down replaces the same dimension's filter and keeps the others.
// `conflict` is set (and nothing applied) when it needs a second "ไม่ระบุ"
// dimension; pass { force: true } once the user agreed to drop the first.
// issue/expiry_bucket default to none: the overview numbers were computed
// without them, so keeping an old one would silently show a subset.
export function applyDrilldown(state, drilldown = {}, { tab = 'equipment', issue = '', expiry_bucket = '', force = false } = {}) {
  const changes = { tab, contract_start_date: '', contract_expiry_date: '' };
  let missing = CONTRACT_DATES.includes(state.missing_field) ? '' : state.missing_field;
  for (const [key, value] of Object.entries(drilldown)) {
    if (key === 'missing_field') {
      if (missing && missing !== value && !force) return { state, conflict: { from: missing, to: value } };
      missing = value;
      changes[value] = '';
    } else if (DIMENSIONS.includes(key)) {
      changes[key] = value == null ? '' : String(value);
      if (missing === key) missing = '';
    }
  }
  changes.missing_field = missing;
  changes.issue = issue;
  changes.expiry_bucket = expiry_bucket;
  return { state: withFilters(state, changes), conflict: null };
}

// Contract breakdown counts exclude table-only filters. Preserve the
// contract's shared scope and expiry bucket; never replace a second NULL
// dimension, even with confirmation, as that would change the clicked count.
export function contractDateDrilldown(state, contract, field, value) {
  if (!CONTRACT_DATES.includes(field) || (value !== null && !DAY.test(String(value)))) {
    return { state, error: 'วันที่นี้ไม่อยู่ในรูปแบบที่ค้นหาได้' };
  }
  const scope = { ...state, contract_start_date: '', contract_expiry_date: '',
    missing_field: CONTRACT_DATES.includes(state.missing_field) ? '' : state.missing_field };
  const contractFilter = contract === null ? { missing_field: 'contract_no' } : { contract_no: contract };
  const result = applyDrilldown(scope, contractFilter, { expiry_bucket: state.expiry_bucket });
  if (result.conflict || (value === null && result.state.missing_field && result.state.missing_field !== field)) {
    return { state, error: 'ไม่สามารถกรอง “ไม่ระบุ” สองหัวข้อพร้อมกันได้ จึงยังเปิดรายการวันที่นี้ในขอบเขตเดิมไม่ได้' };
  }
  return { state: normalizeState({ ...result.state,
    [field]: value === null ? '' : String(value),
    missing_field: value === null ? field : result.state.missing_field, page: 1 }), error: '' };
}

export function changeGroup(state, group) {
  return withFilters(state, { group });
}

// Shared filters that are set, for chips and "ล้างตัวกรอง".
export function activeFilterCount(state) {
  return [...DIMENSIONS, ...CONTRACT_DATES, 'search', 'missing_field'].filter(key => String(state[key] ?? '').trim()).length;
}

export function clearFilters(state) {
  return withFilters(state, Object.fromEntries([...DIMENSIONS, ...CONTRACT_DATES, 'search', 'missing_field', 'issue', 'expiry_bucket'].map(key => [key, ''])));
}

// The page to show when the server reports fewer pages than requested
// (rows were removed, or a stale link). 0 pages -> page 1, shown empty.
export function clampPage(page, totalPages) {
  const total = Number(totalPages) || 0;
  if (total <= 0) return 1;
  return Math.min(Math.max(1, page), total);
}
