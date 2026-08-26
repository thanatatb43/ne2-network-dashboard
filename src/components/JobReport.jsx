import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus, Search, Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileText, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JobFormModal from './JobFormModal';

const STATUS_OPTIONS = ['เปิดงาน', 'ระหว่างดำเนินการ', 'เสร็จงาน', 'ยกเลิก'];
const JOB_TYPE_OPTIONS = ['แจ้งซ่อม', 'ขออุปกรณ์ใหม่', 'ขอเปลี่ยนอุปกรณ์', 'แจ้งระบบใช้งานไม่ได้'];
const PRIORITY_OPTIONS = ['ปกติ', 'เร่งด่วน'];

const buildDocUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;
const isImagePath = (path) => /\.(jpe?g|png|webp|gif)$/i.test(path || '');

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const DetailRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={{ fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span> {value}
    </div>
  );
};

// Full status-driven detail block, shown regardless of the job's CURRENT
// status -- e.g. assignee info stays visible even after the job moves on to
// เสร็จงาน, since it's already been through ระหว่างดำเนินการ. Each block only
// renders when its underlying fields actually have data, not by matching
// the exact status string (more robust than "only show if status === X").
const JobStatusDetails = ({ job }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
      <div>เปิดงานเมื่อ: {formatDateTime(job.createdAt) || '-'}</div>
      {job.updatedAt && job.updatedAt !== job.createdAt && <div>อัปเดตล่าสุดเมื่อ: {formatDateTime(job.updatedAt)}</div>}
    </div>

    {((job.assignees && job.assignees.length > 0) || job.assignee_name || job.assignee_emp_id || job.work_order_no || job.progress_notes) && (
      <div className="glass" style={{ padding: '0.9rem 1.1rem', borderRadius: '0.5rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-warning)' }}>ข้อมูลการดำเนินการ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {job.assignees && job.assignees.length > 0 ? (
            <div style={{ fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ผู้รับผิดชอบ:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.15rem' }}>
                {job.assignees.map((a, i) => (
                  <div key={i}>{a.assignee_name || a.name || '-'}{(a.assignee_emp_id || a.emp_id) ? ` (${a.assignee_emp_id || a.emp_id})` : ''}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <DetailRow label="ผู้รับผิดชอบ" value={job.assignee_name} />
              <DetailRow label="รหัสพนักงานผู้รับผิดชอบ" value={job.assignee_emp_id} />
            </>
          )}
          <DetailRow label="เลขที่คำสั่งปฏิบัติงาน" value={job.work_order_no} />
          <DetailRow label="หมายเหตุ" value={job.progress_notes} />
        </div>
      </div>
    )}

    {job.closing_notes && (
      <div className="glass" style={{ padding: '0.9rem 1.1rem', borderRadius: '0.5rem', background: 'var(--bg-accent-subtle)' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-success)' }}>หมายเหตุปิดงาน</div>
        <div style={{ fontSize: '0.85rem' }}>{job.closing_notes}</div>
      </div>
    )}

    {job.cancelled_reason && (
      <div className="glass" style={{ padding: '0.9rem 1.1rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-danger)' }}>เหตุผลที่ยกเลิก</div>
        <div style={{ fontSize: '0.85rem' }}>{job.cancelled_reason}</div>
      </div>
    )}
  </div>
);

// Renders an attached doc inline -- an <img> for images, an <iframe> for
// PDFs (Chrome/most browsers render PDFs natively in an iframe), plus an
// "open in new tab" fallback link either way. Shared by the notification
// doc (attached when the job is opened) and the completion report
// (attached when the job is closed) -- same shape, different label.
const NotificationDocPreview = ({ path, label = 'ไฟล์หนังสือแจ้ง' }) => {
  if (!path) return null;
  const url = buildDocUrl(path);
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <FileText size={14} /> {label}
      </div>
      {isImagePath(path) ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', display: 'block' }} />
        </a>
      ) : (
        <iframe src={url} title={label} style={{ width: '100%', height: '520px', border: '1px solid var(--border-subtle)', borderRadius: '0.5rem' }} />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '0.5rem' }}>
        เปิดในแท็บใหม่ <ExternalLink size={12} />
      </a>
    </div>
  );
};

// Grid of after-work photo thumbnails, each opening full-size in a new tab.
const AfterPhotosGallery = ({ paths }) => {
  if (!paths || paths.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <FileText size={14} /> รูปหลังดำเนินการ
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {paths.map((path, i) => (
          <a key={i} href={buildDocUrl(path)} target="_blank" rel="noopener noreferrer">
            <img src={buildDocUrl(path)} alt={`รูปหลังดำเนินการ ${i + 1}`} style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }} />
          </a>
        ))}
      </div>
    </div>
  );
};

// Same badge convention as EquipmentSearch.jsx's statusColor -- color +
// 15%-alpha background pill.
const jobStatusColor = (status) => {
  const s = (status || '').trim();
  if (s === 'เปิดงาน') return 'var(--text-secondary)';
  if (s === 'ระหว่างดำเนินการ') return 'var(--accent-warning)';
  if (s === 'เสร็จงาน') return 'var(--accent-success)';
  if (s === 'ยกเลิก') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

const StatusBadge = ({ status }) => (
  <span style={{
    display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '1rem',
    fontSize: '0.75rem', fontWeight: 600,
    color: jobStatusColor(status), background: `${jobStatusColor(status)}15`
  }}>
    {status || '-'}
  </span>
);

const JobReport = ({ token, user, onRequireLogin }) => {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // สำนักงาน filter is a typeable <input list> + <datalist> combo (like
  // EquipmentSearch.jsx's site filter) instead of a plain <select> -- only an
  // exact match against a known site's label resolves to the id actually
  // sent as ?pea_site_id=; partial typing just leaves the filter unset.
  const [siteInput, setSiteInput] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const siteLabel = (s) => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sites, setSites] = useState([]);

  const [showFormModal, setShowFormModal] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);

  const fetchSites = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      const list = result.data || result || [];
      setSites(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites:', error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (siteFilter) params.append('pea_site_id', siteFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (jobTypeFilter) params.append('job_type', jobTypeFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) {
        setJobs(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      } else {
        setJobs(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('ไม่สามารถโหลดรายการแจ้งปัญหาได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage, searchTerm, siteFilter, statusFilter, jobTypeFilter, priorityFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Only resolves to a real pea_site_id once the typed text exactly matches
  // a known site's label (i.e. the user picked a datalist suggestion or
  // typed the full name) -- partial text just leaves the site filter unset.
  useEffect(() => {
    const t = setTimeout(() => {
      const match = sites.find(s => siteLabel(s) === siteInput);
      setSiteFilter(match ? String(match.id) : '');
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [siteInput, sites]);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleNewReportClick = () => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    setShowFormModal(true);
  };

  const handleRowClick = async (jobId) => {
    setSelectedJobId(jobId);
    setLoadingJob(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      setJobDetails(result.data || result);
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('ไม่สามารถโหลดรายละเอียดของงานนี้ได้');
    } finally {
      setLoadingJob(false);
    }
  };

  const anyFilterActive = !!(searchInput || siteFilter || statusFilter || jobTypeFilter || priorityFilter);

  // ----------------------------------------------------
  // Read-only job detail view
  // ----------------------------------------------------
  if (selectedJobId) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => { setSelectedJobId(null); setJobDetails(null); }}
            className="glass"
            style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} /> กลับไปยัง รายการแจ้งปัญหา
          </button>
        </div>

        {loadingJob ? (
          <div className="card glass" style={{ padding: '4rem', textAlign: 'center' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-primary)' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดรายละเอียด...</p>
          </div>
        ) : !jobDetails ? (
          <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            ไม่พบรายละเอียดของงานนี้
          </div>
        ) : (
          <div className="card glass" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }} className="krub-bold">{jobDetails.job_name}</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{jobDetails.job_description || '-'}</p>
              </div>
              <StatusBadge status={jobDetails.status} />
            </div>

            <JobStatusDetails job={jobDetails} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>สำนักงาน:</span> {jobDetails.pea_site?.pea_name || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>จังหวัด:</span> {jobDetails.pea_site?.pea_province || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>ประเภทงาน:</span> {jobDetails.job_type || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>ความสำคัญ:</span> {jobDetails.priority || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>แผนก:</span> {jobDetails.department || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>ผู้แจ้ง:</span> {jobDetails.requester_name || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>รหัสพนักงานผู้แจ้ง:</span> {jobDetails.requester_emp_id || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>เบอร์ติดต่อ:</span> {jobDetails.requester_contact || '-'}</div>
            </div>

            <NotificationDocPreview path={jobDetails.notification_doc_file} />
            <NotificationDocPreview path={jobDetails.completion_report_file} label="รายงานผลการดำเนินการ" />

            <div style={{ marginBottom: (jobDetails.equipment || []).length > 0 ? '1.5rem' : 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>อุปกรณ์ที่มีปัญหา</div>
              {(jobDetails.problem_equipment || []).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ไม่มีอุปกรณ์ที่ระบุ</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {jobDetails.problem_equipment.map(item => (
                    <div key={item.id} className="glass" style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>{item.name || '-'} <span style={{ color: 'var(--text-secondary)' }}>({item.equipment_type || '-'})</span></span>
                      {item.status && <StatusBadge status={item.status} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(jobDetails.equipment || []).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>อุปกรณ์ที่ใช้ดำเนินการ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {jobDetails.equipment.map(item => (
                    <div key={item.id} className="glass" style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>{item.name || '-'} <span style={{ color: 'var(--text-secondary)' }}>({item.equipment_type || '-'})</span></span>
                      {item.status && <StatusBadge status={item.status} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(jobDetails.after_photos || []).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <AfterPhotosGallery paths={jobDetails.after_photos} />
              </div>
            )}

            {(jobDetails.transactions || []).length > 0 && (
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>ธุรกรรมงบประมาณที่ผูกไว้</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                        <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>วันที่ผ่านรายการ</th>
                        <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>เลขที่เอกสาร</th>
                        <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem' }}>รายละเอียด</th>
                        <th style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textAlign: 'right' }}>จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobDetails.transactions.map((t, idx) => (
                        <tr key={t.id || idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.6rem 0.9rem' }}>{t.posting_date || '-'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{t.reference_doc_no || '-'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-secondary)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description || '-'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: parseFloat(t.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            ฿{parseFloat(t.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  // ----------------------------------------------------
  // Main list view
  // ----------------------------------------------------
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>แจ้งปัญหา</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>แจ้งปัญหาอุปกรณ์หรือระบบให้ทีมงานดำเนินการแก้ไข และติดตามสถานะงานที่แจ้งไว้</p>
        </div>
        <button
          onClick={handleNewReportClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem',
            background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.5rem',
            fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          <Plus size={18} /> แจ้งปัญหาใหม่
        </button>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="ค้นหาชื่องาน หรือรายละเอียด..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '0.5rem', color: 'var(--text-primary)', outline: 'none',
                border: searchInput ? '1px solid var(--accent-primary)' : '1px solid var(--input-border)',
                background: searchInput ? 'var(--bg-accent-subtle)' : 'var(--input-bg)'
              }}
            />
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: siteInput ? '1px solid var(--accent-primary)' : undefined,
            background: siteInput ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สำนักงาน:</span>
            <input
              type="text"
              list="job-report-site-options"
              placeholder="ทั้งหมด"
              value={siteInput}
              onChange={(e) => setSiteInput(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '180px' }}
            />
            <datalist id="job-report-site-options">
              {sites.map(s => <option key={s.id} value={siteLabel(s)} />)}
            </datalist>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: statusFilter ? '1px solid var(--accent-primary)' : undefined,
            background: statusFilter ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
            <select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{s}</option>)}
            </select>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: jobTypeFilter ? '1px solid var(--accent-primary)' : undefined,
            background: jobTypeFilter ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภทงาน:</span>
            <select value={jobTypeFilter} onChange={(e) => handleFilterChange(setJobTypeFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{t}</option>)}
            </select>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: priorityFilter ? '1px solid var(--accent-primary)' : undefined,
            background: priorityFilter ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ความสำคัญ:</span>
            <select value={priorityFilter} onChange={(e) => handleFilterChange(setPriorityFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{p}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            พบ <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.total}</span> รายการ
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่องาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภทงาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สถานะ</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สำนักงาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผู้แจ้ง</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>วันที่สร้าง</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังโหลดรายการ...</p>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {anyFilterActive ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการแจ้งปัญหา'}
                  </td>
                </tr>
              ) : (
                jobs.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item.id)}
                    className="table-row-hover"
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    title="คลิกเพื่อดูรายละเอียด"
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{item.job_name}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.job_type || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}><StatusBadge status={item.status} /></td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                      {item.pea_site ? `${item.pea_site.pea_name}${item.pea_site.pea_province ? ` (${item.pea_site.pea_province})` : ''}` : '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.requester_name || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
            >
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {pagination.totalPages}</option>
              ))}
            </select>
            <button
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === pagination.totalPages ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFormModal && (
          <JobFormModal
            mode="create"
            sites={sites}
            token={token}
            onClose={() => setShowFormModal(false)}
            onSuccess={() => { setCurrentPage(1); fetchJobs(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default JobReport;
