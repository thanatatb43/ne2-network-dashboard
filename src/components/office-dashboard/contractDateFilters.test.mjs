import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, contractDateDrilldown, parseState, stateToSearch, clearFilters } from './officeDashboardState.js';
import { endpointQuery, formatDay } from './officeDashboardData.js';

test('contract dates round-trip literally and only reach equipment/export', () => {
  for (const date of ['2026-09-23', '0000-00-00', '2559-09-01', '2026-02-31']) {
    const state = normalizeState({ contract_no: 'บ.63/2569', contract_start_date: date, contract_expiry_date: '2029-09-21', sort: 'contract_start_date', page: 4 });
    assert.deepEqual(parseState(stateToSearch(state)), state);
    const equipment = endpointQuery('equipment', state);
    assert.equal(equipment.get('contract_start_date'), date);
    assert.equal(equipment.get('contract_expiry_date'), '2029-09-21');
    equipment.delete('page'); equipment.delete('limit');
    assert.equal(endpointQuery('export', state).toString(), equipment.toString());
    for (const endpoint of ['selectors', 'summary', 'distribution', 'quality', 'contracts', 'loans', 'repairs']) {
      assert.equal(endpointQuery(endpoint, state).has('contract_start_date'), false);
      assert.equal(endpointQuery(endpoint, state).has('contract_expiry_date'), false);
    }
  }
  for (const date of ['0000-00-00', '2559-09-01', '2026-02-31']) assert.equal(formatDay(date), date);
});

test('missing dates are scoped to table/export and exclude the same exact date', () => {
  const state = normalizeState({ missing_field: 'contract_start_date', contract_start_date: '2026-09-23', contract_expiry_date: '2029-09-21' });
  for (const endpoint of ['equipment', 'export']) {
    const q = endpointQuery(endpoint, state);
    assert.equal(q.get('missing_field'), 'contract_start_date');
    assert.equal(q.has('contract_start_date'), false);
    assert.equal(q.get('contract_expiry_date'), '2029-09-21');
  }
  for (const endpoint of ['selectors', 'summary', 'distribution', 'quality', 'contracts', 'loans', 'repairs']) assert.equal(endpointQuery(endpoint, state).has('missing_field'), false);
  assert.equal(clearFilters(state).missing_field, '');
  assert.equal(clearFilters(state).contract_expiry_date, '');
});

test('date breakdown keeps contract scope and expiry; drops table-only conditions excluded from its count', () => {
  const state = normalizeState({ tab: 'contracts', pea_site_id: '7', department: 'ผสน', search: 'PC', expiry_bucket: 'within_365_days', issue: 'missing_owner', contract_expiry_date: '2029-01-01', page: 5 });
  const result = contractDateDrilldown(state, 'บ.63/2569', 'contract_start_date', '2026-09-23');
  assert.equal(result.error, '');
  assert.equal(result.state.tab, 'equipment');
  assert.equal(result.state.page, 1);
  for (const key of ['group', 'pea_site_id', 'department', 'search', 'expiry_bucket']) assert.equal(result.state[key], state[key]);
  assert.equal(result.state.contract_no, 'บ.63/2569');
  assert.equal(result.state.contract_start_date, '2026-09-23');
  assert.equal(result.state.issue, '');
  assert.equal(result.state.contract_expiry_date, '');
});

test('two missing dimensions block drill-down without mutating original scope', () => {
  for (const missing of ['', 'department', 'contract_no']) {
    const state = normalizeState({ tab: 'contracts', missing_field: missing });
    const result = contractDateDrilldown(state, null, 'contract_start_date', null);
    assert.ok(result.error);
    assert.equal(result.state, state);
  }
  const state = normalizeState({ missing_field: 'department' });
  assert.ok(contractDateDrilldown(state, 'DEMO', 'contract_expiry_date', null).error);
  const valid = contractDateDrilldown(state, 'DEMO', 'contract_expiry_date', '0000-00-00');
  assert.equal(valid.error, '');
  assert.equal(valid.state.missing_field, 'department');
  const missing = contractDateDrilldown(normalizeState({}), 'DEMO', 'contract_expiry_date', null);
  assert.equal(missing.state.missing_field, 'contract_expiry_date');
});
