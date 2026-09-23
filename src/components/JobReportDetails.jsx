import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, FileText, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { siteLabel, jobStatusTone } from './jobReportShared';
import './ListPage.css';
import './JobReport.css';

const buildDocUrl = (path) => (path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null);
const isImagePath = (path) => /\.(jpe?g|png|webp|gif)$/i.test(path || '');
const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};
// Equipment status uses its OWN tone mapping -- deliberately separate from
// jobStatusTone even though both render through the shared .list-status
// component (see the plan's section 6.2 on not conflating the two).
const equipmentStatusTone = (status) => {
  if (status === 'ใช้งาน') return 'up';
  if (['รอปรับปรุง', 'รอจำหน่าย', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน', 'รอส่งคืน'].includes(status)) return 'warning';
  if (['เลิกใช้งาน', 'จำหน่าย'].includes(status)) return 'down';
  if (status === 'ถูกยืม') return 'borrowed';
  return 'unknown';
};

// Basic modal accessibility (aria-modal, initial focus, Tab trap, Escape,
// return focus to opener) -- same small local implementation used in
// EquipmentBorrow.jsx; there's no shared Modal component yet.
const useModalA11y = (open, containerRef, onEscape) => {
  const openerRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  useEffect(() => { onEscapeRef.current = onEscape; });
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const getFocusable = () => Array.from(
      containerRef.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []
    ).filter((el) => !el.disabled);
    (getFocusable()[0] || containerRef.current)?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onEscapeRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus?.();
    };
    // containerRef is a ref (stable identity) -- omitted deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
};

// In-page viewer for the notification doc / completion report (image or
// PDF) and the after-photos gallery -- keeps viewing on this page instead
// of a new tab. Arrow keys/Escape only act while this is the topmost (and
// only) dialog on this page.
const Lightbox = ({ images, index, type, onNavigate, onClose }) => {
  const panelRef = useRef(null);
  useModalA11y(true, panelRef, onClose);
  return (
    <Motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="job-report-lightbox-backdrop"
      onClick={onClose}
    >
      <Motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={type === 'pdf' ? `เอกสาร ${index + 1} จาก ${images.length}` : `รูปภาพ ${index + 1} จาก ${images.length}`}
        tabIndex={-1}
        initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
        className="job-report-lightbox-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="job-report-lightbox-close" onClick={onClose} aria-label="ปิด">
          <X size={20} aria-hidden="true" />
        </button>
        {images.length > 1 && (
          <button
            className="job-report-lightbox-nav is-prev"
            onClick={() => onNavigate((index - 1 + images.length) % images.length)}
            aria-label="รูปก่อนหน้า"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        {type === 'pdf' ? (
          <iframe src={images[index]} title={`เอกสาร ${index + 1}`} />
        ) : (
          <img src={images[index]} alt={`รูปที่ ${index + 1} จาก ${images.length}`} />
        )}
        {images.length > 1 && (
          <button
            className="job-report-lightbox-nav is-next"
            onClick={() => onNavigate((index + 1) % images.length)}
            aria-label="รูปถัดไป"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </Motion.div>
      {images.length > 1 && <div className="job-report-lightbox-counter">{index + 1} / {images.length}</div>}
    </Motion.div>
  );
};

// Compact clickable preview for an attached doc (image or PDF) -- a real
// <button> with an accessible name, per the plan's section 8, instead of an
// <img onClick> or <div onClick>.
const DocPreview = ({ path, label, onOpen }) => {
  if (!path) return null;
  const url = buildDocUrl(path);
  const isImage = isImagePath(path);
  return (
    <div className="job-report-doc-block">
      <div className="list-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '.8125rem' }}>
        <FileText size={14} aria-hidden="true" /> {label}
      </div>
      <button type="button" className="job-report-doc-preview" onClick={onOpen} aria-label={isImage ? `เปิด${label}แบบเต็มจอ` : `เปิด${label} (PDF) แบบเต็มจอ`}>
        {isImage ? (
          <img src={url} alt="" />
        ) : (
          <div className="job-report-doc-card">
            <div className="job-report-doc-icon"><FileText size={20} aria-hidden="true" /></div>
            <div>
              <div className="job-report-doc-title">ไฟล์ PDF</div>
              <div className="job-report-doc-hint">คลิกเพื่อดูแบบเต็มจอ</div>
            </div>
          </div>
        )}
      </button>
      {!isImage && (
        <a className="job-report-doc-newtab" href={url} target="_blank" rel="noopener noreferrer">
          เปิดในแท็บใหม่ <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

const StatusPill = ({ status, tone }) => (
  <span className={`list-status list-status-${tone}`}>{status || 'ไม่ทราบสถานะ'}</span>
);

const EquipmentRow = ({ item, onEquipmentClick }) => (
  <div className="job-report-equipment-row">
    <span>
      {item.id && onEquipmentClick ? (
        <a
          className="job-report-equipment-link"
          href={`/equipment/${item.id}`}
          onClick={(e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              onEquipmentClick(item.id);
            }
          }}
        >
          {item.name || 'ดูรายละเอียดอุปกรณ์'}
        </a>
      ) : (item.name || '-')}
      {' '}<span className="list-muted">({item.equipment_type || '-'})</span>
    </span>
    {item.status && <StatusPill status={item.status} tone={equipmentStatusTone(item.status)} />}
  </div>
);

// Read-only job detail -- fetched independently by jobId (its own
// loading/error state, aborted on unmount or when jobId changes) so a slow
// response for a previous job can never land on top of a newer one.
const JobReportDetails = ({ jobId, token, onBack, onEquipmentClick }) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  // '' | 'not_found' | 'forbidden' | 'network'
  const [errorKind, setErrorKind] = useState('');
  const [retry, setRetry] = useState(0);
  const [lightbox, setLightbox] = useState(null); // { images, index, type }
  const controllerRef = useRef(null);

  const openLightbox = (images, index, type = 'image') => setLightbox({ images, index, type });

  useEffect(() => {
    if (!jobId) return;
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setLoading(true);
    setErrorKind('');
    setJob(null);
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (!active || controllerRef.current !== controller) return;
        if (response.status === 404) { setErrorKind('not_found'); return; }
        if (response.status === 403) { setErrorKind('forbidden'); return; }
        if (!response.ok) throw new Error('bad status');
        const data = await response.json();
        if (data.success === false || !data.data) throw new Error('bad shape');
        if (!active || controllerRef.current !== controller) return;
        setJob(data.data);
      } catch (err) {
        if (active && controllerRef.current === controller && err.name !== 'AbortError') setErrorKind('network');
      } finally {
        clearTimeout(timeout);
        if (active && controllerRef.current === controller) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [jobId, token, retry]);

  return (
    <Motion.div className="job-report-details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="list-button job-report-details-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> กลับไปยังรายการแจ้งปัญหา
      </button>

      {loading ? (
        <div className="job-report-details-state">
          <Loader2 size={28} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-primary)' }} />
          <p>กำลังโหลดรายละเอียด…</p>
        </div>
      ) : errorKind === 'not_found' ? (
        <div className="job-report-details-state">
          <AlertCircle size={28} aria-hidden="true" />
          <p><strong>ไม่พบงานนี้</strong><br />งานอาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
        </div>
      ) : errorKind === 'forbidden' ? (
        <div className="job-report-details-state">
          <AlertCircle size={28} aria-hidden="true" />
          <p><strong>ไม่มีสิทธิ์ดูงานนี้</strong></p>
        </div>
      ) : errorKind === 'network' || !job ? (
        <div className="job-report-details-state" role="alert">
          <AlertCircle size={28} aria-hidden="true" />
          <p><strong>โหลดรายละเอียดไม่สำเร็จ</strong></p>
          <button className="list-button" onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> ลองใหม่
          </button>
        </div>
      ) : (
        <>
          <div className="job-report-details-header">
            <div style={{ minWidth: 0 }}>
              <h1>{job.job_name || 'งานแจ้งปัญหา'}</h1>
              <div className="job-report-details-badges">
                <StatusPill status={job.status} tone={jobStatusTone(job.status)} />
                {job.priority && <StatusPill status={job.priority} tone={job.priority === 'เร่งด่วน' ? 'down' : 'unknown'} />}
                {job.job_type && <span className="list-muted">{job.job_type}</span>}
              </div>
              <div className="job-report-details-meta">
                <span>เปิดงานเมื่อ: {formatDateTime(job.createdAt) || '—'}</span>
                {job.updatedAt && job.updatedAt !== job.createdAt && <span>อัปเดตล่าสุด: {formatDateTime(job.updatedAt)}</span>}
              </div>
            </div>
            <div className="job-report-details-actions">
              <button className="list-button" onClick={() => setRetry((n) => n + 1)}>
                <RefreshCw size={16} aria-hidden="true" /> รีเฟรช
              </button>
            </div>
          </div>

          <div className="job-report-details-grid">
            <div className="job-report-details-main">
              <section className="job-report-panel">
                <h2>ปัญหาที่แจ้ง</h2>
                <p className="job-report-panel-body">{job.job_description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </section>

              {(job.assignees?.length > 0 || job.assignee_name || job.assignee_emp_id || job.work_order_no || job.progress_notes || job.closing_notes || job.cancelled_reason) && (
                <section className="job-report-panel">
                  <h2>การดำเนินการ</h2>
                  {(job.assignees?.length > 0 || job.assignee_name || job.work_order_no || job.progress_notes) ? (
                    <div className="job-report-subsection">
                      <div className="job-report-subsection-title">ผู้รับผิดชอบและความคืบหน้า</div>
                      <dl className="job-report-field-list">
                        {job.assignees?.length > 0 ? (
                          <div className="job-report-field-row"><dt>ผู้รับผิดชอบ:</dt> <dd>{job.assignees.map((a) => `${a.assignee_name || a.name || '-'}${(a.assignee_emp_id || a.emp_id) ? ` (${a.assignee_emp_id || a.emp_id})` : ''}`).join(', ')}</dd></div>
                        ) : job.assignee_name ? (
                          <div className="job-report-field-row"><dt>ผู้รับผิดชอบ:</dt> <dd>{job.assignee_name}{job.assignee_emp_id ? ` (${job.assignee_emp_id})` : ''}</dd></div>
                        ) : null}
                        {job.work_order_no && <div className="job-report-field-row"><dt>เลขที่คำสั่งปฏิบัติงาน:</dt> <dd>{job.work_order_no}</dd></div>}
                        {job.progress_notes && <div className="job-report-field-row"><dt>หมายเหตุความคืบหน้า:</dt> <dd>{job.progress_notes}</dd></div>}
                      </dl>
                    </div>
                  ) : (
                    <p className="list-muted" style={{ fontSize: '.875rem' }}>ยังไม่มีข้อมูลการดำเนินการ</p>
                  )}
                  {job.status !== 'ยกเลิก' && job.closing_notes && (
                    <div className="job-report-subsection" style={{ background: 'var(--bg-success-subtle)' }}>
                      <div className="job-report-subsection-title" style={{ color: 'var(--accent-success)' }}>หมายเหตุปิดงาน</div>
                      <p style={{ margin: 0, fontSize: '.875rem' }}>{job.closing_notes}</p>
                    </div>
                  )}
                  {job.cancelled_reason && (
                    <div className="job-report-subsection" style={{ background: 'var(--bg-danger-subtle)' }}>
                      <div className="job-report-subsection-title" style={{ color: 'var(--accent-danger)' }}>เหตุผลที่ยกเลิก</div>
                      <p style={{ margin: 0, fontSize: '.875rem' }}>{job.cancelled_reason}</p>
                    </div>
                  )}
                </section>
              )}

              <section className="job-report-panel">
                <h2>อุปกรณ์ที่มีปัญหา</h2>
                {(job.problem_equipment || []).length === 0 ? (
                  <p className="list-muted" style={{ fontSize: '.875rem' }}>ไม่มีอุปกรณ์ที่ระบุ</p>
                ) : (
                  job.problem_equipment.map((item) => <EquipmentRow key={item.id} item={item} onEquipmentClick={onEquipmentClick} />)
                )}
              </section>

              {(job.equipment || []).length > 0 && (
                <section className="job-report-panel">
                  <h2>อุปกรณ์ที่ใช้ดำเนินการ</h2>
                  {job.equipment.map((item) => <EquipmentRow key={item.id} item={item} onEquipmentClick={onEquipmentClick} />)}
                </section>
              )}

              {(job.after_photos || []).length > 0 && (
                <section className="job-report-panel">
                  <h2>รูปหลังดำเนินการ ({job.after_photos.length})</h2>
                  <div className="job-report-photos-grid">
                    {job.after_photos.map((path, i) => (
                      <button
                        key={i}
                        type="button"
                        className="job-report-photo-button"
                        onClick={() => openLightbox(job.after_photos.map((p) => buildDocUrl(p)), i)}
                        aria-label={`ดูรูปหลังดำเนินการ ${i + 1} จาก ${job.after_photos.length}`}
                      >
                        <img src={buildDocUrl(path)} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {(job.transactions || []).length > 0 && (
                <section className="job-report-panel">
                  <h2>ธุรกรรมงบประมาณที่ผูกไว้</h2>
                  <div className="job-report-tx-scroll">
                    <table className="job-report-tx-table">
                      <caption className="list-sr-only">ธุรกรรมงบประมาณที่ผูกกับงานนี้</caption>
                      <thead>
                        <tr>
                          <th scope="col">วันที่ผ่านรายการ</th>
                          <th scope="col">เลขที่เอกสาร</th>
                          <th scope="col">รายละเอียด</th>
                          <th scope="col">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.transactions.map((t, idx) => (
                          <tr key={t.id || idx}>
                            <td>{t.posting_date || '-'}</td>
                            <td style={{ fontFamily: 'ui-monospace, monospace' }}>{t.reference_doc_no || '-'}</td>
                            <td title={t.description} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '-'}</td>
                            <td style={{ fontWeight: 700, color: parseFloat(t.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                              ฿{parseFloat(t.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            <div className="job-report-details-side">
              <section className="job-report-panel">
                <h2>สำนักงานและผู้แจ้ง</h2>
                <dl className="job-report-field-list">
                  <div className="job-report-field-row"><dt>สำนักงาน:</dt> <dd>{job.pea_site ? siteLabel(job.pea_site) : '—'}</dd></div>
                  <div className="job-report-field-row"><dt>แผนก:</dt> <dd>{job.department || '—'}</dd></div>
                  <div className="job-report-field-row"><dt>ผู้แจ้ง:</dt> <dd>{job.requester_name || '—'}</dd></div>
                  <div className="job-report-field-row"><dt>รหัสพนักงานผู้แจ้ง:</dt> <dd>{job.requester_emp_id || '—'}</dd></div>
                  <div className="job-report-field-row"><dt>เบอร์ติดต่อ:</dt> <dd>{job.requester_contact || '—'}</dd></div>
                </dl>
              </section>

              {(job.notification_doc_file || job.completion_report_file) && (
                <section className="job-report-panel">
                  <h2>เอกสาร</h2>
                  <DocPreview
                    path={job.notification_doc_file}
                    label="หนังสือแจ้ง"
                    onOpen={() => openLightbox([buildDocUrl(job.notification_doc_file)], 0, isImagePath(job.notification_doc_file) ? 'image' : 'pdf')}
                  />
                  <DocPreview
                    path={job.completion_report_file}
                    label="รายงานผลการดำเนินการ"
                    onOpen={() => openLightbox([buildDocUrl(job.completion_report_file)], 0, isImagePath(job.completion_report_file) ? 'image' : 'pdf')}
                  />
                </section>
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {lightbox && (
          <Lightbox
            images={lightbox.images}
            index={lightbox.index}
            type={lightbox.type}
            onNavigate={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

export default JobReportDetails;
