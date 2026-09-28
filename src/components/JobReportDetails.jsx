import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { jobStatusTone, jobPriorityTone, formatDateTime } from './jobReportShared';
import { Lightbox, StatusPill, JobInfoMain, JobInfoSide, JobTransactionsBrief } from './jobDetailParts.jsx';
import './ListPage.css';
import './JobReport.css';

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
                {job.priority && <StatusPill status={job.priority} tone={jobPriorityTone(job.priority)} />}
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
              <JobInfoMain job={job} onEquipmentClick={onEquipmentClick} openLightbox={openLightbox} />
              {(job.transactions || []).length > 0 && <JobTransactionsBrief transactions={job.transactions} />}
            </div>
            <div className="job-report-details-side">
              <JobInfoSide job={job} openLightbox={openLightbox} />
            </div>
          </div>
        </>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          type={lightbox.type}
          onNavigate={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
          onClose={() => setLightbox(null)}
        />
      )}
    </Motion.div>
  );
};

export default JobReportDetails;
