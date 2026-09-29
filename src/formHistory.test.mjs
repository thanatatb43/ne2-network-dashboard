import test from 'node:test';
import assert from 'node:assert/strict';
import { routeKey, labelKey, addValue, MAX_VALUES } from './formHistory.js';

test('records share history across record ids, not across pages', () => {
  assert.equal(routeKey('/equipment/12/edit'), '/equipment/:id/edit');
  assert.equal(routeKey('/equipment/new/edit'), '/equipment/:id/edit');
  assert.equal(routeKey('/management/computers/198'), '/management/computers/:id');
  assert.equal(routeKey('/management/stock'), '/management/stock');
  assert.equal(routeKey('/'), '/');
});

test('field label normalisation', () => {
  assert.equal(labelKey({ label: 'ชื่ออุปกรณ์ * (จำเป็น)' }), 'ชื่ออุปกรณ์');
  assert.equal(labelKey({ label: '', ariaLabel: 'ค้นหา' }), 'ค้นหา');
  assert.equal(labelKey({ name: 'username' }), 'username');
  assert.equal(labelKey({ placeholder: '  เช่น  กฟจ.  ' }), 'เช่น กฟจ.');
  assert.equal(labelKey({}), '');
});

test('newest first, deduplicated and capped', () => {
  let list = [];
  for (let i = 0; i < MAX_VALUES + 3; i += 1) list = addValue(list, `v${i}`);
  assert.equal(list.length, MAX_VALUES);
  assert.equal(list[0], `v${MAX_VALUES + 2}`);
  list = addValue(list, 'v5');
  assert.equal(list[0], 'v5');
  assert.equal(list.filter((v) => v === 'v5').length, 1);
  assert.deepEqual(addValue(['a'], '   '), ['a']);
  assert.deepEqual(addValue(['a'], 'x'.repeat(201)), ['a']);
});
