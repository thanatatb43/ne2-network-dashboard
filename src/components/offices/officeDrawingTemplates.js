// Starting points for a new drawing. They carry shapes and generic labels
// only -- no registered equipment ids, people or office names: the user
// picks the office and links real equipment themselves.
import { createBox, createPolyline, newDocument } from './officeDrawingDocument.js';
import { anchorPoint } from './officeDrawingGeometry.js';

export const TEMPLATES = [
  { key: 'blank', label: 'กระดาษเปล่า', desc: 'เริ่มจากหน้าว่าง เลือกขนาดและแนวกระดาษได้', drawingType: null },
  { key: 'floor_plan', label: 'ผังสำนักงานตัวอย่าง', desc: 'ห้อง ผนัง ประตู หน้าต่าง โต๊ะ และจุดอุปกรณ์', drawingType: 'floor_plan', size: 'A4', orientation: 'landscape' },
  { key: 'network_layout', label: 'ผังเดินสายระหว่างอาคาร', desc: 'กรอบอาคาร เส้น Fiber/UTP/แนวที่วางแผน Outlet และคำอธิบายสัญลักษณ์', drawingType: 'network_layout', size: 'A3', orientation: 'landscape' }
];

function builder(doc) {
  const taken = new Set(doc.layers.map(l => l.id));
  const add = (o) => { taken.add(o.id); doc.objects.push(o); return o; };
  return {
    box: (type, layerId, props) => add(createBox(type, { ...props, layerId, taken })),
    line: (type, layerId, props) => add(createPolyline(type, { ...props, layerId, taken })),
    cable: (layerId, style, a, aAnchor, b, bAnchor, bends = []) => add(createPolyline('cable', {
      layerId, taken, cable_style_key: style,
      points: [anchorPoint(a, aAnchor), ...bends, anchorPoint(b, bAnchor)],
      start: { object_id: a.id, anchor: aAnchor }, end: { object_id: b.id, anchor: bAnchor }
    }))
  };
}

function floorPlan() {
  const doc = newDocument({ size: 'A4', orientation: 'landscape', drawingType: 'floor_plan' });
  const b = builder(doc);
  const S = 'layer-structure'; const F = 'layer-furniture'; const E = 'layer-equipment'; const C = 'layer-cables'; const N = 'layer-notes';
  b.line('wall', S, { points: [{ x: 20, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 150 }, { x: 20, y: 150 }, { x: 20, y: 30 }], thickness: 2 });
  b.line('wall', S, { points: [{ x: 120, y: 30 }, { x: 120, y: 95 }], thickness: 1.5 });
  b.box('room', S, { x: 20, y: 30, width: 100, height: 120, label: 'ห้องทำงาน' });
  b.box('room', S, { x: 120, y: 30, width: 80, height: 65, label: 'ห้องเครือข่าย' });
  b.box('door', S, { x: 60, y: 141, width: 9, height: 9, label: null });
  b.box('door', S, { x: 120.5, y: 100, width: 9, height: 9 });
  b.box('window', S, { x: 45, y: 28.5, width: 20, height: 3 });
  b.box('window', S, { x: 150, y: 148.5, width: 20, height: 3 });
  const rack = b.box('equipment', E, { x: 180, y: 40, width: 10, height: 14, symbol_key: 'rack', label: 'Rack' });
  b.box('equipment', E, { x: 150, y: 40, width: 9, height: 9, symbol_key: 'access_point', label: 'AP' });
  const outlets = [];
  for (const [i, x] of [30, 60, 90].entries()) {
    b.box('desk', F, { x, y: 60, width: 20, height: 10, label: null });
    b.box('equipment', E, { x: x + 6, y: 61, width: 8, height: 8, symbol_key: 'pc', label: `PC ${i + 1}` });
    outlets.push(b.box('outlet', E, { x: x + 8, y: 74, width: 4, height: 4, symbol_key: 'outlet_lan' }));
  }
  outlets.forEach((o, i) => b.cable(C, 'utp', rack, 'bottom', o, 'bottom', [{ x: 185, y: 120 - i * 4 }, { x: o.x + 2, y: 120 - i * 4 }]));
  b.box('text', N, { x: 20, y: 14, width: 120, height: 10, text: 'ผังสำนักงาน (ตัวอย่าง)', font_size: 6 });
  doc.legend = {
    visible: true, x: 210, y: 30,
    items: [
      { kind: 'symbol', symbol_key: 'pc', label: 'คอมพิวเตอร์' },
      { kind: 'symbol', symbol_key: 'access_point', label: 'Access Point' },
      { kind: 'symbol', symbol_key: 'outlet_lan', label: 'Outlet LAN' },
      { kind: 'line', cable_style_key: 'utp', label: 'สาย UTP' }
    ]
  };
  doc.title_block = { ...doc.title_block, drawing_title: 'ผังสำนักงาน' };
  return doc;
}

function networkLayout() {
  const doc = newDocument({ size: 'A3', orientation: 'landscape', drawingType: 'network_layout' });
  const b = builder(doc);
  const B = 'layer-buildings'; const C = 'layer-cables'; const E = 'layer-equipment'; const N = 'layer-notes';
  b.box('building', B, { x: 30, y: 40, width: 110, height: 80, label: 'อาคาร 1' });
  b.box('building', B, { x: 230, y: 40, width: 110, height: 70, label: 'อาคาร 2' });
  b.box('building', B, { x: 120, y: 170, width: 140, height: 70, label: 'อาคาร 3' });
  b.box('room', B, { x: 40, y: 50, width: 40, height: 30, label: 'ห้อง Server' });
  const core = b.box('equipment', E, { x: 52, y: 58, width: 10, height: 10, symbol_key: 'switch', label: 'Core Switch' });
  const sw2 = b.box('equipment', E, { x: 270, y: 60, width: 10, height: 10, symbol_key: 'switch', label: 'Switch' });
  const sw3 = b.box('equipment', E, { x: 180, y: 185, width: 10, height: 10, symbol_key: 'switch', label: 'Switch' });
  const j1 = b.box('junction', C, { x: 183.5, y: 140, width: 3, height: 3, label: 'จุดต่อ' });
  b.cable(C, 'fiber', core, 'right', sw2, 'left', [{ x: 160, y: 63 }, { x: 160, y: 30 }, { x: 255, y: 30 }, { x: 255, y: 65 }]);
  b.cable(C, 'fiber', core, 'bottom', j1, 'left', [{ x: 57, y: 141.5 }]);
  b.cable(C, 'fiber', j1, 'bottom', sw3, 'top');
  const outlets = [
    b.box('outlet', E, { x: 300, y: 90, width: 5, height: 5, symbol_key: 'outlet_lan', label: 'O1' }),
    b.box('outlet', E, { x: 230, y: 215, width: 5, height: 5, symbol_key: 'outlet_lan', label: 'O2' })
  ];
  b.cable(C, 'utp', sw2, 'bottom', outlets[0], 'left', [{ x: 275, y: 92.5 }]);
  b.cable(C, 'utp', sw3, 'right', outlets[1], 'top', [{ x: 232.5, y: 190 }]);
  b.line('cable', C, { points: [{ x: 340, y: 75 }, { x: 380, y: 75 }, { x: 380, y: 160 }], cable_style_key: 'planned' });
  b.box('text', N, { x: 30, y: 16, width: 220, height: 12, text: 'ผังแนวเดินสายเครือข่ายระหว่างอาคาร (ตัวอย่าง)', font_size: 7 });
  doc.legend = {
    visible: true, x: 290, y: 140,
    items: [
      { kind: 'line', cable_style_key: 'fiber', label: 'สาย Fiber Optic' },
      { kind: 'line', cable_style_key: 'utp', label: 'สาย UTP' },
      { kind: 'line', cable_style_key: 'planned', label: 'แนวที่วางแผน' },
      { kind: 'symbol', symbol_key: 'switch', label: 'Switch' },
      { kind: 'symbol', symbol_key: 'outlet_lan', label: 'Outlet LAN' },
      { kind: 'symbol', symbol_key: 'junction', label: 'จุดต่อสาย' }
    ]
  };
  doc.title_block = { ...doc.title_block, drawing_title: 'ผังแนวเดินสายเครือข่าย' };
  return doc;
}

export function templateDocument(key, { size, orientation, drawingType } = {}) {
  if (key === 'floor_plan') return floorPlan();
  if (key === 'network_layout') return networkLayout();
  return newDocument({ size, orientation, drawingType });
}
