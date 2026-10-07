import { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, FilePlus2, Loader2, PencilRuler, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import '../equipment-form/ConfirmDialog.css';
import { LIST_LIMIT, TYPE_LABELS, deleteDrawing, entryFromDrawing, formatWhen, request, roleCanEdit, urls } from './officeDrawingApi.js';
import { useDebouncedText, useDrawingResource, useSiteInfo, useUrlQuery } from './officeHooks.js';
import { Pager, PageError } from './Offices.jsx';
import DuplicateDrawingDialog from './DuplicateDrawingDialog.jsx';
import '../ListPage.css';
import './Offices.css';

const SORTS = { 'updated_at:desc': 'แก้ไขล่าสุด', 'name:asc': 'ชื่อ ก–ฮ', 'created_at:desc': 'สร้างล่าสุด', 'created_at:asc': 'สร้างเก่าสุด' };
const DEFAULTS = { search: '', type: '', sort: 'updated_at:desc', page: 1 };
const parse = (q) => ({
  search: (q.get('search') || '').slice(0, 200),
  type: ['floor_plan', 'network_layout'].includes(q.get('type')) ? q.get('type') : '',
  sort: SORTS[q.get('sort')] ? q.get('sort') : DEFAULTS.sort,
  page: Math.max(1, Number.parseInt(q.get('page'), 10) || 1)
});
export default function OfficeDrawingList({ siteId, token, user, onGo, onRequireLogin }) {
  const site = useSiteInfo(siteId);
  const [q, setQ] = useUrlQuery(parse, DEFAULTS);
  const [searchText, setSearchText] = useDebouncedText(q.search, (search) => setQ({ search, page: 1 }));
  const [sort, order] = q.sort.split(':');
  const [nonce, setNonce] = useState(0);
  const list = useDrawingResource(urls.list({ pea_site_id: siteId, search: q.search, drawing_type: q.type, page: q.page, limit: LIST_LIMIT, sort, order }), { token, nonce });
  const caps = useDrawingResource(urls.capabilities(), { token });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dup, setDup] = useState(null);

  const rows = list.data;
  const pages = list.pagination?.totalPages;
  const pastEnd = Boolean(rows) && !list.stale && pages > 0 && q.page > pages;
  useEffect(() => { if (pastEnd) setQ({ page: pages }); });

  const siteName = site.site?.label || rows?.[0]?.pea_site_name || '';
  const canCreate = Boolean(token) && roleCanEdit(user) && caps.data?.permissions?.can_create === true;
  const path = (rest = '') => `/offices/${siteId}/drawings${rest}`;
  const open = (e, to) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onGo(to); } };

  const runDelete = async () => {
    const d = confirmDelete;
    setDeleting(true);
    const r = await deleteDrawing(d.id, d.version, token);
    setDeleting(false);
    setConfirmDelete(null);
    if (r.ok) toast.success(`ลบแบบ “${d.name}” แล้ว`);
    else if (r.status === 409) toast.error('มีผู้แก้ไขแบบนี้หลังจากที่รายการโหลดมา จึงยังไม่ลบ — รายการโหลดใหม่แล้ว กรุณาตรวจสอบแล้วลบอีกครั้ง', { duration: 8000 });
    else if (r.status === 0) toast.error(`${r.message} — ไม่ทราบว่าลบแล้วหรือยัง รายการโหลดใหม่ให้แล้ว`, { duration: 8000 });
    else toast.error(r.message);
    setNonce(n => n + 1);
  };

  // Copy needs the full document and the link states.
  const startDuplicate = async (row) => {
    const [d, l] = await Promise.all([request(urls.drawing(row.id), { token }), request(urls.links(row.id), { token })]);
    if (!d.ok) { toast.error(d.message); return; }
    setDup({ drawing: d.data, links: l.ok ? l.data : null, linksError: l.ok ? '' : l.message });
  };

  if (site.status === 'notfound') {
    return (
      <div className="list-page od-page">
        <PageError title="ไม่พบสำนักงานนี้" error={{ message: `ไม่มีสำนักงานรหัส ${siteId} ในระบบ` }} />
        <button type="button" className="list-button" onClick={() => onGo('/offices')}><ArrowLeft size={18} aria-hidden="true" /> กลับไปรายชื่อสำนักงาน</button>
      </div>
    );
  }

  return (
    <Motion.div className="list-page od-page" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
      <nav className="od-crumbs" aria-label="ตำแหน่งหน้า">
        <a href="/offices" onClick={e => open(e, '/offices')}>สำนักงาน</a> <span aria-hidden="true">/</span> <span>{siteName || '…'}</span>
      </nav>
      <header className="list-header">
        <div>
          <h1>{siteName || 'แบบของสำนักงาน'}</h1>
          <p>{site.site ? [site.site.pea_type, site.site.province].filter(Boolean).join(' · ') : ''}{site.site ? ' · ' : ''}ผังสำนักงานและแนวเดินสาย</p>
        </div>
        <div className="list-actions">
          {canCreate ? (
            <a className="list-button list-button-primary" href={path('/new')} onClick={e => open(e, path('/new'))}><FilePlus2 size={18} aria-hidden="true" /> สร้างแบบใหม่</a>
          ) : !token ? (
            <button type="button" className="list-button" onClick={() => onRequireLogin(path(window.location.search))}>เข้าสู่ระบบเพื่อสร้างหรือแก้ไขแบบ</button>
          ) : null}
        </div>
      </header>
      {site.status === 'error' && <PageError error={site.error} onRetry={site.retry} title="โหลดข้อมูลสำนักงานไม่สำเร็จ" />}

      <section className="list-panel">
        <div className="list-toolbar">
          <div className={`list-field list-search${q.search ? ' is-active' : ''}`}>
            <label htmlFor="od-dw-search">ค้นหาแบบ</label>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input id="od-dw-search" type="search" maxLength={200} value={searchText} placeholder="ชื่อแบบ อาคาร หรือชั้น" onChange={e => setSearchText(e.target.value)} />
            </div>
          </div>
          <div className={`list-field${q.type ? ' is-active' : ''}`}>
            <label htmlFor="od-dw-type">ชนิดแบบ</label>
            <select id="od-dw-type" value={q.type} onChange={e => setQ({ type: e.target.value, page: 1 })}>
              <option value="">ทุกชนิด</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="list-field">
            <label htmlFor="od-dw-sort">เรียงตาม</label>
            <select id="od-dw-sort" value={q.sort} onChange={e => setQ({ sort: e.target.value, page: 1 })}>
              {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {list.error && <div className="od-pad"><PageError error={list.error} onRetry={list.retry} title="โหลดรายการแบบไม่สำเร็จ" /></div>}
        {list.loading && !rows && <p className="od-state" role="status"><Loader2 size={20} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</p>}
        {rows && (
          rows.length === 0 ? (
            <div className="od-empty">
              <PencilRuler size={32} aria-hidden="true" />
              <p>{q.search || q.type ? 'ไม่พบแบบที่ตรงกับเงื่อนไข' : 'สำนักงานนี้ยังไม่มีแบบ'}</p>
              {canCreate && !q.search && !q.type && <a className="list-button list-button-primary" href={path('/new')} onClick={e => open(e, path('/new'))}><FilePlus2 size={18} aria-hidden="true" /> สร้างแบบแรก</a>}
            </div>
          ) : (
            <ul className={`od-drawing-list${list.stale ? ' is-stale' : ''}`}>
              {rows.map(d => (
                <li key={d.id} className="od-drawing">
                  <a className="od-drawing-main" href={path(`/${d.id}`)} onClick={e => open(e, path(`/${d.id}`))}>
                    <strong>{d.name}</strong>
                    <span className="list-muted">{TYPE_LABELS[d.drawing_type] || d.drawing_type}{d.building_label ? ` · ${d.building_label}` : ''}{d.floor_label ? ` · ${d.floor_label}` : ''}</span>
                    <span className="list-muted">แก้ไขล่าสุด {formatWhen(d.updated_at)}{d.updated_by?.display_name ? ` โดย ${d.updated_by.display_name}` : ''} · ฉบับที่ {d.version}</span>
                  </a>
                  <div className="od-drawing-actions">
                    {d.permissions?.can_create && <button type="button" className="list-button" onClick={() => startDuplicate(d)}><Copy size={16} aria-hidden="true" /> ทำสำเนา</button>}
                    {d.permissions?.can_delete && <button type="button" className="list-button od-danger" onClick={() => setConfirmDelete(d)}><Trash2 size={16} aria-hidden="true" /> ลบ</button>}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
        <Pager pagination={list.pagination} page={q.page} unit="แบบ" disabled={list.loading} onPage={page => setQ({ page })} />
      </section>

      <ConfirmDialog open={Boolean(confirmDelete)} tone="danger" busy={deleting} title="ลบแบบนี้?"
        message={confirmDelete && `“${confirmDelete.name}” จะถูกลบออกจากรายการ (ไม่กระทบข้อมูลสำนักงานหรือทะเบียนอุปกรณ์)`}
        confirmLabel="ลบแบบ" onCancel={() => setConfirmDelete(null)} onConfirm={runDelete} />
      {dup && (
        <DuplicateDrawingDialog siteId={siteId} siteName={siteName} entry={entryFromDrawing(dup.drawing)} links={dup.links} linksError={dup.linksError}
          onRetryLinks={async () => { const l = await request(urls.links(dup.drawing.id), { token }); setDup(x => ({ ...x, links: l.ok ? l.data : null, linksError: l.ok ? '' : l.message })); }}
          token={token} onClose={() => setDup(null)}
          onCreated={(created) => { setDup(null); toast.success('สร้างสำเนาแล้ว'); onGo(`/offices/${created.pea_site_id}/drawings/${created.id}`); }} />
      )}
    </Motion.div>
  );
}
