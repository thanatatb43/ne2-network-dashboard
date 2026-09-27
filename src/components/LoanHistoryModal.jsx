import React from 'react';
import { History, UserCog } from 'lucide-react';
import ModalFrame, { ModalState } from './common/ModalFrame.jsx';
import useFetchList from './common/useFetchList.js';

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// Staff can be a nested user object or only a *_user_id.
const staffLabel = (user, id) => {
  if (user && (user.first_name || user.username)) {
    return `${[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}${user.username ? ` (@${user.username})` : ''}`;
  }
  return id ? `รหัสผู้ใช้ #${id}` : '—';
};

const borrowedAt = (loan) => loan.borrowed_at || loan.created_at || loan.createdAt;

// Public, no-login loan history for one piece of equipment.
const LoanHistoryModal = ({ equipmentId, equipmentName, onClose }) => {
  const loans = useFetchList(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/loans`, { errorText: 'โหลดประวัติการยืม-คืนไม่สำเร็จ' });
  const sorted = [...loans.items].sort((a, b) => new Date(borrowedAt(b) || 0).getTime() - new Date(borrowedAt(a) || 0).getTime());
  return (
    <ModalFrame title="ประวัติการยืม-คืน" icon={<History size={20} aria-hidden="true" />} subtitle={equipmentName} size="lg" onClose={onClose}>
      <ModalState loading={loans.loading} error={loans.error} onRetry={loans.retry} empty={!sorted.length} emptyText="ยังไม่มีประวัติการยืม-คืน">
        <ul className="mf-list">
          {sorted.map((loan, i) => {
            const open = !loan.returned_at;
            return (
              <li key={loan.id ?? i}>
                <div className="lh-head">
                  <strong>{loan.borrower_name || '—'}</strong>
                  <span className={`mf-pill ${open ? 'mf-pill-open' : 'mf-pill-done'}`}>{open ? 'ยังไม่คืน' : 'คืนแล้ว'}</span>
                </div>
                {(loan.borrower_emp_id || loan.borrower_contact) && <p className="mf-meta">{[loan.borrower_emp_id, loan.borrower_contact].filter(Boolean).join(' · ')}</p>}
                <p className="mf-meta">ยืมเมื่อ {formatDateTime(borrowedAt(loan)) || '—'}{loan.due_date && ` · กำหนดคืน ${formatDateTime(loan.due_date)}`}</p>
                {!open && <p className="mf-meta">คืนเมื่อ {formatDateTime(loan.returned_at)}</p>}
                <p className="mf-meta lh-staff"><UserCog size={14} aria-hidden="true" /> ดำเนินการโดย {staffLabel(loan.borrowed_by || loan.staff, loan.borrowed_by_user_id)}</p>
                {loan.notes && <p className="lh-notes">หมายเหตุ: {loan.notes}</p>}
              </li>
            );
          })}
        </ul>
      </ModalState>
    </ModalFrame>
  );
};

export default LoanHistoryModal;
