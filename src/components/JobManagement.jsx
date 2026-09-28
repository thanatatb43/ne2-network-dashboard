import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, History, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import SearchableDropdown from './SearchableDropdown';
import JobHistoryModal from './JobHistoryModal';
import JobManagementDetails from './JobManagementDetails';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import { siteLabel, jobStatusTone, jobPriorityTone } from './jobReportShared';
import { jobPermissions, deleteJob, setJobIntent } from './jobManagementShared';
import './ListPage.css';
import './JobReport.css';
import './JobManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;
const STATUS_OPTIONS = ['เปิดงาน', 'ระหว่างดำเนินการ', 'เสร็จงาน', 'ยกเลิก'];
const JOB_TYPE_OPTIONS = ['แจ้งซ่อม', 'ขออุปกรณ์ใหม่', 'ขอเปลี่ยนอุปกรณ์', 'แจ้งระบบใช้งานไม่ได้'];
const PRIORITY_OPTIONS = ['ปกติ', 'เร่งด่วน'];
const PAGE_SIZES = [10, 20, 50, 100];
const SORTS = {
  id: { label: 'ID', value: (j) => Number(j.id) || 0 },
  job_name: { label: 'ชื่องาน', value: (j) => j.job_name || '' },
  status: { label: 'สถานะ', value: (j) => STATUS_OPTIONS.indexOf(j.status) },
  pea_name: { label: 'สำนักงาน', value: (j) => j.pea_site?.pea_name || '' },
  transactions: { label: 'ธุรกรรม', value: (j) => j.transactions?.length || 0 },
  createdAt: { label: 'วันที่แจ้ง', value: (j) => new Date(j.createdAt).getTime() || 0 }
};
const EMPTY_FILTERS = { search: '', site: '', status: '', jobType: '', priority: '' };
const VIEW_KEY = 'job_mgmt_view.v1';
const FOCUS_KEY = 'job_mgmt_return_focus_id';

// Same session-storage convention as JobReport: the list survives opening a
// job's detail route and coming back. Validated so a bad value can't break
// the page.
const readView = () => {
  const fallback = { filters: EMPTY_FILTERS, page: 1, pageSize: 20, sort: null };
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    const filters = Object.fromEntries(Object.keys(EMPTY_FILTERS).map((k) => [k, typeof v.filters?.[k] === 'string' ? v.filters[k].slice(0, 200) : '']));
    return {
      filters,
      page: Number.isSafeInteger(v.page) && v.page > 0 ? v.page : 1,
      pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 20,
      sort: SORTS[v.sort?.key] && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : null
    };
  } catch {
    return fallback;
  }
};
const readSession = (key) => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
const writeSession = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* optional */ } };

const JobManagement = (props) => (props.jobId
  ? <JobManagementDetails key={props.jobId} {...props} />
  : <JobList {...props} />);

function JobList({ token, user, onBack, onOpenJob }) {
  const perms = jobPermissions(user);
  const [initial] = useState(readView);
  const [inputs, setInputs] = useState(initial.filters);
  const [filters, setFilters] = useState(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [sort, setSort] = useState(initial.sort);
  const [sites, setSites] = useState({ status: 'loading', list: [] });
  const [siteRetry, setSiteRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [historyJob, setHistoryJob] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const resultInfoRef = useRef(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    writeSession(VIEW_KEY, JSON.stringify({ filters: inputs, page, pageSize, sort }));
  }, [inputs, page, pageSize, sort]);

  // Free-text filters are debounced into one request.
  useEffect(() => {
    if (inputs === filters) return undefined;
    const timer = setTimeout(() => { setFilters(inputs); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [inputs, filters]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    (async () => {
      setSites((s) => ({ ...s, status: 'loading' }));
      try {
        const response = await fetch(`${API}/api/pea-jobs/sites`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
        const data = await response.json().catch(() => null);
        const list = Array.isArray(data) ? data : data?.data;
        if (!response.ok || !Array.isArray(list)) throw new Error();
        if (active) setSites({ status: 'ready', list });
      } catch {
        if (active) setSites((s) => ({ ...s, status: 'error' }));
      } finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [token, siteRetry]);

  // สำนักงาน only filters once the typed text matches a known site exactly.
  const site = sites.list.find((s) => siteLabel(s) === filters.site);
  const waitingForSite = Boolean(filters.site && sites.status === 'loading');
  const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.jobType) params.set('job_type', filters.jobType);
  if (filters.priority) params.set('priority', filters.priority);
  if (site) params.set('pea_site_id', String(site.id));
  const requestKey = params.toString();

  useEffect(() => {
    if (waitingForSite) return undefined;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API}/api/pea-jobs?${requestKey}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) throw Object.assign(new Error(), { kind: 'auth' });
        if (!response.ok || !data?.success || !Array.isArray(data.data)) throw new Error();
        if (!active) return;
        const total = Number(data.pagination?.total ?? data.data.length);
        const totalPages = Math.max(1, Number(data.pagination?.totalPages) || Math.ceil(total / pageSize));
        if (page > totalPages) { setPage(totalPages); return; }
        setResult({ jobs: data.data, total, totalPages, page, key: requestKey, updated: new Date() });
      } catch (err) {
        if (!active) return;
        setError(err.kind === 'auth' ? 'บัญชีนี้ไม่มีสิทธิ์ดูรายการงาน หรือเซสชันหมดอายุ' : err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : 'โหลดรายการงานไม่สำเร็จ');
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [requestKey, token, retry, waitingForSite, page, pageSize]);

  const shown = result?.key === requestKey ? result : null;
  const stale = !shown && result ? result : null;
  const rows = shown || stale;
  const pending = inputs !== filters || waitingForSite || loading || !shown;
  const anyFilter = Object.values(inputs).some(Boolean);
  const change = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  const clearAll = () => { setInputs(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); setSort(null); };

  // The API has no sort parameter, so sorting reorders the current page only.
  const jobs = rows ? [...rows.jobs] : [];
  if (sort) {
    const get = SORTS[sort.key].value;
    jobs.sort((a, b) => {
      const [x, y] = [get(a), get(b)];
      const cmp = typeof x === 'string' ? x.localeCompare(y, 'th') : x - y;
      return sort.order === 'asc' ? cmp : -cmp;
    });
  }
  const toggleSort = (key) => setSort((s) => ({ key, order: s?.key === key && s.order === 'asc' ? 'desc' : 'asc' }));
  const ariaSort = (key) => (sort?.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none');
  const sortHeader = (k, className) => (
    <th scope="col" aria-sort={ariaSort(k)} className={className}>
      <button type="button" className="list-sort" onClick={() => toggleSort(k)}>
        {SORTS[k].label}
        {sort?.key !== k ? <ArrowUpDown size={14} aria-hidden="true" className="jm-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  // Back from a job's detail: return focus to the link that opened it.
  useEffect(() => {
    if (!shown || restoredRef.current) return;
    restoredRef.current = true;
    const pendingId = readSession(FOCUS_KEY);
    if (!pendingId) return;
    writeSession(FOCUS_KEY, '');
    const link = document.querySelector(`.jm-page a.list-name[data-job-id="${CSS.escape(pendingId)}"]`);
    if (link) { link.scrollIntoView({ block: 'center' }); link.focus(); } else resultInfoRef.current?.focus();
  }, [shown]);

  const open = (job, intent) => {
    writeSession(FOCUS_KEY, String(job.id));
    if (intent) setJobIntent(job.id, intent);
    onOpenJob(job.id);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    const outcome = await deleteJob(toDelete.id, token);
    setDeleting(false);
    if (!outcome.ok) { setDeleteError(outcome.message); return; }
    toast.success(outcome.message);
    setToDelete(null);
    setRetry((n) => n + 1);
  };

  return (
    <div className="list-page job-report-page jm-page">
      <button type="button" className="list-button jm-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการจัดการ</button>
      <header className="list-header">
        <div>
          <h1>จัดการงาน</h1>
          <p>ติดตามงานแจ้งปัญหา เปลี่ยนสถานะงาน และผูกธุรกรรมงบประมาณ · งานใหม่แจ้งได้ที่เมนู "แจ้งปัญหา"</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" disabled={loading || waitingForSite} onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />รีเฟรช
          </button>
        </div>
      </header>

      {error && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <strong>{error}</strong>
            {rows && <p>แสดงรายการจากการโหลดครั้งก่อน ข้อมูลอาจไม่ตรงกับเงื่อนไขล่าสุด</p>}
          </div>
          <button type="button" className="list-button" disabled={loading} onClick={() => setRetry((n) => n + 1)}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="ค้นหาและกรองรายการงาน">
        <div className="job-report-filters">
          <label className={`list-field job-report-search-filter${inputs.search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่องาน หรือรายละเอียด" value={inputs.search} onChange={(e) => change('search', e.target.value)} />
            </div>
          </label>
          <label className={`list-field${inputs.site ? ' is-active' : ''}`}>
            <span>สำนักงาน</span>
            <SearchableDropdown
              label="สำนักงาน"
              placeholder={sites.status === 'loading' ? 'กำลังโหลดสำนักงาน…' : 'ทั้งหมด'}
              value={inputs.site}
              onChange={(value) => change('site', value)}
              describedBy="jm-site-help"
              options={[...new Set(sites.list.map(siteLabel))]}
            />
          </label>
          <label className={`list-field${inputs.status ? ' is-active' : ''}`}>
            <span>สถานะ</span>
            <select value={inputs.status} onChange={(e) => change('status', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className={`list-field${inputs.jobType ? ' is-active' : ''}`}>
            <span>ประเภทงาน</span>
            <select value={inputs.jobType} onChange={(e) => change('jobType', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {JOB_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={`list-field${inputs.priority ? ' is-active' : ''}`}>
            <span>ความสำคัญ</span>
            <select value={inputs.priority} onChange={(e) => change('priority', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="job-report-filter-help" id="jm-site-help">
          {sites.status === 'error' ? (
            <span role="alert">โหลดรายชื่อสำนักงานไม่สำเร็จ <button type="button" className="list-button" onClick={() => setSiteRetry((n) => n + 1)}>โหลดสำนักงานใหม่</button></span>
          ) : inputs.site && sites.status === 'ready' && !sites.list.some((s) => siteLabel(s) === inputs.site) ? (
            <span className="list-filter-warning">ยังไม่ได้กรองสำนักงาน กรุณาเลือกชื่อให้ตรงกับรายการแนะนำ</span>
          ) : 'สำนักงานต้องเลือกชื่อให้ตรงกับรายการแนะนำ'}
        </div>
        <div className="job-report-filter-actions">
          <button type="button" className="list-button" disabled={!anyFilter && !sort} onClick={clearAll}>ล้างตัวกรองและการเรียง</button>
          <span className="list-muted">ค้นหาอัตโนมัติ · ใช้ทุกเงื่อนไขร่วมกัน</span>
        </div>

        <div className="list-result-info">
          <span role="status" ref={resultInfoRef} tabIndex={-1}>
            {error && !rows ? 'โหลดไม่สำเร็จ' : pending && !rows ? 'กำลังโหลด…' : `พบ ${rows.total.toLocaleString('th-TH')} งาน`}
            {sort && rows?.jobs.length > 1 ? ` · เรียงตาม${SORTS[sort.key].label}เฉพาะในหน้านี้` : ''}
          </span>
          <span>{rows && `อัปเดตล่าสุด ${rows.updated.toLocaleTimeString('th-TH')}`}</span>
        </div>

        {!rows || !rows.jobs.length ? (
          <div className="job-report-empty">
            <strong>{error ? 'ไม่สามารถแสดงรายการงาน' : pending ? 'กำลังโหลดรายการ…' : anyFilter ? 'ไม่พบงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีงานในระบบ'}</strong>
            {!pending && !error && anyFilter && (
              <>
                <p>ลองเปลี่ยนคำค้น หรือล้างตัวกรองเพื่อดูงานทั้งหมด</p>
                <button type="button" className="list-button" onClick={clearAll}>ล้างตัวกรอง</button>
              </>
            )}
          </div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางรายการงาน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" aria-busy={pending}>
            <table className="list-table jm-table">
              <caption className="list-sr-only">รายการงาน หน้า {rows.page} จาก {rows.totalPages} กดชื่องานเพื่อเปิดรายละเอียดและจัดการงาน</caption>
              <thead>
                <tr>
                  {sortHeader('id', 'list-number')}
                  {sortHeader('job_name')}
                  {sortHeader('status')}
                  <th scope="col">ความสำคัญ</th>
                  {sortHeader('pea_name')}
                  {sortHeader('transactions', 'jm-num')}
                  {sortHeader('createdAt')}
                  <th scope="col" className="jm-actions-col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const name = job.job_name || `งาน #${job.id}`;
                  return (
                    <tr key={job.id}>
                      <td className="list-number list-muted">{job.id}</td>
                      <td>
                        <a
                          className="list-name"
                          data-job-id={job.id}
                          href={`/management/jobs/${job.id}`}
                          title={name}
                          onClick={(e) => {
                            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); open(job); }
                          }}
                        >{name}</a>
                        <span className="jm-sub" title={job.job_type || ''}>{job.job_type || '—'}</span>
                      </td>
                      <td><span className={`list-status list-status-${jobStatusTone(job.status)}`}>{job.status || 'ไม่ทราบสถานะ'}</span></td>
                      <td>{job.priority ? <span className={`list-status list-status-${jobPriorityTone(job.priority)}`}>{job.priority}</span> : '—'}</td>
                      <td title={job.pea_site ? siteLabel(job.pea_site) : ''}>{job.pea_site ? siteLabel(job.pea_site) : '—'}</td>
                      <td className="jm-num">{job.transactions?.length || 0}</td>
                      <td className="list-muted">{job.createdAt ? new Date(job.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                      <td>
                        <div className="jm-row-actions">
                          {perms.canViewHistory && (
                            <button type="button" className="jm-icon" onClick={() => setHistoryJob(job)} aria-label={`ประวัติของงาน ${name}`} title="ประวัติของงาน"><History size={18} aria-hidden="true" /></button>
                          )}
                          {perms.canEdit(job) && (
                            <button type="button" className="jm-icon" onClick={() => open(job, 'edit')} aria-label={`แก้ไขข้อมูลงาน ${name}`} title="แก้ไขข้อมูลงาน"><Pencil size={18} aria-hidden="true" /></button>
                          )}
                          {perms.canDelete && (
                            <button type="button" className="jm-icon is-danger" onClick={() => { setDeleteError(''); setToDelete(job); }} aria-label={`ลบงาน ${name}`} title="ลบงาน"><Trash2 size={18} aria-hidden="true" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="list-footer">
          <span className="list-muted">
            {rows?.total ? `${(rows.page - 1) * pageSize + 1}–${(rows.page - 1) * pageSize + rows.jobs.length} จาก ${rows.total} งาน` : '—'}
          </span>
          <label className="list-page-size">
            แสดง
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            รายการต่อหน้า
          </label>
          <nav className="list-pagination" aria-label="แบ่งหน้ารายการงาน">
            <button type="button" className="list-button" disabled={pending || page <= 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
            <label>หน้า <select value={page} disabled={pending} onChange={(e) => setPage(Number(e.target.value))}>
              {Array.from({ length: Math.max(page, rows?.totalPages || 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select> / {rows?.totalPages || '—'}</label>
            <button type="button" className="list-button" disabled={pending || !rows || page >= rows.totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
          </nav>
        </footer>
      </section>

      <AnimatePresence>
        {historyJob && <JobHistoryModal jobId={historyJob.id} jobName={historyJob.job_name} token={token} onClose={() => setHistoryJob(null)} />}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="ลบงานนี้?"
        tone="danger"
        busy={deleting}
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบงาน'}
        cancelLabel="ไม่ลบ"
        message={toDelete && (
          <>
            <p className="jm-confirm-target">"{toDelete.job_name || `งาน #${toDelete.id}`}" · #{toDelete.id} · {toDelete.status || 'ไม่ทราบสถานะ'}{toDelete.pea_site ? ` · ${siteLabel(toDelete.pea_site)}` : ''}</p>
            <p>งานจะหายไปจากรายการงานและรายการแจ้งปัญหา และกู้คืนจากหน้านี้ไม่ได้</p>
            {toDelete.transactions?.length > 0 && <p>งานนี้ผูกธุรกรรมงบประมาณไว้ {toDelete.transactions.length} รายการ</p>}
            {deleteError && <p className="jm-confirm-error" role="alert">{deleteError}</p>}
          </>
        )}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

export default JobManagement;
