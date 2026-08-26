import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, History, ArrowRight } from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// Thai labels for the pea_jobs fields most likely to show up in a change
// entry's `data` -- falls back to the raw field key for anything not in
// this map, same defensive shape as OwnerHistoryModal.jsx.
const FIELD_LABELS = {
  job_name: 'ชื่องาน', job_description: 'รายละเอียดงาน', job_type: 'ประเภทงาน',
  priority: 'ความสำคัญ', department: 'แผนก', requester_name: 'ชื่อผู้แจ้ง',
  requester_emp_id: 'รหัสพนักงานผู้แจ้ง', requester_contact: 'เบอร์ติดต่อ',
  notification_doc_no: 'เลขที่หนังสือแจ้ง', pea_site_id: 'สำนักงาน', status: 'สถานะ',
  progress_notes: 'หมายเหตุความคืบหน้า', work_order_no: 'เลขที่คำสั่งปฏิบัติงาน',
  closing_notes: 'หมายเหตุปิดงาน', cancelled_reason: 'เหตุผลที่ยกเลิก',
  notification_doc_file: 'ไฟล์หนังสือแจ้ง', completion_report_file: 'รายงานผลการดำเนินการ'
};

// Some common audit-log action names, translated where guessable -- an
// unrecognized action just falls back to showing the raw string, since the
// exact set this backend emits hasn't been confirmed against a real
// response yet (same situation notification_doc_file/assignees were in
// before the user pasted real API responses to correct them).
const ACTION_LABELS = {
  CREATE: 'สร้างงาน', UPDATE: 'แก้ไขข้อมูล', DELETE: 'ลบงาน',
  STATUS_CHANGE: 'เปลี่ยนสถานะ', PROGRESS: 'เริ่มดำเนินการ', COMPLETE: 'ปิดงาน',
  CANCEL: 'ยกเลิกงาน'
};

const ChangeLine = ({ label, change }) => {
  if (change === undefined) return null;
  if (change !== null && typeof change === 'object' && ('old' in change || 'new' in change)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
        <span>{change.old ?? '-'}</span>
        <ArrowRight size={12} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontWeight: 700 }}>{change.new ?? '-'}</span>
      </div>
    );
  }
  return (
    <div>
      <span style={{ color: 'var(--text-secondary)' }}>{label}: </span>
      <span style={{ fontWeight: 700 }}>{change === null ? '-' : String(change)}</span>
    </div>
  );
};

// Full audit log for one job (GET /:id/history) -- unlike
// OwnerHistoryModal.jsx (which filters an equipment's log down to just
// owner-field changes), this shows every entry since a job's history is
// the point of the feature, not a filtered slice of it.
const JobHistoryModal = ({ jobId, jobName, token, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await res.json();
        const list = result.data || result;
        setEntries(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load job history:', err);
        setError('ไม่สามารถโหลดประวัติของงานนี้ได้');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [jobId, token]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="card glass"
        style={{ padding: '1.5rem', maxWidth: '520px', width: '100%', borderRadius: '0.75rem', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} /> ประวัติของงาน
          </h3>
          <button
            onClick={onClose}
            className="glass"
            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        {jobName && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{jobName}</p>
        )}

        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
          </div>
        ) : error ? (
          <p style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>{error}</p>
        ) : entries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>ยังไม่มีประวัติของงานนี้</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entries.map((entry, i) => {
              const dataKeys = entry.data && typeof entry.data === 'object' ? Object.keys(entry.data) : [];
              return (
                <div key={entry.id || i} className="glass" style={{ padding: '0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-primary)' }}>
                    {ACTION_LABELS[entry.action] || entry.action || 'การเปลี่ยนแปลง'}
                  </div>
                  {dataKeys.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      {dataKeys.map(key => (
                        <ChangeLine key={key} label={FIELD_LABELS[key] || key} change={entry.data[key]} />
                      ))}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    โดย: {entry.user_name || entry.username || '-'} · {formatDateTime(entry.createdAt) || '-'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default JobHistoryModal;
