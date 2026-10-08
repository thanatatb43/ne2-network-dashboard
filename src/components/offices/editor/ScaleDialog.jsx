import { useState } from 'react';
import { Ruler } from 'lucide-react';
import ModalFrame from '../../common/ModalFrame.jsx';
import { reattachCables } from '../officeDrawingGeometry.js';
import { formatReal, rescaleDocument } from '../officeDrawingMeasure.js';

const PRESETS = [20, 50, 100, 200, 500, 1000];

// Setting or changing a drawing's scale. Geometry stays paper mm: the first
// scale only gives the existing shapes a real-world meaning (no
// calibration from images); 1:A -> 1:B offers "keep real distances" (resize
// on paper by A/B, the default) or "keep paper sizes" (real distances
// change). Going back to schematic is refused while dimensions exist.
export default function ScaleDialog({ doc, onApply, onClose }) {
  const current = doc.scale?.mode === 'scaled' ? doc.scale.denominator : null;
  const [mode, setMode] = useState('scaled');
  const [text, setText] = useState(String(current || 100));
  const [keep, setKeep] = useState('real');
  const denominator = Number(text);
  const valid = Number.isInteger(denominator) && denominator >= 1 && denominator <= 10000;
  const dims = doc.objects.filter(o => o.type === 'dimension').length;
  const changing = Boolean(current) && mode === 'scaled' && valid && denominator !== current;
  const toSchematic = mode === 'schematic';
  const sample = 50; // mm on paper, for the example line

  const apply = () => {
    if (toSchematic) { onApply({ ...doc, scale: { mode: 'schematic', denominator: null } }); return; }
    if (!valid) return;
    if (!current) { onApply({ ...doc, scale: { mode: 'scaled', denominator } }); return; }
    if (denominator === current) { onClose(); return; }
    onApply(keep === 'real'
      ? reattachCables(rescaleDocument(doc, current, denominator))
      : { ...doc, scale: { mode: 'scaled', denominator } });
  };

  return (
    <ModalFrame title="มาตราส่วนของแบบ" icon={<Ruler size={20} aria-hidden="true" />} size="lg" onClose={onClose}
      subtitle={current ? `ปัจจุบัน 1:${current}` : 'ปัจจุบันเป็นแบบไม่ตามมาตราส่วน (schematic)'}>
      <fieldset className="od-scale-modes">
        <legend className="list-sr-only">ชนิดแบบ</legend>
        <label className="od-check"><input type="radio" name="od-scale-mode" checked={mode === 'scaled'} onChange={() => setMode('scaled')} /> ตามมาตราส่วน</label>
        <label className="od-check"><input type="radio" name="od-scale-mode" checked={mode === 'schematic'} onChange={() => setMode('schematic')} disabled={!current} /> ไม่ตามมาตราส่วน (schematic)</label>
      </fieldset>
      {mode === 'scaled' && (
        <>
          <div className="mf-field">
            <label htmlFor="od-scale-den">มาตราส่วน 1 :</label>
            <input id="od-scale-den" type="number" min="1" max="10000" step="1" value={text} onChange={e => setText(e.target.value)} aria-invalid={valid ? undefined : 'true'} />
            {!valid && <p className="mf-field-error">ต้องเป็นจำนวนเต็ม 1–10000</p>}
          </div>
          <div className="od-inline-actions" role="group" aria-label="มาตราส่วนที่ใช้บ่อย">
            {PRESETS.map(n => <button key={n} type="button" className="list-button" aria-pressed={denominator === n} onClick={() => setText(String(n))}>1:{n}</button>)}
          </div>
          {valid && <p className="od-note">ตัวอย่าง: เส้นยาว {sample} มม. บนกระดาษ = {formatReal(sample * denominator, doc.measurement)} จริง</p>}
          {!current && <p className="list-muted od-small">เป็นการกำหนดความหมายของระยะบนแบบครั้งแรก ระบบไม่ย้ายหรือปรับขนาดวัตถุ และไม่สอบเทียบจากรูปภาพ — ตรวจขนาดห้อง/อาคารหลังกำหนดว่าตรงกับของจริง</p>}
          {changing && (
            <fieldset className="od-scale-keep">
              <legend>เมื่อเปลี่ยนจาก 1:{current} เป็น 1:{denominator}</legend>
              <label className="od-check"><input type="radio" name="od-scale-keep" checked={keep === 'real'} onChange={() => setKeep('real')} />
                รักษาระยะจริง — ปรับขนาดวัตถุบนกระดาษ ×{(current / denominator).toLocaleString('en-US', { maximumFractionDigits: 3 })} (ตัวอักษร ความหนาเส้น สัญลักษณ์ กรอบชื่อแบบ และคำอธิบายสัญลักษณ์คงขนาดเดิม)</label>
              <label className="od-check"><input type="radio" name="od-scale-keep" checked={keep === 'paper'} onChange={() => setKeep('paper')} />
                คงขนาดบนกระดาษ — ระยะจริงเปลี่ยน (เส้น {sample} มม. จาก {formatReal(sample * current, doc.measurement)} เป็น {formatReal(sample * denominator, doc.measurement)})</label>
              {keep === 'real' && <p className="list-muted od-small">ตรวจตำแหน่งวัตถุก่อนบันทึก วัตถุอาจล้นขอบกระดาษ (ตัวอย่างก่อนพิมพ์จะเตือน) และกด Ctrl+Z เพื่อย้อนได้</p>}
            </fieldset>
          )}
        </>
      )}
      {toSchematic && (dims
        ? <p className="mf-field-error" role="alert">แบบนี้มีเส้นบอกระยะ {dims} เส้น ซึ่งใช้ได้เฉพาะแบบตามมาตราส่วน ลบเส้นบอกระยะก่อนจึงเปลี่ยนเป็นแบบไม่ตามมาตราส่วนได้</p>
        : <p className="list-muted od-small">ระยะบนแบบจะไม่ถูกแสดงเป็นระยะจริงอีก วัตถุไม่ถูกปรับขนาด</p>)}
      <div className="mf-actions">
        <button type="button" className="mf-button" onClick={onClose}>ยกเลิก</button>
        <button type="button" className="mf-button mf-primary" onClick={apply} disabled={toSchematic ? dims > 0 : !valid}>ใช้มาตราส่วนนี้</button>
      </div>
    </ModalFrame>
  );
}
