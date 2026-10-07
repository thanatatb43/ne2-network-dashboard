import { memo, useId } from 'react';
import { DEFAULT_CABLE_STYLES, effectiveStyle, isBox, isVisible, renderOrder, KNOWN_TYPES } from '../officeDrawingDocument.js';
import { boxCenter, polylineMidpoint } from '../officeDrawingGeometry.js';
import { SymbolGlyph } from './DrawingSymbols.jsx';
import DrawingLegend from './DrawingLegend.jsx';
import DrawingTitleBlock from './DrawingTitleBlock.jsx';
import { dashArray } from './dashArray.js';

const LABEL_SIZE = 3;
const halo = { paintOrder: 'stroke', stroke: '#FFFFFF', strokeWidth: 0.8, strokeLinejoin: 'round' };

function BoxLabel({ o, position = 'center', bold = false }) {
  if (!o.label) return null;
  const c = boxCenter(o);
  const at = {
    center: { x: c.x, y: c.y + LABEL_SIZE / 3, anchor: 'middle' },
    topleft: { x: o.x + 2, y: o.y + LABEL_SIZE + 1.5, anchor: 'start' },
    below: { x: c.x, y: o.y + o.height + LABEL_SIZE + 0.5, anchor: 'middle' }
  }[position];
  return <text x={at.x} y={at.y} textAnchor={at.anchor} fontSize={LABEL_SIZE} fontWeight={bold ? 700 : 400} fill="#111827" style={halo}>{o.label}</text>;
}

// Door: drawn for hinge=left, swing=in (hinge bottom-left, opens upward
// into the box) and mirrored for the other cases.
function Door({ o, st }) {
  const { x, y, width: w, height: h } = o;
  const sx = o.hinge === 'right' ? -1 : 1;
  const sy = o.swing === 'out' ? -1 : 1;
  const c = boxCenter(o);
  const mirror = `translate(${c.x} ${c.y}) scale(${sx} ${sy}) translate(${-c.x} ${-c.y})`;
  return (
    <g transform={mirror} fill="none" stroke={st.stroke} strokeWidth={st.stroke_width}>
      <line x1={x} y1={y + h} x2={x} y2={y} />
      <path d={`M ${x} ${y} A ${w} ${h} 0 0 1 ${x + w} ${y + h}`} strokeDasharray={dashArray('dashed', st.stroke_width)} />
      <line x1={x} y1={y + h} x2={x + w} y2={y + h} strokeWidth={st.stroke_width * 2} />
    </g>
  );
}

function BoxShape({ o, st }) {
  const common = { stroke: st.stroke || 'none', strokeWidth: st.stroke_width || 0, fill: st.fill || 'none', strokeDasharray: dashArray(st.dash, st.stroke_width) };
  switch (o.type) {
    case 'building':
      return <><rect x={o.x} y={o.y} width={o.width} height={o.height} {...common} /><BoxLabel o={o} position="topleft" bold /></>;
    case 'room':
      return <><rect x={o.x} y={o.y} width={o.width} height={o.height} {...common} /><BoxLabel o={o} position="topleft" /></>;
    case 'desk':
      return <><rect x={o.x} y={o.y} width={o.width} height={o.height} rx=".5" {...common} /><BoxLabel o={o} /></>;
    case 'window':
      return <><rect x={o.x} y={o.y} width={o.width} height={o.height} {...common} /><line x1={o.x} y1={o.y + o.height / 2} x2={o.x + o.width} y2={o.y + o.height / 2} stroke={st.stroke} strokeWidth={st.stroke_width} /><BoxLabel o={o} position="below" /></>;
    case 'door':
      return <><Door o={o} st={st} /><BoxLabel o={o} position="below" /></>;
    case 'equipment':
    case 'outlet':
      return <><SymbolGlyph symbolKey={o.symbol_key} x={o.x} y={o.y} width={o.width} height={o.height} stroke={st.stroke} fill={st.fill} /><BoxLabel o={o} position="below" /></>;
    case 'junction':
      return <><ellipse cx={o.x + o.width / 2} cy={o.y + o.height / 2} rx={o.width / 2} ry={o.height / 2} fill={st.fill || st.stroke} stroke={st.stroke} strokeWidth={st.stroke_width} /><BoxLabel o={o} position="below" /></>;
    case 'text':
      return (
        <foreignObject x={o.x} y={o.y} width={o.width} height={o.height}>
          <div xmlns="http://www.w3.org/1999/xhtml" className="od-text" style={{ fontSize: `${o.font_size}px`, textAlign: o.align || 'left', color: st.fill || '#111827' }}>{o.text}</div>
        </foreignObject>
      );
    default:
      return null;
  }
}

function Polyline({ o, st }) {
  const pts = o.points.map(p => `${p.x},${p.y}`).join(' ');
  if (o.type === 'wall') {
    return <polyline points={pts} fill="none" stroke={st.stroke} strokeWidth={o.thickness} strokeLinejoin="miter" strokeLinecap="square" strokeDasharray={dashArray(st.dash, o.thickness)} />;
  }
  const label = [o.label, o.measured_length_m !== null && o.measured_length_m !== undefined ? `${o.measured_length_m} ม.` : null].filter(Boolean).join(' · ');
  const at = o.label_position || polylineMidpoint(o.points);
  return (
    <>
      <polyline points={pts} fill="none" stroke={st.stroke} strokeWidth={st.stroke_width} strokeDasharray={dashArray(st.dash, st.stroke_width)}
        strokeLinecap={st.dash === 'dotted' ? 'round' : 'butt'} strokeLinejoin="round" />
      {label && (
        <text x={at.x} y={at.y - 1} textAnchor="middle" fontSize={2.6} fill="#111827" style={halo}
          transform={o.label_position?.rotation ? `rotate(${o.label_position.rotation} ${at.x} ${at.y})` : undefined}>{label}</text>
      )}
    </>
  );
}

// One object. Memoized on the object itself: a drag re-renders only what moved.
export const DrawingObject = memo(function DrawingObject({ object: o, cableStyles, linkState }) {
  const st = effectiveStyle(o, cableStyles);
  const rotate = isBox(o) && o.rotation ? `rotate(${o.rotation} ${o.x + o.width / 2} ${o.y + o.height / 2})` : undefined;
  return (
    <g data-id={o.id} data-type={o.type} transform={rotate}>
      {isBox(o) ? <BoxShape o={o} st={st} /> : <Polyline o={o} st={st} />}
      {linkState && linkState !== 'available' && isBox(o) && (
        <g className="od-link-warning" aria-hidden="true">
          <circle cx={o.x + o.width} cy={o.y} r="1.6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth=".3" />
          <text x={o.x + o.width} y={o.y + 0.9} textAnchor="middle" fontSize="2.4" fontWeight="700" fill="#FFFFFF">!</text>
        </g>
      )}
    </g>
  );
});

// The paper: white sheet, optional grid and margin guide, objects in render
// order (hidden layers left out), legend and title block. `scale` is screen
// px per mm; in print the sheet is sized in real mm instead.
export default function DrawingSheet({ doc, cableStyles = DEFAULT_CABLE_STYLES, siteName, mode = 'view', scale = 3, showGrid = false, linkStates = null, svgRef, children, svgProps = {} }) {
  const { width: W, height: H, margin = 0 } = doc.page;
  const print = mode === 'print';
  const spacing = doc.grid?.spacing || 5;
  const uid = useId().replace(/:/g, '');
  const objects = renderOrder(doc).filter(o => KNOWN_TYPES.includes(o.type) && isVisible(doc, o));
  return (
    <svg ref={svgRef} className={`od-sheet od-sheet-${mode}`} xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`} width={print ? `${W}mm` : W * scale} height={print ? `${H}mm` : H * scale}
      role="img" aria-label="ผังแบบ" {...svgProps}>
      <defs>
        <clipPath id={`${uid}-clip`}><rect x="0" y="0" width={W} height={H} /></clipPath>
        {showGrid && (
          <pattern id={`${uid}-grid`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <path d={`M ${spacing} 0 L 0 0 0 ${spacing}`} fill="none" stroke="#CBD5E1" strokeWidth=".1" />
          </pattern>
        )}
      </defs>
      <rect className="od-paper" x="0" y="0" width={W} height={H} fill="#FFFFFF" />
      {showGrid && <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-grid)`} pointerEvents="none" />}
      {mode === 'edit' && margin > 0 && <rect x={margin} y={margin} width={W - 2 * margin} height={H - 2 * margin} fill="none" stroke="#94A3B8" strokeWidth=".2" strokeDasharray="1.5 1.5" pointerEvents="none" />}
      <g clipPath={print ? `url(#${uid}-clip)` : undefined} className="od-objects">
        {objects.map(o => <DrawingObject key={o.id} object={o} cableStyles={cableStyles} linkState={linkStates?.get(o.id)} />)}
        <DrawingLegend legend={doc.legend} cableStyles={cableStyles} />
        <DrawingTitleBlock page={doc.page} titleBlock={doc.title_block} siteName={siteName} />
      </g>
      {children}
    </svg>
  );
}
