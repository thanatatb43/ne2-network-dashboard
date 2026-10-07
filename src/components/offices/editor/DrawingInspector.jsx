import { useState } from 'react';
import { ArrowDown, ArrowUp, BringToFront, Copy, Link2, SendToBack, Trash2, Unlink, Plus, X } from 'lucide-react';
import {
  SYMBOL_LABELS, TITLE_BLOCK_FIELDS, TYPE_NAMES, TYPE_DEFAULTS, effectiveStyle, isBox, pageDimensions, reorderObjects, objectName
} from '../officeDrawingDocument.js';
import { updateBox } from '../officeDrawingGeometry.js';
import { TYPE_LABELS } from '../officeDrawingApi.js';
import { ColorField, NumberField, SelectField, TextField } from './fields.jsx';
import DrawingLayers from './DrawingLayers.jsx';

const TB_LABELS = {
  project_name: 'ชื่อโครงการ', drawing_title: 'ชื่อแบบ (บนกรอบ)', location: 'สถานที่', drawing_number: 'เลขที่แบบ', revision_label: 'แก้ไขครั้งที่',
  issued_date: 'วันที่', prepared_by: 'ผู้จัดทำ', checked_by: 'ผู้ตรวจ', contact: 'ติดต่อ', sheet_number: 'แผ่นที่'
};
const LINK_STATE = {
  available: ['ใช้งานได้', 'up'], moved: ['ทะเบียนย้ายไปสำนักงานอื่นแล้ว', 'warning'], deleted: ['ทะเบียนถูกลบแล้ว', 'down'],
  unavailable: ['ไม่พบในทะเบียน', 'down'], new: ['ผูกใหม่ (ยังไม่บันทึก)', 'borrowed'], unknown: ['ยังไม่ทราบสถานะ', 'unknown']
};

function LinkSection({ object, link, readOnly, canLink, onPick, onUnlink, linksError, onRetryLinks }) {
  const ref = object.asset_ref;
  const [label, tone] = LINK_STATE[link?.state || (ref ? 'unknown' : '')] || [];
  return (
    <section className="od-inspect-section">
      <h4>ทะเบียนอุปกรณ์</h4>
      {ref ? (
        <>
          <p className="od-link-asset">
            <strong>{link?.asset?.label || `${ref.kind === 'network_device' ? 'อุปกรณ์เครือข่าย' : 'อุปกรณ์'} ID ${ref.id}`}</strong>
            <span className="list-muted">{ref.kind === 'network_device' ? 'อุปกรณ์เครือข่าย' : 'ทะเบียนอุปกรณ์'} · ID {ref.id}</span>
            {label && <span className={`list-status list-status-${tone}`}>{label}</span>}
          </p>
          {link?.state === 'moved' && <p className="list-muted od-small">ชื่อบนผังไม่เปลี่ยนตาม — ถ้าจะบันทึกการผูกใหม่ต้องเลือกอุปกรณ์ของสำนักงานนี้</p>}
          {linksError && !link && <p className="list-muted od-small">โหลดสถานะไม่สำเร็จ <button type="button" className="od-link" onClick={onRetryLinks}>ลองใหม่</button></p>}
          {!readOnly && (
            <div className="od-inline-actions">
              {canLink && <button type="button" className="list-button" onClick={onPick}><Link2 size={16} aria-hidden="true" /> เปลี่ยน</button>}
              <button type="button" className="list-button" onClick={onUnlink}><Unlink size={16} aria-hidden="true" /> ถอดการผูก</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="list-muted od-small">ยังไม่ได้ผูก — วางเป็นสัญลักษณ์สำหรับงานออกแบบได้โดยไม่ต้องมีทะเบียน</p>
          {!readOnly && canLink && <button type="button" className="list-button" onClick={onPick}><Link2 size={16} aria-hidden="true" /> ผูกกับทะเบียน</button>}
        </>
      )}
    </section>
  );
}

function StyleSection({ object, cableStyles, onChange, readOnly }) {
  const st = effectiveStyle(object, cableStyles);
  const own = object.style || {};
  const set = (k, v) => {
    const next = { ...own, [k]: v };
    const empty = Object.values(next).every(x => x === null || x === undefined);
    onChange({ style: empty ? null : next });
  };
  const hasFill = !['wall', 'cable', 'door'].includes(object.type);
  return (
    <section className="od-inspect-section">
      <h4>สีและเส้น</h4>
      <div className="od-grid-2">
        {object.type !== 'text' && <ColorField label="สีเส้น" value={own.stroke ?? null} fallback={st.stroke || '#111827'} disabled={readOnly} onCommit={v => set('stroke', v)} />}
        {hasFill && <ColorField label={object.type === 'text' ? 'สีตัวอักษร' : 'สีพื้น'} value={own.fill ?? null} fallback={st.fill || '#FFFFFF'} disabled={readOnly} onCommit={v => set('fill', v)} />}
        {object.type !== 'text' && object.type !== 'wall' && <NumberField label="ความหนาเส้น" unit="มม." value={own.stroke_width ?? null} allowNull min={0.05} max={100} step={0.1} disabled={readOnly} onCommit={v => set('stroke_width', v)} />}
        {object.type !== 'text' && (
          <SelectField label="รูปแบบเส้น" value={own.dash ?? ''} disabled={readOnly}
            options={[['', 'ค่าเริ่มต้น'], ['solid', 'เส้นทึบ'], ['dashed', 'เส้นประ'], ['dotted', 'เส้นจุด']]} onCommit={v => set('dash', v || null)} />
        )}
      </div>
    </section>
  );
}

function ObjectInspector({ doc, object: o, readOnly, onDoc, cableStyles, symbolKeys, link, canLink, onPick, onDelete, onDuplicate, linksError, onRetryLinks }) {
  const change = (changes) => onDoc(isBox(o) ? updateBox(doc, o.id, changes) : { ...doc, objects: doc.objects.map(x => (x.id === o.id ? { ...x, ...changes } : x)) });
  const layerOptions = doc.layers.map(l => [l.id, `${l.name}${l.locked ? ' (ล็อก)' : ''}`]);
  const ends = (end) => {
    const ref = o[end];
    if (!ref) return 'ไม่ได้ต่อกับวัตถุ';
    const target = doc.objects.find(x => x.id === ref.object_id);
    return `${target ? objectName(target) : ref.object_id} (${{ center: 'กลาง', top: 'บน', right: 'ขวา', bottom: 'ล่าง', left: 'ซ้าย' }[ref.anchor] || ref.anchor})`;
  };
  return (
    <div className="od-inspect" key={o.id}>
      <div className="od-inspect-title">
        <strong>{TYPE_NAMES[o.type] || o.type}</strong>
        {!readOnly && (
          <div className="od-inline-actions">
            <button type="button" className="od-icon-button" title="นำขึ้นหน้าสุด" onClick={() => onDoc(reorderObjects(doc, [o.id], 'front'))}><BringToFront size={16} aria-hidden="true" /><span className="list-sr-only">นำขึ้นหน้าสุดในชั้น</span></button>
            <button type="button" className="od-icon-button" title="ส่งไปหลังสุด" onClick={() => onDoc(reorderObjects(doc, [o.id], 'back'))}><SendToBack size={16} aria-hidden="true" /><span className="list-sr-only">ส่งไปหลังสุดในชั้น</span></button>
            <button type="button" className="od-icon-button" title="ทำสำเนา (Ctrl+D)" onClick={() => onDuplicate([o.id])}><Copy size={16} aria-hidden="true" /><span className="list-sr-only">ทำสำเนาวัตถุ</span></button>
            <button type="button" className="od-icon-button od-danger" title="ลบ (Delete)" onClick={() => onDelete([o.id])}><Trash2 size={16} aria-hidden="true" /><span className="list-sr-only">ลบวัตถุ</span></button>
          </div>
        )}
      </div>
      {o.type === 'text'
        ? <TextField label="ข้อความ" value={o.text} multiline rows={4} nullable={false} maxLength={5000} disabled={readOnly} onCommit={v => change({ text: v })} />
        : <TextField label="ป้ายชื่อ" value={o.label} maxLength={500} disabled={readOnly} onCommit={v => change({ label: v })} />}
      <SelectField label="ชั้น" value={o.layer_id} options={layerOptions} disabled={readOnly} onCommit={v => change({ layer_id: v })} />
      {(o.type === 'equipment' || o.type === 'outlet') && (
        <SelectField label="สัญลักษณ์" value={o.symbol_key} disabled={readOnly}
          options={(symbolKeys[o.type] || [o.symbol_key]).map(k => [k, SYMBOL_LABELS[k] || k])} onCommit={v => change({ symbol_key: v })} />
      )}
      {o.type === 'door' && (
        <div className="od-grid-2">
          <SelectField label="บานพับ" value={o.hinge} disabled={readOnly} options={[['left', 'ซ้าย'], ['right', 'ขวา']]} onCommit={v => change({ hinge: v })} />
          <SelectField label="ทิศเปิด" value={o.swing} disabled={readOnly} options={[['in', 'เข้า'], ['out', 'ออก']]} onCommit={v => change({ swing: v })} />
        </div>
      )}
      {o.type === 'text' && (
        <div className="od-grid-2">
          <NumberField label="ขนาดตัวอักษร" unit="มม." value={o.font_size} min={0.5} max={200} step={0.5} disabled={readOnly} onCommit={v => change({ font_size: v })} />
          <SelectField label="จัดแนว" value={o.align || 'left'} disabled={readOnly} options={[['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง'], ['right', 'ชิดขวา']]} onCommit={v => change({ align: v })} />
        </div>
      )}
      {isBox(o) && (
        <section className="od-inspect-section">
          <h4>ตำแหน่งและขนาด (มม.)</h4>
          <div className="od-grid-2">
            <NumberField label="X" value={o.x} min={-10000} max={10000} disabled={readOnly} onCommit={v => change({ x: v })} />
            <NumberField label="Y" value={o.y} min={-10000} max={10000} disabled={readOnly} onCommit={v => change({ y: v })} />
            <NumberField label="กว้าง" value={o.width} min={0.1} max={20000} disabled={readOnly} onCommit={v => change({ width: v })} />
            <NumberField label="สูง" value={o.height} min={0.1} max={20000} disabled={readOnly} onCommit={v => change({ height: v })} />
            <NumberField label="หมุน" unit="องศา" value={o.rotation} min={-360} max={360} step={1} disabled={readOnly} onCommit={v => change({ rotation: v })} />
          </div>
        </section>
      )}
      {o.type === 'wall' && <NumberField label="ความหนาผนัง" unit="มม." value={o.thickness} min={0.1} max={100} disabled={readOnly} onCommit={v => change({ thickness: v })} />}
      {o.type === 'cable' && (
        <section className="od-inspect-section">
          <h4>แนวสาย</h4>
          <SelectField label="ชนิดสาย" value={o.cable_style_key} disabled={readOnly} options={cableStyles.map(c => [c.key, c.label])} onCommit={v => change({ cable_style_key: v })} />
          <NumberField label="ความยาวจากการสำรวจ" unit="เมตร" value={o.measured_length_m ?? null} allowNull min={0} max={1000000} step={0.1} disabled={readOnly} onCommit={v => change({ measured_length_m: v })} />
          <p className="list-muted od-small">ค่าที่กรอกเองจากการสำรวจ ระบบไม่คำนวณจากความยาวเส้นบนผัง</p>
          <dl className="od-ends">
            <div><dt>ต้นสาย</dt><dd>{ends('start')}{o.start && !readOnly && <button type="button" className="od-link" onClick={() => change({ start: null })}>ถอด</button>}</dd></div>
            <div><dt>ปลายสาย</dt><dd>{ends('end')}{o.end && !readOnly && <button type="button" className="od-link" onClick={() => change({ end: null })}>ถอด</button>}</dd></div>
          </dl>
          <p className="list-muted od-small">{o.points.length} จุด · ลากจุดสี่เหลี่ยมเพื่อย้าย ลากจุดกลมเพื่อเพิ่มจุดหักมุม ดับเบิลคลิกจุดเพื่อลบ · ลากปลายสายไปวางบนอุปกรณ์เพื่อต่อ</p>
        </section>
      )}
      {o.type === 'wall' && <p className="list-muted od-small">{o.points.length} จุด · ลากจุดเพื่อแก้ ลากจุดกลมเพื่อเพิ่มจุด ดับเบิลคลิกจุดเพื่อลบ</p>}
      {['equipment', 'outlet', 'junction'].includes(o.type) && (
        <LinkSection object={o} link={link} readOnly={readOnly} canLink={canLink} onPick={onPick} onUnlink={() => change({ asset_ref: null })} linksError={linksError} onRetryLinks={onRetryLinks} />
      )}
      {TYPE_DEFAULTS[o.type] && <StyleSection object={o} cableStyles={cableStyles} readOnly={readOnly} onChange={change} />}
    </div>
  );
}

function LegendInspector({ doc, onDoc, readOnly, symbolKeys, cableStyles, maxItems = 100 }) {
  const legend = doc.legend || { visible: true, x: 10, y: 10, items: [] };
  const set = (changes) => onDoc({ ...doc, legend: { ...legend, ...changes } });
  const setItem = (i, changes) => set({ items: legend.items.map((it, j) => (j === i ? { ...it, ...changes } : it)) });
  const move = (i, d) => { const items = [...legend.items]; [items[i], items[i + d]] = [items[i + d], items[i]]; set({ items }); };
  const [adding, setAdding] = useState('line:utp');
  const add = () => {
    const [kind, key] = adding.split(':');
    const item = kind === 'line'
      ? { kind: 'line', cable_style_key: key, label: cableStyles.find(c => c.key === key)?.label || key }
      : { kind: 'symbol', symbol_key: key, label: SYMBOL_LABELS[key] || key };
    set({ items: [...legend.items, item], visible: true });
  };
  return (
    <section className="od-inspect-section">
      <div className="od-section-head">
        <h4>คำอธิบายสัญลักษณ์</h4>
        <label className="od-check"><input type="checkbox" checked={Boolean(doc.legend) && legend.visible !== false} disabled={readOnly}
          onChange={e => onDoc({ ...doc, legend: { ...legend, visible: e.target.checked } })} /> แสดง</label>
      </div>
      <p className="list-muted od-small">อธิบายความหมายของสัญลักษณ์และสาย ไม่ใช่จำนวนจุดจริงบนผัง · ลากกรอบบนผังเพื่อย้ายตำแหน่ง</p>
      <ol className="od-legend-items">
        {legend.items.map((it, i) => (
          <li key={i}>
            <TextField label={it.kind === 'line' ? `สาย: ${cableStyles.find(c => c.key === it.cable_style_key)?.label || it.cable_style_key}` : `สัญลักษณ์: ${SYMBOL_LABELS[it.symbol_key] || it.symbol_key}`}
              value={it.label} nullable={false} maxLength={500} disabled={readOnly} onCommit={v => setItem(i, { label: v })} />
            {!readOnly && (
              <div className="od-inline-actions">
                <button type="button" className="od-icon-button" disabled={i === 0} onClick={() => move(i, -1)} title="ขึ้น"><ArrowUp size={14} aria-hidden="true" /><span className="list-sr-only">เลื่อนขึ้น</span></button>
                <button type="button" className="od-icon-button" disabled={i === legend.items.length - 1} onClick={() => move(i, 1)} title="ลง"><ArrowDown size={14} aria-hidden="true" /><span className="list-sr-only">เลื่อนลง</span></button>
                <button type="button" className="od-icon-button" onClick={() => set({ items: legend.items.filter((_, j) => j !== i) })} title="นำออก"><X size={14} aria-hidden="true" /><span className="list-sr-only">นำรายการออก</span></button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && legend.items.length < maxItems && (
        <div className="od-add-row">
          <select value={adding} onChange={e => setAdding(e.target.value)} aria-label="รายการที่จะเพิ่ม">
            <optgroup label="สาย">{cableStyles.map(c => <option key={c.key} value={`line:${c.key}`}>{c.label}</option>)}</optgroup>
            <optgroup label="สัญลักษณ์">{(symbolKeys.legend || []).map(k => <option key={k} value={`symbol:${k}`}>{SYMBOL_LABELS[k] || k}</option>)}</optgroup>
          </select>
          <button type="button" className="list-button" onClick={add}><Plus size={16} aria-hidden="true" /> เพิ่ม</button>
        </div>
      )}
    </section>
  );
}

function DocumentInspector({ doc, meta, onDoc, onMeta, readOnly, symbolKeys, cableStyles, limits }) {
  const page = doc.page;
  const setPage = (changes) => {
    const next = { ...page, ...changes };
    const dims = pageDimensions(next.size, next.orientation);
    onDoc({ ...doc, page: { ...next, width: dims.width, height: dims.height } });
  };
  const tb = doc.title_block;
  return (
    <div className="od-inspect">
      <section className="od-inspect-section">
        <h4>ข้อมูลแบบ</h4>
        <TextField label="ชื่อแบบ" value={meta.name} nullable={false} maxLength={limits.name_max} disabled={readOnly} onCommit={v => onMeta({ ...meta, name: v })} />
        <SelectField label="ชนิดแบบ" value={meta.drawing_type} disabled={readOnly} options={Object.entries(TYPE_LABELS)} onCommit={v => onMeta({ ...meta, drawing_type: v })} />
        <div className="od-grid-2">
          <TextField label="อาคาร" value={meta.building_label} maxLength={200} disabled={readOnly} onCommit={v => onMeta({ ...meta, building_label: v })} />
          <TextField label="ชั้น" value={meta.floor_label} maxLength={200} disabled={readOnly} onCommit={v => onMeta({ ...meta, floor_label: v })} />
        </div>
      </section>
      <section className="od-inspect-section">
        <h4>กระดาษและเส้นตาราง</h4>
        <div className="od-grid-2">
          <SelectField label="ขนาด" value={page.size} disabled={readOnly} options={[['A4', 'A4'], ['A3', 'A3']]} onCommit={v => setPage({ size: v })} />
          <SelectField label="แนว" value={page.orientation} disabled={readOnly} options={[['landscape', 'แนวนอน'], ['portrait', 'แนวตั้ง']]} onCommit={v => setPage({ orientation: v })} />
          <NumberField label="ระยะขอบ" unit="มม." value={page.margin} min={0} max={50} step={1} disabled={readOnly} onCommit={v => setPage({ margin: v })} />
          <NumberField label="ระยะตาราง" unit="มม." value={doc.grid.spacing} min={0.5} max={100} step={0.5} disabled={readOnly} onCommit={v => onDoc({ ...doc, grid: { ...doc.grid, spacing: v } })} />
        </div>
        <label className="od-check"><input type="checkbox" checked={doc.grid.enabled} disabled={readOnly} onChange={e => onDoc({ ...doc, grid: { ...doc.grid, enabled: e.target.checked } })} /> แสดงเส้นตารางเมื่อเปิดแบบ</label>
        <label className="od-check"><input type="checkbox" checked={doc.grid.snap} disabled={readOnly} onChange={e => onDoc({ ...doc, grid: { ...doc.grid, snap: e.target.checked } })} /> จัดวางตามเส้นตาราง (snap) เป็นค่าเริ่มต้น</label>
        <p className="list-muted od-small">ผังเป็นแบบไม่ตามมาตราส่วน (schematic) ระยะบนผังไม่ใช่ระยะจริง</p>
      </section>
      <section className="od-inspect-section">
        <div className="od-section-head">
          <h4>กรอบชื่อแบบ</h4>
          <label className="od-check"><input type="checkbox" checked={Boolean(tb)} disabled={readOnly}
            onChange={e => onDoc({ ...doc, title_block: e.target.checked ? { ...Object.fromEntries(TITLE_BLOCK_FIELDS.map(k => [k, null])), logo_key: 'pea' } : null })} /> แสดง</label>
        </div>
        {tb && (
          <>
            {TITLE_BLOCK_FIELDS.map(k => (
              k === 'issued_date'
                ? <div className="od-field" key={k}><label htmlFor="od-tb-date">{TB_LABELS[k]}</label>
                    <input id="od-tb-date" type="date" value={tb.issued_date || ''} disabled={readOnly} onChange={e => onDoc({ ...doc, title_block: { ...tb, issued_date: e.target.value || null } })} /></div>
                : <TextField key={k} label={TB_LABELS[k]} value={tb[k]} maxLength={limits.title_block_field_max} disabled={readOnly} onCommit={v => onDoc({ ...doc, title_block: { ...tb, [k]: v } })} />
            ))}
            <label className="od-check"><input type="checkbox" checked={tb.logo_key === 'pea'} disabled={readOnly} onChange={e => onDoc({ ...doc, title_block: { ...tb, logo_key: e.target.checked ? 'pea' : null } })} /> แสดงโลโก้ กฟภ.</label>
          </>
        )}
      </section>
      <LegendInspector doc={doc} onDoc={onDoc} readOnly={readOnly} symbolKeys={symbolKeys} cableStyles={cableStyles} maxItems={limits.legend_items_max} />
    </div>
  );
}

export default function DrawingInspector(props) {
  const { doc, selection, readOnly, onDoc, onDelete, onDuplicate, activeLayerId, onActiveLayer, limits } = props;
  const objects = selection.map(id => doc.objects.find(o => o.id === id)).filter(Boolean);
  let body;
  if (selection.includes('__legend')) {
    body = <div className="od-inspect"><LegendInspector {...props} maxItems={limits.legend_items_max} /></div>;
  } else if (objects.length === 1) {
    body = <ObjectInspector {...props} object={objects[0]} link={props.linkFor(objects[0])} onPick={() => props.onPick(objects[0])} />;
  } else if (objects.length > 1) {
    body = (
      <div className="od-inspect">
        <div className="od-inspect-title"><strong>เลือก {objects.length} ชิ้น</strong></div>
        <p className="list-muted od-small">{[...new Set(objects.map(o => TYPE_NAMES[o.type]))].join(', ')}</p>
        {!readOnly && (
          <>
            <SelectField label="ย้ายไปชั้น" value="" options={[['', 'เลือกชั้น'], ...doc.layers.map(l => [l.id, l.name])]}
              onCommit={v => v && onDoc({ ...doc, objects: doc.objects.map(o => (selection.includes(o.id) ? { ...o, layer_id: v } : o)) })} />
            <div className="od-inline-actions">
              <button type="button" className="list-button" onClick={() => onDuplicate(selection)}><Copy size={16} aria-hidden="true" /> ทำสำเนา</button>
              <button type="button" className="list-button od-danger" onClick={() => onDelete(selection)}><Trash2 size={16} aria-hidden="true" /> ลบทั้งหมด</button>
            </div>
          </>
        )}
      </div>
    );
  } else {
    body = <DocumentInspector {...props} />;
  }
  return (
    <div className="od-inspector">
      {body}
      <DrawingLayers doc={doc} activeLayerId={activeLayerId} onActive={onActiveLayer} onDoc={onDoc} readOnly={readOnly} maxLayers={limits.layers_max} />
    </div>
  );
}
