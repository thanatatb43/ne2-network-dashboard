import React from 'react';
import { History, ArrowRight } from 'lucide-react';
import ModalFrame, { ModalState } from './common/ModalFrame.jsx';
import useFetchList from './common/useFetchList.js';

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
      <div className="oh-change">
        <span className="mf-meta">{label}:</span> <span>{change.old ?? '—'}</span>
        <ArrowRight size={14} aria-label="เปลี่ยนเป็น" /> <strong>{change.new ?? '—'}</strong>
      </div>
    );
  }
  return (
    <div><span className="mf-meta">{label}: </span><strong>{change === null ? '—' : String(change)}</strong></div>
  );
};

// Full audit log for one job (GET /:id/history) -- every entry, unlike the
// owner-history modal which filters an equipment log.
const JobHistoryModal = ({ jobId, jobName, token, onClose }) => {
  const history = useFetchList(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}/history`, { token, errorText: 'โหลดประวัติของงานนี้ไม่สำเร็จ' });
  return (
    <ModalFrame title="ประวัติของงาน" icon={<History size={20} aria-hidden="true" />} subtitle={jobName} size="lg" onClose={onClose}>
      <ModalState loading={history.loading} error={history.error} onRetry={history.retry} empty={!history.items.length} emptyText="ยังไม่มีประวัติของงานนี้">
        <ul className="mf-list">
          {history.items.map((entry, i) => {
            const dataKeys = entry.data && typeof entry.data === 'object' ? Object.keys(entry.data) : [];
            return (
              <li key={entry.id || i}>
                <strong className="jh-action">{ACTION_LABELS[entry.action] || entry.action || 'การเปลี่ยนแปลง'}</strong>
                {dataKeys.map(key => <ChangeLine key={key} label={FIELD_LABELS[key] || key} change={entry.data[key]} />)}
                <p className="mf-meta">โดย {entry.user_name || entry.username || '—'} · {formatDateTime(entry.createdAt) || '—'}</p>
              </li>
            );
          })}
        </ul>
      </ModalState>
    </ModalFrame>
  );
};

export default JobHistoryModal;
