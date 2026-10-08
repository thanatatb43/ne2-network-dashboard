// Door openings: where a door sits on a wall or a room/building edge, the
// line is cut for the width of the door. The cut is placed on the line
// itself (not on the door's own edge), so a door that is slightly off the
// line -- placed by a click, drawn before snapping, rounded to 0.1 mm --
// still opens it. Pure.
import { boxCorners } from './officeDrawingGeometry.js';

const STRUCTURE_TYPES = ['wall', 'room', 'building'];

// The door's opening side on paper: the edge the leaf closes against
// (bottom for swing "in", top for "out"), after rotation.
export function doorOpeningEdge(door) {
  const [tl, tr, br, bl] = boxCorners(door);
  return door.swing === 'out' ? [tl, tr] : [bl, br];
}

// Straight pieces of a structure with the stroke width it is drawn with.
export function structureSegments(o, strokeWidth) {
  if (o.type === 'wall') {
    const segs = [];
    for (let i = 1; i < o.points.length; i += 1) segs.push({ a: o.points[i - 1], b: o.points[i], width: o.thickness || strokeWidth || 0.3 });
    return segs;
  }
  const c = boxCorners(o);
  return [0, 1, 2, 3].map(i => ({ a: c[i], b: c[(i + 1) % 4], width: strokeWidth || 0.3 }));
}

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;

// The part of segment `seg` that `edge` covers, or null when they are not
// (nearly) parallel, too far apart or don't overlap.
// `tolerance`: how far (mm) the door edge may be from the line.
export function cutOnSegment(edge, seg, tolerance) {
  const [e1, e2] = edge;
  const d = sub(seg.b, seg.a);
  const len = Math.hypot(d.x, d.y);
  const ed = sub(e2, e1);
  const elen = Math.hypot(ed.x, ed.y);
  if (len < 1e-6 || elen < 1e-6) return null;
  // Parallel within ~3 degrees.
  if (Math.abs(cross(d, ed)) / (len * elen) > 0.05) return null;
  // Distance of the door edge from the line through the segment.
  const dist = Math.abs(cross(d, sub(e1, seg.a))) / len;
  const mid = { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 };
  const distMid = Math.abs(cross(d, sub(mid, seg.a))) / len;
  if (Math.min(dist, distMid) > tolerance) return null;
  // Overlap along the segment.
  const t1 = dot(sub(e1, seg.a), d) / (len * len);
  const t2 = dot(sub(e2, seg.a), d) / (len * len);
  const lo = Math.max(0, Math.min(t1, t2));
  const hi = Math.min(1, Math.max(t1, t2));
  if (hi - lo <= 1e-6) return null;
  const at = (t) => ({ x: seg.a.x + d.x * t, y: seg.a.y + d.y * t });
  return { a: at(lo), b: at(hi), width: seg.width };
}

// structure id -> [{ a, b, width }] cuts, for every visible door.
// `strokeOf(o)` gives a room/building's drawn stroke width.
export function doorOpenings(objects, strokeOf) {
  const doors = objects.filter(o => o.type === 'door');
  const result = new Map();
  if (!doors.length) return result;
  for (const s of objects) {
    if (!STRUCTURE_TYPES.includes(s.type)) continue;
    const segs = structureSegments(s, strokeOf(s));
    const cuts = [];
    for (const door of doors) {
      const edge = doorOpeningEdge(door);
      // Up to a quarter of the door's depth (at least 1.5 mm): close enough
      // to mean "this door is in that wall", not "a door near a wall".
      const tolerance = Math.max(1.5, Math.min(door.width, door.height) * 0.25);
      for (const seg of segs) {
        const cut = cutOnSegment(edge, seg, tolerance + seg.width / 2);
        if (cut) cuts.push(cut);
      }
    }
    if (cuts.length) result.set(s.id, cuts);
  }
  return result;
}
