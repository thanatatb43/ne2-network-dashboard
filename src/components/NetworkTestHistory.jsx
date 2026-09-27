import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import './ListPage.css';
import './NetworkTestHistory.css';

const PAGE_SIZES = [10, 25, 50, 100];
const VIEW_KEY = 'networkTestHistory.view.v1';
const SORTS = ['timestamp', 'download', 'upload', 'latency'];

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = (v) => (v === null ? '—' : v.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const time = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

const normalize = (item, i) => ({
  key: item.id ?? `${item.timestamp}-${i}`,
  at: time(item.timestamp ?? item.createdAt),
  ip: item.ip_address || '',
  computer: item.computer_name || '',
  mac: item.mac_address || '',
  download: num(item.download_speed),
  upload: num(item.upload_speed),
  latency: num(item.latency),
  tester: item.user ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() || item.user.username || '' : String(item.user_id || ''),
  agent: item.userAgent || item.user_agent || ''
});

const readView = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
      page: Number.isInteger(v.page) && v.page > 0 ? v.page : 1,
      pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 10,
      sort: SORTS.includes(v.sort) ? v.sort : 'timestamp',
      order: v.order === 'asc' ? 'asc' : 'desc'
    };
  } catch {
    return { search: '', page: 1, pageSize: 10, sort: 'timestamp', order: 'desc' };
  }
};

export default function NetworkTestHistory({ token, onBack }) {
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [page, setPage] = useState(view.page);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState({ key: view.sort, order: view.order });
  const [state, setState] = useState({ status: 'loading', rows: [], error: '', total: null, loadedAt: null });
  const inflight = useRef(null);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState(s => ({ ...s, status: s.loadedAt ? 'refreshing' : 'loading', error: '' }));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/history`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (res.status === 401) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      if (res.status === 403) throw new Error('คุณไม่มีสิทธิ์ดูประวัติการทดสอบความเร็ว');
      const list = Array.isArray(body) ? body : body?.data;
      if (!res.ok || body?.success === false || !Array.isArray(list)) throw new Error(body?.message || `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}`);
      if (inflight.current !== controller) return;
      const total = Number(body?.pagination?.total ?? body?.pagination?.total_items ?? body?.total);
      setState({ status: 'ready', rows: list.filter(Boolean).map(normalize), error: '', total: Number.isFinite(total) ? total : null, loadedAt: new Date() });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลไม่สำเร็จ';
      setState(s => ({ ...s, status: s.loadedAt ? 'stale' : 'error', error: message }));
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ search, page, pageSize, sort: sort.key, order: sort.order })); } catch { /* not remembered */ }
  }, [search, page, pageSize, sort]);

  const q = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => state.rows.filter(r => !q || [r.ip, r.computer, r.mac, r.tester, r.agent].some(v => v.toLocaleLowerCase().includes(q))), [state.rows, q]);
  const sorted = useMemo(() => {
    const value = (r) => (sort.key === 'timestamp' ? r.at?.getTime() ?? null : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort.order === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasData = state.loadedAt !== null;
  const partial = state.total !== null && state.total > state.rows.length;

  const toggleSort = (key) => { setSort(prev => ({ key, order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc' })); setPage(1); };
  const sortHeader = (key, label, numeric) => (
    <th scope="col" className={numeric ? 'nth-num' : undefined} aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => toggleSort(key)}>
        {label}{sort.key === key ? (sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="nth-idle" />}
      </button>
    </th>
  );

  return (
    <div className="list-page nth-page">
      <header className="list-header">
        <div>
          <button type="button" className="list-button nth-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> กลับ</button>
          <h2>ประวัติการทดสอบความเร็ว</h2>
          <p>ผลที่ผู้ใช้กดทดสอบจากหน้า "ตรวจสอบการเชื่อมต่อ" · Download/Upload วัดระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์ของระบบ · เวลาตอบกลับเป็น HTTP round trip (ไม่ใช่ ping)</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load} disabled={state.status === 'loading' || state.status === 'refreshing'}>
            <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'รีเฟรชไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดประวัติการทดสอบไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
        </div>
      )}
      {partial && <p className="list-filter-warning">เซิร์ฟเวอร์ส่งมา {state.rows.length} จาก {state.total} รายการ การค้นหาและเรียงครอบคลุมเฉพาะที่โหลดมา</p>}

      <section className="list-panel" aria-label="ประวัติการทดสอบความเร็ว">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder="ผู้ทดสอบ ชื่อคอมพิวเตอร์ IP หรือ MAC" onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </label>
          <button type="button" className="list-button" onClick={() => { setSearch(''); setPage(1); }} disabled={!search}>ล้างคำค้น</button>
        </div>
        {hasData && <div className="list-result-info" role="status"><span>{q ? `พบ ${sorted.length} จาก ${state.rows.length} รายการ` : `ทั้งหมด ${state.rows.length} รายการ`}</span></div>}

        {state.status === 'loading' ? (
          <div className="nth-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</div>
        ) : !hasData ? (
          <div className="nth-state">ยังไม่มีข้อมูลให้แสดง</div>
        ) : state.rows.length === 0 ? (
          <div className="nth-state">ยังไม่มีประวัติการทดสอบ</div>
        ) : sorted.length === 0 ? (
          <div className="nth-state"><p>ไม่พบรายการตามคำค้น</p><button type="button" className="list-button" onClick={() => setSearch('')}>ล้างคำค้น</button></div>
        ) : (
          <>
            <div className="list-table-scroll nth-table" tabIndex={0} role="region" aria-label="ตารางประวัติการทดสอบ">
              <table className="list-table">
                <caption className="list-sr-only">ประวัติการทดสอบความเร็ว หน้า {currentPage} จาก {totalPages}</caption>
                <thead><tr>
                  {sortHeader('timestamp', 'วันที่และเวลา')}
                  <th scope="col">ผู้ทดสอบ</th><th scope="col">ชื่อคอมพิวเตอร์</th><th scope="col">IP</th><th scope="col">MAC</th>
                  {sortHeader('download', 'Download (Mbps)', true)}
                  {sortHeader('upload', 'Upload (Mbps)', true)}
                  {sortHeader('latency', 'เวลาตอบกลับ (ms)', true)}
                  <th scope="col">เบราว์เซอร์</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key}>
                      <td>{r.at ? r.at.toLocaleString('th-TH') : '—'}</td>
                      <td>{r.tester || 'ไม่ระบุ (ไม่ได้เข้าสู่ระบบ)'}</td>
                      <td>{r.computer || '—'}</td>
                      <td className="list-ip">{r.ip || '—'}</td>
                      <td className="list-ip">{r.mac || '—'}</td>
                      <td className="nth-num list-number">{fmt(r.download)}</td>
                      <td className="nth-num list-number">{fmt(r.upload)}</td>
                      <td className="nth-num list-number">{fmt(r.latency)}</td>
                      <td className="nth-agent" title={r.agent || undefined}>{r.agent || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="nth-cards">
              {rows.map(r => (
                <li key={r.key}>
                  <strong>{r.at ? r.at.toLocaleString('th-TH') : '—'}</strong>
                  <p className="list-muted">{r.tester || 'ไม่ระบุผู้ทดสอบ'} · {r.computer || '—'}</p>
                  <dl>
                    <div><dt>Download</dt><dd>{fmt(r.download)} Mbps</dd></div>
                    <div><dt>Upload</dt><dd>{fmt(r.upload)} Mbps</dd></div>
                    <div><dt>เวลาตอบกลับ</dt><dd>{fmt(r.latency)} ms</dd></div>
                    <div><dt>IP / MAC</dt><dd className="list-ip">{r.ip || '—'} · {r.mac || '—'}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="list-footer">
              <span>แสดง {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} จาก {sorted.length} รายการ</span>
              <div className="list-pagination">
                <label>จำนวนต่อหน้า
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <button type="button" className="list-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>ก่อนหน้า</button>
                <span className="list-muted">หน้า {currentPage} / {totalPages}</span>
                <button type="button" className="list-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>ถัดไป</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
