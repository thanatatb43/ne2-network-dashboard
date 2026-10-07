import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addLayer, createBox, createPolyline, deleteObjects, duplicateObjects, isValidId, newDocument, objectIndexFromPath,
  removeLayer, renderOrder, textProblem, unknownObjects, validateDrawing, pageDimensions, titleBlockRect
} from './officeDrawingDocument.js';
import {
  anchorPoint, hitTest, moveObjects, nearestAnchor, pointInBox, resizeBox, rotationFromPointer, snapPoint, updateBox, lockAxis
} from './officeDrawingGeometry.js';
import { acceptSaved, canRedo, commit, createHistory, isDirty, redo, undo } from './officeDrawingHistory.js';
import { buildQuery, entryFromDrawing, staleLinkIds, stripAssetRefs, writablePayload } from './officeDrawingApi.js';
import { TEMPLATES, templateDocument } from './officeDrawingTemplates.js';
import { clearRecovery, readRecovery, saveRecovery } from './officeDrawingRecovery.js';

const close = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

function sample() {
  const doc = newDocument({ size: 'A4', orientation: 'landscape' });
  const L = doc.layers[0].id;
  const a = createBox('equipment', { x: 10, y: 10, width: 10, height: 10, layerId: L, symbol_key: 'switch' });
  const b = createBox('outlet', { x: 100, y: 50, width: 4, height: 4, layerId: L });
  const cable = createPolyline('cable', {
    layerId: L, cable_style_key: 'utp',
    points: [anchorPoint(a, 'right'), { x: 60, y: 15 }, { x: 60, y: 52 }, anchorPoint(b, 'left')],
    start: { object_id: a.id, anchor: 'right' }, end: { object_id: b.id, anchor: 'left' }
  });
  return { doc: { ...doc, objects: [a, b, cable] }, a, b, cable };
}

test('page sizes follow orientation and the title block sits inside the margin', () => {
  assert.deepEqual(pageDimensions('A3', 'landscape'), { width: 420, height: 297 });
  assert.deepEqual(pageDimensions('A4', 'portrait'), { width: 210, height: 297 });
  const r = titleBlockRect(newDocument({ size: 'A4', orientation: 'landscape' }).page);
  assert.equal(r.x + r.width, 287);
  assert.equal(r.y + r.height, 200);
});

test('ids are valid and unique', () => {
  const { doc } = sample();
  const ids = doc.objects.map(o => o.id);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach(id => assert.ok(isValidId(id), id));
});

test('anchors and hit tests respect rotation', () => {
  const box = { x: 0, y: 0, width: 20, height: 10, rotation: 90 };
  const top = anchorPoint(box, 'top');
  close(top.x, 15); close(top.y, 5);
  assert.ok(pointInBox({ x: 10, y: -3 }, box));
  assert.ok(!pointInBox({ x: 1, y: 1 }, box));
  assert.equal(nearestAnchor(box, { x: 16, y: 5 }), 'top');
});

test('moving a box carries attached cable ends and keeps the bends', () => {
  const { doc, a, cable } = sample();
  const moved = moveObjects(doc, [a.id], 0, 20);
  const c = moved.objects.find(o => o.id === cable.id);
  assert.deepEqual(c.points[0], { x: 20, y: 35 });
  assert.deepEqual(c.points[1], cable.points[1]);
  assert.deepEqual(c.points.at(-1), cable.points.at(-1));
});

test('rotating or resizing a box re-anchors its cables', () => {
  const { doc, b, cable } = sample();
  const rotated = updateBox(doc, b.id, { rotation: 180 });
  const c = rotated.objects.find(o => o.id === cable.id);
  const expected = anchorPoint({ ...b, rotation: 180 }, 'left');
  close(c.points.at(-1).x, expected.x); close(c.points.at(-1).y, expected.y);
});

test('resize keeps the opposite corner fixed, also when rotated', () => {
  const box = { x: 0, y: 0, width: 20, height: 10, rotation: 0 };
  assert.deepEqual(resizeBox(box, 'se', { x: 30, y: 20 }), { x: 0, y: 0, width: 30, height: 20 });
  assert.deepEqual(resizeBox(box, 'nw', { x: 5, y: 2 }), { x: 5, y: 2, width: 15, height: 8 });
  const rot = { x: 0, y: 0, width: 20, height: 10, rotation: 90 };
  const before = anchorPoint(rot, 'left');
  // local right edge at x=30 -> paper (10, 25) after the 90deg turn
  const after = resizeBox(rot, 'e', { x: 10, y: 25 });
  const nb = { ...rot, ...after };
  const fixed = anchorPoint(nb, 'left');
  close(fixed.x, before.x); close(fixed.y, before.y);
  close(nb.width, 30);
});

test('rotation handle: straight up is 0, snaps with a step', () => {
  const box = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
  assert.equal(rotationFromPointer(box, { x: 5, y: -20 }), 0);
  assert.equal(rotationFromPointer(box, { x: 30, y: 5 }), 90);
  assert.equal(rotationFromPointer(box, { x: 30, y: 8 }, 15), 90);
});

test('snap and axis lock', () => {
  assert.deepEqual(snapPoint({ x: 12.4, y: 7.6 }, { snap: true, spacing: 5 }), { x: 10, y: 10 });
  assert.deepEqual(snapPoint({ x: 12.4, y: 7.6 }, { snap: false, spacing: 5 }), { x: 12.4, y: 7.6 });
  assert.deepEqual(lockAxis({ x: 0, y: 0 }, { x: 10, y: 3 }), { x: 10, y: 0 });
});

test('deleting a box detaches or deletes its cables, never leaves a dangling end', () => {
  const { doc, a, cable } = sample();
  const detached = deleteObjects(doc, [a.id]);
  const c = detached.objects.find(o => o.id === cable.id);
  assert.equal(c.start, null);
  assert.ok(c.end);
  assert.equal(validateDrawing({ meta: { name: 'x' }, doc: detached }), null);
  const both = deleteObjects(doc, [a.id], { cables: 'delete' });
  assert.equal(both.objects.some(o => o.id === cable.id), false);
});

test('duplicate makes new ids, remaps refs inside the copy, drops outside refs and links', () => {
  const { doc, a, b, cable } = sample();
  const withLink = { ...doc, objects: doc.objects.map(o => (o.id === a.id ? { ...o, asset_ref: { kind: 'network_device', id: 5 } } : o)) };
  const { doc: d1, ids } = duplicateObjects(withLink, [a.id, cable.id]);
  assert.equal(ids.length, 2);
  const [ca, cc] = ids.map(id => d1.objects.find(o => o.id === id));
  assert.equal(cc.start.object_id, ca.id);
  assert.equal(cc.end, null, 'end pointed at a box outside the copy');
  assert.equal(ca.asset_ref, null);
  assert.equal(validateDrawing({ meta: { name: 'x' }, doc: d1 }), null);
  assert.ok(d1.objects.some(o => o.id === b.id));
});

test('layers: removing one moves or deletes its objects; the last stays', () => {
  const { doc } = sample();
  const { doc: d1, id } = addLayer(doc, 'ใหม่');
  const d2 = { ...d1, objects: d1.objects.map(o => ({ ...o, layer_id: id })) };
  const moved = removeLayer(d2, id, { moveTo: doc.layers[0].id });
  assert.equal(moved.objects.length, 3);
  assert.ok(moved.objects.every(o => o.layer_id === doc.layers[0].id));
  const gone = removeLayer(d2, id);
  assert.equal(gone.objects.length, 0);
  const one = { ...doc, layers: [doc.layers[0]] };
  assert.equal(removeLayer(one, doc.layers[0].id), one);
});

test('render order: layer order, then array order', () => {
  const { doc, a, b } = sample();
  const top = doc.layers[1].id;
  const d = { ...doc, objects: doc.objects.map(o => (o.id === a.id ? { ...o, layer_id: top } : o)) };
  const order = renderOrder(d).map(o => o.id);
  assert.ok(order.indexOf(a.id) > order.indexOf(b.id));
  const hit = hitTest({ ...d, objects: [...d.objects, { ...b, id: 'over', layer_id: top, x: 10, y: 10, width: 10, height: 10 }] }, { x: 15, y: 15 });
  assert.equal(hit.id, 'over');
});

test('locked or hidden layers are not hit', () => {
  const { doc, a } = sample();
  const locked = { ...doc, layers: doc.layers.map((l, i) => (i === 0 ? { ...l, locked: true } : l)) };
  assert.equal(hitTest(locked, { x: 15, y: 15 }), null);
  assert.equal(hitTest(locked, { x: 15, y: 15 }, { includeLocked: true }).id, a.id);
});

test('plain-text rules match the server', () => {
  assert.equal(textProblem('2 < 3 ห้อง A'), '');
  assert.ok(textProblem('<b>x</b>'));
  assert.ok(textProblem('ดู https://x'));
  assert.ok(textProblem('www.pea.co.th'));
  assert.ok(textProblem('a\u0001b'));
  assert.equal(textProblem('บรรทัด\nสอง\tแท็บ'), '');
});

test('validation finds the first problem with a server-style path', () => {
  const { doc, cable } = sample();
  assert.equal(validateDrawing({ meta: { name: '' }, doc }).path, 'name');
  const bad = { ...doc, objects: doc.objects.map(o => (o.id === cable.id ? { ...o, label: 'ดู http://x' } : o)) };
  const p = validateDrawing({ meta: { name: 'x' }, doc: bad });
  assert.equal(p.path, 'document.objects[2].label');
  assert.equal(objectIndexFromPath(p.path), 2);
  const dangling = { ...doc, objects: doc.objects.filter(o => o.type === 'cable') };
  assert.match(validateDrawing({ meta: { name: 'x' }, doc: dangling }).path, /start\.object_id$/);
});

test('templates validate and carry no equipment links', () => {
  for (const t of TEMPLATES) {
    const doc = templateDocument(t.key, { size: 'A4', orientation: 'portrait', drawingType: 'floor_plan' });
    assert.equal(validateDrawing({ meta: { name: t.label }, doc }), null, t.key);
    assert.ok(doc.objects.every(o => !o.asset_ref), t.key);
    assert.deepEqual(unknownObjects(doc), []);
  }
});

test('history: one entry per commit, undo/redo, dirty against the saved baseline', () => {
  const e0 = { meta: { name: 'a' }, doc: { objects: [] } };
  const e1 = { meta: { name: 'b' }, doc: { objects: [] } };
  let h = createHistory(e0);
  const baseline = { entry: e0, version: 1 };
  assert.equal(isDirty(h, baseline), false);
  h = commit(h, e1);
  assert.equal(commit(h, { ...e1 }), h, 'an identical entry adds nothing');
  assert.equal(isDirty(h, baseline), true);
  h = undo(h);
  assert.equal(isDirty(h, baseline), false);
  assert.ok(canRedo(h));
  h = redo(h);
  assert.equal(h.present, e1);
});

test('a save accepted for an older snapshot keeps later edits dirty', () => {
  const e0 = { meta: { name: 'a' } };
  const e1 = { meta: { name: 'b' } };
  const e2 = { meta: { name: 'c' } };
  let h = commit(createHistory(e0), e1);
  const snapshot = h.present;
  h = commit(h, e2); // typed while the PUT ran
  const baseline = acceptSaved(snapshot, 2);
  assert.equal(baseline.version, 2);
  assert.equal(isDirty(h, baseline), true);
});

test('writable payload has only accepted fields', () => {
  const drawing = { id: 4, version: 3, pea_site_id: 9, pea_site_name: 'x', name: ' ผัง ', drawing_type: 'floor_plan', building_label: ' ', floor_label: 'ชั้น 2', permissions: {}, created_at: 'x', document: { objects: [] } };
  const entry = entryFromDrawing(drawing);
  const put = writablePayload(entry, { expectedVersion: 3 });
  assert.deepEqual(Object.keys(put), ['expected_version', 'name', 'drawing_type', 'building_label', 'floor_label', 'schema_version', 'document']);
  assert.equal(put.name, 'ผัง');
  assert.equal(put.building_label, null);
  const post = writablePayload(entry, { siteId: '9' });
  assert.equal(post.pea_site_id, 9);
  assert.equal('expected_version' in post, false);
});

test('query allowlists drop unknown and empty params', () => {
  assert.equal(buildQuery('list', { pea_site_id: 5, search: ' ชั้น ', drawing_type: '', page: 2, foo: 1 }), '?pea_site_id=5&search=%E0%B8%8A%E0%B8%B1%E0%B9%89%E0%B8%99&page=2');
  assert.equal(buildQuery('selectors', { pea_site_id: 5, search: 'a' }), '?search=a');
});

test('copies drop stale links (same office) or every link (other office)', () => {
  const doc = { objects: [{ id: 'a', asset_ref: { kind: 'office_equipment', id: 1 } }, { id: 'b', asset_ref: { kind: 'office_equipment', id: 2 } }, { id: 'c' }] };
  const stale = staleLinkIds([{ object_id: 'a', state: 'available' }, { object_id: 'b', state: 'moved' }]);
  assert.deepEqual(stale, ['b']);
  assert.deepEqual(stripAssetRefs(doc, stale).objects.map(o => o.asset_ref ?? null), [{ kind: 'office_equipment', id: 1 }, null, null]);
  assert.ok(stripAssetRefs(doc).objects.every(o => !o.asset_ref));
});

test('recovery drafts belong to one user and drawing', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  saveRecovery({ userId: 1, drawingKey: 42, siteId: 7, version: 3, entry: { meta: { name: 'x' } } }, storage);
  assert.equal(readRecovery({ userId: 2, drawingKey: 42 }, storage), null);
  const r = readRecovery({ userId: 1, drawingKey: '42' }, storage);
  assert.equal(r.version, 3);
  assert.equal(JSON.stringify(r).includes('token'), false);
  clearRecovery({ userId: 1, drawingKey: 42 }, storage);
  assert.equal(readRecovery({ userId: 1, drawingKey: 42 }, storage), null);
});
