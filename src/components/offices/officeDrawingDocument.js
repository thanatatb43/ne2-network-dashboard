// Office drawing document (schema v1, see OFFICE_DRAWING_API.md section 5):
// defaults, ids, object factories and whole-document edits that keep the
// document valid (no dangling cable or layer references). Pure: no React.
// Units are paper mm, origin top-left, y down.

export const SCHEMA_VERSION = 1;
export const PAGE_SIZES = { A4: { width: 210, height: 297 }, A3: { width: 297, height: 420 } };
export const BOX_TYPES = ['building', 'room', 'desk', 'door', 'window', 'equipment', 'outlet', 'junction', 'text'];
export const POLYLINE_TYPES = ['wall', 'cable'];
export const KNOWN_TYPES = [...BOX_TYPES, ...POLYLINE_TYPES];
export const ANCHORS = ['center', 'top', 'right', 'bottom', 'left'];
export const DEFAULT_LIMITS = {
  name_max: 200, building_floor_label_max: 200, label_max: 500, text_max: 5000, title_block_field_max: 200,
  objects_max: 2000, layers_max: 30, points_per_polyline_max: 500, legend_items_max: 100,
  coordinate_min: -10000, coordinate_max: 10000, dimension_max: 20000, object_id_max: 64, max_request_bytes: 2097152
};
export const DEFAULT_CABLE_STYLES = [
  { key: 'fiber', label: 'Fiber Optic', stroke: '#F97316', dash: 'solid' },
  { key: 'utp', label: 'UTP/LAN', stroke: '#0EA5E9', dash: 'solid' },
  { key: 'planned', label: 'แนวที่วางแผน', stroke: '#6B7280', dash: 'dashed' },
  { key: 'power', label: 'สายไฟฟ้า', stroke: '#DC2626', dash: 'solid' },
  { key: 'other', label: 'อื่น ๆ', stroke: '#111827', dash: 'dotted' }
];
export const SYMBOL_LABELS = {
  pc: 'คอมพิวเตอร์', notebook: 'Notebook', printer: 'เครื่องพิมพ์', scanner: 'สแกนเนอร์', switch: 'Switch', router: 'Router',
  firewall: 'Firewall', access_point: 'Access Point', rack: 'Rack', server: 'Server', ups: 'UPS', cctv: 'กล้อง CCTV',
  ip_phone: 'IP Phone', generic: 'อุปกรณ์อื่น', outlet: 'Outlet', outlet_lan: 'Outlet LAN', outlet_fiber: 'Outlet Fiber',
  outlet_phone: 'Outlet โทรศัพท์', outlet_power: 'ปลั๊กไฟ', junction: 'จุดต่อสาย'
};
export const TYPE_NAMES = { building: 'อาคาร', room: 'ห้อง', desk: 'โต๊ะ', wall: 'ผนัง', door: 'ประตู', window: 'หน้าต่าง', equipment: 'อุปกรณ์', outlet: 'Outlet', junction: 'จุดต่อสาย', cable: 'แนวสาย', text: 'ข้อความ' };
export const objectName = (o) => o.label || (o.type === 'text' ? String(o.text || '').slice(0, 30) : '') || SYMBOL_LABELS[o.symbol_key] || TYPE_NAMES[o.type] || o.type;

export const TITLE_BLOCK_FIELDS = ['project_name', 'drawing_title', 'location', 'drawing_number', 'revision_label', 'issued_date', 'prepared_by', 'checked_by', 'contact', 'sheet_number'];

// Rendering defaults for a null/omitted style (UI-side assumption, to be
// confirmed with backend; see plan section 15).
export const TYPE_DEFAULTS = {
  building: { stroke: '#111827', fill: null, stroke_width: 0.6, dash: 'solid' },
  room: { stroke: '#374151', fill: null, stroke_width: 0.4, dash: 'solid' },
  desk: { stroke: '#6B7280', fill: '#F3F4F6', stroke_width: 0.3, dash: 'solid' },
  wall: { stroke: '#111827', fill: null, stroke_width: null, dash: 'solid' },
  door: { stroke: '#111827', fill: null, stroke_width: 0.3, dash: 'solid' },
  window: { stroke: '#111827', fill: '#E0F2FE', stroke_width: 0.3, dash: 'solid' },
  equipment: { stroke: '#111827', fill: '#FFFFFF', stroke_width: 0.3, dash: 'solid' },
  outlet: { stroke: '#111827', fill: '#FFFFFF', stroke_width: 0.3, dash: 'solid' },
  junction: { stroke: '#111827', fill: '#111827', stroke_width: 0.3, dash: 'solid' },
  cable: { stroke: '#111827', fill: null, stroke_width: 0.7, dash: 'solid' },
  text: { stroke: null, fill: '#111827', stroke_width: null, dash: 'solid' }
};
// New-object sizes (mm) when placed with a click.
export const DEFAULT_SIZES = {
  building: [80, 50], room: [40, 30], desk: [16, 8], door: [9, 9], window: [12, 3],
  equipment: [8, 8], outlet: [5, 5], junction: [3, 3], text: [40, 8]
};

export const isBox = (o) => BOX_TYPES.includes(o?.type);
export const isPolyline = (o) => POLYLINE_TYPES.includes(o?.type);

export function pageDimensions(size, orientation) {
  const base = PAGE_SIZES[size] || PAGE_SIZES.A4;
  return orientation === 'landscape' ? { width: base.height, height: base.width } : { width: base.width, height: base.height };
}

// Style actually drawn: the object's own values over the type defaults; a
// cable takes its stroke/dash from its cable style first.
export function effectiveStyle(object, cableStyles = DEFAULT_CABLE_STYLES) {
  const base = { ...TYPE_DEFAULTS[object.type] };
  if (object.type === 'cable') {
    const cs = cableStyles.find(c => c.key === object.cable_style_key);
    if (cs) { base.stroke = cs.stroke; base.dash = cs.dash; }
  }
  const own = object.style || {};
  for (const key of ['stroke', 'fill', 'stroke_width', 'dash']) {
    if (own[key] !== undefined && own[key] !== null) base[key] = own[key];
  }
  return base;
}

// ---- ids ----
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

let counter = 0;
export function createId(prefix, taken) {
  const used = taken instanceof Set ? taken : new Set(taken || []);
  for (;;) {
    counter += 1;
    const id = `${String(prefix || 'obj').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 20) || 'obj'}-${Date.now().toString(36)}${counter.toString(36)}`;
    if (!used.has(id)) return id;
  }
}

export const allIds = (doc) => new Set([...(doc.objects || []).map(o => o.id), ...(doc.layers || []).map(l => l.id)]);

// ---- new documents ----
export function emptyTitleBlock(overrides = {}) {
  return { ...Object.fromEntries(TITLE_BLOCK_FIELDS.map(k => [k, null])), logo_key: 'pea', ...overrides };
}

export function newDocument({ size = 'A4', orientation = 'landscape', drawingType = 'floor_plan' } = {}) {
  const { width, height } = pageDimensions(size, orientation);
  const layers = drawingType === 'network_layout'
    ? [['layer-buildings', 'อาคาร'], ['layer-cables', 'แนวสาย'], ['layer-equipment', 'อุปกรณ์'], ['layer-notes', 'ข้อความ']]
    : [['layer-structure', 'โครงสร้าง'], ['layer-furniture', 'เฟอร์นิเจอร์'], ['layer-equipment', 'อุปกรณ์'], ['layer-cables', 'แนวสาย'], ['layer-notes', 'ข้อความ']];
  return {
    page: { size, orientation, width, height, unit: 'mm', margin: 10 },
    grid: { enabled: true, spacing: 5, snap: true },
    scale: { mode: 'schematic', denominator: null },
    title_block: emptyTitleBlock(),
    layers: layers.map(([id, name]) => ({ id, name, visible: true, locked: false })),
    objects: [],
    legend: { visible: true, x: 10, y: 10, items: [] }
  };
}

// Title block sits bottom-right inside the margin (fixed size, mm).
export const TITLE_BLOCK_SIZE = { width: 120, height: 38 };
export function titleBlockRect(page) {
  const m = Number(page.margin) || 0;
  return { x: page.width - m - TITLE_BLOCK_SIZE.width, y: page.height - m - TITLE_BLOCK_SIZE.height, ...TITLE_BLOCK_SIZE };
}

// Legend box (mm): a title row then one row per item.
export const LEGEND_LAYOUT = { width: 70, title: 8, row: 6, pad: 3 };
export function legendRect(legend) {
  if (!legend) return null;
  const n = legend.items?.length || 0;
  return { x: legend.x, y: legend.y, width: LEGEND_LAYOUT.width, height: LEGEND_LAYOUT.title + n * LEGEND_LAYOUT.row + LEGEND_LAYOUT.pad };
}

// ---- object factories ----
export function createBox(type, { x, y, width, height, layerId, taken, ...extra }) {
  const [dw, dh] = DEFAULT_SIZES[type] || [10, 10];
  const object = { id: createId(type, taken), type, layer_id: layerId, x: round(x), y: round(y), width: round(width ?? dw), height: round(height ?? dh), rotation: 0 };
  if (type === 'door') Object.assign(object, { hinge: 'left', swing: 'in' });
  if (type === 'equipment') object.symbol_key = extra.symbol_key || 'generic';
  if (type === 'outlet') object.symbol_key = extra.symbol_key || 'outlet_lan';
  if (type === 'text') Object.assign(object, { text: extra.text ?? 'ข้อความ', font_size: extra.font_size ?? 4, align: 'left' });
  if (extra.label !== undefined) object.label = extra.label;
  return object;
}

export function createPolyline(type, { points, layerId, taken, ...extra }) {
  const object = { id: createId(type, taken), type, layer_id: layerId, points: points.map(p => ({ x: round(p.x), y: round(p.y) })) };
  if (type === 'wall') object.thickness = extra.thickness ?? 2;
  if (type === 'cable') {
    object.cable_style_key = extra.cable_style_key || 'utp';
    object.start = extra.start ?? null;
    object.end = extra.end ?? null;
  }
  return object;
}

// Paper coordinates are stored to 0.1 mm.
export const round = (n) => Math.round(Number(n) * 10) / 10;

// ---- whole-document edits ----
export const replaceObjects = (doc, changed) => {
  if (!changed.size) return doc;
  return { ...doc, objects: doc.objects.map(o => changed.get(o.id) || o) };
};

// Boxes that cables reference, among `ids`.
export function cablesReferencing(doc, ids) {
  const set = ids instanceof Set ? ids : new Set(ids);
  return doc.objects.filter(o => o.type === 'cable' && !set.has(o.id) && ((o.start && set.has(o.start.object_id)) || (o.end && set.has(o.end.object_id))));
}

// Delete objects. Cables pointing at a deleted box are detached (that end
// set to null, the line stays where it is) or deleted with it.
export function deleteObjects(doc, ids, { cables = 'detach' } = {}) {
  const set = new Set(ids);
  const affected = cablesReferencing(doc, set);
  if (cables === 'delete') affected.forEach(c => set.add(c.id));
  const objects = doc.objects.filter(o => !set.has(o.id)).map(o => {
    if (o.type !== 'cable') return o;
    const start = o.start && set.has(o.start.object_id) ? null : o.start;
    const end = o.end && set.has(o.end.object_id) ? null : o.end;
    return start === o.start && end === o.end ? o : { ...o, start, end };
  });
  return { ...doc, objects };
}

// Copies get new ids; references inside the copied set follow the copies,
// references to anything outside it are dropped (the copy would otherwise
// jump back to the original box), and so are equipment links (a copy is a
// new placement, not the same registered device).
export function duplicateObjects(doc, ids, { dx = 5, dy = 5 } = {}) {
  const set = new Set(ids);
  const taken = allIds(doc);
  const map = new Map();
  const sources = doc.objects.filter(o => set.has(o.id));
  for (const o of sources) { const id = createId(o.type, taken); taken.add(id); map.set(o.id, id); }
  const remap = (ref) => (ref && map.has(ref.object_id) ? { ...ref, object_id: map.get(ref.object_id) } : null);
  const copies = sources.map(o => {
    const c = { ...o, id: map.get(o.id) };
    if (isBox(o)) { c.x = round(o.x + dx); c.y = round(o.y + dy); }
    if (isPolyline(o)) c.points = o.points.map(p => ({ x: round(p.x + dx), y: round(p.y + dy) }));
    if (o.type === 'cable') { c.start = remap(o.start); c.end = remap(o.end); }
    if ('asset_ref' in o) c.asset_ref = null;
    if (o.label_position) c.label_position = { ...o.label_position, x: round(o.label_position.x + dx), y: round(o.label_position.y + dy) };
    return c;
  });
  return { doc: { ...doc, objects: [...doc.objects, ...copies] }, ids: copies.map(c => c.id) };
}

// z-order inside the objects array (bring to front = end of array).
export function reorderObjects(doc, ids, where) {
  const set = new Set(ids);
  const moving = doc.objects.filter(o => set.has(o.id));
  const rest = doc.objects.filter(o => !set.has(o.id));
  return { ...doc, objects: where === 'front' ? [...rest, ...moving] : [...moving, ...rest] };
}

// ---- layers ----
export function addLayer(doc, name) {
  const id = createId('layer', allIds(doc));
  return { doc: { ...doc, layers: [...doc.layers, { id, name: name || `ชั้น ${doc.layers.length + 1}`, visible: true, locked: false }] }, id };
}

export const updateLayer = (doc, id, changes) => ({ ...doc, layers: doc.layers.map(l => (l.id === id ? { ...l, ...changes } : l)) });

export function moveLayer(doc, id, delta) {
  const i = doc.layers.findIndex(l => l.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.layers.length) return doc;
  const layers = [...doc.layers];
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return { ...doc, layers };
}

// A layer with objects is removed only by moving them (moveTo) or deleting
// them too; it never leaves objects pointing at a missing layer. The last
// layer can't be removed (schema needs at least one).
export function removeLayer(doc, id, { moveTo = null } = {}) {
  if (doc.layers.length <= 1) return doc;
  const inLayer = doc.objects.filter(o => o.layer_id === id).map(o => o.id);
  let next = doc;
  if (inLayer.length) {
    if (moveTo && moveTo !== id && doc.layers.some(l => l.id === moveTo)) {
      next = { ...doc, objects: doc.objects.map(o => (o.layer_id === id ? { ...o, layer_id: moveTo } : o)) };
    } else {
      next = deleteObjects(doc, inLayer);
    }
  }
  return { ...next, layers: next.layers.filter(l => l.id !== id) };
}

// Drawing order: layer order (first = bottom), then array order inside a layer.
export function renderOrder(doc) {
  const rank = new Map(doc.layers.map((l, i) => [l.id, i]));
  return doc.objects
    .map((o, i) => ({ o, i, r: rank.has(o.layer_id) ? rank.get(o.layer_id) : -1 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.o);
}

export const layerOf = (doc, object) => doc.layers.find(l => l.id === object.layer_id);
export const isVisible = (doc, object) => layerOf(doc, object)?.visible !== false;
export const isEditableObject = (doc, object) => {
  const layer = layerOf(doc, object);
  return Boolean(layer) && layer.visible !== false && !layer.locked;
};

// ---- validation (client side, mirrors the server's rules) ----
const MARKUP = /<\s*[A-Za-z!/?]/;
const URLISH = /(https?:|www\.|data:|javascript:)/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
export function textProblem(value) {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value);
  if (MARKUP.test(s)) return 'ห้ามใส่แท็ก HTML/markup (เช่น <b>) ในข้อความ';
  if (URLISH.test(s)) return 'ห้ามใส่ลิงก์ (http:, https:, www., data:, javascript:) ในข้อความ';
  if (CONTROL.test(s)) return 'ข้อความมีอักขระควบคุมที่ไม่อนุญาต';
  return '';
}

const len = (s) => [...String(s ?? '')].length;

// First problem found, as { path, message, objectId? } -- the same path
// style the server uses (document.objects[3].label), or null when valid.
export function validateDrawing({ meta, doc }, limits = DEFAULT_LIMITS) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const check = (path, value, max, label, objectId) => {
    if (value === null || value === undefined) return null;
    if (len(value) > max) return { path, message: `${label} ยาวเกิน ${max} ตัวอักษร`, objectId };
    const t = textProblem(value);
    return t ? { path, message: `${label}: ${t}`, objectId } : null;
  };
  const name = String(meta.name ?? '').trim();
  if (!name) return { path: 'name', message: 'กรุณาตั้งชื่อแบบ' };
  let p = check('name', name, L.name_max, 'ชื่อแบบ')
    || check('building_label', meta.building_label, L.building_floor_label_max, 'อาคาร')
    || check('floor_label', meta.floor_label, L.building_floor_label_max, 'ชั้น');
  if (p) return p;
  if (doc.objects.length > L.objects_max) return { path: 'document.objects', message: `วัตถุเกิน ${L.objects_max} ชิ้น` };
  if (doc.layers.length < 1 || doc.layers.length > L.layers_max) return { path: 'document.layers', message: `ต้องมี 1–${L.layers_max} ชั้น` };
  const layerIds = new Set(doc.layers.map(l => l.id));
  for (const [i, l] of doc.layers.entries()) {
    if (!String(l.name ?? '').trim()) return { path: `document.layers[${i}].name`, message: 'กรุณาตั้งชื่อชั้น' };
    p = check(`document.layers[${i}].name`, l.name, 100, 'ชื่อชั้น');
    if (p) return p;
  }
  const tb = doc.title_block;
  if (tb) {
    for (const k of TITLE_BLOCK_FIELDS) {
      p = check(`document.title_block.${k}`, tb[k], L.title_block_field_max, 'กรอบชื่อแบบ');
      if (p) return p;
    }
    if (tb.issued_date && !/^\d{4}-\d{2}-\d{2}$/.test(tb.issued_date)) return { path: 'document.title_block.issued_date', message: 'วันที่ออกแบบต้องเป็นรูปแบบ YYYY-MM-DD' };
  }
  const boxIds = new Set(doc.objects.filter(isBox).map(o => o.id));
  const seen = new Set();
  const inRange = (n) => Number.isFinite(n) && n >= L.coordinate_min && n <= L.coordinate_max;
  for (const [i, o] of doc.objects.entries()) {
    const at = `document.objects[${i}]`;
    if (!isValidId(o.id) || seen.has(o.id)) return { path: `${at}.id`, message: 'รหัสวัตถุซ้ำหรือไม่ถูกต้อง', objectId: o.id };
    seen.add(o.id);
    if (!layerIds.has(o.layer_id)) return { path: `${at}.layer_id`, message: 'วัตถุอยู่ในชั้นที่ไม่มีแล้ว', objectId: o.id };
    p = check(`${at}.label`, o.label, L.label_max, 'ป้ายชื่อ', o.id) || (o.type === 'text' ? check(`${at}.text`, o.text, L.text_max, 'ข้อความ', o.id) : null);
    if (p) return p;
    if (o.type === 'text' && !String(o.text ?? '').length) return { path: `${at}.text`, message: 'กล่องข้อความว่าง', objectId: o.id };
    if (isBox(o)) {
      if (!inRange(o.x) || !inRange(o.y)) return { path: `${at}.x`, message: 'ตำแหน่งวัตถุอยู่นอกช่วงที่อนุญาต', objectId: o.id };
      if (!(o.width > 0 && o.width <= L.dimension_max && o.height > 0 && o.height <= L.dimension_max)) return { path: `${at}.width`, message: 'ขนาดวัตถุไม่ถูกต้อง', objectId: o.id };
    }
    if (isPolyline(o)) {
      if (o.points.length < 2 || o.points.length > L.points_per_polyline_max) return { path: `${at}.points`, message: `เส้นต้องมี 2–${L.points_per_polyline_max} จุด`, objectId: o.id };
      if (!o.points.every(pt => inRange(pt.x) && inRange(pt.y))) return { path: `${at}.points`, message: 'จุดของเส้นอยู่นอกช่วงที่อนุญาต', objectId: o.id };
    }
    if (o.type === 'cable') {
      for (const end of ['start', 'end']) {
        if (o[end] && !boxIds.has(o[end].object_id)) return { path: `${at}.${end}.object_id`, message: 'ปลายสายอ้างวัตถุที่ไม่มีแล้ว', objectId: o.id };
      }
    }
  }
  if (doc.legend) {
    if (doc.legend.items.length > L.legend_items_max) return { path: 'document.legend.items', message: `รายการคำอธิบายสัญลักษณ์เกิน ${L.legend_items_max}` };
    for (const [i, item] of doc.legend.items.entries()) {
      p = check(`document.legend.items[${i}].label`, item.label, L.label_max, 'คำอธิบายสัญลักษณ์');
      if (p) return p;
    }
  }
  return null;
}

// Index of the object a server error path points at, if any.
export function objectIndexFromPath(path) {
  const m = /^document\.objects\[(\d+)\]/.exec(String(path || ''));
  return m ? Number(m[1]) : null;
}

export const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

// Object types this UI does not know (a newer schema): rendered as nothing,
// counted so the page can say so -- and never saved over.
export const unknownObjects = (doc) => (doc?.objects || []).filter(o => !KNOWN_TYPES.includes(o.type));
