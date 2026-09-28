import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Edit2, FileText, Loader2, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import BudgetTransactionsPanel from './BudgetTransactionsPanel';
import ModalFrame from './common/ModalFrame.jsx';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import { useLeaveGuard } from '../navigationGuard';
import './ListPage.css';
import './BudgetManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;
const VIEW_KEY = 'budget_mgmt_view.v1';
const PAGE_SIZES = [10, 25, 50, 100];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// Upload targets the backend accepts (same three as before).
const UPLOAD_ACCOUNTS = [
  { value: '53051060', label: '53051060 ค่าบำรุงฯ/ซ่อม-IT' },
  { value: '53032070', label: '53032070 ค่าInst.Equipสื่อสาร' },
  { value: '53032080', label: '53032080 คชจ.ใช้ Internet' }
];
const UPLOAD_EXTS = ['.xlsx', '.xls', '.csv'];
const MAX_UPLOAD = 100 * 1024 * 1024;

const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : null; };
const baht = (n) => (n === null ? '—' : `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
// Rows are monthly snapshots (day is 0 in real data), so show month + period
// rather than inventing a day.
const snapshotLabel = (b) => {
  const m = Number(b.month);
  const month = m >= 1 && m <= 12 ? THAI_MONTHS[m - 1] : '';
  return [month, b.year].filter(Boolean).join(' ') || '—';
};
const periodLabel = (p) => { const n = num(p); return n === null ? (p || '—') : String(Math.trunc(n) === n ? Math.trunc(n) : n); };
const figures = (b) => {
  const allocated = num(b.budget_allocated);
  const used = num(b.budget_used);
  const remaining = allocated !== null && used !== null ? allocated - used : null;
  const usedPct = allocated ? (used / allocated) * 100 : null;
  return { allocated, used, remaining, usedPct };
};

const SORTS = {
  snapshot: { label: 'ข้อมูล ณ', value: (b) => (Number(b.year) || 0) * 100 + (Number(b.month) || 0) },
  account_code: { label: 'รหัสบัญชี', value: (b) => b.account_code || '' },
  account_name: { label: 'ชื่อบัญชี', value: (b) => b.account_name || '' },
  allocated: { label: 'งบที่ได้รับ', value: (b) => figures(b).allocated },
  used: { label: 'ใช้ไป', value: (b) => figures(b).used },
  remaining: { label: 'คงเหลือ', value: (b) => figures(b).remaining }
};

const readView = () => {
  const fallback = { tab: 'budgets', search: '', year: '', pageSize: 10, sort: { key: 'snapshot', order: 'desc' } };
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      tab: v.tab === 'transactions' ? 'transactions' : 'budgets',
      search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
      year: typeof v.year === 'string' ? v.year : '',
      pageSize: PAGE_SIZES.includes(v.pageSize) || v.pageSize === 0 ? v.pageSize : 10,
      sort: SORTS[v.sort?.key] && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : fallback.sort
    };
  } catch {
    return fallback;
  }
};

const failure = (response, result, fallback) => {
  if (response?.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (response?.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
  return result?.message || result?.error || fallback;
};

const BudgetManagement = ({ token, onBack, user }) => {
  const isSuperAdmin = user?.role === 'super_admin';
  const canWrite = isSuperAdmin || user?.role === 'operator';
  const canDelete = isSuperAdmin;

  const [view] = useState(readView);
  const [tab, setTab] = useState(view.tab);
  const [search, setSearch] = useState(view.search);
  const [year, setYear] = useState(view.year);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState(view.sort);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const [selectors, setSelectors] = useState({ cost_center_groups: [], account_codes: [], account_names: [], accounts_mapped: [], years: [] });
  const [editing, setEditing] = useState(null); // null | { budget: null | row }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [txRefresh, setTxRefresh] = useState(0);
  const inflight = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ tab, search, year, pageSize, sort })); } catch { /* optional */ }
  }, [tab, search, year, pageSize, sort]);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState((s) => ({ ...s, status: s.items.length ? 'refreshing' : 'loading' }));
    try {
      const response = await fetch(`${API}/api/budgets`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const result = await response.json().catch(() => null);
      const list = Array.isArray(result) ? result : result?.data;
      if (!response.ok || !Array.isArray(list)) throw new Error(failure(response, result, `HTTP ${response.status}`));
      if (inflight.current !== controller) return;
      setState({ status: 'ready', items: list.filter(Boolean), error: '' });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลงบประมาณไม่สำเร็จ';
      setState((s) => ({ ...s, status: s.items.length ? 'stale' : 'error', error: message }));
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/budgets/selectors`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((r) => r.json())
      .then((r) => { if (r?.success && r.data) setSelectors((s) => ({ ...s, ...r.data })); })
      .catch(() => { /* suggestions only */ });
    return () => controller.abort();
  }, [token]);

  const years = [...new Set(state.items.map((b) => String(b.year)).filter(Boolean))].sort((a, b) => b - a);
  const q = search.trim().toLowerCase();
  const filtered = state.items.filter((b) => (!year || String(b.year) === year)
    && (!q || [b.account_name, b.account_code, b.cost_center_group, b.year].some((v) => String(v ?? '').toLowerCase().includes(q))));
  const get = SORTS[sort.key].value;
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [get(a), get(b)];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    const cmp = typeof x === 'string' ? x.localeCompare(y, 'th') : x - y;
    return sort.order === 'asc' ? cmp : -cmp;
  });
  const size = pageSize || sorted.length || 1;
  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * size, current * size);
  const hasData = state.items.length > 0;
  const filtering = Boolean(q || year);

  const sortHeader = (key, className) => (
    <th scope="col" className={className} aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => { setSort((s) => ({ key, order: s.key === key && s.order === 'asc' ? 'desc' : 'asc' })); setPage(1); }}>
        {SORTS[key].label}
        {sort.key !== key ? <ArrowUpDown size={14} aria-hidden="true" className="bm-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(`${API}/api/budgets/${toDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(failure(response, result, 'ลบข้อมูลงบประมาณไม่สำเร็จ'));
      toast.success('ลบข้อมูลงบประมาณแล้ว');
      setToDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.message === 'Failed to fetch' ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลยังไม่ถูกลบ' : err.message);
    } finally {
      setDeleting(false);
    }
  };

  const uploadButton = canWrite && (
    <button type="button" className="list-button" onClick={() => setUploadOpen(true)}>
      <Upload size={18} aria-hidden="true" /> อัปโหลดข้อมูลการเบิกจ่าย
    </button>
  );

  return (
    <div className="list-page bm-page">
      <button type="button" className="list-button bm-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการจัดการ</button>
      <header className="list-header">
        <div>
          <h1>จัดการงบประมาณ</h1>
          <p>ข้อมูลงบประมาณรายเดือนของแต่ละบัญชี และข้อมูลการเบิกจ่ายที่นำเข้าจากไฟล์</p>
        </div>
        <div className="list-actions">
          {tab === 'budgets' && (
            <button type="button" className="list-button" onClick={load} disabled={state.status === 'loading' || state.status === 'refreshing'}>
              <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
            </button>
          )}
          {uploadButton}
          {tab === 'budgets' && canWrite && (
            <button type="button" className="list-button list-button-primary" onClick={() => setEditing({ budget: null })}>
              <Plus size={18} aria-hidden="true" /> เพิ่มงบประมาณ
            </button>
          )}
        </div>
      </header>

      <div className="bm-tabs" role="group" aria-label="เลือกข้อมูลที่ต้องการจัดการ">
        {[['budgets', 'งบประมาณ'], ['transactions', 'ข้อมูลการเบิกจ่าย']].map(([key, label]) => (
          <button key={key} type="button" className="bm-tab" aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'transactions' ? (
        <BudgetTransactionsPanel token={token} refreshKey={txRefresh} />
      ) : (
        <>
          {(state.status === 'error' || state.status === 'stale') && (
            <div className="list-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <div><strong>{state.status === 'stale' ? 'รีเฟรชไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดข้อมูลงบประมาณไม่สำเร็จ'}</strong><p>{state.error}</p></div>
              <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
            </div>
          )}

          <section className="list-panel" aria-label="รายการงบประมาณ">
            <div className="list-toolbar">
              <label className={`list-field list-search${search ? ' is-active' : ''}`}>
                <span>ค้นหา</span>
                <div className="list-search-input">
                  <Search size={18} aria-hidden="true" />
                  <input type="search" placeholder="ชื่อบัญชี รหัสบัญชี หรือกลุ่มศูนย์ต้นทุน" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </label>
              <label className={`list-field${year ? ' is-active' : ''}`}>
                <span>ปี</span>
                <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
                  <option value="">ทุกปี</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              {filtering && <button type="button" className="list-button" onClick={() => { setSearch(''); setYear(''); setPage(1); }}>ล้างตัวกรอง</button>}
            </div>
            {hasData && (
              <div className="list-result-info">
                <span role="status">{filtering ? `พบ ${sorted.length} จาก ${state.items.length} รายการ` : `ทั้งหมด ${state.items.length} รายการ`}</span>
                <span>ข้อมูลแต่ละแถวคือยอด ณ เดือนที่บันทึก</span>
              </div>
            )}

            {state.status === 'loading' ? (
              <div className="bm-state" role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>กำลังโหลดข้อมูลงบประมาณ…</p></div>
            ) : !hasData ? (
              state.status === 'error' ? null : (
                <div className="bm-state"><p><strong>ยังไม่มีข้อมูลงบประมาณ</strong></p>{canWrite && <button type="button" className="list-button list-button-primary" onClick={() => setEditing({ budget: null })}><Plus size={18} aria-hidden="true" /> เพิ่มงบประมาณ</button>}</div>
              )
            ) : sorted.length === 0 ? (
              <div className="bm-state"><p><strong>ไม่พบข้อมูลที่ตรงกับเงื่อนไข</strong></p><button type="button" className="list-button" onClick={() => { setSearch(''); setYear(''); }}>ล้างตัวกรอง</button></div>
            ) : (
              <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางงบประมาณ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
                <table className="list-table bm-table">
                  <caption className="list-sr-only">งบประมาณรายเดือน หน้า {current} จาก {totalPages}</caption>
                  <thead>
                    <tr>
                      {sortHeader('snapshot')}
                      <th scope="col">กลุ่มศูนย์ต้นทุน</th>
                      {sortHeader('account_code')}
                      {sortHeader('account_name')}
                      {sortHeader('allocated', 'bm-num')}
                      {sortHeader('used', 'bm-num')}
                      {sortHeader('remaining', 'bm-num')}
                      {(canWrite || canDelete) && <th scope="col" className="bm-actions-col">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => {
                      const f = figures(b);
                      const over = f.remaining !== null && f.remaining < 0;
                      const label = `${b.account_name || b.account_code || 'บัญชี'} ${snapshotLabel(b)}`;
                      return (
                        <tr key={b.id} className={over ? 'list-row-down' : undefined}>
                          <td><span className="bm-cell-main">{snapshotLabel(b)}</span><span className="list-muted">งวด {periodLabel(b.period)}</span></td>
                          <td className="list-ip">{b.cost_center_group || '—'}</td>
                          <td className="list-ip">{b.account_code || '—'}</td>
                          <td className="bm-name" title={b.account_name || ''}>{b.account_name || '—'}</td>
                          <td className="bm-num">{baht(f.allocated)}</td>
                          <td className="bm-num">{baht(f.used)}</td>
                          <td className="bm-num">
                            <span className={`bm-cell-main${over ? ' bm-over' : ''}`}>{baht(f.remaining)}</span>
                            <span className={over ? 'bm-over bm-small' : 'list-muted'}>{f.usedPct === null ? 'ไม่มีงบที่ได้รับ' : over ? `ใช้เกินงบ (${f.usedPct.toFixed(1)}%)` : `ใช้ไป ${f.usedPct.toFixed(1)}%`}</span>
                          </td>
                          {(canWrite || canDelete) && (
                            <td>
                              <div className="bm-row-actions">
                                {canWrite && <button type="button" className="bm-icon" onClick={() => setEditing({ budget: b })} aria-label={`แก้ไข ${label}`} title="แก้ไข"><Edit2 size={18} aria-hidden="true" /></button>}
                                {canDelete && <button type="button" className="bm-icon is-danger" onClick={() => { setDeleteError(''); setToDelete(b); }} aria-label={`ลบ ${label}`} title="ลบ"><Trash2 size={18} aria-hidden="true" /></button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {sorted.length > 0 && (
              <footer className="list-footer">
                <span className="list-muted">{(current - 1) * size + 1}–{(current - 1) * size + rows.length} จาก {sorted.length} รายการ</span>
                <label className="list-page-size">
                  แสดง
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value={0}>ทั้งหมด</option>
                  </select>
                  รายการต่อหน้า
                </label>
                <nav className="list-pagination" aria-label="แบ่งหน้ารายการงบประมาณ">
                  <button type="button" className="list-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button>
                  <span className="list-muted">หน้า {current} / {totalPages}</span>
                  <button type="button" className="list-button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>ถัดไป</button>
                </nav>
              </footer>
            )}
          </section>
        </>
      )}

      {editing && (
        <BudgetFormModal
          budget={editing.budget}
          selectors={selectors}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); toast.success(message); load(); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="ลบข้อมูลงบประมาณนี้?"
        tone="danger"
        busy={deleting}
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบข้อมูล'}
        cancelLabel="ไม่ลบ"
        message={toDelete && (
          <>
            <p className="bm-confirm-target">{toDelete.account_code} {toDelete.account_name} · {snapshotLabel(toDelete)} (งวด {periodLabel(toDelete.period)})</p>
            <p>งบที่ได้รับ {baht(figures(toDelete).allocated)} · ใช้ไป {baht(figures(toDelete).used)}</p>
            <p>ยอดของเดือนนี้จะหายไปจากหน้าสรุปงบประมาณ และกู้คืนจากหน้านี้ไม่ได้</p>
            {deleteError && <p className="bm-confirm-error" role="alert">{deleteError}</p>}
          </>
        )}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      {uploadOpen && (
        <UploadModal
          token={token}
          onClose={() => setUploadOpen(false)}
          onUploaded={(result) => {
            setUploadOpen(false);
            setUploadResult(result);
            toast.success('อัปโหลดข้อมูลการเบิกจ่ายแล้ว');
            setTxRefresh((n) => n + 1);
            load();
          }}
        />
      )}
      {uploadResult && <UploadResultModal result={uploadResult} onClose={() => setUploadResult(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Add / edit one monthly budget row (POST /api/budgets, PUT /api/budgets/:id,
// form-urlencoded as before).
// ---------------------------------------------------------------------------
const EMPTY = () => {
  const now = new Date();
  return { cost_center_group: '', account_code: '', account_name: '', budget_allocated: '', budget_used: '', year: String(now.getFullYear()), month: String(now.getMonth() + 1), period: String(now.getMonth() + 1), day: '' };
};
const fromBudget = (b) => ({
  cost_center_group: b.cost_center_group || '', account_code: b.account_code || '', account_name: b.account_name || '',
  budget_allocated: b.budget_allocated ?? '', budget_used: b.budget_used ?? '',
  year: b.year?.toString() || '', month: b.month?.toString() || '', period: periodLabel(b.period) === '—' ? '' : periodLabel(b.period), day: b.day ?? ''
});
const FIELDS = [
  { name: 'cost_center_group', label: 'กลุ่มศูนย์ต้นทุน', list: 'cost_center_groups', mono: true },
  { name: 'account_code', label: 'รหัสบัญชี (ส่วนประกอบต้นทุน)', list: 'account_codes', mono: true },
  { name: 'account_name', label: 'ชื่อบัญชี', list: 'account_names', wide: true },
  { name: 'budget_allocated', label: 'งบที่ได้รับ (ตามแผน) บาท', number: true },
  { name: 'budget_used', label: 'ใช้ไป (ต้นทุนจริง) บาท', short: 'ยอดที่ใช้ไป', number: true },
  { name: 'year', label: 'ปี (ค.ศ.)', list: 'years', inputMode: 'numeric' },
  { name: 'month', label: 'เดือน (1–12)', inputMode: 'numeric' },
  { name: 'period', label: 'งวด', inputMode: 'numeric' }
];

const validate = (d) => {
  const e = {};
  FIELDS.forEach(({ name, label, short }) => { if (!String(d[name]).trim()) e[name] = `กรุณาระบุ${short || label.replace(/ \(.*\)| บาท/g, '')}`; });
  ['budget_allocated', 'budget_used'].forEach((k) => { if (!e[k] && (num(d[k]) === null || num(d[k]) < 0)) e[k] = 'ต้องเป็นจำนวนเงินตั้งแต่ 0 ขึ้นไป'; });
  if (!e.year && !/^\d{4}$/.test(String(d.year).trim())) e.year = 'ระบุปี ค.ศ. 4 หลัก เช่น 2026';
  if (!e.month && !(Number(d.month) >= 1 && Number(d.month) <= 12 && Number.isInteger(Number(d.month)))) e.month = 'ระบุเดือน 1–12';
  if (!e.period && num(d.period) === null) e.period = 'ระบุงวดเป็นตัวเลข';
  return e;
};

function BudgetFormModal({ budget, selectors, token, onClose, onSaved }) {
  const id = useId();
  const [initial] = useState(() => (budget ? fromBudget(budget) : EMPTY()));
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef(null);
  const dirty = Object.keys(initial).some((k) => String(initial[k]) !== String(data[k]));
  useLeaveGuard(dirty || busy, { message: busy ? 'กำลังบันทึกอยู่ ถ้าออกตอนนี้จะไม่เห็นผลว่าบันทึกสำเร็จหรือไม่' : '' });

  const change = (name, value) => {
    setData((prev) => {
      const next = { ...prev, [name]: value };
      // Fill the name only when the code maps to exactly one name.
      if (name === 'account_code') {
        const names = [...new Set((selectors.accounts_mapped || []).filter((m) => m.account_code === value).map((m) => m.account_name))];
        if (names.length === 1 && !prev.account_name) next.account_name = names[0];
      }
      return next;
    });
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      formRef.current?.querySelector(`#${CSS.escape(`${id}-${Object.keys(found)[0]}`)}`)?.focus();
      return;
    }
    setBusy(true);
    setSubmitError('');
    const params = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => params.append(k, String(v).trim()));
    try {
      const response = await fetch(budget ? `${API}/api/budgets/${budget.id}` : `${API}/api/budgets`, {
        method: budget ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) { setSubmitError(failure(response, result, 'บันทึกไม่สำเร็จ')); return; }
      onSaved(budget ? 'บันทึกการแก้ไขงบประมาณแล้ว' : 'เพิ่มข้อมูลงบประมาณแล้ว');
    } catch {
      setSubmitError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ในฟอร์มนี้');
    } finally {
      setBusy(false);
    }
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  const options = (list) => [...new Set((selectors[list] || []).map(String))];

  return (
    <>
      <ModalFrame
        title={budget ? 'แก้ไขข้อมูลงบประมาณ' : 'เพิ่มข้อมูลงบประมาณ'}
        icon={budget ? <Edit2 size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
        subtitle={budget ? `${budget.account_code} ${budget.account_name} · ${snapshotLabel(budget)}` : 'ยอดของบัญชีหนึ่ง ณ เดือนที่บันทึก'}
        size="lg" busy={busy} guardClose={dirty} onClose={requestClose}
      >
        <form ref={formRef} onSubmit={submit} noValidate>
          {submitError && <div className="mf-error bm-submit-error" role="alert"><p>{submitError}</p></div>}
          <div className="bm-form-grid">
            {FIELDS.map((f) => (
              <div key={f.name} className={`mf-field${f.wide ? ' bm-wide' : ''}${errors[f.name] ? ' is-invalid' : ''}`}>
                <label htmlFor={`${id}-${f.name}`}>{f.label} <span className="br-required" aria-hidden="true">*</span></label>
                <input
                  id={`${id}-${f.name}`}
                  type="text"
                  inputMode={f.number ? 'decimal' : f.inputMode}
                  className={f.mono || f.number ? 'bm-mono' : undefined}
                  list={f.list && options(f.list).length ? `${id}-${f.list}` : undefined}
                  value={data[f.name]}
                  required
                  aria-invalid={errors[f.name] ? 'true' : undefined}
                  aria-describedby={errors[f.name] ? `${id}-${f.name}-error` : undefined}
                  onChange={(e) => change(f.name, e.target.value)}
                />
                {f.list && options(f.list).length > 0 && <datalist id={`${id}-${f.list}`}>{options(f.list).map((v) => <option key={v} value={v} />)}</datalist>}
                {errors[f.name] && <p id={`${id}-${f.name}-error`} className="mf-field-error">{errors[f.name]}</p>}
              </div>
            ))}
          </div>
          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="mf-button mf-primary" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {budget ? 'บันทึกการแก้ไข' : 'เพิ่มงบประมาณ'}
            </button>
          </div>
        </form>
      </ModalFrame>
      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งข้อมูลที่กรอก?"
        message="ข้อมูลที่แก้ไขในฟอร์มนี้ยังไม่ได้บันทึกและจะหายไป"
        confirmLabel="ทิ้งข้อมูล" cancelLabel="กรอกต่อ" tone="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Upload transactions (POST /api/budgets/upload-transactions). The backend
// replaces every transaction of the chosen account + year, so the last step
// asks for confirmation with that scope spelled out.
// ---------------------------------------------------------------------------
function UploadModal({ token, onClose, onUploaded }) {
  const id = useId();
  const thisYear = new Date().getFullYear();
  const [yearValue, setYearValue] = useState(String(thisYear));
  const [account, setAccount] = useState(UPLOAD_ACCOUNTS[0].value);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const accountLabel = UPLOAD_ACCOUNTS.find((a) => a.value === account)?.label || account;

  const pick = (e) => {
    const chosen = e.target.files?.[0] || null;
    if (!chosen) return;
    const okType = UPLOAD_EXTS.some((ext) => chosen.name.toLowerCase().endsWith(ext));
    const problem = !okType ? `ไฟล์ "${chosen.name}" ต้องเป็น .xlsx, .xls หรือ .csv` : chosen.size > MAX_UPLOAD ? `ไฟล์ "${chosen.name}" มีขนาดเกิน 100MB` : '';
    setFileError(problem);
    setFile(problem ? null : chosen);
    if (problem) e.target.value = '';
  };

  const review = (e) => {
    e.preventDefault();
    if (!file) { setFileError('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด'); fileRef.current?.focus(); return; }
    setConfirming(true);
  };

  const upload = async () => {
    setConfirming(false);
    setBusy(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    body.append('cost_center', account);
    body.append('year', yearValue);
    try {
      const response = await fetch(`${API}/api/budgets/upload-transactions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) { setError(failure(response, result, 'อัปโหลดไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกแทนที่')); return; }
      onUploaded({ ...result, meta: { account: accountLabel, year: yearValue, file: file.name } });
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ไม่ทราบว่าข้อมูลถูกแทนที่แล้วหรือไม่ กรุณาตรวจสอบในแท็บข้อมูลการเบิกจ่ายก่อนอัปโหลดซ้ำ');
    } finally {
      setBusy(false);
    }
  };

  const dirty = Boolean(file);
  useLeaveGuard(dirty || busy, { message: busy ? 'กำลังอัปโหลดอยู่ ถ้าออกตอนนี้จะไม่เห็นผลว่านำเข้าสำเร็จหรือไม่' : 'ไฟล์ที่เลือกไว้จะไม่ถูกอัปโหลด' });
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  return (
    <>
      <ModalFrame title="อัปโหลดข้อมูลการเบิกจ่าย" icon={<Upload size={20} aria-hidden="true" />} subtitle="แทนที่ข้อมูลการเบิกจ่ายทั้งหมดของบัญชีและปีที่เลือกด้วยข้อมูลจากไฟล์" size="md" busy={busy} guardClose={dirty} onClose={requestClose}>
        <form onSubmit={review} noValidate>
          {error && <div className="mf-error bm-submit-error" role="alert"><p>{error}</p></div>}
          <div className="mf-field">
            <label htmlFor={`${id}-year`}>ปีงบประมาณ</label>
            <select id={`${id}-year`} className="bm-select" value={yearValue} onChange={(e) => setYearValue(e.target.value)}>
              {Array.from({ length: thisYear - 2023 + 1 }, (_, i) => String(thisYear - i)).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="mf-field">
            <label htmlFor={`${id}-account`}>รหัสบัญชี</label>
            <select id={`${id}-account`} className="bm-select" value={account} onChange={(e) => setAccount(e.target.value)}>
              {UPLOAD_ACCOUNTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className={`mf-field${fileError ? ' is-invalid' : ''}`}>
            <label htmlFor={`${id}-file`}>ไฟล์ข้อมูลการเบิกจ่าย <span className="br-required" aria-hidden="true">*</span></label>
            <input ref={fileRef} id={`${id}-file`} className="bm-file" type="file" accept={UPLOAD_EXTS.join(',')} onChange={pick} aria-describedby={`${id}-file-help${fileError ? ` ${id}-file-error` : ''}`} />
            {fileError && <p id={`${id}-file-error`} className="mf-field-error" role="alert">{fileError}</p>}
            {file && (
              <p className="bm-file-chosen"><FileText size={16} aria-hidden="true" /> {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                <button type="button" className="bm-icon" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label={`นำไฟล์ ${file.name} ออก`}><X size={16} aria-hidden="true" /></button>
              </p>
            )}
            <div id={`${id}-file-help`} className="bm-file-help">
              <p>.xlsx, .xls หรือ .csv ไม่เกิน 100MB</p>
              <p className="bm-warning-text">ตัดแถวที่ไม่ใช่หัวคอลัมน์ด้านบนและส่วนท้ายที่ไม่ใช่ข้อมูลออกก่อน และปี/รหัสบัญชีที่เลือกต้องตรงกับข้อมูลในไฟล์</p>
            </div>
          </div>
          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="mf-button mf-primary" disabled={busy}>
              {busy ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> กำลังอัปโหลด…</> : <><Upload size={16} aria-hidden="true" /> ตรวจสอบและอัปโหลด</>}
            </button>
          </div>
        </form>
      </ModalFrame>
      <ConfirmDialog
        open={confirming}
        title="แทนที่ข้อมูลการเบิกจ่าย?"
        tone="warning"
        confirmLabel="ยืนยันแทนที่ข้อมูล"
        cancelLabel="กลับไปแก้ไข"
        message={(
          <>
            <p>ข้อมูลการเบิกจ่ายทั้งหมดของ <strong>{accountLabel}</strong> ปี <strong>{yearValue}</strong> จะถูกลบและแทนที่ด้วยข้อมูลจากไฟล์ <strong>{file?.name}</strong></p>
            <p>การผูกธุรกรรมกับงานของบัญชีและปีนี้อาจได้รับผลกระทบ</p>
          </>
        )}
        onConfirm={upload}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="ยกเลิกการอัปโหลด?"
        message="ไฟล์ที่เลือกไว้จะไม่ถูกอัปโหลด"
        confirmLabel="ยกเลิกการอัปโหลด" cancelLabel="อยู่ต่อ" tone="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

function UploadResultModal({ result, onClose }) {
  const rows = Array.isArray(result.data) ? result.data : [];
  const count = result.count ?? result.total_rows ?? rows.length;
  return (
    <ModalFrame title="อัปโหลดข้อมูลการเบิกจ่ายแล้ว" icon={<FileText size={20} aria-hidden="true" />} subtitle={`${result.meta.account} · ปี ${result.meta.year} · ไฟล์ ${result.meta.file}`} size="xl" onClose={onClose}>
      <dl className="bm-result-stats">
        <div><dt>จำนวนแถวที่นำเข้า</dt><dd>{Number(count).toLocaleString('th-TH')}</dd></div>
        {result.message && <div><dt>ข้อความจากระบบ</dt><dd className="bm-result-message">{result.message}</dd></div>}
      </dl>
      {rows.length > 0 && (
        <div className="bm-result-scroll" tabIndex={0} role="region" aria-label="ข้อมูลที่นำเข้า เลื่อนเพื่อดูทั้งหมด">
          <table className="bm-result-table">
            <caption className="list-sr-only">ข้อมูลการเบิกจ่ายที่นำเข้า {rows.length} แถว</caption>
            <thead><tr><th scope="col">วันที่ผ่านรายการ</th><th scope="col">เลขที่เอกสาร</th><th scope="col">รายละเอียด</th><th scope="col" className="bm-num">จำนวนเงิน</th></tr></thead>
            <tbody>
              {rows.map((item, i) => (
                <tr key={i}>
                  <td>{item.posting_date || '—'}</td>
                  <td className="list-ip">{item.reference_doc_no || '—'}</td>
                  <td>{item.description || '—'}</td>
                  <td className="bm-num">{baht(num(item.value_co_curr))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mf-actions"><button type="button" className="mf-button mf-primary" onClick={onClose} data-autofocus>ตกลง</button></div>
    </ModalFrame>
  );
}

export default BudgetManagement;
