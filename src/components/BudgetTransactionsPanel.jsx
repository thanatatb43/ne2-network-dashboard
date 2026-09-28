import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { onBudgetSourceReplaced } from './budget/budgetEvents';
import './ListPage.css';
import './BudgetTransactionsPanel.css';

const API = import.meta.env.VITE_API_BASE_URL;
const PAGE_SIZES = [10, 15, 25, 50, 100];
const STORAGE_KEY = 'budgetManagement.transactions.v1';
// Server-side filters/sorts only: the API ignores unknown params silently, so
// nothing here is filtered in the browser on top of a single page.
const FILTERS = [
  { key: 'q', label: 'ค้นหาทุกคอลัมน์', placeholder: 'ข้อความ เลขเอกสาร จำนวนเงิน เช่น 5400.00 หรือวันที่ 2025-01-27', search: true },
  { key: 'description', label: 'รายละเอียด', placeholder: 'ค้นหาในรายละเอียดรายการ', search: true, fallbackOnly: true },
  { key: 'reference_doc_no', label: 'เลขที่เอกสารอ้างอิง', placeholder: 'เช่น 2000936549' },
  { key: 'username', label: 'ผู้บันทึก', placeholder: 'ชื่อผู้ใช้' }
];
const COLUMNS = [
  { key: 'posting_date', label: 'วันที่ผ่านรายการ' },
  { key: 'reference_doc_no', label: 'เลขที่เอกสาร' },
  { key: 'description', label: 'รายละเอียด' },
  { key: 'account_code', label: 'รหัสบัญชี' },
  { key: 'clearing_account_name', label: 'ชื่อบัญชีหักล้าง' },
  { key: 'username', label: 'ผู้บันทึก' },
  { key: 'amount', label: 'จำนวนเงิน (บาท)', numeric: true }
];

const defaults = { filters: { q: '', description: '', reference_doc_no: '', username: '' }, page: 1, pageSize: 15, sort: 'posting_date', order: 'desc' };

const readState = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== 'object') return defaults;
    const filters = Object.fromEntries(FILTERS.map(f => [f.key, typeof raw.filters?.[f.key] === 'string' ? raw.filters[f.key].slice(0, 200) : '']));
    return {
      filters,
      page: Number.isInteger(raw.page) && raw.page > 0 ? raw.page : 1,
      pageSize: PAGE_SIZES.includes(raw.pageSize) ? raw.pageSize : 15,
      sort: COLUMNS.some(c => c.key === raw.sort) ? raw.sort : 'posting_date',
      order: raw.order === 'asc' ? 'asc' : 'desc'
    };
  } catch {
    return defaults;
  }
};

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
};

export default function BudgetTransactionsPanel({ token, refreshKey, actions }) {
  const [initial] = useState(readState);
  const [inputs, setInputs] = useState(initial.filters);
  const [filters, setFilters] = useState(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [sort, setSort] = useState({ key: initial.sort, order: initial.order });
  const [retry, setRetry] = useState(0);
  // An upload (here or in another tab) replaced source rows: reload.
  useEffect(() => onBudgetSourceReplaced(() => setRetry((n) => n + 1)), []);
  const [result, setResult] = useState({ key: '', rows: [], total: 0, totalPages: 1, error: '' });
  // null until the first response: literal-v1 means the server searches every
  // filtered record with q; otherwise fall back to the description filter.
  const [qSupported, setQSupported] = useState(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => (FILTERS.some(f => prev[f.key] !== inputs[f.key].trim()) ? Object.fromEntries(FILTERS.map(f => [f.key, inputs[f.key].trim()])) : prev));
    }, 400);
    return () => clearTimeout(timer);
  }, [inputs]);

  const requestKey = useMemo(() => {
    const p = new URLSearchParams();
    FILTERS.forEach(f => { if (filters[f.key]) p.set(f.key, filters[f.key]); });
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    p.set('sort', sort.key);
    p.set('order', sort.order);
    return p.toString();
  }, [filters, page, pageSize, sort]);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, page, pageSize, sort: sort.key, order: sort.order })); } catch { /* not remembered */ }
  }, [filters, page, pageSize, sort]);

  const fullKey = `${requestKey}#${refreshKey}#${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    const id = ++tokenRef.current;
    const timer = setTimeout(() => controller.abort(), 20000);
    fetch(`${API}/api/budgets/transactions?${requestKey}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success || !Array.isArray(body.data)) throw new Error(body?.error?.message || body?.message || `HTTP ${res.status}`);
        if (id !== tokenRef.current) return;
        const total = Number(body.pagination?.total_items);
        const pages = Number(body.pagination?.total_pages);
        setQSupported(body.meta?.search?.version === 'literal-v1');
        setResult({ key: fullKey, rows: body.data, total: Number.isFinite(total) ? total : body.data.length, totalPages: Number.isFinite(pages) && pages > 0 ? pages : 1, error: '' });
      })
      .catch(err => {
        if (id !== tokenRef.current) return;
        setResult(prev => ({ ...prev, key: fullKey, error: err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลไม่สำเร็จ' }));
      })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, token, fullKey]);

  const loading = result.key !== fullKey;
  const pending = loading || FILTERS.some(f => inputs[f.key].trim() !== filters[f.key]);
  const hasFilter = FILTERS.some(f => inputs[f.key].trim());
  const first = result.total ? (page - 1) * pageSize + 1 : 0;

  const changeInput = (key, value) => { setInputs(prev => ({ ...prev, [key]: value })); setPage(1); };
  const clearFilters = () => { setInputs(defaults.filters); setFilters(defaults.filters); setPage(1); };
  const toggleSort = (key) => { setSort(prev => ({ key, order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc' })); setPage(1); };

  return (
    <div className="list-page bt-panel">
      <section className="list-panel" aria-labelledby="bt-title">
        <div className="bt-head">
          <div>
            <h2 id="bt-title">ข้อมูลการเบิกจ่าย</h2>
            <p className="list-muted">ค้นหา เรียง และแบ่งหน้าจากข้อมูลทั้งหมดบนเซิร์ฟเวอร์ (ไม่ใช่เฉพาะหน้าที่แสดง)</p>
          </div>
          {actions}
        </div>
        <div className="list-toolbar">
          {FILTERS.filter(f => (f.key === 'q' ? qSupported !== false : f.fallbackOnly ? qSupported === false || Boolean(inputs.description) : true)).map(f => (
            <label key={f.key} className={`list-field${f.search ? ' list-search' : ''}${inputs[f.key] ? ' is-active' : ''}`}>
              <span>{f.label}</span>
              {f.search ? (
                <div className="list-search-input"><Search size={18} aria-hidden="true" /><input type="search" value={inputs[f.key]} placeholder={f.placeholder} maxLength={200} aria-describedby={f.key === 'q' ? 'bt-q-hint' : undefined} onChange={e => changeInput(f.key, e.target.value)} /></div>
              ) : (
                <input type="search" className="bt-input" value={inputs[f.key]} placeholder={f.placeholder} onChange={e => changeInput(f.key, e.target.value)} />
              )}
            </label>
          ))}
          <button type="button" className="list-button" onClick={clearFilters} disabled={!hasFilter}>ล้างตัวกรอง</button>
        </div>
        {qSupported !== false && <p id="bt-q-hint" className="list-muted bt-hint">ค้นแบบข้อความตรงตัวในทุกคอลัมน์ ไม่แยกตัวพิมพ์ — % และ _ ถือเป็นตัวอักษร จำนวนเงินใช้รูปแบบ 5400.00 วันที่ใช้ YYYY-MM-DD</p>}
        {qSupported === false && <p className="list-muted bt-hint">เซิร์ฟเวอร์ยังไม่รองรับการค้นหาทุกคอลัมน์ จึงค้นได้เฉพาะรายละเอียด เลขเอกสาร และผู้บันทึก</p>}
        <div className="list-result-info" role="status">
          <span>{pending ? 'กำลังค้นหา...' : result.error ? '' : result.total ? `แสดง ${first.toLocaleString('th-TH')}–${Math.min(page * pageSize, result.total).toLocaleString('th-TH')} จาก ${result.total.toLocaleString('th-TH')} รายการ` : ''}</span>
        </div>

        {result.error && !loading ? (
          <div className="list-error bt-error" role="alert">
            <AlertTriangle size={24} aria-hidden="true" />
            <div><strong>โหลดข้อมูลการเบิกจ่ายไม่สำเร็จ</strong><p>{result.error}</p></div>
            <button type="button" className="list-button" onClick={() => setRetry(n => n + 1)}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
          </div>
        ) : null}

        <div className="list-table-scroll bt-table" tabIndex={0} role="region" aria-label="ตารางข้อมูลการเบิกจ่าย" aria-busy={loading}>
          <table className="list-table">
            <caption className="list-sr-only">ข้อมูลการเบิกจ่าย หน้า {page} จาก {result.totalPages}</caption>
            <thead>
              <tr>
                <th scope="col" className="bt-num">ลำดับ</th>
                {COLUMNS.map(c => (
                  <th key={c.key} scope="col" className={c.numeric ? 'bt-num' : undefined} aria-sort={sort.key === c.key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="list-sort" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort.key === c.key ? (sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="bt-sort-idle" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !result.rows.length ? (
                <tr><td colSpan={COLUMNS.length + 1} className="list-empty"><Loader2 size={24} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</td></tr>
              ) : !result.error && result.rows.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 1} className="list-empty">{hasFilter ? 'ไม่พบรายการตามตัวกรอง' : 'ยังไม่มีข้อมูลการเบิกจ่าย'}</td></tr>
              ) : result.rows.map((row, i) => {
                const amount = Number(row.amount);
                return (
                  <tr key={row.transaction_id ?? i} className={loading ? 'bt-stale' : undefined}>
                    <td className="bt-num list-number">{((page - 1) * pageSize + i + 1).toLocaleString('th-TH')}</td>
                    <td>{row.posting_date || '—'}</td>
                    <td className="list-ip">{row.reference_doc_no || '—'}</td>
                    <td className="bt-ellipsis" title={row.description || ''}>{row.description || '—'}</td>
                    <td title={row.account_name || ''}>{row.account_code || row.cost_center || '—'}</td>
                    <td className="bt-ellipsis" title={row.clearing_account_name || ''}>{row.clearing_account_name || '—'}</td>
                    <td>{row.username || '—'}</td>
                    <td className={`bt-num list-number${amount < 0 ? ' bt-negative' : ''}`}>{money(row.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="list-footer">
          <span className="list-muted">จำนวนเงินติดลบคือรายการกลับ/หักล้าง</span>
          <div className="list-pagination">
            <label>จำนวนต่อหน้า
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="list-button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}>ก่อนหน้า</button>
            <span className="list-muted">หน้า {page.toLocaleString('th-TH')} / {result.totalPages.toLocaleString('th-TH')}</span>
            <button type="button" className="list-button" onClick={() => setPage(p => p + 1)} disabled={page >= result.totalPages || loading}>ถัดไป</button>
          </div>
        </div>
      </section>
    </div>
  );
}
