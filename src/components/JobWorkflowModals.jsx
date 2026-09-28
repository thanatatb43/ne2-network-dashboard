import { useId, useRef, useState } from 'react';
import { Loader2, PlayCircle, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import ModalFrame from './common/ModalFrame.jsx';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import EquipmentPicker from './EquipmentPicker';
import BudgetTransactionPicker from './BudgetTransactionPicker';
import { useLeaveGuard, BUSY_LEAVE_MESSAGE } from '../navigationGuard';
import './JobManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;

// After-photos: images only, up to 5, ≤5MB each (same as EquipmentEdit).
const MAX_AFTER_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
// Completion report: image or PDF, ≤5MB (same as JobFormModal's notification doc).
const DOC_TYPES = [...PHOTO_TYPES, 'application/pdf'];
const DOC_EXTS = [...PHOTO_EXTS, '.pdf'];

const fileProblem = (file, types, exts, what) => {
  const okType = types.includes(file.type) || exts.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (!okType) return `ไฟล์ "${file.name}" ต้องเป็น${what}`;
  if (file.size > MAX_FILE_SIZE) return `ไฟล์ "${file.name}" มีขนาดเกิน 5MB`;
  return '';
};

const failureMessage = (response, result, fallback) => {
  if (response?.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ ข้อมูลที่กรอกยังอยู่ในฟอร์มนี้';
  if (response?.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับงานนี้';
  return result?.message || result?.error || fallback;
};

// Sends one request and returns { ok, message } instead of throwing, so the
// caller can keep the draft and show the reason inline.
const send = async (url, init, fallback) => {
  try {
    const response = await fetch(url, init);
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success !== false) return { ok: true, message: result.message };
    return { ok: false, message: failureMessage(response, result, fallback) };
  } catch {
    return { ok: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ในฟอร์มนี้' };
  }
};

// ModalFrame plus a "discard what you typed?" step: closing with unsaved
// input asks first; while a request is running nothing closes the dialog.
// Leaving the page (menu, Back/Forward, reload) asks too.
function WorkflowFrame({ title, icon, subtitle, size = 'lg', dirty, busy, onClose, children }) {
  const [confirming, setConfirming] = useState(false);
  useLeaveGuard(dirty || busy, { message: busy ? BUSY_LEAVE_MESSAGE : 'ข้อมูลที่กรอกในหน้าต่าง "' + title + '" จะหายไป และสถานะงานจะไม่เปลี่ยน' });
  const requestClose = () => (dirty ? setConfirming(true) : onClose());
  return (
    <>
      <ModalFrame title={title} icon={icon} subtitle={subtitle} size={size} busy={busy} guardClose={dirty} onClose={requestClose}>
        {children(requestClose)}
      </ModalFrame>
      <ConfirmDialog
        open={confirming}
        title="ทิ้งข้อมูลที่กรอก?"
        message="ข้อมูลที่กรอกในหน้าต่างนี้จะหายไป และสถานะงานจะไม่เปลี่ยน"
        confirmLabel="ทิ้งข้อมูล"
        cancelLabel="กรอกต่อ"
        tone="danger"
        onConfirm={() => { setConfirming(false); onClose(); }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

const SubmitError = ({ message }) => (message ? <div className="mf-error jw-submit-error" role="alert"><p>{message}</p></div> : null);

// ---------------------------------------------------------------------------
// เริ่มดำเนินการ -- PUT /api/pea-jobs/:id/progress
// ---------------------------------------------------------------------------
export function ProgressModal({ job, token, user, onClose, onDone }) {
  const id = useId();
  // The person starting the job is very often the first assignee, so the
  // first row starts with the logged-in user (still editable/removable).
  const [initial] = useState(() => ({
    assignees: [{ name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || ''), emp_id: user?.username || '' }],
    workOrderNo: '',
    notes: ''
  }));
  const [assignees, setAssignees] = useState(initial.assignees);
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(assignees) !== JSON.stringify(initial.assignees) || workOrderNo !== '' || notes !== '';

  const update = (index, field, value) => setAssignees((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await send(`${API}/api/pea-jobs/${job.id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        assignees: assignees.filter((a) => a.name.trim() || a.emp_id.trim()).map((a) => ({ name: a.name.trim(), emp_id: a.emp_id.trim() })),
        progress_notes: notes.trim(),
        work_order_no: workOrderNo.trim()
      })
    }, 'เริ่มดำเนินการไม่สำเร็จ');
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onDone({ message: result.message || 'เริ่มดำเนินการแล้ว' });
  };

  return (
    <WorkflowFrame
      title="เริ่มดำเนินการ"
      icon={<PlayCircle size={20} aria-hidden="true" />}
      subtitle={`${job.job_name || `งาน #${job.id}`} · สถานะจะเปลี่ยนจาก "เปิดงาน" เป็น "ระหว่างดำเนินการ"`}
      dirty={dirty}
      busy={busy}
      onClose={onClose}
    >
      {(requestClose) => (
        <form onSubmit={submit} noValidate>
          <SubmitError message={error} />
          <fieldset className="jw-fieldset">
            <legend>ผู้รับผิดชอบ</legend>
            <ul className="jw-assignees">
              {assignees.map((a, i) => (
                <li key={i}>
                  <div className="mf-field">
                    <label htmlFor={`${id}-name-${i}`}>ชื่อ-สกุล{assignees.length > 1 ? ` คนที่ ${i + 1}` : ''}</label>
                    <input id={`${id}-name-${i}`} type="text" value={a.name} onChange={(e) => update(i, 'name', e.target.value)} autoComplete="off" />
                  </div>
                  <div className="mf-field jw-empid">
                    <label htmlFor={`${id}-emp-${i}`}>รหัสพนักงาน</label>
                    <input id={`${id}-emp-${i}`} type="text" inputMode="numeric" value={a.emp_id} onChange={(e) => update(i, 'emp_id', e.target.value)} autoComplete="off" />
                  </div>
                  {assignees.length > 1 && (
                    <button type="button" className="jw-icon-button" onClick={() => setAssignees((prev) => prev.filter((_, j) => j !== i))} aria-label={`นำผู้รับผิดชอบคนที่ ${i + 1} ออก`}>
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="mf-button" onClick={() => setAssignees((prev) => [...prev, { name: '', emp_id: '' }])}>
              <Plus size={16} aria-hidden="true" /> เพิ่มผู้รับผิดชอบ
            </button>
            <p className="mf-meta jw-help">แถวที่ไม่ได้กรอกทั้งชื่อและรหัสจะไม่ถูกบันทึก</p>
          </fieldset>
          <div className="mf-field">
            <label htmlFor={`${id}-wo`}>เลขที่คำสั่งปฏิบัติงาน</label>
            <input id={`${id}-wo`} type="text" value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} />
          </div>
          <div className="mf-field">
            <label htmlFor={`${id}-notes`}>หมายเหตุ</label>
            <textarea id={`${id}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="mf-button mf-primary" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} ยืนยันเริ่มดำเนินการ
            </button>
          </div>
        </form>
      )}
    </WorkflowFrame>
  );
}

// ---------------------------------------------------------------------------
// ปิดงาน -- PUT /api/pea-jobs/:id/complete (multipart, with the optional
// completion report), then the optional follow-ups: equipment used,
// after-photos and linked budget transactions.
// ---------------------------------------------------------------------------
export function CompleteModal({ job, token, onClose, onDone }) {
  const id = useId();
  const notesRef = useRef(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photosError, setPhotosError] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = Boolean(notes || report || photos.length || equipment.length || transactions.length);

  const pickReport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = fileProblem(file, DOC_TYPES, DOC_EXTS, 'รูปภาพ (jpeg/png/webp/gif) หรือ PDF');
    setReportError(problem);
    if (!problem) setReport(file);
  };

  const pickPhotos = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_AFTER_PHOTOS) {
      setPhotosError(`แนบรูปได้สูงสุด ${MAX_AFTER_PHOTOS} รูป (เลือกไว้แล้ว ${photos.length} รูป)`);
      return;
    }
    const problem = files.map((f) => fileProblem(f, PHOTO_TYPES, PHOTO_EXTS, 'รูปภาพ (jpeg/png/webp/gif)')).find(Boolean) || '';
    setPhotosError(problem);
    if (!problem) setPhotos((prev) => [...prev, ...files]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!notes.trim()) {
      setNotesError('กรุณาระบุหมายเหตุปิดงาน');
      notesRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    // multipart so the completion report rides along; no manual Content-Type
    // so the browser sets the boundary.
    const body = new FormData();
    body.append('closing_notes', notes.trim());
    if (report) body.append('completion_report', report);
    const auth = { Authorization: `Bearer ${token}` };
    const closed = await send(`${API}/api/pea-jobs/${job.id}/complete`, { method: 'PUT', headers: auth, body }, 'ปิดงานไม่สำเร็จ');
    if (!closed.ok) { setBusy(false); setError(closed.message); return; }

    // The job is closed now; each follow-up runs on its own so one failing
    // doesn't block the others, and failures are reported on the job page.
    const followUps = [];
    if (equipment.length) {
      followUps.push(send(`${API}/api/pea-jobs/${job.id}/equipment`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_ids: equipment.map((x) => x.id) })
      }, 'บันทึกไม่สำเร็จ').then((r) => (r.ok ? null : `อุปกรณ์ที่ใช้ดำเนินการ ${equipment.length} รายการ: ${r.message}`)));
    }
    if (photos.length) {
      const form = new FormData();
      photos.forEach((file) => form.append('photos', file));
      followUps.push(send(`${API}/api/pea-jobs/${job.id}/after-photos`, { method: 'POST', headers: auth, body: form }, 'อัปโหลดไม่สำเร็จ')
        .then((r) => (r.ok ? null : `รูปหลังดำเนินการ ${photos.length} รูป: ${r.message}`)));
    }
    if (transactions.length) {
      followUps.push(send(`${API}/api/pea-jobs/transactions`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pea_site_id: job.pea_site_id, pea_job_id: job.id, budget_transaction_ids: transactions.map((t) => t.id) })
      }, 'ผูกไม่สำเร็จ').then((r) => (r.ok ? null : `ธุรกรรมงบประมาณ ${transactions.length} รายการ (${transactions.map((t) => t.reference_doc_no || t.id).join(', ')}): ${r.message}`)));
    }
    const warnings = (await Promise.all(followUps)).filter(Boolean);
    setBusy(false);
    onDone({ message: closed.message || 'ปิดงานสำเร็จ', warnings });
  };

  return (
    <WorkflowFrame
      title="ปิดงาน"
      icon={<CheckCircle2 size={20} aria-hidden="true" />}
      subtitle={`${job.job_name || `งาน #${job.id}`} · สถานะจะเปลี่ยนเป็น "เสร็จงาน" และแก้ไขผลการปิดงานจากหน้านี้ไม่ได้อีก`}
      size="xl"
      dirty={dirty}
      busy={busy}
      onClose={onClose}
    >
      {(requestClose) => (
        <form onSubmit={submit} noValidate>
          <SubmitError message={error} />
          <div className={`mf-field${notesError ? ' is-invalid' : ''}`}>
            <label htmlFor={`${id}-notes`}>หมายเหตุปิดงาน <span className="br-required" aria-hidden="true">*</span></label>
            <textarea
              ref={notesRef} id={`${id}-notes`} rows={4} value={notes} required
              placeholder="สรุปผลการดำเนินการ"
              aria-invalid={notesError ? 'true' : undefined}
              aria-describedby={notesError ? `${id}-notes-error` : undefined}
              onChange={(e) => { setNotes(e.target.value); if (notesError && e.target.value.trim()) setNotesError(''); }}
            />
            {notesError && <p id={`${id}-notes-error`} className="mf-field-error">{notesError}</p>}
          </div>

          <div className={`mf-field${reportError ? ' is-invalid' : ''}`}>
            <label htmlFor={`${id}-report`}>รายงานผลการดำเนินการ (ไม่บังคับ)</label>
            <input id={`${id}-report`} className="jw-file" type="file" accept={[...DOC_TYPES, ...DOC_EXTS].join(',')} onChange={pickReport} aria-describedby={`${id}-report-help${reportError ? ` ${id}-report-error` : ''}`} />
            <p id={`${id}-report-help`} className="mf-meta">รูปภาพหรือ PDF ไม่เกิน 5MB ส่งไปพร้อมการปิดงาน</p>
            {reportError && <p id={`${id}-report-error`} className="mf-field-error" role="alert">{reportError}</p>}
            {report && (
              <ul className="jp-chips">
                <li className="jp-chip"><span>{report.name}</span><button type="button" onClick={() => setReport(null)} aria-label={`นำไฟล์ ${report.name} ออก`}><X size={14} aria-hidden="true" /></button></li>
              </ul>
            )}
          </div>

          <p className="jw-optional-title">ข้อมูลเพิ่มเติม (ไม่บังคับ) — บันทึกต่อจากการปิดงาน ถ้าส่วนใดไม่สำเร็จ งานจะยังปิดแล้วและจะแจ้งรายการที่ไม่สำเร็จในหน้างาน</p>

          <fieldset className="jw-fieldset">
            <legend>อุปกรณ์ที่ใช้ดำเนินการ</legend>
            <EquipmentPicker siteId={job.pea_site_id ? String(job.pea_site_id) : ''} token={token} selected={equipment} onChange={setEquipment} label="ค้นหาอุปกรณ์ที่ใช้ดำเนินการ" emptySiteHint="งานนี้ไม่ได้ระบุสำนักงาน จึงเลือกอุปกรณ์ไม่ได้" />
          </fieldset>

          <fieldset className={`jw-fieldset${photosError ? ' is-invalid' : ''}`}>
            <legend>รูปหลังดำเนินการ</legend>
            <label className="jw-file-label" htmlFor={`${id}-photos`}>เลือกรูป (สูงสุด {MAX_AFTER_PHOTOS} รูป ไม่เกินรูปละ 5MB)</label>
            <input id={`${id}-photos`} className="jw-file" type="file" multiple accept={[...PHOTO_TYPES, ...PHOTO_EXTS].join(',')} onChange={pickPhotos} disabled={photos.length >= MAX_AFTER_PHOTOS} aria-describedby={photosError ? `${id}-photos-error` : undefined} />
            {photosError && <p id={`${id}-photos-error`} className="mf-field-error" role="alert">{photosError}</p>}
            {photos.length > 0 && (
              <ul className="jp-chips">
                {photos.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="jp-chip"><span>{file.name}</span><button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label={`นำรูป ${file.name} ออก`}><X size={14} aria-hidden="true" /></button></li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className="jw-fieldset">
            <legend>ผูกธุรกรรมงบประมาณ</legend>
            <BudgetTransactionPicker token={token} selected={transactions} onChange={setTransactions} currentJobId={job.id} />
          </fieldset>

          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="mf-button mf-primary" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {busy ? 'กำลังปิดงาน…' : 'ยืนยันปิดงาน'}
            </button>
          </div>
        </form>
      )}
    </WorkflowFrame>
  );
}

// ---------------------------------------------------------------------------
// ยกเลิกงาน -- PUT /api/pea-jobs/:id/cancel
// ---------------------------------------------------------------------------
export function CancelModal({ job, token, onClose, onDone }) {
  const id = useId();
  const reasonRef = useRef(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!reason.trim()) {
      setReasonError('กรุณาระบุเหตุผลที่ยกเลิก');
      reasonRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    const result = await send(`${API}/api/pea-jobs/${job.id}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cancelled_reason: reason.trim() })
    }, 'ยกเลิกงานไม่สำเร็จ');
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onDone({ message: result.message || 'ยกเลิกงานแล้ว' });
  };

  return (
    <WorkflowFrame
      title="ยกเลิกงาน"
      icon={<XCircle size={20} aria-hidden="true" />}
      subtitle={`${job.job_name || `งาน #${job.id}`} · สถานะจะเปลี่ยนจาก "${job.status}" เป็น "ยกเลิก" และดำเนินการต่อจากหน้านี้ไม่ได้อีก`}
      size="md"
      dirty={Boolean(reason)}
      busy={busy}
      onClose={onClose}
    >
      {(requestClose) => (
        <form onSubmit={submit} noValidate>
          <SubmitError message={error} />
          <div className={`mf-field${reasonError ? ' is-invalid' : ''}`}>
            <label htmlFor={`${id}-reason`}>เหตุผลที่ยกเลิก <span className="br-required" aria-hidden="true">*</span></label>
            <textarea
              ref={reasonRef} id={`${id}-reason`} rows={4} value={reason} required
              aria-invalid={reasonError ? 'true' : undefined}
              aria-describedby={reasonError ? `${id}-reason-error` : undefined}
              onChange={(e) => { setReason(e.target.value); if (reasonError && e.target.value.trim()) setReasonError(''); }}
            />
            {reasonError && <p id={`${id}-reason-error`} className="mf-field-error">{reasonError}</p>}
          </div>
          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ไม่ยกเลิกงาน</button>
            <button type="submit" className="mf-button jw-danger" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} ยืนยันยกเลิกงาน
            </button>
          </div>
        </form>
      )}
    </WorkflowFrame>
  );
}
