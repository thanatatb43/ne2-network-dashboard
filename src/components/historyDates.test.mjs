import test from 'node:test';
import assert from 'node:assert/strict';
import { historyRange, isCalendarDate, nextDay } from './historyDates.js';

test('calendar validation', () => {
  assert.equal(isCalendarDate('2026-09-28'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-13-01'), false);
  assert.equal(isCalendarDate('2026-9-1'), false);
  assert.equal(isCalendarDate(''), false);
});

test('next day crosses month, year and leap day', () => {
  assert.equal(nextDay('2026-09-30'), '2026-10-01');
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
  assert.equal(nextDay('2024-02-28'), '2024-02-29');
  assert.equal(nextDay('2024-02-29'), '2024-03-01');
  assert.equal(nextDay('2026-02-28'), '2026-03-01');
});

test('range params include the whole end day in Thai time', () => {
  assert.deepEqual(historyRange('2026-09-01', '2026-09-30'), { params: { date_from: '2026-09-01T00:00:00+07:00', date_to_exclusive: '2026-10-01T00:00:00+07:00' }, error: '' });
  assert.deepEqual(historyRange('2026-09-28', '2026-09-28').params, { date_from: '2026-09-28T00:00:00+07:00', date_to_exclusive: '2026-09-29T00:00:00+07:00' });
  assert.deepEqual(historyRange('', '2026-12-31').params, { date_to_exclusive: '2027-01-01T00:00:00+07:00' });
  assert.deepEqual(historyRange('', ''), { params: {}, error: '' });
  assert.match(historyRange('2026-09-30', '2026-09-01').error, /ไม่หลัง/);
  assert.match(historyRange('2026-02-30', '').error, /ไม่ถูกต้อง/);
  // URLSearchParams encodes the + of the timezone
  assert.equal(new URLSearchParams(historyRange('2026-09-01', '').params).toString(), 'date_from=2026-09-01T00%3A00%3A00%2B07%3A00');
});
