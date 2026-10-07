import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../equipment-form/ConfirmDialog.jsx';
import { addLayer, moveLayer, removeLayer, updateLayer, textProblem } from '../officeDrawingDocument.js';

// Layers, top of the list = drawn on top. Lock only guards against editing
// by accident in this editor; it is not a permission.
export default function DrawingLayers({ doc, activeLayerId, onActive, onDoc, readOnly, maxLayers = 30 }) {
  const [removing, setRemoving] = useState(null);
  const [moveTo, setMoveTo] = useState('');
  const [renaming, setRenaming] = useState(null);
  const top = [...doc.layers].reverse();
  const count = (id) => doc.objects.filter(o => o.layer_id === id).length;

  const rename = (id, name) => {
    setRenaming(null);
    const n = String(name).trim().slice(0, 100);
    if (!n || textProblem(n)) return;
    onDoc(updateLayer(doc, id, { name: n }));
  };

  const confirmRemove = (mode) => {
    const id = removing.id;
    const next = mode === 'move' ? removeLayer(doc, id, { moveTo }) : removeLayer(doc, id);
    setRemoving(null);
    onDoc(next);
    if (activeLayerId === id) onActive(next.layers[next.layers.length - 1]?.id);
  };

  return (
    <section className="od-layers" aria-labelledby="od-layers-title">
      <div className="od-section-head">
        <h3 id="od-layers-title">ชั้น (Layers)</h3>
        {!readOnly && (
          <button type="button" className="od-icon-button" disabled={doc.layers.length >= maxLayers} title="เพิ่มชั้น"
            onClick={() => { const { doc: next, id } = addLayer(doc); onDoc(next); onActive(id); }}>
            <Plus size={16} aria-hidden="true" /><span className="list-sr-only">เพิ่มชั้น</span>
          </button>
        )}
      </div>
      <ul className="od-layer-list">
        {top.map((l, i) => (
          <li key={l.id} className={`od-layer${l.id === activeLayerId ? ' is-active' : ''}`}>
            <label className="od-layer-pick" title="ชั้นที่จะวาดวัตถุใหม่">
              <input type="radio" name="od-active-layer" checked={l.id === activeLayerId} disabled={readOnly} onChange={() => onActive(l.id)} />
              {renaming === l.id ? (
                <input className="od-layer-name-input" defaultValue={l.name} maxLength={100} autoFocus aria-label="ชื่อชั้น"
                  onBlur={e => rename(l.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') rename(l.id, e.currentTarget.value); if (e.key === 'Escape') setRenaming(null); }} />
              ) : (
                <span className="od-layer-name" onDoubleClick={() => !readOnly && setRenaming(l.id)}>{l.name} <span className="list-muted">({count(l.id)})</span></span>
              )}
            </label>
            <div className="od-layer-actions">
              <button type="button" className="od-icon-button" aria-pressed={l.visible === false} title={l.visible === false ? 'แสดงชั้น' : 'ซ่อนชั้น'}
                disabled={readOnly} onClick={() => onDoc(updateLayer(doc, l.id, { visible: l.visible === false }))}>
                {l.visible === false ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}<span className="list-sr-only">{l.visible === false ? `แสดง ${l.name}` : `ซ่อน ${l.name}`}</span>
              </button>
              {!readOnly && (
                <>
                  <button type="button" className="od-icon-button" aria-pressed={Boolean(l.locked)} title={l.locked ? 'ปลดล็อก' : 'ล็อกกันแก้โดยไม่ตั้งใจ'}
                    onClick={() => onDoc(updateLayer(doc, l.id, { locked: !l.locked }))}>
                    {l.locked ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />}<span className="list-sr-only">{l.locked ? `ปลดล็อก ${l.name}` : `ล็อก ${l.name}`}</span>
                  </button>
                  <button type="button" className="od-icon-button" disabled={i === 0} title="ขึ้นบน" onClick={() => onDoc(moveLayer(doc, l.id, 1))}><ArrowUp size={16} aria-hidden="true" /><span className="list-sr-only">เลื่อน {l.name} ขึ้น</span></button>
                  <button type="button" className="od-icon-button" disabled={i === top.length - 1} title="ลงล่าง" onClick={() => onDoc(moveLayer(doc, l.id, -1))}><ArrowDown size={16} aria-hidden="true" /><span className="list-sr-only">เลื่อน {l.name} ลง</span></button>
                  <button type="button" className="od-icon-button" disabled={doc.layers.length <= 1} title="ลบชั้น"
                    onClick={() => { if (count(l.id)) { setMoveTo(doc.layers.find(x => x.id !== l.id)?.id || ''); setRemoving(l); } else onDoc(removeLayer(doc, l.id)); }}>
                    <Trash2 size={16} aria-hidden="true" /><span className="list-sr-only">ลบ {l.name}</span>
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!readOnly && <p className="list-muted od-small">ดับเบิลคลิกชื่อเพื่อเปลี่ยนชื่อ · ชั้นบนสุดของรายการวาดทับชั้นอื่น</p>}

      <ConfirmDialog open={Boolean(removing)} title={`ลบชั้น “${removing?.name}”?`} tone="danger"
        message={removing && (
          <>
            <p>ชั้นนี้มีวัตถุ {count(removing.id)} ชิ้น ย้ายวัตถุไปชั้นอื่นก่อนลบ หรือลบวัตถุทั้งหมดพร้อมชั้น</p>
            <label className="od-field">ย้ายไปชั้น
              <select value={moveTo} onChange={e => setMoveTo(e.target.value)}>
                {doc.layers.filter(x => x.id !== removing.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <button type="button" className="list-button od-danger" onClick={() => confirmRemove('delete')}>ลบวัตถุทั้งหมดพร้อมชั้น</button>
          </>
        )}
        confirmLabel="ย้ายวัตถุแล้วลบชั้น" onCancel={() => setRemoving(null)} onConfirm={() => confirmRemove('move')} />
    </section>
  );
}
