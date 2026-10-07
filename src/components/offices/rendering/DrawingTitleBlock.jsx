import peaLogo from '../../../assets/logo/pea_logo.png';
import { titleBlockRect } from '../officeDrawingDocument.js';

const LOGOS = { pea: peaLogo };

// Bottom-right title block. HTML inside foreignObject so Thai text wraps
// the same way in the editor and in print; 1 CSS px = 1 mm here.
export default function DrawingTitleBlock({ page, titleBlock, siteName }) {
  if (!titleBlock) return null;
  const r = titleBlockRect(page);
  const tb = titleBlock;
  // The logo is an SVG <image> (an <img> inside foreignObject may not print).
  const logo = tb.logo_key && LOGOS[tb.logo_key];
  const v = (k) => tb[k] || '';
  const cell = (label, value, extra = {}) => (
    <div className="od-tb-cell" style={extra}>
      <span className="od-tb-label">{label}</span>
      <span className="od-tb-value">{value || ' '}</span>
    </div>
  );
  return (
    <g className="od-titleblock" data-id="__titleblock">
      <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#FFFFFF" stroke="#111827" strokeWidth=".4" />
      <foreignObject x={r.x} y={r.y} width={r.width} height={r.height}>
        <div xmlns="http://www.w3.org/1999/xhtml" className="od-tb">
          <div className={`od-tb-head${logo ? ' has-logo' : ''}`}>
            <div className="od-tb-titles">
              <div className="od-tb-project">{v('project_name') || siteName || ''}</div>
              <div className="od-tb-title">{v('drawing_title')}</div>
            </div>
          </div>
          <div className="od-tb-grid">
            {cell('สถานที่', v('location') || siteName, { gridColumn: '1 / -1' })}
            {cell('เลขที่แบบ', v('drawing_number'))}
            {cell('แก้ไขครั้งที่', v('revision_label'))}
            {cell('วันที่', v('issued_date'))}
            {cell('ผู้จัดทำ', v('prepared_by'))}
            {cell('ผู้ตรวจ', v('checked_by'))}
            {cell('แผ่นที่', v('sheet_number'))}
            {cell('ติดต่อ', v('contact'), { gridColumn: '1 / -1' })}
          </div>
        </div>
      </foreignObject>
      {logo && <image href={logo} x={r.x + 1.5} y={r.y + 1} width="9" height="9" preserveAspectRatio="xMidYMid meet" />}
    </g>
  );
}
