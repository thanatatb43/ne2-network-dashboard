// Built-in symbols, drawn in a 10x10 unit box and scaled into the object's
// box. Line-based and labelled with letters where shape alone is not enough,
// so they stay readable printed in black and white. Never takes markup from
// the document: only these keys render.

const S = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

const letterBox = (letter) => (
  <>
    <rect x="1" y="1" width="8" height="8" rx="1" />
    <text x="5" y="7.2" textAnchor="middle" fontSize="5.5" fontWeight="700" stroke="none" fill="currentColor">{letter}</text>
  </>
);

const SHAPES = {
  pc: <><rect x="1" y="1.5" width="8" height="5.5" rx=".5" /><path d="M5 7v1.5M3 8.5h4" /></>,
  notebook: <><rect x="2" y="2" width="6" height="4.5" rx=".4" /><path d="M1 8h8l-1-1.5H2z" /></>,
  printer: <><rect x="3" y="1.5" width="4" height="2.5" /><rect x="1.5" y="4" width="7" height="3.5" rx=".5" /><rect x="3" y="7.5" width="4" height="1.5" /></>,
  scanner: <><rect x="1" y="4" width="8" height="3" rx=".5" /><path d="M1.5 5.5h7M2 4l1-2h4" /></>,
  switch: <><rect x=".5" y="3" width="9" height="4" rx=".5" /><path d="M2 5h1M4 5h1M6 5h1M8 5h.5" /><path d="M2 2l1.5-1M8 2L6.5 1" /></>,
  router: <><circle cx="5" cy="5" r="4" /><path d="M2.6 5h4.8M6.2 3.8L7.4 5 6.2 6.2M5 2.6v4.8M3.8 3.8L5 2.6 6.2 3.8" /></>,
  firewall: <><rect x="1" y="2" width="8" height="6" /><path d="M1 4h8M1 6h8M4 2v2M7 2v2M2.5 4v2M5.5 4v2M8 4v2M4 6v2M7 6v2" /></>,
  access_point: <><circle cx="5" cy="7.5" r=".7" fill="currentColor" /><path d="M3.3 5.8a2.4 2.4 0 0 1 3.4 0M2 4.4a4.3 4.3 0 0 1 6 0M.8 3a6 6 0 0 1 8.4 0" /></>,
  rack: <><rect x="2" y=".5" width="6" height="9" /><path d="M2 2.5h6M2 4.5h6M2 6.5h6M2 8.5h6" /></>,
  server: <><rect x="2" y="1" width="6" height="8" rx=".5" /><path d="M2 3.7h6M2 6.3h6" /><circle cx="6.8" cy="2.4" r=".3" fill="currentColor" /><circle cx="6.8" cy="5" r=".3" fill="currentColor" /></>,
  ups: <><rect x="1" y="2.5" width="8" height="5" rx=".5" /><path d="M5.5 3.3L3.8 5.2h2.4L4.5 6.9" /><path d="M9 4.2h.6v1.6H9" /></>,
  cctv: <><path d="M1 3.5l6-2 1 3-6 2z" /><path d="M5 5.5L5.5 8M3.5 8.5h4M8 3l1.3-.5" /></>,
  ip_phone: <><rect x="2.5" y="1" width="5" height="8" rx=".8" /><rect x="3.3" y="2" width="3.4" height="2" /><path d="M3.5 5.5h.4M5 5.5h.4M6.5 5.5h.4M3.5 7h.4M5 7h.4M6.5 7h.4" /></>,
  generic: <><circle cx="5" cy="5" r="4" /><circle cx="5" cy="5" r="1" fill="currentColor" /></>,
  outlet: <><rect x="1" y="1" width="8" height="8" rx="1" /><path d="M3.8 3.8v2.4M6.2 3.8v2.4" /></>,
  outlet_lan: letterBox('L'),
  outlet_fiber: letterBox('F'),
  outlet_phone: letterBox('T'),
  outlet_power: letterBox('P'),
  junction: <circle cx="5" cy="5" r="3" fill="currentColor" />
};

// Symbol drawn into a box (paper mm). stroke/fill come from the object's
// effective style; the background keeps symbols legible over lines.
export function SymbolGlyph({ symbolKey, x, y, width, height, stroke = '#111827', fill = '#FFFFFF' }) {
  const shape = SHAPES[symbolKey] || SHAPES.generic;
  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 10 10" overflow="visible" style={{ color: stroke }}>
      {fill && symbolKey !== 'junction' && <rect x=".2" y=".2" width="9.6" height="9.6" rx="1" fill={fill} stroke="none" />}
      <g {...S} stroke="currentColor" strokeWidth=".6">{shape}</g>
    </svg>
  );
}

// Small swatch for toolbars / pickers (screen px).
export function SymbolIcon({ symbolKey, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={{ color: 'currentColor' }}>
      <g {...S} stroke="currentColor" strokeWidth=".7">{SHAPES[symbolKey] || SHAPES.generic}</g>
    </svg>
  );
}
