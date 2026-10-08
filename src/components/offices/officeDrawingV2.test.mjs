import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBox, createDimension, createImage, deleteObjects, duplicateObjects, needsV2, newDocument, upgradeEntry, validateDrawing, withMeasurement
} from './officeDrawingDocument.js';
import { anchorPoint, hitTest, moveObjects, resizeBoxKeepRatio, updateBox } from './officeDrawingGeometry.js';
import {
  dimensionGeometry, dimensionLength, formatPaper, formatReal, polylineLength, rescaleDocument, sizeLabel
} from './officeDrawingMeasure.js';
import { entryFromDrawing, errorText, imageFileProblem, writablePayload } from './officeDrawingApi.js';
import { templateDocument } from './officeDrawingTemplates.js';

const scaled = (denominator = 100, extra = {}) => ({ ...withMeasurement(newDocument({ schemaVersion: 2 })), scale: { mode: 'scaled', denominator }, ...extra });
const L = (doc) => doc.layers[0].id;
const meta = (v = 2) => ({ name: 'แบบ', drawing_type: 'floor_plan', building_label: null, floor_label: null, schema_version: v });

test('contract examples: paper mm -> real cm/m', () => {
  assert.equal(sizeLabel(50, 30, scaled(100)), '5.00 m × 3.00 m');
  assert.equal(formatPaper(20, scaled(50)), '1.00 m');
  assert.equal(formatPaper(5, scaled(100)), '50.00 cm');
  assert.equal(formatPaper(1, scaled(100)), '10.00 cm', 'grid 1 mm = 10 cm');
  assert.equal(formatPaper(20, newDocument()), '', 'schematic: no real distance');
});

test('auto unit switches at 1 m before rounding; precision only affects display', () => {
  const m = { display_unit: 'auto', precision: 0 };
  assert.equal(formatReal(999, m), '100 cm');
  assert.equal(formatReal(1000, m), '1 m');
  assert.equal(formatReal(1234, { display_unit: 'cm', precision: 1 }), '123.4 cm');
  assert.equal(formatReal(1234, { display_unit: 'm', precision: 3 }), '1.234 m');
});

test('polyline length sums every segment', () => {
  assert.equal(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]), 11);
});

test('1:100 -> 1:50 keeping real distances doubles geometry, keeps printed conventions', () => {
  const doc = scaled(100);
  const room = createBox('room', { x: 10, y: 20, width: 50, height: 30, layerId: L(doc) });
  const pc = createBox('equipment', { x: 30, y: 30, width: 8, height: 8, layerId: L(doc), symbol_key: 'pc' });
  const text = createBox('text', { x: 10, y: 10, width: 40, height: 8, layerId: L(doc) });
  const dim = createDimension({ start: { x: 10, y: 20 }, end: { x: 60, y: 20 }, axis: 'horizontal', offset: -6, layerId: L(doc) });
  const before = { ...doc, objects: [room, pc, text, dim], grid: { ...doc.grid, spacing: 1 } };
  const after = rescaleDocument(before, 100, 50);
  const r = after.objects[0];
  assert.deepEqual([r.x, r.y, r.width, r.height], [20, 40, 100, 60]);
  assert.equal(sizeLabel(r.width, r.height, after), sizeLabel(50, 30, before), 'same real size');
  assert.equal(after.scale.denominator, 50);
  assert.equal(after.grid.spacing, 2, 'grid keeps its real 10 cm');
  const p = after.objects[1];
  assert.deepEqual([p.width, p.height], [8, 8], 'symbol size is a printed convention');
  assert.deepEqual([p.x + 4, p.y + 4], [68, 68], 'symbol centre moved with the plan');
  assert.equal(after.objects[2].font_size, before.objects[2].font_size);
  assert.deepEqual([after.objects[2].width, after.objects[2].height], [40, 8]);
  const d = after.objects[3];
  assert.equal(d.offset, -12);
  assert.equal(formatPaper(dimensionLength(d), after), formatPaper(dimensionLength(dim), before));
  assert.equal(after.title_block, before.title_block);
  assert.equal(after.legend, before.legend);
});

test('dimension length follows its axis; geometry keeps text upright', () => {
  const base = { start: { x: 0, y: 0 }, end: { x: 30, y: 40 }, offset: 5, font_size: 3 };
  assert.equal(dimensionLength({ ...base, axis: 'aligned' }), 50);
  assert.equal(dimensionLength({ ...base, axis: 'horizontal' }), 30);
  assert.equal(dimensionLength({ ...base, axis: 'vertical' }), 40);
  const g = dimensionGeometry({ ...base, start: { x: 50, y: 0 }, end: { x: 0, y: 0 }, axis: 'aligned' });
  assert.ok(g.angle > -90 && g.angle <= 90, String(g.angle));
  const h = dimensionGeometry({ ...base, axis: 'horizontal', offset: -6 });
  assert.equal(h.a.y, -6);
  assert.equal(h.b.x, 30);
});

test('dimension ends attached to a box follow it (corners too) and detach on delete', () => {
  const doc = scaled(100);
  const room = createBox('room', { x: 10, y: 10, width: 50, height: 30, layerId: L(doc) });
  const dim = createDimension({ start: anchorPoint(room, 'top_left'), end: anchorPoint(room, 'top_right'), axis: 'horizontal', layerId: L(doc), startRef: { object_id: room.id, anchor: 'top_left' }, endRef: { object_id: room.id, anchor: 'top_right' } });
  const d0 = { ...doc, objects: [room, dim] };
  const moved = moveObjects(d0, [room.id], 5, 7);
  const md = moved.objects[1];
  assert.deepEqual(md.start, { x: 15, y: 17 });
  assert.deepEqual(md.end, { x: 65, y: 17 });
  const resized = updateBox(d0, room.id, { width: 80 });
  assert.equal(resized.objects[1].end.x, 90);
  const gone = deleteObjects(d0, [room.id]);
  assert.equal(gone.objects[0].start_ref, null);
  assert.equal(gone.objects[0].end_ref, null);
  assert.equal(validateDrawing({ meta: meta(), doc: gone }), null);
  const both = deleteObjects(d0, [room.id], { cables: 'delete' });
  assert.equal(both.objects.length, 0);
});

test('duplicating a box with its dimension keeps the link inside the copy', () => {
  const doc = scaled(100);
  const room = createBox('room', { x: 10, y: 10, width: 50, height: 30, layerId: L(doc) });
  const dim = createDimension({ start: { x: 10, y: 10 }, end: { x: 60, y: 10 }, axis: 'horizontal', layerId: L(doc), startRef: { object_id: room.id, anchor: 'top_left' } });
  const { doc: d1, ids } = duplicateObjects({ ...doc, objects: [room, dim] }, [room.id, dim.id]);
  const copyDim = d1.objects.find(o => o.id === ids[1]);
  assert.equal(copyDim.start_ref.object_id, ids[0]);
  assert.deepEqual(copyDim.start, { x: 15, y: 15 });
  const { doc: d2, ids: only } = duplicateObjects({ ...doc, objects: [room, dim] }, [dim.id]);
  assert.equal(d2.objects.find(o => o.id === only[0]).start_ref, null);
});

test('dimensions are hit on their measuring line', () => {
  const doc = scaled(100);
  const dim = createDimension({ start: { x: 10, y: 50 }, end: { x: 60, y: 50 }, axis: 'horizontal', offset: -6, layerId: L(doc) });
  assert.equal(hitTest({ ...doc, objects: [dim] }, { x: 30, y: 44 }, { tolerance: 1 }).id, dim.id);
});

test('v2 validation: dimension only when scaled, positive length along its axis, image fields', () => {
  const doc = scaled(100);
  const dim = createDimension({ start: { x: 10, y: 10 }, end: { x: 10, y: 40 }, axis: 'horizontal', layerId: L(doc) });
  assert.match(validateDrawing({ meta: meta(), doc: { ...doc, objects: [dim] } }).path, /\.end$/);
  const ok = { ...dim, axis: 'vertical' };
  assert.equal(validateDrawing({ meta: meta(), doc: { ...doc, objects: [ok] } }), null);
  const schematic = { ...doc, scale: { mode: 'schematic', denominator: null }, objects: [ok] };
  assert.match(validateDrawing({ meta: meta(), doc: schematic }).message, /มาตราส่วน/);
  assert.match(validateDrawing({ meta: meta(), doc: { ...doc, scale: { mode: 'scaled', denominator: 2.5 } } }).path, /denominator/);
  const img = createImage({ x: 0, y: 0, width: 40, height: 30, layerId: L(doc), assetId: 'asset_0123456789abcdef0123456789abcdef' });
  assert.equal(validateDrawing({ meta: meta(), doc: { ...doc, objects: [img] } }), null);
  assert.match(validateDrawing({ meta: meta(), doc: { ...doc, objects: [{ ...img, opacity: 2 }] } }).path, /opacity/);
  assert.equal(img.fit, 'contain');
  assert.equal('crop' in img || 'style' in img, false);
});

test('v1 drawings stay v1 until they need v2, and never go back', () => {
  const v1 = templateDocument('floor_plan');
  assert.equal('measurement' in v1, false);
  assert.equal(needsV2(v1), false);
  const entry = { meta: meta(1), doc: v1 };
  assert.equal(validateDrawing(entry), null);
  const withImage = { ...v1, objects: [...v1.objects, createImage({ x: 0, y: 0, width: 10, height: 10, layerId: v1.layers[0].id, assetId: 'asset_x' })] };
  assert.equal(needsV2(withImage), true);
  assert.match(validateDrawing({ meta: meta(1), doc: withImage }).path, /schema_version/);
  const up = upgradeEntry({ meta: meta(1), doc: withImage });
  assert.equal(up.meta.schema_version, 2);
  assert.deepEqual(up.doc.measurement, { display_unit: 'auto', precision: 2 });
  assert.deepEqual(Object.keys(up.doc).slice(0, 4), ['page', 'grid', 'scale', 'measurement']);
  assert.equal(upgradeEntry(up), up);
  const back = writablePayload(up, { expectedVersion: 3 });
  assert.equal(back.schema_version, 2);
  assert.equal(writablePayload(entryFromDrawing({ name: 'x', drawing_type: 'floor_plan', schema_version: 2, document: up.doc }), {}).schema_version, 2);
});

test('new drawings follow the server default schema', () => {
  assert.ok(templateDocument('network_layout', { schemaVersion: 2 }).measurement);
  assert.ok(templateDocument('blank', { schemaVersion: 2, size: 'A3', orientation: 'portrait' }).measurement);
  assert.equal(templateDocument('blank', { schemaVersion: 1 }).measurement, undefined);
});

test('image corner resize keeps proportions, edge resize is free', () => {
  const img = { x: 0, y: 0, width: 40, height: 20, rotation: 0 };
  const r = resizeBoxKeepRatio(img, 'se', { x: 80, y: 25 });
  assert.equal(r.width / r.height, 2);
  assert.deepEqual([r.x, r.y], [0, 0]);
  const e = resizeBoxKeepRatio(img, 'e', { x: 60, y: 10 });
  assert.deepEqual([e.width, e.height], [60, 20]);
});

test('image upload checks and error texts', () => {
  assert.equal(imageFileProblem({ type: 'image/png', size: 1000 }), '');
  assert.match(imageFileProblem({ type: 'image/gif', size: 10 }), /PNG/);
  assert.match(imageFileProblem({ type: 'image/png', size: 11 * 1048576 }), /10 MB/);
  assert.match(errorText({ status: 404, code: 'ASSET_NOT_FOUND' }), /รูป/);
  assert.match(errorText({ status: 404, code: '' }), /แบบ/);
  assert.match(errorText({ status: 409, code: 'ASSET_IN_USE' }), /รูป/);
  assert.match(errorText({ status: 422, code: 'INVALID_IMAGE_REFERENCE' }), /รูป/);
  assert.match(errorText({ status: 413, code: 'IMAGE_TOO_LARGE' }), /10 MB/);
  assert.match(errorText({ status: 400, code: 'UNSUPPORTED_SCHEMA_VERSION' }), /รุ่น/);
});

import { layoutWarnings, printImageStatus, preloadPrintImages } from './officeDrawingPrint.js';

test('print dimensions includes offset lines outside paper and ignores hidden layers', () => {
  const doc = scaled();
  const dim = createDimension({ start: { x: 10, y: 10 }, end: { x: 40, y: 10 }, axis: 'horizontal', offset: -20, layerId: L(doc) });
  doc.objects = [dim];
  assert.equal(layoutWarnings(doc).out.length, 1);
  doc.objects = [{ ...dim, offset: 5 }];
  assert.deepEqual(layoutWarnings(doc), { out: [], under: [] });
  doc.objects = [dim];
  doc.layers = doc.layers.map(l => ({ ...l, visible: false }));
  assert.deepEqual(layoutWarnings(doc), { out: [], under: [] });
});

test('print requires every visible image source, including sources not yet registered', () => {
  const doc = scaled();
  doc.objects = [
    { type: 'image', asset_id: 'a', layer_id: L(doc) },
    { type: 'image', asset_id: 'a', layer_id: L(doc) },
    { type: 'image', asset_id: 'b', layer_id: L(doc) },
  ];
  assert.deepEqual(printImageStatus(doc, new Map()), { loading: 2, failed: 0 });
  const sources = new Map([['a', { state: 'ready', url: 'blob:a' }], ['b', { state: 'missing' }]]);
  assert.deepEqual(printImageStatus(doc, sources), { loading: 0, failed: 1 });
  sources.set('b', { state: 'public', url: '/b' });
  assert.deepEqual(printImageStatus(doc, sources), { loading: 0, failed: 0 });
  doc.layers = doc.layers.map(l => ({ ...l, visible: false }));
  assert.deepEqual(printImageStatus(doc, new Map()), { loading: 0, failed: 0 });
});

test('print image preload waits for all unique images and rejects failures', async () => {
  const images = [];
  const createImage = () => { const img = {}; images.push(img); return img; };
  let done = false;
  const ready = preloadPrintImages(['a', 'a', 'b'], { createImage }).then(() => { done = true; });
  assert.equal(images.length, 2);
  images[0].onload();
  await Promise.resolve();
  assert.equal(done, false);
  images[1].onload();
  await ready;
  assert.equal(done, true);
  const failed = preloadPrintImages(['broken'], { createImage });
  images[2].onerror();
  await assert.rejects(failed, /Image load failed/);
});

test('print image preload times out and cancels when preview closes', async () => {
  await assert.rejects(preloadPrintImages(['slow'], { createImage: () => ({}), timeoutMs: 5 }), /timed out/);
  const controller = new AbortController();
  const image = {};
  const pending = preloadPrintImages(['pending'], { createImage: () => image, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});
