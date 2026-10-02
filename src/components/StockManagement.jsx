import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, History, Loader2, Plus, Printer, QrCode, RefreshCw, Repeat, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import BorrowReturnModal from './BorrowReturnModal';
import LoanHistoryModal from './LoanHistoryModal';
import QrCodeModal from './QrCodeModal';
import ModalFrame from './common/ModalFrame.jsx';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import { STATUS_OPTIONS } from './equipment-form/equipmentFields.js';
import SearchableDropdown from './SearchableDropdown';
import { QR_PER_PAGE, openPrintShell, fillPrintWindow } from './qrPrint';
import './ListPage.css';
import './StockManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;
const PAGE_SIZE = 15;
const MAX_NEW_QR = 200;

// The three stock rooms, plus "other" = equipment deployed anywhere else.
const STOCK_SITES = [
  { id: 198, name: 'โรงเก็บของใต้บันได ตึก 2' },
  { id: 199, name: 'โรงเก็บของอาคาร กรย.' },
  { id: 200, name: 'แผนกคอมพิวเตอร์และเครือข่าย' }
];
const STOCK_SITE_IDS = STOCK_SITES.map(s => s.id);
const EXCLUDE_STOCK_SITES_PARAM = STOCK_SITE_IDS.join(',');

// Filters/selection survive leaving the page (details open in another
// top-level tab), so they live in sessionStorage. Storage may be unavailable.
const KEYS = { tab: 'stock_active_site_tab', search: 'stock_search_term', status: 'stock_status_filter', site: 'stock_other_site_input', selected: 'stock_selected_ids', page: 'stock_page' };
const safeGet = (key, fallback) => { try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const safeSet = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* not remembered */ } };
const readTab = () => { const saved = safeGet(KEYS.tab, ''); if (saved === 'other') return 'other'; const n = Number(saved); return STOCK_SITE_IDS.includes(n) ? n : 198; };
const readSelected = () => { try { const v = JSON.parse(safeGet(KEYS.selected, '[]')); return new Set(Array.isArray(v) ? v.filter(Number.isFinite) : []); } catch { return new Set(); } };

const statusTone = (status) => {
  const s = String(status || '').trim();
  if (s === 'ใช้งาน' || s === 'active') return 'up';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'down';
  if (s.startsWith('รอ')) return 'warning';
  return 'unknown';
};
const siteLabel = (site) => (site ? `${site.pea_name}${site.pea_province ? ` (${site.pea_province})` : ''}` : '');

const StockManagement = ({ token, user, onBack, onEquipmentClick, onAddStock, onRequireLogin }) => {
  const canEdit = ['super_admin', 'computer_admin', 'network_admin', 'operator'].includes(user?.role);
  const canDelete = ['super_admin', 'computer_admin', 'network_admin'].includes(user?.role);
  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [activeTab, setActiveTab] = useState(readTab);
  const [searchInput, setSearchInput] = useState(() => safeGet(KEYS.search, ''));
  const [searchTerm, setSearchTerm] = useState(() => safeGet(KEYS.search, ''));
  const [statusFilter, setStatusFilter] = useState(() => { const v = safeGet(KEYS.status, 'All'); return v === 'All' || STATUS_OPTIONS.includes(v) ? v : 'All'; });
  const [siteInput, setSiteInput] = useState(() => safeGet(KEYS.site, ''));
  const [page, setPage] = useState(() => { const n = Number(safeGet(KEYS.page, '1')); return Number.isInteger(n) && n > 0 ? n : 1; });
  const [list, setList] = useState({ status: 'loading', items: [], total: 0, totalPages: 1, error: '' });
  const [counts, setCounts] = useState({ 198: null, 199: null, 200: null, other: null });
  const [peaSites, setPeaSites] = useState([]);
  const [selectedIds, setSelectedIds] = useState(readSelected);
  const [qrItem, setQrItem] = useState(null);
  const [borrowItem, setBorrowItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [newQr, setNewQr] = useState(null); // { quantity, error, busy }
  const [printCheck, setPrintCheck] = useState(null); // { ok:[], missing:[], busy }
  const requestRef = useRef(0);
  const headerCheckbox = useRef(null);

  const otherSites = useMemo(() => peaSites
    .filter(s => !STOCK_SITE_IDS.includes(Number(s.id)))
    .map(s => ({ id: String(s.id), name: siteLabel(s) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th')), [peaSites]);
  const matchedSite = otherSites.find(s => s.name === siteInput.trim()) || null;
  const siteFilter = activeTab === 'other' && matchedSite ? matchedSite.id : '';

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (activeTab === 'other') {
      if (siteFilter) p.append('pea_site_id', siteFilter); else p.append('exclude_pea_site_id', EXCLUDE_STOCK_SITES_PARAM);
    } else {
      p.append('pea_site_id', String(activeTab));
    }
    if (statusFilter !== 'All') p.append('status', statusFilter);
    if (searchTerm.trim()) p.append('search', searchTerm.trim());
    p.append('sort', 'createdAt');
    p.append('order', 'desc');
    p.append('page', String(page));
    p.append('limit', String(PAGE_SIZE));
    return p.toString();
  }, [activeTab, siteFilter, statusFilter, searchTerm, page]);

  const loadList = useCallback(async () => {
    const id = ++requestRef.current;
    try {
      const res = await fetch(`${API}/api/office-equipment/?${query}`, { headers: auth });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !Array.isArray(body.data)) throw new Error(body?.message || `HTTP ${res.status}`);
      if (id !== requestRef.current) return true;
      const total = Number(body.pagination?.total);
      const pages = Number(body.pagination?.totalPages);
      // A remembered page can be past the end once filters change.
      if (Number.isFinite(pages) && pages > 0 && page > pages) { setPage(pages); return true; }
      setList({ status: 'ready', items: body.data, total: Number.isFinite(total) ? total : body.data.length, totalPages: Number.isFinite(pages) && pages > 0 ? pages : 1, error: '' });
      return true;
    } catch (err) {
      if (id === requestRef.current) setList(prev => ({ ...prev, status: prev.items.length ? 'stale' : 'error', error: err.message || 'โหลดข้อมูลไม่สำเร็จ' }));
      return false;
    }
  }, [query, auth, page]);

  const loadCounts = useCallback(async () => {
    const countFor = async (params) => {
      try {
        const res = await fetch(`${API}/api/office-equipment/?${new URLSearchParams({ ...params, limit: '1' })}`, { headers: auth });
        const body = await res.json().catch(() => null);
        const n = Number(body?.pagination?.total);
        return res.ok && Number.isFinite(n) ? n : null;
      } catch { return null; }
    };
    const [a, b, c, other] = await Promise.all([
      countFor({ pea_site_id: '198' }), countFor({ pea_site_id: '199' }), countFor({ pea_site_id: '200' }),
      countFor({ exclude_pea_site_id: EXCLUDE_STOCK_SITES_PARAM })
    ]);
    setCounts({ 198: a, 199: b, 200: c, other });
  }, [auth]);

  useEffect(() => {
    loadCounts();
    const controller = new AbortController();
    fetch(`${API}/api/pea-jobs/sites`, { headers: auth, signal: controller.signal })
      .then(r => r.json()).then(body => { const l = Array.isArray(body) ? body : body?.data; if (Array.isArray(l)) setPeaSites(l); })
      .catch(() => { /* site filter falls back to "all other offices" */ });
    return () => controller.abort();
  }, [auth, loadCounts]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (searchInput === searchTerm) return undefined;
    const t = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput, searchTerm]);

  useEffect(() => { safeSet(KEYS.tab, String(activeTab)); }, [activeTab]);
  useEffect(() => { safeSet(KEYS.search, searchInput); }, [searchInput]);
  useEffect(() => { safeSet(KEYS.status, statusFilter); }, [statusFilter]);
  useEffect(() => { safeSet(KEYS.site, siteInput); }, [siteInput]);
  useEffect(() => { safeSet(KEYS.page, String(page)); }, [page]);
  useEffect(() => { safeSet(KEYS.selected, JSON.stringify([...selectedIds])); }, [selectedIds]);

  const items = list.items;
  const onPageSelected = items.filter(i => selectedIds.has(i.id)).length;
  const allOnPage = items.length > 0 && onPageSelected === items.length;
  useEffect(() => { if (headerCheckbox.current) headerCheckbox.current.indeterminate = onPageSelected > 0 && !allOnPage; }, [onPageSelected, allOnPage]);

  const toggle = (id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setSelectedIds(prev => { const next = new Set(prev); items.forEach(i => (allOnPage ? next.delete(i.id) : next.add(i.id))); return next; });
  const hasFilter = Boolean(searchInput.trim() || statusFilter !== 'All' || (activeTab === 'other' && siteInput.trim()));
  const clearFilters = () => { setSearchInput(''); setSearchTerm(''); setStatusFilter('All'); setSiteInput(''); setPage(1); };
  const changeTab = (tab) => { setActiveTab(tab); setPage(1); };

  // Existing items: verify every selected id still exists before printing,
  // and show which ones can't be printed instead of dropping them silently.
  const checkSelection = async () => {
    const ids = [...selectedIds];
    setPrintCheck({ ok: [], missing: [], busy: true });
    const results = [];
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = ids.slice(i, i + 8);
      results.push(...await Promise.all(chunk.map(async (id) => {
        try {
          const res = await fetch(`${API}/api/office-equipment/${id}`, { headers: auth });
          const body = await res.json().catch(() => null);
          if (res.ok && body?.data) return { id, name: body.data.name || '', ok: true };
          return { id, ok: false, reason: res.status === 404 ? 'ไม่พบ (อาจถูกลบแล้ว)' : `ตรวจสอบไม่ได้ (HTTP ${res.status})` };
        } catch { return { id, ok: false, reason: 'ตรวจสอบไม่ได้ (เชื่อมต่อไม่ได้)' }; }
      })));
    }
    setPrintCheck({ ok: results.filter(r => r.ok), missing: results.filter(r => !r.ok), busy: false });
  };

  const printChecked = () => {
    const w = openPrintShell();
    if (!w) { toast.error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้'); return; }
    fillPrintWindow(w, printCheck.ok);
    setSelectedIds(prev => { const next = new Set(prev); printCheck.missing.filter(m => m.reason.startsWith('ไม่พบ')).forEach(m => next.delete(m.id)); return next; });
    setPrintCheck(null);
  };

  // Creates N blank records (each gets a real id) so stickers can be printed
  // and attached before the device's details are filled in.
  const createAndPrint = async (e) => {
    e.preventDefault();
    const quantity = Number(newQr.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_NEW_QR) {
      setNewQr(s => ({ ...s, error: `กรุณาระบุจำนวนเต็ม 1–${MAX_NEW_QR}` }));
      return;
    }
    const w = openPrintShell();
    if (!w) { setNewQr(s => ({ ...s, error: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up แล้วลองใหม่ (ยังไม่ได้สร้างรายการ)' })); return; }
    setNewQr(s => ({ ...s, busy: true, error: '' }));
    const siteId = activeTab !== 'other' ? String(activeTab) : '';
    const createOne = async () => {
      try {
        const res = await fetch(`${API}/api/office-equipment`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...auth },
          body: new URLSearchParams({ name: 'อุปกรณ์ใหม่ (รอกรอกข้อมูล)', pea_site_id: siteId }).toString()
        });
        const body = await res.json().catch(() => null);
        return res.ok ? (body?.data?.id ?? body?.id ?? null) : null;
      } catch { return null; }
    };
    const created = (await Promise.all(Array.from({ length: quantity }, createOne))).filter(id => id != null);
    setNewQr(null);
    if (!created.length) { w.close(); toast.error('สร้างรายการอุปกรณ์สำหรับพิมพ์ QR ไม่สำเร็จ'); return; }
    fillPrintWindow(w, created.map(id => ({ id })));
    if (created.length < quantity) toast.error(`สร้างได้ ${created.length} จาก ${quantity} รายการ (บางรายการล้มเหลว)`, { duration: 8000 });
    else toast.success(`สร้างรายการสำหรับพิมพ์ QR ${created.length} รายการ`);
    loadList(); loadCounts();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/office-equipment/${toDelete.id}`, { method: 'DELETE', headers: auth });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) throw new Error(res.status === 403 ? 'คุณไม่มีสิทธิ์ลบอุปกรณ์' : body?.message || 'ลบอุปกรณ์ไม่สำเร็จ');
      toast.success(body?.message || 'ลบอุปกรณ์สำเร็จ');
      setSelectedIds(prev => { const next = new Set(prev); next.delete(toDelete.id); return next; });
      setToDelete(null);
      if (!(await loadList())) toast.error('ลบแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ');
      loadCounts();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openBorrow = (item) => { if (!user) { onRequireLogin?.(); return; } setBorrowItem(item); };
  const nameLink = (item) => (
    <a className="list-name" href={`/equipment/${item.id}`} title={item.name || undefined}
      onClick={(e) => { if (!onEquipmentClick || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onEquipmentClick(item.id); }}>
      {item.name || `อุปกรณ์ #${item.id}`}
    </a>
  );
  const actions = (item, withText) => (
    <>
      <button type="button" className={`list-button${withText ? '' : ' sm-icon'}`} onClick={() => setQrItem(item)} aria-label={withText ? undefined : `QR Code ของ ${item.name || item.id}`}><QrCode size={16} aria-hidden="true" />{withText && ' QR'}</button>
      <button type="button" className={`list-button${withText ? '' : ' sm-icon'}`} onClick={() => openBorrow(item)} aria-label={withText ? undefined : `ยืม/คืน ${item.name || item.id}`}><Repeat size={16} aria-hidden="true" />{withText && ' ยืม/คืน'}</button>
      <button type="button" className={`list-button${withText ? '' : ' sm-icon'}`} onClick={() => setHistoryItem(item)} aria-label={withText ? undefined : `ประวัติการยืม-คืนของ ${item.name || item.id}`}><History size={16} aria-hidden="true" />{withText && ' ประวัติ'}</button>
      {canDelete && <button type="button" className={`list-button sm-danger${withText ? '' : ' sm-icon'}`} onClick={() => setToDelete(item)} aria-label={withText ? undefined : `ลบ ${item.name || item.id}`}><Trash2 size={16} aria-hidden="true" />{withText && ' ลบ'}</button>}
    </>
  );
  const count = (n) => (n === null ? '—' : n.toLocaleString('th-TH'));
  const first = list.total ? (page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <div className="list-page sm-page">
      <header className="list-header">
        <div>
          <button type="button" className="list-button sm-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> กลับ</button>
          <h2>คลังอุปกรณ์</h2>
          <p>อุปกรณ์ในคลังจัดเก็บทั้ง 3 แห่ง และอุปกรณ์ที่ติดตั้งที่สำนักงานอื่น</p>
        </div>
        {canEdit && (
          <div className="list-actions">
            <button type="button" className="list-button" onClick={() => setNewQr({ quantity: '1', error: '', busy: false })}><Printer size={18} aria-hidden="true" /> พิมพ์ QR (สร้างรายการใหม่)</button>
            <button type="button" className="list-button list-button-primary" onClick={() => onAddStock?.(activeTab !== 'other' ? activeTab : null)}><Plus size={18} aria-hidden="true" /> เพิ่มอุปกรณ์เข้าคลัง</button>
          </div>
        )}
      </header>

      <div className="sm-tabs" role="group" aria-label="สถานที่จัดเก็บ">
        {[...STOCK_SITES, { id: 'other', name: 'สำนักงานอื่น' }].map(site => (
          <button key={site.id} type="button" className={`sm-tab${activeTab === site.id ? ' is-active' : ''}`} aria-pressed={activeTab === site.id} onClick={() => changeTab(site.id)}>
            {site.name}<span className="sm-count">{count(counts[site.id])}</span>
          </button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="sm-selection" role="status">
          <span>เลือกไว้ <strong>{selectedIds.size}</strong> รายการ{selectedIds.size !== onPageSelected && ` (อยู่ในหน้านี้ ${onPageSelected})`} — การเลือกคงอยู่เมื่อเปลี่ยนหน้าหรือแท็บ</span>
          <div>
            <button type="button" className="list-button list-button-primary" onClick={checkSelection}><Printer size={18} aria-hidden="true" /> พิมพ์ QR ที่เลือก</button>
            <button type="button" className="list-button" onClick={() => setSelectedIds(new Set())}><X size={18} aria-hidden="true" /> ล้างที่เลือก</button>
          </div>
        </div>
      )}

      {(list.status === 'error' || list.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{list.status === 'stale' ? 'โหลดรายการใหม่ไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดรายการอุปกรณ์ไม่สำเร็จ'}</strong><p>{list.error}</p></div>
          <button type="button" className="list-button" onClick={loadList}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายการอุปกรณ์ในคลัง">
        <div className="list-toolbar">
          <label className={`list-field list-search${searchInput ? ' is-active' : ''}`}>
            <span>ค้นหาอุปกรณ์</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={searchInput} placeholder="ชื่ออุปกรณ์ แผนก สำนักงาน หรือ IP" onChange={e => setSearchInput(e.target.value)} />
            </div>
          </label>
          {activeTab === 'other' && (
            <div className={`list-field sm-site-field${siteInput ? ' is-active' : ''}`}>
              <label htmlFor="sm-site-filter">สำนักงาน</label>
              <SearchableDropdown
                inputId="sm-site-filter"
                label="สำนักงาน"
                placeholder="ทุกสำนักงาน"
                value={siteInput}
                onChange={v => { setSiteInput(v); setPage(1); }}
                options={[...new Set(otherSites.map(s => s.name))]}
                describedBy={siteInput && !matchedSite ? 'sm-site-hint' : undefined}
              />
              {siteInput && !matchedSite && <span id="sm-site-hint" className="sm-hint">ยังไม่ตรงกับสำนักงานในรายการ จึงแสดงทุกสำนักงาน</span>}
            </div>
          )}
          <label className={`list-field${statusFilter !== 'All' ? ' is-active' : ''}`}>
            <span>สถานะ</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="All">ทั้งหมด</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="button" className="list-button" onClick={clearFilters} disabled={!hasFilter}>ล้างตัวกรอง</button>
        </div>
        {list.status !== 'loading' && list.status !== 'error' && <div className="list-result-info" role="status"><span>{list.total ? `แสดง ${first}–${Math.min(page * PAGE_SIZE, list.total)} จาก ${list.total.toLocaleString('th-TH')} รายการ` : ''}</span></div>}

        {list.status === 'loading' ? (
          <div className="sm-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลดรายการอุปกรณ์...</div>
        ) : list.status === 'error' ? (
          <div className="sm-state">ยังไม่มีข้อมูลให้แสดง</div>
        ) : items.length === 0 ? (
          <div className="sm-state"><p>{hasFilter ? 'ไม่พบอุปกรณ์ตามตัวกรอง' : 'ยังไม่มีอุปกรณ์ในที่จัดเก็บนี้'}</p>{hasFilter && <button type="button" className="list-button" onClick={clearFilters}>ล้างตัวกรอง</button>}</div>
        ) : (
          <>
            <div className="list-table-scroll sm-table" tabIndex={0} role="region" aria-label="ตารางอุปกรณ์ในคลัง">
              <table className="list-table">
                <caption className="list-sr-only">อุปกรณ์ในคลัง หน้า {page} จาก {list.totalPages}</caption>
                <thead><tr>
                  <th scope="col" className="sm-check"><input ref={headerCheckbox} type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="เลือกทั้งหมดในหน้านี้" /></th>
                  <th scope="col" className="sm-num">ID</th><th scope="col">ชื่ออุปกรณ์</th><th scope="col">ประเภท</th><th scope="col">รหัสทรัพย์สิน</th>
                  <th scope="col">Serial Number</th><th scope="col">ผู้ถือครอง</th><th scope="col">สำนักงาน</th><th scope="col">สถานะ</th>
                  <th scope="col"><span className="list-sr-only">คำสั่ง</span></th>
                </tr></thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className={selectedIds.has(item.id) ? 'sm-selected' : undefined}>
                      <td className="sm-check"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} aria-label={`เลือก ${item.name || item.id}`} /></td>
                      <td className="sm-num list-number">{item.id}</td>
                      <td>{nameLink(item)}</td>
                      <td className="sm-ellipsis" title={item.equipment_type || ''}>{item.equipment_type || '—'}</td>
                      <td className="list-ip sm-ellipsis" title={item.asset_number || ''}>{item.asset_number || '—'}</td>
                      <td className="list-ip sm-ellipsis" title={item.serial_number || ''}>{item.serial_number || '—'}</td>
                      <td className="sm-ellipsis" title={item.asset_owner || ''}>{item.asset_owner || '—'}</td>
                      <td className="sm-ellipsis" title={siteLabel(item.pea_site)}>{siteLabel(item.pea_site) || '—'}</td>
                      <td><span className={`list-status list-status-${statusTone(item.status)}`}>{item.status || 'ไม่ระบุ'}</span></td>
                      <td><div className="sm-actions">{actions(item, false)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="sm-cards">
              {items.map(item => (
                <li key={item.id} className={selectedIds.has(item.id) ? 'sm-selected' : undefined}>
                  <div className="sm-card-head">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} aria-label={`เลือก ${item.name || item.id}`} />
                    <div>{nameLink(item)}<span className="list-muted"> · ID {item.id}</span></div>
                  </div>
                  <span className={`list-status list-status-${statusTone(item.status)}`}>{item.status || 'ไม่ระบุ'}</span>
                  <dl>
                    <div><dt>ประเภท</dt><dd>{item.equipment_type || '—'}</dd></div>
                    <div><dt>รหัสทรัพย์สิน</dt><dd className="list-ip">{item.asset_number || '—'}</dd></div>
                    <div><dt>ผู้ถือครอง</dt><dd>{item.asset_owner || '—'}</dd></div>
                    <div><dt>สำนักงาน</dt><dd>{siteLabel(item.pea_site) || '—'}</dd></div>
                  </dl>
                  <div className="sm-actions sm-card-actions">{actions(item, true)}</div>
                </li>
              ))}
            </ul>
            <div className="list-footer">
              <label className="sm-select-page"><input type="checkbox" checked={allOnPage} onChange={togglePage} /> เลือกทั้งหมดในหน้านี้ ({items.length})</label>
              <div className="list-pagination">
                <button type="button" className="list-button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>ก่อนหน้า</button>
                <label><span className="list-sr-only">หน้า</span>
                  <select value={Math.min(page, list.totalPages)} onChange={e => setPage(Number(e.target.value))}>
                    {Array.from({ length: list.totalPages }, (_, i) => <option key={i + 1} value={i + 1}>หน้า {i + 1} จาก {list.totalPages}</option>)}
                  </select>
                </label>
                <button type="button" className="list-button" onClick={() => setPage(p => Math.min(list.totalPages, p + 1))} disabled={page >= list.totalPages}>ถัดไป</button>
              </div>
            </div>
          </>
        )}
      </section>

      {qrItem && <QrCodeModal equipmentId={qrItem.id} equipmentName={qrItem.name} updatedAt={qrItem.updatedAt} onClose={() => setQrItem(null)} />}
      {borrowItem && <BorrowReturnModal equipmentId={borrowItem.id} equipmentName={borrowItem.name} token={token} onClose={() => setBorrowItem(null)} onChanged={() => { setBorrowItem(null); loadList(); }} />}
      {historyItem && <LoanHistoryModal equipmentId={historyItem.id} equipmentName={historyItem.name} onClose={() => setHistoryItem(null)} />}

      {newQr && (
        <ModalFrame title="พิมพ์ QR (สร้างรายการใหม่)" icon={<Printer size={20} aria-hidden="true" />} busy={newQr.busy} onClose={() => setNewQr(null)}>
          <form onSubmit={createAndPrint} noValidate>
            <p className="mf-meta">ระบบจะสร้างรายการอุปกรณ์เปล่า "อุปกรณ์ใหม่ (รอกรอกข้อมูล)" {activeTab !== 'other' ? `ใน ${STOCK_SITES.find(s => s.id === activeTab)?.name}` : '(ยังไม่ระบุสำนักงาน)'} ตามจำนวนที่ระบุ แล้วเปิดหน้าต่างพิมพ์ ({QR_PER_PAGE} QR ต่อ A4) — รายการที่สร้างแล้วจะอยู่ในระบบแม้ไม่ได้พิมพ์</p>
            <div className={`mf-field${newQr.error ? ' is-invalid' : ''}`}>
              <label htmlFor="sm-qr-qty">จำนวนที่ต้องการ (1–{MAX_NEW_QR})</label>
              <input id="sm-qr-qty" type="number" inputMode="numeric" min="1" max={MAX_NEW_QR} value={newQr.quantity} disabled={newQr.busy}
                aria-invalid={newQr.error ? 'true' : undefined} aria-describedby={newQr.error ? 'sm-qr-error' : undefined}
                onChange={e => setNewQr(s => ({ ...s, quantity: e.target.value, error: '' }))} />
              {newQr.error && <p id="sm-qr-error" className="mf-field-error" role="alert">{newQr.error}</p>}
            </div>
            <div className="mf-actions">
              <button type="button" className="mf-button" onClick={() => setNewQr(null)} disabled={newQr.busy}>ยกเลิก</button>
              <button type="submit" className="mf-button mf-primary" disabled={newQr.busy}>
                {newQr.busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Printer size={18} aria-hidden="true" />} {newQr.busy ? 'กำลังสร้างรายการ...' : 'สร้างและพิมพ์'}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {printCheck && (
        <ModalFrame title="พิมพ์ QR ที่เลือก" icon={<Printer size={20} aria-hidden="true" />} busy={printCheck.busy} onClose={() => setPrintCheck(null)}>
          {printCheck.busy ? <p className="mf-state" role="status">กำลังตรวจสอบรายการที่เลือก...</p> : (
            <>
              <p>พิมพ์ได้ <strong>{printCheck.ok.length}</strong> รายการ{printCheck.missing.length > 0 && <>, พิมพ์ไม่ได้ <strong>{printCheck.missing.length}</strong> รายการ</>}</p>
              {printCheck.missing.length > 0 && (
                <ul className="mf-list sm-missing">
                  {printCheck.missing.map(m => <li key={m.id}>ID {m.id} — {m.reason}</li>)}
                </ul>
              )}
              {printCheck.missing.some(m => m.reason.startsWith('ไม่พบ')) && <p className="mf-meta">รายการที่ไม่พบจะถูกนำออกจากที่เลือกหลังพิมพ์</p>}
              <div className="mf-actions">
                <button type="button" className="mf-button" onClick={() => setPrintCheck(null)}>ยกเลิก</button>
                <button type="button" className="mf-button mf-primary" onClick={printChecked} disabled={!printCheck.ok.length}><Printer size={18} aria-hidden="true" /> พิมพ์ {printCheck.ok.length} รายการ</button>
              </div>
            </>
          )}
        </ModalFrame>
      )}

      <ConfirmDialog open={Boolean(toDelete)} title="ยืนยันการลบอุปกรณ์" tone="danger" confirmLabel="ลบอุปกรณ์" busy={deleting}
        message={toDelete && <>ต้องการลบ <strong>{toDelete.name || `#${toDelete.id}`}</strong> ใช่หรือไม่? การลบย้อนกลับไม่ได้</>}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
};

export default StockManagement;
