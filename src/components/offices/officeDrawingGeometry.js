// Geometry for the drawing editor: rotation, anchors, hit tests, snapping,
// and edits that keep attached cable ends on their boxes. Paper mm, y down,
// box rotation clockwise in degrees around the box centre. Pure.
import { isBox, isPolyline, renderOrder, round, isEditableObject } from './officeDrawingDocument.js';

const RAD = Math.PI / 180;

export function rotatePoint(p, c, deg) {
  if (!deg) return { x: p.x, y: p.y };
  const s = Math.sin(deg * RAD);
  const k = Math.cos(deg * RAD);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k };
}

export const boxCenter = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

// A point given in the box's own (unrotated) frame -> paper.
const fromLocal = (b, p) => rotatePoint(p, boxCenter(b), b.rotation || 0);
const toLocal = (b, p) => rotatePoint(p, boxCenter(b), -(b.rotation || 0));

export function anchorPoint(box, anchor = 'center') {
  const c = boxCenter(box);
  const local = {
    center: c,
    top: { x: c.x, y: box.y },
    bottom: { x: c.x, y: box.y + box.height },
    left: { x: box.x, y: c.y },
    right: { x: box.x + box.width, y: c.y }
  }[anchor] || c;
  return fromLocal(box, local);
}

export function nearestAnchor(box, p) {
  let best = 'center';
  let bestD = Infinity;
  for (const a of ['center', 'top', 'right', 'bottom', 'left']) {
    const q = anchorPoint(box, a);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

export const boxCorners = (b) => [
  { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }
].map(p => fromLocal(b, p));

export function pointInBox(p, b, pad = 0) {
  const q = toLocal(b, p);
  return q.x >= b.x - pad && q.x <= b.x + b.width + pad && q.y >= b.y - pad && q.y <= b.y + b.height + pad;
}

export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p, points) {
  let d = Infinity;
  for (let i = 1; i < points.length; i += 1) d = Math.min(d, distanceToSegment(p, points[i - 1], points[i]));
  return d;
}

// Topmost object under the pointer among visible, unlocked layers (or all
// visible ones when `includeLocked`, for inspecting in read mode).
// Small symbols (equipment, outlet, junction) win over lines: cables end on
// them, and their centre would otherwise always pick the cable.
const PRIORITY = new Set(['equipment', 'outlet', 'junction']);
export function hitTest(doc, p, { tolerance = 1.5, includeLocked = false, boxesOnly = false, exclude = null } = {}) {
  const order = renderOrder(doc);
  const usable = (o) => {
    if (exclude && exclude.has(o.id)) return false;
    const layer = doc.layers.find(l => l.id === o.layer_id);
    return Boolean(layer) && layer.visible !== false && (includeLocked || !layer.locked);
  };
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const o = order[i];
    if (PRIORITY.has(o.type) && usable(o) && pointInBox(p, o, tolerance / 2)) return o;
  }
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const o = order[i];
    if (exclude && exclude.has(o.id)) continue;
    const layer = doc.layers.find(l => l.id === o.layer_id);
    if (!layer || layer.visible === false || (!includeLocked && layer.locked)) continue;
    if (isBox(o) && pointInBox(p, o, tolerance / 2)) return o;
    if (!boxesOnly && isPolyline(o) && distanceToPolyline(p, o.points) <= tolerance + (o.type === 'wall' ? (o.thickness || 0) / 2 : 0)) return o;
  }
  return null;
}

// Objects whose bounding box lies inside a marquee rectangle.
export function objectsInRect(doc, r) {
  const x1 = Math.min(r.x1, r.x2); const x2 = Math.max(r.x1, r.x2);
  const y1 = Math.min(r.y1, r.y2); const y2 = Math.max(r.y1, r.y2);
  const inside = (p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
  return doc.objects.filter(o => isEditableObject(doc, o) && (isBox(o) ? boxCorners(o) : o.points || []).every(inside)).map(o => o.id);
}

export const snapValue = (v, spacing) => (spacing > 0 ? Math.round(v / spacing) * spacing : v);
export const snapPoint = (p, grid) => (grid?.snap && grid.spacing > 0 ? { x: snapValue(p.x, grid.spacing), y: snapValue(p.y, grid.spacing) } : p);

// Horizontal/vertical lock while drawing a line: keep the larger movement.
export function lockAxis(from, p) {
  return Math.abs(p.x - from.x) >= Math.abs(p.y - from.y) ? { x: p.x, y: from.y } : { x: from.x, y: p.y };
}

// Cable ends follow the boxes they are attached to; inner bends stay.
export function reattachCables(doc, boxIds = null) {
  const boxes = new Map(doc.objects.filter(isBox).map(o => [o.id, o]));
  const touched = boxIds ? new Set(boxIds) : null;
  let changed = false;
  const objects = doc.objects.map(o => {
    if (o.type !== 'cable') return o;
    const s = o.start && boxes.get(o.start.object_id);
    const e = o.end && boxes.get(o.end.object_id);
    const moveS = s && (!touched || touched.has(s.id) || touched.has(o.id));
    const moveE = e && (!touched || touched.has(e.id) || touched.has(o.id));
    if (!moveS && !moveE) return o;
    const points = [...o.points];
    if (moveS) { const a = anchorPoint(s, o.start.anchor); points[0] = { x: round(a.x), y: round(a.y) }; }
    if (moveE) { const a = anchorPoint(e, o.end.anchor); points[points.length - 1] = { x: round(a.x), y: round(a.y) }; }
    if (points.every((pt, i) => pt.x === o.points[i].x && pt.y === o.points[i].y)) return o;
    changed = true;
    return { ...o, points };
  });
  return changed ? { ...doc, objects } : doc;
}

export function moveObjects(doc, ids, dx, dy) {
  const set = new Set(ids);
  if (!set.size || (!dx && !dy)) return doc;
  const objects = doc.objects.map(o => {
    if (!set.has(o.id)) return o;
    if (isBox(o)) return { ...o, x: round(o.x + dx), y: round(o.y + dy) };
    if (isPolyline(o)) {
      const moved = { ...o, points: o.points.map(p => ({ x: round(p.x + dx), y: round(p.y + dy) })) };
      if (o.label_position) moved.label_position = { ...o.label_position, x: round(o.label_position.x + dx), y: round(o.label_position.y + dy) };
      return moved;
    }
    return o;
  });
  return reattachCables({ ...doc, objects }, set);
}

// Replace one box (resize/rotate/inspector edit) and carry its cables along.
export function updateBox(doc, id, changes) {
  const objects = doc.objects.map(o => (o.id === id ? { ...o, ...changes } : o));
  return reattachCables({ ...doc, objects }, [id]);
}

const MIN_SIZE = 1;
// Drag a resize handle (n, ne, e, se, s, sw, w, nw) of a possibly rotated
// box: the opposite side stays where it is on paper.
export function resizeBox(box, handle, pointer) {
  const q = toLocal(box, pointer);
  let left = box.x; let right = box.x + box.width; let top = box.y; let bottom = box.y + box.height;
  if (handle.includes('w')) left = Math.min(q.x, right - MIN_SIZE);
  if (handle.includes('e')) right = Math.max(q.x, left + MIN_SIZE);
  if (handle.includes('n')) top = Math.min(q.y, bottom - MIN_SIZE);
  if (handle.includes('s')) bottom = Math.max(q.y, top + MIN_SIZE);
  const width = right - left;
  const height = bottom - top;
  // New centre in the old local frame -> paper (rotation unchanged).
  const c = fromLocal(box, { x: left + width / 2, y: top + height / 2 });
  return { x: round(c.x - width / 2), y: round(c.y - height / 2), width: round(width), height: round(height) };
}

// Rotation from a handle dragged around the centre (handle sits above the
// top edge, so straight up = 0deg). `step` snaps (e.g. 15 with Shift).
export function rotationFromPointer(box, pointer, step = 0) {
  const c = boxCenter(box);
  let deg = Math.atan2(pointer.y - c.y, pointer.x - c.x) / RAD + 90;
  if (step) deg = Math.round(deg / step) * step;
  deg = ((deg % 360) + 540) % 360 - 180;
  return round(deg === -180 ? 180 : deg);
}

// Polyline vertex edits (wall/cable). Ends of a cable can attach to a box.
export const moveVertex = (o, i, p) => ({ ...o, points: o.points.map((q, j) => (j === i ? { x: round(p.x), y: round(p.y) } : q)) });
export const insertVertex = (o, i, p) => ({ ...o, points: [...o.points.slice(0, i), { x: round(p.x), y: round(p.y) }, ...o.points.slice(i)] });
export const removeVertex = (o, i) => (o.points.length > 2 ? { ...o, points: o.points.filter((_, j) => j !== i) } : o);

export function polylineMidpoint(points) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < points.length; i += 1) { const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y); seg.push(l); total += l; }
  let half = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    if (half <= seg[i - 1] || i === points.length - 1) {
      const t = seg[i - 1] ? half / seg[i - 1] : 0;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
    half -= seg[i - 1];
  }
  return points[0];
}

// Rectangle from a drag (any direction), at least `min` mm each side.
export function rectFromDrag(a, b, min = 2) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x: round(x), y: round(y), width: round(Math.max(min, Math.abs(b.x - a.x))), height: round(Math.max(min, Math.abs(b.y - a.y))) };
}
