import { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertTriangle, Building2, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react';
import { SITES_LIMIT, urls } from './officeDrawingApi.js';
import { useDebouncedText, useDrawingResource, useUrlQuery } from './officeHooks.js';
import '../ListPage.css';
import './Offices.css';

const DEFAULTS = { search: '', page: 1 };
const parse = (q) => ({ search: (q.get('search') || '').slice(0, 200), page: Math.max(1, Number.parseInt(q.get('page'), 10) || 1) });

export function PageError({ error, onRetry, title = 'โหลดข้อมูลไม่สำเร็จ' }) {
  return (
    <div className="list-error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div><strong>{title}</strong><p>{error?.message || 'กรุณาลองใหม่'}</p></div>
      {onRetry && <button type="button" className="list-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>}
    </div>
  );
}

export function Pager({ pagination, page, onPage, disabled, unit }) {
  if (!pagination || !pagination.total) return null;
  const totalPages = pagination.totalPages || 1;
  const from = (page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.total, page * pagination.limit);
  return (
    <footer className="list-footer">
      <span>{from > pagination.total ? `ไม่มี${unit}ในหน้านี้` : `${from}–${to} จาก ${pagination.total} ${unit}`}</span>
      {totalPages > 1 && (
        <nav className="list-pagination" aria-label={`แบ่งหน้า${unit}`}>
          <button type="button" className="list-button" disabled={disabled || page <= 1} onClick={() => onPage(Math.min(page - 1, totalPages))}>ก่อนหน้า</button>
          <span aria-live="polite">หน้า {page} / {totalPages}</span>
          <button type="button" className="list-button" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>ถัดไป</button>
        </nav>
      )}
    </footer>
  );
}

// เมนู "สำนักงาน": every office (also those without a monitored network
// device) with how many drawings it has. Public.
export default function Offices({ token, onGo }) {
  const [q, setQ] = useUrlQuery(parse, DEFAULTS);
  const [searchText, setSearchText] = useDebouncedText(q.search, (search) => setQ({ search, page: 1 }));
  const sites = useDrawingResource(urls.selectors({ search: q.search, page: q.page, limit: SITES_LIMIT }), { token });
  const list = sites.data?.sites;
  // Past the last page (a stale link): the server answers an empty page
  // with the real total; go to the last page once.
  const pages = sites.pagination?.totalPages;
  const pastEnd = Boolean(list) && !sites.stale && pages > 0 && q.page > pages;
  useEffect(() => { if (pastEnd) setQ({ page: pages }); });

  return (
    <Motion.div className="list-page od-page" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
      <header className="list-header">
        <div>
          <h1>สำนักงาน</h1>
          <p>เลือกสำนักงานเพื่อดูหรือวาดผังสำนักงานและแนวเดินสาย ดูได้โดยไม่ต้องเข้าสู่ระบบ</p>
        </div>
      </header>
      <section className="list-panel">
        <div className="list-toolbar">
          <div className={`list-field list-search${q.search ? ' is-active' : ''}`}>
            <label htmlFor="od-site-search">ค้นหาสำนักงาน</label>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input id="od-site-search" type="search" maxLength={200} value={searchText} placeholder="ชื่อสำนักงานหรือจังหวัด" onChange={e => setSearchText(e.target.value)} />
            </div>
          </div>
        </div>
        {sites.error && <div className="od-pad"><PageError error={sites.error} onRetry={sites.retry} title="โหลดรายชื่อสำนักงานไม่สำเร็จ" /></div>}
        {sites.loading && !list && <p className="od-state" role="status"><Loader2 size={20} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</p>}
        {list && (
          <>
            {list.length === 0 ? <p className="od-state">ไม่พบสำนักงานที่ตรงกับคำค้น</p> : (
              <ul className={`od-site-list${sites.stale ? ' is-stale' : ''}`}>
                {list.map(s => (
                  <li key={s.value}>
                    <a className="od-site" href={`/offices/${s.value}/drawings`}
                      onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onGo(`/offices/${s.value}/drawings`); } }}>
                      <Building2 size={22} aria-hidden="true" className="od-site-icon" />
                      <span className="od-site-main">
                        <strong>{s.label}</strong>
                        <span className="list-muted">{[s.pea_type, s.province].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                      <span className={`od-count${s.drawing_count ? ' has-items' : ''}`}>{s.drawing_count ? `${s.drawing_count} แบบ` : 'ยังไม่มีแบบ'}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <Pager pagination={sites.pagination} page={q.page} unit="สำนักงาน" disabled={sites.loading} onPage={page => setQ({ page })} />
          </>
        )}
      </section>
    </Motion.div>
  );
}
