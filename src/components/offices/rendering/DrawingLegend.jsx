import { LEGEND_LAYOUT, legendRect, DEFAULT_CABLE_STYLES } from '../officeDrawingDocument.js';
import { SymbolGlyph } from './DrawingSymbols.jsx';
import { dashArray } from './dashArray.js';

// "คำอธิบายสัญลักษณ์" box. Items describe what the symbols and line styles
// mean; they are not a count of what is on the drawing.
export default function DrawingLegend({ legend, cableStyles = DEFAULT_CABLE_STYLES }) {
  if (!legend || legend.visible === false || !legend.items?.length) return null;
  const r = legendRect(legend);
  const { title, row, pad } = LEGEND_LAYOUT;
  return (
    <g className="od-legend" data-id="__legend">
      <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#FFFFFF" stroke="#111827" strokeWidth=".3" />
      <text x={r.x + pad} y={r.y + 5.5} fontSize="3.6" fontWeight="700" fill="#111827">คำอธิบายสัญลักษณ์</text>
      <line x1={r.x} y1={r.y + title - 0.5} x2={r.x + r.width} y2={r.y + title - 0.5} stroke="#111827" strokeWidth=".2" />
      {legend.items.map((item, i) => {
        const y = r.y + title + i * row;
        const cy = y + row / 2;
        let sample = null;
        if (item.kind === 'line') {
          const cs = cableStyles.find(c => c.key === item.cable_style_key) || { stroke: '#111827', dash: 'solid' };
          sample = <line x1={r.x + pad} y1={cy} x2={r.x + pad + 12} y2={cy} stroke={cs.stroke} strokeWidth=".8" strokeDasharray={dashArray(cs.dash, 0.8)} strokeLinecap={cs.dash === 'dotted' ? 'round' : 'butt'} />;
        } else {
          sample = <SymbolGlyph symbolKey={item.symbol_key} x={r.x + pad + 3.5} y={cy - 2.5} width={5} height={5} />;
        }
        return (
          <g key={i}>
            {sample}
            <text x={r.x + pad + 15} y={cy + 1.2} fontSize="3" fill="#111827">{item.label}</text>
          </g>
        );
      })}
    </g>
  );
}
