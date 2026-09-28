import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search } from 'lucide-react';
import OfficeSiteEquipment from './OfficeSiteEquipment';
import './ListPage.css';
import './OfficeEquipmentManagement.css';

const VIEW_KEY = 'office_list_view.v1';
const FOCUS_KEY = 'office_list_return_focus';
const PAGE_SIZES = [10, 20, 50, 100];
const SORTS = {
  pea_name: { label: 'สำนักงาน', value: (s) => s.pea_name || '' },
  pea_province: { label: 'จังหวัด', value: (s) => s.pea_province || '' },
  pea_type: { label: 'ประเภท', value: (s) => s.pea_type || '' },
  count: { label: 'อุปกรณ์', value: (s) => s.count }
};

const readView = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
      type: typeof v.type === 'string' ? v.type : '',
      hasEquipment: ['', 'yes', 'no'].includes(v.hasEquipment) ? v.hasEquipment : '',
      page: Number.isSafeInteger(v.page) && v.page > 0 ? v.page : 1,
      pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 20,
      sort: SORTS[v.sort?.key] && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : { key: 'pea_name', order: 'asc' }
    };
  } catch {
    return { search: '', type: '', hasEquipment: '', page: 1, pageSize: 20, sort: { key: 'pea_name', order: 'asc' } };
  }
};

// Office list (/management/computers) and, once an office is selected
// (/management/computers/:siteId), that office's equipment view.
const OfficeEquipmentManagement = ({ token, onBack, user, selectedSiteId = null, onSelectSite }) => {
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [type, setType] = useState(view.type);
  const [hasEquipment, setHasEquipment] = useState(view.hasEquipment);
  const [page, setPage] = useState(view.page);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState(view.sort);
  const [state, setState] = useState({ status: 'loading', sites: [], error: '' });
  const inflight = useRef(null);
  const restored = useRef(false);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ search, type, hasEquipment, page, pageSize, sort })); } catch { /* optional */ }
  }, [search, type, hasEquipment, page, pageSize, sort]);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState((s) => ({ ...s, status: s.sites.length ? 'refreshing' : 'loading' }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites/summary`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const result = await response.json().catch(() => null);
      const list = Array.isArray(result) ? result : result?.data;
      if (!response.ok || !Array.isArray(list)) throw new Error(result?.message || `HTTP ${response.status}`);
      if (inflight.current !== controller) return;
      setState({
        status: 'ready',
        sites: list.filter(Boolean).map((s) => ({ id: s.id, pea_name: s.pea_name, pea_province: s.pea_province, pea_type: s.pea_type, count: Number(s.equipment_count) || 0 })),
        error: ''
      });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดรายชื่อสำนักงานไม่สำเร็จ';
      setState((s) => ({ ...s, status: s.sites.length ? 'stale' : 'error', error: message }));
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  const types = [...new Set(state.sites.map((s) => s.pea_type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
  const q = search.trim().toLowerCase();
  const filtered = state.sites.filter((s) => (!q || [s.pea_name, s.pea_province].some((v) => String(v ?? '').toLowerCase().includes(q)))
    && (!type || s.pea_type === type)
    && (!hasEquipment || (hasEquipment === 'yes' ? s.count > 0 : s.count === 0)));
  const get = SORTS[sort.key].value;
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [get(a), get(b)];
    const cmp = typeof x === 'number' ? x - y : x.localeCompare(y, 'th');
    return sort.order === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * pageSize, current * pageSize);
  const filtering = Boolean(q || type || hasEquipment);
  const clear = () => { setSearch(''); setType(''); setHasEquipment(''); setPage(1); };
  const selectedSite = state.sites.find((s) => String(s.id) === String(selectedSiteId)) || null;

  // Back from an office: return focus to the link that opened it.
  useEffect(() => {
    if (selectedSiteId || state.status !== 'ready' || restored.current) return;
    restored.current = true;
    let id = '';
    try { id = sessionStorage.getItem(FOCUS_KEY) || ''; sessionStorage.removeItem(FOCUS_KEY); } catch { /* optional */ }
    if (!id) return;
    const link = document.querySelector(`.oem-page a.list-name[data-site-id="${CSS.escape(id)}"]`);
    if (link) { link.scrollIntoView({ block: 'center' }); link.focus(); }
  }, [selectedSiteId, state.status]);
  useEffect(() => { if (selectedSiteId) restored.current = false; }, [selectedSiteId]);

  const open = (site) => {
    try { sessionStorage.setItem(FOCUS_KEY, String(site.id)); } catch { /* optional */ }
    onSelectSite?.(site.id);
  };

  if (selectedSiteId) {
    return (
      <OfficeSiteEquipment
        key={selectedSiteId}
        siteId={selectedSiteId}
        site={selectedSite}
        token={token}
        user={user}
        onBackToSites={() => onSelectSite && onSelectSite(null)}
        onMutated={load}
      />
    );
  }

  const sortHeader = (key, className) => (
    <th scope="col" className={className} aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => { setSort((s) => ({ key, order: s.key === key && s.order === 'asc' ? 'desc' : 'asc' })); setPage(1); }}>
        {SORTS[key].label}
        {sort.key !== key ? <ArrowUpDown size={14} aria-hidden="true" className="oem-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  return (
    <div className="list-page oem-page">
      <button type="button" className="list-button oem-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการจัดการ</button>
      <header className="list-header">
        <div>
          <h1>อุปกรณ์คอมพิวเตอร์ตามสำนักงาน</h1>
          <p>เลือกสำนักงานเพื่อดู เพิ่ม และแก้ไขอุปกรณ์ของสำนักงานนั้น</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load} disabled={state.status === 'loading' || state.status === 'refreshing'}>
            <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'รีเฟรชไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดรายชื่อสำนักงานไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายชื่อสำนักงาน">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่อสำนักงาน หรือจังหวัด" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </label>
          <label className={`list-field${type ? ' is-active' : ''}`}>
            <span>ประเภทสำนักงาน</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">ทุกประเภท</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={`list-field${hasEquipment ? ' is-active' : ''}`}>
            <span>อุปกรณ์</span>
            <select value={hasEquipment} onChange={(e) => { setHasEquipment(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              <option value="yes">มีอุปกรณ์</option>
              <option value="no">ยังไม่มีอุปกรณ์</option>
            </select>
          </label>
          {filtering && <button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button>}
        </div>
        {state.sites.length > 0 && (
          <div className="list-result-info">
            <span role="status">{filtering ? `พบ ${sorted.length} จาก ${state.sites.length} สำนักงาน` : `ทั้งหมด ${state.sites.length} สำนักงาน`}</span>
            <span>อุปกรณ์รวม {filtered.reduce((n, s) => n + s.count, 0).toLocaleString('th-TH')} รายการ</span>
          </div>
        )}

        {state.status === 'loading' ? (
          <div className="oem-state" role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>กำลังโหลดรายชื่อสำนักงาน…</p></div>
        ) : state.sites.length === 0 ? (
          state.status === 'error' ? null : <div className="oem-state"><p>ยังไม่มีสำนักงานในระบบ</p></div>
        ) : sorted.length === 0 ? (
          <div className="oem-state"><p><strong>ไม่พบสำนักงานที่ตรงกับเงื่อนไข</strong></p><button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button></div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางสำนักงาน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
            <table className="list-table oem-table">
              <caption className="list-sr-only">สำนักงานและจำนวนอุปกรณ์คอมพิวเตอร์ หน้า {current} จาก {totalPages} กดชื่อสำนักงานเพื่อดูอุปกรณ์</caption>
              <thead>
                <tr>
                  {sortHeader('pea_name')}
                  {sortHeader('pea_province')}
                  {sortHeader('pea_type')}
                  {sortHeader('count', 'oem-num')}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a
                        className="list-name"
                        data-site-id={s.id}
                        href={`/management/computers/${s.id}`}
                        title={s.pea_name}
                        onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); open(s); } }}
                      >{s.pea_name || `สำนักงาน #${s.id}`}</a>
                    </td>
                    <td>{s.pea_province || '—'}</td>
                    <td>{s.pea_type || '—'}</td>
                    <td className="oem-num">{s.count ? s.count.toLocaleString('th-TH') : <span className="list-muted">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sorted.length > 0 && (
          <footer className="list-footer">
            <span className="list-muted">{(current - 1) * pageSize + 1}–{(current - 1) * pageSize + rows.length} จาก {sorted.length} สำนักงาน</span>
            <label className="list-page-size">
              แสดง
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              รายการต่อหน้า
            </label>
            <nav className="list-pagination" aria-label="แบ่งหน้ารายชื่อสำนักงาน">
              <button type="button" className="list-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button>
              <label>หน้า <select value={current} onChange={(e) => setPage(Number(e.target.value))}>
                {Array.from({ length: totalPages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select> / {totalPages}</label>
              <button type="button" className="list-button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>ถัดไป</button>
            </nav>
          </footer>
        )}
      </section>
    </div>
  );
};

export default OfficeEquipmentManagement;
