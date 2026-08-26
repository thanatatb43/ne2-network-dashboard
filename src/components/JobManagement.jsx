import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, Search,
  ArrowUpDown, ArrowUp, ArrowDown, ClipboardList, Wallet, FileText, Activity,
  X, PlayCircle, CheckCircle2, XCircle, Pencil, PackageSearch, ExternalLink, Paperclip, Wrench, Receipt, Plus,
  History, Trash2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JobFormModal from './JobFormModal';
import EquipmentPicker from './EquipmentPicker';
import BudgetTransactionPicker from './BudgetTransactionPicker';
import JobHistoryModal from './JobHistoryModal';

const STATUS_OPTIONS = ['เปิดงาน', 'ระหว่างดำเนินการ', 'เสร็จงาน', 'ยกเลิก'];
const JOB_TYPE_OPTIONS = ['แจ้งซ่อม', 'ขออุปกรณ์ใหม่', 'ขอเปลี่ยนอุปกรณ์', 'แจ้งระบบใช้งานไม่ได้'];
const PRIORITY_OPTIONS = ['ปกติ', 'เร่งด่วน'];

// Same limits as EquipmentEdit.jsx's photo upload -- after-photos are
// images only (not PDF, unlike the notification doc), up to 5, ≤5MB each.
const MAX_AFTER_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const validatePhotoFiles = (files) => {
  for (const file of files) {
    const hasValidType = ALLOWED_PHOTO_TYPES.includes(file.type);
    const hasValidExtension = ALLOWED_PHOTO_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidType && !hasValidExtension) return `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (jpeg/png/webp/gif)`;
    if (file.size > MAX_PHOTO_SIZE) return `ไฟล์ "${file.name}" มีขนาดเกิน 5MB`;
  }
  return null;
};

// Completion report attached at ปิดงาน -- same size/type limits as
// JobFormModal.jsx's notification-doc upload (image or PDF, <=5MB).
const MAX_DOC_SIZE = 5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const ALLOWED_DOC_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
const DOC_INPUT_ACCEPT = [...ALLOWED_DOC_TYPES, ...ALLOWED_DOC_EXTENSIONS].join(',');
const validateDocFile = (file) => {
  const hasValidType = ALLOWED_DOC_TYPES.includes(file.type);
  const hasValidExtension = ALLOWED_DOC_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  if (!hasValidType && !hasValidExtension) return `ไฟล์ "${file.name}" ต้องเป็นรูปภาพ (jpeg/png/webp/gif) หรือ PDF เท่านั้น`;
  if (file.size > MAX_DOC_SIZE) return `ไฟล์ "${file.name}" มีขนาดเกิน 5MB`;
  return null;
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
// the exact status string.
const JobStatusDetails = ({ job }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
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

const JobManagement = ({ token, onBack, user }) => {
  // ----------------------------------------------------
  // STATE 1: Global Jobs List -- server-side paginated via
  // GET /api/pea-jobs?pea_site_id=&page=&limit=
  // ----------------------------------------------------
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  // สำนักงาน filter is a typeable <input list> + <datalist> combo (like
  // EquipmentSearch.jsx's site filter) instead of a plain <select> -- only an
  // exact match against a known site's label resolves to the id actually
  // sent as ?pea_site_id=; partial typing just leaves the filter unset.
  const [siteInput, setSiteInput] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const siteLabel = (s) => `${s.pea_name}${s.province ? ` (${s.province})` : ''}`;
  // searchInput is the raw, immediate textbox value; searchTerm is the
  // debounced value actually sent as ?search= (see the debounce effect below).
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  // ----------------------------------------------------
  // STATE 3: Job-Specific View
  // ----------------------------------------------------
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobCurrentPage, setJobCurrentPage] = useState(1);
  const [jobItemsPerPage, setJobItemsPerPage] = useState(10);
  const [jobSortConfig, setJobSortConfig] = useState({ key: 'posting_date', direction: 'desc' });

  // ----------------------------------------------------
  // STATE 4: PEA Sites (site filter dropdown + the create/edit form's site
  // select, via JobFormModal) + workflow status/type/priority filters
  // ----------------------------------------------------
  const [sites, setSites] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // ----------------------------------------------------
  // API FETCH: All Jobs -- server-side paginated, optionally scoped to one
  // PEA site via pea_site_id, plus status/job_type/priority filters.
  // ----------------------------------------------------
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteFilter) params.append('pea_site_id', siteFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (jobTypeFilter) params.append('job_type', jobTypeFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
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
      toast.error('ไม่สามารถโหลดข้อมูลงานได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, siteFilter, searchTerm, statusFilter, jobTypeFilter, priorityFilter]);

  // Debounces free-text search into a single request instead of firing one
  // per keystroke; lands together with the page-1 reset so they batch into
  // one re-render instead of racing across two separate effects.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch PEA sites from pea-jobs/sites endpoint -- needed both for the main
  // list's site filter and JobFormModal's site select.
  const fetchSites = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      const list = result.data || result || [];
      setSites(list);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('ไม่สามารถโหลดรายชื่อสำนักงาน ได้');
    }
  };

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleLimitChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  // ----------------------------------------------------
  // HANDLERS & FILTERS: Global Jobs Sorting
  // ----------------------------------------------------
  const handleSortConfig = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleJobClick = async (jobId) => {
    setSelectedJobId(jobId);
    setLoadingJob(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) {
        setJobDetails(result.data || result);
      } else {
        setJobDetails(result);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('ไม่สามารถโหลดรายละเอียดของงานนี้ได้');
    } finally {
      setLoadingJob(false);
    }
  };

  // Re-fetches the currently open job's detail -- used after any workflow
  // action (progress/complete/cancel) or edit succeeds, so the status badge
  // and detail card reflect the new state without a full page reload.
  const refetchJobDetails = () => {
    if (selectedJobId) handleJobClick(selectedJobId);
  };

  // Row-level edit: loads the full job detail first (same as clicking the
  // row) before opening JobFormModal -- the table's list items don't
  // reliably carry problem_equipment/etc., so opening the edit form
  // straight off a list item risks silently dropping fields on save.
  const handleEditFromRow = async (e, jobId) => {
    e.stopPropagation();
    await handleJobClick(jobId);
    setShowEditModal(true);
  };

  const confirmDeleteJob = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success !== false) {
        toast.success(result.message || 'ลบงานสำเร็จ');
        if (selectedJobId === itemToDelete.id) {
          setSelectedJobId(null);
          setJobDetails(null);
        }
        setItemToDelete(null);
        fetchJobs();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถลบงานได้');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------------------------------
  // WORKFLOW ACTIONS: progress / complete / cancel -- role-gated (see
  // canManageWorkflow below), each backed by its own small modal.
  // ----------------------------------------------------
  const canManageWorkflow = ['super_admin', 'network_admin', 'computer_admin', 'operator'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';

  const [showEditModal, setShowEditModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Row-level actions on the jobs table -- history (view-only, same roles as
  // canManageWorkflow) and delete (super_admin only, DELETE /api/pea-jobs/:id).
  const [historyModalJob, setHistoryModalJob] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Multiple assignees per job -- an array of { name, emp_id } rows, always
  // at least one (blank) row shown so the form doesn't start empty.
  const [assignees, setAssignees] = useState([{ name: '', emp_id: '' }]);
  const [progressNotes, setProgressNotes] = useState('');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [cancelledReason, setCancelledReason] = useState('');
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);

  // ปิดงาน extras -- equipment actually used for the repair, after-work
  // photos, and budget transactions to link, all optional alongside the
  // required closing_notes.
  const [usedEquipment, setUsedEquipment] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [linkedTransactions, setLinkedTransactions] = useState([]);
  const [completionReportFile, setCompletionReportFile] = useState(null);

  useEffect(() => {
    if (showProgressModal) {
      // Pre-fill the first assignee row with the logged-in user, same
      // name/username fields Sidebar.jsx uses for its own display -- still
      // editable/removable, just a convenience default since the person
      // starting the job is very often the first assignee.
      const selfName = user?.first_name ? `${user.first_name} ${user.last_name}` : (user?.username || '');
      setAssignees([{ name: selfName, emp_id: user?.username || '' }]);
      setProgressNotes('');
      setWorkOrderNo('');
    }
  }, [showProgressModal, user]);

  const addAssigneeRow = () => setAssignees(prev => [...prev, { name: '', emp_id: '' }]);
  const updateAssigneeField = (index, field, value) => {
    setAssignees(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };
  const removeAssigneeRow = (index) => setAssignees(prev => prev.filter((_, i) => i !== index));

  useEffect(() => {
    if (showCompleteModal) {
      setClosingNotes('');
      setUsedEquipment([]);
      setAfterPhotos([]);
      setLinkedTransactions([]);
      setCompletionReportFile(null);
    }
  }, [showCompleteModal]);

  const handleCompletionReportChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateDocFile(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }
    setCompletionReportFile(file);
    e.target.value = '';
  };

  const handleAfterPhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (afterPhotos.length + files.length > MAX_AFTER_PHOTOS) {
      toast.error(`แนบรูปได้สูงสุด ${MAX_AFTER_PHOTOS} รูป (ตอนนี้เลือกไว้แล้ว ${afterPhotos.length} รูป)`);
      e.target.value = '';
      return;
    }
    const validationError = validatePhotoFiles(files);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }
    setAfterPhotos(prev => [...prev, ...files]);
    e.target.value = '';
  };
  const removeAfterPhoto = (index) => setAfterPhotos(prev => prev.filter((_, i) => i !== index));

  useEffect(() => {
    if (showCancelModal) setCancelledReason('');
  }, [showCancelModal]);

  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    setWorkflowSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${selectedJobId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assignees: assignees
            .filter(a => a.name.trim() || a.emp_id.trim())
            .map(a => ({ name: a.name.trim(), emp_id: a.emp_id.trim() })),
          progress_notes: progressNotes.trim(),
          work_order_no: workOrderNo.trim()
        })
      });
      const result = await response.json();
      if (response.ok && result.success !== false) {
        toast.success(result.message || 'เริ่มดำเนินการแล้ว');
        setShowProgressModal(false);
        refetchJobDetails();
        fetchJobs();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถเริ่มดำเนินการได้');
      }
    } catch (error) {
      console.error('Error updating job progress:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  // Each follow-up call below (equipment-used, after-photos, transaction
  // linking) gets its own try/catch + toast so one failing doesn't block
  // the others or undo the PUT /complete that already succeeded -- same
  // isolation pattern as the notification-doc upload in JobFormModal.jsx.
  const submitUsedEquipment = async (jobId) => {
    if (usedEquipment.length === 0) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ equipment_ids: usedEquipment.map(e => e.id) })
      });
      const result = await response.json();
      if (!response.ok) toast.error(result.message || result.error || 'บันทึกอุปกรณ์ที่ใช้ดำเนินการไม่สำเร็จ');
    } catch (error) {
      console.error('Error submitting used equipment:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกอุปกรณ์ที่ใช้ดำเนินการ');
    }
  };

  const submitAfterPhotos = async (jobId) => {
    if (afterPhotos.length === 0) return;
    try {
      const body = new FormData();
      afterPhotos.forEach(file => body.append('photos', file));
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}/after-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const result = await response.json();
      if (!response.ok) toast.error(result.message || result.error || 'แนบรูปหลังดำเนินการไม่สำเร็จ');
    } catch (error) {
      console.error('Error uploading after-photos:', error);
      toast.error('เกิดข้อผิดพลาดในการแนบรูปหลังดำเนินการ');
    }
  };

  const submitLinkedTransactions = async (jobId) => {
    if (linkedTransactions.length === 0) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pea_site_id: jobDetails?.pea_site_id,
          pea_job_id: jobId,
          budget_transaction_ids: linkedTransactions.map(t => t.id)
        })
      });
      const result = await response.json();
      if (!response.ok) toast.error(result.message || result.error || 'ผูกธุรกรรมงบประมาณไม่สำเร็จ');
    } catch (error) {
      console.error('Error linking budget transactions:', error);
      toast.error('เกิดข้อผิดพลาดในการผูกธุรกรรมงบประมาณ');
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!closingNotes.trim()) { toast.error('กรุณาระบุหมายเหตุปิดงาน'); return; }
    setWorkflowSubmitting(true);
    try {
      // multipart/form-data now (not JSON) since a completion report file
      // can ride along with closing_notes in the same request -- Authorization
      // only, no manual Content-Type, so the browser sets the multipart boundary.
      const formData = new FormData();
      formData.append('closing_notes', closingNotes.trim());
      if (completionReportFile) formData.append('completion_report', completionReportFile);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${selectedJobId}/complete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const result = await response.json();
      if (response.ok && result.success !== false) {
        toast.success(result.message || 'ปิดงานสำเร็จ');
        await Promise.all([
          submitUsedEquipment(selectedJobId),
          submitAfterPhotos(selectedJobId),
          submitLinkedTransactions(selectedJobId)
        ]);
        setShowCompleteModal(false);
        refetchJobDetails();
        fetchJobs();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถปิดงานได้');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelledReason.trim()) { toast.error('กรุณาระบุเหตุผลที่ยกเลิก'); return; }
    setWorkflowSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${selectedJobId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelled_reason: cancelledReason.trim() })
      });
      const result = await response.json();
      if (response.ok && result.success !== false) {
        toast.success(result.message || 'ยกเลิกงานสำเร็จ');
        setShowCancelModal(false);
        refetchJobDetails();
        fetchJobs();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถยกเลิกงานได้');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleJobSort = (key) => {
    let direction = 'asc';
    if (jobSortConfig.key === key && jobSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setJobSortConfig({ key, direction });
  };

  // Jobs are already the current server-side page (and already scoped to
  // siteFilter), so this only sorts what's visible -- no client-side
  // filtering or slicing, that's all handled by the API now.
  const sortedJobsList = [...jobs].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal, bVal;
    if (sortConfig.key === 'pea_name') {
      aVal = a.pea_site?.pea_name || '';
      bVal = b.pea_site?.pea_name || '';
    } else if (sortConfig.key === 'transactions') {
      aVal = a.transactions?.length || 0;
      bVal = b.transactions?.length || 0;
    } else {
      aVal = a[sortConfig.key];
      bVal = b[sortConfig.key];
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // ----------------------------------------------------
  // HANDLERS & FILTERS: Job Specific View (id call)
  // ----------------------------------------------------
  const filteredJobTransactionsList = (jobDetails?.transactions || []).filter(t => {
    const search = jobSearchTerm.toLowerCase();
    return (
      t.reference_doc_no?.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.clearing_account_name?.toLowerCase().includes(search) ||
      t.cost_center?.toLowerCase().includes(search) ||
      t.username?.toLowerCase().includes(search)
    );
  });

  const sortedJobTransactionsList = [...filteredJobTransactionsList].sort((a, b) => {
    if (!jobSortConfig.key) return 0;
    
    let aVal = a[jobSortConfig.key];
    let bVal = b[jobSortConfig.key];

    if (jobSortConfig.key === 'value_co_curr') {
      const nA = parseFloat(aVal || 0);
      const nB = parseFloat(bVal || 0);
      return jobSortConfig.direction === 'asc' ? nA - nB : nB - nA;
    }

    if (aVal < bVal) return jobSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return jobSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentJobItemsList = sortedJobTransactionsList.slice((jobCurrentPage - 1) * jobItemsPerPage, jobCurrentPage * jobItemsPerPage);
  const totalJobPagesList = Math.ceil(sortedJobTransactionsList.length / jobItemsPerPage);

  const totalJobSpendingList = React.useMemo(() => {
    return (jobDetails?.transactions || []).reduce((sum, t) => sum + parseFloat(t.value_co_curr || 0), 0);
  }, [jobDetails]);

  // ----------------------------------------------------
  // RENDER JSX
  // ----------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <AnimatePresence mode="wait">
        {/* VIEW 3: Job-Specific Details View */}
        {selectedJobId ? (
          <motion.div
            key="job_details_view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => { setSelectedJobId(null); setJobDetails(null); }}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง รายการงานทั้งหมด
              </button>
            </div>

            {loadingJob ? (
              <div className="card glass" style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-warning)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดรายละเอียดข้อมูลงาน...</p>
              </div>
            ) : !jobDetails ? (
              <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                ไม่พบรายละเอียดข้อมูลงานนี้
              </div>
            ) : (
              <>
                {/* Summary cards for this job */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ชื่องาน / รายละเอียด</span>
                      <div style={{ color: 'var(--accent-primary)', background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <ClipboardList size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobDetails.job_name}>
                        {jobDetails.job_name}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{jobDetails.job_description || '-'}</p>
                    </div>
                  </div>

                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>สถานที่ / สาขา</span>
                      <div style={{ color: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Activity size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block' }}>
                        {jobDetails.pea_site?.pea_name || '-'}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>จังหวัด: {jobDetails.pea_site?.pea_province || '-'}</p>
                    </div>
                  </div>

                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ค่าใช้จ่ายเฉพาะงานนี้</span>
                      <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Wallet size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
                        ฿{Math.abs(totalJobSpendingList).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ค่าใช้จ่ายรวม {(jobDetails?.transactions || []).length} รายการ</p>
                    </div>
                  </div>

                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>สถานะงาน</span>
                      {((canManageWorkflow && jobDetails.status === 'เปิดงาน') || isSuperAdmin) && (
                        <button
                          onClick={() => setShowEditModal(true)}
                          title="แก้ไขข้อมูลงาน"
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <StatusBadge status={jobDetails.status} />
                    </div>
                  </div>
                </div>

                <JobStatusDetails job={jobDetails} />

                {/* Workflow action buttons -- role-gated, contextual on status */}
                {canManageWorkflow && (jobDetails.status === 'เปิดงาน' || jobDetails.status === 'ระหว่างดำเนินการ') && (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
                    {jobDetails.status === 'เปิดงาน' && (
                      <button
                        onClick={() => setShowProgressModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--accent-warning)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <PlayCircle size={18} /> เริ่มดำเนินการ
                      </button>
                    )}
                    {jobDetails.status === 'ระหว่างดำเนินการ' && (
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--accent-success)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <CheckCircle2 size={18} /> ปิดงาน
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancelModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--accent-danger)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <XCircle size={18} /> ยกเลิกงาน
                    </button>
                  </div>
                )}

                {/* Notification doc -- read-only inline preview */}
                {jobDetails.notification_doc_file && (
                  <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <NotificationDocPreview path={jobDetails.notification_doc_file} />
                  </div>
                )}

                {/* Completion report -- read-only inline preview, attached at ปิดงาน */}
                {jobDetails.completion_report_file && (
                  <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <NotificationDocPreview path={jobDetails.completion_report_file} label="รายงานผลการดำเนินการ" />
                  </div>
                )}

                {/* Problem equipment -- read-only */}
                <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <PackageSearch size={22} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>อุปกรณ์ที่มีปัญหา</h3>
                  </div>
                  {(jobDetails.problem_equipment || []).length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ไม่มีอุปกรณ์ที่ระบุ</p>
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

                {/* Equipment used for the repair -- read-only, separate from problem_equipment */}
                {(jobDetails.equipment || []).length > 0 && (
                  <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <Wrench size={22} style={{ color: 'var(--accent-primary)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>อุปกรณ์ที่ใช้ดำเนินการ</h3>
                    </div>
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

                {/* After-work photos -- read-only gallery */}
                {(jobDetails.after_photos || []).length > 0 && (
                  <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <AfterPhotosGallery paths={jobDetails.after_photos} />
                  </div>
                )}

                {/* Job Transactions Table */}
                <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                      <FileText size={32} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.75rem' }} className="krub-bold">
                        ประวัติธุรกรรมงาน (ID: {jobDetails.id})
                      </h2>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        รายการบันทึกบัญชีแยกประเภทและการสั่งจ่ายเงินสำหรับโครงการนี้
                      </p>
                    </div>
                  </div>

                  {/* Controls Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
                        <select value={jobItemsPerPage} onChange={(e) => { setJobItemsPerPage(Number(e.target.value)); setJobCurrentPage(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                          {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ position: 'relative', width: '300px' }}>
                      <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="text" placeholder="ค้นหาเลขที่เอกสาร คำอธิบาย บัญชี หรือผู้บันทึก..." value={jobSearchTerm} onChange={(e) => { setJobSearchTerm(e.target.value); setJobCurrentPage(1); }} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }} />
                    </div>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '1rem 1.5rem', width: '80px' }}>ลำดับ</th>
                          <th onClick={() => handleJobSort('posting_date')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>วันที่ผ่านรายการ {jobSortConfig.key === 'posting_date' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('reference_doc_no')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>เลขที่เอกสาร {jobSortConfig.key === 'reference_doc_no' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('cost_center')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ศูนย์ต้นทุน {jobSortConfig.key === 'cost_center' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('clearing_account')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>บัญชีหักล้าง {jobSortConfig.key === 'clearing_account' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th style={{ padding: '1rem 1.5rem' }}>รายละเอียด</th>
                          <th onClick={() => handleJobSort('username')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ผู้บันทึก {jobSortConfig.key === 'username' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('value_co_curr')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>จำนวนเงิน {jobSortConfig.key === 'value_co_curr' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentJobItemsList.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              ไม่พบข้อมูลธุรกรรมของงานนี้
                            </td>
                          </tr>
                        ) : (
                          currentJobItemsList.map((item, idx) => (
                            <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{((jobCurrentPage - 1) * jobItemsPerPage) + idx + 1}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.posting_date || '-'}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.reference_doc_no || '-'}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 500 }}>{item.cost_center}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cost_center_name}</div>
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 500 }}>{item.clearing_account}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.clearing_account_name}</div>
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                                {item.description || '-'}
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.username || '-'}</td>
                              <td style={{
                                padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700,
                                color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)'
                              }}>
                                ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {!loadingJob && totalJobPagesList > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        แสดง {((jobCurrentPage - 1) * jobItemsPerPage) + 1} ถึง {Math.min(jobCurrentPage * jobItemsPerPage, sortedJobTransactionsList.length)} จาก {sortedJobTransactionsList.length} รายการ
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => setJobCurrentPage(p => Math.max(1, p - 1))} disabled={jobCurrentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: jobCurrentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

                        <select
                          value={jobCurrentPage}
                          onChange={(e) => setJobCurrentPage(Number(e.target.value))}
                          className="glass"
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                        >
                          {Array.from({ length: totalJobPagesList }, (_, i) => i + 1).map(p => (
                            <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {totalJobPagesList}</option>
                          ))}
                        </select>

                        <button onClick={() => setJobCurrentPage(p => Math.min(totalJobPagesList, p + 1))} disabled={jobCurrentPage === totalJobPagesList} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: jobCurrentPage === totalJobPagesList ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ) : (
          // VIEW 1: Main Jobs list
          <motion.div
            key="jobs_list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button 
                onClick={onBack}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง Overview
              </button>
            </div>

            <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                    <ClipboardList size={32} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem' }} className="krub-bold">จัดการงาน (Job Management)</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>รายละเอียดรายการงาน สถานะ และจำนวนธุรกรรมทั้งหมดในระบบ (การแจ้งปัญหาใหม่ทำได้ที่เมนู "แจ้งปัญหา")</p>
                  </div>
                </div>
              </div>

              {/* Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
                    <select value={itemsPerPage} onChange={(e) => handleLimitChange(Number(e.target.value))} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      {[10, 20, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                    </select>
                  </div>
                  <div className="glass" style={{
                    display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
                    border: siteInput ? '1px solid var(--accent-primary)' : undefined,
                    background: siteInput ? 'var(--bg-accent-subtle)' : undefined
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>สำนักงาน:</span>
                    <input
                      type="text"
                      list="job-mgmt-site-options"
                      placeholder="ทั้งหมด"
                      value={siteInput}
                      onChange={(e) => setSiteInput(e.target.value)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '180px' }}
                    />
                    <datalist id="job-mgmt-site-options">
                      {sites.map(s => <option key={s.id} value={siteLabel(s)} />)}
                    </datalist>
                  </div>
                  <div className="glass" style={{
                    display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
                    border: statusFilter ? '1px solid var(--accent-primary)' : undefined,
                    background: statusFilter ? 'var(--bg-accent-subtle)' : undefined
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>สถานะ:</span>
                    <select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <option value="" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{s}</option>)}
                    </select>
                  </div>
                  <div className="glass" style={{
                    display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
                    border: jobTypeFilter ? '1px solid var(--accent-primary)' : undefined,
                    background: jobTypeFilter ? 'var(--bg-accent-subtle)' : undefined
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ประเภทงาน:</span>
                    <select value={jobTypeFilter} onChange={(e) => handleFilterChange(setJobTypeFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <option value="" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                      {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{t}</option>)}
                    </select>
                  </div>
                  <div className="glass" style={{
                    display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
                    border: priorityFilter ? '1px solid var(--accent-primary)' : undefined,
                    background: priorityFilter ? 'var(--bg-accent-subtle)' : undefined
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ความสำคัญ:</span>
                    <select value={priorityFilter} onChange={(e) => handleFilterChange(setPriorityFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <option value="" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                      {PRIORITY_OPTIONS.map(p => <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่องาน หรือรายละเอียดงาน..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '0.5rem', color: 'var(--text-primary)', outline: 'none',
                      border: searchInput ? '1px solid var(--accent-primary)' : '1px solid var(--input-border)',
                      background: searchInput ? 'var(--bg-accent-subtle)' : 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Table -- fixed layout so the truncated cells' maxWidth
                  actually clips instead of the column just growing to fit
                  the longest value. */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th onClick={() => handleSortConfig('id')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '70px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ID {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('job_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ชื่องาน {sortConfig.key === 'job_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('status')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '130px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>สถานะ {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('job_description')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>รายละเอียดงาน {sortConfig.key === 'job_description' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('pea_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>สำนักงาน {sortConfig.key === 'pea_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('transactions')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'center', width: '130px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>จำนวนธุรกรรม {sortConfig.key === 'transactions' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('createdAt')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>วันที่สร้าง {sortConfig.key === 'createdAt' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'center', width: '130px' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '4rem', textAlign: 'center' }}>
                          <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-warning)' }} />
                          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูลงาน...</p>
                        </td>
                      </tr>
                    ) : sortedJobsList.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          ไม่พบข้อมูลงานในระบบ
                        </td>
                      </tr>
                    ) : (
                      sortedJobsList.map((item) => {
                        const canEditRow = (canManageWorkflow && item.status === 'เปิดงาน') || isSuperAdmin;
                        return (
                        <tr
                          key={item.id}
                          onClick={() => handleJobClick(item.id)}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                          className="table-row-hover"
                          title="คลิกเพื่อดูรายละเอียดงาน"
                        >
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{item.id}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 500, overflow: 'hidden' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.job_name}>{item.job_name}</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}><StatusBadge status={item.status} /></td>
                          <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.job_description || '-'}>{item.job_description || '-'}</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', overflow: 'hidden' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.pea_site?.pea_name || '-'}>{item.pea_site?.pea_name || '-'}</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'center', color: 'var(--accent-warning)', fontWeight: 700 }}>
                            {item.transactions?.length || 0} รายการ
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '-'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                              {canManageWorkflow && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setHistoryModalJob(item); }}
                                  title="ดูประวัติของงาน"
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '0.3rem' }}
                                >
                                  <History size={16} />
                                </button>
                              )}
                              {canEditRow && (
                                <button
                                  onClick={(e) => handleEditFromRow(e, item.id)}
                                  title="แก้ไขข้อมูลงาน"
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '0.3rem' }}
                                >
                                  <Pencil size={16} />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                                  title="ลบงาน"
                                  style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', display: 'flex', padding: '0.3rem' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination -- driven by the API's own pagination object */}
              {!loading && pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    แสดง {((pagination.page - 1) * pagination.limit) + 1} ถึง {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

                    <select
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                      className="glass"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                    >
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                        <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {pagination.totalPages}</option>
                      ))}
                    </select>

                    <button onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === pagination.totalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: แก้ไขข้อมูลงาน -- other canManageWorkflow roles only while
          เปิดงาน, super_admin any status (see canEditRow/the pencil gate
          above), and field access itself differs by role inside the form.
          ---------------------------------------------------- */}
      <AnimatePresence>
        {showEditModal && jobDetails && (
          <JobFormModal
            mode="edit"
            job={jobDetails}
            sites={sites}
            token={token}
            user={user}
            onClose={() => setShowEditModal(false)}
            onSuccess={() => { refetchJobDetails(); fetchJobs(); }}
          />
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: ประวัติของงาน (GET /:id/history) -- row-level action, same
          role gate as canManageWorkflow.
          ---------------------------------------------------- */}
      <AnimatePresence>
        {historyModalJob && (
          <JobHistoryModal
            jobId={historyModalJob.id}
            jobName={historyModalJob.job_name}
            token={token}
            onClose={() => setHistoryModalJob(null)}
          />
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: ยืนยันการลบงาน (DELETE /api/pea-jobs/:id) -- super_admin
          only, same confirm-modal shape as OfficeEquipmentManagement.jsx.
          ---------------------------------------------------- */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
            }}
            onClick={() => !deleting && setItemToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>ยืนยันการลบงาน</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบงาน <strong style={{ color: 'var(--text-primary)' }}>{itemToDelete.job_name || 'นี้'}</strong>?<br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setItemToDelete(null)}
                  disabled={deleting}
                  className="glass"
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', flex: 1 }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDeleteJob}
                  disabled={deleting}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: เริ่มดำเนินการ (PUT /:id/progress)
          ---------------------------------------------------- */}
      <AnimatePresence>
        {showProgressModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card glass"
              style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
            >
              <button onClick={() => setShowProgressModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlayCircle size={20} style={{ color: 'var(--accent-warning)' }} /> เริ่มดำเนินการ
              </h3>
              <form onSubmit={handleProgressSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>ผู้รับผิดชอบ</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {assignees.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="ชื่อผู้รับผิดชอบ"
                            value={a.name}
                            onChange={(e) => updateAssigneeField(i, 'name', e.target.value)}
                            style={{ flex: 1, padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                          />
                          <input
                            type="text"
                            placeholder="รหัสพนักงาน"
                            value={a.emp_id}
                            onChange={(e) => updateAssigneeField(i, 'emp_id', e.target.value)}
                            style={{ width: '140px', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                          />
                          {assignees.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAssigneeRow(i)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                              title="ลบผู้รับผิดชอบรายนี้"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addAssigneeRow}
                      className="glass"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', marginTop: '0.6rem', borderRadius: '0.5rem', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <Plus size={14} /> เพิ่มผู้รับผิดชอบ
                    </button>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>เลขที่คำสั่งปฏิบัติงาน</label>
                    <input type="text" value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>หมายเหตุ</label>
                    <textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={() => setShowProgressModal(false)} className="glass" style={{ padding: '0.6rem 1.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}>ยกเลิก</button>
                  <button type="submit" disabled={workflowSubmitting} style={{ padding: '0.6rem 1.5rem', background: 'var(--accent-warning)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {workflowSubmitting && <Loader2 size={16} className="animate-spin" />} ยืนยัน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: ปิดงาน (PUT /:id/complete + equipment/after-photos/transactions)
          ---------------------------------------------------- */}
      <AnimatePresence>
        {showCompleteModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card glass"
              style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
            >
              <button onClick={() => setShowCompleteModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--accent-success)' }} /> ปิดงาน
              </h3>
              <form onSubmit={handleCompleteSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>หมายเหตุปิดงาน *</label>
                  <textarea required value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={4} placeholder="สรุปผลการดำเนินการ" style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>รายงานผลการดำเนินการ (รูปภาพ/PDF ไม่เกิน 5MB, ไม่บังคับ)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label
                      className="glass"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <Paperclip size={14} /> เลือกไฟล์
                      <input type="file" accept={DOC_INPUT_ACCEPT} onChange={handleCompletionReportChange} style={{ display: 'none' }} />
                    </label>
                    {completionReportFile && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {completionReportFile.name}
                        <X size={12} style={{ cursor: 'pointer' }} onClick={() => setCompletionReportFile(null)} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="card glass" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wrench size={14} /> อุปกรณ์ที่ใช้ดำเนินการ (ไม่บังคับ)
                  </div>
                  <EquipmentPicker
                    siteId={jobDetails?.pea_site_id ? String(jobDetails.pea_site_id) : ''}
                    token={token}
                    selected={usedEquipment}
                    onChange={setUsedEquipment}
                  />
                </div>

                <div className="card glass" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Paperclip size={14} /> รูปหลังดำเนินการ (สูงสุด {MAX_AFTER_PHOTOS} รูป, ไม่บังคับ)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Paperclip size={14} /> เลือกไฟล์
                      <input type="file" accept={[...ALLOWED_PHOTO_TYPES, ...ALLOWED_PHOTO_EXTENSIONS].join(',')} multiple onChange={handleAfterPhotosChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {afterPhotos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                      {afterPhotos.map((file, i) => (
                        <span key={i} className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem' }}>
                          {file.name}
                          <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeAfterPhoto(i)} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card glass" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Receipt size={14} /> ผูกธุรกรรมงบประมาณ (ไม่บังคับ)
                  </div>
                  <BudgetTransactionPicker token={token} selected={linkedTransactions} onChange={setLinkedTransactions} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                  <button type="button" onClick={() => setShowCompleteModal(false)} className="glass" style={{ padding: '0.6rem 1.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}>ยกเลิก</button>
                  <button type="submit" disabled={workflowSubmitting} style={{ padding: '0.6rem 1.5rem', background: 'var(--accent-success)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {workflowSubmitting && <Loader2 size={16} className="animate-spin" />} ยืนยันปิดงาน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: ยกเลิกงาน (PUT /:id/cancel)
          ---------------------------------------------------- */}
      <AnimatePresence>
        {showCancelModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card glass"
              style={{ maxWidth: '480px', width: '100%', padding: '2rem', position: 'relative' }}
            >
              <button onClick={() => setShowCancelModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={20} style={{ color: 'var(--accent-danger)' }} /> ยกเลิกงาน
              </h3>
              <form onSubmit={handleCancelSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>เหตุผลที่ยกเลิก *</label>
                  <textarea required value={cancelledReason} onChange={(e) => setCancelledReason(e.target.value)} rows={4} style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={() => setShowCancelModal(false)} className="glass" style={{ padding: '0.6rem 1.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}>ปิด</button>
                  <button type="submit" disabled={workflowSubmitting} style={{ padding: '0.6rem 1.5rem', background: 'var(--accent-danger)', border: 'none', color: '#fff', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {workflowSubmitting && <Loader2 size={16} className="animate-spin" />} ยืนยันยกเลิกงาน
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default JobManagement;
