import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Loader2, Package, RefreshCw, Repeat, Search, User } from 'lucide-react';
import BorrowReturnModal from './BorrowReturnModal';
import './ListPage.css';
import './EquipmentLoanHistory.css';

// The borrower (username = borrower_emp_id), the staff member who recorded
// the loan, or super_admin may return an item.
const canReturnLoan = (user, loan) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (!user.username) return false;
  return user.username === loan.borrower_emp_id || user.username === loan.borrowed_by?.username;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// Groups consecutive rows sharing the same batch_id into one card. The API
// pages by loan row (not by batch), sorted borrowed_at DESC, id DESC: rows of
// a batch are adjacent but a page edge can cut a batch in two. Older loans
// have no batch_id and are single-item groups.
const groupByBatch = (loans) => {
  const groups = [];
  loans.forEach((loan) => {
    const key = loan.batch_id || `single-${loan.id}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(loan);
    else groups.push({ key, items: [loan] });
  });
  return groups;
};

const VIEW_KEY = 'equipmentLoans.view.v1';
const readView = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
      status: ['open', 'returned'].includes(v.status) ? v.status : '',
      site: typeof v.site === 'string' ? v.site : '',
      page: Number.isInteger(v.page) && v.page > 0 ? v.page : 1
    };
  } catch {
    return { search: '', status: '', site: '', page: 1 };
  }
};

const PAGE_SIZE = 20;

const EquipmentLoanHistory = ({ token, user, onRequireLogin }) => {
  const [view] = useState(readView);
  const [state, setState] = useState({ status: 'loading', loans: [], total: 0, totalPages: 1, error: '' });
  const [page, setPage] = useState(view.page);
  const [searchInput, setSearchInput] = useState(view.search);
  const [searchTerm, setSearchTerm] = useState(view.search);
  const [statusFilter, setStatusFilter] = useState(view.status);
  const [siteFilter, setSiteFilter] = useState(view.site);
  const [sites, setSites] = useState([]);
  const [returnItem, setReturnItem] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(r => r.json()).then(body => { const l = Array.isArray(body) ? body : body?.data; if (Array.isArray(l)) setSites(l); })
      .catch(() => { /* office filter just lists nothing */ });
    return () => controller.abort();
  }, [token]);

  const fetchLoans = useCallback(async () => {
    const id = ++requestRef.current;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) params.append('status', statusFilter);
    if (siteFilter) params.append('pea_site_id', siteFilter);
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    try {
      // Public endpoint: no Authorization header needed.
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/loans?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !Array.isArray(body.data)) throw new Error(`HTTP ${res.status}`);
      if (id !== requestRef.current) return;
      const pages = Number(body.pagination?.totalPages);
      if (Number.isFinite(pages) && pages > 0 && page > pages) { setPage(pages); return; }
      setState({ status: 'ready', loans: body.data, total: Number(body.pagination?.total) || body.data.length, totalPages: Number.isFinite(pages) && pages > 0 ? pages : 1, error: '' });
    } catch {
      // Not "no history": the list could not be loaded at all.
      if (id === requestRef.current) setState(s => ({ ...s, status: s.loans.length ? 'stale' : 'error', error: 'โหลดประวัติการยืมไม่สำเร็จ' }));
    }
  }, [page, statusFilter, siteFilter, searchTerm]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  useEffect(() => {
    if (searchInput === searchTerm) return undefined;
    const t = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput, searchTerm]);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ search: searchTerm, status: statusFilter, site: siteFilter, page })); } catch { /* not remembered */ }
  }, [searchTerm, statusFilter, siteFilter, page]);

  const handleReturnClick = (loan) => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    if (!canReturnLoan(user, loan)) { toast.error('คุณไม่มีสิทธิ์คืนอุปกรณ์นี้ เนื่องจากไม่ใช่ผู้ยืมหรือผู้บันทึกการยืม'); return; }
    setReturnItem({
      equipmentId: loan.equipment_id ?? loan.equipment?.id,
      equipmentName: loan.equipment?.name || loan.equipment_name || `อุปกรณ์ #${loan.equipment_id ?? loan.equipment?.id ?? ''}`
    });
  };

  const hasFilter = Boolean(searchInput.trim() || statusFilter || siteFilter);
  const clearFilters = () => { setSearchInput(''); setSearchTerm(''); setStatusFilter(''); setSiteFilter(''); setPage(1); };
  const groups = groupByBatch(state.loans);
  const siteOptions = [...sites].sort((a, b) => String(a.pea_name).localeCompare(String(b.pea_name), 'th'));

  return (
    <div className="list-page elh-page">
      <header className="list-header">
        <div>
          <h1>ประวัติการยืม</h1>
          <p>รายการยืม-คืนอุปกรณ์ทั้งหมด จัดกลุ่มตามรอบการยืม · เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ ส่วนการคืนต้องเข้าสู่ระบบ</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={fetchLoans}><RefreshCw size={18} aria-hidden="true" /> รีเฟรช</button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'โหลดรายการใหม่ไม่สำเร็จ แสดงข้อมูลเดิม' : state.error}</strong>{state.status === 'error' && <p>ยังไม่ทราบประวัติการยืม ไม่ได้หมายความว่าไม่มีรายการ</p>}</div>
          <button type="button" className="list-button" onClick={fetchLoans}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="ตัวกรองประวัติการยืม">
        <div className="list-toolbar">
          <label className={`list-field list-search${searchInput ? ' is-active' : ''}`}>
            <span>ค้นหาผู้ยืม</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={searchInput} maxLength={200} placeholder="ชื่อ รหัสพนักงาน หรือเบอร์ติดต่อ" aria-describedby="elh-search-hint" onChange={e => setSearchInput(e.target.value)} />
            </div>
          </label>
          <label className={`list-field${statusFilter ? ' is-active' : ''}`}>
            <span>สถานะ</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              <option value="open">ยังไม่คืน</option>
              <option value="returned">คืนแล้ว</option>
            </select>
          </label>
          <label className={`list-field${siteFilter ? ' is-active' : ''}`}>
            <span>สำนักงาน</span>
            <select value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              {siteFilter && !siteOptions.some(s => String(s.id) === siteFilter) && <option value={siteFilter}>สำนักงาน #{siteFilter} (ไม่พบในรายชื่อ)</option>}
              {siteOptions.map(s => <option key={s.id} value={String(s.id)}>{s.pea_name}{s.pea_province ? ` (${s.pea_province})` : ''}</option>)}
            </select>
          </label>
          <button type="button" className="list-button" onClick={clearFilters} disabled={!hasFilter}>ล้างตัวกรอง</button>
        </div>
        <p id="elh-search-hint" className="list-muted elh-hint">ค้นเฉพาะข้อมูลผู้ยืม ไม่ค้นชื่ออุปกรณ์</p>
        {state.status !== 'loading' && state.status !== 'error' && <div className="list-result-info" role="status"><span>{state.total.toLocaleString('th-TH')} รายการ (นับรายชิ้น) · หน้า {page} จาก {state.totalPages}</span></div>}
      </section>

      {state.status === 'loading' ? (
        <div className="elh-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลดประวัติการยืม...</div>
      ) : state.status === 'error' ? null : groups.length === 0 ? (
        <div className="elh-state list-panel"><p>{hasFilter ? 'ไม่พบประวัติการยืมตามตัวกรอง' : 'ยังไม่มีประวัติการยืม'}</p>{hasFilter && <button type="button" className="list-button" onClick={clearFilters}>ล้างตัวกรอง</button>}</div>
      ) : (
        <ol className="elh-groups" aria-label="รอบการยืม">
          {groups.map((group, groupIndex) => {
            const first = group.items[0];
            const isBatch = Boolean(first.batch_id);
            const maybeEarlier = isBatch && groupIndex === 0 && page > 1;
            const maybeLater = isBatch && groupIndex === groups.length - 1 && page < state.totalPages;
            return (
              <li key={group.key} className="list-panel elh-group">
                <div className="elh-group-head">
                  <p className="elh-borrower"><User size={16} aria-hidden="true" /> <strong>{first.borrower_name || '—'}</strong>{first.borrower_emp_id && <span className="list-muted"> ({first.borrower_emp_id})</span>}</p>
                  <p className="list-muted">ยืมเมื่อ {formatDateTime(first.borrowed_at) || '—'}{first.due_date && ` · กำหนดคืน ${formatDateTime(first.due_date)}`}</p>
                </div>
                {(maybeEarlier || maybeLater) && (
                  <p className="elh-partial">แสดงเฉพาะรายการในหน้านี้ รอบการยืมนี้อาจมีรายการต่อ{maybeEarlier ? 'จากหน้าก่อน' : ''}{maybeEarlier && maybeLater ? ' และ' : ''}{maybeLater ? 'ในหน้าถัดไป' : ''}</p>
                )}
                <ul className="elh-items">
                  {group.items.map((loan) => {
                    const isOpen = !loan.returned_at;
                    const equipName = loan.equipment?.name || loan.equipment_name || (loan.equipment === null ? `อุปกรณ์ถูกลบแล้ว (#${loan.equipment_id ?? '-'})` : `อุปกรณ์ #${loan.equipment_id ?? loan.equipment?.id ?? '-'}`);
                    const blocked = !!user && !canReturnLoan(user, loan);
                    return (
                      <li key={loan.id}>
                        <p className="elh-item-name"><Package size={16} aria-hidden="true" /> <span title={equipName}>{equipName}</span>{loan.equipment?.equipment_type && <span className="list-muted"> ({loan.equipment.equipment_type})</span>}</p>
                        <div className="elh-item-state">
                          <span className={`list-status ${isOpen ? 'list-status-warning' : 'list-status-up'}`}>{isOpen ? 'ยังไม่คืน' : 'คืนแล้ว'}</span>
                          {!isOpen && <span className="list-muted">{formatDateTime(loan.returned_at)}</span>}
                          {isOpen && (
                            <button type="button" className="list-button" onClick={() => handleReturnClick(loan)} disabled={blocked}
                              aria-label={`คืน ${equipName}`} aria-describedby={blocked ? `elh-blocked-${loan.id}` : undefined}>
                              <Repeat size={16} aria-hidden="true" /> คืน
                            </button>
                          )}
                          {isOpen && blocked && <span id={`elh-blocked-${loan.id}`} className="list-muted">คืนได้เฉพาะผู้ยืมหรือผู้บันทึก</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {first.notes && <p className="elh-notes">หมายเหตุ: {first.notes}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {state.status !== 'loading' && state.status !== 'error' && state.totalPages > 1 && (
        <div className="list-footer elh-footer">
          <span>หน้า {page} จาก {state.totalPages}</span>
          <div className="list-pagination">
            <button type="button" className="list-button" aria-label="หน้าก่อน" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>ก่อนหน้า</button>
            <button type="button" className="list-button" aria-label="หน้าถัดไป" onClick={() => setPage(p => Math.min(state.totalPages, p + 1))} disabled={page >= state.totalPages}>ถัดไป</button>
          </div>
        </div>
      )}

      {returnItem && (
        <BorrowReturnModal
          equipmentId={returnItem.equipmentId}
          equipmentName={returnItem.equipmentName}
          token={token}
          onClose={() => setReturnItem(null)}
          onChanged={() => { setReturnItem(null); fetchLoans(); }}
        />
      )}
    </div>
  );
};

export default EquipmentLoanHistory;
