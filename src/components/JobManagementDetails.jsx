import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CheckCircle2, History, Loader2, Pencil, PlayCircle, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import JobFormModal from './JobFormModal';
import JobHistoryModal from './JobHistoryModal';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import { ProgressModal, CompleteModal, CancelModal } from './JobWorkflowModals.jsx';
import { Lightbox, StatusPill, JobInfoMain, JobInfoSide } from './jobDetailParts.jsx';
import { siteLabel, jobStatusTone, jobPriorityTone, formatDateTime, postingTime, amountOf, formatBaht } from './jobReportShared';
import { jobPermissions, deleteJob, takeJobIntent } from './jobManagementShared';
import './ListPage.css';
import './JobReport.css';
import './JobManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;
const TX_PAGE_SIZES = [10, 25, 50, 100];
const TX_SORTS = {
  posting_date: { label: 'วันที่ผ่านรายการ', value: (t) => postingTime(t.posting_date) },
  reference_doc_no: { label: 'เลขที่เอกสาร', value: (t) => t.reference_doc_no || '' },
  cost_center: { label: 'ศูนย์ต้นทุน', value: (t) => t.cost_center || '' },
  clearing_account_name: { label: 'บัญชีหักล้าง', value: (t) => t.clearing_account_name || t.clearing_account || '' },
  username: { label: 'ผู้บันทึก', value: (t) => t.username || '' },
  value_co_curr: { label: 'จำนวนเงิน', value: amountOf }
};

// What each status change does, shown next to its button so the manager
// knows the effect before opening the dialog.
const WORKFLOW = {
  'เปิดงาน': [
    { key: 'progress', label: 'เริ่มดำเนินการ', icon: <PlayCircle size={18} aria-hidden="true" />, primary: true, effect: 'บันทึกผู้รับผิดชอบและเลขที่คำสั่งปฏิบัติงาน แล้วเปลี่ยนสถานะเป็น "ระหว่างดำเนินการ"' },
    { key: 'cancel', label: 'ยกเลิกงาน', icon: <XCircle size={18} aria-hidden="true" />, danger: true, effect: 'ต้องระบุเหตุผล สถานะจะเป็น "ยกเลิก" และดำเนินการต่อไม่ได้อีก' }
  ],
  'ระหว่างดำเนินการ': [
    { key: 'complete', label: 'ปิดงาน', icon: <CheckCircle2 size={18} aria-hidden="true" />, primary: true, effect: 'บันทึกผลการดำเนินการ แนบรายงาน/รูป ระบุอุปกรณ์ที่ใช้ และผูกธุรกรรมงบประมาณ แล้วเปลี่ยนสถานะเป็น "เสร็จงาน"' },
    { key: 'cancel', label: 'ยกเลิกงาน', icon: <XCircle size={18} aria-hidden="true" />, danger: true, effect: 'ต้องระบุเหตุผล สถานะจะเป็น "ยกเลิก" และดำเนินการต่อไม่ได้อีก' }
  ]
};

const JobManagementDetails = ({ jobId, token, user, onBack, onEquipmentClick }) => {
  const perms = jobPermissions(user);
  const [job, setJob] = useState(null);
  // status: 'loading' | 'ready' | 'error'; kind: '' | 'not_found' | 'forbidden' | 'network'
  const [load, setLoad] = useState({ status: 'loading', kind: '' });
  const [retry, setRetry] = useState(0);
  const [modal, setModal] = useState(null); // progress | complete | cancel | edit | history | delete
  const [notice, setNotice] = useState(null); // { tone, text, items }
  const [lightbox, setLightbox] = useState(null);
  const [sites, setSites] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const intentChecked = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoad((l) => ({ ...l, status: 'loading' }));
    (async () => {
      try {
        const response = await fetch(`${API}/api/pea-jobs/${encodeURIComponent(jobId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
        if (!active) return;
        if (response.status === 404) { setJob(null); setLoad({ status: 'error', kind: 'not_found' }); return; }
        if (response.status === 401 || response.status === 403) { setLoad({ status: 'error', kind: 'forbidden' }); return; }
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success === false || !data?.data) throw new Error();
        if (!active) return;
        setJob(data.data);
        setLoad({ status: 'ready', kind: '' });
      } catch {
        if (active) setLoad({ status: 'error', kind: 'network' });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [jobId, token, retry]);

  // A list row's pencil opens the edit dialog once the job is here.
  useEffect(() => {
    if (!job || intentChecked.current) return;
    intentChecked.current = true;
    if (takeJobIntent(jobId) === 'edit' && perms.canEdit(job)) setModal('edit');
  }, [job, jobId, perms]);

  // The edit form's office picker needs the site list.
  useEffect(() => {
    if (modal !== 'edit' || sites.length) return undefined;
    const controller = new AbortController();
    fetch(`${API}/api/pea-jobs/sites`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { const list = Array.isArray(d) ? d : d?.data; if (Array.isArray(list)) setSites(list); })
      .catch(() => {});
    return () => controller.abort();
  }, [modal, sites.length, token]);

  const refresh = () => setRetry((n) => n + 1);
  const finished = ({ message, warnings = [] }) => {
    setModal(null);
    if (warnings.length) {
      setNotice({ tone: 'warning', text: `${message} แต่บันทึกข้อมูลเพิ่มเติมบางส่วนไม่สำเร็จ`, items: warnings });
      toast.error('บันทึกข้อมูลเพิ่มเติมบางส่วนไม่สำเร็จ');
    } else {
      setNotice({ tone: 'success', text: message, items: [] });
      toast.success(message);
    }
    refresh();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    const outcome = await deleteJob(job.id, token);
    setDeleting(false);
    if (!outcome.ok) { setDeleteError(outcome.message); return; }
    toast.success(outcome.message);
    setModal(null);
    onBack();
  };

  const openLightbox = (images, index, type = 'image') => setLightbox({ images, index, type });

  if (!job) {
    return (
      <div className="list-page jm-page jm-details">
        <button type="button" className="list-button jm-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปยังรายการงาน</button>
        {load.status === 'loading' ? (
          <div className="job-report-details-state" role="status">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p>กำลังโหลดรายละเอียดงาน…</p>
          </div>
        ) : (
          <div className="job-report-details-state" role={load.kind === 'network' ? 'alert' : undefined}>
            <AlertCircle size={28} aria-hidden="true" />
            <p>
              <strong>{load.kind === 'not_found' ? 'ไม่พบงานนี้' : load.kind === 'forbidden' ? 'ไม่มีสิทธิ์ดูงานนี้ หรือเซสชันหมดอายุ' : 'โหลดรายละเอียดงานไม่สำเร็จ'}</strong>
              {load.kind === 'not_found' && <><br />งานอาจถูกลบ หรือลิงก์ไม่ถูกต้อง</>}
            </p>
            {load.kind === 'network' && <button type="button" className="list-button" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>}
          </div>
        )}
      </div>
    );
  }

  const name = job.job_name || `งาน #${job.id}`;
  const steps = perms.canManageWorkflow ? WORKFLOW[job.status] || [] : [];

  return (
    <div className="list-page jm-page jm-details">
      <button type="button" className="list-button jm-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปยังรายการงาน</button>

      <header className="job-report-details-header">
        <div className="jm-title">
          <h1>{name}</h1>
          <div className="job-report-details-badges">
            <StatusPill status={job.status} tone={jobStatusTone(job.status)} />
            {job.priority && <StatusPill status={job.priority} tone={jobPriorityTone(job.priority)} />}
            {job.job_type && <span className="list-muted">{job.job_type}</span>}
          </div>
          <div className="job-report-details-meta">
            <span>งาน #{job.id}</span>
            {job.pea_site && <span>{siteLabel(job.pea_site)}</span>}
            <span>เปิดงานเมื่อ {formatDateTime(job.createdAt) || '—'}</span>
            {job.updatedAt && job.updatedAt !== job.createdAt && <span>อัปเดตล่าสุด {formatDateTime(job.updatedAt)}</span>}
          </div>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={refresh} disabled={load.status === 'loading'}>
            <RefreshCw size={16} aria-hidden="true" className={load.status === 'loading' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          {perms.canViewHistory && <button type="button" className="list-button" onClick={() => setModal('history')}><History size={16} aria-hidden="true" /> ประวัติของงาน</button>}
          {perms.canEdit(job) && <button type="button" className="list-button" onClick={() => setModal('edit')}><Pencil size={16} aria-hidden="true" /> แก้ไขข้อมูลงาน</button>}
          {perms.canDelete && <button type="button" className="list-button jm-danger-outline" onClick={() => { setDeleteError(''); setModal('delete'); }}><Trash2 size={16} aria-hidden="true" /> ลบงาน</button>}
        </div>
      </header>

      {load.status === 'error' && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{load.kind === 'not_found' ? 'ไม่พบงานนี้แล้ว อาจถูกลบไปแล้ว' : 'รีเฟรชไม่สำเร็จ'}</strong><p>แสดงข้อมูลจากการโหลดครั้งก่อน ข้อมูลอาจเปลี่ยนแปลงแล้ว</p></div>
          <button type="button" className="list-button" onClick={refresh}>ลองใหม่</button>
        </div>
      )}

      {notice && (
        <div className={`jm-notice is-${notice.tone}`} role={notice.tone === 'warning' ? 'alert' : 'status'}>
          {notice.tone === 'warning' ? <AlertTriangle size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
          <div>
            <strong>{notice.text}</strong>
            {notice.items.length > 0 && (
              <>
                <ul>{notice.items.map((item) => <li key={item}>{item}</li>)}</ul>
                <p>งานปิดแล้ว ส่วนที่ไม่สำเร็จต้องให้ผู้ดูแลระบบบันทึกเพิ่ม</p>
              </>
            )}
          </div>
          <button type="button" className="jm-icon" onClick={() => setNotice(null)} aria-label="ปิดข้อความแจ้ง"><X size={18} aria-hidden="true" /></button>
        </div>
      )}

      <section className="jm-group" aria-labelledby="jm-workflow-title">
        <h2 id="jm-workflow-title" className="jm-group-title">การเปลี่ยนสถานะงาน</h2>
        <div className="job-report-panel">
          {!perms.canManageWorkflow ? (
            <p className="list-muted">บัญชีนี้ดูข้อมูลงานได้อย่างเดียว</p>
          ) : steps.length === 0 ? (
            <p className="list-muted">
              งานนี้{job.status === 'ยกเลิก' ? 'ถูกยกเลิก' : job.status === 'เสร็จงาน' ? 'ปิดแล้ว' : `อยู่ในสถานะ "${job.status || 'ไม่ทราบ'}"`} ไม่มีขั้นตอนเปลี่ยนสถานะเพิ่มเติม
              {perms.isSuperAdmin ? ' (ผู้ดูแลระบบสูงสุดยังแก้ไขข้อมูลงานได้จากปุ่ม "แก้ไขข้อมูลงาน")' : ''}
            </p>
          ) : (
            <ul className="jm-steps">
              {steps.map(({ key, label, icon, primary, danger, effect }) => (
                <li key={key}>
                  <button type="button" className={`list-button${primary ? ' list-button-primary' : ''}${danger ? ' jm-danger-outline' : ''}`} onClick={() => setModal(key)} aria-describedby={`jm-step-${key}`}>
                    {icon} {label}
                  </button>
                  <p id={`jm-step-${key}`} className="list-muted">{effect}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="jm-group" aria-labelledby="jm-info-title">
        <h2 id="jm-info-title" className="jm-group-title">ข้อมูลรายการงาน</h2>
        <div className="job-report-details-grid">
          <div className="job-report-details-main">
            <JobInfoMain job={job} onEquipmentClick={onEquipmentClick} openLightbox={openLightbox} level={3} />
          </div>
          <div className="job-report-details-side">
            <JobInfoSide job={job} openLightbox={openLightbox} level={3} />
          </div>
        </div>
      </section>

      <JobFinance job={job} />

      <AnimatePresence>
        {modal === 'edit' && (
          <JobFormModal mode="edit" job={job} sites={sites} token={token} user={user} onClose={() => setModal(null)} onSuccess={() => { setNotice({ tone: 'success', text: 'บันทึกข้อมูลงานแล้ว', items: [] }); refresh(); }} />
        )}
        {modal === 'history' && <JobHistoryModal jobId={job.id} jobName={job.job_name} token={token} onClose={() => setModal(null)} />}
      </AnimatePresence>
      {modal === 'progress' && <ProgressModal job={job} token={token} user={user} onClose={() => setModal(null)} onDone={finished} />}
      {modal === 'complete' && <CompleteModal job={job} token={token} onClose={() => setModal(null)} onDone={finished} />}
      {modal === 'cancel' && <CancelModal job={job} token={token} onClose={() => setModal(null)} onDone={finished} />}
      {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} type={lightbox.type} onNavigate={(i) => setLightbox((p) => ({ ...p, index: i }))} onClose={() => setLightbox(null)} />}

      <ConfirmDialog
        open={modal === 'delete'}
        title="ลบงานนี้?"
        tone="danger"
        busy={deleting}
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบงาน'}
        cancelLabel="ไม่ลบ"
        message={(
          <>
            <p className="jm-confirm-target">"{name}" · #{job.id} · {job.status || 'ไม่ทราบสถานะ'}</p>
            <p>งานจะหายไปจากรายการงานและรายการแจ้งปัญหา และกู้คืนจากหน้านี้ไม่ได้</p>
            {(job.transactions || []).length > 0 && <p>งานนี้ผูกธุรกรรมงบประมาณไว้ {job.transactions.length} รายการ</p>}
            {deleteError && <p className="jm-confirm-error" role="alert">{deleteError}</p>}
          </>
        )}
        onConfirm={confirmDelete}
        onCancel={() => setModal(null)}
      />
    </div>
  );
};

// ข้อมูลการเงินที่ผูกงาน: every transaction linked to the job, searchable
// and sortable in the browser (the job detail already carries all of them).
function JobFinance({ job }) {
  const all = useMemo(() => job.transactions || [], [job.transactions]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'posting_date', order: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const net = all.reduce((sum, t) => sum + (amountOf(t) ?? 0), 0);
  const spending = all.reduce((sum, t) => sum + Math.max(0, amountOf(t) ?? 0), 0);
  const credits = all.reduce((sum, t) => sum + Math.min(0, amountOf(t) ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((t) => [t.reference_doc_no, t.description, t.clearing_account, t.clearing_account_name, t.cost_center, t.cost_center_name, t.username]
      .some((v) => String(v ?? '').toLowerCase().includes(q)))
    : all;
  const get = TX_SORTS[sort.key].value;
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [get(a), get(b)];
    // Missing values sort last either way.
    if (x === null || x === '') return y === null || y === '' ? 0 : 1;
    if (y === null || y === '') return -1;
    const cmp = typeof x === 'string' ? x.localeCompare(y, 'th') : x - y;
    return sort.order === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * pageSize, current * pageSize);

  const header = (key, className) => (
    <th scope="col" className={className} aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => { setSort((s) => ({ key, order: s.key === key && s.order === 'asc' ? 'desc' : 'asc' })); setPage(1); }}>
        {TX_SORTS[key].label}
        {sort.key !== key ? <ArrowUpDown size={14} aria-hidden="true" className="jm-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  return (
    <section className="jm-group" aria-labelledby="jm-finance-title">
      <h2 id="jm-finance-title" className="jm-group-title">ข้อมูลการเงินที่ผูกงาน</h2>
      <div className="list-panel">
        <dl className="jm-totals">
          <div><dt>ธุรกรรมที่ผูก</dt><dd className="list-number">{all.length.toLocaleString('th-TH')} รายการ</dd></div>
          <div><dt>ยอดค่าใช้จ่าย</dt><dd className="list-number">{formatBaht(spending)}</dd></div>
          {credits < 0 && <div><dt>ยอดรับคืน/หักล้าง</dt><dd className="list-number">{formatBaht(credits)}</dd></div>}
          <div><dt>ยอดสุทธิ</dt><dd className="list-number">{formatBaht(net)}</dd></div>
        </dl>
        <p className="jm-finance-hint list-muted">
          {job.status === 'ระหว่างดำเนินการ' ? 'ผูกธุรกรรมเพิ่มได้ตอนกด "ปิดงาน"' : 'ธุรกรรมผูกกับงานตอนปิดงาน'} · รายการเป็นสำเนา ณ ตอนผูก ไม่เปลี่ยนตามไฟล์การเบิกจ่ายที่นำเข้าภายหลัง · จำนวนเงินบวกคือค่าใช้จ่าย ติดลบคือรายการรับคืน/หักล้าง
        </p>

        {all.length === 0 ? (
          <div className="job-report-empty"><strong>ยังไม่มีธุรกรรมที่ผูกกับงานนี้</strong></div>
        ) : (
          <>
            <div className="list-toolbar">
              <label className={`list-field list-search${search ? ' is-active' : ''}`}>
                <span>ค้นหาธุรกรรม</span>
                <div className="list-search-input">
                  <Search size={18} aria-hidden="true" />
                  <input type="search" placeholder="เลขที่เอกสาร คำอธิบาย บัญชี หรือผู้บันทึก" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </label>
            </div>
            <div className="list-result-info"><span role="status">{q ? `พบ ${sorted.length} จาก ${all.length} รายการ` : `ทั้งหมด ${all.length} รายการ`}</span></div>
            {sorted.length === 0 ? (
              <div className="job-report-empty">
                <strong>ไม่พบธุรกรรมที่ตรงกับคำค้น</strong>
                <p><button type="button" className="list-button" onClick={() => setSearch('')}>ล้างคำค้น</button></p>
              </div>
            ) : (
              <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางธุรกรรมที่ผูกกับงาน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
                <table className="list-table jm-tx-table">
                  <caption className="list-sr-only">ธุรกรรมงบประมาณที่ผูกกับงาน หน้า {current} จาก {totalPages}</caption>
                  <thead>
                    <tr>
                      {header('posting_date')}
                      {header('reference_doc_no')}
                      {header('cost_center')}
                      {header('clearing_account_name')}
                      <th scope="col">รายละเอียด</th>
                      {header('username')}
                      {header('value_co_curr', 'jm-num')}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t, i) => {
                      const amount = amountOf(t);
                      return (
                        <tr key={t.id ?? i}>
                          <td className="list-number">{t.posting_date || '—'}</td>
                          <td className="list-ip">{t.reference_doc_no || '—'}</td>
                          <td><span className="jm-cell-main">{t.cost_center || '—'}</span><span className="jm-sub" title={t.cost_center_name || ''}>{t.cost_center_name || ''}</span></td>
                          <td><span className="jm-cell-main">{t.clearing_account || '—'}</span><span className="jm-sub" title={t.clearing_account_name || ''}>{t.clearing_account_name || ''}</span></td>
                          <td className="jm-desc" title={t.description || ''}>{t.description || '—'}</td>
                          <td>{t.username || '—'}</td>
                          <td className={`jm-num job-amount${amount !== null && amount < 0 ? ' is-credit' : ''}`}>{formatBaht(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {sorted.length > 0 && (
              <footer className="list-footer">
                <span className="list-muted">{(current - 1) * pageSize + 1}–{(current - 1) * pageSize + rows.length} จาก {sorted.length} รายการ</span>
                <label className="list-page-size">
                  แสดง
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    {TX_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  รายการต่อหน้า
                </label>
                <nav className="list-pagination" aria-label="แบ่งหน้าธุรกรรมที่ผูกกับงาน">
                  <button type="button" className="list-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button>
                  <span className="list-muted">หน้า {current} / {totalPages}</span>
                  <button type="button" className="list-button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>ถัดไป</button>
                </nav>
              </footer>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default JobManagementDetails;
