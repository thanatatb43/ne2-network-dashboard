import peaLogo from '../../../assets/logo/pea_logo.png';
import { titleBlockRect } from '../officeDrawingDocument.js';

const LOGOS = { pea: peaLogo };

// Font size (mm) that keeps a value inside its cell: long text steps down
// instead of running past the border. Character counts are rough widths for
// Thai/Latin mixed text at the given box width.
function fit(text, base, roomChars) {
  const n = [...String(text || '')].length;
  if (n <= roomChars) return base;
  if (n <= roomChars * 1.5) return base * 0.82;
  if (n <= roomChars * 2.2) return base * 0.68;
  return base * 0.58;
}

const scaleText = (scale) => (scale?.mode === 'scaled' && scale.denominator ? `1:${scale.denominator}` : 'ไม่ตามมาตราส่วน');

// Bottom-right title block. HTML inside foreignObject so Thai text wraps the
// same way in the editor and in print; 10 CSS px = 1 mm to avoid subpixel border rounding.
export default function DrawingTitleBlock({ page, titleBlock, siteName, scale }) {
  if (!titleBlock) return null;
  const r = titleBlockRect(page);
  const tb = titleBlock;
  // The logo is an SVG <image> (an <img> inside foreignObject may not print).
  const logo = tb.logo_key && LOGOS[tb.logo_key];
  const v = (k) => tb[k] || '';
  const project = v('project_name') || siteName || '';
  const title = v('drawing_title');
  const cell = (label, value, { span = 1, room = 16 } = {}) => (
    <div className="od-tb-cell" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
      <span className="od-tb-label">{label}</span>
      <span className="od-tb-value" style={{ fontSize: `${fit(value, 23, room * span)}px` }}>{value || ' '}</span>
    </div>
  );
  return (
    <g className="od-titleblock" data-id="__titleblock">
      <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#FFFFFF" stroke="#111827" strokeWidth=".4" />
      <foreignObject x={r.x} y={r.y} width={r.width} height={r.height}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="od-tb">
          <div className={`od-tb-head${logo ? ' has-logo' : ''}`}>
            <div className="od-tb-titles">
              <div className="od-tb-project" style={{ fontSize: `${fit(project, 26, 52)}px` }}>{project}</div>
              <div className="od-tb-title" style={{ fontSize: `${fit(title, 36, 34)}px` }}>{title}</div>
            </div>
          </div>
          <div className="od-tb-grid">
            {cell('สถานที่', v('location') || siteName, { span: 3 })}
            {cell('เลขที่แบบ', v('drawing_number'))}
            {cell('แก้ไขครั้งที่', v('revision_label'))}
            {cell('วันที่', v('issued_date'))}
            {cell('ผู้จัดทำ', v('prepared_by'))}
            {cell('ผู้ตรวจ', v('checked_by'))}
            {cell('แผ่นที่', v('sheet_number'))}
            {cell('ติดต่อ', v('contact'), { span: 2 })}
            {cell('มาตราส่วน', scaleText(scale))}
          </div>
        </div>
      </foreignObject>
      {logo && <image href={logo} x={r.x + 1.5} y={r.y + 1} width="9" height="9" preserveAspectRatio="xMidYMid meet" />}
    </g>
  );
}
