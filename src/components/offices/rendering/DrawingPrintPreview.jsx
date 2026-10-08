import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Printer, X } from 'lucide-react';
import { layoutWarnings, printImageStatus, preloadPrintImages } from '../officeDrawingPrint.js';
import useDialogFocus from '../../common/useDialogFocus.js';
import DrawingSheet from './DrawingRenderer.jsx';

export default function DrawingPrintPreview({ doc, cableStyles, siteName, title, imageSources, onClose }) {
  const ref = useRef(null);
  const printRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  const [printError, setPrintError] = useState('');
  const pending = useRef(null);
  const imageStatus = printImageStatus(doc, imageSources);
  useDialogFocus(true, ref, onClose);
  const warnings = useMemo(() => layoutWarnings(doc), [doc]);
  const { size, orientation } = doc.page;

  useEffect(() => () => {
    pending.current?.abort();
    document.body.classList.remove('od-printing');
    document.getElementById('od-print-page')?.remove();
  }, []);

  // Fonts and the logo must be ready, or the PDF gets fallback glyphs and an
  // empty logo box.
  const print = async () => {
    if (pending.current || imageStatus.loading || imageStatus.failed) return;
    const controller = new AbortController();
    pending.current = controller;
    setPreparing(true);
    setPrintError('');
    try {
      await document.fonts?.ready;
      if (controller.signal.aborted) return;
      const hrefs = [...(printRef.current?.querySelectorAll('image') || [])].map(i => i.getAttribute('href')).filter(Boolean);
      await preloadPrintImages(hrefs, { signal: controller.signal });
      if (controller.signal.aborted) return;
    } catch {
      controller.abort();
      if (printRef.current) setPrintError('โหลดรูปภาพสำหรับพิมพ์ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วกดพิมพ์อีกครั้ง');
      return;
    } finally {
      pending.current = null;
      if (printRef.current) setPreparing(false);
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
            <button type="button" className="list-button list-button-primary" onClick={print} disabled={preparing || imageStatus.loading > 0 || imageStatus.failed > 0}>
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
        {(imageStatus.loading > 0 || imageStatus.failed > 0 || printError) && (
          <div className="od-preview-warn" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              {imageStatus.loading > 0 && <p>กำลังโหลดรูปภาพ {imageStatus.loading} รูป กรุณารอให้โหลดครบก่อนพิมพ์</p>}
              {imageStatus.failed > 0 && <p>โหลดรูปภาพไม่ได้ {imageStatus.failed} รูป กรุณาปิดหน้าพิมพ์แล้วโหลดแบบใหม่ หรือแก้ไขรูปภาพก่อนพิมพ์</p>}
              {printError && <p>{printError}</p>}
            </div>
          </div>
        )}
        <div className="od-preview-stage">
          <div className="od-preview-paper">
            <DrawingSheet doc={doc} cableStyles={cableStyles} siteName={siteName} mode="preview" scale={2} imageSources={imageSources} />
          </div>
        </div>
      </div>
      <div ref={printRef} className="od-print-root" aria-hidden="true">
        <DrawingSheet doc={doc} cableStyles={cableStyles} siteName={siteName} mode="print" imageSources={imageSources} />
      </div>
    </div>,
    document.body
  );
}
