import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBox, createPolyline, newDocument } from './officeDrawingDocument.js';
import { doorOpenings, doorOpeningEdge } from './officeDrawingDoors.js';

const L = newDocument().layers[0].id;
const stroke = () => 0.4;
const wall = createPolyline('wall', { layerId: L, points: [{ x: 0, y: 30 }, { x: 100, y: 30 }], thickness: 2 });
const door = (props) => ({ ...createBox('door', { x: 40, y: 21, width: 9, height: 9, layerId: L }), ...props });

test('a door exactly on a wall cuts it for the door width', () => {
  const cuts = doorOpenings([wall, door()], stroke).get(wall.id);
  assert.equal(cuts.length, 1);
  assert.deepEqual([cuts[0].a.x, cuts[0].a.y, cuts[0].b.x, cuts[0].b.y], [40, 30, 49, 30]);
  assert.equal(cuts[0].width, 2);
});

test('a door a little off the line still cuts the line itself', () => {
  // placed by a click: 9 mm box on a 5 mm grid -> edge at y=29, wall at y=30
  const cuts = doorOpenings([wall, door({ y: 20 })], stroke).get(wall.id);
  assert.equal(cuts.length, 1);
  assert.equal(cuts[0].a.y, 30, 'cut sits on the wall, not on the door edge');
});

test('a door far from a line, or across it, does not cut it', () => {
  assert.equal(doorOpenings([wall, door({ y: 5 })], stroke).size, 0);
  assert.equal(doorOpenings([wall, door({ rotation: 90 })], stroke).size, 0, 'perpendicular');
});

test('rotated doors cut vertical walls and room edges; swing out uses the top edge', () => {
  const v = createPolyline('wall', { layerId: L, points: [{ x: 50, y: 0 }, { x: 50, y: 100 }], thickness: 1 });
  // rotated 90deg: the bottom edge becomes the left side at x = cx - h/2
  const d = createBox('door', { x: 50.5, y: 40, width: 10, height: 10, layerId: L });
  const rd = { ...d, rotation: 90 };
  const [e1] = doorOpeningEdge(rd);
  assert.ok(Math.abs(e1.x - 50.5) < 1e-9);
  const cuts = doorOpenings([v, rd], stroke).get(v.id);
  assert.equal(cuts.length, 1);
  assert.equal(cuts[0].a.x, 50);
  const room = createBox('room', { x: 10, y: 60, width: 80, height: 30, layerId: L });
  const out = createBox('door', { x: 20, y: 60.6, width: 9, height: 9, layerId: L });
  const rc = doorOpenings([room, { ...out, swing: 'out' }], stroke).get(room.id);
  assert.equal(rc.length, 1);
  assert.equal(rc[0].a.y, 60);
});

test('only the line the door sits on is cut', () => {
  const other = createPolyline('wall', { layerId: L, points: [{ x: 0, y: 60 }, { x: 100, y: 60 }], thickness: 2 });
  const m = doorOpenings([wall, other, door()], stroke);
  assert.ok(m.has(wall.id));
  assert.equal(m.has(other.id), false);
});
