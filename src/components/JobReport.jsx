import { useState, useEffect, useRef } from 'react';
import { Plus, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import JobFormModal from './JobFormModal';
import SearchableDropdown from './SearchableDropdown';
import { siteLabel, jobStatusTone } from './jobReportShared';
import './ListPage.css';
import './JobReport.css';

const STATUS_OPTIONS = ['เปิดงาน', 'ระหว่างดำเนินการ', 'เสร็จงาน', 'ยกเลิก'];
const JOB_TYPE_OPTIONS = ['แจ้งซ่อม', 'ขออุปกรณ์ใหม่', 'ขอเปลี่ยนอุปกรณ์', 'แจ้งระบบใช้งานไม่ได้'];
const PRIORITY_OPTIONS = ['ปกติ', 'เร่งด่วน'];

const priorityTone = (priority) => (priority === 'เร่งด่วน' ? 'down' : 'unknown');

// Same read/save session-storage convention EquipmentSearch.jsx and
// EquipmentBorrow.jsx already use -- lets the list survive navigating into
// a job's detail route and back (that unmounts this page) without losing
// the search/filters/page the user had set.
const read = (key, fallback = '') => {
  try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ }
};
const readPage = () => {
  const page = Number(read('job_report_page', '1'));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

const JobReport = ({ token, user, onRequireLogin, onJobClick }) => {
  const itemsPerPage = 10;
  const [inputs, setInputs] = useState(() => ({
    search: read('job_report_search'),
    site: read('job_report_site_input'),
    status: read('job_report_status'),
    jobType: read('job_report_type'),
    priority: read('job_report_priority'),
  }));
  const [filters, setFilters] = useState(inputs);
  const [currentPage, setCurrentPage] = useState(readPage);
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState(false);
  const [siteRetry, setSiteRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showFormModal, setShowFormModal] = useState(false);

  useEffect(() => {
    save('job_report_search', inputs.search);
    save('job_report_site_input', inputs.site);
    save('job_report_status', inputs.status);
    save('job_report_type', inputs.jobType);
    save('job_report_priority', inputs.priority);
  }, [inputs]);
  useEffect(() => { save('job_report_page', String(currentPage)); }, [currentPage]);

  useEffect(() => {
    if (inputs === filters) return;
    const timer = setTimeout(() => { setFilters(inputs); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [inputs, filters]);

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

  // สำนักงาน only resolves to a real pea_site_id once the typed text exactly
  // matches a known site's label -- partial text just leaves it unset.
  const site = sites.find((s) => siteLabel(s) === filters.site);
  const siteInputMatches = sites.some((s) => siteLabel(s) === inputs.site);
  const waitingForSite = Boolean(filters.site && sitesLoading);
  const requestParams = (() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(itemsPerPage));
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.status) params.set('status', filters.status);
    if (filters.jobType) params.set('job_type', filters.jobType);
    if (filters.priority) params.set('priority', filters.priority);
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
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs?${requestKey}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) throw new Error();
        if (!active) return;
        const total = Number(data.pagination?.total ?? data.data.length);
        const totalPages = Math.max(1, Number(data.pagination?.totalPages) || Math.ceil(total / itemsPerPage));
        if (currentPage > totalPages) { setCurrentPage(totalPages); return; }
        setResult({ jobs: data.data, total, totalPages, page: currentPage, key: requestKey, token, updated: new Date() });
      } catch { if (active) setError('ไม่สามารถโหลดรายการแจ้งปัญหาได้ กรุณาลองใหม่'); }
      finally { clearTimeout(timer); if (active) setLoading(false); }
    };
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [requestKey, token, retry, waitingForSite, currentPage]);

  // Only show rows matching this page's current filters/auth context, so an
  // in-flight response for a stale search never overwrites a newer one.
  const shown = result?.key === requestKey && result?.token === token ? result : null;
  const anyFilterActive = Boolean(inputs.search || inputs.site || inputs.status || inputs.jobType || inputs.priority);
  const change = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => {
    const cleared = { search: '', site: '', status: '', jobType: '', priority: '' };
    setInputs(cleared); setFilters(cleared); setCurrentPage(1);
  };

  const handleNewReportClick = () => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    setShowFormModal(true);
  };

  // Restores scroll/focus to the job link the user clicked into, once this
  // page's data has loaded back in after returning from the detail route
  // (this component fully unmounts/remounts, so plain React state can't
  // carry it -- sessionStorage does). Falls back to the results summary if
  // that job isn't in the current (possibly re-filtered) results. Runs at
  // most once per mount, not on every later auto-refresh.
  const resultInfoRef = useRef(null);
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (!shown || restoreAttemptedRef.current) return;
    const pendingId = read('job_report_return_focus_id');
    if (!pendingId) return;
    restoreAttemptedRef.current = true;
    save('job_report_return_focus_id', '');
    const link = document.querySelector(`a.list-name[data-job-id="${pendingId}"]`);
    if (link) {
      link.scrollIntoView({ block: 'center' });
      link.focus();
    } else {
      resultInfoRef.current?.focus();
    }
  }, [shown]);

  const handleJobLinkClick = (id) => {
    save('job_report_return_focus_id', String(id));
    onJobClick && onJobClick(id);
  };

  return (
    <div className="list-page job-report-page">
      <header className="list-header">
        <div>
          <h1>แจ้งปัญหา</h1>
          <p className="list-muted">แจ้งและติดตามปัญหาอุปกรณ์หรือระบบของสำนักงาน</p>
        </div>
        <div className="list-actions">
          <button className="list-button" disabled={loading || waitingForSite} onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />รีเฟรช
          </button>
          <button className="list-button list-button-primary" onClick={handleNewReportClick}>
            <Plus size={18} aria-hidden="true" /> แจ้งปัญหาใหม่
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
          <button className="list-button" disabled={loading} onClick={() => setRetry((n) => n + 1)}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="ค้นหาและกรองรายการแจ้งปัญหา">
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
              placeholder={sitesLoading ? 'กำลังโหลดสำนักงาน…' : 'ทั้งหมด'}
              value={inputs.site}
              onChange={(value) => change('site', value)}
              describedBy="job-report-site-help"
              options={[...new Set(sites.map(siteLabel))]}
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
        <div className="job-report-filter-help" id="job-report-site-help">
          {sitesError ? (
            <span role="alert">โหลดรายชื่อสำนักงานไม่สำเร็จ <button className="list-button" onClick={() => setSiteRetry((n) => n + 1)}>โหลดสำนักงานใหม่</button></span>
          ) : inputs.site && !siteInputMatches && !sitesLoading ? (
            <span className="list-filter-warning">ยังไม่ได้กรองสำนักงาน กรุณาเลือกชื่อให้ตรงกับรายการแนะนำ</span>
          ) : 'สำนักงานต้องเลือกชื่อให้ตรงกับรายการแนะนำ ส่วนตัวกรองอื่นเลือกจากรายการแนะนำ'}
        </div>
        <div className="job-report-filter-actions">
          <button className="list-button" disabled={!anyFilterActive} onClick={clearAllFilters}>ล้างตัวกรอง</button>
          <span className="list-muted">ค้นหาอัตโนมัติ · ใช้ทุกเงื่อนไขร่วมกัน</span>
        </div>

        <div className="list-result-info">
          {/* tabIndex + ref: fallback focus target when returning from a job
              that's no longer in the current (possibly re-filtered) results. */}
          <span role="status" ref={resultInfoRef} tabIndex={-1}>{error ? 'โหลดไม่สำเร็จ' : pending ? 'กำลังโหลด…' : `พบ ${shown?.total.toLocaleString('th-TH') ?? 0} รายการ`}</span>
          <span>{shown && `อัปเดตล่าสุด ${shown.updated.toLocaleTimeString('th-TH')}`}</span>
        </div>

        {!shown || !shown.jobs.length ? (
          <div className="job-report-empty">
            <strong>{error ? 'ไม่สามารถแสดงรายการล่าสุด' : pending ? 'กำลังโหลดรายการ…' : anyFilterActive ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการแจ้งปัญหา'}</strong>
            {!pending && !error && anyFilterActive && (
              <>
                <p>ลองเปลี่ยนคำค้น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
                <button className="list-button" onClick={clearAllFilters}>ล้างตัวกรอง</button>
              </>
            )}
          </div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางรายการแจ้งปัญหา เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" aria-busy={pending}>
            <table className="list-table">
              <caption className="list-sr-only">รายการแจ้งปัญหา กดชื่องานเพื่อเปิดรายละเอียด</caption>
              <thead>
                <tr>
                  {['ชื่องาน', 'ประเภทงาน', 'สถานะ', 'ความสำคัญ', 'สำนักงาน', 'ผู้แจ้ง', 'วันที่แจ้ง'].map((label) => <th scope="col" key={label}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.jobs.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <a
                        className="list-name"
                        data-job-id={item.id}
                        title={item.job_name || 'ดูรายละเอียด'}
                        href={`/report-issue/${item.id}`}
                        onClick={(e) => {
                          if (onJobClick && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            handleJobLinkClick(item.id);
                          }
                        }}
                      >
                        {item.job_name || 'ดูรายละเอียด'}
                      </a>
                    </td>
                    <td title={item.job_type || '—'}>{item.job_type || '—'}</td>
                    <td title={item.status || 'ไม่ทราบสถานะ'}><span className={`list-status list-status-${jobStatusTone(item.status)}`}>{item.status || 'ไม่ทราบสถานะ'}</span></td>
                    <td title={item.priority || '—'}>{item.priority ? <span className={`list-status list-status-${priorityTone(item.priority)}`}>{item.priority}</span> : '—'}</td>
                    <td title={item.pea_site ? siteLabel(item.pea_site) : '—'}>{item.pea_site ? siteLabel(item.pea_site) : '—'}</td>
                    <td title={item.requester_name || '—'}>{item.requester_name || '—'}</td>
                    <td className="list-muted">{item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="list-footer">
          <span className="list-muted">{shown?.total ? `${(shown.page - 1) * itemsPerPage + 1}–${(shown.page - 1) * itemsPerPage + shown.jobs.length} จาก ${shown.total} รายการ` : '—'} · {itemsPerPage} รายการต่อหน้า</span>
          <nav className="list-pagination" aria-label="แบ่งหน้ารายการแจ้งปัญหา">
            <button className="list-button" disabled={pending || Boolean(error) || currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>ก่อนหน้า</button>
            <label>หน้า <select value={shown?.page || currentPage} disabled={pending || Boolean(error)} onChange={(e) => setCurrentPage(Number(e.target.value))}>
              {Array.from({ length: Math.max(currentPage, shown?.totalPages || 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select> / {shown?.totalPages || '—'}</label>
            <button className="list-button" disabled={pending || Boolean(error) || !shown || currentPage >= shown.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>ถัดไป</button>
          </nav>
        </footer>
      </section>

      <AnimatePresence>
        {showFormModal && (
          <JobFormModal
            mode="create"
            sites={sites}
            token={token}
            onClose={() => setShowFormModal(false)}
            onSuccess={() => { setCurrentPage(1); setRetry((n) => n + 1); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default JobReport;
