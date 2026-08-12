import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Loader2, Repeat, ArrowLeftRight } from 'lucide-react';

const todayStr = () => new Date().toISOString().slice(0, 10);

// due_date is a full timestamp now (not just a date), so it can carry a
// return TIME too. <input type="datetime-local"> gives back a naive
// "YYYY-MM-DDTHH:mm" string with no timezone info -- rather than let the
// browser's own guess decide what that means, treat it explicitly as
// Thailand local time (+07:00), matching what the backend expects and
// avoiding a silently-wrong due time on any client whose OS clock isn't
// set to Asia/Bangkok.
const toBangkokIso = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return '';
  return `${datetimeLocalValue}:00+07:00`;
};

const formatDueDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const inputStyle = {
  width: '100%',
  padding: '0.7rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none'
};

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.9rem' };
const labelStyle = { fontSize: '0.8rem', color: 'var(--text-secondary)' };

// Shared by the equipment list (StockManagement) and the equipment detail
// page -- fetches whether this item currently has an open loan
// (returned_at not set) and shows the matching form: borrow if free,
// return if not. Requires the caller to have already confirmed the user is
// logged in (both actions need auth); this component doesn't itself
// redirect to login.
const BorrowReturnModal = ({ equipmentId, equipmentName, token, onClose, onChanged }) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [openLoan, setOpenLoan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmpId, setBorrowerEmpId] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [borrowNotes, setBorrowNotes] = useState('');

  const [returnedAt, setReturnedAt] = useState(todayStr());
  const [returnNotes, setReturnNotes] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      setLoadingStatus(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/loans`);
        const result = await res.json();
        const loans = result.data || result;
        const open = Array.isArray(loans) ? loans.find(l => !l.returned_at) : null;
        setOpenLoan(open || null);
      } catch (err) {
        console.error('Failed to load loan status:', err);
        toast.error('ไม่สามารถตรวจสอบสถานะการยืมได้');
      } finally {
        setLoadingStatus(false);
      }
    };
    fetchStatus();
  }, [equipmentId]);

  const handleBorrow = async (e) => {
    e.preventDefault();
    if (!borrowerName.trim()) {
      toast.error('กรุณากรอกชื่อผู้ยืม');
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append('borrower_name', borrowerName.trim());
      params.append('borrower_emp_id', borrowerEmpId.trim());
      params.append('borrower_contact', borrowerContact.trim());
      params.append('due_date', toBangkokIso(dueDate));
      params.append('notes', borrowNotes.trim());

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/borrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: params.toString()
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || 'บันทึกการยืมสำเร็จ');
        onChanged && onChanged();
      } else {
        toast.error(result.message || result.error || 'บันทึกการยืมไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Failed to borrow equipment:', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append('returned_at', returnedAt);
      params.append('notes', returnNotes.trim());

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: params.toString()
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || 'บันทึกการคืนสำเร็จ');
        onChanged && onChanged();
      } else {
        // e.g. 400 when there's no open loan (already returned by someone else meanwhile)
        toast.error(result.message || result.error || 'บันทึกการคืนไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Failed to return equipment:', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
      }}
      onClick={() => !submitting && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="card glass"
        style={{ padding: '1.5rem', maxWidth: '380px', width: '100%', borderRadius: '0.75rem', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {loadingStatus ? <Repeat size={18} /> : openLoan ? <ArrowLeftRight size={18} color="var(--accent-warning)" /> : <Repeat size={18} color="var(--accent-primary)" />}
            {loadingStatus ? 'กำลังตรวจสอบสถานะ...' : openLoan ? 'คืนอุปกรณ์' : 'ยืมอุปกรณ์'}
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="glass"
            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        {equipmentName && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{equipmentName}</p>
        )}

        {loadingStatus ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
          </div>
        ) : openLoan ? (
          <>
            <div style={{
              padding: '0.85rem', borderRadius: '0.5rem', background: 'var(--bg-accent-subtle)',
              fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem'
            }}>
              กำลังถูกยืมโดย <strong style={{ color: 'var(--text-primary)' }}>{openLoan.borrower_name || '-'}</strong>
              {openLoan.due_date && <> · กำหนดคืน {formatDueDate(openLoan.due_date)}</>}
            </div>
            <form onSubmit={handleReturn}>
              <div style={fieldWrap}>
                <label style={labelStyle}>วันที่คืน</label>
                <input type="date" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} style={inputStyle} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>หมายเหตุ (ถ้ามี)</label>
                <textarea rows={2} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                  background: 'var(--accent-warning)', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
                ยืนยันการคืน
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleBorrow}>
            <div style={fieldWrap}>
              <label style={labelStyle}>ชื่อผู้ยืม <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input type="text" required value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} style={inputStyle} placeholder="ชื่อ-นามสกุลผู้ยืม" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>รหัสพนักงานผู้ยืม</label>
              <input type="text" value={borrowerEmpId} onChange={(e) => setBorrowerEmpId(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>เบอร์ติดต่อผู้ยืม</label>
              <input type="text" value={borrowerContact} onChange={(e) => setBorrowerContact(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>กำหนดคืน (วันและเวลา)</label>
              <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>หมายเหตุ</label>
              <textarea rows={2} value={borrowNotes} onChange={(e) => setBorrowNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Repeat size={16} />}
              ยืนยันการยืม
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};

export default BorrowReturnModal;
