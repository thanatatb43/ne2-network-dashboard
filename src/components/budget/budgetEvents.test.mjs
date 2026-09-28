import test from 'node:test';
import assert from 'node:assert/strict';
import { inReplacedScope } from './budgetEvents.js';

test('only transactions from the replaced account + year are affected', () => {
  const scope = { cost_center: '53051060', year: '2026' };
  assert.equal(inReplacedScope({ cost_center: '53051060', year: 2026 }, scope), true);
  assert.equal(inReplacedScope({ cost_center: '53051060', year: 2025 }, scope), false);
  assert.equal(inReplacedScope({ cost_center: '53032080', year: 2026 }, scope), false);
  // Rows that can't be placed are treated as affected (a dead ID is worse).
  assert.equal(inReplacedScope({ id: 5 }, scope), true);
  assert.equal(inReplacedScope({ account_code: '53051060', fiscal_year: '2026' }, scope), true);
});
