import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRITABLE_FIELDS, draftFromRecord, emptyDraft, isDirty, statusOptionsFor, STATUS_OPTIONS } from './equipmentFields.js';
import { normalizeMac, serializeDraft, validateDraft } from './equipmentValidation.js';
import { findIpGroups, rangeText, siteSubnets } from './ipAllocationReference.js';

const record = {
  id: 19138, name: 'E2WPTAF10', ip_address: '172.21.27.146', mac_address: '44:87:FC:F3:F8:FE', status: 'ใช้งานพิเศษ',
  pea_site_id: 21, notes: null, photos: ['/a.jpg'], storage_photo: '/b.jpg', network_ip: { main: '1.2.3.4' },
  current_loan: { id: 1 }, pea_site: { id: 21 }, updatedAt: '2026-09-24T05:06:50.000Z'
};

test('payload contains only writable fields, never read-only API data', () => {
  const body = serializeDraft(draftFromRecord(record));
  assert.deepEqual([...body.keys()], WRITABLE_FIELDS);
  for (const key of ['id', 'photos', 'storage_photo', 'network_ip', 'current_loan', 'pea_site', 'updatedAt']) assert.equal(body.has(key), false);
  assert.equal(body.get('pea_site_id'), '21');
  assert.equal(body.get('notes'), '');
});

test('locked site id overrides whatever the draft holds', () => {
  const body = serializeDraft({ ...draftFromRecord(record), pea_site_id: '99' }, { siteId: '21' });
  assert.equal(body.get('pea_site_id'), '21');
});

test('editing optional fields preserves explicit clears and fills previously empty values', () => {
  const fields = ['equipment_code', 'serial_number', 'asset_number', 'asset_owner', 'asset_owner_emp_id', 'ip_address', 'mac_address', 'department', 'equipment_type', 'storage_location', 'vendor', 'contract_no', 'contract_start_date', 'contract_expiry_date', 'notes'];
  for (const field of fields) {
    const baseline = draftFromRecord({ ...record, [field]: 'old value' });
    for (const value of ['', '   ']) {
      const draft = { ...baseline, [field]: value };
      assert.equal(isDirty(draft, baseline), true, field);
      assert.deepEqual(validateDraft(draft), {}, field);
      const body = new URLSearchParams(serializeDraft(draft).toString());
      assert.equal(body.has(field), true, field);
      assert.equal(body.get(field), '', field);
      const editedBody = new URLSearchParams(serializeDraft(draft, { baseline }).toString());
      assert.equal(editedBody.get(field), '-', field);
      assert.deepEqual(validateDraft({ ...draft, [field]: '-' }), {}, field);
    }
    const empty = draftFromRecord({ ...record, [field]: null });
    const filled = { ...empty, [field]: 'new value' };
    assert.equal(serializeDraft(empty, { baseline: empty }).get(field), '', field);
    assert.equal(isDirty(filled, empty), true, field);
    assert.equal(serializeDraft(filled, { baseline: empty }).get(field), 'new value', field);
  }
});

test('both entry points serialize the same draft identically', () => {
  const draft = { ...draftFromRecord(record), name: '  PC-01  ' };
  assert.equal(serializeDraft(draft).toString(), serializeDraft({ ...draft }).toString());
  assert.equal(serializeDraft(draft).get('name'), 'PC-01');
});

test('status outside the fixed list is kept as an option', () => {
  assert.equal(statusOptionsFor('ใช้งานพิเศษ')[0], 'ใช้งานพิเศษ');
  assert.equal(statusOptionsFor('ใช้งาน'), STATUS_OPTIONS);
  assert.equal(draftFromRecord(record).status, 'ใช้งานพิเศษ');
});

test('default status depends on entry point', () => {
  assert.equal(emptyDraft({ source: 'office', siteId: 7 }).status, 'ใช้งาน');
  assert.equal(emptyDraft({ source: 'office', siteId: 7 }).pea_site_id, '7');
  assert.equal(emptyDraft({ source: 'stock' }).status, '');
});

test('dirty tracking ignores null vs empty differences', () => {
  const base = draftFromRecord(record);
  assert.equal(isDirty({ ...base }, base), false);
  assert.equal(isDirty({ ...base, notes: 'x' }, base), true);
});

test('validation covers required, IP, MAC and contract dates', () => {
  const errors = validateDraft({ name: ' ', ip_address: '999.1.1.1', mac_address: 'aa:bb:cc:dd:ee:ff', contract_start_date: '2026-05-01', contract_expiry_date: '2026-04-01' });
  assert.deepEqual(Object.keys(errors).sort(), ['contract_expiry_date', 'ip_address', 'mac_address', 'name', 'pea_site_id', 'status']);
  assert.deepEqual(validateDraft({ name: 'x', status: 'ใช้งาน', pea_site_id: '1', ip_address: '0.0.0.0', mac_address: 'AA:BB:CC:DD:EE:FF' }), {});
  assert.deepEqual(validateDraft({ name: 'x', status: 'ใช้งาน' }, { requireSite: false }), {});
  assert.ok(validateDraft({ name: 'x', pea_site_id: '1', contract_start_date: '2026-02-30' }).contract_start_date);
});

test('stock creation and editing reject missing status before saving', () => {
  const stock = { ...emptyDraft({ source: 'stock', siteId: 198 }), name: 'PC stock' };
  for (const status of ['', '   ', null, undefined]) {
    assert.deepEqual(Object.keys(validateDraft({ ...stock, status })), ['status']);
    assert.deepEqual(Object.keys(validateDraft({ ...draftFromRecord(record), status })), ['status']);
  }
  for (const status of [...STATUS_OPTIONS, 'ใช้งานพิเศษ']) {
    const draft = { ...stock, status };
    assert.deepEqual(validateDraft(draft), {});
    assert.equal(serializeDraft(draft).get('status'), status);
  }
  assert.equal(serializeDraft(draftFromRecord(record)).get('status'), record.status);
});

test('MAC normalization is visible and only applies to real MACs', () => {
  assert.equal(normalizeMac(' aa-bb-cc-dd-ee-ff '), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeMac('not a mac'), 'not a mac');
});

test('IP groups use exact matches, not substrings', () => {
  assert.deepEqual(findIpGroups({ equipmentType: 'Printer' }).map(g => g.group), ['printer']);
  assert.deepEqual(findIpGroups({ equipmentType: 'P', department: 'ผ' }), []);
  assert.deepEqual(findIpGroups({ equipmentType: 'PC', department: 'ผสน' }).map(g => g.group), ['ผสน']);
  assert.deepEqual(findIpGroups({}), []);
});

test('range text uses the site base, else a relative form; subnets skip missing values', () => {
  assert.equal(rangeText('172.21.110.241', '1-10'), '172.21.110.1 – 172.21.110.10');
  assert.equal(rangeText(null, '221'), '.221');
  assert.equal(rangeText('-', '1-10'), '.1 – .10');
  assert.equal(rangeText('172.21.1.1', null), null);
  assert.deepEqual(siteSubnets({ main: '172.21.145.241', secondary_172: '-', secondary_10: null, dhcp_range: '' }).map(s => s.key), ['main']);
  assert.deepEqual(siteSubnets(null), []);
});
