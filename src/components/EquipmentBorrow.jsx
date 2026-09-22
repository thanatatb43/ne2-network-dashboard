import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  Search, Loader2, RefreshCw, AlertCircle, ShoppingCart, X, Plus, Check,
  CheckCircle2, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ListPage.css';
import './EquipmentBorrow.css';
import SearchableDropdown from './SearchableDropdown';

// Same fixed option lists OfficeEquipmentManagement.jsx's create/edit form
// uses, duplicated here since they aren't exported from that file.
const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];
const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];
// "ถูกยืม" isn't one of the record's own lifecycle statuses -- it's what the
// API reports when an item currently has an open loan -- but it's still a
// valid filter value, so it's listed separately from the fixed lifecycle list.
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน', 'ถูกยืม'];
const PRIMARY_FIELDS = [
  ['equipment_type', 'ประเภท', EQUIPMENT_TYPE_OPTIONS],
  ['department', 'แผนก', DEPARTMENT_OPTIONS],
  ['status', 'สถานะ', STATUS_OPTIONS],
];
const emptyPrimary = { equipment_type: '', department: '', status: '' };

// photos come back from the API as relative paths (e.g.
// "/uploads/office-equipment/9-xxx.png") that need the backend's own origin
// prefixed to be viewable -- same convention as EquipmentDetails.jsx.
const buildImageUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;
const siteLabel = (s) => `${s.pea_name}${s.pea_province || s.province ? ` (${s.pea_province || s.province})` : ''}`;
// Same tone groups as EquipmentSearch.jsx's statusTone, plus "borrowed" for
// the API-derived loan status this page cares about.
const statusTone = (status) => {
  if (status === 'ใช้งาน') return 'up';
  if (['รอปรับปรุง', 'รอจำหน่าย', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน'].includes(status)) return 'warning';
  if (['เลิกใช้งาน', 'จำหน่าย'].includes(status)) return 'down';
  if (status === 'ถูกยืม') return 'borrowed';
  return 'unknown';
};

// due_date is a full timestamp; <input type="datetime-local"> gives back a
// naive "YYYY-MM-DDTHH:mm" string with no timezone, so it's treated
// explicitly as Thailand local time (+07:00) to match what the backend
// expects -- same convention BorrowReturnModal.jsx already uses.
const toBangkokIso = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return '';
  return `${datetimeLocalValue}:00+07:00`;
};

// Basic modal accessibility (name via aria-labelledby, aria-modal, initial
// focus, Tab trap, and returning focus to the opener on close) -- there is
// no shared Modal component yet (see DESIGN_STANDARDS.md section 12), so
// this is a small local implementation reused across this page's 3 dialogs.
const useModalA11y = (open, containerRef, onEscape) => {
  const openerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const getFocusable = () => Array.from(
      containerRef.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []
    ).filter(el => !el.disabled);
    (getFocusable()[0] || containerRef.current)?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onEscape?.(); return; }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
};

const EquipmentBorrow = ({ token, user, onRequireLogin, onEquipmentClick }) => {
  const itemsPerPage = 10;
  const [inputs, setInputs] = useState({ search: '', site: '', primary: emptyPrimary });
  const [filters, setFilters] = useState(inputs);
  const [currentPage, setCurrentPage] = useState(1);
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState(false);
  const [siteRetry, setSiteRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const [cart, setCart] = useState([]); // array of equipment objects
  const [showCart, setShowCart] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmpId, setBorrowerEmpId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseModal, setResponseModal] = useState(null); // { type: 'success' | 'error', message: string }

  const cartRef = useRef(null);
  const confirmRef = useRef(null);
  const responseRef = useRef(null);
  useModalA11y(showCart, cartRef, () => setShowCart(false));
  useModalA11y(showConfirm, confirmRef, () => { if (!submitting) setShowConfirm(false); });
  useModalA11y(Boolean(responseModal), responseRef, () => setResponseModal(null));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setSitesLoading(true);
      setSitesError(false);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const list = data.data || data;
        if (!Array.isArray(list)) throw new Error();
        if (active) setSites(list);
      } catch { if (active) setSitesError(true); }
      finally { clearTimeout(timer); if (active) setSitesLoading(false); }
    };
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [token, siteRetry]);

  // Debounces every typed filter into a single committed set 400ms after the
  // user stops typing, and resets to page 1 -- same convention as
  // EquipmentSearch.jsx.
  useEffect(() => {
    if (inputs === filters) return;
    const timer = setTimeout(() => { setFilters(inputs); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [inputs, filters]);

  // สำนักงาน only resolves to a real pea_site_id once the typed text exactly
  // matches a known site's label (i.e. the user picked a suggestion or typed
  // the full name) -- partial text just leaves the site filter unset.
  const site = sites.find(s => siteLabel(s) === filters.site);
  const siteInputMatches = sites.some(s => siteLabel(s) === inputs.site);
  const waitingForSite = Boolean(filters.site && sitesLoading);
  const requestParams = (() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(itemsPerPage));
    if (filters.search.trim()) params.set('search', filters.search.trim());
    Object.entries(filters.primary).forEach(([k, v]) => { if (v.trim()) params.set(k, v.trim()); });
    if (site) params.set('pea_site_id', String(site.id));
    return params;
  })();
  const requestKey = requestParams.toString();
  const pending = inputs !== filters || waitingForSite || loading || result?.key !== requestKey || result?.token !== token;

  useEffect(() => {
    if (waitingForSite) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment?${requestKey}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) throw new Error();
        if (!active) return;
        const total = Number(data.pagination?.total ?? data.data.length);
        const totalPages = Math.max(1, Number(data.pagination?.totalPages) || Math.ceil(total / itemsPerPage));
        if (currentPage > totalPages) { setCurrentPage(totalPages); return; }
        setResult({ equipment: data.data, total, totalPages, page: currentPage, key: requestKey, token, updated: new Date() });
      } catch { if (active) setError('ไม่สามารถโหลดรายการอุปกรณ์ได้ กรุณาลองใหม่'); }
      finally { clearTimeout(timer); if (active) setLoading(false); }
    };
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [requestKey, token, retry, waitingForSite, currentPage]);

  // Only show rows matching this page's current filters/auth context, so an
  // in-flight response for a stale search never overwrites a newer one.
  const shown = result?.key === requestKey && result?.token === token ? result : null;
  const anyFilterActive = Boolean(inputs.search || inputs.site || Object.values(inputs.primary).some(Boolean));
  const change = (key, value) => setInputs(prev => ({ ...prev, [key]: value }));
  const changeField = (key, value) => setInputs(prev => ({ ...prev, primary: { ...prev.primary, [key]: value } }));
  const clearAllFilters = () => {
    const cleared = { search: '', site: '', primary: emptyPrimary };
    setInputs(cleared); setFilters(cleared); setCurrentPage(1);
  };

  const isBorrowed = (item) => item.status === 'ถูกยืม' || !!item.current_loan;
  const isInCart = (item) => cart.some(c => c.id === item.id);

  const toggleCart = (item) => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    if (isBorrowed(item)) return;
    setCart(prev => isInCart(item) ? prev.filter(c => c.id !== item.id) : [...prev, item]);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));

  const openCart = () => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    setShowCart(true);
  };

  const handleBorrowClick = () => {
    if (cart.length === 0) return;
    if (!borrowerName.trim()) {
      toast.error('กรุณากรอกชื่อผู้ยืม');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmBorrow = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/borrow-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipment_ids: cart.map(c => c.id),
          borrower_name: borrowerName.trim(),
          borrower_emp_id: borrowerEmpId.trim(),
          due_date: toBangkokIso(dueDate)
        })
      });
      const result = await response.json();
      if (response.ok) {
        setResponseModal({ type: 'success', message: result.message || `ยืมอุปกรณ์สำเร็จ ${cart.length} รายการ` });
        setCart([]);
        setBorrowerName('');
        setBorrowerEmpId('');
        setDueDate('');
        setShowConfirm(false);
        setShowCart(false);
        setRetry(n => n + 1);
      } else {
        setResponseModal({ type: 'error', message: result.message || result.error || 'ยืมอุปกรณ์ไม่สำเร็จ' });
      }
    } catch (error) {
      console.error('Error submitting borrow batch:', error);
      setResponseModal({ type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="list-page equipment-borrow-page">
      <header className="list-header">
        <div>
          <h1>ยืมอุปกรณ์</h1>
          <p>เลือกอุปกรณ์ที่ต้องการยืมลงตระกร้า แล้วยืนยันการยืมพร้อมกันได้หลายชิ้น</p>
        </div>
        <div className="list-actions">
          <button className="list-button" disabled={loading || waitingForSite} onClick={() => setRetry(n => n + 1)}>
            <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />รีเฟรช
          </button>
        </div>
      </header>

      {error && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <strong>{error}</strong>
            {shown && <p>แสดงรายการจากการโหลดครั้งก่อน ข้อมูลอาจเปลี่ยนแปลงแล้ว</p>}
          </div>
          <button className="list-button" disabled={loading} onClick={() => setRetry(n => n + 1)}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="ค้นหาและกรองอุปกรณ์ที่ยืมได้">
        <div className="equipment-borrow-filters">
          <label className="list-field equipment-borrow-search-filter">
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่อ / รหัสทรัพย์สิน / Serial / IP / MAC" value={inputs.search} onChange={(e) => change('search', e.target.value)} />
            </div>
          </label>
          {PRIMARY_FIELDS.map(([key, label, options]) => (
            <label className="list-field" key={key}>
              <span>{label}</span>
              <SearchableDropdown label={label} placeholder="ทั้งหมด" value={inputs.primary[key]} onChange={(value) => changeField(key, value)} options={options} />
            </label>
          ))}
          <label className="list-field">
            <span>สำนักงาน</span>
            <SearchableDropdown
              label="สำนักงาน"
              placeholder={sitesLoading ? 'กำลังโหลดสำนักงาน…' : 'ทั้งหมด'}
              value={inputs.site}
              onChange={(value) => change('site', value)}
              describedBy="equipment-borrow-site-help"
              options={[...new Set(sites.map(siteLabel))]}
            />
          </label>
        </div>
        <div className="equipment-borrow-filter-help" id="equipment-borrow-site-help">
          {sitesError ? (
            <span role="alert">โหลดรายชื่อสำนักงานไม่สำเร็จ <button className="list-button" onClick={() => setSiteRetry(n => n + 1)}>โหลดสำนักงานใหม่</button></span>
          ) : inputs.site && !siteInputMatches && !sitesLoading ? (
            <span className="list-filter-warning">ยังไม่ได้กรองสำนักงาน กรุณาเลือกชื่อให้ตรงกับรายการแนะนำ</span>
          ) : 'สำนักงานต้องเลือกชื่อให้ตรงกับรายการแนะนำ ส่วนตัวกรองอื่นเลือกจากรายการแนะนำ'}
        </div>
        <div className="equipment-borrow-filter-actions">
          <button className="list-button" disabled={!anyFilterActive} onClick={clearAllFilters}>ล้างตัวกรอง</button>
          <span className="list-muted">ค้นหาอัตโนมัติ · ใช้ทุกเงื่อนไขร่วมกัน</span>
        </div>

        <div className="list-result-info">
          <span role="status">{error ? 'โหลดไม่สำเร็จ' : pending ? 'กำลังโหลด…' : `พบ ${shown?.total.toLocaleString('th-TH') ?? 0} รายการ`}</span>
          <span>{shown && `อัปเดตล่าสุด ${shown.updated.toLocaleTimeString('th-TH')}`}</span>
        </div>

        {!shown || !shown.equipment.length ? (
          <div className="equipment-borrow-empty">
            <strong>{error ? 'ไม่สามารถแสดงรายการล่าสุด' : pending ? 'กำลังโหลดรายการอุปกรณ์…' : anyFilterActive ? 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง' : 'ยังไม่มีอุปกรณ์ในระบบ'}</strong>
            {!pending && !error && anyFilterActive && (
              <>
                <p>ลองเปลี่ยนคำค้น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
                <button className="list-button" onClick={clearAllFilters}>ล้างตัวกรอง</button>
              </>
            )}
          </div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางอุปกรณ์ที่ยืมได้ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" aria-busy={pending}>
            <table className="list-table">
              <caption className="list-sr-only">รายการอุปกรณ์ที่ยืมได้ กดชื่ออุปกรณ์เพื่อเปิดรายละเอียด กดเพิ่มลงตระกร้าเพื่อเลือกยืม</caption>
              <thead>
                <tr>
                  {['ชื่ออุปกรณ์', 'ประเภท', 'แผนก', 'สำนักงาน', 'สถานะ', 'ดำเนินการ'].map(label => <th scope="col" key={label}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.equipment.map(item => {
                  const borrowed = isBorrowed(item);
                  const inCart = isInCart(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="equipment-name-cell">
                          {item.photos?.[0] && <img src={buildImageUrl(item.photos[0])} alt="" loading="lazy" />}
                          <a
                            className="list-name"
                            title={item.name || 'ดูรายละเอียดอุปกรณ์'}
                            href={`/equipment/${item.id}`}
                            onClick={(e) => {
                              if (onEquipmentClick && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                e.preventDefault();
                                onEquipmentClick(item.id);
                              }
                            }}
                          >
                            {item.name || 'ดูรายละเอียดอุปกรณ์'}
                          </a>
                        </div>
                      </td>
                      <td title={item.equipment_type || '—'}>{item.equipment_type || '—'}</td>
                      <td title={item.department || '—'}>{item.department || '—'}</td>
                      <td title={item.pea_site ? siteLabel(item.pea_site) : '—'}>{item.pea_site ? siteLabel(item.pea_site) : '—'}</td>
                      <td title={[item.status || 'ไม่ทราบสถานะ', borrowed && item.current_loan?.borrower_name && `โดย ${item.current_loan.borrower_name}`].filter(Boolean).join(' · ')}>
                        <span className={`list-status list-status-${statusTone(item.status)}`}>{item.status || 'ไม่ทราบสถานะ'}</span>
                        {borrowed && item.current_loan?.borrower_name && <span className="list-muted"> · โดย {item.current_loan.borrower_name}</span>}
                      </td>
                      <td>
                        {borrowed ? (
                          <span className="list-muted">ถูกยืมอยู่</span>
                        ) : (
                          <button type="button" className={`list-button${inCart ? '' : ' list-button-primary'}`} onClick={() => toggleCart(item)}>
                            {inCart ? <><Check size={14} aria-hidden="true" /> อยู่ในตระกร้า</> : <><Plus size={14} aria-hidden="true" /> เพิ่มลงตระกร้า</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="list-footer">
          <span className="list-muted">{shown?.total ? `${(shown.page - 1) * itemsPerPage + 1}–${(shown.page - 1) * itemsPerPage + shown.equipment.length} จาก ${shown.total} รายการ` : '—'} · {itemsPerPage} รายการต่อหน้า</span>
          <nav className="list-pagination" aria-label="แบ่งหน้ารายการอุปกรณ์">
            <button className="list-button" disabled={pending || Boolean(error) || currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>ก่อนหน้า</button>
            <label>หน้า <select value={shown?.page || currentPage} disabled={pending || Boolean(error)} onChange={(e) => setCurrentPage(Number(e.target.value))}>
              {Array.from({ length: Math.max(currentPage, shown?.totalPages || 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select> / {shown?.totalPages || '—'}</label>
            <button className="list-button" disabled={pending || Boolean(error) || !shown || currentPage >= shown.totalPages} onClick={() => setCurrentPage(p => p + 1)}>ถัดไป</button>
          </nav>
        </footer>
      </section>

      {/* Floating cart button */}
      <button type="button" className="equipment-borrow-cart-fab" onClick={openCart} aria-label={`เปิดตระกร้ายืมอุปกรณ์ (${cart.length} รายการ)`}>
        <ShoppingCart size={22} aria-hidden="true" />
        {cart.length > 0 && <span className="equipment-borrow-cart-badge" aria-hidden="true">{cart.length}</span>}
      </button>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 9998 }}
            onClick={() => setShowCart(false)}
          >
            <motion.div
              ref={cartRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="equipment-borrow-cart-heading"
              tabIndex={-1}
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ width: '100%', maxWidth: '420px', height: '100%', overflowY: 'auto', padding: '1.5rem', borderRadius: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 id="equipment-borrow-cart-heading" style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={18} aria-hidden="true" /> ตระกร้ายืมอุปกรณ์ ({cart.length})
                </h2>
                <button onClick={() => setShowCart(false)} className="glass" aria-label="ปิดตระกร้ายืมอุปกรณ์" style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>ยังไม่มีอุปกรณ์ในตระกร้า</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {cart.map(item => (
                      <div key={item.id} className="equipment-borrow-drawer-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          {item.photos?.[0] && <img src={buildImageUrl(item.photos[0])} alt="" />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '-'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.equipment_type || '-'}</div>
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} aria-label={`นำ ${item.name || 'อุปกรณ์'} ออกจากตระกร้า`} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div className="equipment-borrow-field">
                      <label htmlFor="equipment-borrow-name">ชื่อผู้ยืม <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
                      <input id="equipment-borrow-name" type="text" required aria-required="true" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="ชื่อ-นามสกุลผู้ยืม" />
                    </div>
                    <div className="equipment-borrow-field">
                      <label htmlFor="equipment-borrow-emp-id">รหัสพนักงานผู้ยืม</label>
                      <input id="equipment-borrow-emp-id" type="text" value={borrowerEmpId} onChange={(e) => setBorrowerEmpId(e.target.value)} />
                    </div>
                    <div className="equipment-borrow-field">
                      <label htmlFor="equipment-borrow-due-date">กำหนดคืน (วันและเวลา)</label>
                      <input id="equipment-borrow-due-date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>

                    <button type="button" className="list-button list-button-primary" style={{ marginTop: '0.5rem', minHeight: '44px' }} onClick={handleBorrowClick}>
                      <ShoppingCart size={16} aria-hidden="true" /> ยืมอุปกรณ์ {cart.length} รายการ
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm borrow modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}
            onClick={() => !submitting && setShowConfirm(false)}
          >
            <motion.div
              ref={confirmRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="equipment-borrow-confirm-heading"
              tabIndex={-1}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <ShoppingCart size={24} aria-hidden="true" />
              </div>
              <h2 id="equipment-borrow-confirm-heading" style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>ยืนยันการยืมอุปกรณ์</h2>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                ยืมอุปกรณ์ <strong style={{ color: 'var(--text-primary)' }}>{cart.length} รายการ</strong> ให้<br />
                <strong style={{ color: 'var(--text-primary)' }}>{borrowerName}</strong>{borrowerEmpId ? ` (${borrowerEmpId})` : ''} ใช่หรือไม่?
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setShowConfirm(false)} disabled={submitting} className="list-button" style={{ flex: 1 }}>
                  ยกเลิก
                </button>
                <button type="button" onClick={handleConfirmBorrow} disabled={submitting} className="list-button list-button-primary" style={{ flex: 1 }}>
                  {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  {submitting ? 'กำลังบันทึก…' : 'ยืนยัน'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response modal */}
      <AnimatePresence>
        {responseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
            onClick={() => setResponseModal(null)}
          >
            <motion.div
              ref={responseRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="equipment-borrow-response-heading"
              tabIndex={-1}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2.5rem', maxWidth: '420px', width: '90%', textAlign: 'center' }}
            >
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: responseModal.type === 'success' ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                color: responseModal.type === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                {responseModal.type === 'success' ? <CheckCircle2 size={32} aria-hidden="true" /> : <XCircle size={32} aria-hidden="true" />}
              </div>
              <h2 id="equipment-borrow-response-heading" style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>{responseModal.type === 'success' ? 'สำเร็จ' : 'เกิดข้อผิดพลาด'}</h2>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.5, fontSize: '0.9rem' }}>{responseModal.message}</p>
              <button type="button" onClick={() => setResponseModal(null)} className="list-button list-button-primary" style={{ padding: '0.75rem 2rem' }}>
                ตกลง
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EquipmentBorrow;
