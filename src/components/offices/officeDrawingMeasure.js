// Real-world lengths for scaled drawings (schema v2). Geometry always stays
// in paper mm; scale.denominator turns it into real mm (1:100 -> x100).
// Pure: shared by the renderer, the drag labels, the inspector and tests.
import { MEASUREMENT_DEFAULTS, isBox, isPolyline, round } from './officeDrawingDocument.js';

export const isScaledDoc = (doc) => doc?.scale?.mode === 'scaled' && Number.isFinite(doc.scale.denominator);
export const realMm = (paperMm, doc) => (isScaledDoc(doc) ? paperMm * doc.scale.denominator : null);
export const paperMm = (realMillimetres, doc) => (isScaledDoc(doc) ? realMillimetres / doc.scale.denominator : null);

// "auto" picks cm under 1 m (compared before rounding), m from 1 m up.
export function formatReal(real, measurement = MEASUREMENT_DEFAULTS) {
  if (real === null || real === undefined || !Number.isFinite(real)) return '';
  const unit = measurement.display_unit === 'cm' || measurement.display_unit === 'm'
    ? measurement.display_unit
    : Math.abs(real) < 1000 ? 'cm' : 'm';
  const precision = Number.isInteger(measurement.precision) ? measurement.precision : 2;
  const value = unit === 'cm' ? real / 10 : real / 1000;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })} ${unit}`;
}

// Paper mm -> label in the drawing's units, or '' for schematic drawings.
export const formatPaper = (mm, doc) => (isScaledDoc(doc) ? formatReal(realMm(mm, doc), doc.measurement || MEASUREMENT_DEFAULTS) : '');

export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

export function dimensionLength(o) {
  if (o.axis === 'horizontal') return Math.abs(o.end.x - o.start.x);
  if (o.axis === 'vertical') return Math.abs(o.end.y - o.start.y);
  return Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y);
}

// Where a dimension is drawn: the measuring line (a -> b), extension lines
// from the measured points to it, the text position and angle.
export function dimensionGeometry(o) {
  const { start: s, end: e, offset = 0 } = o;
  let a; let b; let angle;
  if (o.axis === 'horizontal') {
    const y = s.y + offset;
    a = { x: s.x, y }; b = { x: e.x, y }; angle = 0;
  } else if (o.axis === 'vertical') {
    const x = s.x + offset;
    a = { x, y: s.y }; b = { x, y: e.y }; angle = -90;
  } else {
    const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
    const n = { x: -(e.y - s.y) / len, y: (e.x - s.x) / len };
    a = { x: s.x + n.x * offset, y: s.y + n.y * offset };
    b = { x: e.x + n.x * offset, y: e.y + n.y * offset };
    angle = Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI;
  }
  // Keep the text upright (never upside down).
  if (angle > 90) angle -= 180;
  if (angle <= -90 && o.axis !== 'vertical') angle += 180;
  return { a, b, ext: [[s, a], [e, b]], mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, angle };
}

export const dimensionLabel = (o, doc) => formatPaper(dimensionLength(o), doc);

// Live label while drawing/resizing (scaled drawings only).
export function sizeLabel(width, height, doc) {
  if (!isScaledDoc(doc)) return '';
  return `${formatPaper(width, doc)} × ${formatPaper(height, doc)}`;
}

// Grid spacing typed as a real distance -> paper mm, and back.
export const gridRealLabel = (doc) => formatPaper(doc.grid?.spacing || 0, doc);

// Change 1:A -> 1:B keeping real distances: geometry, grid and dimension
// offsets are multiplied by A/B around the paper origin. What is a printed
// convention stays as it is on paper: font sizes, stroke widths, wall
// thickness, symbol sizes (their centres move), text box sizes, legend and
// title block. The caller re-attaches cables/dimensions afterwards.
const SYMBOL_TYPES = new Set(['equipment', 'outlet', 'junction', 'text']);
export function rescaleDocument(doc, fromDenominator, toDenominator) {
  const k = fromDenominator / toDenominator;
  if (!Number.isFinite(k) || k <= 0 || k === 1) return { ...doc, scale: { mode: 'scaled', denominator: toDenominator } };
  const pt = (p) => ({ x: round(p.x * k), y: round(p.y * k) });
  const objects = doc.objects.map(o => {
    if (isBox(o)) {
      if (SYMBOL_TYPES.has(o.type)) {
        const cx = (o.x + o.width / 2) * k;
        const cy = (o.y + o.height / 2) * k;
        return { ...o, x: round(cx - o.width / 2), y: round(cy - o.height / 2) };
      }
      return { ...o, x: round(o.x * k), y: round(o.y * k), width: round(o.width * k), height: round(o.height * k) };
    }
    if (isPolyline(o)) {
      const next = { ...o, points: o.points.map(pt) };
      if (o.label_position) next.label_position = { ...o.label_position, ...pt(o.label_position) };
      return next;
    }
    if (o.type === 'dimension') return { ...o, start: pt(o.start), end: pt(o.end), offset: round(o.offset * k) };
    return o;
  });
  const spacing = Math.min(100, Math.max(0.1, round((doc.grid?.spacing || 5) * k)));
  return { ...doc, scale: { mode: 'scaled', denominator: toDenominator }, grid: { ...doc.grid, spacing }, objects };
}
