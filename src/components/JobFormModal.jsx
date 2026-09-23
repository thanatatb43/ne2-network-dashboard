import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, Loader2, Paperclip, FileText, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import EquipmentPicker from './EquipmentPicker';

// Basic modal accessibility (aria-modal, initial focus, Tab trap, Escape,
// return focus to opener) -- same small local implementation used in
// EquipmentBorrow.jsx / JobReportDetails.jsx; there's no shared Modal
// component yet.
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

const JOB_TYPE_OPTIONS = ['แจ้งซ่อม', 'ขออุปกรณ์ใหม่', 'ขอเปลี่ยนอุปกรณ์', 'แจ้งระบบใช้งานไม่ได้'];
const PRIORITY_OPTIONS = ['ปกติ', 'เร่งด่วน'];
const STATUS_OPTIONS = ['เปิดงาน', 'ระหว่างดำเนินการ', 'เสร็จงาน', 'ยกเลิก'];

// Same size/type limits as the spec's notification-doc endpoint (image or
// PDF, <=5MB). Extensions are checked as a fallback the same way
// EquipmentEdit.jsx does, since file.type isn't always trustworthy.
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

const buildDocUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;

const siteLabel = (s) => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;

const inputStyle = {
  width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)',
  border: '1px solid var(--input-border)', color: 'var(--text-primary)',
  borderRadius: '0.5rem', outline: 'none', fontSize: '0.9rem'
};

const labelStyle = { display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 };

// Same grouped-section wrapper convention as EquipmentEdit.jsx's FormSection.
const FormSection = ({ title, children }) => (
  <div className="card glass" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
  </div>
);

// Job creation is protocol-JSON (needs problem_equipment_ids as a real
// array), unlike the old bare create form which used
// application/x-www-form-urlencoded.
const JobFormModal = ({ mode, job, sites, token, user, onClose, onSuccess }) => {
  const isEdit = mode === 'edit';
  // PUT /api/pea-jobs/:id restricts field access by role -- everyone in
  // canManageWorkflow can edit the "job info"/"requester" fields, but
  // pea_site_id, status, progress_notes, work_order_no, closing_notes,
  // cancelled_reason, notification_doc_file and completion_report_file are
  // super_admin only. Doesn't apply at create time (any logged-in user can
  // open a job, no restricted fields exist yet at that point).
  const isSuperAdmin = user?.role === 'super_admin';
  const canEditSite = !isEdit || isSuperAdmin;

  const [jobName, setJobName] = useState(job?.job_name || '');

  // สำนักงาน is a typeable input+datalist (like the ค้นหาอุปกรณ์ site
  // filter) instead of a plain <select> -- siteId only resolves once the
  // typed text exactly matches a known site's label, same as
  // EquipmentSearch.jsx's site filter.
  const [siteInput, setSiteInput] = useState(() => {
    const match = job?.pea_site_id ? sites.find(s => String(s.id) === String(job.pea_site_id)) : null;
    return match ? siteLabel(match) : '';
  });
  const [siteId, setSiteId] = useState(job?.pea_site_id ? String(job.pea_site_id) : '');

  // sites can still be loading when this modal first mounts in edit mode,
  // so backfill the display text once they arrive if it wasn't resolvable yet.
  useEffect(() => {
    if (!job?.pea_site_id || siteInput) return;
    const match = sites.find(s => String(s.id) === String(job.pea_site_id));
    if (match) setSiteInput(siteLabel(match));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  useEffect(() => {
    const t = setTimeout(() => {
      const match = sites.find(s => siteLabel(s) === siteInput);
      setSiteId(match ? String(match.id) : '');
    }, 300);
    return () => clearTimeout(t);
  }, [siteInput, sites]);

  const [jobType, setJobType] = useState(job?.job_type || JOB_TYPE_OPTIONS[0]);
  const [priority, setPriority] = useState(job?.priority || 'ปกติ');
  const [department, setDepartment] = useState(job?.department || '');
  const [jobDescription, setJobDescription] = useState(job?.job_description || '');
  const [requesterName, setRequesterName] = useState(job?.requester_name || '');
  const [requesterEmpId, setRequesterEmpId] = useState(job?.requester_emp_id || '');
  const [requesterContact, setRequesterContact] = useState(job?.requester_contact || '');
  const [notificationDocNo, setNotificationDocNo] = useState(job?.notification_doc_no || '');
  const [notificationDocFile, setNotificationDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [selectedEquipment, setSelectedEquipment] = useState(job?.problem_equipment || []);

  // Super-admin-only raw override fields -- normally these are set through
  // the dedicated workflow actions (เริ่มดำเนินการ/ปิดงาน/ยกเลิกงาน), this
  // is a direct-edit escape hatch for fixing mistakes, not the primary way
  // to move a job through its status flow.
  const [status, setStatus] = useState(job?.status || STATUS_OPTIONS[0]);
  const [progressNotes, setProgressNotes] = useState(job?.progress_notes || '');
  const [workOrderNo, setWorkOrderNo] = useState(job?.work_order_no || '');
  const [closingNotes, setClosingNotes] = useState(job?.closing_notes || '');
  const [cancelledReason, setCancelledReason] = useState(job?.cancelled_reason || '');
  const [notificationDocFilePath, setNotificationDocFilePath] = useState(job?.notification_doc_file || '');
  const [completionReportFilePath, setCompletionReportFilePath] = useState(job?.completion_report_file || '');

  const [submitting, setSubmitting] = useState(false);

  const panelRef = useRef(null);
  // Escape doesn't close the dialog while a save/upload is genuinely in
  // flight -- same reasoning as EquipmentBorrow.jsx's confirm dialog: the
  // handler reads `submitting`/`uploadingDoc` fresh on every render via the
  // hook's ref, not a closure captured when the dialog opened.
  useModalA11y(true, panelRef, () => { if (!submitting && !uploadingDoc) onClose(); });

  const handleDocFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateDocFile(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }
    setNotificationDocFile(file);
  };

  // Fires after the job record itself is created/updated -- a separate
  // request the same way EquipmentEdit.jsx uploads photos only once the
  // equipment id exists, since a brand-new job doesn't have one yet at
  // submit time. Upload failure doesn't roll back the job save; it just
  // gets its own toast so the user knows to retry the attachment.
  const uploadNotificationDoc = async (jobId) => {
    if (!notificationDocFile) return;
    setUploadingDoc(true);
    try {
      const body = new FormData();
      body.append('notification_doc', notificationDocFile);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}/notification-doc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message || result.error || 'แนบไฟล์หนังสือแจ้งไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error uploading notification doc:', error);
      toast.error('เกิดข้อผิดพลาดในการแนบไฟล์หนังสือแจ้ง');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobName.trim()) { toast.error('กรุณาระบุชื่องาน'); return; }
    if (!siteId) { toast.error('กรุณาพิมพ์หรือเลือกสำนักงาน ให้ตรงกับรายการที่แนะนำ'); return; }
    if (!jobDescription.trim()) { toast.error('กรุณาระบุรายละเอียดงาน'); return; }

    setSubmitting(true);
    try {
      const body = {
        job_name: jobName.trim(),
        job_description: jobDescription.trim(),
        job_type: jobType,
        priority,
        department: department.trim(),
        requester_name: requesterName.trim(),
        requester_emp_id: requesterEmpId.trim(),
        requester_contact: requesterContact.trim(),
        notification_doc_no: notificationDocNo.trim(),
        problem_equipment_ids: selectedEquipment.map(e => e.id)
      };
      // pea_site_id is only touchable by super_admin once a job already
      // exists -- at create time (or for super_admin editing) it's always
      // included since canEditSite covers both cases.
      if (canEditSite) body.pea_site_id = Number(siteId);
      if (isEdit && isSuperAdmin) {
        body.status = status;
        body.progress_notes = progressNotes.trim();
        body.work_order_no = workOrderNo.trim();
        body.closing_notes = closingNotes.trim();
        body.cancelled_reason = cancelledReason.trim();
        body.notification_doc_file = notificationDocFilePath.trim();
        body.completion_report_file = completionReportFilePath.trim();
      }

      const url = isEdit
        ? `${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${job.id}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (response.ok && (result.success !== false)) {
        toast.success(result.message || (isEdit ? 'บันทึกข้อมูลงานสำเร็จ' : 'แจ้งปัญหาสำเร็จ'));
        const savedJob = result.data || result;
        const jobId = isEdit ? job.id : savedJob?.id;
        if (jobId) await uploadNotificationDoc(jobId);
        onSuccess && onSuccess(savedJob);
        onClose();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถบันทึกข้อมูลงานได้');
      }
    } catch (error) {
      console.error('Error submitting job form:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-form-modal-title"
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card glass"
        style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
      >
        <button
          onClick={() => { if (!submitting && !uploadingDoc) onClose(); }}
          aria-label="ปิด"
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <h2 id="job-form-modal-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.4rem' }} className="krub-bold">
          {isEdit ? 'แก้ไขข้อมูลงาน' : 'แจ้งปัญหาใหม่'}
        </h2>

        <form onSubmit={handleSubmit}>
          <FormSection title="ข้อมูลงาน">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="job-form-name">ชื่องาน *</label>
                <input id="job-form-name" type="text" required value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="เช่น เครื่องพิมพ์เสีย ชั้น 2" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-site">สำนักงาน *</label>
                <input
                  id="job-form-site"
                  type="text"
                  required
                  disabled={!canEditSite}
                  title={!canEditSite ? 'เปลี่ยนสำนักงานได้เฉพาะ super_admin' : undefined}
                  list="job-form-site-options"
                  placeholder="พิมพ์ชื่อสาขา..."
                  value={siteInput}
                  onChange={(e) => setSiteInput(e.target.value)}
                  style={{ ...inputStyle, ...(!canEditSite ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                />
                <datalist id="job-form-site-options">
                  {sites.map(s => <option key={s.id} value={siteLabel(s)} />)}
                </datalist>
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-type">ประเภทงาน</label>
                <select id="job-form-type" value={jobType} onChange={(e) => setJobType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-priority">ความสำคัญ</label>
                <select id="job-form-priority" value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-department">แผนก</label>
                <input id="job-form-department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="job-form-description">รายละเอียดงาน *</label>
              <textarea id="job-form-description" required value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={3} placeholder="อธิบายปัญหาที่พบ" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </FormSection>

          <FormSection title="ผู้แจ้ง">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="job-form-requester-name">ชื่อผู้แจ้ง</label>
                <input id="job-form-requester-name" type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-requester-emp-id">รหัสพนักงานผู้แจ้ง</label>
                <input id="job-form-requester-emp-id" type="text" value={requesterEmpId} onChange={(e) => setRequesterEmpId(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-requester-contact">เบอร์ติดต่อ</label>
                <input id="job-form-requester-contact" type="text" value={requesterContact} onChange={(e) => setRequesterContact(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-doc-no">เลขที่หนังสือแจ้ง</label>
                <input id="job-form-doc-no" type="text" value={notificationDocNo} onChange={(e) => setNotificationDocNo(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <div style={labelStyle}>ไฟล์หนังสือแจ้ง (รูปภาพ/PDF ไม่เกิน 5MB)</div>
              {job?.notification_doc_file && !notificationDocFile && (
                <a
                  href={buildDocUrl(job.notification_doc_file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}
                >
                  <FileText size={14} /> ไฟล์ปัจจุบัน <ExternalLink size={12} />
                </a>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label
                  className="glass"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <Paperclip size={14} /> เลือกไฟล์
                  <input type="file" accept={DOC_INPUT_ACCEPT} onChange={handleDocFileChange} style={{ display: 'none' }} />
                </label>
                {notificationDocFile && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {notificationDocFile.name}
                    <button type="button" onClick={() => setNotificationDocFile(null)} aria-label="เอาไฟล์ที่เลือกออก" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 0 }}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="อุปกรณ์ที่มีปัญหา">
            <EquipmentPicker siteId={siteId} token={token} selected={selectedEquipment} onChange={setSelectedEquipment} />
          </FormSection>

          {isEdit && isSuperAdmin && (
            <FormSection title="แก้ไขข้อมูลขั้นสูง (Super Admin)">
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ส่วนนี้แก้ไขข้อมูลเบื้องหลังโดยตรง แนะนำให้ใช้ปุ่มดำเนินการ (เริ่มดำเนินการ/ปิดงาน/ยกเลิกงาน) แทนหากทำได้ -- ใช้ส่วนนี้เฉพาะกรณีต้องแก้ไขข้อมูลที่ผิดพลาด
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle} htmlFor="job-form-status">สถานะ</label>
                  <select id="job-form-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="job-form-work-order">เลขที่คำสั่งปฏิบัติงาน</label>
                  <input id="job-form-work-order" type="text" value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-progress-notes">หมายเหตุความคืบหน้า</label>
                <textarea id="job-form-progress-notes" value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-closing-notes">หมายเหตุปิดงาน</label>
                <textarea id="job-form-closing-notes" value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="job-form-cancelled-reason">เหตุผลที่ยกเลิก</label>
                <textarea id="job-form-cancelled-reason" value={cancelledReason} onChange={(e) => setCancelledReason(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle} htmlFor="job-form-doc-path">ไฟล์หนังสือแจ้ง (path ไฟล์โดยตรง)</label>
                  <input id="job-form-doc-path" type="text" value={notificationDocFilePath} onChange={(e) => setNotificationDocFilePath(e.target.value)} placeholder="/uploads/pea-jobs/..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="job-form-report-path">รายงานผลการดำเนินการ (path ไฟล์โดยตรง)</label>
                  <input id="job-form-report-path" type="text" value={completionReportFilePath} onChange={(e) => setCompletionReportFilePath(e.target.value)} placeholder="/uploads/pea-jobs/..." style={inputStyle} />
                </div>
              </div>
            </FormSection>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            <button
              type="button"
              disabled={submitting || uploadingDoc}
              onClick={onClose}
              className="glass"
              style={{ padding: '0.6rem 1.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingDoc}
              className="glass font-bold"
              style={{
                padding: '0.6rem 1.5rem', background: 'var(--accent-primary)',
                border: 'none', color: '#fff', borderRadius: '0.5rem',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              {(submitting || uploadingDoc) && <Loader2 size={16} className="animate-spin" />}
              {uploadingDoc ? 'กำลังแนบไฟล์...' : (isEdit ? 'บันทึกการแก้ไข' : 'ส่งเรื่องแจ้งปัญหา')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default JobFormModal;
