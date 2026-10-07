import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import ModalFrame from '../common/ModalFrame.jsx';
import { createDrawing, staleLinkIds, stripAssetRefs, urls } from './officeDrawingApi.js';
import { validateDrawing } from './officeDrawingDocument.js';
import { useDebouncedText, useDrawingResource } from './officeHooks.js';

// "ทำสำเนา": POST a new drawing from `entry`. Every equipment link in a copy
// counts as new, so links the server would reject are taken off first --
// in the same office the stale ones (moved/deleted/unavailable), in another
// office all of them -- and the user is told how many before copying.
export default function DuplicateDrawingDialog({ siteId, siteName, entry, links, linksError, onRetryLinks, token, onClose, onCreated }) {
  const [name, setName] = useState(`สำเนา - ${entry.meta.name}`.slice(0, 200));
  const [target, setTarget] = useState({ value: String(siteId), label: siteName || `สำนักงาน ${siteId}` });
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useDebouncedText(search, setSearch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sites = useDrawingResource(urls.selectors({ search, limit: 50 }), { token });

  const linked = entry.doc.objects.filter(o => o.asset_ref).map(o => o.id);
  const sameSite = target.value === String(siteId);
  const stale = links ? staleLinkIds(links).filter(id => linked.includes(id)) : null;
  const toStrip = sameSite ? stale : linked;
  const blocked = sameSite && linked.length > 0 && !links;

  const submit = async () => {
    setError('');
    const doc = toStrip && toStrip.length ? stripAssetRefs(entry.doc, toStrip) : entry.doc;
    const next = { meta: { ...entry.meta, name }, doc };
    const problem = validateDrawing(next);
    if (problem) { setError(problem.message); return; }
    setBusy(true);
    const r = await createDrawing(next, target.value, token);
    setBusy(false);
    if (r.ok) { onCreated(r.data); return; }
    // No automatic retry: a timed-out POST may already have created the copy.
    setError(r.status === 0 ? `${r.message} — ไม่ทราบว่าสร้างสำเนาแล้วหรือยัง กรุณาตรวจรายการแบบของสำนักงานปลายทางก่อนลองอีกครั้ง` : r.message);
  };

  return (
    <ModalFrame title="ทำสำเนาแบบ" icon={<Copy size={20} aria-hidden="true" />} subtitle={entry.meta.name} size="lg" busy={busy} onClose={onClose}>
      <div className="mf-field">
        <label htmlFor="od-dup-name">ชื่อแบบใหม่</label>
        <input id="od-dup-name" value={name} maxLength={200} onChange={e => setName(e.target.value)} />
      </div>
      <div className="mf-field">
        <label htmlFor="od-dup-site">สำนักงานปลายทาง</label>
        <input type="search" value={searchText} placeholder="ค้นหาสำนักงาน" aria-label="ค้นหาสำนักงานปลายทาง" onChange={e => setSearchText(e.target.value)} />
        <select id="od-dup-site" className="od-select" value={target.value}
          onChange={e => { const s = (sites.data?.sites || []).find(x => String(x.value) === e.target.value); if (s) setTarget({ value: String(s.value), label: s.label }); }}>
          {!(sites.data?.sites || []).some(s => String(s.value) === target.value) && <option value={target.value}>{target.label}</option>}
          {(sites.data?.sites || []).map(s => <option key={s.value} value={String(s.value)}>{s.label}{s.province ? ` (${s.province})` : ''}</option>)}
        </select>
        {sites.pagination?.total > 50 && <p className="list-muted">แสดง 50 แห่งแรก พิมพ์ค้นหาเพื่อหาสำนักงานอื่น</p>}
      </div>
      {linked.length > 0 && (
        <div className="od-note" role="status">
          {sameSite ? (
            blocked
              ? <>โหลดสถานะอุปกรณ์ที่ผูกไว้ไม่สำเร็จ{linksError ? ` (${linksError})` : ''} จึงยังไม่รู้ว่าลิงก์ใดใช้ไม่ได้ <button type="button" className="od-link" onClick={onRetryLinks}>ลองโหลดใหม่</button></>
              : toStrip.length
                ? <>สำเนาจะถอดการผูกทะเบียน {toStrip.length} จาก {linked.length} รายการ ที่อุปกรณ์ย้ายสำนักงาน ถูกลบ หรือไม่พบแล้ว</>
                : <>สำเนาคงการผูกทะเบียนอุปกรณ์ทั้ง {linked.length} รายการ</>
          ) : <>สำเนาไปสำนักงานอื่นจะถอดการผูกทะเบียนอุปกรณ์ทั้ง {linked.length} รายการ (ไม่ผูกอุปกรณ์ข้ามสำนักงาน) ชื่อบนผังยังอยู่</>}
        </div>
      )}
      {error && <p className="mf-field-error" role="alert">{error}</p>}
      <div className="mf-actions">
        <button type="button" className="mf-button" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button type="button" className="mf-button mf-primary" onClick={submit} disabled={busy || blocked || !name.trim()}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} สร้างสำเนา
        </button>
      </div>
    </ModalFrame>
  );
}
