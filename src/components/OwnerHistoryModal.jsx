import React from 'react';
import { ArrowRight, UserCog } from 'lucide-react';
import ModalFrame, { ModalState } from './common/ModalFrame.jsx';
import useFetchList from './common/useFetchList.js';

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// A changed field on an ASSET_INFO_CHANGE entry is normally { old, new },
// but can be a plain value (e.g. the first value set on creation).
const ChangeLine = ({ label, change }) => {
  if (change == null) return null;
  if (typeof change === 'object') {
    return (
      <div className="oh-change">
        <span className="mf-meta">{label}:</span> <span>{change.old || '—'}</span>
        <ArrowRight size={14} aria-label="เปลี่ยนเป็น" /> <strong>{change.new || '—'}</strong>
      </div>
    );
  }
  return <div><span className="mf-meta">{label}: </span><strong>{change}</strong></div>;
};

// Ownership/holder history, filtered from the general audit log
// (GET /:id/history) to ASSET_INFO_CHANGE entries touching the owner fields.
const OwnerHistoryModal = ({ equipmentId, equipmentName, token, onClose }) => {
  const history = useFetchList(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/history`, { token, errorText: 'โหลดประวัติผู้ถือครองไม่สำเร็จ' });
  const entries = history.items.filter(e => e.action === 'ASSET_INFO_CHANGE' && e.data && (e.data.asset_owner !== undefined || e.data.asset_owner_emp_id !== undefined));
  return (
    <ModalFrame title="ประวัติผู้ถือครอง" icon={<UserCog size={20} aria-hidden="true" />} subtitle={equipmentName} onClose={onClose}>
      <ModalState loading={history.loading} error={history.error} onRetry={history.retry} empty={!entries.length} emptyText="ยังไม่มีประวัติการเปลี่ยนผู้ถือครอง">
        <ul className="mf-list">
          {entries.map((entry, i) => (
            <li key={entry.id ?? i}>
              <ChangeLine label="ผู้ถือครอง" change={entry.data.asset_owner} />
              <ChangeLine label="รหัสพนักงาน" change={entry.data.asset_owner_emp_id} />
              <p className="mf-meta oh-by">เปลี่ยนโดย {entry.user_name || '—'} · {formatDateTime(entry.createdAt) || '—'}</p>
            </li>
          ))}
        </ul>
      </ModalState>
    </ModalFrame>
  );
};

export default OwnerHistoryModal;
