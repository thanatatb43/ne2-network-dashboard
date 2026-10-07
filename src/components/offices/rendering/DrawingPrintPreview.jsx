import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Printer, X } from 'lucide-react';
import { isBox, isVisible, renderOrder, titleBlockRect, KNOWN_TYPES, objectName } from '../officeDrawingDocument.js';
import { boxCorners } from '../officeDrawingGeometry.js';
import useDialogFocus from '../../common/useDialogFocus.js';
import DrawingSheet from './DrawingRenderer.jsx';

// What would print badly: outside the paper, or under the title block.
// Shown before printing; positions are never changed automatically.
function layoutWarnings(doc) {
  const { width: W, height: H } = doc.page;
  const tb = doc.title_block ? titleBlockRect(doc.page) : null;
  const out = [];
  const under = [];
  for (const o of renderOrder(doc)) {
    if (!KNOWN_TYPES.includes(o.type) || !isVisible(doc, o)) continue;
    const pts = isBox(o) ? boxCorners(o) : o.points;
    if (pts.some(p => p.x < 0 || p.y < 0 || p.x > W || p.y > H)) out.push(objectName(o));
    else if (tb && pts.some(p => p.x > tb.x && p.x < tb.x + tb.width && p.y > tb.y && p.y < tb.y + tb.height)) under.push(objectName(o));
  }
  return { out, under };
}

export default function DrawingPrintPreview({ doc, cableStyles, siteName, title, onClose }) {
  const ref = useRef(null);
  const printRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  useDialogFocus(true, ref, onClose);
  const warnings = useMemo(() => layoutWarnings(doc), [doc]);
  const { size, orientation } = doc.page;

  useEffect(() => () => {
    document.body.classList.remove('od-printing');
    document.getElementById('od-print-page')?.remove();
  }, []);

  // Fonts and the logo must be ready, or the PDF gets fallback glyphs and an
  // empty logo box.
  const print = async () => {
    setPreparing(true);
    try {
      await document.fonts?.ready;
      // SVG <image> elements have no decode(): load each href once.
      const hrefs = [...new Set([...(printRef.current?.querySelectorAll('image') || [])].map(i => i.getAttribute('href')).filter(Boolean))];
      await Promise.all(hrefs.map(src => new Promise(done => { const img = new Image(); img.onload = done; img.onerror = done; img.src = src; })));
    } finally {
      setPreparing(false);
    }
    let style = document.getElementById('od-print-page');
    if (!style) { style = document.createElement('style'); style.id = 'od-print-page'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${size} ${orientation}; margin: 0; }`;
    document.body.classList.add('od-printing');
    const done = () => { document.body.classList.remove('od-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return createPortal(
    <div className="od-preview-backdrop">
      <div ref={ref} className="od-preview" role="dialog" aria-modal="true" aria-labelledby="od-preview-title">
        <header className="od-preview-head">
          <div>
            <h2 id="od-preview-title">ตัวอย่างก่อนพิมพ์</h2>
            <p>{title} · กระดาษ {size} {orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}</p>
          </div>
          <div className="od-preview-actions">
            <button type="button" className="list-button list-button-primary" onClick={print} disabled={preparing}>
              {preparing ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Printer size={18} aria-hidden="true" />} พิมพ์ / บันทึก PDF
            </button>
            <button type="button" className="list-button" onClick={onClose} data-autofocus><X size={18} aria-hidden="true" /> ปิด</button>
          </div>
        </header>
        <p className="od-preview-hint">ในหน้าต่างพิมพ์ให้เลือกกระดาษ <strong>{size} {orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}</strong> ระยะขอบ “ไม่มี” และปิด “ส่วนหัวและส่วนท้าย” หากไม่ต้องการ URL/วันที่ของ browser บนกระดาษ</p>
        {(warnings.out.length > 0 || warnings.under.length > 0) && (
          <div className="od-preview-warn" role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              {warnings.out.length > 0 && <p>อยู่นอกขอบกระดาษ (จะถูกตัด) {warnings.out.length} ชิ้น: {warnings.out.slice(0, 5).join(', ')}{warnings.out.length > 5 ? ' …' : ''}</p>}
              {warnings.under.length > 0 && <p>ทับกรอบชื่อแบบ {warnings.under.length} ชิ้น: {warnings.under.slice(0, 5).join(', ')}{warnings.under.length > 5 ? ' …' : ''}</p>}
              <p>ระบบไม่ย้ายตำแหน่งให้อัตโนมัติ กลับไปแก้ในผังได้</p>
            </div>
          </div>
        )}
        <div className="od-preview-stage">
          <div className="od-preview-paper">
            <DrawingSheet doc={doc} cableStyles={cableStyles} siteName={siteName} mode="preview" scale={2} />
          </div>
        </div>
      </div>
      <div ref={printRef} className="od-print-root" aria-hidden="true">
        <DrawingSheet doc={doc} cableStyles={cableStyles} siteName={siteName} mode="print" />
      </div>
    </div>,
    document.body
  );
}
