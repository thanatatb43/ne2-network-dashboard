import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Loader2, Repeat } from 'lucide-react';
import ModalFrame from './common/ModalFrame.jsx';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';

const API = import.meta.env.VITE_API_BASE_URL;
const todayStr = () => new Date().toISOString().slice(0, 10);

// <input type="datetime-local"> has no timezone; the backend expects
// Thailand local time, so it is sent explicitly as +07:00.
const toBangkokIso = (value) => (value ? `${value}:00+07:00` : '');

const formatDueDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const EMPTY_BORROW = { name: '', empId: '', contact: '', due: '', notes: '' };

// Borrow if the item is free, return if it has an open loan. The caller has
// already confirmed the user is logged in.
const BorrowReturnModal = ({ equipmentId, equipmentName, token, onClose, onChanged }) => {
  const id = useId();
  const [status, setStatus] = useState({ state: 'loading', loan: null });
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [borrow, setBorrow] = useState(EMPTY_BORROW);
  const [returnedAt, setReturnedAt] = useState(todayStr);
  const [returnNotes, setReturnNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const bodyRef = useRef(null);
  const errorRef = useRef(null);

  // Content swaps (loading -> form, submit -> error) would otherwise drop
  // focus to <body> while the dialog is still open.
  useEffect(() => {
    if (status.state === 'ready') bodyRef.current?.querySelector('input, textarea')?.focus();
  }, [status.state]);
  useEffect(() => { if (submitError) errorRef.current?.focus(); }, [submitError]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/office-equipment/${equipmentId}/loans`, { signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => null);
        const loans = Array.isArray(body) ? body : body?.data;
        if (!res.ok || !Array.isArray(loans)) throw new Error('bad response');
        setStatus({ state: 'ready', loan: loans.find(l => l && !l.returned_at) || null });
      })
      // Unknown loan state must not fall through to the borrow form.
      .catch(() => { if (!controller.signal.aborted) setStatus({ state: 'error', loan: null }); });
    return () => controller.abort();
  }, [equipmentId, attempt]);

  const recheck = () => { setStatus({ state: 'loading', loan: null }); setSubmitError(''); setAttempt(n => n + 1); };
  const openLoan = status.loan;
  const dirty = openLoan
    ? returnNotes.trim() !== '' || returnedAt !== todayStr()
    : Object.values(borrow).some(v => v.trim() !== '');

  const requestClose = useCallback(() => {
    if (submitting) return;
    if (dirty) setConfirmClose(true); else onClose();
  }, [submitting, dirty, onClose]);

  const send = async (path, params, successText) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API}/api/office-equipment/${equipmentId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${token}` },
        body: params.toString()
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        const message = res.status === 401 ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : res.status === 403 ? 'คุณไม่มีสิทธิ์ดำเนินการนี้' : body?.message || body?.error || 'บันทึกไม่สำเร็จ';
        setSubmitError(message);
        return;
      }
      toast.success(body?.message || successText);
      onChanged && onChanged();
    } catch {
      setSubmitError('ไม่ได้รับคำตอบจากเซิร์ฟเวอร์ ไม่ทราบว่าบันทึกสำเร็จหรือไม่ — กด "ตรวจสอบสถานะอีกครั้ง" ก่อนบันทึกซ้ำ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBorrow = (e) => {
    e.preventDefault();
    if (!borrow.name.trim()) { setErrors({ name: 'กรุณากรอกชื่อผู้ยืม' }); document.getElementById(`${id}-name`)?.focus(); return; }
    setErrors({});
    const p = new URLSearchParams();
    p.append('borrower_name', borrow.name.trim());
    p.append('borrower_emp_id', borrow.empId.trim());
    p.append('borrower_contact', borrow.contact.trim());
    p.append('due_date', toBangkokIso(borrow.due));
    p.append('notes', borrow.notes.trim());
    send('borrow', p, 'บันทึกการยืมสำเร็จ');
  };

  const handleReturn = (e) => {
    e.preventDefault();
    if (!returnedAt) { setErrors({ returned: 'กรุณาเลือกวันที่คืน' }); document.getElementById(`${id}-returned`)?.focus(); return; }
    setErrors({});
    const p = new URLSearchParams();
    p.append('returned_at', returnedAt);
    p.append('notes', returnNotes.trim());
    send('return', p, 'บันทึกการคืนสำเร็จ');
  };

  const field = (key, label, input, { required, hint } = {}) => (
    <div className={`mf-field${errors[key] ? ' is-invalid' : ''}`}>
      <label htmlFor={`${id}-${key}`}>{label}{required && <span aria-hidden="true" className="br-required"> *</span>}{required && <span className="mf-sr-only"> (จำเป็น)</span>}</label>
      {input}
      {hint && <p className="mf-meta" id={`${id}-${key}-hint`}>{hint}</p>}
      {errors[key] && <p className="mf-field-error" id={`${id}-${key}-error`}>{errors[key]}</p>}
    </div>
  );
  const bind = (key) => ({
    id: `${id}-${key}`,
    value: borrow[key],
    onChange: (e) => { setBorrow(prev => ({ ...prev, [key]: e.target.value })); if (errors[key]) setErrors({}); },
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined
  });

  const title = status.state !== 'ready' ? 'ยืม / คืนอุปกรณ์' : openLoan ? 'คืนอุปกรณ์' : 'ยืมอุปกรณ์';
  const icon = openLoan ? <ArrowLeftRight size={20} aria-hidden="true" /> : <Repeat size={20} aria-hidden="true" />;

  return (
    <ModalFrame title={title} icon={icon} subtitle={equipmentName} busy={submitting} guardClose={dirty} onClose={requestClose}>
      {status.state === 'loading' ? (
        <p className="mf-state" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> กำลังตรวจสอบสถานะการยืม...</p>
      ) : status.state === 'error' ? (
        <div className="mf-error" role="alert">
          <p>ตรวจสอบสถานะการยืมไม่สำเร็จ จึงยังไม่แสดงฟอร์มยืมหรือคืน</p>
          <button type="button" className="mf-button" onClick={recheck}>ลองใหม่</button>
        </div>
      ) : (
        <div ref={bodyRef}>
          {submitError && (
            <div className="mf-error br-submit-error" role="alert" tabIndex={-1} ref={errorRef}>
              <p>{submitError}</p>
              <button type="button" className="mf-button" onClick={recheck} disabled={submitting}>ตรวจสอบสถานะอีกครั้ง</button>
            </div>
          )}
          {openLoan ? (
            <form onSubmit={handleReturn} noValidate>
              <p className="br-loan">กำลังถูกยืมโดย <strong>{openLoan.borrower_name || '—'}</strong>{openLoan.due_date && <> · กำหนดคืน {formatDueDate(openLoan.due_date)}</>}</p>
              {field('returned', 'วันที่คืน', <input type="date" id={`${id}-returned`} value={returnedAt} onChange={e => { setReturnedAt(e.target.value); setErrors({}); }} aria-invalid={errors.returned ? 'true' : undefined} aria-describedby={errors.returned ? `${id}-returned-error` : undefined} />, { required: true })}
              {field('rnotes', 'หมายเหตุ (ถ้ามี)', <textarea id={`${id}-rnotes`} rows={2} value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />)}
              <div className="mf-actions">
                <button type="button" className="mf-button" onClick={requestClose} disabled={submitting}>ยกเลิก</button>
                <button type="submit" className="mf-button mf-warning" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowLeftRight size={18} aria-hidden="true" />} {submitting ? 'กำลังบันทึก...' : 'ยืนยันการคืน'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBorrow} noValidate>
              {field('name', 'ชื่อผู้ยืม', <input type="text" autoComplete="off" placeholder="ชื่อ-นามสกุล" {...bind('name')} />, { required: true })}
              {field('empId', 'รหัสพนักงานผู้ยืม', <input type="text" autoComplete="off" {...bind('empId')} />)}
              {field('contact', 'เบอร์ติดต่อผู้ยืม', <input type="tel" autoComplete="off" {...bind('contact')} />)}
              {field('due', 'กำหนดคืน (วันและเวลา)', <input type="datetime-local" {...bind('due')} />, { hint: 'เวลาประเทศไทย' })}
              {field('notes', 'หมายเหตุ', <textarea rows={2} {...bind('notes')} />)}
              <div className="mf-actions">
                <button type="button" className="mf-button" onClick={requestClose} disabled={submitting}>ยกเลิก</button>
                <button type="submit" className="mf-button mf-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Repeat size={18} aria-hidden="true" />} {submitting ? 'กำลังบันทึก...' : 'ยืนยันการยืม'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      <ConfirmDialog open={confirmClose} title="ทิ้งข้อมูลที่กรอกไว้?" tone="danger" confirmLabel="ทิ้งข้อมูล" cancelLabel="กลับไปกรอกต่อ"
        message="ข้อมูลในฟอร์มยังไม่ได้บันทึก" onConfirm={() => { setConfirmClose(false); onClose(); }} onCancel={() => setConfirmClose(false)} />
    </ModalFrame>
  );
};

export default BorrowReturnModal;
