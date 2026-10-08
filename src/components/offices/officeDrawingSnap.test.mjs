import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBox, createPolyline, newDocument } from './officeDrawingDocument.js';
import { findSnap, snapMove } from './officeDrawingGeometry.js';

function sample() {
  const doc = newDocument();
  const L = doc.layers[0].id;
  const wall = createPolyline('wall', { layerId: L, points: [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 50 }] });
  const room = createBox('room', { x: 100, y: 100, width: 40, height: 20, layerId: L });
  return { doc: { ...doc, objects: [wall, room] }, wall, room };
}

test('line ends and bends win, then box anchors, then a point along a line', () => {
  const { doc, wall, room } = sample();
  assert.deepEqual(findSnap(doc, { x: 60.8, y: 10.5 }, { tolerance: 2 }), { x: 60, y: 10, kind: 'vertex', objectId: wall.id });
  assert.equal(findSnap(doc, { x: 141, y: 99 }, { tolerance: 2 }).kind, 'anchor');
  assert.deepEqual(findSnap(doc, { x: 140, y: 100 }, { tolerance: 2 }), { x: 140, y: 100, kind: 'anchor', objectId: room.id });
  const along = findSnap(doc, { x: 35, y: 11 }, { tolerance: 2 });
  assert.deepEqual([along.x, along.y, along.kind], [35, 10, 'segment']);
  assert.equal(findSnap(doc, { x: 35, y: 20 }, { tolerance: 2 }), null);
});

test('excluded and locked objects are not snap targets; extra points (closing) count', () => {
  const { doc, wall } = sample();
  assert.equal(findSnap(doc, { x: 60, y: 10 }, { tolerance: 2, exclude: new Set([wall.id]) }), null);
  const locked = { ...doc, layers: doc.layers.map((l, i) => (i === 0 ? { ...l, locked: true } : l)) };
  assert.equal(findSnap(locked, { x: 60, y: 10 }, { tolerance: 2 }), null);
  assert.equal(findSnap(doc, { x: 0.5, y: 0.5 }, { tolerance: 2, extraPoints: [{ point: { x: 0, y: 0 }, kind: 'close' }] }).kind, 'close');
});

test('moving snaps a corner of the moved box onto another object', () => {
  const { doc, room } = sample();
  const desk = createBox('desk', { x: 0, y: 80, width: 20, height: 10, layerId: doc.layers[0].id });
  const d = { ...doc, objects: [...doc.objects, desk] };
  // drag the desk so its top-right corner lands 1 mm off the room's top-left
  const s = snapMove(d, [desk.id], 79, 21, 2);
  assert.ok(s);
  assert.deepEqual([desk.x + 20 + s.dx, desk.y + s.dy], [room.x, room.y]);
  assert.equal(snapMove(d, [desk.id], 160, 0, 2), null);
});
