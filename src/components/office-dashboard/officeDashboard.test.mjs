import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATE, applyDrilldown, changeGroup, clampPage, clearFilters, normalizeState, parseState, pickDimension, stateToSearch, withFilters
} from './officeDashboardState.js';
import {
  ALLOWED, endpointQuery, exportFilename, exportTotal, expiryRanges, phase2Range, readExportResponse
} from './officeDashboardData.js';

const state = (changes = {}) => normalizeState({ ...DEFAULT_STATE, ...changes });
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test('every endpoint query stays inside its allowlist', () => {
  const busy = state({
    group: 'computer', contract_no: 'บ.63/2569', pea_site_id: '7', department: 'ผสน', equipment_type: 'PC', status: 'ใช้งาน', search: ' abc ',
    issue: 'missing_owner', expiry_bucket: 'expired', page: 3, limit: 50, sort: 'name', order: 'asc',
    dist_by: 'department', dist_page: 2, c_page: 4, loan_status: 'open', l_page: 2, r_page: 5, from: '2026-10-01', to: '2026-10-31'
  });
  for (const endpoint of Object.keys(ALLOWED)) {
    const keys = [...endpointQuery(endpoint, busy).keys()];
    for (const key of keys) assert.ok(ALLOWED[endpoint].includes(key), `${endpoint} sent ${key}`);
    assert.equal(new Set(keys).size, keys.length, `${endpoint} sent a key twice`);
  }
  for (const endpoint of ['selectors', 'summary', 'quality']) {
    assert.deepEqual([...endpointQuery(endpoint, busy).keys()].sort(), ['contract_no', 'department', 'equipment_group', 'equipment_type', 'pea_site_id', 'search', 'status']);
  }
  const exp = endpointQuery('export', busy);
  assert.equal(exp.has('page'), false);
  assert.equal(exp.has('limit'), false);
  assert.equal(exp.get('sort'), 'name');
  assert.equal(exp.get('issue'), 'missing_owner');
  const eq = endpointQuery('equipment', busy);
  assert.equal(eq.get('page'), '3');
  assert.equal(eq.get('limit'), '50');
  assert.equal(eq.get('search'), 'abc');
  assert.equal(endpointQuery('contracts', busy).get('page'), '4');
  assert.equal(endpointQuery('contracts', busy).has('issue'), false);
  assert.equal(endpointQuery('distribution', busy).get('group_by'), 'department');
});

test('Thai text, slash and offsets are encoded', () => {
  const q = endpointQuery('loans', state({ contract_no: 'บ.63/2569', from: '2026-10-01', to: '2026-10-31' })).toString();
  assert.ok(q.includes('contract_no=%E0%B8%9A.63%2F2569'), q);
  assert.ok(q.includes('from=2026-10-01T00%3A00%3A00%2B07%3A00'), q);
  assert.ok(q.includes('to=2026-11-01T00%3A00%3A00%2B07%3A00'), q);
});

test('"all equipment" omits equipment_group; computer keeps it AND the type', () => {
  assert.equal(endpointQuery('summary', state({ group: 'all' })).has('equipment_group'), false);
  const q = endpointQuery('summary', state({ group: 'computer', equipment_type: 'Notebook' }));
  assert.equal(q.get('equipment_group'), 'computer');
  assert.equal(q.get('equipment_type'), 'Notebook');
});

test('missing_field is never sent with the same dimension', () => {
  const s = { ...state(), department: 'ผสน', missing_field: 'department' };
  const q = endpointQuery('equipment', s);
  assert.equal(q.get('missing_field'), 'department');
  assert.equal(q.has('department'), false);
  assert.equal(normalizeState(s).department, '');
});

test('picking "ไม่ระบุ" for a second dimension reports what it replaces', () => {
  const a = pickDimension(state({ page: 4 }), 'department', null);
  assert.equal(a.state.missing_field, 'department');
  assert.equal(a.state.page, 1);
  assert.equal(a.replaces, '');
  const b = pickDimension(a.state, 'contract_no', null);
  assert.equal(b.state.missing_field, 'contract_no');
  assert.equal(b.replaces, 'department');
  const c = pickDimension(b.state, 'contract_no', 'บ.1/2564');
  assert.equal(c.state.missing_field, '');
  assert.equal(c.state.contract_no, 'บ.1/2564');
});

test('drill-down replaces its dimension and keeps the other filters', () => {
  const base = state({ group: 'computer', department: 'ผสน', pea_site_id: '1', page: 5, issue: 'missing_owner' });
  const { state: s, conflict } = applyDrilldown(base, { pea_site_id: 7 });
  assert.equal(conflict, null);
  assert.equal(s.tab, 'equipment');
  assert.equal(s.pea_site_id, '7');
  assert.equal(s.department, 'ผสน');
  assert.equal(s.group, 'computer');
  assert.equal(s.page, 1);
  assert.equal(s.issue, '', 'an issue the overview did not use is dropped');
  const q = endpointQuery('equipment', s).toString();
  assert.equal((q.match(/pea_site_id=/g) || []).length, 1);

  const missing = applyDrilldown(base, { missing_field: 'department' });
  assert.equal(missing.state.missing_field, 'department');
  assert.equal(missing.state.department, '');

  const exact = applyDrilldown(state({ missing_field: 'pea_site_id' }), { pea_site_id: 3 });
  assert.equal(exact.state.missing_field, '');
  assert.equal(exact.state.pea_site_id, '3');
});

test('a drill-down needing a second missing dimension asks first', () => {
  const base = state({ missing_field: 'department' });
  const blocked = applyDrilldown(base, { missing_field: 'contract_no' });
  assert.deepEqual(blocked.conflict, { from: 'department', to: 'contract_no' });
  assert.equal(blocked.state, base);
  const forced = applyDrilldown(base, { missing_field: 'contract_no' }, { force: true });
  assert.equal(forced.state.missing_field, 'contract_no');
});

test('contract drill-down carries the expiry filter it was computed with', () => {
  const { state: s } = applyDrilldown(state({ tab: 'contracts', expiry_bucket: 'within_90_days' }), { contract_no: 'DEMO-1' }, { expiry_bucket: 'within_90_days' });
  assert.equal(s.contract_no, 'DEMO-1');
  assert.equal(endpointQuery('equipment', s).get('expiry_bucket'), 'within_90_days');
});

test('changing to the computer group drops types outside it', () => {
  assert.equal(changeGroup(state({ group: 'all', equipment_type: 'Monitor' }), 'computer').equipment_type, '');
  assert.equal(changeGroup(state({ group: 'all', equipment_type: 'Notebook' }), 'computer').equipment_type, 'Notebook');
  assert.equal(changeGroup(state({ group: 'all', missing_field: 'equipment_type' }), 'computer').missing_field, '');
  assert.equal(changeGroup(state({ group: 'computer', equipment_type: 'PC' }), 'all').equipment_type, 'PC');
});

test('URL round trip keeps every value and omits defaults', () => {
  assert.equal(stateToSearch(DEFAULT_STATE), '');
  const s = state({ tab: 'contracts', group: 'all', contract_no: 'บ.63/2569', missing_field: 'department', page: 3, limit: 50, sort: 'name', order: 'asc', c_page: 2, from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(parseState(stateToSearch(s)), s);
});

test('bad URL values fall back to defaults', () => {
  const s = parseState('?tab=x&page=-2&limit=7&sort=evil&pea_site_id=abc&issue=nope&from=2026-13-40x&missing_field=name');
  assert.equal(s.tab, 'overview');
  assert.equal(s.page, 1);
  assert.equal(s.limit, 20);
  assert.equal(s.sort, 'updatedAt');
  assert.equal(s.pea_site_id, '');
  assert.equal(s.issue, '');
  assert.equal(s.from, '');
  assert.equal(s.missing_field, '');
});

test('filter changes reset every page; clearing keeps tab and group', () => {
  const s = withFilters(state({ page: 4, c_page: 3, dist_page: 2 }), { search: 'x' });
  assert.deepEqual([s.page, s.c_page, s.dist_page], [1, 1, 1]);
  const cleared = clearFilters(state({ tab: 'equipment', group: 'all', department: 'a', issue: 'missing_owner', missing_field: 'status' }));
  assert.equal(cleared.tab, 'equipment');
  assert.equal(cleared.group, 'all');
  assert.equal(cleared.department + cleared.issue + cleared.missing_field, '');
});

test('page past the end or zero pages', () => {
  assert.equal(clampPage(9, 3), 3);
  assert.equal(clampPage(2, 0), 1);
  assert.equal(clampPage(1, 0), 1);
  assert.equal(clampPage(2, 5), 2);
});

test('phase 2 dates are a pair with an exclusive next-day end', () => {
  assert.deepEqual(phase2Range('2026-10-01', '2026-10-31').params, { from: '2026-10-01T00:00:00+07:00', to: '2026-11-01T00:00:00+07:00' });
  assert.deepEqual(phase2Range('2026-12-31', '2026-12-31').params, { from: '2026-12-31T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' });
  assert.ok(phase2Range('2026-10-01', '').error);
  assert.ok(phase2Range('2026-10-05', '2026-10-01').error);
  assert.equal(endpointQuery('repairs', state({ from: '2026-10-01' })).has('from'), false);
  assert.equal(endpointQuery('loans', state({ loan_status: 'all' })).has('loan_status'), false);
});

test('cumulative expiry counts become disjoint ranges', () => {
  assert.deepEqual(expiryRanges({ expired: 119, within_90_days: 2, within_180_days: 9, within_365_days: 9, missing_date: 176 }),
    { expired: 119, d0_90: 2, d91_180: 7, d181_365: 0, missing_date: 176 });
});

test('export total: missing header is unknown, not zero', () => {
  assert.equal(exportTotal(null), null);
  assert.equal(exportTotal(''), null);
  assert.equal(exportTotal('abc'), null);
  assert.equal(exportTotal('0'), 0);
  assert.equal(exportTotal('775'), 775);
});

test('export filename from Content-Disposition with fallback', () => {
  assert.equal(exportFilename('attachment; filename="office-equipment-20261006-120000.xlsx"'), 'office-equipment-20261006-120000.xlsx');
  assert.equal(exportFilename("attachment; filename*=UTF-8''%E0%B8%A3%E0%B8%B2%E0%B8%A2.xlsx"), 'ราย.xlsx');
  assert.equal(exportFilename(null), 'office-equipment.xlsx');
  assert.equal(exportFilename('attachment; filename="../evil.xlsx"'), '.._evil.xlsx');
});

test('export never turns an error or a non-spreadsheet into a file', async () => {
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const tooLarge = await readExportResponse(json(422, { success: false, error: { code: 'EXPORT_TOO_LARGE', message: 'x' } }));
  assert.equal(tooLarge.kind, 'error');
  assert.match(tooLarge.message, /ตัวกรอง/);
  assert.equal((await readExportResponse(json(503, { success: false, error: { code: 'X' } }))).status, 503);
  const html = await readExportResponse(new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  assert.equal(html.kind, 'error');
  assert.equal(html.code, 'BAD_CONTENT_TYPE');
  const okJson = await readExportResponse(json(200, { success: true }));
  assert.equal(okJson.kind, 'error');
  const file = await readExportResponse(new Response('PK', { status: 200, headers: { 'Content-Type': XLSX, 'Content-Disposition': 'attachment; filename="a.xlsx"', 'X-Export-Total': '0' } }));
  assert.equal(file.kind, 'file');
  assert.equal(file.filename, 'a.xlsx');
  assert.equal(file.total, 0);
  const noHeaders = await readExportResponse(new Response('PK', { status: 200, headers: { 'Content-Type': XLSX } }));
  assert.equal(noHeaders.total, null);
  assert.equal(noHeaders.filename, 'office-equipment.xlsx');
});
