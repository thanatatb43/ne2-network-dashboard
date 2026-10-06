import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AlertTriangle, ArrowLeft, Eye, FileSpreadsheet, Loader2, Pencil, Plus, QrCode, RefreshCw, Search, Trash2, UserCog, X } from 'lucide-react';
import QrCodeModal from './QrCodeModal';
import OwnerHistoryModal from './OwnerHistoryModal';
import EquipmentForm from './equipment-form/EquipmentForm.jsx';
import ConfirmDialog, { DialogShell } from './equipment-form/ConfirmDialog.jsx';
import { canDeleteEquipment, canEditEquipment } from './equipment-form/equipmentFields.js';
import './ListPage.css';
import './equipment-form/EquipmentForm.css';
import './OfficeSiteEquipment.css';

const API = import.meta.env.VITE_API_BASE_URL;
const PAGE_SIZES = [10, 25, 50, 100];
const STORAGE_PREFIX = 'officeEquipment.filters.v1:';

const statusTone = (status) => {
  const s = String(status || '').trim();
  if (s === 'ใช้งาน' || s === 'active') return 'up';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'down';
  if (s.startsWith('รอ')) return 'warning';
  return 'unknown';
};

const readFilters = (siteId) => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + siteId));
    return {
      search: typeof raw?.search === 'string' ? raw.search.slice(0, 200) : '',
      type: typeof raw?.type === 'string' ? raw.type.slice(0, 100) : '',
      page: Number.isInteger(raw?.page) && raw.page > 0 ? raw.page : 1,
      pageSize: PAGE_SIZES.includes(raw?.pageSize) ? raw.pageSize : 10
    };
  } catch {
    return { search: '', type: '', page: 1, pageSize: 10 };
  }
};

const matches = (item, search, type) => {
  if (type && item.equipment_type !== type) return false;
  if (!search) return true;
  const q = search.toLocaleLowerCase();
  return ['name', 'ip_address', 'mac_address', 'department', 'equipment_type', 'vendor', 'asset_owner', 'serial_number', 'asset_number']
    .some(key => String(item[key] ?? '').toLocaleLowerCase().includes(q));
};

const EXPORT_COLUMNS = [
  ['ชื่ออุปกรณ์', 'name'], ['ประเภท', 'equipment_type'], ['แผนก', 'department'], ['IP Address', 'ip_address'], ['MAC Address', 'mac_address'], ['Wi-Fi MAC Address', 'wifi_mac_address'],
  ['สถานะ', 'status'], ['ผู้ขาย', 'vendor'], ['เลขที่สัญญา', 'contract_no'], ['วันเริ่มสัญญา', 'contract_start_date'], ['วันหมดอายุสัญญา', 'contract_expiry_date'],
  ['Serial Number', 'serial_number'], ['รหัสทรัพย์สิน', 'asset_number'], ['ผู้ถือครอง', 'asset_owner'], ['รหัสพนักงานผู้ถือครอง', 'asset_owner_emp_id'],
  ['สถานที่ติดตั้งหรือจัดเก็บ', 'storage_location'], ['หมายเหตุ', 'notes']
];

const StatusPill = ({ status }) => <span className={`list-status list-status-${statusTone(status)}`}>{status || 'ไม่ระบุ'}</span>;

export default function OfficeSiteEquipment({ siteId, site, token, user, onBackToSites, onMutated }) {
  const canEdit = canEditEquipment(user);
  const canDelete = canDeleteEquipment(user);
  const [initialFilters] = useState(() => readFilters(siteId));
  const [search, setSearch] = useState(initialFilters.search);
  const [type, setType] = useState(initialFilters.type);
  const [page, setPage] = useState(initialFilters.page);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize);
  const [list, setList] = useState({ status: 'loading', rows: [], network: null, error: '' });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [qrItem, setQrItem] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState(null);
  const requestRef = useRef(0);
  const formRef = useRef(null);
  const openCountRef = useRef(0);
  const detailsId = useId();

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const res = await fetch(`${API}/api/office-equipment/site/${siteId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.success === false || !Array.isArray(body.data)) throw new Error(body?.message || `HTTP ${res.status}`);
      if (request !== requestRef.current) return true;
      setList({ status: 'ready', rows: body.data, network: body.network_ip || null, error: '' });
      return true;
    } catch (err) {
      if (request === requestRef.current) setList(prev => ({ ...prev, status: prev.rows.length ? 'stale' : 'error', error: err.message || 'โหลดข้อมูลไม่สำเร็จ' }));
      return false;
    }
  }, [siteId, token]);

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_PREFIX + siteId, JSON.stringify({ search, type, page, pageSize })); } catch { /* not remembered */ }
  }, [siteId, search, type, page, pageSize]);

  const rows = list.rows;
  const types = useMemo(() => {
    const set = new Set(rows.map(r => r.equipment_type).filter(Boolean));
    if (type) set.add(type);
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [rows, type]);
  const filtered = useMemo(() => rows.filter(r => matches(r, search.trim(), type)), [rows, search, type]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilter = Boolean(search.trim() || type);

  const afterSave = async (id, verb) => {
    const ok = await load();
    onMutated?.();
    if (!ok) { toast.error(`${verb}แล้ว แต่โหลดรายการใหม่ไม่สำเร็จ — กดรีเฟรชรายการ ไม่ต้องบันทึกซ้ำ`); return; }
    setNotice(id ? { id, verb } : null);
  };

  const openForm = (id) => { openCountRef.current += 1; setNotice(null); setEditing({ id, key: openCountRef.current }); };
  const closeForm = () => setEditing(null);

  const exportExcel = () => {
    if (!rows.length) { toast.error('ไม่มีข้อมูลอุปกรณ์สำหรับส่งออก'); return; }
    const sheet = XLSX.utils.json_to_sheet(rows.map(item => Object.fromEntries(EXPORT_COLUMNS.map(([label, key]) => [label, item[key] ?? '-']))));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'อุปกรณ์');
    const name = String(site?.pea_name || `site-${siteId}`).replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(book, `Computer_Management_${name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`ส่งออก Excel ทั้งสำนักงานสำเร็จ (${rows.length} รายการ)`);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/office-equipment/${toDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) throw new Error(res.status === 403 ? 'คุณไม่มีสิทธิ์ลบอุปกรณ์' : body?.message || 'ลบอุปกรณ์ไม่สำเร็จ');
      toast.success(body?.message || 'ลบอุปกรณ์สำเร็จ');
      setToDelete(null);
      setViewing(null);
      if (!(await load())) toast.error('ลบแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ');
      onMutated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const noticeRow = notice && rows.find(r => String(r.id) === String(notice.id));
  const noticeHidden = noticeRow && !filtered.some(r => String(r.id) === String(notice.id));
  const siteTitle = site ? `${site.pea_name}${site.pea_province ? ` · ${site.pea_province}` : ''}` : `สำนักงาน #${siteId}`;

  if (editing) {
    return (
      <div className="list-page oe-page">
        <button type="button" className="list-button oe-back" onClick={() => formRef.current?.requestCancel()}><ArrowLeft size={18} aria-hidden="true" /> กลับรายการอุปกรณ์</button>
        <p className="oe-context">อุปกรณ์สำนักงาน · <strong>{siteTitle}</strong></p>
        <EquipmentForm
          key={editing.key}
          ref={formRef}
          equipmentId={editing.id}
          context={{ source: 'office', siteId: String(siteId), site, sitePolicy: 'locked', network: list.network }}
          user={user}
          token={token}
          onCancel={closeForm}
          onCreated={(id) => { load(); onMutated?.(); setNotice({ id, verb: 'เพิ่มอุปกรณ์' }); }}
          onSaved={(id) => { closeForm(); afterSave(id, id ? 'บันทึก' : 'เพิ่มอุปกรณ์'); }}
        />
      </div>
    );
  }

  return (
    <div className="list-page oe-page">
      <header className="list-header">
        <div>
          <button type="button" className="list-button oe-back" onClick={onBackToSites}><ArrowLeft size={18} aria-hidden="true" /> กลับรายชื่อสำนักงาน</button>
          <h2>อุปกรณ์สำนักงาน</h2>
          <p>{siteTitle}</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={exportExcel} disabled={!rows.length}><FileSpreadsheet size={18} aria-hidden="true" /> ส่งออก Excel ทั้งสำนักงาน</button>
          {canEdit && <button type="button" className="list-button list-button-primary" onClick={() => openForm('new')}><Plus size={18} aria-hidden="true" /> เพิ่มอุปกรณ์</button>}
        </div>
      </header>

      {list.status === 'error' || list.status === 'stale' ? (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{list.status === 'stale' ? 'โหลดรายการใหม่ไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดรายการอุปกรณ์ไม่สำเร็จ'}</strong><p>{list.error}</p></div>
          <button type="button" className="list-button" onClick={load}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
        </div>
      ) : null}

      {notice && noticeRow && (
        <div className="oe-notice" role="status">
          <span>{notice.verb}สำเร็จ: <strong>{noticeRow.name || `#${noticeRow.id}`}</strong>{noticeHidden && ' — ไม่ตรงกับตัวกรองปัจจุบันจึงไม่แสดงในตาราง'}</span>
          <div>
            {noticeHidden && <button type="button" className="list-button" onClick={() => { setSearch(''); setType(''); setPage(1); }}>ล้างตัวกรอง</button>}
            <button type="button" className="list-button" onClick={() => setViewing(noticeRow)}>ดูอุปกรณ์ที่บันทึก</button>
            <button type="button" className="list-button oe-icon" onClick={() => setNotice(null)} aria-label="ปิดข้อความ"><X size={16} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      <section className="list-panel" aria-label="รายการอุปกรณ์ของสำนักงาน">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหาอุปกรณ์</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder="ชื่อ IP MAC แผนก ผู้ถือครอง หรือผู้ขาย" onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </label>
          <label className={`list-field${type ? ' is-active' : ''}`}>
            <span>ประเภท</span>
            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              {types.map(t => <option key={t} value={t}>{rows.some(r => r.equipment_type === t) ? t : `${t} (ไม่พบในข้อมูลล่าสุด)`}</option>)}
            </select>
          </label>
          <button type="button" className="list-button" onClick={() => { setSearch(''); setType(''); setPage(1); }} disabled={!hasFilter}>ล้างตัวกรอง</button>
        </div>
        <div className="list-result-info" role="status">
          <span>{list.status === 'loading' ? 'กำลังโหลด...' : `พบ ${filtered.length} จาก ${rows.length} รายการ`}</span>
        </div>

        {list.status === 'loading' ? (
          <div className="oe-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลดข้อมูลอุปกรณ์...</div>
        ) : pageRows.length === 0 ? (
          <div className="oe-state">
            <p>{hasFilter ? 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง' : 'ยังไม่มีอุปกรณ์ในสำนักงานนี้'}</p>
            {hasFilter && <button type="button" className="list-button" onClick={() => { setSearch(''); setType(''); setPage(1); }}>ล้างตัวกรอง</button>}
          </div>
        ) : (
          <>
            <div className="list-table-scroll oe-table">
              <table className="list-table">
                <thead><tr><th scope="col">ชื่ออุปกรณ์</th><th scope="col">ประเภท</th><th scope="col">แผนก</th><th scope="col">IP Address</th><th scope="col">MAC Address</th><th scope="col">สถานะ</th><th scope="col">ผู้ถือครอง</th><th scope="col"><span className="list-sr-only">คำสั่ง</span></th></tr></thead>
                <tbody>
                  {pageRows.map(item => (
                    <tr key={item.id}>
                      <td><button type="button" className="oe-name" title={item.name || ''} onClick={() => setViewing(item)}>{item.name || `#${item.id}`}</button></td>
                      <td>{item.equipment_type || '—'}</td>
                      <td className="oe-ellipsis" title={item.department || ''}>{item.department || '—'}</td>
                      <td className="list-ip">{item.ip_address || '—'}</td>
                      <td className="list-ip">{item.mac_address || '—'}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td className="oe-ellipsis" title={item.asset_owner || ''}>{item.asset_owner || '—'}</td>
                      <td><div className="oe-row-actions">
                        <button type="button" className="list-button oe-icon" onClick={() => setViewing(item)} aria-label={`ดูรายละเอียด ${item.name || item.id}`}><Eye size={16} aria-hidden="true" /></button>
                        {canEdit && <button type="button" className="list-button oe-icon" onClick={() => openForm(String(item.id))} aria-label={`แก้ไข ${item.name || item.id}`}><Pencil size={16} aria-hidden="true" /></button>}
                        {canDelete && <button type="button" className="list-button oe-icon oe-danger" onClick={() => setToDelete(item)} aria-label={`ลบ ${item.name || item.id}`}><Trash2 size={16} aria-hidden="true" /></button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="oe-cards">
              {pageRows.map(item => (
                <li key={item.id}>
                  <div className="oe-card-head">
                    <button type="button" className="oe-name" onClick={() => setViewing(item)}>{item.name || `#${item.id}`}</button>
                    <StatusPill status={item.status} />
                  </div>
                  <dl>
                    <div><dt>ประเภท</dt><dd>{item.equipment_type || '—'}</dd></div>
                    <div><dt>IP</dt><dd className="list-ip">{item.ip_address || '—'}</dd></div>
                    <div><dt>แผนก</dt><dd>{item.department || '—'}</dd></div>
                  </dl>
                  <div className="oe-card-actions">
                    <button type="button" className="list-button" onClick={() => setViewing(item)}><Eye size={16} aria-hidden="true" /> รายละเอียด / QR</button>
                    {canEdit && <button type="button" className="list-button" onClick={() => openForm(String(item.id))}><Pencil size={16} aria-hidden="true" /> แก้ไข</button>}
                    {canDelete && <button type="button" className="list-button oe-danger" onClick={() => setToDelete(item)}><Trash2 size={16} aria-hidden="true" /> ลบ</button>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {list.status !== 'loading' && filtered.length > 0 && (
          <div className="list-footer">
            <span>แสดง {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} จาก {filtered.length} รายการ</span>
            <div className="list-pagination">
              <label>จำนวนต่อหน้า
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="button" className="list-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>ก่อนหน้า</button>
              <label><span className="list-sr-only">หน้า</span>
                <select value={currentPage} onChange={e => setPage(Number(e.target.value))}>
                  {Array.from({ length: totalPages }, (_, i) => <option key={i + 1} value={i + 1}>หน้า {i + 1} จาก {totalPages}</option>)}
                </select>
              </label>
              <button type="button" className="list-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>ถัดไป</button>
            </div>
          </div>
        )}
      </section>

      <DialogShell open={Boolean(viewing) && !qrItem && !historyOpen} onClose={() => setViewing(null)} labelledBy={`${detailsId}-title`} className="oe-details">
        {viewing && (
          <>
            <div className="oe-details-head">
              <div>
                <h2 id={`${detailsId}-title`}>{viewing.name || `อุปกรณ์ #${viewing.id}`}</h2>
                <StatusPill status={viewing.status} />
              </div>
              <button type="button" className="list-button oe-icon" onClick={() => setViewing(null)} aria-label="ปิด"><X size={18} aria-hidden="true" /></button>
            </div>
            <div className="oe-details-actions">
              <button type="button" className="list-button" onClick={() => setQrItem(viewing)}><QrCode size={16} aria-hidden="true" /> QR Code</button>
              <button type="button" className="list-button" onClick={() => setHistoryOpen(true)}><UserCog size={16} aria-hidden="true" /> ประวัติผู้ถือครอง</button>
              {canEdit && <button type="button" className="list-button list-button-primary" onClick={() => { const id = String(viewing.id); setViewing(null); openForm(id); }}><Pencil size={16} aria-hidden="true" /> แก้ไข</button>}
            </div>
            <dl className="oe-details-grid">
              {EXPORT_COLUMNS.filter(([, key]) => key !== 'name' && key !== 'status').map(([label, key]) => (
                <div key={key} className={key === 'notes' ? 'oe-wide' : undefined}><dt>{label}</dt><dd className={['ip_address', 'mac_address', 'wifi_mac_address', 'serial_number'].includes(key) ? 'list-ip' : undefined}>{viewing[key] || '—'}</dd></div>
              ))}
            </dl>
            {viewing.created_by && (
              <p className="list-muted">บันทึกโดย {viewing.created_by.first_name} {viewing.created_by.last_name} (@{viewing.created_by.username}){viewing.updatedAt && ` · แก้ไขล่าสุด ${new Date(viewing.updatedAt).toLocaleString('th-TH')}`}</p>
            )}
          </>
        )}
      </DialogShell>

      {qrItem && <QrCodeModal equipmentId={qrItem.id} equipmentName={qrItem.name} updatedAt={qrItem.updatedAt} onClose={() => setQrItem(null)} />}
      {historyOpen && viewing && <OwnerHistoryModal equipmentId={viewing.id} equipmentName={viewing.name} token={token} onClose={() => setHistoryOpen(false)} />}

      <ConfirmDialog
        open={Boolean(toDelete)} title="ยืนยันการลบอุปกรณ์" tone="danger" confirmLabel="ลบอุปกรณ์" busy={deleting}
        message={toDelete && <>ต้องการลบ <strong>{toDelete.name || `#${toDelete.id}`}</strong> ใช่หรือไม่? การลบย้อนกลับไม่ได้</>}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
