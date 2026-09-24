import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketFilter, defaults, duration, filterParams, nextDay, readFilters, validDay, validateFilters } from './downtimeData.js';

test('duration preserves zero and distinguishes unknown or invalid values', () => {
  assert.equal(duration(0), '0 วินาที');
  for (const value of [null, undefined, NaN, -1]) assert.equal(duration(value), '—');
  assert.equal(duration(90061000), '1 วัน 1 ชม. 1 นาที');
});
test('Thai inclusive date filters survive leap days and URL encoding', () => {
  assert.equal(nextDay('2024-02-28'), '2024-02-29');
  assert.equal(nextDay('2024-02-29'), '2024-03-01');
  assert.equal(validDay('2025-02-29'), false);
  const params = filterParams({ ...defaults(), from: '2024-01-01', to: '2024-12-31', q: 'สำนักงาน %_\\' });
  assert.equal(params.get('date_to_exclusive'), '2025-01-01T00:00:00+07:00');
  assert.ok(params.toString().includes('%2B07%3A00'));
  assert.equal(params.get('q'), 'สำนักงาน %_\\');
  assert.equal(validateFilters({ ...defaults(), from: '2024-01-01', to: '2024-12-31' }), '');
  assert.ok(validateFilters({ ...defaults(), from: '2024-01-01', to: '2025-01-01' }));
});
test('drill-down clips to parent filter and preserves non-date predicates', () => {
  const parent = { ...defaults(), from: '2024-02-10', to: '2024-03-15', q: 'abc', province: 'ยโสธร', status: 'resolved', page: 3 };
  const bucket = { period_start: '2024-02-01T00:00:00+07:00', period_end_exclusive: '2024-03-01T00:00:00+07:00', started_incident_count: 2, coverage_status: 'unknown' };
  const next = bucketFilter(bucket, parent, '2024-04-01T00:00:00Z');
  assert.equal(next.bucket_from, '2024-02-10'); assert.equal(next.bucket_to, '2024-02-29');
  assert.equal(next.province, parent.province); assert.equal(next.page, 1);
  assert.equal(filterParams(next).get('match'), 'started');
  assert.equal(bucketFilter({ ...bucket, coverage_status: 'future' }, parent, '2024-04-01T00:00:00Z'), null);
  assert.equal(bucketFilter({ ...bucket, started_incident_count: null }, parent, '2024-04-01T00:00:00Z'), null);
});
test('malformed persisted URL values cannot issue invalid page/sort/drill queries', () => {
  const result = readFilters('?from=2024-01-01&to=2024-12-31&page=Infinity&sort=bad&status=bad&bucket_from=2023-01-01&bucket_to=2023-02-01');
  assert.equal(result.page, 1); assert.equal(result.sort, 'down_at'); assert.equal(result.status, ''); assert.equal(result.bucket_from, '');
});
