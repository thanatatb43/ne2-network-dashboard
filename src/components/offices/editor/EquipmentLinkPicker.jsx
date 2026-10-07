import { useState } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import ModalFrame from '../../common/ModalFrame.jsx';
import { OPTIONS_LIMIT, urls } from '../officeDrawingApi.js';
import { useDebouncedText, useDrawingResource } from '../officeHooks.js';

const KINDS = { office_equipment: 'อุปกรณ์คอมพิวเตอร์/สำนักงาน', network_device: 'อุปกรณ์เครือข่าย' };

// Registered equipment of this office only, one page at a time (never the
// whole registry). Needs an editing role; the server answers 403 otherwise.
export default function EquipmentLinkPicker({ siteId, token, initialKind = 'office_equipment', onPick, onClose }) {
  const [kind, setKind] = useState(initialKind);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [text, setText] = useDebouncedText(search, (s) => { setSearch(s); setPage(1); });
  const options = useDrawingResource(urls.equipmentOptions({ pea_site_id: siteId, kind, search, page, limit: OPTIONS_LIMIT }), { token });
  const rows = options.data;
  const p = options.pagination;

  return (
    <ModalFrame title="ผูกกับทะเบียนอุปกรณ์" icon={<Link2 size={20} aria-hidden="true" />} subtitle="แสดงเฉพาะอุปกรณ์ที่ลงทะเบียนในสำนักงานนี้" size="xl" onClose={onClose}>
      <div className="od-picker-tools">
        <div className="od-seg" role="radiogroup" aria-label="ชนิดทะเบียน">
          {Object.entries(KINDS).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'is-active' : undefined} onClick={() => { setKind(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        <div className="list-search-input od-picker-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={text} maxLength={200} aria-label="ค้นหาอุปกรณ์"
            placeholder={kind === 'office_equipment' ? 'ชื่อ รหัส Serial รหัสทรัพย์สิน IP หรือ MAC' : 'ชื่อ Gateway Network ID หรือจังหวัด'} onChange={e => setText(e.target.value)} />
        </div>
      </div>
      {options.error && <p className="mf-field-error" role="alert">{options.error.message} <button type="button" className="od-link" onClick={options.retry}>ลองใหม่</button></p>}
      {options.loading && !rows && <p className="mf-state" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</p>}
      {rows && (rows.length === 0 ? <p className="mf-state">ไม่พบอุปกรณ์{search ? 'ที่ตรงกับคำค้น' : 'ในสำนักงานนี้'}</p> : (
        <ul className={`od-picker-list${options.stale ? ' is-stale' : ''}`}>
          {rows.map(a => (
            <li key={`${a.kind}:${a.id}`}>
              <button type="button" className="od-picker-item" onClick={() => onPick(a)}>
                <strong>{a.label}</strong>
                <span className="list-muted">
                  {a.kind === 'office_equipment'
                    ? [a.equipment_type, a.equipment_code, a.serial_number && `S/N ${a.serial_number}`, a.status].filter(Boolean).join(' · ')
                    : [a.pea_type, a.gateway, a.province].filter(Boolean).join(' · ')}
                </span>
                <span className="list-muted">ID {a.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}
      {p && p.totalPages > 1 && (
        <nav className="od-picker-pager" aria-label="แบ่งหน้ารายการอุปกรณ์">
          <button type="button" className="mf-button" disabled={page <= 1 || options.loading} onClick={() => setPage(x => x - 1)}>ก่อนหน้า</button>
          <span>หน้า {page} / {p.totalPages} · {p.total} รายการ</span>
          <button type="button" className="mf-button" disabled={page >= p.totalPages || options.loading} onClick={() => setPage(x => x + 1)}>ถัดไป</button>
        </nav>
      )}
    </ModalFrame>
  );
}
