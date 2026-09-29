import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { historyRange, isCalendarDate } from './historyDates';
import './ListPage.css';
import './NetworkTestHistory.css';

const PAGE_SIZES = [10, 25, 50, 100];
const VIEW_KEY = 'networkTestHistory.view.v2';
const SORTS = ['timestamp', 'download', 'upload', 'latency'];
const LEGACY_CAP = 100;

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
      pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 25,
      sort: SORTS.includes(v.sort) ? v.sort : 'timestamp',
      order: v.order === 'asc' ? 'asc' : 'desc',
      from: isCalendarDate(v.from) ? v.from : '',
      to: isCalendarDate(v.to) ? v.to : ''
    };
  } catch {
    return { search: '', page: 1, pageSize: 25, sort: 'timestamp', order: 'desc', from: '', to: '' };
  }
};

// Speed-test history: the server pages through the whole history (newest
// first) and filters by date range. It has no search or other sort, so those
// work on the page that is loaded -- and say so.
export default function NetworkTestHistory({ token, onBack }) {
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [page, setPage] = useState(view.page);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState({ key: view.sort, order: view.order });
  const [range, setRange] = useState({ from: view.from, to: view.to }); // applied
  const [draft, setDraft] = useState({ from: view.from, to: view.to });
  const [rangeError, setRangeError] = useState('');
  const [state, setState] = useState({ status: 'loading', key: '', rows: [], error: '', paging: null, legacy: false, loadedAt: null });
  const [retry, setRetry] = useState(0);
  const inflight = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ search, page, pageSize, sort: sort.key, order: sort.order, from: range.from, to: range.to })); } catch { /* not remembered */ }
  }, [search, page, pageSize, sort, range]);

  const { params: rangeParams } = historyRange(range.from, range.to);
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize), ...rangeParams }).toString();

  useEffect(() => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState((s) => ({ ...s, status: s.loadedAt ? 'refreshing' : 'loading', error: '' }));
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/history?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const body = await res.json().catch(() => null);
        const code = body?.error?.code;
        if (res.status === 401) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        if (res.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูประวัติการทดสอบความเร็ว');
        if (res.status === 400 && (code === 'INVALID_DATE_RANGE' || code === 'INVALID_QUERY')) throw new Error('เซิร์ฟเวอร์ไม่รับช่วงวันที่หรือหน้าที่เลือก กรุณาตรวจสอบช่วงวันที่');
        const list = Array.isArray(body) ? body : body?.data;
        if (!res.ok || body?.success === false || !Array.isArray(list)) throw new Error(body?.message || `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}`);
        if (inflight.current !== controller) return;
        const serverPaged = body?.meta?.pagination_version === 'v1';
        const paging = serverPaged ? {
          totalItems: Math.max(0, Number(body.pagination?.total_items) || 0),
          totalPages: Math.max(0, Number(body.pagination?.total_pages) || 0)
        } : null;
        // A page past the end (history shrank or a remembered page): move to
        // the last page that has rows, once.
        if (paging && paging.totalPages > 0 && page > paging.totalPages) { setPage(paging.totalPages); return; }
        setState({ status: 'ready', key: query, rows: list.filter(Boolean).map(normalize), error: '', paging, legacy: !serverPaged, loadedAt: new Date() });
      } catch (err) {
        if (inflight.current !== controller) return;
        const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลไม่สำเร็จ';
        setState((s) => ({ ...s, status: s.loadedAt ? 'stale' : 'error', error: message }));
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, token, retry, page]);

  const q = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => state.rows.filter((r) => !q || [r.ip, r.computer, r.mac, r.tester, r.agent].some((v) => v.toLocaleLowerCase().includes(q))), [state.rows, q]);
  const sorted = useMemo(() => {
    if (sort.key === 'timestamp' && sort.order === 'desc') return filtered; // server order
    const value = (r) => (sort.key === 'timestamp' ? r.at?.getTime() ?? null : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const av = value(a); const bv = value(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sort.order === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sort]);

  // Server paging: the server already returned one page. Legacy API (whole
  // list, capped): page in the browser as before.
  const legacy = state.legacy;
  const totalPages = legacy ? Math.max(1, Math.ceil(sorted.length / pageSize)) : state.paging?.totalPages ?? 0;
  const currentPage = legacy ? Math.min(page, totalPages) : page;
  const rows = legacy ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted;
  const totalItems = legacy ? state.rows.length : state.paging?.totalItems ?? 0;
  const firstIndex = legacy ? (currentPage - 1) * pageSize : (page - 1) * pageSize;
  const hasData = state.loadedAt !== null;
  const pending = state.status === 'loading' || state.status === 'refreshing' || state.key !== query;
  const localSort = !(sort.key === 'timestamp' && sort.order === 'desc');
  const rangeActive = Boolean(range.from || range.to);

  const applyRange = (e) => {
    e.preventDefault();
    const { error } = historyRange(draft.from, draft.to);
    setRangeError(error);
    if (error) return;
    setRange({ ...draft });
    setPage(1);
  };
  const clearRange = () => { setDraft({ from: '', to: '' }); setRange({ from: '', to: '' }); setRangeError(''); setPage(1); };

  const toggleSort = (key) => { setSort((prev) => ({ key, order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc' })); if (legacy) setPage(1); };
  const sortHeader = (key, label, numeric) => (
    <th scope="col" className={numeric ? 'nth-num' : undefined} aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => toggleSort(key)}>
        {label}{sort.key === key ? (sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="nth-idle" />}
      </button>
    </th>
  );
  const rangeLabel = rangeActive
    ? `${range.from ? new Date(`${range.from}T00:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : 'ทั้งหมดก่อนหน้า'} – ${range.to ? new Date(`${range.to}T00:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : 'ปัจจุบัน'}`
    : 'ทุกช่วงเวลา';

  return (
    <div className="list-page nth-page">
      <header className="list-header">
        <div>
          <button type="button" className="list-button nth-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> กลับ</button>
          <h2>ประวัติการทดสอบความเร็ว</h2>
          <p>ผลที่ผู้ใช้กดทดสอบจากหน้า "ตรวจสอบการเชื่อมต่อ" · Download/Upload วัดระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์ของระบบ · เวลาตอบกลับเป็น HTTP round trip (ไม่ใช่ ping)</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={() => setRetry((n) => n + 1)} disabled={pending}>
            <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'โหลดไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดประวัติการทดสอบไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={() => setRetry((n) => n + 1)}>ลองใหม่</button>
        </div>
      )}
      {legacy && state.rows.length >= LEGACY_CAP && <p className="list-filter-warning">เซิร์ฟเวอร์รุ่นนี้ส่งเฉพาะการทดสอบล่าสุด {state.rows.length} รายการ และยังกรองตามช่วงวันที่ไม่ได้</p>}

      <section className="list-panel" aria-label="ประวัติการทดสอบความเร็ว">
        <form className="list-toolbar nth-range" onSubmit={applyRange} noValidate>
          <label className={`list-field${draft.from ? ' is-active' : ''}`}>
            <span>ตั้งแต่วันที่</span>
            <input type="date" className="nth-date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} aria-invalid={rangeError ? 'true' : undefined} aria-describedby={rangeError ? 'nth-range-error' : undefined} />
          </label>
          <label className={`list-field${draft.to ? ' is-active' : ''}`}>
            <span>ถึงวันที่ (รวมทั้งวัน)</span>
            <input type="date" className="nth-date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-invalid={rangeError ? 'true' : undefined} aria-describedby={rangeError ? 'nth-range-error' : undefined} />
          </label>
          <button type="submit" className="list-button list-button-primary" disabled={legacy && hasData}>ใช้ช่วงวันที่</button>
          {(rangeActive || draft.from || draft.to) && <button type="button" className="list-button" onClick={clearRange}>ทุกช่วงเวลา</button>}
          {rangeError && <p id="nth-range-error" className="nth-range-error" role="alert">{rangeError}</p>}
        </form>
        <div className="list-toolbar nth-search">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหาในหน้านี้</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder="ผู้ทดสอบ ชื่อคอมพิวเตอร์ IP หรือ MAC" onChange={(e) => { setSearch(e.target.value); if (legacy) setPage(1); }} />
            </div>
          </label>
          <button type="button" className="list-button" onClick={() => setSearch('')} disabled={!search}>ล้างคำค้น</button>
        </div>
        {hasData && (
          <div className="list-result-info" role="status">
            <span>{rangeLabel} · ทั้งหมด {totalItems.toLocaleString('th-TH')} รายการ{q ? ` · พบ ${sorted.length} จาก ${state.rows.length} รายการในหน้านี้` : ''}</span>
            <span>{!legacy && (q || localSort) ? 'การค้นหาและการเรียงคอลัมน์ใช้กับรายการในหน้านี้เท่านั้น (เซิร์ฟเวอร์เรียงใหม่สุดก่อน)' : ''}</span>
          </div>
        )}

        {state.status === 'loading' ? (
          <div className="nth-state" role="status"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</div>
        ) : !hasData ? (
          state.status === 'error' ? null : <div className="nth-state">ยังไม่มีข้อมูลให้แสดง</div>
        ) : totalItems === 0 ? (
          <div className="nth-state"><p>{rangeActive ? 'ไม่มีการทดสอบในช่วงวันที่นี้' : 'ยังไม่มีประวัติการทดสอบ'}</p>{rangeActive && <button type="button" className="list-button" onClick={clearRange}>ดูทุกช่วงเวลา</button>}</div>
        ) : sorted.length === 0 ? (
          <div className="nth-state"><p>ไม่พบรายการตามคำค้นในหน้านี้</p><button type="button" className="list-button" onClick={() => setSearch('')}>ล้างคำค้น</button></div>
        ) : (
          <>
            <div className="list-table-scroll nth-table" tabIndex={0} role="region" aria-label="ตารางประวัติการทดสอบ" aria-busy={pending}>
              <table className="list-table">
                <caption className="list-sr-only">ประวัติการทดสอบความเร็ว {rangeLabel} หน้า {currentPage} จาก {Math.max(1, totalPages)}</caption>
                <thead><tr>
                  {sortHeader('timestamp', 'วันที่และเวลา')}
                  <th scope="col">ผู้ทดสอบ</th><th scope="col">ชื่อคอมพิวเตอร์</th><th scope="col">IP</th><th scope="col">MAC</th>
                  {sortHeader('download', 'Download (Mbps)', true)}
                  {sortHeader('upload', 'Upload (Mbps)', true)}
                  {sortHeader('latency', 'เวลาตอบกลับ (ms)', true)}
                  <th scope="col">เบราว์เซอร์</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
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
              {rows.map((r) => (
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
          </>
        )}
        {hasData && totalItems > 0 && (
          <div className="list-footer">
            <span>{legacy || !q ? `แสดง ${firstIndex + 1}–${firstIndex + (legacy ? rows.length : state.rows.length)} จาก ${totalItems.toLocaleString('th-TH')} รายการ` : `หน้านี้มี ${state.rows.length} รายการ`}</span>
            <div className="list-pagination">
              <label>จำนวนต่อหน้า
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              <button type="button" className="list-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1 || pending}>ก่อนหน้า</button>
              <span className="list-muted">หน้า {currentPage} / {Math.max(1, totalPages)}</span>
              <button type="button" className="list-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages || pending}>ถัดไป</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
